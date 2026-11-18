import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  CAMPBELLTOWN_GPFS_DELIVERY_ENTITY,
  CAMPBELLTOWN_GPFS_FISCAL_YEAR,
  CAMPBELLTOWN_GPFS_ID,
  CAMPBELLTOWN_GPFS_LICENSE,
  CAMPBELLTOWN_GPFS_NAME,
  CAMPBELLTOWN_GPFS_PUBLISHER,
  CAMPBELLTOWN_GPFS_REPORTING_URL,
  campbelltownGpfsNaturalKey,
  detectCampbelltownGpfsUnit,
  discoverCampbelltownGpfsDocument,
  fiscalYearFromCampbelltownGpfsLink,
  parseCampbelltownGpfsExtraction,
  parseCampbelltownGpfsReportPage,
  type CampbelltownGpfsParseContext,
} from '../src/connectors/campbelltown-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  CAMPBELLTOWN_PDF_BYTES,
  CAMPBELLTOWN_PDF_SHA256,
  CAMPBELLTOWN_PDF_URL,
  campbelltownExtraction,
  campbelltownPage8,
} from '../src/connectors/campbelltown-gpfs/fixture-data.js';
import { CAMPBELLTOWN_GPFS_ROW_COUNT } from '../src/connectors/campbelltown-gpfs/fixture.js';

// Campbelltown's official financial-information page links the "Financial
// Statements 2024-25" PDF directly. Its Income Statement prints the Original
// unaudited budget column first, the FY2024-25 Actual column second and the
// FY2023-24 column third, each row's label and amounts on the same printed
// line. FY2024-25 has no discontinued operation, so the printed continuing
// operating result and the net result repeated in comprehensive income are the
// same. The B1-1 objective expense split is a second cut of the same printed
// total expenses.

const CONTEXT: CampbelltownGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Campbelltown City Council Financial Statements 2024-25',
    url: CAMPBELLTOWN_PDF_URL,
    fiscal_year: CAMPBELLTOWN_GPFS_FISCAL_YEAR,
    listing_url: CAMPBELLTOWN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/campbelltown-gpfs/campbelltown-city-council-financial-statements-2024-25.pdf',
    sha256: CAMPBELLTOWN_PDF_SHA256,
    bytes: CAMPBELLTOWN_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: CAMPBELLTOWN_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseCampbelltownGpfsExtraction(campbelltownExtraction(), CONTEXT);
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
  const base = campbelltownExtraction();
  const pages = base.pages.map((page) => (page.page_number === pageNumber ? mutate(page) : page));
  return { ...base, pages, text: pages.map((page) => page.text).join('\n') };
}

describe('Campbelltown City Council GPFS source discovery', () => {
  const pageHtml = `
    <h1>Financial information</h1>
    <a href="/files/sharedassets/public/v/1/council-and-councillors/documents/2023-24-financial-statements_final-reduced-size.pdf">2023-24 financial statements</a>
    <a href="/files/sharedassets/public/v/1/council-and-councillors/documents/rates-forms-and-policies/fees-and-charges-2026-27.pdf">fees and charges</a>
    <a href="/files/sharedassets/public/v/1/council-and-councillors/documents/2024-25-financial-statements_final.pdf">2024-25 financial statements</a>
  `;

  it('discovers the FY2024-25 statements from the official financial-information page, not a hard-coded PDF URL', () => {
    expect(
      parseCampbelltownGpfsReportPage(pageHtml, CAMPBELLTOWN_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: CAMPBELLTOWN_PDF_URL,
      title:
        'Campbelltown City Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    });
    expect(fiscalYearFromCampbelltownGpfsLink('2024-25-financial-statements_final.pdf')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromCampbelltownGpfsLink('Financial Statements 2023/24')).toBe('2023-24');
  });

  it('resolves the PDF through the official financial-information HTML', async () => {
    const discovered = await discoverCampbelltownGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: pageHtml,
    });
    expect(discovered.title).toBe(
      'Campbelltown City Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    );
    expect(discovered.url).toBe(CAMPBELLTOWN_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(CAMPBELLTOWN_GPFS_REPORTING_URL);
  });

  it('does not select a prior-year statement', () => {
    expect(
      parseCampbelltownGpfsReportPage(
        `<a href="/files/docs/2023-24-financial-statements.pdf">2023-24</a>`,
        CAMPBELLTOWN_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a statements link on a non-council host', () => {
    expect(
      parseCampbelltownGpfsReportPage(
        `<a href="https://example.com/2024-25-financial-statements.pdf">pdf</a>`,
        CAMPBELLTOWN_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Campbelltown City Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCampbelltownGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCampbelltownGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = mutatePage(campbelltownPage8(), '$’000', '');
    const base = campbelltownExtraction();
    const pages = base.pages.map((page) => (page.page_number === 8 ? withoutUnit : page));
    const parsed = parseCampbelltownGpfsExtraction(
      { ...base, pages, text: pages.map((page) => page.text).join('\n') },
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Campbelltown City Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and note B3-3 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(CAMPBELLTOWN_GPFS_ROW_COUNT);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(306_751);
    expect(reconciliation.total_expenses).toBe(243_664);
    expect(reconciliation.employee_expenses).toBe(101_228);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(39_290);
    expect(reconciliation.government_grants_operating).toBe(30_952);
    expect(reconciliation.government_grants_capital).toBe(67_872);
    expect(reconciliation.borrowing_costs).toBe(280);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(2_748);
    expect(reconciliation.operating_result_continuing).toBe(63_087);
    expect(reconciliation.net_result).toBe(63_087);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(102_377);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(204_374);
    expect(reconciliation.revenue_components_sum).toBe(306_751);
    expect(reconciliation.expense_components_sum).toBe(204_374);
    expect(reconciliation.face_expense_bridge).toBe(243_664);
    expect(reconciliation.functions_total_income).toBe(306_751);
    expect(reconciliation.functions_total_expenses).toBe(243_664);
    expect(reconciliation.functions_operating_result).toBe(63_087);
    expect(reconciliation.functions_grants_and_contributions).toBe(98_824);
    expect(reconciliation.functions_expense_split_sum).toBe(243_664);
    expect(reconciliation.comprehensive_income_net_result).toBe(63_087);
    expect(reconciliation.comprehensive_income_other).toBe(263);
    expect(reconciliation.comprehensive_income_total).toBe(63_350);
    expect(reconciliation.depreciation_impairment_note_total).toBe(39_290);
    expect(reconciliation.income_statement_page).toBe(8);
    expect(reconciliation.functions_page).toBe(19);
    expect(reconciliation.comprehensive_income_page).toBe(9);
    expect(reconciliation.depreciation_note_page).toBe(28);
    expect(reconciliation.checks.length).toBeGreaterThan(10);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(30_675_100_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(24_366_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(10_122_800_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      3_929_000_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(3_095_200_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(6_787_200_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(28_000_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      274_800_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(6_308_700_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      20_437_400_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(15_539_600_000);
    expect(
      recordByLine(records, 'b1_1_function_expenses_community_and_belonging').amount_cents,
    ).toBe(4_284_000_000);
    expect(recordByLine(records, 'b1_1_function_expenses_places_for_people').amount_cents).toBe(
      9_233_300_000,
    );
  });

  it('emits only printed categories: components point at their printed subtotal and there is no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'b1_1_function_expenses_community_and_belonging',
        'b1_1_function_expenses_economic_prosperity',
        'b1_1_function_expenses_enriched_natural_environment',
        'b1_1_function_expenses_places_for_people',
        'b1_1_function_expenses_strong_leadership',
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
        source_id: CAMPBELLTOWN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: CAMPBELLTOWN_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Campbelltown City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Campbelltown City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^campbelltown-gpfs:[a-f0-9]{40}$/);
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
      recordByLine(records, 'b1_1_function_expenses_community_and_belonging').gpfs_component_of,
    ).toBe('b1_1_total_expenses');
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const parsed = parseCampbelltownGpfsExtraction(
      extractionWith(19, (page) => mutatePage(page, '243,664', '243,654')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const parsed = parseCampbelltownGpfsExtraction(
      extractionWith(8, (page) => mutatePage(page, '155,396', '155,296')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a B1-1 objective expense row no longer sums to the total', () => {
    const parsed = parseCampbelltownGpfsExtraction(
      extractionWith(19, (page) => mutatePage(page, '42,840', '42,740')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const parsed = parseCampbelltownGpfsExtraction(
      extractionWith(9, (page) => mutatePage(page, '63,350', '63,450')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-3 depreciation no longer bridges', () => {
    const parsed = parseCampbelltownGpfsExtraction(
      extractionWith(28, (page) => mutatePage(page, '39,290', '39,390')),
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
    const revenue = campbelltownGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = campbelltownGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^campbelltown-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(campbelltownGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(campbelltownGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_campbelltowngpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CAMPBELLTOWN_GPFS_ID,
    name: CAMPBELLTOWN_GPFS_NAME,
    publisher: CAMPBELLTOWN_GPFS_PUBLISHER,
    source_url: CAMPBELLTOWN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CAMPBELLTOWN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'campbelltown-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Campbelltown City Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: CAMPBELLTOWN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-campbelltown-city-council-existing-1',
        project_name:
          'Existing GrantConnect grant under the exact string Campbelltown City Council',
        delivery_entity: 'Campbelltown City Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-CAMPBELLTOWN-CITY-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase CAMPBELLTOWN CITY COUNCIL',
        delivery_entity: 'CAMPBELLTOWN CITY COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-campbelltown-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Campbelltown Community Services Incorporated',
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
        natural_key: 'existing-nsw-budget-campbelltown-project',
        project_name: 'Existing NSW Budget project whose name mentions Campbelltown',
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
    expect(await MeasureModel.countDocuments({ source_id: CAMPBELLTOWN_GPFS_ID })).toBe(
      CAMPBELLTOWN_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(before + CAMPBELLTOWN_GPFS_ROW_COUNT);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: CAMPBELLTOWN_GPFS_ID })).toBe(
      CAMPBELLTOWN_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(before + CAMPBELLTOWN_GPFS_ROW_COUNT);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Campbelltown City Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'CAMPBELLTOWN CITY COUNCIL',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: 'Campbelltown City Council' }),
    ).toBe(CAMPBELLTOWN_GPFS_ROW_COUNT + 1);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^campbelltown city council$/i }),
    ).toBe(CAMPBELLTOWN_GPFS_ROW_COUNT + 2);

    expect(
      await MeasureModel.countDocuments({
        source_id: CAMPBELLTOWN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CAMPBELLTOWN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CAMPBELLTOWN_GPFS_ID,
        delivery_entity: { $ne: 'Campbelltown City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: CAMPBELLTOWN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(CAMPBELLTOWN_GPFS_ROW_COUNT);
  });
});
