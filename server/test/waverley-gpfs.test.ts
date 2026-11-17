import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WAVERLEY_GPFS_DELIVERY_ENTITY,
  WAVERLEY_GPFS_FISCAL_YEAR,
  WAVERLEY_GPFS_ID,
  WAVERLEY_GPFS_LICENSE,
  WAVERLEY_GPFS_NAME,
  WAVERLEY_GPFS_PUBLISHER,
  WAVERLEY_GPFS_REPORTING_URL,
  detectWaverleyGpfsUnit,
  discoverWaverleyGpfsDocument,
  fiscalYearFromWaverleyGpfsLink,
  parseWaverleyGpfsExtraction,
  parseWaverleyGpfsReportPage,
  waverleyGpfsNaturalKey,
  type WaverleyGpfsParseContext,
} from '../src/connectors/waverley-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './waverley-gpfs.fixture.js';

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
      sha256: 'b62cd275e63ae3ab8c7d72c9c84480f526e8829bcde9bbceed185d9a068216da',
      bytes: 5_312_088,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 9),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 10),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 18),
      textPage(DEPRECIATION_TEXT, 32),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.waverley.nsw.gov.au/__data/assets/pdf_file/0006/250359/Annual_Financial_Statements_2025.pdf';

const CONTEXT: WaverleyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Statement of Accounts 2024-2025',
    url: PDF_URL,
    fiscal_year: WAVERLEY_GPFS_FISCAL_YEAR,
    listing_url: WAVERLEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/waverley-gpfs/Annual_Financial_Statements_2025.pdf',
    sha256: 'b62cd275e63ae3ab8c7d72c9c84480f526e8829bcde9bbceed185d9a068216da',
    bytes: 5_312_088,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: WAVERLEY_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseWaverleyGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Waverley GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official page, not a hard-coded PDF URL', () => {
    const indexHtml = `
      <a href="/council/policies_plans_strategies_and_reports/annual_statement_of_accounts">Annual Statement of Accounts</a>
      <a href="https://www.waverley.nsw.gov.au/__data/assets/pdf_file/0007/262978/Annual_Financial_Statements_2025-2026.pdf">Annual Statement of Accounts 2025-2026</a>
      <a href="/__data/assets/pdf_file/0006/250359/Annual_Financial_Statements_2025.pdf">Annual Statement of Accounts 2024-2025</a>
      <a href="/media/documents/council/annual_statements/Audited_Annual_Financial_Statements_2023_24.pdf">Annual Statement of Accounts 2023-2024</a>
    `;
    expect(parseWaverleyGpfsReportPage(indexHtml, WAVERLEY_GPFS_REPORTING_URL, '2024-25')).toEqual({
      pdfUrl: PDF_URL,
      title: 'Annual Statement of Accounts 2024-2025',
    });
    expect(fiscalYearFromWaverleyGpfsLink('Annual Statement of Accounts 2024-2025')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromWaverleyGpfsLink('Annual Statement of Accounts 2025-2026')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromWaverleyGpfsLink('Annual Report 2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromWaverleyGpfsLink('year ending 30 June 2025')).toBe('2024-25');
    expect(fiscalYearFromWaverleyGpfsLink('Annual Statement of Accounts 2023-2024')).toBe(
      '2023-24',
    );
  });

  it('resolves the PDF through the official annual statement of accounts page', async () => {
    const discovered = await discoverWaverleyGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="https://www.waverley.nsw.gov.au/__data/assets/pdf_file/0007/262978/Annual_Financial_Statements_2025-2026.pdf">Annual Statement of Accounts 2025-2026</a>
        <a href="${PDF_URL}">Annual Statement of Accounts 2024-2025</a>`,
    });
    expect(discovered.title).toBe('Annual Statement of Accounts 2024-2025');
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(WAVERLEY_GPFS_REPORTING_URL);
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    expect(
      parseWaverleyGpfsReportPage(
        '<a href="/media/documents/council/annual_statements/Audited_Annual_Financial_Statements_2023_24.pdf">Annual Statement of Accounts 2023-2024</a>',
        WAVERLEY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a PDF link on a non-council host', () => {
    expect(
      parseWaverleyGpfsReportPage(
        '<a href="https://example.com/Annual_Financial_Statements_2025.pdf">Annual Statement of Accounts 2024-2025</a>',
        WAVERLEY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Waverley GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectWaverleyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectWaverleyGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseWaverleyGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Waverley GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles them exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(184_205);
    expect(reconciliation.total_expenses).toBe(172_852);
    expect(reconciliation.employee_expenses).toBe(86_877);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(22_441);
    expect(reconciliation.government_grants_operating).toBe(7_498);
    expect(reconciliation.government_grants_capital).toBe(16_122);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(6_795);
    expect(reconciliation.net_result).toBe(11_353);
    expect(reconciliation.operating_result).toBe(11_353);
    expect(reconciliation.net_result_before_capital_grants).toBe(-4_769);
    // The repeated depreciation phrase must read the actual line (22,441), never
    // the expense subtotal (150,411) or the excluding-depreciation result.
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(150_411);
    expect(reconciliation.revenue_components_sum).toBe(184_205);
    expect(reconciliation.expense_components_sum).toBe(150_411);
    expect(reconciliation.face_expense_bridge).toBe(172_852);
    expect(reconciliation.functions_total_income).toBe(184_205);
    expect(reconciliation.functions_total_expenses).toBe(172_852);
    expect(reconciliation.functions_operating_result).toBe(11_353);
    expect(reconciliation.functions_grants_and_contributions).toBe(23_620);
    expect(reconciliation.comprehensive_income_net_result).toBe(11_353);
    expect(reconciliation.depreciation_note_total).toBe(22_441);
    expect(reconciliation.income_statement_page).toBe(9);
    expect(reconciliation.functions_page).toBe(18);
    expect(reconciliation.comprehensive_income_page).toBe(10);
    expect(reconciliation.depreciation_note_page).toBe(32);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(18_420_500_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(17_285_200_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(8_687_700_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_244_100_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(749_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_612_200_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      679_500_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(1_135_300_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      15_041_100_000,
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
        source_id: WAVERLEY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: WAVERLEY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Waverley Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Waverley Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^waverley-gpfs:[a-f0-9]{40}$/);
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
    const broken = FUNCTIONS_TEXT.replace('172,852 159,686', '172,952 159,686');
    const parsed = parseWaverleyGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('73,603 70,268', '73,703 70,268');
    const parsed = parseWaverleyGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 11,353',
      'from Income Statement 11,000',
    );
    const parsed = parseWaverleyGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = waverleyGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = waverleyGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^waverley-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(waverleyGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(waverleyGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_waverleygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: WAVERLEY_GPFS_ID,
    name: WAVERLEY_GPFS_NAME,
    publisher: WAVERLEY_GPFS_PUBLISHER,
    source_url: WAVERLEY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WAVERLEY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'waverley-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Waverley GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: WAVERLEY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-Waverley-Council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Waverley Council',
        delivery_entity: 'Waverley Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-WAVERLEY-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase WAVERLEY COUNCIL',
        delivery_entity: 'WAVERLEY COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-waverley-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Waverley Community Out of School Care',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'shellharbour-gpfs',
        source_url: 'https://cdn.shellharbour.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-shellharbour-gpfs-1',
        project_name: 'Existing Shellharbour City GPFS row',
        delivery_entity: 'Shellharbour City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-waverley-project',
        project_name: 'Existing NSW Budget project whose name mentions Waverley',
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
    expect(await MeasureModel.countDocuments({ source_id: 'shellharbour-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: WAVERLEY_GPFS_ID })).toBe(17);
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
    expect(await MeasureModel.countDocuments({ source_id: WAVERLEY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);
    // The pre-existing GrantConnect row keeps the exact string "Waverley
    // Council" and the AusTender row the uppercase "WAVERLEY COUNCIL". Both are
    // preserved untouched and never summed with the 17 GPFS rows (which also
    // carry that published entity name but a different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Waverley Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'WAVERLEY COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Waverley Council' })).toBe(18);
    expect(await MeasureModel.countDocuments({ delivery_entity: /^waverley council$/i })).toBe(19);

    expect(
      await MeasureModel.countDocuments({
        source_id: WAVERLEY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WAVERLEY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WAVERLEY_GPFS_ID,
        delivery_entity: { $ne: 'Waverley Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: WAVERLEY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
