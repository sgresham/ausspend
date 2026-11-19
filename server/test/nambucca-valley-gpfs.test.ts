import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  NAMBUCCA_VALLEY_GPFS_DELIVERY_ENTITY,
  NAMBUCCA_VALLEY_GPFS_DOCUMENT_PIN,
  NAMBUCCA_VALLEY_GPFS_FISCAL_YEAR,
  NAMBUCCA_VALLEY_GPFS_ID,
  NAMBUCCA_VALLEY_GPFS_LICENSE,
  NAMBUCCA_VALLEY_GPFS_NAME,
  NAMBUCCA_VALLEY_GPFS_PUBLISHER,
  NAMBUCCA_VALLEY_GPFS_REPORTING_URL,
  NAMBUCCA_VALLEY_GPFS_REQUEST_HEADERS,
  nambuccaValleyPinnedDocument,
  detectNambuccaValleyGpfsUnit,
  discoverNambuccaValleyGpfsDocument,
  fiscalYearFromNambuccaValleyGpfsLink,
  parseNambuccaValleyGpfsExtraction,
  parseNambuccaValleyGpfsReportLinks,
  selectNambuccaValleyGpfsDocument,
  nambuccaValleyGpfsNaturalKey,
} from '../src/connectors/nambucca-valley-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  NAMBUCCA_VALLEY_COMPREHENSIVE_TEXT,
  NAMBUCCA_VALLEY_CONTEXT,
  NAMBUCCA_VALLEY_FUNCTIONS_TEXT,
  NAMBUCCA_VALLEY_INCOME_TEXT,
  NAMBUCCA_VALLEY_PDF_SHA256,
  NAMBUCCA_VALLEY_PDF_URL,
  nambuccaValleyExtraction,
} from '../src/connectors/nambucca-valley-gpfs/fixture.js';

// Nambucca Valley Council's audited FY2024-25 standalone General Purpose
// Financial Statements. FY2024-25 is the latest **obtainable** audited year:
// the official page advertises a FY2025-26 PDF, but that file URL returned HTTP
// 404 at retrieval time, so FY2025-26 could not be ingested. The connector
// targets 2024-25 only and never substitutes the later 2025-26 or the earlier
// 2023-24 document. The Income Statement prints the Original unaudited budget
// column before the line label, with Actual 2025 and Actual 2024 after it. A
// parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. Nambucca prints seven revenue components
// (there is no net gain on disposal line) and five expense components including
// a real net loss on disposal of 2,829. The net result is positive while the
// before-capital result is negative (-6,446). Other comprehensive income has two
// components (revaluation 26,449 and impairment/revaluation decrement -214)
// summing to the printed 26,235.

function parsedFixture() {
  return parseNambuccaValleyGpfsExtraction(
    nambuccaValleyExtraction(),
    NAMBUCCA_VALLEY_CONTEXT,
  );
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Nambucca Valley Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/council/news-and-community-feedback/documents-on-exhibition/annual-financial-statements/audited-annual-financial-statements-2024-2025.pdf">Audited Annual Financial Statements 2024-25</a>
    <a href="/files/assets/public/v/1/council/news-and-community-feedback/documents-on-exhibition/annual-financial-statements/nambucca-valley-council-annual-financial-statements-2025-2026.pdf">Nambucca Valley Council Annual Financial Statements 2025-2026</a>
    <a href="/files/assets/public/v/1/council/complianceformspolicies-amp-reporting/financial-reports/2024/audited-annual-financial-statements-2023-24.pdf">Audited Annual Financial Statements 2023-24</a>
    <a href="https://example.com/audited-annual-financial-statements-2024-2025.pdf">Nambucca financial statements mirror</a>
  `;

  it('discovers the latest obtainable FY2024-25 statements and never a prior year or a mirror', () => {
    expect(NAMBUCCA_VALLEY_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseNambuccaValleyGpfsReportLinks(pageHtml, NAMBUCCA_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2025-26', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      NAMBUCCA_VALLEY_PDF_URL,
      'https://www.nambucca.nsw.gov.au/files/assets/public/v/1/council/news-and-community-feedback/documents-on-exhibition/annual-financial-statements/nambucca-valley-council-annual-financial-statements-2025-2026.pdf',
      'https://www.nambucca.nsw.gov.au/files/assets/public/v/1/council/complianceformspolicies-amp-reporting/financial-reports/2024/audited-annual-financial-statements-2023-24.pdf',
    ]);
    const selected = selectNambuccaValleyGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(NAMBUCCA_VALLEY_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(NAMBUCCA_VALLEY_GPFS_REPORTING_URL);
    expect(selected.title).toBe('Audited Annual Financial Statements 2024-25');
    expect(
      fiscalYearFromNambuccaValleyGpfsLink('audited-annual-financial-statements-2024-2025.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromNambuccaValleyGpfsLink(
        'nambucca-valley-council-annual-financial-statements-2025-2026.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromNambuccaValleyGpfsLink(
        'Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromNambuccaValleyGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('does not substitute the advertised FY2025-26 link for the target FY2024-25', () => {
    const newerOnly = `
      <a href="/files/assets/public/v/1/council/news-and-community-feedback/documents-on-exhibition/annual-financial-statements/nambucca-valley-council-annual-financial-statements-2025-2026.pdf">Nambucca Valley Council Annual Financial Statements 2025-2026</a>
    `;
    const links = parseNambuccaValleyGpfsReportLinks(newerOnly, NAMBUCCA_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectNambuccaValleyGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('rejects the older 2023-24 year and never substitutes it for the target 2024-25', () => {
    const olderOnly = `
      <a href="/files/assets/public/v/1/council/complianceformspolicies-amp-reporting/financial-reports/2024/audited-annual-financial-statements-2023-24.pdf">Audited Annual Financial Statements 2023-24</a>
    `;
    const links = parseNambuccaValleyGpfsReportLinks(olderOnly, NAMBUCCA_VALLEY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectNambuccaValleyGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseNambuccaValleyGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      NAMBUCCA_VALLEY_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = nambuccaValleyPinnedDocument();
    expect(pinned.url).toBe(NAMBUCCA_VALLEY_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('audited-annual-financial-statements-2024-2025.pdf');
    const discovered = await discoverNambuccaValleyGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(NAMBUCCA_VALLEY_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverNambuccaValleyGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(NAMBUCCA_VALLEY_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(NAMBUCCA_VALLEY_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverNambuccaValleyGpfsDocument(
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
      discoverNambuccaValleyGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Nambucca Valley Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectNambuccaValleyGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectNambuccaValleyGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = NAMBUCCA_VALLEY_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseNambuccaValleyGpfsExtraction(
      extraction({ income: withoutUnit }),
      NAMBUCCA_VALLEY_CONTEXT,
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
    source: { sha256: NAMBUCCA_VALLEY_PDF_SHA256, bytes: 1_734_745 },
    pages: [
      pdfPage(overrides.income ?? NAMBUCCA_VALLEY_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? NAMBUCCA_VALLEY_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? NAMBUCCA_VALLEY_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Nambucca Valley Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(74_963);
    expect(reconciliation.total_expenses).toBe(59_835);
    expect(reconciliation.employee_expenses).toBe(15_747);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(13_694);
    expect(reconciliation.government_grants_operating).toBe(10_446);
    expect(reconciliation.government_grants_capital).toBe(21_574);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(2_829);
    expect(reconciliation.net_result).toBe(15_128);
    expect(reconciliation.net_result_before_capital_grants).toBe(-6_446);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(46_141);
    expect(reconciliation.face_expense_bridge).toBe(59_835);
    expect(reconciliation.functions_total_income).toBe(74_963);
    expect(reconciliation.functions_total_expenses).toBe(59_835);
    expect(reconciliation.functions_operating_result).toBe(15_128);
    expect(reconciliation.functions_grants_and_contributions).toBe(32_020);
    expect(reconciliation.comprehensive_income_net_result).toBe(15_128);
    expect(reconciliation.comprehensive_other_income).toBe(26_235);
    expect(reconciliation.comprehensive_total).toBe(41_363);
    expect(reconciliation.comprehensive_revaluation).toBe(26_449);
    expect(reconciliation.comprehensive_impairment).toBe(-214);
    expect(reconciliation.comprehensive_other_movements).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(74_963);
    expect(reconciliation.expense_components_sum).toBe(46_141);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(7_496_300_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(5_983_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_574_700_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_369_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_044_600_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(2_157_400_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      282_900_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(213_700_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(2_624_800_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(121_300_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(39_300_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      518_000_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(223_400_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(2_319_400_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(990_900_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_512_800_000);
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
        source_id: NAMBUCCA_VALLEY_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: NAMBUCCA_VALLEY_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Nambucca Valley Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: NAMBUCCA_VALLEY_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Nambucca Valley Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^nambucca-valley-gpfs:/);
      expect(record.source_url).toContain('audited-annual-financial-statements-2024-2025.pdf');
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
    const broken = NAMBUCCA_VALLEY_FUNCTIONS_TEXT.replace(
      'Total functions and activities 74,963 70,309 59,835 49,628',
      'Total functions and activities 74,963 70,309 59,837 49,628',
    );
    const parsed = parseNambuccaValleyGpfsExtraction(
      extraction({ functions: broken }),
      NAMBUCCA_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = NAMBUCCA_VALLEY_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 41,363',
      'Total comprehensive income for the year attributable to Council 41,365',
    );
    const parsed = parseNambuccaValleyGpfsExtraction(
      extraction({ comprehensive: broken }),
      NAMBUCCA_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = NAMBUCCA_VALLEY_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 26,248',
      'Rates and annual charges B2-1 26,250',
    );
    const parsed = parseNambuccaValleyGpfsExtraction(
      extraction({ income: broken }),
      NAMBUCCA_VALLEY_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the impairment/revaluation decrement is altered', () => {
    const broken = NAMBUCCA_VALLEY_COMPREHENSIVE_TEXT.replace(
      'Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-7 (214)',
      'Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-7 (216)',
    );
    const parsed = parseNambuccaValleyGpfsExtraction(
      extraction({ comprehensive: broken }),
      NAMBUCCA_VALLEY_CONTEXT,
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
    const url = NAMBUCCA_VALLEY_CONTEXT.document.url;
    const revenue = nambuccaValleyGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = nambuccaValleyGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^nambucca-valley-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(nambuccaValleyGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(nambuccaValleyGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_nambuccavalleygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: NAMBUCCA_VALLEY_GPFS_ID,
    name: NAMBUCCA_VALLEY_GPFS_NAME,
    publisher: NAMBUCCA_VALLEY_GPFS_PUBLISHER,
    source_url: NAMBUCCA_VALLEY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: NAMBUCCA_VALLEY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'nambucca-valley-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Nambucca Valley Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: NAMBUCCA_VALLEY_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-nambucca',
        project_name: 'Existing AusTender Nambucca contract',
        delivery_entity: 'NAMBUCCA VALLEY COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-nambucca',
        project_name: 'Existing GrantConnect Nambucca grant',
        delivery_entity: 'Nambucca Valley Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-nambucca-school',
        project_name: 'Existing data.nsw Nambucca school row (not a council row)',
        delivery_entity: 'Nambucca Heads High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-nambucca-charity',
        project_name: 'Existing ACNC Nambucca charity row (not the council)',
        delivery_entity: 'Nambucca Valley Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'leeton-gpfs',
        source_url: 'https://www.leeton.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-leeton-gpfs-1',
        project_name: 'Existing Leeton GPFS row',
        delivery_entity: 'Leeton Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'leeton-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: NAMBUCCA_VALLEY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: NAMBUCCA_VALLEY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: NAMBUCCA_VALLEY_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NAMBUCCA_VALLEY_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NAMBUCCA_VALLEY_GPFS_ID,
        delivery_entity: { $ne: 'Nambucca Valley Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: NAMBUCCA_VALLEY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
