import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  CENTRAL_DARLING_GPFS_2025_26_NOTICE_PIN,
  CENTRAL_DARLING_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  CENTRAL_DARLING_GPFS_DOCUMENT_PIN,
  CENTRAL_DARLING_GPFS_FISCAL_YEAR,
  CENTRAL_DARLING_GPFS_ID,
  CENTRAL_DARLING_GPFS_LICENSE,
  CENTRAL_DARLING_GPFS_LINES,
  CENTRAL_DARLING_GPFS_NAME,
  CENTRAL_DARLING_GPFS_PUBLISHER,
  CENTRAL_DARLING_GPFS_REPORTING_URL,
  CENTRAL_DARLING_GPFS_REQUEST_HEADERS,
  CENTRAL_DARLING_GPFS_STANDALONE_FS_BYTES,
  CENTRAL_DARLING_GPFS_STANDALONE_FS_PAGES,
  CENTRAL_DARLING_GPFS_STANDALONE_FS_SHA256,
  centralDarlingGpfsNaturalKey,
  centralDarlingPinnedDocument,
  discoverCentralDarlingGpfsDocument,
  fiscalYearFromCentralDarlingFinancialStatementsDoc,
  parseCentralDarlingGpfsExtraction,
  parseCentralDarlingGpfsFunctionsTotals,
} from '../src/connectors/central-darling-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  CENTRAL_DARLING_CONTEXT,
  CENTRAL_DARLING_FUNCTIONS_TEXT,
  CENTRAL_DARLING_GPFS_GOLDEN_DIGEST,
  CENTRAL_DARLING_GPFS_ROW_COUNT,
  CENTRAL_DARLING_INCOME_TEXT,
  centralDarlingExtraction,
} from '../src/connectors/central-darling-gpfs/fixture.js';

// Central Darling's host has the opposite WAF quirk to most NSW council sites:
// a plain client UA gets HTTP 200 while a bare Chrome UA gets HTTP 403. The
// separate FY2024-25 audited GPFS PDF is pinned to the exact official upload and
// fetched with the plain UA through the browser helper. FY2024-25 is the latest
// available full audited GPFS; the FY2025-26 document is a one-page notice.

const PIN = CENTRAL_DARLING_GPFS_DOCUMENT_PIN;

const { BROWSER_BYTES, PLAIN_BYTES } = vi.hoisted(() => ({
  BROWSER_BYTES: Buffer.from('browser-fetched-central-darling-gpfs-bytes'),
  PLAIN_BYTES: Buffer.from('plain-fetched-central-darling-gpfs-bytes'),
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
      return `<a href="${PIN}">cdsc-annual_financial_statements-2025-olg.pdf</a>`;
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
            return Buffer.from('browser-fetched-central-darling-gpfs-bytes');
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

const { fetchCentralDarlingGpfsViaBrowser } = await import(
  '../../scripts/central-darling-gpfs-browser.js'
);

function parsedFixture() {
  return parseCentralDarlingGpfsExtraction(
    centralDarlingExtraction(),
    CENTRAL_DARLING_CONTEXT,
  );
}

describe('Central Darling Shire Council audited GPFS discovery', () => {
  it('pins the latest available full audited FY2024-25 GPFS and its exact bytes', () => {
    expect(CENTRAL_DARLING_GPFS_FISCAL_YEAR).toBe('2024-25');
    const pinned = centralDarlingPinnedDocument();
    expect(pinned.url).toBe(PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.listing_url).toBe(CENTRAL_DARLING_GPFS_REPORTING_URL);
    expect(CENTRAL_DARLING_GPFS_STANDALONE_FS_BYTES).toBe(3_386_192);
    expect(CENTRAL_DARLING_GPFS_STANDALONE_FS_PAGES).toBe(102);
    expect(CENTRAL_DARLING_GPFS_STANDALONE_FS_SHA256).toBe(
      'b583822dce9f5bac927d04dd60455f1de058f8542f990817839e3ed03c53b5c6',
    );
  });

  it('uses the official domain and never a mirror host', () => {
    expect(new URL(CENTRAL_DARLING_GPFS_DOCUMENT_PIN).host).toBe(
      'www.centraldarling.nsw.gov.au',
    );
    expect(new URL(CENTRAL_DARLING_GPFS_REPORTING_URL).host).toBe(
      'www.centraldarling.nsw.gov.au',
    );
    expect(new URL(CENTRAL_DARLING_GPFS_CURRENT_ANNUAL_REPORT_PIN).host).toBe(
      'www.centraldarling.nsw.gov.au',
    );
    expect(new URL(CENTRAL_DARLING_GPFS_2025_26_NOTICE_PIN).host).toBe(
      'www.centraldarling.nsw.gov.au',
    );
    expect(CENTRAL_DARLING_GPFS_DOCUMENT_PIN).not.toMatch(
      /webcache|archive\.org|googleusercontent/,
    );
  });

  it('refuses to substitute a different year', () => {
    expect(() => discoverCentralDarlingGpfsDocument('2025-26')).toThrow(/No pinned/);
    expect(() => discoverCentralDarlingGpfsDocument('2023-24')).toThrow(/No pinned/);
    expect(centralDarlingPinnedDocument().fiscal_year).toBe('2024-25');
  });

  it('parses only explicit year conventions and never a bare year', () => {
    expect(
      fiscalYearFromCentralDarlingFinancialStatementsDoc(
        'Central Darling General Purpose Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromCentralDarlingFinancialStatementsDoc(
        'cdsc-annual_financial_statements-2025-olg.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromCentralDarlingFinancialStatementsDoc('Annual Financial Statements 2024-2025'),
    ).toBe('2024-25');
    expect(fiscalYearFromCentralDarlingFinancialStatementsDoc('2025')).toBeNull();
    expect(
      fiscalYearFromCentralDarlingFinancialStatementsDoc(
        'Long Term Financial Plan 2025-2035.pdf',
      ),
    ).toBeNull();
  });

  it('documents the plain-UA WAF quirk', () => {
    expect(CENTRAL_DARLING_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    expect(CENTRAL_DARLING_GPFS_REQUEST_HEADERS.accept).toContain('application/pdf');
  });

  it('fetches the pinned GPFS through the browser path', async () => {
    const fetched = await fetchCentralDarlingGpfsViaBrowser();
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
      if (url === CENTRAL_DARLING_GPFS_REPORTING_URL) {
        return new Response(
          `<a href="${PIN}">cdsc-annual_financial_statements-2025-olg.pdf</a>`,
          { status: 200 },
        );
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchCentralDarlingGpfsViaBrowser(
      CENTRAL_DARLING_GPFS_REPORTING_URL,
      '2024-25',
      { forcePlain: true, fetchImpl },
    );
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(PIN);
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('Central Darling standalone GPFS slice', () => {
  it('emits 17 printed statement lines with exact face, B1-1 and balance-sheet reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(CENTRAL_DARLING_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(CENTRAL_DARLING_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(32_135);
    expect(recon.total_expenses).toBe(37_850);
    expect(recon.employee_expenses).toBe(7_372);
    expect(recon.materials_and_services).toBe(20_804);
    expect(recon.borrowing_costs).toBe(75);
    expect(recon.other_expenses).toBe(626);
    expect(recon.depreciation_amortisation_impairment).toBe(7_041);
    expect(recon.government_grants_operating).toBe(15_844);
    expect(recon.government_grants_capital).toBe(6_835);
    expect(recon.net_loss_from_disposal_of_assets).toBe(1_932);
    expect(recon.net_result).toBe(-5_715);
    expect(recon.net_result_before_capital_grants).toBe(-12_550);
    expect(recon.operating_result_excluding_depreciation).toBe(1_326);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(30_809);
    expect(recon.functions_income).toBe(32_191);
    expect(recon.functions_total_expenses).toBe(37_906);
    expect(recon.functions_operating_result).toBe(-5_715);
    expect(recon.functions_grants_and_contributions).toBe(22_679);
    expect(recon.functions_carrying_amount).toBe(304_214);
    expect(recon.functions_internal_allocation).toBe(56);
    expect(recon.comprehensive_total).toBe(23_178);
    expect(recon.comprehensive_other_income).toBe(28_893);
    expect(recon.comprehensive_revaluation).toBe(28_893);
    expect(recon.comprehensive_attributable_council).toBe(23_178);
    expect(recon.total_assets).toBe(304_214);
    expect(recon.total_liabilities).toBe(9_887);
    expect(recon.net_assets).toBe(294_327);
    expect(recon.total_equity).toBe(294_327);
    expect(recon.council_equity_interest).toBe(294_327);
    expect(recon.cash_operating).toBe(9_743);
    expect(recon.cash_investing).toBe(-13_507);
    expect(recon.cash_financing).toBe(-535);
    expect(recon.cash_net_change).toBe(-4_299);
    expect(recon.cash_opening).toBe(14_734);
    expect(recon.cash_closing).toBe(10_435);
    expect(recon.checks).toHaveLength(13);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(
      parsedFixture().records.map((record) => [record.gpfs_line_item, record]),
    );
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(254_700_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(3_213_500_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(3_785_000_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(571_500_000);
    expect(byKey.get('net_result')!.gpfs_printed_sign).toBe('negative');
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
    expect(byKey.get('net_result')!.source_dataset).toBe(
      'Central Darling Shire Council GPFS 2024-25',
    );
  });

  it('parses B1-1 Total functions and activities', () => {
    const totals = parseCentralDarlingGpfsFunctionsTotals({
      page_number: 15,
      text: CENTRAL_DARLING_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 15,
      income: 32_191,
      expenses: 37_906,
      operating_result: -5_715,
      grants_and_contributions: 22_679,
      carrying_amount: 304_214,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = centralDarlingExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 6
        ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') }
        : page,
    );
    const parsed = parseCentralDarlingGpfsExtraction(extraction, CENTRAL_DARLING_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = centralDarlingExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15
        ? { ...page, text: page.text.replace(/\$ '000/g, '$m') }
        : page,
    );
    const parsed = parseCentralDarlingGpfsExtraction(extraction, CENTRAL_DARLING_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = centralDarlingExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15
        ? { ...page, text: page.text.replace('304,214 280,810', '304,215 280,810') }
        : page,
    );
    const parsed = parseCentralDarlingGpfsExtraction(extraction, CENTRAL_DARLING_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Central Darling Shire Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = CENTRAL_DARLING_CONTEXT.document.url;
    const revenue = centralDarlingGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = centralDarlingGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^central-darling-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(centralDarlingGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(centralDarlingGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });

  it('keeps the fixture text anchored to the printed source lines and golden digest', () => {
    expect(CENTRAL_DARLING_INCOME_TEXT).toContain(
      'Total income from continuing operations 32,135 52,098',
    );
    expect(CENTRAL_DARLING_INCOME_TEXT).toContain('Net loss from the disposal of assets');
    expect(CENTRAL_DARLING_INCOME_TEXT).toContain('(5,715)');
    expect(CENTRAL_DARLING_GPFS_ID).toBe('central-darling-gpfs');
    expect(CENTRAL_DARLING_GPFS_NAME).toContain('Central Darling');
    expect(CENTRAL_DARLING_GPFS_PUBLISHER).toBe('Central Darling Shire Council');
    expect(CENTRAL_DARLING_GPFS_LICENSE).toContain('Central Darling Shire Council');
    expect(CENTRAL_DARLING_GPFS_REPORTING_URL).toContain('centraldarling.nsw.gov.au');
    expect(CENTRAL_DARLING_GPFS_GOLDEN_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_centraldarlinggpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CENTRAL_DARLING_GPFS_ID,
    name: CENTRAL_DARLING_GPFS_NAME,
    publisher: CENTRAL_DARLING_GPFS_PUBLISHER,
    source_url: CENTRAL_DARLING_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CENTRAL_DARLING_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'central-darling-gpfs-measure', record }));
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

describe('Central Darling GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-central-darling',
        project_name: 'Existing AusTender Central Darling contract',
        delivery_entity: 'CENTRAL DARLING SHIRE COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-central-darling-school',
        project_name: 'Existing data.nsw Central Darling school row (not a council row)',
        delivery_entity: 'Wilcannia Central School',
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
    expect(await MeasureModel.countDocuments({ source_id: CENTRAL_DARLING_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: CENTRAL_DARLING_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: CENTRAL_DARLING_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
