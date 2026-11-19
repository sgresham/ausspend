import {
  HAY_GPFS_FISCAL_YEAR,
  HAY_GPFS_REPORTING_URL,
  HAY_GPFS_REQUEST_HEADERS,
  parseHayFinancialStatementsLinks,
  selectHayGpfsDocument,
} from '../server/src/connectors/hay-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The official reporting feed HTML that publishes the FS links. */
  listingHtml: string;
  /** Exact PDF bytes fetched from the discovered link. */
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

async function fetchViaPlain(
  reportingUrl: string,
  fiscalYear: string,
  fetchImpl: typeof fetch,
): Promise<BrowserGpfsFetch> {
  const listing = await fetchImpl(reportingUrl, {
    redirect: 'follow',
    headers: HAY_GPFS_REQUEST_HEADERS,
  });
  if (!listing.ok) {
    throw new Error(`Hay Council Meetings and Reports page HTTP ${listing.status} on the plain-fetch path`);
  }
  const listingHtml = await listing.text();
  const links = parseHayFinancialStatementsLinks(listingHtml, reportingUrl);
  const document = selectHayGpfsDocument(links, fiscalYear);
  const response = await fetchImpl(document.url, {
    redirect: 'follow',
    headers: HAY_GPFS_REQUEST_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`Hay GPFS PDF HTTP ${response.status} for ${document.url}`);
  }
  return {
    listingHtml,
    pdfBytes: new Uint8Array(await response.arrayBuffer()),
    pdfUrl: document.url,
    viaBrowser: false,
  };
}

async function fetchViaChromium(
  reportingUrl: string,
  fiscalYear: string,
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
    const response = await page.goto(reportingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    if (!response || !response.ok()) {
      throw new Error(
        `Hay Council Meetings and Reports page HTTP ${response?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    await page.waitForTimeout(3_000);
    const listingHtml = await page.content();
    const links = parseHayFinancialStatementsLinks(listingHtml, reportingUrl);
    const document = selectHayGpfsDocument(links, fiscalYear);
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
    }, document.url);
    const pdfBytes = new Uint8Array(Buffer.from(base64, 'base64'));
    return { listingHtml, pdfBytes, pdfUrl: document.url, viaBrowser: true };
  } finally {
    await browser.close();
  }
}

/**
 * Fetch Hay Shire Council's current FY2025-26 Annual Financial Statements.
 *
 * On 2026-11-20 the official reporting feed and the PDF returned HTTP 200 to a
 * plain `curl/8.5.0` client and the site is not behind a WAF, so the plain path
 * is deterministic. The browser path is still tried first (headless Chromium)
 * and falls back to the plain client on any navigation/fetch failure. Both paths
 * discover the link from the official feed, and the connector SHA-256 verifies
 * and re-archives the exact bytes.
 */
export async function fetchHayGpfsViaBrowser(
  reportingUrl: string = HAY_GPFS_REPORTING_URL,
  fiscalYear: string = HAY_GPFS_FISCAL_YEAR,
  options: BrowserGpfsFetchOptions = {},
): Promise<BrowserGpfsFetch> {
  if (!options.forcePlain) {
    try {
      return await fetchViaChromium(reportingUrl, fiscalYear);
    } catch {
      // Fall through to the plain client.
    }
  }
  return fetchViaPlain(reportingUrl, fiscalYear, options.fetchImpl ?? globalThis.fetch);
}

const isMain =
  process.argv[1] !== undefined && /hay-gpfs-browser\.(?:ts|mjs|js)$/.test(process.argv[1]);

if (isMain) {
  const fetched = await fetchHayGpfsViaBrowser();
  console.log(
    `[hay-gpfs-browser] ${fetched.viaBrowser ? 'browser' : 'plain'} discovered ${fetched.pdfUrl} (${fetched.pdfBytes.byteLength} bytes)`,
  );
}
