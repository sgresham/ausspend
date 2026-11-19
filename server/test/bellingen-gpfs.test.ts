import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BELLINGEN_GPFS_DELIVERY_ENTITY,
  BELLINGEN_GPFS_DOCUMENT_PIN,
  BELLINGEN_GPFS_FISCAL_YEAR,
  BELLINGEN_GPFS_ID,
  BELLINGEN_GPFS_LICENSE,
  BELLINGEN_GPFS_NAME,
  BELLINGEN_GPFS_PUBLISHER,
  BELLINGEN_GPFS_REPORTING_URL,
  BELLINGEN_GPFS_REQUEST_HEADERS,
  bellingenPinnedDocument,
  detectBellingenGpfsUnit,
  discoverBellingenGpfsDocument,
  fiscalYearFromBellingenGpfsLink,
  parseBellingenGpfsExtraction,
  parseBellingenGpfsReportLinks,
  selectBellingenGpfsDocument,
  bellingenGpfsNaturalKey,
} from '../src/connectors/bellingen-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  BELLINGEN_COMPREHENSIVE_TEXT,
  BELLINGEN_CONTEXT,
  BELLINGEN_FUNCTIONS_TEXT,
  BELLINGEN_INCOME_TEXT,
  BELLINGEN_PDF_SHA256,
  BELLINGEN_PDF_URL,
  bellingenExtraction,
} from '../src/connectors/bellingen-gpfs/fixture.js';

// Bellingen Shire Council's audited FY2025-26 standalone General Purpose
// Financial Statements. FY2025-26 is the current audited year (the item title
// originally said FY2024-25, but the official page publishes both and FY2025-26
// is preferred). The connector targets 2025-26 only and never substitutes the
// prior 2024-25 or 2023-24 document. The Income Statement prints the Original
// unaudited budget column before the line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Bellingen prints seven
// revenue components (other revenues and other income are separate; there is no
// net gain on disposal line) and five expense components including a real net
// loss on disposal of 680. The net result and the before-capital result are both
// positive. Other comprehensive income has a single component (revaluation
// 91,270).

function parsedFixture() {
  return parseBellingenGpfsExtraction(bellingenExtraction(), BELLINGEN_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Bellingen Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/sharedassets/public/v/1/files/annual-reports/ar-2025-26/annual-financial-statements-2026.pdf">Annual Financial Statements 2025-26</a>
    <a href="/files/sharedassets/public/v/1/files/annual-reports/ar-2025-26/annual-report-2025-26.pdf">Annual Report 2025-26</a>
    <a href="/files/sharedassets/public/v/1/files/annual-reports/ar-2024-25/annual_financial_statements-2025.pdf">Annual Financial Statements 2024-25</a>
    <a href="/files/sharedassets/public/v/1/files/annual-reports/ar-2023-24/annual-financial-statements-2024.pdf">Annual Financial Statements 2023-24</a>
    <a href="https://example.com/annual-financial-statements-2026.pdf">Annual Financial Statements 2025-26 mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the annual report, prior year or a mirror', () => {
    expect(BELLINGEN_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseBellingenGpfsReportLinks(pageHtml, BELLINGEN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      BELLINGEN_PDF_URL,
      'https://www.bellingen.nsw.gov.au/files/sharedassets/public/v/1/files/annual-reports/ar-2024-25/annual_financial_statements-2025.pdf',
      'https://www.bellingen.nsw.gov.au/files/sharedassets/public/v/1/files/annual-reports/ar-2023-24/annual-financial-statements-2024.pdf',
    ]);
    const selected = selectBellingenGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(BELLINGEN_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(BELLINGEN_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Annual Financial Statements 2025-26');
    expect(fiscalYearFromBellingenGpfsLink('annual-financial-statements-2026.pdf')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromBellingenGpfsLink('annual_financial_statements-2025.pdf')).toBe(
      '2024-25',
    );
    expect(
      fiscalYearFromBellingenGpfsLink(
        'Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromBellingenGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/sharedassets/public/v/1/files/annual-reports/ar-2024-25/annual_financial_statements-2025.pdf">Annual Financial Statements 2024-25</a>
    `;
    const links = parseBellingenGpfsReportLinks(priorOnly, BELLINGEN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectBellingenGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/sharedassets/public/v/1/files/annual-reports/ar-2026-27/annual-financial-statements-2027.pdf">Annual Financial Statements 2026-27</a>
    `;
    const links = parseBellingenGpfsReportLinks(futureOnly, BELLINGEN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectBellingenGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseBellingenGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      BELLINGEN_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = bellingenPinnedDocument();
    expect(pinned.url).toBe(BELLINGEN_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('annual-financial-statements-2026.pdf');
    const discovered = await discoverBellingenGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(BELLINGEN_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverBellingenGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(BELLINGEN_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(BELLINGEN_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverBellingenGpfsDocument(
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
      discoverBellingenGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Bellingen Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBellingenGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBellingenGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = BELLINGEN_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseBellingenGpfsExtraction(
      extraction({ income: withoutUnit }),
      BELLINGEN_CONTEXT,
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
    source: { sha256: BELLINGEN_PDF_SHA256, bytes: 1_289_884 },
    pages: [
      pdfPage(overrides.income ?? BELLINGEN_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? BELLINGEN_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? BELLINGEN_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Bellingen Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(81_659);
    expect(reconciliation.total_expenses).toBe(53_849);
    expect(reconciliation.employee_expenses).toBe(15_423);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(10_456);
    expect(reconciliation.government_grants_operating).toBe(10_223);
    expect(reconciliation.government_grants_capital).toBe(26_911);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(680);
    expect(reconciliation.net_result).toBe(27_810);
    expect(reconciliation.net_result_before_capital_grants).toBe(899);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(43_393);
    expect(reconciliation.face_expense_bridge).toBe(53_849);
    expect(reconciliation.functions_total_income).toBe(81_659);
    expect(reconciliation.functions_total_expenses).toBe(53_849);
    expect(reconciliation.functions_operating_result).toBe(27_810);
    expect(reconciliation.functions_grants_and_contributions).toBe(37_134);
    expect(reconciliation.comprehensive_income_net_result).toBe(27_810);
    expect(reconciliation.comprehensive_other_income).toBe(91_270);
    expect(reconciliation.comprehensive_total).toBe(119_080);
    expect(reconciliation.comprehensive_revaluation).toBe(91_270);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(81_659);
    expect(reconciliation.expense_components_sum).toBe(43_393);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(8_165_900_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(5_384_900_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_542_300_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_045_600_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_022_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(2_691_100_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      68_000_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(113_600_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(2_127_900_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(88_100_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(13_500_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      207_200_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(163_300_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(2_452_100_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(2_015_800_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(2_781_000_000);
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
        source_id: BELLINGEN_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: BELLINGEN_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Bellingen Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: BELLINGEN_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Bellingen Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^bellingen-gpfs:/);
      expect(record.source_url).toContain('annual-financial-statements-2026.pdf');
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
    const broken = BELLINGEN_FUNCTIONS_TEXT.replace(
      'Total functions and activities 81,659 76,284 53,849 44,589',
      'Total functions and activities 81,659 76,284 53,851 44,589',
    );
    const parsed = parseBellingenGpfsExtraction(
      extraction({ functions: broken }),
      BELLINGEN_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = BELLINGEN_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 119,080',
      'Total comprehensive income for the year attributable to Council 119,082',
    );
    const parsed = parseBellingenGpfsExtraction(
      extraction({ comprehensive: broken }),
      BELLINGEN_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = BELLINGEN_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 21,279',
      'Rates and annual charges B2-1 21,281',
    );
    const parsed = parseBellingenGpfsExtraction(extraction({ income: broken }), BELLINGEN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = BELLINGEN_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 680',
      'Net loss from the disposal of assets B4-1 682',
    );
    const parsed = parseBellingenGpfsExtraction(extraction({ income: broken }), BELLINGEN_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = BELLINGEN_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 91,270',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 91,272',
    );
    const parsed = parseBellingenGpfsExtraction(
      extraction({ comprehensive: broken }),
      BELLINGEN_CONTEXT,
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
    const url = BELLINGEN_CONTEXT.document.url;
    const revenue = bellingenGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = bellingenGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^bellingen-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(bellingenGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(bellingenGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_bellingengpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BELLINGEN_GPFS_ID,
    name: BELLINGEN_GPFS_NAME,
    publisher: BELLINGEN_GPFS_PUBLISHER,
    source_url: BELLINGEN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BELLINGEN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'bellingen-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Bellingen Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BELLINGEN_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-bellingen',
        project_name: 'Existing AusTender Bellingen contract',
        delivery_entity: 'BELLINGEN SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-bellingen',
        project_name: 'Existing GrantConnect Bellingen grant',
        delivery_entity: 'Bellingen Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-bellingen-school',
        project_name: 'Existing data.nsw Bellingen school row (not a council row)',
        delivery_entity: 'Bellingen High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-bellingen-charity',
        project_name: 'Existing ACNC Bellingen charity row (not the council)',
        delivery_entity: 'Bellingen Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'forbes-gpfs',
        source_url: 'https://www.forbes.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-forbes-gpfs-1',
        project_name: 'Existing Forbes GPFS row',
        delivery_entity: 'Forbes Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'forbes-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: BELLINGEN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BELLINGEN_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: BELLINGEN_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BELLINGEN_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BELLINGEN_GPFS_ID,
        delivery_entity: { $ne: 'Bellingen Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BELLINGEN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
