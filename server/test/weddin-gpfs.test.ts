import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WEDDIN_GPFS_DELIVERY_ENTITY,
  WEDDIN_GPFS_DOCUMENT_PIN,
  WEDDIN_GPFS_FISCAL_YEAR,
  WEDDIN_GPFS_ID,
  WEDDIN_GPFS_LICENSE,
  WEDDIN_GPFS_NAME,
  WEDDIN_GPFS_PUBLISHER,
  WEDDIN_GPFS_REPORTING_URL,
  WEDDIN_GPFS_REQUEST_HEADERS,
  weddinPinnedDocument,
  detectWeddinGpfsUnit,
  discoverWeddinGpfsDocument,
  fiscalYearFromWeddinGpfsLink,
  parseWeddinGpfsExtraction,
  parseWeddinGpfsReportLinks,
  selectWeddinGpfsDocument,
  weddinGpfsNaturalKey,
} from '../src/connectors/weddin-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  WEDDIN_COMPREHENSIVE_TEXT,
  WEDDIN_CONTEXT,
  WEDDIN_FUNCTIONS_TEXT,
  WEDDIN_INCOME_TEXT,
  WEDDIN_PDF_SHA256,
  WEDDIN_PDF_URL,
  weddinExtraction,
} from '../src/connectors/weddin-gpfs/fixture.js';

// Weddin Shire Council's audited FY2024-25 statements. FY2024-25 is the latest
// audited standalone GPFS published by the council at 2026-11-19; no FY2025-26
// document is posted, so FY2024-25 is the accepted current-available year and
// the connector never substitutes a 2025-26 or 2023-24 document. The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2025 and Actual 2024 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2025.
// Weddin prints seven non-zero revenue lines (its net gain on disposal is nil)
// and five expense lines (including borrowing costs and a net loss on disposal).
// The net result and the before-capital result are both negative.

function parsedFixture() {
  return parseWeddinGpfsExtraction(weddinExtraction(), WEDDIN_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Weddin Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a title="2024 - 2025 Annual Financials Statements" href="/files/assets/public/v/1/council/plans-strategies-amp-reports/other-plans-amp-strategies/20251106-2024-2025-annual-financial-statements.pdf" class="document ext-pdf">2024 - 2025 Annual Financials Statements</a>
    <a title="2023 - 2024 Annual Financial Statements" href="/files/assets/public/v/1/council/plans-strategies-amp-reports/ipr/annual-report/weddin-shire-council-audited-financial-statements-2023-24_redacted.pdf" class="document ext-pdf">2023 - 2024 Annual Financial Statements</a>
    <a title="2024 - 2025 Annual Report" href="/files/assets/public/v/1/council/plans-strategies-amp-reports/ipr/annual-report/20251120-2024-25-annual-report_-financial-statements_adopted_redacted.pdf" class="document ext-pdf">2024 - 2025 Annual Report</a>
    <a href="https://example.com/20251106-2024-2025-annual-financial-statements.pdf">Annual Financial Statements 2024-25</a>
  `;

  it('discovers FY2024-25 as the current-available statements and never an annual report, prior year or mirror', () => {
    expect(WEDDIN_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseWeddinGpfsReportLinks(pageHtml, WEDDIN_GPFS_REPORTING_URL);
    // The real prior-year link lives under the site's annual-report path and is
    // ignored; only the current-available statements anchor is usable.
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    const current = links.filter((link) => link.fiscal_year === '2024-25');
    expect(current.map((link) => link.url)).toEqual([WEDDIN_PDF_URL]);
    const selected = selectWeddinGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(WEDDIN_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(WEDDIN_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromWeddinGpfsLink('2024 - 2025 Annual Financials Statements'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromWeddinGpfsLink('2023 - 2024 Annual Financial Statements'),
    ).toBe('2023-24');
    expect(fiscalYearFromWeddinGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a title="2023 - 2024 Annual Financial Statements" href="/2023-2024-annual-financial-statements.pdf">2023 - 2024 Annual Financial Statements</a>
    `;
    const links = parseWeddinGpfsReportLinks(priorOnly, WEDDIN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectWeddinGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a title="2025 - 2026 Annual Financial Statements" href="/files/assets/public/v/1/council/plans-strategies-amp-reports/other-plans-amp-strategies/2026-2025-annual-financial-statements.pdf">2025 - 2026 Annual Financial Statements</a>
    `;
    const links = parseWeddinGpfsReportLinks(futureOnly, WEDDIN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectWeddinGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseWeddinGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      WEDDIN_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = weddinPinnedDocument();
    expect(pinned.url).toBe(WEDDIN_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('2024-2025-annual-financial-statements.pdf');
    const discovered = await discoverWeddinGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(WEDDIN_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA so the Akamai WAF does not return 403', async () => {
    expect(WEDDIN_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverWeddinGpfsDocument(
      (async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeaders = init?.headers as Record<string, string>;
        return new Response('<html>no links</html>', { status: 200 });
      }) as typeof fetch,
      '2024-25',
    );
    expect(seenHeaders?.['user-agent']).toBe('curl/8.5.0');
    expect(seenHeaders?.['user-agent']).not.toContain('Chrome');
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverWeddinGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Weddin Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectWeddinGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectWeddinGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = WEDDIN_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseWeddinGpfsExtraction(extraction({ income: withoutUnit }), WEDDIN_CONTEXT);
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
    source: { sha256: WEDDIN_PDF_SHA256, bytes: 5_166_514 },
    pages: [
      pdfPage(overrides.income ?? WEDDIN_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? WEDDIN_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? WEDDIN_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Weddin Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(29_709);
    expect(reconciliation.total_expenses).toBe(31_745);
    expect(reconciliation.employee_expenses).toBe(7_794);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(6_234);
    expect(reconciliation.government_grants_operating).toBe(7_684);
    expect(reconciliation.government_grants_capital).toBe(6_831);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(1_010);
    expect(reconciliation.net_result).toBe(-2_036);
    expect(reconciliation.net_result_before_capital_grants).toBe(-8_867);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(25_511);
    expect(reconciliation.face_expense_bridge).toBe(31_745);
    expect(reconciliation.functions_total_income).toBe(29_709);
    expect(reconciliation.functions_total_expenses).toBe(31_745);
    expect(reconciliation.functions_operating_result).toBe(-2_036);
    expect(reconciliation.functions_grants_and_contributions).toBe(14_515);
    expect(reconciliation.comprehensive_income_net_result).toBe(-2_036);
    expect(reconciliation.comprehensive_other_income).toBe(37_214);
    expect(reconciliation.comprehensive_total).toBe(35_178);
    expect(reconciliation.comprehensive_revaluation).toBe(32_252);
    expect(reconciliation.comprehensive_impairment_reversal).toBe(4_058);
    expect(reconciliation.comprehensive_joint_ventures).toBe(904);
    expect(reconciliation.comprehensive_items_not_reclassified).toBe(37_214);
    expect(reconciliation.revenue_components_sum).toBe(29_709);
    expect(reconciliation.expense_components_sum).toBe(25_511);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(2_970_900_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_174_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(779_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      623_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(768_400_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(683_100_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      101_000_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(15_700_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(463_200_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(130_100_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(17_400_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(203_600_000);
    expect(netResult.gpfs_printed_sign).toBe('negative');
    expect(records.some((record) => record.gpfs_line_item === 'net_gain_from_disposal_of_assets')).toBe(
      false,
    );
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: WEDDIN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: WEDDIN_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Weddin Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: WEDDIN_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Weddin Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^weddin-gpfs:/);
      expect(record.source_url).toContain('2024-2025-annual-financial-statements.pdf');
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
    expect(
      records.every((record) =>
        ['revenue', 'expenses', 'result'].includes(String(record.gpfs_section)),
      ),
    ).toBe(true);
    expect(records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = WEDDIN_FUNCTIONS_TEXT.replace(
      'Total functions and activities 29,709 28,302 31,745 27,230',
      'Total functions and activities 29,709 28,302 31,747 27,230',
    );
    const parsed = parseWeddinGpfsExtraction(extraction({ functions: broken }), WEDDIN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = WEDDIN_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 35,178',
      'Total comprehensive income for the year attributable to Council 35,180',
    );
    const parsed = parseWeddinGpfsExtraction(extraction({ comprehensive: broken }), WEDDIN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = WEDDIN_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 4,632',
      'Rates and annual charges B2-1 4,634',
    );
    const parsed = parseWeddinGpfsExtraction(extraction({ income: broken }), WEDDIN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when an other-comprehensive-income component is altered', () => {
    const broken = WEDDIN_COMPREHENSIVE_TEXT.replace(
      'Other comprehensive income – joint ventures and associates 904',
      'Other comprehensive income – joint ventures and associates 906',
    );
    const parsed = parseWeddinGpfsExtraction(extraction({ comprehensive: broken }), WEDDIN_CONTEXT);
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
    const url = WEDDIN_CONTEXT.document.url;
    const revenue = weddinGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = weddinGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^weddin-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(weddinGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(weddinGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_weddingpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: WEDDIN_GPFS_ID,
    name: WEDDIN_GPFS_NAME,
    publisher: WEDDIN_GPFS_PUBLISHER,
    source_url: WEDDIN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WEDDIN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'weddin-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Weddin Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: WEDDIN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-weddin',
        project_name: 'Existing AusTender Weddin Shire contract',
        delivery_entity: 'WEDDIN SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-weddin',
        project_name: 'Existing GrantConnect Weddin Shire grant',
        delivery_entity: 'Weddin Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-weddin-school',
        project_name: 'Existing data.nsw Weddin school row (not a council row)',
        delivery_entity: 'Grenfell Public School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-weddin-charity',
        project_name: 'Existing ACNC Weddin charity row (not the council)',
        delivery_entity: 'Weddin Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
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
    expect(await MeasureModel.countDocuments({ source_id: WEDDIN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: WEDDIN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: WEDDIN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WEDDIN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WEDDIN_GPFS_ID,
        delivery_entity: { $ne: 'Weddin Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: WEDDIN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
