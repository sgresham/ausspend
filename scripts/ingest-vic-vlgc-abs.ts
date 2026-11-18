import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  VLGGC_ABS_ID,
  createVlgcAbsConnector,
  loadVlgcAbsSource,
  runIngestion,
  vlgcAbsManifestFromLoaded,
} from '../server/src/connectors/index.js';
import { persistArchivedRecord } from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * VIC council pilot B — VLGGC ABS1/ABS2-3 2024-25 ingestion (all 79 councils).
 *
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev \
 *   ABS1_SOURCE_PATH=/path/to/ABS1.xlsx \
 *   ABS23_SOURCE_PATH=/path/to/ABS2-3.xlsx \
 *   npm run ingest:vic-vlgc-abs
 *
 * Both workbooks are discovered from the official VLGGC page via their Wayback
 * snapshots (the live page/asset returns a Cloudflare 403), SHA-256 verified
 * against the documented hashes, archived outside the repo, and parsed into
 * non-additive council rows. Source Totals rows are suppressed and no
 * cross-council total is emitted. Re-running upserts on natural_key, so it is
 * idempotent and never deletes another source's rows.
 */
async function writeManifest(loaded: Awaited<ReturnType<typeof loadVlgcAbsSource>>): Promise<void> {
  const manifestPath = path.resolve(
    process.env.VLGGC_ABS_MANIFEST ?? 'docs/source-archive/vic-vlgc-abs-2024-25.json',
  );
  const manifest = vlgcAbsManifestFromLoaded(loaded);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:vic-vlgc-abs] manifest=${path.relative(process.cwd(), manifestPath)} ` +
      `councils=${manifest.councils} rows=${manifest.rows}`,
  );
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);

  console.log(`[ingest:vic-vlgc-abs] target=${databaseName} source=${VLGGC_ABS_ID}`);
  console.log(
    '[ingest:vic-vlgc-abs] VLGGC attribution/permission, NOT CC BY; derived rows only; workbooks not redistributed',
  );

  const loaded = await loadVlgcAbsSource({
    ...(process.env.ABS1_SOURCE_PATH ? { abs1SourcePath: process.env.ABS1_SOURCE_PATH } : {}),
    ...(process.env.ABS23_SOURCE_PATH ? { abs23SourcePath: process.env.ABS23_SOURCE_PATH } : {}),
    ...(process.env.VLGGC_ABS_ARCHIVE_ROOT
      ? { archiveRoot: process.env.VLGGC_ABS_ARCHIVE_ROOT }
      : {}),
  });

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    const base = createVlgcAbsConnector();
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
        `[ingest:vic-vlgc-abs] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
    }

    for (const archive of loaded.archives) await persistArchivedRecord(archive);
    await writeManifest(loaded);

    const total = await MeasureModel.countDocuments({ source_id: VLGGC_ABS_ID });
    const councils = await MeasureModel.distinct('delivery_entity', { source_id: VLGGC_ABS_ID });
    const totalsEntity = await MeasureModel.countDocuments({
      source_id: VLGGC_ABS_ID,
      delivery_entity: { $regex: /^totals?$/i },
    });
    const allMeasures = await MeasureModel.countDocuments({});
    const byStatement = await MeasureModel.aggregate([
      { $match: { source_id: VLGGC_ABS_ID } },
      { $group: { _id: '$statement', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log(
      `[ingest:vic-vlgc-abs] db source_rows=${total} distinct_councils=${councils.length} ` +
        `totals_entities=${totalsEntity} all_measures=${allMeasures}`,
    );
    console.log(
      `[ingest:vic-vlgc-abs] by_statement=${byStatement
        .map((entry) => `${String(entry._id)}=${entry.rows}`)
        .join(',')}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:vic-vlgc-abs] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
