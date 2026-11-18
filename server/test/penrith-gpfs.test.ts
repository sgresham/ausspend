import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  PENRITH_GPFS_DELIVERY_ENTITY,
  PENRITH_GPFS_FISCAL_YEAR,
  PENRITH_GPFS_ID,
  PENRITH_GPFS_LICENSE,
  PENRITH_GPFS_NAME,
  PENRITH_GPFS_PUBLISHER,
  PENRITH_GPFS_REPORTING_URL,
  detectPenrithGpfsUnit,
  discoverPenrithGpfsDocument,
  fiscalYearFromPenrithGpfsLink,
  parsePenrithGpfsExtraction,
  parsePenrithGpfsReportPage,
  penrithGpfsNaturalKey,
  type PenrithGpfsParseContext,
} from '../src/connectors/penrith-gpfs/index.js';
import {
  PENRITH_COMPREHENSIVE_TEXT,
  PENRITH_DEPRECIATION_TEXT,
  PENRITH_FUNCTIONS_TEXT,
  PENRITH_INCOME_TEXT,
  PENRITH_PDF_SHA256,
  PENRITH_PDF_URL,
  penrithExtraction,
} from '../src/connectors/penrith-gpfs/fixture-data.js';
import { PENRITH_GPFS_ROW_COUNT } from '../src/connectors/penrith-gpfs/fixture.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so the FY2024-25 actual is the first amount after the label. Three
// long expense labels have the budget amount interleaved before the word
// "assets", so their actual is the second amount after the visible label. Total
// expenses is the printed face-statement bridge: printed expenses excluding
// depreciation plus printed depreciation, equal to the printed B1-1 total.

const CONTEXT: PenrithGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Penrith City Council Financial Statements 2024-25',
    url: PENRITH_PDF_URL,
    fiscal_year: PENRITH_GPFS_FISCAL_YEAR,
    listing_url: PENRITH_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/penrith-gpfs/penrith-city-council-financial-statements-2024-25.pdf',
    sha256: PENRITH_PDF_SHA256,
    bytes: 4_155_530,
    fetched_at: '2026-11-18T03:30:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: PENRITH_GPFS_REPORTING_URL,
};

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: PENRITH_PDF_SHA256,
      bytes: 4_155_530,
    },
    pages: [
      textPage(overrides.income ?? PENRITH_INCOME_TEXT, 6),
      textPage(overrides.comprehensive ?? PENRITH_COMPREHENSIVE_TEXT, 7),
      textPage(overrides.functions ?? PENRITH_FUNCTIONS_TEXT, 15),
      textPage(PENRITH_DEPRECIATION_TEXT, 30),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

function parsedFixture() {
  return parsePenrithGpfsExtraction(penrithExtraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Penrith GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official page, not a hard-coded PDF URL', () => {
    const indexHtml = `
      <h2>Financial Statements</h2>
      <a href="https://www.penrithcity.nsw.gov.au/images/documents/resources-documents/documents/2023-24%20Annual%20Report%20-%20ACCESIBILE_compressed.pdf">2023-24 Annual Report</a>
      <a href="https://www.penrithcity.nsw.gov.au/images/documents/resources-documents/documents/annual_financial_statements_2023-24_final.pdf">2023-24 Financial Statements</a>
      <a href="https://www.penrithcity.nsw.gov.au/images/documents/resources-documents/documents/2025_financial_statements_audited.pdf">2024-25 Financial Statements</a>
    `;
    expect(parsePenrithGpfsReportPage(indexHtml, PENRITH_GPFS_REPORTING_URL, '2024-25')).toEqual({
      pdfUrl: PENRITH_PDF_URL,
      title:
        'Penrith City Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    });
    expect(fiscalYearFromPenrithGpfsLink('2024-25 Financial Statements')).toBe('2024-25');
    expect(fiscalYearFromPenrithGpfsLink('financial-statements-2024-25.pdf')).toBe('2024-25');
    // The publisher's bare CMS filename carries no year pair of its own; the
    // anchor text ("2024-25 Financial Statements") is what identifies it.
    expect(fiscalYearFromPenrithGpfsLink('2025_financial_statements_audited.pdf')).toBeNull();
    expect(fiscalYearFromPenrithGpfsLink('Financial Statements - 2025/26')).toBe('2025-26');
    expect(fiscalYearFromPenrithGpfsLink('Year ended 30 June 2025')).toBe('2024-25');
  });

  it('resolves the PDF through the official page HTML', async () => {
    const discovered = await discoverPenrithGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml:
        '<a href="https://www.penrithcity.nsw.gov.au/images/documents/resources-documents/documents/2025_financial_statements_audited.pdf">2024-25 Financial Statements</a>',
    });
    expect(discovered.title).toBe(
      'Penrith City Council Financial Statements 2024-25 (General Purpose Financial Statements)',
    );
    expect(discovered.url).toBe(PENRITH_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(PENRITH_GPFS_REPORTING_URL);
  });

  it('does not select a prior-year, later-year or non-financial-statements link', () => {
    expect(
      parsePenrithGpfsReportPage(
        '<a href="https://www.penrithcity.nsw.gov.au/images/documents/resources-documents/documents/annual_financial_statements_2023-24_final.pdf">2023-24 Financial Statements</a>',
        PENRITH_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
    expect(
      parsePenrithGpfsReportPage(
        '<a href="https://www.penrithcity.nsw.gov.au/images/documents/resources-documents/documents/2026_financial_statements_audited.pdf">2025-26 Financial Statements</a>',
        PENRITH_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
    expect(
      parsePenrithGpfsReportPage(
        '<a href="https://www.penrithcity.nsw.gov.au/images/documents/resources-documents/AnnualReport_2025%20FINAL%20Digital.pdf">2024-25 Annual Report</a>',
        PENRITH_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parsePenrithGpfsReportPage(
        '<a href="https://example.com/2025_financial_statements_audited.pdf">2024-25 Financial Statements</a>',
        PENRITH_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Penrith GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectPenrithGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectPenrithGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = PENRITH_INCOME_TEXT.split("$ '000").join('');
    const parsed = parsePenrithGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Penrith GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(390_526);
    expect(reconciliation.total_expenses).toBe(339_459);
    expect(reconciliation.employee_expenses).toBe(148_610);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(71_376);
    expect(reconciliation.government_grants_operating).toBe(26_250);
    expect(reconciliation.government_grants_capital).toBe(62_032);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(3_966);
    expect(reconciliation.net_result).toBe(51_067);
    expect(reconciliation.operating_result).toBe(51_067);
    expect(reconciliation.net_result_before_capital_grants).toBe(-10_965);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(268_083);
    expect(reconciliation.revenue_components_sum).toBe(390_526);
    expect(reconciliation.expense_components_sum).toBe(268_083);
    expect(reconciliation.face_expense_bridge).toBe(339_459);
    expect(reconciliation.functions_total_income).toBe(390_526);
    expect(reconciliation.functions_total_expenses).toBe(339_459);
    expect(reconciliation.functions_operating_result).toBe(51_067);
    expect(reconciliation.functions_grants_and_contributions).toBe(88_282);
    expect(reconciliation.comprehensive_income_net_result).toBe(51_067);
    expect(reconciliation.depreciation_note_total).toBe(71_376);
    expect(reconciliation.income_statement_page).toBe(6);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.comprehensive_income_page).toBe(7);
    expect(reconciliation.depreciation_note_page).toBe(30);
    expect(parsed.rejections).toEqual([]);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(39_052_600_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(33_945_900_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(14_861_000_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      7_137_600_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_625_000_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(6_203_200_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      396_600_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(5_106_700_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      26_808_300_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(21_276_300_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    // The printed before-capital deficit is evidence only and is not a row.
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
        source_id: PENRITH_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: PENRITH_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Penrith City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Penrith City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^penrith-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'employee_expenses').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    // Every row is non-additive agency detail; summing the printed rows is never the total.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 totals no longer reconcile', () => {
    const broken = PENRITH_FUNCTIONS_TEXT.replace(
      '390,526 411,943 339,459 316,507 51,067 95,436',
      '390,526 411,943 339,449 316,507 51,067 95,436',
    );
    const parsed = parsePenrithGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = PENRITH_INCOME_TEXT.replace('212,763 198,395', '211,763 198,395');
    const parsed = parsePenrithGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = PENRITH_COMPREHENSIVE_TEXT.replace(
      'from Income Statement 51,067',
      'from Income Statement 51,000',
    );
    const parsed = parsePenrithGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
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
    const revenue = penrithGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = penrithGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^penrith-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(penrithGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(penrithGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_penrithgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: PENRITH_GPFS_ID,
    name: PENRITH_GPFS_NAME,
    publisher: PENRITH_GPFS_PUBLISHER,
    source_url: PENRITH_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: PENRITH_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'penrith-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Penrith GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: PENRITH_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-penrith-city-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Penrith City Council',
        delivery_entity: 'Penrith City Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-penrith-city-council-existing',
        project_name: 'Existing AusTender contract under the uppercase PENRITH CITY COUNCIL',
        delivery_entity: 'PENRITH CITY COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-penrith-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Penrith Community Aid Association',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'blacktown-gpfs',
        source_url: 'https://www.blacktown.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-blacktown-gpfs-1',
        project_name: 'Existing Blacktown City Council GPFS row',
        delivery_entity: 'Blacktown City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-penrith-project',
        project_name: 'Existing NSW Budget project whose name mentions Penrith',
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
    expect(await MeasureModel.countDocuments({ source_id: 'blacktown-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: PENRITH_GPFS_ID })).toBe(
      PENRITH_GPFS_ROW_COUNT,
    );
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
    expect(await MeasureModel.countDocuments({ source_id: PENRITH_GPFS_ID })).toBe(
      PENRITH_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(22);
    // The pre-existing GrantConnect row keeps the exact string and the AusTender
    // row the uppercase form. Both are preserved untouched and never summed
    // with the 17 GPFS rows (which also carry that published entity name but a
    // different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Penrith City Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'PENRITH CITY COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Penrith City Council' })).toBe(18);

    expect(
      await MeasureModel.countDocuments({
        source_id: PENRITH_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: PENRITH_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: PENRITH_GPFS_ID,
        delivery_entity: { $ne: 'Penrith City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: PENRITH_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(PENRITH_GPFS_ROW_COUNT);
  });
});
