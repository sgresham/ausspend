import type { RequestHandler } from 'express';
import { MEASURE_TYPES, REGION_LEVELS } from '@ausspend/shared';
import { CONNECTORS, connectorSummary } from '../connectors/index.js';
import { pingDatabase, type DbStatus } from '../db.js';
import { DataSourceModel, FunctionModel, MeasureModel, RegionModel } from '../models/index.js';
import { HttpError } from './errors.js';

const LIMITATIONS = [
  'Synthetic development seed only: every value is a deterministic placeholder, not published Australian government spending.',
  'No verified records: every seeded measure carries verified: false.',
  'No live ingestion: all eight connectors are stubs and the API never calls them.',
  'COFOG function coverage is a curated subset (ten divisions with curated subdivisions), not exhaustive.',
  'Region granularity is national plus state/territory only; there are no sub-state regions yet.',
];

const NOTE =
  'Phase 1 coverage metadata. Treat every figure as synthetic and unverified until a real, sourced ingestion milestone lands.';

/**
 * Coverage banner payload. Reads counts from the live database and connector
 * metadata from the stub registry. Cached no longer than the request: every
 * response is generated fresh and marked `Cache-Control: no-store`.
 */
export function createCoverageHandler(
  pingDb: () => Promise<DbStatus> = pingDatabase,
): RequestHandler {
  return async (_req, res) => {
    const status = await pingDb();
    if (status !== 'connected') {
      throw new HttpError(503, 'Database unavailable: coverage metadata cannot be read');
    }

    const [
      dataSources,
      regions,
      functions,
      measures,
      rawFiscalYears,
      rawMeasureTypes,
      rawRegionLevels,
    ] = await Promise.all([
      DataSourceModel.countDocuments({}),
      RegionModel.countDocuments({}),
      FunctionModel.countDocuments({}),
      MeasureModel.countDocuments({}),
      MeasureModel.distinct('fiscal_year'),
      MeasureModel.distinct('measure_type'),
      RegionModel.distinct('level'),
    ]);
    const fiscalYears = rawFiscalYears as string[];
    const measureTypes = rawMeasureTypes as string[];
    const regionLevels = rawRegionLevels as string[];

    const levelRank = (level: string) => {
      const index = REGION_LEVELS.indexOf(level as (typeof REGION_LEVELS)[number]);
      return index === -1 ? REGION_LEVELS.length : index;
    };
    const typeRank = (type: string) => {
      const index = MEASURE_TYPES.indexOf(type as (typeof MEASURE_TYPES)[number]);
      return index === -1 ? MEASURE_TYPES.length : index;
    };

    res.set('Cache-Control', 'no-store');
    res.json({
      phase: 'Phase 1',
      synthetic: true,
      live_ingestion: false,
      generated_at: new Date().toISOString(),
      counts: {
        data_sources: dataSources,
        regions,
        functions,
        measures,
      },
      fiscal_years: fiscalYears.sort(),
      measure_types: measureTypes.sort((a, b) => typeRank(a) - typeRank(b)),
      region_levels: regionLevels.sort((a, b) => levelRank(a) - levelRank(b)),
      connectors: CONNECTORS.map(connectorSummary),
      limitations: LIMITATIONS,
      note: NOTE,
    });
  };
}
