import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  ACT_BUDGET_ID,
  actBudgetManifest,
  createActBudgetConnector,
  loadActBudgetSource,
  runIngestion,
  type RawRecord,
} from '../server/src/connectors/index.js';
import { persistArchivedRecord } from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * ACT Budget — Socrata infrastructure investment programme.
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   npm run ingest:act-budget
 *
 * Paged Socrata resource API (`$limit`/`$offset`), dataset `8275-pg6z`.
 * Budgeted capital-works financing by project and fiscal year; $'000 unit
 * detected from the published column names. No deletes.
 */
export const ACT_BUDGET_SOURCE_IDS = [ACT_BUDGET_ID] as const;

async function writeManifest(name: string, value: unknown): Promise<void> {
  const manifestPath = path.resolve('docs/source-archive', name);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`[ingest:act-budget] manifest=docs/source-archive/${name}`);
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  console.log(`[ingest:act-budget] target=${databaseName} source=${ACT_BUDGET_ID}`);

  const loaded = await loadActBudgetSource({
    ...(process.env.ACT_BUDGET_ARCHIVE_ROOT
      ? { archiveRoot: process.env.ACT_BUDGET_ARCHIVE_ROOT }
      : {}),
    ...(process.env.ACT_BUDGET_PAGE_SIZE
      ? { pageSize: Number(process.env.ACT_BUDGET_PAGE_SIZE) }
      : {}),
  });
  const raw: RawRecord[] = loaded.records as unknown as RawRecord[];

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    const beforeAll = await MeasureModel.countDocuments({});
    const beforeAct = await MeasureModel.countDocuments({ source_id: ACT_BUDGET_ID });
    console.log(`[ingest:act-budget] before all=${beforeAll} act=${beforeAct}`);

    const base = createActBudgetConnector();
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
        `[ingest:act-budget] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
      if (entry.errors.length > 0) {
        throw new Error(`${entry.source_id} ingestion failed: ${entry.errors.join('; ')}`);
      }
    }

    await persistArchivedRecord(loaded.archive);
    await writeManifest('act-budget-8275-pg6z.json', actBudgetManifest(loaded, loaded.archive));

    const total = await MeasureModel.countDocuments({ source_id: ACT_BUDGET_ID });
    const allMeasures = await MeasureModel.countDocuments({});
    const additiveViolations = await MeasureModel.countDocuments({
      source_id: ACT_BUDGET_ID,
      $or: [
        { jurisdiction_level: { $ne: 'territory' } },
        { measure_type: { $ne: 'budget' } },
        { aggregation_role: { $ne: 'additive' } },
      ],
    });
    const byYear = await MeasureModel.aggregate([
      { $match: { source_id: ACT_BUDGET_ID } },
      { $group: { _id: '$fiscal_year', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log(
      `[ingest:act-budget] db source_rows=${total} violations=${additiveViolations} all_measures=${allMeasures}`,
    );
    console.log(
      `[ingest:act-budget] by_year=${byYear
        .map((entry) => `${String(entry._id)}=${entry.rows}`)
        .join(',')}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:act-budget] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
