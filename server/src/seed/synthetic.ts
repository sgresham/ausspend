import mongoose from 'mongoose';
import {
  AUSTRALIAN_REGIONS,
  COFOG_DIVISIONS,
  COFOG_SUBDIVISIONS,
  SYNTHETIC_SOURCE,
  type FunctionRecord,
} from '@ausspend/shared';
import { DataSourceModel, FunctionModel, MeasureModel, RegionModel } from '../models/index.js';

const FISCAL_YEARS = ['2023-24', '2024-25', '2025-26'] as const;
const MEASURE_TYPES = ['actual', 'budget', 'estimate'] as const;

/** 9 regions × 10 divisions × 3 fiscal years × 3 measure types. */
export const SYNTHETIC_MEASURE_COUNT =
  AUSTRALIAN_REGIONS.length * COFOG_DIVISIONS.length * FISCAL_YEARS.length * MEASURE_TYPES.length;

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

export interface SeedSummary {
  databaseName: string | null;
  reset: boolean;
  sources: number;
  regions: number;
  functions: number;
  measures: number;
  verifiedMeasures: number;
  syntheticMeasures: number;
  nonSyntheticMeasures: number;
}

/**
 * Destructive reset: drop every measure, function, region and data source. This
 * is the old seed behaviour and is only reachable through the explicit
 * `--reset` flag (`npm run seed -- --reset`); never on a normal seed.
 */
export async function destructiveReset(): Promise<void> {
  await Promise.all([
    MeasureModel.deleteMany({}),
    FunctionModel.deleteMany({}),
    RegionModel.deleteMany({}),
    DataSourceModel.deleteMany({}),
  ]);
}

/**
 * Install the synthetic development data. Assumes mongoose is already connected.
 *
 * Safe by default: only rows owned by `synthetic-seed` are replaced, and the
 * synthetic source record is upserted. Ingested rows (`aus-tender`), other data
 * sources and every ingestion log survive untouched. `reset: true` runs the
 * destructive reset first and is only wired to the explicit CLI flag.
 */
export async function seedSyntheticData(options: { reset?: boolean } = {}): Promise<SeedSummary> {
  const reset = options.reset === true;
  const databaseName: string | null = mongoose.connection.name ?? null;

  if (reset) {
    await destructiveReset();
  } else {
    // Remove only the rows this seed owns. Federal ingestion rows have a
    // different source_id and must never be deleted by a restart.
    await MeasureModel.deleteMany({ source_id: SYNTHETIC_SOURCE.source_id });
  }

  // Upsert rather than delete: other sources' registers and any ingestion logs
  // are preserved on a normal seed.
  await DataSourceModel.updateOne(
    { source_id: SYNTHETIC_SOURCE.source_id },
    { $set: { ...SYNTHETIC_SOURCE } },
    { upsert: true },
  );
  await RegionModel.bulkWrite(
    AUSTRALIAN_REGIONS.map((region) => ({
      updateOne: {
        filter: { code: region.code },
        update: { $set: { ...region } },
        upsert: true,
      },
    })),
  );
  await FunctionModel.bulkWrite(
    buildFunctions().map((fn) => ({
      updateOne: {
        filter: { code: fn.code },
        update: { $set: { ...fn } },
        upsert: true,
      },
    })),
  );

  const regionDocs = await RegionModel.find({}).lean();
  const regionIdByCode = new Map(regionDocs.map((region) => [region.code, region._id]));

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

  const [
    sources,
    regions,
    functions,
    measuresCount,
    verifiedMeasures,
    syntheticMeasures,
    nonSyntheticMeasures,
  ] = await Promise.all([
    DataSourceModel.countDocuments({}),
    RegionModel.countDocuments({}),
    FunctionModel.countDocuments({}),
    MeasureModel.countDocuments({}),
    MeasureModel.countDocuments({ verified: true }),
    MeasureModel.countDocuments({ source_id: SYNTHETIC_SOURCE.source_id }),
    MeasureModel.countDocuments({ source_id: { $ne: SYNTHETIC_SOURCE.source_id } }),
  ]);

  if (syntheticMeasures !== SYNTHETIC_MEASURE_COUNT) {
    throw new Error(
      `seed wrote ${syntheticMeasures} synthetic measures, expected ${SYNTHETIC_MEASURE_COUNT}`,
    );
  }
  if (verifiedMeasures !== 0) {
    throw new Error('seed produced verified measures; refusing to report success');
  }

  return {
    databaseName,
    reset,
    sources,
    regions,
    functions,
    measures: measuresCount,
    verifiedMeasures,
    syntheticMeasures,
    nonSyntheticMeasures,
  };
}
