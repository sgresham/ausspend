import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BYRON_GPFS_DELIVERY_ENTITY,
  BYRON_GPFS_DOCUMENT_PIN,
  BYRON_GPFS_FISCAL_YEAR,
  BYRON_GPFS_ID,
  BYRON_GPFS_LICENSE,
  BYRON_GPFS_NAME,
  BYRON_GPFS_PUBLISHER,
  BYRON_GPFS_REPORTING_URL,
  BYRON_GPFS_REQUEST_HEADERS,
  byronPinnedDocument,
  detectByronGpfsUnit,
  discoverByronGpfsDocument,
  fiscalYearFromByronGpfsLink,
  parseByronGpfsExtraction,
  parseByronGpfsReportLinks,
  selectByronGpfsDocument,
  byronGpfsNaturalKey,
} from '../src/connectors/byron-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  BYRON_COMPREHENSIVE_TEXT,
  BYRON_CONTEXT,
  BYRON_FUNCTIONS_TEXT,
  BYRON_INCOME_TEXT,
  BYRON_PDF_SHA256,
  BYRON_PDF_URL,
  byronExtraction,
} from '../src/connectors/byron-gpfs/fixture.js';

// Byron Shire Council's audited FY2025-26 standalone financial statements.
// FY2025-26 is the latest audited year published by the council at 2026-11-19;
// no FY2026-27 GPFS is posted, so FY2025-26 is the accepted current-available
// year and the connector never substitutes a 2026-27 or 2023-24 document. The
// statement source is the standalone audited financial statements (not the
// narrative annual report). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2026 and Actual 2025 after
// it. A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2026. Byron prints seven revenue lines and
// five expense lines (including a real net loss on disposal of 5,424). The net
// result and the before-capital result are both positive.

function parsedFixture() {
  return parseByronGpfsExtraction(byronExtraction(), BYRON_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Byron Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/2/hptrim/financial-management-budgeting-operational-budget-documentation-20262027/final-published-2025-26-financial-statements-byron-shire-council.pdf" title="Financial Statements 2025 to 2026" class="document ext-pdf">Financial Statements 2025 to 2026 (PDF, 3MB)</a>
    <a href="/files/assets/public/v/1/hptrim/corporate-management-planning-strategic-corporate-or-business-2026/annual-report-2025-to-2026.pdf" title="Annual Report 2025 to 2026" class="document ext-pdf">Annual Report 2025 to 2026 (PDF, 21MB)</a>
    <a href="/files/assets/public/v/1/hptrim/financial-management-financial-reporting-financial-statements-working-papers-20252026/final-published-2024-25-financial-statements-byron-shire-council.pdf" title="Financial Statements 2024 to 2025" class="document ext-pdf">Financial Statements 2024 to 2025 (PDF, 4MB)</a>
    <a href="https://example.com/final-published-2025-26-financial-statements-byron-shire-council.pdf">Financial Statements 2025 to 2026</a>
  `;

  it('discovers the FY2025-26 financial statements and never the annual report or a mirror', () => {
    expect(BYRON_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseByronGpfsReportLinks(pageHtml, BYRON_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.map((link) => link.url)).toEqual([
      BYRON_PDF_URL,
      'https://www.byron.nsw.gov.au/files/assets/public/v/1/hptrim/financial-management-financial-reporting-financial-statements-working-papers-20252026/final-published-2024-25-financial-statements-byron-shire-council.pdf',
    ]);
    const selected = selectByronGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(BYRON_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(BYRON_GPFS_REPORTING_URL);
    expect(fiscalYearFromByronGpfsLink('Financial Statements 2025 to 2026 (PDF, 3MB)')).toBe(
      '2025-26',
    );
    expect(
      fiscalYearFromByronGpfsLink(
        'https://www.byron.nsw.gov.au/files/assets/public/v/2/hptrim/financial-management-budgeting-operational-budget-documentation-20262027/final-published-2025-26-financial-statements-byron-shire-council.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromByronGpfsLink(
        'https://www.byron.nsw.gov.au/files/assets/public/v/1/hptrim/financial-management-financial-reporting-financial-statements-working-papers-20252026/final-published-2024-25-financial-statements-byron-shire-council.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromByronGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/hptrim/financial-management-financial-reporting-financial-statements-working-papers-20252026/final-published-2024-25-financial-statements-byron-shire-council.pdf" title="Financial Statements 2024 to 2025">Financial Statements 2024 to 2025</a>
    `;
    const links = parseByronGpfsReportLinks(priorOnly, BYRON_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectByronGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/hptrim/financial-management-budgeting-operational-budget-documentation-20272028/final-published-2026-27-financial-statements-byron-shire-council.pdf" title="Financial Statements 2026 to 2027">Financial Statements 2026 to 2027</a>
    `;
    const links = parseByronGpfsReportLinks(futureOnly, BYRON_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectByronGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseByronGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      BYRON_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = byronPinnedDocument();
    expect(pinned.url).toBe(BYRON_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('final-published-2025-26-financial-statements-byron-shire-council.pdf');
    const discovered = await discoverByronGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(BYRON_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA so the Akamai WAF does not return 403', async () => {
    expect(BYRON_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverByronGpfsDocument(
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
      discoverByronGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Byron Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectByronGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectByronGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = BYRON_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseByronGpfsExtraction(
      extraction({ income: withoutUnit }),
      BYRON_CONTEXT,
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
    source: { sha256: BYRON_PDF_SHA256, bytes: 1_063_092 },
    pages: [
      pdfPage(overrides.income ?? BYRON_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? BYRON_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? BYRON_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Byron Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(188_568);
    expect(reconciliation.total_expenses).toBe(140_726);
    expect(reconciliation.employee_expenses).toBe(38_264);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(26_499);
    expect(reconciliation.government_grants_operating).toBe(17_895);
    expect(reconciliation.government_grants_capital).toBe(53_137);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(5_805);
    expect(reconciliation.net_result).toBe(47_842);
    expect(reconciliation.net_result_before_capital_grants).toBe(-5_295);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(114_227);
    expect(reconciliation.face_expense_bridge).toBe(140_726);
    expect(reconciliation.functions_total_income).toBe(188_568);
    expect(reconciliation.functions_total_expenses).toBe(140_726);
    expect(reconciliation.functions_operating_result).toBe(47_842);
    expect(reconciliation.functions_grants_and_contributions).toBe(71_032);
    expect(reconciliation.comprehensive_income_net_result).toBe(47_842);
    expect(reconciliation.comprehensive_other_income).toBe(-58_472);
    expect(reconciliation.comprehensive_total).toBe(-10_630);
    expect(reconciliation.comprehensive_revaluation).toBe(-58_766);
    expect(reconciliation.comprehensive_impairment).toBe(191);
    expect(reconciliation.comprehensive_joint_ventures).toBe(103);
    expect(reconciliation.comprehensive_items_not_reclassified).toBe(-58_472);
    expect(reconciliation.revenue_components_sum).toBe(188_568);
    expect(reconciliation.expense_components_sum).toBe(114_227);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(18_856_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(14_072_600_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(3_826_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_649_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_789_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(5_313_700_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      580_500_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(253_600_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(7_038_400_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(268_700_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(197_000_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(4_784_200_000);
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
        source_id: BYRON_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: BYRON_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Byron Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: BYRON_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Byron Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^byron-gpfs:/);
      expect(record.source_url).toContain('final-published-2025-26-financial-statements-byron-shire-council.pdf');
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
    const broken = BYRON_FUNCTIONS_TEXT.replace(
      'Total functions and activities 188,568 165,148 140,726 145,399',
      'Total functions and activities 188,568 165,148 140,728 145,399',
    );
    const parsed = parseByronGpfsExtraction(
      extraction({ functions: broken }),
      BYRON_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = BYRON_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council (10,630)',
      'Total comprehensive income for the year attributable to Council (10,632)',
    );
    const parsed = parseByronGpfsExtraction(
      extraction({ comprehensive: broken }),
      BYRON_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = BYRON_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 70,384',
      'Rates and annual charges B2-1 70,386',
    );
    const parsed = parseByronGpfsExtraction(extraction({ income: broken }), BYRON_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = BYRON_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 (58,766)',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 (58,768)',
    );
    const parsed = parseByronGpfsExtraction(
      extraction({ comprehensive: broken }),
      BYRON_CONTEXT,
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
    const url = BYRON_CONTEXT.document.url;
    const revenue = byronGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = byronGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^byron-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(byronGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(byronGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_byrongpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BYRON_GPFS_ID,
    name: BYRON_GPFS_NAME,
    publisher: BYRON_GPFS_PUBLISHER,
    source_url: BYRON_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BYRON_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'byron-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Byron Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BYRON_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-byron',
        project_name: 'Existing AusTender Byron contract',
        delivery_entity: 'BYRON SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-byron',
        project_name: 'Existing GrantConnect Byron grant',
        delivery_entity: 'Byron Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-byron-school',
        project_name: 'Existing data.nsw Byron school row (not a council row)',
        delivery_entity: 'Byron Bay High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-byron-charity',
        project_name: 'Existing ACNC Byron charity row (not the council)',
        delivery_entity: 'Byron Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: BYRON_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BYRON_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: BYRON_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BYRON_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BYRON_GPFS_ID,
        delivery_entity: { $ne: 'Byron Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BYRON_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
