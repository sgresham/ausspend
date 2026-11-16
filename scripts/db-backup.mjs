#!/usr/bin/env node
import 'dotenv/config';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { BSON, MongoClient } from 'mongodb';
import {
  APP_DATABASE,
  BACKUP_ROOT_DEFAULT,
  BACKUP_SCHEMA_VERSION,
  assertNotPoolMongo,
  databaseNameFromUrl,
  isInside,
  isScratchDatabaseName,
  naturalKeyChecksum,
  pruneBackups,
  redactMongoUrl,
} from './lib/backup-format.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

function usage() {
  console.log(
    [
      'Usage: npm run db:backup -- [--out-root DIR] [--scratch] [--prune N]',
      '',
      'Reads MONGO_URL and dumps every collection as Extended JSON to a timestamped',
      'directory under /home/steve/backups/ausspend (override with --out-root).',
      'The backup root must be outside the repository.',
      '',
      'Only ausspend_dev is accepted by default. --scratch additionally permits an',
      'explicit ausspend_test_* / ausspend_restore_test_* scratch database.',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const options = {
    outRoot: process.env.AUSSPEND_BACKUP_ROOT ?? BACKUP_ROOT_DEFAULT,
    scratch: false,
    prune: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else if (arg === '--scratch') {
      options.scratch = true;
    } else if (arg === '--out-root') {
      const value = argv[++i];
      if (!value) throw new Error('--out-root requires a directory');
      options.outRoot = value;
    } else if (arg === '--prune') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1)
        throw new Error('--prune requires a positive integer');
      options.prune = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function indexSpec(index) {
  const spec = { key: index.key };
  for (const field of [
    'name',
    'unique',
    'sparse',
    'expireAfterSeconds',
    'partialFilterExpression',
    'collation',
  ]) {
    if (index[field] !== undefined) spec[field] = index[field];
  }
  return spec;
}

async function dumpCollection(collection, filePath) {
  const stream = createWriteStream(filePath, { encoding: 'utf8' });
  let count = 0;
  const naturalKeys = [];
  try {
    for await (const doc of collection.find({})) {
      const line = `${BSON.EJSON.stringify(doc, { relaxed: false })}\n`;
      if (!stream.write(line)) await once(stream, 'drain');
      count += 1;
      if (
        collection.collectionName === 'measures' &&
        typeof doc.natural_key === 'string' &&
        doc.natural_key.length > 0
      ) {
        naturalKeys.push(doc.natural_key);
      }
    }
  } finally {
    stream.end();
    await finished(stream);
  }
  return { count, naturalKeys };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error('MONGO_URL is required');

  assertNotPoolMongo(mongoUrl);
  const databaseName = databaseNameFromUrl(mongoUrl);
  if (!databaseName) throw new Error('MONGO_URL must name a database');

  if (databaseName !== APP_DATABASE && !(options.scratch && isScratchDatabaseName(databaseName))) {
    throw new Error(
      `Refusing to back up "${databaseName}": only "${APP_DATABASE}" is allowed ` +
        '(or an explicit ausspend_test_*/ausspend_restore_test_* scratch database with --scratch)',
    );
  }

  const outRoot = path.resolve(options.outRoot);
  if (isInside(REPO_ROOT, outRoot)) {
    throw new Error(`Refusing to write a backup inside the repository (${outRoot})`);
  }

  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/:/g, '-');
  await fs.mkdir(outRoot, { recursive: true });
  const finalDir = path.join(outRoot, stamp);
  const tempDir = path.join(outRoot, `.${stamp}.tmp-${process.pid}`);
  await fs.mkdir(tempDir, { recursive: false });

  const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5_000 });
  try {
    await client.connect();
    const db = client.db(databaseName);
    const collectionInfo = await db.listCollections({}, { nameOnly: true }).toArray();
    const collectionNames = collectionInfo.map((entry) => entry.name).sort();
    if (collectionNames.length === 0) {
      throw new Error(`Database "${databaseName}" has no collections to back up`);
    }

    const collections = [];
    let naturalKeys = [];
    let measuresCount = 0;

    for (const name of collectionNames) {
      const collection = db.collection(name);
      const file = `${name}.jsonl`;
      const { count, naturalKeys: keys } = await dumpCollection(
        collection,
        path.join(tempDir, file),
      );
      const indexes = (await collection.indexes())
        .filter((index) => index.name !== '_id_')
        .map(indexSpec);
      collections.push({ name, count, file, indexes });
      if (name === 'measures') {
        naturalKeys = keys;
        measuresCount = count;
      }
    }

    const dataSources = await db
      .collection('data_sources')
      .find({})
      .project({ _id: 0, source_id: 1, status: 1, records_ingested: 1, last_ingested_at: 1 })
      .sort({ source_id: 1 })
      .toArray();

    const sortedKeys = [...naturalKeys].sort();
    await fs.writeFile(path.join(tempDir, 'natural_keys.txt'), sortedKeys.join('\n'), 'utf8');

    const manifest = {
      schema_version: BACKUP_SCHEMA_VERSION,
      status: 'complete',
      database: databaseName,
      mongo_url_redacted: redactMongoUrl(mongoUrl),
      created_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      tool: 'scripts/db-backup.mjs',
      collections,
      data_sources: dataSources.map((source) => ({
        source_id: source.source_id,
        status: source.status,
        records_ingested: source.records_ingested,
        last_ingested_at: source.last_ingested_at
          ? new Date(source.last_ingested_at).toISOString()
          : null,
      })),
      natural_key: {
        collection: 'measures',
        field: 'natural_key',
        count: sortedKeys.length,
        distinct_count: new Set(sortedKeys).size,
        checksum_algorithm: 'sha256(sorted keys joined by newline)',
        checksum: naturalKeyChecksum(sortedKeys),
        file: 'natural_keys.txt',
      },
      measures_count: measuresCount,
    };

    await fs.writeFile(
      path.join(tempDir, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    await fs.rename(tempDir, finalDir);

    console.log(`[backup] target=${databaseName} source=${redactMongoUrl(mongoUrl)}`);
    console.log(`[backup] wrote ${finalDir}`);
    for (const entry of collections) {
      console.log(`[backup] collection ${entry.name}: ${entry.count}`);
    }
    console.log(
      `[backup] natural_key count=${manifest.natural_key.count} ` +
        `distinct=${manifest.natural_key.distinct_count} checksum=${manifest.natural_key.checksum}`,
    );
    console.log(
      `[backup] data_sources ${
        manifest.data_sources.map((source) => `${source.source_id}=${source.status}`).join(' ') ||
        '(none)'
      }`,
    );

    if (options.prune !== null) {
      const removed = await pruneBackups(outRoot, options.prune);
      console.log(
        `[backup] prune keep=${options.prune} removed=${removed.length}` +
          (removed.length > 0 ? ` (${removed.join(', ')})` : ''),
      );
    }
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`[backup] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
