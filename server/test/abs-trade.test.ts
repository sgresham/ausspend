import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ABS_TRADE_BASE_URL,
  ABS_TRADE_GOODS_DATAFLOW,
  ABS_TRADE_GOODS_VERSION,
  ABS_TRADE_SERVICES_DATAFLOW,
  ABS_TRADE_SERVICES_VERSION,
  absGoodsUrl,
  absServicesUrl,
  fetchAbsTradeRecords,
  financialYearForLabelYear,
  financialYearForMonth,
  parseAbsGoods,
  parseAbsServices,
  recordAbsTradeSource,
  upsertAbsTradeRecords,
} from '../src/connectors/trade/abs-trade/index.js';
import { TradeRecordModel } from '../src/models/index.js';
import { ABS_GOODS_FIXTURE, ABS_SERVICES_FIXTURE } from './fixtures/abs-trade-fixtures.js';

const SOURCE_DATE = '2026-11-18';

function goodsRecords() {
  return parseAbsGoods(ABS_GOODS_FIXTURE, {
    sourceDate: SOURCE_DATE,
    sourceUrl: absGoodsUrl('2024-07', '2025-06'),
  });
}

function servicesRecords() {
  return parseAbsServices(ABS_SERVICES_FIXTURE, {
    sourceDate: SOURCE_DATE,
    sourceUrl: absServicesUrl('2024'),
  });
}

describe('ABS Data API Beta endpoints', () => {
  it('uses the keyless Data API Beta base and pinned dataflow versions', () => {
    expect(ABS_TRADE_BASE_URL).toBe('https://data.api.abs.gov.au/rest/');
    expect(absGoodsUrl('2024-07', '2025-06')).toContain(
      `/data/ABS,${ABS_TRADE_GOODS_DATAFLOW},${ABS_TRADE_GOODS_VERSION}/`,
    );
    expect(absServicesUrl('2024')).toContain(
      `/data/ABS,${ABS_TRADE_SERVICES_DATAFLOW},${ABS_TRADE_SERVICES_VERSION}/`,
    );
    expect(absGoodsUrl('2024-07', '2025-06')).not.toMatch(/rest\/v1/);
  });

  it('sends no API key and fetches goods and services separately', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
      });
      const body = url.includes(ABS_TRADE_GOODS_DATAFLOW)
        ? ABS_GOODS_FIXTURE
        : ABS_SERVICES_FIXTURE;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/vnd.sdmx.data+json; version=2.0' },
      });
    };
    const result = await fetchAbsTradeRecords({
      fetchImpl,
      now: () => new Date('2026-11-18T00:00:00.000Z'),
    });
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.headers['x-api-key'] === undefined)).toBe(true);
    expect(result.goodsObservations).toBe(6);
    expect(result.servicesObservations).toBe(2);
    expect(result.records).toHaveLength(8);
    expect(result.sourceDate).toBe('2026-11-18');
  });
});

describe('ABS goods mapping', () => {
  it('converts AUD millions to integer cents and reads monthly periods', () => {
    const records = goodsRecords();
    expect(records).toHaveLength(6);
    const julyExports = records.find(
      (record) =>
        record.commodity_code === '1000' &&
        record.trade_flow === 'export' &&
        record.time_period === '2024-07',
    )!;
    expect(julyExports.amount_cents).toBe(4_169_700_000_000);
    expect(julyExports.financial_year).toBe('2024-25');
    expect(julyExports.measure_type).toBe('trade_value');
    expect(julyExports.location).toEqual({ granularity: 'national' });
    expect(julyExports.data_quality_flag).toBe('verified');
    expect(julyExports.source_dataset).toBe('ABS International Trade (Data API Beta)');

    const julyImports = records.find(
      (record) =>
        record.commodity_code === '2000' &&
        record.trade_flow === 'import' &&
        record.time_period === '2024-07',
    )!;
    expect(julyImports.amount_cents).toBe(3_880_100_000_000);
  });

  it('emits printed commodity categories with DATA_ITEM names and codes', () => {
    const commodity = goodsRecords().find((record) => record.commodity_code === '1400')!;
    expect(commodity.commodity_name).toBe('Metal ores and minerals');
    expect(commodity.trade_flow).toBe('export');
    expect(commodity.amount_cents).toBe(1_000_000_000_000);
  });

  it('maps month to financial year on a July start', () => {
    expect(financialYearForMonth('2024-07')).toBe('2024-25');
    expect(financialYearForMonth('2025-06')).toBe('2024-25');
    expect(financialYearForMonth('2025-07')).toBe('2025-26');
    expect(financialYearForMonth('2024-06')).toBe('2023-24');
  });
});

describe('ABS services mapping', () => {
  it('reads total-services credits/debits and maps the annual label to a financial year', () => {
    const records = servicesRecords();
    expect(records).toHaveLength(2);
    const exports = records.find((record) => record.trade_flow === 'export')!;
    const imports = records.find((record) => record.trade_flow === 'import')!;
    expect(exports.amount_cents).toBe(13_432_400_000_000);
    expect(imports.amount_cents).toBe(17_205_100_000_000);
    expect(exports.commodity_name).toBe('Total Services (BPM basis)');
    expect(exports.commodity_code).toBe('TOTAL');
    expect(exports.financial_year).toBe('2024-25');
    expect(exports.time_period).toBe('2024');
    expect(financialYearForLabelYear('2024')).toBe('2024-25');
    expect(financialYearForLabelYear('2023')).toBe('2023-24');
  });
});

describe('ABS trade non-additivity and no-profit guards', () => {
  it('never creates a goods+services total and never adds a profit field', () => {
    const records = [...goodsRecords(), ...servicesRecords()];
    expect(records.every((record) => record.measure_type === 'trade_value')).toBe(true);
    expect(
      records.some((record) => /goods.*services|total trade|combined/i.test(record.commodity_name)),
    ).toBe(false);
    for (const record of records) {
      expect(Object.keys(record)).not.toContain('profit');
      expect(record).not.toHaveProperty('profit');
      expect(record).not.toHaveProperty('profit_cents');
    }
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_abstrade`;

describe('ABS trade ingestion is idempotent and additive-only', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    await TradeRecordModel.create({
      trade_flow: 'export',
      measure_type: 'trade_value',
      commodity_name: 'Pre-existing other-source record',
      jurisdiction_level: 'federal',
      location: { granularity: 'national' },
      amount_cents: 123_456,
      financial_year: '2023-24',
      time_period: '2023',
      source_dataset: 'another trade source',
      source_url: 'https://example.test/trade',
      source_date: '2026-01-01',
      data_quality_flag: 'observed',
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('upserts the same observations without duplicating and preserves other sources', async () => {
    const records = [...goodsRecords(), ...servicesRecords()];
    const before = await TradeRecordModel.countDocuments({});
    const first = await upsertAbsTradeRecords(records);
    expect(first.upserted).toBe(8);
    expect(await TradeRecordModel.countDocuments({})).toBe(before + 8);
    expect(await TradeRecordModel.countDocuments({ source_dataset: 'another trade source' })).toBe(
      1,
    );

    const second = await upsertAbsTradeRecords(records);
    expect(second.upserted).toBe(0);
    expect(second.matched).toBe(8);
    expect(await TradeRecordModel.countDocuments({})).toBe(before + 8);
    expect(
      await TradeRecordModel.countDocuments({
        source_dataset: 'ABS International Trade (Data API Beta)',
      }),
    ).toBe(8);

    await recordAbsTradeSource(8);
    const sources = await mongoose.connection
      .db!.collection('data_sources')
      .findOne({ source_id: 'abs-international-trade' });
    expect(sources?.status).toBe('active');
    expect(sources?.records_ingested).toBe(8);
    expect(sources?.verified).toBe(true);
  });
});
