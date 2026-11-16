import { createAusTenderConnector } from './aus-tender.js';
import { createNswCkanConnector } from './data-nsw-ckan.js';
import { createPbsConnector } from './data-gov-au-pbs.js';
import { createNswBudgetConnector } from './nsw-budget-open-data.js';
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
 * (contractPublished OCDS feed) and data.gov.au PBS is live as of F3 (CKAN
 * package_show + streamed program-expense CSV). Every other connector is still
 * a stub: its `fetch` rejects with a clear "not implemented" error, no request
 * leaves the process, and `transform` returns no records. grantconnect remains
 * pending, as do the state/territory sources.
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
  stub({
    id: 'grantconnect',
    name: 'GrantConnect — Australian Government grants',
    publisher: 'Australian Government Department of Finance',
    source_url: 'https://www.grants.gov.au/',
    jurisdiction_level: 'federal',
    // GrantConnect: ingest published grant award records.
  }),
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
  stub({
    id: 'vic-budget',
    name: 'Victorian State Budget',
    publisher: 'Victorian Department of Treasury and Finance',
    source_url: 'https://www.dtf.vic.gov.au/state-budget',
    jurisdiction_level: 'state',
    // TODO: ingest Victorian Budget papers and DTF data tables (XLSX).
  }),
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
