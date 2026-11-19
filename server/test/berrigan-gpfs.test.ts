import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BERRIGAN_GPFS_DOCUMENT_PIN,
  BERRIGAN_GPFS_FISCAL_YEAR,
  BERRIGAN_GPFS_ID,
  BERRIGAN_GPFS_LICENSE,
  BERRIGAN_GPFS_NAME,
  BERRIGAN_GPFS_PUBLISHER,
  BERRIGAN_GPFS_REPORTING_URL,
  BERRIGAN_GPFS_REQUEST_HEADERS,
  berriganPinnedDocument,
  detectBerriganGpfsUnit,
  discoverBerriganGpfsDocument,
  fiscalYearFromBerriganGpfsLink,
  parseBerriganGpfsExtraction,
  parseBerriganGpfsReportLinks,
  selectBerriganGpfsDocument,
  berriganGpfsNaturalKey,
} from '../src/connectors/berrigan-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  BERRIGAN_COMPREHENSIVE_TEXT,
  BERRIGAN_CONTEXT,
  BERRIGAN_FUNCTIONS_TEXT,
  BERRIGAN_INCOME_TEXT,
  BERRIGAN_PDF_SHA256,
  BERRIGAN_PDF_URL,
  berriganExtraction,
} from '../src/connectors/berrigan-gpfs/fixture.js';

// Berrigan Shire Council's audited FY2025-26 standalone General Purpose
// Financial Statements. The face statement reconciles internally, but the
// printed B1-1 "Total functions and activities" row reports expenses 32,741 and
// operating result 1,314 against the face total expenses 32,742 and net result
// 1,313. Because every printed subtotal/result bridge must reconcile at zero
// tolerance, the connector defers the document with 0 rows and records the exact
// $1 thousand gap; it does not adjust, average or fabricate the figures.

function parsedFixture() {
  return parseBerriganGpfsExtraction(berriganExtraction(), BERRIGAN_CONTEXT);
}

describe('Berrigan Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/01-council/gov.-amp-transparency/annual_financial_statements-2026-final.pdf">Annual_Financial_Statements-2026-Final.pdf (PDF,&nbsp;2MB)</a>
    <a href="/files/assets/public/v/2/01-council/gov.-amp-transparency/plans-and-strategies/reports/financial-statements-2024-2025.pdf">Financial-Statements-2024-2025.pdf (PDF,&nbsp;21MB)</a>
    <a href="/files/assets/public/v/1/01-council/gov.-amp-transparency/plans-and-strategies/reports/annual-financial-statements-2023-2024.pdf">Financial-Statements-2023-2024.pdf (PDF,&nbsp;5MB)</a>
    <a href="/files/assets/public/v/1/01-council/gov.-amp-transparency/plans-and-strategies/reports/annual-reports/annual-report-2025-26.pdf">Annual Report 2025-26 (PDF,&nbsp;5MB)</a>
    <a href="https://example.com/annual_financial_statements-2026-final.pdf">Berrigan financial statements mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the annual report, prior year or a mirror', () => {
    expect(BERRIGAN_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseBerriganGpfsReportLinks(pageHtml, BERRIGAN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      BERRIGAN_PDF_URL,
      'https://www.berriganshire.nsw.gov.au/files/assets/public/v/2/01-council/gov.-amp-transparency/plans-and-strategies/reports/financial-statements-2024-2025.pdf',
      'https://www.berriganshire.nsw.gov.au/files/assets/public/v/1/01-council/gov.-amp-transparency/plans-and-strategies/reports/annual-financial-statements-2023-2024.pdf',
    ]);
    const selected = selectBerriganGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(BERRIGAN_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(BERRIGAN_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Annual_Financial_Statements-2026-Final');
    expect(
      fiscalYearFromBerriganGpfsLink('annual_financial_statements-2026-final.pdf'),
    ).toBe('2025-26');
    expect(
      fiscalYearFromBerriganGpfsLink('financial-statements-2024-2025.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromBerriganGpfsLink(
        'Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromBerriganGpfsLink('Long Term Financial Plan 2023-2033.pdf')).toBeNull();
  });

  it('rejects a prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/assets/public/v/2/01-council/gov.-amp-transparency/plans-and-strategies/reports/financial-statements-2024-2025.pdf">Financial-Statements-2024-2025.pdf (PDF,&nbsp;21MB)</a>
    `;
    const links = parseBerriganGpfsReportLinks(priorOnly, BERRIGAN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectBerriganGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/assets/public/v/1/01-council/gov.-amp-transparency/annual-financial-statements-2026-2027.pdf">Financial Statements 2026-2027</a>
    `;
    const links = parseBerriganGpfsReportLinks(futureOnly, BERRIGAN_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectBerriganGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseBerriganGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      BERRIGAN_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = berriganPinnedDocument();
    expect(pinned.url).toBe(BERRIGAN_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('annual_financial_statements-2026-final.pdf');
    const discovered = await discoverBerriganGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(BERRIGAN_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverBerriganGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(BERRIGAN_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(BERRIGAN_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverBerriganGpfsDocument(
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
      discoverBerriganGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Berrigan Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBerriganGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBerriganGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = BERRIGAN_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseBerriganGpfsExtraction(
      extraction({ income: withoutUnit }),
      BERRIGAN_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: BERRIGAN_PDF_SHA256, bytes: 1_594_806 },
    pages: [
      pdfPage(overrides.income ?? BERRIGAN_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? BERRIGAN_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? BERRIGAN_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Berrigan Shire Council GPFS zero-tolerance deferral', () => {
  it('defers with 0 rows and reports the exact B1-1 / face $1 thousand gap', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections).toHaveLength(1);
    const reason = parsed.rejections[0]!.reason;
    expect(reason).toMatch(/reconciliation failed/);
    expect(reason).toContain('B1-1 operating result = printed net result');
    expect(reason).toContain('printed/derived 1314 != expected 1313');
    expect(reason).toContain('B1-1 expenses = face total expenses bridge');
    expect(reason).toContain('printed/derived 32741 != expected 32742');
    expect(reason).toMatch(/no rows ingested$/);
  });

  it('does not invent a council total or cross-council row when the bridge is not exact', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(
      parsed.records.some((record) => record.aggregation_role !== 'agency_detail'),
    ).toBe(false);
    expect(
      parsed.records.some((record) => record.region_id !== undefined || record.location !== undefined),
    ).toBe(false);
  });

  it('still derives stable, line-specific, fiscal-year-specific natural keys', () => {
    const url = BERRIGAN_CONTEXT.document.url;
    const revenue = berriganGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = berriganGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^berrigan-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(berriganGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(berriganGpfsNaturalKey(url, 'total_revenue', '2026-27'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_berrigangpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BERRIGAN_GPFS_ID,
    name: BERRIGAN_GPFS_NAME,
    publisher: BERRIGAN_GPFS_PUBLISHER,
    source_url: BERRIGAN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BERRIGAN_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'berrigan-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Berrigan Shire Council GPFS ingestion is additive-only and emits no rows', () => {
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
        natural_key: 'prod-existing-aus-tender-berrigan',
        project_name: 'Existing AusTender Berrigan contract',
        delivery_entity: 'BERRIGAN SHIRE COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-berrigan-school',
        project_name: 'Existing data.nsw Berrigan school row (not a council row)',
        delivery_entity: 'Berrigan High School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing rows and adds no Berrigan measure when the extraction defers', async () => {
    const { records } = parsedFixture();
    expect(records).toEqual([]);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: BERRIGAN_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BERRIGAN_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    const source = await DataSourceModel.findOne({ source_id: BERRIGAN_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(0);
  });
});
