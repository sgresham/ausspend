import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  TAS_LG_CDC_DATASET,
  TAS_LG_CDC_ID,
  TAS_LG_CDC_MEASURES,
  createTasLgCdcConnector,
  detectCdcUnit,
  fiscalYearFromCdc,
  parseCdcFinancialRows,
  parseCdcRepositoryLinks,
  selectLatestCdcRepository,
  tasLgCdcNaturalKey,
  type CdcFinancialRow,
} from '../src/connectors/tas-lg-cdc.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';

const COUNCILS = Array.from(
  { length: 29 },
  (_, index) => `Council ${String(index + 1).padStart(2, '0')}`,
);
const YEARS = ['2022-2023', '2023-2024', '2024-2025'];

function rowsFor(years = YEARS, councilCount = 29): CdcFinancialRow[] {
  const rows: CdcFinancialRow[] = [];
  for (const year of years) {
    for (let index = 0; index < councilCount; index += 1) {
      const revenue = 20_000_000 + index * 100_000;
      const expenses = 18_000_000 + index * 80_000;
      const assets = 100_000_000 + index * 1_000_000;
      const liabilities = 10_000_000;
      rows.push({
        council: COUNCILS[index]!,
        year,
        values: {
          total_operating_revenue: revenue,
          total_operating_expenses: expenses,
          annual_operating_surplus_deficit: revenue - expenses,
          capital_expenditure_existing_assets: 1_000_000,
          capital_expenditure_new_assets: 2_000_000,
          total_assets: assets,
          total_liabilities: liabilities,
          net_assets: assets - liabilities,
          working_capital: 5_000_000,
        },
      });
    }
  }
  return rows;
}

describe('TAS CDC LIST discovery', () => {
  const JS = `downloadFile("data/LGA_CDC_Data_Repository_2000-2015.zip") downloadFile("data/LGA_CDC_Data_Repository_2015-2025.zip")`;

  it('discovers the actual ZIP repositories and selects the latest', () => {
    const links = parseCdcRepositoryLinks(JS);
    expect(links).toHaveLength(2);
    expect(links[0]).toContain('LGA_CDC_Data_Repository_2000-2015.zip');
    expect(selectLatestCdcRepository(links)).toContain('LGA_CDC_Data_Repository_2015-2025.zip');
  });

  it('rejects a page with no repository ZIP', () => {
    expect(() => selectLatestCdcRepository(parseCdcRepositoryLinks('no files here'))).toThrow(
      /no repository ZIP/,
    );
  });
});

describe('TAS CDC financial parsing', () => {
  it('detects whole dollars from total-assets magnitude, not $’000', () => {
    expect(detectCdcUnit(rowsFor())).toBe('AUD');
    const thousands = rowsFor().map((row) => ({
      ...row,
      values: Object.fromEntries(
        Object.entries(row.values).map(([key, value]) => [
          key,
          typeof value === 'number' ? value / 1000 : value,
        ]),
      ),
    }));
    expect(detectCdcUnit(thousands)).toBe('AUD_thousands');
  });

  it('selects the three most recent complete years and all 29 councils', () => {
    const parsed = parseCdcFinancialRows(rowsFor(), {
      sourceDate: '2026-11-18',
      sourceUrl: 'https://example.test/cdc.zip',
    });
    expect(parsed.years).toEqual(['2022-23', '2023-24', '2024-25']);
    expect(parsed.councils).toBe(29);
    expect(parsed.records).toHaveLength(29 * 3 * TAS_LG_CDC_MEASURES.length);
    expect(parsed.unit).toBe('AUD');
    expect(parsed.unitToCents).toBe(100);
  });

  it('refuses an incomplete year rather than presenting it as complete', () => {
    expect(() =>
      parseCdcFinancialRows(rowsFor(YEARS, 28), {
        sourceDate: '2026-11-18',
        sourceUrl: 'https://example.test/cdc.zip',
      }),
    ).toThrow(/expected 29/);
  });

  it('maps council, year, dataset, unit, lga and non-additive provenance', () => {
    const parsed = parseCdcFinancialRows(rowsFor(), {
      sourceDate: '2026-11-18',
      sourceUrl: 'https://example.test/cdc.zip',
    });
    for (const record of parsed.records) {
      expect(record).toMatchObject({
        source_id: TAS_LG_CDC_ID,
        jurisdiction_level: 'local',
        jurisdiction: 'TAS',
        measure_type: 'actual',
        source_dataset: TAS_LG_CDC_DATASET,
        aggregation_role: 'agency_detail',
        verified: false,
      });
      expect(record.location).toMatchObject({ state: 'TAS' });
      expect(record.location?.lga_name).toBeTruthy();
      expect(record.amount_cents).toBeGreaterThan(0);
      expect(record.category).toBeTruthy();
      expect(record.notes).toContain('unit: AUD');
    }
    const totalRevenue = parsed.records.find(
      (record) => record.category === 'total_operating_revenue',
    )!;
    expect(totalRevenue.amount_cents).toBe(2_000_000_000);
    expect(totalRevenue.fiscal_year).toBe('2022-23');
    expect(totalRevenue.natural_key).toBe(
      tasLgCdcNaturalKey({
        council: 'Council 01',
        fiscalYear: '2022-23',
        measure: 'total_operating_revenue',
      }),
    );
    expect(
      parsed.records.every(
        (record) => !/all councils|total councils/i.test(record.project_name ?? ''),
      ),
    ).toBe(true);
  });

  it('uses stable natural keys and fiscal-year labels', () => {
    expect(fiscalYearFromCdc('2024-2025')).toBe('2024-25');
    expect(fiscalYearFromCdc('2024-25')).toBeNull();
    expect(
      tasLgCdcNaturalKey({ council: 'Council 01', fiscalYear: '2024-25', measure: 'total_assets' }),
    ).toMatch(/^tas-lg-cdc:[a-f0-9]{40}$/);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_taslg`;

function tasBudgetGuard(): SpendingRecord {
  return {
    amount_cents: 1_000,
    measure_type: 'actual',
    fiscal_year: '2024-25',
    source_id: 'tas-budget',
    source_url: 'https://example.test/tas-budget',
    verified: true,
    natural_key: 'tas-budget:guard',
    project_name: 'TAS Budget guard row',
  };
}

describe('TAS CDC ingestion is idempotent and separate from TAS Budget', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('runs twice without duplication and preserves TAS Budget', async () => {
    await MeasureModel.create(tasBudgetGuard());
    const parsed = parseCdcFinancialRows(rowsFor(), {
      sourceDate: '2026-11-18',
      sourceUrl: 'https://example.test/cdc.zip',
    });
    const fakeConnector = {
      ...createTasLgCdcConnector(),
      async fetch() {
        return [{ kind: 'tas-lg-cdc-records', records: parsed.records }];
      },
      transform(raw: readonly { kind: string; records?: unknown }[]) {
        return (raw[0]?.records as SpendingRecord[]) ?? [];
      },
    };
    await runIngestion({ connectors: [fakeConnector] });
    await runIngestion({ connectors: [fakeConnector] });
    expect(await MeasureModel.countDocuments({ source_id: TAS_LG_CDC_ID })).toBe(696);
    expect(await MeasureModel.countDocuments({ source_id: 'tas-budget' })).toBe(1);
    expect(
      await MeasureModel.countDocuments({ source_id: TAS_LG_CDC_ID, source_dataset: /Budget/i }),
    ).toBe(0);
    const source = await DataSourceModel.findOne({ source_id: TAS_LG_CDC_ID }).lean();
    expect(source?.records_ingested).toBe(696);
  });
});
