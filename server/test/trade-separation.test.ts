import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MeasureModel, TradeRecordModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_trade_separation`;

const app = createApp({ pingDb: async () => 'connected' });

let tradeValueId = '';
let tradeMarginId = '';
let measureId = '';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();

  const tradeBase = {
    trade_flow: 'export' as const,
    commodity_name: 'TradeOnlyCommodity',
    commodity_code: '9999',
    partner_country: 'TradeOnlyPartner',
    port_name: 'TradeOnlyPort',
    jurisdiction_level: 'federal' as const,
    location: { state: 'WA', port: 'TradeOnlyPort', granularity: 'port' as const },
    financial_year: '2024-25',
    time_period: '2024-25',
    source_dataset: 'Trade separation fixture',
    source_url: 'https://example.gov.au/trade-separation',
    source_date: '2026-11-18',
    data_quality_flag: 'observed' as const,
  };

  const trades = await TradeRecordModel.insertMany([
    {
      ...tradeBase,
      measure_type: 'trade_value',
      amount_cents: 10_000,
    },
    {
      ...tradeBase,
      measure_type: 'cif_fob_margin',
      margin_percent: 2.5,
      amount_cents: 500,
    },
  ]);
  tradeValueId = trades[0]!._id.toString();
  tradeMarginId = trades[1]!._id.toString();

  const measure = await MeasureModel.create({
    source_id: 'spending-only-source',
    source_url: 'https://example.gov.au/spending-separation',
    verified: false,
    natural_key: 'spending-only-source:trade-separation',
    amount_cents: 777_000,
    measure_type: 'actual',
    fiscal_year: '2024-25',
    project_name: 'SpendingOnlyProject',
    description: 'A spending row that must never appear in the trade API.',
    jurisdiction_level: 'federal',
    jurisdiction: 'Australia',
  });
  measureId = measure._id.toString();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('Trade and spending are separate domains', () => {
  it('uses separate collections and the trade schema has no profit field', () => {
    expect(TradeRecordModel.collection.name).toBe('trade_records');
    expect(MeasureModel.collection.name).toBe('measures');

    const paths = Object.keys(TradeRecordModel.schema.paths);
    expect(paths.some((path) => path.toLowerCase().includes('profit'))).toBe(false);
    expect(paths).toEqual(
      expect.arrayContaining(['trade_flow', 'measure_type', 'commodity_name', 'amount_cents']),
    );
    const margin = TradeRecordModel.schema.path('margin_percent');
    expect(margin).toBeDefined();
  });

  it('never returns a trade row from a spending query', async () => {
    const allSpending = await request(app).get('/api/v1/spending?limit=2000');
    expect(allSpending.status).toBe(200);
    expect(allSpending.body.data).toHaveLength(1);
    expect(allSpending.body.data[0].id).toBe(measureId);
    expect(JSON.stringify(allSpending.body)).not.toContain('TradeOnlyCommodity');
    expect(JSON.stringify(allSpending.body)).not.toContain(tradeValueId);
    expect(JSON.stringify(allSpending.body)).not.toContain(tradeMarginId);

    const q = await request(app).get('/api/v1/spending?q=TradeOnlyCommodity');
    expect(q.status).toBe(200);
    expect(q.body.data).toEqual([]);
  });

  it('never returns a spending row from a trade query', async () => {
    const list = await request(app).get('/api/v1/trade');
    expect(list.status).toBe(200);
    expect(list.body.rows).toHaveLength(2);
    expect(list.body.rows.map((row: { id: string }) => row.id).sort()).toEqual(
      [tradeValueId, tradeMarginId].sort(),
    );
    expect(JSON.stringify(list.body)).not.toContain('SpendingOnlyProject');
    expect(JSON.stringify(list.body)).not.toContain(measureId);

    for (const path of [
      '/api/v1/trade/summary',
      '/api/v1/trade/commodities',
      '/api/v1/trade/partners',
    ]) {
      const response = await request(app).get(path);
      expect(response.status, path).toBe(200);
      expect(JSON.stringify(response.body), path).not.toContain('SpendingOnlyProject');
      expect(JSON.stringify(response.body), path).not.toContain(measureId);
    }
  });

  it('summarises trade measure types separately and never outputs a combined total', async () => {
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
    expect(await MeasureModel.countDocuments({})).toBe(1);
    expect(await TradeRecordModel.countDocuments({})).toBe(2);
  });
});
