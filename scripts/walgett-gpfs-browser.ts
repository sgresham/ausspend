import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  WALGETT_GPFS_FISCAL_YEAR,
  WALGETT_GPFS_REPORTING_URL,
  WALGETT_GPFS_REQUEST_HEADERS,
  WALGETT_GPFS_SNAPSHOT_URL,
} from '../server/src/connectors/walgett-gpfs/index.js';

export interface BrowserAnchor {
  text: string;
  href: string;
}

export interface WalgettGpfsBrowserFetch {
  /** The rendered official Annual Reports and Financial Statements page HTML. */
  listingHtml: string;
  /** Exact PDF bytes captured from the official same-origin file. */
  pdfBytes: Uint8Array;
  /** The PDF URL discovered from the rendered page, for logging only. */
  pdfUrl: string;
  /** True when headless Chromium performed the navigation and fetch. */
  viaBrowser: boolean;
  /** The published CMS snapshot the SPA requested, observed on the network. */
  snapshotUrl: string | null;
  /** HTTP statuses observed for the SPA and its snapshot request. */
  observedRequests: Array<{ url: string; status: number }>;
}

export interface WalgettGpfsBrowserOptions {
  /** Override only for tests; the live path uses the official SPA and snapshot. */
  fetchImpl?: typeof fetch;
}

function fiscalYearPattern(fiscalYear: string): RegExp {
  return new RegExp(fiscalYear.replace('-', '[-–—/ ]?'), 'i');
}

/**
 * Select the audited standalone financial-statements PDF from anchors rendered
 * by the SPA. The narrative annual report is explicitly excluded, and a
 * different requested year is never satisfied by the FY2024-25 file.
 */
export function selectWalgettGpfsAnchor(
  anchors: readonly BrowserAnchor[],
  fiscalYear: string = WALGETT_GPFS_FISCAL_YEAR,
): BrowserAnchor | null {
  const year = fiscalYearPattern(fiscalYear);
  for (const anchor of anchors) {
    const text = anchor.text.replace(/[–—]/g, '-');
    if (!/\.pdf(?:$|\?)/i.test(anchor.href)) continue;
    if (!/audited[\s_-]*financial[\s_-]*statements?/i.test(text)) continue;
    if (/\bannual report\b/i.test(text) && !/audited/i.test(text)) continue;
    if (!year.test(text)) continue;
    return anchor;
  }
  return null;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function fetchViaChromium(
  reportingUrl: string,
  fiscalYear: string,
): Promise<WalgettGpfsBrowserFetch> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      userAgent: WALGETT_GPFS_REQUEST_HEADERS['user-agent'],
    });
    const page = await context.newPage();
    const observedRequests: Array<{ url: string; status: number }> = [];
    page.on('response', (response: { url(): string; status(): number }) => {
      const url = response.url();
      if (url.includes('/snapshot') || url.includes('/assets/files/')) {
        observedRequests.push({ url, status: response.status() });
      }
    });
    const landing = await page.goto(reportingUrl, {
      waitUntil: 'networkidle',
      timeout: 90_000,
    });
    if (!landing || !landing.ok()) {
      throw new Error(
        `Walgett Annual Reports page HTTP ${landing?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    // The SPA renders the CMS file list after the snapshot loads.
    await page.waitForTimeout(2_000);
    const listingHtml = await page.content();
    const anchors = await page.$$eval('a', (nodes: Array<{ textContent: string | null; getAttribute(name: string): string | null }>) =>
      nodes
        .map((node) => ({
          text: (node.textContent ?? '').trim(),
          href: node.getAttribute('href') ?? '',
        }))
        .filter((anchor) => anchor.href.length > 0),
    );
    const anchor = selectWalgettGpfsAnchor(anchors, fiscalYear);
    if (!anchor) {
      throw new Error(
        `Walgett FY${fiscalYear} audited financial statements PDF link not found in the rendered page; refusing to invent one`,
      );
    }
    const pdfUrl = new URL(anchor.href, reportingUrl).toString();
    const base64 = await page.evaluate(async (url: string) => {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
      }
      return btoa(binary);
    }, pdfUrl);
    const pdfBytes = new Uint8Array(Buffer.from(base64, 'base64'));
    if (Buffer.from(pdfBytes.subarray(0, 4)).toString('latin1') !== '%PDF') {
      throw new Error('headless browser fetch did not return PDF bytes');
    }
    const snapshot = observedRequests.find((request) =>
      request.url.startsWith(WALGETT_GPFS_SNAPSHOT_URL),
    );
    return {
      listingHtml,
      pdfBytes,
      pdfUrl,
      viaBrowser: true,
      snapshotUrl: snapshot?.url ?? null,
      observedRequests,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Fetch Walgett Shire Council's latest published standalone audited FY2024-25
 * GPFS through headless Chromium.
 *
 * The annual-reports page is a client-rendered SPA whose HTML shell contains no
 * document links. The browser loads the official page, observes the
 * `/snapshot.json` network request, reads the rendered file-list anchors, and
 * fetches the exact same-origin PDF bytes. The connector performs the same
 * discovery from the snapshot over plain HTTP and SHA-256 verifies the bytes.
 */
export async function fetchWalgettGpfsViaBrowser(
  reportingUrl: string = WALGETT_GPFS_REPORTING_URL,
  fiscalYear: string = WALGETT_GPFS_FISCAL_YEAR,
  options: WalgettGpfsBrowserOptions = {},
): Promise<WalgettGpfsBrowserFetch> {
  if (options.fetchImpl) {
    // Tests only: the production path is the official headless browser.
    const snapshot = await options.fetchImpl(WALGETT_GPFS_SNAPSHOT_URL, {
      headers: WALGETT_GPFS_REQUEST_HEADERS,
    });
    if (!snapshot.ok) throw new Error(`Walgett CMS snapshot HTTP ${snapshot.status}`);
    const { parseWalgettSnapshotDocument } = await import(
      '../server/src/connectors/walgett-gpfs/index.js'
    );
    const document = parseWalgettSnapshotDocument(await snapshot.json(), fiscalYear);
    if (!document) {
      throw new Error(
        `Walgett FY${fiscalYear} audited financial statements were not found in the published CMS snapshot`,
      );
    }
    const pdf = await options.fetchImpl(document.url, {
      headers: WALGETT_GPFS_REQUEST_HEADERS,
    });
    if (!pdf.ok) throw new Error(`Walgett audited financial statements PDF HTTP ${pdf.status}`);
    return {
      listingHtml: '',
      pdfBytes: new Uint8Array(await pdf.arrayBuffer()),
      pdfUrl: document.url,
      viaBrowser: false,
      snapshotUrl: WALGETT_GPFS_SNAPSHOT_URL,
      observedRequests: [],
    };
  }
  return fetchViaChromium(reportingUrl, fiscalYear);
}

function parseOut(argv: readonly string[]): string | undefined {
  for (const arg of argv) {
    if (arg.startsWith('--out=')) return arg.slice('--out='.length);
  }
  return undefined;
}

const isMain =
  process.argv[1] !== undefined && /walgett-gpfs-browser\.(?:ts|mjs|js)$/.test(process.argv[1]);

if (isMain) {
  const out = parseOut(process.argv.slice(2));
  const fetched = await fetchWalgettGpfsViaBrowser();
  const digest = sha256(fetched.pdfBytes);
  console.log(
    `[walgett-gpfs-browser] ${fetched.viaBrowser ? 'browser' : 'plain'} discovered ${fetched.pdfUrl} (${fetched.pdfBytes.byteLength} bytes) sha256=${digest}`,
  );
  console.log(
    `[walgett-gpfs-browser] snapshot ${fetched.snapshotUrl ?? 'not observed'} requests=${fetched.observedRequests.length}`,
  );
  if (out) {
    await writeFile(out, fetched.pdfBytes);
    console.log(`[walgett-gpfs-browser] wrote ${out}`);
  }
  process.exit(0);
}
