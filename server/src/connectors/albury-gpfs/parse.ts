import type { SpendingRecord } from '@ausspend/shared';
import { extractArchivedPdf, type PdfExtraction, type PdfPage } from '../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import type { Connector, RawRecord } from '../types.js';

/**
 * NSW council annual-report GPFS adapter: Albury City Council's FY2024-25
 * annual report. The official annual report was checked and does **not** contain
 * the audited General Purpose Financial Statements section: it carries a
 * narrative "Financial Snapshot" summary and states that the full audited
 * financial statements can be viewed on the council's website. The brief limits
 * this item to the annual report and forbids substituting an older standalone
 * report, so this connector defers with 0 rows and records the exact gap.
 */
export const ALBURY_GPFS_ID = 'albury-gpfs';
export const ALBURY_GPFS_NAME =
  'Albury City Council — Annual Report Financial Statements';
export const ALBURY_GPFS_PUBLISHER = 'Albury City Council';
export const ALBURY_GPFS_REPORTING_URL =
  'https://www.alburycity.nsw.gov.au/council/publications-and-updates/reports/annual-reports';
/** Documented official pin for the latest annual report (FY2024-25). */
export const ALBURY_GPFS_DOCUMENT_PIN =
  'https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=5168648';
export const ALBURY_GPFS_FISCAL_YEAR = '2024-25';
export const ALBURY_GPFS_SOURCE_DATASET = 'Albury City Council Annual Report 2024-25';
export const ALBURY_GPFS_LICENSE =
  '© Albury City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const ALBURY_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const ALBURY_GPFS_DELIVERY_ENTITY = 'Albury City Council';
export const ALBURY_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export interface AlburyGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  listing_url?: string;
  resolved_url?: string;
}

export interface AlburyGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface AlburyGpfsParseContext {
  document: AlburyGpfsDocument;
  archive: AlburyGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface AlburyGpfsRejection {
  section: string;
  reason: string;
}

export interface AlburyGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: null;
  warnings: string[];
  rejections: AlburyGpfsRejection[];
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
export function fiscalYearFromAlburyAnnualReportLink(text: string): string | null {
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
 * Parse the official annual-reports page. Albury's annual reports are served
 * through an eService RecordURI/DocumentViewer endpoint (no `.pdf` suffix), so
 * the link is recognized by its "Annual Report" label and the year pair.
 */
export function parseAlburyGpfsReportLinks(
  html: string,
  baseUrl: string,
): AlburyGpfsDocument[] {
  const links: AlburyGpfsDocument[] = [];
  const seen = new Set<string>();
  const baseHost = new URL(baseUrl).host.replace(/^www\./, '');
  for (const anchor of anchors(html)) {
    const label = `${anchor.title} ${anchor.text}`.trim();
    if (!/annual[-_ ]?report/i.test(label)) continue;
    if (!/ACCPublicDocs|\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    const fiscalYear = fiscalYearFromAlburyAnnualReportLink(label);
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

export function selectAlburyGpfsDocument(
  links: readonly AlburyGpfsDocument[],
  fiscalYear: string = ALBURY_GPFS_FISCAL_YEAR,
): AlburyGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Albury City Council annual report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

export function alburyPinnedDocument(): AlburyGpfsDocument {
  return {
    id: `annual-report-${ALBURY_GPFS_FISCAL_YEAR}`,
    title: 'Annual Report - 2024-2025',
    url: ALBURY_GPFS_DOCUMENT_PIN,
    fiscal_year: ALBURY_GPFS_FISCAL_YEAR,
    listing_url: ALBURY_GPFS_REPORTING_URL,
  };
}

export async function discoverAlburyGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = ALBURY_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<AlburyGpfsDocument> {
  let html: string | null = listingHtml ?? null;
  if (html === null) {
    try {
      const response = await fetchImpl(ALBURY_GPFS_REPORTING_URL, {
        redirect: 'follow',
        headers: ALBURY_GPFS_REQUEST_HEADERS,
      });
      if (response.ok) html = await response.text();
    } catch {
      // Network failure falls through to the documented official pin.
    }
  }
  if (html) {
    const links = parseAlburyGpfsReportLinks(html, ALBURY_GPFS_REPORTING_URL);
    const match = links
      .filter((link) => link.fiscal_year === fiscalYear)
      .sort((a, b) => b.url.localeCompare(a.url))[0];
    if (match) return match;
  }
  if (fiscalYear !== ALBURY_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No published Albury City Council annual report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return alburyPinnedDocument();
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
 * FY2024-25 annual report contains only a narrative Financial Snapshot and a
 * statement that the full audited financial statements can be viewed on the
 * website, so no GPFS statement-line slice is emitted.
 */
export function parseAlburyGpfsExtraction(
  extraction: PdfExtraction,
  _context: AlburyGpfsParseContext,
): AlburyGpfsParseResult {
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
      text.includes('Statement of Comprehensive Income') &&
      text.includes('from Income Statement'),
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
    return { records: [], reconciliation: null, warnings: [reason], rejections: [{ section: 'gpfs', reason }] };
  }
  const snapshotPage = findPage(
    extraction.pages,
    (text) => text.includes('Financial Snapshot 2024-2025') && text.includes('Operating Income'),
  );
  const pointerPage = findPage(
    extraction.pages,
    (text) =>
      text.includes('Audited Financial Statements for the Year Ended 30 June 2025') &&
      text.includes('can be viewed on our website'),
  );
  const details = [
    snapshotPage
      ? `page ${snapshotPage.page_number} contains only the narrative Financial Snapshot summary`
      : null,
    pointerPage
      ? `page ${pointerPage.page_number} says the full audited financial statements can be viewed on the website`
      : null,
  ].filter((value): value is string => value !== null);
  const reason =
    'audited GPFS section not found in the FY2024-25 annual report; ' +
    (details.length > 0
      ? `${details.join('; ')}; `
      : 'the report is narrative-only; ') +
    'no Income Statement/Statement of Comprehensive Income/B1-1 with printed subtotals was found; no standalone GPFS was substituted; no rows ingested';
  return {
    records: [],
    reconciliation: null,
    warnings: [reason],
    rejections: [{ section: 'gpfs', reason }],
  };
}

/** Stable upsert identity for a hypothetical line; retained for API/test parity. */
export function alburyGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = ALBURY_GPFS_FISCAL_YEAR,
): string {
  return `${ALBURY_GPFS_ID}:${documentUrl}:${lineItem}:${fiscalYear}`;
}

export interface AlburyGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  document?: AlburyGpfsDocument;
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
  return 'albury-annual-report-2024-25.pdf';
}

export function createAlburyGpfsConnector(
  options: AlburyGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  return {
    id: ALBURY_GPFS_ID,
    name: ALBURY_GPFS_NAME,
    publisher: ALBURY_GPFS_PUBLISHER,
    source_url: ALBURY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: ALBURY_GPFS_LICENSE,
    notes:
      'NSW council annual-report adapter: one council only (Albury City Council), FY2024-25. The official annual report is annual-report-only for this item: it contains a narrative Financial Snapshot and states that the full audited financial statements can be viewed on the council website; it does not contain the audited GPFS Income Statement/Statement of Comprehensive Income/B1-1 section. The connector therefore defers with 0 rows and records the exact gap; it does not substitute a standalone report or fabricate a council total. No other council or state/federal source is touched.',
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverAlburyGpfsDocument(
          fetchImpl,
          ALBURY_GPFS_FISCAL_YEAR,
          options.listingHtml,
        ));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: ALBURY_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Albury City Council annual report fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: AlburyGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: ALBURY_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Albury City Council FY2024-25 annual report; archived to verify the annual-report-only GPFS gap.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: AlburyGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: ALBURY_GPFS_REPORTING_URL,
      };
      const parsed = parseAlburyGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'albury-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'albury-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not an Albury City Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
