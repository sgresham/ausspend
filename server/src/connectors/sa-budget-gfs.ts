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
 * South Australian State Government Finance Statistics — general government
 * sector expenses by function (GPC) and economic type (ETF).
 *
 * Source: data.sa.gov.au CKAN package
 * `general-government-sector-expenses-by-function-and-by-economic-type`,
 * published by the South Australian Department of Treasury and Finance under
 * CC BY 4.0. The workbook has one sheet per financial year (2012-13..2015-16);
 * each row is a Government Purpose Classification (GPC) function and each
 * column is an economic type (ETF), plus a printed `Total GPC` column and a
 * printed `TOTAL` row.
 *
 * GPC is Australia's government-purpose classification, based on COFOG but not
 * identical to it. The connector maps the GPC division (first two digits) to a
 * valid COFOG division explicitly:
 *
 *   01 -> 01 General public services      03 -> 03 Public order and safety
 *   04 -> 09 Education                    05 -> 07 Health
 *   06 -> 10 Social protection            07 -> 06 Housing and community amenities
 *   08 -> 08 Recreation, culture and religion
 *   09,10,11,12,13 -> 04 Economic affairs
 *   14 -> 01 General public services
 *
 * GPC 3450 (`Nominal superannuation interest expense`) is a non-COFOG
 * memorandum item and is excluded from published rows; it is still read for
 * reconciliation.
 *
 * UNIT: values are whole thousands of dollars. The connector detects this from
 * the printed grand total (2015-16: 17,062,490), which is $17.06 billion when
 * multiplied by 1,000; it is not plausible as whole dollars. The unit is stored
 * explicitly (`AUD_thousands`) and converted at 100,000 cents per thousand.
 *
 * MEASURE TYPE: the workbook has no budget/actual column. It is the annual GFS
 * actual/outcome matrix reported to the ABS, so every row is `actual`; the
 * source note records that basis.
 *
 * NO SUM: every emitted row is one function × economic-type component. Parent
 * totals (`Total GPC`) and the `TOTAL` row are never emitted. Rows are
 * `agency_detail`; no cross-function, cross-year or cross-source total is
 * created by this connector.
 */

export const SA_GFS_ID = 'sa-budget-gfs';
export const SA_GFS_NAME = 'South Australian State Government Finance Statistics';
export const SA_GFS_PUBLISHER = 'Department of Treasury and Finance, South Australia';
export const SA_GFS_DATASET = 'General government sector expenses by function and by economic type';
export const SA_GFS_SOURCE_URL =
  'https://data.sa.gov.au/data/dataset/general-government-sector-expenses-by-function-and-by-economic-type';
export const SA_GFS_RESOURCE_URL =
  'https://data.sa.gov.au/data/dataset/e77f59d9-3df9-43ad-acf0-b7f8928ee827/resource/3f756590-9e67-4a05-97a0-f594247d2c72/download/cusersdellak01desktopgpc-by-etf-2015-16-to-2012-13.xlsx';
export const SA_GFS_FILENAME = 'cusersdellak01desktopgpc-by-etf-2015-16-to-2012-13.xlsx';
export const SA_GFS_SHA256 = '91d101229068313af2a43a7b00f2a267c960592a28d34681e91bab96283f9768';
export const SA_GFS_BYTES = 84_878;
export const SA_GFS_SOURCE_DATE = '2017-03-17';
export const SA_GFS_LICENSE =
  'Creative Commons Attribution 4.0 International (CC BY 4.0) — data.sa.gov.au license_id "cc-by", license_url http://creativecommons.org/licenses/by/4.0';
export const SA_GFS_ATTRIBUTION =
  'Government of South Australia, Department of Treasury and Finance — South Australian State Government Finance Statistics, licensed CC BY 4.0.';
export const SA_GFS_UNIT = 'AUD_thousands';
export const SA_GFS_UNIT_LABEL = "$'000";
export const SA_GFS_UNIT_TO_CENTS = 100_000;
export const SA_GFS_JURISDICTION = 'SA';
export const SA_GFS_FISCAL_YEARS = ['2012-13', '2013-14', '2014-15', '2015-16'] as const;
export type SaGfsFiscalYear = (typeof SA_GFS_FISCAL_YEARS)[number];
export const SA_GFS_MIN_ROWS = 50;
/** One printed $'000 rounding unit. */
export const SA_GFS_RECONCILIATION_TOLERANCE = 1;
export const SA_GFS_CAVEAT =
  'South Australian general government sector expenses, GFS annual actual/outcome matrix, by Government Purpose Classification function and economic type. Statewide only; no local government, agency, project or LGA allocation. GPC is mapped explicitly to COFOG; GPC 3450 nominal superannuation interest is a non-COFOG memorandum item and is not published. Every row is one function x economic-type component; parent function totals and the printed TOTAL row are never emitted, and no cross-function/year/source total is created.';

/** GPC division (first two digits) -> COFOG division. */
export const SA_GPC_TO_COFOG: Readonly<Record<string, string>> = {
  '01': '01',
  '03': '03',
  '04': '09',
  '05': '07',
  '06': '10',
  '07': '06',
  '08': '08',
  '09': '04',
  '10': '04',
  '11': '04',
  '12': '04',
  '13': '04',
  '14': '01',
};

export const SA_COFOG_NAMES: Readonly<Record<string, string>> = {
  '01': 'General public services',
  '02': 'Defence',
  '03': 'Public order and safety',
  '04': 'Economic affairs',
  '05': 'Environmental protection',
  '06': 'Housing and community amenities',
  '07': 'Health',
  '08': 'Recreation, culture and religion',
  '09': 'Education',
  '10': 'Social protection',
};

/** Non-COFOG GPC memorandum row; read for reconciliation only. */
export const SA_GPC_EXCLUDED_CODES = new Set(['3450']);

export interface SaGfsEconomicType {
  code: string;
  description: string;
  column: number;
}

export interface SaGfsTableSpec {
  sheet: string;
  fiscal_year: SaGfsFiscalYear;
}

export const SA_GFS_TABLES: readonly SaGfsTableSpec[] = SA_GFS_FISCAL_YEARS.map((fiscal_year) => ({
  sheet: fiscal_year,
  fiscal_year,
}));

export interface SaGfsSkip {
  sheet: string;
  row: number;
  reason: string;
}

export interface SaGfsTableResult {
  sheet: string;
  fiscal_year: string;
  functions: number;
  economic_types: number;
  rows: number;
  component_total: number;
  emitted_total: number;
  published_total: number | null;
  difference: number | null;
  excluded_memorandum_total: number;
}

export interface SaGfsParsedWorkbook {
  records: SpendingRecord[];
  tables: SaGfsTableResult[];
  skipped: SaGfsSkip[];
  unit: 'AUD_thousands';
}

export function saGfsNaturalKey(parts: {
  fiscal_year: string;
  gpc_code: string;
  economic_type_code: string;
}): string {
  const digest = createHash('sha256')
    .update([SA_GFS_ID, parts.fiscal_year, parts.gpc_code, parts.economic_type_code].join('|'))
    .digest('hex');
  return `${SA_GFS_ID}:${digest}`;
}

/** Convert published $'000 to integer cents. */
export function saThousandsToCents(thousands: number): number {
  const cents = Math.round(thousands * SA_GFS_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SA GFS amount ${thousands} $'000 is outside the safe integer cent range`);
  }
  return cents;
}

/**
 * Detect the workbook unit from the printed grand total. The GFS workbook uses
 * whole thousands; whole dollars would give an implausibly small SA general
 * government expense total.
 */
export function detectSaGfsUnit(total: number): 'AUD_thousands' | 'AUD' {
  if (total >= 1_000_000 && total < 100_000_000) return 'AUD_thousands';
  if (total >= 1_000_000_000 && total < 100_000_000_000) return 'AUD';
  throw new Error(`SA GFS printed total ${total} does not look like thousands or dollars`);
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

export function parseSaGfsNumber(cell: ExcelJS.Cell): number | null {
  const value = worksheetCellValue(cell);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text === '-' || text === '—') return null;
  const numeric = Number(text.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeGpcCode(value: string): string | null {
  const text = value.trim();
  if (/^\d{1,4}$/.test(text)) return text.padStart(4, '0');
  return null;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): number {
  for (let row = 1; row <= Math.min(sheet.rowCount, 12); row += 1) {
    if (stringCell(sheet.getRow(row).getCell(1)) === 'GPC') return row;
  }
  throw new Error(`SA GFS ${sheet.name} has no GPC header row`);
}

function readEconomicTypes(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
): { economicTypes: SaGfsEconomicType[]; totalColumn: number } {
  const economicTypes: SaGfsEconomicType[] = [];
  let totalColumn = -1;
  for (let column = 3; column <= sheet.columnCount; column += 1) {
    const description = stringCell(sheet.getRow(headerRow).getCell(column));
    const code = stringCell(sheet.getRow(headerRow - 1).getCell(column));
    const totalLabel = description || code;
    if (/^total\s+gpc$/i.test(totalLabel)) {
      totalColumn = column;
      break;
    }
    if (/^\d{4}$/.test(code) && description) {
      economicTypes.push({ code, description, column });
    }
  }
  if (totalColumn < 0) throw new Error(`SA GFS ${sheet.name} has no Total GPC column`);
  if (economicTypes.length === 0) throw new Error(`SA GFS ${sheet.name} has no economic types`);
  return { economicTypes, totalColumn };
}

export function parseSaGfsSheet(
  sheet: ExcelJS.Worksheet,
  spec: SaGfsTableSpec,
): {
  table: SaGfsTableResult;
  records: SpendingRecord[];
  skipped: SaGfsSkip[];
} {
  const headerRow = findHeaderRow(sheet);
  const { economicTypes, totalColumn } = readEconomicTypes(sheet, headerRow);
  const records: SpendingRecord[] = [];
  const skipped: SaGfsSkip[] = [];
  let functions = 0;
  let componentTotal = 0;
  let excludedTotal = 0;
  let publishedTotal: number | null = null;
  let emittedTotal = 0;

  for (let rowIndex = headerRow + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const rawCode = stringCell(row.getCell(1));
    const gpcDescription = stringCell(row.getCell(2));
    if (!rawCode && !gpcDescription) continue;
    if (/^TOTAL$/i.test(rawCode)) {
      publishedTotal = parseSaGfsNumber(row.getCell(totalColumn));
      continue;
    }
    const gpcCode = normalizeGpcCode(rawCode);
    if (!gpcCode) {
      skipped.push({
        sheet: spec.sheet,
        row: rowIndex,
        reason: `unrecognised GPC code ${rawCode}`,
      });
      continue;
    }
    if (!gpcDescription) {
      skipped.push({
        sheet: spec.sheet,
        row: rowIndex,
        reason: `GPC ${gpcCode} has no description`,
      });
      continue;
    }
    const rowTotal = parseSaGfsNumber(row.getCell(totalColumn));
    let rowComponentSum = 0;
    let rowHasValue = false;
    const rowRecords: SpendingRecord[] = [];

    if (SA_GPC_EXCLUDED_CODES.has(gpcCode)) {
      excludedTotal += rowTotal ?? 0;
      skipped.push({
        sheet: spec.sheet,
        row: rowIndex,
        reason: `GPC ${gpcCode} is a non-COFOG memorandum item and is not published`,
      });
      continue;
    }

    const gpcDivision = gpcCode.slice(0, 2);
    const cofog = SA_GPC_TO_COFOG[gpcDivision];
    if (!cofog) {
      skipped.push({
        sheet: spec.sheet,
        row: rowIndex,
        reason: `GPC ${gpcCode} has no COFOG division mapping`,
      });
      continue;
    }

    for (const economicType of economicTypes) {
      const value = parseSaGfsNumber(row.getCell(economicType.column));
      if (value === null) continue;
      rowHasValue = true;
      rowComponentSum += value;
      const sign: 'positive' | 'negative' = value < 0 ? 'negative' : 'positive';
      rowRecords.push({
        function_code: cofog,
        amount_cents: saThousandsToCents(Math.abs(value)),
        measure_type: 'actual',
        fiscal_year: spec.fiscal_year,
        source_id: SA_GFS_ID,
        source_url: SA_GFS_SOURCE_URL,
        verified: true,
        natural_key: saGfsNaturalKey({
          fiscal_year: spec.fiscal_year,
          gpc_code: gpcCode,
          economic_type_code: economicType.code,
        }),
        description: `${gpcDescription} — ${economicType.description} (${spec.fiscal_year})`,
        jurisdiction_level: 'state',
        jurisdiction: SA_GFS_JURISDICTION,
        delivery_entity: 'Government of South Australia',
        source_dataset: SA_GFS_DATASET,
        source_date: SA_GFS_SOURCE_DATE,
        data_quality_flag: 'verified',
        aggregation_role: 'agency_detail',
        location: { state: SA_GFS_JURISDICTION },
        gfs_flow: 'expense',
        notes: `${SA_GFS_CAVEAT} Source: ${SA_GFS_DATASET}, sheet ${spec.sheet}; GPC ${gpcCode} mapped to COFOG ${cofog} (${SA_COFOG_NAMES[cofog]}); economic type ${economicType.code} ${economicType.description}. Published unit ${SA_GFS_UNIT_LABEL} (${SA_GFS_UNIT}), converted at ${SA_GFS_UNIT_TO_CENTS} cents per thousand.`,
        sa_gpc_code: gpcCode,
        sa_gpc_description: gpcDescription,
        sa_economic_type_code: economicType.code,
        sa_economic_type_description: economicType.description,
        sa_unit: SA_GFS_UNIT,
        sa_year_basis: 'GFS annual actual/outcome',
        ...(sign === 'negative' ? { sa_printed_sign: sign } : {}),
      });
    }

    if (!rowHasValue) {
      skipped.push({
        sheet: spec.sheet,
        row: rowIndex,
        reason: `GPC ${gpcCode} has no published economic-type value`,
      });
      continue;
    }
    if (
      rowTotal !== null &&
      Math.abs(rowComponentSum - rowTotal) > SA_GFS_RECONCILIATION_TOLERANCE
    ) {
      // The published workbook contains a few function rows whose detailed
      // components do not add to the printed row total. Keep the published
      // components and record the variance; reconcile the year on the printed
      // row totals, not on a forced component sum.
      skipped.push({
        sheet: spec.sheet,
        row: rowIndex,
        reason: `GPC ${gpcCode} component variance: components ${rowComponentSum} vs printed row total ${rowTotal}`,
      });
    }
    functions += 1;
    componentTotal += rowTotal ?? rowComponentSum;
    emittedTotal += rowComponentSum;
    records.push(...rowRecords);
  }

  if (publishedTotal === null) {
    throw new Error(`SA GFS ${spec.sheet} has no printed TOTAL row`);
  }
  if (Math.abs(componentTotal + excludedTotal - publishedTotal) > SA_GFS_RECONCILIATION_TOLERANCE) {
    throw new Error(
      `SA GFS ${spec.sheet} published components plus excluded memorandum ${excludedTotal} do not equal printed total ${publishedTotal}`,
    );
  }

  return {
    table: {
      sheet: spec.sheet,
      fiscal_year: spec.fiscal_year,
      functions,
      economic_types: economicTypes.length,
      rows: records.length,
      component_total: componentTotal,
      emitted_total: emittedTotal,
      published_total: publishedTotal,
      difference: Math.abs(componentTotal + excludedTotal - publishedTotal),
      excluded_memorandum_total: excludedTotal,
    },
    records,
    skipped,
  };
}

export function parseSaGfsWorkbook(workbook: ExcelJS.Workbook): SaGfsParsedWorkbook {
  const records: SpendingRecord[] = [];
  const tables: SaGfsTableResult[] = [];
  const skipped: SaGfsSkip[] = [];
  for (const spec of SA_GFS_TABLES) {
    const sheet = workbook.getWorksheet(spec.sheet);
    if (!sheet) throw new Error(`SA GFS workbook is missing sheet ${spec.sheet}`);
    const parsed = parseSaGfsSheet(sheet, spec);
    records.push(...parsed.records);
    tables.push(parsed.table);
    skipped.push(...parsed.skipped);
  }
  const totals = tables
    .map((table) => table.published_total)
    .filter((value): value is number => value !== null);
  if (totals.length !== tables.length) throw new Error('SA GFS missing a printed TOTAL row');
  const unit = detectSaGfsUnit(Math.max(...totals));
  if (unit !== 'AUD_thousands') {
    throw new Error(`SA GFS unit detected as ${unit}, expected AUD_thousands`);
  }
  return { records, tables, skipped, unit };
}

export function assertSaGfsPremise(parsed: SaGfsParsedWorkbook): void {
  if (parsed.tables.length !== SA_GFS_FISCAL_YEARS.length) {
    throw new Error(`SA GFS parsed ${parsed.tables.length} years, expected 4`);
  }
  if (parsed.records.length < SA_GFS_MIN_ROWS) {
    throw new Error(
      `SA GFS produced ${parsed.records.length} rows, expected at least ${SA_GFS_MIN_ROWS}`,
    );
  }
  const validCofog = new Set(Object.keys(SA_COFOG_NAMES));
  for (const record of parsed.records) {
    if (!record.function_code || !validCofog.has(record.function_code)) {
      throw new Error(`SA GFS row ${record.natural_key} has invalid COFOG ${record.function_code}`);
    }
    if (record.measure_type !== 'actual') {
      throw new Error(`SA GFS row ${record.natural_key} is not actual`);
    }
  }
  for (const table of parsed.tables) {
    if (table.published_total === null || table.difference === null) {
      throw new Error(`SA GFS ${table.sheet} has no reconciliation`);
    }
    if (table.difference > SA_GFS_RECONCILIATION_TOLERANCE) {
      throw new Error(`SA GFS ${table.sheet} does not reconcile to its printed TOTAL row`);
    }
  }
}

export function buildSaGfsRecords(workbook: ExcelJS.Workbook): SaGfsParsedWorkbook {
  const parsed = parseSaGfsWorkbook(workbook);
  assertSaGfsPremise(parsed);
  return parsed;
}

export async function readSaGfsWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

export interface SaGfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  workbookPath?: string;
  now?: () => Date;
}

export interface SaGfsLoadedSource {
  records: SpendingRecord[];
  archive: ArchivedSourceRecord;
  parsed: SaGfsParsedWorkbook;
  warnings: string[];
}

async function archiveWorkbook(options: SaGfsConnectorOptions): Promise<ArchivedSourceRecord> {
  const supplied = options.workbookPath ? await readFile(options.workbookPath) : undefined;
  return archiveSourceDocument({
    source_id: SA_GFS_ID,
    title: SA_GFS_DATASET,
    original_url: SA_GFS_RESOURCE_URL,
    retrieved_from: SA_GFS_RESOURCE_URL,
    archived_from: 'direct',
    filename: SA_GFS_FILENAME,
    content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
    ...(supplied ? { data: supplied } : {}),
    ...(options.now ? { fetched_at: options.now() } : {}),
    notes:
      `Official data.sa package: ${SA_GFS_SOURCE_URL}. Published by the SA Department of Treasury and Finance under CC BY 4.0. ` +
      'Workbook archived outside the repo and never redistributed; only derived rows are emitted.',
  });
}

function verifyArchive(archive: ArchivedSourceRecord): void {
  if (archive.sha256 !== SA_GFS_SHA256) {
    throw new Error(`SA GFS workbook SHA-256 ${archive.sha256} does not match ${SA_GFS_SHA256}`);
  }
  if (archive.bytes !== SA_GFS_BYTES) {
    throw new Error(`SA GFS workbook is ${archive.bytes} bytes, expected ${SA_GFS_BYTES}`);
  }
}

export async function loadSaGfsSource(
  options: SaGfsConnectorOptions = {},
): Promise<SaGfsLoadedSource> {
  const archive = await archiveWorkbook(options);
  if (!options.workbookPath) verifyArchive(archive);
  const bytes = await readArchivedDocument(archive);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const parsed = buildSaGfsRecords(workbook);
  const warnings = [
    `years=${parsed.tables.map((table) => table.fiscal_year).join(',')} rows=${parsed.records.length} unit=${parsed.unit}`,
    `cofog_rows=${parsed.records.filter((record) => record.function_code).length} skipped=${parsed.skipped.length}`,
    `reconciliation=${parsed.tables
      .map(
        (table) =>
          `${table.fiscal_year}:${table.component_total}+${table.excluded_memorandum_total}=${table.published_total}`,
      )
      .join(';')}`,
  ];
  return { records: parsed.records, archive, parsed, warnings };
}

export interface SaGfsManifest {
  dataset: string;
  source_url: string;
  resource_url: string;
  source_date: string;
  license: string;
  attribution: string;
  caveat: string;
  sha256: string;
  bytes: number;
  unit: string;
  unit_label: string;
  unit_to_cents: number;
  measure_type: string;
  measure_basis: string;
  fiscal_years: string[];
  jurisdiction: string;
  rows_emitted: number;
  cofog_divisions: Record<string, number>;
  gpc_to_cofog: Record<string, string>;
  excluded_gpc_codes: string[];
  tables: SaGfsTableResult[];
  notes: string;
}

export function saGfsManifest(
  parsed: SaGfsParsedWorkbook,
  archive: Pick<ArchivedSourceRecord, 'sha256' | 'bytes'>,
): SaGfsManifest {
  const cofogCounts: Record<string, number> = {};
  for (const record of parsed.records) {
    const code = record.function_code ?? 'unknown';
    cofogCounts[code] = (cofogCounts[code] ?? 0) + 1;
  }
  return {
    dataset: SA_GFS_DATASET,
    source_url: SA_GFS_SOURCE_URL,
    resource_url: SA_GFS_RESOURCE_URL,
    source_date: SA_GFS_SOURCE_DATE,
    license: SA_GFS_LICENSE,
    attribution: SA_GFS_ATTRIBUTION,
    caveat: SA_GFS_CAVEAT,
    sha256: archive.sha256,
    bytes: archive.bytes,
    unit: SA_GFS_UNIT,
    unit_label: SA_GFS_UNIT_LABEL,
    unit_to_cents: SA_GFS_UNIT_TO_CENTS,
    measure_type: 'actual',
    measure_basis: 'GFS annual actual/outcome matrix; the workbook has no budget/actual column',
    fiscal_years: [...SA_GFS_FISCAL_YEARS],
    jurisdiction: SA_GFS_JURISDICTION,
    rows_emitted: parsed.records.length,
    cofog_divisions: cofogCounts,
    gpc_to_cofog: { ...SA_GPC_TO_COFOG },
    excluded_gpc_codes: [...SA_GPC_EXCLUDED_CODES],
    tables: parsed.tables,
    notes:
      'Derived rows only; workbook not redistributed. Parent Total GPC and printed TOTAL rows are never emitted. GPC 3450 is a non-COFOG memorandum item and is not published. Every row is a function x economic-type component; no cross-function/year/source total is created.',
  };
}

export function createSaGfsConnector(options: SaGfsConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'direct' as const,
  };
  return {
    id: SA_GFS_ID,
    name: SA_GFS_NAME,
    publisher: SA_GFS_PUBLISHER,
    source_url: SA_GFS_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'state',
    license: SA_GFS_LICENSE,
    notes: `${SA_GFS_CAVEAT} ${SA_GFS_ATTRIBUTION}`,
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const loaded = await loadSaGfsSource(options);
      metadata.warnings = loaded.warnings;
      return loaded.records as unknown as RawRecord[];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      return raw.filter((entry) => entry.source_id === SA_GFS_ID) as unknown as SpendingRecord[];
    },
    metadata,
  };
}
