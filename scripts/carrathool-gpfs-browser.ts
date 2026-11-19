import {
  CARRATHOOL_GPFS_FISCAL_YEAR,
  CARRATHOOL_GPFS_MEDIA_SEARCH_URL,
  CARRATHOOL_GPFS_REPORTING_URL,
  CARRATHOOL_GPFS_REQUEST_HEADERS,
  parseCarrathoolMediaSearch,
  selectCarrathoolGpfsDocument,
  type CarrathoolGpfsDocument,
} from '../server/src/connectors/carrathool-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The official media-search JSON that publishes the FS attachments. */
  mediaJson: string;
  /** Exact PDF bytes fetched from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official media index, for logging only. */
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

function selectDocument(mediaJson: string, fiscalYear: string): CarrathoolGpfsDocument {
  return selectCarrathoolGpfsDocument(parseCarrathoolMediaSearch(mediaJson), fiscalYear);
}

async function fetchViaPlain(
  mediaUrl: string,
  fiscalYear: string,
  fetchImpl: typeof fetch,
): Promise<BrowserGpfsFetch> {
  const listing = await fetchImpl(mediaUrl, {
    redirect: 'follow',
    headers: CARRATHOOL_GPFS_REQUEST_HEADERS,
  });
  if (!listing.ok) {
    throw new Error(`Carrathool media index HTTP ${listing.status} on the plain-fetch path`);
  }
  const mediaJson = await listing.text();
  const document = selectDocument(mediaJson, fiscalYear);
  const response = await fetchImpl(document.url, {
    redirect: 'follow',
    headers: CARRATHOOL_GPFS_REQUEST_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`Carrathool GPFS PDF HTTP ${response.status} for ${document.url}`);
  }
  return {
    mediaJson,
    pdfBytes: new Uint8Array(await response.arrayBuffer()),
    pdfUrl: document.url,
    viaBrowser: false,
  };
}

async function fetchViaChromium(mediaUrl: string, fiscalYear: string): Promise<BrowserGpfsFetch> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    const landing = await page.goto(CARRATHOOL_GPFS_REPORTING_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    if (!landing || !landing.ok()) {
      throw new Error(
        `Carrathool annual-report page HTTP ${landing?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    await page.waitForTimeout(2_000);
    const mediaJson = await page.evaluate(async (url: string) => {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error(`media index HTTP ${response.status}`);
      return response.text();
    }, mediaUrl);
    const document = selectDocument(mediaJson, fiscalYear);
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
    return { mediaJson, pdfBytes, pdfUrl: document.url, viaBrowser: true };
  } finally {
    await browser.close();
  }
}

/**
 * Fetch Carrathool Shire Council's current FY2025-26 Annual Financial
 * Statements.
 *
 * On 2026-11-20 the annual-report page, media index and PDF returned HTTP 200
 * to a plain client and the site is not behind a WAF, so the plain path is
 * deterministic. The browser path is still tried first (headless Chromium) and
 * falls back to the plain client on any navigation/fetch failure. Both paths
 * discover the PDF from the council's own media index, and the connector
 * SHA-256 verifies and re-archives the exact bytes.
 */
export async function fetchCarrathoolGpfsViaBrowser(
  mediaUrl: string = CARRATHOOL_GPFS_MEDIA_SEARCH_URL,
  fiscalYear: string = CARRATHOOL_GPFS_FISCAL_YEAR,
  options: BrowserGpfsFetchOptions = {},
): Promise<BrowserGpfsFetch> {
  if (!options.forcePlain) {
    try {
      return await fetchViaChromium(mediaUrl, fiscalYear);
    } catch {
      // Fall through to the plain client.
    }
  }
  return fetchViaPlain(mediaUrl, fiscalYear, options.fetchImpl ?? globalThis.fetch);
}

const isMain =
  process.argv[1] !== undefined && /carrathool-gpfs-browser\.(?:ts|mjs|js)$/.test(process.argv[1]);

if (isMain) {
  const fetched = await fetchCarrathoolGpfsViaBrowser();
  console.log(
    `[carrathool-gpfs-browser] ${fetched.viaBrowser ? 'browser' : 'plain'} discovered ${fetched.pdfUrl} (${fetched.pdfBytes.byteLength} bytes)`,
  );
}
