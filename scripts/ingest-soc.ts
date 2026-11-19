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
  ESSENTIAL_ENERGY_CAVEAT,
  ESSENTIAL_ENERGY_ENTITY,
  ESSENTIAL_ENERGY_ID,
  ESSENTIAL_ENERGY_JURISDICTION,
  ESSENTIAL_ENERGY_LICENSE,
  ESSENTIAL_ENERGY_NAME,
  ESSENTIAL_ENERGY_PUBLISHER,
  ESSENTIAL_ENERGY_SOURCE_URL,
  ESSENTIAL_ENERGY_UNIT,
  ESSENTIAL_ENERGY_UNIT_LABEL,
  ESSENTIAL_ENERGY_UNIT_TO_CENTS,
  ENERGY_QUEENSLAND_CAVEAT,
  ENERGY_QUEENSLAND_ENTITY,
  ENERGY_QUEENSLAND_ID,
  ENERGY_QUEENSLAND_JURISDICTION,
  ENERGY_QUEENSLAND_LEGAL_CLASS,
  ENERGY_QUEENSLAND_LICENSE,
  ENERGY_QUEENSLAND_NAME,
  ENERGY_QUEENSLAND_PARLIAMENT_FALLBACK_URL,
  ENERGY_QUEENSLAND_PUBLISHER,
  ENERGY_QUEENSLAND_SOURCE_URL,
  ENERGY_QUEENSLAND_UNIT,
  ENERGY_QUEENSLAND_UNIT_LABEL,
  ENERGY_QUEENSLAND_UNIT_TO_CENTS,
  CS_ENERGY_CAVEAT,
  CS_ENERGY_ENTITY,
  CS_ENERGY_ID,
  CS_ENERGY_JURISDICTION,
  CS_ENERGY_LEGAL_CLASS,
  CS_ENERGY_LICENSE,
  CS_ENERGY_NAME,
  CS_ENERGY_PUBLISHER,
  CS_ENERGY_SOURCE_URL,
  CS_ENERGY_UNIT,
  CS_ENERGY_UNIT_LABEL,
  CS_ENERGY_UNIT_TO_CENTS,
  STANWELL_CAVEAT,
  STANWELL_ENTITY,
  STANWELL_ID,
  STANWELL_JURISDICTION,
  STANWELL_LEGAL_CLASS,
  STANWELL_LICENSE,
  STANWELL_NAME,
  STANWELL_PUBLISHER,
  STANWELL_SOURCE_URL,
  STANWELL_UNIT,
  STANWELL_UNIT_LABEL,
  STANWELL_UNIT_TO_CENTS,
  POWERLINK_CAVEAT,
  POWERLINK_ENTITY,
  POWERLINK_ID,
  POWERLINK_JURISDICTION,
  POWERLINK_LEGAL_CLASS,
  POWERLINK_LICENSE,
  POWERLINK_NAME,
  POWERLINK_PUBLISHER,
  POWERLINK_SOURCE_URL,
  POWERLINK_UNIT,
  POWERLINK_UNIT_LABEL,
  POWERLINK_UNIT_TO_CENTS,
  SUNWATER_CAVEAT,
  SUNWATER_ENTITY,
  SUNWATER_ID,
  SUNWATER_JURISDICTION,
  SUNWATER_LEGAL_CLASS,
  SUNWATER_LICENSE,
  SUNWATER_NAME,
  SUNWATER_PUBLISHER,
  SUNWATER_SOURCE_URL,
  SUNWATER_UNIT,
  SUNWATER_UNIT_LABEL,
  SUNWATER_UNIT_TO_CENTS,
  FORESTRY_CORPORATION_CAVEAT,
  FORESTRY_CORPORATION_ENTITY,
  FORESTRY_CORPORATION_ID,
  FORESTRY_CORPORATION_JURISDICTION,
  FORESTRY_CORPORATION_LICENSE,
  FORESTRY_CORPORATION_NAME,
  FORESTRY_CORPORATION_PUBLISHER,
  FORESTRY_CORPORATION_SOURCE_URL,
  FORESTRY_CORPORATION_UNIT,
  FORESTRY_CORPORATION_UNIT_LABEL,
  FORESTRY_CORPORATION_UNIT_TO_CENTS,
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
  LANDCOM_CAVEAT,
  LANDCOM_ENTITY,
  LANDCOM_ID,
  LANDCOM_JURISDICTION,
  LANDCOM_LICENSE,
  LANDCOM_NAME,
  LANDCOM_PUBLISHER,
  LANDCOM_SOURCE_URL,
  LANDCOM_UNIT,
  LANDCOM_UNIT_LABEL,
  LANDCOM_UNIT_TO_CENTS,
  PORT_AUTHORITY_CAVEAT,
  PORT_AUTHORITY_ENTITY,
  PORT_AUTHORITY_ID,
  PORT_AUTHORITY_JURISDICTION,
  PORT_AUTHORITY_LICENSE,
  PORT_AUTHORITY_NAME,
  PORT_AUTHORITY_PUBLISHER,
  PORT_AUTHORITY_SOURCE_URL,
  PORT_AUTHORITY_UNIT,
  PORT_AUTHORITY_UNIT_LABEL,
  PORT_AUTHORITY_UNIT_TO_CENTS,
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
  SYDNEY_TRAINS_CAVEAT,
  SYDNEY_TRAINS_ENTITY,
  SYDNEY_TRAINS_ID,
  SYDNEY_TRAINS_JURISDICTION,
  SYDNEY_TRAINS_LICENSE,
  SYDNEY_TRAINS_NAME,
  SYDNEY_TRAINS_PUBLISHER,
  SYDNEY_TRAINS_SOURCE_URL,
  SYDNEY_TRAINS_UNIT,
  SYDNEY_TRAINS_UNIT_LABEL,
  SYDNEY_TRAINS_UNIT_TO_CENTS,
  NSW_TRAINLINK_CAVEAT,
  NSW_TRAINLINK_ENTITY,
  NSW_TRAINLINK_ID,
  NSW_TRAINLINK_JURISDICTION,
  NSW_TRAINLINK_LICENSE,
  NSW_TRAINLINK_NAME,
  NSW_TRAINLINK_PUBLISHER,
  NSW_TRAINLINK_SOURCE_URL,
  NSW_TRAINLINK_UNIT,
  NSW_TRAINLINK_UNIT_LABEL,
  NSW_TRAINLINK_UNIT_TO_CENTS,
  TAHE_CAVEAT,
  TAHE_ENTITY,
  TAHE_ID,
  TAHE_JURISDICTION,
  TAHE_LICENSE,
  TAHE_NAME,
  TAHE_PUBLISHER,
  TAHE_SOURCE_URL,
  TAHE_UNIT,
  TAHE_UNIT_LABEL,
  TAHE_UNIT_TO_CENTS,
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
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev \
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
 * per-entity adapters (Sydney Water, WaterNSW, Hunter Water, Essential Energy,
 * Forestry Corporation of NSW, Landcom, Port Authority of NSW, TAHE, Sydney
 * Trains, then NSW TrainLink, then the QLD GOCs Energy Queensland, CS Energy,
 * Stanwell, Powerlink Queensland and Sunwater Limited). No other SOC adapter is implemented, and
 * the entity adapters are never summed together.
 */
export const SOC_SOURCE_IDS = [
  ABS_GFS_PNFC_ID,
  SYDNEY_WATER_ID,
  WATERNSW_ID,
  HUNTER_WATER_ID,
  ESSENTIAL_ENERGY_ID,
  FORESTRY_CORPORATION_ID,
  LANDCOM_ID,
  PORT_AUTHORITY_ID,
  TAHE_ID,
  SYDNEY_TRAINS_ID,
  NSW_TRAINLINK_ID,
  ENERGY_QUEENSLAND_ID,
  CS_ENERGY_ID,
  STANWELL_ID,
  POWERLINK_ID,
  SUNWATER_ID,
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

async function writeEssentialEnergyManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: ESSENTIAL_ENERGY_ID });
  const manifestPath = path.resolve(
    process.env.ESSENTIAL_ENERGY_MANIFEST ??
      'docs/source-archive/essential-energy-annual-report.json',
  );
  const manifest = {
    entity: ESSENTIAL_ENERGY_ENTITY,
    jurisdiction: ESSENTIAL_ENERGY_JURISDICTION,
    dataset: ESSENTIAL_ENERGY_NAME,
    publisher: ESSENTIAL_ENERGY_PUBLISHER,
    discovery_page: ESSENTIAL_ENERGY_SOURCE_URL,
    license: ESSENTIAL_ENERGY_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${ESSENTIAL_ENERGY_UNIT_LABEL} (${ESSENTIAL_ENERGY_UNIT}; x${ESSENTIAL_ENERGY_UNIT_TO_CENTS} cents per unit)`,
    caveat: ESSENTIAL_ENERGY_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      'Latest Essential Energy annual report discovered from the official annual-report page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. The consolidated statement of comprehensive income prints an explicit $M unit. Because the statement has no single printed Total expenses subtotal, total expenses is the exact sum of the printed expense lines (pass through costs, operating expenses, loss on disposal/write-off, depreciation/amortisation/impairment and net finance costs) and is accepted only when the revenue, EBITDA/EBIT, expense-component and profit-before-tax/net-result bridges reconcile exactly. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add Essential Energy rows to government program spending, the PNFC benchmark, or any other SOC.',
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeForestryCorporationManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: FORESTRY_CORPORATION_ID });
  const manifestPath = path.resolve(
    process.env.FORESTRY_CORPORATION_MANIFEST ??
      'docs/source-archive/forestry-corporation-annual-report.json',
  );
  const manifest = {
    entity: FORESTRY_CORPORATION_ENTITY,
    jurisdiction: FORESTRY_CORPORATION_JURISDICTION,
    dataset: FORESTRY_CORPORATION_NAME,
    publisher: FORESTRY_CORPORATION_PUBLISHER,
    discovery_page: FORESTRY_CORPORATION_SOURCE_URL,
    license: FORESTRY_CORPORATION_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${FORESTRY_CORPORATION_UNIT_LABEL} (${FORESTRY_CORPORATION_UNIT}; x${FORESTRY_CORPORATION_UNIT_TO_CENTS} cents per unit)`,
    caveat: FORESTRY_CORPORATION_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "Latest Forestry Corporation of NSW annual report discovered from the official annual-report page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. The statement of profit or loss and other comprehensive income prints an explicit $'000 unit. Total expenses is the explicit printed subtotal and is accepted only when the four printed expense lines, Note 5 Other income, Note 8 Other operating expenses, Note 9 Employee benefits, Note 10 Finance costs and the profit-before-tax/net-result bridges reconcile exactly. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add Forestry Corporation rows to government program spending, the PNFC benchmark, or any other SOC.",
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeLandcomManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: LANDCOM_ID });
  const manifestPath = path.resolve(
    process.env.LANDCOM_MANIFEST ?? 'docs/source-archive/landcom-annual-report.json',
  );
  const manifest = {
    entity: LANDCOM_ENTITY,
    jurisdiction: LANDCOM_JURISDICTION,
    dataset: LANDCOM_NAME,
    publisher: LANDCOM_PUBLISHER,
    discovery_page: LANDCOM_SOURCE_URL,
    license: LANDCOM_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${LANDCOM_UNIT_LABEL} (${LANDCOM_UNIT}; x${LANDCOM_UNIT_TO_CENTS} cents per unit)`,
    caveat: LANDCOM_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "Latest Landcom annual report discovered from the official corporate-publications page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. The Statement of Comprehensive Income prints an explicit $'000 unit but no single Total revenue or Total expenses subtotal. Total revenue is the exact signed sum of the printed revenue lines (revenue from contracts with customers + other income + finance income) and total expenses is the exact signed sum of the printed expense lines (cost of sales + employee related expenses + other expenses + depreciation and amortisation + net fair value loss on investment properties + finance costs); both are accepted only when the gross-profit, profit-before-tax, net-result and Note 2.2/2.3/2.4/2.5/2.6 bridges reconcile exactly. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add Landcom rows to government program spending, the PNFC benchmark, or any other SOC.",
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writePortAuthorityManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: PORT_AUTHORITY_ID });
  const manifestPath = path.resolve(
    process.env.PORT_AUTHORITY_MANIFEST ?? 'docs/source-archive/port-authority-annual-report.json',
  );
  const manifest = {
    entity: PORT_AUTHORITY_ENTITY,
    jurisdiction: PORT_AUTHORITY_JURISDICTION,
    dataset: PORT_AUTHORITY_NAME,
    publisher: PORT_AUTHORITY_PUBLISHER,
    discovery_page: PORT_AUTHORITY_SOURCE_URL,
    license: PORT_AUTHORITY_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${PORT_AUTHORITY_UNIT_LABEL} (${PORT_AUTHORITY_UNIT}; x${PORT_AUTHORITY_UNIT_TO_CENTS} cents per unit)`,
    caveat: PORT_AUTHORITY_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "Latest Port Authority of NSW annual report discovered from the official annual-reports page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. The Statement of comprehensive income prints an explicit $'000 unit and explicit Total revenue and Total expenses subtotals. Both printed totals are accepted only when the printed revenue and expense lines, the profit-before-tax bridge (including net gain on sale of PPE and other gains), the net-result bridge and the Note 3/Note 4 printed totals reconcile exactly. No government grants/contributions are separately disclosed, so no grant row is emitted. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add Port Authority of NSW rows to government program spending, the PNFC benchmark, or any other SOC.",
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeTaheManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: TAHE_ID });
  const manifestPath = path.resolve(
    process.env.TAHE_MANIFEST ?? 'docs/source-archive/tahe-annual-report.json',
  );
  const manifest = {
    entity: TAHE_ENTITY,
    jurisdiction: TAHE_JURISDICTION,
    dataset: TAHE_NAME,
    publisher: TAHE_PUBLISHER,
    discovery_page: TAHE_SOURCE_URL,
    license: TAHE_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${TAHE_UNIT_LABEL} (${TAHE_UNIT}; x${TAHE_UNIT_TO_CENTS} cents per unit)`,
    caveat: TAHE_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "Latest TAHE (Transport Asset Holding Entity of New South Wales) annual report discovered from the official TAHE publications page now served by Transport Asset Manager (TAM) of NSW (no hard-coded PDF URL) and archived with SHA-256 outside the repo. The audited Statement of comprehensive income prints an explicit $'000 unit and explicit Total revenue and Total expenses subtotals. Both printed totals are accepted only when the printed revenue and expense lines (including an explicitly printed nil valuation decrement) and the net-result bridge reconcile exactly. Grants and contributions are separately disclosed, so one grant row carries potential_double_count=true. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add TAHE rows to government program spending, the PNFC benchmark, or any other SOC.",
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeSydneyTrainsManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: SYDNEY_TRAINS_ID });
  const manifestPath = path.resolve(
    process.env.SYDNEY_TRAINS_MANIFEST ?? 'docs/source-archive/sydney-trains-annual-report.json',
  );
  const manifest = {
    entity: SYDNEY_TRAINS_ENTITY,
    jurisdiction: SYDNEY_TRAINS_JURISDICTION,
    dataset: SYDNEY_TRAINS_NAME,
    publisher: SYDNEY_TRAINS_PUBLISHER,
    discovery_page: SYDNEY_TRAINS_SOURCE_URL,
    license: SYDNEY_TRAINS_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${SYDNEY_TRAINS_UNIT_LABEL} (${SYDNEY_TRAINS_UNIT}; x${SYDNEY_TRAINS_UNIT_TO_CENTS} cents per unit)`,
    caveat: SYDNEY_TRAINS_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "Latest Sydney Trains annual report discovered from the official Transport for NSW Sydney Trains annual-reports page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. Sydney Trains publishes two volumes; the audited Statement of comprehensive income is in Volume 2, so discovery selects the latest report year's financial-statements volume. The statement prints an explicit $'000 unit and explicit Total revenue and Total expenses excluding losses subtotals. Both printed totals are accepted only when the printed revenue lines, expense lines, deficit-before-grants bridge, operations-result bridge (adding Grants and contributions) and net-result bridge (adding gains/losses on disposal, other gains/losses and impairment reversals) reconcile exactly. Grants and contributions are separately disclosed, so one grant row carries potential_double_count=true. The published Volume 2 PDF carries a 'Draft for year end June 2025' footer even though it includes the signed Chief Executive statement and signed independent auditor's report; that provenance caveat is recorded and two lines are flagged for human spot-check. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add Sydney Trains rows to government program spending, the PNFC benchmark, or any other SOC.",
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeNswTrainlinkManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: NSW_TRAINLINK_ID });
  const manifestPath = path.resolve(
    process.env.NSW_TRAINLINK_MANIFEST ?? 'docs/source-archive/nsw-trainlink-annual-report.json',
  );
  const manifest = {
    entity: NSW_TRAINLINK_ENTITY,
    legal_entity: 'NSW Trains',
    jurisdiction: NSW_TRAINLINK_JURISDICTION,
    dataset: NSW_TRAINLINK_NAME,
    publisher: NSW_TRAINLINK_PUBLISHER,
    discovery_page: NSW_TRAINLINK_SOURCE_URL,
    license: NSW_TRAINLINK_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${NSW_TRAINLINK_UNIT_LABEL} (${NSW_TRAINLINK_UNIT}; x${NSW_TRAINLINK_UNIT_TO_CENTS} cents per unit)`,
    caveat: NSW_TRAINLINK_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "Latest NSW TrainLink annual report discovered from the official Transport for NSW NSW TrainLink annual-reports page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. NSW TrainLink publishes two volumes; the audited Statement of comprehensive income is in Volume 2, so discovery selects the latest report year's financial-statements volume. The statement prints an explicit $'000 unit and explicit Total revenue and Total expenses excluding losses subtotals. Both printed totals are accepted only when the printed revenue lines, expense lines, deficit-before-grants bridge, operations-result bridge (adding Grants and contributions) and net-result bridge (adding gains/losses on disposal and impairment reversals) reconcile exactly. Grants and contributions are separately disclosed in Note 2(c), so one grant row carries potential_double_count=true. The annual report is branded NSW TrainLink but the audited statement is for the legal entity NSW Trains; that provenance caveat is recorded and two lines are flagged for human spot-check. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add NSW TrainLink rows to government program spending, the PNFC benchmark, or any other SOC.",
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeEnergyQueenslandManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: ENERGY_QUEENSLAND_ID });
  const manifestPath = path.resolve(
    process.env.ENERGY_QUEENSLAND_MANIFEST ??
      'docs/source-archive/qld-energy-queensland-annual-report.json',
  );
  const manifest = {
    entity: ENERGY_QUEENSLAND_ENTITY,
    legal_class: ENERGY_QUEENSLAND_LEGAL_CLASS,
    jurisdiction: ENERGY_QUEENSLAND_JURISDICTION,
    dataset: ENERGY_QUEENSLAND_NAME,
    publisher: ENERGY_QUEENSLAND_PUBLISHER,
    discovery_page: ENERGY_QUEENSLAND_SOURCE_URL,
    fallback_page: ENERGY_QUEENSLAND_PARLIAMENT_FALLBACK_URL,
    license: ENERGY_QUEENSLAND_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${ENERGY_QUEENSLAND_UNIT_LABEL} (${ENERGY_QUEENSLAND_UNIT}; x${ENERGY_QUEENSLAND_UNIT_TO_CENTS} cents per unit)`,
    caveat: ENERGY_QUEENSLAND_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "QLD SOC pilot: Energy Queensland Limited only. Discovery first tries Energy Queensland's official corporate-reports page; that site returns a Cloudflare HTML challenge (HTTP 403) from the ingestion host, so the verified Queensland Parliament tabled-paper copy is the documented fallback. The consolidated statement of profit or loss prints an explicit $m unit. The statement has no printed Total expenses subtotal, so total expenses is the exact sum of the printed expense lines and is accepted only when it equals the Directors' report printed total and the printed loss-before-tax and net-result bridges reconcile exactly. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add Energy Queensland rows to government program spending, the PNFC benchmark, another QLD GOC, a QLD total, or any other SOC.",
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeCsEnergyManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: CS_ENERGY_ID });
  const manifestPath = path.resolve(
    process.env.CS_ENERGY_MANIFEST ?? 'docs/source-archive/qld-cs-energy-annual-report.json',
  );
  const manifest = {
    entity: CS_ENERGY_ENTITY,
    legal_class: CS_ENERGY_LEGAL_CLASS,
    jurisdiction: CS_ENERGY_JURISDICTION,
    dataset: CS_ENERGY_NAME,
    publisher: CS_ENERGY_PUBLISHER,
    discovery_page: CS_ENERGY_SOURCE_URL,
    license: CS_ENERGY_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${CS_ENERGY_UNIT_LABEL} (${CS_ENERGY_UNIT}; x${CS_ENERGY_UNIT_TO_CENTS} cents per unit)`,
    caveat: CS_ENERGY_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "QLD SOC: CS Energy Limited only. Latest annual report discovered from CS Energy's official annual-reports page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. The consolidated statement prints an explicit $'000 unit; it has no printed Total revenue or Total expenses subtotal, so total revenue is the exact sum of Revenue + Interest income + Other income and total expenses is the exact sum of the printed expense lines plus Loss on disposed assets. Both are accepted only when they bridge to the printed Loss before income tax expense and Loss after income tax expense for the year with zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add CS Energy rows to government program spending, the PNFC benchmark, Energy Queensland, another QLD GOC, a QLD total, or any other SOC.",
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeStanwellManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: STANWELL_ID });
  const manifestPath = path.resolve(
    process.env.STANWELL_MANIFEST ?? 'docs/source-archive/qld-stanwell-annual-report.json',
  );
  const manifest = {
    entity: STANWELL_ENTITY,
    legal_class: STANWELL_LEGAL_CLASS,
    jurisdiction: STANWELL_JURISDICTION,
    dataset: STANWELL_NAME,
    publisher: STANWELL_PUBLISHER,
    discovery_page: STANWELL_SOURCE_URL,
    license: STANWELL_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${STANWELL_UNIT_LABEL} (${STANWELL_UNIT}; x${STANWELL_UNIT_TO_CENTS} cents per unit)`,
    caveat: STANWELL_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "QLD SOC: Stanwell Corporation Limited only. Latest annual report discovered from Stanwell's official publication pages (no hard-coded PDF URL; the canonical /about-us/publications page returns HTTP 404 and discovery falls back to the live official /about-us and /information-publication-scheme pages) and archived with SHA-256 outside the repo. The consolidated statement prints an explicit $’000 unit; it has no printed Total revenue or Total expenses subtotal, so total revenue is the exact sum of Revenue and other income + Finance income and total expenses is the exact sum of the printed expense lines net of the printed Expected credit loss (expense)/reversal and the nil Impairment reversal. Both are accepted only when they bridge to the printed Profit/(loss) before income tax equivalent and Profit/(loss) after income tax equivalent for the year with zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add Stanwell rows to government program spending, the PNFC benchmark, Energy Queensland, CS Energy, another QLD GOC, a QLD total, or any other SOC.",
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writePowerlinkManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: POWERLINK_ID });
  const manifestPath = path.resolve(
    process.env.POWERLINK_MANIFEST ?? 'docs/source-archive/qld-powerlink-annual-report.json',
  );
  const manifest = {
    entity: POWERLINK_ENTITY,
    legal_class: POWERLINK_LEGAL_CLASS,
    jurisdiction: POWERLINK_JURISDICTION,
    dataset: POWERLINK_NAME,
    publisher: POWERLINK_PUBLISHER,
    discovery_page: POWERLINK_SOURCE_URL,
    license: POWERLINK_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${POWERLINK_UNIT_LABEL} (${POWERLINK_UNIT}; x${POWERLINK_UNIT_TO_CENTS} cents per unit)`,
    caveat: POWERLINK_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "QLD SOC: Powerlink Queensland only (Queensland Electricity Transmission Corporation Limited, a Queensland Government Owned Corporation). Latest annual report discovered from Powerlink's official reports page (no hard-coded PDF URL; the reports page lists annual-report landing pages and the newest page carries the PDF) and archived with SHA-256 outside the repo. The consolidated statement prints an explicit $'000 unit; it has no printed Total revenue or Total expenses subtotal, so total revenue is the exact sum of Revenue + Other gains/(losses) + Finance income and total expenses is the exact sum of Expenses from continuing operations + Impairment losses + Finance costs. Both are accepted only when they bridge to the printed PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT and PROFIT/(LOSS) FOR THE YEAR with zero tolerance; Note 3's five components separately reconcile to the face statement. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add Powerlink rows to government program spending, the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, another QLD GOC, a QLD total, or any other SOC.",
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[ingest:soc] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
  );
}

async function writeSunwaterManifest(): Promise<void> {
  const records = await listArchivedRecords({ source_id: SUNWATER_ID });
  const manifestPath = path.resolve(
    process.env.SUNWATER_MANIFEST ?? 'docs/source-archive/qld-sunwater-annual-report.json',
  );
  const manifest = {
    entity: SUNWATER_ENTITY,
    legal_class: SUNWATER_LEGAL_CLASS,
    jurisdiction: SUNWATER_JURISDICTION,
    dataset: SUNWATER_NAME,
    publisher: SUNWATER_PUBLISHER,
    discovery_page: SUNWATER_SOURCE_URL,
    license: SUNWATER_LICENSE,
    retrieved_at: new Date().toISOString(),
    unit: `${SUNWATER_UNIT_LABEL} (${SUNWATER_UNIT}; x${SUNWATER_UNIT_TO_CENTS} cents per unit)`,
    caveat: SUNWATER_CAVEAT,
    files: records.map((record) => ({
      title: record.title,
      filename: path.basename(record.local_path),
      url: record.original_url,
      sha256: record.sha256,
      bytes: record.bytes,
      archived_from: record.archived_from,
    })),
    notes:
      "QLD SOC: Sunwater Limited only, a Queensland Government Owned Corporation. Latest annual report discovered from Sunwater's official publications page (no hard-coded PDF URL) and archived with SHA-256 outside the repo. The consolidated statement prints an explicit $'000 unit; it prints Total revenue and other income but no Total expenses subtotal, so total expenses is the exact sum of Operating expenditure + Employee benefits + Depreciation and amortisation + Impairment of assets + Loss on disposal of assets. It is accepted only when it bridges to the printed Operating profit, Profit before income tax and Profit for the year with zero tolerance; Employee benefits also reconciles exactly to Note 3B. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level=soc, aggregation_role=agency_detail); never add Sunwater rows to government program spending, the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, another QLD GOC, a QLD total, or any other SOC.",
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
    await writeEssentialEnergyManifest();
    await writeForestryCorporationManifest();
    await writeLandcomManifest();
    await writePortAuthorityManifest();
    await writeTaheManifest();
    await writeSydneyTrainsManifest();
    await writeNswTrainlinkManifest();
    await writeEnergyQueenslandManifest();
    await writeCsEnergyManifest();
    await writeStanwellManifest();
    await writePowerlinkManifest();
    await writeSunwaterManifest();

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
    const eeRows = await MeasureModel.countDocuments({ source_id: ESSENTIAL_ENERGY_ID });
    const eeVerified = await MeasureModel.countDocuments({
      source_id: ESSENTIAL_ENERGY_ID,
      verified: true,
    });
    const eeDoubleCount = await MeasureModel.countDocuments({
      source_id: ESSENTIAL_ENERGY_ID,
      potential_double_count: true,
    });
    const eeByLine = await MeasureModel.aggregate([
      { $match: { source_id: ESSENTIAL_ENERGY_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const eeDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: ESSENTIAL_ENERGY_ID,
      status: 'deferred',
    });
    const eeArchived = await listArchivedRecords({ source_id: ESSENTIAL_ENERGY_ID });
    console.log(
      `[ingest:soc] ${ESSENTIAL_ENERGY_ID} rows=${eeRows} source_documents=${eeArchived.length} verified=${eeVerified} potential_double_count=${eeDoubleCount} deferred_documents=${eeDeferred} (entity-level SOC statement lines; no combined total is printed or computed)`,
    );
    for (const group of eeByLine) {
      console.log(
        `[ingest:soc] ${ESSENTIAL_ENERGY_ID} line=${group._id ?? '(none)'} rows=${group.rows}`,
      );
    }
    const fcRows = await MeasureModel.countDocuments({ source_id: FORESTRY_CORPORATION_ID });
    const fcVerified = await MeasureModel.countDocuments({
      source_id: FORESTRY_CORPORATION_ID,
      verified: true,
    });
    const fcDoubleCount = await MeasureModel.countDocuments({
      source_id: FORESTRY_CORPORATION_ID,
      potential_double_count: true,
    });
    const fcByLine = await MeasureModel.aggregate([
      { $match: { source_id: FORESTRY_CORPORATION_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const fcDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: FORESTRY_CORPORATION_ID,
      status: 'deferred',
    });
    const fcArchived = await listArchivedRecords({ source_id: FORESTRY_CORPORATION_ID });
    console.log(
      `[ingest:soc] ${FORESTRY_CORPORATION_ID} rows=${fcRows} source_documents=${fcArchived.length} verified=${fcVerified} potential_double_count=${fcDoubleCount} deferred_documents=${fcDeferred} (entity-level SOC statement lines; no combined total is printed or computed)`,
    );
    for (const group of fcByLine) {
      console.log(
        `[ingest:soc] ${FORESTRY_CORPORATION_ID} line=${group._id ?? '(none)'} rows=${group.rows}`,
      );
    }
    const lcRows = await MeasureModel.countDocuments({ source_id: LANDCOM_ID });
    const lcVerified = await MeasureModel.countDocuments({
      source_id: LANDCOM_ID,
      verified: true,
    });
    const lcDoubleCount = await MeasureModel.countDocuments({
      source_id: LANDCOM_ID,
      potential_double_count: true,
    });
    const lcByLine = await MeasureModel.aggregate([
      { $match: { source_id: LANDCOM_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const lcDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: LANDCOM_ID,
      status: 'deferred',
    });
    const lcArchived = await listArchivedRecords({ source_id: LANDCOM_ID });
    console.log(
      `[ingest:soc] ${LANDCOM_ID} rows=${lcRows} source_documents=${lcArchived.length} verified=${lcVerified} potential_double_count=${lcDoubleCount} deferred_documents=${lcDeferred} (entity-level SOC statement lines; no combined total is printed or computed)`,
    );
    for (const group of lcByLine) {
      console.log(`[ingest:soc] ${LANDCOM_ID} line=${group._id ?? '(none)'} rows=${group.rows}`);
    }
    const ntlRows = await MeasureModel.countDocuments({ source_id: NSW_TRAINLINK_ID });
    const ntlVerified = await MeasureModel.countDocuments({
      source_id: NSW_TRAINLINK_ID,
      verified: true,
    });
    const ntlDoubleCount = await MeasureModel.countDocuments({
      source_id: NSW_TRAINLINK_ID,
      potential_double_count: true,
    });
    const ntlByLine = await MeasureModel.aggregate([
      { $match: { source_id: NSW_TRAINLINK_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const ntlDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: NSW_TRAINLINK_ID,
      status: 'deferred',
    });
    const ntlArchived = await listArchivedRecords({ source_id: NSW_TRAINLINK_ID });
    console.log(
      `[ingest:soc] ${NSW_TRAINLINK_ID} rows=${ntlRows} source_documents=${ntlArchived.length} verified=${ntlVerified} potential_double_count=${ntlDoubleCount} deferred_documents=${ntlDeferred} (entity-level SOC statement lines; no combined total is printed or computed)`,
    );
    for (const group of ntlByLine) {
      console.log(
        `[ingest:soc] ${NSW_TRAINLINK_ID} line=${group._id ?? '(none)'} rows=${group.rows}`,
      );
    }
    const eqRows = await MeasureModel.countDocuments({ source_id: ENERGY_QUEENSLAND_ID });
    const eqVerified = await MeasureModel.countDocuments({
      source_id: ENERGY_QUEENSLAND_ID,
      verified: true,
    });
    const eqDoubleCount = await MeasureModel.countDocuments({
      source_id: ENERGY_QUEENSLAND_ID,
      potential_double_count: true,
    });
    const eqByLine = await MeasureModel.aggregate([
      { $match: { source_id: ENERGY_QUEENSLAND_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const eqDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: ENERGY_QUEENSLAND_ID,
      status: 'deferred',
    });
    const eqArchived = await listArchivedRecords({ source_id: ENERGY_QUEENSLAND_ID });
    console.log(
      `[ingest:soc] ${ENERGY_QUEENSLAND_ID} rows=${eqRows} source_documents=${eqArchived.length} verified=${eqVerified} potential_double_count=${eqDoubleCount} deferred_documents=${eqDeferred} (QLD entity-level SOC statement lines; no QLD total and no combined total is printed or computed)`,
    );
    for (const group of eqByLine) {
      console.log(
        `[ingest:soc] ${ENERGY_QUEENSLAND_ID} line=${group._id ?? '(none)'} rows=${group.rows}`,
      );
    }
    const csRows = await MeasureModel.countDocuments({ source_id: CS_ENERGY_ID });
    const csVerified = await MeasureModel.countDocuments({
      source_id: CS_ENERGY_ID,
      verified: true,
    });
    const csDoubleCount = await MeasureModel.countDocuments({
      source_id: CS_ENERGY_ID,
      potential_double_count: true,
    });
    const csByLine = await MeasureModel.aggregate([
      { $match: { source_id: CS_ENERGY_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const csDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: CS_ENERGY_ID,
      status: 'deferred',
    });
    const csArchived = await listArchivedRecords({ source_id: CS_ENERGY_ID });
    console.log(
      `[ingest:soc] ${CS_ENERGY_ID} rows=${csRows} source_documents=${csArchived.length} verified=${csVerified} potential_double_count=${csDoubleCount} deferred_documents=${csDeferred} (QLD entity-level SOC statement lines; no QLD total and no combined total is printed or computed)`,
    );
    for (const group of csByLine) {
      console.log(`[ingest:soc] ${CS_ENERGY_ID} line=${group._id ?? '(none)'} rows=${group.rows}`);
    }
    const stanRows = await MeasureModel.countDocuments({ source_id: STANWELL_ID });
    const stanVerified = await MeasureModel.countDocuments({
      source_id: STANWELL_ID,
      verified: true,
    });
    const stanDoubleCount = await MeasureModel.countDocuments({
      source_id: STANWELL_ID,
      potential_double_count: true,
    });
    const stanByLine = await MeasureModel.aggregate([
      { $match: { source_id: STANWELL_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const stanDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: STANWELL_ID,
      status: 'deferred',
    });
    const stanArchived = await listArchivedRecords({ source_id: STANWELL_ID });
    console.log(
      `[ingest:soc] ${STANWELL_ID} rows=${stanRows} source_documents=${stanArchived.length} verified=${stanVerified} potential_double_count=${stanDoubleCount} deferred_documents=${stanDeferred} (QLD entity-level SOC statement lines; no QLD total and no combined total is printed or computed)`,
    );
    for (const group of stanByLine) {
      console.log(`[ingest:soc] ${STANWELL_ID} line=${group._id ?? '(none)'} rows=${group.rows}`);
    }
    const powerlinkRows = await MeasureModel.countDocuments({ source_id: POWERLINK_ID });
    const powerlinkVerified = await MeasureModel.countDocuments({
      source_id: POWERLINK_ID,
      verified: true,
    });
    const powerlinkDoubleCount = await MeasureModel.countDocuments({
      source_id: POWERLINK_ID,
      potential_double_count: true,
    });
    const powerlinkByLine = await MeasureModel.aggregate([
      { $match: { source_id: POWERLINK_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const powerlinkDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: POWERLINK_ID,
      status: 'deferred',
    });
    const powerlinkArchived = await listArchivedRecords({ source_id: POWERLINK_ID });
    console.log(
      `[ingest:soc] ${POWERLINK_ID} rows=${powerlinkRows} source_documents=${powerlinkArchived.length} verified=${powerlinkVerified} potential_double_count=${powerlinkDoubleCount} deferred_documents=${powerlinkDeferred} (QLD entity-level SOC statement lines; no QLD total and no combined total is printed or computed)`,
    );
    for (const group of powerlinkByLine) {
      console.log(`[ingest:soc] ${POWERLINK_ID} line=${group._id ?? '(none)'} rows=${group.rows}`);
    }
    const sunwaterRows = await MeasureModel.countDocuments({ source_id: SUNWATER_ID });
    const sunwaterVerified = await MeasureModel.countDocuments({
      source_id: SUNWATER_ID,
      verified: true,
    });
    const sunwaterDoubleCount = await MeasureModel.countDocuments({
      source_id: SUNWATER_ID,
      potential_double_count: true,
    });
    const sunwaterByLine = await MeasureModel.aggregate([
      { $match: { source_id: SUNWATER_ID } },
      { $group: { _id: '$soc_line_item', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const sunwaterDeferred = await DeferredSocDocumentModel.countDocuments({
      source_id: SUNWATER_ID,
      status: 'deferred',
    });
    const sunwaterArchived = await listArchivedRecords({ source_id: SUNWATER_ID });
    console.log(
      `[ingest:soc] ${SUNWATER_ID} rows=${sunwaterRows} source_documents=${sunwaterArchived.length} verified=${sunwaterVerified} potential_double_count=${sunwaterDoubleCount} deferred_documents=${sunwaterDeferred} (QLD entity-level SOC statement lines; no QLD total and no combined total is printed or computed)`,
    );
    for (const group of sunwaterByLine) {
      console.log(`[ingest:soc] ${SUNWATER_ID} line=${group._id ?? '(none)'} rows=${group.rows}`);
    }
    console.log(
      `[ingest:soc] future_soc_adapters=${FUTURE_SOC_SOURCE_IDS.length} (other NSW and QLD SOC adapters intentionally not implemented)`,
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
