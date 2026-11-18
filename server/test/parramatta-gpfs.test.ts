import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  PARRAMATTA_GPFS_FISCAL_YEAR,
  PARRAMATTA_GPFS_ID,
  PARRAMATTA_GPFS_LICENSE,
  PARRAMATTA_GPFS_NAME,
  PARRAMATTA_GPFS_PUBLISHER,
  PARRAMATTA_GPFS_REPORTING_URL,
  detectParramattaGpfsUnit,
  fiscalYearFromParramattaGpfsLink,
  parseParramattaGpfsExtraction,
  parseParramattaGpfsReportLinks,
  parseParramattaGpfsYearPageLinks,
  parramattaGpfsNaturalKey,
  selectParramattaGpfsDocument,
  selectParramattaGpfsYearPage,
  type ParramattaGpfsParseContext,
} from '../src/connectors/parramatta-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 4, 5 and
// 14; PDF pages 4, 5 and 14). The income statement prints the Original
// unaudited budget column *before* the label, so a parser that took the first
// number in the line would read the budget; the expected values are all Actual
// 2025.
const INCOME_TEXT = `City of Parramatta Council | Income Statement | for the year ended 30 June 2025 §Statement§  Original unaudited budget   Actual  Restated Actual  2025   $ '000   Notes   2025   2024   1  Income from continuing operations  229,252   Rates and annual charges   B2-1   231,565   221,620 49,973   User charges and fees   B2-2   46,819   41,788 18,880   Other revenues   B2-3   18,382   12,358 23,721   Grants and contributions provided for operating purposes   B2-4   17,849   16,057 75,732   Grants and contributions provided for capital purposes   B2-4   69,198   57,452 23,690   Interest and investment income   B2-5   28,486   30,898 600   Other income   B2-6   26,905   91,653  421,848   Total income from continuing operations   439,204   471,826  Expenses from continuing operations  145,934   Employee benefits and on-costs   B3-1   164,786   159,530 72,736   Materials and services   B3-2   135,446   129,925 98   Borrowing costs   B3-3   47   135 55,225   Other expenses   B3-5   5,907   6,488 (211)   Net loss from the disposal of assets   B4-1   7,307   25,659  273,782  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   313,493   321,737 148,066  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   125,711   150,089  66,500 Depreciation, amortisation and impairment of non-financial assets   B3-4   70,059   61,531  81,566   Net operating result for the year attributable to Council   55,652   88,558  5,834  Net operating result for the year before grants and contributions provided for capital purposes   (13,546)   31,106  (1)   The Council has restated some comparative amounts to correct certain errors from prior years which were identified this year. Details of the restatements are set out in Note F4-1. The above Income Statement should be read in conjunction with the accompanying notes.  City of Parramatta Council Income Statement  for the year ended 30 June 2025 Page 4 of 85`;

const COMPREHENSIVE_TEXT = `City of Parramatta Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§  Restated  $ '000   Notes   2025   2024   1  Net operating result for the year – from Income Statement   55,652   88,558  §Subnote§  Other comprehensive income:  Amounts that will not be reclassified subsequently to the operating result Gain on revaluation of Infrastructure, Property, Plant, and Equipment (IPPE)   C1-5   89,928   88,298 Re-measurement of remediation liability for asbestos contamination   C3-5   (15,102)   2,551  Total items which will not be reclassified subsequently to the operating result   74,826   90,849  Total other comprehensive income for the year   74,826   90,849  Total comprehensive income for the year attributable to Council   130,478   179,407  (1)   The Council has restated some comparative amounts to correct certain errors from prior years which were identified this year. Details of the restatements are set out in Note F4-1. The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  City of Parramatta Council Statement of Comprehensive Income  for the year ended 30 June 2025 Page 5 of 85`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses Net Operating result from continuing operations   Grants and contributions   Carrying amount of assets 2025   2024   2025   2024   2025   2024   2025   2024   2025   2024  $ '000   Restated   Restated   Restated  Functions or activities  Corporate and Property Services   223,884   302,297   91,340   97,998   132,544   204,299   8,175   9,550   2,311,123   2,199,885 People Culture and Workplace   130   136   7,606   8,969   (7,476)   (8,833)   –   –   –   – City Engagement and Experience   1,057   498   23,916   21,261   (22,859)   (20,763)   284   260   –   – Office of Lord Mayor and CEO   1   25   6,217   3,478   (6,216)   (3,453)   –   25   –   – City Assets and Operations   135,079   91,859   171,924   167,311   (36,845)   (75,452)   51,721   22,116   2,250,476   2,187,286 Community and Culture   25,407   23,291   54,435   53,806   (29,028)   (30,515)   3,089   2,614   5,438   10,788 City Planning and Design   53,646   53,720   28,114   30,445   25,532   23,275   23,778   38,944   –   –  Total functions and activities   439,204   471,826   383,552   383,268   55,652   88,558   87,047   73,509   4,567,037   4,397,959  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 14 of 85 City of Parramatta Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'd'.repeat(64), bytes: 4_098_410 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: ParramattaGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'City of Parramatta Annual Financial Statements 2024-2025.pdf',
    url: 'https://www.cityofparramatta.nsw.gov.au/files/assets/public/v/3/council/financial-statements/city-of-parramatta-annual-financial-statements-2024-2025.pdf',
    fiscal_year: PARRAMATTA_GPFS_FISCAL_YEAR,
    listing_url:
      'https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements/2024-2025-annual-financial-statements',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/parramatta-gpfs/city-of-parramatta-annual-financial-statements-2024-2025.pdf',
    sha256: '9dad166100cdf224a2c34d210b12673450b8b134fe2a7e257dec350e65c1be59',
    bytes: 4_098_410,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: PARRAMATTA_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseParramattaGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Parramatta GPFS source discovery', () => {
  it('discovers the dedicated FY2024-25 page then the PDF, never a hard-coded PDF URL', () => {
    const indexHtml = `
      <a href="https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements/2024-2025-annual-financial-statements">2024-2025 Annual Financial Statements</a>
      <a href="https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements/2023-2024-annual-financial-statements">2023-2024 Annual Financial Statements</a>
      <a href="https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements/past-annual-financial-statements">Past Annual Financial Statements</a>
    `;
    const pages = parseParramattaGpfsYearPageLinks(indexHtml);
    expect(pages.map((page) => page.fiscal_year)).toEqual(['2024-25', '2023-24']);
    const yearPage = selectParramattaGpfsYearPage(pages, '2024-25');
    expect(yearPage.url).toBe(
      'https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements/2024-2025-annual-financial-statements',
    );

    const yearHtml = `
      <a title="City of Parramatta Annual Financial Statements 2024-2025.pdf" href="/files/assets/public/v/3/council/financial-statements/city-of-parramatta-annual-financial-statements-2024-2025.pdf">Download the 2024-2025 Annual Financial Statements<span>(PDF,&nbsp;4MB)</span></a>
      <a title="City of Parramatta Annual Report 2024-2025.pdf" href="/files/annual-reports/2024-2025-annual-report.pdf">2024-2025 Annual Report</a>
    `;
    const links = parseParramattaGpfsReportLinks(yearHtml, yearPage.url);
    expect(links).toHaveLength(1);
    expect(links.some((link) => /annual report/i.test(link.title))).toBe(false);
    const selected = selectParramattaGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(CONTEXT.document.url);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(fiscalYearFromParramattaGpfsLink('2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromParramattaGpfsLink('2024/25 financial statements')).toBe('2024-25');
    expect(fiscalYearFromParramattaGpfsLink('2024-2025')).toBe('2024-25');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const pages = parseParramattaGpfsYearPageLinks(
      '<a href="/council/2023-2024-annual-financial-statements">2023-2024 Annual Financial Statements</a>',
    );
    expect(() => selectParramattaGpfsYearPage(pages, '2024-25')).toThrow(/No published/);
    const links = parseParramattaGpfsReportLinks(
      '<a title="2023-2024 Financial Statements.pdf" href="/x/2023.pdf">2023-2024 Financial Statements</a>',
      'https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements',
    );
    expect(() => selectParramattaGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Parramatta GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectParramattaGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectParramattaGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseParramattaGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Parramatta GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the printed totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(439_204);
    expect(reconciliation.total_expenses).toBe(383_552);
    expect(reconciliation.employee_expenses).toBe(164_786);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(70_059);
    expect(reconciliation.government_grants_operating).toBe(17_849);
    expect(reconciliation.government_grants_capital).toBe(69_198);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(7_307);
    expect(reconciliation.net_result).toBe(55_652);
    expect(reconciliation.net_result_before_capital_grants).toBe(-13_546);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(313_493);
    expect(reconciliation.face_expense_bridge).toBe(383_552);
    expect(reconciliation.functions_total_income).toBe(439_204);
    expect(reconciliation.functions_total_expenses).toBe(383_552);
    expect(reconciliation.functions_operating_result).toBe(55_652);
    expect(reconciliation.functions_grants_and_contributions).toBe(87_047);
    expect(reconciliation.comprehensive_income_net_result).toBe(55_652);
    expect(reconciliation.revenue_components_sum).toBe(439_204);
    expect(reconciliation.expense_components_sum).toBe(313_493);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(43_920_400_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(38_355_200_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(16_478_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      7_005_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_784_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(6_919_800_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      730_700_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(5_565_200_000);
    // The negative printed before-capital result stays in the reconciliation
    // evidence but is not emitted: money is stored as non-negative cents only.
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: PARRAMATTA_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'City of Parramatta',
        source_dataset: 'City of Parramatta GPFS 2024-25',
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
      expect(record.natural_key).toMatch(/^parramatta-gpfs:/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
  });

  it('does not sum components with their printed totals', () => {
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

    const expensesExDepreciation = recordByLine(records, 'total_expenses_excluding_depreciation');
    const natureComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses_excluding_depreciation',
    );
    expect(natureComponents).toHaveLength(5);
    expect(natureComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      expensesExDepreciation.amount_cents,
    );

    // Every output row is agency detail, so neither the API nor an area panel can
    // add it to any other council or state row.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace(
      '439,204   471,826   383,552   383,268',
      '439,204   471,826   383,553   383,268',
    );
    const parsed = parseParramattaGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement   55,652',
      'from Income Statement   55,653',
    );
    const parsed = parseParramattaGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = parramattaGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = parramattaGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^parramatta-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(parramattaGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(parramattaGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_parramattagpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: PARRAMATTA_GPFS_ID,
    name: PARRAMATTA_GPFS_NAME,
    publisher: PARRAMATTA_GPFS_PUBLISHER,
    source_url: PARRAMATTA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: PARRAMATTA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'parramatta-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Parramatta GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: PARRAMATTA_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        // The existing AusTender contract whose delivery_entity happens to be
        // "City of Parramatta". It must never be summed with the GPFS rows.
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-parramatta',
        project_name: 'Existing AusTender Parramatta contract',
        delivery_entity: 'City of Parramatta',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-parramatta',
        project_name: 'Existing GrantConnect Parramatta grant',
        delivery_entity: 'City of Parramatta',
      },
      {
        amount_cents: 123_456,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'blacktown-gpfs',
        source_url: 'https://www.blacktown.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-blacktown-gpfs-1',
        project_name: 'Existing Blacktown GPFS row',
        delivery_entity: 'Blacktown City Council',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing rows and never double counts on re-run', async () => {
    const { records } = parsedFixture();
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'blacktown-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: PARRAMATTA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    const existing = await MeasureModel.find({ source_id: { $in: ['aus-tender', 'grantconnect'] } })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.natural_key)).toEqual([
      'grantconnect:GA-existing-parramatta',
      'prod-existing-aus-tender-parramatta',
    ]);
    expect(existing.map((row) => row.amount_cents)).toEqual([502_773_441, 12_345_000]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: PARRAMATTA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: PARRAMATTA_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: PARRAMATTA_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: PARRAMATTA_GPFS_ID,
        delivery_entity: { $ne: 'City of Parramatta' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: PARRAMATTA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
