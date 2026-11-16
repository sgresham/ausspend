import 'dotenv/config';
import mongoose from 'mongoose';
import { assertSeedTarget } from '../server/src/seed/guard.js';
import { seedSyntheticData, type SeedMode } from '../server/src/seed/synthetic.js';

/**
 * Guarded seed.
 *
 *   npm run seed                       # safe: replaces only synthetic-seed rows
 *   npm run seed -- --no-synthetic     # real-only: taxonomy + real sources, 0 synthetic rows
 *   SEED_MODE=real npm run seed        # same as --no-synthetic
 *   npm run seed -- --reset            # destructive: wipes measures/functions/regions/sources
 *
 * The safe path preserves live ingestion rows (for example AusTender contracts),
 * other data sources and all ingestion logs, so the compose seed service can run
 * on every `docker compose up` without destroying a previous ingest. Real-only
 * mode never writes or deletes synthetic rows; retiring existing seed rows is a
 * separate, backed-up operation (`npm run clean:synthetic`).
 */
function parseMode(argv: readonly string[]): SeedMode {
  const flagReal =
    argv.includes('--no-synthetic') || argv.includes('--real-only') || argv.includes('--mode=real');
  const envReal = (process.env.SEED_MODE ?? '').toLowerCase() === 'real';
  return flagReal || envReal ? 'real' : 'synthetic';
}

async function main(): Promise<void> {
  const databaseName = assertSeedTarget(process.env.MONGO_URL);
  const mongoUrl = process.env.MONGO_URL as string;
  const reset = process.argv.includes('--reset') || process.env.SEED_RESET === '1';
  const mode = parseMode(process.argv);

  console.log(
    `[seed] target database: ${databaseName} (mode=${mode}, ${
      reset ? 'DESTRUCTIVE reset' : 'non-destructive'
    })`,
  );

  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5_000 });

  try {
    const summary = await seedSyntheticData({ reset, mode });

    console.log(
      `[seed] mode=${summary.mode} sources=${summary.sources} regions=${summary.regions} ` +
        `functions=${summary.functions} measures=${summary.measures} ` +
        `synthetic=${summary.syntheticMeasures} synthetic_written=${summary.syntheticMeasuresWritten} ` +
        `non_synthetic=${summary.nonSyntheticMeasures}`,
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
