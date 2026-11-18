import 'dotenv/config';
import mongoose from 'mongoose';
import { getConnector, runIngestion, type Connector } from '../server/src/connectors/index.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * Phase 6 integration runner.
 *
 * Runs the Phase 6 sources in priority order, one connector at a time, so the
 * runner records a separate ingestion_logs row and source status transition for
 * each. `PHASE6_SOURCES` optionally narrows the run (comma-separated ids);
 * `PHASE6_DRY_RUN=1` prints the order without fetching. No deletes.
 */
export const PHASE6_ORDER = [
  'aihw-health-expenditure',
  'wa-budget',
  'sa-budget-gfs',
  'act-budget',
  'tas-budget',
  'nt-budget',
  'qld-local-government',
] as const;

function requestedIds(): string[] {
  const raw = process.env.PHASE6_SOURCES?.trim();
  if (!raw) return [...PHASE6_ORDER];
  const requested = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const unknown = requested.filter((id) => !PHASE6_ORDER.includes(id as never));
  if (unknown.length > 0) {
    throw new Error(`unknown PHASE6_SOURCES id(s): ${unknown.join(', ')}`);
  }
  return PHASE6_ORDER.filter((id) => requested.includes(id));
}

async function main(): Promise<void> {
  const ids = requestedIds();
  console.log(`[ingest:phase6] order=${ids.join(' -> ')}`);

  if (process.env.PHASE6_DRY_RUN === '1') {
    console.log('[ingest:phase6] dry run; no fetch and no database change');
    return;
  }

  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  console.log(`[ingest:phase6] target=${databaseName}`);

  const connectors: Connector[] = ids.map((id) => {
    const connector = getConnector(id);
    if (!connector) throw new Error(`connector not registered: ${id}`);
    return connector;
  });

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  const failures: string[] = [];
  try {
    const beforeAll = await MeasureModel.countDocuments({});
    console.log(`[ingest:phase6] before all_measures=${beforeAll}`);

    for (const connector of connectors) {
      const before = await MeasureModel.countDocuments({ source_id: connector.id });
      const started = Date.now();
      console.log(`[ingest:phase6] START ${connector.id} (before=${before})`);
      const result = await runIngestion({ connectors: [connector] });
      const entry = result.results[0];
      const after = await MeasureModel.countDocuments({ source_id: connector.id });
      console.log(
        `[ingest:phase6] DONE  ${connector.id} status=${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted} ` +
          `db_source_rows=${after} elapsed_ms=${Date.now() - started}`,
      );
      if (entry.errors.length > 0) {
        failures.push(`${connector.id}: ${entry.errors.join('; ')}`);
        console.log(`[ingest:phase6] ERROR ${connector.id}: ${entry.errors.join('; ')}`);
      }
    }

    const afterAll = await MeasureModel.countDocuments({});
    const rows = await MeasureModel.aggregate([
      { $match: { source_id: { $in: ids } } },
      { $group: { _id: '$source_id', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log(
      `[ingest:phase6] summary rows=${rows
        .map((entry) => `${String(entry._id)}=${entry.rows}`)
        .join(',')} all_measures=${afterAll}`,
    );
    if (afterAll < beforeAll) {
      throw new Error(`Phase 6 run decreased the measure count (${beforeAll} -> ${afterAll})`);
    }
    if (failures.length > 0 && process.env.PHASE6_CONTINUE_ON_ERROR !== '1') {
      throw new Error(`Phase 6 completed with errors: ${failures.join(' | ')}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:phase6] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
