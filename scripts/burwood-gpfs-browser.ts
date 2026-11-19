import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  BURWOOD_GPFS_DOCUMENT_PIN,
  BURWOOD_GPFS_FISCAL_YEAR,
  BURWOOD_GPFS_REPORTING_URL,
  BURWOOD_GPFS_REQUEST_HEADERS,
  discoverBurwoodGpfsDocument,
} from '../server/src/connectors/burwood-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The official exhibition page HTML used to confirm the pinned upload. */
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

async function fetchViaPlain(
  listingUrl: string,
  pdfUrl: string,
  fetchImpl: typeof fetch,
): Promise<BrowserGpfsFetch> {
  const listing = await fetchImpl(listingUrl, {
    redirect: 'follow',
    headers: BURWOOD_GPFS_REQUEST_HEADERS,
  });
  if (!listing.ok) {
    throw new Error(`Burwood Annual Financial Statements page HTTP ${listing.status} on the plain-fetch path`);
  }
  const listingHtml = await listing.text();
  if (!listingHtml.includes(pdfUrl) && !listingHtml.includes(new URL(pdfUrl).pathname)) {
    throw new Error(`Burwood Annual Financial Statements page does not list the pinned upload ${pdfUrl}`);
  }
  const response = await fetchImpl(pdfUrl, {
    redirect: 'follow',
    headers: BURWOOD_GPFS_REQUEST_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`Burwood GPFS PDF HTTP ${response.status} for ${pdfUrl}`);
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
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    const landing = await page.goto(listingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    if (!landing || !landing.ok()) {
      throw new Error(
        `Burwood Annual Financial Statements page HTTP ${landing?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    await page.waitForTimeout(2_500);
    const listingHtml = await page.content();
    const listsPdf = (html: string): boolean =>
      html.includes(pdfUrl) || html.includes(new URL(pdfUrl).pathname);
    if (!listsPdf(listingHtml)) {
      // The document library may be lazy-rendered; a second pass after the page settles.
      await page.waitForTimeout(2_500);
    }
    const confirmedHtml = await page.content();
    if (!listsPdf(confirmedHtml)) {
      throw new Error(
        `Burwood Annual Financial Statements page does not list the pinned upload ${pdfUrl} after browser navigation`,
      );
    }
    // Fetch through the browser context's request client: the PDF download
    // redirects and is not readable by page.evaluate(fetch) because the
    // redirect target does not allow the page's CORS context. The context
    // request shares the browser session and returns the exact bytes.
    const response = await context.request.get(pdfUrl, { timeout: 90_000 });
    const contentType = response.headers()['content-type'] ?? '';
    if (response.status() !== 200) {
      throw new Error(`Burwood GPFS PDF HTTP ${response.status()} for ${pdfUrl}`);
    }
    if (!contentType.includes('application/pdf')) {
      throw new Error(
        `Burwood GPFS PDF content-type ${JSON.stringify(contentType)} for ${pdfUrl}; expected application/pdf`,
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
 * Fetch Burwood Council's current FY2025-26 audited Annual Financial Statements.
 *
 * On 2026-11-20 the council's main site returned HTTP 403 ("Access Denied") to a
 * plain client, but the official consultation host
 * `participate.burwood.nsw.gov.au` returned HTTP 200 for both the exhibition
 * page and the pinned PDF. The browser path is tried first and falls back to the
 * plain client only when `forcePlain` is set or the browser throws; the
 * connector SHA-256 verifies and re-archives the exact bytes.
 */
export async function fetchBurwoodGpfsViaBrowser(
  listingUrl: string = BURWOOD_GPFS_REPORTING_URL,
  fiscalYear: string = BURWOOD_GPFS_FISCAL_YEAR,
  options: BrowserGpfsFetchOptions = {},
): Promise<BrowserGpfsFetch> {
  const pdfUrl = discoverBurwoodGpfsDocument(fiscalYear).url;
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
  process.argv[1] !== undefined && /burwood-gpfs-browser\.(?:ts|mjs|js)$/.test(process.argv[1]);

if (isMain) {
  const out = parseOut(process.argv.slice(2));
  const fetched = await fetchBurwoodGpfsViaBrowser();
  const digest = sha256(fetched.pdfBytes);
  console.log(
    `[burwood-gpfs-browser] ${fetched.viaBrowser ? 'browser' : 'plain'} discovered ${fetched.pdfUrl} (${fetched.pdfBytes.byteLength} bytes) sha256=${digest}`,
  );
  if (fetched.pdfUrl !== BURWOOD_GPFS_DOCUMENT_PIN) {
    console.log(`[burwood-gpfs-browser] note: pinned URL is ${BURWOOD_GPFS_DOCUMENT_PIN}`);
  }
  if (out) {
    await writeFile(out, fetched.pdfBytes);
    console.log(`[burwood-gpfs-browser] wrote ${out}`);
  }
  process.exit(0);
}
