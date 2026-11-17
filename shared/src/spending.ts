import { z } from 'zod';
import { FunctionLevelSchema } from './cofog.js';
import { MeasureTypeSchema } from './measure.js';
import {
  ExtractionConfidenceSchema,
  JurisdictionLevelSchema,
  SpendingLocationSchema,
} from './measure-record.js';
import { REGION_LEVELS, RegionLevelSchema } from './regions.js';
import { SourceUrlSchema } from './source.js';

/**
 * Spending search/summary contract shared by the API, its tests and any future
 * consumer. Additive to the M1b/M1c contracts: nothing here renames or removes
 * an existing field.
 */

export const SPENDING_SORTS = [
  'amount_desc',
  'amount_asc',
  'fiscal_year_desc',
  'fiscal_year_asc',
] as const;

export const SpendingSortSchema = z.enum(SPENDING_SORTS);

export type SpendingSort = z.infer<typeof SpendingSortSchema>;

/** Two-digit COFOG division or three-digit subdivision code. */
export const SpendingFunctionCodeSchema = z
  .string()
  .regex(
    /^(0[1-9]|10)\d?$/,
    'function must be a 2-digit division code or a 3-digit subdivision code',
  );

/** A region `_id` (24-character hex), never a region code. */
export const SpendingRegionIdSchema = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, 'region must be a 24-character hex region _id');

export const SpendingQuerySchema = z
  .object({
    fiscal_year: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'fiscal_year must look like YYYY-YY')
      .optional(),
    measure_type: MeasureTypeSchema.optional(),
    jurisdiction_level: JurisdictionLevelSchema.optional(),
    function: SpendingFunctionCodeSchema.optional(),
    // A 24-character region _id (exact filter) or a case-insensitive slug/name.
    region: z.string().trim().min(1).max(100).optional(),
    // Explicit area slug; resolves to the same area profile as a region slug.
    area: z.string().trim().min(1).max(100).optional(),
    min_amount: z.coerce
      .number()
      .int()
      .min(0, 'min_amount must be a non-negative integer number of cents')
      .optional(),
    max_amount: z.coerce
      .number()
      .int()
      .min(0, 'max_amount must be a non-negative integer number of cents')
      .optional(),
    page: z.coerce.number().int().min(1, 'page must be at least 1').default(1),
    page_size: z.coerce
      .number()
      .int()
      .min(1, 'page_size must be between 1 and 100')
      .max(100, 'page_size must be between 1 and 100')
      .default(20),
    sort: SpendingSortSchema.default('amount_desc'),
  })
  .refine(
    (query) =>
      query.min_amount === undefined ||
      query.max_amount === undefined ||
      query.min_amount <= query.max_amount,
    {
      message: 'min_amount must be less than or equal to max_amount',
      path: ['min_amount'],
    },
  );

export type SpendingQuery = z.infer<typeof SpendingQuerySchema>;

/** Per-measure-type count and sum. Totals are never summed across types. */
export const PerMeasureTypeTotalSchema = z.object({
  measure_type: MeasureTypeSchema,
  count: z.number().int().nonnegative(),
  total_cents: z.number().int().nonnegative(),
});

export type PerMeasureTypeTotal = z.infer<typeof PerMeasureTypeTotalSchema>;

/**
 * One measure row with the function/region names and provenance a client needs
 * to render without an N+1 lookup.
 */
export const SpendingMeasureRowSchema = z.object({
  id: z.string().min(1),
  // Source records may have neither a COFOG function nor a curated region.
  region_id: z.string().min(1).nullable(),
  function_code: z.string().min(2).nullable(),
  amount_cents: z.number().int().nonnegative(),
  measure_type: MeasureTypeSchema,
  fiscal_year: z.string().regex(/^\d{4}-\d{2}$/),
  source_id: z.string().min(1),
  source_url: SourceUrlSchema,
  verified: z.boolean(),
  notes: z.string().optional(),
  natural_key: z.string().min(1).nullable().optional(),
  project_name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  jurisdiction_level: JurisdictionLevelSchema.optional(),
  jurisdiction: z.string().min(1).optional(),
  delivery_entity: z.string().min(1).optional(),
  funding_source: z.string().min(1).optional(),
  source_dataset: z.string().min(1).optional(),
  source_date: z.string().min(1).optional(),
  data_quality_flag: z.string().min(1).optional(),
  aggregation_role: z.enum(['additive', 'agency_detail', 'policy_measure']).optional(),
  extraction_confidence: ExtractionConfidenceSchema.optional(),
  location: SpendingLocationSchema.optional(),
  unspsc: z.string().min(1).optional(),
  function_name: z.string().min(1).nullable(),
  function_level: FunctionLevelSchema.nullable(),
  function_parent_code: z.string().min(2).optional(),
  region_code: z.string().min(2).nullable(),
  region_name: z.string().min(1).nullable(),
  region_level: RegionLevelSchema.nullable(),
  provenance: z.object({
    source_id: z.string().min(1),
    source_url: SourceUrlSchema,
    verified: z.boolean(),
    notes: z.string().optional(),
  }),
});

export type SpendingMeasureRow = z.infer<typeof SpendingMeasureRowSchema>;

export const SpendingFunctionRefSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
  level: FunctionLevelSchema,
  parent_code: z.string().min(2).optional(),
});

export type SpendingFunctionRef = z.infer<typeof SpendingFunctionRefSchema>;

export const SpendingRegionRefSchema = z.object({
  _id: z.string().min(1),
  code: z.string().min(2),
  name: z.string().min(1),
  level: RegionLevelSchema,
  parent_code: z.string().min(2).optional(),
  slug: z.string().min(1).optional(),
});

export type SpendingRegionRef = z.infer<typeof SpendingRegionRefSchema>;

const BreakdownBaseSchema = z.object({
  count: z.number().int().nonnegative(),
  measure_types: z.array(MeasureTypeSchema),
  mixed: z.boolean(),
  total_cents: z.number().int().nonnegative().nullable(),
  total_by_measure_type: z.array(PerMeasureTypeTotalSchema),
});

export const SpendingByFunctionSchema = BreakdownBaseSchema.extend({
  function: SpendingFunctionRefSchema,
});

export type SpendingByFunction = z.infer<typeof SpendingByFunctionSchema>;

export const SpendingByRegionSchema = BreakdownBaseSchema.extend({
  region: SpendingRegionRefSchema,
});

export type SpendingByRegion = z.infer<typeof SpendingByRegionSchema>;

export const SpendingSummarySchema = z.object({
  count: z.number().int().nonnegative(),
  currency: z.literal('AUD'),
  total_cents: z.number().int().nonnegative().nullable(),
  total_measure_type: MeasureTypeSchema.nullable(),
  total_by_measure_type: z.array(PerMeasureTypeTotalSchema),
  measure_types: z.array(MeasureTypeSchema),
  mixed: z.boolean(),
  breakdown_by_function: z.array(SpendingByFunctionSchema),
  breakdown_by_region: z.array(SpendingByRegionSchema),
});

export type SpendingSummary = z.infer<typeof SpendingSummarySchema>;

export const SpendingPaginationSchema = z.object({
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
  has_next: z.boolean(),
});

export type SpendingPagination = z.infer<typeof SpendingPaginationSchema>;

export const SpendingAppliedFiltersSchema = z.object({
  fiscal_year: z.string().nullable(),
  measure_type: MeasureTypeSchema.nullable(),
  jurisdiction_level: JurisdictionLevelSchema.nullable(),
  function: z.string().nullable(),
  region: z.string().nullable(),
  area: z.string().nullable().optional(),
  min_amount: z.number().int().nonnegative().nullable(),
  max_amount: z.number().int().nonnegative().nullable(),
  sort: SpendingSortSchema,
});

export type SpendingAppliedFilters = z.infer<typeof SpendingAppliedFiltersSchema>;

export const SpendingResponseSchema = z.object({
  data: z.array(SpendingMeasureRowSchema),
  summary: SpendingSummarySchema,
  pagination: SpendingPaginationSchema,
  applied_filters: SpendingAppliedFiltersSchema,
});

export type SpendingResponse = z.infer<typeof SpendingResponseSchema>;

/** A single measure detail row uses the same shape as a `/api/spending` data row. */
export type SpendingDetailResponse = SpendingMeasureRow;

/** The `region_levels` order used in coverage metadata (broadest first). */
export const REGION_LEVEL_ORDER = REGION_LEVELS;
