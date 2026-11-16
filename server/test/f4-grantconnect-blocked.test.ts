import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CONNECTOR_IDS,
  getConnector,
  runIngestion,
  type Connector,
} from '../src/connectors/index.js';
import { DataSourceModel, IngestionLogModel, MeasureModel } from '../src/models/index.js';

/**
 * F4 GrantConnect — Track A adaptor is BLOCKED.
 *
 * The cited Apify actor `australia-grantconnect-monitor` does not exist (HTTP 404) and the only
 * public alternative (`tacps126/grants-radar`) requires an Apify token/credits (HTTP 402 when
 * unauthenticated) and returns funding calls, not award records. GrantConnect is therefore shipped
 * as a stub: no token, no request, no records, no crash. These tests pin that honest behaviour and
 * the runner's continue-on-error handling for a future wired-but-unauthenticated adaptor.
 */
const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_f4_gc`;

const grantconnect = getConnector('grantconnect')!;

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
});

beforeEach(async () => {
  await Promise.all([
    DataSourceModel.deleteMany({}),
    IngestionLogModel.deleteMany({}),
    MeasureModel.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('F4 GrantConnect — blocked Track A adaptor', () => {
  it('registers grantconnect as an unverified federal stub with no live connector', () => {
    expect(CONNECTOR_IDS).toContain('grantconnect');
    expect(grantconnect).toBeDefined();
    expect(grantconnect.status).toBe('stub');
    expect(grantconnect.jurisdiction_level).toBe('federal');
    expect(grantconnect.source_url).toBe('https://www.grants.gov.au/');
  });

  it('makes no network call and returns no records when no adaptor token is set', () => {
    const savedToken = process.env.APIFY_TOKEN;
    delete process.env.APIFY_TOKEN;
    try {
      // The stub is local-only: it never attempts an Apify request.
      expect(() => grantconnect.fetch()).toThrow(/not implemented/i);
      expect(() => grantconnect.fetch()).toThrow(/grantconnect/);
      expect(grantconnect.transform([{ id: 'raw' }])).toEqual([]);
    } finally {
      if (savedToken === undefined) delete process.env.APIFY_TOKEN;
      else process.env.APIFY_TOKEN = savedToken;
    }
  });

  it('runs as skipped/stub: zero rows, zero grant rows, no crash', async () => {
    const result = await runIngestion({
      connectors: [grantconnect],
      now: () => new Date('2026-11-16T00:00:00.000Z'),
    });

    expect(result.results).toEqual([
      {
        source_id: 'grantconnect',
        name: grantconnect.name,
        status: 'stub',
        log_status: 'skipped',
        records_fetched: 0,
        records_upserted: 0,
        errors: [],
      },
    ]);

    const log = await IngestionLogModel.findOne({ source_id: 'grantconnect' }).lean();
    expect(log).toMatchObject({
      status: 'skipped',
      records_fetched: 0,
      records_upserted: 0,
      errors: [],
    });

    const source = await DataSourceModel.findOne({ source_id: 'grantconnect' }).lean();
    expect(source).toMatchObject({ status: 'stub', records_ingested: 0, errors: [] });

    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(0);
    expect(await MeasureModel.countDocuments({ measure_type: 'grant_award' })).toBe(0);
  });

  it('treats a wired adaptor with a missing token as degraded/error, not a crash', async () => {
    // Simulates the only future Track A shape we would accept: an active adaptor that fails
    // closed when its paid credential is absent. It must produce no records and let the run continue.
    const adaptorWithoutToken: Connector = {
      ...grantconnect,
      status: 'active',
      fetch: async () => {
        throw new Error(
          'GrantConnect adaptor blocked: APIFY_TOKEN is not set (the cited actor does not exist; the only alternative is paid)',
        );
      },
      transform: () => [],
      metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [] },
    };

    const result = await runIngestion({ connectors: [adaptorWithoutToken] });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      source_id: 'grantconnect',
      status: 'error',
      log_status: 'error',
      records_fetched: 0,
      records_upserted: 0,
    });
    expect(result.results[0].errors[0]).toMatch(/APIFY_TOKEN/);

    const log = await IngestionLogModel.findOne({ source_id: 'grantconnect' }).lean();
    expect(log).toMatchObject({ status: 'error', records_fetched: 0, records_upserted: 0 });
    expect(log?.errors?.[0]).toMatch(/APIFY_TOKEN/);

    const source = await DataSourceModel.findOne({ source_id: 'grantconnect' }).lean();
    expect(source).toMatchObject({ status: 'degraded', records_ingested: 0 });
    expect(source?.errors).toHaveLength(1);

    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(0);
    expect(await MeasureModel.countDocuments({ measure_type: 'grant_award' })).toBe(0);
  });
});
