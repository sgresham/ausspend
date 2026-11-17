import mongoose from 'mongoose';
import {
  EXPENSE_CATEGORY_LABELS,
  regionSlug,
  type ExpenseCategoryTotal,
  type PerMeasureTypeTotal,
} from '@ausspend/shared';
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
  jurisdiction_level?:
    'federal' | 'state' | 'territory' | 'local' | 'charity' | 'pnfc' | 'soc' | 'other';
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
  extraction_confidence?: 'low' | 'medium' | 'high';
  location?: { state?: string; postcode?: string; lga_name?: string };
  expense_category?: string;
  unspsc?: string;
}

export interface MeasureSummary {
  count: number;
  additive_count: number;
  non_additive_count: number;
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
  slug: string;
}

export function serializeRegion(region: LeanRegion): RegionPayload {
  return {
    _id: region._id.toString(),
    code: region.code,
    name: region.name,
    level: region.level,
    ...(region.parent_code ? { parent_code: region.parent_code } : {}),
    slug: regionSlug(region),
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
    ...(measure.aggregation_role ? { aggregation_role: measure.aggregation_role } : {}),
    ...(measure.extraction_confidence
      ? { extraction_confidence: measure.extraction_confidence }
      : {}),
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
 * Missing `aggregation_role` means `additive` for older sources.
 * `agency_detail` (single-agency statements), `policy_measure` (BP4 policy
 * decisions that overlap another series), `expense_component` (ACNC components
 * that overlap their total) and `benchmark` (ABS GFS top-down aggregates) are
 * shown for provenance but must never enter an additive total.
 */
export function isAgencyDetail(measure: {
  aggregation_role?: 'additive' | 'agency_detail' | 'policy_measure' | 'benchmark' | null;
}): boolean {
  return measure.aggregation_role === 'agency_detail';
}

export function isNonAdditiveMeasure(measure: {
  aggregation_role?:
    | 'additive'
    | 'agency_detail'
    | 'policy_measure'
    | 'expense_total'
    | 'expense_component'
    | 'benchmark'
    | null;
}): boolean {
  return (
    measure.aggregation_role !== undefined &&
    measure.aggregation_role !== null &&
    measure.aggregation_role !== 'additive' &&
    // A charity total row is the only safe charity headline input. Its
    // components are additive among themselves but must never be added to the
    // total, so they are excluded from every generic total.
    measure.aggregation_role !== 'expense_total'
  );
}

export function isAdditiveMeasure(measure: {
  aggregation_role?:
    | 'additive'
    | 'agency_detail'
    | 'policy_measure'
    | 'expense_total'
    | 'expense_component'
    | 'benchmark'
    | null;
}): boolean {
  return !isNonAdditiveMeasure(measure);
}

export function isExpenseTotalMeasure(measure: {
  aggregation_role?:
    | 'additive'
    | 'agency_detail'
    | 'policy_measure'
    | 'expense_total'
    | 'expense_component'
    | 'benchmark'
    | null;
}): boolean {
  return measure.aggregation_role === 'expense_total';
}

export function isExpenseComponentMeasure(measure: {
  aggregation_role?:
    | 'additive'
    | 'agency_detail'
    | 'policy_measure'
    | 'expense_total'
    | 'expense_component'
    | 'benchmark'
    | null;
}): boolean {
  return measure.aggregation_role === 'expense_component';
}

/**
 * Per-expense-category totals over charity rows. The `total` entry is the
 * published total-expenses category; every other entry is a component. They
 * are returned side by side and never added together.
 */
export function expenseCategoryTotals(
  measures: readonly (Pick<LeanMeasure, 'amount_cents' | 'expense_category'> & {
    aggregation_role?: LeanMeasure['aggregation_role'];
  })[],
): ExpenseCategoryTotal[] {
  const byCategory = new Map<string, { count: number; amounts: number[] }>();
  for (const measure of measures) {
    if (!measure.expense_category) continue;
    const entry = byCategory.get(measure.expense_category) ?? { count: 0, amounts: [] };
    entry.count += 1;
    entry.amounts.push(measure.amount_cents);
    byCategory.set(measure.expense_category, entry);
  }
  return [...byCategory.entries()]
    .map(([category, entry]) => ({
      expense_category: category,
      label: EXPENSE_CATEGORY_LABELS[category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? category,
      count: entry.count,
      total_cents: sumCents(entry.amounts),
      additive: category === 'total',
    }))
    .sort((a, b) => {
      if (a.additive !== b.additive) return a.additive ? -1 : 1;
      return a.expense_category.localeCompare(b.expense_category);
    });
}

/**
 * Count and sum for each measure type present. Non-additive detail is excluded
 * by default (pass `includeNonAdditive` only for a labelled non-additive
 * block). These per-type totals are the only totals that are safe to add up,
 * and only within a single type. Never sum across types.
 */
export function perMeasureTypeTotals(
  measures: readonly Pick<LeanMeasure, 'amount_cents' | 'measure_type' | 'aggregation_role'>[],
  options: { includeNonAdditive?: boolean } = {},
): PerMeasureTypeTotal[] {
  const byType = new Map<MeasureDocument['measure_type'], { count: number; amounts: number[] }>();

  for (const measure of measures) {
    if (!options.includeNonAdditive && isNonAdditiveMeasure(measure)) continue;
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
  const additive = measures.filter(isAdditiveMeasure);
  const additiveTypes = [...new Set(additive.map((measure) => measure.measure_type))].sort();
  const mixed = additiveTypes.length > 1;
  const singleType = additiveTypes.length === 1 ? additiveTypes[0]! : null;

  return {
    count: measures.length,
    additive_count: additive.length,
    non_additive_count: measures.length - additive.length,
    measure_types: measureTypes,
    mixed,
    total_cents:
      additive.length === 0 || mixed
        ? null
        : sumCents(additive.map((measure) => measure.amount_cents)),
    total_measure_type: singleType,
    total_by_measure_type: perMeasureTypeTotals(additive),
  };
}

/**
 * Count and sum the ENTIRE match set in Mongo, independent of the page/row
 * limit. Region/state detail must never compute a headline total from the
 * capped `measures` page: a 34,000-row source would otherwise be reported as a
 * 2,000-row partial total. `measures` is for row display only.
 *
 * Semantics are identical to `summarizeMeasures`: only additive rows feed
 * totals, a headline total exists only when exactly one additive measure type
 * is present, and per-type totals are never added together.
 */
export async function summarizeMeasureQuery(
  baseQuery: Record<string, unknown>,
): Promise<MeasureSummary> {
  const groups = await MeasureModel.aggregate<{
    _id: { measure_type: MeasureDocument['measure_type']; role: string };
    count: number;
    cents: number;
  }>([
    { $match: baseQuery },
    {
      $group: {
        _id: {
          measure_type: '$measure_type',
          role: { $ifNull: ['$aggregation_role', 'additive'] },
        },
        count: { $sum: 1 },
        cents: { $sum: '$amount_cents' },
      },
    },
  ]);

  const allTypes = new Set<MeasureDocument['measure_type']>();
  const additiveByType = new Map<
    MeasureDocument['measure_type'],
    { count: number; cents: number }
  >();
  let count = 0;
  let additiveCount = 0;
  let nonAdditiveCount = 0;

  for (const group of groups) {
    const { measure_type, role } = group._id;
    const groupCount = group.count ?? 0;
    const groupCents = group.cents ?? 0;
    if (!Number.isSafeInteger(groupCents)) {
      throw new Error('amount total exceeds safe integer range');
    }
    count += groupCount;
    allTypes.add(measure_type);
    if (role === 'additive' || role === 'expense_total') {
      additiveCount += groupCount;
      const entry = additiveByType.get(measure_type) ?? { count: 0, cents: 0 };
      entry.count += groupCount;
      entry.cents += groupCents;
      additiveByType.set(measure_type, entry);
    } else {
      nonAdditiveCount += groupCount;
    }
  }

  const additiveTypes = [...additiveByType.keys()].sort();
  const mixed = additiveTypes.length > 1;
  const singleType = additiveTypes.length === 1 ? additiveTypes[0]! : null;
  const additiveCents = [...additiveByType.values()].reduce((sum, entry) => sum + entry.cents, 0);
  if (!Number.isSafeInteger(additiveCents)) {
    throw new Error('amount total exceeds safe integer range');
  }

  return {
    count,
    additive_count: additiveCount,
    non_additive_count: nonAdditiveCount,
    measure_types: [...allTypes].sort(),
    mixed,
    total_cents: additiveCount === 0 || mixed ? null : additiveCents,
    total_measure_type: singleType,
    total_by_measure_type: [...additiveByType.entries()]
      .map(([measureType, entry]) => ({
        measure_type: measureType,
        count: entry.count,
        total_cents: entry.cents,
      }))
      .sort((a, b) => a.measure_type.localeCompare(b.measure_type)),
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
      const additiveRows = rows.filter(isAdditiveMeasure);
      const additiveTypes = [...new Set(additiveRows.map((row) => row.measure_type))].sort();
      const mixed = summary.mixed || additiveTypes.length > 1;
      return {
        region: region
          ? serializeRegion(region)
          : {
              _id: regionId,
              code: regionId,
              name: 'Unknown region',
              level: 'region' as const,
              slug: regionId,
            },
        measure_types: measureTypes,
        mixed,
        total_cents:
          additiveRows.length === 0 || mixed
            ? null
            : sumCents(additiveRows.map((row) => row.amount_cents)),
        total_by_measure_type: perMeasureTypeTotals(additiveRows),
        measures: rows.map(serializeMeasure),
      };
    })
    .sort((a, b) => a.region.code.localeCompare(b.region.code));
}
