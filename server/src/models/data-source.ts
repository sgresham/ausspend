import mongoose, { Schema } from 'mongoose';

export type DataSourceStatus = 'stub' | 'active' | 'degraded';

export type DataSourceFetchStrategy = 'direct' | 'parliament_fallback' | 'headless';

/**
 * A resource that was deliberately not ingested in this phase (for example a
 * PDF/DOCX whose extraction belongs to the separate PDF foundation). It is
 * recorded on the source so the deferral is visible in the API and UI rather
 * than silently disappearing.
 */
export interface DeferredResource {
  package_id: string;
  package_name: string;
  dataset_title: string;
  resource_id: string;
  name: string;
  format: string;
  url: string;
  reason: string;
}

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
  /** Last successful ingestion (not the last attempt). */
  last_ingested_at?: Date | null;
  /** How the most recent successful run obtained the source document. */
  fetch_strategy?: DataSourceFetchStrategy | null;
  /** Last successful document fetch; preserved across failed refreshes. */
  last_successful_fetch?: Date | null;
  /** Whole days since last_successful_fetch; preserved across failed refreshes. */
  staleness_days?: number | null;
  records_ingested: number;
  errors: string[];
  deferred_resources: DeferredResource[];
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
    fetch_strategy: {
      type: String,
      enum: ['direct', 'parliament_fallback', 'headless'],
      default: null,
    },
    last_successful_fetch: { type: Date, default: null },
    staleness_days: { type: Number, default: null, min: 0 },
    records_ingested: { type: Number, required: true, default: 0, min: 0 },
    errors: { type: [String], required: true, default: [] },
    deferred_resources: {
      type: [
        new Schema<DeferredResource>(
          {
            package_id: { type: String, required: true },
            package_name: { type: String, required: true },
            dataset_title: { type: String, required: true },
            resource_id: { type: String, required: true },
            name: { type: String, required: true },
            format: { type: String, required: true },
            url: { type: String, required: true },
            reason: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { collection: 'data_sources', versionKey: false, suppressReservedKeysWarning: true },
);

export const DataSourceModel = mongoose.model<DataSourceDocument>(
  'DataSource',
  DataSourceMongooseSchema,
);
