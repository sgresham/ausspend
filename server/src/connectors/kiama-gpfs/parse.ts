import type { SpendingRecord } from '@ausspend/shared';
import { extractArchivedPdf, type PdfExtraction, type PdfPage } from '../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import type { Connector, RawRecord } from '../types.js';

/**
 * NSW council annual-report GPFS adapter: Kiama Municipal Council's FY2024-25
 * annual report. The official annual report was checked and does **not** contain
 * the audited General Purpose Financial Statements section: the report is
 * narrative-only, with an un-audited "Consolidated operating results" summary on
 * page 19, and ends at the Authorisation and version control page (page 91). The
 * official Annual Reports and Financial Statements page publishes a separate
 * current-year "Financial-Statements-2024-25" PDF (10,095,862 bytes, 93 pages)
 * containing the audited GPFS and the independent auditor's report. The brief
 * limits this item to the annual report and forbids substituting a standalone
 * report, so this connector defers with 0 rows and records the exact gap. The
 * separate current-year FS is recorded for a future cure item; it is not an older
 * prior-year substitute and is not ingested here.
 */
export const KIAMA_GPFS_ID = 'kiama-gpfs';
export const KIAMA_GPFS_NAME = 'Kiama Municipal Council — Annual Report Financial Statements';
export const KIAMA_GPFS_PUBLISHER = 'Kiama Municipal Council';
export const KIAMA_GPFS_REPORTING_URL =
  'https://www.kiama.nsw.gov.au/Council/Community-Reports/Annual-Reports-and-Financial-Statements';
/** Documented official pin for the latest annual report (FY2024-25). */
export const KIAMA_GPFS_DOCUMENT_PIN =
  'https://www.kiama.nsw.gov.au/files/sharedassets/public/v/2/council/council-plans-amp-reports/2024-25-annual-report-final.pdf';
/**
 * The separate current-year FY2024-25 Financial Statements PDF published on the
 * same official page. Recorded for the evidence trail only; the
 * annual-report-only item does not ingest it and does not substitute it.
 */
export const KIAMA_GPFS_STANDALONE_FS_URL =
  'https://www.kiama.nsw.gov.au/files/sharedassets/public/v/1/council/council-plans-amp-reports/financial-plans-and-annual-reports/kiama-municipal-council-financial-statements-2024-25.pdf';
export const KIAMA_GPFS_FISCAL_YEAR = '2024-25';
export const KIAMA_GPFS_SOURCE_DATASET = 'Kiama Municipal Council Annual Report 2024-25';
export const KIAMA_GPFS_LICENSE =
  '© Kiama Municipal Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const KIAMA_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const KIAMA_GPFS_DELIVERY_ENTITY = 'Kiama Municipal Council';
export const KIAMA_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export interface KiamaGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  listing_url?: string;
  resolved_url?: string;
}

export interface KiamaGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface KiamaGpfsParseContext {
  document: KiamaGpfsDocument;
  archive: KiamaGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface KiamaGpfsRejection {
  section: string;
  reason: string;
}

export interface KiamaGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: null;
  warnings: string[];
  rejections: KiamaGpfsRejection[];
}

function decodeHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convert an annual-report label or URL to a fiscal year (2024-25 → 2024-25). */
export function fiscalYearFromKiamaAnnualReportLink(text: string): string | null {
  const june = /year\s+ended\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
    text.replace(/[-_]+/g, ' ').replace(/\s+/g, ' '),
  );
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  const normalized = text
    .replace(/\bto\b/gi, '-')
    .replace(/\b((?:19|20)\d{2})\s+((?:19|20)?\d{2})\b/g, '$1-$2')
    .replace(/\s*[-/]+\s*/g, '-')
    .replace(/\s+/g, ' ');
  const matches = [...normalized.matchAll(/((?:19|20)\d{2})-((?:19|20)?\d{2})/g)];
  const match = matches[matches.length - 1];
  if (!match) return null;
  const startYear = Number(match[1]);
  const endRaw = match[2]!;
  const end =
    endRaw.length === 2 ? Math.floor(startYear / 100) * 100 + Number(endRaw) : Number(endRaw);
  if (end !== startYear + 1) return null;
  return `${startYear}-${String(end).slice(-2)}`;
}

interface Anchor {
  href: string;
  title: string;
  text: string;
}

function anchors(html: string): Anchor[] {
  const out: Anchor[] = [];
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const attrs = match[1]!;
    const hrefMatch = /href="([^"]+)"/i.exec(attrs);
    if (!hrefMatch) continue;
    const titleMatch = /title="([^"]*)"/i.exec(attrs);
    out.push({
      href: hrefMatch[1]!,
      title: titleMatch ? decodeHtml(titleMatch[1]!) : '',
      text: decodeHtml(match[2]!),
    });
  }
  return out;
}

/**
 * Parse the official Annual Reports and Financial Statements page. Kiama lists
 * each annual report as a direct `.pdf` upload labelled "Annual Report YYYY-YY"
 * and the separate financial statements as "Financial-Statements-YYYY-YY". Only
 * the annual report links are selected; the separate current-year FS, prior-year
 * reports and the 2022-23 addendum are ignored.
 */
export function parseKiamaGpfsReportLinks(html: string, baseUrl: string): KiamaGpfsDocument[] {
  const links: KiamaGpfsDocument[] = [];
  const seen = new Set<string>();
  const baseHost = new URL(baseUrl).host.replace(/^www\./, '');
  for (const anchor of anchors(html)) {
    const label = `${anchor.title} ${anchor.text}`.trim();
    if (!/annual[-_ ]?report/i.test(label)) continue;
    if (/financial[-_ ]?statements?|addendum|special[-_ ]?purpose|SPFS/i.test(label)) continue;
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    const fiscalYear =
      fiscalYearFromKiamaAnnualReportLink(label) ??
      fiscalYearFromKiamaAnnualReportLink(anchor.href);
    if (!fiscalYear) continue;
    let url: URL;
    try {
      url = new URL(anchor.href, baseUrl);
    } catch {
      continue;
    }
    const urlHost = url.host.replace(/^www\./, '');
    if (urlHost !== baseHost && !urlHost.endsWith(`.${baseHost}`)) continue;
    const href = url.toString();
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({
      id: `annual-report-${fiscalYear}`,
      title: label || `Annual Report ${fiscalYear}`,
      url: href,
      fiscal_year: fiscalYear,
      listing_url: baseUrl,
    });
  }
  return links;
}

/** Select the latest annual report upload for the requested fiscal year. */
export function selectKiamaGpfsDocument(
  links: readonly KiamaGpfsDocument[],
  fiscalYear: string = KIAMA_GPFS_FISCAL_YEAR,
): KiamaGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Kiama Municipal Council annual report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** The documented official pin used when the live listing hides the link. */
export function kiamaPinnedDocument(): KiamaGpfsDocument {
  return {
    id: `annual-report-${KIAMA_GPFS_FISCAL_YEAR}`,
    title: 'Annual Report 2024-25',
    url: KIAMA_GPFS_DOCUMENT_PIN,
    fiscal_year: KIAMA_GPFS_FISCAL_YEAR,
    listing_url: KIAMA_GPFS_REPORTING_URL,
  };
}

/**
 * Discover the annual report attachment. The connector fetches the official
 * Annual Reports and Financial Statements page and parses its direct
 * "Annual Report 2024-25" PDF upload link; if the page is unavailable or yields
 * no usable FY2024-25 link, it uses the documented official pin. The exact bytes
 * are still SHA-256 re-verified.
 */
export async function discoverKiamaGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = KIAMA_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<KiamaGpfsDocument> {
  let html: string | null = listingHtml ?? null;
  if (html === null) {
    try {
      const response = await fetchImpl(KIAMA_GPFS_REPORTING_URL, {
        redirect: 'follow',
        headers: KIAMA_GPFS_REQUEST_HEADERS,
      });
      if (response.ok) html = await response.text();
    } catch {
      // Network failure falls through to the documented official pin.
    }
  }
  if (html) {
    const links = parseKiamaGpfsReportLinks(html, KIAMA_GPFS_REPORTING_URL);
    const match = links
      .filter((link) => link.fiscal_year === fiscalYear)
      .sort((a, b) => b.url.localeCompare(a.url))[0];
    if (match) return match;
  }
  if (fiscalYear !== KIAMA_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No published Kiama Municipal Council annual report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return kiamaPinnedDocument();
}

function normalized(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function findPage(pages: readonly PdfPage[], predicate: (text: string) => boolean): PdfPage | null {
  for (const page of pages) {
    if (predicate(normalized(page.text))) return page;
  }
  return null;
}

/**
 * Verify whether the annual report contains the audited GPFS section. The
 * FY2024-25 annual report is narrative-only: page 19 is an un-audited
 * "Consolidated operating results" summary and the report ends at the
 * "Authorisation and version control" page (page 91). No statement-line slice is
 * emitted.
 */
export function parseKiamaGpfsExtraction(
  extraction: PdfExtraction,
  _context: KiamaGpfsParseContext,
): KiamaGpfsParseResult {
  const incomePage = findPage(
    extraction.pages,
    (text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Operating result from continuing operations'),
  );
  const positionPage = findPage(
    extraction.pages,
    (text) =>
      text.includes('Statement of Financial Position') &&
      text.includes('Total assets') &&
      text.includes('Net assets'),
  );
  const cashPage = findPage(
    extraction.pages,
    (text) =>
      text.includes('Statement of Cash Flows') &&
      text.includes('Net cash flows from operating activities'),
  );
  if (incomePage && positionPage && cashPage) {
    const reason =
      'audited GPFS section is present, but this annual-report-only connector is configured to defer rather than emit a partially parsed slice; no rows ingested';
    return {
      records: [],
      reconciliation: null,
      warnings: [reason],
      rejections: [{ section: 'gpfs', reason }],
    };
  }
  const summaryPage = findPage(
    extraction.pages,
    (text) =>
      text.includes('Consolidated operating results') &&
      text.includes('Income from continuing operations') &&
      text.includes('Net operating result for the year attributable to Council'),
  );
  const authorisationPage = findPage(
    extraction.pages,
    (text) =>
      text.includes('Authorisation and version control') &&
      text.includes('Owner/Responsible Officer'),
  );
  const details = [
    summaryPage
      ? `page ${summaryPage.page_number} contains only the un-audited Consolidated operating results summary`
      : null,
    authorisationPage
      ? `the report ends at the Authorisation and version control page (page ${authorisationPage.page_number})`
      : null,
  ].filter((value): value is string => value !== null);
  const reason =
    'audited GPFS section not found in the FY2024-25 annual report; ' +
    (details.length > 0 ? `${details.join('; ')}; ` : 'the report is narrative-only; ') +
    'no Income Statement/Statement of Comprehensive Income/Statement of Financial Position/Statement of Cash Flows/B1-1 with printed subtotals was found; the official Reporting page publishes a separate FY2024-25 Financial Statements PDF, and this annual-report-only item does not substitute that standalone report; no rows ingested';
  return {
    records: [],
    reconciliation: null,
    warnings: [reason],
    rejections: [{ section: 'gpfs', reason }],
  };
}

/** Stable upsert identity for a hypothetical line; retained for API/test parity. */
export function kiamaGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = KIAMA_GPFS_FISCAL_YEAR,
): string {
  return `${KIAMA_GPFS_ID}:${documentUrl}:${lineItem}:${fiscalYear}`;
}

export interface KiamaGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  document?: KiamaGpfsDocument;
  pdfBytes?: Uint8Array;
  listingHtml?: string;
}

function documentFilename(url: string): string {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(parsed.pathname.split('/').pop() ?? '');
    if (/\.pdf(?:\.aspx)?$/i.test(name)) {
      return name.replace(/\.aspx$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-');
    }
  } catch {
    // Fall through to a stable name.
  }
  return 'kiama-annual-report-2024-25.pdf';
}

/** Build the live Kiama Municipal Council annual-report connector. */
export function createKiamaGpfsConnector(options: KiamaGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  return {
    id: KIAMA_GPFS_ID,
    name: KIAMA_GPFS_NAME,
    publisher: KIAMA_GPFS_PUBLISHER,
    source_url: KIAMA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: KIAMA_GPFS_LICENSE,
    notes:
      'NSW council annual-report adapter: one council only (Kiama Municipal Council), FY2024-25. The official annual report is annual-report-only for this item: it is a narrative report with an un-audited Consolidated operating results summary and ends at the Authorisation and version control page; it does not contain the audited GPFS Income Statement/Statement of Comprehensive Income/Statement of Financial Position/Statement of Cash Flows/B1-1 section. The same official page publishes a separate current-year FY2024-25 Financial Statements PDF, which is recorded but not substituted by this annual-report-only item. The connector therefore defers with 0 rows and records the exact gap; it does not fabricate a council total. No other council or state/federal source is touched.',
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverKiamaGpfsDocument(fetchImpl, KIAMA_GPFS_FISCAL_YEAR, options.listingHtml));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: KIAMA_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Kiama Municipal Council annual report fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: KiamaGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: KIAMA_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Kiama Municipal Council FY2024-25 annual report; archived to verify the annual-report-only GPFS gap.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: KiamaGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: KIAMA_GPFS_REPORTING_URL,
      };
      const parsed = parseKiamaGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'kiama-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'kiama-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Kiama Municipal Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
