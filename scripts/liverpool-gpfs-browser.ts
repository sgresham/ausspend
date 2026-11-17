import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  LIVERPOOL_GPFS_FISCAL_YEAR,
  LIVERPOOL_GPFS_REPORTING_URL,
  parseLiverpoolGpfsReportPage,
} from '../server/src/connectors/liverpool-gpfs.js';

export interface BrowserGpfsFetch {
  /** The browser-cleared official listing page HTML (Cloudflare challenge solved). */
  listingHtml: string;
  /** Exact PDF bytes downloaded by the browser from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official page, for logging only. */
  pdfUrl: string;
}

/**
 * Fetch Liverpool's audited FY2024-25 GPFS through headless Chromium.
 *
 * Plain HTTP to liverpool.nsw.gov.au returns HTTP 403 (Cloudflare managed
 * challenge), which is not proof of absence. The browser loads the official
 * Finance Reports page, the PDF link is parsed from the cleared HTML (never
 * hard-coded), and the browser downloads the exact bytes. The connector still
 * discovers the same link from the supplied HTML, SHA-256 verifies and
 * re-archives the bytes.
 */
export async function fetchLiverpoolGpfsViaBrowser(
  reportingUrl: string = LIVERPOOL_GPFS_REPORTING_URL,
  fiscalYear: string = LIVERPOOL_GPFS_FISCAL_YEAR,
): Promise<BrowserGpfsFetch> {
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
      timeout: 60_000,
    });
    if (!response || !response.ok()) {
      throw new Error(
        `Liverpool Finance Reports page HTTP ${response?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    // The Cloudflare managed challenge clears a few seconds after the first
    // navigation; poll the cleared HTML for the FY table instead of guessing a
    // fixed wait.
    let listingHtml = await page.content();
    let document = parseLiverpoolGpfsReportPage(listingHtml, reportingUrl, fiscalYear);
    for (let attempt = 0; attempt < 20 && !document; attempt += 1) {
      await page.waitForTimeout(1_000);
      listingHtml = await page.content();
      document = parseLiverpoolGpfsReportPage(listingHtml, reportingUrl, fiscalYear);
    }
    if (!document) {
      throw new Error(
        `Liverpool FY${fiscalYear} Finance Reports page has no official Audited Financial Statement PDF link after the browser challenge cleared; refusing to invent one`,
      );
    }
    const link = page.locator(`a[href="${document.pdfUrl}"]`).first();
    if ((await link.count()) === 0) {
      throw new Error(
        `discovered GPFS link ${document.pdfUrl} is not clickable on ${reportingUrl}; refusing to invent one`,
      );
    }
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 180_000 }),
      link.click(),
    ]);
    const downloadedPath = await download.path();
    if (!downloadedPath) throw new Error('browser download produced no local file');
    const pdfBytes = new Uint8Array(await readFile(downloadedPath));
    return { listingHtml, pdfBytes, pdfUrl: document.pdfUrl };
  } finally {
    await browser.close();
  }
}
