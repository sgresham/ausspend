import 'dotenv/config';
import mongoose from 'mongoose';
import {
  COFFS_HARBOUR_GPFS_ID,
  LAKE_MACQUARIE_GPFS_ID,
  LIVERPOOL_GPFS_ID,
  KU_RING_GAI_GPFS_ID,
  MID_COAST_GPFS_ID,
  PORT_MACQUARIE_HASTINGS_GPFS_ID,
  RANDWICK_GPFS_ID,
  NORTH_SYDNEY_GPFS_ID,
  WAVERLEY_GPFS_ID,
  WILLOUGHBY_GPFS_ID,
  WOLLONGONG_GPFS_ID,
  HORNSBY_GPFS_ID,
  createCoffsHarbourGpfsConnector,
  createHornsbyGpfsConnector,
  createLakeMacquarieGpfsConnector,
  createLiverpoolGpfsConnector,
  createKuRingGaiGpfsConnector,
  createMidCoastGpfsConnector,
  createPortMacquarieHastingsGpfsConnector,
  createRandwickGpfsConnector,
  createNorthSydneyGpfsConnector,
  createWaverleyGpfsConnector,
  createWilloughbyGpfsConnector,
  createWollongongGpfsConnector,
  ensureDubboRegion,
  getConnector,
  runIngestion,
} from '../server/src/connectors/index.js';
import type { Connector } from '../server/src/connectors/types.js';
import { fetchCoffsHarbourGpfsViaBrowser } from './coffs-harbour-gpfs-browser.js';
import { fetchHornsbyGpfsViaBrowser } from '../server/src/connectors/hornsby-gpfs/browser.js';
import { fetchLakeMacquarieGpfsViaBrowser } from './lake-macquarie-gpfs-browser.js';
import { fetchLiverpoolGpfsViaBrowser } from './liverpool-gpfs-browser.js';
import { fetchKuRingGaiGpfsViaBrowser } from './ku-ring-gai-gpfs-browser.js';
import { fetchMidCoastGpfsViaBrowser } from './mid-coast-gpfs-browser.js';
import { fetchPortMacquarieHastingsGpfsViaBrowser } from './port-macquarie-hastings-gpfs-browser.js';
import { fetchRandwickGpfsViaBrowser } from './randwick-gpfs-browser.js';
import { fetchNorthSydneyGpfsViaBrowser } from './north-sydney-gpfs-browser.js';
import { fetchWaverleyGpfsViaBrowser } from './waverley-gpfs-browser.js';
import { fetchWilloughbyGpfsViaBrowser } from './willoughby-gpfs-browser.js';
import { fetchWollongongGpfsViaBrowser } from './wollongong-gpfs-browser.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * NSW ingestion (S1 + S2).
 *
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:nsw
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
 *   - lake-macquarie-gpfs  GPFS expansion: Lake Macquarie City Council's audited FY2024-25 GPFS
 *   - maitland-gpfs       GPFS expansion: Maitland City Council's audited FY2024-25 GPFS
 *   - coffs-harbour-gpfs  GPFS expansion: Coffs Harbour City Council's audited FY2024-25 GPFS
 *   - mid-coast-gpfs     GPFS expansion: MidCoast Council's audited FY2024-25 GPFS
 *   - port-macquarie-hastings-gpfs  GPFS expansion: Port Macquarie-Hastings Council's audited FY2024-25 GPFS
 *   - tweed-shire-gpfs  GPFS expansion: Tweed Shire Council's audited FY2024-25 GPFS
 *   - shoalhaven-gpfs  GPFS expansion: Shoalhaven City Council's audited FY2024-25 GPFS
 *   - shellharbour-gpfs  GPFS expansion: Shellharbour City Council's audited FY2024-25 GPFS
 *   - waverley-gpfs  GPFS expansion: Waverley Council's audited FY2024-25 GPFS
 *   - willoughby-gpfs  GPFS expansion: Willoughby City Council's audited FY2024-25 GPFS
 *   - inner-west-gpfs  GPFS expansion: Inner West Council's audited FY2024-25 GPFS
 *   - bayside-gpfs  GPFS expansion: Bayside Council's audited FY2024-25 GPFS
 *   - randwick-gpfs  GPFS expansion: Randwick City Council's audited FY2024-25 GPFS
 *   - ryde-gpfs  GPFS expansion: Council of the City of Ryde's audited FY2024-25 GPFS
 *   - north-sydney-gpfs  GPFS expansion: North Sydney Council's audited FY2024-25 GPFS
 *   - canada-bay-gpfs  GPFS expansion: City of Canada Bay Council's audited FY2024-25 GPFS
 *   - cumberland-gpfs  GPFS expansion: Cumberland City Council's audited FY2024-25 GPFS
 *   - georges-river-gpfs  GPFS expansion: Georges River Council's audited FY2024-25 GPFS
 *   - fairfield-gpfs  GPFS expansion: Fairfield City Council's audited FY2024-25 GPFS
 *   - liverpool-gpfs  GPFS expansion: Liverpool City Council's audited FY2024-25 GPFS
 *   - ku-ring-gai-gpfs  GPFS expansion: Ku-ring-gai Council's audited FY2024-25 GPFS
 *   - strathfield-gpfs  GPFS expansion: Strathfield Council's audited FY2024-25 GPFS
 *   - lane-cove-gpfs  GPFS expansion: Lane Cove Council's audited FY2024-25 GPFS
 *   - mosman-gpfs  GPFS expansion: Mosman Council's audited FY2024-25 GPFS
 *   - wollondilly-gpfs  GPFS expansion: Wollondilly Shire Council's audited FY2024-25 GPFS
 *   - camden-gpfs  GPFS expansion: Camden Council's audited FY2024-25 GPFS
 *   - hornsby-gpfs  GPFS expansion: Hornsby Shire Council's audited FY2025-26 GPFS
 *   - central-coast-gpfs  GPFS expansion: Central Coast Council's audited FY2024-25 GPFS
 *   - penrith-gpfs  GPFS expansion: Penrith City Council's audited FY2024-25 GPFS
 *   - the-hills-gpfs  GPFS expansion: The Hills Shire Council's audited FY2024-25 GPFS
 *   - warren-gpfs  GPFS expansion: Warren Shire Council's audited FY2025-26 GPFS
 *   - brewarrina-gpfs  GPFS expansion: Brewarrina Shire Council's audited FY2025-26 GPFS
 *   - bogan-gpfs  GPFS expansion: Bogan Shire Council's audited FY2025-26 GPFS
 *   - kyogle-gpfs  GPFS expansion: Kyogle Council's audited FY2025-26 GPFS
 *   - junee-gpfs  GPFS expansion: Junee Shire Council's audited FY2025-26 GPFS
 *   - uralla-gpfs  GPFS expansion: Uralla Shire Council's audited FY2025-26 GPFS
 *   - cootamundra-gundagai-gpfs  GPFS expansion: Cootamundra-Gundagai Regional Council's audited FY2024-25 GPFS
 *   - moree-plains-gpfs  GPFS expansion: Moree Plains Shire Council's audited FY2024-25 GPFS
 *   - hilltops-gpfs  GPFS expansion: Hilltops Council's audited FY2024-25 GPFS
 *   - bourke-gpfs  GPFS expansion: Bourke Shire Council's audited FY2025-26 GPFS
 *
 * S3 deliberately covers only Dubbo Regional Council, and the GPFS expansion
 * adds only the City of Sydney, Blacktown City Council, the City of Parramatta,
 * Northern Beaches Council, Canterbury-Bankstown Council, Sutherland Shire
 * Council, Wollongong City Council, Newcastle City Council, Lake Macquarie City
 * Council, Maitland City Council, Coffs Harbour City Council, MidCoast Council,
 * Port Macquarie-Hastings Council, Tweed Shire Council, Shoalhaven City
 * Council, Shellharbour City Council, Waverley Council, Willoughby City
 * Council, Inner West Council, Bayside Council, Randwick City Council, the
 * Council of the City of Ryde, North Sydney Council, the City of Canada Bay
 * Council, Cumberland City Council, Georges River Council, Fairfield City
 * Council, Liverpool City Council, Ku-ring-gai Council, Strathfield Council,
 * Lane Cove Council, Mosman Council, Wollondilly Shire Council, Camden
 * Council, Campbelltown City Council, Central Coast Council, Hornsby Shire
 * Council, Penrith City Council, The Hills Shire Council, Warren Shire Council
 * and Brewarrina Shire Council and Bogan Shire Council and Kyogle Council and Junee Shire Council and Uralla Shire Council and Cootamundra-Gundagai Regional Council and Moree Plains Shire Council and Hilltops Council and Bourke Shire Council. No other councils, states/territories, SOC/charity or live state
 * connectors are touched. The runner upserts on natural_key, so re-running is
 * idempotent and never deletes existing federal/synthetic rows.
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
  'lake-macquarie-gpfs',
  'maitland-gpfs',
  'coffs-harbour-gpfs',
  'mid-coast-gpfs',
  'port-macquarie-hastings-gpfs',
  'tweed-shire-gpfs',
  'shoalhaven-gpfs',
  'shellharbour-gpfs',
  'waverley-gpfs',
  'willoughby-gpfs',
  'inner-west-gpfs',
  'bayside-gpfs',
  'randwick-gpfs',
  'ryde-gpfs',
  'north-sydney-gpfs',
  'canada-bay-gpfs',
  'cumberland-gpfs',
  'georges-river-gpfs',
  'fairfield-gpfs',
  'liverpool-gpfs',
  'ku-ring-gai-gpfs',
  'strathfield-gpfs',
  'lane-cove-gpfs',
  'mosman-gpfs',
  'hawkesbury-gpfs',
  'woollahra-gpfs',
  'blue-mountains-gpfs',
  'wollondilly-gpfs',
  'camden-gpfs',
  'campbelltown-gpfs',
  'central-coast-gpfs',
  'hornsby-gpfs',
  'penrith-gpfs',
  'the-hills-gpfs',
  'warren-gpfs',
  'brewarrina-gpfs',
  'bogan-gpfs',
  'kyogle-gpfs',
  'junee-gpfs',
  'uralla-gpfs',
  'cootamundra-gundagai-gpfs',
  'moree-plains-gpfs',
  'hilltops-gpfs',
  'bourke-gpfs',
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
    if (id === HORNSBY_GPFS_ID) {
      // Hornsby's Financial Statements page and file endpoints return HTTP 403
      // to plain HTTP clients. The documented headless Chromium path loads the
      // page, the connector still discovers the FY2025-26 link from the cleared
      // HTML and re-verifies the exact bytes.
      console.log('[ingest:nsw] hornsby-gpfs: browser discovery/download starting');
      const fetched = await fetchHornsbyGpfsViaBrowser();
      console.log(`[ingest:nsw] hornsby-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createHornsbyGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
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
    if (id === LAKE_MACQUARIE_GPFS_ID) {
      // Lake Macquarie's site rejects direct HTTP with an Akamai 403 (and the
      // CMS intermittently served a Granicus/OpenCities failover page); the
      // documented headless Chromium path clears it, and the connector still
      // discovers the PDF link from the cleared HTML and re-verifies the bytes.
      console.log('[ingest:nsw] lake-macquarie-gpfs: browser discovery/download starting');
      const fetched = await fetchLakeMacquarieGpfsViaBrowser();
      console.log(`[ingest:nsw] lake-macquarie-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createLakeMacquarieGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
    if (id === MID_COAST_GPFS_ID) {
      // MidCoast's site rejects Node's direct HTTP fetch with an Akamai 403; the
      // documented headless Chromium path clears it, and the connector still
      // discovers the FY2024-25 financial-statements link from the cleared
      // reporting page HTML and re-verifies the bytes.
      console.log('[ingest:nsw] mid-coast-gpfs: browser discovery/download starting');
      const fetched = await fetchMidCoastGpfsViaBrowser();
      console.log(`[ingest:nsw] mid-coast-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createMidCoastGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
    if (id === PORT_MACQUARIE_HASTINGS_GPFS_ID) {
      // Port Macquarie-Hastings's site rejects Node's direct HTTP fetch with an
      // Akamai 403; the documented headless Chromium path clears it, and the
      // connector still discovers the FY2024-25 "Part 2 | Financial Statements"
      // link from the cleared reporting page HTML and re-verifies the bytes.
      console.log('[ingest:nsw] port-macquarie-hastings-gpfs: browser discovery/download starting');
      const fetched = await fetchPortMacquarieHastingsGpfsViaBrowser();
      console.log(`[ingest:nsw] port-macquarie-hastings-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createPortMacquarieHastingsGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
    if (id === COFFS_HARBOUR_GPFS_ID) {
      // Coffs Harbour's site rejects direct HTTP with an Akamai 403; the
      // documented headless Chromium path clears it, and the connector still
      // discovers the FY2024-25 Annual Financial Statements link from the
      // cleared Annual Report HTML and re-verifies the bytes.
      console.log('[ingest:nsw] coffs-harbour-gpfs: browser discovery/download starting');
      const fetched = await fetchCoffsHarbourGpfsViaBrowser();
      console.log(`[ingest:nsw] coffs-harbour-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createCoffsHarbourGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
    if (id === WAVERLEY_GPFS_ID) {
      // Waverley's site rejects direct HTTP with a Cloudflare "Just a moment..."
      // 403; the documented headless Chromium path clears it, and the connector
      // still discovers the FY2024-25 audited financial-statements link from the
      // cleared Annual Statement of Accounts HTML and re-verifies the bytes.
      console.log('[ingest:nsw] waverley-gpfs: browser discovery/download starting');
      const fetched = await fetchWaverleyGpfsViaBrowser();
      console.log(`[ingest:nsw] waverley-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createWaverleyGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
    if (id === WILLOUGHBY_GPFS_ID) {
      // Willoughby's site rejects Node's direct HTTP fetch with a Cloudflare
      // 403; the documented headless Chromium path clears it, and the connector
      // still discovers the FY2024-25 audited financial-statements link from the
      // cleared Annual Financial Statements HTML and re-verifies the bytes.
      console.log('[ingest:nsw] willoughby-gpfs: browser discovery/download starting');
      const fetched = await fetchWilloughbyGpfsViaBrowser();
      console.log(`[ingest:nsw] willoughby-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createWilloughbyGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
    if (id === RANDWICK_GPFS_ID) {
      // Randwick's site rejects Node's direct HTTP fetch with a Cloudflare "Just
      // a moment..." challenge (HTTP 403); the documented headless Chromium path
      // clears it, and the connector still discovers the FY2024-25 Financial
      // Statements link from the cleared Our reports HTML and re-verifies the
      // bytes.
      console.log('[ingest:nsw] randwick-gpfs: browser discovery/download starting');
      const fetched = await fetchRandwickGpfsViaBrowser();
      console.log(`[ingest:nsw] randwick-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createRandwickGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
    if (id === NORTH_SYDNEY_GPFS_ID) {
      // North Sydney's Financial Statements listing and file endpoints are
      // protected by an AWS WAF challenge. The documented headless Chromium
      // path (channel chromium, not the headless shell) clears it, and the
      // connector still discovers the FY2024-25 link from the cleared HTML and
      // re-verifies the bytes.
      console.log('[ingest:nsw] north-sydney-gpfs: browser discovery/download starting');
      const fetched = await fetchNorthSydneyGpfsViaBrowser();
      console.log(`[ingest:nsw] north-sydney-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createNorthSydneyGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
    if (id === LIVERPOOL_GPFS_ID) {
      // Liverpool's Finance Reports page is behind a Cloudflare managed
      // challenge that returns HTTP 403 to non-browser clients; the documented
      // headless Chromium path clears it, and the connector still discovers the
      // FY2024-25 "Audited Financial Statement" link under the "Financial Year
      // 2024/2025" table from the cleared HTML and re-verifies the bytes.
      console.log('[ingest:nsw] liverpool-gpfs: browser discovery/download starting');
      const fetched = await fetchLiverpoolGpfsViaBrowser();
      console.log(`[ingest:nsw] liverpool-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createLiverpoolGpfsConnector({
          listingHtml: fetched.listingHtml,
          pdfBytes: fetched.pdfBytes,
        }),
      );
      continue;
    }
    if (id === KU_RING_GAI_GPFS_ID) {
      // Ku-ring-gai's Finance page and file endpoints return HTTP 403 to
      // non-browser clients; the documented headless Chromium path loads the
      // page, and the connector still discovers the FY2024-25 "Financial
      // statements 2024-2025" link from the cleared HTML and re-verifies the
      // bytes.
      console.log('[ingest:nsw] ku-ring-gai-gpfs: browser discovery/download starting');
      const fetched = await fetchKuRingGaiGpfsViaBrowser();
      console.log(`[ingest:nsw] ku-ring-gai-gpfs: discovered ${fetched.pdfUrl}`);
      connectors.push(
        createKuRingGaiGpfsConnector({
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
