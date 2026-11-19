import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  HAY_GPFS_DOCUMENT_PIN,
  HAY_GPFS_FISCAL_YEAR,
  HAY_GPFS_ID,
  HAY_GPFS_LICENSE,
  HAY_GPFS_LINES,
  HAY_GPFS_NAME,
  HAY_GPFS_PUBLISHER,
  HAY_GPFS_REPORTING_URL,
  HAY_GPFS_REQUEST_HEADERS,
  HAY_GPFS_STANDALONE_FS_BYTES,
  HAY_GPFS_STANDALONE_FS_PAGES,
  HAY_GPFS_STANDALONE_FS_SHA256,
  discoverHayGpfsDocument,
  fiscalYearFromHayFinancialStatementsLink,
  parseHayFinancialStatementsLinks,
  parseHayGpfsExtraction,
  parseHayGpfsFunctionsTotals,
  selectHayGpfsDocument,
  hayGpfsNaturalKey,
  hayPinnedDocument,
} from '../src/connectors/hay-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  HAY_CONTEXT,
  HAY_FUNCTIONS_TEXT,
  HAY_GPFS_GOLDEN_DIGEST,
  HAY_GPFS_ROW_COUNT,
  HAY_INCOME_TEXT,
  hayExtraction,
} from '../src/connectors/hay-gpfs/fixture.js';

// Hay Shire Council's official combined "Council Meetings and Reports" feed
// publishes a standalone "ANNUAL FINANCIAL STATEMENTS for the year ended 30 June
// 2026" PDF. That FY2025-26 GPFS is the latest published GPFS and is the source
// ingested here. The prior FY2024-25 FS remains in the same feed so discovery
// can reject a stale or missing target year instead of substituting a prior
// report.

const FS_2026_HREF = '/Portals/0/Files/Annual_Financial_Statements-2026.pdf';
const FS_2025_HREF =
  '/Portals/0/CouncilReports/HSC Annual Financial Statements 2025.pdf';
const FS_2027_HREF = '/Portals/0/Files/Annual_Financial_Statements-2027.pdf';

const LISTING_HTML = `
  <a href="${FS_2026_HREF}" class="text-dark" target="_blank">Hay Shire Council ANNUAL FINANCIAL STATEMENTS for the year ended 30 June 2026</a>
  <a href="${FS_2025_HREF}" class="text-dark" target="_blank">HSC Annual Financial Statements 2025</a>
`;

const { BROWSER_BYTES, BROWSER_HTML, PLAIN_BYTES } = vi.hoisted(() => {
  return {
    BROWSER_HTML: `<a href="/Portals/0/Files/Annual_Financial_Statements-2026.pdf">Hay Shire Council ANNUAL FINANCIAL STATEMENTS for the year ended 30 June 2026</a>`,
    BROWSER_BYTES: Buffer.from('browser-fetched-hay-fs-bytes'),
    PLAIN_BYTES: Buffer.from('plain-fetched-hay-fs-bytes'),
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
      return Buffer.from('browser-fetched-hay-fs-bytes').toString('base64');
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

const { fetchHayGpfsViaBrowser } = await import('../../scripts/hay-gpfs-browser.js');

function parsedFixture() {
  return parseHayGpfsExtraction(hayExtraction(), HAY_CONTEXT);
}

describe('Hay Shire Council audited FS discovery', () => {
  it('discovers the FY2025-26 annual financial statements and retains older years', () => {
    expect(HAY_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseHayFinancialStatementsLinks(LISTING_HTML, HAY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    const older = `${LISTING_HTML}<a href="${FS_2025_HREF}">Annual Financial Statements for the year ended 30 June 2025</a>`;
    expect(
      parseHayFinancialStatementsLinks(older, HAY_GPFS_REPORTING_URL).map(
        (link) => link.fiscal_year,
      ),
    ).toEqual(['2025-26', '2024-25']);
    const selected = selectHayGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(new URL(FS_2026_HREF, HAY_GPFS_REPORTING_URL).toString());
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(HAY_GPFS_REPORTING_URL);
    expect(selected.title).toContain('2026');
    expect(
      fiscalYearFromHayFinancialStatementsLink(
        'Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromHayFinancialStatementsLink('Annual Financial Statements 2025-2026')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromHayFinancialStatementsLink('Annual Financial Statements 2025')).toBeNull();
    expect(
      fiscalYearFromHayFinancialStatementsLink('Long Term Financial Plan 2026-2036.pdf'),
    ).toBeNull();
    expect(HAY_GPFS_STANDALONE_FS_BYTES).toBe(1_345_435);
    expect(HAY_GPFS_STANDALONE_FS_PAGES).toBe(80);
    expect(HAY_GPFS_STANDALONE_FS_SHA256).toBe(
      '710fce7da5e69d93cc30fc943e122c8a20b28d840f9726cfb90aa926cc7a75ce',
    );
  });

  it('rejects a prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `<a href="${FS_2025_HREF}">Annual Financial Statements for the year ended 30 June 2025</a>`;
    const links = parseHayFinancialStatementsLinks(priorOnly, HAY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectHayGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a future 2026-27 FS for the FY2025-26 target', () => {
    const futureOnly = `<a href="${FS_2027_HREF}">Annual Financial Statements for the year ended 30 June 2027</a>`;
    const links = parseHayFinancialStatementsLinks(futureOnly, HAY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectHayGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('ignores the narrative annual report and bare-year FS links without a year-ended range', () => {
    const html = `
      <a href="/Portals/0/Annual Reports 24-25.pdf">Annual Reports 2024-2025</a>
      <a href="/Portals/0/CouncilReports/Annual Report 2023-2024 including financials.pdf">Annual Report 2023-2024 including financials</a>
      <a href="/Portals/0/Annual Financial Statements 2025.pdf">Annual Financial Statements 2025</a>
    `;
    expect(parseHayFinancialStatementsLinks(html, HAY_GPFS_REPORTING_URL)).toEqual([]);
  });

  it('uses the documented official FS pin when the listing yields no usable anchor', async () => {
    expect(
      parseHayFinancialStatementsLinks(
        '<html><body>No document links here</body></html>',
        HAY_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = hayPinnedDocument();
    expect(pinned.url).toBe(HAY_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    const discovered = await discoverHayGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(HAY_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the listing requests return a 403', async () => {
    const discovered = await discoverHayGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(HAY_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery', async () => {
    expect(HAY_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverHayGpfsDocument(
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
      discoverHayGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });

  it('fetches the annual financial statements through the browser path', async () => {
    const fetched = await fetchHayGpfsViaBrowser(HAY_GPFS_REPORTING_URL, '2025-26');
    expect(fetched.pdfUrl).toBe(HAY_GPFS_DOCUMENT_PIN);
    expect(fetched.listingHtml).toBe(BROWSER_HTML);
    expect(fetched.viaBrowser).toBe(true);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
  });

  it('falls back to the plain client when the browser path is refused', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      if (String(input) === HAY_GPFS_REPORTING_URL) {
        return new Response(LISTING_HTML, { status: 200 });
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchHayGpfsViaBrowser(HAY_GPFS_REPORTING_URL, '2025-26', {
      forcePlain: true,
      fetchImpl,
    });
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(new URL(FS_2026_HREF, HAY_GPFS_REPORTING_URL).toString());
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('Hay Shire Council standalone GPFS slice', () => {
  it('emits 17 printed statement lines with exact face, B1-1 and balance-sheet reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(HAY_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(HAY_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(24_591);
    expect(recon.total_expenses).toBe(19_283);
    expect(recon.employee_expenses).toBe(7_090);
    expect(recon.materials_and_services).toBe(6_433);
    expect(recon.borrowing_costs).toBe(62);
    expect(recon.other_expenses).toBe(296);
    expect(recon.net_loss_from_disposal_of_assets).toBe(91);
    expect(recon.depreciation_amortisation_impairment).toBe(5_311);
    expect(recon.government_grants_operating).toBe(9_803);
    expect(recon.government_grants_capital).toBe(6_568);
    expect(recon.net_result).toBe(5_308);
    expect(recon.net_result_before_capital_grants).toBe(-1_260);
    expect(recon.operating_result_excluding_depreciation).toBe(10_619);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(13_972);
    expect(recon.functions_income).toBe(24_591);
    expect(recon.functions_total_expenses).toBe(19_283);
    expect(recon.functions_operating_result).toBe(5_308);
    expect(recon.functions_grants_and_contributions).toBe(16_371);
    expect(recon.functions_carrying_amount).toBe(292_009);
    expect(recon.comprehensive_total).toBe(19_087);
    expect(recon.comprehensive_other_income).toBe(13_779);
    expect(recon.comprehensive_revaluation).toBe(13_779);
    expect(recon.comprehensive_attributable_council).toBe(19_087);
    expect(recon.total_assets).toBe(292_009);
    expect(recon.total_liabilities).toBe(5_602);
    expect(recon.net_assets).toBe(286_407);
    expect(recon.total_equity).toBe(286_407);
    expect(recon.cash_operating).toBe(9_099);
    expect(recon.cash_investing).toBe(-9_963);
    expect(recon.cash_financing).toBe(-273);
    expect(recon.cash_net_change).toBe(-1_137);
    expect(recon.cash_opening).toBe(21_521);
    expect(recon.cash_closing).toBe(20_384);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(570_300_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(2_459_100_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(1_928_300_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(530_800_000);
    expect(byKey.get('net_loss_from_disposal_of_assets')!.gpfs_section).toBe('expenses');
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('government_grants_operating')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(byKey.get('net_loss_from_disposal_of_assets')!.gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(byKey.get('net_result')!.notes).toContain('unit: thousands (explicit');
    expect(byKey.get('net_result')!.source_dataset).toBe('Hay Shire Council GPFS 2025-26');
  });

  it('parses B1-1 Total functions and activities on Hay’s layout', () => {
    const totals = parseHayGpfsFunctionsTotals({
      page_number: 14,
      text: HAY_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 14,
      income: 24_591,
      expenses: 19_283,
      operating_result: 5_308,
      grants_and_contributions: 16_371,
      carrying_amount: 292_009,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = hayExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 5 ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') } : page,
    );
    const parsed = parseHayGpfsExtraction(extraction, HAY_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = hayExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 14 ? { ...page, text: page.text.replace(/\$ '000/g, '$m') } : page,
    );
    const parsed = parseHayGpfsExtraction(extraction, HAY_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = hayExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 14 ? { ...page, text: page.text.replace('19,283', '19,284') } : page,
    );
    const parsed = parseHayGpfsExtraction(extraction, HAY_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Hay Shire Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2025-26')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = HAY_CONTEXT.document.url;
    const revenue = hayGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = hayGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^hay-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(hayGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(hayGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });

  it('keeps the fixture text anchored to the printed source lines and golden digest', () => {
    expect(HAY_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(HAY_INCOME_TEXT).toContain('Net loss from the disposal of assets');
    expect(HAY_INCOME_TEXT).toContain('(1,260)');
    expect(HAY_GPFS_ID).toBe('hay-gpfs');
    expect(HAY_GPFS_NAME).toContain('Hay');
    expect(HAY_GPFS_PUBLISHER).toBe('Hay Shire Council');
    expect(HAY_GPFS_LICENSE).toContain('Hay Shire Council');
    expect(HAY_GPFS_REPORTING_URL).toContain('Council-Meetings-and-Reports');
    expect(HAY_GPFS_GOLDEN_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_haygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: HAY_GPFS_ID,
    name: HAY_GPFS_NAME,
    publisher: HAY_GPFS_PUBLISHER,
    source_url: HAY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: HAY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'hay-gpfs-measure', record }));
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

describe('Hay Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-hay',
        project_name: 'Existing AusTender Hay contract',
        delivery_entity: 'HAY SHIRE COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-hay-school',
        project_name: 'Existing data.nsw Hay school row (not a council row)',
        delivery_entity: 'Hay Public School',
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
    expect(await MeasureModel.countDocuments({ source_id: HAY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: HAY_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: HAY_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
