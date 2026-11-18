import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  NORTHERN_BEACHES_GPFS_FISCAL_YEAR,
  NORTHERN_BEACHES_GPFS_ID,
  NORTHERN_BEACHES_GPFS_LICENSE,
  NORTHERN_BEACHES_GPFS_NAME,
  NORTHERN_BEACHES_GPFS_PUBLISHER,
  NORTHERN_BEACHES_GPFS_REPORTING_URL,
  detectNorthernBeachesGpfsUnit,
  fiscalYearFromNorthernBeachesGpfsLink,
  northernBeachesGpfsNaturalKey,
  parseNorthernBeachesGpfsExtraction,
  parseNorthernBeachesGpfsReportLinks,
  selectNorthernBeachesGpfsDocument,
  type NorthernBeachesGpfsParseContext,
} from '../src/connectors/northern-beaches-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 19, 20 and
// 29; PDF pages 20, 21 and 30). The income statement prints the Original
// unaudited budget column *before* the label, so a parser that took the first
// number in the line would read the budget; the expected values are all Actual
// 2025. The printed "Net gain from the disposal of assets" revenue line is a
// nil dash; the printed "Net loss from the disposal of assets" expense line is
// a non-zero $532 thousand.
const INCOME_TEXT = `Northern Beaches Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 259,113 Rates and annual charges B2-1 259,800 246,432 101,855 User charges and fees B2-2 104,477 99,931 20,684 Other revenues B2-3 25,015 21,620 22,502 Grants and contributions provided for operating purposes B2-4 24,526 26,529 32,343 Grants and contributions provided for capital purposes B2-4 44,330 29,218 8,411 Interest and investment income B2-5 11,739 11,083 6,785 Other income B2-6 7,664 6,915 392 Net gain from the disposal of assets B4-1 – – 452,085 Total income from continuing operations 477,551 441,728 Expenses from continuing operations 170,968 Employee benefits and on-costs B3-1 166,906 159,331 177,881 Materials and services B3-2 172,188 163,471 2,436 Borrowing costs B3-3 2,565 2,689 21,431 Other expenses B3-5 20,397 22,569 – Net loss from the disposal of assets B4-1 532 545 372,716 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 362,588 348,605 79,369 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 114,963 93,123 52,149 Depreciation, amortisation and impairment of non-financial assets B3-4 53,471 48,975 27,220 Operating result from continuing operations 61,492 44,148 27,220 Net operating result for the year 61,492 44,148 133 Net operating result attributable to non-controlling interests 204 191 (5,123) Net operating result for the year before grants and contributions provided for capital purposes 17,162 14,930 The above Income Statement should be read in conjunction with the accompanying notes. Northern Beaches Council Income Statement for the year ended 30 June 2025 Page 19`;

const COMPREHENSIVE_TEXT = `Northern Beaches Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 61,492 44,148 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-6 272,878 209,178 Total other comprehensive income for the year 272,878 209,178 Total comprehensive income for the year 334,370 253,326 Total comprehensive income attributable to Council 334,166 253,135 Total comprehensive income attributable to non-controlling interests 204 191 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Northern Beaches Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 20`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Environment and sustainability 24,542 8,783 42,303 42,641 (17,761) (33,858) 19,462 4,242 994,336 956,220 Waste and cleansing 62,132 58,774 72,281 67,947 (10,149) (9,173) 367 347 21,015 19,448 Total functions and activities 4 478,940 442,278 417,448 398,130 61,492 44,148 68,856 55,747 6,227,926 5,888,866 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Northern Beaches Council | Notes to the Financial Statements 30 June 2025 Page 29`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'e'.repeat(64), bytes: 2_106_256 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 20),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 21),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 30),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: NorthernBeachesGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024/25',
    url: 'https://www.northernbeaches.nsw.gov.au/media/69522?1794917647',
    fiscal_year: NORTHERN_BEACHES_GPFS_FISCAL_YEAR,
    listing_url: NORTHERN_BEACHES_GPFS_REPORTING_URL,
    resolved_url:
      'https://www.northernbeaches.nsw.gov.au/sites/default/files/media/files/2025-11/financial-statements-202425.pdf?1794917679',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/northern-beaches-gpfs/northern-beaches-financial-statements-2024-25.pdf',
    sha256: '58f68d6fa2a8487ed66f532c0f2c3432ac41fff227d1892b9518c76af952faf6',
    bytes: 2_106_256,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: NORTHERN_BEACHES_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseNorthernBeachesGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Northern Beaches GPFS source discovery', () => {
  it('discovers the annual-report page PDF link, never a hard-coded PDF URL', () => {
    const indexHtml = `
      <a href="/council/publications/annual-report" class="menu__link is-active">Annual report</a>
      <a href="/media/69523?1794917647" class="pdf" target="_blank">Annual Report 2024/25</a>
      <a href="/media/69522?1794917647" class="pdf" target="_blank">Financial Statements 2024/25</a>
      <a href="/council/publications/former-councils/annual-reports">Former council annual reports</a>
    `;
    const links = parseNorthernBeachesGpfsReportLinks(
      indexHtml,
      NORTHERN_BEACHES_GPFS_REPORTING_URL,
    );
    expect(links).toHaveLength(1);
    expect(links[0]!.fiscal_year).toBe('2024-25');
    expect(links[0]!.url).toBe('https://www.northernbeaches.nsw.gov.au/media/69522?1794917647');
    expect(links.some((link) => /annual report/i.test(link.title))).toBe(false);
    const selected = selectNorthernBeachesGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(CONTEXT.document.url);
    expect(selected.listing_url).toBe(NORTHERN_BEACHES_GPFS_REPORTING_URL);
    expect(fiscalYearFromNorthernBeachesGpfsLink('2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromNorthernBeachesGpfsLink('2024/25 financial statements')).toBe('2024-25');
    expect(fiscalYearFromNorthernBeachesGpfsLink('2024-2025')).toBe('2024-25');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseNorthernBeachesGpfsReportLinks(
      '<a href="/media/1" class="pdf">Financial Statements 2023/24</a>',
      NORTHERN_BEACHES_GPFS_REPORTING_URL,
    );
    expect(() => selectNorthernBeachesGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Northern Beaches GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectNorthernBeachesGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectNorthernBeachesGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseNorthernBeachesGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Northern Beaches GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the printed totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(18);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(477_551);
    expect(reconciliation.total_expenses).toBe(416_059);
    expect(reconciliation.employee_expenses).toBe(166_906);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(53_471);
    expect(reconciliation.government_grants_operating).toBe(24_526);
    expect(reconciliation.government_grants_capital).toBe(44_330);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(532);
    expect(reconciliation.net_result).toBe(61_492);
    expect(reconciliation.net_result_before_capital_grants).toBe(17_162);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(362_588);
    expect(reconciliation.face_expense_bridge).toBe(416_059);
    expect(reconciliation.functions_total_income).toBe(478_940);
    expect(reconciliation.functions_total_expenses).toBe(417_448);
    expect(reconciliation.functions_operating_result).toBe(61_492);
    expect(reconciliation.functions_grants_and_contributions).toBe(68_856);
    expect(reconciliation.disposal_gross_up).toBe(1_389);
    expect(reconciliation.comprehensive_income_net_result).toBe(61_492);
    expect(reconciliation.revenue_components_sum).toBe(477_551);
    expect(reconciliation.expense_components_sum).toBe(362_588);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(47_755_100_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(41_605_900_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(16_690_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      5_347_100_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_452_600_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(4_433_000_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(53_200_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(6_149_200_000);
    expect(recordByLine(records, 'net_result_before_capital_grants').amount_cents).toBe(
      1_716_200_000,
    );
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: NORTHERN_BEACHES_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'Northern Beaches Council',
        source_dataset: 'Northern Beaches Council GPFS 2024-25',
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
      expect(record.natural_key).toMatch(/^northern-beaches-gpfs:/);
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

    // Every output row is agency detail, so neither the API nor an area panel can
    // add it to any other council or state row.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace(
      '478,940 442,278 417,448 398,130',
      '478,940 442,278 417,449 398,130',
    );
    const parsed = parseNorthernBeachesGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 61,492',
      'from Income Statement 61,493',
    );
    const parsed = parseNorthernBeachesGpfsExtraction(
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
    const revenue = northernBeachesGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = northernBeachesGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^northern-beaches-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(northernBeachesGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(northernBeachesGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_northernbeachesgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: NORTHERN_BEACHES_GPFS_ID,
    name: NORTHERN_BEACHES_GPFS_NAME,
    publisher: NORTHERN_BEACHES_GPFS_PUBLISHER,
    source_url: NORTHERN_BEACHES_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: NORTHERN_BEACHES_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'northern-beaches-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Northern Beaches GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: NORTHERN_BEACHES_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        // The existing AusTender contract whose delivery_entity happens to be
        // "Northern Beaches Council". It must never be summed with the GPFS rows.
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-northern-beaches',
        project_name: 'Existing AusTender Northern Beaches contract',
        delivery_entity: 'Northern Beaches Council',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-northern-beaches',
        project_name: 'Existing GrantConnect Northern Beaches grant',
        delivery_entity: 'Northern Beaches Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-northern-beaches',
        project_name: 'Existing data.nsw Northern Beaches row',
        delivery_entity: 'Northern Beaches Council',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'parramatta-gpfs',
        source_url: 'https://www.cityofparramatta.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-parramatta-gpfs-1',
        project_name: 'Existing Parramatta GPFS row',
        delivery_entity: 'City of Parramatta',
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
    expect(await MeasureModel.countDocuments({ source_id: 'parramatta-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: NORTHERN_BEACHES_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'data-nsw-ckan'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.natural_key)).toEqual([
      'data-nsw-existing-northern-beaches',
      'grantconnect:GA-existing-northern-beaches',
      'prod-existing-aus-tender-northern-beaches',
    ]);
    expect(existing.map((row) => row.amount_cents)).toEqual([123_456, 502_773_441, 12_345_000]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: NORTHERN_BEACHES_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: NORTHERN_BEACHES_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NORTHERN_BEACHES_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NORTHERN_BEACHES_GPFS_ID,
        delivery_entity: { $ne: 'Northern Beaches Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: NORTHERN_BEACHES_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
