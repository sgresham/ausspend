import type { RequestHandler } from 'express';
import { FunctionModel } from '../models/index.js';
import { notFound } from './errors.js';
import { parseMeasureFilters } from './filters.js';
import {
  groupByRegion,
  loadMeasures,
  serializeMeasure,
  summarizeMeasures,
  type RegionPayload,
} from './measure-summary.js';

interface RankedState {
  region: RegionPayload;
  total_cents: number;
}

export const getFunction: RequestHandler = async (req, res) => {
  const code = req.params.code as string;
  const filters = parseMeasureFilters(req.query);

  const fn = await FunctionModel.findOne({ code }).lean();
  if (!fn) {
    throw notFound(`Unknown function code: ${code}`);
  }

  const measures = await loadMeasures({ function_code: code }, filters);
  const summary = summarizeMeasures(measures);
  const byRegion = await groupByRegion(measures, summary);

  // The ranked state list is only comparable within one measure type; when the
  // response mixes measure types it is withheld rather than summed.
  const rankedStates: RankedState[] | null = summary.mixed
    ? null
    : byRegion
        .filter((group) => group.region.level === 'state' && group.total_cents !== null)
        .map((group) => ({ region: group.region, total_cents: group.total_cents as number }))
        .sort((a, b) => b.total_cents - a.total_cents);

  res.json({
    function: {
      code: fn.code,
      name: fn.name,
      level: fn.level,
      ...(fn.parent_code ? { parent_code: fn.parent_code } : {}),
    },
    filters: {
      fiscal_year: filters.fiscal_year ?? null,
      measure_type: filters.measure_type ?? null,
      region: filters.region ?? null,
      limit: filters.limit,
    },
    ...summary,
    ranked_states: rankedStates,
    by_region: byRegion,
    measures: measures.map(serializeMeasure),
  });
};
