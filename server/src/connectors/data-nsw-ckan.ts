import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import type { SpendingRecord } from '@ausspend/shared';
import type { DeferredResource } from '../models/data-source.js';
import {
  UNIT_TO_CENTS,
  financialYearOf,
  nswCofogForAgency,
  worksheetCellValue,
} from './nsw-budget-open-data.js';
import {
  archiveSourceDocument,
  safeFilename,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * data.nsw.gov.au CKAN connector (S2).
 *
 * This is a *targeted* connector: it runs the discovery queries the brief
 * requires, then ingests a small curated set of relevant datasets. It never
 * harvests the whole portal (~16,907 datasets).
 *
 * Resource handling:
 *   - CSV/XLSX            -> downloaded into the reusable source archive, then
 *                            parsed by the generic tabular mapper.
 *   - datastore_active    -> paged `datastore_search` (limit/offset). The paged
 *                            JSON is archived as a hashed provenance document.
 *   - PDF/DOC/DOCX        -> deferred. Recorded on the source so the API/UI
 *                            show them clearly; the bytes are not ingested.
 *
 * Units are never silently guessed. The mapper reads an explicit `$`, `$m`,
 * `$b`, `$'000` marker from the column header, values or XLSX number format.
 * If the CKAN metadata does not state a unit, the caller supplies the closest
 * published convention, marks the rows provisional and logs a warning.
 */

export const CKAN_ID = 'data-nsw-ckan';
export const CKAN_NAME = 'data.nsw.gov.au CKAN (NSW Government open data)';
export const CKAN_PUBLISHER = 'NSW Government — data.nsw.gov.au';
export const CKAN_SOURCE_URL = 'https://data.nsw.gov.au/data/';
export const CKAN_API_BASE = 'https://data.nsw.gov.au/data/api/3/action';
export const CKAN_DATASET_PAGE_BASE = 'https://data.nsw.gov.au/data/dataset';
export const CKAN_LICENSE = 'Creative Commons Attribution (per CKAN dataset metadata)';
export const CKAN_DEFAULT_DELAY_MS = 500;
export const CKAN_DEFAULT_MAX_RETRIES = 4;
export const CKAN_DATASTORE_PAGE_SIZE = 1_000;
export const CKAN_MAX_CONCURRENT_DOWNLOADS = 2;
export const CKAN_USER_AGENT =
  'ausspend/0.1 (Australian government spending explorer; contact: ausspend-dev@example.invalid)';

export type NswCkanUnit = '$' | "$'000" | '$m' | '$b';
export type NswCkanMode = 'csv' | 'xlsx' | 'datastore' | 'deferred';

export const NSW_CKAN_UNIT_TO_CENTS: Readonly<Record<NswCkanUnit, number>> = {
  $: UNIT_TO_CENTS['$']!,
  "$'000": UNIT_TO_CENTS["$'000"]!,
  $m: UNIT_TO_CENTS['$m']!,
  $b: UNIT_TO_CENTS['$b']!,
};

/** Discovery queries required by the S2 brief. They are logged, not harvested. */
export const NSW_CKAN_TARGETED_QUERIES: ReadonlyArray<{ label: string; query: string }> = [
  { label: 'budget', query: 'budget' },
  { label: 'expenditure', query: 'expenditure' },
  { label: 'capital works', query: 'capital works' },
  { label: 'grants', query: 'grants' },
  { label: 'agency expenditure', query: 'agency expenditure' },
  { label: 'NSW Treasury', query: 'organization:the-treasury' },
  { label: 'Transport for NSW', query: 'organization:transport-for-nsw' },
  { label: 'NSW Health', query: 'organization:nsw-health' },
  { label: 'Department of Education', query: 'organization:education' },
];

/**
 * Curated datasets discovered with the queries above. Each resource was
 * checked with `package_show`; the modes below are deliberate:
 *
 *   - RAM funding: CSV download, explicit `$` in the column header.
 *   - Budget Paper 2: DataStore CSV (2016-17 Infrastructure Statement). The
 *     CKAN metadata has no unit column, so `$'000` is the closest published
 *     convention and every row is provisional.
 *   - Fleet vehicle spend: XLSX download. The `$` unit comes from the cell
 *     number format (`"$"#,##0`), not from a guess.
 *   - Media expenditure 2024/2025: DOCX only -> deferred.
 */
export interface NswCkanResourceSpec {
  id: string;
  name: string;
  mode: NswCkanMode;
  /** Explicit amount columns, used where the source has cumulative/total columns. */
  amountColumns?: string[];
  fiscalYear?: string;
  measureType?: 'actual' | 'budget' | 'estimate';
  measureTypeRationale?: string;
  unit?: NswCkanUnit;
  unitExplicit?: boolean;
  unitEvidence?: string;
  /** Non-fatal data-quality warning logged with the run (ambiguous unit/measure type). */
  qualityWarning?: string;
  sheetName?: string;
  /** 1-based header row for XLSX resources that have title rows above the table. */
  headerRow?: number;
  labelColumns?: string[];
  entityColumns?: string[];
  lgaColumns?: string[];
  functionCode?: string;
}

export interface NswCkanDatasetSpec {
  packageName: string;
  query: string;
  resources: NswCkanResourceSpec[];
}

export const NSW_CKAN_SELECTED_DATASETS: ReadonlyArray<NswCkanDatasetSpec> = [
  {
    packageName: 'nsw-education-resource-allocation-model',
    query: 'budget / Department of Education',
    resources: [
      {
        id: '359f1b44-f453-4cc6-961f-840a4b83d1de',
        name: '2026 Resource Allocation Model (RAM) funding table',
        mode: 'csv',
        amountColumns: ['Original RAM Funding $'],
        fiscalYear: '2025-26',
        measureType: 'budget',
        measureTypeRationale:
          'Approved Resource Allocation Model funding allocation for the 2026 school year (within FY 2025-26); a budgeted allocation, not actual spend.',
        labelColumns: ['School Full Name'],
        entityColumns: ['School Full Name'],
        functionCode: '09',
      },
    ],
  },
  {
    packageName: 'nsw-budget-paper-2',
    query: 'capital works',
    resources: [
      {
        id: '0b1ab94e-10a1-4fa9-b483-1cd72f5df778',
        name: 'NSW_BudgetPaper2_201617',
        mode: 'datastore',
        amountColumns: ['Allocation201415', 'Allocation201516', 'Allocation201617'],
        measureType: 'budget',
        measureTypeRationale:
          'NSW Budget Paper 2 Infrastructure Statement capital allocation for the named financial year; budgeted, not actual spend.',
        unit: "$'000",
        unitExplicit: false,
        unitEvidence:
          "CKAN metadata does not state a unit; NSW Budget Paper 2 Infrastructure Statement allocations are conventionally $'000. Treated as the closest unit and flagged provisional.",
        qualityWarning:
          "NSW Budget Paper 2: unit is not stated in CKAN metadata; $'000 is the closest published convention and every row is flagged provisional.",
        entityColumns: ['AgencyName'],
        lgaColumns: ['LGA'],
        labelColumns: ['ProjectName'],
      },
    ],
  },
  {
    packageName: 'fleet-vehicle-expenditure-data-fy18-19',
    query: 'expenditure / NSW Treasury',
    resources: [
      {
        id: '1bf4db95-01d1-4e11-8ac0-097e6a7e7167',
        name: 'Fleet Vehicle expenditure data FY18-19.xlsx',
        mode: 'xlsx',
        sheetName: 'Spend',
        headerRow: 3,
        amountColumns: ['Invoice Charge (exc GST)'],
        fiscalYear: '2018-19',
        measureType: 'actual',
        measureTypeRationale:
          'Historical fleet supplier-invoice spend for FY2018-19; reported spend, not described as audited, so flagged provisional.',
        qualityWarning:
          'Fleet Vehicle expenditure: historical reported spend, not described as audited; measure_type actual is the closest type and every row is flagged provisional.',
        entityColumns: ['Cluster'],
        labelColumns: ['Cluster'],
      },
    ],
  },
  {
    packageName: 'media-expenditure-by-agency-2024-2025',
    query: 'agency expenditure',
    resources: [
      {
        id: 'f6e15e73-e00b-44a1-afea-816fd6e8be9e',
        name: '202407-202506-q4-expenditure-by-agency.docx',
        mode: 'deferred',
      },
    ],
  },
];

export interface NswCkanTableContext {
  packageId: string;
  packageName: string;
  datasetTitle: string;
  datasetPage: string;
  resourceId: string;
  resourceName: string;
  resourceFormat: string;
  resourceUrl: string;
  sourceDate: string;
  mode: 'csv' | 'xlsx' | 'datastore';
  amountColumns: string[];
  columnFiscalYears: Record<string, string>;
  fiscalYear?: string;
  measureType: 'actual' | 'budget' | 'estimate';
  measureTypeRationale: string;
  unit: NswCkanUnit;
  unitExplicit: boolean;
  unitEvidence: string;
  /** Force provisional quality even when the unit is explicit (ambiguous measure type). */
  forceProvisional?: boolean;
  sheetName?: string;
  labelColumns: string[];
  entityColumns: string[];
  lgaColumns: string[];
  functionCode?: string;
  cellFormats?: Record<string, string>;
  archive: Pick<ArchivedSourceRecord, 'local_path' | 'sha256' | 'bytes'>;
  warnings: string[];
}

export interface NswCkanRejection {
  row: number;
  column: string | null;
  reason: string;
}

export interface NswCkanMappedRow {
  records: SpendingRecord[];
  rejectedRows: NswCkanRejection[];
  rejectedValues: NswCkanRejection[];
}

export interface NswCkanTableResult {
  records: SpendingRecord[];
  rejectedRows: NswCkanRejection[];
  rejectedValues: NswCkanRejection[];
  duplicates: number;
  sourceRows: number;
  rowsWithRecords: number;
  warnings: string[];
}

export interface NswCkanQueryReport {
  label: string;
  query: string;
  count: number;
  top: Array<{ name: string; title: string }>;
}

export interface NswCkanResourceReport {
  package_id: string;
  package_name: string;
  dataset_title: string;
  dataset_page: string;
  resource_id: string;
  resource_name: string;
  resource_format: string;
  mode: NswCkanMode;
  resource_url: string;
  source_date: string;
  source_rows: number;
  archive: {
    local_path: string;
    sha256: string;
    bytes: number;
  };
}

export interface NswCkanArchiveManifest {
  source_id: string;
  generated_at: string;
  api_base: string;
  queries: NswCkanQueryReport[];
  datasets: Array<{
    package_id: string;
    package_name: string;
    title: string;
    source_url: string;
    query: string;
    resources: Array<
      Omit<NswCkanResourceReport, 'archive'> & {
        archive: { filename: string; sha256: string; bytes: number };
      }
    >;
    deferred_resources: DeferredResource[];
  }>;
  deferred_resources: DeferredResource[];
}

export interface NswCkanConnectorOptions {
  apiBase?: string;
  datasetPageBase?: string;
  delayMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  archiveRoot?: string;
  /** Run the nine discovery searches before package_show (default true). */
  runTargetedSearch?: boolean;
  datasets?: ReadonlyArray<NswCkanDatasetSpec>;
  /** Write the archive manifest (JSON metadata only) to this path. */
  manifestPath?: string;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function normaliseText(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const collapsed = raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return collapsed.length > 0 ? collapsed : null;
}

function isDeferredFormat(format: string): boolean {
  const normalised = format.toLowerCase().replace(/[^a-z]/g, '');
  return (
    normalised === 'pdf' ||
    normalised === 'doc' ||
    normalised === 'docx' ||
    normalised === 'word' ||
    normalised === 'msword' ||
    normalised === 'officedocument'
  );
}

function resourceDate(resource: Record<string, unknown>, fallback: Date): string {
  const value =
    asString(resource.last_modified) ??
    asString(resource.metadata_modified) ??
    asString(resource.created) ??
    '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? fallback.toISOString().slice(0, 10);
}

function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Stable content hash for one source row + the amount column being mapped. */
export function nswCkanRowHash(row: RawRecord, amountColumn: string): string {
  const keys = Object.keys(row).sort();
  const canonical = keys
    .map((key) => `${key}\u001f${normaliseText(row[key]) ?? ''}`)
    .join('\u001e');
  return sha256(`${canonical}\u001d${amountColumn}`).slice(0, 32);
}

/** natural_key = hash(package_id + resource_id + row_hash), as required by S2. */
export function nswCkanNaturalKey(packageId: string, resourceId: string, rowHash: string): string {
  return `${CKAN_ID}:${sha256(`${packageId}\u001f${resourceId}\u001f${rowHash}`).slice(0, 40)}`;
}

/** Parse a raw amount string/number into a signed number, without unit conversion. */
export function parseAmountValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value
    .replace(/\u00a0/g, ' ')
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!text || /^(n\.?a\.?|-|–|—)$/i.test(text)) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

export interface AmountParseResult {
  cents: number | null;
  negative: boolean;
}

/** Convert a raw amount with an explicit unit to integer cents. */
export function nswCkanAmountToCents(value: unknown, unit: NswCkanUnit): AmountParseResult {
  const parsed = parseAmountValue(value);
  if (parsed === null) return { cents: null, negative: false };
  if (parsed < 0) return { cents: null, negative: true };
  const multiplier = NSW_CKAN_UNIT_TO_CENTS[unit];
  const cents = Math.round(parsed * multiplier);
  if (!Number.isSafeInteger(cents) || cents < 0) return { cents: null, negative: false };
  return { cents, negative: false };
}

/** Normalise a header for amount/unit keyword matching. */
function normaliseHeader(header: string): string {
  return header
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Detect the explicit unit marker in a column header, if any. */
export function detectUnitFromHeader(header: string): NswCkanUnit | null {
  const text = normaliseHeader(header);
  if (/(?:\$|aud)\s*['’]?0{3}|thousand|000s/.test(text)) return "$'000";
  if (/\$+\s*(?:m|million)\b|million/.test(text)) return '$m';
  if (/\$+\s*(?:b|billion)\b|billion/.test(text)) return '$b';
  if (/\$|aud/.test(text)) return '$';
  return null;
}

/** Detect a unit from an Excel number format such as `"$"#,##0` or `#,##0,`. */
export function detectUnitFromNumberFormat(format: string | null | undefined): NswCkanUnit | null {
  if (!format) return null;
  if (/,\s*["']?\s*$/.test(format) || /0{3}/.test(format)) return "$'000";
  if (/\$/.test(format)) return '$';
  return null;
}

/** Detect a unit from the first dollar-looking value in a column. */
export function detectUnitFromValues(values: readonly unknown[]): NswCkanUnit | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed.includes('$')) continue;
    if (/\$+\s*(?:m|million)\b/i.test(trimmed)) return '$m';
    if (/\$+\s*(?:b|billion)\b/i.test(trimmed)) return '$b';
    return '$';
  }
  return null;
}

const AMOUNT_HEADER_PATTERN =
  /\$|amount|spend|expenditure|funding|allocation|charge|cost|payment|grant|budget|revenue|income/i;
const NON_AMOUNT_HEADER_PATTERN =
  /\b(?:code|id|number|count|year|date|period|month|quarter|fte|enrol|units?|percent|%)/i;

/** Detect likely amount columns from a header list. */
export function detectAmountColumns(headers: readonly string[]): string[] {
  return headers.filter((header) => {
    const text = header.trim();
    if (!text) return false;
    if (NON_AMOUNT_HEADER_PATTERN.test(text) && !/\$/.test(text)) return false;
    return AMOUNT_HEADER_PATTERN.test(text);
  });
}

/** Detect a financial year encoded in a column header such as `Allocation201415`. */
export function fiscalYearFromColumnHeader(header: string): string | null {
  const text = header.replace(/\s+/g, '');
  const separated = /(19|20)(\d{2})[-/](\d{2}|(?:19|20)\d{2})/.exec(text);
  if (separated) {
    const start = Number(`${separated[1]}${separated[2]}`);
    const endRaw = separated[3]!;
    const end =
      endRaw.length === 4 ? Number(endRaw) : Math.floor(start / 100) * 100 + Number(endRaw);
    if (end === start + 1) return `${start}-${String(end).slice(-2)}`;
  }
  const compact = /(19|20)(\d{2})(\d{2})/.exec(text);
  if (compact) {
    const start = Number(`${compact[1]}${compact[2]}`);
    const end = Math.floor(start / 100) * 100 + Number(compact[3]);
    if (end === start + 1) return `${start}-${String(end).slice(-2)}`;
  }
  const single = /^(?:fy)?((?:19|20)\d{2})$/.exec(text.toLowerCase());
  if (single) {
    const start = Number(single[1]);
    return `${start}-${String(start + 1).slice(-2)}`;
  }
  return null;
}

/** Detect a date/financial-year column from a header list. */
export function detectFiscalYearColumns(headers: readonly string[]): string[] {
  return headers.filter((header) =>
    /(?:^|\b)(?:fy|financial\s*year|year|date|period|quarter|month)(?:\b|$)/i.test(header),
  );
}

function isTotalLabel(label: string | null): boolean {
  if (!label) return false;
  return /^(?:grand\s+)?total\b|^subtotal\b|\btotal$/i.test(label.trim());
}

function rowHasTotalMarker(row: RawRecord): boolean {
  return Object.values(row).some(
    (value) => typeof value === 'string' && /^(?:grand\s+)?total$|^subtotal$/i.test(value.trim()),
  );
}

function firstText(
  row: RawRecord,
  preferred: readonly string[],
  exclude: readonly string[] = [],
): string | null {
  const excludeSet = new Set(exclude.map((entry) => entry.toLowerCase()));
  for (const column of preferred) {
    if (excludeSet.has(column.toLowerCase())) continue;
    const value = normaliseText(row[column]);
    if (value) return value;
  }
  for (const [key, raw] of Object.entries(row)) {
    if (excludeSet.has(key.toLowerCase())) continue;
    if (typeof raw !== 'string') continue;
    const value = normaliseText(raw);
    if (value && !/^\d+(?:\.\d+)?$/.test(value)) return value;
  }
  return null;
}

function lgaFromRow(row: RawRecord, columns: readonly string[]): string | null {
  for (const column of columns) {
    const value = normaliseText(row[column]);
    if (!value) continue;
    if (/^(?:n\.?a\.?|unknown|not applicable|-|–|—)$/i.test(value)) continue;
    return value;
  }
  return null;
}

function formatUnitEvidence(unit: NswCkanUnit, explicit: boolean, evidence: string): string {
  return `unit ${unit} (${explicit ? 'explicit' : 'inferred/provisional'}; ${evidence})`;
}

export type NswCkanTableBase = Omit<
  NswCkanTableContext,
  'amountColumns' | 'columnFiscalYears' | 'unit' | 'unitExplicit' | 'unitEvidence' | 'warnings'
> & { warnings?: string[] };

/**
 * Resolve amount columns, units and per-column fiscal years once per table.
 * Warnings are returned instead of silently falling back.
 */
export function prepareTableContext(
  headers: readonly string[],
  rows: readonly RawRecord[],
  base: NswCkanTableBase,
  spec: NswCkanResourceSpec,
): NswCkanTableContext {
  const warnings: string[] = [...(base.warnings ?? [])];
  const available = new Set(headers);
  let amountColumns: string[];

  if (spec.amountColumns && spec.amountColumns.length > 0) {
    amountColumns = spec.amountColumns.filter((column) => available.has(column));
    for (const column of spec.amountColumns) {
      if (!available.has(column)) {
        warnings.push(`${base.resourceName}: configured amount column "${column}" is absent`);
      }
    }
  } else {
    amountColumns = detectAmountColumns(headers);
  }

  if (amountColumns.length === 0) {
    warnings.push(`${base.resourceName}: no amount column detected; no rows will be ingested`);
  }

  const columnFiscalYears: Record<string, string> = {};
  for (const column of amountColumns) {
    const fiscalYear = fiscalYearFromColumnHeader(column);
    if (fiscalYear) columnFiscalYears[column] = fiscalYear;
  }

  let unit: NswCkanUnit | null = spec.unit ?? null;
  let unitExplicit = spec.unitExplicit ?? false;
  let unitEvidence = spec.unitEvidence ?? '';

  if (!unit) {
    for (const column of amountColumns) {
      const headerUnit = detectUnitFromHeader(column);
      const formatUnit = detectUnitFromNumberFormat(base.cellFormats?.[column]);
      const values = rows.slice(0, 20).map((row) => row[column]);
      const valueUnit = detectUnitFromValues(values);
      const found = headerUnit ?? formatUnit ?? valueUnit;
      if (found) {
        unit = found;
        unitExplicit = true;
        unitEvidence = headerUnit
          ? `column header "${column}" contains the unit marker`
          : formatUnit
            ? `XLSX number format "${base.cellFormats?.[column]}" contains the unit marker`
            : `first dollar-formatted values in "${column}" contain "$"`;
        break;
      }
    }
  }

  if (!unit) {
    unit = '$';
    unitExplicit = false;
    unitEvidence =
      'no explicit unit marker in the header, values or number format; "$" is the closest assumption and rows are provisional';
    warnings.push(`${base.resourceName}: unit not explicit; assuming "$" and flagging provisional`);
  } else if (!unitExplicit && !unitEvidence) {
    unitEvidence = 'unit supplied by the resource mapping (no explicit CKAN marker)';
  }

  if (amountColumns.length > 0 && unitExplicit) {
    // Record the evidence on the table for notes and the manifest.
    const first = amountColumns[0]!;
    if (!unitEvidence) unitEvidence = `column "${first}"`;
  }
  if (spec.qualityWarning) warnings.push(spec.qualityWarning);

  return {
    ...base,
    amountColumns,
    columnFiscalYears,
    fiscalYear: spec.fiscalYear ?? base.fiscalYear,
    unit,
    unitExplicit,
    unitEvidence: unitEvidence || 'see row notes',
    forceProvisional: spec.qualityWarning ? true : base.forceProvisional,
    warnings,
  };
}

function fiscalYearForRow(row: RawRecord): string | null {
  for (const column of detectFiscalYearColumns(Object.keys(row))) {
    const value = row[column];
    const parsed = financialYearOf(value);
    if (parsed) return parsed;
  }
  return null;
}

function notesForRow(
  context: NswCkanTableContext,
  amountColumn: string,
  fiscalYear: string,
  rowNumber: number,
): string {
  return [
    `CKAN dataset: ${context.datasetTitle} (${context.packageName})`,
    `resource: ${context.resourceName} (${context.resourceId}, ${context.resourceFormat})`,
    `source_detail: ${context.resourceUrl}`,
    `archived: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `amount column: ${amountColumn}`,
    formatUnitEvidence(context.unit, context.unitExplicit, context.unitEvidence),
    `measure_type: ${context.measureType} (${context.measureTypeRationale})`,
    `fiscal_year: ${fiscalYear}`,
    `source row: ${rowNumber}`,
    'unverified; never sum across measure types',
  ].join('; ');
}

/** Map one source row, using a prepared table context. Pure and fixture-testable. */
export function mapNswCkanRow(
  row: RawRecord,
  context: NswCkanTableContext,
  rowNumber: number,
): NswCkanMappedRow {
  const records: SpendingRecord[] = [];
  const rejectedValues: NswCkanRejection[] = [];
  const label = firstText(row, context.labelColumns, context.amountColumns);
  const entity =
    firstText(row, context.entityColumns, context.amountColumns) ?? label ?? context.resourceName;
  const lga = lgaFromRow(row, context.lgaColumns);

  if (isTotalLabel(label) || rowHasTotalMarker(row)) {
    return {
      records,
      rejectedRows: [
        {
          row: rowNumber,
          column: null,
          reason: `${label ?? 'row'}: total/subtotal row excluded to avoid double counting`,
        },
      ],
      rejectedValues,
    };
  }

  const functionCode = context.functionCode ?? nswCofogForAgency(entity);
  const location = lga ? { state: 'NSW', lga_name: lga } : { state: 'NSW' };
  const dataQualityFlag =
    context.forceProvisional || !context.unitExplicit
      ? 'provisional'
      : lga
        ? 'provisional'
        : 'statewide_only';

  for (const column of context.amountColumns) {
    const raw = row[column];
    if (raw === null || raw === undefined || normaliseText(raw) === null) continue;
    const parsed = nswCkanAmountToCents(raw, context.unit);
    if (parsed.negative) {
      rejectedValues.push({
        row: rowNumber,
        column,
        reason: `${column}: negative amount skipped (model stores non-negative spending)`,
      });
      continue;
    }
    if (parsed.cents === null) {
      rejectedValues.push({
        row: rowNumber,
        column,
        reason: `${column}: unusable amount ${JSON.stringify(raw)} (expected a number in ${context.unit})`,
      });
      continue;
    }
    const fiscalYear =
      context.columnFiscalYears[column] ?? context.fiscalYear ?? fiscalYearForRow(row);
    if (!fiscalYear) {
      rejectedValues.push({
        row: rowNumber,
        column,
        reason: `${column}: no fiscal year in the column header, row date columns or resource mapping`,
      });
      continue;
    }
    const rowHash = nswCkanRowHash(row, column);
    const record: SpendingRecord = {
      amount_cents: parsed.cents,
      measure_type: context.measureType,
      fiscal_year: fiscalYear,
      source_id: CKAN_ID,
      source_url: context.datasetPage,
      verified: false,
      natural_key: nswCkanNaturalKey(context.packageId, context.resourceId, rowHash),
      jurisdiction_level: 'state',
      jurisdiction: 'NSW',
      source_dataset: context.datasetTitle,
      source_date: context.sourceDate,
      data_quality_flag: dataQualityFlag,
      project_name: label ?? context.resourceName,
      description: context.resourceName,
      delivery_entity: entity,
      funding_source: context.datasetTitle,
      location,
      notes: notesForRow(context, column, fiscalYear, rowNumber),
      ...(functionCode ? { function_code: functionCode } : {}),
    };
    records.push(record);
  }

  const rejectedRows =
    records.length === 0
      ? [
          {
            row: rowNumber,
            column: null,
            reason:
              rejectedValues.length > 0
                ? `${rejectedValues.length} amount value(s) rejected; no usable measure`
                : 'no usable amount in the configured amount columns',
          },
        ]
      : [];

  return { records, rejectedRows, rejectedValues };
}

/** Map a whole table, de-duplicating identical rows by natural_key. */
export function mapNswCkanTable(
  rows: readonly RawRecord[],
  context: NswCkanTableContext,
): NswCkanTableResult {
  const records: SpendingRecord[] = [];
  const rejectedRows: NswCkanRejection[] = [];
  const rejectedValues: NswCkanRejection[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let rowsWithRecords = 0;

  rows.forEach((row, index) => {
    const mapped = mapNswCkanRow(row, context, index + 1);
    if (mapped.records.length > 0) rowsWithRecords += 1;
    rejectedRows.push(...mapped.rejectedRows);
    rejectedValues.push(...mapped.rejectedValues);
    for (const record of mapped.records) {
      if (seen.has(record.natural_key)) {
        duplicates += 1;
        continue;
      }
      seen.add(record.natural_key);
      records.push(record);
    }
  });

  return {
    records,
    rejectedRows,
    rejectedValues,
    duplicates,
    sourceRows: rows.length,
    rowsWithRecords,
    warnings: [...context.warnings],
  };
}

/** Parse a CSV buffer into objects with trimmed column names. */
export function parseCsvRows(buffer: Buffer | string): RawRecord[] {
  const rows = parseCsv(buffer, {
    bom: true,
    columns: (header: string[]) => header.map((value) => value.replace(/\s+/g, ' ').trim()),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as unknown;
  if (!Array.isArray(rows)) return [];
  return rows.filter(isObject).map((row) => {
    const normalised: RawRecord = {};
    for (const [key, value] of Object.entries(row))
      normalised[key.replace(/\s+/g, ' ').trim()] = value;
    return normalised;
  });
}

export interface XlsxTable {
  sheet: string;
  headers: string[];
  rows: RawRecord[];
  cellFormats: Record<string, string>;
}

function headerScore(values: readonly unknown[]): { score: number; stringCount: number } {
  let stringCount = 0;
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) stringCount += 1;
  }
  return {
    score: stringCount * 2 + values.filter((value) => value !== null && value !== '').length,
    stringCount,
  };
}

function dedupeHeaders(values: readonly (string | number | null)[]): string[] {
  const used = new Map<string, number>();
  return values.map((value, index) => {
    let header = normaliseText(value) ?? `column_${index + 1}`;
    const count = used.get(header) ?? 0;
    used.set(header, count + 1);
    if (count > 0) header = `${header}_${count + 1}`;
    return header;
  });
}

/** Read one worksheet into a header row, object rows and per-column number formats. */
export async function readXlsxTable(
  buffer: Buffer,
  sheetName?: string,
  headerRow?: number,
): Promise<XlsxTable> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheets = sheetName
    ? [workbook.getWorksheet(sheetName)].filter((sheet): sheet is ExcelJS.Worksheet =>
        Boolean(sheet),
      )
    : workbook.worksheets;
  const sheet = sheets[0];
  if (!sheet)
    throw new Error(`XLSX workbook has no worksheet${sheetName ? ` "${sheetName}"` : ''}`);

  let headerRowNumber = headerRow ?? 0;
  if (!headerRowNumber) {
    const scanLimit = Math.min(sheet.rowCount, 25);
    for (let rowNumber = 1; rowNumber <= scanLimit; rowNumber += 1) {
      const values: Array<string | number | null> = [];
      for (let column = 1; column <= Math.max(sheet.columnCount, 1); column += 1) {
        values.push(worksheetCellValue(sheet.getRow(rowNumber).getCell(column).value));
      }
      if (headerScore(values).stringCount >= 2) {
        headerRowNumber = rowNumber;
        break;
      }
    }
  }
  if (!headerRowNumber) {
    throw new Error(`XLSX worksheet "${sheet.name}" has no detectable header row`);
  }

  const headerValues: Array<string | number | null> = [];
  for (let column = 1; column <= Math.max(sheet.columnCount, 1); column += 1) {
    headerValues.push(worksheetCellValue(sheet.getRow(headerRowNumber).getCell(column).value));
  }
  const headers = dedupeHeaders(headerValues);
  while (headers.length > 0 && /^column_\d+$/.test(headers[headers.length - 1]!)) headers.pop();

  const rows: RawRecord[] = [];
  const cellFormats: Record<string, string> = {};
  let started = false;
  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row: RawRecord = {};
    let nonEmpty = false;
    for (let column = 0; column < headers.length; column += 1) {
      const cell = sheet.getRow(rowNumber).getCell(column + 1);
      const value = worksheetCellValue(cell.value);
      row[headers[column]!] = value;
      if (value !== null && value !== '') nonEmpty = true;
      if (!cellFormats[headers[column]!] && cell.numFmt)
        cellFormats[headers[column]!] = cell.numFmt;
    }
    if (!nonEmpty) {
      // A blank row ends the first table (fleet workbooks often put a second
      // table below a blank separator; never treat its counts as amounts).
      if (started) break;
      continue;
    }
    started = true;
    rows.push(row);
  }

  return { sheet: sheet.name, headers, rows, cellFormats };
}

interface CkanResponse {
  success?: boolean;
  result?: unknown;
  error?: unknown;
}

interface CkanClient {
  json(action: string, params: Record<string, string | number>): Promise<unknown>;
  download(url: string): Promise<{
    bytes: Buffer;
    contentType: string | null;
    lastModified: string | null;
    etag: string | null;
  }>;
}

function parseRetryAfter(header: string | null, now: Date): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 60_000);
  const date = new Date(header);
  if (!Number.isNaN(date.getTime())) {
    return Math.max(0, Math.min(date.getTime() - now.getTime(), 60_000));
  }
  return null;
}

function createCkanClient(options: {
  apiBase: string;
  delayMs: number;
  maxRetries: number;
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
}): CkanClient {
  let lastRequestAt = 0;

  async function politeWait(): Promise<void> {
    if (lastRequestAt > 0) {
      const elapsed = options.now().getTime() - lastRequestAt;
      if (elapsed < options.delayMs) await options.sleep(options.delayMs - elapsed);
    }
    lastRequestAt = options.now().getTime();
  }

  async function fetchWithRetry(url: string, accept: string): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      await politeWait();
      const response = await options.fetchImpl(url, {
        headers: { Accept: accept, 'User-Agent': CKAN_USER_AGENT },
        redirect: 'follow',
      });
      if (response.status !== 429 && response.status !== 503) {
        if (!response.ok) throw new Error(`CKAN HTTP ${response.status} for ${url}`);
        return response;
      }
      if (attempt >= options.maxRetries) {
        throw new Error(
          `CKAN rate limited (${response.status}) after ${options.maxRetries} retries`,
        );
      }
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'), options.now());
      await options.sleep(retryAfter ?? Math.min(1_000 * 2 ** attempt, 30_000));
    }
  }

  return {
    async json(action: string, params: Record<string, string | number>): Promise<unknown> {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) search.set(key, String(value));
      const url = `${options.apiBase}/${action}?${search.toString()}`;
      const response = await fetchWithRetry(url, 'application/json');
      const body = (await response.json()) as CkanResponse;
      if (!isObject(body) || body.success === false) {
        throw new Error(
          `CKAN ${action} returned success:false${body.error ? `: ${String(body.error)}` : ''}`,
        );
      }
      return body.result;
    },
    async download(url: string) {
      const response = await fetchWithRetry(url, '*/*');
      const bytes = Buffer.from(await response.arrayBuffer());
      return {
        bytes,
        contentType: response.headers.get('content-type'),
        lastModified: response.headers.get('last-modified'),
        etag: response.headers.get('etag'),
      };
    },
  };
}

async function datastoreSearchAll(
  client: CkanClient,
  resourceId: string,
): Promise<{ records: RawRecord[]; total: number; searchUrl: string }> {
  const records: RawRecord[] = [];
  let total = 0;
  let offset = 0;
  let searchUrl = '';
  for (let page = 0; page < 10_000; page += 1) {
    const result = (await client.json('datastore_search', {
      resource_id: resourceId,
      limit: CKAN_DATASTORE_PAGE_SIZE,
      offset,
    })) as Record<string, unknown> | null;
    if (!isObject(result))
      throw new Error(`CKAN datastore_search ${resourceId} returned no result`);
    if (typeof result.total === 'number' && Number.isFinite(result.total)) total = result.total;
    const batch = Array.isArray(result.records) ? result.records.filter(isObject) : [];
    searchUrl = `${CKAN_API_BASE}/datastore_search?resource_id=${encodeURIComponent(resourceId)}`;
    for (const record of batch) {
      const normalised: RawRecord = {};
      for (const [key, value] of Object.entries(record)) normalised[key.trim()] = value;
      records.push(normalised);
    }
    if (batch.length === 0 || records.length >= total) break;
    offset += batch.length;
  }
  return { records, total, searchUrl };
}

interface CollectResult {
  raw: RawRecord[];
  deferred: DeferredResource[];
  queries: NswCkanQueryReport[];
  reports: Array<{
    dataset: NswCkanDatasetSpec & { packageId: string; title: string };
    resources: NswCkanResourceReport[];
    deferred: DeferredResource[];
  }>;
  warnings: string[];
}

async function collectNswCkan(options: {
  apiBase: string;
  datasetPageBase: string;
  client: CkanClient;
  datasets: ReadonlyArray<NswCkanDatasetSpec>;
  archiveRoot?: string;
  now: () => Date;
  runTargetedSearch: boolean;
}): Promise<CollectResult> {
  const raw: RawRecord[] = [];
  const deferred: DeferredResource[] = [];
  const queries: NswCkanQueryReport[] = [];
  const reports: CollectResult['reports'] = [];
  const warnings: string[] = [];

  if (options.runTargetedSearch) {
    for (const query of NSW_CKAN_TARGETED_QUERIES) {
      const result = (await options.client.json('package_search', {
        q: query.query,
        rows: 10,
      })) as Record<string, unknown>;
      const results = Array.isArray(result.results) ? result.results.filter(isObject) : [];
      queries.push({
        label: query.label,
        query: query.query,
        count: typeof result.count === 'number' ? result.count : results.length,
        top: results.slice(0, 5).map((entry) => ({
          name: asString(entry.name) ?? '',
          title: asString(entry.title) ?? '',
        })),
      });
    }
    warnings.push(
      `targeted CKAN searches: ${queries
        .map((query) => `${query.label}=${query.count}`)
        .join(', ')} (no full-portal harvest)`,
    );
  }

  for (const dataset of options.datasets) {
    const result = (await options.client.json('package_show', {
      id: dataset.packageName,
    })) as Record<string, unknown>;
    if (!isObject(result))
      throw new Error(`CKAN package_show ${dataset.packageName} returned no result`);
    const packageId = asString(result.id) ?? dataset.packageName;
    const packageName = asString(result.name) ?? dataset.packageName;
    const title = asString(result.title) ?? packageName;
    const datasetPage = `${options.datasetPageBase}/${packageName}`;
    const resources = Array.isArray(result.resources) ? result.resources.filter(isObject) : [];
    const datasetDeferred: DeferredResource[] = [];
    const resourceReports: NswCkanResourceReport[] = [];
    const selectedIds = new Set(dataset.resources.map((resource) => resource.id));
    let unselectedCount = 0;
    const unselectedFormats = new Set<string>();

    for (const resource of resources) {
      const resourceId = asString(resource.id);
      if (!resourceId) continue;
      const resourceName = asString(resource.name) ?? resourceId;
      const format = asString(resource.format) ?? '';
      const resourceUrl = asString(resource.url) ?? `${datasetPage}/resource/${resourceId}`;
      const spec = dataset.resources.find((entry) => entry.id === resourceId);
      const mode: NswCkanMode | null = spec
        ? spec.mode
        : isDeferredFormat(format)
          ? 'deferred'
          : null;

      if (!spec && mode === null) {
        if (!selectedIds.has(resourceId)) {
          unselectedCount += 1;
          unselectedFormats.add(format || 'unknown format');
        }
        continue;
      }

      const deferredReason =
        'Deferred: PDF/DOC/DOCX extraction belongs to the separate PDF foundation; not ingested in S2.';
      if (mode === 'deferred' || isDeferredFormat(format)) {
        const entry: DeferredResource = {
          package_id: packageId,
          package_name: packageName,
          dataset_title: title,
          resource_id: resourceId,
          name: resourceName,
          format: format || 'unknown',
          url: resourceUrl,
          reason: deferredReason,
        };
        deferred.push(entry);
        datasetDeferred.push(entry);
        continue;
      }
      if (mode === null) continue;

      if (mode === 'datastore') {
        if (resource.datastore_active !== true) {
          warnings.push(
            `${packageName}/${resourceId}: datastore_active is not true; resource skipped rather than guessed`,
          );
          continue;
        }
        const { records, total } = await datastoreSearchAll(options.client, resourceId);
        const archived = await archiveSourceDocument({
          source_id: CKAN_ID,
          title: `${title} — ${resourceName} (DataStore)`,
          original_url: `${datasetPage}/resource/${resourceId}`,
          retrieved_from: `${CKAN_API_BASE}/datastore_search?resource_id=${encodeURIComponent(resourceId)}`,
          archived_from: 'direct',
          filename: `${resourceId}-datastore.json`,
          content_type: 'application/json',
          data: `${JSON.stringify({ resource_id: resourceId, total, records }, null, 2)}\n`,
          root: options.archiveRoot,
          notes: `DataStore search of ${resourceName}; ${records.length}/${total} record(s) paged at limit ${CKAN_DATASTORE_PAGE_SIZE}.`,
        });
        await verifySourceDocument(archived);
        const sourceDate = resourceDate(resource, options.now());
        const resourceReport: NswCkanResourceReport = {
          package_id: packageId,
          package_name: packageName,
          dataset_title: title,
          dataset_page: datasetPage,
          resource_id: resourceId,
          resource_name: resourceName,
          resource_format: format || 'DataStore',
          mode: 'datastore',
          resource_url: `${datasetPage}/resource/${resourceId}`,
          source_date: sourceDate,
          source_rows: records.length,
          archive: {
            local_path: archived.local_path,
            sha256: archived.sha256,
            bytes: archived.bytes,
          },
        };
        resourceReports.push(resourceReport);
        const contextBase = {
          packageId,
          packageName,
          datasetTitle: title,
          datasetPage,
          resourceId,
          resourceName,
          resourceFormat: format || 'DataStore',
          resourceUrl: `${datasetPage}/resource/${resourceId}`,
          sourceDate,
          mode: 'datastore' as const,
          measureType: spec?.measureType ?? 'budget',
          measureTypeRationale: spec?.measureTypeRationale ?? 'no rationale supplied',
          labelColumns: spec?.labelColumns ?? [],
          entityColumns: spec?.entityColumns ?? [],
          lgaColumns: spec?.lgaColumns ?? [],
          ...(spec?.functionCode ? { functionCode: spec.functionCode } : {}),
          archive: {
            local_path: archived.local_path,
            sha256: archived.sha256,
            bytes: archived.bytes,
          },
          warnings: [] as string[],
        };
        const context = prepareTableContext(
          records.length > 0 ? Object.keys(records[0]!) : [],
          records,
          contextBase,
          spec ?? { id: resourceId, name: resourceName, mode: 'datastore' },
        );
        warnings.push(...context.warnings);
        for (const [index, row] of records.entries()) {
          raw.push({ kind: 'nsw-ckan-row', row, context, rowNumber: index + 1 });
        }
        continue;
      }

      // CSV / XLSX download + archive + parse.
      const downloaded = await options.client.download(resourceUrl);
      const filename = (() => {
        try {
          const name = path.basename(new URL(resourceUrl).pathname);
          if (/\.(?:csv|xlsx?)$/i.test(name)) return safeFilename(decodeURIComponent(name));
        } catch {
          // Fall through to a generated safe name.
        }
        return `${resourceId}.${mode === 'csv' ? 'csv' : 'xlsx'}`;
      })();
      const archived = await archiveSourceDocument({
        source_id: CKAN_ID,
        title: `${title} — ${resourceName}`,
        original_url: resourceUrl,
        retrieved_from: resourceUrl,
        archived_from: 'direct',
        filename,
        content_type: downloaded.contentType ?? undefined,
        data: downloaded.bytes,
        root: options.archiveRoot,
        notes: `Downloaded CKAN resource ${resourceId}; HTTP last-modified ${downloaded.lastModified ?? '(none)'}, etag ${downloaded.etag ?? '(none)'}.`,
      });
      await verifySourceDocument(archived);
      const sourceDate = resourceDate(resource, options.now());

      let rows: RawRecord[];
      let headers: string[];
      let cellFormats: Record<string, string> | undefined;
      let sheetName: string | undefined;
      if (mode === 'csv') {
        rows = parseCsvRows(downloaded.bytes);
        headers = rows.length > 0 ? Object.keys(rows[0]!) : [];
      } else {
        const table = await readXlsxTable(downloaded.bytes, spec?.sheetName, spec?.headerRow);
        rows = table.rows;
        headers = table.headers;
        cellFormats = table.cellFormats;
        sheetName = table.sheet;
      }

      const resourceReport: NswCkanResourceReport = {
        package_id: packageId,
        package_name: packageName,
        dataset_title: title,
        dataset_page: datasetPage,
        resource_id: resourceId,
        resource_name: resourceName,
        resource_format: format || (mode === 'csv' ? 'CSV' : 'XLSX'),
        mode,
        resource_url: resourceUrl,
        source_date: sourceDate,
        source_rows: rows.length,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
        },
      };
      resourceReports.push(resourceReport);

      const contextBase = {
        packageId,
        packageName,
        datasetTitle: title,
        datasetPage,
        resourceId,
        resourceName,
        resourceFormat: format || (mode === 'csv' ? 'CSV' : 'XLSX'),
        resourceUrl,
        sourceDate,
        mode,
        measureType: spec?.measureType ?? 'budget',
        measureTypeRationale: spec?.measureTypeRationale ?? 'no rationale supplied',
        labelColumns: spec?.labelColumns ?? [],
        entityColumns: spec?.entityColumns ?? [],
        lgaColumns: spec?.lgaColumns ?? [],
        ...(spec?.functionCode ? { functionCode: spec.functionCode } : {}),
        ...(cellFormats ? { cellFormats } : {}),
        ...(sheetName ? { sheetName } : {}),
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
        },
        warnings: [] as string[],
      };
      const context = prepareTableContext(
        headers,
        rows,
        contextBase,
        spec ?? { id: resourceId, name: resourceName, mode: mode as 'csv' | 'xlsx' },
      );
      warnings.push(...context.warnings);
      for (const [index, row] of rows.entries()) {
        raw.push({ kind: 'nsw-ckan-row', row, context, rowNumber: index + 1 });
      }
    }

    if (unselectedCount > 0) {
      warnings.push(
        `${packageName}: ${unselectedCount} resource(s) not selected (formats: ${[...unselectedFormats].join(', ')}); only CSV/XLSX/DataStore/PDF-DOCX resources are considered`,
      );
    }
    reports.push({
      dataset: { ...dataset, packageId, title },
      resources: resourceReports,
      deferred: datasetDeferred,
    });
  }

  return { raw, deferred, queries, reports, warnings };
}

function buildManifest(
  result: CollectResult,
  generatedAt: string,
  apiBase: string,
): NswCkanArchiveManifest {
  return {
    source_id: CKAN_ID,
    generated_at: generatedAt,
    api_base: apiBase,
    queries: result.queries,
    datasets: result.reports.map((report) => ({
      package_id: report.dataset.packageId,
      package_name: report.dataset.packageName,
      title: report.dataset.title,
      source_url: `${CKAN_DATASET_PAGE_BASE}/${report.dataset.packageName}`,
      query: report.dataset.query,
      resources: report.resources.map((resource) => ({
        ...resource,
        archive: {
          filename: path.basename(resource.archive.local_path),
          sha256: resource.archive.sha256,
          bytes: resource.archive.bytes,
        },
      })),
      deferred_resources: report.deferred,
    })),
    deferred_resources: result.deferred,
  };
}

/** Build the live connector. `fetch` performs discovery, archiving and paging. */
export function createNswCkanConnector(options: NswCkanConnectorOptions = {}): Connector {
  const apiBase = options.apiBase ?? CKAN_API_BASE;
  const datasetPageBase = options.datasetPageBase ?? CKAN_DATASET_PAGE_BASE;
  const delayMs = Math.max(0, options.delayMs ?? CKAN_DEFAULT_DELAY_MS);
  const maxRetries = Math.max(0, options.maxRetries ?? CKAN_DEFAULT_MAX_RETRIES);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => new Date());
  const datasets = options.datasets ?? NSW_CKAN_SELECTED_DATASETS;
  const runTargetedSearch = options.runTargetedSearch ?? true;
  const client = createCkanClient({ apiBase, delayMs, maxRetries, fetchImpl, sleep, now });

  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  const connector: Connector = {
    id: CKAN_ID,
    name: CKAN_NAME,
    publisher: CKAN_PUBLISHER,
    source_url: CKAN_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'state',
    license: CKAN_LICENSE,
    notes:
      'Targeted data.nsw.gov.au CKAN ingestion (selected budget/capital/expenditure datasets only; no full-portal harvest). CSV/XLSX downloads are archived with SHA-256; DataStore resources are paged and archived as JSON; PDF/DOCX resources are deferred and listed on this source. Every row is unverified and most NSW CKAN unit/measure mappings are provisional.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      const collected = await collectNswCkan({
        apiBase,
        datasetPageBase,
        client,
        datasets,
        archiveRoot: options.archiveRoot,
        now,
        runTargetedSearch,
      });
      connector.deferredResources = collected.deferred;
      metadata.warnings = collected.warnings;
      if (options.manifestPath) {
        const manifest = buildManifest(collected, now().toISOString(), apiBase);
        await mkdir(path.dirname(options.manifestPath), { recursive: true });
        await writeFile(options.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      }
      return collected.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      const rejectedRows: NswCkanRejection[] = [];
      const rejectedValues: NswCkanRejection[] = [];
      const warnings = [...(metadata.warnings ?? [])];
      const perResource = new Map<
        string,
        {
          sourceRows: number;
          rowsWithRecords: number;
          measures: number;
          duplicates: number;
          rejectedRows: number;
          rejectedValues: number;
        }
      >();
      const seen = new Set<string>();

      for (const entry of raw) {
        if (entry.kind !== 'nsw-ckan-row' || !isObject(entry.row) || !isObject(entry.context)) {
          rejectedRows.push({
            row: 0,
            column: null,
            reason: 'raw entry is not a prepared nsw-ckan row; skipped',
          });
          continue;
        }
        const row = entry.row as RawRecord;
        const context = entry.context as unknown as NswCkanTableContext;
        const rowNumber = typeof entry.rowNumber === 'number' ? entry.rowNumber : 0;
        const mapped = mapNswCkanRow(row, context, rowNumber);
        const stats = perResource.get(context.resourceId) ?? {
          sourceRows: 0,
          rowsWithRecords: 0,
          measures: 0,
          duplicates: 0,
          rejectedRows: 0,
          rejectedValues: 0,
        };
        stats.sourceRows += 1;
        if (mapped.records.length > 0) stats.rowsWithRecords += 1;
        stats.rejectedRows += mapped.rejectedRows.length;
        stats.rejectedValues += mapped.rejectedValues.length;
        rejectedRows.push(...mapped.rejectedRows);
        rejectedValues.push(...mapped.rejectedValues);
        for (const record of mapped.records) {
          if (seen.has(record.natural_key)) {
            stats.duplicates += 1;
            continue;
          }
          seen.add(record.natural_key);
          stats.measures += 1;
          records.push(record);
        }
        perResource.set(context.resourceId, stats);
      }

      for (const [resourceId, stats] of perResource) {
        warnings.push(
          `${resourceId}: source_rows=${stats.sourceRows}, rows_with_records=${stats.rowsWithRecords}, measures=${stats.measures}, duplicate_measures=${stats.duplicates}, rejected_rows=${stats.rejectedRows}, rejected_values=${stats.rejectedValues}`,
        );
      }
      if (rejectedRows.length > 0) {
        const sample = rejectedRows
          .slice(0, 5)
          .map((rejection) => `row ${rejection.row}: ${rejection.reason}`)
          .join('; ');
        warnings.push(
          `${rejectedRows.length} source row(s) rejected (${sample}${rejectedRows.length > 5 ? '; …' : ''})`,
        );
      }
      if (rejectedValues.length > 0) {
        const sample = rejectedValues
          .slice(0, 5)
          .map(
            (rejection) => `row ${rejection.row}/${rejection.column ?? '?'}: ${rejection.reason}`,
          )
          .join('; ');
        warnings.push(
          `${rejectedValues.length} amount value(s) rejected (${sample}${rejectedValues.length > 5 ? '; …' : ''})`,
        );
      }
      metadata.warnings = warnings;
      metadata.errors = [];
      return records;
    },
    metadata,
  };

  return connector;
}
