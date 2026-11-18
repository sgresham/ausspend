import 'dotenv/config';
import { mongodbUrl } from './lib/env.mjs';
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  archiveSourceDocument,
  listArchivedRecords,
  persistArchivedRecord,
  repoRoot,
  sourceArchiveRoot,
  verifySourceDocument,
  type ArchivedSourceRecord,
  type SourceArchivedFrom,
} from '../server/src/connectors/source-archive.js';

/**
 * Source archive CLI.
 *
 *   tsx scripts/source-archive.ts list [--source-id=nsw-budget] [--root=DIR]
 *   tsx scripts/source-archive.ts verify [--source-id=nsw-budget] [--root=DIR]
 *   tsx scripts/source-archive.ts adopt-nsw [--from-dir=DIR] [--write-db]
 *   tsx scripts/source-archive.ts fetch --source-id=X --title=Y --url=URL \
 *       --archived-from=direct|wayback|arcgis|other --filename=F [--retrieved-from=URL] \
 *       [--notes=TEXT] [--root=DIR]
 *
 * Bytes are always written/kept outside the application repo. `adopt-nsw`
 * references S1's already-downloaded copies without copying or mutating them.
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

function required(flags: Record<string, string | true>, key: string): string {
  const value = flagString(flags, key);
  if (!value) throw new Error(`--${key} is required`);
  return value;
}

function printRecord(record: ArchivedSourceRecord, prefix = '[archive]'): void {
  console.log(
    `${prefix} ${record.source_id} ${record.document_id} sha256=${record.sha256} ` +
      `bytes=${record.bytes} from=${record.archived_from} path=${record.local_path}`,
  );
}

async function commandList(args: Args): Promise<void> {
  const root = flagString(args.flags, 'root');
  const sourceId = flagString(args.flags, 'source-id');
  const records = await listArchivedRecords({ root, source_id: sourceId });
  console.log(`[archive] root=${sourceArchiveRoot(root)} records=${records.length}`);
  for (const record of records) printRecord(record);
}

async function commandVerify(args: Args): Promise<void> {
  const root = flagString(args.flags, 'root');
  const sourceId = flagString(args.flags, 'source-id');
  const records = await listArchivedRecords({ root, source_id: sourceId });
  let failures = 0;
  for (const record of records) {
    const result = await verifySourceDocument(record);
    if (result.ok) {
      console.log(`[archive:verify] OK ${record.document_id} sha256=${result.sha256}`);
    } else {
      failures += 1;
      console.error(`[archive:verify] FAIL ${record.document_id}: ${result.problems.join('; ')}`);
    }
  }
  console.log(`[archive:verify] checked=${records.length} failures=${failures}`);
  if (failures > 0) process.exitCode = 1;
}

interface NswManifest {
  page_url: string;
  page_snapshot_url: string;
  page_sha256: string;
  page_bytes: number;
  files: Array<{
    filename: string;
    source_url: string;
    snapshot_url: string;
    sha256: string;
    bytes: number;
  }>;
  arcgis: {
    layer: string;
    query_url: string;
    feature_count: number;
    sha256: string;
    bytes: number;
  };
}

function assertMatch(
  label: string,
  record: ArchivedSourceRecord,
  expected: { sha256: string; bytes: number },
): void {
  if (record.sha256 !== expected.sha256 || record.bytes !== expected.bytes) {
    throw new Error(
      `${label} does not match the S1 manifest: ` +
        `expected sha256=${expected.sha256} bytes=${expected.bytes}, ` +
        `got sha256=${record.sha256} bytes=${record.bytes}`,
    );
  }
}

async function connectForWrite(): Promise<{ close: () => Promise<void> }> {
  const mongoose = (await import('mongoose')).default;
  const url = mongodbUrl();
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (dbName !== 'ausspend_dev') {
    throw new Error(
      `refusing to write source archive metadata to database ${JSON.stringify(dbName)}`,
    );
  }
  await mongoose.connect(url, { serverSelectionTimeoutMS: 8_000 });
  return { close: async () => mongoose.disconnect() };
}

async function commandAdoptNsw(args: Args): Promise<void> {
  const fromDir = path.resolve(
    flagString(args.flags, 'from-dir') ??
      path.join(homedir(), '.cache', 'ausspend', 'nsw-budget', '2025-26'),
  );
  const manifestPath = path.resolve(repoRoot(), 'docs/source-archive/nsw-budget-2025-26.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as NswManifest;
  const root = sourceArchiveRoot(flagString(args.flags, 'root'));

  const adopted: ArchivedSourceRecord[] = [];
  const adopt = async (
    filename: string,
    meta: Omit<Parameters<typeof archiveSourceDocument>[0], 'from_path' | 'filename' | 'root'>,
    expected: { sha256: string; bytes: number },
  ): Promise<void> => {
    const local = path.join(fromDir, filename);
    const info = await stat(local).catch(() => null);
    if (!info?.isFile()) {
      throw new Error(`S1 archive copy missing: ${local}`);
    }
    const record = await archiveSourceDocument({
      ...meta,
      filename,
      from_path: local,
      root,
      notes:
        `${meta.notes ?? ''} S1 cache copy (adopted by reference, not duplicated or mutated); ` +
        `manifest docs/source-archive/nsw-budget-2025-26.json`.trim(),
    });
    assertMatch(filename, record, expected);
    const check = await verifySourceDocument(record);
    if (!check.ok)
      throw new Error(`${filename} failed re-verification: ${check.problems.join('; ')}`);
    adopted.push({ ...record, hash_verified: true });
    printRecord(record);
  };

  await adopt(
    'open-data-2025-26.html',
    {
      source_id: 'nsw-budget',
      title: 'NSW Budget 2025-26 open-data page (Wayback snapshot)',
      original_url: manifest.page_url,
      retrieved_from: manifest.page_snapshot_url,
      archived_from: 'wayback',
      content_type: 'text/html',
    },
    { sha256: manifest.page_sha256, bytes: manifest.page_bytes },
  );

  for (const file of manifest.files) {
    await adopt(
      file.filename,
      {
        source_id: 'nsw-budget',
        title: `NSW Budget 2025-26 workbook: ${file.filename}`,
        original_url: file.source_url,
        retrieved_from: file.snapshot_url,
        archived_from: 'wayback',
        content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      { sha256: file.sha256, bytes: file.bytes },
    );
  }

  await adopt(
    'arcgis-capital-projects.json',
    {
      source_id: 'nsw-budget',
      title: `NSW Treasury capital projects ArcGIS layer: ${manifest.arcgis.layer}`,
      original_url: manifest.arcgis.query_url,
      retrieved_from: manifest.arcgis.query_url,
      archived_from: 'arcgis',
      content_type: 'application/json',
      notes: `feature_count=${manifest.arcgis.feature_count} arcgis_layer=${manifest.arcgis.layer}`,
    },
    { sha256: manifest.arcgis.sha256, bytes: manifest.arcgis.bytes },
  );

  console.log(
    `[archive:adopt-nsw] adopted=${adopted.length} root=${root} from=${fromDir} ` +
      `manifest=${path.relative(process.cwd(), manifestPath)}`,
  );

  if (args.flags['write-db']) {
    const db = await connectForWrite();
    try {
      for (const record of adopted) await persistArchivedRecord(record);
      console.log(`[archive:adopt-nsw] persisted=${adopted.length} collection=source_documents`);
    } finally {
      await db.close();
    }
  } else {
    console.log(
      '[archive:adopt-nsw] metadata records written; pass --write-db to upsert source_documents',
    );
  }
}

const ARCHIVED_FROM: ReadonlyArray<SourceArchivedFrom> = ['wayback', 'arcgis', 'direct', 'other'];

async function commandFetch(args: Args): Promise<void> {
  const archivedFrom = required(args.flags, 'archived-from');
  if (!ARCHIVED_FROM.includes(archivedFrom as SourceArchivedFrom)) {
    throw new Error(`--archived-from must be one of ${ARCHIVED_FROM.join(', ')}`);
  }
  const record = await archiveSourceDocument({
    source_id: required(args.flags, 'source-id'),
    title: required(args.flags, 'title'),
    original_url: required(args.flags, 'url'),
    retrieved_from: flagString(args.flags, 'retrieved-from'),
    archived_from: archivedFrom as SourceArchivedFrom,
    filename: required(args.flags, 'filename'),
    content_type: flagString(args.flags, 'content-type'),
    notes: flagString(args.flags, 'notes'),
    root: flagString(args.flags, 'root'),
  });
  printRecord(record);
  if (args.flags['write-db']) {
    const db = await connectForWrite();
    try {
      await persistArchivedRecord(record);
      console.log(`[archive:fetch] persisted document_id=${record.document_id}`);
    } finally {
      await db.close();
    }
  }
}

function usage(): void {
  console.log(
    [
      'usage: tsx scripts/source-archive.ts <command> [flags]',
      '',
      '  list        [--source-id=ID] [--root=DIR]',
      '  verify      [--source-id=ID] [--root=DIR]',
      '  adopt-nsw   [--from-dir=DIR] [--root=DIR] [--write-db]',
      '  fetch       --source-id=ID --title=TEXT --url=URL --archived-from=wayback|arcgis|direct|other',
      '              --filename=NAME [--retrieved-from=URL] [--content-type=TYPE] [--notes=TEXT]',
      '              [--root=DIR] [--write-db]',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case 'list':
      await commandList(args);
      break;
    case 'verify':
      await commandVerify(args);
      break;
    case 'adopt-nsw':
      await commandAdoptNsw(args);
      break;
    case 'fetch':
      await commandFetch(args);
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
  console.error(`[archive] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
