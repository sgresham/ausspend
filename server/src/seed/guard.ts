/**
 * The only database the development seed may reset.
 */
export const SEED_DATABASE_NAME = 'ausspend_dev';

/** Scratch databases that an explicit SEED_ALLOW_SCRATCH=1 may seed for tests. */
const SCRATCH_DATABASE_PATTERN =
  /^ausspend_(?:test|restore_test|backup_test|gate_test|seed_test)_[A-Za-z0-9_]+$/;

export function databaseNameFromUrl(mongoUrl: string): string | null {
  try {
    const url = new URL(mongoUrl);
    const name = decodeURIComponent(url.pathname.replace(/^\//, '').replace(/\/$/, ''));
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export function isScratchDatabaseName(name: string | null): boolean {
  return name !== null && SCRATCH_DATABASE_PATTERN.test(name);
}

/**
 * Refuse to run unless MONGO_URL points at exactly `ausspend_dev`. This is the
 * guard that stops a stray environment from wiping another database.
 *
 * `SEED_ALLOW_SCRATCH=1` additionally permits an explicit `ausspend_test_*` /
 * `ausspend_restore_test_*` scratch database for the data-safety tests. The
 * production seed path never sets it. Pool Mongo (port 27018) is always refused.
 */
export function assertSeedTarget(mongoUrl: string | undefined): string {
  if (!mongoUrl) {
    throw new Error('MONGO_URL is required to seed (expected a URL ending in /ausspend_dev)');
  }

  const name = databaseNameFromUrl(mongoUrl);
  let port = '';
  try {
    port = new URL(mongoUrl).port;
  } catch {
    port = '';
  }

  if (port === '27018') {
    throw new Error(
      `Refusing to seed database "${name ?? '(unknown)'}": pool Mongo port 27018 is forbidden`,
    );
  }

  const allowScratch = process.env.SEED_ALLOW_SCRATCH === '1';
  const allowedScratch = allowScratch && isScratchDatabaseName(name);

  if (name !== SEED_DATABASE_NAME && !allowedScratch) {
    throw new Error(
      `Refusing to seed database "${name ?? '(unknown)'}": the seed only runs against "${SEED_DATABASE_NAME}"` +
        (allowScratch
          ? ' or an explicit ausspend_test_*/ausspend_restore_test_* scratch database'
          : ''),
    );
  }

  return name as string;
}
