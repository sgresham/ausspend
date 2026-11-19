import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MeasureModel, RegionModel } from '../src/models/index.js';

/**
 * State/territory route visibility cure.
 *
 * ACT and NT budget rows are stored at `jurisdiction_level: "territory"`, so a
 * state-only filter hid real budget data. The route now matches state OR
 * territory while still excluding federal rows merely located in the state and
 * local-council rows. TAS has only benchmark rows; they must be reported as a
 * separate benchmark layer, never counted as additive spending.
 */
const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_states_visibility`;

const app = createApp({ pingDb: async () => 'connected' });

const base = {
  region_id: null,
  function_code: null,
  fiscal_year: '2024-25',
  verified: false,
  source_url: 'https://example.test/source',
};

let nswId = '';
let actId = '';
let ntId = '';
let tasId = '';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();

  const regions = await RegionModel.insertMany([
    { code: 'AUS', name: 'Australia', level: 'national' },
    { code: 'NSW', name: 'New South Wales', level: 'state' },
    { code: 'TAS', name: 'Tasmania', level: 'state' },
    { code: 'ACT', name: 'Australian Capital Territory', level: 'state' },
    { code: 'NT', name: 'Northern Territory', level: 'state' },
  ]);
  nswId = regions[1]!._id.toString();
  tasId = regions[2]!._id.toString();
  actId = regions[3]!._id.toString();
  ntId = regions[4]!._id.toString();

  await MeasureModel.insertMany([
    // NSW's own state budget row.
    {
      ...base,
      amount_cents: 100,
      measure_type: 'actual',
      source_id: 'nsw-budget',
      natural_key: 'nsw-state',
      jurisdiction: 'NSW',
      jurisdiction_level: 'state',
      aggregation_role: 'additive',
      location: { state: 'NSW' },
    },
    // NSW local-council row: same jurisdiction, lower level, must stay out.
    {
      ...base,
      amount_cents: 900,
      measure_type: 'actual',
      source_id: 'dubbo-gpfs',
      natural_key: 'nsw-local',
      jurisdiction: 'NSW',
      jurisdiction_level: 'local',
      aggregation_role: 'additive',
      location: { state: 'NSW' },
    },
    // Federal contract merely located in NSW: must stay out of the NSW page.
    {
      ...base,
      amount_cents: 5_000,
      measure_type: 'contract',
      source_id: 'aus-tender',
      natural_key: 'federal-located-nsw',
      jurisdiction: 'Commonwealth',
      jurisdiction_level: 'federal',
      aggregation_role: 'additive',
      location: { state: 'NSW' },
    },
    // ACT and NT budget rows are territory-level.
    {
      ...base,
      amount_cents: 200,
      measure_type: 'budget',
      source_id: 'act-budget',
      natural_key: 'act-territory',
      jurisdiction: 'ACT',
      jurisdiction_level: 'territory',
      aggregation_role: 'additive',
      location: { state: 'ACT' },
    },
    {
      ...base,
      amount_cents: 300,
      measure_type: 'budget',
      source_id: 'nt-budget',
      natural_key: 'nt-territory',
      jurisdiction: 'NT',
      jurisdiction_level: 'territory',
      aggregation_role: 'additive',
      location: { state: 'NT' },
    },
    // TAS's only state rows are published benchmark aggregates.
    {
      ...base,
      amount_cents: 700,
      measure_type: 'budget',
      source_id: 'tas-budget',
      natural_key: 'tas-benchmark',
      jurisdiction: 'TAS',
      jurisdiction_level: 'state',
      aggregation_role: 'benchmark',
      location: { state: 'TAS' },
    },
  ]);
}, 30_000);

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('GET /api/states/:code includes state and territory rows', () => {
  it('keeps the NSW state dataset and excludes local and federal-located rows', async () => {
    const response = await request(app).get('/api/states/NSW');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.total_cents).toBe(100);
    expect(response.body.measures).toHaveLength(1);
    expect(response.body.measures[0]).toMatchObject({
      source_id: 'nsw-budget',
      jurisdiction: 'NSW',
      jurisdiction_level: 'state',
      region_id: null,
    });

    const dbCount = await MeasureModel.countDocuments({
      jurisdiction: 'NSW',
      jurisdiction_level: { $in: ['state', 'territory'] },
    });
    expect(dbCount).toBe(1);
    expect(response.body.count).toBe(dbCount);
    // The federal-located and local rows remain in the collection but are not
    // part of this page.
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-gpfs' })).toBe(1);
  });

  it('makes ACT territory budget rows visible where a state-only filter returned 0', async () => {
    const response = await request(app).get('/api/states/ACT');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.total_cents).toBe(200);
    expect(response.body.measure_types).toEqual(['budget']);
    expect(response.body.measures[0]).toMatchObject({
      source_id: 'act-budget',
      jurisdiction: 'ACT',
      jurisdiction_level: 'territory',
      region_id: null,
    });

    const stateOnly = await MeasureModel.countDocuments({
      jurisdiction: 'ACT',
      jurisdiction_level: 'state',
    });
    const stateOrTerritory = await MeasureModel.countDocuments({
      jurisdiction: 'ACT',
      jurisdiction_level: { $in: ['state', 'territory'] },
    });
    expect(stateOnly).toBe(0);
    expect(stateOrTerritory).toBe(1);
    expect(response.body.count).toBe(stateOrTerritory);
  });

  it('makes NT territory budget rows visible', async () => {
    const response = await request(app).get('/api/states/NT');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.total_cents).toBe(300);
    expect(response.body.measures[0]).toMatchObject({
      source_id: 'nt-budget',
      jurisdiction: 'NT',
      jurisdiction_level: 'territory',
    });
  });
});

describe('TAS benchmark-only layer', () => {
  it('reports TAS benchmark rows separately and never adds them to additive totals', async () => {
    const response = await request(app).get('/api/states/TAS');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.total_cents).toBeNull();
    expect(response.body.total_by_measure_type).toEqual([]);
    expect(response.body.measures).toEqual([]);
    expect(response.body.coverage).toMatchObject({
      scope: 'state',
      reason: 'benchmark-only',
      additive_count: 0,
      benchmark_count: 1,
      benchmark_sources: ['tas-budget'],
      benchmark_available: true,
      benchmark_href: '/benchmark',
    });
    expect(response.body.coverage.message).toContain('/benchmark');
    expect(response.body.coverage.message).toContain('tas-budget');
    expect(response.body.coverage.message).toContain('non-additive');

    // The benchmark row still exists and was not rewritten or mapped to a region.
    const benchmark = await MeasureModel.findOne({ source_id: 'tas-budget' }).lean();
    expect(benchmark).toMatchObject({
      aggregation_role: 'benchmark',
      region_id: null,
    });
  });
});

describe('no fabricated region ids', () => {
  it('leaves every state/territory row without a region_id after the requests', async () => {
    await request(app).get('/api/states/NSW');
    await request(app).get('/api/states/ACT');
    await request(app).get('/api/states/NT');
    await request(app).get('/api/states/TAS');

    expect(await MeasureModel.countDocuments({ region_id: { $ne: null } })).toBe(0);
    expect(await MeasureModel.countDocuments()).toBe(6);
    // Guard against an import used only by the assertions above drifting.
    expect([nswId, actId, ntId, tasId].every((id) => id.length === 24)).toBe(true);
  });
});
