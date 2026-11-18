import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { backupRoot } from './env.mjs';

/** The only application database a backup/restore may touch by default. */
export const APP_DATABASE = 'ausspend_dev';
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_ROOT_DEFAULT = process.env.AUSSPEND_BACKUP_ROOT ?? backupRoot();
export const TIMESTAMP_DIR_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/;

/**
 * Scratch databases are created by the test suite and by restore-to-scratch
 * runs. They are the only non-`ausspend_dev` names the tools accept, and then
 * only with an explicit flag.
 */
export const SCRATCH_DB_PATTERN =
  /^ausspend_(?:test|restore_test|backup_test|gate_test|seed_test)_[A-Za-z0-9_]+$/;

export function databaseNameFromUrl(mongoUrl) {
  try {
    const url = new URL(mongoUrl);
    const name = decodeURIComponent(url.pathname.replace(/^\//, '').replace(/\/$/, ''));
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export function mongoUrlWithDatabase(mongoUrl, databaseName) {
  const url = new URL(mongoUrl);
  url.pathname = `/${encodeURIComponent(databaseName)}`;
  return url.toString();
}

/** Never print credentials: use this for every log line that names a Mongo URL. */
export function redactMongoUrl(mongoUrl) {
  try {
    const url = new URL(mongoUrl);
    const hasCredentials = url.username.length > 0 || url.password.length > 0;
    const auth = hasCredentials ? '***:***@' : '';
    const search = url.search ? url.search : '';
    return `${url.protocol}//${auth}${url.host}${url.pathname}${search}`;
  } catch {
    return '(unparseable MONGO_URL)';
  }
}

/** The pool Mongo (27018) must never be a backup, restore or test target. */
export function assertNotPoolMongo(mongoUrl) {
  let url;
  try {
    url = new URL(mongoUrl);
  } catch {
    throw new Error('MONGO_URL is not a valid MongoDB URL');
  }
  if (url.port === '27018') {
    throw new Error(`Refusing ${redactMongoUrl(mongoUrl)}: pool Mongo port 27018 is forbidden`);
  }
}

export function isScratchDatabaseName(databaseName) {
  return typeof databaseName === 'string' && SCRATCH_DB_PATTERN.test(databaseName);
}

export function isInside(parentDir, childDir) {
  const relative = path.relative(path.resolve(parentDir), path.resolve(childDir));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** Stable checksum over sorted natural keys, including duplicates. */
export function naturalKeyChecksum(keys) {
  return sha256([...keys].sort().join('\n'));
}

export function countLines(content) {
  if (content.length === 0) return 0;
  const normalised = content.endsWith('\n') ? content.slice(0, -1) : content;
  return normalised.length === 0 ? 0 : normalised.split('\n').length;
}

/**
 * Count lines in a file without materialising it as one string.
 *
 * Backups can hold collection files larger than V8's maximum string length
 * (~512 MiB), where `fs.readFile(file, 'utf8')` throws
 * "RangeError: Invalid string length". This walks the file in fixed-size
 * chunks and applies exactly the same rule as `countLines`: an empty file has
 * zero lines, a trailing newline terminates the final line and does not add an
 * empty one, and a lone newline is zero lines.
 */
export async function countFileLines(filePath) {
  let bytes = 0;
  let newlines = 0;
  let lastByte = -1;

  for await (const chunk of createReadStream(filePath)) {
    bytes += chunk.length;
    for (let i = 0; i < chunk.length; i += 1) {
      if (chunk[i] === 0x0a) newlines += 1;
    }
    lastByte = chunk[chunk.length - 1];
  }

  if (bytes === 0) return 0;
  if (lastByte === 0x0a) return newlines === 1 && bytes === 1 ? 0 : newlines;
  return newlines + 1;
}

/**
 * Yield the lines of a file with the same semantics as
 * `(await fs.readFile(filePath, 'utf8')).split('\n')`, but streaming.
 * Callers that want to ignore one trailing newline can drop a final empty
 * entry, exactly as before. Throws if the file cannot be read.
 */
export async function* readFileLines(filePath) {
  let remainder = '';
  let sawBytes = false;

  for await (const chunk of createReadStream(filePath, { encoding: 'utf8' })) {
    sawBytes = true;
    remainder += chunk;
    let index;
    while ((index = remainder.indexOf('\n')) !== -1) {
      yield remainder.slice(0, index);
      remainder = remainder.slice(index + 1);
    }
  }

  if (sawBytes) yield remainder;
}

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readManifest(backupDir) {
  const manifestPath = path.join(backupDir, 'manifest.json');
  let raw;
  try {
    raw = await fs.readFile(manifestPath, 'utf8');
  } catch {
    throw new Error(`No manifest.json in backup directory ${backupDir}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new Error(`manifest.json in ${backupDir} is not valid JSON`);
  }

  if (manifest?.schema_version !== BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported backup manifest schema ${String(manifest?.schema_version)} (expected ${BACKUP_SCHEMA_VERSION})`,
    );
  }
  if (manifest?.status !== 'complete') {
    throw new Error(`Backup ${backupDir} is not complete (status=${String(manifest?.status)})`);
  }
  if (typeof manifest.database !== 'string' || manifest.database.length === 0) {
    throw new Error(`Backup ${backupDir} does not name its source database`);
  }
  if (!Array.isArray(manifest.collections) || manifest.collections.length === 0) {
    throw new Error(`Backup ${backupDir} has no collection list`);
  }
  if (!manifest.natural_key || typeof manifest.natural_key !== 'object') {
    throw new Error(`Backup ${backupDir} has no natural_key summary`);
  }

  return manifest;
}

/**
 * Verify a backup directory is internally consistent and (optionally) fresh and
 * from the expected database. This is the check the backfill gate and restore
 * both rely on; it never trusts a manifest without re-reading the data files.
 */
export async function verifyBackupIntegrity(
  backupDir,
  { expectedDatabase, maxAgeMinutes, now = new Date(), requireDataSources = true } = {},
) {
  const manifest = await readManifest(backupDir);

  if (expectedDatabase && manifest.database !== expectedDatabase) {
    throw new Error(
      `Backup is from "${manifest.database}", expected "${expectedDatabase}"; refusing to use it`,
    );
  }

  if (typeof manifest.created_at !== 'string') {
    throw new Error(`Backup ${backupDir} has no created_at timestamp`);
  }
  const createdAt = new Date(manifest.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error(`Backup ${backupDir} has an invalid created_at timestamp`);
  }

  const ageMinutes = (now.getTime() - createdAt.getTime()) / 60_000;
  if (ageMinutes < -5) {
    throw new Error(`Backup ${backupDir} is dated in the future (${manifest.created_at})`);
  }
  if (typeof maxAgeMinutes === 'number' && ageMinutes > maxAgeMinutes) {
    throw new Error(
      `Backup ${backupDir} is ${ageMinutes.toFixed(1)} minutes old; maximum is ${maxAgeMinutes} minutes`,
    );
  }

  const seen = new Set();
  for (const entry of manifest.collections) {
    if (!entry || typeof entry.name !== 'string' || typeof entry.file !== 'string') {
      throw new Error(`Backup ${backupDir} has an invalid collection entry`);
    }
    if (seen.has(entry.name)) {
      throw new Error(`Backup ${backupDir} lists collection ${entry.name} twice`);
    }
    seen.add(entry.name);

    if (path.basename(entry.file) !== entry.file) {
      throw new Error(`Backup ${backupDir} collection file escapes the backup directory`);
    }
    const filePath = path.join(backupDir, entry.file);
    let lines;
    try {
      lines = await countFileLines(filePath);
    } catch {
      throw new Error(`Backup ${backupDir} is missing collection file ${entry.file}`);
    }
    if (lines !== entry.count) {
      throw new Error(
        `Backup ${backupDir} collection ${entry.name} has ${lines} lines but manifest says ${entry.count}`,
      );
    }
  }

  if (requireDataSources && !Array.isArray(manifest.data_sources)) {
    throw new Error(`Backup ${backupDir} has no data_sources status list`);
  }

  const nk = manifest.natural_key;
  if (
    typeof nk.file !== 'string' ||
    typeof nk.count !== 'number' ||
    typeof nk.distinct_count !== 'number' ||
    typeof nk.checksum !== 'string'
  ) {
    throw new Error(`Backup ${backupDir} has an invalid natural_key summary`);
  }
  if (path.basename(nk.file) !== nk.file) {
    throw new Error(`Backup ${backupDir} natural-key file escapes the backup directory`);
  }
  const keys = [];
  try {
    for await (const line of readFileLines(path.join(backupDir, nk.file))) {
      keys.push(line);
    }
  } catch {
    throw new Error(`Backup ${backupDir} is missing natural-key file ${nk.file}`);
  }
  // A single trailing newline terminates the last key; it is not an empty key.
  if (keys.length > 0 && keys[keys.length - 1] === '') keys.pop();
  const distinct = new Set(keys).size;
  if (keys.length !== nk.count) {
    throw new Error(
      `Backup ${backupDir} has ${keys.length} natural keys but manifest says ${nk.count}`,
    );
  }
  if (distinct !== nk.distinct_count) {
    throw new Error(
      `Backup ${backupDir} has ${distinct} distinct natural keys but manifest says ${nk.distinct_count}`,
    );
  }
  const checksum = naturalKeyChecksum(keys);
  if (checksum !== nk.checksum) {
    throw new Error(`Backup ${backupDir} natural-key checksum does not match the manifest`);
  }

  return { manifest, ageMinutes };
}

/**
 * Remove only timestamped backup directories inside the configured backup root.
 * Non-matching paths are never deleted.
 */
export async function pruneBackups(root, keep) {
  if (!Number.isInteger(keep) || keep < 1) {
    throw new Error('--prune must be a positive integer');
  }

  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !TIMESTAMP_DIR_PATTERN.test(entry.name)) continue;
    const dir = path.join(root, entry.name);
    if (await pathExists(path.join(dir, 'manifest.json'))) candidates.push(entry.name);
  }

  candidates.sort().reverse();
  const removed = [];
  for (const name of candidates.slice(keep)) {
    await fs.rm(path.join(root, name), { recursive: true, force: true });
    removed.push(name);
  }
  return removed;
}
