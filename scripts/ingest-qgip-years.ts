import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  QGIP_ATTRIBUTION,
  QGIP_DATASET,
  QGIP_EARLIER_YEARS,
  QGIP_FISCAL_YEAR,
  QGIP_ID,
  QGIP_LICENSE,
  QGIP_PARTIAL_YEARS,
  QGIP_SOURCE_URL,
  QGIP_UNIT,
  QGIP_UNIT_TO_CENTS,
  createQgipConnector,
  qgipManifestFromRecords,
  runIngestion,
} from '../server/src/connectors/index.js';
import {
  listArchivedRecords,
  persistArchivedRecord,
} from '../server/src/connectors/source-archive.js';
import { DataSourceModel, MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * QGIP earlier-year breadth ingestion (P1).
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo \
 *   npm run ingest:qgip-years
 *
 * Runs exactly one connector, qld-qgip, over 2018-19..2023-24. One CSV is
 * selected per fiscal year (the corrected "updated DTMR data" file for
 * 2020-21, never both), archived outside the repo and streamed into measures
 * with the existing Grant/Frontline mapping. The latest 2024-25 rows already in
 * the database are not touched: the runner upserts on per-year natural keys and
 * never deletes.
 *
 * 2019-20 is a partial-coverage year because the publisher left the annual
 * payment blank on 22,530 of 27,308 rows; only published annual payments are
 * stored and each 2019-20 row is flagged. The cumulative total-to-date is never
 * used as an annual payment. Grants and contracts are separate measure types
 * and are never summed together.
 *
 * Use `--years=2018-19,2019-20,2020-21` to land a smaller defensible subset.
 */

const FISCAL_YEAR_REGEX = /^\d{4}-\d{2}$/;

function requestedYears(argv: readonly string[]): string[] | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const raw = arg.startsWith('--years=')
      ? arg.slice('--years='.length)
      : arg === '--years'
        ? (argv[index + 1] ?? '')
        : null;
    if (raw === null) continue;
    const years = raw
      .split(',')
      .map((year) => year.trim())
      .filter(Boolean);
    if (years.length === 0) throw new Error('--years requires at least one fiscal year');
    for (const year of years) {
      if (!FISCAL_YEAR_REGEX.test(year)) {
        throw new Error(`invalid fiscal year ${JSON.stringify(year)} (expected YYYY-YY)`);
      }
    }
    return years;
  }
  return null;
}

function yearInTitle(title: string, years: readonly string[]): boolean {
  return years.some((year) => title.includes(year));
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  const years = requestedYears(process.argv.slice(2)) ?? [...QGIP_EARLIER_YEARS];
  const connector = createQgipConnector({ years });

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    const baseline = {
      total: await MeasureModel.countDocuments({}),
      qgip: await MeasureModel.countDocuments({ source_id: QGIP_ID }),
      latestYear: await MeasureModel.countDocuments({
        source_id: QGIP_ID,
        fiscal_year: QGIP_FISCAL_YEAR,
      }),
    };
    console.log(
      `[ingest:qgip-years] target=${databaseName} years=${years.join(',')} ` +
        `baseline_total=${baseline.total} baseline_qgip=${baseline.qgip} ` +
        `baseline_${QGIP_FISCAL_YEAR}=${baseline.latestYear}`,
    );

    const result = await runIngestion({ connectors: [connector] });
    for (const entry of result.results) {
      console.log(
        `[ingest:qgip-years] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
    }
    for (const warning of connector.metadata.warnings ?? []) {
      console.log(`[ingest:qgip-years] warning: ${warning}`);
    }

    const archived = await listArchivedRecords({ source_id: QGIP_ID });
    for (const record of archived) await persistArchivedRecord(record);

    const byYear = await MeasureModel.aggregate([
      { $match: { source_id: QGIP_ID } },
      {
        $group: {
          _id: { fiscal_year: '$fiscal_year', measure_type: '$measure_type' },
          rows: { $sum: 1 },
          cents: { $sum: '$amount_cents' },
        },
      },
      { $sort: { '_id.fiscal_year': 1, '_id.measure_type': 1 } },
    ]);

    const after = {
      total: await MeasureModel.countDocuments({}),
      qgip: await MeasureModel.countDocuments({ source_id: QGIP_ID }),
      latestYear: await MeasureModel.countDocuments({
        source_id: QGIP_ID,
        fiscal_year: QGIP_FISCAL_YEAR,
      }),
    };

    // The runner records the rows upserted by this run (earlier years only).
    // The source register and UI show a source's row count, so point that field
    // at the full qld-qgip row count, which includes the preserved 2024-25 rows.
    await DataSourceModel.updateOne(
      { source_id: QGIP_ID },
      { $set: { records_ingested: after.qgip } },
    );

    for (const year of years) {
      const groups = byYear.filter((group) => group._id.fiscal_year === year);
      const rows = groups.reduce((sum, group) => sum + group.rows, 0);
      console.log(
        `[ingest:qgip-years] fiscal_year=${year} rows=${rows}` +
          (QGIP_PARTIAL_YEARS[year] ? ' (PARTIAL — publisher gap)' : ''),
      );
      for (const group of groups) {
        console.log(
          `[ingest:qgip-years] fiscal_year=${year} measure_type=${group._id.measure_type} ` +
            `rows=${group.rows} cents=${group.cents}`,
        );
      }
      if (rows === 0) throw new Error(`no QGIP measures landed for fiscal year ${year}`);
    }
    console.log(
      `[ingest:qgip-years] after_total=${after.total} after_qgip=${after.qgip} ` +
        `after_${QGIP_FISCAL_YEAR}=${after.latestYear} (no combined grant+contract total)`,
    );

    if (after.latestYear !== baseline.latestYear) {
      throw new Error(
        `existing ${QGIP_FISCAL_YEAR} rows changed (${baseline.latestYear} -> ${after.latestYear})`,
      );
    }
    if (after.total < baseline.total) {
      throw new Error(`measure total decreased (${baseline.total} -> ${after.total})`);
    }

    const manifestPath = path.resolve(
      process.env.QGIP_MANIFEST ?? 'docs/source-archive/qld-qgip-2018-19-2023-24.json',
    );
    const files = archived.filter(
      (record) => yearInTitle(record.title, years) || /data dictionary/i.test(record.title),
    );
    const manifest = {
      dataset: QGIP_DATASET,
      years,
      source_url: QGIP_SOURCE_URL,
      license: QGIP_LICENSE,
      attribution: QGIP_ATTRIBUTION,
      retrieved_at: new Date().toISOString(),
      unit: `${QGIP_UNIT} (x${QGIP_UNIT_TO_CENTS} cents), confirmed by the archived data dictionary`,
      files: qgipManifestFromRecords(files),
      per_year: byYear
        .filter((group) => years.includes(group._id.fiscal_year))
        .map((group) => ({
          fiscal_year: group._id.fiscal_year,
          measure_type: group._id.measure_type,
          rows: group.rows,
          cents: group.cents,
        })),
      partial_years: Object.fromEntries(
        years
          .filter((year) => QGIP_PARTIAL_YEARS[year])
          .map((year) => [year, QGIP_PARTIAL_YEARS[year]]),
      ),
      baseline,
      after,
      notes:
        'One consolidated QGIP expenditure CSV per fiscal year (2020-21 uses the corrected "updated DTMR data" file only). Existing 2024-25 rows are preserved untouched. Only Grant (grant_award) and Frontline service procurement (contract) are ingested; Concession, Loan and Direct government investment are rejected, as are zero-dollar rows. Grants and contracts are never summed, and years are never merged. 2019-20 is partial because the publisher left Financial year expenditure blank on 22,530/27,308 rows; the cumulative total-to-date is never added to or substituted for an annual payment. No COFOG function; provisional and unverified. Bytes are archived outside the repo.',
    };
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(
      `[ingest:qgip-years] manifest=${path.relative(process.cwd(), manifestPath)} files=${manifest.files.length}`,
    );

    if (result.results.some((entry) => entry.log_status === 'error')) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:qgip-years] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
