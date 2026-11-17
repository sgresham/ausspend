import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * A headless browser fetch is the last resort before a source is marked
 * degraded. It is only used when both the direct publisher fetch and the NSW
 * Parliament tabled-paper fallback fail. Playwright is loaded lazily so the
 * server does not require a browser in normal operation; if the package or a
 * browser binary is missing, the caller records the reason and degrades the
 * source instead of crashing.
 */
export type HeadlessPdfFetcher = (pdfUrl: string, refererUrl?: string) => Promise<Buffer>;

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function looksLikePdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 4).toString('latin1') === '%PDF';
}

interface PlaywrightChromium {
  launch(options: { headless: boolean }): Promise<{
    newContext(options: Record<string, unknown>): Promise<{
      newPage(): Promise<{
        goto(url: string, options: { waitUntil: string; timeout: number }): Promise<unknown>;
        waitForTimeout(ms: number): Promise<void>;
        evaluate<T>(fn: (url: string) => Promise<T>, arg: string): Promise<T>;
      }>;
    }>;
    close(): Promise<void>;
  }>;
}

function loadChromium(): PlaywrightChromium {
  try {
    // Runtime-only dependency: @playwright/test is a root devDependency. A
    // production image without Chromium fails here, and the connector degrades
    // cleanly with the error message.
    const playwright = require('@playwright/test') as { chromium?: PlaywrightChromium };
    if (!playwright.chromium) throw new Error('@playwright/test has no chromium export');
    return playwright.chromium;
  } catch (error) {
    throw new Error(`headless browser unavailable: ${errorMessage(error)}`);
  }
}

/**
 * Load `refererUrl` (to obtain Cloudflare clearance) then fetch `pdfUrl` from
 * inside the browser context and return the exact bytes. The in-page fetch is
 * required because the CDN challenges a plain Playwright request even after
 * the page itself has loaded.
 */
export async function fetchPdfHeadless(pdfUrl: string, refererUrl?: string): Promise<Buffer> {
  const chromium = loadChromium();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT, acceptDownloads: true });
    const page = await context.newPage();
    if (refererUrl && refererUrl !== pdfUrl) {
      await page.goto(refererUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // Give a non-interactive Cloudflare challenge time to clear.
      await page.waitForTimeout(4_000);
    }
    const base64 = await page.evaluate(async (url: string) => {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
      }
      return btoa(binary);
    }, pdfUrl);
    const bytes = Buffer.from(base64, 'base64');
    if (!looksLikePdf(bytes)) {
      throw new Error(
        'headless fetch did not return PDF bytes (Cloudflare challenge did not clear)',
      );
    }
    return bytes;
  } finally {
    await browser.close();
  }
}
