import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  CANTERBURY_BANKSTOWN_GPFS_DELIVERY_ENTITY,
  CANTERBURY_BANKSTOWN_GPFS_FISCAL_YEAR,
  CANTERBURY_BANKSTOWN_GPFS_ID,
  CANTERBURY_BANKSTOWN_GPFS_LICENSE,
  CANTERBURY_BANKSTOWN_GPFS_NAME,
  CANTERBURY_BANKSTOWN_GPFS_PUBLISHER,
  CANTERBURY_BANKSTOWN_GPFS_REPORTING_URL,
  canterburyBankstownGpfsNaturalKey,
  detectCanterburyBankstownGpfsUnit,
  fiscalYearFromCanterburyBankstownGpfsLink,
  parseCanterburyBankstownGpfsExtraction,
  parseCanterburyBankstownGpfsReportLinks,
  selectCanterburyBankstownGpfsDocument,
  type CanterburyBankstownGpfsParseContext,
} from '../src/connectors/canterbury-bankstown-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 4, 5 and 14;
// PDF pages 4, 5 and 14). The income statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after it.
// A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. The printed "Net operating result for the
// year before grants and contributions provided for capital purposes" is
// negative and is kept in reconciliation evidence only (amount_cents >= 0).
const INCOME_TEXT = `Canterbury-Bankstown Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 309,708 Rates and annual charges B2-1 309,533 290,787 21,257 User charges and fees B2-2 25,041 22,072 19,382 Other revenues B2-3 20,626 22,255 20,760 Grants and contributions provided for operating purposes B2-4 22,588 23,931 31,774 Grants and contributions provided for capital purposes B2-4 68,838 48,735 20,875 Interest and investment income B2-5 29,926 18,121 6,975 Other income B2-6 7,436 6,792 430,731 Total income from continuing operations 483,988 432,693 Expenses from continuing operations 177,762 Employee benefits and on-costs B3-1 177,897 167,058 131,706 Materials and services B3-2 116,600 123,453 3,293 Borrowing costs B3-3 1,288 1,101 9,378 Other expenses B3-5 26,464 36,866 – Net loss from the disposal of assets B4-1 6,318 5,733 322,139 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 328,567 334,211 108,592 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 155,421 98,482 96,947 Depreciation, amortisation and impairment of non-financial assets B3-4 101,804 96,916 11,645 Operating result from continuing operations 53,617 1,566 11,645 Net operating result for the year attributable to Council 53,617 1,566 (20,129) Net operating result for the year before grants and contributions provided for capital purposes (15,221) (47,169) The above Income Statement should be read in conjunction with the accompanying notes. Canterbury-Bankstown Council Income Statement for the year ended 30 June 2025 Page 4 of 75`;

const COMPREHENSIVE_TEXT = `Canterbury-Bankstown Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 53,617 1,566 §Subnote§ Other comprehensive income Amounts that will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-6 204,515 184,819 Amounts that will be reclassified subsequent to operating result when specific conditions are met Gain/(loss) on revaluation of financial assets at fair value through other comprehensive income 393 318 Other movements - Voyager Point Footbridge (2,829) – Total other comprehensive income for the year 202,079 185,137 Total comprehensive income for the year attributable to Council 255,696 186,703 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Canterbury-Bankstown Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 75`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Safe and strong 13,068 10,210 21,421 20,358 (8,353) (10,148) 8,637 6,175 59,891 42,165 Clean and green 97,003 87,818 107,438 108,762 (10,435) (20,944) 17,281 10,501 12,337 18,055 Liveable and distinctive 49,007 47,969 34,941 45,179 14,066 2,790 9,178 8,949 – – Moving and integrated 17,538 14,364 86,804 90,208 (69,266) (75,844) 27,612 12,440 2,778,506 2,657,709 Healthy and active 9,749 17,880 84,053 77,700 (74,304) (59,820) 8,127 14,600 1,362,530 1,306,874 Prosperous and innovative 4,498 2,055 7,431 7,333 (2,933) (5,278) 7,328 7,146 12,408 10,307 Leading and engaged 293,125 252,397 88,283 81,587 204,842 170,810 13,263 12,855 788,031 672,632 Total functions and activities 483,988 432,693 430,371 431,127 53,617 1,566 91,426 72,666 5,013,703 4,707,742 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 75 Canterbury-Bankstown Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'e'.repeat(64), bytes: 3_526_499 },
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

const CONTEXT: CanterburyBankstownGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: "Financial Statements 2024-25 and Auditor's Reports PDF (3.36 MB)",
    url: 'https://haveyoursay.cbcity.nsw.gov.au/download_file/7155/2442',
    fiscal_year: CANTERBURY_BANKSTOWN_GPFS_FISCAL_YEAR,
    listing_url: CANTERBURY_BANKSTOWN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/canterbury-bankstown-gpfs/canterbury-bankstown-financial-statements-2024-25.pdf',
    sha256: 'd195790e10452808497fdc0eb95589e751ae6a64a50fc8d076ce467ac0ce8650',
    bytes: 3_526_499,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: CANTERBURY_BANKSTOWN_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseCanterburyBankstownGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Canterbury-Bankstown GPFS source discovery', () => {
  it('discovers the financial-statements page PDF link, never a hard-coded PDF URL', () => {
    const indexHtml = `
      <a href="/your-council/vision-strategy-and-values-csp/202425-annual-report" class="menu__link">2024/25 Annual Report</a>
      <a href="https://haveyoursay.cbcity.nsw.gov.au/download_file/7155/2442" target="_blank" data-fID="7155" class="link mod-reverse">Financial Statements 2024-25 and Auditor's Reports PDF (3.36 MB)</a>
    `;
    const links = parseCanterburyBankstownGpfsReportLinks(
      indexHtml,
      CANTERBURY_BANKSTOWN_GPFS_REPORTING_URL,
    );
    expect(links).toHaveLength(1);
    expect(links[0]!.fiscal_year).toBe('2024-25');
    expect(links[0]!.url).toBe('https://haveyoursay.cbcity.nsw.gov.au/download_file/7155/2442');
    expect(links.some((link) => /annual report/i.test(link.title))).toBe(false);
    const selected = selectCanterburyBankstownGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(CONTEXT.document.url);
    expect(selected.listing_url).toBe(CANTERBURY_BANKSTOWN_GPFS_REPORTING_URL);
    expect(fiscalYearFromCanterburyBankstownGpfsLink('2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromCanterburyBankstownGpfsLink('2024/25 financial statements')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromCanterburyBankstownGpfsLink('2024-2025')).toBe('2024-25');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseCanterburyBankstownGpfsReportLinks(
      '<a href="/download_file/1/2" class="link">Financial Statements 2023-24 and Auditor\'s Reports PDF</a>',
      CANTERBURY_BANKSTOWN_GPFS_REPORTING_URL,
    );
    expect(() => selectCanterburyBankstownGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Canterbury-Bankstown GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCanterburyBankstownGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCanterburyBankstownGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseCanterburyBankstownGpfsExtraction(
      extraction({ income: withoutUnit }),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Canterbury-Bankstown GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the printed totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(483_988);
    expect(reconciliation.total_expenses).toBe(430_371);
    expect(reconciliation.employee_expenses).toBe(177_897);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(101_804);
    expect(reconciliation.government_grants_operating).toBe(22_588);
    expect(reconciliation.government_grants_capital).toBe(68_838);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(6_318);
    expect(reconciliation.net_result).toBe(53_617);
    expect(reconciliation.net_result_before_capital_grants).toBe(-15_221);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(328_567);
    expect(reconciliation.face_expense_bridge).toBe(430_371);
    expect(reconciliation.functions_total_income).toBe(483_988);
    expect(reconciliation.functions_total_expenses).toBe(430_371);
    expect(reconciliation.functions_operating_result).toBe(53_617);
    expect(reconciliation.functions_grants_and_contributions).toBe(91_426);
    expect(reconciliation.comprehensive_income_net_result).toBe(53_617);
    expect(reconciliation.revenue_components_sum).toBe(483_988);
    expect(reconciliation.expense_components_sum).toBe(328_567);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(48_398_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(43_037_100_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(17_789_700_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      10_180_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_258_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(6_883_800_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      631_800_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(5_361_700_000);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: CANTERBURY_BANKSTOWN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: CANTERBURY_BANKSTOWN_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Canterbury-Bankstown Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Canterbury-Bankstown Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^canterbury-bankstown-gpfs:/);
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
      '483,988 432,693 430,371 431,127',
      '483,988 432,693 430,372 431,127',
    );
    const parsed = parseCanterburyBankstownGpfsExtraction(
      extraction({ functions: broken }),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 53,617',
      'from Income Statement 53,618',
    );
    const parsed = parseCanterburyBankstownGpfsExtraction(
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
    const revenue = canterburyBankstownGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = canterburyBankstownGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^canterbury-bankstown-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(canterburyBankstownGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(canterburyBankstownGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_canterburygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CANTERBURY_BANKSTOWN_GPFS_ID,
    name: CANTERBURY_BANKSTOWN_GPFS_NAME,
    publisher: CANTERBURY_BANKSTOWN_GPFS_PUBLISHER,
    source_url: CANTERBURY_BANKSTOWN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CANTERBURY_BANKSTOWN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'canterbury-bankstown-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Canterbury-Bankstown GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: CANTERBURY_BANKSTOWN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        // The existing AusTender contract whose delivery_entity is exactly
        // "Canterbury-Bankstown Council". It must never be summed with the GPFS rows.
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-canterbury-bankstown',
        project_name: 'Existing AusTender Canterbury-Bankstown contract',
        delivery_entity: 'Canterbury-Bankstown Council',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-canterbury-bankstown',
        project_name: 'Existing GrantConnect Canterbury-Bankstown grant',
        delivery_entity: 'Canterbury-Bankstown Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-canterbury-bankstown',
        project_name: 'Existing data.nsw Canterbury-Bankstown row',
        delivery_entity: 'Canterbury-Bankstown Council',
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
    expect(await MeasureModel.countDocuments({ source_id: CANTERBURY_BANKSTOWN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'data-nsw-ckan'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.natural_key)).toEqual([
      'data-nsw-existing-canterbury-bankstown',
      'grantconnect:GA-existing-canterbury-bankstown',
      'prod-existing-aus-tender-canterbury-bankstown',
    ]);
    expect(existing.map((row) => row.amount_cents)).toEqual([123_456, 502_773_441, 12_345_000]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: CANTERBURY_BANKSTOWN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: CANTERBURY_BANKSTOWN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CANTERBURY_BANKSTOWN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CANTERBURY_BANKSTOWN_GPFS_ID,
        delivery_entity: { $ne: 'Canterbury-Bankstown Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({
      source_id: CANTERBURY_BANKSTOWN_GPFS_ID,
    }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
