import { createAbsGfsConnector } from './abs-gfs.js';
import { createWaBudgetConnector } from './wa-budget.js';
import { createTasBudgetConnector } from './tas-budget.js';
import { createQldLocalGovernmentConnector } from './qld-local-government.js';
import { createWaMyCouncilConnector } from './wa-mycouncil.js';
import { createTasLgCdcConnector } from './tas-lg-cdc.js';
import { createNtLgPilotConnector } from './nt-lg-pilot.js';
import { createAihwHealthExpenditureConnector } from './aihw-health-expenditure.js';
import { createAbsGfsPnfcConnector } from './abs-gfs-pnfc.js';
import { createAcncCharityConnector } from './acnc-charity.js';
import { createAusTenderConnector } from './aus-tender.js';
import { createNswCkanConnector } from './data-nsw-ckan.js';
import { createDubboConnector } from './dubbo-council.js';
import { MODULAR_CONNECTORS } from './generated-connectors.js';
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
import { createEnergyQueenslandConnector } from './soc/qld/energy-queensland.js';
import { createCsEnergyConnector } from './soc/qld/cs-energy.js';
import { createStanwellConnector } from './soc/qld/stanwell.js';
import { createPowerlinkConnector } from './soc/qld/powerlink.js';
import { createSunwaterConnector } from './soc/qld/sunwater.js';
import { createGladstonePortsConnector } from './soc/qld/gladstone-ports.js';
import { createPortOfTownsvilleConnector } from './soc/qld/port-of-townsville.js';
import { createPortsNorthConnector } from './soc/qld/ports-north.js';
import { createNqbpConnector } from './soc/qld/nqbp.js';
import { createWaterCorporationConnector } from './soc/wa/water-corporation.js';
import { createSynergyConnector } from './soc/wa/synergy.js';
import { createWesternPowerConnector } from './soc/wa/western-power.js';
import { createHorizonPowerConnector } from './soc/wa/horizon-power.js';
import { createFremantlePortsConnector } from './soc/wa/fremantle-ports.js';
import { createDevelopmentWaConnector } from './soc/wa/developmentwa.js';
import { createSouthernPortsConnector } from './soc/wa/southern-ports.js';
import { createVicBudgetConnector } from './vic-budget.js';
import { createVgc1Connector } from './vic-vlgc-vgc1.js';
import { createVlgcAbsConnector } from './vic-vlgc-abs.js';
import { createFagConnector } from './vic-vlgc-fag.js';
import { createLgprfConnector } from './vic-lgprf.js';
import { createSaGfsConnector } from './sa-budget-gfs.js';
import { createActBudgetConnector } from './act-budget.js';
import { createNtBudgetConnector } from './nt-budget.js';
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
  // Phase 6.2: AIHW health expenditure. METEOR is metadata-only (it contains
  // no data), so this uses the official AIHW state x area x funding-source CSV
  // published on data.gov.au. Rows are real (constant 2011-12 prices) AUD
  // millions; government and non-government are separate, non-additive series.
  // The data.gov.au package ends at 2011-12 and is documented as superseded.
  createAihwHealthExpenditureConnector(),
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
  // GPFS expansion: second council only (City of Sydney). Its audited FY2024-25
  // General Purpose Financial Statements are a separate source id: every row is
  // non-additive agency_detail, has no region/LGA allocation, and reconciles
  // exactly to the printed Income Statement, B1-1 and comprehensive-income
  // totals. Never summed with any other council, the Dubbo rows or state rows.
  // GPFS expansion: fourth council only (City of Parramatta). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  // GPFS expansion: fifth council only (Northern Beaches Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  // GPFS expansion: sixth council only (Canterbury-Bankstown Council). Its
  // audited FY2024-25 General Purpose Financial Statements are a separate source
  // id: every row is non-additive agency_detail, has no region/LGA allocation,
  // and reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  // GPFS expansion: seventh council only (Sutherland Shire Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  // GPFS expansion: eighth council only (Wollongong City Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  // GPFS expansion: ninth council only (Newcastle City Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. Never summed with any other council, the
  // Dubbo budget rows, the existing council GPFS rows or State rows.
  // GPFS expansion: tenth council only (Lake Macquarie City Council). Its
  // audited FY2024-25 General Purpose Financial Statements are a separate source
  // id: every row is non-additive agency_detail, has no region/LGA allocation,
  // and reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income totals. The PDF is discovered and downloaded through
  // the documented headless Chromium/Playwright path because Akamai returns
  // HTTP 403 to direct HTTP. Never summed with any other council, the Dubbo
  // budget rows, the existing council GPFS rows or State rows.
  // GPFS expansion: eleventh council only (Maitland City Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 and
  // comprehensive-income top-level totals. The published +/-$1k component
  // rounding is retained as evidence and components are never emitted/summed.
  // Never summed with any other council, the Dubbo budget rows, the existing
  // council GPFS rows or State rows.
  // GPFS expansion: twelfth council only (Coffs Harbour City Council). Its
  // audited FY2024-25 General Purpose Financial Statements are a separate source
  // id: every row is non-additive agency_detail, has no region/LGA allocation,
  // and reconciles exactly to the printed Income Statement, B1-1
  // "Total functions and activities" and comprehensive-income totals. The PDF is
  // discovered and downloaded through the documented headless Chromium/Playwright
  // path because Akamai returns HTTP 403 to direct HTTP. Never summed with any
  // other council, the Dubbo budget rows, the existing council GPFS rows or State
  // rows.
  // GPFS expansion: thirteenth council only (MidCoast Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 "Total functions
  // and activities" and comprehensive-income totals. The PDF is discovered from
  // the official reporting page over plain HTTP; the exact bytes are SHA-256
  // archived outside the repo. Never summed with any other council, the Dubbo
  // budget rows, the existing council GPFS rows or State rows.
  // GPFS expansion: fourteenth council only (Port Macquarie-Hastings Council).
  // Its audited FY2024-25 General Purpose Financial Statements are a separate
  // source id: every row is non-additive agency_detail, has no region/LGA
  // allocation, and reconciles exactly to the printed Income Statement, B1-1
  // "Total functions and activities" and comprehensive-income totals. The PDF is
  // discovered and downloaded through the documented headless Chromium/Playwright
  // path because an Akamai edge returns HTTP 403 to direct HTTP; the exact bytes
  // are SHA-256 archived outside the repo. Never summed with any other council,
  // the Dubbo budget rows, the existing council GPFS rows or State rows.
  // GPFS expansion: fifteenth council only (Tweed Shire Council). Its audited
  // FY2024-25 General Purpose Financial Statements are a separate source id:
  // every row is non-additive agency_detail, has no region/LGA allocation, and
  // reconciles exactly to the printed Income Statement, B1-1 "Total functions
  // and activities" and comprehensive-income totals. The PDF is discovered from
  // the official "Annual and financial reports" page over plain HTTP; the exact
  // bytes are SHA-256 archived outside the repo. Never summed with any other
  // council, the Dubbo budget rows, the existing council GPFS rows or State
  // rows.
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
  // Phase 4: live DataVic CKAN ingestion of the 2026-27 COFOG-A aggregate
  // expenses XLSX plus one departmental statement XLSX. Budget columns only.
  createVicBudgetConnector(),
  // VIC council pilot A: the VLGGC 2024-25 VGC1 questionnaire workbook covers all
  // 79 Victorian councils at income-statement function/nature granularity. It is
  // council-supplied and unaudited, and VLGGC is attribution/permission, NOT
  // CC BY. Every row is non-additive agency_detail, provisional/local_government
  // and unverified; the source Totals row is suppressed and no cross-council
  // total is emitted. Never mixed with vic-budget, ABS GFS, LGPRF, waste or NSW
  // council data.
  createVgc1Connector(),
  // VIC council pilot B: the VLGGC 2024-25 ABS1 and ABS2-3 workbooks cover all
  // 79 Victorian councils at capital-outlay, balance-sheet, cash-flow and
  // income-statement category granularity. They are council-supplied and
  // unaudited, and VLGGC is attribution/permission, NOT CC BY. Every row is
  // non-additive agency_detail, provisional/local_government and unverified;
  // the source Totals rows are suppressed and no cross-council total is
  // emitted. Bendigo balance-sheet totals reconcile exactly and capital outlays
  // carry a documented accrual/cash bridge. Never mixed with VGC1, vic-budget,
  // ABS GFS, LGPRF, waste or NSW council data.
  createVlgcAbsConnector(),
  // VIC grants overlay: the VLGGC Annual Allocation Report prints one
  // Commonwealth Financial Assistance Grant total per council for 2024-25
  // (estimated) and 2023-24 (final). It is grant income, not council spending:
  // each row is non-additive agency_detail, potential_double_count=true and is
  // never added to VGC1/ABS spending or any other grant source. The source
  // Totals rows are suppressed; no component sum and no cross-council total.
  // The report's copyright page is CC BY 3.0 AU for non-logo content; the
  // underlying VLGGC data collection is attribution/permission, NOT CC BY.
  createFagConnector(),
  // VIC council performance layer: the LGPRF 2020-25 full data set covers all
  // 79 councils for 2020-21..2024-25 (58 indicators in the first three years,
  // 59 in the last two) under CC BY 4.0. These are performance indicators, not
  // spending: every row is non-additive agency_detail, amount_cents is 0 and
  // the published result lives in performance_value. No sum or average across
  // councils, indicators or years; never mixed with VGC1/ABS, FAG, vic-budget,
  // ABS GFS, waste or NSW council data.
  createLgprfConnector(),
  // Phase 6.4: SA state general government GFS expenses by GPC function and
  // economic type from data.sa CKAN. Statewide only; explicit GPC -> COFOG
  // mapping, $'000 unit detection and reconciliation to the printed TOTAL row.
  // Every row is one function x economic-type component; no cross-source sum.
  createSaGfsConnector(),
  // Phase 6.6: ACT Budget Socrata — paged infrastructure investment programme.
  // Territory/ACT, budget measure type, $'000 project x fiscal-year components;
  // printed project totals are reconciliation-only and never emitted.
  createActBudgetConnector(),
  // Phase 6.8: NT Budget 2026-27 COFOG-A capital works from Budget Paper No. 4.
  // The NT site is Cloudflare-gated, so the PDF is fetched headless, archived and
  // hash-gated; one row per published COFOG-A category, $ million, budget.
  createNtBudgetConnector(),
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
  // QLD SOC pilot: first non-NSW entity — Energy Queensland Limited, a
  // Queensland GOC. The official corporate site is Cloudflare-gated, so the
  // verified Queensland Parliament tabled-paper copy is the documented
  // fallback. Entity-level statement lines only; never added to government
  // program spending, the PNFC benchmark, another QLD GOC, a QLD total, or
  // any other SOC.
  createEnergyQueenslandConnector(),
  // QLD SOC: second entity — CS Energy Limited, a Queensland GOC. Latest
  // annual report discovered from CS Energy's official page and parsed as
  // entity-level statement lines. Never added to government program spending,
  // the PNFC benchmark, Energy Queensland, another QLD GOC, a QLD total, or
  // any other SOC.
  createCsEnergyConnector(),
  // QLD SOC: third entity — Stanwell Corporation Limited, a Queensland GOC.
  // Latest annual report discovered from Stanwell's official publication pages
  // and parsed as entity-level statement lines. Never added to government
  // program spending, the PNFC benchmark, Energy Queensland, CS Energy,
  // another QLD GOC, a QLD total, or any other SOC.
  createStanwellConnector(),
  // QLD SOC: fourth entity — Powerlink Queensland (Queensland Electricity
  // Transmission Corporation Limited), a Queensland GOC. Latest annual report
  // discovered from Powerlink's official reports page and parsed as
  // entity-level statement lines. Never added to government program spending,
  // the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, another QLD
  // GOC, a QLD total, or any other SOC.
  createPowerlinkConnector(),
  // QLD SOC: fifth entity — Sunwater Limited, a Queensland GOC. Latest annual
  // report discovered from Sunwater's official publications page and parsed as
  // entity-level statement lines. Never added to government program spending,
  // the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink
  // Queensland, another QLD GOC, a QLD total, or any other SOC.
  createSunwaterConnector(),
  // QLD SOC: sixth entity — Gladstone Ports Corporation Limited, a Queensland
  // GOC. Latest annual report discovered from the official reports page and
  // parsed as entity-level statement lines. Never added to government program
  // spending, the PNFC benchmark, Energy Queensland, CS Energy, Stanwell,
  // Powerlink Queensland, Sunwater Limited, another QLD GOC, a QLD total, or
  // any other SOC.
  createGladstonePortsConnector(),
  // QLD SOC: seventh entity — Port of Townsville Limited, a Queensland GOC.
  // Latest annual report discovered from the official annual-reports page; the
  // FY2025-26 face statement defers at zero tolerance (a printed $1 rounding
  // gap), so it emits no rows. Never added to government program spending, the
  // PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink
  // Queensland, Sunwater Limited, Gladstone Ports, another QLD GOC, a QLD
  // total, or any other SOC.
  createPortOfTownsvilleConnector(),
  // QLD SOC: eighth entity — Ports North (Far North Queensland Ports Corporation
  // Limited), a Queensland GOC. Latest annual report discovered from the
  // official annual-reports page and parsed as entity-level statement lines.
  // Never added to government program spending, the PNFC benchmark, Energy
  // Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited,
  // Gladstone Ports, Port of Townsville, another QLD GOC, a QLD total, or any
  // other SOC.
  createPortsNorthConnector(),
  // QLD SOC: ninth entity — North Queensland Bulk Ports Corporation Limited
  // (NQBP), a Queensland GOC. The official publications page is
  // Cloudflare-blocked; discovery falls back to the verified Queensland
  // Parliament tabled-paper copy. Parsed as entity-level statement lines.
  // Never added to government program spending, the PNFC benchmark, Energy
  // Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited,
  // Gladstone Ports, Port of Townsville, Ports North, another QLD GOC, a QLD
  // total, or any other SOC.
  createNqbpConnector(),
  // WA SOC: first WA Government Trading Enterprise pilot — Water Corporation,
  // a WA GTE under the Government Trading Enterprises Act 2023 (WA). Latest
  // annual report discovered from the official annual report page and parsed as
  // entity-level statement lines. Never added to government program spending,
  // the PNFC benchmark, another WA GTE, a QLD/NSW SOC, a WA total, or any other
  // SOC.
  createWaterCorporationConnector(),
  // WA SOC: second WA Government Trading Enterprise pilot — Synergy, a WA GTE
  // under the Electricity Corporations Act 2005 (WA). Latest annual report
  // discovered from the official index -> newest landing page -> PDF and parsed
  // as entity-level statement lines. Never added to government program
  // spending, the PNFC benchmark, Water Corporation, another WA GTE, a QLD/NSW
  // SOC, a WA total, or any other SOC.
  createSynergyConnector(),
  // WA SOC: third WA Government Trading Enterprise pilot — Western Power
  // (Electricity Networks Corporation), a WA GTE under the Electricity
  // Corporations Act 2005 (WA). Latest annual report discovered from the
  // official annual-report page (PDF URLs embedded in JSON) and parsed as
  // entity-level statement lines. Never added to government program spending,
  // the PNFC benchmark, Water Corporation, Synergy, another WA GTE, a QLD/NSW
  // SOC, a WA total, or any other SOC.
  createWesternPowerConnector(),
  // WA SOC: fourth WA Government Trading Enterprise pilot — Horizon Power
  // (Regional Power Corporation), a WA GTE under the Government Trading
  // Enterprises Act 2023 (WA). The publications page is Cloudflare-blocked; the
  // official FY2025-26 PDF on Horizon Power's own CDN is the documented
  // fallback. Parsed as entity-level statement lines. Never added to government
  // program spending, the PNFC benchmark, Water Corporation, Synergy, Western
  // Power, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC.
  createHorizonPowerConnector(),
  // WA SOC: next WA Government Trading Enterprise pilot — Fremantle Ports
  // (Fremantle Port Authority), a WA GTE under the Government Trading
  // Enterprises Act 2023 (WA). Latest annual report discovered from the
  // official publications page and parsed as entity-level statement lines.
  // Never added to government program spending, the PNFC benchmark, Water
  // Corporation, Synergy, Western Power, Horizon Power, another WA GTE, a
  // QLD/NSW SOC, a WA total, or any other SOC.
  createFremantlePortsConnector(),
  // WA SOC: next WA Government Trading Enterprise pilot — DevelopmentWA (the
  // Western Australian Land Authority), a WA GTE under the Government Trading
  // Enterprises Act 2023 (WA). Latest report discovered from the official
  // publications page and parsed as entity-level WALA statement lines; the
  // separate MRA statements are not added. Never added to government program
  // spending, the PNFC benchmark, Water Corporation, Synergy, Western Power,
  // Horizon Power, Fremantle Ports, another WA GTE, a QLD/NSW SOC, a WA total,
  // or any other SOC.
  createDevelopmentWaConnector(),
  // WA SOC: next WA Government Trading Enterprise pilot — Southern Ports
  // (Southern Ports Authority), a WA GTE under the Government Trading
  // Enterprises Act 2023 (WA). Latest annual report discovered from the
  // official publications page and parsed as entity-level statement lines.
  // Never added to government program spending, the PNFC benchmark, Water
  // Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports,
  // DevelopmentWA, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC.
  createSouthernPortsConnector(),
  // Phase 6.3: WA Budget EFO table and chart data from catalogue.data.wa.gov.au
  // CKAN. No machine-readable BP2 agency-expense dataset is published; the
  // connector ingests the strongest clean EFO tables (Chapter 5 major spending
  // changes as provisional non-additive policy measures; Chapter 6 Table 1
  // asset investment by agency reconciled to its printed Total). Unit guard
  // requires $m; no COFOG mapping is invented.
  createWaBudgetConnector(),
  // Phase 6.7: TAS Budget Paper No. 1 (2026-27) digital PDF, Table 9.16
  // General Government Expenses from Transactions by Purpose. COFOG-A
  // categories, six $m columns and a printed total reconciled for every year.
  // Agency-level tables are in BP2 and are not part of this item. Rows are
  // provisional benchmark aggregates; no COFOG mapping is invented.
  createTasBudgetConnector(),
  // Phase 6.9: QLD local government comparative information report, Financial
  // Inputs CSV from data.qld.gov.au CKAN. Council-level actual $'000 financial
  // inputs, separate from QGIP project grants/procurement; every row is
  // agency_detail and non-additive.
  createQldLocalGovernmentConnector(),
  // Phase 2 local government: WA MyCouncil OData actual council expenditure by
  // program/year plus the controlled finance-actual snapshot. Never queries the
  // MyCouncil budget or grant entity sets; wa-budget remains separate.
  createWaMyCouncilConnector(),
  // Phase 3 local government: TAS CDC LIST Open Data statewide ZIP repository,
  // Financial Data sheet for the latest three complete years and all 29
  // councils. Whole-dollar unit detection and printed reconciliation; never
  // mixed with tas-budget.
  createTasLgCdcConnector(),
  // Phase 6 local government: NT three-council GPFS pilot (Darwin, Palmerston,
  // Alice Springs) only; explicit $'000 guard and zero-tolerance reconciliation.
  createNtLgPilotConnector(),
  // Module-style connectors discovered by scripts/generate-connector-manifest.mjs.
  ...MODULAR_CONNECTORS,
];

export const CONNECTOR_IDS = CONNECTORS.map((connector) => connector.id);

export function getConnector(id: string): Connector | undefined {
  return CONNECTORS.find((connector) => connector.id === id);
}
