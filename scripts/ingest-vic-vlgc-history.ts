import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  VIC_HISTORY_DEFERRED_YEARS,
  VIC_HISTORY_FISCAL_YEARS,
  VGC1_ID,
  VLGGC_ABS_ID,
  createVgc1HistoryConnector,
  createVlgcAbsHistoryConnector,
  findVicHistoryYear,
  loadVgc1HistoryYear,
  loadVlgcAbsHistoryYear,
  runIngestion,
  vgc1HistoryManifest,
  vlgcAbsHistoryManifest,
  type ArchivedSourceRecord,
  type RawRecord,
  type VicHistoryLoadOptions,
  type VlgcAbsHistoryLoadOptions,
} from '../server/src/connectors/index.js';
import { persistArchivedRecord } from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * VIC council pilot C — VLGGC VGC1/ABS1/ABS2-3 historical series.
 *
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev \
 *   VIC_HISTORY_YEARS=2019-20,2020-21,2021-22,2022-23,2023-24 \
 *   npm run ingest:vic-vlgc-history
 *
 * Defaults to all nine years whose schemas are verified (2015-16..2023-24).
 * The older generation is mapped explicitly (singular Family & Community
 * Service header; 144-column legacy ABS2 layout). Nothing is guessed or sampled.
 *
 * Every run is idempotent on natural_key (which includes fiscal_year), never
 * deletes, and never touches the 2024-25 pilot rows or any other source.
 */
export const VIC_HISTORY_SOURCE_IDS = [VGC1_ID, VLGGC_ABS_ID] as const;

function selectedYears(): string[] {
  const raw = process.env.VIC_HISTORY_YEARS?.trim();
  if (!raw) return [...VIC_HISTORY_FISCAL_YEARS];
  const years = raw
    .split(',')
    .map((year) => year.trim())
    .filter(Boolean);
  for (const year of years) {
    if (!VIC_HISTORY_FISCAL_YEARS.includes(year)) {
      throw new Error(
        `VIC_HISTORY_YEARS includes ${year}; supported historical years are ${VIC_HISTORY_FISCAL_YEARS.join(', ')}; deferred: ${VIC_HISTORY_DEFERRED_YEARS.join(', ')}`,
      );
    }
  }
  return years;
}

function vgc1Options(year: string): VicHistoryLoadOptions {
  const dir = process.env.VIC_HISTORY_DIR;
  return {
    ...(dir ? { sourcePath: path.join(dir, `${year}-VGC1.xlsx`) } : {}),
    ...(process.env.VIC_HISTORY_ARCHIVE_ROOT
      ? { archiveRoot: process.env.VIC_HISTORY_ARCHIVE_ROOT }
      : {}),
  };
}

function absOptions(year: string): VlgcAbsHistoryLoadOptions {
  const dir = process.env.VIC_HISTORY_DIR;
  return {
    ...(dir
      ? {
          abs1SourcePath: path.join(dir, `${year}-ABS1.xlsx`),
          abs23SourcePath: path.join(dir, `${year}-ABS23.xlsx`),
        }
      : {}),
    ...(process.env.VIC_HISTORY_ARCHIVE_ROOT
      ? { archiveRoot: process.env.VIC_HISTORY_ARCHIVE_ROOT }
      : {}),
  };
}

async function writeManifest(name: string, value: unknown): Promise<void> {
  const manifestPath = path.resolve('docs/source-archive', name);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`[ingest:vic-vlgc-history] manifest=docs/source-archive/${name}`);
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  const years = selectedYears();

  console.log(
    `[ingest:vic-vlgc-history] target=${databaseName} years=${years.join(',')} deferred=${VIC_HISTORY_DEFERRED_YEARS.join(',')}`,
  );
  console.log(
    '[ingest:vic-vlgc-history] VLGGC attribution/permission, NOT CC BY; derived rows only; workbooks not redistributed',
  );

  const vgc1Raw: RawRecord[] = [];
  const absRaw: RawRecord[] = [];
  const archives: ArchivedSourceRecord[] = [];
  const vgc1Records: Array<Awaited<ReturnType<typeof loadVgc1HistoryYear>>['records'][number]> = [];
  const absRecords: Array<Awaited<ReturnType<typeof loadVlgcAbsHistoryYear>>['records'][number]> =
    [];
  const vgc1Warnings: string[] = [];
  const absWarnings: string[] = [];

  for (const year of years) {
    const vgc1 = await loadVgc1HistoryYear(year, vgc1Options(year));
    vgc1Raw.push(...vgc1.raw);
    vgc1Records.push(...vgc1.records);
    archives.push(vgc1.archive);
    vgc1Warnings.push(`${year}: ${vgc1.warnings.join('; ')}`);

    const abs = await loadVlgcAbsHistoryYear(year, absOptions(year));
    absRaw.push(...abs.raw);
    absRecords.push(...abs.records);
    archives.push(...abs.archives);
    absWarnings.push(`${year}: ${abs.warnings.join('; ')}`);

    const descriptor = findVicHistoryYear(year);
    await writeManifest(`vic-vlgc-vgc1-${year}.json`, vgc1HistoryManifest(descriptor, vgc1));
    await writeManifest(`vic-vlgc-abs-${year}.json`, vlgcAbsHistoryManifest(descriptor, abs));
    console.log(
      `[ingest:vic-vlgc-history] ${year}: vgc1=${vgc1.records.length} abs=${abs.records.length} ` +
        `vgc1_totals_suppressed=${vgc1.summary.totalsSuppressed} abs_totals_suppressed=${abs.summary.totalsSuppressed}`,
    );
  }

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    const vgc1Connector = {
      ...createVgc1HistoryConnector(years),
      async fetch() {
        return vgc1Raw;
      },
    };
    const absConnector = {
      ...createVlgcAbsHistoryConnector(years),
      async fetch() {
        return absRaw;
      },
    };
    vgc1Connector.metadata.warnings = vgc1Warnings;
    absConnector.metadata.warnings = absWarnings;

    const result = await runIngestion({ connectors: [vgc1Connector, absConnector] });
    for (const entry of result.results) {
      console.log(
        `[ingest:vic-vlgc-history] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
      if (entry.errors.length > 0) {
        throw new Error(`${entry.source_id} ingestion failed: ${entry.errors.join('; ')}`);
      }
    }

    for (const archive of archives) await persistArchivedRecord(archive);

    for (const fiscalYear of years) {
      const vgc1Count = await MeasureModel.countDocuments({
        source_id: VGC1_ID,
        fiscal_year: fiscalYear,
      });
      const absCount = await MeasureModel.countDocuments({
        source_id: VLGGC_ABS_ID,
        fiscal_year: fiscalYear,
      });
      const vgc1Councils = await MeasureModel.distinct('delivery_entity', {
        source_id: VGC1_ID,
        fiscal_year: fiscalYear,
      });
      const absCouncils = await MeasureModel.distinct('delivery_entity', {
        source_id: VLGGC_ABS_ID,
        fiscal_year: fiscalYear,
      });
      console.log(
        `[ingest:vic-vlgc-history] db ${fiscalYear}: vgc1_rows=${vgc1Count} vgc1_councils=${vgc1Councils.length} ` +
          `abs_rows=${absCount} abs_councils=${absCouncils.length}`,
      );
    }

    const totalsEntities = await MeasureModel.countDocuments({
      source_id: { $in: [VGC1_ID, VLGGC_ABS_ID] },
      delivery_entity: { $regex: /^totals?$/i },
    });
    const allMeasures = await MeasureModel.countDocuments({});
    const vgc1All = await MeasureModel.countDocuments({ source_id: VGC1_ID });
    const absAll = await MeasureModel.countDocuments({ source_id: VLGGC_ABS_ID });
    console.log(
      `[ingest:vic-vlgc-history] db source_rows vgc1=${vgc1All} abs=${absAll} ` +
        `totals_entities=${totalsEntities} all_measures=${allMeasures}`,
    );
    if (totalsEntities !== 0) {
      throw new Error('source Totals entity found in the database; refusing to complete');
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    `[ingest:vic-vlgc-history] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
