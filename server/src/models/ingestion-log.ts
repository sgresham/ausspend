import mongoose, { Schema } from 'mongoose';

export type IngestionLogStatus = 'success' | 'partial' | 'error' | 'skipped';

export interface IngestionLogDocument {
  source_id: string;
  started_at: Date;
  finished_at: Date;
  status: IngestionLogStatus;
  records_fetched: number;
  records_upserted: number;
  errors: string[];
  message?: string;
}

const IngestionLogMongooseSchema = new Schema<IngestionLogDocument>(
  {
    source_id: { type: String, required: true, index: true },
    started_at: { type: Date, required: true, index: true },
    finished_at: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['success', 'partial', 'error', 'skipped'],
      index: true,
    },
    records_fetched: { type: Number, required: true, default: 0, min: 0 },
    records_upserted: { type: Number, required: true, default: 0, min: 0 },
    errors: { type: [String], required: true, default: [] },
    message: { type: String },
  },
  { collection: 'ingestion_logs', versionKey: false, suppressReservedKeysWarning: true },
);

IngestionLogMongooseSchema.index({ source_id: 1, started_at: -1 });

export const IngestionLogModel = mongoose.model<IngestionLogDocument>(
  'IngestionLog',
  IngestionLogMongooseSchema,
);
