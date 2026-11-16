import { notImplemented, type Connector, type ConnectorMetadata } from './types.js';

function stub(metadata: ConnectorMetadata): Connector {
  return {
    ...metadata,
    fetch: () => notImplemented(metadata),
  };
}

/**
 * Eight plausible Australian public-spending sources. None is wired: each
 * `fetch` rejects with a clear "not implemented" error and no request leaves
 * the process. TODO (later milestone): implement the named endpoint/format.
 */
export const CONNECTORS: readonly Connector[] = [
  stub({
    id: 'federal-budget-portal',
    name: 'Australian Government Budget Portal',
    publisher: 'Australian Government Department of Finance',
    source_url: 'https://budget.gov.au/',
    status: 'stub',
    // TODO: ingest Portfolio Budget Statements (PDF/XLSX) via budget.gov.au.
  }),
  stub({
    id: 'abs-government-finance',
    name: 'Government Finance Statistics',
    publisher: 'Australian Bureau of Statistics',
    source_url:
      'https://www.abs.gov.au/statistics/economy/government/government-finance-statistics',
    status: 'stub',
    // TODO: ingest ABS GFS catalogue tables (XLSX) by release.
  }),
  stub({
    id: 'aihw-health-expenditure',
    name: 'Health Expenditure Australia',
    publisher: 'Australian Institute of Health and Welfare',
    source_url: 'https://www.aihw.gov.au/reports-data/health-welfare-overview/health-expenditure',
    status: 'stub',
    // TODO: ingest AIHW health-expenditure data tables (XLSX) by year.
  }),
  stub({
    id: 'aofm',
    name: 'Australian Office of Financial Management',
    publisher: 'Australian Office of Financial Management',
    source_url: 'https://www.aofm.gov.au/',
    status: 'stub',
    // TODO: ingest AOFM debt/portfolio datasets (CSV) for debt transactions.
  }),
  stub({
    id: 'nsw-budget',
    name: 'NSW Budget',
    publisher: 'NSW Treasury',
    source_url: 'https://www.treasury.nsw.gov.au/budget',
    status: 'stub',
    // TODO: ingest NSW Budget papers and agency financial statements (PDF/XLSX).
  }),
  stub({
    id: 'vic-budget',
    name: 'Victorian State Budget',
    publisher: 'Victorian Department of Treasury and Finance',
    source_url: 'https://www.dtf.vic.gov.au/state-budget',
    status: 'stub',
    // TODO: ingest Victorian Budget papers and DTF data tables (XLSX).
  }),
  stub({
    id: 'qld-budget',
    name: 'Queensland Budget',
    publisher: 'Queensland Treasury',
    source_url: 'https://budget.qld.gov.au/',
    status: 'stub',
    // TODO: ingest Queensland Budget datasets (CSV/XLSX) per portfolio.
  }),
  stub({
    id: 'wa-budget',
    name: 'Western Australian Budget',
    publisher: 'Western Australian Department of Treasury',
    source_url: 'https://www.wa.gov.au/organisation/department-of-treasury/budget',
    status: 'stub',
    // TODO: ingest WA Budget papers and Treasury data tables (XLSX).
  }),
];

export const CONNECTOR_IDS = CONNECTORS.map((connector) => connector.id);

export function getConnector(id: string): Connector | undefined {
  return CONNECTORS.find((connector) => connector.id === id);
}
