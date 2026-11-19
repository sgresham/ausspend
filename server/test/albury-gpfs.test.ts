import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  ALBURY_GPFS_DOCUMENT_PIN,
  ALBURY_GPFS_FISCAL_YEAR,
  ALBURY_GPFS_ID,
  ALBURY_GPFS_LICENSE,
  ALBURY_GPFS_NAME,
  ALBURY_GPFS_PUBLISHER,
  ALBURY_GPFS_REPORTING_URL,
  ALBURY_GPFS_REQUEST_HEADERS,
  alburyGpfsNaturalKey,
  alburyPinnedDocument,
  discoverAlburyGpfsDocument,
  fiscalYearFromAlburyAnnualReportLink,
  parseAlburyGpfsExtraction,
  parseAlburyGpfsReportLinks,
  selectAlburyGpfsDocument,
} from '../src/connectors/albury-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  ALBURY_CONTEXT,
  ALBURY_SNAPSHOT_TEXT,
  alburyExtraction,
} from '../src/connectors/albury-gpfs/fixture.js';

// AlburyCity's official Annual Report 2024-2025 does NOT contain the audited
// General Purpose Financial Statements section. It has a narrative Financial
// Snapshot summary and says the full audited financial statements can be viewed
// on the council website. The brief limits this item to the annual report and
// forbids substituting a standalone report, so the connector defers with 0 rows
// and records the exact gap.

const GAP_REASON =
  'audited GPFS section not found in the FY2024-25 annual report; page 32 contains only the narrative Financial Snapshot summary; page 94 says the full audited financial statements can be viewed on the website; no Income Statement/Statement of Comprehensive Income/B1-1 with printed subtotals was found; no standalone GPFS was substituted; no rows ingested';

function parsedFixture() {
  return parseAlburyGpfsExtraction(alburyExtraction(), ALBURY_CONTEXT);
}

describe('Albury City Council annual-report discovery', () => {
  const pageHtml = `
    <a href="https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=5168648">Annual Report - 2024-2025 [ 17.6 MB | PDF ]</a>
    <a href="https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=4380955">Annual Report - 2023-2024 [ 18.46 MB | PDF ]</a>
    <a href="https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=3993673">Annual Report - 2022-2023 [ 13.49 MB | PDF ]</a>
  `;

  it('discovers the latest FY2024-25 annual report and selects it', () => {
    expect(ALBURY_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseAlburyGpfsReportLinks(pageHtml, ALBURY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24', '2022-23']);
    expect(links.map((link) => link.url)).toEqual([
      ALBURY_GPFS_DOCUMENT_PIN,
      'https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=4380955',
      'https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=3993673',
    ]);
    const selected = selectAlburyGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(ALBURY_GPFS_DOCUMENT_PIN);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(ALBURY_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Annual Report - 2024-2025');
    expect(fiscalYearFromAlburyAnnualReportLink('Annual Report - 2024-2025')).toBe('2024-25');
    expect(fiscalYearFromAlburyAnnualReportLink('Annual Report 2023-2024')).toBe('2023-24');
    expect(fiscalYearFromAlburyAnnualReportLink('Long Term Financial Plan 2023-2033.pdf')).toBeNull();
  });

  it('rejects a prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=4380955">Annual Report - 2023-2024 [ 18.46 MB | PDF ]</a>
    `;
    const links = parseAlburyGpfsReportLinks(priorOnly, ALBURY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectAlburyGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=9999999">Annual Report - 2025-2026 [ 18 MB | PDF ]</a>
    `;
    const links = parseAlburyGpfsReportLinks(futureOnly, ALBURY_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectAlburyGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseAlburyGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      ALBURY_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = alburyPinnedDocument();
    expect(pinned.url).toBe(ALBURY_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    const discovered = await discoverAlburyGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(ALBURY_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverAlburyGpfsDocument(
      (async () => new Response('Forbidden', { status: 403 })) as typeof fetch,
      '2024-25',
    );
    expect(discovered.url).toBe(ALBURY_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2024-25');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(ALBURY_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverAlburyGpfsDocument(
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
      discoverAlburyGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Albury City Council annual-report FS-section absence', () => {
  it('defers with 0 rows and records the exact annual-report gap', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections).toHaveLength(1);
    expect(parsed.rejections[0]!.reason).toBe(GAP_REASON);
    expect(ALBURY_SNAPSHOT_TEXT).toContain('Financial Snapshot 2024-2025');
    expect(ALBURY_SNAPSHOT_TEXT).toContain('Operating Income');
  });

  it('does not invent a council total or cross-council row', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toEqual([]);
    expect(
      parsed.records.some((record) => record.aggregation_role !== 'agency_detail'),
    ).toBe(false);
    expect(
      parsed.records.some((record) => record.region_id !== undefined || record.location !== undefined),
    ).toBe(false);
  });

  it('still derives a deterministic natural key for parity', () => {
    const url = ALBURY_CONTEXT.document.url;
    const revenue = alburyGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = alburyGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^albury-gpfs:/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(alburyGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(alburyGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_alburygpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: ALBURY_GPFS_ID,
    name: ALBURY_GPFS_NAME,
    publisher: ALBURY_GPFS_PUBLISHER,
    source_url: ALBURY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: ALBURY_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'albury-gpfs-measure', record }));
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

describe('Albury City Council annual-report ingestion is additive-only and emits no rows', () => {
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
        natural_key: 'prod-existing-aus-tender-albury',
        project_name: 'Existing AusTender Albury contract',
        delivery_entity: 'ALBURY CITY COUNCIL',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-albury-school',
        project_name: 'Existing data.nsw Albury school row (not a council row)',
        delivery_entity: 'Albury High School',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing rows and registers Albury as degraded with 0 records', async () => {
    const { records } = parsedFixture();
    expect(records).toEqual([]);
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: ALBURY_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: ALBURY_GPFS_ID })).toBe(0);
    expect(await MeasureModel.countDocuments({})).toBe(2);

    const source = await DataSourceModel.findOne({ source_id: ALBURY_GPFS_ID }).lean();
    expect(source?.status).toBe('degraded');
    expect(source?.records_ingested).toBe(0);
  });
});
