import { z } from 'zod';
import { MeasureTypeSchema } from './measure.js';
import { MoneyCentsSchema } from './money.js';
import { SourceUrlSchema } from './source.js';

/**
 * A single spending observation. Amounts are integer cents and every row
 * carries its provenance (source id, source URL and verification flag).
 */
export const MeasureRecordSchema = z.object({
  region_id: z.string().min(1),
  function_code: z.string().min(2),
  amount_cents: MoneyCentsSchema,
  measure_type: MeasureTypeSchema,
  fiscal_year: z.string().regex(/^\d{4}-\d{2}$/),
  source_id: z.string().min(1),
  source_url: SourceUrlSchema,
  verified: z.boolean(),
  notes: z.string().optional(),
});

export type MeasureRecord = z.infer<typeof MeasureRecordSchema>;
