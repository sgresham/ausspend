import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  CARRATHOOL_GPFS_DOCUMENT_PIN,
  CARRATHOOL_GPFS_FISCAL_YEAR,
  CARRATHOOL_GPFS_ID,
  CARRATHOOL_GPFS_LICENSE,
  CARRATHOOL_GPFS_LINES,
  CARRATHOOL_GPFS_MEDIA_SEARCH_URL,
  CARRATHOOL_GPFS_NAME,
  CARRATHOOL_GPFS_PUBLISHER,
  CARRATHOOL_GPFS_REPORTING_URL,
  CARRATHOOL_GPFS_REQUEST_HEADERS,
  CARRATHOOL_GPFS_STANDALONE_FS_BYTES,
  CARRATHOOL_GPFS_STANDALONE_FS_PAGES,
  CARRATHOOL_GPFS_STANDALONE_FS_SHA256,
  carrathoolGpfsNaturalKey,
  carrathoolPinnedDocument,
  discoverCarrathoolGpfsDocument,
  fiscalYearFromCarrathoolFinancialStatementsDoc,
  parseCarrathoolGpfsExtraction,
  parseCarrathoolGpfsFunctionsTotals,
  parseCarrathoolMediaSearch,
  selectCarrathoolGpfsDocument,
} from '../src/connectors/carrathool-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  CARRATHOOL_CONTEXT,
  CARRATHOOL_FUNCTIONS_TEXT,
  CARRATHOOL_GPFS_GOLDEN_DIGEST,
  CARRATHOOL_GPFS_ROW_COUNT,
  CARRATHOOL_INCOME_TEXT,
  carrathoolExtraction,
} from '../src/connectors/carrathool-gpfs/fixture.js';

// Carrathool's annual-report page and page sitemap stop at the combined FY2023-24
// narrative report. The current audited FY2025-26 GPFS is nevertheless published
// by the council as WordPress media and is discoverable from its own media REST
// index. The connector ingests only that current GPFS; the prior FY2024-25 file
// (bare-year filename) is not substituted.

const PUBLIC_FS =
  'https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf';
const AGENDA_FS =
  'https://carrathool.nsw.gov.au/wp-content/uploads/Agendas-Minutes/Separately-Circulated/2026-October/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf';
const PRIOR_FS =
  'https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Carrathool-Shire-Annual-Financial-Statements-24-25.pdf';
const FUTURE_FS =
  'https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Carrathool-Shire-Annual-Financial-Statements-26-27.pdf';

function mediaItem(slug: string, source_url: string, title: string, date = '2026-10-06T08:33:33') {
  return { slug, source_url, title: { rendered: title }, date, media_details: { filesize: 1 } };
}

const MEDIA_JSON = JSON.stringify([
  mediaItem(
    'carrathool-shire-annual-financial-statements-25-26-2',
    AGENDA_FS,
    'Carrathool Shire Annual Financial Statements 25 26',
    '2026-10-15T15:26:09',
  ),
  mediaItem(
    'carrathool-shire-annual-financial-statements-25-26',
    PUBLIC_FS,
    'Carrathool Shire Annual Financial Statements 25 26',
  ),
  mediaItem(
    'advertisement-annual-financial-statements-25-26',
    'https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Advertisement-Annual-Financial-Statements-25-26.pdf',
    'Advertisement Annual Financial Statements 25 26',
  ),
  mediaItem(
    '2025-2026-annual-financial-statement-for-planning-agreements',
    'https://carrathool.nsw.gov.au/wp-content/uploads/2026/10/2025-2026-Annual-Financial-Statement-for-Planning-Agreements.pdf',
    '2025-2026 Annual Financial Statement for Planning Agreements',
    '2026-10-13T09:39:29',
  ),
  mediaItem(
    'carrathool-shire-annual_financial_statements-2025',
    'https://carrathool.nsw.gov.au/wp-content/uploads/2025/11/Carrathool-Shire-Annual_Financial_Statements-2025.pdf',
    'Carrathool Shire Annual Financial Statements 2025',
    '2025-11-03T08:13:05',
  ),
]);

const { BROWSER_BYTES, BROWSER_MEDIA, PLAIN_BYTES } = vi.hoisted(() => ({
  BROWSER_MEDIA: JSON.stringify([
    {
      slug: 'carrathool-shire-annual-financial-statements-25-26',
      source_url:
        'https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf',
      title: { rendered: 'Carrathool Shire Annual Financial Statements 25 26' },
    },
  ]),
  BROWSER_BYTES: Buffer.from('browser-fetched-carrathool-fs-bytes'),
  PLAIN_BYTES: Buffer.from('plain-fetched-carrathool-fs-bytes'),
}));

vi.mock('playwright', () => {
  const page = {
    async goto() {
      return { ok: () => true, status: () => 200 };
    },
    async waitForTimeout() {
      return undefined;
    },
    async evaluate(fn: (url: string) => Promise<string>, url: string) {
      if (url.includes('/wp-json/')) return BROWSER_MEDIA;
      return Buffer.from('browser-fetched-carrathool-fs-bytes').toString('base64');
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

const { fetchCarrathoolGpfsViaBrowser } = await import('../../scripts/carrathool-gpfs-browser.js');

function parsedFixture() {
  return parseCarrathoolGpfsExtraction(carrathoolExtraction(), CARRATHOOL_CONTEXT);
}

describe('Carrathool Shire Council audited GPFS discovery', () => {
  it('parses the official media index and selects the current FY2025-26 Public Exhibition PDF', () => {
    expect(CARRATHOOL_GPFS_FISCAL_YEAR).toBe('2025-26');
    const documents = parseCarrathoolMediaSearch(MEDIA_JSON);
    expect(documents.map((document) => document.fiscal_year)).toEqual(['2025-26', '2025-26']);
    expect(new Set(documents.map((document) => document.fiscal_year))).toEqual(
      new Set(['2025-26']),
    );
    expect(documents).toHaveLength(2);
    const selected = selectCarrathoolGpfsDocument(documents, '2025-26');
    expect(selected.url).toBe(PUBLIC_FS);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(CARRATHOOL_GPFS_MEDIA_SEARCH_URL);
    expect(selected.title).toContain('Carrathool');
    expect(CARRATHOOL_GPFS_STANDALONE_FS_BYTES).toBe(5_397_495);
    expect(CARRATHOOL_GPFS_STANDALONE_FS_PAGES).toBe(114);
    expect(CARRATHOOL_GPFS_STANDALONE_FS_SHA256).toBe(
      'cf6c36b1c5fdeb5b95f21a4c2bac45a7b7715b38fa71cd8d5aa602ce11757ec4',
    );
  });

  it('prefers the stable Public Exhibition copy when the same document is published twice', () => {
    const selected = selectCarrathoolGpfsDocument(
      parseCarrathoolMediaSearch(MEDIA_JSON),
      '2025-26',
    );
    expect(selected.url).toContain('/Public-Exhibition/');
    expect(selected.url).not.toContain('/Agendas-Minutes/');
  });

  it('rejects the prior and future years and never substitutes a bare-year file', () => {
    const prior = JSON.stringify([
      mediaItem(
        'carrathool-shire-annual-financial-statements-24-25',
        PRIOR_FS,
        'Carrathool Shire Annual Financial Statements 24 25',
      ),
    ]);
    expect(() =>
      selectCarrathoolGpfsDocument(parseCarrathoolMediaSearch(prior), '2025-26'),
    ).toThrow(/No published/);
    const future = JSON.stringify([
      mediaItem(
        'carrathool-shire-annual-financial-statements-26-27',
        FUTURE_FS,
        'Carrathool Shire Annual Financial Statements 26 27',
      ),
    ]);
    expect(() =>
      selectCarrathoolGpfsDocument(parseCarrathoolMediaSearch(future), '2025-26'),
    ).toThrow(/No published/);
    expect(parseCarrathoolMediaSearch(MEDIA_JSON).map((document) => document.fiscal_year)).toEqual([
      '2025-26',
      '2025-26',
    ]);
  });

  it('excludes planning-agreement statements, contributions plans and advertisements', () => {
    expect(
      parseCarrathoolMediaSearch(MEDIA_JSON).some((document) =>
        /planning-agreements|contributions|advertisement/i.test(document.url),
      ),
    ).toBe(false);
  });

  it('parses only explicit year conventions and never a bare year', () => {
    expect(
      fiscalYearFromCarrathoolFinancialStatementsDoc(
        'Carrathool Shire Annual Financial Statements 25-26',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromCarrathoolFinancialStatementsDoc(
        'Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromCarrathoolFinancialStatementsDoc('Annual Financial Statements 2025-2026'),
    ).toBe('2025-26');
    expect(fiscalYearFromCarrathoolFinancialStatementsDoc('Annual Financial Statements 2025')).toBe(
      null,
    );
    expect(
      fiscalYearFromCarrathoolFinancialStatementsDoc('Long Term Financial Plan 2026-2036.pdf'),
    ).toBeNull();
  });

  it('uses the documented official pin when the media index yields nothing usable', async () => {
    const pinned = carrathoolPinnedDocument();
    expect(pinned.url).toBe(CARRATHOOL_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    const discovered = await discoverCarrathoolGpfsDocument(
      (async () => new Response('[]', { status: 200 })) as typeof fetch,
      '2025-26',
      '[]',
    );
    expect(discovered.url).toBe(CARRATHOOL_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the media index returns a 403', async () => {
    const discovered = await discoverCarrathoolGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(CARRATHOOL_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA to the official media index', async () => {
    expect(CARRATHOOL_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenUrl: string | undefined;
    let seenHeaders: Record<string, string> | undefined;
    await discoverCarrathoolGpfsDocument(
      (async (input: RequestInfo | URL, init?: RequestInit) => {
        seenUrl = String(input);
        seenHeaders = init?.headers as Record<string, string>;
        return new Response('[]', { status: 200 });
      }) as typeof fetch,
      '2025-26',
    );
    expect(seenUrl).toBe(CARRATHOOL_GPFS_MEDIA_SEARCH_URL);
    expect(seenHeaders?.['user-agent']).toBe('curl/8.5.0');
    expect(seenHeaders?.['user-agent']).not.toContain('Chrome');
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverCarrathoolGpfsDocument(
        (async () => new Response('[]', { status: 200 })) as typeof fetch,
        '2024-25',
        '[]',
      ),
    ).rejects.toThrow(/No published/);
  });

  it('fetches the annual financial statements through the browser path', async () => {
    const fetched = await fetchCarrathoolGpfsViaBrowser();
    expect(fetched.pdfUrl).toBe(PUBLIC_FS);
    expect(fetched.mediaJson).toBe(BROWSER_MEDIA);
    expect(fetched.viaBrowser).toBe(true);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
  });

  it('falls back to the plain client when the browser path is refused', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      if (String(input) === CARRATHOOL_GPFS_MEDIA_SEARCH_URL) {
        return new Response(MEDIA_JSON, { status: 200 });
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchCarrathoolGpfsViaBrowser(
      CARRATHOOL_GPFS_MEDIA_SEARCH_URL,
      '2025-26',
      { forcePlain: true, fetchImpl },
    );
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(PUBLIC_FS);
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('Carrathool Shire Council standalone GPFS slice', () => {
  it('emits 16 printed statement lines with exact face, B1-1 and balance-sheet reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(CARRATHOOL_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(16);
    expect(parsed.rejections).toEqual([]);
    expect(CARRATHOOL_GPFS_LINES).toHaveLength(16);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(36_029);
    expect(recon.total_expenses).toBe(21_921);
    expect(recon.employee_expenses).toBe(9_413);
    expect(recon.materials_and_services).toBe(4_564);
    expect(recon.borrowing_costs).toBe(62);
    expect(recon.other_expenses).toBe(456);
    expect(recon.net_loss_from_disposal_of_assets).toBe(877);
    expect(recon.depreciation_amortisation_impairment).toBe(6_549);
    expect(recon.government_grants_operating).toBe(21_467);
    expect(recon.government_grants_capital).toBe(1_953);
    expect(recon.net_result).toBe(14_108);
    expect(recon.net_result_before_capital_grants).toBe(12_155);
    expect(recon.operating_result_excluding_depreciation).toBe(20_657);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(15_372);
    expect(recon.functions_income).toBe(36_029);
    expect(recon.functions_total_expenses).toBe(21_921);
    expect(recon.functions_operating_result).toBe(14_108);
    expect(recon.functions_grants_and_contributions).toBe(23_420);
    expect(recon.functions_carrying_amount).toBe(392_865);
    expect(recon.comprehensive_total).toBe(36_934);
    expect(recon.comprehensive_other_income).toBe(22_826);
    expect(recon.comprehensive_revaluation).toBe(22_823);
    expect(recon.comprehensive_other_movements).toBe(3);
    expect(recon.comprehensive_attributable_council).toBe(36_934);
    expect(recon.total_assets).toBe(392_865);
    expect(recon.total_liabilities).toBe(8_695);
    expect(recon.net_assets).toBe(384_170);
    expect(recon.council_equity_interest).toBe(384_170);
    expect(recon.total_equity).toBe(384_170);
    expect(recon.equity_rounding).toBe(3);
    expect(recon.cash_operating).toBe(21_879);
    expect(recon.cash_investing).toBe(-18_304);
    expect(recon.cash_financing).toBe(-332);
    expect(recon.cash_net_change).toBe(3_243);
    expect(recon.cash_opening).toBe(34_717);
    expect(recon.cash_closing).toBe(37_960);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(682_600_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(3_602_900_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(2_192_100_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(1_410_800_000);
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
    expect(byKey.get('net_result')!.source_dataset).toBe('Carrathool Shire Council GPFS 2025-26');
  });

  it('parses B1-1 Total functions and activities on Carrathool’s layout', () => {
    const totals = parseCarrathoolGpfsFunctionsTotals({
      page_number: 16,
      text: CARRATHOOL_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 16,
      income: 36_029,
      expenses: 21_921,
      operating_result: 14_108,
      grants_and_contributions: 23_420,
      carrying_amount: 392_865,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = carrathoolExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 6 ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') } : page,
    );
    const parsed = parseCarrathoolGpfsExtraction(extraction, CARRATHOOL_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = carrathoolExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 16 ? { ...page, text: page.text.replace(/\$ '000/g, '$m') } : page,
    );
    const parsed = parseCarrathoolGpfsExtraction(extraction, CARRATHOOL_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = carrathoolExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 16 ? { ...page, text: page.text.replace('21,921', '21,922') } : page,
    );
    const parsed = parseCarrathoolGpfsExtraction(extraction, CARRATHOOL_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Carrathool Shire Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2025-26')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = CARRATHOOL_CONTEXT.document.url;
    const revenue = carrathoolGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = carrathoolGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^carrathool-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(carrathoolGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(carrathoolGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });

  it('keeps the fixture text anchored to the printed source lines and golden digest', () => {
    expect(CARRATHOOL_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(CARRATHOOL_INCOME_TEXT).toContain('Net loss from the disposal of assets');
    expect(CARRATHOOL_INCOME_TEXT).toContain('12,155');
    expect(CARRATHOOL_GPFS_ID).toBe('carrathool-gpfs');
    expect(CARRATHOOL_GPFS_NAME).toContain('Carrathool');
    expect(CARRATHOOL_GPFS_PUBLISHER).toBe('Carrathool Shire Council');
    expect(CARRATHOOL_GPFS_LICENSE).toContain('Carrathool Shire Council');
    expect(CARRATHOOL_GPFS_REPORTING_URL).toContain('carrathool.nsw.gov.au');
    expect(CARRATHOOL_GPFS_GOLDEN_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_carrathoolgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CARRATHOOL_GPFS_ID,
    name: CARRATHOOL_GPFS_NAME,
    publisher: CARRATHOOL_GPFS_PUBLISHER,
    source_url: CARRATHOOL_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CARRATHOOL_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'carrathool-gpfs-measure', record }));
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

describe('Carrathool Shire Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-carrathool',
        project_name: 'Existing AusTender Carrathool contract',
        delivery_entity: 'CARRATHOOL SHIRE COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-carrathool-school',
        project_name: 'Existing data.nsw Carrathool school row (not a council row)',
        delivery_entity: 'Carrathool Public School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('adds exactly 16 rows, preserves existing rows, and is idempotent', async () => {
    const { records } = parsedFixture();
    expect(records).toHaveLength(16);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: CARRATHOOL_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(18);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: CARRATHOOL_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(18);

    const source = await DataSourceModel.findOne({ source_id: CARRATHOOL_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(16);
  });
});
