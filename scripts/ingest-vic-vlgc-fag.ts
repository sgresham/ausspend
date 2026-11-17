import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  FAG_2023_24_REPORT,
  FAG_2024_25_REPORT,
  FAG_ID,
  createFagConnector,
  fagManifest,
  loadFagSources,
  runIngestion,
  type RawRecord,
} from '../server/src/connectors/index.js';
import { persistArchivedRecord } from '../server/src/connectors/source-archive.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * VIC grants overlay — VLGGC Commonwealth Financial Assistance Grants.
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   VIC_FAG_ARCHIVE_ROOT=/home/steve/ausspend-source-archive \
 *   npm run ingest:vic-vlgc-fag
 *
 * The 2024-25 report supplies the 2024-25 estimated allocation and the final
 * FY2023-24 adjustment. The 2023-24 report supplies the earlier estimated
 * FY2023-24 allocation, parsed only to prove final-minus-estimate equals the
 * published $864,120 adjustment. One printed total per council per year is
 * emitted (79 + 79); source Totals rows are suppressed and never published.
 * Every row is non-additive agency detail, potential_double_count=true, and
 * never added to VGC1/ABS spending or another grant source.
 */
export const FAG_SOURCE_IDS = [FAG_ID] as const;

async function writeManifest(name: string, value: unknown): Promise<void> {
  const manifestPath = path.resolve('docs/source-archive', name);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`[ingest:vic-vlgc-fag] manifest=docs/source-archive/${name}`);
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  console.log(`[ingest:vic-vlgc-fag] target=${databaseName} source=${FAG_ID}`);
  console.log(
    '[ingest:vic-vlgc-fag] report copyright page CC BY 3.0 AU (non-logo content); underlying VLGGC data collection attribution/permission, NOT CC BY; derived rows only; PDFs not redistributed',
  );

  const archiveRoot = process.env.VIC_FAG_ARCHIVE_ROOT;
  const loaded = await loadFagSources({
    ...(process.env.VIC_FAG_2024_25_PATH
      ? { source2024_25Path: process.env.VIC_FAG_2024_25_PATH }
      : {}),
    ...(process.env.VIC_FAG_2023_24_PATH
      ? { source2023_24Path: process.env.VIC_FAG_2023_24_PATH }
      : {}),
    ...(archiveRoot ? { archiveRoot } : {}),
  });

  const raw: RawRecord[] = loaded.raw;
  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    const base = createFagConnector();
    const connector = {
      ...base,
      async fetch() {
        base.metadata.warnings = loaded.warnings;
        return raw;
      },
    };
    const result = await runIngestion({ connectors: [connector] });
    for (const entry of result.results) {
      console.log(
        `[ingest:vic-vlgc-fag] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
      if (entry.errors.length > 0) {
        throw new Error(`${entry.source_id} ingestion failed: ${entry.errors.join('; ')}`);
      }
    }

    for (const archive of loaded.archives) await persistArchivedRecord(archive);

    await writeManifest(
      'vic-vlgc-fag-2024-25.json',
      fagManifest(FAG_2024_25_REPORT, 'rows', loaded.parsed.fy2024_25, {
        rows_emitted: loaded.parsed.fy2024_25.rows.length,
        dataset:
          'VLGGC Annual Allocation Report 2024-25 — Appendix 2A: 2024-25 estimated Financial Assistance Grants',
      }),
    );
    await writeManifest(
      'vic-vlgc-fag-2023-24-final.json',
      fagManifest(FAG_2024_25_REPORT, 'rows', loaded.parsed.fy2023_24_final, {
        rows_emitted: loaded.parsed.fy2023_24_final.rows.length,
        dataset:
          'VLGGC Annual Allocation Report 2024-25 — Appendix 1: 2023-24 final Financial Assistance Grants',
      }),
    );
    await writeManifest(
      'vic-vlgc-fag-2023-24.json',
      fagManifest(FAG_2023_24_REPORT, 'cross_check', loaded.parsed.fy2023_24_estimate, {
        rows_emitted: 0,
        final_total_from_2024_25: loaded.parsed.fy2023_24_final,
        dataset:
          'VLGGC Annual Allocation Report 2023-24 — Appendix 2A: 2023-24 estimated Financial Assistance Grants (cross-check only)',
      }),
    );

    const total = await MeasureModel.countDocuments({ source_id: FAG_ID });
    const councils = await MeasureModel.distinct('delivery_entity', { source_id: FAG_ID });
    const totalsEntity = await MeasureModel.countDocuments({
      source_id: FAG_ID,
      delivery_entity: { $regex: /^totals?$/i },
    });
    const byYear = await MeasureModel.aggregate([
      { $match: { source_id: FAG_ID } },
      { $group: { _id: '$fiscal_year', rows: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const allMeasures = await MeasureModel.countDocuments({});
    console.log(
      `[ingest:vic-vlgc-fag] db source_rows=${total} distinct_councils=${councils.length} ` +
        `totals_entities=${totalsEntity} all_measures=${allMeasures}`,
    );
    console.log(
      `[ingest:vic-vlgc-fag] by_year=${byYear
        .map((entry) => `${String(entry._id)}=${entry.rows}`)
        .join(',')}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:vic-vlgc-fag] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
