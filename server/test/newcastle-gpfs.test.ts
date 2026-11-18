import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  NEWCASTLE_GPFS_DELIVERY_ENTITY,
  NEWCASTLE_GPFS_FISCAL_YEAR,
  NEWCASTLE_GPFS_ID,
  NEWCASTLE_GPFS_LICENSE,
  NEWCASTLE_GPFS_NAME,
  NEWCASTLE_GPFS_PUBLISHER,
  NEWCASTLE_GPFS_REPORTING_URL,
  detectNewcastleGpfsUnit,
  fiscalYearFromNewcastleGpfsLink,
  parseNewcastleGpfsExtraction,
  parseNewcastleGpfsReportLinks,
  selectNewcastleGpfsDocument,
  newcastleGpfsNaturalKey,
  type NewcastleGpfsParseContext,
} from '../src/connectors/newcastle-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 5, 6 and 16;
// PDF pages 6, 7 and 17). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after it.
// A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. Both the net result and the printed
// before-capital result are positive.
const INCOME_TEXT = `Newcastle City Council | Income Statement | for the year ended 30 June 2025 §Statement§  Original unaudited budget   Actual  Restated Actual  2025   2025   2024  $ '000   Notes   $ '000   $ '000  Income from continuing operations  232,264   Rates and annual charges   B2-1   232,754   219,124 124,293   User charges and fees   *   B2-2   108,535   111,375 11,501   Other revenue   B2-3   13,123   12,066 24,075   Grants and contributions provided for operating purposes   B2-4   21,222   20,713 43,782   Grants and contributions provided for capital purposes   B2-4   89,603   46,379 14,517   Interest and investment income   B2-5   21,817   16,278 13,306   Other income   *   B2-6   10,648   13,256  463,738   Total income from continuing operations   497,702   439,191  Expenses from continuing operations  146,514   Employee benefits and on-costs   B3-1   149,707   136,777 122,371   Materials and services   ^   B3-2   109,702   112,333 5,410   Borrowing costs   B3-3   6,012   5,455 58,728   Other expenses   B3-5   49,868   53,875 9,697   Net loss from the disposal of assets   ^   B4-1   12,132   12,404  342,720  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   327,421   320,844 121,018  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   170,281   118,347  73,173 Depreciation, amortisation and impairment of non-financial assets   ^   B3-4   71,942   68,390  47,845   Operating result from continuing operations   98,339   49,957  47,845   Net operating result for the year attributable to Council   98,339   49,957  4,063  Net operating result for the year before grants and contributions provided for capital purposes   8,736   3,578  The above Income Statement should be read in conjunction with the accompanying notes.  (*)   Comparatives have been reclassified. Refer Note A1-1  (^)   Comparatives have been changed to reflect prior period adjustments. Refer Note G4-1  Newcastle City Council Income Statement  for the year ended 30 June 2025 Page 5`;

const COMPREHENSIVE_TEXT = `Newcastle City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ §Subnote§ Restated 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 98,339 49,957 Other comprehensive income: Amounts that will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-7 1,002,099 83,477 Impairment reversal (loss) on infrastructure, property, plant and equipment B3-4,C1-7 885 49 Total items that will not be reclassified subsequent to operating result 1,002,984 83,526 Amounts that will be reclassified subsequent to operating result when specific conditions are met Gain/(loss) on hedging instruments C1-11 (1,482) (122) Other movements – (1) Total items that will be reclassified subsequent to operating result when specific conditions are met (1,482) (123) Other comprehensive income for the year 1,001,502 83,403 Total comprehensive income for the year attributable to Council 1,099,841 133,360 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Newcastle City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating results Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Restated Restated Restated $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Liveable 115,564 54,661 136,872 130,943 (21,308) (76,282) 81,364 23,320 2,540,837 1,433,394 Sustainable 95,117 100,865 102,087 103,155 (6,970) (2,290) 421 3,396 85,755 94,917 Creative 63,707 69,937 79,192 73,950 (15,485) (4,013) 19,810 28,441 525,550 483,721 Achieving Together 223,314 213,728 81,212 81,186 142,102 132,542 9,230 11,935 782,693 743,907 Total functions and activities 497,702 439,191 399,363 389,234 98,339 49,957 110,825 67,092 3,934,835 2,755,939 Page 16 Newcastle City Council | Notes to the Financial Statements 30 June 2025`;

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
  'https://newcastle.nsw.gov.au/getmedia/4bba4207-e815-43df-a8db-c09f6f94fc7e/Newcastle-City-Council-Financial-Statements-2024-25.pdf';

const CONTEXT: NewcastleGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: '2024/2025 Financial Statements (PDF, 3.4 MB)',
    url: PDF_URL,
    fiscal_year: NEWCASTLE_GPFS_FISCAL_YEAR,
    listing_url: NEWCASTLE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/newcastle-gpfs/Newcastle-City-Council-Financial-Statements-2024-25.pdf',
    sha256: 'ed415f31b8b57358ce2f3be2dbbd8193edab74fc3be4b6df3cf3e3d4b80a24cc',
    bytes: 3_484_233,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: NEWCASTLE_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseNewcastleGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Newcastle GPFS source discovery', () => {
  it('discovers the FY2024-25 financial report from the official page, not a hard-coded URL', () => {
    const indexHtml = `
      <a href="/getmedia/72b4cafc-b803-4919-bada-9f66582ccfae/Newcastle-City-Council-Financial-Statements-2025-26.pdf">2025/2026 Financial Statements PDF</a>
      <a href="https://newcastle.nsw.gov.au/getmedia/4bba4207-e815-43df-a8db-c09f6f94fc7e/Newcastle-City-Council-Financial-Statements-2024-25.pdf">2024/2025 Financial Statements (PDF, 3.4 MB)</a>
      <a href="/getmedia/e7f35dd5-c928-47d8-a705-4da1ddbc7ec9/Annual-Financial-Statements-2024-(Final)-Newcastle-City-Council.pdf">2023/2024 Financial Statements (PDF, 8.1 MB)</a>
      <a href="/getmedia/24488f3d-2f7b-4b59-8a25-804962629321/Delivering-Newcastle-2040-2024-25_1.pdf">2024/2025 Delivering Newcastle 2040 (PDF, 19.8 MB)</a>
    `;
    const links = parseNewcastleGpfsReportLinks(indexHtml, NEWCASTLE_GPFS_REPORTING_URL);
    const fy2425 = links.filter((link) => link.fiscal_year === '2024-25');
    expect(fy2425).toHaveLength(1);
    expect(fy2425[0]!.url).toBe(PDF_URL);
    expect(fy2425[0]!.listing_url).toBe(NEWCASTLE_GPFS_REPORTING_URL);
    const selected = selectNewcastleGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(PDF_URL);
    expect(fiscalYearFromNewcastleGpfsLink('2024/2025 Financial Statements')).toBe('2024-25');
    expect(fiscalYearFromNewcastleGpfsLink('2024-2025')).toBe('2024-25');
    expect(
      fiscalYearFromNewcastleGpfsLink('Newcastle-City-Council-Financial-Statements-2024-25.pdf'),
    ).toBe('2024-25');
    expect(fiscalYearFromNewcastleGpfsLink('2023/2024 Financial Statements')).toBe('2023-24');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseNewcastleGpfsReportLinks(
      '<a href="/getmedia/e7f35dd5-c928-47d8-a705-4da1ddbc7ec9/Annual-Financial-Statements-2024-(Final)-Newcastle-City-Council.pdf">2023/2024 Financial Statements (PDF, 8.1 MB)</a>',
      NEWCASTLE_GPFS_REPORTING_URL,
    );
    expect(() => selectNewcastleGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Newcastle GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectNewcastleGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectNewcastleGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseNewcastleGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Newcastle GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the printed totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(497_702);
    expect(reconciliation.total_expenses).toBe(399_363);
    expect(reconciliation.employee_expenses).toBe(149_707);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(71_942);
    expect(reconciliation.government_grants_operating).toBe(21_222);
    expect(reconciliation.government_grants_capital).toBe(89_603);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(12_132);
    expect(reconciliation.net_result).toBe(98_339);
    expect(reconciliation.net_result_before_capital_grants).toBe(8_736);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(327_421);
    expect(reconciliation.face_expense_bridge).toBe(399_363);
    expect(reconciliation.functions_total_income).toBe(497_702);
    expect(reconciliation.functions_total_expenses).toBe(399_363);
    expect(reconciliation.functions_operating_result).toBe(98_339);
    expect(reconciliation.functions_grants_and_contributions).toBe(110_825);
    expect(reconciliation.comprehensive_income_net_result).toBe(98_339);
    expect(reconciliation.revenue_components_sum).toBe(497_702);
    expect(reconciliation.expense_components_sum).toBe(327_421);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(49_770_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(39_936_300_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(14_970_700_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      7_194_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_122_200_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(8_960_300_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      1_213_200_000,
    );
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(9_833_900_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: NEWCASTLE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: NEWCASTLE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Newcastle City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Newcastle City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^newcastle-gpfs:/);
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
      '497,702 439,191 399,363 389,234',
      '497,702 439,191 399,362 389,234',
    );
    const parsed = parseNewcastleGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 98,339',
      'from Income Statement 98,338',
    );
    const parsed = parseNewcastleGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = newcastleGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = newcastleGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^newcastle-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(newcastleGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(newcastleGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_newcastlegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: NEWCASTLE_GPFS_ID,
    name: NEWCASTLE_GPFS_NAME,
    publisher: NEWCASTLE_GPFS_PUBLISHER,
    source_url: NEWCASTLE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: NEWCASTLE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'newcastle-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Newcastle GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: NEWCASTLE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-newcastle',
        project_name: 'Existing AusTender Newcastle City contract',
        delivery_entity: 'NEWCASTLE CITY COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-newcastle',
        project_name: 'Existing GrantConnect Newcastle City grant',
        delivery_entity: 'Newcastle City Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-newcastle-school',
        project_name: 'Existing data.nsw Newcastle school row (not a council row)',
        delivery_entity: 'Newcastle High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-newcastle-charity',
        project_name: 'Existing ACNC Newcastle charity row (not the council)',
        delivery_entity: 'Newcastle Pride Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: NEWCASTLE_GPFS_ID })).toBe(17);
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
    expect(await MeasureModel.countDocuments({ source_id: NEWCASTLE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: NEWCASTLE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NEWCASTLE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NEWCASTLE_GPFS_ID,
        delivery_entity: { $ne: 'Newcastle City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: NEWCASTLE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
