import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  STRATHFIELD_GPFS_DELIVERY_ENTITY,
  STRATHFIELD_GPFS_FISCAL_YEAR,
  STRATHFIELD_GPFS_ID,
  STRATHFIELD_GPFS_NAME,
  STRATHFIELD_GPFS_PUBLISHER,
  STRATHFIELD_GPFS_REPORTING_URL,
  detectStrathfieldGpfsUnit,
  discoverStrathfieldGpfsDocument,
  fiscalYearFromStrathfieldGpfsLink,
  strathfieldGpfsNaturalKey,
  parseStrathfieldGpfsExtraction,
  parseStrathfieldGpfsReportPage,
  type StrathfieldGpfsParseContext,
} from '../src/connectors/strathfield-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  STRATHFIELD_PDF_BYTES,
  STRATHFIELD_PDF_SHA256,
  STRATHFIELD_PDF_URL,
  strathfieldExtraction,
  strathfieldIncomePage,
} from '../src/connectors/strathfield-gpfs/fixture-data.js';

// Strathfield publishes a standalone audited General Purpose Financial
// Statements PDF linked from its official Reports and Registers page under the
// printed link text "Annual Financial Statement 2024 - 2025". Its Income
// Statement prints the Original unaudited budget column first, the FY2024-25
// Actual column second and the FY2023-24 column third, each row's label and
// amounts on the same printed line. B1-1 and the face statement reconcile
// exactly; the printed before-capital result is negative and is evidence only.

const CONTEXT: StrathfieldGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statement 2024 - 2025',
    url: STRATHFIELD_PDF_URL,
    fiscal_year: STRATHFIELD_GPFS_FISCAL_YEAR,
    listing_url: STRATHFIELD_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/strathfield-gpfs/strathfield-municipal-council-financial-statements-2024-25.pdf',
    sha256: STRATHFIELD_PDF_SHA256,
    bytes: STRATHFIELD_PDF_BYTES,
    fetched_at: '2026-11-18T02:04:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: STRATHFIELD_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseStrathfieldGpfsExtraction(strathfieldExtraction(), CONTEXT);
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
  const base = strathfieldExtraction();
  const pages = base.pages.map((page) => (page.page_number === pageNumber ? mutate(page) : page));
  return { ...base, pages, text: pages.map((page) => page.text).join('\n') };
}

describe('Strathfield Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/council/reports-and-registers/annual-financial-statements-2023-2024.pdf">Annual Financial Statements 2023 - 2024<span class="file-info">(2MB)</span></a>
    <a href="/files/assets/public/v/1/council/reports-and-registers/strathfield-municipal-council-financial-statements-2024-25-final.pdf">Annual Financial Statement 2024 - 2025<span class="file-info">(5MB)</span></a>
    <a href="/files/assets/public/v/1/council/reports-and-registers/annual-financial-statement-2022-2023.pdf">Annual Financial Statement 2022 - 2023<span class="file-info">(3MB)</span></a>
    <a href="/files/assets/public/v/1/council/reports-and-registers/parking-infringements-report-december-2025.pdf">Parking infringements report December 2025</a>
  `;

  it('discovers the FY2024-25 financial statements from the official page, not a hard-coded PDF URL', () => {
    expect(
      parseStrathfieldGpfsReportPage(pageHtml, STRATHFIELD_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: STRATHFIELD_PDF_URL,
      title: 'Annual Financial Statement 2024 - 2025',
    });
    expect(fiscalYearFromStrathfieldGpfsLink('Annual Financial Statement 2024 - 2025')).toBe(
      '2024-25',
    );
    expect(
      fiscalYearFromStrathfieldGpfsLink(
        'strathfield-municipal-council-financial-statements-2024-25-final.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromStrathfieldGpfsLink('Financial Statements 2023/24')).toBe('2023-24');
  });

  it('resolves the PDF through the official listing HTML', async () => {
    const discovered = await discoverStrathfieldGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: pageHtml,
    });
    expect(discovered.title).toBe('Annual Financial Statement 2024 - 2025');
    expect(discovered.url).toBe(STRATHFIELD_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(STRATHFIELD_GPFS_REPORTING_URL);
  });

  it('does not select a future-year or prior-year statement', () => {
    expect(
      parseStrathfieldGpfsReportPage(
        `<a href="/annual-financial-statements-2026.pdf">Financial Statements for the Year Ended 30 June 2026</a>`,
        STRATHFIELD_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
    expect(
      parseStrathfieldGpfsReportPage(
        `<a href="/annual-financial-statements-2024.pdf">Financial Statements for the Year Ended 30 June 2024</a>`,
        STRATHFIELD_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseStrathfieldGpfsReportPage(
        `<a href="https://example.com/annual-financial-statements-2024-25.pdf">Annual Financial Statement 2024 - 2025</a>`,
        STRATHFIELD_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Strathfield Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectStrathfieldGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectStrathfieldGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = mutatePage(strathfieldIncomePage(), "$ '000", '');
    const parsed = parseStrathfieldGpfsExtraction(
      extractionWith(6, () => withoutUnit),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Strathfield Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and notes exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
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
    expect(reconciliation.total_revenue).toBe(73_908);
    expect(reconciliation.total_expenses).toBe(69_870);
    expect(reconciliation.employee_expenses).toBe(30_090);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(10_906);
    expect(reconciliation.government_grants_operating).toBe(3_163);
    expect(reconciliation.government_grants_capital).toBe(14_511);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(2_939);
    expect(reconciliation.net_result).toBe(4_038);
    expect(reconciliation.operating_result).toBe(4_038);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(14_944);
    expect(reconciliation.net_result_before_capital_grants).toBe(-10_473);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(58_964);
    expect(reconciliation.revenue_components_sum).toBe(73_908);
    expect(reconciliation.expense_components_sum).toBe(58_964);
    expect(reconciliation.face_expense_bridge).toBe(69_870);
    expect(reconciliation.functions_total_income).toBe(73_908);
    expect(reconciliation.functions_total_expenses).toBe(69_870);
    expect(reconciliation.functions_operating_result).toBe(4_038);
    expect(reconciliation.functions_grants_and_contributions).toBe(17_674);
    expect(reconciliation.comprehensive_income_net_result).toBe(4_038);
    expect(reconciliation.comprehensive_income_other).toBe(26_195);
    expect(reconciliation.comprehensive_income_total).toBe(30_233);
    expect(reconciliation.depreciation_note_total).toBe(10_906);
    expect(reconciliation.employee_note_total).toBe(30_090);
    expect(reconciliation.materials_note_total).toBe(24_085);
    expect(reconciliation.other_expenses_note_total).toBe(1_346);
    expect(reconciliation.grants_note_operating).toBe(3_163);
    expect(reconciliation.grants_note_capital).toBe(14_511);
    expect(reconciliation.printed_rounding_differences).toHaveLength(0);
    expect(reconciliation.human_spot_check_required).toBe(false);
    expect(reconciliation.checks.length).toBe(16);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(7_390_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(6_987_000_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(3_009_000_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_090_600_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(316_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_451_100_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(403_800_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      5_896_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').human_spot_check).toBeUndefined();
  });

  it('rejects a face statement that does not reconcile to the printed total', () => {
    const mutated = mutatePage(strathfieldIncomePage(), '41,903 36,920', '41,904 36,920');
    const parsed = parseStrathfieldGpfsExtraction(
      extractionWith(6, () => mutated),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });
});

describe('Strathfield Council GPFS natural keys', () => {
  it('is stable per source/document/line/fiscal year and distinct per line', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
    const url = CONTEXT.document.url;
    const revenue = strathfieldGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = strathfieldGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^strathfield-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(strathfieldGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(strathfieldGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_strathfieldgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: STRATHFIELD_GPFS_ID,
    name: STRATHFIELD_GPFS_NAME,
    publisher: STRATHFIELD_GPFS_PUBLISHER,
    source_url: STRATHFIELD_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'strathfield-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Strathfield Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: STRATHFIELD_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-strathfield-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Strathfield Council',
        delivery_entity: 'Strathfield Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-STRATHFIELD-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase STRATHFIELD COUNCIL',
        delivery_entity: 'STRATHFIELD COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-strathfield-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Strathfield Community Care Incorporated',
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
        natural_key: 'existing-nsw-budget-strathfield-project',
        project_name: 'Existing NSW Budget project whose name mentions Strathfield',
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
    expect(await MeasureModel.countDocuments({ source_id: STRATHFIELD_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: STRATHFIELD_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Strathfield Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'STRATHFIELD COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Strathfield Council' })).toBe(18);
    expect(await MeasureModel.countDocuments({ delivery_entity: /^strathfield council$/i })).toBe(
      19,
    );
    expect(await MeasureModel.countDocuments({ delivery_entity: /strathfield/i })).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: STRATHFIELD_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: STRATHFIELD_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: STRATHFIELD_GPFS_ID,
        delivery_entity: { $ne: STRATHFIELD_GPFS_DELIVERY_ENTITY },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: STRATHFIELD_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
