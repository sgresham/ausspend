import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  LIVERPOOL_GPFS_DELIVERY_ENTITY,
  LIVERPOOL_GPFS_FISCAL_YEAR,
  LIVERPOOL_GPFS_ID,
  LIVERPOOL_GPFS_LICENSE,
  LIVERPOOL_GPFS_NAME,
  LIVERPOOL_GPFS_PUBLISHER,
  LIVERPOOL_GPFS_REPORTING_URL,
  detectLiverpoolGpfsUnit,
  discoverLiverpoolGpfsDocument,
  fiscalYearFromLiverpoolGpfsLink,
  liverpoolGpfsNaturalKey,
  parseLiverpoolGpfsExtraction,
  parseLiverpoolGpfsReportPage,
  type LiverpoolGpfsParseContext,
} from '../src/connectors/liverpool-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  LIVERPOOL_PDF_SHA256,
  LIVERPOOL_PDF_URL,
  liverpoolExtraction,
  liverpoolIncomePage,
} from './liverpool-gpfs.fixture.js';

// Liverpool publishes a standalone audited financial statements PDF under the
// "Financial Year 2024/2025" table on its official Finance Reports page. Its
// Income Statement prints the Original unaudited budget column first, the
// FY2024-25 Actual column second and the FY2023-24 column third, each row's
// label and amounts on the same printed line. The printed borrowing-costs and
// net-gain-on-disposal lines are both non-nil and emitted.

const CONTEXT: LiverpoolGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Liverpool City Council Audited Financial Statements 2024-25',
    url: LIVERPOOL_PDF_URL,
    fiscal_year: LIVERPOOL_GPFS_FISCAL_YEAR,
    listing_url: LIVERPOOL_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/liverpool-gpfs/liverpool-city-council-audited-financial-statements-2024-25.pdf',
    sha256: LIVERPOOL_PDF_SHA256,
    bytes: 9_940_306,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: LIVERPOOL_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseLiverpoolGpfsExtraction(liverpoolExtraction(), CONTEXT);
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
  const base = liverpoolExtraction();
  const pages = base.pages.map((page) => (page.page_number === pageNumber ? mutate(page) : page));
  return { ...base, pages, text: pages.map((page) => page.text).join('\n') };
}

describe('Liverpool City Council GPFS source discovery', () => {
  const pageHtml = `
    <table><thead><tr><th>Financial Year&nbsp;&nbsp;2025/2026</th></tr></thead><tbody>
      <tr><td><a href="/__data/assets/pdf_file/0020/284501/Quartely-budget-report-Q1-September-2025.pdf">Quarterly Budget Report Q1 - September 2025</a></td></tr>
    </tbody></table>
    <table><thead><tr><th>Financial Year&nbsp;&nbsp;2024/2025</th></tr></thead><tbody>
      <tr><td><a href="/__data/assets/pdf_file/0009/282717/Annual-Financial-Statements-2025-Final-signed-with-Audit-Opinion.pdf" target="_blank">Audited Financial Statement</a></td></tr>
      <tr><td><a href="/__data/assets/pdf_file/0008/278900/2024-25-Quarter-1-Budget-Review-Report-including-attachments.pdf">Quarterly Budget Report Q1 - September 2024</a></td></tr>
    </tbody></table>
    <table><thead><tr><th>Financial Year&nbsp;&nbsp;2023/2024</th></tr></thead><tbody>
      <tr><td><a href="/__data/assets/pdf_file/0005/266837/Annual-Financial-Statements-2024-Grand-Finale.pdf">Audited Financial Statement</a></td></tr>
    </tbody></table>
  `;

  it('discovers the FY2024-25 audited statement from the matching financial-year table, not a hard-coded PDF URL', () => {
    expect(parseLiverpoolGpfsReportPage(pageHtml, LIVERPOOL_GPFS_REPORTING_URL, '2024-25')).toEqual(
      {
        pdfUrl: LIVERPOOL_PDF_URL,
        title: 'Liverpool City Council Audited Financial Statements 2024-25',
      },
    );
    expect(fiscalYearFromLiverpoolGpfsLink('Financial Year 2024/2025')).toBe('2024-25');
    expect(
      fiscalYearFromLiverpoolGpfsLink(
        'Annual-Financial-Statements-2025-Final-signed-with-Audit-Opinion.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromLiverpoolGpfsLink('Financial statements year ended 30 June 2025')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromLiverpoolGpfsLink('2023/2024')).toBe('2023-24');
  });

  it('resolves the PDF through the official listing HTML', async () => {
    const discovered = await discoverLiverpoolGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: pageHtml,
    });
    expect(discovered.title).toBe('Liverpool City Council Audited Financial Statements 2024-25');
    expect(discovered.url).toBe(LIVERPOOL_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(LIVERPOOL_GPFS_REPORTING_URL);
  });

  it('does not select a prior-year audited statement under a different financial-year table', () => {
    expect(
      parseLiverpoolGpfsReportPage(
        `<table><thead><tr><th>Financial Year&nbsp;&nbsp;2023/2024</th></tr></thead><tbody><tr><td><a href="/__data/assets/pdf_file/0005/266837/Annual-Financial-Statements-2024-Grand-Finale.pdf">Audited Financial Statement</a></td></tr></tbody></table>`,
        LIVERPOOL_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseLiverpoolGpfsReportPage(
        `<table><thead><tr><th>Financial Year&nbsp;&nbsp;2024/2025</th></tr></thead><tbody><tr><td><a href="https://example.com/Annual-Financial-Statements-2025.pdf">Audited Financial Statement</a></td></tr></tbody></table>`,
        LIVERPOOL_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Liverpool City Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectLiverpoolGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectLiverpoolGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = mutatePage(liverpoolIncomePage(), "$ '000", '');
    const base = liverpoolExtraction();
    const pages = base.pages.map((page) => (page.page_number === 18 ? withoutUnit : page));
    const parsed = parseLiverpoolGpfsExtraction(
      { ...base, pages, text: pages.map((page) => page.text).join('\n') },
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Liverpool City Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and note B3-4 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(380_226);
    expect(reconciliation.total_expenses).toBe(279_490);
    expect(reconciliation.employee_expenses).toBe(107_576);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(55_138);
    expect(reconciliation.government_grants_operating).toBe(21_295);
    expect(reconciliation.government_grants_capital).toBe(111_174);
    expect(reconciliation.borrowing_costs).toBe(9_452);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(3_632);
    expect(reconciliation.net_result).toBe(100_736);
    expect(reconciliation.operating_result).toBe(100_736);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(155_874);
    expect(reconciliation.net_result_before_capital_grants).toBe(-10_438);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(224_352);
    expect(reconciliation.revenue_components_sum).toBe(380_226);
    expect(reconciliation.expense_components_sum).toBe(224_352);
    expect(reconciliation.face_expense_bridge).toBe(279_490);
    expect(reconciliation.functions_total_income).toBe(380_226);
    expect(reconciliation.functions_total_expenses).toBe(279_490);
    expect(reconciliation.functions_operating_result).toBe(100_736);
    expect(reconciliation.functions_grants_and_contributions).toBe(132_469);
    expect(reconciliation.comprehensive_income_net_result).toBe(100_736);
    expect(reconciliation.comprehensive_income_other).toBe(108_293);
    expect(reconciliation.comprehensive_income_total).toBe(209_029);
    expect(reconciliation.depreciation_impairment_note_total).toBe(55_138);
    expect(reconciliation.income_statement_page).toBe(18);
    expect(reconciliation.functions_page).toBe(29);
    expect(reconciliation.comprehensive_income_page).toBe(19);
    expect(reconciliation.depreciation_note_page).toBe(44);
    expect(reconciliation.conduct_report).toMatchObject({
      page_number: 108,
      operating_result_millions: 100.7,
      grants_and_contributions_millions: 132.5,
      revenue_millions: 380.2,
      depreciation_millions: 55.1,
      expenses_excluding_depreciation_millions: 224.4,
      net_result_before_capital_millions: -10.4,
      total_expenses_millions: null,
    });
    expect(reconciliation.conduct_report_narrative_discrepancies).toEqual([]);
    expect(reconciliation.human_spot_check_required).toBe(true);
    expect(reconciliation.conduct_report!.label_discrepancies).toHaveLength(1);
    expect(reconciliation.conduct_report!.label_discrepancies[0]).toMatch(/Other expenses/);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(38_022_600_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(27_949_000_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(10_757_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      5_513_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_129_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(11_117_400_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(945_200_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      363_200_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(10_073_600_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      22_435_200_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(18_371_900_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
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
        source_id: LIVERPOOL_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: LIVERPOOL_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Liverpool City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Liverpool City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^liverpool-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'borrowing_costs').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'depreciation_amortisation_impairment').gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(recordByLine(records, 'total_expenses').notes).toContain('human_spot_check: required');
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').notes).toContain(
      'human_spot_check: required',
    );
    expect(recordByLine(records, 'net_result').notes).toContain('human_spot_check: required');
    expect(recordByLine(records, 'employee_expenses').notes).not.toContain('human_spot_check');
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('retains a printed narrative total-expenses difference for a human without rejecting the exact face/B1-1 reconciliation', () => {
    const base = liverpoolExtraction();
    const pages = base.pages.map((page) =>
      page.page_number === 108
        ? {
            ...page,
            text: `${page.text} total expenses from continuing operations including depreciation ($280.0 million)`,
          }
        : page,
    );
    const parsed = parseLiverpoolGpfsExtraction(
      { ...base, pages, text: pages.map((page) => page.text).join('\n') },
      CONTEXT,
    );
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation!.conduct_report_total_expenses_discrepancy_thousands).toBe(510);
    expect(parsed.reconciliation!.conduct_report_narrative_discrepancies.length).toBe(1);
    expect(recordByLine(parsed.records, 'total_expenses').notes).toContain(
      'human_spot_check: required',
    );
    expect(recordByLine(parsed.records, 'net_result').notes).toContain(
      'human_spot_check: required',
    );
    expect(recordByLine(parsed.records, 'employee_expenses').notes).not.toContain(
      'human_spot_check',
    );
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const parsed = parseLiverpoolGpfsExtraction(
      extractionWith(29, (page) => mutatePage(page, '279,490', '279,590')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const parsed = parseLiverpoolGpfsExtraction(
      extractionWith(18, (page) => mutatePage(page, '183,719', '183,619')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const parsed = parseLiverpoolGpfsExtraction(
      extractionWith(19, (page) => mutatePage(page, '100,736', '100,700')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-4 depreciation no longer bridges', () => {
    const parsed = parseLiverpoolGpfsExtraction(
      extractionWith(44, (page) => mutatePage(page, '55,138', '55,148')),
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
    const revenue = liverpoolGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = liverpoolGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^liverpool-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(liverpoolGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(liverpoolGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_liverpoolgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: LIVERPOOL_GPFS_ID,
    name: LIVERPOOL_GPFS_NAME,
    publisher: LIVERPOOL_GPFS_PUBLISHER,
    source_url: LIVERPOOL_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LIVERPOOL_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'liverpool-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Liverpool City Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: LIVERPOOL_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-liverpool-city-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Liverpool City Council',
        delivery_entity: 'Liverpool City Council',
      },
      {
        amount_cents: 51_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example2',
        verified: false,
        natural_key: 'grantconnect-liverpool-city-council-existing-2',
        project_name:
          'Second existing GrantConnect grant under the exact string Liverpool City Council',
        delivery_entity: 'Liverpool City Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-LIVERPOOL-CITY-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase LIVERPOOL CITY COUNCIL',
        delivery_entity: 'LIVERPOOL CITY COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-liverpool-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Liverpool Neighbourhood Centre Incorporated',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'fairfield-gpfs',
        source_url: 'https://www.fairfieldcity.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-fairfield-gpfs-1',
        project_name: 'Existing Fairfield City Council GPFS row',
        delivery_entity: 'Fairfield City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-liverpool-project',
        project_name: 'Existing NSW Budget project whose name mentions Liverpool',
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
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(2);
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'fairfield-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: LIVERPOOL_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(23);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: LIVERPOOL_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(23);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Liverpool City Council',
      }),
    ).toBe(2);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'LIVERPOOL CITY COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Liverpool City Council' })).toBe(
      19,
    );
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^liverpool city council$/i }),
    ).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: LIVERPOOL_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: LIVERPOOL_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: LIVERPOOL_GPFS_ID,
        delivery_entity: { $ne: 'Liverpool City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: LIVERPOOL_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
