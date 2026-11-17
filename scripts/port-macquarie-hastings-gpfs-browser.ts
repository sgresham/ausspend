import { chromium } from 'playwright';
import {
  PORT_MACQUARIE_HASTINGS_GPFS_FISCAL_YEAR,
  PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
  parsePortMacquarieHastingsGpfsReportLinks,
  selectPortMacquarieHastingsGpfsDocument,
} from '../server/src/connectors/port-macquarie-hastings-gpfs.js';

export interface BrowserGpfsFetch {
  /** The browser-cleared official reporting page HTML. */
  listingHtml: string;
  /** Exact PDF bytes downloaded by the browser from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official page, for logging only. */
  pdfUrl: string;
}

/**
 * Fetch Port Macquarie-Hastings Council's audited FY2024-25 GPFS through
 * headless Chromium.
 *
 * Plain HTTP from Node's fetch to pmhc.nsw.gov.au is rejected with an
 * Akamai-style HTTP 403, which is not proof of absence. The browser loads the
 * official "Annual reports and statements" page, the "Part 2 | Financial
 * Statements" PDF link is parsed from the cleared HTML (never hard-coded), and
 * the in-page fetch (which carries the browser's TLS/session context) downloads
 * the exact bytes. The connector still discovers the same link from the supplied
 * HTML, SHA-256 verifies and re-archives the bytes.
 */
export async function fetchPortMacquarieHastingsGpfsViaBrowser(
  reportingUrl: string = PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
  fiscalYear: string = PORT_MACQUARIE_HASTINGS_GPFS_FISCAL_YEAR,
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
        `Port Macquarie-Hastings reporting page HTTP ${response?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    // The page loads its document list after the shell; give the CMS a moment.
    await page.waitForTimeout(3_000);
    const listingHtml = await page.content();
    const document = selectPortMacquarieHastingsGpfsDocument(
      parsePortMacquarieHastingsGpfsReportLinks(listingHtml, reportingUrl),
      fiscalYear,
    );
    // The document anchor is present in the cleared HTML but may sit in a
    // collapsed/hidden listing, so clicking is unreliable. Fetch the exact
    // discovered URL from inside the page instead: that request carries the
    // browser's session/TLS context and clears the Akamai 403.
    const base64 = await page.evaluate(async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`in-page GPFS fetch HTTP ${response.status} for ${url}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
      }
      return btoa(binary);
    }, document.url);
    const pdfBytes = new Uint8Array(Buffer.from(base64, 'base64'));
    if (
      pdfBytes.byteLength < 1_000 ||
      Buffer.from(pdfBytes.subarray(0, 5)).toString() !== '%PDF-'
    ) {
      throw new Error('in-page GPFS fetch did not return a PDF; refusing to archive');
    }
    return { listingHtml, pdfBytes, pdfUrl: document.url };
  } finally {
    await browser.close();
  }
}
