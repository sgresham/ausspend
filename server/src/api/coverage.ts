import type { RequestHandler } from 'express';
import { MEASURE_TYPES, REGION_LEVELS, SYNTHETIC_SOURCE } from '@ausspend/shared';
import {
  ABS_GFS_BENCHMARK_CAVEAT,
  ABS_GFS_ID,
  ABS_GFS_PNFC_BENCHMARK_CAVEAT,
  ABS_GFS_PNFC_ID,
  CONNECTORS,
  GRANTCONNECT_MANUAL_EXPORT_CAVEAT,
  PBS_CAVEAT,
  SYDNEY_WATER_CAVEAT,
  SYDNEY_WATER_ENTITY,
  SYDNEY_WATER_ID,
  SYDNEY_WATER_JURISDICTION,
  SYDNEY_WATER_UNIT,
  SYDNEY_WATER_UNIT_LABEL,
  connectorSummary,
} from '../connectors/index.js';
import { pingDatabase, type DbStatus } from '../db.js';
import {
  DataSourceModel,
  FunctionModel,
  IngestionLogModel,
  MeasureModel,
  RegionModel,
} from '../models/index.js';
import { HttpError } from './errors.js';
import { AREA_NOT_COVERED } from './area-profile.js';

/** Federal sources that are registered but still waiting on a live connector. */
export const PENDING_FEDERAL_SOURCES = [] as const;

/** Real-feed gaps that the synthetic seed used to paper over. */
export const COVERAGE_GAPS = [
  {
    dimension: 'national actual / budget / estimate project series with COFOG and region',
    status: 'partial',
    detail:
      'ABS GFS Annual 2024-25 supplies a top-down national and state/local COFOG-A expense benchmark (Key Tables 9/10). It is an official statistical aggregate, not project-level spending, has no curated region below the state, and is never summed with project data. PBS is budget only and programme-level; no source supplies a national project-level actual series broken down by COFOG and region.',
  },
  {
    dimension: 'state/territory actual / estimate with COFOG and region',
    status: 'missing',
    detail:
      'No state/territory feed provides actual or estimate expenditure tagged to both a COFOG function and a curated region. NSW Budget is budget/actual statement lines for NSW only and is not COFOG-complete; VIC Budget 2026-27 is COFOG-A but budget-only and statewide, with no region; QLD BP3/BP4 is project/measure budget data with no COFOG and no curated region; the QLD QGIP expenditure series is actual grant/contract spend with no COFOG function and only statewide or service-delivery postcode/suburb/LGA location.',
  },
  {
    dimension: 'state/territory coverage',
    status: 'partial',
    detail:
      'NSW (NSW Budget, targeted data.nsw.gov.au CKAN and Dubbo), VIC (VIC Budget 2026-27 COFOG-A additive expenses plus non-additive DTF agency detail) and QLD (BP3 capital projects additive; BP4 policy measures non-additive; QGIP actual grant awards plus procured frontline services, kept as separate measure types and never summed; no COFOG, provisional). WA, SA, TAS, ACT and NT have no real state spending feed.',
  },
  {
    dimension: 'sub-state region coverage',
    status: 'partial',
    detail:
      'Exactly one council, Dubbo Regional Council. No other local council is covered and no LGA/SA2/coordinate is invented.',
  },
  {
    dimension: 'charity expenses (ACNC)',
    status: 'partial',
    detail:
      'ACNC AIS charity expenses are actual reported expenses of ACNC-registered charities, not government spending. They have no COFOG function, are not comparable to government actual/budget measures, and the total-expenses row is never summed with its component expense categories.',
  },
  {
    dimension: 'federal contracts (AusTender) with COFOG and region',
    status: 'partial',
    detail:
      'AusTender contract rows have no COFOG function and no curated region; only location.state is present. They can never substitute for a function-by-region spending series.',
  },
  {
    dimension: 'PBS with region',
    status: 'partial',
    detail:
      'PBS has a COFOG-A function for the defensible portfolios but no region: location.state is literally "Commonwealth".',
  },
] as const;

function coverageLimitations(
  liveFederal: boolean,
  pbsLive: boolean,
  syntheticMeasures: number,
): string[] {
  const syntheticLine =
    syntheticMeasures > 0
      ? liveFederal
        ? 'Mixed data: live AusTender contract rows and PBS budget line items sit alongside the synthetic development seed. The seed values remain deterministic placeholders, not published Australian government spending.'
        : 'Synthetic development seed only: every value is a deterministic placeholder, not published Australian government spending.'
      : 'No synthetic seed rows are present. Real feeds are live for AusTender contracts, PBS budget line items, NSW Budget/selected data.nsw.gov.au CKAN rows, VIC/QLD Budget rows, QLD QGIP, Dubbo council, GrantConnect awards, ACNC charity expenses and the ABS GFS COFOG-A benchmark, but they do not cover national/state actual or estimate expenditure with COFOG and region at project level; those dimensions correctly show "no real data for this dimension yet" rather than a placeholder or zero.';

  return [
    syntheticLine,
    'Synthetic and ingested project rows are unverified: seeded measures, AusTender contracts, PBS budget rows, state budget/project rows and charity rows carry verified: false. The only verified rows are the official ABS GFS COFOG-A aggregates (aggregation_role "benchmark"), which are top-down benchmarks and are never added to project data.',
    liveFederal
      ? 'AusTender OCDS contractPublished ingestion and data.gov.au PBS program-expense ingestion are live. GrantConnect is a manual, SHA-256-archived DownloadResult export import (no API and no scraper): a wide export above the 50,000-result cap is rejected and partial chunk coverage is reported honestly. The eight other registered connectors are stubs and make no network call.'
      : 'No live ingestion has run yet: aus-tender, data-gov-au-pbs and grantconnect plus the eight other registered connectors are stubs; no request leaves the API until the runner runs.',
    pbsLive
      ? `${PBS_CAVEAT} PBS rows are programme/entity line items, not a single federal expense total.`
      : 'PBS (data.gov.au) budget line items are not ingested yet; the API exposes no PBS budget rows.',
    'ABS GFS Annual 2024-25 is a COFOG-A expense benchmark from the official XLSX (Key Tables 9/10). The ABS SDMX API has no GFS/COFOG dataflow, so no SDMX query is used. Every GFS row is a published official aggregate (verified: true, aggregation_role "benchmark") at federal/state/local level; it is never project-level and is never summed with project data, across levels or across measure types. The benchmark is exposed separately at /api/benchmark and excluded from the generic spending/search queries.',
    'ABS GFS Public Non-Financial Corporations (PNFC) is a separate sector benchmark from nine official Annual 2024-25 XLSX data cubes (Australia all levels plus the eight states/territories). The ABS SDMX API has no PNFC/GFS dataflow, so no SDMX query is used. Only the published Total GFS revenue and Total GFS expenses rows are ingested, as separate flows, with jurisdiction_level "pnfc", verified: true and aggregation_role "benchmark". It is a sector aggregate, exposed only at /api/benchmark/pnfc and excluded from generic spending/search: never add it to SOC/entity, government, charity or project data, and never sum across jurisdictions or revenue/expense flows.',
    'NSW SOC (phase 2) covers one state-owned corporation only: Sydney Water Corporation. Its latest annual report is discovered from Sydney Water\'s annual-report page (no hard-coded PDF URL), SHA-256 archived outside the repo, and read as an entity-level statement (jurisdiction_level "soc", aggregation_role "agency_detail"). The printed unit is explicit $’000; total expenses is the exact sum of the two printed expense totals (finance costs + other expenses) and is accepted only when the statement profit-before-tax bridge and both Note 2 subtotals reconcile exactly. Every row is provisional and unverified. SOC rows are exposed only at /api/soc and are never added to government program spending, to the PNFC benchmark, or to each other; rows whose funding_source names a government agency/contribution are flagged potential_double_count. No other SOC, no VIC/QLD SOC, no BP1 Chapter 9 and no project/LGA/coordinate is covered.',
    'ACNC charity expenses are reported by registered charities, not government. They are jurisdiction_level "charity", have no COFOG function, and are never merged with federal/state/local spending. Every charity row has an explicit expense_category; total-expenses rows (aggregation_role expense_total) and component rows (expense_component) are never summed together. State/postcode comes only from AIS program operating locations, is single-state only and is flagged location_approximate.',
    'COFOG function coverage is a curated subset (ten divisions with curated subdivisions), not exhaustive.',
    'Region granularity is national plus state/territory plus one S3 sub-state region (Dubbo, level "region", parent NSW). No other local council or other state has a connector. Federal contract rows may have no region or COFOG function; PBS rows are not geographically tagged (location.state is literally "Commonwealth"). Never an invented LGA/SA2/coordinate.',
    'NSW Budget 2025-26 rows come from the 12 official XLSX workbooks in the 14 November 2025 Wayback snapshot plus the ArcGIS Treasury_Project_Data_20260609_gdb layer. Financial/HFI values are $m/$b statement line items; capital projects are $000 Budgeted amounts. Negative net/deficit lines are skipped, not sign-flipped, and missing LGAs are left absent (statewide_only), never inferred.',
    "data.nsw.gov.au CKAN ingestion is targeted: nine discovery searches and a small selected dataset set, never the whole ~16,907-dataset portal. CSV/XLSX downloads and DataStore pages are archived with SHA-256. PDF/DOC/DOCX resources are deferred to the separate PDF foundation and are listed on the source. Units are explicit where CKAN states one; NSW Budget Paper 2 capital allocations are provisionally treated as $'000 and fleet spend as $, and measure types are never summed.",
    "Victoria: VIC Budget 2026-27 DataVic CKAN workbooks. The COFOG-A general government sector expenses workbook states '($ million)' and supplies 2025-26 and 2026-27 budget columns mapped to the nine shared COFOG divisions plus Transport tagged 045 (VIC reports Transport separately; 045 must not be rolled into 04). The Department of Treasury and Finance statement is also SHA-256 archived and ingested as 8 non-additive agency-detail rows (`aggregation_role: agency_detail`), excluded from every additive total. Both workbooks are archived outside the repo. Transport is stored as 045 with `transport_mapping_unconfirmed`; a human must confirm whether VIC's separate Transport COFOG major group should map to 045 and never be rolled into 04. Figures are Budgeted, not audited actuals, and are statewide only; no VIC region, capital program or other department is ingested.",
    "Queensland: QLD Budget 2026-27 data.qld CKAN BP3 Capital Statement and BP4 Budget Measures CSVs, plus the BP3 data dictionary, BP4 data dictionary and BP4 explanatory notes, all SHA-256 archived outside the repo. Units are confirmed by the dictionaries as $'000 (x100,000 cents), never inferred. BP3 contributes 943 additive project-level capital rows with Portfolio/Agency, SA4 text and raw coordinates in notes; BP4 contributes 108 expense/capital policy measures marked `aggregation_role: policy_measure` and excluded from every additive total because BP4 decisions overlap the BP3 capital program (7 project names appear in both). BP4 revenue measures and blank/zero/negative 2026-27 amounts are excluded. No COFOG function is defensible; every row is provisional, statewide QLD. The additive QLD series is BP3 only; BP4 is shown separately as non-additive policy detail. The separate QLD QGIP source adds actual 2024-25 grant awards and procured frontline services from the consolidated expenditure CSV plus its archived data dictionary: units are whole AUD per the dictionary, funding_source is the QLD funding agency, only Grant (grant_award) and Frontline service procurement (contract) are ingested (Concession, Loan and Direct government investment are rejected, as are zero-dollar rows), location is statewide or the supplied service-delivery postcode/suburb/LGA, and grants and contracts are never summed.",
    "S3 covers exactly one council: Dubbo Regional Council's adopted 2026/27 budget PDF (archived with SHA-256). Summary tables use the printed ($000's) unit and reconcile their column totals; the capital program is dollars only after magnitude reconciliation against the explicit summary, and is rejected if category/group/grand totals disagree. Every local row is provisional and unverified. Area panels (local, NSW-wide state, NSW-tagged federal, Commonwealth-wide PBS) are never added together. All other councils and states/territories are not covered.",
    "GrantConnect is a manual file import only: the public DownloadResult XLSX is downloaded by a human, archived with SHA-256, and parsed from the 'Value (AUD)' dollars column. No API, no live scraper and no paid adaptor is used. The export caps a wide search at 'more than 50000 results'; any file carrying that warning is rejected (never partially imported), and the source is partial until complete date-range chunks cover the target period. Rows carry verified:false and provisional data-quality flags; the export supplies no recipient location.",
  ];
}

const NOTE =
  'Coverage metadata is generated from the connector registry and the live ingestion records. Real AusTender/PBS/state/charity rows are published records and remain unverified; legacy synthetic seed rows, when present, are placeholders. Never sum across measure types, and never present a PBS line-item total as the federal total.';

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
      syntheticMeasures,
      realMeasures,
    ] = await Promise.all([
      DataSourceModel.find({}).lean(),
      RegionModel.countDocuments({}),
      FunctionModel.countDocuments({}),
      MeasureModel.countDocuments({}),
      MeasureModel.distinct('fiscal_year'),
      MeasureModel.distinct('measure_type'),
      RegionModel.distinct('level'),
      IngestionLogModel.find({}).sort({ finished_at: -1 }).limit(20).lean(),
      MeasureModel.countDocuments({ source_id: SYNTHETIC_SOURCE.source_id }),
      MeasureModel.countDocuments({ source_id: { $ne: SYNTHETIC_SOURCE.source_id } }),
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
    const grantconnect = dataSourceById.get('grantconnect');
    const nswCkan = dataSourceById.get('data-nsw-ckan');
    const vicBudget = dataSourceById.get('vic-budget');
    const qldBudget = dataSourceById.get('qld-budget');
    const qldQgip = dataSourceById.get('qld-qgip');
    const stateLive = stateConnectors.some((connector) => connector.status === 'active');
    const localConnectors = connectors.filter(
      (connector) => connector.jurisdiction_level === 'local',
    );
    const dubbo = dataSourceById.get('dubbo-council');
    const localLive = localConnectors.some((connector) => connector.status === 'active');
    const charityConnectors = connectors.filter(
      (connector) => connector.jurisdiction_level === 'charity',
    );
    const acnc = dataSourceById.get('acnc-charity');
    const charityLive = charityConnectors.some((connector) => connector.status === 'active');
    const absGfs = dataSourceById.get(ABS_GFS_ID);
    const benchmarkLive = absGfs?.status === 'active' || absGfs?.status === 'degraded';
    const absGfsPnfc = dataSourceById.get(ABS_GFS_PNFC_ID);
    const pnfcBenchmarkLive = absGfsPnfc?.status === 'active' || absGfsPnfc?.status === 'degraded';
    const sydneyWater = dataSourceById.get(SYDNEY_WATER_ID);
    const socLive = sydneyWater?.status === 'active' || sydneyWater?.status === 'degraded';
    const phaseBase = liveIngestion
      ? pbsLive
        ? stateLive
          ? localLive
            ? 'Phase 1 + F2/F3 + S1/S2/S3 + Phase 4 (AusTender + PBS + NSW/VIC/QLD + Dubbo live)'
            : 'Phase 1 + F2/F3 + S1/S2 + Phase 4 (AusTender + PBS + NSW/VIC/QLD live)'
          : 'Phase 1 + F2/F3 (AusTender + PBS live)'
        : 'Phase 1 + F2 (AusTender live)'
      : 'Phase 1';

    res.set('Cache-Control', 'no-store');
    res.json({
      phase: [
        charityLive ? `${phaseBase} + ACNC charity` : phaseBase,
        benchmarkLive ? '+ ABS GFS benchmark' : null,
        pnfcBenchmarkLive ? '+ ABS GFS PNFC benchmark' : null,
        socLive ? '+ NSW SOC (Sydney Water)' : null,
      ]
        .filter(Boolean)
        .join(' '),
      // Derived from the live measures collection, not a hard-coded flag: after
      // `clean:synthetic` this becomes false automatically.
      synthetic: syntheticMeasures > 0,
      synthetic_measures: syntheticMeasures,
      real_measures: realMeasures,
      // Derived from persisted ingestion state: no active connector means no
      // live ingestion has happened.
      live_ingestion: liveIngestion,
      generated_at: new Date().toISOString(),
      counts: {
        data_sources: dataSources,
        regions,
        functions,
        measures,
        synthetic_measures: syntheticMeasures,
        real_measures: realMeasures,
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
        grantconnect_last_ingested_at: grantconnect?.last_ingested_at
          ? new Date(grantconnect.last_ingested_at).toISOString()
          : null,
        grantconnect_records: grantconnect?.records_ingested ?? 0,
        grantconnect_caveat: GRANTCONNECT_MANUAL_EXPORT_CAVEAT,
        grantconnect_note: grantconnect?.notes ?? GRANTCONNECT_MANUAL_EXPORT_CAVEAT,
        note: liveIngestion
          ? 'AusTender OCDS contracts, data.gov.au PBS budget line items and the ABS GFS COFOG-A benchmark are live. GrantConnect is a manual, capped DownloadResult export import (SHA-256 archived; no API/scraper) and is partial until complete date-range chunks cover the period. Every other source is a stub. PBS line items do not sum to the Budget Paper 1 total general government expense, and ABS GFS is a top-down benchmark that is never added to project data.'
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
        vic_budget_last_ingested_at: vicBudget?.last_ingested_at
          ? new Date(vicBudget.last_ingested_at).toISOString()
          : null,
        qld_budget_last_ingested_at: qldBudget?.last_ingested_at
          ? new Date(qldBudget.last_ingested_at).toISOString()
          : null,
        qld_qgip_last_ingested_at: qldQgip?.last_ingested_at
          ? new Date(qldQgip.last_ingested_at).toISOString()
          : null,
        qld_qgip_records: qldQgip?.records_ingested ?? 0,
        deferred_resources: nswCkan?.deferred_resources ?? [],
        note: "NSW Budget 2025-26 Open Data (official Wayback XLSX copy + ArcGIS capital projects), targeted data.nsw.gov.au CKAN datasets, VIC Budget 2026-27 DataVic CKAN workbooks, QLD Budget 2026-27 BP3/BP4 CSVs and the QLD QGIP 2024-25 consolidated expenditure CSV are live. Downloads are archived with SHA-256; PDF/DOCX resources are deferred and listed here, not ingested. Western Australia remains a stub. NSW, VIC and QLD budget rows are Budgeted/estimate/actual statement line items or budget measures, never spent amounts; VIC is budget-column only with non-additive DTF detail and unconfirmed Transport 045; QLD BP3/BP4 is $'000 BP3 additive capital plus non-additive BP4 policy measures with no COFOG; QGIP is actual whole-dollar grant awards and procured frontline services, with funding_source the QLD agency and no COFOG, and grants and contracts are separate measure types that are never summed. Measure types are never summed.",
      },
      charity_ingestion: {
        live: charityConnectors
          .filter((connector) => connector.status === 'active')
          .map((connector) => connector.id),
        degraded: charityConnectors
          .filter((connector) => connector.status === 'degraded')
          .map((connector) => connector.id),
        stubs: charityConnectors
          .filter((connector) => connector.status === 'stub')
          .map((connector) => connector.id),
        acnc_last_ingested_at: acnc?.last_ingested_at
          ? new Date(acnc.last_ingested_at).toISOString()
          : null,
        acnc_records: acnc?.records_ingested ?? 0,
        note: 'ACNC Annual Information Statement charity expenses are expenses only: jurisdiction_level "charity", no COFOG function, and never merged with government spending. Every row has an explicit expense_category; total and component rows are never summed together. The AIS spreadsheet has no address, so state/postcode comes only from AIS program operating locations, single-state only, flagged location_approximate. Source files are SHA-256 archived outside the repo.',
      },
      benchmark_ingestion: {
        live: benchmarkLive && absGfs ? [ABS_GFS_ID] : [],
        last_ingested_at: absGfs?.last_ingested_at
          ? new Date(absGfs.last_ingested_at).toISOString()
          : null,
        records: absGfs?.records_ingested ?? 0,
        caveat: ABS_GFS_BENCHMARK_CAVEAT,
        note: 'ABS GFS COFOG-A expense aggregates from the official Annual 2024-25 XLSX (Key Tables 9/10). The ABS SDMX API has no GFS/COFOG dataflow; this is the approved XLSX fallback. Rows are official aggregates (verified true, aggregation_role benchmark) at federal/state/local level and are exposed only through /api/benchmark. They are never project-level and are never summed with project data, across levels or across measure types.',
      },
      pnfc_benchmark_ingestion: {
        live: pnfcBenchmarkLive && absGfsPnfc ? [ABS_GFS_PNFC_ID] : [],
        last_ingested_at: absGfsPnfc?.last_ingested_at
          ? new Date(absGfsPnfc.last_ingested_at).toISOString()
          : null,
        records: absGfsPnfc?.records_ingested ?? 0,
        caveat: ABS_GFS_PNFC_BENCHMARK_CAVEAT,
        label: 'Sector aggregate — never add to project/entity data',
        note: 'ABS GFS Public Non-Financial Corporations operating statements from nine official Annual 2024-25 XLSX data cubes (Australia all levels plus the eight states/territories). The ABS SDMX API has no PNFC/GFS dataflow; this is the approved XLSX fallback. Only the published Total GFS revenue and Total GFS expenses rows are ingested, as separate flows. Every row is jurisdiction_level "pnfc", verified true, aggregation_role benchmark, and is exposed only through /api/benchmark/pnfc. It is a sector aggregate, never added to SOC/entity, government, charity or project data, and never summed across jurisdictions or flows.',
      },
      soc_ingestion: {
        live: socLive && sydneyWater ? [SYDNEY_WATER_ID] : [],
        degraded: sydneyWater?.status === 'degraded' ? [SYDNEY_WATER_ID] : [],
        last_ingested_at: sydneyWater?.last_ingested_at
          ? new Date(sydneyWater.last_ingested_at).toISOString()
          : null,
        records: sydneyWater?.records_ingested ?? 0,
        entity: SYDNEY_WATER_ENTITY,
        jurisdiction: SYDNEY_WATER_JURISDICTION,
        unit: SYDNEY_WATER_UNIT,
        unit_label: SYDNEY_WATER_UNIT_LABEL,
        caveat: SYDNEY_WATER_CAVEAT,
        label: 'SOC entity statement — never add to government program spending',
        note: 'Entity-level NSW State Owned Corporation statement lines from Sydney Water\'s latest annual report. The PDF is discovered from the official annual-report page (no hard-coded URL), SHA-256 archived outside the repo, and parsed only when the printed $’000 unit is explicit and total expenses reconciles exactly to the printed profit-before-tax bridge. Rows are jurisdiction_level "soc", aggregation_role "agency_detail", provisional and unverified. SOC rows are exposed only at /api/soc; they are never added to government program spending, the PNFC benchmark, or each other. Government-named funding rows carry potential_double_count.',
      },
      local_ingestion: {
        live: localConnectors
          .filter((connector) => connector.status === 'active')
          .map((connector) => connector.id),
        degraded: localConnectors
          .filter((connector) => connector.status === 'degraded')
          .map((connector) => connector.id),
        stubs: localConnectors
          .filter((connector) => connector.status === 'stub')
          .map((connector) => connector.id),
        dubbo_last_ingested_at: dubbo?.last_ingested_at
          ? new Date(dubbo.last_ingested_at).toISOString()
          : null,
        note: 'S3 covers one local council only: Dubbo Regional Council (source dubbo-council). Its adopted budget/capital PDF is archived and every row is provisional and unverified. Area panels are local, NSW-wide state, NSW-tagged federal AusTender and Commonwealth-wide PBS; they are not additive. No other council is covered.',
        not_covered: AREA_NOT_COVERED,
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
      limitations: coverageLimitations(liveIngestion, pbsLive, syntheticMeasures),
      coverage_gaps: COVERAGE_GAPS,
      note: NOTE,
    });
  };
}
