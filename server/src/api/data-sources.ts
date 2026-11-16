import type { RequestHandler } from 'express';
import { DataSourceModel } from '../models/index.js';

export const listDataSources: RequestHandler = async (_req, res) => {
  const sources = await DataSourceModel.find({}).sort({ source_id: 1 }).lean();

  res.json({
    sources: sources.map((source) => ({
      source_id: source.source_id,
      name: source.name,
      publisher: source.publisher,
      source_url: source.source_url,
      retrieved_at: source.retrieved_at,
      license: source.license,
      verified: source.verified,
      ...(source.notes ? { notes: source.notes } : {}),
    })),
  });
};
