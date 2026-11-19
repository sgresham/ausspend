import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  TENTERFIELD_GPFS_DELIVERY_ENTITY,
  TENTERFIELD_GPFS_DOCUMENT_PIN,
  TENTERFIELD_GPFS_FISCAL_YEAR,
  TENTERFIELD_GPFS_ID,
  TENTERFIELD_GPFS_LICENSE,
  TENTERFIELD_GPFS_NAME,
  TENTERFIELD_GPFS_PUBLISHER,
  TENTERFIELD_GPFS_REPORTING_URL,
  TENTERFIELD_GPFS_REQUEST_HEADERS,
  tenterfieldPinnedDocument,
  detectTenterfieldGpfsUnit,
  discoverTenterfieldGpfsDocument,
  fiscalYearFromTenterfieldGpfsLink,
  parseTenterfieldGpfsExtraction,
  parseTenterfieldGpfsReportLinks,
  selectTenterfieldGpfsDocument,
  tenterfieldGpfsNaturalKey,
} from '../src/connectors/tenterfield-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  TENTERFIELD_COMPREHENSIVE_TEXT,
  TENTERFIELD_CONTEXT,
  TENTERFIELD_FUNCTIONS_TEXT,
  TENTERFIELD_INCOME_TEXT,
  TENTERFIELD_PDF_SHA256,
  TENTERFIELD_PDF_URL,
  tenterfieldExtraction,
} from '../src/connectors/tenterfield-gpfs/fixture.js';

// Tenterfield Shire Council's audited FY2025-26 standalone financial statements.
// FY2025-26 is the current year for this source; the connector targets 2025-26
// only and never substitutes the prior 2024-25 or 2023-24 documents. The
// statement source is the standalone annual financial statements (not the
// narrative annual report). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2026 and Actual 2025 after
// it. A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2026. Tenterfield prints seven revenue lines
// and five expense lines (including a real net loss on disposal of 3,183). The
// net result is positive; the printed before-capital result is negative.

function parsedFixture() {
  return parseTenterfieldGpfsExtraction(tenterfieldExtraction(), TENTERFIELD_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Tenterfield Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/content/uploads/2026/11/Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf">Tenterfield Shire Council Financial Statements 2025 26</a>
    <a href="/content/uploads/2025/10/Tenterfield-Shire-Council-Financial-Statements-2024-252.pdf">Tenterfield Shire Council Financial Statements 2024 25</a>
    <a href="/content/uploads/2026/11/Annual_Financial_Statements_NotePN_Public_Notice_–_Presentation_of_Financial_Statements.pdf">Annual Financial Statements NotePN Public Notice – Presentation Of Financial Statements</a>
    <a href="/content/uploads/2026/06/QBR-March-2026.pdf">QBR March 2026</a>
    <a href="https://example.com/Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf">Tenterfield Shire Council Financial Statements 2025 26 mirror</a>
  `;

  it('discovers the FY2025-26 financial statements and never the prior year, notice or a mirror', () => {
    expect(TENTERFIELD_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseTenterfieldGpfsReportLinks(pageHtml, TENTERFIELD_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.map((link) => link.url)).toEqual([
      TENTERFIELD_PDF_URL,
      'https://www.tenterfield.nsw.gov.au/content/uploads/2025/10/Tenterfield-Shire-Council-Financial-Statements-2024-252.pdf',
    ]);
    const selected = selectTenterfieldGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(TENTERFIELD_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(TENTERFIELD_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromTenterfieldGpfsLink('Tenterfield Shire Council Financial Statements 2025 26'),
    ).toBe('2025-26');
    expect(
      fiscalYearFromTenterfieldGpfsLink('Tenterfield Shire Council Financial Statements 2024 25'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromTenterfieldGpfsLink(
        'Tenterfield Shire Council Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromTenterfieldGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/content/uploads/2025/10/Tenterfield-Shire-Council-Financial-Statements-2024-252.pdf">Tenterfield Shire Council Financial Statements 2024 25</a>
    `;
    const links = parseTenterfieldGpfsReportLinks(priorOnly, TENTERFIELD_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectTenterfieldGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/content/uploads/2027/11/Tenterfield-Shire-Council-Financial-Statements-2026-27.pdf">Tenterfield Shire Council Financial Statements 2026 27</a>
    `;
    const links = parseTenterfieldGpfsReportLinks(futureOnly, TENTERFIELD_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectTenterfieldGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no current anchor', async () => {
    const links = parseTenterfieldGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      TENTERFIELD_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = tenterfieldPinnedDocument();
    expect(pinned.url).toBe(TENTERFIELD_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf');
    const discovered = await discoverTenterfieldGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(TENTERFIELD_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(TENTERFIELD_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverTenterfieldGpfsDocument(
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
      discoverTenterfieldGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Tenterfield Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectTenterfieldGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectTenterfieldGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = TENTERFIELD_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseTenterfieldGpfsExtraction(
      extraction({ income: withoutUnit }),
      TENTERFIELD_CONTEXT,
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
    source: { sha256: TENTERFIELD_PDF_SHA256, bytes: 1_063_092 },
    pages: [
      pdfPage(overrides.income ?? TENTERFIELD_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? TENTERFIELD_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? TENTERFIELD_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Tenterfield Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(48_463);
    expect(reconciliation.total_expenses).toBe(40_721);
    expect(reconciliation.employee_expenses).toBe(8_522);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(9_470);
    expect(reconciliation.government_grants_operating).toBe(17_827);
    expect(reconciliation.government_grants_capital).toBe(8_484);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(3_183);
    expect(reconciliation.net_result).toBe(7_742);
    expect(reconciliation.net_result_before_capital_grants).toBe(-742);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(31_251);
    expect(reconciliation.face_expense_bridge).toBe(40_721);
    expect(reconciliation.functions_total_income).toBe(48_463);
    expect(reconciliation.functions_total_expenses).toBe(40_721);
    expect(reconciliation.functions_operating_result).toBe(7_742);
    expect(reconciliation.functions_grants_and_contributions).toBe(26_311);
    expect(reconciliation.comprehensive_income_net_result).toBe(7_742);
    expect(reconciliation.comprehensive_other_income).toBe(26_535);
    expect(reconciliation.comprehensive_total).toBe(34_277);
    expect(reconciliation.comprehensive_revaluation).toBe(26_535);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(48_463);
    expect(reconciliation.expense_components_sum).toBe(31_251);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(4_846_300_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(4_072_100_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(852_200_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      947_000_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_782_700_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(848_400_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      318_300_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(90_200_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_518_400_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(50_700_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(23_400_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(774_200_000);
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
        source_id: TENTERFIELD_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: TENTERFIELD_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Tenterfield Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: TENTERFIELD_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Tenterfield Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^tenterfield-gpfs:/);
      expect(record.source_url).toContain('Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf');
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
    const broken = TENTERFIELD_FUNCTIONS_TEXT.replace(
      'Total functions and activities 48,463 55,398 40,721 35,713',
      'Total functions and activities 48,463 55,398 40,723 35,713',
    );
    const parsed = parseTenterfieldGpfsExtraction(
      extraction({ functions: broken }),
      TENTERFIELD_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = TENTERFIELD_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 34,277',
      'Total comprehensive income for the year attributable to Council 34,279',
    );
    const parsed = parseTenterfieldGpfsExtraction(
      extraction({ comprehensive: broken }),
      TENTERFIELD_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = TENTERFIELD_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 15,184',
      'Rates and annual charges B2-1 15,186',
    );
    const parsed = parseTenterfieldGpfsExtraction(extraction({ income: broken }), TENTERFIELD_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = TENTERFIELD_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 26,535',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 26,537',
    );
    const parsed = parseTenterfieldGpfsExtraction(
      extraction({ comprehensive: broken }),
      TENTERFIELD_CONTEXT,
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
    const url = TENTERFIELD_CONTEXT.document.url;
    const revenue = tenterfieldGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = tenterfieldGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^tenterfield-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(tenterfieldGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(tenterfieldGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_tenterfieldgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: TENTERFIELD_GPFS_ID,
    name: TENTERFIELD_GPFS_NAME,
    publisher: TENTERFIELD_GPFS_PUBLISHER,
    source_url: TENTERFIELD_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: TENTERFIELD_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'tenterfield-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Tenterfield Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: TENTERFIELD_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-tenterfield',
        project_name: 'Existing AusTender Tenterfield contract',
        delivery_entity: 'TENTERFIELD SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-tenterfield',
        project_name: 'Existing GrantConnect Tenterfield grant',
        delivery_entity: 'Tenterfield Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-tenterfield-school',
        project_name: 'Existing data.nsw Tenterfield school row (not a council row)',
        delivery_entity: 'Tenterfield High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-tenterfield-charity',
        project_name: 'Existing ACNC Tenterfield charity row (not the council)',
        delivery_entity: 'Tenterfield Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: TENTERFIELD_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: TENTERFIELD_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: TENTERFIELD_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: TENTERFIELD_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: TENTERFIELD_GPFS_ID,
        delivery_entity: { $ne: 'Tenterfield Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: TENTERFIELD_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
