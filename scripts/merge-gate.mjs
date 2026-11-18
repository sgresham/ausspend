#!/usr/bin/env node
/**
 * Required landing gate for connector changes.
 *
 * Runs after a connector branch is merged and before main is pushed (CI also
 * runs it on every push/PR). It:
 *   1. regenerates the connector manifest and source register from the modules,
 *   2. fails if those generated files are not committed/current,
 *   3. runs the connectors, golden and m2-api tests.
 *
 * `TEST_MONGO_URL` (or `MONGO_URL`) is required: m2-api drops and reseeds its
 * target database. The gate always isolates itself in a scratch database so it
 * can never wipe a shared dev/test database.
 */
import { execFileSync } from 'node:child_process';

const base = process.env.TEST_MONGO_URL ?? process.env.MONGO_URL;
if (!base) {
  console.error(
    '[merge-gate] TEST_MONGO_URL or MONGO_URL is required; m2-api drops its target database.',
  );
  process.exit(1);
}

const url = new URL(base);
url.pathname = `/ausspend_gate_${process.pid}_${Date.now()}`;
const env = { ...process.env, TEST_MONGO_URL: url.toString() };

function run(command, args) {
  console.error(`[merge-gate] ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit', env });
}

function capture(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', env });
}

run('npm', ['run', 'generate:connectors']);
run('npm', ['run', 'generate:sources']);

const dirty = capture('git', [
  'status',
  '--porcelain',
  '--',
  'server/src/connectors/generated-connectors.ts',
  'server/test/generated-gpfs-fixtures.ts',
  'docs/sources',
]).trim();
if (dirty) {
  console.error('[merge-gate] generated files are not committed/current:\n' + dirty);
  console.error(
    '[merge-gate] run `npm run generate:connectors && npm run generate:sources` and commit the result.',
  );
  process.exit(1);
}

run('npm', ['run', 'build', '-w', 'shared']);

run('npx', [
  'vitest',
  'run',
  'server/test/connectors.test.ts',
  'server/test/gpfs-modules-golden.test.ts',
  '--reporter=dot',
]);
run('npx', ['vitest', 'run', 'server/test/m2-api.test.ts', '--reporter=dot']);

console.error('[merge-gate] PASS');
