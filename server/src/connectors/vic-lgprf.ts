import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import type { SpendingRecord } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType, readArchivedDocument } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * Victorian council performance indicators — Local Government Performance
 * Reporting Framework (LGPRF) full data set 2020-25, all 79 councils,
 * FY2020-21..FY2024-25.
 *
 * This is a PERFORMANCE-INDICATOR layer, not a financial one. The published
 * `Result` values are per-head amounts, per-unit costs, percentages, ratios,
 * scores, counts and days. They are never dollars of council spending and are
 * never summed or averaged across councils, indicators or years. Every row is
 * non-additive agency detail (`aggregation_role: "agency_detail"`).
 *
 * LICENCE: CC BY 4.0. The data.vic CKAN package
 * `local-government-performance-reporting` has `license_id: "cc-by"` and the
 * DataVic page identifies the publisher as Local Government Victoria. The
 * data set's own disclaimer says it must not be used to aid the publication of
 * "overly simplistic league tables of councils"; that condition is reproduced
 * in every row's notes and in the source manifest.
 *
 * UNITS: the full data set has no unit column. The per-indicator unit is taken
 * from the published indicator description/definition (the workbook's
 * `Description` column, cross-checked against the official LGV Performance
 * Reporting Indicator Guide 2025-26) and stored verbatim in
 * `performance_unit`. Values are stored exactly as published; a percentage
 * indicator whose published result is a 0-1 fraction is labelled
 * "percentage (0-1 fraction)" rather than silently multiplied by 100.
 *
 * BLANKS/SUPPRESSION: a blank `Result` is a published no-data/suppressed value.
 * It is stored as an absent `performance_value` (never 0), while the row is
 * still emitted so the council x year x indicator key is complete. Where the
 * source publishes a literal 0 together with `Data applicable? = "No data"`, the
 * 0 is preserved and the no-data flag is retained; the connector does not
 * reinterpret it as a measured zero.
 */

export const LGPRF_ID = 'vic-lgprf';
export const LGPRF_NAME = 'Local Government Performance Reporting Framework 2020-25';
export const LGPRF_PUBLISHER = 'Local Government Victoria (Department of Government Services)';
export const LGPRF_LANDING_URL =
  'https://www.localgovernment.vic.gov.au/strengthening-councils/performance-reporting';
export const LGPRF_DATASET_PAGE =
  'https://discover.data.vic.gov.au/dataset/local-government-performance-reporting';
export const LGPRF_RESOURCE_URL =
  'https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0019/191008/LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx';
export const LGPRF_SNAPSHOT_TIMESTAMP = '20251118075622';
export const LGPRF_RETRIEVAL_URL = `https://web.archive.org/web/${LGPRF_SNAPSHOT_TIMESTAMP}id_/${LGPRF_RESOURCE_URL}`;
export const LGPRF_EXPECTED_SHA256 =
  'd88f7ede3a154f1beb6359850dc25a68159d08e23478fec8f138d67d1b787376';
export const LGPRF_EXPECTED_BYTES = 3_241_185;
export const LGPRF_SOURCE_DATE = '2025-11-05';
export const LGPRF_DATA_QUALITY_FLAG = 'provisional/local_government';
export const LGPRF_DATASET = 'LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx';
export const LGPRF_DATASET_LABEL =
  'Local Government Performance Reporting Framework — Full Data Set 2020-25';
export const LGPRF_FISCAL_YEARS = ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25'] as const;
export type LgprfFiscalYear = (typeof LGPRF_FISCAL_YEARS)[number];

export const LGPRF_ATTRIBUTION =
  'Local Government Victoria (Department of Government Services), Local Government Performance Reporting Framework 2020-25 Full Data Set, licensed under CC BY 4.0.';
export const LGPRF_LICENSE =
  'Creative Commons Attribution 4.0 International (CC BY 4.0) — data.vic CKAN package "local-government-performance-reporting" has license_id "cc-by"; publisher Local Government Victoria. Attribution required. The source disclaimer also requires that the data set not be used to aid the publication of overly simplistic league tables of councils. Derived indicator rows only; the source workbook is not redistributed.';
export const LGPRF_DISCLAIMER =
  "Council performance data set should not be used to aid in the publication of overly simplistic league tables of councils. The Variation commentary provided alongside the data should always be considered with any analysis or reporting of a council's data.";
export const LGPRF_CAVEAT =
  'VIC council performance indicators, not spending. Non-additive agency detail: never sum or average across councils, indicators or years and never convert a ratio/per-head measure to a dollar total. Values are published LGPRF results; blanks and source no-data flags are preserved, not zero-filled. Never mixed with vic-budget, ABS GFS, VGC1/ABS, VLGGC FAG, waste or NSW council data.';

/** Canonical unit for every indicator code that appears in the 2020-25 data set. */
export const LGPRF_INDICATOR_UNITS: Readonly<Record<string, string>> = {
  AF2: 'inspections per Council aquatic facility',
  AF6: 'visits per person',
  AF7: 'AUD per visit',
  AM1: 'days',
  AM2: 'percentage (0-1 fraction)',
  AM5: 'percentage (0-1 fraction)',
  AM6: 'AUD per person',
  AM7: 'percentage (0-1 fraction)',
  C1: 'AUD per person',
  C2: 'AUD per person',
  C3: 'persons per km of local road',
  C4: 'AUD per person',
  C5: 'AUD per person',
  C6: 'score out of 10',
  C7: 'ratio',
  E2: 'AUD per property assessment',
  E4: 'AUD per property assessment',
  FS1: 'days',
  FS2: 'percentage (0-1 fraction)',
  FS3: 'AUD per food premises',
  FS4: 'percentage (0-1 fraction)',
  FS5: 'percentage (0-1 fraction)',
  G1: 'percentage (0-1 fraction)',
  G2: 'score out of 100',
  G3: 'percentage (0-1 fraction)',
  G4: 'AUD per councillor',
  G5: 'score out of 100',
  L1: 'ratio',
  L2: 'ratio',
  LB1: 'loans per library collection item',
  LB2: 'percentage (0-1 fraction)',
  LB4: 'percentage (0-1 fraction)',
  LB5: 'AUD per person',
  LB6: 'loans per person',
  LB7: 'percentage (0-1 fraction)',
  LB8: 'visits per person',
  MC2: 'percentage (0-1 fraction)',
  MC3: 'AUD per hour',
  MC4: 'percentage (0-1 fraction)',
  MC5: 'percentage (0-1 fraction)',
  MC6: 'percentage (0-1 fraction)',
  O2: 'ratio',
  O3: 'ratio',
  O4: 'ratio',
  O5: 'ratio',
  OP1: 'ratio',
  R1: 'requests per 100 km of sealed road',
  R2: 'percentage (0-1 fraction)',
  R3: 'AUD per square metre',
  R4: 'AUD per square metre',
  R5: 'score out of 100',
  S1: 'ratio',
  S2: 'ratio',
  SP1: 'days',
  SP2: 'percentage (0-1 fraction)',
  SP3: 'AUD per planning application',
  SP4: 'percentage (0-1 fraction)',
  WC1: 'requests per 1,000 kerbside collection households',
  WC2: 'bins per 10,000 scheduled bin lifts',
  WC3: 'AUD per kerbside garbage bin',
  WC4: 'AUD per kerbside recyclables bin',
  WC5: 'percentage (0-1 fraction)',
};

/** 58-indicator generation used in 2020-21, 2021-22 and 2022-23. */
export const LGPRF_INDICATORS_2020_23 = [
  'AF2',
  'AF6',
  'AF7',
  'AM1',
  'AM2',
  'AM5',
  'AM6',
  'AM7',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'E2',
  'E4',
  'FS1',
  'FS2',
  'FS3',
  'FS4',
  'G1',
  'G2',
  'G3',
  'G4',
  'G5',
  'L1',
  'L2',
  'LB1',
  'LB2',
  'LB4',
  'LB5',
  'MC2',
  'MC3',
  'MC4',
  'MC5',
  'MC6',
  'O2',
  'O3',
  'O4',
  'O5',
  'OP1',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'S1',
  'S2',
  'SP1',
  'SP2',
  'SP3',
  'SP4',
  'WC1',
  'WC2',
  'WC3',
  'WC4',
  'WC5',
] as const;

/** 59-indicator generation used in 2023-24 and 2024-25. */
export const LGPRF_INDICATORS_2023_25 = [
  'AF2',
  'AF6',
  'AF7',
  'AM1',
  'AM2',
  'AM5',
  'AM6',
  'AM7',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'E2',
  'E4',
  'FS1',
  'FS2',
  'FS3',
  'FS4',
  'FS5',
  'G1',
  'G2',
  'G3',
  'G4',
  'G5',
  'L1',
  'L2',
  'LB2',
  'LB5',
  'LB6',
  'LB7',
  'LB8',
  'MC2',
  'MC3',
  'MC4',
  'MC5',
  'MC6',
  'O2',
  'O3',
  'O4',
  'O5',
  'OP1',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'S1',
  'S2',
  'SP1',
  'SP2',
  'SP3',
  'SP4',
  'WC2',
  'WC3',
  'WC4',
  'WC5',
] as const;

export interface LgprfYearSpec {
  fiscal_year: LgprfFiscalYear;
  sheet: string;
  indicators: readonly string[];
  expected_rows: number;
  expected_blank_results: number;
  expected_no_data_rows: number;
}

export const LGPRF_YEAR_SPECS: readonly LgprfYearSpec[] = [
  {
    fiscal_year: '2020-21',
    sheet: 'Indicators 2020-21',
    indicators: LGPRF_INDICATORS_2020_23,
    expected_rows: 4_582,
    expected_blank_results: 43,
    expected_no_data_rows: 43,
  },
  {
    fiscal_year: '2021-22',
    sheet: 'Indicators 2021-22',
    indicators: LGPRF_INDICATORS_2020_23,
    expected_rows: 4_582,
    expected_blank_results: 99,
    expected_no_data_rows: 99,
  },
  {
    fiscal_year: '2022-23',
    sheet: 'Indicators 2022-23',
    indicators: LGPRF_INDICATORS_2020_23,
    expected_rows: 4_582,
    expected_blank_results: 0,
    expected_no_data_rows: 43,
  },
  {
    fiscal_year: '2023-24',
    sheet: 'Indicators 2023-24',
    indicators: LGPRF_INDICATORS_2023_25,
    expected_rows: 4_661,
    expected_blank_results: 0,
    expected_no_data_rows: 43,
  },
  {
    fiscal_year: '2024-25',
    sheet: 'Indicators 2024-25',
    indicators: LGPRF_INDICATORS_2023_25,
    expected_rows: 4_661,
    expected_blank_results: 0,
    expected_no_data_rows: 38,
  },
] as const;

export const LGPRF_EXPECTED_TOTAL_ROWS = LGPRF_YEAR_SPECS.reduce(
  (sum, spec) => sum + spec.expected_rows,
  0,
);

const COUNCIL_LABEL_EXCEPTIONS: Readonly<Record<string, string>> = {
  'Borough of Queenscliffe': 'Borough of Queenscliffe',
  'Colac-Otway Shire': 'Colac Otway Shire Council',
  'Greater Shepparton': 'Greater Shepparton City Council',
  'Moreland City': 'Moreland City Council',
};

/**
 * Expand a workbook council label to the platform's VIC council name. Most
 * labels are `<name> Shire|City|Rural City`; the exceptions are the renamed
 * Moreland/Merri-bek and Colac-Otway labels and the two names that do not carry
 * a type suffix in the workbook.
 */
export function lgprfCouncilName(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const exception = COUNCIL_LABEL_EXCEPTIONS[trimmed];
  if (exception) return exception;
  if (trimmed.endsWith(' Shire')) return `${trimmed} Council`;
  if (trimmed.endsWith(' Rural City')) return `${trimmed} Council`;
  if (trimmed.endsWith(' City')) return `${trimmed} Council`;
  return null;
}

export interface LgprfSourceMeta {
  landing_url: string;
  dataset_page: string;
  resource_url: string;
  retrieval_url: string;
  snapshot_timestamp: string;
  source_sha256: string;
  source_date: string;
  dataset: string;
}

export const LGPRF_DEFAULT_META: LgprfSourceMeta = {
  landing_url: LGPRF_LANDING_URL,
  dataset_page: LGPRF_DATASET_PAGE,
  resource_url: LGPRF_RESOURCE_URL,
  retrieval_url: LGPRF_RETRIEVAL_URL,
  snapshot_timestamp: LGPRF_SNAPSHOT_TIMESTAMP,
  source_sha256: LGPRF_EXPECTED_SHA256,
  source_date: LGPRF_SOURCE_DATE,
  dataset: LGPRF_DATASET,
};

export interface LgprfRaw extends Record<string, unknown> {
  kind: 'indicator';
  fiscal_year: LgprfFiscalYear;
  sheet: string;
  council_label: string;
  council_name: string;
  group: string;
  indicator_code: string;
  indicator_name: string;
  service_provided: string;
  data_applicable: string;
  result: number | null;
  result_text?: string;
  unit: string;
  source_url: string;
  dataset_page: string;
  resource_url: string;
  retrieval_url: string;
  source_sha256: string;
  source_date: string;
  dataset: string;
}

export interface LgprfYearParse {
  fiscal_year: LgprfFiscalYear;
  sheet: string;
  councils: string[];
  indicator_codes: string[];
  rows: LgprfRaw[];
  blank_results: number;
  no_data_rows: number;
}

export interface LgprfParsedWorkbook {
  years: LgprfYearParse[];
  total_rows: number;
}

export interface LgprfTransformResult {
  records: SpendingRecord[];
  skipped: Array<{ label: string; reason: string }>;
  duplicates: number;
}

export interface LgprfLoadedSource {
  raw: LgprfRaw[];
  records: SpendingRecord[];
  archive: ArchivedSourceRecord;
  parsed: LgprfParsedWorkbook;
  warnings: string[];
}

export interface LgprfConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  sourcePath?: string;
}

function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function lgprfNaturalKey(parts: readonly (string | number | null | undefined)[]): string {
  return `vic-lgprf:${sha256(parts.map((part) => String(part ?? '')).join('\u001f')).slice(0, 40)}`;
}

export function worksheetCellValue(cell: ExcelJS.Cell): unknown {
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
  return value === null || value === undefined ? '' : String(value).trim();
}

function headerMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  const row = sheet.getRow(1);
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    const label = stringCell(row.getCell(column));
    if (label) map.set(label, column);
  }
  return map;
}

function requireColumn(headers: Map<string, number>, label: string, sheet: string): number {
  const column = headers.get(label);
  if (!column)
    throw new Error(`LGPRF sheet ${sheet} is missing the ${JSON.stringify(label)} column`);
  return column;
}

function parseNumericResult(cell: ExcelJS.Cell): { result: number | null; result_text?: string } {
  const value = worksheetCellValue(cell);
  if (value === null || value === undefined) return { result: null };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { result: null };
    return { result: value };
  }
  const text = String(value).trim();
  if (!text) return { result: null };
  const numeric = Number(text.replace(/,/g, ''));
  if (Number.isFinite(numeric)) return { result: numeric };
  return { result: null, result_text: text };
}

/**
 * Parse one year sheet into raw indicator rows. Rows with a blank result are
 * retained so the council x year x indicator key is complete; the result is
 * `null`, never 0.
 */
export function parseLgprfYearSheet(
  sheet: ExcelJS.Worksheet,
  spec: LgprfYearSpec,
  meta: LgprfSourceMeta = LGPRF_DEFAULT_META,
): LgprfYearParse {
  const headers = headerMap(sheet);
  const councilColumn = requireColumn(headers, 'Council', spec.sheet);
  const groupColumn = requireColumn(headers, 'Group', spec.sheet);
  const idColumn = requireColumn(headers, 'ID', spec.sheet);
  const descriptionColumn = requireColumn(headers, 'Description', spec.sheet);
  const serviceColumn = requireColumn(headers, 'Service Provided', spec.sheet);
  const applicableColumn = requireColumn(headers, 'Data applicable?', spec.sheet);
  const resultColumn = requireColumn(headers, 'Result', spec.sheet);

  const rows: LgprfRaw[] = [];
  const councils = new Set<string>();
  const codes = new Set<string>();
  const keys = new Set<string>();
  let blankResults = 0;
  let noDataRows = 0;

  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const councilLabel = stringCell(row.getCell(councilColumn));
    const indicatorCode = stringCell(row.getCell(idColumn));
    if (!councilLabel && !indicatorCode) continue;
    if (!councilLabel) {
      throw new Error(`LGPRF ${spec.fiscal_year} row ${rowIndex} has no council label`);
    }
    if (!indicatorCode) {
      throw new Error(`LGPRF ${spec.fiscal_year} row ${rowIndex} has no indicator ID`);
    }
    const councilName = lgprfCouncilName(councilLabel);
    if (!councilName) {
      throw new Error(`LGPRF ${spec.fiscal_year} cannot expand council label ${councilLabel}`);
    }
    const unit = LGPRF_INDICATOR_UNITS[indicatorCode];
    if (!unit) {
      throw new Error(
        `LGPRF ${spec.fiscal_year} indicator ${indicatorCode} has no published unit mapping (premise falsified)`,
      );
    }
    const key = `${spec.fiscal_year}\u001f${councilName}\u001f${indicatorCode}`;
    if (keys.has(key)) {
      throw new Error(
        `LGPRF ${spec.fiscal_year} duplicate council x indicator key: ${councilName} / ${indicatorCode}`,
      );
    }
    keys.add(key);
    councils.add(councilLabel);
    codes.add(indicatorCode);

    const dataApplicable = stringCell(row.getCell(applicableColumn));
    const parsed = parseNumericResult(row.getCell(resultColumn));
    if (parsed.result === null && parsed.result_text === undefined) blankResults += 1;
    if (/no data/i.test(dataApplicable)) noDataRows += 1;

    rows.push({
      kind: 'indicator',
      fiscal_year: spec.fiscal_year,
      sheet: spec.sheet,
      council_label: councilLabel,
      council_name: councilName,
      group: stringCell(row.getCell(groupColumn)),
      indicator_code: indicatorCode,
      indicator_name: stringCell(row.getCell(descriptionColumn)),
      service_provided: stringCell(row.getCell(serviceColumn)),
      data_applicable: dataApplicable,
      result: parsed.result,
      ...(parsed.result_text !== undefined ? { result_text: parsed.result_text } : {}),
      unit,
      source_url: meta.landing_url,
      dataset_page: meta.dataset_page,
      resource_url: meta.resource_url,
      retrieval_url: meta.retrieval_url,
      source_sha256: meta.source_sha256,
      source_date: meta.source_date,
      dataset: meta.dataset,
    });
  }

  return {
    fiscal_year: spec.fiscal_year,
    sheet: spec.sheet,
    councils: [...councils].sort(),
    indicator_codes: [...codes].sort(),
    rows,
    blank_results: blankResults,
    no_data_rows: noDataRows,
  };
}

export function parseLgprfWorkbook(
  workbook: ExcelJS.Workbook,
  meta: LgprfSourceMeta = LGPRF_DEFAULT_META,
): LgprfParsedWorkbook {
  const years = LGPRF_YEAR_SPECS.map((spec) => {
    const sheet = workbook.getWorksheet(spec.sheet);
    if (!sheet) throw new Error(`LGPRF workbook is missing the ${spec.sheet} sheet`);
    return parseLgprfYearSheet(sheet, spec, meta);
  });
  return { years, total_rows: years.reduce((sum, year) => sum + year.rows.length, 0) };
}

/**
 * Premise gate: the official full set must have 79 councils in every year, the
 * expected indicator set/count, the documented blank/no-data counts, and a
 * known unit for every indicator. A failure means the source is not the
 * verified full data set, so the connector must not publish.
 */
export function assertLgprfPremise(parsed: LgprfParsedWorkbook): void {
  if (parsed.years.length !== LGPRF_YEAR_SPECS.length) {
    throw new Error(`LGPRF parsed ${parsed.years.length} year sheets, expected 5`);
  }
  for (let index = 0; index < LGPRF_YEAR_SPECS.length; index += 1) {
    const spec = LGPRF_YEAR_SPECS[index]!;
    const year = parsed.years[index]!;
    if (year.fiscal_year !== spec.fiscal_year) {
      throw new Error(`LGPRF year ${year.fiscal_year} is not the expected ${spec.fiscal_year}`);
    }
    if (year.councils.length !== 79) {
      throw new Error(
        `LGPRF ${spec.fiscal_year} has ${year.councils.length} councils, expected 79 (premise falsified)`,
      );
    }
    if (year.rows.length !== spec.expected_rows) {
      throw new Error(
        `LGPRF ${spec.fiscal_year} has ${year.rows.length} rows, expected ${spec.expected_rows} (premise falsified)`,
      );
    }
    if (year.indicator_codes.length !== spec.indicators.length) {
      throw new Error(
        `LGPRF ${spec.fiscal_year} has ${year.indicator_codes.length} indicators, expected ${spec.indicators.length}`,
      );
    }
    const expected = new Set(spec.indicators);
    const actual = new Set(year.indicator_codes);
    const missing = [...expected].filter((code) => !actual.has(code));
    const extra = [...actual].filter((code) => !expected.has(code));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `LGPRF ${spec.fiscal_year} indicator set differs: missing ${missing.join(',')}; extra ${extra.join(',')}`,
      );
    }
    if (year.blank_results !== spec.expected_blank_results) {
      throw new Error(
        `LGPRF ${spec.fiscal_year} has ${year.blank_results} blank Results, expected ${spec.expected_blank_results} (premise falsified)`,
      );
    }
    if (year.no_data_rows !== spec.expected_no_data_rows) {
      throw new Error(
        `LGPRF ${spec.fiscal_year} has ${year.no_data_rows} no-data rows, expected ${spec.expected_no_data_rows} (premise falsified)`,
      );
    }
    if (year.councils.some((label) => /^totals?$/i.test(label))) {
      throw new Error(`LGPRF ${spec.fiscal_year} contains a Totals entity`);
    }
  }
  if (parsed.total_rows !== LGPRF_EXPECTED_TOTAL_ROWS) {
    throw new Error(
      `LGPRF parsed ${parsed.total_rows} rows, expected ${LGPRF_EXPECTED_TOTAL_ROWS}`,
    );
  }
}

function lgprfNote(raw: LgprfRaw): string {
  return [
    `Source: ${LGPRF_DATASET_LABEL}, ${raw.sheet}`,
    `Publisher: ${LGPRF_PUBLISHER}`,
    `Official landing page: ${raw.source_url}`,
    `DataVic package: ${raw.dataset_page}`,
    `Official resource: ${raw.resource_url}`,
    `Retrieved from: ${raw.retrieval_url}`,
    `Workbook SHA-256: ${raw.source_sha256}`,
    `Published result: ${raw.result === null ? '(blank — no value published)' : String(raw.result)}`,
    `Unit: ${raw.unit}; value stored exactly as published and never converted to dollars`,
    `Licence: ${LGPRF_LICENSE}`,
    `Source disclaimer: "${LGPRF_DISCLAIMER}"`,
    'NON-ADDITIVE: a performance indicator, not a spending amount. Never sum or average this row across councils, indicators or years; never convert a per-head/per-unit/ratio/percentage result to a dollar total.',
    `Data applicable? = ${raw.data_applicable || '(blank)'}${
      /no data/i.test(raw.data_applicable)
        ? '; the source publishes this row as no data, so any printed 0 is preserved as a source 0 and is not a measured zero'
        : ''
    }`,
    'This row is part of the separate VIC council performance layer and is never mixed with vic-budget, ABS GFS, VGC1/ABS, VLGGC FAG, waste or NSW council data.',
  ].join('; ');
}

export function mapLgprfRaw(raw: LgprfRaw): SpendingRecord {
  const key = lgprfNaturalKey([raw.fiscal_year, raw.council_name, raw.indicator_code]);
  return {
    amount_cents: 0,
    measure_type: 'actual',
    fiscal_year: raw.fiscal_year,
    source_id: LGPRF_ID,
    source_url: raw.source_url,
    verified: false,
    natural_key: key,
    jurisdiction_level: 'local',
    jurisdiction: 'VIC',
    delivery_entity: raw.council_name,
    funding_source: 'Local Government Victoria',
    source_dataset: `${LGPRF_DATASET_LABEL} — ${raw.fiscal_year}`,
    source_date: raw.source_date,
    data_quality_flag: LGPRF_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    description: `${raw.indicator_code} ${raw.indicator_name} — ${raw.council_name} (${raw.fiscal_year})`,
    ...(raw.result !== null ? { performance_value: raw.result } : {}),
    ...(raw.result_text !== undefined ? { performance_value_text: raw.result_text } : {}),
    performance_unit: raw.unit,
    performance_indicator_code: raw.indicator_code,
    performance_indicator_name: raw.indicator_name,
    ...(raw.group ? { performance_indicator_group: raw.group } : {}),
    ...(raw.service_provided ? { performance_service_provided: raw.service_provided } : {}),
    performance_data_applicable: raw.data_applicable || 'unspecified',
    performance_council_label: raw.council_label,
    performance_non_additive: true,
    notes: lgprfNote(raw),
  };
}

/** Pure transform: raw indicator cells -> non-additive records. */
export function transformLgprfRaw(raw: readonly RawRecord[]): LgprfTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: Array<{ label: string; reason: string }> = [];
  const keys = new Set<string>();
  let duplicates = 0;
  for (const entry of raw) {
    if (entry.kind !== 'indicator') {
      skipped.push({ label: String(entry.council_label ?? 'unknown'), reason: 'unknown raw kind' });
      continue;
    }
    try {
      const record = mapLgprfRaw(entry as LgprfRaw);
      if (keys.has(record.natural_key!)) {
        duplicates += 1;
        continue;
      }
      keys.add(record.natural_key!);
      records.push(record);
    } catch (error) {
      skipped.push({
        label: String(entry.council_label ?? 'unknown'),
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { records, skipped, duplicates };
}

export async function readLgprfWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

export async function buildLgprfRecords(
  workbook: ExcelJS.Workbook,
  meta: LgprfSourceMeta = LGPRF_DEFAULT_META,
): Promise<{ parsed: LgprfParsedWorkbook; raw: LgprfRaw[]; records: SpendingRecord[] }> {
  const parsed = parseLgprfWorkbook(workbook, meta);
  assertLgprfPremise(parsed);
  const raw = parsed.years.flatMap((year) => year.rows);
  const transformed = transformLgprfRaw(raw);
  if (transformed.skipped.length > 0) {
    throw new Error(
      `LGPRF transform skipped ${transformed.skipped.length} row(s): ${transformed.skipped
        .map((entry) => `${entry.label}: ${entry.reason}`)
        .join('; ')}`,
    );
  }
  return { parsed, raw, records: transformed.records };
}

async function archiveWorkbook(options: LgprfConnectorOptions): Promise<ArchivedSourceRecord> {
  // An already-downloaded local file is copied into the archive root (not
  // adopted in place), so the archived bytes always live outside the repo at
  // the documented path even when the caller supplies a temporary download.
  const supplied = options.sourcePath ? await readFile(options.sourcePath) : undefined;
  return archiveSourceDocument({
    source_id: LGPRF_ID,
    title: LGPRF_DATASET_LABEL,
    original_url: LGPRF_RESOURCE_URL,
    retrieved_from: LGPRF_RETRIEVAL_URL,
    archived_from: 'wayback',
    filename: LGPRF_DATASET,
    content_type: inferContentType(LGPRF_DATASET),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
    ...(supplied ? { data: supplied } : {}),
    notes:
      `Official LGPRF page: ${LGPRF_LANDING_URL}. DataVic package: ${LGPRF_DATASET_PAGE}. ` +
      `Wayback snapshot ${LGPRF_SNAPSHOT_TIMESTAMP}. Licensed CC BY 4.0 (data.vic license_id cc-by). ` +
      'Bytes archived outside the repo and never redistributed; only derived indicator rows are emitted.',
  });
}

function verifyArchive(archive: ArchivedSourceRecord): void {
  if (archive.sha256 !== LGPRF_EXPECTED_SHA256) {
    throw new Error(
      `LGPRF workbook SHA-256 ${archive.sha256} does not match ${LGPRF_EXPECTED_SHA256}`,
    );
  }
  if (archive.bytes !== LGPRF_EXPECTED_BYTES) {
    throw new Error(`LGPRF workbook is ${archive.bytes} bytes, expected ${LGPRF_EXPECTED_BYTES}`);
  }
}

export async function loadLgprfSource(
  options: LgprfConnectorOptions = {},
): Promise<LgprfLoadedSource> {
  const archive = await archiveWorkbook(options);
  verifyArchive(archive);
  const bytes = await readArchivedDocument(archive);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const { parsed, raw, records } = await buildLgprfRecords(workbook);
  if (records.length !== LGPRF_EXPECTED_TOTAL_ROWS) {
    throw new Error(
      `LGPRF produced ${records.length} records, expected ${LGPRF_EXPECTED_TOTAL_ROWS}`,
    );
  }
  const warnings = parsed.years.map(
    (year) =>
      `${year.fiscal_year} rows=${year.rows.length} councils=${year.councils.length} indicators=${year.indicator_codes.length} blanks=${year.blank_results} no-data=${year.no_data_rows}`,
  );
  warnings.push(
    `records=${records.length}; non-additive rows=${records.length}; source workbook SHA-256=${archive.sha256}`,
  );
  return { raw, records, archive, parsed, warnings };
}

export interface LgprfManifest {
  dataset: string;
  fiscal_years: string[];
  source_url: string;
  dataset_page: string;
  resource_url: string;
  retrieved_from: string;
  snapshot_timestamp: string;
  source_date: string;
  license: string;
  attribution: string;
  disclaimer: string;
  caveat: string;
  sha256: string;
  bytes: number;
  council_count_per_year: number;
  distinct_council_names_across_years: number;
  years: Array<{
    fiscal_year: string;
    sheet: string;
    councils: number;
    indicators: number;
    rows: number;
    blank_results: number;
    no_data_rows: number;
    units: Record<string, string>;
  }>;
  rows_emitted: number;
  non_additive: true;
  notes: string;
}

export function lgprfManifest(
  parsed: LgprfParsedWorkbook,
  archive: Pick<ArchivedSourceRecord, 'sha256' | 'bytes'>,
): LgprfManifest {
  const names = new Set(
    parsed.years.flatMap((year) => year.councils.map((label) => lgprfCouncilName(label) ?? label)),
  );
  return {
    dataset: LGPRF_DATASET_LABEL,
    fiscal_years: [...LGPRF_FISCAL_YEARS],
    source_url: LGPRF_LANDING_URL,
    dataset_page: LGPRF_DATASET_PAGE,
    resource_url: LGPRF_RESOURCE_URL,
    retrieved_from: LGPRF_RETRIEVAL_URL,
    snapshot_timestamp: LGPRF_SNAPSHOT_TIMESTAMP,
    source_date: LGPRF_SOURCE_DATE,
    license: LGPRF_LICENSE,
    attribution: LGPRF_ATTRIBUTION,
    disclaimer: LGPRF_DISCLAIMER,
    caveat: LGPRF_CAVEAT,
    sha256: archive.sha256,
    bytes: archive.bytes,
    council_count_per_year: 79,
    distinct_council_names_across_years: names.size,
    years: parsed.years.map((year) => ({
      fiscal_year: year.fiscal_year,
      sheet: year.sheet,
      councils: year.councils.length,
      indicators: year.indicator_codes.length,
      rows: year.rows.length,
      blank_results: year.blank_results,
      no_data_rows: year.no_data_rows,
      units: Object.fromEntries(
        year.indicator_codes.map((code) => [code, LGPRF_INDICATOR_UNITS[code] ?? '']),
      ),
    })),
    rows_emitted: parsed.total_rows,
    non_additive: true,
    notes:
      'Derived indicator rows only; the source workbook is not redistributed. 79 councils per year; 58 indicators in 2020-21..2022-23 and 59 in 2023-24..2024-25. Blank results are preserved as absent values (never zero-filled); rows the source flags "No data" retain any printed 0 and the flag. No sum or average across councils, indicators or years.',
  };
}

export function createLgprfConnector(options: LgprfConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  return {
    id: LGPRF_ID,
    name: LGPRF_NAME,
    publisher: LGPRF_PUBLISHER,
    source_url: LGPRF_LANDING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LGPRF_LICENSE,
    notes: `${LGPRF_CAVEAT} ${LGPRF_ATTRIBUTION} ${LGPRF_DISCLAIMER}`,
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const loaded = await loadLgprfSource(options);
      metadata.warnings = loaded.warnings;
      return loaded.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformLgprfRaw(raw);
      if (result.skipped.length > 0) {
        metadata.warnings = [
          ...(metadata.warnings ?? []),
          `${result.skipped.length} LGPRF row(s) skipped`,
        ];
      }
      return result.records;
    },
    metadata,
  };
}

/** Re-exported for tests that want the raw file bytes without the archive. */
export async function readLgprfFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}
