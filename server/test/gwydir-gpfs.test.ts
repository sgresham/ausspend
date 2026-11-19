import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  GWYDIR_GPFS_DELIVERY_ENTITY,
  GWYDIR_GPFS_DOCUMENT_PIN,
  GWYDIR_GPFS_FISCAL_YEAR,
  GWYDIR_GPFS_ID,
  GWYDIR_GPFS_LICENSE,
  GWYDIR_GPFS_NAME,
  GWYDIR_GPFS_PUBLISHER,
  GWYDIR_GPFS_REPORTING_URL,
  GWYDIR_GPFS_REQUEST_HEADERS,
  gwydirPinnedDocument,
  detectGwydirGpfsUnit,
  discoverGwydirGpfsDocument,
  fiscalYearFromGwydirGpfsLink,
  parseGwydirGpfsExtraction,
  parseGwydirGpfsReportLinks,
  selectGwydirGpfsDocument,
  gwydirGpfsNaturalKey,
} from '../src/connectors/gwydir-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  GWYDIR_COMPREHENSIVE_TEXT,
  GWYDIR_CONTEXT,
  GWYDIR_FUNCTIONS_TEXT,
  GWYDIR_INCOME_TEXT,
  GWYDIR_PDF_SHA256,
  GWYDIR_PDF_URL,
  gwydirExtraction,
} from '../src/connectors/gwydir-gpfs/fixture.js';

// Gwydir Shire Council's audited FY2024-25 standalone General Purpose
// Financial Statements. FY2024-25 is the latest obtainable audited year: no
// FY2025-26 audited standalone statements are published on the official
// Financial Statements and Budgets page as at 2026-11-19. The connector targets
// 2024-25 only and never substitutes 2025-26/2023-24. The Income Statement
// prints the Original unaudited budget column before the line label, with
// Actual 2025 and Actual 2024 after it. A parser that took the first number in
// the line would read the budget; the expected values are all Actual 2025.
// Gwydir prints seven revenue components (2025 net gain on disposal nil) and
// five expense components including a real net loss on disposal of 2,755. The
// net result is positive (7,875) while the before-capital result is negative
// (-11,295). Other comprehensive income prints revaluation 114,402, impairment
// reversal 3,143 and impairment loss (4,638), summing to the printed 112,907.

function parsedFixture() {
  return parseGwydirGpfsExtraction(gwydirExtraction(), GWYDIR_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Gwydir Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/sharedassets/public/v/1/council/governance/financial-statements-and-budgets/annual-financial-statements-2025.pdf">Annual Financial Statements 2025.pdf (PDF,&nbsp;2MB)</a>
    <a href="/files/sharedassets/public/v/1/council/governance/ipampr/2024-audited-financial-statements.pdf">2024 Audited Financial Statements.pdf (PDF,&nbsp;3MB)</a>
    <a href="/files/sharedassets/public/v/1/council/governance/ipampr/annual-report-2025.pdf">Annual Report 2025 (PDF,&nbsp;6MB)</a>
    <a href="https://example.com/annual-financial-statements-2025.pdf">Gwydir financial statements mirror</a>
  `;

  it('discovers the FY2024-25 standalone statements and never the annual report, prior year or a mirror', () => {
    expect(GWYDIR_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseGwydirGpfsReportLinks(pageHtml, GWYDIR_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(links.map((link) => link.url)).toEqual([GWYDIR_PDF_URL]);
    const selected = selectGwydirGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(GWYDIR_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(GWYDIR_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Annual Financial Statements 2025');
    expect(
      fiscalYearFromGwydirGpfsLink('annual-financial-statements-2025.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromGwydirGpfsLink('annual-financial-statements-2023-2024.pdf'),
    ).toBe('2023-24');
    expect(
      fiscalYearFromGwydirGpfsLink(
        'Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromGwydirGpfsLink('Long Term Financial Plan 2023-2033.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/sharedassets/public/v/1/council/governance/financial-statements-and-budgets/annual-financial-statements-2023-2024.pdf">Annual Financial Statements 2023-2024 (PDF,&nbsp;3MB)</a>
    `;
    const links = parseGwydirGpfsReportLinks(priorOnly, GWYDIR_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectGwydirGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/sharedassets/public/v/1/council/governance/financial-statements-and-budgets/annual-financial-statements-2025-2026.pdf">Annual Financial Statements 2025-2026 (PDF,&nbsp;3MB)</a>
    `;
    const links = parseGwydirGpfsReportLinks(futureOnly, GWYDIR_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectGwydirGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseGwydirGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      GWYDIR_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = gwydirPinnedDocument();
    expect(pinned.url).toBe(GWYDIR_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('annual-financial-statements-2025.pdf');
    const discovered = await discoverGwydirGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(GWYDIR_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverGwydirGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(GWYDIR_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(GWYDIR_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverGwydirGpfsDocument(
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
      discoverGwydirGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Gwydir Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectGwydirGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectGwydirGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = GWYDIR_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseGwydirGpfsExtraction(
      extraction({ income: withoutUnit }),
      GWYDIR_CONTEXT,
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
    source: { sha256: GWYDIR_PDF_SHA256, bytes: 1_862_025 },
    pages: [
      pdfPage(overrides.income ?? GWYDIR_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? GWYDIR_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? GWYDIR_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Gwydir Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(59_627);
    expect(reconciliation.total_expenses).toBe(51_752);
    expect(reconciliation.employee_expenses).toBe(16_611);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(10_666);
    expect(reconciliation.government_grants_operating).toBe(10_168);
    expect(reconciliation.government_grants_capital).toBe(19_170);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(2_755);
    expect(reconciliation.net_result).toBe(7_875);
    expect(reconciliation.net_result_before_capital_grants).toBe(-11_295);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(41_086);
    expect(reconciliation.face_expense_bridge).toBe(51_752);
    expect(reconciliation.functions_total_income).toBe(59_627);
    expect(reconciliation.functions_total_expenses).toBe(51_752);
    expect(reconciliation.functions_operating_result).toBe(7_875);
    expect(reconciliation.functions_grants_and_contributions).toBe(29_338);
    expect(reconciliation.comprehensive_income_net_result).toBe(7_875);
    expect(reconciliation.comprehensive_other_income).toBe(112_907);
    expect(reconciliation.comprehensive_total).toBe(120_782);
    expect(reconciliation.comprehensive_revaluation).toBe(114_402);
    expect(reconciliation.comprehensive_impairment_reversal).toBe(3_143);
    expect(reconciliation.comprehensive_impairment_loss).toBe(-4_638);
    expect(reconciliation.revenue_components_sum).toBe(59_627);
    expect(reconciliation.expense_components_sum).toBe(41_086);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(5_962_700_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(5_175_200_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_661_100_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_066_600_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_016_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_917_000_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      275_500_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(122_100_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_276_600_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(752_000_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(34_700_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      120_700_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(69_400_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(1_980_500_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(844_900_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(787_500_000);
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
        source_id: GWYDIR_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: GWYDIR_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Gwydir Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: GWYDIR_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Gwydir Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^gwydir-gpfs:/);
      expect(record.source_url).toContain('annual-financial-statements-2025.pdf');
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
    const broken = GWYDIR_FUNCTIONS_TEXT.replace(
      'Total functions and activities 59,627 59,428 51,752 49,164',
      'Total functions and activities 59,627 59,428 51,754 49,164',
    );
    const parsed = parseGwydirGpfsExtraction(
      extraction({ functions: broken }),
      GWYDIR_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = GWYDIR_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 120,782',
      'Total comprehensive income for the year attributable to Council 120,784',
    );
    const parsed = parseGwydirGpfsExtraction(
      extraction({ comprehensive: broken }),
      GWYDIR_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = GWYDIR_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 12,766',
      'Rates and annual charges B2-1 12,768',
    );
    const parsed = parseGwydirGpfsExtraction(extraction({ income: broken }), GWYDIR_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = GWYDIR_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 2,755',
      'Net loss from the disposal of assets B4-1 2,757',
    );
    const parsed = parseGwydirGpfsExtraction(extraction({ income: broken }), GWYDIR_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when an OCI component is altered', () => {
    const broken = GWYDIR_COMPREHENSIVE_TEXT.replace(
      'Impairment Reversal 3,143 4,914',
      'Impairment Reversal 3,145 4,914',
    );
    const parsed = parseGwydirGpfsExtraction(
      extraction({ comprehensive: broken }),
      GWYDIR_CONTEXT,
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
    const url = GWYDIR_CONTEXT.document.url;
    const revenue = gwydirGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = gwydirGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^gwydir-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(gwydirGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(gwydirGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_gwydirgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: GWYDIR_GPFS_ID,
    name: GWYDIR_GPFS_NAME,
    publisher: GWYDIR_GPFS_PUBLISHER,
    source_url: GWYDIR_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: GWYDIR_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'gwydir-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Gwydir Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: GWYDIR_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-gwydir',
        project_name: 'Existing AusTender Gwydir contract',
        delivery_entity: 'GWYDIR SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-gwydir',
        project_name: 'Existing GrantConnect Gwydir grant',
        delivery_entity: 'Gwydir Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-gwydir-school',
        project_name: 'Existing data.nsw Gwydir school row (not a council row)',
        delivery_entity: 'Gwydir High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-gwydir-charity',
        project_name: 'Existing ACNC Gwydir charity row (not the council)',
        delivery_entity: 'Gwydir Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: GWYDIR_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: GWYDIR_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: GWYDIR_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GWYDIR_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GWYDIR_GPFS_ID,
        delivery_entity: { $ne: 'Gwydir Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: GWYDIR_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
