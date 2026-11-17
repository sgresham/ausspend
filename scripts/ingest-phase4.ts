import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  VIC_ATTRIBUTION,
  VIC_DATASET,
  VIC_FISCAL_YEAR,
  VIC_ID,
  VIC_LICENSE,
  VIC_SOURCE_URL,
  getConnector,
  runIngestion,
} from '../server/src/connectors/index.js';
import {
  listArchivedRecords,
  persistArchivedRecord,
} from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * Phase 4 ingestion runner (VIC only in this item).
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo npm run ingest:phase4
 *
 * Runs exactly one connector: vic-budget (COFOG-A aggregate expenses XLSX plus
 * the Department of Treasury and Finance statement). The runner upserts on
 * natural_key, so re-running is idempotent and never deletes federal, NSW,
 * GrantConnect or any other source's rows.
 *
 * After the run the exact workbook archive metadata is persisted to
 * source_documents and a metadata-only manifest is written under
 * docs/source-archive/. Workbook bytes stay outside the repo.
 */
export const PHASE4_SOURCE_IDS = [VIC_ID] as const;

function requestedSource(argv: readonly string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg.startsWith('--source=')) return arg.slice('--source='.length);
    if (arg === '--source') return argv[index + 1] ?? null;
  }
  return null;
}

async function writeManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: VIC_ID });
  const manifestPath = path.resolve(
    process.env.VIC_MANIFEST ?? 'docs/source-archive/vic-budget-2026-27.json',
  );
  const manifest = {
    dataset: VIC_DATASET,
    fiscal_year: VIC_FISCAL_YEAR,
    source_url: VIC_SOURCE_URL,
    license: VIC_LICENSE,
    attribution: VIC_ATTRIBUTION,
    retrieved_at: new Date().toISOString(),
    unit: '$ million (x100,000,000 cents)',
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      'Only 2025-26 and 2026-27 budget columns are ingested. Transport is a VIC COFOG major group tagged 045; do not roll 045 into 04. Departmental rows are provisional and carry no COFOG function. Workbook bytes are archived outside the repo.',
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:phase4] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  const requested = requestedSource(process.argv.slice(2));
  const sourceIds = requested ? [requested] : [...PHASE4_SOURCE_IDS];
  const connectors = sourceIds.map((id) => {
    const connector = getConnector(id);
    if (!connector) {
      throw new Error(
        `unknown Phase 4 source "${id}"; expected one of ${PHASE4_SOURCE_IDS.join(', ')}`,
      );
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
      `[ingest:phase4] target=${databaseName} sources=${connectors.map((entry) => entry.id).join(',')}`,
    );
    const result = await runIngestion({ connectors });
    for (const entry of result.results) {
      console.log(
        `[ingest:phase4] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
    }

    // Persist archive metadata (never bytes) and refresh the committed manifest.
    const archived = await listArchivedRecords({ source_id: VIC_ID });
    for (const record of archived) await persistArchivedRecord(record);
    await writeManifest();

    const total = await MeasureModel.countDocuments({ source_id: VIC_ID });
    const byFunction = await MeasureModel.aggregate([
      { $match: { source_id: VIC_ID } },
      { $group: { _id: '$function_code', rows: { $sum: 1 }, cents: { $sum: '$amount_cents' } } },
      { $sort: { _id: 1 } },
    ]);
    console.log(`[ingest:phase4] vic-budget rows=${total} source_documents=${archived.length}`);
    for (const group of byFunction) {
      console.log(
        `[ingest:phase4] function=${group._id ?? '(blank)'} rows=${group.rows} cents=${group.cents}`,
      );
    }

    const failed = result.results.filter((entry) => entry.log_status === 'error').length;
    console.log(`[ingest:phase4] done target=${databaseName} errored=${failed}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:phase4] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
