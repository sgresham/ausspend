import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYNTHETIC_SOURCE } from '@ausspend/shared';
import { createApp } from '../src/app';
import { DataSourceModel, FunctionModel, MeasureModel, RegionModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_m2`;

const app = createApp({ pingDb: async () => 'connected' });

let ausId = '';
let nswId = '';
let vicId = '';
const measureIds: string[] = [];

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();

  await DataSourceModel.create({ ...SYNTHETIC_SOURCE });

  const regions = await RegionModel.insertMany([
    { code: 'AUS', name: 'Australia', level: 'national' },
    { code: 'NSW', name: 'New South Wales', level: 'state' },
    { code: 'VIC', name: 'Victoria', level: 'state' },
  ]);
  ausId = regions[0]!._id.toString();
  nswId = regions[1]!._id.toString();
  vicId = regions[2]!._id.toString();

  await FunctionModel.insertMany([
    { code: '05', name: 'Environmental protection', level: 'division' },
    { code: '07', name: 'Health', level: 'division' },
    {
      code: '074',
      name: 'Public health services',
      level: 'subdivision',
      parent_code: '07',
    },
    { code: '09', name: 'Education', level: 'division' },
  ]);

  const base = {
    source_id: SYNTHETIC_SOURCE.source_id,
    source_url: SYNTHETIC_SOURCE.source_url,
    verified: false,
    notes: 'Synthetic development value; not real spending.',
  };

  const measures = await MeasureModel.insertMany([
    {
      ...base,
      region_id: regions[0]!._id,
      function_code: '07',
      fiscal_year: '2024-25',
      measure_type: 'actual',
      amount_cents: 500_000,
    },
    {
      ...base,
      region_id: regions[0]!._id,
      function_code: '07',
      fiscal_year: '2024-25',
      measure_type: 'budget',
      amount_cents: 600_000,
    },
    {
      ...base,
      region_id: regions[0]!._id,
      function_code: '07',
      fiscal_year: '2024-25',
      measure_type: 'estimate',
      amount_cents: 700_000,
    },
    {
      ...base,
      region_id: regions[1]!._id,
      function_code: '07',
      fiscal_year: '2024-25',
      measure_type: 'actual',
      amount_cents: 100_000,
    },
    {
      ...base,
      region_id: regions[1]!._id,
      function_code: '07',
      fiscal_year: '2023-24',
      measure_type: 'budget',
      amount_cents: 150_000,
    },
    {
      ...base,
      region_id: regions[2]!._id,
      function_code: '074',
      fiscal_year: '2024-25',
      measure_type: 'estimate',
      amount_cents: 200_000,
    },
    {
      ...base,
      region_id: regions[2]!._id,
      function_code: '07',
      fiscal_year: '2024-25',
      measure_type: 'actual',
      amount_cents: 250_000,
    },
    {
      ...base,
      region_id: regions[0]!._id,
      function_code: '05',
      fiscal_year: '2024-25',
      measure_type: 'actual',
      amount_cents: 300_000,
    },
  ]);

  for (const measure of measures) measureIds.push(measure._id.toString());
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

/** Whole filtered set over all eight fixtures. */
const OVERALL_SUMS = [
  { measure_type: 'actual', count: 4, total_cents: 1_150_000 },
  { measure_type: 'budget', count: 2, total_cents: 750_000 },
  { measure_type: 'estimate', count: 2, total_cents: 900_000 },
];

/** Function 07 only (six rows; 074 is a separate code). */
const FUNCTION_07_SUMS = [
  { measure_type: 'actual', count: 3, total_cents: 850_000 },
  { measure_type: 'budget', count: 2, total_cents: 750_000 },
  { measure_type: 'estimate', count: 1, total_cents: 700_000 },
];

/** Region AUS only (four rows: two actual, one budget, one estimate). */
const AUS_SUMS = [
  { measure_type: 'actual', count: 2, total_cents: 800_000 },
  { measure_type: 'budget', count: 1, total_cents: 600_000 },
  { measure_type: 'estimate', count: 1, total_cents: 700_000 },
];

describe('GET /api/meta/coverage', () => {
  it('returns the synthetic coverage banner from the DB and stub registry', async () => {
    const response = await request(app).get('/api/meta/coverage');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      phase: 'Phase 1 + F2 (AusTender live)',
      synthetic: true,
      live_ingestion: true,
      counts: { data_sources: 1, regions: 3, functions: 4, measures: 8 },
      fiscal_years: ['2023-24', '2024-25'],
      measure_types: ['actual', 'budget', 'estimate'],
      region_levels: ['national', 'state'],
    });
    expect(new Date(response.body.generated_at).toString()).not.toBe('Invalid Date');
    expect(response.body.connectors).toHaveLength(11);
    for (const connector of response.body.connectors) {
      expect(connector.status).toBe(connector.id === 'aus-tender' ? 'active' : 'stub');
      expect(connector.id).toBeTruthy();
      expect(connector.fetch).toBeUndefined();
    }
    expect(response.body.federal_ingestion.live).toContain('aus-tender');
    expect(response.body.federal_ingestion.pending).toEqual(['data-gov-au-pbs', 'grantconnect']);
    expect(response.body.limitations.join(' ')).toMatch(/synthetic/i);
    expect(response.body.limitations.join(' ')).toMatch(/verified/i);
    expect(response.body.limitations.join(' ')).toMatch(/AusTender/i);
    expect(response.body.limitations.join(' ')).toMatch(/COFOG/i);
    expect(response.body.note).toMatch(/AusTender/i);
    expect(response.body.note).toMatch(/unverified/i);
  });

  it('returns 503 when the database is unavailable', async () => {
    const unavailable = createApp({ pingDb: async () => 'unavailable' });
    const response = await request(unavailable).get('/api/meta/coverage');

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/Database unavailable/);
  });
});

describe('GET /api/regions', () => {
  it('lists every region, national first, with the national _id exposed', async () => {
    const response = await request(app).get('/api/regions');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(3);
    expect(response.body.regions.map((region: { code: string }) => region.code)).toEqual([
      'AUS',
      'NSW',
      'VIC',
    ]);
    expect(response.body.regions[0]).toMatchObject({
      _id: ausId,
      code: 'AUS',
      name: 'Australia',
      level: 'national',
    });
  });

  it('filters by name/code with q and by level with type', async () => {
    const byName = await request(app).get('/api/regions?q=New');
    expect(byName.status).toBe(200);
    expect(byName.body.regions.map((region: { code: string }) => region.code)).toEqual(['NSW']);

    const byCode = await request(app).get('/api/regions?q=aus');
    expect(byCode.body.regions.map((region: { code: string }) => region.code)).toEqual(['AUS']);

    const states = await request(app).get('/api/regions?type=state');
    expect(states.body.regions.map((region: { code: string }) => region.code)).toEqual([
      'NSW',
      'VIC',
    ]);
  });

  it('applies limit and documents the empty sub-state filter', async () => {
    const limited = await request(app).get('/api/regions?limit=1');
    expect(limited.body.regions).toHaveLength(1);
    expect(limited.body.count).toBe(1);

    const subState = await request(app).get('/api/regions?state=NSW');
    expect(subState.status).toBe(200);
    expect(subState.body.regions).toEqual([]);
  });

  it('returns 400 for bad queries', async () => {
    for (const query of ['limit=0', 'limit=201', 'type=planet', `q=${'a'.repeat(101)}`]) {
      const response = await request(app).get(`/api/regions?${query}`);
      expect(response.status, query).toBe(400);
    }
  });
});

describe('API-level per-measure-type totals', () => {
  it('keeps mixed summary totals null and returns every per-type total', async () => {
    const response = await request(app).get('/api/functions/07');

    expect(response.status).toBe(200);
    expect(response.body.mixed).toBe(true);
    expect(response.body.total_cents).toBeNull();
    expect(response.body.total_by_measure_type).toEqual(FUNCTION_07_SUMS);
    for (const group of response.body.by_region) {
      expect(group.total_by_measure_type.length).toBeGreaterThan(0);
    }
  });

  it('returns one per-type total equal to total_cents for a single type', async () => {
    const response = await request(app).get('/api/functions/07?measure_type=actual');

    expect(response.status).toBe(200);
    expect(response.body.total_cents).toBe(850_000);
    expect(response.body.total_by_measure_type).toEqual([
      { measure_type: 'actual', count: 3, total_cents: 850_000 },
    ]);
  });

  it('adds per-type totals to region and state detail and their function groups', async () => {
    const region = await request(app).get(`/api/regions/${ausId}`);
    expect(region.status).toBe(200);
    expect(region.body.total_by_measure_type).toEqual(AUS_SUMS);
    for (const group of region.body.by_function) {
      expect(group).toHaveProperty('total_by_measure_type');
    }

    const state = await request(app).get('/api/states/NSW');
    expect(state.status).toBe(200);
    expect(state.body.total_by_measure_type).toEqual([
      { measure_type: 'actual', count: 1, total_cents: 100_000 },
      { measure_type: 'budget', count: 1, total_cents: 150_000 },
    ]);
  });
});

describe('GET /api/spending', () => {
  it('returns the whole filtered summary and a page of data rows with denormalised names', async () => {
    const response = await request(app).get('/api/spending?page=1&page_size=3');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(3);
    expect(response.body.data.map((row: { amount_cents: number }) => row.amount_cents)).toEqual([
      700_000, 600_000, 500_000,
    ]);
    expect(response.body.summary).toMatchObject({
      count: 8,
      currency: 'AUD',
      total_cents: null,
      total_measure_type: null,
      measure_types: ['actual', 'budget', 'estimate'],
      mixed: true,
    });
    expect(response.body.summary.total_by_measure_type).toEqual(OVERALL_SUMS);
    expect(response.body.pagination).toEqual({
      page: 1,
      page_size: 3,
      total: 8,
      total_pages: 3,
      has_next: true,
    });
    expect(response.body.applied_filters).toEqual({
      fiscal_year: null,
      measure_type: null,
      jurisdiction_level: null,
      function: null,
      region: null,
      min_amount: null,
      max_amount: null,
      sort: 'amount_desc',
    });

    const row = response.body.data[0];
    expect(row).toMatchObject({
      function_code: '07',
      function_name: 'Health',
      function_level: 'division',
      region_code: 'AUS',
      region_name: 'Australia',
      region_level: 'national',
      provenance: {
        source_id: 'synthetic-seed',
        source_url: '/data-sources#synthetic-seed',
        verified: false,
      },
    });

    const byFunction = response.body.summary.breakdown_by_function;
    const health = byFunction.find(
      (group: { function: { code: string } }) => group.function.code === '07',
    );
    expect(health).toMatchObject({ count: 6, mixed: true, total_cents: null });
    expect(health.total_by_measure_type).toEqual(FUNCTION_07_SUMS);
    expect(
      byFunction.map((group: { function: { code: string } }) => group.function.code).sort(),
    ).toEqual(['05', '07', '074']);

    const byRegion = response.body.summary.breakdown_by_region;
    expect(byRegion.map((group: { region: { code: string } }) => group.region.code)).toEqual([
      'AUS',
      'NSW',
      'VIC',
    ]);
    expect(byRegion[0]).toMatchObject({ count: 4, mixed: true, total_cents: null });
  });

  it('paginates within the filtered set', async () => {
    const last = await request(app).get('/api/spending?page=3&page_size=3');
    expect(last.status).toBe(200);
    expect(last.body.data).toHaveLength(2);
    expect(last.body.pagination).toMatchObject({
      page: 3,
      total: 8,
      total_pages: 3,
      has_next: false,
    });
  });

  it('filters by measure_type and fiscal_year and lets a single type total', async () => {
    const response = await request(app).get(
      '/api/spending?measure_type=actual&fiscal_year=2024-25&page=1&page_size=5',
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(4);
    expect(response.body.summary).toMatchObject({
      count: 4,
      mixed: false,
      total_cents: 1_150_000,
      total_measure_type: 'actual',
      measure_types: ['actual'],
    });
    expect(response.body.summary.total_by_measure_type).toEqual([
      { measure_type: 'actual', count: 4, total_cents: 1_150_000 },
    ]);
    expect(response.body.applied_filters).toEqual({
      fiscal_year: '2024-25',
      measure_type: 'actual',
      jurisdiction_level: null,
      function: null,
      region: null,
      min_amount: null,
      max_amount: null,
      sort: 'amount_desc',
    });
  });

  it('filters a division (07) with mixed per-type totals and a subdivision (074)', async () => {
    const division = await request(app).get('/api/spending?function=07');
    expect(division.status).toBe(200);
    expect(division.body.summary).toMatchObject({ count: 6, mixed: true, total_cents: null });
    expect(division.body.summary.total_by_measure_type).toEqual(FUNCTION_07_SUMS);

    const subdivision = await request(app).get('/api/spending?function=074');
    expect(subdivision.status).toBe(200);
    expect(subdivision.body.summary).toMatchObject({
      count: 1,
      mixed: false,
      total_cents: 200_000,
      total_measure_type: 'estimate',
    });
    expect(subdivision.body.data[0]).toMatchObject({
      function_code: '074',
      function_name: 'Public health services',
      function_level: 'subdivision',
      function_parent_code: '07',
    });
  });

  it('filters by region _id', async () => {
    const response = await request(app).get(`/api/spending?region=${nswId}`);
    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ count: 2, mixed: true, total_cents: null });
    expect(response.body.summary.total_by_measure_type).toEqual([
      { measure_type: 'actual', count: 1, total_cents: 100_000 },
      { measure_type: 'budget', count: 1, total_cents: 150_000 },
    ]);
    for (const row of response.body.data) {
      expect(row.region_code).toBe('NSW');
    }
  });

  it('applies min_amount and max_amount inclusive bounds', async () => {
    const response = await request(app).get('/api/spending?min_amount=200000&max_amount=500000');
    expect(response.status).toBe(200);
    expect(response.body.data.map((row: { amount_cents: number }) => row.amount_cents)).toEqual([
      500_000, 300_000, 250_000, 200_000,
    ]);
    expect(response.body.summary.count).toBe(4);
    expect(response.body.applied_filters).toMatchObject({
      min_amount: 200_000,
      max_amount: 500_000,
    });
  });

  it('supports every documented sort', async () => {
    const asc = await request(app).get('/api/spending?sort=amount_asc');
    expect(asc.body.data[0].amount_cents).toBe(100_000);

    const yearDesc = await request(app).get('/api/spending?sort=fiscal_year_desc');
    expect(yearDesc.body.data[0].fiscal_year).toBe('2024-25');
    expect(yearDesc.body.data.at(-1).fiscal_year).toBe('2023-24');

    const yearAsc = await request(app).get('/api/spending?sort=fiscal_year_asc');
    expect(yearAsc.body.data[0].fiscal_year).toBe('2023-24');
    expect(yearAsc.body.data[0].amount_cents).toBe(150_000);
  });

  it('validates every query parameter with 400s', async () => {
    const bad = [
      'measure_type=forecast',
      'fiscal_year=2024',
      'function=7',
      'function=0111',
      'region=NSW',
      'min_amount=-1',
      'max_amount=10.5',
      'min_amount=200&max_amount=100',
      'page=0',
      'page_size=0',
      'page_size=101',
      'sort=name',
    ];
    for (const query of bad) {
      const response = await request(app).get(`/api/spending?${query}`);
      expect(response.status, query).toBe(400);
      expect(response.body.error).toBeTruthy();
    }
  });

  it('returns 404 for an unknown function or region', async () => {
    const fn = await request(app).get('/api/spending?function=08');
    expect(fn.status).toBe(404);
    expect(fn.body.error).toMatch(/Unknown function code/);

    const region = await request(app).get(`/api/spending?region=${new mongoose.Types.ObjectId()}`);
    expect(region.status).toBe(404);
    expect(region.body.error).toMatch(/Unknown region/);
  });
});

describe('GET /api/spending/:id', () => {
  it('returns one row in the same shape as a data row', async () => {
    const response = await request(app).get(`/api/spending/${measureIds[0]}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: measureIds[0],
      amount_cents: 500_000,
      fiscal_year: '2024-25',
      measure_type: 'actual',
      function_code: '07',
      function_name: 'Health',
      region_code: 'AUS',
      region_name: 'Australia',
      provenance: { source_id: 'synthetic-seed', verified: false },
    });
  });

  it('returns 400 for an invalid id and 404 for an unknown one', async () => {
    const invalid = await request(app).get('/api/spending/not-an-id');
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatch(/24-character/);

    const missing = await request(app).get(`/api/spending/${new mongoose.Types.ObjectId()}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatch(/Unknown measure/);
  });
});

describe('fixture sanity', () => {
  it('exposes valid region ids for the spending filters', () => {
    for (const id of [ausId, nswId, vicId]) {
      expect(id).toMatch(/^[a-f0-9]{24}$/);
    }
  });
});
