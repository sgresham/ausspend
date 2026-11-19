import { createWalgettGpfsConnector } from './parse.js';

export * from './parse.js';
export * from './meta.js';
export * from './config.js';

/** Discovered by scripts/generate-connector-manifest.mjs. */
export const connectorModule = {
  id: 'walgett-gpfs',
  create: createWalgettGpfsConnector,
} as const;
