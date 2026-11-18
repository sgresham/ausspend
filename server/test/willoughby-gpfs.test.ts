import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WILLOUGHBY_GPFS_DELIVERY_ENTITY,
  WILLOUGHBY_GPFS_FISCAL_YEAR,
  WILLOUGHBY_GPFS_ID,
  WILLOUGHBY_GPFS_LICENSE,
  WILLOUGHBY_GPFS_NAME,
  WILLOUGHBY_GPFS_PUBLISHER,
  WILLOUGHBY_GPFS_REPORTING_URL,
  detectWilloughbyGpfsUnit,
  discoverWilloughbyGpfsDocument,
  fiscalYearFromWilloughbyGpfsLink,
  parseWilloughbyGpfsExtraction,
  parseWilloughbyGpfsReportPage,
  willoughbyGpfsNaturalKey,
  type WilloughbyGpfsParseContext,
} from '../src/connectors/willoughby-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './willoughby-gpfs.fixture.js';

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
      sha256: '496c569c64c69ef2bb79b233f638011cc561a98882fd732348c1b864fbf2d1d9',
      bytes: 3_217_101,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 12),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 13),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 21),
      textPage(DEPRECIATION_TEXT, 34),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.willoughby.nsw.gov.au/files/assets/public/v/2/documents/publications-reports-master-plans-strategies-action-plans/ecm_7295400_v2_willougby-city-council-final-24-25-financial-statement.pdf';

const CONTEXT: WilloughbyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statements 2024-2025',
    url: PDF_URL,
    fiscal_year: WILLOUGHBY_GPFS_FISCAL_YEAR,
    listing_url: WILLOUGHBY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/willoughby-gpfs/willoughby-city-council-financial-statements-2024-25.pdf',
    sha256: '496c569c64c69ef2bb79b233f638011cc561a98882fd732348c1b864fbf2d1d9',
    bytes: 3_217_101,
    fetched_at: '2026-11-17T16:31:15.619Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: WILLOUGHBY_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseWilloughbyGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Willoughby GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official page, not a hard-coded PDF URL', () => {
    const indexHtml = `
      <a href="/Council/Policies-and-publications/Publications/2026-Annual-Financial-Statements-2025-2026">Annual Financial Statements 2025-2026</a>
      <a href="/files/assets/public/v/1/documents/publications-reports-master-plans-strategies-action-plans/ecm_7515025_v1_willougby-city-council-final-annual-financial-statements_final_-lodged.pdf" title="Annual Financial Statements 2025-2026" class="document ext-pdf"><i aria-hidden="true"></i>Annual Financial Statements 2025-2026<span class="file-info">(PDF,&nbsp;3MB)</span></a>
      <a href="/files/assets/public/v/2/documents/publications-reports-master-plans-strategies-action-plans/ecm_7295400_v2_willougby-city-council-final-24-25-financial-statement.pdf" title="Annual Financial Statements 2024-2025" class="document ext-pdf"><i aria-hidden="true"></i>Annual Financial Statements 2024-2025<span class="file-info">(PDF,&nbsp;3MB)</span></a>
    `;
    expect(
      parseWilloughbyGpfsReportPage(indexHtml, WILLOUGHBY_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: PDF_URL,
      title: 'Annual Financial Statements 2024-2025',
    });
    expect(fiscalYearFromWilloughbyGpfsLink('Annual Financial Statements 2024-2025')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromWilloughbyGpfsLink('Annual Financial Statements 2025-2026')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromWilloughbyGpfsLink('Annual Report 2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromWilloughbyGpfsLink('year ending 30 June 2025')).toBe('2024-25');
  });

  it('resolves the PDF through the official financial-statements page', async () => {
    const discovered = await discoverWilloughbyGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="https://www.willoughby.nsw.gov.au/files/assets/public/v/1/documents/publications-reports-master-plans-strategies-action-plans/ecm_7515025_v1_willougby-city-council-final-annual-financial-statements_final_-lodged.pdf">Annual Financial Statements 2025-2026</a>
        <a href="${PDF_URL}">Annual Financial Statements 2024-2025 (PDF, 3MB)</a>`,
    });
    expect(discovered.title).toBe('Annual Financial Statements 2024-2025');
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(WILLOUGHBY_GPFS_REPORTING_URL);
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    expect(
      parseWilloughbyGpfsReportPage(
        '<a href="/files/assets/public/v/1/documents/publications-reports-master-plans-strategies-action-plans/ecm_7515025_v1_willougby-city-council-final-annual-financial-statements_final_-lodged.pdf">Annual Financial Statements 2025-2026</a>',
        WILLOUGHBY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a PDF link on a non-council host', () => {
    expect(
      parseWilloughbyGpfsReportPage(
        '<a href="https://example.com/Annual_Financial_Statements_2024-2025.pdf">Annual Financial Statements 2024-2025</a>',
        WILLOUGHBY_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Willoughby GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectWilloughbyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectWilloughbyGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseWilloughbyGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Willoughby GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles them exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(18);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(178_259);
    expect(reconciliation.total_expenses).toBe(138_273);
    expect(reconciliation.employee_expenses).toBe(51_919);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(21_081);
    expect(reconciliation.government_grants_operating).toBe(5_557);
    expect(reconciliation.government_grants_capital).toBe(26_038);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(19);
    expect(reconciliation.net_result).toBe(39_986);
    expect(reconciliation.operating_result).toBe(39_986);
    expect(reconciliation.net_result_before_capital_grants).toBe(13_948);
    // The repeated depreciation phrase must read the actual line (21,081), never
    // the expense subtotal (117,192) or the excluding-depreciation result.
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(117_192);
    expect(reconciliation.revenue_components_sum).toBe(178_259);
    expect(reconciliation.expense_components_sum).toBe(117_192);
    expect(reconciliation.face_expense_bridge).toBe(138_273);
    expect(reconciliation.functions_total_income).toBe(178_259);
    expect(reconciliation.functions_total_expenses).toBe(138_273);
    expect(reconciliation.functions_operating_result).toBe(39_986);
    expect(reconciliation.functions_grants_and_contributions).toBe(31_595);
    expect(reconciliation.comprehensive_income_net_result).toBe(39_986);
    expect(reconciliation.depreciation_note_total).toBe(21_081);
    expect(reconciliation.income_statement_page).toBe(12);
    expect(reconciliation.functions_page).toBe(21);
    expect(reconciliation.comprehensive_income_page).toBe(13);
    expect(reconciliation.depreciation_note_page).toBe(34);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(17_825_900_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(13_827_300_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(5_191_900_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_108_100_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(555_700_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(2_603_800_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(1_900_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(3_998_600_000);
    expect(recordByLine(records, 'net_result_before_capital_grants').amount_cents).toBe(
      1_394_800_000,
    );
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      11_719_200_000,
    );
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    expect(recordByLine(records, 'net_result_before_capital_grants').gpfs_printed_sign).toBe(
      undefined,
    );
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
        'net_result_before_capital_grants',
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
        source_id: WILLOUGHBY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: WILLOUGHBY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Willoughby City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Willoughby City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^willoughby-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    // Every row is non-additive agency detail; summing the printed rows is never the total.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace('138,273 133,643', '138,373 133,643');
    const parsed = parseWilloughbyGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('82,513 73,536', '82,613 73,536');
    const parsed = parseWilloughbyGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 39,986',
      'from Income Statement 39,000',
    );
    const parsed = parseWilloughbyGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = willoughbyGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = willoughbyGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^willoughby-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(willoughbyGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(willoughbyGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_willoughbygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: WILLOUGHBY_GPFS_ID,
    name: WILLOUGHBY_GPFS_NAME,
    publisher: WILLOUGHBY_GPFS_PUBLISHER,
    source_url: WILLOUGHBY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WILLOUGHBY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'willoughby-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Willoughby GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: WILLOUGHBY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-Willoughby-City-Council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Willoughby City Council',
        delivery_entity: 'Willoughby City Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-WILLOUGHBY-CITY-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase WILLOUGHBY CITY COUNCIL',
        delivery_entity: 'WILLOUGHBY CITY COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-willoughby-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Willoughby Community Aid Association',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'waverley-gpfs',
        source_url: 'https://www.waverley.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-waverley-gpfs-1',
        project_name: 'Existing Waverley Council GPFS row',
        delivery_entity: 'Waverley Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-willoughby-project',
        project_name: 'Existing NSW Budget project whose name mentions Willoughby',
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
    expect(await MeasureModel.countDocuments({ source_id: 'waverley-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: WILLOUGHBY_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(23);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'acnc-charity', 'nsw-budget'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.amount_cents)).toEqual([
      654_321, 128_500, 999_000, 42_000_000,
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: WILLOUGHBY_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(23);
    // The pre-existing GrantConnect row keeps the exact string "Willoughby City
    // Council" and the AusTender row the uppercase form. Both are preserved
    // untouched and never summed with the 18 GPFS rows (which also carry that
    // published entity name but a different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Willoughby City Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'WILLOUGHBY CITY COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Willoughby City Council' })).toBe(
      19,
    );
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^willoughby city council$/i }),
    ).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: WILLOUGHBY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WILLOUGHBY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WILLOUGHBY_GPFS_ID,
        delivery_entity: { $ne: 'Willoughby City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: WILLOUGHBY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
