import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  QLD_ATTRIBUTION,
  QLD_DATASET,
  QLD_FISCAL_YEAR,
  QLD_ID,
  QLD_LICENSE,
  QLD_SOURCE_URL,
  QLD_UNIT,
  getConnector,
  qldManifestFromRecords,
  runIngestion,
} from '../server/src/connectors/index.js';
import {
  listArchivedRecords,
  persistArchivedRecord,
} from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * QLD Budget 2026-27 ingestion (BP3 Capital Statement + BP4 Budget Measures).
 *
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev \
 *   AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo npm run ingest:qld
 *
 * Runs exactly one connector: qld-budget. Upserts on natural_key, so re-running
 * is idempotent and never deletes another source's rows. The BP3/BP4 CSVs and
 * their data dictionaries are SHA-256 archived outside the repo; the repo only
 * gets a metadata manifest and source_documents records.
 */
export const QLD_SOURCE_IDS = [QLD_ID] as const;

function requestedSource(argv: readonly string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg.startsWith('--source=')) return arg.slice('--source='.length);
    if (arg === '--source') return argv[index + 1] ?? null;
  }
  return null;
}

async function writeManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: QLD_ID });
  const manifestPath = path.resolve(
    process.env.QLD_MANIFEST ?? 'docs/source-archive/qld-budget-2026-27.json',
  );
  const manifest = {
    dataset: QLD_DATASET,
    fiscal_year: QLD_FISCAL_YEAR,
    source_url: QLD_SOURCE_URL,
    license: QLD_LICENSE,
    attribution: QLD_ATTRIBUTION,
    retrieved_at: new Date().toISOString(),
    unit: "$'000 (x100,000 cents; confirmed by the archived data dictionaries)",
    files: qldManifestFromRecords(records),
    notes:
      'BP3 capital projects and BP4 expense/capital budget measures. BP4 revenue measures and blank/zero/negative 2026-27 amounts are excluded. No COFOG function; provisional. The two series are not a complete QLD expense total.',
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:qld] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  const requested = requestedSource(process.argv.slice(2));
  const sourceIds = requested ? [requested] : [...QLD_SOURCE_IDS];
  const connectors = sourceIds.map((id) => {
    const connector = getConnector(id);
    if (!connector) {
      throw new Error(`unknown QLD source "${id}"; expected ${QLD_SOURCE_IDS.join(', ')}`);
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
      `[ingest:qld] target=${databaseName} sources=${connectors.map((entry) => entry.id).join(',')}`,
    );
    const result = await runIngestion({ connectors });
    for (const entry of result.results) {
      console.log(
        `[ingest:qld] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
    }

    const archived = await listArchivedRecords({ source_id: QLD_ID });
    for (const record of archived) await persistArchivedRecord(record);
    await writeManifest();

    const total = await MeasureModel.countDocuments({ source_id: QLD_ID });
    const byFiscalYear = await MeasureModel.aggregate([
      { $match: { source_id: QLD_ID } },
      {
        $group: {
          _id: {
            fiscal_year: '$fiscal_year',
            role: { $ifNull: ['$aggregation_role', 'additive'] },
          },
          rows: { $sum: 1 },
          cents: { $sum: '$amount_cents' },
        },
      },
      { $sort: { '_id.fiscal_year': 1, '_id.role': 1 } },
    ]);
    const withFunction = await MeasureModel.countDocuments({
      source_id: QLD_ID,
      function_code: { $exists: true },
    });
    console.log(
      `[ingest:qld] qld-budget rows=${total} with_function=${withFunction} ` +
        `source_documents=${archived.length} unit=${QLD_UNIT}`,
    );
    for (const group of byFiscalYear) {
      console.log(
        `[ingest:qld] fiscal_year=${group._id.fiscal_year} role=${group._id.role} ` +
          `rows=${group.rows} cents=${group.cents}`,
      );
    }
    const failed = result.results.filter((entry) => entry.log_status === 'error').length;
    console.log(`[ingest:qld] done target=${databaseName} errored=${failed}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:qld] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
