import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  coverageOf,
  createGrantConnectConnector,
  detectCapWarning,
  fiscalYearRange,
  formatRange,
  buildDownloadResultUrl,
  inspectGrantConnectExport,
  mapGrantConnectRow,
  parseDateRange,
  planChunks,
  runIngestion,
  type GrantConnectFileRecord,
} from '../src/connectors/index.js';
import {
  archiveSourceDocument,
  listArchivedRecords,
  sha256File,
} from '../src/connectors/source-archive.js';
import {
  DataSourceModel,
  IngestionLogModel,
  MeasureModel,
  SourceDocumentModel,
} from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_grantconnect`;

const HEADERS = [
  'GA ID',
  'Grant Activity',
  'Agency',
  'Publish Date',
  'Category',
  'Start Date',
  'End Date',
  'Value (AUD)',
  'GO ID',
  'Recipient Name',
  'One-off/Ad hoc',
  'Aggregate Grant Award',
  'Aggregate Reason',
  'Number of Awards Aggregated',
  'Last Updated',
];

const CAP_TEXT =
  'Your search returned more than 50000 results. Please narrow the date range and run multiple searches to return all records.';

function row(overrides: Record<string, string | number> = {}): Record<string, string | number> {
  return {
    'GA ID': 'GA1001',
    'Grant Activity': 'Test Grant Activity A',
    Agency: 'Department of Testing',
    'Publish Date': '"2025-08-01T00:00:00.000Z"',
    Category: 'Health',
    'Start Date': '"2025-07-15T00:00:00.000Z"',
    'End Date': '"2026-06-30T00:00:00.000Z"',
    'Value (AUD)': 1104,
    'GO ID': 'GO1001',
    'Recipient Name': 'Recipient A',
    'One-off/Ad hoc': 'No',
    'Aggregate Grant Award': 'No',
    'Aggregate Reason': '',
    'Number of Awards Aggregated': 0,
    'Last Updated': '1-Aug-2025 10:00 am (ACT Local Time)',
    ...overrides,
  };
}

async function makeExport(options: {
  directory: string;
  filename: string;
  dateRange: string;
  capWarning?: boolean;
  rows: Array<Record<string, string | number>>;
}): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('GrantConnect-Grant-Award-List');
  sheet.addRow(['Grant Award List']);
  sheet.addRow([]);
  sheet.addRow(['Criteria Summary']);
  sheet.addRow(['Searching', 'Grant Awards']);
  sheet.addRow(['Agency', 'All Active and Retired Agencies']);
  sheet.addRow(['Keyword', '-']);
  sheet.addRow(['GA ID', 'All']);
  sheet.addRow(['Date Type', 'Publish Date']);
  sheet.addRow(['Date Range', options.dateRange]);
  sheet.addRow(['Recipient Name', 'All']);
  sheet.addRow([]);
  if (options.capWarning) sheet.addRow([CAP_TEXT]);
  sheet.addRow([]);
  sheet.addRow(HEADERS);
  for (const entry of options.rows) {
    sheet.addRow(HEADERS.map((header) => entry[header] ?? ''));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const filePath = path.join(options.directory, options.filename);
  await writeFile(filePath, Buffer.from(buffer as ArrayBuffer));
  return filePath;
}

let fixtureDir = '';
let archiveRoot = '';

beforeAll(async () => {
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
  fixtureDir = await mkdtemp(path.join(tmpdir(), 'gc-fixtures-'));
  archiveRoot = await mkdtemp(path.join(tmpdir(), 'gc-archive-'));
});

beforeEach(async () => {
  await Promise.all([
    DataSourceModel.deleteMany({}),
    IngestionLogModel.deleteMany({}),
    MeasureModel.deleteMany({}),
    SourceDocumentModel.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
  if (archiveRoot) await rm(archiveRoot, { recursive: true, force: true });
});

describe('GrantConnect chunk arithmetic', () => {
  it('parses the criteria Date Range and plans contiguous, complete chunks', () => {
    const range = parseDateRange('1-Jul-2025 to 30-Jun-2026');
    expect(range).toEqual({ start: '2025-07-01', end: '2026-06-30' });
    expect(fiscalYearRange('2025-26')).toEqual(range);

    const chunks = planChunks(range!, 31);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({ index: 1, start: '2025-07-01', end: '2025-07-31' });
    expect(chunks[chunks.length - 1]!.end).toBe('2026-06-30');
    // No gaps and no overlaps.
    for (let index = 1; index < chunks.length; index += 1) {
      const previous = new Date(`${chunks[index - 1]!.end}T00:00:00.000Z`).getTime();
      const current = new Date(`${chunks[index]!.start}T00:00:00.000Z`).getTime();
      expect(current - previous).toBe(86_400_000);
    }
  });

  it('builds DownloadResult URLs with three-letter month tokens', () => {
    const url = buildDownloadResultUrl({ start: '2025-09-01', end: '2025-09-07' });
    expect(url).toContain('DateStart=1-Sep-2025');
    expect(url).toContain('DateEnd=7-Sep-2025');
    // en-AU ICU renders September as "Sept"; GrantConnect returns HTTP 500 for it.
    expect(url).not.toContain('Sept');
    expect(buildDownloadResultUrl({ start: '2025-10-01', end: '2025-10-01' })).toContain(
      'DateStart=1-Oct-2025',
    );
  });

  it('reports partial and complete coverage truthfully', () => {
    const target = fiscalYearRange('2025-26');
    const half = { start: '2025-07-01', end: '2025-12-31' } as const;
    const partial = coverageOf(target, [half]);
    expect(partial.complete).toBe(false);
    expect(partial.missing).toEqual([{ start: '2026-01-01', end: '2026-06-30' }]);
    expect(partial.covered_days).toBeLessThan(partial.target_days);

    const complete = coverageOf(target, [half, { start: '2026-01-01', end: '2026-06-30' }]);
    expect(complete.complete).toBe(true);
    expect(complete.missing).toEqual([]);
    expect(complete.covered_days).toBe(365);
  });

  it('detects the 50,000-result cap warning', () => {
    expect(detectCapWarning([[CAP_TEXT]]).cap_warning).toBe(true);
    expect(detectCapWarning([['Date Range', '1-Jul-2025 to 30-Jun-2026']]).cap_warning).toBe(false);
  });
});

describe('GrantConnect export inspection and mapping', () => {
  it('rejects a cap-warned export even though it contains award rows', async () => {
    const file = await makeExport({
      directory: fixtureDir,
      filename: 'capped.xlsx',
      dateRange: '1-Jul-2025 to 30-Jun-2026',
      capWarning: true,
      rows: [row({ 'GA ID': 'GA-CAP-1' })],
    });
    const inspection = await inspectGrantConnectExport(file);
    expect(inspection.header_row).toBeGreaterThan(1);
    expect(inspection.cap_warning).toBe(true);
    expect(inspection.rejection_reason).toMatch(/more than 50000|narrow the date range/i);
    expect(inspection.date_range).toEqual({ start: '2025-07-01', end: '2026-06-30' });
  });

  it('rejects an unbounded (All) export', async () => {
    const file = await makeExport({
      directory: fixtureDir,
      filename: 'all-dates.xlsx',
      dateRange: 'All',
      capWarning: true,
      rows: [row()],
    });
    const inspection = await inspectGrantConnectExport(file);
    expect(inspection.date_range).toBeNull();
    expect(inspection.rejection_reason).toMatch(/not a bounded period|50,?000|more than/i);
  });

  it('maps Value (AUD) dollars to integer cents and preserves provenance', () => {
    const file: GrantConnectFileRecord = {
      filename: 'chunk.xlsx',
      local_path: '/tmp/chunk.xlsx',
      sha256: 'a'.repeat(64),
      bytes: 1,
      content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      original_url: 'https://example.invalid/list',
      retrieved_from: 'https://example.invalid/list',
      fetched_at: '2026-01-01T00:00:00.000Z',
      header_row: 12,
      headers: HEADERS,
      criteria: [],
      date_range_raw: '1-Jul-2025 to 31-Jul-2025',
      date_range: { start: '2025-07-01', end: '2025-07-31' },
      cap_warning: false,
      cap_warning_text: null,
      data_rows: 1,
      accepted: true,
      rejection_reason: null,
      archive_document_id: null,
    };
    const mapped = mapGrantConnectRow(row(), file);
    expect('skip' in mapped).toBe(false);
    if ('skip' in mapped) return;
    expect(mapped.amount_cents).toBe(110_400);
    expect(mapped.measure_type).toBe('grant_award');
    expect(mapped.fiscal_year).toBe('2025-26');
    expect(mapped.jurisdiction_level).toBe('federal');
    expect(mapped.jurisdiction).toBe('Commonwealth');
    expect(mapped.delivery_entity).toBe('Recipient A');
    expect(mapped.funding_source).toBe('Department of Testing');
    expect(mapped.source_dataset).toBe('GrantConnect — manual grant award export');
    expect(mapped.source_date).toBe('2025-08-01');
    expect(mapped.verified).toBe(false);
    expect(mapped.natural_key).toBe('grantconnect:GA1001');
    expect(mapped.notes ?? '').toContain(`sha256=${'a'.repeat(64)}`);
    expect(mapped.notes ?? '').toContain('grant_id=GA1001');

    const cents = mapGrantConnectRow(row({ 'Value (AUD)': 1975.92, 'GA ID': 'GA-DECIMAL' }), file);
    if ('skip' in cents) throw new Error('expected mapped row');
    expect(cents.amount_cents).toBe(197_592);

    const invalid = mapGrantConnectRow(row({ 'Value (AUD)': '-1' }), file);
    expect('skip' in invalid).toBe(true);
  });
});

describe('GrantConnect connector — complete chunks, dedupe and idempotency', () => {
  async function completeChunkFiles(): Promise<string[]> {
    const first = await makeExport({
      directory: fixtureDir,
      filename: 'chunk-01-jul-dec.xlsx',
      dateRange: '1-Jul-2025 to 31-Dec-2025',
      rows: [
        row({ 'GA ID': 'GA1001' }),
        row({ 'GA ID': 'GA1002', 'Recipient Name': 'Recipient B', 'Value (AUD)': 2500 }),
        row({ 'GA ID': 'GA1003', 'Recipient Name': 'Recipient C' }),
        row({ 'GA ID': 'GA1004', 'Recipient Name': 'Recipient D' }),
        row({ 'GA ID': 'GA1005', 'Recipient Name': 'Recipient E' }),
        row({ 'GA ID': 'GA1006', 'Recipient Name': 'Recipient F' }),
      ],
    });
    const second = await makeExport({
      directory: fixtureDir,
      filename: 'chunk-02-jan-jun.xlsx',
      dateRange: '1-Jan-2026 to 30-Jun-2026',
      rows: [
        // Boundary duplicate: must dedupe by natural_key.
        row({ 'GA ID': 'GA1006', 'Recipient Name': 'Recipient F' }),
        row({ 'GA ID': 'GA1007', 'Recipient Name': 'Recipient G', 'Value (AUD)': 9292 }),
        row({
          'GA ID': 'GA1008',
          'Recipient Name': 'Recipient H',
          'Publish Date': '"2026-01-14T10:58:55.000Z"',
        }),
        row({ 'GA ID': 'GA1009', 'Recipient Name': 'Recipient I' }),
        row({ 'GA ID': 'GA1010', 'Recipient Name': 'Recipient J' }),
        row({ 'GA ID': 'GA1011', 'Recipient Name': 'Recipient K' }),
      ],
    });
    return [first, second];
  }

  it('imports both chunks, dedupes boundary rows and reports complete coverage', async () => {
    const connector = createGrantConnectConnector({
      filePaths: await completeChunkFiles(),
      registerArchive: false,
    });
    const result = await runIngestion({ connectors: [connector] });
    const entry = result.results[0]!;
    expect(entry.log_status).toBe('success');
    expect(entry.status).toBe('active');
    expect(entry.records_upserted).toBe(11);
    expect(entry.errors).toEqual([]);

    const grantRows = await MeasureModel.find({ source_id: 'grantconnect' }).lean();
    expect(grantRows).toHaveLength(11);
    expect(new Set(grantRows.map((grant) => grant.natural_key)).size).toBe(11);
    expect(grantRows.every((grant) => grant.measure_type === 'grant_award')).toBe(true);
    expect(grantRows.every((grant) => grant.verified === false)).toBe(true);

    const ga1007 = grantRows.find((grant) => grant.natural_key === 'grantconnect:GA1007');
    expect(ga1007?.amount_cents).toBe(929_200);
    const ga1008 = grantRows.find((grant) => grant.natural_key === 'grantconnect:GA1008');
    expect(ga1008?.fiscal_year).toBe('2025-26');

    const source = await DataSourceModel.findOne({ source_id: 'grantconnect' }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(11);
    expect(source?.notes).toMatch(/manual export/i);
    expect(source?.notes).toMatch(/Coverage complete 2025-07-01\.\.2026-06-30/);
  });

  it('re-running the same chunks is idempotent (no duplicate rows)', async () => {
    const files = await completeChunkFiles();
    const first = await runIngestion({
      connectors: [createGrantConnectConnector({ filePaths: files, registerArchive: false })],
    });
    const afterFirst = await MeasureModel.countDocuments({ source_id: 'grantconnect' });
    expect(first.results[0]!.records_upserted).toBe(11);

    const second = await runIngestion({
      connectors: [createGrantConnectConnector({ filePaths: files, registerArchive: false })],
    });
    const afterSecond = await MeasureModel.countDocuments({ source_id: 'grantconnect' });
    expect(second.results[0]!.records_upserted).toBe(11);
    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond).toBe(11);
  });

  it('imports zero rows from the capped wide export and stays partial/degraded', async () => {
    const capped = await makeExport({
      directory: fixtureDir,
      filename: 'capped-wide.xlsx',
      dateRange: '1-Jul-2025 to 30-Jun-2026',
      capWarning: true,
      rows: [row({ 'GA ID': 'GA-CAPPED' })],
    });
    const connector = createGrantConnectConnector({
      filePaths: [capped],
      registerArchive: false,
    });
    const result = await runIngestion({ connectors: [connector] });
    const entry = result.results[0]!;
    expect(entry.records_fetched).toBe(0);
    expect(entry.records_upserted).toBe(0);
    expect(entry.status).toBe('degraded');
    expect(entry.log_status).toBe('partial');
    expect(entry.errors.join(' ')).toMatch(/partial GrantConnect coverage/);
    expect(entry.errors.join(' ')).toMatch(/more than 50000|narrow the date range/i);

    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(0);
    const source = await DataSourceModel.findOne({ source_id: 'grantconnect' }).lean();
    expect(source?.status).toBe('degraded');
    expect(source?.records_ingested).toBe(0);
    expect(source?.notes).toMatch(/50,000|50,000-result|50000/i);
  });

  it('preserves old rows when the export directory is missing (error, no abort)', async () => {
    await MeasureModel.create({
      natural_key: 'grantconnect:EXISTING',
      amount_cents: 123,
      measure_type: 'grant_award',
      fiscal_year: '2025-26',
      source_id: 'grantconnect',
      source_url: 'https://www.grants.gov.au/Ga/ListResult?GAID=EXISTING',
      verified: false,
    });
    const connector = createGrantConnectConnector({
      directory: path.join(fixtureDir, 'does-not-exist'),
      registerArchive: false,
    });
    const result = await runIngestion({ connectors: [connector] });
    expect(result.results[0]!.log_status).toBe('error');
    expect(result.results[0]!.status).toBe('error');
    expect(result.results[0]!.errors[0]).toMatch(/directory is not readable/i);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    const source = await DataSourceModel.findOne({ source_id: 'grantconnect' }).lean();
    expect(source?.status).toBe('degraded');
  });
});

describe('GrantConnect archive registration', () => {
  it('adopts each manual export with its real SHA-256 and byte length', async () => {
    const file = await makeExport({
      directory: fixtureDir,
      filename: 'chunk-archive.xlsx',
      dateRange: '1-Jul-2025 to 31-Jul-2025',
      rows: [row()],
    });
    const connector = createGrantConnectConnector({
      filePaths: [file],
      targetFiscalYear: '2025-26',
      archiveRoot,
      persistArchive: true,
    });
    await connector.fetch();

    const records = await listArchivedRecords({ root: archiveRoot, source_id: 'grantconnect' });
    expect(records).toHaveLength(1);
    const archived = records[0]!;
    expect(archived.archived_from).toBe('direct');
    const info = await stat(file);
    expect(archived.sha256).toBe(await sha256File(file));
    expect(archived.bytes).toBe(info.size);
    expect(archived.hash_verified).toBe(true);
    expect(archived.local_path).toBe(file);

    const stored = await SourceDocumentModel.find({ source_id: 'grantconnect' }).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.sha256).toBe(await sha256File(file));
  });

  it('archiveSourceDocument stores bytes outside the repo and re-verifies', async () => {
    const file = await makeExport({
      directory: fixtureDir,
      filename: 'chunk-verify.xlsx',
      dateRange: '1-Jul-2025 to 31-Jul-2025',
      rows: [row({ 'GA ID': 'GA-VERIFY' })],
    });
    const record = await archiveSourceDocument({
      source_id: 'grantconnect',
      title: 'verify',
      original_url: 'https://example.invalid/list',
      archived_from: 'direct',
      filename: 'chunk-verify.xlsx',
      from_path: file,
      root: archiveRoot,
    });
    expect(record.sha256).toBe(await sha256File(file));
    expect(record.bytes).toBeGreaterThan(0);
    expect(formatRange({ start: '2025-07-01', end: '2025-07-31' })).toBe('2025-07-01..2025-07-31');
  });
});
