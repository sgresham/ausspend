import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  CENTRAL_COAST_GPFS_DELIVERY_ENTITY,
  CENTRAL_COAST_GPFS_FISCAL_YEAR,
  CENTRAL_COAST_GPFS_ID,
  CENTRAL_COAST_GPFS_LICENSE,
  CENTRAL_COAST_GPFS_NAME,
  CENTRAL_COAST_GPFS_PUBLISHER,
  CENTRAL_COAST_GPFS_REPORTING_URL,
  centralCoastGpfsNaturalKey,
  detectCentralCoastGpfsUnit,
  discoverCentralCoastGpfsDocument,
  fiscalYearFromCentralCoastGpfsLink,
  parseCentralCoastGpfsExtraction,
  parseCentralCoastGpfsReportPage,
  type CentralCoastGpfsParseContext,
} from '../src/connectors/central-coast-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
  PDF_URL,
} from '../src/connectors/central-coast-gpfs/fixture-data.js';
import { CENTRAL_COAST_GPFS_ROW_COUNT } from '../src/connectors/central-coast-gpfs/fixture.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so the FY2024-25 actual is the first amount after the label and
// the budget amount trails the previous line. The standalone depreciation line
// prints a bare footnote marker before its note reference, so its actual is the
// second amount after the label. Total expenses is the printed face-statement
// bridge: printed expenses excluding depreciation plus printed depreciation. The
// printed B1-1 expense total ($734,180 thousand) is $2 thousand above that
// bridge and its operating result is $2 thousand below the face statement; the
// discrepancy is recorded as reconciliation evidence and the face statement is
// authoritative.

const CONTEXT: CentralCoastGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Central Coast Council Audited Financial Statements 2024-25',
    url: PDF_URL,
    fiscal_year: CENTRAL_COAST_GPFS_FISCAL_YEAR,
    listing_url: CENTRAL_COAST_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/central-coast-gpfs/central-coast-council-audited-financial-statements-2024-25.pdf',
    sha256: '2a37c3eb83a536d2937d85e4a1dbc0df90535338ab3bbb96f3139c5c17d4995a',
    bytes: 8_242_386,
    fetched_at: '2026-11-18T03:30:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: CENTRAL_COAST_GPFS_REPORTING_URL,
};

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '2a37c3eb83a536d2937d85e4a1dbc0df90535338ab3bbb96f3139c5c17d4995a',
      bytes: 8_242_386,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 4),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 5),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 13),
      textPage(DEPRECIATION_TEXT, 24),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

function parsedFixture() {
  return parseCentralCoastGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Central Coast GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official page, not a hard-coded PDF URL', () => {
    const indexHtml = `
      <h2>2025-26 Annual Report</h2>
      <a href="//cdn.centralcoast.nsw.gov.au/sites/default/files/2026-11/central-coast-council-annual-report-2025-26.pdf">Download 2025-26 Annual Report</a>
      <a href="//cdn.centralcoast.nsw.gov.au/sites/default/files/2026-11/central-coast-council-audited-financial-statements-2025-26.pdf">Download 2025-26 Audited Financial Statements</a>
      <h2>Annual Report 2024-25</h2>
      <a href="//cdn.centralcoast.nsw.gov.au/sites/default/files/2026-01/annual-report-2024-25-central-coast-council.pdf">Annual Report 2024-25 30 MB</a>
      <a href="//cdn.centralcoast.nsw.gov.au/sites/default/files/2025-11/audited-financial-statements-2024-25-central-coast-council.pdf">Audited Financial Statement 2024-25 8 MB</a>
    `;
    expect(parseCentralCoastGpfsReportPage(indexHtml, CENTRAL_COAST_GPFS_REPORTING_URL, '2024-25')).toEqual({
      pdfUrl: PDF_URL,
      title:
        'Central Coast Council Audited Financial Statements 2024-25 (General Purpose Financial Statements)',
    });
    expect(fiscalYearFromCentralCoastGpfsLink('Audited Financial Statement 2024-25 8 MB')).toBe(
      '2024-25',
    );
    expect(
      fiscalYearFromCentralCoastGpfsLink(
        'audited-financial-statements-2024-25-central-coast-council.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromCentralCoastGpfsLink('Financial Statements - 2025/26')).toBe('2025-26');
    expect(fiscalYearFromCentralCoastGpfsLink('Year ended 30 June 2025')).toBe('2024-25');
  });

  it('resolves the PDF through the official page HTML', async () => {
    const discovered = await discoverCentralCoastGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="//cdn.centralcoast.nsw.gov.au/sites/default/files/2025-11/audited-financial-statements-2024-25-central-coast-council.pdf">Audited Financial Statement 2024-25 8 MB</a>`,
    });
    expect(discovered.title).toBe(
      'Central Coast Council Audited Financial Statements 2024-25 (General Purpose Financial Statements)',
    );
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(CENTRAL_COAST_GPFS_REPORTING_URL);
  });

  it('does not select a prior-year or later-year statement', () => {
    expect(
      parseCentralCoastGpfsReportPage(
        '<a href="//cdn.centralcoast.nsw.gov.au/sites/default/files/2024-10/audited-financial-statements-2023-24-central-coast-council.pdf">Audited Financial Statement 2023-24</a>',
        CENTRAL_COAST_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
    expect(
      parseCentralCoastGpfsReportPage(
        '<a href="//cdn.centralcoast.nsw.gov.au/sites/default/files/2026-11/central-coast-council-audited-financial-statements-2025-26.pdf">Download 2025-26 Audited Financial Statements</a>',
        CENTRAL_COAST_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseCentralCoastGpfsReportPage(
        '<a href="https://example.com/audited-financial-statements-2024-25.pdf">Audited Financial Statement 2024-25</a>',
        CENTRAL_COAST_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Central Coast GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCentralCoastGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCentralCoastGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseCentralCoastGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Central Coast GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(892_138);
    expect(reconciliation.total_expenses).toBe(734_178);
    expect(reconciliation.employee_expenses).toBe(225_354);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(211_449);
    expect(reconciliation.government_grants_operating).toBe(44_395);
    expect(reconciliation.government_grants_capital).toBe(129_456);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(7_981);
    expect(reconciliation.net_result).toBe(157_960);
    expect(reconciliation.operating_result).toBe(157_960);
    expect(reconciliation.net_result_before_capital_grants).toBe(28_504);
    // The repeated depreciation phrase must read the actual line (211,449), never
    // the expense subtotal (522,729) or the excluding-depreciation result.
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(522_729);
    expect(reconciliation.revenue_components_sum).toBe(892_138);
    expect(reconciliation.expense_components_sum).toBe(522_729);
    expect(reconciliation.face_expense_bridge).toBe(734_178);
    expect(reconciliation.functions_total_income).toBe(892_138);
    expect(reconciliation.functions_total_expenses).toBe(734_180);
    expect(reconciliation.functions_operating_result).toBe(157_958);
    expect(reconciliation.functions_grants_and_contributions).toBe(173_851);
    // Printed function-allocation discrepancy kept as evidence, not smoothed.
    expect(reconciliation.functions_expense_difference).toBe(-2);
    expect(reconciliation.functions_operating_result_difference).toBe(-2);
    expect(reconciliation.comprehensive_income_net_result).toBe(157_960);
    expect(reconciliation.depreciation_note_total).toBe(211_449);
    expect(reconciliation.income_statement_page).toBe(4);
    expect(reconciliation.functions_page).toBe(13);
    expect(reconciliation.comprehensive_income_page).toBe(5);
    expect(reconciliation.depreciation_note_page).toBe(24);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(89_213_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(73_417_800_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(22_535_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      21_144_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(4_439_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(12_945_600_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      798_100_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(15_796_000_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      52_272_900_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(45_960_700_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    // The printed B1-1/face $2 thousand function-allocation discrepancy is a
    // human review gate on the two authoritative totals, not a silent note.
    expect(recordByLine(records, 'total_expenses').notes).toContain('human_spot_check: required');
    expect(recordByLine(records, 'net_result').notes).toContain('human_spot_check: required');
    expect(recordByLine(records, 'total_expenses').notes).toMatch(
      /\$2 thousand.*function-allocation discrepancy/,
    );
    expect(recordByLine(records, 'net_result').notes).toMatch(
      /\$2 thousand.*function-allocation discrepancy/,
    );
    expect(recordByLine(records, 'employee_expenses').notes).not.toContain('human_spot_check');
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
        source_id: CENTRAL_COAST_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: CENTRAL_COAST_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Central Coast Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Central Coast Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^central-coast-gpfs:[a-f0-9]{40}$/);
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

  it('rejects the whole extraction when the B1-1 row no longer reconciles internally', () => {
    const broken = FUNCTIONS_TEXT.replace(
      '734,180 678,747 157,958',
      '734,170 678,747 157,958',
    );
    const parsed = parseCentralCoastGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('181,230 169,410', '181,130 169,410');
    const parsed = parseCentralCoastGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 157,960',
      'from Income Statement 157,000',
    );
    const parsed = parseCentralCoastGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = centralCoastGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = centralCoastGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^central-coast-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(centralCoastGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(centralCoastGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_centralcoastgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CENTRAL_COAST_GPFS_ID,
    name: CENTRAL_COAST_GPFS_NAME,
    publisher: CENTRAL_COAST_GPFS_PUBLISHER,
    source_url: CENTRAL_COAST_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CENTRAL_COAST_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'central-coast-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Central Coast GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: CENTRAL_COAST_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-central-coast-council-existing-1',
        project_name:
          'Existing GrantConnect grant under the exact string Central Coast Council',
        delivery_entity: 'Central Coast Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-central-coast-council-existing',
        project_name: 'Existing AusTender contract under the uppercase CENTRAL COAST COUNCIL',
        delivery_entity: 'CENTRAL COAST COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-central-coast-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Central Coast Community Aid Association',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'randwick-gpfs',
        source_url: 'https://www.randwick.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-randwick-gpfs-1',
        project_name: 'Existing Randwick City Council GPFS row',
        delivery_entity: 'Randwick City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-central-coast-project',
        project_name: 'Existing NSW Budget project whose name mentions Central Coast',
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
    expect(await MeasureModel.countDocuments({ source_id: 'randwick-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: CENTRAL_COAST_GPFS_ID })).toBe(
      CENTRAL_COAST_GPFS_ROW_COUNT,
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
    expect(await MeasureModel.countDocuments({ source_id: CENTRAL_COAST_GPFS_ID })).toBe(
      CENTRAL_COAST_GPFS_ROW_COUNT,
    );
    expect(await MeasureModel.countDocuments({})).toBe(22);
    // The pre-existing GrantConnect row keeps the exact string and the AusTender
    // row the uppercase form. Both are preserved untouched and never summed
    // with the 17 GPFS rows (which also carry that published entity name but a
    // different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Central Coast Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'CENTRAL COAST COUNCIL',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: 'Central Coast Council' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^central coast council$/i }),
    ).toBe(19);

    expect(
      await MeasureModel.countDocuments({
        source_id: CENTRAL_COAST_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CENTRAL_COAST_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: CENTRAL_COAST_GPFS_ID,
        delivery_entity: { $ne: 'Central Coast Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: CENTRAL_COAST_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(CENTRAL_COAST_GPFS_ROW_COUNT);
  });
});
