import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  MID_WESTERN_REGIONAL_GPFS_DELIVERY_ENTITY,
  MID_WESTERN_REGIONAL_GPFS_DOCUMENT_PIN,
  MID_WESTERN_REGIONAL_GPFS_FISCAL_YEAR,
  MID_WESTERN_REGIONAL_GPFS_ID,
  MID_WESTERN_REGIONAL_GPFS_LICENSE,
  MID_WESTERN_REGIONAL_GPFS_NAME,
  MID_WESTERN_REGIONAL_GPFS_PUBLISHER,
  MID_WESTERN_REGIONAL_GPFS_REPORTING_URL,
  MID_WESTERN_REGIONAL_GPFS_REQUEST_HEADERS,
  midWesternRegionalPinnedDocument,
  detectMidWesternRegionalGpfsUnit,
  discoverMidWesternRegionalGpfsDocument,
  fiscalYearFromMidWesternRegionalGpfsLink,
  parseMidWesternRegionalGpfsExtraction,
  parseMidWesternRegionalGpfsReportLinks,
  selectMidWesternRegionalGpfsDocument,
  midWesternRegionalGpfsNaturalKey,
} from '../src/connectors/mid-western-regional-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  MID_WESTERN_REGIONAL_COMPREHENSIVE_TEXT,
  MID_WESTERN_REGIONAL_CONTEXT,
  MID_WESTERN_REGIONAL_FUNCTIONS_TEXT,
  MID_WESTERN_REGIONAL_INCOME_TEXT,
  MID_WESTERN_REGIONAL_PDF_SHA256,
  MID_WESTERN_REGIONAL_PDF_URL,
  midWesternRegionalExtraction,
} from '../src/connectors/mid-western-regional-gpfs/fixture.js';

// Mid-Western Regional Council's audited FY2025-26 standalone financial statements.
// FY2025-26 is the latest audited year published by the council at 2026-11-19;
// no FY2026-27 GPFS is posted, so FY2025-26 is the accepted current-available
// year and the connector never substitutes a 2026-27 or 2024-25 document. The
// statement source is the standalone audited financial statements (not the
// narrative annual report). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2026 and Actual 2025 after
// it. A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2026. Mid-Western Regional prints seven revenue
// lines and five expense lines (including a real net loss on disposal of 2,889).
// The net result and the printed before-capital result are both positive.

function parsedFixture() {
  return parseMidWesternRegionalGpfsExtraction(midWesternRegionalExtraction(), MID_WESTERN_REGIONAL_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Mid-Western Regional Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/2/council/plans-and-strategies/financial-statements/mwrc-financial-statements-2025-26.pdf" title="Financial Statements 2025/26" class="document ext-pdf">Financial Statements 2025/26 (PDF, 2MB)</a>
    <a href="/files/assets/public/v/1/council/plans-and-strategies/annual-reports/annual-report-2024-25-adopted.pdf" title="Annual Report 2024/25" class="document ext-pdf">Annual Report 2024/25 (PDF, 12MB)</a>
    <a href="/files/assets/public/v/2/council/plans-and-strategies/financial-statements/financial-statements-2024-25.pdf" title="Financial Statements 2024/25" class="document ext-pdf">Financial Statements 2024/25 (PDF, 9MB)</a>
    <a href="https://example.com/mwrc-financial-statements-2025-26.pdf">Financial Statements 2025/26</a>
  `;

  it('discovers the FY2025-26 financial statements and never the annual report or a mirror', () => {
    expect(MID_WESTERN_REGIONAL_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseMidWesternRegionalGpfsReportLinks(
      pageHtml,
      MID_WESTERN_REGIONAL_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.map((link) => link.url)).toEqual([
      MID_WESTERN_REGIONAL_PDF_URL,
      'https://www.midwestern.nsw.gov.au/files/assets/public/v/2/council/plans-and-strategies/financial-statements/financial-statements-2024-25.pdf',
    ]);
    const selected = selectMidWesternRegionalGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(MID_WESTERN_REGIONAL_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(MID_WESTERN_REGIONAL_GPFS_REPORTING_URL);
    expect(fiscalYearFromMidWesternRegionalGpfsLink('Financial Statements 2025/26')).toBe(
      '2025-26',
    );
    expect(
      fiscalYearFromMidWesternRegionalGpfsLink(
        'https://www.midwestern.nsw.gov.au/files/assets/public/v/2/council/plans-and-strategies/financial-statements/mwrc-financial-statements-2025-26.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromMidWesternRegionalGpfsLink(
        'https://www.midwestern.nsw.gov.au/files/assets/public/v/2/council/plans-and-strategies/financial-statements/financial-statements-2024-25.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromMidWesternRegionalGpfsLink('Long Term Financial Plan 2021-2034.pdf'),
    ).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/2/council/plans-and-strategies/financial-statements/financial-statements-2024-25.pdf" title="Financial Statements 2024/25">Financial Statements 2024/25</a>
    `;
    const links = parseMidWesternRegionalGpfsReportLinks(
      priorOnly,
      MID_WESTERN_REGIONAL_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectMidWesternRegionalGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/2/council/plans-and-strategies/financial-statements/mwrc-financial-statements-2026-27.pdf" title="Financial Statements 2026/27">Financial Statements 2026/27</a>
    `;
    const links = parseMidWesternRegionalGpfsReportLinks(
      futureOnly,
      MID_WESTERN_REGIONAL_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectMidWesternRegionalGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no current anchor', async () => {
    const links = parseMidWesternRegionalGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      MID_WESTERN_REGIONAL_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = midWesternRegionalPinnedDocument();
    expect(pinned.url).toBe(MID_WESTERN_REGIONAL_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('mwrc-financial-statements-2025-26.pdf');
    const discovered = await discoverMidWesternRegionalGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(MID_WESTERN_REGIONAL_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA so the Akamai WAF does not return 403', async () => {
    expect(MID_WESTERN_REGIONAL_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverMidWesternRegionalGpfsDocument(
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
      discoverMidWesternRegionalGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Mid-Western Regional Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectMidWesternRegionalGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectMidWesternRegionalGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = MID_WESTERN_REGIONAL_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseMidWesternRegionalGpfsExtraction(
      extraction({ income: withoutUnit }),
      MID_WESTERN_REGIONAL_CONTEXT,
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
    source: { sha256: MID_WESTERN_REGIONAL_PDF_SHA256, bytes: 1_063_092 },
    pages: [
      pdfPage(overrides.income ?? MID_WESTERN_REGIONAL_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? MID_WESTERN_REGIONAL_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? MID_WESTERN_REGIONAL_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Mid-Western Regional Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(127_209);
    expect(reconciliation.total_expenses).toBe(108_319);
    expect(reconciliation.employee_expenses).toBe(39_805);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(29_342);
    expect(reconciliation.government_grants_operating).toBe(22_698);
    expect(reconciliation.government_grants_capital).toBe(14_863);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(2_889);
    expect(reconciliation.net_result).toBe(18_890);
    expect(reconciliation.net_result_before_capital_grants).toBe(4_027);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(78_977);
    expect(reconciliation.face_expense_bridge).toBe(108_319);
    expect(reconciliation.functions_total_income).toBe(127_209);
    expect(reconciliation.functions_total_expenses).toBe(108_319);
    expect(reconciliation.functions_operating_result).toBe(18_890);
    expect(reconciliation.functions_grants_and_contributions).toBe(37_561);
    expect(reconciliation.comprehensive_income_net_result).toBe(18_890);
    expect(reconciliation.comprehensive_other_income).toBe(54_221);
    expect(reconciliation.comprehensive_total).toBe(73_111);
    expect(reconciliation.comprehensive_revaluation).toBe(54_434);
    expect(reconciliation.comprehensive_impairment).toBe(-321);
    expect(reconciliation.comprehensive_remediation_provision).toBe(108);
    expect(reconciliation.revenue_components_sum).toBe(127_209);
    expect(reconciliation.expense_components_sum).toBe(78_977);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(12_720_900_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(10_831_900_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(3_980_500_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_934_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_269_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_486_300_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      288_900_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(95_300_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(5_233_400_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(154_900_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(231_800_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_889_000_000);
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
        source_id: MID_WESTERN_REGIONAL_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: MID_WESTERN_REGIONAL_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Mid-Western Regional Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: MID_WESTERN_REGIONAL_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Mid-Western Regional Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^mid-western-regional-gpfs:/);
      expect(record.source_url).toContain('mwrc-financial-statements-2025-26.pdf');
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
    const broken = MID_WESTERN_REGIONAL_FUNCTIONS_TEXT.replace(
      'Total functions and activities 127,209 121,914 108,319 103,037',
      'Total functions and activities 127,209 121,914 108,321 103,037',
    );
    const parsed = parseMidWesternRegionalGpfsExtraction(
      extraction({ functions: broken }),
      MID_WESTERN_REGIONAL_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = MID_WESTERN_REGIONAL_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 73,111',
      'Total comprehensive income for the year attributable to Council 73,113',
    );
    const parsed = parseMidWesternRegionalGpfsExtraction(
      extraction({ comprehensive: broken }),
      MID_WESTERN_REGIONAL_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = MID_WESTERN_REGIONAL_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 52,334',
      'Rates and annual charges B2-1 52,336',
    );
    const parsed = parseMidWesternRegionalGpfsExtraction(extraction({ income: broken }), MID_WESTERN_REGIONAL_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = MID_WESTERN_REGIONAL_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 54,434',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 54,436',
    );
    const parsed = parseMidWesternRegionalGpfsExtraction(
      extraction({ comprehensive: broken }),
      MID_WESTERN_REGIONAL_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the remediation-provision OCI component is altered', () => {
    const broken = MID_WESTERN_REGIONAL_COMPREHENSIVE_TEXT.replace(
      'Asset Remediation provision movements 108',
      'Asset Remediation provision movements 110',
    );
    const parsed = parseMidWesternRegionalGpfsExtraction(
      extraction({ comprehensive: broken }),
      MID_WESTERN_REGIONAL_CONTEXT,
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
    const url = MID_WESTERN_REGIONAL_CONTEXT.document.url;
    const revenue = midWesternRegionalGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = midWesternRegionalGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^mid-western-regional-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(midWesternRegionalGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(midWesternRegionalGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_mid-western-regionalgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: MID_WESTERN_REGIONAL_GPFS_ID,
    name: MID_WESTERN_REGIONAL_GPFS_NAME,
    publisher: MID_WESTERN_REGIONAL_GPFS_PUBLISHER,
    source_url: MID_WESTERN_REGIONAL_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: MID_WESTERN_REGIONAL_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'mid-western-regional-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Mid-Western Regional Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: MID_WESTERN_REGIONAL_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-mid-western-regional',
        project_name: 'Existing AusTender Mid-Western Regional contract',
        delivery_entity: 'MID-WESTERN REGIONAL COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-mid-western-regional',
        project_name: 'Existing GrantConnect Mid-Western Regional grant',
        delivery_entity: 'Mid-Western Regional Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-mid-western-regional-school',
        project_name: 'Existing data.nsw Mid-Western Regional school row (not a council row)',
        delivery_entity: 'Mid-Western Regional High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-mid-western-regional-charity',
        project_name: 'Existing ACNC Mid-Western Regional charity row (not the council)',
        delivery_entity: 'Mid-Western Regional Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: MID_WESTERN_REGIONAL_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: MID_WESTERN_REGIONAL_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: MID_WESTERN_REGIONAL_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MID_WESTERN_REGIONAL_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MID_WESTERN_REGIONAL_GPFS_ID,
        delivery_entity: { $ne: 'Mid-Western Regional Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: MID_WESTERN_REGIONAL_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
