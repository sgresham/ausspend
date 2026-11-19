import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  NARROMINE_GPFS_DELIVERY_ENTITY,
  NARROMINE_GPFS_DOCUMENT_PIN,
  NARROMINE_GPFS_FISCAL_YEAR,
  NARROMINE_GPFS_ID,
  NARROMINE_GPFS_LICENSE,
  NARROMINE_GPFS_NAME,
  NARROMINE_GPFS_PUBLISHER,
  NARROMINE_GPFS_REPORTING_URL,
  NARROMINE_GPFS_REQUEST_HEADERS,
  narrominePinnedDocument,
  detectNarromineGpfsUnit,
  discoverNarromineGpfsDocument,
  fiscalYearFromNarromineGpfsLink,
  parseNarromineGpfsExtraction,
  parseNarromineGpfsReportLinks,
  selectNarromineGpfsDocument,
  narromineGpfsNaturalKey,
} from '../src/connectors/narromine-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  NARROMINE_COMPREHENSIVE_TEXT,
  NARROMINE_CONTEXT,
  NARROMINE_FUNCTIONS_TEXT,
  NARROMINE_INCOME_TEXT,
  NARROMINE_PDF_SHA256,
  NARROMINE_PDF_URL,
  narromineExtraction,
} from '../src/connectors/narromine-gpfs/fixture.js';

// Narromine Shire Council's audited FY2025-26 standalone General Purpose
// Financial Statements, published as Annexure 1 of the annual report. FY2025-26
// is the current year for this source; the connector targets 2025-26 only and
// never substitutes the prior 2024-25 or 2023-24 documents. The Income Statement
// prints the Original unaudited budget column before the line label, with Actual
// 2026 and Actual 2025 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2026. Narromine
// prints eight revenue lines (including other revenue, other income and a real
// net gain on disposal of 374) and four expense lines plus the separate
// depreciation line. The printed 2026 net loss on disposal is nil. The net
// result and the before-capital result are both positive. Other comprehensive
// income has a single component (revaluation 28,642).

function parsedFixture() {
  return parseNarromineGpfsExtraction(narromineExtraction(), NARROMINE_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Narromine Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/2025%202026%20NSC%20Annual%20Report%20-%20Annexure%201%20-%20Financial%20Statements.pdf?downloadable=1">2025 - 2026 NSC Annual Report - Annexure 1 - Financial Statements</a>
    <a href="/2025%202026%20Narromine%20Shire%20Council%20Annual%20Report.pdf?downloadable=1">2025 - 2026 Narromine Shire Council Annual Report</a>
    <a href="/2024%202025%20NSC%20Annual%20Report%20Annexure%201%20Financial%20Statements.pdf?downloadable=1">2024-2025 NSC Annual Report - Annexure 1 - Financial Statements</a>
    <a href="/2023-2024%20NSC%20Annual%20Report%20-%20Annexure%201%20-%20State%20of%20Our%20Shire%20Report.pdf?downloadable=1">2023-2024 NSC Annual Report - Annexure 1 - State of Our Shire Report</a>
    <a href="/2023-2024%20NSC%20Annual%20Report%20-%20Annexure%202%20-%20Financial%20Statements.pdf?downloadable=1">2023-2024 NSC Annual Report - Annexure 2 - Financial Statements</a>
    <a href="https://example.com/2025%202026%20NSC%20Annual%20Report%20-%20Annexure%201%20-%20Financial%20Statements.pdf?downloadable=1">2025 - 2026 financial statements mirror</a>
  `;

  it('discovers the FY2025-26 financial statements annexure and never the full annual report, prior year, SPFS or a mirror', () => {
    expect(NARROMINE_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseNarromineGpfsReportLinks(pageHtml, NARROMINE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      NARROMINE_PDF_URL,
      'https://www.narromine.nsw.gov.au/2024%202025%20NSC%20Annual%20Report%20Annexure%201%20Financial%20Statements.pdf?downloadable=1',
      'https://www.narromine.nsw.gov.au/2023-2024%20NSC%20Annual%20Report%20-%20Annexure%202%20-%20Financial%20Statements.pdf?downloadable=1',
    ]);
    const selected = selectNarromineGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(NARROMINE_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(NARROMINE_GPFS_REPORTING_URL);
    expect(selected.title).toBe(
      '2025 - 2026 NSC Annual Report - Annexure 1 - Financial Statements',
    );
    expect(fiscalYearFromNarromineGpfsLink('2025 2026 NSC Annual Report - Annexure 1 - Financial Statements')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromNarromineGpfsLink('2024-2025 NSC Annual Report Annexure 1 Financial Statements')).toBe(
      '2024-25',
    );
    expect(
      fiscalYearFromNarromineGpfsLink(
        'Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromNarromineGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/2024%202025%20NSC%20Annual%20Report%20Annexure%201%20Financial%20Statements.pdf?downloadable=1">2024-2025 NSC Annual Report - Annexure 1 - Financial Statements</a>
    `;
    const links = parseNarromineGpfsReportLinks(priorOnly, NARROMINE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectNarromineGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/2026%202027%20NSC%20Annual%20Report%20-%20Annexure%201%20-%20Financial%20Statements.pdf?downloadable=1">2026 - 2027 NSC Annual Report - Annexure 1 - Financial Statements</a>
    `;
    const links = parseNarromineGpfsReportLinks(futureOnly, NARROMINE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectNarromineGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no current anchor', async () => {
    const links = parseNarromineGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      NARROMINE_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = narrominePinnedDocument();
    expect(pinned.url).toBe(NARROMINE_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('Annexure%201%20-%20Financial%20Statements.pdf');
    const discovered = await discoverNarromineGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(NARROMINE_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(NARROMINE_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverNarromineGpfsDocument(
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
      discoverNarromineGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Narromine Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectNarromineGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectNarromineGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = NARROMINE_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseNarromineGpfsExtraction(
      extraction({ income: withoutUnit }),
      NARROMINE_CONTEXT,
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
    source: { sha256: NARROMINE_PDF_SHA256, bytes: 7_899_829 },
    pages: [
      pdfPage(overrides.income ?? NARROMINE_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? NARROMINE_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? NARROMINE_FUNCTIONS_TEXT, 16),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Narromine Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(39_898);
    expect(reconciliation.total_expenses).toBe(30_233);
    expect(reconciliation.employee_expenses).toBe(9_395);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(9_168);
    expect(reconciliation.government_grants_operating).toBe(11_429);
    expect(reconciliation.government_grants_capital).toBe(9_002);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(374);
    expect(reconciliation.net_result).toBe(9_665);
    expect(reconciliation.net_result_before_capital_grants).toBe(663);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(21_065);
    expect(reconciliation.face_expense_bridge).toBe(30_233);
    expect(reconciliation.functions_total_income).toBe(39_898);
    expect(reconciliation.functions_total_expenses).toBe(30_233);
    expect(reconciliation.functions_operating_result).toBe(9_665);
    expect(reconciliation.functions_grants_and_contributions).toBe(20_431);
    expect(reconciliation.comprehensive_income_net_result).toBe(9_665);
    expect(reconciliation.comprehensive_other_income).toBe(28_642);
    expect(reconciliation.comprehensive_total).toBe(38_307);
    expect(reconciliation.comprehensive_revaluation).toBe(28_642);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(39_898);
    expect(reconciliation.expense_components_sum).toBe(21_065);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(3_989_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_023_300_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(939_500_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      916_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_142_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(900_200_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      37_400_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(21_200_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_168_900_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(36_700_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(13_100_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      141_100_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(191_300_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(954_500_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(549_500_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(966_500_000);
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
        source_id: NARROMINE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: NARROMINE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Narromine Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: NARROMINE_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Narromine Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^narromine-gpfs:/);
      expect(record.source_url).toContain('Annexure%201%20-%20Financial%20Statements.pdf');
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
    const broken = NARROMINE_FUNCTIONS_TEXT.replace(
      'Total functions and activities 39,898 35,996 30,233 34,231',
      'Total functions and activities 39,898 35,996 30,235 34,231',
    );
    const parsed = parseNarromineGpfsExtraction(
      extraction({ functions: broken }),
      NARROMINE_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = NARROMINE_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 38,307',
      'Total comprehensive income for the year attributable to Council 38,309',
    );
    const parsed = parseNarromineGpfsExtraction(
      extraction({ comprehensive: broken }),
      NARROMINE_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = NARROMINE_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 11,689',
      'Rates and annual charges B2-1 11,691',
    );
    const parsed = parseNarromineGpfsExtraction(extraction({ income: broken }), NARROMINE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = NARROMINE_COMPREHENSIVE_TEXT.replace(
      'Gain / (loss) on revaluation of infrastructure, property, plant and equipment C1-7 28,642',
      'Gain / (loss) on revaluation of infrastructure, property, plant and equipment C1-7 28,644',
    );
    const parsed = parseNarromineGpfsExtraction(
      extraction({ comprehensive: broken }),
      NARROMINE_CONTEXT,
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
    const url = NARROMINE_CONTEXT.document.url;
    const revenue = narromineGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = narromineGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^narromine-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(narromineGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(narromineGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_narrominegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: NARROMINE_GPFS_ID,
    name: NARROMINE_GPFS_NAME,
    publisher: NARROMINE_GPFS_PUBLISHER,
    source_url: NARROMINE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: NARROMINE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'narromine-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Narromine Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: NARROMINE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-narromine',
        project_name: 'Existing AusTender Narromine contract',
        delivery_entity: 'NARROMINE SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-narromine',
        project_name: 'Existing GrantConnect Narromine grant',
        delivery_entity: 'Narromine Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-narromine-school',
        project_name: 'Existing data.nsw Narromine school row (not a council row)',
        delivery_entity: 'Narromine High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-narromine-charity',
        project_name: 'Existing ACNC Narromine charity row (not the council)',
        delivery_entity: 'Narromine Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'cobar-gpfs',
        source_url: 'https://www.cobar.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-cobar-gpfs-1',
        project_name: 'Existing Cobar GPFS row',
        delivery_entity: 'Cobar Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'cobar-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: NARROMINE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: NARROMINE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: NARROMINE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NARROMINE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NARROMINE_GPFS_ID,
        delivery_entity: { $ne: 'Narromine Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: NARROMINE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
