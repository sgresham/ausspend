import 'dotenv/config';
import mongoose from 'mongoose';
import { DataSourceModel, TradeRecordModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';
import { ingestAbsTrade } from '../server/src/connectors/trade/abs-trade/index.js';
import { ingestOecdItic } from '../server/src/connectors/trade/oecd-itic/index.js';

/**
 * Trade ingestion. ABS International Trade (keyless Data API Beta) and OECD
 * ITIC (public SDMX) are live; the remaining trade sources are recorded as
 * stubs.
 *
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:trade
 *   MONGO_URL=... npx tsx scripts/ingest-trade.ts --source=oecd-itic
 */
export interface TradeSourcePlan {
  source_id: string;
  name: string;
  publisher: string;
  source_url: string;
  priority: number;
  license: string;
  implemented: boolean;
  reason?: string;
}

export const TRADE_SOURCES: readonly TradeSourcePlan[] = [
  {
    source_id: 'abs-international-trade',
    name: 'ABS International Trade',
    publisher: 'Australian Bureau of Statistics',
    source_url: 'https://data.api.abs.gov.au/rest/',
    priority: 1,
    license: '© Australian Bureau of Statistics. Data API Beta, keyless access.',
    implemented: true,
  },
  {
    source_id: 'oecd-itic',
    name: 'OECD ITIC',
    publisher: 'Organisation for Economic Co-operation and Development',
    source_url: 'https://data-explorer.oecd.org/',
    priority: 2,
    license:
      '© OECD. Public SDMX dataflow; CIF/FOB margins combine reported figures with model-based, derived and adjusted estimates.',
    implemented: true,
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

async function recordTradeStub(source: TradeSourcePlan): Promise<void> {
  const existing = await DataSourceModel.findOne({ source_id: source.source_id }).lean();
  if (existing?.status === 'active' || existing?.status === 'degraded') return;
  await DataSourceModel.updateOne(
    { source_id: source.source_id },
    {
      $set: {
        status: 'stub',
        records_ingested: 0,
        errors: [source.reason ?? 'not implemented'],
        deferred_resources: [],
      },
      $setOnInsert: {
        name: source.name,
        publisher: source.publisher,
        source_url: source.source_url,
        retrieved_at: new Date().toISOString(),
        license: source.license,
        verified: false,
        notes: source.reason ?? 'not implemented',
      },
    },
    { upsert: true },
  );
}

function requestedSource(argv: readonly string[]): string | undefined {
  const flag = argv.find((arg) => arg.startsWith('--source='));
  return flag ? flag.slice('--source='.length) : undefined;
}

function fromArchiveRequested(argv: readonly string[]): boolean {
  return argv.includes('--from-archive');
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  const argv = process.argv.slice(2);
  const onlySource = requestedSource(argv);
  const fromArchive = fromArchiveRequested(argv);
  const selected = orderedTradeSources().filter(
    (source) => onlySource === undefined || source.source_id === onlySource,
  );
  if (onlySource !== undefined && selected.length === 0) {
    throw new Error(`unknown trade source ${JSON.stringify(onlySource)}`);
  }

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  try {
    console.log(
      `[ingest:trade] target=${databaseName}${onlySource ? ` source=${onlySource}` : ''}`,
    );

    for (const source of selected) {
      if (source.source_id === 'abs-international-trade') {
        const abs = await ingestAbsTrade();
        console.log(
          `[ingest:trade] abs-international-trade: success goods=${abs.goodsObservations} services=${abs.servicesObservations} upserted=${abs.upserted} matched=${abs.matched} total=${abs.total}`,
        );
        console.log(`[ingest:trade] goods_url=${abs.goodsUrl}`);
        console.log(`[ingest:trade] services_url=${abs.servicesUrl}`);
        continue;
      }
      if (source.source_id === 'oecd-itic') {
        const oecd = await ingestOecdItic({ fromArchive });
        console.log(
          `[ingest:trade] oecd-itic: success${fromArchive ? ' (from archive)' : ''} rows=${oecd.records.length} upserted=${oecd.upserted} matched=${oecd.matched} total=${oecd.total} archived=${oecd.archived.length}`,
        );
        for (const result of oecd.sanity) {
          console.log(
            `[ingest:trade] oecd-itic sanity ${result.year}: unweighted_hs4_mean=${result.observed_unweighted_mean_percent} headline=${result.expected_percent} matched=${result.matched} rows=${result.rows}`,
          );
        }
        continue;
      }
      if (!source.implemented) {
        await recordTradeStub(source);
        console.error(
          `[ingest:trade] ${source.source_id}: stub — ${source.reason ?? 'not implemented'}`,
        );
      }
    }

    const tradeRows = await TradeRecordModel.countDocuments({});
    console.log(`[ingest:trade] trade_records=${tradeRows}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:trade] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
