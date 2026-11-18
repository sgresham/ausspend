import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  WOLLONDILLY_GPFS_DELIVERY_ENTITY,
  WOLLONDILLY_GPFS_FISCAL_YEAR,
  WOLLONDILLY_GPFS_ID,
  WOLLONDILLY_GPFS_LICENSE,
  WOLLONDILLY_GPFS_NAME,
  WOLLONDILLY_GPFS_PUBLISHER,
  WOLLONDILLY_GPFS_REPORTING_URL,
  detectWollondillyGpfsUnit,
  discoverWollondillyGpfsDocument,
  fiscalYearFromWollondillyGpfsLink,
  parseWollondillyGpfsExtraction,
  parseWollondillyGpfsReportPage,
  wollondillyGpfsNaturalKey,
  type WollondillyGpfsParseContext,
} from '../src/connectors/wollondilly-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  WOLLONDILLY_PDF_BYTES,
  WOLLONDILLY_PDF_SHA256,
  WOLLONDILLY_PDF_URL,
  wollondillyExtraction,
  wollondillyPage5,
} from '../src/connectors/wollondilly-gpfs/fixture-data.js';
import { WOLLONDILLY_GPFS_ROW_COUNT } from '../src/connectors/wollondilly-gpfs/fixture.js';

// Wollondilly's "Council's Financial Statements" page links the latest
// standalone audited GPFS PDF from the council's document CDN. Its Income
// Statement prints the Original unaudited budget column first, the FY2024-25
// Actual column second and the FY2023-24 column third. FY2024-25 has no
// discontinued operation, so the printed continuing operating result equals the
// statutory net operating result.

const CONTEXT: WollondillyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Wollondilly Shire Council Audited Financial Statements 2024-25',
    url: WOLLONDILLY_PDF_URL,
    fiscal_year: WOLLONDILLY_GPFS_FISCAL_YEAR,
    listing_url: WOLLONDILLY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/wollondilly-gpfs/wollondilly-shire-council-audited-financial-statements-2024-25.pdf',
    sha256: WOLLONDILLY_PDF_SHA256,
    bytes: WOLLONDILLY_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: WOLLONDILLY_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseWollondillyGpfsExtraction(wollondillyExtraction(), CONTEXT);
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
  const base = wollondillyExtraction();
  const pages = base.pages.map((page) => (page.page_number === pageNumber ? mutate(page) : page));
  return { ...base, pages, text: pages.map((page) => page.text).join('\n') };
}

describe('Wollondilly Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <h2>Financial Statements</h2>
    <a href="https://wollondilly.cdn.greenhousecreative.au/assets/Documents-NEW/Council/Corporate-Planning-and-Reporting/Annual_Financial_Statements_NotePN_Public_Notice_Presentation_of_Financial_Statements.pdf">Public notice</a>
    <a href="https://wollondilly.cdn.greenhousecreative.au/assets/Documents-NEW/Council/Corporate-Planning-and-Reporting/Wollondilly-Shire-Council-Annual-Financial-Statements-30.06.2024.pdf">2023-24</a>
    <a href="https://wollondilly.cdn.greenhousecreative.au/assets/Documents-NEW/Council/Corporate-Planning-and-Reporting/Wollondilly-Shire-Council-Audited-Financial-Statements-30.06.2025.pdf">2024-25 (audited)</a>
  `;

  it('discovers the audited FY2024-25 statements from the official page, not a hard-coded PDF URL', () => {
    expect(
      parseWollondillyGpfsReportPage(pageHtml, WOLLONDILLY_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: WOLLONDILLY_PDF_URL,
      title:
        'Wollondilly Shire Council Audited Financial Statements 2024-25 (General Purpose Financial Statements)',
    });
    expect(
      fiscalYearFromWollondillyGpfsLink(
        'Wollondilly-Shire-Council-Audited-Financial-Statements-30.06.2025.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromWollondillyGpfsLink(
        'Wollondilly-Shire-Council-Annual-Financial-Statements-30.06.2024.pdf',
      ),
    ).toBe('2023-24');
    expect(fiscalYearFromWollondillyGpfsLink('Financial Statements 2023/24')).toBe('2023-24');
    expect(
      fiscalYearFromWollondillyGpfsLink(
        'Annual_Financial_Statements_NotePN_Public_Notice_Presentation_of_Financial_Statements.pdf',
      ),
    ).toBeNull();
  });

  it('resolves the PDF through the official listing HTML', async () => {
    const discovered = await discoverWollondillyGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: pageHtml,
    });
    expect(discovered.title).toBe(
      'Wollondilly Shire Council Audited Financial Statements 2024-25 (General Purpose Financial Statements)',
    );
    expect(discovered.url).toBe(WOLLONDILLY_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(WOLLONDILLY_GPFS_REPORTING_URL);
  });

  it('does not select a prior-year statement', () => {
    expect(
      parseWollondillyGpfsReportPage(
        `<a href="https://wollondilly.cdn.greenhousecreative.au/documents/statements-30.06.2024.pdf">2023-24</a>`,
        WOLLONDILLY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a statements link on a non-council host', () => {
    expect(
      parseWollondillyGpfsReportPage(
        `<a href="https://example.com/statements-30.06.2025.pdf">2024-25</a>`,
        WOLLONDILLY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Wollondilly Shire Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectWollondillyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectWollondillyGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = mutatePage(wollondillyPage5(), "$ '000", '');
    const base = wollondillyExtraction();
    const pages = base.pages.map((page) => (page.page_number === 5 ? withoutUnit : page));
    const parsed = parseWollondillyGpfsExtraction(
      { ...base, pages, text: pages.map((page) => page.text).join('\n') },
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Wollondilly Shire Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and note B3-4 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(WOLLONDILLY_GPFS_ROW_COUNT);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(149_464);
    expect(reconciliation.total_expenses).toBe(105_837);
    expect(reconciliation.employee_expenses).toBe(41_688);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(23_468);
    expect(reconciliation.government_grants_operating).toBe(9_694);
    expect(reconciliation.government_grants_capital).toBe(57_370);
    expect(reconciliation.borrowing_costs).toBe(3_505);
    expect(reconciliation.materials_and_services).toBe(35_465);
    expect(reconciliation.other_expenses).toBe(1_711);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(59);
    expect(reconciliation.operating_result_continuing).toBe(43_627);
    expect(reconciliation.net_result).toBe(43_627);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(67_095);
    expect(reconciliation.net_result_before_capital_grants).toBe(-13_743);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(82_369);
    expect(reconciliation.revenue_components_sum).toBe(149_464);
    expect(reconciliation.expense_components_sum).toBe(82_369);
    expect(reconciliation.face_expense_bridge).toBe(105_837);
    expect(reconciliation.functions_total_income).toBe(149_464);
    expect(reconciliation.functions_total_expenses).toBe(105_837);
    expect(reconciliation.functions_operating_result).toBe(43_627);
    expect(reconciliation.functions_grants_and_contributions).toBe(67_064);
    expect(reconciliation.comprehensive_income_net_result).toBe(43_627);
    expect(reconciliation.comprehensive_income_other).toBe(40_384);
    expect(reconciliation.comprehensive_income_total).toBe(84_011);
    expect(reconciliation.depreciation_impairment_note_total).toBe(23_468);
    expect(reconciliation.income_statement_page).toBe(5);
    expect(reconciliation.functions_page).toBe(14);
    expect(reconciliation.comprehensive_income_page).toBe(6);
    expect(reconciliation.depreciation_note_page).toBe(26);
    expect(reconciliation.checks.length).toBeGreaterThan(10);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(14_946_400_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(10_583_700_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(4_168_800_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_346_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(969_400_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(5_737_000_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(350_500_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(3_546_500_000);
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(171_100_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(5_900_000);
    expect(recordByLine(records, 'operating_result_continuing').amount_cents).toBe(4_362_700_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(4_362_700_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      8_236_900_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(6_331_400_000);
  });

  it('emits only printed categories: components point at their printed subtotal and there is no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'borrowing_costs',
        'depreciation_amortisation_impairment',
        'employee_expenses',
        'government_grants_capital',
        'government_grants_operating',
        'interest_and_investment_income',
        'materials_and_services',
        'net_gain_from_disposal_of_assets',
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
        source_id: WOLLONDILLY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: WOLLONDILLY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Wollondilly Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Wollondilly Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^wollondilly-gpfs:[a-f0-9]{40}$/);
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
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const parsed = parseWollondillyGpfsExtraction(
      extractionWith(14, (page) => mutatePage(page, '105,837', '105,8371')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const parsed = parseWollondillyGpfsExtraction(
      extractionWith(5, (page) => mutatePage(page, '63,314', '63,214')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const parsed = parseWollondillyGpfsExtraction(
      extractionWith(6, (page) => mutatePage(page, '43,627', '43,600')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-4 depreciation no longer bridges', () => {
    const parsed = parseWollondillyGpfsExtraction(
      extractionWith(26, (page) => mutatePage(page, '23,468', '23,568')),
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
    const revenue = wollondillyGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = wollondillyGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^wollondilly-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(wollondillyGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(wollondillyGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_wollondillygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: WOLLONDILLY_GPFS_ID,
    name: WOLLONDILLY_GPFS_NAME,
    publisher: WOLLONDILLY_GPFS_PUBLISHER,
    source_url: WOLLONDILLY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WOLLONDILLY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'wollondilly-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Wollondilly Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: WOLLONDILLY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-wollondilly-shire-council-existing-1',
        project_name:
          'Existing GrantConnect grant under the exact string Wollondilly Shire Council',
        delivery_entity: 'Wollondilly Shire Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-WOLLONDILLY-SHIRE-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase WOLLONDILLY SHIRE COUNCIL',
        delivery_entity: 'WOLLONDILLY SHIRE COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-wollondilly-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Wollondilly Community Services Incorporated',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'hawkesbury-gpfs',
        source_url: 'https://www.hawkesbury.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-hawkesbury-gpfs-1',
        project_name: 'Existing Hawkesbury Council GPFS row',
        delivery_entity: 'Hawkesbury City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-wollondilly-project',
        project_name: 'Existing NSW Budget project whose name mentions Wollondilly',
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
    const preexisting = await MeasureModel.countDocuments({});
    expect(preexisting).toBe(5);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'hawkesbury-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: WOLLONDILLY_GPFS_ID })).toBe(
      WOLLONDILLY_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(WOLLONDILLY_GPFS_ROW_COUNT + preexisting);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: WOLLONDILLY_GPFS_ID })).toBe(
      WOLLONDILLY_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(WOLLONDILLY_GPFS_ROW_COUNT + preexisting);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Wollondilly Shire Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'WOLLONDILLY SHIRE COUNCIL',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: 'Wollondilly Shire Council' }),
    ).toBe(WOLLONDILLY_GPFS_ROW_COUNT + 1);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^wollondilly shire council$/i }),
    ).toBe(WOLLONDILLY_GPFS_ROW_COUNT + 2);
    expect(await MeasureModel.countDocuments({ delivery_entity: /wollondilly/i })).toBe(
      WOLLONDILLY_GPFS_ROW_COUNT + 3,
    );

    expect(
      await MeasureModel.countDocuments({
        source_id: WOLLONDILLY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WOLLONDILLY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WOLLONDILLY_GPFS_ID,
        delivery_entity: { $ne: 'Wollondilly Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: WOLLONDILLY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(WOLLONDILLY_GPFS_ROW_COUNT);
  });

  it('no-sum guard: components and printed totals are both stored, so summing council rows double counts and is never treated as the council total', async () => {
    const { records } = parsedFixture();
    const rows = await MeasureModel.find({ source_id: WOLLONDILLY_GPFS_ID }).lean();
    const summed = rows.reduce((total, row) => total + row.amount_cents, 0);
    const printedTotalRevenue = recordByLine(records, 'total_revenue').amount_cents;
    const printedTotalExpenses = recordByLine(records, 'total_expenses').amount_cents;
    expect(summed).not.toBe(printedTotalRevenue);
    expect(summed).not.toBe(printedTotalExpenses);
    // The printed totals remain separate rows; no other source gained a row from
    // this ingestion and no state row is combined into the council figure.
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    const crossSource = await MeasureModel.aggregate([
      { $match: { source_id: { $in: [WOLLONDILLY_GPFS_ID, 'nsw-budget'] } } },
      { $group: { _id: '$source_id', total: { $sum: '$amount_cents' }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    expect(crossSource).toHaveLength(2);
    expect(crossSource.find((group) => group._id === WOLLONDILLY_GPFS_ID)?.n).toBe(
      WOLLONDILLY_GPFS_ROW_COUNT,
    );
    expect(crossSource.find((group) => group._id === 'nsw-budget')?.n).toBe(1);
  });
});
