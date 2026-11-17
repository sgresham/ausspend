import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import type { SpendingRecord } from '@ausspend/shared';
import { worksheetCellValue } from './nsw-budget-open-data.js';
import {
  GRANTCONNECT_DEFAULT_TARGET_FY,
  GRANTCONNECT_LIST_URL,
  coverageOf,
  australianFiscalYearOf,
  buildDownloadResultUrl,
  detectCapWarning,
  fiscalYearRange,
  formatCoverage,
  formatRange,
  parseDateRange,
  parseLooseDate,
  type CoverageReport,
  type DayRange,
} from './grantconnect-chunks.js';
import {
  archiveSourceDocument,
  inferContentType,
  persistArchivedRecord,
  sha256File,
  type ArchivedSourceRecord,
} from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * GrantConnect manual grant-award export connector.
 *
 * This is a MANUAL FILE import. It reads one or more public DownloadResult XLSX
 * exports that a human downloaded (the bytes stay outside the repo), archives
 * each with its SHA-256, and maps the award rows to `grant_award` measures.
 *
 * It is explicitly NOT an API client and NOT a scraper. The only network code
 * lives in `scripts/grantconnect-chunks.ts`, a helper a human runs by hand to
 * fetch the public DownloadResult URL; the connector itself never fetches.
 *
 * The DownloadResult export is capped at a "more than 50000 results" warning.
 * A file carrying that warning is REJECTED: none of its rows are imported.
 * Chunks that do not add up to full coverage of the target period leave the
 * source PARTIAL (persisted as `degraded`), never silently complete.
 */

export const GRANTCONNECT_ID = 'grantconnect';
export const GRANTCONNECT_NAME = 'GrantConnect — Australian Government grants (manual export)';
export const GRANTCONNECT_PUBLISHER = 'Australian Government Department of Finance';
export const GRANTCONNECT_SOURCE_URL = 'https://www.grants.gov.au/';
export const GRANTCONNECT_SOURCE_DATASET = 'GrantConnect — manual grant award export';
export const GRANTCONNECT_LICENSE =
  'Creative Commons Attribution 4.0 International (Commonwealth of Australia, GrantConnect)';

export const GRANTCONNECT_REQUIRED_COLUMNS = [
  'GA ID',
  'Grant Activity',
  'Agency',
  'Publish Date',
  'Value (AUD)',
  'Recipient Name',
] as const;

export const GRANTCONNECT_MANUAL_EXPORT_CAVEAT =
  'GrantConnect manual export: the archived XLSX file is a SHA-256 fingerprinted manual ' +
  'download, not an API and not a live scraper. Wide exports that exceed the 50,000-result ' +
  'cap are rejected, never partially imported. Coverage is partial until every period is ' +
  'covered by a complete chunk.';

export type GrantConnectAmountUnit = 'dollars';

export interface GrantConnectCriterion {
  label: string;
  value: string;
}

export interface GrantConnectFileRecord {
  filename: string;
  local_path: string;
  sha256: string;
  bytes: number;
  content_type: string;
  original_url: string;
  retrieved_from: string;
  fetched_at: string;
  header_row: number;
  headers: string[];
  criteria: GrantConnectCriterion[];
  date_range_raw: string | null;
  date_range: DayRange | null;
  cap_warning: boolean;
  cap_warning_text: string | null;
  data_rows: number;
  accepted: boolean;
  rejection_reason: string | null;
  archive_document_id: string | null;
}

export interface GrantConnectRawRecord extends RawRecord {
  file: GrantConnectFileRecord;
  cells: Record<string, string | number | null>;
}

export interface GrantConnectMappingSkip {
  skip: string;
}

export interface GrantConnectConnectorOptions {
  /** Explicit chunk files; overrides directory scanning. */
  filePaths?: string[];
  /** Directory of manual DownloadResult exports. */
  directory?: string;
  targetFiscalYear?: string;
  /** Adopt files into the source archive (metadata only; bytes untouched). */
  registerArchive?: boolean;
  /** Persist archive metadata to MongoDB when a connection is open. */
  persistArchive?: boolean;
  /** Archive root override (tests); defaults to AUSSPEND_SOURCE_ARCHIVE. */
  archiveRoot?: string;
}

interface GrantConnectConnectorState {
  files: GrantConnectFileRecord[];
  coverage: CoverageReport | null;
  warnings: string[];
}

export class AmbiguousGrantConnectExportError extends Error {}

function text(value: unknown): string {
  const cell = worksheetCellValue(value);
  if (cell === null) return '';
  return String(cell).trim();
}

function normalizeHeader(value: unknown): string {
  return text(value).replace(/\s+/g, ' ');
}

function isHeaderRow(values: ReadonlyArray<unknown>): boolean {
  const cells = values.map(normalizeHeader);
  return (
    cells[0] === 'GA ID' &&
    cells.some((cell) => cell === 'Grant Activity' || cell === 'Value (AUD)')
  );
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): Array<string | number | null> {
  const values: Array<string | number | null> = [];
  const width = Math.max(sheet.columnCount, 1);
  for (let column = 1; column <= width; column += 1) {
    values.push(worksheetCellValue(sheet.getRow(rowNumber).getCell(column).value));
  }
  return values;
}

function criteriaFromRows(rows: ReadonlyArray<ReadonlyArray<unknown>>): GrantConnectCriterion[] {
  const criteria: GrantConnectCriterion[] = [];
  for (const row of rows) {
    const label = normalizeHeader(row[0]);
    if (!label) continue;
    const value = normalizeHeader(row[1]);
    criteria.push({ label, value });
  }
  return criteria;
}

function criteriaValue(
  criteria: ReadonlyArray<GrantConnectCriterion>,
  label: string,
): string | null {
  const found = criteria.find((entry) => entry.label.toLowerCase() === label.toLowerCase());
  return found && found.value ? found.value : null;
}

/**
 * The amount column is only accepted when its header states AUD/dollars. An
 * unmarked value column is an ambiguity, not an invitation to guess.
 */
export function detectGrantConnectAmountUnit(
  headers: ReadonlyArray<string>,
): GrantConnectAmountUnit {
  const amountHeader = headers.find((header) => /^value\b/i.test(header.trim()));
  if (!amountHeader) {
    throw new AmbiguousGrantConnectExportError(
      'no Value column found (expected a header beginning "Value")',
    );
  }
  if (/\(aud\)|\baud\b|\$/i.test(amountHeader)) return 'dollars';
  throw new AmbiguousGrantConnectExportError(
    `amount unit is ambiguous: column ${JSON.stringify(amountHeader)} does not state AUD/dollars`,
  );
}

export function grantConnectDollarsToCents(raw: unknown): number | null {
  const value = worksheetCellValue(raw);
  if (value === null || value === '') return null;
  const cleaned = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(cleaned) || cleaned < 0) return null;
  const cents = Math.round(cleaned * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

/** Publish/Start/End cells are ISO strings that may carry literal double quotes. */
export function parseGrantConnectDate(raw: unknown): string | null {
  const value = worksheetCellValue(raw);
  if (value === null || value === '') return null;
  if (typeof value === 'number') return null;
  const trimmed = value.trim().replace(/^"+|"+$/g, '');
  const iso = /^(\d{4}-\d{2}-\d{2})T/.exec(trimmed);
  if (iso) return iso[1] ?? null;
  return parseLooseDate(trimmed);
}

function grantAwardUrl(gaId: string, cells: Record<string, string | number | null>): string {
  const explicit = ['Award Page', 'Award URL', 'Grant URL', 'URL']
    .map((column) => text(cells[column]))
    .find((value) => /^https?:\/\//i.test(value));
  if (explicit) return explicit;
  // No award page column is supplied by the manual export: cite the list query
  // and the source row id rather than inventing a detail URL.
  return `${GRANTCONNECT_LIST_URL}&GAID=${encodeURIComponent(gaId)}`;
}

export function grantConnectRowHash(cells: Record<string, string | number | null>): string {
  const stable = [
    'Agency',
    'Recipient Name',
    'Grant Activity',
    'Publish Date',
    'Value (AUD)',
    'Start Date',
    'End Date',
    'GO ID',
  ]
    .map((column) => text(cells[column]))
    .join('\u0001');
  return createHash('sha256').update(stable, 'utf8').digest('hex').slice(0, 24);
}

function recordSkips(cells: Record<string, string | number | null>): string {
  return [
    text(cells['GA ID']),
    text(cells['Recipient Name']),
    text(cells['Publish Date']),
    text(cells['Value (AUD)']),
  ].join(' | ');
}

/**
 * Map one export row. Returns `{ skip }` for a row with an unusable amount or
 * an unparseable publish date; the caller logs the reason and keeps going.
 */
export function mapGrantConnectRow(
  cells: Record<string, string | number | null>,
  file: GrantConnectFileRecord,
): SpendingRecord | GrantConnectMappingSkip {
  const gaId = text(cells['GA ID']);
  const activity = text(cells['Grant Activity']);
  const recipient = text(cells['Recipient Name']);
  const agency = text(cells['Agency']);
  if (!activity) return { skip: `missing Grant Activity (${recordSkips(cells)})` };
  if (!recipient) return { skip: `missing Recipient Name (${recordSkips(cells)})` };
  if (!agency) return { skip: `missing Agency (${recordSkips(cells)})` };

  detectGrantConnectAmountUnit(Object.keys(cells));

  const amountCents = grantConnectDollarsToCents(cells['Value (AUD)']);
  if (amountCents === null) {
    return {
      skip: `invalid Value (AUD) ${JSON.stringify(text(cells['Value (AUD)']))} (${recordSkips(cells)})`,
    };
  }

  const publishDate = parseGrantConnectDate(cells['Publish Date']);
  if (!publishDate) {
    return { skip: `invalid/missing Publish Date ${JSON.stringify(text(cells['Publish Date']))}` };
  }
  const fiscalYear = australianFiscalYearOf(publishDate);

  const naturalKey = gaId
    ? `grantconnect:${gaId}`
    : `grantconnect:row:${grantConnectRowHash(cells)}`;
  const startDate = parseGrantConnectDate(cells['Start Date']);
  const endDate = parseGrantConnectDate(cells['End Date']);
  const goId = text(cells['GO ID']);
  const category = text(cells['Category']);
  const aggregate = text(cells['Aggregate Grant Award']);
  const aggregatedCount = text(cells['Number of Awards Aggregated']);

  const noteParts = [
    `GrantConnect manual export file=${file.filename} sha256=${file.sha256}`,
    `export_date_range=${file.date_range ? formatRange(file.date_range) : (file.date_range_raw ?? 'unknown')}`,
    `grant_id=${gaId || '(none)'}`,
    goId ? `go_id=${goId}` : '',
    category ? `category=${category}` : '',
    startDate ? `activity_start=${startDate}` : '',
    endDate ? `activity_end=${endDate}` : '',
    aggregate ? `aggregate_award=${aggregate}` : '',
    aggregatedCount ? `awards_aggregated=${aggregatedCount}` : '',
    'no location supplied in export',
  ].filter(Boolean);

  return {
    natural_key: naturalKey,
    amount_cents: amountCents,
    measure_type: 'grant_award',
    fiscal_year: fiscalYear,
    source_id: GRANTCONNECT_ID,
    source_url: grantAwardUrl(gaId, cells),
    verified: false,
    project_name: activity,
    description: activity,
    jurisdiction_level: 'federal',
    jurisdiction: 'Commonwealth',
    delivery_entity: recipient,
    funding_source: agency,
    source_dataset: GRANTCONNECT_SOURCE_DATASET,
    source_date: publishDate,
    data_quality_flag: 'provisional',
    notes: noteParts.join('; '),
  };
}

async function readWorkbookRows(filePath: string): Promise<{
  headerRow: number;
  headers: string[];
  criteria: GrantConnectCriterion[];
  capWarning: boolean;
  capWarningText: string | null;
  dateRangeRaw: string | null;
  dataRows: Array<Record<string, string | number | null>>;
  dataRowCount: number;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`workbook has no worksheet: ${filePath}`);

  const scanLimit = Math.min(sheet.rowCount, 80);
  let headerRow = 0;
  for (let rowNumber = 1; rowNumber <= scanLimit; rowNumber += 1) {
    if (isHeaderRow(rowValues(sheet, rowNumber))) {
      headerRow = rowNumber;
      break;
    }
  }
  if (!headerRow) {
    throw new Error('could not locate the GrantConnect header row (GA ID / Grant Activity)');
  }

  const criteriaRows: Array<Array<string | number | null>> = [];
  for (let rowNumber = 1; rowNumber < headerRow; rowNumber += 1) {
    criteriaRows.push(rowValues(sheet, rowNumber));
  }
  const cap = detectCapWarning(criteriaRows);
  const criteria = criteriaFromRows(criteriaRows);
  const dateRangeRaw = criteriaValue(criteria, 'Date Range');

  const headers = rowValues(sheet, headerRow).map(normalizeHeader);
  while (headers.length > 0 && headers[headers.length - 1] === '') headers.pop();

  const dataRows: Array<Record<string, string | number | null>> = [];
  if (!cap.cap_warning) {
    for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const values = rowValues(sheet, rowNumber);
      const row: Record<string, string | number | null> = {};
      let nonEmpty = false;
      for (let index = 0; index < headers.length; index += 1) {
        const header = headers[index];
        if (!header) continue;
        const value = values[index] ?? null;
        row[header] = value;
        if (value !== null && value !== '') nonEmpty = true;
      }
      if (nonEmpty) dataRows.push(row);
    }
  }

  return {
    headerRow,
    headers,
    criteria,
    capWarning: cap.cap_warning,
    capWarningText: cap.text,
    dateRangeRaw,
    dataRows,
    // A rejected/capped file is never mapped; report the sheet's data-row count
    // cheaply (without the expensive per-cell walk) so provenance is accurate.
    dataRowCount: cap.cap_warning ? Math.max(0, sheet.rowCount - headerRow) : dataRows.length,
  };
}

export interface GrantConnectInspection {
  header_row: number;
  headers: string[];
  criteria: GrantConnectCriterion[];
  cap_warning: boolean;
  cap_warning_text: string | null;
  date_range_raw: string | null;
  date_range: DayRange | null;
  data_rows: number;
  rejection_reason: string | null;
}

/** Inspect one manual export without importing it (used by the CLI helper). */
export async function inspectGrantConnectExport(filePath: string): Promise<GrantConnectInspection> {
  const parsed = await readWorkbookRows(filePath);
  const dateRange = parseDateRange(parsed.dateRangeRaw);
  return {
    header_row: parsed.headerRow,
    headers: parsed.headers,
    criteria: parsed.criteria,
    cap_warning: parsed.capWarning,
    cap_warning_text: parsed.capWarningText,
    date_range_raw: parsed.dateRangeRaw,
    date_range: dateRange,
    data_rows: parsed.dataRowCount,
    rejection_reason: rejectionReason(parsed, parsed.headers),
  };
}

function archiveMetadataUrl(dateRange: DayRange | null): { original: string; retrieved: string } {
  if (!dateRange) return { original: GRANTCONNECT_LIST_URL, retrieved: GRANTCONNECT_LIST_URL };
  const url = buildDownloadResultUrl(dateRange);
  return { original: url, retrieved: url };
}

function defaultDirectory(): string {
  if (process.env.GRANTCONNECT_XLSX_DIR) return path.resolve(process.env.GRANTCONNECT_XLSX_DIR);
  if (process.env.GRANTCONNECT_XLSX)
    return path.dirname(path.resolve(process.env.GRANTCONNECT_XLSX));
  return path.join(homedir(), 'ausspend-source-archive', 'grantconnect');
}

async function resolveFilePaths(options: GrantConnectConnectorOptions): Promise<string[]> {
  if (options.filePaths && options.filePaths.length > 0) {
    return options.filePaths.map((file) => path.resolve(file));
  }
  if (process.env.GRANTCONNECT_XLSX && !process.env.GRANTCONNECT_XLSX_DIR) {
    return [path.resolve(process.env.GRANTCONNECT_XLSX)];
  }
  const directory = path.resolve(options.directory ?? defaultDirectory());
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    throw new Error(
      `GrantConnect manual export directory is not readable: ${directory} ` +
        `(${error instanceof Error ? error.message : String(error)}). Set GRANTCONNECT_XLSX_DIR.`,
    );
  }
  const files = entries
    .filter((name) => /\.(xlsx|xlsm)$/i.test(name) && !name.startsWith('~$'))
    .sort()
    .map((name) => path.join(directory, name));
  if (files.length === 0) {
    throw new Error(`no GrantConnect .xlsx manual exports found in ${directory}`);
  }
  return files;
}

function rejectionReason(
  parsed: Awaited<ReturnType<typeof readWorkbookRows>>,
  headers: ReadonlyArray<string>,
): string | null {
  if (parsed.capWarning) {
    return (
      'rejected incomplete export: ' +
      (parsed.capWarningText ?? 'result set exceeds the 50,000 cap') +
      ' — no rows imported'
    );
  }
  if (!parsed.dateRangeRaw) return 'rejected: criteria summary has no Date Range line';
  const range = parseDateRange(parsed.dateRangeRaw);
  if (!range) {
    return `rejected: Date Range ${JSON.stringify(parsed.dateRangeRaw)} is not a bounded period (All/other)`;
  }
  const missing = GRANTCONNECT_REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) return `rejected: missing required column(s) ${missing.join(', ')}`;
  try {
    detectGrantConnectAmountUnit(headers);
  } catch (error) {
    return `rejected: ${error instanceof Error ? error.message : String(error)}`;
  }
  return null;
}

function baseNotes(state: GrantConnectConnectorState, target: DayRange): string {
  const coverage = state.coverage;
  const rejected = state.files.filter((file) => !file.accepted);
  const accepted = state.files.filter((file) => file.accepted);
  const parts = [
    'GrantConnect manual export (file archived SHA-256; not an API, no live scraper).',
    coverage
      ? `Coverage ${formatCoverage(coverage)}.`
      : `Coverage unknown for ${formatRange(target)}.`,
    `Files: ${state.files.length} scanned, ${accepted.length} accepted, ${rejected.length} rejected/superseded.`,
    `Accepted rows: ${accepted.reduce((sum, file) => sum + file.data_rows, 0)}.`,
  ];
  if (rejected.length > 0) {
    parts.push(
      'Rejected/superseded: ' +
        rejected
          .map((file) => `${file.filename} (${file.rejection_reason ?? 'rejected'})`)
          .join('; ') +
        '.',
    );
  }
  parts.push(
    'Wide exports above the 50,000-result cap are rejected, never partially imported; ' +
      'the source is partial until every period is covered by a complete chunk.',
  );
  return parts.join(' ');
}

export function createGrantConnectConnector(options: GrantConnectConnectorOptions = {}): Connector {
  const target = fiscalYearRange(
    options.targetFiscalYear ?? process.env.GRANTCONNECT_FY ?? GRANTCONNECT_DEFAULT_TARGET_FY,
  );
  const state: GrantConnectConnectorState = { files: [], coverage: null, warnings: [] };
  const registerArchive = options.registerArchive !== false;
  const persistArchive = options.persistArchive !== false;

  const connector: Connector = {
    id: GRANTCONNECT_ID,
    name: GRANTCONNECT_NAME,
    publisher: GRANTCONNECT_PUBLISHER,
    source_url: GRANTCONNECT_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'federal',
    license: GRANTCONNECT_LICENSE,
    notes: GRANTCONNECT_MANUAL_EXPORT_CAVEAT,
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [] },

    async fetch(): Promise<RawRecord[]> {
      state.files = [];
      state.warnings = [];
      const files = await resolveFilePaths(options);
      const raw: RawRecord[] = [];

      for (const filePath of files) {
        const filename = path.basename(filePath);
        const info = await stat(filePath);
        if (!info.isFile()) continue;
        const sha256 = await sha256File(filePath);

        let parsed: Awaited<ReturnType<typeof readWorkbookRows>>;
        try {
          parsed = await readWorkbookRows(filePath);
        } catch (error) {
          const reason = `unreadable/corrupt export: ${error instanceof Error ? error.message : String(error)}`;
          state.files.push({
            filename,
            local_path: filePath,
            sha256,
            bytes: info.size,
            content_type: inferContentType(filename),
            original_url: GRANTCONNECT_LIST_URL,
            retrieved_from: GRANTCONNECT_LIST_URL,
            fetched_at: info.mtime.toISOString(),
            header_row: 0,
            headers: [],
            criteria: [],
            date_range_raw: null,
            date_range: null,
            cap_warning: false,
            cap_warning_text: null,
            data_rows: 0,
            accepted: false,
            rejection_reason: reason,
            archive_document_id: null,
          });
          state.warnings.push(`${filename}: ${reason}`);
          continue;
        }

        const dateRange = parseDateRange(parsed.dateRangeRaw);
        const reason = rejectionReason(parsed, parsed.headers);
        const accepted = reason === null;
        const urls = archiveMetadataUrl(dateRange);
        const record: GrantConnectFileRecord = {
          filename,
          local_path: filePath,
          sha256,
          bytes: info.size,
          content_type: inferContentType(filename),
          original_url: urls.original,
          retrieved_from: urls.retrieved,
          fetched_at: info.mtime.toISOString(),
          header_row: parsed.headerRow,
          headers: parsed.headers,
          criteria: parsed.criteria,
          date_range_raw: parsed.dateRangeRaw,
          date_range: dateRange,
          cap_warning: parsed.capWarning,
          cap_warning_text: parsed.capWarningText,
          data_rows: parsed.dataRowCount,
          accepted,
          rejection_reason: reason,
          archive_document_id: null,
        };

        if (registerArchive) {
          try {
            const archived: ArchivedSourceRecord = await archiveSourceDocument({
              source_id: GRANTCONNECT_ID,
              title:
                `GrantConnect grant award export — ${filename} ` +
                `(${dateRange ? formatRange(dateRange) : (parsed.dateRangeRaw ?? 'All')})`,
              original_url: record.original_url,
              retrieved_from: record.retrieved_from,
              archived_from: 'direct',
              filename,
              content_type: record.content_type,
              from_path: filePath,
              fetched_at: new Date(record.fetched_at),
              ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
              notes:
                `manual export; sha256=${sha256}; bytes=${info.size}; ` +
                `date_range=${dateRange ? formatRange(dateRange) : (parsed.dateRangeRaw ?? 'All')}; ` +
                `header_row=${parsed.headerRow}; data_rows=${parsed.dataRowCount}; ` +
                `cap_warning=${parsed.capWarning}; ` +
                `accepted=${accepted}; rejection=${reason ?? 'none'}`,
            });
            record.archive_document_id = archived.document_id;
            if (persistArchive && mongoose.connection.readyState === 1) {
              await persistArchivedRecord(archived);
            }
          } catch (error) {
            state.warnings.push(
              `${filename}: archive registration failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        state.files.push(record);

        if (!accepted) {
          state.warnings.push(`${filename}: ${reason}`);
          continue;
        }

        for (const cells of parsed.dataRows) {
          raw.push({ file: record, cells } satisfies GrantConnectRawRecord);
        }
      }

      const acceptedRanges = state.files
        .filter((file) => file.accepted && file.date_range)
        .map((file) => file.date_range as DayRange);
      const coverage = coverageOf(target, acceptedRanges);
      state.coverage = coverage;

      const errors: string[] = [];
      if (!coverage.complete) {
        const rejected = state.files.filter((file) => !file.accepted);
        errors.push(
          `partial GrantConnect coverage: ${formatCoverage(coverage)}; ` +
            `${rejected.length} file(s) rejected/superseded` +
            (rejected.length > 0
              ? ` (${rejected.map((file) => `${file.filename}: ${file.rejection_reason}`).join('; ')})`
              : ''),
        );
      }

      connector.notes = baseNotes(state, target);
      this.metadata.errors = errors;
      this.metadata.warnings = [...state.warnings];

      // Accepted files with no usable publish date still contribute no rows;
      // that is a warning, not an error, provided coverage is complete.
      return raw;
    },

    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      const seen = new Set<string>();
      let duplicates = 0;
      for (const entry of raw) {
        const rawRecord = entry as GrantConnectRawRecord;
        if (!rawRecord.file || !rawRecord.cells) continue;
        const mapped = mapGrantConnectRow(rawRecord.cells, rawRecord.file);
        if ('skip' in mapped) {
          state.warnings.push(`${rawRecord.file.filename}: ${mapped.skip}`);
          continue;
        }
        if (seen.has(mapped.natural_key)) {
          duplicates += 1;
          continue;
        }
        seen.add(mapped.natural_key);
        records.push(mapped);
      }
      if (duplicates > 0) {
        state.warnings.push(`deduped ${duplicates} duplicate grant row(s) by natural_key`);
      }
      this.metadata.warnings = [...state.warnings];
      return records;
    },
  } satisfies Connector;

  return connector;
}
