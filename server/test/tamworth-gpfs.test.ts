import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  TAMWORTH_GPFS_BEFORE_CAPITAL_LABEL,
  TAMWORTH_GPFS_DOCUMENT_PIN,
  TAMWORTH_GPFS_FISCAL_YEAR,
  TAMWORTH_GPFS_ID,
  TAMWORTH_GPFS_LICENSE,
  TAMWORTH_GPFS_LINES,
  TAMWORTH_GPFS_NAME,
  TAMWORTH_GPFS_PUBLISHER,
  TAMWORTH_GPFS_REPORTING_URL,
  TAMWORTH_GPFS_REQUEST_HEADERS,
  TAMWORTH_GPFS_STANDALONE_FS_BYTES,
  TAMWORTH_GPFS_STANDALONE_FS_PAGES,
  TAMWORTH_GPFS_STANDALONE_FS_SHA256,
  discoverTamworthGpfsDocument,
  fiscalYearFromTamworthFinancialStatementsLink,
  parseTamworthFinancialStatementsLinks,
  parseTamworthGpfsExtraction,
  parseTamworthGpfsFunctionsTotals,
  selectTamworthGpfsDocument,
  tamworthGpfsNaturalKey,
  tamworthPinnedDocument,
} from '../src/connectors/tamworth-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  TAMWORTH_CONTEXT,
  TAMWORTH_FUNCTIONS_TEXT,
  TAMWORTH_GPFS_ROW_COUNT,
  TAMWORTH_INCOME_TEXT,
  tamworthExtraction,
} from '../src/connectors/tamworth-gpfs/fixture.js';

// Tamworth Regional Council's official Financial Reporting page publishes a
// standalone audited "Annual Financial Statements" PDF for each year. The
// FY2025-26 publication (year ended 30 June 2026, authorised 22 September 2026)
// is the current standalone audited GPFS and is the source ingested here. Older
// years are retained so discovery can reject a stale or missing target year
// instead of substituting a prior report.

const FS_2026_HREF = '/ArticleDocuments/226/Annual Financial Statements - 2026.pdf.aspx';
const FS_2025_HREF =
  '/ArticleDocuments/226/Tamworth Regional Council - Annual Financial Statements - 2024-25.pdf.aspx';
const FS_2027_HREF = '/ArticleDocuments/226/Annual Financial Statements - 2027.pdf.aspx';

const LISTING_HTML = `
  <a href="${FS_2026_HREF}" class="icon-pdf">Document: </a>
  <a class="ancFileLink" href="${FS_2026_HREF}">Financial Reports</a>
  <a class="ancFileLink" href="${FS_2026_HREF}">2025/26</a>
  <a href="${FS_2025_HREF}" class="icon-pdf">Document: </a>
  <a class="ancFileLink" href="${FS_2025_HREF}">Financial Reports</a>
  <a class="ancFileLink" href="${FS_2025_HREF}">2024/25</a>
`;

const { BROWSER_BYTES, BROWSER_HTML, PLAIN_BYTES } = vi.hoisted(() => {
  const pin =
    'https://www.tamworth.nsw.gov.au/ArticleDocuments/226/Annual%20Financial%20Statements%20-%202026.pdf.aspx';
  return {
    BROWSER_HTML: `<a href="${pin}">Annual Financial Statements for the year ended 30 June 2026</a>`,
    BROWSER_BYTES: Buffer.from('browser-fetched-tamworth-fs-bytes'),
    PLAIN_BYTES: Buffer.from('plain-fetched-tamworth-fs-bytes'),
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
      return Buffer.from('browser-fetched-tamworth-fs-bytes').toString('base64');
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

const { fetchTamworthGpfsViaBrowser } = await import('../../scripts/tamworth-gpfs-browser.js');

function parsedFixture() {
  return parseTamworthGpfsExtraction(tamworthExtraction(), TAMWORTH_CONTEXT);
}

describe('Tamworth Regional Council audited FS discovery', () => {
  it('discovers the FY2025-26 audited financial statements and retains older years', () => {
    expect(TAMWORTH_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseTamworthFinancialStatementsLinks(
      LISTING_HTML,
      TAMWORTH_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    const selected = selectTamworthGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(new URL(FS_2026_HREF, TAMWORTH_GPFS_REPORTING_URL).toString());
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(TAMWORTH_GPFS_REPORTING_URL);
    expect(selected.title).toContain('2025/26');
    expect(
      fiscalYearFromTamworthFinancialStatementsLink(
        'Annual Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromTamworthFinancialStatementsLink('2025/26')).toBe('2025-26');
    expect(fiscalYearFromTamworthFinancialStatementsLink('2024/25')).toBe('2024-25');
    expect(
      fiscalYearFromTamworthFinancialStatementsLink('Long Term Financial Plan 2026-2037.pdf'),
    ).toBeNull();
    expect(TAMWORTH_GPFS_STANDALONE_FS_BYTES).toBe(5_608_740);
    expect(TAMWORTH_GPFS_STANDALONE_FS_PAGES).toBe(120);
    expect(TAMWORTH_GPFS_STANDALONE_FS_SHA256).toBe(
      '03bf66f0cc18f7b8197b06e66fc9e994bd343f739da6d02ba2a6ee8e58c01408',
    );
  });

  it('rejects a prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `<a href="${FS_2025_HREF}" class="ancFileLink">2024/25</a>`;
    const links = parseTamworthFinancialStatementsLinks(
      priorOnly,
      TAMWORTH_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectTamworthGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 FS for the FY2025-26 target', () => {
    const futureOnly = `<a href="${FS_2027_HREF}" class="ancFileLink">2026/27</a>`;
    const links = parseTamworthFinancialStatementsLinks(
      futureOnly,
      TAMWORTH_GPFS_REPORTING_URL,
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectTamworthGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official FS pin when the listing yields no usable anchor', async () => {
    expect(
      parseTamworthFinancialStatementsLinks(
        '<html><body>No document links here</body></html>',
        TAMWORTH_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = tamworthPinnedDocument();
    expect(pinned.url).toBe(TAMWORTH_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    const discovered = await discoverTamworthGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(TAMWORTH_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the listing request returns a 403', async () => {
    const discovered = await discoverTamworthGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(TAMWORTH_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery', async () => {
    expect(TAMWORTH_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverTamworthGpfsDocument(
      (async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeaders = init?.headers as Record<string, string>;
        return new Response('<html>no links</html>', { status: 200 });
      }) as typeof fetch,
      '2025-26',
    );
    expect(seenHeaders?.['user-agent']).toBe('curl/8.5.0');
    expect(seenHeaders?.['user-agent']).not.toContain('Chrome');
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverTamworthGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });

  it('fetches the audited FS through the browser/WAF path', async () => {
    const fetched = await fetchTamworthGpfsViaBrowser(TAMWORTH_GPFS_REPORTING_URL, '2025-26');
    expect(fetched.pdfUrl).toBe(TAMWORTH_GPFS_DOCUMENT_PIN);
    expect(fetched.listingHtml).toBe(BROWSER_HTML);
    expect(fetched.viaBrowser).toBe(true);
    expect(Buffer.from(fetched.pdfBytes).equals(BROWSER_BYTES)).toBe(true);
  });

  it('falls back to the plain client when the browser path is refused', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      if (String(input) === TAMWORTH_GPFS_REPORTING_URL) {
        return new Response(LISTING_HTML, { status: 200 });
      }
      return new Response(PLAIN_BYTES, { status: 200 });
    }) as typeof fetch;
    const fetched = await fetchTamworthGpfsViaBrowser(TAMWORTH_GPFS_REPORTING_URL, '2025-26', {
      forcePlain: true,
      fetchImpl,
    });
    expect(fetched.viaBrowser).toBe(false);
    expect(fetched.pdfUrl).toBe(new URL(FS_2026_HREF, TAMWORTH_GPFS_REPORTING_URL).toString());
    expect(Buffer.from(fetched.pdfBytes).equals(PLAIN_BYTES)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('Tamworth Regional Council standalone GPFS slice', () => {
  it('emits 17 printed statement lines with exact face and B1-1 reconciliation', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(TAMWORTH_GPFS_ROW_COUNT);
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(TAMWORTH_GPFS_LINES).toHaveLength(17);
    const recon = parsed.reconciliation!;
    expect(recon.unit).toBe('thousands');
    expect(recon.total_revenue).toBe(252_467);
    expect(recon.total_expenses).toBe(231_225);
    expect(recon.employee_expenses).toBe(71_729);
    expect(recon.materials_and_services).toBe(84_009);
    expect(recon.borrowing_costs).toBe(3_586);
    expect(recon.other_expenses).toBe(5_146);
    expect(recon.net_loss_from_disposal_of_assets).toBe(7_321);
    expect(recon.depreciation_amortisation_impairment).toBe(59_434);
    expect(recon.government_grants_operating).toBe(28_602);
    expect(recon.government_grants_capital).toBe(35_752);
    expect(recon.net_result).toBe(21_242);
    expect(recon.net_result_before_capital_grants).toBe(-14_510);
    expect(recon.operating_result_excluding_depreciation).toBe(80_676);
    expect(recon.printed_total_expenses_excluding_depreciation).toBe(171_791);
    expect(recon.functions_income).toBe(252_467);
    expect(recon.functions_total_expenses).toBe(231_225);
    expect(recon.functions_operating_result).toBe(21_242);
    expect(recon.functions_grants_and_contributions).toBe(64_354);
    expect(recon.functions_carrying_amount).toBe(3_329_395);
    expect(recon.comprehensive_total).toBe(324_980);
    expect(recon.comprehensive_other_income).toBe(303_738);
    expect(recon.comprehensive_revaluation).toBe(303_738);
    expect(recon.comprehensive_attributable_council).toBe(325_049);
    expect(recon.comprehensive_attributable_nci).toBe(-69);
    expect(recon.total_assets).toBe(3_329_395);
    expect(recon.total_equity).toBe(3_171_649);
    expect(recon.non_controlling_equity).toBe(648);
    expect(recon.cash_net_change).toBe(6_424);
    expect(recon.cash_opening).toBe(22_103);
    expect(recon.cash_closing).toBe(28_527);
    expect(recon.checks).toHaveLength(15);
    expect(parsed.warnings[0]).toContain('reconciled exactly');
  });

  it('stores cents at the printed $’000 unit and the key statement rows', () => {
    const byKey = new Map(parsedFixture().records.map((record) => [record.gpfs_line_item, record]));
    expect(byKey.get('rates_and_annual_charges')!.amount_cents).toBe(10_354_700_000);
    expect(byKey.get('total_revenue')!.amount_cents).toBe(25_246_700_000);
    expect(byKey.get('total_expenses')!.amount_cents).toBe(23_122_500_000);
    expect(byKey.get('net_result')!.amount_cents).toBe(2_124_200_000);
    expect(byKey.get('net_loss_from_disposal_of_assets')!.gpfs_section).toBe('expenses');
    expect(byKey.get('government_grants_capital')!.potential_double_count).toBe(true);
    expect(byKey.get('government_grants_operating')!.potential_double_count).toBe(true);
    expect(byKey.get('depreciation_amortisation_impairment')!.gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(byKey.get('net_loss_from_disposal_of_assets')!.gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(byKey.get('net_result')!.notes).toContain("unit: thousands (explicit");
    expect(byKey.get('net_result')!.source_dataset).toBe(
      'Tamworth Regional Council GPFS 2025-26',
    );
  });

  it('parses B1-1 Total functions and activities on Tamworth’s layout', () => {
    const totals = parseTamworthGpfsFunctionsTotals({
      page_number: 14,
      text: TAMWORTH_FUNCTIONS_TEXT,
      items: [],
    });
    expect(totals).toEqual({
      page_number: 14,
      income: 252_467,
      expenses: 231_225,
      operating_result: 21_242,
      grants_and_contributions: 64_354,
      carrying_amount: 3_329_395,
    });
  });

  it('rejects when the printed unit is missing (unit gate)', () => {
    const extraction = tamworthExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 5 ? { ...page, text: page.text.replace(/\$ '000/g, 'Notes') } : page,
    );
    const parsed = parseTamworthGpfsExtraction(extraction, TAMWORTH_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('no unambiguous printed currency unit');
    expect(parsed.reconciliation).toBeNull();
  });

  it('rejects when printed units disagree between statements', () => {
    const extraction = tamworthExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 14 ? { ...page, text: page.text.replace(/\$ '000/g, '$m') } : page,
    );
    const parsed = parseTamworthGpfsExtraction(extraction, TAMWORTH_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('printed units disagree');
  });

  it('rejects when a printed subtotal no longer reconciles', () => {
    const extraction = tamworthExtraction();
    extraction.pages = extraction.pages.map((page) =>
      page.page_number === 14 ? { ...page, text: page.text.replace('231,225', '231,226') } : page,
    );
    const parsed = parseTamworthGpfsExtraction(extraction, TAMWORTH_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('GPFS reconciliation failed');
  });

  it('never produces a council total or cross-council row', () => {
    const records = parsedFixture().records;
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.every((record) => record.region_id === undefined)).toBe(true);
    expect(records.every((record) => record.location === undefined)).toBe(true);
    expect(new Set(records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Tamworth Regional Council']),
    );
    expect(records.some((record) => record.gpfs_line_item === 'council_total')).toBe(false);
    expect(records.every((record) => record.fiscal_year === '2025-26')).toBe(true);
  });

  it('derives a stable natural key per line and year', () => {
    const url = TAMWORTH_CONTEXT.document.url;
    const revenue = tamworthGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = tamworthGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^tamworth-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(tamworthGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(tamworthGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });

  it('keeps the fixture text anchored to the printed source lines', () => {
    expect(TAMWORTH_INCOME_TEXT).toContain('Total income from continuing operations');
    expect(TAMWORTH_INCOME_TEXT).toContain('Net loss from the disposal of assets');
    expect(TAMWORTH_INCOME_TEXT).toContain(TAMWORTH_GPFS_BEFORE_CAPITAL_LABEL);
    expect(TAMWORTH_GPFS_ID).toBe('tamworth-gpfs');
    expect(TAMWORTH_GPFS_NAME).toContain('Tamworth');
    expect(TAMWORTH_GPFS_PUBLISHER).toBe('Tamworth Regional Council');
    expect(TAMWORTH_GPFS_LICENSE).toContain('Tamworth Regional Council');
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_tamworthgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: TAMWORTH_GPFS_ID,
    name: TAMWORTH_GPFS_NAME,
    publisher: TAMWORTH_GPFS_PUBLISHER,
    source_url: TAMWORTH_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: TAMWORTH_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'tamworth-gpfs-measure', record }));
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

describe('Tamworth Regional Council GPFS ingestion is additive-only and idempotent', () => {
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
        natural_key: 'prod-existing-aus-tender-tamworth',
        project_name: 'Existing AusTender Tamworth contract',
        delivery_entity: 'TAMWORTH REGIONAL COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-tamworth-school',
        project_name: 'Existing data.nsw Tamworth school row (not a council row)',
        delivery_entity: 'Tamworth High School',
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
    expect(await MeasureModel.countDocuments({ source_id: TAMWORTH_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: TAMWORTH_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(19);

    const source = await DataSourceModel.findOne({ source_id: TAMWORTH_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
