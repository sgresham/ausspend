import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  WOLLONGONG_GPFS_FISCAL_YEAR,
  WOLLONGONG_GPFS_REPORTING_URL,
  parseWollongongGpfsReportLinks,
  selectWollongongGpfsDocument,
} from '../server/src/connectors/wollongong-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The browser-cleared official listing page HTML (Cloudflare challenge solved). */
  listingHtml: string;
  /** Exact PDF bytes downloaded by the browser from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official page, for logging only. */
  pdfUrl: string;
}

/**
 * Fetch Wollongong's audited FY2024-25 GPFS through headless Chromium.
 *
 * Plain HTTP to wollongong.nsw.gov.au returns HTTP 403 (Cloudflare managed
 * challenge), which is not proof of absence. The browser loads the official
 * financial-report page, the PDF link is parsed from the cleared HTML (never
 * hard-coded), and the browser downloads the exact bytes. The connector still
 * discovers the same link from the supplied HTML, SHA-256 verifies and
 * re-archives the bytes.
 */
export async function fetchWollongongGpfsViaBrowser(
  reportingUrl: string = WOLLONGONG_GPFS_REPORTING_URL,
  fiscalYear: string = WOLLONGONG_GPFS_FISCAL_YEAR,
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
        `Wollongong financial report page HTTP ${response?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    await page.waitForTimeout(2_000);
    const listingHtml = await page.content();
    const document = selectWollongongGpfsDocument(
      parseWollongongGpfsReportLinks(listingHtml, reportingUrl),
      fiscalYear,
    );
    const link = page.locator(`a[href="${document.url}"]`).first();
    if ((await link.count()) === 0) {
      throw new Error(
        `discovered GPFS link ${document.url} is not clickable on ${reportingUrl}; refusing to invent one`,
      );
    }
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
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
