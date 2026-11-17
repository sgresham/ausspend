import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import type { SpendingRecord } from '@ausspend/shared';
import {
  archiveSourceDocument,
  readArchivedDocument,
  type ArchivedSourceRecord,
} from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * AIHW Health Expenditure Australia 2024-25 (Phase 6.2b correction).
 *
 * The previous Phase 6.2 source was the superseded data.gov.au CSV whose series
 * stopped at 2011-12. This connector uses the current AIHW release's
 * supplementary tables, which publish total health expenditure (current prices)
 * by state/territory, area of expenditure and source of funds for 2022-23,
 * 2023-24 and 2024-25 (tables B1-B24).
 *
 * METEOR is metadata-only, but the AIHW report's "Data tables" resource is a
 * current state x area x funding series. That satisfies the premise falsifier:
 * the connector ships current years, not 2011-12, and documents the exact
 * limitation that the detailed state x area x source tables cover three years.
 *
 * Mapping:
 * - one measure per fiscal_year x state x area_of_expenditure x detailed
 *   funding source;
 * - `function_code: '07'` (COFOG Health) on every row;
 * - `measure_type: actual`, `verified: true`, `data_quality_flag: verified`;
 * - `amount_cents` from published current-price $ million at x100,000,000;
 * - `jurisdiction_level` is federal for Australian Government funding, state
 *   for State and local government funding and other for non-government
 *   funding. Government and non-government are separate, non-additive series.
 *
 * The workbook also prints parent/subtotal rows (Hospital services, Primary
 * health care, Other services, Total recurrent expenditure, Total health
 * expenditure) and total funding columns. Those are used only for internal
 * reconciliation; they are never emitted, so no row double-counts a published
 * leaf area or funding component. All rows are agency_detail and never summed.
 */

export const AIHW_ID = 'aihw-health-expenditure';
export const AIHW_NAME = 'Health Expenditure Australia';
export const AIHW_PUBLISHER = 'Australian Institute of Health and Welfare';
export const AIHW_DATASET = 'AIHW Health Expenditure Australia 2024-25 — Supplementary tables';
export const AIHW_SOURCE_URL =
  'https://www.aihw.gov.au/reports/health-welfare-expenditure/health-expenditure-australia-2024-25/data';
export const AIHW_RESOURCE_URL =
  'https://www.aihw.gov.au/getmedia/44735a41-5372-414e-9a18-d25f7c13fe4c/AIHW-HWE-110-HEA-2024-25-data-tables.xlsx';
export const AIHW_RELEASE = '2024-25';
export const AIHW_SOURCE_DATE = '2026-10-14';
export const AIHW_EXPECTED_SHA256 =
  'e4b98fa8a5ee5506d772af082e33b4cdc3d926ad1186fceba80a35012eeeca5b';
export const AIHW_EXPECTED_BYTES = 841_137;
export const AIHW_FILENAME = 'AIHW-HWE-110-HEA-2024-25-data-tables.xlsx';
export const AIHW_LICENSE = 'Creative Commons Attribution 3.0 Australia';
export const AIHW_ATTRIBUTION =
  'Australian Institute of Health and Welfare, Health expenditure Australia 2024–25: supplementary tables (HWE 110), licensed under CC BY 3.0 Australia.';
export const AIHW_UNIT = 'AUD_millions';
export const AIHW_UNIT_LABEL = '$ million (current prices)';
export const AIHW_UNIT_TO_CENTS = 100_000_000;
export const AIHW_FUNCTION_CODE = '07';
export const AIHW_PRICE_BASIS = 'current_prices';
export const AIHW_FISCAL_YEARS = ['2022-23', '2023-24', '2024-25'] as const;
export type AihwFiscalYear = (typeof AIHW_FISCAL_YEARS)[number];
export const AIHW_MIN_ROWS = 1_000;
export const AIHW_TOTAL_TOLERANCE_MILLIONS = 20;
export const AIHW_CAVEAT =
  'AIHW total health expenditure, current prices, by state/territory, area of expenditure and source of funds. This is actual expenditure, not a budget. Government and non-government funding are separate series and are never summed; Australian Government and State and local government rows may describe the same services, so government rows are non-additive agency detail with potential_double_count. Only published leaf areas and detailed funding components are emitted; parent/subtotal and total columns are used for reconciliation and never published. No cross-state, cross-area, cross-source or cross-year total is created.';

export const AIHW_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
export const AIHW_STATE_NAMES: Readonly<Record<string, string>> = {
  NSW: 'New South Wales',
  VIC: 'Victoria',
  QLD: 'Queensland',
  WA: 'Western Australia',
  SA: 'South Australia',
  TAS: 'Tasmania',
  ACT: 'Australian Capital Territory',
  NT: 'Northern Territory',
};

/** Leaf areas published in the B tables. Parent/subtotal rows are deliberately absent. */
export const AIHW_LEAF_AREAS = [
  'Public hospital services',
  'Private hospitals',
  'Unreferred medical services',
  'Dental services',
  'Other health practitioner services',
  'Community health and other',
  'Public health',
  'Benefit-paid pharmaceuticals',
  'All other medications',
  'Referred medical services',
  'Patient transport services',
  'Aids and appliances',
  'Administration',
  'Research',
  'Capital expenditure',
  'Medical expenses tax rebate',
] as const;
export type AihwLeafArea = (typeof AIHW_LEAF_AREAS)[number];

export type AihwBroadSource = 'Government' | 'Non-government';
export type AihwFundingSector = 'government' | 'non_government';

export interface AihwSourceRule {
  label: string;
  broad: AihwBroadSource;
  sector: AihwFundingSector;
  jurisdiction_level: 'federal' | 'state' | 'other';
  /** Federal funding is Australia-wide; all other rows use the state code. */
  fixed_jurisdiction?: string;
}

export const AIHW_DETAILED_SOURCES: Readonly<Record<string, AihwSourceRule>> = {
  DVA: {
    label: "Department of Veterans' Affairs",
    broad: 'Government',
    sector: 'government',
    jurisdiction_level: 'federal',
    fixed_jurisdiction: 'Australia',
  },
  'Health and other': {
    label: 'Australian Government — health and other',
    broad: 'Government',
    sector: 'government',
    jurisdiction_level: 'federal',
    fixed_jurisdiction: 'Australia',
  },
  'Premium rebates': {
    label: 'Australian Government — health insurance premium rebates',
    broad: 'Government',
    sector: 'government',
    jurisdiction_level: 'federal',
    fixed_jurisdiction: 'Australia',
  },
  'State and local': {
    label: 'State and local government',
    broad: 'Government',
    sector: 'government',
    jurisdiction_level: 'state',
  },
  HIF: {
    label: 'Private health insurance funds',
    broad: 'Non-government',
    sector: 'non_government',
    jurisdiction_level: 'other',
  },
  Individuals: {
    label: 'Individuals',
    broad: 'Non-government',
    sector: 'non_government',
    jurisdiction_level: 'other',
  },
  Other: {
    label: 'Other non-government',
    broad: 'Non-government',
    sector: 'non_government',
    jurisdiction_level: 'other',
  },
};

export const AIHW_SOURCE_COLUMNS: ReadonlyArray<{ column: number; key: string }> = [
  { column: 2, key: 'DVA' },
  { column: 3, key: 'Health and other' },
  { column: 4, key: 'Premium rebates' },
  { column: 6, key: 'State and local' },
  { column: 9, key: 'HIF' },
  { column: 10, key: 'Individuals' },
  { column: 11, key: 'Other' },
];

const TOTAL_COLUMN = 14;
const AREA_COLUMN = 1;

export interface AihwTableSpec {
  sheet: string;
  state: string;
  state_name: string;
  fiscal_year: AihwFiscalYear;
}

const STATE_START_ROWS: Readonly<Record<string, number>> = {
  NSW: 1,
  VIC: 4,
  QLD: 7,
  WA: 10,
  SA: 13,
  TAS: 16,
  ACT: 19,
  NT: 22,
};

export const AIHW_TABLES: readonly AihwTableSpec[] = AIHW_STATES.flatMap((state) =>
  AIHW_FISCAL_YEARS.map((fiscal_year, index) => ({
    sheet: `Table B${STATE_START_ROWS[state]! + index}`,
    state,
    state_name: AIHW_STATE_NAMES[state]!,
    fiscal_year,
  })),
);

export interface AihwSkip {
  table: string;
  row: number;
  reason: string;
}

export interface AihwTableResult {
  sheet: string;
  state: string;
  fiscal_year: string;
  rows: number;
  component_sum_millions: number;
  published_total_millions: number | null;
  difference_millions: number | null;
}

export interface AihwParsedWorkbook {
  records: SpendingRecord[];
  tables: AihwTableResult[];
  skipped: AihwSkip[];
}

/** Convert published current-price $ million to integer cents. */
export function aihwMillionsToCents(millions: number): number {
  const cents = Math.round(millions * AIHW_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`AIHW amount ${millions} $m is outside the safe integer cent range`);
  }
  return cents;
}

export function aihwNaturalKey(parts: {
  fiscal_year: string;
  state: string;
  area: string;
  detailed: string;
  price_basis: string;
}): string {
  const digest = createHash('sha256')
    .update(
      [AIHW_ID, parts.fiscal_year, parts.state, parts.area, parts.detailed, parts.price_basis].join(
        '|',
      ),
    )
    .digest('hex');
  return `${AIHW_ID}:${digest}`;
}

function worksheetCellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if ('text' in value && typeof (value as { text?: unknown }).text === 'string') {
      return (value as { text: string }).text;
    }
    if ('result' in value) return (value as { result?: unknown }).result ?? null;
    if ('richText' in value) {
      return (value as { richText: Array<{ text: string }> }).richText
        .map((part) => part.text)
        .join('');
    }
    if (value instanceof Date) return value.toISOString();
  }
  return value;
}

function stringCell(cell: ExcelJS.Cell): string {
  const value = worksheetCellValue(cell);
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a published numeric cell. `. .` means not applicable, `—` means rounded
 * to zero and a blank means no value; all three are returned as null and are
 * never converted to a fabricated 0.
 */
export function parseAihwNumber(cell: ExcelJS.Cell): number | null {
  const value = worksheetCellValue(cell);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text === '. .' || text === '—' || text === '-') return null;
  const numeric = Number(text.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function requireHeader(
  sheet: ExcelJS.Worksheet,
  column: number,
  expected: string,
  table: string,
): void {
  const actual = stringCell(sheet.getRow(4).getCell(column));
  if (actual !== expected) {
    throw new Error(
      `AIHW ${table} column ${column} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );
  }
}

export function parseAihwSheet(
  sheet: ExcelJS.Worksheet,
  spec: AihwTableSpec,
): AihwTableResult & { records: SpendingRecord[]; skipped: AihwSkip[] } {
  requireHeader(sheet, AREA_COLUMN, 'Area of expenditure', spec.sheet);
  requireHeader(sheet, 2, 'DVA', spec.sheet);
  requireHeader(sheet, 3, 'Health and other', spec.sheet);
  requireHeader(sheet, 4, 'Premium rebates', spec.sheet);
  requireHeader(sheet, 6, 'State and local', spec.sheet);
  requireHeader(sheet, 9, 'HIF', spec.sheet);
  requireHeader(sheet, 10, 'Individuals', spec.sheet);
  requireHeader(sheet, 11, 'Other', spec.sheet);
  requireHeader(sheet, TOTAL_COLUMN, 'Total health expenditure', spec.sheet);

  const leafSet = new Set<string>(AIHW_LEAF_AREAS);
  const records: SpendingRecord[] = [];
  const skipped: AihwSkip[] = [];
  let componentSum = 0;
  let emitted = 0;

  for (let rowIndex = 5; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const area = stringCell(row.getCell(AREA_COLUMN));
    if (!area) continue;
    if (!leafSet.has(area)) continue;

    for (const { column, key } of AIHW_SOURCE_COLUMNS) {
      const rule = AIHW_DETAILED_SOURCES[key];
      if (!rule) throw new Error(`AIHW unknown detailed source ${key}`);
      const value = parseAihwNumber(row.getCell(column));
      if (value === null) {
        skipped.push({
          table: spec.sheet,
          row: rowIndex,
          reason: `${area} / ${key}: no published numeric value`,
        });
        continue;
      }
      const sign: 'positive' | 'negative' = value < 0 ? 'negative' : 'positive';
      const naturalKey = aihwNaturalKey({
        fiscal_year: spec.fiscal_year,
        state: spec.state,
        area,
        detailed: rule.label,
        price_basis: AIHW_PRICE_BASIS,
      });
      const jurisdiction = rule.fixed_jurisdiction ?? spec.state;
      const record: SpendingRecord = {
        function_code: AIHW_FUNCTION_CODE,
        amount_cents: aihwMillionsToCents(Math.abs(value)),
        measure_type: 'actual',
        fiscal_year: spec.fiscal_year,
        source_id: AIHW_ID,
        source_url: AIHW_RESOURCE_URL,
        verified: true,
        natural_key: naturalKey,
        description: `${area} — ${rule.broad} funding: ${rule.label} (${spec.state}, ${spec.fiscal_year})`,
        jurisdiction_level: rule.jurisdiction_level,
        jurisdiction,
        funding_source: rule.label,
        source_dataset: AIHW_DATASET,
        data_quality_flag: 'verified',
        aggregation_role: 'agency_detail',
        location: { state: spec.state },
        notes: `${AIHW_CAVEAT} Source: ${AIHW_DATASET}, ${spec.sheet}. Published unit: ${AIHW_UNIT_LABEL}; converted explicitly at ${AIHW_UNIT_TO_CENTS} cents per $m.`,
        potential_double_count: rule.sector === 'government',
        aihw_broad_source_of_funding: rule.broad,
        aihw_detailed_source_of_funding: rule.label,
        aihw_area_of_expenditure: area,
        aihw_state: spec.state,
        aihw_funding_sector: rule.sector,
        aihw_price_basis: AIHW_PRICE_BASIS,
        aihw_table: spec.sheet,
        aihw_release: AIHW_RELEASE,
        aihw_unit: AIHW_UNIT,
        ...(sign === 'negative' ? { aihw_printed_sign: sign } : {}),
      };
      records.push(record);
      componentSum += value;
      emitted += 1;
    }
  }

  const publishedTotal = parseAihwNumber(sheet.getRow(25).getCell(TOTAL_COLUMN));
  return {
    sheet: spec.sheet,
    state: spec.state,
    fiscal_year: spec.fiscal_year,
    rows: emitted,
    component_sum_millions: componentSum,
    published_total_millions: publishedTotal,
    difference_millions: publishedTotal === null ? null : Math.abs(componentSum - publishedTotal),
    records,
    skipped,
  };
}

export function parseAihwWorkbook(workbook: ExcelJS.Workbook): AihwParsedWorkbook {
  const records: SpendingRecord[] = [];
  const tables: AihwTableResult[] = [];
  const skipped: AihwSkip[] = [];
  for (const spec of AIHW_TABLES) {
    const sheet = workbook.getWorksheet(spec.sheet);
    if (!sheet) throw new Error(`AIHW workbook is missing ${spec.sheet}`);
    const title = stringCell(sheet.getRow(1).getCell(AREA_COLUMN));
    if (!title.includes(spec.state_name) || !title.includes(spec.fiscal_year.replace('-', '–'))) {
      throw new Error(
        `AIHW ${spec.sheet} title ${JSON.stringify(title)} does not name ${spec.state_name} ${spec.fiscal_year}`,
      );
    }
    const parsed = parseAihwSheet(sheet, spec);
    records.push(...parsed.records);
    tables.push({
      sheet: parsed.sheet,
      state: parsed.state,
      fiscal_year: parsed.fiscal_year,
      rows: parsed.rows,
      component_sum_millions: parsed.component_sum_millions,
      published_total_millions: parsed.published_total_millions,
      difference_millions: parsed.difference_millions,
    });
    skipped.push(...parsed.skipped);
  }
  return { records, tables, skipped };
}

/**
 * Premise gate: current state x area x funding tables must be present for all
 * eight states and all three current years, with at least 1,000 rows mapping to
 * COFOG 07, and each table's emitted components must reconcile to the published
 * total within the published rounded-$m tolerance.
 */
export function assertAihwPremise(parsed: AihwParsedWorkbook): void {
  if (parsed.tables.length !== 24) {
    throw new Error(`AIHW parsed ${parsed.tables.length} tables, expected 24`);
  }
  if (parsed.records.length < AIHW_MIN_ROWS) {
    throw new Error(
      `AIHW produced ${parsed.records.length} rows, expected at least ${AIHW_MIN_ROWS}`,
    );
  }
  const years = new Set(parsed.tables.map((table) => table.fiscal_year));
  for (const year of AIHW_FISCAL_YEARS) {
    if (!years.has(year)) throw new Error(`AIHW current year ${year} is missing`);
  }
  if (!years.has('2024-25')) {
    throw new Error('AIHW does not include the current 2024-25 year');
  }
  for (const table of parsed.tables) {
    if (table.published_total_millions === null) {
      throw new Error(`AIHW ${table.sheet} has no published total health expenditure`);
    }
    if (
      table.difference_millions === null ||
      table.difference_millions > AIHW_TOTAL_TOLERANCE_MILLIONS
    ) {
      throw new Error(
        `AIHW ${table.sheet} components sum to ${table.component_sum_millions} vs published ${table.published_total_millions} (tolerance ${AIHW_TOTAL_TOLERANCE_MILLIONS})`,
      );
    }
  }
  for (const record of parsed.records) {
    if (record.function_code !== AIHW_FUNCTION_CODE) {
      throw new Error(`AIHW row ${record.natural_key} is not COFOG 07`);
    }
    if (record.measure_type !== 'actual' || record.aggregation_role !== 'agency_detail') {
      throw new Error(`AIHW row ${record.natural_key} is not actual non-additive detail`);
    }
  }
}

export function buildAihwRecords(workbook: ExcelJS.Workbook): AihwParsedWorkbook {
  const parsed = parseAihwWorkbook(workbook);
  assertAihwPremise(parsed);
  return parsed;
}

export async function readAihwWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

export interface AihwConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  /** Test/CLI override: adopt this exact workbook instead of fetching. */
  workbookPath?: string;
  now?: () => Date;
}

export interface AihwLoadedSource {
  records: SpendingRecord[];
  archive: ArchivedSourceRecord;
  parsed: AihwParsedWorkbook;
  warnings: string[];
}

async function archiveWorkbook(options: AihwConnectorOptions): Promise<ArchivedSourceRecord> {
  const supplied = options.workbookPath ? await readFile(options.workbookPath) : undefined;
  return archiveSourceDocument({
    source_id: AIHW_ID,
    title: AIHW_DATASET,
    original_url: AIHW_RESOURCE_URL,
    retrieved_from: AIHW_RESOURCE_URL,
    archived_from: 'direct',
    filename: AIHW_FILENAME,
    content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
    ...(supplied ? { data: supplied } : {}),
    ...(options.now ? { fetched_at: options.now() } : {}),
    notes:
      `Official AIHW Health expenditure Australia 2024-25 report data page: ${AIHW_SOURCE_URL}. ` +
      `Release ${AIHW_RELEASE}, published ${AIHW_SOURCE_DATE}. Licensed CC BY 3.0 Australia. ` +
      'Workbook archived outside the repo and never redistributed; only derived rows are emitted.',
  });
}

function verifyArchive(archive: ArchivedSourceRecord): void {
  if (archive.sha256 !== AIHW_EXPECTED_SHA256) {
    throw new Error(
      `AIHW workbook SHA-256 ${archive.sha256} does not match ${AIHW_EXPECTED_SHA256}`,
    );
  }
  if (archive.bytes !== AIHW_EXPECTED_BYTES) {
    throw new Error(`AIHW workbook is ${archive.bytes} bytes, expected ${AIHW_EXPECTED_BYTES}`);
  }
}

export async function loadAihwSource(
  options: AihwConnectorOptions = {},
): Promise<AihwLoadedSource> {
  const archive = await archiveWorkbook(options);
  // A caller-supplied workbook is a local/test override; the live download is
  // always hash-gated against the documented SHA-256.
  if (!options.workbookPath) verifyArchive(archive);
  const bytes = await readArchivedDocument(archive);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const parsed = buildAihwRecords(workbook);
  const warnings = [
    `tables=${parsed.tables.length} rows=${parsed.records.length} states=${new Set(parsed.records.map((record) => record.aihw_state)).size} years=${[...new Set(parsed.records.map((record) => record.fiscal_year))].sort().join(',')}`,
    `cofog=07 rows=${parsed.records.filter((record) => record.function_code === AIHW_FUNCTION_CODE).length}`,
    `government_rows=${parsed.records.filter((record) => record.aihw_funding_sector === 'government').length} non_government_rows=${parsed.records.filter((record) => record.aihw_funding_sector === 'non_government').length}`,
    `skipped_non_numeric_cells=${parsed.skipped.length}`,
  ];
  return { records: parsed.records, archive, parsed, warnings };
}

export interface AihwManifest {
  dataset: string;
  release: string;
  source_url: string;
  resource_url: string;
  source_date: string;
  license: string;
  attribution: string;
  caveat: string;
  sha256: string;
  bytes: number;
  unit: string;
  price_basis: string;
  function_code: string;
  states: string[];
  fiscal_years: string[];
  rows_emitted: number;
  government_rows: number;
  non_government_rows: number;
  tables: AihwTableResult[];
  coverage_note: string;
  notes: string;
}

export function aihwManifest(
  parsed: AihwParsedWorkbook,
  archive: Pick<ArchivedSourceRecord, 'sha256' | 'bytes'>,
): AihwManifest {
  return {
    dataset: AIHW_DATASET,
    release: AIHW_RELEASE,
    source_url: AIHW_SOURCE_URL,
    resource_url: AIHW_RESOURCE_URL,
    source_date: AIHW_SOURCE_DATE,
    license: AIHW_LICENSE,
    attribution: AIHW_ATTRIBUTION,
    caveat: AIHW_CAVEAT,
    sha256: archive.sha256,
    bytes: archive.bytes,
    unit: `${AIHW_UNIT} (${AIHW_UNIT_LABEL}); explicit conversion at ${AIHW_UNIT_TO_CENTS} cents per $m`,
    price_basis: AIHW_PRICE_BASIS,
    function_code: AIHW_FUNCTION_CODE,
    states: [...AIHW_STATES],
    fiscal_years: [...AIHW_FISCAL_YEARS],
    rows_emitted: parsed.records.length,
    government_rows: parsed.records.filter((record) => record.aihw_funding_sector === 'government')
      .length,
    non_government_rows: parsed.records.filter(
      (record) => record.aihw_funding_sector === 'non_government',
    ).length,
    tables: parsed.tables,
    coverage_note:
      'The current AIHW 2024-25 release publishes state x area x source detail for 2022-23, 2023-24 and 2024-25 only. The superseded 1997-98..2011-12 data.gov.au CSV is not treated as current and is not shipped as current coverage.',
    notes:
      'Derived rows only; workbook not redistributed. Leaf areas and detailed funding components only; parent/subtotal and total columns are used for reconciliation and not emitted. Government and non-government funding are separate and never summed; no cross-state/area/source/year total.',
  };
}

export function createAihwHealthExpenditureConnector(
  options: AihwConnectorOptions = {},
): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'direct' as const,
  };

  return {
    id: AIHW_ID,
    name: AIHW_NAME,
    publisher: AIHW_PUBLISHER,
    source_url: AIHW_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'federal',
    license: AIHW_LICENSE,
    notes: `${AIHW_CAVEAT} ${AIHW_ATTRIBUTION}`,
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const loaded = await loadAihwSource(options);
      metadata.warnings = loaded.warnings;
      return loaded.records as unknown as RawRecord[];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      return raw.filter((entry) => entry.source_id === AIHW_ID) as unknown as SpendingRecord[];
    },
    metadata,
  };
}
