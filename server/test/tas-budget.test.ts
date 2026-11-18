import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction } from '../src/connectors/pdf-extract.js';
import {
  TAS_COLUMNS,
  TAS_ID,
  TAS_TABLE,
  TAS_UNIT,
  TAS_UNIT_TO_CENTS,
  createTasBudgetConnector,
  discoverTasBp1,
  parseTasBp1,
  parseTasCofogTable,
  tasMoneyToCents,
  tasNaturalKey,
} from '../src/connectors/tas-budget.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_tas`;

const HEADER_ROWS: string[][] = [
  ['', '', '', 'Estimated', '', '', '', 'Forward', '', 'Forward', '', 'Forward', ''],
  ['', 'Budget', '', 'Outcome', '', 'Budget', '', 'Estimate', '', 'Estimate', '', 'Estimate', ''],
  ['', '', '$m', '', '$m', '', '$m', '', '$m', '', '$m', '', '$m', ''],
];

const DATA_ROWS: string[][] = [
  [
    'General public services',
    '657.4',
    '',
    '644.6',
    '',
    '832.6',
    '',
    '803.1',
    '',
    '851.3',
    '',
    '912.4',
    '',
  ],
  [
    'Public order and safety',
    '983.0',
    '',
    '1006.3',
    '',
    '1002.3',
    '',
    '966.6',
    '',
    '942.5',
    '',
    '950.7',
    '',
  ],
  [
    'Economic affairs',
    '529.3',
    '',
    '509.6',
    '',
    '393.9',
    '',
    '264.3',
    '',
    '267.3',
    '',
    '604.5',
    '',
  ],
  [
    'Environmental protection',
    '265.9',
    '',
    '287.2',
    '',
    '262.1',
    '',
    '247.8',
    '',
    '242.5',
    '',
    '246.9',
    '',
  ],
  [
    'Housing and community amenities',
    '238.2',
    '',
    '237.4',
    '',
    '187.0',
    '',
    '136.9',
    '',
    '133.7',
    '',
    '135.8',
    '',
  ],
  ['Health', '3570.6', '', '3644.7', '', '3671.2', '', '3683.3', '', '3799.8', '', '3896.6', ''],
  [
    'Recreation, culture and religion',
    '288.8',
    '',
    '255.7',
    '',
    '349.3',
    '',
    '286.0',
    '',
    '231.0',
    '',
    '215.6',
    '',
  ],
  ['Education', '2419.1', '', '2436.1', '', '2439.5', '', '2457.9', '', '2499.4', '', '2519.0', ''],
  [
    'Social protection',
    '740.5',
    '',
    '788.2',
    '',
    '794.9',
    '',
    '764.7',
    '',
    '736.1',
    '',
    '758.8',
    '',
  ],
  ['Transport', '503.8', '', '521.4', '', '540.8', '', '471.1', '', '451.2', '', '433.5', ''],
  [
    'Nominal interest on superannuation',
    '309.6',
    '',
    '307.4',
    '',
    '314.6',
    '',
    '312.5',
    '',
    '309.9',
    '',
    '306.9',
    '',
  ],
];

const PAGE_TEXT = [
  'Chapter 9 - Uniform Government Reporting Table 9.16: General Government Expenses from Transactions by Purpose',
  'General public services 657.4 644.6 832.6 803.1 851.3 912.4',
  'Public order and safety 983.0 1 006.3 1 002.3 966.6 942.5 950.7',
  'Economic affairs 529.3 509.6 393.9 264.3 267.3 604.5',
  'Environmental protection 265.9 287.2 262.1 247.8 242.5 246.9',
  'Housing and community amenities 238.2 237.4 187.0 136.9 133.7 135.8',
  'Health 3 570.6 3 644.7 3 671.2 3 683.3 3 799.8 3 896.6',
  'Recreation, culture and religion 288.8 255.7 349.3 286.0 231.0 215.6',
  'Education 2 419.1 2 436.1 2 439.5 2 457.9 2 499.4 2 519.0',
  'Social protection 740.5 788.2 794.9 764.7 736.1 758.8',
  'Transport 503.8 521.4 540.8 471.1 451.2 433.5',
  'Nominal interest on superannuation 309.6 307.4 314.6 312.5 309.9 306.9',
  '10 506.2 10 638.5 10 788.1 10 394.1 10 464.8 10 980.7',
].join(' ');

function tableRows(header = HEADER_ROWS, data = DATA_ROWS): string[][] {
  return [...header, ...data];
}

function extractionFixture(rows = tableRows()): PdfExtraction {
  return {
    source: { url: 'https://example/tas-bp1.pdf', sha256: '0'.repeat(64), bytes: 1 },
    pages: [
      {
        page_number: 255,
        text: PAGE_TEXT,
        items: [],
      },
    ],
    text: PAGE_TEXT,
    tables: [
      {
        page_number: 255,
        table_index: 0,
        header: [],
        unit: {
          kind: 'millions',
          multiplier_to_cents: TAS_UNIT_TO_CENTS,
          ambiguous: false,
          raw_matches: ['$m'],
          reason: 'fixture',
        },
        columns: [],
        rows: rows.map((cells, index) => ({
          row_index: index,
          label: cells[0] ?? '',
          cells,
          values: [],
          amounts_cents: [],
          is_total: false,
          data_quality_flag: 'provisional',
          extraction_confidence: 'high',
        })),
        checks: [],
        totals_verified: false,
        extraction_confidence: 'high',
        valid: true,
        ingestable: true,
        warnings: [],
        errors: [],
      },
    ],
    warnings: [],
  };
}

describe('TAS Table 9.16 COFOG parsing', () => {
  it('parses 11 categories × 6 columns and reconciles every year', () => {
    const parsed = parseTasCofogTable(tableRows(), PAGE_TEXT);
    expect(parsed.categories).toBe(11);
    expect(parsed.reconciled_years).toBe(6);
    expect(parsed.records).toHaveLength(66);
    expect(parsed.total_millions).toEqual([10506.2, 10638.5, 10788.1, 10394.1, 10464.8, 10980.7]);
    expect(parsed.records.every((record) => isAdditiveMeasure(record) === false)).toBe(true);
    expect(parsed.records.every((record) => record.aggregation_role === 'benchmark')).toBe(true);
    expect(parsed.records.every((record) => record.jurisdiction_level === 'state')).toBe(true);
    expect(parsed.records.every((record) => record.jurisdiction === 'TAS')).toBe(true);
    expect(parsed.records.every((record) => record.location?.state === 'TAS')).toBe(true);
    expect(parsed.records.every((record) => record.tas_budget_table === TAS_TABLE)).toBe(true);
    expect(parsed.records.every((record) => record.tas_budget_unit === TAS_UNIT)).toBe(true);
  });

  it('maps printed labels to COFOG-A codes without inventing any', () => {
    const parsed = parseTasCofogTable(tableRows(), PAGE_TEXT);
    const find = (category: string) =>
      parsed.records.find((record) => record.project_name === category);
    expect(find('General public services')?.function_code).toBe('01');
    expect(find('Health')?.function_code).toBe('07');
    expect(find('Transport')?.function_code).toBe('045');
    expect(find('Nominal interest on superannuation')?.function_code).toBeUndefined();
  });

  it('uses the printed measure type/fiscal year for each column', () => {
    const parsed = parseTasCofogTable(tableRows(), PAGE_TEXT);
    const health = parsed.records.filter((record) => record.project_name === 'Health');
    expect(health).toHaveLength(6);
    expect(health.map((record) => `${record.fiscal_year}:${record.measure_type}`)).toEqual([
      '2025-26:estimate',
      '2025-26:budget',
      '2026-27:budget',
      '2027-28:estimate',
      '2028-29:estimate',
      '2029-30:estimate',
    ]);
    expect(health[0]?.tas_budget_column).toBe('2025-26 Estimated Outcome');
    expect(health[0]?.amount_cents).toBe(357_060_000_000);
  });

  it('fails the unit guard when the six $m headers are not printed', () => {
    const badHeader = HEADER_ROWS.map((row) => row.map((cell) => (cell === '$m' ? "$'000" : cell)));
    expect(() => parseTasCofogTable(tableRows(badHeader), PAGE_TEXT)).toThrow(/unit guard failed/);
  });

  it('fails total reconciliation when the printed total is wrong', () => {
    const badText = PAGE_TEXT.replace('10 980.7', '11 980.7');
    expect(() => parseTasCofogTable(tableRows(), badText)).toThrow(/total reconciliation failed/);
  });

  it('is idempotent on natural_key', () => {
    const first = parseTasCofogTable(tableRows(), PAGE_TEXT);
    const second = parseTasCofogTable(tableRows(), PAGE_TEXT);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
    const key = tasNaturalKey({
      category: 'Health',
      fiscal_year: '2026-27',
      measure_type: 'budget',
      column: '2026-27 Budget',
    });
    expect(key.startsWith(`${TAS_ID}:`)).toBe(true);
    expect(key).toBe(
      tasNaturalKey({
        category: 'Health',
        fiscal_year: '2026-27',
        measure_type: 'budget',
        column: '2026-27 Budget',
      }),
    );
  });

  it('converts $m to integer cents', () => {
    expect(tasMoneyToCents(1)).toBe(100_000_000);
    expect(tasMoneyToCents(3570.6)).toBe(357_060_000_000);
    expect(TAS_COLUMNS).toHaveLength(6);
  });

  it('parses the same table from a full PDF extraction', () => {
    const parsed = parseTasBp1(extractionFixture());
    expect(parsed.records).toHaveLength(66);
    expect(parsed.reconciled_years).toBe(6);
  });
});

describe('TAS BP1 discovery', () => {
  it('resolves the BP1 PDF link from the official budget page', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      text: async () =>
        '<a href="/Documents/2026-27%20Budget%20Paper%20No.%201%2c%20Budget%20Strategy%20and%20Estimates.PDF">BP1</a>',
    })) as unknown as typeof fetch;
    expect(await discoverTasBp1(fetchImpl)).toContain('Budget%20Paper%20No.%201');
  });

  it('falls back to the known BP1 PDF when the page has no link', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      text: async () => '<a href="/other.pdf">other</a>',
    })) as unknown as typeof fetch;
    expect(await discoverTasBp1(fetchImpl)).toContain('Budget%20Paper%20No.%201');
  });
});

describe('TAS ingestion is idempotent and never deletes', () => {
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

    const connector = createTasBudgetConnector({ pdfExtraction: extractionFixture() });
    await runIngestion({ connectors: [connector] });
    await runIngestion({ connectors: [connector] });

    expect(await MeasureModel.countDocuments({ source_id: TAS_ID })).toBe(66);
    expect(await MeasureModel.countDocuments({ source_id: 'unrelated-source' })).toBe(1);
    const source = await DataSourceModel.findOne({ source_id: TAS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(66);
    expect(source?.fetch_strategy).toBe('direct');
  });
});
