import { notImplemented, type Connector, type ConnectorMetadata } from './types.js';

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
 * The registered Australian public-spending sources. None is live in F1: every
 * `fetch` rejects with a clear "not implemented" error, no request leaves the
 * process, and `transform` returns no records. The three federal source ids
 * (aus-tender, data-gov-au-pbs, grantconnect) are the F2/PBS/GrantConnect stubs.
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
  stub({
    id: 'aus-tender',
    name: 'AusTender — Australian Government contracts',
    publisher: 'Australian Government Department of Finance',
    source_url: 'https://www.tenders.gov.au/',
    jurisdiction_level: 'federal',
    // F2: ingest published AusTender contract notices (contract-shaped records).
  }),
  stub({
    id: 'data-gov-au-pbs',
    name: 'Portfolio Budget Statements (data.gov.au)',
    publisher: 'Australian Government Department of Finance',
    source_url: 'https://www.budget.gov.au/',
    jurisdiction_level: 'federal',
    // PBS: ingest Portfolio Budget Statements once the release format is pinned.
  }),
  stub({
    id: 'grantconnect',
    name: 'GrantConnect — Australian Government grants',
    publisher: 'Australian Government Department of Finance',
    source_url: 'https://www.grants.gov.au/',
    jurisdiction_level: 'federal',
    // GrantConnect: ingest published grant award records.
  }),
  stub({
    id: 'nsw-budget',
    name: 'NSW Budget',
    publisher: 'NSW Treasury',
    source_url: 'https://www.treasury.nsw.gov.au/budget',
    jurisdiction_level: 'state',
    // TODO: ingest NSW Budget papers and agency financial statements (PDF/XLSX).
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
