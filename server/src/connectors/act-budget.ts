import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import { archiveSourceDocument, type ArchivedSourceRecord } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * ACT Budget — Socrata capital-works / infrastructure investment programme.
 *
 * Dataset: data.act.gov.au Socrata resource `8275-pg6z`,
 * "Budget 2021-2022 Infrastructure Investment Program" — 424 projects with
 * budgeted financing for 2021-22 through 2025-26. It is the current ACT
 * machine-readable budget resource in the Socrata catalogue (the newer ACT
 * budget material is published as documents). Each project row has one
 * `$'000` financing column per financial year plus a printed
 * `Total Budgeted Financing ($'000)` column.
 *
 * The connector uses the Socrata resource API with `$limit` / `$offset` paging
 * (not a CSV download) and fetches the view metadata to detect the unit from
 * the published column names: every year column is explicitly
 * "Budgeted Financing ($'000)". It emits one row per project × fiscal year;
 * the printed project total column is used only for reconciliation and is never
 * emitted. `measure_type` is `budget` (budgeted financing), jurisdiction is
 * `territory` / `ACT`, statewide only.
 */

export const ACT_BUDGET_ID = 'act-budget';
export const ACT_BUDGET_NAME = 'ACT Budget — Infrastructure Investment Program';
export const ACT_BUDGET_PUBLISHER = 'ACT Government';
export const ACT_BUDGET_DATASET = 'Budget 2021-2022 Infrastructure Investment Program';
export const ACT_BUDGET_DATASET_ID = '8275-pg6z';
export const ACT_BUDGET_DOMAIN = 'https://www.data.act.gov.au';
export const ACT_BUDGET_SOURCE_URL = `${ACT_BUDGET_DOMAIN}/d/Budget-2021-2022-Infrastructure-Investment-Program/${ACT_BUDGET_DATASET_ID}`;
export const ACT_BUDGET_RESOURCE_URL = `${ACT_BUDGET_DOMAIN}/resource/${ACT_BUDGET_DATASET_ID}.json`;
export const ACT_BUDGET_METADATA_URL = `${ACT_BUDGET_DOMAIN}/api/views/${ACT_BUDGET_DATASET_ID}.json`;
export const ACT_BUDGET_LICENSE = 'Creative Commons Attribution 3.0 Australia';
export const ACT_BUDGET_ATTRIBUTION =
  'ACT Government — Budget 2021-2022 Infrastructure Investment Program, licensed CC BY 3.0 Australia.';
export const ACT_BUDGET_SOURCE_DATE = '2021-02-09';
export const ACT_BUDGET_UNIT = 'AUD_thousands';
export const ACT_BUDGET_UNIT_LABEL = "$'000";
export const ACT_BUDGET_UNIT_TO_CENTS = 100_000;
export const ACT_BUDGET_JURISDICTION = 'ACT';
export const ACT_BUDGET_MIN_ROWS = 50;
export const ACT_BUDGET_PAGE_SIZE = 1_000;
export const ACT_BUDGET_RECONCILIATION_TOLERANCE = 1;
export const ACT_BUDGET_CAVEAT =
  'ACT Government budgeted capital-works financing, by project and fiscal year. Budget measure type, not actual expenditure; the project-level printed Total Budgeted Financing is used only for reconciliation and is never emitted. Statewide/territory-wide only; no LGA/postcode allocation. No cross-source total and no summing of the total column with its year components.';

export interface ActSocrataColumn {
  name: string;
  fieldName: string;
  dataTypeName: string;
}

export interface ActSocrataMetadata {
  id: string;
  name: string;
  attribution?: string;
  license?: string | null;
  rowsUpdatedAt?: number;
  columns: ActSocrataColumn[];
}

export interface ActBudgetRow {
  ':id'?: string;
  project_name?: string;
  directorate?: string;
  project_classification?: string;
  project_type?: string;
  wellbeing_domain_government?: string;
  [key: string]: unknown;
}

export interface ActBudgetYearColumn {
  field: string;
  fiscal_year: string;
  header: string;
}

export interface ActBudgetReconciliation {
  checked: number;
  mismatched: Array<{ project: string; fiscal_year?: string; components: number; total: number }>;
}

export interface ActBudgetParsed {
  records: SpendingRecord[];
  year_columns: ActBudgetYearColumn[];
  reconciliation: ActBudgetReconciliation;
  unit: string;
  skipped: Array<{ row: number; reason: string }>;
}

export function actBudgetNaturalKey(parts: {
  dataset_id: string;
  project_name: string;
  directorate: string;
  fiscal_year: string;
  row_id?: string;
  project_classification?: string;
  project_type?: string;
  wellbeing_domain?: string;
  region?: string;
}): string {
  const digest = createHash('sha256')
    .update(
      [
        ACT_BUDGET_ID,
        parts.dataset_id,
        parts.project_name,
        parts.directorate,
        parts.fiscal_year,
        parts.row_id ?? '',
        parts.project_classification ?? '',
        parts.project_type ?? '',
        parts.wellbeing_domain ?? '',
        parts.region ?? '',
      ].join('|'),
    )
    .digest('hex');
  return `${ACT_BUDGET_ID}:${digest}`;
}

export function actThousandsToCents(thousands: number): number {
  const cents = Math.round(thousands * ACT_BUDGET_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`ACT budget amount ${thousands} $'000 is outside the safe integer cent range`);
  }
  return cents;
}

/** Detect the unit from the published Socrata column names. */
export function detectActBudgetUnit(metadata: ActSocrataMetadata): string {
  const yearColumns = metadata.columns.filter((column) => /budgeted financing/i.test(column.name));
  if (yearColumns.length === 0) {
    throw new Error('ACT budget metadata has no Budgeted Financing columns');
  }
  const thousands = yearColumns.filter((column) => /\$\s*'?000/.test(column.name)).length;
  if (thousands === yearColumns.length) return ACT_BUDGET_UNIT;
  const dollars = yearColumns.filter((column) => /\$\s*\)?\s*$/.test(column.name)).length;
  if (dollars === yearColumns.length) return 'AUD';
  throw new Error(
    `ACT budget unit is ambiguous: ${yearColumns.map((column) => column.name).join(' | ')}`,
  );
}

export function actBudgetYearColumns(metadata: ActSocrataMetadata): ActBudgetYearColumn[] {
  const columns: ActBudgetYearColumn[] = [];
  for (const column of metadata.columns) {
    if (!/budgeted financing/i.test(column.name)) continue;
    if (/^total$/i.test(column.name.trim())) continue;
    const match = /(\d{4})\s*[-–]\s*(\d{2,4})/.exec(column.name);
    if (!match) continue;
    const start = match[1]!;
    const end = match[2]!.length === 2 ? match[2] : match[2]!.slice(2);
    columns.push({
      field: column.fieldName,
      fiscal_year: `${start}-${end}`,
      header: column.name,
    });
  }
  return columns;
}

export function parseActBudgetRows(
  rows: readonly ActBudgetRow[],
  metadata: ActSocrataMetadata,
): ActBudgetParsed {
  const unit = detectActBudgetUnit(metadata);
  const yearColumns = actBudgetYearColumns(metadata);
  if (yearColumns.length === 0) {
    throw new Error('ACT budget metadata has no fiscal-year financing columns');
  }
  const records: SpendingRecord[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];
  const mismatched: ActBudgetReconciliation['mismatched'] = [];
  let checked = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const projectName = String(row.project_name ?? '').trim();
    const directorate = String(row.directorate ?? '').trim();
    if (!projectName || !directorate) {
      skipped.push({
        row: rowNumber,
        reason: `missing ${!projectName ? 'project_name' : 'directorate'}`,
      });
      return;
    }
    let componentSum = 0;
    let emitted = 0;
    const rowId = typeof row[':id'] === 'string' ? row[':id'] : undefined;
    const classification = String(row.project_classification ?? '').trim() || undefined;
    const projectType = String(row.project_type ?? '').trim() || undefined;
    const wellbeing = String(row.wellbeing_domain_government ?? '').trim() || undefined;
    const region = typeof row.region === 'string' ? row.region.trim() || undefined : undefined;
    for (const year of yearColumns) {
      const raw = row[year.field];
      if (raw === null || raw === undefined || raw === '') continue;
      const value = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(value)) {
        skipped.push({
          row: rowNumber,
          reason: `${year.fiscal_year} is not numeric: ${String(raw)}`,
        });
        continue;
      }
      componentSum += value;
      emitted += 1;
      const sign: 'positive' | 'negative' = value < 0 ? 'negative' : 'positive';
      records.push({
        amount_cents: actThousandsToCents(Math.abs(value)),
        measure_type: 'budget',
        fiscal_year: year.fiscal_year,
        source_id: ACT_BUDGET_ID,
        source_url: ACT_BUDGET_SOURCE_URL,
        verified: false,
        natural_key: actBudgetNaturalKey({
          dataset_id: ACT_BUDGET_DATASET_ID,
          project_name: projectName,
          directorate,
          fiscal_year: year.fiscal_year,
          ...(rowId ? { row_id: rowId } : {}),
          ...(classification ? { project_classification: classification } : {}),
          ...(projectType ? { project_type: projectType } : {}),
          ...(wellbeing ? { wellbeing_domain: wellbeing } : {}),
          ...(region ? { region } : {}),
        }),
        project_name: projectName,
        description: `${projectName} — ${directorate} (${year.fiscal_year})`,
        jurisdiction_level: 'territory',
        jurisdiction: ACT_BUDGET_JURISDICTION,
        delivery_entity: directorate,
        funding_source: 'ACT Government',
        source_dataset: metadata.name,
        source_date: ACT_BUDGET_SOURCE_DATE,
        data_quality_flag: 'provisional',
        aggregation_role: 'additive',
        location: { state: ACT_BUDGET_JURISDICTION },
        statement: 'capital',
        gfs_flow: 'expense',
        notes: `${ACT_BUDGET_CAVEAT} Source: data.act.gov.au Socrata dataset ${ACT_BUDGET_DATASET_ID}, ${metadata.name}; column ${year.header}.`,
        act_dataset_id: ACT_BUDGET_DATASET_ID,
        act_project_classification: classification,
        act_project_type: projectType,
        act_wellbeing_domain: wellbeing,
        act_region: region,
        act_unit: unit,
        ...(sign === 'negative' ? { act_printed_sign: sign } : {}),
      });
    }

    if (emitted === 0) {
      skipped.push({ row: rowNumber, reason: 'project has no financing value' });
      return;
    }
    checked += 1;
    const totalRaw = row.total_budgeted_financing;
    const total = totalRaw === null || totalRaw === undefined ? null : Number(totalRaw);
    if (total === null || !Number.isFinite(total)) {
      skipped.push({ row: rowNumber, reason: 'project has no printed total' });
      return;
    }
    if (Math.abs(componentSum - total) > ACT_BUDGET_RECONCILIATION_TOLERANCE) {
      mismatched.push({
        project: projectName,
        components: componentSum,
        total,
      });
    }
  });

  return {
    records,
    year_columns: yearColumns,
    reconciliation: { checked, mismatched },
    unit,
    skipped,
  };
}

export function assertActBudgetPremise(parsed: ActBudgetParsed): void {
  if (parsed.records.length < ACT_BUDGET_MIN_ROWS) {
    throw new Error(
      `ACT budget produced ${parsed.records.length} rows, expected at least ${ACT_BUDGET_MIN_ROWS}`,
    );
  }
  if (parsed.reconciliation.mismatched.length > 0) {
    throw new Error(
      `ACT budget ${parsed.reconciliation.mismatched.length} project row(s) do not reconcile to the printed total`,
    );
  }
  for (const record of parsed.records) {
    if (record.measure_type !== 'budget') {
      throw new Error(`ACT budget row ${record.natural_key} is not budget`);
    }
    if (record.jurisdiction_level !== 'territory' || record.jurisdiction !== 'ACT') {
      throw new Error(`ACT budget row ${record.natural_key} has the wrong jurisdiction`);
    }
    if (!record.act_unit) {
      throw new Error(`ACT budget row ${record.natural_key} has no unit`);
    }
  }
}

export interface ActBudgetFetchResult {
  rows: ActBudgetRow[];
  pages: number;
}

/**
 * Fetch all rows from the Socrata resource API using `$limit`/`$offset` paging.
 * A short page ends the loop; a page cap prevents an unbounded fetch if the API
 * ignores the offset.
 */
export async function fetchActBudgetRows(
  fetchImpl: typeof fetch = globalThis.fetch,
  options: { pageSize?: number; maxPages?: number; datasetId?: string } = {},
): Promise<ActBudgetFetchResult> {
  const pageSize = options.pageSize ?? ACT_BUDGET_PAGE_SIZE;
  const maxPages = options.maxPages ?? 100;
  const datasetId = options.datasetId ?? ACT_BUDGET_DATASET_ID;
  const rows: ActBudgetRow[] = [];
  let pages = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${ACT_BUDGET_DOMAIN}/resource/${datasetId}.json`);
    url.searchParams.set('$limit', String(pageSize));
    url.searchParams.set('$offset', String(page * pageSize));
    url.searchParams.set('$order', ':id');
    url.searchParams.set('$select', '*,:id');
    const response = await fetchImpl(url.toString(), {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`ACT budget Socrata HTTP ${response.status} for ${url.toString()}`);
    }
    const pageRows = (await response.json()) as ActBudgetRow[];
    if (!Array.isArray(pageRows)) {
      throw new Error('ACT budget Socrata response is not an array');
    }
    rows.push(...pageRows);
    pages += 1;
    if (pageRows.length < pageSize) break;
  }
  if (pages >= maxPages) {
    throw new Error(`ACT budget Socrata paging hit the ${maxPages}-page cap`);
  }
  return { rows, pages };
}

export async function fetchActBudgetMetadata(
  fetchImpl: typeof fetch = globalThis.fetch,
  datasetId: string = ACT_BUDGET_DATASET_ID,
): Promise<ActSocrataMetadata> {
  const response = await fetchImpl(`${ACT_BUDGET_DOMAIN}/api/views/${datasetId}.json`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`ACT budget metadata HTTP ${response.status}`);
  }
  const metadata = (await response.json()) as ActSocrataMetadata;
  if (!metadata || !Array.isArray(metadata.columns)) {
    throw new Error('ACT budget metadata has no columns');
  }
  return metadata;
}

export interface ActBudgetConnectorOptions {
  fetchImpl?: typeof fetch;
  /** Test/CLI override: use these rows and metadata instead of the network. */
  rows?: ActBudgetRow[];
  metadata?: ActSocrataMetadata;
  pageSize?: number;
  archiveRoot?: string;
  now?: () => Date;
}

export interface ActBudgetLoadedSource {
  records: SpendingRecord[];
  rows: ActBudgetRow[];
  metadata: ActSocrataMetadata;
  archive: ArchivedSourceRecord;
  parsed: ActBudgetParsed;
  pages: number;
  warnings: string[];
}

function archiveActSource(
  rows: readonly ActBudgetRow[],
  metadata: ActSocrataMetadata,
  pages: number,
  options: ActBudgetConnectorOptions,
): Promise<ArchivedSourceRecord> {
  return archiveSourceDocument({
    source_id: ACT_BUDGET_ID,
    title: `${metadata.name} — Socrata extract`,
    original_url: ACT_BUDGET_RESOURCE_URL,
    retrieved_from: ACT_BUDGET_RESOURCE_URL,
    archived_from: 'direct',
    filename: `act-budget-${ACT_BUDGET_DATASET_ID}.json`,
    content_type: 'application/json',
    data: JSON.stringify({ dataset_id: ACT_BUDGET_DATASET_ID, metadata, pages, rows }, null, 2),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
    ...(options.now ? { fetched_at: options.now() } : {}),
    notes:
      `data.act.gov.au Socrata dataset ${ACT_BUDGET_DATASET_ID}, fetched through the paged resource API. ` +
      'The JSON extract is archived outside the repo and not redistributed; only derived rows are emitted.',
  });
}

export async function loadActBudgetSource(
  options: ActBudgetConnectorOptions = {},
): Promise<ActBudgetLoadedSource> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = options.metadata ?? (await fetchActBudgetMetadata(fetchImpl));
  if (!options.metadata) {
    detectActBudgetUnit(metadata);
  }
  const fetched = options.rows
    ? { rows: options.rows, pages: 1 }
    : await fetchActBudgetRows(fetchImpl, { pageSize: options.pageSize });
  const parsed = parseActBudgetRows(fetched.rows, metadata);
  assertActBudgetPremise(parsed);
  const archive = await archiveActSource(fetched.rows, metadata, fetched.pages, options);
  const warnings = [
    `dataset=${ACT_BUDGET_DATASET_ID} rows_fetched=${fetched.rows.length} pages=${fetched.pages} emitted=${parsed.records.length}`,
    `unit=${parsed.unit} years=${parsed.year_columns.map((year) => year.fiscal_year).join(',')}`,
    `reconciled_projects=${parsed.reconciliation.checked} mismatches=${parsed.reconciliation.mismatched.length}`,
  ];
  return {
    records: parsed.records,
    rows: fetched.rows,
    metadata,
    archive,
    parsed,
    pages: fetched.pages,
    warnings,
  };
}

export interface ActBudgetManifest {
  dataset: string;
  dataset_id: string;
  source_url: string;
  resource_url: string;
  metadata_url: string;
  source_date: string;
  license: string;
  attribution: string;
  caveat: string;
  unit: string;
  unit_label: string;
  measure_type: string;
  jurisdiction: string;
  jurisdiction_level: string;
  year_columns: ActBudgetYearColumn[];
  pages: number;
  rows_fetched: number;
  rows_emitted: number;
  reconciled_projects: number;
  reconciliation_mismatches: number;
  sha256: string;
  bytes: number;
  notes: string;
}

export function actBudgetManifest(
  loaded: ActBudgetLoadedSource,
  archive: Pick<ArchivedSourceRecord, 'sha256' | 'bytes'>,
): ActBudgetManifest {
  return {
    dataset: loaded.metadata.name,
    dataset_id: ACT_BUDGET_DATASET_ID,
    source_url: ACT_BUDGET_SOURCE_URL,
    resource_url: ACT_BUDGET_RESOURCE_URL,
    metadata_url: ACT_BUDGET_METADATA_URL,
    source_date: ACT_BUDGET_SOURCE_DATE,
    license: ACT_BUDGET_LICENSE,
    attribution: ACT_BUDGET_ATTRIBUTION,
    caveat: ACT_BUDGET_CAVEAT,
    unit: ACT_BUDGET_UNIT,
    unit_label: ACT_BUDGET_UNIT_LABEL,
    measure_type: 'budget',
    jurisdiction: ACT_BUDGET_JURISDICTION,
    jurisdiction_level: 'territory',
    year_columns: loaded.parsed.year_columns,
    pages: loaded.pages,
    rows_fetched: loaded.rows.length,
    rows_emitted: loaded.records.length,
    reconciled_projects: loaded.parsed.reconciliation.checked,
    reconciliation_mismatches: loaded.parsed.reconciliation.mismatched.length,
    sha256: archive.sha256,
    bytes: archive.bytes,
    notes:
      'Derived budget rows only; the JSON Socrata extract is not redistributed. One row per project x fiscal year; the printed Total Budgeted Financing column is used only for reconciliation and is never emitted. No cross-source total.',
  };
}

export function createActBudgetConnector(options: ActBudgetConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'direct' as const,
  };
  return {
    id: ACT_BUDGET_ID,
    name: ACT_BUDGET_NAME,
    publisher: ACT_BUDGET_PUBLISHER,
    source_url: ACT_BUDGET_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'territory',
    license: ACT_BUDGET_LICENSE,
    notes: `${ACT_BUDGET_CAVEAT} ${ACT_BUDGET_ATTRIBUTION}`,
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const loaded = await loadActBudgetSource(options);
      metadata.warnings = loaded.warnings;
      return loaded.records as unknown as RawRecord[];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      return raw.filter(
        (entry) => entry.source_id === ACT_BUDGET_ID,
      ) as unknown as SpendingRecord[];
    },
    metadata,
  };
}
