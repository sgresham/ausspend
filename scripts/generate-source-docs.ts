import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MODULAR_CONNECTOR_MODULES } from '../server/src/connectors/generated-connectors.js';
import { CONNECTORS } from '../server/src/connectors/registry.js';

const README_BEGIN = '<!-- BEGIN GENERATED SOURCE COUNTS (npm run generate:sources) -->';
const README_END = '<!-- END GENERATED SOURCE COUNTS -->';
const NSW_BEGIN = '<!-- BEGIN GENERATED NSW COUNCIL COUNTS (npm run generate:sources) -->';
const NSW_END = '<!-- END GENERATED NSW COUNCIL COUNTS -->';

/** Ids whose `jurisdiction_level` is `local` but which are not NSW councils. */
const NON_NSW_LOCAL_IDS = new Set([
  'qld-local-government',
  'vic-lgprf',
  'vic-vlgc-abs',
  'vic-vlgc-fag',
  'vic-vlgc-vgc1',
]);

export interface SourceCounts {
  registeredConnectors: number;
  activeConnectors: number;
  degradedConnectors: number;
  stubConnectors: number;
  nswCouncilGpfs: number;
  nswLocalGovernment: number;
  tradeConnectors: number;
  sourceDocs: number;
}

function tradeConnectorDirs(): string[] {
  const tradeRoot = path.resolve('server/src/connectors/trade');
  return existsSync(tradeRoot)
    ? readdirSync(tradeRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => existsSync(path.join(tradeRoot, name, 'index.ts')))
        .sort()
    : [];
}

function isNswCouncilGpfs(id: string): boolean {
  return id.endsWith('-gpfs') && !NON_NSW_LOCAL_IDS.has(id);
}

function isNswLocalGovernment(id: string, jurisdictionLevel: string): boolean {
  // GPFS modules are NSW councils; Dubbo keeps its budget connector under its
  // own id. Other states' local-government connectors are excluded by id.
  return (
    jurisdictionLevel === 'local' &&
    !NON_NSW_LOCAL_IDS.has(id) &&
    (isNswCouncilGpfs(id) || id === 'dubbo-council')
  );
}

/**
 * Deterministic current-state counts derived from the checked-in connector
 * registry and trade subtree. This never reads MongoDB, so CI can run it.
 */
export function computeSourceCounts(): SourceCounts {
  const counts = { active: 0, degraded: 0, stub: 0 };
  for (const connector of CONNECTORS) {
    if (connector.status === 'active') counts.active += 1;
    else if (connector.status === 'degraded') counts.degraded += 1;
    else if (connector.status === 'stub') counts.stub += 1;
  }
  const tradeDirs = tradeConnectorDirs();
  return {
    registeredConnectors: CONNECTORS.length,
    activeConnectors: counts.active,
    degradedConnectors: counts.degraded,
    stubConnectors: counts.stub,
    nswCouncilGpfs: CONNECTORS.filter((connector) => isNswCouncilGpfs(connector.id)).length,
    nswLocalGovernment: CONNECTORS.filter((connector) =>
      isNswLocalGovernment(connector.id, connector.jurisdiction_level),
    ).length,
    tradeConnectors: tradeDirs.length,
    sourceDocs: MODULAR_CONNECTOR_MODULES.length + tradeDirs.length,
  };
}

export async function renderReadmeSourceCounts(counts: SourceCounts): Promise<string> {
  const block = `${README_BEGIN}
## Current source counts

Generated from the checked-in connector registry by \`npm run generate:sources\` and verified by
\`npm run check:doc-counts\`. Do not edit this block by hand.

| Current-state count | Value |
| --- | --- |
| Registered spending connectors | ${counts.registeredConnectors} |
| Active spending connectors | ${counts.activeConnectors} |
| Degraded spending connectors | ${counts.degradedConnectors} |
| Stub spending connectors | ${counts.stubConnectors} |
| NSW council GPFS sources | ${counts.nswCouncilGpfs} |
| NSW local-government source ids | ${counts.nswLocalGovernment} |
| Trade connectors (separate subtree) | ${counts.tradeConnectors} |
| Generated connector source docs | ${counts.sourceDocs} |

These are current registry counts, not database row counts. The landing notes in
[\`docs/NSW_COUNCILS.md\`](./docs/NSW_COUNCILS.md) are chronological snapshots of individual
ingests and are never rewritten by this generator. Live totals for registered \`data_sources\`,
spending measures and trade records are served by \`GET /api/coverage\`; they are not hard-coded
here or checked in CI because no stable checked-in metadata file records them.
${README_END}`;
  return (await format(block, { parser: 'markdown' })).trimEnd();
}

export async function renderNswCouncilCounts(counts: SourceCounts): Promise<string> {
  const block = `${NSW_BEGIN}
## Current source counts vs historical landing snapshots

The §7 landing records below are **chronological snapshots** taken at each ingest. They are kept
as evidence and are not current totals. The current registry counts are:

| Current-state count | Value |
| --- | --- |
| NSW council GPFS sources | ${counts.nswCouncilGpfs} |
| NSW local-government source ids | ${counts.nswLocalGovernment} |
| Registered spending connectors | ${counts.registeredConnectors} |
| Active spending connectors | ${counts.activeConnectors} |
| Stub spending connectors | ${counts.stubConnectors} |
| Trade connectors (separate subtree) | ${counts.tradeConnectors} |

Live database totals (registered \`data_sources\`, spending measures and trade records) come from
\`GET /api/coverage\`, not from this file, so they cannot drift here and are not checked in CI.
${NSW_END}`;
  return (await format(block, { parser: 'markdown' })).trimEnd();
}

function replaceBlock(
  file: string,
  text: string,
  begin: string,
  end: string,
  block: string,
): string {
  const start = text.indexOf(begin);
  const finish = text.indexOf(end);
  if (start === -1 || finish === -1 || finish < start) {
    throw new Error(`[generate-sources] missing generated-count markers in ${file}`);
  }
  const before = text.slice(0, start);
  const after = text.slice(finish + end.length);
  return `${before}${block}${after}`;
}

async function updateMarkedDocs(counts: SourceCounts): Promise<void> {
  const readmePath = path.resolve('README.md');
  const readme = readFileSync(readmePath, 'utf8');
  await writeFile(
    readmePath,
    replaceBlock(
      readmePath,
      readme,
      README_BEGIN,
      README_END,
      await renderReadmeSourceCounts(counts),
    ),
  );

  const nswPath = path.resolve('docs/NSW_COUNCILS.md');
  const nsw = readFileSync(nswPath, 'utf8');
  await writeFile(
    nswPath,
    replaceBlock(nswPath, nsw, NSW_BEGIN, NSW_END, await renderNswCouncilCounts(counts)),
  );
}

export async function generateSourceDocs(): Promise<void> {
  const outDir = path.resolve('docs/sources');
  await mkdir(outDir, { recursive: true });

  const rows: string[] = [];
  for (const module of MODULAR_CONNECTOR_MODULES) {
    const connector = module.create();
    const filename = `${connector.id}.md`;
    rows.push(
      `| [\`${connector.id}\`](${filename}) | ${connector.publisher} | ${connector.jurisdiction_level} | ${connector.status} |`,
    );
    await writeFile(
      path.join(outDir, filename),
      await format(
        `# ${connector.name}\n\n` +
          `- id: \`${connector.id}\`\n` +
          `- publisher: ${connector.publisher}\n` +
          `- source: <${connector.source_url}>\n` +
          `- jurisdiction: ${connector.jurisdiction_level}\n` +
          `- status: ${connector.status}\n` +
          `- licence: ${connector.license ?? 'not stated'}\n\n` +
          `${connector.notes ?? ''}\n`,
        { parser: 'markdown' },
      ),
    );
  }

  // Trade connectors live under a separate subtree and are not part of the
  // spending MODULAR_CONNECTOR_MODULES registry. They still publish source docs.
  const tradeRoot = path.resolve('server/src/connectors/trade');
  const tradeDirs = tradeConnectorDirs();
  for (const dir of tradeDirs) {
    const moduleUrl = pathToFileURL(path.join(tradeRoot, dir, 'index.ts')).href;
    const loaded = (await import(moduleUrl)) as {
      connectorModule?: {
        create: () => {
          id: string;
          doc_id?: string;
          name: string;
          publisher: string;
          source_url: string;
          jurisdiction_level: string;
          status: string;
          license?: string;
          notes?: string;
        };
      };
    };
    if (!loaded.connectorModule) continue;
    const connector = loaded.connectorModule.create();
    const docId = connector.doc_id ?? connector.id;
    const filename = `${docId}.md`;
    rows.push(
      `| [\`${connector.id}\`](${filename}) | ${connector.publisher} | ${connector.jurisdiction_level} | ${connector.status} |`,
    );
    await writeFile(
      path.join(outDir, filename),
      await format(
        `# ${connector.name}\n\n` +
          `- id: \`${connector.id}\`\n` +
          `- publisher: ${connector.publisher}\n` +
          `- source: <${connector.source_url}>\n` +
          `- jurisdiction: ${connector.jurisdiction_level}\n` +
          `- status: ${connector.status}\n` +
          `- licence: ${connector.license ?? 'not stated'}\n\n` +
          `${connector.notes ?? ''}\n`,
        { parser: 'markdown' },
      ),
    );
  }

  const counts = computeSourceCounts();
  await writeFile(
    path.join(outDir, 'README.md'),
    await format(
      `# Connector source register\n\nGenerated by \`scripts/generate-source-docs.ts\`. Do not edit by hand.\n\n` +
        `${counts.registeredConnectors} registered spending connectors (${counts.activeConnectors} active, ` +
        `${counts.stubConnectors} stub) plus ${counts.tradeConnectors} trade connectors are documented here; ` +
        `see the generated [current source counts](../../README.md#current-source-counts) for the canonical totals.\n\n` +
        `| Source | Publisher | Jurisdiction | Status |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`,
      { parser: 'markdown' },
    ),
  );

  await updateMarkedDocs(counts);
  console.log(
    `[generate-sources] wrote ${MODULAR_CONNECTOR_MODULES.length + tradeDirs.length} module doc(s); ` +
      `registry=${counts.registeredConnectors} active=${counts.activeConnectors} ` +
      `stub=${counts.stubConnectors} nsw-gpfs=${counts.nswCouncilGpfs} nsw-local=${counts.nswLocalGovernment}`,
  );
}

const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  await generateSourceDocs();
}
