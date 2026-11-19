import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  RICHMOND_VALLEY_GPFS_DELIVERY_ENTITY,
  RICHMOND_VALLEY_GPFS_DOCUMENT_PIN,
  RICHMOND_VALLEY_GPFS_FISCAL_YEAR,
  RICHMOND_VALLEY_GPFS_ID,
  RICHMOND_VALLEY_GPFS_LICENSE,
  RICHMOND_VALLEY_GPFS_NAME,
  RICHMOND_VALLEY_GPFS_PUBLISHER,
  RICHMOND_VALLEY_GPFS_REPORTING_URL,
  RICHMOND_VALLEY_GPFS_REQUEST_HEADERS,
  richmondValleyPinnedDocument,
  detectRichmondValleyGpfsUnit,
  discoverRichmondValleyGpfsDocument,
  fiscalYearFromRichmondValleyGpfsLink,
  parseRichmondValleyGpfsExtraction,
  parseRichmondValleyGpfsReportLinks,
  selectRichmondValleyGpfsDocument,
  richmondValleyGpfsNaturalKey,
} from '../src/connectors/richmond-valley-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  RICHMOND_VALLEY_COMPREHENSIVE_TEXT,
  RICHMOND_VALLEY_CONTEXT,
  RICHMOND_VALLEY_FUNCTIONS_TEXT,
  RICHMOND_VALLEY_INCOME_TEXT,
  RICHMOND_VALLEY_PDF_SHA256,
  RICHMOND_VALLEY_PDF_URL,
  richmondValleyExtraction,
} from '../src/connectors/richmond-valley-gpfs/fixture.js';

// Richmond Valley Council's audited FY2025-26 standalone financial statements.
// FY2025-26 is the latest audited year published by the council at 2026-11-19;
// no FY2026-27 GPFS is posted, so FY2025-26 is the accepted current-available
// year and the connector never substitutes a 2026-27 or 2023-24 document. The
// statement source is the standalone audited financial statements (not the
// narrative annual report). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2026 and Actual 2025 after
// it. A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2026. Richmond Valley prints seven revenue lines and
// five expense lines (including a real net loss on disposal of 5,424). The net
// result and the before-capital result are both positive.

function parsedFixture() {
  return parseRichmondValleyGpfsExtraction(richmondValleyExtraction(), RICHMOND_VALLEY_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Richmond Valley Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/wp-content/uploads/2026/10/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf" title="2025/2026 Financial Statements" class="document ext-pdf">2025/2026 Financial Statements (PDF, 3MB)</a>
    <a href="/wp-content/uploads/2026/11/Richmond-Valley-Council-Annual-Report-2025-2026.pdf" title="2025-2026 Richmond Valley Council Annual Report" class="document ext-pdf">2025-2026 Richmond Valley Council Annual Report (PDF, 12MB)</a>
    <a href="/wp-content/uploads/2026/04/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2025.pdf" title="2024/2025 Financial Statements" class="document ext-pdf">2024/2025 Financial Statements (PDF, 3MB)</a>
    <a href="https://example.com/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf">2025/2026 Financial Statements</a>
  `;

  it('discovers the FY2025-26 financial statements and never the annual report or a mirror', () => {
    expect(RICHMOND_VALLEY_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseRichmondValleyGpfsReportLinks(pageHtml, RICHMOND_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.map((link) => link.url)).toEqual([
      RICHMOND_VALLEY_PDF_URL,
      'https://richmondvalley.nsw.gov.au/wp-content/uploads/2026/04/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2025.pdf',
    ]);
    const selected = selectRichmondValleyGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(RICHMOND_VALLEY_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(RICHMOND_VALLEY_GPFS_REPORTING_URL);
    expect(fiscalYearFromRichmondValleyGpfsLink('2025/2026 Financial Statements')).toBe('2025-26');
    expect(
      fiscalYearFromRichmondValleyGpfsLink(
        'https://richmondvalley.nsw.gov.au/wp-content/uploads/2026/10/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromRichmondValleyGpfsLink(
        'https://richmondvalley.nsw.gov.au/wp-content/uploads/2026/04/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2025.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromRichmondValleyGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/wp-content/uploads/2026/04/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2025.pdf" title="2024/2025 Financial Statements">2024/2025 Financial Statements</a>
    `;
    const links = parseRichmondValleyGpfsReportLinks(priorOnly, RICHMOND_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectRichmondValleyGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/wp-content/uploads/2027/10/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2027.pdf" title="2026/2027 Financial Statements">2026/2027 Financial Statements</a>
    `;
    const links = parseRichmondValleyGpfsReportLinks(futureOnly, RICHMOND_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectRichmondValleyGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no current anchor', async () => {
    const links = parseRichmondValleyGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      RICHMOND_VALLEY_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = richmondValleyPinnedDocument();
    expect(pinned.url).toBe(RICHMOND_VALLEY_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain(
      'Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf',
    );
    const discovered = await discoverRichmondValleyGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(RICHMOND_VALLEY_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(RICHMOND_VALLEY_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverRichmondValleyGpfsDocument(
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
      discoverRichmondValleyGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Richmond Valley Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectRichmondValleyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectRichmondValleyGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = RICHMOND_VALLEY_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseRichmondValleyGpfsExtraction(
      extraction({ income: withoutUnit }),
      RICHMOND_VALLEY_CONTEXT,
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
    source: { sha256: RICHMOND_VALLEY_PDF_SHA256, bytes: 1_063_092 },
    pages: [
      pdfPage(overrides.income ?? RICHMOND_VALLEY_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? RICHMOND_VALLEY_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? RICHMOND_VALLEY_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Richmond Valley Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(121_138);
    expect(reconciliation.total_expenses).toBe(95_446);
    expect(reconciliation.employee_expenses).toBe(27_939);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(26_519);
    expect(reconciliation.government_grants_operating).toBe(22_039);
    expect(reconciliation.government_grants_capital).toBe(36_171);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(6_393);
    expect(reconciliation.net_result).toBe(25_692);
    expect(reconciliation.net_result_before_capital_grants).toBe(-10_479);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(68_927);
    expect(reconciliation.face_expense_bridge).toBe(95_446);
    expect(reconciliation.functions_total_income).toBe(121_138);
    expect(reconciliation.functions_total_expenses).toBe(95_446);
    expect(reconciliation.functions_operating_result).toBe(25_692);
    expect(reconciliation.functions_grants_and_contributions).toBe(58_210);
    expect(reconciliation.comprehensive_income_net_result).toBe(25_692);
    expect(reconciliation.comprehensive_other_income).toBe(20_195);
    expect(reconciliation.comprehensive_total).toBe(45_887);
    expect(reconciliation.comprehensive_revaluation).toBe(14_492);
    expect(reconciliation.comprehensive_impairment).toBe(5_703);
    expect(reconciliation.revenue_components_sum).toBe(121_138);
    expect(reconciliation.expense_components_sum).toBe(68_927);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(12_113_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(9_544_600_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(2_793_900_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_651_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_203_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(3_617_100_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      639_300_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(64_000_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(3_534_800_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(9_800_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(316_500_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(2_569_200_000);
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
        source_id: RICHMOND_VALLEY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: RICHMOND_VALLEY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Richmond Valley Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: RICHMOND_VALLEY_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Richmond Valley Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^richmond-valley-gpfs:/);
      expect(record.source_url).toContain('Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf');
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
    const broken = RICHMOND_VALLEY_FUNCTIONS_TEXT.replace(
      'Total functions and activities 121,138 104,039 95,446 87,928',
      'Total functions and activities 121,138 104,039 95,448 87,928',
    );
    const parsed = parseRichmondValleyGpfsExtraction(
      extraction({ functions: broken }),
      RICHMOND_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = RICHMOND_VALLEY_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 45,887',
      'Total comprehensive income for the year attributable to Council 45,889',
    );
    const parsed = parseRichmondValleyGpfsExtraction(
      extraction({ comprehensive: broken }),
      RICHMOND_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = RICHMOND_VALLEY_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 35,348',
      'Rates and annual charges B2-1 35,350',
    );
    const parsed = parseRichmondValleyGpfsExtraction(extraction({ income: broken }), RICHMOND_VALLEY_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = RICHMOND_VALLEY_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 14,492',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 14,494',
    );
    const parsed = parseRichmondValleyGpfsExtraction(
      extraction({ comprehensive: broken }),
      RICHMOND_VALLEY_CONTEXT,
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
    const url = RICHMOND_VALLEY_CONTEXT.document.url;
    const revenue = richmondValleyGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = richmondValleyGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^richmond-valley-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(richmondValleyGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(richmondValleyGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_richmond-valleygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: RICHMOND_VALLEY_GPFS_ID,
    name: RICHMOND_VALLEY_GPFS_NAME,
    publisher: RICHMOND_VALLEY_GPFS_PUBLISHER,
    source_url: RICHMOND_VALLEY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: RICHMOND_VALLEY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'richmond-valley-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Richmond Valley Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: RICHMOND_VALLEY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-richmond-valley',
        project_name: 'Existing AusTender Richmond Valley contract',
        delivery_entity: 'RICHMOND VALLEY COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-richmond-valley',
        project_name: 'Existing GrantConnect Richmond Valley grant',
        delivery_entity: 'Richmond Valley Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-richmond-valley-school',
        project_name: 'Existing data.nsw Richmond Valley school row (not a council row)',
        delivery_entity: 'Richmond Valley High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-richmond-valley-charity',
        project_name: 'Existing ACNC Richmond Valley charity row (not the council)',
        delivery_entity: 'Richmond Valley Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: RICHMOND_VALLEY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: RICHMOND_VALLEY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: RICHMOND_VALLEY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: RICHMOND_VALLEY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: RICHMOND_VALLEY_GPFS_ID,
        delivery_entity: { $ne: 'Richmond Valley Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: RICHMOND_VALLEY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
