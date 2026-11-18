import type { RequestHandler } from 'express';
import { SourceDocumentModel } from '../models/index.js';

/**
 * Read-only listing of archived source documents (metadata, never bytes).
 *
 *   GET /api/v1/source-documents
 *   GET /api/v1/source-documents?source_id=nsw-budget
 *
 * The bytes live outside the repository; `local_path` + `sha256` let a reviewer
 * verify the exact copy that an ingestion run used. Host filesystem paths are
 * stripped unless EXPOSE_SOURCE_PATHS=true: the production edge also 404s this
 * route (see deploy/nginx/ausspend.conf.template) so paths are never public.
 */
export const listSourceDocuments: RequestHandler = async (req, res) => {
  const exposePaths = process.env.EXPOSE_SOURCE_PATHS === 'true';
  const sourceId = typeof req.query.source_id === 'string' ? req.query.source_id.trim() : '';
  const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 100;

  const filter = sourceId ? { source_id: sourceId } : {};
  const documents = await SourceDocumentModel.find(filter)
    .sort({ source_id: 1, fetched_at: -1, document_id: 1 })
    .limit(limit)
    .lean();

  res.json({
    documents: documents.map((doc) => ({
      document_id: doc.document_id,
      source_id: doc.source_id,
      title: doc.title,
      original_url: doc.original_url,
      retrieved_from: doc.retrieved_from,
      archived_from: doc.archived_from,
      ...(exposePaths ? { local_path: doc.local_path } : {}),
      sha256: doc.sha256,
      bytes: doc.bytes,
      content_type: doc.content_type,
      fetched_at: doc.fetched_at,
      last_modified: doc.last_modified ?? null,
      etag: doc.etag ?? null,
      hash_verified: doc.hash_verified,
      ...(doc.notes ? { notes: doc.notes } : {}),
    })),
  });
};
