/**
 * Client-side view of the ausspend data API. These types mirror the live JSON
 * shapes documented in the API brief; they intentionally live in the client
 * rather than shared because they describe transport payloads, not domain
 * contracts.
 */

export type MeasureType = 'actual' | 'budget' | 'estimate';

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
}

export interface DataSourcesResponse {
  sources: DataSource[];
}

export interface ConnectorMetadata {
  id: string;
  name: string;
  publisher: string;
  source_url: string;
  status: 'stub';
}

export interface CoverageCounts {
  data_sources: number;
  regions: number;
  functions: number;
  measures: number;
}

/** GET /api/meta/coverage — the Phase 1 banner payload. */
export interface CoverageResponse {
  phase: string;
  synthetic: boolean;
  live_ingestion: boolean;
  generated_at: string;
  counts: CoverageCounts;
  fiscal_years: string[];
  measure_types: MeasureType[];
  region_levels: RegionLevel[];
  connectors: ConnectorMetadata[];
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
}

export interface RegionsResponse {
  regions: RegionRef[];
  count: number;
}

export interface MeasureRow {
  id: string;
  region_id: string;
  function_code: string;
  amount_cents: number;
  measure_type: MeasureType;
  fiscal_year: string;
  source_id: string;
  source_url: string;
  verified: boolean;
  notes?: string;
}

/** Per-measure-type count and sum. The API never sums across types. */
export interface PerMeasureTypeTotal {
  measure_type: MeasureType;
  count: number;
  total_cents: number;
}

export interface MeasureSummary {
  count: number;
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

export interface RegionDetail extends MeasureSummary {
  region: RegionRef;
  filters: RegionFilters;
  by_function: FunctionGroup[];
  measures: MeasureRow[];
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
  function_name: string;
  function_level: FunctionLevel;
  function_parent_code?: string;
  region_code: string;
  region_name: string;
  region_level: RegionLevel;
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
  function: string | null;
  region: string | null;
  min_amount: number | null;
  max_amount: number | null;
  sort: SpendingSort;
}

export interface SpendingResponse {
  data: SpendingMeasureRow[];
  summary: SpendingSummary;
  pagination: SpendingPagination;
  applied_filters: SpendingAppliedFilters;
}
