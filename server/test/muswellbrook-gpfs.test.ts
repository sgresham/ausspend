import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  MUSWELLBROOK_GPFS_DOCUMENT_PIN,
  MUSWELLBROOK_GPFS_FISCAL_YEAR,
  MUSWELLBROOK_GPFS_GAP,
  MUSWELLBROOK_GPFS_ID,
  MUSWELLBROOK_GPFS_LICENSE,
  MUSWELLBROOK_GPFS_NAME,
  MUSWELLBROOK_GPFS_PUBLISHER,
  MUSWELLBROOK_GPFS_REPORTING_URL,
  MUSWELLBROOK_GPFS_REQUEST_HEADERS,
  discoverMuswellbrookDocument,
  fiscalYearFromMuswellbrookAnnualReportLink,
  muswellbrookGpfsNaturalKey,
  muswellbrookPinnedDocument,
  parseMuswellbrookGpfsExtraction,
  parseMuswellbrookReportLinks,
  selectMuswellbrookDocument,
} from '../src/connectors/muswellbrook-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  MUSWELLBROOK_CONTENTS_TEXT,
  MUSWELLBROOK_CONTEXT,
  MUSWELLBROOK_GPFS_171_TEXT,
  MUSWELLBROOK_GPFS_79_TEXT,
  MUSWELLBROOK_GPFS_80_TEXT,
  MUSWELLBROOK_SUMMARY_TEXT,
  muswellbrookExtraction,
} from '../src/connectors/muswellbrook-gpfs/fixture.js';
import type { PdfExtraction } from '../src/connectors/pdf-extract.js';

// Muswellbrook Shire Council's 196-page Annual Report 2024-25 DOES embed the
// audited GPFS section (contents: General Purpose Financial Statements at page
// 79), but the GPFS section (pages 79-171) is vector-drawn with no text layer:
// every page contains only the running header/footer. The narrative Financial
// Reporting summary (pages 74-77) is in $millions and is not the audited GPFS.
// No standalone FY2024-25 GPFS PDF was found. The connector defers with 0 rows
// and records the exact gap.

const AR_URL = MUSWELLBROOK_GPFS_DOCUMENT_PIN;
const STATE_OF_SHIRE_URL =
  'https://www.muswellbrook.nsw.gov.au/wp-content/uploads/2025/01/2021-2024-State-of-the-Shire-Report.pdf';
const AR_2023_URL =
  'https://www.muswellbrook.nsw.gov.au/wp-content/uploads/2025/01/Endorsed-2023-2024-Annual-Report.pdf';
const END_OF_TERM_URL =
  'https://www.muswellbrook.nsw.gov.au/wp-content/uploads/2021/12/IPR-2016-2021-End-of-Term-Report.pdf';

const LISTING_HTML = `
  <div class="downloads"><ul class="downloads__list">
    <li class="download download--solo"><div class="download__content"><p class="download__name">
      2024-2025 Annual Report</p></div><div class="download__links">
      <a href="${AR_URL}" class="download__file">PDF (34 MB)</a></div></li>
    <li class="download download--solo"><div class="download__content"><p class="download__name">
      2021-2024 State of the Shire Report</p></div><div class="download__links">
      <a href="${STATE_OF_SHIRE_URL}" class="download__file">PDF (1 MB)</a></div></li>
  </ul></div>
  <a href="${AR_2023_URL}">2023-2024 Annual Report</a>
  <a href="${END_OF_TERM_URL}">2016-2021 End of Term Report</a>
`;

function parsedFixture() {
  return parseMuswellbrookGpfsExtraction(muswellbrookExtraction(), MUSWELLBROOK_CONTEXT);
}

describe('Muswellbrook Shire Council annual-report discovery', () => {
  it('discovers the latest FY2024-25 annual report from the download block', () => {
    expect(MUSWELLBROOK_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseMuswellbrookReportLinks(LISTING_HTML, MUSWELLBROOK_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.some((link) => link.url === STATE_OF_SHIRE_URL)).toBe(false);
    expect(links.some((link) => link.url === END_OF_TERM_URL)).toBe(false);
    const selected = selectMuswellbrookDocument(links, '2024-25');
    expect(selected.url).toBe(AR_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(MUSWELLBROOK_GPFS_REPORTING_URL);
    expect(selected.title).toContain('2024-2025 Annual Report');
    expect(fiscalYearFromMuswellbrookAnnualReportLink('2024-2025 Annual Report')).toBe('2024-25');
    expect(fiscalYearFromMuswellbrookAnnualReportLink('2023-2024 Annual Report')).toBe('2023-24');
    expect(fiscalYearFromMuswellbrookAnnualReportLink('2016-2021 End of Term Report')).toBeNull();
  });

  it('rejects a prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `<a href="${AR_2023_URL}">2023-2024 Annual Report</a>`;
    const links = parseMuswellbrookReportLinks(priorOnly, MUSWELLBROOK_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectMuswellbrookDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 annual report for the FY2024-25 target', () => {
    const futureOnly = `<a href="/files/2025-2026-Annual-Report.pdf">2025-2026 Annual Report</a>`;
    const links = parseMuswellbrookReportLinks(futureOnly, MUSWELLBROOK_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectMuswellbrookDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    expect(
      parseMuswellbrookReportLinks(
        '<html><body>No document links here</body></html>',
        MUSWELLBROOK_GPFS_REPORTING_URL,
      ),
    ).toEqual([]);
    const pinned = muswellbrookPinnedDocument();
    expect(pinned.url).toBe(MUSWELLBROOK_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    const discovered = await discoverMuswellbrookDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(MUSWELLBROOK_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverMuswellbrookDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(MUSWELLBROOK_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(MUSWELLBROOK_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverMuswellbrookDocument(
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
      discoverMuswellbrookDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Muswellbrook Shire Council embedded GPFS readability gap', () => {
  it('defers with 0 rows and records the exact no-text-layer gap', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections).toHaveLength(1);
    expect(parsed.rejections[0]!.reason).toBe(MUSWELLBROOK_GPFS_GAP);
    expect(MUSWELLBROOK_CONTENTS_TEXT).toContain('General Purpose FInancial Statements 79');
    expect(MUSWELLBROOK_CONTENTS_TEXT).toContain('Special Purpose FInancial Statements 172');
    expect(MUSWELLBROOK_SUMMARY_TEXT).toContain('Income $ (mil)');
    expect(MUSWELLBROOK_GPFS_79_TEXT.length).toBeLessThanOrEqual(60);
    expect(MUSWELLBROOK_GPFS_80_TEXT.length).toBeLessThanOrEqual(60);
    expect(MUSWELLBROOK_GPFS_171_TEXT.length).toBeLessThanOrEqual(60);
  });

  it('still defers if a future annual report exposes a readable GPFS slice', () => {
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
    const parsed = parseMuswellbrookGpfsExtraction(extraction, MUSWELLBROOK_CONTEXT);
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
    const url = MUSWELLBROOK_CONTEXT.document.url;
    const revenue = muswellbrookGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = muswellbrookGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^muswellbrook-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(muswellbrookGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(muswellbrookGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_muswellbrookgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: MUSWELLBROOK_GPFS_ID,
    name: MUSWELLBROOK_GPFS_NAME,
    publisher: MUSWELLBROOK_GPFS_PUBLISHER,
    source_url: MUSWELLBROOK_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: MUSWELLBROOK_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'muswellbrook-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: {
      lastFetchedAt: null,
      recordsIngested: 0,
      errors: [MUSWELLBROOK_GPFS_GAP],
      warnings: [],
    },
  };
}

describe('Muswellbrook Shire Council annual-report ingestion is additive-only and emits no rows', () => {
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
        natural_key: 'prod-existing-aus-tender-muswellbrook',
        project_name: 'Existing AusTender Muswellbrook contract',
        delivery_entity: 'MUSWELLBROOK SHIRE COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-muswellbrook-school',
        project_name: 'Existing data.nsw Muswellbrook school row (not a council row)',
        delivery_entity: 'Muswellbrook High School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing rows and registers Muswellbrook as degraded with 0 records', async () => {
    const { records } = parsedFixture();
    expect(records).toEqual([]);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: MUSWELLBROOK_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: MUSWELLBROOK_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    const source = await DataSourceModel.findOne({ source_id: MUSWELLBROOK_GPFS_ID }).lean();
    expect(source?.status).toBe('degraded');
    expect(source?.records_ingested).toBe(0);
  });
});
