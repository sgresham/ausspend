import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { parse as parseStream } from 'csv-parse';
import { parse as parseSync } from 'csv-parse/sync';
import type { SpendingRecord } from '@ausspend/shared';
import { EXPENSE_CATEGORY_LABELS } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * ACNC Annual Information Statement (AIS) charity-expenses connector.
 *
 * One keyless data.gov.au CKAN dataset is ingested: the latest published AIS
 * CSV (currently the 2024 AIS). The dataset also contains a programs CSV with
 * program operating locations and the official explanatory notes PDF. All three
 * exact files are SHA-256 archived outside the repo; the repo keeps metadata
 * only.
 *
 * UNITS. The explanatory notes state that charities report "all amounts in
 * Australian dollars, and not to enter any symbols, commas or decimal points".
 * Amounts are therefore whole Australian dollars: 1 dollar = 100 cents.
 *
 * REPORTING PERIOD. The AIS `fin report from` / `fin report to` columns carry
 * each charity's own period (default 1 July to 30 June, alternate periods
 * allowed). `fiscal_year` is derived from the report-to date: a period ending
 * July-December is labelled YYYY-YY, one ending January-June (YYYY-1)-YY. The
 * source's alternate periods are preserved rather than relabelled to the AIS
 * edition. The 74 positive-expense rows with no period at all fall back to the
 * edition year and are flagged `fiscal_year_approximate`.
 *
 * EXPENSES AND NO-SUMMING. The AIS exposes five explicit expense components
 * (employee, interest, grants/donations in Australia, grants/donations outside
 * Australia, all other) and a total expenses column. Each row here carries an
 * explicit `expense_category`; `measure_type` stays `actual` for every record.
 * The total row is `aggregation_role: expense_total`; components are
 * `expense_component`. The API never adds the two roles together, so a query
 * can never double count total + sub-categories. Components are only emitted
 * when they reconcile exactly to the published total (106 of 54,233 AIS rows
 * differ by $1 due to source rounding; those keep only the total row).
 *
 * GEOGRAPHY. The AIS spreadsheet has no address column. The accompanying AIS
 * programs spreadsheet publishes program operating locations. A charity is
 * given `location.state`/`postcode` only when all of its program locations
 * resolve to exactly one state (and one valid postcode), and the record is
 * flagged `location_approximate` because a program operating location is not an
 * expense-incurred location or a registered address. Multi-state charities get
 * no state rather than an invented one. No coordinate is parsed or averaged.
 */

export const ACNC_ID = 'acnc-charity';
export const ACNC_NAME = 'ACNC Annual Information Statement (AIS) — Charity Expenses';
export const ACNC_PUBLISHER = 'Australian Charities and Not-for-profits Commission (ACNC)';
export const ACNC_DATASET = 'ACNC Annual Information Statement (AIS)';
export const ACNC_LICENSE = 'Creative Commons Attribution 3.0 Australia';
export const ACNC_CKAN_API_BASE = 'https://data.gov.au/data/api/3/action';
export const ACNC_SOURCE_URL =
  'https://data.gov.au/data/dataset/acnc-2024-annual-information-statement-ais-data';
export const ACNC_SEARCH_QUERY = 'ACNC Annual Information Statement';
export const ACNC_UNIT = 'AUD dollars';
export const ACNC_UNIT_TO_CENTS = 100;
export const ACNC_API_DELAY_MS = 500;
export const ACNC_MAX_ROWS = 100;

/** Machine category + source column + human label. Total is handled separately. */
export const ACNC_EXPENSE_COMPONENTS = [
  { category: 'employee_expenses', column: 'employee expenses' },
  { category: 'interest_expenses', column: 'interest expenses' },
  {
    category: 'grants_and_donations_australia',
    column: 'grants and donations made for use in Australia',
  },
  {
    category: 'grants_and_donations_overseas',
    column: 'grants and donations made for use outside Australia',
  },
  { category: 'all_other_expenses', column: 'all other expenses' },
] as const;

export const ACNC_TOTAL_CATEGORY = 'total';
export const ACNC_TOTAL_COLUMN = 'total expenses';

export const ACNC_EXPENSE_CATEGORIES = [
  ACNC_TOTAL_CATEGORY,
  ...ACNC_EXPENSE_COMPONENTS.map((component) => component.category),
] as const;

/** Required AIS columns for the expense mapping. */
export const ACNC_AIS_COLUMNS = [
  'abn',
  'charity name',
  'registration status',
  'charity size',
  'fin report from',
  'fin report to',
  ...ACNC_EXPENSE_COMPONENTS.map((component) => component.column),
  ACNC_TOTAL_COLUMN,
] as const;

export interface AcncResource {
  resource_id: string;
  name: string;
  format: string;
  url: string;
  filename: string;
  edition_year: number;
  metadata_modified: string;
}

export interface AcncSourceSelection {
  dataset_id: string;
  package_name: string;
  dataset_title: string;
  edition_year: number;
  dataset_url: string;
  ais: AcncResource;
  programs: AcncResource | null;
  notes: AcncResource;
}

export interface AcncSourceMeta {
  resource_id: string;
  resource_name: string;
  filename: string;
  url: string;
  source_sha256: string;
  source_date: string;
  edition_year: number;
  dataset_url: string;
}

export interface AcncLocation {
  state?: string;
  postcode?: string;
  basis: 'program_single_state' | 'program_postcode' | 'multi_state' | 'absent';
}

export interface AcncRaw extends Record<string, unknown>, AcncSourceMeta {
  kind: 'acnc-ais';
  /** 1-based AIS data row (header not counted). */
  row: number;
  row_hash: string;
  abn: string;
  charity_name: string;
  registration_status: string | null;
  charity_size: string | null;
  financial_report_from: string | null;
  financial_report_to: string | null;
  fiscal_year: string;
  fiscal_year_approximate: boolean;
  total_expenses_dollars: number;
  component_dollars: Record<string, number>;
  location_state: string | null;
  location_postcode: string | null;
  location_basis: AcncLocation['basis'];
  unit: typeof ACNC_UNIT;
}

export interface AcncSkip {
  row: number | null;
  abn: string | null;
  reason: string;
}

export interface AcncTransformResult {
  records: SpendingRecord[];
  skipped: AcncSkip[];
  duplicates: number;
  componentsEmitted: number;
  componentsUnreconciled: number;
}

export interface AcncConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  apiDelayMs?: number;
  /** Injected for unit tests; defaults to streaming the archived CSV. */
  readAisCsv?: (filePath: string) => Promise<string>;
  readProgramsCsv?: (filePath: string) => Promise<string>;
}

interface CkanResource {
  id: string;
  name: string;
  format: string;
  url: string;
  last_modified?: string;
  metadata_modified?: string;
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

/** Parse a whole-dollar amount (commas/symbols tolerated; negatives rejected later). */
export function acncNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const negatives = /^\s*\(.*\)\s*$/.test(value);
  const cleaned = value.replace(/[$,\s()]/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negatives ? -parsed : parsed;
}

/** Convert whole Australian dollars to integer cents. Zero/negative is not spend. */
export function acncAmountToCents(value: unknown): number | null {
  const numeric = acncNumber(value);
  if (numeric === null || numeric <= 0) return null;
  const cents = Math.round(numeric * ACNC_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

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
 * Derive the financial year from the AIS report-to date (DD/MM/YYYY). Returns
 * `null` when the date is unusable; the caller falls back to the edition year.
 */
export function acncFinancialYearFromDate(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  const startYear = month >= 7 ? year : year - 1;
  const labelEnd = month >= 7 ? (year + 1) % 100 : year % 100;
  return `${startYear}-${String(labelEnd).padStart(2, '0')}`;
}

/** Edition fallback financial year: 2024 AIS -> 2023-24. */
export function acncEditionFiscalYear(editionYear: number): string {
  return `${editionYear - 1}-${String(editionYear % 100).padStart(2, '0')}`;
}

export function acncRowHash(row: Record<string, string>, rowNumber: number): string {
  const cells = ACNC_AIS_COLUMNS.map((name) => column(row, name) ?? '');
  return sha256([String(rowNumber), ...cells].join('\u001f'));
}

/** The brief's identity: hash(abn + financial_year + expense_category). */
export function acncNaturalKey(abn: string, fiscalYear: string, expenseCategory: string): string {
  return `acnc-charity:${sha256([abn, fiscalYear, expenseCategory].join('\u001f')).slice(0, 40)}`;
}

function resourceFilename(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
  } catch {
    return url.split('/').pop() ?? 'resource.csv';
  }
}

function editionYearFromName(name: string, title?: string): number | null {
  const haystack = `${name} ${title ?? ''}`;
  const match = /(?:acnc[-\s]*)?(20\d{2})/i.exec(haystack);
  if (!match) return null;
  return Number(match[1]);
}

interface CkanSearchBody {
  results?: CkanSearchResult[];
}

async function ckanGet<T>(
  action: string,
  params: string,
  fetchImpl: typeof fetch,
  delayMs: number,
): Promise<T> {
  await sleep(delayMs);
  const response = await fetchImpl(`${ACNC_CKAN_API_BASE}/${action}?${params}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`data.gov.au ${action} HTTP ${response.status}`);
  const body = (await response.json()) as { success?: boolean; result?: T };
  if (!body.success || body.result === undefined) {
    throw new Error(`data.gov.au ${action} failed for ${params}`);
  }
  return body.result;
}

function toResource(pkg: CkanPackage, resource: CkanResource, editionYear: number): AcncResource {
  return {
    resource_id: resource.id,
    name: resource.name,
    format: resource.format,
    url: resource.url,
    filename: resourceFilename(resource.url),
    edition_year: editionYear,
    metadata_modified: (resource.last_modified ?? resource.metadata_modified ?? '').slice(0, 10),
  };
}

function isAisCsv(resource: CkanResource): boolean {
  return (
    /csv/i.test(resource.format) &&
    /ais\d+/i.test(resource.name) &&
    !/programs/i.test(resource.name)
  );
}

function isProgramsCsv(resource: CkanResource): boolean {
  return /csv/i.test(resource.format) && /programs/i.test(resource.name);
}

function isNotesPdf(resource: CkanResource): boolean {
  return /pdf/i.test(resource.format) && /explanatory|notes/i.test(resource.name);
}

/**
 * Discover the latest AIS package through package_search, then package_show.
 * The latest edition is the highest year in the matching package names/titles.
 */
export async function discoverAcncSource(
  fetchImpl: typeof fetch = fetch,
  delayMs: number = ACNC_API_DELAY_MS,
): Promise<AcncSourceSelection> {
  const search = await ckanGet<CkanSearchBody>(
    'package_search',
    `q=${encodeURIComponent(ACNC_SEARCH_QUERY)}&rows=${ACNC_MAX_ROWS}`,
    fetchImpl,
    delayMs,
  );
  const candidates = (search.results ?? [])
    .map((entry) => ({
      ...entry,
      edition_year: editionYearFromName(entry.name, entry.title) ?? 0,
    }))
    .filter((entry) => /acnc/i.test(`${entry.name} ${entry.title ?? ''}`))
    .filter((entry) => /annual information|ais/i.test(`${entry.name} ${entry.title ?? ''}`))
    .filter((entry) => entry.edition_year > 0)
    .sort((a, b) => b.edition_year - a.edition_year || a.name.localeCompare(b.name));
  const latest = candidates[0];
  if (!latest) {
    throw new Error(
      'data.gov.au package_search returned no ACNC Annual Information Statement package',
    );
  }

  const pkg = await ckanGet<CkanPackage>(
    'package_show',
    `id=${encodeURIComponent(latest.name)}`,
    fetchImpl,
    delayMs,
  );
  const editionYear = editionYearFromName(pkg.name, pkg.title) ?? latest.edition_year;
  if (editionYear !== latest.edition_year) {
    throw new Error(
      `data.gov.au package_show ${pkg.name} edition ${editionYear} disagrees with search ${latest.edition_year}`,
    );
  }
  const ais = pkg.resources.find(isAisCsv);
  if (!ais) throw new Error(`data.gov.au package ${pkg.name} has no AIS CSV resource`);
  const programs = pkg.resources.find(isProgramsCsv) ?? null;
  const notes = pkg.resources.find(isNotesPdf);
  if (!notes) {
    throw new Error(
      `data.gov.au package ${pkg.name} has no explanatory-notes PDF; units cannot be confirmed`,
    );
  }
  return {
    dataset_id: pkg.id,
    package_name: pkg.name,
    dataset_title: pkg.title,
    edition_year: editionYear,
    dataset_url: `https://data.gov.au/data/dataset/${pkg.name}`,
    ais: toResource(pkg, ais, editionYear),
    programs: programs ? toResource(pkg, programs, editionYear) : null,
    notes: toResource(pkg, notes, editionYear),
  };
}

export const AUSTRALIAN_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;

const STATE_NAMES: Record<string, string> = {
  'new south wales': 'NSW',
  victoria: 'VIC',
  queensland: 'QLD',
  'western australia': 'WA',
  'south australia': 'SA',
  tasmania: 'TAS',
  'australian capital territory': 'ACT',
  'northern territory': 'NT',
};

/** Australian postcode -> state ranges (ACT/NSW overlap is resolved explicitly). */
export function stateFromPostcode(postcode: string): string | null {
  if (!/^\d{4}$/.test(postcode)) return null;
  const n = Number(postcode);
  if (n >= 200 && n <= 299) return 'ACT';
  if (n >= 800 && n <= 999) return 'NT';
  if (n >= 1000 && n <= 2599) return 'NSW';
  if (n >= 2600 && n <= 2618) return 'ACT';
  if (n >= 2619 && n <= 2899) return 'NSW';
  if (n >= 2900 && n <= 2920) return 'ACT';
  if (n >= 2921 && n <= 2999) return 'NSW';
  if (n >= 3000 && n <= 3999) return 'VIC';
  if (n >= 4000 && n <= 4999) return 'QLD';
  if (n >= 5000 && n <= 5999) return 'SA';
  if (n >= 6000 && n <= 6999) return 'WA';
  if (n >= 7000 && n <= 7999) return 'TAS';
  return null;
}

/** Match a state code/full name in free-text operating-location values. */
export function stateFromLocationText(value: string): string | null {
  const lower = value.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (new RegExp(`(^|[^a-z])${name}([^a-z]|$)`, 'i').test(lower)) return code;
  }
  const upper = value.toUpperCase();
  for (const code of AUSTRALIAN_STATES) {
    if (new RegExp(`(^|[^A-Z])${code}([^A-Z]|$)`).test(upper)) return code;
  }
  return null;
}

/**
 * Extract a postcode only where the location syntax supports it, to avoid
 * mistaking a street number ("1635 Forest Road") for a postcode.
 */
export function postcodeFromLocationText(value: string): string | null {
  const exact = /^\s*(\d{4})\s*$/.exec(value);
  if (exact && stateFromPostcode(exact[1]!)) return exact[1]!;
  const afterState =
    /(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT|New South Wales|Victoria|Queensland|Western Australia|South Australia|Tasmania|Australian Capital Territory|Northern Territory)\s*,?\s*(\d{4})\b/i.exec(
      value,
    );
  if (afterState && stateFromPostcode(afterState[1]!)) return afterState[1]!;
  const afterComma = /,\s*(\d{4})\s*(?:,|$)/.exec(value);
  if (afterComma && stateFromPostcode(afterComma[1]!)) return afterComma[1]!;
  return null;
}

interface ProgramLocationIndex {
  states: Set<string>;
  postcodes: Set<string>;
}

/** Collect program operating locations by ABN from the AIS programs spreadsheet. */
export function collectProgramLocations(
  rows: readonly Record<string, string>[],
): Map<string, ProgramLocationIndex> {
  const index = new Map<string, ProgramLocationIndex>();
  for (const row of rows) {
    const abn = (cleanColumn(row, 'ABN') ?? '').replace(/\s+/g, '');
    if (!abn) continue;
    const entry = index.get(abn) ?? { states: new Set(), postcodes: new Set() };
    for (let i = 1; i <= 10; i += 1) {
      const location = cleanColumn(row, `Operating Location ${i}`);
      if (!location) continue;
      const state = stateFromLocationText(location);
      if (state) entry.states.add(state);
      const postcode = postcodeFromLocationText(location);
      if (postcode) {
        entry.postcodes.add(postcode);
        const postcodeState = stateFromPostcode(postcode);
        if (postcodeState) entry.states.add(postcodeState);
      }
    }
    index.set(abn, entry);
  }
  return index;
}

/** Resolve one charity's program locations to at most one state/postcode. */
export function resolveProgramLocation(entry: ProgramLocationIndex | undefined): AcncLocation {
  if (!entry || bothEmpty(entry)) return { basis: 'absent' };
  if (entry.states.size > 1) return { basis: 'multi_state' };
  const state = entry.states.size === 1 ? [...entry.states][0]! : null;
  const postcodes = [...entry.postcodes].filter(
    (postcode) => state === null || stateFromPostcode(postcode) === state,
  );
  if (state && postcodes.length === 1) {
    return { state, postcode: postcodes[0]!, basis: 'program_single_state' };
  }
  if (state) return { state, basis: 'program_single_state' };
  if (postcodes.length === 1) {
    const postcodeState = stateFromPostcode(postcodes[0]!);
    if (postcodeState) {
      return { state: postcodeState, postcode: postcodes[0]!, basis: 'program_postcode' };
    }
  }
  const derived = new Set(postcodes.map(stateFromPostcode).filter(Boolean));
  if (derived.size === 1) {
    return { state: [...derived][0]!, basis: 'program_postcode' };
  }
  return { basis: 'absent' };
}

function bothEmpty(entry: ProgramLocationIndex): boolean {
  return entry.states.size === 0 && entry.postcodes.size === 0;
}

function mapAisRow(
  row: Record<string, string>,
  meta: AcncSourceMeta,
  locations: Map<string, ProgramLocationIndex>,
  rowNumber: number,
): AcncRaw | null {
  const abn = cleanColumn(row, 'abn');
  const name = cleanColumn(row, 'charity name');
  const total = acncNumber(column(row, ACNC_TOTAL_COLUMN));
  if (!abn || !name || total === null) return null;
  const reportTo = cleanColumn(row, 'fin report to');
  const derivedFiscalYear = acncFinancialYearFromDate(reportTo);
  const fiscalYear = derivedFiscalYear ?? acncEditionFiscalYear(meta.edition_year);
  const location = resolveProgramLocation(locations.get(abn.replace(/\s+/g, '')));
  const componentDollars: Record<string, number> = {};
  for (const component of ACNC_EXPENSE_COMPONENTS) {
    const value = acncNumber(column(row, component.column));
    componentDollars[component.category] = value ?? 0;
  }
  return {
    kind: 'acnc-ais',
    ...meta,
    row: rowNumber,
    row_hash: acncRowHash(row, rowNumber),
    abn,
    charity_name: name,
    registration_status: cleanColumn(row, 'registration status'),
    charity_size: cleanColumn(row, 'charity size'),
    financial_report_from: cleanColumn(row, 'fin report from'),
    financial_report_to: reportTo,
    fiscal_year: fiscalYear,
    fiscal_year_approximate: derivedFiscalYear === null,
    total_expenses_dollars: total,
    component_dollars: componentDollars,
    location_state: location.state ?? null,
    location_postcode: location.postcode ?? null,
    location_basis: location.basis,
    unit: ACNC_UNIT,
  };
}

function rowsToRaw(
  rows: Array<Record<string, string>>,
  meta: AcncSourceMeta,
  locations: Map<string, ProgramLocationIndex>,
): { raw: AcncRaw[]; totalRows: number } {
  const raw: AcncRaw[] = [];
  rows.forEach((row, index) => {
    const mapped = mapAisRow(row, meta, locations, index + 1);
    if (mapped) raw.push(mapped);
  });
  return { raw, totalRows: rows.length };
}

/** Test helper: parse an AIS CSV fixture synchronously. */
export function parseAcncCsv(
  csv: string,
  meta: AcncSourceMeta,
  programRows: readonly Record<string, string>[] = [],
): { raw: AcncRaw[]; totalRows: number } {
  const rows = parseSync(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>;
  return rowsToRaw(rows, meta, collectProgramLocations(programRows));
}

/**
 * Stream-parse the archived AIS CSV. UTF-8 (with BOM); never loads the whole
 * 38 MB file into one string.
 */
export async function streamAcncCsv(
  filePath: string,
  meta: AcncSourceMeta,
  locations: Map<string, ProgramLocationIndex>,
): Promise<{ raw: AcncRaw[]; totalRows: number }> {
  const parser = createReadStream(filePath).pipe(
    parseStream({ bom: true, columns: true, skip_empty_lines: true, relax_column_count: true }),
  );
  const raw: AcncRaw[] = [];
  let totalRows = 0;
  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    totalRows += 1;
    const mapped = mapAisRow(record, meta, locations, totalRows);
    if (mapped) raw.push(mapped);
  }
  return { raw, totalRows };
}

export async function streamProgramLocations(
  filePath: string,
): Promise<Map<string, ProgramLocationIndex>> {
  const parser = createReadStream(filePath).pipe(
    parseStream({ bom: true, columns: true, skip_empty_lines: true, relax_column_count: true }),
  );
  const rows: Array<Record<string, string>> = [];
  for await (const record of parser as AsyncIterable<Record<string, string>>) rows.push(record);
  return collectProgramLocations(rows);
}

function acncDataQuality(raw: AcncRaw, componentsReconciled: boolean): string {
  const flags = ['provisional'];
  if (raw.fiscal_year_approximate) flags.push('fiscal_year_approximate');
  if (raw.location_basis === 'multi_state') flags.push('location_multi_state');
  if (raw.location_state || raw.location_postcode) flags.push('location_approximate');
  if (!componentsReconciled) flags.push('expense_components_unreconciled');
  return flags.join('; ');
}

function acncLocation(raw: AcncRaw): SpendingRecord['location'] {
  if (!raw.location_state && !raw.location_postcode) return undefined;
  return {
    ...(raw.location_state ? { state: raw.location_state } : {}),
    ...(raw.location_postcode ? { postcode: raw.location_postcode } : {}),
  };
}

function periodLabel(raw: AcncRaw): string {
  if (raw.financial_report_from && raw.financial_report_to) {
    return `${raw.financial_report_from} to ${raw.financial_report_to}`;
  }
  return `report-to date not published; fiscal year ${raw.fiscal_year} is approximate`;
}

function acncRecord(
  raw: AcncRaw,
  expenseCategory: string,
  amountCents: number,
  aggregationRole: 'expense_total' | 'expense_component',
  componentsReconciled: boolean,
): SpendingRecord {
  const label =
    EXPENSE_CATEGORY_LABELS[expenseCategory as keyof typeof EXPENSE_CATEGORY_LABELS] ??
    expenseCategory;
  const notes = [
    `AIS edition: ${raw.edition_year}; AIS data row ${raw.row}; ABN ${raw.abn}`,
    `Charity: ${raw.charity_name}; registration status: ${raw.registration_status ?? '(none)'}; size: ${raw.charity_size ?? '(none)'}`,
    `Expense category: ${expenseCategory} (${label}); measure_type stays actual (the category is never a measure type)`,
    `Unit: whole Australian dollars, confirmed by the ACNC explanatory notes ("all amounts in Australian dollars, and not to enter any symbols, commas or decimal points"); converted at ${ACNC_UNIT_TO_CENTS} cents per dollar`,
    `Reporting period: ${periodLabel(raw)}; fiscal_year ${raw.fiscal_year}${raw.fiscal_year_approximate ? ' (approximate: no report-to date)' : ''}`,
    `No-sum rule: total expenses and the five component categories are separate expense_category rows; this row's aggregation_role is ${aggregationRole}. Total + components are never added together.`,
    componentsReconciled
      ? 'Component rows reconciled exactly to the published total expenses.'
      : 'Component rows were omitted because they did not reconcile exactly to the published total expenses.',
    raw.location_state || raw.location_postcode
      ? `Location: program operating location (state ${raw.location_state ?? '(none)'}, postcode ${raw.location_postcode ?? '(none)'}); approximate program/service operating location; not a registered address, headquarters (HQ), or expense-incurred location`
      : raw.location_basis === 'multi_state'
        ? 'Location: program operating locations span multiple states; no single state is recorded'
        : 'Location: no usable program operating location; state/postcode absent',
    `Source copy SHA-256: ${raw.source_sha256}`,
  ].join('; ');

  return {
    amount_cents: amountCents,
    measure_type: 'actual',
    fiscal_year: raw.fiscal_year,
    source_id: ACNC_ID,
    source_url: raw.url,
    verified: false,
    natural_key: acncNaturalKey(raw.abn, raw.fiscal_year, expenseCategory),
    project_name: `Charity expenses — ${raw.charity_name}`,
    description: `${raw.charity_name} — ${label} reported in the ${raw.edition_year} Annual Information Statement (${periodLabel(raw)})`,
    jurisdiction_level: 'charity',
    jurisdiction: 'Australia',
    delivery_entity: raw.charity_name,
    funding_source: 'ACNC-registered charity',
    source_dataset: ACNC_DATASET,
    source_date: raw.source_date,
    data_quality_flag: acncDataQuality(raw, componentsReconciled),
    aggregation_role: aggregationRole,
    expense_category: expenseCategory,
    location: acncLocation(raw),
    notes,
  };
}

/**
 * Map AIS raw rows to total + component measures. A charity with a positive
 * total gets exactly one total row; components are emitted only when they
 * reconcile exactly to that total. Zero, negative and unparseable totals are
 * skipped, never zero-filled.
 */
export function transformAcncRaw(raw: readonly RawRecord[]): AcncTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: AcncSkip[] = [];
  const keys = new Set<string>();
  let duplicates = 0;
  let componentsEmitted = 0;
  let componentsUnreconciled = 0;

  for (const entry of raw) {
    if (entry.kind !== 'acnc-ais') {
      skipped.push({ row: null, abn: null, reason: `unknown raw kind ${String(entry.kind)}` });
      continue;
    }
    const row = entry as AcncRaw;
    const totalCents = acncAmountToCents(row.total_expenses_dollars);
    if (totalCents === null) {
      skipped.push({
        row: row.row,
        abn: row.abn,
        reason: `zero/negative/non-numeric total expenses (${row.total_expenses_dollars}); no-spend row rejected`,
      });
      continue;
    }
    if (!row.abn || !row.charity_name) {
      skipped.push({ row: row.row, abn: row.abn || null, reason: 'missing ABN or charity name' });
      continue;
    }

    const componentCents: Array<{ category: string; cents: number }> = [];
    let componentSum = 0;
    for (const component of ACNC_EXPENSE_COMPONENTS) {
      const dollars = row.component_dollars[component.category] ?? 0;
      const cents = acncAmountToCents(dollars);
      if (cents !== null) {
        componentCents.push({ category: component.category, cents });
        componentSum += cents;
      }
    }
    const reconciled = componentSum === totalCents;
    if (!reconciled) componentsUnreconciled += 1;

    const totalRecord = acncRecord(
      row,
      ACNC_TOTAL_CATEGORY,
      totalCents,
      'expense_total',
      reconciled,
    );
    if (keys.has(totalRecord.natural_key)) {
      duplicates += 1;
      continue;
    }
    keys.add(totalRecord.natural_key);
    records.push(totalRecord);

    if (reconciled) {
      for (const component of componentCents) {
        const record = acncRecord(
          row,
          component.category,
          component.cents,
          'expense_component',
          true,
        );
        if (keys.has(record.natural_key)) {
          duplicates += 1;
          continue;
        }
        keys.add(record.natural_key);
        records.push(record);
        componentsEmitted += 1;
      }
    }
  }

  return { records, skipped, duplicates, componentsEmitted, componentsUnreconciled };
}

export interface AcncLoadedSource {
  raw: AcncRaw[];
  archive: ArchivedSourceRecord[];
  selection: AcncSourceSelection;
  totalRows: number;
  programRows: number;
  warnings: string[];
}

/**
 * Discover, archive and stream-parse the latest AIS CSV, programs CSV and
 * explanatory notes. Exact bytes are written outside the repo by the shared
 * source-archive helper; the repo only holds metadata.
 */
export async function loadAcncSource(
  options: AcncConnectorOptions = {},
): Promise<AcncLoadedSource> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const delayMs = options.apiDelayMs ?? ACNC_API_DELAY_MS;
  const selection = await discoverAcncSource(fetchImpl, delayMs);
  const archive: ArchivedSourceRecord[] = [];

  async function archiveResource(
    resource: AcncResource,
    title: string,
  ): Promise<ArchivedSourceRecord> {
    const record = await archiveSourceDocument({
      source_id: ACNC_ID,
      title,
      original_url: resource.url,
      retrieved_from: resource.url,
      archived_from: 'direct',
      filename: resource.filename,
      content_type: inferContentType(resource.filename),
      fetchImpl,
      ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
      notes: `data.gov.au CKAN package ${selection.package_name} resource ${resource.resource_id}`,
    });
    archive.push(record);
    return record;
  }

  const aisRecord = await archiveResource(selection.ais, `ACNC AIS ${selection.edition_year} CSV`);
  let programsRecord: ArchivedSourceRecord | null = null;
  if (selection.programs) {
    programsRecord = await archiveResource(
      selection.programs,
      `ACNC AIS ${selection.edition_year} programs CSV`,
    );
  }
  await archiveResource(selection.notes, `ACNC ${selection.edition_year} AIS explanatory notes`);

  const meta: AcncSourceMeta = {
    resource_id: selection.ais.resource_id,
    resource_name: selection.ais.name,
    filename: selection.ais.filename,
    url: selection.ais.url,
    source_sha256: aisRecord.sha256,
    source_date: selection.ais.metadata_modified,
    edition_year: selection.edition_year,
    dataset_url: selection.dataset_url,
  };

  const locations = programsRecord
    ? options.readProgramsCsv !== undefined
      ? collectProgramLocations(
          parseSync(await options.readProgramsCsv(programsRecord.local_path), {
            bom: true,
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
          }) as Array<Record<string, string>>,
        )
      : await streamProgramLocations(programsRecord.local_path)
    : new Map<string, ProgramLocationIndex>();

  const { raw, totalRows } =
    options.readAisCsv !== undefined
      ? parseAcncCsv(await options.readAisCsv(aisRecord.local_path), meta)
      : await streamAcncCsv(aisRecord.local_path, meta, locations);

  const programRows = programsRecord ? locations.size : 0;
  const result = transformAcncRaw(raw);
  const warnings = [
    `AIS edition ${selection.edition_year}; source rows=${totalRows}; parsed=${raw.length}; ingested=${result.records.length}` +
      ` (total rows=${result.records.filter((record) => record.aggregation_role === 'expense_total').length},` +
      ` component rows=${result.componentsEmitted}); skipped=${result.skipped.length}; duplicates=${result.duplicates};` +
      ` components-unreconciled=${result.componentsUnreconciled}`,
    'Charity expenses are ACNC-registered charity spending, not government spending. Total and component rows are never summed together.',
    `Location: ${programRows} ABNs with program-location data; state/postcode only when all program locations resolve to one state, flagged location_approximate. No address is present in the AIS spreadsheet.`,
  ];
  if (!programsRecord) {
    warnings.push('No AIS programs CSV resource was found; state/postcode location is absent.');
  }
  if (raw.length === 0) throw new Error('ACNC AIS CSV produced no usable rows');
  if (result.records.length === 0) throw new Error('ACNC AIS CSV produced no expense measures');

  return { raw, archive, selection, totalRows, programRows, warnings };
}

/** Build the connector. `fetch` discovers, archives and stream-parses the AIS CSV. */
export function createAcncCharityConnector(options: AcncConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: ACNC_ID,
    name: ACNC_NAME,
    publisher: ACNC_PUBLISHER,
    source_url: ACNC_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'charity',
    license: ACNC_LICENSE,
    notes:
      'Latest ACNC Annual Information Statement (AIS) CSV from data.gov.au CKAN, plus the AIS programs CSV and explanatory-notes PDF, all SHA-256 archived outside the repo. Units are whole Australian dollars per the explanatory notes. Every record is jurisdiction_level=charity, jurisdiction=Australia, funding_source="ACNC-registered charity", measure_type=actual, and carries an explicit expense_category. The total expenses row is aggregation_role=expense_total; component rows are expense_component and are never summed with the total. No COFOG function is defensible. State/postcode comes only from program operating locations, is single-state only and is flagged location_approximate. Provisional and unverified.',
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const loaded = await loadAcncSource(options);
      metadata.warnings = loaded.warnings;
      return loaded.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformAcncRaw(raw);
      metadata.errors = [];
      const warnings = [...(metadata.warnings ?? [])];
      if (result.skipped.length > 0) {
        warnings.push(`${result.skipped.length} AIS row(s) rejected (zero/negative/no-spend)`);
      }
      if (result.duplicates > 0) warnings.push(`${result.duplicates} duplicate row(s) skipped`);
      metadata.warnings = warnings;
      return result.records;
    },
    metadata,
  };
}

export function acncManifestFromRecords(records: readonly ArchivedSourceRecord[]) {
  return records.map((record) => ({
    title: record.title,
    filename: path.basename(record.local_path),
    url: record.original_url,
    sha256: record.sha256,
    bytes: record.bytes,
    archived_from: record.archived_from,
  }));
}
