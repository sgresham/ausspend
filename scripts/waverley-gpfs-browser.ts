import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  WAVERLEY_GPFS_FISCAL_YEAR,
  WAVERLEY_GPFS_REPORTING_URL,
  parseWaverleyGpfsReportPage,
} from '../server/src/connectors/waverley-gpfs.js';

export interface BrowserGpfsFetch {
  /** The browser-cleared official Annual Statement of Accounts page HTML. */
  listingHtml: string;
  /** Exact PDF bytes downloaded by the browser from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official page, for logging only. */
  pdfUrl: string;
}

/**
 * Fetch Waverley Council's audited FY2024-25 GPFS through headless Chromium.
 *
 * Plain HTTP to waverley.nsw.gov.au is rejected with a Cloudflare "Just a
 * moment..." HTTP 403, which is not proof of absence. The browser loads the
 * official "Annual Statement of Accounts" page, the PDF link is parsed from the
 * cleared HTML (never hard-coded), and the browser downloads the exact bytes.
 * The connector still discovers the same link from the supplied HTML, SHA-256
 * verifies and re-archives the bytes.
 */
export async function fetchWaverleyGpfsViaBrowser(
  reportingUrl: string = WAVERLEY_GPFS_REPORTING_URL,
  fiscalYear: string = WAVERLEY_GPFS_FISCAL_YEAR,
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
      timeout: 90_000,
    });
    if (!response || !response.ok()) {
      throw new Error(
        `Waverley Annual Statement of Accounts page HTTP ${response?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    // The CMS loads its document list after the shell; give it a moment.
    await page.waitForTimeout(3_000);
    const listingHtml = await page.content();
    const document = parseWaverleyGpfsReportPage(listingHtml, reportingUrl, fiscalYear);
    if (!document) {
      throw new Error(
        `Waverley FY${fiscalYear} audited financial-statements PDF link not found on ${reportingUrl}; refusing to invent one`,
      );
    }
    const basename = new URL(document.pdfUrl).pathname.split('/').pop() ?? '';
    const link = page.locator(`a[href$="${basename}"], a[title="${basename}"]`).first();
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
