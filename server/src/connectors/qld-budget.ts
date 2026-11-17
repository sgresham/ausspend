import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import type { SpendingRecord } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * Queensland State Budget 2026-27 connector (Phase 4, QLD only).
 *
 * Two keyless data.qld CKAN CSVs are ingested:
 *   - BP3 Capital Statement (project-level capital, 945 rows, 943 with a
 *     numeric 2026-27 budget).
 *   - BP4 Budget Measures (expense and capital measures, 2026-27 impact).
 *
 * Units are NOT inferred: the BP3 data dictionary states every amount column is
 * "Amount in $'000" and the BP4 dictionary names each year column
 * "2026-27 ($'000)". 1 $'000 = 100,000 cents. The dictionaries and BP4
 * explanatory notes are archived alongside the CSVs as unit proof.
 *
 * Scope decisions (documented, not guessed):
 *   - BP4 revenue measures are excluded: they are revenue policy impacts, not
 *     spending. Only "Expense measures…" and "Capital measures…" sections are
 *     ingested.
 *   - Rows whose 2026-27 amount is blank, non-numeric, zero or negative are
 *     skipped: a zero/negative current-year impact is not a spending amount and
 *     the model stores non-negative cents. Counts are logged.
 *   - No COFOG function is defensible from BP3/BP4; function_code is left blank
 *     and rows are provisional.
 *   - BP3 SA4 text is stored verbatim in location.sa4_name. Raw latitude/
 *     longitude text (which may be multi-valued) is preserved in notes only;
 *     no coordinate is parsed, averaged or invented.
 *   - BP3 capital projects and BP4 budget measures are separate published
 *     series, not a complete QLD expense total; do not present a sum as one.
 */

export const QLD_ID = 'qld-budget';
export const QLD_NAME = 'Queensland State Budget 2026-27 (BP3/BP4)';
export const QLD_PUBLISHER = 'Queensland Treasury';
export const QLD_DATASET = 'QLD Budget 2026-27 BP3/BP4';
export const QLD_FISCAL_YEAR = '2026-27';
export const QLD_CKAN_API_BASE = 'https://www.data.qld.gov.au/api/3/action';
export const QLD_SOURCE_URL =
  'https://www.data.qld.gov.au/dataset/2026-27-state-budget-budget-paper-3-capital-statement';
export const QLD_LICENSE = 'CC BY 4.0';
export const QLD_ATTRIBUTION = '© State of Queensland (Queensland Treasury), 2026';
export const QLD_UNIT = "$'000";
export const QLD_UNIT_TO_CENTS = 100_000;

export const QLD_BP3_DATASET_ID = 'fb0df743-a719-476e-a3ae-4d4e3a0d9124';
export const QLD_BP4_DATASET_ID = 'e37910f7-0ae5-4a20-9e59-dcaa30517080';
export const QLD_BP3_RESOURCE_ID = 'aa894f86-6f57-4e81-8f95-8c1541bcd819';
export const QLD_BP3_DICTIONARY_ID = 'bb5d4369-f12b-4f1a-80f0-60325565a710';
export const QLD_BP4_RESOURCE_ID = '1eb033d0-a344-4c24-821a-96fc0a0d57fa';
export const QLD_BP4_DICTIONARY_ID = 'da5e8180-1ab7-407d-a01e-f38d35f2db99';
export const QLD_BP4_NOTES_ID = '28333519-6495-4055-9662-c23889518030';

export const QLD_BP3_URL =
  'https://www.data.qld.gov.au/dataset/fb0df743-a719-476e-a3ae-4d4e3a0d9124/resource/aa894f86-6f57-4e81-8f95-8c1541bcd819/download/capital-statement-bp3-2026-27-budget.csv';
export const QLD_BP3_DICTIONARY_URL =
  'https://www.data.qld.gov.au/dataset/fb0df743-a719-476e-a3ae-4d4e3a0d9124/resource/bb5d4369-f12b-4f1a-80f0-60325565a710/download/data-dictionary-and-explanatory-notes-capital-statement-budget-paper-3-2026-27.csv';
export const QLD_BP4_URL =
  'https://www.data.qld.gov.au/dataset/e37910f7-0ae5-4a20-9e59-dcaa30517080/resource/1eb033d0-a344-4c24-821a-96fc0a0d57fa/download/bp4-open-data-budget-2026-27.csv';
export const QLD_BP4_DICTIONARY_URL =
  'https://www.data.qld.gov.au/dataset/e37910f7-0ae5-4a20-9e59-dcaa30517080/resource/da5e8180-1ab7-407d-a01e-f38d35f2db99/download/data-dictionary-budget-measures-budget-paper-4-2026-27.csv';
export const QLD_BP4_NOTES_URL =
  'https://www.data.qld.gov.au/dataset/e37910f7-0ae5-4a20-9e59-dcaa30517080/resource/28333519-6495-4055-9662-c23889518030/download/explanatory-notes-budget-measures-budget-paper-4-2026-27.csv';

export interface QldResource {
  dataset_id: string;
  package_name: string;
  dataset_title: string;
  metadata_modified: string;
  resource_id: string;
  name: string;
  format: string;
  url: string;
  filename: string;
}

export interface QldSourceSelection {
  bp3: QldResource;
  bp3Dictionary: QldResource;
  bp4: QldResource;
  bp4Dictionary: QldResource;
  bp4Notes: QldResource;
}

export interface QldSourceMeta {
  resource_id: string;
  resource_name: string;
  filename: string;
  url: string;
  source_sha256: string;
  source_date: string;
}

export interface QldBp3Raw extends Record<string, unknown> {
  kind: 'bp3';
  resource_id: string;
  resource_name: string;
  filename: string;
  url: string;
  source_sha256: string;
  source_date: string;
  row: number;
  portfolio: string;
  agency: string;
  asset_type: string;
  header_1: string | null;
  header_2: string | null;
  header_3: string | null;
  project_name: string;
  sa4_name: string | null;
  latitude_raw: string | null;
  longitude_raw: string | null;
  budget_000: number;
  unit: typeof QLD_UNIT;
}

export interface QldBp4Raw extends Record<string, unknown> {
  kind: 'bp4';
  resource_id: string;
  resource_name: string;
  filename: string;
  url: string;
  source_sha256: string;
  source_date: string;
  row: number;
  id: string;
  report_title: string;
  section: string;
  department: string;
  measure: string;
  budget_000: number;
  unit: typeof QLD_UNIT;
}

export type QldRaw = QldBp3Raw | QldBp4Raw;

export interface QldSkip {
  filename: string;
  row: number | null;
  reason: string;
}

export interface QldTransformResult {
  records: SpendingRecord[];
  skipped: QldSkip[];
  duplicates: number;
}

export interface QldConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  /** Injected for unit tests; defaults to the csv-parse reader. */
  readCsv?: (filePath: string) => Promise<string>;
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

/** Parse "$'000" cells: quoted thousands separators, spaces, blanks and N/A. */
export function qldNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').replace(/\s+/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Convert a confirmed $'000 amount to integer cents. */
export function qldAmountToCents(value: unknown): number | null {
  const numeric = qldNumber(value);
  if (numeric === null) return null;
  const cents = Math.round(numeric * QLD_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return cents;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function qldNaturalKey(parts: readonly (string | number | null | undefined)[]): string {
  return `qld-budget:${sha256(parts.map((part) => String(part ?? '')).join('\u001f')).slice(0, 40)}`;
}

export function parseQldCsvRows(csv: string): Array<Record<string, string>> {
  const rows = parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>;
  return rows;
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
}

interface CkanPackage {
  id: string;
  name: string;
  title: string;
  metadata_modified?: string;
  resources: CkanResource[];
}

async function ckanPackageShow(datasetId: string, fetchImpl: typeof fetch): Promise<CkanPackage> {
  const response = await fetchImpl(
    `${QLD_CKAN_API_BASE}/package_show?id=${encodeURIComponent(datasetId)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error(`data.qld package_show HTTP ${response.status}`);
  const body = (await response.json()) as { success?: boolean; result?: CkanPackage };
  if (!body.success || !body.result)
    throw new Error(`data.qld package_show failed for ${datasetId}`);
  return body.result;
}

function toResource(pkg: CkanPackage, resource: CkanResource, datasetId: string): QldResource {
  return {
    dataset_id: datasetId,
    package_name: pkg.name,
    dataset_title: pkg.title,
    metadata_modified: (pkg.metadata_modified ?? '').slice(0, 10),
    resource_id: resource.id,
    name: resource.name,
    format: resource.format,
    url: resource.url,
    filename: resourceFilename(resource.url),
  };
}

function findResource(pkg: CkanPackage, id: string, namePattern: RegExp): CkanResource {
  const byId = pkg.resources.find((resource) => resource.id === id);
  if (byId) return byId;
  const byName = pkg.resources.find((resource) => namePattern.test(resource.name));
  if (byName) return byName;
  throw new Error(`data.qld package ${pkg.name} is missing resource ${id}`);
}

/** Discover BP3/BP4 CSVs and their dictionaries/notes via package_show. */
export async function discoverQldSources(
  fetchImpl: typeof fetch = fetch,
): Promise<QldSourceSelection> {
  const bp3Pkg = await ckanPackageShow(QLD_BP3_DATASET_ID, fetchImpl);
  const bp4Pkg = await ckanPackageShow(QLD_BP4_DATASET_ID, fetchImpl);
  return {
    bp3: toResource(
      bp3Pkg,
      findResource(bp3Pkg, QLD_BP3_RESOURCE_ID, /capital statement.*budget paper 3/i),
      QLD_BP3_DATASET_ID,
    ),
    bp3Dictionary: toResource(
      bp3Pkg,
      findResource(bp3Pkg, QLD_BP3_DICTIONARY_ID, /data dictionary.*capital statement/i),
      QLD_BP3_DATASET_ID,
    ),
    bp4: toResource(
      bp4Pkg,
      findResource(bp4Pkg, QLD_BP4_RESOURCE_ID, /budget measures.*budget paper 4/i),
      QLD_BP4_DATASET_ID,
    ),
    bp4Dictionary: toResource(
      bp4Pkg,
      findResource(bp4Pkg, QLD_BP4_DICTIONARY_ID, /data dictionary.*budget measures/i),
      QLD_BP4_DATASET_ID,
    ),
    bp4Notes: toResource(
      bp4Pkg,
      findResource(bp4Pkg, QLD_BP4_NOTES_ID, /explanatory notes.*budget measures/i),
      QLD_BP4_DATASET_ID,
    ),
  };
}

export function parseBp3Rows(
  csv: string,
  meta: QldSourceMeta,
  skipped: QldSkip[] = [],
): QldBp3Raw[] {
  const output: QldBp3Raw[] = [];
  const rows = parseQldCsvRows(csv);
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const projectName = cleanColumn(row, 'Project Name');
    if (!projectName) {
      skipped.push({
        filename: meta.filename,
        row: rowNumber,
        reason: 'missing Project Name',
      });
      return;
    }
    const amount = qldNumber(column(row, 'Budget 2026-27'));
    if (amount === null) {
      skipped.push({
        filename: meta.filename,
        row: rowNumber,
        reason: `${projectName}: blank/non-numeric Budget 2026-27`,
      });
      return;
    }
    if (amount <= 0) {
      skipped.push({
        filename: meta.filename,
        row: rowNumber,
        reason: `${projectName}: zero/negative Budget 2026-27 skipped (no current-year spend)`,
      });
      return;
    }
    const portfolio = cleanColumn(row, 'Portfolio');
    const agency = cleanColumn(row, 'Agency');
    const assetType = cleanColumn(row, 'Asset Type');
    if (!portfolio || !agency || !assetType) {
      skipped.push({
        filename: meta.filename,
        row: rowNumber,
        reason: `${projectName}: missing Portfolio/Agency/Asset Type`,
      });
      return;
    }
    output.push({
      kind: 'bp3',
      ...meta,
      row: rowNumber,
      portfolio,
      agency,
      asset_type: assetType,
      header_1: cleanColumn(row, 'Header 1'),
      header_2: cleanColumn(row, 'Header 2'),
      header_3: cleanColumn(row, 'Header 3'),
      project_name: projectName,
      sa4_name: cleanColumn(row, 'SA4 Name'),
      latitude_raw: cleanColumn(row, 'Latitude'),
      longitude_raw: cleanColumn(row, 'Longitude'),
      budget_000: amount,
      unit: QLD_UNIT,
    });
  });
  return output;
}

export function isRevenueSection(section: string): boolean {
  return /^revenue measures/i.test(section.trim());
}

export function parseBp4Rows(
  csv: string,
  meta: QldSourceMeta,
  skipped: QldSkip[] = [],
): QldBp4Raw[] {
  const output: QldBp4Raw[] = [];
  const rows = parseQldCsvRows(csv);
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const section = cleanColumn(row, 'Section');
    if (!section) {
      skipped.push({ filename: meta.filename, row: rowNumber, reason: 'missing Section' });
      return;
    }
    if (isRevenueSection(section)) {
      skipped.push({
        filename: meta.filename,
        row: rowNumber,
        reason: `${section}: revenue measure excluded (not spending)`,
      });
      return;
    }
    const measure = cleanColumn(row, 'Measure');
    const department = cleanColumn(row, 'Department');
    if (!measure || !department) {
      skipped.push({
        filename: meta.filename,
        row: rowNumber,
        reason: 'missing Measure/Department',
      });
      return;
    }
    const amount = qldNumber(column(row, "2026-27 ($'000)"));
    if (amount === null) {
      skipped.push({
        filename: meta.filename,
        row: rowNumber,
        reason: `${measure}: blank/non-numeric 2026-27 ($'000)`,
      });
      return;
    }
    if (amount <= 0) {
      skipped.push({
        filename: meta.filename,
        row: rowNumber,
        reason: `${measure}: zero/negative 2026-27 impact skipped (no current-year spend)`,
      });
      return;
    }
    output.push({
      kind: 'bp4',
      ...meta,
      row: rowNumber,
      id: cleanColumn(row, 'ID') ?? String(rowNumber),
      report_title: cleanColumn(row, 'Report Title') ?? section,
      section,
      department,
      measure,
      budget_000: amount,
      unit: QLD_UNIT,
    });
  });
  return output;
}

function bp3Record(raw: QldBp3Raw): SpendingRecord | null {
  const amountCents = qldAmountToCents(raw.budget_000);
  if (amountCents === null) return null;
  const key = qldNaturalKey([
    raw.resource_id,
    raw.row,
    raw.portfolio,
    raw.agency,
    raw.project_name,
    raw.asset_type,
    raw.sa4_name,
  ]);
  const headings = [raw.header_1, raw.header_2, raw.header_3].filter(Boolean).join(' / ');
  const notes = [
    `Workbook: ${raw.filename}`,
    `CKAN resource: ${raw.resource_name} (${raw.resource_id})`,
    `CSV row: ${raw.row}`,
    `Unit: ${QLD_UNIT} confirmed by the BP3 data dictionary ("Amount in $'000"); converted at ${QLD_UNIT_TO_CENTS} cents per $'000`,
    `Project: ${raw.project_name}; asset type: ${raw.asset_type}`,
    headings ? `Published grouping: ${headings}` : '',
    raw.sa4_name
      ? `SA4 raw text: ${raw.sa4_name} (comma-separated means multiple SA4s; not an LGA)`
      : '',
    raw.latitude_raw || raw.longitude_raw
      ? `Raw coordinates from source (may be multi-valued; not parsed or averaged): latitude ${raw.latitude_raw ?? '(none)'}; longitude ${raw.longitude_raw ?? '(none)'}`
      : 'No coordinates supplied',
    'No COFOG function is defensible from BP3; function left blank and row flagged provisional',
    'Project-level capital series, not a complete QLD expense total',
    'Budgeted figure, not an audited actual; unverified',
    `Source copy SHA-256: ${raw.source_sha256}`,
  ]
    .filter(Boolean)
    .join('; ');
  return {
    amount_cents: amountCents,
    measure_type: 'budget',
    fiscal_year: QLD_FISCAL_YEAR,
    source_id: QLD_ID,
    source_url: raw.url,
    verified: false,
    natural_key: key,
    jurisdiction_level: 'state',
    jurisdiction: 'QLD',
    source_dataset: QLD_DATASET,
    source_date: raw.source_date,
    data_quality_flag:
      raw.latitude_raw || raw.longitude_raw ? 'provisional; approximate_location' : 'provisional',
    aggregation_role: 'additive',
    project_name: raw.project_name,
    description: [raw.asset_type, headings].filter(Boolean).join(' — ') || raw.asset_type,
    delivery_entity: raw.agency,
    funding_source: raw.portfolio,
    location: { state: 'QLD', ...(raw.sa4_name ? { sa4_name: raw.sa4_name } : {}) },
    notes,
  };
}

function bp4Record(raw: QldBp4Raw): SpendingRecord | null {
  const amountCents = qldAmountToCents(raw.budget_000);
  if (amountCents === null) return null;
  const key = qldNaturalKey([raw.resource_id, raw.id, raw.department, raw.measure, raw.section]);
  const notes = [
    `Workbook: ${raw.filename}`,
    `CKAN resource: ${raw.resource_name} (${raw.resource_id})`,
    `CSV row: ${raw.row}; source ID: ${raw.id}`,
    `Unit: ${QLD_UNIT} confirmed by the BP4 data dictionary ("2026-27 ($'000)"); converted at ${QLD_UNIT_TO_CENTS} cents per $'000`,
    `Report: ${raw.report_title}; section: ${raw.section}`,
    'NON-ADDITIVE policy measure: BP4 policy decisions overlap the BP3 capital program (some project names appear in both); excluded from every additive total',
    'BP4 budget measure (expense/capital); revenue measures are excluded at parse time',
    'No COFOG function is defensible from BP4; function left blank and row flagged provisional',
    'Budget measure series, not a complete QLD expense total',
    'Budgeted impact, not an audited actual; unverified',
    `Source copy SHA-256: ${raw.source_sha256}`,
  ].join('; ');
  return {
    amount_cents: amountCents,
    measure_type: 'budget',
    fiscal_year: QLD_FISCAL_YEAR,
    source_id: QLD_ID,
    source_url: raw.url,
    verified: false,
    natural_key: key,
    jurisdiction_level: 'state',
    jurisdiction: 'QLD',
    source_dataset: QLD_DATASET,
    source_date: raw.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'policy_measure',
    project_name: raw.measure,
    description: `${raw.report_title} — ${raw.section}`,
    delivery_entity: raw.department,
    funding_source: raw.department,
    location: { state: 'QLD' },
    notes,
  };
}

export function transformQldRaw(raw: readonly RawRecord[]): QldTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: QldSkip[] = [];
  const keys = new Set<string>();
  let duplicates = 0;
  for (const entry of raw) {
    if (entry.kind !== 'bp3' && entry.kind !== 'bp4') {
      skipped.push({
        filename: 'unknown',
        row: null,
        reason: `unknown raw kind ${String(entry.kind)}`,
      });
      continue;
    }
    const record =
      entry.kind === 'bp3' ? bp3Record(entry as QldBp3Raw) : bp4Record(entry as QldBp4Raw);
    if (!record) {
      skipped.push({
        filename: String(entry.filename ?? 'unknown'),
        row: typeof entry.row === 'number' ? entry.row : null,
        reason: `${String(entry.project_name ?? entry.measure ?? '')}: unusable amount`,
      });
      continue;
    }
    if (keys.has(record.natural_key!)) {
      duplicates += 1;
      continue;
    }
    keys.add(record.natural_key!);
    records.push(record);
  }
  return { records, skipped, duplicates };
}

export interface QldLoadedSources {
  raw: QldRaw[];
  archive: ArchivedSourceRecord[];
  skipped: QldSkip[];
  warnings: string[];
  selection: QldSourceSelection;
}

/**
 * Discover, archive and parse the BP3/BP4 CSVs plus their dictionaries and
 * notes. All five exact files are written outside the repo by the shared
 * source-archive helper; the repo only holds metadata.
 */
export async function loadQldSources(
  options: {
    fetchImpl?: typeof fetch;
    archiveRoot?: string;
    readCsv?: (filePath: string) => Promise<string>;
  } = {},
): Promise<QldLoadedSources> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const readCsv = options.readCsv ?? ((filePath: string) => readFile(filePath, 'utf8'));
  const selection = await discoverQldSources(fetchImpl);
  const archive: ArchivedSourceRecord[] = [];
  const skipped: QldSkip[] = [];
  const warnings: string[] = [];

  async function archiveResource(
    resource: QldResource,
    title: string,
  ): Promise<ArchivedSourceRecord> {
    const record = await archiveSourceDocument({
      source_id: QLD_ID,
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

  const bp3RecordFile = await archiveResource(
    selection.bp3,
    `QLD Budget 2026-27 — ${selection.bp3.name}`,
  );
  const bp3DictionaryRecord = await archiveResource(
    selection.bp3Dictionary,
    `QLD Budget 2026-27 — ${selection.bp3Dictionary.name}`,
  );
  const bp4RecordFile = await archiveResource(
    selection.bp4,
    `QLD Budget 2026-27 — ${selection.bp4.name}`,
  );
  const bp4DictionaryRecord = await archiveResource(
    selection.bp4Dictionary,
    `QLD Budget 2026-27 — ${selection.bp4Dictionary.name}`,
  );
  const bp4NotesRecord = await archiveResource(
    selection.bp4Notes,
    `QLD Budget 2026-27 — ${selection.bp4Notes.name}`,
  );

  const bp3Meta: QldSourceMeta = {
    resource_id: selection.bp3.resource_id,
    resource_name: selection.bp3.name,
    filename: selection.bp3.filename,
    url: selection.bp3.url,
    source_sha256: bp3RecordFile.sha256,
    source_date: selection.bp3.metadata_modified,
  };
  const bp4Meta: QldSourceMeta = {
    resource_id: selection.bp4.resource_id,
    resource_name: selection.bp4.name,
    filename: selection.bp4.filename,
    url: selection.bp4.url,
    source_sha256: bp4RecordFile.sha256,
    source_date: selection.bp4.metadata_modified,
  };

  const raw: QldRaw[] = [
    ...parseBp3Rows(await readCsv(bp3RecordFile.local_path), bp3Meta, skipped),
    ...parseBp4Rows(await readCsv(bp4RecordFile.local_path), bp4Meta, skipped),
  ];

  const bp3Rows = raw.filter((entry) => entry.kind === 'bp3').length;
  const bp4Rows = raw.filter((entry) => entry.kind === 'bp4').length;
  if (bp3Rows === 0) throw new Error('QLD BP3 CSV produced no budget rows');
  if (bp4Rows === 0) throw new Error('QLD BP4 CSV produced no expense/capital budget rows');
  warnings.push(
    `BP3 rows=${bp3Rows}; BP4 expense/capital rows=${bp4Rows}; units $'000 confirmed by the archived dictionaries`,
  );
  if (skipped.length > 0) {
    warnings.push(
      `${skipped.length} source row(s) skipped (${skipped
        .slice(0, 5)
        .map((entry) => `${entry.filename}:${entry.row ?? '?'} ${entry.reason}`)
        .join('; ')}${skipped.length > 5 ? '; …' : ''})`,
    );
  }
  // Keep the dictionary/notes records in the archive list for the manifest even
  // though they are never transformed into measures.
  void bp3DictionaryRecord;
  void bp4DictionaryRecord;
  void bp4NotesRecord;
  return { raw, archive, skipped, warnings, selection };
}

/** Build the connector. `fetch` discovers, archives and parses BP3/BP4. */
export function createQldBudgetConnector(options: QldConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: QLD_ID,
    name: QLD_NAME,
    publisher: QLD_PUBLISHER,
    source_url: QLD_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'state',
    license: QLD_LICENSE,
    notes: `${QLD_ATTRIBUTION} 2026-27 BP3 Capital Statement and BP4 Budget Measures CSV from data.qld CKAN, plus archived dictionaries/explanatory notes. Units are '$'000 per the dictionaries. BP3 capital rows are additive; BP4 policy measures are non-additive (aggregation_role=policy_measure) and excluded from every total. BP4 revenue measures and blank/zero/negative 2026-27 amounts are excluded. No COFOG function; provisional.`,
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const loaded = await loadQldSources(options);
      metadata.warnings = loaded.warnings;
      return loaded.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformQldRaw(raw);
      metadata.errors = [];
      const warnings = [...(metadata.warnings ?? [])];
      if (result.skipped.length > 0)
        warnings.push(`${result.skipped.length} transformed row(s) skipped`);
      metadata.warnings = warnings;
      return result.records;
    },
    metadata,
  };
}

export function qldManifestFromRecords(records: readonly ArchivedSourceRecord[]) {
  return records.map((record) => ({
    title: record.title,
    filename: path.basename(record.local_path),
    url: record.original_url,
    sha256: record.sha256,
    bytes: record.bytes,
    archived_from: record.archived_from,
  }));
}
