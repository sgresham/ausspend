import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  OBERON_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  OBERON_GPFS_DOCUMENT_PIN,
  OBERON_GPFS_FISCAL_YEAR,
  OBERON_GPFS_ID,
  OBERON_GPFS_LICENSE,
  OBERON_GPFS_LINES,
  OBERON_GPFS_NAME,
  OBERON_GPFS_PUBLISHER,
  OBERON_GPFS_REPORTING_URL,
  OBERON_GPFS_REQUEST_HEADERS,
  OBERON_GPFS_STANDALONE_FS_BYTES,
  OBERON_GPFS_STANDALONE_FS_PAGES,
  OBERON_GPFS_STANDALONE_FS_SHA256,
  discoverOberonGpfsDocument,
  fiscalYearFromOberonFinancialStatementsDoc,
  oberonGpfsNaturalKey,
  oberonPinnedDocument,
  parseOberonGpfsExtraction,
  parseOberonGpfsFunctionsTotals,
} from '../src/connectors/oberon-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  OBERON_CONTEXT,
  OBERON_FUNCTIONS_TEXT,
  OBERON_GPFS_GOLDEN_DIGEST,
  OBERON_GPFS_ROW_COUNT,
  OBERON_INCOME_TEXT,
  oberonExtraction,
} from '../src/connectors/oberon-gpfs/fixture.js';

// The main Oberon site lists only a 52 MB combined annual report bundle. The
// separate FY2024-25 audited GPFS is published in the Documents tab of the
// official Have Your Say Oberon page; the document entry point triggers a
// browser download. The main site serves a plain UA but rejects a bare Chrome UA.

const PIN = OBERON_GPFS_DOCUMENT_PIN;

const { BROWSER_BYTES, PLAIN_BYTES } = vi.hoisted(() => ({
  BROWSER_BYTES: Buffer.from('browser-fetched-oberon-gpfs-bytes'),
  PLAIN_BYTES: Buffer.from('plain-fetched-oberon-gpfs-bytes'),
}));

vi.mock('playwright', () => {
  const download = {
    suggestedFilename: () => 'Annual_Financial_Statements-GPFS-2025 Complete.pdf',
    url: () => 'https://example.invalid/oberon-gpfs-2025.pdf',
    async createReadStream() {
      return {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('browser-fetched-oberon-gpfs-bytes');
        },
      };
    },
  };
  const page = {
    async goto() {
      return { ok: () => true, status: () => 200 };
    },
    async waitForTimeout() {
      return undefined;
    },
    async content() {
      return `<a href="${PIN}">Annual_Financial_Statements-GPFS-2025 Complete.pdf</a>`;
    },
    async waitForEvent(event: string) {
      if (event === 'download') return download;
      throw new Error(`unexpected event ${event}`);
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

const { fetchOberonGpfsViaBrowser } = await import('../../scripts/oberon-gpfs-browser.js');

function parsedFixture() {
  return parseOberonGpfsExtraction(oberonExtraction(), OBERON_CONTEXT);
}

describe('Oberon Council audited GPFS discovery', () => {
  it('pins the latest available full audited FY2024-25 GPFS and its exact bytes', () => {
    expect(OBERON_GPFS_FISCAL_YEAR).toBe('2024-25');
    const pinned = oberonPinnedDocument();
    expect(pinned.url).toBe(PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.listing_url).toBe(OBERON_GPFS_REPORTING_URL);
    expect(OBERON_GPFS_STANDALONE_FS_BYTES).toBe(7_118_843);
    expect(OBERON_GPFS_STANDALONE_FS_PAGES).toBe(80);
    expect(OBERON_GPFS_STANDALONE_FS_SHA256).toBe(
      'ef24ded09ec28724e7b622f97860685c606eeec42b6b31f38b59088ac866a630',
    );
  });

  it('uses the official oberon.nsw.gov.au domain and never a mirror host', () => {
    expect(new URL(OBERON_GPFS_DOCUMENT_PIN).host.endsWith('oberon.nsw.gov.au')).toBe(true);
    expect(new URL(OBERON_GPFS_REPORTING_URL).host.endsWith('oberon.nsw.gov.au')).toBe(true);
    expect(new URL(OBERON_GPFS_CURRENT_ANNUAL_REPORT_PIN).host.endsWith('oberon.nsw.gov.au')).toBe(
      true,
    );
    expect(OBERON_GPFS_DOCUMENT_PIN).not.toMatch(/webcache|archive\.org|googleusercontent/);
  });

  it('refuses to substitute a different year', () => {
    expect(() => discoverOberonGpfsDocument('2025-26')).toThrow(/No pinned/);
    expect(() => discoverOberonGpfsDocument('2023-24')).toThrow(/No pinned/);
    expect(oberonPinnedDocument().fiscal_year).toBe('2024-25');
  });

  it('parses only explicit year conventions and never a bare year', () => {
    expect(
      fiscalYearFromOberonFinancialStatementsDoc(
        'Oberon Council General Purpose Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromOberonFinancialStatementsDoc(
        'Annual_Financial_Statements-GPFS-2025 Complete.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromOberonFinancialStatementsDoc('Annual Financial Statements 2024-2025'),
    ).toBe('2024-25');
    expect(fiscalYearFromOberonFinancialStatementsDoc('2025')).toBeNull();
    expect(
      fiscalYearFromOberonFinancialStatementsDoc('Long Term Financial Plan 2025-2035.pdf'),
    ).toBeNull();
  });

  it('documents the plain-UA access path', () => {
    expect(OBERON_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    expect(OBERON_GPFS_REQUEST_HEADERS.accept).toContain('application/pdf');
  });

  it('captures the official browser download', async () => {
    const fetched = await fetchOberonGpfsViaBrowser();
    expect(fetched.pdfUrl).toBe(PIN);
    expect(fetched.viaBrowser).toBe(true);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
    expect(fetched.resolvedUrl).toContain('example.invalid');
    expect(fetched.listingHtml).toContain(PIN);
  });

  it('can use a test plain path when forced', async () => {
    const fetched = await fetchOberonGpfsViaBrowser(OBERON_GPFS_REPORTING_URL, '2024-25', {
      forcePlain: true,
      fetchImpl: (async () => new Response(PLAIN_BYTES, { status: 200 })) as typeof fetch,
    });
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(PIN);
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
  });
});

describe('Oberon standalone GPFS slice', () => {
  it('emits 17 printed statement lines with exact face, B1-1 and balance-sheet reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(OBERON_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(OBERON_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(28_947);
    expect(recon.total_expenses).toBe(25_822);
    expect(recon.employee_expenses).toBe(8_385);
    expect(recon.materials_and_services).toBe(6_956);
    expect(recon.borrowing_costs).toBe(167);
    expect(recon.other_expenses).toBe(708);
    expect(recon.depreciation_amortisation_impairment).toBe(7_216);
    expect(recon.government_grants_operating).toBe(4_030);
    expect(recon.government_grants_capital).toBe(10_757);
    expect(recon.net_loss_from_disposal_of_assets).toBe(2_390);
    expect(recon.net_result).toBe(3_125);
    expect(recon.net_result_before_capital_grants).toBe(-7_632);
    expect(recon.operating_result_excluding_depreciation).toBe(10_341);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(18_606);
    expect(recon.functions_income).toBe(28_947);
    expect(recon.functions_total_expenses).toBe(25_822);
    expect(recon.functions_operating_result).toBe(3_125);
    expect(recon.functions_grants_and_contributions).toBe(14_787);
    expect(recon.functions_carrying_amount).toBe(394_496);
    expect(recon.comprehensive_total).toBe(16_479);
    expect(recon.comprehensive_other_income).toBe(13_354);
    expect(recon.comprehensive_revaluation).toBe(13_354);
    expect(recon.comprehensive_attributable_council).toBe(16_479);
    expect(recon.total_assets).toBe(394_496);
    expect(recon.total_liabilities).toBe(7_289);
    expect(recon.net_assets).toBe(387_207);
    expect(recon.total_equity).toBe(387_207);
    expect(recon.council_equity_interest).toBe(387_207);
    expect(recon.cash_operating).toBe(5_059);
    expect(recon.cash_investing).toBe(-5_832);
    expect(recon.cash_financing).toBe(-674);
    expect(recon.cash_net_change).toBe(-1_447);
    expect(recon.cash_opening).toBe(7_463);
    expect(recon.cash_closing).toBe(6_016);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(
      parsedFixture().records.map((record) => [record.gpfs_line_item, record]),
    );
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(742_900_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(2_894_700_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(2_582_200_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(312_500_000);
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
    expect(byKey.get('net_result')!.source_dataset).toBe('Oberon Council GPFS 2024-25');
  });

  it('parses B1-1 Total functions and activities', () => {
    const totals = parseOberonGpfsFunctionsTotals({
      page_number: 13,
      text: OBERON_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 13,
      income: 28_947,
      expenses: 25_822,
      operating_result: 3_125,
      grants_and_contributions: 14_787,
      carrying_amount: 394_496,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = oberonExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 4
        ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') }
        : page,
    );
    const parsed = parseOberonGpfsExtraction(extraction, OBERON_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = oberonExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 13
        ? { ...page, text: page.text.replace(/\$ '000/g, '$m') }
        : page,
    );
    const parsed = parseOberonGpfsExtraction(extraction, OBERON_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = oberonExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 13
        ? { ...page, text: page.text.replace('394,496 379,591', '394,497 379,591') }
        : page,
    );
    const parsed = parseOberonGpfsExtraction(extraction, OBERON_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Oberon Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = OBERON_CONTEXT.document.url;
    const revenue = oberonGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = oberonGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^oberon-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(oberonGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(oberonGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });

  it('keeps the fixture text anchored to the printed source lines and golden digest', () => {
    expect(OBERON_INCOME_TEXT).toContain(
      'Total income from continuing operations 28,947 35,140',
    );
    expect(OBERON_INCOME_TEXT).toContain('Net loss from the disposal of assets');
    expect(OBERON_INCOME_TEXT).toContain('(7,632)');
    expect(OBERON_GPFS_ID).toBe('oberon-gpfs');
    expect(OBERON_GPFS_NAME).toContain('Oberon');
    expect(OBERON_GPFS_PUBLISHER).toBe('Oberon Council');
    expect(OBERON_GPFS_LICENSE).toContain('Oberon Council');
    expect(OBERON_GPFS_REPORTING_URL).toContain('oberon.nsw.gov.au');
    expect(OBERON_GPFS_GOLDEN_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_oberongpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: OBERON_GPFS_ID,
    name: OBERON_GPFS_NAME,
    publisher: OBERON_GPFS_PUBLISHER,
    source_url: OBERON_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: OBERON_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'oberon-gpfs-measure', record }));
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

describe('Oberon GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-oberon',
        project_name: 'Existing AusTender Oberon contract',
        delivery_entity: 'OBERON COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-oberon-school',
        project_name: 'Existing data.nsw Oberon school row (not a council row)',
        delivery_entity: 'Oberon High School',
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
    expect(await MeasureModel.countDocuments({ source_id: OBERON_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: OBERON_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: OBERON_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
