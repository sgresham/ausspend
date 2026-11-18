import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  LAKE_MACQUARIE_GPFS_FISCAL_YEAR,
  LAKE_MACQUARIE_GPFS_REPORTING_URL,
  parseLakeMacquarieGpfsReportLinks,
  selectLakeMacquarieGpfsDocument,
} from '../server/src/connectors/lake-macquarie-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The browser-cleared official Annual Report page HTML. */
  listingHtml: string;
  /** Exact PDF bytes downloaded by the browser from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official page, for logging only. */
  pdfUrl: string;
}

/**
 * Fetch Lake Macquarie City Council's audited FY2024-25 GPFS through headless
 * Chromium.
 *
 * Plain HTTP to lakemac.com.au is rejected with an Akamai HTTP 403 (and during
 * discovery the CMS intermittently served a Granicus/OpenCities failover page),
 * which is not proof of absence. The browser loads the official Annual Report
 * page, the PDF link is parsed from the cleared HTML (never hard-coded), and the
 * browser downloads the exact bytes. The connector still discovers the same link
 * from the supplied HTML, SHA-256 verifies and re-archives the bytes.
 */
export async function fetchLakeMacquarieGpfsViaBrowser(
  reportingUrl: string = LAKE_MACQUARIE_GPFS_REPORTING_URL,
  fiscalYear: string = LAKE_MACQUARIE_GPFS_FISCAL_YEAR,
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
        `Lake Macquarie Annual Report page HTTP ${response?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    // The page loads its document list after the shell; give the CMS a moment.
    await page.waitForTimeout(3_000);
    const listingHtml = await page.content();
    const document = selectLakeMacquarieGpfsDocument(
      parseLakeMacquarieGpfsReportLinks(listingHtml, reportingUrl),
      fiscalYear,
    );
    const basename = new URL(document.url).pathname.split('/').pop() ?? '';
    const link = page
      .locator(`a[href$="${basename}"], a[title="${basename}"], a.ext-pdf[href*="${basename}"]`)
      .first();
    if ((await link.count()) === 0) {
      throw new Error(
        `discovered GPFS link ${document.url} is not clickable on ${reportingUrl}; refusing to invent one`,
      );
    }
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 180_000 }),
      link.click(),
    ]);
    const downloadedPath = await download.path();
    if (!downloadedPath) throw new Error('browser download produced no local file');
    const pdfBytes = new Uint8Array(await readFile(downloadedPath));
    return { listingHtml, pdfBytes, pdfUrl: document.url };
  } finally {
    await browser.close();
  }
}
