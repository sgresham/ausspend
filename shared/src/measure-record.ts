import { z } from 'zod';
import { MeasureTypeSchema } from './measure.js';
import { MoneyCentsSchema } from './money.js';
import { SourceUrlSchema } from './source.js';

/**
 * The jurisdiction level of a source record. Federal contracts and grants use
 * `federal`; the synthetic budget seed has no jurisdiction level.
 */
export const JURISDICTION_LEVELS = ['federal', 'state', 'territory', 'local', 'other'] as const;

export const JurisdictionLevelSchema = z.enum(JURISDICTION_LEVELS);

export type JurisdictionLevel = z.infer<typeof JurisdictionLevelSchema>;

export const EXTRACTION_CONFIDENCES = ['low', 'medium', 'high'] as const;

export const ExtractionConfidenceSchema = z.enum(EXTRACTION_CONFIDENCES);

export type ExtractionConfidence = z.infer<typeof ExtractionConfidenceSchema>;

export const SpendingLocationSchema = z.object({
  state: z.string().min(1).optional(),
  lga_name: z.string().min(1).optional(),
});

export type SpendingLocation = z.infer<typeof SpendingLocationSchema>;

/**
 * A single spending observation. Amounts are integer cents and every row
 * carries its provenance (source id, source URL and verification flag).
 *
 * Source records may not have a COFOG function or a curated region, so
 * `function_code` and `region_id` are optional rather than invented. Every
 * ingested record must set `natural_key`, which is the upsert identity.
 */
export const MeasureRecordSchema = z.object({
  region_id: z.string().min(1).nullable().optional(),
  function_code: z.string().min(2).nullable().optional(),
  amount_cents: MoneyCentsSchema,
  measure_type: MeasureTypeSchema,
  fiscal_year: z.string().regex(/^\d{4}-\d{2}$/),
  source_id: z.string().min(1),
  source_url: SourceUrlSchema,
  verified: z.boolean(),
  notes: z.string().optional(),
  natural_key: z.string().min(1),
  project_name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  jurisdiction_level: JurisdictionLevelSchema.optional(),
  jurisdiction: z.string().min(1).optional(),
  delivery_entity: z.string().min(1).optional(),
  funding_source: z.string().min(1).optional(),
  source_dataset: z.string().min(1).optional(),
  source_date: z.string().min(1).optional(),
  data_quality_flag: z.string().min(1).optional(),
  extraction_confidence: ExtractionConfidenceSchema.optional(),
  location: SpendingLocationSchema.optional(),
  unspsc: z.string().min(1).optional(),
});

export type MeasureRecord = z.infer<typeof MeasureRecordSchema>;

/** The extended record shape used by ingestion. Still the `measures` collection. */
export const SpendingRecordSchema = MeasureRecordSchema;

export type SpendingRecord = MeasureRecord;
