import type { RequestHandler } from 'express';
import { z } from 'zod';
import { FunctionModel, RegionModel } from '../models/index.js';
import { badRequest } from './errors.js';
import { serializeRegion, type LeanRegion } from './measure-summary.js';

const MAX_RESULTS_PER_KIND = 20;

const SearchSchema = z.object({
  q: z.string().trim().max(100),
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const search: RequestHandler = async (req, res) => {
  if (typeof req.query.q !== 'string' || req.query.q.trim().length === 0) {
    throw badRequest('q is required');
  }

  const parsed = SearchSchema.safeParse(req.query);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid search query');
  }

  const pattern = new RegExp(escapeRegex(parsed.data.q), 'i');

  const [regions, functions] = await Promise.all([
    RegionModel.find({ $or: [{ code: pattern }, { name: pattern }] })
      .limit(MAX_RESULTS_PER_KIND)
      .lean<LeanRegion[]>(),
    FunctionModel.find({ $or: [{ code: pattern }, { name: pattern }] })
      .limit(MAX_RESULTS_PER_KIND)
      .lean(),
  ]);

  res.json({
    q: parsed.data.q,
    regions: regions.map(serializeRegion),
    functions: functions.map((fn) => ({
      code: fn.code,
      name: fn.name,
      level: fn.level,
      ...(fn.parent_code ? { parent_code: fn.parent_code } : {}),
    })),
    count: regions.length + functions.length,
  });
};
