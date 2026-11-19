import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  KIAMA_GPFS_DOCUMENT_PIN,
  KIAMA_GPFS_FISCAL_YEAR,
  KIAMA_GPFS_ID,
  KIAMA_GPFS_LICENSE,
  KIAMA_GPFS_NAME,
  KIAMA_GPFS_PUBLISHER,
  KIAMA_GPFS_REPORTING_URL,
  KIAMA_GPFS_REQUEST_HEADERS,
  KIAMA_GPFS_STANDALONE_FS_URL,
  discoverKiamaGpfsDocument,
  fiscalYearFromKiamaAnnualReportLink,
  kiamaGpfsNaturalKey,
  kiamaPinnedDocument,
  parseKiamaGpfsExtraction,
  parseKiamaGpfsReportLinks,
  selectKiamaGpfsDocument,
} from '../src/connectors/kiama-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  KIAMA_AUTHORISATION_TEXT,
  KIAMA_CONTENTS_TEXT,
  KIAMA_CONTEXT,
  KIAMA_SUMMARY_TEXT,
  kiamaExtraction,
} from '../src/connectors/kiama-gpfs/fixture.js';
import type { PdfExtraction } from '../src/connectors/pdf-extract.js';

// Kiama Municipal Council's official Annual Report 2024-25 does NOT contain the
// audited General Purpose Financial Statements section. It has an un-audited
// Consolidated operating results summary (page 19) and ends at the Authorisation
// and version control page (page 91). The same official page publishes a separate
// current-year Financial Statements PDF. The brief limits this item to the annual
// report and forbids substituting a standalone report, so the connector defers
// with 0 rows and records the exact gap.

const GAP_REASON =
  'audited GPFS section not found in the FY2024-25 annual report; page 19 contains only the un-audited Consolidated operating results summary; the report ends at the Authorisation and version control page (page 91); no Income Statement/Statement of Comprehensive Income/Statement of Financial Position/Statement of Cash Flows/B1-1 with printed subtotals was found; the official Reporting page publishes a separate FY2024-25 Financial Statements PDF, and this annual-report-only item does not substitute that standalone report; no rows ingested';

const AR_2024_HREF =
  '/files/sharedassets/public/v/1/council/council-plans-amp-reports/2024-25-annual-report-final.pdf';
const AR_2023_HREF =
  '/files/sharedassets/public/v/1/council/council-plans-amp-reports/kmc-annual-report-2023-2024.pdf';
const AR_2022_HREF =
  '/files/sharedassets/public/v/5/council/council-plans-amp-reports/kmc-annual-report-2022-2023.pdf';

function parsedFixture() {
  return parseKiamaGpfsExtraction(kiamaExtraction(), KIAMA_CONTEXT);
}

describe('Kiama Municipal Council annual-report discovery', () => {
  const pageHtml = `
    <p>Council's Annual Financial Statements are based on each financial year, and set out Council's financial performance, financial position and cash flows.</p>
    <a href="${AR_2024_HREF}" title="Annual Report 2024-25" target="_blank" class="document ext-pdf">Annual Report 2024-25<span class="file-info">(PDF,&nbsp;15MB)</span></a>
    <a href="${AR_2023_HREF}" title="Annual Report 2023-24" target="_blank" class="document ext-pdf">Annual Report 2023-24<span class="file-info">(PDF,&nbsp;9MB)</span></a>
    <a href="${AR_2022_HREF}" title="Annual Report 2022-23" target="_blank" class="document ext-pdf">Annual Report 2022-23<span class="file-info">(PDF,&nbsp;10MB)</span></a>
    <a href="/files/sharedassets/public/v/1/council/council-plans-amp-reports/annual-report-2022-2023-addendum.pdf" title="Annual Report 2022-23 - Addendum" target="_blank" class="document ext-pdf">Annual Report 2022-23 - Addendum</a>
    <a href="${KIAMA_GPFS_STANDALONE_FS_URL}" title="Financial-Statements-2024-25" target="_blank" class="document ext-pdf">Financial-Statements-2024-25<span class="file-info">(PDF,&nbsp;10MB)</span></a>
    <a href="/files/sharedassets/public/v/2/news/2023-24-audited-financial-statements.pdf" title="Financial statements 2023-24">Financial statements 2023-24</a>
  `;

  it('discovers the latest FY2024-25 annual report and never selects the separate FS', () => {
    expect(KIAMA_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseKiamaGpfsReportLinks(pageHtml, KIAMA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24', '2022-23']);
    expect(links.some((link) => link.url === KIAMA_GPFS_STANDALONE_FS_URL)).toBe(false);
    expect(links.some((link) => /addendum/i.test(link.url))).toBe(false);
    const selected = selectKiamaGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(new URL(AR_2024_HREF, KIAMA_GPFS_REPORTING_URL).toString());
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(KIAMA_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Annual Report 2024-25');
    expect(fiscalYearFromKiamaAnnualReportLink('Annual Report 2024-25')).toBe('2024-25');
    expect(fiscalYearFromKiamaAnnualReportLink('Annual Report 2023-2024')).toBe('2023-24');
    expect(
      fiscalYearFromKiamaAnnualReportLink('Long Term Financial Plan 2023-2033.pdf'),
    ).toBeNull();
  });

  it('rejects a prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `<a href="${AR_2023_HREF}" title="Annual Report 2023-24">Annual Report 2023-24</a>`;
    const links = parseKiamaGpfsReportLinks(priorOnly, KIAMA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectKiamaGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 annual report for the FY2024-25 target', () => {
    const futureOnly = `<a href="/files/x/2025-26-annual-report-final.pdf" title="Annual Report 2025-26">Annual Report 2025-26</a>`;
    const links = parseKiamaGpfsReportLinks(futureOnly, KIAMA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectKiamaGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    expect(
      parseKiamaGpfsReportLinks(
        '<html><body>No document links here</body></html>',
        KIAMA_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = kiamaPinnedDocument();
    expect(pinned.url).toBe(KIAMA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    const discovered = await discoverKiamaGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(KIAMA_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverKiamaGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(KIAMA_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(KIAMA_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverKiamaGpfsDocument(
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
      discoverKiamaGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Kiama Municipal Council annual-report FS-section absence', () => {
  it('defers with 0 rows and records the exact annual-report gap', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections).toHaveLength(1);
    expect(parsed.rejections[0]!.reason).toBe(GAP_REASON);
    expect(KIAMA_SUMMARY_TEXT).toContain('Consolidated operating results');
    expect(KIAMA_SUMMARY_TEXT).toContain(
      'Net operating result for the year attributable to Council',
    );
    expect(KIAMA_AUTHORISATION_TEXT).toContain('Authorisation and version control');
    // The contents page also names the section; the parser must select the real
    // authorisation page (91), not the table-of-contents entry (3).
    expect(KIAMA_CONTENTS_TEXT).toContain('Authorisation and version control');
    expect(parsed.rejections[0]!.reason).toContain('(page 91)');
    expect(parsed.rejections[0]!.reason).not.toContain('(page 3)');
  });

  it('does not emit the un-audited Consolidated operating results summary', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(KIAMA_SUMMARY_TEXT).toContain('$’000');
    expect(KIAMA_SUMMARY_TEXT).toContain('74,082');
    expect(KIAMA_SUMMARY_TEXT).not.toContain('Total functions and activities');
    expect(KIAMA_SUMMARY_TEXT).not.toContain('Statement of Financial Position');
  });

  it('still defers if a future annual report exposes GPFS-like pages', () => {
    const extraction: PdfExtraction = {
      source: { sha256: 'test', bytes: 1 },
      pages: [
        {
          page_number: 1,
          text: 'Income Statement Total income from continuing operations Operating result from continuing operations',
          items: [],
        },
        {
          page_number: 2,
          text: 'Statement of Financial Position Total assets Net assets',
          items: [],
        },
        {
          page_number: 3,
          text: 'Statement of Cash Flows Net cash flows from operating activities',
          items: [],
        },
      ],
      text: '',
      tables: [],
      warnings: [],
    };
    const parsed = parseKiamaGpfsExtraction(extraction, KIAMA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('audited GPFS section is present');
    expect(parsed.rejections[0]!.reason).toContain('no rows ingested');
  });

  it('does not invent a council total or cross-council row', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(parsed.records.some((record) => record.aggregation_role !== 'agency_detail')).toBe(
      false,
    );
    expect(
      parsed.records.some(
        (record) => record.region_id !== undefined || record.location !== undefined,
      ),
    ).toBe(false);
  });

  it('still derives a deterministic natural key for parity', () => {
    const url = KIAMA_CONTEXT.document.url;
    const revenue = kiamaGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = kiamaGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^kiama-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(kiamaGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(kiamaGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_kiamagpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: KIAMA_GPFS_ID,
    name: KIAMA_GPFS_NAME,
    publisher: KIAMA_GPFS_PUBLISHER,
    source_url: KIAMA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: KIAMA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'kiama-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: {
      lastFetchedAt: null,
      recordsIngested: 0,
      errors: [GAP_REASON],
      warnings: [],
    },
  };
}

describe('Kiama Municipal Council annual-report ingestion is additive-only and emits no rows', () => {
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
        natural_key: 'prod-existing-aus-tender-kiama',
        project_name: 'Existing AusTender Kiama contract',
        delivery_entity: 'KIAMA MUNICIPAL COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-kiama-school',
        project_name: 'Existing data.nsw Kiama school row (not a council row)',
        delivery_entity: 'Kiama High School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing rows and registers Kiama as degraded with 0 records', async () => {
    const { records } = parsedFixture();
    expect(records).toEqual([]);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: KIAMA_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: KIAMA_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    const source = await DataSourceModel.findOne({ source_id: KIAMA_GPFS_ID }).lean();
    expect(source?.status).toBe('degraded');
    expect(source?.records_ingested).toBe(0);
  });
});
