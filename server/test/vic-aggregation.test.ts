import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MeasureModel, RegionModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_vicagg`;

const app = createApp({ pingDb: async () => 'connected' });

const base = {
  measure_type: 'budget' as const,
  fiscal_year: '2026-27',
  source_id: 'vic-budget',
  source_url:
    'https://discover.data.vic.gov.au/dataset/28acff34-a406-417c-ac2d-2403590b80e8/resource/72c90f3b-30b0-466f-9d0b-abeb0d59454f/download/1.5_2026-27-budget-consolidated-gg-expenses-by-cofog.xlsx',
  verified: false,
  jurisdiction_level: 'state' as const,
  jurisdiction: 'VIC',
  location: { state: 'VIC' },
};

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
  const region = await RegionModel.create({ code: 'VIC', name: 'Victoria', level: 'state' });
  await MeasureModel.insertMany([
    {
      ...base,
      region_id: region._id,
      function_code: '07',
      aggregation_role: 'additive',
      amount_cents: 2_000_000,
      natural_key: 'vic-agg:health',
      project_name: 'Health',
    },
    {
      ...base,
      region_id: region._id,
      function_code: '01',
      aggregation_role: 'additive',
      amount_cents: 1_000_000,
      natural_key: 'vic-agg:gps',
      project_name: 'General public services',
    },
    {
      ...base,
      aggregation_role: 'agency_detail',
      amount_cents: 500_000,
      delivery_entity: 'Department of Treasury and Finance',
      funding_source: 'Department of Treasury and Finance',
      natural_key: 'vic-agg:dtf',
      project_name: 'Employee benefits',
      data_quality_flag: 'provisional',
    },
    {
      ...base,
      aggregation_role: 'policy_measure',
      amount_cents: 700_000,
      delivery_entity: 'Queensland Treasury',
      funding_source: 'Queensland Treasury',
      natural_key: 'vic-agg:policy',
      project_name: 'Policy measure',
      data_quality_flag: 'provisional',
    },
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('non-additive agency/policy detail', () => {
  it('excludes agency_detail from /api/states/VIC totals and exposes it separately', async () => {
    const response = await request(app).get(
      '/api/states/VIC?fiscal_year=2026-27&measure_type=budget',
    );
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(4);
    expect(response.body.additive_count).toBe(2);
    expect(response.body.non_additive_count).toBe(2);
    expect(response.body.total_cents).toBe(3_000_000);
    expect(response.body.total_by_measure_type).toEqual([
      { measure_type: 'budget', count: 2, total_cents: 3_000_000 },
    ]);
    expect(response.body.by_function).toHaveLength(2);
    expect(response.body.agency_detail).toMatchObject({
      label: 'Agency detail — not additive',
      aggregation_role: 'agency_detail',
      count: 1,
      total_cents: 500_000,
    });
    expect(response.body.agency_detail.measures[0].aggregation_role).toBe('agency_detail');
    expect(response.body.agency_detail.measures[0].delivery_entity).toBe(
      'Department of Treasury and Finance',
    );
    expect(response.body.non_additive).toHaveLength(2);
    const policy = response.body.non_additive.find(
      (block: { aggregation_role?: string }) => block.aggregation_role === 'policy_measure',
    );
    expect(policy).toMatchObject({
      label: 'Policy measures — not additive',
      count: 1,
      total_cents: 700_000,
    });
    expect(policy.description).toMatch(/overlap the BP3 capital program/);
  });

  it('excludes agency_detail from /api/spending summary totals but returns the row', async () => {
    const response = await request(app).get(
      '/api/spending?jurisdiction_level=state&fiscal_year=2026-27&measure_type=budget&page_size=10',
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(4);
    expect(response.body.summary.count).toBe(4);
    expect(response.body.summary.additive_count).toBe(2);
    expect(response.body.summary.non_additive_count).toBe(2);
    expect(response.body.summary.total_cents).toBe(3_000_000);
    expect(response.body.summary.total_by_measure_type).toEqual([
      { measure_type: 'budget', count: 2, total_cents: 3_000_000 },
    ]);
    const detail = response.body.data.find(
      (row: { aggregation_role?: string }) => row.aggregation_role === 'agency_detail',
    );
    expect(detail).toMatchObject({
      amount_cents: 500_000,
      delivery_entity: 'Department of Treasury and Finance',
    });
    const policy = response.body.data.find(
      (row: { aggregation_role?: string }) => row.aggregation_role === 'policy_measure',
    );
    expect(policy).toMatchObject({ amount_cents: 700_000, delivery_entity: 'Queensland Treasury' });
  });
});
