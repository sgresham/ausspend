import 'dotenv/config';
import mongoose from 'mongoose';
import { getConnector, runIngestion } from '../server/src/connectors/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * NSW ingestion (S1 + S2).
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev npm run ingest:nsw
 *   MONGO_URL=... npm run ingest:nsw -- --source data-nsw-ckan
 *
 * With no `--source`, every registered NSW source runs sequentially:
 *   - nsw-budget      S1: NSW Budget 2025-26 Open Data XLSX + ArcGIS capital
 *   - data-nsw-ckan   S2: targeted data.nsw.gov.au CKAN datasets
 *
 * S2 deliberately stops at data.nsw.gov.au CKAN. Dubbo (S3), VIC/QLD/WA and
 * live PDF/DOCX ingestion are not touched. The runner upserts on natural_key,
 * so re-running is idempotent and never deletes existing federal/synthetic rows.
 */
export const NSW_SOURCE_IDS = ['nsw-budget', 'data-nsw-ckan'] as const;

function requestedSource(argv: readonly string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg.startsWith('--source=')) return arg.slice('--source='.length);
    if (arg === '--source') return argv[index + 1] ?? null;
  }
  return null;
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  const requested = requestedSource(process.argv.slice(2));
  const sourceIds = requested ? [requested] : [...NSW_SOURCE_IDS];
  const connectors = sourceIds.map((id) => {
    const connector = getConnector(id);
    if (!connector) {
      throw new Error(`unknown NSW source "${id}"; expected one of ${NSW_SOURCE_IDS.join(', ')}`);
    }
    if (connector.jurisdiction_level !== 'state') {
      throw new Error(`${id} is not a state source (${connector.jurisdiction_level})`);
    }
    if (connector.status !== 'active') throw new Error(`${id} connector is ${connector.status}`);
    return connector;
  });

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    console.log(
      `[ingest:nsw] target=${databaseName} sources=${connectors.map((entry) => entry.id).join(',')}`,
    );
    const result = await runIngestion({ connectors });
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
