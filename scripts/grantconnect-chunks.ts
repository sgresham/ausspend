import 'dotenv/config';
import { mongodbUrl } from './lib/env.mjs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  GRANTCONNECT_DEFAULT_CHUNK_DAYS,
  GRANTCONNECT_ID,
  GRANTCONNECT_LIST_URL,
  buildDownloadResultUrl,
  coverageOf,
  formatCoverage,
  formatRange,
  inspectGrantConnectExport,
  planChunks,
  resolveRequestedRange,
  type DayRange,
} from '../server/src/connectors/index.js';
import {
  archiveSourceDocument,
  persistArchivedRecord,
  sourceArchiveRoot,
  type ArchivedSourceRecord,
} from '../server/src/connectors/source-archive.js';

/**
 * GrantConnect chunked manual-import helper.
 *
 * GrantConnect's public DownloadResult export caps wide searches at "more than
 * 50000 results". This helper plans small date chunks, fetches each chunk's
 * public DownloadResult URL politely (no auth), archives it with SHA-256, and
 * inspects the criteria block so a capped file is reported, not imported.
 *
 *   tsx scripts/grantconnect-chunks.ts plan   --fy=2025-26 --chunk-days=31
 *   tsx scripts/grantconnect-chunks.ts fetch  --fy=2025-26 --chunk-days=31 --out=DIR
 *   tsx scripts/grantconnect-chunks.ts audit  --fy=2025-26 --dir=DIR
 *   tsx scripts/grantconnect-chunks.ts list   --dir=DIR
 *
 * `fetch` is manual and opt-in; the ingestion connector never fetches. A human
 * may instead drop DownloadResult XLSX files into the archive directory and run
 * `INGEST_SOURCES=grantconnect npm run ingest:federal`.
 *
 * The exact query parameter names of DownloadResult may change. Override the
 * template with GRANTCONNECT_DOWNLOAD_URL_TEMPLATE (supports {start} and
 * {end}) if needed.
 */

interface Args {
  command: string;
  flags: Record<string, string | true>;
}

function parseArgs(argv: string[]): Args {
  const [command = 'help', ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (const arg of rest) {
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const body = arg.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) flags[body] = true;
    else flags[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return { command, flags };
}

function flagString(flags: Record<string, string | true>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

function flagNumber(flags: Record<string, string | true>, key: string, fallback: number): number {
  const raw = flagString(flags, key);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`--${key} must be an integer`);
  return value;
}

function defaultDirectory(): string {
  if (process.env.GRANTCONNECT_XLSX_DIR) return path.resolve(process.env.GRANTCONNECT_XLSX_DIR);
  return path.join(sourceArchiveRoot(), GRANTCONNECT_ID);
}

function rangeFrom(flags: Record<string, string | true>): DayRange {
  return resolveRequestedRange({
    ...(flagString(flags, 'start') ? { start: flagString(flags, 'start') } : {}),
    ...(flagString(flags, 'end') ? { end: flagString(flags, 'end') } : {}),
    ...(flagString(flags, 'fy') ? { fiscalYear: flagString(flags, 'fy') } : {}),
  });
}

function commandPlan(args: Args): void {
  const range = rangeFrom(args.flags);
  const chunkDays = flagNumber(args.flags, 'chunk-days', GRANTCONNECT_DEFAULT_CHUNK_DAYS);
  const chunks = planChunks(range, chunkDays);
  console.log(
    `[grantconnect] plan target=${formatRange(range)} chunkDays=${chunkDays} chunks=${chunks.length}`,
  );
  for (const chunk of chunks) {
    console.log(`[grantconnect] chunk ${chunk.index}/${chunk.total} ${formatRange(chunk)}`);
    console.log(`[grantconnect]   ${buildDownloadResultUrl(chunk)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function filenameFor(range: DayRange): string {
  return `GrantConnect-Grant-Award-List_${range.start}_${range.end}.xlsx`;
}

async function commandFetch(args: Args): Promise<void> {
  const range = rangeFrom(args.flags);
  const chunkDays = flagNumber(args.flags, 'chunk-days', GRANTCONNECT_DEFAULT_CHUNK_DAYS);
  const delayMs = flagNumber(args.flags, 'delay-ms', 1_000);
  const chunks = planChunks(range, chunkDays);
  const dryRun = args.flags['dry-run'] === true;
  const writeDb = args.flags['write-db'] === true;
  const template = flagString(args.flags, 'template');
  console.log(
    `[grantconnect] fetch target=${formatRange(range)} chunks=${chunks.length} ` +
      `delayMs=${delayMs} dryRun=${dryRun}`,
  );

  const archived: ArchivedSourceRecord[] = [];
  for (const chunk of chunks) {
    const url = buildDownloadResultUrl(chunk, template);
    if (dryRun) {
      console.log(`[grantconnect] ${chunk.index}/${chunk.total} DRY ${formatRange(chunk)} ${url}`);
      continue;
    }
    let bytes: Buffer;
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          // GrantConnect's CloudFront layer returns 403 for clients without a
          // browser-style Mozilla/5.0 token. Keep the ausspend identifier and
          // stay on the public, unauthenticated DownloadResult endpoint.
          'User-Agent':
            'Mozilla/5.0 (compatible; ausspend/0.1; manual GrantConnect export helper; public DownloadResult)',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error(
        `[grantconnect] ${chunk.index}/${chunk.total} FETCH FAILED ${formatRange(chunk)}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    const record = await archiveSourceDocument({
      source_id: GRANTCONNECT_ID,
      title: `GrantConnect grant award export — ${filenameFor(chunk)}`,
      original_url: url,
      retrieved_from: url,
      archived_from: 'direct',
      filename: filenameFor(chunk),
      content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: bytes,
      notes: `manual chunked DownloadResult fetch; requested_range=${formatRange(chunk)}`,
    });
    archived.push(record);

    try {
      const inspection = await inspectGrantConnectExport(record.local_path);
      const status = inspection.rejection_reason
        ? `REJECTED (${inspection.rejection_reason})`
        : `OK rows=${inspection.data_rows} range=${inspection.date_range ? formatRange(inspection.date_range) : 'unknown'}`;
      console.log(
        `[grantconnect] ${chunk.index}/${chunk.total} ${formatRange(chunk)} ` +
          `sha256=${record.sha256} bytes=${record.bytes} ${status}`,
      );
    } catch (error) {
      console.error(
        `[grantconnect] ${chunk.index}/${chunk.total} INSPECT FAILED: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (chunk.index < chunk.total && delayMs > 0) await sleep(delayMs);
  }

  if (writeDb && archived.length > 0) {
    const mongoose = (await import('mongoose')).default;
    const url = mongodbUrl();
    await mongoose.connect(url, { serverSelectionTimeoutMS: 8_000 });
    try {
      for (const record of archived) await persistArchivedRecord(record);
      console.log(`[grantconnect] persisted=${archived.length} collection=source_documents`);
    } finally {
      await mongoose.disconnect();
    }
  }
  console.log(`[grantconnect] archived=${archived.length} dir=${defaultDirectory()}`);
}

async function xlsxFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  return entries
    .filter((name) => /\.(xlsx|xlsm)$/i.test(name) && !name.startsWith('~$'))
    .sort()
    .map((name) => path.join(directory, name));
}

async function commandAudit(args: Args): Promise<void> {
  const directory = path.resolve(flagString(args.flags, 'dir') ?? defaultDirectory());
  const range = rangeFrom(args.flags);
  const files = await xlsxFiles(directory);
  const accepted: DayRange[] = [];
  let rejected = 0;
  console.log(
    `[grantconnect] audit dir=${directory} files=${files.length} target=${formatRange(range)}`,
  );
  for (const file of files) {
    const inspection = await inspectGrantConnectExport(file);
    const rangeText = inspection.date_range
      ? formatRange(inspection.date_range)
      : (inspection.date_range_raw ?? 'All');
    if (inspection.rejection_reason) {
      rejected += 1;
      console.log(
        `[grantconnect] REJECT ${path.basename(file)} range=${rangeText} ${inspection.rejection_reason}`,
      );
      continue;
    }
    if (inspection.date_range) accepted.push(inspection.date_range);
    console.log(
      `[grantconnect] OK ${path.basename(file)} range=${rangeText} rows=${inspection.data_rows} ` +
        `cap_warning=${inspection.cap_warning}`,
    );
  }
  const coverage = coverageOf(range, accepted);
  console.log(`[grantconnect] coverage ${formatCoverage(coverage)} rejected=${rejected}`);
}

async function commandList(args: Args): Promise<void> {
  const directory = path.resolve(flagString(args.flags, 'dir') ?? defaultDirectory());
  const files = await xlsxFiles(directory);
  console.log(`[grantconnect] dir=${directory} files=${files.length}`);
  for (const file of files) console.log(`[grantconnect] ${path.basename(file)}`);
}

function usage(): void {
  console.log(
    [
      'usage: tsx scripts/grantconnect-chunks.ts <command> [flags]',
      '',
      '  plan   [--fy=2025-26|--start=YYYY-MM-DD --end=YYYY-MM-DD] [--chunk-days=31]',
      '  fetch  [--fy|--start|--end] [--chunk-days=31] [--delay-ms=1000] [--template=URL]',
      '         [--dry-run] [--write-db]',
      '  audit  [--dir=DIR] [--fy|--start|--end]',
      '  list   [--dir=DIR]',
      '',
      `Default target FY is 2025-26. Default directory is $GRANTCONNECT_XLSX_DIR or ${path.join(homedir(), 'ausspend-source-archive', 'grantconnect')}.`,
      `Source list URL: ${GRANTCONNECT_LIST_URL}`,
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case 'plan':
      commandPlan(args);
      break;
    case 'fetch':
      await commandFetch(args);
      break;
    case 'audit':
      await commandAudit(args);
      break;
    case 'list':
      await commandList(args);
      break;
    case 'help':
    case '--help':
    case '-h':
      usage();
      break;
    default:
      usage();
      throw new Error(`unknown command ${args.command}`);
  }
}

main().catch((error: unknown) => {
  console.error(`[grantconnect] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
