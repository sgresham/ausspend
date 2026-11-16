import type { RequestHandler } from 'express';
import { z } from 'zod';
import { RegionLevelSchema } from '@ausspend/shared';
import { RegionModel } from '../models/index.js';
import { badRequest } from './errors.js';
import { serializeRegion, type LeanRegion } from './measure-summary.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const RegionListQuerySchema = z.object({
  q: z.string().trim().max(100, 'q must be at most 100 characters').optional(),
  type: RegionLevelSchema.optional(),
  // `state` filters sub-state regions by parent state code. The curated seed has
  // no sub-state region rows yet, so this returns an empty list until regions
  // gain a parent_code. It is accepted now so the contract is stable.
  state: z.string().trim().min(2).max(10, 'state must be a state/territory code').optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be between 1 and 200')
    .max(MAX_LIMIT, 'limit must be between 1 and 200')
    .default(DEFAULT_LIMIT),
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LEVEL_RANK: Record<string, number> = { national: 0, state: 1, region: 2 };

/**
 * Bounded region list for the directory and autocomplete. This is the fix for
 * M1c's gap 1 (no region list, so the national `_id` had to be found through
 * `/api/search`). It also exposes the national row's `_id` for gap 2 without
 * changing `/api/states/:code`.
 */
export const listRegions: RequestHandler = async (req, res) => {
  const parsed = RegionListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid region query');
  }

  const { q, type, state, limit } = parsed.data;
  const filter: Record<string, unknown> = {};
  if (type) filter.level = type;
  if (state) filter.parent_code = state.toUpperCase();
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ code: pattern }, { name: pattern }];
  }

  const regions = await RegionModel.find(filter).lean<LeanRegion[]>();

  const rows = regions
    .sort(
      (a, b) =>
        (LEVEL_RANK[a.level] ?? 99) - (LEVEL_RANK[b.level] ?? 99) || a.code.localeCompare(b.code),
    )
    .slice(0, limit)
    .map(serializeRegion);

  res.json({ regions: rows, count: rows.length });
};

export const regionListConstants = { DEFAULT_LIMIT, MAX_LIMIT };
