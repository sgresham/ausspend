import mongoose, { Schema } from 'mongoose';

/**
 * How the local archive copy was obtained.
 *
 * - `wayback`  — a Wayback Machine snapshot of a publisher URL
 * - `arcgis`   — an ArcGIS REST feature query (JSON/GeoJSON)
 * - `direct`   — the publisher's own stable URL
 * - `other`    — anything else (manual, council portal download, …)
 */
export type SourceArchivedFrom = 'wayback' | 'arcgis' | 'direct' | 'other';

/**
 * A single archived source document (XLSX, CSV, JSON, PDF, HTML …).
 *
 * The bytes live *outside* the application repository; this record is the
 * provenance index. `sha256` is the identity: re-downloading the same URL may
 * yield different bytes, so every downloaded copy gets its own record keyed by
 * `document_id`.
 */
export interface SourceDocumentDocument {
  document_id: string;
  source_id: string;
  title: string;
  /** Canonical publisher URL (what a human would cite). */
  original_url: string;
  /** Exact URL that produced the archived bytes (Wayback/direct/ArcGIS query). */
  retrieved_from: string;
  archived_from: SourceArchivedFrom;
  /** Absolute path on the host; must live outside the application repo. */
  local_path: string;
  sha256: string;
  bytes: number;
  content_type: string;
  fetched_at: Date;
  last_modified?: string | null;
  etag?: string | null;
  /** Whether the SHA-256 sidecar was re-verified after archiving. */
  hash_verified: boolean;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

const SHA256_REGEX = /^[a-f0-9]{64}$/;

const SourceDocumentMongooseSchema = new Schema<SourceDocumentDocument>(
  {
    document_id: { type: String, required: true, unique: true, index: true },
    source_id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    original_url: { type: String, required: true },
    retrieved_from: { type: String, required: true },
    archived_from: {
      type: String,
      required: true,
      enum: ['wayback', 'arcgis', 'direct', 'other'],
      index: true,
    },
    local_path: { type: String, required: true },
    sha256: {
      type: String,
      required: true,
      match: [SHA256_REGEX, 'sha256 must be 64 lowercase hex characters'],
      index: true,
    },
    bytes: { type: Number, required: true, min: 0 },
    content_type: { type: String, required: true },
    fetched_at: { type: Date, required: true },
    last_modified: { type: String, default: null },
    etag: { type: String, default: null },
    hash_verified: { type: Boolean, required: true, default: false },
    notes: { type: String },
  },
  {
    collection: 'source_documents',
    versionKey: false,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    suppressReservedKeysWarning: true,
  },
);

SourceDocumentMongooseSchema.index({ source_id: 1, sha256: 1 }, { unique: true });

export const SourceDocumentModel = mongoose.model<SourceDocumentDocument>(
  'SourceDocument',
  SourceDocumentMongooseSchema,
);
