/**
 * Client-side view of the ausspend data API. These types mirror the live JSON
 * shapes documented in the API brief; they intentionally live in the client
 * rather than shared because they describe transport payloads, not domain
 * contracts.
 */

export type MeasureType = 'actual' | 'budget' | 'estimate' | 'contract' | 'grant_award';

export type JurisdictionLevel =
  'federal' | 'state' | 'territory' | 'local' | 'charity' | 'pnfc' | 'other';

export type ExtractionConfidence = 'low' | 'medium' | 'high';

export type DataSourceStatus = 'stub' | 'active' | 'degraded';

export type FetchStrategy = 'direct' | 'parliament_fallback' | 'headless';

export interface DeferredResource {
  package_id: string;
  package_name: string;
  dataset_title: string;
  resource_id: string;
  name: string;
  format: string;
  url: string;
  reason: string;
}

export type RegionLevel = 'national' | 'state' | 'region';

export type FunctionLevel = 'division' | 'subdivision';

export interface DataSource {
  source_id: string;
  name: string;
  publisher: string;
  source_url: string;
  retrieved_at: string;
  license: string;
  verified: boolean;
  notes?: string;
  status: DataSourceStatus;
  last_ingested_at: string | null;
  fetch_strategy?: FetchStrategy | null;
  last_successful_fetch?: string | null;
  staleness_days?: number | null;
  records_ingested: number;
  errors: string[];
  deferred_resources?: DeferredResource[];
}

export interface DataSourcesResponse {
  sources: DataSource[];
}

export interface ConnectorMetadata {
  id: string;
  name: string;
  publisher: string;
  source_url: string;
  status: DataSourceStatus;
  jurisdiction_level: JurisdictionLevel;
  last_fetched_at: string | null;
  records_ingested: number;
  errors: string[];
  deferred_resources?: DeferredResource[];
  fetch_strategy?: FetchStrategy | null;
  last_successful_fetch?: string | null;
  staleness_days?: number | null;
}

export interface CoverageCounts {
  data_sources: number;
  regions: number;
  functions: number;
  measures: number;
  synthetic_measures?: number;
  real_measures?: number;
}

export interface CoverageGap {
  dimension: string;
  status: 'missing' | 'partial';
  detail: string;
}

/** GET /api/meta/coverage — the Phase 1 banner payload. */
export interface CoverageResponse {
  phase: string;
  synthetic: boolean;
  synthetic_measures?: number;
  real_measures?: number;
  live_ingestion: boolean;
  generated_at: string;
  counts: CoverageCounts;
  coverage_gaps?: CoverageGap[];
  fiscal_years: string[];
  measure_types: MeasureType[];
  supported_measure_types?: MeasureType[];
  region_levels: RegionLevel[];
  connectors: ConnectorMetadata[];
  connector_status_counts?: Record<DataSourceStatus, number>;
  federal_ingestion?: {
    live: string[];
    degraded: string[];
    pending: string[];
    stubs: string[];
    aus_tender_last_ingested_at: string | null;
    pbs_last_ingested_at?: string | null;
    pbs_caveat?: string;
    note: string;
  };
  state_ingestion?: {
    live: string[];
    degraded: string[];
    stubs: string[];
    nsw_ckan_last_ingested_at?: string | null;
    vic_budget_last_ingested_at?: string | null;
    qld_budget_last_ingested_at?: string | null;
    qld_qgip_last_ingested_at?: string | null;
    qld_qgip_records?: number;
    wa_budget_last_ingested_at?: string | null;
    sa_gfs_last_ingested_at?: string | null;
    tas_budget_last_ingested_at?: string | null;
    deferred_resources?: DeferredResource[];
    note: string;
  };
  territory_ingestion?: {
    live: string[];
    degraded: string[];
    stubs: string[];
    act_budget_last_ingested_at?: string | null;
    nt_budget_last_ingested_at?: string | null;
    note: string;
  };
  charity_ingestion?: {
    live: string[];
    degraded: string[];
    stubs: string[];
    acnc_last_ingested_at?: string | null;
    acnc_records?: number;
    note: string;
  };
  benchmark_ingestion?: {
    live: string[];
    last_ingested_at: string | null;
    records: number;
    caveat: string;
    note: string;
  };
  soc_ingestion?: {
    live: string[];
    degraded: string[];
    last_ingested_at: string | null;
    records: number;
    entity: string;
    jurisdiction: string;
    unit: string;
    unit_label: string;
    caveat: string;
    label: string;
    entities?: Array<{
      source_id: string;
      entity: string;
      jurisdiction: string;
      unit: string;
      unit_label: string;
      records: number;
      last_ingested_at: string | null;
      status?: DataSourceStatus;
      fetch_strategy?: FetchStrategy | null;
      last_successful_fetch?: string | null;
      staleness_days?: number | null;
      caveat: string;
    }>;
    note: string;
  };
  local_ingestion?: {
    live: string[];
    degraded: string[];
    stubs: string[];
    dubbo_last_ingested_at?: string | null;
    qld_local_last_ingested_at?: string | null;
    note: string;
    not_covered?: { councils: string[]; states: string[] };
  };
  ingestion?: { latest_logs: IngestionLog[] };
  limitations: string[];
  note: string;
}

export interface FunctionRef {
  code: string;
  name: string;
  level: FunctionLevel;
  parent_code?: string;
}

export interface FunctionDivision extends FunctionRef {
  level: 'division';
  subdivisions: FunctionRef[];
}

export interface FunctionsResponse {
  functions: FunctionDivision[];
}

export interface RegionRef {
  _id: string;
  code: string;
  name: string;
  level: RegionLevel;
  parent_code?: string;
  slug?: string;
}

export interface AreaPanelTypeTotal {
  measure_type: MeasureType;
  count: number;
  total_cents: number;
}

export interface AreaPanel {
  key: 'local' | 'state_nsw' | 'federal_nsw_tagged' | 'commonwealth_pbs';
  label: string;
  description: string;
  jurisdiction_level: JurisdictionLevel;
  count: number;
  by_measure_type: AreaPanelTypeTotal[];
  /** Always null: area panels never carry a cross-level/type total. */
  total_cents: null;
}

export interface AreaProfile {
  area: RegionRef & { slug: string };
  panels: AreaPanel[];
  caution: string;
  not_covered: { councils: string[]; states: string[] };
}

export interface RegionsResponse {
  regions: RegionRef[];
  count: number;
}

export interface MeasureRow {
  id: string;
  region_id: string | null;
  function_code: string | null;
  amount_cents: number;
  measure_type: MeasureType;
  fiscal_year: string;
  source_id: string;
  source_url: string;
  verified: boolean;
  notes?: string;
  natural_key?: string;
  project_name?: string;
  description?: string;
  jurisdiction_level?: JurisdictionLevel;
  jurisdiction?: string;
  delivery_entity?: string;
  funding_source?: string;
  source_dataset?: string;
  source_date?: string;
  data_quality_flag?: string;
  aggregation_role?:
    | 'additive'
    | 'agency_detail'
    | 'policy_measure'
    | 'expense_total'
    | 'expense_component'
    | 'benchmark';
  extraction_confidence?: ExtractionConfidence;
  location?: { state?: string; postcode?: string; lga_name?: string; sa4_name?: string };
  expense_category?: string;
  unspsc?: string;
  soc_line_item?: string;
  soc_line_label?: string;
  soc_unit?: string;
  soc_section?: 'revenue' | 'expenses' | 'result' | 'capital' | 'transfer';
  soc_note?: string;
  soc_component_of?: string;
  soc_breakdown?: string;
  soc_printed_sign?: 'positive' | 'negative';
  potential_double_count?: boolean;
  aihw_broad_source_of_funding?: 'Government' | 'Non-government';
  aihw_area_of_expenditure?: string;
  aihw_printed_sign?: 'positive' | 'negative';
  aihw_unit?: string;
  wa_budget_measure?: 'asset_investment' | 'major_spending_change';
  wa_budget_table?: string;
  wa_printed_sign?: 'positive' | 'negative';
  tas_budget_table?: string;
  tas_budget_column?: string;
  tas_budget_unit?: string;
  qld_lg_measure?:
    | 'total_operating_expenses'
    | 'employee_expenses'
    | 'depreciation_amortisation'
    | 'interest_paid_borrowing_costs';
  qld_lg_unit?: string;
  qld_lg_component_of?: string;
}

/** Per-measure-type count and sum. The API never sums across types. */
export interface PerMeasureTypeTotal {
  measure_type: MeasureType;
  count: number;
  total_cents: number;
}

export interface MeasureSummary {
  count: number;
  additive_count?: number;
  non_additive_count?: number;
  measure_types: MeasureType[];
  mixed: boolean;
  total_cents: number | null;
  total_measure_type: MeasureType | null;
  total_by_measure_type: PerMeasureTypeTotal[];
}

export interface RegionGroup {
  region: RegionRef;
  measure_types: MeasureType[];
  mixed: boolean;
  total_cents: number | null;
  total_by_measure_type: PerMeasureTypeTotal[];
  measures: MeasureRow[];
}

export interface FunctionGroup {
  function: FunctionRef;
  measure_types: MeasureType[];
  mixed: boolean;
  total_cents: number | null;
  total_by_measure_type: PerMeasureTypeTotal[];
  measures: MeasureRow[];
}

export interface RankedState {
  region: RegionRef;
  total_cents: number;
}

export interface FunctionFilters {
  fiscal_year: string | null;
  measure_type: MeasureType | null;
  region: string | null;
  limit: number;
}

export interface RegionFilters {
  fiscal_year: string | null;
  measure_type: MeasureType | null;
  limit: number;
}

export interface FunctionDetail extends MeasureSummary {
  function: FunctionRef;
  filters: FunctionFilters;
  ranked_states: RankedState[] | null;
  by_region: RegionGroup[];
  measures: MeasureRow[];
}

export interface NonAdditiveBlock {
  label: string;
  description?: string;
  aggregation_role: 'agency_detail' | 'policy_measure';
  count: number;
  mixed: boolean;
  total_cents: number | null;
  total_by_measure_type: PerMeasureTypeTotal[];
  measures: MeasureRow[];
}

/** Backwards-compatible alias for the VIC agency-detail block. */
export type AgencyDetailBlock = NonAdditiveBlock;

export interface RegionDetail extends MeasureSummary {
  region: RegionRef;
  filters: RegionFilters;
  /**
   * The summary/count/totals cover the whole match set. `measures` is only the
   * first `filters.limit` rows; `rows_truncated` is true when more rows exist.
   */
  rows_returned?: number;
  rows_truncated?: boolean;
  by_function: FunctionGroup[];
  measures: MeasureRow[];
  non_additive?: NonAdditiveBlock[];
  agency_detail?: AgencyDetailBlock;
  area_profile?: AreaProfile | null;
}

export interface StateDetail extends RegionDetail {
  state: RegionRef;
}

export interface BenchmarkSeries {
  id: string;
  function_code: string;
  function_name: string;
  jurisdiction_level: JurisdictionLevel;
  jurisdiction: string;
  jurisdiction_name: string;
  amount_cents: number;
  fiscal_year: string;
  verified: boolean;
  data_quality_flag?: string;
  source_id: string;
  source_url: string;
  notes?: string;
}

/** GET /api/benchmark — ABS GFS published cells, never a computed total. */
export interface BenchmarkResponse {
  source: {
    source_id: string;
    name: string;
    dataset: string;
    source_url: string;
    catalogue_url: string;
    fiscal_year: string;
    unit: string;
    unit_to_cents: number;
    caveat: string;
  };
  fiscal_years: string[];
  functions: Array<{ code: string; name: string }>;
  series: BenchmarkSeries[];
  counts: { series: number; by_level: Record<string, number> };
  note: string;
}

/** One published ABS GFS PNFC operating-statement total. */
export interface PnfcBenchmarkSeries {
  id: string;
  gfs_flow: 'revenue' | 'expense' | null;
  gfs_line_item: string | null;
  gfs_line_label: string | null;
  jurisdiction_level: 'pnfc';
  jurisdiction: string;
  jurisdiction_name: string;
  location_state?: string;
  amount_cents: number;
  fiscal_year: string;
  verified: boolean;
  aggregation_role?: string;
  data_quality_flag?: string;
  source_id: string;
  source_url: string;
  notes?: string;
}

/** GET /api/soc — entity-level NSW SOC statement lines, never a total. */
export interface SocSeriesRow {
  id: string;
  source_id: string;
  source_url: string;
  source_dataset: string | null;
  fiscal_year: string;
  jurisdiction_level: 'soc';
  jurisdiction: string;
  delivery_entity: string;
  funding_source: string | null;
  soc_line_item: string | null;
  soc_line_label: string | null;
  soc_unit: string | null;
  soc_section: 'revenue' | 'expenses' | 'result' | 'capital' | 'transfer' | null;
  soc_note: string | null;
  soc_component_of: string | null;
  soc_breakdown: string | null;
  soc_printed_sign: 'positive' | 'negative' | null;
  measure_type: MeasureType;
  amount_cents: number;
  potential_double_count: boolean;
  verified: boolean;
  data_quality_flag: string | null;
  extraction_confidence: ExtractionConfidence | null;
  aggregation_role: string | null;
  location_state?: string;
  notes?: string;
}

export interface SocDeferredDocument {
  source_id: string;
  entity: string;
  jurisdiction: string;
  fiscal_year: string | null;
  title: string;
  document_url: string;
  sha256: string | null;
  reason: string;
  discovered_at: string;
  status: 'deferred' | 'resolved';
}

export interface SocSource {
  source_id: string;
  name: string;
  entity: string;
  jurisdiction: string;
  jurisdiction_level: 'soc';
  discovery_page: string;
  unit: string;
  unit_label: string;
  unit_to_cents: number;
  caveat: string;
  label: string;
  /** Rows for this source in the current response (a count, never a sum). */
  records: number;
}

export interface SocResponse {
  /** The requested or sole entity's source (kept for single-source callers). */
  source: SocSource;
  /** Every registered SOC entity source, so Sydney Water, WaterNSW and Hunter Water stay distinct. */
  sources: SocSource[];
  fiscal_years: string[];
  entities: string[];
  series: SocSeriesRow[];
  deferred_documents: SocDeferredDocument[];
  counts: {
    series: number;
    by_line: Record<string, number>;
    by_entity: Record<string, number>;
    by_section: Record<string, number>;
    by_note: Record<string, number>;
    potential_double_count: number;
    deferred_documents: number;
  };
  note: string;
}

/** GET /api/benchmark/pnfc — ABS GFS PNFC sector benchmark, never a total. */
export interface PnfcBenchmarkResponse {
  source: {
    source_id: string;
    name: string;
    dataset: string;
    source_url: string;
    catalogue_url: string;
    fiscal_year: string;
    unit: string;
    unit_to_cents: number;
    caveat: string;
    label: string;
  };
  fiscal_years: string[];
  flows: Array<'revenue' | 'expense'>;
  jurisdictions: Array<{ code: string; name: string; level: 'pnfc' }>;
  series: PnfcBenchmarkSeries[];
  counts: {
    series: number;
    by_flow: Record<string, number>;
    by_jurisdiction: Record<string, number>;
  };
  note: string;
}

export interface SearchResponse {
  q: string;
  regions: RegionRef[];
  functions: FunctionRef[];
  count: number;
}

export interface IngestionLog {
  id?: string;
  source_id: string;
  started_at: string;
  finished_at: string;
  status: 'success' | 'partial' | 'error' | 'skipped';
  records_fetched: number;
  records_upserted: number;
  errors: string[];
  message?: string;
}

export interface HealthResponse {
  ok: boolean;
  db: 'connected' | 'unavailable';
}

export type SpendingSort = 'amount_desc' | 'amount_asc' | 'fiscal_year_desc' | 'fiscal_year_asc';

/**
 * A `/api/spending` data row: the measure fields plus the function/region
 * display names and provenance the API resolves server-side.
 */
export interface SpendingMeasureRow extends MeasureRow {
  function_name: string | null;
  function_level: FunctionLevel | null;
  function_parent_code?: string;
  region_code: string | null;
  region_name: string | null;
  region_level: RegionLevel | null;
  provenance: {
    source_id: string;
    source_url: string;
    verified: boolean;
    notes?: string;
  };
}

export interface SpendingBreakdownBase {
  count: number;
  measure_types: MeasureType[];
  mixed: boolean;
  total_cents: number | null;
  total_by_measure_type: PerMeasureTypeTotal[];
}

export interface SpendingByFunction extends SpendingBreakdownBase {
  function: FunctionRef;
}

export interface SpendingByRegion extends SpendingBreakdownBase {
  region: RegionRef;
}

export interface ExpenseCategoryTotal {
  expense_category: string;
  label: string;
  count: number;
  total_cents: number;
  additive: boolean;
}

export interface SpendingSummary {
  count: number;
  additive_count?: number;
  non_additive_count?: number;
  currency: 'AUD';
  total_cents: number | null;
  total_measure_type: MeasureType | null;
  total_by_measure_type: PerMeasureTypeTotal[];
  measure_types: MeasureType[];
  mixed: boolean;
  expense_categories?: ExpenseCategoryTotal[];
  charity_expense_total_cents?: number | null;
  breakdown_by_function: SpendingByFunction[];
  breakdown_by_region: SpendingByRegion[];
}

export interface SpendingPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
}

export interface SpendingAppliedFilters {
  fiscal_year: string | null;
  measure_type: MeasureType | null;
  jurisdiction_level: JurisdictionLevel | null;
  state?: string | null;
  postcode?: string | null;
  expense_category?: string | null;
  function: string | null;
  q: string | null;
  region: string | null;
  area?: string | null;
  min_amount: number | null;
  max_amount: number | null;
  sort: SpendingSort;
}

export interface SpendingResponse {
  data: SpendingMeasureRow[];
  summary: SpendingSummary;
  pagination: SpendingPagination;
  applied_filters: SpendingAppliedFilters;
  area_profile?: AreaProfile;
}

/** ABS/OECD trade domains are a separate analytical layer from spending. */
export type TradeFlow = 'import' | 'export';

export type TradeMeasureType =
  'trade_value' | 'cif_fob_margin' | 'port_interface_cost' | 'trade_volume' | 'trade_price';

export type TradeDataQualityFlag = 'verified' | 'observed' | 'provisional' | 'estimated';

/** GET /api/trade — one stored trade observation. Never a spending measure. */
export interface TradeRow {
  id: string;
  trade_flow: TradeFlow;
  measure_type: TradeMeasureType;
  commodity_name: string;
  commodity_code: string | null;
  partner_country: string | null;
  port_name: string | null;
  jurisdiction_level: JurisdictionLevel;
  location: {
    state: string | null;
    port: string | null;
    granularity: 'national' | 'port';
  } | null;
  amount_cents: number;
  margin_percent: number | null;
  index_value: number | null;
  volume: number | null;
  price: number | null;
  financial_year: string;
  time_period: string | null;
  source_dataset: string;
  source_url: string;
  source_date: string;
  data_quality_flag: TradeDataQualityFlag;
  created_at: string | null;
  updated_at: string | null;
}

export interface TradeSummaryGroup {
  measure_type: TradeMeasureType;
  trade_flow?: TradeFlow;
  count: number;
  amount_cents: number;
}

/**
 * GET /api/trade — rows plus per-measure groups. The response never contains
 * one grand total: measure types (and even commodity parent/child rows) are
 * not additive, so the client must not sum them.
 */
export interface TradeResponse {
  filters: {
    trade_flow?: TradeFlow;
    measure_type?: TradeMeasureType;
    commodity?: string;
    partner_country?: string;
    port?: string;
    financial_year?: string;
    limit?: number;
    offset?: number;
  };
  rows: TradeRow[];
  summary: TradeSummaryGroup[];
  counts: {
    rows: number;
    total: number;
    by_measure_type: Partial<Record<TradeMeasureType, number>>;
  };
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  warning: string;
  note: string;
}

/** GET /api/trade/years — distinct financial years available for the filters. */
export interface TradeYearsResponse {
  filters: TradeResponse['filters'];
  years: string[];
  count: number;
  warning: string;
}

export interface TradeCommoditiesResponse {
  filters: TradeResponse['filters'];
  commodities: { commodity_name: string; commodity_code: string | null; count: number }[];
  count: number;
  warning: string;
}
