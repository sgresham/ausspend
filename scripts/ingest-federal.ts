import 'dotenv/config';
import path from 'node:path';
import mongoose from 'mongoose';
import {
  AUS_TENDER_BACKFILL_CHUNK_DAYS,
  AUS_TENDER_BACKFILL_PAGE_LIMIT,
  CONNECTORS,
  chunkAusTenderWindow,
  createAusTenderConnector,
  runIngestion,
  type Connector,
} from '../server/src/connectors/index.js';
import { DataSourceModel, IngestionLogModel, MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';
import { assertBackfillAllowed, DEFAULT_MAX_AGE_MINUTES } from './lib/backfill-gate.mjs';

/**
 * Federal ingestion runner (F2/F3). AusTender and data.gov.au PBS are live;
 * every other registered source is a stub and is logged as `skipped`.
 *
 * Narrow live run (the acceptance window):
 *
 *   AUSTENDER_START_DATE=2026-11-02T00:00:00Z \
 *   AUSTENDER_END_DATE=2026-11-09T00:00:00Z \
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev \
 *   npm run ingest:federal
 *
 * Set INGEST_SOURCES=aus-tender to run only AusTender, or
 * INGEST_SOURCES=data-gov-au-pbs to run only the PBS CSV. A source failure is
 * logged and marked degraded without aborting the rest of the run.
 *
 * Historical AusTender backfill is gated. It requires `--backfill`,
 * `BACKFILL_CONFIRM=yes`, and a recent verified backup of ausspend_dev:
 *
 *   BACKFILL_CONFIRM=yes BACKUP_DIR=${AUSSPEND_BACKUP_ROOT}/<ISO> \
 *   npm run ingest:federal -- --backfill --dry-run
 *
 * The dry run validates the gate and records it in ingestion_logs without
 * fetching anything. The real backfill is not part of this safety item.
 */
interface CliOptions {
  backfill: boolean;
  dryRun: boolean;
  backupDir: string | null;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    backfill: false,
    dryRun: false,
    backupDir: process.env.BACKUP_DIR ?? null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--backfill') {
      options.backfill = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--backup-dir') {
      options.backupDir = argv[++i] ?? null;
      if (!options.backupDir) throw new Error('--backup-dir requires a directory');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.dryRun && !options.backfill) {
    throw new Error('--dry-run is only valid with --backfill');
  }
  if (process.env.BACKFILL_CONFIRM === 'yes' && !options.backfill) {
    throw new Error('BACKFILL_CONFIRM=yes without --backfill; refusing');
  }

  return options;
}

function selectConnectors(): readonly Connector[] {
  const only = (process.env.INGEST_SOURCES ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (only.length === 0) return CONNECTORS;

  const selected = CONNECTORS.filter((connector) => only.includes(connector.id));
  const unknown = only.filter((id) => !CONNECTORS.some((connector) => connector.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown INGEST_SOURCES id(s): ${unknown.join(', ')}`);
  }
  return selected;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function positiveIntegerEnv(name: string, fallback: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max} (got ${raw})`);
  }
  return value;
}

interface MeasureCounts {
  total: number;
  by_source: Record<string, number>;
  distinct_natural_keys: number;
  duplicate_natural_key_groups: number;
  invalid_amount_cents: number;
}

/** Honest before/after counters for a backfill report. */
async function measureCounts(): Promise<MeasureCounts> {
  const [total, bySource, distinctKeys, duplicateGroups, invalidAmounts] = await Promise.all([
    MeasureModel.countDocuments({}),
    MeasureModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$source_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).allowDiskUse(true),
    // `distinct()` caps its result at 16 MB, which a large measures collection
    // exceeds. Count distinct keys in the aggregation pipeline (disk-spilling)
    // so the backfill's before/after report works at any size.
    MeasureModel.aggregate<{ count: number }>([
      { $match: { natural_key: { $ne: null } } },
      { $group: { _id: '$natural_key' } },
      { $count: 'count' },
    ]).allowDiskUse(true),
    MeasureModel.aggregate<{ count: number }>([
      { $match: { natural_key: { $ne: null } } },
      { $group: { _id: '$natural_key', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'count' },
    ]).allowDiskUse(true),
    MeasureModel.countDocuments({
      $or: [
        { amount_cents: { $lt: 0 } },
        { $expr: { $not: [{ $isNumber: '$amount_cents' }] } },
        { $expr: { $ne: ['$amount_cents', { $floor: '$amount_cents' }] } },
        { $expr: { $gt: ['$amount_cents', Number.MAX_SAFE_INTEGER] } },
      ],
    }),
  ]);

  return {
    total,
    by_source: Object.fromEntries(bySource.map((entry) => [entry._id, entry.count])),
    distinct_natural_keys: distinctKeys[0]?.count ?? 0,
    duplicate_natural_key_groups: duplicateGroups[0]?.count ?? 0,
    invalid_amount_cents: invalidAmounts,
  };
}

function printCounts(label: string, counts: MeasureCounts): void {
  console.log(
    `[backfill] ${label} total=${counts.total} ` +
      `by_source=${JSON.stringify(counts.by_source)} ` +
      `distinct_natural_keys=${counts.distinct_natural_keys} ` +
      `duplicate_natural_key_groups=${counts.duplicate_natural_key_groups} ` +
      `invalid_amount_cents=${counts.invalid_amount_cents}`,
  );
}

/**
 * AusTender historical backfill: chunk the requested window (weekly by
 * default), raise the page bound per chunk, and run the existing F2 connector
 * once per chunk. The gate has already proved a fresh verified backup exists.
 * Every chunk upserts on natural_key, so re-running is idempotent and no
 * existing row (synthetic seed, the one-week 861, PBS) is ever deleted.
 */
async function runAusTenderBackfill(
  backupPath: string,
  window: { startDate: string; endDate: string },
): Promise<void> {
  const chunkDays = positiveIntegerEnv('AUSTENDER_CHUNK_DAYS', AUS_TENDER_BACKFILL_CHUNK_DAYS, 31);
  // 100 pages × ~100 releases/page ≈ 10,000 releases per weekly chunk. The
  // busiest observed week in the backfill window returned 2,195 releases
  // (~22 pages), so 100 leaves >4× headroom while still bounding every chunk.
  const pageLimit = positiveIntegerEnv(
    'AUSTENDER_PAGE_LIMIT',
    AUS_TENDER_BACKFILL_PAGE_LIMIT,
    1_000,
  );
  const delayMs = positiveIntegerEnv('AUSTENDER_DELAY_MS', 1_000, 60_000);
  const chunks = chunkAusTenderWindow(window.startDate, window.endDate, chunkDays);

  const before = await measureCounts();
  printCounts('before', before);
  console.log(
    `[backfill] plan chunks=${chunks.length} chunkDays=${chunkDays} pageLimit=${pageLimit} ` +
      `delayMs=${delayMs} window=${window.startDate}..${window.endDate} backup=${backupPath}`,
  );

  let fetched = 0;
  let upserted = 0;
  const failures: string[] = [];

  for (const chunk of chunks) {
    const label = `chunk ${chunk.index}/${chunk.total} ${chunk.startDate}..${chunk.endDate}`;
    const connector = createAusTenderConnector({
      startDate: chunk.startDate,
      endDate: chunk.endDate,
      pageLimit,
      delayMs,
    });
    const result = await runIngestion({
      connectors: [connector],
      ausTenderBackfillBackupPath: backupPath,
      ausTenderBackfillChunk: label,
    });
    const entry = result.results[0];
    if (!entry) throw new Error(`chunk produced no result: ${label}`);
    fetched += entry.records_fetched;
    upserted += entry.records_upserted;
    console.log(
      `[backfill] ${label} status=${entry.log_status} ` +
        `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
        (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
    );
    if (entry.log_status === 'error') {
      failures.push(`${label}: ${entry.errors.join('; ') || 'unknown error'}`);
      break;
    }
    if (entry.log_status === 'partial') {
      failures.push(`${label}: partial: ${entry.errors.join('; ')}`);
    }
  }

  const ausTenderCount = await MeasureModel.countDocuments({ source_id: 'aus-tender' });
  await DataSourceModel.updateOne(
    { source_id: 'aus-tender' },
    {
      $set: {
        status: failures.length > 0 ? 'degraded' : 'active',
        last_ingested_at: new Date(),
        // Cumulative total for the source, not just the last chunk.
        records_ingested: ausTenderCount,
        errors: failures,
      },
    },
  );

  const after = await measureCounts();
  printCounts('after', after);
  console.log(
    `[backfill] done chunks=${chunks.length} fetched=${fetched} upserted=${upserted} ` +
      `aus_tender_rows=${ausTenderCount} failures=${failures.length}`,
  );
  if (failures.length > 0) {
    throw new Error(`backfill completed with ${failures.length} chunk problem(s): ${failures[0]}`);
  }
}

async function recordRefusal(options: CliOptions, reason: string): Promise<void> {
  const now = new Date();
  try {
    await IngestionLogModel.create({
      source_id: 'aus-tender',
      started_at: now,
      finished_at: now,
      status: 'skipped',
      records_fetched: 0,
      records_upserted: 0,
      errors: [reason],
      message: 'backfill refused; no fetch performed',
      ...(options.backupDir ? { backup_path: path.resolve(options.backupDir) } : {}),
    });
  } catch (error) {
    console.error(`[ingest] could not record backfill refusal: ${errorMessage(error)}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const databaseName = assertSeedTarget(process.env.MONGO_URL);
  await mongoose.connect(process.env.MONGO_URL as string, { serverSelectionTimeoutMS: 5_000 });

  try {
    let backupPath: string | undefined;
    if (options.backfill) {
      const maxAgeMinutes = Number(
        process.env.BACKFILL_MAX_BACKUP_AGE_MINUTES ?? String(DEFAULT_MAX_AGE_MINUTES),
      );
      try {
        const gate = await assertBackfillAllowed({
          backupDir: options.backupDir ?? undefined,
          confirm: process.env.BACKFILL_CONFIRM,
          maxAgeMinutes,
        });
        backupPath = gate.backupDir;
        console.log(
          `[ingest] backfill gate passed backup=${gate.backupDir} ` +
            `age_minutes=${gate.ageMinutes.toFixed(1)} ` +
            `natural_key=${gate.manifest.natural_key.count}/${gate.manifest.natural_key.distinct_count}`,
        );
      } catch (error) {
        const reason = errorMessage(error);
        await recordRefusal(options, reason);
        throw error;
      }

      if (options.dryRun) {
        const now = new Date();
        await IngestionLogModel.create({
          source_id: 'aus-tender',
          started_at: now,
          finished_at: now,
          status: 'skipped',
          records_fetched: 0,
          records_upserted: 0,
          errors: [],
          message: 'backfill gate passed (dry run); no fetch performed',
          backup_path: backupPath,
        });
        console.log(
          `[ingest] backfill gate dry run OK target=${databaseName} backup=${backupPath}`,
        );
        return;
      }

      if (!process.env.AUSTENDER_START_DATE || !process.env.AUSTENDER_END_DATE) {
        const reason =
          'Refusing historical backfill: AUSTENDER_START_DATE and AUSTENDER_END_DATE are required';
        await recordRefusal(options, reason);
        throw new Error(reason);
      }
      if (!selectConnectors().some((connector) => connector.id === 'aus-tender')) {
        const reason = 'Refusing historical backfill: INGEST_SOURCES must include aus-tender';
        await recordRefusal(options, reason);
        throw new Error(reason);
      }
    }

    if (options.backfill) {
      // The gate has passed and a fresh verified backup is recorded. Run only
      // AusTender, one contiguous chunk at a time; never PBS/GrantConnect/etc.
      await runAusTenderBackfill(backupPath as string, {
        startDate: process.env.AUSTENDER_START_DATE as string,
        endDate: process.env.AUSTENDER_END_DATE as string,
      });
      console.log(`[ingest] done target=${databaseName} MODE=guarded-backfill`);
      return;
    }

    const connectors = selectConnectors();
    const ausTender = connectors.find((connector) => connector.id === 'aus-tender');
    console.log(
      `[ingest] target=${databaseName} window=` +
        (process.env.AUSTENDER_START_DATE ?? '(default 7 days)') +
        '..' +
        (process.env.AUSTENDER_END_DATE ?? '(today)') +
        ` connectors=${connectors.length}` +
        (options.backfill ? ' MODE=guarded-backfill' : ''),
    );
    if (ausTender) {
      console.log(`[ingest] aus-tender status=${ausTender.status}`);
    }
    const pbs = connectors.find((connector) => connector.id === 'data-gov-au-pbs');
    if (pbs) {
      console.log(`[ingest] data-gov-au-pbs status=${pbs.status}`);
    }

    const result = await runIngestion({
      connectors,
      ...(backupPath ? { ausTenderBackfillBackupPath: backupPath } : {}),
    });
    for (const entry of result.results) {
      console.log(
        `[ingest] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
    }
    const skipped = result.results.filter((entry) => entry.log_status === 'skipped').length;
    const errored = result.results.filter((entry) => entry.log_status === 'error').length;
    console.log(
      `[ingest] done target=${databaseName} connectors=${result.results.length} ` +
        `skipped=${skipped} errored=${errored}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest] ${errorMessage(error)}`);
  process.exitCode = 1;
});
