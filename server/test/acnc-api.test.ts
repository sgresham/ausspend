import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_acnc_${process.pid}`;

const app = createApp({ pingDb: async () => 'connected' });

const base = {
  measure_type: 'actual',
  fiscal_year: '2023-24',
  source_id: 'acnc-charity',
  source_url: 'https://data.gov.au/example/datadotgov_ais24.csv',
  verified: false,
  jurisdiction_level: 'charity',
  jurisdiction: 'Australia',
  delivery_entity: 'Reconciled Charity Ltd',
  funding_source: 'ACNC-registered charity',
  source_dataset: 'ACNC Annual Information Statement (AIS)',
  project_name: 'Charity expenses — Reconciled Charity Ltd',
  location: { state: 'NSW', postcode: '2000' },
  data_quality_flag: 'provisional; location_approximate',
} as const;

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
  await MeasureModel.insertMany([
    {
      ...base,
      amount_cents: 100_000,
      aggregation_role: 'expense_total',
      expense_category: 'total',
      natural_key: 'acnc-charity:test-total',
    },
    {
      ...base,
      amount_cents: 60_000,
      aggregation_role: 'expense_component',
      expense_category: 'employee_expenses',
      natural_key: 'acnc-charity:test-employee',
    },
    {
      ...base,
      amount_cents: 40_000,
      aggregation_role: 'expense_component',
      expense_category: 'all_other_expenses',
      natural_key: 'acnc-charity:test-other',
    },
    {
      measure_type: 'actual',
      fiscal_year: '2023-24',
      source_id: 'synthetic-seed',
      source_url: 'https://example.test/synthetic',
      verified: false,
      amount_cents: 700_000,
      jurisdiction_level: 'federal',
      natural_key: 'acnc-charity:test-government',
    },
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('ACNC charity API no-double-count', () => {
  it('returns only total-expenses rows when the total category is selected', async () => {
    const response = await request(app).get(
      '/api/spending?jurisdiction_level=charity&expense_category=total',
    );
    expect(response.status).toBe(200);
    expect(response.body.summary.count).toBe(1);
    expect(response.body.summary.total_cents).toBe(100_000);
    expect(response.body.summary.total_by_measure_type).toEqual([
      { measure_type: 'actual', count: 1, total_cents: 100_000 },
    ]);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].expense_category).toBe('total');
  });

  it('keeps total and components separate and never sums them into the headline', async () => {
    const response = await request(app).get('/api/spending?jurisdiction_level=charity');
    expect(response.status).toBe(200);
    // 3 rows are visible, but only the total row feeds the total: not 200,000.
    expect(response.body.summary.count).toBe(3);
    expect(response.body.summary.additive_count).toBe(1);
    expect(response.body.summary.total_cents).toBe(100_000);
    expect(response.body.summary.total_cents).not.toBe(200_000);
    expect(response.body.summary.total_by_measure_type).toEqual([
      { measure_type: 'actual', count: 1, total_cents: 100_000 },
    ]);
    expect(response.body.summary.expense_categories).toEqual([
      expect.objectContaining({ expense_category: 'total', total_cents: 100_000, additive: true }),
      expect.objectContaining({
        expense_category: 'all_other_expenses',
        total_cents: 40_000,
        additive: false,
      }),
      expect.objectContaining({
        expense_category: 'employee_expenses',
        total_cents: 60_000,
        additive: false,
      }),
    ]);
    expect(response.body.summary.charity_expense_total_cents).toBe(100_000);
  });

  it('filters charity records by state and postcode', async () => {
    const nsw = await request(app).get(
      '/api/spending?jurisdiction_level=charity&state=NSW&postcode=2000',
    );
    expect(nsw.status).toBe(200);
    expect(nsw.body.pagination.total).toBe(3);
    expect(
      nsw.body.data.every(
        (row: { location?: { postcode?: string } }) => row.location?.postcode === '2000',
      ),
    ).toBe(true);

    const vic = await request(app).get(
      '/api/spending?jurisdiction_level=charity&state=VIC&postcode=3000',
    );
    expect(vic.status).toBe(200);
    expect(vic.body.pagination.total).toBe(0);
  });

  it('withholds a combined total when charity and government rows are mixed', async () => {
    const response = await request(app).get('/api/spending');
    expect(response.status).toBe(200);
    expect(response.body.summary.mixed).toBe(true);
    expect(response.body.summary.total_cents).toBeNull();
    expect(response.body.summary.total_by_measure_type).toEqual([]);
    expect(response.body.summary.expense_categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ expense_category: 'total', total_cents: 100_000 }),
      ]),
    );
    // The only safe charity figure is the explicit total-expenses aggregate.
    expect(response.body.summary.charity_expense_total_cents).toBe(100_000);
  });
});
