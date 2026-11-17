import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  CUMBERLAND_GPFS_DELIVERY_ENTITY,
  CUMBERLAND_GPFS_FISCAL_YEAR,
  CUMBERLAND_GPFS_ID,
  CUMBERLAND_GPFS_LICENSE,
  CUMBERLAND_GPFS_NAME,
  CUMBERLAND_GPFS_PUBLISHER,
  CUMBERLAND_GPFS_REPORTING_URL,
  cumberlandGpfsNaturalKey,
  detectCumberlandGpfsUnit,
  discoverCumberlandGpfsDocument,
  fiscalYearFromCumberlandGpfsLink,
  parseCumberlandGpfsExtraction,
  parseCumberlandGpfsReportPage,
  type CumberlandGpfsParseContext,
} from '../src/connectors/cumberland-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './cumberland-gpfs.fixture.js';

// Cumberland publishes a dedicated Annual Financial Statements PDF. The Income
// Statement prints the Original unaudited budget amount before each line label in
// the PDF text stream, so each emitted value is the first amount after the label
// (the FY2024-25 actual). The expense subtotal contains the phrase
// "depreciation, amortisation and impairment of non-financial assets", so the
// actual depreciation line is read from the last occurrence. Total expenses is
// the printed face-statement bridge; the B1-1 printed total is $1k lower because
// its function rows are rounded, and that difference is retained as evidence.

function textPage(text: string, pageNumber: number, items: PdfPage['items'] = []): PdfPage {
  return { page_number: pageNumber, text, items };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '4c1d003cd8a27e72e71c9ebd75bd80f1c67931ef551b4baa3d7c0010d4dc267e',
      bytes: 7_165_368,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 5),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 6),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 15),
      textPage(DEPRECIATION_TEXT, 28),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.cumberland.nsw.gov.au/sites/default/files/inline-files/cumberland-council-annual-financial-statements-2024-2025.pdf';

const CONTEXT: CumberlandGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statements 2024-2025',
    url: PDF_URL,
    fiscal_year: CUMBERLAND_GPFS_FISCAL_YEAR,
    listing_url: CUMBERLAND_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/cumberland-gpfs/cumberland-city-council-annual-financial-statements-2024-25.pdf',
    sha256: '4c1d003cd8a27e72e71c9ebd75bd80f1c67931ef551b4baa3d7c0010d4dc267e',
    bytes: 7_165_368,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: CUMBERLAND_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseCumberlandGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Cumberland City Council GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official Key council reports page, not a hard-coded PDF URL', () => {
    const pageHtml = `
      <a href="/sites/default/files/inline-files/cumberland-council-annual-financial-statements-2023.pdf">Annual Financial Statements 2023-2024</a>
      <a href="/sites/default/files/inline-files/annual-report-2024-2025.pdf" title="Annual Report 2024-2025">Annual Report 2024-2025</a>
      <a href="/sites/default/files/inline-files/cumberland-council-annual-financial-statements-2024-2025.pdf" title="Annual Financial Statements 2024-2025">Annual Financial Statements 2024-2025</a>
    `;
    expect(
      parseCumberlandGpfsReportPage(pageHtml, CUMBERLAND_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: PDF_URL,
      title: 'Annual Financial Statements 2024-2025',
    });
    expect(fiscalYearFromCumberlandGpfsLink('Annual Financial Statements 2024-2025')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromCumberlandGpfsLink('Annual Financial Statements 2023-2024')).toBe(
      '2023-24',
    );
    expect(fiscalYearFromCumberlandGpfsLink('Annual Financial Statements 2025/26')).toBe('2025-26');
    expect(fiscalYearFromCumberlandGpfsLink('Annual Financial Statements 2024 to 2025')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromCumberlandGpfsLink('Financial statements year ended 30 June 2025')).toBe(
      '2024-25',
    );
  });

  it('resolves the PDF through the official listing', async () => {
    const discovered = await discoverCumberlandGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="${PDF_URL}">Annual Financial Statements 2024-2025</a>`,
    });
    expect(discovered.title).toBe('Annual Financial Statements 2024-2025');
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(CUMBERLAND_GPFS_REPORTING_URL);
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    expect(
      parseCumberlandGpfsReportPage(
        '<a href="/sites/default/files/inline-files/cumberland-council-annual-financial-statements-2023.pdf">Annual Financial Statements 2023-2024</a>',
        CUMBERLAND_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseCumberlandGpfsReportPage(
        '<a href="https://example.com/annual-financial-statements-2024-2025.pdf">Annual Financial Statements 2024-2025</a>',
        CUMBERLAND_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Cumberland City Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCumberlandGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCumberlandGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseCumberlandGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Cumberland City Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1 and note B3-3 exactly, retaining the published $1k B1-1 rounding', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(277_139);
    expect(reconciliation.total_expenses).toBe(242_565);
    expect(reconciliation.employee_expenses).toBe(95_814);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(48_954);
    expect(reconciliation.government_grants_operating).toBe(16_225);
    expect(reconciliation.government_grants_capital).toBe(26_185);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(261);
    expect(reconciliation.net_result).toBe(34_574);
    expect(reconciliation.operating_result).toBe(34_574);
    expect(reconciliation.net_result_before_capital_grants).toBe(8_389);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(193_611);
    expect(reconciliation.revenue_components_sum).toBe(277_139);
    expect(reconciliation.expense_components_sum).toBe(193_611);
    expect(reconciliation.face_expense_bridge).toBe(242_565);
    expect(reconciliation.functions_total_income).toBe(277_139);
    expect(reconciliation.functions_total_expenses).toBe(242_564);
    expect(reconciliation.functions_operating_result).toBe(34_575);
    expect(reconciliation.functions_grants_and_contributions).toBe(42_410);
    expect(reconciliation.comprehensive_income_net_result).toBe(34_574);
    expect(reconciliation.comprehensive_income_total).toBe(82_589);
    expect(reconciliation.depreciation_note_total).toBe(48_954);
    expect(reconciliation.depreciation_impairment_note_total).toBe(48_954);
    expect(reconciliation.income_statement_page).toBe(5);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.comprehensive_income_page).toBe(6);
    expect(reconciliation.depreciation_note_page).toBe(28);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(27_713_900_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(24_256_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(9_581_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      4_895_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_622_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(2_618_500_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(26_100_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(3_457_400_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      19_361_100_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(17_262_400_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    // The printed before-capital surplus is evidence only and is not a row.
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
        source_id: CUMBERLAND_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: CUMBERLAND_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Cumberland City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Cumberland City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^cumberland-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const broken = FUNCTIONS_TEXT.replace(
      'Total functions and activities 277,139 289,323 242,564',
      'Total functions and activities 277,139 289,323 242,664',
    );
    const parsed = parseCumberlandGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('172,624 163,679', '172,724 163,679');
    const parsed = parseCumberlandGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 34,574',
      'from Income Statement 34,500',
    );
    const parsed = parseCumberlandGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-3 depreciation no longer bridges', () => {
    const broken = DEPRECIATION_TEXT.replace(
      'Total depreciation and amortisation costs 48,954 47,765',
      'Total depreciation and amortisation costs 48,854 47,765',
    );
    const parsed = parseCumberlandGpfsExtraction(extraction({}), CONTEXT);
    const brokenExtraction = extraction();
    brokenExtraction.pages[3] = textPage(broken, 28);
    const parsedBroken = parseCumberlandGpfsExtraction(brokenExtraction, CONTEXT);
    expect(parsed.records).toHaveLength(17);
    expect(parsedBroken.records).toEqual([]);
    expect(parsedBroken.reconciliation).toBeNull();
    expect(parsedBroken.rejections[0]!.reason).toMatch(/reconciliation failed/);
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
    const revenue = cumberlandGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = cumberlandGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^cumberland-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(cumberlandGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(cumberlandGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_cumberlandgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CUMBERLAND_GPFS_ID,
    name: CUMBERLAND_GPFS_NAME,
    publisher: CUMBERLAND_GPFS_PUBLISHER,
    source_url: CUMBERLAND_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CUMBERLAND_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'cumberland-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Cumberland City Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: CUMBERLAND_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-cumberland-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Cumberland City Council',
        delivery_entity: 'Cumberland City Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-CUMBERLAND-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase CUMBERLAND COUNCIL',
        delivery_entity: 'CUMBERLAND COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-cumberland-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Cumberland Community Radio Incorporated',
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
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-cumberland-project',
        project_name: 'Existing NSW Budget project whose name mentions Cumberland',
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
    expect(await MeasureModel.countDocuments({ source_id: CUMBERLAND_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: CUMBERLAND_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Cumberland City Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'CUMBERLAND COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Cumberland City Council' })).toBe(
      18,
    );
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^cumberland city council$/i }),
    ).toBe(18);

    expect(
      await MeasureModel.countDocuments({
        source_id: CUMBERLAND_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CUMBERLAND_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CUMBERLAND_GPFS_ID,
        delivery_entity: { $ne: 'Cumberland City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: CUMBERLAND_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
