import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  LISMORE_ANNUAL_REPORT_GAP,
  LISMORE_GPFS_DOCUMENT_PIN,
  LISMORE_GPFS_FISCAL_YEAR,
  LISMORE_GPFS_ID,
  LISMORE_GPFS_LICENSE,
  LISMORE_GPFS_NAME,
  LISMORE_GPFS_PUBLISHER,
  LISMORE_GPFS_REPORTING_URL,
  LISMORE_GPFS_REQUEST_HEADERS,
  LISMORE_GPFS_STANDALONE_FS_BYTES,
  LISMORE_GPFS_STANDALONE_FS_PAGES,
  LISMORE_GPFS_STANDALONE_FS_SHA256,
  LISMORE_GPFS_STANDALONE_FS_URL,
  discoverLismoreGpfsDocument,
  fiscalYearFromLismoreAnnualReportLink,
  lismoreGpfsNaturalKey,
  lismorePinnedDocument,
  parseLismoreGpfsExtraction,
  parseLismoreGpfsFinancialReportsLinks,
  parseLismoreGpfsReportLinks,
  selectLismoreGpfsDocument,
  selectLismoreGpfsStandaloneFsDocument,
} from '../src/connectors/lismore-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  LISMORE_BACK_COVER_TEXT,
  LISMORE_CLAIM_TEXT,
  LISMORE_CONTENTS_TEXT,
  LISMORE_CONTEXT,
  lismoreExtraction,
} from '../src/connectors/lismore-gpfs/fixture.js';
import type { PdfExtraction } from '../src/connectors/pdf-extract.js';

// Lismore City Council's official Annual Report 2024/25 does NOT contain the
// audited General Purpose Financial Statements section. It is a 74-page
// narrative/statutory-information report whose contents end at Statutory
// Information. The same official page publishes a separate current-year
// "Financial reports 2024/25" PDF. The brief limits this item to the annual report
// and forbids substituting a standalone report, so the connector defers with 0
// rows, records the exact gap, and records the separate FS for a future cure.

const AR_2024_HREF =
  '/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/lcc-annual-report-2024-25-a4.pdf';
const AR_2023_HREF =
  '/files/assets/public/v/2/5.-council/7.-about-council/6.-corporate-information/annual-report-2023-2024.pdf';
const AR_2022_HREF =
  '/files/assets/public/v/2/5.-council/7.-about-council/6.-corporate-information/annual-report-2023.pdf';
const FS_2024_URL = LISMORE_GPFS_STANDALONE_FS_URL;
const FS_2023_HREF =
  '/files/assets/public/v/2/5.-council/7.-about-council/6.-corporate-information/annual_financial_statements-2024.pdf';

const LISTING_HTML = `
  <a href="${AR_2024_HREF}" title="Annual Report 2024/25" target="_blank" class="document ext-pdf">Annual Report 2024/25<span class="file-info">(PDF,&nbsp;10MB)</span></a>
  <a href="/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/ed25-81999-2024-2025-attestation-signed.pdf" title="Appendix 1 - Signed Attestation 2024-2025">Appendix 1 - Signed Attestation 2024-2025</a>
  <a href="${AR_2023_HREF}" title="Annual Report 2023/24" target="_blank" class="document ext-pdf">Annual Report 2023/24</a>
  <a href="/files/assets/public/v/2/5.-council/7.-about-council/6.-corporate-information/2021-2024-state-of-our-city-report.pdf" title="2021-2024 State of our City Report">2021-2024 State of our City Report</a>
  <a href="${AR_2022_HREF}" title="Annual Report 2022/23" target="_blank" class="document ext-pdf">Annual Report 2022/23</a>
  <a href="${FS_2024_URL}" title="Financial reports 2024/25" target="_blank" class="document ext-pdf">Financial reports 2024/25<span class="file-info">(PDF,&nbsp;3MB)</span></a>
  <a href="${FS_2023_HREF}" title="Financial reports 2023/24" target="_blank" class="document ext-pdf">Financial reports 2023/24</a>
  <a href="/files/assets/public/v/1/5.-council/6.-corporate-information/long-term-financial-plan-2026-2036.pdf" title="Long Term Financial Plan 2026-2037">Long Term Financial Plan 2026-2037</a>
`;

function parsedFixture() {
  return parseLismoreGpfsExtraction(lismoreExtraction(), LISMORE_CONTEXT);
}

describe('Lismore City Council annual-report discovery', () => {
  it('discovers the latest FY2024-25 annual report and excludes the separate FS', () => {
    expect(LISMORE_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseLismoreGpfsReportLinks(LISTING_HTML, LISMORE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24', '2022-23']);
    expect(links.some((link) => link.url === FS_2024_URL)).toBe(false);
    expect(links.some((link) => /attestation/i.test(link.url))).toBe(false);
    const selected = selectLismoreGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(new URL(AR_2024_HREF, LISMORE_GPFS_REPORTING_URL).toString());
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(LISMORE_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Annual Report 2024/25');
    expect(fiscalYearFromLismoreAnnualReportLink('Annual Report 2024/25')).toBe('2024-25');
    expect(fiscalYearFromLismoreAnnualReportLink('Annual Report 2023/24')).toBe('2023-24');
    expect(
      fiscalYearFromLismoreAnnualReportLink('Long Term Financial Plan 2026-2037.pdf'),
    ).toBeNull();
  });

  it('records the separate current-year Financial reports 2024/25 PDF for a cure', () => {
    const links = parseLismoreGpfsFinancialReportsLinks(LISTING_HTML, LISMORE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    const selected = selectLismoreGpfsStandaloneFsDocument(links, '2024-25');
    expect(selected.url).toBe(FS_2024_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(LISMORE_GPFS_STANDALONE_FS_BYTES).toBe(3_269_117);
    expect(LISMORE_GPFS_STANDALONE_FS_PAGES).toBe(104);
    expect(LISMORE_GPFS_STANDALONE_FS_SHA256).toBe(
      'e4816b7149d268099bbb931fcf0a3b34b03ab0e4b28663aba18039cdf0da9797',
    );
  });

  it('rejects a prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `<a href="${AR_2023_HREF}" title="Annual Report 2023/24">Annual Report 2023/24</a>`;
    const links = parseLismoreGpfsReportLinks(priorOnly, LISMORE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectLismoreGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 annual report for the FY2024-25 target', () => {
    const futureOnly = `<a href="/files/x/lcc-annual-report-2025-26.pdf" title="Annual Report 2025/26">Annual Report 2025/26</a>`;
    const links = parseLismoreGpfsReportLinks(futureOnly, LISMORE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectLismoreGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    expect(
      parseLismoreGpfsReportLinks(
        '<html><body>No document links here</body></html>',
        LISMORE_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = lismorePinnedDocument();
    expect(pinned.url).toBe(LISMORE_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    const discovered = await discoverLismoreGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(LISMORE_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverLismoreGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(LISMORE_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(LISMORE_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverLismoreGpfsDocument(
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
      discoverLismoreGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Lismore City Council annual-report FS-section absence', () => {
  it('defers with 0 rows and records the exact annual-report gap', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections).toHaveLength(1);
    expect(parsed.rejections[0]!.reason).toBe(LISMORE_ANNUAL_REPORT_GAP);
    expect(LISMORE_CONTENTS_TEXT).toContain('Statutory Information');
    expect(LISMORE_CLAIM_TEXT).toContain('must also contain');
    expect(LISMORE_CLAIM_TEXT).toContain('Financial Statements');
    expect(LISMORE_BACK_COVER_TEXT).toContain('lismorecitycouncil.nsw.gov.au');
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
    const parsed = parseLismoreGpfsExtraction(extraction, LISMORE_CONTEXT);
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
    const url = LISMORE_CONTEXT.document.url;
    const revenue = lismoreGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = lismoreGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^lismore-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(lismoreGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(lismoreGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_lismoregpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: LISMORE_GPFS_ID,
    name: LISMORE_GPFS_NAME,
    publisher: LISMORE_GPFS_PUBLISHER,
    source_url: LISMORE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LISMORE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'lismore-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: {
      lastFetchedAt: null,
      recordsIngested: 0,
      errors: [LISMORE_ANNUAL_REPORT_GAP],
      warnings: [],
    },
  };
}

describe('Lismore City Council annual-report ingestion is additive-only and emits no rows', () => {
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
        natural_key: 'prod-existing-aus-tender-lismore',
        project_name: 'Existing AusTender Lismore contract',
        delivery_entity: 'LISMORE CITY COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-lismore-school',
        project_name: 'Existing data.nsw Lismore school row (not a council row)',
        delivery_entity: 'Lismore High School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing rows and registers Lismore as degraded with 0 records', async () => {
    const { records } = parsedFixture();
    expect(records).toEqual([]);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: LISMORE_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: LISMORE_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    const source = await DataSourceModel.findOne({ source_id: LISMORE_GPFS_ID }).lean();
    expect(source?.status).toBe('degraded');
    expect(source?.records_ingested).toBe(0);
  });
});
