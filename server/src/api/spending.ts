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
import { AIHW_SOURCE_ID, sumCents } from './filters.js';
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
  | 'fiscal_year'
  | 'measure_type'
  | 'function_code'
  | 'region_id'
  | 'aggregation_role'
  | 'jurisdiction_level'
  | 'expense_category'
>;

const SUMMARY_PROJECTION = {
  amount_cents: 1,
  // Needed to reproduce the fiscal_year sorts locally when the requested page
  // is sliced out of the already-loaded filtered set.
  fiscal_year: 1,
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

/** Maximum number of whitespace-separated words considered from one q value. */
const MAX_Q_TOKENS = 8;
/** Longest single token; the schema already caps the whole q at 100 characters. */
const MAX_Q_TOKEN_LENGTH = 100;

/**
 * Split the project/item text box into case-insensitive words. Repeated words
 * are collapsed and the list is bounded so a hostile q cannot fan out into an
 * unbounded number of regex clauses. Word order is irrelevant: every token is
 * matched independently against the descriptive fields.
 */
function tokenizeQuery(value: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const raw of value.trim().split(/\s+/)) {
    const token = raw.slice(0, MAX_Q_TOKEN_LENGTH).toLowerCase();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
    if (tokens.length >= MAX_Q_TOKENS) break;
  }
  return tokens;
}

const SORTS: Record<SpendingSort, Record<string, 1 | -1>> = {
  amount_desc: { amount_cents: -1, _id: 1 },
  amount_asc: { amount_cents: 1, _id: 1 },
  fiscal_year_desc: { fiscal_year: -1, amount_cents: -1, _id: 1 },
  fiscal_year_asc: { fiscal_year: 1, amount_cents: -1, _id: 1 },
};

/** Literal substring filter: every token must occur in one descriptive field. */
function applyRegexTextFilters(
  base: Record<string, unknown>,
  tokens: string[],
): Record<string, unknown> {
  const query = { ...base };
  const filters = tokens.map((token) => {
    const pattern = new RegExp(escapeRegex(token), 'i');
    return {
      $or: [{ project_name: pattern }, { description: pattern }, { delivery_entity: pattern }],
    };
  });
  if (filters.length === 0) return query;
  if (query.$or) {
    query.$and = [{ $or: query.$or }, ...filters];
    delete query.$or;
  } else if (filters.length === 1) {
    Object.assign(query, filters[0]);
  } else {
    query.$and = filters;
  }
  return query;
}

/** Index-backed text filter: every quoted token must occur (AND across tokens). */
function applyTextSearch(base: Record<string, unknown>, tokens: string[]): Record<string, unknown> {
  const query = { ...base };
  const textClause = { $text: { $search: tokens.map((token) => `"${token}"`).join(' ') } };
  if (query.$or) {
    query.$and = [{ $or: query.$or }, textClause];
    delete query.$or;
  } else {
    query.$and = [textClause];
  }
  return query;
}

/** A fresh database may not have finished building the text index yet. */
function isMissingTextIndex(error: unknown): boolean {
  const candidate = error as { code?: number; codeName?: string; message?: string };
  return (
    candidate?.code === 27 ||
    candidate?.codeName === 'IndexNotFound' ||
    (typeof candidate?.message === 'string' && candidate.message.includes('text index required'))
  );
}

/**
 * Reproduce Mongo's sort for the four documented sorts over the filtered set
 * that is already in memory. `_id` compares as its hex string, which preserves
 * ObjectId byte order. A missing value never occurs for `amount_cents` or
 * `fiscal_year` (both required), so field ordering matches the server exactly.
 */
function compareMeasures(a: SummaryMeasure, b: SummaryMeasure, sort: SpendingSort): number {
  for (const [field, direction] of Object.entries(SORTS[sort])) {
    let order: number;
    if (field === '_id') {
      const aId = a._id.toString();
      const bId = b._id.toString();
      order = aId < bId ? -1 : aId > bId ? 1 : 0;
    } else if (field === 'amount_cents') {
      order = a.amount_cents < b.amount_cents ? -1 : a.amount_cents > b.amount_cents ? 1 : 0;
    } else if (field === 'fiscal_year') {
      order = a.fiscal_year < b.fiscal_year ? -1 : a.fiscal_year > b.fiscal_year ? 1 : 0;
    } else {
      continue;
    }
    if (order !== 0) return direction === 1 ? order : -order;
  }
  return 0;
}

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
    ...(measure.project_id ? { project_id: measure.project_id } : {}),
    ...(measure.agency ? { agency: measure.agency } : {}),
    ...(measure.sector ? { sector: measure.sector } : {}),
    ...(measure.cluster ? { cluster: measure.cluster } : {}),
    ...(measure.electorate ? { electorate: measure.electorate } : {}),
    ...(measure.region ? { region: measure.region } : {}),
    ...(measure.lga ? { lga: measure.lga } : {}),
    ...(measure.status ? { status: measure.status } : {}),
    ...(measure.category ? { category: measure.category } : {}),
    ...(measure.budget_year ? { budget_year: measure.budget_year } : {}),
    ...(measure.expense_category ? { expense_category: measure.expense_category } : {}),
    ...(measure.unspsc ? { unspsc: measure.unspsc } : {}),
    ...(measure.statement ? { statement: measure.statement } : {}),
    ...(measure.reconciliation_status
      ? { reconciliation_status: measure.reconciliation_status }
      : {}),
    ...(measure.vlgc_section ? { vlgc_section: measure.vlgc_section } : {}),
    ...(measure.vlgc_measure ? { vlgc_measure: measure.vlgc_measure } : {}),
    ...(measure.vlgc_function ? { vlgc_function: measure.vlgc_function } : {}),
    ...(measure.vlgc_function_code ? { vlgc_function_code: measure.vlgc_function_code } : {}),
    ...(measure.vlgc_nature ? { vlgc_nature: measure.vlgc_nature } : {}),
    ...(measure.vlgc_line_code ? { vlgc_line_code: measure.vlgc_line_code } : {}),
    ...(measure.vlgc_council_label ? { vlgc_council_label: measure.vlgc_council_label } : {}),
    ...(measure.vlgc_unit ? { vlgc_unit: measure.vlgc_unit } : {}),
    ...(measure.vlgc_printed_sign ? { vlgc_printed_sign: measure.vlgc_printed_sign } : {}),
    ...(measure.aihw_broad_source_of_funding
      ? { aihw_broad_source_of_funding: measure.aihw_broad_source_of_funding }
      : {}),
    ...(measure.aihw_area_of_expenditure
      ? { aihw_area_of_expenditure: measure.aihw_area_of_expenditure }
      : {}),
    ...(measure.aihw_printed_sign ? { aihw_printed_sign: measure.aihw_printed_sign } : {}),
    ...(measure.aihw_unit ? { aihw_unit: measure.aihw_unit } : {}),
    ...(measure.wa_budget_measure ? { wa_budget_measure: measure.wa_budget_measure } : {}),
    ...(measure.wa_budget_table ? { wa_budget_table: measure.wa_budget_table } : {}),
    ...(measure.wa_printed_sign ? { wa_printed_sign: measure.wa_printed_sign } : {}),
    ...(measure.tas_budget_table ? { tas_budget_table: measure.tas_budget_table } : {}),
    ...(measure.tas_budget_column ? { tas_budget_column: measure.tas_budget_column } : {}),
    ...(measure.tas_budget_unit ? { tas_budget_unit: measure.tas_budget_unit } : {}),
    ...(measure.qld_lg_measure ? { qld_lg_measure: measure.qld_lg_measure } : {}),
    ...(measure.qld_lg_unit ? { qld_lg_unit: measure.qld_lg_unit } : {}),
    ...(measure.qld_lg_component_of ? { qld_lg_component_of: measure.qld_lg_component_of } : {}),
    ...(measure.aihw_detailed_source_of_funding
      ? { aihw_detailed_source_of_funding: measure.aihw_detailed_source_of_funding }
      : {}),
    ...(measure.aihw_state ? { aihw_state: measure.aihw_state } : {}),
    ...(measure.aihw_funding_sector ? { aihw_funding_sector: measure.aihw_funding_sector } : {}),
    ...(measure.aihw_price_basis ? { aihw_price_basis: measure.aihw_price_basis } : {}),
    ...(measure.aihw_table ? { aihw_table: measure.aihw_table } : {}),
    ...(measure.aihw_release ? { aihw_release: measure.aihw_release } : {}),
    ...(measure.sa_gpc_code ? { sa_gpc_code: measure.sa_gpc_code } : {}),
    ...(measure.sa_gpc_description ? { sa_gpc_description: measure.sa_gpc_description } : {}),
    ...(measure.sa_economic_type_code
      ? { sa_economic_type_code: measure.sa_economic_type_code }
      : {}),
    ...(measure.sa_economic_type_description
      ? { sa_economic_type_description: measure.sa_economic_type_description }
      : {}),
    ...(measure.sa_unit ? { sa_unit: measure.sa_unit } : {}),
    ...(measure.sa_printed_sign ? { sa_printed_sign: measure.sa_printed_sign } : {}),
    ...(measure.sa_year_basis ? { sa_year_basis: measure.sa_year_basis } : {}),
    ...(measure.act_dataset_id ? { act_dataset_id: measure.act_dataset_id } : {}),
    ...(measure.act_project_classification
      ? { act_project_classification: measure.act_project_classification }
      : {}),
    ...(measure.act_project_type ? { act_project_type: measure.act_project_type } : {}),
    ...(measure.act_wellbeing_domain ? { act_wellbeing_domain: measure.act_wellbeing_domain } : {}),
    ...(measure.act_region ? { act_region: measure.act_region } : {}),
    ...(measure.act_unit ? { act_unit: measure.act_unit } : {}),
    ...(measure.act_printed_sign ? { act_printed_sign: measure.act_printed_sign } : {}),
    ...(measure.nt_cofog_category ? { nt_cofog_category: measure.nt_cofog_category } : {}),
    ...(measure.nt_unit ? { nt_unit: measure.nt_unit } : {}),
    ...(measure.nt_percent_share !== undefined
      ? { nt_percent_share: measure.nt_percent_share }
      : {}),
    ...(measure.nt_table ? { nt_table: measure.nt_table } : {}),
    ...(measure.performance_value !== undefined
      ? { performance_value: measure.performance_value }
      : {}),
    ...(measure.performance_value_text
      ? { performance_value_text: measure.performance_value_text }
      : {}),
    ...(measure.performance_unit ? { performance_unit: measure.performance_unit } : {}),
    ...(measure.performance_indicator_code
      ? { performance_indicator_code: measure.performance_indicator_code }
      : {}),
    ...(measure.performance_indicator_name
      ? { performance_indicator_name: measure.performance_indicator_name }
      : {}),
    ...(measure.performance_indicator_group
      ? { performance_indicator_group: measure.performance_indicator_group }
      : {}),
    ...(measure.performance_service_provided
      ? { performance_service_provided: measure.performance_service_provided }
      : {}),
    ...(measure.performance_data_applicable
      ? { performance_data_applicable: measure.performance_data_applicable }
      : {}),
    ...(measure.performance_council_label
      ? { performance_council_label: measure.performance_council_label }
      : {}),
    ...(measure.performance_non_additive !== undefined
      ? { performance_non_additive: measure.performance_non_additive }
      : {}),
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
  let mongoQuery: Record<string, unknown> = {
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
  if (query.source_id) {
    mongoQuery.source_id = query.source_id;
  } else {
    // AIHW is a historical, non-additive state x area x funding matrix. Keep
    // 1997-98 rows out of the default function/search pages; an explicit
    // ?source_id=aihw-health-expenditure still reads them.
    mongoQuery.source_id = { $ne: AIHW_SOURCE_ID };
  }
  if (regionId) mongoQuery.region_id = regionId;
  if (areaRegion)
    Object.assign(mongoQuery, areaQueries(areaRegion, areaRegion.parent_code ?? 'NSW').combined);
  if (query.min_amount !== undefined || query.max_amount !== undefined) {
    mongoQuery.amount_cents = {
      ...(query.min_amount !== undefined ? { $gte: query.min_amount } : {}),
      ...(query.max_amount !== undefined ? { $lte: query.max_amount } : {}),
    };
  }

  // `baseQuery` is the filter without q, kept so the literal regex path can be
  // rebuilt if the text index is not available yet.
  const baseQuery = mongoQuery;
  let textSearchTokens: string[] | null = null;
  if (query.q && query.q.length > 0) {
    // Tokenised project/item text filter: every whitespace-separated word must
    // occur in at least one of the project fields (AND across words, OR across
    // fields). Only the descriptive project fields match: never notes or
    // source_url, and never a total.
    const tokens = tokenizeQuery(query.q);
    // A MongoDB text index matches whole words, not arbitrary substrings. Use
    // it for ordinary word tokens (the overwhelming majority of searches) and
    // keep the literal regex path for tokens that contain punctuation, so
    // regex metacharacters are still treated literally.
    const textSafe = tokens.length > 0 && tokens.every((token) => /^[a-z0-9_-]+$/.test(token));
    if (textSafe) {
      textSearchTokens = tokens;
      mongoQuery = applyTextSearch(baseQuery, tokens);
    } else if (tokens.length > 0) {
      mongoQuery = applyRegexTextFilters(baseQuery, tokens);
    }
  }

  const start = (query.page - 1) * query.page_size;

  // One pass over the filtered set. When the text index answers q, a single
  // $facet returns the summary fields and the requested page from one
  // index-backed match. Otherwise load the projected filtered set once and
  // derive the page from it, instead of asking Mongo to scan and sort the whole
  // collection a second time. Counts, pagination, response shape and sort order
  // are unchanged by either route.
  let matching: SummaryMeasure[];
  let pageRows: LeanMeasure[];
  let facets: { summary: SummaryMeasure[]; page: LeanMeasure[] } | undefined;
  if (textSearchTokens) {
    try {
      [facets] = await MeasureModel.aggregate<{
        summary: SummaryMeasure[];
        page: LeanMeasure[];
      }>([
        { $match: mongoQuery },
        {
          $facet: {
            summary: [{ $project: SUMMARY_PROJECTION }],
            page: [{ $sort: SORTS[query.sort] }, { $skip: start }, { $limit: query.page_size }],
          },
        },
      ]).allowDiskUse(true);
    } catch (error) {
      if (!isMissingTextIndex(error)) throw error;
      // Fresh database / index still building: fall back to the literal path.
      textSearchTokens = null;
      mongoQuery = applyRegexTextFilters(baseQuery, tokenizeQuery(query.q ?? ''));
    }
  }

  if (facets) {
    matching = facets.summary ?? [];
    pageRows = facets.page ?? [];
  } else {
    matching = await MeasureModel.find(mongoQuery)
      .select(SUMMARY_PROJECTION)
      .lean<SummaryMeasure[]>();
    const ordered = [...matching].sort((a, b) => compareMeasures(a, b, query.sort));
    const pageIds = ordered.slice(start, start + query.page_size).map((measure) => measure._id);
    const pageDocs =
      pageIds.length > 0
        ? await MeasureModel.find({ _id: { $in: pageIds } }).lean<LeanMeasure[]>()
        : [];
    const pageById = new Map(pageDocs.map((measure) => [measure._id.toString(), measure]));
    pageRows = pageIds
      .map((id) => pageById.get(id.toString()))
      .filter((measure): measure is LeanMeasure => Boolean(measure));
  }

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
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.page_size);

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
