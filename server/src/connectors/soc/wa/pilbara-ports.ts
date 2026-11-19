import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import { DeferredSocDocumentModel } from '../../../models/index.js';
import type { Connector, RawRecord } from '../../types.js';

/**
 * WA SOC — Pilbara Ports Authority annual-report adapter.
 *
 * Pilbara Ports Authority is a Western Australian Government Trading
 * Enterprise (GTE) under the Government Trading Enterprises Act 2023 (WA) and
 * a port authority under the Port Authorities Act 1999 (WA). This adapter is
 * entity-level only: no WA total, no other WA GTE, no QLD/NSW SOC and no
 * national total.
 *
 * Access outcome (checked 2026-11-19):
 * - The official annual-report page and publications page answer HTTP 200 with
 *   only an Incapsula JavaScript challenge shell (212 bytes: a
 *   `noindex,nofollow` meta tag and a `_Incapsula_Resource` script). No report
 *   title and no PDF href are present in the plain-fetch response.
 * - The official `sitemap.xml` is reachable (HTTP 200, 76,175 bytes, 457 URL
 *   entries) but contains no PDF/`getmedia` document locations, only pages.
 * - The WA Parliament tabled-papers route answers an Azure WAF JavaScript
 *   challenge at the site root, and the legacy tabled-papers Notes database
 *   redirects to a WebCMS entry that returns "Entry not found in index"; a
 *   tabled copy could not be located or fetched by plain HTTP.
 * - The WA data portal CKAN API returns HTTP 500 for a Pilbara Ports search.
 *
 * Because no official current FY2025-26 PDF is obtainable, the adapter defers
 * with zero rows and records the exact access gap. It never substitutes an
 * unofficial/search-engine copy and never ingests a prior-year report as
 * current. If a future official direct FY2025-26 PDF appears, the adapter still
 * defers it for human verification rather than silently parsing an unvalidated
 * document.
 */

export const PILBARA_PORTS_ID = 'wa-pilbara-ports';
export const PILBARA_PORTS_NAME = 'Pilbara Ports Authority — Annual Report';
export const PILBARA_PORTS_PUBLISHER = 'Pilbara Ports Authority';
export const PILBARA_PORTS_ENTITY = 'Pilbara Ports Authority';
export const PILBARA_PORTS_JURISDICTION = 'WA';
export const PILBARA_PORTS_LEGAL_CLASS =
  'Western Australian Government Trading Enterprise (GTE) — Government Trading Enterprises Act 2023 (WA); port authority under the Port Authorities Act 1999 (WA)';
/** Canonical official annual-report page. */
export const PILBARA_PORTS_SOURCE_URL =
  'https://www.pilbaraports.com.au/about-pilbara-ports/publications/annual-report';
/** Secondary official publications page used as a documented discovery fallback. */
export const PILBARA_PORTS_PUBLICATIONS_URL =
  'https://www.pilbaraports.com.au/about-pilbara-ports/publications';
/** Official sitemap probed for document locations; it lists pages only. */
export const PILBARA_PORTS_SITEMAP_URL = 'https://www.pilbaraports.com.au/sitemap.xml';
export const PILBARA_PORTS_LICENSE =
  '© Pilbara Ports Authority. Published annual-report material used here for public-interest research; not an open-data licence grant.';
export const PILBARA_PORTS_UNIT = 'AUD_thousands';
export const PILBARA_PORTS_UNIT_LABEL = "$'000";
export const PILBARA_PORTS_UNIT_TO_CENTS = 100_000;
export const PILBARA_PORTS_CAVEAT =
  "Entity-level SOC statement lines for Pilbara Ports Authority only (a Western Australian Government Trading Enterprise under the Government Trading Enterprises Act 2023 (WA) and a port authority under the Port Authorities Act 1999 (WA)). Never add to government program spending, the PNFC sector benchmark, Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, Busselton Water, Mid West Ports, Kimberley Ports Authority, another WA GTE, a QLD/NSW SOC, a WA total, or a national total, or to each other. The official Pilbara Ports annual-report and publications pages answer plain fetches with an Incapsula JavaScript challenge shell, so no official current FY2025-26 PDF was obtainable; the adapter defers FY2025-26 with no rows. No unofficial/search-engine copy and no prior-year report is ingested or presented as current. Provisional and unverified for any future human-verified report.";

/** A discovered official annual-report artifact or an access-challenge marker. */
export interface PilbaraPortsAnnualReportArtifact {
  url: string;
  kind: 'pdf' | 'incapsula-challenge' | 'html-no-report';
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-AU,en;q=0.9',
} as const;

const ANNUAL_REPORT_MARKER = /annual[\s_\-–]*report/i;
const NON_ANNUAL_REPORT =
  /policy|constitution|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|corporate[\s_\-–]*plan|reconciliation[\s_\-–]*action[\s_\-–]*plan|reflect[\s_\-–]*rap|modern[\s_\-–]*slavery|community|board[\s_\-–]*charter|code[\s_\-–]*of[\s_\-–]*conduct|whistleblower|conflict[\s_\-–]*of[\s_\-–]*interest|fraud|insider[\s_\-–]*trading|right[\s_\-–]*to[\s_\-–]*information|public[\s_\-–]*interest|port[\s_\-–]*handbook|trade[\s_\-–]*statistics|statement[\s_\-–]*of[\s_\-–]*intent/i;

/**
 * True when a body is the small Incapsula JavaScript challenge shell that the
 * official Pilbara Ports site returns to a plain fetch. Both the `noindex`
 * shell and the "Request unsuccessful" incident page are recognised.
 */
export function isIncapsulaChallenge(text: string): boolean {
  if (!/Incapsula/i.test(text)) return false;
  const hasShellMarkers =
    /_Incapsula_Resource/i.test(text) ||
    /Request unsuccessful\.?\s*Incapsula incident ID/i.test(text);
  const noIndex = /noindex,\s*nofollow/i.test(text);
  return hasShellMarkers && (noIndex || /Request unsuccessful/i.test(text));
}

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
 * year. `pilbara-ports-annual-report-2026` and `Pilbara-Ports-Annual-Report-2026.pdf`
 * become `2025-26`; `annual-report-2024-25.pdf` becomes `2024-25`. Policies,
 * the SCI, modern slavery statements, port handbooks and other non-annual
 * publications are rejected by name.
 */
export function pilbaraPortsFiscalYearFromPublication(value: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(value) || NON_ANNUAL_REPORT.test(value)) return null;
  const span = /annual[\s_\-–]*report[\s_\-–]*(\d{4})[\s_\-–]*(\d{2,4})(?!\d)/i.exec(value);
  if (span) {
    const fromSpan = fiscalYearFromSpan(span[1] as string, span[2] as string);
    if (fromSpan) return fromSpan;
  }
  // A single year in an annual-report filename/slug means a report for the year
  // ending in that year (e.g. Annual-Report-2026 -> FY2025-26).
  const year = /(?:^|[^0-9])(20\d{2})(?!\d)/.exec(value)?.[1];
  return year ? fiscalYearEnding(year) : null;
}

function candidateFromUrl(
  rawUrl: string,
  pageUrl: string,
): Pick<PilbaraPortsAnnualReportArtifact, 'url' | 'kind' | 'filename' | 'fiscal_year'> | null {
  const normalized = rawUrl.replace(/\\+\//g, '/').replace(/&amp;/g, '&').trim();
  let url: URL;
  try {
    url = new URL(normalized, pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!/\.pdf$/i.test(url.pathname)) return null;
  if (url.hostname.toLowerCase().includes('safelinks.protection.outlook.com')) return null;
  const slugSource = decodeURIComponent(url.pathname.split('/').pop() ?? '');
  const fiscalYear = pilbaraPortsFiscalYearFromPublication(slugSource);
  if (!fiscalYear) return null;
  return {
    url: url.toString(),
    kind: 'pdf',
    filename: slugSource.replace(/[^A-Za-z0-9._-]+/g, '-'),
    fiscal_year: fiscalYear,
  };
}

/**
 * Parse official annual-report PDF artifacts from annual-report/published HTML.
 * Only direct PDFs whose filename names an annual report and a year survive; a
 * link that is not an annual report is rejected by name.
 */
export function parsePilbaraPortsAnnualReportLinks(
  text: string,
  pageUrl: string = PILBARA_PORTS_SOURCE_URL,
): PilbaraPortsAnnualReportArtifact[] {
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
  for (const match of text.matchAll(/(?:src|data-src)\s*=\s*["']([^"']+)["']/gi)) push(match[1]);

  const artifacts: PilbaraPortsAnnualReportArtifact[] = [];
  const seenArtifacts = new Set<string>();
  for (const raw of urls) {
    const candidate = candidateFromUrl(raw, pageUrl);
    if (!candidate) continue;
    if (seenArtifacts.has(candidate.url)) continue;
    seenArtifacts.add(candidate.url);
    const [start, end] = candidate.fiscal_year.split('-');
    artifacts.push({
      ...candidate,
      title: `Pilbara Ports Authority Annual Report ${start}–${end}`,
      discovery_page: pageUrl,
    });
  }
  return artifacts.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

async function fetchText(
  fetchImpl: typeof fetch,
  url: string,
  attempts: string[],
): Promise<{ text: string; bytes: number } | null> {
  try {
    const response = await fetchImpl(url, { redirect: 'follow', headers: BROWSER_HEADERS });
    if (!response.ok) {
      attempts.push(`${url} returned HTTP ${response.status}`);
      return null;
    }
    const text = await response.text();
    return { text, bytes: Buffer.byteLength(text, 'utf8') };
  } catch (error) {
    attempts.push(
      `${url} could not be fetched: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Discover the newest official annual-report artifact. The annual-report page
 * is authoritative; the publications page is a documented fallback. A page that
 * returns only the Incapsula challenge shell is recorded as an explicit access
 * marker, never a guessed PDF URL.
 */
export async function discoverPilbaraPortsAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<PilbaraPortsAnnualReportArtifact> {
  const attempts: string[] = [];
  const artifacts: PilbaraPortsAnnualReportArtifact[] = [];
  let challenge: { url: string; bytes: number } | null = null;
  let reachablePage: string | null = null;

  for (const pageUrl of [PILBARA_PORTS_SOURCE_URL, PILBARA_PORTS_PUBLICATIONS_URL]) {
    const page = await fetchText(fetchImpl, pageUrl, attempts);
    if (!page) continue;
    reachablePage = reachablePage ?? pageUrl;
    if (isIncapsulaChallenge(page.text)) {
      challenge = challenge ?? { url: pageUrl, bytes: page.bytes };
      continue;
    }
    for (const artifact of parsePilbaraPortsAnnualReportLinks(page.text, pageUrl)) {
      artifacts.push(artifact);
    }
  }

  artifacts.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
  const latest = artifacts[0];
  if (latest) return latest;

  if (challenge) {
    return {
      url: challenge.url,
      kind: 'incapsula-challenge',
      filename: `${PILBARA_PORTS_ID}-annual-report-2025-26.incapsula.html`,
      fiscal_year: '2025-26',
      title: 'Pilbara Ports Authority Annual Report 2025–26',
      discovery_page: challenge.url,
    };
  }

  if (reachablePage) {
    return {
      url: reachablePage,
      kind: 'html-no-report',
      filename: `${PILBARA_PORTS_ID}-annual-report-2025-26.html`,
      fiscal_year: '2025-26',
      title: 'Pilbara Ports Authority Annual Report 2025–26',
      discovery_page: reachablePage,
    };
  }

  throw new Error(
    `Pilbara Ports Authority annual report could not be discovered; refusing to hard-code a PDF URL. ${attempts.join('; ')}`,
  );
}

/** Stable natural key for any future human-verified Pilbara Ports row. */
export function pilbaraPortsNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${PILBARA_PORTS_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

export type PilbaraPortsDeferralPhase = 'access' | 'direct-pdf';

export interface PilbaraPortsDeferral {
  phase: PilbaraPortsDeferralPhase;
  reason: string;
}

/** The exact access gap recorded when the current report is behind a JS shell. */
export const PILBARA_PORTS_ACCESS_GAP_REASON =
  'the official Pilbara Ports annual-report and publications pages returned HTTP 200 but only an ' +
  'Incapsula JavaScript challenge shell (212 bytes: <META NAME="robots" CONTENT="noindex,nofollow"> ' +
  'and a /_Incapsula_Resource script; later retries returned an 842–946-byte "Request unsuccessful. ' +
  'Incapsula incident ID" page). No annual-report title or PDF href is present in the plain-fetch ' +
  'response. The official sitemap.xml is reachable (HTTP 200, 76,175 bytes, 457 URL entries) but ' +
  'contains no PDF or getmedia document location, only pages. The WA Parliament tabled-papers route ' +
  'returned an Azure WAF JavaScript challenge at the site root, and the legacy tabled-papers Notes ' +
  'database redirected to a WebCMS entry that returned "Entry not found in index". The WA data portal ' +
  'CKAN API returned HTTP 500. No official current FY2025-26 PDF could be obtained, and no unofficial ' +
  'or prior-year copy was substituted.';

/** The exact reason recorded when an official page is reachable but lists no PDF. */
export const PILBARA_PORTS_NO_PDF_REASON =
  'the official Pilbara Ports annual-report and publications pages returned HTTP 200 HTML but ' +
  'contained no annual-report PDF link; no PDF URL is guessed and no unofficial/prior-year copy is ' +
  'substituted';

/**
 * Decide the deferral for a discovered artifact. This is a pure function so the
 * access-gap policy is testable without a database: a challenge shell, a page
 * with no PDF, a stale prior-year PDF and an unvalidated current-year PDF all
 * defer with zero rows.
 */
export function pilbaraPortsDeferralFor(
  document: PilbaraPortsAnnualReportArtifact,
): PilbaraPortsDeferral {
  if (document.kind === 'incapsula-challenge') {
    return { phase: 'access', reason: PILBARA_PORTS_ACCESS_GAP_REASON };
  }
  if (document.kind === 'html-no-report') {
    return { phase: 'access', reason: PILBARA_PORTS_NO_PDF_REASON };
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

export interface PilbaraPortsConnectorOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest artifact. */
  document?: PilbaraPortsAnnualReportArtifact;
}

async function recordDeferral(
  document: PilbaraPortsAnnualReportArtifact,
  deferral: PilbaraPortsDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: PILBARA_PORTS_ID, document_url: document.url },
    {
      $set: {
        entity: PILBARA_PORTS_ENTITY,
        jurisdiction: PILBARA_PORTS_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Pilbara Ports Authority SOC adapter; no row from this publication was ingested. ' +
          'No unofficial/search-engine copy and no stale prior-year report was substituted. A human must ' +
          'publish or verify a parseable official FY2025-26 PDF before any row is added.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Pilbara Ports Authority connector. */
export function createPilbaraPortsConnector(options: PilbaraPortsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: PILBARA_PORTS_ID,
    name: PILBARA_PORTS_NAME,
    publisher: PILBARA_PORTS_PUBLISHER,
    source_url: PILBARA_PORTS_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: PILBARA_PORTS_LICENSE,
    notes:
      'WA SOC: Pilbara Ports Authority only, a Western Australian Government Trading Enterprise (Government Trading Enterprises Act 2023 (WA)) and port authority (Port Authorities Act 1999 (WA)). The official annual-report and publications pages answer plain fetches with an Incapsula JavaScript challenge shell, so no official current FY2025-26 PDF was obtainable; the official sitemap lists no PDF document and the WA Parliament tabled-papers route is behind an Azure WAF JavaScript challenge. The adapter defers FY2025-26 with zero rows and records the exact access gap; no unofficial/search-engine copy and no prior-year report is ingested or presented as current. No other WA GTE, QLD/NSW SOC or WA/state/national total is created.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document = options.document ?? (await discoverPilbaraPortsAnnualReport(fetchImpl));

      const deferral = pilbaraPortsDeferralFor(document);

      await recordDeferral(document, deferral);
      metadata.errors.push(
        `deferred ${document.fiscal_year}: ${deferral.phase}: ${deferral.reason}`,
      );
      return [];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      for (const entry of raw) {
        if (entry.kind !== 'wa-pilbara-ports-measure') {
          metadata.errors.push('raw entry is not a Pilbara Ports measure; skipped');
        }
      }
      return [];
    },
    metadata,
  };

  return connector;
}
