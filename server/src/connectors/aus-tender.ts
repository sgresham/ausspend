import type { SpendingRecord } from '@ausspend/shared';
import type { Connector, RawRecord } from './types.js';

/**
 * AusTender OCDS connector (F2).
 *
 * Source: https://api.tenders.gov.au/ocds — public, unauthenticated.
 * Feed:   GET /ocds/findByDates/contractPublished/{startDate}/{endDate}
 *         Dates are ISO-8601 in the PATH; the envelope is { releases: [...] }
 *         with ~100 releases per page and a cursor in `links.next`.
 *
 * Mapping is deliberately contract-shaped:
 *   - contracts[0].title / contracts[0].description -> project_name / description
 *   - the buyer is the party with role `buyer` OR `procuringEntity` (never
 *     parties[0], and never the null top-level `buyer` field)
 *   - the supplier is the party with role `supplier` OR `tenderer`
 *   - contracts[0].value.amount (a decimal-dollar string) -> integer cents
 *   - AusTender classification is UNSPSC; it is stored verbatim and never
 *     translated to COFOG
 *   - natural_key = ocid, so re-running upserts rather than duplicates.
 */

export const AUS_TENDER_ID = 'aus-tender';
export const AUS_TENDER_NAME = 'AusTender — Australian Government contracts';
export const AUS_TENDER_PUBLISHER = 'Australian Government Department of Finance';
export const AUS_TENDER_SOURCE_URL = 'https://www.tenders.gov.au/';
/**
 * Licence resolved 2026-11-17 from the AusTender site footer: "With the
 * exception of the Commonwealth Coat of Arms, Approach to Market (ATM) material
 * and where otherwise noted, all materials on AusTender are licensed under a
 * Creative Commons Attribution 3.0 Australia licence (CC BY 3.0 AU)." Contract
 * notices are not ATM material, so this connector's rows are CC BY 3.0 AU with
 * attribution to the Commonwealth of Australia (Department of Finance).
 */
export const AUS_TENDER_LICENSE = 'CC BY 3.0 AU';
export const AUS_TENDER_DATASET = 'AusTender OCDS API';
export const AUS_TENDER_API_BASE = 'https://api.tenders.gov.au/ocds';
export const AUS_TENDER_DEFAULT_PAGE_LIMIT = 25;
export const AUS_TENDER_DEFAULT_DELAY_MS = 1_000;
export const AUS_TENDER_DEFAULT_MAX_RETRIES = 4;
export const AUS_TENDER_USER_AGENT =
  'ausspend/0.1 (Australian government spending explorer; contact: ausspend-dev@example.invalid)';

export interface AusTenderWindow {
  /** ISO-8601 instant used in the path, e.g. 2026-11-02T00:00:00Z. */
  startDate: string;
  endDate: string;
}

export interface AusTenderConnectorOptions extends Partial<AusTenderWindow> {
  /** Bound on pages fetched per run; the narrow live run keeps this small. */
  pageLimit?: number;
  /** Polite delay between pages (not before the first page). */
  delayMs?: number;
  /** Maximum retries for a 429 response before the run fails. */
  maxRetries?: number;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests; defaults to `new Date()`. */
  now?: () => Date;
  baseUrl?: string;
}

export interface AusTenderSkip {
  ocid: string | null;
  reason: string;
}

export interface AusTenderTransformResult {
  records: SpendingRecord[];
  skipped: AusTenderSkip[];
  duplicates: number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The default narrow window: the seven complete days before today (UTC).
 * The live run passes an explicit pair so its dates are reproducible.
 */
export function defaultAusTenderWindow(now: Date = new Date()): AusTenderWindow {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { startDate: isoSeconds(start), endDate: isoSeconds(end) };
}

export function ausTenderFeedUrl(
  window: AusTenderWindow,
  baseUrl: string = AUS_TENDER_API_BASE,
): string {
  return `${baseUrl}/findByDates/contractPublished/${window.startDate}/${window.endDate}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** Exact decimal-dollar string -> integer cents. Returns null when invalid. */
export function dollarsToCents(value: unknown): number | null {
  let amount: number;
  if (typeof value === 'number') {
    amount = value;
  } else if (typeof value === 'string') {
    const normalised = value.trim().replace(/,/g, '');
    if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
    amount = Number(normalised);
  } else {
    return null;
  }

  if (!Number.isFinite(amount) || amount < 0) return null;
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return cents;
}

const FY_PATTERN = /^\d{4}-\d{2}$/;

/** Australian financial year (July–June) for an ISO date, e.g. 2025-07-01 -> 2025-26. */
export function australianFinancialYear(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-based
  const fyStart = month >= 7 ? year : year - 1;
  const fyEnd = String((fyStart + 1) % 100).padStart(2, '0');
  const result = `${fyStart}-${fyEnd}`;
  return FY_PATTERN.test(result) ? result : null;
}

function partiesOf(release: RawRecord): Record<string, unknown>[] {
  const parties = release.parties;
  if (!Array.isArray(parties)) return [];
  return parties.filter(isObject);
}

interface PartyView {
  name: string | null;
  state: string | null;
  postcode: string | null;
}

function roleSet(party: Record<string, unknown>): string[] {
  const roles = party.roles;
  if (!Array.isArray(roles)) return [];
  return roles.filter((role): role is string => typeof role === 'string');
}

function partyView(party: Record<string, unknown> | undefined): PartyView {
  if (!party) return { name: null, state: null, postcode: null };
  const address = isObject(party.address) ? party.address : {};
  return {
    name: asString(party.name),
    state: asString(address.region),
    postcode: asString(address.postalCode),
  };
}

/**
 * Find a party by role. `roles` are matched in order; the first party carrying
 * any requested role wins. This is the rule that keeps the buyer from being
 * parties[0] by accident.
 */
function findParty(
  parties: readonly Record<string, unknown>[],
  roles: readonly string[],
): Record<string, unknown> | undefined {
  for (const role of roles) {
    const match = parties.find((party) => roleSet(party).includes(role));
    if (match) return match;
  }
  return undefined;
}

function firstContract(release: RawRecord): Record<string, unknown> | undefined {
  const contracts = release.contracts;
  if (!Array.isArray(contracts) || contracts.length === 0) return undefined;
  const first = contracts[0];
  return isObject(first) ? first : undefined;
}

function unspscCodes(contract: Record<string, unknown>): string[] {
  const items = contract.items;
  if (!Array.isArray(items)) return [];
  const codes = new Set<string>();
  for (const item of items) {
    if (!isObject(item)) continue;
    const classification = item.classification;
    if (!isObject(classification)) continue;
    if (asString(classification.scheme)?.toUpperCase() !== 'UNSPSC') continue;
    const id = asString(classification.id);
    if (id) codes.add(id);
  }
  return [...codes];
}

function tenderDetails(release: RawRecord): Record<string, unknown> {
  return isObject(release.tender) ? release.tender : {};
}

/**
 * Build the public AusTender contract-notice URL for a contract / ocid.
 *
 * The old `/Contract/Details/CN…` route is obsolete (404). The stable public
 * interface is the CN search URL, which resolves to the matching notice and
 * its Full Details link. The `/Cn/Show/{GUID}` route needs the portal GUID,
 * which the OCDS feed does not publish, so it is deliberately not invented.
 */
export function ausTenderSourceUrl(contractId: string | null, ocid: string): string {
  if (contractId) {
    return `https://www.tenders.gov.au/Cn/Search?CnId=${encodeURIComponent(contractId)}&SearchButton=true`;
  }
  return `https://www.tenders.gov.au/?ocid=${encodeURIComponent(ocid)}`;
}

export interface MappedRelease {
  record: SpendingRecord | null;
  skip: AusTenderSkip | null;
}

/**
 * Map one OCDS release to a spending record. Pure and exported so the fixture
 * tests can pin each field including the failure paths.
 */
export function mapAusTenderRelease(release: RawRecord): MappedRelease {
  const ocid = asString(release.ocid);
  if (!ocid) {
    return {
      record: null,
      skip: { ocid: null, reason: 'release has no ocid (natural_key)' },
    };
  }

  const contract = firstContract(release);
  if (!contract) {
    return { record: null, skip: { ocid, reason: 'release has no contracts[0]' } };
  }

  const amountCents = dollarsToCents(isObject(contract.value) ? contract.value.amount : undefined);
  if (amountCents === null) {
    return {
      record: null,
      skip: { ocid, reason: 'contracts[0].value.amount is missing or not a valid amount' },
    };
  }

  const dateSigned = asString(contract.dateSigned);
  const releaseDate = asString(release.date);
  const sourceDate = dateSigned ?? releaseDate;
  const fiscalYear = australianFinancialYear(sourceDate);
  if (!sourceDate || !fiscalYear) {
    return {
      record: null,
      skip: { ocid, reason: 'contract/release date is missing or invalid' },
    };
  }

  const contractId = asString(contract.id);
  const title = asString(contract.title);
  const description = asString(contract.description);

  const parties = partiesOf(release);
  const buyer = partyView(findParty(parties, ['buyer', 'procuringEntity']));
  const supplier = partyView(findParty(parties, ['supplier', 'tenderer']));

  const unspsc = unspscCodes(contract);
  const tender = tenderDetails(release);
  const procurementMethod =
    asString(tender.procurementMethodDetails) ?? asString(tender.procurementMethod);

  const period = isObject(contract.period) ? contract.period : {};
  const periodStart = asString(period.startDate);
  const periodEnd = asString(period.endDate);

  // Location comes only from a party address. We never invent coordinates,
  // an LGA or an SA2. State is stored; postcode is kept in notes.
  const addressSource = supplier.state ? supplier : buyer;
  const state = addressSource.state;
  const postcode = addressSource.postcode;
  const location = state ? { state } : undefined;
  const dataQualityFlag = state
    ? postcode
      ? 'location_approximate'
      : 'statewide_only'
    : 'location_unknown';

  const status = asString(contract.status);
  const noteParts = [
    `AusTender contract ${contractId ?? '(no id)'}`,
    status ? `status ${status}` : null,
    procurementMethod ? `procurement ${procurementMethod}` : null,
    periodStart && periodEnd ? `period ${periodStart}..${periodEnd}` : null,
    postcode ? `supplier postcode ${postcode}` : null,
    unspsc.length > 0 ? `UNSPSC ${unspsc.join(', ')}` : null,
  ].filter((part): part is string => Boolean(part));

  const record: SpendingRecord = {
    amount_cents: amountCents,
    measure_type: 'contract',
    fiscal_year: fiscalYear,
    source_id: AUS_TENDER_ID,
    source_url: ausTenderSourceUrl(contractId, ocid),
    verified: false,
    natural_key: ocid,
    jurisdiction_level: 'federal',
    jurisdiction: 'Commonwealth',
    source_dataset: AUS_TENDER_DATASET,
    source_date: sourceDate,
    data_quality_flag: dataQualityFlag,
    notes: noteParts.join('; '),
    ...(title ? { project_name: title } : {}),
    ...(description ? { description } : {}),
    ...(supplier.name ? { delivery_entity: supplier.name } : {}),
    ...(buyer.name ? { funding_source: buyer.name } : {}),
    ...(location ? { location } : {}),
    ...(unspsc.length > 0 ? { unspsc: unspsc.join(',') } : {}),
  };

  return { record, skip: null };
}

/** Map and deduplicate a batch of releases by ocid, keeping the newest. */
export function transformAusTenderReleases(
  releases: readonly RawRecord[],
): AusTenderTransformResult {
  const byKey = new Map<string, { record: SpendingRecord; sourceDate: string }>();
  const skipped: AusTenderSkip[] = [];
  let duplicates = 0;

  for (const release of releases) {
    const { record, skip } = mapAusTenderRelease(release);
    if (!record) {
      if (skip) skipped.push(skip);
      continue;
    }

    const key = record.natural_key;
    // "Newest" means the latest release/publication date, not just the
    // contract's dateSigned, so an amended release wins over its original.
    const versionDate = asString(release.date) ?? record.source_date ?? '';
    const existing = byKey.get(key);
    if (existing) {
      duplicates += 1;
      if (versionDate > existing.sourceDate) {
        byKey.set(key, { record, sourceDate: versionDate });
      }
      continue;
    }
    byKey.set(key, { record, sourceDate: versionDate });
  }

  return {
    records: [...byKey.values()].map((entry) => entry.record),
    skipped,
    duplicates,
  };
}

function parseRetryAfter(header: string | null, now: Date): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 60_000);
  const date = new Date(header);
  if (!Number.isNaN(date.getTime())) {
    return Math.max(0, Math.min(date.getTime() - now.getTime(), 60_000));
  }
  return null;
}

/**
 * Create the live AusTender connector. `fetch` pages the contractPublished feed
 * with a cursor, a polite delay and bounded 429 retries; `transform` maps the
 * release batch. Errors from an individual release are collected on
 * `metadata.errors` so the runner can log a partial run without aborting.
 */
export function createAusTenderConnector(options: AusTenderConnectorOptions = {}): Connector {
  const fallbackWindow = defaultAusTenderWindow(options.now?.());
  const window: AusTenderWindow = {
    startDate: options.startDate ?? fallbackWindow.startDate,
    endDate: options.endDate ?? fallbackWindow.endDate,
  };
  const pageLimit = Math.max(1, options.pageLimit ?? AUS_TENDER_DEFAULT_PAGE_LIMIT);
  const delayMs = Math.max(0, options.delayMs ?? AUS_TENDER_DEFAULT_DELAY_MS);
  const maxRetries = Math.max(0, options.maxRetries ?? AUS_TENDER_DEFAULT_MAX_RETRIES);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => new Date());
  const baseUrl = options.baseUrl ?? AUS_TENDER_API_BASE;

  let nextPageWarning: string | null = null;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
  };

  async function request(url: string): Promise<Response> {
    let attempt = 0;
    for (;;) {
      if (typeof fetchImpl !== 'function') {
        throw new Error('AusTender fetch is unavailable: no fetch implementation');
      }
      const response = await fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': AUS_TENDER_USER_AGENT,
        },
      });

      if (response.status !== 429) {
        if (!response.ok) {
          throw new Error(`AusTender HTTP ${response.status} for ${url}`);
        }
        return response;
      }

      if (attempt >= maxRetries) {
        throw new Error(`AusTender rate limited (429) after ${maxRetries} retries`);
      }
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'), now());
      const backoff = retryAfter ?? Math.min(1_000 * 2 ** attempt, 30_000);
      attempt += 1;
      await sleep(backoff);
    }
  }

  async function fetchReleases(): Promise<RawRecord[]> {
    const releases: RawRecord[] = [];
    let url: string | null = ausTenderFeedUrl(window, baseUrl);
    let pages = 0;
    nextPageWarning = null;

    while (url && pages < pageLimit) {
      if (pages > 0) await sleep(delayMs);
      const response = await request(url);
      const body: unknown = await response.json();
      if (!isObject(body) || !Array.isArray(body.releases)) {
        throw new Error('Unexpected AusTender envelope: `releases` is not an array');
      }
      for (const release of body.releases) {
        if (isObject(release)) releases.push(release);
      }
      pages += 1;

      const links = isObject(body.links) ? body.links : {};
      const next = asString(links.next);
      if (!next) {
        url = null;
        break;
      }
      // Never follow a cursor off the AusTender API host.
      let parsed: URL;
      try {
        parsed = new URL(next);
      } catch {
        throw new Error(`AusTender returned an invalid next cursor: ${next}`);
      }
      if (parsed.hostname !== 'api.tenders.gov.au') {
        throw new Error(`AusTender next cursor left the API host: ${parsed.hostname}`);
      }
      url = next;
    }

    if (url) nextPageWarning = `page limit ${pageLimit} reached; results truncated`;
    return releases;
  }

  return {
    id: AUS_TENDER_ID,
    name: AUS_TENDER_NAME,
    publisher: AUS_TENDER_PUBLISHER,
    source_url: AUS_TENDER_SOURCE_URL,
    license: AUS_TENDER_LICENSE,
    // The implementation is live; per-run status (active/degraded) comes from
    // the ingestion runner and data_sources.
    status: 'active',
    jurisdiction_level: 'federal',
    async fetch(): Promise<RawRecord[]> {
      return fetchReleases();
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformAusTenderReleases(raw);
      const warnings: string[] = [];
      if (nextPageWarning) warnings.push(nextPageWarning);
      if (result.skipped.length > 0) {
        const reasons = result.skipped
          .slice(0, 5)
          .map((skip) => `${skip.ocid ?? '(no ocid)'}: ${skip.reason}`)
          .join('; ');
        warnings.push(`${result.skipped.length} release(s) skipped (${reasons})`);
      }
      metadata.errors = warnings;
      return result.records;
    },
    metadata,
  };
}
