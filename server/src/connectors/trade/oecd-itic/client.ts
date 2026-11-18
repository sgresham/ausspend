import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { sourceArchiveRoot } from '../../source-archive.js';
import {
  oecdIticRequestPlan,
  parseIticData,
  type OecdIticRecordInput,
  type SdmxDataJson,
} from './parse.js';
import {
  OECD_ITIC_DATAFLOW,
  OECD_ITIC_DATAFLOW_URL,
  OECD_ITIC_DEFAULT_YEARS,
  OECD_ITIC_SOURCE_DATASET,
  OECD_ITIC_SOURCE_ID,
  OECD_ITIC_VERSION,
  OECD_ITIC_WORLD,
} from './meta.js';

export interface OecdIticFetchOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Years to ingest; defaults to 2019–2022. */
  years?: readonly string[];
  /** Skip the World HS4 product requests (tests and minimal ingests). */
  includeWorldProducts?: boolean;
  /** Delay between requests in ms; defaults to 1000. Tests pass 0. */
  requestDelayMs?: number;
}

export interface OecdIticSourceDocument {
  url: string;
  title: string;
  filename: string;
  /** Raw response bytes, archived outside the repo before any row is written. */
  data: string;
  /** Archive fetch timestamp, when the document came from the archive. */
  fetched_at?: string;
}

export interface OecdIticFetchResult {
  records: OecdIticRecordInput[];
  documents: OecdIticSourceDocument[];
  sourceDate: string;
}

interface FetchedJson {
  json: SdmxDataJson;
  text: string;
}

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<FetchedJson> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/vnd.sdmx.data+json;version=1.0' },
    });
    lastStatus = response.status;
    if (response.status === 401 || response.status === 403) {
      throw new Error(`OECD ITIC denied access (HTTP ${response.status}) for ${url}`);
    }
    if (response.status === 404) {
      throw new Error(`OECD ITIC query returned no data (HTTP 404) for ${url}`);
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      // The public endpoint occasionally returns a transient 500 or 429; retry
      // with backoff before treating it as a source failure.
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : response.status === 429
            ? 2000 * (attempt + 1)
            : 500 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!response.ok) {
      throw new Error(`OECD ITIC HTTP ${response.status} for ${url}`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      throw new Error(`OECD ITIC returned non-JSON content-type ${contentType || '(missing)'}`);
    }
    const text = await response.text();
    return { json: JSON.parse(text) as SdmxDataJson, text };
  }
  throw new Error(`OECD ITIC HTTP ${lastStatus} for ${url}`);
}

function documentTitle(plan: { year: string; counterpartArea: string; commodity: string }): string {
  if (plan.counterpartArea === OECD_ITIC_WORLD) {
    return `OECD ITIC Australia World HS4 margins ${plan.year}`;
  }
  return `OECD ITIC Australia partner-total margins ${plan.year}`;
}

function documentFilename(plan: {
  year: string;
  counterpartArea: string;
  commodity: string;
}): string {
  const scope = plan.counterpartArea === OECD_ITIC_WORLD ? 'world-hs4' : 'partners-total';
  return `oecd-itic-${plan.year}-${scope}.json`;
}

/**
 * Fetch Australia's CIF/FOB margins from the public OECD SDMX endpoint.
 *
 * No key or secret is used. The request plan queries one year at a time because
 * the endpoint returns only one observation per series when a multi-year window
 * is combined with a wildcard dimension.
 */
export async function fetchOecdIticRecords(
  options: OecdIticFetchOptions = {},
): Promise<OecdIticFetchResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const sourceDate = now().toISOString().slice(0, 10);
  const years = options.years ?? OECD_ITIC_DEFAULT_YEARS;
  const plan = oecdIticRequestPlan(years).filter(
    (request) =>
      options.includeWorldProducts !== false || request.counterpartArea !== OECD_ITIC_WORLD,
  );

  const records: OecdIticRecordInput[] = [];
  const documents: OecdIticSourceDocument[] = [];
  const seen = new Set<string>();
  const requestDelayMs = options.requestDelayMs ?? 1000;

  for (let index = 0; index < plan.length; index += 1) {
    const request = plan[index]!;
    if (index > 0 && requestDelayMs > 0) {
      // Be polite to the public endpoint; rapid back-to-back queries can
      // trigger a transient HTTP 500 or 429.
      await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
    }
    const { json, text } = await fetchJson(request.url, fetchImpl);
    const parsed = parseIticData(json, { sourceDate, sourceUrl: request.url });
    for (const record of parsed) {
      const key = [
        record.source_dataset,
        record.trade_flow,
        record.measure_type,
        record.commodity_code ?? '',
        record.partner_country ?? '',
        record.time_period ?? '',
        record.financial_year,
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(record);
    }
    documents.push({
      url: request.url,
      title: documentTitle(request),
      filename: documentFilename(request),
      data: text,
    });
  }

  return { records, documents, sourceDate };
}

/**
 * Read already-archived OECD ITIC responses (SHA-256 sidecars included) so an
 * ingest can be replayed without re-hitting the public endpoint. Used when the
 * endpoint returns HTTP 429; the bytes are still the archived source evidence.
 */
export async function readOecdIticArchivedDocuments(
  root?: string,
): Promise<OecdIticSourceDocument[]> {
  const dir = path.join(sourceArchiveRoot(root), OECD_ITIC_SOURCE_ID);
  const entries = await readdir(dir);
  const files = entries
    .filter(
      (name) =>
        name.startsWith('oecd-itic-') && name.endsWith('.json') && !name.endsWith('.meta.json'),
    )
    .sort();
  const documents: OecdIticSourceDocument[] = [];
  for (const filename of files) {
    const meta = JSON.parse(await readFile(path.join(dir, `${filename}.meta.json`), 'utf8')) as {
      title?: string;
      original_url?: string;
      fetched_at?: string;
    };
    documents.push({
      url: meta.original_url ?? OECD_ITIC_DATAFLOW_URL,
      title: meta.title ?? filename,
      filename,
      data: await readFile(path.join(dir, filename), 'utf8'),
      ...(meta.fetched_at ? { fetched_at: meta.fetched_at } : {}),
    });
  }
  return documents;
}

/** Pinned dataset metadata for the data_sources record and docs. */
export const OECD_ITIC_DATASET_META = {
  source_dataset: OECD_ITIC_SOURCE_DATASET,
  dataflow: OECD_ITIC_DATAFLOW,
  version: OECD_ITIC_VERSION,
} as const;
