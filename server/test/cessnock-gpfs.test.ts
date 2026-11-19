import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  CESSNOCK_GPFS_AFS_PAGE_URL,
  CESSNOCK_GPFS_DOCUMENT_PIN,
  CESSNOCK_GPFS_FISCAL_YEAR,
  CESSNOCK_GPFS_ID,
  CESSNOCK_GPFS_LICENSE,
  CESSNOCK_GPFS_NAME,
  CESSNOCK_GPFS_PUBLISHER,
  CESSNOCK_GPFS_REPORTING_URL,
  CESSNOCK_GPFS_REQUEST_HEADERS,
  cessnockGpfsNaturalKey,
  cessnockPinnedDocument,
  discoverCessnockGpfsDocument,
  fiscalYearFromCessnockAnnualReportLink,
  parseCessnockGpfsExtraction,
  parseCessnockGpfsReportLinks,
  selectCessnockGpfsDocument,
} from '../src/connectors/cessnock-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  CESSNOCK_ATTESTATION_TEXT,
  CESSNOCK_CONTEXT,
  CESSNOCK_SUMMARY_TEXT,
  cessnockExtraction,
} from '../src/connectors/cessnock-gpfs/fixture.js';
import type { PdfExtraction } from '../src/connectors/pdf-extract.js';

// Cessnock City Council's official Annual Report 2024-2025 does NOT contain the
// audited General Purpose Financial Statements section. It is a narrative
// report with a narrative "Financial summary" and ends at the Attestation
// Statement. The official Annual Report page says the Annual Financial
// Statements for the Year Ended 30 June 2025 can be viewed separately. The brief
// limits this item to the annual report and forbids substituting the standalone
// report, so the connector defers with 0 rows and records the exact gap.

const GAP_REASON =
  'audited GPFS section not found in the FY2024-25 annual report; page 13 contains only the narrative Financial summary; the report ends at the Attestation Statement on page 101; no Income Statement/Statement of Comprehensive Income/Statement of Financial Position/B1-1 with printed subtotals was found; the official Annual Report page states the Annual Financial Statements for the Year Ended 30 June 2025 can be viewed separately, and this annual-report-only item does not substitute that standalone report; no rows ingested';

function parsedFixture() {
  return parseCessnockGpfsExtraction(cessnockExtraction(), CESSNOCK_CONTEXT);
}

describe('Cessnock City Council annual-report discovery', () => {
  const pageHtml = `
    <h1 class='oc-page-title '>Annual Report</h1>
    <p>This annual report has been prepared in accordance with Section 428 of the Local Government Act 1993.
       The Annual Financial Statements for the Year Ended 30 June 2025
       <a href="https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Finance-and-budget/Annual-Financial-Statements" target="_blank">can be viewed here</a>.</p>
    <a href="/files/assets/public/v/1/hptrim/website-integrated-planning-reporting-documents-do-not-change/2025_annual-report-cessnock-city-council_2024-2025_spread.pdf" title="Annual Report 2024-2025" target="_self" class="document ext-pdf">Annual Report 2024-2025<span class="file-info">(PDF,&nbsp;16MB)</span></a>
    <a href="/files/assets/public/v/1/hptrim/website-integrated-planning-reporting-documents-do-not-change/2024_annual-report-cessnock-city-council_2023-2024_spread.pdf" title="Annual Report 2023-2024" target="_self" class="document ext-pdf">Annual Report 2023-2024<span class="file-info">(PDF,&nbsp;15MB)</span></a>
    <a href="/files/assets/public/v/1/hptrim/website-integrated-planning-reporting-documents-do-not-change/2026_annual-report-cessnock-city-council_2025-2026_spread.pdf" title="Annual Report 2025-2026" target="_self" class="document ext-pdf">Annual Report 2025-2026<span class="file-info">(PDF,&nbsp;17MB)</span></a>
  `;

  it('discovers the latest FY2024-25 annual report and selects it', () => {
    expect(CESSNOCK_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseCessnockGpfsReportLinks(pageHtml, CESSNOCK_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24', '2025-26']);
    const selected = selectCessnockGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(CESSNOCK_GPFS_DOCUMENT_PIN);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(CESSNOCK_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Annual Report 2024-2025');
    expect(fiscalYearFromCessnockAnnualReportLink('Annual Report 2024-2025')).toBe('2024-25');
    expect(fiscalYearFromCessnockAnnualReportLink('Annual Report 2023-2024')).toBe('2023-24');
    expect(fiscalYearFromCessnockAnnualReportLink('Long Term Financial Plan 2023-2033.pdf')).toBeNull();
  });

  it('never treats the separate Annual Financial Statements page as the annual report', () => {
    const links = parseCessnockGpfsReportLinks(pageHtml, CESSNOCK_GPFS_REPORTING_URL);
    expect(links.some((link) => link.url === CESSNOCK_GPFS_AFS_PAGE_URL)).toBe(false);
    expect(CESSNOCK_GPFS_AFS_PAGE_URL).toContain('/Annual-Financial-Statements');
    expect(links).toHaveLength(3);
  });

  it('rejects a prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/1/hptrim/x/2024_annual-report-cessnock-city-council_2023-2024_spread.pdf" title="Annual Report 2023-2024">Annual Report 2023-2024</a>
    `;
    const links = parseCessnockGpfsReportLinks(priorOnly, CESSNOCK_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectCessnockGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 annual report for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/hptrim/x/2026_annual-report-cessnock-city-council_2025-2026_spread.pdf" title="Annual Report 2025-2026">Annual Report 2025-2026</a>
    `;
    const links = parseCessnockGpfsReportLinks(futureOnly, CESSNOCK_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectCessnockGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseCessnockGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      CESSNOCK_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = cessnockPinnedDocument();
    expect(pinned.url).toBe(CESSNOCK_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    const discovered = await discoverCessnockGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(CESSNOCK_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverCessnockGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(CESSNOCK_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(CESSNOCK_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverCessnockGpfsDocument(
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
      discoverCessnockGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Cessnock City Council annual-report FS-section absence', () => {
  it('defers with 0 rows and records the exact annual-report gap', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections).toHaveLength(1);
    expect(parsed.rejections[0]!.reason).toBe(GAP_REASON);
    expect(CESSNOCK_SUMMARY_TEXT).toContain('Financial summary');
    expect(CESSNOCK_SUMMARY_TEXT).toContain('What were our sources of income');
    expect(CESSNOCK_ATTESTATION_TEXT).toContain('ATTESTATION STATEMENT');
  });

  it('does not treat the narrative dollar summary as an audited GPFS slice', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    const text = CESSNOCK_SUMMARY_TEXT;
    expect(text).toContain('$71.2m raised in rates and charges');
    // A narrative percentage/amount summary has no printed statement subtotal
    // or reconciliation bridge, so nothing is emitted.
    expect(text).not.toContain('Total income from continuing operations');
    expect(text).not.toContain('Operating result from continuing operations');
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
          text: 'Statement of Comprehensive Income from Income Statement',
          items: [],
        },
        {
          page_number: 3,
          text: 'Total functions and activities Functions or activities',
          items: [],
        },
      ],
      text: '',
      tables: [],
      warnings: [],
    };
    const parsed = parseCessnockGpfsExtraction(extraction, CESSNOCK_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.rejections[0]!.reason).toContain('audited GPFS section is present');
    expect(parsed.rejections[0]!.reason).toContain('no rows ingested');
  });

  it('does not invent a council total or cross-council row', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(
      parsed.records.some((record) => record.aggregation_role !== 'agency_detail'),
    ).toBe(false);
    expect(
      parsed.records.some(
        (record) => record.region_id !== undefined || record.location !== undefined,
      ),
    ).toBe(false);
  });

  it('still derives a deterministic natural key for parity', () => {
    const url = CESSNOCK_CONTEXT.document.url;
    const revenue = cessnockGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = cessnockGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^cessnock-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(cessnockGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(cessnockGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_cessnockgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: CESSNOCK_GPFS_ID,
    name: CESSNOCK_GPFS_NAME,
    publisher: CESSNOCK_GPFS_PUBLISHER,
    source_url: CESSNOCK_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CESSNOCK_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'cessnock-gpfs-measure', record }));
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

describe('Cessnock City Council annual-report ingestion is additive-only and emits no rows', () => {
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
        natural_key: 'prod-existing-aus-tender-cessnock',
        project_name: 'Existing AusTender Cessnock contract',
        delivery_entity: 'CESSNOCK CITY COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-cessnock-school',
        project_name: 'Existing data.nsw Cessnock school row (not a council row)',
        delivery_entity: 'Cessnock High School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing rows and registers Cessnock as degraded with 0 records', async () => {
    const { records } = parsedFixture();
    expect(records).toEqual([]);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: CESSNOCK_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: CESSNOCK_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    const source = await DataSourceModel.findOne({ source_id: CESSNOCK_GPFS_ID }).lean();
    expect(source?.status).toBe('degraded');
    expect(source?.records_ingested).toBe(0);
  });
});
