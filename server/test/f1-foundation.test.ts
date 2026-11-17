import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { DataSourceModel, IngestionLogModel, MeasureModel } from '../src/models/index.js';
import {
  createAusTenderConnector,
  createPbsConnector,
  getConnector,
  runIngestion,
  type Connector,
} from '../src/connectors/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_f1`;

const app = createApp({ pingDb: async () => 'connected' });

function contractRecord(id: string, sourceId = 'fake-contract-source') {
  return {
    amount_cents: 12_345_600,
    measure_type: 'contract' as const,
    fiscal_year: '2024-25',
    source_id: sourceId,
    source_url: `https://example.gov.au/contracts/${id}`,
    verified: false,
    natural_key: `${sourceId}:${id}`,
    project_name: `Example contract ${id}`,
    description: 'Contract-shaped fixture, not real spending.',
    jurisdiction_level: 'federal' as const,
    jurisdiction: 'Australia',
    delivery_entity: 'Department of Example',
    funding_source: 'Consolidated Revenue Fund',
    source_dataset: 'Fake contract notices',
    source_date: '2024-08-01',
    data_quality_flag: 'source-reported',
    location: { state: 'NSW' },
    unspsc: '80101500',
  };
}

function activeConnector(
  id: string,
  transform: (raw: readonly Record<string, unknown>[]) => ReturnType<typeof contractRecord>[],
  fetch: () => Promise<Record<string, unknown>[]>,
): Connector {
  return {
    id,
    name: `Fake connector ${id}`,
    publisher: 'F1 test fixture',
    source_url: `https://example.gov.au/${id}`,
    status: 'active',
    jurisdiction_level: 'federal',
    fetch,
    transform,
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [] },
  };
}

const failingConnector = activeConnector(
  'fake-failing-source',
  () => [],
  async () => {
    throw new Error('fixture network failure');
  },
);

const workingConnector = activeConnector(
  'fake-contract-source',
  () => [contractRecord('c-1')],
  async () => [{ id: 'c-1' }],
);

const stubConnector = getConnector('wa-budget')!;

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('F1 ingestion runner', () => {
  it('logs a skipped stub and an errored source, then continues to a working source', async () => {
    const result = await runIngestion({
      connectors: [stubConnector, failingConnector, workingConnector],
    });

    expect(result.results.map((entry) => `${entry.source_id}:${entry.log_status}`)).toEqual([
      'wa-budget:skipped',
      'fake-failing-source:error',
      'fake-contract-source:success',
    ]);

    const logs = await IngestionLogModel.find({}).sort({ source_id: 1 }).lean();
    expect(logs).toHaveLength(3);
    expect(logs.find((log) => log.source_id === 'wa-budget')).toMatchObject({
      status: 'skipped',
      records_fetched: 0,
      records_upserted: 0,
    });
    expect(logs.find((log) => log.source_id === 'fake-failing-source')).toMatchObject({
      status: 'error',
      errors: ['fixture network failure'],
    });
    expect(logs.find((log) => log.source_id === 'fake-contract-source')).toMatchObject({
      status: 'success',
      records_fetched: 1,
      records_upserted: 1,
    });

    const stubSource = await DataSourceModel.findOne({ source_id: 'wa-budget' }).lean();
    expect(stubSource).toMatchObject({ status: 'stub', records_ingested: 0 });
    const failedSource = await DataSourceModel.findOne({
      source_id: 'fake-failing-source',
    }).lean();
    expect(failedSource).toMatchObject({ status: 'degraded' });
    expect(failedSource?.errors).toEqual(['fixture network failure']);
    const activeSource = await DataSourceModel.findOne({
      source_id: 'fake-contract-source',
    }).lean();
    expect(activeSource).toMatchObject({ status: 'active', records_ingested: 1 });
  });

  it('records a PBS source failure as error/degraded and continues', async () => {
    const failingPbs = createPbsConnector({
      fetchImpl: (async () => {
        throw new Error('ckan fixture failure');
      }) as unknown as typeof fetch,
    });

    const result = await runIngestion({ connectors: [failingPbs, workingConnector] });
    expect(result.results.map((entry) => `${entry.source_id}:${entry.log_status}`)).toEqual([
      'data-gov-au-pbs:error',
      'fake-contract-source:success',
    ]);

    const log = await IngestionLogModel.findOne({
      source_id: 'data-gov-au-pbs',
      status: 'error',
    }).lean();
    expect(log).toMatchObject({
      records_fetched: 0,
      records_upserted: 0,
      errors: ['ckan fixture failure'],
    });
    const source = await DataSourceModel.findOne({ source_id: 'data-gov-au-pbs' }).lean();
    expect(source).toMatchObject({ status: 'degraded', records_ingested: 0 });
    expect(source?.errors).toEqual(['ckan fixture failure']);
  });

  it('upserts a duplicate natural_key instead of duplicating it', async () => {
    await runIngestion({ connectors: [workingConnector] });
    const count = await MeasureModel.countDocuments({ natural_key: 'fake-contract-source:c-1' });
    expect(count).toBe(1);
  });
});

describe('F1 extended measure shape and API', () => {
  it('persists a contract record with no region/function and exposes it on /api and /api/v1', async () => {
    const start = await request(app).get('/api/v1/spending?jurisdiction_level=federal');
    expect(start.status).toBe(200);

    const v1 = await request(app).get(
      '/api/v1/spending?jurisdiction_level=federal&measure_type=contract',
    );
    expect(v1.status).toBe(200);
    expect(v1.body.summary).toMatchObject({
      count: 1,
      mixed: false,
      total_cents: 12_345_600,
      total_measure_type: 'contract',
    });
    expect(v1.body.data[0]).toMatchObject({
      region_id: null,
      function_code: null,
      function_name: null,
      region_code: null,
      measure_type: 'contract',
      project_name: 'Example contract c-1',
      jurisdiction_level: 'federal',
      delivery_entity: 'Department of Example',
      natural_key: 'fake-contract-source:c-1',
      provenance: { source_id: 'fake-contract-source', verified: false },
    });

    const legacy = await request(app).get(
      '/api/spending?jurisdiction_level=federal&measure_type=contract',
    );
    expect(legacy.status).toBe(200);
    expect(legacy.body.data[0].id).toBe(v1.body.data[0].id);

    const detail = await request(app).get(`/api/v1/spending/${v1.body.data[0].id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.natural_key).toBe('fake-contract-source:c-1');
  });

  it('never produces a headline total across mixed measure types', async () => {
    await MeasureModel.create({
      amount_cents: 1_000_000,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: 'fake-actual-source',
      source_url: 'https://example.gov.au/actual/1',
      verified: false,
      natural_key: 'fake-actual-source:1',
      jurisdiction_level: 'federal',
    });

    const mixed = await request(app).get('/api/v1/spending?jurisdiction_level=federal');
    expect(mixed.status).toBe(200);
    expect(mixed.body.summary.mixed).toBe(true);
    expect(mixed.body.summary.total_cents).toBeNull();
    expect(mixed.body.summary.total_measure_type).toBeNull();
    expect(mixed.body.summary.measure_types).toEqual(['actual', 'contract']);
    expect(mixed.body.summary.total_by_measure_type).toEqual([
      { measure_type: 'actual', count: 1, total_cents: 1_000_000 },
      { measure_type: 'contract', count: 1, total_cents: 12_345_600 },
    ]);
  });

  it('serves /api/v1 data-sources, coverage and ingestion-logs aliases', async () => {
    const sources = await request(app).get('/api/v1/data-sources');
    expect(sources.status).toBe(200);
    expect(
      sources.body.sources.find(
        (source: { source_id: string }) => source.source_id === 'fake-contract-source',
      ),
    ).toMatchObject({ status: 'active', records_ingested: 1 });

    const coverage = await request(app).get('/api/v1/meta/coverage');
    expect(coverage.status).toBe(200);
    // ABS GFS, ABS GFS PNFC, AusTender, PBS, GrantConnect (manual export), NSW
    // Budget, CKAN, Dubbo, Dubbo GPFS, City of Sydney GPFS, Blacktown GPFS, Parramatta GPFS, Northern Beaches GPFS, Canterbury-Bankstown GPFS, Sutherland Shire GPFS, Wollongong GPFS, VIC Budget, QLD Budget, QLD QGIP, ACNC charity and
    // Sydney Water, WaterNSW, Hunter Water, Essential Energy, Forestry Corporation, Landcom,
    // Port Authority of NSW, TAHE, Sydney Trains and NSW TrainLink SOC are wired; the remaining four are stubs.
    expect(coverage.body.live_ingestion).toBe(true);
    expect(
      coverage.body.connector_status_counts.active + coverage.body.connector_status_counts.degraded,
    ).toBe(30);
    expect(coverage.body.connector_status_counts.stub).toBe(4);
    expect([
      ...coverage.body.federal_ingestion.live,
      ...coverage.body.federal_ingestion.degraded,
    ]).toEqual(expect.arrayContaining(['aus-tender', 'data-gov-au-pbs']));
    expect(coverage.body.federal_ingestion.pending).toEqual([]);
    expect(coverage.body.supported_measure_types).toContain('contract');
    expect(coverage.body.supported_measure_types).toContain('grant_award');

    const logs = await request(app).get('/api/v1/ingestion-logs');
    expect(logs.status).toBe(200);
    expect(logs.body.logs.length).toBeGreaterThanOrEqual(3);
    expect(logs.body.logs.map((log: { source_id: string }) => log.source_id)).toEqual(
      expect.arrayContaining(['wa-budget', 'fake-failing-source', 'fake-contract-source']),
    );

    const legacyLogs = await request(app).get('/api/ingestion-logs?source_id=wa-budget');
    expect(legacyLogs.status).toBe(200);
    expect(legacyLogs.body.logs[0]).toMatchObject({
      source_id: 'wa-budget',
      status: 'skipped',
    });
  });

  it('accepts null region/function directly on the model', async () => {
    const doc = await MeasureModel.create({
      ...contractRecord('c-null'),
      region_id: null,
      function_code: null,
    });
    expect(doc.region_id ?? null).toBeNull();
    expect(doc.function_code ?? null).toBeNull();
    expect(doc.natural_key).toBe('fake-contract-source:c-null');
  });
});

describe('F2 AusTender runner continue-on-error', () => {
  it('marks AusTender degraded on failure and still runs the next connector', async () => {
    const failingAusTender = createAusTenderConnector({
      fetchImpl: async () => {
        throw new Error('austender fixture network failure');
      },
      sleep: async () => {},
    });

    const result = await runIngestion({ connectors: [failingAusTender, workingConnector] });
    expect(result.results.map((entry) => `${entry.source_id}:${entry.log_status}`)).toEqual([
      'aus-tender:error',
      'fake-contract-source:success',
    ]);

    const log = await IngestionLogModel.findOne({ source_id: 'aus-tender' })
      .sort({ started_at: -1 })
      .lean();
    expect(log).toMatchObject({
      status: 'error',
      errors: ['austender fixture network failure'],
      message: 'source failed; run continues with the next connector',
    });

    const source = await DataSourceModel.findOne({ source_id: 'aus-tender' }).lean();
    expect(source).toMatchObject({ status: 'degraded', records_ingested: 0 });
    expect(source?.errors).toEqual(['austender fixture network failure']);
  });
});
