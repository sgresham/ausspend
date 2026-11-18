import { createHornsbyGpfsConnector } from './parse.js';

export * from './parse.js';
export * from './meta.js';
export * from './browser.js';

/** Discovered by scripts/generate-connector-manifest.mjs. */
export const connectorModule = {
  id: 'hornsby-gpfs',
  create: createHornsbyGpfsConnector,
} as const;
