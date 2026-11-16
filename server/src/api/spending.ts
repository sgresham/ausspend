import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
import {
  SpendingQuerySchema,
  type PerMeasureTypeTotal,
  type SpendingAppliedFilters,
  type SpendingByFunction,
  type SpendingByRegion,
  type SpendingMeasureRow,
  type SpendingSort,
} from '@ausspend/shared';
import {
  FunctionModel,
  MeasureModel,
  RegionModel,
  type FunctionDocument,
} from '../models/index.js';
import { badRequest, notFound } from './errors.js';
import { sumCents } from './filters.js';
import { perMeasureTypeTotals, type LeanMeasure, type LeanRegion } from './measure-summary.js';

type LeanFunction = FunctionDocument & { _id: mongoose.Types.ObjectId };

const SORTS: Record<SpendingSort, Record<string, 1 | -1>> = {
  amount_desc: { amount_cents: -1, _id: 1 },
  amount_asc: { amount_cents: 1, _id: 1 },
  fiscal_year_desc: { fiscal_year: -1, amount_cents: -1, _id: 1 },
  fiscal_year_asc: { fiscal_year: 1, amount_cents: -1, _id: 1 },
};

interface Lookups {
  functions: Map<string, LeanFunction>;
  regions: Map<string, LeanRegion>;
}

async function loadLookups(measures: readonly LeanMeasure[]): Promise<Lookups> {
  const functionCodes = [
    ...new Set(
      measures
        .map((measure) => measure.function_code)
        .filter((code): code is string => Boolean(code)),
    ),
  ];
  const regionIds = [
    ...new Map(
      measures
        .filter((measure) => Boolean(measure.region_id))
        .map((measure) => [measure.region_id!.toString(), measure.region_id!]),
    ).values(),
  ];

  const [functions, regions] = await Promise.all([
    functionCodes.length > 0
      ? FunctionModel.find({ code: { $in: functionCodes } }).lean<LeanFunction[]>()
      : Promise.resolve([] as LeanFunction[]),
    regionIds.length > 0
      ? RegionModel.find({ _id: { $in: regionIds } }).lean<LeanRegion[]>()
      : Promise.resolve([] as LeanRegion[]),
  ]);

  return {
    functions: new Map(functions.map((fn) => [fn.code, fn])),
    regions: new Map(regions.map((region) => [region._id.toString(), region])),
  };
}

function serializeSpendingRow(measure: LeanMeasure, lookups: Lookups): SpendingMeasureRow {
  const fn = measure.function_code ? lookups.functions.get(measure.function_code) : undefined;
  const region = measure.region_id ? lookups.regions.get(measure.region_id.toString()) : undefined;

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
    function_name: fn?.name ?? null,
    function_level: fn?.level ?? null,
    ...(fn?.parent_code ? { function_parent_code: fn.parent_code } : {}),
    region_code: region?.code ?? null,
    region_name: region?.name ?? null,
    region_level: region?.level ?? null,
    provenance: {
      source_id: measure.source_id,
      source_url: measure.source_url,
      verified: measure.verified,
      ...(measure.notes ? { notes: measure.notes } : {}),
    },
  };
}

function sortedTypes(measures: readonly LeanMeasure[]): LeanMeasure['measure_type'][] {
  return [...new Set(measures.map((measure) => measure.measure_type))].sort();
}

function breakdownByFunction(
  measures: readonly LeanMeasure[],
  summaryMixed: boolean,
  lookups: Lookups,
): SpendingByFunction[] {
  const groups = new Map<string, LeanMeasure[]>();
  for (const measure of measures) {
    if (!measure.function_code) continue;
    const group = groups.get(measure.function_code) ?? [];
    group.push(measure);
    groups.set(measure.function_code, group);
  }

  return [...groups.entries()]
    .map(([code, rows]) => {
      const fn = lookups.functions.get(code);
      const measureTypes = sortedTypes(rows);
      const mixed = summaryMixed || measureTypes.length > 1;
      return {
        function: {
          code,
          name: fn?.name ?? code,
          level: fn?.level ?? 'division',
          ...(fn?.parent_code ? { parent_code: fn.parent_code } : {}),
        },
        count: rows.length,
        measure_types: measureTypes,
        mixed,
        total_cents: mixed ? null : sumCents(rows.map((row) => row.amount_cents)),
        total_by_measure_type: perMeasureTypeTotals(rows),
      };
    })
    .sort((a, b) => a.function.code.localeCompare(b.function.code));
}

function breakdownByRegion(
  measures: readonly LeanMeasure[],
  summaryMixed: boolean,
  lookups: Lookups,
): SpendingByRegion[] {
  const groups = new Map<string, LeanMeasure[]>();
  for (const measure of measures) {
    if (!measure.region_id) continue;
    const key = measure.region_id.toString();
    const group = groups.get(key) ?? [];
    group.push(measure);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([regionId, rows]) => {
      const region = lookups.regions.get(regionId);
      const measureTypes = sortedTypes(rows);
      const mixed = summaryMixed || measureTypes.length > 1;
      return {
        region: region
          ? {
              _id: region._id.toString(),
              code: region.code,
              name: region.name,
              level: region.level,
              ...(region.parent_code ? { parent_code: region.parent_code } : {}),
            }
          : {
              _id: regionId,
              code: regionId,
              name: 'Unknown region',
              level: 'region' as const,
            },
        count: rows.length,
        measure_types: measureTypes,
        mixed,
        total_cents: mixed ? null : sumCents(rows.map((row) => row.amount_cents)),
        total_by_measure_type: perMeasureTypeTotals(rows),
      };
    })
    .sort((a, b) => a.region.code.localeCompare(b.region.code));
}

function buildSummary(
  measures: readonly LeanMeasure[],
  lookups: Lookups,
): {
  count: number;
  currency: 'AUD';
  total_cents: number | null;
  total_measure_type: LeanMeasure['measure_type'] | null;
  total_by_measure_type: PerMeasureTypeTotal[];
  measure_types: LeanMeasure['measure_type'][];
  mixed: boolean;
  breakdown_by_function: SpendingByFunction[];
  breakdown_by_region: SpendingByRegion[];
} {
  const measureTypes = sortedTypes(measures);
  const mixed = measureTypes.length > 1;
  const singleType = measureTypes.length === 1 ? measureTypes[0]! : null;

  return {
    count: measures.length,
    currency: 'AUD',
    total_cents: mixed ? null : sumCents(measures.map((measure) => measure.amount_cents)),
    total_measure_type: singleType,
    total_by_measure_type: perMeasureTypeTotals(measures),
    measure_types: measureTypes,
    mixed,
    breakdown_by_function: breakdownByFunction(measures, mixed, lookups),
    breakdown_by_region: breakdownByRegion(measures, mixed, lookups),
  };
}

/**
 * GET /api/spending — filtered, sorted, paginated search. The summary is
 * computed over the whole filtered set (not just the requested page), so the
 * client can render headline/per-type totals and breakdowns without extra
 * requests. Mixed responses keep `total_cents: null` and only expose per-type
 * totals; no total is ever summed across measure types. Rows without a curated
 * region/function are returned with those fields null and omitted from the
 * region/function breakdowns rather than assigned invented codes.
 */
export const listSpending: RequestHandler = async (req, res) => {
  const parsed = SpendingQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid spending query');
  }
  const query = parsed.data;

  if (query.function) {
    const exists = await FunctionModel.exists({ code: query.function });
    if (!exists) throw notFound(`Unknown function code: ${query.function}`);
  }

  let regionId: mongoose.Types.ObjectId | undefined;
  if (query.region) {
    regionId = new mongoose.Types.ObjectId(query.region);
    const exists = await RegionModel.exists({ _id: regionId });
    if (!exists) throw notFound(`Unknown region: ${query.region}`);
  }

  const mongoQuery: Record<string, unknown> = {};
  if (query.fiscal_year) mongoQuery.fiscal_year = query.fiscal_year;
  if (query.measure_type) mongoQuery.measure_type = query.measure_type;
  if (query.jurisdiction_level) mongoQuery.jurisdiction_level = query.jurisdiction_level;
  if (query.function) mongoQuery.function_code = query.function;
  if (regionId) mongoQuery.region_id = regionId;
  if (query.min_amount !== undefined || query.max_amount !== undefined) {
    mongoQuery.amount_cents = {
      ...(query.min_amount !== undefined ? { $gte: query.min_amount } : {}),
      ...(query.max_amount !== undefined ? { $lte: query.max_amount } : {}),
    };
  }

  // Phase 1 bounds the result set by the dataset itself (hundreds of synthetic
  // rows). Fetch all matching rows once so the summary covers the whole filtered
  // set, then slice the requested page in memory.
  const matching = await MeasureModel.find(mongoQuery)
    .sort(SORTS[query.sort])
    .lean<LeanMeasure[]>();

  const lookups = await loadLookups(matching);
  const summary = buildSummary(matching, lookups);

  const total = matching.length;
  const start = (query.page - 1) * query.page_size;
  const pageRows = matching.slice(start, start + query.page_size);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.page_size);

  const applied_filters: SpendingAppliedFilters = {
    fiscal_year: query.fiscal_year ?? null,
    measure_type: query.measure_type ?? null,
    jurisdiction_level: query.jurisdiction_level ?? null,
    function: query.function ?? null,
    region: query.region ?? null,
    min_amount: query.min_amount ?? null,
    max_amount: query.max_amount ?? null,
    sort: query.sort,
  };

  res.json({
    data: pageRows.map((measure) => serializeSpendingRow(measure, lookups)),
    summary,
    pagination: {
      page: query.page,
      page_size: query.page_size,
      total,
      total_pages: totalPages,
      has_next: query.page < totalPages,
    },
    applied_filters,
  });
};

/** GET /api/spending/:id — one row in the same shape as a list data row. */
export const getSpending: RequestHandler = async (req, res) => {
  const id = req.params.id as string;
  if (!mongoose.isValidObjectId(id)) {
    throw badRequest('id must be a 24-character measure _id');
  }

  const measure = await MeasureModel.findById(id).lean<LeanMeasure | null>();
  if (!measure) {
    throw notFound(`Unknown measure: ${id}`);
  }

  const lookups = await loadLookups([measure]);
  res.json(serializeSpendingRow(measure, lookups));
};
