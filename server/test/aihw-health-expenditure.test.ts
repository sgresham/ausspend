import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  AIHW_DATASET,
  AIHW_FUNCTION_CODE,
  AIHW_ID,
  AIHW_RESOURCE_URL,
  AIHW_UNIT,
  AIHW_UNIT_TO_CENTS,
  aihwMillionsToCents,
  aihwNaturalKey,
  createAihwHealthExpenditureConnector,
  parseAihwCsv,
} from '../src/connectors/aihw-health-expenditure.js';
import { isAdditiveMeasure, isNonAdditiveMeasure } from '../src/api/measure-summary.js';
import { AIHW_SOURCE_ID, measureQuery } from '../src/api/filters.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import { createApp } from '../src/app.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_aihw`;

const CSV = `financial_year,state,area_of_expenditure,broad_source_of_funding,detailed_source_of_funding,real_expenditure_millions
2011-12,NSW,Public hospitals,Government,Australian Government,1234
2011-12,NSW,Public hospitals,Government,State and local,5678
2011-12,NSW,Public hospitals,Non-government,Individuals,90
2011-12,NSW,Medical expense tax rebate,Non-government,Individuals,-84
2011-12,VIC,Public hospitals,Government,Australian Government,0
,,,,,
2011-12,XX,Public hospitals,Government,Australian Government,10
2011-12,NSW,Public hospitals,Government,Individuals,10
2011-12,NSW,Public hospitals,Government,State and local,not-a-number
`;

function byDescription(records: SpendingRecord[], text: string): SpendingRecord {
  const record = records.find((entry) => entry.description?.includes(text));
  if (!record) throw new Error(`missing record ${text}`);
  return record;
}

describe('AIHW health-expenditure CSV mapping', () => {
  const parsed = parseAihwCsv(CSV);

  it('parses every valid row and reports malformed/non-expenditure padding rows', () => {
    expect(parsed.records).toHaveLength(5);
    expect(parsed.skipped).toHaveLength(3);
    expect(parsed.skipped.map((skip) => skip.reason).join(' | ')).toMatch(/unknown state/);
    expect(parsed.skipped.map((skip) => skip.reason).join(' | ')).toMatch(/broad source/);
    expect(parsed.skipped.map((skip) => skip.reason).join(' | ')).toMatch(/non-numeric/);
  });

  it('maps the required provenance, COFOG 07 and non-additive agency detail', () => {
    for (const record of parsed.records) {
      expect(record.function_code).toBe(AIHW_FUNCTION_CODE);
      expect(record.measure_type).toBe('actual');
      expect(record.source_id).toBe(AIHW_ID);
      expect(record.source_url).toBe(AIHW_RESOURCE_URL);
      expect(record.source_dataset).toBe(AIHW_DATASET);
      expect(record.verified).toBe(true);
      expect(record.data_quality_flag).toBe('verified');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.aihw_unit).toBe(AIHW_UNIT);
      expect(record.location?.state).toBeTruthy();
      // No row is additive: government and non-government, federal and state
      // rows are never summed by the API.
      expect(isAdditiveMeasure(record)).toBe(false);
      expect(isNonAdditiveMeasure(record)).toBe(true);
    }
  });

  it('keeps Commonwealth and state government funding as separate jurisdictions', () => {
    const commonwealth = byDescription(parsed.records, 'Australian Government');
    const state = byDescription(parsed.records, 'State and local');
    expect(commonwealth.jurisdiction_level).toBe('federal');
    expect(commonwealth.jurisdiction).toBe('Australia');
    expect(commonwealth.potential_double_count).toBe(true);
    expect(state.jurisdiction_level).toBe('state');
    expect(state.jurisdiction).toBe('NSW');
    expect(state.potential_double_count).toBe(true);
  });

  it('keeps non-government funding distinct from government spending', () => {
    const individual = byDescription(parsed.records, 'Non-government funding: Individuals');
    expect(individual.aihw_broad_source_of_funding).toBe('Non-government');
    expect(individual.jurisdiction_level).toBe('other');
    expect(individual.jurisdiction).toBe('NSW');
    expect(individual.potential_double_count).toBe(false);
    expect(individual.funding_source).toBe('Individuals');
  });

  it('stores negative rebates as magnitudes with an explicit printed sign', () => {
    const rebate = parsed.records.find((record) =>
      record.description?.includes('Medical expense tax rebate'),
    );
    expect(rebate?.amount_cents).toBe(84 * AIHW_UNIT_TO_CENTS);
    expect(rebate?.aihw_printed_sign).toBe('negative');
    expect(rebate?.amount_cents).toBeGreaterThanOrEqual(0);
  });

  it('keeps a published zero as zero rather than dropping or fabricating it', () => {
    const zero = parsed.records.find((record) => record.location?.state === 'VIC');
    expect(zero?.amount_cents).toBe(0);
    expect(zero?.aihw_printed_sign).toBeUndefined();
  });

  it('converts real $m to integer cents with the explicit unit', () => {
    expect(aihwMillionsToCents(1)).toBe(100_000_000);
    expect(aihwMillionsToCents(0.5)).toBe(50_000_000);
    expect(aihwMillionsToCents(1234)).toBe(123_400_000_000);
  });

  it('uses stable natural keys and is idempotent', () => {
    const again = parseAihwCsv(CSV);
    expect(again.records.map((record) => record.natural_key)).toEqual(
      parsed.records.map((record) => record.natural_key),
    );
    const key = aihwNaturalKey({
      fiscal_year: '2011-12',
      state: 'NSW',
      area: 'Public hospitals',
      broad: 'Government',
      detailed: 'Australian Government',
    });
    expect(key).toBe(
      aihwNaturalKey({
        fiscal_year: '2011-12',
        state: 'NSW',
        area: 'Public hospitals',
        broad: 'Government',
        detailed: 'Australian Government',
      }),
    );
    expect(key.startsWith(`${AIHW_ID}:`)).toBe(true);
  });
});

describe('AIHW generic-query separation', () => {
  it('is excluded from generic views unless the source is requested explicitly', () => {
    expect(measureQuery({ limit: 20 }).source_id).toEqual({ $ne: AIHW_SOURCE_ID });
    expect(measureQuery({ source_id: AIHW_SOURCE_ID, limit: 20 }).source_id).toBe(AIHW_SOURCE_ID);
  });
});

describe('AIHW connector fetch/transform', () => {
  it('uses the injected CSV without a network call and records warnings', async () => {
    const connector = createAihwHealthExpenditureConnector({ csvText: CSV });
    const raw = await connector.fetch();
    const records = connector.transform(raw);
    expect(records).toHaveLength(5);
    expect(connector.metadata.fetchStrategy).toBe('direct');
    expect(connector.metadata.errors).toEqual([]);
    expect(connector.metadata.warnings.join(' ')).toMatch(/3 AIHW row\(s\) skipped/);
  });
});

describe('AIHW ingestion is idempotent and never deletes', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('runs twice without duplicating AIHW rows and preserves an unrelated source', async () => {
    const other: SpendingRecord = {
      amount_cents: 1_000,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: 'unrelated-source',
      source_url: 'https://example.gov.au/unrelated',
      verified: true,
      natural_key: 'unrelated-source:1',
      description: 'Unrelated fixture row',
    };
    await MeasureModel.create(other);

    const connector = createAihwHealthExpenditureConnector({ csvText: CSV });
    await runIngestion({ connectors: [connector] });
    await runIngestion({ connectors: [connector] });

    expect(await MeasureModel.countDocuments({ source_id: AIHW_ID })).toBe(5);
    expect(await MeasureModel.countDocuments({ source_id: 'unrelated-source' })).toBe(1);
    const source = await DataSourceModel.findOne({ source_id: AIHW_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(5);
    expect(source?.fetch_strategy).toBe('direct');
  });

  it('excludes AIHW from the default API view but exposes it by source_id', async () => {
    const app = createApp({ pingDb: async () => 'connected' });
    const generic = await request(app).get('/api/spending?limit=20');
    expect(generic.status).toBe(200);
    expect(generic.body.summary.non_additive_count).toBe(0);
    expect(generic.body.data.some((row: { source_id: string }) => row.source_id === AIHW_ID)).toBe(
      false,
    );

    const explicit = await request(app).get(`/api/spending?source_id=${AIHW_ID}&limit=20`);
    expect(explicit.status).toBe(200);
    expect(explicit.body.summary.count).toBe(5);
    expect(explicit.body.summary.non_additive_count).toBe(5);
    expect(explicit.body.summary.total_cents).toBeNull();
    expect(
      explicit.body.data.every((row: { source_id: string }) => row.source_id === AIHW_ID),
    ).toBe(true);
  });
});
