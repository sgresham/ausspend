import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  BLUE_MOUNTAINS_GPFS_DELIVERY_ENTITY,
  BLUE_MOUNTAINS_GPFS_FISCAL_YEAR,
  BLUE_MOUNTAINS_GPFS_ID,
  BLUE_MOUNTAINS_GPFS_LICENSE,
  BLUE_MOUNTAINS_GPFS_NAME,
  BLUE_MOUNTAINS_GPFS_PUBLISHER,
  BLUE_MOUNTAINS_GPFS_REPORTING_URL,
  blueMountainsGpfsNaturalKey,
  detectBlueMountainsGpfsUnit,
  discoverBlueMountainsGpfsDocument,
  fiscalYearFromBlueMountainsGpfsLink,
  parseBlueMountainsGpfsExtraction,
  parseBlueMountainsGpfsReportPage,
  type BlueMountainsGpfsParseContext,
} from '../src/connectors/blue-mountains-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  BLUE_MOUNTAINS_PDF_BYTES,
  BLUE_MOUNTAINS_PDF_SHA256,
  BLUE_MOUNTAINS_PDF_URL,
  blueMountainsExtraction,
  blueMountainsPage6,
} from '../src/connectors/blue-mountains-gpfs/fixture-data.js';
import { BLUE_MOUNTAINS_GPFS_ROW_COUNT } from '../src/connectors/blue-mountains-gpfs/fixture.js';

// Blue Mountains' official document page links the "Annual Financial Statements
// 2024-2025" PDF directly. Its Income Statement prints the Original unaudited
// budget column first, the FY2024-25 Actual column second and the FY2023-24
// column third, each row's label and amounts on the same printed line.
// FY2024-25 has no discontinued operation, so the printed operating result and
// net result are the same. The B1-1 function expense split is a second cut of
// the same printed total expenses.

const CONTEXT: BlueMountainsGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Blue Mountains City Council Financial Statements 2024-25',
    url: BLUE_MOUNTAINS_PDF_URL,
    fiscal_year: BLUE_MOUNTAINS_GPFS_FISCAL_YEAR,
    listing_url: BLUE_MOUNTAINS_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/blue-mountains-gpfs/blue-mountains-city-council-financial-statements-2024-25.pdf',
    sha256: BLUE_MOUNTAINS_PDF_SHA256,
    bytes: BLUE_MOUNTAINS_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: BLUE_MOUNTAINS_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseBlueMountainsGpfsExtraction(blueMountainsExtraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

function mutatePage(page: PdfPage, from: string, to: string): PdfPage {
  return {
    ...page,
    text: page.text.split(from).join(to),
    items: page.items.map((entry) => (entry.str === from ? { ...entry, str: to } : entry)),
  };
}

function extractionWith(pageNumber: number, mutate: (page: PdfPage) => PdfPage): PdfExtraction {
  const base = blueMountainsExtraction();
  const pages = base.pages.map((page) => (page.page_number === pageNumber ? mutate(page) : page));
  return { ...base, pages, text: pages.map((page) => page.text).join('\n') };
}

describe('Blue Mountains City Council GPFS source discovery', () => {
  const pageHtml = `
    <h1>Annual Financial Statements 2024-2025</h1>
    <a href="/sites/default/files/docs/BMCC%20Annual%20Financial%20Statements%202024-2025.PDF">BMCC Annual Financial Statements 2024-2025.PDF</a>
  `;

  it('discovers the FY2024-25 statements from the official document page, not a hard-coded PDF URL', () => {
    expect(
      parseBlueMountainsGpfsReportPage(pageHtml, BLUE_MOUNTAINS_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: BLUE_MOUNTAINS_PDF_URL,
      title:
        'Blue Mountains City Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    });
    expect(
      fiscalYearFromBlueMountainsGpfsLink('BMCC Annual Financial Statements 2024-2025.PDF'),
    ).toBe('2024-25');
    expect(fiscalYearFromBlueMountainsGpfsLink('Financial Statements 2023/24')).toBe('2023-24');
  });

  it('resolves the PDF through the official document HTML', async () => {
    const discovered = await discoverBlueMountainsGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: pageHtml,
    });
    expect(discovered.title).toBe(
      'Blue Mountains City Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    );
    expect(discovered.url).toBe(BLUE_MOUNTAINS_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(BLUE_MOUNTAINS_GPFS_REPORTING_URL);
  });

  it('does not select a prior-year statement', () => {
    expect(
      parseBlueMountainsGpfsReportPage(
        `<a href="/sites/default/files/docs/BMCC%20Annual%20Financial%20Statements%202023-2024.PDF">2023-2024</a>`,
        BLUE_MOUNTAINS_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a statements link on a non-council host', () => {
    expect(
      parseBlueMountainsGpfsReportPage(
        `<a href="https://example.com/BMCC%20Annual%20Financial%20Statements%202024-2025.PDF">pdf</a>`,
        BLUE_MOUNTAINS_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Blue Mountains City Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBlueMountainsGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBlueMountainsGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = mutatePage(blueMountainsPage6(), "$ '000", '');
    const base = blueMountainsExtraction();
    const pages = base.pages.map((page) => (page.page_number === 6 ? withoutUnit : page));
    const parsed = parseBlueMountainsGpfsExtraction(
      { ...base, pages, text: pages.map((page) => page.text).join('\n') },
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Blue Mountains City Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and note B3-4 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(BLUE_MOUNTAINS_GPFS_ROW_COUNT);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(185_382);
    expect(reconciliation.total_expenses).toBe(160_024);
    expect(reconciliation.employee_expenses).toBe(78_134);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(21_298);
    expect(reconciliation.government_grants_operating).toBe(16_417);
    expect(reconciliation.government_grants_capital).toBe(36_045);
    expect(reconciliation.borrowing_costs).toBe(1_341);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(1_496);
    expect(reconciliation.operating_result_continuing).toBe(25_358);
    expect(reconciliation.net_result).toBe(25_358);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(46_656);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(138_726);
    expect(reconciliation.revenue_components_sum).toBe(185_382);
    expect(reconciliation.expense_components_sum).toBe(138_726);
    expect(reconciliation.face_expense_bridge).toBe(160_024);
    expect(reconciliation.functions_total_income).toBe(185_382);
    expect(reconciliation.functions_total_expenses).toBe(160_024);
    expect(reconciliation.functions_operating_result).toBe(25_358);
    expect(reconciliation.functions_grants_and_contributions).toBe(52_462);
    expect(reconciliation.functions_expense_split_sum).toBe(160_024);
    expect(reconciliation.comprehensive_income_net_result).toBe(25_358);
    expect(reconciliation.comprehensive_income_other).toBe(20_904);
    expect(reconciliation.comprehensive_income_total).toBe(46_262);
    expect(reconciliation.depreciation_impairment_note_total).toBe(21_298);
    expect(reconciliation.income_statement_page).toBe(6);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.comprehensive_income_page).toBe(7);
    expect(reconciliation.depreciation_note_page).toBe(26);
    expect(reconciliation.checks.length).toBeGreaterThan(10);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(18_538_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(16_002_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(7_813_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_129_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_641_700_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(3_604_500_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(134_100_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      149_600_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(2_535_800_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      13_872_600_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(9_912_400_000);
    expect(
      recordByLine(records, 'b1_1_function_expenses_lead_inspiring_leadership').amount_cents,
    ).toBe(4_374_400_000);
  });

  it('emits only printed categories: components point at their printed subtotal and there is no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'b1_1_function_expenses_care_an_inclusive_healthy_and_vibrant_city',
        'b1_1_function_expenses_lead_inspiring_leadership',
        'b1_1_function_expenses_live_a_liveable_city',
        'b1_1_function_expenses_move_an_accessible_city',
        'b1_1_function_expenses_protect_an_environmentally_responsible_eco_city',
        'b1_1_function_expenses_thrive_an_economically_sustainable_city',
        'borrowing_costs',
        'depreciation_amortisation_impairment',
        'employee_expenses',
        'government_grants_capital',
        'government_grants_operating',
        'interest_and_investment_income',
        'materials_and_services',
        'net_loss_from_disposal_of_assets',
        'net_result',
        'other_expenses',
        'other_income',
        'other_revenues',
        'rates_and_annual_charges',
        'total_expenses',
        'total_expenses_excluding_depreciation',
        'total_revenue',
        'user_charges_and_fees',
      ].sort(),
    );
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: BLUE_MOUNTAINS_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: BLUE_MOUNTAINS_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Blue Mountains City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Blue Mountains City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^blue-mountains-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'employee_expenses').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'depreciation_amortisation_impairment').gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(
      recordByLine(records, 'b1_1_function_expenses_lead_inspiring_leadership').gpfs_component_of,
    ).toBe('b1_1_total_expenses');
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const parsed = parseBlueMountainsGpfsExtraction(
      extractionWith(15, (page) => mutatePage(page, '160,024', '160,124')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const parsed = parseBlueMountainsGpfsExtraction(
      extractionWith(6, (page) => mutatePage(page, '99,124', '99,024')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a B1-1 function expense row no longer sums to the total', () => {
    const parsed = parseBlueMountainsGpfsExtraction(
      extractionWith(15, (page) => mutatePage(page, '43,744', '43,644')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const parsed = parseBlueMountainsGpfsExtraction(
      extractionWith(7, (page) => mutatePage(page, '46,262', '46,362')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-4 depreciation no longer bridges', () => {
    const parsed = parseBlueMountainsGpfsExtraction(
      extractionWith(26, (page) => mutatePage(page, '21,298', '21,398')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('is deterministic and derives stable, line-specific natural keys', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
    const url = CONTEXT.document.url;
    const revenue = blueMountainsGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = blueMountainsGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^blue-mountains-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(blueMountainsGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(blueMountainsGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_bluemountainsgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BLUE_MOUNTAINS_GPFS_ID,
    name: BLUE_MOUNTAINS_GPFS_NAME,
    publisher: BLUE_MOUNTAINS_GPFS_PUBLISHER,
    source_url: BLUE_MOUNTAINS_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BLUE_MOUNTAINS_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'blue-mountains-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Blue Mountains City Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BLUE_MOUNTAINS_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-blue-mountains-city-council-existing-1',
        project_name:
          'Existing GrantConnect grant under the exact string Blue Mountains City Council',
        delivery_entity: 'Blue Mountains City Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-BLUE-MOUNTAINS-CITY-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase BLUE MOUNTAINS CITY COUNCIL',
        delivery_entity: 'BLUE MOUNTAINS CITY COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-blue-mountains-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Blue Mountains Community Services Incorporated',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'ku-ring-gai-gpfs',
        source_url: 'https://www.krg.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-ku-ring-gai-gpfs-1',
        project_name: 'Existing Ku-ring-gai Council GPFS row',
        delivery_entity: 'Ku-ring-gai Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-blue-mountains-project',
        project_name: 'Existing NSW Budget project whose name mentions Blue Mountains',
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
    const before = await MeasureModel.countDocuments({});

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'ku-ring-gai-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: BLUE_MOUNTAINS_GPFS_ID })).toBe(
      BLUE_MOUNTAINS_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(before + BLUE_MOUNTAINS_GPFS_ROW_COUNT);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BLUE_MOUNTAINS_GPFS_ID })).toBe(
      BLUE_MOUNTAINS_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(before + BLUE_MOUNTAINS_GPFS_ROW_COUNT);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Blue Mountains City Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'BLUE MOUNTAINS CITY COUNCIL',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: 'Blue Mountains City Council' }),
    ).toBe(BLUE_MOUNTAINS_GPFS_ROW_COUNT + 1);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^blue mountains city council$/i }),
    ).toBe(BLUE_MOUNTAINS_GPFS_ROW_COUNT + 2);

    expect(
      await MeasureModel.countDocuments({
        source_id: BLUE_MOUNTAINS_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BLUE_MOUNTAINS_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BLUE_MOUNTAINS_GPFS_ID,
        delivery_entity: { $ne: 'Blue Mountains City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BLUE_MOUNTAINS_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(BLUE_MOUNTAINS_GPFS_ROW_COUNT);
  });
});
