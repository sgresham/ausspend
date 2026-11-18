import type { RequestHandler } from 'express';
import { MEASURE_TYPES, REGION_LEVELS, SYNTHETIC_SOURCE } from '@ausspend/shared';
import {
  ABS_GFS_BENCHMARK_CAVEAT,
  ABS_GFS_ID,
  ABS_GFS_PNFC_BENCHMARK_CAVEAT,
  ABS_GFS_PNFC_ID,
  CONNECTORS,
  ESSENTIAL_ENERGY_CAVEAT,
  ESSENTIAL_ENERGY_ENTITY,
  ESSENTIAL_ENERGY_ID,
  ESSENTIAL_ENERGY_JURISDICTION,
  ESSENTIAL_ENERGY_UNIT,
  ESSENTIAL_ENERGY_UNIT_LABEL,
  FORESTRY_CORPORATION_CAVEAT,
  FORESTRY_CORPORATION_ENTITY,
  FORESTRY_CORPORATION_ID,
  FORESTRY_CORPORATION_JURISDICTION,
  FORESTRY_CORPORATION_UNIT,
  FORESTRY_CORPORATION_UNIT_LABEL,
  GRANTCONNECT_MANUAL_EXPORT_CAVEAT,
  HUNTER_WATER_CAVEAT,
  HUNTER_WATER_ENTITY,
  HUNTER_WATER_ID,
  HUNTER_WATER_JURISDICTION,
  HUNTER_WATER_UNIT,
  HUNTER_WATER_UNIT_LABEL,
  LANDCOM_CAVEAT,
  LANDCOM_ENTITY,
  LANDCOM_ID,
  LANDCOM_JURISDICTION,
  LANDCOM_UNIT,
  LANDCOM_UNIT_LABEL,
  PORT_AUTHORITY_CAVEAT,
  PORT_AUTHORITY_ENTITY,
  PORT_AUTHORITY_ID,
  PORT_AUTHORITY_JURISDICTION,
  PORT_AUTHORITY_UNIT,
  PORT_AUTHORITY_UNIT_LABEL,
  PBS_CAVEAT,
  SYDNEY_WATER_CAVEAT,
  SYDNEY_WATER_ENTITY,
  SYDNEY_WATER_ID,
  SYDNEY_WATER_JURISDICTION,
  SYDNEY_WATER_UNIT,
  SYDNEY_WATER_UNIT_LABEL,
  SYDNEY_TRAINS_CAVEAT,
  SYDNEY_TRAINS_ENTITY,
  SYDNEY_TRAINS_ID,
  SYDNEY_TRAINS_JURISDICTION,
  SYDNEY_TRAINS_UNIT,
  SYDNEY_TRAINS_UNIT_LABEL,
  NSW_TRAINLINK_CAVEAT,
  NSW_TRAINLINK_ENTITY,
  NSW_TRAINLINK_ID,
  NSW_TRAINLINK_JURISDICTION,
  NSW_TRAINLINK_UNIT,
  NSW_TRAINLINK_UNIT_LABEL,
  TAHE_CAVEAT,
  TAHE_ENTITY,
  TAHE_ID,
  TAHE_JURISDICTION,
  TAHE_UNIT,
  TAHE_UNIT_LABEL,
  WATERNSW_CAVEAT,
  WATERNSW_ENTITY,
  WATERNSW_ID,
  WATERNSW_JURISDICTION,
  WATERNSW_UNIT,
  WATERNSW_UNIT_LABEL,
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
import { TRADE_COVERAGE } from './meta.js';

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
      'NSW (NSW Budget, targeted data.nsw.gov.au CKAN and Dubbo), VIC (VIC Budget 2026-27 COFOG-A additive expenses plus non-additive DTF agency detail), QLD (BP3 capital projects additive; BP4 policy measures non-additive; QGIP actual grant awards plus procured frontline services, kept as separate measure types and never summed; no COFOG, provisional), WA (2016-17 EFO policy/asset tables, provisional, custom licence), SA (GFS expenses by GPC/economic type, COFOG-mapped, 2012-13..2015-16), ACT (Socrata capital-works budget, project x year), TAS (2026-27 BP1 Table 9.16 COFOG-A, budget/estimate columns), and NT (2026-27 BP4 COFOG-A capital works). TAS/NT are document-extracted and provisional. No state/territory source provides COFOG and a curated sub-state region together.',
  },
  {
    dimension: 'sub-state region coverage',
    status: 'partial',
    detail:
      'Exactly one council has a curated sub-state region: Dubbo Regional Council, whose adopted budget (245 budget/estimate rows) and audited FY2024-25 GPFS (18 non-additive actual rows) are covered under region "Dubbo". The City of Sydney, Blacktown City Council, City of Parramatta, Northern Beaches Council, Canterbury-Bankstown Council, Sutherland Shire Council, Wollongong City Council, Newcastle City Council, Lake Macquarie City Council and Maitland City Council GPFS rows are council-level actuals with no region/LGA allocation, so they are not mapped into any region. No LGA/SA2/coordinate is invented.',
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
      ? 'AusTender OCDS contractPublished ingestion and data.gov.au PBS program-expense ingestion are live. GrantConnect is a manual, SHA-256-archived DownloadResult export import (no API and no scraper): a wide export above the 50,000-result cap is rejected and partial chunk coverage is reported honestly. AIHW health expenditure is live from the current 2024-25 supplementary tables (2022-23..2024-25, 1,747 COFOG-07 rows) because METEOR is metadata-only; government (federal/state) and non-government funding are separate, non-additive agency detail. The two remaining registered federal connectors (federal-budget-portal and aofm) are stubs and make no network call.'
      : 'No live ingestion has run yet: aus-tender, data-gov-au-pbs and grantconnect plus the eight other registered connectors are stubs; no request leaves the API until the runner runs.',
    pbsLive
      ? `${PBS_CAVEAT} PBS rows are programme/entity line items, not a single federal expense total.`
      : 'PBS (data.gov.au) budget line items are not ingested yet; the API exposes no PBS budget rows.',
    'ABS GFS Annual 2024-25 is a COFOG-A expense benchmark from the official XLSX (Key Tables 9/10). The ABS SDMX API has no GFS/COFOG dataflow, so no SDMX query is used. Every GFS row is a published official aggregate (verified: true, aggregation_role "benchmark") at federal/state/local level; it is never project-level and is never summed with project data, across levels or across measure types. The benchmark is exposed separately at /api/benchmark and excluded from the generic spending/search queries.',
    'ABS GFS Public Non-Financial Corporations (PNFC) is a separate sector benchmark from nine official Annual 2024-25 XLSX data cubes (Australia all levels plus the eight states/territories). The ABS SDMX API has no PNFC/GFS dataflow, so no SDMX query is used. Only the published Total GFS revenue and Total GFS expenses rows are ingested, as separate flows, with jurisdiction_level "pnfc", verified: true and aggregation_role "benchmark". It is a sector aggregate, exposed only at /api/benchmark/pnfc and excluded from generic spending/search: never add it to SOC/entity, government, charity or project data, and never sum across jurisdictions or revenue/expense flows.',
    'NSW SOC (phase 2) covers one state-owned corporation only: Sydney Water Corporation. Its latest annual report is discovered from Sydney Water\'s annual-report page (no hard-coded PDF URL), SHA-256 archived outside the repo, and read as an entity-level statement (jurisdiction_level "soc", aggregation_role "agency_detail"). The printed unit is explicit $’000; total expenses is the exact sum of the two printed expense totals (finance costs + other expenses) and is accepted only when the statement profit-before-tax bridge and both Note 2 subtotals reconcile exactly. Every row is provisional and unverified. SOC rows are exposed only at /api/soc and are never added to government program spending, to the PNFC benchmark, or to each other; rows whose funding_source names a government agency/contribution are flagged potential_double_count. NSW SOC phase 4 adds a third entity, Hunter Water Corporation: the same discovery/SHA-256/$’000 gate, an explicit printed Total expenses accepted only when its printed components, the Note 3 operational-expenses subtotal and the profit-before-tax bridge reconcile exactly, with a one-dollar printed tax/NPAT rounding retained only as the printed net result and flagged for human spot-check. NSW SOC phase 5 adds a fourth entity, Essential Energy: the same discovery/SHA-256 gate with an explicit $M unit, and a total-expenses figure that is the exact sum of the printed expense lines (the statement has no single Total expenses subtotal) accepted only when the revenue, EBITDA/EBIT, expense-component and profit-before-tax/net-result bridges reconcile exactly; the printed loss is retained with a negative printed sign and two lines are flagged for human spot-check. NSW SOC phase 6 adds a fifth entity, Forestry Corporation of NSW: the same discovery/SHA-256 gate with an explicit $\'000 unit, an explicit printed Total expenses accepted only when the four printed expense lines, Note 5 Other income, Note 8 Other operating expenses, Note 9 Employee benefits and Note 10 Finance costs sum to their printed subtotals and the profit-before-tax/net-result bridges reconcile exactly; two grant lines are flagged potential_double_count and two lines are flagged for human spot-check. NSW SOC phase 7 adds a sixth entity, Landcom: the same discovery/SHA-256 gate with an explicit $’000 unit; the statement prints no Total revenue or Total expenses subtotal, so both are the exact signed sums of the printed statement lines, accepted only when the gross-profit, profit-before-tax, net-result and Note 2.2/2.3/2.4/2.5/2.6 bridges reconcile exactly; one grant-income line is flagged potential_double_count and two lines are flagged for human spot-check. No other SOC, no VIC/QLD SOC, no BP1 Chapter 9 and no project/LGA/coordinate is covered.',
    'ACNC charity expenses are reported by registered charities, not government. They are jurisdiction_level "charity", have no COFOG function, and are never merged with federal/state/local spending. Every charity row has an explicit expense_category; total-expenses rows (aggregation_role expense_total) and component rows (expense_component) are never summed together. State/postcode comes only from AIS program operating locations, is single-state only and is flagged location_approximate.',
    'COFOG function coverage is a curated subset (ten divisions with curated subdivisions), not exhaustive.',
    'Region granularity is national plus state/territory plus one S3 sub-state region (Dubbo, level "region", parent NSW). No other local council or other state has a connector. Federal contract rows may have no region or COFOG function; PBS rows are not geographically tagged (location.state is literally "Commonwealth"). Never an invented LGA/SA2/coordinate.',
    'NSW Budget 2025-26 rows come from the 12 official XLSX workbooks in the 14 November 2025 Wayback snapshot plus the ArcGIS Treasury_Project_Data_20260609_gdb layer. Financial/HFI values are $m/$b statement line items; capital projects are $000 Budgeted amounts. Negative net/deficit lines are skipped, not sign-flipped, and missing LGAs are left absent (statewide_only), never inferred.',
    "data.nsw.gov.au CKAN ingestion is targeted: nine discovery searches and a small selected dataset set, never the whole ~16,907-dataset portal. CSV/XLSX downloads and DataStore pages are archived with SHA-256. PDF/DOC/DOCX resources are deferred to the separate PDF foundation and are listed on the source. Units are explicit where CKAN states one; NSW Budget Paper 2 capital allocations are provisionally treated as $'000 and fleet spend as $, and measure types are never summed.",
    "Victoria: VIC Budget 2026-27 DataVic CKAN workbooks. The COFOG-A general government sector expenses workbook states '($ million)' and supplies 2025-26 and 2026-27 budget columns mapped to the nine shared COFOG divisions plus Transport tagged 045 (VIC reports Transport separately; 045 must not be rolled into 04). The Department of Treasury and Finance statement is also SHA-256 archived and ingested as 8 non-additive agency-detail rows (`aggregation_role: agency_detail`), excluded from every additive total. Both workbooks are archived outside the repo. By human decision (2026-11-18) VIC's separate Transport COFOG major group maps to the shared subdivision 045; it is not a child of the Economic affairs 04 row, 04 excludes transport, and 045 must never be rolled into or added to 04. Both Transport rows carry `data_quality_flag: statewide_only`. Figures are Budgeted, not audited actuals, and are statewide only; no VIC region, capital program or other department is ingested.",
    "Queensland: QLD Budget 2026-27 data.qld CKAN BP3 Capital Statement and BP4 Budget Measures CSVs, plus the BP3 data dictionary, BP4 data dictionary and BP4 explanatory notes, all SHA-256 archived outside the repo. Units are confirmed by the dictionaries as $'000 (x100,000 cents), never inferred. BP3 contributes 943 additive project-level capital rows with Portfolio/Agency, SA4 text and raw coordinates in notes; BP4 contributes 108 expense/capital policy measures marked `aggregation_role: policy_measure` and excluded from every additive total because BP4 decisions overlap the BP3 capital program (7 project names appear in both). BP4 revenue measures and blank/zero/negative 2026-27 amounts are excluded. No COFOG function is defensible; every row is provisional, statewide QLD. The additive QLD series is BP3 only; BP4 is shown separately as non-additive policy detail. The separate QLD QGIP source adds actual grant awards and procured frontline services for 2018-19 to 2024-25 from one consolidated expenditure CSV per fiscal year plus the archived data dictionary: units are whole AUD per the dictionary, funding_source is the QLD funding agency, only Grant (grant_award) and Frontline service procurement (contract) are ingested (Concession, Loan and Direct government investment are rejected, as are zero-dollar rows), location is statewide or the supplied service-delivery postcode/suburb/LGA, and grants and contracts are never summed and years are never merged. 2020-21 uses only the corrected updated-DTMR file. 2019-20 is partial because the publisher left the annual payment blank on 22,530 of 27,308 rows; only published annual payments are stored and every 2019-20 row is flagged, and the cumulative total-to-date is never added to or substituted for an annual payment.",
    "Victoria local government (VIC council pilot A): the VLGGC 2024-25 VGC1 Expenditure and Revenue questionnaire covers all 79 Victorian councils at income-statement function/nature granularity. It is a council-supplied, unaudited questionnaire, not the audited GPFS; every row is `aggregation_role: agency_detail`, `data_quality_flag: provisional/local_government`, `statement: income`, `verified: false`, and is never added to any total or to vic-budget, ABS GFS, LGPRF, waste or NSW council data. The workbook's source Totals row is suppressed; no cross-council total is published. VLGGC is attribution/permission, NOT a CC licence: content should be attributed as Victorian Local Government Grants Commission data collection, and the source workbook is not redistributed. Whole AUD is converted explicitly to cents at x100. City of Greater Bendigo FY2024-25 total expenditure $252,760,999.96 and total revenue $277,002,000.17 reconcile to its audited GPFS ($252,761k / $277,002k) at the printed $1,000 rounding (expenses -4c, revenue +17c); only those two Bendigo totals are marked `reconciled_to_gpfs`, every other row remains `questionnaire_unaudited`. VGC1 functions/natures are not COFOG. ABS1 capital, ABS2-3 balance sheets, the 79 individual GPFS PDFs and other states are not covered by this source.",
    'Victoria local government (VIC council pilot B): the VLGGC 2024-25 ABS1 Capital Outlays and Sales and ABS2-3 Balance Sheets and Other Finances workbooks add 9,059 non-additive rows across the same 79 Victorian councils (capital 1,173; balance 2,709; cash-flow 3,157; income 2,020). Every row is `source_id: vic-vlgc-abs`, `aggregation_role: agency_detail`, `data_quality_flag: provisional/local_government`, `verified: false`, with `statement` (capital/balance/cash_flow/income), `statement_section`, `statement_line`, `asset_class` where applicable and `reconciliation_status`. The four source Totals rows are suppressed; no cross-council total is emitted. VLGGC is attribution/permission, NOT a CC licence; the workbooks are not redistributed. Whole AUD is converted explicitly to cents at x100. City of Greater Bendigo FY2024-25 total assets $2,595,603,000, liabilities $123,597,000 and equity $2,472,006,000 reconcile exactly to its audited GPFS (`reconciled_to_gpfs`); ABS1 total capital outlays $56,221,353.20 carry a documented $473,353.20 (0.85%) accrual/cash bridge to the GPFS cash-flow payments ($55,748k) and equality is never forced (`bridged_to_gpfs_cash_flow`). Every other category row remains `questionnaire_unaudited`. ABS functions/asset classes are not COFOG. Never mixed with VGC1, vic-budget, ABS GFS, LGPRF, waste or NSW council data; the 79 individual GPFS PDFs and other states are not covered by this source.',
    'Victoria local government (VIC council pilot C): the VLGGC historical VGC1 and ABS1/ABS2-3 series for FY2019-20 to FY2023-24 add 27,099 VGC1 and 44,548 ABS non-additive rows (71,647 total) across all 79 councils under the existing `vic-vlgc-vgc1` and `vic-vlgc-abs` source ids. Every row carries a per-year `fiscal_year`, and the natural key includes it, so the same council/line in two years never collides and the 2024-25 pilot rows keep their own keys. Each year suppresses every source Totals row (11 VGC1 + 4 ABS) and publishes no cross-council total; functions, natures, asset classes, statement sections and years are never summed. The historical VGC1 `E-*` tabs are mapped from their first printed `<function> Total` nature block. All rows remain `aggregation_role: agency_detail`, `data_quality_flag: provisional/local_government`, `verified: false`, `jurisdiction_level: local`, `jurisdiction: VIC`; VLGGC is attribution/permission, NOT a CC licence and no workbook is redistributed. Council totals reconcile to each workbook Totals row within 1 cent; City of Greater Bendigo FY2023-24 expenditure $240,485,023.18 and revenue $245,114,475.92 match the audited GPFS ($240,484k / $245,112k) within $1,023.18 / $2,475.92 (documented, never forced), and only those two rows carry `reconciled_to_gpfs`. FY2015-16 to FY2018-19 are added by VIC council pilot D, so all nine historical years are landed; no year is deferred. Never mixed with vic-budget, ABS GFS, LGPRF, waste or NSW council data.',
    'Victoria local government (VIC council pilot D): the remaining VLGGC historical years FY2015-16 to FY2018-19 add 21,715 VGC1 and 35,309 ABS non-additive rows (57,024 total) across all 79 councils, so all nine years FY2015-16..FY2023-24 are now landed. Every row keeps a per-year `fiscal_year` and natural key; every year suppresses 11 VGC1 + 4 ABS source Totals rows; no cross-council or cross-year total is created. The older VGC1 total sheets print the singular `Family & Community Service` header and the older ABS2 `Balance Sheets` workbook has 144 columns (no lease-liability line), so the connector selects an explicit legacy layout rather than assuming 2024-25 columns. Each year reconciles to its workbook Totals row within 1 cent. VLGGC is attribution/permission, NOT a CC licence; derived rows only and no workbook is redistributed. Every row remains `aggregation_role: agency_detail`, `data_quality_flag: provisional/local_government`, `verified: false`, `jurisdiction_level: local`, `jurisdiction: VIC`. Never mixed with vic-budget, ABS GFS, LGPRF, waste or NSW council data.',
    "S3 covers eleven local councils as separate non-additive sources: Dubbo Regional Council, the City of Sydney, Blacktown City Council, City of Parramatta, Northern Beaches Council, Canterbury-Bankstown Council, Sutherland Shire Council, Wollongong City Council, Newcastle City Council, Lake Macquarie City Council and Maitland City Council. Dubbo's adopted 2026/27 budget PDF (source dubbo-council) is archived with SHA-256; summary tables use the printed ($000's) unit and reconcile their column totals, and the capital program is dollars only after magnitude reconciliation against the explicit summary. The GPFS pilot adds Dubbo's audited FY2024-25 General Purpose Financial Statements as a separate source (dubbo-council-gpfs): the PDF is discovered from the official reporting page (no hard-coded document URL), SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and OLG FY2024-25 totals reconcile exactly. The GPFS expansion adds the City of Sydney's audited FY2024-25 General Purpose Financial Statements as a separate source (city-of-sydney-gpfs), Blacktown City Council's audited FY2024-25 General Purpose Financial Statements as a separate source (blacktown-gpfs), the City of Parramatta's audited FY2024-25 General Purpose Financial Statements as a separate source (parramatta-gpfs) Northern Beaches Council's audited FY2024-25 General Purpose Financial Statements as a separate source (northern-beaches-gpfs) Canterbury-Bankstown Council's audited FY2024-25 General Purpose Financial Statements as a separate source (canterbury-bankstown-gpfs) Sutherland Shire Council's audited FY2024-25 General Purpose Financial Statements as a separate source (sutherland-shire-gpfs) and Wollongong City Council's audited FY2024-25 General Purpose Financial Statements as a separate source (wollongong-gpfs, discovered and downloaded through the documented headless Chromium/Playwright path because the site's Cloudflare managed challenge returns HTTP 403 to non-browser clients) and Newcastle City Council's audited FY2024-25 General Purpose Financial Statements as a separate source (newcastle-gpfs, discovered from the council's official General Purpose Financial Statements page over plain HTTP) Lake Macquarie City Council's audited FY2024-25 General Purpose Financial Statements as a separate source (lake-macquarie-gpfs, discovered and downloaded through the documented headless Chromium/Playwright path because Akamai returns HTTP 403 to direct HTTP) and Maitland City Council's audited FY2024-25 General Purpose Financial Statements as a separate source (maitland-gpfs, discovered from the council's official Financial reports and plans page over plain HTTP): each PDF is discovered from the council's official annual/financial-report page (no hard-coded document URL), SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every GPFS row is non-additive agency_detail, has no region/LGA allocation, and is never summed with the 245 dubbo-council budget/estimate rows, another council, any other council GPFS source or any state row. Every local row is provisional and unverified. Area panels (local, NSW-wide state, NSW-tagged federal, Commonwealth-wide PBS) are never added together. All other councils and states/territories are not covered.",
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
        fetch_strategy: stored.fetch_strategy ?? summary.fetch_strategy ?? null,
        last_successful_fetch: stored.last_successful_fetch
          ? new Date(stored.last_successful_fetch).toISOString()
          : null,
        staleness_days: stored.staleness_days ?? null,
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
    const aihw = connectors.find((connector) => connector.id === 'aihw-health-expenditure');
    const aihwLive = aihw?.status === 'active' || aihw?.status === 'degraded';
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
    const waBudget = dataSourceById.get('wa-budget');
    const saGfs = dataSourceById.get('sa-budget-gfs');
    const tasBudget = dataSourceById.get('tas-budget');
    const actBudget = dataSourceById.get('act-budget');
    const ntBudget = dataSourceById.get('nt-budget');
    const qldLocal = dataSourceById.get('qld-local-government');
    const stateLive = stateConnectors.some((connector) => connector.status === 'active');
    const territoryConnectors = connectors.filter(
      (connector) => connector.jurisdiction_level === 'territory',
    );
    const phase6Live = [
      'aihw-health-expenditure',
      'wa-budget',
      'sa-budget-gfs',
      'act-budget',
      'tas-budget',
      'nt-budget',
      'qld-local-government',
    ].some((id) => {
      const source = dataSourceById.get(id);
      return source?.status === 'active' || source?.status === 'degraded';
    });
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
    const waterNsw = dataSourceById.get(WATERNSW_ID);
    const hunterWater = dataSourceById.get(HUNTER_WATER_ID);
    const essentialEnergy = dataSourceById.get(ESSENTIAL_ENERGY_ID);
    const forestryCorporation = dataSourceById.get(FORESTRY_CORPORATION_ID);
    const landcom = dataSourceById.get(LANDCOM_ID);
    const portAuthority = dataSourceById.get(PORT_AUTHORITY_ID);
    const tahe = dataSourceById.get(TAHE_ID);
    const sydneyTrains = dataSourceById.get(SYDNEY_TRAINS_ID);
    const nswTrainlink = dataSourceById.get(NSW_TRAINLINK_ID);
    const socLiveIds = [
      SYDNEY_WATER_ID,
      WATERNSW_ID,
      HUNTER_WATER_ID,
      ESSENTIAL_ENERGY_ID,
      FORESTRY_CORPORATION_ID,
      LANDCOM_ID,
      PORT_AUTHORITY_ID,
      TAHE_ID,
      SYDNEY_TRAINS_ID,
      NSW_TRAINLINK_ID,
    ].filter((id) => {
      const source = dataSourceById.get(id);
      return source?.status === 'active' || source?.status === 'degraded';
    });
    const socLive = socLiveIds.length > 0;
    const socLastIngested = [
      sydneyWater?.last_ingested_at,
      waterNsw?.last_ingested_at,
      hunterWater?.last_ingested_at,
      essentialEnergy?.last_ingested_at,
      forestryCorporation?.last_ingested_at,
      landcom?.last_ingested_at,
      portAuthority?.last_ingested_at,
      tahe?.last_ingested_at,
      sydneyTrains?.last_ingested_at,
      nswTrainlink?.last_ingested_at,
    ]
      .filter((value) => value !== null && value !== undefined)
      .sort((a, b) => new Date(b as Date).getTime() - new Date(a as Date).getTime())[0];
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
        aihwLive ? '+ AIHW health expenditure' : null,
        phase6Live ? '+ Phase 6 (WA/SA/ACT/TAS/NT + QLD local)' : null,
        socLive
          ? `+ NSW SOC (${[
              socLiveIds.includes(SYDNEY_WATER_ID) ? 'Sydney Water' : null,
              socLiveIds.includes(WATERNSW_ID) ? 'WaterNSW' : null,
              socLiveIds.includes(HUNTER_WATER_ID) ? 'Hunter Water' : null,
              socLiveIds.includes(ESSENTIAL_ENERGY_ID) ? 'Essential Energy' : null,
              socLiveIds.includes(FORESTRY_CORPORATION_ID) ? 'Forestry Corporation of NSW' : null,
              socLiveIds.includes(LANDCOM_ID) ? 'Landcom' : null,
              socLiveIds.includes(PORT_AUTHORITY_ID) ? 'Port Authority of NSW' : null,
              socLiveIds.includes(TAHE_ID) ? 'TAHE' : null,
              socLiveIds.includes(SYDNEY_TRAINS_ID) ? 'Sydney Trains' : null,
              socLiveIds.includes(NSW_TRAINLINK_ID) ? 'NSW TrainLink' : null,
            ]
              .filter(Boolean)
              .join(' + ')})`
          : null,
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
          ? 'AusTender OCDS contracts, data.gov.au PBS budget line items, the ABS GFS COFOG-A benchmark and AIHW health expenditure are live. GrantConnect is a manual, capped DownloadResult export import (SHA-256 archived; no API/scraper) and is partial until complete date-range chunks cover the period. AIHW health expenditure uses the current 2024-25 supplementary tables (2022-23..2024-25, 1,747 COFOG-07 rows) because METEOR is metadata-only; its 1997-98..2011-12 data.gov.au CSV is superseded and is not shipped as current. Government (federal/state) and non-government funding are separate, non-additive series. The two remaining registered federal connectors (federal-budget-portal and aofm) are stubs. PBS line items do not sum to the Budget Paper 1 total general government expense, and ABS GFS is a top-down benchmark that is never added to project data.'
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
        wa_budget_last_ingested_at: waBudget?.last_ingested_at
          ? new Date(waBudget.last_ingested_at).toISOString()
          : null,
        sa_gfs_last_ingested_at: saGfs?.last_ingested_at
          ? new Date(saGfs.last_ingested_at).toISOString()
          : null,
        tas_budget_last_ingested_at: tasBudget?.last_ingested_at
          ? new Date(tasBudget.last_ingested_at).toISOString()
          : null,
        deferred_resources: nswCkan?.deferred_resources ?? [],
        note: 'NSW Budget 2025-26 Open Data, targeted data.nsw.gov.au CKAN datasets, VIC Budget 2026-27 DataVic workbooks, QLD Budget 2026-27 BP3/BP4 CSVs, the QLD QGIP consolidated expenditure CSVs, the 2016-17 WA Economic and Fiscal Outlook tables (custom Personal & Academic Use licence, provisional), the SA GFS expenses-by-GPC/economic-type workbook (COFOG-mapped, 2012-13..2015-16), and the 2026-27 TAS Budget Paper No. 1 Table 9.16 COFOG-A expense table (provisional) are active. There are no state-level stubs. ACT and NT are territory-level connectors and are reported separately under territory_ingestion. WA Chapter 5 rows are non-additive major spending changes and Chapter 6 is asset investment, so they are never summed; SA rows are one GPC function x economic-type component and the printed TOTAL row is never emitted; TAS Table 9.16 rows are provisional COFOG-A benchmark aggregates with the nominal-superannuation reconciliation line not mapped to COFOG. Downloads are archived with SHA-256; PDF/DOCX resources are deferred and listed here, not ingested. Measure types are never summed.',
      },
      territory_ingestion: {
        live: territoryConnectors
          .filter((connector) => connector.status === 'active')
          .map((connector) => connector.id),
        degraded: territoryConnectors
          .filter((connector) => connector.status === 'degraded')
          .map((connector) => connector.id),
        stubs: territoryConnectors
          .filter((connector) => connector.status === 'stub')
          .map((connector) => connector.id),
        act_budget_last_ingested_at: actBudget?.last_ingested_at
          ? new Date(actBudget.last_ingested_at).toISOString()
          : null,
        nt_budget_last_ingested_at: ntBudget?.last_ingested_at
          ? new Date(ntBudget.last_ingested_at).toISOString()
          : null,
        note: "ACT and NT are territory-level connectors. ACT Budget 2021-2022 Infrastructure Investment Program is a paged Socrata resource: 424 projects x five budgeted-financing years ($'000, budget measure, project-total column reconciliation-only). NT Budget 2026-27 Budget Paper No. 4 Table 3 is a Cloudflare-gated PDF: ten COFOG-A capital-works categories in $m, budget measure, provisional/medium-confidence extraction, with the printed $4,253.6m total reconciliation-only. Neither source has a state row or a sub-state region, and neither is summed with state or local data.",
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
        live: socLiveIds,
        degraded: [
          SYDNEY_WATER_ID,
          WATERNSW_ID,
          HUNTER_WATER_ID,
          ESSENTIAL_ENERGY_ID,
          FORESTRY_CORPORATION_ID,
          LANDCOM_ID,
          PORT_AUTHORITY_ID,
          TAHE_ID,
          SYDNEY_TRAINS_ID,
          NSW_TRAINLINK_ID,
        ].filter((id) => dataSourceById.get(id)?.status === 'degraded'),
        last_ingested_at: socLastIngested ? new Date(socLastIngested).toISOString() : null,
        // Row counts only; entity amounts are never combined into a total.
        records:
          (sydneyWater?.records_ingested ?? 0) +
          (waterNsw?.records_ingested ?? 0) +
          (hunterWater?.records_ingested ?? 0) +
          (essentialEnergy?.records_ingested ?? 0) +
          (forestryCorporation?.records_ingested ?? 0) +
          (landcom?.records_ingested ?? 0) +
          (portAuthority?.records_ingested ?? 0) +
          (tahe?.records_ingested ?? 0) +
          (sydneyTrains?.records_ingested ?? 0) +
          (nswTrainlink?.records_ingested ?? 0),
        // Kept for the single-source shape: the first SOC entity.
        entity: SYDNEY_WATER_ENTITY,
        jurisdiction: SYDNEY_WATER_JURISDICTION,
        unit: SYDNEY_WATER_UNIT,
        unit_label: SYDNEY_WATER_UNIT_LABEL,
        caveat: `${SYDNEY_WATER_CAVEAT} WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom, Port Authority of NSW, TAHE, Sydney Trains and NSW TrainLink are separate SOC entities; their rows are never added to Sydney Water's or to any other total.`,
        label: 'SOC entity statement — never add to government program spending',
        entities: [
          {
            source_id: SYDNEY_WATER_ID,
            entity: SYDNEY_WATER_ENTITY,
            jurisdiction: SYDNEY_WATER_JURISDICTION,
            unit: SYDNEY_WATER_UNIT,
            unit_label: SYDNEY_WATER_UNIT_LABEL,
            records: sydneyWater?.records_ingested ?? 0,
            last_ingested_at: sydneyWater?.last_ingested_at
              ? new Date(sydneyWater.last_ingested_at).toISOString()
              : null,
            caveat: SYDNEY_WATER_CAVEAT,
          },
          {
            source_id: WATERNSW_ID,
            entity: WATERNSW_ENTITY,
            jurisdiction: WATERNSW_JURISDICTION,
            unit: WATERNSW_UNIT,
            unit_label: WATERNSW_UNIT_LABEL,
            records: waterNsw?.records_ingested ?? 0,
            last_ingested_at: waterNsw?.last_ingested_at
              ? new Date(waterNsw.last_ingested_at).toISOString()
              : null,
            caveat: WATERNSW_CAVEAT,
          },
          {
            source_id: HUNTER_WATER_ID,
            entity: HUNTER_WATER_ENTITY,
            jurisdiction: HUNTER_WATER_JURISDICTION,
            unit: HUNTER_WATER_UNIT,
            unit_label: HUNTER_WATER_UNIT_LABEL,
            records: hunterWater?.records_ingested ?? 0,
            last_ingested_at: hunterWater?.last_ingested_at
              ? new Date(hunterWater.last_ingested_at).toISOString()
              : null,
            caveat: HUNTER_WATER_CAVEAT,
          },
          {
            source_id: ESSENTIAL_ENERGY_ID,
            entity: ESSENTIAL_ENERGY_ENTITY,
            jurisdiction: ESSENTIAL_ENERGY_JURISDICTION,
            unit: ESSENTIAL_ENERGY_UNIT,
            unit_label: ESSENTIAL_ENERGY_UNIT_LABEL,
            records: essentialEnergy?.records_ingested ?? 0,
            last_ingested_at: essentialEnergy?.last_ingested_at
              ? new Date(essentialEnergy.last_ingested_at).toISOString()
              : null,
            caveat: ESSENTIAL_ENERGY_CAVEAT,
          },
          {
            source_id: FORESTRY_CORPORATION_ID,
            entity: FORESTRY_CORPORATION_ENTITY,
            jurisdiction: FORESTRY_CORPORATION_JURISDICTION,
            unit: FORESTRY_CORPORATION_UNIT,
            unit_label: FORESTRY_CORPORATION_UNIT_LABEL,
            records: forestryCorporation?.records_ingested ?? 0,
            last_ingested_at: forestryCorporation?.last_ingested_at
              ? new Date(forestryCorporation.last_ingested_at).toISOString()
              : null,
            caveat: FORESTRY_CORPORATION_CAVEAT,
          },
          {
            source_id: LANDCOM_ID,
            entity: LANDCOM_ENTITY,
            jurisdiction: LANDCOM_JURISDICTION,
            unit: LANDCOM_UNIT,
            unit_label: LANDCOM_UNIT_LABEL,
            records: landcom?.records_ingested ?? 0,
            last_ingested_at: landcom?.last_ingested_at
              ? new Date(landcom.last_ingested_at).toISOString()
              : null,
            caveat: LANDCOM_CAVEAT,
          },
          {
            source_id: PORT_AUTHORITY_ID,
            entity: PORT_AUTHORITY_ENTITY,
            jurisdiction: PORT_AUTHORITY_JURISDICTION,
            unit: PORT_AUTHORITY_UNIT,
            unit_label: PORT_AUTHORITY_UNIT_LABEL,
            records: portAuthority?.records_ingested ?? 0,
            last_ingested_at: portAuthority?.last_ingested_at
              ? new Date(portAuthority.last_ingested_at).toISOString()
              : null,
            caveat: PORT_AUTHORITY_CAVEAT,
          },
          {
            source_id: TAHE_ID,
            entity: TAHE_ENTITY,
            jurisdiction: TAHE_JURISDICTION,
            unit: TAHE_UNIT,
            unit_label: TAHE_UNIT_LABEL,
            records: tahe?.records_ingested ?? 0,
            last_ingested_at: tahe?.last_ingested_at
              ? new Date(tahe.last_ingested_at).toISOString()
              : null,
            caveat: TAHE_CAVEAT,
          },
          {
            source_id: SYDNEY_TRAINS_ID,
            entity: SYDNEY_TRAINS_ENTITY,
            jurisdiction: SYDNEY_TRAINS_JURISDICTION,
            unit: SYDNEY_TRAINS_UNIT,
            unit_label: SYDNEY_TRAINS_UNIT_LABEL,
            records: sydneyTrains?.records_ingested ?? 0,
            last_ingested_at: sydneyTrains?.last_ingested_at
              ? new Date(sydneyTrains.last_ingested_at).toISOString()
              : null,
            caveat: SYDNEY_TRAINS_CAVEAT,
          },
          {
            source_id: NSW_TRAINLINK_ID,
            entity: NSW_TRAINLINK_ENTITY,
            jurisdiction: NSW_TRAINLINK_JURISDICTION,
            unit: NSW_TRAINLINK_UNIT,
            unit_label: NSW_TRAINLINK_UNIT_LABEL,
            records: nswTrainlink?.records_ingested ?? 0,
            last_ingested_at: nswTrainlink?.last_ingested_at
              ? new Date(nswTrainlink.last_ingested_at).toISOString()
              : null,
            caveat: NSW_TRAINLINK_CAVEAT,
          },
        ],
        note: 'Separate entity-level NSW State Owned Corporation statement lines for Sydney Water, WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom, Port Authority of NSW, TAHE, Sydney Trains and NSW TrainLink. Each annual report is discovered from the entity\'s official annual-report page (no hard-coded URL), SHA-256 archived outside the repo, and parsed only when the printed unit is explicit and the printed totals reconcile exactly (Sydney Water: derived finance costs + other expenses; WaterNSW: explicit printed Total expenses plus its component and profit bridges; Hunter Water: explicit printed Total expenses plus its component, Note 3 and profit-before-tax bridges; Essential Energy: exact sum of the printed expense lines because the statement has no single Total expenses subtotal, plus Note 2(c) and Note 3 bridge checks and the printed loss retained with a negative sign; Forestry Corporation: explicit printed Total expenses plus Note 5/8/9/10 subtotals and profit bridges, with two government-grant rows flagged potential double count; Landcom: no printed Total revenue or Total expenses, so both are the exact signed sums of the printed statement lines, accepted only when the gross-profit, PBT, net-result and Note 2.2/2.3/2.4/2.5/2.6 bridges reconcile exactly, with one grant-income row flagged potential double count and two lines flagged for human spot-check; Port Authority of NSW: explicit printed Total revenue and Total expenses, accepted only when the revenue-line, expense-line, PBT (including net gain on sale of PPE and other gains), net-result and Note 3/Note 4 bridges reconcile exactly, with no government grants separately disclosed and two lines flagged for human spot-check; TAHE: explicit printed Total revenue and Total expenses, accepted only when the five revenue lines, five non-nil expense lines plus an explicitly printed nil valuation decrement and the net-result bridge reconcile exactly, with one Grants and contributions row flagged potential double count and two lines flagged for human spot-check; Sydney Trains: explicit printed Total revenue and Total expenses excluding losses, accepted only when the four revenue lines, six expense lines, deficit-before-grants, operations-result and net-result bridges (including the below-the-line gains/losses) reconcile exactly, with one Grants and contributions row flagged potential double count, two lines flagged for human spot-check and a documented Volume 2 “Draft” footer provenance caveat; NSW TrainLink: explicit printed Total revenue and Total expenses excluding losses, accepted only when the three revenue lines, five expense lines, deficit-before-grants, operations-result and net-result bridges (with an explicitly printed nil impairment dash) reconcile exactly, with one Grants and contributions row flagged potential double count, two lines flagged for human spot-check and a recorded NSW TrainLink-brand/NSW Trains-legal-entity provenance caveat). Rows are jurisdiction_level "soc", aggregation_role "agency_detail", provisional and unverified. SOC rows are exposed only at /api/soc; they are never added to government program spending, the PNFC benchmark, or each other, and the entities are never summed together. Government-named funding rows carry potential_double_count.',
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
        qld_local_last_ingested_at: qldLocal?.last_ingested_at
          ? new Date(qldLocal.last_ingested_at).toISOString()
          : null,
        note: "NSW local: Dubbo's adopted budget/capital PDF and eleven audited GPFS sources (Dubbo, City of Sydney, Blacktown, Parramatta, Northern Beaches, Canterbury-Bankstown, Sutherland Shire, Wollongong, Newcastle, Lake Macquarie and Maitland), all non-additive agency detail with no region/LGA allocation. VIC local: VLGGC VGC1 and ABS1/ABS2-3 for all 79 councils, including the FY2015-16..FY2023-24 historical series; every source Totals row is suppressed and no cross-council total is created; VLGGC is attribution/permission, not CC BY. QLD local: the local government comparative-information package is active as `qld-local-government`; Financial Inputs (all 30 printed $'000 financial measures) and Road Data (10 printed $'000 expenditure/depreciation columns; non-financial kilometres/counts/areas/asset values excluded) are ingested for 77/78 councils across FY2010-11..FY2015-16, agency_detail, never summed across councils/years/measures and never added to QGIP grants/procurement. No newer QLD comparative years are published in the package (resource last modified 2022-11-25); FY2016-17+ is a coverage gap. WA local: `wa-mycouncil` ingests actual council expenditure by program/year from the MyCouncil OData `vw_LG_Expenditure` set for FY2010-11..FY2024-25 (24,007 non-additive rows, 139 councils) plus TotalRevenue/EmployeeCost from `vw_LG_FinanceActuals` (3,554 positive-value rows); whole AUD converted to cents at ×100. MyCouncil budget and state-grant entity sets are not queried; WA Budget remains the separate `wa-budget` source and is never summed with council actuals. The data is a controlled public financial snapshot, not audited GPFS. TAS local: `tas-lg-cdc` ingests the LIST CDC statewide repository Financial Data for FY2022-23–FY2024-25 with all 29 councils (684 non-additive rows), whole-dollar unit detection, and printed revenue/expense plus asset/liability reconciliation; older CDC years and other CDC sheets are documented but not ingested. `tas-budget` remains the separate TAS state budget and is never summed with council CDC actuals. SA local government is deferred (Phase 6.5 closed deferred); no SA council source is registered. ACT and NT are territory-level and reported under territory_ingestion. No other council or state/territory local source is covered.",
        not_covered: AREA_NOT_COVERED,
      },
      trade_ingestion: TRADE_COVERAGE,
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
