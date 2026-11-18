import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  NT_BUDGET_ID,
  createNtBudgetConnector,
  loadNtBudgetSource,
  ntBudgetManifest,
  runIngestion,
  type RawRecord,
} from '../server/src/connectors/index.js';
import { persistArchivedRecord } from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * NT Budget 2026-27 — COFOG-A capital works (Budget Paper No. 4, Table 3).
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   npm run ingest:nt-budget
 *
 * The NT budget site is Cloudflare-gated; the PDF is retrieved through the
 * documented headless-browser path, archived and hash-gated. One row per
 * published COFOG-A category, $ million, budget measure, territory/statewide.
 * No deletes.
 */
export const NT_BUDGET_SOURCE_IDS = [NT_BUDGET_ID] as const;

async function writeManifest(name: string, value: unknown): Promise<void> {
  const manifestPath = path.resolve('docs/source-archive', name);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`[ingest:nt-budget] manifest=docs/source-archive/${name}`);
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  console.log(`[ingest:nt-budget] target=${databaseName} source=${NT_BUDGET_ID}`);

  const loaded = await loadNtBudgetSource({
    ...(process.env.NT_BUDGET_PDF_PATH ? { pdfPath: process.env.NT_BUDGET_PDF_PATH } : {}),
    ...(process.env.NT_BUDGET_ARCHIVE_ROOT
      ? { archiveRoot: process.env.NT_BUDGET_ARCHIVE_ROOT }
      : {}),
  });
  const raw: RawRecord[] = loaded.records as unknown as RawRecord[];

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    const beforeAll = await MeasureModel.countDocuments({});
    const beforeNt = await MeasureModel.countDocuments({ source_id: NT_BUDGET_ID });
    console.log(`[ingest:nt-budget] before all=${beforeAll} nt=${beforeNt}`);

    const base = createNtBudgetConnector();
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
        `[ingest:nt-budget] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
      if (entry.errors.length > 0) {
        throw new Error(`${entry.source_id} ingestion failed: ${entry.errors.join('; ')}`);
      }
    }

    if (loaded.archive) await persistArchivedRecord(loaded.archive);
    await writeManifest('nt-budget-2026-27.json', ntBudgetManifest(loaded, loaded.archive));

    const total = await MeasureModel.countDocuments({ source_id: NT_BUDGET_ID });
    const allMeasures = await MeasureModel.countDocuments({});
    const violations = await MeasureModel.countDocuments({
      source_id: NT_BUDGET_ID,
      $or: [
        { jurisdiction_level: { $ne: 'territory' } },
        { measure_type: { $ne: 'budget' } },
        { data_quality_flag: { $ne: 'provisional' } },
        { extraction_confidence: { $ne: 'medium' } },
      ],
    });
    const byCofog = await MeasureModel.aggregate([
      { $match: { source_id: NT_BUDGET_ID } },
      { $group: { _id: '$function_code', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log(
      `[ingest:nt-budget] db source_rows=${total} violations=${violations} all_measures=${allMeasures}`,
    );
    console.log(
      `[ingest:nt-budget] by_cofog=${byCofog
        .map((entry) => `${String(entry._id)}=${entry.rows}`)
        .join(',')}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:nt-budget] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
