import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  VGC1_ID,
  createVgc1Connector,
  loadVgc1Source,
  runIngestion,
  vgc1ManifestFromLoaded,
} from '../server/src/connectors/index.js';
import { persistArchivedRecord } from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * VIC council pilot A — VLGGC VGC1 2024-25 ingestion (all 79 councils).
 *
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev \
 *   AUSSPEND_SOURCE_ARCHIVE=${AUSSPEND_SOURCE_ARCHIVE} \
 *   VGC1_SOURCE_PATH=/path/to/2024-25-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx \
 *   npm run ingest:vic-vlgc
 *
 * The VGC1 workbook is discovered from the official VLGGC page via its Wayback
 * snapshot (the live page/asset return a Cloudflare 403), SHA-256 verified
 * against the documented hash, archived outside the repo, and parsed into
 * non-additive council rows. The source Totals row is suppressed and no
 * cross-council total is emitted. Re-running upserts on natural_key, so it is
 * idempotent and never deletes another source's rows.
 */
export const VGC1_SOURCE_IDS = [VGC1_ID] as const;

async function writeManifest(loaded: Awaited<ReturnType<typeof loadVgc1Source>>): Promise<void> {
  const manifestPath = path.resolve(
    process.env.VGC1_MANIFEST ?? 'docs/source-archive/vic-vlgc-vgc1-2024-25.json',
  );
  const manifest = vgc1ManifestFromLoaded(loaded);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:vic-vlgc] manifest=${path.relative(process.cwd(), manifestPath)} ` +
      `sha256=${manifest.sha256} councils=${manifest.council_count} rows=${manifest.rows}`,
  );
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);

  console.log(`[ingest:vic-vlgc] target=${databaseName} source=${VGC1_ID}`);
  console.log(
    '[ingest:vic-vlgc] VLGGC attribution/permission, NOT CC BY; derived rows only; workbook not redistributed',
  );

  const loaded = await loadVgc1Source({
    ...(process.env.VGC1_SOURCE_PATH ? { sourcePath: process.env.VGC1_SOURCE_PATH } : {}),
    ...(process.env.VGC1_ARCHIVE_ROOT ? { archiveRoot: process.env.VGC1_ARCHIVE_ROOT } : {}),
  });

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    const base = createVgc1Connector();
    const connector = {
      ...base,
      async fetch() {
        base.metadata.warnings = loaded.warnings;
        return loaded.raw;
      },
    };
    const result = await runIngestion({ connectors: [connector] });
    for (const entry of result.results) {
      console.log(
        `[ingest:vic-vlgc] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
    }

    await persistArchivedRecord(loaded.archive);
    await writeManifest(loaded);

    const total = await MeasureModel.countDocuments({ source_id: VGC1_ID });
    const councils = await MeasureModel.distinct('delivery_entity', { source_id: VGC1_ID });
    const totalsEntity = await MeasureModel.countDocuments({
      source_id: VGC1_ID,
      delivery_entity: { $regex: /^totals?$/i },
    });
    const allMeasures = await MeasureModel.countDocuments({});
    const byMeasure = await MeasureModel.aggregate([
      { $match: { source_id: VGC1_ID } },
      { $group: { _id: '$vlgc_measure', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log(
      `[ingest:vic-vlgc] db source_rows=${total} distinct_councils=${councils.length} ` +
        `totals_entities=${totalsEntity} all_measures=${allMeasures}`,
    );
    console.log(
      `[ingest:vic-vlgc] by_measure=${byMeasure
        .map((entry) => `${String(entry._id)}=${entry.rows}`)
        .join(',')}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:vic-vlgc] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
