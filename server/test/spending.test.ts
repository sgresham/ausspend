import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SYNTHETIC_SOURCE } from '@ausspend/shared';
import { createApp } from '../src/app';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_spending`;

const app = createApp({ pingDb: async () => 'connected' });

const ids: Record<string, string> = {};

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
  await DataSourceModel.create({ ...SYNTHETIC_SOURCE });

  const base = {
    source_id: SYNTHETIC_SOURCE.source_id,
    source_url: SYNTHETIC_SOURCE.source_url,
    verified: false,
    fiscal_year: '2024-25',
    measure_type: 'actual' as const,
  };

  const measures = await MeasureModel.insertMany([
    {
      ...base,
      amount_cents: 500_000,
      project_name: 'New Dubbo Bridge',
      description: 'Bridge construction across the Macquarie River',
      delivery_entity: 'Transport for NSW',
    },
    {
      ...base,
      amount_cents: 600_000,
      measure_type: 'budget',
      project_name: 'Health Facilities Program',
      description: 'Regional hospital upgrades',
      delivery_entity: 'NSW Health',
    },
    {
      ...base,
      amount_cents: 250_000,
      fiscal_year: '2023-24',
      project_name: 'Dubbo Health Clinic',
      description: 'Community health services',
      delivery_entity: 'NSW Health',
    },
    {
      ...base,
      amount_cents: 100_000,
      fiscal_year: '2023-24',
      project_name: 'WaterNSW Pipeline',
      description: 'Water security works',
      delivery_entity: 'WaterNSW',
    },
    {
      ...base,
      amount_cents: 300_000,
      aggregation_role: 'agency_detail',
      project_name: 'Agency Detail Health',
      description: 'Provenance only',
    },
    {
      ...base,
      amount_cents: 900_000,
      project_name: 'Healthier Communities',
      description: 'healthcare and wellbeing',
    },
  ]);

  measures.forEach((measure, index) => {
    ids[`m${index}`] = measure._id.toString();
  });

  // The q path relies on the text index; make sure it exists before querying.
  await MeasureModel.createIndexes();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('GET /api/spending search and pagination', () => {
  it('matches whole search tokens case-insensitively through the text index', async () => {
    // "Health" is a whole word in these rows. "Healthier"/"healthcare" are not
    // separate tokens, which is the documented trade-off of the text index.
    const response = await request(app).get('/api/spending?q=HEALTH&sort=amount_desc');
    expect(response.status).toBe(200);
    expect(response.body.summary.count).toBe(3);
    expect(response.body.data.map((row: { id: string }) => row.id).sort()).toEqual(
      [ids.m1, ids.m2, ids.m4].sort(),
    );
  });

  it('requires every whitespace-separated word and ORs across fields', async () => {
    const bridge = await request(app).get('/api/spending?q=dubbo%20bridge');
    expect(bridge.status).toBe(200);
    expect(bridge.body.data.map((row: { id: string }) => row.id)).toEqual([ids.m0]);

    // "macquarie" is in description, "new" is in project_name.
    const acrossFields = await request(app).get('/api/spending?q=macquarie%20new');
    expect(acrossFields.body.data.map((row: { id: string }) => row.id)).toEqual([ids.m0]);

    const disjoint = await request(app).get('/api/spending?q=dubbo%20waternsw');
    expect(disjoint.body.summary.count).toBe(0);
    expect(disjoint.body.data).toEqual([]);
  });

  it('keeps punctuation-only queries literal instead of sending them to text search', async () => {
    for (const literal of ['.*', '(', '[', 'Bridge.*', 'dubb']) {
      const response = await request(app).get(`/api/spending?q=${encodeURIComponent(literal)}`);
      expect(response.status, literal).toBe(200);
      expect(response.body.summary.count, literal).toBe(0);
      expect(response.body.data, literal).toEqual([]);
    }
  });

  it('treats an empty q as no filter', async () => {
    const empty = await request(app).get('/api/spending?q=');
    expect(empty.body.summary.count).toBe(6);
    expect(empty.body.applied_filters.q).toBeNull();
  });

  it('keeps the summary over the whole filtered set while paginating the page', async () => {
    const response = await request(app).get('/api/spending?page=2&page_size=2&sort=amount_desc');
    expect(response.status).toBe(200);
    expect(response.body.summary.count).toBe(6);
    expect(response.body.pagination).toEqual({
      page: 2,
      page_size: 2,
      total: 6,
      total_pages: 3,
      has_next: true,
    });
    expect(response.body.data.map((row: { amount_cents: number }) => row.amount_cents)).toEqual([
      500_000, 300_000,
    ]);
  });

  it('preserves every documented sort order', async () => {
    const expected: Record<string, number[]> = {
      amount_desc: [900_000, 600_000, 500_000, 300_000, 250_000, 100_000],
      amount_asc: [100_000, 250_000, 300_000, 500_000, 600_000, 900_000],
      fiscal_year_desc: [900_000, 600_000, 500_000, 300_000, 250_000, 100_000],
      fiscal_year_asc: [250_000, 100_000, 900_000, 600_000, 500_000, 300_000],
    };
    for (const [sort, amounts] of Object.entries(expected)) {
      const response = await request(app).get(`/api/spending?sort=${sort}&page_size=10`);
      expect(response.status, sort).toBe(200);
      expect(
        response.body.data.map((row: { amount_cents: number }) => row.amount_cents),
        sort,
      ).toEqual(amounts);
    }

    const yearDesc = await request(app).get('/api/spending?sort=fiscal_year_desc');
    expect(yearDesc.body.data[0].fiscal_year).toBe('2024-25');
    expect(yearDesc.body.data.at(-1)?.fiscal_year).toBe('2023-24');
  });

  it('composes the search with filters and keeps non-additive totals separate', async () => {
    const response = await request(app).get(
      '/api/spending?q=health&sort=amount_desc&page=1&page_size=2',
    );
    expect(response.status).toBe(200);
    expect(response.body.summary.count).toBe(3);
    expect(response.body.summary.additive_count).toBe(2);
    expect(response.body.summary.non_additive_count).toBe(1);
    expect(response.body.summary.mixed).toBe(true);
    // Actual and budget are never summed into one headline total.
    expect(response.body.summary.total_cents).toBeNull();
    expect(
      response.body.summary.total_by_measure_type.map(
        (entry: { measure_type: string; count: number }) => [entry.measure_type, entry.count],
      ),
    ).toEqual([
      ['actual', 1],
      ['budget', 1],
    ]);
    expect(response.body.data).toHaveLength(2);

    const filtered = await request(app).get('/api/spending?q=health&measure_type=budget');
    expect(filtered.body.summary.count).toBe(1);
    expect(filtered.body.data.map((row: { id: string }) => row.id)).toEqual([ids.m1]);
  });

  it('returns the documented response shape', async () => {
    const response = await request(app).get('/api/spending?q=bridge');
    expect(Object.keys(response.body).sort()).toEqual([
      'applied_filters',
      'data',
      'pagination',
      'summary',
    ]);
    expect(response.body.data[0]).toMatchObject({
      id: ids.m0,
      amount_cents: 500_000,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      project_name: 'New Dubbo Bridge',
    });
    expect(response.body.data[0].provenance).toMatchObject({
      source_id: SYNTHETIC_SOURCE.source_id,
      verified: false,
    });
  });
});
