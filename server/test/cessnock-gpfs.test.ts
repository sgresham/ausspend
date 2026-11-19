import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  CESSNOCK_ANNUAL_REPORT_GAP,
  CESSNOCK_GPFS_AFS_PAGE_URL,
  CESSNOCK_GPFS_DOCUMENT_PIN,
  CESSNOCK_GPFS_FISCAL_YEAR,
  CESSNOCK_GPFS_ID,
  CESSNOCK_GPFS_LICENSE,
  CESSNOCK_GPFS_LINES,
  CESSNOCK_GPFS_NAME,
  CESSNOCK_GPFS_PUBLISHER,
  CESSNOCK_GPFS_REPORTING_URL,
  CESSNOCK_GPFS_REQUEST_HEADERS,
  cessnockGpfsNaturalKey,
  cessnockPinnedDocument,
  discoverCessnockGpfsDocument,
  fiscalYearFromCessnockFinancialStatementsLink,
  parseCessnockAnnualReportExtraction,
  parseCessnockGpfsExtraction,
  parseCessnockGpfsFunctionsTotals,
  parseCessnockGpfsReportLinks,
  selectCessnockGpfsDocument,
} from '../src/connectors/cessnock-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  CESSNOCK_ATTESTATION_TEXT,
  CESSNOCK_CONTEXT,
  CESSNOCK_FUNCTIONS_TEXT,
  CESSNOCK_INCOME_TEXT,
  CESSNOCK_SUMMARY_TEXT,
  cessnockAnnualReportExtraction,
  cessnockExtraction,
} from '../src/connectors/cessnock-gpfs/fixture.js';

// Cessnock City Council's FY2024-25 annual report is narrative-only, but the
// official Annual Financial Statements page publishes a separate standalone
// FY2024-25 AFS with the audit opinion. The connector discovers/archives that
// AFS through the browser/WAF-aware path and emits the printed statement slice.
// The annual-report-only rejection is retained.

const AFS_2026_URL =
  'https://www.cessnock.nsw.gov.au/files/assets/public/v/1/hptrim/website-finance-budget-documents-do-not-change/annual_financial_statements-2026-final-with-audit-option.pdf';
const AFS_2024_URL =
  'https://www.cessnock.nsw.gov.au/files/assets/public/v/1/hptrim/website-finance-budget-documents-do-not-change/annual_financial_statements-2024-final-with-audit-opinion-_-website-doc.pdf';
const AFS_2023_URL =
  'https://www.cessnock.nsw.gov.au/files/assets/public/v/1/hptrim/website-finance-budget-documents-do-not-change/financial-statements-_-audited-financial-statements-30-june-2023-_-website-doc.pdf';

const AFS_PAGE_HTML = `
  <h1 class='oc-page-title '>Annual Financial Statements</h1>
  <ul class="related-information-list">
    <li><a href="${AFS_2026_URL}" title="Annual Financial Statements for the Year Ended 30 June 2026">Annual Financial Statements for the Year Ended 30 June&nbsp;2026(PDF,&nbsp;7MB)</a></li>
    <li><a href="${CESSNOCK_GPFS_DOCUMENT_PIN}" title="Annual Financial Statements for the Year Ended 30 June 2025">Annual Financial Statements for the Year Ended 30 June&nbsp;2025(PDF,&nbsp;8MB)</a></li>
    <li><a href="${AFS_2024_URL}" title="Annual Financial Statements for the Year Ended 30 June 2024">Annual Financial Statements for the Year Ended 30 June&nbsp;2024(PDF,&nbsp;5MB)</a></li>
    <li><a href="${AFS_2023_URL}" title="Annual Financial Statements for the Year Ended 30 June 2023">Annual Financial Statements for the Year Ended 30 June&nbsp;2023(PDF,&nbsp;5MB)</a></li>
  </ul>
`;

const { BROWSER_BYTES, BROWSER_HTML } = vi.hoisted(() => {
  const pin =
    'https://www.cessnock.nsw.gov.au/files/assets/public/v/2/hptrim/website-finance-budget-documents-do-not-change/ccc-_-annual_financial_statements-2024-2025-final-with-audit-opinion.pdf';
  return {
    BROWSER_HTML: `<a href="${pin}" title="Annual Financial Statements for the Year Ended 30 June 2025">Annual Financial Statements for the Year Ended 30 June 2025</a>`,
    BROWSER_BYTES: Buffer.from('browser-fetched-pdf-bytes'),
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
      return Buffer.from('browser-fetched-pdf-bytes').toString('base64');
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

const { fetchCessnockGpfsViaBrowser } = await import('../../scripts/cessnock-gpfs-browser.js');

function parsedFixture() {
  return parseCessnockGpfsExtraction(cessnockExtraction(), CESSNOCK_CONTEXT);
}

describe('Cessnock City Council standalone AFS discovery', () => {
  it('discovers the latest FY2024-25 AFS and never selects the newer 2025-26 report', () => {
    expect(CESSNOCK_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseCessnockGpfsReportLinks(AFS_PAGE_HTML, CESSNOCK_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual([
      '2025-26',
      '2024-25',
      '2023-24',
      '2022-23',
    ]);
    const selected = selectCessnockGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(CESSNOCK_GPFS_DOCUMENT_PIN);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(CESSNOCK_GPFS_REPORTING_URL);
    expect(selected.title).toContain('30 June 2025');
    expect(
      fiscalYearFromCessnockFinancialStatementsLink(
        'Annual Financial Statements for the Year Ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromCessnockFinancialStatementsLink(
        'Annual Financial Statements for the Year Ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromCessnockFinancialStatementsLink('Long Term Financial Plan 2023-2033.pdf'),
    ).toBeNull();
  });

  it('does not treat the Annual Report page pointer as the AFS document', () => {
    const annualReportHtml = `
      <p>The Annual Financial Statements for the Year Ended 30 June 2025
        <a href="${CESSNOCK_GPFS_AFS_PAGE_URL}" target="_blank">can be viewed here</a>.</p>
      <a href="/files/x/2025_annual-report-cessnock-city-council_2024-2025_spread.pdf" title="Annual Report 2024-2025">Annual Report 2024-2025</a>
    `;
    expect(parseCessnockGpfsReportLinks(annualReportHtml, CESSNOCK_GPFS_REPORTING_URL)).toEqual([]);
    expect(CESSNOCK_GPFS_AFS_PAGE_URL).toBe(CESSNOCK_GPFS_REPORTING_URL);
  });

  it('rejects a prior year and never substitutes a 2023-24 AFS for the target 2024-25', () => {
    const priorOnly = `<a href="${AFS_2023_URL}" title="Annual Financial Statements for the Year Ended 30 June 2023">Annual Financial Statements for the Year Ended 30 June 2023</a>`;
    const links = parseCessnockGpfsReportLinks(priorOnly, CESSNOCK_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2022-23']);
    expect(() => selectCessnockGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 AFS for the FY2024-25 target', () => {
    const futureOnly = `<a href="${AFS_2026_URL}" title="Annual Financial Statements for the Year Ended 30 June 2026">Annual Financial Statements for the Year Ended 30 June 2026</a>`;
    const links = parseCessnockGpfsReportLinks(futureOnly, CESSNOCK_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectCessnockGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    expect(
      parseCessnockGpfsReportLinks(
        '<html><body>No document links here</body></html>',
        CESSNOCK_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = cessnockPinnedDocument();
    expect(pinned.url).toBe(CESSNOCK_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    const discovered = await discoverCessnockGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(CESSNOCK_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverCessnockGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(CESSNOCK_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic plain-fetch discovery', async () => {
    expect(CESSNOCK_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverCessnockGpfsDocument(
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
      discoverCessnockGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });

  it('fetches the AFS through the browser/WAF-aware path', async () => {
    const fetched = await fetchCessnockGpfsViaBrowser(CESSNOCK_GPFS_REPORTING_URL, '2024-25');
    expect(fetched.pdfUrl).toBe(CESSNOCK_GPFS_DOCUMENT_PIN);
    expect(fetched.listingHtml).toBe(BROWSER_HTML);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
  });
});

describe('Cessnock City Council standalone AFS GPFS slice', () => {
  it('emits 17 printed statement lines and a full exact reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(CESSNOCK_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(176_621);
    expect(recon.total_expenses).toBe(138_475);
    expect(recon.employee_expenses).toBe(49_318);
    expect(recon.materials_and_services).toBe(37_269);
    expect(recon.borrowing_costs).toBe(922);
    expect(recon.other_expenses).toBe(7_359);
    expect(recon.net_loss_from_disposal_of_assets).toBe(17_405);
    expect(recon.depreciation_amortisation_impairment).toBe(26_202);
    expect(recon.government_grants_operating).toBe(15_706);
    expect(recon.government_grants_capital).toBe(71_924);
    expect(recon.net_result).toBe(38_146);
    expect(recon.net_result_before_capital_grants).toBe(-33_778);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(112_273);
    expect(recon.functions_total_income).toBe(176_621);
    expect(recon.functions_total_expenses).toBe(138_475);
    expect(recon.functions_operating_result).toBe(38_146);
    expect(recon.functions_grants_and_contributions).toBe(87_630);
    expect(recon.functions_carrying_amount).toBe(1_683_382);
    expect(recon.comprehensive_total).toBe(260_245);
    expect(recon.total_equity).toBe(1_572_193);
    expect(recon.cash_net_change).toBe(15_232);
    expect(recon.checks).toHaveLength(10);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(7_119_300_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(17_662_100_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(13_847_500_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(3_814_600_000);
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
  });

  it('parses B1-1 Total functions and activities', () => {
    const totals = parseCessnockGpfsFunctionsTotals({
      page_number: 17,
      text: CESSNOCK_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 17,
      income: 176_621,
      expenses: 138_475,
      operating_result: 38_146,
      grants_and_contributions: 87_630,
      carrying_amount: 1_683_382,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = cessnockExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 8 ? { ...page, text: page.text.replace(/\$ '000/, 'Notes') } : page,
    );
    const parsed = parseCessnockGpfsExtraction(extraction, CESSNOCK_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = cessnockExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 17 ? { ...page, text: page.text.replace("$ '000", '$m') } : page,
    );
    const parsed = parseCessnockGpfsExtraction(extraction, CESSNOCK_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('retains the annual-report-only rejection (0 rows, exact gap)', () => {
    const parsed = parseCessnockAnnualReportExtraction(
      cessnockAnnualReportExtraction(),
      CESSNOCK_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toBe(CESSNOCK_ANNUAL_REPORT_GAP);
    expect(CESSNOCK_SUMMARY_TEXT).toContain('Financial summary');
    expect(CESSNOCK_ATTESTATION_TEXT).toContain('ATTESTATION STATEMENT');
    expect(CESSNOCK_INCOME_TEXT).not.toBe(CESSNOCK_SUMMARY_TEXT);
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Cessnock City Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = CESSNOCK_CONTEXT.document.url;
    const revenue = cessnockGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = cessnockGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^cessnock-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(cessnockGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(cessnockGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_cessnockgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CESSNOCK_GPFS_ID,
    name: CESSNOCK_GPFS_NAME,
    publisher: CESSNOCK_GPFS_PUBLISHER,
    source_url: CESSNOCK_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CESSNOCK_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'cessnock-gpfs-measure', record }));
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

describe('Cessnock City Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-cessnock',
        project_name: 'Existing AusTender Cessnock contract',
        delivery_entity: 'CESSNOCK CITY COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-cessnock-school',
        project_name: 'Existing data.nsw Cessnock school row (not a council row)',
        delivery_entity: 'Cessnock High School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('adds exactly 17 rows, preserves existing rows, and is idempotent', async () => {
    const { records } = parsedFixture();
    expect(records).toHaveLength(17);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: CESSNOCK_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: CESSNOCK_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: CESSNOCK_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
