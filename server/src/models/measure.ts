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
  jurisdiction_level?: 'federal' | 'state' | 'territory' | 'local' | 'charity' | 'pnfc' | 'other';
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
  /** Explicit ACNC expense category; never overloads measure_type. */
  expense_category?: string;
  /** ABS GFS operating-statement flow: revenue or expense. */
  gfs_flow?: 'revenue' | 'expense';
  /** Stable ABS GFS line-item key, e.g. total_revenue. */
  gfs_line_item?: string;
  /** Published ABS GFS line label. */
  gfs_line_label?: string;
  unspsc?: string;
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
    expense_category: { type: String, index: true },
    gfs_flow: { type: String, enum: ['revenue', 'expense'], index: true },
    gfs_line_item: { type: String },
    gfs_line_label: { type: String },
    unspsc: { type: String, index: true },
  },
  { collection: 'measures', versionKey: false },
);

// The data layer's primary access patterns: a function (optionally one region,
// fiscal year and measure type) and a region over time.
MeasureMongooseSchema.index({ function_code: 1, fiscal_year: 1, region_id: 1 });
MeasureMongooseSchema.index({ region_id: 1, function_code: 1, fiscal_year: 1 });
MeasureMongooseSchema.index({ jurisdiction_level: 1, fiscal_year: 1, measure_type: 1 });

export const MeasureModel = mongoose.model<MeasureDocument>('Measure', MeasureMongooseSchema);
