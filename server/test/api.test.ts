import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { DataSourceModel, FunctionModel, MeasureModel, RegionModel } from '../src/models/index.js';
import { SYNTHETIC_SOURCE } from '@ausspend/shared';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}`;

const app = createApp({ pingDb: async () => 'connected' });

let nswId = '';
let vicId = '';
let ausId = '';

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
    { code: '07', name: 'Health', level: 'division' },
    {
      code: '071',
      name: 'Medical products, appliances and equipment',
      level: 'subdivision',
      parent_code: '07',
    },
    { code: '09', name: 'Education', level: 'division' },
  ]);

  const base = {
    function_code: '07',
    fiscal_year: '2024-25',
    source_id: SYNTHETIC_SOURCE.source_id,
    source_url: SYNTHETIC_SOURCE.source_url,
    verified: false,
  };

  await MeasureModel.insertMany([
    { ...base, region_id: regions[0]!._id, amount_cents: 500_000, measure_type: 'actual' },
    { ...base, region_id: regions[0]!._id, amount_cents: 600_000, measure_type: 'budget' },
    { ...base, region_id: regions[1]!._id, amount_cents: 100_000, measure_type: 'actual' },
    { ...base, region_id: regions[1]!._id, amount_cents: 150_000, measure_type: 'budget' },
    { ...base, region_id: regions[2]!._id, amount_cents: 200_000, measure_type: 'actual' },
    { ...base, region_id: regions[2]!._id, amount_cents: 250_000, measure_type: 'budget' },
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('GET /api/data-sources', () => {
  it('lists the synthetic source with provenance and verified false', async () => {
    const response = await request(app).get('/api/data-sources');

    expect(response.status).toBe(200);
    expect(response.body.sources).toHaveLength(1);
    expect(response.body.sources[0]).toMatchObject({
      source_id: 'synthetic-seed',
      source_url: '/data-sources#synthetic-seed',
      verified: false,
    });
  });
});

describe('GET /api/functions', () => {
  it('returns divisions with nested subdivisions', async () => {
    const response = await request(app).get('/api/functions');

    expect(response.status).toBe(200);
    const health = response.body.functions.find((fn: { code: string }) => fn.code === '07');
    expect(health.name).toBe('Health');
    expect(health.subdivisions).toEqual([
      expect.objectContaining({ code: '071', parent_code: '07', level: 'subdivision' }),
    ]);
  });
});

describe('GET /api/functions/:code', () => {
  it('marks a mixed measure_type response and withholds every headline total', async () => {
    const response = await request(app).get('/api/functions/07');

    expect(response.status).toBe(200);
    expect(response.body.measure_types).toEqual(['actual', 'budget']);
    expect(response.body.mixed).toBe(true);
    expect(response.body.total_cents).toBeNull();
    expect(response.body.total_measure_type).toBeNull();
    expect(response.body.ranked_states).toBeNull();
    expect(response.body.count).toBe(6);
    for (const group of response.body.by_region) {
      expect(group.mixed).toBe(true);
      expect(group.total_cents).toBeNull();
    }
  });

  it('returns a total and ranked states only for one measure_type', async () => {
    const response = await request(app).get('/api/functions/07?measure_type=actual');

    expect(response.status).toBe(200);
    expect(response.body.mixed).toBe(false);
    expect(response.body.total_measure_type).toBe('actual');
    expect(response.body.total_cents).toBe(800_000);
    expect(response.body.ranked_states).toEqual([
      expect.objectContaining({ total_cents: 200_000 }),
      expect.objectContaining({ total_cents: 100_000 }),
    ]);
    expect(
      response.body.ranked_states.map((row: { region: { code: string } }) => row.region.code),
    ).toEqual(['VIC', 'NSW']);
  });

  it('treats region as a region _id and rejects a code', async () => {
    const byId = await request(app).get(`/api/functions/07?region=${nswId}&measure_type=actual`);
    expect(byId.status).toBe(200);
    expect(byId.body.count).toBe(1);
    expect(byId.body.total_cents).toBe(100_000);
    expect(byId.body.measures[0].region_id).toBe(nswId);

    const byCode = await request(app).get('/api/functions/07?region=NSW');
    expect(byCode.status).toBe(400);
    expect(byCode.body.error).toMatch(/region must be a region _id/);
  });

  it('returns 404 for an unknown function code', async () => {
    const response = await request(app).get('/api/functions/99');
    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/Unknown function code/);
  });

  it('keeps amounts integer cents and provenance on every row', async () => {
    const response = await request(app).get('/api/functions/07?measure_type=actual');
    for (const measure of response.body.measures) {
      expect(Number.isInteger(measure.amount_cents)).toBe(true);
      expect(measure.source_id).toBe('synthetic-seed');
      expect(measure.source_url).toBe('/data-sources#synthetic-seed');
      expect(measure.verified).toBe(false);
    }
  });
});

describe('GET /api/regions/:regionId', () => {
  it('returns region detail grouped by function', async () => {
    const response = await request(app).get(`/api/regions/${nswId}?measure_type=actual`);

    expect(response.status).toBe(200);
    expect(response.body.region).toMatchObject({ code: 'NSW', level: 'state' });
    expect(response.body.mixed).toBe(false);
    expect(response.body.total_cents).toBe(100_000);
    expect(response.body.by_function[0]).toMatchObject({
      function: { code: '07', name: 'Health' },
      total_cents: 100_000,
    });
  });

  it('rejects a region code where an _id is required', async () => {
    const response = await request(app).get('/api/regions/NSW');
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/regionId must be a region _id/);
  });

  it('returns 404 for an unknown but well-formed id', async () => {
    const response = await request(app).get(`/api/regions/${new mongoose.Types.ObjectId()}`);
    expect(response.status).toBe(404);
  });
});

describe('GET /api/states/:code', () => {
  it('returns a state detail and accepts lower case', async () => {
    const response = await request(app).get('/api/states/nsw?measure_type=actual');

    expect(response.status).toBe(200);
    expect(response.body.state).toMatchObject({ code: 'NSW', name: 'New South Wales' });
  });

  it('returns 404 for an unknown state', async () => {
    const response = await request(app).get('/api/states/ZZ');
    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/Unknown state/);
  });
});

describe('GET /api/search', () => {
  it('finds functions and regions by name or code, bounded', async () => {
    const response = await request(app).get('/api/search?q=health');

    expect(response.status).toBe(200);
    expect(response.body.functions).toEqual([
      expect.objectContaining({ code: '07', name: 'Health' }),
    ]);
    expect(response.body.regions).toEqual([]);
    expect(response.body.count).toBe(1);
  });

  it('requires q', async () => {
    const response = await request(app).get('/api/search');
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/q is required/);
  });
});

describe('JSON errors', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const response = await request(app).get('/api/nope');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ ok: false, error: 'Not found', path: '/api/nope' });
  });

  it('returns 400 for an invalid measure_type', async () => {
    const response = await request(app).get('/api/functions/07?measure_type=forecast');
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  it('exposes the fixture ids', () => {
    expect(nswId).toMatch(/^[a-f0-9]{24}$/);
    expect(vicId).toMatch(/^[a-f0-9]{24}$/);
    expect(ausId).toMatch(/^[a-f0-9]{24}$/);
  });
});
