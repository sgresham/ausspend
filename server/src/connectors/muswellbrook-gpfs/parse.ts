import type { SpendingRecord } from '@ausspend/shared';
import { extractArchivedPdf, type PdfExtraction, type PdfPage } from '../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import type { Connector, RawRecord } from '../types.js';

/**
 * NSW council annual-report GPFS adapter: Muswellbrook Shire Council's
 * FY2024-25 annual report.
 *
 * The 196-page annual report **does** embed the audited General Purpose
 * Financial Statements section: its contents (page 3) list "Annual Financial
 * Statements 78", "General Purpose Financial Statements 79", "Special Purpose
 * Financial Statements 172" and "Special Schedules 185". However, the GPFS
 * section (pages 79-171) has **no text layer**: every page contains only the
 * running header/footer (two text items, 26-30 characters), while the statement
 * content is drawn as vector paths (no `showText` operators; 1,302-1,546
 * `constructPath` operators per page). The printed lines, subtotals and currency
 * unit are therefore not machine-readable and cannot be reconciled without OCR.
 * The narrative "Financial Reporting" summary on pages 74-77 is in $millions and
 * is not the audited GPFS. No standalone FY2024-25 GPFS PDF was found on the
 * official reporting page.
 *
 * The brief allows a scanned/unreadable section to be deferred with the exact
 * gap, so this connector emits 0 rows and records the exact gap; it does not
 * fabricate printed values from the narrative summary or OCR the image.
 */
export const MUSWELLBROOK_GPFS_ID = 'muswellbrook-gpfs';
export const MUSWELLBROOK_GPFS_NAME =
  'Muswellbrook Shire Council — Annual Report Financial Statements';
export const MUSWELLBROOK_GPFS_PUBLISHER = 'Muswellbrook Shire Council';
export const MUSWELLBROOK_GPFS_REPORTING_URL =
  'https://www.muswellbrook.nsw.gov.au/strategic-reporting/';
/** Documented official pin for the latest annual report (FY2024-25). */
export const MUSWELLBROOK_GPFS_DOCUMENT_PIN =
  'https://www.muswellbrook.nsw.gov.au/wp-content/uploads/2025/12/2024-2025-Annual-Report-FINAL-Ready-for-Endorsement-1.pdf';
export const MUSWELLBROOK_GPFS_FISCAL_YEAR = '2024-25';
export const MUSWELLBROOK_GPFS_SOURCE_DATASET = 'Muswellbrook Shire Council Annual Report 2024-25';
export const MUSWELLBROOK_GPFS_LICENSE =
  '© Muswellbrook Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const MUSWELLBROOK_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const MUSWELLBROOK_GPFS_DELIVERY_ENTITY = 'Muswellbrook Shire Council';
export const MUSWELLBROOK_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export interface MuswellbrookGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  listing_url?: string;
  resolved_url?: string;
}

export interface MuswellbrookGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface MuswellbrookGpfsParseContext {
  document: MuswellbrookGpfsDocument;
  archive: MuswellbrookGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface MuswellbrookGpfsRejection {
  section: string;
  reason: string;
}

export interface MuswellbrookGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: null;
  warnings: string[];
  rejections: MuswellbrookGpfsRejection[];
}

/**
 * Exact gap: the audited GPFS section is embedded in the annual report but is
 * vector-drawn with no text layer, so it is not machine-readable.
 */
export const MUSWELLBROOK_GPFS_GAP =
  'audited GPFS section is present in the FY2024-25 annual report but is not machine-readable; page 3 lists General Purpose Financial Statements at page 79, but the GPFS section (pages 79-171) has no text layer — every page contains only the running header/footer and the statement content is vector-drawn, so no printed line, subtotal or currency unit can be read or reconciled without OCR; the narrative financial summary on page 74 is in $m and is not the audited GPFS; no standalone FY2024-25 GPFS PDF was found on the official reporting page; no rows ingested';

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
export function fiscalYearFromMuswellbrookAnnualReportLink(text: string): string | null {
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
 * The Muswellbrook page renders each download as a `download__name` line
 * ("2024-2025 Annual Report") followed by a generic "PDF (34 MB)" anchor. Map
 * each PDF href to its document name so discovery can identify the report.
 */
function downloadNames(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const block = /<li[^>]*class="[^"]*download\b[^"]*"[\s\S]*?<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = block.exec(html)) !== null) {
    const blockHtml = match[0];
    const nameMatch = /class="download__name"[^>]*>([\s\S]*?)<\/p>/i.exec(blockHtml);
    const hrefMatch = /href="([^"]*\.pdf)"/i.exec(blockHtml);
    if (nameMatch && hrefMatch) {
      out.set(decodeHtml(hrefMatch[1]!), decodeHtml(nameMatch[1]!));
    }
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
 * Parse the official Strategic Reporting page for annual reports. The current
 * report is a `download` block named "2024-2025 Annual Report" whose anchor text
 * is just "PDF (34 MB)"; older reports use their own anchor text. The State of
 * the Shire report, the End of Term report and other non-annual-report PDFs are
 * ignored.
 */
export function parseMuswellbrookReportLinks(
  html: string,
  baseUrl: string,
): MuswellbrookGpfsDocument[] {
  const links: MuswellbrookGpfsDocument[] = [];
  const seen = new Set<string>();
  const names = downloadNames(html);
  for (const anchor of anchors(html)) {
    const absolute = absoluteLink(anchor.href, baseUrl);
    if (!absolute) continue;
    const label = names.get(anchor.href) ?? `${anchor.title} ${anchor.text}`.trim();
    if (!/annual[-_ ]?report/i.test(label)) continue;
    if (
      /state of the shire|end of term|financial[-_ ]?(?:reports?|statements?)|special[-_ ]?purpose/i.test(
        label,
      )
    ) {
      continue;
    }
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    const fiscalYear =
      fiscalYearFromMuswellbrookAnnualReportLink(label) ??
      fiscalYearFromMuswellbrookAnnualReportLink(anchor.href);
    if (!fiscalYear) continue;
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    links.push({
      id: `annual-report-${fiscalYear}`,
      title: label || `Annual Report ${fiscalYear}`,
      url: absolute,
      fiscal_year: fiscalYear,
      listing_url: baseUrl,
    });
  }
  return links;
}

/** Select the latest annual report upload for the requested fiscal year. */
export function selectMuswellbrookDocument(
  links: readonly MuswellbrookGpfsDocument[],
  fiscalYear: string = MUSWELLBROOK_GPFS_FISCAL_YEAR,
): MuswellbrookGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Muswellbrook Shire Council annual report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** The documented official pin used when the live listing hides the link. */
export function muswellbrookPinnedDocument(): MuswellbrookGpfsDocument {
  return {
    id: `annual-report-${MUSWELLBROOK_GPFS_FISCAL_YEAR}`,
    title: '2024-2025 Annual Report',
    url: MUSWELLBROOK_GPFS_DOCUMENT_PIN,
    fiscal_year: MUSWELLBROOK_GPFS_FISCAL_YEAR,
    listing_url: MUSWELLBROOK_GPFS_REPORTING_URL,
  };
}

/**
 * Discover the annual report attachment. The connector fetches the official
 * Strategic Reporting page and parses its "2024-2025 Annual Report" download;
 * if the page is unavailable or yields no usable FY2024-25 link, it uses the
 * documented official pin. The exact bytes are still SHA-256 re-verified.
 */
export async function discoverMuswellbrookDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = MUSWELLBROOK_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<MuswellbrookGpfsDocument> {
  let html: string | null = listingHtml ?? null;
  if (html === null) {
    try {
      const response = await fetchImpl(MUSWELLBROOK_GPFS_REPORTING_URL, {
        redirect: 'follow',
        headers: MUSWELLBROOK_GPFS_REQUEST_HEADERS,
      });
      if (response.ok) html = await response.text();
    } catch {
      // Network failure falls through to the documented official pin.
    }
  }
  if (html) {
    const links = parseMuswellbrookReportLinks(html, MUSWELLBROOK_GPFS_REPORTING_URL);
    const match = links
      .filter((link) => link.fiscal_year === fiscalYear)
      .sort((a, b) => b.url.localeCompare(a.url))[0];
    if (match) return match;
  }
  if (fiscalYear !== MUSWELLBROOK_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No published Muswellbrook Shire Council annual report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return muswellbrookPinnedDocument();
}

function normalized(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function findPage(
  pages: readonly PdfPage[],
  predicate: (page: PdfPage, text: string) => boolean,
): PdfPage | null {
  for (const page of pages) {
    if (predicate(page, normalized(page.text))) return page;
  }
  return null;
}

/**
 * Verify whether the annual report contains a readable GPFS section. The
 * FY2024-25 GPFS is embedded (contents: GPFS at page 79) but the section is
 * vector-drawn with no text layer, so no statement-line slice is emitted.
 */
export function parseMuswellbrookGpfsExtraction(
  extraction: PdfExtraction,
  _context: MuswellbrookGpfsParseContext,
): MuswellbrookGpfsParseResult {
  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Operating result from continuing operations'),
  );
  const positionPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Financial Position') &&
      text.includes('Total assets') &&
      text.includes('Net assets'),
  );
  const cashPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Cash Flows') &&
      text.includes('Net cash flows from operating activities'),
  );
  if (incomePage && positionPage && cashPage) {
    const reason =
      'audited GPFS section is present with a text layer, but this annual-report-only connector is configured to defer rather than emit a partially parsed slice; no rows ingested';
    return {
      records: [],
      reconciliation: null,
      warnings: [reason],
      rejections: [{ section: 'gpfs', reason }],
    };
  }
  const contentsPage = findPage(
    extraction.pages,
    (_page, text) =>
      /General Purpose F[Ii]nancial Statements/.test(text) &&
      /Special Purpose F[Ii]nancial Statements/.test(text),
  );
  const summaryPage = findPage(
    extraction.pages,
    (_page, text) => text.includes('Income $ (mil)') && text.includes('Total Income'),
  );
  let gpfsStart: number | null = null;
  let gpfsEnd: number | null = null;
  if (contentsPage) {
    const text = normalized(contentsPage.text);
    const startMatch = /General Purpose F[Ii]nancial Statements\s+(\d+)/.exec(text);
    const endMatch = /Special Purpose F[Ii]nancial Statements\s+(\d+)/.exec(text);
    if (startMatch && endMatch) {
      gpfsStart = Number(startMatch[1]);
      gpfsEnd = Number(endMatch[1]) - 1;
    }
  }
  const gpfsPages =
    gpfsStart !== null && gpfsEnd !== null
      ? extraction.pages.filter(
          (page) => page.page_number >= gpfsStart! && page.page_number <= gpfsEnd!,
        )
      : [];
  const hasTextLayer =
    gpfsPages.length > 0 && gpfsPages.some((page) => normalized(page.text).length > 60);
  if (contentsPage && gpfsStart !== null && gpfsEnd !== null && !hasTextLayer) {
    const reason = `audited GPFS section is present in the FY2024-25 annual report but is not machine-readable; page ${contentsPage.page_number} lists General Purpose Financial Statements at page ${gpfsStart}, but the GPFS section (pages ${gpfsStart}-${gpfsEnd}) has no text layer — every page contains only the running header/footer and the statement content is vector-drawn, so no printed line, subtotal or currency unit can be read or reconciled without OCR; the narrative financial summary${summaryPage ? ` on page ${summaryPage.page_number}` : ''} is in $m and is not the audited GPFS; no standalone FY2024-25 GPFS PDF was found on the official reporting page; no rows ingested`;
    return {
      records: [],
      reconciliation: null,
      warnings: [reason],
      rejections: [{ section: 'gpfs', reason }],
    };
  }
  return {
    records: [],
    reconciliation: null,
    warnings: [MUSWELLBROOK_GPFS_GAP],
    rejections: [{ section: 'gpfs', reason: MUSWELLBROOK_GPFS_GAP }],
  };
}

/** Stable upsert identity for a hypothetical line; retained for API/test parity. */
export function muswellbrookGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = MUSWELLBROOK_GPFS_FISCAL_YEAR,
): string {
  return `${MUSWELLBROOK_GPFS_ID}:${documentUrl}:${lineItem}:${fiscalYear}`;
}

export interface MuswellbrookGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  document?: MuswellbrookGpfsDocument;
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
  return '2024-2025-Annual-Report-FINAL-Ready-for-Endorsement-1.pdf';
}

/** Build the live Muswellbrook Shire Council annual-report connector. */
export function createMuswellbrookGpfsConnector(
  options: MuswellbrookGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  return {
    id: MUSWELLBROOK_GPFS_ID,
    name: MUSWELLBROOK_GPFS_NAME,
    publisher: MUSWELLBROOK_GPFS_PUBLISHER,
    source_url: MUSWELLBROOK_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: MUSWELLBROOK_GPFS_LICENSE,
    notes:
      'NSW council annual-report adapter: one council only (Muswellbrook Shire Council), FY2024-25. The 196-page annual report embeds the audited GPFS section (contents list General Purpose Financial Statements at page 79), but the GPFS section (pages 79-171) has no text layer: every page contains only the running header/footer and the statement content is vector-drawn, so the printed lines, subtotals and currency unit cannot be read or reconciled without OCR. The narrative Financial Reporting summary (pages 74-77) is in $millions and is not the audited GPFS. No standalone FY2024-25 GPFS PDF was found on the official reporting page. The connector therefore defers with 0 rows and records the exact gap; it does not fabricate values or OCR the image. No other council or state/federal source is touched.',
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverMuswellbrookDocument(
          fetchImpl,
          MUSWELLBROOK_GPFS_FISCAL_YEAR,
          options.listingHtml,
        ));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: MUSWELLBROOK_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Muswellbrook Shire Council annual report fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: MuswellbrookGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: MUSWELLBROOK_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Muswellbrook Shire Council FY2024-25 annual report; archived to verify the embedded GPFS gap.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: MuswellbrookGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: MUSWELLBROOK_GPFS_REPORTING_URL,
      };
      const parsed = parseMuswellbrookGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'muswellbrook-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'muswellbrook-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push(
            'raw entry is not a Muswellbrook Shire Council GPFS measure; skipped',
          );
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
