/**
 * Coverage metadata for the planned trade domain.
 *
 * Trade is a separate analytical domain from spending. No live trade connector
 * is implemented in the foundation item; these are the planned sources, their
 * priority order and the limitations that must be shown wherever trade data
 * appears.
 */
export interface PlannedTradeSource {
  source_id: string;
  name: string;
  publisher: string;
  priority: number;
  status: 'planned' | 'active';
  note: string;
}

export const TRADE_PLANNED_SOURCES: readonly PlannedTradeSource[] = [
  {
    source_id: 'abs-international-trade',
    name: 'ABS International Trade (Data API Beta)',
    publisher: 'Australian Bureau of Statistics',
    priority: 1,
    status: 'active',
    note: 'Keyless ABS Data API Beta: ITGS 1.2.0 monthly goods (totals plus printed DATA_ITEM commodity rows) and TRADE_SERV_CNTRY_FY 1.0.0 total services by financial year. Observed AUD millions are stored as integer cents; no goods+services total is derived.',
  },
  {
    source_id: 'oecd-itic',
    name: 'OECD ITIC',
    publisher: 'Organisation for Economic Co-operation and Development',
    priority: 2,
    status: 'planned',
    note: 'OECD ITIC dataflow is reachable (HTTP 200). Rows must preserve the published observed/estimated distinction; no connector yet.',
  },
  {
    source_id: 'bitre-waterline',
    name: 'BITRE Waterline',
    publisher: 'Bureau of Infrastructure and Transport Research Economics',
    priority: 3,
    status: 'planned',
    note: 'Port-level trade statistics. Unit detection is required per table before any value is accepted; no connector yet.',
  },
  {
    source_id: 'disr-req',
    name: 'DISR Resources and Energy Quarterly',
    publisher: 'Department of Industry, Science and Resources',
    priority: 4,
    status: 'planned',
    note: 'Quarterly resources and energy trade values, volumes and prices. Unit detection is required per table; no connector yet.',
  },
  {
    source_id: 'abares',
    name: 'ABARES',
    publisher: 'Australian Bureau of Agricultural and Resource Economics and Sciences',
    priority: 5,
    status: 'planned',
    note: 'Agricultural commodity trade values and volumes. Unit detection is required per table; no connector yet.',
  },
] as const;

export const TRADE_LIMITATIONS = [
  'No profit data are collected, derived or estimated.',
  'CIF/FOB is a border cost proxy, not profit.',
  'Trade values, CIF/FOB margins, port interface costs, trade volumes and trade prices are different measures and are not additive.',
  'Port costs are not national totals and are never added to trade values.',
  'Trade records are strictly separate from spending records; no trade row is returned by a spending API and no spending row is returned by a trade API.',
] as const;

export const TRADE_COVERAGE = {
  status: 'active',
  live: true,
  implemented: true,
  planned_sources: TRADE_PLANNED_SOURCES,
  limitations: TRADE_LIMITATIONS,
  note: 'Trade is a separate analytical domain. ABS International Trade is live from the keyless Data API Beta; the other sources remain planned. No goods+services total is derived and trade rows are never joined to spending measures.',
} as const;
