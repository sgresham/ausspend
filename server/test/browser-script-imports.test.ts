import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for the GPFS module retrofit.
 *
 * The retrofit moved flat `server/src/connectors/<id>-gpfs.ts` adapters into
 * `server/src/connectors/<id>-gpfs/index.ts`. Browser helper scripts under
 * `scripts/` import the compiled `.js` specifiers, so a stale flat import does
 * not fail typechecking (scripts are not in the server build) but does fail at
 * runtime with ERR_MODULE_NOT_FOUND, e.g. `npm run ingest:nsw`.
 *
 * This test scans every tracked file under `scripts/` for relative imports that
 * point into `server/src/connectors/` and asserts the target module exists,
 * following the TypeScript convention that `./x.js` is authored as `./x.ts`.
 */

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const connectorDir = path.join(repoRoot, 'server', 'src', 'connectors');

const SCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']);
const IMPORT_SPECIFIER = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

/** The 11 browser helpers that must be covered by this scan. */
const EXPECTED_BROWSER_SCRIPTS = [
  'scripts/coffs-harbour-gpfs-browser.ts',
  'scripts/ku-ring-gai-gpfs-browser.ts',
  'scripts/lake-macquarie-gpfs-browser.ts',
  'scripts/liverpool-gpfs-browser.ts',
  'scripts/mid-coast-gpfs-browser.ts',
  'scripts/north-sydney-gpfs-browser.ts',
  'scripts/port-macquarie-hastings-gpfs-browser.ts',
  'scripts/randwick-gpfs-browser.ts',
  'scripts/waverley-gpfs-browser.ts',
  'scripts/willoughby-gpfs-browser.ts',
  'scripts/wollongong-gpfs-browser.ts',
] as const;

function trackedScripts(): string[] {
  const output = execFileSync('git', ['ls-files', '-z', '--', 'scripts'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return output.split('\0').filter(Boolean);
}

/**
 * Existence check that mirrors the TS/ESM authoring convention: a specifier
 * ending in `.js` may be satisfied by the sibling `.ts` source. It deliberately
 * does NOT fall back to a directory index, because that is the exact stale
 * `/connectors/<id>-gpfs.js` -> `/connectors/<id>-gpfs/index.js` mistake.
 */
function moduleExists(absPath: string): boolean {
  if (existsSync(absPath)) return true;
  if (absPath.endsWith('.js')) return existsSync(`${absPath.slice(0, -3)}.ts`);
  if (absPath.endsWith('.mjs')) return existsSync(`${absPath.slice(0, -4)}.mts`);
  if (absPath.endsWith('.cjs')) return existsSync(`${absPath.slice(0, -4)}.cts`);
  return false;
}

function relativeConnectorTarget(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const resolved = path.resolve(path.dirname(fromFile), specifier);
  const relative = path.relative(connectorDir, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

describe('browser script connector imports', () => {
  it('resolves every tracked scripts/** import into server/src/connectors', () => {
    const tracked = trackedScripts();
    expect(tracked.length, 'git ls-files returned no tracked scripts').toBeGreaterThan(0);
    for (const script of EXPECTED_BROWSER_SCRIPTS) {
      expect(tracked, `${script} is not tracked`).toContain(script);
    }

    const offenders: string[] = [];
    let checked = 0;

    for (const relativeScript of tracked) {
      if (!SCRIPT_EXTENSIONS.has(path.extname(relativeScript))) continue;
      const fromFile = path.join(repoRoot, relativeScript);
      const source = readFileSync(fromFile, 'utf8');

      for (const match of source.matchAll(IMPORT_SPECIFIER)) {
        const specifier = match[1]!;
        const target = relativeConnectorTarget(fromFile, specifier);
        if (!target) continue;
        checked += 1;
        if (!moduleExists(target)) {
          offenders.push(
            `${relativeScript} imports "${specifier}" -> missing ${path.relative(repoRoot, target)}`,
          );
        }
      }
    }

    expect(checked, 'no connector imports were found in tracked scripts').toBeGreaterThan(0);
    expect(offenders, 'stale imports into server/src/connectors').toEqual([]);
  });
});
