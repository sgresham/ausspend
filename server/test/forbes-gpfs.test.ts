import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  FORBES_GPFS_DELIVERY_ENTITY,
  FORBES_GPFS_DOCUMENT_PIN,
  FORBES_GPFS_FISCAL_YEAR,
  FORBES_GPFS_ID,
  FORBES_GPFS_LICENSE,
  FORBES_GPFS_NAME,
  FORBES_GPFS_PUBLISHER,
  FORBES_GPFS_REPORTING_URL,
  FORBES_GPFS_REQUEST_HEADERS,
  forbesPinnedDocument,
  detectForbesGpfsUnit,
  discoverForbesGpfsDocument,
  fiscalYearFromForbesGpfsLink,
  parseForbesGpfsExtraction,
  parseForbesGpfsReportLinks,
  selectForbesGpfsDocument,
  forbesGpfsNaturalKey,
} from '../src/connectors/forbes-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  FORBES_COMPREHENSIVE_TEXT,
  FORBES_CONTEXT,
  FORBES_FUNCTIONS_TEXT,
  FORBES_INCOME_TEXT,
  FORBES_PDF_SHA256,
  FORBES_PDF_URL,
  forbesExtraction,
} from '../src/connectors/forbes-gpfs/fixture.js';

// Forbes Shire Council's audited FY2024-25 standalone General Purpose Financial
// Statements. This is the latest audited standalone year: no FY2025-26 audited
// statements were published as at 2026-11-19. The connector targets 2024-25
// only and never substitutes the later 2025-26 or the earlier 2023-24 document.
// The Income Statement prints the Original unaudited budget column before the
// line label, with Actual 2025 and Actual 2024 after it. A parser that took the
// first number in the line would read the budget; the expected values are all
// Actual 2025. Forbes prints eight revenue components (other revenues and other
// income are separate, and the net gain on disposal is a real 1,854) and four
// expense components. The net result is positive while the before-capital
// result is negative (-5,409). Other comprehensive income has a single
// component (revaluation 54,664).

function parsedFixture() {
  return parseForbesGpfsExtraction(forbesExtraction(), FORBES_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Forbes Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/ArticleDocuments/211/Annual_Financial_Statements-2025.pdf.aspx">Annual Financial Statements 2025</a>
    <a href="/ArticleDocuments/211/Annual%20Report%202024-25%20FINAL.pdf.aspx">Annual Report 2024-25</a>
    <a href="/ArticleDocuments/211/Forbes%20Shire%20Council%20Annual%20Report%202022-23.pdf.aspx">Forbes Shire Council Annual Report 2022-23</a>
    <a href="/ArticleDocuments/211/QBRS%20March%202026%20v4.pdf.aspx">QBRS March 2026 v4</a>
    <a href="https://example.com/ArticleDocuments/211/Annual_Financial_Statements-2025.pdf.aspx">Annual Financial Statements 2025 mirror</a>
  `;

  it('discovers the latest FY2024-25 standalone statements and never the annual report, a quarter review or a mirror', () => {
    expect(FORBES_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseForbesGpfsReportLinks(pageHtml, FORBES_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(links.map((link) => link.url)).toEqual([FORBES_PDF_URL]);
    const selected = selectForbesGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(FORBES_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(FORBES_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Annual Financial Statements 2025');
    expect(fiscalYearFromForbesGpfsLink('Annual_Financial_Statements-2025.pdf.aspx')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromForbesGpfsLink('Annual_Financial_Statements-2024.pdf.aspx')).toBe(
      '2023-24',
    );
    expect(
      fiscalYearFromForbesGpfsLink(
        'Annual Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromForbesGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a newer year and never substitutes 2025-26 for the target 2024-25', () => {
    const newerOnly = `
      <a href="/ArticleDocuments/211/Annual_Financial_Statements-2026.pdf.aspx">Annual Financial Statements 2026</a>
    `;
    const links = parseForbesGpfsReportLinks(newerOnly, FORBES_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectForbesGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('rejects the older 2023-24 year and never substitutes it for the target 2024-25', () => {
    const olderOnly = `
      <a href="/ArticleDocuments/211/Annual_Financial_Statements-2024.pdf.aspx">Annual Financial Statements 2024</a>
    `;
    const links = parseForbesGpfsReportLinks(olderOnly, FORBES_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectForbesGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseForbesGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      FORBES_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = forbesPinnedDocument();
    expect(pinned.url).toBe(FORBES_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('Annual_Financial_Statements-2025.pdf.aspx');
    const discovered = await discoverForbesGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(FORBES_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(FORBES_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverForbesGpfsDocument(
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
      discoverForbesGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Forbes Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectForbesGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectForbesGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = FORBES_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseForbesGpfsExtraction(
      extraction({ income: withoutUnit }),
      FORBES_CONTEXT,
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
    source: { sha256: FORBES_PDF_SHA256, bytes: 2_560_081 },
    pages: [
      pdfPage(overrides.income ?? FORBES_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? FORBES_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? FORBES_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Forbes Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(67_967);
    expect(reconciliation.total_expenses).toBe(61_838);
    expect(reconciliation.employee_expenses).toBe(16_043);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(16_096);
    expect(reconciliation.government_grants_operating).toBe(13_845);
    expect(reconciliation.government_grants_capital).toBe(11_538);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(1_854);
    expect(reconciliation.net_result).toBe(6_129);
    expect(reconciliation.net_result_before_capital_grants).toBe(-5_409);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(45_742);
    expect(reconciliation.face_expense_bridge).toBe(61_838);
    expect(reconciliation.functions_total_income).toBe(67_967);
    expect(reconciliation.functions_total_expenses).toBe(61_838);
    expect(reconciliation.functions_operating_result).toBe(6_129);
    expect(reconciliation.functions_grants_and_contributions).toBe(25_383);
    expect(reconciliation.comprehensive_income_net_result).toBe(6_129);
    expect(reconciliation.comprehensive_other_income).toBe(54_664);
    expect(reconciliation.comprehensive_total).toBe(60_793);
    expect(reconciliation.comprehensive_revaluation).toBe(54_664);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(67_967);
    expect(reconciliation.expense_components_sum).toBe(45_742);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(6_796_700_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(6_183_800_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_604_300_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_609_600_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_384_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_153_800_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      185_400_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(180_200_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_571_200_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(171_000_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(106_800_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      161_800_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(113_000_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(2_676_700_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(2_062_200_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(612_900_000);
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
        source_id: FORBES_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: FORBES_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Forbes Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: FORBES_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Forbes Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^forbes-gpfs:/);
      expect(record.source_url).toContain('Annual_Financial_Statements-2025.pdf.aspx');
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
    expect(revenueComponents).toHaveLength(8);
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
    const broken = FORBES_FUNCTIONS_TEXT.replace(
      'Total functions and activities 67,967 82,184 61,838 67,103',
      'Total functions and activities 67,967 82,184 61,840 67,103',
    );
    const parsed = parseForbesGpfsExtraction(
      extraction({ functions: broken }),
      FORBES_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = FORBES_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 60,793',
      'Total comprehensive income for the year attributable to Council 60,795',
    );
    const parsed = parseForbesGpfsExtraction(
      extraction({ comprehensive: broken }),
      FORBES_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = FORBES_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 15,712',
      'Rates and annual charges B2-1 15,714',
    );
    const parsed = parseForbesGpfsExtraction(extraction({ income: broken }), FORBES_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net gain on disposal is altered', () => {
    const broken = FORBES_INCOME_TEXT.replace(
      'Net gain from the disposal of assets B4-1 1,854',
      'Net gain from the disposal of assets B4-1 1,856',
    );
    const parsed = parseForbesGpfsExtraction(extraction({ income: broken }), FORBES_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = FORBES_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 54,664',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 54,666',
    );
    const parsed = parseForbesGpfsExtraction(
      extraction({ comprehensive: broken }),
      FORBES_CONTEXT,
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
    const url = FORBES_CONTEXT.document.url;
    const revenue = forbesGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = forbesGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^forbes-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(forbesGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(forbesGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_forbesgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: FORBES_GPFS_ID,
    name: FORBES_GPFS_NAME,
    publisher: FORBES_GPFS_PUBLISHER,
    source_url: FORBES_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: FORBES_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'forbes-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Forbes Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: FORBES_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-forbes',
        project_name: 'Existing AusTender Forbes contract',
        delivery_entity: 'FORBES SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-forbes',
        project_name: 'Existing GrantConnect Forbes grant',
        delivery_entity: 'Forbes Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-forbes-school',
        project_name: 'Existing data.nsw Forbes school row (not a council row)',
        delivery_entity: 'Forbes High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-forbes-charity',
        project_name: 'Existing ACNC Forbes charity row (not the council)',
        delivery_entity: 'Forbes Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'wentworth-gpfs',
        source_url: 'https://www.wentworth.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-wentworth-gpfs-1',
        project_name: 'Existing Wentworth GPFS row',
        delivery_entity: 'Wentworth Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'wentworth-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: FORBES_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: FORBES_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: FORBES_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: FORBES_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: FORBES_GPFS_ID,
        delivery_entity: { $ne: 'Forbes Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: FORBES_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
