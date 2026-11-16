import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYNTHETIC_SOURCE } from '@ausspend/shared';
import { assertSeedTarget } from '../src/seed/guard.js';
import {
  destructiveReset,
  seedSyntheticData,
  SYNTHETIC_MEASURE_COUNT,
} from '../src/seed/synthetic.js';
import { DataSourceModel, IngestionLogModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_seed`;

const FAKE_CONTRACT = {
  amount_cents: 123_456_789,
  measure_type: 'contract' as const,
  fiscal_year: '2025-26',
  source_id: 'aus-tender',
  source_url: 'https://www.tenders.gov.au/Contract/Details/fake-contract',
  verified: false,
  natural_key: 'ocds-fake-contract-001',
  project_name: 'Fake live contract (scratch DB only)',
  jurisdiction_level: 'federal' as const,
  jurisdiction: 'Commonwealth',
  source_dataset: 'AusTender OCDS API',
  source_date: '2026-11-03T00:00:00Z',
  data_quality_flag: 'statewide_only',
};

async function syntheticCount(): Promise<number> {
  return MeasureModel.countDocuments({ source_id: SYNTHETIC_SOURCE.source_id });
}

async function contractCount(): Promise<number> {
  return MeasureModel.countDocuments({ measure_type: 'contract', source_id: 'aus-tender' });
}

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('seed restart safety', () => {
  it('reproduces the old bug: the destructive reset loses a live contract', async () => {
    await seedSyntheticData();
    expect(await syntheticCount()).toBe(SYNTHETIC_MEASURE_COUNT);

    await MeasureModel.create(FAKE_CONTRACT);
    expect(await contractCount()).toBe(1);

    // The old seed did exactly this on every compose `up`.
    await destructiveReset();

    expect(await contractCount()).toBe(0);
    expect(await syntheticCount()).toBe(0);
  });

  it('a safe seed preserves the contract, other sources and ingestion logs', async () => {
    await seedSyntheticData();
    await MeasureModel.create(FAKE_CONTRACT);
    await DataSourceModel.create({
      source_id: 'aus-tender',
      name: 'AusTender contract notices',
      publisher: 'Australian Government',
      source_url: 'https://www.tenders.gov.au/',
      retrieved_at: '2026-11-16T00:00:00.000Z',
      license: 'CC BY 3.0 AU',
      verified: false,
      status: 'active',
      records_ingested: 1,
    });
    await IngestionLogModel.create({
      source_id: 'aus-tender',
      started_at: new Date('2026-11-16T00:00:00Z'),
      finished_at: new Date('2026-11-16T00:00:05Z'),
      status: 'success',
      records_fetched: 1,
      records_upserted: 1,
      errors: [],
    });

    const summary = await seedSyntheticData();

    expect(summary.nonSyntheticMeasures).toBe(1);
    expect(await contractCount()).toBe(1);
    expect(await syntheticCount()).toBe(SYNTHETIC_MEASURE_COUNT);
    expect(await MeasureModel.countDocuments({ natural_key: FAKE_CONTRACT.natural_key })).toBe(1);
    expect(await MeasureModel.countDocuments({})).toBe(SYNTHETIC_MEASURE_COUNT + 1);

    const liveSource = await DataSourceModel.findOne({ source_id: 'aus-tender' }).lean();
    expect(liveSource?.status).toBe('active');
    expect(liveSource?.records_ingested).toBe(1);
    expect(await IngestionLogModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await DataSourceModel.countDocuments({ source_id: SYNTHETIC_SOURCE.source_id })).toBe(1);
  });

  it('seeding twice is idempotent: 810 synthetic rows only, contract intact', async () => {
    const before = {
      synthetic: await syntheticCount(),
      contracts: await contractCount(),
      total: await MeasureModel.countDocuments({}),
    };

    await seedSyntheticData();
    await seedSyntheticData();

    expect(await syntheticCount()).toBe(SYNTHETIC_MEASURE_COUNT);
    expect(await syntheticCount()).toBe(before.synthetic);
    expect(await contractCount()).toBe(before.contracts);
    expect(await MeasureModel.countDocuments({})).toBe(before.total);
    expect(await MeasureModel.countDocuments({ natural_key: FAKE_CONTRACT.natural_key })).toBe(1);
  });

  it('the guard still refuses every database other than ausspend_dev', () => {
    expect(() => assertSeedTarget(TEST_DB_URL)).toThrow(/Refusing to seed database/);
    expect(() => assertSeedTarget('mongodb://127.0.0.1:27018/otto_pool')).toThrow(
      /Refusing to seed database/,
    );
    expect(assertSeedTarget('mongodb://10.10.10.30:27017/ausspend_dev')).toBe('ausspend_dev');
  });

  it('wiring: an explicit reset is the only destructive path', async () => {
    expect(await contractCount()).toBe(1);
    const summary = await seedSyntheticData({ reset: true });
    expect(summary.reset).toBe(true);
    expect(await contractCount()).toBe(0);
    expect(await syntheticCount()).toBe(SYNTHETIC_MEASURE_COUNT);
  });
});
