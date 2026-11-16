import 'dotenv/config';
import path from 'node:path';
import mongoose from 'mongoose';
import { CONNECTORS, runIngestion, type Connector } from '../server/src/connectors/index.js';
import { IngestionLogModel } from '../server/src/models/index.js';
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
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
 *   npm run ingest:federal
 *
 * Set INGEST_SOURCES=aus-tender to run only AusTender, or
 * INGEST_SOURCES=data-gov-au-pbs to run only the PBS CSV. A source failure is
 * logged and marked degraded without aborting the rest of the run.
 *
 * Historical AusTender backfill is gated. It requires `--backfill`,
 * `BACKFILL_CONFIRM=yes`, and a recent verified backup of ausspend_dev:
 *
 *   BACKFILL_CONFIRM=yes BACKUP_DIR=/home/steve/backups/ausspend/<ISO> \
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
