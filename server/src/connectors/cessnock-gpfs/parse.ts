import type { SpendingRecord } from '@ausspend/shared';
import { extractArchivedPdf, type PdfExtraction, type PdfPage } from '../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import type { Connector, RawRecord } from '../types.js';

/**
 * NSW council annual-report GPFS adapter: Cessnock City Council's FY2024-25
 * annual report. The official annual report was checked and does **not** contain
 * the audited General Purpose Financial Statements section: it is a
 * narrative-only report (with a narrative "Financial summary" on page 13) that
 * ends at the Attestation Statement on page 101. The official Annual Report page
 * itself says the Annual Financial Statements for the Year Ended 30 June 2025
 * "can be viewed here", linking to a separate FY2024-25 Annual Financial
 * Statements document. The brief limits this item to the annual report and
 * forbids substituting the standalone report, so this connector defers with 0
 * rows and records the exact gap.
 */
export const CESSNOCK_GPFS_ID = 'cessnock-gpfs';
export const CESSNOCK_GPFS_NAME =
  'Cessnock City Council — Annual Report Financial Statements';
export const CESSNOCK_GPFS_PUBLISHER = 'Cessnock City Council';
export const CESSNOCK_GPFS_REPORTING_URL =
  'https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Community-information/Annual-Report';
/** Documented official pin for the latest annual report (FY2024-25). */
export const CESSNOCK_GPFS_DOCUMENT_PIN =
  'https://www.cessnock.nsw.gov.au/files/assets/public/v/1/hptrim/website-integrated-planning-reporting-documents-do-not-change/2025_annual-report-cessnock-city-council_2024-2025_spread.pdf';
/**
 * The separate FY2024-25 Annual Financial Statements page linked from the
 * Annual Report page. This is recorded for the evidence trail only; the
 * annual-report-only item does not ingest it and does not substitute it.
 */
export const CESSNOCK_GPFS_AFS_PAGE_URL =
  'https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Finance-and-budget/Annual-Financial-Statements';
export const CESSNOCK_GPFS_FISCAL_YEAR = '2024-25';
export const CESSNOCK_GPFS_SOURCE_DATASET = 'Cessnock City Council Annual Report 2024-25';
export const CESSNOCK_GPFS_LICENSE =
  '© Cessnock City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const CESSNOCK_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const CESSNOCK_GPFS_DELIVERY_ENTITY = 'Cessnock City Council';
export const CESSNOCK_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export interface CessnockGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  listing_url?: string;
  resolved_url?: string;
}

export interface CessnockGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface CessnockGpfsParseContext {
  document: CessnockGpfsDocument;
  archive: CessnockGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface CessnockGpfsRejection {
  section: string;
  reason: string;
}

export interface CessnockGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: null;
  warnings: string[];
  rejections: CessnockGpfsRejection[];
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

/** Convert an annual-report label or URL to a fiscal year (2024-2025 → 2024-25). */
export function fiscalYearFromCessnockAnnualReportLink(text: string): string | null {
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
    endRaw.length === 2
      ? Math.floor(startYear / 100) * 100 + Number(endRaw)
      : Number(endRaw);
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
 * Parse the official Annual Report page. Cessnock serves the annual report as a
 * direct `.pdf` upload whose visible label ("Annual Report 2024-2025") and file
 * name carry the year pair. The separate Annual Financial Statements pointer is
 * an HTML page (not a PDF) and is therefore never selected as the annual report.
 */
export function parseCessnockGpfsReportLinks(
  html: string,
  baseUrl: string,
): CessnockGpfsDocument[] {
  const links: CessnockGpfsDocument[] = [];
  const seen = new Set<string>();
  const baseHost = new URL(baseUrl).host.replace(/^www\./, '');
  for (const anchor of anchors(html)) {
    const label = `${anchor.title} ${anchor.text}`.trim();
    if (!/annual[-_ ]?report/i.test(label)) continue;
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    if (/special[-_ ]?purpose|SPFS|special[-_ ]?schedules?|financial[-_ ]?statements?/i.test(label))
      continue;
    const fiscalYear =
      fiscalYearFromCessnockAnnualReportLink(label) ??
      fiscalYearFromCessnockAnnualReportLink(anchor.href);
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
export function selectCessnockGpfsDocument(
  links: readonly CessnockGpfsDocument[],
  fiscalYear: string = CESSNOCK_GPFS_FISCAL_YEAR,
): CessnockGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Cessnock City Council annual report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** The documented official pin used when the live listing hides the link. */
export function cessnockPinnedDocument(): CessnockGpfsDocument {
  return {
    id: `annual-report-${CESSNOCK_GPFS_FISCAL_YEAR}`,
    title: 'Annual Report 2024-2025',
    url: CESSNOCK_GPFS_DOCUMENT_PIN,
    fiscal_year: CESSNOCK_GPFS_FISCAL_YEAR,
    listing_url: CESSNOCK_GPFS_REPORTING_URL,
  };
}

/**
 * Discover the annual report attachment. The connector fetches the official
 * Annual Report page and parses its direct "Annual Report 2024-2025" PDF upload
 * link; if the page is unavailable or yields no usable FY2024-25 link, it uses
 * the documented official pin. The exact bytes are still SHA-256 re-verified.
 */
export async function discoverCessnockGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = CESSNOCK_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<CessnockGpfsDocument> {
  let html: string | null = listingHtml ?? null;
  if (html === null) {
    try {
      const response = await fetchImpl(CESSNOCK_GPFS_REPORTING_URL, {
        redirect: 'follow',
        headers: CESSNOCK_GPFS_REQUEST_HEADERS,
      });
      if (response.ok) html = await response.text();
    } catch {
      // Network failure falls through to the documented official pin.
    }
  }
  if (html) {
    const links = parseCessnockGpfsReportLinks(html, CESSNOCK_GPFS_REPORTING_URL);
    const match = links
      .filter((link) => link.fiscal_year === fiscalYear)
      .sort((a, b) => b.url.localeCompare(a.url))[0];
    if (match) return match;
  }
  if (fiscalYear !== CESSNOCK_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No published Cessnock City Council annual report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return cessnockPinnedDocument();
}

function normalized(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function findPage(
  pages: readonly PdfPage[],
  predicate: (text: string) => boolean,
): PdfPage | null {
  for (const page of pages) {
    if (predicate(normalized(page.text))) return page;
  }
  return null;
}

/**
 * Verify whether the annual report contains the audited GPFS section. The
 * FY2024-25 annual report is narrative-only and contains a narrative
 * "Financial summary" on page 13; it ends at the Attestation Statement on page
 * 101 and has no Income Statement, Statement of Comprehensive Income,
 * Statement of Financial Position or B1-1 primary statement with printed
 * subtotals. No statement-line slice is emitted.
 */
export function parseCessnockGpfsExtraction(
  extraction: PdfExtraction,
  _context: CessnockGpfsParseContext,
): CessnockGpfsParseResult {
  const incomePage = findPage(
    extraction.pages,
    (text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Operating result from continuing operations'),
  );
  const comprehensivePage = findPage(
    extraction.pages,
    (text) =>
      text.includes('Statement of Comprehensive Income') && text.includes('from Income Statement'),
  );
  const functionsPage = findPage(
    extraction.pages,
    (text) =>
      text.includes('Total functions and activities') &&
      text.includes('Functions or activities'),
  );
  if (incomePage && comprehensivePage && functionsPage) {
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
    (text) => text.includes('Financial summary') && text.includes('What were our sources of income'),
  );
  const attestationPage = findPage(extraction.pages, (text) =>
    text.includes('ATTESTATION STATEMENT'),
  );
  const details = [
    summaryPage
      ? `page ${summaryPage.page_number} contains only the narrative Financial summary`
      : null,
    attestationPage
      ? `the report ends at the Attestation Statement on page ${attestationPage.page_number}`
      : null,
  ].filter((value): value is string => value !== null);
  const reason =
    'audited GPFS section not found in the FY2024-25 annual report; ' +
    (details.length > 0 ? `${details.join('; ')}; ` : 'the report is narrative-only; ') +
    'no Income Statement/Statement of Comprehensive Income/Statement of Financial Position/B1-1 with printed subtotals was found; the official Annual Report page states the Annual Financial Statements for the Year Ended 30 June 2025 can be viewed separately, and this annual-report-only item does not substitute that standalone report; no rows ingested';
  return {
    records: [],
    reconciliation: null,
    warnings: [reason],
    rejections: [{ section: 'gpfs', reason }],
  };
}

/** Stable upsert identity for a hypothetical line; retained for API/test parity. */
export function cessnockGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = CESSNOCK_GPFS_FISCAL_YEAR,
): string {
  return `${CESSNOCK_GPFS_ID}:${documentUrl}:${lineItem}:${fiscalYear}`;
}

export interface CessnockGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  document?: CessnockGpfsDocument;
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
  return 'cessnock-annual-report-2024-25.pdf';
}

/** Build the live Cessnock City Council annual-report connector. */
export function createCessnockGpfsConnector(
  options: CessnockGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  return {
    id: CESSNOCK_GPFS_ID,
    name: CESSNOCK_GPFS_NAME,
    publisher: CESSNOCK_GPFS_PUBLISHER,
    source_url: CESSNOCK_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CESSNOCK_GPFS_LICENSE,
    notes:
      'NSW council annual-report adapter: one council only (Cessnock City Council), FY2024-25. The official annual report is annual-report-only for this item: it is a narrative report with a narrative Financial summary and ends at the Attestation Statement; it does not contain the audited GPFS Income Statement/Statement of Comprehensive Income/Statement of Financial Position/B1-1 section. The official Annual Report page states the Annual Financial Statements for the Year Ended 30 June 2025 can be viewed separately. The connector therefore defers with 0 rows and records the exact gap; it does not substitute the standalone report or fabricate a council total. No other council or state/federal source is touched.',
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverCessnockGpfsDocument(
          fetchImpl,
          CESSNOCK_GPFS_FISCAL_YEAR,
          options.listingHtml,
        ));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: CESSNOCK_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Cessnock City Council annual report fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: CessnockGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: CESSNOCK_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Cessnock City Council FY2024-25 annual report; archived to verify the annual-report-only GPFS gap.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: CessnockGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: CESSNOCK_GPFS_REPORTING_URL,
      };
      const parsed = parseCessnockGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'cessnock-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'cessnock-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Cessnock City Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
