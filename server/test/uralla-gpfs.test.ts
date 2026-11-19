import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  URALLA_GPFS_DELIVERY_ENTITY,
  URALLA_GPFS_DOCUMENT_PIN,
  URALLA_GPFS_ID,
  URALLA_GPFS_LICENSE,
  URALLA_GPFS_NAME,
  URALLA_GPFS_PUBLISHER,
  URALLA_GPFS_REPORTING_URL,
  urallaPinnedDocument,
  detectUrallaGpfsUnit,
  discoverUrallaGpfsDocument,
  fiscalYearFromUrallaGpfsLink,
  parseUrallaGpfsExtraction,
  parseUrallaGpfsReportLinks,
  selectUrallaGpfsDocument,
  urallaGpfsNaturalKey,
} from '../src/connectors/uralla-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  URALLA_COMPREHENSIVE_TEXT,
  URALLA_CONTEXT,
  URALLA_FUNCTIONS_TEXT,
  URALLA_INCOME_TEXT,
  URALLA_PDF_SHA256,
  URALLA_PDF_URL,
  urallaExtraction,
} from '../src/connectors/uralla-gpfs/fixture.js';

// Uralla Shire Council's signed FY2025-26 GPFS. The Income Statement prints the
// Original unaudited budget column before the line label, with Actual 2026 and
// Actual 2025 after it. A parser that took the first number in the line would
// read the budget; the expected values are all Actual 2026. Uralla prints six
// non-zero revenue lines (net gain on disposal is nil) and five expense lines
// (including borrowing costs and a net loss on disposal). The net result and the
// before-capital result are both negative; the net result is stored as a
// non-negative magnitude with a negative sign marker.

function parsedFixture() {
  return parseUrallaGpfsExtraction(urallaExtraction(), URALLA_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Uralla Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="https://www.uralla.nsw.gov.au/files/assets/public/v/1/council/financial-statements/uralla_financial_statements-2026-signed-by-council.pdf">
      Financial Statements for the year ended 30 June 2026
    </a>
    <a href="https://www.uralla.nsw.gov.au/files/assets/public/v/1/council/council-information/strategic-planning-and-reporting/uint-25-29814-uralla-shire-council-financial-statements-2024-25-audited.pdf">
      Financial Statements for the year ended 30 June 2025
    </a>
    <a href="https://www.uralla.nsw.gov.au/files/assets/public/v/1/templateimages/operational-plan-parts-1-5/general-purpose-financial-statements-2025-2026.pdf">
      Public Notice - Presentation of Financial Statements
    </a>
    <a href="https://www.uralla.nsw.gov.au/files/assets/public/v/2/council/council-information/strategic-planning-and-reporting/annual-report-2024-2025-endorsed-report-new.pdf">
      Annual Report 2024-2025
    </a>
    <a href="https://example.com/uralla_financial_statements-2026-signed-by-council.pdf">
      Financial Statements for the year ended 30 June 2026
    </a>
  `;

  it('discovers the signed FY2025-26 statements and never the one-page public notice or a prior year', () => {
    const links = parseUrallaGpfsReportLinks(pageHtml, URALLA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year).sort()).toEqual(['2024-25', '2025-26']);
    const current = links.filter((link) => link.fiscal_year === '2025-26');
    expect(current.map((link) => link.url)).toEqual([URALLA_PDF_URL]);
    expect(current[0]!.url).not.toContain('general-purpose-financial-statements-2025-2026');
    const selected = selectUrallaGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(URALLA_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(URALLA_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromUrallaGpfsLink('uralla_financial_statements-2026-signed-by-council.pdf'),
    ).toBe('2025-26');
    expect(
      fiscalYearFromUrallaGpfsLink(
        'uint-25-29814-uralla-shire-council-financial-statements-2024-25-audited.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromUrallaGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseUrallaGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      URALLA_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = urallaPinnedDocument();
    expect(pinned.url).toBe(URALLA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('uralla_financial_statements-2026-signed-by-council.pdf');
    const discovered = await discoverUrallaGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(URALLA_GPFS_DOCUMENT_PIN);
  });

  it('does not substitute a prior year for the current-year statements', () => {
    const priorOnly = `
      <a href="https://www.uralla.nsw.gov.au/files/assets/public/v/1/council/council-information/strategic-planning-and-reporting/uint-25-29814-uralla-shire-council-financial-statements-2024-25-audited.pdf">Financial Statements for the year ended 30 June 2025</a>
    `;
    const links = parseUrallaGpfsReportLinks(priorOnly, URALLA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectUrallaGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('refuses to guess another fiscal year when the listing has none and no pin applies', async () => {
    await expect(
      discoverUrallaGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Uralla Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectUrallaGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectUrallaGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = URALLA_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseUrallaGpfsExtraction(extraction({ income: withoutUnit }), URALLA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: URALLA_PDF_SHA256, bytes: 1_293_828 },
    pages: [
      pdfPage(overrides.income ?? URALLA_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? URALLA_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? URALLA_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Uralla Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(16);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(33_381);
    expect(reconciliation.total_expenses).toBe(35_698);
    expect(reconciliation.employee_expenses).toBe(15_779);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(7_069);
    expect(reconciliation.government_grants_operating).toBe(13_108);
    expect(reconciliation.government_grants_capital).toBe(2_739);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(1_296);
    expect(reconciliation.net_result).toBe(-2_317);
    expect(reconciliation.net_result_before_capital_grants).toBe(-5_056);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(28_629);
    expect(reconciliation.face_expense_bridge).toBe(35_698);
    expect(reconciliation.functions_total_income).toBe(33_381);
    expect(reconciliation.functions_total_expenses).toBe(35_698);
    expect(reconciliation.functions_operating_result).toBe(-2_317);
    expect(reconciliation.functions_grants_and_contributions).toBe(15_847);
    expect(reconciliation.comprehensive_income_net_result).toBe(-2_317);
    expect(reconciliation.comprehensive_other_income).toBe(18_821);
    expect(reconciliation.comprehensive_total).toBe(16_504);
    expect(reconciliation.revenue_components_sum).toBe(33_381);
    expect(reconciliation.expense_components_sum).toBe(28_629);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(3_338_100_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_569_800_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_577_900_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      706_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_310_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(273_900_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      129_600_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(24_400_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(895_300_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(111_900_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(231_700_000);
    expect(netResult.gpfs_printed_sign).toBe('negative');
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: URALLA_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: URALLA_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Uralla Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: URALLA_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Uralla Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^uralla-gpfs:/);
      expect(record.source_url).toContain('uralla_financial_statements-2026-signed-by-council.pdf');
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
  });

  it('does not sum components with their printed totals', () => {
    const { records } = parsedFixture();
    const totalRevenue = recordByLine(records, 'total_revenue');
    const revenueComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_revenue',
    );
    expect(revenueComponents).toHaveLength(6);
    expect(revenueComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalRevenue.amount_cents,
    );

    const expensesExDepreciation = recordByLine(records, 'total_expenses_excluding_depreciation');
    const natureComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses_excluding_depreciation',
    );
    expect(natureComponents).toHaveLength(5);
    expect(natureComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      expensesExDepreciation.amount_cents,
    );

    const totalExpenses = recordByLine(records, 'total_expenses');
    const bridgeComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses',
    );
    expect(bridgeComponents).toHaveLength(2);
    expect(bridgeComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalExpenses.amount_cents,
    );

    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = URALLA_FUNCTIONS_TEXT.replace(
      'Total functions and activities   33,381   27,767   35,698   33,107',
      'Total functions and activities   33,381   27,767   35,700   33,107',
    );
    const parsed = parseUrallaGpfsExtraction(extraction({ functions: broken }), URALLA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = URALLA_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council   16,504',
      'Total comprehensive income for the year attributable to Council   16,506',
    );
    const parsed = parseUrallaGpfsExtraction(extraction({ comprehensive: broken }), URALLA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = URALLA_INCOME_TEXT.replace(
      'Rates and annual charges   B2-1   8,953',
      'Rates and annual charges   B2-1   8,955',
    );
    const parsed = parseUrallaGpfsExtraction(extraction({ income: broken }), URALLA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('is deterministic and derives stable, line-specific, fiscal-year-specific natural keys', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
    const url = URALLA_CONTEXT.document.url;
    const revenue = urallaGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = urallaGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^uralla-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(urallaGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(urallaGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_urallagpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: URALLA_GPFS_ID,
    name: URALLA_GPFS_NAME,
    publisher: URALLA_GPFS_PUBLISHER,
    source_url: URALLA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: URALLA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'uralla-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Uralla Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: URALLA_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-uralla',
        project_name: 'Existing AusTender Uralla Shire contract',
        delivery_entity: 'URALLA SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-uralla',
        project_name: 'Existing GrantConnect Uralla Shire grant',
        delivery_entity: 'Uralla Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-uralla-school',
        project_name: 'Existing data.nsw Uralla school row (not a council row)',
        delivery_entity: 'Uralla Central School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-uralla-charity',
        project_name: 'Existing ACNC Uralla charity row (not the council)',
        delivery_entity: 'Uralla Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'the-hills-gpfs',
        source_url: 'https://www.thehills.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-the-hills-gpfs-1',
        project_name: 'Existing The Hills GPFS row',
        delivery_entity: 'The Hills Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'the-hills-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: URALLA_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: URALLA_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: URALLA_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: URALLA_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: URALLA_GPFS_ID,
        delivery_entity: { $ne: 'Uralla Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: URALLA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(16);
  });
});
