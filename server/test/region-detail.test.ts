import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MeasureModel, RegionModel } from '../src/models/index.js';

/**
 * National region page: the old generic empty state claimed no real feed
 * existed without saying what does exist. The page now carries an explicit
 * coverage note that points to the ABS GFS benchmark and refuses to map federal
 * contracts to a national region or invent a national total.
 */
const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_region_coverage`;

const app = createApp({ pingDb: async () => 'connected' });

const base = {
  region_id: null,
  function_code: null,
  fiscal_year: '2024-25',
  verified: false,
  source_url: 'https://example.test/source',
};

let ausId = '';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();

  const regions = await RegionModel.insertMany([
    { code: 'AUS', name: 'Australia', level: 'national' },
    { code: 'TAS', name: 'Tasmania', level: 'state' },
  ]);
  ausId = regions[0]!._id.toString();

  await MeasureModel.insertMany([
    // National ABS GFS benchmark: a valid national layer, but non-additive and
    // never returned as project rows.
    {
      ...base,
      amount_cents: 1_234,
      measure_type: 'actual',
      source_id: 'abs-gfs',
      natural_key: 'abs-gfs-australia',
      jurisdiction: 'Australia',
      jurisdiction_level: 'federal',
      aggregation_role: 'benchmark',
      gfs_flow: 'expense',
      gfs_line_item: 'total_expense',
    },
    // Federal contract with no curated region. It must not be mapped to the
    // national region just because the page is national.
    {
      ...base,
      amount_cents: 9_999,
      measure_type: 'contract',
      source_id: 'aus-tender',
      natural_key: 'federal-contract-no-region',
      jurisdiction: 'Commonwealth',
      jurisdiction_level: 'federal',
      aggregation_role: 'additive',
      location: { state: 'NSW' },
    },
  ]);
}, 30_000);

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('national region page coverage', () => {
  it('returns a precise national empty/benchmark note instead of claiming nothing exists', async () => {
    const response = await request(app).get(`/api/regions/${ausId}`);

    expect(response.status).toBe(200);
    expect(response.body.region).toMatchObject({
      code: 'AUS',
      level: 'national',
    });
    expect(response.body.count).toBe(0);
    expect(response.body.total_cents).toBeNull();
    expect(response.body.total_by_measure_type).toEqual([]);
    expect(response.body.measures).toEqual([]);
    expect(response.body.coverage).toMatchObject({
      scope: 'national',
      reason: 'national-no-project-series',
      additive_count: 0,
      benchmark_count: 1,
      benchmark_sources: ['abs-gfs'],
      benchmark_available: true,
      benchmark_href: '/benchmark',
    });
    expect(response.body.coverage.message).toContain('/benchmark');
    expect(response.body.coverage.message).toContain('ABS GFS');
    expect(response.body.coverage.message).toContain('never added');
    expect(response.body.coverage.message).not.toMatch(/no real data/i);
  });

  it('does not map federal contracts to the national region or invent a total', async () => {
    const response = await request(app).get(`/api/regions/${ausId}`);
    expect(response.body.count).toBe(0);
    expect(response.body.total_cents).toBeNull();

    const contract = await MeasureModel.findOne({ source_id: 'aus-tender' }).lean();
    expect(contract).toMatchObject({ region_id: null, aggregation_role: 'additive' });
    expect(await MeasureModel.countDocuments({ region_id: { $ne: null } })).toBe(0);
  });

  it('keeps benchmark rows out of rows and additive totals', async () => {
    const response = await request(app).get(`/api/regions/${ausId}`);
    expect(response.body.measures).toEqual([]);
    expect(response.body.by_function).toEqual([]);
    expect(response.body.non_additive).toEqual([]);
    // Coverage reports the benchmark count for the pointer only; the additive
    // count is zero and no amount is exposed.
    expect(response.body.coverage.additive_count).toBe(0);
    expect(JSON.stringify(response.body.measures)).not.toContain('abs-gfs');
  });

  it('uses a filter-specific note when a filter matches nothing', async () => {
    const response = await request(app).get(`/api/regions/${ausId}?measure_type=budget`);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.coverage.reason).toBe('no-additive-rows');
    expect(response.body.coverage.message).toContain('match these filters');
  });
});
