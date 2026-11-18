import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { parse } from 'csv-parse';
import type { SpendingRecord } from '@ausspend/shared';
import type { Connector, RawRecord } from './types.js';

/**
 * data.gov.au Portfolio Budget Statements (PBS) connector (F3).
 *
 * Source: CKAN at https://data.gov.au/data/api/3/action/ — public, read-only,
 * no API key. Each federal Budget publishes one Portfolio Budget Statements
 * package holding a machine-readable CSV of program-expense line items. The
 * connector calls `package_show` for every financial year, selects that year's
 * line-item CSV by name, and streams it: the small JSON call is followed by a
 * Windows-1252-decoded, streamed CSV parse so the file is never loaded as one
 * string.
 *
 * Historical coverage: FY2020-21 through FY2025-26. Each year keeps its own
 * CKAN dataset id, resource, fiscal-year label and amount column. FY2022-23 had
 * two published budgets (March and October); the October final budget is the
 * canonical package and the only one ingested, so a fiscal year is never
 * counted twice.
 *
 * Amount units: the published PBS program tables are in thousands of dollars
 * (`$'000`). The CSV has bare integers and no unit column; the source
 * document/table columns point at PBS tables whose columns are labelled
 * `$'000`. We therefore multiply by 1,000 to get dollars and 100 to get integer
 * cents. This is documented in FEDERAL_INGESTION.md.
 *
 * Caveat: the dataset description itself says the line items were prepared from
 * individual entity program tables and DO NOT sum to the Budget Paper 1
 * "Estimates of General Government Expenses" total. Every record carries that
 * caveat in `notes`; the API and UI must never present the PBS line-item sum as
 * the federal total.
 */

export const PBS_ID = 'data-gov-au-pbs';
export const PBS_NAME = 'Portfolio Budget Statements (data.gov.au)';
export const PBS_PUBLISHER = 'Australian Government Department of Finance';
export const PBS_API_BASE = 'https://data.gov.au/data/api/3/action';
/** Published PBS tables are in thousands of dollars. */
export const PBS_AMOUNT_UNIT_DOLLARS = 1_000;
export const PBS_DEFAULT_DELAY_MS = 500;
export const PBS_DEFAULT_MAX_RETRIES = 4;
export const PBS_USER_AGENT =
  'ausspend/0.1 (Australian government spending explorer; contact: ausspend-dev@example.invalid)';

export const PBS_CAVEAT =
  'PBS CSV line items are entity program tables; their sum does not equal the Budget Paper 1 total general government expense, so this figure is not the federal total.';

/** One published PBS budget package and the amount column for its fiscal year. */
export interface PbsYearConfig {
  /** Fiscal year the package budgets, e.g. `2021-22`. */
  fiscalYear: string;
  /** CKAN package/dataset id. */
  datasetId: string;
  /** Human-facing dataset title stored on every record. */
  datasetTitle: string;
  /** Exact published CSV resource name (used for selection and diagnostics). */
  resourceName: string;
  /** Column in the CSV holding the budget-year amount. */
  amountColumn: string;
}

/**
 * Historical PBS packages, oldest first. FY2022-23 deliberately uses the
 * October package: it is the final budget for that year and the March package
 * would otherwise duplicate the same fiscal year. Do not add the March dataset
 * here.
 */
export const PBS_YEARS: readonly PbsYearConfig[] = [
  {
    fiscalYear: '2020-21',
    datasetId: '86d7d307-92e2-48d9-b375-480685056673',
    datasetTitle: '2020-21 Portfolio Budget Statements (data.gov.au)',
    resourceName: '2020-21 PBS Program Expense Line Items csv',
    amountColumn: '2020-21',
  },
  {
    fiscalYear: '2021-22',
    datasetId: '98039365-ae78-4290-8d7c-eb0a4fcbd52b',
    datasetTitle: '2021-22 Portfolio Budget Statements (data.gov.au)',
    resourceName: '2021-22 PBS Program Expense Line Items.csv',
    amountColumn: '2021-22',
  },
  {
    fiscalYear: '2022-23',
    datasetId: '72594fbc-ef66-40f2-a8af-845372dc0f99',
    datasetTitle: '2022-23 Portfolio Budget Statements (data.gov.au, October)',
    resourceName: '2022-23 October Budget Program Expense Line Items',
    amountColumn: '2022-23',
  },
  {
    fiscalYear: '2023-24',
    datasetId: '9dc4136b-8daa-44a9-af0e-ace9dba41905',
    datasetTitle: '2023-24 Portfolio Budget Statements (data.gov.au)',
    resourceName: '2023-24 Budget Program Expense Line Items (CSV)',
    amountColumn: '2023-24',
  },
  {
    fiscalYear: '2024-25',
    datasetId: '6aeeefa5-65c4-45fb-bc7e-c8f33c7ffa44',
    datasetTitle: '2024-25 Portfolio Budget Statements (data.gov.au)',
    resourceName: '2024-25 PBS Program Expense Line Items.csv',
    amountColumn: '2024-25',
  },
  {
    fiscalYear: '2025-26',
    datasetId: '4f025f38-0c70-45e2-8106-4c29a5e48637',
    datasetTitle: '2025-26 Portfolio Budget Statements (data.gov.au)',
    resourceName: '2025-26 PBS Program Expenses Line Items',
    amountColumn: '2025-26',
  },
];

/** The current (latest) budget package. Kept for the existing single-year API. */
export const PBS_LATEST_YEAR = PBS_YEARS[PBS_YEARS.length - 1] as PbsYearConfig;
export const PBS_DATASET = PBS_LATEST_YEAR.datasetTitle;
export const PBS_DATASET_ID = PBS_LATEST_YEAR.datasetId;
export const PBS_DATASET_URL = datasetUrl(PBS_LATEST_YEAR.datasetId);
export const PBS_RESOURCE_NAME = PBS_LATEST_YEAR.resourceName;
export const PBS_FISCAL_YEAR = PBS_LATEST_YEAR.fiscalYear;
export const PBS_AMOUNT_COLUMN = PBS_LATEST_YEAR.amountColumn;

function datasetUrl(datasetId: string): string {
  return `https://data.gov.au/data/dataset/${datasetId}`;
}

/**
 * Conservative portfolio -> COFOG-A division map. Only portfolios with a single
 * defensible functional area are mapped. Mixed portfolios (for example
 * Infrastructure/Transport/Communications/Arts, or Climate/Energy/Environment)
 * are deliberately left unmapped and flagged provisional rather than guessed.
 */
export const PBS_COFOG_BY_PORTFOLIO: Readonly<Record<string, string>> = {
  "Attorney-General's": '03',
  'Agriculture, Fisheries and Forestry': '04',
  Defence: '02',
  Education: '09',
  'Employment and Workplace Relations': '04',
  Finance: '01',
  'Foreign Affairs and Trade': '01',
  'Health and Aged Care': '07',
  'Home Affairs': '03',
  'Industry, Science and Resources': '04',
  Parliament: '01',
  'Prime Minister and Cabinet': '01',
  'Social Services': '10',
  Treasury: '01',
  "Veterans' Affairs": '10',
};

export interface PbsResourceRef {
  id: string;
  name: string;
  /** Human-facing data.gov.au resource page. */
  pageUrl: string;
  /** Direct CSV download URL (kept in notes; pageUrl is the provenance URL). */
  downloadUrl: string;
  format: string;
  /** Resource release / last-modified date, ISO-8601 or date-only. */
  sourceDate: string;
  size: number | null;
}

export interface PbsSkip {
  row: number | null;
  reason: string;
}

export interface PbsTransformResult {
  records: SpendingRecord[];
  skipped: PbsSkip[];
  duplicates: number;
}

export interface PbsYearContext {
  config: PbsYearConfig;
  resource: PbsResourceRef;
}

export interface PbsConnectorOptions {
  apiBase?: string;
  /** Override the published year set (tests use a single year). */
  years?: readonly PbsYearConfig[];
  /** Polite delay between API/download calls (and retries). */
  delayMs?: number;
  maxRetries?: number;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests; defaults to `new Date()`. */
  now?: () => Date;
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

/** Collapse whitespace (including the NBSPs present in the CSV) for stable keys/text. */
function normaliseText(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const collapsed = raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return collapsed.length > 0 ? collapsed : null;
}

function releaseDateOf(resource: Record<string, unknown>): string {
  const modified = asString(resource.last_modified) ?? asString(resource.metadata_modified);
  const created = asString(resource.created);
  const value = modified ?? created ?? '';
  // Keep the date part for provenance; fall back to the full timestamp only if
  // the source does not look like ISO-8601.
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? value;
}

/**
 * Select the machine-readable PBS line-item CSV from a CKAN `result` for a
 * given fiscal year. Resource names are not stable across years ("Program
 * Expense" vs "Program Expenses", "Budget" vs "PBS", with or without a year
 * suffix), so the score combines strong name signals with the exact published
 * name and the year itself.
 */
export function selectPbsResource(
  packageResult: unknown,
  config: PbsYearConfig = PBS_LATEST_YEAR,
): PbsResourceRef {
  if (!isObject(packageResult)) {
    throw new Error('CKAN package_show result is not an object');
  }
  const resources = packageResult.resources;
  if (!Array.isArray(resources)) {
    throw new Error('CKAN package_show result has no resources array');
  }

  const candidates = resources.filter(isObject).map((resource) => {
    const name = asString(resource.name) ?? '';
    const format = (asString(resource.format) ?? '').toLowerCase();
    const url = asString(resource.url) ?? '';
    const description = asString(resource.description) ?? '';
    const looksCsv =
      format === 'csv' ||
      format === '.csv' ||
      format === 'text/csv' ||
      /\.csv(\?|$)/i.test(url) ||
      /\.csv$/i.test(name);
    let score = 0;
    if (name === config.resourceName) score += 100;
    if (name.includes(config.fiscalYear)) score += 30;
    if (/program\s+expense/i.test(name)) score += 40;
    if (/line\s+item/i.test(name)) score += 30;
    if (/program\s+expense/i.test(description)) score += 10;
    if (/pbs/i.test(name)) score += 10;
    return { resource, looksCsv, score, name, url };
  });

  const matches = candidates
    .filter((candidate) => candidate.looksCsv && candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aDate = releaseDateOf(a.resource);
      const bDate = releaseDateOf(b.resource);
      return bDate.localeCompare(aDate);
    });

  const chosen = matches[0];
  if (!chosen) {
    throw new Error(
      `CKAN dataset ${config.datasetId} has no CSV resource matching "${config.resourceName}" (${config.fiscalYear})`,
    );
  }

  const id = asString(chosen.resource.id);
  if (!id) throw new Error('Selected PBS CSV resource has no id');
  const size = chosen.resource.size;
  return {
    id,
    name: chosen.name,
    pageUrl: `${datasetUrl(config.datasetId)}/resource/${id}`,
    downloadUrl: chosen.url,
    format: chosen.resource.format ? String(chosen.resource.format) : 'CSV',
    sourceDate: releaseDateOf(chosen.resource),
    size: typeof size === 'number' && Number.isFinite(size) ? size : null,
  };
}

/**
 * PBS amounts are published in thousands of dollars. Convert to non-negative
 * integer cents; return null for `nfp`, blank or invalid values so the caller
 * skips the row instead of inventing a figure.
 */
export function pbsAmountToCents(value: unknown): number | null {
  const text = asString(value);
  if (!text) return null;
  const normalised = text.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
  const dollars = Number(normalised) * PBS_AMOUNT_UNIT_DOLLARS;
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  const cents = Math.round(dollars * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return cents;
}

/** Stable hash of a source row; duplicate identical rows get an occurrence suffix. */
export function pbsRowHash(row: RawRecord, occurrence = 0): string {
  const keys = Object.keys(row).sort();
  const canonical = keys
    .map((key) => `${key}\u001f${normaliseText(row[key]) ?? ''}`)
    .join('\u001e');
  const hash = createHash('sha256').update(canonical).digest('hex').slice(0, 32);
  return occurrence > 0 ? `${hash}-${occurrence}` : hash;
}

export function pbsCofogForPortfolio(portfolio: string | null): string | null {
  if (!portfolio) return null;
  return PBS_COFOG_BY_PORTFOLIO[portfolio] ?? null;
}

export interface PbsMappingContext extends PbsYearContext {
  occurrence?: number;
  /** 1-based data row number, used only for skip diagnostics. */
  rowNumber?: number;
}

export interface PbsMappedRow {
  record: SpendingRecord | null;
  skip: PbsSkip | null;
}

/** First non-empty value among the accepted header spellings. */
function readField(row: RawRecord, ...names: string[]): string | null {
  for (const name of names) {
    const value = normaliseText(row[name]);
    if (value !== null) return value;
  }
  return null;
}

/** Map one PBS CSV row to a budget measure. Pure and fixture-testable. */
export function mapPbsRow(row: RawRecord, context: PbsMappingContext): PbsMappedRow {
  const rowNumber = context.rowNumber ?? null;
  const { config, resource } = context;
  const portfolio = normaliseText(row.Portfolio);
  const agency = normaliseText(row['Department/Agency']);
  const outcome = normaliseText(row.Outcome);
  const program = normaliseText(row.Program);
  const expenseType = readField(row, 'Expense_type', 'Expense type');
  const appropriationType = readField(row, 'Appropriation_type', 'Appropriation type');
  const sourceDocument = readField(row, 'Source_document', 'Source document');
  const sourceTable = readField(row, 'Source_table', 'Source table');
  const rawAmount = row[config.amountColumn];

  const amountCents = pbsAmountToCents(rawAmount);
  if (amountCents === null) {
    return {
      record: null,
      skip: {
        row: rowNumber,
        reason: `${config.amountColumn} is not a usable amount (${String(rawAmount ?? 'missing')}); skipped`,
      },
    };
  }

  if (!portfolio || !agency || !program) {
    return {
      record: null,
      skip: {
        row: rowNumber,
        reason: 'Portfolio, Department/Agency or Program is missing; skipped',
      },
    };
  }

  const functionCode = pbsCofogForPortfolio(portfolio);
  const dataQualityFlag = functionCode ? 'statewide_only' : 'provisional';
  const naturalKey = `${config.datasetId}:${pbsRowHash(row, context.occurrence ?? 0)}`;

  const noteParts = [
    `PBS line item: ${expenseType ?? 'expense'}`,
    appropriationType ? `appropriation: ${appropriationType}` : null,
    sourceDocument ? `source: ${sourceDocument}` : null,
    sourceTable ? `table: ${sourceTable}` : null,
    `amount column ${config.amountColumn} in $'000 (x1000 to dollars, x100 to cents)`,
    `CSV: ${resource.downloadUrl}`,
    PBS_CAVEAT,
  ].filter((part): part is string => Boolean(part));

  const record: SpendingRecord = {
    amount_cents: amountCents,
    measure_type: 'budget',
    fiscal_year: config.fiscalYear,
    source_id: PBS_ID,
    source_url: resource.pageUrl,
    verified: false,
    natural_key: naturalKey,
    jurisdiction_level: 'federal',
    jurisdiction: 'Commonwealth',
    source_dataset: config.datasetTitle,
    source_date: resource.sourceDate,
    data_quality_flag: dataQualityFlag,
    project_name: program,
    ...(outcome ? { description: outcome } : {}),
    delivery_entity: agency,
    funding_source: portfolio,
    location: { state: 'Commonwealth' },
    notes: noteParts.join('; '),
    ...(functionCode ? { function_code: functionCode } : {}),
  };

  return { record, skip: null };
}

/** Map a fetched batch, de-duplicating exact duplicate source rows by occurrence. */
export function transformPbsRows(
  rows: readonly RawRecord[],
  context: PbsYearContext,
): PbsTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: PbsSkip[] = [];
  const seen = new Map<string, number>();
  let duplicates = 0;

  rows.forEach((row, index) => {
    const baseHash = pbsRowHash(row, 0);
    const occurrence = seen.get(baseHash) ?? 0;
    seen.set(baseHash, occurrence + 1);
    if (occurrence > 0) duplicates += 1;

    const { record, skip } = mapPbsRow(row, {
      ...context,
      occurrence,
      rowNumber: index + 1,
    });
    if (record) records.push(record);
    else if (skip) skipped.push(skip);
  });

  return { records, skipped, duplicates };
}

/** True when this parsed CSV row is the table header rather than data. */
function isHeaderRow(cells: readonly string[]): boolean {
  let hasPortfolio = false;
  let hasProgram = false;
  for (const cell of cells) {
    const value = cell.trim().toLowerCase();
    if (value === 'portfolio') hasPortfolio = true;
    if (value === 'program') hasProgram = true;
  }
  return hasPortfolio && hasProgram;
}

/**
 * Stream-decode (Windows-1252) and stream-parse the CSV. Chunks may split
 * quoted fields; csv-parse buffers them correctly and no full-file string is
 * constructed.
 *
 * Some published PBS CSVs (FY2022-23 and FY2023-24) begin with a few rows of
 * empty comma-delimited cells before the real header. Parsing as arrays and
 * locating the first `Portfolio`/`Program` header handles that without
 * hard-coding a row offset.
 */
function windows1252Decoder(): Transform {
  const decoder = new TextDecoder('windows-1252');
  return new Transform({
    transform(chunk: Buffer | Uint8Array, _encoding, callback) {
      try {
        callback(null, decoder.decode(chunk, { stream: true }));
      } catch (error) {
        callback(error as Error);
      }
    },
    flush(callback) {
      try {
        callback(null, decoder.decode());
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}

export async function parsePbsCsvStream(
  source: AsyncIterable<Uint8Array | Buffer>,
): Promise<RawRecord[]> {
  const input = Readable.from(source as AsyncIterable<Uint8Array>);
  const decoded = input.pipe(windows1252Decoder());
  const parser = decoded.pipe(
    parse({
      bom: true,
      columns: false,
      skip_empty_lines: true,
      relax_column_count: false,
    }),
  );

  const cells: string[][] = [];
  for await (const record of parser) {
    if (Array.isArray(record)) cells.push(record.map((cell) => String(cell ?? '')));
  }

  const headerIndex = cells.findIndex(isHeaderRow);
  if (headerIndex === -1) return [];
  const header = cells[headerIndex]!.map((cell) => cell.trim());

  const rows: RawRecord[] = [];
  for (let index = headerIndex + 1; index < cells.length; index += 1) {
    const rowCells = cells[index]!;
    if (rowCells.every((cell) => cell.trim().length === 0)) continue;
    if (isHeaderRow(rowCells)) continue;
    const row: RawRecord = {};
    header.forEach((key, column) => {
      if (key.length > 0) row[key] = rowCells[column] ?? '';
    });
    rows.push(row);
  }
  return rows;
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

/** Non-enumerable tag linking a raw row to the year package it came from. */
const PBS_ROW_YEAR = Symbol('ausspend.pbs.rowYear');

function tagRowYear(row: RawRecord, config: PbsYearConfig): void {
  Object.defineProperty(row, PBS_ROW_YEAR, {
    value: config,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

function rowYear(row: RawRecord): PbsYearConfig | null {
  const value = (row as Record<PropertyKey, unknown>)[PBS_ROW_YEAR];
  return isObject(value) && typeof value.fiscalYear === 'string'
    ? (value as unknown as PbsYearConfig)
    : null;
}

/**
 * Live PBS connector. `fetch` calls `package_show` and streams each year's CSV;
 * `transform` maps every batch with that year's fiscal year and amount column.
 * A package that cannot be read is recorded as a year-specific gap and the
 * remaining years still ingest. If no year can be read at all, the connector
 * rejects so the runner logs an error rather than a silent empty success.
 */
export function createPbsConnector(options: PbsConnectorOptions = {}): Connector {
  const apiBase = options.apiBase ?? PBS_API_BASE;
  const years = options.years ?? PBS_YEARS;
  const delayMs = Math.max(0, options.delayMs ?? PBS_DEFAULT_DELAY_MS);
  const maxRetries = Math.max(0, options.maxRetries ?? PBS_DEFAULT_MAX_RETRIES);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => new Date());

  /** Resource refs resolved during fetch, keyed by fiscal year. */
  const resolved = new Map<string, PbsYearContext>();
  /** Year fetch failures to surface on the run (partial, not silent). */
  let fetchErrors: string[] = [];
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  async function request(url: string, accept: string): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      if (typeof fetchImpl !== 'function') {
        throw new Error('PBS fetch is unavailable: no fetch implementation');
      }
      const response = await fetchImpl(url, {
        headers: { Accept: accept, 'User-Agent': PBS_USER_AGENT },
      });
      if (response.status !== 429) {
        if (!response.ok) throw new Error(`PBS HTTP ${response.status} for ${url}`);
        return response;
      }
      if (attempt >= maxRetries) {
        throw new Error(`PBS rate limited (429) after ${maxRetries} retries`);
      }
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'), now());
      await sleep(retryAfter ?? Math.min(1_000 * 2 ** attempt, 30_000));
    }
  }

  async function fetchYear(config: PbsYearConfig): Promise<RawRecord[]> {
    const packageUrl = `${apiBase}/package_show?id=${encodeURIComponent(config.datasetId)}`;
    const response = await request(packageUrl, 'application/json');
    const body: unknown = await response.json();
    if (!isObject(body) || body.success === false) {
      throw new Error('CKAN package_show returned success:false');
    }
    const resource = selectPbsResource(body.result, config);
    resolved.set(config.fiscalYear, { config, resource });
    await sleep(delayMs);
    const csvResponse = await request(resource.downloadUrl, 'text/csv');
    if (!csvResponse.body) throw new Error('PBS CSV response has no body');
    const stream = Readable.fromWeb(csvResponse.body as Parameters<typeof Readable.fromWeb>[0]);
    const rows = await parsePbsCsvStream(stream as AsyncIterable<Uint8Array>);
    for (const row of rows) tagRowYear(row, config);
    return rows;
  }

  async function fetchRows(): Promise<RawRecord[]> {
    const all: RawRecord[] = [];
    const failures: Array<{ fiscalYear: string; message: string }> = [];
    for (const config of years) {
      try {
        all.push(...(await fetchYear(config)));
      } catch (error) {
        failures.push({
          fiscalYear: config.fiscalYear,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (failures.length > 0 && all.length === 0) {
      // Nothing was read: surface the first concrete failure (unprefixed) so
      // the runner records an error status instead of an empty success.
      throw new Error(failures[0]!.message);
    }
    fetchErrors = failures.map((failure) => `${failure.fiscalYear}: ${failure.message}`);
    return all;
  }

  return {
    id: PBS_ID,
    name: PBS_NAME,
    publisher: PBS_PUBLISHER,
    source_url: PBS_DATASET_URL,
    status: 'active',
    jurisdiction_level: 'federal',
    async fetch(): Promise<RawRecord[]> {
      return fetchRows();
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const groups = new Map<string, { context: PbsYearContext; rows: RawRecord[] }>();
      const errors: string[] = [...fetchErrors];

      for (const row of raw) {
        const config = rowYear(row);
        const context = config ? resolved.get(config.fiscalYear) : undefined;
        if (!context) {
          errors.push('PBS row has no resolved fiscal-year package; skipped');
          continue;
        }
        const group = groups.get(config!.fiscalYear) ?? { context, rows: [] };
        group.rows.push(row);
        groups.set(config!.fiscalYear, group);
      }

      const records: SpendingRecord[] = [];
      const warnings: string[] = [];
      for (const { context, rows } of groups.values()) {
        const result = transformPbsRows(rows, context);
        records.push(...result.records);
        if (result.skipped.length > 0) {
          const reasons = result.skipped
            .slice(0, 5)
            .map((skip) => `row ${skip.row ?? '?'}: ${skip.reason}`)
            .join('; ');
          warnings.push(
            `${context.config.fiscalYear}: ${result.skipped.length} PBS row(s) skipped (${reasons})`,
          );
        }
        if (result.duplicates > 0) {
          warnings.push(
            `${context.config.fiscalYear}: ${result.duplicates} duplicate PBS source row(s) kept with occurrence keys`,
          );
        }
      }

      // Skips are expected data-quality outcomes (nfp/negative rows), not a
      // source failure, so they are warnings and leave the source active. A
      // year that could not be fetched is an error and marks the run partial.
      metadata.warnings = warnings;
      metadata.errors = errors;
      return records;
    },
    metadata,
  };
}
