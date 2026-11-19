import { createBegaValleyGpfsConnector } from './parse.js';

export * from './parse.js';
export * from './meta.js';
export * from './config.js';

/** Discovered by scripts/generate-connector-manifest.mjs. */
export const connectorModule = {
  id: 'bega-valley-gpfs',
  create: createBegaValleyGpfsConnector,
} as const;
