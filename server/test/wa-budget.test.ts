import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WA_ID,
  WA_UNIT_TO_CENTS,
  createWaBudgetConnector,
  parseWaWorkbooksAsync,
  selectLatestWaEfoPackage,
  selectWaWorkbookResources,
  waMeasureTypeForYear,
  waMillionsToCents,
  waNaturalKey,
  type CkanPackage,
} from '../src/connectors/wa-budget.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_wa`;

type Row = Array<string | number | null>;

async function makeWorkbook(sheets: Array<{ name: string; rows: Row[] }>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    sheet.rows.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        if (value !== null) worksheet.getRow(rowIndex + 1).getCell(columnIndex + 1).value = value;
      });
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

function chapter5Rows(unit = '$m'): Row[] {
  return [
    ['Table 6'],
    [],
    ['MINISTER FOR HEALTH'],
    ['MAJOR SPENDING CHANGES'],
    [null, '2015-16', '2016-17', '2017-18', '2018-19', '2019-20'],
    [null, unit, unit, unit, unit, unit],
    ['WA Health'],
    ['-   Hospital Services', 1, 40.1, 70.2, 124.9, 191.1],
    ['-   Wages Policy', -40.6, -0.6, 5.1, 0.7, -17.7],
    ['-   Nil measure', '-', '-', '-', '-', '-'],
  ];
}

function chapter6Rows(total2015 = 1473): Row[] {
  return [
    ['Table 1'],
    [],
    ['ASSET INVESTMENT PROGRAM'],
    [null, '2015-16', '2016-17', '2017-18', '2018-19', '2019-20'],
    [null, '$m', '$m', '$m', '$m', '$m'],
    ['Main Roads', 988, 1245, 1486, 1003, 636],
    ['Public Transport Authority', 485, 572, 756, 874, 1116],
    ['Total', total2015, 1817, 2242, 1877, 1752],
  ];
}

async function fixtures(): Promise<{ chapter5: Buffer; chapter6: Buffer }> {
  return {
    chapter5: await makeWorkbook([{ name: 'Table 6', rows: chapter5Rows() }]),
    chapter6: await makeWorkbook([{ name: 'Table 1', rows: chapter6Rows() }]),
  };
}

describe('WA CKAN discovery helpers', () => {
  const resource = (
    name: string,
    format = 'XLSX',
  ): { name: string; format: string; url: string } => ({
    name,
    format,
    url: `https://example/${name}.xlsx`,
  });
  const packages: CkanPackage[] = [
    {
      name: '2015-16-western-australia-budget-economic-and-fiscal-outlook-table-and-chart-data',
      title: '2015-16 Western Australia Budget EFO',
      resources: [resource('2015-16 Chapter 5'), resource('2015-16 Chapter 6')],
    },
    {
      name: '2016-17-western-australia-budget-economic-and-fiscal-outlook-table-and-chart-data',
      title: '2016-17 Western Australia Budget EFO',
      resources: [resource('2016-17 Chapter 5'), resource('2016-17 Chapter 6')],
    },
  ];

  it('selects the latest EFO package with XLSX Chapter 5 and 6', () => {
    expect(selectLatestWaEfoPackage(packages)?.name).toContain('2016-17');
    expect(selectLatestWaEfoPackage([packages[0]!])?.name).toContain('2015-16');
  });

  it('selects the Chapter 5 and Chapter 6 XLSX resources', () => {
    const selected = selectWaWorkbookResources(packages[1]!);
    expect(selected.chapter5.name).toBe('2016-17 Chapter 5');
    expect(selected.chapter6.name).toBe('2016-17 Chapter 6');
  });

  it('rejects a package without both workbooks', () => {
    expect(() =>
      selectWaWorkbookResources({
        name: 'x',
        title: 'x',
        resources: [resource('Chapter 5')],
      }),
    ).toThrow(/no XLSX Chapter 5\/Chapter 6/);
  });
});

describe('WA unit, measure-type and natural-key helpers', () => {
  it('maps the documented WA budget year convention', () => {
    expect(waMeasureTypeForYear('2015-16')).toBe('actual');
    expect(waMeasureTypeForYear('2016-17')).toBe('budget');
    expect(waMeasureTypeForYear('2017-18')).toBe('estimate');
    expect(waMeasureTypeForYear('2019-20')).toBe('estimate');
  });

  it('converts $m to integer cents', () => {
    expect(waMillionsToCents(1)).toBe(WA_UNIT_TO_CENTS);
    expect(waMillionsToCents(-40.6)).toBe(4_060_000_000);
    expect(waMillionsToCents(0.5)).toBe(50_000_000);
  });

  it('builds a stable natural key', () => {
    const parts = {
      kind: 'major_spending_change',
      table: 'Chapter 5 Table 6',
      agency: 'WA Health',
      measure: 'Hospital Services',
      fiscal_year: '2016-17',
    };
    expect(waNaturalKey(parts)).toBe(waNaturalKey(parts));
    expect(waNaturalKey(parts).startsWith(`${WA_ID}:`)).toBe(true);
  });
});

describe('WA workbook parsing', () => {
  it('maps Chapter 5 policy measures and Chapter 6 reconciled agency rows', async () => {
    const { chapter5, chapter6 } = await fixtures();
    const parsed = await parseWaWorkbooksAsync(chapter5, chapter6, {
      chapter5Url: 'https://example/chapter5.xlsx',
      chapter6Url: 'https://example/chapter6.xlsx',
    });
    expect(parsed.chapter5_tables).toBe(1);
    expect(parsed.chapter5_rows).toBe(10);
    expect(parsed.chapter6_agency_rows).toBe(10);
    expect(parsed.reconciled_years).toBe(5);
    expect(parsed.records).toHaveLength(20);
    expect(parsed.records.every((record) => isAdditiveMeasure(record) === false)).toBe(true);
    expect(parsed.records.every((record) => record.function_code === undefined)).toBe(true);
    expect(parsed.records.every((record) => record.jurisdiction_level === 'state')).toBe(true);
    expect(parsed.records.every((record) => record.jurisdiction === 'WA')).toBe(true);
    expect(parsed.records.every((record) => record.location?.state === 'WA')).toBe(true);
  });

  it('stores the printed negative sign as a magnitude with wa_printed_sign', async () => {
    const { chapter5, chapter6 } = await fixtures();
    const parsed = await parseWaWorkbooksAsync(chapter5, chapter6);
    const negative = parsed.records.find(
      (record) =>
        record.description === 'Wages Policy' &&
        record.fiscal_year === '2015-16' &&
        record.wa_budget_measure === 'major_spending_change',
    );
    expect(negative?.amount_cents).toBe(4_060_000_000);
    expect(negative?.wa_printed_sign).toBe('negative');
    expect(negative?.aggregation_role).toBe('policy_measure');
    expect(negative?.data_quality_flag).toBe('provisional');
  });

  it('keeps Chapter 6 asset-investment rows agency_detail and reconciled', async () => {
    const { chapter5, chapter6 } = await fixtures();
    const parsed = await parseWaWorkbooksAsync(chapter5, chapter6);
    const asset = parsed.records.find(
      (record) =>
        record.wa_budget_measure === 'asset_investment' &&
        record.description?.includes('Main Roads'),
    );
    expect(asset?.aggregation_role).toBe('agency_detail');
    expect(asset?.extraction_confidence).toBe('high');
    expect(asset?.wa_budget_table).toBe('Chapter 6 Table 1');
  });

  it('fails ingestion when the printed unit is not $m', async () => {
    const chapter5 = await makeWorkbook([{ name: 'Table 6', rows: chapter5Rows("$'000") }]);
    const chapter6 = await makeWorkbook([{ name: 'Table 1', rows: chapter6Rows() }]);
    await expect(parseWaWorkbooksAsync(chapter5, chapter6)).rejects.toThrow(/unit guard failed/);
  });

  it('fails ingestion when the printed Total does not reconcile', async () => {
    const chapter5 = await makeWorkbook([{ name: 'Table 6', rows: chapter5Rows() }]);
    const chapter6 = await makeWorkbook([{ name: 'Table 1', rows: chapter6Rows(1460) }]);
    await expect(parseWaWorkbooksAsync(chapter5, chapter6)).rejects.toThrow(
      /total reconciliation failed/,
    );
  });

  it('is idempotent on natural_key and skips nil-only measure rows', async () => {
    const { chapter5, chapter6 } = await fixtures();
    const first = await parseWaWorkbooksAsync(chapter5, chapter6);
    const second = await parseWaWorkbooksAsync(chapter5, chapter6);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
    expect(first.records.some((record) => record.description?.includes('Nil measure'))).toBe(false);
  });
});

describe('WA ingestion is idempotent and never deletes', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('runs twice without duplication and preserves an unrelated source', async () => {
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

    const { chapter5, chapter6 } = await fixtures();
    const connector = createWaBudgetConnector({ chapter5, chapter6 });
    await runIngestion({ connectors: [connector] });
    await runIngestion({ connectors: [connector] });

    expect(await MeasureModel.countDocuments({ source_id: WA_ID })).toBe(20);
    expect(await MeasureModel.countDocuments({ source_id: 'unrelated-source' })).toBe(1);
    const source = await DataSourceModel.findOne({ source_id: WA_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(20);
    expect(source?.fetch_strategy).toBe('direct');
  });
});
