import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  PARKES_GPFS_DELIVERY_ENTITY,
  PARKES_GPFS_DOCUMENT_PIN,
  PARKES_GPFS_FISCAL_YEAR,
  PARKES_GPFS_ID,
  PARKES_GPFS_LICENSE,
  PARKES_GPFS_NAME,
  PARKES_GPFS_PUBLISHER,
  PARKES_GPFS_REPORTING_URL,
  PARKES_GPFS_REQUEST_HEADERS,
  parkesPinnedDocument,
  detectParkesGpfsUnit,
  discoverParkesGpfsDocument,
  fiscalYearFromParkesGpfsLink,
  parseParkesGpfsExtraction,
  parseParkesGpfsReportLinks,
  selectParkesGpfsDocument,
  parkesGpfsNaturalKey,
} from '../src/connectors/parkes-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  PARKES_COMPREHENSIVE_TEXT,
  PARKES_CONTEXT,
  PARKES_FUNCTIONS_TEXT,
  PARKES_INCOME_TEXT,
  PARKES_PDF_SHA256,
  PARKES_PDF_URL,
  parkesExtraction,
} from '../src/connectors/parkes-gpfs/fixture.js';

// Parkes Shire Council's audited FY2025-26 standalone General Purpose Financial
// Statements. FY2025-26 is the current audited year (the item title originally
// said FY2024-25, but the official page publishes both and FY2025-26 is
// preferred). The connector targets 2025-26 only and never substitutes the
// prior 2024-25 or 2023-24 document. The Income Statement prints the Original
// unaudited budget column before the line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Parkes prints eight revenue
// components (other revenues, other income and a real net gain on disposal of
// 305) and four expense components. The net result is positive while the
// before-capital result is negative (-1,776). Other comprehensive income has a
// single component (revaluation 18,129).

function parsedFixture() {
  return parseParkesGpfsExtraction(parkesExtraction(), PARKES_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Parkes Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/9957d5ac-c878-4061-9eeb-43a7d5e01650/Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf">Parkes Shire Council Audited Annual Financial Statements YE 30 June 2026</a>
    <a href="/files/assets/public/v/2/council/community-reports/audited-financial-statements/30-june-2025/audited-financial-statements-year-ended-30-june-2025.pdf">Audited Financial Statements Year Ended 30 June 2025</a>
    <a href="/files/assets/public/v/1/council/community-reports/audited-financial-statements/30-june-2024/audited-financial-statements-year-ended-30-june-2024.pdf">Audited Financial Statements Year Ended 30 June 2024</a>
    <a href="https://example.com/Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf">Parkes financial statements mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the prior year or a mirror', () => {
    expect(PARKES_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseParkesGpfsReportLinks(pageHtml, PARKES_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      PARKES_PDF_URL,
      'https://www.parkes.nsw.gov.au/files/assets/public/v/2/council/community-reports/audited-financial-statements/30-june-2025/audited-financial-statements-year-ended-30-june-2025.pdf',
      'https://www.parkes.nsw.gov.au/files/assets/public/v/1/council/community-reports/audited-financial-statements/30-june-2024/audited-financial-statements-year-ended-30-june-2024.pdf',
    ]);
    const selected = selectParkesGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(PARKES_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(PARKES_GPFS_REPORTING_URL);
    expect(selected.title).toBe(
      'Parkes Shire Council Audited Annual Financial Statements YE 30 June 2026',
    );
    expect(
      fiscalYearFromParkesGpfsLink(
        'Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromParkesGpfsLink(
        'audited-financial-statements-year-ended-30-june-2025.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromParkesGpfsLink(
        'Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromParkesGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/2/council/community-reports/audited-financial-statements/30-june-2025/audited-financial-statements-year-ended-30-june-2025.pdf">Audited Financial Statements Year Ended 30 June 2025</a>
    `;
    const links = parseParkesGpfsReportLinks(priorOnly, PARKES_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectParkesGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/2/council/community-reports/audited-financial-statements/30-june-2027/audited-financial-statements-year-ended-30-june-2027.pdf">Audited Financial Statements Year Ended 30 June 2027</a>
    `;
    const links = parseParkesGpfsReportLinks(futureOnly, PARKES_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectParkesGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseParkesGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      PARKES_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = parkesPinnedDocument();
    expect(pinned.url).toBe(PARKES_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('YE-30-June-2026.pdf');
    const discovered = await discoverParkesGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(PARKES_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverParkesGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(PARKES_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(PARKES_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverParkesGpfsDocument(
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
      discoverParkesGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Parkes Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectParkesGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectParkesGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = PARKES_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseParkesGpfsExtraction(
      extraction({ income: withoutUnit }),
      PARKES_CONTEXT,
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
    source: { sha256: PARKES_PDF_SHA256, bytes: 6_311_039 },
    pages: [
      pdfPage(overrides.income ?? PARKES_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? PARKES_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? PARKES_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Parkes Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(95_970);
    expect(reconciliation.total_expenses).toBe(79_471);
    expect(reconciliation.employee_expenses).toBe(22_638);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(28_298);
    expect(reconciliation.government_grants_operating).toBe(22_746);
    expect(reconciliation.government_grants_capital).toBe(18_275);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(305);
    expect(reconciliation.net_result).toBe(16_499);
    expect(reconciliation.net_result_before_capital_grants).toBe(-1_776);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(51_173);
    expect(reconciliation.face_expense_bridge).toBe(79_471);
    expect(reconciliation.functions_total_income).toBe(95_970);
    expect(reconciliation.functions_total_expenses).toBe(79_471);
    expect(reconciliation.functions_operating_result).toBe(16_499);
    expect(reconciliation.functions_grants_and_contributions).toBe(41_021);
    expect(reconciliation.comprehensive_income_net_result).toBe(16_499);
    expect(reconciliation.comprehensive_other_income).toBe(18_129);
    expect(reconciliation.comprehensive_total).toBe(34_628);
    expect(reconciliation.comprehensive_revaluation).toBe(18_129);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(95_970);
    expect(reconciliation.expense_components_sum).toBe(51_173);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(9_597_000_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(7_947_100_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(2_263_800_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_829_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_274_600_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_827_500_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      30_500_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(98_100_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(3_242_500_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(161_300_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(94_700_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      233_000_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(109_500_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(2_645_900_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(1_732_900_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_649_900_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_loss_from_disposal_of_assets'),
    ).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: PARKES_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: PARKES_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Parkes Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: PARKES_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Parkes Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^parkes-gpfs:/);
      expect(record.source_url).toContain('YE-30-June-2026.pdf');
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
    const broken = PARKES_FUNCTIONS_TEXT.replace(
      'Total functions and activities 95,970 101,283 79,471 67,951',
      'Total functions and activities 95,970 101,283 79,473 67,951',
    );
    const parsed = parseParkesGpfsExtraction(
      extraction({ functions: broken }),
      PARKES_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = PARKES_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 34,628',
      'Total comprehensive income for the year attributable to Council 34,630',
    );
    const parsed = parseParkesGpfsExtraction(
      extraction({ comprehensive: broken }),
      PARKES_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = PARKES_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 32,425',
      'Rates and annual charges B2-1 32,427',
    );
    const parsed = parseParkesGpfsExtraction(extraction({ income: broken }), PARKES_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net gain on disposal is altered', () => {
    const broken = PARKES_INCOME_TEXT.replace(
      'Net gain from the disposal of assets 305',
      'Net gain from the disposal of assets 307',
    );
    const parsed = parseParkesGpfsExtraction(extraction({ income: broken }), PARKES_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = PARKES_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 18,129',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 18,131',
    );
    const parsed = parseParkesGpfsExtraction(
      extraction({ comprehensive: broken }),
      PARKES_CONTEXT,
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
    const url = PARKES_CONTEXT.document.url;
    const revenue = parkesGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = parkesGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^parkes-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(parkesGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(parkesGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_parkesgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: PARKES_GPFS_ID,
    name: PARKES_GPFS_NAME,
    publisher: PARKES_GPFS_PUBLISHER,
    source_url: PARKES_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: PARKES_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'parkes-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Parkes Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: PARKES_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-parkes',
        project_name: 'Existing AusTender Parkes contract',
        delivery_entity: 'PARKES SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-parkes',
        project_name: 'Existing GrantConnect Parkes grant',
        delivery_entity: 'Parkes Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-parkes-school',
        project_name: 'Existing data.nsw Parkes school row (not a council row)',
        delivery_entity: 'Parkes High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-parkes-charity',
        project_name: 'Existing ACNC Parkes charity row (not the council)',
        delivery_entity: 'Parkes Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'gunnedah-gpfs',
        source_url: 'https://www.gunnedah.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-gunnedah-gpfs-1',
        project_name: 'Existing Gunnedah GPFS row',
        delivery_entity: 'Gunnedah Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'gunnedah-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: PARKES_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: PARKES_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: PARKES_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: PARKES_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: PARKES_GPFS_ID,
        delivery_entity: { $ne: 'Parkes Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: PARKES_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
