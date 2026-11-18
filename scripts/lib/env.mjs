import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Shared environment loader for CLI/scripts. Safe local defaults; never an
 * internal hostname, private IP or user-specific absolute path.
 */
export function mongodbUrl(env = process.env) {
  return env.MONGO_URL?.trim() || 'mongodb://localhost:27017/ausspend_dev';
}

export function sourceArchiveRoot(env = process.env) {
  return env.AUSSPEND_SOURCE_ARCHIVE?.trim() || path.join(homedir(), 'ausspend-source-archive');
}

export function backupRoot(env = process.env) {
  return env.AUSSPEND_BACKUP_ROOT?.trim() || path.join(homedir(), 'ausspend-backups');
}

export function deployRoot(env = process.env) {
  return env.AUSSPEND_DEPLOY_ROOT?.trim() || path.join(homedir(), 'ausspend');
}

export function tlsDir(env = process.env) {
  return env.AUSSPEND_TLS_DIR?.trim() || path.join(homedir(), '.config', 'ausspend', 'tls');
}

export function clientOrigin(env = process.env) {
  return env.CLIENT_ORIGIN?.trim() || 'http://localhost:5173';
}

export function port(env = process.env, name = 'PORT', fallback = 3001) {
  const value = Number(env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
