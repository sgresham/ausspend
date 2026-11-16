import type { RequestHandler } from 'express';
import { z } from 'zod';
import { IngestionLogModel } from '../models/index.js';
import { badRequest } from './errors.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const IngestionLogQuerySchema = z.object({
  source_id: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be between 1 and 200')
    .max(MAX_LIMIT, 'limit must be between 1 and 200')
    .default(DEFAULT_LIMIT),
});

/** GET /api/ingestion-logs — newest-first ingestion run history. */
export const listIngestionLogs: RequestHandler = async (req, res) => {
  const parsed = IngestionLogQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid ingestion-log query');
  }

  const filter: Record<string, unknown> = {};
  if (parsed.data.source_id) filter.source_id = parsed.data.source_id;

  const logs = await IngestionLogModel.find(filter)
    .sort({ started_at: -1 })
    .limit(parsed.data.limit)
    .lean();

  res.json({
    logs: logs.map((log) => ({
      id: log._id.toString(),
      source_id: log.source_id,
      started_at: log.started_at,
      finished_at: log.finished_at,
      status: log.status,
      records_fetched: log.records_fetched,
      records_upserted: log.records_upserted,
      errors: log.errors,
      ...(log.message ? { message: log.message } : {}),
    })),
    count: logs.length,
  });
};
