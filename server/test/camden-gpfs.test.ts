import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  CAMDEN_GPFS_DELIVERY_ENTITY,
  CAMDEN_GPFS_FISCAL_YEAR,
  CAMDEN_GPFS_ID,
  CAMDEN_GPFS_LICENSE,
  CAMDEN_GPFS_NAME,
  CAMDEN_GPFS_PUBLISHER,
  CAMDEN_GPFS_REPORTING_URL,
  camdenGpfsNaturalKey,
  detectCamdenGpfsUnit,
  discoverCamdenGpfsDocument,
  fiscalYearFromCamdenGpfsLink,
  parseCamdenGpfsExtraction,
  parseCamdenGpfsReportPage,
  type CamdenGpfsParseContext,
} from '../src/connectors/camden-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  CAMDEN_PDF_BYTES,
  CAMDEN_PDF_SHA256,
  CAMDEN_PDF_URL,
  camdenExtraction,
  camdenPage22,
} from '../src/connectors/camden-gpfs/fixture-data.js';
import { CAMDEN_GPFS_ROW_COUNT } from '../src/connectors/camden-gpfs/fixture.js';

// Camden's official Annual Report and Financial Statement page links the
// "Annual Financial Statements 2024-2025" PDF directly alongside prior years. Its Income Statement prints the Original unaudited
// budget column first, the FY2024-25 Actual column second and the FY2023-24
// column third, each row's label and amounts on the same printed line.
// FY2024-25 has no discontinued operation, so the printed operating result and
// net result are the same. The B1-1 function expense split is a second cut of
// the same printed total expenses.

const CONTEXT: CamdenGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Camden Council Financial Statements 2024-25',
    url: CAMDEN_PDF_URL,
    fiscal_year: CAMDEN_GPFS_FISCAL_YEAR,
    listing_url: CAMDEN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/camden-gpfs/camden-council-financial-statements-2024-25.pdf',
    sha256: CAMDEN_PDF_SHA256,
    bytes: CAMDEN_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: CAMDEN_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseCamdenGpfsExtraction(camdenExtraction(), CONTEXT);
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
  const base = camdenExtraction();
  const pages = base.pages.map((page) => (page.page_number === pageNumber ? mutate(page) : page));
  return { ...base, pages, text: pages.map((page) => page.text).join('\n') };
}

describe('Camden Council GPFS source discovery', () => {
  const pageHtml = `
    <h1>Annual Report and Financial Statement</h1>
    <a href="/assets/Uploads/Camden-Council-Financial-Statements-2023-24.pdf">Financial Statements 2023-24</a>
    <a href="/assets/pdfs/Council/Integrated-Planning/Annual-Report/2024-25-Financial-Statements.pdf">Financial Statements 2024-25</a>
  `;

  it('discovers the FY2024-25 statements from the official document page, not a hard-coded PDF URL', () => {
    expect(parseCamdenGpfsReportPage(pageHtml, CAMDEN_GPFS_REPORTING_URL, '2024-25')).toEqual({
      pdfUrl: CAMDEN_PDF_URL,
      title: 'Camden Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    });
    expect(fiscalYearFromCamdenGpfsLink('2024-25-Financial-Statements.pdf')).toBe('2024-25');
    expect(fiscalYearFromCamdenGpfsLink('Financial Statements 2023/24')).toBe('2023-24');
  });

  it('resolves the PDF through the official document HTML', async () => {
    const discovered = await discoverCamdenGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: pageHtml,
    });
    expect(discovered.title).toBe(
      'Camden Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    );
    expect(discovered.url).toBe(CAMDEN_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(CAMDEN_GPFS_REPORTING_URL);
  });

  it('does not select a prior-year statement', () => {
    expect(
      parseCamdenGpfsReportPage(
        `<a href="/assets/Uploads/Camden-Council-Financial-Statements-2023-24.pdf">Financial Statements 2023-24</a>`,
        CAMDEN_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a statements link on a non-council host', () => {
    expect(
      parseCamdenGpfsReportPage(
        `<a href="https://example.com/2024-25-Financial-Statements.pdf">pdf</a>`,
        CAMDEN_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Camden Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCamdenGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCamdenGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = mutatePage(camdenPage22(), "$ '000", '');
    const base = camdenExtraction();
    const pages = base.pages.map((page) => (page.page_number === 22 ? withoutUnit : page));
    const parsed = parseCamdenGpfsExtraction(
      { ...base, pages, text: pages.map((page) => page.text).join('\n') },
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Camden Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and note B3-4 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(CAMDEN_GPFS_ROW_COUNT);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(342_825);
    expect(reconciliation.total_expenses).toBe(199_379);
    expect(reconciliation.employee_expenses).toBe(80_389);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(41_375);
    expect(reconciliation.government_grants_operating).toBe(7_563);
    expect(reconciliation.government_grants_capital).toBe(179_564);
    expect(reconciliation.borrowing_costs).toBe(2_307);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(4_834);
    expect(reconciliation.operating_result_continuing).toBe(143_446);
    expect(reconciliation.net_result).toBe(143_446);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(184_821);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(158_004);
    expect(reconciliation.revenue_components_sum).toBe(342_825);
    expect(reconciliation.expense_components_sum).toBe(158_004);
    expect(reconciliation.face_expense_bridge).toBe(199_379);
    expect(reconciliation.functions_total_income).toBe(342_825);
    expect(reconciliation.functions_total_expenses).toBe(199_379);
    expect(reconciliation.functions_operating_result).toBe(143_446);
    expect(reconciliation.functions_grants_and_contributions).toBe(187_127);
    expect(reconciliation.functions_expense_split_sum).toBe(199_379);
    expect(reconciliation.comprehensive_income_net_result).toBe(143_446);
    expect(reconciliation.comprehensive_income_other).toBe(284_182);
    expect(reconciliation.comprehensive_income_total).toBe(427_628);
    expect(reconciliation.depreciation_impairment_note_total).toBe(41_375);
    expect(reconciliation.income_statement_page).toBe(22);
    expect(reconciliation.functions_page).toBe(34);
    expect(reconciliation.comprehensive_income_page).toBe(23);
    expect(reconciliation.depreciation_note_page).toBe(50);
    expect(reconciliation.checks.length).toBeGreaterThan(10);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(34_282_500_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(19_937_900_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(8_038_900_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      4_137_500_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(756_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(17_956_400_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(230_700_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      483_400_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(14_344_600_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      15_800_400_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(11_059_200_000);
    expect(
      recordByLine(records, 'b1_1_function_expenses_managing_camden_s_growth').amount_cents,
    ).toBe(1_219_300_000);
  });

  it('emits only printed categories: components point at their printed subtotal and there is no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'b1_1_function_expenses_enriched_and_connected_community',
        'b1_1_function_expenses_managing_camden_s_growth',
        'b1_1_function_expenses_prosperous_economy',
        'b1_1_function_expenses_stong_local_leadership_governance',
        'b1_1_function_expenses_sustainable_transport',
        'b1_1_function_expenses_urban_and_natural_environments',
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
        source_id: CAMDEN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: CAMDEN_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Camden Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Camden Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^camden-gpfs:[a-f0-9]{40}$/);
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
      recordByLine(records, 'b1_1_function_expenses_managing_camden_s_growth').gpfs_component_of,
    ).toBe('b1_1_total_expenses');
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const parsed = parseCamdenGpfsExtraction(
      extractionWith(34, (page) => mutatePage(page, '199,379', '199,479')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const parsed = parseCamdenGpfsExtraction(
      extractionWith(22, (page) => mutatePage(page, '110,592', '110,492')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a B1-1 function expense row no longer sums to the total', () => {
    const parsed = parseCamdenGpfsExtraction(
      extractionWith(34, (page) => mutatePage(page, '12,193', '12,093')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const parsed = parseCamdenGpfsExtraction(
      extractionWith(23, (page) => mutatePage(page, '427,628', '427,728')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-4 depreciation no longer bridges', () => {
    const parsed = parseCamdenGpfsExtraction(
      extractionWith(50, (page) => mutatePage(page, '41,375', '41,475')),
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
    const revenue = camdenGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = camdenGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^camden-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(camdenGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(camdenGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_camdengpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CAMDEN_GPFS_ID,
    name: CAMDEN_GPFS_NAME,
    publisher: CAMDEN_GPFS_PUBLISHER,
    source_url: CAMDEN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CAMDEN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'camden-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Camden Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: CAMDEN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-camden-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Camden Council',
        delivery_entity: 'Camden Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-CAMDEN-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase CAMDEN COUNCIL',
        delivery_entity: 'CAMDEN COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-camden-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Camden Community Services Incorporated',
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
        natural_key: 'existing-nsw-budget-camden-project',
        project_name: 'Existing NSW Budget project whose name mentions Camden',
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
    expect(await MeasureModel.countDocuments({ source_id: CAMDEN_GPFS_ID })).toBe(
      CAMDEN_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(before + CAMDEN_GPFS_ROW_COUNT);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: CAMDEN_GPFS_ID })).toBe(
      CAMDEN_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(before + CAMDEN_GPFS_ROW_COUNT);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Camden Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'CAMDEN COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Camden Council' })).toBe(
      CAMDEN_GPFS_ROW_COUNT + 1,
    );
    expect(await MeasureModel.countDocuments({ delivery_entity: /^camden council$/i })).toBe(
      CAMDEN_GPFS_ROW_COUNT + 2,
    );

    expect(
      await MeasureModel.countDocuments({
        source_id: CAMDEN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CAMDEN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CAMDEN_GPFS_ID,
        delivery_entity: { $ne: 'Camden Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: CAMDEN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(CAMDEN_GPFS_ROW_COUNT);
  });
});
