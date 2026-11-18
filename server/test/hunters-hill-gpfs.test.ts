import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  HUNTERS_HILL_GPFS_ID,
  createHuntersHillGpfsConnector,
  parseHuntersHillGpfsExtraction,
  type HuntersHillParseContext,
} from '../src/connectors/hunters-hill-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_huntershill`;

const INCOME_TEXT = `The Council of the Municipality of Hunter's Hill | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 15,837 Rates and annual charges 1 B2-1 15,605 14,722 1,439 User charges and fees 2 B2-2 1,793 1,604 1,222 Other revenues 1, 2 B2-3 1,053 1,387 1,030 Grants and contributions provided for operating purposes B2-4 848 1,418 1,989 Grants and contributions provided for capital purposes B2-4 1,575 7,878 891 Interest and investment income 920 1,110 2,550 Other income 280 151 24,958 Total income from continuing operations 22,074 28,270 Expenses from continuing operations 7,520 Employee benefits and on-costs B3-1 6,907 6,409 9,794 Materials and services 1, 3 B3-2 10,851 10,250 1,345 Other expenses 1, 3 857 808 297 Net loss from the disposal of assets 517 501 18,956 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 19,132 17,968 6,002 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 2,942 10,302 4,063 Depreciation, amortisation and impairment of non-financial assets B3-3 4,498 3,867 1,939 Net operating result for the year attributable to Council (1,556) 6,435 (50) Net operating result for the year before grants and contributions provided for capital purposes (3,131) (1,443) (1) Prior year adjusted for Rates on Council properties. The above Income Statement should be read in conjunction with the accompanying notes.`;

const COMPREHENSIVE_TEXT = `The Council of the Municipality of Hunter's Hill | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement (1,556) 6,435 §Subnote§ Other comprehensive income: Gain on revaluation of infrastructure, property, plant and equipment C1-5 6,967 35,523 Total other comprehensive income for the year 6,967 35,523`;

const FUNCTIONS_TEXT = `Income, expenses and assets have been directly attributed to the following functions or activities. $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Governance, participation & partnerships 13,539 13,052 6,159 5,601 7,380 7,451 335 395 1,923 5,442 Connected & inclusive infrastructure 1,637 2,286 5,881 6,676 (4,244) (4,390) 707 973 110,268 131,424 Environment, sustainability & open space 3,974 3,162 3,660 3,030 314 132 124 42 300 9,157 Community & belonging 213 200 1,038 1,024 (825) (824) 107 112 671 107 Character, heritage & places 2,711 9,570 6,892 5,504 (4,181) 4,066 1,150 7,774 217,680 178,146 Total functions and activities 22,074 28,270 23,630 21,835 (1,556) 6,435 2,423 9,296 330,842 324,276 B Financial Performance B1 Functions or activities`;

function page(text: string, number: number): PdfPage {
  return { page_number: number, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'e'.repeat(64), bytes: 2_533_407 },
    pages: [
      page(overrides.income ?? INCOME_TEXT, 4),
      page(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 5),
      page(overrides.functions ?? FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: HuntersHillParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Hunters Hill Council Annual Financial Statements 2024-2025',
    url: 'https://www.huntershill.nsw.gov.au/files/assets/public/v/1/council/reports-and-publications/annual-reports-and-financial-statements/financial-statements/annual-financial-statement-2024-2025.pdf',
    fiscal_year: '2024-25',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/hunters-hill-gpfs/hunters-hill-annual-financial-statements-2024-2025.pdf',
    sha256: 'e'.repeat(64),
    bytes: 2_533_407,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url:
    'https://www.huntershill.nsw.gov.au/Council/Policies-and-Publications/Annual-Reports-and-Financial-Statements',
};

function parsedFixture() {
  const parsed = parseHuntersHillGpfsExtraction(extraction(), CONTEXT);
  return parsed;
}

function record(records: SpendingRecord[], line: string): SpendingRecord {
  const found = records.find((entry) => entry.gpfs_line_item === line);
  if (!found) throw new Error(`missing ${line}`);
  return found;
}

describe('Hunters Hill GPFS parsing', () => {
  it('extracts printed totals and B1-1 function expenses', () => {
    const parsed = parsedFixture();
    expect(parsed.reconciliation).not.toBeNull();
    expect(parsed.records).toHaveLength(21);
    expect(record(parsed.records, 'total_revenue').amount_cents).toBe(2_207_400_000);
    expect(record(parsed.records, 'total_expenses').amount_cents).toBe(2_363_000_000);
    expect(record(parsed.records, 'employee_expenses').amount_cents).toBe(690_700_000);
    expect(record(parsed.records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      449_800_000,
    );
    expect(record(parsed.records, 'government_grants_operating').amount_cents).toBe(84_800_000);
    expect(record(parsed.records, 'government_grants_capital').amount_cents).toBe(157_500_000);
    expect(record(parsed.records, 'net_result').amount_cents).toBe(155_600_000);
    expect(record(parsed.records, 'net_result').gpfs_printed_sign).toBe('negative');
    expect(
      record(parsed.records, 'function_governance_participation_partnerships').amount_cents,
    ).toBe(615_900_000);
    expect(record(parsed.records, 'function_character_heritage_places').amount_cents).toBe(
      689_200_000,
    );
    expect(parsed.reconciliation?.function_expenses_sum).toBe(2_363_000_000);
  });

  it('maps all rows to the Hunters Hill council-only provenance', () => {
    const { records } = parsedFixture();
    for (const row of records) {
      expect(row.source_id).toBe(HUNTERS_HILL_GPFS_ID);
      expect(row.measure_type).toBe('actual');
      expect(row.fiscal_year).toBe('2024-25');
      expect(row.jurisdiction_level).toBe('local');
      expect(row.jurisdiction).toBe('NSW');
      expect(row.delivery_entity).toBe('Hunters Hill Council');
      expect(row.data_quality_flag).toBe('provisional/local_government');
      expect(row.aggregation_role).toBe('agency_detail');
      expect(row.verified).toBe(false);
      expect(row.natural_key).toMatch(/^hunters-hill-gpfs:[a-f0-9]{40}$/);
    }
    expect(record(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(record(records, 'total_revenue').potential_double_count).toBeUndefined();
  });

  it('rejects an ambiguous/missing unit and a non-reconciling total', () => {
    const ambiguous = parseHuntersHillGpfsExtraction(
      extraction({
        income: INCOME_TEXT.replace(/\$ '000/g, 'amount'),
        functions: FUNCTIONS_TEXT.replace(/\$ '000/g, 'amount'),
      }),
      CONTEXT,
    );
    expect(ambiguous.records).toEqual([]);
    const badTotal = parseHuntersHillGpfsExtraction(
      extraction({ functions: FUNCTIONS_TEXT.replace('23,630', '23,000') }),
      CONTEXT,
    );
    expect(badTotal.records).toEqual([]);
    expect(badTotal.rejections.length).toBeGreaterThan(0);
  });

  it('uses stable natural keys and is idempotent', () => {
    const first = parsedFixture().records;
    const second = parsedFixture().records;
    expect(second.map((row) => row.natural_key)).toEqual(first.map((row) => row.natural_key));
    expect(new Set(first.map((row) => row.natural_key)).size).toBe(first.length);
    const total = record(first, 'total_expenses');
    const functions = first.filter((row) => row.gpfs_line_item?.startsWith('function_'));
    expect(total.amount_cents).toBe(functions.reduce((sum, row) => sum + row.amount_cents, 0));
  });
});

describe('Hunters Hill GPFS DB ingestion', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('runs twice without duplicating and preserves an unrelated source', async () => {
    const other: SpendingRecord = {
      amount_cents: 1_000,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: 'unrelated-source',
      source_url: 'https://example.gov.au/unrelated',
      verified: true,
      natural_key: 'unrelated-source:hunters-hill',
      description: 'Unrelated fixture',
    };
    await MeasureModel.create(other);
    const connector = createHuntersHillGpfsConnector({
      extraction: extraction(),
      document: CONTEXT.document,
      archive: CONTEXT.archive,
    });
    await runIngestion({ connectors: [connector] });
    const count = await MeasureModel.countDocuments({ source_id: HUNTERS_HILL_GPFS_ID });
    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: HUNTERS_HILL_GPFS_ID })).toBe(count);
    expect(count).toBe(21);
    expect(await MeasureModel.countDocuments({ source_id: 'unrelated-source' })).toBe(1);
    const source = await DataSourceModel.findOne({ source_id: HUNTERS_HILL_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(21);
  });
});
