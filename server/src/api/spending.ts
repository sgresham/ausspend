import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
import {
  SpendingQuerySchema,
  regionSlug,
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
import {
  expenseCategoryTotals,
  isAdditiveMeasure,
  perMeasureTypeTotals,
  type LeanMeasure,
  type LeanRegion,
} from './measure-summary.js';
import { areaQueries, buildAreaProfile, resolveRegion, type AreaProfile } from './area-profile.js';

type LeanFunction = FunctionDocument & { _id: mongoose.Types.ObjectId };

/**
 * The summary and both breakdowns only need these fields. Loading the whole
 * document for 100k+ contracts would materialise hundreds of megabytes per
 * request, so the whole-set pass is projected; the requested page is fetched
 * separately with Mongo skip/limit. API semantics are unchanged: the summary
 * still covers the entire filtered set and per-type totals are never summed
 * across measure types.
 */
type SummaryMeasure = Pick<
  LeanMeasure,
  | '_id'
  | 'amount_cents'
  | 'measure_type'
  | 'function_code'
  | 'region_id'
  | 'aggregation_role'
  | 'jurisdiction_level'
  | 'expense_category'
>;

const SUMMARY_PROJECTION = {
  amount_cents: 1,
  measure_type: 1,
  function_code: 1,
  region_id: 1,
  aggregation_role: 1,
  jurisdiction_level: 1,
  expense_category: 1,
} as const;

/** Escape a literal text filter so `.*`, `(` and friends match themselves. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

async function loadLookups(measures: readonly SummaryMeasure[]): Promise<Lookups> {
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
    ...(measure.aggregation_role ? { aggregation_role: measure.aggregation_role } : {}),
    ...(measure.extraction_confidence
      ? { extraction_confidence: measure.extraction_confidence }
      : {}),
    ...(measure.location ? { location: measure.location } : {}),
    ...(measure.expense_category ? { expense_category: measure.expense_category } : {}),
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

function sortedTypes(measures: readonly SummaryMeasure[]): LeanMeasure['measure_type'][] {
  return [...new Set(measures.map((measure) => measure.measure_type))].sort();
}

function breakdownByFunction(
  measures: readonly SummaryMeasure[],
  summaryMixed: boolean,
  lookups: Lookups,
): SpendingByFunction[] {
  const groups = new Map<string, SummaryMeasure[]>();
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
  measures: readonly SummaryMeasure[],
  summaryMixed: boolean,
  lookups: Lookups,
): SpendingByRegion[] {
  const groups = new Map<string, SummaryMeasure[]>();
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
              slug: regionId,
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
  measures: readonly SummaryMeasure[],
  lookups: Lookups,
): {
  count: number;
  additive_count: number;
  non_additive_count: number;
  currency: 'AUD';
  total_cents: number | null;
  total_measure_type: LeanMeasure['measure_type'] | null;
  total_by_measure_type: PerMeasureTypeTotal[];
  measure_types: LeanMeasure['measure_type'][];
  mixed: boolean;
  expense_categories?: ReturnType<typeof expenseCategoryTotals>;
  charity_expense_total_cents?: number | null;
  breakdown_by_function: SpendingByFunction[];
  breakdown_by_region: SpendingByRegion[];
} {
  const measureTypes = sortedTypes(measures);
  const additive = measures.filter(isAdditiveMeasure);
  const additiveTypes = sortedTypes(additive);
  const charityRows = measures.filter((measure) => measure.jurisdiction_level === 'charity');
  const otherRows = measures.filter((measure) => measure.jurisdiction_level !== 'charity');
  const mixesCharityAndOther = charityRows.length > 0 && otherRows.length > 0;
  const mixed = additiveTypes.length > 1 || mixesCharityAndOther;
  const singleType = additiveTypes.length === 1 ? additiveTypes[0]! : null;
  const expenseCategories = charityRows.length > 0 ? expenseCategoryTotals(charityRows) : undefined;
  const charityExpenseTotalCents =
    charityRows.length > 0
      ? (expenseCategories?.find((entry) => entry.expense_category === 'total')?.total_cents ??
        null)
      : undefined;

  return {
    count: measures.length,
    additive_count: additive.length,
    non_additive_count: measures.length - additive.length,
    currency: 'AUD',
    // A charity total and government spending are different populations and
    // are never merged, so a mixed match set has no headline total and no
    // combined per-type total.
    total_cents:
      additive.length === 0 || mixed
        ? null
        : sumCents(additive.map((measure) => measure.amount_cents)),
    total_measure_type: singleType,
    total_by_measure_type: mixesCharityAndOther ? [] : perMeasureTypeTotals(additive),
    measure_types: measureTypes,
    mixed,
    ...(expenseCategories ? { expense_categories: expenseCategories } : {}),
    ...(charityExpenseTotalCents !== undefined
      ? { charity_expense_total_cents: charityExpenseTotalCents }
      : {}),
    breakdown_by_function: breakdownByFunction(additive, mixed, lookups),
    breakdown_by_region: breakdownByRegion(additive, mixed, lookups),
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

  // Contract C: a 24-character _id filters exactly; a slug/name resolves to a
  // Region. A sub-state region (including Dubbo) switches to the shared area
  // profile and a multi-level row set. `area=<slug>` is an explicit alias.
  let regionId: mongoose.Types.ObjectId | undefined;
  let areaRegion: LeanRegion | null = null;
  if (query.area) {
    areaRegion = await resolveRegion(query.area);
    if (!areaRegion || areaRegion.level !== 'region') {
      throw notFound(`Unknown area: ${query.area}`);
    }
  } else if (query.region) {
    if (mongoose.isValidObjectId(query.region)) {
      regionId = new mongoose.Types.ObjectId(query.region);
      const exists = await RegionModel.exists({ _id: regionId });
      if (!exists) throw notFound(`Unknown region: ${query.region}`);
    } else {
      const resolved = await resolveRegion(query.region);
      if (!resolved) throw notFound(`Unknown region: ${query.region}`);
      if (resolved.level === 'region') areaRegion = resolved;
      else regionId = resolved._id;
    }
  }

  if (query.jurisdiction_level === 'soc') {
    throw badRequest(
      'SOC entity statements are exposed at /api/soc only, never in generic spending',
    );
  }
  const mongoQuery: Record<string, unknown> = {
    // ABS GFS benchmark rows are top-down statistical aggregates, never project
    // data. Keep them out of the generic spending query and every total; the
    // dedicated /api/benchmark endpoint reads them explicitly.
    aggregation_role: { $ne: 'benchmark' },
    // SOC entity statements are a separate layer and are never added to
    // government program spending or generic totals; /api/soc reads them.
    jurisdiction_level: { $ne: 'soc' },
  };
  if (query.fiscal_year) mongoQuery.fiscal_year = query.fiscal_year;
  if (query.measure_type) mongoQuery.measure_type = query.measure_type;
  if (query.jurisdiction_level) mongoQuery.jurisdiction_level = query.jurisdiction_level;
  if (query.state) mongoQuery['location.state'] = query.state.toUpperCase();
  if (query.postcode) mongoQuery['location.postcode'] = query.postcode;
  if (query.expense_category) mongoQuery.expense_category = query.expense_category;
  if (query.function) mongoQuery.function_code = query.function;
  if (regionId) mongoQuery.region_id = regionId;
  if (areaRegion)
    Object.assign(mongoQuery, areaQueries(areaRegion, areaRegion.parent_code ?? 'NSW').combined);
  if (query.q && query.q.length > 0) {
    // Literal, case-insensitive project/item text filter. Only the descriptive
    // project fields match: never notes or source_url, and never a total.
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    const textFilter = {
      $or: [{ project_name: pattern }, { description: pattern }, { delivery_entity: pattern }],
    };
    if (mongoQuery.$or) {
      // Area mode already uses $or; combine both with an explicit $and so the
      // text filter composes with every existing filter instead of replacing it.
      mongoQuery.$and = [{ $or: mongoQuery.$or }, textFilter];
      delete mongoQuery.$or;
    } else {
      Object.assign(mongoQuery, textFilter);
    }
  }
  if (query.min_amount !== undefined || query.max_amount !== undefined) {
    mongoQuery.amount_cents = {
      ...(query.min_amount !== undefined ? { $gte: query.min_amount } : {}),
      ...(query.max_amount !== undefined ? { $lte: query.max_amount } : {}),
    };
  }

  // The summary and breakdowns cover the whole filtered set, so load only the
  // fields they need. The requested page is a separate Mongo skip/limit query:
  // loading every full document into memory does not scale to 100k+ contracts.
  const matching = await MeasureModel.find(mongoQuery)
    .select(SUMMARY_PROJECTION)
    .lean<SummaryMeasure[]>();

  const lookups = await loadLookups(matching);

  let summary:
    | ReturnType<typeof buildSummary>
    | {
        count: number;
        additive_count: number;
        non_additive_count: number;
        currency: 'AUD';
        total_cents: null;
        total_measure_type: null;
        total_by_measure_type: PerMeasureTypeTotal[];
        measure_types: LeanMeasure['measure_type'][];
        mixed: true;
        breakdown_by_function: [];
        breakdown_by_region: [];
      };
  let areaProfile: AreaProfile | null = null;
  if (areaRegion) {
    // Never emit a cross-level or cross-type total in area mode.
    areaProfile = await buildAreaProfile(areaRegion);
    const areaAdditive = matching.filter(isAdditiveMeasure);
    summary = {
      count: matching.length,
      additive_count: areaAdditive.length,
      non_additive_count: matching.length - areaAdditive.length,
      currency: 'AUD',
      total_cents: null,
      total_measure_type: null,
      total_by_measure_type: [],
      measure_types: sortedTypes(matching),
      mixed: true,
      breakdown_by_function: [],
      breakdown_by_region: [],
    };
  } else {
    summary = buildSummary(matching, lookups);
  }

  const total = matching.length;
  const start = (query.page - 1) * query.page_size;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.page_size);
  const pageRows = await MeasureModel.find(mongoQuery)
    .sort(SORTS[query.sort])
    .skip(start)
    .limit(query.page_size)
    .lean<LeanMeasure[]>();

  const applied_filters: SpendingAppliedFilters = {
    fiscal_year: query.fiscal_year ?? null,
    measure_type: query.measure_type ?? null,
    jurisdiction_level: query.jurisdiction_level ?? null,
    state: query.state ?? null,
    postcode: query.postcode ?? null,
    expense_category: query.expense_category ?? null,
    function: query.function ?? null,
    q: query.q && query.q.length > 0 ? query.q : null,
    region: query.region ?? null,
    area: areaRegion ? regionSlug(areaRegion) : (query.area ?? null),
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
    ...(areaProfile ? { area_profile: areaProfile } : {}),
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
