import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  CABONNE_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  CABONNE_GPFS_DOCUMENT_PIN,
  CABONNE_GPFS_FISCAL_YEAR,
  CABONNE_GPFS_ID,
  CABONNE_GPFS_LICENSE,
  CABONNE_GPFS_LINES,
  CABONNE_GPFS_NAME,
  CABONNE_GPFS_PUBLISHER,
  CABONNE_GPFS_REPORTING_URL,
  CABONNE_GPFS_REQUEST_HEADERS,
  CABONNE_GPFS_STANDALONE_FS_BYTES,
  CABONNE_GPFS_STANDALONE_FS_PAGES,
  CABONNE_GPFS_STANDALONE_FS_SHA256,
  cabonneGpfsNaturalKey,
  cabonnePinnedDocument,
  discoverCabonneGpfsDocument,
  fiscalYearFromCabonneFinancialStatementsDoc,
  parseCabonneGpfsExtraction,
  parseCabonneGpfsFunctionsTotals,
} from '../src/connectors/cabonne-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  CABONNE_CONTEXT,
  CABONNE_FUNCTIONS_TEXT,
  CABONNE_GPFS_GOLDEN_DIGEST,
  CABONNE_GPFS_ROW_COUNT,
  CABONNE_INCOME_TEXT,
  cabonneExtraction,
} from '../src/connectors/cabonne-gpfs/fixture.js';

// Cabonne's entire official site is behind Akamai bot protection: plain clients
// get HTTP 403 ("Access Denied") for the home page, sitemaps and every /files
// path, while a real headless Chromium session gets HTTP 200. The current
// standalone audited FY2025-26 GPFS is pinned to the exact official upload on
// the Reports page and fetched through the browser/WAF path. The connector
// ingests only that current GPFS; the newest combined annual report is still
// FY2024-25 and is not substituted.

const PIN = CABONNE_GPFS_DOCUMENT_PIN;

const { BROWSER_BYTES, PLAIN_BYTES } = vi.hoisted(() => ({
  BROWSER_BYTES: Buffer.from('browser-fetched-cabonne-fs-bytes'),
  PLAIN_BYTES: Buffer.from('plain-fetched-cabonne-fs-bytes'),
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
      return `<a href="${PIN}">Annual Financial Statements GPFS 2026</a>`;
    },
    async evaluate(_fn: (url: string) => Promise<string>, _url: string) {
      return Buffer.from('browser-fetched-cabonne-fs-bytes').toString('base64');
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

const { fetchCabonneGpfsViaBrowser } = await import('../../scripts/cabonne-gpfs-browser.js');

function parsedFixture() {
  return parseCabonneGpfsExtraction(cabonneExtraction(), CABONNE_CONTEXT);
}

describe('Cabonne Council audited GPFS discovery', () => {
  it('pins the current standalone FY2025-26 official GPFS and its exact bytes', () => {
    expect(CABONNE_GPFS_FISCAL_YEAR).toBe('2025-26');
    const pinned = cabonnePinnedDocument();
    expect(pinned.url).toBe(PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.listing_url).toBe(CABONNE_GPFS_REPORTING_URL);
    expect(CABONNE_GPFS_STANDALONE_FS_BYTES).toBe(8_577_237);
    expect(CABONNE_GPFS_STANDALONE_FS_PAGES).toBe(77);
    expect(CABONNE_GPFS_STANDALONE_FS_SHA256).toBe(
      'acb8b3d53a4b795bfb6bd5dd4770e377fe24dfc0ca2801f44df9a348369d885f',
    );
  });

  it('uses the official domain and never a mirror host', () => {
    expect(new URL(CABONNE_GPFS_DOCUMENT_PIN).host).toBe('www.cabonne.nsw.gov.au');
    expect(new URL(CABONNE_GPFS_REPORTING_URL).host).toBe('www.cabonne.nsw.gov.au');
    expect(new URL(CABONNE_GPFS_CURRENT_ANNUAL_REPORT_PIN).host).toBe(
      'www.cabonne.nsw.gov.au',
    );
    expect(CABONNE_GPFS_DOCUMENT_PIN).not.toMatch(/webcache|archive\.org|googleusercontent/);
  });

  it('refuses to substitute a different year', () => {
    expect(() => discoverCabonneGpfsDocument('2024-25')).toThrow(/No pinned/);
    expect(() => discoverCabonneGpfsDocument('2026-27')).toThrow(/No pinned/);
    expect(cabonnePinnedDocument().fiscal_year).toBe('2025-26');
  });

  it('parses only explicit year conventions and never a bare year', () => {
    expect(
      fiscalYearFromCabonneFinancialStatementsDoc(
        'Cabonne Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromCabonneFinancialStatementsDoc(
        'Annual_Financial_Statements-GPFS-2026.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromCabonneFinancialStatementsDoc('Annual Financial Statements 2025-2026'),
    ).toBe('2025-26');
    expect(fiscalYearFromCabonneFinancialStatementsDoc('Annual Financial Statements 2026')).toBe(
      null,
    );
    expect(
      fiscalYearFromCabonneFinancialStatementsDoc('Long Term Financial Plan 2026-2036.pdf'),
    ).toBeNull();
  });

  it('documents the Akamai WAF gate with a browser user agent', () => {
    expect(CABONNE_GPFS_REQUEST_HEADERS['user-agent']).toContain('Chrome');
    expect(CABONNE_GPFS_REQUEST_HEADERS.accept).toContain('application/pdf');
  });

  it('fetches the pinned annual financial statements through the browser path', async () => {
    const fetched = await fetchCabonneGpfsViaBrowser();
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
      if (url === CABONNE_GPFS_REPORTING_URL) {
        return new Response(`<a href="${PIN}">Annual Financial Statements GPFS 2026</a>`, {
          status: 200,
        });
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchCabonneGpfsViaBrowser(CABONNE_GPFS_REPORTING_URL, '2025-26', {
      forcePlain: true,
      fetchImpl,
    });
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(PIN);
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('Cabonne Council standalone GPFS slice', () => {
  it('emits 17 printed statement lines with exact face, B1-1 and balance-sheet reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(CABONNE_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(CABONNE_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(70_018);
    expect(recon.total_expenses).toBe(50_056);
    expect(recon.employee_expenses).toBe(17_207);
    expect(recon.materials_and_services).toBe(15_733);
    expect(recon.borrowing_costs).toBe(231);
    expect(recon.other_expenses).toBe(792);
    expect(recon.depreciation_amortisation_impairment).toBe(16_093);
    expect(recon.government_grants_operating).toBe(15_902);
    expect(recon.government_grants_capital).toBe(20_626);
    expect(recon.net_gain_from_disposal_of_assets).toBe(39);
    expect(recon.net_result).toBe(19_962);
    expect(recon.net_result_before_capital_grants).toBe(-664);
    expect(recon.operating_result_excluding_depreciation).toBe(36_055);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(33_963);
    expect(recon.functions_income).toBe(70_018);
    expect(recon.functions_total_expenses).toBe(50_056);
    expect(recon.functions_operating_result).toBe(19_962);
    expect(recon.functions_grants_and_contributions).toBe(36_528);
    expect(recon.functions_carrying_amount).toBe(775_405);
    expect(recon.comprehensive_total).toBe(41_038);
    expect(recon.comprehensive_other_income).toBe(21_076);
    expect(recon.comprehensive_revaluation).toBe(20_479);
    expect(recon.comprehensive_joint_ventures).toBe(597);
    expect(recon.comprehensive_attributable_council).toBe(41_038);
    expect(recon.total_assets).toBe(775_405);
    expect(recon.total_liabilities).toBe(25_706);
    expect(recon.net_assets).toBe(749_699);
    expect(recon.council_equity_interest).toBe(749_699);
    expect(recon.total_equity).toBe(749_699);
    expect(recon.cash_operating).toBe(36_574);
    expect(recon.cash_investing).toBe(-33_164);
    expect(recon.cash_financing).toBe(1_422);
    expect(recon.cash_net_change).toBe(4_832);
    expect(recon.cash_opening).toBe(14_620);
    expect(recon.cash_closing).toBe(19_452);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(1_808_200_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(7_001_800_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(5_005_600_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(1_996_200_000);
    expect(byKey.get('net_gain_from_disposal_of_assets')!.gpfs_section).toBe('revenue');
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('government_grants_operating')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(byKey.get('other_expenses')!.gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(byKey.get('net_result')!.notes).toContain('unit: thousands (explicit');
    expect(byKey.get('net_result')!.source_dataset).toBe('Cabonne Council GPFS 2025-26');
  });

  it('parses B1-1 Total functions and activities on Cabonne’s layout', () => {
    const totals = parseCabonneGpfsFunctionsTotals({
      page_number: 13,
      text: CABONNE_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 13,
      income: 70_018,
      expenses: 50_056,
      operating_result: 19_962,
      grants_and_contributions: 36_528,
      carrying_amount: 775_405,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = cabonneExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 4 ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') } : page,
    );
    const parsed = parseCabonneGpfsExtraction(extraction, CABONNE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = cabonneExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 13 ? { ...page, text: page.text.replace(/\$ '000/g, '$m') } : page,
    );
    const parsed = parseCabonneGpfsExtraction(extraction, CABONNE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = cabonneExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 13 ? { ...page, text: page.text.replace('50,056', '50,057') } : page,
    );
    const parsed = parseCabonneGpfsExtraction(extraction, CABONNE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Cabonne Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2025-26')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = CABONNE_CONTEXT.document.url;
    const revenue = cabonneGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = cabonneGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^cabonne-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(cabonneGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(cabonneGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });

  it('keeps the fixture text anchored to the printed source lines and golden digest', () => {
    expect(CABONNE_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(CABONNE_INCOME_TEXT).toContain('Net gain from the disposal of assets');
    expect(CABONNE_INCOME_TEXT).toContain('(664)');
    expect(CABONNE_GPFS_ID).toBe('cabonne-gpfs');
    expect(CABONNE_GPFS_NAME).toContain('Cabonne');
    expect(CABONNE_GPFS_PUBLISHER).toBe('Cabonne Council');
    expect(CABONNE_GPFS_LICENSE).toContain('Cabonne Council');
    expect(CABONNE_GPFS_REPORTING_URL).toContain('cabonne.nsw.gov.au');
    expect(CABONNE_GPFS_GOLDEN_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_cabonnegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CABONNE_GPFS_ID,
    name: CABONNE_GPFS_NAME,
    publisher: CABONNE_GPFS_PUBLISHER,
    source_url: CABONNE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CABONNE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'cabonne-gpfs-measure', record }));
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

describe('Cabonne Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-cabonne',
        project_name: 'Existing AusTender Cabonne contract',
        delivery_entity: 'CABONNE COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-cabonne-school',
        project_name: 'Existing data.nsw Cabonne school row (not a council row)',
        delivery_entity: 'Cabonne Public School',
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
    expect(await MeasureModel.countDocuments({ source_id: CABONNE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: CABONNE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: CABONNE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
