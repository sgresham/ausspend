/**
 * The only database the development seed may ever reset.
 */
export const SEED_DATABASE_NAME = 'ausspend_dev';

export function databaseNameFromUrl(mongoUrl: string): string | null {
  try {
    const url = new URL(mongoUrl);
    const name = decodeURIComponent(url.pathname.replace(/^\//, '').replace(/\/$/, ''));
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

/**
 * Refuse to run unless MONGO_URL points at exactly `ausspend_dev`. This is the
 * guard that stops a stray environment from wiping another database.
 */
export function assertSeedTarget(mongoUrl: string | undefined): string {
  if (!mongoUrl) {
    throw new Error('MONGO_URL is required to seed (expected a URL ending in /ausspend_dev)');
  }

  const name = databaseNameFromUrl(mongoUrl);
  if (name !== SEED_DATABASE_NAME) {
    throw new Error(
      `Refusing to seed database "${name ?? '(unknown)'}": the seed only runs against "${SEED_DATABASE_NAME}"`,
    );
  }

  return name;
}
