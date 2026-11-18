import { createKuRingGaiGpfsConnector } from './parse.js';

export * from './parse.js';
export * from './meta.js';
export * from './config.js';

/** Discovered by scripts/generate-connector-manifest.mjs. */
export const connectorModule = {
  id: 'ku-ring-gai-gpfs',
  create: createKuRingGaiGpfsConnector,
} as const;
