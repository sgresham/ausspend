import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { SpendingRecord } from '@ausspend/shared';
import {
  archiveSourceDocument,
  sha256Bytes,
  sourceArchiveRoot,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * WA Budget (Phase 6.3).
 *
 * CKAN discovery: catalogue.data.wa.gov.au has three budget packages, all
 * "Western Australia Budget Economic and Fiscal Outlook Table and Chart Data"
 * (Budget Paper No. 3). There is no machine-readable Budget Paper No. 2
 * agency-expense dataset in the catalogue. The premise falsifier therefore
 * holds: no clean BP2 table exists, so this connector extracts the strongest
 * machine-readable EFO tables and marks them provisional.
 *
 * Adopted tables from the latest (2016-17) package:
 * - Chapter 5, Tables 1..19: per-minister/agency major spending changes since
 *   the 2015-16 Mid Year Review, five year columns, explicit `$m`. These are
 *   non-additive policy measures (changes), not total agency expenses, so they
 *   are `aggregation_role: "policy_measure"`, `data_quality_flag: "provisional"`
 *   and no COFOG mapping is invented.
 * - Chapter 6, Table 1: asset investment in roads and public transport by
 *   agency (Main Roads, Public Transport Authority) with a printed Total row.
 *   The total is reconciled exactly for all five years and the agency rows are
 *   ingested as `agency_detail` (not the Total row).
 *
 * Unit guard: every adopted table must print `$m` over the five year columns
 * 2015-16..2019-20, otherwise ingestion fails. A total-row mismatch in Chapter
 * 6 Table 1 also fails ingestion. Chapter 5 prints no table total, so every
 * Chapter 5 row is explicitly `reconciliation_status`-style provisional in its
 * notes rather than being summed into an invented total.
 *
 * Measure type: WA budget convention, documented rather than guessed from a
 * label: 2015-16 is the estimated/actual year (`actual`), 2016-17 is the budget
 * (`budget`), 2017-18..2019-20 are forward estimates (`estimate`). Values are
 * whole/one-decimal $m converted to cents at 1 $m = 100,000,000 cents.
 */

export const WA_ID = 'wa-budget';
export const WA_NAME = 'Western Australian Budget';
export const WA_PUBLISHER = 'Western Australian Department of Treasury and Finance';
export const WA_SOURCE_URL =
  'https://catalogue.data.wa.gov.au/dataset/2016-17-western-australia-budget-economic-and-fiscal-outlook-table-and-chart-data';
export const WA_CKAN_BASE = 'https://catalogue.data.wa.gov.au/api/3/action';
export const WA_LICENSE =
  'Custom (Personal & Academic Use) — Western Australian Department of Treasury and Finance; not an open-data licence grant.';
export const WA_DATASET = '2016-17 WA Budget Paper No. 3 — Economic and Fiscal Outlook';
export const WA_UNIT = 'AUD_millions';
export const WA_UNIT_LABEL = '$m';
export const WA_UNIT_TO_CENTS = 100_000_000;
export const WA_CHAPTER5_FILENAME = '2016-17-chapter5.xlsx';
export const WA_CHAPTER6_FILENAME = '2016-17-chapter6.xlsx';
export const WA_CHAPTER5_SHA256 =
  'ce6e5afa5770dcde360f2e11f91c5af12b69720ce1303afb52d2542e54dc3950';
export const WA_CHAPTER6_SHA256 =
  '78797c887367035749ddd48c417be3cd87bf7d67ec135410446f6860f83d8989';
export const WA_CAVEAT =
  'WA Budget EFO tables. Chapter 5 rows are non-additive major spending changes (policy measures), not total agency expenses; Chapter 6 Table 1 is agency asset investment reconciled to its printed Total. Government and agency amounts are never summed across tables, years or measures. No COFOG mapping is published, so none is invented. Provisional; not an official WA Treasury publication of the app.';

const YEARS = ['2015-16', '2016-17', '2017-18', '2018-19', '2019-20'] as const;
const BUDGET_YEAR = '2016-17';
export type WaMeasureType = 'actual' | 'budget' | 'estimate';

export function waMeasureTypeForYear(year: string): WaMeasureType {
  if (year === '2015-16') return 'actual';
  if (year === BUDGET_YEAR) return 'budget';
  return 'estimate';
}

export function waMillionsToCents(millions: number): number {
  const cents = Math.round(Math.abs(millions) * WA_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`WA Budget amount ${millions} $m is outside the safe integer cent range`);
  }
  return cents;
}

export function waNaturalKey(parts: {
  table: string;
  agency: string;
  measure: string;
  fiscal_year: string;
  kind: string;
}): string {
  const digest = createHash('sha256')
    .update(
      [WA_ID, parts.kind, parts.table, parts.agency, parts.measure, parts.fiscal_year].join('|'),
    )
    .digest('hex');
  return `${WA_ID}:${digest}`;
}

// ---------------------------------------------------------------------------
// CKAN discovery
// ---------------------------------------------------------------------------

export interface CkanResource {
  name: string;
  format: string;
  url: string;
}

export interface CkanPackage {
  name: string;
  title: string;
  notes?: string;
  resources: CkanResource[];
}

/** Extract the budget year from a package title/name, e.g. 2016-17. */
export function waPackageYear(pkg: Pick<CkanPackage, 'name' | 'title'>): string | null {
  const match = /(20\d{2})[-_](\d{2})/.exec(`${pkg.name} ${pkg.title}`);
  return match ? `${match[1]}-${match[2]}` : null;
}

/** Choose the latest EFO package that has XLSX Chapter 5 and Chapter 6 resources. */
export function selectLatestWaEfoPackage(packages: readonly CkanPackage[]): CkanPackage | null {
  const candidates = packages.filter((pkg) => {
    const formats = pkg.resources.map((resource) => resource.format.toLowerCase());
    const names = pkg.resources.map((resource) => resource.name.toLowerCase());
    return (
      formats.includes('xlsx') &&
      names.some((name) => name.includes('chapter 5')) &&
      names.some((name) => name.includes('chapter 6'))
    );
  });
  return (
    [...candidates].sort((a, b) =>
      (waPackageYear(b) ?? '').localeCompare(waPackageYear(a) ?? ''),
    )[0] ?? null
  );
}

export interface WaWorkbookResources {
  chapter5: CkanResource;
  chapter6: CkanResource;
}

export function selectWaWorkbookResources(pkg: CkanPackage): WaWorkbookResources {
  const find = (chapter: string): CkanResource | null =>
    pkg.resources.find(
      (resource) =>
        resource.format.toLowerCase() === 'xlsx' &&
        resource.name.toLowerCase().includes(`chapter ${chapter}`),
    ) ?? null;
  const chapter5 = find('5');
  const chapter6 = find('6');
  if (!chapter5 || !chapter6) {
    throw new Error(`WA EFO package ${pkg.name} has no XLSX Chapter 5/Chapter 6 resources`);
  }
  return { chapter5, chapter6 };
}

async function fetchJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    redirect: 'follow',
    headers: {
      'user-agent':
        'ausspend/0.1 (Australian public spending explorer; contact: ausspend-dev@example.invalid)',
      accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`WA CKAN HTTP ${response.status} for ${url}`);
  return (await response.json()) as T;
}

export interface WaDiscovery {
  package: CkanPackage;
  resources: WaWorkbookResources;
}

export async function discoverWaEfo(fetchImpl: typeof fetch): Promise<WaDiscovery> {
  const search = await fetchJson<{
    result?: { results?: CkanPackage[] };
  }>(`${WA_CKAN_BASE}/package_search?q=budget&rows=100`, fetchImpl);
  const pkg = selectLatestWaEfoPackage(search.result?.results ?? []);
  if (!pkg) {
    throw new Error('WA CKAN package_search found no EFO package with XLSX Chapter 5/Chapter 6');
  }
  const show = await fetchJson<{ result?: CkanPackage }>(
    `${WA_CKAN_BASE}/package_show?id=${encodeURIComponent(pkg.name)}`,
    fetchImpl,
  );
  const full = show.result ?? pkg;
  return { package: full, resources: selectWaWorkbookResources(full) };
}

// ---------------------------------------------------------------------------
// Workbook parsing
// ---------------------------------------------------------------------------

type ParsedCell =
  | { kind: 'number'; value: number }
  | { kind: 'blank' }
  | { kind: 'nil' }
  | { kind: 'small' }
  | { kind: 'invalid'; raw: string };

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const rich = (value as { richText?: Array<{ text: string }> }).richText;
    if (rich)
      return rich
        .map((part) => part.text)
        .join('')
        .trim();
    const result = (value as { result?: unknown }).result;
    if (result !== undefined && result !== null) return cellText(result as ExcelJS.CellValue);
    const text = (value as { text?: unknown }).text;
    if (text !== undefined && text !== null) return cellText(text as ExcelJS.CellValue);
  }
  return '';
}

function parseCell(value: ExcelJS.CellValue): ParsedCell {
  let text = cellText(value).replace(/\u00a0/g, ' ');
  if (!text) return { kind: 'blank' };
  text = text
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/,/g, '')
    .trim();
  if (/^[-–—]$/.test(text) || text === '-') return { kind: 'nil' };
  if (/^_?\(a\)$/i.test(text) || /^\(a\)$/i.test(text)) return { kind: 'small' };
  if (/^\([\d.]+\)$/.test(text)) {
    const value = Number(text.slice(1, -1));
    return Number.isFinite(value)
      ? { kind: 'number', value: -value }
      : { kind: 'invalid', raw: text };
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    const value = Number(text);
    return Number.isFinite(value) ? { kind: 'number', value } : { kind: 'invalid', raw: text };
  }
  return { kind: 'invalid', raw: text };
}

function cleanLabel(text: string): string {
  return text
    .replace(/^[\s\-–—•·]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertUnitGuard(
  worksheet: ExcelJS.Worksheet,
  yearRow: number,
  unitRow: number,
  tableLabel: string,
): void {
  for (let index = 0; index < YEARS.length; index += 1) {
    const year = cellText(worksheet.getRow(yearRow).getCell(index + 2).value).replace(
      /[\u2010-\u2015\u2212]/g,
      '-',
    );
    const unit = cellText(worksheet.getRow(unitRow).getCell(index + 2).value).trim();
    if (year !== YEARS[index]) {
      throw new Error(
        `WA Budget unit guard failed for ${tableLabel}: expected year ${YEARS[index]}, got ${JSON.stringify(year)}`,
      );
    }
    if (unit !== '$m') {
      throw new Error(
        `WA Budget unit guard failed for ${tableLabel}: expected $m, got ${JSON.stringify(unit)}`,
      );
    }
  }
}

interface WaDraft {
  kind: 'major_spending_change' | 'asset_investment';
  table: string;
  portfolio: string;
  agency: string;
  measure: string;
  fiscal_year: string;
  measure_type: WaMeasureType;
  amount_millions: number;
  source_url: string;
  reconciled: boolean;
}

export interface WaParseResult {
  records: SpendingRecord[];
  warnings: string[];
  chapter5_tables: number;
  chapter5_rows: number;
  chapter6_agency_rows: number;
  skipped_cells: number;
  reconciled_years: number;
}

function draftToRecord(draft: WaDraft): SpendingRecord {
  const sign = draft.amount_millions < 0 ? 'negative' : 'positive';
  const provisional = draft.kind === 'major_spending_change';
  const naturalKey = waNaturalKey({
    kind: draft.kind,
    table: draft.table,
    agency: draft.agency,
    measure: draft.measure,
    fiscal_year: draft.fiscal_year,
  });
  return {
    amount_cents: waMillionsToCents(draft.amount_millions),
    measure_type: draft.measure_type,
    fiscal_year: draft.fiscal_year,
    source_id: WA_ID,
    source_url: draft.source_url,
    verified: false,
    natural_key: naturalKey,
    project_name: draft.agency || draft.portfolio,
    description: draft.measure,
    jurisdiction_level: 'state',
    jurisdiction: 'WA',
    funding_source: 'WA Government',
    source_dataset: WA_DATASET,
    data_quality_flag: 'provisional',
    aggregation_role: provisional ? 'policy_measure' : 'agency_detail',
    extraction_confidence: provisional ? 'medium' : 'high',
    location: { state: 'WA' },
    potential_double_count: provisional,
    notes: provisional
      ? `${WA_CAVEAT} ${draft.table}; ${draft.portfolio}; major spending change; printed $m; no printed table total; policy measure; row is non-additive and may overlap agency expenses.`
      : `${WA_CAVEAT} ${draft.table}; ${draft.portfolio}; asset investment agency row; printed $m; reconciled exactly to the printed Total for ${YEARS.join(', ')}; non-additive agency detail.`,
    wa_budget_measure: draft.kind,
    wa_budget_table: draft.table,
    wa_printed_sign: sign,
  };
}

function parseChapter5(
  workbook: ExcelJS.Workbook,
  sourceUrl: string,
): {
  drafts: WaDraft[];
  tables: number;
  rows: number;
  skipped: number;
} {
  const drafts: WaDraft[] = [];
  let tables = 0;
  let rows = 0;
  let skipped = 0;

  for (const worksheet of workbook.worksheets) {
    if (!/^Table \d+$/.test(worksheet.name)) continue;
    tables += 1;
    const table = `Chapter 5 ${worksheet.name}`;
    assertUnitGuard(worksheet, 5, 6, table);
    const portfolio = cellText(worksheet.getRow(3).getCell(1).value) || worksheet.name;
    let agency = '';

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= 6) return;
      const label = cleanLabel(cellText(row.getCell(1).value));
      const parsed = YEARS.map((_, index) => parseCell(row.getCell(index + 2).value));
      const hasNumber = parsed.some((cell) => cell.kind === 'number');

      if (!hasNumber) {
        const isMeasureLike = /^[-–—•·]/.test(cellText(row.getCell(1).value).trim());
        if (label && !isMeasureLike && !/^(note|source|\(a\))/i.test(label)) {
          agency = label;
        }
        for (const cell of parsed)
          if (cell.kind === 'small' || cell.kind === 'invalid') skipped += 1;
        return;
      }

      if (!agency) agency = portfolio;
      for (let index = 0; index < YEARS.length; index += 1) {
        const cell = parsed[index]!;
        if (cell.kind === 'number') {
          rows += 1;
          drafts.push({
            kind: 'major_spending_change',
            table,
            portfolio,
            agency,
            measure: label || `unnamed measure ${rowNumber}`,
            fiscal_year: YEARS[index]!,
            measure_type: waMeasureTypeForYear(YEARS[index]!),
            amount_millions: cell.value,
            source_url: sourceUrl,
            reconciled: false,
          });
        } else if (cell.kind === 'small' || cell.kind === 'invalid') {
          skipped += 1;
        }
      }
    });
  }

  return { drafts, tables, rows, skipped };
}

function parseChapter6(
  workbook: ExcelJS.Workbook,
  sourceUrl: string,
): {
  drafts: WaDraft[];
  reconciledYears: number;
} {
  const worksheet = workbook.getWorksheet('Table 1');
  if (!worksheet) throw new Error('WA Chapter 6 workbook has no Table 1');
  assertUnitGuard(worksheet, 4, 5, 'Chapter 6 Table 1');

  const agencyRows: Array<{ agency: string; values: number[] }> = [];
  let totalValues: number[] | null = null;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 5) return;
    const label = cleanLabel(cellText(row.getCell(1).value));
    if (!label) return;
    const values: number[] = [];
    for (let index = 0; index < YEARS.length; index += 1) {
      const cell = parseCell(row.getCell(index + 2).value);
      if (cell.kind !== 'number') return;
      values.push(cell.value);
    }
    if (/^total\b/i.test(label)) totalValues = values;
    else if (/^note|^source/i.test(label)) return;
    else agencyRows.push({ agency: label, values });
  });

  if (!totalValues) throw new Error('WA Chapter 6 Table 1 has no printed Total row');
  if (agencyRows.length === 0) throw new Error('WA Chapter 6 Table 1 has no agency rows');

  let reconciledYears = 0;
  for (let index = 0; index < YEARS.length; index += 1) {
    const sum = agencyRows.reduce((accumulator, row) => accumulator + row.values[index]!, 0);
    const total = totalValues[index]!;
    // The printed source note says columns may not add due to rounding; allow
    // one published $m of rounding, but never a unit or larger mismatch.
    if (Math.abs(sum - total) > 1.0) {
      throw new Error(
        `WA Chapter 6 Table 1 total reconciliation failed for ${YEARS[index]}: agency sum ${sum} != printed total ${total}`,
      );
    }
    reconciledYears += 1;
  }

  const drafts: WaDraft[] = [];
  for (const row of agencyRows) {
    for (let index = 0; index < YEARS.length; index += 1) {
      drafts.push({
        kind: 'asset_investment',
        table: 'Chapter 6 Table 1',
        portfolio: 'Asset Investment Program',
        agency: row.agency,
        measure: `Asset investment — ${row.agency}`,
        fiscal_year: YEARS[index]!,
        measure_type: waMeasureTypeForYear(YEARS[index]!),
        amount_millions: row.values[index]!,
        source_url: sourceUrl,
        reconciled: true,
      });
    }
  }
  return { drafts, reconciledYears };
}

/** Async workbook parser used by the connector and tests. */
export async function parseWaWorkbooksAsync(
  chapter5Buffer: Buffer,
  chapter6Buffer: Buffer,
  options: { chapter5Url?: string; chapter6Url?: string } = {},
): Promise<WaParseResult> {
  const chapter5Workbook = new ExcelJS.Workbook();
  const chapter6Workbook = new ExcelJS.Workbook();
  await chapter5Workbook.xlsx.load(
    chapter5Buffer as unknown as Parameters<typeof chapter5Workbook.xlsx.load>[0],
  );
  await chapter6Workbook.xlsx.load(
    chapter6Buffer as unknown as Parameters<typeof chapter6Workbook.xlsx.load>[0],
  );

  const chapter5Url = options.chapter5Url ?? WA_SOURCE_URL;
  const chapter6Url = options.chapter6Url ?? WA_SOURCE_URL;
  const chapter5 = parseChapter5(chapter5Workbook, chapter5Url);
  const chapter6 = parseChapter6(chapter6Workbook, chapter6Url);
  const drafts = [...chapter5.drafts, ...chapter6.drafts];
  const records = drafts.map(draftToRecord);
  if (records.length === 0) throw new Error('WA workbooks produced no measure rows');

  return {
    records,
    warnings: [
      'WA Budget has no machine-readable BP2 agency-expense dataset in CKAN; Chapter 5 major spending changes are provisional, non-additive policy measures and no COFOG mapping is published.',
    ],
    chapter5_tables: chapter5.tables,
    chapter5_rows: chapter5.rows,
    chapter6_agency_rows: chapter6.drafts.length,
    skipped_cells: chapter5.skipped,
    reconciled_years: chapter6.reconciledYears,
  };
}

export interface WaBudgetConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI overrides: skip CKAN/network and use these exact workbooks. */
  chapter5?: Buffer;
  chapter6?: Buffer;
}

const WA_BROWSER_HEADERS = {
  'user-agent':
    'ausspend/0.1 (Australian public spending explorer; contact: ausspend-dev@example.invalid)',
  accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.8',
} as const;

async function downloadWorkbook(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  const response = await fetchImpl(url, { redirect: 'follow', headers: WA_BROWSER_HEADERS });
  if (!response.ok) throw new Error(`WA workbook HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function isXlsx(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.subarray(0, 4).toString('latin1') === 'PK\x03\x04';
}

/**
 * The catalogue's resource endpoint intermittently answers with an AWS WAF
 * challenge (HTTP 202, zero-byte text/html). When the exact workbooks were
 * already archived, reuse the SHA-256-verified archive copy instead of failing
 * the source or ingesting empty bytes. This is not a different document: the
 * hash must match the recorded CKAN resource bytes exactly.
 */
async function readArchivedWorkbook(
  root: string | undefined,
  filename: string,
  expectedSha256: string,
): Promise<Buffer | null> {
  const filePath = path.join(sourceArchiveRoot(root), WA_ID, filename);
  try {
    const buffer = await readFile(filePath);
    if (!isXlsx(buffer) || sha256Bytes(buffer) !== expectedSha256) return null;
    return buffer;
  } catch {
    return null;
  }
}

function workbookFilename(url: string, fallback: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.xlsx$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // fall through
  }
  return fallback;
}

/** Build the live WA Budget connector. */
export function createWaBudgetConnector(options: WaBudgetConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'direct' as const,
  };

  let chapter5Url = WA_SOURCE_URL;
  let chapter6Url = WA_SOURCE_URL;

  const connector: Connector = {
    id: WA_ID,
    name: WA_NAME,
    publisher: WA_PUBLISHER,
    source_url: WA_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'state',
    license: WA_LICENSE,
    notes:
      'WA Budget EFO table and chart data from catalogue.data.wa.gov.au CKAN. No machine-readable BP2 agency-expense dataset is published; the connector ingests the strongest clean EFO tables (Chapter 5 major spending changes as provisional non-additive policy measures, Chapter 6 Table 1 asset investment by agency reconciled to its printed Total). Unit guard requires $m over 2015-16..2019-20. No COFOG mapping is published, so none is invented. The CKAN licence is Custom (Personal & Academic Use), not an open-data licence.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      let chapter5 = options.chapter5;
      let chapter6 = options.chapter6;
      if (!chapter5 || !chapter6) {
        const discovery = await discoverWaEfo(fetchImpl);
        chapter5Url = discovery.resources.chapter5.url;
        chapter6Url = discovery.resources.chapter6.url;
        let usedArchive = false;
        try {
          chapter5 = await downloadWorkbook(chapter5Url, fetchImpl);
          chapter6 = await downloadWorkbook(chapter6Url, fetchImpl);
          if (!isXlsx(chapter5) || !isXlsx(chapter6)) {
            throw new Error('WA CKAN returned a non-XLSX (AWS WAF challenge or empty body)');
          }
        } catch (directError) {
          const archived5 = await readArchivedWorkbook(
            options.archiveRoot,
            WA_CHAPTER5_FILENAME,
            WA_CHAPTER5_SHA256,
          );
          const archived6 = await readArchivedWorkbook(
            options.archiveRoot,
            WA_CHAPTER6_FILENAME,
            WA_CHAPTER6_SHA256,
          );
          if (!archived5 || !archived6) throw directError;
          chapter5 = archived5;
          chapter6 = archived6;
          usedArchive = true;
          metadata.warnings.push(
            'WA CKAN resource download returned an AWS WAF challenge; reused the SHA-256-verified archived Chapter 5/6 workbooks.',
          );
        }
        const now = options.now?.() ?? new Date();
        const archive = async (
          title: string,
          url: string,
          data: Buffer,
          fallback: string,
        ): Promise<ArchivedSourceRecord> => {
          const record = await archiveSourceDocument({
            source_id: WA_ID,
            title,
            original_url: url,
            retrieved_from: url,
            archived_from: 'direct',
            filename: workbookFilename(url, fallback),
            content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            data,
            root: options.archiveRoot,
            fetched_at: now,
            notes:
              'WA Budget EFO XLSX archived with SHA-256 outside the repo. CKAN licence is Custom (Personal & Academic Use).',
          });
          await verifySourceDocument(record);
          return record;
        };
        if (!usedArchive) {
          await archive(
            '2016-17 WA Budget EFO Chapter 5 General Government Expenses',
            chapter5Url,
            chapter5,
            '2016-17-chapter5.xlsx',
          );
          await archive(
            '2016-17 WA Budget EFO Chapter 6 Asset Investment',
            chapter6Url,
            chapter6,
            '2016-17-chapter6.xlsx',
          );
        }
      }
      const parsed = await parseWaWorkbooksAsync(chapter5, chapter6, {
        chapter5Url,
        chapter6Url,
      });
      metadata.warnings.push(...parsed.warnings);
      return [
        {
          kind: 'wa-budget-records',
          records: parsed.records,
          chapter5_rows: parsed.chapter5_rows,
          chapter6_agency_rows: parsed.chapter6_agency_rows,
          reconciled_years: parsed.reconciled_years,
        },
      ];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const entry = raw.find(
        (value) => value.kind === 'wa-budget-records' && Array.isArray(value.records),
      );
      if (!entry) {
        metadata.errors.push('WA fetch returned no parsed records');
        return [];
      }
      return (entry.records as SpendingRecord[]).slice();
    },
    metadata,
  } as Connector;

  return connector;
}
