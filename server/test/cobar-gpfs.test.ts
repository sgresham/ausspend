import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  COBAR_GPFS_DELIVERY_ENTITY,
  COBAR_GPFS_DOCUMENT_PIN,
  COBAR_GPFS_FISCAL_YEAR,
  COBAR_GPFS_ID,
  COBAR_GPFS_LICENSE,
  COBAR_GPFS_NAME,
  COBAR_GPFS_PUBLISHER,
  COBAR_GPFS_REPORTING_URL,
  COBAR_GPFS_REQUEST_HEADERS,
  cobarPinnedDocument,
  detectCobarGpfsUnit,
  discoverCobarGpfsDocument,
  fiscalYearFromCobarGpfsLink,
  parseCobarGpfsExtraction,
  parseCobarGpfsReportLinks,
  selectCobarGpfsDocument,
  cobarGpfsNaturalKey,
} from '../src/connectors/cobar-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COBAR_COMPREHENSIVE_TEXT,
  COBAR_CONTEXT,
  COBAR_FUNCTIONS_TEXT,
  COBAR_INCOME_TEXT,
  COBAR_PDF_SHA256,
  COBAR_PDF_URL,
  cobarExtraction,
} from '../src/connectors/cobar-gpfs/fixture.js';

// Cobar Shire Council's audited FY2025-26 standalone General Purpose Financial
// Statements. FY2025-26 is the current year for this source; the connector
// targets 2025-26 only and never substitutes the prior 2024-25 or 2023-24
// documents. The Income Statement prints the Original unaudited budget column
// before the line label, with Actual 2026 and Actual 2025 after it. A parser
// that took the first number in the line would read the budget; the expected
// values are all Actual 2026. Cobar prints seven revenue lines and four expense
// lines plus the separate depreciation line; its net gain on disposal of assets
// is a real revenue line. The net result and the before-capital result are both
// positive. Other comprehensive income has two components (revaluation and
// joint ventures/associates).

function parsedFixture() {
  return parseCobarGpfsExtraction(cobarExtraction(), COBAR_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Cobar Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <p>To view the Cobar Shire Council Annual Financial Statement please click
      <a href="https://www.cobar.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026.pdf">HERE</a>
    </p>
    <a href="/wp-content/uploads/2025/10/Annual_Financial_Statements-2025.pdf">Annual Financial Statements 2025</a>
    <a href="/wp-content/uploads/2025/11/Annual-Report-2024-2025.pdf">Annual Report 2024-2025</a>
    <a href="/wp-content/uploads/2025/10/Annual_Financial_Statements-SPFS-2025.pdf">Annual Financial Statements SPFS 2025</a>
    <a href="/wp-content/uploads/2025/10/Annual_Financial_Statements-SS-2025.pdf">Annual Financial Statements Special Schedules 2025</a>
    <a href="/wp-content/uploads/2025/08/policy-template-Community-Donations-July-2025.pdf">Community Donations Policy</a>
    <a href="https://example.com/Annual_Financial_Statements-2026.pdf">Annual Financial Statements 2026 mirror</a>
  `;

  it('discovers the FY2025-26 statements and never the prior year, annual report, SPFS or a mirror', () => {
    expect(COBAR_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseCobarGpfsReportLinks(pageHtml, COBAR_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.map((link) => link.url)).toEqual([
      COBAR_PDF_URL,
      'https://www.cobar.nsw.gov.au/wp-content/uploads/2025/10/Annual_Financial_Statements-2025.pdf',
    ]);
    const selected = selectCobarGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(COBAR_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(COBAR_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Annual Financial Statements GPFS 2025-26');
    expect(
      fiscalYearFromCobarGpfsLink('Annual_Financial_Statements-2026.pdf'),
    ).toBe('2025-26');
    expect(fiscalYearFromCobarGpfsLink('Annual_Financial_Statements-2025.pdf')).toBe(
      '2024-25',
    );
    expect(
      fiscalYearFromCobarGpfsLink(
        'Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromCobarGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/wp-content/uploads/2025/10/Annual_Financial_Statements-2025.pdf">Annual Financial Statements 2025</a>
    `;
    const links = parseCobarGpfsReportLinks(priorOnly, COBAR_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectCobarGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/wp-content/uploads/2027/11/Annual_Financial_Statements-2027.pdf">Annual Financial Statements 2027</a>
    `;
    const links = parseCobarGpfsReportLinks(futureOnly, COBAR_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectCobarGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no current anchor', async () => {
    const links = parseCobarGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      COBAR_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = cobarPinnedDocument();
    expect(pinned.url).toBe(COBAR_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('Annual_Financial_Statements-2026.pdf');
    const discovered = await discoverCobarGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(COBAR_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(COBAR_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverCobarGpfsDocument(
      (async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeaders = init?.headers as Record<string, string>;
        return new Response('<html>no links</html>', { status: 200 });
      }) as typeof fetch,
      '2025-26',
    );
    expect(seenHeaders?.['user-agent']).toBe('curl/8.5.0');
    expect(seenHeaders?.['user-agent']).not.toContain('Chrome');
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverCobarGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Cobar Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCobarGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCobarGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = COBAR_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseCobarGpfsExtraction(
      extraction({ income: withoutUnit }),
      COBAR_CONTEXT,
    );
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
    source: { sha256: COBAR_PDF_SHA256, bytes: 3_507_784 },
    pages: [
      pdfPage(overrides.income ?? COBAR_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? COBAR_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? COBAR_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Cobar Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(16);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(75_336);
    expect(reconciliation.total_expenses).toBe(54_691);
    expect(reconciliation.employee_expenses).toBe(18_452);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(11_398);
    expect(reconciliation.government_grants_operating).toBe(16_952);
    expect(reconciliation.government_grants_capital).toBe(18_890);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(222);
    expect(reconciliation.net_result).toBe(20_645);
    expect(reconciliation.net_result_before_capital_grants).toBe(1_755);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(43_293);
    expect(reconciliation.face_expense_bridge).toBe(54_691);
    expect(reconciliation.functions_total_income).toBe(75_336);
    expect(reconciliation.functions_total_expenses).toBe(54_691);
    expect(reconciliation.functions_operating_result).toBe(20_645);
    expect(reconciliation.functions_grants_and_contributions).toBe(35_842);
    expect(reconciliation.comprehensive_income_net_result).toBe(20_645);
    expect(reconciliation.comprehensive_other_income).toBe(21_137);
    expect(reconciliation.comprehensive_total).toBe(41_782);
    expect(reconciliation.comprehensive_revaluation).toBe(21_384);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBe(-247);
    expect(reconciliation.revenue_components_sum).toBe(75_336);
    expect(reconciliation.expense_components_sum).toBe(43_293);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(7_533_600_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(5_469_100_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_845_200_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_139_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_695_200_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_889_000_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      22_200_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(14_100_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(936_400_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(197_200_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      134_600_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(80_400_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(2_389_600_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(2_659_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(2_064_500_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_loss_from_disposal_of_assets'),
    ).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: COBAR_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: COBAR_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Cobar Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: COBAR_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Cobar Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^cobar-gpfs:/);
      expect(record.source_url).toContain('Annual_Financial_Statements-2026.pdf');
      expect(record.notes).not.toContain('document_resolved_url: ');
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
  });

  it('does not sum components with their printed totals and emits no council-total aggregate row', () => {
    const { records } = parsedFixture();
    const totalRevenue = recordByLine(records, 'total_revenue');
    const revenueComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_revenue',
    );
    expect(revenueComponents).toHaveLength(7);
    expect(revenueComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalRevenue.amount_cents,
    );

    const expensesExDepreciation = recordByLine(records, 'total_expenses_excluding_depreciation');
    const natureComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses_excluding_depreciation',
    );
    expect(natureComponents).toHaveLength(4);
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
    expect(
      records.every((record) =>
        ['revenue', 'expenses', 'result'].includes(String(record.gpfs_section)),
      ),
    ).toBe(true);
    expect(records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = COBAR_FUNCTIONS_TEXT.replace(
      'Total functions and activities 75,336 62,407 54,691 54,305',
      'Total functions and activities 75,336 62,407 54,693 54,305',
    );
    const parsed = parseCobarGpfsExtraction(
      extraction({ functions: broken }),
      COBAR_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = COBAR_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 41,782',
      'Total comprehensive income for the year attributable to Council 41,784',
    );
    const parsed = parseCobarGpfsExtraction(
      extraction({ comprehensive: broken }),
      COBAR_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = COBAR_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 9,364',
      'Rates and annual charges B2-1 9,366',
    );
    const parsed = parseCobarGpfsExtraction(extraction({ income: broken }), COBAR_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the joint-venture other comprehensive income is altered', () => {
    const broken = COBAR_COMPREHENSIVE_TEXT.replace(
      'Other comprehensive income – joint ventures and associates (247)',
      'Other comprehensive income – joint ventures and associates (249)',
    );
    const parsed = parseCobarGpfsExtraction(
      extraction({ comprehensive: broken }),
      COBAR_CONTEXT,
    );
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
    const url = COBAR_CONTEXT.document.url;
    const revenue = cobarGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = cobarGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^cobar-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(cobarGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(cobarGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_cobargpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: COBAR_GPFS_ID,
    name: COBAR_GPFS_NAME,
    publisher: COBAR_GPFS_PUBLISHER,
    source_url: COBAR_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: COBAR_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'cobar-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Cobar Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: COBAR_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-cobar',
        project_name: 'Existing AusTender Cobar contract',
        delivery_entity: 'COBAR SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-cobar',
        project_name: 'Existing GrantConnect Cobar grant',
        delivery_entity: 'Cobar Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-cobar-school',
        project_name: 'Existing data.nsw Cobar school row (not a council row)',
        delivery_entity: 'Cobar High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-cobar-charity',
        project_name: 'Existing ACNC Cobar charity row (not the council)',
        delivery_entity: 'Cobar Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'tenterfield-gpfs',
        source_url: 'https://www.tenterfield.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-tenterfield-gpfs-1',
        project_name: 'Existing Tenterfield GPFS row',
        delivery_entity: 'Tenterfield Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'tenterfield-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: COBAR_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: COBAR_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: COBAR_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: COBAR_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: COBAR_GPFS_ID,
        delivery_entity: { $ne: 'Cobar Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: COBAR_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(16);
  });
});
