import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  GREATER_HUME_GPFS_DOCUMENT_PIN,
  GREATER_HUME_GPFS_FISCAL_YEAR,
  GREATER_HUME_GPFS_REPORTING_URL,
  GREATER_HUME_GPFS_REQUEST_HEADERS,
  discoverGreaterHumeGpfsDocument,
} from '../server/src/connectors/greater-hume-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The official Annual Financial Statements page HTML used to confirm the pinned upload. */
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

/** The rendered page uses a root-relative `/files/...` href. */
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
    headers: GREATER_HUME_GPFS_REQUEST_HEADERS,
  });
  if (!listing.ok) {
    throw new Error(
      `Greater Hume Annual Financial Statements page HTTP ${listing.status} on the plain-fetch path`,
    );
  }
  const listingHtml = await listing.text();
  if (!listingListsPdf(listingHtml, pdfUrl)) {
    throw new Error(
      `Greater Hume Annual Financial Statements page does not list the pinned upload ${pdfUrl}`,
    );
  }
  const response = await fetchImpl(pdfUrl, {
    redirect: 'follow',
    headers: GREATER_HUME_GPFS_REQUEST_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`Greater Hume GPFS PDF HTTP ${response.status} for ${pdfUrl}`);
  }
  return {
    listingHtml,
    pdfBytes: new Uint8Array(await response.arrayBuffer()),
    pdfUrl,
    viaBrowser: false,
  };
}

async function fetchViaChromium(
  listingUrl: string,
  pdfUrl: string,
): Promise<BrowserGpfsFetch> {
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
        `Greater Hume Annual Financial Statements page HTTP ${landing?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    await page.waitForTimeout(2_500);
    const listingHtml = await page.content();
    if (!listingListsPdf(listingHtml, pdfUrl)) {
      // The upload may be lazy-rendered; a second pass after the page settles.
      await page.waitForTimeout(2_500);
    }
    const confirmedHtml = await page.content();
    if (!listingListsPdf(confirmedHtml, pdfUrl)) {
      throw new Error(
        `Greater Hume Annual Financial Statements page does not list the pinned upload ${pdfUrl} after browser navigation`,
      );
    }
    const base64 = await page.evaluate(async (url: string) => {
      const pdfResponse = await fetch(url, { credentials: 'include' });
      if (!pdfResponse.ok) throw new Error(`PDF fetch HTTP ${pdfResponse.status}`);
      const buffer = await pdfResponse.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
      }
      return btoa(binary);
    }, pdfUrl);
    return {
      listingHtml: confirmedHtml,
      pdfBytes: new Uint8Array(Buffer.from(base64, 'base64')),
      pdfUrl,
      viaBrowser: true,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Fetch Greater Hume Shire Council's current audited Annual Financial
 * Statements (FY2025-26, which embed the General Purpose Financial Statements).
 *
 * On 2026-11-20 the entire official site returned HTTP 403 ("Access Denied") to
 * a plain client (home page and every `/files` path), but a real headless
 * Chromium session returned HTTP 200 and the pinned PDF. The browser path is
 * tried first and falls back to the plain client only when `forcePlain` is set
 * or the browser throws; the connector SHA-256 verifies and re-archives the
 * exact bytes.
 */
export async function fetchGreaterHumeGpfsViaBrowser(
  listingUrl: string = GREATER_HUME_GPFS_REPORTING_URL,
  fiscalYear: string = GREATER_HUME_GPFS_FISCAL_YEAR,
  options: BrowserGpfsFetchOptions = {},
): Promise<BrowserGpfsFetch> {
  const pdfUrl = discoverGreaterHumeGpfsDocument(fiscalYear).url;
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
  process.argv[1] !== undefined && /greater-hume-gpfs-browser\.(?:ts|mjs|js)$/.test(process.argv[1]);

if (isMain) {
  const out = parseOut(process.argv.slice(2));
  const fetched = await fetchGreaterHumeGpfsViaBrowser();
  const digest = sha256(fetched.pdfBytes);
  console.log(
    `[greater-hume-gpfs-browser] ${fetched.viaBrowser ? 'browser' : 'plain'} discovered ${fetched.pdfUrl} (${fetched.pdfBytes.byteLength} bytes) sha256=${digest}`,
  );
  if (fetched.pdfUrl !== GREATER_HUME_GPFS_DOCUMENT_PIN) {
    console.log(`[greater-hume-gpfs-browser] note: pinned URL is ${GREATER_HUME_GPFS_DOCUMENT_PIN}`);
  }
  if (out) {
    await writeFile(out, fetched.pdfBytes);
    console.log(`[greater-hume-gpfs-browser] wrote ${out}`);
  }
}
