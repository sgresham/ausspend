import mongoose, { Schema } from 'mongoose';

/**
 * A SOC document that was deliberately **not** ingested because its printed
 * unit or table layout could not be validated unambiguously. It is recorded so
 * the deferral is visible in the API/UI instead of silently disappearing.
 *
 * A deferred document is never a source of measures: no row from it may be
 * ingested until a human resolves the reason and the document is re-parsed.
 */
export interface DeferredSocDocumentDocument {
  source_id: string;
  entity: string;
  jurisdiction: string;
  fiscal_year?: string;
  title: string;
  document_url: string;
  sha256?: string;
  reason: string;
  discovered_at: Date;
  status: 'deferred' | 'resolved';
  notes?: string;
}

const DeferredSocDocumentSchema = new Schema<DeferredSocDocumentDocument>(
  {
    source_id: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    jurisdiction: { type: String, required: true },
    fiscal_year: { type: String },
    title: { type: String, required: true },
    document_url: { type: String, required: true },
    sha256: { type: String },
    reason: { type: String, required: true },
    discovered_at: { type: Date, required: true, default: () => new Date() },
    status: { type: String, enum: ['deferred', 'resolved'], required: true, default: 'deferred' },
    notes: { type: String },
  },
  { collection: 'deferred_soc_documents', versionKey: false },
);

DeferredSocDocumentSchema.index({ source_id: 1, document_url: 1 }, { unique: true });

export const DeferredSocDocumentModel = mongoose.model<DeferredSocDocumentDocument>(
  'DeferredSocDocument',
  DeferredSocDocumentSchema,
);
