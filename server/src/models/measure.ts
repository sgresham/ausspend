import mongoose, { Schema } from 'mongoose';

export type MeasureType = 'actual' | 'budget' | 'estimate' | 'contract' | 'grant_award';

export interface SpendingLocationDocument {
  state?: string;
  postcode?: string;
  lga_name?: string;
  sa4_name?: string;
}

/**
 * The single spending collection. Budget measures (actual/budget/estimate) may
 * carry a curated region/function; federal source records (contract/grant_award)
 * may not, so both fields are optional and a missing value is stored as absent,
 * never as an invented placeholder.
 */
export interface MeasureDocument {
  region_id?: mongoose.Types.ObjectId | null;
  function_code?: string | null;
  amount_cents: number;
  measure_type: MeasureType;
  fiscal_year: string;
  source_id: string;
  source_url: string;
  verified: boolean;
  notes?: string;
  natural_key?: string;
  project_name?: string;
  description?: string;
  jurisdiction_level?:
    'federal' | 'state' | 'territory' | 'local' | 'charity' | 'pnfc' | 'soc' | 'other';
  jurisdiction?: string;
  delivery_entity?: string;
  funding_source?: string;
  source_dataset?: string;
  source_date?: string;
  data_quality_flag?: string;
  aggregation_role?:
    | 'additive'
    | 'agency_detail'
    | 'policy_measure'
    | 'expense_total'
    | 'expense_component'
    | 'benchmark';
  extraction_confidence?: 'low' | 'medium' | 'high';
  location?: SpendingLocationDocument;
  /**
   * NSW Budget ArcGIS capital-project dimensions. Absent on statement rows and
   * on every other source; never invented from a missing published value.
   */
  project_id?: string;
  agency?: string;
  sector?: string;
  cluster?: string;
  electorate?: string;
  region?: string;
  lga?: string;
  status?: string;
  category?: string;
  budget_year?: string;
  /** Explicit ACNC expense category; never overloads measure_type. */
  expense_category?: string;
  /** ABS GFS operating-statement flow: revenue or expense. */
  gfs_flow?: 'revenue' | 'expense';
  /** Stable ABS GFS line-item key, e.g. total_revenue. */
  gfs_line_item?: string;
  /** Published ABS GFS line label. */
  gfs_line_label?: string;
  unspsc?: string;
  /** SOC entity statement stable line key (e.g. total_expenses). */
  soc_line_item?: string;
  /** SOC entity statement exact printed line label. */
  soc_line_label?: string;
  /** SOC printed unit, e.g. AUD_thousands for "$’000". */
  soc_unit?: string;
  /** SOC breakdown section: revenue, expenses, result, capital or transfer. */
  soc_section?: 'revenue' | 'expenses' | 'result' | 'capital' | 'transfer';
  /** SOC printed note/table grouping label, e.g. "Note 6 Other operating expenses". */
  soc_note?: string;
  /** Stable line key of the printed subtotal this component sums to. */
  soc_component_of?: string;
  /** Breakdown dimension the note exposes (e.g. other_operating_expense_category). */
  soc_breakdown?: string;
  /** Printed sign when amount_cents stores the non-negative magnitude. */
  soc_printed_sign?: 'positive' | 'negative';
  /** Council GPFS stable line key, e.g. total_revenue. */
  gpfs_line_item?: string;
  /** Council GPFS exact printed line label. */
  gpfs_line_label?: string;
  /** Council GPFS printed unit, e.g. AUD_thousands for "$'000". */
  gpfs_unit?: string;
  /** Council GPFS statement section: revenue, expenses or result. */
  gpfs_section?: 'revenue' | 'expenses' | 'result';
  /** Council GPFS printed statement/note label. */
  gpfs_statement?: string;
  /** Printed subtotal this GPFS component belongs to. */
  gpfs_component_of?: string;
  /** Printed sign when a negative result is stored as a non-negative magnitude. */
  gpfs_printed_sign?: 'positive' | 'negative';
  /** Statement type; VGC1 council rows are the council income statement. */
  statement?: string;
  /** Reconciled to the audited GPFS, or an unreconciled questionnaire return. */
  reconciliation_status?: string;
  /** VLGGC VGC1 section (expense or revenue cut of the income statement). */
  vlgc_section?: 'expense' | 'revenue';
  /** Printed VGC1 row type (total_expenditure, expense_function_nature, ...). */
  vlgc_measure?: string;
  /** Exact printed VLGGC function name (not a COFOG function). */
  vlgc_function?: string;
  /** Exact printed VLGGC function code (for example 01199). */
  vlgc_function_code?: string;
  /** Exact printed VLGGC expense nature (Employee Benefits, ...). */
  vlgc_nature?: string;
  /** Exact printed VLGGC line code (for example 01999). */
  vlgc_line_code?: string;
  /** Council label exactly as printed in the workbook (for example Alpine (S)). */
  vlgc_council_label?: string;
  /** Printed VGC1 unit; whole AUD, converted to cents at x100. */
  vlgc_unit?: string;
  /** Printed sign when a negative amount is stored as a non-negative magnitude. */
  vlgc_printed_sign?: 'positive' | 'negative';
  /** VLGGC ABS1/ABS2-3 asset class where the printed line is an asset class. */
  asset_class?: string;
  /** VLGGC ABS1/ABS2-3 printed sub-table (assets, liabilities, receipts, ...). */
  statement_section?: string;
  /** VLGGC ABS1/ABS2-3 exact printed line label. */
  statement_line?: string;
  /** VLGGC ABS1/ABS2-3 stable printed row kind. */
  vlgc_abs_measure?: string;
  /** VLGGC ABS1/ABS2-3 exact printed line code. */
  vlgc_abs_line_code?: string;
  /** Council label exactly as printed in the ABS workbooks. */
  vlgc_abs_council_label?: string;
  /** Printed ABS unit; whole AUD, converted to cents at x100. */
  vlgc_abs_unit?: string;
  /** Printed sign when a negative ABS amount is stored as a magnitude. */
  vlgc_abs_printed_sign?: 'positive' | 'negative';
  /** Government-named funding row that may overlap government program data. */
  potential_double_count?: boolean;
}

const LocationSchema = new Schema<SpendingLocationDocument>(
  {
    state: { type: String },
    postcode: { type: String },
    lga_name: { type: String },
    sa4_name: { type: String },
  },
  { _id: false },
);

const MeasureMongooseSchema = new Schema<MeasureDocument>(
  {
    region_id: {
      type: Schema.Types.ObjectId,
      ref: 'Region',
      required: false,
      index: true,
      sparse: true,
    },
    function_code: { type: String, required: false, index: true, sparse: true },
    amount_cents: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value),
        message: 'amount_cents must be an integer number of cents',
      },
    },
    measure_type: {
      type: String,
      required: true,
      enum: ['actual', 'budget', 'estimate', 'contract', 'grant_award'],
      index: true,
    },
    fiscal_year: { type: String, required: true, index: true },
    source_id: { type: String, required: true, index: true },
    source_url: { type: String, required: true },
    verified: { type: Boolean, required: true, default: false },
    notes: { type: String },
    // Upsert identity for ingested records. Sparse so the synthetic seed rows
    // (which predate natural keys) do not collide with each other.
    natural_key: { type: String, unique: true, sparse: true },
    project_name: { type: String },
    description: { type: String },
    jurisdiction_level: { type: String, index: true },
    jurisdiction: { type: String },
    delivery_entity: { type: String },
    funding_source: { type: String },
    source_dataset: { type: String },
    source_date: { type: String },
    data_quality_flag: { type: String },
    // Missing means additive for older sources. `agency_detail` rows are shown
    // for provenance but excluded from every additive total by the API.
    aggregation_role: {
      type: String,
      enum: [
        'additive',
        'agency_detail',
        'policy_measure',
        'expense_total',
        'expense_component',
        'benchmark',
      ],
      index: true,
    },
    extraction_confidence: { type: String, enum: ['low', 'medium', 'high'] },
    location: { type: LocationSchema },
    // NSW Budget ArcGIS capital-project dimensions. Sparse/absent on statement
    // rows and all other sources; they never participate in totals.
    project_id: { type: String, index: true, sparse: true },
    agency: { type: String },
    sector: { type: String },
    cluster: { type: String },
    electorate: { type: String },
    region: { type: String },
    lga: { type: String },
    status: { type: String },
    category: { type: String },
    budget_year: { type: String },
    expense_category: { type: String, index: true },
    gfs_flow: { type: String, enum: ['revenue', 'expense'], index: true },
    gfs_line_item: { type: String },
    gfs_line_label: { type: String },
    unspsc: { type: String, index: true },
    soc_line_item: { type: String, index: true },
    soc_line_label: { type: String },
    soc_unit: { type: String },
    soc_section: {
      type: String,
      enum: ['revenue', 'expenses', 'result', 'capital', 'transfer'],
      index: true,
    },
    soc_note: { type: String, index: true },
    soc_component_of: { type: String, index: true },
    soc_breakdown: { type: String },
    soc_printed_sign: { type: String, enum: ['positive', 'negative'] },
    gpfs_line_item: { type: String, index: true },
    gpfs_line_label: { type: String },
    gpfs_unit: { type: String },
    gpfs_section: { type: String, enum: ['revenue', 'expenses', 'result'], index: true },
    gpfs_statement: { type: String },
    gpfs_component_of: { type: String, index: true },
    gpfs_printed_sign: { type: String, enum: ['positive', 'negative'] },
    statement: { type: String, index: true },
    reconciliation_status: { type: String, index: true },
    vlgc_section: { type: String, enum: ['expense', 'revenue'], index: true },
    vlgc_measure: { type: String, index: true },
    vlgc_function: { type: String },
    vlgc_function_code: { type: String, index: true },
    vlgc_nature: { type: String, index: true },
    vlgc_line_code: { type: String },
    vlgc_council_label: { type: String },
    vlgc_unit: { type: String },
    vlgc_printed_sign: { type: String, enum: ['positive', 'negative'] },
    asset_class: { type: String, index: true },
    statement_section: { type: String, index: true },
    statement_line: { type: String },
    vlgc_abs_measure: { type: String, index: true },
    vlgc_abs_line_code: { type: String, index: true },
    vlgc_abs_council_label: { type: String },
    vlgc_abs_unit: { type: String },
    vlgc_abs_printed_sign: { type: String, enum: ['positive', 'negative'] },
    potential_double_count: { type: Boolean, index: true },
  },
  { collection: 'measures', versionKey: false },
);

// The data layer's primary access patterns: a function (optionally one region,
// fiscal year and measure type) and a region over time.
MeasureMongooseSchema.index({ function_code: 1, fiscal_year: 1, region_id: 1 });
MeasureMongooseSchema.index({ region_id: 1, function_code: 1, fiscal_year: 1 });
MeasureMongooseSchema.index({ jurisdiction_level: 1, fiscal_year: 1, measure_type: 1 });

export const MeasureModel = mongoose.model<MeasureDocument>('Measure', MeasureMongooseSchema);
