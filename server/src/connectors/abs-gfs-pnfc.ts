import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import type { SpendingRecord } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * ABS Government Finance Statistics (GFS) — Public Non-Financial Corporations
 * (PNFC) sector benchmark.
 *
 * SOURCE: the ABS SDMX API has NO PNFC/GFS dataflow. This was verified against
 * the full ABS dataflow catalogue (1,228 dataflows; zero PNFC/GFS/COFOG/Public
 * Non-Financial matches) and against every plausible dataflow id (all HTTP 404).
 * The ABS GFS Annual 2024-25 release publishes nine separate PNFC data cubes,
 * one per jurisdiction, and those exact XLSX files are the human-approved
 * fallback. Do not add a guessed SDMX mapper.
 *
 * The Phase 4 COFOG-A Key Tables workbook (55120DO094) is general government
 * only and is NOT a PNFC source. It is deliberately not used here.
 *
 * TABLES (all genuine "Public Non-financial Corporations Operating Statement"
 * data cubes, verified from the workbook title row):
 *   - 55120DO033: Australia, all levels of government
 *   - 55120DO023…DO030: New South Wales, Victoria, Queensland, South Australia,
 *     Western Australia, Tasmania, Northern Territory, Australian Capital
 *     Territory (state/territory government PNFCs)
 *
 * Units: each sheet states "$m" in row 6. One $m is 100,000,000 cents; the
 * unit is read from the workbook and validated, never inferred from magnitude.
 *
 * Ingested cells: only the published "Total GFS revenue" and "Total GFS
 * expenses" rows for FY2024-25. Component lines are not ingested so the two
 * totals cannot be double counted. Revenue and expense are separate flows and
 * are never summed together. This is a sector aggregate: jurisdiction_level
 * "pnfc", aggregation_role "benchmark", verified true. It is never added to
 * SOC/entity/government/project data and never summed across jurisdictions or
 * flows.
 */

export const ABS_GFS_PNFC_ID = 'abs-gfs-pnfc';
export const ABS_GFS_PNFC_NAME =
  'ABS Government Finance Statistics — Public Non-Financial Corporations benchmark';
export const ABS_GFS_PNFC_PUBLISHER = 'Australian Bureau of Statistics';
export const ABS_GFS_PNFC_DATASET = 'ABS GFS — Public Non-Financial Corporations';
export const ABS_GFS_PNFC_FISCAL_YEAR = '2024-25';
export const ABS_GFS_PNFC_RELEASE_DATE = '2026-04-21';
export const ABS_GFS_PNFC_RELEASE_URL =
  'https://www.abs.gov.au/statistics/economy/government/government-finance-statistics-annual/2024-25';
export const ABS_GFS_PNFC_UNIT = '$m';
export const ABS_GFS_PNFC_UNIT_TO_CENTS = 100_000_000;
export const ABS_GFS_PNFC_LICENSE = 'CC BY 4.0';
export const ABS_GFS_PNFC_ATTRIBUTION = '© Commonwealth of Australia 2026 (ABS)';
export const ABS_GFS_PNFC_SOURCE_URL = ABS_GFS_PNFC_RELEASE_URL;
export const ABS_GFS_PNFC_SDMX_NOTE =
  'The ABS SDMX API (https://data.api.abs.gov.au/rest/v1) has no PNFC/GFS dataflow: the full catalogue has 1,228 dataflows and zero PNFC, Public Non-Financial, GFS, COFOG or Government Finance dataflows, and every plausible PNFC dataflow id returns HTTP 404. This row is from the official ABS GFS Annual 2024-25 PNFC XLSX, not a guessed SDMX query.';
export const ABS_GFS_PNFC_BENCHMARK_CAVEAT =
  'ABS GFS PNFC is a top-down sector aggregate supplied by the ABS. It is a benchmark, not a sum of projects or entities. Never add it to SOC/entity, government, charity or project data, and never sum across jurisdictions or across revenue/expense flows.';

export type AbsGfsPnfcFlow = 'revenue' | 'expense';

export interface AbsGfsPnfcLineSpec {
  flow: AbsGfsPnfcFlow;
  line_item: string;
  label: string;
}

/** Only the two published operating-statement totals are ingested. */
export const ABS_GFS_PNFC_LINES: readonly AbsGfsPnfcLineSpec[] = [
  { flow: 'revenue', line_item: 'total_revenue', label: 'Total GFS revenue' },
  { flow: 'expense', line_item: 'total_expenses', label: 'Total GFS expenses' },
];

export interface AbsGfsPnfcTableSpec {
  /** Stable workbook id used in the series key and provenance. */
  file_id: string;
  filename: string;
  /** Release-page aria-label place string, e.g. "Australia - all levels of government". */
  place: string;
  /** Workbook title must contain this jurisdiction token. */
  title_token: string;
  jurisdiction: string;
  jurisdiction_name: string;
  level: 'national' | 'state';
}

export const ABS_GFS_PNFC_TABLES: readonly AbsGfsPnfcTableSpec[] = [
  {
    file_id: '55120DO033_202425',
    filename: '55120DO033_202425.xlsx',
    place: 'Australia - all levels of government',
    title_token: 'Total all levels of Government',
    jurisdiction: 'Australia',
    jurisdiction_name: 'Australia (all levels of government)',
    level: 'national',
  },
  {
    file_id: '55120DO023_202425',
    filename: '55120DO023_202425.xlsx',
    place: 'New South Wales',
    title_token: 'New South Wales',
    jurisdiction: 'NSW',
    jurisdiction_name: 'New South Wales',
    level: 'state',
  },
  {
    file_id: '55120DO024_202425',
    filename: '55120DO024_202425.xlsx',
    place: 'Victoria',
    title_token: 'Victoria',
    jurisdiction: 'VIC',
    jurisdiction_name: 'Victoria',
    level: 'state',
  },
  {
    file_id: '55120DO025_202425',
    filename: '55120DO025_202425.xlsx',
    place: 'Queensland',
    title_token: 'Queensland',
    jurisdiction: 'QLD',
    jurisdiction_name: 'Queensland',
    level: 'state',
  },
  {
    file_id: '55120DO026_202425',
    filename: '55120DO026_202425.xlsx',
    place: 'South Australia',
    title_token: 'South Australia',
    jurisdiction: 'SA',
    jurisdiction_name: 'South Australia',
    level: 'state',
  },
  {
    file_id: '55120DO027_202425',
    filename: '55120DO027_202425.xlsx',
    place: 'Western Australia',
    title_token: 'Western Australia',
    jurisdiction: 'WA',
    jurisdiction_name: 'Western Australia',
    level: 'state',
  },
  {
    file_id: '55120DO028_202425',
    filename: '55120DO028_202425.xlsx',
    place: 'Tasmania',
    title_token: 'Tasmania',
    jurisdiction: 'TAS',
    jurisdiction_name: 'Tasmania',
    level: 'state',
  },
  {
    file_id: '55120DO029_202425',
    filename: '55120DO029_202425.xlsx',
    place: 'Northern Territory',
    title_token: 'Northern Territory',
    jurisdiction: 'NT',
    jurisdiction_name: 'Northern Territory',
    level: 'state',
  },
  {
    file_id: '55120DO030_202425',
    filename: '55120DO030_202425.xlsx',
    place: 'Australian Capital Territory',
    title_token: 'Australian Capital Territory',
    jurisdiction: 'ACT',
    jurisdiction_name: 'Australian Capital Territory',
    level: 'state',
  },
];

export interface AbsGfsPnfcSelection extends AbsGfsPnfcTableSpec {
  source_url: string;
}

export interface AbsGfsPnfcSourceMeta {
  source_sha256: string;
  filename: string;
  source_url: string;
  release_url: string;
  source_date: string;
}

export interface AbsGfsPnfcRaw extends Record<string, unknown> {
  kind: 'abs-gfs-pnfc';
  file_id: string;
  table: 'Table_1';
  table_title: string;
  sheet: 'Table_1';
  row: number;
  column: number;
  series_key: string;
  level: 'national' | 'state';
  jurisdiction: string;
  jurisdiction_name: string;
  gfs_flow: AbsGfsPnfcFlow;
  gfs_line_item: string;
  gfs_line_label: string;
  fiscal_year: string;
  unit: typeof ABS_GFS_PNFC_UNIT;
  amount_millions: number;
  source_sha256: string;
  filename: string;
  source_url: string;
  release_url: string;
  source_date: string;
}

export interface AbsGfsPnfcSkip {
  file_id: string;
  row: number | null;
  column: number | null;
  label: string;
  reason: string;
}

export interface AbsGfsPnfcWorkbookParse {
  raw: AbsGfsPnfcRaw[];
  skipped: AbsGfsPnfcSkip[];
  table_title: string;
  sheets: string[];
}

export interface AbsGfsPnfcTransformResult {
  records: SpendingRecord[];
  skipped: AbsGfsPnfcSkip[];
  duplicates: number;
}

export interface AbsGfsPnfcLoadedSource {
  raw: AbsGfsPnfcRaw[];
  archives: ArchivedSourceRecord[];
  selections: readonly AbsGfsPnfcSelection[];
  parsed: AbsGfsPnfcWorkbookParse[];
  warnings: string[];
}

export interface AbsGfsPnfcConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  /** Inject release-page selections (tests). Skips discovery. */
  selections?: readonly AbsGfsPnfcSelection[];
  /** Inject already-downloaded workbooks (tests). Keyed by filename. */
  workbookPaths?: Readonly<Record<string, { path: string; sha256: string }>>;
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

/** Parse the ABS release page and locate every genuine PNFC data cube. */
export function parseAbsGfsPnfcReleasePage(html: string): AbsGfsPnfcSelection[] {
  const byPlace = new Map<string, string>();
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const aria = /aria-label="([^"]+)"/i.exec(tag)?.[1];
    if (!aria || !/Public non-financial corporations/i.test(aria)) continue;
    const place = /Public non-financial corporations\s*-\s*(.+?)\s+xlsx/i.exec(aria)?.[1]?.trim();
    const href = /href="([^"]+)"/i.exec(tag)?.[1];
    if (place && href) byPlace.set(place, href);
  }

  const selections: AbsGfsPnfcSelection[] = [];
  for (const spec of ABS_GFS_PNFC_TABLES) {
    const href = byPlace.get(spec.place);
    if (!href) {
      throw new Error(
        `ABS GFS Annual release page did not contain a PNFC XLSX link for "${spec.place}"`,
      );
    }
    selections.push({ ...spec, source_url: new URL(href, ABS_GFS_PNFC_RELEASE_URL).toString() });
  }
  return selections;
}

export async function discoverAbsGfsPnfcSource(
  fetchImpl: typeof fetch = fetch,
): Promise<AbsGfsPnfcSelection[]> {
  const response = await fetchImpl(ABS_GFS_PNFC_RELEASE_URL, {
    headers: { Accept: 'text/html' },
  });
  if (!response.ok) {
    throw new Error(`ABS GFS Annual release page HTTP ${response.status}`);
  }
  return parseAbsGfsPnfcReleasePage(await response.text());
}

/** Convert official ABS $ million aggregates to integer cents. */
export function absGfsPnfcAmountToCents(millions: number): number {
  if (!Number.isFinite(millions)) throw new Error(`ABS GFS PNFC amount is not finite: ${millions}`);
  if (millions < 0) throw new Error(`ABS GFS PNFC amount is negative: ${millions}`);
  const cents = Math.round(millions * ABS_GFS_PNFC_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`ABS GFS PNFC amount exceeds safe integer cents: ${millions} $m`);
  }
  return cents;
}

/** Stable identity: hash(series_key + time_period). */
export function absGfsPnfcNaturalKey(seriesKey: string, fiscalYear: string): string {
  return `abs-gfs-pnfc:${sha256(`${seriesKey}\u001f${fiscalYear}`).slice(0, 40)}`;
}

export function absGfsPnfcSeriesKey(
  spec: Pick<AbsGfsPnfcTableSpec, 'file_id' | 'level' | 'jurisdiction'>,
  flow: AbsGfsPnfcFlow,
  lineItem: string,
): string {
  return [spec.file_id, spec.level, spec.jurisdiction, flow, lineItem].join('|');
}

function failure(spec: AbsGfsPnfcTableSpec, message: string): never {
  throw new Error(`ABS GFS PNFC ${spec.filename} invalid workbook structure: ${message}`);
}

/**
 * Extract the two published totals from an in-memory PNFC operating statement.
 * The title, time-period column and unit are validated; a general-government
 * workbook is rejected rather than co-opted.
 */
export function extractAbsGfsPnfcWorkbook(
  spec: AbsGfsPnfcTableSpec,
  rowsByNumber: Map<number, Map<number, unknown>>,
  meta: AbsGfsPnfcSourceMeta,
): AbsGfsPnfcWorkbookParse {
  const title = cellText(rowsByNumber.get(4)?.get(1));
  if (!/Public Non-financial Corporations Operating Statement/i.test(title)) {
    failure(spec, `title is not a PNFC operating statement: "${title}"`);
  }
  if (!title.includes(spec.title_token)) {
    failure(spec, `title "${title}" does not contain expected jurisdiction "${spec.title_token}"`);
  }

  const yearRow = rowsByNumber.get(5) ?? new Map<number, unknown>();
  const unitRow = rowsByNumber.get(6) ?? new Map<number, unknown>();
  const yearColumns = [...yearRow.entries()]
    .filter(([, value]) => cellText(value) === ABS_GFS_PNFC_FISCAL_YEAR)
    .map(([column]) => column);
  if (yearColumns.length !== 1) {
    failure(
      spec,
      `expected exactly one ${ABS_GFS_PNFC_FISCAL_YEAR} time-period column, got ${yearColumns.length}`,
    );
  }
  const fiscalYear = ABS_GFS_PNFC_FISCAL_YEAR;
  const column = yearColumns[0]!;
  const unit = cellText(unitRow.get(column));
  if (unit !== ABS_GFS_PNFC_UNIT) {
    failure(spec, `unit must be "${ABS_GFS_PNFC_UNIT}", got "${unit}" at column ${column}`);
  }

  const labels = new Map<string, number>();
  const rowNumbers = [...rowsByNumber.keys()].sort((a, b) => a - b);
  for (const rowNumber of rowNumbers) {
    if (rowNumber < 7) continue;
    const label = cellText(rowsByNumber.get(rowNumber)?.get(1));
    if (!label) continue;
    if (/^©/.test(label) || /^More information/i.test(label)) break;
    if (!labels.has(label)) labels.set(label, rowNumber);
  }
  for (const section of ['GFS Revenue', 'GFS Expenses']) {
    if (!labels.has(section)) failure(spec, `missing section "${section}"`);
  }

  const raw: AbsGfsPnfcRaw[] = [];
  const skipped: AbsGfsPnfcSkip[] = [];
  for (const line of ABS_GFS_PNFC_LINES) {
    const rowNumber = labels.get(line.label);
    if (rowNumber === undefined) {
      failure(spec, `missing published total row "${line.label}"`);
    }
    const amountMillions = cellNumber(rowsByNumber.get(rowNumber)?.get(column));
    if (amountMillions === null) {
      skipped.push({
        file_id: spec.file_id,
        row: rowNumber,
        column,
        label: line.label,
        reason: `unparseable ${line.flow} amount`,
      });
      continue;
    }
    if (amountMillions < 0) {
      skipped.push({
        file_id: spec.file_id,
        row: rowNumber,
        column,
        label: line.label,
        reason: `negative ${line.flow} amount; rejected rather than sign-flipped`,
      });
      continue;
    }
    raw.push({
      kind: 'abs-gfs-pnfc',
      file_id: spec.file_id,
      table: 'Table_1',
      table_title: title,
      sheet: 'Table_1',
      row: rowNumber,
      column,
      series_key: absGfsPnfcSeriesKey(spec, line.flow, line.line_item),
      level: spec.level,
      jurisdiction: spec.jurisdiction,
      jurisdiction_name: spec.jurisdiction_name,
      gfs_flow: line.flow,
      gfs_line_item: line.line_item,
      gfs_line_label: line.label,
      fiscal_year: fiscalYear,
      unit: ABS_GFS_PNFC_UNIT,
      amount_millions: amountMillions,
      source_sha256: meta.source_sha256,
      filename: meta.filename,
      source_url: meta.source_url,
      release_url: meta.release_url,
      source_date: meta.source_date,
    });
  }

  return { raw, skipped, table_title: title, sheets: ['Table_1'] };
}

function workbookRows(row: ExcelJS.Row): Map<number, unknown> {
  const cells = new Map<number, unknown>();
  for (let column = 1; column <= 12; column += 1) {
    const value = row.getCell(column).value;
    if (value !== null && value !== undefined) cells.set(column, value);
  }
  return cells;
}

/** Read the Table_1 sheet of one archived PNFC data cube. */
export async function parseAbsGfsPnfcWorkbook(
  filePath: string,
  spec: AbsGfsPnfcTableSpec,
  meta: AbsGfsPnfcSourceMeta,
): Promise<AbsGfsPnfcWorkbookParse> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet('Table_1');
  if (!worksheet) throw new Error(`ABS GFS PNFC ${spec.filename} is missing the Table_1 sheet`);
  const rowsByNumber = new Map<number, Map<number, unknown>>();
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rowsByNumber.set(row.number, workbookRows(row));
  });
  return extractAbsGfsPnfcWorkbook(spec, rowsByNumber, meta);
}

function absGfsPnfcRecord(raw: AbsGfsPnfcRaw): SpendingRecord {
  const amountCents = absGfsPnfcAmountToCents(raw.amount_millions);
  const naturalKey = absGfsPnfcNaturalKey(raw.series_key, raw.fiscal_year);
  const locationNote =
    raw.level === 'national'
      ? 'National (Australia, all levels of government): no sub-state location'
      : `Statewide only (${raw.jurisdiction}): no sub-state location`;

  const notes = [
    `ABS GFS Annual ${ABS_GFS_PNFC_FISCAL_YEAR} PNFC data cube ${raw.filename}`,
    `"${raw.table_title}" (Table_1)`,
    `Sheet Table_1, row ${raw.row}, column ${raw.column} (${raw.jurisdiction_name})`,
    `Published line: "${raw.gfs_line_label}" (${raw.gfs_flow})`,
    `Unit: ${raw.unit} as stated in workbook row 6; converted to cents at ${ABS_GFS_PNFC_UNIT_TO_CENTS} cents per $m`,
    locationNote,
    'Official ABS aggregate: verified=true, data_quality_flag=verified',
    ABS_GFS_PNFC_BENCHMARK_CAVEAT,
    ABS_GFS_PNFC_SDMX_NOTE,
    `Source copy SHA-256: ${raw.source_sha256}`,
  ].join('; ');

  return {
    amount_cents: amountCents,
    measure_type: 'actual',
    fiscal_year: raw.fiscal_year,
    source_id: ABS_GFS_PNFC_ID,
    source_url: raw.source_url,
    verified: true,
    natural_key: naturalKey,
    jurisdiction_level: 'pnfc',
    jurisdiction: raw.jurisdiction,
    source_dataset: ABS_GFS_PNFC_DATASET,
    source_date: raw.source_date,
    data_quality_flag: 'verified',
    aggregation_role: 'benchmark',
    gfs_flow: raw.gfs_flow,
    gfs_line_item: raw.gfs_line_item,
    gfs_line_label: raw.gfs_line_label,
    description: `ABS GFS PNFC ${raw.gfs_flow} aggregate: ${raw.gfs_line_label} — ${raw.jurisdiction_name}, FY${raw.fiscal_year} (sector aggregate, not a project)`,
    funding_source: 'ABS Government Finance Statistics',
    ...(raw.level === 'state' ? { location: { state: raw.jurisdiction } } : {}),
    notes,
  };
}

/** Map raw ABS GFS PNFC cells to measures; deduplicates identical natural keys. */
export function transformAbsGfsPnfcRaw(raw: readonly RawRecord[]): AbsGfsPnfcTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: AbsGfsPnfcSkip[] = [];
  const keys = new Set<string>();
  let duplicates = 0;

  for (const entry of raw) {
    if (entry.kind !== 'abs-gfs-pnfc') {
      skipped.push({
        file_id: String(entry.kind ?? '(missing kind)'),
        row: null,
        column: null,
        label: String(entry.kind ?? '(missing kind)'),
        reason: 'unknown raw kind',
      });
      continue;
    }
    const row = entry as AbsGfsPnfcRaw;
    try {
      const record = absGfsPnfcRecord(row);
      if (keys.has(record.natural_key)) {
        duplicates += 1;
        continue;
      }
      keys.add(record.natural_key);
      records.push(record);
    } catch (error) {
      skipped.push({
        file_id: row.file_id,
        row: row.row,
        column: row.column,
        label: row.gfs_line_label,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { records, skipped, duplicates };
}

/** Discover the release page, archive the nine PNFC data cubes and parse them. */
export async function loadAbsGfsPnfcSource(
  options: AbsGfsPnfcConnectorOptions = {},
): Promise<AbsGfsPnfcLoadedSource> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const selections: readonly AbsGfsPnfcSelection[] =
    options.selections ?? (await discoverAbsGfsPnfcSource(fetchImpl));
  if (selections.length !== ABS_GFS_PNFC_TABLES.length) {
    throw new Error(
      `ABS GFS PNFC expected ${ABS_GFS_PNFC_TABLES.length} data cubes, got ${selections.length}`,
    );
  }

  const archives: ArchivedSourceRecord[] = [];
  const parsed: AbsGfsPnfcWorkbookParse[] = [];
  const raw: AbsGfsPnfcRaw[] = [];
  let bytesTotal = 0;

  for (const selection of selections) {
    let localPath: string;
    let sha256Value: string;
    if (options.workbookPaths?.[selection.filename]) {
      const fixture = options.workbookPaths[selection.filename]!;
      localPath = fixture.path;
      sha256Value = fixture.sha256;
    } else {
      const archive = await archiveSourceDocument({
        source_id: ABS_GFS_PNFC_ID,
        title: `ABS GFS Annual ${ABS_GFS_PNFC_FISCAL_YEAR} — PNFC ${selection.jurisdiction_name}`,
        original_url: selection.source_url,
        retrieved_from: selection.source_url,
        archived_from: 'direct',
        filename: selection.filename,
        content_type: inferContentType(selection.filename),
        fetchImpl,
        ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
        notes: `ABS GFS Annual ${ABS_GFS_PNFC_FISCAL_YEAR} PNFC operating statement for ${selection.jurisdiction_name}. ${ABS_GFS_PNFC_SDMX_NOTE}`,
      });
      archives.push(archive);
      localPath = archive.local_path;
      sha256Value = archive.sha256;
      bytesTotal += archive.bytes;
    }

    const meta: AbsGfsPnfcSourceMeta = {
      source_sha256: sha256Value,
      filename: selection.filename,
      source_url: selection.source_url,
      release_url: ABS_GFS_PNFC_RELEASE_URL,
      source_date: ABS_GFS_PNFC_RELEASE_DATE,
    };
    const result = await parseAbsGfsPnfcWorkbook(localPath, selection, meta);
    parsed.push(result);
    raw.push(...result.raw);
  }

  const transformed = transformAbsGfsPnfcRaw(raw);
  const warnings = [
    `cubes=${selections.length}; bytes=${bytesTotal}; parsed=${raw.length}; ingested=${transformed.records.length}; skipped=${transformed.skipped.length}; duplicates=${transformed.duplicates}`,
    `jurisdictions=${JSON.stringify(
      transformed.records.reduce<Record<string, number>>((counts, record) => {
        const key = record.jurisdiction ?? 'unknown';
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    )}`,
    `flows=${JSON.stringify(
      transformed.records.reduce<Record<string, number>>((counts, record) => {
        const key = record.gfs_flow ?? 'unknown';
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    )}`,
    'unit=$m confirmed from workbook row 6; cents x100,000,000',
    ABS_GFS_PNFC_BENCHMARK_CAVEAT,
  ];
  if (raw.length === 0) throw new Error('ABS GFS PNFC workbooks produced no totals');
  if (transformed.records.length === 0) throw new Error('ABS GFS PNFC produced no measures');

  return { raw, archives, selections, parsed, warnings };
}

/** Build the ABS GFS PNFC benchmark connector. */
export function createAbsGfsPnfcConnector(options: AbsGfsPnfcConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: ABS_GFS_PNFC_ID,
    name: ABS_GFS_PNFC_NAME,
    publisher: ABS_GFS_PNFC_PUBLISHER,
    source_url: ABS_GFS_PNFC_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'pnfc',
    license: ABS_GFS_PNFC_LICENSE,
    notes: `${ABS_GFS_PNFC_ATTRIBUTION} ABS GFS Annual ${ABS_GFS_PNFC_FISCAL_YEAR} PNFC operating statements for Australia (all levels) and the eight state/territory jurisdictions, from nine separate official XLSX data cubes; SHA-256 archived outside the repo. The ABS SDMX API has no PNFC/GFS dataflow, so this is the human-approved XLSX fallback, not a guessed SDMX query. Units are $m confirmed from workbook row 6 (x100,000,000 cents). Only the published "Total GFS revenue" and "Total GFS expenses" rows are ingested, separately by flow. Every row is an official aggregate: measure_type=actual, jurisdiction_level=pnfc, verified=true, data_quality_flag=verified, aggregation_role=benchmark. It is a sector aggregate — never add it to SOC/entity, government, charity or project data, and never sum across jurisdictions or across revenue/expense flows.`,
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const loaded = await loadAbsGfsPnfcSource(options);
      metadata.warnings = loaded.warnings;
      return loaded.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformAbsGfsPnfcRaw(raw);
      const warnings = [...(metadata.warnings ?? [])];
      if (result.skipped.length > 0)
        warnings.push(`${result.skipped.length} ABS GFS PNFC row(s) rejected`);
      if (result.duplicates > 0) warnings.push(`${result.duplicates} duplicate row(s) skipped`);
      metadata.warnings = warnings;
      return result.records;
    },
    metadata,
  };
}
