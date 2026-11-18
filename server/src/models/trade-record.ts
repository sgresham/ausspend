import mongoose, { Schema } from 'mongoose';

/** Direction of the trade flow. */
export type TradeFlow = 'import' | 'export';

/**
 * The separate measures a trade record can carry. These are deliberately not
 * spending `measure_type` values: values, margins, port costs, volumes and
 * prices are different analytical measures and are never additive.
 */
export type TradeMeasureType =
  'trade_value' | 'cif_fob_margin' | 'port_interface_cost' | 'trade_volume' | 'trade_price';

/** Published observation quality. */
export type TradeDataQualityFlag = 'verified' | 'provisional' | 'estimated' | 'observed';

export interface TradeLocationDocument {
  state?: string;
  port?: string;
  granularity: 'national' | 'port';
}

/**
 * A trade observation in `trade_records`.
 *
 * This collection is strictly separate from `measures` (`spending_records` in
 * the domain language). There is no profit field and no profit estimate: the
 * only cost proxy is `cif_fob_margin`, a border-cost measure, never profit.
 */
export interface TradeRecordDocument {
  trade_flow: TradeFlow;
  measure_type: TradeMeasureType;
  commodity_name: string;
  commodity_code?: string;
  partner_country?: string;
  port_name?: string;
  jurisdiction_level: 'federal';
  location: TradeLocationDocument;
  amount_cents: number;
  margin_percent?: number;
  index_value?: number;
  volume?: number;
  price?: number;
  financial_year: string;
  time_period?: string;
  source_dataset: string;
  source_url: string;
  source_date: string;
  data_quality_flag: TradeDataQualityFlag;
  created_at?: Date;
  updated_at?: Date;
}

const TradeLocationSchema = new Schema<TradeLocationDocument>(
  {
    state: { type: String },
    port: { type: String },
    granularity: {
      type: String,
      required: true,
      enum: ['national', 'port'],
      default: 'national',
    },
  },
  { _id: false },
);

const TradeRecordMongooseSchema = new Schema<TradeRecordDocument>(
  {
    trade_flow: {
      type: String,
      required: true,
      enum: ['import', 'export'],
      index: true,
    },
    measure_type: {
      type: String,
      required: true,
      enum: ['trade_value', 'cif_fob_margin', 'port_interface_cost', 'trade_volume', 'trade_price'],
      index: true,
    },
    commodity_name: { type: String, required: true, index: true },
    commodity_code: { type: String },
    partner_country: { type: String, index: true },
    port_name: { type: String },
    jurisdiction_level: {
      type: String,
      required: true,
      enum: ['federal'],
      default: 'federal',
    },
    location: { type: TradeLocationSchema, required: true },
    amount_cents: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value: number) => Number.isSafeInteger(value),
        message: 'amount_cents must be an integer number of cents',
      },
    },
    // CIF/FOB margin is a cost proxy, expressed as a percentage. Never profit.
    margin_percent: { type: Number },
    index_value: { type: Number },
    volume: { type: Number },
    price: { type: Number },
    financial_year: { type: String, required: true, index: true },
    time_period: { type: String },
    source_dataset: { type: String, required: true },
    source_url: { type: String, required: true },
    source_date: { type: String, required: true },
    data_quality_flag: {
      type: String,
      required: true,
      enum: ['verified', 'provisional', 'estimated', 'observed'],
      index: true,
    },
  },
  {
    collection: 'trade_records',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

TradeRecordMongooseSchema.index({ 'location.state': 1 });
TradeRecordMongooseSchema.index({ 'location.port': 1 });
TradeRecordMongooseSchema.index({ trade_flow: 1, measure_type: 1, financial_year: 1 });

export const TradeRecordModel = mongoose.model<TradeRecordDocument>(
  'TradeRecord',
  TradeRecordMongooseSchema,
);
