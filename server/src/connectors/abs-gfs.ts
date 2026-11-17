import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import type { SpendingRecord } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * ABS Government Finance Statistics (GFS) — COFOG-A expense benchmark.
 *
 * IMPORTANT: the ABS SDMX REST API (https://data.api.abs.gov.au/rest/v1) does
 * NOT publish a GFS/COFOG dataflow. That was verified against the full ABS
 * dataflow catalogue (1,228 dataflows; zero GFS/COFOG/Government Finance
 * matches) and against every plausible dataflow id (all 404). This connector
 * therefore uses the official ABS GFS Annual 2024-25 XLSX (Key Tables 9 and
 * 10, "Expenses by purpose, general government sector") as an explicit,
 * human-approved fallback. Do not add a guessed SDMX mapper.
 *
 * Units: the workbook labels every value column "$m" (row 7). One $m is
 * 1,000,000 dollars = 100,000,000 cents. The unit is read from the workbook
 * and validated, never inferred from magnitude.
 *
 * Dimensions:
 *   - Table 9 columns: Commonwealth + the eight state/territory governments
 *     (+ an "All levels of government" column that mixes Commonwealth and
 *     state and is deliberately NOT ingested).
 *   - Table 10 columns: the eight state/territory local-government columns
 *     (ACT has no separate local government column) (+ an "All levels of
 *     government" local total that is deliberately NOT ingested).
 *   - Rows: the COFOG-A purpose labels. ABS publishes "Transport" as a
 *     separate purpose; it is stored as COFOG subdivision 045 (04.5) and must
 *     never be rolled into division 04. "Total expenses" is not a COFOG
 *     function and is skipped.
 *
 * Every emitted row is an official aggregate: verified=true,
 * aggregation_role="benchmark", measure_type="actual". These rows are a
 * top-down statistical benchmark, not a sum of projects. They are never added
 * to project data, never summed across levels, and never summed across
 * measures. The generic /api/spending query excludes them deliberately; the
 * dedicated benchmark endpoint exposes them as published cells.
 */

export const ABS_GFS_ID = 'abs-gfs';
export const ABS_GFS_NAME = 'ABS Government Finance Statistics (GFS) — COFOG-A expense benchmark';
export const ABS_GFS_PUBLISHER = 'Australian Bureau of Statistics';
export const ABS_GFS_DATASET = 'ABS Government Finance Statistics (GFS)';
export const ABS_GFS_FISCAL_YEAR = '2024-25';
export const ABS_GFS_RELEASE_DATE = '2026-04-21';
export const ABS_GFS_RELEASE_URL =
  'https://www.abs.gov.au/statistics/economy/government/government-finance-statistics-annual/2024-25';
export const ABS_GFS_KEY_TABLES_URL = `${ABS_GFS_RELEASE_URL}/55120DO094_202425.xlsx`;
export const ABS_GFS_KEY_TABLES_FILENAME = '55120DO094_202425.xlsx';
export const ABS_GFS_UNIT = '$m';
export const ABS_GFS_UNIT_TO_CENTS = 100_000_000;
export const ABS_GFS_LICENSE = 'CC BY 4.0';
export const ABS_GFS_ATTRIBUTION = '© Commonwealth of Australia 2026 (ABS)';
export const ABS_GFS_SOURCE_URL = ABS_GFS_KEY_TABLES_URL;
export const ABS_GFS_BENCHMARK_CAVEAT =
  'ABS GFS is a top-down statistical aggregate supplied by the ABS. It is a benchmark, not a sum of projects. Never add GFS rows to project data, and never sum across levels of government or across measure types.';

/** The exact COFOG-A purpose labels published in Key Tables 9/10. */
export const ABS_GFS_FUNCTIONS: Readonly<Record<string, string>> = {
  'General public services': '01',
  Defence: '02',
  'Public order and safety': '03',
  'Economic affairs': '04',
  'Environmental protection': '05',
  'Housing and community amenities': '06',
  Health: '07',
  'Recreation, culture and religion': '08',
  Education: '09',
  'Social protection': '10',
  // ABS publishes Transport as its own purpose, outside the Economic affairs
  // subtotal. Store it as COFOG 04.5 (045); never roll it into 04.
  Transport: '045',
};

export const ABS_GFS_FUNCTION_NAMES: Readonly<Record<string, string>> = {
  '01': 'General public services',
  '02': 'Defence',
  '03': 'Public order and safety',
  '04': 'Economic affairs',
  '045': 'Transport',
  '05': 'Environmental protection',
  '06': 'Housing and community amenities',
  '07': 'Health',
  '08': 'Recreation, culture and religion',
  '09': 'Education',
  '10': 'Social protection',
};

export const ABS_GFS_TOTAL_LABEL = 'Total expenses';
export const ABS_GFS_SECTION_LABEL = 'GFS Expenses';

interface AbsGfsColumn {
  column: number;
  label: string;
  table: AbsGfsTable;
  level: 'federal' | 'state' | 'local';
  jurisdiction: string;
  jurisdiction_name: string;
}

type AbsGfsTable = 'Table 9' | 'Table 10';

/** Table 9: Commonwealth and state government expenses by purpose. */
export const ABS_GFS_TABLE9_COLUMNS: readonly AbsGfsColumn[] = [
  {
    column: 2,
    label: 'Commonwealth',
    table: 'Table 9',
    level: 'federal',
    jurisdiction: 'Australia',
    jurisdiction_name: 'Commonwealth',
  },
  {
    column: 3,
    label: 'New South Wales',
    table: 'Table 9',
    level: 'state',
    jurisdiction: 'NSW',
    jurisdiction_name: 'New South Wales',
  },
  {
    column: 4,
    label: 'Victoria',
    table: 'Table 9',
    level: 'state',
    jurisdiction: 'VIC',
    jurisdiction_name: 'Victoria',
  },
  {
    column: 5,
    label: 'Queensland',
    table: 'Table 9',
    level: 'state',
    jurisdiction: 'QLD',
    jurisdiction_name: 'Queensland',
  },
  {
    column: 6,
    label: 'South Australia',
    table: 'Table 9',
    level: 'state',
    jurisdiction: 'SA',
    jurisdiction_name: 'South Australia',
  },
  {
    column: 7,
    label: 'Western Australia',
    table: 'Table 9',
    level: 'state',
    jurisdiction: 'WA',
    jurisdiction_name: 'Western Australia',
  },
  {
    column: 8,
    label: 'Tasmania',
    table: 'Table 9',
    level: 'state',
    jurisdiction: 'TAS',
    jurisdiction_name: 'Tasmania',
  },
  {
    column: 9,
    label: 'Northern Territory',
    table: 'Table 9',
    level: 'state',
    jurisdiction: 'NT',
    jurisdiction_name: 'Northern Territory',
  },
  {
    column: 10,
    label: 'Australian Capital Territory',
    table: 'Table 9',
    level: 'state',
    jurisdiction: 'ACT',
    jurisdiction_name: 'Australian Capital Territory',
  },
];

/** Table 10: local government expenses by purpose. */
export const ABS_GFS_TABLE10_COLUMNS: readonly AbsGfsColumn[] = [
  {
    column: 2,
    label: 'New South Wales',
    table: 'Table 10',
    level: 'local',
    jurisdiction: 'NSW',
    jurisdiction_name: 'New South Wales',
  },
  {
    column: 3,
    label: 'Victoria',
    table: 'Table 10',
    level: 'local',
    jurisdiction: 'VIC',
    jurisdiction_name: 'Victoria',
  },
  {
    column: 4,
    label: 'Queensland',
    table: 'Table 10',
    level: 'local',
    jurisdiction: 'QLD',
    jurisdiction_name: 'Queensland',
  },
  {
    column: 5,
    label: 'South Australia',
    table: 'Table 10',
    level: 'local',
    jurisdiction: 'SA',
    jurisdiction_name: 'South Australia',
  },
  {
    column: 6,
    label: 'Western Australia',
    table: 'Table 10',
    level: 'local',
    jurisdiction: 'WA',
    jurisdiction_name: 'Western Australia',
  },
  {
    column: 7,
    label: 'Tasmania',
    table: 'Table 10',
    level: 'local',
    jurisdiction: 'TAS',
    jurisdiction_name: 'Tasmania',
  },
  {
    column: 8,
    label: 'Northern Territory',
    table: 'Table 10',
    level: 'local',
    jurisdiction: 'NT',
    jurisdiction_name: 'Northern Territory',
  },
];

export const ABS_GFS_TABLE_TITLES: Readonly<Record<AbsGfsTable, string>> = {
  'Table 9':
    'Table 9 Expenses by purpose, general government sector, Commonwealth and state government',
  'Table 10': 'Table 10 Expenses by purpose, general government sector, local government',
};

const SHEET_NAMES: Readonly<Record<AbsGfsTable, string>> = {
  'Table 9': 'Table_9',
  'Table 10': 'Table_10',
};

const COLUMNS_BY_TABLE: Readonly<Record<AbsGfsTable, readonly AbsGfsColumn[]>> = {
  'Table 9': ABS_GFS_TABLE9_COLUMNS,
  'Table 10': ABS_GFS_TABLE10_COLUMNS,
};

export interface AbsGfsSourceMeta {
  source_sha256: string;
  filename: string;
  source_url: string;
  catalogue_url: string;
  source_date: string;
  release_url: string;
}

export interface AbsGfsRaw extends Record<string, unknown> {
  kind: 'abs-gfs';
  table: AbsGfsTable;
  table_title: string;
  sheet: string;
  row: number;
  column: number;
  series_key: string;
  level: 'federal' | 'state' | 'local';
  jurisdiction: string;
  jurisdiction_name: string;
  function_code: string;
  function_name: string;
  fiscal_year: string;
  unit: typeof ABS_GFS_UNIT;
  amount_millions: number;
  source_sha256: string;
  filename: string;
  source_url: string;
  catalogue_url: string;
  source_date: string;
  release_url: string;
}

export interface AbsGfsSkip {
  table: AbsGfsTable | 'unknown';
  row: number | null;
  column: number | null;
  label: string;
  reason: string;
}

export interface AbsGfsTransformResult {
  records: SpendingRecord[];
  skipped: AbsGfsSkip[];
  duplicates: number;
}

export interface AbsGfsWorkbookParse {
  raw: AbsGfsRaw[];
  skipped: AbsGfsSkip[];
  sheets: string[];
}

export interface AbsGfsSourceSelection {
  release_url: string;
  catalogue_url: string;
  source_url: string;
  filename: string;
  fiscal_year: string;
}

export interface AbsGfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  /** Inject an already-archived workbook (tests). Skips discovery + archive. */
  workbookPath?: string;
  workbookSha256?: string;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function cleanText(value: unknown): string {
  if (typeof value === 'string') {
    return value
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function cellValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('result' in record) return record.result;
    if ('richText' in record && Array.isArray(record.richText)) {
      return record.richText
        .map((part) => (typeof part === 'object' && part && 'text' in part ? part.text : ''))
        .join('');
    }
  }
  return value;
}

function cellText(value: unknown): string {
  return cleanText(cellValue(value));
}

function cellNumber(value: unknown): number | null {
  const raw = cellValue(value);
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[$,\s]/g, '').trim();
    if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function workbookRows(row: ExcelJS.Row): Map<number, unknown> {
  const cells = new Map<number, unknown>();
  for (let column = 1; column <= 12; column += 1) {
    const value = row.getCell(column).value;
    if (value !== null && value !== undefined) cells.set(column, value);
  }
  return cells;
}

/** Parse the ABS release page and locate the Key Tables XLSX link. */
export function parseAbsGfsReleasePage(html: string): AbsGfsSourceSelection {
  let href: string | null = null;
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/aria-label="Download - Key Tables/i.test(tag)) continue;
    const found = /href="([^"]+)"/i.exec(tag)?.[1];
    if (found) {
      href = found;
      break;
    }
  }
  if (!href) {
    throw new Error(
      'ABS GFS Annual release page did not contain a "Download - Key Tables" XLSX link',
    );
  }
  const sourceUrl = new URL(href, ABS_GFS_RELEASE_URL).toString();
  const filename = new URL(sourceUrl).pathname.split('/').pop() ?? ABS_GFS_KEY_TABLES_FILENAME;
  return {
    release_url: ABS_GFS_RELEASE_URL,
    catalogue_url: ABS_GFS_RELEASE_URL,
    source_url: sourceUrl,
    filename,
    fiscal_year: ABS_GFS_FISCAL_YEAR,
  };
}

export async function discoverAbsGfsSource(
  fetchImpl: typeof fetch = fetch,
): Promise<AbsGfsSourceSelection> {
  const response = await fetchImpl(ABS_GFS_RELEASE_URL, {
    headers: { Accept: 'text/html' },
  });
  if (!response.ok) {
    throw new Error(`ABS GFS Annual release page HTTP ${response.status}`);
  }
  return parseAbsGfsReleasePage(await response.text());
}

/** Convert official ABS $ million aggregates to integer cents. */
export function absGfsAmountToCents(millions: number): number {
  if (!Number.isFinite(millions)) throw new Error(`ABS GFS amount is not finite: ${millions}`);
  if (millions < 0) throw new Error(`ABS GFS amount is negative: ${millions}`);
  const cents = Math.round(millions * ABS_GFS_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`ABS GFS amount exceeds safe integer cents: ${millions} $m`);
  }
  return cents;
}

/** Stable identity: hash(series_key + time_period). */
export function absGfsNaturalKey(seriesKey: string, fiscalYear: string): string {
  return `abs-gfs:${sha256(`${seriesKey}\u001f${fiscalYear}`).slice(0, 40)}`;
}

export function absGfsSeriesKey(
  table: AbsGfsTable,
  level: string,
  jurisdiction: string,
  functionCode: string,
): string {
  return [table, level, jurisdiction, functionCode].join('|');
}

function failure(table: AbsGfsTable, message: string, row: number, column: number): never {
  throw new Error(
    `ABS GFS ${table} invalid workbook structure at row ${row} column ${column}: ${message}`,
  );
}

function validateSheetHeader(
  table: AbsGfsTable,
  rowsByNumber: Map<number, Map<number, unknown>>,
): void {
  const columns = COLUMNS_BY_TABLE[table];
  const title = cellText(rowsByNumber.get(4)?.get(1));
  if (!title.startsWith(ABS_GFS_TABLE_TITLES[table])) {
    failure(
      table,
      `title mismatch; expected "${ABS_GFS_TABLE_TITLES[table]}", got "${title}"`,
      4,
      1,
    );
  }
  for (const column of columns) {
    const header = cellText(rowsByNumber.get(5)?.get(column.column));
    if (header !== column.label) {
      failure(
        table,
        `header mismatch; expected "${column.label}", got "${header}"`,
        5,
        column.column,
      );
    }
    const year = cellText(rowsByNumber.get(6)?.get(column.column));
    if (!/^\d{4}-\d{2}$/.test(year)) {
      failure(table, `missing FY time period; got "${year}"`, 6, column.column);
    }
    const unit = cellText(rowsByNumber.get(7)?.get(column.column));
    if (unit !== ABS_GFS_UNIT) {
      failure(
        table,
        `unit mismatch; ABS GFS aggregates must be "${ABS_GFS_UNIT}", got "${unit}"`,
        7,
        column.column,
      );
    }
  }
}

/** Extract COFOG-A series from the in-memory representation of a Table 9/10 sheet. */
export function extractAbsGfsSeries(
  table: AbsGfsTable,
  rowsByNumber: Map<number, Map<number, unknown>>,
  meta: AbsGfsSourceMeta,
): { raw: AbsGfsRaw[]; skipped: AbsGfsSkip[] } {
  validateSheetHeader(table, rowsByNumber);
  const columns = COLUMNS_BY_TABLE[table];
  const raw: AbsGfsRaw[] = [];
  const skipped: AbsGfsSkip[] = [];
  const rowNumbers = [...rowsByNumber.keys()].sort((a, b) => a - b);

  for (const rowNumber of rowNumbers) {
    if (rowNumber < 8) continue;
    const cells = rowsByNumber.get(rowNumber);
    if (!cells) continue;
    const label = cellText(cells.get(1));
    if (!label) continue;
    if (/^©/.test(label) || /^More information/i.test(label)) break;
    if (label === ABS_GFS_SECTION_LABEL) continue;
    if (label === ABS_GFS_TOTAL_LABEL) {
      skipped.push({
        table,
        row: rowNumber,
        column: null,
        label,
        reason: 'total row is not a COFOG-A function; skipped to avoid double counting',
      });
      continue;
    }
    const functionCode = ABS_GFS_FUNCTIONS[label];
    if (!functionCode) {
      skipped.push({
        table,
        row: rowNumber,
        column: null,
        label,
        reason: 'unknown purpose label; not a COFOG-A function in the shared taxonomy',
      });
      continue;
    }
    const functionName = ABS_GFS_FUNCTION_NAMES[functionCode] ?? label;

    for (const column of columns) {
      const fiscalYear = cellText(rowsByNumber.get(6)?.get(column.column));
      if (!/^\d{4}-\d{2}$/.test(fiscalYear)) {
        skipped.push({
          table,
          row: rowNumber,
          column: column.column,
          label,
          reason: `missing time period for ${column.label}`,
        });
        continue;
      }
      const amountMillions = cellNumber(cells.get(column.column));
      if (amountMillions === null) {
        skipped.push({
          table,
          row: rowNumber,
          column: column.column,
          label,
          reason: `unparseable amount for ${column.label}`,
        });
        continue;
      }
      if (amountMillions < 0) {
        skipped.push({
          table,
          row: rowNumber,
          column: column.column,
          label,
          reason: `negative amount for ${column.label}; rejected rather than sign-flipped`,
        });
        continue;
      }
      const seriesKey = absGfsSeriesKey(table, column.level, column.jurisdiction, functionCode);
      raw.push({
        kind: 'abs-gfs',
        table,
        table_title: ABS_GFS_TABLE_TITLES[table],
        sheet: SHEET_NAMES[table],
        row: rowNumber,
        column: column.column,
        series_key: seriesKey,
        level: column.level,
        jurisdiction: column.jurisdiction,
        jurisdiction_name: column.jurisdiction_name,
        function_code: functionCode,
        function_name: functionName,
        fiscal_year: fiscalYear,
        unit: ABS_GFS_UNIT,
        amount_millions: amountMillions,
        source_sha256: meta.source_sha256,
        filename: meta.filename,
        source_url: meta.source_url,
        catalogue_url: meta.catalogue_url,
        source_date: meta.source_date,
        release_url: meta.release_url,
      });
    }
  }

  return { raw, skipped };
}

/**
 * Stream-parse the archived Key Tables workbook. Only Table_9 and Table_10 are
 * read; every other sheet is ignored without being fully materialised.
 */
export async function parseAbsGfsWorkbook(
  filePath: string,
  meta: AbsGfsSourceMeta,
): Promise<AbsGfsWorkbookParse> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    worksheets: 'emit',
    styles: 'ignore',
  });

  const raw: AbsGfsRaw[] = [];
  const skipped: AbsGfsSkip[] = [];
  const sheets: string[] = [];

  for await (const worksheet of reader) {
    // exceljs types omit WorksheetReader.name even though the runtime workbook
    // reader sets it from workbook.xml.
    const name = (worksheet as unknown as { name?: string }).name ?? '';
    sheets.push(name);
    const table = (Object.keys(SHEET_NAMES) as AbsGfsTable[]).find(
      (candidate) => SHEET_NAMES[candidate] === name,
    );
    if (!table) continue;

    const rowsByNumber = new Map<number, Map<number, unknown>>();
    for await (const row of worksheet) {
      rowsByNumber.set(row.number, workbookRows(row));
    }
    const parsed = extractAbsGfsSeries(table, rowsByNumber, meta);
    raw.push(...parsed.raw);
    skipped.push(...parsed.skipped);
  }

  if (!sheets.some((name) => name === SHEET_NAMES['Table 9'])) {
    throw new Error('ABS GFS workbook is missing the Table_9 sheet');
  }
  if (!sheets.some((name) => name === SHEET_NAMES['Table 10'])) {
    throw new Error('ABS GFS workbook is missing the Table_10 sheet');
  }
  return { raw, skipped, sheets };
}

function absGfsRecord(raw: AbsGfsRaw): SpendingRecord {
  const amountCents = absGfsAmountToCents(raw.amount_millions);
  const naturalKey = absGfsNaturalKey(raw.series_key, raw.fiscal_year);
  const locationNote =
    raw.level === 'federal'
      ? 'National (Australia): no sub-state location'
      : `Statewide only (${raw.jurisdiction}): no sub-state location`;

  const notes = [
    `ABS GFS Annual ${ABS_GFS_FISCAL_YEAR} Key Tables workbook ${raw.filename}`,
    `${raw.table}: "${raw.table_title}"`,
    `Sheet ${raw.sheet}, row ${raw.row}, column ${raw.column} (${raw.jurisdiction_name})`,
    `Unit: ${raw.unit} as stated in workbook row 7; converted to cents at ${ABS_GFS_UNIT_TO_CENTS} cents per $m`,
    `COFOG-A function ${raw.function_code} ${raw.function_name}${
      raw.function_code === '045'
        ? ' (ABS publishes Transport separately; stored as 04.5 and never rolled into 04)'
        : ''
    }`,
    locationNote,
    'Official ABS aggregate: verified=true, data_quality_flag=verified',
    ABS_GFS_BENCHMARK_CAVEAT,
    'SDMX fallback: the ABS data.api.abs.gov.au catalogue has no GFS/COFOG dataflow, so this row is from the official annual XLSX, not a guessed SDMX query',
    `Source copy SHA-256: ${raw.source_sha256}`,
  ].join('; ');

  return {
    amount_cents: amountCents,
    measure_type: 'actual',
    fiscal_year: raw.fiscal_year,
    source_id: ABS_GFS_ID,
    source_url: raw.source_url,
    verified: true,
    natural_key: naturalKey,
    jurisdiction_level: raw.level,
    jurisdiction: raw.jurisdiction,
    source_dataset: ABS_GFS_DATASET,
    source_date: raw.source_date,
    data_quality_flag: 'verified',
    aggregation_role: 'benchmark',
    function_code: raw.function_code,
    description: `ABS GFS COFOG-A expense aggregate: ${raw.function_name} — ${raw.jurisdiction_name} (${raw.level}), FY${raw.fiscal_year} (benchmark, not a project)`,
    funding_source: 'ABS Government Finance Statistics',
    ...(raw.level === 'federal' ? {} : { location: { state: raw.jurisdiction } }),
    notes,
  };
}

/** Map raw ABS GFS cells to measures; deduplicates identical natural keys. */
export function transformAbsGfsRaw(raw: readonly RawRecord[]): AbsGfsTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: AbsGfsSkip[] = [];
  const keys = new Set<string>();
  let duplicates = 0;

  for (const entry of raw) {
    if (entry.kind !== 'abs-gfs') {
      skipped.push({
        table: 'unknown',
        row: null,
        column: null,
        label: String(entry.kind ?? '(missing kind)'),
        reason: 'unknown raw kind',
      });
      continue;
    }
    const row = entry as AbsGfsRaw;
    try {
      const record = absGfsRecord(row);
      if (keys.has(record.natural_key)) {
        duplicates += 1;
        continue;
      }
      keys.add(record.natural_key);
      records.push(record);
    } catch (error) {
      skipped.push({
        table: row.table,
        row: row.row,
        column: row.column,
        label: row.function_name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { records, skipped, duplicates };
}

export interface AbsGfsLoadedSource {
  raw: AbsGfsRaw[];
  archive: ArchivedSourceRecord;
  selection: AbsGfsSourceSelection;
  parsed: AbsGfsWorkbookParse;
  warnings: string[];
}

/** Discover the release page, SHA-256 archive the workbook outside the repo and parse it. */
export async function loadAbsGfsSource(
  options: AbsGfsConnectorOptions = {},
): Promise<AbsGfsLoadedSource> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const selection = await discoverAbsGfsSource(fetchImpl);

  let localPath: string;
  let sha256Value: string;
  let bytes: number;
  let archive: ArchivedSourceRecord | null = null;

  if (options.workbookPath) {
    localPath = options.workbookPath;
    sha256Value = options.workbookSha256 ?? 'unarchived-test-fixture';
    bytes = 0;
  } else {
    archive = await archiveSourceDocument({
      source_id: ABS_GFS_ID,
      title: `ABS GFS Annual ${ABS_GFS_FISCAL_YEAR} — Key Tables`,
      original_url: selection.source_url,
      retrieved_from: selection.source_url,
      archived_from: 'direct',
      filename: selection.filename,
      content_type: inferContentType(selection.filename),
      fetchImpl,
      ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
      notes: `ABS GFS Annual ${ABS_GFS_FISCAL_YEAR} release page ${selection.release_url}; Key Tables 9/10 COFOG-A expenses by purpose. SDMX fallback: no GFS dataflow in the ABS SDMX catalogue.`,
    });
    localPath = archive.local_path;
    sha256Value = archive.sha256;
    bytes = archive.bytes;
  }

  const meta: AbsGfsSourceMeta = {
    source_sha256: sha256Value,
    filename: selection.filename,
    source_url: selection.source_url,
    catalogue_url: selection.catalogue_url,
    source_date: ABS_GFS_RELEASE_DATE,
    release_url: selection.release_url,
  };
  const parsed = await parseAbsGfsWorkbook(localPath, meta);
  const result = transformAbsGfsRaw(parsed.raw);
  const warnings = [
    `workbook=${selection.filename}; sha256=${sha256Value}; bytes=${bytes}; sheets=${parsed.sheets.length}`,
    `parsed=${parsed.raw.length}; ingested=${result.records.length}; skipped=${parsed.skipped.length}; duplicates=${result.duplicates}`,
    `levels=${JSON.stringify(
      result.records.reduce<Record<string, number>>((counts, record) => {
        const key = record.jurisdiction_level ?? 'unknown';
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    )}`,
    'unit=$m confirmed from workbook row 7; cents x100,000,000',
    ABS_GFS_BENCHMARK_CAVEAT,
  ];
  if (parsed.raw.length === 0) throw new Error('ABS GFS workbook produced no COFOG-A series');
  if (result.records.length === 0) throw new Error('ABS GFS workbook produced no measures');

  return {
    raw: parsed.raw,
    // A test fixture has no archived record; callers that need one use the
    // production path. The connector itself never persists an archive record.
    archive:
      archive ??
      ({
        document_id: `${ABS_GFS_ID}:fixture`,
        source_id: ABS_GFS_ID,
        title: 'ABS GFS fixture',
        original_url: selection.source_url,
        retrieved_from: selection.source_url,
        archived_from: 'other',
        local_path: localPath,
        sha256: sha256Value,
        bytes,
        content_type: inferContentType(selection.filename),
        fetched_at: new Date().toISOString(),
        last_modified: null,
        etag: null,
        hash_verified: false,
      } satisfies ArchivedSourceRecord),
    selection,
    parsed,
    warnings,
  };
}

/** Build the ABS GFS benchmark connector. */
export function createAbsGfsConnector(options: AbsGfsConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: ABS_GFS_ID,
    name: ABS_GFS_NAME,
    publisher: ABS_GFS_PUBLISHER,
    source_url: ABS_GFS_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'federal',
    license: ABS_GFS_LICENSE,
    notes: `${ABS_GFS_ATTRIBUTION} ABS GFS Annual ${ABS_GFS_FISCAL_YEAR} Key Tables 9/10 ("Expenses by purpose", general government sector) from the official XLSX; SHA-256 archived outside the repo. The ABS SDMX API has no GFS/COFOG dataflow, so this is the human-approved XLSX fallback, not a guessed SDMX query. Units are $m confirmed from the workbook (x100,000,000 cents). Every row is an official aggregate: measure_type=actual, verified=true, data_quality_flag=verified, aggregation_role=benchmark. Levels are federal/state/local; jurisdiction is Australia or the state/territory code; location is national or statewide only. Rows are a top-down benchmark, never project data, and are never summed with project data or across levels/measures. Transport is stored as 045 and must not be rolled into 04. Total rows and the "All levels of government" columns are not ingested.`,
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const loaded = await loadAbsGfsSource(options);
      metadata.warnings = loaded.warnings;
      return loaded.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformAbsGfsRaw(raw);
      const warnings = [...(metadata.warnings ?? [])];
      if (result.skipped.length > 0)
        warnings.push(`${result.skipped.length} ABS GFS row(s) rejected`);
      if (result.duplicates > 0) warnings.push(`${result.duplicates} duplicate row(s) skipped`);
      metadata.warnings = warnings;
      return result.records;
    },
    metadata,
  };
}
