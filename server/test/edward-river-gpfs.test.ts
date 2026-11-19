import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  EDWARD_RIVER_GPFS_DELIVERY_ENTITY,
  EDWARD_RIVER_GPFS_DOCUMENT_PIN,
  EDWARD_RIVER_GPFS_FISCAL_YEAR,
  EDWARD_RIVER_GPFS_ID,
  EDWARD_RIVER_GPFS_LICENSE,
  EDWARD_RIVER_GPFS_NAME,
  EDWARD_RIVER_GPFS_PUBLISHER,
  EDWARD_RIVER_GPFS_REPORTING_URL,
  EDWARD_RIVER_GPFS_REQUEST_HEADERS,
  edwardRiverPinnedDocument,
  detectEdwardRiverGpfsUnit,
  discoverEdwardRiverGpfsDocument,
  fiscalYearFromEdwardRiverGpfsLink,
  parseEdwardRiverGpfsExtraction,
  parseEdwardRiverGpfsReportLinks,
  selectEdwardRiverGpfsDocument,
  edwardRiverGpfsNaturalKey,
} from '../src/connectors/edward-river-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  EDWARD_RIVER_COMPREHENSIVE_TEXT,
  EDWARD_RIVER_CONTEXT,
  EDWARD_RIVER_FUNCTIONS_TEXT,
  EDWARD_RIVER_INCOME_TEXT,
  EDWARD_RIVER_PDF_SHA256,
  EDWARD_RIVER_PDF_URL,
  edwardRiverExtraction,
} from '../src/connectors/edward-river-gpfs/fixture.js';

// Edward River Council's audited FY2024-25 General Purpose Financial Statements,
// embedded in the official combined annual report + financial statements PDF
// (no standalone FS is published). FY2024-25 is the latest obtainable audited
// year: no FY2025-26 audited statements are published as at 2026-11-19. The
// connector targets 2024-25 only and never substitutes 2025-26/2023-24, the
// narrative-only annual report, the SPFS or the special schedules. The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2025 and Actual 2024 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2025.
// Edward River prints seven revenue components (including a real net gain on
// disposal of 171) and three expense components (no borrowing-cost line and no
// 2025 net loss). The net result is positive while the before-capital result is
// negative. Other comprehensive income has a single non-nil component
// (revaluation 14,777); the council prints no OCI subtotal, so the OCI total is
// the sum of the printed components and is reconciled to the printed total
// comprehensive income.

function parsedFixture() {
  return parseEdwardRiverGpfsExtraction(
    edwardRiverExtraction(),
    EDWARD_RIVER_CONTEXT,
  );
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Edward River Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/1.-documents/publications/reports/annual-report/ar-2024-25/edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf">Edward River Council Annual Report and Financial Statements 2024-25</a>
    <a href="/files/assets/public/v/1/1.-documents/publications/reports/annual-report/ar-2024-25/edward-river-council-annual-report-2024-25-rgb-web2.pdf">Edward River Council Annual Report 2024-25</a>
    <a href="/files/assets/public/v/1/1.-documents/publications/reports/annual-report/ar-2023-24/audited-financial-statements-2023-24.pdf">Audited Financial Statements 2023-24</a>
    <a href="https://example.com/edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf">Edward River financial statements mirror</a>
  `;

  it('discovers the FY2024-25 combined annual report + FS and never the narrative-only annual report, prior year or a mirror', () => {
    expect(EDWARD_RIVER_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseEdwardRiverGpfsReportLinks(pageHtml, EDWARD_RIVER_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      EDWARD_RIVER_PDF_URL,
      'https://www.edwardriver.nsw.gov.au/files/assets/public/v/1/1.-documents/publications/reports/annual-report/ar-2023-24/audited-financial-statements-2023-24.pdf',
    ]);
    const selected = selectEdwardRiverGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(EDWARD_RIVER_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(EDWARD_RIVER_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Edward River Council Annual Report and Financial Statements 2024-25');
    expect(
      fiscalYearFromEdwardRiverGpfsLink(
        'edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromEdwardRiverGpfsLink('audited-financial-statements-2023-24.pdf'),
    ).toBe('2023-24');
    expect(
      fiscalYearFromEdwardRiverGpfsLink(
        'Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromEdwardRiverGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/1.-documents/publications/reports/annual-report/ar-2023-24/audited-financial-statements-2023-24.pdf">Audited Financial Statements 2023-24</a>
    `;
    const links = parseEdwardRiverGpfsReportLinks(priorOnly, EDWARD_RIVER_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectEdwardRiverGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/1.-documents/publications/reports/annual-report/ar-2025-26/annual-report-financial-statements-2025-26.pdf">Annual Report and Financial Statements 2025-26</a>
    `;
    const links = parseEdwardRiverGpfsReportLinks(futureOnly, EDWARD_RIVER_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectEdwardRiverGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseEdwardRiverGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      EDWARD_RIVER_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = edwardRiverPinnedDocument();
    expect(pinned.url).toBe(EDWARD_RIVER_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('annual-report-financial-statements-2024-25');
    const discovered = await discoverEdwardRiverGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(EDWARD_RIVER_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverEdwardRiverGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(EDWARD_RIVER_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(EDWARD_RIVER_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverEdwardRiverGpfsDocument(
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
      discoverEdwardRiverGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Edward River Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectEdwardRiverGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectEdwardRiverGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = EDWARD_RIVER_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseEdwardRiverGpfsExtraction(
      extraction({ income: withoutUnit }),
      EDWARD_RIVER_CONTEXT,
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
    source: { sha256: EDWARD_RIVER_PDF_SHA256, bytes: 2_142_775 },
    pages: [
      pdfPage(overrides.income ?? EDWARD_RIVER_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? EDWARD_RIVER_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? EDWARD_RIVER_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Edward River Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(15);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(38_502);
    expect(reconciliation.total_expenses).toBe(37_609);
    expect(reconciliation.employee_expenses).toBe(12_853);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(10_953);
    expect(reconciliation.government_grants_operating).toBe(11_225);
    expect(reconciliation.government_grants_capital).toBe(3_196);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(171);
    expect(reconciliation.net_result).toBe(893);
    expect(reconciliation.net_result_before_capital_grants).toBe(-2_303);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(26_656);
    expect(reconciliation.face_expense_bridge).toBe(37_609);
    expect(reconciliation.functions_total_income).toBe(38_502);
    expect(reconciliation.functions_total_expenses).toBe(37_609);
    expect(reconciliation.functions_operating_result).toBe(893);
    expect(reconciliation.functions_grants_and_contributions).toBe(14_421);
    expect(reconciliation.comprehensive_income_net_result).toBe(893);
    expect(reconciliation.comprehensive_other_income).toBe(14_777);
    expect(reconciliation.comprehensive_total).toBe(15_670);
    expect(reconciliation.comprehensive_revaluation).toBe(14_777);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(38_502);
    expect(reconciliation.expense_components_sum).toBe(26_656);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(3_850_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_760_900_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_285_300_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_095_300_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_122_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(319_600_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      17_100_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_597_000_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(72_600_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      199_600_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(68_800_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(1_311_500_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(521_800_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(89_300_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_loss_from_disposal_of_assets'),
    ).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'borrowing_costs'),
    ).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: EDWARD_RIVER_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: EDWARD_RIVER_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Edward River Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: EDWARD_RIVER_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Edward River Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^edward-river-gpfs:/);
      expect(record.source_url).toContain('annual-report-financial-statements-2024-25');
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
    expect(natureComponents).toHaveLength(3);
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
    const broken = EDWARD_RIVER_FUNCTIONS_TEXT.replace(
      'Total functions and activities 38,502 53,557 37,609 37,327',
      'Total functions and activities 38,502 53,557 37,611 37,327',
    );
    const parsed = parseEdwardRiverGpfsExtraction(
      extraction({ functions: broken }),
      EDWARD_RIVER_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = EDWARD_RIVER_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 15,670',
      'Total comprehensive income for the year attributable to Council 15,672',
    );
    const parsed = parseEdwardRiverGpfsExtraction(
      extraction({ comprehensive: broken }),
      EDWARD_RIVER_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = EDWARD_RIVER_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 15,970',
      'Rates and annual charges B2-1 15,972',
    );
    const parsed = parseEdwardRiverGpfsExtraction(
      extraction({ income: broken }),
      EDWARD_RIVER_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net gain on disposal is altered', () => {
    const broken = EDWARD_RIVER_INCOME_TEXT.replace(
      'Net gain from the disposal of assets B4-1 171',
      'Net gain from the disposal of assets B4-1 173',
    );
    const parsed = parseEdwardRiverGpfsExtraction(
      extraction({ income: broken }),
      EDWARD_RIVER_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = EDWARD_RIVER_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 14,777',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 14,779',
    );
    const parsed = parseEdwardRiverGpfsExtraction(
      extraction({ comprehensive: broken }),
      EDWARD_RIVER_CONTEXT,
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
    const url = EDWARD_RIVER_CONTEXT.document.url;
    const revenue = edwardRiverGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = edwardRiverGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^edward-river-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(edwardRiverGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(edwardRiverGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_edwardrivergpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: EDWARD_RIVER_GPFS_ID,
    name: EDWARD_RIVER_GPFS_NAME,
    publisher: EDWARD_RIVER_GPFS_PUBLISHER,
    source_url: EDWARD_RIVER_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: EDWARD_RIVER_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'edward-river-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Edward River Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: EDWARD_RIVER_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-edward-river',
        project_name: 'Existing AusTender Edward River contract',
        delivery_entity: 'EDWARD RIVER COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-edward-river',
        project_name: 'Existing GrantConnect Edward River grant',
        delivery_entity: 'Edward River Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-edward-river-school',
        project_name: 'Existing data.nsw Deniliquin school row (not a council row)',
        delivery_entity: 'Deniliquin High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-edward-river-charity',
        project_name: 'Existing ACNC Edward River charity row (not the council)',
        delivery_entity: 'Edward River Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'glen-innes-severn-gpfs',
        source_url: 'https://www.gisc.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-glen-innes-severn-gpfs-1',
        project_name: 'Existing Glen Innes Severn GPFS row',
        delivery_entity: 'Glen Innes Severn Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'glen-innes-severn-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: EDWARD_RIVER_GPFS_ID })).toBe(15);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: EDWARD_RIVER_GPFS_ID })).toBe(15);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: EDWARD_RIVER_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: EDWARD_RIVER_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: EDWARD_RIVER_GPFS_ID,
        delivery_entity: { $ne: 'Edward River Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: EDWARD_RIVER_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(15);
  });
});
