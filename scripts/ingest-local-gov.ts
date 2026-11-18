import 'dotenv/config';
import mongoose from 'mongoose';
import { getConnector, runIngestion, type Connector } from '../server/src/connectors/index.js';
import { MeasureModel } from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

/**
 * Statewide local-government ingestion.
 *
 * Current priority order: QLD -> WA. TAS/VIC/SA/NT remain explicit
 * placeholders in LOCAL_GOVERNMENT_SOURCES.
 *
 *   MONGO_URL=mongodb://localhost:27017/ausspend_dev npm run ingest:local-gov
 *   MONGO_URL=... npx tsx scripts/ingest-local-gov.ts --source=qld-local-government
 *   LOCAL_GOV_DRY_RUN=1 npm run ingest:local-gov
 */
export interface LocalGovernmentSource {
  id: string;
  jurisdiction: 'QLD' | 'WA' | 'TAS' | 'VIC' | 'SA' | 'NT';
  priority: number;
}

export const LOCAL_GOVERNMENT_SOURCES: readonly LocalGovernmentSource[] = [
  { id: 'qld-local-government', jurisdiction: 'QLD', priority: 1 },
  { id: 'wa-mycouncil', jurisdiction: 'WA', priority: 2 },
  // Extension point: TAS/VIC/SA/NT, added here in priority order after their
  // connector is registered in server/src/connectors/registry.ts.
];

export const LOCAL_GOVERNMENT_ORDER = LOCAL_GOVERNMENT_SOURCES.map((source) => source.id);

function requestedIds(argv: readonly string[]): string[] {
  const flag = argv.find((arg) => arg.startsWith('--source='));
  const fromFlag = flag ? flag.slice('--source='.length).trim() : '';
  const raw = fromFlag || process.env.LOCAL_GOV_SOURCES?.trim() || '';
  if (!raw) return [...LOCAL_GOVERNMENT_ORDER];
  const requested = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const unknown = requested.filter((id) => !LOCAL_GOVERNMENT_ORDER.includes(id));
  if (unknown.length > 0) {
    throw new Error(`unknown local-government source id(s): ${unknown.join(', ')}`);
  }
  return LOCAL_GOVERNMENT_ORDER.filter((id) => requested.includes(id));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const ids = requestedIds(argv);
  console.log(`[ingest:local-gov] order=${ids.join(' -> ')}`);

  if (process.env.LOCAL_GOV_DRY_RUN === '1') {
    console.log('[ingest:local-gov] dry run; no fetch and no database change');
    return;
  }

  const mongoUrl = process.env.MONGO_URL;
  const databaseName = assertSeedTarget(mongoUrl);
  console.log(`[ingest:local-gov] target=${databaseName}`);

  const connectors: Connector[] = ids.map((id) => {
    const connector = getConnector(id);
    if (!connector) throw new Error(`connector not registered: ${id}`);
    if (connector.jurisdiction_level !== 'local') {
      throw new Error(`${id} is not a local-government connector`);
    }
    return connector;
  });

  await mongoose.connect(mongoUrl as string, { serverSelectionTimeoutMS: 5_000 });
  const failures: string[] = [];
  try {
    const beforeAll = await MeasureModel.countDocuments({});
    console.log(`[ingest:local-gov] before all_measures=${beforeAll}`);

    for (const connector of connectors) {
      const before = await MeasureModel.countDocuments({ source_id: connector.id });
      const started = Date.now();
      console.log(`[ingest:local-gov] START ${connector.id} (before=${before})`);
      const result = await runIngestion({ connectors: [connector] });
      const entry = result.results[0];
      const after = await MeasureModel.countDocuments({ source_id: connector.id });
      console.log(
        `[ingest:local-gov] DONE  ${connector.id} status=${entry.log_status} ` +
          `fetched=${entry.records_fetched} upserted=${entry.records_upserted} ` +
          `db_source_rows=${after} elapsed_ms=${Date.now() - started}`,
      );
      if (entry.errors.length > 0) {
        failures.push(`${connector.id}: ${entry.errors.join('; ')}`);
        console.log(`[ingest:local-gov] ERROR ${connector.id}: ${entry.errors.join('; ')}`);
      }
    }

    const afterAll = await MeasureModel.countDocuments({});
    const rows = await MeasureModel.aggregate([
      { $match: { source_id: { $in: ids } } },
      {
        $group: {
          _id: { source_id: '$source_id', source_dataset: '$source_dataset' },
          rows: { $sum: 1 },
        },
      },
      { $sort: { '_id.source_id': 1, '_id.source_dataset': 1 } },
    ]);
    console.log(
      `[ingest:local-gov] summary rows=${rows
        .map(
          (entry) =>
            `${String(entry._id.source_id)}=${entry.rows}:${String(entry._id.source_dataset)}`,
        )
        .join(',')} all_measures=${afterAll}`,
    );
    if (afterAll < beforeAll) {
      throw new Error(
        `local-government run decreased the measure count (${beforeAll} -> ${afterAll})`,
      );
    }
    if (failures.length > 0 && process.env.LOCAL_GOV_CONTINUE_ON_ERROR !== '1') {
      throw new Error(`local-government run completed with errors: ${failures.join(' | ')}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[ingest:local-gov] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
