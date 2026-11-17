import type { FetchStrategy } from '../../types.js';
import {
  findParliamentTabledPaper,
  fetchParliamentTabledPaper,
  NSW_BROWSER_HEADERS,
  type ParliamentFetchResult,
  type ParliamentTabledPaper,
} from './nsw-parliament.js';
import { fetchPdfHeadless, type HeadlessPdfFetcher } from './headless.js';

/** A discovered or operator-supplied annual-report PDF. */
export interface SocSourceDocument {
  /** Official publisher URL; kept as row provenance. */
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  /** Exact URL the bytes should be downloaded from (for example a mirror). */
  download_url?: string;
}

export interface ResolvedSocDocument {
  document: SocSourceDocument;
  bytes: Buffer;
  strategy: FetchStrategy;
  retrieved_from: string;
  archived_from: 'direct' | 'other';
  /** Safe archive filename; uses the artifact name for a Parliament fallback. */
  filename: string;
  note: string;
}

export interface ResolveSocDocumentOptions {
  source_id: string;
  /** Human label used in error messages and archive notes. */
  source_label: string;
  fetchImpl: typeof fetch;
  /** Discover the latest report from the official page (may throw on a 403). */
  discoverDirect: () => Promise<SocSourceDocument>;
  /** Operator/document override that replaces live discovery. */
  directDocument?: SocSourceDocument;
  /** Official discovery page, used as the headless referer. */
  discoveryPageUrl: string;
  /** Test-only injection point for the browser fallback. */
  headlessFetch?: HeadlessPdfFetcher;
  /** Test-only injection point for the NSW Parliament artifact lookup. */
  fetchParliament?: (
    sourceId: string,
    fetchImpl: typeof fetch,
    fiscalYear?: string,
  ) => Promise<ParliamentFetchResult | null>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isParliamentHost(url: string): boolean {
  try {
    return new URL(url).hostname === 'files.parliament.nsw.gov.au';
  } catch {
    return false;
  }
}

function looksLikePdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 4).toString('latin1') === '%PDF';
}

/** A safe archive filename derived from a URL, or the supplied fallback. */
export function pdfFilenameFromUrl(url: string, fallback: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through to the fallback name.
  }
  return fallback;
}

async function downloadPdf(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  const response = await fetchImpl(url, {
    redirect: 'follow',
    headers: NSW_BROWSER_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !/application\/pdf|application\/octet-stream/i.test(contentType)) {
    throw new Error(`expected application/pdf, got ${contentType} for ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!looksLikePdf(bytes)) {
    throw new Error(`response is not PDF bytes for ${url}`);
  }
  return bytes;
}

function parliamentDocument(paper: ParliamentTabledPaper): SocSourceDocument {
  return {
    url: paper.official_url,
    filename: paper.filename,
    fiscal_year: paper.fiscal_year,
    title: paper.title,
    download_url: paper.artifact_url,
  };
}

/**
 * Obtain the exact annual-report bytes with a deterministic ladder:
 *
 *   1. direct browser-like fetch from the publisher (strategy `direct`);
 *   2. NSW Parliament tabled-paper artifact (strategy `parliament_fallback`);
 *   3. headless browser, only when both are blocked (strategy `headless`);
 *   4. otherwise throw with every attempt's reason. The runner then marks the
 *      source degraded, preserves all existing rows and records staleness.
 */
export async function resolveSocDocument(
  options: ResolveSocDocumentOptions,
): Promise<ResolvedSocDocument> {
  const failures: string[] = [];
  let candidate: SocSourceDocument | null = options.directDocument ?? null;

  if (!candidate) {
    try {
      candidate = await options.discoverDirect();
    } catch (error) {
      failures.push(`direct discovery: ${errorMessage(error)}`);
    }
  }

  if (candidate) {
    const downloadUrl = candidate.download_url ?? candidate.url;
    try {
      const bytes = await downloadPdf(downloadUrl, options.fetchImpl);
      const strategy: FetchStrategy = isParliamentHost(downloadUrl)
        ? 'parliament_fallback'
        : 'direct';
      return {
        document: candidate,
        bytes,
        strategy,
        retrieved_from: downloadUrl,
        archived_from: downloadUrl === candidate.url ? 'direct' : 'other',
        filename: pdfFilenameFromUrl(
          strategy === 'parliament_fallback' ? downloadUrl : candidate.url,
          candidate.filename,
        ),
        note:
          strategy === 'parliament_fallback'
            ? `${options.source_label} document downloaded from the NSW Parliament tabled-paper artifact because the publisher blocks direct browser-like fetches.`
            : `${options.source_label} document downloaded directly from the publisher.`,
      };
    } catch (error) {
      failures.push(`direct download: ${errorMessage(error)}`);
    }
  }

  let parliamentPaper: ParliamentTabledPaper | null = null;
  try {
    const lookup = options.fetchParliament ?? fetchParliamentTabledPaper;
    const fetched = await lookup(options.source_id, options.fetchImpl, candidate?.fiscal_year);
    if (fetched) {
      parliamentPaper = fetched.paper;
      return {
        document: parliamentDocument(fetched.paper),
        bytes: fetched.bytes,
        strategy: 'parliament_fallback',
        retrieved_from: fetched.paper.artifact_url,
        archived_from: 'other',
        filename: pdfFilenameFromUrl(fetched.paper.artifact_url, fetched.paper.filename),
        note: fetched.paper.note,
      };
    }
    failures.push('parliament fallback: no NSW Parliament tabled-paper registry entry');
  } catch (error) {
    failures.push(`parliament fallback: ${errorMessage(error)}`);
  }

  const headlessDocument =
    candidate ??
    (parliamentPaper ? parliamentDocument(parliamentPaper) : null) ??
    (() => {
      const paper = findParliamentTabledPaper(options.source_id);
      return paper ? parliamentDocument(paper) : null;
    })();

  const headlessUrl = headlessDocument?.download_url ?? headlessDocument?.url;
  if (headlessUrl) {
    try {
      const fetcher = options.headlessFetch ?? fetchPdfHeadless;
      const bytes = await fetcher(headlessUrl, options.discoveryPageUrl);
      if (!looksLikePdf(bytes)) throw new Error('headless fetch did not return PDF bytes');
      return {
        document: headlessDocument as SocSourceDocument,
        bytes,
        strategy: 'headless',
        retrieved_from: headlessUrl,
        archived_from: 'direct',
        filename: pdfFilenameFromUrl(headlessUrl, 'annual-report.pdf'),
        note: `${options.source_label} document read through a headless browser after the publisher and the NSW Parliament artifact both challenged non-browser fetches.`,
      };
    } catch (error) {
      failures.push(`headless: ${errorMessage(error)}`);
    }
  } else {
    failures.push('headless: no candidate PDF URL');
  }

  throw new Error(
    `${options.source_label} document unavailable after direct, NSW Parliament and headless attempts: ${failures.join('; ')}`,
  );
}
