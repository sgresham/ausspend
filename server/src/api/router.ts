import { Router } from 'express';
import { listDataSources } from './data-sources.js';
import { getFunction } from './function-detail.js';
import { listFunctions } from './functions-list.js';
import { getRegion, getState } from './region-detail.js';
import { search } from './search.js';

export function createApiRouter(): Router {
  const router = Router();

  router.get('/data-sources', listDataSources);
  router.get('/functions', listFunctions);
  router.get('/functions/:code', getFunction);
  router.get('/regions/:regionId', getRegion);
  router.get('/states/:code', getState);
  router.get('/search', search);

  return router;
}
