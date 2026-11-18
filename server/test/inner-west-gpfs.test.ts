import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  INNER_WEST_GPFS_DELIVERY_ENTITY,
  INNER_WEST_GPFS_FISCAL_YEAR,
  INNER_WEST_GPFS_ID,
  INNER_WEST_GPFS_LICENSE,
  INNER_WEST_GPFS_NAME,
  INNER_WEST_GPFS_PUBLISHER,
  INNER_WEST_GPFS_REPORTING_URL,
  detectInnerWestGpfsUnit,
  discoverInnerWestGpfsDocument,
  fiscalYearFromInnerWestGpfsLink,
  innerWestGpfsNaturalKey,
  parseInnerWestGpfsExtraction,
  parseInnerWestGpfsReportPage,
  type InnerWestGpfsParseContext,
} from '../src/connectors/inner-west-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './inner-west-gpfs.fixture.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so each value read is the first amount after the label (the
// FY2024-25 actual). The expense subtotal contains the phrase "depreciation,
// amortisation and impairment of non-financial assets", so the actual
// depreciation line is read from the last occurrence. The Income Statement does
// not print a combined total-expenses line; total expenses is the printed B1-1
// "Total functions and activities" total, which equals the printed
// expenses-excluding-depreciation line plus the printed depreciation line.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '03403da8625147450d200cad6a8354f10877893fb2086763f4df9d8fa7622c1f',
      bytes: 10_107_386,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 236),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 237),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 245),
      textPage(DEPRECIATION_TEXT, 256),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.innerwest.nsw.gov.au/sites/default/files/2026-11/Annual%20Report%202024-25.pdf';

const CONTEXT: InnerWestGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Report 2024-25',
    url: PDF_URL,
    fiscal_year: INNER_WEST_GPFS_FISCAL_YEAR,
    listing_url: INNER_WEST_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/inner-west-gpfs/inner-west-council-annual-report-2024-25-gpfs.pdf',
    sha256: '03403da8625147450d200cad6a8354f10877893fb2086763f4df9d8fa7622c1f',
    bytes: 10_107_386,
    fetched_at: '2026-11-17T16:45:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: INNER_WEST_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseInnerWestGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Inner West GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official page, not a hard-coded PDF URL', () => {
    const indexHtml = `
      <a href="/sites/default/files/2026-11/IWC_1358_Annual%20Report_2026_Draft6.pdf">Download the Annual Report 2025/26 (PDF, 29.70MB)</a>
      <a href="https://www.innerwest.nsw.gov.au/sites/default/files/2026-03/Annual%20Report%202023-24.pdf">Annual Report 2023-24 PDF | 20.65MB</a>
      <a href="${PDF_URL}" class="download-item" download><div class="file-content"><div class="file-name">Annual Report 2024-25</div></div><div class="file-metadata"><div class="file-type">PDF <span>| 9.64MB</span></div></div></a>
    `;
    expect(
      parseInnerWestGpfsReportPage(indexHtml, INNER_WEST_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: PDF_URL,
      title: 'Annual Report 2024-25',
    });
    expect(fiscalYearFromInnerWestGpfsLink('Annual Report 2024-25')).toBe('2024-25');
    expect(fiscalYearFromInnerWestGpfsLink('Annual Report 2025/26')).toBe('2025-26');
    expect(fiscalYearFromInnerWestGpfsLink('Annual Report 2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromInnerWestGpfsLink('year ending 30 June 2025')).toBe('2024-25');
  });

  it('resolves the PDF through the official annual-report page', async () => {
    const discovered = await discoverInnerWestGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="/sites/default/files/2026-11/IWC_1358_Annual%20Report_2026_Draft6.pdf">Download the Annual Report 2025/26 (PDF, 29.70MB)</a>
        <a href="${PDF_URL}">Annual Report 2024-25 (PDF, 9.64MB)</a>`,
    });
    expect(discovered.title).toBe('Annual Report 2024-25');
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(INNER_WEST_GPFS_REPORTING_URL);
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    expect(
      parseInnerWestGpfsReportPage(
        '<a href="/sites/default/files/2026-03/Annual%20Report%202023-24.pdf">Annual Report 2023-24</a>',
        INNER_WEST_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a PDF link on a non-council host', () => {
    expect(
      parseInnerWestGpfsReportPage(
        '<a href="https://example.com/Annual_Report_2024-25.pdf">Annual Report 2024-25</a>',
        INNER_WEST_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Inner West GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectInnerWestGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectInnerWestGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseInnerWestGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Inner West GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles them exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(18);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(368_386);
    expect(reconciliation.total_expenses).toBe(325_583);
    expect(reconciliation.employee_expenses).toBe(149_271);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(38_967);
    expect(reconciliation.government_grants_operating).toBe(12_806);
    expect(reconciliation.government_grants_capital).toBe(47_384);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(6_128);
    expect(reconciliation.net_result).toBe(42_803);
    expect(reconciliation.operating_result).toBe(42_803);
    expect(reconciliation.net_result_before_capital_grants).toBe(-4_581);
    // The repeated depreciation phrase must read the actual line (38,967), never
    // the expense subtotal (286,616) or the excluding-depreciation result.
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(286_616);
    expect(reconciliation.revenue_components_sum).toBe(368_386);
    expect(reconciliation.expense_components_sum).toBe(286_616);
    expect(reconciliation.face_expense_bridge).toBe(325_583);
    expect(reconciliation.functions_total_income).toBe(368_386);
    expect(reconciliation.functions_total_expenses).toBe(325_583);
    expect(reconciliation.functions_operating_result).toBe(42_803);
    expect(reconciliation.functions_grants_and_contributions).toBe(60_190);
    expect(reconciliation.comprehensive_income_net_result).toBe(42_803);
    expect(reconciliation.depreciation_note_total).toBe(38_967);
    expect(reconciliation.income_statement_page).toBe(236);
    expect(reconciliation.functions_page).toBe(245);
    expect(reconciliation.comprehensive_income_page).toBe(237);
    expect(reconciliation.depreciation_note_page).toBe(256);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(36_838_600_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(32_558_300_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(14_927_100_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      3_896_700_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_280_600_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(4_738_400_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      612_800_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(4_280_300_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      28_661_600_000,
    );
    expect(recordByLine(records, 'fair_value_increment_investment_properties').amount_cents).toBe(
      770_900_000,
    );
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    // The negative before-capital result is evidence only and is not a row.
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
        'fair_value_increment_investment_properties',
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
        source_id: INNER_WEST_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: INNER_WEST_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Inner West Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Inner West Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^inner-west-gpfs:[a-f0-9]{40}$/);
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
    // Every row is non-additive agency detail; summing the printed rows is never the total.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace('325,583 310,570', '325,683 310,570');
    const parsed = parseInnerWestGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('183,008 173,458', '183,108 173,458');
    const parsed = parseInnerWestGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 42,803',
      'from Income Statement 42,000',
    );
    const parsed = parseInnerWestGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = innerWestGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = innerWestGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^inner-west-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(innerWestGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(innerWestGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_innerwestgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: INNER_WEST_GPFS_ID,
    name: INNER_WEST_GPFS_NAME,
    publisher: INNER_WEST_GPFS_PUBLISHER,
    source_url: INNER_WEST_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: INNER_WEST_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'inner-west-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Inner West GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: INNER_WEST_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-Inner-West-Council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Inner West Council',
        delivery_entity: 'Inner West Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-INNER-WEST-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase INNER WEST COUNCIL',
        delivery_entity: 'INNER WEST COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-inner-west-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Inner West Community Aid Association',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'willoughby-gpfs',
        source_url: 'https://www.willoughby.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-willoughby-gpfs-1',
        project_name: 'Existing Willoughby Council GPFS row',
        delivery_entity: 'Willoughby City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-inner-west-project',
        project_name: 'Existing NSW Budget project whose name mentions Inner West',
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
    expect(await MeasureModel.countDocuments({ source_id: 'willoughby-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: INNER_WEST_GPFS_ID })).toBe(18);
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
    expect(await MeasureModel.countDocuments({ source_id: INNER_WEST_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(23);
    // The pre-existing GrantConnect row keeps the exact string "Inner West
    // Council" and the AusTender row the uppercase form. Both are preserved
    // untouched and never summed with the 18 GPFS rows (which also carry that
    // published entity name but a different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Inner West Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'INNER WEST COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Inner West Council' })).toBe(19);
    expect(await MeasureModel.countDocuments({ delivery_entity: /^inner west council$/i })).toBe(
      20,
    );

    expect(
      await MeasureModel.countDocuments({
        source_id: INNER_WEST_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: INNER_WEST_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: INNER_WEST_GPFS_ID,
        delivery_entity: { $ne: 'Inner West Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: INNER_WEST_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
