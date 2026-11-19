import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  UPPER_LACHLAN_GPFS_DELIVERY_ENTITY,
  UPPER_LACHLAN_GPFS_DOCUMENT_PIN,
  UPPER_LACHLAN_GPFS_FISCAL_YEAR,
  UPPER_LACHLAN_GPFS_ID,
  UPPER_LACHLAN_GPFS_LICENSE,
  UPPER_LACHLAN_GPFS_NAME,
  UPPER_LACHLAN_GPFS_PUBLISHER,
  UPPER_LACHLAN_GPFS_REPORTING_URL,
  UPPER_LACHLAN_GPFS_REQUEST_HEADERS,
  upperLachlanPinnedDocument,
  detectUpperLachlanGpfsUnit,
  discoverUpperLachlanGpfsDocument,
  fiscalYearFromUpperLachlanGpfsLink,
  parseUpperLachlanGpfsExtraction,
  parseUpperLachlanGpfsReportLinks,
  selectUpperLachlanGpfsDocument,
  upperLachlanGpfsNaturalKey,
} from '../src/connectors/upper-lachlan-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  UPPER_LACHLAN_COMPREHENSIVE_TEXT,
  UPPER_LACHLAN_CONTEXT,
  UPPER_LACHLAN_FUNCTIONS_TEXT,
  UPPER_LACHLAN_INCOME_TEXT,
  UPPER_LACHLAN_PDF_SHA256,
  UPPER_LACHLAN_PDF_URL,
  upperLachlanExtraction,
} from '../src/connectors/upper-lachlan-gpfs/fixture.js';

// Upper Lachlan Shire Council's audited FY2025-26 standalone General Purpose
// Financial Statements. FY2025-26 is the current reporting year and the official
// Plans and Reports page lists Financial Statements 2025-2026 as the newest
// audited standalone statements as at 2026-11-19; no later audited statements
// were published. The connector targets 2025-26 and never substitutes the
// earlier 2024-25/2023-24 document. The Income Statement prints the Original
// unaudited budget column before the line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Upper Lachlan prints six
// revenue components (it does not print an "Other income" line, and the 2026 net
// gain on disposal is nil) and five expense components including a real net loss
// on disposal of 1,468. The net result is positive (6,372) while the
// before-capital result is negative (-1,190). Other comprehensive income prints
// a single 2026 revaluation component of 36,721.

function parsedFixture() {
  return parseUpperLachlanGpfsExtraction(upperLachlanExtraction(), UPPER_LACHLAN_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Upper Lachlan Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/wp-content/uploads/2026/10/ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf">Upper Lachlan Shire Council &#8211; Financial Statements 2025-2026</a>
    <a href="/wp-content/uploads/2025/10/Final_Annual_Financial_Statements-2025_31.10.25.pdf">Upper Lachlan Shire Council &#8211; Financial Statements &#8211; 2024-2025</a>
    <a href="/wp-content/uploads/2022/11/Annexure-A-Audited-Financial-Statements-2023-2024.pdf">Upper Lachlan Shire Council &#8211; Financial Statements &#8211; 2023-2024</a>
    <a href="/wp-content/uploads/2026/10/Annual-Report-2025-2026-inc-annexures-FINAL-small.pdf">Annual Report 2025-2026</a>
    <a href="https://example.com/ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf">Upper Lachlan financial statements mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the annual report, prior year or a mirror', () => {
    expect(UPPER_LACHLAN_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseUpperLachlanGpfsReportLinks(pageHtml, UPPER_LACHLAN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      UPPER_LACHLAN_PDF_URL,
      'https://upperlachlan.nsw.gov.au/wp-content/uploads/2025/10/Final_Annual_Financial_Statements-2025_31.10.25.pdf',
      'https://upperlachlan.nsw.gov.au/wp-content/uploads/2022/11/Annexure-A-Audited-Financial-Statements-2023-2024.pdf',
    ]);
    const selected = selectUpperLachlanGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(UPPER_LACHLAN_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(UPPER_LACHLAN_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Financial Statements 2025-2026');
    expect(
      fiscalYearFromUpperLachlanGpfsLink('Financial Statements 2025-2026'),
    ).toBe('2025-26');
    expect(
      fiscalYearFromUpperLachlanGpfsLink('Financial Statements – 2024-2025'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromUpperLachlanGpfsLink(
        'Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromUpperLachlanGpfsLink('Long Term Financial Plan 2023-2033.pdf')).toBeNull();
  });

  it('rejects a prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/wp-content/uploads/2025/10/Final_Annual_Financial_Statements-2025_31.10.25.pdf">Upper Lachlan Shire Council &#8211; Financial Statements &#8211; 2024-2025</a>
    `;
    const links = parseUpperLachlanGpfsReportLinks(priorOnly, UPPER_LACHLAN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectUpperLachlanGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/wp-content/uploads/2027/10/annual-financial-statements-2026-2027.pdf">Financial Statements 2026-2027</a>
    `;
    const links = parseUpperLachlanGpfsReportLinks(futureOnly, UPPER_LACHLAN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectUpperLachlanGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseUpperLachlanGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      UPPER_LACHLAN_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = upperLachlanPinnedDocument();
    expect(pinned.url).toBe(UPPER_LACHLAN_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf');
    const discovered = await discoverUpperLachlanGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(UPPER_LACHLAN_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverUpperLachlanGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(UPPER_LACHLAN_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(UPPER_LACHLAN_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverUpperLachlanGpfsDocument(
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
      discoverUpperLachlanGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Upper Lachlan Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectUpperLachlanGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectUpperLachlanGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = UPPER_LACHLAN_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseUpperLachlanGpfsExtraction(
      extraction({ income: withoutUnit }),
      UPPER_LACHLAN_CONTEXT,
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
    source: { sha256: UPPER_LACHLAN_PDF_SHA256, bytes: 4_215_629 },
    pages: [
      pdfPage(overrides.income ?? UPPER_LACHLAN_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? UPPER_LACHLAN_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? UPPER_LACHLAN_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Upper Lachlan Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(16);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(51_074);
    expect(reconciliation.total_expenses).toBe(44_702);
    expect(reconciliation.employee_expenses).toBe(12_709);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(11_500);
    expect(reconciliation.government_grants_operating).toBe(14_650);
    expect(reconciliation.government_grants_capital).toBe(7_562);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(1_468);
    expect(reconciliation.net_result).toBe(6_372);
    expect(reconciliation.net_result_before_capital_grants).toBe(-1_190);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(33_202);
    expect(reconciliation.face_expense_bridge).toBe(44_702);
    expect(reconciliation.functions_total_income).toBe(51_074);
    expect(reconciliation.functions_total_expenses).toBe(44_702);
    expect(reconciliation.functions_operating_result).toBe(6_372);
    expect(reconciliation.functions_grants_and_contributions).toBe(22_212);
    expect(reconciliation.comprehensive_income_net_result).toBe(6_372);
    expect(reconciliation.comprehensive_other_income).toBe(36_721);
    expect(reconciliation.comprehensive_total).toBe(43_093);
    expect(reconciliation.comprehensive_revaluation).toBe(36_721);
    expect(reconciliation.revenue_components_sum).toBe(51_074);
    expect(reconciliation.expense_components_sum).toBe(33_202);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(5_107_400_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(4_470_200_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_270_900_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_150_000_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_465_000_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(756_200_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      146_800_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(50_400_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_537_200_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(83_000_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      166_900_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(87_400_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(1_764_700_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(1_099_100_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(637_200_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'other_income'),
    ).toBe(false);
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
        source_id: UPPER_LACHLAN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: UPPER_LACHLAN_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Upper Lachlan Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: UPPER_LACHLAN_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Upper Lachlan Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^upper-lachlan-gpfs:/);
      expect(record.source_url).toContain('ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf');
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
    expect(
      records.every((record) =>
        ['revenue', 'expenses', 'result'].includes(String(record.gpfs_section)),
      ),
    ).toBe(true);
    expect(records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = UPPER_LACHLAN_FUNCTIONS_TEXT.replace(
      'Total functions and activities 51,074 49,628 44,702 48,062',
      'Total functions and activities 51,074 49,628 44,704 48,062',
    );
    const parsed = parseUpperLachlanGpfsExtraction(
      extraction({ functions: broken }),
      UPPER_LACHLAN_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = UPPER_LACHLAN_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 43,093',
      'Total comprehensive income for the year attributable to Council 43,095',
    );
    const parsed = parseUpperLachlanGpfsExtraction(
      extraction({ comprehensive: broken }),
      UPPER_LACHLAN_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = UPPER_LACHLAN_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 15,372',
      'Rates and annual charges B2-1 15,374',
    );
    const parsed = parseUpperLachlanGpfsExtraction(extraction({ income: broken }), UPPER_LACHLAN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = UPPER_LACHLAN_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 1,468',
      'Net loss from the disposal of assets B4-1 1,470',
    );
    const parsed = parseUpperLachlanGpfsExtraction(extraction({ income: broken }), UPPER_LACHLAN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the OCI component is altered', () => {
    const broken = UPPER_LACHLAN_COMPREHENSIVE_TEXT.replace(
      'Gain on revaluation of infrastructure, property, plant and equipment C1-6 36,721 1,199',
      'Gain on revaluation of infrastructure, property, plant and equipment C1-6 36,723 1,199',
    );
    const parsed = parseUpperLachlanGpfsExtraction(
      extraction({ comprehensive: broken }),
      UPPER_LACHLAN_CONTEXT,
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
    const url = UPPER_LACHLAN_CONTEXT.document.url;
    const revenue = upperLachlanGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = upperLachlanGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^upper-lachlan-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(upperLachlanGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(upperLachlanGpfsNaturalKey(url, 'total_revenue', '2026-27'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_upper-lachlangpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: UPPER_LACHLAN_GPFS_ID,
    name: UPPER_LACHLAN_GPFS_NAME,
    publisher: UPPER_LACHLAN_GPFS_PUBLISHER,
    source_url: UPPER_LACHLAN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: UPPER_LACHLAN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'upper-lachlan-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Upper Lachlan Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: UPPER_LACHLAN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-upper-lachlan',
        project_name: 'Existing AusTender Upper Lachlan contract',
        delivery_entity: 'UPPER LACHLAN SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-upper-lachlan',
        project_name: 'Existing GrantConnect Upper Lachlan grant',
        delivery_entity: 'Upper Lachlan Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-upper-lachlan-school',
        project_name: 'Existing data.nsw Upper Lachlan school row (not a council row)',
        delivery_entity: 'Upper Lachlan High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-upper-lachlan-charity',
        project_name: 'Existing ACNC Upper Lachlan charity row (not the council)',
        delivery_entity: 'Upper Lachlan Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'edward-river-gpfs',
        source_url: 'https://www.edwardriver.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-edward-river-gpfs-1',
        project_name: 'Existing Edward River GPFS row',
        delivery_entity: 'Edward River Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'edward-river-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: UPPER_LACHLAN_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: UPPER_LACHLAN_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: UPPER_LACHLAN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: UPPER_LACHLAN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: UPPER_LACHLAN_GPFS_ID,
        delivery_entity: { $ne: 'Upper Lachlan Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: UPPER_LACHLAN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(16);
  });
});
