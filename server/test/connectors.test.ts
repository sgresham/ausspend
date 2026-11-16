import { describe, expect, it } from 'vitest';
import {
  CONNECTORS,
  CONNECTOR_IDS,
  connectorSummary,
  getConnector,
} from '../src/connectors/index.js';

describe('stub connectors', () => {
  it('ships exactly eight connectors with unique ids', () => {
    expect(CONNECTORS).toHaveLength(8);
    expect(new Set(CONNECTOR_IDS).size).toBe(8);
    expect(CONNECTOR_IDS).toEqual(CONNECTOR_IDS.map((id) => id.toLowerCase()));
  });

  it('every fetch throws a clear not-implemented error and never returns data', () => {
    for (const connector of CONNECTORS) {
      expect(() => connector.fetch()).toThrow(/not implemented/i);
      expect(() => connector.fetch()).toThrow(new RegExp(connector.id));
    }
  });

  it('exposes serialisable metadata only (id/name/publisher/source_url/status)', () => {
    const summaries = CONNECTORS.map(connectorSummary);
    expect(JSON.parse(JSON.stringify(summaries))).toEqual(summaries);
    for (const summary of summaries) {
      expect(Object.keys(summary).sort()).toEqual([
        'id',
        'name',
        'publisher',
        'source_url',
        'status',
      ]);
      expect(summary.status).toBe('stub');
      expect(summary.source_url).toMatch(/^https:\/\//);
    }
  });

  it('looks connectors up by id', () => {
    expect(getConnector('federal-budget-portal')?.publisher).toMatch(/Finance/);
    expect(getConnector('nope')).toBeUndefined();
  });
});
