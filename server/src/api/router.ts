import { Router } from 'express';
import type { DbStatus } from '../db.js';
import { getBenchmark } from './benchmark.js';
import { getPnfcBenchmark } from './benchmark-pnfc.js';
import { createCoverageHandler } from './coverage.js';
import { listDataSources } from './data-sources.js';
import { listIngestionLogs } from './ingestion-logs.js';
import { listSourceDocuments } from './source-documents.js';
import { getFunction } from './function-detail.js';
import { listFunctions } from './functions-list.js';
import { listRegions } from './regions-list.js';
import { getArea, getRegion, getState } from './region-detail.js';
import { search } from './search.js';
import { getSoc } from './soc.js';
import { getSpending, listSpending } from './spending.js';

export interface ApiRouterOptions {
  pingDb?: () => Promise<DbStatus>;
}

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  router.get('/meta/coverage', createCoverageHandler(options.pingDb));
  router.get('/benchmark', getBenchmark);
  router.get('/benchmark/pnfc', getPnfcBenchmark);
  router.get('/soc', getSoc);
  router.get('/data-sources', listDataSources);
  router.get('/source-documents', listSourceDocuments);
  router.get('/ingestion-logs', listIngestionLogs);
  router.get('/functions', listFunctions);
  router.get('/functions/:code', getFunction);
  router.get('/regions', listRegions);
  router.get('/regions/:regionId', getRegion);
  // Contract C alias: /api/region/dubbo and /api/areas/dubbo share the profile.
  router.get('/region/:regionId', getRegion);
  router.get('/areas/:slug', getArea);
  router.get('/states/:code', getState);
  router.get('/spending', listSpending);
  router.get('/spending/:id', getSpending);
  router.get('/search', search);

  return router;
}
