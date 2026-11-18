import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BLACKTOWN_GPFS_FISCAL_YEAR,
  BLACKTOWN_GPFS_ID,
  BLACKTOWN_GPFS_LICENSE,
  BLACKTOWN_GPFS_NAME,
  BLACKTOWN_GPFS_PUBLISHER,
  BLACKTOWN_GPFS_REPORTING_URL,
  blacktownGpfsNaturalKey,
  detectBlacktownGpfsUnit,
  fiscalYearFromBlacktownGpfsLink,
  parseBlacktownGpfsExtraction,
  parseBlacktownGpfsReportLinks,
  selectBlacktownGpfsDocument,
  type BlacktownGpfsParseContext,
} from '../src/connectors/blacktown-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 6, 7 and
// 15; PDF pages 8, 9 and 17). The income statement prints the Original
// unaudited budget column *before* the label, so a parser that took the first
// number in the line would read the budget; the expected values are all Actual
// 2025.
const INCOME_TEXT = `Blacktown City Council and its subsidiary | Consolidated Income Statement | for the year ended 30 June 2025 §Statement§  Original unaudited budget   Actual   Actual  2025   2025   2024  $ '000   Notes   $ '000   $ '000  Income from continuing operations  314,235   Rates and annual charges   B2-1   312,869   289,381 49,735   User charges and fees   B2-2   51,413   49,745 18,131   Other revenues   B2-3   30,945   56,354 26,016   Grants and contributions provided for operating purposes   B2-4   28,952   34,848 160,942   Grants and contributions provided for capital purposes   B2-4   260,899   208,968 21,663   Interest and investment income   B2-5   47,102   44,388 11,833   Other income   B2-6   26,262   14,798 20,865   Net gain from the disposal of assets   B4-1   3,995   –  623,420   Total income from continuing operations   762,437   698,482  Expenses from continuing operations  217,531   Employee benefits and on-costs   B3-1   195,736   181,369 147,504   Materials and services   B3-2   187,276   184,571 1,064   Borrowing costs   B3-3   1,259   1,581 16,400   Other expenses   B3-5   16,794   15,629 –   Net loss from the disposal of assets   B4-1   –   4,184  382,499  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   401,065   387,334 240,921  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   361,372   311,148  110,873 Depreciation, amortisation and impairment of non-financial assets   B3-4   114,905   105,269  130,048   Operating result from continuing operations   246,467   205,879  130,048   Net operating result for the year attributable to Council   246,467   205,879  (30,894)  Net operating result for the year before grants and contributions provided for capital purposes   (14,432)   (3,089)  The above Income Statement should be read in conjunction with the accompanying notes.  Blacktown City Council and its subsidiary Consolidated Income Statement  for the year ended 30 June 2025 Page 6 of 98`;

const COMPREHENSIVE_TEXT = `Blacktown City Council and its subsidiary | Consolidated Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§  Actual   Actual  2025   2024  Notes   $ '000   $ '000  Net operating result for the year – from Income Statement   246,467   205,879  §Subnote§  Other comprehensive income:  Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment   C1-7   397,846   97,737  Total items which will not be reclassified subsequent to operating result   397,846   97,737  Total other comprehensive income for the year   397,846   97,737  Total comprehensive income for the year attributable to Council   644,313   303,616  The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  Blacktown City Council and its subsidiary Consolidated Statement of Comprehensive Income  for the year ended 30 June 2025 Page 7 of 98`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses   Operating result   Grants and contributions   Carrying amount of assets 2025   2024   2025   2024   2025   2024   2025   2024   2025   2024  $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000  Functions or activities  A vibrant and inclusive community   38,717   33,445   61,020   58,174   (22,303)   (24,729)   9,569   9,534   159,994   269,791 A clean, sustainable and healthy environment   95,384   93,128   167,347   135,904   (71,963)   (42,776)   2,280   5,073   726,010   633,203 A smart and prosperous economy   6,671   5,744   14,087   13,384   (7,416)   (7,640)   445   217   52,146   39,566 A growing city supported by accessible infrastructure   23,391   20,816   55,243   61,398   (31,852)   (40,582)   8,942   5,787   4,824,105   4,457,774 A sporting and active city   42,691   24,331   43,789   41,985   (1,098)   (17,654)   21,903   5,944   372,973   394,125 A leading city   555,583   521,018   174,484   181,758   381,099   339,260   246,712   217,261   2,785,127   2,539,070  Total functions and activities   762,437   698,482   515,970   492,603   246,467   205,879   289,851   243,816   8,920,355   8,333,529  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 15 of 98 Blacktown City Council and its subsidiary | Notes to the Financial Statements 30 June 2025`;

const SPECIAL_TEXT = `Blacktown City Council and its subsidiary | Report on infrastructure assets as at 30 June 2025 $ '000 Actual maintenance Required maintenance Buildings 12,853 12,853 29,100 28,900 539,983 717,880 Land Improvements & Parks 6,012 6,012 37,927 36,277 244,517 385,760 Sealed roads 118,000 118,000 21,398 20,472 1,639,729 2,697,268 Unsealed roads 94 94 1,070 1,068 1,593 2,584 Bridges 833 833 302 81 127,440 158,864 Footpaths 5,010 5,010 3,927 3,967 246,417 345,157 Carpark 850 850 198 1 47,154 60,692 Other road assets 852 852 60 2 98,327 139,871 Stormwater drainage & water supply network 8,895 8,895 4,473 3,816 1,216,407 1,640,936 Swimming pools 8,933 8,933 1,055 1,005 12,857 26,595 Total – all assets 162,332 162,332 99,510 95,589 4,174,426 6,175,607 Page 7 of 8`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'c'.repeat(64), bytes: 3_873_391 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 8),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 9),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 17),
      pdfPage(SPECIAL_TEXT, 125),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: BlacktownGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: '2024 to 2025 Financial Statements.pdf',
    url: 'https://www.blacktown.nsw.gov.au/files/assets/public/v/1/finance/2024-to-2025-financial-statements.pdf.pdf',
    fiscal_year: BLACKTOWN_GPFS_FISCAL_YEAR,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/blacktown-gpfs/2024-to-2025-financial-statements.pdf.pdf',
    sha256: '74d7c880b4e795ea1cc9d17bb786eb9c1878cf9a1127c4d3f5b4d01f94e11b31',
    bytes: 3_873_391,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: BLACKTOWN_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseBlacktownGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Blacktown GPFS source discovery', () => {
  it('discovers the FY2024-25 statements from the official page, never a hard-coded PDF URL', () => {
    const html = `
      <a title="2024 to 2025 Financial Statements.pdf" href="/files/assets/public/v/1/finance/2024-to-2025-financial-statements.pdf.pdf">latest financial statements<span>(PDF,&nbsp;4MB)</span></a>
      <a title="2024 to 2025 Annual Report" href="/files/annual-reports/2024-2025-annual-report.pdf">2024 to 2025 Annual Report (PDF,&nbsp;15MB)</a>
      <a title="2023 to 2024 Financial Statements.pdf" href="/files/finance/2023-to-2024-financial-statements.pdf">2023 to 2024 Financial Statements</a>
    `;
    const links = parseBlacktownGpfsReportLinks(html);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.some((link) => /annual report/i.test(link.title))).toBe(false);
    const selected = selectBlacktownGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(
      'https://www.blacktown.nsw.gov.au/files/assets/public/v/1/finance/2024-to-2025-financial-statements.pdf.pdf',
    );
    expect(fiscalYearFromBlacktownGpfsLink('2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromBlacktownGpfsLink('2024/25 financial statements')).toBe('2024-25');
    expect(fiscalYearFromBlacktownGpfsLink('2024-2025')).toBe('2024-25');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseBlacktownGpfsReportLinks(
      '<a title="2023 to 2024 Financial Statements.pdf" href="/x/2023.pdf">2023 to 2024 Financial Statements</a>',
    );
    expect(() => selectBlacktownGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Blacktown GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBlacktownGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBlacktownGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseBlacktownGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Blacktown GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the printed totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(33);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(762_437);
    expect(reconciliation.total_expenses).toBe(515_970);
    expect(reconciliation.employee_expenses).toBe(195_736);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(114_905);
    expect(reconciliation.government_grants_operating).toBe(28_952);
    expect(reconciliation.government_grants_capital).toBe(260_899);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(3_995);
    expect(reconciliation.net_result).toBe(246_467);
    expect(reconciliation.net_result_before_capital_grants).toBe(-14_432);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(401_065);
    expect(reconciliation.face_expense_bridge).toBe(515_970);
    expect(reconciliation.functions_total_income).toBe(762_437);
    expect(reconciliation.functions_total_expenses).toBe(515_970);
    expect(reconciliation.functions_operating_result).toBe(246_467);
    expect(reconciliation.functions_grants_and_contributions).toBe(289_851);
    expect(reconciliation.comprehensive_income_net_result).toBe(246_467);
    expect(reconciliation.revenue_components_sum).toBe(762_437);
    expect(reconciliation.expense_components_sum).toBe(401_065);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(76_243_700_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(51_597_000_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(19_573_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      11_490_500_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_895_200_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(26_089_900_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      399_500_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(24_646_700_000);
    // The negative printed before-capital result stays in the reconciliation
    // evidence but is not emitted: money is stored as non-negative cents only.
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('emits the six B1-1 function expense rows and reconciles them to the printed total', () => {
    const { records, reconciliation } = parsedFixture();
    const functions = records.filter((record) =>
      record.gpfs_line_item?.startsWith('b1_1_function_expenses_'),
    );
    expect(functions).toHaveLength(6);
    expect(functions.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(51_597_000_000);
    expect(functions.every((record) => record.function_code === undefined)).toBe(true);
    expect(functions.every((record) => record.gpfs_component_of === 'b1_1_total_expenses')).toBe(
      true,
    );
    expect(functions.map((record) => record.gpfs_line_label)).toEqual([
      'A vibrant and inclusive community — expenses',
      'A clean, sustainable and healthy environment — expenses',
      'A smart and prosperous economy — expenses',
      'A growing city supported by accessible infrastructure — expenses',
      'A sporting and active city — expenses',
      'A leading city — expenses',
    ]);
    expect(reconciliation?.functions).toHaveLength(6);
    expect(reconciliation?.functions_carrying_amount).toBe(8_920_355);
  });

  it('emits the ten special-schedule actual-maintenance rows and reconciles the total', () => {
    const { records, reconciliation } = parsedFixture();
    const schedule = records.filter((record) =>
      record.gpfs_line_item?.startsWith('special_schedule_actual_maintenance_'),
    );
    expect(schedule).toHaveLength(10);
    expect(schedule.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(9_558_900_000);
    expect(
      schedule.every((record) => record.gpfs_component_of === 'actual_asset_maintenance_total'),
    ).toBe(true);
    expect(schedule[0]?.gpfs_statement).toBe('Special Schedule — Report on infrastructure assets');
    expect(reconciliation?.special_schedule_page).toBe(125);
    expect(reconciliation?.special_schedule_actual_maintenance_total).toBe(95_589);
  });

  it('keeps the original 17 GPFS rows byte-identical in key and amount', () => {
    const { records } = parsedFixture();
    const existing: Array<[string, number]> = [
      ['rates_and_annual_charges', 312_869],
      ['user_charges_and_fees', 51_413],
      ['other_revenues', 30_945],
      ['government_grants_operating', 28_952],
      ['government_grants_capital', 260_899],
      ['interest_and_investment_income', 47_102],
      ['other_income', 26_262],
      ['net_gain_from_disposal_of_assets', 3_995],
      ['total_revenue', 762_437],
      ['employee_expenses', 195_736],
      ['materials_and_services', 187_276],
      ['borrowing_costs', 1_259],
      ['other_expenses', 16_794],
      ['total_expenses_excluding_depreciation', 401_065],
      ['depreciation_amortisation_impairment', 114_905],
      ['total_expenses', 515_970],
      ['net_result', 246_467],
    ];
    for (const [key, millions] of existing) {
      const record = recordByLine(records, key);
      expect(record.natural_key).toBe(
        blacktownGpfsNaturalKey(CONTEXT.document.url, key, BLACKTOWN_GPFS_FISCAL_YEAR),
      );
      expect(record.amount_cents).toBe(millions * 100_000);
    }
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: BLACKTOWN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'Blacktown City Council',
        source_dataset: 'Blacktown City Council GPFS 2024-25',
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
      expect(record.natural_key).toMatch(/^blacktown-gpfs:/);
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
    expect(revenueComponents).toHaveLength(8);
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
    expect(natureComponents).toHaveLength(4);
    expect(natureComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      expensesExDepreciation.amount_cents,
    );

    // The printed nil "Net loss from the disposal of assets" expense line is not
    // emitted; the non-zero revenue "Net gain from the disposal of assets" line
    // is a revenue component.
    expect(
      records.some((record) => record.gpfs_line_item === 'net_loss_from_disposal_of_assets'),
    ).toBe(false);

    // Every output row is agency detail, so neither the API nor an area panel can
    // add it to any other council or state row.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('keeps the function cut and the nature cut as separate non-additive cuts', () => {
    const { records } = parsedFixture();
    const total = recordByLine(records, 'total_expenses');
    const functionCut = records.filter(
      (record) => record.gpfs_component_of === 'b1_1_total_expenses',
    );
    const natureCut = records.filter((record) => record.gpfs_component_of === 'total_expenses');
    expect(functionCut).toHaveLength(6);
    expect(natureCut).toHaveLength(2);
    expect(functionCut.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      total.amount_cents,
    );
    expect(natureCut.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      total.amount_cents,
    );
    // The two cuts overlap the same total; only the total itself is a total row.
    expect(records.filter((record) => record.gpfs_line_item === 'total_expenses')).toHaveLength(1);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace(
      '762,437   698,482   515,970   492,603',
      '762,437   698,482   515,971   492,603',
    );
    const parsed = parseBlacktownGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement   246,467',
      'from Income Statement   246,468',
    );
    const parsed = parseBlacktownGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = blacktownGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = blacktownGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^blacktown-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(blacktownGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(blacktownGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_blacktowngpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BLACKTOWN_GPFS_ID,
    name: BLACKTOWN_GPFS_NAME,
    publisher: BLACKTOWN_GPFS_PUBLISHER,
    source_url: BLACKTOWN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BLACKTOWN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'blacktown-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Blacktown GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BLACKTOWN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        // The existing AusTender contract whose delivery_entity happens to be
        // "Blacktown City Council". It must never be summed with the GPFS rows.
        amount_cents: 6_996_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-blacktown',
        project_name: 'Existing AusTender Blacktown contract',
        delivery_entity: 'Blacktown City Council',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-blacktown',
        project_name: 'Existing GrantConnect Blacktown grant',
        delivery_entity: 'Blacktown City Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'city-of-sydney-gpfs',
        source_url: 'https://www.cityofsydney.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-city-of-sydney-gpfs-1',
        project_name: 'Existing City of Sydney GPFS row',
        delivery_entity: 'City of Sydney',
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
    expect(await MeasureModel.countDocuments({ source_id: 'city-of-sydney-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: BLACKTOWN_GPFS_ID })).toBe(33);
    expect(await MeasureModel.countDocuments({})).toBe(36);

    const existing = await MeasureModel.find({ source_id: { $in: ['aus-tender', 'grantconnect'] } })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.natural_key)).toEqual([
      'grantconnect:GA-existing-blacktown',
      'prod-existing-aus-tender-blacktown',
    ]);
    expect(existing.map((row) => row.amount_cents)).toEqual([502_773_441, 6_996_000]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: BLACKTOWN_GPFS_ID })).toBe(33);
    expect(await MeasureModel.countDocuments({})).toBe(36);

    expect(
      await MeasureModel.countDocuments({
        source_id: BLACKTOWN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BLACKTOWN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BLACKTOWN_GPFS_ID,
        delivery_entity: { $ne: 'Blacktown City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BLACKTOWN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(33);
  });
});
