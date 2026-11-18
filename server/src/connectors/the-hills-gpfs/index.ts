import { createTheHillsGpfsConnector } from './parse.js';

export * from './parse.js';
export * from './meta.js';
export * from './config.js';

/** Discovered by scripts/generate-connector-manifest.mjs. */
export const connectorModule = {
  id: 'the-hills-gpfs',
  create: createTheHillsGpfsConnector,
} as const;
