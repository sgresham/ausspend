import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parse as parseHtml } from 'node-html-parser';
import type { SpendingRecord } from '@ausspend/shared';
import type { Connector, RawRecord } from './types.js';

/**
 * NSW Budget 2025-26 Open Data connector (S1).
 *
 * The live open-data page now redirects to 2026-27, and the live 2025-26 XLSX
 * links return 404. S1 therefore reads the official Wayback Machine snapshot of
 * the 2025-26 page (14 November 2025) and each workbook's nearest official
 * capture. The 12 official XLSX workbooks are discovered from the page DOM (not
 * hard-coded URLs) and downloaded to a local cache; the cache is never
 * committed. `docs/source-archive/nsw-budget-2025-26.json` records the filename,
 * SHA-256 and source URL of every copy.
 *
 * Units are explicit and never guessed:
 *   - financial statements: `$m`  -> x1,000,000 dollars -> x100,000,000 cents
 *   - historical fiscal indicators: `$b` -> x1,000,000,000 dollars -> x100,000,000,000 cents
 *   - ArcGIS capital projects: `$'000` -> x1,000 dollars -> x100,000 cents
 *
 * Budgeted figures are stored with measure_type `budget`; they are never
 * presented as actual/spent. Measure types are never added together.
 */

export const NSW_ID = 'nsw-budget';
export const NSW_NAME = 'NSW Budget 2025-26 Open Data';
export const NSW_PUBLISHER = 'NSW Treasury';
export const NSW_DATASET = 'NSW Budget 2025-26 Open Data';
export const NSW_FISCAL_YEAR = '2025-26';
export const NSW_SOURCE_DATE = '2025-11-14';
export const NSW_OPEN_DATA_URL = 'https://www.budget.nsw.gov.au/budget-detail/open-data';
export const NSW_WAYBACK_SNAPSHOT = '20251114084846';
export const NSW_WAYBACK_PAGE = `https://web.archive.org/web/${NSW_WAYBACK_SNAPSHOT}id_/${NSW_OPEN_DATA_URL}`;
export const NSW_ATTRIBUTION = '© State of New South Wales (NSW Treasury), (2025).';
export const NSW_LICENSE = 'CC BY 3.0 AU';

export const ARCGIS_LAYER_NAME = 'Treasury_Project_Data_20260609_gdb';
export const ARCGIS_LAYER_URL =
  'https://services2.arcgis.com/Yb2UeNWvQYEwyYDl/arcgis/rest/services/Treasury_Project_Data_20260609_gdb/FeatureServer/0';
export const ARCGIS_QUERY_URL = `${ARCGIS_LAYER_URL}/query`;
export const ARCGIS_SOURCE_DATE = '2026-06-22';
export const ARCGIS_EXPECTED_PROJECTS = 974;

/** Explicit unit -> integer-cents multiplier. A value in these units x multiplier is cents. */
export const UNIT_TO_CENTS: Readonly<Record<string, number>> = {
  $: 100,
  $m: 100_000_000,
  $b: 100_000_000_000,
  "$'000": 100_000,
};

export type NswFileCategory = 'financial' | 'hfi' | 'economy' | 'wellbeing';

export interface NswSourceFile {
  filename: string;
  title: string;
  category: NswFileCategory;
  /** Official live URL from the snapshot page. */
  url: string;
  /** Wayback capture timestamp, when resolved. */
  snapshot_timestamp: string | null;
  /** Wayback raw (`id_`) URL used for the local copy. */
  snapshot_url: string;
  sha256?: string;
  bytes?: number;
}

export interface NswCellRaw extends Record<string, unknown> {
  kind: 'financial' | 'hfi';
  filename: string;
  sheet: string;
  row: number;
  headers: string[];
  fiscal_year: string;
  measure_type: 'actual' | 'budget' | 'estimate';
  label: string;
  column_header: string;
  raw_value: number;
  unit: string;
  sector: string;
  source_date: string;
  source_sha256: string;
}

export interface NswCapitalRaw extends Record<string, unknown> {
  kind: 'capital';
  feature: Record<string, unknown>;
  source_date: string;
  source_sha256: string;
}

export type NswRaw = NswCellRaw | NswCapitalRaw;

export interface NswSkip {
  filename: string;
  sheet: string;
  row: number | null;
  reason: string;
}

export interface NswTransformResult {
  records: SpendingRecord[];
  skipped: NswSkip[];
  duplicates: number;
}

export interface NswConnectorOptions {
  pageHtml?: string;
  pageUrl?: string;
  snapshotTimestamp?: string;
  cacheDir?: string;
  arcgisQueryUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Injected for tests; defaults to the streaming ExcelJS reader. */
  readWorkbook?: (filePath: string) => Promise<NswWorkbookRows>;
}

export interface NswWorkbookRows {
  sheets: Array<{
    name: string;
    rows: Array<{ number: number; values: Array<string | number | null> }>;
  }>;
}

export interface NswWorkbookHeader {
  headerRow: number;
  yearRow: number;
  unitRow: number;
  columns: Array<{
    index: number;
    header: string;
    year: string | null;
    unit: string;
  }>;
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

/**
 * Published placeholders that mean "no value". They are not dimensions and
 * must never be copied into a structured field as if they were a real agency,
 * region or LGA.
 */
const NOT_AVAILABLE_DIMENSION =
  /^(?:n\.?a\.?|unknown|not applicable|not stated|null|none|various|-+)$/i;

/**
 * `Various` and `Regionnotfound` are published ArcGIS region values but do not
 * name one deterministic region, so they stay absent rather than being guessed.
 */
const AMBIGUOUS_REGION = new Set(['various', 'regionnotfound']);

/** A deterministic published dimension; blank/placeholder values become null. */
export function nswProjectDimension(value: unknown): string | null {
  const cleaned = text(value);
  if (!cleaned || NOT_AVAILABLE_DIMENSION.test(cleaned)) return null;
  return cleaned;
}

export function nswProjectRegion(value: unknown): string | null {
  const cleaned = nswProjectDimension(value);
  if (!cleaned || AMBIGUOUS_REGION.has(cleaned.toLowerCase())) return null;
  return cleaned;
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

function safeFilename(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]/g, '_');
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

/** Convert a raw amount with an explicit unit to integer cents; null if unusable. */
export function amountToCents(value: unknown, unit: string): number | null {
  const multiplier = UNIT_TO_CENTS[unit];
  if (multiplier === undefined) return null;
  const numeric = numberValue(value);
  if (numeric === null) return null;
  const cents = Math.round(numeric * multiplier);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return cents;
}

/** The model stores non-negative spending; negative net/deficit lines are skipped, not abs()ed. */
export function isNegativeAmount(value: unknown): boolean {
  const numeric = numberValue(value);
  return numeric !== null && numeric < 0;
}

/** Map an official page anchor to a workbook category by link text/filename, not a hard-coded URL. */
export function classifyNswFile(filename: string, title: string): NswFileCategory | null {
  const haystack = `${filename} ${title}`.toLowerCase();
  if (/financial[- ]statements/.test(haystack)) return 'financial';
  if (/historical[- ]fiscal[- ]indicators/.test(haystack)) return 'hfi';
  if (/economy/.test(haystack) && /open[- ]data/.test(haystack)) return 'economy';
  if (/performance[- ]and[- ]wellbeing/.test(haystack)) return 'wellbeing';
  if (/budget.*economy/.test(haystack)) return 'economy';
  return null;
}

/** Parse the snapshot page DOM and return only the 12 official 2025-26 .xlsx links. */
export function discoverNswFiles(pageHtml: string, pageUrl = NSW_OPEN_DATA_URL): NswSourceFile[] {
  const root = parseHtml(pageHtml);
  const origin = new URL(pageUrl).origin;
  const found = new Map<string, NswSourceFile>();

  for (const anchor of root.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href');
    if (!href) continue;
    const clean = href.split('#')[0] ?? href;
    if (!/\.xlsx(\?|$)/i.test(clean)) continue;
    let absolute: string;
    try {
      absolute = new URL(clean, origin).toString();
    } catch {
      continue;
    }
    const filename = decodeURIComponent(new URL(absolute).pathname.split('/').pop() ?? '');
    if (!filename) continue;
    const title = text(anchor.text) ?? filename;
    const category = classifyNswFile(filename, title);
    if (!category) continue;
    found.set(filename, {
      filename,
      title,
      category,
      url: absolute,
      snapshot_timestamp: null,
      snapshot_url: `https://web.archive.org/web/${NSW_WAYBACK_SNAPSHOT}id_/${absolute}`,
    });
  }

  return [...found.values()].sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Normalise a fiscal-year cell. Accepts `2025-26`, `2025-2026`, `2025 -26`,
 * ` June 2024` (balance-sheet date), ISO dates and Excel serial dates.
 */
export function financialYearOf(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 20_000 && value < 80_000) {
    // Excel serial date. 1899-12-30 epoch; use UTC to avoid locale drift.
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

  const monthYear = /(?:^|\s)([A-Za-z]{3,9})\s+(\d{4})/.exec(raw);
  if (monthYear) {
    const monthNames = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];
    const month = monthNames.indexOf(monthYear[1]!.toLowerCase());
    const year = Number(monthYear[2]);
    if (month >= 0) {
      // A date in January-June belongs to the financial year that started the
      // previous calendar year; July-December belongs to the current one.
      const start = month <= 5 ? year - 1 : year;
      return `${start}-${String(start + 1).slice(-2)}`;
    }
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const start = month <= 6 ? year - 1 : year;
    return `${start}-${String(start + 1).slice(-2)}`;
  }
  return null;
}

/** Actual/Revised/Budget/Forward Estimates -> actual/estimate/budget (documented). */
export function measureTypeForFinancialHeader(
  header: string,
): 'actual' | 'budget' | 'estimate' | null {
  const normalised = header.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalised === 'actual') return 'actual';
  if (normalised === 'revised') return 'estimate';
  if (normalised === 'budget') return 'budget';
  if (normalised === 'forward estimates') return 'estimate';
  return null;
}

/** Historical indicator: before 2025-26 actual, the budget year budget, forward years estimate. */
export function measureTypeForIndicatorYear(fiscalYear: string): 'actual' | 'budget' | 'estimate' {
  if (fiscalYear === NSW_FISCAL_YEAR) return 'budget';
  const start = Number(fiscalYear.slice(0, 4));
  return start < 2025 ? 'actual' : 'estimate';
}

function sectorForSheet(sheet: string): string {
  if (/^PNFC/i.test(sheet)) return 'Public non-financial corporations';
  if (/^NFPS/i.test(sheet)) return 'Non-financial public sector';
  if (/^GG/i.test(sheet)) return 'General government sector';
  return 'NSW public sector';
}

/** Locate the financial-statement header/year/unit rows in a sheet's row matrix. */
export function detectFinancialHeader(
  rows: ReadonlyArray<{ number: number; values: Array<string | number | null> }>,
): NswWorkbookHeader | null {
  for (let index = 0; index < rows.length; index += 1) {
    const values = rows[index]!.values;
    const labels = values.map((value) => text(value)?.toLowerCase() ?? '');
    if (
      !labels.includes('actual') ||
      !labels.includes('budget') ||
      !labels.includes('forward estimates')
    ) {
      continue;
    }
    const yearRow = rows[index - 1]?.values ?? [];
    const unitRow = rows[index + 1]?.values ?? [];
    const columns: NswWorkbookHeader['columns'] = [];
    let currentHeader: string | null = null;
    // The header row is often shorter than the year/unit rows: Excel omits
    // trailing blank cells. Iterate to the longest of the three rows so
    // Forward Estimates is forward-filled across every year column.
    const columnCount = Math.max(values.length, yearRow.length, unitRow.length);
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const header = text(values[columnIndex]);
      if (header && measureTypeForFinancialHeader(header)) currentHeader = header;
      if (!currentHeader) continue;
      const unit = text(unitRow[columnIndex]) ?? '';
      const year = financialYearOf(yearRow[columnIndex]);
      if (!year || !unit.includes('$')) continue;
      columns.push({ index: columnIndex, header: currentHeader, year, unit });
    }
    if (columns.length === 0) continue;
    return {
      headerRow: rows[index]!.number,
      yearRow: rows[index - 1]?.number ?? 0,
      unitRow: rows[index + 1]?.number ?? 0,
      columns,
    };
  }
  return null;
}

/** Locate the HFI header/unit rows and the year column. */
export function detectHfiHeader(
  rows: ReadonlyArray<{ number: number; values: Array<string | number | null> }>,
): NswWorkbookHeader | null {
  for (let index = 0; index < rows.length; index += 1) {
    const values = rows[index]!.values;
    const unitRow = rows[index + 1]?.values ?? [];
    const columns: NswWorkbookHeader['columns'] = [];
    values.forEach((value, columnIndex) => {
      const label = text(value);
      const unit = text(unitRow[columnIndex]) ?? '';
      if (!label || !unit.includes('$')) return;
      columns.push({ index: columnIndex, header: label, year: null, unit });
    });
    if (columns.length > 0) {
      return {
        headerRow: rows[index]!.number,
        yearRow: 0,
        unitRow: rows[index + 1]?.number ?? 0,
        columns,
      };
    }
  }
  return null;
}

function rowLabel(values: Array<string | number | null>): string | null {
  for (const value of values) {
    const label = text(value);
    if (label && !/^\d+(\.\d+)?$/.test(label)) return label;
  }
  return null;
}

/** HFI indicators that are spending (expenses/capital) and therefore ingestible. */
const HFI_SPENDING_METRICS = new Set(['expenses', 'capital expenditure', 'interest expense']);

function isHfiSpendingMetric(label: string): boolean {
  return HFI_SPENDING_METRICS.has(label.toLowerCase().replace(/\s+/g, ' ').trim());
}

/**
 * Financial statements: ingest ONLY the expenses section of each sector's
 * Operating Statement. Revenue/taxation lines, balance-sheet lines, cash-flow
 * receipts/payments and the budget result/net operating balance are excluded.
 * The "Total Expenses" row is also excluded so the component lines are not
 * double-counted at the total.
 */
export function financialRawRows(
  file: NswSourceFile,
  workbook: NswWorkbookRows,
  skipped: NswSkip[],
): NswCellRaw[] {
  const output: NswCellRaw[] = [];
  for (const sheet of workbook.sheets) {
    if (/^Introduction/i.test(sheet.name)) continue;
    if (!/Operating Statement$/i.test(sheet.name)) {
      skipped.push({
        filename: file.filename,
        sheet: sheet.name,
        row: null,
        reason: 'non-spending statement sheet excluded (balance sheet/cash flow/introduction)',
      });
      continue;
    }
    const header = detectFinancialHeader(sheet.rows);
    if (!header) continue;
    const sector = sectorForSheet(sheet.name);

    const startIndex = sheet.rows.findIndex(
      (row) => rowLabel(row.values)?.toLowerCase() === 'expenses from transactions',
    );
    if (startIndex === -1) {
      skipped.push({
        filename: file.filename,
        sheet: sheet.name,
        row: null,
        reason: 'no "Expenses from Transactions" section found; no expense lines ingested',
      });
      continue;
    }
    let endIndex = sheet.rows.length;
    for (let index = startIndex + 1; index < sheet.rows.length; index += 1) {
      const label = rowLabel(sheet.rows[index]!.values);
      if (!label) continue;
      if (
        /^total expenses from transactions/i.test(label) ||
        /net operating balance|budget result/i.test(label)
      ) {
        endIndex = index;
        break;
      }
    }

    for (let index = 0; index < sheet.rows.length; index += 1) {
      const row = sheet.rows[index]!;
      if (row.number <= header.unitRow) continue;
      const label = rowLabel(row.values);
      if (!label) continue;
      if (index <= startIndex || index >= endIndex) {
        skipped.push({
          filename: file.filename,
          sheet: sheet.name,
          row: row.number,
          reason: `${label}: non-spending line excluded (revenue/balance-sheet/cash-flow/budget-result/total)`,
        });
        continue;
      }
      for (const column of header.columns) {
        const value = row.values[column.index];
        if (numberValue(value) === null) continue;
        if (!column.year) {
          skipped.push({
            filename: file.filename,
            sheet: sheet.name,
            row: row.number,
            reason: `no fiscal year for ${column.header}`,
          });
          continue;
        }
        if (isNegativeAmount(value)) {
          skipped.push({
            filename: file.filename,
            sheet: sheet.name,
            row: row.number,
            reason: `${label}: negative amount skipped (model stores non-negative spending)`,
          });
          continue;
        }
        const measureType = measureTypeForFinancialHeader(column.header)!;
        output.push({
          kind: 'financial',
          filename: file.filename,
          sheet: sheet.name,
          row: row.number,
          headers: header.columns.map((entry) => `${entry.header}|${entry.unit}`),
          fiscal_year: column.year,
          measure_type: measureType,
          label,
          column_header: column.header,
          raw_value: numberValue(value)!,
          unit: column.unit,
          sector,
          source_date: NSW_SOURCE_DATE,
          source_sha256: file.sha256 ?? '',
        });
      }
    }
  }
  return output;
}

export function hfiRawRows(
  file: NswSourceFile,
  workbook: NswWorkbookRows,
  skipped: NswSkip[],
): NswCellRaw[] {
  const output: NswCellRaw[] = [];
  for (const sheet of workbook.sheets) {
    if (!/^Table D\./i.test(sheet.name)) continue;
    const header = detectHfiHeader(sheet.rows);
    if (!header) continue;
    const excludedIndicators = new Set<string>();
    for (const row of sheet.rows) {
      if (row.number <= header.unitRow) continue;
      const fiscalYear = financialYearOf(row.values[0]);
      if (!fiscalYear) continue;
      for (const column of header.columns) {
        if (!isHfiSpendingMetric(column.header)) {
          if (!excludedIndicators.has(column.header)) {
            excludedIndicators.add(column.header);
            skipped.push({
              filename: file.filename,
              sheet: sheet.name,
              row: null,
              reason: `${column.header}: non-spending HFI indicator excluded`,
            });
          }
          continue;
        }
        const value = row.values[column.index];
        if (numberValue(value) === null) continue;
        if (isNegativeAmount(value)) {
          skipped.push({
            filename: file.filename,
            sheet: sheet.name,
            row: row.number,
            reason: `${column.header}: negative amount skipped (model stores non-negative spending)`,
          });
          continue;
        }
        output.push({
          kind: 'hfi',
          filename: file.filename,
          sheet: sheet.name,
          row: row.number,
          headers: header.columns.map((entry) => `${entry.header}|${entry.unit}`),
          fiscal_year: fiscalYear,
          measure_type: measureTypeForIndicatorYear(fiscalYear),
          label: `${column.header} (${column.unit})`,
          column_header: column.header,
          raw_value: numberValue(value)!,
          unit: column.unit,
          sector: 'General government sector',
          source_date: NSW_SOURCE_DATE,
          source_sha256: file.sha256 ?? '',
        });
      }
    }
  }
  return output;
}

/** Verify the economy and wellbeing workbooks are valid XLSX and record no fabricated dollars. */
function countWorkbookRows(workbook: NswWorkbookRows): number {
  return workbook.sheets.reduce((total, sheet) => total + sheet.rows.length, 0);
}

export function nswNaturalKey(parts: readonly (string | number | null | undefined)[]): string {
  return `nsw-budget:${sha256(parts.map((part) => String(part ?? '')).join('\u001f')).slice(0, 40)}`;
}

const COFOG_BY_AGENCY: ReadonlyArray<{ pattern: RegExp; code: string }> = [
  { pattern: /transport|metro|roads|rail/i, code: '04' },
  { pattern: /health|hospital|ambulance/i, code: '07' },
  { pattern: /education|school|tafe|university/i, code: '09' },
  { pattern: /police|corrective|fire|emergency|justice|court/i, code: '03' },
  { pattern: /water|housing|planning|infrastructure nsw|property/i, code: '06' },
  { pattern: /environment|energy|climate|parks|wildlife/i, code: '05' },
  { pattern: /sport|arts|screen|culture|library/i, code: '08' },
  { pattern: /social|community|family|disability|ageing|veterans/i, code: '10' },
  { pattern: /treasury|finance|revenue|premier|cabinet|parliament/i, code: '01' },
  { pattern: /defence/i, code: '02' },
];

export function nswCofogForAgency(agency: string | null): string | null {
  if (!agency) return null;
  for (const entry of COFOG_BY_AGENCY) {
    if (entry.pattern.test(agency)) return entry.code;
  }
  return null;
}

function capitalNote(feature: Record<string, unknown>, sourceSha256: string): string {
  const parts = [
    `ArcGIS feature layer ${ARCGIS_LAYER_NAME}`,
    `Project_ID ${text(feature.Project_ID) ?? '(none)'}`,
    `OBJECTID ${text(feature.OBJECTID) ?? '(none)'}`,
    `agency ${text(feature.Agency_Name) ?? '(none)'}`,
    `sector ${text(feature.Sector) ?? '(none)'}`,
    `cluster ${text(feature.Cluster_PNFC_Sector) ?? '(none)'}`,
    `electorate ${text(feature.Electorate) ?? '(none)'}`,
    `region ${text(feature.Region) ?? '(none)'}`,
    `LGA ${text(feature.LGA) ?? '(none)'}`,
    `status ${text(feature.Project_Status) ?? '(none)'}`,
    `category ${text(feature.Project_Category) ?? '(none)'}`,
    `Budget_Year_FY_2025_26_000 ${text(feature.Budget_Year_FY_2025_26_000) ?? '(none)'} ($'000; x1000 to dollars, x100000 to cents)`,
    `source ${ARCGIS_LAYER_URL}`,
    `source copy SHA-256 ${sourceSha256 || '(see docs/source-archive/nsw-budget-2025-26.json)'}`,
  ];
  return parts.join('; ');
}

/** Map one ArcGIS capital feature to a Budgeted NSW measure. */
export function mapCapitalFeature(
  feature: Record<string, unknown>,
  occurrence = 0,
  sourceSha256 = '',
): SpendingRecord | null {
  const rawAmount = feature.Budget_Year_FY_2025_26_000;
  const amountCents = amountToCents(rawAmount, "$'000");
  if (amountCents === null) return null;
  const projectName = text(feature.Project_name);
  if (!projectName) return null;
  const projectId = text(feature.Project_ID);
  const agency = nswProjectDimension(feature.Agency_Name);
  const sector = nswProjectDimension(feature.Sector);
  const cluster = nswProjectDimension(feature.Cluster_PNFC_Sector);
  const electorate = nswProjectDimension(feature.Electorate);
  const region = nswProjectRegion(feature.Region);
  const lga = nswProjectDimension(feature.LGA);
  const usableLga = lga;
  const status = nswProjectDimension(feature.Project_Status);
  const category = nswProjectDimension(feature.Project_Category);
  const functionCode = nswCofogForAgency(agency);
  const dataQualityFlag = usableLga ? 'provisional' : 'statewide_only';
  void occurrence;
  const key = nswNaturalKey([
    ARCGIS_LAYER_NAME,
    text(feature.Project_ID) ?? '',
    text(feature.OBJECTID) ?? '',
    NSW_FISCAL_YEAR,
  ]);
  return {
    amount_cents: amountCents,
    measure_type: 'budget',
    fiscal_year: NSW_FISCAL_YEAR,
    source_id: NSW_ID,
    source_url: ARCGIS_LAYER_URL,
    verified: false,
    natural_key: key,
    jurisdiction_level: 'state',
    jurisdiction: 'NSW',
    source_dataset: NSW_DATASET,
    source_date: ARCGIS_SOURCE_DATE,
    data_quality_flag: dataQualityFlag,
    project_name: projectName,
    description: [category, status].filter(Boolean).join(' — ') || undefined,
    delivery_entity: agency ?? undefined,
    funding_source: cluster ?? sector ?? 'NSW Treasury',
    location: { state: 'NSW', ...(usableLga ? { lga_name: usableLga } : {}) },
    // Deterministic ArcGIS metadata promoted to explicit dimensions. Missing
    // published values stay absent; nothing here changes amount_cents.
    ...(projectId ? { project_id: projectId } : {}),
    ...(agency ? { agency } : {}),
    ...(sector ? { sector } : {}),
    ...(cluster ? { cluster } : {}),
    ...(electorate ? { electorate } : {}),
    ...(region ? { region } : {}),
    ...(usableLga ? { lga: usableLga } : {}),
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    budget_year: NSW_FISCAL_YEAR,
    notes: capitalNote(feature, sourceSha256),
    ...(functionCode ? { function_code: functionCode } : {}),
  };
}

function cellRecord(raw: NswCellRaw): SpendingRecord | null {
  const amountCents = amountToCents(raw.raw_value, raw.unit);
  if (amountCents === null) return null;
  const key = nswNaturalKey([
    raw.filename,
    raw.sheet,
    raw.row,
    raw.headers.join('|'),
    raw.fiscal_year,
    raw.label,
  ]);
  const note = [
    `Workbook: ${raw.filename}`,
    `Sheet: ${raw.sheet}`,
    `Row: ${raw.row}`,
    `Column: ${raw.column_header} (${raw.unit}); headers: ${raw.headers.join(', ')}`,
    `Unit ${raw.unit} converted to integer cents at ${UNIT_TO_CENTS[raw.unit]} cents per unit`,
    raw.kind === 'financial'
      ? 'Financial statement line item: Actual -> actual, Revised -> estimate, Budget -> budget, Forward Estimates -> estimate'
      : 'Historical fiscal indicator: years before 2025-26 are actual, 2025-26 is Budgeted, later years are estimates',
    'Budgeted figures are not actual/spent figures; do not sum across measure types',
    `Source copy SHA-256: ${raw.source_sha256 || '(see docs/source-archive/nsw-budget-2025-26.json)'}`,
  ].join('; ');
  return {
    amount_cents: amountCents,
    measure_type: raw.measure_type,
    fiscal_year: raw.fiscal_year,
    source_id: NSW_ID,
    source_url: NSW_OPEN_DATA_URL,
    verified: false,
    natural_key: key,
    jurisdiction_level: 'state',
    jurisdiction: 'NSW',
    source_dataset: NSW_DATASET,
    source_date: raw.source_date,
    data_quality_flag: 'provisional',
    project_name: raw.label,
    description: `${raw.sheet} — ${raw.label}`,
    delivery_entity: raw.sector,
    funding_source: 'NSW Treasury',
    location: { state: 'NSW' },
    notes: note,
  };
}

/** Pure transform: raw cells/features -> SpendingRecord[], de-duplicated on natural_key. */
export function transformNswRaw(raw: readonly RawRecord[]): NswTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: NswSkip[] = [];
  const seen = new Map<string, number>();
  const keys = new Set<string>();

  for (const entry of raw) {
    if (entry.kind === 'capital') {
      const feature = entry.feature;
      if (!isObject(feature)) {
        skipped.push({
          filename: 'arcgis',
          sheet: '',
          row: null,
          reason: 'capital feature is not an object',
        });
        continue;
      }
      const sig = `${text(feature.Project_ID) ?? ''}\u001f${text(feature.OBJECTID) ?? ''}`;
      const occurrence = seen.get(sig) ?? 0;
      seen.set(sig, occurrence + 1);
      const sourceSha = typeof entry.source_sha256 === 'string' ? entry.source_sha256 : '';
      const record = mapCapitalFeature(feature, occurrence, sourceSha);
      if (!record) {
        skipped.push({
          filename: 'arcgis',
          sheet: '',
          row: null,
          reason: `${text(feature.Project_name) ?? '(no project)'}: missing/unusable Budget_Year_FY_2025_26_000`,
        });
        continue;
      }
      if (keys.has(record.natural_key!)) continue;
      keys.add(record.natural_key!);
      records.push(record);
      continue;
    }
    if (entry.kind !== 'financial' && entry.kind !== 'hfi') {
      skipped.push({
        filename: 'unknown',
        sheet: '',
        row: null,
        reason: `unknown raw kind ${String(entry.kind)}`,
      });
      continue;
    }
    const cell = entry as NswCellRaw;
    const sig = `${cell.filename}\u001f${cell.sheet}\u001f${cell.row}\u001f${cell.headers.join('|')}\u001f${cell.fiscal_year}`;
    const occurrence = seen.get(sig) ?? 0;
    seen.set(sig, occurrence + 1);
    void occurrence;
    const record = cellRecord(cell);
    if (!record) {
      skipped.push({
        filename: cell.filename,
        sheet: cell.sheet,
        row: cell.row,
        reason: `unusable ${cell.unit} amount`,
      });
      continue;
    }
    if (keys.has(record.natural_key!)) continue;
    keys.add(record.natural_key!);
    records.push(record);
  }

  return { records, skipped, duplicates: 0 };
}

/** Streaming ExcelJS does not expose real sheet names; read them from workbook.xml. */
async function workbookSheetNames(filePath: string): Promise<string[]> {
  try {
    const zip = await JSZip.loadAsync(await readFile(filePath));
    const xml = await zip.file('xl/workbook.xml')?.async('string');
    if (!xml) return [];
    return parseHtml(xml)
      .querySelectorAll('sheet')
      .map((sheet) => sheet.getAttribute('name') ?? '')
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Stream a workbook with ExcelJS; no full workbook is loaded into memory. */
export async function readWorkbookStreaming(filePath: string): Promise<NswWorkbookRows> {
  const sheetNames = await workbookSheetNames(filePath);
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    entries: 'emit',
  });
  const sheets: NswWorkbookRows['sheets'] = [];
  let sheetIndex = 0;
  for await (const worksheet of reader) {
    const runtimeName = (worksheet as unknown as { name?: string }).name;
    const name = sheetNames[sheetIndex] ?? runtimeName ?? `Sheet${sheetIndex + 1}`;
    sheetIndex += 1;
    const rows: NswWorkbookRows['sheets'][number]['rows'] = [];
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

interface CachedWorkbook {
  filePath: string;
  sha256: string;
  bytes: number;
}

function defaultCacheDir(): string {
  return path.join(homedir(), '.cache', 'ausspend', 'nsw-budget', NSW_FISCAL_YEAR);
}

/**
 * Download a workbook to a cache keyed by filename + ETag/Last-Modified. An
 * existing cached copy with a matching source URL is reused; the SHA-256 is
 * recomputed from the local bytes so the manifest always describes the copy.
 */
export async function cacheWorkbook(
  file: NswSourceFile,
  cacheDir: string,
  fetchImpl: typeof fetch,
): Promise<CachedWorkbook> {
  await mkdir(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, safeFilename(file.filename));
  const metaPath = `${filePath}.meta.json`;
  let reuse = await fileExists(filePath);
  if (reuse && (await fileExists(metaPath))) {
    try {
      const meta = JSON.parse(await readFile(metaPath, 'utf8')) as { url?: string };
      reuse = meta.url === file.snapshot_url;
    } catch {
      reuse = false;
    }
  }

  if (!reuse) {
    if (typeof fetchImpl !== 'function')
      throw new Error('NSW download unavailable: no fetch implementation');
    const response = await fetchImpl(file.snapshot_url, {
      headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`NSW workbook HTTP ${response.status} for ${file.filename}`);
    if (!response.body) throw new Error(`NSW workbook ${file.filename} has no response body`);
    const partial = `${filePath}.part`;
    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(partial),
    );
    const { rename } = await import('node:fs/promises');
    await rename(partial, filePath);
    await writeFile(
      metaPath,
      JSON.stringify(
        {
          url: file.snapshot_url,
          etag: response.headers.get('etag') ?? response.headers.get('x-archive-orig-etag'),
          last_modified:
            response.headers.get('last-modified') ??
            response.headers.get('x-archive-orig-last-modified'),
          retrieved_at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }

  const info = await stat(filePath);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return { filePath, sha256: hash.digest('hex'), bytes: info.size };
}

async function resolveWaybackCapture(
  file: NswSourceFile,
  fetchImpl: typeof fetch,
  snapshotTimestamp: string,
): Promise<string> {
  const cdxUrl =
    'https://web.archive.org/cdx/search/cdx?url=' +
    encodeURIComponent(file.url) +
    '&output=json&filter=statuscode:200&from=20250601&to=20251231&fl=timestamp&limit=-1';
  try {
    const response = await fetchImpl(cdxUrl, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const body = (await response.json()) as unknown;
      if (Array.isArray(body) && body.length > 1) {
        const timestamps = body
          .slice(1)
          .map((row) => (Array.isArray(row) ? String(row[0] ?? '') : ''))
          .filter((value) => /^\d{14}$/.test(value) && value <= snapshotTimestamp)
          .sort();
        const picked = timestamps[timestamps.length - 1];
        if (picked) return `https://web.archive.org/web/${picked}id_/${file.url}`;
      }
    }
  } catch {
    // Fall through to the page snapshot's nearest capture.
  }
  return `https://web.archive.org/web/${snapshotTimestamp}id_/${file.url}`;
}

interface ArcGisPage {
  features?: Array<{ attributes?: Record<string, unknown> }>;
  exceededTransferLimit?: boolean;
}

async function fetchArcGisFeatures(
  queryUrl: string,
  fetchImpl: typeof fetch,
  expected: number,
): Promise<Array<Record<string, unknown>>> {
  const features: Array<Record<string, unknown>> = [];
  let offset = 0;
  for (let page = 0; page < 20; page += 1) {
    const url =
      `${queryUrl}?where=1%3D1&outFields=*&returnGeometry=false&f=json` +
      `&resultOffset=${offset}&resultRecordCount=2000`;
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`ArcGIS HTTP ${response.status} for ${queryUrl}`);
    const body = (await response.json()) as ArcGisPage;
    const batch = body.features ?? [];
    for (const entry of batch) {
      if (entry.attributes) features.push(entry.attributes);
    }
    if (!body.exceededTransferLimit || batch.length === 0) break;
    offset += batch.length;
  }
  if (features.length !== expected) {
    throw new Error(`ArcGIS expected ${expected} projects but fetched ${features.length}`);
  }
  return features;
}

/** Build the connector. `fetch` downloads, hashes and streams-parses every workbook plus ArcGIS. */
export function createNswBudgetConnector(options: NswConnectorOptions = {}): Connector {
  const cacheDir = options.cacheDir ?? defaultCacheDir();
  const pageUrl = options.pageUrl ?? NSW_OPEN_DATA_URL;
  const snapshotTimestamp = options.snapshotTimestamp ?? NSW_WAYBACK_SNAPSHOT;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const readWorkbook = options.readWorkbook ?? readWorkbookStreaming;
  const arcgisQueryUrl = options.arcgisQueryUrl ?? ARCGIS_QUERY_URL;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  let files: NswSourceFile[] = [];
  let archive: Array<
    Pick<NswSourceFile, 'filename' | 'sha256' | 'bytes' | 'url' | 'snapshot_url'>
  > = [];

  function recordFile(file: NswSourceFile): NswSourceFile {
    const entry = {
      filename: file.filename,
      sha256: file.sha256,
      bytes: file.bytes,
      url: file.url,
      snapshot_url: file.snapshot_url,
    };
    if (!archive.some((item) => item.filename === entry.filename)) archive.push(entry);
    return file;
  }

  async function fetchRaw(): Promise<RawRecord[]> {
    let pageHtml = options.pageHtml;
    if (!pageHtml) {
      const pageResponse = await fetchImpl(NSW_WAYBACK_PAGE, { headers: { Accept: 'text/html' } });
      if (!pageResponse.ok) throw new Error(`NSW open-data snapshot HTTP ${pageResponse.status}`);
      pageHtml = await pageResponse.text();
    }
    files = discoverNswFiles(pageHtml, pageUrl);
    if (files.length !== 12) {
      throw new Error(`NSW open-data snapshot exposed ${files.length} XLSX workbooks; expected 12`);
    }

    const raw: RawRecord[] = [];
    const skipped: NswSkip[] = [];
    const parseWarnings: string[] = [];

    for (const file of files) {
      const resolvedUrl = await resolveWaybackCapture(file, fetchImpl, snapshotTimestamp);
      file.snapshot_url = resolvedUrl;
      const cached = await cacheWorkbook(file, cacheDir, fetchImpl);
      file.sha256 = cached.sha256;
      file.bytes = cached.bytes;
      recordFile(file);

      const workbook = await readWorkbook(cached.filePath);
      if (file.category === 'financial') {
        raw.push(...financialRawRows(file, workbook, skipped));
      } else if (file.category === 'hfi') {
        raw.push(...hfiRawRows(file, workbook, skipped));
      } else {
        // Economy and performance/wellbeing workbooks are percentages, indices
        // and counts, not dollar spending. They are copied and hashed for
        // provenance, but no amount_cents is invented for them.
        const rows = countWorkbookRows(workbook);
        parseWarnings.push(
          `${file.filename}: ${rows} row(s) verified; no dollar spending series ingested`,
        );
      }
    }

    const features = await fetchArcGisFeatures(arcgisQueryUrl, fetchImpl, ARCGIS_EXPECTED_PROJECTS);
    const arcgisSha = sha256(JSON.stringify(features));
    for (const feature of features) {
      raw.push({
        kind: 'capital',
        feature,
        source_date: ARCGIS_SOURCE_DATE,
        source_sha256: arcgisSha,
      });
    }

    metadata.warnings = parseWarnings;
    if (skipped.length > 0) {
      const sample = skipped
        .slice(0, 6)
        .map((skip) => `${skip.filename}/${skip.sheet}:${skip.row ?? '?'} ${skip.reason}`)
        .join('; ');
      metadata.warnings.push(
        `${skipped.length} source cell(s) skipped (${sample}${skipped.length > 6 ? '; …' : ''})`,
      );
    }
    return raw;
  }

  return {
    id: NSW_ID,
    name: NSW_NAME,
    publisher: NSW_PUBLISHER,
    source_url: NSW_OPEN_DATA_URL,
    status: 'active',
    jurisdiction_level: 'state',
    license: NSW_LICENSE,
    notes: `${NSW_ATTRIBUTION} 2025-26 XLSX copies from the ${NSW_WAYBACK_SNAPSHOT} Wayback snapshot; capital projects from ArcGIS ${ARCGIS_LAYER_NAME}. Budgeted figures only; unverified.`,
    async fetch(): Promise<RawRecord[]> {
      archive = [];
      return fetchRaw();
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformNswRaw(raw);
      const warnings = [...(metadata.warnings ?? [])];
      if (result.skipped.length > 0) {
        warnings.push(`${result.skipped.length} transformed row(s) skipped`);
      }
      metadata.warnings = warnings;
      metadata.errors = [];
      return result.records;
    },
    metadata,
  };
}

/** Metadata-only archive entry list, suitable for committing as a manifest. */
export interface NswArchiveManifest {
  dataset: string;
  fiscal_year: string;
  page_url: string;
  page_snapshot_url: string;
  page_sha256: string;
  page_bytes: number;
  snapshot_timestamp: string;
  retrieved_at: string;
  attribution: string;
  license: string;
  files: Array<{
    filename: string;
    category: NswFileCategory;
    source_url: string;
    snapshot_url: string;
    sha256: string;
    bytes: number;
  }>;
  arcgis: {
    layer: string;
    query_url: string;
    source_date: string;
    feature_count: number;
    sha256: string;
    bytes: number;
  };
}

/** Discover + download + hash + parse for the reproducible archive script. */
export async function buildNswArchive(
  options: {
    pageHtml?: string;
    cacheDir?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<{ manifest: NswArchiveManifest; raw: NswRaw[]; warnings: string[] }> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const cacheDir = options.cacheDir ?? defaultCacheDir();
  let pageHtml = options.pageHtml;
  if (!pageHtml) {
    const response = await fetchImpl(NSW_WAYBACK_PAGE, { headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(`NSW open-data snapshot HTTP ${response.status}`);
    pageHtml = await response.text();
  }
  const files = discoverNswFiles(pageHtml);
  if (files.length !== 12) {
    throw new Error(`NSW open-data snapshot exposed ${files.length} XLSX workbooks; expected 12`);
  }
  const warnings: string[] = [];
  const raw: NswRaw[] = [];
  const skipped: NswSkip[] = [];
  const manifestFiles: NswArchiveManifest['files'] = [];

  await mkdir(cacheDir, { recursive: true });
  await writeFile(path.join(cacheDir, 'open-data-2025-26.html'), pageHtml);

  for (const file of files) {
    file.snapshot_url = await resolveWaybackCapture(file, fetchImpl, NSW_WAYBACK_SNAPSHOT);
    const cached = await cacheWorkbook(file, cacheDir, fetchImpl);
    file.sha256 = cached.sha256;
    file.bytes = cached.bytes;
    manifestFiles.push({
      filename: file.filename,
      category: file.category,
      source_url: file.url,
      snapshot_url: file.snapshot_url,
      sha256: cached.sha256,
      bytes: cached.bytes,
    });
    const workbook = await readWorkbookStreaming(cached.filePath);
    if (file.category === 'financial') raw.push(...financialRawRows(file, workbook, skipped));
    else if (file.category === 'hfi') raw.push(...hfiRawRows(file, workbook, skipped));
    else
      warnings.push(
        `${file.filename}: ${countWorkbookRows(workbook)} row(s); non-dollar indicators not ingested`,
      );
  }

  const features = await fetchArcGisFeatures(ARCGIS_QUERY_URL, fetchImpl, ARCGIS_EXPECTED_PROJECTS);
  const arcgisBytes = Buffer.from(JSON.stringify(features));
  await writeFile(path.join(cacheDir, 'arcgis-capital-projects.json'), arcgisBytes);
  const arcgisSha = sha256(arcgisBytes);
  for (const feature of features)
    raw.push({
      kind: 'capital',
      feature,
      source_date: ARCGIS_SOURCE_DATE,
      source_sha256: arcgisSha,
    });

  const manifest: NswArchiveManifest = {
    dataset: NSW_DATASET,
    fiscal_year: NSW_FISCAL_YEAR,
    page_url: NSW_OPEN_DATA_URL,
    page_snapshot_url: NSW_WAYBACK_PAGE,
    page_sha256: sha256(pageHtml),
    page_bytes: Buffer.byteLength(pageHtml),
    snapshot_timestamp: NSW_WAYBACK_SNAPSHOT,
    retrieved_at: new Date().toISOString(),
    attribution: NSW_ATTRIBUTION,
    license: NSW_LICENSE,
    files: manifestFiles,
    arcgis: {
      layer: ARCGIS_LAYER_NAME,
      query_url: ARCGIS_LAYER_URL,
      source_date: ARCGIS_SOURCE_DATE,
      feature_count: features.length,
      sha256: sha256(arcgisBytes),
      bytes: arcgisBytes.length,
    },
  };
  return { manifest, raw, warnings };
}
