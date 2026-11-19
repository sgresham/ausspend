import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  QUEANBEYAN_PALERANG_GPFS_DELIVERY_ENTITY,
  QUEANBEYAN_PALERANG_GPFS_DOCUMENT_PIN,
  QUEANBEYAN_PALERANG_GPFS_FISCAL_YEAR,
  QUEANBEYAN_PALERANG_GPFS_ID,
  QUEANBEYAN_PALERANG_GPFS_LICENSE,
  QUEANBEYAN_PALERANG_GPFS_NAME,
  QUEANBEYAN_PALERANG_GPFS_PUBLISHER,
  QUEANBEYAN_PALERANG_GPFS_REPORTING_URL,
  QUEANBEYAN_PALERANG_GPFS_REQUEST_HEADERS,
  queanbeyanPalerangPinnedDocument,
  detectQueanbeyanPalerangGpfsUnit,
  discoverQueanbeyanPalerangGpfsDocument,
  fiscalYearFromQueanbeyanPalerangGpfsLink,
  parseQueanbeyanPalerangGpfsExtraction,
  parseQueanbeyanPalerangGpfsReportLinks,
  selectQueanbeyanPalerangGpfsDocument,
  queanbeyanPalerangGpfsNaturalKey,
} from '../src/connectors/queanbeyan-palerang-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  QUEANBEYAN_PALERANG_COMPREHENSIVE_TEXT,
  QUEANBEYAN_PALERANG_CONTEXT,
  QUEANBEYAN_PALERANG_FUNCTIONS_TEXT,
  QUEANBEYAN_PALERANG_INCOME_TEXT,
  QUEANBEYAN_PALERANG_PDF_SHA256,
  QUEANBEYAN_PALERANG_PDF_URL,
  queanbeyanPalerangExtraction,
} from '../src/connectors/queanbeyan-palerang-gpfs/fixture.js';

// Queanbeyan-Palerang Regional Council's audited FY2025-26 standalone financial statements.
// FY2025-26 is the latest audited year published by the council at 2026-11-19;
// no FY2026-27 GPFS is posted, so FY2025-26 is the accepted current-available
// year and the connector never substitutes a 2026-27 or 2023-24 document. The
// statement source is the standalone audited financial statements (not the
// narrative annual report). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2026 and Actual 2025 after
// it. A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2026. Queanbeyan-Palerang prints seven revenue lines and
// five expense lines (including a real net loss on disposal of 5,424). The net
// result and the before-capital result are both positive.

function parsedFixture() {
  return parseQueanbeyanPalerangGpfsExtraction(queanbeyanPalerangExtraction(), QUEANBEYAN_PALERANG_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Queanbeyan-Palerang Regional Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/council/budgets-and-planning/financial_statements-2025-2026.pdf" title="Download the Financial Statements 2025-26" class="document ext-pdf">Download the Financial Statements 2025-26 (PDF, 3MB)</a>
    <a href="/files/assets/public/v/1/council/budgets-and-planning/annual-report-2025-26-for-website.pdf" title="Download the Annual Report 2025-26" class="document ext-pdf">Download the Annual Report 2025-26 (PDF, 6MB)</a>
    <a href="/files/assets/public/v/1/council/budgets-and-planning/qprc-annual-financial-statements-2024-2025.pdf" title="Financial Statements 2024-25" class="document ext-pdf">Financial Statements 2024-25 (PDF, 3MB)</a>
    <a href="https://example.com/financial_statements-2025-2026.pdf">Download the Financial Statements 2025-26</a>
  `;

  it('discovers the FY2025-26 financial statements and never the annual report or a mirror', () => {
    expect(QUEANBEYAN_PALERANG_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseQueanbeyanPalerangGpfsReportLinks(pageHtml, QUEANBEYAN_PALERANG_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.map((link) => link.url)).toEqual([
      QUEANBEYAN_PALERANG_PDF_URL,
      'https://www.qprc.nsw.gov.au/files/assets/public/v/1/council/budgets-and-planning/qprc-annual-financial-statements-2024-2025.pdf',
    ]);
    const selected = selectQueanbeyanPalerangGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(QUEANBEYAN_PALERANG_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(QUEANBEYAN_PALERANG_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromQueanbeyanPalerangGpfsLink('Download the Financial Statements 2025-26'),
    ).toBe('2025-26');
    expect(
      fiscalYearFromQueanbeyanPalerangGpfsLink(
        'https://www.qprc.nsw.gov.au/files/assets/public/v/1/council/budgets-and-planning/financial_statements-2025-2026.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromQueanbeyanPalerangGpfsLink(
        'https://www.qprc.nsw.gov.au/files/assets/public/v/1/council/budgets-and-planning/qprc-annual-financial-statements-2024-2025.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromQueanbeyanPalerangGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/council/budgets-and-planning/qprc-annual-financial-statements-2024-2025.pdf" title="Financial Statements 2024-25">Financial Statements 2024-25</a>
    `;
    const links = parseQueanbeyanPalerangGpfsReportLinks(priorOnly, QUEANBEYAN_PALERANG_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectQueanbeyanPalerangGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/council/budgets-and-planning/financial_statements-2026-2027.pdf" title="Financial Statements 2026-27">Financial Statements 2026-27</a>
    `;
    const links = parseQueanbeyanPalerangGpfsReportLinks(futureOnly, QUEANBEYAN_PALERANG_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectQueanbeyanPalerangGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no current anchor', async () => {
    const links = parseQueanbeyanPalerangGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      QUEANBEYAN_PALERANG_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = queanbeyanPalerangPinnedDocument();
    expect(pinned.url).toBe(QUEANBEYAN_PALERANG_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('financial_statements-2025-2026.pdf');
    const discovered = await discoverQueanbeyanPalerangGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(QUEANBEYAN_PALERANG_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA so the Akamai WAF does not return 403', async () => {
    expect(QUEANBEYAN_PALERANG_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverQueanbeyanPalerangGpfsDocument(
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
      discoverQueanbeyanPalerangGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Queanbeyan-Palerang Regional Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectQueanbeyanPalerangGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectQueanbeyanPalerangGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = QUEANBEYAN_PALERANG_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseQueanbeyanPalerangGpfsExtraction(
      extraction({ income: withoutUnit }),
      QUEANBEYAN_PALERANG_CONTEXT,
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
    source: { sha256: QUEANBEYAN_PALERANG_PDF_SHA256, bytes: 1_063_092 },
    pages: [
      pdfPage(overrides.income ?? QUEANBEYAN_PALERANG_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? QUEANBEYAN_PALERANG_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? QUEANBEYAN_PALERANG_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Queanbeyan-Palerang Regional Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(278_036);
    expect(reconciliation.total_expenses).toBe(216_684);
    expect(reconciliation.employee_expenses).toBe(55_436);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(47_965);
    expect(reconciliation.government_grants_operating).toBe(19_052);
    expect(reconciliation.government_grants_capital).toBe(59_340);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(16_345);
    expect(reconciliation.net_result).toBe(61_352);
    expect(reconciliation.net_result_before_capital_grants).toBe(2_012);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(168_719);
    expect(reconciliation.face_expense_bridge).toBe(216_684);
    expect(reconciliation.functions_total_income).toBe(278_036);
    expect(reconciliation.functions_total_expenses).toBe(216_684);
    expect(reconciliation.functions_operating_result).toBe(61_352);
    expect(reconciliation.functions_grants_and_contributions).toBe(78_392);
    expect(reconciliation.comprehensive_income_net_result).toBe(61_352);
    expect(reconciliation.comprehensive_other_income).toBe(123_457);
    expect(reconciliation.comprehensive_total).toBe(184_809);
    expect(reconciliation.comprehensive_revaluation).toBe(123_457);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(278_036);
    expect(reconciliation.expense_components_sum).toBe(168_719);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(27_803_600_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(21_668_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(5_543_600_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      4_796_500_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_905_200_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(5_934_000_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      1_634_500_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(1_072_900_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(12_520_000_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(183_400_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(566_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(6_135_200_000);
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
        source_id: QUEANBEYAN_PALERANG_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: QUEANBEYAN_PALERANG_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Queanbeyan-Palerang Regional Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: QUEANBEYAN_PALERANG_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Queanbeyan-Palerang Regional Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^queanbeyan-palerang-gpfs:/);
      expect(record.source_url).toContain('financial_statements-2025-2026.pdf');
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
    const broken = QUEANBEYAN_PALERANG_FUNCTIONS_TEXT.replace(
      'Total functions and activities 278,036 243,019 216,684 198,829',
      'Total functions and activities 278,036 243,019 216,686 198,829',
    );
    const parsed = parseQueanbeyanPalerangGpfsExtraction(
      extraction({ functions: broken }),
      QUEANBEYAN_PALERANG_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = QUEANBEYAN_PALERANG_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 184,809',
      'Total comprehensive income for the year attributable to Council 184,811',
    );
    const parsed = parseQueanbeyanPalerangGpfsExtraction(
      extraction({ comprehensive: broken }),
      QUEANBEYAN_PALERANG_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = QUEANBEYAN_PALERANG_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 125,200',
      'Rates and annual charges B2-1 125,202',
    );
    const parsed = parseQueanbeyanPalerangGpfsExtraction(extraction({ income: broken }), QUEANBEYAN_PALERANG_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = QUEANBEYAN_PALERANG_COMPREHENSIVE_TEXT.replace(
      'Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-8 123,457',
      'Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-8 123,459',
    );
    const parsed = parseQueanbeyanPalerangGpfsExtraction(
      extraction({ comprehensive: broken }),
      QUEANBEYAN_PALERANG_CONTEXT,
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
    const url = QUEANBEYAN_PALERANG_CONTEXT.document.url;
    const revenue = queanbeyanPalerangGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = queanbeyanPalerangGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^queanbeyan-palerang-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(queanbeyanPalerangGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(queanbeyanPalerangGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_queanbeyan-paleranggpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: QUEANBEYAN_PALERANG_GPFS_ID,
    name: QUEANBEYAN_PALERANG_GPFS_NAME,
    publisher: QUEANBEYAN_PALERANG_GPFS_PUBLISHER,
    source_url: QUEANBEYAN_PALERANG_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: QUEANBEYAN_PALERANG_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'queanbeyan-palerang-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Queanbeyan-Palerang Regional Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: QUEANBEYAN_PALERANG_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-queanbeyan-palerang',
        project_name: 'Existing AusTender Queanbeyan-Palerang contract',
        delivery_entity: 'QUEANBEYAN-PALERANG REGIONAL COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-queanbeyan-palerang',
        project_name: 'Existing GrantConnect Queanbeyan-Palerang grant',
        delivery_entity: 'Queanbeyan-Palerang Regional Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-queanbeyan-palerang-school',
        project_name: 'Existing data.nsw Queanbeyan-Palerang school row (not a council row)',
        delivery_entity: 'Queanbeyan-Palerang High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-queanbeyan-palerang-charity',
        project_name: 'Existing ACNC Queanbeyan-Palerang charity row (not the council)',
        delivery_entity: 'Queanbeyan-Palerang Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: QUEANBEYAN_PALERANG_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: QUEANBEYAN_PALERANG_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: QUEANBEYAN_PALERANG_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: QUEANBEYAN_PALERANG_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: QUEANBEYAN_PALERANG_GPFS_ID,
        delivery_entity: { $ne: 'Queanbeyan-Palerang Regional Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: QUEANBEYAN_PALERANG_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
