import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import type { Connector, RawRecord } from './types.js';

/**
 * WA MyCouncil — local-government actual expenditure and financial snapshot.
 *
 * The public MyCouncil OData service exposes council-level actual expenditure by
 * program/year (`vw_LG_Expenditure`) and a controlled financial snapshot
 * (`vw_LG_FinanceActuals`). The service has no printed unit metadata, but every
 * dollar field is a whole-dollar amount: the MyCouncil view formats the same
 * values with a `$` prefix (for example Swan FY2024/25 Total Expenditure
 * $284,214,363), and the OData values are int32/decimal whole dollars. This
 * connector therefore converts whole AUD to cents at ×100 and never treats a
 * count or ratio as money.
 *
 * Budget (`vw_LG_FinanceBudget`) and state grant (`vw_LG_GrantData`) entity sets
 * are deliberately not queried: WA Budget is a separate source and state grants
 * are not council actuals. No row is summed across councils, programs or years.
 */

export const WA_MYCOUNCIL_ID = 'wa-mycouncil';
export const WA_MYCOUNCIL_NAME = 'WA MyCouncil — local government actuals';
export const WA_MYCOUNCIL_PUBLISHER = 'Government of Western Australia — MyCouncil';
export const WA_MYCOUNCIL_SOURCE_URL = 'https://mycouncil.wa.gov.au/';
export const WA_MYCOUNCIL_SERVICE_ROOT =
  'https://prod-mycouncil-services.azurewebsites.net/data.svc/';
export const WA_MYCOUNCIL_METADATA_URL = `${WA_MYCOUNCIL_SERVICE_ROOT}$metadata`;
export const WA_MYCOUNCIL_EXPENDITURE_SET = 'vw_LG_Expenditure';
export const WA_MYCOUNCIL_FINANCE_SET = 'vw_LG_FinanceActuals';
export const WA_MYCOUNCIL_EXPENDITURE_DATASET = 'WA MyCouncil — Local Government Expenditure';
export const WA_MYCOUNCIL_FINANCE_DATASET = 'WA MyCouncil — Local Government Finance Actuals';
export const WA_MYCOUNCIL_UNIT = 'AUD';
export const WA_MYCOUNCIL_UNIT_LABEL = '$';
export const WA_MYCOUNCIL_UNIT_TO_CENTS = 100;
export const WA_MYCOUNCIL_LICENSE =
  '© Government of Western Australia — MyCouncil. Public financial snapshot; not an open-data licence grant for third-party reuse.';
export const WA_MYCOUNCIL_CAVEAT =
  'WA MyCouncil controlled public financial snapshot, not audited general-purpose financial statements. Council-level actuals only; never add rows across councils, programs or years, never combine with WA state budget or state-to-local grants, and never treat a ratio or count as dollars.';
export const WA_MYCOUNCIL_BUDGET_CAVEAT =
  'The MyCouncil budget entity set is not ingested here; WA Budget remains the separate wa-budget source.';

export type WaMyCouncilFinanceMeasure = 'total_revenue' | 'employee_cost';

export interface WaMyCouncilFinanceMeasureSpec {
  measure: WaMyCouncilFinanceMeasure;
  column: string;
  label: string;
}

/** Only monetary revenue/employee fields are snapshot spending; ratios are not. */
export const WA_MYCOUNCIL_FINANCE_MEASURES: readonly WaMyCouncilFinanceMeasureSpec[] = [
  { measure: 'total_revenue', column: 'TotalRevenue', label: 'Total revenue' },
  { measure: 'employee_cost', column: 'EmployeeCost', label: 'Employee cost' },
];

export interface WaODataMetadata {
  entitySets: string[];
  entityTypes: Record<string, string[]>;
}

/** Extract the entity sets and properties from the OData `$metadata` XML. */
export function parseWaODataMetadata(xml: string): WaODataMetadata {
  const entitySets = [...xml.matchAll(/<EntitySet\s+Name="([^"]+)"/g)].map((match) => match[1]!);
  const entityTypes: Record<string, string[]> = {};
  for (const match of xml.matchAll(/<EntityType\s+Name="([^"]+)"[^>]*>([\s\S]*?)<\/EntityType>/g)) {
    const name = match[1]!;
    const properties = [...match[2]!.matchAll(/<Property\s+Name="([^"]+)"/g)].map(
      (property) => property[1]!,
    );
    entityTypes[name] = properties;
  }
  return { entitySets, entityTypes };
}

export function validateWaODataMetadata(metadata: WaODataMetadata): void {
  for (const setName of [WA_MYCOUNCIL_EXPENDITURE_SET, WA_MYCOUNCIL_FINANCE_SET]) {
    if (!metadata.entitySets.includes(setName)) {
      throw new Error(`WA MyCouncil metadata has no ${setName} entity set`);
    }
  }
  const requiredProperties: Record<string, readonly string[]> = {
    [WA_MYCOUNCIL_EXPENDITURE_SET]: ['LGId', 'LGName', 'FinancialYear', 'Program', 'Expenditure'],
    [WA_MYCOUNCIL_FINANCE_SET]: ['LGId', 'LGName', 'FinancialYear', 'TotalRevenue', 'EmployeeCost'],
  };
  for (const [setName, properties] of Object.entries(requiredProperties)) {
    const actual = metadata.entityTypes[setName] ?? [];
    for (const property of properties) {
      if (!actual.includes(property)) {
        throw new Error(`WA MyCouncil ${setName} metadata has no ${property} property`);
      }
    }
  }
}

function odataUrl(
  setName: string,
  skip: number,
  top: number,
  options: Record<string, string>,
): string {
  const params = new URLSearchParams({
    ...options,
    $top: String(top),
    $skip: String(skip),
    $format: 'json',
  });
  return `${WA_MYCOUNCIL_SERVICE_ROOT}${setName}?${params.toString()}`;
}

export function waMyCouncilExpenditureUrl(skip: number, top: number): string {
  return odataUrl(WA_MYCOUNCIL_EXPENDITURE_SET, skip, top, {
    $select: 'LGId,LGName,DateId,FinancialYear,Program,Expenditure,LGType',
    $orderby: 'FinancialYear,LGId,Program',
  });
}

export function waMyCouncilFinanceActualsUrl(skip: number, top: number): string {
  return odataUrl(WA_MYCOUNCIL_FINANCE_SET, skip, top, {
    $select: 'LGId,LGName,FinancialYear,TotalRevenue,EmployeeCost',
    $orderby: 'FinancialYear,LGId',
  });
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/,/g, '');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function financialYearFromMyCouncil(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4})\/(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return null;
  return `${start}-${String(end).slice(-2)}`;
}

export function programSlug(program: string): string {
  return program
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function waMyCouncilNaturalKey(parts: {
  kind: 'expenditure' | 'finance_actuals';
  lgId: number;
  fiscalYear: string;
  line: string;
}): string {
  const digest = createHash('sha256')
    .update(
      [WA_MYCOUNCIL_ID, parts.kind, String(parts.lgId), parts.fiscalYear, parts.line].join('|'),
    )
    .digest('hex')
    .slice(0, 40);
  return `${WA_MYCOUNCIL_ID}:${digest}`;
}

export function waMyCouncilDollarsToCents(value: number): number {
  const cents = Math.round(Math.abs(value) * WA_MYCOUNCIL_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`WA MyCouncil amount ${value} is outside the safe cent range`);
  }
  return cents;
}

export interface WaMyCouncilParseResult {
  records: SpendingRecord[];
  councils: Set<string>;
  years: Set<string>;
}

function baseRecord(
  row: {
    LGName: string;
    fiscalYear: string;
  },
  sourceDate: string,
): Pick<
  SpendingRecord,
  | 'jurisdiction_level'
  | 'jurisdiction'
  | 'delivery_entity'
  | 'measure_type'
  | 'verified'
  | 'data_quality_flag'
  | 'aggregation_role'
  | 'location'
  | 'source_date'
> {
  return {
    jurisdiction_level: 'local',
    jurisdiction: 'WA',
    delivery_entity: row.LGName,
    measure_type: 'actual',
    verified: false,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    location: { state: 'WA', lga_name: row.LGName },
    source_date: sourceDate,
  };
}

export function parseWaMyCouncilExpenditurePage(
  page: unknown[],
  options: { sourceDate: string; sourceUrl: string },
): WaMyCouncilParseResult {
  const records: SpendingRecord[] = [];
  const councils = new Set<string>();
  const years = new Set<string>();
  for (const raw of page) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const lgId = numeric(row.LGId);
    const lgName = typeof row.LGName === 'string' ? row.LGName.trim() : '';
    const fiscalYear = financialYearFromMyCouncil(row.FinancialYear);
    const program = typeof row.Program === 'string' ? row.Program.trim() : '';
    const expenditure = numeric(row.Expenditure);
    if (lgId === null || !lgName || !fiscalYear || !program || expenditure === null) continue;
    if (expenditure < 0) continue;
    const line = programSlug(program);
    councils.add(lgName);
    years.add(fiscalYear);
    records.push({
      ...baseRecord({ LGName: lgName, fiscalYear }, options.sourceDate),
      amount_cents: waMyCouncilDollarsToCents(expenditure),
      fiscal_year: fiscalYear,
      source_id: WA_MYCOUNCIL_ID,
      source_url: options.sourceUrl,
      natural_key: waMyCouncilNaturalKey({ kind: 'expenditure', lgId, fiscalYear, line }),
      project_name: lgName,
      description: `Program expenditure — ${program}`,
      funding_source: 'Western Australian local government',
      source_dataset: WA_MYCOUNCIL_EXPENDITURE_DATASET,
      category: line,
      notes: `${WA_MYCOUNCIL_CAVEAT} OData entity: ${WA_MYCOUNCIL_EXPENDITURE_SET}; LGId: ${lgId}; DateId: ${String(row.DateId ?? '')}; Program: ${program}; unit: ${WA_MYCOUNCIL_UNIT_LABEL} (whole AUD); query: ${options.sourceUrl}.`,
    });
  }
  return { records, councils, years };
}

export function parseWaMyCouncilFinanceActualsPage(
  page: unknown[],
  options: { sourceDate: string; sourceUrl: string },
): WaMyCouncilParseResult {
  const records: SpendingRecord[] = [];
  const councils = new Set<string>();
  const years = new Set<string>();
  for (const raw of page) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const lgId = numeric(row.LGId);
    const lgName = typeof row.LGName === 'string' ? row.LGName.trim() : '';
    const fiscalYear = financialYearFromMyCouncil(row.FinancialYear);
    if (lgId === null || !lgName || !fiscalYear) continue;
    councils.add(lgName);
    years.add(fiscalYear);
    for (const spec of WA_MYCOUNCIL_FINANCE_MEASURES) {
      const value = numeric(row[spec.column]);
      // MyCouncil uses 0.00 for many unavailable snapshot fields; do not turn an
      // unavailable value into a published zero-dollar actual.
      if (value === null || value <= 0) continue;
      records.push({
        ...baseRecord({ LGName: lgName, fiscalYear }, options.sourceDate),
        amount_cents: waMyCouncilDollarsToCents(value),
        fiscal_year: fiscalYear,
        source_id: WA_MYCOUNCIL_ID,
        source_url: options.sourceUrl,
        natural_key: waMyCouncilNaturalKey({
          kind: 'finance_actuals',
          lgId,
          fiscalYear,
          line: spec.measure,
        }),
        project_name: lgName,
        description: spec.label,
        funding_source: 'Western Australian local government',
        source_dataset: WA_MYCOUNCIL_FINANCE_DATASET,
        category: spec.measure,
        notes: `${WA_MYCOUNCIL_CAVEAT} OData entity: ${WA_MYCOUNCIL_FINANCE_SET}; LGId: ${lgId}; column: ${spec.column}; unit: ${WA_MYCOUNCIL_UNIT_LABEL} (whole AUD); zero/unavailable snapshot values are not emitted; query: ${options.sourceUrl}.`,
      });
    }
  }
  return { records, councils, years };
}

export interface WaMyCouncilFetchOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** OData page size; default 1000, capped at 1000. */
  pageSize?: number;
}

function dedupeWaMyCouncilRecords(records: readonly SpendingRecord[]): SpendingRecord[] {
  const byNaturalKey = new Map<string, SpendingRecord>();
  for (const record of records) {
    if (!byNaturalKey.has(record.natural_key)) byNaturalKey.set(record.natural_key, record);
  }
  return [...byNaturalKey.values()];
}

export interface WaMyCouncilFetchResult {
  records: SpendingRecord[];
  metadata: WaODataMetadata;
  metadataUrl: string;
  expenditurePages: number;
  financePages: number;
  expenditureRows: number;
  financeRows: number;
  councils: number;
  years: string[];
  sourceDate: string;
}

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<Record<string, unknown>[]> {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`WA MyCouncil OData HTTP ${response.status} for ${url}`);
  const body = (await response.json()) as { value?: unknown };
  if (!Array.isArray(body.value)) {
    throw new Error(`WA MyCouncil OData response has no value array for ${url}`);
  }
  return body.value as Record<string, unknown>[];
}

async function fetchMetadata(fetchImpl: typeof fetch): Promise<WaODataMetadata> {
  const response = await fetchImpl(WA_MYCOUNCIL_METADATA_URL, {
    headers: { accept: 'application/xml,text/xml' },
  });
  if (!response.ok) {
    throw new Error(`WA MyCouncil metadata HTTP ${response.status}`);
  }
  const xml = await response.text();
  const metadata = parseWaODataMetadata(xml);
  validateWaODataMetadata(metadata);
  return metadata;
}

function clampPageSize(value: number | undefined): number {
  if (value === undefined) return 1000;
  if (!Number.isInteger(value) || value < 1) throw new Error('pageSize must be a positive integer');
  return Math.min(value, 1000);
}

/** Fetch every page of the two actual entity sets; never query budget or grants. */
export async function fetchWaMyCouncilRecords(
  options: WaMyCouncilFetchOptions = {},
): Promise<WaMyCouncilFetchResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sourceDate = (options.now ?? (() => new Date()))().toISOString().slice(0, 10);
  const pageSize = clampPageSize(options.pageSize);
  const metadata = await fetchMetadata(fetchImpl);

  const records: SpendingRecord[] = [];
  const councils = new Set<string>();
  const years = new Set<string>();
  let expenditurePages = 0;
  let expenditureRows = 0;
  let skip = 0;
  for (;;) {
    const url = waMyCouncilExpenditureUrl(skip, pageSize);
    const page = await fetchJson(url, fetchImpl);
    expenditurePages += 1;
    expenditureRows += page.length;
    const parsed = parseWaMyCouncilExpenditurePage(page, { sourceDate, sourceUrl: url });
    records.push(...parsed.records);
    for (const council of parsed.councils) councils.add(council);
    for (const year of parsed.years) years.add(year);
    if (page.length < pageSize) break;
    skip += pageSize;
    if (skip > 100_000) throw new Error('WA MyCouncil expenditure paging exceeded 100,000 rows');
  }

  let financePages = 0;
  let financeRows = 0;
  skip = 0;
  for (;;) {
    const url = waMyCouncilFinanceActualsUrl(skip, pageSize);
    const page = await fetchJson(url, fetchImpl);
    financePages += 1;
    financeRows += page.length;
    const parsed = parseWaMyCouncilFinanceActualsPage(page, { sourceDate, sourceUrl: url });
    records.push(...parsed.records);
    for (const council of parsed.councils) councils.add(council);
    for (const year of parsed.years) years.add(year);
    if (page.length < pageSize) break;
    skip += pageSize;
    if (skip > 100_000) throw new Error('WA MyCouncil finance paging exceeded 100,000 rows');
  }

  const deduped = dedupeWaMyCouncilRecords(records);
  return {
    records: deduped,
    metadata,
    metadataUrl: WA_MYCOUNCIL_METADATA_URL,
    expenditurePages,
    financePages,
    expenditureRows,
    financeRows,
    councils: councils.size,
    years: [...years].sort(),
    sourceDate,
  };
}

export interface WaMyCouncilOptions extends WaMyCouncilFetchOptions {
  /** Test/CLI override: page arrays by entity set, bypassing OData. */
  expenditurePageOverride?: unknown[];
  financePageOverride?: unknown[];
  metadataXml?: string;
}

export function createWaMyCouncilConnector(options: WaMyCouncilOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'direct' as const,
  };

  return {
    id: WA_MYCOUNCIL_ID,
    name: WA_MYCOUNCIL_NAME,
    publisher: WA_MYCOUNCIL_PUBLISHER,
    source_url: WA_MYCOUNCIL_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WA_MYCOUNCIL_LICENSE,
    notes:
      'WA MyCouncil OData service. Council-level actual expenditure by program/year from vw_LG_Expenditure (whole AUD), plus TotalRevenue and EmployeeCost from the controlled vw_LG_FinanceActuals snapshot where the source publishes a positive value. Budget (vw_LG_FinanceBudget) and state grants (vw_LG_GrantData) are not queried; WA Budget remains the separate wa-budget source. Every row is agency_detail and non-additive across councils, programs and years.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      let result: WaMyCouncilFetchResult;
      if (options.expenditurePageOverride && options.financePageOverride) {
        const sourceDate = (options.now ?? (() => new Date()))().toISOString().slice(0, 10);
        const expenditure = parseWaMyCouncilExpenditurePage(options.expenditurePageOverride, {
          sourceDate,
          sourceUrl: waMyCouncilExpenditureUrl(0, options.expenditurePageOverride.length),
        });
        const finance = parseWaMyCouncilFinanceActualsPage(options.financePageOverride, {
          sourceDate,
          sourceUrl: waMyCouncilFinanceActualsUrl(0, options.financePageOverride.length),
        });
        result = {
          records: dedupeWaMyCouncilRecords([...expenditure.records, ...finance.records]),
          metadata: parseWaODataMetadata(options.metadataXml ?? ''),
          metadataUrl: WA_MYCOUNCIL_METADATA_URL,
          expenditurePages: 1,
          financePages: 1,
          expenditureRows: options.expenditurePageOverride.length,
          financeRows: options.financePageOverride.length,
          councils: new Set([...expenditure.councils, ...finance.councils]).size,
          years: [...new Set([...expenditure.years, ...finance.years])].sort(),
          sourceDate,
        };
      } else {
        result = await fetchWaMyCouncilRecords(options);
      }
      metadata.warnings.push(
        `WA MyCouncil metadata: ${result.metadata.entitySets.length} entity sets; ` +
          `expenditure=${result.expenditureRows} rows/${result.expenditurePages} pages; ` +
          `finance=${result.financeRows} rows/${result.financePages} pages; ` +
          `councils=${result.councils}; years=${result.years[0]}..${result.years[result.years.length - 1]}`,
      );
      return [{ kind: 'wa-mycouncil-records', records: result.records }];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const entry = raw.find(
        (value) => value.kind === 'wa-mycouncil-records' && Array.isArray(value.records),
      );
      if (!entry) {
        metadata.errors.push('WA MyCouncil fetch returned no parsed records');
        return [];
      }
      return (entry.records as SpendingRecord[]).slice();
    },
    metadata,
  };
}
