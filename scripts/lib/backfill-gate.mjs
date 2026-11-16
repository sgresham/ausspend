import path from 'node:path';
import { APP_DATABASE, verifyBackupIntegrity } from './backup-format.mjs';

export const DEFAULT_MAX_AGE_MINUTES = 60;

/**
 * The historical AusTender backfill is only allowed when the caller:
 *   1. passes the explicit --backfill flag in scripts/ingest-federal.ts,
 *   2. sets BACKFILL_CONFIRM=yes, and
 *   3. points BACKUP_DIR at a complete, recent, verified backup of ausspend_dev.
 *
 * A missing, stale, truncated or mismatched backup refuses the backfill before
 * any network fetch or database write.
 */
export async function assertBackfillAllowed({
  backupDir,
  confirm,
  maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES,
  now = new Date(),
} = {}) {
  if (confirm !== 'yes') {
    throw new Error(
      'Refusing AusTender backfill: BACKFILL_CONFIRM=yes is required after the user/approver confirms',
    );
  }
  if (!backupDir) {
    throw new Error('Refusing AusTender backfill: BACKUP_DIR (or --backup-dir) is required');
  }
  if (!Number.isFinite(maxAgeMinutes) || maxAgeMinutes <= 0) {
    throw new Error('BACKFILL_MAX_BACKUP_AGE_MINUTES must be a positive number');
  }

  const resolved = path.resolve(backupDir);
  const { manifest, ageMinutes } = await verifyBackupIntegrity(resolved, {
    expectedDatabase: APP_DATABASE,
    maxAgeMinutes,
    now,
    requireDataSources: true,
  });

  if (manifest.natural_key.count < 1) {
    throw new Error(`Refusing AusTender backfill: backup ${resolved} has no natural keys`);
  }

  return { backupDir: resolved, manifest, ageMinutes };
}
