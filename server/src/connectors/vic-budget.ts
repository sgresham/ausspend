import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { SpendingRecord } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * Victorian State Budget 2026-27 connector (Phase 4, VIC only).
 *
 * Two DataVic CKAN XLSX resources are ingested:
 *   - Aggregate financial statements: "Consolidated expenses by classification
 *     of the functions of government - General government sector"
 *     (1.5_2026-27-budget-consolidated-gg-expenses-by-cofog.xlsx).
 *   - Departmental statements: Department of Treasury and Finance financial
 *     statement (one representative departmental workbook for this item).
 *
 * Units are explicit in every workbook: `($ million)` on the COFOG sheet
 * (rows 3 and 53) and the DTF operating statement (row 5). `$m` is converted to
 * integer cents at 100,000,000 cents per million dollars. No unit is inferred
 * from magnitude.
 *
 * COFOG caveat: Victoria's COFOG disclosure lists 10 major groups but omits
 * Defence and reports Transport as a separate major group. The shared taxonomy
 * has no division code for Transport, so the Transport row is tagged with the
 * standard subdivision code 045 and a note saying VIC's Economic affairs (04)
 * excludes transport; 045 must not be rolled into 04 for, or added to, that row.
 *
 * Only the `budget` columns for 2025-26 and 2026-27 are ingested. Actual,
 * revised and forward-estimate columns are deliberately skipped, and measure
 * types are never summed. Figures are Budgeted, not audited actuals.
 */

export const VIC_ID = 'vic-budget';
export const VIC_NAME = 'Victorian State Budget 2026-27';
export const VIC_PUBLISHER = 'Victorian Department of Treasury and Finance';
export const VIC_DATASET = 'VIC Budget 2026-27 Open Data';
export const VIC_FISCAL_YEAR = '2026-27';
export const VIC_CKAN_API_BASE = 'https://discover.data.vic.gov.au/api/3/action';
export const VIC_SOURCE_URL =
  'https://discover.data.vic.gov.au/dataset/state-budget-2026-27-aggregate-financial-statements';
export const VIC_LICENSE = 'CC BY 4.0';
export const VIC_ATTRIBUTION = '© State of Victoria (Department of Treasury and Finance), 2026';
export const VIC_UNIT = '$m';
export const VIC_UNIT_TO_CENTS = 100_000_000;
export const VIC_BUDGET_YEARS = ['2025-26', '2026-27'] as const;
export const VIC_DEPARTMENT = 'Department of Treasury and Finance';

const KNOWN_PACKAGES = {
  aggregate: 'state-budget-2026-27-aggregate-financial-statements',
  departmental: 'state-budget-2026-27-departmental-statements',
} as const;

export interface VicWorkbookRows {
  sheets: Array<{
    name: string;
    rows: Array<{ number: number; values: Array<string | number | null> }>;
  }>;
}

export interface VicResource {
  package_id: string;
  package_name: string;
  dataset_title: string;
  metadata_modified: string;
  resource_id: string;
  name: string;
  format: string;
  url: string;
  filename: string;
}

export interface VicSourceSelection {
  aggregate: VicResource;
  departmental: VicResource;
}

export interface VicSourceMeta {
  package_id: string;
  package_name: string;
  resource_id: string;
  resource_name: string;
  filename: string;
  url: string;
  source_sha256: string;
  source_date: string;
}

export interface VicCofogRaw extends Record<string, unknown> {
  kind: 'cofog';
  package_id: string;
  package_name: string;
  resource_id: string;
  resource_name: string;
  filename: string;
  url: string;
  source_sha256: string;
  source_date: string;
  sheet: string;
  row: number;
  column_index: number;
  column_header: string;
  label: string;
  function_code: string;
  function_name: string;
  function_note: string;
  fiscal_year: string;
  measure_type: 'budget';
  raw_value: number;
  unit: typeof VIC_UNIT;
}

export interface VicDepartmentalRaw extends Record<string, unknown> {
  kind: 'departmental';
  package_id: string;
  package_name: string;
  resource_id: string;
  resource_name: string;
  filename: string;
  url: string;
  source_sha256: string;
  source_date: string;
  department: string;
  sheet: string;
  row: number;
  column_index: number;
  column_header: string;
  label: string;
  fiscal_year: string;
  measure_type: 'budget';
  raw_value: number;
  unit: typeof VIC_UNIT;
}

export type VicRaw = VicCofogRaw | VicDepartmentalRaw;

export interface VicSkip {
  filename: string;
  sheet: string;
  row: number | null;
  reason: string;
}

export interface VicTransformResult {
  records: SpendingRecord[];
  skipped: VicSkip[];
  duplicates: number;
}

export interface VicConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  /** Injected for unit tests; defaults to the streaming ExcelJS reader. */
  readWorkbook?: (filePath: string) => Promise<VicWorkbookRows>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').replace(/\s+/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Collapse a workbook cell value (including formula/rich-text objects) to text/number. */
export function worksheetCellValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (!isObject(value)) return null;
  if ('result' in value) {
    const result = value.result;
    if (typeof result === 'number' || typeof result === 'string') return result;
    if (result instanceof Date) return result.toISOString().slice(0, 10);
  }
  if (typeof value.text === 'string') return value.text;
  if (Array.isArray(value.richText)) {
    return value.richText
      .map((part) => (isObject(part) && typeof part.text === 'string' ? part.text : ''))
      .join('');
  }
  return null;
}

function rowMaxColumn(values: readonly (string | number | null)[]): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null && values[index] !== undefined) return index + 1;
  }
  return 0;
}

/** Convert a raw amount in a confirmed unit to integer cents; null if unusable. */
export function amountToCents(value: unknown, unit: string): number | null {
  if (unit !== VIC_UNIT) return null;
  const numeric = numberValue(value);
  if (numeric === null) return null;
  const cents = Math.round(numeric * VIC_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return cents;
}

/**
 * Normalise a fiscal-year cell. Accepts `2025-26`, `2025-2026`, ISO dates and
 * Excel serial dates. Copied from the NSW reader so VIC parsing is independent.
 */
export function financialYearOf(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 20_000 && value < 80_000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return financialYearOf(date.toISOString().slice(0, 10));
  }
  if (value instanceof Date) return financialYearOf(value.toISOString().slice(0, 10));
  const raw = text(value);
  if (!raw) return null;

  const financial = /^(\d{4})\s*[-/]\s*(\d{2,4})$/.exec(raw);
  if (financial) {
    const start = Number(financial[1]);
    const endRaw = financial[2]!;
    const end =
      endRaw.length === 4 ? Number(endRaw) : Math.floor(start / 100) * 100 + Number(endRaw);
    if (end === start + 1) return `${start}-${String(end).slice(-2)}`;
  }
  return null;
}

/** Actual/Revised/Budget/Estimate column labels, robust to footnote superscripts. */
export function measureTypeFromCell(value: unknown): 'actual' | 'budget' | 'estimate' | null {
  const raw = text(value)?.toLowerCase();
  if (!raw) return null;
  if (/^budget\b/.test(raw)) return 'budget';
  if (/^revised\b/.test(raw)) return 'estimate';
  if (/^actual\b/.test(raw)) return 'actual';
  if (/^estimate\b/.test(raw)) return 'estimate';
  return null;
}

const COFOG_ROW_MAP: Array<{ pattern: RegExp; code: string; name: string; note?: string }> = [
  { pattern: /^General public services\b/i, code: '01', name: 'General public services' },
  { pattern: /^Public order and safety\b/i, code: '03', name: 'Public order and safety' },
  { pattern: /^Economic affairs\b/i, code: '04', name: 'Economic affairs' },
  { pattern: /^Environmental protection\b/i, code: '05', name: 'Environmental protection' },
  {
    pattern: /^Housing and community amenities\b/i,
    code: '06',
    name: 'Housing and community amenities',
  },
  { pattern: /^Health\b/i, code: '07', name: 'Health' },
  {
    pattern: /^Recreation, culture and religion\b/i,
    code: '08',
    name: 'Recreation, culture and religion',
  },
  { pattern: /^Education\b/i, code: '09', name: 'Education' },
  { pattern: /^Social protection\b/i, code: '10', name: 'Social protection' },
  {
    pattern: /^Transport\b/i,
    code: '045',
    name: 'Transport',
    note: 'VIC reports Transport as a separate COFOG major group; its Economic affairs (04) row excludes transport. 045 must not be rolled into, or added to, 04.',
  },
];

/** Map a VIC COFOG row label to a shared function code; null for totals/not allocated. */
export function cofogMappingForLabel(
  label: string,
): { code: string; name: string; note: string } | null {
  for (const entry of COFOG_ROW_MAP) {
    if (entry.pattern.test(label)) {
      return { code: entry.code, name: entry.name, note: entry.note ?? '' };
    }
  }
  return null;
}

export interface VicColumn {
  index: number;
  header: string;
  year: string;
  measure_type: 'actual' | 'budget' | 'estimate';
}

export interface VicHeader {
  unitRow: number;
  yearRow: number;
  typeRow: number;
  columns: VicColumn[];
}

function detectUnitBlock(
  rows: ReadonlyArray<{ number: number; values: Array<string | number | null> }>,
  accept: (columns: VicColumn[]) => boolean,
): VicHeader | null {
  for (let index = 0; index < rows.length; index += 1) {
    const unitValues = rows[index]!.values;
    const unitText = unitValues.map((value) => text(value)?.toLowerCase() ?? '').join(' ');
    if (!unitText.includes('$ million') && !unitText.includes('$m')) continue;
    const yearRow = rows[index + 1];
    const typeRow = rows[index + 2];
    if (!yearRow || !typeRow) continue;
    const columnCount = Math.max(unitValues.length, yearRow.values.length, typeRow.values.length);
    const columns: VicColumn[] = [];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const year = financialYearOf(yearRow.values[columnIndex]);
      const measureType = measureTypeFromCell(typeRow.values[columnIndex]);
      if (!year || !measureType) continue;
      columns.push({
        index: columnIndex,
        header: text(typeRow.values[columnIndex]) ?? measureType,
        year,
        measure_type: measureType,
      });
    }
    if (columns.length > 0 && accept(columns)) {
      return {
        unitRow: rows[index]!.number,
        yearRow: yearRow.number,
        typeRow: typeRow.number,
        columns,
      };
    }
  }
  return null;
}

/** Locate the modern COFOG block (the one with 2025-26/2026-27 budget columns). */
export function detectCofogHeader(
  rows: ReadonlyArray<{ number: number; values: Array<string | number | null> }>,
): VicHeader | null {
  return detectUnitBlock(rows, (columns) =>
    columns.some(
      (column) =>
        column.measure_type === 'budget' &&
        (VIC_BUDGET_YEARS as readonly string[]).includes(column.year),
    ),
  );
}

/** Locate the Comprehensive Operating statement header in a departmental sheet. */
export function detectOperatingStatementHeader(
  rows: ReadonlyArray<{ number: number; values: Array<string | number | null> }>,
): VicHeader | null {
  const titleIndex = rows.findIndex((row) =>
    row.values.some((value) => /comprehensive operating statement/i.test(text(value) ?? '')),
  );
  if (titleIndex === -1) return null;
  const slice = rows.slice(titleIndex, titleIndex + 8);
  return detectUnitBlock(slice, (columns) =>
    columns.some(
      (column) =>
        column.measure_type === 'budget' &&
        (VIC_BUDGET_YEARS as readonly string[]).includes(column.year),
    ),
  );
}

/** Drop trailing workbook footnote superscripts such as " (m)(n)" from a label. */
function cleanLabel(label: string): string {
  return label.replace(/\s*(?:\([a-z]\))+\s*$/i, '').trim();
}

function firstLabel(values: Array<string | number | null>): string | null {
  for (const value of values) {
    const label = text(value);
    if (label && !/^\d+(\.\d+)?$/.test(label)) {
      const cleaned = cleanLabel(label);
      return cleaned.length > 0 ? cleaned : label;
    }
  }
  return null;
}

function selectedBudgetColumns(header: VicHeader): VicColumn[] {
  return header.columns.filter(
    (column) =>
      column.measure_type === 'budget' &&
      (VIC_BUDGET_YEARS as readonly string[]).includes(column.year),
  );
}

export function parseCofogWorkbook(
  workbook: VicWorkbookRows,
  meta: VicSourceMeta,
  skipped: VicSkip[] = [],
): VicCofogRaw[] {
  const sheet = workbook.sheets.find((entry) => /expenses by cofog/i.test(entry.name));
  if (!sheet) {
    skipped.push({
      filename: meta.filename,
      sheet: '',
      row: null,
      reason: 'no "Expenses by COFOG" sheet in aggregate workbook',
    });
    return [];
  }
  const header = detectCofogHeader(sheet.rows);
  if (!header) {
    skipped.push({
      filename: meta.filename,
      sheet: sheet.name,
      row: null,
      reason: 'no COFOG header block with 2025-26/2026-27 budget columns',
    });
    return [];
  }
  const columns = selectedBudgetColumns(header);
  const output: VicCofogRaw[] = [];
  for (const row of sheet.rows) {
    if (row.number <= header.typeRow) continue;
    const label = firstLabel(row.values);
    if (!label) continue;
    const mapping = cofogMappingForLabel(label);
    if (!mapping) {
      if (/^Total expenses/i.test(label)) {
        skipped.push({
          filename: meta.filename,
          sheet: sheet.name,
          row: row.number,
          reason: `${label}: total row excluded to avoid double counting`,
        });
      } else if (/^Not allocated/i.test(label)) {
        skipped.push({
          filename: meta.filename,
          sheet: sheet.name,
          row: row.number,
          reason: `${label}: not allocated by function (no COFOG code; negative/zero rows excluded)`,
        });
      }
      continue;
    }
    for (const column of columns) {
      const value = row.values[column.index];
      const numeric = numberValue(value);
      if (numeric === null) continue;
      if (numeric < 0) {
        skipped.push({
          filename: meta.filename,
          sheet: sheet.name,
          row: row.number,
          reason: `${label} ${column.year}: negative amount skipped (model stores non-negative spending)`,
        });
        continue;
      }
      output.push({
        kind: 'cofog',
        ...meta,
        sheet: sheet.name,
        row: row.number,
        column_index: column.index,
        column_header: `${column.header} ${column.year}`.trim(),
        label,
        function_code: mapping.code,
        function_name: mapping.name,
        function_note: mapping.note,
        fiscal_year: column.year,
        measure_type: 'budget',
        raw_value: numeric,
        unit: VIC_UNIT,
      });
    }
  }
  return output;
}

export function parseDepartmentalWorkbook(
  workbook: VicWorkbookRows,
  meta: VicSourceMeta,
  department: string,
  skipped: VicSkip[] = [],
): VicDepartmentalRaw[] {
  const sheet =
    workbook.sheets.find((entry) =>
      entry.rows.some((row) =>
        row.values.some((value) => /comprehensive operating statement/i.test(text(value) ?? '')),
      ),
    ) ?? workbook.sheets[0];
  if (!sheet) {
    skipped.push({
      filename: meta.filename,
      sheet: '',
      row: null,
      reason: 'departmental workbook has no sheets',
    });
    return [];
  }
  const header = detectOperatingStatementHeader(sheet.rows);
  if (!header) {
    skipped.push({
      filename: meta.filename,
      sheet: sheet.name,
      row: null,
      reason: 'no Comprehensive Operating statement header with 2025-26/2026-27 budget columns',
    });
    return [];
  }
  const columns = selectedBudgetColumns(header);
  const startIndex = sheet.rows.findIndex(
    (row) => (firstLabel(row.values) ?? '').toLowerCase() === 'expenses from transactions',
  );
  if (startIndex === -1) {
    skipped.push({
      filename: meta.filename,
      sheet: sheet.name,
      row: null,
      reason: 'no "Expenses from transactions" section found',
    });
    return [];
  }
  let endIndex = sheet.rows.length;
  for (let index = startIndex + 1; index < sheet.rows.length; index += 1) {
    const label = firstLabel(sheet.rows[index]!.values);
    if (label && /^Total expenses from transactions/i.test(label)) {
      endIndex = index;
      break;
    }
  }
  const output: VicDepartmentalRaw[] = [];
  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const row = sheet.rows[index]!;
    const label = firstLabel(row.values);
    if (!label) continue;
    let emitted = false;
    for (const column of columns) {
      const value = row.values[column.index];
      const numeric = numberValue(value);
      if (numeric === null) continue;
      if (numeric < 0) {
        skipped.push({
          filename: meta.filename,
          sheet: sheet.name,
          row: row.number,
          reason: `${label} ${column.year}: negative amount skipped (model stores non-negative spending)`,
        });
        continue;
      }
      output.push({
        kind: 'departmental',
        ...meta,
        department,
        sheet: sheet.name,
        row: row.number,
        column_index: column.index,
        column_header: `${column.header} ${column.year}`.trim(),
        label,
        fiscal_year: column.year,
        measure_type: 'budget',
        raw_value: numeric,
        unit: VIC_UNIT,
      });
      emitted = true;
    }
    if (!emitted && !row.values.some((value) => numberValue(value) !== null)) {
      skipped.push({
        filename: meta.filename,
        sheet: sheet.name,
        row: row.number,
        reason: `${label}: section header, not an expense line item`,
      });
    }
  }
  return output;
}

export function vicNaturalKey(parts: readonly (string | number | null | undefined)[]): string {
  return `vic-budget:${sha256(parts.map((part) => String(part ?? '')).join('\u001f')).slice(0, 40)}`;
}

function cofogRecord(raw: VicCofogRaw): SpendingRecord | null {
  const amountCents = amountToCents(raw.raw_value, raw.unit);
  if (amountCents === null) return null;
  const key = vicNaturalKey([
    raw.package_id,
    raw.resource_id,
    raw.sheet,
    raw.row,
    raw.function_code,
    raw.fiscal_year,
    raw.measure_type,
  ]);
  const note = [
    `Workbook: ${raw.filename}`,
    `CKAN resource: ${raw.resource_name} (${raw.resource_id})`,
    `Sheet: ${raw.sheet}`,
    `Row: ${raw.row}, column ${raw.column_header}`,
    `Unit: ${VIC_UNIT} (($ million) stated on the workbook sheet) converted at ${VIC_UNIT_TO_CENTS} cents per $m`,
    `VIC COFOG group: ${raw.label} -> ${raw.function_code} ${raw.function_name}`,
    raw.function_note,
    'Budget column only; actual/revised/forward-estimate columns are not ingested and measure types are never summed',
    'Budgeted figure, not an audited actual; general government sector, statewide',
    `Source copy SHA-256: ${raw.source_sha256}`,
  ]
    .filter(Boolean)
    .join('; ');
  return {
    amount_cents: amountCents,
    measure_type: 'budget',
    fiscal_year: raw.fiscal_year,
    source_id: VIC_ID,
    source_url: raw.url,
    verified: false,
    natural_key: key,
    jurisdiction_level: 'state',
    jurisdiction: 'VIC',
    source_dataset: VIC_DATASET,
    source_date: raw.source_date,
    data_quality_flag: 'statewide_only',
    project_name: raw.label,
    description: `COFOG ${raw.function_code} — ${raw.function_name} (General government sector expenses)`,
    funding_source: 'Victorian general government sector',
    location: { state: 'VIC' },
    ...(raw.function_code ? { function_code: raw.function_code } : {}),
    notes: note,
  };
}

function departmentalRecord(raw: VicDepartmentalRaw): SpendingRecord | null {
  const amountCents = amountToCents(raw.raw_value, raw.unit);
  if (amountCents === null) return null;
  const key = vicNaturalKey([
    raw.package_id,
    raw.resource_id,
    raw.sheet,
    raw.row,
    raw.label,
    raw.fiscal_year,
    raw.measure_type,
  ]);
  const note = [
    `Workbook: ${raw.filename}`,
    `CKAN resource: ${raw.resource_name} (${raw.resource_id})`,
    `Sheet: ${raw.sheet}`,
    `Row: ${raw.row}, column ${raw.column_header}`,
    `Unit: ${VIC_UNIT} (($ million) stated on the operating statement) converted at ${VIC_UNIT_TO_CENTS} cents per $m`,
    'Comprehensive Operating statement — Expenses from transactions component line',
    'Budget column only; actual/revised columns and the balance sheet/cash flow/administered items statements are not ingested',
    'No COFOG function is defensibly available for this departmental line; function left blank and row flagged provisional',
    'Budgeted figure, not an audited actual; unverified',
    `Source copy SHA-256: ${raw.source_sha256}`,
  ].join('; ');
  return {
    amount_cents: amountCents,
    measure_type: 'budget',
    fiscal_year: raw.fiscal_year,
    source_id: VIC_ID,
    source_url: raw.url,
    verified: false,
    natural_key: key,
    jurisdiction_level: 'state',
    jurisdiction: 'VIC',
    source_dataset: VIC_DATASET,
    source_date: raw.source_date,
    data_quality_flag: 'provisional',
    project_name: raw.label,
    description: `Comprehensive Operating statement — ${raw.label}`,
    delivery_entity: raw.department,
    funding_source: raw.department,
    location: { state: 'VIC' },
    notes: note,
  };
}

/** Pure transform: raw cells -> SpendingRecord[], de-duplicated on natural_key. */
export function transformVicRaw(raw: readonly RawRecord[]): VicTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: VicSkip[] = [];
  const keys = new Set<string>();
  let duplicates = 0;
  for (const entry of raw) {
    if (entry.kind !== 'cofog' && entry.kind !== 'departmental') {
      skipped.push({
        filename: 'unknown',
        sheet: '',
        row: null,
        reason: `unknown raw kind ${String(entry.kind)}`,
      });
      continue;
    }
    const record =
      entry.kind === 'cofog'
        ? cofogRecord(entry as VicCofogRaw)
        : departmentalRecord(entry as VicDepartmentalRaw);
    if (!record) {
      skipped.push({
        filename: String(entry.filename ?? 'unknown'),
        sheet: String(entry.sheet ?? ''),
        row: typeof entry.row === 'number' ? entry.row : null,
        reason: `${String(entry.label ?? '')}: unusable ${String(entry.unit ?? '')} amount`,
      });
      continue;
    }
    if (keys.has(record.natural_key!)) {
      duplicates += 1;
      continue;
    }
    keys.add(record.natural_key!);
    records.push(record);
  }
  return { records, skipped, duplicates };
}

/** Streaming ExcelJS does not expose real sheet names; read them from workbook.xml. */
async function workbookSheetNames(filePath: string): Promise<string[]> {
  try {
    const zip = await JSZip.loadAsync(await readFile(filePath));
    const xml = await zip.file('xl/workbook.xml')?.async('string');
    if (!xml) return [];
    return [...xml.matchAll(/<sheet[^>]*name="([^"]*)"/g)].map((match) => match[1] ?? '');
  } catch {
    return [];
  }
}

/** Stream a workbook with ExcelJS; no full workbook is loaded into memory. */
export async function readVicWorkbookStreaming(filePath: string): Promise<VicWorkbookRows> {
  const sheetNames = await workbookSheetNames(filePath);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    entries: 'emit',
  });
  const sheets: VicWorkbookRows['sheets'] = [];
  let sheetIndex = 0;
  for await (const worksheet of reader) {
    const runtimeName = (worksheet as unknown as { name?: string }).name;
    const name = sheetNames[sheetIndex] ?? runtimeName ?? `Sheet${sheetIndex + 1}`;
    sheetIndex += 1;
    const rows: VicWorkbookRows['sheets'][number]['rows'] = [];
    for await (const row of worksheet) {
      const values: Array<string | number | null> = [];
      const last = Math.max(row.cellCount, 1) + 2;
      for (let column = 1; column <= last; column += 1) {
        values[column - 1] = worksheetCellValue(row.getCell(column).value);
      }
      const max = rowMaxColumn(values);
      rows.push({ number: row.number, values: values.slice(0, max) });
    }
    sheets.push({ name, rows });
  }
  return { sheets };
}

function resourceFilename(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
  } catch {
    return url.split('/').pop() ?? 'resource.xlsx';
  }
}

interface CkanPackage {
  id: string;
  name: string;
  title: string;
  license_title?: string;
  metadata_modified?: string;
  resources: Array<{
    id: string;
    name: string;
    format: string;
    url: string;
    package_id?: string;
  }>;
}

interface CkanResponse<T> {
  success: boolean;
  result?: T;
  error?: unknown;
}

async function ckanAction<T>(
  action: string,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const response = await fetchImpl(`${VIC_CKAN_API_BASE}/${action}?${query}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`DataVic CKAN ${action} HTTP ${response.status}`);
  const body = (await response.json()) as CkanResponse<T>;
  if (!body.success || body.result === undefined) {
    throw new Error(`DataVic CKAN ${action} failed: ${JSON.stringify(body.error ?? null)}`);
  }
  return body.result;
}

async function findPackage(
  query: string,
  predicate: (pkg: CkanPackage) => boolean,
  knownName: string,
  fetchImpl: typeof fetch,
): Promise<CkanPackage> {
  try {
    const search = await ckanAction<{ results: CkanPackage[] }>(
      'package_search',
      { q: query, rows: '10' },
      fetchImpl,
    );
    const found = search.results.find(predicate);
    if (found) return found;
  } catch {
    // Fall through to package_show for a deterministic known dataset.
  }
  const fallback = await ckanAction<CkanPackage>('package_show', { id: knownName }, fetchImpl);
  if (!predicate(fallback)) {
    throw new Error(`DataVic package ${knownName} did not match ${query}`);
  }
  return fallback;
}

function toResource(pkg: CkanPackage, resource: CkanPackage['resources'][number]): VicResource {
  return {
    package_id: pkg.id,
    package_name: pkg.name,
    dataset_title: pkg.title,
    metadata_modified: (pkg.metadata_modified ?? '').slice(0, 10),
    resource_id: resource.id,
    name: resource.name,
    format: resource.format,
    url: resource.url,
    filename: resourceFilename(resource.url),
  };
}

/** Discover the two 2026-27 workbooks via package_search + package_show. */
export async function discoverVicSources(
  fetchImpl: typeof fetch = fetch,
): Promise<VicSourceSelection> {
  const aggregatePackage = await findPackage(
    'State Budget 2026-27 Aggregate financial statements',
    (pkg) =>
      /2026-27/.test(`${pkg.name} ${pkg.title}`) &&
      /aggregate financial statements/i.test(pkg.title),
    KNOWN_PACKAGES.aggregate,
    fetchImpl,
  );
  const departmentalPackage = await findPackage(
    'State Budget 2026-27 Departmental statements',
    (pkg) =>
      /2026-27/.test(`${pkg.name} ${pkg.title}`) && /departmental statements/i.test(pkg.title),
    KNOWN_PACKAGES.departmental,
    fetchImpl,
  );

  const cofogResource =
    aggregatePackage.resources.find(
      (resource) =>
        /expenses by classification of the functions of government/i.test(resource.name) ||
        /expenses-by-cofog/i.test(resourceFilename(resource.url)),
    ) ?? null;
  if (!cofogResource) {
    throw new Error('DataVic aggregate package has no COFOG expenses XLSX resource');
  }
  const departmentalResource =
    departmentalPackage.resources.find(
      (resource) =>
        (/department of treasury and finance/i.test(resource.name) &&
          /financial statement/i.test(resource.name)) ||
        /department-of-treasury-and-finance-.*bp5-online-data\.xlsx$/i.test(resource.url),
    ) ?? null;
  if (!departmentalResource) {
    throw new Error('DataVic departmental package has no Department of Treasury and Finance XLSX');
  }

  return {
    aggregate: toResource(aggregatePackage, cofogResource),
    departmental: toResource(departmentalPackage, departmentalResource),
  };
}

export interface VicLoadedWorkbooks {
  raw: VicRaw[];
  archive: ArchivedSourceRecord[];
  skipped: VicSkip[];
  warnings: string[];
  selection: VicSourceSelection;
}

/**
 * Discover, archive, hash and stream-parse both VIC workbooks. Archive bytes are
 * written outside the repo by `archiveSourceDocument`; the repo only ever holds
 * metadata (a manifest and source_documents rows).
 */
export async function loadVicWorkbooks(
  options: {
    fetchImpl?: typeof fetch;
    archiveRoot?: string;
    cacheDir?: string;
    readWorkbook?: (filePath: string) => Promise<VicWorkbookRows>;
  } = {},
): Promise<VicLoadedWorkbooks> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const readWorkbook = options.readWorkbook ?? readVicWorkbookStreaming;
  const selection = await discoverVicSources(fetchImpl);
  const skipped: VicSkip[] = [];
  const warnings: string[] = [];
  const archive: ArchivedSourceRecord[] = [];

  async function load(
    resource: VicResource,
    title: string,
  ): Promise<{ record: ArchivedSourceRecord; workbook: VicWorkbookRows }> {
    const record = await archiveSourceDocument({
      source_id: VIC_ID,
      title,
      original_url: resource.url,
      retrieved_from: resource.url,
      archived_from: 'direct',
      filename: resource.filename,
      content_type: inferContentType(resource.filename),
      fetchImpl,
      ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
      notes: `DataVic CKAN package ${resource.package_name} resource ${resource.resource_id}`,
    });
    archive.push(record);
    const workbook = await readWorkbook(record.local_path);
    return { record, workbook };
  }

  const cofog = await load(selection.aggregate, `VIC Budget 2026-27 — ${selection.aggregate.name}`);
  const cofogRecord = cofog.record;
  const cofogWorkbook = cofog.workbook;

  const departmental = await load(
    selection.departmental,
    `VIC Budget 2026-27 — ${selection.departmental.name}`,
  );
  const departmentalRecord = departmental.record;
  const departmentalWorkbook = departmental.workbook;

  const cofogMeta: VicSourceMeta = {
    package_id: selection.aggregate.package_id,
    package_name: selection.aggregate.package_name,
    resource_id: selection.aggregate.resource_id,
    resource_name: selection.aggregate.name,
    filename: selection.aggregate.filename,
    url: selection.aggregate.url,
    source_sha256: cofogRecord.sha256,
    source_date: selection.aggregate.metadata_modified,
  };
  const departmentalMeta: VicSourceMeta = {
    package_id: selection.departmental.package_id,
    package_name: selection.departmental.package_name,
    resource_id: selection.departmental.resource_id,
    resource_name: selection.departmental.name,
    filename: selection.departmental.filename,
    url: selection.departmental.url,
    source_sha256: departmentalRecord.sha256,
    source_date: selection.departmental.metadata_modified,
  };

  const raw: VicRaw[] = [
    ...parseCofogWorkbook(cofogWorkbook, cofogMeta, skipped),
    ...parseDepartmentalWorkbook(departmentalWorkbook, departmentalMeta, VIC_DEPARTMENT, skipped),
  ];

  const cofogRows = raw.filter((entry) => entry.kind === 'cofog').length;
  const departmentalRows = raw.filter((entry) => entry.kind === 'departmental').length;
  if (cofogRows === 0) throw new Error('VIC COFOG workbook produced no budget expense rows');
  if (departmentalRows === 0) {
    throw new Error('VIC departmental workbook produced no budget expense rows');
  }
  warnings.push(
    `COFOG rows=${cofogRows}, departmental rows=${departmentalRows}; ` +
      'only 2025-26 and 2026-27 budget columns ingested',
  );
  if (skipped.length > 0) {
    warnings.push(
      `${skipped.length} source row(s) skipped (${skipped
        .slice(0, 5)
        .map((entry) => `${entry.sheet}:${entry.row ?? '?'} ${entry.reason}`)
        .join('; ')}${skipped.length > 5 ? '; …' : ''})`,
    );
  }
  return { raw, archive, skipped, warnings, selection };
}

export interface VicArchiveManifest {
  dataset: string;
  fiscal_year: string;
  source_url: string;
  license: string;
  attribution: string;
  retrieved_at: string;
  unit: string;
  files: Array<{
    title: string;
    package_name: string;
    resource_id: string;
    filename: string;
    url: string;
    sha256: string;
    bytes: number;
    archived_from: string;
  }>;
  notes: string;
}

/** Discover + download + hash + parse for the reproducible archive script. */
export async function buildVicArchive(
  options: { fetchImpl?: typeof fetch; archiveRoot?: string; cacheDir?: string } = {},
): Promise<{ manifest: VicArchiveManifest; raw: VicRaw[]; warnings: string[] }> {
  const loaded = await loadVicWorkbooks(options);
  const files = loaded.archive.map((record) => ({
    title: record.title,
    package_name:
      record.source_id === VIC_ID ? (record.notes?.match(/package (\S+) resource/)?.[1] ?? '') : '',
    resource_id: record.notes?.match(/resource (\S+)$/)?.[1] ?? '',
    filename: path.basename(record.local_path),
    url: record.original_url,
    sha256: record.sha256,
    bytes: record.bytes,
    archived_from: record.archived_from,
  }));
  return {
    manifest: {
      dataset: VIC_DATASET,
      fiscal_year: VIC_FISCAL_YEAR,
      source_url: VIC_SOURCE_URL,
      license: VIC_LICENSE,
      attribution: VIC_ATTRIBUTION,
      retrieved_at: new Date().toISOString(),
      unit: '$ million (x100,000,000 cents)',
      files,
      notes:
        'Only 2025-26 and 2026-27 budget columns are ingested. Transport is a VIC COFOG major group tagged 045; do not roll 045 into 04. Departmental rows are provisional and carry no COFOG function.',
    },
    raw: loaded.raw,
    warnings: loaded.warnings,
  };
}

/** Build the connector. `fetch` discovers, archives, hashes and stream-parses both workbooks. */
export function createVicBudgetConnector(options: VicConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: VIC_ID,
    name: VIC_NAME,
    publisher: VIC_PUBLISHER,
    source_url: VIC_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'state',
    license: VIC_LICENSE,
    notes: `${VIC_ATTRIBUTION} 2026-27 COFOG and one departmental statement XLSX from DataVic CKAN. Units are ($ million) stated by the workbooks. Budgeted figures only (2025-26 and 2026-27 budget columns); not audited actuals; unverified. Transport is tagged 045 and must not be rolled into Economic affairs 04.`,
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const loaded = await loadVicWorkbooks(options);
      metadata.warnings = loaded.warnings;
      return loaded.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformVicRaw(raw);
      metadata.errors = [];
      const warnings = [...(metadata.warnings ?? [])];
      if (result.skipped.length > 0) {
        warnings.push(`${result.skipped.length} transformed row(s) skipped`);
      }
      metadata.warnings = warnings;
      return result.records;
    },
    metadata,
  };
}
