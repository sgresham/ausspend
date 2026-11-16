/**
 * Client-side view of the M1b data API. These types mirror the live JSON shapes
 * documented in the API brief; they intentionally live in the client rather
 * than shared because they describe transport payloads, not domain contracts.
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

export interface MeasureSummary {
  count: number;
  measure_types: MeasureType[];
  mixed: boolean;
  total_cents: number | null;
  total_measure_type: MeasureType | null;
}

export interface RegionGroup {
  region: RegionRef;
  measure_types: MeasureType[];
  mixed: boolean;
  total_cents: number | null;
  measures: MeasureRow[];
}

export interface FunctionGroup {
  function: FunctionRef;
  measure_types: MeasureType[];
  mixed: boolean;
  total_cents: number | null;
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
