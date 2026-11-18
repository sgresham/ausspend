import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import { runIngestion, stalenessDays } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_socrec`;
const SOURCE_ID = 'waternsw';
const DAY_ZERO = new Date('2026-11-01T00:00:00.000Z');
const TEN_DAYS_LATER = new Date('2026-11-11T00:00:00.000Z');

function record(id: string): SpendingRecord {
  return {
    amount_cents: 12_345_600,
    measure_type: 'actual',
    fiscal_year: '2024-25',
    source_id: SOURCE_ID,
    source_url: 'https://www.waternsw.com.au/WaterNSW-Annual-Report-2024-2025.pdf',
    verified: false,
    natural_key: `${SOURCE_ID}:${id}`,
    project_name: `WaterNSW statement line ${id}`,
    jurisdiction_level: 'soc',
    jurisdiction: 'NSW',
    aggregation_role: 'agency_detail',
    source_dataset: 'WaterNSW Annual Report 2024-25',
    data_quality_flag: 'provisional',
  };
}

function connector(overrides: {
  fetch: () => Promise<Record<string, unknown>[]>;
  transform?: (raw: readonly Record<string, unknown>[]) => SpendingRecord[];
  fetchStrategy?: Connector['metadata']['fetchStrategy'];
}): Connector {
  return {
    id: SOURCE_ID,
    name: 'WaterNSW — Annual Report',
    publisher: 'WaterNSW',
    source_url: 'https://www.waternsw.com.au/annual-reports',
    status: 'active',
    jurisdiction_level: 'soc',
    fetch: overrides.fetch,
    transform: overrides.transform ?? ((raw) => raw.map((entry) => entry.record as SpendingRecord)),
    metadata: {
      lastFetchedAt: null,
      recordsIngested: 0,
      errors: [],
      fetchStrategy: overrides.fetchStrategy ?? null,
    },
  };
}

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('SOC recovered-source status transitions', () => {
  it('counts whole days since the last successful fetch', () => {
    expect(stalenessDays(DAY_ZERO, TEN_DAYS_LATER)).toBe(10);
    expect(stalenessDays(null, TEN_DAYS_LATER)).toBeNull();
  });

  it('marks a previously-degraded source active with fresh data and fetch_strategy', async () => {
    await DataSourceModel.create({
      source_id: SOURCE_ID,
      name: 'WaterNSW — Annual Report',
      publisher: 'WaterNSW',
      source_url: 'https://www.waternsw.com.au/annual-reports',
      retrieved_at: DAY_ZERO.toISOString(),
      license: '© WaterNSW',
      verified: false,
      status: 'degraded',
      records_ingested: 47,
      errors: ['annual-report page HTTP 403'],
      deferred_resources: [],
      last_successful_fetch: new Date('2026-10-20T00:00:00.000Z'),
      staleness_days: 12,
      fetch_strategy: null,
    });
    await MeasureModel.create([record('total_revenue'), record('total_expenses')]);

    const success = connector({
      fetch: async () => [
        { record: record('total_revenue') },
        { record: record('total_expenses') },
      ],
      fetchStrategy: 'parliament_fallback',
    });

    // Run twice: the fixed natural keys make the second run an idempotent upsert.
    await runIngestion({ connectors: [success], now: () => DAY_ZERO });
    await runIngestion({ connectors: [success], now: () => DAY_ZERO });

    const source = await DataSourceModel.findOne({ source_id: SOURCE_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(2);
    expect(source?.fetch_strategy).toBe('parliament_fallback');
    expect(source?.last_successful_fetch).toEqual(DAY_ZERO);
    expect(source?.staleness_days).toBe(0);
    expect(source?.last_ingested_at).toEqual(DAY_ZERO);
    // Only the two intended rows exist; the second run updated, never inserted.
    expect(await MeasureModel.countDocuments({ source_id: SOURCE_ID })).toBe(2);
  });

  it('a failed refresh preserves rows, the row count and the last successful fetch', async () => {
    const failing = connector({
      fetch: async () => {
        throw new Error('publisher and Parliament both 403');
      },
    });

    const before = await MeasureModel.find({ source_id: SOURCE_ID }).lean();
    await runIngestion({ connectors: [failing], now: () => TEN_DAYS_LATER });

    const source = await DataSourceModel.findOne({ source_id: SOURCE_ID }).lean();
    expect(source?.status).toBe('degraded');
    // Never zero the count or delete rows on a failed refresh.
    expect(source?.records_ingested).toBe(2);
    expect(source?.last_successful_fetch).toEqual(DAY_ZERO);
    expect(source?.last_ingested_at).toEqual(DAY_ZERO);
    expect(source?.staleness_days).toBe(10);
    // The last successful strategy is retained so the UI can explain the data.
    expect(source?.fetch_strategy).toBe('parliament_fallback');
    expect(source?.errors).toEqual(['publisher and Parliament both 403']);

    const after = await MeasureModel.find({ source_id: SOURCE_ID }).sort({ natural_key: 1 }).lean();
    expect(after).toHaveLength(before.length);
    expect(after.map((row) => row.natural_key)).toEqual(
      before.map((row) => row.natural_key).sort(),
    );
    expect(after.every((row) => row.amount_cents > 0)).toBe(true);
  });
});
