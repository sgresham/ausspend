import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  CENTRAL_DARLING_GPFS_DOCUMENT_PIN,
  CENTRAL_DARLING_GPFS_FISCAL_YEAR,
  CENTRAL_DARLING_GPFS_REPORTING_URL,
  CENTRAL_DARLING_GPFS_REQUEST_HEADERS,
  discoverCentralDarlingGpfsDocument,
} from '../server/src/connectors/central-darling-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The official public-notice page HTML used to confirm the pinned upload. */
  listingHtml: string;
  /** Exact PDF bytes fetched from the official pinned link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official page, for logging only. */
  pdfUrl: string;
  /** True when headless Chromium served the bytes; false on the plain-fetch fallback. */
  viaBrowser: boolean;
}

export interface BrowserGpfsFetchOptions {
  /** Override the HTTP client used by the plain fallback (tests). */
  fetchImpl?: typeof fetch;
  /** Skip Chromium and use the plain path immediately (tests). */
  forcePlain?: boolean;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function listingListsPdf(listingHtml: string, pdfUrl: string): boolean {
  if (listingHtml.includes(pdfUrl)) return true;
  try {
    return listingHtml.includes(new URL(pdfUrl).pathname);
  } catch {
    return false;
  }
}

async function fetchViaPlain(
  listingUrl: string,
  pdfUrl: string,
  fetchImpl: typeof fetch,
): Promise<BrowserGpfsFetch> {
  const listing = await fetchImpl(listingUrl, {
    redirect: 'follow',
    headers: CENTRAL_DARLING_GPFS_REQUEST_HEADERS,
  });
  if (!listing.ok) {
    throw new Error(
      `Central Darling public-notice page HTTP ${listing.status} on the plain-fetch path`,
    );
  }
  const listingHtml = await listing.text();
  if (!listingListsPdf(listingHtml, pdfUrl)) {
    throw new Error(
      `Central Darling public-notice page does not list the pinned upload ${pdfUrl}`,
    );
  }
  const response = await fetchImpl(pdfUrl, {
    redirect: 'follow',
    headers: CENTRAL_DARLING_GPFS_REQUEST_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`Central Darling GPFS PDF HTTP ${response.status} for ${pdfUrl}`);
  }
  return {
    listingHtml,
    pdfBytes: new Uint8Array(await response.arrayBuffer()),
    pdfUrl,
    viaBrowser: false,
  };
}

async function fetchViaChromium(listingUrl: string, pdfUrl: string): Promise<BrowserGpfsFetch> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      // The council host rejects a bare Chrome UA with HTTP 403 but serves the
      // plain client UA; use the same UA the plain fetch sends.
      userAgent: CENTRAL_DARLING_GPFS_REQUEST_HEADERS['user-agent'],
    });
    const page = await context.newPage();
    const landing = await page.goto(listingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    if (!landing || !landing.ok()) {
      throw new Error(
        `Central Darling public-notice page HTTP ${landing?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    await page.waitForTimeout(2_500);
    const listingHtml = await page.content();
    if (!listingListsPdf(listingHtml, pdfUrl)) {
      // The document list may be lazy-rendered; a second pass after it settles.
      await page.waitForTimeout(2_500);
    }
    const confirmedHtml = await page.content();
    if (!listingListsPdf(confirmedHtml, pdfUrl)) {
      throw new Error(
        `Central Darling public-notice page does not list the pinned upload ${pdfUrl} after browser navigation`,
      );
    }
    const response = await context.request.get(pdfUrl, {
      timeout: 90_000,
      headers: { 'user-agent': CENTRAL_DARLING_GPFS_REQUEST_HEADERS['user-agent'] },
    });
    const contentType = response.headers()['content-type'] ?? '';
    if (response.status() !== 200) {
      throw new Error(`Central Darling GPFS PDF HTTP ${response.status()} for ${pdfUrl}`);
    }
    if (!contentType.includes('application/pdf')) {
      throw new Error(
        `Central Darling GPFS PDF content-type ${JSON.stringify(contentType)} for ${pdfUrl}; expected application/pdf`,
      );
    }
    const body = await response.body();
    return {
      listingHtml: confirmedHtml,
      pdfBytes: new Uint8Array(body),
      pdfUrl,
      viaBrowser: true,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Fetch Central Darling Shire Council's latest available full audited GPFS.
 *
 * On 2026-11-20 the council host returned HTTP 200 to a plain client UA and
 * HTTP 403 to a bare Chrome UA for both the public-notice page and the PDF. The
 * browser helper therefore uses the plain UA in headless Chromium and fetches
 * the exact PDF through the browser context request client. The connector
 * SHA-256 verifies and re-archives those bytes.
 */
export async function fetchCentralDarlingGpfsViaBrowser(
  listingUrl: string = CENTRAL_DARLING_GPFS_REPORTING_URL,
  fiscalYear: string = CENTRAL_DARLING_GPFS_FISCAL_YEAR,
  options: BrowserGpfsFetchOptions = {},
): Promise<BrowserGpfsFetch> {
  const pdfUrl = discoverCentralDarlingGpfsDocument(fiscalYear).url;
  if (!options.forcePlain) {
    try {
      return await fetchViaChromium(listingUrl, pdfUrl);
    } catch {
      // Fall through to the plain client.
    }
  }
  return fetchViaPlain(listingUrl, pdfUrl, options.fetchImpl ?? globalThis.fetch);
}

function parseOut(argv: readonly string[]): string | undefined {
  for (const arg of argv) {
    if (arg.startsWith('--out=')) return arg.slice('--out='.length);
  }
  return undefined;
}

const isMain =
  process.argv[1] !== undefined &&
  /central-darling-gpfs-browser\.(?:ts|mjs|js)$/.test(process.argv[1]);

if (isMain) {
  const out = parseOut(process.argv.slice(2));
  const fetched = await fetchCentralDarlingGpfsViaBrowser();
  const digest = sha256(fetched.pdfBytes);
  console.log(
    `[central-darling-gpfs-browser] ${fetched.viaBrowser ? 'browser' : 'plain'} discovered ${fetched.pdfUrl} (${fetched.pdfBytes.byteLength} bytes) sha256=${digest}`,
  );
  if (fetched.pdfUrl !== CENTRAL_DARLING_GPFS_DOCUMENT_PIN) {
    console.log(
      `[central-darling-gpfs-browser] note: pinned URL is ${CENTRAL_DARLING_GPFS_DOCUMENT_PIN}`,
    );
  }
  if (out) {
    await writeFile(out, fetched.pdfBytes);
    console.log(`[central-darling-gpfs-browser] wrote ${out}`);
  }
  process.exit(0);
}
