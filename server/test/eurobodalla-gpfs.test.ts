import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  EUROBODALLA_GPFS_DOCUMENT_PIN,
  EUROBODALLA_GPFS_FISCAL_YEAR,
  EUROBODALLA_GPFS_ID,
  EUROBODALLA_GPFS_LICENSE,
  EUROBODALLA_GPFS_LINES,
  EUROBODALLA_GPFS_NAME,
  EUROBODALLA_GPFS_PUBLISHER,
  EUROBODALLA_GPFS_REPORTING_URL,
  EUROBODALLA_GPFS_REQUEST_HEADERS,
  EUROBODALLA_GPFS_STANDALONE_FS_BYTES,
  EUROBODALLA_GPFS_STANDALONE_FS_PAGES,
  EUROBODALLA_GPFS_STANDALONE_FS_SHA256,
  discoverEurobodallaGpfsDocument,
  eurobodallaPinnedDocument,
  fiscalYearFromEurobodallaFinancialStatementsLink,
  parseEurobodallaFinancialStatementsLinks,
  parseEurobodallaGpfsExtraction,
  parseEurobodallaGpfsFunctionsTotals,
  selectEurobodallaGpfsDocument,
  eurobodallaGpfsNaturalKey,
} from '../src/connectors/eurobodalla-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  EUROBODALLA_CONTEXT,
  EUROBODALLA_FUNCTIONS_TEXT,
  EUROBODALLA_GPFS_ROW_COUNT,
  EUROBODALLA_INCOME_TEXT,
  eurobodallaExtraction,
} from '../src/connectors/eurobodalla-gpfs/fixture.js';

// Eurobodalla Shire Council's official Financial Statements page publishes a
// standalone audited "Annual Financial Statements" PDF for each year. The
// FY2025-26 publication is the current standalone audited GPFS (authorised
// 29 September 2026, independent auditor's report dated 28 October 2026) and is
// the source ingested here. Older years are retained so discovery can reject a
// stale or missing target year instead of substituting a prior report.

const FS_2026_HREF =
  '/__data/assets/pdf_file/0004/290047/Annual_Financial_Statements-2026-_Audited.pdf';
const FS_2025_HREF = '/__data/assets/pdf_file/0004/275152/Annual-Financial-Statements-2025.pdf';
const FS_2024_HREF = '/__data/assets/pdf_file/0005/257477/Annual_Financial_Statements-2024.pdf';
const FS_2027_HREF =
  '/__data/assets/pdf_file/0004/999999/Annual_Financial_Statements-2027-_Audited.pdf';

const LISTING_HTML = `
  <a href="${FS_2026_HREF}" target="_blank">Annual Financial Statements for the year ended 30 June 2026 (3.2 MB)</a>
  <a href="${FS_2025_HREF}" target="_blank">Annual Financial Statements for the year ended 30 June 2025 (3.3 MB)</a>
  <a href="${FS_2024_HREF}" target="_blank">Annual Financial Statements for the year ended 30 June 2024.pdf (4.1 MB)</a>
`;

const { BROWSER_BYTES, BROWSER_HTML } = vi.hoisted(() => {
  const pin =
    'https://www.esc.nsw.gov.au/__data/assets/pdf_file/0004/290047/Annual_Financial_Statements-2026-_Audited.pdf';
  return {
    BROWSER_HTML: `<a href="${pin}" target="_blank">Annual Financial Statements for the year ended 30 June 2026 (3.2 MB)</a>`,
    BROWSER_BYTES: Buffer.from('browser-fetched-eurobodalla-fs-bytes'),
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
      return Buffer.from('browser-fetched-eurobodalla-fs-bytes').toString('base64');
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

const { fetchEurobodallaGpfsViaBrowser } =
  await import('../../scripts/eurobodalla-gpfs-browser.js');

function parsedFixture() {
  return parseEurobodallaGpfsExtraction(eurobodallaExtraction(), EUROBODALLA_CONTEXT);
}

describe('Eurobodalla Shire Council audited FS discovery', () => {
  it('discovers the FY2025-26 audited financial statements and retains older years', () => {
    expect(EUROBODALLA_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseEurobodallaFinancialStatementsLinks(
      LISTING_HTML,
      EUROBODALLA_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    const selected = selectEurobodallaGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(new URL(FS_2026_HREF, EUROBODALLA_GPFS_REPORTING_URL).toString());
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(EUROBODALLA_GPFS_REPORTING_URL);
    expect(selected.title).toContain('30 June 2026');
    expect(
      fiscalYearFromEurobodallaFinancialStatementsLink(
        'Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromEurobodallaFinancialStatementsLink(
        'Annual Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromEurobodallaFinancialStatementsLink('Long Term Financial Plan 2026-2037.pdf'),
    ).toBeNull();
    expect(EUROBODALLA_GPFS_STANDALONE_FS_BYTES).toBe(3_380_012);
    expect(EUROBODALLA_GPFS_STANDALONE_FS_PAGES).toBe(105);
    expect(EUROBODALLA_GPFS_STANDALONE_FS_SHA256).toBe(
      'b729322500f9ac43204c38925fbad62b2bf10b893fdc45956cc43ea95702b89e',
    );
  });

  it('rejects a prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `<a href="${FS_2025_HREF}" target="_blank">Annual Financial Statements for the year ended 30 June 2025</a>`;
    const links = parseEurobodallaFinancialStatementsLinks(
      priorOnly,
      EUROBODALLA_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectEurobodallaGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 FS for the FY2025-26 target', () => {
    const futureOnly = `<a href="${FS_2027_HREF}" target="_blank">Annual Financial Statements for the year ended 30 June 2027</a>`;
    const links = parseEurobodallaFinancialStatementsLinks(
      futureOnly,
      EUROBODALLA_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectEurobodallaGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official FS pin when the listing yields no usable anchor', async () => {
    expect(
      parseEurobodallaFinancialStatementsLinks(
        '<html><body>No document links here</body></html>',
        EUROBODALLA_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = eurobodallaPinnedDocument();
    expect(pinned.url).toBe(EUROBODALLA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    const discovered = await discoverEurobodallaGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(EUROBODALLA_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the Cloudflare challenge returns a 403', async () => {
    const discovered = await discoverEurobodallaGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(EUROBODALLA_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic plain-fetch discovery', async () => {
    expect(EUROBODALLA_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverEurobodallaGpfsDocument(
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
      discoverEurobodallaGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });

  it('fetches the audited FS through the browser/Cloudflare-aware path', async () => {
    const fetched = await fetchEurobodallaGpfsViaBrowser(EUROBODALLA_GPFS_REPORTING_URL, '2025-26');
    expect(fetched.pdfUrl).toBe(EUROBODALLA_GPFS_DOCUMENT_PIN);
    expect(fetched.listingHtml).toBe(BROWSER_HTML);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
  });
});

describe('Eurobodalla Shire Council standalone GPFS slice', () => {
  it('emits 17 printed statement lines with exact face and B1-1 reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(EUROBODALLA_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(EUROBODALLA_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(195_167);
    expect(recon.total_expenses).toBe(159_675);
    expect(recon.employee_expenses).toBe(51_836);
    expect(recon.materials_and_services).toBe(46_326);
    expect(recon.borrowing_costs).toBe(2_535);
    expect(recon.other_expenses).toBe(2_042);
    expect(recon.net_loss_from_disposal_of_assets).toBe(4_174);
    expect(recon.depreciation_amortisation_impairment).toBe(52_762);
    expect(recon.government_grants_operating).toBe(20_773);
    expect(recon.government_grants_capital).toBe(44_004);
    expect(recon.net_result).toBe(35_492);
    expect(recon.net_result_before_capital_grants).toBe(-8_512);
    expect(recon.operating_result_excluding_depreciation).toBe(88_254);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(106_913);
    expect(recon.functions_income).toBe(195_167);
    expect(recon.functions_total_expenses).toBe(159_675);
    expect(recon.functions_operating_result).toBe(35_492);
    expect(recon.functions_grants_and_contributions).toBe(64_777);
    expect(recon.functions_carrying_amount).toBe(2_596_497);
    expect(recon.comprehensive_total).toBe(106_600);
    expect(recon.comprehensive_other_income).toBe(71_108);
    expect(recon.comprehensive_revaluation).toBe(70_799);
    expect(recon.comprehensive_other_movements).toBe(309);
    expect(recon.total_assets).toBe(2_596_497);
    expect(recon.total_equity).toBe(2_461_168);
    expect(recon.cash_net_change).toBe(-5_548);
    expect(recon.cash_opening).toBe(24_526);
    expect(recon.cash_closing).toBe(18_978);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(8_345_500_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(19_516_700_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(15_967_500_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(3_549_200_000);
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

  it('parses B1-1 Total functions and activities on Eurobodalla’s layout', () => {
    const totals = parseEurobodallaGpfsFunctionsTotals({
      page_number: 14,
      text: EUROBODALLA_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 14,
      income: 195_167,
      expenses: 159_675,
      operating_result: 35_492,
      grants_and_contributions: 64_777,
      carrying_amount: 2_596_497,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = eurobodallaExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 5 ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') } : page,
    );
    const parsed = parseEurobodallaGpfsExtraction(extraction, EUROBODALLA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = eurobodallaExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 14 ? { ...page, text: page.text.replace(/\$ '000/g, '$m') } : page,
    );
    const parsed = parseEurobodallaGpfsExtraction(extraction, EUROBODALLA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = eurobodallaExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 14 ? { ...page, text: page.text.replace('159,675', '159,676') } : page,
    );
    const parsed = parseEurobodallaGpfsExtraction(extraction, EUROBODALLA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Eurobodalla Shire Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2025-26')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = EUROBODALLA_CONTEXT.document.url;
    const revenue = eurobodallaGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = eurobodallaGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^eurobodalla-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(eurobodallaGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(eurobodallaGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });

  it('keeps the fixture text anchored to the printed source lines', () => {
    expect(EUROBODALLA_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(EUROBODALLA_INCOME_TEXT).toContain('Net loss from the disposal of assets');
    expect(EUROBODALLA_GPFS_ID).toBe('eurobodalla-gpfs');
    expect(EUROBODALLA_GPFS_NAME).toContain('Eurobodalla');
    expect(EUROBODALLA_GPFS_PUBLISHER).toBe('Eurobodalla Shire Council');
    expect(EUROBODALLA_GPFS_LICENSE).toContain('Eurobodalla Shire Council');
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_eurobodallagpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: EUROBODALLA_GPFS_ID,
    name: EUROBODALLA_GPFS_NAME,
    publisher: EUROBODALLA_GPFS_PUBLISHER,
    source_url: EUROBODALLA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: EUROBODALLA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'eurobodalla-gpfs-measure', record }));
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

describe('Eurobodalla Shire Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-eurobodalla',
        project_name: 'Existing AusTender Eurobodalla contract',
        delivery_entity: 'EUROBODALLA SHIRE COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-eurobodalla-school',
        project_name: 'Existing data.nsw Eurobodalla school row (not a council row)',
        delivery_entity: 'Moruya High School',
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
    expect(await MeasureModel.countDocuments({ source_id: EUROBODALLA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: EUROBODALLA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: EUROBODALLA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
