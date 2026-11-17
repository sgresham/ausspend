import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Transform } from 'node:stream';
import { parse as parseStream } from 'csv-parse';
import { parse as parseSync } from 'csv-parse/sync';
import type { SpendingRecord } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * Queensland Government Investment Portal (QGIP) expenditure connector
 * (Phase 4, QLD only — distinct from the `qld-budget` BP3/BP4 source).
 *
 * One keyless data.qld CKAN CSV is ingested: the latest annual consolidated
 * QGIP expenditure file. Discovery goes through `package_search`, then
 * `package_show` on the consolidated-view package. The exact CSV and the
 * official data-dictionary PDF are SHA-256 archived outside the repo.
 *
 * Units are NOT inferred from magnitude: the QGIP data dictionary says
 * "Financial year expenditure ... Figures should be entered without
 * punctuation e.g. enter 150500 not $150,500" — whole Australian dollars.
 * 1 dollar = 100 cents.
 *
 * Grant vs contract is taken from the mandatory `Assistance type1` column,
 * whose only five published values are Grant, Frontline service procurement,
 * Concession, Loan and Direct government investment. Only the first two are in
 * scope for this connector:
 *   - Grant                      -> measure_type "grant_award"
 *   - Frontline service procurement -> measure_type "contract"
 * Concession, Loan and Direct government investment are NOT grants and NOT
 * procured frontline services; they are rejected rather than relabelled.
 *
 * Grants and contracts are never summed into one QLD total. They are separate
 * measure types; the shared summary marks a mixed result (mixed=true, total
 * null) whenever more than one additive type is present.
 *
 * Location: `Statewide=Yes` -> statewide_only (no sub-state location). Otherwise
 * the service-delivery postcode/suburb/LGA is recorded, with the published
 * sentinels 1111 (multiple LGAs), 1001 (not applicable/privacy) and 1234
 * (interstate) treated as "no fixed location" and flagged approximate. No
 * coordinate is parsed, averaged or invented.
 */

export const QGIP_ID = 'qld-qgip';
export const QGIP_NAME = 'Queensland Government Investment Portal (QGIP) — Expenditure';
export const QGIP_PUBLISHER = 'Queensland Treasury';
export const QGIP_DATASET = 'Queensland Government Investment Portal (QGIP) — Expenditure';
export const QGIP_FISCAL_YEAR = '2024-25';
export const QGIP_CKAN_API_BASE = 'https://www.data.qld.gov.au/api/3/action';
export const QGIP_DATASET_ID = 'b102c881-2c7f-484a-a8b6-b056fe318964';
export const QGIP_PACKAGE_NAME =
  'queensland-government-investment-portal-expenditure-data-consolidated-view';
export const QGIP_RESOURCE_ID = '1c1786e3-16b7-4fc0-ac3f-4d9314e59bdf';
export const QGIP_DICTIONARY_ID = '80e06969-7193-4b94-a425-f52e27ece371';
export const QGIP_SOURCE_URL =
  'https://www.data.qld.gov.au/dataset/queensland-government-investment-portal-expenditure-data-consolidated-view';
export const QGIP_LICENSE = 'CC BY 4.0';
export const QGIP_ATTRIBUTION = '© State of Queensland (Queensland Treasury), 2025';
export const QGIP_UNIT = 'AUD dollars';
export const QGIP_UNIT_TO_CENTS = 100;
export const QGIP_API_DELAY_MS = 500;
export const QGIP_MAX_CONCURRENT_DOWNLOADS = 2;

/** Discovery queries used to confirm the consolidated QGIP package. */
export const QGIP_SEARCH_QUERIES = [
  'QGIP expenditure',
  'grants and procured frontline services',
  'Queensland Government Investment Portal',
] as const;

export const QGIP_GRANT_ASSISTANCE = 'Grant';
export const QGIP_CONTRACT_ASSISTANCE = 'Frontline service procurement';
export const QGIP_OUT_OF_SCOPE_ASSISTANCE = [
  'Concession',
  'Loan',
  'Direct government investment',
] as const;

/** Postcode sentinels defined by the dictionary. */
export const QGIP_SENTINEL_POSTCODES = {
  '1111': 'multiple LGAs / program-level consolidation',
  '1001': 'not applicable / privacy',
  '1234': 'interstate / outside Queensland',
} as const;

/** Header order of the 2024-25 consolidated CSV (29 columns). */
export const QGIP_COLUMNS = [
  'Australian Business Number (ABN)',
  'Legal entity name',
  'Service provider name',
  'Legal entity postcode',
  'Legal entity suburb/locality',
  'Legal entity LGA',
  'Service delivery postcode',
  'Service delivery suburb/locality',
  'Service delivery LGA',
  'Longitude',
  'Latitude',
  'Funding agency',
  'Program title',
  'Sub-program title',
  'Statewide',
  'Purpose',
  'Category1',
  'Recipient type',
  'Client group1',
  'Assistance type1',
  'Business specific activity',
  'Funding source',
  'Funding use',
  'Financial year expenditure',
  'Funding agreement duration',
  'Funding agreement start',
  'Funding agreement end',
  'Total funding under this agreement to date',
  'Total funding under this agreement notes',
] as const;

export interface QgipResource {
  dataset_id: string;
  package_name: string;
  dataset_title: string;
  metadata_modified: string;
  resource_id: string;
  name: string;
  format: string;
  url: string;
  filename: string;
  year: number;
}

export interface QgipSourceSelection {
  annual: QgipResource;
  /** All annual expenditure resources considered, newest first. */
  annualResources: QgipResource[];
  dictionary: QgipResource;
}

export interface QgipSourceMeta {
  resource_id: string;
  resource_name: string;
  filename: string;
  url: string;
  source_sha256: string;
  source_date: string;
}

export interface QgipRaw extends Record<string, unknown> {
  kind: 'qgip';
  resource_id: string;
  resource_name: string;
  filename: string;
  url: string;
  source_sha256: string;
  source_date: string;
  /** 1-based data-row number (header is not counted). */
  row: number;
  row_hash: string;
  abn: string | null;
  legal_entity: string;
  service_provider: string | null;
  service_postcode: string | null;
  service_suburb: string | null;
  service_lga: string | null;
  funding_agency: string;
  program_title: string | null;
  sub_program_title: string | null;
  purpose: string | null;
  category: string | null;
  recipient_type: string | null;
  assistance_type: string;
  funding_source: string;
  funding_use: string | null;
  statewide: string | null;
  duration: string | null;
  start_date: string | null;
  end_date: string | null;
  total_to_date: string | null;
  total_notes: string | null;
  amount_dollars: number;
  unit: typeof QGIP_UNIT;
}

export interface QgipSkip {
  filename: string;
  row: number | null;
  reason: string;
}

export interface QgipTransformResult {
  records: SpendingRecord[];
  skipped: QgipSkip[];
  duplicates: number;
}

export interface QgipConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  /** Delay between CKAN API calls; defaults to 500ms, set 0 in tests. */
  apiDelayMs?: number;
  /** Injected for unit tests; defaults to a cp1252 stream reader. */
  readCsv?: (filePath: string) => Promise<string>;
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!trimmed || /^n\/?a$/i.test(trimmed)) return null;
  return trimmed;
}

/** Parse a whole-dollar amount ("150000" / "150,000.5"). Returns null if unusable. */
export function qgipNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[$,\s]/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Convert a dictionary-confirmed whole-dollar amount to integer cents.
 * Non-positive values are rejected: a zero/negative figure is not expenditure.
 */
export function qgipAmountToCents(value: unknown): number | null {
  const numeric = qgipNumber(value);
  if (numeric === null || numeric <= 0) return null;
  const cents = Math.round(numeric * QGIP_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

/** Case/space-insensitive access to a CSV row's columns. */
function column(row: Record<string, string>, name: string): string | null {
  const wanted = name.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const [key, value] of Object.entries(row)) {
    if (key.trim().replace(/\s+/g, ' ').toLowerCase() === wanted) return value;
  }
  return null;
}

function cleanColumn(row: Record<string, string>, name: string): string | null {
  return text(column(row, name));
}

/**
 * Stable hash of one source row. The 1-based data-row number is included so
 * genuinely repeated identical payments are preserved as separate rows instead
 * of being silently collapsed; idempotency holds for a fixed resource file.
 */
export function qgipRowHash(row: Record<string, string>, rowNumber: number): string {
  const cells = QGIP_COLUMNS.map((name) => column(row, name) ?? '');
  return sha256([String(rowNumber), ...cells].join('\u001f'));
}

export function qgipNaturalKey(parts: readonly (string | number | null | undefined)[]): string {
  return `qld-qgip:${sha256(parts.map((part) => String(part ?? '')).join('\u001f')).slice(0, 40)}`;
}

/** Map an `Assistance type1` value to a measure type, or null if out of scope. */
export function qgipMeasureType(assistanceType: string): 'grant_award' | 'contract' | null {
  const value = assistanceType.trim();
  if (value === QGIP_GRANT_ASSISTANCE) return 'grant_award';
  if (value === QGIP_CONTRACT_ASSISTANCE) return 'contract';
  return null;
}

function resourceFilename(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
  } catch {
    return url.split('/').pop() ?? 'resource.csv';
  }
}

interface CkanResource {
  id: string;
  name: string;
  format: string;
  url: string;
  metadata_modified?: string;
  last_modified?: string;
}

interface CkanPackage {
  id: string;
  name: string;
  title: string;
  metadata_modified?: string;
  resources: CkanResource[];
}

interface CkanSearchResult {
  name: string;
  title?: string;
}

async function ckanGet<T>(
  action: string,
  params: string,
  fetchImpl: typeof fetch,
  delayMs: number,
): Promise<T> {
  await sleep(delayMs);
  const response = await fetchImpl(`${QGIP_CKAN_API_BASE}/${action}?${params}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`data.qld ${action} HTTP ${response.status}`);
  const body = (await response.json()) as { success?: boolean; result?: T };
  if (!body.success || body.result === undefined)
    throw new Error(`data.qld ${action} failed for ${params}`);
  return body.result;
}

/** Parse the financial year start from an annual resource name (2024-25 -> 2024). */
export function qgipResourceYear(name: string): number | null {
  const match = /(\d{4})\s*[-–]\s*\d{2}/.exec(name);
  return match?.[1] ? Number(match[1]) : null;
}

function toResource(pkg: CkanPackage, resource: CkanResource): QgipResource {
  const year = qgipResourceYear(resource.name) ?? 0;
  return {
    dataset_id: pkg.id,
    package_name: pkg.name,
    dataset_title: pkg.title,
    metadata_modified: (pkg.metadata_modified ?? '').slice(0, 10),
    resource_id: resource.id,
    name: resource.name,
    format: resource.format,
    url: resource.url,
    filename: resourceFilename(resource.url),
    year,
  };
}

/**
 * Choose the latest annual consolidated expenditure CSV from a package's
 * resources. Only CSV resources whose name carries a financial year and the
 * word "expenditure" qualify; program-funding and non-annual files are ignored.
 */
export function selectLatestAnnualResource(pkg: CkanPackage): {
  annual: QgipResource;
  annualResources: QgipResource[];
} {
  const candidates = pkg.resources
    .filter((resource) => /csv/i.test(resource.format))
    .filter((resource) => /expenditure/i.test(resource.name))
    .map((resource) => toResource(pkg, resource))
    .filter((resource) => resource.year > 0)
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      const am = a.metadata_modified.localeCompare(b.metadata_modified);
      return am !== 0 ? -am : a.resource_id.localeCompare(b.resource_id);
    });
  const latest = candidates[0];
  if (!latest) throw new Error(`data.qld package ${pkg.name} has no annual expenditure CSV`);
  return { annual: latest, annualResources: candidates };
}

function selectDictionary(pkg: CkanPackage): QgipResource {
  const resource = pkg.resources.find(
    (entry) => entry.id === QGIP_DICTIONARY_ID || /data dictionary/i.test(entry.name),
  );
  if (!resource)
    throw new Error(`data.qld package ${pkg.name} is missing the QGIP data dictionary`);
  return toResource(pkg, resource);
}

/**
 * Discover the latest annual expenditure CSV. The three required
 * `package_search` queries are run first (500ms apart) to confirm the package
 * is discoverable, then `package_show` lists its resources.
 */
export async function discoverQgipSource(
  fetchImpl: typeof fetch = fetch,
  delayMs: number = QGIP_API_DELAY_MS,
): Promise<QgipSourceSelection> {
  const found: string[] = [];
  for (const query of QGIP_SEARCH_QUERIES) {
    const result = await ckanGet<{ results?: CkanSearchResult[] }>(
      'package_search',
      `q=${encodeURIComponent(query)}&rows=50`,
      fetchImpl,
      delayMs,
    );
    for (const entry of result.results ?? []) found.push(entry.name);
  }
  if (
    !found.includes(QGIP_PACKAGE_NAME) &&
    !found.some((name) => /investment-portal/i.test(name))
  ) {
    throw new Error(
      `data.qld package_search did not return the QGIP consolidated package ${QGIP_PACKAGE_NAME}`,
    );
  }

  const pkg = await ckanGet<CkanPackage>(
    'package_show',
    `id=${encodeURIComponent(QGIP_DATASET_ID)}`,
    fetchImpl,
    delayMs,
  );
  if (pkg.name !== QGIP_PACKAGE_NAME) {
    throw new Error(`data.qld package_show returned ${pkg.name}, expected ${QGIP_PACKAGE_NAME}`);
  }
  const { annual, annualResources } = selectLatestAnnualResource(pkg);
  return { annual, annualResources, dictionary: selectDictionary(pkg) };
}

/** cp1252 specials for bytes 0x80-0x9F (Node has no cp1252 decoder). */
const CP1252_SPECIALS: Record<number, string> = {
  0x80: '€',
  0x82: '‚',
  0x83: 'ƒ',
  0x84: '„',
  0x85: '…',
  0x86: '†',
  0x87: '‡',
  0x88: 'ˆ',
  0x89: '‰',
  0x8a: 'Š',
  0x8b: '‹',
  0x8c: 'Œ',
  0x8e: 'Ž',
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x95: '•',
  0x96: '–',
  0x97: '—',
  0x98: '˜',
  0x99: '™',
  0x9a: 'š',
  0x9b: '›',
  0x9c: 'œ',
  0x9e: 'ž',
  0x9f: 'Ÿ',
};

/** Decode cp1252 bytes (the QGIP CSVs are not UTF-8). */
export function decodeCp1252(input: Buffer): string {
  return input
    .toString('latin1')
    .replace(/[\u0080-\u009f]/g, (char) => CP1252_SPECIALS[char.charCodeAt(0)] ?? char);
}

/**
 * Build a raw QGIP row from one parsed CSV record. Returns null only when the
 * mandatory `Assistance type1` or `Financial year expenditure` cells are
 * missing entirely (the row is still counted by the caller).
 */
export function mapQgipRawRow(
  row: Record<string, string>,
  meta: QgipSourceMeta,
  rowNumber: number,
): QgipRaw | null {
  const assistance = cleanColumn(row, 'Assistance type1');
  const amountRaw = qgipNumber(column(row, 'Financial year expenditure'));
  if (!assistance || amountRaw === null) return null;
  const legalEntity = cleanColumn(row, 'Legal entity name');
  const serviceProvider = cleanColumn(row, 'Service provider name');
  const agency = cleanColumn(row, 'Funding agency');
  const program = cleanColumn(row, 'Program title');
  return {
    kind: 'qgip',
    ...meta,
    row: rowNumber,
    row_hash: qgipRowHash(row, rowNumber),
    abn: cleanColumn(row, 'Australian Business Number (ABN)'),
    legal_entity: legalEntity ?? serviceProvider ?? '',
    service_provider: serviceProvider,
    service_postcode: cleanColumn(row, 'Service delivery postcode'),
    service_suburb: cleanColumn(row, 'Service delivery suburb/locality'),
    service_lga: cleanColumn(row, 'Service delivery LGA'),
    funding_agency: agency ?? '',
    program_title: program,
    sub_program_title: cleanColumn(row, 'Sub-program title'),
    purpose: cleanColumn(row, 'Purpose'),
    category: cleanColumn(row, 'Category1'),
    recipient_type: cleanColumn(row, 'Recipient type'),
    assistance_type: assistance,
    funding_source: cleanColumn(row, 'Funding source') ?? '',
    funding_use: cleanColumn(row, 'Funding use'),
    statewide: cleanColumn(row, 'Statewide'),
    duration: cleanColumn(row, 'Funding agreement duration'),
    start_date: cleanColumn(row, 'Funding agreement start'),
    end_date: cleanColumn(row, 'Funding agreement end'),
    total_to_date: cleanColumn(row, 'Total funding under this agreement to date'),
    total_notes: cleanColumn(row, 'Total funding under this agreement notes'),
    amount_dollars: amountRaw,
    unit: QGIP_UNIT,
  };
}

function rowsToRaw(
  rows: Array<Record<string, string>>,
  meta: QgipSourceMeta,
): { raw: QgipRaw[]; totalRows: number } {
  const raw: QgipRaw[] = [];
  rows.forEach((row, index) => {
    const mapped = mapQgipRawRow(row, meta, index + 1);
    if (mapped) raw.push(mapped);
  });
  return { raw, totalRows: rows.length };
}

/** Parse a fixture CSV string (sync) into raw rows. */
export function parseQgipCsv(
  csv: string,
  meta: QgipSourceMeta,
): { raw: QgipRaw[]; totalRows: number } {
  const rows = parseSync(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>;
  return rowsToRaw(rows, meta);
}

/**
 * Stream-parse the archived CSV. The file is decoded from cp1252 chunk by chunk
 * (never read as one in-memory string) and consumed by the csv-parse stream.
 */
export async function streamQgipCsv(
  filePath: string,
  meta: QgipSourceMeta,
): Promise<{ raw: QgipRaw[]; totalRows: number }> {
  const decoder = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      callback(null, decodeCp1252(chunk));
    },
  });
  const parser = createReadStream(filePath)
    .pipe(decoder)
    .pipe(
      parseStream({
        bom: true,
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      }),
    );

  const raw: QgipRaw[] = [];
  let totalRows = 0;
  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    totalRows += 1;
    const mapped = mapQgipRawRow(record, meta, totalRows);
    if (mapped) raw.push(mapped);
  }
  return { raw, totalRows };
}

export function isSentinelPostcode(value: string | null): boolean {
  return value !== null && Object.prototype.hasOwnProperty.call(QGIP_SENTINEL_POSTCODES, value);
}

/** True when the row has no usable sub-state location. */
export function isApproximateLocation(raw: QgipRaw): boolean {
  if (raw.statewide !== null && /^yes$/i.test(raw.statewide)) return false;
  const postcode = raw.service_postcode;
  if (!postcode) return true;
  return isSentinelPostcode(postcode);
}

function qgipLocation(raw: QgipRaw): SpendingRecord['location'] {
  const statewide = raw.statewide !== null && /^yes$/i.test(raw.statewide);
  if (statewide) return { state: 'QLD' };
  const lga =
    raw.service_lga && !/^(multiple|not applicable|interstate)$/i.test(raw.service_lga)
      ? raw.service_lga
      : null;
  return { state: 'QLD', ...(lga ? { lga_name: lga } : {}) };
}

function qgipDataQuality(raw: QgipRaw): string {
  const statewide = raw.statewide !== null && /^yes$/i.test(raw.statewide);
  if (statewide) return 'provisional; statewide_only';
  if (isApproximateLocation(raw)) return 'provisional; location_approximate';
  return 'provisional';
}

function qgipRecord(raw: QgipRaw): SpendingRecord | null {
  const measureType = qgipMeasureType(raw.assistance_type);
  if (!measureType) return null;
  const amountCents = qgipAmountToCents(raw.amount_dollars);
  if (amountCents === null) return null;
  if (!raw.legal_entity || !raw.funding_agency) return null;

  const program = raw.program_title ?? raw.sub_program_title ?? raw.purpose ?? 'QGIP expenditure';
  const heading = [raw.program_title, raw.sub_program_title].filter(Boolean).join(' — ');
  const description = raw.purpose ?? (heading.length > 0 ? heading : program);

  const statewide = raw.statewide !== null && /^yes$/i.test(raw.statewide);
  const locationNotes = statewide
    ? 'Statewide program; no sub-state location supplied (statewide_only)'
    : `Service delivery: postcode ${raw.service_postcode ?? '(none)'}, suburb ${
        raw.service_suburb ?? '(none)'
      }, LGA ${raw.service_lga ?? '(none)'}`;
  const sentinelNote =
    !statewide && raw.service_postcode && isSentinelPostcode(raw.service_postcode)
      ? ` (postcode ${raw.service_postcode} sentinel: ${
          QGIP_SENTINEL_POSTCODES[raw.service_postcode as keyof typeof QGIP_SENTINEL_POSTCODES] ??
          'no fixed location'
        }; location approximate)`
      : '';

  const notes = [
    `CSV: ${raw.filename}`,
    `CKAN resource: ${raw.resource_name} (${raw.resource_id})`,
    `CSV data row: ${raw.row}; ABN: ${raw.abn ?? '(none)'}; recipient type: ${
      raw.recipient_type ?? '(none)'
    }; category: ${raw.category ?? '(none)'}`,
    `Assistance type: ${raw.assistance_type} -> measure_type ${measureType}`,
    `Unit: whole Australian dollars, confirmed by the QGIP data dictionary ("enter 150500 not $150,500"); converted at ${QGIP_UNIT_TO_CENTS} cents per dollar`,
    `Funding agency (funding_source): ${raw.funding_agency}; money source: ${
      raw.funding_source || '(none)'
    }; funding use: ${raw.funding_use ?? '(none)'}`,
    `Agreement: duration ${raw.duration ?? '(none)'}; start ${raw.start_date ?? '(none)'}; end ${
      raw.end_date ?? '(none)'
    }; total to date ${raw.total_to_date ?? '(none)'}${
      raw.total_notes ? `; notes "${raw.total_notes}"` : ''
    }`,
    `${locationNotes}${sentinelNote}`,
    'Actual expenditure reported for FY2024-25 (cash accounting standard); unverified',
    'Grant and contract rows are separate measure types and are never summed into one QLD total',
    `Source copy SHA-256: ${raw.source_sha256}`,
  ].join('; ');

  return {
    amount_cents: amountCents,
    measure_type: measureType,
    fiscal_year: QGIP_FISCAL_YEAR,
    source_id: QGIP_ID,
    source_url: raw.url,
    verified: false,
    natural_key: qgipNaturalKey([raw.resource_id, raw.row_hash, QGIP_FISCAL_YEAR]),
    jurisdiction_level: 'state',
    jurisdiction: 'QLD',
    source_dataset: QGIP_DATASET,
    source_date: raw.source_date,
    data_quality_flag: qgipDataQuality(raw),
    aggregation_role: 'additive',
    project_name: program,
    description,
    delivery_entity: raw.legal_entity,
    funding_source: raw.funding_agency,
    location: qgipLocation(raw),
    notes,
  };
}

/** Map raw QGIP rows to measures, rejecting out-of-scope and zero-dollar rows. */
export function transformQgipRaw(raw: readonly RawRecord[]): QgipTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: QgipSkip[] = [];
  const keys = new Set<string>();
  let duplicates = 0;
  for (const entry of raw) {
    if (entry.kind !== 'qgip') {
      skipped.push({
        filename: 'unknown',
        row: null,
        reason: `unknown raw kind ${String(entry.kind)}`,
      });
      continue;
    }
    const row = entry as QgipRaw;
    const assistance = row.assistance_type?.trim() ?? '';
    if (!qgipMeasureType(assistance)) {
      skipped.push({
        filename: row.filename,
        row: row.row,
        reason: `${assistance || '(missing Assistance type1)'}: out of scope (not a grant or procured frontline service)`,
      });
      continue;
    }
    if (qgipAmountToCents(row.amount_dollars) === null) {
      skipped.push({
        filename: row.filename,
        row: row.row,
        reason: `zero/negative Financial year expenditure (${row.amount_dollars}); no-spend row rejected`,
      });
      continue;
    }
    if (!row.legal_entity || !row.funding_agency) {
      skipped.push({
        filename: row.filename,
        row: row.row,
        reason: 'missing legal entity or funding agency',
      });
      continue;
    }
    const record = qgipRecord(row);
    if (!record) {
      skipped.push({
        filename: row.filename,
        row: row.row,
        reason: 'unusable amount or measure type',
      });
      continue;
    }
    if (keys.has(record.natural_key)) {
      duplicates += 1;
      continue;
    }
    keys.add(record.natural_key);
    records.push(record);
  }
  return { records, skipped, duplicates };
}

export interface QgipLoadedSource {
  raw: QgipRaw[];
  archive: ArchivedSourceRecord[];
  selection: QgipSourceSelection;
  totalRows: number;
  warnings: string[];
}

/**
 * Discover, archive and stream-parse the latest annual QGIP expenditure CSV and
 * the data dictionary. Both exact files are written outside the repo by the
 * shared source-archive helper; the repo only holds metadata.
 */
export async function loadQgipSource(
  options: QgipConnectorOptions = {},
): Promise<QgipLoadedSource> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delayMs = options.apiDelayMs ?? QGIP_API_DELAY_MS;
  const selection = await discoverQgipSource(fetchImpl, delayMs);
  const archive: ArchivedSourceRecord[] = [];
  const warnings: string[] = [];

  async function archiveResource(
    resource: QgipResource,
    title: string,
  ): Promise<ArchivedSourceRecord> {
    const record = await archiveSourceDocument({
      source_id: QGIP_ID,
      title,
      original_url: resource.url,
      retrieved_from: resource.url,
      archived_from: 'direct',
      filename: resource.filename,
      content_type: inferContentType(resource.filename),
      fetchImpl,
      ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
      notes: `data.qld CKAN package ${resource.package_name} resource ${resource.resource_id}`,
    });
    archive.push(record);
    return record;
  }

  const csvRecord = await archiveResource(selection.annual, `QGIP — ${selection.annual.name}`);
  await archiveResource(selection.dictionary, `QGIP — ${selection.dictionary.name}`);

  const meta: QgipSourceMeta = {
    resource_id: selection.annual.resource_id,
    resource_name: selection.annual.name,
    filename: selection.annual.filename,
    url: selection.annual.url,
    source_sha256: csvRecord.sha256,
    source_date: selection.annual.metadata_modified,
  };

  const { raw, totalRows } =
    options.readCsv !== undefined
      ? parseQgipCsv(await options.readCsv(csvRecord.local_path), meta)
      : await streamQgipCsv(csvRecord.local_path, meta);

  const result = transformQgipRaw(raw);
  const outOfScope = raw.filter((entry) => qgipMeasureType(entry.assistance_type) === null).length;
  const zeroInScope = raw.filter(
    (entry) =>
      qgipMeasureType(entry.assistance_type) !== null &&
      qgipAmountToCents(entry.amount_dollars) === null,
  ).length;
  const rejected = outOfScope + zeroInScope + (totalRows - raw.length);

  warnings.push(
    `source rows=${totalRows}; parsed=${raw.length}; ingested=${result.records.length}; ` +
      `rejected=${rejected} (out-of-scope ${outOfScope} + zero/negative in-scope ${zeroInScope}` +
      `${totalRows - raw.length > 0 ? ` + unparseable ${totalRows - raw.length}` : ''}); ` +
      `duplicates=${result.duplicates}; units whole AUD confirmed by the archived data dictionary`,
  );
  warnings.push(
    `grant_award=${result.records.filter((record) => record.measure_type === 'grant_award').length}; ` +
      `contract=${result.records.filter((record) => record.measure_type === 'contract').length}; ` +
      'grants and contracts are never summed together',
  );
  if (raw.length === 0) throw new Error('QGIP CSV produced no usable rows');
  if (result.records.length === 0) throw new Error('QGIP CSV produced no grant/contract measures');

  return { raw, archive, selection, totalRows, warnings };
}

/** Build the connector. `fetch` discovers, archives and stream-parses the CSV. */
export function createQgipConnector(options: QgipConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: QGIP_ID,
    name: QGIP_NAME,
    publisher: QGIP_PUBLISHER,
    source_url: QGIP_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'state',
    license: QGIP_LICENSE,
    notes: `${QGIP_ATTRIBUTION} QGIP 2024-25 consolidated expenditure CSV from data.qld CKAN plus the archived data dictionary. Units are whole AUD per the dictionary. Only Grant (measure_type=grant_award) and Frontline service procurement (measure_type=contract) are ingested; Concession, Loan and Direct government investment are rejected, as are zero-dollar rows. Grants and contracts are kept as separate measure types and never summed. funding_source is the QLD funding agency; location is statewide or the supplied service-delivery postcode/suburb/LGA (sentinels treated as approximate). No COFOG function; provisional and unverified.`,
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const loaded = await loadQgipSource(options);
      metadata.warnings = loaded.warnings;
      return loaded.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformQgipRaw(raw);
      metadata.errors = [];
      const warnings = [...(metadata.warnings ?? [])];
      if (result.skipped.length > 0)
        warnings.push(`${result.skipped.length} transformed row(s) rejected`);
      if (result.duplicates > 0) warnings.push(`${result.duplicates} duplicate row(s) skipped`);
      metadata.warnings = warnings;
      return result.records;
    },
    metadata,
  };
}

export function qgipManifestFromRecords(records: readonly ArchivedSourceRecord[]) {
  return records.map((record) => ({
    title: record.title,
    filename: path.basename(record.local_path),
    url: record.original_url,
    sha256: record.sha256,
    bytes: record.bytes,
    archived_from: record.archived_from,
  }));
}
