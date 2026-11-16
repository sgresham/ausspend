import { Router } from 'express';
import type { DbStatus } from '../db.js';
import { createCoverageHandler } from './coverage.js';
import { listDataSources } from './data-sources.js';
import { getFunction } from './function-detail.js';
import { listFunctions } from './functions-list.js';
import { listRegions } from './regions-list.js';
import { getRegion, getState } from './region-detail.js';
import { search } from './search.js';
import { getSpending, listSpending } from './spending.js';

export interface ApiRouterOptions {
  pingDb?: () => Promise<DbStatus>;
}

export function createApiRouter(options: ApiRouterOptions = {}): Router {
  const router = Router();

  router.get('/meta/coverage', createCoverageHandler(options.pingDb));
  router.get('/data-sources', listDataSources);
  router.get('/functions', listFunctions);
  router.get('/functions/:code', getFunction);
  router.get('/regions', listRegions);
  router.get('/regions/:regionId', getRegion);
  router.get('/states/:code', getState);
  router.get('/spending', listSpending);
  router.get('/spending/:id', getSpending);
  router.get('/search', search);

  return router;
}
