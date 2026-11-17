import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WOLLONGONG_GPFS_DELIVERY_ENTITY,
  WOLLONGONG_GPFS_FISCAL_YEAR,
  WOLLONGONG_GPFS_ID,
  WOLLONGONG_GPFS_LICENSE,
  WOLLONGONG_GPFS_NAME,
  WOLLONGONG_GPFS_PUBLISHER,
  WOLLONGONG_GPFS_REPORTING_URL,
  detectWollongongGpfsUnit,
  fiscalYearFromWollongongGpfsLink,
  parseWollongongGpfsExtraction,
  parseWollongongGpfsReportLinks,
  selectWollongongGpfsDocument,
  wollongongGpfsNaturalKey,
  type WollongongGpfsParseContext,
} from '../src/connectors/wollongong-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 4, 5 and 13;
// PDF pages 15, 16 and 24). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after it.
// A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. Both the net result and the printed
// before-capital result are negative.
const INCOME_TEXT = `Wollongong City Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 247,048 Rates and annual charges B2-1 247,516 231,847 39,990 User charges and fees B2-2 40,074 38,578 5,872 Other revenues B2-3 6,748 9,045 33,212 Grants and contributions provided for operating purposes B2-4 31,646 32,772 27,454 Grants and contributions provided for capital purposes B2-4 45,473 100,797 6,196 Interest and investment income B2-5 9,756 8,711 7,231 Other income B2-6 9,430 8,575 28,516 Net gain from the disposal of assets B4-1 – – 395,519 Total income from continuing operations 390,643 430,325 Expenses from continuing operations 142,404 Employee benefits and on-costs B3-1 153,272 140,458 99,866 Materials and services B3-2 110,545 122,542 557 Borrowing costs B3-3 1,144 747 24,257 Other expenses B3-5 31,548 29,446 – Net loss from the disposal of assets B4-1 6,276 10,120 267,084 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 302,785 303,313 128,435 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 87,858 127,012 87,113 Depreciation, amortisation and impairment of non-financial assets B3-4 98,096 86,023 41,322 Operating result from continuing operations (10,238) 40,989 41,322 Net operating result for the year attributable to Council (10,238) 40,989 13,868 Net operating result for the year before grants and contributions provided for capital purposes (55,711) (59,808) The above Income Statement should be read in conjunction with the accompanying notes. Wollongong City Council Income Statement for the year ended 30 June 2025 Page 4`;

const COMPREHENSIVE_TEXT = `Wollongong City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement (10,238) 40,989 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-8 98,777 320,912 Impairment (loss) relating to infrastructure, property, plant and equipment C1-8 – (598) Total items which will not be reclassified subsequent to operating result 98,777 320,314 Total other comprehensive income for the year 98,777 320,314 Total comprehensive income for the year attributable to Council 88,539 361,303 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Wollongong City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Goal 1 - We value and protect our environment 97,684 91,357 124,553 127,339 (26,869) (35,982) 28,624 25,337 1,127,728 1,002,545 Goal 2 - We have an innovative and sustainable economy 10,963 11,164 14,583 13,908 (3,620) (2,744) – 25 4,396 5,886 Goal 3 - Wollongong is a creative, vibrant city 759 1,066 12,743 12,124 (11,984) (11,058) 525 688 1,609 2,190 Goal 4 - We are a connected and engaged community 14,477 13,469 38,630 34,569 (24,153) (21,100) 6,631 6,519 860,369 859,612 Goal 5 - We have a healthy community in a liveable city 13,335 16,879 68,819 63,501 (55,484) (46,622) 2,166 7,370 723,962 786,886 Goal 6 - We have affordable and accessible transport 12,071 18,441 70,261 75,538 (58,190) (57,097) 10,687 16,455 1,423,037 1,404,313 Support Services 227,404 218,657 71,292 62,357 156,112 156,300 14,536 17,883 260,565 233,853 Contributed Assets 13,950 59,292 – – 13,950 59,292 13,950 59,292 – – Total functions and activities 390,643 430,325 400,881 389,336 (10,238) 40,989 77,119 133,569 4,401,666 4,295,285 (1) The functions/activities reported above are different to what has been reported in the past. The Goals listed above and described on the following page, align with Council’s Community Strategic Plan – Our Wollongong Our Future 2032. B Financial Performance B1 Functions or activities B1-1 Community Strategic Plan Goals – income, expenses and assets 1 Page 13 Wollongong City Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'e'.repeat(64), bytes: 7_343_281 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 15),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 16),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 24),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.wollongong.nsw.gov.au/__data/assets/pdf_file/0011/300404/Annual-Financial-Statements-year-ended-30-June-2025.pdf';

const CONTEXT: WollongongGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Report for the Year Ended 30 June 2025 PDF, 7171.17 KB',
    url: PDF_URL,
    fiscal_year: WOLLONGONG_GPFS_FISCAL_YEAR,
    listing_url: WOLLONGONG_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/wollongong-gpfs/Annual-Financial-Statements-year-ended-30-June-2025.pdf',
    sha256: 'ae26b12b906a09ce17d1c353e4f36d8aec29b0de5e4b539cffe5a953aedc6ad3',
    bytes: 7_343_281,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: WOLLONGONG_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseWollongongGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Wollongong GPFS source discovery', () => {
  it('discovers the FY2024-25 financial report from the official page, not a hard-coded URL', () => {
    const indexHtml = `
      <a href="/council/council-documents/reports/annual-and-quarterly-reports">Annual and Quarterly Reports</a>
      <a href="/__data/assets/pdf_file/0011/300404/Annual-Financial-Statements-year-ended-30-June-2025.pdf">Financial Report for the Year Ended 30 June 2025 PDF, 7171.17 KB</a>
      <a href="/__data/assets/pdf_file/0032/258836/Annual-Financial-Statements-for-the-year-ended-30-June-2024.pdf">Annual-Financial-Statements-for-the-year-ended-30-June-2024.pdf</a>
      <a href="/__data/assets/pdf_file/0022/206590/Financial-Report-for-the-Year-Ended-30-June-2023.pdf">Financial-Report-for-the-Year-Ended-30-June-2023.pdf</a>
    `;
    const links = parseWollongongGpfsReportLinks(indexHtml, WOLLONGONG_GPFS_REPORTING_URL);
    const fy2425 = links.filter((link) => link.fiscal_year === '2024-25');
    expect(fy2425).toHaveLength(1);
    expect(fy2425[0]!.url).toBe(PDF_URL);
    expect(fy2425[0]!.listing_url).toBe(WOLLONGONG_GPFS_REPORTING_URL);
    const selected = selectWollongongGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(PDF_URL);
    expect(fiscalYearFromWollongongGpfsLink('Year Ended 30 June 2025')).toBe('2024-25');
    expect(fiscalYearFromWollongongGpfsLink('2024/25 financial statements')).toBe('2024-25');
    expect(fiscalYearFromWollongongGpfsLink('2024-2025')).toBe('2024-25');
    expect(
      fiscalYearFromWollongongGpfsLink(
        'Annual-Financial-Statements-for-the-year-ended-30-June-2024.pdf',
      ),
    ).toBe('2023-24');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseWollongongGpfsReportLinks(
      '<a href="/__data/assets/pdf_file/0032/258836/Annual-Financial-Statements-for-the-year-ended-30-June-2024.pdf">Annual-Financial-Statements-for-the-year-ended-30-June-2024.pdf</a>',
      WOLLONGONG_GPFS_REPORTING_URL,
    );
    expect(() => selectWollongongGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Wollongong GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectWollongongGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectWollongongGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseWollongongGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Wollongong GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the printed totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(390_643);
    expect(reconciliation.total_expenses).toBe(400_881);
    expect(reconciliation.employee_expenses).toBe(153_272);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(98_096);
    expect(reconciliation.government_grants_operating).toBe(31_646);
    expect(reconciliation.government_grants_capital).toBe(45_473);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(6_276);
    expect(reconciliation.net_result).toBe(-10_238);
    expect(reconciliation.net_result_before_capital_grants).toBe(-55_711);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(302_785);
    expect(reconciliation.face_expense_bridge).toBe(400_881);
    expect(reconciliation.functions_total_income).toBe(390_643);
    expect(reconciliation.functions_total_expenses).toBe(400_881);
    expect(reconciliation.functions_operating_result).toBe(-10_238);
    expect(reconciliation.functions_grants_and_contributions).toBe(77_119);
    expect(reconciliation.comprehensive_income_net_result).toBe(-10_238);
    expect(reconciliation.revenue_components_sum).toBe(390_643);
    expect(reconciliation.expense_components_sum).toBe(302_785);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(39_064_300_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(40_088_100_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(15_327_200_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      9_809_600_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(3_164_600_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(4_547_300_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      627_600_000,
    );
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_023_800_000);
    expect(netResult.gpfs_printed_sign).toBe('negative');
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: WOLLONGONG_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: WOLLONGONG_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Wollongong City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Wollongong City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^wollongong-gpfs:/);
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
      '390,643 430,325 400,881 389,336',
      '390,643 430,325 400,882 389,336',
    );
    const parsed = parseWollongongGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement (10,238)',
      'from Income Statement (10,239)',
    );
    const parsed = parseWollongongGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = wollongongGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = wollongongGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^wollongong-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(wollongongGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(wollongongGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_wollongonggpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: WOLLONGONG_GPFS_ID,
    name: WOLLONGONG_GPFS_NAME,
    publisher: WOLLONGONG_GPFS_PUBLISHER,
    source_url: WOLLONGONG_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WOLLONGONG_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'wollongong-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Wollongong GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: WOLLONGONG_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-wollongong',
        project_name: 'Existing AusTender Wollongong City contract',
        delivery_entity: 'WOLLONGONG CITY COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-wollongong',
        project_name: 'Existing GrantConnect Wollongong City grant',
        delivery_entity: 'Wollongong City Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-wollongong-school',
        project_name: 'Existing data.nsw Wollongong school row (not a council row)',
        delivery_entity: 'Wollongong High School of the Performing Arts',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-wollongong-charity',
        project_name: 'Existing ACNC Wollongong charity row (not the council)',
        delivery_entity: 'Wollongong Homeless Hub and Housing Services',
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
    expect(await MeasureModel.countDocuments({ source_id: WOLLONGONG_GPFS_ID })).toBe(17);
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
    expect(await MeasureModel.countDocuments({ source_id: WOLLONGONG_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: WOLLONGONG_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WOLLONGONG_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WOLLONGONG_GPFS_ID,
        delivery_entity: { $ne: 'Wollongong City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: WOLLONGONG_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
