import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  AIHW_ID,
  createAihwHealthExpenditureConnector,
  aihwManifest,
  loadAihwSource,
  runIngestion,
  type RawRecord,
} from '../server/src/connectors/index.js';
import { persistArchivedRecord } from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * AIHW health expenditure — current 2024-25 release (Phase 6.2b correction).
 *
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev \
 *   AIHW_ARCHIVE_ROOT=${AUSSPEND_SOURCE_ARCHIVE} \
 *   npm run ingest:aihw
 *
 * The current AIHW supplementary tables publish state x area x source detail
 * for 2022-23, 2023-24 and 2024-25. This script REPLACES only the existing
 * `aihw-health-expenditure` rows (the stale 1997-98..2011-12 CSV) with the
 * current COFOG 07 rows; every other source and total is untouched. Government
 * and non-government funding stay separate and no row is additive.
 */
export const AIHW_SOURCE_IDS = [AIHW_ID] as const;

async function writeManifest(name: string, value: unknown): Promise<void> {
  const manifestPath = path.resolve('docs/source-archive', name);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`[ingest:aihw] manifest=docs/source-archive/${name}`);
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  console.log(`[ingest:aihw] target=${databaseName} source=${AIHW_ID}`);
  console.log(
    '[ingest:aihw] current AIHW 2024-25 tables; COFOG 07; government and non-government kept separate; replacing only aihw-health-expenditure rows',
  );

  const archiveRoot = process.env.AIHW_ARCHIVE_ROOT;
  const loaded = await loadAihwSource({
    ...(process.env.AIHW_SOURCE_PATH ? { workbookPath: process.env.AIHW_SOURCE_PATH } : {}),
    ...(archiveRoot ? { archiveRoot } : {}),
  });

  const raw: RawRecord[] = loaded.records as unknown as RawRecord[];
  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    const beforeAll = await MeasureModel.countDocuments({});
    const beforeAihw = await MeasureModel.countDocuments({ source_id: AIHW_ID });
    const beforeOther = await MeasureModel.countDocuments({ source_id: { $ne: AIHW_ID } });
    console.log(
      `[ingest:aihw] before all=${beforeAll} aihw=${beforeAihw} other_sources=${beforeOther}`,
    );

    // Explicit, source-scoped replacement. The old AIHW series ended at
    // 2011-12 and is superseded; no non-AIHW row is deleted or modified.
    const deleted = await MeasureModel.deleteMany({ source_id: AIHW_ID });
    console.log(`[ingest:aihw] deleted stale ${AIHW_ID} rows=${deleted.deletedCount}`);

    const base = createAihwHealthExpenditureConnector();
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
        `[ingest:aihw] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
      if (entry.errors.length > 0) {
        throw new Error(`${entry.source_id} ingestion failed: ${entry.errors.join('; ')}`);
      }
    }

    await persistArchivedRecord(loaded.archive);
    await writeManifest(
      'aihw-health-expenditure-2024-25.json',
      aihwManifest(loaded.parsed, loaded.archive),
    );

    const total = await MeasureModel.countDocuments({ source_id: AIHW_ID });
    const otherAfter = await MeasureModel.countDocuments({ source_id: { $ne: AIHW_ID } });
    const allMeasures = await MeasureModel.countDocuments({});
    const cofog07 = await MeasureModel.countDocuments({
      source_id: AIHW_ID,
      function_code: '07',
    });
    const additive = await MeasureModel.countDocuments({
      source_id: AIHW_ID,
      $or: [{ aggregation_role: { $ne: 'agency_detail' } }, { measure_type: { $ne: 'actual' } }],
    });
    const byYear = await MeasureModel.aggregate([
      { $match: { source_id: AIHW_ID } },
      {
        $group: {
          _id: '$fiscal_year',
          rows: { $sum: 1 },
          government: {
            $sum: { $cond: [{ $eq: ['$aihw_funding_sector', 'government'] }, 1, 0] },
          },
          non_government: {
            $sum: { $cond: [{ $eq: ['$aihw_funding_sector', 'non_government'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const states = await MeasureModel.distinct('aihw_state', { source_id: AIHW_ID });
    console.log(
      `[ingest:aihw] db source_rows=${total} cofog07=${cofog07} states=${states.length} ` +
        `additive_violations=${additive} other_sources_unchanged=${otherAfter === beforeOther} all_measures=${allMeasures}`,
    );
    console.log(
      `[ingest:aihw] by_year=${byYear
        .map(
          (entry) =>
            `${String(entry._id)}=${entry.rows}(gov=${entry.government},nongov=${entry.non_government})`,
        )
        .join(',')}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:aihw] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
