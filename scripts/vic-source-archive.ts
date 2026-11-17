import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildVicArchive } from '../server/src/connectors/index.js';

/**
 * Reproducible VIC Budget 2026-27 source archive.
 *
 * Downloads the two DataVic CKAN XLSX workbooks, streams them to prove they
 * parse, hashes them and writes a committed metadata-only manifest. The
 * workbook bytes themselves go to AUSSPEND_SOURCE_ARCHIVE (or
 * ~/ausspend-source-archive) and are never committed.
 *
 *   AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo npm run archive:vic
 */
async function main(): Promise<void> {
  const manifestPath = path.resolve(
    process.env.VIC_MANIFEST ?? 'docs/source-archive/vic-budget-2026-27.json',
  );
  await mkdir(path.dirname(manifestPath), { recursive: true });

  const { manifest, raw, warnings } = await buildVicArchive();
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `[archive:vic] files=${manifest.files.length} raw_rows=${raw.length} ` +
      `manifest=${path.relative(process.cwd(), manifestPath)}`,
  );
  for (const file of manifest.files) {
    console.log(`[archive:vic] ${file.filename} sha256=${file.sha256} bytes=${file.bytes}`);
  }
  for (const warning of warnings) console.log(`[archive:vic] warning: ${warning}`);
}

main().catch((error: unknown) => {
  console.error(`[archive:vic] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
