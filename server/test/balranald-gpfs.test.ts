import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BALRANALD_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  BALRANALD_GPFS_DOCUMENT_PIN,
  BALRANALD_GPFS_FISCAL_YEAR,
  BALRANALD_GPFS_ID,
  BALRANALD_GPFS_LICENSE,
  BALRANALD_GPFS_LINES,
  BALRANALD_GPFS_NAME,
  BALRANALD_GPFS_PUBLISHER,
  BALRANALD_GPFS_REPORTING_URL,
  BALRANALD_GPFS_REQUEST_HEADERS,
  BALRANALD_GPFS_STANDALONE_FS_BYTES,
  BALRANALD_GPFS_STANDALONE_FS_PAGES,
  BALRANALD_GPFS_STANDALONE_FS_SHA256,
  balranaldGpfsNaturalKey,
  balranaldPinnedDocument,
  discoverBalranaldGpfsDocument,
  fiscalYearFromBalranaldFinancialStatementsDoc,
  parseBalranaldGpfsExtraction,
  parseBalranaldGpfsFunctionsTotals,
} from '../src/connectors/balranald-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  BALRANALD_CONTEXT,
  BALRANALD_FUNCTIONS_TEXT,
  BALRANALD_GPFS_GOLDEN_DIGEST,
  BALRANALD_GPFS_ROW_COUNT,
  BALRANALD_INCOME_TEXT,
  balranaldExtraction,
} from '../src/connectors/balranald-gpfs/fixture.js';

// Balranald's entire official site is behind Cloudflare bot management: plain
// clients get HTTP 403 for the home page, sitemaps and uploads, while a real
// headless Chromium session gets HTTP 200. The current standalone audited
// FY2025-26 GPFS is pinned to the exact official upload on the annual-reports
// page and fetched through the browser/WAF path. The connector ingests only
// that current GPFS; the newest combined annual report is still FY2024-25 and
// is not substituted.

const PIN = BALRANALD_GPFS_DOCUMENT_PIN;

const { BROWSER_BYTES, PLAIN_BYTES } = vi.hoisted(() => ({
  BROWSER_BYTES: Buffer.from('browser-fetched-balranald-fs-bytes'),
  PLAIN_BYTES: Buffer.from('plain-fetched-balranald-fs-bytes'),
}));

vi.mock('playwright', () => {
  const page = {
    async goto() {
      return { ok: () => true, status: () => 200 };
    },
    async waitForTimeout() {
      return undefined;
    },
    async content() {
      return `<a href="${PIN}">Annual Financial Statements</a>`;
    },
    async evaluate(_fn: (url: string) => Promise<string>, _url: string) {
      return Buffer.from('browser-fetched-balranald-fs-bytes').toString('base64');
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

const { fetchBalranaldGpfsViaBrowser } = await import('../../scripts/balranald-gpfs-browser.js');

function parsedFixture() {
  return parseBalranaldGpfsExtraction(balranaldExtraction(), BALRANALD_CONTEXT);
}

describe('Balranald Shire Council audited GPFS discovery', () => {
  it('pins the current standalone FY2025-26 official PDF and its exact bytes', () => {
    expect(BALRANALD_GPFS_FISCAL_YEAR).toBe('2025-26');
    const pinned = balranaldPinnedDocument();
    expect(pinned.url).toBe(PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.listing_url).toBe(BALRANALD_GPFS_REPORTING_URL);
    expect(BALRANALD_GPFS_STANDALONE_FS_BYTES).toBe(2_920_220);
    expect(BALRANALD_GPFS_STANDALONE_FS_PAGES).toBe(108);
    expect(BALRANALD_GPFS_STANDALONE_FS_SHA256).toBe(
      'd7c10c675385d2376ddccae430b08087f25d491a34f6a3695a86e9d807b169fd',
    );
  });

  it('uses the official apex domain and never a www or mirror host', () => {
    expect(new URL(BALRANALD_GPFS_DOCUMENT_PIN).host).toBe('balranald.nsw.gov.au');
    expect(new URL(BALRANALD_GPFS_REPORTING_URL).host).toBe('balranald.nsw.gov.au');
    expect(new URL(BALRANALD_GPFS_CURRENT_ANNUAL_REPORT_PIN).host).toBe('balranald.nsw.gov.au');
    expect(BALRANALD_GPFS_DOCUMENT_PIN).not.toContain('www.balranald');
    expect(BALRANALD_GPFS_DOCUMENT_PIN).not.toMatch(/webcache|archive\.org|googleusercontent/);
  });

  it('refuses to substitute a different year', () => {
    expect(() => discoverBalranaldGpfsDocument('2024-25')).toThrow(/No pinned/);
    expect(() => discoverBalranaldGpfsDocument('2026-27')).toThrow(/No pinned/);
    expect(balranaldPinnedDocument().fiscal_year).toBe('2025-26');
  });

  it('parses only explicit year conventions and never a bare year', () => {
    expect(
      fiscalYearFromBalranaldFinancialStatementsDoc(
        'Balranald Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromBalranaldFinancialStatementsDoc(
        'Balranald-Annual_Financial_Statements-2026-OLG.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromBalranaldFinancialStatementsDoc('Annual Financial Statements 2025-2026'),
    ).toBe('2025-26');
    expect(fiscalYearFromBalranaldFinancialStatementsDoc('Annual Financial Statements 2026')).toBe(
      null,
    );
    expect(
      fiscalYearFromBalranaldFinancialStatementsDoc('Long Term Financial Plan 2026-2036.pdf'),
    ).toBeNull();
  });

  it('documents the Cloudflare WAF gate with a browser user agent', () => {
    expect(BALRANALD_GPFS_REQUEST_HEADERS['user-agent']).toContain('Chrome');
    expect(BALRANALD_GPFS_REQUEST_HEADERS.accept).toContain('application/pdf');
  });

  it('fetches the pinned annual financial statements through the browser path', async () => {
    const fetched = await fetchBalranaldGpfsViaBrowser();
    expect(fetched.pdfUrl).toBe(PIN);
    expect(fetched.viaBrowser).toBe(true);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
    expect(fetched.listingHtml).toContain(PIN);
  });

  it('falls back to the plain client when forced (tests only)', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url === BALRANALD_GPFS_REPORTING_URL) {
        return new Response(`<a href="${PIN}">Annual Financial Statements</a>`, { status: 200 });
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchBalranaldGpfsViaBrowser(
      BALRANALD_GPFS_REPORTING_URL,
      '2025-26',
      { forcePlain: true, fetchImpl },
    );
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(PIN);
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('Balranald Shire Council standalone GPFS slice', () => {
  it('emits 18 printed statement lines with exact face, B1-1 and balance-sheet reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(BALRANALD_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(18);
    expect(parsed.rejections).toEqual([]);
    expect(BALRANALD_GPFS_LINES).toHaveLength(18);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(32_894);
    expect(recon.total_expenses).toBe(24_580);
    expect(recon.employee_expenses).toBe(8_802);
    expect(recon.materials_and_services).toBe(7_723);
    expect(recon.borrowing_costs).toBe(71);
    expect(recon.other_expenses).toBe(685);
    expect(recon.net_loss_from_disposal_of_assets).toBe(19);
    expect(recon.net_share_joint_ventures).toBe(15);
    expect(recon.depreciation_amortisation_impairment).toBe(7_265);
    expect(recon.government_grants_operating).toBe(16_394);
    expect(recon.government_grants_capital).toBe(5_490);
    expect(recon.net_result).toBe(8_314);
    expect(recon.net_result_before_capital_grants).toBe(2_824);
    expect(recon.operating_result_excluding_depreciation).toBe(15_579);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(17_315);
    expect(recon.functions_income).toBe(32_894);
    expect(recon.functions_total_expenses).toBe(24_580);
    expect(recon.functions_operating_result).toBe(8_314);
    expect(recon.functions_grants_and_contributions).toBe(21_884);
    expect(recon.functions_carrying_amount).toBe(338_016);
    expect(recon.comprehensive_total).toBe(20_807);
    expect(recon.comprehensive_other_income).toBe(12_493);
    expect(recon.comprehensive_revaluation).toBe(12_493);
    expect(recon.comprehensive_impairment_decrement).toBe(0);
    expect(recon.comprehensive_attributable_council).toBe(20_807);
    expect(recon.total_assets).toBe(338_016);
    expect(recon.total_liabilities).toBe(10_348);
    expect(recon.net_assets).toBe(327_668);
    expect(recon.council_equity_interest).toBe(327_668);
    expect(recon.total_equity).toBe(327_668);
    expect(recon.cash_operating).toBe(14_117);
    expect(recon.cash_investing).toBe(-24_147);
    expect(recon.cash_financing).toBe(1_260);
    expect(recon.cash_net_change).toBe(-8_770);
    expect(recon.cash_opening).toBe(11_819);
    expect(recon.cash_closing).toBe(3_049);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(624_800_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(3_289_400_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(2_458_000_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(831_400_000);
    expect(byKey.get('net_share_joint_ventures')!.gpfs_section).toBe('expenses');
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('government_grants_operating')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(byKey.get('net_share_joint_ventures')!.gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(byKey.get('net_result')!.notes).toContain('unit: thousands (explicit');
    expect(byKey.get('net_result')!.source_dataset).toBe('Balranald Shire Council GPFS 2025-26');
  });

  it('parses B1-1 Total functions and activities on Balranald’s layout', () => {
    const totals = parseBalranaldGpfsFunctionsTotals({
      page_number: 15,
      text: BALRANALD_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 15,
      income: 32_894,
      expenses: 24_580,
      operating_result: 8_314,
      grants_and_contributions: 21_884,
      carrying_amount: 338_016,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = balranaldExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 6 ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') } : page,
    );
    const parsed = parseBalranaldGpfsExtraction(extraction, BALRANALD_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = balranaldExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15 ? { ...page, text: page.text.replace(/\$ '000/g, '$m') } : page,
    );
    const parsed = parseBalranaldGpfsExtraction(extraction, BALRANALD_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = balranaldExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15 ? { ...page, text: page.text.replace('24,580', '24,581') } : page,
    );
    const parsed = parseBalranaldGpfsExtraction(extraction, BALRANALD_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Balranald Shire Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2025-26')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = BALRANALD_CONTEXT.document.url;
    const revenue = balranaldGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = balranaldGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^balranald-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(balranaldGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(balranaldGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });

  it('keeps the fixture text anchored to the printed source lines and golden digest', () => {
    expect(BALRANALD_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(BALRANALD_INCOME_TEXT).toContain('Net share of interests in joint ventures');
    expect(BALRANALD_INCOME_TEXT).toContain('2,824');
    expect(BALRANALD_GPFS_ID).toBe('balranald-gpfs');
    expect(BALRANALD_GPFS_NAME).toContain('Balranald');
    expect(BALRANALD_GPFS_PUBLISHER).toBe('Balranald Shire Council');
    expect(BALRANALD_GPFS_LICENSE).toContain('Balranald Shire Council');
    expect(BALRANALD_GPFS_REPORTING_URL).toContain('balranald.nsw.gov.au');
    expect(BALRANALD_GPFS_GOLDEN_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_balranaldgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BALRANALD_GPFS_ID,
    name: BALRANALD_GPFS_NAME,
    publisher: BALRANALD_GPFS_PUBLISHER,
    source_url: BALRANALD_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BALRANALD_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'balranald-gpfs-measure', record }));
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

describe('Balranald Shire Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-balranald',
        project_name: 'Existing AusTender Balranald contract',
        delivery_entity: 'BALRANALD SHIRE COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-balranald-school',
        project_name: 'Existing data.nsw Balranald school row (not a council row)',
        delivery_entity: 'Balranald Public School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('adds exactly 18 rows, preserves existing rows, and is idempotent', async () => {
    const { records } = parsedFixture();
    expect(records).toHaveLength(18);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: BALRANALD_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BALRANALD_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    const source = await DataSourceModel.findOne({ source_id: BALRANALD_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
