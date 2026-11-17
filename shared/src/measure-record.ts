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
  // State-owned corporation (SOC) entity-level financial statements, e.g. a
  // Sydney Water annual report. This is an entity statement, not a level of
  // government, not project spending and not the PNFC sector benchmark. SOC
  // rows are never added to government program spending or to PNFC data.
  'soc',
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
  /**
   * NSW Budget ArcGIS capital-project metadata. Only the ArcGIS capital rows
   * carry these; statement rows leave them absent rather than guessing a
   * project, agency or location. Values are copied verbatim from the published
   * layer (`Treasury_Project_Data_20260609_gdb`); a published `n.a.`/blank is
   * stored as absent, never replaced with an invented value. They are
   * dimensions only: no field here changes `amount_cents` and sectors/agencies
   * are not additive.
   */
  project_id: z.string().min(1).optional(),
  agency: z.string().min(1).optional(),
  sector: z.string().min(1).optional(),
  cluster: z.string().min(1).optional(),
  electorate: z.string().min(1).optional(),
  /** Published ArcGIS region name, distinct from the curated `region_id`. */
  region: z.string().min(1).optional(),
  /** Published ArcGIS LGA name; `location.lga_name` still mirrors it. */
  lga: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  /** Published budget year for the project amount, e.g. `2025-26`. */
  budget_year: z.string().min(1).optional(),
  /** Explicit ACNC expense component (ACNC). Never used as a measure type. */
  expense_category: z.string().min(1).optional(),
  /** ABS GFS operating-statement flow: revenue or expense. */
  gfs_flow: GfsFlowSchema.optional(),
  /** Stable ABS GFS line-item key (for example total_revenue). */
  gfs_line_item: z.string().min(1).optional(),
  /** Published ABS GFS line label. */
  gfs_line_label: z.string().min(1).optional(),
  unspsc: z.string().min(1).optional(),
  /**
   * SOC entity statement provenance. `soc_line_item` is the stable line key,
   * `soc_line_label` the exact printed label and `soc_unit` the printed unit
   * (for Sydney Water: AUD_thousands, printed "$’000"). SOC rows are always
   * provisional entity statements unless a human marks them verified.
   */
  soc_line_item: z.string().min(1).optional(),
  soc_line_label: z.string().min(1).optional(),
  soc_unit: z.string().min(1).optional(),
  /**
   * SOC breakdown dimension. `soc_section` groups rows for the UI (revenue,
   * expenses, result, capital); `soc_note` names the printed note/table;
   * `soc_component_of` names the printed subtotal a component sums to (so a
   * component is never added to that subtotal); `soc_breakdown` names the
   * dimension the note exposes (for example other_operating_expense_category).
   */
  soc_section: z.enum(['revenue', 'expenses', 'result', 'capital', 'transfer']).optional(),
  soc_note: z.string().min(1).optional(),
  soc_component_of: z.string().min(1).optional(),
  soc_breakdown: z.string().min(1).optional(),
  /**
   * Printed sign when the published figure is negative but `amount_cents` is
   * stored as a non-negative magnitude (money is never negative in the model).
   * Reconciliation checks use the printed sign.
   */
  soc_printed_sign: z.enum(['positive', 'negative']).optional(),
  /**
   * Council General Purpose Financial Statement provenance. `gpfs_line_item`
   * is the stable line key, `gpfs_line_label` the exact printed label and
   * `gpfs_unit` the printed unit (for Dubbo: AUD_thousands, printed "$'000").
   * `gpfs_component_of` names the printed subtotal a component belongs to, so
   * a component is never added to that subtotal. GPFS rows are non-additive
   * agency detail and are never summed with council budget/summary rows.
   */
  gpfs_line_item: z.string().min(1).optional(),
  gpfs_line_label: z.string().min(1).optional(),
  gpfs_unit: z.string().min(1).optional(),
  gpfs_section: z.enum(['revenue', 'expenses', 'result']).optional(),
  gpfs_statement: z.string().min(1).optional(),
  gpfs_component_of: z.string().min(1).optional(),
  /**
   * Printed sign when the published figure is negative but `amount_cents` is
   * stored as a non-negative magnitude. Wollongong's FY2024-25 net result is
   * printed as `(10,238)` thousand; the magnitude is stored with this marker.
   */
  gpfs_printed_sign: z.enum(['positive', 'negative']).optional(),
  /**
   * VLGGC VGC1 council questionnaire provenance. `statement` is `income` for
   * every VGC1 row (the return is the council income statement); `vlgc_section`
   * separates the expense and revenue cuts. `vlgc_function`/`vlgc_nature` are
   * the exact printed VLGGC dimensions and are NOT COFOG functions (so
   * `function_code` stays absent). `vlgc_measure` names the printed row type
   * (total_expenditure, expense_function_total, expense_function_nature,
   * revenue_function_total, revenue_other, functions_subtotal, total_revenue).
   * `reconciliation_status` records whether a row reconciles to the audited
   * GPFS (`reconciled_to_gpfs`) or remains an unreconciled questionnaire return
   * (`questionnaire_unaudited`). VGC1 rows are non-additive agency detail and
   * are never summed across councils or with any other source.
   */
  statement: z.string().min(1).optional(),
  reconciliation_status: z.string().min(1).optional(),
  /**
   * A printed source-vs-comparator variance that a human must confirm. It is
   * never a silent pass: rows carrying this are not treated as exactly
   * reconciled. Present on the VLGGC FY2023-24 Bendigo totals, whose whole-AUD
   * values differ from the audited GPFS by $1,023.18 (expenditure) and
   * $2,475.92 (revenue).
   */
  human_spot_check: z.string().min(1).optional(),
  vlgc_section: z.enum(['expense', 'revenue']).optional(),
  vlgc_measure: z.string().min(1).optional(),
  vlgc_function: z.string().min(1).optional(),
  vlgc_function_code: z.string().min(1).optional(),
  vlgc_nature: z.string().min(1).optional(),
  vlgc_line_code: z.string().min(1).optional(),
  vlgc_council_label: z.string().min(1).optional(),
  vlgc_unit: z.string().min(1).optional(),
  vlgc_printed_sign: z.enum(['positive', 'negative']).optional(),
  /**
   * VLGGC Financial Assistance Grant allocation vintage. FAG rows are one
   * printed total per council per year; `estimated` is the annual allocation
   * report's forward allocation, `final` is the later final/actual adjustment.
   * FAG is grant income and overlaps council grant revenue, so every row is
   * non-additive agency detail and carries potential_double_count=true.
   */
  vlgc_allocation_status: z.enum(['estimated', 'final']).optional(),
  /**
   * VLGGC ABS1/ABS2-3 council questionnaire provenance. `statement` is one of
   * capital, balance, cash_flow or income; `statement_section` names the printed
   * sub-table (for example assets, liabilities, operating_receipts,
   * sources_and_applications); `statement_line` is the exact printed line label
   * and `asset_class` the printed asset class where one applies. ABS rows are
   * non-additive agency detail and are never summed across councils, functions,
   * asset classes or statement sections, and never mixed with VGC1.
   */
  asset_class: z.string().min(1).optional(),
  statement_section: z.string().min(1).optional(),
  statement_line: z.string().min(1).optional(),
  vlgc_abs_measure: z.string().min(1).optional(),
  vlgc_abs_line_code: z.string().min(1).optional(),
  vlgc_abs_council_label: z.string().min(1).optional(),
  vlgc_abs_unit: z.string().min(1).optional(),
  vlgc_abs_printed_sign: z.enum(['positive', 'negative']).optional(),
  /**
   * True when the row's funding source names a government agency or a
   * separately disclosed government contribution/transfer. Such a row may
   * overlap government program spending, so the UI warns and the row is never
   * added to an additive total.
   */
  potential_double_count: z.boolean().optional(),
  /**
   * AIHW health-expenditure provenance. Government and Non-government are
   * separate funding series and are never summed; `aihw_area_of_expenditure`
   * is the published area (for example Public hospitals). `aihw_printed_sign`
   * marks the 122 negative constant-price amounts (mostly the medical-expense
   * tax rebate) whose magnitude is stored in `amount_cents`. `aihw_unit` is the
   * explicit published unit, AUD_millions (real/constant 2011-12 prices).
   */
  aihw_broad_source_of_funding: z.enum(['Government', 'Non-government']).optional(),
  aihw_area_of_expenditure: z.string().min(1).optional(),
  aihw_printed_sign: z.enum(['positive', 'negative']).optional(),
  aihw_unit: z.string().min(1).optional(),
  /** Exact published detailed funding source. */
  aihw_detailed_source_of_funding: z.string().min(1).optional(),
  /** State/territory code the published table applies to. */
  aihw_state: z.string().min(1).optional(),
  /** Separate funding marker: government vs non-government. */
  aihw_funding_sector: z.enum(['government', 'non_government']).optional(),
  /** Price basis of the published table (current prices). */
  aihw_price_basis: z.string().min(1).optional(),
  /** Published source table (for example Table B3). */
  aihw_table: z.string().min(1).optional(),
  /** AIHW release the table came from. */
  aihw_release: z.string().min(1).optional(),
  /**
   * VIC council performance-indicator provenance (LGPRF). Performance values
   * are not money: a value may be a per-head amount, per-unit cost, percentage,
   * ratio, score, count or days. `performance_value` stores the published
   * result exactly (absent when the source published a blank); it is never
   * converted to dollars and never summed or averaged. `amount_cents` is 0 for
   * these rows and is not used as the measure value.
   */
  performance_value: z.number().optional(),
  /** Published textual result, when the source result is not numeric. */
  performance_value_text: z.string().min(1).optional(),
  /** Unit exactly as published/defined for the indicator. */
  performance_unit: z.string().min(1).optional(),
  performance_indicator_code: z.string().min(1).optional(),
  performance_indicator_name: z.string().min(1).optional(),
  performance_indicator_group: z.string().min(1).optional(),
  performance_service_provided: z.string().min(1).optional(),
  /** Published `Data applicable?` value (for example applicable or No data). */
  performance_data_applicable: z.string().min(1).optional(),
  /** Council label exactly as printed in the LGPRF workbook. */
  performance_council_label: z.string().min(1).optional(),
  /** Explicit marker that the row must never participate in a sum/average. */
  performance_non_additive: z.boolean().optional(),
});

export type MeasureRecord = z.infer<typeof MeasureRecordSchema>;

/** The extended record shape used by ingestion. Still the `measures` collection. */
export const SpendingRecordSchema = MeasureRecordSchema;

export type SpendingRecord = MeasureRecord;
