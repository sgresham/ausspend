import {
  absDataUrl,
  parseAbsGoods,
  parseAbsServices,
  type AbsTradeRecordInput,
  type SdmxJson,
} from './parse.js';
import {
  ABS_TRADE_GOODS_DATAFLOW,
  ABS_TRADE_GOODS_FREQ,
  ABS_TRADE_GOODS_MEASURE,
  ABS_TRADE_GOODS_REGION,
  ABS_TRADE_GOODS_TSEST,
  ABS_TRADE_GOODS_VERSION,
  ABS_TRADE_SERVICES_COUNTRY,
  ABS_TRADE_SERVICES_DATAFLOW,
  ABS_TRADE_SERVICES_EBOPS,
  ABS_TRADE_SERVICES_FREQ,
  ABS_TRADE_SERVICES_VERSION,
} from './meta.js';

/** Earliest probe year for the goods dataflow; the real earliest is discovered. */
export const ABS_TRADE_GOODS_PROBE_START = '1970-01';
/** Largest goods window per request. Responses are parsed and upserted chunk by chunk. */
export const ABS_TRADE_GOODS_DEFAULT_CHUNK_MONTHS = 60;
/** Earliest probe year for the services dataflow; the real earliest is discovered. */
export const ABS_TRADE_SERVICES_PROBE_START = '1970';

export interface AbsTradeFetchOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Explicit goods bounds. When omitted, the live dataflow range is discovered. */
  goodsStartPeriod?: string;
  goodsEndPeriod?: string;
  /** Months per goods Data API request. Defaults to 60 and is capped at 120. */
  goodsChunkMonths?: number;
  /** Explicit services year bounds. When omitted, available years are discovered. */
  servicesStartYear?: string;
  servicesEndYear?: string;
  /** Legacy single-year selector; equivalent to servicesStartYear=servicesEndYear. */
  servicesYear?: string;
}

export interface AbsTradeFetchResult {
  records: AbsTradeRecordInput[];
  goodsUrls: string[];
  servicesUrls: string[];
  goodsObservations: number;
  servicesObservations: number;
  /** First and last goods months actually returned by the API. */
  goodsEarliestPeriod: string;
  goodsLatestPeriod: string;
  /** Services label years actually ingested (1 July start year). */
  servicesYears: string[];
  sourceDate: string;
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
  allowNotFound = false,
): Promise<SdmxJson | null> {
  const response = await fetchImpl(url, { headers: { accept: 'application/vnd.sdmx.data+json' } });
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `ABS Data API requires a key or denied access (HTTP ${response.status}); refusing to continue`,
    );
  }
  if (response.status === 404) {
    if (allowNotFound) return null;
    throw new Error(`ABS Data API dataflow not found (HTTP 404) for ${url}; refusing to guess`);
  }
  if (!response.ok) {
    throw new Error(`ABS Data API HTTP ${response.status} for ${url}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    throw new Error(`ABS Data API returned non-JSON content-type ${contentType || '(missing)'}`);
  }
  return (await response.json()) as SdmxJson;
}

export function absGoodsUrl(startPeriod: string, endPeriod: string): string {
  const key = `${ABS_TRADE_GOODS_MEASURE}..${ABS_TRADE_GOODS_TSEST}.${ABS_TRADE_GOODS_REGION}.${ABS_TRADE_GOODS_FREQ}`;
  return absDataUrl(
    `data/ABS,${ABS_TRADE_GOODS_DATAFLOW},${ABS_TRADE_GOODS_VERSION}/${key}?startPeriod=${startPeriod}&endPeriod=${endPeriod}&format=jsondata`,
  );
}

export function absServicesUrl(servicesYear: string): string {
  const key = `..${ABS_TRADE_SERVICES_COUNTRY}.${ABS_TRADE_SERVICES_FREQ}`;
  return absDataUrl(
    `data/ABS,${ABS_TRADE_SERVICES_DATAFLOW},${ABS_TRADE_SERVICES_VERSION}/${key}?startPeriod=${servicesYear}&format=jsondata`,
  );
}

function periodToIndex(period: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new Error(`unexpected monthly period ${JSON.stringify(period)}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`invalid month in period ${period}`);
  return year * 12 + (month - 1);
}

function indexToPeriod(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function addMonths(period: string, months: number): string {
  return indexToPeriod(periodToIndex(period) + months);
}

function currentMonth(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export interface GoodsChunk {
  start: string;
  end: string;
}

/** Split an inclusive monthly range into bounded API windows. */
export function buildGoodsChunks(
  startPeriod: string,
  endPeriod: string,
  chunkMonths = ABS_TRADE_GOODS_DEFAULT_CHUNK_MONTHS,
): GoodsChunk[] {
  const start = periodToIndex(startPeriod);
  const end = periodToIndex(endPeriod);
  if (start > end) {
    throw new Error(`goods start ${startPeriod} is after end ${endPeriod}`);
  }
  const size = Math.max(1, Math.min(120, Math.floor(chunkMonths)));
  const chunks: GoodsChunk[] = [];
  for (let cursor = start; cursor <= end; cursor += size) {
    chunks.push({
      start: indexToPeriod(cursor),
      end: indexToPeriod(Math.min(cursor + size - 1, end)),
    });
  }
  return chunks;
}

function timeValues(json: SdmxJson): string[] {
  const structure = json.data.structures[0];
  if (!structure) return [];
  const observation = structure.dimensions.observation.find((entry) => entry.id === 'TIME_PERIOD');
  return observation ? observation.values.map((value) => value.id) : [];
}

function uniqueTimes(json: SdmxJson | null): string[] {
  if (!json) return [];
  return [...new Set(timeValues(json))].sort();
}

/**
 * Discover the real goods range. The earliest decade is probed forward until a
 * response contains observations, and the latest month is probed backwards from
 * the current month. Nothing is hard-coded beyond the probe start.
 */
export async function discoverAbsGoodsRange(
  fetchImpl: typeof fetch = globalThis.fetch,
  now: () => Date = () => new Date(),
): Promise<{ earliestPeriod: string; latestPeriod: string }> {
  const today = currentMonth(now());
  let earliestPeriod: string | null = null;
  let probeStart = ABS_TRADE_GOODS_PROBE_START;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const probeEnd = addMonths(probeStart, 119);
    const json = await fetchJson(absGoodsUrl(probeStart, probeEnd), fetchImpl, true);
    const times = uniqueTimes(json);
    if (times.length > 0) {
      earliestPeriod = times[0]!;
      break;
    }
    probeStart = addMonths(probeStart, 120);
    if (periodToIndex(probeStart) > periodToIndex(today)) break;
  }

  let latestPeriod: string | null = null;
  let probeEnd = today;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const probeStart = addMonths(probeEnd, -5);
    const json = await fetchJson(absGoodsUrl(probeStart, probeEnd), fetchImpl, true);
    const times = uniqueTimes(json);
    if (times.length > 0) {
      latestPeriod = times[times.length - 1]!;
      break;
    }
    probeEnd = addMonths(probeEnd, -1);
  }

  if (!earliestPeriod || !latestPeriod) {
    throw new Error(
      'ABS goods dataflow returned no observations while discovering its historical range; refusing to guess',
    );
  }
  if (periodToIndex(earliestPeriod) > periodToIndex(latestPeriod)) {
    throw new Error(
      `ABS goods range is inverted: earliest ${earliestPeriod}, latest ${latestPeriod}`,
    );
  }
  return { earliestPeriod, latestPeriod };
}

/** Discover every annual services label year exposed by the dataflow. */
export async function discoverAbsServicesYears(
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<string[]> {
  let probeStart = ABS_TRADE_SERVICES_PROBE_START;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const json = await fetchJson(absServicesUrl(probeStart), fetchImpl, true);
    const years = uniqueTimes(json).filter((year) => /^\d{4}$/.test(year));
    if (years.length > 0) return years;
    probeStart = String(Number(probeStart) + 10);
  }
  throw new Error(
    'ABS services dataflow returned no annual observations while discovering its years; refusing to guess',
  );
}

function yearRange(startYear: string, endYear: string): string[] {
  const start = Number(startYear);
  const end = Number(endYear);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
    throw new Error(`invalid services year range ${startYear}..${endYear}`);
  }
  const years: string[] = [];
  for (let year = start; year <= end; year += 1) years.push(String(year));
  return years;
}

function naturalKeyOf(record: AbsTradeRecordInput): string {
  return [
    record.source_dataset,
    record.trade_flow,
    record.measure_type,
    record.commodity_code ?? '',
    record.time_period ?? '',
    record.financial_year,
    record.location.granularity,
  ].join('\u001f');
}

function dedupe(records: readonly AbsTradeRecordInput[]): AbsTradeRecordInput[] {
  const seen = new Map<string, AbsTradeRecordInput>();
  for (const record of records) {
    const key = naturalKeyOf(record);
    if (!seen.has(key)) seen.set(key, record);
  }
  return [...seen.values()];
}

/**
 * Fetch the full ABS goods history (monthly, from the real earliest observation)
 * and every available services financial year. Goods and services are fetched
 * and stored separately; no goods+services total is derived.
 */
export async function fetchAbsTradeRecords(
  options: AbsTradeFetchOptions = {},
): Promise<AbsTradeFetchResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const sourceDate = now().toISOString().slice(0, 10);

  let goodsStartPeriod = options.goodsStartPeriod;
  let goodsEndPeriod = options.goodsEndPeriod;
  if (!goodsStartPeriod || !goodsEndPeriod) {
    const discovered = await discoverAbsGoodsRange(fetchImpl, now);
    goodsStartPeriod ??= discovered.earliestPeriod;
    goodsEndPeriod ??= discovered.latestPeriod;
  }
  const chunks = buildGoodsChunks(
    goodsStartPeriod,
    goodsEndPeriod,
    options.goodsChunkMonths ?? ABS_TRADE_GOODS_DEFAULT_CHUNK_MONTHS,
  );
  const goodsUrls = chunks.map((chunk) => absGoodsUrl(chunk.start, chunk.end));

  const goodsRecords: AbsTradeRecordInput[] = [];
  for (const url of goodsUrls) {
    const json = await fetchJson(url, fetchImpl, true);
    if (!json) continue;
    goodsRecords.push(...parseAbsGoods(json, { sourceDate, sourceUrl: url }));
  }
  if (goodsRecords.length === 0) {
    throw new Error(
      'ABS goods dataflow returned no observations; refusing to ingest an empty goods series',
    );
  }
  const goodsTimes = goodsRecords.map((record) => record.time_period!).sort();
  const goodsEarliestPeriod = goodsTimes[0]!;
  const goodsLatestPeriod = goodsTimes[goodsTimes.length - 1]!;

  let servicesYears: string[];
  if (options.servicesYear) {
    servicesYears = [options.servicesYear];
  } else if (options.servicesStartYear && options.servicesEndYear) {
    servicesYears = yearRange(options.servicesStartYear, options.servicesEndYear);
  } else {
    const discovered = await discoverAbsServicesYears(fetchImpl);
    const start = options.servicesStartYear ?? discovered[0]!;
    const end = options.servicesEndYear ?? discovered[discovered.length - 1]!;
    servicesYears = yearRange(start, end);
  }
  const servicesUrls = servicesYears.map((year) => absServicesUrl(year));

  const servicesRecords: AbsTradeRecordInput[] = [];
  for (const url of servicesUrls) {
    const json = await fetchJson(url, fetchImpl, true);
    if (!json) continue;
    servicesRecords.push(...parseAbsServices(json, { sourceDate, sourceUrl: url }));
  }
  if (servicesRecords.length === 0) {
    throw new Error(
      'ABS services dataflow returned no observations; refusing to ingest an empty services series',
    );
  }

  const records = dedupe([...goodsRecords, ...servicesRecords]);
  const goodsObservations = records.filter(
    (record) => record.commodity_code !== ABS_TRADE_SERVICES_EBOPS,
  ).length;
  const servicesObservations = records.length - goodsObservations;
  return {
    records,
    goodsUrls,
    servicesUrls,
    goodsObservations,
    servicesObservations,
    goodsEarliestPeriod,
    goodsLatestPeriod,
    servicesYears,
    sourceDate,
  };
}
