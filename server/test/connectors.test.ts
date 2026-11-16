import { describe, expect, it } from 'vitest';
import {
  CONNECTORS,
  CONNECTOR_IDS,
  connectorSummary,
  getConnector,
} from '../src/connectors/index.js';

const LIVE_IDS = ['aus-tender', 'data-gov-au-pbs', 'nsw-budget', 'data-nsw-ckan', 'dubbo-council'];
const STUB_IDS = CONNECTOR_IDS.filter((id) => !LIVE_IDS.includes(id));

describe('federal connector registry', () => {
  it('ships thirteen connectors with unique ids including the federal source ids', () => {
    expect(CONNECTORS).toHaveLength(13);
    expect(new Set(CONNECTOR_IDS).size).toBe(13);
    expect(CONNECTOR_IDS).toEqual(CONNECTOR_IDS.map((id) => id.toLowerCase()));
    expect(CONNECTOR_IDS).toEqual(
      expect.arrayContaining(['aus-tender', 'data-gov-au-pbs', 'grantconnect']),
    );
  });

  it('registers AusTender, PBS, NSW Budget, CKAN and Dubbo as live and the other eight as stubs', () => {
    for (const id of LIVE_IDS) {
      const connector = getConnector(id);
      expect(connector?.status).toBe('active');
      expect(typeof connector?.fetch).toBe('function');
    }

    for (const id of STUB_IDS) {
      const connector = getConnector(id);
      expect(connector?.status).toBe('stub');
      expect(() => connector?.fetch()).toThrow(/not implemented/i);
      expect(() => connector?.fetch()).toThrow(new RegExp(connector!.id));
      expect(connector?.transform([{ id: 'raw' }])).toEqual([]);
    }
  });

  it('exposes serialisable coverage and run metadata only', () => {
    const summaries = CONNECTORS.map(connectorSummary);
    expect(JSON.parse(JSON.stringify(summaries))).toEqual(summaries);
    for (const summary of summaries) {
      expect(Object.keys(summary).sort()).toEqual([
        'deferred_resources',
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
      expect(summary.jurisdiction_level).toBeTruthy();
      expect(summary.source_url).toMatch(/^https:\/\//);
    }
    for (const id of LIVE_IDS) {
      expect(summaries.find((summary) => summary.id === id)?.status).toBe('active');
    }
    for (const summary of summaries.filter((entry) => !LIVE_IDS.includes(entry.id))) {
      expect(summary.status).toBe('stub');
      expect(summary.last_fetched_at).toBeNull();
      expect(summary.records_ingested).toBe(0);
      expect(summary.errors).toEqual([]);
    }
  });

  it('looks connectors up by id and keeps GrantConnect pending', () => {
    expect(getConnector('federal-budget-portal')?.publisher).toMatch(/Finance/);
    expect(getConnector('aus-tender')?.jurisdiction_level).toBe('federal');
    expect(getConnector('aus-tender')?.publisher).toMatch(/Finance/);
    expect(getConnector('data-gov-au-pbs')?.status).toBe('active');
    expect(getConnector('data-gov-au-pbs')?.source_url).toContain('data.gov.au');
    expect(getConnector('grantconnect')?.status).toBe('stub');
    expect(getConnector('nsw-budget')?.status).toBe('active');
    expect(getConnector('nsw-budget')?.jurisdiction_level).toBe('state');
    expect(getConnector('nsw-budget')?.source_url).toContain('budget.nsw.gov.au');
    expect(getConnector('data-nsw-ckan')?.status).toBe('active');
    expect(getConnector('data-nsw-ckan')?.jurisdiction_level).toBe('state');
    expect(getConnector('data-nsw-ckan')?.source_url).toContain('data.nsw.gov.au');
    expect(getConnector('data-nsw-ckan')?.deferredResources).toEqual([]);
    expect(getConnector('dubbo-council')?.status).toBe('active');
    expect(getConnector('dubbo-council')?.jurisdiction_level).toBe('local');
    expect(getConnector('dubbo-council')?.source_url).toContain('dubbo.nsw.gov.au');
    expect(getConnector('nope')).toBeUndefined();
  });
});
