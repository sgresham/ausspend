import 'dotenv/config';
import mongoose from 'mongoose';
import { CONNECTORS, runIngestion, type Connector } from '../server/src/connectors/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * Federal ingestion runner (F2/F3). AusTender and data.gov.au PBS are live;
 * every other registered source is a stub and is logged as `skipped`.
 *
 * Narrow live run (the acceptance window):
 *
 *   AUSTENDER_START_DATE=2026-11-02T00:00:00Z \
 *   AUSTENDER_END_DATE=2026-11-09T00:00:00Z \
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   npm run ingest:federal
 *
 * Set INGEST_SOURCES=aus-tender to run only AusTender, or
 * INGEST_SOURCES=data-gov-au-pbs to run only the PBS CSV. A source failure is
 * logged and marked degraded without aborting the rest of the run.
 */
function selectConnectors(): readonly Connector[] {
  const only = (process.env.INGEST_SOURCES ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (only.length === 0) return CONNECTORS;

  const selected = CONNECTORS.filter((connector) => only.includes(connector.id));
  const unknown = only.filter((id) => !CONNECTORS.some((connector) => connector.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown INGEST_SOURCES id(s): ${unknown.join(', ')}`);
  }
  return selected;
}

async function main(): Promise<void> {
  const databaseName = assertSeedTarget(process.env.MONGO_URL);
  await mongoose.connect(process.env.MONGO_URL as string, { serverSelectionTimeoutMS: 5_000 });

  try {
    const connectors = selectConnectors();
    const ausTender = connectors.find((connector) => connector.id === 'aus-tender');
    console.log(
      `[ingest] target=${databaseName} window=` +
        (process.env.AUSTENDER_START_DATE ?? '(default 7 days)') +
        '..' +
        (process.env.AUSTENDER_END_DATE ?? '(today)') +
        ` connectors=${connectors.length}`,
    );
    if (ausTender) {
      console.log(`[ingest] aus-tender status=${ausTender.status}`);
    }
    const pbs = connectors.find((connector) => connector.id === 'data-gov-au-pbs');
    if (pbs) {
      console.log(`[ingest] data-gov-au-pbs status=${pbs.status}`);
    }

    const result = await runIngestion({ connectors });
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
