import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WAGGA_WAGGA_GPFS_DOCUMENT_PIN,
  WAGGA_WAGGA_GPFS_FISCAL_YEAR,
  WAGGA_WAGGA_GPFS_ID,
  WAGGA_WAGGA_GPFS_LICENSE,
  WAGGA_WAGGA_GPFS_LINES,
  WAGGA_WAGGA_GPFS_NAME,
  WAGGA_WAGGA_GPFS_PUBLISHER,
  WAGGA_WAGGA_GPFS_REPORTING_URL,
  WAGGA_WAGGA_GPFS_REQUEST_HEADERS,
  WAGGA_WAGGA_GPFS_STANDALONE_FS_BYTES,
  WAGGA_WAGGA_GPFS_STANDALONE_FS_PAGES,
  WAGGA_WAGGA_GPFS_STANDALONE_FS_SHA256,
  discoverWaggaWaggaGpfsDocument,
  fiscalYearFromWaggaWaggaFinancialStatementsLink,
  parseWaggaWaggaFinancialStatementsLinks,
  parseWaggaWaggaGpfsExtraction,
  parseWaggaWaggaGpfsFunctionsTotals,
  selectWaggaWaggaGpfsDocument,
  waggaWaggaGpfsNaturalKey,
  waggaWaggaPinnedDocument,
} from '../src/connectors/wagga-wagga-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  WAGGA_WAGGA_CONTEXT,
  WAGGA_WAGGA_FUNCTIONS_TEXT,
  WAGGA_WAGGA_GPFS_ROW_COUNT,
  WAGGA_WAGGA_INCOME_TEXT,
  waggaWaggaExtraction,
} from '../src/connectors/wagga-wagga-gpfs/fixture.js';

// Wagga Wagga City Council's official Financial Statements page publishes a
// standalone audited "Annual Financial Statements" PDF for each year. The
// FY2025-26 publication is the current standalone audited GPFS (authorised
// 26 October 2026, independent auditor's report dated 27 October 2026) and is
// the source ingested here. Older years are retained so discovery can reject a
// stale or missing target year instead of substituting a prior report.

const FS_2025_HREF =
  '/imagesfiles/documents/the-council/planning-and-reporting/financial-statements/Annual-Financial-Statements-2025-26.pdf';
const FS_2024_HREF =
  '/imagesfiles/documents/the-council/planning-and-reporting/financial-statements/Annual-Financial-Statements-2024-25-Wagga-Wagga-City-Council.pdf';
const FS_2023_HREF =
  '/imagesfiles/documents/the-council/planning-and-reporting/financial-statements/Annual-Financial-Statements-2023-24-Wagga-Wagga-City-Council.pdf';
const FS_2027_HREF =
  '/imagesfiles/documents/the-council/planning-and-reporting/financial-statements/Annual-Financial-Statements-2026-27.pdf';

const LISTING_HTML = `
  <a href="${FS_2025_HREF}" target="_blank">2025-2026 Audited Financial Statements  5.6 MB  Download</a>
  <a href="${FS_2024_HREF}" target="_blank">2024/2025 Audited Financial Statements  5.6 MB  Download</a>
  <a href="${FS_2023_HREF}" target="_blank">2023/2024 Audited Financial Statements  5.7 MB  Download</a>
`;

const { BROWSER_BYTES, BROWSER_HTML } = vi.hoisted(() => {
  const pin =
    'https://wagga.nsw.gov.au/imagesfiles/documents/the-council/planning-and-reporting/financial-statements/Annual-Financial-Statements-2025-26.pdf';
  return {
    BROWSER_HTML: `<a href="${pin}" target="_blank">2025-2026 Audited Financial Statements  5.6 MB  Download</a>`,
    BROWSER_BYTES: Buffer.from('browser-fetched-wagga-wagga-fs-bytes'),
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
      return Buffer.from('browser-fetched-wagga-wagga-fs-bytes').toString('base64');
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

const { fetchWaggaWaggaGpfsViaBrowser } = await import('../../scripts/wagga-wagga-gpfs-browser.js');

function parsedFixture() {
  return parseWaggaWaggaGpfsExtraction(waggaWaggaExtraction(), WAGGA_WAGGA_CONTEXT);
}

describe('Wagga Wagga City Council audited FS discovery', () => {
  it('discovers the FY2025-26 audited financial statements and retains older years', () => {
    expect(WAGGA_WAGGA_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseWaggaWaggaFinancialStatementsLinks(
      LISTING_HTML,
      WAGGA_WAGGA_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    const selected = selectWaggaWaggaGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(new URL(FS_2025_HREF, WAGGA_WAGGA_GPFS_REPORTING_URL).toString());
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(WAGGA_WAGGA_GPFS_REPORTING_URL);
    expect(selected.title).toContain('2025-2026');
    expect(
      fiscalYearFromWaggaWaggaFinancialStatementsLink('2025-2026 Audited Financial Statements'),
    ).toBe('2025-26');
    expect(
      fiscalYearFromWaggaWaggaFinancialStatementsLink('2024/2025 Audited Financial Statements'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromWaggaWaggaFinancialStatementsLink('Long Term Financial Plan 2026-2037.pdf'),
    ).toBeNull();
    expect(WAGGA_WAGGA_GPFS_STANDALONE_FS_BYTES).toBe(5_880_591);
    expect(WAGGA_WAGGA_GPFS_STANDALONE_FS_PAGES).toBe(117);
    expect(WAGGA_WAGGA_GPFS_STANDALONE_FS_SHA256).toBe(
      'c6c8c61dc33bc1524368da75492338d2fbee2629f98ad80986463ebf3b8125eb',
    );
  });

  it('rejects a prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `<a href="${FS_2024_HREF}" target="_blank">2024/2025 Audited Financial Statements</a>`;
    const links = parseWaggaWaggaFinancialStatementsLinks(
      priorOnly,
      WAGGA_WAGGA_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectWaggaWaggaGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 FS for the FY2025-26 target', () => {
    const futureOnly = `<a href="${FS_2027_HREF}" target="_blank">2026/2027 Audited Financial Statements</a>`;
    const links = parseWaggaWaggaFinancialStatementsLinks(
      futureOnly,
      WAGGA_WAGGA_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectWaggaWaggaGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official FS pin when the listing yields no usable anchor', async () => {
    expect(
      parseWaggaWaggaFinancialStatementsLinks(
        '<html><body>No document links here</body></html>',
        WAGGA_WAGGA_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = waggaWaggaPinnedDocument();
    expect(pinned.url).toBe(WAGGA_WAGGA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    const discovered = await discoverWaggaWaggaGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(WAGGA_WAGGA_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the Cloudflare challenge returns a 403', async () => {
    const discovered = await discoverWaggaWaggaGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(WAGGA_WAGGA_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic plain-fetch discovery', async () => {
    expect(WAGGA_WAGGA_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverWaggaWaggaGpfsDocument(
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
      discoverWaggaWaggaGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });

  it('fetches the audited FS through the browser/Cloudflare-aware path', async () => {
    const fetched = await fetchWaggaWaggaGpfsViaBrowser(WAGGA_WAGGA_GPFS_REPORTING_URL, '2025-26');
    expect(fetched.pdfUrl).toBe(WAGGA_WAGGA_GPFS_DOCUMENT_PIN);
    expect(fetched.listingHtml).toBe(BROWSER_HTML);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
  });
});

describe('Wagga Wagga City Council standalone GPFS slice', () => {
  it('emits 17 printed statement lines with exact face and B1-1 reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(WAGGA_WAGGA_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(WAGGA_WAGGA_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(229_411);
    expect(recon.total_expenses).toBe(174_402);
    expect(recon.employee_expenses).toBe(58_498);
    expect(recon.materials_and_services).toBe(50_808);
    expect(recon.borrowing_costs).toBe(2_876);
    expect(recon.other_expenses).toBe(2_521);
    expect(recon.net_loss_from_disposal_of_assets).toBe(5_104);
    expect(recon.depreciation_amortisation_impairment).toBe(54_595);
    expect(recon.government_grants_operating).toBe(22_194);
    expect(recon.government_grants_capital).toBe(60_455);
    expect(recon.net_result).toBe(55_009);
    expect(recon.net_result_before_capital_grants).toBe(-5_446);
    expect(recon.operating_result_excluding_depreciation).toBe(109_604);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(119_807);
    expect(recon.functions_income).toBe(229_411);
    expect(recon.functions_total_expenses).toBe(174_402);
    expect(recon.functions_operating_result).toBe(55_009);
    expect(recon.functions_grants_and_contributions).toBe(82_649);
    expect(recon.functions_carrying_amount).toBe(2_890_454);
    expect(recon.comprehensive_total).toBe(173_729);
    expect(recon.comprehensive_other_income).toBe(118_720);
    expect(recon.comprehensive_revaluation).toBe(118_720);
    expect(recon.total_assets).toBe(2_890_454);
    expect(recon.total_equity).toBe(2_738_581);
    expect(recon.cash_net_change).toBe(32_953);
    expect(recon.cash_opening).toBe(93_747);
    expect(recon.cash_closing).toBe(126_700);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(8_692_900_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(22_941_100_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(17_440_200_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(5_500_900_000);
    expect(byKey.get('net_loss_from_disposal_of_assets')!.gpfs_section).toBe('expenses');
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('government_grants_operating')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(byKey.get('net_loss_from_disposal_of_assets')!.gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
  });

  it('parses B1-1 Total functions and activities on Wagga Wagga’s layout', () => {
    const totals = parseWaggaWaggaGpfsFunctionsTotals({
      page_number: 15,
      text: WAGGA_WAGGA_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 15,
      income: 229_411,
      expenses: 174_402,
      operating_result: 55_009,
      grants_and_contributions: 82_649,
      carrying_amount: 2_890_454,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = waggaWaggaExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 6 ? { ...page, text: page.text.replace(/\$ '000/, 'Notes') } : page,
    );
    const parsed = parseWaggaWaggaGpfsExtraction(extraction, WAGGA_WAGGA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = waggaWaggaExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15 ? { ...page, text: page.text.replace("$ '000", '$m') } : page,
    );
    const parsed = parseWaggaWaggaGpfsExtraction(extraction, WAGGA_WAGGA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = waggaWaggaExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15 ? { ...page, text: page.text.replace('174,402', '174,403') } : page,
    );
    const parsed = parseWaggaWaggaGpfsExtraction(extraction, WAGGA_WAGGA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Wagga Wagga City Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2025-26')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = WAGGA_WAGGA_CONTEXT.document.url;
    const revenue = waggaWaggaGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = waggaWaggaGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^wagga-wagga-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(waggaWaggaGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(waggaWaggaGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });

  it('keeps the fixture text anchored to the printed source lines', () => {
    expect(WAGGA_WAGGA_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(WAGGA_WAGGA_INCOME_TEXT).toContain('Net loss from the disposal of assets');
    expect(WAGGA_WAGGA_GPFS_ID).toBe('wagga-wagga-gpfs');
    expect(WAGGA_WAGGA_GPFS_NAME).toContain('Wagga Wagga');
    expect(WAGGA_WAGGA_GPFS_PUBLISHER).toBe('Wagga Wagga City Council');
    expect(WAGGA_WAGGA_GPFS_LICENSE).toContain('Wagga Wagga City Council');
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_waggawaggagpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: WAGGA_WAGGA_GPFS_ID,
    name: WAGGA_WAGGA_GPFS_NAME,
    publisher: WAGGA_WAGGA_GPFS_PUBLISHER,
    source_url: WAGGA_WAGGA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WAGGA_WAGGA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'wagga-wagga-gpfs-measure', record }));
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

describe('Wagga Wagga City Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-wagga-wagga',
        project_name: 'Existing AusTender Wagga Wagga contract',
        delivery_entity: 'WAGGA WAGGA CITY COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-wagga-wagga-school',
        project_name: 'Existing data.nsw Wagga Wagga school row (not a council row)',
        delivery_entity: 'Wagga Wagga High School',
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
    expect(await MeasureModel.countDocuments({ source_id: WAGGA_WAGGA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: WAGGA_WAGGA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: WAGGA_WAGGA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
