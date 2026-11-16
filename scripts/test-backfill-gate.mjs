import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { naturalKeyChecksum } from './lib/backup-format.mjs';
import { assertBackfillAllowed } from './lib/backfill-gate.mjs';

let root;
let backupDir;

const keys = ['ocds-fake-contract-001', 'ocds-fake-contract-002'];

async function writeFakeBackup({
  database = 'ausspend_dev',
  createdAt = new Date(),
  checksum = naturalKeyChecksum(keys),
  keyCount = keys.length,
} = {}) {
  await fs.rm(backupDir, { recursive: true, force: true });
  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(
    path.join(backupDir, 'measures.jsonl'),
    `${keys.map((key) => JSON.stringify({ natural_key: key })).join('\n')}\n`,
  );
  await fs.writeFile(
    path.join(backupDir, 'data_sources.jsonl'),
    `${JSON.stringify({ source_id: 'aus-tender', status: 'active' })}\n`,
  );
  await fs.writeFile(path.join(backupDir, 'natural_keys.txt'), keys.join('\n'));
  await fs.writeFile(
    path.join(backupDir, 'manifest.json'),
    `${JSON.stringify(
      {
        schema_version: 1,
        status: 'complete',
        database,
        created_at: createdAt.toISOString(),
        collections: [
          { name: 'measures', count: keyCount, file: 'measures.jsonl', indexes: [] },
          { name: 'data_sources', count: 1, file: 'data_sources.jsonl', indexes: [] },
        ],
        data_sources: [{ source_id: 'aus-tender', status: 'active' }],
        natural_key: {
          collection: 'measures',
          field: 'natural_key',
          count: keyCount,
          distinct_count: keyCount,
          checksum,
          file: 'natural_keys.txt',
        },
      },
      null,
      2,
    )}\n`,
  );
}

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'ausspend-gate-'));
  backupDir = path.join(root, 'backup');
  await writeFakeBackup();
});

after(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

test('gate passes with a complete, recent fake backup and BACKFILL_CONFIRM=yes', async () => {
  const result = await assertBackfillAllowed({
    backupDir,
    confirm: 'yes',
    maxAgeMinutes: 60,
    now: new Date(),
  });
  assert.equal(result.manifest.database, 'ausspend_dev');
  assert.equal(result.manifest.natural_key.count, 2);
  assert.equal(result.manifest.natural_key.distinct_count, 2);
});

test('gate refuses without BACKFILL_CONFIRM=yes', async () => {
  await assert.rejects(
    () => assertBackfillAllowed({ backupDir, confirm: undefined, maxAgeMinutes: 60 }),
    /BACKFILL_CONFIRM=yes is required/,
  );
});

test('gate refuses without a backup directory', async () => {
  await assert.rejects(
    () => assertBackfillAllowed({ backupDir: undefined, confirm: 'yes', maxAgeMinutes: 60 }),
    /BACKUP_DIR/,
  );
});

test('gate refuses a stale backup', async () => {
  await writeFakeBackup({ createdAt: new Date(Date.now() - 120 * 60_000) });
  await assert.rejects(
    () => assertBackfillAllowed({ backupDir, confirm: 'yes', maxAgeMinutes: 60, now: new Date() }),
    /maximum is 60 minutes/,
  );
});

test('gate refuses a backup from another database', async () => {
  await writeFakeBackup({ database: 'ausspend_restore_test_other' });
  await assert.rejects(
    () => assertBackfillAllowed({ backupDir, confirm: 'yes', maxAgeMinutes: 60, now: new Date() }),
    /expected "ausspend_dev"/,
  );
});

test('gate refuses a tampered natural-key checksum', async () => {
  await writeFakeBackup({ checksum: '0'.repeat(64) });
  await assert.rejects(
    () => assertBackfillAllowed({ backupDir, confirm: 'yes', maxAgeMinutes: 60, now: new Date() }),
    /checksum does not match/,
  );
});

test('gate refuses a missing manifest', async () => {
  await fs.rm(path.join(backupDir, 'manifest.json'), { force: true });
  await assert.rejects(
    () => assertBackfillAllowed({ backupDir, confirm: 'yes', maxAgeMinutes: 60, now: new Date() }),
    /No manifest.json/,
  );
});
