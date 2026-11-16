import type { RequestHandler } from 'express';
import { MEASURE_TYPES, REGION_LEVELS } from '@ausspend/shared';
import { CONNECTORS, PBS_CAVEAT, connectorSummary } from '../connectors/index.js';
import { pingDatabase, type DbStatus } from '../db.js';
import {
  DataSourceModel,
  FunctionModel,
  IngestionLogModel,
  MeasureModel,
  RegionModel,
} from '../models/index.js';
import { HttpError } from './errors.js';

/** Federal sources that are registered but still waiting on a live connector. */
export const PENDING_FEDERAL_SOURCES = ['grantconnect'] as const;

function coverageLimitations(liveFederal: boolean, pbsLive: boolean): string[] {
  return [
    liveFederal
      ? 'Mixed data: live AusTender contract rows and PBS budget line items sit alongside the synthetic development seed. The seed values remain deterministic placeholders, not published Australian government spending.'
      : 'Synthetic development seed only: every value is a deterministic placeholder, not published Australian government spending.',
    'No records are human-verified: seeded measures, ingested AusTender contracts and ingested PBS budget rows all carry verified: false.',
    liveFederal
      ? 'AusTender OCDS contractPublished ingestion and data.gov.au PBS program-expense ingestion are live. GrantConnect is not implemented (pending stub); the eight other registered connectors are stubs and make no network call.'
      : 'No live ingestion has run yet: aus-tender, data-gov-au-pbs and grantconnect plus the eight other registered connectors are stubs; no request leaves the API until the runner runs.',
    pbsLive
      ? `${PBS_CAVEAT} PBS rows are programme/entity line items, not a single federal expense total.`
      : 'PBS (data.gov.au) budget line items are not ingested yet; the API exposes no PBS budget rows.',
    'COFOG function coverage is a curated subset (ten divisions with curated subdivisions), not exhaustive.',
    'Region granularity is national plus state/territory only. Federal contract rows may have no region or COFOG function; PBS rows are not geographically tagged (location.state is literally "Commonwealth"). Never an invented LGA/SA2/coordinate.',
    'NSW Budget 2025-26 rows come from the 12 official XLSX workbooks in the 14 November 2025 Wayback snapshot plus the ArcGIS Treasury_Project_Data_20260609_gdb layer. Financial/HFI values are $m/$b statement line items; capital projects are $000 Budgeted amounts. Negative net/deficit lines are skipped, not sign-flipped, and missing LGAs are left absent (statewide_only), never inferred.',
    "data.nsw.gov.au CKAN ingestion is targeted: nine discovery searches and a small selected dataset set, never the whole ~16,907-dataset portal. CSV/XLSX downloads and DataStore pages are archived with SHA-256. PDF/DOC/DOCX resources are deferred to the separate PDF foundation and are listed on the source. Units are explicit where CKAN states one; NSW Budget Paper 2 capital allocations are provisionally treated as $'000 and fleet spend as $, and measure types are never summed.",
  ];
}

const NOTE =
  'Coverage metadata is generated from the connector registry and the live ingestion records. AusTender contract rows and PBS budget line items are real published records and remain unverified; synthetic seed rows are placeholders. Never sum across measure types, and never present a PBS line-item total as the federal total.';

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
      dataSourceDocs,
      regions,
      functions,
      measures,
      rawFiscalYears,
      rawMeasureTypes,
      rawRegionLevels,
      latestLogs,
    ] = await Promise.all([
      DataSourceModel.find({}).lean(),
      RegionModel.countDocuments({}),
      FunctionModel.countDocuments({}),
      MeasureModel.countDocuments({}),
      MeasureModel.distinct('fiscal_year'),
      MeasureModel.distinct('measure_type'),
      RegionModel.distinct('level'),
      IngestionLogModel.find({}).sort({ finished_at: -1 }).limit(20).lean(),
    ]);
    const dataSources = dataSourceDocs.length;
    const dataSourceById = new Map(dataSourceDocs.map((source) => [source.source_id, source]));
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

    // Prefer the persisted per-source state (written by the runner) over the
    // process-local connector metadata, so a fresh API process still reports
    // the real last-ingested status.
    const connectors = CONNECTORS.map((connector) => {
      const summary = connectorSummary(connector);
      const stored = dataSourceById.get(connector.id);
      if (!stored) return summary;
      return {
        ...summary,
        status: stored.status,
        last_fetched_at: stored.last_ingested_at
          ? new Date(stored.last_ingested_at).toISOString()
          : summary.last_fetched_at,
        records_ingested: stored.records_ingested,
        errors: stored.errors ?? [],
        deferred_resources: stored.deferred_resources ?? summary.deferred_resources,
      };
    });
    const connectorStatusCounts = {
      active: connectors.filter((connector) => connector.status === 'active').length,
      degraded: connectors.filter((connector) => connector.status === 'degraded').length,
      stub: connectors.filter((connector) => connector.status === 'stub').length,
    };
    const liveIngestion = connectorStatusCounts.active > 0;
    const pbsLive =
      connectors.find((connector) => connector.id === 'data-gov-au-pbs')?.status === 'active';
    const federalConnectors = connectors.filter(
      (connector) => connector.jurisdiction_level === 'federal',
    );
    const stateConnectors = connectors.filter(
      (connector) => connector.jurisdiction_level === 'state',
    );
    const pending: string[] = [...PENDING_FEDERAL_SOURCES];
    const ausTender = dataSourceById.get('aus-tender');
    const pbs = dataSourceById.get('data-gov-au-pbs');
    const nswCkan = dataSourceById.get('data-nsw-ckan');
    const stateLive = stateConnectors.some((connector) => connector.status === 'active');

    res.set('Cache-Control', 'no-store');
    res.json({
      phase: liveIngestion
        ? pbsLive
          ? stateLive
            ? 'Phase 1 + F2/F3 + S1/S2 (AusTender + PBS + NSW live)'
            : 'Phase 1 + F2/F3 (AusTender + PBS live)'
          : 'Phase 1 + F2 (AusTender live)'
        : 'Phase 1',
      synthetic: true,
      // Derived from persisted ingestion state: no active connector means no
      // live ingestion has happened.
      live_ingestion: liveIngestion,
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
      federal_ingestion: {
        live: federalConnectors
          .filter((connector) => connector.status === 'active')
          .map((connector) => connector.id),
        degraded: federalConnectors
          .filter((connector) => connector.status === 'degraded')
          .map((connector) => connector.id),
        pending,
        stubs: federalConnectors
          .filter((connector) => connector.status === 'stub' && !pending.includes(connector.id))
          .map((connector) => connector.id),
        aus_tender_last_ingested_at: ausTender?.last_ingested_at
          ? new Date(ausTender.last_ingested_at).toISOString()
          : null,
        pbs_last_ingested_at: pbs?.last_ingested_at
          ? new Date(pbs.last_ingested_at).toISOString()
          : null,
        pbs_caveat: PBS_CAVEAT,
        note: liveIngestion
          ? 'AusTender OCDS contracts and data.gov.au PBS budget line items are live. GrantConnect remains pending; every other source is a stub. PBS line items do not sum to the Budget Paper 1 total general government expense.'
          : 'No federal source is live yet. AusTender, PBS and GrantConnect are pending.',
      },
      state_ingestion: {
        live: stateConnectors
          .filter((connector) => connector.status === 'active')
          .map((connector) => connector.id),
        degraded: stateConnectors
          .filter((connector) => connector.status === 'degraded')
          .map((connector) => connector.id),
        stubs: stateConnectors
          .filter((connector) => connector.status === 'stub')
          .map((connector) => connector.id),
        nsw_ckan_last_ingested_at: nswCkan?.last_ingested_at
          ? new Date(nswCkan.last_ingested_at).toISOString()
          : null,
        deferred_resources: nswCkan?.deferred_resources ?? [],
        note: 'NSW Budget 2025-26 Open Data (official Wayback XLSX copy + ArcGIS capital projects) and targeted data.nsw.gov.au CKAN datasets are live. CKAN CSV/XLSX downloads and DataStore pages are archived with SHA-256; PDF/DOCX resources are deferred and listed here, not ingested. Victoria, Queensland and Western Australia remain stubs. NSW Budget rows are Budgeted/estimate/actual statement line items, never spent amounts, and measure types are never summed.',
      },
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
      limitations: coverageLimitations(liveIngestion, pbsLive),
      note: NOTE,
    });
  };
}
