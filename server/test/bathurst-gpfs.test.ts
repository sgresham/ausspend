import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BATHURST_GPFS_ANNUAL_PLAN_URL,
  BATHURST_GPFS_BEFORE_CAPITAL_LABEL,
  BATHURST_GPFS_DOCUMENT_PIN,
  BATHURST_GPFS_FISCAL_YEAR,
  BATHURST_GPFS_ID,
  BATHURST_GPFS_LICENSE,
  BATHURST_GPFS_LINES,
  BATHURST_GPFS_NAME,
  BATHURST_GPFS_PUBLISHER,
  BATHURST_GPFS_REPORTING_URL,
  BATHURST_GPFS_REQUEST_HEADERS,
  BATHURST_GPFS_STANDALONE_FS_BYTES,
  BATHURST_GPFS_STANDALONE_FS_PAGES,
  BATHURST_GPFS_STANDALONE_FS_SHA256,
  discoverBathurstGpfsDocument,
  fiscalYearFromBathurstFinancialStatementsLink,
  parseBathurstFinancialStatementsLinks,
  parseBathurstGpfsExtraction,
  parseBathurstGpfsFunctionsTotals,
  selectBathurstGpfsDocument,
  bathurstGpfsNaturalKey,
  bathurstPinnedDocument,
} from '../src/connectors/bathurst-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  BATHURST_CONTEXT,
  BATHURST_FUNCTIONS_TEXT,
  BATHURST_GPFS_ROW_COUNT,
  BATHURST_INCOME_TEXT,
  bathurstExtraction,
} from '../src/connectors/bathurst-gpfs/fixture.js';

// Bathurst Regional Council's official Future Plans & Budget section publishes
// a standalone audited "Annual Financial Report 2024-2025" PDF on its Annual
// Plan page. That FY2024-25 publication (year ended 30 June 2025, Auditor-
// General opinion dated 14 November 2025) is the latest published standalone
// audited GPFS and is the source ingested here. Older years are retained so
// discovery can reject a stale or missing target year instead of substituting a
// prior report.

const FS_2025_HREF =
  '/files/assets/public/v/1/council/annual-plan/annual-financial-statements-2024-2025.pdf';
const FS_2024_HREF =
  '/files/assets/public/v/1/council/annual-plan/brc-annual-financial-statements-2023-2024.pdf';
const FS_2026_HREF =
  '/files/assets/public/v/1/council/annual-plan/annual-financial-statements-2025-2026.pdf';

const LISTING_HTML = `
  <a href="${FS_2025_HREF}" class="document ext-pdf" title="ANNUAL-FINANCIAL-STATEMENTS-2024-2025.pdf">Annual Financial Report 2024-2025</a>
  <a href="${FS_2024_HREF}" class="document ext-pdf" title="BRC Annual Financial Statements 2023-2024.pdf">Annual Financial Report 2023/2024</a>
`;

const { BROWSER_BYTES, BROWSER_HTML, PLAIN_BYTES } = vi.hoisted(() => {
  const pin =
    'https://www.bathurst.nsw.gov.au/files/assets/public/v/1/council/annual-plan/annual-financial-statements-2024-2025.pdf';
  return {
    BROWSER_HTML: `<a href="${pin}">Annual Financial Report 2024-2025</a>`,
    BROWSER_BYTES: Buffer.from('browser-fetched-bathurst-fs-bytes'),
    PLAIN_BYTES: Buffer.from('plain-fetched-bathurst-fs-bytes'),
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
      return Buffer.from('browser-fetched-bathurst-fs-bytes').toString('base64');
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

const { fetchBathurstGpfsViaBrowser } = await import('../../scripts/bathurst-gpfs-browser.js');

function parsedFixture() {
  return parseBathurstGpfsExtraction(bathurstExtraction(), BATHURST_CONTEXT);
}

describe('Bathurst Regional Council audited FS discovery', () => {
  it('discovers the FY2024-25 audited financial statements and retains older years', () => {
    expect(BATHURST_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseBathurstFinancialStatementsLinks(
      LISTING_HTML,
      BATHURST_GPFS_ANNUAL_PLAN_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    const selected = selectBathurstGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(new URL(FS_2025_HREF, BATHURST_GPFS_ANNUAL_PLAN_URL).toString());
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(BATHURST_GPFS_ANNUAL_PLAN_URL);
    expect(selected.title).toContain('2024-2025');
    expect(
      fiscalYearFromBathurstFinancialStatementsLink(
        'Annual Financial Statements for the year ended 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromBathurstFinancialStatementsLink('Annual Financial Report 2024-2025')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromBathurstFinancialStatementsLink('2023/2024')).toBe('2023-24');
    expect(
      fiscalYearFromBathurstFinancialStatementsLink('Long Term Financial Plan 2026-2037.pdf'),
    ).toBeNull();
    expect(BATHURST_GPFS_STANDALONE_FS_BYTES).toBe(2_735_544);
    expect(BATHURST_GPFS_STANDALONE_FS_PAGES).toBe(96);
    expect(BATHURST_GPFS_STANDALONE_FS_SHA256).toBe(
      '630f7efe25fecffcf48da454ec908d035ee09f1f37c855db3e26006ca890b8fc',
    );
  });

  it('rejects a prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `<a href="${FS_2024_HREF}" class="document ext-pdf">Annual Financial Report 2023/2024</a>`;
    const links = parseBathurstFinancialStatementsLinks(priorOnly, BATHURST_GPFS_ANNUAL_PLAN_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectBathurstGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 FS for the FY2024-25 target', () => {
    const futureOnly = `<a href="${FS_2026_HREF}" class="document ext-pdf">Annual Financial Report 2025-2026</a>`;
    const links = parseBathurstFinancialStatementsLinks(futureOnly, BATHURST_GPFS_ANNUAL_PLAN_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectBathurstGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official FS pin when the listing yields no usable anchor', async () => {
    expect(
      parseBathurstFinancialStatementsLinks(
        '<html><body>No document links here</body></html>',
        BATHURST_GPFS_ANNUAL_PLAN_URL,
      ),
    ).toEqual([]);
    const pinned = bathurstPinnedDocument();
    expect(pinned.url).toBe(BATHURST_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    const discovered = await discoverBathurstGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(BATHURST_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the listing requests return a 403', async () => {
    const discovered = await discoverBathurstGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(BATHURST_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery', async () => {
    expect(BATHURST_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverBathurstGpfsDocument(
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
      discoverBathurstGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2023-24',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });

  it('fetches the audited FS through the browser path', async () => {
    const fetched = await fetchBathurstGpfsViaBrowser(BATHURST_GPFS_ANNUAL_PLAN_URL, '2024-25');
    expect(fetched.pdfUrl).toBe(BATHURST_GPFS_DOCUMENT_PIN);
    expect(fetched.listingHtml).toBe(BROWSER_HTML);
    expect(fetched.viaBrowser).toBe(true);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
  });

  it('falls back to the plain client when the browser path is refused', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      if (String(input) === BATHURST_GPFS_ANNUAL_PLAN_URL) {
        return new Response(LISTING_HTML, { status: 200 });
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchBathurstGpfsViaBrowser(BATHURST_GPFS_ANNUAL_PLAN_URL, '2024-25', {
      forcePlain: true,
      fetchImpl,
    });
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(new URL(FS_2025_HREF, BATHURST_GPFS_ANNUAL_PLAN_URL).toString());
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('Bathurst Regional Council standalone GPFS slice', () => {
  it('emits 18 printed statement lines with exact face and B1-1 reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(BATHURST_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(18);
    expect(parsed.rejections).toEqual([]);
    expect(BATHURST_GPFS_LINES).toHaveLength(18);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(137_462);
    expect(recon.total_expenses).toBe(121_879);
    expect(recon.employee_expenses).toBe(37_477);
    expect(recon.materials_and_services).toBe(50_224);
    expect(recon.borrowing_costs).toBe(1_576);
    expect(recon.other_expenses).toBe(2_572);
    expect(recon.net_gain_from_disposal_of_assets).toBe(4_857);
    expect(recon.fair_value_increment_on_investment_properties).toBe(468);
    expect(recon.depreciation_amortisation_impairment).toBe(30_030);
    expect(recon.government_grants_operating).toBe(14_898);
    expect(recon.government_grants_capital).toBe(13_773);
    expect(recon.net_result).toBe(15_583);
    expect(recon.net_result_before_capital_grants).toBe(1_810);
    expect(recon.operating_result_excluding_depreciation).toBe(45_613);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(91_849);
    expect(recon.functions_income).toBe(137_462);
    expect(recon.functions_total_expenses).toBe(121_879);
    expect(recon.functions_operating_result).toBe(15_583);
    expect(recon.functions_grants_and_contributions).toBe(28_671);
    expect(recon.functions_carrying_amount).toBe(2_132_031);
    expect(recon.comprehensive_total).toBe(155_553);
    expect(recon.comprehensive_other_income).toBe(139_970);
    expect(recon.comprehensive_revaluation).toBe(139_970);
    expect(recon.comprehensive_attributable_council).toBe(155_553);
    expect(recon.total_assets).toBe(2_132_031);
    expect(recon.total_equity).toBe(2_064_318);
    expect(recon.cash_net_change).toBe(175);
    expect(recon.cash_opening).toBe(14_983);
    expect(recon.cash_closing).toBe(15_158);
    expect(recon.checks).toHaveLength(14);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(6_021_600_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(13_746_200_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(12_187_900_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(1_558_300_000);
    expect(byKey.get('net_gain_from_disposal_of_assets')!.gpfs_section).toBe('revenue');
    expect(byKey.get('fair_value_increment_on_investment_properties')!.gpfs_section).toBe(
      'revenue',
    );
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('government_grants_operating')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(byKey.get('other_expenses')!.gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(byKey.get('net_result')!.notes).toContain("unit: thousands (explicit");
    expect(byKey.get('net_result')!.source_dataset).toBe('Bathurst Regional Council GPFS 2024-25');
  });

  it('parses B1-1 Total functions and activities on Bathurst’s layout', () => {
    const totals = parseBathurstGpfsFunctionsTotals({
      page_number: 15,
      text: BATHURST_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 15,
      income: 137_462,
      expenses: 121_879,
      operating_result: 15_583,
      grants_and_contributions: 28_671,
      carrying_amount: 2_132_031,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = bathurstExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 6 ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') } : page,
    );
    const parsed = parseBathurstGpfsExtraction(extraction, BATHURST_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = bathurstExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15 ? { ...page, text: page.text.replace(/\$ '000/g, '$m') } : page,
    );
    const parsed = parseBathurstGpfsExtraction(extraction, BATHURST_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = bathurstExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 15 ? { ...page, text: page.text.replace('121,879', '121,880') } : page,
    );
    const parsed = parseBathurstGpfsExtraction(extraction, BATHURST_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Bathurst Regional Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = BATHURST_CONTEXT.document.url;
    const revenue = bathurstGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = bathurstGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^bathurst-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(bathurstGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(bathurstGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });

  it('keeps the fixture text anchored to the printed source lines', () => {
    expect(BATHURST_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(BATHURST_INCOME_TEXT).toContain('Net gain from the disposal of assets');
    expect(BATHURST_INCOME_TEXT).toContain(BATHURST_GPFS_BEFORE_CAPITAL_LABEL);
    expect(BATHURST_GPFS_ID).toBe('bathurst-gpfs');
    expect(BATHURST_GPFS_NAME).toContain('Bathurst');
    expect(BATHURST_GPFS_PUBLISHER).toBe('Bathurst Regional Council');
    expect(BATHURST_GPFS_LICENSE).toContain('Bathurst Regional Council');
    expect(BATHURST_GPFS_REPORTING_URL).toContain('Future-Plans-Budget');
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_bathurstgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BATHURST_GPFS_ID,
    name: BATHURST_GPFS_NAME,
    publisher: BATHURST_GPFS_PUBLISHER,
    source_url: BATHURST_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BATHURST_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'bathurst-gpfs-measure', record }));
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

describe('Bathurst Regional Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-bathurst',
        project_name: 'Existing AusTender Bathurst contract',
        delivery_entity: 'BATHURST REGIONAL COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-bathurst-school',
        project_name: 'Existing data.nsw Bathurst school row (not a council row)',
        delivery_entity: 'Bathurst High School',
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
    expect(await MeasureModel.countDocuments({ source_id: BATHURST_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BATHURST_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    const source = await DataSourceModel.findOne({ source_id: BATHURST_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});
