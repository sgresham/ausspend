import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  GILGANDRA_GPFS_DELIVERY_ENTITY,
  GILGANDRA_GPFS_DOCUMENT_PIN,
  GILGANDRA_GPFS_FISCAL_YEAR,
  GILGANDRA_GPFS_ID,
  GILGANDRA_GPFS_LICENSE,
  GILGANDRA_GPFS_NAME,
  GILGANDRA_GPFS_PUBLISHER,
  GILGANDRA_GPFS_REPORTING_URL,
  GILGANDRA_GPFS_REQUEST_HEADERS,
  gilgandraPinnedDocument,
  detectGilgandraGpfsUnit,
  discoverGilgandraGpfsDocument,
  fiscalYearFromGilgandraGpfsLink,
  parseGilgandraGpfsExtraction,
  parseGilgandraGpfsReportLinks,
  selectGilgandraGpfsDocument,
  gilgandraGpfsNaturalKey,
} from '../src/connectors/gilgandra-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  GILGANDRA_COMPREHENSIVE_TEXT,
  GILGANDRA_CONTEXT,
  GILGANDRA_FUNCTIONS_TEXT,
  GILGANDRA_INCOME_TEXT,
  GILGANDRA_PDF_SHA256,
  GILGANDRA_PDF_URL,
  gilgandraExtraction,
} from '../src/connectors/gilgandra-gpfs/fixture.js';

// Gilgandra Shire Council's audited FY2025-26 GPFS. The Income Statement prints
// the Original unaudited budget column before the line label, with Actual 2026
// and Actual 2025 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2026. Gilgandra
// prints seven non-zero revenue lines (no other-income line, plus a net gain on
// disposal) and four expense lines (including borrowing costs; no net loss on
// disposal). The net result and the before-capital result are both positive.

function parsedFixture() {
  return parseGilgandraGpfsExtraction(gilgandraExtraction(), GILGANDRA_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Gilgandra Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a title="Annual_Financial_Statements-2026.pdf" href="/files/assets/public/v/1/economic-development/inland-rail/submissions/annual_financial_statements-2026.pdf" class="document ext-pdf">Annual Financial Statements 2026</a>
    <a title="Annual_Financial_Statements-2025.pdf" href="/files/assets/public/v/1/your-council/plans-and-strategies/annual_financial_statements-2025.pdf" class="document ext-pdf">Annual Financial Statements 2025</a>
    <a title="final-annual-report-2024_25.pdf" href="/files/assets/public/v/1/your-council/plans-and-strategies/final-annual-report-2024_25.pdf" class="document ext-pdf">Annual Report 2024-25</a>
    <a title="Budget-2026.pdf" href="/files/assets/public/v/1/your-council/plans-and-strategies/budget-2026.pdf" class="document ext-pdf">Budget 2026</a>
    <a href="https://example.com/annual_financial_statements-2026.pdf">Annual Financial Statements 2026</a>
  `;

  it('discovers the FY2025-26 statements and never an annual report, budget or a prior year', () => {
    expect(GILGANDRA_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseGilgandraGpfsReportLinks(pageHtml, GILGANDRA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year).sort()).toEqual(['2024-25', '2025-26']);
    const current = links.filter((link) => link.fiscal_year === '2025-26');
    expect(current.map((link) => link.url)).toEqual([GILGANDRA_PDF_URL]);
    const selected = selectGilgandraGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(GILGANDRA_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(GILGANDRA_GPFS_REPORTING_URL);
    expect(fiscalYearFromGilgandraGpfsLink('Annual_Financial_Statements-2026.pdf')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromGilgandraGpfsLink('Annual_Financial_Statements-2025.pdf')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromGilgandraGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a title="Annual_Financial_Statements-2025.pdf" href="/files/assets/public/v/1/your-council/plans-and-strategies/annual_financial_statements-2025.pdf">Annual Financial Statements 2025</a>
    `;
    const links = parseGilgandraGpfsReportLinks(priorOnly, GILGANDRA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectGilgandraGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseGilgandraGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      GILGANDRA_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = gilgandraPinnedDocument();
    expect(pinned.url).toBe(GILGANDRA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('annual_financial_statements-2026.pdf');
    const discovered = await discoverGilgandraGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(GILGANDRA_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA so the Akamai WAF does not return 403', async () => {
    expect(GILGANDRA_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverGilgandraGpfsDocument(
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
      discoverGilgandraGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Gilgandra Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectGilgandraGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectGilgandraGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = GILGANDRA_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseGilgandraGpfsExtraction(
      extraction({ income: withoutUnit }),
      GILGANDRA_CONTEXT,
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
    source: { sha256: GILGANDRA_PDF_SHA256, bytes: 1_365_525 },
    pages: [
      pdfPage(overrides.income ?? GILGANDRA_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? GILGANDRA_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? GILGANDRA_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Gilgandra Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(16);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(52_061);
    expect(reconciliation.total_expenses).toBe(47_569);
    expect(reconciliation.employee_expenses).toBe(23_744);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(10_275);
    expect(reconciliation.government_grants_operating).toBe(13_408);
    expect(reconciliation.government_grants_capital).toBe(4_067);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(187);
    expect(reconciliation.net_result).toBe(4_492);
    expect(reconciliation.net_result_before_capital_grants).toBe(425);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(37_294);
    expect(reconciliation.face_expense_bridge).toBe(47_569);
    expect(reconciliation.functions_total_income).toBe(52_061);
    expect(reconciliation.functions_total_expenses).toBe(47_569);
    expect(reconciliation.functions_operating_result).toBe(4_492);
    expect(reconciliation.functions_grants_and_contributions).toBe(17_475);
    expect(reconciliation.comprehensive_income_net_result).toBe(4_492);
    expect(reconciliation.comprehensive_other_income).toBe(5_955);
    expect(reconciliation.comprehensive_total).toBe(10_447);
    expect(reconciliation.comprehensive_revaluation).toBe(5_955);
    expect(reconciliation.comprehensive_items_not_reclassified).toBe(5_955);
    expect(reconciliation.revenue_components_sum).toBe(52_061);
    expect(reconciliation.expense_components_sum).toBe(37_294);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(5_206_100_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(4_756_900_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(2_374_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_027_500_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_340_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(406_700_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(18_700_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(18_200_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(793_100_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(107_200_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(449_200_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(records.some((record) => record.gpfs_line_item === 'other_income')).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: GILGANDRA_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: GILGANDRA_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Gilgandra Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: GILGANDRA_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Gilgandra Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^gilgandra-gpfs:/);
      expect(record.source_url).toContain('annual_financial_statements-2026.pdf');
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
    const broken = GILGANDRA_FUNCTIONS_TEXT.replace(
      'Total functions and activities 52,061 43,836 47,569 41,904',
      'Total functions and activities 52,061 43,836 47,571 41,904',
    );
    const parsed = parseGilgandraGpfsExtraction(
      extraction({ functions: broken }),
      GILGANDRA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = GILGANDRA_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 10,447',
      'Total comprehensive income for the year attributable to Council 10,449',
    );
    const parsed = parseGilgandraGpfsExtraction(
      extraction({ comprehensive: broken }),
      GILGANDRA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = GILGANDRA_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 7,931',
      'Rates and annual charges B2-1 7,933',
    );
    const parsed = parseGilgandraGpfsExtraction(extraction({ income: broken }), GILGANDRA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the other-comprehensive-income component is altered', () => {
    const broken = GILGANDRA_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 5,955',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 5,957',
    );
    const parsed = parseGilgandraGpfsExtraction(
      extraction({ comprehensive: broken }),
      GILGANDRA_CONTEXT,
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
    const url = GILGANDRA_CONTEXT.document.url;
    const revenue = gilgandraGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = gilgandraGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^gilgandra-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(gilgandraGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(gilgandraGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_gilgandragpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: GILGANDRA_GPFS_ID,
    name: GILGANDRA_GPFS_NAME,
    publisher: GILGANDRA_GPFS_PUBLISHER,
    source_url: GILGANDRA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: GILGANDRA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'gilgandra-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Gilgandra Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: GILGANDRA_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-gilgandra',
        project_name: 'Existing AusTender Gilgandra Shire contract',
        delivery_entity: 'GILGANDRA SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-gilgandra',
        project_name: 'Existing GrantConnect Gilgandra Shire grant',
        delivery_entity: 'Gilgandra Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-gilgandra-school',
        project_name: 'Existing data.nsw Gilgandra school row (not a council row)',
        delivery_entity: 'Gilgandra High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-gilgandra-charity',
        project_name: 'Existing ACNC Gilgandra charity row (not the council)',
        delivery_entity: 'Gilgandra Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
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
    expect(await MeasureModel.countDocuments({ source_id: GILGANDRA_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: GILGANDRA_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: GILGANDRA_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GILGANDRA_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GILGANDRA_GPFS_ID,
        delivery_entity: { $ne: 'Gilgandra Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: GILGANDRA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(16);
  });
});
