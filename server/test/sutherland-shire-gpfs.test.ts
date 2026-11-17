import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  SUTHERLAND_SHIRE_GPFS_DELIVERY_ENTITY,
  SUTHERLAND_SHIRE_GPFS_FISCAL_YEAR,
  SUTHERLAND_SHIRE_GPFS_ID,
  SUTHERLAND_SHIRE_GPFS_LICENSE,
  SUTHERLAND_SHIRE_GPFS_NAME,
  SUTHERLAND_SHIRE_GPFS_PUBLISHER,
  SUTHERLAND_SHIRE_GPFS_REPORTING_URL,
  detectSutherlandShireGpfsUnit,
  fiscalYearFromSutherlandShireGpfsLink,
  parseSutherlandShireGpfsExtraction,
  parseSutherlandShireGpfsReportLinks,
  selectSutherlandShireGpfsDocument,
  sutherlandShireGpfsNaturalKey,
  type SutherlandShireGpfsParseContext,
} from '../src/connectors/sutherland-shire-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 4, 5 and 13;
// PDF pages 5, 6 and 14). The income statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after it.
// A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. The printed "Net operating result for the
// year before grants and contributions provided for capital purposes" is
// negative and is kept in reconciliation evidence only (amount_cents >= 0).
const INCOME_TEXT = `Sutherland Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 198,517 Rates and annual charges B2-1 199,754 190,447 47,397 User charges and fees B2-2 51,722 45,114 12,637 Other revenues B2-3 12,706 12,825 19,482 Grants and contributions provided for operating purposes B2-4 19,436 21,324 13,080 Grants and contributions provided for capital purposes B2-4 16,267 26,621 13,641 Interest and investment income B2-5 17,936 16,549 5,212 Other income B2-6 7,721 5,379 309,966 Total income from continuing operations 325,542 318,259 Expenses from continuing operations 133,598 Employee benefits and on-costs B3-1 130,034 120,253 107,360 Materials and services B3-2 110,645 112,224 646 Borrowing costs B3-3 629 722 9,267 Other expenses B3-5 13,313 11,191 5,298 Net loss from the disposal of assets B4-1 3,651 7,721 256,169 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 258,272 252,111 53,797 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 67,270 66,148 57,027 Depreciation, amortisation and impairment of non-financial assets B3-4 53,206 53,903 (3,230) Operating result from continuing operations 14,064 12,245 (3,230) Net operating result for the year attributable to Council 14,064 12,245 (16,312) Net operating result for the year before grants and contributions provided for capital purposes (2,203) (14,376) The above Income Statement should be read in conjunction with the accompanying notes. Sutherland Shire Council Income Statement for the year ended 30 June 2025 Page 4 of 88`;

const COMPREHENSIVE_TEXT = `Sutherland Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 14,064 12,245 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 56,957 127,534 Total items which will not be reclassified subsequent to operating result 56,957 127,534 Total other comprehensive income for the year 56,957 127,534 Total comprehensive income for the year attributable to Council 71,021 139,779 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Sutherland Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 88`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Arts & Culture 1,328 1,415 8,625 5,794 (7,297) (4,379) – – 53,576 59,614 Business & Economic Development 402 428 2,114 1,776 (1,712) (1,348) 175 170 250 84 Childrens Services 19,592 16,690 21,556 22,084 (1,964) (5,394) 1,650 1,182 9,633 10,722 Community Services 91 165 968 788 (877) (623) 56 140 – – Community Venues 1,427 1,369 2,032 631 (605) 738 – 20 42,260 45,917 Development Assessment 2,809 2,934 8,655 8,941 (5,846) (6,007) – – 44 14 Emergency Management 651 – 7,820 6,989 (7,169) (6,989) 651 – 7,975 8,889 Environmental Health & Sustainability 961 235 6,890 5,947 (5,929) (5,712) 298 186 29 14 Integrated Transport 7,007 5,746 27,765 17,197 (20,758) (11,451) 3,848 4,478 1,114,570 1,114,421 Leisure & Aquatic Services 12,220 11,510 19,182 14,614 (6,962) (3,104) 34 – 138,411 136,976 Libraries 872 851 9,820 7,242 (8,948) (6,391) 727 724 19,311 20,868 Natural Areas Management 264 253 2,516 2,436 (2,252) (2,183) 259 253 234,447 335,927 Parks & Open Spaces 329 277 13,905 8,563 (13,576) (8,286) – – 528,812 382,154 Public Domain Management 1,860 1,341 3,289 916 (1,429) 425 – – 109 46 Public Health & Safety 627 627 5,875 4,862 (5,248) (4,235) 59 57 23,405 24,941 Regulatory Compliance 8,239 8,206 7,218 7,326 1,021 880 – – 574 387 Sporting Facilities 6,000 6,853 10,308 4,124 (4,308) 2,729 742 1,772 117,775 59,166 Stormwater & Waterways 2,390 2,409 13,691 5,086 (11,301) (2,677) – – 514,952 518,001 Strategic Land Use Planning 12,977 16,053 1,677 1,288 11,300 14,765 12,235 15,217 79,694 73,022 Waste Management 46,936 45,552 55,708 53,371 (8,772) (7,819) 413 11,329 49,833 51,678 Asset Strategy & Delivery 8,222 11,429 7,592 10,561 630 868 3,959 117 104,809 94,169 Building Infrastructure 135 148 20,841 12,134 (20,706) (11,986) 122 – 175,894 184,159 Customer & Engagement – 2 5,879 4,616 (5,879) (4,614) – 12,300 – – Finance, Property & Performance 189,457 182,810 15,198 71,129 174,259 111,681 10,327 – 327,508 345,511 Governance 272 632 15,313 12,335 (15,041) (11,703) – – 21,320 23,607 Fleet & Logistics 71 86 327 1,380 (256) (1,294) – – 1,368 1,137 Human Resources 170 2 3,579 2,704 (3,409) (2,702) 148 – 300 18 Information Management & Technology 233 236 13,135 11,180 (12,902) (10,944) – – 2,212 2,540 Total functions and activities 325,542 318,259 311,478 306,014 14,064 12,245 35,703 47,945 3,569,071 3,493,982 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 88 Sutherland Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'e'.repeat(64), bytes: 5_464_555 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: SutherlandShireGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024-2025 - PDF - 5336 KB',
    url: 'https://www.sutherlandshire.nsw.gov.au/__data/assets/pdf_file/0019/109144/2024-2025-Sutherland-Shire-Council-Financial-Statements.pdf',
    fiscal_year: SUTHERLAND_SHIRE_GPFS_FISCAL_YEAR,
    listing_url: SUTHERLAND_SHIRE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/sutherland-shire-gpfs/2024-2025-Sutherland-Shire-Council-Financial-Statements.pdf',
    sha256: 'a97e7719e485a0fb6f49468c0eb7672a5b120c0aa6077ccfdb0349d56dd2b743',
    bytes: 5_464_555,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: SUTHERLAND_SHIRE_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseSutherlandShireGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Sutherland Shire GPFS source discovery', () => {
  it('discovers the stand-alone statements PDF, never the annual-report Appendix D', () => {
    const indexHtml = `
      <a href="/__data/assets/pdf_file/0034/109789/Annual-Report-2024-25-Appendix-A.pdf">Appendix A - Annual Report 2024-25 - PDF - 25866 KB</a>
      <a href="/__data/assets/pdf_file/0028/109792/2024-25-Financial-Statements-Appendix-D.pdf">Appendix D - Financial Statements - PDF - 6279 KB</a>
      <a href="/__data/assets/pdf_file/0019/109144/2024-2025-Sutherland-Shire-Council-Financial-Statements.pdf">Financial Statements 2024-2025 - PDF - 5336 KB</a>
      <a href="/__data/assets/pdf_file/0025/88450/2023-2024-Sutherland-Shire-Council-Financial-Statements.pdf">Financial Statements 2023-2024 - PDF - 4280 KB</a>
    `;
    const links = parseSutherlandShireGpfsReportLinks(
      indexHtml,
      SUTHERLAND_SHIRE_GPFS_REPORTING_URL,
    );
    expect(links.some((link) => /appendix/i.test(link.url))).toBe(false);
    const fy2425 = links.filter((link) => link.fiscal_year === '2024-25');
    expect(fy2425).toHaveLength(1);
    expect(fy2425[0]!.url).toBe(CONTEXT.document.url);
    const selected = selectSutherlandShireGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(CONTEXT.document.url);
    expect(selected.listing_url).toBe(SUTHERLAND_SHIRE_GPFS_REPORTING_URL);
    expect(fiscalYearFromSutherlandShireGpfsLink('2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromSutherlandShireGpfsLink('2024/25 financial statements')).toBe('2024-25');
    expect(fiscalYearFromSutherlandShireGpfsLink('2024-2025')).toBe('2024-25');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseSutherlandShireGpfsReportLinks(
      '<a href="/__data/assets/pdf_file/0025/88450/2023-2024-Sutherland-Shire-Council-Financial-Statements.pdf">Financial Statements 2023-2024 - PDF</a>',
      SUTHERLAND_SHIRE_GPFS_REPORTING_URL,
    );
    expect(() => selectSutherlandShireGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Sutherland Shire GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectSutherlandShireGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectSutherlandShireGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseSutherlandShireGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Sutherland Shire GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the printed totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(325_542);
    expect(reconciliation.total_expenses).toBe(311_478);
    expect(reconciliation.employee_expenses).toBe(130_034);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(53_206);
    expect(reconciliation.government_grants_operating).toBe(19_436);
    expect(reconciliation.government_grants_capital).toBe(16_267);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(3_651);
    expect(reconciliation.net_result).toBe(14_064);
    expect(reconciliation.net_result_before_capital_grants).toBe(-2_203);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(258_272);
    expect(reconciliation.face_expense_bridge).toBe(311_478);
    expect(reconciliation.functions_total_income).toBe(325_542);
    expect(reconciliation.functions_total_expenses).toBe(311_478);
    expect(reconciliation.functions_operating_result).toBe(14_064);
    expect(reconciliation.functions_grants_and_contributions).toBe(35_703);
    expect(reconciliation.comprehensive_income_net_result).toBe(14_064);
    expect(reconciliation.revenue_components_sum).toBe(325_542);
    expect(reconciliation.expense_components_sum).toBe(258_272);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(32_554_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(31_147_800_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(13_003_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      5_320_600_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_943_600_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_626_700_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      365_100_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(1_406_400_000);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: SUTHERLAND_SHIRE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: SUTHERLAND_SHIRE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Sutherland Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Sutherland Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^sutherland-shire-gpfs:/);
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
      '325,542 318,259 311,478 306,014',
      '325,542 318,259 311,479 306,014',
    );
    const parsed = parseSutherlandShireGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 14,064',
      'from Income Statement 14,065',
    );
    const parsed = parseSutherlandShireGpfsExtraction(
      extraction({ comprehensive: broken }),
      CONTEXT,
    );
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
    const revenue = sutherlandShireGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = sutherlandShireGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^sutherland-shire-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(sutherlandShireGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(sutherlandShireGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_sutherlandgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: SUTHERLAND_SHIRE_GPFS_ID,
    name: SUTHERLAND_SHIRE_GPFS_NAME,
    publisher: SUTHERLAND_SHIRE_GPFS_PUBLISHER,
    source_url: SUTHERLAND_SHIRE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: SUTHERLAND_SHIRE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'sutherland-shire-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Sutherland Shire GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: SUTHERLAND_SHIRE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-sutherland',
        project_name: 'Existing AusTender Sutherland Shire contract',
        delivery_entity: 'SUTHERLAND SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-sutherland',
        project_name: 'Existing GrantConnect Sutherland Shire grant',
        delivery_entity: 'Sutherland Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-sutherland',
        project_name: 'Existing data.nsw Sutherland Shire row',
        delivery_entity: 'Sutherland Shire Council',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'northern-beaches-gpfs',
        source_url: 'https://www.northernbeaches.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-northern-beaches-gpfs-1',
        project_name: 'Existing Northern Beaches GPFS row',
        delivery_entity: 'Northern Beaches Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'northern-beaches-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: SUTHERLAND_SHIRE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'data-nsw-ckan'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.natural_key)).toEqual([
      'data-nsw-existing-sutherland',
      'grantconnect:GA-existing-sutherland',
      'prod-existing-aus-tender-sutherland',
    ]);
    expect(existing.map((row) => row.amount_cents)).toEqual([123_456, 502_773_441, 12_345_000]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: SUTHERLAND_SHIRE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: SUTHERLAND_SHIRE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: SUTHERLAND_SHIRE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: SUTHERLAND_SHIRE_GPFS_ID,
        delivery_entity: { $ne: 'Sutherland Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: SUTHERLAND_SHIRE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
