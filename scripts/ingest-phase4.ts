import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  QGIP_ATTRIBUTION,
  QGIP_DATASET,
  QGIP_FISCAL_YEAR,
  QGIP_ID,
  QGIP_LICENSE,
  QGIP_SOURCE_URL,
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
 * Phase 4 ingestion runner (VIC Budget + QLD QGIP expenditure).
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo npm run ingest:phase4
 *
 * Runs the Phase 4 state connectors:
 *   - vic-budget: COFOG-A aggregate expenses XLSX plus the Department of
 *     Treasury and Finance statement. DTF rows are non-additive agency detail.
 *   - qld-qgip: the latest annual QGIP consolidated expenditure CSV plus its
 *     data dictionary. Only Grant (grant_award) and Frontline service
 *     procurement (contract) rows are ingested; they are separate measure types
 *     and are never summed together.
 *
 * The runner upserts on natural_key, so re-running is idempotent and never
 * deletes federal, NSW, GrantConnect, QLD BP3/BP4 or any other source's rows.
 *
 * After the run the exact archive metadata is persisted to source_documents and
 * a metadata-only manifest is written under docs/source-archive/. Bytes stay
 * outside the repo.
 */
export const PHASE4_SOURCE_IDS = [VIC_ID, QGIP_ID] as const;

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

async function writeQgipManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: QGIP_ID });
  const manifestPath = path.resolve(
    process.env.QGIP_MANIFEST ?? 'docs/source-archive/qld-qgip-2024-25.json',
  );
  const manifest = {
    dataset: QGIP_DATASET,
    fiscal_year: QGIP_FISCAL_YEAR,
    source_url: QGIP_SOURCE_URL,
    license: QGIP_LICENSE,
    attribution: QGIP_ATTRIBUTION,
    retrieved_at: new Date().toISOString(),
    unit: 'AUD dollars (x100 cents)',
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      'One annual consolidated QGIP expenditure CSV plus the official data dictionary. Only Grant (grant_award) and Frontline service procurement (contract) rows are ingested; Concession, Loan and Direct government investment are rejected as out-of-scope, as are zero-dollar rows. Grants and contracts are never summed into one QLD total. funding_source is the QLD funding agency acronym; location is statewide or the supplied service-delivery postcode/suburb/LGA. Bytes are archived outside the repo.',
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

    // Persist archive metadata (never bytes) and refresh the committed manifests.
    for (const sourceId of sourceIds) {
      const archived = await listArchivedRecords({ source_id: sourceId });
      for (const record of archived) await persistArchivedRecord(record);
    }
    if (sourceIds.includes(VIC_ID)) await writeManifest();
    if (sourceIds.includes(QGIP_ID)) await writeQgipManifest();

    if (sourceIds.includes(VIC_ID)) {
      const archived = await listArchivedRecords({ source_id: VIC_ID });
      const total = await MeasureModel.countDocuments({ source_id: VIC_ID });
      const byFunction = await MeasureModel.aggregate([
        { $match: { source_id: VIC_ID } },
        { $group: { _id: '$function_code', rows: { $sum: 1 }, cents: { $sum: '$amount_cents' } } },
        { $sort: { _id: 1 } },
      ]);
      const byFiscalYear = await MeasureModel.aggregate([
        { $match: { source_id: VIC_ID } },
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
      console.log(`[ingest:phase4] vic-budget rows=${total} source_documents=${archived.length}`);
      for (const group of byFiscalYear) {
        console.log(
          `[ingest:phase4] fiscal_year=${group._id.fiscal_year} role=${group._id.role} ` +
            `rows=${group.rows} cents=${group.cents}`,
        );
      }
      for (const group of byFunction) {
        console.log(
          `[ingest:phase4] function=${group._id ?? '(blank)'} rows=${group.rows} cents=${group.cents}`,
        );
      }
    }

    if (sourceIds.includes(QGIP_ID)) {
      const archived = await listArchivedRecords({ source_id: QGIP_ID });
      const total = await MeasureModel.countDocuments({ source_id: QGIP_ID });
      // Group by measure_type only: grants and contracts are never summed into
      // one QLD total, so no combined figure is printed.
      const byMeasureType = await MeasureModel.aggregate([
        { $match: { source_id: QGIP_ID } },
        { $group: { _id: '$measure_type', rows: { $sum: 1 }, cents: { $sum: '$amount_cents' } } },
        { $sort: { _id: 1 } },
      ]);
      const byQuality = await MeasureModel.aggregate([
        { $match: { source_id: QGIP_ID } },
        { $group: { _id: '$data_quality_flag', rows: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);
      console.log(
        `[ingest:phase4] qld-qgip rows=${total} source_documents=${archived.length} (measure types kept separate; no combined total)`,
      );
      for (const group of byMeasureType) {
        console.log(
          `[ingest:phase4] qld-qgip measure_type=${group._id} rows=${group.rows} cents=${group.cents}`,
        );
      }
      for (const group of byQuality) {
        console.log(`[ingest:phase4] qld-qgip quality=${group._id} rows=${group.rows}`);
      }
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
