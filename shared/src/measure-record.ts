import { z } from 'zod';
import { MeasureTypeSchema } from './measure.js';
import { MoneyCentsSchema } from './money.js';
import { SourceUrlSchema } from './source.js';

/**
 * The jurisdiction level of a source record. Federal contracts and grants use
 * `federal`; the synthetic budget seed has no jurisdiction level.
 */
export const JURISDICTION_LEVELS = [
  'federal',
  'state',
  'territory',
  'local',
  'charity',
  // ABS GFS public non-financial corporations sector aggregate. It is a
  // sector benchmark, not a level of government and not an entity-level SOC
  // row, so it must never be merged with federal/state/local/charity data.
  'pnfc',
  'other',
] as const;

export const JurisdictionLevelSchema = z.enum(JURISDICTION_LEVELS);

export type JurisdictionLevel = z.infer<typeof JurisdictionLevelSchema>;

/**
 * How a row participates in additive totals. Missing means `additive` for
 * backwards compatibility. `agency_detail` rows (for example a single
 * department's statement) are listed for provenance but must never be added to
 * a consolidated series.
 */
export const AGGREGATION_ROLES = [
  'additive',
  'agency_detail',
  'policy_measure',
  // ACNC charity expenses: the total row and its components are never added
  // together. Only `expense_total` participates in a charity headline total.
  'expense_total',
  'expense_component',
  // ABS GFS top-down statistical aggregates. They are a benchmark, not a sum
  // of project rows, so they are excluded from every generic additive total
  // and are never combined with project data or across levels/measures.
  'benchmark',
] as const;

export const AggregationRoleSchema = z.enum(AGGREGATION_ROLES);

export type AggregationRole = z.infer<typeof AggregationRoleSchema>;

export const EXTRACTION_CONFIDENCES = ['low', 'medium', 'high'] as const;

export const ExtractionConfidenceSchema = z.enum(EXTRACTION_CONFIDENCES);

export type ExtractionConfidence = z.infer<typeof ExtractionConfidenceSchema>;

export const SpendingLocationSchema = z.object({
  state: z.string().min(1).optional(),
  /** Australian postcode exactly as published/derived; never invented. */
  postcode: z.string().min(3).max(10).optional(),
  lga_name: z.string().min(1).optional(),
  /** SA4 name(s) exactly as published; may be a comma-separated list. */
  sa4_name: z.string().min(1).optional(),
});

/**
 * Labels for the explicit expense categories ACNC publishes. The source column
 * is retained as the machine value; the label is what the API/UI render.
 */
export const EXPENSE_CATEGORY_LABELS = {
  total: 'Total expenses',
  employee_expenses: 'Employee expenses',
  interest_expenses: 'Interest expenses',
  grants_and_donations_australia: 'Grants and donations made for use in Australia',
  grants_and_donations_overseas: 'Grants and donations made for use outside Australia',
  all_other_expenses: 'All other expenses',
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORY_LABELS;

/**
 * ABS GFS flow classification. `revenue` and `expense` are separate published
 * operating-statement aggregates and are never summed together or with project
 * data. This is deliberately distinct from `measure_type`, which stays
 * `actual` for an official ABS aggregate.
 */
export const GFS_FLOWS = ['revenue', 'expense'] as const;

export const GfsFlowSchema = z.enum(GFS_FLOWS);

export type GfsFlow = z.infer<typeof GfsFlowSchema>;

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
  aggregation_role: AggregationRoleSchema.optional(),
  extraction_confidence: ExtractionConfidenceSchema.optional(),
  location: SpendingLocationSchema.optional(),
  /** Explicit ACNC expense component (ACNC). Never used as a measure type. */
  expense_category: z.string().min(1).optional(),
  /** ABS GFS operating-statement flow: revenue or expense. */
  gfs_flow: GfsFlowSchema.optional(),
  /** Stable ABS GFS line-item key (for example total_revenue). */
  gfs_line_item: z.string().min(1).optional(),
  /** Published ABS GFS line label. */
  gfs_line_label: z.string().min(1).optional(),
  unspsc: z.string().min(1).optional(),
});

export type MeasureRecord = z.infer<typeof MeasureRecordSchema>;

/** The extended record shape used by ingestion. Still the `measures` collection. */
export const SpendingRecordSchema = MeasureRecordSchema;

export type SpendingRecord = MeasureRecord;
