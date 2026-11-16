import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractPdf, type PdfExtraction } from '../server/src/connectors/pdf-extract.js';
import { listArchivedRecords } from '../server/src/connectors/source-archive.js';

/**
 * PDF extraction CLI (foundation for S3 Dubbo and BP3 publications).
 *
 *   tsx scripts/pdf-extract.ts --file /path/to/report.pdf [--json]
 *   tsx scripts/pdf-extract.ts --url https://example.gov.au/report.pdf [--json]
 *   tsx scripts/pdf-extract.ts --document-id nsw-budget:... [--root=DIR] [--json]
 *
 * It prints the detected unit, total reconciliation and per-table ingestability.
 * Every row is `provisional`; nothing is marked verified here.
 */

interface Args {
  flags: Record<string, string | true>;
}

function parseArgs(argv: string[]): Args {
  const flags: Record<string, string | true> = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const body = arg.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) flags[body] = true;
    else flags[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return { flags };
}

function flagString(flags: Record<string, string | true>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

function printSummary(extraction: PdfExtraction): void {
  console.log(
    `[pdf] sha256=${extraction.source.sha256} bytes=${extraction.source.bytes} ` +
      `pages=${extraction.pages.length} tables=${extraction.tables.length}`,
  );
  if (extraction.source.url) console.log(`[pdf] url=${extraction.source.url}`);
  if (extraction.source.local_path) console.log(`[pdf] local_path=${extraction.source.local_path}`);
  for (const table of extraction.tables) {
    console.log(
      `[pdf] page=${table.page_number} table=${table.table_index} unit=${table.unit.kind ?? '?'} ` +
        `ambiguous=${table.unit.ambiguous} confidence=${table.extraction_confidence} ` +
        `valid=${table.valid} ingestable=${table.ingestable} rows=${table.rows.length} ` +
        `checks=${table.checks.length} totals_verified=${table.totals_verified}`,
    );
    for (const warning of table.warnings) console.log(`[pdf]   warning: ${warning}`);
  }
  for (const warning of extraction.warnings) console.log(`[pdf] warning: ${warning}`);
}

async function main(): Promise<void> {
  const { flags } = parseArgs(process.argv.slice(2));
  const file = flagString(flags, 'file');
  const url = flagString(flags, 'url');
  const documentId = flagString(flags, 'document-id');

  let bytes: Buffer;
  let sourceUrl: string | undefined;
  let localPath: string | undefined;
  if (file) {
    localPath = path.resolve(file);
    bytes = await readFile(localPath);
  } else if (url) {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`PDF fetch HTTP ${response.status} for ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    sourceUrl = url;
  } else if (documentId) {
    const records = await listArchivedRecords({ root: flagString(flags, 'root') });
    const record = records.find((entry) => entry.document_id === documentId);
    if (!record) throw new Error(`archived document not found: ${documentId}`);
    localPath = record.local_path;
    sourceUrl = record.original_url;
    bytes = await readFile(localPath);
  } else {
    throw new Error('one of --file, --url or --document-id is required');
  }

  const extraction = await extractPdf(bytes, { source_url: sourceUrl, local_path: localPath });
  if (flags.json) console.log(JSON.stringify(extraction, null, 2));
  else printSummary(extraction);

  const unsafe = extraction.tables.filter((table) => !table.ingestable);
  if (extraction.tables.length > 0 && unsafe.length > 0) process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(`[pdf] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
