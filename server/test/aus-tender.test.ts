import { describe, expect, it } from 'vitest';
import {
  ausTenderFeedUrl,
  australianFinancialYear,
  createAusTenderConnector,
  defaultAusTenderWindow,
  dollarsToCents,
  mapAusTenderRelease,
  transformAusTenderReleases,
} from '../src/connectors/index.js';
import type { RawRecord } from '../src/connectors/types.js';

/**
 * Trimmed fixture taken from a real contractPublished response. The first party
 * is deliberately the supplier so a `parties[0]` buyer bug fails this test; the
 * buyer is only found by its `procuringEntity`/`buyer` role.
 */
function releaseA(): RawRecord {
  return {
    ocid: 'prod-aaaa1111',
    id: 'prod-aaaa1111-release-1',
    date: '2025-07-01T23:55:37Z',
    parties: [
      {
        id: 'supplier-1',
        name: 'Capital Recruit Pty Ltd',
        address: {
          locality: 'Fyshwick',
          region: 'ACT',
          postalCode: '2609',
          countryName: 'AUSTRALIA',
        },
        roles: ['supplier'],
      },
      {
        id: 'buyer-1',
        name: 'Australian Transaction Reports and Analysis Centre',
        address: {},
        roles: ['procuringEntity'],
      },
    ],
    contracts: [
      {
        id: 'CN4166097',
        awardID: 'CN4166097-award',
        dateSigned: '2025-07-01T23:55:37Z',
        description: 'Labour Hire Service Provider #1/7',
        title: 'AC2594/07',
        items: [{ id: 'item-1', classification: { scheme: 'UNSPSC', id: '80111600' } }],
        period: { startDate: '2025-06-29T14:00:00Z', endDate: '2026-06-29T14:00:00Z' },
        value: { currency: 'AUD', amount: '12950.00' },
        status: 'active',
      },
    ],
    tender: { procurementMethod: 'open', procurementMethodDetails: 'Open tender' },
    buyer: null,
  };
}

function releaseB(): RawRecord {
  return {
    ocid: 'prod-bbbb2222',
    id: 'prod-bbbb2222-release-1',
    date: '2025-06-30T01:00:00Z',
    parties: [
      { id: 'buyer-2', name: 'Department of Example', roles: ['buyer'] },
      { id: 'supplier-2', name: 'Example Tenderer', roles: ['tenderer'] },
    ],
    contracts: [
      {
        id: 'CN0000001',
        dateSigned: '2025-06-30T01:00:00Z',
        title: null,
        description: 'A contract with no title and no party address',
        items: [],
        value: { currency: 'AUD', amount: '847145.20' },
        status: 'active',
      },
    ],
    buyer: null,
  };
}

describe('AusTender mapping', () => {
  it('maps contracts[0], role-based parties and provenance fields', () => {
    const { record, skip } = mapAusTenderRelease(releaseA());
    expect(skip).toBeNull();
    expect(record).toMatchObject({
      natural_key: 'prod-aaaa1111',
      measure_type: 'contract',
      amount_cents: 1_295_000,
      fiscal_year: '2025-26',
      jurisdiction_level: 'federal',
      jurisdiction: 'Commonwealth',
      source_id: 'aus-tender',
      source_dataset: 'AusTender OCDS API',
      source_date: '2025-07-01T23:55:37Z',
      source_url: 'https://www.tenders.gov.au/Contract/Details/CN4166097',
      project_name: 'AC2594/07',
      description: 'Labour Hire Service Provider #1/7',
      // Buyer/procuringEntity, not parties[0] (the supplier).
      funding_source: 'Australian Transaction Reports and Analysis Centre',
      delivery_entity: 'Capital Recruit Pty Ltd',
      location: { state: 'ACT' },
      data_quality_flag: 'location_approximate',
      unspsc: '80111600',
      verified: false,
    });
    expect(Number.isSafeInteger(record?.amount_cents)).toBe(true);
    expect(record?.source_url).toMatch(/^https:\/\/www\.tenders\.gov\.au\//);
    expect(record?.notes).toContain('supplier postcode 2609');
  });

  it('handles a null title, buyer role, tenderer role and a missing address', () => {
    const { record } = mapAusTenderRelease(releaseB());
    expect(record?.project_name).toBeUndefined();
    expect(record?.description).toBe('A contract with no title and no party address');
    expect(record?.amount_cents).toBe(84_714_520);
    expect(record?.fiscal_year).toBe('2024-25');
    expect(record?.funding_source).toBe('Department of Example');
    expect(record?.delivery_entity).toBe('Example Tenderer');
    expect(record?.location).toBeUndefined();
    expect(record?.data_quality_flag).toBe('location_unknown');
    expect(record?.unspsc).toBeUndefined();
  });

  it('skips a release with a missing/invalid amount rather than writing a non-integer', () => {
    const broken = releaseA();
    const contract = (broken.contracts as Record<string, unknown>[])[0]!;
    (contract.value as Record<string, unknown>).amount = 'not-a-number';
    const { record, skip } = mapAusTenderRelease(broken);
    expect(record).toBeNull();
    expect(skip?.ocid).toBe('prod-aaaa1111');
    expect(skip?.reason).toMatch(/amount/i);
  });

  it('skips a release with no contracts and one with no ocid', () => {
    expect(mapAusTenderRelease({ ...releaseA(), contracts: [] }).skip?.reason).toMatch(/contracts/);
    expect(mapAusTenderRelease({ ...releaseA(), ocid: undefined }).skip?.reason).toMatch(/ocid/);
  });

  it('deduplicates releases by ocid and keeps the newest date', () => {
    const newer = releaseA();
    (newer.contracts as Record<string, unknown>[])[0]!.value = {
      currency: 'AUD',
      amount: '999.00',
    };
    newer.date = '2025-08-01T00:00:00Z';
    const result = transformAusTenderReleases([releaseA(), newer, releaseB()]);
    expect(result.records).toHaveLength(2);
    expect(result.duplicates).toBe(1);
    const deduped = result.records.find((record) => record.natural_key === 'prod-aaaa1111');
    expect(deduped?.amount_cents).toBe(99_900);
  });

  it('converts decimal-dollar strings to safe integer cents', () => {
    expect(dollarsToCents('12950.00')).toBe(1_295_000);
    expect(dollarsToCents('847145.20')).toBe(84_714_520);
    expect(dollarsToCents('0')).toBe(0);
    expect(dollarsToCents(12.34)).toBe(1_234);
    expect(dollarsToCents('1,234.56')).toBe(123_456);
    expect(dollarsToCents('-1.00')).toBeNull();
    expect(dollarsToCents('abc')).toBeNull();
    expect(dollarsToCents(undefined)).toBeNull();
    expect(dollarsToCents('1e999')).toBeNull();
  });

  it('derives Australian financial years with July–June boundaries', () => {
    expect(australianFinancialYear('2025-06-30T23:59:59Z')).toBe('2024-25');
    expect(australianFinancialYear('2025-07-01T00:00:00Z')).toBe('2025-26');
    expect(australianFinancialYear('2025-12-31T00:00:00Z')).toBe('2025-26');
    expect(australianFinancialYear('2026-01-01T00:00:00Z')).toBe('2025-26');
    expect(australianFinancialYear('not-a-date')).toBeNull();
  });

  it('builds the contractPublished path and rejects a cursor off-host', async () => {
    const window = { startDate: '2026-11-02T00:00:00Z', endDate: '2026-11-09T00:00:00Z' };
    expect(ausTenderFeedUrl(window)).toBe(
      'https://api.tenders.gov.au/ocds/findByDates/contractPublished/2026-11-02T00:00:00Z/2026-11-09T00:00:00Z',
    );
    const connector = createAusTenderConnector({
      ...window,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            releases: [releaseA()],
            links: { next: 'https://evil.example/steal' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      sleep: async () => {},
    });
    await expect(connector.fetch()).rejects.toThrow(/left the API host/);
  });
});

describe('AusTender pagination and rate limiting', () => {
  it('follows the cursor, waits between pages and stops at the page limit', async () => {
    const requested: string[] = [];
    const sleeps: number[] = [];
    const pages = [
      {
        releases: [releaseA()],
        links: { next: 'https://api.tenders.gov.au/ocds/findByDates/contractPublished/x?cursor=1' },
      },
      { releases: [releaseB()], links: {} },
    ];
    let index = 0;
    const connector = createAusTenderConnector({
      startDate: '2026-11-02T00:00:00Z',
      endDate: '2026-11-09T00:00:00Z',
      pageLimit: 2,
      delayMs: 1_000,
      fetchImpl: async (input) => {
        requested.push(String(input));
        const body = pages[index] ?? { releases: [], links: {} };
        index += 1;
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    const raw = await connector.fetch();
    expect(raw).toHaveLength(2);
    expect(requested[0]).toContain(
      '/findByDates/contractPublished/2026-11-02T00:00:00Z/2026-11-09T00:00:00Z',
    );
    expect(requested[1]).toContain('cursor=1');
    expect(sleeps).toEqual([1_000]);
    const records = connector.transform(raw);
    expect(records).toHaveLength(2);
    expect(connector.metadata.errors).toEqual([]);

    const limited = createAusTenderConnector({
      startDate: '2026-11-02T00:00:00Z',
      endDate: '2026-11-09T00:00:00Z',
      pageLimit: 1,
      delayMs: 0,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            releases: [releaseA()],
            links: {
              next: 'https://api.tenders.gov.au/ocds/findByDates/contractPublished/x?cursor=2',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      sleep: async () => {},
    });
    const limitedRaw = await limited.fetch();
    limited.transform(limitedRaw);
    expect(limited.metadata.errors).toEqual(['page limit 1 reached; results truncated']);
  });

  it('honours Retry-After on 429 before retrying', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const connector = createAusTenderConnector({
      startDate: '2026-11-02T00:00:00Z',
      endDate: '2026-11-09T00:00:00Z',
      pageLimit: 1,
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return new Response('rate limited', {
            status: 429,
            headers: { 'retry-after': '2' },
          });
        }
        return new Response(JSON.stringify({ releases: [releaseA()], links: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    const raw = await connector.fetch();
    expect(calls).toBe(2);
    expect(sleeps).toEqual([2_000]);
    expect(raw).toHaveLength(1);
  });

  it('backs off exponentially and gives up after the retry budget', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const connector = createAusTenderConnector({
      startDate: '2026-11-02T00:00:00Z',
      endDate: '2026-11-09T00:00:00Z',
      maxRetries: 2,
      fetchImpl: async () => {
        calls += 1;
        return new Response('rate limited', { status: 429 });
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    await expect(connector.fetch()).rejects.toThrow(/rate limited/i);
    expect(calls).toBe(3);
    expect(sleeps).toEqual([1_000, 2_000]);
  });

  it('rejects an unexpected envelope instead of silently ingesting nothing', async () => {
    const connector = createAusTenderConnector({
      fetchImpl: async () =>
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      sleep: async () => {},
    });
    await expect(connector.fetch()).rejects.toThrow(/releases/);
  });
});

describe('AusTender default window', () => {
  it('uses the seven complete days before today', () => {
    const window = defaultAusTenderWindow(new Date('2026-11-16T12:00:00Z'));
    expect(window).toEqual({
      startDate: '2026-11-09T00:00:00Z',
      endDate: '2026-11-16T00:00:00Z',
    });
  });
});

// Opt-in live smoke: `AUSTENDER_LIVE_TEST=1 npm test -w server -- aus-tender`.
describe.skipIf(process.env.AUSTENDER_LIVE_TEST !== '1')('AusTender live smoke', () => {
  it('fetches one real page, maps records with mandatory provenance', async () => {
    const connector = createAusTenderConnector({
      startDate: '2026-11-02T00:00:00Z',
      endDate: '2026-11-09T00:00:00Z',
      pageLimit: 1,
      delayMs: 0,
    });
    const raw = await connector.fetch();
    expect(raw.length).toBeGreaterThan(0);
    const records = connector.transform(raw);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.jurisdiction_level).toBe('federal');
      expect(record.natural_key).toBeTruthy();
      expect(record.source_url).toMatch(/^https:\/\/www\.tenders\.gov\.au\//);
      expect(Number.isSafeInteger(record.amount_cents)).toBe(true);
      expect(record.source_dataset).toBe('AusTender OCDS API');
      expect(record.source_date).toBeTruthy();
      expect(record.data_quality_flag).toBeTruthy();
    }
  }, 60_000);
});
