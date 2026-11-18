import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  MOSMAN_GPFS_DELIVERY_ENTITY,
  MOSMAN_GPFS_FISCAL_YEAR,
  MOSMAN_GPFS_ID,
  MOSMAN_GPFS_NAME,
  MOSMAN_GPFS_PUBLISHER,
  MOSMAN_GPFS_REPORTING_URL,
  detectMosmanGpfsUnit,
  discoverMosmanGpfsDocument,
  fiscalYearFromMosmanGpfsLink,
  mosmanGpfsNaturalKey,
  parseMosmanGpfsExtraction,
  parseMosmanGpfsReportPage,
  type MosmanGpfsParseContext,
} from '../src/connectors/mosman-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  MOSMAN_PDF_BYTES,
  MOSMAN_PDF_SHA256,
  MOSMAN_PDF_URL,
  mosmanExtraction,
  mosmanIncomePage,
} from '../src/connectors/mosman-gpfs/fixture-data.js';

// Mosman publishes a standalone audited General Purpose Financial Statements
// PDF linked from its official Financial Reports page under the printed link
// text "Financial Statements for the Year Ended 30 June 2025". Its Income
// Statement prints the Original unaudited budget column first, the FY2024-25
// Actual column second and the FY2023-24 column third, each row's label and
// amounts on the same printed line. B1-1 prints total income and total expenses
// $1 thousand above the face-statement components due to printed rounding.

const CONTEXT: MosmanGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements for the Year Ended 30 June 2025',
    url: MOSMAN_PDF_URL,
    fiscal_year: MOSMAN_GPFS_FISCAL_YEAR,
    listing_url: MOSMAN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/mosman-gpfs/mosman-council-annual-financial-statements-2024-25.pdf',
    sha256: MOSMAN_PDF_SHA256,
    bytes: MOSMAN_PDF_BYTES,
    fetched_at: '2026-11-18T02:04:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: MOSMAN_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseMosmanGpfsExtraction(mosmanExtraction(), CONTEXT);
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
  const base = mosmanExtraction();
  const pages = base.pages.map((page) => (page.page_number === pageNumber ? mutate(page) : page));
  return { ...base, pages, text: pages.map((page) => page.text).join('\n') };
}

describe('Mosman Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/sites/default/files/2026-11/Annual_Financial_Statements%20%28Audited%29-2026%20FINAL%20signed_LR.pdf">Financial Statements for the Year Ended 30 June 2026<span class="file-info">(3MB)</span></a>
    <a href="/sites/default/files/2025-10/Annual_Financial_Statements%20%28Audited%29-FY2024-2025%20FINAL_LR.pdf">Financial Statements for the Year Ended 30 June 2025<span class="file-info">(3MB)</span></a>
    <a href="/sites/default/files/2024-10/Annual_Financial_Statements%20GPFS%20%26%20SS%20%28Audited%29-2024.02_LR.pdf">Financial Statements for the Year Ended 30 June 2024<span class="file-info">(3MB)</span></a>
    <a href="/sites/default/files/2025-11/Mosman.Annual.%20Report.2024-25.04_LR.pdf">Mosman Annual Report 2024-25</a>
  `;

  it('discovers the FY2024-25 financial statements from the official page, not a hard-coded PDF URL', () => {
    expect(parseMosmanGpfsReportPage(pageHtml, MOSMAN_GPFS_REPORTING_URL, '2024-25')).toEqual({
      pdfUrl: MOSMAN_PDF_URL,
      title: 'Financial Statements for the Year Ended 30 June 2025',
    });
    expect(
      fiscalYearFromMosmanGpfsLink('Financial Statements for the Year Ended 30 June 2025'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromMosmanGpfsLink(
        'Annual_Financial_Statements%20%28Audited%29-FY2024-2025%20FINAL_LR.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromMosmanGpfsLink('Financial Statements 2023/24')).toBe('2023-24');
  });

  it('resolves the PDF through the official listing HTML', async () => {
    const discovered = await discoverMosmanGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: pageHtml,
    });
    expect(discovered.title).toBe('Financial Statements for the Year Ended 30 June 2025');
    expect(discovered.url).toBe(MOSMAN_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(MOSMAN_GPFS_REPORTING_URL);
  });

  it('does not select a future-year or prior-year statement', () => {
    expect(
      parseMosmanGpfsReportPage(
        `<a href="/annual-financial-statements-2026.pdf">Financial Statements for the Year Ended 30 June 2026</a>`,
        MOSMAN_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
    expect(
      parseMosmanGpfsReportPage(
        `<a href="/annual-financial-statements-2024.pdf">Financial Statements for the Year Ended 30 June 2024</a>`,
        MOSMAN_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseMosmanGpfsReportPage(
        `<a href="https://example.com/annual-financial-statements-2024-25.pdf">Financial Statements for the Year Ended 30 June 2025</a>`,
        MOSMAN_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Mosman Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectMosmanGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectMosmanGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = mutatePage(mosmanIncomePage(), "$ '000", '');
    const parsed = parseMosmanGpfsExtraction(
      extractionWith(6, () => withoutUnit),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Mosman Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and notes exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(18);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.unit_evidence).toBe('unit thousands detected in header');
    expect(reconciliation.income_statement_page).toBe(6);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.comprehensive_income_page).toBe(7);
    expect(reconciliation.depreciation_note_page).toBe(26);
    expect(reconciliation.employee_note_page).toBe(24);
    expect(reconciliation.materials_note_page).toBe(25);
    expect(reconciliation.other_expenses_note_page).toBe(27);
    expect(reconciliation.grants_note_page).toBe(21);
    expect(reconciliation.total_revenue).toBe(63_160);
    expect(reconciliation.total_expenses).toBe(54_367);
    expect(reconciliation.employee_expenses).toBe(19_986);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(6_939);
    expect(reconciliation.government_grants_operating).toBe(3_213);
    expect(reconciliation.government_grants_capital).toBe(3_154);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(371);
    expect(reconciliation.net_share_of_joint_ventures).toBe(213);
    expect(reconciliation.net_result).toBe(8_794);
    expect(reconciliation.operating_result).toBe(8_794);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(15_733);
    expect(reconciliation.net_result_before_capital_grants).toBe(5_640);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(47_427);
    expect(reconciliation.revenue_components_sum).toBe(63_160);
    expect(reconciliation.expense_components_sum).toBe(47_427);
    expect(reconciliation.face_expense_bridge).toBe(54_366);
    expect(reconciliation.functions_total_income).toBe(63_161);
    expect(reconciliation.functions_total_expenses).toBe(54_367);
    expect(reconciliation.functions_operating_result).toBe(8_794);
    expect(reconciliation.functions_grants_and_contributions).toBe(6_367);
    expect(reconciliation.comprehensive_income_net_result).toBe(8_794);
    expect(reconciliation.comprehensive_income_other).toBe(41_444);
    expect(reconciliation.comprehensive_income_total).toBe(50_238);
    expect(reconciliation.depreciation_note_total).toBe(6_939);
    expect(reconciliation.employee_note_total).toBe(19_986);
    expect(reconciliation.materials_note_total).toBe(23_064);
    expect(reconciliation.other_expenses_note_total).toBe(3_793);
    expect(reconciliation.grants_note_operating).toBe(3_213);
    expect(reconciliation.grants_note_capital).toBe(3_154);
    expect(reconciliation.printed_rounding_differences).toHaveLength(2);
    expect(reconciliation.printed_rounding_differences.join(' ')).toMatch(/\$1 thousand/);
    expect(reconciliation.human_spot_check_required).toBe(true);
    expect(reconciliation.checks.length).toBe(16);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(6_316_000_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(5_436_700_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_998_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      693_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(321_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(315_400_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(879_400_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      4_742_700_000,
    );
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').human_spot_check).toBe('required');
  });

  it('rejects a face statement that does not reconcile to the printed total', () => {
    const mutated = mutatePage(mosmanIncomePage(), '32,821 31,018', '32,822 31,018');
    const parsed = parseMosmanGpfsExtraction(
      extractionWith(6, () => mutated),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });
});

describe('Mosman Council GPFS natural keys', () => {
  it('is stable per source/document/line/fiscal year and distinct per line', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
    const url = CONTEXT.document.url;
    const revenue = mosmanGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = mosmanGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^mosman-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(mosmanGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(mosmanGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_mosmangpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: MOSMAN_GPFS_ID,
    name: MOSMAN_GPFS_NAME,
    publisher: MOSMAN_GPFS_PUBLISHER,
    source_url: MOSMAN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'mosman-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Mosman Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: MOSMAN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-mosman-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Mosman Council',
        delivery_entity: 'Mosman Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-MOSMAN-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase MOSMAN COUNCIL',
        delivery_entity: 'MOSMAN COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-mosman-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Mosman Community Care Incorporated',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'north-sydney-gpfs',
        source_url: 'https://www.northsydney.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-north-sydney-gpfs-1',
        project_name: 'Existing North Sydney Council GPFS row',
        delivery_entity: 'North Sydney Council',
        aggregation_role: 'agency_detail',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-mosman-project',
        project_name: 'Existing NSW Budget project whose name mentions Mosman',
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
    expect(await MeasureModel.countDocuments({ source_id: 'north-sydney-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: MOSMAN_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(23);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: MOSMAN_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(23);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Mosman Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'MOSMAN COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Mosman Council' })).toBe(19);
    expect(await MeasureModel.countDocuments({ delivery_entity: /^mosman council$/i })).toBe(20);
    expect(await MeasureModel.countDocuments({ delivery_entity: /mosman/i })).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: MOSMAN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MOSMAN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MOSMAN_GPFS_ID,
        delivery_entity: { $ne: MOSMAN_GPFS_DELIVERY_ENTITY },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: MOSMAN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
