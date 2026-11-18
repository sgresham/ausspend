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

export interface AbsTradeFetchOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Goods window; defaults to the full FY2024-25. */
  goodsStartPeriod?: string;
  goodsEndPeriod?: string;
  /** Services financial-year label; 2024 means FY2024-25 (year starts 1 July). */
  servicesYear?: string;
}

export interface AbsTradeFetchResult {
  records: AbsTradeRecordInput[];
  goodsUrl: string;
  servicesUrl: string;
  goodsObservations: number;
  servicesObservations: number;
  sourceDate: string;
}

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<SdmxJson> {
  const response = await fetchImpl(url, { headers: { accept: 'application/vnd.sdmx.data+json' } });
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `ABS Data API requires a key or denied access (HTTP ${response.status}); refusing to continue`,
    );
  }
  if (response.status === 404) {
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

/**
 * Fetch ABS goods (ITGS 1.2.0) and services (TRADE_SERV_CNTRY_FY 1.0.0) from
 * the keyless Data API Beta. No request carries an x-api-key header.
 */
export async function fetchAbsTradeRecords(
  options: AbsTradeFetchOptions = {},
): Promise<AbsTradeFetchResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const sourceDate = now().toISOString().slice(0, 10);
  const goodsStartPeriod = options.goodsStartPeriod ?? '2024-07';
  const goodsEndPeriod = options.goodsEndPeriod ?? '2025-06';
  const servicesYear = options.servicesYear ?? '2024';

  const goodsUrl = absGoodsUrl(goodsStartPeriod, goodsEndPeriod);
  const servicesUrl = absServicesUrl(servicesYear);
  const [goodsJson, servicesJson] = await Promise.all([
    fetchJson(goodsUrl, fetchImpl),
    fetchJson(servicesUrl, fetchImpl),
  ]);

  const records = [
    ...parseAbsGoods(goodsJson, { sourceDate, sourceUrl: goodsUrl }),
    ...parseAbsServices(servicesJson, { sourceDate, sourceUrl: servicesUrl }),
  ];

  const goodsObservations = records.filter(
    (record) => record.commodity_code !== ABS_TRADE_SERVICES_EBOPS,
  ).length;
  const servicesObservations = records.length - goodsObservations;
  return { records, goodsUrl, servicesUrl, goodsObservations, servicesObservations, sourceDate };
}
