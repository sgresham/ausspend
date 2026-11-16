import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** The only application database a backup/restore may touch by default. */
export const APP_DATABASE = 'ausspend_dev';
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_ROOT_DEFAULT = '/home/steve/backups/ausspend';
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
    let content;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      throw new Error(`Backup ${backupDir} is missing collection file ${entry.file}`);
    }
    const lines = countLines(content);
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
  let keyContent;
  try {
    keyContent = await fs.readFile(path.join(backupDir, nk.file), 'utf8');
  } catch {
    throw new Error(`Backup ${backupDir} is missing natural-key file ${nk.file}`);
  }
  const keys = keyContent.length === 0 ? [] : keyContent.replace(/\n$/, '').split('\n');
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
