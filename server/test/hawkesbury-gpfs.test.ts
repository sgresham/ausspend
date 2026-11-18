import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  HAWKESBURY_GPFS_DELIVERY_ENTITY,
  HAWKESBURY_GPFS_FISCAL_YEAR,
  HAWKESBURY_GPFS_ID,
  HAWKESBURY_GPFS_LICENSE,
  HAWKESBURY_GPFS_NAME,
  HAWKESBURY_GPFS_PUBLISHER,
  HAWKESBURY_GPFS_REPORTING_URL,
  detectHawkesburyGpfsUnit,
  discoverHawkesburyGpfsDocument,
  fiscalYearFromHawkesburyGpfsLink,
  hawkesburyGpfsNaturalKey,
  parseHawkesburyGpfsExtraction,
  parseHawkesburyGpfsReportPage,
  type HawkesburyGpfsParseContext,
} from '../src/connectors/hawkesbury-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  HAWKESBURY_PDF_BYTES,
  HAWKESBURY_PDF_SHA256,
  HAWKESBURY_PDF_URL,
  hawkesburyExtraction,
  hawkesburyPage6,
} from '../src/connectors/hawkesbury-gpfs/fixture-data.js';
import { HAWKESBURY_GPFS_ROW_COUNT } from '../src/connectors/hawkesbury-gpfs/fixture.js';

// Hawkesbury's Financial Statement page redirects to the latest standalone
// audited GPFS PDF. Its Income Statement prints the Original unaudited budget
// column first, the FY2024-25 Actual column second and the FY2023-24 column
// third, each row's label and amounts on the same printed line. FY2024-25 has a
// material discontinued operation (the sewer business), so the continuing and
// discontinued result lines are both emitted with the statutory net result.

const CONTEXT: HawkesburyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Hawkesbury City Council Financial Statements 2024-25',
    url: HAWKESBURY_PDF_URL,
    fiscal_year: HAWKESBURY_GPFS_FISCAL_YEAR,
    listing_url: HAWKESBURY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/hawkesbury-gpfs/hawkesbury-city-council-financial-statements-2024-25.pdf',
    sha256: HAWKESBURY_PDF_SHA256,
    bytes: HAWKESBURY_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: HAWKESBURY_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseHawkesburyGpfsExtraction(hawkesburyExtraction(), CONTEXT);
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
  const base = hawkesburyExtraction();
  const pages = base.pages.map((page) => (page.page_number === pageNumber ? mutate(page) : page));
  return { ...base, pages, text: pages.map((page) => page.text).join('\n') };
}

describe('Hawkesbury City Council GPFS source discovery', () => {
  const pageHtml = `
    <p>Redirecting you to the latest Financial Statement...</p>
    <script>setTimeout("self.location = '${HAWKESBURY_PDF_URL}'", 500);</script>
  `;

  it('discovers the FY2024-25 statements from the official redirect, not a hard-coded PDF URL', () => {
    expect(
      parseHawkesburyGpfsReportPage(pageHtml, HAWKESBURY_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: HAWKESBURY_PDF_URL,
      title:
        'Hawkesbury City Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    });
    expect(
      fiscalYearFromHawkesburyGpfsLink('Hawkesbury-Financial-Statements-Ended-30-June-2025.pdf'),
    ).toBe('2024-25');
    expect(fiscalYearFromHawkesburyGpfsLink('Financial Statements 2023/24')).toBe('2023-24');
  });

  it('resolves the PDF through the official listing HTML', async () => {
    const discovered = await discoverHawkesburyGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: pageHtml,
    });
    expect(discovered.title).toBe(
      'Hawkesbury City Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    );
    expect(discovered.url).toBe(HAWKESBURY_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(HAWKESBURY_GPFS_REPORTING_URL);
  });

  it('does not select a prior-year statement', () => {
    expect(
      parseHawkesburyGpfsReportPage(
        `setTimeout("self.location = 'https://www.hawkesbury.nsw.gov.au/_resources/documents/statements-ended-30-june-2024.pdf'", 500);`,
        HAWKESBURY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a statements link on a non-council host', () => {
    expect(
      parseHawkesburyGpfsReportPage(
        `setTimeout("self.location = 'https://example.com/statements-ended-30-june-2025.pdf'", 500);`,
        HAWKESBURY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Hawkesbury City Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectHawkesburyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectHawkesburyGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = mutatePage(hawkesburyPage6(), "$ '000", '');
    const base = hawkesburyExtraction();
    const pages = base.pages.map((page) => (page.page_number === 6 ? withoutUnit : page));
    const parsed = parseHawkesburyGpfsExtraction(
      { ...base, pages, text: pages.map((page) => page.text).join('\n') },
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Hawkesbury City Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the continuing face statement, B1-1, comprehensive income, note B3-3 and the discontinued-operation bridge exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(HAWKESBURY_GPFS_ROW_COUNT);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(230_424);
    expect(reconciliation.total_expenses).toBe(130_704);
    expect(reconciliation.employee_expenses).toBe(39_389);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(29_345);
    expect(reconciliation.government_grants_operating).toBe(51_611);
    expect(reconciliation.government_grants_capital).toBe(83_145);
    expect(reconciliation.borrowing_costs).toBe(1_300);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(15_171);
    expect(reconciliation.operating_result_continuing).toBe(99_720);
    expect(reconciliation.discontinued_operations_result).toBe(-153_870);
    expect(reconciliation.net_result).toBe(-54_150);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(129_065);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(101_359);
    expect(reconciliation.revenue_components_sum).toBe(230_424);
    expect(reconciliation.expense_components_sum).toBe(101_359);
    expect(reconciliation.face_expense_bridge).toBe(130_704);
    expect(reconciliation.functions_total_income).toBe(230_424);
    expect(reconciliation.functions_total_expenses).toBe(130_704);
    expect(reconciliation.functions_operating_result).toBe(99_720);
    expect(reconciliation.functions_grants_and_contributions).toBe(134_756);
    expect(reconciliation.comprehensive_income_net_result).toBe(-54_150);
    expect(reconciliation.comprehensive_income_other).toBe(53_499);
    expect(reconciliation.comprehensive_income_total).toBe(-651);
    expect(reconciliation.depreciation_impairment_note_total).toBe(29_345);
    expect(reconciliation.income_statement_page).toBe(6);
    expect(reconciliation.functions_page).toBe(16);
    expect(reconciliation.comprehensive_income_page).toBe(7);
    expect(reconciliation.depreciation_note_page).toBe(31);
    expect(reconciliation.checks.length).toBeGreaterThan(10);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(23_042_400_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(13_070_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(3_938_900_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_934_500_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(5_161_100_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(8_314_500_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(130_000_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      1_517_100_000,
    );
    expect(recordByLine(records, 'operating_result_continuing').amount_cents).toBe(9_972_000_000);
    expect(recordByLine(records, 'discontinued_operations_result').amount_cents).toBe(
      15_387_000_000,
    );
    expect(recordByLine(records, 'discontinued_operations_result').gpfs_printed_sign).toBe(
      'negative',
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(5_415_000_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBe('negative');
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      10_135_900_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(7_250_100_000);
  });

  it('emits only printed categories: components point at their printed subtotal and there is no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'borrowing_costs',
        'depreciation_amortisation_impairment',
        'discontinued_operations_result',
        'employee_expenses',
        'government_grants_capital',
        'government_grants_operating',
        'interest_and_investment_income',
        'materials_and_services',
        'net_loss_from_disposal_of_assets',
        'net_result',
        'operating_result_continuing',
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
        source_id: HAWKESBURY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: HAWKESBURY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Hawkesbury City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Hawkesbury City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^hawkesbury-gpfs:[a-f0-9]{40}$/);
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
    expect(recordByLine(records, 'operating_result_continuing').gpfs_component_of).toBe(
      'net_result',
    );
    expect(recordByLine(records, 'discontinued_operations_result').gpfs_component_of).toBe(
      'net_result',
    );
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const parsed = parseHawkesburyGpfsExtraction(
      extractionWith(16, (page) => mutatePage(page, '130,704', '130,794')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const parsed = parseHawkesburyGpfsExtraction(
      extractionWith(6, (page) => mutatePage(page, '72,501', '72,401')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const parsed = parseHawkesburyGpfsExtraction(
      extractionWith(7, (page) => mutatePage(page, '(54,150)', '(54,100)')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-4 depreciation no longer bridges', () => {
    const parsed = parseHawkesburyGpfsExtraction(
      extractionWith(31, (page) => mutatePage(page, '29,345', '29,445')),
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
    const revenue = hawkesburyGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = hawkesburyGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^hawkesbury-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(hawkesburyGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(hawkesburyGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_hawkesburygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: HAWKESBURY_GPFS_ID,
    name: HAWKESBURY_GPFS_NAME,
    publisher: HAWKESBURY_GPFS_PUBLISHER,
    source_url: HAWKESBURY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: HAWKESBURY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'hawkesbury-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Hawkesbury City Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: HAWKESBURY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-hawkesbury-city-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Hawkesbury City Council',
        delivery_entity: 'Hawkesbury City Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-HAWKESBURY-CITY-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase HAWKESBURY CITY COUNCIL',
        delivery_entity: 'HAWKESBURY CITY COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-hawkesbury-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Hawkesbury Community Services Incorporated',
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
        natural_key: 'existing-nsw-budget-hawkesbury-project',
        project_name: 'Existing NSW Budget project whose name mentions Hawkesbury',
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
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'ku-ring-gai-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: HAWKESBURY_GPFS_ID })).toBe(
      HAWKESBURY_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(HAWKESBURY_GPFS_ROW_COUNT + 5);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: HAWKESBURY_GPFS_ID })).toBe(
      HAWKESBURY_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(HAWKESBURY_GPFS_ROW_COUNT + 5);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Hawkesbury City Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'HAWKESBURY CITY COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Hawkesbury City Council' })).toBe(
      HAWKESBURY_GPFS_ROW_COUNT + 1,
    );
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^hawkesbury city council$/i }),
    ).toBe(HAWKESBURY_GPFS_ROW_COUNT + 2);
    expect(await MeasureModel.countDocuments({ delivery_entity: /hawkesbury/i })).toBe(
      HAWKESBURY_GPFS_ROW_COUNT + 3,
    );

    expect(
      await MeasureModel.countDocuments({
        source_id: HAWKESBURY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: HAWKESBURY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: HAWKESBURY_GPFS_ID,
        delivery_entity: { $ne: 'Hawkesbury City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: HAWKESBURY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(HAWKESBURY_GPFS_ROW_COUNT);
  });
});
