import { z } from 'zod';
import { SourceUrlSchema } from './source.js';

/**
 * The provenance fields shared by every data source record.
 */
export const DataSourceSchema = z.object({
  source_id: z.string().min(1),
  name: z.string().min(1),
  publisher: z.string().min(1),
  source_url: SourceUrlSchema,
  retrieved_at: z.string().min(1),
  license: z.string().min(1),
  verified: z.boolean(),
  notes: z.string().optional(),
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
  notes:
    'Deterministic placeholder values generated for development. Not sourced from, and not a substitute for, any published Australian government figure.',
} as const;

/** Path portion of the synthetic source URL, as required by the data model. */
export const SYNTHETIC_SOURCE_URL_PATH = '/data-sources#synthetic-seed';
