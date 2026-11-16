import 'dotenv/config';
import mongoose from 'mongoose';
import {
  AUSTRALIAN_REGIONS,
  COFOG_DIVISIONS,
  COFOG_SUBDIVISIONS,
  SYNTHETIC_SOURCE,
  type FunctionRecord,
} from '@ausspend/shared';
import {
  DataSourceModel,
  FunctionModel,
  MeasureModel,
  RegionModel,
} from '../server/src/models/index.js';
import { assertSeedTarget } from '../server/src/seed/guard.js';

const FISCAL_YEARS = ['2023-24', '2024-25', '2025-26'] as const;
const MEASURE_TYPES = ['actual', 'budget', 'estimate'] as const;

/** Indicative annual scale per COFOG division, in whole dollars. */
const DIVISION_BASE_DOLLARS: Record<string, number> = {
  '01': 2_000_000_000,
  '02': 1_600_000_000,
  '03': 1_100_000_000,
  '04': 2_400_000_000,
  '05': 520_000_000,
  '06': 760_000_000,
  '07': 3_100_000_000,
  '08': 430_000_000,
  '09': 2_900_000_000,
  '10': 4_200_000_000,
};

/** Rough population scale so state rows differ plausibly. */
const REGION_SCALE: Record<string, number> = {
  AUS: 3.6,
  NSW: 1,
  VIC: 0.85,
  QLD: 0.75,
  WA: 0.5,
  SA: 0.35,
  TAS: 0.12,
  ACT: 0.1,
  NT: 0.08,
};

const MEASURE_SCALE: Record<(typeof MEASURE_TYPES)[number], number> = {
  actual: 1,
  budget: 1.05,
  estimate: 0.97,
};

function hash(value: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return h >>> 0;
}

/** Deterministic 0.85–1.15 jitter so repeated seeds produce identical rows. */
function jitter(key: string): number {
  return 0.85 + (hash(key) % 3001) / 10_000;
}

function amountCents(
  regionCode: string,
  divisionCode: string,
  yearIndex: number,
  measureType: (typeof MEASURE_TYPES)[number],
): number {
  const base = DIVISION_BASE_DOLLARS[divisionCode] ?? 1_000_000_000;
  const dollars =
    base *
    (REGION_SCALE[regionCode] ?? 0.5) *
    MEASURE_SCALE[measureType] *
    1.03 ** yearIndex *
    jitter(`${regionCode}:${divisionCode}:${yearIndex}:${measureType}`);
  return Math.round(dollars * 100);
}

function buildFunctions(): FunctionRecord[] {
  const divisions: FunctionRecord[] = COFOG_DIVISIONS.map((division) => ({
    code: division.code,
    name: division.name,
    level: 'division',
  }));

  const subdivisions: FunctionRecord[] = COFOG_SUBDIVISIONS.map((subdivision) => ({
    code: subdivision.code,
    name: subdivision.name,
    level: 'subdivision',
    parent_code: subdivision.parent_code,
  }));

  return [...divisions, ...subdivisions];
}

async function main(): Promise<void> {
  const databaseName = assertSeedTarget(process.env.MONGO_URL);
  const mongoUrl = process.env.MONGO_URL as string;

  console.log(`[seed] target database: ${databaseName} (synthetic development data only)`);

  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 5_000 });

  try {
    // Reset only the seed-owned collections in ausspend_dev; the database and
    // any other collections are left alone.
    await Promise.all([
      MeasureModel.deleteMany({}),
      FunctionModel.deleteMany({}),
      RegionModel.deleteMany({}),
      DataSourceModel.deleteMany({}),
    ]);

    await DataSourceModel.create({ ...SYNTHETIC_SOURCE });
    await RegionModel.insertMany(AUSTRALIAN_REGIONS.map((region) => ({ ...region })));

    const regionDocs = await RegionModel.find({}).lean();
    const regionIdByCode = new Map(regionDocs.map((region) => [region.code, region._id]));

    await FunctionModel.insertMany(buildFunctions());

    const measures = [];
    for (const region of AUSTRALIAN_REGIONS) {
      const regionId = regionIdByCode.get(region.code);
      if (!regionId) throw new Error(`missing seeded region ${region.code}`);

      for (const division of COFOG_DIVISIONS) {
        for (const [yearIndex, fiscalYear] of FISCAL_YEARS.entries()) {
          for (const measureType of MEASURE_TYPES) {
            measures.push({
              region_id: regionId,
              function_code: division.code,
              amount_cents: amountCents(region.code, division.code, yearIndex, measureType),
              measure_type: measureType,
              fiscal_year: fiscalYear,
              source_id: SYNTHETIC_SOURCE.source_id,
              source_url: SYNTHETIC_SOURCE.source_url,
              verified: false,
              notes: 'Synthetic development value; not real spending.',
            });
          }
        }
      }
    }
    await MeasureModel.insertMany(measures);

    const [sources, regions, functions, measureCount, verifiedMeasures] = await Promise.all([
      DataSourceModel.countDocuments({}),
      RegionModel.countDocuments({}),
      FunctionModel.countDocuments({}),
      MeasureModel.countDocuments({}),
      MeasureModel.countDocuments({ verified: true }),
    ]);

    console.log(
      `[seed] sources=${sources} regions=${regions} functions=${functions} measures=${measureCount}`,
    );
    console.log(`[seed] verified measures: ${verifiedMeasures} (must be 0)`);

    if (verifiedMeasures !== 0) {
      throw new Error('seed produced verified measures; refusing to report success');
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`[seed] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
