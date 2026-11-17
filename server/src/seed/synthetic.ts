import mongoose from 'mongoose';
import {
  AUSTRALIAN_REGIONS,
  COFOG_DIVISIONS,
  COFOG_SUBDIVISIONS,
  SYNTHETIC_SOURCE,
  type FunctionRecord,
} from '@ausspend/shared';
import { DataSourceModel, FunctionModel, MeasureModel, RegionModel } from '../models/index.js';
import { CONNECTORS } from '../connectors/index.js';

/**
 * `real` is the default: it boots the taxonomy and the real source register and
 * writes no synthetic measure rows at all. `synthetic` is the historical
 * development seed and is now an explicit opt-in only.
 */
export type SeedMode = 'synthetic' | 'real';

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
  mode: SeedMode;
  reset: boolean;
  sources: number;
  regions: number;
  functions: number;
  measures: number;
  verifiedMeasures: number;
  syntheticMeasures: number;
  /** Rows this run inserted; always 0 in real-only mode. */
  syntheticMeasuresWritten: number;
  nonSyntheticMeasures: number;
}

/**
 * Register every real connector source without overwriting an existing record.
 * Used by real-only seeding so `/api/data-sources` still has real provenance
 * entries after the synthetic seed is retired. `$setOnInsert` keeps an active
 * source's ingestion state intact.
 */
async function registerRealSources(): Promise<void> {
  const retrievedAt = new Date().toISOString();
  await Promise.all(
    CONNECTORS.map((connector) =>
      DataSourceModel.updateOne(
        { source_id: connector.id },
        {
          $setOnInsert: {
            source_id: connector.id,
            name: connector.name,
            publisher: connector.publisher,
            source_url: connector.source_url,
            retrieved_at: retrievedAt,
            license: connector.license ?? 'Not yet verified — see connector metadata',
            verified: false,
            ...(connector.notes ? { notes: connector.notes } : {}),
            status: 'stub',
            last_ingested_at: null,
            records_ingested: 0,
            errors: [],
            deferred_resources: connector.deferredResources ?? [],
          },
        },
        { upsert: true },
      ),
    ),
  );
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
 * Install the development data. Assumes mongoose is already connected.
 *
 * `mode: 'real'` (the default) registers the real connector sources and the
 * taxonomy but writes no synthetic measure rows and never deletes existing live
 * (or legacy synthetic) rows. `mode: 'synthetic'` is an explicit opt-in and
 * replaces only rows owned by `synthetic-seed`. Ingested rows (`aus-tender`),
 * other data sources and every ingestion log survive untouched. `reset: true`
 * runs the destructive reset first and is only wired to the explicit CLI flag.
 */
export async function seedSyntheticData(
  options: { reset?: boolean; mode?: SeedMode } = {},
): Promise<SeedSummary> {
  const reset = options.reset === true;
  const mode: SeedMode = options.mode === 'synthetic' ? 'synthetic' : 'real';
  const databaseName: string | null = mongoose.connection.name ?? null;

  if (reset) {
    await destructiveReset();
  } else if (mode === 'synthetic') {
    // Remove only the rows this seed owns. Federal ingestion rows have a
    // different source_id and must never be deleted by a restart.
    await MeasureModel.deleteMany({ source_id: SYNTHETIC_SOURCE.source_id });
  }
  // Real-only mode deliberately leaves any existing synthetic rows in place:
  // removal is a separate, backed-up operation (`npm run clean:synthetic`).

  if (mode === 'synthetic') {
    // Upsert rather than delete: other sources' registers and any ingestion
    // logs are preserved on a normal seed.
    await DataSourceModel.updateOne(
      { source_id: SYNTHETIC_SOURCE.source_id },
      { $set: { ...SYNTHETIC_SOURCE } },
      { upsert: true },
    );
  } else {
    await registerRealSources();
  }
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

  let syntheticMeasuresWritten = 0;
  if (mode === 'synthetic') {
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
    syntheticMeasuresWritten = measures.length;
  }

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

  if (mode === 'synthetic' && syntheticMeasures !== SYNTHETIC_MEASURE_COUNT) {
    throw new Error(
      `seed wrote ${syntheticMeasures} synthetic measures, expected ${SYNTHETIC_MEASURE_COUNT}`,
    );
  }
  if (mode === 'real' && syntheticMeasuresWritten !== 0) {
    throw new Error(`real-only seed wrote ${syntheticMeasuresWritten} synthetic measures`);
  }
  if (verifiedMeasures !== 0) {
    throw new Error('seed produced verified measures; refusing to report success');
  }

  return {
    databaseName,
    mode,
    reset,
    sources,
    regions,
    functions,
    measures: measuresCount,
    verifiedMeasures,
    syntheticMeasures,
    syntheticMeasuresWritten,
    nonSyntheticMeasures,
  };
}
