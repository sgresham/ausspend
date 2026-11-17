import mongoose from 'mongoose';
import { z } from 'zod';
import { MeasureTypeSchema } from '@ausspend/shared';
import { badRequest } from './errors.js';

// State/function detail returns full summaries over projects as well as
// statement lines; QLD BP3 alone contributes 943 rows. 2,000 covers the
// largest current source while keeping the response bounded.
export const DEFAULT_LIMIT = 2000;
export const MAX_LIMIT = 2000;

const MeasureFiltersSchema = z.object({
  fiscal_year: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'fiscal_year must look like YYYY-YY')
    .optional(),
  measure_type: MeasureTypeSchema.optional(),
  region: z.string().min(1, 'region must be a region _id').optional(),
  /**
   * Exact source id (for example `qld-qgip`). The state/region view is
   * cross-source by default (state budget + location-tagged federal rows), so
   * this filter isolates one source without changing that default.
   */
  source_id: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export interface MeasureFilters {
  fiscal_year?: string;
  measure_type?: z.infer<typeof MeasureTypeSchema>;
  region?: string;
  source_id?: string;
  limit: number;
}

/**
 * Parse the shared measure filters. `region` is a region `_id`, never a code:
 * anything that is not a Mongo ObjectId is a 400 so callers cannot accidentally
 * filter by code.
 */
export function parseMeasureFilters(query: unknown): MeasureFilters {
  const parsed = MeasureFiltersSchema.safeParse(query);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid query parameters';
    throw badRequest(message);
  }

  if (parsed.data.region !== undefined && !mongoose.isValidObjectId(parsed.data.region)) {
    throw badRequest('region must be a region _id (a 24-character hex id), not a code');
  }

  return parsed.data;
}

export function measureQuery(filters: MeasureFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.fiscal_year) query.fiscal_year = filters.fiscal_year;
  if (filters.measure_type) query.measure_type = filters.measure_type;
  if (filters.region) query.region_id = new mongoose.Types.ObjectId(filters.region);
  if (filters.source_id) query.source_id = filters.source_id;
  return query;
}

/** Sum integer cents and refuse to silently lose precision. */
export function sumCents(amounts: readonly number[]): number {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(total)) {
    throw new Error('amount total exceeds safe integer range');
  }
  return total;
}
