import {
  UPPER_LACHLAN_GPFS_FISCAL_YEAR,
  UPPER_LACHLAN_GPFS_REPORTING_URL,
  parseUpperLachlanGpfsReportLinks,
  selectUpperLachlanGpfsDocument,
} from '../server/src/connectors/upper-lachlan-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The browser-cleared official Plans and Reports page HTML. */
  listingHtml: string;
  /** Exact PDF bytes fetched by the browser from the discovered link. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the official page, for logging only. */
  pdfUrl: string;
}

/**
 * Fetch Upper Lachlan Shire Council's audited FY2025-26 GPFS through headless
 * Chromium.
 *
 * The official host may return an Edge/Akamai WAF challenge to a plain HTTP
 * client, which is not proof of absence. The browser loads the official
 * Plans and Reports page, the PDF link is parsed from the cleared HTML (never
 * hard-coded), and the browser fetches the exact bytes from that discovered URL.
 * The connector still discovers the same link from the supplied HTML, SHA-256
 * verifies and re-archives the bytes.
 */
export async function fetchUpperLachlanGpfsViaBrowser(
  reportingUrl: string = UPPER_LACHLAN_GPFS_REPORTING_URL,
  fiscalYear: string = UPPER_LACHLAN_GPFS_FISCAL_YEAR,
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
        `Upper Lachlan Plans and Reports page HTTP ${response?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    // The CMS loads its document list after the shell; give it a moment.
    await page.waitForTimeout(3_000);
    const listingHtml = await page.content();
    const links = parseUpperLachlanGpfsReportLinks(listingHtml, reportingUrl);
    const document = selectUpperLachlanGpfsDocument(links, fiscalYear);
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
    }, document.url);
    const pdfBytes = new Uint8Array(Buffer.from(base64, 'base64'));
    return { listingHtml, pdfBytes, pdfUrl: document.url };
  } finally {
    await browser.close();
  }
}

const isMain =
  process.argv[1] !== undefined &&
  /upper-lachlan-gpfs-browser\.(?:ts|mjs|js)$/.test(process.argv[1]);

if (isMain) {
  const fetched = await fetchUpperLachlanGpfsViaBrowser();
  console.log(
    `[upper-lachlan-gpfs-browser] discovered ${fetched.pdfUrl} (${fetched.pdfBytes.byteLength} bytes)`,
  );
}
