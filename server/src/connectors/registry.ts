import { createAbsGfsConnector } from './abs-gfs.js';
import { createAbsGfsPnfcConnector } from './abs-gfs-pnfc.js';
import { createAcncCharityConnector } from './acnc-charity.js';
import { createAusTenderConnector } from './aus-tender.js';
import { createNswCkanConnector } from './data-nsw-ckan.js';
import { createDubboConnector } from './dubbo-council.js';
import { createDubboGpfsConnector } from './dubbo-gpfs.js';
import { createCityOfSydneyGpfsConnector } from './city-of-sydney-gpfs.js';
import { createBlacktownGpfsConnector } from './blacktown-gpfs.js';
import { createParramattaGpfsConnector } from './parramatta-gpfs.js';
import { createNorthernBeachesGpfsConnector } from './northern-beaches-gpfs.js';
import { createCanterburyBankstownGpfsConnector } from './canterbury-bankstown-gpfs.js';
import { createSutherlandShireGpfsConnector } from './sutherland-shire-gpfs.js';
import { createWollongongGpfsConnector } from './wollongong-gpfs.js';
import { createNewcastleGpfsConnector } from './newcastle-gpfs.js';
import { createLakeMacquarieGpfsConnector } from './lake-macquarie-gpfs.js';
import { createMaitlandGpfsConnector } from './maitland-gpfs.js';
import { createPbsConnector } from './data-gov-au-pbs.js';
import { createGrantConnectConnector } from './grantconnect.js';
import { createNswBudgetConnector } from './nsw-budget-open-data.js';
import { createQldBudgetConnector } from './qld-budget.js';
import { createQgipConnector } from './qld-qgip.js';
import { createEssentialEnergyConnector } from './soc/nsw/essential-energy.js';
import { createForestryCorporationConnector } from './soc/nsw/forestry-corporation.js';
import { createHunterWaterConnector } from './soc/nsw/hunter-water.js';
import { createLandcomConnector } from './soc/nsw/landcom.js';
import { createPortAuthorityConnector } from './soc/nsw/port-authority.js';
import { createSydneyTrainsConnector } from './soc/nsw/sydney-trains.js';
import { createNswTrainlinkConnector } from './soc/nsw/nsw-trainlink.js';
import { createSydneyWaterConnector } from './soc/nsw/sydney-water.js';
import { createTaheConnector } from './soc/nsw/tahe.js';
import { createWaterNswConnector } from './soc/nsw/waternsw.js';
import { createVicBudgetConnector } from './vic-budget.js';
import { notImplemented, type Connector, type ConnectorMetadata } from './types.js';

/**
 * Configure the narrow AusTender window from the environment so the live run is
 * reproducible (`AUSTENDER_START_DATE` / `AUSTENDER_END_DATE`). Unset, the
 * connector uses the seven complete days before today.
 */
function ausTenderFromEnv(): Connector {
  const pageLimit = Number(process.env.AUSTENDER_PAGE_LIMIT);
  const delayMs = Number(process.env.AUSTENDER_DELAY_MS);
  return createAusTenderConnector({
    ...(process.env.AUSTENDER_START_DATE ? { startDate: process.env.AUSTENDER_START_DATE } : {}),
    ...(process.env.AUSTENDER_END_DATE ? { endDate: process.env.AUSTENDER_END_DATE } : {}),
    ...(Number.isInteger(pageLimit) && pageLimit > 0 ? { pageLimit } : {}),
    ...(Number.isFinite(delayMs) && delayMs >= 0 ? { delayMs } : {}),
  });
}

function stub(metadata: Omit<ConnectorMetadata, 'status'>): Connector {
  return {
    ...metadata,
    status: 'stub',
    fetch: () => notImplemented(metadata),
    transform: () => [],
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [] },
  };
}

/**
 * The registered Australian public-spending sources. AusTender is live as of F2
 * (contractPublished OCDS feed), data.gov.au PBS as of F3 (CKAN package_show +
 * streamed program-expense CSV), NSW/Dubbo as of S1/S2/S3, VIC Budget as of
 * Phase 4, and GrantConnect as a manual, chunked DownloadResult XLSX import
 * (no scraper, no paid adaptor).
 * The remaining connectors are stubs: their `fetch` rejects with a clear
 * "not implemented" error and no request leaves the process.
 */
export const CONNECTORS: readonly Connector[] = [
  stub({
    id: 'federal-budget-portal',
    name: 'Australian Government Budget Portal',
    publisher: 'Australian Government Department of Finance',
    source_url: 'https://budget.gov.au/',
    jurisdiction_level: 'federal',
    // TODO: ingest Portfolio Budget Statements (PDF/XLSX) via budget.gov.au.
  }),
  // Phase 4: ABS GFS Annual 2024-25 Key Tables 9/10 "Expenses by purpose"
  // (COFOG-A) from the official XLSX. The ABS SDMX API has no GFS/COFOG
  // dataflow (verified against the full catalogue), so this is the explicit
  // human-approved XLSX fallback. Rows are official aggregates (verified),
  // aggregation_role=benchmark, and are never summed with project data or
  // across levels/measures.
  createAbsGfsConnector(),
  // Phase 5: ABS GFS Annual 2024-25 PNFC operating statements for Australia
  // (all levels) and the eight states/territories, from nine official XLSX data
  // cubes. The ABS SDMX API has no PNFC/GFS dataflow. Every row is a verified
  // sector benchmark (jurisdiction_level=pnfc, aggregation_role=benchmark);
  // never add it to SOC/entity, government, charity or project data, and never
  // sum across jurisdictions or revenue/expense flows.
  createAbsGfsPnfcConnector(),
  stub({
    id: 'aihw-health-expenditure',
    name: 'Health Expenditure Australia',
    publisher: 'Australian Institute of Health and Welfare',
    source_url: 'https://www.aihw.gov.au/reports-data/health-welfare-overview/health-expenditure',
    jurisdiction_level: 'federal',
    // TODO: ingest AIHW health-expenditure data tables (XLSX) by year.
  }),
  stub({
    id: 'aofm',
    name: 'Australian Office of Financial Management',
    publisher: 'Australian Office of Financial Management',
    source_url: 'https://www.aofm.gov.au/',
    jurisdiction_level: 'federal',
    // TODO: ingest AOFM debt/portfolio datasets (CSV) for debt transactions.
  }),
  // F2: live OCDS contractPublished ingestion. The connector is active; each
  // run's status is recorded by the runner on data_sources/ingestion_logs.
  ausTenderFromEnv(),
  // F3: live data.gov.au CKAN ingestion of the 2025-26 PBS program-expense CSV.
  // `fetch` streams the CSV; per-run status is recorded on data_sources/logs.
  createPbsConnector(),
  // F4 was re-scoped: GrantConnect is not scraped and no paid adaptor is used.
  // It is a manual, SHA-256-archived DownloadResult export import (chunked and
  // cap-safe). A file carrying the >50,000-result cap warning is rejected and
  // the source stays partial until complete chunks cover the target period.
  createGrantConnectConnector(),
  // S1: live official NSW Budget 2025-26 Open Data XLSX (Wayback snapshot) plus
  // the ArcGIS capital-projects feature layer. Per-run status is recorded on
  // data_sources/ingestion_logs by the runner.
  createNswBudgetConnector(),
  // S2: targeted data.nsw.gov.au CKAN ingestion (CSV/XLSX downloads, DataStore
  // paging, delayed PDF/DOCX resources). The old nsw-budget source above stays
  // the S1 NSW Budget source; this one is a separate source id.
  createNswCkanConnector({
    ...(process.env.NSW_CKAN_MANIFEST_PATH
      ? { manifestPath: process.env.NSW_CKAN_MANIFEST_PATH }
      : {}),
  }),
  // S3: one local council only (Dubbo Regional Council). The adopted budget
  // PDF is archived and parsed by a Dubbo-specific adapter on top of the shared
  // PDF foundation. Other councils are not covered.
  createDubboConnector(),
  // GPFS pilot: still one council only (Dubbo Regional Council). The audited
  // FY2024-25 General Purpose Financial Statements are a separate source id
  // from the budget/forecast PDF above: every row is non-additive
  // agency_detail, has no region/LGA allocation, and reconciles exactly to the
  // OLG FY2024-25 totals. Never summed with the 245 dubbo-council rows.
  createDubboGpfsConnector(),
  // GPFS expansion: second council only (City of Sydney). Its audited FY2024-25
  // General Purpose Financial Statements are a separate source id: every row is
  // non-additive agency_detail, has no region/LGA allocation, and reconciles
  // exactly to the printed Income Statement, B1-1 and comprehensive-income
  // totals. Never summed with any other council, the Dubbo rows or state rows.
  createCityOfSydneyGpfsConnector(),
  // GPFS expansion: third council only (Blacktown City Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  createBlacktownGpfsConnector(),
  // GPFS expansion: fourth council only (City of Parramatta). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  createParramattaGpfsConnector(),
  // GPFS expansion: fifth council only (Northern Beaches Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  createNorthernBeachesGpfsConnector(),
  // GPFS expansion: sixth council only (Canterbury-Bankstown Council). Its
  // audited FY2024-25 General Purpose Financial Statements are a separate source
  // id: every row is non-additive agency_detail, has no region/LGA allocation,
  // and reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  createCanterburyBankstownGpfsConnector(),
  // GPFS expansion: seventh council only (Sutherland Shire Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  createSutherlandShireGpfsConnector(),
  // GPFS expansion: eighth council only (Wollongong City Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  createWollongongGpfsConnector(),
  // GPFS expansion: ninth council only (Newcastle City Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  createNewcastleGpfsConnector(),
  // GPFS expansion: tenth council only (Lake Macquarie City Council). Its
  // audited FY2024-25 General Purpose Financial Statements are a separate source
  // id: every row is non-additive agency_detail, has no region/LGA allocation,
  // and reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. The PDF is discovered and downloaded through
  // the documented headless Chromium/Playwright path because Akamai returns
  // HTTP 403 to direct HTTP. Never summed with any other council, the Dubbo
  // budget rows, the existing council GPFS rows or State rows.
  createLakeMacquarieGpfsConnector(),
  // GPFS expansion: eleventh council only (Maitland City Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income top-level totals. The published +/-$1k component
  // rounding is retained as evidence and components are never emitted/summed.
  // Never summed with any other council, the Dubbo budget rows, the existing
  // council GPFS rows or State rows.
  createMaitlandGpfsConnector(),
  // Phase 4: live DataVic CKAN ingestion of the 2026-27 COFOG-A aggregate
  // expenses XLSX plus one departmental statement XLSX. Budget columns only.
  createVicBudgetConnector(),
  // Phase 4: live data.qld CKAN ingestion of the 2026-27 BP3 Capital
  // Statement and BP4 Budget Measures CSVs, plus their unit dictionaries.
  createQldBudgetConnector(),
  // Phase 4: live data.qld CKAN ingestion of the latest annual QGIP
  // consolidated expenditure CSV (2024-25) plus its data dictionary. This is a
  // separate source from qld-budget: grant awards and procured frontline
  // services are actual expenditure, never budget measures, and the two measure
  // types are never summed together.
  createQgipConnector(),
  // Phase 4: latest ACNC Annual Information Statement CSV from data.gov.au
  // CKAN. Charity expenses are not government spending: every row is
  // jurisdiction_level=charity and only total-expense rows feed a charity
  // headline; component rows are never summed with the total.
  createAcncCharityConnector(),
  // SOC Phase 2: first NSW state-owned corporation — Sydney Water only. Its
  // latest annual report is discovered, SHA-256 archived and parsed as
  // entity-level SOC statement lines (jurisdiction_level "soc",
  // aggregation_role "agency_detail"). Never added to government program
  // spending or to the PNFC benchmark. Other SOCs are not implemented.
  createSydneyWaterConnector(),
  // SOC Phase 3: second NSW state-owned corporation — WaterNSW (Water NSW).
  // Latest annual report discovered, SHA-256 archived and parsed as
  // entity-level SOC statement lines. Never added to government program
  // spending, the PNFC benchmark, or Sydney Water. Other SOCs are not
  // implemented.
  createWaterNswConnector(),
  // SOC Phase 4: third NSW state-owned corporation — Hunter Water Corporation.
  // Latest annual report discovered, SHA-256 archived and parsed as
  // entity-level SOC statement lines. Never added to government program
  // spending, the PNFC benchmark, Sydney Water, WaterNSW, or any other SOC.
  createHunterWaterConnector(),
  // SOC Phase 5: fourth NSW state-owned corporation — Essential Energy. Latest
  // annual report discovered, SHA-256 archived and parsed as entity-level
  // statement lines. Never added to government program spending, the PNFC
  // benchmark, or any other SOC. Other SOCs are not implemented.
  createEssentialEnergyConnector(),
  // SOC Phase 6: fifth NSW state-owned corporation — Forestry Corporation of
  // NSW. Latest annual report discovered, SHA-256 archived and parsed as
  // entity-level statement lines. Never added to government program spending,
  // the PNFC benchmark, or any other SOC. Other SOCs are not implemented.
  createForestryCorporationConnector(),
  // SOC Phase 7: sixth NSW state-owned corporation — Landcom. Latest annual
  // report discovered, SHA-256 archived and parsed as entity-level statement
  // lines. Never added to government program spending, the PNFC benchmark, or
  // any other SOC. Other SOCs are not implemented.
  createLandcomConnector(),
  // SOC Phase 8: seventh NSW state-owned corporation — Port Authority of NSW.
  // Latest annual report discovered, SHA-256 archived and parsed as entity-level
  // statement lines. Never added to government program spending, the PNFC
  // benchmark, or any other SOC. Other SOCs are not implemented.
  createPortAuthorityConnector(),
  // SOC Phase 9: eighth NSW state-owned corporation — TAHE (Transport Asset
  // Holding Entity of New South Wales). Latest annual report discovered,
  // SHA-256 archived and parsed as entity-level statement lines. Never added to
  // government program spending, the PNFC benchmark, or any other SOC. Other
  // SOCs are not implemented.
  createTaheConnector(),
  // SOC Phase 10: ninth NSW state-owned corporation — Sydney Trains. Latest
  // annual report financial-statements volume discovered, SHA-256 archived and
  // parsed as entity-level statement lines. Never added to government program
  // spending, the PNFC benchmark, or any other SOC. Other SOCs are not
  // implemented.
  createSydneyTrainsConnector(),
  // SOC Phase 11: tenth NSW state-owned corporation — NSW TrainLink (legal
  // entity NSW Trains). Latest annual report financial-statements volume
  // discovered, SHA-256 archived and parsed as entity-level statement lines.
  // Never added to government program spending, the PNFC benchmark, or any
  // other SOC. Other SOCs are not implemented.
  createNswTrainlinkConnector(),
  stub({
    id: 'wa-budget',
    name: 'Western Australian Budget',
    publisher: 'Western Australian Department of Treasury',
    source_url: 'https://www.wa.gov.au/organisation/department-of-treasury/budget',
    jurisdiction_level: 'state',
    // TODO: ingest WA Budget papers and Treasury data tables (XLSX).
  }),
];

export const CONNECTOR_IDS = CONNECTORS.map((connector) => connector.id);

export function getConnector(id: string): Connector | undefined {
  return CONNECTORS.find((connector) => connector.id === id);
}
