import 'dotenv/config';
import mongoose from 'mongoose';
import {
  WOLLONGONG_GPFS_ID,
  createWollongongGpfsConnector,
  ensureDubboRegion,
  getConnector,
  runIngestion,
} from '../server/src/connectors/index.js';
import type { Connector } from '../server/src/connectors/types.js';
import { fetchWollongongGpfsViaBrowser } from './wollongong-gpfs-browser.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * NSW ingestion (S1 + S2).
 *
 *   MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev npm run ingest:nsw
 *   MONGO_URL=... npm run ingest:nsw -- --source data-nsw-ckan
 *
 * With no `--source`, every registered NSW source runs sequentially:
 *   - nsw-budget      S1: NSW Budget 2025-26 Open Data XLSX + ArcGIS capital
 *   - data-nsw-ckan   S2: targeted data.nsw.gov.au CKAN datasets
 *   - dubbo-council   S3: one local council (Dubbo Regional Council) budget PDF
 *   - dubbo-council-gpfs  GPFS pilot: the same council's audited FY2024-25 GPFS
 *   - city-of-sydney-gpfs  GPFS expansion: the City of Sydney's audited FY2024-25 GPFS
 *   - blacktown-gpfs      GPFS expansion: Blacktown City Council's audited FY2024-25 GPFS
 *   - parramatta-gpfs     GPFS expansion: City of Parramatta's audited FY2024-25 GPFS
 *   - northern-beaches-gpfs  GPFS expansion: Northern Beaches Council's audited FY2024-25 GPFS
 *   - canterbury-bankstown-gpfs  GPFS expansion: Canterbury-Bankstown Council's audited FY2024-25 GPFS
 *   - sutherland-shire-gpfs  GPFS expansion: Sutherland Shire Council's audited FY2024-25 GPFS
 *   - wollongong-gpfs      GPFS expansion: Wollongong City Council's audited FY2024-25 GPFS
 *   - newcastle-gpfs       GPFS expansion: Newcastle City Council's audited FY2024-25 GPFS
 *
 * S3 deliberately covers only Dubbo Regional Council, and the GPFS expansion
 * adds only the City of Sydney, Blacktown City Council, the City of Parramatta,
 * Northern Beaches Council, Canterbury-Bankstown Council, Sutherland Shire
 * Council, Wollongong City Council and Newcastle City Council. No other councils,
 * states/territories, SOC/charity or live state connectors are touched. The
 * runner upserts on natural_key, so re-running is idempotent and never deletes
 * existing federal/synthetic rows.
 */
export const NSW_SOURCE_IDS = [
  'nsw-budget',
  'data-nsw-ckan',
  'dubbo-council',
  'dubbo-council-gpfs',
  'city-of-sydney-gpfs',
  'blacktown-gpfs',
  'parramatta-gpfs',
  'northern-beaches-gpfs',
  'canterbury-bankstown-gpfs',
  'sutherland-shire-gpfs',
  'wollongong-gpfs',
  'newcastle-gpfs',
] as const;

function requestedSource(argv: readonly string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg.startsWith('--source=')) return arg.slice('--source='.length);
    if (arg === '--source') return argv[index + 1] ?? null;
  }
  return null;
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  const requested = requestedSource(process.argv.slice(2));
  const sourceIds = requested ? [requested] : [...NSW_SOURCE_IDS];
  const connectors: Connector[] = [];
  for (const id of sourceIds) {
    if (id === WOLLONGONG_GPFS_ID) {
      // Wollongong's site enforces a Cloudflare managed challenge that returns
      // HTTP 403 to non-browser clients; the documented headless Chromium path
      // clears it, and the connector still discovers the PDF link from the
      // cleared HTML and re-verifies the bytes.
      console.log('[ingest:nsw] wollongong-gpfs: browser discovery/download starting');
      const fetched = await fetchWollongongGpfsViaBrowser();
      console.log(`[ingest:nsw] wollongong-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createWollongongGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
    const connector = getConnector(id);
    if (!connector) {
      throw new Error(`unknown NSW source "${id}"; expected one of ${NSW_SOURCE_IDS.join(', ')}`);
    }
    if (connector.jurisdiction_level !== 'state' && connector.jurisdiction_level !== 'local') {
      throw new Error(`${id} is not a state/local source (${connector.jurisdiction_level})`);
    }
    if (connector.status !== 'active') throw new Error(`${id} connector is ${connector.status}`);
    connectors.push(connector);
  }

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    if (sourceIds.some((id) => id === 'dubbo-council' || id === 'dubbo-council-gpfs')) {
      const regionId = await ensureDubboRegion();
      console.log(`[ingest:nsw] dubbo region ready ${regionId}`);
    }
    console.log(
      `[ingest:nsw] target=${databaseName} sources=${connectors.map((entry) => entry.id).join(',')}`,
    );
    const result = await runIngestion({ connectors });
    for (const entry of result.results) {
      console.log(
        `[ingest:nsw] ${entry.source_id}: ${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted}` +
          (entry.errors.length > 0 ? ` errors=${entry.errors.join('; ')}` : ''),
      );
    }
    const failed = result.results.filter((entry) => entry.log_status === 'error').length;
    console.log(`[ingest:nsw] done target=${databaseName} errored=${failed}`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:nsw] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
