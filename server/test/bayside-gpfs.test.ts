import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BAYSIDE_GPFS_DELIVERY_ENTITY,
  BAYSIDE_GPFS_FISCAL_YEAR,
  BAYSIDE_GPFS_ID,
  BAYSIDE_GPFS_LICENSE,
  BAYSIDE_GPFS_NAME,
  BAYSIDE_GPFS_PUBLISHER,
  BAYSIDE_GPFS_REPORTING_URL,
  detectBaysideGpfsUnit,
  discoverBaysideGpfsDocument,
  fiscalYearFromBaysideGpfsLink,
  baysideGpfsNaturalKey,
  parseBaysideGpfsExtraction,
  parseBaysideGpfsReportPage,
  type BaysideGpfsParseContext,
} from '../src/connectors/bayside-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './bayside-gpfs.fixture.js';

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
      sha256: 'c91290369d85aa34c95a47a806d1187809ef7816f0a76a1872b70a79560a8bf0',
      bytes: 2_174_485,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 4),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 5),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
      textPage(DEPRECIATION_TEXT, 24),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.bayside.nsw.gov.au/sites/default/files/2025-12/General%20Purpose%20Financial%20Statements%20%26%20Special%20Schedules%20for%20the%20year%20ended%2030%20June%202025_Final%20Version.pdf';

const CONTEXT: BaysideGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'General Purpose Financial Statements 2024-25',
    url: PDF_URL,
    fiscal_year: BAYSIDE_GPFS_FISCAL_YEAR,
    listing_url: BAYSIDE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: '/tmp/ausspend-source-archive/bayside-gpfs/bayside-council-gpfs-2024-25.pdf',
    sha256: 'c91290369d85aa34c95a47a806d1187809ef7816f0a76a1872b70a79560a8bf0',
    bytes: 2_174_485,
    fetched_at: '2026-11-18T04:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: BAYSIDE_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseBaysideGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Bayside GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official page, not a hard-coded PDF URL', () => {
    const indexHtml = `
      <a href="https://www.bayside.nsw.gov.au/sites/default/files/2025-12/Annual%20Report%202024-25.pdf">Annual Report 2024-25</a>
      <a href="https://www.bayside.nsw.gov.au/sites/default/files/2024-11/General%20Purpose%20Financial%20Statements%20for%20the%20year%20ended%2030%20June%202024.pdf">General Purpose Financial Statements for the year ended 30 June 2024</a>
      <a href="${PDF_URL}" class="download-item" download><div class="file-content"><div class="file-name">General Purpose Financial Statements</div></div><div class="file-metadata"><div class="file-type">PDF</div></div></a>
    `;
    expect(parseBaysideGpfsReportPage(indexHtml, BAYSIDE_GPFS_REPORTING_URL, '2024-25')).toEqual({
      pdfUrl: PDF_URL,
      title: 'General Purpose Financial Statements 2024-25',
    });
    expect(fiscalYearFromBaysideGpfsLink('Annual Report 2024-25')).toBe('2024-25');
    expect(fiscalYearFromBaysideGpfsLink('Annual Report 2025/26')).toBe('2025-26');
    expect(fiscalYearFromBaysideGpfsLink('Annual Report 2024 to 2025')).toBe('2024-25');
    expect(fiscalYearFromBaysideGpfsLink('year ended 30 June 2025')).toBe('2024-25');
    expect(
      fiscalYearFromBaysideGpfsLink(
        'General%20Purpose%20Financial%20Statements%20for%20the%20year%20ended%2030%20June%202024.pdf',
      ),
    ).toBe('2023-24');
  });

  it('resolves the PDF through the official reporting page', async () => {
    const discovered = await discoverBaysideGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="https://www.bayside.nsw.gov.au/sites/default/files/2025-12/Annual%20Report%202024-25.pdf">Annual Report 2024-25</a>
        <a href="${PDF_URL}">General Purpose Financial Statements (PDF)</a>`,
    });
    expect(discovered.title).toBe('General Purpose Financial Statements 2024-25');
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(BAYSIDE_GPFS_REPORTING_URL);
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    expect(
      parseBaysideGpfsReportPage(
        '<a href="/sites/default/files/2024-11/General%20Purpose%20Financial%20Statements%20for%20the%20year%20ended%2030%20June%202024.pdf">General Purpose Financial Statements for the year ended 30 June 2024</a>',
        BAYSIDE_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a GPFS link on a non-council host', () => {
    expect(
      parseBaysideGpfsReportPage(
        '<a href="https://example.com/General_Purpose_Financial_Statements_2024-25.pdf">General Purpose Financial Statements</a>',
        BAYSIDE_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Bayside GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBaysideGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBaysideGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseBaysideGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Bayside GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles them exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(18);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(266_137);
    expect(reconciliation.total_expenses).toBe(230_651);
    expect(reconciliation.employee_expenses).toBe(89_104);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(36_239);
    expect(reconciliation.government_grants_operating).toBe(10_994);
    expect(reconciliation.government_grants_capital).toBe(30_044);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(8_779);
    expect(reconciliation.net_result).toBe(35_486);
    expect(reconciliation.operating_result).toBe(35_486);
    expect(reconciliation.net_result_before_capital_grants).toBe(5_442);
    // The repeated depreciation phrase must read the actual line (36,239), never
    // the expense subtotal (194,412) or the excluding-depreciation result.
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(194_412);
    expect(reconciliation.revenue_components_sum).toBe(266_137);
    expect(reconciliation.expense_components_sum).toBe(194_412);
    expect(reconciliation.face_expense_bridge).toBe(230_651);
    expect(reconciliation.functions_total_income).toBe(266_137);
    expect(reconciliation.functions_total_expenses).toBe(230_651);
    expect(reconciliation.functions_operating_result).toBe(35_486);
    expect(reconciliation.functions_grants_and_contributions).toBe(41_038);
    expect(reconciliation.comprehensive_income_net_result).toBe(35_486);
    expect(reconciliation.depreciation_note_total).toBe(36_239);
    expect(reconciliation.income_statement_page).toBe(4);
    expect(reconciliation.functions_page).toBe(14);
    expect(reconciliation.comprehensive_income_page).toBe(5);
    expect(reconciliation.depreciation_note_page).toBe(24);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(26_613_700_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(23_065_100_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(8_910_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      3_623_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_099_400_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(3_004_400_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      877_900_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(3_548_600_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      19_441_200_000,
    );
    expect(recordByLine(records, 'net_share_joint_ventures_and_associates').amount_cents).toBe(
      1_300_000,
    );
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
        'net_share_joint_ventures_and_associates',
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
        source_id: BAYSIDE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: BAYSIDE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Bayside Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Bayside Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^bayside-gpfs:[a-f0-9]{40}$/);
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
    const broken = FUNCTIONS_TEXT.replace('230,651 210,803', '230,751 210,803');
    const parsed = parseBaysideGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('150,305 141,933', '150,405 141,933');
    const parsed = parseBaysideGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 35,486',
      'from Income Statement 35,000',
    );
    const parsed = parseBaysideGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = baysideGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = baysideGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^bayside-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(baysideGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(baysideGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_baysidegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BAYSIDE_GPFS_ID,
    name: BAYSIDE_GPFS_NAME,
    publisher: BAYSIDE_GPFS_PUBLISHER,
    source_url: BAYSIDE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BAYSIDE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'bayside-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Bayside GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BAYSIDE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-Bayside-Council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Bayside Council',
        delivery_entity: 'Bayside Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-BAYSIDE-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase BAYSIDE COUNCIL',
        delivery_entity: 'BAYSIDE COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-bayside-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Bayside Community Aid Association',
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
        natural_key: 'existing-nsw-budget-bayside-project',
        project_name: 'Existing NSW Budget project whose name mentions Bayside',
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
    expect(await MeasureModel.countDocuments({ source_id: BAYSIDE_GPFS_ID })).toBe(18);
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
    expect(await MeasureModel.countDocuments({ source_id: BAYSIDE_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(23);
    // The pre-existing GrantConnect row keeps the exact string "Bayside
    // Council" and the AusTender row the uppercase form. Both are preserved
    // untouched and never summed with the 18 GPFS rows (which also carry that
    // published entity name but a different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Bayside Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'BAYSIDE COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Bayside Council' })).toBe(19);
    expect(await MeasureModel.countDocuments({ delivery_entity: /^bayside council$/i })).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: BAYSIDE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BAYSIDE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BAYSIDE_GPFS_ID,
        delivery_entity: { $ne: 'Bayside Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BAYSIDE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
