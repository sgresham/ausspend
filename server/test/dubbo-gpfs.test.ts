import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  DUBBO_GPFS_FISCAL_YEAR,
  DUBBO_GPFS_ID,
  DUBBO_GPFS_LICENSE,
  DUBBO_GPFS_NAME,
  DUBBO_GPFS_OLG_EXPENSES_CENTS,
  DUBBO_GPFS_OLG_REVENUE_CENTS,
  DUBBO_GPFS_PUBLISHER,
  DUBBO_GPFS_REPORTING_URL,
  detectDubboGpfsUnit,
  dubboGpfsNaturalKey,
  fiscalYearFromGpfsLink,
  parseDubboGpfsExtraction,
  parseDubboGpfsReportLinks,
  selectDubboGpfsDocument,
  type DubboGpfsParseContext,
} from '../src/connectors/dubbo-council-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

const INCOME_TEXT = [
  'Dubbo Regional Council | Income Statement | for the year ended 30 June 2025',
  "$ '000 Original unaudited budget Actual Actual 2025 2024",
  'Income from continuing operations',
  '78,511 Rates and annual charges B2-1 80,278 74,641',
  '46,195 User charges and fees B2-2 55,081 54,418',
  '2,998 Other revenues B2-3 5,223 3,505',
  '20,325 Grants and contributions provided for operating purposes B2-4 20,061 32,079',
  '19,555 Grants and contributions provided for capital purposes B2-4 59,726 33,122',
  '8,836 Interest and investment income B2-5 14,365 12,971',
  'Other income B2-6 193 160',
  '176,420 Total income from continuing operations 234,927 210,896',
  'Expenses from continuing operations',
  '53,659 Employee benefits and on-costs B3-1 49,204 49,340',
  '54,604 Materials and services B3-2 59,076 63,102',
  '2,134 Borrowing costs B3-3 871 3,037',
  '2,931 Other expenses B3-5 2,880 2,824',
  '(2,694) Net loss from the disposal of assets B4-1 5,035 4,489',
  '110,634 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 117,066 122,792',
  '65,786 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 117,861 88,104',
  '66,010 Depreciation, amortisation and impairment of non-financial assets B3-4 57,859 58,525',
  '(224) Operating result from continuing operations 60,002 29,579',
  '(224) Net operating result for the year attributable to Council 60,002 29,579',
  '(19,779) Net operating result for the year before grants and contributions provided for capital purposes 276 (3,543)',
].join(' ');

const FUNCTIONS_TEXT = [
  'Dubbo Regional Council | Notes to the Financial Statements 30 June 2025',
  'B Financial Performance B1 Functions or activities',
  'B1-1 Functions or activities – income, expenses and assets',
  "$ '000 Income Expenses Operating result Grants and contributions Carrying amount of assets",
  '2025 2024 2025 2024 2025 2024 2025 2024 2025 2024',
  'Functions or activities Governance – – 444 650 (444) (650) – – – –',
  'Administration 412 1,357 538 (7,294) (126) 8,651 10 – 233,117 197,697',
  'Total functions and activities 234,927 210,896 174,925 181,317 60,002 29,579 79,787 65,201 3,187,561 3,058,255',
].join(' ');

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(overrides: { income?: string; functions?: string } = {}): PdfExtraction {
  return {
    source: { sha256: 'a'.repeat(64), bytes: 1 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 5),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: DubboGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: '2024/2025 Dubbo Regional Council Financial Statements',
    url: 'https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/20242025%20-%20Annual%20Financial%20Statements%20-%20Final%20for%20website.PDF.aspx',
    fiscal_year: DUBBO_GPFS_FISCAL_YEAR,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2024-25.pdf',
    sha256: 'd9213cea468547a318548dfd72d7faa0d9fd2da81bcf6835138d10b58914a43f',
    bytes: 1_807_768,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: DUBBO_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseDubboGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Dubbo GPFS source discovery', () => {
  it('discovers the FY2024-25 statements from the reporting page, never a hard-coded PDF URL', () => {
    const html = `
      <a href="/ArticleDocuments/11102/2025-2026%20Annual%20Financial%20Statements%20-%20Dubbo%20Regional%20Council.pdf.aspx">2025/2026 Dubbo Regional Council Financial Statements<span>(PDF 2.8MB)</span></a>
      <a href="/ArticleDocuments/11102/20242025%20-%20Annual%20Financial%20Statements%20-%20Final%20for%20website.PDF.aspx">2024/2025 Dubbo Regional Council Financial Statements<span>(PDF 1.7MB)</span></a>
      <a href="/ArticleDocuments/11102/20242025%20Annual%20Report%20-%20final.pdf.aspx">2024/2025 Dubbo Regional Council Annual Report</a>
    `;
    const links = parseDubboGpfsReportLinks(html);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.some((link) => /annual report/i.test(link.title))).toBe(false);
    const selected = selectDubboGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(CONTEXT.document.url);
    expect(fiscalYearFromGpfsLink('2024/2025 Dubbo Regional Council Financial Statements')).toBe(
      '2024-25',
    );
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseDubboGpfsReportLinks(
      '<a href="/x.pdf">2023/2024 Dubbo Regional Council Financial Statements</a>',
    );
    expect(() => selectDubboGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Dubbo GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectDubboGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectDubboGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.replace("$ '000", '');
    const parsed = parseDubboGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Dubbo GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the OLG FY2024-25 totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(18);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(234_927);
    expect(reconciliation.total_expenses).toBe(174_925);
    expect(reconciliation.employee_expenses).toBe(49_204);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(57_859);
    expect(reconciliation.government_grants_operating).toBe(20_061);
    expect(reconciliation.government_grants_capital).toBe(59_726);
    expect(reconciliation.net_result).toBe(60_002);
    expect(reconciliation.net_result_before_capital_grants).toBe(276);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(117_066);
    expect(reconciliation.face_expense_bridge).toBe(174_925);
    expect(reconciliation.functions_total_income).toBe(234_927);
    expect(reconciliation.functions_total_expenses).toBe(174_925);
    expect(reconciliation.functions_operating_result).toBe(60_002);
    expect(reconciliation.functions_grants_and_contributions).toBe(79_787);
    expect(reconciliation.revenue_components_sum).toBe(234_927);
    expect(reconciliation.expense_components_sum).toBe(117_066);
    expect(reconciliation.olg_expenses_cents).toBe(DUBBO_GPFS_OLG_EXPENSES_CENTS);
    expect(reconciliation.olg_revenue_cents).toBe(DUBBO_GPFS_OLG_REVENUE_CENTS);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(23_492_700_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(17_492_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(4_920_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      5_785_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_006_100_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(5_972_600_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(6_000_200_000);
    expect(recordByLine(records, 'net_result_before_capital_grants').amount_cents).toBe(27_600_000);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: DUBBO_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'Dubbo Regional Council',
        source_dataset: 'Dubbo Regional Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^dubbo-council-gpfs:/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
  });

  it('does not sum GPFS components with their printed totals', () => {
    const { records } = parsedFixture();
    const totalRevenue = recordByLine(records, 'total_revenue');
    const revenueComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_revenue',
    );
    expect(revenueComponents).toHaveLength(7);
    expect(revenueComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalRevenue.amount_cents,
    );

    const totalExpenses = recordByLine(records, 'total_expenses');
    const expenseComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses',
    );
    expect(expenseComponents).toHaveLength(2);
    expect(expenseComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalExpenses.amount_cents,
    );
    // Every output row is agency detail, so neither the API nor the area panel
    // can add it to the 245 dubbo-council budget/estimate rows.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace(
      '174,925 181,317 60,002 29,579',
      '174,926 181,317 60,002 29,579',
    );
    const parsed = parseDubboGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('is deterministic: repeated parses produce the same natural keys and amounts', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
  });

  it('derives stable, line-specific natural keys', () => {
    const url = CONTEXT.document.url;
    const revenue = dubboGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = dubboGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^dubbo-council-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(dubboGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(dubboGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_dubbogpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: DUBBO_GPFS_ID,
    name: DUBBO_GPFS_NAME,
    publisher: DUBBO_GPFS_PUBLISHER,
    source_url: DUBBO_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: DUBBO_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'dubbo-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Dubbo GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    await MeasureModel.insertMany([
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2026-27',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-1',
        project_name: 'Existing budget row 1',
      },
      {
        amount_cents: 654_321,
        measure_type: 'estimate',
        fiscal_year: '2025-26',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-2',
        project_name: 'Existing budget row 2',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing dubbo-council rows and never double counts on re-run', async () => {
    const { records } = parsedFixture();
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council' })).toBe(2);
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    const existing = await MeasureModel.find({ source_id: 'dubbo-council' })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.natural_key)).toEqual([
      'existing-dubbo-1',
      'existing-dubbo-2',
    ]);
    expect(existing.map((row) => row.amount_cents)).toEqual([123_456, 654_321]);
    expect(existing.map((row) => row.project_name)).toEqual([
      'Existing budget row 1',
      'Existing budget row 2',
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council' })).toBe(2);
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: DUBBO_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: DUBBO_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: DUBBO_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
