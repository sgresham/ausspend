#!/usr/bin/env node
/**
 * Fails when the current-state connector/source counts in the docs drift from
 * the checked-in connector registry. Counts are derived with the same function
 * as the generator, so this never needs MongoDB and never checks live row
 * totals (those are served by /api/coverage).
 *
 * Run: npm run check:doc-counts
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tsImport } from 'tsx/esm/api';

const root = path.resolve(import.meta.dirname, '..');
const { computeSourceCounts, renderReadmeSourceCounts, renderNswCouncilCounts } = await tsImport(
  './generate-source-docs.ts',
  import.meta.url,
);

const problems = [];
const fail = (message) => problems.push(message);
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

const counts = computeSourceCounts();

const readme = read('README.md');
if (!readme.includes(await renderReadmeSourceCounts(counts))) {
  fail(
    'README.md generated source-count block is stale; run `npm run generate:sources` and commit the result',
  );
}

const nsw = read('docs/NSW_COUNCILS.md');
if (!nsw.includes(await renderNswCouncilCounts(counts))) {
  fail(
    'docs/NSW_COUNCILS.md generated source-count block is stale; run `npm run generate:sources` and commit the result',
  );
}

for (const stale of [
  'thirty-one audited council GPFS',
  'fifty-one Australian public-spending sources',
  'the twenty-seven `connectors`',
  'seven stubs',
]) {
  if (readme.includes(stale)) {
    fail(`README.md still contains stale current-state phrase: ${JSON.stringify(stale)}`);
  }
}

// The source-doc register must cover exactly the generated module docs, and
// every generated document must be present. This catches a registry module
// added without re-running the generator.
const sourcesDir = path.join(root, 'docs/sources');
const docs = readdirSync(sourcesDir).filter((name) => name.endsWith('.md') && name !== 'README.md');
if (docs.length !== counts.sourceDocs) {
  fail(
    `docs/sources has ${docs.length} module doc(s) but the registry generates ${counts.sourceDocs}; run \`npm run generate:sources\``,
  );
}
const register = read('docs/sources/README.md');
const registerRows = register.split('\n').filter((line) => line.startsWith('| [')).length;
if (registerRows !== counts.sourceDocs) {
  fail(
    `docs/sources/README.md lists ${registerRows} source row(s) but the registry generates ${counts.sourceDocs}`,
  );
}

if (problems.length > 0) {
  console.error('[check-doc-counts] FAIL');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(
  `[check-doc-counts] OK registry=${counts.registeredConnectors} active=${counts.activeConnectors} ` +
    `stub=${counts.stubConnectors} nsw-gpfs=${counts.nswCouncilGpfs} ` +
    `nsw-local=${counts.nswLocalGovernment} trade=${counts.tradeConnectors} docs=${counts.sourceDocs}`,
);
