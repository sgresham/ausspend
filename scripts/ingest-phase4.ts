import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  ACNC_DATASET,
  ACNC_ID,
  ACNC_LICENSE,
  ACNC_SOURCE_URL,
  ACNC_UNIT,
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
 *   - acnc-charity: the latest ACNC Annual Information Statement CSV, its
 *     programs CSV and explanatory notes. Only positive total-expenses rows
 *     produce a record; every record carries an explicit expense_category.
 *     Total and component rows are never summed together.
 *
 * The runner upserts on natural_key, so re-running is idempotent and never
 * deletes federal, NSW, GrantConnect, QLD BP3/BP4 or any other source's rows.
 *
 * After the run the exact archive metadata is persisted to source_documents and
 * a metadata-only manifest is written under docs/source-archive/. Bytes stay
 * outside the repo.
 */
export const PHASE4_SOURCE_IDS = [VIC_ID, QGIP_ID, ACNC_ID] as const;

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

async function writeAcncManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: ACNC_ID });
  const manifestPath = path.resolve(
    process.env.ACNC_MANIFEST ?? 'docs/source-archive/acnc-ais-2024.json',
  );
  const manifest = {
    dataset: ACNC_DATASET,
    edition: 2024,
    source_url: ACNC_SOURCE_URL,
    license: ACNC_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${ACNC_UNIT} (x100 cents), confirmed by the explanatory notes`,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      'Latest ACNC Annual Information Statement CSV plus the programs CSV and explanatory notes. Every measure is jurisdiction_level=charity, jurisdiction=Australia, funding_source="ACNC-registered charity", measure_type=actual. The total expenses row is aggregation_role=expense_total and the five component categories are expense_component; they are never summed together. No COFOG function. State/postcode comes only from program operating locations, single-state only, flagged location_approximate. Bytes are archived outside the repo.',
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
    if (!['state', 'charity'].includes(connector.jurisdiction_level)) {
      throw new Error(
        `${id} is neither a state nor a charity source (${connector.jurisdiction_level})`,
      );
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
    if (sourceIds.includes(ACNC_ID)) await writeAcncManifest();

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

    if (sourceIds.includes(ACNC_ID)) {
      const archived = await listArchivedRecords({ source_id: ACNC_ID });
      const total = await MeasureModel.countDocuments({ source_id: ACNC_ID });
      const byRole = await MeasureModel.aggregate([
        { $match: { source_id: ACNC_ID } },
        {
          $group: { _id: '$aggregation_role', rows: { $sum: 1 }, cents: { $sum: '$amount_cents' } },
        },
        { $sort: { _id: 1 } },
      ]);
      const byCategory = await MeasureModel.aggregate([
        { $match: { source_id: ACNC_ID } },
        {
          $group: {
            _id: { role: '$aggregation_role', category: '$expense_category' },
            rows: { $sum: 1 },
            cents: { $sum: '$amount_cents' },
          },
        },
        { $sort: { '_id.role': 1, '_id.category': 1 } },
      ]);
      const withState = await MeasureModel.countDocuments({
        source_id: ACNC_ID,
        'location.state': { $exists: true, $ne: null },
      });
      const withPostcode = await MeasureModel.countDocuments({
        source_id: ACNC_ID,
        'location.postcode': { $exists: true, $ne: null },
      });
      const totalRows = await MeasureModel.find({
        source_id: ACNC_ID,
        aggregation_role: 'expense_total',
      })
        .sort({ amount_cents: -1 })
        .limit(5)
        .select({ abn: 1, delivery_entity: 1, amount_cents: 1, expense_category: 1, location: 1 })
        .lean();
      console.log(
        `[ingest:phase4] acnc-charity rows=${total} source_documents=${archived.length} with_state=${withState} with_postcode=${withPostcode} (total + components kept separate)`,
      );
      for (const group of byRole) {
        console.log(
          `[ingest:phase4] acnc-charity role=${group._id ?? '(none)'} rows=${group.rows} cents=${group.cents}`,
        );
      }
      for (const group of byCategory) {
        console.log(
          `[ingest:phase4] acnc-charity role=${group._id.role} category=${group._id.category} rows=${group.rows} cents=${group.cents}`,
        );
      }
      for (const row of totalRows) {
        console.log(
          `[ingest:phase4] acnc-charity top_total abn=${row.abn} charity=${row.delivery_entity} cents=${row.amount_cents} state=${row.location?.state ?? '(none)'} postcode=${row.location?.postcode ?? '(none)'}`,
        );
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
