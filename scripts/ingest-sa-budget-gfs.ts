import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  SA_GFS_ID,
  createSaGfsConnector,
  loadSaGfsSource,
  runIngestion,
  saGfsManifest,
  type RawRecord,
} from '../server/src/connectors/index.js';
import { persistArchivedRecord } from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * SA state general government GFS expenses by function (GPC) and economic type.
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   SA_GFS_ARCHIVE_ROOT=/home/steve/ausspend-source-archive \
 *   npm run ingest:sa-gfs
 *
 * Statewide SA only; no SA local government, agency/project or LGA allocation.
 * Unit is detected as $'000 and reconciled to each sheet's printed TOTAL row.
 * GPC is mapped explicitly to COFOG; GPC 3450 is a non-COFOG memorandum item
 * and is not emitted. No deletes.
 */
export const SA_GFS_SOURCE_IDS = [SA_GFS_ID] as const;

async function writeManifest(name: string, value: unknown): Promise<void> {
  const manifestPath = path.resolve('docs/source-archive', name);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`[ingest:sa-gfs] manifest=docs/source-archive/${name}`);
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  console.log(`[ingest:sa-gfs] target=${databaseName} source=${SA_GFS_ID}`);
  console.log(
    '[ingest:sa-gfs] SA statewide GFS expenses; GPC -> COFOG; unit $000; no deletes; no cross-source sum',
  );

  const loaded = await loadSaGfsSource({
    ...(process.env.SA_GFS_SOURCE_PATH ? { workbookPath: process.env.SA_GFS_SOURCE_PATH } : {}),
    ...(process.env.SA_GFS_ARCHIVE_ROOT ? { archiveRoot: process.env.SA_GFS_ARCHIVE_ROOT } : {}),
  });

  const raw: RawRecord[] = loaded.records as unknown as RawRecord[];
  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    const beforeAll = await MeasureModel.countDocuments({});
    const beforeSa = await MeasureModel.countDocuments({ source_id: SA_GFS_ID });
    console.log(`[ingest:sa-gfs] before all=${beforeAll} sa=${beforeSa}`);

    const base = createSaGfsConnector();
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
        `[ingest:sa-gfs] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
      if (entry.errors.length > 0) {
        throw new Error(`${entry.source_id} ingestion failed: ${entry.errors.join('; ')}`);
      }
    }

    await persistArchivedRecord(loaded.archive);
    await writeManifest('sa-budget-gfs-2012-16.json', saGfsManifest(loaded.parsed, loaded.archive));

    const total = await MeasureModel.countDocuments({ source_id: SA_GFS_ID });
    const allMeasures = await MeasureModel.countDocuments({});
    const cofogRows = await MeasureModel.countDocuments({
      source_id: SA_GFS_ID,
      function_code: { $in: ['01', '03', '04', '05', '06', '07', '08', '09', '10'] },
    });
    const additive = await MeasureModel.countDocuments({
      source_id: SA_GFS_ID,
      $or: [{ aggregation_role: { $ne: 'agency_detail' } }, { measure_type: { $ne: 'actual' } }],
    });
    const byYear = await MeasureModel.aggregate([
      { $match: { source_id: SA_GFS_ID } },
      {
        $group: {
          _id: '$fiscal_year',
          rows: { $sum: 1 },
          cofog: { $addToSet: '$function_code' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const byCofog = await MeasureModel.aggregate([
      { $match: { source_id: SA_GFS_ID } },
      { $group: { _id: '$function_code', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log(
      `[ingest:sa-gfs] db source_rows=${total} cofog_rows=${cofogRows} ` +
        `additive_violations=${additive} all_measures=${allMeasures}`,
    );
    console.log(
      `[ingest:sa-gfs] by_year=${byYear
        .map((entry) => `${String(entry._id)}=${entry.rows}`)
        .join(',')}`,
    );
    console.log(
      `[ingest:sa-gfs] by_cofog=${byCofog
        .map((entry) => `${String(entry._id)}=${entry.rows}`)
        .join(',')}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:sa-gfs] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
