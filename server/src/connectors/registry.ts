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
import { createCoffsHarbourGpfsConnector } from './coffs-harbour-gpfs.js';
import { createMidCoastGpfsConnector } from './mid-coast-gpfs.js';
import { createPortMacquarieHastingsGpfsConnector } from './port-macquarie-hastings-gpfs.js';
import { createTweedShireGpfsConnector } from './tweed-shire-gpfs.js';
import { createShoalhavenGpfsConnector } from './shoalhaven-gpfs.js';
import { createShellharbourGpfsConnector } from './shellharbour-gpfs.js';
import { createWaverleyGpfsConnector } from './waverley-gpfs.js';
import { createWilloughbyGpfsConnector } from './willoughby-gpfs.js';
import { createInnerWestGpfsConnector } from './inner-west-gpfs.js';
import { createBaysideGpfsConnector } from './bayside-gpfs.js';
import { createRandwickGpfsConnector } from './randwick-gpfs.js';
import { createRydeGpfsConnector } from './ryde-gpfs.js';
import { createNorthSydneyGpfsConnector } from './north-sydney-gpfs.js';
import { createCanadaBayGpfsConnector } from './canada-bay-gpfs.js';
import { createCumberlandGpfsConnector } from './cumberland-gpfs.js';
import { createGeorgesRiverGpfsConnector } from './georges-river-gpfs.js';
import { createFairfieldGpfsConnector } from './fairfield-gpfs.js';
import { createLiverpoolGpfsConnector } from './liverpool-gpfs.js';
import { createKuRingGaiGpfsConnector } from './ku-ring-gai-gpfs.js';
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
  // GPFS expansion: twelfth council only (Coffs Harbour City Council). Its
  // audited FY2024-25 General Purpose Financial Statements are a separate source
  // id: every row is non-additive agency_detail, has no region/LGA allocation,
  // and reconciles exactly to the printed Income Statement, B1-1
  // "Total functions and activities" and comprehensive-income totals. The PDF is
  // discovered and downloaded through the documented headless Chromium/Playwright
  // path because Akamai returns HTTP 403 to direct HTTP. Never summed with any
  // other council, the Dubbo budget rows, the existing council GPFS rows or State
  // rows.
  createCoffsHarbourGpfsConnector(),
  // GPFS expansion: thirteenth council only (MidCoast Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 "Total functions
  // and activities" and comprehensive-income totals. The PDF is discovered from
  // the official reporting page over plain HTTP; the exact bytes are SHA-256
  // archived outside the repo. Never summed with any other council, the Dubbo
  // budget rows, the existing council GPFS rows or State rows.
  createMidCoastGpfsConnector(),
  // GPFS expansion: fourteenth council only (Port Macquarie-Hastings Council).
  // Its audited FY2024-25 General Purpose Financial Statements are a separate
  // source id: every row is non-additive agency_detail, has no region/LGA
  // allocation, and reconciles exactly to the printed Income Statement, B1-1
  // "Total functions and activities" and comprehensive-income totals. The PDF is
  // discovered and downloaded through the documented headless Chromium/Playwright
  // path because an Akamai edge returns HTTP 403 to direct HTTP; the exact bytes
  // are SHA-256 archived outside the repo. Never summed with any other council,
  // the Dubbo budget rows, the existing council GPFS rows or State rows.
  createPortMacquarieHastingsGpfsConnector(),
  // GPFS expansion: fifteenth council only (Tweed Shire Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 "Total functions
  // and activities" and comprehensive-income totals. The PDF is discovered from
  // the official "Annual and financial reports" page over plain HTTP; the exact
  // bytes are SHA-256 archived outside the repo. Never summed with any other
  // council, the Dubbo budget rows, the existing council GPFS rows or State
  // rows.
  createTweedShireGpfsConnector(),
  // GPFS expansion: sixteenth council only (Shoalhaven City Council). Its
  // audited FY2024-25 General Purpose Financial Statements are a separate source
  // id: every row is non-additive agency_detail, has no region/LGA allocation,
  // and reconciles exactly to the printed Income Statement, B1-1 "Total
  // functions and activities" and comprehensive-income totals. The PDF is
  // discovered from the official "Financial statements" page via its
  // "Financial Statements - Previous Years" CMS grid over plain HTTP; the exact
  // bytes are SHA-256 archived outside the repo. Never summed with any other
  // council, the Dubbo budget rows, the existing council GPFS rows or State
  // rows.
  createShoalhavenGpfsConnector(),
  // GPFS expansion: seventeenth council only (Shellharbour City Council). Its
  // audited FY2024-25 General Purpose Financial Statements are a separate source
  // id: every row is non-additive agency_detail, has no region/LGA allocation,
  // and reconciles exactly to the printed Income Statement, B1-1 "Total
  // functions and activities" and comprehensive-income totals. The audited
  // statements are the financial-statements section of the official Annual
  // Report 2024 - 2025; the PDF is discovered from the official "Annual reports"
  // page, and the exact bytes are SHA-256 archived outside the repo. Never
  // summed with any other council, the Dubbo budget rows, the existing council
  // GPFS rows or State rows.
  createShellharbourGpfsConnector(),
  // GPFS expansion: eighteenth council only (Waverley Council). Its audited
  // FY2024-25 General Purpose Financial Statements are the official "Annual
  // Statement of Accounts 2024-2025" and a separate source id: every row is
  // non-additive agency_detail, has no region/LGA allocation, and reconciles
  // exactly to the printed Income Statement, B1-1 "Total functions and
  // activities" and comprehensive-income totals. Plain HTTP is rejected with a
  // Cloudflare challenge, so the PDF is discovered from the official page via
  // the documented headless Chromium path; the exact bytes are SHA-256 archived
  // outside the repo. Never summed with any other council, the Dubbo budget
  // rows, the existing council GPFS rows or State rows.
  createWaverleyGpfsConnector(),
  // GPFS expansion: nineteenth council only (Willoughby City Council). Its
  // audited FY2024-25 General Purpose Financial Statements are the official
  // "Annual Financial Statements 2024-2025" and a separate source id: every row
  // is non-additive agency_detail, has no region/LGA allocation, and reconciles
  // exactly to the printed Income Statement, B1-1 "Total functions and
  // activities" and comprehensive-income totals. Node's plain fetch is rejected
  // with a Cloudflare 403, so the PDF is discovered from the official page via
  // the documented headless Chromium path; the exact bytes are SHA-256 archived
  // outside the repo. Never summed with any other council, the Dubbo budget
  // rows, the existing council GPFS rows or State rows.
  createWilloughbyGpfsConnector(),
  // GPFS expansion: twentieth council only (Inner West Council). Its audited
  // FY2024-25 General Purpose Financial Statements are published inside the
  // official "Annual Report 2024-25" (the Annual Report page states the report
  // includes Council's financial report audited by the NSW Audit Office, and the
  // PDF includes the independent auditor's report on the GPFS) and are a
  // separate source id: every row is non-additive agency_detail, has no
  // region/LGA allocation, and reconciles exactly to the printed Income
  // Statement, B1-1 "Total functions and activities" and comprehensive-income
  // totals. innerwest.nsw.gov.au serves plain HTTP, so the PDF is discovered
  // from the official page with Node's fetch; the exact bytes are SHA-256
  // archived outside the repo. Never summed with any other council, the Dubbo
  // budget rows, the existing council GPFS rows or State rows.
  createInnerWestGpfsConnector(),
  // GPFS expansion: twenty-first council only (Bayside Council). Its audited
  // FY2024-25 General Purpose Financial Statements are the standalone official
  // "General Purpose Financial Statements & Special Schedules for the year
  // ended 30 June 2025" PDF linked from the Corporate planning and reporting
  // page, and a separate source id: every row is non-additive agency_detail,
  // has no region/LGA allocation, and reconciles exactly to the printed Income
  // Statement, B1-1 "Total functions and activities" and comprehensive-income
  // totals. bayside.nsw.gov.au serves plain HTTP, so the PDF is discovered from
  // the official page with Node's fetch; the exact bytes are SHA-256 archived
  // outside the repo. Never summed with any other council, the Dubbo budget
  // rows, the existing council GPFS rows or State rows.
  createBaysideGpfsConnector(),
  // GPFS expansion: twenty-second council only (Randwick City Council). Its
  // audited FY2024-25 General Purpose Financial Statements are the standalone
  // official "Financial Statements - 2024-25" PDF linked from the Our reports
  // page, and a separate source id: every row is non-additive agency_detail,
  // has no region/LGA allocation, and reconciles exactly to the printed Income
  // Statement, B1-1 "Total functions and activities" and comprehensive-income
  // totals. randwick.nsw.gov.au serves a Cloudflare challenge to non-browser
  // clients, so the documented headless Chromium path clears it and the
  // connector still selects the link from the cleared HTML; the exact bytes are
  // SHA-256 archived outside the repo. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  createRandwickGpfsConnector(),
  // GPFS expansion: twenty-third council only (the Council of the City of
  // Ryde). Its audited FY2024-25 General Purpose Financial Statements are the
  // standalone official "Financial Statements (General and Special Purpose)"
  // PDF for the year ended 30 June 2025 linked from the Financial Reports and
  // Statements page, and a separate source id: every row is non-additive
  // agency_detail, has no region/LGA allocation, and reconciles to the printed
  // Income Statement, B1-1 "Total functions and activities" and
  // comprehensive-income totals (the printed B1-1 $15 thousand
  // function-allocation discrepancy is recorded as evidence). ryde.nsw.gov.au
  // serves plain HTTP, so the PDF is discovered from the official page with
  // Node's fetch; the exact bytes are SHA-256 archived outside the repo. Never
  // summed with any other council, the Dubbo budget rows, the existing council
  // GPFS rows or State rows.
  createRydeGpfsConnector(),
  // GPFS expansion: twenty-fourth council only (North Sydney Council). Its
  // audited FY2024-25 General Purpose Financial Statements are the standalone
  // official "Financial Statements 2024-2025" PDF linked from the Financial
  // Statements document listing, and a separate source id: every row is
  // non-additive agency_detail, has no region/LGA allocation, and reconciles
  // exactly to the printed Income Statement, B1-1 "Total functions and
  // activities", note B3-4 (depreciation plus gross IPPE impairment) and
  // comprehensive-income totals. The listing and file endpoints sit behind an
  // AWS WAF challenge, so the documented headless Chromium path (channel
  // chromium, not the headless shell) clears it and the connector still selects
  // the link from the cleared HTML; the exact bytes are SHA-256 archived outside
  // the repo. Never summed with any other council, the Dubbo budget rows, the
  // existing council GPFS rows or State rows.
  createNorthSydneyGpfsConnector(),
  // GPFS expansion: twenty-fifth council only (City of Canada Bay Council). Its
  // audited FY2024-25 General Purpose Financial Statements are published inside
  // the official "Annual Report 2024-2025" PDF linked from the council's Our
  // Reporting page, and are a separate source id: every row is non-additive
  // agency_detail, has no region/LGA allocation, and reconciles exactly to the
  // printed Income Statement, B1-1 "Total functions and activities", note B3-4
  // and comprehensive-income totals. The PDF URL is discovered from the official
  // page (no hard-coded document URL); the exact bytes are SHA-256 archived
  // outside the repo. Never summed with any other council, the Dubbo budget
  // rows, the existing council GPFS rows or State rows.
  createCanadaBayGpfsConnector(),
  createCumberlandGpfsConnector(),
  // GPFS expansion: twenty-seventh council only (Georges River Council). Its
  // audited FY2024-25 General Purpose Financial Statements are the standalone
  // official "Audited Financial Statement and Auditors Report for 1 July 2024 -
  // 30 June 2025" PDF linked from the council's Other Corporate Documents page,
  // and are a separate source id: every row is non-additive agency_detail, has
  // no region/LGA allocation, and reconciles exactly to the printed Income
  // Statement, B1-1 "Total functions and activities", note B3-3 and
  // comprehensive-income totals. The PDF URL is discovered from the official
  // page (no hard-coded document URL); the exact bytes are SHA-256 archived
  // outside the repo. The auditor's Report on the Conduct of the Audit narrative
  // prints a different rounded total-expenses figure; that internal printed
  // difference is retained and flagged for a human spot check, never silently
  // reconciled. Never summed with any other council, the Dubbo budget rows, the
  // existing council GPFS rows or State rows.
  createGeorgesRiverGpfsConnector(),
  // GPFS expansion: twenty-eighth council only (Fairfield City Council). Its
  // audited FY2024-25 General Purpose Financial Statements are the standalone
  // official "2024-2025 Financial Statements" PDF linked from the council's
  // Corporate Reports page, and are a separate source id: every row is
  // non-additive agency_detail, has no region/LGA allocation, and reconciles
  // exactly to the printed Income Statement, B1-1 "Total functions and
  // activities", note B3-3 and comprehensive-income totals. The PDF URL is
  // discovered from the official page (no hard-coded document URL); the exact
  // bytes are SHA-256 archived outside the repo. The auditor's Report on the
  // Conduct of the Audit narrative is checked for a printed difference beyond
  // the one-decimal-million rounding tolerance; any such difference is retained
  // and flagged for a human spot check, never silently reconciled. Never summed
  // with any other council, the Dubbo budget rows, the existing council GPFS
  // rows or State rows.
  createFairfieldGpfsConnector(),
  // GPFS expansion: twenty-ninth council only (Liverpool City Council). Its
  // audited FY2024-25 General Purpose Financial Statements are the official
  // "Audited Financial Statement" PDF listed under the "Financial Year
  // 2024/2025" table on the council's Finance Reports page, and are a separate
  // source id: every row is non-additive agency_detail, has no region/LGA
  // allocation, and reconciles exactly to the printed Income Statement, B1-1
  // "Total functions and activities", note B3-4 and comprehensive-income
  // totals. The site enforces a Cloudflare managed challenge, so the
  // documented headless Chromium path clears it; the PDF URL is discovered from
  // the cleared HTML (no hard-coded document URL) and the exact bytes are
  // SHA-256 archived outside the repo. The auditor's Report on the Conduct of
  // the Audit contains an internal printed label inconsistency (the $224.4m
  // operating-expenses-excluding-depreciation subtotal is labelled "Other
  // expenses"); it is retained and flagged for a human spot check, never
  // silently reconciled. Never summed with any other council, the Dubbo budget
  // rows, the existing council GPFS rows or State rows.
  createLiverpoolGpfsConnector(),
  // Thirtieth council GPFS source: Ku-ring-gai Council's audited FY2024-25
  // General Purpose Financial Statements are the official "Financial statements
  // 2024-2025" PDF linked from the council's Finance page, and are a separate
  // source id: every row is non-additive agency_detail, has no region/LGA
  // allocation, and reconciles exactly to the printed Income Statement, B1-1
  // "Total functions and activities", note B3-4 and comprehensive-income
  // totals. The site returns HTTP 403 to non-browser clients, so the documented
  // headless Chromium path loads it; the PDF URL is discovered from the cleared
  // HTML (no hard-coded document URL) and the exact bytes are SHA-256 archived
  // outside the repo. The auditor's Report on the Conduct of the Audit prints a
  // one-decimal-million table whose 2025 operating result (21.9) contradicts its
  // own text (0.31 higher than 21.7, implying 22.0) and graph (21.99) and the
  // GPFS (21,997); that internal printed discrepancy is retained and flagged for
  // a human spot check, never silently reconciled. Never summed with any other
  // council, the Dubbo budget rows, the existing council GPFS rows or State rows.
  createKuRingGaiGpfsConnector(),
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
