import { createCobarGpfsConnector } from './parse.js';

export * from './parse.js';
export * from './meta.js';
export * from './config.js';

/** Discovered by scripts/generate-connector-manifest.mjs. */
export const connectorModule = {
  id: 'cobar-gpfs',
  create: createCobarGpfsConnector,
} as const;
