import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  OECD_ITIC_DATAFLOW,
  OECD_ITIC_SOURCE_DATASET,
  OECD_ITIC_VERSION,
  commodityCodeFromId,
  deriveQualityFlag,
  fetchOecdIticRecords,
  oecdIticDataUrl,
  oecdIticRequestPlan,
  parseIticData,
  recordOecdIticSource,
  sanityCheckAustraliaMargins,
  upsertOecdIticRecords,
} from '../src/connectors/trade/oecd-itic/index.js';
import { TradeRecordModel } from '../src/models/index.js';
import type { SdmxDataJson } from '../src/connectors/trade/oecd-itic/parse.js';

const SOURCE_DATE = '2026-11-18';
const PARTNER_URL = oecdIticDataUrl({ year: '2019', counterpartArea: '', commodity: '_T' });
const WORLD_URL = oecdIticDataUrl({ year: '2019', counterpartArea: 'W', commodity: '' });

function dimension(id: string, values: Array<{ id: string; name?: string }>) {
  return { id, values };
}

const PARTNER_FIXTURE: SdmxDataJson = {
  data: {
    dataSets: [
      {
        series: {
          // CHN: OBS_STATUS=I (imputed), METHODOLOGY_TYPE=AG (aggregation)
          '0:0:0:0:0:0:0': { observations: { '0': [2.4892, 0, 0] } },
          // USA: OBS_STATUS=A (normal), METHODOLOGY_TYPE=AG
          '0:1:0:0:0:0:0': { observations: { '0': [5.0, 1, 0] } },
          // JPN: OBS_STATUS=A, METHODOLOGY_TYPE=AD (adjustment)
          '0:2:0:0:0:0:0': { observations: { '0': [7.5, 1, 2] } },
          // DEU: OBS_STATUS=I, METHODOLOGY_TYPE=ME (model-based estimation)
          '0:3:0:0:0:0:0': { observations: { '0': [4.2, 0, 1] } },
        },
      },
    ],
    structure: {
      dimensions: {
        series: [
          dimension('REF_AREA', [{ id: 'AUS', name: 'Australia' }]),
          dimension('COUNTERPART_AREA', [
            { id: 'CHN', name: 'China' },
            { id: 'USA', name: 'United States' },
            { id: 'JPN', name: 'Japan' },
            { id: 'DEU', name: 'Germany' },
          ]),
          dimension('MEASURE', [{ id: 'C_F', name: 'CIF/FOB margin' }]),
          dimension('PRODUCT_TYPE', [{ id: 'C', name: 'Commodities' }]),
          dimension('COMM_HS2017', [{ id: '_T', name: 'Total' }]),
          dimension('FREQ', [{ id: 'A', name: 'Annual' }]),
          dimension('UNIT_MEASURE', [
            { id: 'PT_IM_CIF', name: 'Percentage of imports (valued at the CIF price)' },
          ]),
        ],
        observation: [dimension('TIME_PERIOD', [{ id: '2019' }])],
      },
      attributes: {
        observation: [
          dimension('OBS_STATUS', [{ id: 'I' }, { id: 'A' }]),
          dimension('METHODOLOGY_TYPE', [{ id: 'AG' }, { id: 'ME' }, { id: 'AD' }]),
        ],
      },
    },
  },
};

const WORLD_FIXTURE: SdmxDataJson = {
  data: {
    dataSets: [
      {
        series: {
          // HS17_0101: 2019 = 3.0, 2022 = 6.0 (normal/observed)
          '0:0:0:0:0:0:0': { observations: { '0': [3.0, 1, 0], '1': [6.0, 1, 0] } },
          // HS17_2709: 2019 = 4.0, 2022 = 6.8 (imputed/estimated)
          '0:0:0:0:1:0:0': { observations: { '0': [4.0, 0, 0], '1': [6.8, 0, 0] } },
          // Total row (no HS code); excluded from the sanity diagnostic
          '0:0:0:0:2:0:0': { observations: { '0': [3.5, 1, 0], '1': [6.4, 1, 0] } },
        },
      },
    ],
    structure: {
      dimensions: {
        series: [
          dimension('REF_AREA', [{ id: 'AUS', name: 'Australia' }]),
          dimension('COUNTERPART_AREA', [{ id: 'W', name: 'World' }]),
          dimension('MEASURE', [{ id: 'C_F', name: 'CIF/FOB margin' }]),
          dimension('PRODUCT_TYPE', [{ id: 'C', name: 'Commodities' }]),
          dimension('COMM_HS2017', [
            { id: 'HS17_0101', name: 'Horses; live' },
            { id: 'HS17_2709', name: 'Petroleum oils; crude' },
            { id: '_T', name: 'Total' },
          ]),
          dimension('FREQ', [{ id: 'A', name: 'Annual' }]),
          dimension('UNIT_MEASURE', [
            { id: 'PT_IM_CIF', name: 'Percentage of imports (valued at the CIF price)' },
          ]),
        ],
        observation: [dimension('TIME_PERIOD', [{ id: '2019' }, { id: '2022' }])],
      },
      attributes: {
        observation: [
          dimension('OBS_STATUS', [{ id: 'I' }, { id: 'A' }]),
          dimension('METHODOLOGY_TYPE', [{ id: 'AG' }, { id: 'ME' }, { id: 'AD' }]),
        ],
      },
    },
  },
};

function partnerRecords() {
  return parseIticData(PARTNER_FIXTURE, { sourceDate: SOURCE_DATE, sourceUrl: PARTNER_URL });
}

function worldRecords() {
  return parseIticData(WORLD_FIXTURE, { sourceDate: SOURCE_DATE, sourceUrl: WORLD_URL });
}

describe('OECD ITIC endpoint and key', () => {
  it('uses the public SDMX dataflow, the documented key order and no API key', async () => {
    expect(OECD_ITIC_DATAFLOW).toBe('DSD_ITIC@DF_ITIC');
    expect(OECD_ITIC_VERSION).toBe('1.1');
    expect(partnerURLKey(PARTNER_URL)).toBe('AUS..C_F.C._T.A.PT_IM_CIF');
    expect(partnerURLKey(WORLD_URL)).toBe('AUS.W.C_F.C..A.PT_IM_CIF');
    expect(PARTNER_URL).toContain(`/data/OECD.SDD.TPS,${OECD_ITIC_DATAFLOW},${OECD_ITIC_VERSION}/`);

    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
      });
      return new Response(JSON.stringify(PARTNER_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/vnd.sdmx.data+json; version=1.0' },
      });
    };
    const result = await fetchOecdIticRecords({
      fetchImpl,
      now: () => new Date('2026-11-18T00:00:00.000Z'),
      requestDelayMs: 0,
    });
    expect(calls).toHaveLength(oecdIticRequestPlan().length);
    expect(calls.every((call) => call.headers['x-api-key'] === undefined)).toBe(true);
    expect(calls.every((call) => call.headers['authorization'] === undefined)).toBe(true);
    expect(result.documents).toHaveLength(calls.length);
    expect(result.sourceDate).toBe('2026-11-18');
  });

  it('plans partner totals for 2019–2022 and World HS4 products for 2019 and 2022', () => {
    const plan = oecdIticRequestPlan();
    expect(
      plan.filter((entry) => entry.counterpartArea === 'W').map((entry) => entry.year),
    ).toEqual(['2019', '2022']);
    expect(plan.filter((entry) => entry.counterpartArea === '').map((entry) => entry.year)).toEqual(
      ['2019', '2020', '2021', '2022'],
    );
  });
});

function partnerURLKey(url: string): string {
  const match = /\/data\/[^/]+\/([^?]+)/.exec(url);
  if (!match) throw new Error(`no key in ${url}`);
  return match[1]!;
}

describe('OECD ITIC mapping', () => {
  it('maps Australia margins to import cif_fob_margin rows, never trade_value', () => {
    const records = partnerRecords();
    expect(records).toHaveLength(4);
    for (const record of records) {
      expect(record.trade_flow).toBe('import');
      expect(record.measure_type).toBe('cif_fob_margin');
      expect(record.amount_cents).toBe(0);
      expect(record.source_dataset).toBe(OECD_ITIC_SOURCE_DATASET);
      expect(record.financial_year).toBe('2019');
      expect(record.time_period).toBe('2019');
      expect(record.location).toEqual({ granularity: 'national' });
      expect(record).not.toHaveProperty('profit');
    }
    const china = records.find((record) => record.partner_country === 'CHN')!;
    expect(china.margin_percent).toBeCloseTo(2.4892, 6);
    expect(china.commodity_name).toBe('Total - all products');
    expect(china.commodity_code).toBeUndefined();
  });

  it('preserves observed vs estimated vs provisional from METHODOLOGY_TYPE', () => {
    const byPartner = new Map(partnerRecords().map((record) => [record.partner_country, record]));
    expect(byPartner.get('USA')!.data_quality_flag).toBe('observed');
    expect(byPartner.get('CHN')!.data_quality_flag).toBe('estimated');
    expect(byPartner.get('DEU')!.data_quality_flag).toBe('estimated');
    expect(byPartner.get('JPN')!.data_quality_flag).toBe('provisional');

    // A modelled row is never labelled observed even when OBS_STATUS is normal.
    expect(deriveQualityFlag('A', 'ME')).toBe('estimated');
    expect(deriveQualityFlag('A', 'IE')).toBe('estimated');
    expect(deriveQualityFlag('A', 'DE')).toBe('estimated');
    expect(deriveQualityFlag('I', 'AG')).toBe('estimated');
    expect(deriveQualityFlag('A', 'AG')).toBe('observed');
    expect(deriveQualityFlag('A', 'AD')).toBe('provisional');
  });

  it('reads HS 2017 4-digit codes and keeps partner dimensions separate', () => {
    expect(commodityCodeFromId('HS17_0101')).toBe('0101');
    expect(commodityCodeFromId('HS17_999999')).toBeUndefined();
    expect(commodityCodeFromId('_T')).toBeUndefined();

    const records = worldRecords();
    const horses = records.find((record) => record.commodity_code === '0101')!;
    expect(horses.commodity_name).toBe('Horses; live');
    expect(horses.partner_country).toBe('W');
    expect(horses.margin_percent).toBe(3.0);
    const horses2022 = records.find(
      (record) => record.commodity_code === '0101' && record.financial_year === '2022',
    )!;
    expect(horses2022.margin_percent).toBe(6.0);
    const total = records.find((record) => record.commodity_name === 'Total - all products')!;
    expect(total.commodity_code).toBeUndefined();
  });
});

describe('OECD ITIC sanity and non-additivity', () => {
  it('compares the unweighted HS4 mean with the headline and flags mismatches rather than adjusting', () => {
    const matched = sanityCheckAustraliaMargins(worldRecords());
    expect(matched.find((result) => result.year === '2019')!.matched).toBe(true);
    expect(matched.find((result) => result.year === '2019')!.observed_unweighted_mean_percent).toBe(
      3.5,
    );
    expect(matched.find((result) => result.year === '2022')!.matched).toBe(true);
    expect(matched.find((result) => result.year === '2022')!.observed_unweighted_mean_percent).toBe(
      6.4,
    );

    const mismatch = worldRecords().map((record) =>
      record.commodity_code ? { ...record, margin_percent: 6 } : record,
    );
    const flagged = sanityCheckAustraliaMargins(mismatch);
    expect(flagged.find((result) => result.year === '2019')!.matched).toBe(false);
    expect(flagged.find((result) => result.year === '2019')!.note).toMatch(/not adjusted/);
  });

  it('uses a mean, not a sum, and never combines margins with trade values', () => {
    const records = worldRecords().filter(
      (record) => record.financial_year === '2019' && record.commodity_code,
    );
    const result = sanityCheckAustraliaMargins(records);
    const mean = result.find((entry) => entry.year === '2019')!;
    expect(mean.observed_unweighted_mean_percent).toBe(3.5);
    expect(mean.rows).toBe(2);
    expect(records.every((record) => record.measure_type === 'cif_fob_margin')).toBe(true);
    expect(records.every((record) => record.amount_cents === 0)).toBe(true);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_oecditic`;

describe('OECD ITIC ingestion is idempotent and additive-only', () => {
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
    const records = [...partnerRecords(), ...worldRecords()];
    const before = await TradeRecordModel.countDocuments({});
    const first = await upsertOecdIticRecords(records);
    expect(first.upserted).toBe(records.length);
    expect(await TradeRecordModel.countDocuments({})).toBe(before + records.length);
    expect(await TradeRecordModel.countDocuments({ source_dataset: 'another trade source' })).toBe(
      1,
    );

    const second = await upsertOecdIticRecords(records);
    expect(second.upserted).toBe(0);
    expect(second.matched).toBe(records.length);
    expect(await TradeRecordModel.countDocuments({})).toBe(before + records.length);
    expect(
      await TradeRecordModel.countDocuments({ source_dataset: OECD_ITIC_SOURCE_DATASET }),
    ).toBe(records.length);

    await recordOecdIticSource(records.length, sanityCheckAustraliaMargins(worldRecords()));
    const source = await mongoose.connection
      .db!.collection('data_sources')
      .findOne({ source_id: 'oecd-itic' });
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(records.length);
    expect(source?.notes).toContain('Sanity diagnostic');
    expect(source?.notes).toContain('no value adjusted');
  });
});
