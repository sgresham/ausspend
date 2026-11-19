import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  INVERELL_GPFS_DELIVERY_ENTITY,
  INVERELL_GPFS_DOCUMENT_PIN,
  INVERELL_GPFS_FISCAL_YEAR,
  INVERELL_GPFS_ID,
  INVERELL_GPFS_LICENSE,
  INVERELL_GPFS_NAME,
  INVERELL_GPFS_PUBLISHER,
  INVERELL_GPFS_REPORTING_URL,
  INVERELL_GPFS_REQUEST_HEADERS,
  inverellPinnedDocument,
  detectInverellGpfsUnit,
  discoverInverellGpfsDocument,
  fiscalYearFromInverellGpfsLink,
  parseInverellGpfsExtraction,
  parseInverellGpfsReportLinks,
  selectInverellGpfsDocument,
  inverellGpfsNaturalKey,
} from '../src/connectors/inverell-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  INVERELL_COMPREHENSIVE_TEXT,
  INVERELL_CONTEXT,
  INVERELL_FUNCTIONS_TEXT,
  INVERELL_INCOME_TEXT,
  INVERELL_PDF_SHA256,
  INVERELL_PDF_URL,
  inverellExtraction,
} from '../src/connectors/inverell-gpfs/fixture.js';

// Inverell Shire Council's audited FY2025-26 standalone General Purpose
// Financial Statements. FY2025-26 is the current year for this source; the
// connector targets 2025-26 only and never substitutes the prior 2024-25 or
// 2023-24 documents (the item title originally said FY2024-25, but the official
// FY2025-26 statements are published and are the current audited year). The
// Income Statement prints the Original unaudited budget column before the line
// label, with Actual 2026 and Actual 2025 after it. A parser that took the first
// number in the line would read the budget; the expected values are all Actual
// 2026. Inverell prints seven revenue components (other revenues and other
// income are separate) and five expense components including a real net loss on
// disposal of 590. The printed 2026 net gain on disposal is nil. The net result
// and the before-capital result are both positive. Other comprehensive income
// has a single component (revaluation 122,531).

function parsedFixture() {
  return parseInverellGpfsExtraction(inverellExtraction(), INVERELL_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Inverell Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/wp-content/uploads/2026/11/Annual-Financial-Statements-2025-2026.pdf">Annual Financial Statements 2025-2026</a>
    <a href="/wp-content/uploads/2026/11/Inverell-Shire-Council-2025-2026-Annual-Report.pdf">Inverell Shire Council Annual Report 2025-2026</a>
    <a href="/wp-content/uploads/2025/11/Annual-Financial_Statements-2024-2025.pdf">Annual Financial Statements 2024-2025</a>
    <a href="/wp-content/uploads/2026/11/Annual-Financial-Statements-SPFS-2025-2026.pdf">Annual Financial Statements SPFS 2025-2026</a>
    <a href="/wp-content/uploads/2026/11/Annual-Financial-Statements-Special-Schedules-2025-2026.pdf">Annual Financial Statements Special Schedules 2025-2026</a>
    <a href="https://example.com/Annual-Financial-Statements-2025-2026.pdf">Annual Financial Statements 2025-2026 mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the prior year, annual report, SPFS or a mirror', () => {
    expect(INVERELL_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseInverellGpfsReportLinks(pageHtml, INVERELL_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.map((link) => link.url)).toEqual([
      INVERELL_PDF_URL,
      'https://inverell.nsw.gov.au/wp-content/uploads/2025/11/Annual-Financial_Statements-2024-2025.pdf',
    ]);
    const selected = selectInverellGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(INVERELL_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(INVERELL_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Annual Financial Statements 2025-2026');
    expect(fiscalYearFromInverellGpfsLink('Annual-Financial-Statements-2025-2026.pdf')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromInverellGpfsLink('Annual-Financial_Statements-2024-2025.pdf')).toBe(
      '2024-25',
    );
    expect(
      fiscalYearFromInverellGpfsLink(
        'Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromInverellGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/wp-content/uploads/2025/11/Annual-Financial_Statements-2024-2025.pdf">Annual Financial Statements 2024-2025</a>
    `;
    const links = parseInverellGpfsReportLinks(priorOnly, INVERELL_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectInverellGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/wp-content/uploads/2027/11/Annual-Financial-Statements-2026-2027.pdf">Annual Financial Statements 2026-2027</a>
    `;
    const links = parseInverellGpfsReportLinks(futureOnly, INVERELL_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectInverellGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official FY2025-26 pin when the listing yields no usable anchor', async () => {
    const links = parseInverellGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      INVERELL_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = inverellPinnedDocument();
    expect(pinned.url).toBe(INVERELL_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('Annual-Financial-Statements-2025-2026.pdf');
    const discovered = await discoverInverellGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(INVERELL_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the publications page returns a 403 challenge', async () => {
    const discovered = await discoverInverellGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(INVERELL_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(INVERELL_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverInverellGpfsDocument(
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
      discoverInverellGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Inverell Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectInverellGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectInverellGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INVERELL_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseInverellGpfsExtraction(
      extraction({ income: withoutUnit }),
      INVERELL_CONTEXT,
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
    source: { sha256: INVERELL_PDF_SHA256, bytes: 6_365_791 },
    pages: [
      pdfPage(overrides.income ?? INVERELL_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? INVERELL_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? INVERELL_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Inverell Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(62_978);
    expect(reconciliation.total_expenses).toBe(51_385);
    expect(reconciliation.employee_expenses).toBe(16_799);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(16_136);
    expect(reconciliation.government_grants_operating).toBe(20_824);
    expect(reconciliation.government_grants_capital).toBe(1_639);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(590);
    expect(reconciliation.net_result).toBe(11_593);
    expect(reconciliation.net_result_before_capital_grants).toBe(9_954);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(35_249);
    expect(reconciliation.face_expense_bridge).toBe(51_385);
    expect(reconciliation.functions_total_income).toBe(62_978);
    expect(reconciliation.functions_total_expenses).toBe(51_385);
    expect(reconciliation.functions_operating_result).toBe(11_593);
    expect(reconciliation.functions_grants_and_contributions).toBe(22_463);
    expect(reconciliation.comprehensive_income_net_result).toBe(11_593);
    expect(reconciliation.comprehensive_other_income).toBe(122_531);
    expect(reconciliation.comprehensive_total).toBe(134_124);
    expect(reconciliation.comprehensive_revaluation).toBe(122_531);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(62_978);
    expect(reconciliation.expense_components_sum).toBe(35_249);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(6_297_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(5_138_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_679_900_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_613_600_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_082_400_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(163_900_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      59_000_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(70_700_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(2_747_300_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(126_600_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(33_300_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      410_300_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(105_800_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(1_609_500_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(734_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_159_300_000);
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
        source_id: INVERELL_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: INVERELL_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Inverell Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: INVERELL_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Inverell Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^inverell-gpfs:/);
      expect(record.source_url).toContain('Annual-Financial-Statements-2025-2026.pdf');
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
    const broken = INVERELL_FUNCTIONS_TEXT.replace(
      'Total functions and activities 62,978 62,479 51,385 54,133',
      'Total functions and activities 62,978 62,479 51,387 54,133',
    );
    const parsed = parseInverellGpfsExtraction(
      extraction({ functions: broken }),
      INVERELL_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = INVERELL_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 134,124',
      'Total comprehensive income for the year attributable to Council 134,126',
    );
    const parsed = parseInverellGpfsExtraction(
      extraction({ comprehensive: broken }),
      INVERELL_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INVERELL_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 27,473',
      'Rates and annual charges B2-1 27,475',
    );
    const parsed = parseInverellGpfsExtraction(extraction({ income: broken }), INVERELL_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = INVERELL_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 590',
      'Net loss from the disposal of assets B4-1 592',
    );
    const parsed = parseInverellGpfsExtraction(extraction({ income: broken }), INVERELL_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = INVERELL_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 122,531',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 122,533',
    );
    const parsed = parseInverellGpfsExtraction(
      extraction({ comprehensive: broken }),
      INVERELL_CONTEXT,
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
    const url = INVERELL_CONTEXT.document.url;
    const revenue = inverellGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = inverellGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^inverell-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(inverellGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(inverellGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_inverellgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: INVERELL_GPFS_ID,
    name: INVERELL_GPFS_NAME,
    publisher: INVERELL_GPFS_PUBLISHER,
    source_url: INVERELL_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: INVERELL_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'inverell-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Inverell Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: INVERELL_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-inverell',
        project_name: 'Existing AusTender Inverell contract',
        delivery_entity: 'INVERELL SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-inverell',
        project_name: 'Existing GrantConnect Inverell grant',
        delivery_entity: 'Inverell Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-inverell-school',
        project_name: 'Existing data.nsw Inverell school row (not a council row)',
        delivery_entity: 'Inverell High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-inverell-charity',
        project_name: 'Existing ACNC Inverell charity row (not the council)',
        delivery_entity: 'Inverell Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'narromine-gpfs',
        source_url: 'https://www.narromine.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-narromine-gpfs-1',
        project_name: 'Existing Narromine GPFS row',
        delivery_entity: 'Narromine Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'narromine-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: INVERELL_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: INVERELL_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: INVERELL_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: INVERELL_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: INVERELL_GPFS_ID,
        delivery_entity: { $ne: 'Inverell Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: INVERELL_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
