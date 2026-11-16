import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYNTHETIC_SOURCE } from '@ausspend/shared';
import { cleanSynthetic, inventorySynthetic } from '../src/seed/clean.js';
import { seedSyntheticData, SYNTHETIC_MEASURE_COUNT } from '../src/seed/synthetic.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_clean`;

const FAKE_REAL_CONTRACT = {
  amount_cents: 987_654_321,
  measure_type: 'contract' as const,
  fiscal_year: '2025-26',
  source_id: 'aus-tender',
  source_url: 'https://www.tenders.gov.au/Contract/Details/clean-fake-contract',
  verified: false,
  natural_key: 'ocds-clean-fake-contract-001',
  project_name: 'Fake real contract (scratch DB only)',
  jurisdiction_level: 'federal' as const,
  jurisdiction: 'Commonwealth',
  source_dataset: 'AusTender OCDS API',
  source_date: '2026-11-03T00:00:00Z',
  data_quality_flag: 'statewide_only',
};

async function syntheticCount(): Promise<number> {
  return MeasureModel.countDocuments({ source_id: SYNTHETIC_SOURCE.source_id });
}

async function realContractCount(): Promise<number> {
  return MeasureModel.countDocuments({ natural_key: FAKE_REAL_CONTRACT.natural_key });
}

async function seedWithRealRow(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await seedSyntheticData();
  await MeasureModel.create(FAKE_REAL_CONTRACT);
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
}

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('synthetic cleanup inventory and dry run', () => {
  it('inventory counts only synthetic rows, by type, year, region and function', async () => {
    await seedWithRealRow();

    const inventory = await inventorySynthetic();

    expect(inventory.source_id).toBe('synthetic-seed');
    expect(inventory.measures).toBe(SYNTHETIC_MEASURE_COUNT);
    expect(inventory.total_measures).toBe(SYNTHETIC_MEASURE_COUNT + 1);
    expect(inventory.non_synthetic_measures).toBe(1);
    expect(inventory.data_source_records).toBe(1);
    expect(inventory.by_measure_type).toEqual([
      { key: 'actual', count: 270 },
      { key: 'budget', count: 270 },
      { key: 'estimate', count: 270 },
    ]);
    expect(inventory.by_fiscal_year).toEqual([
      { key: '2023-24', count: 270 },
      { key: '2024-25', count: 270 },
      { key: '2025-26', count: 270 },
    ]);
    expect(inventory.by_region).toHaveLength(9);
    expect(inventory.by_region.every((entry) => entry.count === 90)).toBe(true);
    expect(inventory.by_function).toHaveLength(10);
    expect(inventory.by_function.every((entry) => entry.count === 81)).toBe(true);
    expect(inventory.other_source_ids).toEqual(['aus-tender']);
  });

  it('dry run deletes nothing: the synthetic 810 and the fake real row stay', async () => {
    await seedWithRealRow();

    const result = await cleanSynthetic();

    expect(result.executed).toBe(false);
    expect(result.deleted).toEqual({ measures: 0, data_source_records: 0 });
    expect(result.before.measures).toBe(SYNTHETIC_MEASURE_COUNT);
    expect(await syntheticCount()).toBe(SYNTHETIC_MEASURE_COUNT);
    expect(await realContractCount()).toBe(1);
    expect(await MeasureModel.countDocuments({})).toBe(SYNTHETIC_MEASURE_COUNT + 1);
    expect(await DataSourceModel.countDocuments({ source_id: SYNTHETIC_SOURCE.source_id })).toBe(1);
  });

  it('execute refuses without a verified-backup check and writes nothing', async () => {
    await seedWithRealRow();

    await expect(cleanSynthetic({ execute: true })).rejects.toThrow(
      /without a verified backup check/,
    );
    expect(await syntheticCount()).toBe(SYNTHETIC_MEASURE_COUNT);
    expect(await realContractCount()).toBe(1);
  });
});

describe('synthetic cleanup execution', () => {
  it('deletes only source_id=synthetic-seed after the backup check, preserving real rows', async () => {
    await seedWithRealRow();
    let backupChecks = 0;

    const result = await cleanSynthetic({
      execute: true,
      verifyBackup: async () => {
        backupChecks += 1;
      },
    });

    expect(backupChecks).toBe(1);
    expect(result.executed).toBe(true);
    expect(result.deleted.measures).toBe(SYNTHETIC_MEASURE_COUNT);
    expect(result.deleted.data_source_records).toBe(1);
    expect(result.preserved_non_synthetic_measures).toBe(1);
    expect(await syntheticCount()).toBe(0);
    expect(await realContractCount()).toBe(1);
    expect(await MeasureModel.countDocuments({})).toBe(1);
    expect(await DataSourceModel.countDocuments({ source_id: SYNTHETIC_SOURCE.source_id })).toBe(0);
    const liveSource = await DataSourceModel.findOne({ source_id: 'aus-tender' }).lean();
    expect(liveSource?.status).toBe('active');
    expect(liveSource?.records_ingested).toBe(1);
  });

  it('is idempotent: a second execute deletes 0 and still preserves the real row', async () => {
    let backupChecks = 0;
    const result = await cleanSynthetic({
      execute: true,
      verifyBackup: async () => {
        backupChecks += 1;
      },
    });

    expect(backupChecks).toBe(1);
    expect(result.deleted.measures).toBe(0);
    expect(result.deleted.data_source_records).toBe(0);
    expect(await syntheticCount()).toBe(0);
    expect(await realContractCount()).toBe(1);
    expect(await MeasureModel.countDocuments({})).toBe(1);
  });
});
