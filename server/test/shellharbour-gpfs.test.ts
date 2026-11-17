import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  SHELLHARBOUR_GPFS_DELIVERY_ENTITY,
  SHELLHARBOUR_GPFS_FISCAL_YEAR,
  SHELLHARBOUR_GPFS_ID,
  SHELLHARBOUR_GPFS_LICENSE,
  SHELLHARBOUR_GPFS_NAME,
  SHELLHARBOUR_GPFS_PUBLISHER,
  SHELLHARBOUR_GPFS_REPORTING_URL,
  detectShellharbourGpfsUnit,
  discoverShellharbourGpfsDocument,
  fiscalYearFromShellharbourGpfsLink,
  parseShellharbourGpfsAnnualReportLink,
  parseShellharbourGpfsExtraction,
  parseShellharbourGpfsReportPage,
  shellharbourGpfsNaturalKey,
  type ShellharbourGpfsParseContext,
} from '../src/connectors/shellharbour-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './shellharbour-gpfs.fixture.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so each value read is the first amount after the label (the
// FY2024-25 actual). The expense subtotal and the "operating result excluding
// depreciation" line both contain the phrase "depreciation, amortisation and
// impairment of non-financial assets", so the actual depreciation line is read
// from the last occurrence. The Income Statement does not print a combined
// total-expenses line; total expenses is the printed B1-1 "Total functions and
// activities" total, which equals the printed expenses-excluding-depreciation
// line plus the printed depreciation/impairment line.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'f199f5e22b095f1f6b7acae84fc7bbb9414c206a01936a92202e46448a8f2894',
      bytes: 58_205_018,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 54),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 55),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 63),
      textPage(DEPRECIATION_TEXT, 76),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://cdn.shellharbour.nsw.gov.au/sites/default/files/Reports/full-report_2_4.pdf';

const CONTEXT: ShellharbourGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Report - 2024 - 2025',
    url: PDF_URL,
    fiscal_year: SHELLHARBOUR_GPFS_FISCAL_YEAR,
    listing_url: SHELLHARBOUR_GPFS_REPORTING_URL,
    report_page_url:
      'https://www.shellharbour.nsw.gov.au/council/forms-and-publications/annual-reports/annual-report-2024-2025',
    audited_statements_url: 'https://online.fliphtml5.com/usyo/txhe/#p=96',
  },
  archive: {
    local_path: '/home/steve/ausspend-source-archive/shellharbour-gpfs/full-report_2_4.pdf',
    sha256: 'f199f5e22b095f1f6b7acae84fc7bbb9414c206a01936a92202e46448a8f2894',
    bytes: 58_205_018,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: SHELLHARBOUR_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseShellharbourGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Shellharbour GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official pages, not a hard-coded PDF URL', () => {
    const indexHtml = `
      <a href="/council/news-and-publications/annual-reports">Annual reports</a>
      <a href="/council/forms-and-publications/annual-reports/annual-report-2024-2025">2024 to 2025</a>
      <a href="/council/forms-and-publications/annual-reports/annual-report-2023-2024">2023 to 2024</a>
    `;
    const reportPageHtml = `
      <a href="https://online.fliphtml5.com/usyo/txhe/#p=96" rel="nofollow">Audited Financial Statements for year ending 30 June 2025</a>
      <a href="https://cdn.shellharbour.nsw.gov.au/sites/default/files/Reports/full-report_2_4.pdf">Annual Report - 2024 - 2025</a>
    `;
    expect(
      parseShellharbourGpfsAnnualReportLink(indexHtml, SHELLHARBOUR_GPFS_REPORTING_URL, '2024-25'),
    ).toBe(
      'https://www.shellharbour.nsw.gov.au/council/forms-and-publications/annual-reports/annual-report-2024-2025',
    );
    expect(
      parseShellharbourGpfsReportPage(
        reportPageHtml,
        'https://www.shellharbour.nsw.gov.au/council/forms-and-publications/annual-reports/annual-report-2024-2025',
        '2024-25',
      ),
    ).toEqual({
      pdfUrl: PDF_URL,
      title: 'Annual Report - 2024 - 2025',
      auditedStatementsUrl: 'https://online.fliphtml5.com/usyo/txhe/#p=96',
    });
    expect(fiscalYearFromShellharbourGpfsLink('Annual Report - 2024 - 2025')).toBe('2024-25');
    expect(fiscalYearFromShellharbourGpfsLink('2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromShellharbourGpfsLink('year ending 30 June 2025')).toBe('2024-25');
    expect(fiscalYearFromShellharbourGpfsLink('Annual Report 2023 - 2024')).toBe('2023-24');
  });

  it('resolves the PDF through the official annual-report page', async () => {
    const discovered = await discoverShellharbourGpfsDocument(globalThis.fetch, '2024-25', {
      indexHtml:
        '<a href="/council/forms-and-publications/annual-reports/annual-report-2024-2025">2024 to 2025</a>',
      reportPageHtml: `<a href="${PDF_URL}">Annual Report - 2024 - 2025</a>
        <a href="https://online.fliphtml5.com/usyo/txhe/#p=96">Audited Financial Statements for year ending 30 June 2025</a>`,
    });
    expect(discovered.title).toBe('Annual Report - 2024 - 2025');
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.report_page_url).toContain('annual-report-2024-2025');
    expect(discovered.audited_statements_url).toBe('https://online.fliphtml5.com/usyo/txhe/#p=96');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    expect(
      parseShellharbourGpfsAnnualReportLink(
        '<a href="/council/forms-and-publications/annual-reports/annual-report-2023-2024">2023 to 2024</a>',
        SHELLHARBOUR_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Shellharbour GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectShellharbourGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectShellharbourGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseShellharbourGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Shellharbour GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles them exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(310_293);
    expect(reconciliation.total_expenses).toBe(236_395);
    expect(reconciliation.employee_expenses).toBe(47_263);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(29_784);
    expect(reconciliation.government_grants_operating).toBe(8_535);
    expect(reconciliation.government_grants_capital).toBe(36_357);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(1_897);
    expect(reconciliation.net_result).toBe(73_898);
    expect(reconciliation.operating_result).toBe(73_898);
    expect(reconciliation.net_result_before_capital_grants).toBe(37_541);
    // The repeated depreciation phrase must read the actual line (29,784),
    // never the expense subtotal (206,611) or the excluding-depreciation result.
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(206_611);
    expect(reconciliation.revenue_components_sum).toBe(310_293);
    expect(reconciliation.expense_components_sum).toBe(206_611);
    expect(reconciliation.face_expense_bridge).toBe(236_395);
    expect(reconciliation.functions_total_income).toBe(310_293);
    expect(reconciliation.functions_total_expenses).toBe(236_395);
    expect(reconciliation.functions_operating_result).toBe(73_898);
    expect(reconciliation.functions_grants_and_contributions).toBe(44_892);
    expect(reconciliation.comprehensive_income_net_result).toBe(73_898);
    expect(reconciliation.depreciation_note_total).toBe(29_784);
    expect(reconciliation.income_statement_page).toBe(54);
    expect(reconciliation.functions_page).toBe(63);
    expect(reconciliation.comprehensive_income_page).toBe(55);
    expect(reconciliation.depreciation_note_page).toBe(76);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(31_029_300_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(23_639_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(4_726_300_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_978_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(853_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(3_635_700_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      189_700_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(7_389_800_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      20_661_100_000,
    );
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
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
        source_id: SHELLHARBOUR_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: SHELLHARBOUR_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Shellharbour City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Shellharbour City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^shellharbour-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    // Every row is non-additive agency detail; summing the printed rows is never the total.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace('236,395 136,232', '236,495 136,232');
    const parsed = parseShellharbourGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('80,251 75,160', '80,351 75,160');
    const parsed = parseShellharbourGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 73,898',
      'from Income Statement 73,000',
    );
    const parsed = parseShellharbourGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = shellharbourGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = shellharbourGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^shellharbour-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(shellharbourGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(shellharbourGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_shellharbourgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: SHELLHARBOUR_GPFS_ID,
    name: SHELLHARBOUR_GPFS_NAME,
    publisher: SHELLHARBOUR_GPFS_PUBLISHER,
    source_url: SHELLHARBOUR_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: SHELLHARBOUR_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'shellharbour-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Shellharbour GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: SHELLHARBOUR_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-Shellharbour-City-Council-existing-1',
        project_name:
          'Existing GrantConnect grant under the exact string Shellharbour City Council',
        delivery_entity: 'Shellharbour City Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-COUNCIL-OF-THE-CITY-OF-SHELLHARBOUR-existing',
        project_name:
          'Existing AusTender contract under the legal name Council of the City of Shellharbour',
        delivery_entity: 'COUNCIL OF THE CITY OF SHELLHARBOUR',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-shellharbour-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Shellharbour Surf Life Saving Club Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'shoalhaven-gpfs',
        source_url: 'https://www.shoalhaven.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-shoalhaven-gpfs-1',
        project_name: 'Existing Shoalhaven City GPFS row',
        delivery_entity: 'Shoalhaven City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-shellharbour-project',
        project_name: 'Existing NSW Budget project whose name mentions Shellharbour',
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
    expect(await MeasureModel.countDocuments({ source_id: 'shoalhaven-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: SHELLHARBOUR_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'acnc-charity', 'nsw-budget'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.amount_cents)).toEqual([
      654_321, 128_500, 999_000, 42_000_000,
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: SHELLHARBOUR_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);
    // The pre-existing GrantConnect row keeps the exact string "Shellharbour
    // City Council". It is preserved untouched and never summed with the 17 GPFS
    // rows (which also carry that published entity name but a different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Shellharbour City Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: 'Shellharbour City Council' }),
    ).toBe(18);

    expect(
      await MeasureModel.countDocuments({
        source_id: SHELLHARBOUR_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: SHELLHARBOUR_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: SHELLHARBOUR_GPFS_ID,
        delivery_entity: { $ne: 'Shellharbour City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: SHELLHARBOUR_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
