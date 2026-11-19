import {
  TAMWORTH_GPFS_FISCAL_YEAR,
  TAMWORTH_GPFS_REPORTING_URL,
  TAMWORTH_GPFS_REQUEST_HEADERS,
  parseTamworthFinancialStatementsLinks,
  selectTamworthGpfsDocument,
} from '../server/src/connectors/tamworth-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The official Financial Reporting page HTML. */
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
    headers: TAMWORTH_GPFS_REQUEST_HEADERS,
  });
  if (!listing.ok) {
    throw new Error(
      `Tamworth Financial Reporting page HTTP ${listing.status} on the plain-fetch path`,
    );
  }
  const listingHtml = await listing.text();
  const links = parseTamworthFinancialStatementsLinks(listingHtml, reportingUrl);
  const document = selectTamworthGpfsDocument(links, fiscalYear);
  const response = await fetchImpl(document.url, {
    redirect: 'follow',
    headers: TAMWORTH_GPFS_REQUEST_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`Tamworth GPFS PDF HTTP ${response.status} for ${document.url}`);
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
    // Tamworth's WAF currently returns 403 to a browser-looking agent but 200
    // to a plain client. Treat any non-OK navigation as a failed browser path
    // and fall back rather than pretending the document is absent.
    if (!response || !response.ok()) {
      throw new Error(
        `Tamworth Financial Reporting page HTTP ${response?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    await page.waitForTimeout(5_000);
    const listingHtml = await page.content();
    const links = parseTamworthFinancialStatementsLinks(listingHtml, reportingUrl);
    const document = selectTamworthGpfsDocument(links, fiscalYear);
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
 * Fetch Tamworth Regional Council's audited FY2025-26 Annual Financial
 * Statements.
 *
 * The item brief expected a plain-fetch 403 and a browser-only path. On
 * 2026-11-20 the observed behaviour is the reverse: the reporting page and PDF
 * both return HTTP 200 to a plain `curl/8.5.0` client, while headless Chromium
 * gets HTTP 403. This path therefore tries headless Chromium first (the
 * documented WAF path) and falls back to the plain client on any navigation or
 * PDF failure, discovering the link from the official page in both cases. The
 * connector SHA-256 verifies and re-archives the exact bytes.
 */
export async function fetchTamworthGpfsViaBrowser(
  reportingUrl: string = TAMWORTH_GPFS_REPORTING_URL,
  fiscalYear: string = TAMWORTH_GPFS_FISCAL_YEAR,
  options: BrowserGpfsFetchOptions = {},
): Promise<BrowserGpfsFetch> {
  if (!options.forcePlain) {
    try {
      return await fetchViaChromium(reportingUrl, fiscalYear);
    } catch {
      // Fall through to the plain client, which is the working path today.
    }
  }
  return fetchViaPlain(reportingUrl, fiscalYear, options.fetchImpl ?? globalThis.fetch);
}

const isMain =
  process.argv[1] !== undefined && /tamworth-gpfs-browser\.(?:ts|mjs|js)$/.test(process.argv[1]);

if (isMain) {
  const fetched = await fetchTamworthGpfsViaBrowser();
  console.log(
    `[tamworth-gpfs-browser] ${fetched.viaBrowser ? 'browser' : 'plain'} discovered ${fetched.pdfUrl} (${fetched.pdfBytes.byteLength} bytes)`,
  );
}
