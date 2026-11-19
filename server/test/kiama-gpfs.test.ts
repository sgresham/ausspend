import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  KIAMA_ANNUAL_REPORT_GAP,
  KIAMA_GPFS_DOCUMENT_PIN,
  KIAMA_GPFS_FISCAL_YEAR,
  KIAMA_GPFS_ID,
  KIAMA_GPFS_LICENSE,
  KIAMA_GPFS_LINES,
  KIAMA_GPFS_NAME,
  KIAMA_GPFS_PUBLISHER,
  KIAMA_GPFS_REPORTING_URL,
  KIAMA_GPFS_REQUEST_HEADERS,
  discoverKiamaGpfsDocument,
  fiscalYearFromKiamaAnnualReportLink,
  fiscalYearFromKiamaFinancialStatementsLink,
  kiamaAnnualReportPinnedDocument,
  kiamaGpfsNaturalKey,
  kiamaPinnedDocument,
  parseKiamaAnnualReportExtraction,
  parseKiamaAnnualReportLinks,
  parseKiamaGpfsExtraction,
  parseKiamaGpfsFinancialStatementsLinks,
  parseKiamaGpfsFunctionsTotals,
  selectKiamaAnnualReportDocument,
  selectKiamaGpfsDocument,
} from '../src/connectors/kiama-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  KIAMA_AUTHORISATION_TEXT,
  KIAMA_CONTENTS_TEXT,
  KIAMA_CONTEXT,
  KIAMA_FUNCTIONS_TEXT,
  KIAMA_INCOME_TEXT,
  KIAMA_SUMMARY_TEXT,
  kiamaAnnualReportExtraction,
  kiamaExtraction,
} from '../src/connectors/kiama-gpfs/fixture.js';

// Kiama City Council's FY2024-25 annual report is narrative-only, but the
// official Annual Reports and Financial Statements page publishes a separate
// current-year FY2024-25 Financial Statements PDF with the audit opinion. The
// connector discovers/archives that FS through the browser/WAF-aware path and
// emits the printed statement slice, including the discontinued-operations
// result. The annual-report-only rejection is retained.

const FS_2024_HREF =
  '/files/sharedassets/public/v/1/council/council-plans-amp-reports/financial-plans-and-annual-reports/kiama-municipal-council-financial-statements-2024-25.pdf';
const FS_2023_HREF = '/files/sharedassets/public/v/2/news/2023-24-audited-financial-statements.pdf';
const FS_2022_HREF =
  '/files/sharedassets/public/v/1/council/financial-plans-and-annual-reports/kiama-municipal-council-financial-statements-2022-23.pdf';
const AR_2024_HREF =
  '/files/sharedassets/public/v/1/council/council-plans-amp-reports/2024-25-annual-report-final.pdf';

const LISTING_HTML = `
  <p>Council's Annual Financial Statements are based on each financial year, and set out Council's financial performance, financial position and cash flows.</p>
  <a href="${FS_2024_HREF}" title="Financial-Statements-2024-25" target="_blank" class="document ext-pdf">Financial-Statements-2024-25<span class="file-info">(PDF,&nbsp;10MB)</span></a>
  <a href="${FS_2023_HREF}" title="Financial statements 2023-24" target="_blank" class="document ext-pdf">Financial statements 2023-24<span class="file-info">(PDF,&nbsp;4MB)</span></a>
  <a href="${FS_2022_HREF}" title="Financial statements 2022-23" target="_blank" class="document ext-pdf">Financial statements 2022-23<span class="file-info">(PDF,&nbsp;4MB)</span></a>
  <a href="${AR_2024_HREF}" title="Annual Report 2024-25" target="_blank" class="document ext-pdf">Annual Report 2024-25<span class="file-info">(PDF,&nbsp;15MB)</span></a>
  <a href="/files/sharedassets/public/v/1/council/council-plans-amp-reports/annual-report-2022-2023-addendum.pdf" title="Annual Report 2022-23 - Addendum">Annual Report 2022-23 - Addendum</a>
`;

const { BROWSER_BYTES, BROWSER_HTML } = vi.hoisted(() => {
  const pin =
    'https://www.kiama.nsw.gov.au/files/sharedassets/public/v/1/council/council-plans-amp-reports/financial-plans-and-annual-reports/kiama-municipal-council-financial-statements-2024-25.pdf';
  return {
    BROWSER_HTML: `<a href="${pin}" title="Financial-Statements-2024-25">Financial-Statements-2024-25</a>`,
    BROWSER_BYTES: Buffer.from('browser-fetched-fs-bytes'),
  };
});

vi.mock('playwright', () => {
  const page = {
    async goto() {
      return { ok: () => true, status: () => 200 };
    },
    async waitForTimeout() {
      return undefined;
    },
    async content() {
      return BROWSER_HTML;
    },
    async evaluate() {
      return Buffer.from('browser-fetched-fs-bytes').toString('base64');
    },
  };
  const context = {
    async newPage() {
      return page;
    },
  };
  const browser = {
    async newContext() {
      return context;
    },
    async close() {
      return undefined;
    },
  };
  return {
    chromium: {
      async launch() {
        return browser;
      },
    },
  };
});

const { fetchKiamaGpfsViaBrowser } = await import('../../scripts/kiama-gpfs-browser.js');

function parsedFixture() {
  return parseKiamaGpfsExtraction(kiamaExtraction(), KIAMA_CONTEXT);
}

describe('Kiama Municipal Council standalone FS discovery', () => {
  it('discovers the FY2024-25 FS and never selects the annual report', () => {
    expect(KIAMA_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseKiamaGpfsFinancialStatementsLinks(LISTING_HTML, KIAMA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24', '2022-23']);
    expect(links.some((link) => link.url.includes('annual-report-final.pdf'))).toBe(false);
    const selected = selectKiamaGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(new URL(FS_2024_HREF, KIAMA_GPFS_REPORTING_URL).toString());
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(KIAMA_GPFS_REPORTING_URL);
    expect(selected.title).toContain('2024-25');
    expect(fiscalYearFromKiamaFinancialStatementsLink('Financial-Statements-2024-25')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromKiamaFinancialStatementsLink('Financial statements 2023-24')).toBe(
      '2023-24',
    );
    expect(
      fiscalYearFromKiamaFinancialStatementsLink('Long Term Financial Plan 2023-2033.pdf'),
    ).toBeNull();
  });

  it('retains annual-report discovery and excludes the separate FS', () => {
    const annualReports = parseKiamaAnnualReportLinks(LISTING_HTML, KIAMA_GPFS_REPORTING_URL);
    expect(annualReports.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    const selected = selectKiamaAnnualReportDocument(annualReports, '2024-25');
    expect(selected.url).toContain('2024-25-annual-report-final.pdf');
    expect(fiscalYearFromKiamaAnnualReportLink('Annual Report 2024-25')).toBe('2024-25');
    expect(fiscalYearFromKiamaAnnualReportLink('Annual Report 2023-2024')).toBe('2023-24');
  });

  it('rejects a prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `<a href="${FS_2023_HREF}" title="Financial statements 2023-24">Financial statements 2023-24</a>`;
    const links = parseKiamaGpfsFinancialStatementsLinks(priorOnly, KIAMA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectKiamaGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 FS for the FY2024-25 target', () => {
    const futureOnly = `<a href="/files/x/financial-statements-2025-26.pdf" title="Financial statements 2025-26">Financial statements 2025-26</a>`;
    const links = parseKiamaGpfsFinancialStatementsLinks(futureOnly, KIAMA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectKiamaGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official FS pin when the listing yields no usable anchor', async () => {
    expect(
      parseKiamaGpfsFinancialStatementsLinks(
        '<html><body>No document links here</body></html>',
        KIAMA_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = kiamaPinnedDocument();
    expect(pinned.url).toBe(KIAMA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(kiamaAnnualReportPinnedDocument().url).toContain('2024-25-annual-report-final.pdf');
    const discovered = await discoverKiamaGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(KIAMA_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverKiamaGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(KIAMA_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic plain-fetch discovery', async () => {
    expect(KIAMA_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverKiamaGpfsDocument(
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
      discoverKiamaGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });

  it('fetches the FS through the browser/WAF-aware path', async () => {
    const fetched = await fetchKiamaGpfsViaBrowser(KIAMA_GPFS_REPORTING_URL, '2024-25');
    expect(fetched.pdfUrl).toBe(KIAMA_GPFS_DOCUMENT_PIN);
    expect(fetched.listingHtml).toBe(BROWSER_HTML);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
  });
});

describe('Kiama Municipal Council standalone FS GPFS slice', () => {
  it('emits 19 printed statement lines with an explicit discontinued-result bridge', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(19);
    expect(parsed.rejections).toEqual([]);
    expect(KIAMA_GPFS_LINES).toHaveLength(19);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(74_082);
    expect(recon.total_expenses).toBe(74_829);
    expect(recon.employee_expenses).toBe(30_853);
    expect(recon.materials_and_services).toBe(30_044);
    expect(recon.borrowing_costs).toBe(177);
    expect(recon.other_expenses).toBe(1_135);
    expect(recon.net_loss_from_disposal_of_assets).toBe(1_063);
    expect(recon.depreciation_amortisation_impairment).toBe(11_557);
    expect(recon.government_grants_operating).toBe(3_454);
    expect(recon.government_grants_capital).toBe(15_517);
    expect(recon.operating_result_continuing).toBe(-747);
    expect(recon.discontinued_operations_result).toBe(-6_643);
    expect(recon.net_result).toBe(-7_390);
    expect(recon.net_result_before_capital_grants).toBe(-22_907);
    expect(recon.operating_result_excluding_depreciation).toBe(10_810);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(63_272);
    expect(recon.functions_total_income).toBe(74_082);
    expect(recon.functions_total_expenses).toBe(74_829);
    expect(recon.functions_operating_result).toBe(-747);
    expect(recon.functions_grants_and_contributions).toBe(18_971);
    expect(recon.functions_carrying_amount).toBe(716_789);
    expect(recon.comprehensive_total).toBe(16_621);
    expect(recon.total_equity).toBe(624_145);
    expect(recon.cash_net_change).toBe(-1_123);
    expect(recon.checks).toHaveLength(12);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores the negative result rows with a printed-sign marker', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(2_874_100_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(7_408_200_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(7_482_900_000);
    expect(byKey.get('operating_result_continuing')!.amount_cents).toBe(74_700_000);
    expect(byKey.get('operating_result_continuing')!.gpfs_printed_sign).toBe('negative');
    expect(byKey.get('discontinued_operations_result')!.amount_cents).toBe(664_300_000);
    expect(byKey.get('discontinued_operations_result')!.gpfs_printed_sign).toBe('negative');
    expect(byKey.get('net_result')!.amount_cents).toBe(739_000_000);
    expect(byKey.get('net_result')!.gpfs_printed_sign).toBe('negative');
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
  });

  it('parses B1-1 Total functions and activities', () => {
    const totals = parseKiamaGpfsFunctionsTotals({
      page_number: 13,
      text: KIAMA_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 13,
      income: 74_082,
      expenses: 74_829,
      operating_result: -747,
      grants_and_contributions: 18_971,
      carrying_amount: 716_789,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = kiamaExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 4 ? { ...page, text: page.text.replace(/\$ '000/, 'Notes') } : page,
    );
    const parsed = parseKiamaGpfsExtraction(extraction, KIAMA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = kiamaExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 13 ? { ...page, text: page.text.replace("$ '000", '$m') } : page,
    );
    const parsed = parseKiamaGpfsExtraction(extraction, KIAMA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('retains the annual-report-only rejection (0 rows, exact gap)', () => {
    const parsed = parseKiamaAnnualReportExtraction(kiamaAnnualReportExtraction(), KIAMA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toBe(KIAMA_ANNUAL_REPORT_GAP);
    expect(KIAMA_SUMMARY_TEXT).toContain('Consolidated operating results');
    expect(KIAMA_AUTHORISATION_TEXT).toContain('Authorisation and version control');
    expect(KIAMA_CONTENTS_TEXT).toContain('Authorisation and version control');
    expect(parsed.rejections[0]!.reason).toContain('(page 91)');
    expect(parsed.rejections[0]!.reason).not.toContain('(page 3)');
    expect(KIAMA_INCOME_TEXT).not.toBe(KIAMA_SUMMARY_TEXT);
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Kiama Municipal Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = KIAMA_CONTEXT.document.url;
    const revenue = kiamaGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = kiamaGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^kiama-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(kiamaGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(kiamaGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_kiamagpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: KIAMA_GPFS_ID,
    name: KIAMA_GPFS_NAME,
    publisher: KIAMA_GPFS_PUBLISHER,
    source_url: KIAMA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: KIAMA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'kiama-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: {
      lastFetchedAt: null,
      recordsIngested: 0,
      errors: [],
      warnings: [],
    },
  };
}

describe('Kiama Municipal Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-kiama',
        project_name: 'Existing AusTender Kiama contract',
        delivery_entity: 'KIAMA MUNICIPAL COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-kiama-school',
        project_name: 'Existing data.nsw Kiama school row (not a council row)',
        delivery_entity: 'Kiama High School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('adds exactly 19 rows, preserves existing rows, and is idempotent', async () => {
    const { records } = parsedFixture();
    expect(records).toHaveLength(19);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: KIAMA_GPFS_ID })).toBe(19);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: KIAMA_GPFS_ID })).toBe(19);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    const source = await DataSourceModel.findOne({ source_id: KIAMA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(19);
  });
});
