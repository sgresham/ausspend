import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import {
  countFileLines,
  countLines,
  naturalKeyChecksum,
  verifyBackupIntegrity,
} from './lib/backup-format.mjs';

// Larger than V8's maximum string length (~512 MiB), the size at which
// fs.readFile(file, 'utf8') throws RangeError: Invalid string length.
const LARGE_FILE_BYTES = 600 * 1024 * 1024;

const keys = ['nk-1', 'nk-2', 'nk-3'];

let root;
let backupDir;
let largeFile;

function fakeManifest({ collectionCount = keys.length } = {}) {
  return {
    schema_version: 1,
    status: 'complete',
    database: 'ausspend_dev',
    created_at: new Date().toISOString(),
    collections: [
      { name: 'measures', count: collectionCount, file: 'measures.jsonl', indexes: [] },
      { name: 'data_sources', count: 1, file: 'data_sources.jsonl', indexes: [] },
    ],
    data_sources: [{ source_id: 'aus-tender', status: 'active' }],
    natural_key: {
      collection: 'measures',
      field: 'natural_key',
      count: keys.length,
      distinct_count: keys.length,
      checksum: naturalKeyChecksum(keys),
      file: 'natural_keys.txt',
    },
  };
}

async function writeFakeBackup(manifest = fakeManifest()) {
  await fs.rm(backupDir, { recursive: true, force: true });
  await fs.mkdir(backupDir, { recursive: true });
  await writeSparseLargeFile(path.join(backupDir, 'measures.jsonl'));
  await fs.writeFile(
    path.join(backupDir, 'data_sources.jsonl'),
    `${JSON.stringify({ source_id: 'aus-tender', status: 'active' })}\n`,
  );
  await fs.writeFile(path.join(backupDir, 'natural_keys.txt'), `${keys.join('\n')}\n`);
  await fs.writeFile(
    path.join(backupDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

/**
 * A sparse 600 MiB file whose *content* is three lines: two text lines, a long
 * run of zero bytes, and a final newline. The zeros make it larger than V8's
 * maximum string length without using 600 MiB of disk.
 */
async function writeSparseLargeFile(filePath) {
  const handle = await fs.open(filePath, 'w');
  try {
    await handle.write('line-1\nline-2\n');
    await handle.truncate(LARGE_FILE_BYTES);
    await handle.write('\n', LARGE_FILE_BYTES - 1, 'utf8');
  } finally {
    await handle.close();
  }
}

before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'ausspend-backup-format-'));
  backupDir = path.join(root, 'backup');
  largeFile = path.join(root, 'large-measures.jsonl');
  await writeSparseLargeFile(largeFile);
});

after(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

test('countFileLines matches countLines for newline edge cases', async () => {
  const cases = ['', 'a', 'a\n', '\n', '\n\n', 'a\nb', 'a\nb\n', 'a\n\n'];
  for (const [index, content] of cases.entries()) {
    const filePath = path.join(root, `lines-${index}.txt`);
    await fs.writeFile(filePath, content);
    assert.equal(await countFileLines(filePath), countLines(content), JSON.stringify(content));
  }
});

test('a 600 MiB sparse collection file is verified without whole-file read', async () => {
  // Premise: reading the file as one string is what the old verifier did, and
  // it fails once the file is larger than V8's maximum string length.
  await assert.rejects(
    () => fs.readFile(largeFile, 'utf8'),
    /Invalid string length|Cannot create a string longer/i,
  );

  await writeFakeBackup();
  assert.equal(await countFileLines(path.join(backupDir, 'measures.jsonl')), 3);

  const result = await verifyBackupIntegrity(backupDir, { expectedDatabase: 'ausspend_dev' });
  assert.equal(result.manifest.collections[0].count, 3);
});

test('verifyBackupIntegrity still rejects a wrong line count in a large file', async () => {
  await writeFakeBackup(fakeManifest({ collectionCount: 4 }));
  await assert.rejects(() => verifyBackupIntegrity(backupDir), /has 3 lines but manifest says 4/);
});

test('verifyBackupIntegrity still checks database, natural keys and checksum', async () => {
  await writeFakeBackup();
  await assert.rejects(
    () => verifyBackupIntegrity(backupDir, { expectedDatabase: 'ausspend_restore_test_other' }),
    /expected "ausspend_restore_test_other"/,
  );

  const tampered = fakeManifest();
  tampered.natural_key.checksum = '0'.repeat(64);
  await writeFakeBackup(tampered);
  await assert.rejects(
    () => verifyBackupIntegrity(backupDir),
    /natural-key checksum does not match/,
  );
});

test('verifyBackupIntegrity still reports a genuinely missing collection file', async () => {
  await writeFakeBackup();
  await fs.rm(path.join(backupDir, 'measures.jsonl'), { force: true });
  await assert.rejects(
    () => verifyBackupIntegrity(backupDir),
    /is missing collection file measures\.jsonl/,
  );
});
