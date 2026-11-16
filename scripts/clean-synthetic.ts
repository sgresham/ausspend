import 'dotenv/config';
import path from 'node:path';
import mongoose from 'mongoose';
import { assertSeedTarget } from '../server/src/seed/guard.js';
import {
  cleanSynthetic,
  inventorySynthetic,
  SYNTHETIC_SOURCE_ID,
  type SyntheticInventory,
} from '../server/src/seed/clean.js';

/**
 * Safe synthetic-seed cleanup.
 *
 *   npm run clean:synthetic                          # DRY RUN: counts only, no writes
 *   npm run clean:synthetic -- --execute \
 *     --backup /home/steve/backups/ausspend/<stamp>  # delete only synthetic-seed rows
 *
 * The default is a pure read. `--execute` refuses unless `--backup` points at a
 * complete, recent, internally verified ausspend_dev backup that contains the
 * synthetic source and at least every measure currently in the database.
 */

interface Options {
  execute: boolean;
  backupDir: string | null;
  maxAgeMinutes: number;
  json: boolean;
}

function usage(): void {
  console.log(
    [
      'Usage: npm run clean:synthetic -- [--execute --backup DIR] [--max-age-minutes N] [--json]',
      '',
      'Without --execute this is a DRY RUN: it prints counts by measure type, fiscal year,',
      'region and function and writes nothing.',
      '',
      '--execute requires --backup DIR pointing at a complete, recent, verified',
      'ausspend_dev backup. Only rows and the register document whose source_id is',
      'exactly "synthetic-seed" can be deleted. Non-synthetic rows are never touched.',
    ].join('\n'),
  );
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    execute: false,
    backupDir: null,
    maxAgeMinutes: 120,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--backup') {
      const value = argv[++index];
      if (!value) throw new Error('--backup requires a directory');
      options.backupDir = value;
    } else if (arg === '--max-age-minutes') {
      const value = Number(argv[++index]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--max-age-minutes requires a positive integer');
      }
      options.maxAgeMinutes = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printInventory(label: string, inventory: SyntheticInventory): void {
  console.log(`[clean:synthetic] ${label} source_id=${SYNTHETIC_SOURCE_ID}`);
  console.log(
    `[clean:synthetic] ${label} measures=${inventory.measures} ` +
      `data_sources=${inventory.data_source_records} total=${inventory.total_measures} ` +
      `non_synthetic=${inventory.non_synthetic_measures}`,
  );
  console.log(
    `[clean:synthetic] ${label} by_measure_type=${inventory.by_measure_type
      .map((entry) => `${entry.key}:${entry.count}`)
      .join(',')}`,
  );
  console.log(
    `[clean:synthetic] ${label} by_fiscal_year=${inventory.by_fiscal_year
      .map((entry) => `${entry.key}:${entry.count}`)
      .join(',')}`,
  );
  console.log(
    `[clean:synthetic] ${label} by_region=${inventory.by_region
      .map((entry) => `${entry.code ?? entry.region_id}:${entry.count}`)
      .join(',')}`,
  );
  console.log(
    `[clean:synthetic] ${label} by_function=${inventory.by_function
      .map((entry) => `${entry.key}:${entry.count}`)
      .join(',')}`,
  );
  console.log(
    `[clean:synthetic] ${label} other_source_ids=${inventory.other_source_ids.join(',') || '(none)'}`,
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const databaseName = assertSeedTarget(process.env.MONGO_URL);
  const mongoUrl = process.env.MONGO_URL as string;

  if (options.execute && !options.backupDir) {
    throw new Error('--execute requires --backup DIR (a verified ausspend_dev backup)');
  }

  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5_000 });
  try {
    const before = await inventorySynthetic();

    if (options.json) {
      console.log(JSON.stringify({ dry_run: !options.execute, inventory: before }, null, 2));
    } else {
      console.log(
        `[clean:synthetic] target=${databaseName} mode=${
          options.execute ? 'EXECUTE' : 'DRY RUN (no writes)'
        }`,
      );
      printInventory('before', before);
    }

    if (!options.execute) {
      console.log(
        '[clean:synthetic] DRY RUN complete: 0 rows deleted. ' +
          'Re-run with --execute --backup <verified-backup-dir> to remove only source_id=synthetic-seed.',
      );
      return;
    }

    const backupDir = path.resolve(options.backupDir as string);
    const backupFormat = await import('./lib/backup-format.mjs');
    const verifyBackup = async () => {
      const { manifest, ageMinutes } = await backupFormat.verifyBackupIntegrity(backupDir, {
        expectedDatabase: databaseName,
        maxAgeMinutes: options.maxAgeMinutes,
      });
      if (manifest.measures_count < before.total_measures) {
        throw new Error(
          `Backup has ${manifest.measures_count} measures but the database has ${before.total_measures}; refusing to delete from a stale backup`,
        );
      }
      const hasSynthetic = (manifest.data_sources ?? []).some(
        (source: { source_id?: string }) => source.source_id === SYNTHETIC_SOURCE_ID,
      );
      if (!hasSynthetic) {
        throw new Error(`Backup does not record the ${SYNTHETIC_SOURCE_ID} source; refusing`);
      }
      console.log(
        `[clean:synthetic] backup verified dir=${backupDir} age_minutes=${ageMinutes.toFixed(1)} ` +
          `measures=${manifest.measures_count} natural_key_checksum=${manifest.natural_key.checksum}`,
      );
    };

    const result = await cleanSynthetic({ execute: true, verifyBackup });
    if (result.preserved_non_synthetic_measures !== before.non_synthetic_measures) {
      throw new Error(
        `Non-synthetic count changed from ${before.non_synthetic_measures} to ${result.preserved_non_synthetic_measures}; inspect immediately`,
      );
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(
        `[clean:synthetic] deleted measures=${result.deleted.measures} ` +
          `data_source_records=${result.deleted.data_source_records}`,
      );
      printInventory('after', result.after);
      console.log(
        `[clean:synthetic] preserved non-synthetic measures=${result.preserved_non_synthetic_measures}`,
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[clean:synthetic] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
