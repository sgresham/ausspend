import { createRequire } from 'node:module';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readArchivedDocument, sha256Bytes } from './source-archive.js';
import type { ArchivedSourceRecord } from './source-archive.js';

/**
 * Reusable PDF text + table extraction with money/unit validation.
 *
 * The extractor never assumes a currency unit: a table is only `ingestable`
 * when an explicit unit (dollars / $'000 / $m / $b) is present in the header
 * and any row/column totals reconcile. Rows are always `provisional` — a human
 * must review them before anything is marked verified.
 */

export type MoneyUnitKind = 'dollars' | 'thousands' | 'millions' | 'billions';
export type ExtractionConfidence = 'low' | 'medium' | 'high';
export type DataQualityFlag = 'provisional';

export const UNIT_MULTIPLIER_TO_CENTS: Readonly<Record<MoneyUnitKind, number>> = {
  dollars: 100,
  thousands: 100_000,
  millions: 100_000_000,
  billions: 100_000_000_000,
};

export interface PdfTextItem {
  page_number: number;
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPage {
  page_number: number;
  text: string;
  items: PdfTextItem[];
}

export interface UnitDetection {
  kind: MoneyUnitKind | null;
  multiplier_to_cents: number | null;
  ambiguous: boolean;
  raw_matches: string[];
  reason: string;
}

export interface PdfTableColumn {
  index: number;
  name: string;
  x: number;
  numeric: boolean;
  is_total: boolean;
}

export interface PdfTableRow {
  row_index: number;
  label: string;
  cells: string[];
  /** Numeric cell values in source units (thousands of dollars, millions, …). */
  values: Array<number | null>;
  /** Converted integer cents; null when the unit is unavailable or the cell is empty. */
  amounts_cents: Array<number | null>;
  is_total: boolean;
  data_quality_flag: DataQualityFlag;
  extraction_confidence: ExtractionConfidence;
}

export interface TotalCheck {
  kind: 'row' | 'column';
  label: string;
  expected_cents: number;
  actual_cents: number;
  ok: boolean;
}

export interface ExtractedPdfTable {
  page_number: number;
  table_index: number;
  header: string[];
  unit: UnitDetection;
  columns: PdfTableColumn[];
  rows: PdfTableRow[];
  checks: TotalCheck[];
  totals_verified: boolean;
  extraction_confidence: ExtractionConfidence;
  /** Unit explicit and totals reconcile (or there are no totals to reconcile). */
  valid: boolean;
  /** Safe to ingest into the app (always false when the unit is ambiguous/mismatched). */
  ingestable: boolean;
  warnings: string[];
  errors: string[];
}

export interface PdfExtraction {
  source: {
    url?: string;
    local_path?: string;
    sha256: string;
    bytes: number;
  };
  pages: PdfPage[];
  text: string;
  tables: ExtractedPdfTable[];
  warnings: string[];
}

export interface ExtractPdfOptions {
  source_url?: string;
  local_path?: string;
  /** Horizontal clustering tolerance in PDF points. */
  column_tolerance?: number;
  /** Vertical tolerance for grouping text into a row, in PDF points. */
  row_tolerance?: number;
  /** Rows above this vertical gap are treated as a new table. */
  table_gap?: number;
}

export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfExtractionError';
  }
}

const require = createRequire(import.meta.url);

function standardFontDataUrl(): string | undefined {
  try {
    return `${path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')}${path.sep}`;
  } catch {
    return undefined;
  }
}

const UNIT_PATTERNS: Array<{ kind: MoneyUnitKind; pattern: RegExp }> = [
  { kind: 'billions', pattern: /\$\s*(?:b|bn|bil|billion)\b|\b(?:billions?)\b/i },
  { kind: 'millions', pattern: /\$\s*(?:m|mn|million)\b|\b(?:millions?)\b/i },
  {
    kind: 'thousands',
    pattern: /\$\s*['’]?0{3}\b|['’]000\b|\$\s*(?:k|thousand)\b|\bthousands?\b/i,
  },
  { kind: 'dollars', pattern: /\$\s*(?!['’0-9bmk])|\baud\b|\bdollars?\b/i },
];

/** Detect a money unit from header/unit text. Missing or conflicting units are ambiguous. */
export function detectMoneyUnit(samples: readonly string[]): UnitDetection {
  const found = new Set<MoneyUnitKind>();
  const raw: string[] = [];
  for (const sample of samples) {
    const text = sample.trim();
    if (!text) continue;
    for (const { kind, pattern } of UNIT_PATTERNS) {
      if (pattern.test(text)) {
        found.add(kind);
        raw.push(`${kind}: ${text}`);
      }
    }
  }
  // A larger unit ("$'000", "$m") also contains "$"; do not treat that as ambiguity.
  const larger = [...found].filter((kind) => kind !== 'dollars');
  if (larger.length > 1) {
    return {
      kind: null,
      multiplier_to_cents: null,
      ambiguous: true,
      raw_matches: raw,
      reason: `conflicting units detected: ${larger.join(', ')}`,
    };
  }
  if (larger.length === 1) {
    const kind = larger[0] as MoneyUnitKind;
    return {
      kind,
      multiplier_to_cents: UNIT_MULTIPLIER_TO_CENTS[kind],
      ambiguous: false,
      raw_matches: raw,
      reason: `unit ${kind} detected in header`,
    };
  }
  if (found.has('dollars')) {
    return {
      kind: 'dollars',
      multiplier_to_cents: UNIT_MULTIPLIER_TO_CENTS.dollars,
      ambiguous: false,
      raw_matches: raw,
      reason: 'dollar sign detected in header',
    };
  }
  return {
    kind: null,
    multiplier_to_cents: null,
    ambiguous: true,
    raw_matches: raw,
    reason: 'no explicit currency unit in table header — refusing to guess dollars',
  };
}

export interface ParsedAmount {
  value: number | null;
  empty: boolean;
  error?: string;
}

/** Parse one numeric table cell. `null` means an explicit nil marker, not zero. */
export function parseAmountCell(raw: string | null | undefined): ParsedAmount {
  if (raw === null || raw === undefined) return { value: null, empty: true };
  const text = raw.trim();
  if (!text) return { value: null, empty: true };
  if (/^(?:-|–|—|n\/a|na|nil|\.)$/i.test(text)) return { value: null, empty: true };
  if (text.includes('%'))
    return { value: null, empty: false, error: 'percent cell is not a money amount' };
  const negative = /^\s*\(.*\)\s*$/.test(text) || /^\s*-/.test(text);
  const cleaned = text
    .replace(/[()$,]/g, '')
    .replace(/^[-–—]\s*/, '')
    .replace(/\s+/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) {
    return { value: null, empty: false, error: `unparseable numeric cell ${JSON.stringify(raw)}` };
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return { value: null, empty: false, error: `non-finite numeric cell ${JSON.stringify(raw)}` };
  }
  return { value: negative ? -value : value, empty: false };
}

/** Convert a source-unit value to integer cents. Never defaults the unit. */
export function moneyToCents(value: number, unit: MoneyUnitKind): number {
  if (!Number.isFinite(value)) throw new Error(`moneyToCents received non-finite value ${value}`);
  return Math.round(value * UNIT_MULTIPLIER_TO_CENTS[unit]);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

interface RawItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RawRow {
  y: number;
  items: RawItem[];
}

function textItemsFromContent(items: ReadonlyArray<unknown>, pageNumber: number): PdfTextItem[] {
  const out: PdfTextItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || !('str' in raw)) continue;
    const item = raw as { str: unknown; transform?: unknown; width?: unknown; height?: unknown };
    if (typeof item.str !== 'string' || !item.str.trim()) continue;
    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = typeof transform[4] === 'number' ? transform[4] : 0;
    const y = typeof transform[5] === 'number' ? transform[5] : 0;
    out.push({
      page_number: pageNumber,
      str: item.str,
      x,
      y,
      width: typeof item.width === 'number' ? item.width : 0,
      height: typeof item.height === 'number' ? item.height : 0,
    });
  }
  return out;
}

function groupRows(items: readonly PdfTextItem[], tolerance: number): RawRow[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: RawRow[] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - item.y) <= tolerance) {
      row.items.push({
        str: item.str,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      });
    } else {
      rows.push({
        y: item.y,
        items: [{ str: item.str, x: item.x, y: item.y, width: item.width, height: item.height }],
      });
    }
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

function clusterColumns(rows: readonly RawRow[], tolerance: number): number[] {
  const positions: number[] = [];
  for (const row of rows) for (const item of row.items) positions.push(item.x);
  positions.sort((a, b) => a - b);
  const clusters: Array<{ x: number; count: number }> = [];
  for (const x of positions) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(x - last.x) <= tolerance) {
      last.x = (last.x * last.count + x) / (last.count + 1);
      last.count += 1;
    } else {
      clusters.push({ x, count: 1 });
    }
  }
  return clusters.map((cluster) => cluster.x).sort((a, b) => a - b);
}

function nearestColumn(x: number, columns: readonly number[]): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < columns.length; i += 1) {
    const distance = Math.abs(x - (columns[i] ?? 0));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

function rowCells(row: RawRow, columns: readonly number[], tolerance: number): string[] {
  const cells: string[][] = columns.map(() => []);
  for (const item of row.items) {
    const index = nearestColumn(item.x, columns);
    const columnX = columns[index] ?? item.x;
    // If a label starts far left of any anchor, still keep it in the nearest column.
    if (Math.abs(item.x - columnX) > Math.max(tolerance * 2, 80) && item.str.trim().length > 0) {
      cells[index]?.push(item.str);
    } else {
      cells[index]?.push(item.str);
    }
  }
  return cells.map((parts) => parts.join('').replace(/\s+/g, ' ').trim());
}

function looksLikeUnit(text: string): boolean {
  return detectMoneyUnit([text]).kind !== null;
}

function headerScore(row: RawRow): number {
  const text = row.items.map((item) => item.str).join(' ');
  let score = 0;
  if (/\b(?:total|sum)\b/i.test(text)) score += 2;
  if (/\b(?:19|20)\d{2}(?:[-–/]\d{2,4})?\b/.test(text)) score += 2;
  if (
    /\b(?:amount|program|category|description|agency|department|project|expenditure)\b/i.test(text)
  )
    score += 2;
  if (looksLikeUnit(text)) score += 1;
  score += Math.min(2, Math.max(0, row.items.length - 1));
  return score;
}

function isTotalLabel(label: string): boolean {
  return /^(?:grand\s+)?total\b|^sum\b|^all\b/i.test(label.trim());
}

function parseTable(
  pageNumber: number,
  tableIndex: number,
  headerRow: RawRow,
  unit: UnitDetection,
  dataRows: RawRow[],
  columns: readonly number[],
  header: string[],
  options: Required<Pick<ExtractPdfOptions, 'column_tolerance' | 'row_tolerance'>>,
): ExtractedPdfTable {
  const warnings: string[] = [];
  const errors: string[] = [];
  const tolerance = options.column_tolerance;

  const rawCells = dataRows.map((row) => rowCells(row, columns, tolerance));
  const headerNumeric = header.map((name, index) => {
    if (index === 0) return false;
    const parsed = parseAmountCell(name);
    return parsed.value !== null;
  });
  const numericColumn = columns.map((_x, index) => {
    if (index === 0) return false;
    if (headerNumeric[index]) return true;
    let numeric = 0;
    let nonEmpty = 0;
    for (const cells of rawCells) {
      const cell = cells[index] ?? '';
      if (!cell) continue;
      nonEmpty += 1;
      if (parseAmountCell(cell).value !== null) numeric += 1;
    }
    return nonEmpty >= 2 && numeric / nonEmpty >= 0.6;
  });

  const columnsOut: PdfTableColumn[] = columns.map((x, index) => ({
    index,
    name: header[index] ?? `column_${index + 1}`,
    x,
    numeric: numericColumn[index] ?? false,
    is_total: /^(?:grand\s+)?total\b|^sum$/i.test((header[index] ?? '').trim()),
  }));

  const totalColumnIndex = columnsOut.findIndex((column) => column.is_total);
  const unitKind = unit.kind;

  const rows: PdfTableRow[] = [];
  rawCells.forEach((cells, index) => {
    const label = cells[0] ?? '';
    const isTotal = isTotalLabel(label);
    const values: Array<number | null> = [];
    const amounts: Array<number | null> = [];
    cells.forEach((cell, columnIndex) => {
      // The label column is text; only numeric columns are parsed and validated.
      if (!numericColumn[columnIndex]) {
        values.push(null);
        amounts.push(null);
        return;
      }
      const parsed = parseAmountCell(cell);
      if (parsed.error) {
        errors.push(`row ${index + 1} column ${columnIndex + 1}: ${parsed.error}`);
      }
      values.push(parsed.value);
      amounts.push(parsed.value !== null && unitKind ? moneyToCents(parsed.value, unitKind) : null);
    });
    rows.push({
      row_index: index,
      label,
      cells,
      values,
      amounts_cents: amounts,
      is_total: isTotal,
      data_quality_flag: 'provisional',
      extraction_confidence: 'low',
    });
  });

  const dataRowIndexes = rows
    .map((row, index) => (row.is_total ? -1 : index))
    .filter((i) => i >= 0);
  const totalRowIndex = rows.findIndex((row) => row.is_total);
  const numericIndexes = columnsOut
    .filter((column) => column.numeric && !column.is_total)
    .map((column) => column.index);

  const checks: TotalCheck[] = [];
  if (unitKind) {
    // Row totals: sum the numeric cells of a row and compare with its total cell.
    if (totalColumnIndex >= 0) {
      for (const rowIndex of dataRowIndexes) {
        const row = rows[rowIndex];
        if (!row) continue;
        let sum = 0;
        for (const columnIndex of numericIndexes) sum += row.values[columnIndex] ?? 0;
        const expectedValue = row.values[totalColumnIndex] ?? null;
        if (expectedValue === null) {
          if (sum !== 0) {
            errors.push(`row ${rowIndex + 1} (${row.label}) has no total but a non-zero sum`);
          }
          continue;
        }
        const expectedCents = moneyToCents(expectedValue, unitKind);
        const actualCents = moneyToCents(sum, unitKind);
        checks.push({
          kind: 'row',
          label: `row ${rowIndex + 1} ${row.label}`,
          expected_cents: expectedCents,
          actual_cents: actualCents,
          ok: expectedCents === actualCents,
        });
      }
    }

    // Column totals: sum each numeric column and compare with the total row.
    if (totalRowIndex >= 0) {
      const totalRow = rows[totalRowIndex];
      if (totalRow) {
        for (const columnIndex of numericIndexes) {
          let sum = 0;
          for (const rowIndex of dataRowIndexes) sum += rows[rowIndex]?.values[columnIndex] ?? 0;
          const expectedValue = totalRow.values[columnIndex] ?? null;
          if (expectedValue === null) continue;
          const expectedCents = moneyToCents(expectedValue, unitKind);
          const actualCents = moneyToCents(sum, unitKind);
          checks.push({
            kind: 'column',
            label: `column ${columnIndex + 1} ${columnsOut[columnIndex]?.name ?? ''}`.trim(),
            expected_cents: expectedCents,
            actual_cents: actualCents,
            ok: expectedCents === actualCents,
          });
        }
      }
    }

    // Grand total: the total row's own row-sum must equal its total cell.
    if (totalRowIndex >= 0 && totalColumnIndex >= 0) {
      const totalRow = rows[totalRowIndex];
      const grandTotalValue = totalRow?.values[totalColumnIndex] ?? null;
      if (totalRow && grandTotalValue !== null) {
        let sum = 0;
        for (const columnIndex of numericIndexes) sum += totalRow.values[columnIndex] ?? 0;
        const expectedCents = moneyToCents(grandTotalValue, unitKind);
        const actualCents = moneyToCents(sum, unitKind);
        checks.push({
          kind: 'row',
          label: `grand total ${totalRow.label}`,
          expected_cents: expectedCents,
          actual_cents: actualCents,
          ok: expectedCents === actualCents,
        });
      }
    }
  }

  const mismatches = checks.filter((check) => !check.ok);
  for (const check of mismatches) {
    errors.push(
      `${check.kind} total mismatch for ${check.label}: ` +
        `expected ${check.expected_cents} cents, summed ${check.actual_cents} cents`,
    );
  }

  if (!unitKind) {
    errors.push(`cannot ingest table without an explicit unit: ${unit.reason}`);
  }
  if (unit.ambiguous) errors.push(`ambiguous unit: ${unit.reason}`);
  if (errors.length > 0) {
    for (const error of errors) if (!warnings.includes(error)) warnings.push(error);
  }

  let confidence: ExtractionConfidence;
  if (!unitKind || unit.ambiguous || errors.length > 0) confidence = 'low';
  else if (checks.length === 0) confidence = 'medium';
  else confidence = 'high';

  const valid = Boolean(unitKind) && !unit.ambiguous && errors.length === 0;
  const ingestable = valid;

  for (const row of rows) row.extraction_confidence = confidence;

  return {
    page_number: pageNumber,
    table_index: tableIndex,
    header,
    unit,
    columns: columnsOut,
    rows,
    checks,
    totals_verified: checks.length > 0 && mismatches.length === 0,
    extraction_confidence: confidence,
    valid,
    ingestable,
    warnings,
    errors,
  };
}

function buildTablesFromRows(
  pageNumber: number,
  rows: RawRow[],
  startIndex: number,
  options: ExtractPdfOptions,
): ExtractedPdfTable[] {
  const rowTolerance = options.row_tolerance ?? 3;
  const columnTolerance = options.column_tolerance ?? 12;
  const tableGap = options.table_gap ?? 30;
  const tables: ExtractedPdfTable[] = [];
  let index = 0;

  let cursor = 0;
  while (cursor < rows.length) {
    // Find a plausible header near the cursor.
    let headerIndex = -1;
    for (let i = cursor; i < Math.min(rows.length, cursor + 4); i += 1) {
      const row = rows[i];
      if (!row) continue;
      if (row.items.length >= 2 && headerScore(row) >= 3) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex < 0) {
      cursor += 1;
      continue;
    }
    const headerRow = rows[headerIndex];
    if (!headerRow) break;
    let bodyStart = headerIndex + 1;
    // A unit row such as ($'000) immediately under the header is part of the header.
    const unitSamples = headerRow.items.map((item) => item.str);
    const unitCandidate = rows[bodyStart];
    if (unitCandidate && unitCandidate.items.length <= 2) {
      const candidateText = unitCandidate.items.map((item) => item.str).join(' ');
      if (looksLikeUnit(candidateText)) {
        unitSamples.push(candidateText);
        bodyStart += 1;
      }
    }
    const unit = detectMoneyUnit(unitSamples);

    const body: RawRow[] = [];
    let previousY = rows[bodyStart - 1]?.y ?? headerRow.y;
    for (let i = bodyStart; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row) continue;
      if (previousY - row.y > tableGap) break;
      if (headerScore(row) >= 5 && body.length > 1) break;
      body.push(row);
      previousY = row.y;
    }
    if (body.length === 0) {
      cursor = bodyStart;
      continue;
    }

    const allRows = [
      headerRow,
      ...(bodyStart > headerIndex + 1 ? [rows[headerIndex + 1] as RawRow] : []),
      ...body,
    ];
    const columns = clusterColumns(allRows, columnTolerance);
    const headerCells = rowCells(headerRow, columns, columnTolerance);
    const table = parseTable(
      pageNumber,
      startIndex + index,
      headerRow,
      unit,
      body,
      columns,
      headerCells,
      { column_tolerance: columnTolerance, row_tolerance: rowTolerance },
    );
    tables.push(table);
    index += 1;
    cursor = bodyStart + body.length;
  }

  return tables;
}

/** Extract text, tables, units and total checks from PDF bytes. No network access. */
export async function extractPdf(
  bytes: Uint8Array | Buffer,
  options: ExtractPdfOptions = {},
): Promise<PdfExtraction> {
  const data = new Uint8Array(bytes);
  // Hash before pdf.js takes ownership of the buffer (it may transfer/detach it).
  const digest = sha256Bytes(data);
  const byteLength = data.length;
  const loadingTask = getDocument({
    data: data.slice(),
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl: standardFontDataUrl(),
  });
  const pages: PdfPage[] = [];
  const tables: ExtractedPdfTable[] = [];
  const warnings: string[] = [];
  try {
    const document = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = textItemsFromContent(content.items, pageNumber);
      const text = items.map((item) => item.str).join(' ');
      pages.push({ page_number: pageNumber, text, items });
      const rows = groupRows(items, options.row_tolerance ?? 3);
      tables.push(...buildTablesFromRows(pageNumber, rows, tables.length, options));
      page.cleanup();
    }
  } catch (error) {
    throw new PdfExtractionError(
      `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await loadingTask.destroy();
  }

  if (tables.length === 0) warnings.push('no tables detected in PDF');
  return {
    source: {
      ...(options.source_url ? { url: options.source_url } : {}),
      ...(options.local_path ? { local_path: options.local_path } : {}),
      sha256: digest,
      bytes: byteLength,
    },
    pages,
    text: pages.map((page) => page.text).join('\n\n'),
    tables,
    warnings,
  };
}

/** Extract a PDF that is already in the source archive, verifying its hash first. */
export async function extractArchivedPdf(
  record: Pick<ArchivedSourceRecord, 'local_path' | 'sha256' | 'bytes' | 'original_url'>,
  options: Omit<ExtractPdfOptions, 'local_path' | 'source_url'> = {},
): Promise<PdfExtraction> {
  const bytes = await readArchivedDocument(record);
  return extractPdf(bytes, {
    ...options,
    source_url: record.original_url,
    local_path: record.local_path,
  });
}
