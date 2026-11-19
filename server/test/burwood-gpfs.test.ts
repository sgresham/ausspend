import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BURWOOD_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  BURWOOD_GPFS_DOCUMENT_PIN,
  BURWOOD_GPFS_FISCAL_YEAR,
  BURWOOD_GPFS_ID,
  BURWOOD_GPFS_LICENSE,
  BURWOOD_GPFS_LINES,
  BURWOOD_GPFS_NAME,
  BURWOOD_GPFS_PUBLISHER,
  BURWOOD_GPFS_REPORTING_URL,
  BURWOOD_GPFS_REQUEST_HEADERS,
  BURWOOD_GPFS_STANDALONE_FS_BYTES,
  BURWOOD_GPFS_STANDALONE_FS_PAGES,
  BURWOOD_GPFS_STANDALONE_FS_SHA256,
  burwoodGpfsNaturalKey,
  burwoodPinnedDocument,
  discoverBurwoodGpfsDocument,
  fiscalYearFromBurwoodFinancialStatementsDoc,
  parseBurwoodGpfsExtraction,
  parseBurwoodGpfsFunctionsTotals,
} from '../src/connectors/burwood-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  BURWOOD_CONTEXT,
  BURWOOD_FUNCTIONS_TEXT,
  BURWOOD_GPFS_GOLDEN_DIGEST,
  BURWOOD_GPFS_ROW_COUNT,
  BURWOOD_INCOME_TEXT,
  burwoodExtraction,
} from '../src/connectors/burwood-gpfs/fixture.js';

// Burwood's main site is behind Akamai bot protection, but the official
// consultation host participate.burwood.nsw.gov.au serves the current audited
// FY2025-26 Annual Financial Statements in its Document Library. The connector
// ingests only that current GPFS; the newest combined annual report on the
// council site is still FY2024-25 and is summary-only.

const PIN = BURWOOD_GPFS_DOCUMENT_PIN;

const { BROWSER_BYTES, PLAIN_BYTES } = vi.hoisted(() => ({
  BROWSER_BYTES: Buffer.from('browser-fetched-burwood-fs-bytes'),
  PLAIN_BYTES: Buffer.from('plain-fetched-burwood-fs-bytes'),
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
      return `<a href="${PIN}">Annual financial statements 2026 PDF (4.24 MB)</a>`;
    },
    async evaluate(_fn: (url: string) => Promise<string>, _url: string) {
      return Buffer.from('browser-fetched-burwood-fs-bytes').toString('base64');
    },
  };
  const context = {
    async newPage() {
      return page;
    },
    request: {
      async get(_url: string) {
        return {
          status: () => 200,
          headers: () => ({ 'content-type': 'application/pdf' }),
          async body() {
            return Buffer.from('browser-fetched-burwood-fs-bytes');
          },
        };
      },
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

const { fetchBurwoodGpfsViaBrowser } = await import('../../scripts/burwood-gpfs-browser.js');

function parsedFixture() {
  return parseBurwoodGpfsExtraction(burwoodExtraction(), BURWOOD_CONTEXT);
}

function withIncomeUnitRemoved() {
  const extraction = burwoodExtraction();
  extraction.pages = extraction.pages.map((page) =>
    page.page_number === 5
      ? {
          ...page,
          items: page.items.filter((item) => item.str !== "$ '000"),
          text: page.text.replace(/\$ '000/g, 'Notes'),
        }
      : page,
  );
  return extraction;
}

function withFunctionsUnit(text: string) {
  const extraction = burwoodExtraction();
  extraction.pages = extraction.pages.map((page) =>
    page.page_number === 14
      ? {
          ...page,
          items: page.items.map((item) =>
            item.str === "$ '000" ? { ...item, str: text } : item,
          ),
          text: page.text.replace(/\$ '000/g, text),
        }
      : page,
  );
  return extraction;
}

describe('Burwood Council audited GPFS discovery', () => {
  it('pins the current standalone FY2025-26 audited GPFS and its exact bytes', () => {
    expect(BURWOOD_GPFS_FISCAL_YEAR).toBe('2025-26');
    const pinned = burwoodPinnedDocument();
    expect(pinned.url).toBe(PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.listing_url).toBe(BURWOOD_GPFS_REPORTING_URL);
    expect(BURWOOD_GPFS_STANDALONE_FS_BYTES).toBe(4_450_607);
    expect(BURWOOD_GPFS_STANDALONE_FS_PAGES).toBe(70);
    expect(BURWOOD_GPFS_STANDALONE_FS_SHA256).toBe(
      '9b6e3f8725e47823038329b269d955ef263d7cc6680aacea9b944320919f2e13',
    );
  });

  it('uses the official burwood.nsw.gov.au domain and never a mirror host', () => {
    expect(new URL(BURWOOD_GPFS_DOCUMENT_PIN).host.endsWith('burwood.nsw.gov.au')).toBe(true);
    expect(new URL(BURWOOD_GPFS_REPORTING_URL).host.endsWith('burwood.nsw.gov.au')).toBe(true);
    expect(
      new URL(BURWOOD_GPFS_CURRENT_ANNUAL_REPORT_PIN).host.endsWith('burwood.nsw.gov.au'),
    ).toBe(true);
    expect(BURWOOD_GPFS_DOCUMENT_PIN).not.toMatch(/webcache|archive\.org|googleusercontent/);
  });

  it('refuses to substitute a different year', () => {
    expect(() => discoverBurwoodGpfsDocument('2024-25')).toThrow(/No pinned/);
    expect(() => discoverBurwoodGpfsDocument('2026-27')).toThrow(/No pinned/);
    expect(burwoodPinnedDocument().fiscal_year).toBe('2025-26');
  });

  it('parses only explicit year conventions and never a bare year', () => {
    expect(
      fiscalYearFromBurwoodFinancialStatementsDoc(
        'Burwood Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromBurwoodFinancialStatementsDoc('annual-financial-statements-2026.pdf'),
    ).toBe('2025-26');
    expect(
      fiscalYearFromBurwoodFinancialStatementsDoc('Annual Financial Statements 2025-2026'),
    ).toBe('2025-26');
    expect(
      fiscalYearFromBurwoodFinancialStatementsDoc('Annual Financial Statements 2026'),
    ).toBe('2025-26');
    expect(fiscalYearFromBurwoodFinancialStatementsDoc('2026')).toBeNull();
    expect(fiscalYearFromBurwoodFinancialStatementsDoc('Annual Report 2026')).toBeNull();
    expect(
      fiscalYearFromBurwoodFinancialStatementsDoc('Long Term Financial Plan 2026-2036.pdf'),
    ).toBeNull();
  });

  it('documents the WAF gate with a browser user agent', () => {
    expect(BURWOOD_GPFS_REQUEST_HEADERS['user-agent']).toContain('Chrome');
    expect(BURWOOD_GPFS_REQUEST_HEADERS.accept).toContain('application/pdf');
  });

  it('fetches the pinned annual financial statements through the browser path', async () => {
    const fetched = await fetchBurwoodGpfsViaBrowser();
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
      if (url === BURWOOD_GPFS_REPORTING_URL) {
        return new Response(
          `<a href="${PIN}">Annual financial statements 2026 PDF (4.24 MB)</a>`,
          { status: 200 },
        );
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchBurwoodGpfsViaBrowser(BURWOOD_GPFS_REPORTING_URL, '2025-26', {
      forcePlain: true,
      fetchImpl,
    });
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(PIN);
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('Burwood Council standalone GPFS slice', () => {
  it('emits 18 printed statement lines with exact face, B1-1 and balance-sheet reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(BURWOOD_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(18);
    expect(parsed.rejections).toEqual([]);
    expect(BURWOOD_GPFS_LINES).toHaveLength(18);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(89_251);
    expect(recon.total_expenses).toBe(70_409);
    expect(recon.employee_expenses).toBe(26_800);
    expect(recon.materials_and_services).toBe(28_667);
    expect(recon.borrowing_costs).toBe(409);
    expect(recon.other_expenses).toBe(1_239);
    expect(recon.depreciation_amortisation_impairment).toBe(10_654);
    expect(recon.government_grants_operating).toBe(4_277);
    expect(recon.government_grants_capital).toBe(15_821);
    expect(recon.net_gain_from_disposal_of_assets).toBe(0);
    expect(recon.net_loss_from_disposal_of_assets).toBe(2_640);
    expect(recon.net_result).toBe(18_842);
    expect(recon.net_result_before_capital_grants).toBe(3_021);
    expect(recon.operating_result_excluding_depreciation).toBe(29_496);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(59_755);
    expect(recon.functions_income).toBe(89_251);
    expect(recon.functions_total_expenses).toBe(70_409);
    expect(recon.functions_operating_result).toBe(18_842);
    expect(recon.functions_grants_and_contributions).toBe(20_098);
    expect(recon.functions_carrying_amount).toBe(697_329);
    expect(recon.comprehensive_total).toBe(40_570);
    expect(recon.comprehensive_other_income).toBe(21_728);
    expect(recon.comprehensive_revaluation).toBe(21_728);
    expect(recon.comprehensive_attributable_council).toBe(40_570);
    expect(recon.total_assets).toBe(697_329);
    expect(recon.total_liabilities).toBe(28_931);
    expect(recon.net_assets).toBe(668_398);
    expect(recon.total_equity).toBe(668_398);
    expect(recon.cash_operating).toBe(29_599);
    expect(recon.cash_investing).toBe(-32_015);
    expect(recon.cash_financing).toBe(3_870);
    expect(recon.cash_net_change).toBe(1_454);
    expect(recon.cash_opening).toBe(9_161);
    expect(recon.cash_closing).toBe(10_615);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(4_388_300_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(8_925_100_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(7_040_900_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(1_884_200_000);
    expect(byKey.get('net_gain_from_disposal_of_assets')!.gpfs_section).toBe('revenue');
    expect(byKey.get('net_loss_from_disposal_of_assets')!.gpfs_section).toBe('expenses');
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('government_grants_operating')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(byKey.get('other_expenses')!.gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(byKey.get('net_result')!.notes).toContain('unit: thousands (explicit');
    expect(byKey.get('net_result')!.source_dataset).toBe('Burwood Council GPFS 2025-26');
  });

  it('parses B1-1 Total functions and activities on Burwood’s layout', () => {
    const totals = parseBurwoodGpfsFunctionsTotals({
      page_number: 14,
      text: BURWOOD_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 14,
      income: 89_251,
      expenses: 70_409,
      operating_result: 18_842,
      grants_and_contributions: 20_098,
      carrying_amount: 697_329,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const parsed = parseBurwoodGpfsExtraction(withIncomeUnitRemoved(), BURWOOD_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const parsed = parseBurwoodGpfsExtraction(withFunctionsUnit('$m'), BURWOOD_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = burwoodExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 14
        ? {
            ...page,
            items: page.items.map((item) =>
              item.str === '697,329' ? { ...item, str: '697,330' } : item,
            ),
            text: page.text.replace('697,329', '697,330'),
          }
        : page,
    );
    const parsed = parseBurwoodGpfsExtraction(extraction, BURWOOD_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Burwood Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2025-26')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = BURWOOD_CONTEXT.document.url;
    const revenue = burwoodGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = burwoodGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^burwood-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(burwoodGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(burwoodGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });

  it('keeps the fixture text anchored to the printed source lines and golden digest', () => {
    expect(BURWOOD_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(BURWOOD_INCOME_TEXT).toContain('Net gain from the disposal of assets');
    expect(BURWOOD_INCOME_TEXT).toContain('Net loss from the disposal of assets');
    expect(BURWOOD_INCOME_TEXT).toContain('3,021');
    expect(BURWOOD_GPFS_ID).toBe('burwood-gpfs');
    expect(BURWOOD_GPFS_NAME).toContain('Burwood');
    expect(BURWOOD_GPFS_PUBLISHER).toBe('Burwood Council');
    expect(BURWOOD_GPFS_LICENSE).toContain('Burwood Council');
    expect(BURWOOD_GPFS_REPORTING_URL).toContain('burwood.nsw.gov.au');
    expect(BURWOOD_GPFS_GOLDEN_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_burwoodgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BURWOOD_GPFS_ID,
    name: BURWOOD_GPFS_NAME,
    publisher: BURWOOD_GPFS_PUBLISHER,
    source_url: BURWOOD_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BURWOOD_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'burwood-gpfs-measure', record }));
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

describe('Burwood Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-burwood',
        project_name: 'Existing AusTender Burwood contract',
        delivery_entity: 'BURWOOD COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-burwood-school',
        project_name: 'Existing data.nsw Burwood school row (not a council row)',
        delivery_entity: 'Burwood Public School',
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
    expect(await MeasureModel.countDocuments({ source_id: BURWOOD_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BURWOOD_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    const source = await DataSourceModel.findOne({ source_id: BURWOOD_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
