import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
import { FunctionModel, RegionModel } from '../models/index.js';
import { badRequest, notFound } from './errors.js';
import { measureQuery, parseMeasureFilters, sumCents, type MeasureFilters } from './filters.js';
import {
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

async function loadRegionMeasures(
  region: LeanRegion,
  filters: MeasureFilters,
): Promise<LeanMeasure[]> {
  return MeasureModel.find({ ...measureQuery(filters), region_id: region._id })
    .sort({ fiscal_year: 1, function_code: 1, measure_type: 1 })
    .limit(filters.limit)
    .lean<LeanMeasure[]>();
}

async function groupByFunction(measures: readonly LeanMeasure[], mixed: boolean) {
  const functions = await FunctionModel.find({
    code: { $in: [...new Set(measures.map((measure) => measure.function_code))] },
  }).lean<Array<FunctionDocument & { _id: mongoose.Types.ObjectId }>>();
  const byCode = new Map(functions.map((fn) => [fn.code, fn]));

  const groups = new Map<string, LeanMeasure[]>();
  for (const measure of measures) {
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

async function regionDetail(region: LeanRegion, filters: MeasureFilters) {
  const measures = await loadRegionMeasures(region, filters);
  const summary = summarizeMeasures(measures);

  return {
    region: serializeRegion(region),
    filters: {
      fiscal_year: filters.fiscal_year ?? null,
      measure_type: filters.measure_type ?? null,
      limit: filters.limit,
    },
    ...summary,
    by_function: await groupByFunction(measures, summary.mixed),
    measures: measures.map(serializeMeasure),
  };
}

export const getRegion: RequestHandler = async (req, res) => {
  const regionId = req.params.regionId as string;
  if (!mongoose.isValidObjectId(regionId)) {
    throw badRequest('regionId must be a region _id (a 24-character hex id), not a code');
  }

  const region = await RegionModel.findById(regionId).lean<LeanRegion | null>();
  if (!region) {
    throw notFound(`Unknown region: ${regionId}`);
  }

  res.json(await regionDetail(region, parseMeasureFilters(req.query)));
};

export const getState: RequestHandler = async (req, res) => {
  const code = (req.params.code as string).toUpperCase();
  const filters = parseMeasureFilters(req.query);

  const region = await RegionModel.findOne({ code, level: 'state' }).lean<LeanRegion | null>();
  if (!region) {
    throw notFound(`Unknown state/territory code: ${code}`);
  }

  const detail = await regionDetail(region, filters);
  res.json({ state: detail.region, ...detail, region: detail.region });
};
