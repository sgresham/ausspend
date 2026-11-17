import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  LGPRF_ID,
  createLgprfConnector,
  lgprfManifest,
  loadLgprfSource,
  runIngestion,
  type RawRecord,
} from '../server/src/connectors/index.js';
import { persistArchivedRecord } from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * VIC council performance layer — LGPRF 2020-25 full data set.
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   LGPRF_ARCHIVE_ROOT=/home/steve/ausspend-source-archive \
 *   npm run ingest:vic-lgprf
 *
 * All 79 Victorian councils for FY2020-21..FY2024-25. The official workbook has
 * 58 indicators in the first three years and 59 in the last two. Every row is a
 * non-additive performance indicator (`amount_cents` is 0; the published result
 * is in `performance_value`). No sum/average across councils, indicators or
 * years. Blanks/no-data flags are preserved; the source Totals row does not
 * exist in this data set. CC BY 4.0.
 */
export const LGPRF_SOURCE_IDS = [LGPRF_ID] as const;

async function writeManifest(name: string, value: unknown): Promise<void> {
  const manifestPath = path.resolve('docs/source-archive', name);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`[ingest:vic-lgprf] manifest=docs/source-archive/${name}`);
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  console.log(`[ingest:vic-lgprf] target=${databaseName} source=${LGPRF_ID}`);
  console.log(
    '[ingest:vic-lgprf] CC BY 4.0; derived indicator rows only; workbook archived outside the repo and not redistributed; no cross-council/indicator/year sum or average',
  );

  const archiveRoot = process.env.LGPRF_ARCHIVE_ROOT;
  const loaded = await loadLgprfSource({
    ...(process.env.LGPRF_SOURCE_PATH ? { sourcePath: process.env.LGPRF_SOURCE_PATH } : {}),
    ...(archiveRoot ? { archiveRoot } : {}),
  });

  const raw: RawRecord[] = loaded.raw;
  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    const base = createLgprfConnector();
    const connector = {
      ...base,
      async fetch() {
        base.metadata.warnings = loaded.warnings;
        return raw;
      },
    };
    const result = await runIngestion({ connectors: [connector] });
    for (const entry of result.results) {
      console.log(
        `[ingest:vic-lgprf] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
      if (entry.errors.length > 0) {
        throw new Error(`${entry.source_id} ingestion failed: ${entry.errors.join('; ')}`);
      }
    }

    await persistArchivedRecord(loaded.archive);
    await writeManifest('vic-lgprf-2020-25.json', lgprfManifest(loaded.parsed, loaded.archive));

    const total = await MeasureModel.countDocuments({ source_id: LGPRF_ID });
    const councils = await MeasureModel.distinct('delivery_entity', { source_id: LGPRF_ID });
    const totalsEntity = await MeasureModel.countDocuments({
      source_id: LGPRF_ID,
      delivery_entity: { $regex: /^totals?$/i },
    });
    const nonAdditive = await MeasureModel.countDocuments({
      source_id: LGPRF_ID,
      $or: [
        { aggregation_role: { $ne: 'agency_detail' } },
        { performance_non_additive: { $ne: true } },
        { amount_cents: { $ne: 0 } },
      ],
    });
    const byYear = await MeasureModel.aggregate([
      { $match: { source_id: LGPRF_ID } },
      {
        $group: {
          _id: '$fiscal_year',
          rows: { $sum: 1 },
          indicators: { $addToSet: '$performance_indicator_code' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const allMeasures = await MeasureModel.countDocuments({});
    console.log(
      `[ingest:vic-lgprf] db source_rows=${total} distinct_councils=${councils.length} ` +
        `totals_entities=${totalsEntity} non_additive_violations=${nonAdditive} all_measures=${allMeasures}`,
    );
    console.log(
      `[ingest:vic-lgprf] by_year=${byYear
        .map(
          (entry) =>
            `${String(entry._id)}=${entry.rows}/${(entry.indicators as string[]).length}ind`,
        )
        .join(',')}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:vic-lgprf] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
