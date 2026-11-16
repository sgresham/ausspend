import mongoose from 'mongoose';
import type { PerMeasureTypeTotal } from '@ausspend/shared';
import {
  MeasureModel,
  RegionModel,
  type MeasureDocument,
  type RegionDocument,
} from '../models/index.js';
import { measureQuery, sumCents, type MeasureFilters } from './filters.js';

export type LeanMeasure = MeasureDocument & { _id: mongoose.Types.ObjectId };

export interface MeasureRow {
  id: string;
  region_id: string | null;
  function_code: string | null;
  amount_cents: number;
  measure_type: MeasureDocument['measure_type'];
  fiscal_year: string;
  source_id: string;
  source_url: string;
  verified: boolean;
  notes?: string;
  natural_key?: string;
  project_name?: string;
  description?: string;
  jurisdiction_level?: 'federal' | 'state' | 'territory' | 'local' | 'other';
  jurisdiction?: string;
  delivery_entity?: string;
  funding_source?: string;
  source_dataset?: string;
  source_date?: string;
  data_quality_flag?: string;
  location?: { state?: string; lga_name?: string };
  unspsc?: string;
}

export interface MeasureSummary {
  count: number;
  measure_types: Array<MeasureDocument['measure_type']>;
  mixed: boolean;
  total_cents: number | null;
  total_measure_type: MeasureDocument['measure_type'] | null;
  total_by_measure_type: PerMeasureTypeTotal[];
}

export interface LeanRegion {
  _id: mongoose.Types.ObjectId;
  code: string;
  name: string;
  level: RegionDocument['level'];
  parent_code?: string;
}

export interface RegionPayload {
  _id: string;
  code: string;
  name: string;
  level: RegionDocument['level'];
  parent_code?: string;
}

export function serializeRegion(region: LeanRegion): RegionPayload {
  return {
    _id: region._id.toString(),
    code: region.code,
    name: region.name,
    level: region.level,
    ...(region.parent_code ? { parent_code: region.parent_code } : {}),
  };
}

export function serializeMeasure(measure: LeanMeasure): MeasureRow {
  return {
    id: measure._id.toString(),
    region_id: measure.region_id ? measure.region_id.toString() : null,
    function_code: measure.function_code ?? null,
    amount_cents: measure.amount_cents,
    measure_type: measure.measure_type,
    fiscal_year: measure.fiscal_year,
    source_id: measure.source_id,
    source_url: measure.source_url,
    verified: measure.verified,
    ...(measure.notes ? { notes: measure.notes } : {}),
    ...(measure.natural_key ? { natural_key: measure.natural_key } : {}),
    ...(measure.project_name ? { project_name: measure.project_name } : {}),
    ...(measure.description ? { description: measure.description } : {}),
    ...(measure.jurisdiction_level ? { jurisdiction_level: measure.jurisdiction_level } : {}),
    ...(measure.jurisdiction ? { jurisdiction: measure.jurisdiction } : {}),
    ...(measure.delivery_entity ? { delivery_entity: measure.delivery_entity } : {}),
    ...(measure.funding_source ? { funding_source: measure.funding_source } : {}),
    ...(measure.source_dataset ? { source_dataset: measure.source_dataset } : {}),
    ...(measure.source_date ? { source_date: measure.source_date } : {}),
    ...(measure.data_quality_flag ? { data_quality_flag: measure.data_quality_flag } : {}),
    ...(measure.location ? { location: measure.location } : {}),
    ...(measure.unspsc ? { unspsc: measure.unspsc } : {}),
  };
}

export async function loadMeasures(
  baseQuery: Record<string, unknown>,
  filters: MeasureFilters,
): Promise<LeanMeasure[]> {
  return MeasureModel.find({ ...baseQuery, ...measureQuery(filters) })
    .sort({ fiscal_year: 1, region_id: 1, measure_type: 1 })
    .limit(filters.limit)
    .lean<LeanMeasure[]>();
}

/**
 * Count and sum for each measure type present. These per-type totals are always
 * returned; they are the only totals that are safe to add up, and only within a
 * single type. Never sum across types.
 */
export function perMeasureTypeTotals(measures: readonly LeanMeasure[]): PerMeasureTypeTotal[] {
  const byType = new Map<MeasureDocument['measure_type'], { count: number; amounts: number[] }>();

  for (const measure of measures) {
    const entry = byType.get(measure.measure_type) ?? { count: 0, amounts: [] };
    entry.count += 1;
    entry.amounts.push(measure.amount_cents);
    byType.set(measure.measure_type, entry);
  }

  return [...byType.entries()]
    .map(([measureType, entry]) => ({
      measure_type: measureType,
      count: entry.count,
      total_cents: sumCents(entry.amounts),
    }))
    .sort((a, b) => a.measure_type.localeCompare(b.measure_type));
}

/**
 * A headline total is only meaningful for a single measure type. When more
 * than one measure type is present the response is marked mixed and the total
 * is null; the per-type totals are still returned.
 */
export function summarizeMeasures(measures: readonly LeanMeasure[]): MeasureSummary {
  const measureTypes = [...new Set(measures.map((measure) => measure.measure_type))].sort();
  const mixed = measureTypes.length > 1;
  const singleType = measureTypes.length === 1 ? measureTypes[0]! : null;

  return {
    count: measures.length,
    measure_types: measureTypes,
    mixed,
    total_cents: mixed ? null : sumCents(measures.map((measure) => measure.amount_cents)),
    total_measure_type: singleType,
    total_by_measure_type: perMeasureTypeTotals(measures),
  };
}

export async function loadRegions(
  ids: readonly mongoose.Types.ObjectId[],
): Promise<Map<string, LeanRegion>> {
  if (ids.length === 0) return new Map();
  const regions = await RegionModel.find({ _id: { $in: ids } }).lean<LeanRegion[]>();
  return new Map(regions.map((region) => [region._id.toString(), region]));
}

/**
 * Group measure rows by region, with optional per-region totals. `mixed`
 * comes from the whole result set, so a region total is null whenever the
 * overall response mixes measure types.
 */
export async function groupByRegion(
  measures: readonly LeanMeasure[],
  summary: MeasureSummary,
): Promise<
  Array<{
    region: RegionPayload;
    measure_types: Array<MeasureDocument['measure_type']>;
    mixed: boolean;
    total_cents: number | null;
    total_by_measure_type: PerMeasureTypeTotal[];
    measures: MeasureRow[];
  }>
> {
  const withRegion = measures.filter(
    (measure): measure is LeanMeasure & { region_id: mongoose.Types.ObjectId } =>
      Boolean(measure.region_id),
  );
  const regions = await loadRegions([
    ...new Map(
      withRegion.map((measure) => [measure.region_id.toString(), measure.region_id]),
    ).values(),
  ]);

  const groups = new Map<string, LeanMeasure[]>();
  for (const measure of withRegion) {
    const key = measure.region_id.toString();
    const group = groups.get(key) ?? [];
    group.push(measure);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([regionId, rows]) => {
      const region = regions.get(regionId);
      const measureTypes = [...new Set(rows.map((row) => row.measure_type))].sort();
      const mixed = summary.mixed || measureTypes.length > 1;
      return {
        region: region
          ? serializeRegion(region)
          : { _id: regionId, code: regionId, name: 'Unknown region', level: 'region' as const },
        measure_types: measureTypes,
        mixed,
        total_cents: mixed ? null : sumCents(rows.map((row) => row.amount_cents)),
        total_by_measure_type: perMeasureTypeTotals(rows),
        measures: rows.map(serializeMeasure),
      };
    })
    .sort((a, b) => a.region.code.localeCompare(b.region.code));
}
