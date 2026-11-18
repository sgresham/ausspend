import {
  RANDWICK_GPFS_FISCAL_YEAR,
  RANDWICK_GPFS_REPORTING_URL,
  parseRandwickGpfsReportPage,
} from '../server/src/connectors/randwick-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The browser-cleared official Our reports page HTML. */
  listingHtml: string;
  /** Exact PDF bytes fetched by the browser from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official page, for logging only. */
  pdfUrl: string;
}

/**
 * Fetch Randwick City Council's audited FY2024-25 GPFS through headless
 * Chromium.
 *
 * Node's plain fetch to randwick.nsw.gov.au is rejected with a Cloudflare "Just a
 * moment..." challenge (HTTP 403), which is not proof of absence. The browser
 * loads the official "Our reports" page, the FY2024-25 "Financial Statements -
 * 2024-25" link is parsed from the cleared HTML (never hard-coded), and the
 * browser fetches the exact bytes from that discovered URL (same-origin,
 * carrying the Cloudflare clearance cookies). The connector still discovers the
 * same link from the supplied HTML, SHA-256 verifies and re-archives the bytes.
 */
export async function fetchRandwickGpfsViaBrowser(
  reportingUrl: string = RANDWICK_GPFS_REPORTING_URL,
  fiscalYear: string = RANDWICK_GPFS_FISCAL_YEAR,
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
        `Randwick Our reports page HTTP ${response?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    // The CMS renders its document list after the Cloudflare challenge clears.
    await page.waitForTimeout(5_000);
    const listingHtml = await page.content();
    const document = parseRandwickGpfsReportPage(listingHtml, reportingUrl, fiscalYear);
    if (!document) {
      throw new Error(
        `Randwick FY${fiscalYear} Financial Statements PDF link not found on ${reportingUrl}; refusing to invent one`,
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
