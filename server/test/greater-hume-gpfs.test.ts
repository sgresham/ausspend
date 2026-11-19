import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  GREATER_HUME_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  GREATER_HUME_GPFS_DOCUMENT_PIN,
  GREATER_HUME_GPFS_FISCAL_YEAR,
  GREATER_HUME_GPFS_ID,
  GREATER_HUME_GPFS_LICENSE,
  GREATER_HUME_GPFS_LINES,
  GREATER_HUME_GPFS_NAME,
  GREATER_HUME_GPFS_PUBLISHER,
  GREATER_HUME_GPFS_REPORTING_URL,
  GREATER_HUME_GPFS_REQUEST_HEADERS,
  GREATER_HUME_GPFS_STANDALONE_FS_BYTES,
  GREATER_HUME_GPFS_STANDALONE_FS_PAGES,
  GREATER_HUME_GPFS_STANDALONE_FS_SHA256,
  discoverGreaterHumeGpfsDocument,
  fiscalYearFromGreaterHumeFinancialStatementsDoc,
  greaterHumeGpfsNaturalKey,
  greaterHumePinnedDocument,
  parseGreaterHumeGpfsExtraction,
  parseGreaterHumeGpfsFunctionsTotals,
} from '../src/connectors/greater-hume-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  GREATER_HUME_CONTEXT,
  GREATER_HUME_FUNCTIONS_TEXT,
  GREATER_HUME_GPFS_GOLDEN_DIGEST,
  GREATER_HUME_GPFS_ROW_COUNT,
  GREATER_HUME_INCOME_TEXT,
  greaterHumeExtraction,
} from '../src/connectors/greater-hume-gpfs/fixture.js';

// Greater Hume Shire Council's entire official site is behind Akamai bot
// protection: plain clients get HTTP 403 ("Access Denied") for the home page and
// every /files path, while a real headless Chromium session gets HTTP 200. The
// current audited FY2025-26 Annual Financial Statements are pinned to the exact
// official upload and fetched through the browser/WAF path.

const PIN = GREATER_HUME_GPFS_DOCUMENT_PIN;

const { BROWSER_BYTES, PLAIN_BYTES } = vi.hoisted(() => ({
  BROWSER_BYTES: Buffer.from('browser-fetched-greater-hume-afs-bytes'),
  PLAIN_BYTES: Buffer.from('plain-fetched-greater-hume-afs-bytes'),
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
      return `<a href="${PIN}">Annual Financial Statements 2025-2026</a>`;
    },
    async evaluate(_fn: (url: string) => Promise<string>, _url: string) {
      return Buffer.from('browser-fetched-greater-hume-afs-bytes').toString('base64');
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

const { fetchGreaterHumeGpfsViaBrowser } = await import(
  '../../scripts/greater-hume-gpfs-browser.js'
);

function parsedFixture() {
  return parseGreaterHumeGpfsExtraction(greaterHumeExtraction(), GREATER_HUME_CONTEXT);
}

describe('Greater Hume Shire Council audited GPFS discovery', () => {
  it('pins the current audited FY2025-26 AFS/GPFS and its exact bytes', () => {
    expect(GREATER_HUME_GPFS_FISCAL_YEAR).toBe('2025-26');
    const pinned = greaterHumePinnedDocument();
    expect(pinned.url).toBe(PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.listing_url).toBe(GREATER_HUME_GPFS_REPORTING_URL);
    expect(GREATER_HUME_GPFS_STANDALONE_FS_BYTES).toBe(26_114_412);
    expect(GREATER_HUME_GPFS_STANDALONE_FS_PAGES).toBe(122);
    expect(GREATER_HUME_GPFS_STANDALONE_FS_SHA256).toBe(
      'f181da5b9a70f33ec4c2a2ee5fbac7b0eae5ebd4162e91624226c675fefe9db5',
    );
  });

  it('uses the official domain and never a mirror host', () => {
    expect(new URL(GREATER_HUME_GPFS_DOCUMENT_PIN).host).toBe(
      'www.greaterhume.nsw.gov.au',
    );
    expect(new URL(GREATER_HUME_GPFS_REPORTING_URL).host).toBe(
      'www.greaterhume.nsw.gov.au',
    );
    expect(new URL(GREATER_HUME_GPFS_CURRENT_ANNUAL_REPORT_PIN).host).toBe(
      'www.greaterhume.nsw.gov.au',
    );
    expect(GREATER_HUME_GPFS_DOCUMENT_PIN).not.toMatch(
      /webcache|archive\.org|googleusercontent/,
    );
  });

  it('refuses to substitute a different year', () => {
    expect(() => discoverGreaterHumeGpfsDocument('2024-25')).toThrow(/No pinned/);
    expect(() => discoverGreaterHumeGpfsDocument('2026-27')).toThrow(/No pinned/);
    expect(greaterHumePinnedDocument().fiscal_year).toBe('2025-26');
  });

  it('parses only explicit year conventions and never a bare year', () => {
    expect(
      fiscalYearFromGreaterHumeFinancialStatementsDoc(
        'Greater Hume Shire Council Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromGreaterHumeFinancialStatementsDoc(
        'greater-hume-council-financial-statements-2025-2026-final.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromGreaterHumeFinancialStatementsDoc('Annual Financial Statements 2026'),
    ).toBe(null);
    expect(
      fiscalYearFromGreaterHumeFinancialStatementsDoc('Long Term Financial Plan 2026-2036.pdf'),
    ).toBeNull();
  });

  it('documents the Akamai WAF gate with a browser user agent', () => {
    expect(GREATER_HUME_GPFS_REQUEST_HEADERS['user-agent']).toContain('Chrome');
    expect(GREATER_HUME_GPFS_REQUEST_HEADERS.accept).toContain('application/pdf');
  });

  it('fetches the pinned AFS through the browser path', async () => {
    const fetched = await fetchGreaterHumeGpfsViaBrowser();
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
      if (url === GREATER_HUME_GPFS_REPORTING_URL) {
        return new Response(
          `<a href="/files/sharedassets/public/v/1/have-your-say/2026/greater-hume-council-financial-statements-2025-2026-final.pdf">Annual Financial Statements 2025-2026</a>`,
          { status: 200 },
        );
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchGreaterHumeGpfsViaBrowser(
      GREATER_HUME_GPFS_REPORTING_URL,
      '2025-26',
      {
        forcePlain: true,
        fetchImpl,
      },
    );
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(PIN);
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('Greater Hume Shire Council GPFS slice', () => {
  it('emits 18 printed statement lines with exact face, B1-1 and balance-sheet reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(GREATER_HUME_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(18);
    expect(parsed.rejections).toEqual([]);
    expect(GREATER_HUME_GPFS_LINES).toHaveLength(18);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(51_700);
    expect(recon.total_expenses).toBe(52_015);
    expect(recon.employee_expenses).toBe(15_967);
    expect(recon.materials_and_services).toBe(15_860);
    expect(recon.borrowing_costs).toBe(175);
    expect(recon.other_expenses).toBe(1_907);
    expect(recon.net_loss_from_disposal_of_assets).toBe(0);
    expect(recon.depreciation_amortisation_impairment).toBe(18_106);
    expect(recon.government_grants_operating).toBe(19_622);
    expect(recon.government_grants_capital).toBe(1_494);
    expect(recon.net_gain_from_disposal_of_assets).toBe(1_258);
    expect(recon.net_result).toBe(-315);
    expect(recon.net_result_before_capital_grants).toBe(-1_809);
    expect(recon.operating_result_excluding_depreciation).toBe(17_791);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(33_909);
    expect(recon.functions_income).toBe(51_700);
    expect(recon.functions_total_expenses).toBe(52_015);
    expect(recon.functions_operating_result).toBe(-315);
    expect(recon.functions_grants_and_contributions).toBe(21_116);
    expect(recon.functions_carrying_amount).toBe(981_118);
    expect(recon.comprehensive_total).toBe(30_970);
    expect(recon.comprehensive_other_income).toBe(31_285);
    expect(recon.comprehensive_revaluation).toBe(31_285);
    expect(recon.comprehensive_joint_ventures).toBe(0);
    expect(recon.comprehensive_attributable_council).toBe(30_970);
    expect(recon.total_assets).toBe(981_118);
    expect(recon.total_liabilities).toBe(16_658);
    expect(recon.net_assets).toBe(964_460);
    expect(recon.council_equity_interest).toBe(964_460);
    expect(recon.total_equity).toBe(964_460);
    expect(recon.cash_operating).toBe(20_747);
    expect(recon.cash_investing).toBe(-18_266);
    expect(recon.cash_financing).toBe(-404);
    expect(recon.cash_net_change).toBe(2_077);
    expect(recon.cash_opening).toBe(14_648);
    expect(recon.cash_closing).toBe(16_725);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(1_548_200_000);
    expect(byKey.get('other_income')!.amount_cents).toBe(23_900_000);
    expect(byKey.get('net_gain_from_disposal_of_assets')!.amount_cents).toBe(125_800_000);
    expect(byKey.get('net_loss_from_disposal_of_assets')!.amount_cents).toBe(0);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(5_170_000_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(5_201_500_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(31_500_000);
    expect(byKey.get('net_result')!.gpfs_printed_sign).toBe('negative');
    expect(byKey.get('net_gain_from_disposal_of_assets')!.gpfs_section).toBe('revenue');
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
    expect(byKey.get('net_result')!.source_dataset).toBe('Greater Hume Shire Council GPFS 2025-26');
  });

  it('parses B1-1 Total functions and activities on Greater Hume’s layout', () => {
    const totals = parseGreaterHumeGpfsFunctionsTotals({
      page_number: 18,
      text: GREATER_HUME_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 18,
      income: 51_700,
      expenses: 52_015,
      operating_result: -315,
      grants_and_contributions: 21_116,
      carrying_amount: 981_118,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = greaterHumeExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 8 ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') } : page,
    );
    const parsed = parseGreaterHumeGpfsExtraction(extraction, GREATER_HUME_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = greaterHumeExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 18 ? { ...page, text: page.text.replace(/\$ '000/g, '$m') } : page,
    );
    const parsed = parseGreaterHumeGpfsExtraction(extraction, GREATER_HUME_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = greaterHumeExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 18 ? { ...page, text: page.text.replace('52,015', '52,016') } : page,
    );
    const parsed = parseGreaterHumeGpfsExtraction(extraction, GREATER_HUME_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Greater Hume Shire Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2025-26')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = GREATER_HUME_CONTEXT.document.url;
    const revenue = greaterHumeGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = greaterHumeGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^greater-hume-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(greaterHumeGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(greaterHumeGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });

  it('keeps the fixture text anchored to the printed source lines and golden digest', () => {
    expect(GREATER_HUME_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(GREATER_HUME_INCOME_TEXT).toContain('Net gain from the disposal of assets');
    expect(GREATER_HUME_INCOME_TEXT).toContain('(1,809)');
    expect(GREATER_HUME_GPFS_ID).toBe('greater-hume-gpfs');
    expect(GREATER_HUME_GPFS_NAME).toContain('Greater Hume');
    expect(GREATER_HUME_GPFS_PUBLISHER).toBe('Greater Hume Shire Council');
    expect(GREATER_HUME_GPFS_LICENSE).toContain('Greater Hume');
    expect(GREATER_HUME_GPFS_REPORTING_URL).toContain('greaterhume.nsw.gov.au');
    const digest = createHash('sha256')
      .update(
        JSON.stringify(
          parsedFixture().records.map((record) => ({
            natural_key: record.natural_key,
            amount_cents: record.amount_cents,
          })),
        ),
      )
      .digest('hex');
    expect(digest).toBe(GREATER_HUME_GPFS_GOLDEN_DIGEST);
  });

  it('keeps natural keys unique so re-ingesting the same rows is idempotent', () => {
    const records = parsedFixture().records;
    expect(new Set(records.map((record) => record.natural_key)).size).toBe(records.length);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_greaterhumegpfs`;

let dbReady = false;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: GREATER_HUME_GPFS_ID,
    name: GREATER_HUME_GPFS_NAME,
    publisher: GREATER_HUME_GPFS_PUBLISHER,
    source_url: GREATER_HUME_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: GREATER_HUME_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'greater-hume-gpfs-measure', record }));
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

describe('Greater Hume Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    try {
      await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 2_000 });
      await mongoose.connection.dropDatabase();
      await MeasureModel.insertMany([
        {
          amount_cents: 12_345_000,
          measure_type: 'contract',
          fiscal_year: '2025-26',
          source_id: 'aus-tender',
          source_url: 'https://www.tenders.gov.au/example',
          verified: false,
          natural_key: 'prod-existing-aus-tender-greater-hume',
          project_name: 'Existing AusTender Greater Hume contract',
          delivery_entity: 'GREATER HUME SHIRE COUNCIL',
        },
        {
          amount_cents: 123_456,
          measure_type: 'budget',
          fiscal_year: '2025-26',
          source_id: 'data-nsw-ckan',
          source_url: 'https://data.nsw.gov.au/example',
          verified: false,
          natural_key: 'data-nsw-existing-greater-hume-school',
          project_name: 'Existing data.nsw Greater Hume school row (not a council row)',
          delivery_entity: 'Greater Hume Public School',
        },
      ]);
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  afterAll(async () => {
    if (dbReady) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('adds exactly 18 rows, preserves existing rows, and is idempotent', async (ctx) => {
    if (!dbReady) {
      ctx.skip('MongoDB is not available; run with TEST_MONGO_URL to exercise ingestion');
      return;
    }
    const { records } = parsedFixture();
    expect(records).toHaveLength(18);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: GREATER_HUME_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: GREATER_HUME_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    const source = await DataSourceModel.findOne({ source_id: GREATER_HUME_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
