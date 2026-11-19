import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  LOCKHART_GPFS_DELIVERY_ENTITY,
  LOCKHART_GPFS_DOCUMENT_PIN,
  LOCKHART_GPFS_FISCAL_YEAR,
  LOCKHART_GPFS_ID,
  LOCKHART_GPFS_LICENSE,
  LOCKHART_GPFS_NAME,
  LOCKHART_GPFS_PUBLISHER,
  LOCKHART_GPFS_REPORTING_URL,
  lockhartPinnedDocument,
  detectLockhartGpfsUnit,
  discoverLockhartGpfsDocument,
  fiscalYearFromLockhartGpfsLink,
  parseLockhartGpfsExtraction,
  parseLockhartGpfsReportLinks,
  selectLockhartGpfsDocument,
  lockhartGpfsNaturalKey,
} from '../src/connectors/lockhart-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  LOCKHART_COMPREHENSIVE_TEXT,
  LOCKHART_CONTEXT,
  LOCKHART_FUNCTIONS_TEXT,
  LOCKHART_INCOME_TEXT,
  LOCKHART_PDF_SHA256,
  LOCKHART_PDF_URL,
  lockhartExtraction,
} from '../src/connectors/lockhart-gpfs/fixture.js';

// Lockhart Shire Council's audited FY2025-26 3-in-1 statements. The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2026 and Actual 2025 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2026.
// Lockhart prints eight non-zero revenue lines (including other income and a net
// gain on disposal) and four expense lines (including borrowing costs; its net
// loss on disposal line is nil for 2026). The net result is positive and the
// before-capital result is negative.

function parsedFixture() {
  return parseLockhartGpfsExtraction(lockhartExtraction(), LOCKHART_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Lockhart Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="https://lockhart.nsw.gov.au/wp-content/uploads/2026/11/Annual_Financial_Statements-2026-3-in-1.pdf" target="_blank">Annual Financial Statements for the year ended 30 June 2026</a>
    <a href="https://lockhart.nsw.gov.au/wp-content/uploads/2025/11/DCCS-Report-to-November-2025-Council-Presentation-of-FY25-Audited-Financial-Statements-Attachment-1-1.pdf">Audited Financial Statements to 30 June 2025</a>
    <a href="https://lockhart.nsw.gov.au/wp-content/uploads/2025/12/Adopted-Annual-Report-FY2025.pdf">Annual Report 2025</a>
    <a href="https://lockhart.nsw.gov.au/wp-content/uploads/2026/08/Adopted-Delivery-Plan-and-Operational-Plan-24-June-2026.pdf">Delivery Plan 2025-2029 and Operation Plan 2026-2027</a>
    <a href="https://example.com/Annual_Financial_Statements-2026-3-in-1.pdf">Annual Financial Statements 2026</a>
  `;

  it('discovers the FY2025-26 statements and never an annual report, plan or a prior year', () => {
    expect(LOCKHART_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseLockhartGpfsReportLinks(pageHtml, LOCKHART_GPFS_REPORTING_URL);
    // The real prior-year link is a "presentation" document and is intentionally
    // ignored; only the current statements anchor is usable.
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    const current = links.filter((link) => link.fiscal_year === '2025-26');
    expect(current.map((link) => link.url)).toEqual([LOCKHART_PDF_URL]);
    const selected = selectLockhartGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(LOCKHART_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(LOCKHART_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromLockhartGpfsLink('Annual Financial Statements for the year ended 30 June 2026'),
    ).toBe('2025-26');
    expect(fiscalYearFromLockhartGpfsLink('Annual_Financial_Statements-2026-3-in-1.pdf')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromLockhartGpfsLink('Audited Financial Statements to 30 June 2025')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromLockhartGpfsLink('Long Term Financial Plan 2027-36.pdf')).toBeNull();
  });

  it('rejects a stale year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="https://lockhart.nsw.gov.au/wp-content/uploads/2025/11/Annual_Financial_Statements-2025.pdf">Audited Financial Statements to 30 June 2025</a>
    `;
    const links = parseLockhartGpfsReportLinks(priorOnly, LOCKHART_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectLockhartGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseLockhartGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      LOCKHART_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = lockhartPinnedDocument();
    expect(pinned.url).toBe(LOCKHART_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('Annual_Financial_Statements-2026-3-in-1.pdf');
    const discovered = await discoverLockhartGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(LOCKHART_GPFS_DOCUMENT_PIN);
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverLockhartGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Lockhart Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectLockhartGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectLockhartGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = LOCKHART_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseLockhartGpfsExtraction(
      extraction({ income: withoutUnit }),
      LOCKHART_CONTEXT,
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
    source: { sha256: LOCKHART_PDF_SHA256, bytes: 3_258_064 },
    pages: [
      pdfPage(overrides.income ?? LOCKHART_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? LOCKHART_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? LOCKHART_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Lockhart Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(20_300);
    expect(reconciliation.total_expenses).toBe(19_175);
    expect(reconciliation.employee_expenses).toBe(4_551);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(7_079);
    expect(reconciliation.government_grants_operating).toBe(10_823);
    expect(reconciliation.government_grants_capital).toBe(2_698);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(6);
    expect(reconciliation.net_result).toBe(1_125);
    expect(reconciliation.net_result_before_capital_grants).toBe(-1_573);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(12_096);
    expect(reconciliation.face_expense_bridge).toBe(19_175);
    expect(reconciliation.functions_total_income).toBe(20_300);
    expect(reconciliation.functions_total_expenses).toBe(19_175);
    expect(reconciliation.functions_operating_result).toBe(1_125);
    expect(reconciliation.functions_grants_and_contributions).toBe(13_521);
    expect(reconciliation.comprehensive_income_net_result).toBe(1_125);
    expect(reconciliation.comprehensive_other_income).toBe(30_885);
    expect(reconciliation.comprehensive_total).toBe(32_010);
    expect(reconciliation.comprehensive_revaluation).toBe(30_885);
    expect(reconciliation.revenue_components_sum).toBe(20_300);
    expect(reconciliation.expense_components_sum).toBe(12_096);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(2_030_000_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(1_917_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(455_100_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      707_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_082_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(269_800_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(600_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(12_500_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(431_100_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(81_100_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(17_900_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(112_500_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: LOCKHART_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: LOCKHART_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Lockhart Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: LOCKHART_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Lockhart Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^lockhart-gpfs:/);
      expect(record.source_url).toContain('Annual_Financial_Statements-2026-3-in-1.pdf');
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
    const broken = LOCKHART_FUNCTIONS_TEXT.replace(
      'Total functions and activities 20,300 15,276 19,175 18,605',
      'Total functions and activities 20,300 15,276 19,177 18,605',
    );
    const parsed = parseLockhartGpfsExtraction(extraction({ functions: broken }), LOCKHART_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = LOCKHART_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 32,010',
      'Total comprehensive income for the year attributable to Council 32,012',
    );
    const parsed = parseLockhartGpfsExtraction(
      extraction({ comprehensive: broken }),
      LOCKHART_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = LOCKHART_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 4,311',
      'Rates and annual charges B2-1 4,313',
    );
    const parsed = parseLockhartGpfsExtraction(extraction({ income: broken }), LOCKHART_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = LOCKHART_COMPREHENSIVE_TEXT.replace(
      'Gain on revaluation of infrastructure, property, plant and equipment C1-6 30,885',
      'Gain on revaluation of infrastructure, property, plant and equipment C1-6 30,887',
    );
    const parsed = parseLockhartGpfsExtraction(
      extraction({ comprehensive: broken }),
      LOCKHART_CONTEXT,
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
    const url = LOCKHART_CONTEXT.document.url;
    const revenue = lockhartGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = lockhartGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^lockhart-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(lockhartGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(lockhartGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_lockhartgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: LOCKHART_GPFS_ID,
    name: LOCKHART_GPFS_NAME,
    publisher: LOCKHART_GPFS_PUBLISHER,
    source_url: LOCKHART_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LOCKHART_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'lockhart-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Lockhart Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: LOCKHART_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-lockhart',
        project_name: 'Existing AusTender Lockhart Shire contract',
        delivery_entity: 'LOCKHART SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-lockhart',
        project_name: 'Existing GrantConnect Lockhart Shire grant',
        delivery_entity: 'Lockhart Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-lockhart-school',
        project_name: 'Existing data.nsw Lockhart school row (not a council row)',
        delivery_entity: 'Lockhart Central School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-lockhart-charity',
        project_name: 'Existing ACNC Lockhart charity row (not the council)',
        delivery_entity: 'Lockhart Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: LOCKHART_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: LOCKHART_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: LOCKHART_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: LOCKHART_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: LOCKHART_GPFS_ID,
        delivery_entity: { $ne: 'Lockhart Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: LOCKHART_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
