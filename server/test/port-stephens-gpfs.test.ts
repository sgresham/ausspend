import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  PORT_STEPHENS_ANNUAL_REPORT_GAP,
  PORT_STEPHENS_GPFS_DOCUMENT_PIN,
  PORT_STEPHENS_GPFS_FISCAL_YEAR,
  PORT_STEPHENS_GPFS_ID,
  PORT_STEPHENS_GPFS_LICENSE,
  PORT_STEPHENS_GPFS_LINES,
  PORT_STEPHENS_GPFS_NAME,
  PORT_STEPHENS_GPFS_PUBLISHER,
  PORT_STEPHENS_GPFS_REPORTING_URL,
  PORT_STEPHENS_GPFS_REQUEST_HEADERS,
  PORT_STEPHENS_GPFS_STANDALONE_FS_BYTES,
  PORT_STEPHENS_GPFS_STANDALONE_FS_PAGES,
  PORT_STEPHENS_GPFS_STANDALONE_FS_SHA256,
  discoverPortStephensGpfsDocument,
  fiscalYearFromPortStephensAnnualReportLink,
  parsePortStephensAnnualReportExtraction,
  parsePortStephensAnnualReportLinks,
  parsePortStephensFinancialReportsLinks,
  parsePortStephensGpfsExtraction,
  parsePortStephensGpfsFunctionsTotals,
  portStephensAnnualReportPinnedDocument,
  portStephensGpfsNaturalKey,
  portStephensPinnedDocument,
  selectPortStephensAnnualReportDocument,
  selectPortStephensGpfsDocument,
} from '../src/connectors/port-stephens-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  PORT_STEPHENS_AR_CONTENTS_TEXT,
  PORT_STEPHENS_AR_COVER_TEXT,
  PORT_STEPHENS_AR_STATUTORY_TEXT,
  PORT_STEPHENS_CONTEXT,
  PORT_STEPHENS_FUNCTIONS_TEXT,
  PORT_STEPHENS_GPFS_ROW_COUNT,
  PORT_STEPHENS_INCOME_TEXT,
  portStephensAnnualReportExtraction,
  portStephensExtraction,
} from '../src/connectors/port-stephens-gpfs/fixture.js';

// Port Stephens Council's FY2024-25 Annual Report page publishes a two-volume
// report. Volume 1 is the narrative/statutory-information annual report with no
// audited GPFS section; Volume 2 is the separately published GPFS with the
// independent auditor's reports, and is the standalone audited FS ingested here.
// The annual-report-only rejection is retained.

const FS_2024_HREF =
  '/__data/assets/pdf_file/0006/157362/AnnualReport_Volume2_FinancialStatement_2025.pdf';
const FS_2023_HREF =
  '/__data/assets/pdf_file/0006/157333/AnnualReport_Volume2_FinancialStatement_2024.pdf';
const FS_2026_HREF =
  '/__data/assets/pdf_file/0006/158000/AnnualReport_Volume2_FinancialStatement_2026.pdf';
const AR_2024_HREF = '/__data/assets/pdf_file/0004/157360/AnnualReport_2024-25.pdf';
const AR_2023_HREF = '/__data/assets/pdf_file/0004/157100/AnnualReport_2023-24.pdf';
const SNAPSHOT_2024_HREF = '/__data/assets/pdf_file/0005/157361/AnnualReport_Snapshot_2025.pdf';

const LISTING_HTML = `
  <p><strong>Volume 1</strong> contains our performance, leadership and statutory statements.</p>
  <a href="${SNAPSHOT_2024_HREF}" title="Annual Report 2024 to 2025 - Snapshot" target="_blank">Annual Report 2024 to 2025 – Snapshot</a>
  <a href="${AR_2024_HREF}" title="Annua Report 2024 to 2025 - volume 1" target="_blank">Annual Report 2024 to 2025 – Volume 1</a>
  <a href="${AR_2023_HREF}" title="Annual Report 2023 to 2024 - volume 1" target="_blank">Annual Report 2023 to 2024 – Volume 1</a>
  <p><strong>Volume 2</strong> contains our audited financial accounts including performance, financial position and cash flows for the financial year ended 30 June 2025.</p>
  <a href="${FS_2024_HREF}" title="Annual Report 2024 to 2025 Volume 2" target="_blank">Annual Report 2024 to 2025 – Volume 2</a>
  <a href="${FS_2023_HREF}" title="Annual Report 2023 to 2024 Volume 2" target="_blank">Annual Report 2023 to 2024 – Volume 2</a>
`;

const { BROWSER_BYTES, BROWSER_HTML } = vi.hoisted(() => {
  const pin =
    'https://www.portstephens.nsw.gov.au/__data/assets/pdf_file/0006/157362/AnnualReport_Volume2_FinancialStatement_2025.pdf';
  return {
    BROWSER_HTML: `<a href="${pin}" title="Annual Report 2024 to 2025 Volume 2">Annual Report 2024 to 2025 – Volume 2</a>`,
    BROWSER_BYTES: Buffer.from('browser-fetched-port-stephens-fs-bytes'),
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
      return Buffer.from('browser-fetched-port-stephens-fs-bytes').toString('base64');
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

const { fetchPortStephensGpfsViaBrowser } =
  await import('../../scripts/port-stephens-gpfs-browser.js');

function parsedFixture() {
  return parsePortStephensGpfsExtraction(portStephensExtraction(), PORT_STEPHENS_CONTEXT);
}

describe('Port Stephens Council Volume 2 FS discovery', () => {
  it('discovers the FY2024-25 Volume 2 financial statement and never selects Volume 1', () => {
    expect(PORT_STEPHENS_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parsePortStephensFinancialReportsLinks(
      LISTING_HTML,
      PORT_STEPHENS_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.some((link) => link.url.includes('AnnualReport_2024-25.pdf'))).toBe(false);
    const selected = selectPortStephensGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(new URL(FS_2024_HREF, PORT_STEPHENS_GPFS_REPORTING_URL).toString());
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(PORT_STEPHENS_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Volume 2');
    expect(fiscalYearFromPortStephensAnnualReportLink('Annual Report 2024 to 2025 Volume 2')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromPortStephensAnnualReportLink('Annual Report 2023 to 2024 Volume 2')).toBe(
      '2023-24',
    );
    expect(
      fiscalYearFromPortStephensAnnualReportLink('Long Term Financial Plan 2026-2037.pdf'),
    ).toBeNull();
    expect(PORT_STEPHENS_GPFS_STANDALONE_FS_BYTES).toBe(1_975_075);
    expect(PORT_STEPHENS_GPFS_STANDALONE_FS_PAGES).toBe(96);
    expect(PORT_STEPHENS_GPFS_STANDALONE_FS_SHA256).toBe(
      'c086ddbb067328450652facdc77391c12f1d8442c6f73dbaf8bc50173d911ad9',
    );
  });

  it('retains annual-report discovery and excludes Volume 2 and the Snapshot', () => {
    const annualReports = parsePortStephensAnnualReportLinks(
      LISTING_HTML,
      PORT_STEPHENS_GPFS_REPORTING_URL,
    );
    expect(annualReports.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(annualReports.every((link) => link.url.includes('AnnualReport_2024-25.pdf'))).toBe(
      false,
    );
    expect(annualReports.some((link) => link.url.includes('Volume2'))).toBe(false);
    expect(annualReports.some((link) => link.url.includes('Snapshot'))).toBe(false);
    const selected = selectPortStephensAnnualReportDocument(annualReports, '2024-25');
    expect(selected.url).toContain('AnnualReport_2024-25.pdf');
    expect(portStephensAnnualReportPinnedDocument().url).toBe(
      'https://www.portstephens.nsw.gov.au/__data/assets/pdf_file/0004/157360/AnnualReport_2024-25.pdf',
    );
  });

  it('rejects a prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `<a href="${FS_2023_HREF}" title="Annual Report 2023 to 2024 Volume 2">Annual Report 2023 to 2024 – Volume 2</a>`;
    const links = parsePortStephensFinancialReportsLinks(
      priorOnly,
      PORT_STEPHENS_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectPortStephensGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 FS for the FY2024-25 target', () => {
    const futureOnly = `<a href="${FS_2026_HREF}" title="Annual Report 2025 to 2026 Volume 2">Annual Report 2025 to 2026 – Volume 2</a>`;
    const links = parsePortStephensFinancialReportsLinks(
      futureOnly,
      PORT_STEPHENS_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectPortStephensGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official FS pin when the listing yields no usable anchor', async () => {
    expect(
      parsePortStephensFinancialReportsLinks(
        '<html><body>No document links here</body></html>',
        PORT_STEPHENS_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = portStephensPinnedDocument();
    expect(pinned.url).toBe(PORT_STEPHENS_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    const discovered = await discoverPortStephensGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(PORT_STEPHENS_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the Cloudflare challenge returns a 403', async () => {
    const discovered = await discoverPortStephensGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(PORT_STEPHENS_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic plain-fetch discovery', async () => {
    expect(PORT_STEPHENS_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverPortStephensGpfsDocument(
      (async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeaders = init?.headers as Record<string, string>;
        return new Response('<html>no links</html>', { status: 200 });
      }) as typeof fetch,
      '2024-25',
    );
    expect(seenHeaders?.['user-agent']).toBe('curl/8.5.0');
    expect(seenHeaders?.['user-agent']).not.toContain('Chrome');
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverPortStephensGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });

  it('fetches Volume 2 through the browser/Cloudflare-aware path', async () => {
    const fetched = await fetchPortStephensGpfsViaBrowser(
      PORT_STEPHENS_GPFS_REPORTING_URL,
      '2024-25',
    );
    expect(fetched.pdfUrl).toBe(PORT_STEPHENS_GPFS_DOCUMENT_PIN);
    expect(fetched.listingHtml).toBe(BROWSER_HTML);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
  });
});

describe('Port Stephens Council standalone Volume 2 GPFS slice', () => {
  it('emits 17 printed statement lines with an exact B1-1 income/grants bridge', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(PORT_STEPHENS_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(PORT_STEPHENS_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(205_223);
    expect(recon.total_expenses).toBe(168_869);
    expect(recon.employee_expenses).toBe(66_113);
    expect(recon.materials_and_services).toBe(68_530);
    expect(recon.borrowing_costs).toBe(2_616);
    expect(recon.other_expenses).toBe(9_534);
    expect(recon.net_gain_from_disposal_of_assets).toBe(391);
    expect(recon.depreciation_amortisation_impairment).toBe(22_076);
    expect(recon.government_grants_operating).toBe(13_059);
    expect(recon.government_grants_capital).toBe(37_414);
    expect(recon.net_result).toBe(36_354);
    expect(recon.net_result_before_capital_grants).toBe(-1_060);
    expect(recon.operating_result_excluding_depreciation).toBe(58_430);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(146_793);
    expect(recon.functions_income).toBe(205_223);
    expect(recon.functions_total_expenses).toBe(168_869);
    expect(recon.functions_operating_result).toBe(36_354);
    expect(recon.functions_grants_and_contributions).toBe(50_473);
    expect(recon.functions_carrying_amount).toBe(1_906_732);
    expect(recon.comprehensive_total).toBe(206_518);
    expect(recon.comprehensive_other_income).toBe(170_164);
    expect(recon.comprehensive_revaluation).toBe(171_646);
    expect(recon.comprehensive_hedging).toBe(-1_482);
    expect(recon.total_assets).toBe(1_906_732);
    expect(recon.total_equity).toBe(1_759_335);
    expect(recon.cash_net_change).toBe(-16_973);
    expect(recon.cash_opening).toBe(24_980);
    expect(recon.cash_closing).toBe(8_007);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(8_180_300_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(20_522_300_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(16_886_900_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(3_635_400_000);
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('government_grants_operating')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
  });

  it('parses B1-1 Total functions and activities on Port Stephens’ layout', () => {
    const totals = parsePortStephensGpfsFunctionsTotals({
      page_number: 15,
      text: PORT_STEPHENS_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 15,
      income: 205_223,
      expenses: 168_869,
      operating_result: 36_354,
      grants_and_contributions: 50_473,
      carrying_amount: 1_906_732,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = portStephensExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 5 ? { ...page, text: page.text.replace(/\$ '000/, 'Notes') } : page,
    );
    const parsed = parsePortStephensGpfsExtraction(extraction, PORT_STEPHENS_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = portStephensExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15 ? { ...page, text: page.text.replace("$ '000", '$m') } : page,
    );
    const parsed = parsePortStephensGpfsExtraction(extraction, PORT_STEPHENS_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('retains the annual-report-only rejection (0 rows, exact gap)', () => {
    const parsed = parsePortStephensAnnualReportExtraction(
      portStephensAnnualReportExtraction(),
      PORT_STEPHENS_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toBe(PORT_STEPHENS_ANNUAL_REPORT_GAP);
    expect(PORT_STEPHENS_AR_CONTENTS_TEXT).toContain('Statutory Statements');
    expect(PORT_STEPHENS_AR_STATUTORY_TEXT).toContain('contained in Volume 2 of this Report');
    expect(PORT_STEPHENS_AR_COVER_TEXT).toContain('Volume one');
    expect(PORT_STEPHENS_INCOME_TEXT).not.toBe(PORT_STEPHENS_AR_COVER_TEXT);
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Port Stephens Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = PORT_STEPHENS_CONTEXT.document.url;
    const revenue = portStephensGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = portStephensGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^port-stephens-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(portStephensGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(portStephensGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_portstephensgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: PORT_STEPHENS_GPFS_ID,
    name: PORT_STEPHENS_GPFS_NAME,
    publisher: PORT_STEPHENS_GPFS_PUBLISHER,
    source_url: PORT_STEPHENS_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: PORT_STEPHENS_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'port-stephens-gpfs-measure', record }));
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

describe('Port Stephens Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-port-stephens',
        project_name: 'Existing AusTender Port Stephens contract',
        delivery_entity: 'PORT STEPHENS COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-port-stephens-school',
        project_name: 'Existing data.nsw Port Stephens school row (not a council row)',
        delivery_entity: 'Port Stephens High School',
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
    expect(await MeasureModel.countDocuments({ source_id: PORT_STEPHENS_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: PORT_STEPHENS_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: PORT_STEPHENS_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
