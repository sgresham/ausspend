import type { SpendingRecord } from '@ausspend/shared';
import { extractArchivedPdf, type PdfExtraction, type PdfPage } from '../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import type { Connector, RawRecord } from '../types.js';

/**
 * NSW council annual-report GPFS adapter: Lismore City Council's FY2024-25
 * annual report. The official annual report was checked and does **not** contain
 * the audited General Purpose Financial Statements section: it is a 74-page
 * narrative and statutory-information report whose contents end at Statutory
 * Information, with no Income Statement, Statement of Comprehensive Income,
 * Statement of Financial Position, Statement of Cash Flows or B1-1 "Functions or
 * activities" section. Page 5 says the annual report "must also contain ...
 * Financial Statements", but the published PDF does not embed them.
 *
 * The same official Annual and Financial Reports page publishes a separate
 * current-year **Financial reports 2024/25** PDF (3,269,117 bytes, 104 pages)
 * containing the audited GPFS (Income Statement p5, Statement of Comprehensive
 * Income p6, Statement of Financial Position p7, Statement of Cash Flows p9,
 * B1-1 functions p15, "End of the audited financial statements" p73). The brief
 * limits this item to the annual report and forbids substituting a standalone
 * report, so this connector defers with 0 rows and records the exact gap. The
 * separate current-year FS is recorded for a future cure item; it is not an older
 * prior-year substitute and is not ingested here.
 */
export const LISMORE_GPFS_ID = 'lismore-gpfs';
export const LISMORE_GPFS_NAME = 'Lismore City Council — Annual Report Financial Statements';
export const LISMORE_GPFS_PUBLISHER = 'Lismore City Council';
export const LISMORE_GPFS_REPORTING_URL =
  'https://www.lismore.nsw.gov.au/Council/Corporate-information/Annual-and-financial-reports';
/** Documented official pin for the latest annual report (FY2024-25). */
export const LISMORE_GPFS_DOCUMENT_PIN =
  'https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/6.-corporate-information/lcc-annual-report-2024-25-a4.pdf';
/**
 * The separate current-year FY2024-25 Financial reports PDF published on the
 * same official page. Recorded for the evidence trail only; the
 * annual-report-only item does not ingest it and does not substitute it.
 */
export const LISMORE_GPFS_STANDALONE_FS_URL =
  'https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/annual_financial_statements-2025-signed-27-nov-25.pdf';
export const LISMORE_GPFS_STANDALONE_FS_BYTES = 3269117;
export const LISMORE_GPFS_STANDALONE_FS_SHA256 =
  'e4816b7149d268099bbb931fcf0a3b34b03ab0e4b28663aba18039cdf0da9797';
export const LISMORE_GPFS_STANDALONE_FS_PAGES = 104;
export const LISMORE_GPFS_FISCAL_YEAR = '2024-25';
export const LISMORE_GPFS_SOURCE_DATASET = 'Lismore City Council Annual Report 2024-25';
export const LISMORE_GPFS_LICENSE =
  '© Lismore City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const LISMORE_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const LISMORE_GPFS_DELIVERY_ENTITY = 'Lismore City Council';
export const LISMORE_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export interface LismoreGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  listing_url?: string;
  resolved_url?: string;
}

export interface LismoreGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface LismoreGpfsParseContext {
  document: LismoreGpfsDocument;
  archive: LismoreGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface LismoreGpfsRejection {
  section: string;
  reason: string;
}

export interface LismoreGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: null;
  warnings: string[];
  rejections: LismoreGpfsRejection[];
}

/**
 * Exact gap: the FY2024-25 annual report is narrative/statutory-information only
 * and does not embed the audited GPFS.
 */
export const LISMORE_ANNUAL_REPORT_GAP =
  'audited GPFS section not found in the FY2024-25 annual report; page 3 is the contents, whose last listed section is Statutory Information and which has no financial-statements section; page 5 says the annual report must contain financial statements, but the 74-page PDF contains no Income Statement/Statement of Comprehensive Income/Statement of Financial Position/Statement of Cash Flows/B1-1 with printed subtotals; the official reporting page publishes a separate FY2024-25 Financial reports PDF, and this annual-report-only item does not substitute that standalone report; no rows ingested';

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

/** Convert an annual-report or financial-reports label/URL to a fiscal year. */
export function fiscalYearFromLismoreAnnualReportLink(text: string): string | null {
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

function absoluteLink(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    const baseHost = new URL(baseUrl).host.replace(/^www\./, '');
    const urlHost = url.host.replace(/^www\./, '');
    if (urlHost !== baseHost && !urlHost.endsWith(`.${baseHost}`)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Parse the official page for annual reports. Lismore labels them
 * "Annual Report 2024/25" (and older "Annual Report 2023/24"). The separate
 * Financial reports, the signed attestation appendix, the State of our City
 * report and the Long Term Financial Plan are ignored.
 */
export function parseLismoreGpfsReportLinks(html: string, baseUrl: string): LismoreGpfsDocument[] {
  const links: LismoreGpfsDocument[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors(html)) {
    const label = `${anchor.title} ${anchor.text}`.trim();
    if (!/annual[-_ ]?report/i.test(label)) continue;
    if (
      /financial[-_ ]?(?:reports?|statements?)|appendix|state of our city|long term financial plan|special[-_ ]?purpose|SPFS/i.test(
        label,
      )
    ) {
      continue;
    }
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    const fiscalYear =
      fiscalYearFromLismoreAnnualReportLink(label) ??
      fiscalYearFromLismoreAnnualReportLink(anchor.href);
    if (!fiscalYear) continue;
    const href = absoluteLink(anchor.href, baseUrl);
    if (!href || seen.has(href)) continue;
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
export function selectLismoreGpfsDocument(
  links: readonly LismoreGpfsDocument[],
  fiscalYear: string = LISMORE_GPFS_FISCAL_YEAR,
): LismoreGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Lismore City Council annual report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** The documented official pin used when the live listing hides the link. */
export function lismorePinnedDocument(): LismoreGpfsDocument {
  return {
    id: `annual-report-${LISMORE_GPFS_FISCAL_YEAR}`,
    title: 'Annual Report 2024/25',
    url: LISMORE_GPFS_DOCUMENT_PIN,
    fiscal_year: LISMORE_GPFS_FISCAL_YEAR,
    listing_url: LISMORE_GPFS_REPORTING_URL,
  };
}

/**
 * Discover the annual report attachment. The connector fetches the official
 * Annual and Financial Reports page and parses its direct "Annual Report
 * 2024/25" PDF upload link; if the page is unavailable or yields no usable
 * FY2024-25 link, it uses the documented official pin. The exact bytes are still
 * SHA-256 re-verified.
 */
export async function discoverLismoreGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = LISMORE_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<LismoreGpfsDocument> {
  let html: string | null = listingHtml ?? null;
  if (html === null) {
    try {
      const response = await fetchImpl(LISMORE_GPFS_REPORTING_URL, {
        redirect: 'follow',
        headers: LISMORE_GPFS_REQUEST_HEADERS,
      });
      if (response.ok) html = await response.text();
    } catch {
      // Network failure falls through to the documented official pin.
    }
  }
  if (html) {
    const links = parseLismoreGpfsReportLinks(html, LISMORE_GPFS_REPORTING_URL);
    const match = links
      .filter((link) => link.fiscal_year === fiscalYear)
      .sort((a, b) => b.url.localeCompare(a.url))[0];
    if (match) return match;
  }
  if (fiscalYear !== LISMORE_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No published Lismore City Council annual report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return lismorePinnedDocument();
}

/**
 * Parse the separate current-year Financial reports links recorded for the
 * future cure. This is not part of the annual-report connector's fetch path.
 */
export function parseLismoreGpfsFinancialReportsLinks(
  html: string,
  baseUrl: string,
): LismoreGpfsDocument[] {
  const links: LismoreGpfsDocument[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors(html)) {
    const label = `${anchor.title} ${anchor.text}`.trim();
    if (!/financial[-_ ]?(?:reports?|statements?)/i.test(label)) continue;
    if (/annual[-_ ]?report|appendix|special[-_ ]?purpose|SPFS/i.test(label)) continue;
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    const fiscalYear =
      fiscalYearFromLismoreAnnualReportLink(label) ??
      fiscalYearFromLismoreAnnualReportLink(anchor.href);
    if (!fiscalYear) continue;
    const href = absoluteLink(anchor.href, baseUrl);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    links.push({
      id: `financial-reports-${fiscalYear}`,
      title: label || `Financial reports ${fiscalYear}`,
      url: href,
      fiscal_year: fiscalYear,
      listing_url: baseUrl,
    });
  }
  return links;
}

export function selectLismoreGpfsStandaloneFsDocument(
  links: readonly LismoreGpfsDocument[],
  fiscalYear: string = LISMORE_GPFS_FISCAL_YEAR,
): LismoreGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Lismore City Council Financial reports link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
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
 * FY2024-25 annual report is a narrative/statutory-information report whose
 * contents end at Statutory Information and which has no GPFS primary
 * statements, so no statement-line slice is emitted.
 */
export function parseLismoreGpfsExtraction(
  extraction: PdfExtraction,
  _context: LismoreGpfsParseContext,
): LismoreGpfsParseResult {
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
  const contentsPage = findPage(
    extraction.pages,
    (text) => text.includes('Contents') && text.includes('Statutory Information'),
  );
  const claimPage = findPage(
    extraction.pages,
    (text) => text.includes('must also contain') && text.includes('Financial Statements'),
  );
  const details = [
    contentsPage
      ? `page ${contentsPage.page_number} is the contents, whose last listed section is Statutory Information and which has no financial-statements section`
      : null,
    claimPage
      ? `page ${claimPage.page_number} says the annual report must contain financial statements, but the 74-page PDF contains no Income Statement/Statement of Comprehensive Income/Statement of Financial Position/Statement of Cash Flows/B1-1 with printed subtotals`
      : null,
  ].filter((value): value is string => value !== null);
  const reason =
    details.length > 0
      ? `audited GPFS section not found in the FY2024-25 annual report; ${details.join('; ')}; the official reporting page publishes a separate FY2024-25 Financial reports PDF, and this annual-report-only item does not substitute that standalone report; no rows ingested`
      : LISMORE_ANNUAL_REPORT_GAP;
  return {
    records: [],
    reconciliation: null,
    warnings: [reason],
    rejections: [{ section: 'gpfs', reason }],
  };
}

/** Stable upsert identity for a hypothetical line; retained for API/test parity. */
export function lismoreGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = LISMORE_GPFS_FISCAL_YEAR,
): string {
  return `${LISMORE_GPFS_ID}:${documentUrl}:${lineItem}:${fiscalYear}`;
}

export interface LismoreGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  document?: LismoreGpfsDocument;
  pdfBytes?: Uint8Array;
  listingHtml?: string;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf(?:\.aspx)?$/i.test(name)) {
      return name.replace(/\.aspx$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-');
    }
  } catch {
    // Fall through to the stable name.
  }
  return 'lcc-annual-report-2024-25-a4.pdf';
}

/** Build the live Lismore City Council annual-report connector. */
export function createLismoreGpfsConnector(options: LismoreGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  return {
    id: LISMORE_GPFS_ID,
    name: LISMORE_GPFS_NAME,
    publisher: LISMORE_GPFS_PUBLISHER,
    source_url: LISMORE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LISMORE_GPFS_LICENSE,
    notes:
      'NSW council annual-report adapter: one council only (Lismore City Council), FY2024-25. The official annual report is annual-report-only for this item: it is a 74-page narrative and statutory-information report whose contents end at Statutory Information and which has no GPFS primary statements; page 5 says the report must contain financial statements, but they are published separately. The same official page publishes a separate current-year FY2024-25 Financial reports PDF, which is recorded but not substituted by this annual-report-only item. The connector therefore defers with 0 rows and records the exact gap; it does not fabricate a council total. No other council or state/federal source is touched.',
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverLismoreGpfsDocument(
          fetchImpl,
          LISMORE_GPFS_FISCAL_YEAR,
          options.listingHtml,
        ));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: LISMORE_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Lismore City Council annual report fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: LismoreGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: LISMORE_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Lismore City Council FY2024-25 annual report; archived to verify the annual-report-only GPFS gap.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: LismoreGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: LISMORE_GPFS_REPORTING_URL,
      };
      const parsed = parseLismoreGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'lismore-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'lismore-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Lismore City Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
