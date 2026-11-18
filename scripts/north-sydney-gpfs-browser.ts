import {
  NORTH_SYDNEY_GPFS_FISCAL_YEAR,
  NORTH_SYDNEY_GPFS_REPORTING_URL,
  parseNorthSydneyGpfsReportPage,
} from '../server/src/connectors/north-sydney-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The browser-cleared official Financial Statements listing HTML. */
  listingHtml: string;
  /** Exact PDF bytes fetched by the browser from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official listing, for logging only. */
  pdfUrl: string;
}

/**
 * Fetch North Sydney Council's audited FY2024-25 GPFS through headless Chromium.
 *
 * The Financial Statements listing and file endpoints are protected by an AWS
 * WAF challenge. Node's plain fetch receives HTTP 202 with the challenge script,
 * and the Playwright headless shell is rejected with HTTP 403; the full Chromium
 * channel clears the challenge. The browser loads the official listing, the
 * FY2024-25 "Financial Statements 2024-2025" link is parsed from the cleared
 * HTML (never hard-coded), and the browser fetches the exact bytes from that
 * discovered URL. The connector still discovers the same link from the supplied
 * HTML, SHA-256 verifies and re-archives the bytes.
 */
export async function fetchNorthSydneyGpfsViaBrowser(
  reportingUrl: string = NORTH_SYDNEY_GPFS_REPORTING_URL,
  fiscalYear: string = NORTH_SYDNEY_GPFS_FISCAL_YEAR,
): Promise<BrowserGpfsFetch> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'en-AU',
      timezoneId: 'Australia/Sydney',
      viewport: { width: 1366, height: 900 },
    });
    const page = await context.newPage();
    const response = await page.goto(reportingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    if (!response) {
      throw new Error(`North Sydney Financial Statements listing returned no response`);
    }
    // 202 is the WAF challenge response; after the challenge script runs the
    // page navigates to the cleared listing.
    await page.waitForTimeout(10_000);
    const listingHtml = await page.content();
    const document = parseNorthSydneyGpfsReportPage(listingHtml, reportingUrl, fiscalYear);
    if (!document) {
      throw new Error(
        `North Sydney FY${fiscalYear} Financial Statements PDF link not found on ${reportingUrl}; refusing to invent one`,
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
    }, document.pdfUrl);
    const pdfBytes = new Uint8Array(Buffer.from(base64, 'base64'));
    return { listingHtml, pdfBytes, pdfUrl: document.pdfUrl };
  } finally {
    await browser.close();
  }
}
