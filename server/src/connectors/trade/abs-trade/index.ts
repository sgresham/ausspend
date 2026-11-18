import { DataSourceModel, TradeRecordModel } from '../../../models/index.js';
import {
  fetchAbsTradeRecords,
  type AbsTradeFetchOptions,
  type AbsTradeFetchResult,
} from './client.js';
import {
  ABS_TRADE_LICENSE,
  ABS_TRADE_NAME,
  ABS_TRADE_PUBLISHER,
  ABS_TRADE_SOURCE_ID,
  ABS_TRADE_SOURCE_URL,
  ABS_TRADE_SOURCE_DATASET,
} from './meta.js';
import type { AbsTradeRecordInput } from './parse.js';

export * from './meta.js';
export * from './parse.js';
export * from './client.js';

export interface AbsTradeIngestResult extends AbsTradeFetchResult {
  upserted: number;
  matched: number;
  total: number;
}

function naturalFilter(record: AbsTradeRecordInput): Record<string, unknown> {
  return {
    source_dataset: record.source_dataset,
    trade_flow: record.trade_flow,
    measure_type: record.measure_type,
    commodity_code: record.commodity_code ?? null,
    time_period: record.time_period ?? null,
    financial_year: record.financial_year,
    'location.granularity': record.location.granularity,
  };
}

/**
 * Upsert ABS trade observations by their published dimensions. Nothing is
 * summed: goods monthly rows and services financial-year rows are separate
 * `trade_value` observations, and no goods+services total is created.
 */
export async function upsertAbsTradeRecords(
  records: readonly AbsTradeRecordInput[],
): Promise<{ upserted: number; matched: number }> {
  if (records.length === 0) return { upserted: 0, matched: 0 };
  const result = await TradeRecordModel.bulkWrite(
    records.map((record) => ({
      updateOne: {
        filter: naturalFilter(record),
        update: { $set: record },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  return {
    upserted: result.upsertedCount,
    matched: result.matchedCount,
  };
}

export async function recordAbsTradeSource(recordCount: number): Promise<void> {
  const now = new Date();
  await DataSourceModel.updateOne(
    { source_id: ABS_TRADE_SOURCE_ID },
    {
      $set: {
        name: ABS_TRADE_NAME,
        publisher: ABS_TRADE_PUBLISHER,
        source_url: ABS_TRADE_SOURCE_URL,
        retrieved_at: now.toISOString(),
        license: ABS_TRADE_LICENSE,
        verified: true,
        status: 'active',
        last_ingested_at: now,
        fetch_strategy: 'direct',
        last_successful_fetch: now,
        records_ingested: recordCount,
        errors: [],
        deferred_resources: [],
        notes:
          'Keyless ABS Data API Beta: ITGS 1.2.0 current-price original monthly goods totals and DATA_ITEM commodity rows from the earliest available month, plus every available TRADE_SERV_CNTRY_FY 1.0.0 total-services financial year. No goods+services total is derived.',
      },
    },
    { upsert: true },
  );
}

/** Fetch and upsert the ABS trade dataset. Returns the observed row count. */
export async function ingestAbsTrade(
  options: AbsTradeFetchOptions = {},
): Promise<AbsTradeIngestResult> {
  const fetched = await fetchAbsTradeRecords(options);
  const { upserted, matched } = await upsertAbsTradeRecords(fetched.records);
  const total = await TradeRecordModel.countDocuments({
    source_dataset: ABS_TRADE_SOURCE_DATASET,
  });
  await recordAbsTradeSource(total);
  return { ...fetched, upserted, matched, total };
}

/** Discovery metadata used by scripts/generate-source-docs.ts. */
export const connectorModule = {
  id: ABS_TRADE_SOURCE_ID,
  doc_id: 'abs-trade',
  create: () => ({
    id: ABS_TRADE_SOURCE_ID,
    doc_id: 'abs-trade',
    name: ABS_TRADE_NAME,
    publisher: ABS_TRADE_PUBLISHER,
    source_url: ABS_TRADE_SOURCE_URL,
    jurisdiction_level: 'federal' as const,
    status: 'active' as const,
    license: ABS_TRADE_LICENSE,
    notes:
      'ABS International Trade via the keyless Data API Beta (https://data.api.abs.gov.au/rest/). Goods: ITGS 1.2.0, MEASURE=M1 current prices, TSEST=10 original, REGION=AUS, FREQ=M, DATA_ITEM 1000/2000 plus printed commodity categories, ingested from the discovered earliest month (1971-07 at the 2026-11-18 check) through the latest available month (2026-09), in 60-month chunks. Services: TRADE_SERV_CNTRY_FY 1.0.0, EXP_IMP EXP/IMP, EBOPS TOTAL, COUNTRY TOT, FREQ=A, every available financial year (2000–2024) labelled by 1 July start year, in per-year requests. Trade values are observed AUD millions converted to integer cents. Latest-month anchor: ABS Sep-2026 536801.xlsx (171,559 B; SHA-256 4a55f3d60a43e3e976f4eb339137755bdc02e3ca4283db81762f1be1ec0760b4), archived outside the repo; it prints seasonally adjusted total goods credits 48,434 $m and debits 45,609 $m, while the API original series prints 48,173 $m and 46,547 $m, so the XLSX is an existence/magnitude check only and is not ingested. Limitations: no goods+services total, no cross-source total, no spending or profit data, and the SA XLSX is not an equality anchor for the original series.',
  }),
} as const;
