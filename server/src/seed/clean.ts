import { SYNTHETIC_SOURCE } from '@ausspend/shared';
import { DataSourceModel, MeasureModel, RegionModel } from '../models/index.js';

/** The only source id the cleanup may ever touch. */
export const SYNTHETIC_SOURCE_ID = SYNTHETIC_SOURCE.source_id;

export interface CountByName {
  key: string;
  count: number;
}

export interface SyntheticInventory {
  source_id: string;
  /** Synthetic measure rows currently present. */
  measures: number;
  by_measure_type: CountByName[];
  by_fiscal_year: CountByName[];
  by_region: Array<{ region_id: string; code: string | null; level: string | null; count: number }>;
  by_function: CountByName[];
  /** Data-source register documents owned by the synthetic source. */
  data_source_records: number;
  /** Total measures in the database, synthetic and real. */
  total_measures: number;
  /** Measures that are not owned by the synthetic source. */
  non_synthetic_measures: number;
  /** Every other source id currently represented in the measures collection. */
  other_source_ids: string[];
}

export interface CleanResult {
  executed: boolean;
  before: SyntheticInventory;
  deleted: { measures: number; data_source_records: number };
  after: SyntheticInventory;
  /** Non-synthetic rows that survived (re-counted after any delete). */
  preserved_non_synthetic_measures: number;
}

/** Read-only inventory. Never writes. */
export async function inventorySynthetic(): Promise<SyntheticInventory> {
  const match = { source_id: SYNTHETIC_SOURCE_ID };

  const [
    measures,
    byType,
    byYear,
    byRegionRaw,
    byFunction,
    dataSourceRecords,
    totalMeasures,
    nonSynthetic,
    otherSourceIds,
    regions,
  ] = await Promise.all([
    MeasureModel.countDocuments(match),
    MeasureModel.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: '$measure_type', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    MeasureModel.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: '$fiscal_year', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    MeasureModel.aggregate<{ _id: unknown; count: number }>([
      { $match: match },
      { $group: { _id: '$region_id', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    MeasureModel.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: '$function_code', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    DataSourceModel.countDocuments({ source_id: SYNTHETIC_SOURCE_ID }),
    MeasureModel.countDocuments({}),
    MeasureModel.countDocuments({ source_id: { $ne: SYNTHETIC_SOURCE_ID } }),
    MeasureModel.distinct('source_id', { source_id: { $ne: SYNTHETIC_SOURCE_ID } }),
    RegionModel.find({}).lean(),
  ]);

  const regionById = new Map(regions.map((region) => [region._id.toString(), region]));

  return {
    source_id: SYNTHETIC_SOURCE_ID,
    measures,
    by_measure_type: byType.map((entry) => ({ key: entry._id, count: entry.count })),
    by_fiscal_year: byYear.map((entry) => ({ key: entry._id, count: entry.count })),
    by_region: byRegionRaw.map((entry) => {
      const id = entry._id === null || entry._id === undefined ? null : String(entry._id);
      const region = id ? regionById.get(id) : undefined;
      return {
        region_id: id ?? '(none)',
        code: region?.code ?? null,
        level: region?.level ?? null,
        count: entry.count,
      };
    }),
    by_function: byFunction.map((entry) => ({
      key: entry._id === null || entry._id === undefined ? '(none)' : String(entry._id),
      count: entry.count,
    })),
    data_source_records: dataSourceRecords,
    total_measures: totalMeasures,
    non_synthetic_measures: nonSynthetic,
    other_source_ids: (otherSourceIds as string[]).sort(),
  };
}

/**
 * Dry-run by default: it only reads and returns counts.
 *
 * With `execute: true` it requires a `verifyBackup` callback that resolves only
 * after a complete, recent, checksum-verified backup has been checked. The
 * writes are exactly two, both scoped to `source_id: 'synthetic-seed'`: delete
 * the synthetic measure rows and delete the synthetic data-source register
 * document. No other source or measure can be matched by these filters.
 */
export async function cleanSynthetic(
  options: { execute?: boolean; verifyBackup?: () => Promise<unknown> } = {},
): Promise<CleanResult> {
  const execute = options.execute === true;
  const before = await inventorySynthetic();

  if (!execute) {
    return {
      executed: false,
      before,
      deleted: { measures: 0, data_source_records: 0 },
      after: before,
      preserved_non_synthetic_measures: before.non_synthetic_measures,
    };
  }

  if (!options.verifyBackup) {
    throw new Error('Refusing to delete synthetic rows without a verified backup check');
  }
  await options.verifyBackup();

  const measureDelete = await MeasureModel.deleteMany({ source_id: SYNTHETIC_SOURCE_ID });
  const sourceDelete = await DataSourceModel.deleteOne({ source_id: SYNTHETIC_SOURCE_ID });
  const after = await inventorySynthetic();

  return {
    executed: true,
    before,
    deleted: {
      measures: measureDelete.deletedCount ?? 0,
      data_source_records: sourceDelete.deletedCount ?? 0,
    },
    after,
    preserved_non_synthetic_measures: after.non_synthetic_measures,
  };
}
