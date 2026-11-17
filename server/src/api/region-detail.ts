import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
import { FunctionModel, RegionModel } from '../models/index.js';
import { notFound } from './errors.js';
import { measureQuery, parseMeasureFilters, sumCents, type MeasureFilters } from './filters.js';
import {
  isAdditiveMeasure,
  perMeasureTypeTotals,
  serializeMeasure,
  serializeRegion,
  summarizeMeasures,
  type LeanMeasure,
  type LeanRegion,
  type MeasureRow,
} from './measure-summary.js';
import { MeasureModel } from '../models/index.js';
import type { FunctionDocument } from '../models/index.js';
import { areaQueries, buildAreaProfile, resolveRegion, type AreaProfile } from './area-profile.js';

async function loadRegionMeasures(
  region: LeanRegion,
  filters: MeasureFilters,
  stateCode?: string,
): Promise<LeanMeasure[]> {
  const regionMatch = stateCode
    ? { $or: [{ region_id: region._id }, { 'location.state': stateCode }] }
    : { region_id: region._id };
  return MeasureModel.find({ ...measureQuery(filters), ...regionMatch })
    .sort({ fiscal_year: 1, function_code: 1, measure_type: 1 })
    .limit(filters.limit)
    .lean<LeanMeasure[]>();
}

async function groupByFunction(measures: readonly LeanMeasure[], mixed: boolean) {
  const withFunction = measures.filter(
    (measure): measure is LeanMeasure & { function_code: string } =>
      Boolean(measure.function_code) && isAdditiveMeasure(measure),
  );
  const functions = await FunctionModel.find({
    code: { $in: [...new Set(withFunction.map((measure) => measure.function_code))] },
  }).lean<Array<FunctionDocument & { _id: mongoose.Types.ObjectId }>>();
  const byCode = new Map(functions.map((fn) => [fn.code, fn]));

  const groups = new Map<string, LeanMeasure[]>();
  for (const measure of withFunction) {
    const group = groups.get(measure.function_code) ?? [];
    group.push(measure);
    groups.set(measure.function_code, group);
  }

  return [...groups.entries()]
    .map(([code, rows]) => {
      const fn = byCode.get(code);
      const measureTypes = [...new Set(rows.map((row) => row.measure_type))].sort();
      const groupMixed = mixed || measureTypes.length > 1;
      return {
        function: {
          code,
          name: fn?.name ?? code,
          level: fn?.level ?? 'division',
          ...(fn?.parent_code ? { parent_code: fn.parent_code } : {}),
        },
        measure_types: measureTypes,
        mixed: groupMixed,
        total_cents: groupMixed ? null : sumCents(rows.map((row) => row.amount_cents)),
        total_by_measure_type: perMeasureTypeTotals(rows),
        measures: rows.map(serializeMeasure) satisfies MeasureRow[],
      };
    })
    .sort((a, b) => a.function.code.localeCompare(b.function.code));
}

const NON_ADDITIVE_ROLES = ['agency_detail', 'policy_measure'] as const;
type NonAdditiveRole = (typeof NON_ADDITIVE_ROLES)[number];

const NON_ADDITIVE_LABELS: Record<NonAdditiveRole, { label: string; description: string }> = {
  agency_detail: {
    label: 'Agency detail — not additive',
    description:
      'A single agency statement overlaps the consolidated series; it is excluded from every additive total.',
  },
  policy_measure: {
    label: 'Policy measures — not additive',
    description:
      'BP4 policy measures overlap the BP3 capital program (some projects appear in both); they are excluded from every additive total.',
  },
};

/**
 * Non-additive detail is grouped by role and listed separately. It is never
 * added to the headline total; each block carries its own explicit label.
 */
function nonAdditiveBlock(role: NonAdditiveRole, measures: readonly LeanMeasure[]) {
  const detail = measures.filter(
    (measure) => !isAdditiveMeasure(measure) && measure.aggregation_role === role,
  );
  const measureTypes = [...new Set(detail.map((measure) => measure.measure_type))].sort();
  const mixed = measureTypes.length > 1;
  const copy = NON_ADDITIVE_LABELS[role];
  return {
    label: copy.label,
    description: copy.description,
    aggregation_role: role,
    count: detail.length,
    mixed,
    total_cents:
      detail.length === 0 || mixed ? null : sumCents(detail.map((measure) => measure.amount_cents)),
    total_by_measure_type: perMeasureTypeTotals(detail, { includeNonAdditive: true }),
    measures: detail.map(serializeMeasure),
  };
}

function nonAdditiveBlocks(measures: readonly LeanMeasure[]) {
  return NON_ADDITIVE_ROLES.map((role) => nonAdditiveBlock(role, measures)).filter(
    (block) => block.count > 0,
  );
}

async function regionDetail(region: LeanRegion, filters: MeasureFilters, stateCode?: string) {
  const measures = await loadRegionMeasures(region, filters, stateCode);
  const summary = summarizeMeasures(measures);
  const additiveMeasures = measures.filter(isAdditiveMeasure);

  return {
    region: serializeRegion(region),
    filters: {
      fiscal_year: filters.fiscal_year ?? null,
      measure_type: filters.measure_type ?? null,
      limit: filters.limit,
    },
    ...summary,
    by_function: await groupByFunction(additiveMeasures, summary.mixed),
    measures: measures.map(serializeMeasure),
    non_additive: nonAdditiveBlocks(measures),
    // Backwards-compatible single block for the VIC agency-detail UI.
    agency_detail: nonAdditiveBlock('agency_detail', measures),
  };
}

export interface AreaDetail {
  region: ReturnType<typeof serializeRegion>;
  filters: { fiscal_year: string | null; measure_type: string | null; limit: number };
  count: number;
  measure_types: LeanMeasure['measure_type'][];
  mixed: true;
  total_cents: null;
  total_measure_type: null;
  total_by_measure_type: [];
  by_function: [];
  measures: ReturnType<typeof serializeMeasure>[];
  area_profile: AreaProfile | null;
}

async function areaDetail(region: LeanRegion, filters: MeasureFilters): Promise<AreaDetail> {
  const queries = areaQueries(region, region.parent_code ?? 'NSW');
  const base = measureQuery(filters);
  const [measures, count, profile] = await Promise.all([
    MeasureModel.find({ ...queries.combined, ...base })
      .sort({ jurisdiction_level: 1, fiscal_year: 1, measure_type: 1 })
      .limit(filters.limit)
      .lean<LeanMeasure[]>(),
    MeasureModel.countDocuments({ ...queries.combined, ...base }),
    buildAreaProfile(region),
  ]);
  const measureTypes = [...new Set(measures.map((measure) => measure.measure_type))].sort();
  return {
    region: serializeRegion(region),
    filters: {
      fiscal_year: filters.fiscal_year ?? null,
      measure_type: filters.measure_type ?? null,
      limit: filters.limit,
    },
    count,
    measure_types: measureTypes,
    mixed: true,
    total_cents: null,
    total_measure_type: null,
    total_by_measure_type: [],
    by_function: [],
    measures: measures.map(serializeMeasure),
    area_profile: profile,
  };
}

/**
 * GET /api/regions/:regionId. A 24-character _id is filtered exactly as before;
 * a slug/name resolves case-insensitively. A sub-state region returns the
 * shared area profile (contract C); national/state regions keep the existing
 * region detail shape.
 */
export const getRegion: RequestHandler = async (req, res) => {
  const raw = req.params.regionId as string;
  const region = await resolveRegion(raw);
  if (!region) {
    throw notFound(`Unknown region: ${raw}`);
  }
  const filters = parseMeasureFilters(req.query);
  if (region.level === 'region') {
    res.json(await areaDetail(region, filters));
    return;
  }
  res.json(await regionDetail(region, filters));
};

/** GET /api/areas/:slug — the same profile object as /api/regions/<slug>. */
export const getArea: RequestHandler = async (req, res) => {
  const slug = req.params.slug as string;
  const region = await resolveRegion(slug);
  if (!region || region.level !== 'region') {
    throw notFound(`Unknown area: ${slug}`);
  }
  res.json(await areaDetail(region, parseMeasureFilters(req.query)));
};

export const getState: RequestHandler = async (req, res) => {
  const code = (req.params.code as string).toUpperCase();
  const filters = parseMeasureFilters(req.query);

  const region = await RegionModel.findOne({ code, level: 'state' }).lean<LeanRegion | null>();
  if (!region) {
    throw notFound(`Unknown state/territory code: ${code}`);
  }

  const detail = await regionDetail(region, filters, code);
  res.json({ state: detail.region, ...detail, region: detail.region });
};
