import 'dotenv/config';
import mongoose from 'mongoose';
import { CONNECTORS, runIngestion } from '../server/src/connectors/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * F1 ingestion runner. No federal connector is live yet: the three federal ids
 * and the eight other registered connectors are stubs, so this logs a skipped
 * source for each and exits cleanly. The runner itself supports active
 * connectors; a source failure is logged and never aborts the remaining run.
 */
async function main(): Promise<void> {
  const databaseName = assertSeedTarget(process.env.MONGO_URL);
  await mongoose.connect(process.env.MONGO_URL as string, { serverSelectionTimeoutMS: 5_000 });

  try {
    const result = await runIngestion({ connectors: CONNECTORS });
    for (const entry of result.results) {
      console.log(
        `[ingest] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
    }
    const skipped = result.results.filter((entry) => entry.log_status === 'skipped').length;
    const errored = result.results.filter((entry) => entry.log_status === 'error').length;
    console.log(
      `[ingest] done target=${databaseName} connectors=${result.results.length} ` +
        `skipped=${skipped} errored=${errored}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
