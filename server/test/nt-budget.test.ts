import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  NT_BUDGET_FISCAL_YEAR,
  NT_BUDGET_ID,
  NT_BUDGET_UNIT,
  NT_BUDGET_UNIT_TO_CENTS,
  NT_COFOG_CATEGORIES,
  assertNtBudgetPremise,
  createNtBudgetConnector,
  detectNtBudgetUnit,
  ntBudgetNaturalKey,
  ntMillionsToCents,
  parseNtCofogText,
} from '../src/connectors/nt-budget.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_nt`;

const FIXTURE = `2026-27 Budget Paper No. 4 — The Infrastructure Program
Table 3: Capital works by COFOG - A category 2026-27 Capital works $M % Transport 2 041.1 48.0 Housing and community amenities 782.1 18.4 Economic affairs 496.3 11.7 Public order and safety 426.3 10.0 Education 158.0 3.7 Social protection 112.1 2.7 Health 102.5 2.4 Recreation, culture and religion 99.3 2.3 Environmental protection 26.3 0.6 General public services 9.6 0.2 TOTAL GENERAL GOVERNMENT 4 253.6 100.0 Transport The 2026-27 program continues to invest heavily in transport infrastructure.`;

describe('NT Budget COFOG-A table', () => {
  const parsed = parseNtCofogText(FIXTURE);

  it('parses the ten published COFOG-A categories and reconciles to the total', () => {
    expect(parsed.rows).toHaveLength(10);
    expect(parsed.unit).toBe(NT_BUDGET_UNIT);
    expect(parsed.total_millions).toBe(4_253.6);
    expect(parsed.total_percent).toBe(100);
    expect(parsed.reconciled.amount_sum).toBeCloseTo(4_253.6, 1);
    expect(parsed.reconciled.amount_difference).toBeLessThanOrEqual(0.1);
    expect(parsed.reconciled.percent_difference).toBeLessThanOrEqual(0.1);
    expect(() => assertNtBudgetPremise(parsed)).not.toThrow();
  });

  it('maps the published labels to COFOG divisions without inventing labels', () => {
    expect(NT_COFOG_CATEGORIES).toHaveLength(10);
    const transport = parsed.records.find((record) => record.nt_cofog_category === 'Transport');
    const housing = parsed.records.find(
      (record) => record.nt_cofog_category === 'Housing and community amenities',
    );
    const health = parsed.records.find((record) => record.nt_cofog_category === 'Health');
    const education = parsed.records.find((record) => record.nt_cofog_category === 'Education');
    expect(transport?.function_code).toBe('04');
    expect(housing?.function_code).toBe('06');
    expect(health?.function_code).toBe('07');
    expect(education?.function_code).toBe('09');
  });

  it('stores territory/budget/provisional/medium-confidence provenance', () => {
    for (const record of parsed.records) {
      expect(record.source_id).toBe(NT_BUDGET_ID);
      expect(record.measure_type).toBe('budget');
      expect(record.fiscal_year).toBe(NT_BUDGET_FISCAL_YEAR);
      expect(record.jurisdiction_level).toBe('territory');
      expect(record.jurisdiction).toBe('NT');
      expect(record.location?.state).toBe('NT');
      expect(record.location?.lga_name).toBeUndefined();
      expect(record.data_quality_flag).toBe('provisional');
      expect(record.extraction_confidence).toBe('medium');
      expect(record.verified).toBe(false);
      expect(record.aggregation_role).toBe('additive');
      expect(record.nt_unit).toBe(NT_BUDGET_UNIT);
      expect(record.nt_percent_share).toBeTypeOf('number');
      expect(record.nt_table).toMatch(/Table 3/);
    }
  });

  it('converts $m to integer cents and never emits the printed total row', () => {
    expect(ntMillionsToCents(1)).toBe(NT_BUDGET_UNIT_TO_CENTS);
    expect(ntMillionsToCents(0.5)).toBe(50_000_000);
    expect(ntMillionsToCents(4_253.6)).toBe(425_360_000_000);
    expect(
      parsed.records.some((record) => record.nt_cofog_category === 'TOTAL GENERAL GOVERNMENT'),
    ).toBe(false);
    const sum = parsed.records.reduce((total, record) => total + record.amount_cents, 0);
    expect(sum).toBe(ntMillionsToCents(parsed.total_millions));
  });

  it('detects the unit from the table header and rejects an absent unit', () => {
    expect(detectNtBudgetUnit('Capital works $M % Transport 2 041.1 48.0')).toBe(NT_BUDGET_UNIT);
    expect(() => detectNtBudgetUnit('Capital works Transport 2 041.1 48.0')).toThrow(/unit/);
  });

  it('rejects a table that does not reconcile to its printed total', () => {
    const bad = FIXTURE.replace(
      'TOTAL GENERAL GOVERNMENT 4 253.6 100.0',
      'TOTAL GENERAL GOVERNMENT 4 000.0 100.0',
    );
    expect(() => parseNtCofogText(bad)).toThrow(/sum to/);
  });

  it('uses stable natural keys including category and COFOG', () => {
    const key = ntBudgetNaturalKey({
      fiscal_year: NT_BUDGET_FISCAL_YEAR,
      category: 'Transport',
      cofog: '04',
    });
    expect(key).toBe(
      ntBudgetNaturalKey({
        fiscal_year: NT_BUDGET_FISCAL_YEAR,
        category: 'Transport',
        cofog: '04',
      }),
    );
    expect(key).not.toBe(
      ntBudgetNaturalKey({
        fiscal_year: NT_BUDGET_FISCAL_YEAR,
        category: 'Health',
        cofog: '07',
      }),
    );
    expect(key.startsWith(`${NT_BUDGET_ID}:`)).toBe(true);
  });
});

describe('NT Budget DB ingestion', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('runs twice without duplicating NT rows and preserves an unrelated source', async () => {
    const other: SpendingRecord = {
      amount_cents: 1_000,
      measure_type: 'actual',
      fiscal_year: '2026-27',
      source_id: 'unrelated-source',
      source_url: 'https://example.gov.au/unrelated',
      verified: true,
      natural_key: 'unrelated-source:nt',
      description: 'Unrelated fixture row',
    };
    await MeasureModel.create(other);

    const connector = createNtBudgetConnector({ text: FIXTURE });
    await runIngestion({ connectors: [connector] });
    const afterFirst = await MeasureModel.countDocuments({ source_id: NT_BUDGET_ID });
    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: NT_BUDGET_ID })).toBe(afterFirst);
    expect(afterFirst).toBe(10);
    expect(await MeasureModel.countDocuments({ source_id: 'unrelated-source' })).toBe(1);
    const source = await DataSourceModel.findOne({ source_id: NT_BUDGET_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(10);
    expect(source?.fetch_strategy).toBe('headless');
  });
});
