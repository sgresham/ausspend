import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { SpendingRecord } from '@ausspend/shared';
import { archiveSourceDocument, verifySourceDocument } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * Tasmanian Local Government Consolidated Data Collection (CDC).
 *
 * The LIST Open Data page links two statewide ZIP repositories. The latest
 * (2015-2025) contains one MASTER XLSX with ten financial years and all 29
 * Tasmanian councils. The workbook prints whole Australian dollars (not $'000):
 * the magnitude guard rejects a thousand-dollar reading, and revenue/expense
 * and asset/liability totals reconcile within $1. This phase ingests the three
 * most recent complete years (FY2022-23..FY2024-25) from the Financial Data
 * sheet; older years and the other CDC sheets/resources are documented only.
 */

export const TAS_LG_CDC_ID = 'tas-lg-cdc';
export const TAS_LG_CDC_NAME = 'Tasmanian local government Consolidated Data Collection';
export const TAS_LG_CDC_PUBLISHER = 'Local Government Association of Tasmania / LIST';
export const TAS_LG_CDC_SOURCE_URL = 'https://listdata.thelist.tas.gov.au/opendata/';
export const TAS_LG_CDC_LICENSE =
  '© Tasmanian Local Government Association / LIST. Public CDC data used for public-interest research; not an open-data licence grant.';
export const TAS_LG_CDC_DATASET = 'TAS Local Government CDC — Financial Data';
export const TAS_LG_CDC_UNIT_DOLLARS = 'AUD';
export const TAS_LG_CDC_UNIT_THOUSANDS = 'AUD_thousands';
export const TAS_LG_CDC_COUNCIL_COUNT = 29;
export const TAS_LG_CDC_CAVEAT =
  'Tasmanian local government CDC Financial Data, council-level actual financial/asset snapshot. Whole dollars or $’000 as detected per workbook; never mix units, never create a cross-council/year total, and never add to tas-budget or other state data.';

export interface CdcFinancialMeasureSpec {
  key: string;
  label: string;
  column: string;
}

export const TAS_LG_CDC_MEASURES: readonly CdcFinancialMeasureSpec[] = [
  {
    key: 'total_operating_revenue',
    label: 'Total operating revenue',
    column: 'Total Operating Revenue',
  },
  {
    key: 'total_operating_expenses',
    label: 'Total operating expenses',
    column: 'Total Operating Expenses',
  },
  {
    key: 'capital_expenditure_existing_assets',
    label: 'Capital expenditure on existing assets',
    column: 'Capital expenditure on existing assets',
  },
  {
    key: 'capital_expenditure_new_assets',
    label: 'Capital expenditure on new assets',
    column: 'Capital expenditure on new assets',
  },
  { key: 'total_assets', label: 'Total assets', column: 'Total assets' },
  { key: 'total_liabilities', label: 'Total liabilities', column: 'Total Liabilities' },
  { key: 'net_assets', label: 'Net assets', column: 'Net Assets' },
  { key: 'working_capital', label: 'Working capital', column: 'Working Capital' },
];

const CDC_SURPLUS_COLUMN = 'Annual Operational Surplus/(Deficit)';

export interface CdcFinancialRow {
  council: string;
  year: string;
  values: Record<string, number | null>;
}

function cleanText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : value === null || value === undefined
      ? ''
      : String(value).trim();
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/,/g, '');
  if (!text || /^(na|n\/a|-|–)$/i.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fiscalYearFromCdc(raw: string): string | null {
  const match = /^(\d{4})-(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return null;
  return `${start}-${String(end).slice(-2)}`;
}

export function tasLgCdcNaturalKey(parts: {
  council: string;
  fiscalYear: string;
  measure: string;
}): string {
  const digest = createHash('sha256')
    .update([TAS_LG_CDC_ID, parts.council, parts.fiscalYear, parts.measure].join('|'))
    .digest('hex')
    .slice(0, 40);
  return `${TAS_LG_CDC_ID}:${digest}`;
}

function normalizeHeader(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/\s+/g, ' ');
}

/** Read the `Financial Data` sheet into council/year/value rows. */
export async function readCdcFinancialWorkbook(buffer: Buffer): Promise<CdcFinancialRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet('Financial Data');
  if (!sheet) throw new Error('TAS CDC workbook has no Financial Data sheet');
  const columns = new Map<string, number>();
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    const header = normalizeHeader(sheet.getRow(1).getCell(column).value);
    if (header) columns.set(header, column);
  }
  const indexes = new Map<string, number>();
  for (const spec of TAS_LG_CDC_MEASURES) {
    const index = columns.get(normalizeHeader(spec.column));
    if (!index) throw new Error(`TAS CDC Financial Data is missing column ${spec.column}`);
    indexes.set(spec.key, index);
  }
  const surplusIndex = columns.get(normalizeHeader(CDC_SURPLUS_COLUMN));
  if (!surplusIndex) {
    throw new Error(`TAS CDC Financial Data is missing column ${CDC_SURPLUS_COLUMN}`);
  }
  const rows: CdcFinancialRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const council = cleanText(row.getCell(1).value);
    const year = cleanText(row.getCell(2).value);
    if (!council || !year) continue;
    const values: Record<string, number | null> = {};
    for (const spec of TAS_LG_CDC_MEASURES) {
      values[spec.key] = numeric(row.getCell(indexes.get(spec.key)!).value);
    }
    values.annual_operating_surplus_deficit = numeric(row.getCell(surplusIndex).value);
    rows.push({ council, year, values });
  }
  if (rows.length === 0) throw new Error('TAS CDC Financial Data sheet has no council-year rows');
  return rows;
}

/** Detect the printed unit from the total-assets magnitude; refuse ambiguity. */
export function detectCdcUnit(rows: readonly CdcFinancialRow[]): 'AUD' | 'AUD_thousands' {
  const assets = rows
    .map((row) => row.values.total_assets)
    .filter((value): value is number => typeof value === 'number' && value > 0)
    .sort((a, b) => a - b);
  if (assets.length === 0)
    throw new Error('TAS CDC has no positive total-assets values for unit detection');
  const median = assets[Math.floor(assets.length / 2)]!;
  if (median >= 10_000_000) return 'AUD';
  if (median >= 10_000 && median < 10_000_000) return 'AUD_thousands';
  throw new Error(
    `TAS CDC total-assets median ${median} is outside a defensible dollar/$'000 range`,
  );
}

export interface CdcParseOptions {
  sourceDate: string;
  sourceUrl: string;
  years?: readonly string[];
}

export interface CdcParseResult {
  records: SpendingRecord[];
  unit: 'AUD' | 'AUD_thousands';
  unitToCents: number;
  years: string[];
  councils: number;
  rejected: number;
}

export function parseCdcFinancialRows(
  rows: readonly CdcFinancialRow[],
  options: CdcParseOptions,
): CdcParseResult {
  const yearGroups = new Map<string, CdcFinancialRow[]>();
  for (const row of rows) {
    const fiscalYear = fiscalYearFromCdc(row.year);
    if (!fiscalYear) continue;
    const group = yearGroups.get(fiscalYear) ?? [];
    group.push(row);
    yearGroups.set(fiscalYear, group);
  }
  const requested = options.years ? [...options.years] : [...yearGroups.keys()].sort().slice(-3);
  const selected: CdcFinancialRow[] = [];
  for (const year of requested) {
    const group = yearGroups.get(year) ?? [];
    const councils = new Set(group.map((row) => row.council));
    if (councils.size !== TAS_LG_CDC_COUNCIL_COUNT) {
      throw new Error(
        `TAS CDC ${year} has ${councils.size} councils, expected ${TAS_LG_CDC_COUNCIL_COUNT}; refusing to present an incomplete year`,
      );
    }
    selected.push(...group);
  }
  if (selected.length === 0) throw new Error('TAS CDC has no requested complete council-year rows');
  const unit = detectCdcUnit(selected);
  const unitToCents = unit === 'AUD' ? 100 : 100_000;
  const records: SpendingRecord[] = [];
  let rejected = 0;
  for (const row of selected) {
    const fiscalYear = fiscalYearFromCdc(row.year);
    if (!fiscalYear) {
      rejected += 1;
      continue;
    }
    const revenue = row.values.total_operating_revenue ?? null;
    const expenses = row.values.total_operating_expenses ?? null;
    const printedSurplus = row.values.annual_operating_surplus_deficit ?? null;
    if (revenue !== null && expenses !== null && printedSurplus !== null) {
      if (Math.abs(revenue - expenses - printedSurplus) > 1.5) {
        throw new Error(
          `TAS CDC revenue/expense reconciliation failed for ${row.council} ${fiscalYear}`,
        );
      }
    }
    const assets = row.values.total_assets ?? null;
    const liabilities = row.values.total_liabilities ?? null;
    const net = row.values.net_assets ?? null;
    if (
      assets !== null &&
      liabilities !== null &&
      net !== null &&
      Math.abs(assets - liabilities - net) > 1.5
    ) {
      throw new Error(
        `TAS CDC asset/liability reconciliation failed for ${row.council} ${fiscalYear}`,
      );
    }
    for (const spec of TAS_LG_CDC_MEASURES) {
      const value = row.values[spec.key];
      if (value === null || value === undefined || value < 0) continue;
      records.push({
        amount_cents: Math.round(value * unitToCents),
        measure_type: 'actual',
        fiscal_year: fiscalYear,
        source_id: TAS_LG_CDC_ID,
        source_url: options.sourceUrl,
        verified: false,
        natural_key: tasLgCdcNaturalKey({ council: row.council, fiscalYear, measure: spec.key }),
        project_name: row.council,
        description: spec.label,
        jurisdiction_level: 'local',
        jurisdiction: 'TAS',
        delivery_entity: row.council,
        funding_source: 'Tasmanian local government',
        source_dataset: TAS_LG_CDC_DATASET,
        source_date: options.sourceDate,
        data_quality_flag: 'provisional',
        aggregation_role: 'agency_detail',
        extraction_confidence: 'high',
        location: { state: 'TAS', lga_name: row.council },
        category: spec.key,
        notes: `${TAS_LG_CDC_CAVEAT} Sheet: Financial Data; printed column: ${spec.column}; printed year: ${row.year}; unit: ${unit}; council-year actual; no cross-council total; not audited GPFS.`,
      });
    }
  }
  return {
    records,
    unit,
    unitToCents,
    years: requested,
    councils: new Set(selected.map((row) => row.council)).size,
    rejected,
  };
}

export function parseCdcRepositoryLinks(js: string): string[] {
  const links = new Set<string>();
  for (const match of js.matchAll(/(LGA_CDC_Data_Repository_\d{4}-\d{4}\.zip)/g)) {
    links.add(`https://listdata.thelist.tas.gov.au/opendata/data/${match[1]!}`);
  }
  return [...links].sort();
}

export function selectLatestCdcRepository(links: readonly string[]): string {
  const repositories = links.filter((url) => /LGA_CDC_Data_Repository_\d{4}-\d{4}\.zip$/.test(url));
  if (repositories.length === 0) throw new Error('LIST CDC page has no repository ZIP link');
  return repositories.sort((a, b) => {
    const end = (url: string) => Number(/-(\d{4})\.zip$/.exec(url)?.[1] ?? 0);
    return end(b) - end(a);
  })[0]!;
}

export interface TasLgCdcOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test override: LIST opendata JS and repository ZIP bytes. */
  listJs?: string;
  zipBytes?: Buffer;
  workbookBuffer?: Buffer;
}

export function createTasLgCdcConnector(options: TasLgCdcOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'direct' as const,
  };

  return {
    id: TAS_LG_CDC_ID,
    name: TAS_LG_CDC_NAME,
    publisher: TAS_LG_CDC_PUBLISHER,
    source_url: TAS_LG_CDC_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: TAS_LG_CDC_LICENSE,
    notes:
      'Tasmanian local government CDC LIST Open Data ZIP repositories: Financial Data sheet for the three most recent complete years (FY2022-23..FY2024-25), all 29 councils, whole-dollar unit detection with revenue/expense and asset/liability reconciliation. Other CDC sheets/resources and older years are documented but not ingested; no cross-council total and never combined with tas-budget.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      let listJs = options.listJs;
      if (!listJs) {
        const response = await fetchImpl(
          'https://listdata.thelist.tas.gov.au/opendata/resources/opendata.js',
          { headers: { accept: 'text/javascript' } },
        );
        if (!response.ok) throw new Error(`LIST CDC JS HTTP ${response.status}`);
        listJs = await response.text();
      }
      const links = parseCdcRepositoryLinks(listJs);
      const repositoryUrl = selectLatestCdcRepository(links);
      let zipBytes = options.zipBytes;
      if (!zipBytes) {
        const response = await fetchImpl(repositoryUrl, { headers: { accept: 'application/zip' } });
        if (!response.ok) throw new Error(`LIST CDC ZIP HTTP ${response.status}`);
        zipBytes = Buffer.from(await response.arrayBuffer());
      }
      const now = options.now?.() ?? new Date();
      const archive = await archiveSourceDocument({
        source_id: TAS_LG_CDC_ID,
        title: 'Tasmanian Local Government CDC repository',
        original_url: repositoryUrl,
        retrieved_from: repositoryUrl,
        archived_from: 'direct',
        filename: repositoryUrl.split('/').pop() ?? 'LGA_CDC_Data_Repository.zip',
        content_type: 'application/zip',
        data: zipBytes,
        root: options.archiveRoot,
        fetched_at: now,
        notes:
          'Official LIST statewide CDC repository ZIP, archived with SHA-256 outside the repo.',
      });
      await verifySourceDocument(archive);
      let workbookBuffer = options.workbookBuffer;
      if (!workbookBuffer) {
        const zip = await JSZip.loadAsync(zipBytes);
        const xlsxEntry = Object.values(zip.files).find((entry) => /\.xlsx$/i.test(entry.name));
        if (!xlsxEntry) throw new Error('CDC repository ZIP has no XLSX workbook');
        workbookBuffer = await xlsxEntry.async('nodebuffer');
      }
      const rows = await readCdcFinancialWorkbook(workbookBuffer);
      const parsed = parseCdcFinancialRows(rows, {
        sourceDate: now.toISOString().slice(0, 10),
        sourceUrl: repositoryUrl,
      });
      metadata.warnings.push(
        `TAS CDC: repository=${repositoryUrl}; unit=${parsed.unit}; years=${parsed.years.join(',')}; councils=${parsed.councils}; records=${parsed.records.length}`,
      );
      return [{ kind: 'tas-lg-cdc-records', records: parsed.records }];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const entry = raw.find(
        (value) => value.kind === 'tas-lg-cdc-records' && Array.isArray(value.records),
      );
      if (!entry) {
        metadata.errors.push('TAS CDC fetch returned no parsed records');
        return [];
      }
      return (entry.records as SpendingRecord[]).slice();
    },
    metadata,
  };
}
