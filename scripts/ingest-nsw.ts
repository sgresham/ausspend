import 'dotenv/config';
import mongoose from 'mongoose';
import { getConnector, runIngestion } from '../server/src/connectors/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * NSW Budget 2025-26 Open Data ingestion (S1 only).
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev npm run ingest:nsw
 *
 * S1 ingests ONLY the NSW Budget Open Data workbooks and the ArcGIS capital
 * projects feature layer. data.nsw.gov.au CKAN, Dubbo and VIC/QLD/WA are not
 * touched by this script. The runner upserts on natural_key, so re-running is
 * idempotent and never deletes existing federal or synthetic rows.
 */
async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  const connector = getConnector('nsw-budget');
  if (!connector) throw new Error('nsw-budget connector is not registered');
  if (connector.status !== 'active') throw new Error(`nsw-budget connector is ${connector.status}`);

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    console.log(`[ingest:nsw] target=${databaseName} source=${connector.id}`);
    const result = await runIngestion({ connectors: [connector] });
    for (const entry of result.results) {
      console.log(
        `[ingest:nsw] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
    }
    const failed = result.results.filter((entry) => entry.log_status === 'error').length;
    console.log(`[ingest:nsw] done target=${databaseName} errored=${failed}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:nsw] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
