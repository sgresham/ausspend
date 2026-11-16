import type { RequestHandler } from 'express';
import { MEASURE_TYPES, REGION_LEVELS } from '@ausspend/shared';
import { CONNECTORS, connectorSummary } from '../connectors/index.js';
import { pingDatabase, type DbStatus } from '../db.js';
import {
  DataSourceModel,
  FunctionModel,
  IngestionLogModel,
  MeasureModel,
  RegionModel,
} from '../models/index.js';
import { HttpError } from './errors.js';

const LIMITATIONS = [
  'Synthetic development seed only: every value is a deterministic placeholder, not published Australian government spending.',
  'No verified records: every seeded measure carries verified: false.',
  'No live ingestion yet: the three federal source connectors (aus-tender, data-gov-au-pbs, grantconnect) and the eight other registered connectors are stubs; no request leaves the API.',
  'COFOG function coverage is a curated subset (ten divisions with curated subdivisions), not exhaustive.',
  'Region granularity is national plus state/territory only; federal source records may have no region or COFOG function at all.',
];

const NOTE =
  'Phase 1 coverage metadata. Treat every figure as synthetic and unverified until a real, sourced ingestion milestone lands.';

/**
 * Coverage banner payload. Reads counts from the live database, connector
 * metadata from the registry and the latest ingestion logs. No response is
 * cached: every request is generated fresh and marked `Cache-Control: no-store`.
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
      latestLogs,
    ] = await Promise.all([
      DataSourceModel.countDocuments({}),
      RegionModel.countDocuments({}),
      FunctionModel.countDocuments({}),
      MeasureModel.countDocuments({}),
      MeasureModel.distinct('fiscal_year'),
      MeasureModel.distinct('measure_type'),
      RegionModel.distinct('level'),
      IngestionLogModel.find({}).sort({ finished_at: -1 }).limit(20).lean(),
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

    const connectors = CONNECTORS.map(connectorSummary);
    const connectorStatusCounts = {
      active: connectors.filter((connector) => connector.status === 'active').length,
      degraded: connectors.filter((connector) => connector.status === 'degraded').length,
      stub: connectors.filter((connector) => connector.status === 'stub').length,
    };

    res.set('Cache-Control', 'no-store');
    res.json({
      phase: 'Phase 1',
      synthetic: true,
      // Derived from real connector status: no active connector means no live
      // ingestion has happened.
      live_ingestion: connectorStatusCounts.active > 0,
      generated_at: new Date().toISOString(),
      counts: {
        data_sources: dataSources,
        regions,
        functions,
        measures,
      },
      fiscal_years: fiscalYears.sort(),
      measure_types: measureTypes.sort((a, b) => typeRank(a) - typeRank(b)),
      supported_measure_types: [...MEASURE_TYPES],
      region_levels: regionLevels.sort((a, b) => levelRank(a) - levelRank(b)),
      connectors,
      connector_status_counts: connectorStatusCounts,
      ingestion: {
        latest_logs: latestLogs.map((log) => ({
          source_id: log.source_id,
          started_at: log.started_at,
          finished_at: log.finished_at,
          status: log.status,
          records_fetched: log.records_fetched,
          records_upserted: log.records_upserted,
          errors: log.errors,
          ...(log.message ? { message: log.message } : {}),
        })),
      },
      limitations: LIMITATIONS,
      note: NOTE,
    });
  };
}
