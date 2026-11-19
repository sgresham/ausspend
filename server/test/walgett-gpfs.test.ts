import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WALGETT_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  WALGETT_GPFS_DOCUMENT_PIN,
  WALGETT_GPFS_FISCAL_YEAR,
  WALGETT_GPFS_ID,
  WALGETT_GPFS_LICENSE,
  WALGETT_GPFS_LINES,
  WALGETT_GPFS_NAME,
  WALGETT_GPFS_PUBLISHER,
  WALGETT_GPFS_REPORTING_URL,
  WALGETT_GPFS_REQUEST_HEADERS,
  WALGETT_GPFS_SNAPSHOT_URL,
  WALGETT_GPFS_STANDALONE_FS_BYTES,
  WALGETT_GPFS_STANDALONE_FS_PAGES,
  WALGETT_GPFS_STANDALONE_FS_SHA256,
  discoverWalgettGpfsDocument,
  discoverWalgettGpfsFromLiveSnapshot,
  fiscalYearFromWalgettFinancialStatementsDoc,
  parseWalgettGpfsExtraction,
  parseWalgettGpfsFunctionsTotals,
  parseWalgettSnapshotDocument,
  walgettGpfsNaturalKey,
  walgettPinnedDocument,
} from '../src/connectors/walgett-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  WALGETT_CONTEXT,
  WALGETT_FUNCTIONS_TEXT,
  WALGETT_GPFS_GOLDEN_DIGEST,
  WALGETT_GPFS_ROW_COUNT,
  WALGETT_INCOME_TEXT,
  walgettExtraction,
} from '../src/connectors/walgett-gpfs/fixture.js';

// The annual-reports page is a client-rendered SPA: the HTML shell has no
// document links. The published CMS snapshot the SPA loads carries the file
// list, and the documented headless Chromium path renders the same link.

const PIN = WALGETT_GPFS_DOCUMENT_PIN;

const SNAPSHOT_FIXTURE = {
  version: '1.0',
  pages: [
    {
      fullPath: '/council/council-publications/annual-reports',
      content: {
        sections: [
          {
            blocks: [
              {
                type: 'file-list',
                data: {
                  files: [
                    {
                      url: '/assets/files/aaaaaaaaaaaaaaaa-1111111111111_11111111.pdf',
                      name: 'Annual Report 2024–25',
                      size: '13MB',
                      type: 'PDF',
                    },
                    {
                      url: '/assets/files/e14f90d207d06a69-1776849622581_6c2e2885.pdf',
                      name: 'Audited-Financial-Statements-2024-25.pdf',
                      size: '2.9 MB',
                      type: 'PDF',
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    },
  ],
};

const { BROWSER_BYTES, PLAIN_BYTES } = vi.hoisted(() => ({
  BROWSER_BYTES: Buffer.from('%PDF-1.7 browser-fetched-walgett-gpfs-bytes'),
  PLAIN_BYTES: Buffer.from('%PDF-1.7 plain-fetched-walgett-gpfs-bytes'),
}));

vi.mock('playwright', () => {
  const page = {
    on(event: string, callback: (response: { url(): string; status(): number }) => void) {
      if (event === 'response') {
        callback({ url: () => 'https://www.walgett.nsw.gov.au/snapshot.json', status: () => 200 });
      }
    },
    async goto() {
      return { ok: () => true, status: () => 200 };
    },
    async waitForTimeout() {
      return undefined;
    },
    async content() {
      return `<html><a href="${PIN}">Audited-Financial-Statements-2024-25.pdf</a><a href="/assets/files/f99e8f028b702a44-1775602766918_41bfcfd2.pdf">Annual Report 2024–25</a></html>`;
    },
    async $$eval(_selector: string, fn: (nodes: unknown[]) => unknown) {
      const anchors = [
        {
          textContent: 'Annual Report 2024–25',
          getAttribute: () => '/assets/files/f99e8f028b702a44-1775602766918_41bfcfd2.pdf',
        },
        {
          textContent: 'Audited-Financial-Statements-2024-25.pdf',
          getAttribute: () => '/assets/files/e14f90d207d06a69-1776849622581_6c2e2885.pdf',
        },
      ];
      return fn(anchors);
    },
    async evaluate() {
      return BROWSER_BYTES.toString('base64');
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

const { fetchWalgettGpfsViaBrowser, selectWalgettGpfsAnchor } = await import(
  '../../scripts/walgett-gpfs-browser.js'
);

function parsedFixture() {
  return parseWalgettGpfsExtraction(walgettExtraction(), WALGETT_CONTEXT);
}

describe('Walgett Shire Council audited GPFS discovery', () => {
  it('pins the latest published standalone audited FY2024-25 GPFS and its exact bytes', () => {
    expect(WALGETT_GPFS_FISCAL_YEAR).toBe('2024-25');
    const pinned = walgettPinnedDocument();
    expect(pinned.url).toBe(PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.listing_url).toBe(WALGETT_GPFS_REPORTING_URL);
    expect(WALGETT_GPFS_STANDALONE_FS_BYTES).toBe(3_001_912);
    expect(WALGETT_GPFS_STANDALONE_FS_PAGES).toBe(109);
    expect(WALGETT_GPFS_STANDALONE_FS_SHA256).toBe(
      '26f02f8523fe3742aa84f0998e43241b398d13f3fd158920380c77907baa9de4',
    );
  });

  it('uses the official walgett.nsw.gov.au domain and never a mirror host', () => {
    expect(new URL(PIN).host.endsWith('walgett.nsw.gov.au')).toBe(true);
    expect(new URL(WALGETT_GPFS_REPORTING_URL).host.endsWith('walgett.nsw.gov.au')).toBe(true);
    expect(new URL(WALGETT_GPFS_SNAPSHOT_URL).host.endsWith('walgett.nsw.gov.au')).toBe(true);
    expect(new URL(WALGETT_GPFS_CURRENT_ANNUAL_REPORT_PIN).host.endsWith('walgett.nsw.gov.au')).toBe(
      true,
    );
    expect(PIN).not.toMatch(/webcache|archive\.org|googleusercontent/);
  });

  it('refuses to substitute a different year', () => {
    expect(() => discoverWalgettGpfsDocument('2025-26')).toThrow(/No pinned/);
    expect(() => discoverWalgettGpfsDocument('2023-24')).toThrow(/No pinned/);
    expect(walgettPinnedDocument().fiscal_year).toBe('2024-25');
  });

  it('parses only explicit year conventions and never a bare year', () => {
    expect(
      fiscalYearFromWalgettFinancialStatementsDoc(
        'Walgett Shire Council General Purpose Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromWalgettFinancialStatementsDoc('Audited-Financial-Statements-2024-25.pdf'),
    ).toBe('2024-25');
    expect(fiscalYearFromWalgettFinancialStatementsDoc('2025')).toBeNull();
    expect(
      fiscalYearFromWalgettFinancialStatementsDoc('Long Term Financial Plan 2025-2035.pdf'),
    ).toBeNull();
  });

  it('discovers the exact audited FS from the published CMS snapshot and never the annual report', () => {
    const document = parseWalgettSnapshotDocument(SNAPSHOT_FIXTURE);
    expect(document?.url).toBe(PIN);
    expect(document?.fiscal_year).toBe('2024-25');
    expect(document?.title).toContain('Audited-Financial-Statements-2024-25');
    expect(parseWalgettSnapshotDocument(SNAPSHOT_FIXTURE, '2025-26')).toBeNull();
  });

  it('fails live discovery for a missing year instead of substituting FY2024-25', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify(SNAPSHOT_FIXTURE), { status: 200 })) as typeof fetch;
    await expect(discoverWalgettGpfsFromLiveSnapshot('2025-26', fetchImpl)).rejects.toThrow(
      /not found in the published CMS snapshot/,
    );
    const found = await discoverWalgettGpfsFromLiveSnapshot('2024-25', fetchImpl);
    expect(found.url).toBe(PIN);
  });

  it('documents the access path and same-origin snapshot', () => {
    expect(WALGETT_GPFS_REQUEST_HEADERS['user-agent']).toContain('Chrome');
    expect(WALGETT_GPFS_REQUEST_HEADERS.accept).toContain('application/json');
    expect(WALGETT_GPFS_SNAPSHOT_URL).toBe('https://www.walgett.nsw.gov.au/snapshot.json');
  });

  it('selects only the audited standalone statements anchor', () => {
    const anchors = [
      {
        text: 'Annual Report 2024–25',
        href: '/assets/files/f99e8f028b702a44-1775602766918_41bfcfd2.pdf',
      },
      {
        text: 'Audited-Financial-Statements-2024-25.pdf',
        href: '/assets/files/e14f90d207d06a69-1776849622581_6c2e2885.pdf',
      },
    ];
    expect(selectWalgettGpfsAnchor(anchors)?.text).toContain('Audited');
    expect(selectWalgettGpfsAnchor(anchors, '2025-26')).toBeNull();
  });

  it('captures the official browser fetch and the observed snapshot request', async () => {
    const fetched = await fetchWalgettGpfsViaBrowser();
    expect(fetched.pdfUrl).toBe(PIN);
    expect(fetched.viaBrowser).toBe(true);
    expect(Buffer.from(fetched.pdfBytes).subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(fetched.snapshotUrl).toBe(WALGETT_GPFS_SNAPSHOT_URL);
    expect(fetched.listingHtml).toContain(PIN);
  });

  it('can use a test plain path when a fetch implementation is supplied', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      const target = String(url);
      calls.push(target);
      if (target === WALGETT_GPFS_SNAPSHOT_URL) {
        return new Response(JSON.stringify(SNAPSHOT_FIXTURE), { status: 200 });
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchWalgettGpfsViaBrowser(
      WALGETT_GPFS_REPORTING_URL,
      '2024-25',
      { fetchImpl },
    );
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(PIN);
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toEqual([WALGETT_GPFS_SNAPSHOT_URL, PIN]);
  });
});

describe('Walgett standalone GPFS slice', () => {
  it('emits 19 printed statement lines with exact face, B1-1 and balance-sheet reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(WALGETT_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(19);
    expect(parsed.rejections).toEqual([]);
    expect(WALGETT_GPFS_LINES).toHaveLength(19);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(37_665);
    expect(recon.total_expenses).toBe(47_042);
    expect(recon.employee_expenses).toBe(11_607);
    expect(recon.materials_and_services).toBe(24_475);
    expect(recon.borrowing_costs).toBe(127);
    expect(recon.other_expenses).toBe(1_962);
    expect(recon.depreciation_amortisation_impairment).toBe(8_811);
    expect(recon.government_grants_operating).toBe(14_340);
    expect(recon.government_grants_capital).toBe(6_414);
    expect(recon.net_gain_from_disposal_of_assets).toBe(56);
    expect(recon.net_loss_from_disposal_of_assets).toBe(0);
    expect(recon.net_share_joint_ventures).toBe(60);
    expect(recon.net_result).toBe(-9_377);
    expect(recon.net_result_before_capital_grants).toBe(-15_791);
    expect(recon.operating_result_excluding_depreciation).toBe(-566);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(38_231);
    expect(recon.functions_income).toBe(37_665);
    expect(recon.functions_total_expenses).toBe(47_042);
    expect(recon.functions_operating_result).toBe(-9_377);
    expect(recon.functions_grants_and_contributions).toBe(20_754);
    expect(recon.functions_carrying_amount).toBe(501_502);
    expect(recon.comprehensive_total).toBe(18_843);
    expect(recon.comprehensive_other_income).toBe(28_220);
    expect(recon.comprehensive_revaluation).toBe(28_220);
    expect(recon.comprehensive_attributable_council).toBe(18_843);
    expect(recon.total_assets).toBe(501_502);
    expect(recon.total_liabilities).toBe(14_856);
    expect(recon.net_assets).toBe(486_646);
    expect(recon.total_equity).toBe(486_646);
    expect(recon.council_equity_interest).toBe(486_646);
    expect(recon.cash_operating).toBe(-7_474);
    expect(recon.cash_investing).toBe(-6_425);
    expect(recon.cash_financing).toBe(-143);
    expect(recon.cash_net_change).toBe(-14_042);
    expect(recon.cash_opening).toBe(19_393);
    expect(recon.cash_closing).toBe(5_351);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(1_112_900_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(3_766_500_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(4_704_200_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(937_700_000);
    expect(byKey.get('net_result')!.gpfs_printed_sign).toBe('negative');
    expect(byKey.get('net_gain_from_disposal_of_assets')!.gpfs_section).toBe('revenue');
    expect(byKey.get('net_loss_from_disposal_of_assets')!.gpfs_section).toBe('expenses');
    expect(byKey.get('net_share_joint_ventures')!.amount_cents).toBe(6_000_000);
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('government_grants_operating')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(byKey.get('other_expenses')!.gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(byKey.get('net_result')!.notes).toContain('unit: thousands (explicit');
    expect(byKey.get('net_result')!.source_dataset).toBe('Walgett Shire Council GPFS 2024-25');
  });

  it('parses B1-1 Total functions and activities', () => {
    const totals = parseWalgettGpfsFunctionsTotals({
      page_number: 15,
      text: WALGETT_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 15,
      income: 37_665,
      expenses: 47_042,
      operating_result: -9_377,
      grants_and_contributions: 20_754,
      carrying_amount: 501_502,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = walgettExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 6
        ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') }
        : page,
    );
    const parsed = parseWalgettGpfsExtraction(extraction, WALGETT_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = walgettExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15 ? { ...page, text: page.text.replace(/\$ '000/g, '$m') } : page,
    );
    const parsed = parseWalgettGpfsExtraction(extraction, WALGETT_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = walgettExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15
        ? { ...page, text: page.text.replace('501,502 483,496', '501,503 483,496') }
        : page,
    );
    const parsed = parseWalgettGpfsExtraction(extraction, WALGETT_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Walgett Shire Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = WALGETT_CONTEXT.document.url;
    const revenue = walgettGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = walgettGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^walgett-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(walgettGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(walgettGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });

  it('keeps the fixture text anchored to the printed source lines and golden digest', () => {
    expect(WALGETT_INCOME_TEXT).toContain(
      'Total income from continuing operations 37,665 48,385',
    );
    expect(WALGETT_INCOME_TEXT).toContain('Net gain from the disposal of assets');
    expect(WALGETT_INCOME_TEXT).toContain('(15,791)');
    expect(WALGETT_GPFS_ID).toBe('walgett-gpfs');
    expect(WALGETT_GPFS_NAME).toContain('Walgett');
    expect(WALGETT_GPFS_PUBLISHER).toBe('Walgett Shire Council');
    expect(WALGETT_GPFS_LICENSE).toContain('Walgett Shire Council');
    expect(WALGETT_GPFS_REPORTING_URL).toContain('walgett.nsw.gov.au');
    expect(WALGETT_GPFS_GOLDEN_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_walgettgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: WALGETT_GPFS_ID,
    name: WALGETT_GPFS_NAME,
    publisher: WALGETT_GPFS_PUBLISHER,
    source_url: WALGETT_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WALGETT_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'walgett-gpfs-measure', record }));
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

describe('Walgett GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-walgett',
        project_name: 'Existing AusTender Walgett contract',
        delivery_entity: 'WALGETT SHIRE COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-walgett-school',
        project_name: 'Existing data.nsw Walgett school row (not a council row)',
        delivery_entity: 'Walgett High School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('adds exactly 19 rows, preserves existing rows, and is idempotent', async () => {
    const { records } = parsedFixture();
    expect(records).toHaveLength(19);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: WALGETT_GPFS_ID })).toBe(19);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: WALGETT_GPFS_ID })).toBe(19);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    const source = await DataSourceModel.findOne({ source_id: WALGETT_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(19);
  });
});
