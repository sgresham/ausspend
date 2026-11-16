import 'dotenv/config';
import mongoose from 'mongoose';
import { assertSeedTarget } from '../server/src/seed/guard.js';
import { seedSyntheticData } from '../server/src/seed/synthetic.js';

/**
 * Guarded synthetic seed.
 *
 *   npm run seed                 # safe: replaces only synthetic-seed rows
 *   npm run seed -- --reset      # destructive: wipes measures/functions/regions/sources
 *
 * The safe path preserves live ingestion rows (for example AusTender contracts),
 * other data sources and all ingestion logs, so the compose seed service can run
 * on every `docker compose up` without destroying a previous ingest.
 */
async function main(): Promise<void> {
  const databaseName = assertSeedTarget(process.env.MONGO_URL);
  const mongoUrl = process.env.MONGO_URL as string;
  const reset = process.argv.includes('--reset') || process.env.SEED_RESET === '1';

  console.log(
    `[seed] target database: ${databaseName} (${reset ? 'DESTRUCTIVE reset' : 'safe, preserves ingested rows'})`,
  );

  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5_000 });

  try {
    const summary = await seedSyntheticData({ reset });

    console.log(
      `[seed] sources=${summary.sources} regions=${summary.regions} ` +
        `functions=${summary.functions} measures=${summary.measures} ` +
        `synthetic=${summary.syntheticMeasures} non_synthetic=${summary.nonSyntheticMeasures}`,
    );
    console.log(`[seed] verified measures: ${summary.verifiedMeasures} (must be 0)`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[seed] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
