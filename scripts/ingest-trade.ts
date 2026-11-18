import 'dotenv/config';
import mongoose from 'mongoose';
import { TradeRecordModel, DataSourceModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * Trade ingestion skeleton — priority order fixed by the trade brief.
 *
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:trade
 *
 * No live trade connector is implemented in this foundation item. The runner
 * records each planned source as a `stub` in `data_sources`, logs the reason it
 * cannot run, and exits non-zero so an unimplemented source can never look like
 * a successful ingest.
 */
export interface TradeSourcePlan {
  source_id: string;
  name: string;
  publisher: string;
  source_url: string;
  priority: number;
  license: string;
  implemented: false;
  reason: string;
}

export const TRADE_SOURCES: readonly TradeSourcePlan[] = [
  {
    source_id: 'abs-international-trade',
    name: 'ABS International Trade',
    publisher: 'Australian Bureau of Statistics',
    source_url: 'https://www.abs.gov.au/statistics/economy/international-trade',
    priority: 1,
    license: '© Australian Bureau of Statistics. Planned source; no bytes ingested yet.',
    implemented: false,
    reason:
      'ABS Indicator API is key-gated (root returns HTTP 403 "Missing Authentication Token") and no ABS key is present; live connector deferred.',
  },
  {
    source_id: 'oecd-itic',
    name: 'OECD ITIC',
    publisher: 'Organisation for Economic Co-operation and Development',
    source_url: 'https://data-explorer.oecd.org/',
    priority: 2,
    license: '© OECD. Planned source; no bytes ingested yet.',
    implemented: false,
    reason: 'OECD ITIC dataflow is reachable but no connector is implemented yet.',
  },
  {
    source_id: 'bitre-waterline',
    name: 'BITRE Waterline',
    publisher: 'Bureau of Infrastructure and Transport Research Economics',
    source_url: 'https://www.bitre.gov.au/statistics/waterline',
    priority: 3,
    license: '© Commonwealth of Australia (BITRE). Planned source; no bytes ingested yet.',
    implemented: false,
    reason: 'Port-level Waterline tables need per-table unit detection; no connector yet.',
  },
  {
    source_id: 'disr-req',
    name: 'DISR Resources and Energy Quarterly',
    publisher: 'Department of Industry, Science and Resources',
    source_url: 'https://www.industry.gov.au/data-and-publications/resources-and-energy-quarterly',
    priority: 4,
    license: '© Commonwealth of Australia (DISR). Planned source; no bytes ingested yet.',
    implemented: false,
    reason: 'REQ quarterly tables need per-table unit detection; no connector yet.',
  },
  {
    source_id: 'abares',
    name: 'ABARES',
    publisher: 'Australian Bureau of Agricultural and Resource Economics and Sciences',
    source_url: 'https://www.agriculture.gov.au/abares',
    priority: 5,
    license: '© Commonwealth of Australia (ABARES). Planned source; no bytes ingested yet.',
    implemented: false,
    reason: 'ABARES commodity tables need per-table unit detection; no connector yet.',
  },
] as const;

export function orderedTradeSources(): readonly TradeSourcePlan[] {
  return [...TRADE_SOURCES].sort((a, b) => a.priority - b.priority);
}

/**
 * `data_sources` update hook. Never downgrades an already-live trade source;
 * the foundation item only records planned sources as stubs.
 */
async function recordTradeSourceState(source: TradeSourcePlan): Promise<'stub' | 'preserved'> {
  const existing = await DataSourceModel.findOne({ source_id: source.source_id }).lean();
  if (existing?.status === 'active' || existing?.status === 'degraded') {
    return 'preserved';
  }

  await DataSourceModel.updateOne(
    { source_id: source.source_id },
    {
      $set: {
        status: 'stub',
        records_ingested: 0,
        errors: [source.reason],
        deferred_resources: [],
      },
      $setOnInsert: {
        name: source.name,
        publisher: source.publisher,
        source_url: source.source_url,
        retrieved_at: new Date().toISOString(),
        license: source.license,
        verified: false,
        notes: source.reason,
      },
    },
    { upsert: true },
  );
  return 'stub';
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    console.log(
      `[ingest:trade] target=${databaseName} sources=${orderedTradeSources()
        .map((source) => source.source_id)
        .join(',')}`,
    );

    let unimplemented = 0;
    for (const source of orderedTradeSources()) {
      const state = await recordTradeSourceState(source);
      if (source.implemented === false) {
        unimplemented += 1;
        console.error(
          `[ingest:trade] ${source.source_id}: NOT IMPLEMENTED — ${source.reason} ` +
            `(data_sources ${state === 'stub' ? 'marked stub' : 'left live; not downgraded'})`,
        );
      }
    }

    const tradeRows = await TradeRecordModel.countDocuments({});
    console.log(`[ingest:trade] trade_records=${tradeRows} (no live connector ran)`);
    if (unimplemented > 0) {
      console.error(
        `[ingest:trade] FAILED: ${unimplemented}/${TRADE_SOURCES.length} planned trade sources are not implemented; no trade rows were ingested.`,
      );
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:trade] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
