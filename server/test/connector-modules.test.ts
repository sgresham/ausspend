import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONNECTOR_IDS, getConnector } from '../src/connectors/registry.js';
import {
  MODULAR_CONNECTORS,
  MODULAR_CONNECTOR_IDS,
  MODULAR_CONNECTOR_MODULES,
} from '../src/connectors/generated-connectors.js';

describe('modular connector contract', () => {
  it('finds every module and builds a valid Connector', () => {
    expect(MODULAR_CONNECTOR_MODULES.length).toBeGreaterThan(0);
    expect(MODULAR_CONNECTORS).toHaveLength(MODULAR_CONNECTOR_MODULES.length);
    for (const module of MODULAR_CONNECTOR_MODULES) {
      expect(module.id).toBeTruthy();
      const connector = module.create();
      expect(connector.id).toBe(module.id);
      expect(connector.name).toBeTruthy();
      expect(connector.publisher).toBeTruthy();
      expect(connector.source_url).toBeTruthy();
      expect(connector.status).toMatch(/^(active|degraded|stub)$/);
      expect(connector.license).toBeTruthy();
      expect(connector.notes).toBeTruthy();
      expect(typeof connector.fetch).toBe('function');
      expect(typeof connector.transform).toBe('function');
      expect(getConnector(connector.id)?.id).toBe(connector.id);
    }
  });

  it('registers every module exactly once and generates its source doc', () => {
    expect(new Set(MODULAR_CONNECTOR_IDS).size).toBe(MODULAR_CONNECTOR_IDS.length);
    for (const id of MODULAR_CONNECTOR_IDS) {
      expect(CONNECTOR_IDS.filter((candidate) => candidate === id)).toHaveLength(1);
      expect(existsSync(path.resolve('docs/sources', `${id}.md`))).toBe(true);
    }
  });
});
