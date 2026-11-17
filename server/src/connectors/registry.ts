import { createAusTenderConnector } from './aus-tender.js';
import { createNswCkanConnector } from './data-nsw-ckan.js';
import { createDubboConnector } from './dubbo-council.js';
import { createPbsConnector } from './data-gov-au-pbs.js';
import { createGrantConnectConnector } from './grantconnect.js';
import { createNswBudgetConnector } from './nsw-budget-open-data.js';
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
  stub({
    id: 'abs-government-finance',
    name: 'Government Finance Statistics',
    publisher: 'Australian Bureau of Statistics',
    source_url:
      'https://www.abs.gov.au/statistics/economy/government/government-finance-statistics',
    jurisdiction_level: 'federal',
    // TODO: ingest ABS GFS catalogue tables (XLSX) by release.
  }),
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
  // Phase 4: live DataVic CKAN ingestion of the 2026-27 COFOG-A aggregate
  // expenses XLSX plus one departmental statement XLSX. Budget columns only.
  createVicBudgetConnector(),
  stub({
    id: 'qld-budget',
    name: 'Queensland Budget',
    publisher: 'Queensland Treasury',
    source_url: 'https://budget.qld.gov.au/',
    jurisdiction_level: 'state',
    // TODO: ingest Queensland Budget datasets (CSV/XLSX) per portfolio.
  }),
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
