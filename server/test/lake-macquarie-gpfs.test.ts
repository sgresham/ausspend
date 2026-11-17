import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  LAKE_MACQUARIE_GPFS_DELIVERY_ENTITY,
  LAKE_MACQUARIE_GPFS_FISCAL_YEAR,
  LAKE_MACQUARIE_GPFS_ID,
  LAKE_MACQUARIE_GPFS_LICENSE,
  LAKE_MACQUARIE_GPFS_NAME,
  LAKE_MACQUARIE_GPFS_PUBLISHER,
  LAKE_MACQUARIE_GPFS_REPORTING_URL,
  detectLakeMacquarieGpfsUnit,
  fiscalYearFromLakeMacquarieGpfsLink,
  parseLakeMacquarieGpfsExtraction,
  parseLakeMacquarieGpfsReportLinks,
  selectLakeMacquarieGpfsDocument,
  lakeMacquarieGpfsNaturalKey,
  type LakeMacquarieGpfsParseContext,
} from '../src/connectors/lake-macquarie-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed/PDF pp. 4, 5 and
// 14 of 82). The Income Statement prints the Original unaudited budget column
// before the line label, with Actual 2025 and Actual 2024 after it. A parser that
// took the first number in the line would read the budget; the expected values
// are all Actual 2025. The net result is positive while the printed
// before-capital result is negative.
const INCOME_TEXT = `§Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 218,357 Rates and annual charges B2-1 224,082 207,942 27,257 User charges and fees B2-2 28,644 27,248 11,253 Other revenues B2-3 22,375 17,850 30,726 Grants and contributions provided for operating purposes B2-4 24,924 32,586 55,425 Grants and contributions provided for capital purposes B2-4 132,007 151,974 14,900 Interest and investment income B2-5 23,923 16,478 6,300 Other income B2-6 7,658 11,291 364,218 Total income from continuing operations 463,613 465,369 Expenses from continuing operations 117,087 Employee benefits and on-costs B3-1 119,020 110,219 88,429 Materials and services B3-2 93,667 85,819 8,768 Borrowing costs B3-3 9,916 15,753 18,443 Other expenses B3-5 18,753 18,185 – Net loss from the disposal of assets B4-1 14,040 2,514 232,727 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 255,396 232,490 131,491 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 208,217 232,879 75,525 Depreciation, amortisation and impairment of non-financial assets B3-4 83,068 76,783 55,966 Operating result from continuing operations 125,149 156,096 55,966 Net operating result for the year attributable to Council 125,149 156,096 541 Net operating result for the year before grants and contributions provided for capital purposes (6,858) 4,122 The above Income Statement should be read in conjunction with the accompanying notes. Lake Macquarie City Council Income Statement for the year ended 30 June 2025 Page 4 of 82`;

const COMPREHENSIVE_TEXT = `§Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 125,149 156,096 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-6 (132,349) 142,240 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-6 – (176) Total items which will not be reclassified subsequent to operating result (132,349) 142,064 Total other comprehensive income for the year (132,349) 142,064 Total comprehensive income for the year attributable to Council (7,200) 298,160 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Lake Macquarie City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 82`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Unique Landscape 6,050 5,628 43,222 42,056 (37,172) (36,428) 973 902 21,324 23,035 Lifestyle and Wellbeing 109,821 107,534 118,835 110,919 (9,014) (3,385) 34,400 34,975 750,249 720,139 Mobility and Accessibility 96,357 121,301 80,473 74,465 15,884 46,836 96,353 121,262 3,354,561 3,391,743 Diverse Economy 24,067 27,594 26,947 27,298 (2,880) 296 565 346 287,573 313,661 Connected Communities 5,467 4,206 19,132 18,370 (13,665) (14,164) 5,137 3,709 26,660 24,234 Creativity 1,781 1,360 12,454 11,779 (10,673) (10,419) 1,200 867 50,041 37,825 Shared Decision-Making 168 139 5,967 3,779 (5,799) (3,640) 2 2 – – Organisational Support 219,902 197,607 31,434 20,607 188,468 177,000 18,301 22,497 173,833 142,146 Total functions and activities 463,613 465,369 338,464 309,273 125,149 156,096 156,931 184,560 4,664,242 4,652,783 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 82`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'b5e031999a9e37d69e8df2afcd9a1756adb95229218412dc5919ee16fb93b72b',
      bytes: 2_290_159,
    },
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

const PDF_URL =
  'https://www.lakemac.com.au/files/assets/public/v/1/council/annual-reports/annual-financial-statements-for-the-year-ended-30-june-2025.pdf';

const CONTEXT: LakeMacquarieGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual financial statements for the year ended 30 June 2025 (PDF, 2MB)',
    url: PDF_URL,
    fiscal_year: LAKE_MACQUARIE_GPFS_FISCAL_YEAR,
    listing_url: LAKE_MACQUARIE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/lake-macquarie-gpfs/annual-financial-statements-for-the-year-ended-30-june-2025.pdf',
    sha256: 'b5e031999a9e37d69e8df2afcd9a1756adb95229218412dc5919ee16fb93b72b',
    bytes: 2_290_159,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: LAKE_MACQUARIE_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseLakeMacquarieGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Lake Macquarie GPFS source discovery', () => {
  it('discovers the FY2024-25 financial report from the official page, not a hard-coded URL', () => {
    const indexHtml = `
      <a href="/files/assets/public/v/23/our-council/city-strategies-plans-and-reporting/annual-report/lake-macquarie-city-council-annual-report-2025-2026.pdf">Lake Macquarie City Council Annual Report 2025-2026(PDF, 15MB)</a>
      <a href="/files/assets/public/v/23/our-council/city-strategies-plans-and-reporting/annual-report/lake-macquarie-city-council-annual-financial-statements-2025-2026-final.pdf">Annual financial statements for the year ended 30 June 2026(PDF, 5MB)</a>
      <a href="/files/assets/public/v/1/council/annual-reports/annual-report-2024-2025-and-gold-award.pdf">Lake Macquarie City Council Annual Report 2024-2025(PDF, 35MB)</a>
      <a href="/files/assets/public/v/1/council/annual-reports/annual-financial-statements-for-the-year-ended-30-june-2025.pdf">Annual financial statements for the year ended 30 June 2025(PDF, 2MB)</a>
      <a href="/files/assets/public/v/1/council/annual-reports/lmcc_2023-2024-audited-annual-financial-statements.pdf">Annual financial statements for the year ended 30 June 2024(PDF, 20MB)</a>
    `;
    const links = parseLakeMacquarieGpfsReportLinks(indexHtml, LAKE_MACQUARIE_GPFS_REPORTING_URL);
    const fy2425 = links.filter((link) => link.fiscal_year === '2024-25');
    expect(fy2425).toHaveLength(1);
    expect(fy2425[0]!.url).toBe(PDF_URL);
    expect(fy2425[0]!.listing_url).toBe(LAKE_MACQUARIE_GPFS_REPORTING_URL);
    const selected = selectLakeMacquarieGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(PDF_URL);
    expect(
      fiscalYearFromLakeMacquarieGpfsLink(
        'Annual financial statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromLakeMacquarieGpfsLink(
        'annual-financial-statements-for-the-year-ended-30-june-2025.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromLakeMacquarieGpfsLink(
        'Annual financial statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromLakeMacquarieGpfsLink('2024/2025 Financial Statements')).toBe('2024-25');
    expect(fiscalYearFromLakeMacquarieGpfsLink('2024-2025')).toBe('2024-25');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseLakeMacquarieGpfsReportLinks(
      '<a href="/getmedia/e7f35dd5-c928-47d8-a705-4da1ddbc7ec9/Annual-Financial-Statements-2024-(Final)-Lake Macquarie-City-Council.pdf">2023/2024 Financial Statements (PDF, 8.1 MB)</a>',
      LAKE_MACQUARIE_GPFS_REPORTING_URL,
    );
    expect(() => selectLakeMacquarieGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Lake Macquarie GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectLakeMacquarieGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectLakeMacquarieGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseLakeMacquarieGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Lake Macquarie GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the printed totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(463_613);
    expect(reconciliation.total_expenses).toBe(338_464);
    expect(reconciliation.employee_expenses).toBe(119_020);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(83_068);
    expect(reconciliation.government_grants_operating).toBe(24_924);
    expect(reconciliation.government_grants_capital).toBe(132_007);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(14_040);
    expect(reconciliation.net_result).toBe(125_149);
    expect(reconciliation.net_result_before_capital_grants).toBe(-6_858);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(255_396);
    expect(reconciliation.face_expense_bridge).toBe(338_464);
    expect(reconciliation.functions_total_income).toBe(463_613);
    expect(reconciliation.functions_total_expenses).toBe(338_464);
    expect(reconciliation.functions_operating_result).toBe(125_149);
    expect(reconciliation.functions_grants_and_contributions).toBe(156_931);
    expect(reconciliation.comprehensive_income_net_result).toBe(125_149);
    expect(reconciliation.revenue_components_sum).toBe(463_613);
    expect(reconciliation.expense_components_sum).toBe(255_396);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(46_361_300_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(33_846_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(11_902_000_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      8_306_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_492_400_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(13_200_700_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      1_404_000_000,
    );
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(12_514_900_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: LAKE_MACQUARIE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: LAKE_MACQUARIE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Lake Macquarie City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Lake Macquarie City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^lake-macquarie-gpfs:/);
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

    const expensesExDepreciation = recordByLine(records, 'total_expenses_excluding_depreciation');
    const natureComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses_excluding_depreciation',
    );
    expect(natureComponents).toHaveLength(5);
    expect(natureComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      expensesExDepreciation.amount_cents,
    );

    const totalExpenses = recordByLine(records, 'total_expenses');
    const bridgeComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses',
    );
    expect(bridgeComponents).toHaveLength(2);
    expect(bridgeComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalExpenses.amount_cents,
    );

    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace(
      '463,613 465,369 338,464 309,273',
      '463,613 465,369 338,462 309,273',
    );
    const parsed = parseLakeMacquarieGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 125,149',
      'from Income Statement 125,148',
    );
    const parsed = parseLakeMacquarieGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = lakeMacquarieGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = lakeMacquarieGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^lake-macquarie-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(lakeMacquarieGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(lakeMacquarieGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_lake-macquariegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: LAKE_MACQUARIE_GPFS_ID,
    name: LAKE_MACQUARIE_GPFS_NAME,
    publisher: LAKE_MACQUARIE_GPFS_PUBLISHER,
    source_url: LAKE_MACQUARIE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LAKE_MACQUARIE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'lake-macquarie-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Lake Macquarie GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: LAKE_MACQUARIE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-lake-macquarie',
        project_name: 'Existing AusTender Lake Macquarie City contract',
        delivery_entity: 'LAKE_MACQUARIE CITY COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-lake-macquarie',
        project_name: 'Existing GrantConnect Lake Macquarie City grant',
        delivery_entity: 'Lake Macquarie City Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-lake-macquarie-school',
        project_name: 'Existing data.nsw Lake Macquarie school row (not a council row)',
        delivery_entity: 'Lake Macquarie High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-lake-macquarie-charity',
        project_name: 'Existing ACNC Lake Macquarie charity row (not the council)',
        delivery_entity: 'Lake Macquarie Pride Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'sutherland-shire-gpfs',
        source_url: 'https://www.sutherlandshire.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-sutherland-gpfs-1',
        project_name: 'Existing Sutherland GPFS row',
        delivery_entity: 'Sutherland Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'sutherland-shire-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: LAKE_MACQUARIE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'data-nsw-ckan', 'acnc-charity'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.amount_cents)).toEqual([
      654_321, 123_456, 502_773_441, 12_345_000,
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: LAKE_MACQUARIE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: LAKE_MACQUARIE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: LAKE_MACQUARIE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: LAKE_MACQUARIE_GPFS_ID,
        delivery_entity: { $ne: 'Lake Macquarie City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: LAKE_MACQUARIE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
