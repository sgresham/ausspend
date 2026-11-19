import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  LISMORE_ANNUAL_REPORT_GAP,
  LISMORE_GPFS_DOCUMENT_PIN,
  LISMORE_GPFS_FISCAL_YEAR,
  LISMORE_GPFS_ID,
  LISMORE_GPFS_LICENSE,
  LISMORE_GPFS_LINES,
  LISMORE_GPFS_NAME,
  LISMORE_GPFS_PUBLISHER,
  LISMORE_GPFS_REPORTING_URL,
  LISMORE_GPFS_REQUEST_HEADERS,
  LISMORE_GPFS_STANDALONE_FS_BYTES,
  LISMORE_GPFS_STANDALONE_FS_PAGES,
  LISMORE_GPFS_STANDALONE_FS_SHA256,
  discoverLismoreGpfsDocument,
  fiscalYearFromLismoreAnnualReportLink,
  lismoreAnnualReportPinnedDocument,
  lismoreGpfsNaturalKey,
  lismorePinnedDocument,
  parseLismoreAnnualReportExtraction,
  parseLismoreAnnualReportLinks,
  parseLismoreGpfsExtraction,
  parseLismoreGpfsFinancialReportsLinks,
  parseLismoreGpfsFunctionsTotals,
  selectLismoreAnnualReportDocument,
  selectLismoreGpfsDocument,
} from '../src/connectors/lismore-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  LISMORE_AR_BACK_COVER_TEXT,
  LISMORE_AR_CLAIM_TEXT,
  LISMORE_AR_CONTENTS_TEXT,
  LISMORE_CONTEXT,
  LISMORE_FUNCTIONS_TEXT,
  LISMORE_INCOME_TEXT,
  lismoreAnnualReportExtraction,
  lismoreExtraction,
} from '../src/connectors/lismore-gpfs/fixture.js';

// Lismore City Council's FY2024-25 annual report is narrative/statutory-
// information only, but the official Annual and Financial Reports page publishes
// a separate signed FY2024-25 Financial reports PDF with the audit opinion. The
// connector discovers/archives that FS through the browser/WAF-aware path and
// emits the printed statement slice. The annual-report-only rejection is
// retained.

const FS_2024_HREF =
  '/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/annual_financial_statements-2025-signed-27-nov-25.pdf';
const FS_2023_HREF =
  '/files/assets/public/v/2/5.-council/7.-about-council/6.-corporate-information/annual_financial_statements-2024.pdf';
const AR_2024_HREF =
  '/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/lcc-annual-report-2024-25-a4.pdf';

const LISTING_HTML = `
  <a href="${AR_2024_HREF}" title="Annual Report 2024/25" target="_blank" class="document ext-pdf">Annual Report 2024/25<span class="file-info">(PDF,&nbsp;10MB)</span></a>
  <a href="/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/ed25-81999-2024-2025-attestation-signed.pdf" title="Appendix 1 - Signed Attestation 2024-2025">Appendix 1 - Signed Attestation 2024-2025</a>
  <a href="${FS_2024_HREF}" title="Financial reports 2024/25" target="_blank" class="document ext-pdf">Financial reports 2024/25<span class="file-info">(PDF,&nbsp;3MB)</span></a>
  <a href="${FS_2023_HREF}" title="Financial reports 2023/24" target="_blank" class="document ext-pdf">Financial reports 2023/24</a>
  <a href="/files/assets/public/v/1/5.-council/6.-corporate-information/long-term-financial-plan-2026-2036.pdf" title="Long Term Financial Plan 2026-2037">Long Term Financial Plan 2026-2037</a>
`;

const { BROWSER_BYTES, BROWSER_HTML } = vi.hoisted(() => {
  const pin =
    'https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/annual_financial_statements-2025-signed-27-nov-25.pdf';
  return {
    BROWSER_HTML: `<a href="${pin}" title="Financial reports 2024/25">Financial reports 2024/25</a>`,
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

const { fetchLismoreGpfsViaBrowser } = await import('../../scripts/lismore-gpfs-browser.js');

function parsedFixture() {
  return parseLismoreGpfsExtraction(lismoreExtraction(), LISMORE_CONTEXT);
}

describe('Lismore City Council standalone FS discovery', () => {
  it('discovers the FY2024-25 signed FS and never selects the annual report', () => {
    expect(LISMORE_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseLismoreGpfsFinancialReportsLinks(LISTING_HTML, LISMORE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.some((link) => link.url.includes('annual-report'))).toBe(false);
    const selected = selectLismoreGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(new URL(FS_2024_HREF, LISMORE_GPFS_REPORTING_URL).toString());
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(LISMORE_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Financial reports 2024/25');
    expect(fiscalYearFromLismoreAnnualReportLink('Financial reports 2024/25')).toBe('2024-25');
    expect(fiscalYearFromLismoreAnnualReportLink('Financial reports 2023/24')).toBe('2023-24');
    expect(
      fiscalYearFromLismoreAnnualReportLink('Long Term Financial Plan 2026-2037.pdf'),
    ).toBeNull();
    expect(LISMORE_GPFS_STANDALONE_FS_BYTES).toBe(3_269_117);
    expect(LISMORE_GPFS_STANDALONE_FS_PAGES).toBe(104);
    expect(LISMORE_GPFS_STANDALONE_FS_SHA256).toBe(
      'e4816b7149d268099bbb931fcf0a3b34b03ab0e4b28663aba18039cdf0da9797',
    );
  });

  it('retains annual-report discovery and excludes the separate FS', () => {
    const annualReports = parseLismoreAnnualReportLinks(LISTING_HTML, LISMORE_GPFS_REPORTING_URL);
    expect(annualReports.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    const selected = selectLismoreAnnualReportDocument(annualReports, '2024-25');
    expect(selected.url).toContain('lcc-annual-report-2024-25-a4.pdf');
    expect(lismoreAnnualReportPinnedDocument().url).toContain('annual-report');
    expect(fiscalYearFromLismoreAnnualReportLink('Annual Report 2024/25')).toBe('2024-25');
    expect(fiscalYearFromLismoreAnnualReportLink('Annual Report 2023/24')).toBe('2023-24');
  });

  it('rejects a prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `<a href="${FS_2023_HREF}" title="Financial reports 2023/24">Financial reports 2023/24</a>`;
    const links = parseLismoreGpfsFinancialReportsLinks(priorOnly, LISMORE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectLismoreGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 FS for the FY2024-25 target', () => {
    const futureOnly = `<a href="/files/x/financial-reports-2025-26.pdf" title="Financial reports 2025/26">Financial reports 2025/26</a>`;
    const links = parseLismoreGpfsFinancialReportsLinks(futureOnly, LISMORE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectLismoreGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official FS pin when the listing yields no usable anchor', async () => {
    expect(
      parseLismoreGpfsFinancialReportsLinks(
        '<html><body>No document links here</body></html>',
        LISMORE_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = lismorePinnedDocument();
    expect(pinned.url).toBe(LISMORE_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    const discovered = await discoverLismoreGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(LISMORE_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverLismoreGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(LISMORE_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic plain-fetch discovery', async () => {
    expect(LISMORE_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverLismoreGpfsDocument(
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
      discoverLismoreGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });

  it('fetches the FS through the browser/WAF-aware path', async () => {
    const fetched = await fetchLismoreGpfsViaBrowser(LISMORE_GPFS_REPORTING_URL, '2024-25');
    expect(fetched.pdfUrl).toBe(LISMORE_GPFS_DOCUMENT_PIN);
    expect(fetched.listingHtml).toBe(BROWSER_HTML);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
  });
});

describe('Lismore City Council standalone FS GPFS slice', () => {
  it('emits 17 printed statement lines with an exact B1-1 own-source/grants bridge', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(LISMORE_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(273_175);
    expect(recon.total_expenses).toBe(154_056);
    expect(recon.employee_expenses).toBe(49_208);
    expect(recon.materials_and_services).toBe(56_842);
    expect(recon.borrowing_costs).toBe(2_813);
    expect(recon.other_expenses).toBe(4_188);
    expect(recon.net_loss_from_disposal_of_assets).toBe(3_617);
    expect(recon.depreciation_amortisation_impairment).toBe(37_388);
    expect(recon.government_grants_operating).toBe(24_115);
    expect(recon.government_grants_capital).toBe(137_591);
    expect(recon.net_share_joint_ventures).toBe(162);
    expect(recon.net_result).toBe(119_119);
    expect(recon.net_result_before_capital_grants).toBe(-18_472);
    expect(recon.operating_result_excluding_depreciation).toBe(156_507);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(116_668);
    expect(recon.functions_income_excluding_grants).toBe(111_469);
    expect(recon.functions_total_expenses).toBe(154_056);
    expect(recon.functions_operating_result).toBe(-42_587);
    expect(recon.functions_grants_and_contributions).toBe(161_706);
    expect(recon.functions_carrying_amount).toBe(2_447_945);
    expect(recon.comprehensive_total).toBe(167_574);
    expect(recon.comprehensive_other_income).toBe(48_455);
    expect(recon.comprehensive_impairment_reversal).toBe(-1_378);
    expect(recon.total_equity).toBe(2_255_367);
    expect(recon.cash_net_change).toBe(23_511);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(6_695_300_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(27_317_500_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(15_405_600_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(11_911_900_000);
    expect(byKey.get('net_share_joint_ventures')!.amount_cents).toBe(16_200_000);
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
  });

  it('parses B1-1 Total functions and activities on Lismore’s layout', () => {
    const totals = parseLismoreGpfsFunctionsTotals({
      page_number: 15,
      text: LISMORE_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 15,
      income: 111_469,
      expenses: 154_056,
      operating_result: -42_587,
      grants_and_contributions: 161_706,
      carrying_amount: 2_447_945,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = lismoreExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 5 ? { ...page, text: page.text.replace(/\$ '000/, 'Notes') } : page,
    );
    const parsed = parseLismoreGpfsExtraction(extraction, LISMORE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = lismoreExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15 ? { ...page, text: page.text.replace("$ '000", '$m') } : page,
    );
    const parsed = parseLismoreGpfsExtraction(extraction, LISMORE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('retains the annual-report-only rejection (0 rows, exact gap)', () => {
    const parsed = parseLismoreAnnualReportExtraction(
      lismoreAnnualReportExtraction(),
      LISMORE_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toBe(LISMORE_ANNUAL_REPORT_GAP);
    expect(LISMORE_AR_CONTENTS_TEXT).toContain('Statutory Information');
    expect(LISMORE_AR_CLAIM_TEXT).toContain('must also contain');
    expect(LISMORE_AR_BACK_COVER_TEXT).toContain('lismorecitycouncil.nsw.gov.au');
    expect(LISMORE_INCOME_TEXT).not.toBe(LISMORE_AR_CLAIM_TEXT);
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Lismore City Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = LISMORE_CONTEXT.document.url;
    const revenue = lismoreGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = lismoreGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^lismore-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(lismoreGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(lismoreGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_lismoregpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: LISMORE_GPFS_ID,
    name: LISMORE_GPFS_NAME,
    publisher: LISMORE_GPFS_PUBLISHER,
    source_url: LISMORE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LISMORE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'lismore-gpfs-measure', record }));
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

describe('Lismore City Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-lismore',
        project_name: 'Existing AusTender Lismore contract',
        delivery_entity: 'LISMORE CITY COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-lismore-school',
        project_name: 'Existing data.nsw Lismore school row (not a council row)',
        delivery_entity: 'Lismore High School',
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
    expect(await MeasureModel.countDocuments({ source_id: LISMORE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: LISMORE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: LISMORE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
