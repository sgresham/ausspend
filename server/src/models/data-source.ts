import mongoose, { Schema } from 'mongoose';

export type DataSourceStatus = 'stub' | 'active' | 'degraded';

export interface DataSourceDocument {
  source_id: string;
  name: string;
  publisher: string;
  source_url: string;
  retrieved_at: string;
  license: string;
  verified: boolean;
  notes?: string;
  status: DataSourceStatus;
  last_ingested_at?: Date | null;
  records_ingested: number;
  errors: string[];
}

const DataSourceMongooseSchema = new Schema<DataSourceDocument>(
  {
    source_id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    publisher: { type: String, required: true },
    source_url: { type: String, required: true },
    retrieved_at: { type: String, required: true },
    license: { type: String, required: true },
    verified: { type: Boolean, required: true, default: false },
    notes: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['stub', 'active', 'degraded'],
      default: 'stub',
      index: true,
    },
    last_ingested_at: { type: Date, default: null },
    records_ingested: { type: Number, required: true, default: 0, min: 0 },
    errors: { type: [String], required: true, default: [] },
  },
  { collection: 'data_sources', versionKey: false, suppressReservedKeysWarning: true },
);

export const DataSourceModel = mongoose.model<DataSourceDocument>(
  'DataSource',
  DataSourceMongooseSchema,
);
