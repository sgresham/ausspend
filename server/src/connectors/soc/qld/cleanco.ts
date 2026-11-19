import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import { DeferredSocDocumentModel } from '../../../models/index.js';
import type { Connector, RawRecord } from '../../types.js';

/**
 * QLD SOC — CleanCo Queensland Limited annual-report adapter.
 *
 * CleanCo Queensland Limited is a Queensland Government Owned Corporation
 * (GOC) and one of the 11 GOC-list entities. This adapter is entity-level only:
 * no other QLD GOC, no statutory body, no WA/NSW entity and no GOC/state/
 * national total.
 *
 * Access outcome (checked 2026-11-19):
 * - The official publication-scheme page and publications page both publish the
 *   FY2025-26 annual report only as an embedded Flipsnack flipbook
 *   (`https://www.flipsnack.com/5CABFCFF8D6/cleanco-queensland-annual-report-2026`).
 *   That viewer is an official publication channel but it is a JavaScript
 *   widget shell; no direct PDF URL is exposed.
 * - The only direct annual-report PDF on the site is
 *   `Annual_Report_2025_Accessible_PDF.pdf` (3,959,915 bytes, last modified
 *   2025-09-29), which is the prior FY2024-25 report. It must never be ingested
 *   or presented as the current FY2025-26 report.
 * - The official WordPress media API has no FY2025-26 annual-report PDF: a
 *   media query for annual-report items returns the FY2024-25 PDF as the newest
 *   annual report, and a media query for 2026 returns no annual report.
 *
 * Because no official parseable FY2025-26 PDF exists, the adapter defers with
 * zero rows and records the exact access gap. It never substitutes the stale
 * prior-year PDF. If a future official direct FY2025-26 PDF appears, the
 * adapter still defers it for human verification rather than silently parsing an
 * unvalidated document.
 */

export const CLEANCO_ID = 'qld-cleanco';
export const CLEANCO_NAME = 'CleanCo Queensland Limited — Annual Report';
export const CLEANCO_PUBLISHER = 'CleanCo Queensland Limited';
export const CLEANCO_ENTITY = 'CleanCo Queensland Limited';
export const CLEANCO_JURISDICTION = 'QLD';
export const CLEANCO_LEGAL_CLASS =
  'Queensland Government Owned Corporation (GOC) — Corporations Act 2001 (Cth)';
/** Canonical official publication-scheme page. Annual-report artifacts are discovered from it. */
export const CLEANCO_SOURCE_URL = 'https://cleancoqueensland.com.au/publication-scheme/';
/** Secondary official publications page used as a documented discovery fallback. */
export const CLEANCO_PUBLICATIONS_URL = 'https://cleancoqueensland.com.au/publicationsandreports/';
export const CLEANCO_LICENSE =
  '© CleanCo Queensland Limited. Published annual-report material used here for public-interest research; not an open-data licence grant.';
export const CLEANCO_UNIT = 'AUD_thousands';
export const CLEANCO_UNIT_LABEL = "$'000";
export const CLEANCO_UNIT_TO_CENTS = 100_000;
export const CLEANCO_CAVEAT =
  "Entity-level SOC statement lines for CleanCo Queensland Limited only (a Queensland Government Owned Corporation, one of the 11 GOC-list entities). Never add to government program spending, the PNFC sector benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Port of Townsville Limited, Ports North, NQBP, another QLD GOC or statutory body, a WA/NSW entity, a QLD or national total, or to each other. The FY2025-26 annual report is published only as an embedded Flipsnack flipbook with no direct parseable official PDF; the only direct annual-report PDF on the official site is the prior FY2024-25 report. The adapter therefore defers FY2025-26 with no rows and never ingests the stale prior-year PDF as current. Provisional and unverified for any future human-verified report.";

/** A discovered official annual-report artifact (direct PDF or Flipsnack viewer). */
export interface CleancoAnnualReportArtifact {
  url: string;
  kind: 'pdf' | 'flipsnack';
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
} as const;

const ANNUAL_REPORT_MARKER = /annual[\s_\-–]*report/i;
const NON_ANNUAL_REPORT =
  /policy|constitution|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|corporate[\s_\-–]*plan|reconciliation[\s_\-–]*action[\s_\-–]*plan|reflect[\s_\-–]*rap|community[\s_\-–]*futures|board[\s_\-–]*charter|code[\s_\-–]*of[\s_\-–]*conduct|whistleblower|conflict[\s_\-–]*of[\s_\-–]*interest|fraud|insider[\s_\-–]*trading|right[\s_\-–]*to[\s_\-–]*information|public[\s_\-–]*interest/i;

function fiscalYearFromSpan(startRaw: string, endRaw: string): string | null {
  const start = Number(startRaw);
  if (!Number.isInteger(start) || start < 2000 || start > 2100) return null;
  const end = Number(endRaw);
  const expectedEnd = (start + 1) % 100;
  if (!Number.isInteger(end)) return null;
  const endMatches = endRaw.length === 2 ? end === expectedEnd : end === start + 1;
  if (!endMatches) return null;
  return `${start}-${String(expectedEnd).padStart(2, '0')}`;
}

function fiscalYearEnding(yearRaw: string): string | null {
  const end = Number(yearRaw);
  if (!Number.isInteger(end) || end < 2001 || end > 2100) return null;
  const start = end - 1;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

/**
 * Convert an official annual-report URL slug or filename into the API fiscal
 * year. `cleanco-queensland-annual-report-2026` and
 * `Annual_Report_2025_Accessible_PDF.pdf` become `2025-26` and `2024-25`
 * respectively. Policies, constitutions, the SCI, the RAP, board charters and
 * other non-annual publications are rejected by name.
 */
export function cleancoFiscalYearFromPublication(value: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(value) || NON_ANNUAL_REPORT.test(value)) return null;
  const span = /annual[\s_\-–]*report[\s_\-–]*(\d{4})[\s_\-–]*(\d{2,4})(?!\d)/i.exec(value);
  if (span) {
    const fromSpan = fiscalYearFromSpan(span[1] as string, span[2] as string);
    if (fromSpan) return fromSpan;
  }
  // A single year in an annual-report filename/slug means a report for the year
  // ending in that year (e.g. Annual_Report_2026 -> FY2025-26).
  const year = /(?:^|[^0-9])(20\d{2})(?!\d)/.exec(value)?.[1];
  return year ? fiscalYearEnding(year) : null;
}

function artifactKind(url: URL): 'pdf' | 'flipsnack' | null {
  const host = url.hostname.toLowerCase();
  if (host.endsWith('flipsnack.com')) return 'flipsnack';
  if (/\.pdf$/i.test(url.pathname)) return 'pdf';
  return null;
}

function candidateFromUrl(
  rawUrl: string,
  pageUrl: string,
): Pick<CleancoAnnualReportArtifact, 'url' | 'kind' | 'filename' | 'fiscal_year'> | null {
  const normalized = rawUrl.replace(/\\+\//g, '/').replace(/&amp;/g, '&').trim();
  let url: URL;
  try {
    url = new URL(normalized, pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const kind = artifactKind(url);
  if (!kind) return null;
  if (url.hostname.toLowerCase().includes('safelinks.protection.outlook.com')) return null;
  const slugSource = decodeURIComponent(url.pathname.split('/').pop() ?? '');
  const fiscalYear = cleancoFiscalYearFromPublication(slugSource);
  if (!fiscalYear) return null;
  const filename =
    kind === 'pdf'
      ? slugSource.replace(/[^A-Za-z0-9._-]+/g, '-')
      : `${CLEANCO_ID}-annual-report-${fiscalYear}.flipsnack.html`;
  return {
    url: url.toString(),
    kind,
    filename,
    fiscal_year: fiscalYear,
  };
}

/**
 * Parse official annual-report artifacts from the publication-scheme page HTML
 * (or the publications page / WordPress media JSON). Only direct PDFs and
 * Flipsnack viewers are retained; every other publication is rejected.
 */
export function parseCleancoPublicationLinks(
  text: string,
  pageUrl: string = CLEANCO_SOURCE_URL,
): CleancoAnnualReportArtifact[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | undefined): void => {
    if (!raw) return;
    const normalized = raw.replace(/\\+\//g, '/').replace(/&amp;/g, '&').trim();
    if (!/^(?:https?:\/\/|\/)/i.test(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  };

  for (const match of text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) push(match[1]);
  for (const match of text.matchAll(/"(?:url|link|permalink|source_url)"\s*:\s*"([^"]+)"/gi)) {
    push(match[1]);
  }

  const artifacts: CleancoAnnualReportArtifact[] = [];
  const seenArtifacts = new Set<string>();
  for (const raw of urls) {
    const candidate = candidateFromUrl(raw, pageUrl);
    if (!candidate) continue;
    if (seenArtifacts.has(candidate.url)) continue;
    seenArtifacts.add(candidate.url);
    const [start, end] = candidate.fiscal_year.split('-');
    artifacts.push({
      ...candidate,
      title: `CleanCo Queensland Annual Report ${start}–${end}`,
      discovery_page: pageUrl,
    });
  }
  return artifacts.sort((a, b) => {
    const byYear = b.fiscal_year.localeCompare(a.fiscal_year);
    if (byYear !== 0) return byYear;
    // For the same year, a direct PDF is preferable to a viewer.
    if (a.kind === b.kind) return a.url.localeCompare(b.url);
    return a.kind === 'pdf' ? -1 : 1;
  });
}

async function fetchText(
  fetchImpl: typeof fetch,
  url: string,
  attempts: string[],
): Promise<string | null> {
  try {
    const response = await fetchImpl(url, { redirect: 'follow', headers: BROWSER_HEADERS });
    if (!response.ok) {
      attempts.push(`${url} returned HTTP ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    attempts.push(
      `${url} could not be fetched: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Discover the newest official annual-report artifact. The publication-scheme
 * page is authoritative; the publications page and the official WordPress media
 * API are documented fallbacks. A site with no annual-report artifact is an
 * error, never a guessed PDF URL.
 */
export async function discoverCleancoAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<CleancoAnnualReportArtifact> {
  const attempts: string[] = [];
  const artifacts: CleancoAnnualReportArtifact[] = [];
  const seen = new Set<string>();
  const collect = (html: string, pageUrl: string): void => {
    for (const artifact of parseCleancoPublicationLinks(html, pageUrl)) {
      if (seen.has(artifact.url)) continue;
      seen.add(artifact.url);
      artifacts.push(artifact);
    }
  };

  const schemeHtml = await fetchText(fetchImpl, CLEANCO_SOURCE_URL, attempts);
  if (schemeHtml) {
    collect(schemeHtml, CLEANCO_SOURCE_URL);
    if (artifacts.length === 0) {
      attempts.push(
        `official publication-scheme page ${CLEANCO_SOURCE_URL} contained no annual-report artifact`,
      );
    }
  }

  if (artifacts.length === 0) {
    const publicationsHtml = await fetchText(fetchImpl, CLEANCO_PUBLICATIONS_URL, attempts);
    if (publicationsHtml) collect(publicationsHtml, CLEANCO_PUBLICATIONS_URL);
  }

  if (artifacts.length === 0) {
    const mediaUrl =
      'https://cleancoqueensland.com.au/wp-json/wp/v2/media?search=annual%20report&per_page=100';
    const mediaHtml = await fetchText(fetchImpl, mediaUrl, attempts);
    if (mediaHtml) collect(mediaHtml, mediaUrl);
  }

  artifacts.sort((a, b) => {
    const byYear = b.fiscal_year.localeCompare(a.fiscal_year);
    if (byYear !== 0) return byYear;
    if (a.kind === b.kind) return a.url.localeCompare(b.url);
    return a.kind === 'pdf' ? -1 : 1;
  });
  const latest = artifacts[0];
  if (latest) return latest;

  throw new Error(
    `CleanCo Queensland annual report could not be discovered; refusing to hard-code a PDF URL. ${attempts.join('; ')}`,
  );
}

/** Stable natural key for any future human-verified CleanCo row. */
export function cleancoNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${CLEANCO_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

export type CleancoDeferralPhase = 'access' | 'direct-pdf';

export interface CleancoDeferral {
  phase: CleancoDeferralPhase;
  reason: string;
}

/** The exact access gap recorded when the current report is Flipsnack-only. */
export const CLEANCO_ACCESS_GAP_REASON =
  'the official FY2025-26 annual report is published only as an embedded Flipsnack flipbook ' +
  '(https://www.flipsnack.com/5CABFCFF8D6/cleanco-queensland-annual-report-2026), which is a JavaScript ' +
  'viewer shell that exposes no direct PDF; the only direct annual-report PDF on the official site is ' +
  'Annual_Report_2025_Accessible_PDF.pdf (3,959,915 bytes, last modified 2025-09-29), which is the prior ' +
  'FY2024-25 report and is not ingested or presented as current';

/**
 * Decide the deferral for a discovered artifact. This is a pure function so the
 * access-gap policy is testable without a database: a Flipsnack viewer, a stale
 * prior-year PDF and an unvalidated current-year PDF all defer with zero rows.
 */
export function cleancoDeferralFor(document: CleancoAnnualReportArtifact): CleancoDeferral {
  if (document.kind === 'flipsnack') {
    return { phase: 'access', reason: CLEANCO_ACCESS_GAP_REASON };
  }
  if (document.fiscal_year !== '2025-26') {
    return {
      phase: 'access',
      reason: `the newest official annual-report PDF is ${document.fiscal_year}, not the current FY2025-26 report; refusing to ingest a stale prior year as current (${document.url})`,
    };
  }
  return {
    phase: 'direct-pdf',
    reason: `an official direct FY2025-26 PDF was discovered at ${document.url}; the adapter defers it for human verification and does not ingest an unvalidated document`,
  };
}

export interface CleancoConnectorOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest artifact. */
  document?: CleancoAnnualReportArtifact;
}

async function recordDeferral(
  document: CleancoAnnualReportArtifact,
  deferral: CleancoDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: CLEANCO_ID, document_url: document.url },
    {
      $set: {
        entity: CLEANCO_ENTITY,
        jurisdiction: CLEANCO_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the CleanCo Queensland SOC adapter; no row from this publication was ingested. ' +
          'The stale prior-year PDF was not substituted. A human must publish or verify a parseable ' +
          'official FY2025-26 PDF before any row is added.',
      },
    },
    { upsert: true },
  );
}

/** Build the live CleanCo Queensland connector. */
export function createCleancoConnector(options: CleancoConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: CLEANCO_ID,
    name: CLEANCO_NAME,
    publisher: CLEANCO_PUBLISHER,
    source_url: CLEANCO_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: CLEANCO_LICENSE,
    notes:
      'QLD SOC: CleanCo Queensland Limited only, a Queensland Government Owned Corporation (one of the 11 GOC-list entities). The official publication-scheme page and publications page publish the FY2025-26 annual report only as an embedded Flipsnack flipbook with no direct PDF URL; the only direct annual-report PDF on the site (Annual_Report_2025_Accessible_PDF.pdf, last modified 2025-09-29) is the prior FY2024-25 report. The adapter defers FY2025-26 with zero rows and records the exact access gap; the stale prior-year PDF is never ingested or presented as current. No other QLD GOC, statutory body, WA/NSW entity or GOC/state/national total is created.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document = options.document ?? (await discoverCleancoAnnualReport(fetchImpl));

      const deferral = cleancoDeferralFor(document);

      await recordDeferral(document, deferral);
      metadata.errors.push(
        `deferred ${document.fiscal_year}: ${deferral.phase}: ${deferral.reason}`,
      );
      return [];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      for (const entry of raw) {
        if (entry.kind !== 'qld-cleanco-measure') {
          metadata.errors.push('raw entry is not a CleanCo Queensland measure; skipped');
        }
      }
      return [];
    },
    metadata,
  };

  return connector;
}
