import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WENTWORTH_GPFS_DELIVERY_ENTITY,
  WENTWORTH_GPFS_DOCUMENT_PIN,
  WENTWORTH_GPFS_FISCAL_YEAR,
  WENTWORTH_GPFS_ID,
  WENTWORTH_GPFS_LICENSE,
  WENTWORTH_GPFS_NAME,
  WENTWORTH_GPFS_PUBLISHER,
  WENTWORTH_GPFS_REPORTING_URL,
  WENTWORTH_GPFS_REQUEST_HEADERS,
  wentworthPinnedDocument,
  detectWentworthGpfsUnit,
  discoverWentworthGpfsDocument,
  fiscalYearFromWentworthGpfsLink,
  parseWentworthGpfsExtraction,
  parseWentworthGpfsReportLinks,
  selectWentworthGpfsDocument,
  wentworthGpfsNaturalKey,
} from '../src/connectors/wentworth-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  WENTWORTH_COMPREHENSIVE_TEXT,
  WENTWORTH_CONTEXT,
  WENTWORTH_FUNCTIONS_TEXT,
  WENTWORTH_INCOME_TEXT,
  WENTWORTH_PDF_SHA256,
  WENTWORTH_PDF_URL,
  wentworthExtraction,
} from '../src/connectors/wentworth-gpfs/fixture.js';

// Wentworth Shire Council's audited FY2024-25 standalone General Purpose
// Financial Statements. This is the latest audited standalone year: no
// FY2025-26 audited statements were published as at 2026-11-19. The connector
// targets 2024-25 only and never substitutes the later 2025-26 or the earlier
// 2023-24 document. The Income Statement prints the Original unaudited budget
// column before the line label, with Actual 2025 and Actual 2024 after it. A
// parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. Wentworth prints seven non-nil revenue
// components (the 2025 net gain on disposal is nil) and six expense components,
// including a real net loss on disposal of 1,223 and a net share of interests
// in joint ventures and associates of 246. The net result is positive while the
// before-capital result is negative (-4,547). Other comprehensive income has
// two components (revaluation -55,052 and impairment reversal 485) summing to
// the printed -54,567.

function parsedFixture() {
  return parseWentworthGpfsExtraction(wentworthExtraction(), WENTWORTH_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Wentworth Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="https://www.wentworth.nsw.gov.au/wp-content/uploads/2026/01/Wentworth-Shire-Council-Financial-Statements-2024-25.pdf">Wentworth Shire Council Financial Statements 2024-25</a>
    <a href="https://www.wentworth.nsw.gov.au/wp-content/uploads/2026/01/WSC-Annual-Report-2024-2025-revised-16012026.pdf">WSC Annual Report 2024-2025</a>
    <a href="https://www.wentworth.nsw.gov.au/wp-content/uploads/2024/11/Wentworth-Shire-Council-Financial-Statements-2023-24.pdf">Wentworth Shire Council Financial Statements 2023-24</a>
    <a href="https://www.wentworth.nsw.gov.au/wp-content/uploads/2020/05/Annual_Report_16-17_Financial_Statements.pdf">Annual Report 16-17 Financial Statements</a>
    <a href="https://example.com/Wentworth-Shire-Council-Financial-Statements-2024-25.pdf">Wentworth financial statements mirror</a>
  `;

  it('discovers the latest FY2024-25 standalone statements and never the annual report, a different year or a mirror', () => {
    expect(WENTWORTH_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseWentworthGpfsReportLinks(pageHtml, WENTWORTH_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      WENTWORTH_PDF_URL,
      'https://www.wentworth.nsw.gov.au/wp-content/uploads/2024/11/Wentworth-Shire-Council-Financial-Statements-2023-24.pdf',
    ]);
    const selected = selectWentworthGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(WENTWORTH_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(WENTWORTH_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Wentworth Shire Council Financial Statements 2024-25');
    expect(
      fiscalYearFromWentworthGpfsLink('Wentworth-Shire-Council-Financial-Statements-2024-25.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromWentworthGpfsLink('Wentworth-Shire-Council-Financial-Statements-2023-24.pdf'),
    ).toBe('2023-24');
    expect(
      fiscalYearFromWentworthGpfsLink(
        'Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromWentworthGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a newer year and never substitutes 2025-26 for the target 2024-25', () => {
    const newerOnly = `
      <a href="https://www.wentworth.nsw.gov.au/wp-content/uploads/2027/01/Wentworth-Shire-Council-Financial-Statements-2025-26.pdf">Wentworth Shire Council Financial Statements 2025-26</a>
    `;
    const links = parseWentworthGpfsReportLinks(newerOnly, WENTWORTH_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectWentworthGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('rejects the older 2023-24 year and never substitutes it for the target 2024-25', () => {
    const olderOnly = `
      <a href="https://www.wentworth.nsw.gov.au/wp-content/uploads/2024/11/Wentworth-Shire-Council-Financial-Statements-2023-24.pdf">Wentworth Shire Council Financial Statements 2023-24</a>
    `;
    const links = parseWentworthGpfsReportLinks(olderOnly, WENTWORTH_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectWentworthGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseWentworthGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      WENTWORTH_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = wentworthPinnedDocument();
    expect(pinned.url).toBe(WENTWORTH_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('Wentworth-Shire-Council-Financial-Statements-2024-25.pdf');
    const discovered = await discoverWentworthGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(WENTWORTH_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(WENTWORTH_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverWentworthGpfsDocument(
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
      discoverWentworthGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Wentworth Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectWentworthGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectWentworthGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = WENTWORTH_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseWentworthGpfsExtraction(
      extraction({ income: withoutUnit }),
      WENTWORTH_CONTEXT,
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
    source: { sha256: WENTWORTH_PDF_SHA256, bytes: 1_707_983 },
    pages: [
      pdfPage(overrides.income ?? WENTWORTH_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? WENTWORTH_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? WENTWORTH_FUNCTIONS_TEXT, 18),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Wentworth Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(18);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(57_520);
    expect(reconciliation.total_expenses).toBe(40_254);
    expect(reconciliation.employee_expenses).toBe(11_433);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(12_004);
    expect(reconciliation.government_grants_operating).toBe(8_586);
    expect(reconciliation.government_grants_capital).toBe(21_813);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(1_223);
    expect(reconciliation.share_of_joint_ventures_and_associates).toBe(246);
    expect(reconciliation.net_result).toBe(17_266);
    expect(reconciliation.net_result_before_capital_grants).toBe(-4_547);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(28_250);
    expect(reconciliation.face_expense_bridge).toBe(40_254);
    expect(reconciliation.functions_total_income).toBe(57_520);
    expect(reconciliation.functions_total_expenses).toBe(40_254);
    expect(reconciliation.functions_operating_result).toBe(17_266);
    expect(reconciliation.functions_grants_and_contributions).toBe(30_399);
    expect(reconciliation.comprehensive_income_net_result).toBe(17_266);
    expect(reconciliation.comprehensive_other_income).toBe(-54_567);
    expect(reconciliation.comprehensive_total).toBe(-37_301);
    expect(reconciliation.comprehensive_revaluation).toBe(-55_052);
    expect(reconciliation.comprehensive_impairment).toBe(485);
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(57_520);
    expect(reconciliation.expense_components_sum).toBe(28_250);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(5_752_000_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(4_025_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_143_300_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_200_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(858_600_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(2_181_300_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      122_300_000,
    );
    expect(recordByLine(records, 'share_of_joint_ventures_and_associates').amount_cents).toBe(
      24_600_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(134_000_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_107_600_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(186_300_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(5_300_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      263_100_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(71_200_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(1_329_600_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(1_149_800_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_726_600_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_gain_from_disposal_of_assets'),
    ).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: WENTWORTH_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: WENTWORTH_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Wentworth Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: WENTWORTH_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Wentworth Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^wentworth-gpfs:/);
      expect(record.source_url).toContain('Wentworth-Shire-Council-Financial-Statements-2024-25.pdf');
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
    expect(natureComponents).toHaveLength(6);
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
    const broken = WENTWORTH_FUNCTIONS_TEXT.replace(
      'Total functions and activities 57,520 51,806 40,254 34,135',
      'Total functions and activities 57,520 51,806 40,256 34,135',
    );
    const parsed = parseWentworthGpfsExtraction(
      extraction({ functions: broken }),
      WENTWORTH_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = WENTWORTH_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council (37,301)',
      'Total comprehensive income for the year attributable to Council (37,303)',
    );
    const parsed = parseWentworthGpfsExtraction(
      extraction({ comprehensive: broken }),
      WENTWORTH_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = WENTWORTH_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 11,076',
      'Rates and annual charges B2-1 11,078',
    );
    const parsed = parseWentworthGpfsExtraction(extraction({ income: broken }), WENTWORTH_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net share of joint ventures is altered', () => {
    const broken = WENTWORTH_INCOME_TEXT.replace(
      'Net share of interests in joint ventures and associates using the equity method D2 246',
      'Net share of interests in joint ventures and associates using the equity method D2 248',
    );
    const parsed = parseWentworthGpfsExtraction(extraction({ income: broken }), WENTWORTH_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the impairment-reversal other comprehensive income is altered', () => {
    const broken = WENTWORTH_COMPREHENSIVE_TEXT.replace(
      'Impairment (loss) reversal relating to infrastructure, property, plant and equipment C1-6 485',
      'Impairment (loss) reversal relating to infrastructure, property, plant and equipment C1-6 487',
    );
    const parsed = parseWentworthGpfsExtraction(
      extraction({ comprehensive: broken }),
      WENTWORTH_CONTEXT,
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
    const url = WENTWORTH_CONTEXT.document.url;
    const revenue = wentworthGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = wentworthGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^wentworth-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(wentworthGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(wentworthGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_wentworthgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: WENTWORTH_GPFS_ID,
    name: WENTWORTH_GPFS_NAME,
    publisher: WENTWORTH_GPFS_PUBLISHER,
    source_url: WENTWORTH_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WENTWORTH_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'wentworth-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Wentworth Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: WENTWORTH_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-wentworth',
        project_name: 'Existing AusTender Wentworth contract',
        delivery_entity: 'WENTWORTH SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-wentworth',
        project_name: 'Existing GrantConnect Wentworth grant',
        delivery_entity: 'Wentworth Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-wentworth-school',
        project_name: 'Existing data.nsw Wentworth school row (not a council row)',
        delivery_entity: 'Wentworth High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-wentworth-charity',
        project_name: 'Existing ACNC Wentworth charity row (not the council)',
        delivery_entity: 'Wentworth Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'inverell-gpfs',
        source_url: 'https://inverell.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-inverell-gpfs-1',
        project_name: 'Existing Inverell GPFS row',
        delivery_entity: 'Inverell Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'inverell-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: WENTWORTH_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(23);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: WENTWORTH_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(23);

    expect(
      await MeasureModel.countDocuments({
        source_id: WENTWORTH_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WENTWORTH_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WENTWORTH_GPFS_ID,
        delivery_entity: { $ne: 'Wentworth Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: WENTWORTH_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
