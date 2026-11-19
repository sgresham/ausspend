import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  FEDERATION_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  FEDERATION_GPFS_DOCUMENT_PIN,
  FEDERATION_GPFS_FISCAL_YEAR,
  FEDERATION_GPFS_ID,
  FEDERATION_GPFS_LICENSE,
  FEDERATION_GPFS_LINES,
  FEDERATION_GPFS_NAME,
  FEDERATION_GPFS_PUBLISHER,
  FEDERATION_GPFS_REPORTING_URL,
  FEDERATION_GPFS_REQUEST_HEADERS,
  FEDERATION_GPFS_STANDALONE_FS_BYTES,
  FEDERATION_GPFS_STANDALONE_FS_PAGES,
  FEDERATION_GPFS_STANDALONE_FS_SHA256,
  discoverFederationGpfsDocument,
  federationGpfsNaturalKey,
  federationPinnedDocument,
  fiscalYearFromFederationFinancialStatementsDoc,
  parseFederationGpfsExtraction,
  parseFederationGpfsFunctionsTotals,
} from '../src/connectors/federation-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  FEDERATION_CONTEXT,
  FEDERATION_FUNCTIONS_TEXT,
  FEDERATION_GPFS_GOLDEN_DIGEST,
  FEDERATION_GPFS_ROW_COUNT,
  FEDERATION_INCOME_TEXT,
  federationExtraction,
} from '../src/connectors/federation-gpfs/fixture.js';

// Federation Council's entire official site is behind Akamai bot protection:
// plain clients get HTTP 403 ("Access Denied") for the home page, robots.txt,
// sitemaps and every /files path, while a real headless Chromium session gets
// HTTP 200. The latest published audited Annual Financial Statements (FY2024-25)
// are pinned to the exact official upload and fetched through the browser/WAF
// path. No FY2025-26 financial statements were published as at 2026-11-20.

const PIN = FEDERATION_GPFS_DOCUMENT_PIN;

const { BROWSER_BYTES, PLAIN_BYTES } = vi.hoisted(() => ({
  BROWSER_BYTES: Buffer.from('browser-fetched-federation-afs-bytes'),
  PLAIN_BYTES: Buffer.from('plain-fetched-federation-afs-bytes'),
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
      return `<a href="${PIN}">Annual Financial Statements 2024-2025</a>`;
    },
    async evaluate(_fn: (url: string) => Promise<string>, _url: string) {
      return Buffer.from('browser-fetched-federation-afs-bytes').toString('base64');
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

const { fetchFederationGpfsViaBrowser } = await import('../../scripts/federation-gpfs-browser.js');

function parsedFixture() {
  return parseFederationGpfsExtraction(federationExtraction(), FEDERATION_CONTEXT);
}

describe('Federation Council audited GPFS discovery', () => {
  it('pins the latest published audited FY2024-25 AFS/GPFS and its exact bytes', () => {
    expect(FEDERATION_GPFS_FISCAL_YEAR).toBe('2024-25');
    const pinned = federationPinnedDocument();
    expect(pinned.url).toBe(PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.listing_url).toBe(FEDERATION_GPFS_REPORTING_URL);
    expect(FEDERATION_GPFS_STANDALONE_FS_BYTES).toBe(4_790_806);
    expect(FEDERATION_GPFS_STANDALONE_FS_PAGES).toBe(114);
    expect(FEDERATION_GPFS_STANDALONE_FS_SHA256).toBe(
      '7dbdc2a08b4f03e217f1112db1684c1302363d6632ce2660c1f8717779426ca5',
    );
  });

  it('uses the official domain and never a mirror host', () => {
    expect(new URL(FEDERATION_GPFS_DOCUMENT_PIN).host).toBe(
      'www.federationcouncil.nsw.gov.au',
    );
    expect(new URL(FEDERATION_GPFS_REPORTING_URL).host).toBe(
      'www.federationcouncil.nsw.gov.au',
    );
    expect(new URL(FEDERATION_GPFS_CURRENT_ANNUAL_REPORT_PIN).host).toBe(
      'www.federationcouncil.nsw.gov.au',
    );
    expect(FEDERATION_GPFS_DOCUMENT_PIN).not.toMatch(/webcache|archive\.org|googleusercontent/);
  });

  it('refuses to substitute a different year', () => {
    expect(() => discoverFederationGpfsDocument('2025-26')).toThrow(/No pinned/);
    expect(() => discoverFederationGpfsDocument('2023-24')).toThrow(/No pinned/);
    expect(federationPinnedDocument().fiscal_year).toBe('2024-25');
  });

  it('parses only explicit year conventions and never a bare year', () => {
    expect(
      fiscalYearFromFederationFinancialStatementsDoc(
        'Federation Council Annual Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromFederationFinancialStatementsDoc('Annual Financial Statements 2024-2025'),
    ).toBe('2024-25');
    expect(fiscalYearFromFederationFinancialStatementsDoc('Annual Financial Statements 2025')).toBe(
      null,
    );
    expect(
      fiscalYearFromFederationFinancialStatementsDoc('Long Term Financial Plan 2025-2035.pdf'),
    ).toBeNull();
  });

  it('documents the Akamai WAF gate with a browser user agent', () => {
    expect(FEDERATION_GPFS_REQUEST_HEADERS['user-agent']).toContain('Chrome');
    expect(FEDERATION_GPFS_REQUEST_HEADERS.accept).toContain('application/pdf');
  });

  it('fetches the pinned AFS through the browser path', async () => {
    const fetched = await fetchFederationGpfsViaBrowser();
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
      if (url === FEDERATION_GPFS_REPORTING_URL) {
        return new Response(
          `<a href="/files/assets/public/v/1/document-library/corporate-documents/other/financial-statements/federation-council-annual_financial_statements-2025.pdf">Annual Financial Statements 2024-2025</a>`,
          { status: 200 },
        );
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchFederationGpfsViaBrowser(FEDERATION_GPFS_REPORTING_URL, '2024-25', {
      forcePlain: true,
      fetchImpl,
    });
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(PIN);
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('Federation Council GPFS slice', () => {
  it('emits 17 printed statement lines with exact face, B1-1 and balance-sheet reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(FEDERATION_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(FEDERATION_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(57_687);
    expect(recon.total_expenses).toBe(55_229);
    expect(recon.employee_expenses).toBe(17_354);
    expect(recon.materials_and_services).toBe(17_561);
    expect(recon.borrowing_costs).toBe(525);
    expect(recon.other_expenses).toBe(575);
    expect(recon.net_loss_from_disposal_of_assets).toBe(926);
    expect(recon.depreciation_amortisation_impairment).toBe(18_288);
    expect(recon.government_grants_operating).toBe(13_299);
    expect(recon.government_grants_capital).toBe(5_590);
    expect(recon.net_gain_from_disposal_of_assets).toBe(0);
    expect(recon.net_result).toBe(2_458);
    expect(recon.net_result_before_capital_grants).toBe(-3_132);
    expect(recon.operating_result_excluding_depreciation).toBe(20_746);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(36_941);
    expect(recon.functions_income).toBe(57_687);
    expect(recon.functions_total_expenses).toBe(55_229);
    expect(recon.functions_operating_result).toBe(2_458);
    expect(recon.functions_grants_and_contributions).toBe(18_889);
    expect(recon.functions_carrying_amount).toBe(966_188);
    expect(recon.comprehensive_total).toBe(62_731);
    expect(recon.comprehensive_other_income).toBe(60_273);
    expect(recon.comprehensive_revaluation).toBe(60_273);
    expect(recon.comprehensive_joint_ventures).toBe(0);
    expect(recon.comprehensive_attributable_council).toBe(62_731);
    expect(recon.total_assets).toBe(966_188);
    expect(recon.total_liabilities).toBe(33_887);
    expect(recon.net_assets).toBe(932_301);
    expect(recon.council_equity_interest).toBe(932_301);
    expect(recon.total_equity).toBe(932_301);
    expect(recon.cash_operating).toBe(12_160);
    expect(recon.cash_investing).toBe(-29_233);
    expect(recon.cash_financing).toBe(-949);
    expect(recon.cash_net_change).toBe(-18_022);
    expect(recon.cash_opening).toBe(24_964);
    expect(recon.cash_closing).toBe(6_942);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(2_291_300_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(5_768_700_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(5_522_900_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(245_800_000);
    expect(byKey.get('net_gain_from_disposal_of_assets')!.gpfs_section).toBe('revenue');
    expect(byKey.get('net_gain_from_disposal_of_assets')!.amount_cents).toBe(0);
    expect(byKey.get('net_loss_from_disposal_of_assets')!.gpfs_section).toBe('expenses');
    expect(byKey.get('net_loss_from_disposal_of_assets')!.amount_cents).toBe(92_600_000);
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('government_grants_operating')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(byKey.get('net_loss_from_disposal_of_assets')!.gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(byKey.get('net_result')!.notes).toContain('unit: thousands (explicit');
    expect(byKey.get('net_result')!.source_dataset).toBe('Federation Council GPFS 2024-25');
  });

  it('parses B1-1 Total functions and activities on Federation’s layout', () => {
    const totals = parseFederationGpfsFunctionsTotals({
      page_number: 14,
      text: FEDERATION_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 14,
      income: 57_687,
      expenses: 55_229,
      operating_result: 2_458,
      grants_and_contributions: 18_889,
      carrying_amount: 966_188,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = federationExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 5 ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') } : page,
    );
    const parsed = parseFederationGpfsExtraction(extraction, FEDERATION_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = federationExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 14 ? { ...page, text: page.text.replace(/\$ '000/g, '$m') } : page,
    );
    const parsed = parseFederationGpfsExtraction(extraction, FEDERATION_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = federationExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 14 ? { ...page, text: page.text.replace('55,229', '55,230') } : page,
    );
    const parsed = parseFederationGpfsExtraction(extraction, FEDERATION_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Federation Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = FEDERATION_CONTEXT.document.url;
    const revenue = federationGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = federationGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^federation-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(federationGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(federationGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });

  it('keeps the fixture text anchored to the printed source lines and golden digest', () => {
    expect(FEDERATION_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(FEDERATION_INCOME_TEXT).toContain('Net loss from the disposal of assets');
    expect(FEDERATION_INCOME_TEXT).toContain('(3,132)');
    expect(FEDERATION_GPFS_ID).toBe('federation-gpfs');
    expect(FEDERATION_GPFS_NAME).toContain('Federation');
    expect(FEDERATION_GPFS_PUBLISHER).toBe('Federation Council');
    expect(FEDERATION_GPFS_LICENSE).toContain('Federation Council');
    expect(FEDERATION_GPFS_REPORTING_URL).toContain('federationcouncil.nsw.gov.au');
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
    expect(digest).toBe(FEDERATION_GPFS_GOLDEN_DIGEST);
  });

  it('keeps natural keys unique so re-ingesting the same rows is idempotent', () => {
    const records = parsedFixture().records;
    expect(new Set(records.map((record) => record.natural_key)).size).toBe(records.length);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_federationgpfs`;

let dbReady = false;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: FEDERATION_GPFS_ID,
    name: FEDERATION_GPFS_NAME,
    publisher: FEDERATION_GPFS_PUBLISHER,
    source_url: FEDERATION_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: FEDERATION_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'federation-gpfs-measure', record }));
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

describe('Federation Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    try {
      await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 2_000 });
      await mongoose.connection.dropDatabase();
      await MeasureModel.insertMany([
        {
          amount_cents: 12_345_000,
          measure_type: 'contract',
          fiscal_year: '2024-25',
          source_id: 'aus-tender',
          source_url: 'https://www.tenders.gov.au/example',
          verified: false,
          natural_key: 'prod-existing-aus-tender-federation',
          project_name: 'Existing AusTender Federation contract',
          delivery_entity: 'FEDERATION COUNCIL',
        },
        {
          amount_cents: 123_456,
          measure_type: 'budget',
          fiscal_year: '2024-25',
          source_id: 'data-nsw-ckan',
          source_url: 'https://data.nsw.gov.au/example',
          verified: false,
          natural_key: 'data-nsw-existing-federation-school',
          project_name: 'Existing data.nsw Federation school row (not a council row)',
          delivery_entity: 'Federation Public School',
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

  it('adds exactly 17 rows, preserves existing rows, and is idempotent', async (ctx) => {
    if (!dbReady) {
      ctx.skip('MongoDB is not available; run with TEST_MONGO_URL to exercise ingestion');
      return;
    }
    const { records } = parsedFixture();
    expect(records).toHaveLength(17);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: FEDERATION_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: FEDERATION_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: FEDERATION_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
