import mongoose, { Schema } from 'mongoose';

export interface DataSourceDocument {
  source_id: string;
  name: string;
  publisher: string;
  source_url: string;
  retrieved_at: string;
  license: string;
  verified: boolean;
  notes?: string;
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
  },
  { collection: 'data_sources', versionKey: false },
);

export const DataSourceModel = mongoose.model<DataSourceDocument>(
  'DataSource',
  DataSourceMongooseSchema,
);
