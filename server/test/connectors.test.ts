import { describe, expect, it } from 'vitest';
import {
  CONNECTORS,
  CONNECTOR_IDS,
  connectorSummary,
  getConnector,
} from '../src/connectors/index.js';

describe('stub connectors', () => {
  it('ships eleven connectors with unique ids including the federal source ids', () => {
    expect(CONNECTORS).toHaveLength(11);
    expect(new Set(CONNECTOR_IDS).size).toBe(11);
    expect(CONNECTOR_IDS).toEqual(CONNECTOR_IDS.map((id) => id.toLowerCase()));
    expect(CONNECTOR_IDS).toEqual(
      expect.arrayContaining(['aus-tender', 'data-gov-au-pbs', 'grantconnect']),
    );
  });

  it('every fetch throws a clear not-implemented error and never returns data', () => {
    for (const connector of CONNECTORS) {
      expect(() => connector.fetch()).toThrow(/not implemented/i);
      expect(() => connector.fetch()).toThrow(new RegExp(connector.id));
    }
  });

  it('every transform returns no records in F1', () => {
    for (const connector of CONNECTORS) {
      expect(connector.transform([{ id: 'raw' }])).toEqual([]);
    }
  });

  it('exposes serialisable coverage and run metadata only', () => {
    const summaries = CONNECTORS.map(connectorSummary);
    expect(JSON.parse(JSON.stringify(summaries))).toEqual(summaries);
    for (const summary of summaries) {
      expect(Object.keys(summary).sort()).toEqual([
        'errors',
        'id',
        'jurisdiction_level',
        'last_fetched_at',
        'name',
        'publisher',
        'records_ingested',
        'source_url',
        'status',
      ]);
      expect(summary.status).toBe('stub');
      expect(summary.jurisdiction_level).toBeTruthy();
      expect(summary.source_url).toMatch(/^https:\/\//);
      expect(summary.last_fetched_at).toBeNull();
      expect(summary.records_ingested).toBe(0);
      expect(summary.errors).toEqual([]);
    }
  });

  it('looks connectors up by id', () => {
    expect(getConnector('federal-budget-portal')?.publisher).toMatch(/Finance/);
    expect(getConnector('aus-tender')?.jurisdiction_level).toBe('federal');
    expect(getConnector('grantconnect')?.status).toBe('stub');
    expect(getConnector('nope')).toBeUndefined();
  });
});
