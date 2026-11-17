/**
 * Client-side view of the ausspend data API. These types mirror the live JSON
 * shapes documented in the API brief; they intentionally live in the client
 * rather than shared because they describe transport payloads, not domain
 * contracts.
 */

export type MeasureType = 'actual' | 'budget' | 'estimate' | 'contract' | 'grant_award';

export type JurisdictionLevel = 'federal' | 'state' | 'territory' | 'local' | 'other';

export type ExtractionConfidence = 'low' | 'medium' | 'high';

export type DataSourceStatus = 'stub' | 'active' | 'degraded';

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
    deferred_resources?: DeferredResource[];
    note: string;
  };
  local_ingestion?: {
    live: string[];
    degraded: string[];
    stubs: string[];
    dubbo_last_ingested_at?: string | null;
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
  aggregation_role?: 'additive' | 'agency_detail' | 'policy_measure';
  extraction_confidence?: ExtractionConfidence;
  location?: { state?: string; lga_name?: string; sa4_name?: string };
  unspsc?: string;
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
  by_function: FunctionGroup[];
  measures: MeasureRow[];
  non_additive?: NonAdditiveBlock[];
  agency_detail?: AgencyDetailBlock;
  area_profile?: AreaProfile | null;
}

export interface StateDetail extends RegionDetail {
  state: RegionRef;
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
  function: string | null;
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
