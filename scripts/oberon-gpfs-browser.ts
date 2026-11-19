import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  OBERON_GPFS_DOCUMENT_PIN,
  OBERON_GPFS_FISCAL_YEAR,
  OBERON_GPFS_REPORTING_URL,
  OBERON_GPFS_REQUEST_HEADERS,
  discoverOberonGpfsDocument,
} from '../server/src/connectors/oberon-gpfs/index.js';

export interface BrowserGpfsFetch {
  /** The official Have Your Say project page HTML. */
  listingHtml: string;
  /** Exact PDF bytes captured from the official download. */
  pdfBytes: Uint8Array;
  /** Stable official document entry point for logging. */
  pdfUrl: string;
  /** The resolved (signed) download URL, for evidence only. */
  resolvedUrl: string;
  /** True when headless Chromium captured the download. */
  viaBrowser: boolean;
}

export interface BrowserGpfsFetchOptions {
  /** Override only for tests; the live path captures the official download. */
  forcePlain?: boolean;
  /** Used only by the test plain path to return fixture bytes. */
  fetchImpl?: typeof fetch;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function fetchViaChromium(
  listingUrl: string,
  documentUrl: string,
): Promise<BrowserGpfsFetch> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      userAgent: OBERON_GPFS_REQUEST_HEADERS['user-agent'],
    });
    const page = await context.newPage();
    const landing = await page.goto(listingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    if (!landing || !landing.ok()) {
      throw new Error(
        `Oberon Have Your Say page HTTP ${landing?.status() ?? 'no-response'} after browser navigation`,
      );
    }
    await page.waitForTimeout(2_000);
    const listingHtml = await page.content();
    if (!listingHtml.includes('318527') && !listingHtml.includes(documentUrl)) {
      // The Documents tab is lazy-rendered; give it another pass.
      await page.waitForTimeout(2_000);
    }
    const confirmedHtml = await page.content();
    const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
    // The document entry point triggers a download, so the navigation itself
    // may abort with net::ERR_ABORTED. The download event carries the bytes.
    await page.goto(documentUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => null);
    const download = await downloadPromise;
    const suggested = download.suggestedFilename();
    if (!/GPFS-2025/i.test(suggested) || !/\.pdf$/i.test(suggested)) {
      throw new Error(
        `Oberon download filename ${JSON.stringify(suggested)} does not look like the FY2024-25 GPFS PDF`,
      );
    }
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const pdfBytes = new Uint8Array(Buffer.concat(chunks));
    if (pdfBytes.byteLength === 0) {
      throw new Error('Oberon GPFS download returned zero bytes');
    }
    return {
      listingHtml: confirmedHtml,
      pdfBytes,
      pdfUrl: documentUrl,
      resolvedUrl: download.url(),
      viaBrowser: true,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Fetch Oberon Council's latest available full audited GPFS.
 *
 * The main council site lists only a 52 MB combined annual report bundle; the
 * separate FY2024-25 GPFS is published in the Documents tab of the official
 * Have Your Say Oberon page. The document entry point triggers a browser
 * download, so the browser helper captures the exact bytes. The connector
 * SHA-256 verifies and re-archives them.
 */
export async function fetchOberonGpfsViaBrowser(
  listingUrl: string = OBERON_GPFS_REPORTING_URL,
  fiscalYear: string = OBERON_GPFS_FISCAL_YEAR,
  options: BrowserGpfsFetchOptions = {},
): Promise<BrowserGpfsFetch> {
  const document = discoverOberonGpfsDocument(fiscalYear);
  if (options.forcePlain) {
    // Tests only: the production path is the official browser download. The
    // plain client is given the exact document bytes by the test fetchImpl.
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    const response = await fetchImpl(document.url, {
      redirect: 'follow',
      headers: OBERON_GPFS_REQUEST_HEADERS,
    });
    if (!response.ok) {
      throw new Error(`Oberon GPFS plain fetch HTTP ${response.status}`);
    }
    return {
      listingHtml: '',
      pdfBytes: new Uint8Array(await response.arrayBuffer()),
      pdfUrl: document.url,
      resolvedUrl: document.url,
      viaBrowser: false,
    };
  }
  return fetchViaChromium(listingUrl, document.url);
}

function parseOut(argv: readonly string[]): string | undefined {
  for (const arg of argv) {
    if (arg.startsWith('--out=')) return arg.slice('--out='.length);
  }
  return undefined;
}

const isMain =
  process.argv[1] !== undefined && /oberon-gpfs-browser\.(?:ts|mjs|js)$/.test(process.argv[1]);

if (isMain) {
  const out = parseOut(process.argv.slice(2));
  const fetched = await fetchOberonGpfsViaBrowser();
  const digest = sha256(fetched.pdfBytes);
  console.log(
    `[oberon-gpfs-browser] ${fetched.viaBrowser ? 'browser' : 'plain'} discovered ${fetched.pdfUrl} (${fetched.pdfBytes.byteLength} bytes) sha256=${digest}`,
  );
  if (fetched.pdfUrl !== OBERON_GPFS_DOCUMENT_PIN) {
    console.log(`[oberon-gpfs-browser] note: pinned URL is ${OBERON_GPFS_DOCUMENT_PIN}`);
  }
  if (out) {
    await writeFile(out, fetched.pdfBytes);
    console.log(`[oberon-gpfs-browser] wrote ${out}`);
  }
  process.exit(0);
}
