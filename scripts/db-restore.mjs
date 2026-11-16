#!/usr/bin/env node
import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BSON, MongoClient } from 'mongodb';
import {
  APP_DATABASE,
  assertNotPoolMongo,
  databaseNameFromUrl,
  mongoUrlWithDatabase,
  naturalKeyChecksum,
  redactMongoUrl,
  verifyBackupIntegrity,
} from './lib/backup-format.mjs';

function usage() {
  console.log(
    [
      'Usage: npm run db:restore -- <backup-dir> [--target DB] [--confirm ausspend_dev]',
      '',
      'Restores a verified backup into a scratch database by default',
      '(ausspend_restore_test_<timestamp>). Restoring into ausspend_dev requires',
      '--target ausspend_dev and --confirm ausspend_dev (or RESTORE_CONFIRM=ausspend_dev).',
      '',
      'The restore verifies collection counts, natural_key uniqueness/checksum and',
      'data_sources statuses after writing, and exits nonzero on any mismatch.',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const options = { backupDir: null, target: null, confirm: process.env.RESTORE_CONFIRM ?? null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg === '--target') {
      options.target = argv[++i] ?? null;
      if (!options.target) throw new Error('--target requires a database name');
    } else if (arg === '--confirm') {
      options.confirm = argv[++i] ?? null;
      if (!options.confirm) throw new Error('--confirm requires a value');
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    } else if (options.backupDir === null) {
      options.backupDir = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  if (!options.backupDir) throw new Error('A backup directory is required');
  return options;
}

function defaultScratchName() {
  return `ausspend_restore_test_${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;
}

async function readCollectionDocuments(backupDir, entry) {
  const content = await fs.readFile(path.join(backupDir, entry.file), 'utf8');
  if (content.length === 0) return [];
  const lines = content.replace(/\n$/, '').split('\n');
  const documents = [];
  for (let i = 0; i < lines.length; i += 1) {
    try {
      documents.push(BSON.EJSON.parse(lines[i], { relaxed: false }));
    } catch (error) {
      throw new Error(
        `Backup ${entry.file} line ${i + 1} is not valid Extended JSON: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
  if (documents.length !== entry.count) {
    throw new Error(
      `Backup ${entry.file} yielded ${documents.length} documents, expected ${entry.count}`,
    );
  }
  return documents;
}

async function insertDocuments(collection, documents) {
  const batchSize = 500;
  for (let i = 0; i < documents.length; i += batchSize) {
    await collection.insertMany(documents.slice(i, i + batchSize), { ordered: false });
  }
}

async function measureNaturalKeys(collection) {
  const keys = [];
  for await (const doc of collection.find({}, { projection: { natural_key: 1 } })) {
    if (typeof doc.natural_key === 'string' && doc.natural_key.length > 0)
      keys.push(doc.natural_key);
  }
  return keys;
}

async function verifyTarget(db, manifest) {
  const failures = [];

  for (const entry of manifest.collections) {
    const count = await db.collection(entry.name).countDocuments({});
    if (count !== entry.count) {
      failures.push(`collection ${entry.name}: ${count} documents, expected ${entry.count}`);
    }
  }

  const keys = await measureNaturalKeys(db.collection('measures'));
  const distinct = new Set(keys).size;
  if (keys.length !== manifest.natural_key.count) {
    failures.push(`natural_key count ${keys.length}, expected ${manifest.natural_key.count}`);
  }
  if (distinct !== keys.length) {
    failures.push(`natural_key duplicates: ${keys.length - distinct} duplicate key(s)`);
  }
  if (distinct !== manifest.natural_key.distinct_count) {
    failures.push(
      `natural_key distinct ${distinct}, expected ${manifest.natural_key.distinct_count}`,
    );
  }
  const checksum = naturalKeyChecksum(keys);
  if (checksum !== manifest.natural_key.checksum) {
    failures.push(`natural_key checksum ${checksum}, expected ${manifest.natural_key.checksum}`);
  }

  if (Array.isArray(manifest.data_sources)) {
    const targetSources = await db
      .collection('data_sources')
      .find({})
      .project({ _id: 0, source_id: 1, status: 1 })
      .toArray();
    const byId = new Map(targetSources.map((source) => [source.source_id, source.status]));
    for (const source of manifest.data_sources) {
      if (byId.get(source.source_id) !== source.status) {
        failures.push(
          `data_source ${source.source_id} status ${String(byId.get(source.source_id))}, ` +
            `expected ${source.status}`,
        );
      }
    }
  }

  return { failures, naturalKeys: keys };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error('MONGO_URL is required');
  assertNotPoolMongo(mongoUrl);

  const backupDir = path.resolve(options.backupDir);
  const { manifest } = await verifyBackupIntegrity(backupDir);

  const target = options.target ?? defaultScratchName();
  if (target === APP_DATABASE) {
    if (options.target !== APP_DATABASE) {
      throw new Error(
        'Refusing to restore into ausspend_dev without an explicit --target ausspend_dev',
      );
    }
    if (options.confirm !== APP_DATABASE) {
      throw new Error(
        'Refusing to restore into ausspend_dev without --confirm ausspend_dev (or RESTORE_CONFIRM=ausspend_dev)',
      );
    }
    if (manifest.database !== APP_DATABASE) {
      throw new Error(
        `Refusing to restore a backup from "${manifest.database}" into ${APP_DATABASE}`,
      );
    }
  } else if (
    !/^ausspend_(?:test|restore_test|backup_test|gate_test|seed_test)_[A-Za-z0-9_]+$/.test(target)
  ) {
    throw new Error(
      `Refusing restore target "${target}": use a scratch database or --target ${APP_DATABASE} with confirmation`,
    );
  }

  const targetUrl = mongoUrlWithDatabase(mongoUrl, target);
  const sourceDb = databaseNameFromUrl(mongoUrl);
  console.log(
    `[restore] backup=${backupDir} source_db=${manifest.database} ` +
      `created_at=${manifest.created_at}`,
  );
  console.log(
    `[restore] target=${target} server=${redactMongoUrl(mongoUrl)}` +
      (sourceDb === target ? ' (same database as MONGO_URL)' : ''),
  );
  if (target === APP_DATABASE) {
    console.log('[restore] WARNING: explicit confirmed restore into the application database');
  } else {
    console.log('[restore] scratch target: the database will be dropped and recreated');
  }

  // Parse the whole backup before touching the target. A corrupt or truncated
  // document must fail without partially wiping even a scratch database.
  const payload = [];
  for (const entry of manifest.collections) {
    payload.push({ entry, documents: await readCollectionDocuments(backupDir, entry) });
  }

  const client = new MongoClient(targetUrl, { serverSelectionTimeoutMS: 5_000 });
  try {
    await client.connect();
    const db = client.db(target);

    if (target === APP_DATABASE) {
      for (const entry of manifest.collections) {
        await db.collection(entry.name).deleteMany({});
      }
    } else {
      await db.dropDatabase();
    }

    for (const { entry, documents } of payload) {
      if (documents.length > 0) {
        await insertDocuments(db.collection(entry.name), documents);
      }
      if (Array.isArray(entry.indexes) && entry.indexes.length > 0) {
        await db.collection(entry.name).createIndexes(entry.indexes);
      }
      console.log(`[restore] collection ${entry.name}: ${documents.length}`);
    }

    const { failures, naturalKeys } = await verifyTarget(db, manifest);
    console.log(
      `[restore] verify natural_key count=${naturalKeys.length} ` +
        `distinct=${new Set(naturalKeys).size} checksum=${naturalKeyChecksum(naturalKeys)}`,
    );
    console.log(
      `[restore] verify data_sources ${
        manifest.data_sources.map((source) => `${source.source_id}=${source.status}`).join(' ') ||
        '(none)'
      }`,
    );

    if (failures.length > 0) {
      for (const failure of failures) console.error(`[restore] VERIFY FAILED: ${failure}`);
      throw new Error(`restore verification failed with ${failures.length} problem(s)`);
    }

    console.log(`[restore] OK target=${target} database=${target}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`[restore] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
