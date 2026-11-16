import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildNswArchive } from '../server/src/connectors/nsw-budget-open-data.js';

/**
 * Reproducible NSW Budget 2025-26 source archive.
 *
 * Downloads the 12 official XLSX copies from the official Wayback snapshot plus
 * the ArcGIS capital-projects JSON, hashes them, and writes a committed
 * metadata manifest. The downloaded blobs themselves go to a local cache and
 * are never committed.
 *
 *   NSW_CACHE_DIR=.work-cache/nsw npm run archive:nsw
 */
async function main(): Promise<void> {
  const cacheDir = path.resolve(process.env.NSW_CACHE_DIR ?? '.work-cache/nsw');
  const manifestPath = path.resolve(
    process.env.NSW_MANIFEST ?? 'docs/source-archive/nsw-budget-2025-26.json',
  );
  await mkdir(cacheDir, { recursive: true });
  await mkdir(path.dirname(manifestPath), { recursive: true });

  const { manifest, raw, warnings } = await buildNswArchive({ cacheDir });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `[archive:nsw] files=${manifest.files.length} arcgis=${manifest.arcgis.feature_count} ` +
      `raw_rows=${raw.length} manifest=${path.relative(process.cwd(), manifestPath)}`,
  );
  for (const file of manifest.files) {
    console.log(`[archive:nsw] ${file.filename} sha256=${file.sha256} bytes=${file.bytes}`);
  }
  console.log(
    `[archive:nsw] arcgis sha256=${manifest.arcgis.sha256} bytes=${manifest.arcgis.bytes}`,
  );
  for (const warning of warnings) console.log(`[archive:nsw] warning: ${warning}`);
}

main().catch((error: unknown) => {
  console.error(`[archive:nsw] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
