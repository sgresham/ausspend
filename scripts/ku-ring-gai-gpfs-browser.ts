import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  KU_RING_GAI_GPFS_FISCAL_YEAR,
  KU_RING_GAI_GPFS_REPORTING_URL,
  parseKuRingGaiGpfsReportPage,
} from '../server/src/connectors/ku-ring-gai-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The browser-cleared official Finance page HTML. */
  listingHtml: string;
  /** Exact PDF bytes downloaded by the browser from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official page, for logging only. */
  pdfUrl: string;
}

/**
 * Fetch Ku-ring-gai's audited FY2024-25 GPFS through headless Chromium.
 *
 * Plain HTTP to krg.nsw.gov.au returns HTTP 403, which is not proof of absence.
 * The browser loads the official Finance page, the PDF link is parsed from the
 * cleared HTML (never hard-coded), and the browser downloads the exact bytes.
 * The connector still discovers the same link from the supplied HTML, SHA-256
 * verifies and re-archives the bytes.
 */
export async function fetchKuRingGaiGpfsViaBrowser(
  reportingUrl: string = KU_RING_GAI_GPFS_REPORTING_URL,
  fiscalYear: string = KU_RING_GAI_GPFS_FISCAL_YEAR,
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
        `Ku-ring-gai Finance page HTTP ${response?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    await page.waitForTimeout(2_000);
    const listingHtml = await page.content();
    const document = parseKuRingGaiGpfsReportPage(listingHtml, reportingUrl, fiscalYear);
    if (!document) {
      throw new Error(
        `Ku-ring-gai FY${fiscalYear} Finance page has no official Financial statements PDF link; refusing to invent one`,
      );
    }
    // The listing rows sit inside collapsible panels, so click the discovered
    // anchor by its resolved URL rather than relying on it being visible.
    const href = await page.evaluate((absolute: string) => {
      const found = Array.from(document.querySelectorAll('a')).find(
        (anchor) => anchor.href === absolute,
      );
      return found ? found.getAttribute('href') : null;
    }, document.pdfUrl);
    if (!href) {
      throw new Error(
        `discovered GPFS link ${document.pdfUrl} is not present on ${reportingUrl}; refusing to invent one`,
      );
    }
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 180_000 }),
      page.$eval(`a[href="${href}"]`, (anchor) => (anchor as HTMLAnchorElement).click()),
    ]);
    const downloadedPath = await download.path();
    if (!downloadedPath) throw new Error('browser download produced no local file');
    const pdfBytes = new Uint8Array(await readFile(downloadedPath));
    return { listingHtml, pdfBytes, pdfUrl: document.pdfUrl };
  } finally {
    await browser.close();
  }
}
