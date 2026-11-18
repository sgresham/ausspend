import { createRequire } from 'node:module';
import { HORNSBY_GPFS_FISCAL_YEAR, HORNSBY_GPFS_REPORTING_URL } from './config.js';
import { parseHornsbyGpfsReportPage } from './parse.js';

const require = createRequire(import.meta.url);

/**
 * Hornsby Shire Council's website answers plain HTTP clients with HTTP 403, so
 * both the Financial Statements listing and the published PDF must be fetched
 * through headless Chromium. The browser loads the official page, the PDF link
 * is parsed from that cleared HTML (never hard-coded), and the exact bytes are
 * read from inside the same browser context. Playwright is loaded lazily so the
 * server does not require a browser in normal operation.
 */
export interface HornsbyGpfsBrowserFetch {
  /** The browser-cleared official Financial Statements page HTML. */
  listingHtml: string;
  /** Exact PDF bytes downloaded from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official page, for logging only. */
  pdfUrl: string;
}

interface ChromiumPage {
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  content(): Promise<string>;
  evaluate<T>(fn: (url: string) => Promise<T>, arg: string): Promise<T>;
}

interface ChromiumBrowser {
  newContext(options: Record<string, unknown>): Promise<{
    newPage(): Promise<ChromiumPage>;
  }>;
  close(): Promise<void>;
}

interface ChromiumLauncher {
  launch(options: { headless: boolean }): Promise<ChromiumBrowser>;
}

function loadChromium(): ChromiumLauncher {
  try {
    const playwright = require('@playwright/test') as { chromium?: ChromiumLauncher };
    if (!playwright.chromium) throw new Error('@playwright/test has no chromium export');
    return playwright.chromium;
  } catch (error) {
    throw new Error(
      `headless browser unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function fetchHornsbyGpfsViaBrowser(
  reportingUrl: string = HORNSBY_GPFS_REPORTING_URL,
  fiscalYear: string = HORNSBY_GPFS_FISCAL_YEAR,
  parseReportPage: (
    html: string,
    baseUrl: string,
    year: string,
  ) => { pdfUrl: string } | null = parseHornsbyGpfsReportPage,
): Promise<HornsbyGpfsBrowserFetch> {
  const chromium = loadChromium();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT, acceptDownloads: true });
    const page = await context.newPage();
    const response = (await page.goto(reportingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })) as { ok?(): boolean; status?(): number } | null;
    if (response && typeof response.ok === 'function' && !response.ok()) {
      throw new Error(
        `Hornsby Financial Statements page HTTP ${typeof response.status === 'function' ? response.status() : 'error'} after browser navigation`,
      );
    }
    // The document list is server-rendered, but give the CMS shell a moment.
    await page.waitForTimeout(4_000);
    const listingHtml = await page.content();
    const document = parseReportPage(listingHtml, reportingUrl, fiscalYear);
    if (!document) {
      throw new Error(
        `Hornsby FY${fiscalYear} Financial Statements page has no official audited statements PDF link after browser navigation; refusing to guess a document URL`,
      );
    }
    const base64 = await page.evaluate(async (url: string) => {
      const pdf = await fetch(url, { credentials: 'include' });
      if (!pdf.ok) throw new Error(`HTTP ${pdf.status}`);
      const bytes = new Uint8Array(await pdf.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
      }
      return btoa(binary);
    }, document.pdfUrl);
    const pdfBytes = new Uint8Array(Buffer.from(base64, 'base64'));
    if (Buffer.from(pdfBytes.subarray(0, 4)).toString('latin1') !== '%PDF') {
      throw new Error('headless download did not return PDF bytes');
    }
    return { listingHtml, pdfBytes, pdfUrl: document.pdfUrl };
  } finally {
    await browser.close();
  }
}
