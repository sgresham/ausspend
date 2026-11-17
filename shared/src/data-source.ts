import { z } from 'zod';
import { SourceUrlSchema } from './source.js';

/**
 * The provenance fields shared by every data source record.
 */
export const DataSourceStatusSchema = z.enum(['stub', 'active', 'degraded']);

export type DataSourceStatus = z.infer<typeof DataSourceStatusSchema>;

export const FetchStrategySchema = z.enum(['direct', 'parliament_fallback', 'headless']);

export type FetchStrategy = z.infer<typeof FetchStrategySchema>;

export const DataSourceSchema = z.object({
  source_id: z.string().min(1),
  name: z.string().min(1),
  publisher: z.string().min(1),
  source_url: SourceUrlSchema,
  retrieved_at: z.string().min(1),
  license: z.string().min(1),
  verified: z.boolean(),
  notes: z.string().optional(),
  status: DataSourceStatusSchema.optional(),
  last_ingested_at: z.string().nullable().optional(),
  records_ingested: z.number().int().nonnegative().optional(),
  errors: z.array(z.string()).optional(),
  fetch_strategy: FetchStrategySchema.nullable().optional(),
  last_successful_fetch: z.string().nullable().optional(),
  staleness_days: z.number().int().nonnegative().nullable().optional(),
});

export type DataSourceRecord = z.infer<typeof DataSourceSchema>;

/**
 * The single synthetic source used by the development seed. Its URL anchors the
 * `/data-sources#synthetic-seed` section of the source register.
 */
export const SYNTHETIC_SOURCE = {
  source_id: 'synthetic-seed',
  name: 'Synthetic development seed (not real spending)',
  publisher: 'ausspend development team',
  source_url: '/data-sources#synthetic-seed',
  retrieved_at: '2026-11-16T00:00:00.000Z',
  license: 'Synthetic data — no reuse rights implied',
  verified: false,
  status: 'active',
  last_ingested_at: null,
  records_ingested: 0,
  errors: [],
  notes:
    'Deterministic placeholder values generated for development. Not sourced from, and not a substitute for, any published Australian government figure.',
} as const;

/** Path portion of the synthetic source URL, as required by the data model. */
export const SYNTHETIC_SOURCE_URL_PATH = '/data-sources#synthetic-seed';
