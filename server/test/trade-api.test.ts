import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { TradeRecordModel, type TradeRecordDocument } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_trade`;

const app = createApp({ pingDb: async () => 'connected' });

const BASE_TRADE: TradeRecordDocument = {
  trade_flow: 'export',
  measure_type: 'trade_value',
  commodity_name: 'Iron ore',
  commodity_code: '2601',
  partner_country: 'China',
  port_name: 'Port Hedland',
  jurisdiction_level: 'federal',
  location: { state: 'WA', port: 'Port Hedland', granularity: 'port' },
  amount_cents: 100_000,
  financial_year: '2024-25',
  time_period: '2024-25',
  source_dataset: 'ABS International Trade (Data API Beta)',
  source_url: 'https://www.abs.gov.au/statistics/economy/international-trade',
  source_date: '2026-11-18',
  data_quality_flag: 'observed',
};

function trade(overrides: Partial<TradeRecordDocument>): TradeRecordDocument {
  return { ...BASE_TRADE, ...overrides };
}

describe('Trade API', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await TradeRecordModel.deleteMany({});
  });

  it('returns 200 empty states for every trade endpoint', async () => {
    const list = await request(app).get('/api/v1/trade');
    expect(list.status).toBe(200);
    expect(list.body.rows).toEqual([]);
    expect(list.body.summary).toEqual([]);
    expect(list.body.counts).toEqual({ rows: 0, total: 0, by_measure_type: {} });
    expect(list.body.pagination).toEqual({ limit: 200, offset: 0, total: 0 });
    expect(list.body.warning).toMatch(/must never be summed/);

    const summary = await request(app).get('/api/v1/trade/summary');
    expect(summary.status).toBe(200);
    expect(summary.body.summary).toEqual([]);
    expect(summary.body.additive).toBe(false);
    expect(summary.body.counts).toEqual({ groups: 0, rows: 0 });
    expect(summary.body.warning).toMatch(/CIF\/FOB is a border cost, not profit/);

    const commodities = await request(app).get('/api/v1/trade/commodities');
    expect(commodities.status).toBe(200);
    expect(commodities.body.commodities).toEqual([]);
    expect(commodities.body.count).toBe(0);

    const partners = await request(app).get('/api/v1/trade/partners');
    expect(partners.status).toBe(200);
    expect(partners.body.partners).toEqual([]);
    expect(partners.body.count).toBe(0);

    const years = await request(app).get('/api/v1/trade/years');
    expect(years.status).toBe(200);
    expect(years.body.years).toEqual([]);
    expect(years.body.count).toBe(0);
  });

  it('applies trade_flow, measure_type, commodity, partner, port and year filters', async () => {
    await TradeRecordModel.insertMany([
      trade({ amount_cents: 100_000 }),
      trade({
        trade_flow: 'import',
        commodity_name: 'Crude petroleum',
        commodity_code: '2709',
        partner_country: 'United States',
        port_name: 'Port of Houston',
        location: { state: 'TX', port: 'Port of Houston', granularity: 'port' },
        amount_cents: 200_000,
      }),
      trade({
        measure_type: 'cif_fob_margin',
        margin_percent: 3.5,
        amount_cents: 5_000,
      }),
      trade({
        partner_country: 'Japan',
        financial_year: '2023-24',
        amount_cents: 300_000,
      }),
    ]);

    const response = await request(app).get('/api/v1/trade').query({
      trade_flow: 'export',
      measure_type: 'trade_value',
      commodity: 'iron',
      partner_country: 'china',
      port: 'port hedland',
      financial_year: '2024-25',
    });

    expect(response.status).toBe(200);
    expect(response.body.rows).toHaveLength(1);
    expect(response.body.rows[0]).toMatchObject({
      trade_flow: 'export',
      measure_type: 'trade_value',
      commodity_name: 'Iron ore',
      partner_country: 'China',
      port_name: 'Port Hedland',
      financial_year: '2024-25',
      amount_cents: 100_000,
      location: { state: 'WA', port: 'Port Hedland', granularity: 'port' },
    });
    expect(response.body.summary).toEqual([
      { measure_type: 'trade_value', count: 1, amount_cents: 100_000 },
    ]);
  });

  it('applies bounded limit/offset pagination and exposes the total', async () => {
    await TradeRecordModel.insertMany(
      Array.from({ length: 5 }, (_, index) =>
        trade({
          financial_year: index < 2 ? '2024-25' : '2023-24',
          time_period: index < 2 ? `2024-0${index + 7}` : `2023-0${index - 1}`,
          commodity_code: `260${index}`,
          amount_cents: 100_000 + index,
        }),
      ),
    );

    const first = await request(app)
      .get('/api/v1/trade')
      .query({ trade_flow: 'export', limit: 2, offset: 0 });
    expect(first.status).toBe(200);
    expect(first.body.rows).toHaveLength(2);
    expect(first.body.counts.total).toBe(5);
    expect(first.body.pagination).toEqual({ limit: 2, offset: 0, total: 5 });

    const second = await request(app)
      .get('/api/v1/trade')
      .query({ trade_flow: 'export', limit: 2, offset: 2 });
    expect(second.status).toBe(200);
    expect(second.body.rows).toHaveLength(2);
    expect(second.body.rows[0].id).not.toBe(first.body.rows[0].id);
    expect(second.body.pagination).toEqual({ limit: 2, offset: 2, total: 5 });
  });

  it('lists available financial years in descending order with the flow filter', async () => {
    await TradeRecordModel.insertMany([
      trade({ financial_year: '2024-25' }),
      trade({ financial_year: '2023-24' }),
      trade({ financial_year: '2025-26', trade_flow: 'import' }),
    ]);

    const exports = await request(app).get('/api/v1/trade/years').query({ trade_flow: 'export' });
    expect(exports.status).toBe(200);
    expect(exports.body.years).toEqual(['2024-25', '2023-24']);

    const all = await request(app).get('/api/v1/trade/years');
    expect(all.body.years).toEqual(['2025-26', '2024-25', '2023-24']);
  });

  it('rejects an invalid pagination limit with a 400', async () => {
    const response = await request(app).get('/api/v1/trade?limit=1000');
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('rejects an invalid trade flow with a 400', async () => {
    const response = await request(app).get('/api/v1/trade?trade_flow=both');
    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('groups the summary by measure type and flow without ever adding a combined total', async () => {
    await TradeRecordModel.insertMany([
      trade({ measure_type: 'trade_value', amount_cents: 10_000 }),
      trade({ measure_type: 'cif_fob_margin', margin_percent: 2.5, amount_cents: 500 }),
    ]);

    const response = await request(app).get('/api/v1/trade/summary');
    expect(response.status).toBe(200);
    expect(response.body.additive).toBe(false);
    expect(response.body.warning).toMatch(/must never be summed/);
    expect(response.body.summary).toEqual(
      expect.arrayContaining([
        { measure_type: 'cif_fob_margin', trade_flow: 'export', count: 1, amount_cents: 500 },
        { measure_type: 'trade_value', trade_flow: 'export', count: 1, amount_cents: 10_000 },
      ]),
    );
    expect(response.body.total_amount_cents).toBeUndefined();
    expect(response.body.combined_total_cents).toBeUndefined();
    expect(response.body.counts).toEqual({ groups: 2, rows: 2 });
  });

  it('lists distinct commodities and partners with row counts', async () => {
    await TradeRecordModel.insertMany([
      trade({ commodity_name: 'Iron ore', commodity_code: '2601' }),
      trade({
        commodity_name: 'Iron ore',
        commodity_code: '2601',
        partner_country: 'Japan',
      }),
      trade({
        measure_type: 'cif_fob_margin',
        commodity_name: 'Coal',
        commodity_code: '2701',
        partner_country: 'China',
        amount_cents: 500,
      }),
    ]);

    const commodities = await request(app).get('/api/v1/trade/commodities');
    expect(commodities.status).toBe(200);
    expect(commodities.body.count).toBe(2);
    expect(commodities.body.commodities).toEqual(
      expect.arrayContaining([
        { commodity_name: 'Coal', commodity_code: '2701', count: 1 },
        { commodity_name: 'Iron ore', commodity_code: '2601', count: 2 },
      ]),
    );

    const partners = await request(app).get('/api/v1/trade/partners');
    expect(partners.status).toBe(200);
    expect(partners.body.count).toBe(2);
    expect(partners.body.partners).toEqual(
      expect.arrayContaining([
        { partner_country: 'China', count: 2 },
        { partner_country: 'Japan', count: 1 },
      ]),
    );
  });

  it('exposes the trade coverage section with planned sources and limitations', async () => {
    const response = await request(app).get('/api/meta/coverage');
    expect(response.status).toBe(200);
    expect(response.body.trade_ingestion.live).toBe(true);
    expect(
      response.body.trade_ingestion.planned_sources.map((source: { name: string }) => source.name),
    ).toEqual([
      'ABS International Trade (Data API Beta)',
      'OECD ITIC',
      'BITRE Waterline',
      'DISR Resources and Energy Quarterly',
      'ABARES',
    ]);
    expect(response.body.trade_ingestion.limitations).toEqual(
      expect.arrayContaining([
        'No profit data are collected, derived or estimated.',
        'CIF/FOB is a border cost proxy, not profit.',
        'Trade values, CIF/FOB margins, port interface costs, trade volumes and trade prices are different measures and are not additive.',
        'Port costs are not national totals and are never added to trade values.',
      ]),
    );
  });
});
