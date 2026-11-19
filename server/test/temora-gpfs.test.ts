import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  TEMORA_GPFS_DELIVERY_ENTITY,
  TEMORA_GPFS_DOCUMENT_PIN,
  TEMORA_GPFS_FISCAL_YEAR,
  TEMORA_GPFS_ID,
  TEMORA_GPFS_LICENSE,
  TEMORA_GPFS_NAME,
  TEMORA_GPFS_PUBLISHER,
  TEMORA_GPFS_REPORTING_URL,
  TEMORA_GPFS_REQUEST_HEADERS,
  temoraPinnedDocument,
  detectTemoraGpfsUnit,
  discoverTemoraGpfsDocument,
  fiscalYearFromTemoraGpfsLink,
  parseTemoraGpfsExtraction,
  parseTemoraGpfsReportLinks,
  selectTemoraGpfsDocument,
  temoraGpfsNaturalKey,
} from '../src/connectors/temora-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  TEMORA_COMPREHENSIVE_TEXT,
  TEMORA_CONTEXT,
  TEMORA_FUNCTIONS_TEXT,
  TEMORA_INCOME_TEXT,
  TEMORA_PDF_SHA256,
  TEMORA_PDF_URL,
  temoraExtraction,
} from '../src/connectors/temora-gpfs/fixture.js';

// Temora Shire Council's audited FY2024-25 standalone General Purpose Financial
// Statements. FY2024-25 is the latest obtainable audited year: no FY2025-26
// audited standalone statements are published as at 2026-11-19 (the 2025-26/
// 2026-27 documents listed are quarterly reviews and planning documents). The
// connector targets 2024-25 only and never substitutes 2025-26/2023-24. The
// Income Statement prints the Original unaudited budget column before the line
// label, with Actual 2025 and Actual 2024 after it. A parser that took the first
// number in the line would read the budget; the expected values are all Actual
// 2025. Temora prints seven revenue components (2025 net gain on disposal nil)
// and five expense components including a real net loss on disposal of 52. The
// net result is positive while the before-capital result is negative. Other
// comprehensive income has three components (revaluation 39,459, impairment/
// revaluation reversal 1,960 and joint ventures/associates 44) summing to the
// printed 41,463.

function parsedFixture() {
  return parseTemoraGpfsExtraction(temoraExtraction(), TEMORA_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Temora Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/on-exhibition/2025/financial-statements/temora-shire-council-financial-statements-2024-25.pdf">Temora Shire Council Financial Statements 2024-25</a>
    <a href="/files/assets/public/v/1/council-business/annual-reports/financial-statements/annual-financial-statements-2023-2024.pdf">Annual Financial Statements 2023-2024</a>
    <a href="/files/assets/public/v/1/council-business/annual-reports/temora-shire-council-final-annual-report-v1.3.pdf">Temora Shire Council final annual report</a>
    <a href="https://example.com/temora-shire-council-financial-statements-2024-25.pdf">Temora financial statements mirror</a>
  `;

  it('discovers the FY2024-25 standalone statements and never the annual report, prior year or a mirror', () => {
    expect(TEMORA_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseTemoraGpfsReportLinks(pageHtml, TEMORA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      TEMORA_PDF_URL,
      'https://www.temora.nsw.gov.au/files/assets/public/v/1/council-business/annual-reports/financial-statements/annual-financial-statements-2023-2024.pdf',
    ]);
    const selected = selectTemoraGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(TEMORA_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(TEMORA_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Temora Shire Council Financial Statements 2024-25');
    expect(
      fiscalYearFromTemoraGpfsLink('temora-shire-council-financial-statements-2024-25.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromTemoraGpfsLink('annual-financial-statements-2023-2024.pdf'),
    ).toBe('2023-24');
    expect(
      fiscalYearFromTemoraGpfsLink(
        'Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromTemoraGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/council-business/annual-reports/financial-statements/annual-financial-statements-2023-2024.pdf">Annual Financial Statements 2023-2024</a>
    `;
    const links = parseTemoraGpfsReportLinks(priorOnly, TEMORA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectTemoraGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/on-exhibition/2026/financial-statements/financial-statements-2025-26.pdf">Financial Statements 2025-26</a>
    `;
    const links = parseTemoraGpfsReportLinks(futureOnly, TEMORA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectTemoraGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseTemoraGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      TEMORA_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = temoraPinnedDocument();
    expect(pinned.url).toBe(TEMORA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('temora-shire-council-financial-statements-2024-25.pdf');
    const discovered = await discoverTemoraGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(TEMORA_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverTemoraGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(TEMORA_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(TEMORA_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverTemoraGpfsDocument(
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
      discoverTemoraGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Temora Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectTemoraGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectTemoraGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = TEMORA_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseTemoraGpfsExtraction(
      extraction({ income: withoutUnit }),
      TEMORA_CONTEXT,
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
    source: { sha256: TEMORA_PDF_SHA256, bytes: 2_464_389 },
    pages: [
      pdfPage(overrides.income ?? TEMORA_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? TEMORA_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? TEMORA_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Temora Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(40_708);
    expect(reconciliation.total_expenses).toBe(33_854);
    expect(reconciliation.employee_expenses).toBe(10_444);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(8_628);
    expect(reconciliation.government_grants_operating).toBe(6_813);
    expect(reconciliation.government_grants_capital).toBe(10_403);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(52);
    expect(reconciliation.net_result).toBe(6_854);
    expect(reconciliation.net_result_before_capital_grants).toBe(-3_549);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(25_226);
    expect(reconciliation.face_expense_bridge).toBe(33_854);
    expect(reconciliation.functions_total_income).toBe(40_708);
    expect(reconciliation.functions_total_expenses).toBe(33_854);
    expect(reconciliation.functions_operating_result).toBe(6_854);
    expect(reconciliation.functions_grants_and_contributions).toBe(17_216);
    expect(reconciliation.comprehensive_income_net_result).toBe(6_854);
    expect(reconciliation.comprehensive_other_income).toBe(41_463);
    expect(reconciliation.comprehensive_total).toBe(48_317);
    expect(reconciliation.comprehensive_revaluation).toBe(39_459);
    expect(reconciliation.comprehensive_impairment).toBe(1_960);
    expect(reconciliation.comprehensive_other_movements).toBe(44);
    expect(reconciliation.revenue_components_sum).toBe(40_708);
    expect(reconciliation.expense_components_sum).toBe(25_226);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(4_070_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_385_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_044_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      862_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(681_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_040_300_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      5_200_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(5_600_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(706_400_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(75_900_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(34_400_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      116_300_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(75_200_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(1_392_200_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(1_416_200_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(685_400_000);
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
        source_id: TEMORA_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: TEMORA_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Temora Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: TEMORA_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Temora Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^temora-gpfs:/);
      expect(record.source_url).toContain('temora-shire-council-financial-statements-2024-25.pdf');
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
    const broken = TEMORA_FUNCTIONS_TEXT.replace(
      'Total functions and activities 40,708 43,094 33,854 35,959',
      'Total functions and activities 40,708 43,094 33,856 35,959',
    );
    const parsed = parseTemoraGpfsExtraction(
      extraction({ functions: broken }),
      TEMORA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = TEMORA_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 48,317',
      'Total comprehensive income for the year attributable to Council 48,319',
    );
    const parsed = parseTemoraGpfsExtraction(
      extraction({ comprehensive: broken }),
      TEMORA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = TEMORA_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 7,064',
      'Rates and annual charges B2-1 7,066',
    );
    const parsed = parseTemoraGpfsExtraction(extraction({ income: broken }), TEMORA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = TEMORA_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 52',
      'Net loss from the disposal of assets B4-1 54',
    );
    const parsed = parseTemoraGpfsExtraction(extraction({ income: broken }), TEMORA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the joint-venture OCI component is altered', () => {
    const broken = TEMORA_COMPREHENSIVE_TEXT.replace(
      'Other comprehensive income – joint ventures and associates D2-1 44',
      'Other comprehensive income – joint ventures and associates D2-1 46',
    );
    const parsed = parseTemoraGpfsExtraction(
      extraction({ comprehensive: broken }),
      TEMORA_CONTEXT,
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
    const url = TEMORA_CONTEXT.document.url;
    const revenue = temoraGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = temoraGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^temora-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(temoraGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(temoraGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_temoragpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: TEMORA_GPFS_ID,
    name: TEMORA_GPFS_NAME,
    publisher: TEMORA_GPFS_PUBLISHER,
    source_url: TEMORA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: TEMORA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'temora-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Temora Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: TEMORA_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-temora',
        project_name: 'Existing AusTender Temora contract',
        delivery_entity: 'TEMORA SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-temora',
        project_name: 'Existing GrantConnect Temora grant',
        delivery_entity: 'Temora Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-temora-school',
        project_name: 'Existing data.nsw Temora school row (not a council row)',
        delivery_entity: 'Temora High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-temora-charity',
        project_name: 'Existing ACNC Temora charity row (not the council)',
        delivery_entity: 'Temora Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: TEMORA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: TEMORA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: TEMORA_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: TEMORA_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: TEMORA_GPFS_ID,
        delivery_entity: { $ne: 'Temora Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: TEMORA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
