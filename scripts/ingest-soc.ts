import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  ABS_GFS_PNFC_BENCHMARK_CAVEAT,
  ABS_GFS_PNFC_DATASET,
  ABS_GFS_PNFC_FISCAL_YEAR,
  ABS_GFS_PNFC_ID,
  ABS_GFS_PNFC_LICENSE,
  ABS_GFS_PNFC_RELEASE_URL,
  ABS_GFS_PNFC_TABLES,
  ABS_GFS_PNFC_UNIT,
  ABS_GFS_PNFC_UNIT_TO_CENTS,
  HUNTER_WATER_CAVEAT,
  HUNTER_WATER_ENTITY,
  HUNTER_WATER_ID,
  HUNTER_WATER_JURISDICTION,
  HUNTER_WATER_LICENSE,
  HUNTER_WATER_NAME,
  HUNTER_WATER_PUBLISHER,
  HUNTER_WATER_SOURCE_URL,
  HUNTER_WATER_UNIT,
  HUNTER_WATER_UNIT_LABEL,
  HUNTER_WATER_UNIT_TO_CENTS,
  SYDNEY_WATER_CAVEAT,
  SYDNEY_WATER_ENTITY,
  SYDNEY_WATER_ID,
  SYDNEY_WATER_JURISDICTION,
  SYDNEY_WATER_LICENSE,
  SYDNEY_WATER_NAME,
  SYDNEY_WATER_PUBLISHER,
  SYDNEY_WATER_SOURCE_URL,
  SYDNEY_WATER_UNIT,
  SYDNEY_WATER_UNIT_LABEL,
  SYDNEY_WATER_UNIT_TO_CENTS,
  WATERNSW_CAVEAT,
  WATERNSW_ENTITY,
  WATERNSW_ID,
  WATERNSW_JURISDICTION,
  WATERNSW_LICENSE,
  WATERNSW_NAME,
  WATERNSW_PUBLISHER,
  WATERNSW_SOURCE_URL,
  WATERNSW_UNIT,
  WATERNSW_UNIT_LABEL,
  WATERNSW_UNIT_TO_CENTS,
  getConnector,
  runIngestion,
} from '../server/src/connectors/index.js';
import {
  listArchivedRecords,
  persistArchivedRecord,
} from '../server/src/connectors/source-archive.js';
import { DeferredSocDocumentModel, MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * SOC ingestion runner — Phase 5 skeleton.
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo npm run ingest:soc
 *
 * It runs, in order: the ABS GFS Public Non-Financial Corporations (PNFC)
 * sector benchmark from the nine official ABS GFS Annual 2024-25 XLSX data
 * cubes, then the NSW SOC per-entity adapters — Sydney Water, WaterNSW, then
 * Hunter Water.
 * The ABS SDMX API has no PNFC/GFS dataflow, so the PNFC XLSX is the
 * human-approved fallback.
 *
 * Later NSW SOC per-entity adapters plug in at `FUTURE_SOC_SOURCE_IDS`: add the
 * connector id there and in the registry, and keep the same per-source
 * success/failure logging. They are deliberately NOT implemented here.
 *
 * PNFC is a sector aggregate: jurisdiction_level "pnfc",
 * aggregation_role "benchmark", verified true. It is never added to SOC/entity,
 * government, charity or project data, and revenue/expense or jurisdictions are
 * never summed. The Sydney Water, WaterNSW and Hunter Water entity adapters are separate SOC
 * sources and are never summed with each other or with PNFC. The runner prints
 * per-source counts only, never a combined total. It never deletes any row.
 */
/**
 * Order matters: the PNFC sector benchmark runs first, then the NSW SOC
 * per-entity adapters (Sydney Water, WaterNSW, then Hunter Water). No other SOC adapter is
 * implemented, and the three entity adapters are never summed together.
 */
export const SOC_SOURCE_IDS = [
  ABS_GFS_PNFC_ID,
  SYDNEY_WATER_ID,
  WATERNSW_ID,
  HUNTER_WATER_ID,
] as const;

/**
 * Placeholder for the later per-entity NSW SOC adapters. Do not add ids here
 * until the adapter exists; other SOCs are intentionally not implemented.
 */
export const FUTURE_SOC_SOURCE_IDS: readonly string[] = [];

async function writePnfcManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: ABS_GFS_PNFC_ID });
  const manifestPath = path.resolve(
    process.env.ABS_GFS_PNFC_MANIFEST ?? 'docs/source-archive/abs-gfs-pnfc-2024-25.json',
  );
  const manifest = {
    dataset: ABS_GFS_PNFC_DATASET,
    fiscal_year: ABS_GFS_PNFC_FISCAL_YEAR,
    source_url: ABS_GFS_PNFC_RELEASE_URL,
    license: ABS_GFS_PNFC_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${ABS_GFS_PNFC_UNIT} (x${ABS_GFS_PNFC_UNIT_TO_CENTS} cents per unit)`,
    sdmx_status:
      'ABS SDMX API (https://data.api.abs.gov.au/rest/v1) has no PNFC/GFS dataflow: the full ABS dataflow catalogue (1,228 dataflows) contains zero PNFC, Public Non-Financial, GFS, COFOG or Government Finance dataflows, and every plausible PNFC dataflow id returns HTTP 404. No SDMX query is used.',
    tables: ABS_GFS_PNFC_TABLES.map((table) => ({
      file_id: table.file_id,
      jurisdiction: table.jurisdiction,
      jurisdiction_name: table.jurisdiction_name,
      level: table.level,
      filename: table.filename,
    })),
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes: `ABS GFS Annual ${ABS_GFS_PNFC_FISCAL_YEAR} Public Non-Financial Corporations operating statements for Australia (all levels) and the eight state/territory jurisdictions. Only the published "Total GFS revenue" and "Total GFS expenses" rows for FY2024-25 are ingested; units are $m confirmed from workbook row 6. Every row is an official aggregate: jurisdiction_level=pnfc, measure_type=actual, verified=true, data_quality_flag=verified, aggregation_role=benchmark. ${ABS_GFS_PNFC_BENCHMARK_CAVEAT} Bytes are archived outside the repo.`,
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeSydneyWaterManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: SYDNEY_WATER_ID });
  const manifestPath = path.resolve(
    process.env.SYDNEY_WATER_MANIFEST ?? 'docs/source-archive/sydney-water-annual-report.json',
  );
  const manifest = {
    entity: SYDNEY_WATER_ENTITY,
    jurisdiction: SYDNEY_WATER_JURISDICTION,
    dataset: SYDNEY_WATER_NAME,
    publisher: SYDNEY_WATER_PUBLISHER,
    discovery_page: SYDNEY_WATER_SOURCE_URL,
    license: SYDNEY_WATER_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${SYDNEY_WATER_UNIT_LABEL} (${SYDNEY_WATER_UNIT}; x${SYDNEY_WATER_UNIT_TO_CENTS} cents per unit)`,
    caveat: SYDNEY_WATER_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      'Latest Sydney Water annual report discovered from the official annual-report page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. The face statement prints an explicit $’000 unit. Total expenses is the exact sum of the two printed expense totals (finance costs + other expenses) and is accepted only when the statement profit-before-tax bridge and both note subtotals reconcile exactly. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add SOC actuals to government program spending, the PNFC benchmark, or each other.',
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeWaterNswManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: WATERNSW_ID });
  const manifestPath = path.resolve(
    process.env.WATERNSW_MANIFEST ?? 'docs/source-archive/waternsw-annual-report.json',
  );
  const manifest = {
    entity: WATERNSW_ENTITY,
    jurisdiction: WATERNSW_JURISDICTION,
    dataset: WATERNSW_NAME,
    publisher: WATERNSW_PUBLISHER,
    discovery_page: WATERNSW_SOURCE_URL,
    license: WATERNSW_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${WATERNSW_UNIT_LABEL} (${WATERNSW_UNIT}; x${WATERNSW_UNIT_TO_CENTS} cents per unit)`,
    caveat: WATERNSW_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      retrieved_from: record.retrieved_from,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      'Latest WaterNSW annual report discovered from the official annual-report page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. The consolidated face statement prints an explicit $’000 unit. Total expenses is an explicit printed total and is accepted only when the printed revenue/expense components and the operating-profit, profit-before-tax and net-result bridges reconcile exactly, and Note 3 grants sum to the statement Grants and subsidies line. Deep detail adds the printed note tables: Note 2 water-supply segments, Note 4 other-revenue categories, Note 5 employee-expense components, Note 6 other-operating-expense categories, Note 7 depreciation components, Note 8 finance-cost components and the cash-flow capital-expenditure outflow. Every note component is accepted only when its printed signs sum exactly to its printed note subtotal, and every row is marked soc_component_of that subtotal so it is never added to the entity total. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add WaterNSW rows to government program spending, the PNFC benchmark, Sydney Water, or each other.',
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeHunterWaterManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: HUNTER_WATER_ID });
  const manifestPath = path.resolve(
    process.env.HUNTER_WATER_MANIFEST ?? 'docs/source-archive/hunter-water-annual-report.json',
  );
  const manifest = {
    entity: HUNTER_WATER_ENTITY,
    jurisdiction: HUNTER_WATER_JURISDICTION,
    dataset: HUNTER_WATER_NAME,
    publisher: HUNTER_WATER_PUBLISHER,
    discovery_page: HUNTER_WATER_SOURCE_URL,
    license: HUNTER_WATER_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${HUNTER_WATER_UNIT_LABEL} (${HUNTER_WATER_UNIT}; x${HUNTER_WATER_UNIT_TO_CENTS} cents per unit)`,
    caveat: HUNTER_WATER_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      'Latest Hunter Water annual report discovered from the official reports-and-publications page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. The audited Income Statement prints an explicit $’000 unit. Total expenses is an explicit printed total and is accepted only when the printed revenue and expense components, the Note 3 operational-expenses subtotal and the profit-before-tax bridge reconcile exactly. The audited statement prints a one-dollar tax/NPAT arithmetic rounding; the printed NPAT is retained as the net-result line, is not used in any reconciliation, and is flagged for human spot-check. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add Hunter Water rows to government program spending, the PNFC benchmark, Sydney Water, WaterNSW, or each other.',
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);

  const connectors = SOC_SOURCE_IDS.map((id, index) => {
    const connector = getConnector(id);
    if (!connector) throw new Error(`unknown SOC source "${id}"`);
    const expected = index === 0 ? 'pnfc' : 'soc';
    if (connector.jurisdiction_level !== expected) {
      throw new Error(
        `${id} is ${connector.jurisdiction_level}-level; expected ${expected} in SOC_SOURCE_IDS order`,
      );
    }
    if (connector.status !== 'active') throw new Error(`${id} connector is ${connector.status}`);
    return connector;
  });

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    console.log(
      `[ingest:soc] target=${databaseName} sources=${connectors.map((entry) => entry.id).join(',')}`,
    );
    const result = await runIngestion({ connectors });
    for (const entry of result.results) {
      console.log(
        `[ingest:soc] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
    }

    // Persist archive metadata (never bytes) and refresh the committed manifests.
    for (const sourceId of SOC_SOURCE_IDS) {
      const archived = await listArchivedRecords({ source_id: sourceId });
      for (const record of archived) await persistArchivedRecord(record);
    }
    await writePnfcManifest();
    await writeSydneyWaterManifest();
    await writeWaterNswManifest();
    await writeHunterWaterManifest();

    const archived = await listArchivedRecords({ source_id: ABS_GFS_PNFC_ID });
    const total = await MeasureModel.countDocuments({ source_id: ABS_GFS_PNFC_ID });
    const byFlow = await MeasureModel.aggregate([
      { $match: { source_id: ABS_GFS_PNFC_ID } },
      { $group: { _id: '$gfs_flow', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const byJurisdiction = await MeasureModel.aggregate([
      { $match: { source_id: ABS_GFS_PNFC_ID } },
      {
        $group: {
          _id: { level: '$jurisdiction_level', jurisdiction: '$jurisdiction' },
          rows: { $sum: 1 },
        },
      },
      { $sort: { '_id.jurisdiction': 1 } },
    ]);
    const verified = await MeasureModel.countDocuments({
      source_id: ABS_GFS_PNFC_ID,
      verified: true,
      data_quality_flag: 'verified',
    });
    const benchmark = await MeasureModel.countDocuments({
      source_id: ABS_GFS_PNFC_ID,
      aggregation_role: 'benchmark',
    });
    console.log(
      `[ingest:soc] ${ABS_GFS_PNFC_ID} rows=${total} source_documents=${archived.length} verified=${verified} benchmark=${benchmark} (sector aggregate; no combined total is printed or computed)`,
    );
    for (const group of byFlow) {
      console.log(`[ingest:soc] ${ABS_GFS_PNFC_ID} flow=${group._id} rows=${group.rows}`);
    }
    for (const group of byJurisdiction) {
      console.log(
        `[ingest:soc] ${ABS_GFS_PNFC_ID} level=${group._id.level} jurisdiction=${group._id.jurisdiction} rows=${group.rows}`,
      );
    }
    const swRows = await MeasureModel.countDocuments({ source_id: SYDNEY_WATER_ID });
    const swVerified = await MeasureModel.countDocuments({
      source_id: SYDNEY_WATER_ID,
      verified: true,
    });
    const swDoubleCount = await MeasureModel.countDocuments({
      source_id: SYDNEY_WATER_ID,
      potential_double_count: true,
    });
    const swByLine = await MeasureModel.aggregate([
      { $match: { source_id: SYDNEY_WATER_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const swDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: SYDNEY_WATER_ID,
      status: 'deferred',
    });
    const swArchived = await listArchivedRecords({ source_id: SYDNEY_WATER_ID });
    console.log(
      `[ingest:soc] ${SYDNEY_WATER_ID} rows=${swRows} source_documents=${swArchived.length} verified=${swVerified} potential_double_count=${swDoubleCount} deferred_documents=${swDeferred} (entity-level SOC statement lines; no combined total is printed or computed)`,
    );
    for (const group of swByLine) {
      console.log(
        `[ingest:soc] ${SYDNEY_WATER_ID} line=${group._id ?? '(none)'} rows=${group.rows}`,
      );
    }
    const wnRows = await MeasureModel.countDocuments({ source_id: WATERNSW_ID });
    const wnVerified = await MeasureModel.countDocuments({
      source_id: WATERNSW_ID,
      verified: true,
    });
    const wnDoubleCount = await MeasureModel.countDocuments({
      source_id: WATERNSW_ID,
      potential_double_count: true,
    });
    const wnByLine = await MeasureModel.aggregate([
      { $match: { source_id: WATERNSW_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const wnDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: WATERNSW_ID,
      status: 'deferred',
    });
    const wnArchived = await listArchivedRecords({ source_id: WATERNSW_ID });
    console.log(
      `[ingest:soc] ${WATERNSW_ID} rows=${wnRows} source_documents=${wnArchived.length} verified=${wnVerified} potential_double_count=${wnDoubleCount} deferred_documents=${wnDeferred} (entity-level SOC statement lines; no combined total is printed or computed)`,
    );
    for (const group of wnByLine) {
      console.log(`[ingest:soc] ${WATERNSW_ID} line=${group._id ?? '(none)'} rows=${group.rows}`);
    }
    const hwRows = await MeasureModel.countDocuments({ source_id: HUNTER_WATER_ID });
    const hwVerified = await MeasureModel.countDocuments({
      source_id: HUNTER_WATER_ID,
      verified: true,
    });
    const hwDoubleCount = await MeasureModel.countDocuments({
      source_id: HUNTER_WATER_ID,
      potential_double_count: true,
    });
    const hwByLine = await MeasureModel.aggregate([
      { $match: { source_id: HUNTER_WATER_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const hwDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: HUNTER_WATER_ID,
      status: 'deferred',
    });
    const hwArchived = await listArchivedRecords({ source_id: HUNTER_WATER_ID });
    console.log(
      `[ingest:soc] ${HUNTER_WATER_ID} rows=${hwRows} source_documents=${hwArchived.length} verified=${hwVerified} potential_double_count=${hwDoubleCount} deferred_documents=${hwDeferred} (entity-level SOC statement lines; no combined total is printed or computed)`,
    );
    for (const group of hwByLine) {
      console.log(
        `[ingest:soc] ${HUNTER_WATER_ID} line=${group._id ?? '(none)'} rows=${group.rows}`,
      );
    }
    console.log(
      `[ingest:soc] future_soc_adapters=${FUTURE_SOC_SOURCE_IDS.length} (other NSW SOC adapters intentionally not implemented)`,
    );

    const failed = result.results.filter((entry) => entry.log_status === 'error').length;
    console.log(`[ingest:soc] done target=${databaseName} errored=${failed}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:soc] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
