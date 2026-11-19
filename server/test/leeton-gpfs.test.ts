import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  LEETON_GPFS_DELIVERY_ENTITY,
  LEETON_GPFS_DOCUMENT_PIN,
  LEETON_GPFS_FISCAL_YEAR,
  LEETON_GPFS_ID,
  LEETON_GPFS_LICENSE,
  LEETON_GPFS_NAME,
  LEETON_GPFS_PUBLISHER,
  LEETON_GPFS_REPORTING_URL,
  LEETON_GPFS_REQUEST_HEADERS,
  leetonPinnedDocument,
  detectLeetonGpfsUnit,
  discoverLeetonGpfsDocument,
  fiscalYearFromLeetonGpfsLink,
  parseLeetonGpfsExtraction,
  parseLeetonGpfsReportLinks,
  selectLeetonGpfsDocument,
  leetonGpfsNaturalKey,
} from '../src/connectors/leeton-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  LEETON_COMPREHENSIVE_TEXT,
  LEETON_CONTEXT,
  LEETON_FUNCTIONS_TEXT,
  LEETON_INCOME_TEXT,
  LEETON_PDF_SHA256,
  LEETON_PDF_URL,
  leetonExtraction,
} from '../src/connectors/leeton-gpfs/fixture.js';

// Leeton Shire Council's audited FY2025-26 standalone General Purpose Financial
// Statements. FY2025-26 is the current audited year (the item title originally
// said FY2024-25, but the official page publishes both and FY2025-26 is
// preferred). The connector targets 2025-26 only and never substitutes the
// prior 2024-25 or 2023-24 document. The Income Statement prints the Original
// unaudited budget column before the line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Leeton prints seven non-nil
// revenue components (the 2026 net gain on disposal is nil) and five expense
// components including a real net loss on disposal of 84. The net result and the
// before-capital result are both positive. Other comprehensive income has two
// components (revaluation 5,960 and other reserve movements 58) whose sum 6,018
// is printed as "Total items which will not be reclassified subsequent to
// operating result" (there is no separate "Total other comprehensive income"
// line).

function parsedFixture() {
  return parseLeetonGpfsExtraction(leetonExtraction(), LEETON_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Leeton Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/attachments/1.-your-council/1.2-about-council/1.2.f-plans-reports-regional-plans/financial-statements-and-annual-reports/final-signed-annual-financial-statements-fy-2025-26.pdf">Leeton Shire Council Final Signed Annual Financial Statements FY2025-26</a>
    <a href="/files/assets/public/v/1/attachments/1.-your-council/1.2-about-council/1.2.f-plans-reports-regional-plans/financial-statements-and-annual-reports/signed-audited-financial-statements-2025-final.pdf">Signed Audited Financial Statements 2025</a>
    <a href="/files/assets/public/v/1/attachments/1.-your-council/1.2-about-council/1.2.f-plans-reports-regional-plans/financial-statements-and-annual-reports/signed-audited-financial-statements-2024-final.pdf">Signed Audited Financial Statements 2024</a>
    <a href="/files/assets/public/v/1/attachments/1.-your-council/1.2-about-council/1.2.f-plans-reports-regional-plans/annual-reports/2025-annual-report-leeton-shire-council.pdf">2025 Annual Report Leeton Shire Council</a>
    <a href="https://example.com/final-signed-annual-financial-statements-fy-2025-26.pdf">Leeton financial statements mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the prior year or a mirror', () => {
    expect(LEETON_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseLeetonGpfsReportLinks(pageHtml, LEETON_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      LEETON_PDF_URL,
      'https://www.leeton.nsw.gov.au/files/assets/public/v/1/attachments/1.-your-council/1.2-about-council/1.2.f-plans-reports-regional-plans/financial-statements-and-annual-reports/signed-audited-financial-statements-2025-final.pdf',
      'https://www.leeton.nsw.gov.au/files/assets/public/v/1/attachments/1.-your-council/1.2-about-council/1.2.f-plans-reports-regional-plans/financial-statements-and-annual-reports/signed-audited-financial-statements-2024-final.pdf',
    ]);
    const selected = selectLeetonGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(LEETON_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(LEETON_GPFS_REPORTING_URL);
    expect(selected.title).toBe(
      'Leeton Shire Council Final Signed Annual Financial Statements FY2025-26',
    );
    expect(
      fiscalYearFromLeetonGpfsLink('final-signed-annual-financial-statements-fy-2025-26.pdf'),
    ).toBe('2025-26');
    expect(
      fiscalYearFromLeetonGpfsLink('signed-audited-financial-statements-2025-final.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromLeetonGpfsLink(
        'Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromLeetonGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/attachments/1.-your-council/1.2-about-council/1.2.f-plans-reports-regional-plans/financial-statements-and-annual-reports/signed-audited-financial-statements-2025-final.pdf">Signed Audited Financial Statements 2025</a>
    `;
    const links = parseLeetonGpfsReportLinks(priorOnly, LEETON_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectLeetonGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/attachments/1.-your-council/1.2-about-council/1.2.f-plans-reports-regional-plans/financial-statements-and-annual-reports/final-signed-annual-financial-statements-fy-2026-27.pdf">Final Signed Annual Financial Statements FY2026-27</a>
    `;
    const links = parseLeetonGpfsReportLinks(futureOnly, LEETON_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectLeetonGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseLeetonGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      LEETON_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = leetonPinnedDocument();
    expect(pinned.url).toBe(LEETON_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('final-signed-annual-financial-statements-fy-2025-26.pdf');
    const discovered = await discoverLeetonGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(LEETON_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverLeetonGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(LEETON_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(LEETON_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverLeetonGpfsDocument(
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
      discoverLeetonGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Leeton Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectLeetonGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectLeetonGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = LEETON_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseLeetonGpfsExtraction(
      extraction({ income: withoutUnit }),
      LEETON_CONTEXT,
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
    source: { sha256: LEETON_PDF_SHA256, bytes: 2_722_199 },
    pages: [
      pdfPage(overrides.income ?? LEETON_INCOME_TEXT, 7),
      pdfPage(overrides.comprehensive ?? LEETON_COMPREHENSIVE_TEXT, 8),
      pdfPage(overrides.functions ?? LEETON_FUNCTIONS_TEXT, 17),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Leeton Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(46_970);
    expect(reconciliation.total_expenses).toBe(41_767);
    expect(reconciliation.employee_expenses).toBe(15_957);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(9_887);
    expect(reconciliation.government_grants_operating).toBe(10_925);
    expect(reconciliation.government_grants_capital).toBe(2_110);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(84);
    expect(reconciliation.net_result).toBe(5_203);
    expect(reconciliation.net_result_before_capital_grants).toBe(3_093);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(31_880);
    expect(reconciliation.face_expense_bridge).toBe(41_767);
    expect(reconciliation.functions_total_income).toBe(46_970);
    expect(reconciliation.functions_total_expenses).toBe(41_767);
    expect(reconciliation.functions_operating_result).toBe(5_203);
    expect(reconciliation.functions_grants_and_contributions).toBe(13_035);
    expect(reconciliation.comprehensive_income_net_result).toBe(5_203);
    expect(reconciliation.comprehensive_other_income).toBe(6_018);
    expect(reconciliation.comprehensive_total).toBe(11_221);
    expect(reconciliation.comprehensive_revaluation).toBe(5_960);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBe(58);
    expect(reconciliation.revenue_components_sum).toBe(46_970);
    expect(reconciliation.expense_components_sum).toBe(31_880);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(4_697_000_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(4_176_700_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_595_700_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      988_700_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_092_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(211_000_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      8_400_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(48_000_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_682_200_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(168_000_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(56_000_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      250_400_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(203_300_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(1_332_600_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(1_236_900_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(520_300_000);
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
        source_id: LEETON_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: LEETON_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Leeton Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: LEETON_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Leeton Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^leeton-gpfs:/);
      expect(record.source_url).toContain('final-signed-annual-financial-statements-fy-2025-26.pdf');
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
    const broken = LEETON_FUNCTIONS_TEXT.replace(
      'Total functions and activities 46,970 45,025 41,767 40,908',
      'Total functions and activities 46,970 45,025 41,769 40,908',
    );
    const parsed = parseLeetonGpfsExtraction(
      extraction({ functions: broken }),
      LEETON_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = LEETON_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 11,221',
      'Total comprehensive income for the year attributable to Council 11,223',
    );
    const parsed = parseLeetonGpfsExtraction(
      extraction({ comprehensive: broken }),
      LEETON_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = LEETON_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 16,822',
      'Rates and annual charges B2-1 16,824',
    );
    const parsed = parseLeetonGpfsExtraction(extraction({ income: broken }), LEETON_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = LEETON_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 84',
      'Net loss from the disposal of assets B4-1 86',
    );
    const parsed = parseLeetonGpfsExtraction(extraction({ income: broken }), LEETON_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the other reserve movements are altered', () => {
    const broken = LEETON_COMPREHENSIVE_TEXT.replace(
      'Other movements in reserves – Intangible Assets Revaluation C1-7 58',
      'Other movements in reserves – Intangible Assets Revaluation C1-7 60',
    );
    const parsed = parseLeetonGpfsExtraction(
      extraction({ comprehensive: broken }),
      LEETON_CONTEXT,
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
    const url = LEETON_CONTEXT.document.url;
    const revenue = leetonGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = leetonGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^leeton-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(leetonGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(leetonGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_leetongpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: LEETON_GPFS_ID,
    name: LEETON_GPFS_NAME,
    publisher: LEETON_GPFS_PUBLISHER,
    source_url: LEETON_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LEETON_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'leeton-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Leeton Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: LEETON_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-leeton',
        project_name: 'Existing AusTender Leeton contract',
        delivery_entity: 'LEETON SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-leeton',
        project_name: 'Existing GrantConnect Leeton grant',
        delivery_entity: 'Leeton Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-leeton-school',
        project_name: 'Existing data.nsw Leeton school row (not a council row)',
        delivery_entity: 'Leeton High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-leeton-charity',
        project_name: 'Existing ACNC Leeton charity row (not the council)',
        delivery_entity: 'Leeton Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'cowra-gpfs',
        source_url: 'https://www.cowracouncil.com.au/example.pdf',
        verified: false,
        natural_key: 'existing-cowra-gpfs-1',
        project_name: 'Existing Cowra GPFS row',
        delivery_entity: 'Cowra Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'cowra-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: LEETON_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: LEETON_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: LEETON_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: LEETON_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: LEETON_GPFS_ID,
        delivery_entity: { $ne: 'Leeton Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: LEETON_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
