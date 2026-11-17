import type { Page, Route } from '@playwright/test';

const SYNTHETIC_SOURCE = {
  source_id: 'synthetic-seed',
  name: 'Synthetic development seed (not real spending)',
  publisher: 'ausspend development team',
  source_url: '/data-sources#synthetic-seed',
  retrieved_at: '2026-11-16T00:00:00.000Z',
  license: 'Synthetic data — no reuse rights implied',
  verified: false,
  status: 'active',
  last_ingested_at: null,
  records_ingested: 0,
  errors: [],
  notes:
    'Deterministic placeholder values generated for development. Not sourced from, and not a substitute for, any published Australian government figure.',
};

const AUS_TENDER_SOURCE = {
  source_id: 'aus-tender',
  name: 'AusTender — Australian Government contracts',
  publisher: 'Australian Government Department of Finance',
  source_url: 'https://www.tenders.gov.au/',
  retrieved_at: '2026-11-16T00:00:00.000Z',
  license: 'Not yet verified — see connector metadata',
  verified: false,
  status: 'active',
  last_ingested_at: '2026-11-16T00:05:00.000Z',
  records_ingested: 861,
  errors: [],
  notes: 'Ingested from the AusTender OCDS contractPublished feed; unverified.',
};

const PBS_SOURCE = {
  source_id: 'data-gov-au-pbs',
  name: 'Portfolio Budget Statements (data.gov.au)',
  publisher: 'Australian Government Department of Finance',
  source_url: 'https://data.gov.au/data/dataset/4f025f38-0c70-45e2-8106-4c29a5e48637',
  retrieved_at: '2026-11-16T00:00:00.000Z',
  license: 'Not yet verified — see connector metadata',
  verified: false,
  status: 'active',
  last_ingested_at: '2026-11-16T00:06:00.000Z',
  records_ingested: 12,
  errors: [],
  notes: '2025-26 PBS program-expense CSV from data.gov.au; unverified budget line items.',
};

const GRANTCONNECT_SOURCE = {
  source_id: 'grantconnect',
  name: 'GrantConnect — Australian Government grants (manual export)',
  publisher: 'Australian Government Department of Finance',
  source_url: 'https://www.grants.gov.au/',
  retrieved_at: '2026-11-17T00:10:00.000Z',
  license:
    'Creative Commons Attribution 4.0 International (Commonwealth of Australia, GrantConnect)',
  verified: false,
  status: 'degraded',
  last_ingested_at: '2026-11-17T00:10:00.000Z',
  records_ingested: 0,
  errors: [
    'partial GrantConnect coverage: 0/365 days of 2025-07-01..2026-06-30; 2 file(s) rejected/superseded',
  ],
  notes:
    'GrantConnect manual export (file archived SHA-256; not an API, no live scraper). Coverage partial 0/365 days of 2025-07-01..2026-06-30: the supplied wide exports carried the >50,000-result cap warning and were rejected, never partially imported.',
};

const WATERNSW_SOURCE = {
  source_id: 'waternsw',
  name: 'WaterNSW — Annual Report',
  publisher: 'WaterNSW (Water NSW)',
  source_url:
    'https://www.waternsw.com.au/about-us/our-business/corporate-governance/annual-reports',
  retrieved_at: '2026-11-17T05:43:27.391Z',
  license:
    '© WaterNSW. Published annual-report PDF used here for public-interest research; not an open-data licence grant.',
  verified: false,
  status: 'degraded',
  last_ingested_at: '2026-11-17T05:43:27.391Z',
  fetch_strategy: 'parliament_fallback',
  last_successful_fetch: '2026-11-17T05:43:27.391Z',
  staleness_days: 1,
  records_ingested: 47,
  errors: ['annual-report page HTTP 403'],
  notes:
    'NSW SOC entity statement lines. The last successful fetch used the NSW Parliament tabled-paper artifact; existing rows are preserved when a refresh fails.',
  deferred_resources: [],
};

const NSW_BUDGET_SOURCE = {
  source_id: 'nsw-budget',
  name: 'NSW Budget 2025-26 Open Data',
  publisher: 'NSW Treasury',
  source_url: 'https://www.budget.nsw.gov.au/budget-detail/open-data',
  retrieved_at: '2026-11-16T00:00:00.000Z',
  license: 'CC BY 3.0 AU',
  verified: false,
  status: 'active',
  last_ingested_at: '2026-11-16T00:07:00.000Z',
  records_ingested: 1115,
  errors: [],
  notes:
    'Official 2025-26 XLSX Wayback copy plus ArcGIS capital projects; unverified Budgeted rows.',
};

const NSW_CKAN_SOURCE = {
  source_id: 'data-nsw-ckan',
  name: 'data.nsw.gov.au CKAN (NSW Government open data)',
  publisher: 'NSW Government — data.nsw.gov.au',
  source_url: 'https://data.nsw.gov.au/data/',
  retrieved_at: '2026-11-16T00:00:00.000Z',
  license: 'Creative Commons Attribution (per CKAN dataset metadata)',
  verified: false,
  status: 'active',
  last_ingested_at: '2026-11-16T00:08:00.000Z',
  records_ingested: 3,
  errors: [],
  notes:
    'Targeted CKAN ingestion of selected budget/capital/expenditure datasets; DataStore paging and archived CSV/XLSX copies. PDF/DOCX resources deferred.',
  deferred_resources: [
    {
      package_id: 'f0f58123-5405-4dd2-87d8-48e319fb84ee',
      package_name: 'fleet-vehicle-expenditure-data-fy18-19',
      dataset_title: 'Fleet Vehicle expenditure data FY18-19',
      resource_id: '00cfd3ab-8192-4d3d-8b09-b09080574b50',
      name: 'Fleet Vehicle expenditure data FY18-19.pdf',
      format: 'PDF',
      url: 'https://data.nsw.gov.au/data/dataset/f0f58123-5405-4dd2-87d8-48e319fb84ee/resource/00cfd3ab-8192-4d3d-8b09-b09080574b50/download/fleet-vehicle-expenditure-data-fy18-19.pdf',
      reason:
        'Deferred: PDF/DOC/DOCX extraction belongs to the separate PDF foundation; not ingested in S2.',
    },
    {
      package_id: 'a1a350b5-2c9a-4055-8030-7b570364421d',
      package_name: 'media-expenditure-by-agency-2024-2025',
      dataset_title: 'Media Expenditure by Agency 2024/2025',
      resource_id: 'f6e15e73-e00b-44a1-afea-816fd6e8be9e',
      name: '202407-202506-q4-expenditure-by-agency.docx',
      format: 'DOC',
      url: 'https://data.nsw.gov.au/data/dataset/a1a350b5-2c9a-4055-8030-7b570364421d/resource/f6e15e73-e00b-44a1-afea-816fd6e8be9e/download',
      reason:
        'Deferred: PDF/DOC/DOCX extraction belongs to the separate PDF foundation; not ingested in S2.',
    },
  ],
};

const DUBBO_SOURCE = {
  source_id: 'dubbo-council',
  name: 'Dubbo Regional Council — Annual Report / Operational Plan',
  publisher: 'Dubbo Regional Council',
  source_url:
    'https://www.dubbo.nsw.gov.au/ArticleDocuments/290/20262027%20Budget%20and%20Forecasts%20including%20Capital%20-%20Adopted.PDF.aspx',
  retrieved_at: '2026-11-17T00:00:00.000Z',
  license:
    '© Dubbo Regional Council. Published council document, used for public-interest research.',
  verified: false,
  status: 'active',
  last_ingested_at: '2026-11-17T00:09:00.000Z',
  records_ingested: 245,
  errors: [],
  notes:
    'One local council only (S3). Adopted 2026/27 budget/capital PDF archived with SHA-256; every row provisional and unverified; summary uses explicit ($000) and capital uses magnitude-checked dollars; totals mismatches reject the section.',
};

const AUS = { _id: '6afaa24c06cd1221b0f07291', code: 'AUS', name: 'Australia', level: 'national' };
const NSW = {
  _id: '6afaa24c06cd1221b0f07292',
  code: 'NSW',
  name: 'New South Wales',
  level: 'state',
};
const VIC = {
  _id: '6afaa24c06cd1221b0f07293',
  code: 'VIC',
  name: 'Victoria',
  level: 'state',
};
const QLD = {
  _id: '6afaa24c06cd1221b0f07294',
  code: 'QLD',
  name: 'Queensland',
  level: 'state',
};

const DUBBO = {
  _id: '40d7a238d4b2cef48ae5f267',
  code: 'NSW-DUBBO',
  slug: 'dubbo',
  name: 'Dubbo',
  level: 'region',
  parent_code: 'NSW',
};

const ALL_REGIONS = [AUS, NSW, VIC, QLD, DUBBO];

const COVERAGE = {
  phase: 'Phase 1 + F2/F3 + S1/S2/S3 (AusTender + PBS + NSW + Dubbo live)',
  synthetic: true,
  live_ingestion: true,
  generated_at: '2026-11-16T00:00:00.000Z',
  counts: { data_sources: 6, regions: ALL_REGIONS.length, functions: 53, measures: 1067 },
  fiscal_years: ['2022-23', '2023-24', '2024-25', '2025-26'],
  measure_types: ['actual', 'budget', 'estimate'],
  region_levels: ['national', 'state'],
  connectors: [
    {
      id: 'federal-budget-portal',
      name: 'Australian Government Budget Portal',
      publisher: 'Australian Government Department of Finance',
      source_url: 'https://budget.gov.au/',
      status: 'stub',
      jurisdiction_level: 'federal',
      last_fetched_at: null,
      records_ingested: 0,
      errors: [],
    },
    {
      id: 'abs-government-finance',
      name: 'Government Finance Statistics',
      publisher: 'Australian Bureau of Statistics',
      source_url:
        'https://www.abs.gov.au/statistics/economy/government/government-finance-statistics',
      status: 'stub',
      jurisdiction_level: 'federal',
      last_fetched_at: null,
      records_ingested: 0,
      errors: [],
    },
    {
      id: 'aihw-health-expenditure',
      name: 'Health Expenditure Australia',
      publisher: 'Australian Institute of Health and Welfare',
      source_url: 'https://www.aihw.gov.au/reports-data/health-welfare-overview/health-expenditure',
      status: 'stub',
      jurisdiction_level: 'federal',
      last_fetched_at: null,
      records_ingested: 0,
      errors: [],
    },
    {
      id: 'aofm',
      name: 'Australian Office of Financial Management',
      publisher: 'Australian Office of Financial Management',
      source_url: 'https://www.aofm.gov.au/',
      status: 'stub',
      jurisdiction_level: 'federal',
      last_fetched_at: null,
      records_ingested: 0,
      errors: [],
    },
    {
      id: 'aus-tender',
      name: 'AusTender — Australian Government contracts',
      publisher: 'Australian Government Department of Finance',
      source_url: 'https://www.tenders.gov.au/',
      status: 'active',
      jurisdiction_level: 'federal',
      last_fetched_at: '2026-11-16T00:05:00.000Z',
      records_ingested: 861,
      errors: [],
    },
    {
      id: 'data-gov-au-pbs',
      name: 'Portfolio Budget Statements (data.gov.au)',
      publisher: 'Australian Government Department of Finance',
      source_url: 'https://data.gov.au/data/dataset/4f025f38-0c70-45e2-8106-4c29a5e48637',
      status: 'active',
      jurisdiction_level: 'federal',
      last_fetched_at: '2026-11-16T00:06:00.000Z',
      records_ingested: 12,
      errors: [],
    },
    {
      id: 'grantconnect',
      name: 'GrantConnect — Australian Government grants (manual export)',
      publisher: 'Australian Government Department of Finance',
      source_url: 'https://www.grants.gov.au/',
      status: 'degraded',
      jurisdiction_level: 'federal',
      last_fetched_at: '2026-11-17T00:10:00.000Z',
      records_ingested: 0,
      errors: [
        'partial GrantConnect coverage: 0/365 days of 2025-07-01..2026-06-30; 2 file(s) rejected/superseded',
      ],
    },
    {
      id: 'nsw-budget',
      name: 'NSW Budget 2025-26 Open Data',
      publisher: 'NSW Treasury',
      source_url: 'https://www.budget.nsw.gov.au/budget-detail/open-data',
      status: 'active',
      jurisdiction_level: 'state',
      last_fetched_at: '2026-11-16T00:07:00.000Z',
      records_ingested: 1115,
      errors: [],
    },
    {
      id: 'data-nsw-ckan',
      name: 'data.nsw.gov.au CKAN (NSW Government open data)',
      publisher: 'NSW Government — data.nsw.gov.au',
      source_url: 'https://data.nsw.gov.au/data/',
      status: 'active',
      jurisdiction_level: 'state',
      last_fetched_at: '2026-11-16T00:08:00.000Z',
      records_ingested: 3,
      errors: [],
      deferred_resources: NSW_CKAN_SOURCE.deferred_resources,
    },
    {
      id: 'dubbo-council',
      name: 'Dubbo Regional Council — Annual Report / Operational Plan',
      publisher: 'Dubbo Regional Council',
      source_url:
        'https://www.dubbo.nsw.gov.au/ArticleDocuments/290/20262027%20Budget%20and%20Forecasts%20including%20Capital%20-%20Adopted.PDF.aspx',
      status: 'active',
      jurisdiction_level: 'local',
      last_fetched_at: '2026-11-17T00:09:00.000Z',
      records_ingested: 245,
      errors: [],
    },
    {
      id: 'vic-budget',
      name: 'Victorian State Budget',
      publisher: 'Victorian Department of Treasury and Finance',
      source_url: 'https://www.dtf.vic.gov.au/state-budget',
      status: 'stub',
      jurisdiction_level: 'state',
      last_fetched_at: null,
      records_ingested: 0,
      errors: [],
    },
    {
      id: 'qld-budget',
      name: 'Queensland Budget',
      publisher: 'Queensland Treasury',
      source_url: 'https://budget.qld.gov.au/',
      status: 'stub',
      jurisdiction_level: 'state',
      last_fetched_at: null,
      records_ingested: 0,
      errors: [],
    },
    {
      id: 'wa-budget',
      name: 'Western Australian Budget',
      publisher: 'Western Australian Department of Treasury',
      source_url: 'https://www.wa.gov.au/organisation/department-of-treasury/budget',
      status: 'stub',
      jurisdiction_level: 'state',
      last_fetched_at: null,
      records_ingested: 0,
      errors: [],
    },
  ],
  connector_status_counts: { active: 5, degraded: 1, stub: 7 },
  supported_measure_types: ['actual', 'budget', 'estimate', 'contract', 'grant_award'],
  state_ingestion: {
    live: ['nsw-budget', 'data-nsw-ckan'],
    degraded: [],
    stubs: ['vic-budget', 'qld-budget', 'wa-budget'],
    nsw_ckan_last_ingested_at: '2026-11-16T00:08:00.000Z',
    deferred_resources: NSW_CKAN_SOURCE.deferred_resources,
    note: 'NSW Budget 2025-26 Open Data and targeted data.nsw.gov.au CKAN are live; Victoria, Queensland and Western Australia remain stubs. CKAN PDF/DOCX resources are deferred.',
  },
  local_ingestion: {
    live: ['dubbo-council'],
    degraded: [],
    stubs: [],
    dubbo_last_ingested_at: '2026-11-17T00:09:00.000Z',
    note: 'S3 covers one local council only: Dubbo Regional Council. Area panels are local, NSW-wide state, NSW-tagged federal AusTender and Commonwealth-wide PBS; they are not additive.',
    not_covered: {
      councils: [
        'Bathurst Regional Council — not covered (no connector)',
        'Orange City Council — not covered (no connector)',
        'Mid-Western Regional Council — not covered (no connector)',
        'All other NSW local councils — not covered (no connector)',
      ],
      states: [
        'VIC — not covered (stub)',
        'QLD — not covered (stub)',
        'WA — not covered (stub)',
        'SA — not covered (no connector)',
        'TAS — not covered (no connector)',
        'ACT — not covered (no connector)',
        'NT — not covered (no connector)',
      ],
    },
  },
  federal_ingestion: {
    live: ['aus-tender', 'data-gov-au-pbs'],
    degraded: ['grantconnect'],
    pending: [],
    stubs: ['federal-budget-portal', 'abs-government-finance', 'aihw-health-expenditure', 'aofm'],
    aus_tender_last_ingested_at: '2026-11-16T00:05:00.000Z',
    pbs_last_ingested_at: '2026-11-16T00:06:00.000Z',
    grantconnect_last_ingested_at: '2026-11-17T00:10:00.000Z',
    grantconnect_records: 0,
    grantconnect_caveat:
      'GrantConnect is a manual file export, not an API and not a live scraper. The archived XLSX is fingerprinted with SHA-256. Exports above the 50,000-result cap are rejected, so grant coverage is partial until complete date-range chunks cover the period.',
    pbs_caveat:
      'PBS CSV line items are entity program tables; their sum does not equal the Budget Paper 1 total general government expense, so it is not the federal total.',
    note: 'AusTender OCDS contracts and data.gov.au PBS budget line items are live. GrantConnect is a manual, capped DownloadResult export import (SHA-256 archived; no API/scraper) and is partial until complete date-range chunks cover the period. Every other source is a stub. PBS line items do not sum to the Budget Paper 1 total general government expense.',
  },
  soc_ingestion: {
    live: [],
    degraded: ['sydney-water', 'waternsw', 'hunter-water', 'essential-energy'],
    last_ingested_at: '2026-11-17T00:00:00.000Z',
    records: 5,
    entity: 'Sydney Water',
    jurisdiction: 'NSW',
    unit: 'AUD_thousands',
    unit_label: '$’000',
    caveat: 'Entity-level SOC statement lines; entities are separate and never added together.',
    label: 'SOC entity statement — never add to government program spending',
    entities: [
      'Sydney Water',
      'WaterNSW',
      'Hunter Water',
      'Essential Energy',
      'Forestry Corporation of NSW',
      'Landcom',
      'Port Authority of NSW',
      'TAHE',
      'Sydney Trains',
      'NSW TrainLink',
    ].map((entity, index) => ({
      source_id: entity.toLowerCase().replace(/[^a-z]+/g, '-'),
      entity,
      jurisdiction: 'NSW',
      unit: 'AUD_thousands',
      unit_label: '$’000',
      records: index === 1 ? 5 : 0,
      last_ingested_at: index === 1 ? '2026-11-17T00:00:00.000Z' : null,
      caveat: 'Entity-level SOC statement lines; entities are separate and never added together.',
    })),
    note: 'Ten separate NSW SOC entities; never summed with each other or with government spending.',
  },
  limitations: [
    'Mixed data: live AusTender contract rows and PBS budget line items sit alongside the synthetic development seed. The seed values remain deterministic placeholders, not published Australian government spending.',
    'No records are human-verified: seeded measures, ingested AusTender contracts and ingested PBS budget rows all carry verified: false.',
    'AusTender OCDS contractPublished ingestion and data.gov.au PBS program-expense ingestion are live. GrantConnect is a manual, SHA-256-archived DownloadResult export import (no API and no scraper): a wide export above the 50,000-result cap is rejected and partial chunk coverage is reported honestly. The other registered federal connectors are stubs and make no network call.',
    'PBS CSV line items are entity program tables; their sum does not equal the Budget Paper 1 total general government expense, so it is not the federal total.',
    'data.nsw.gov.au CKAN ingestion is targeted (selected datasets, not the whole portal). CKAN CSV/XLSX downloads and DataStore pages are archived with SHA-256; PDF/DOCX resources are deferred, and some units are provisional.',
    'COFOG function coverage is a curated subset (ten divisions with curated subdivisions), not exhaustive.',
    'Region granularity is national plus state/territory only. PBS rows are not geographically tagged (location.state is literally "Commonwealth").',
  ],
  note: 'Coverage metadata is generated from the connector registry and the live ingestion records. AusTender contract rows and PBS budget line items are real published records and remain unverified; synthetic seed rows are placeholders. Never sum across measure types, and never present a PBS line-item total as the federal total.',
};

const DIVISION_NAMES = [
  ['01', 'General public services'],
  ['02', 'Defence'],
  ['03', 'Public order and safety'],
  ['04', 'Economic affairs'],
  ['05', 'Environmental protection'],
  ['06', 'Housing and community amenities'],
  ['07', 'Health'],
  ['08', 'Recreation, culture and religion'],
  ['09', 'Education'],
  ['10', 'Social protection'],
] as const;

const DIVISIONS = DIVISION_NAMES.map(([code, name]) => ({
  code,
  name,
  level: 'division' as const,
  subdivisions: [
    {
      code: `${code}1`,
      name: `${name} subdivision`,
      level: 'subdivision' as const,
      parent_code: code,
    },
  ],
}));

type MockMeasureType = 'actual' | 'budget' | 'estimate';
type MockRegion = typeof AUS | typeof NSW | typeof VIC | typeof QLD;

const FUNCTION_NAMES: Record<
  string,
  { name: string; level: 'division' | 'subdivision'; parent?: string }
> = {
  '07': { name: 'Health', level: 'division' },
  '074': { name: 'Public health services', level: 'subdivision', parent: '07' },
  '09': { name: 'Education', level: 'division' },
};

function measureRow(
  id: string,
  regionId: string,
  measureType: MockMeasureType,
  fiscalYear: string,
  amountCents: number,
) {
  return {
    id,
    region_id: regionId,
    function_code: '07',
    amount_cents: amountCents,
    measure_type: measureType,
    fiscal_year: fiscalYear,
    source_id: SYNTHETIC_SOURCE.source_id,
    source_url: SYNTHETIC_SOURCE.source_url,
    verified: false,
    notes: 'Synthetic development value; not real spending.',
  };
}

function perTypeTotals(rows: Array<{ measure_type: MockMeasureType; amount_cents: number }>) {
  const types = [...new Set(rows.map((row) => row.measure_type))].sort();
  return types.map((measure_type) => {
    const matching = rows.filter((row) => row.measure_type === measure_type);
    return {
      measure_type,
      count: matching.length,
      total_cents: matching.reduce((sum, row) => sum + row.amount_cents, 0),
    };
  });
}

function spendingRow(
  id: string,
  region: MockRegion,
  functionCode: string,
  measureType: MockMeasureType,
  fiscalYear: string,
  amountCents: number,
) {
  const fn = FUNCTION_NAMES[functionCode] ?? FUNCTION_NAMES['07'];
  return {
    id,
    region_id: region._id,
    function_code: functionCode,
    amount_cents: amountCents,
    measure_type: measureType,
    fiscal_year: fiscalYear,
    source_id: SYNTHETIC_SOURCE.source_id,
    source_url: SYNTHETIC_SOURCE.source_url,
    verified: false,
    notes: 'Synthetic development value; not real spending.',
    function_name: fn.name,
    function_level: fn.level,
    ...(fn.parent ? { function_parent_code: fn.parent } : {}),
    region_code: region.code,
    region_name: region.name,
    region_level: region.level,
    provenance: {
      source_id: SYNTHETIC_SOURCE.source_id,
      source_url: SYNTHETIC_SOURCE.source_url,
      verified: false,
      notes: SYNTHETIC_SOURCE.notes,
    },
  };
}

const SPENDING_ROWS: Array<ReturnType<typeof spendingRow> & Record<string, unknown>> = [
  spendingRow('p-a1', NSW, '07', 'actual', '2024-25', 200_000_000_000),
  spendingRow('p-a2', VIC, '07', 'actual', '2024-25', 120_000_000_000),
  spendingRow('p-a3', AUS, '07', 'actual', '2024-25', 90_000_000_000),
  spendingRow('p-a4', NSW, '07', 'actual', '2023-24', 180_000_000_000),
  spendingRow('p-b1', NSW, '07', 'budget', '2024-25', 210_000_000_000),
  spendingRow('p-b2', VIC, '07', 'budget', '2024-25', 110_000_000_000),
  spendingRow('p-e1', NSW, '07', 'estimate', '2024-25', 220_000_000_000),
  spendingRow('p-e2', VIC, '07', 'estimate', '2023-24', 130_000_000_000),
  spendingRow('p-09a', AUS, '09', 'actual', '2024-25', 80_000_000_000),
  spendingRow('p-09b', NSW, '09', 'budget', '2024-25', 85_000_000_000),
];

SPENDING_ROWS.push({
  ...spendingRow('nsw-cap-1', NSW, '04', 'budget', '2025-26', 118_100_000),
  id: 'nsw-cap-1',
  source_id: 'nsw-budget',
  source_url: 'https://www.budget.nsw.gov.au/budget-detail/open-data',
  project_name: 'Chichester Trunk Gravity Main',
  description: 'Major Works — Works in Progress',
  jurisdiction_level: 'state',
  jurisdiction: 'NSW',
  source_dataset: 'NSW Budget 2025-26 Open Data',
  data_quality_flag: 'provisional',
  location: { state: 'NSW', lga_name: 'DUNGOG' },
  provenance: {
    source_id: 'nsw-budget',
    source_url: 'https://www.budget.nsw.gov.au/budget-detail/open-data',
    verified: false,
    notes: 'ArcGIS capital project; Budgeted 2025-26.',
  },
});

SPENDING_ROWS.push({
  ...spendingRow('nsw-dubbo-bridge', NSW, '04', 'budget', '2025-26', 1_265_300_000),
  id: 'nsw-dubbo-bridge',
  source_id: 'nsw-budget',
  source_url: 'https://www.budget.nsw.gov.au/budget-detail/open-data',
  project_name: 'Newell Highway, New Dubbo Bridge (State and Federal Funded)',
  description: 'New Dubbo Bridge — State and Federal funded',
  delivery_entity: 'Transport for NSW',
  jurisdiction_level: 'state',
  jurisdiction: 'NSW',
  source_dataset: 'NSW Budget 2025-26 Open Data',
  data_quality_flag: 'provisional',
  location: { state: 'NSW', lga_name: 'DUBBO' },
  provenance: {
    source_id: 'nsw-budget',
    source_url: 'https://www.budget.nsw.gov.au/budget-detail/open-data',
    verified: false,
    notes: 'NSW Budget capital project; Budgeted 2025-26.',
  },
});

SPENDING_ROWS.push({
  ...spendingRow('ckan-ram-1', NSW, '09', 'budget', '2025-26', 32_977_900),
  id: 'ckan-ram-1',
  source_id: 'data-nsw-ckan',
  source_url: 'https://data.nsw.gov.au/data/dataset/nsw-education-resource-allocation-model',
  project_name: 'Abbotsford Public School',
  description: '2026 Resource Allocation Model (RAM) funding table',
  jurisdiction_level: 'state',
  jurisdiction: 'NSW',
  source_dataset: 'NSW public schools Resource Allocation Model (RAM) funding by school',
  data_quality_flag: 'statewide_only',
  location: { state: 'NSW' },
  provenance: {
    source_id: 'data-nsw-ckan',
    source_url: 'https://data.nsw.gov.au/data/dataset/nsw-education-resource-allocation-model',
    verified: false,
    notes: 'CKAN RAM allocation; explicit $ column; unverified.',
  },
});

for (let index = 0; index < 15; index += 1) {
  SPENDING_ROWS.push(
    spendingRow(
      `p-f${index}`,
      index % 2 === 0 ? NSW : VIC,
      '07',
      index % 3 === 0 ? 'actual' : index % 3 === 1 ? 'budget' : 'estimate',
      '2022-23',
      10_000_000_000 + index * 1_000_000,
    ),
  );
}

function pbsSpendingRow(id: string, amountCents: number, projectName: string) {
  return {
    id,
    region_id: AUS._id,
    function_code: '07',
    amount_cents: amountCents,
    measure_type: 'budget' as const,
    fiscal_year: '2025-26',
    source_id: 'data-gov-au-pbs',
    source_url: PBS_SOURCE.source_url,
    verified: false,
    natural_key: `4f025f38-0c70-45e2-8106-4c29a5e48637:${id}`,
    project_name: projectName,
    description: 'PBS program-expense line item for 2025-26.',
    jurisdiction_level: 'federal' as const,
    jurisdiction: 'Commonwealth',
    delivery_entity: 'Department of Health and Aged Care',
    funding_source: 'Health and Aged Care',
    source_dataset: '2025-26 Portfolio Budget Statements (data.gov.au)',
    source_date: '2025-03-26',
    data_quality_flag: 'statewide_only',
    location: { state: 'Commonwealth' },
    notes:
      "PBS line item; amount column 2025-26 in $'000. PBS line-item sum is not the federal total.",
    function_name: 'Health',
    function_level: 'division',
    region_code: 'AUS',
    region_name: 'Australia',
    region_level: 'national',
    provenance: {
      source_id: 'data-gov-au-pbs',
      source_url: PBS_SOURCE.source_url,
      verified: false,
      notes: PBS_SOURCE.notes,
    },
  };
}

const PBS_ROWS = [
  pbsSpendingRow('pbs-1', 250_000_000, 'Program 1.1: Health policy'),
  pbsSpendingRow('pbs-2', 12_500_000_000, 'Program 1.2: Hospitals'),
  pbsSpendingRow('pbs-3', 7_400_000_000, 'Program 1.3: Medicare'),
  pbsSpendingRow('pbs-4', 3_200_000_000, 'Program 1.4: Aged care'),
  pbsSpendingRow('pbs-5', 1_100_000_000, 'Program 1.5: Preventative health'),
  pbsSpendingRow('pbs-6', 900_000_000, 'Program 1.6: Mental health'),
  pbsSpendingRow('pbs-7', 800_000_000, 'Program 1.7: Health workforce'),
  pbsSpendingRow('pbs-8', 700_000_000, 'Program 1.8: Digital health'),
  pbsSpendingRow('pbs-9', 600_000_000, 'Program 1.9: Medical research'),
  pbsSpendingRow('pbs-10', 500_000_000, 'Program 1.10: Aboriginal health'),
  pbsSpendingRow('pbs-11', 400_000_000, 'Program 1.11: Sport'),
  pbsSpendingRow('pbs-12', 300_000_000, 'Program 1.12: Food safety'),
];

interface AreaRowSeed {
  id: string;
  measureType: MockMeasureType;
  amountCents: number;
  sourceId: string;
  level: 'local' | 'state' | 'federal';
  location: { state: string; lga_name?: string };
  region: { _id: string; code: string; name: string; level: string };
  projectName: string;
}

function areaRow(seed: AreaRowSeed) {
  return {
    id: seed.id,
    region_id: seed.region._id,
    function_code: '04',
    amount_cents: seed.amountCents,
    measure_type: seed.measureType,
    fiscal_year: '2026-27',
    source_id: seed.sourceId,
    source_url:
      seed.sourceId === 'dubbo-council'
        ? DUBBO_SOURCE.source_url
        : seed.sourceId === 'aus-tender'
          ? AUS_TENDER_SOURCE.source_url
          : seed.sourceId === 'data-gov-au-pbs'
            ? PBS_SOURCE.source_url
            : NSW_BUDGET_SOURCE.source_url,
    verified: false,
    project_name: seed.projectName,
    description: 'Area fixture row; unverified.',
    jurisdiction_level: seed.level,
    jurisdiction: seed.level === 'federal' ? 'Commonwealth' : 'NSW',
    data_quality_flag: 'provisional',
    extraction_confidence: seed.sourceId === 'dubbo-council' ? 'high' : undefined,
    location: seed.location,
    function_name: 'Economic affairs',
    function_level: 'division',
    region_code: seed.region.code,
    region_name: seed.region.name,
    region_level: seed.region.level,
    provenance: {
      source_id: seed.sourceId,
      source_url:
        seed.sourceId === 'dubbo-council'
          ? DUBBO_SOURCE.source_url
          : seed.sourceId === 'aus-tender'
            ? AUS_TENDER_SOURCE.source_url
            : seed.sourceId === 'data-gov-au-pbs'
              ? PBS_SOURCE.source_url
              : NSW_BUDGET_SOURCE.source_url,
      verified: false,
      notes: 'Area fixture row; unverified.',
    },
  };
}

const DUBBO_AREA_ROWS = [
  areaRow({
    id: 'dubbo-local-1',
    measureType: 'budget',
    amountCents: 10_000_000,
    sourceId: 'dubbo-council',
    level: 'local',
    location: { state: 'NSW', lga_name: 'Dubbo' },
    region: DUBBO,
    projectName: 'Dubbo Regional Council: Rates and annual charges',
  }),
  areaRow({
    id: 'dubbo-local-2',
    measureType: 'budget',
    amountCents: 43_761_600,
    sourceId: 'dubbo-council',
    level: 'local',
    location: { state: 'NSW', lga_name: 'Dubbo' },
    region: DUBBO,
    projectName: 'Community Culture and Places — Cemeteries',
  }),
  areaRow({
    id: 'dubbo-state-1',
    measureType: 'budget',
    amountCents: 200_000_000,
    sourceId: 'nsw-budget',
    level: 'state',
    location: { state: 'NSW' },
    region: NSW,
    projectName: 'NSW-wide state budget line',
  }),
  areaRow({
    id: 'dubbo-federal-nsw-1',
    measureType: 'contract',
    amountCents: 300_000_000,
    sourceId: 'aus-tender',
    level: 'federal',
    location: { state: 'NSW' },
    region: NSW,
    projectName: 'NSW-tagged federal contract',
  }),
  areaRow({
    id: 'dubbo-federal-vic-1',
    measureType: 'contract',
    amountCents: 400_000_000,
    sourceId: 'aus-tender',
    level: 'federal',
    location: { state: 'VIC' },
    region: VIC,
    projectName: 'VIC-tagged federal contract (excluded)',
  }),
  areaRow({
    id: 'dubbo-pbs-1',
    measureType: 'budget',
    amountCents: 500_000_000,
    sourceId: 'data-gov-au-pbs',
    level: 'federal',
    location: { state: 'Commonwealth' },
    region: AUS,
    projectName: 'Commonwealth-wide PBS line',
  }),
];

const AREA_COMBINED_ROWS = DUBBO_AREA_ROWS.filter(
  (row) => row.location.state !== 'VIC' && row.source_id !== 'data-gov-au-pbs',
);

function panel(
  key: 'local' | 'state_nsw' | 'federal_nsw_tagged' | 'commonwealth_pbs',
  label: string,
  description: string,
  level: 'local' | 'state' | 'federal',
  rows: typeof DUBBO_AREA_ROWS,
) {
  return {
    key,
    label,
    description,
    jurisdiction_level: level,
    count: rows.length,
    by_measure_type: perTypeTotals(rows),
    total_cents: null,
  };
}

const DUBBO_AREA_PROFILE = {
  area: { ...DUBBO, slug: 'dubbo' },
  panels: [
    panel(
      'local',
      'Dubbo — local (Dubbo Regional Council)',
      'Rows delivered by Dubbo Regional Council with location.lga_name Dubbo or the Dubbo region_id.',
      'local',
      DUBBO_AREA_ROWS.filter((row) => row.jurisdiction_level === 'local'),
    ),
    panel(
      'state_nsw',
      'NSW-wide state rows (not Dubbo-specific)',
      'Rows with jurisdiction_level state and jurisdiction NSW; not attributable to Dubbo.',
      'state',
      DUBBO_AREA_ROWS.filter((row) => row.jurisdiction_level === 'state'),
    ),
    panel(
      'federal_nsw_tagged',
      'Federal AusTender rows tagged NSW (not Dubbo-specific)',
      'AusTender rows whose location.state is NSW; NSW-tagged federal procurement.',
      'federal',
      DUBBO_AREA_ROWS.filter(
        (row) => row.source_id === 'aus-tender' && row.location.state === 'NSW',
      ),
    ),
    panel(
      'commonwealth_pbs',
      'Commonwealth-wide PBS (separate; not a Dubbo row)',
      'PBS line items are Commonwealth-wide and shown separately.',
      'federal',
      DUBBO_AREA_ROWS.filter((row) => row.source_id === 'data-gov-au-pbs'),
    ),
  ],
  caution:
    'Local, NSW-wide state, NSW-tagged federal and Commonwealth-wide PBS figures overlap and are NOT additive. Never sum across panels, jurisdiction levels or measure types.',
  not_covered: {
    councils: [
      'Bathurst Regional Council — not covered (no connector)',
      'Orange City Council — not covered (no connector)',
      'All other NSW local councils — not covered (no connector)',
    ],
    states: [
      'VIC — not covered (stub)',
      'QLD — not covered (stub)',
      'WA — not covered (stub)',
      'SA — not covered (no connector)',
      'TAS — not covered (no connector)',
      'ACT — not covered (no connector)',
      'NT — not covered (no connector)',
    ],
  },
};

function areaDetail() {
  const measureTypes = [...new Set(AREA_COMBINED_ROWS.map((row) => row.measure_type))].sort();
  return {
    region: DUBBO,
    filters: { fiscal_year: null, measure_type: null, limit: 500 },
    count: AREA_COMBINED_ROWS.length,
    measure_types: measureTypes,
    mixed: true,
    total_cents: null,
    total_measure_type: null,
    total_by_measure_type: [],
    by_function: [],
    measures: AREA_COMBINED_ROWS,
    area_profile: DUBBO_AREA_PROFILE,
  };
}

const MIXED_ROWS = [
  measureRow('m1', NSW._id, 'actual', '2024-25', 200_000_000_000),
  measureRow('m2', NSW._id, 'budget', '2024-25', 210_000_000_000),
  measureRow('m3', NSW._id, 'estimate', '2024-25', 220_000_000_000),
  measureRow('m4', VIC._id, 'actual', '2023-24', 150_000_000_000),
  measureRow('m5', VIC._id, 'budget', '2023-24', 160_000_000_000),
  measureRow('m6', VIC._id, 'estimate', '2023-24', 170_000_000_000),
];

const MIXED_BY_REGION = [
  {
    region: NSW,
    measure_types: ['actual', 'budget', 'estimate'],
    mixed: true,
    total_cents: null,
    total_by_measure_type: perTypeTotals(MIXED_ROWS.filter((row) => row.region_id === NSW._id)),
    measures: MIXED_ROWS.filter((row) => row.region_id === NSW._id),
  },
  {
    region: VIC,
    measure_types: ['actual', 'budget', 'estimate'],
    mixed: true,
    total_cents: null,
    total_by_measure_type: perTypeTotals(MIXED_ROWS.filter((row) => row.region_id === VIC._id)),
    measures: MIXED_ROWS.filter((row) => row.region_id === VIC._id),
  },
];

function functionResponse(rows: typeof MIXED_ROWS, overrides: Record<string, unknown>) {
  return {
    function: { code: '07', name: 'Health', level: 'division' },
    filters: { fiscal_year: null, measure_type: null, region: null, limit: 1000 },
    count: rows.length,
    measure_types: [...new Set(rows.map((row) => row.measure_type))].sort(),
    mixed: false,
    total_cents: 0,
    total_measure_type: null,
    total_by_measure_type: perTypeTotals(rows),
    ranked_states: null,
    by_region: [],
    measures: rows,
    ...overrides,
  };
}

const MIXED_FUNCTION = functionResponse(MIXED_ROWS, {
  measure_types: ['actual', 'budget', 'estimate'],
  mixed: true,
  total_cents: null,
  total_measure_type: null,
  ranked_states: null,
  by_region: MIXED_BY_REGION,
});

const SINGLE_ROWS = [
  measureRow('s1', NSW._id, 'actual', '2024-25', 200_000_000_000),
  measureRow('s2', VIC._id, 'actual', '2024-25', 120_000_000_000),
];

const SINGLE_FUNCTION = functionResponse(SINGLE_ROWS, {
  filters: { fiscal_year: '2024-25', measure_type: 'actual', region: null, limit: 1000 },
  measure_types: ['actual'],
  mixed: false,
  total_cents: 320_000_000_000,
  total_measure_type: 'actual',
  total_by_measure_type: perTypeTotals(SINGLE_ROWS),
  ranked_states: [
    { region: NSW, total_cents: 200_000_000_000 },
    { region: VIC, total_cents: 120_000_000_000 },
  ],
  by_region: [
    {
      region: NSW,
      measure_types: ['actual'],
      mixed: false,
      total_cents: 200_000_000_000,
      total_by_measure_type: perTypeTotals([SINGLE_ROWS[0]]),
      measures: [SINGLE_ROWS[0]],
    },
    {
      region: VIC,
      measure_types: ['actual'],
      mixed: false,
      total_cents: 120_000_000_000,
      total_by_measure_type: perTypeTotals([SINGLE_ROWS[1]]),
      measures: [SINGLE_ROWS[1]],
    },
  ],
});

const FUNCTION_BY_CODE: Record<
  string,
  { code: string; name: string; level: string; parent_code?: string }
> = {
  '07': { code: '07', name: 'Health', level: 'division' },
  '074': { code: '074', name: 'Public health services', level: 'subdivision', parent_code: '07' },
  '09': { code: '09', name: 'Education', level: 'division' },
};

const MIXED_REGION_ROWS = [
  measureRow('r1', AUS._id, 'actual', '2024-25', 300_000_000_000),
  measureRow('r2', AUS._id, 'budget', '2024-25', 310_000_000_000),
  measureRow('r3', AUS._id, 'estimate', '2024-25', 320_000_000_000),
];

const MIXED_REGION = {
  region: AUS,
  filters: { fiscal_year: null, measure_type: null, limit: 1000 },
  count: MIXED_REGION_ROWS.length,
  measure_types: ['actual', 'budget', 'estimate'],
  mixed: true,
  total_cents: null,
  total_measure_type: null,
  total_by_measure_type: perTypeTotals(MIXED_REGION_ROWS),
  by_function: [
    {
      function: { code: '07', name: 'Health', level: 'division' },
      measure_types: ['actual', 'budget', 'estimate'],
      mixed: true,
      total_cents: null,
      total_by_measure_type: perTypeTotals(MIXED_REGION_ROWS),
      measures: MIXED_REGION_ROWS,
    },
  ],
  measures: MIXED_REGION_ROWS,
};

const SINGLE_STATE_ROWS = [measureRow('n1', NSW._id, 'actual', '2024-25', 200_000_000_000)];

const SINGLE_STATE = {
  state: NSW,
  region: NSW,
  filters: { fiscal_year: null, measure_type: null, limit: 1000 },
  count: SINGLE_STATE_ROWS.length,
  measure_types: ['actual'],
  mixed: false,
  total_cents: 200_000_000_000,
  total_measure_type: 'actual',
  total_by_measure_type: perTypeTotals(SINGLE_STATE_ROWS),
  by_function: [
    {
      function: { code: '07', name: 'Health', level: 'division' },
      measure_types: ['actual'],
      mixed: false,
      total_cents: 200_000_000_000,
      total_by_measure_type: perTypeTotals(SINGLE_STATE_ROWS),
      measures: SINGLE_STATE_ROWS,
    },
  ],
  measures: SINGLE_STATE_ROWS,
};

function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row)) ?? [];
    group.push(row);
    groups.set(key(row), group);
  }
  return groups;
}

function breakdownBase(rows: Array<{ measure_type: MockMeasureType; amount_cents: number }>) {
  const measureTypes = [...new Set(rows.map((row) => row.measure_type))].sort();
  const mixed = measureTypes.length > 1;
  return {
    count: rows.length,
    measure_types: measureTypes,
    mixed,
    total_cents: mixed ? null : rows.reduce((sum, row) => sum + row.amount_cents, 0),
    total_by_measure_type: perTypeTotals(rows),
  };
}

function spendingResponse(url: URL) {
  const functionCode = url.searchParams.get('function');
  const regionId = url.searchParams.get('region');
  const fiscalYear = url.searchParams.get('fiscal_year');
  const measureType = url.searchParams.get('measure_type');
  const jurisdictionLevel = url.searchParams.get('jurisdiction_level');
  const minAmount = url.searchParams.get('min_amount');
  const maxAmount = url.searchParams.get('max_amount');
  const text = (url.searchParams.get('q') ?? '').trim();
  const sort = url.searchParams.get('sort') ?? 'amount_desc';
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('page_size') ?? '20');

  // Tokenised, case-insensitive match over the descriptive project fields only:
  // every word must appear in at least one field, in any order.
  const tokens = text ? [...new Set(text.toLowerCase().split(/\s+/).filter(Boolean))] : [];
  const matchesText = (row: Record<string, unknown>) => {
    if (tokens.length === 0) return true;
    return tokens.every((token) =>
      [row.project_name, row.description, row.delivery_entity].some(
        (value) => typeof value === 'string' && value.toLowerCase().includes(token),
      ),
    );
  };

  if (functionCode && !FUNCTION_NAMES[functionCode]) {
    return { status: 404, body: { ok: false, error: `Unknown function code: ${functionCode}` } };
  }

  const areaParam = (url.searchParams.get('area') ?? '').toLowerCase();
  const areaMode =
    areaParam === 'dubbo' ||
    (Boolean(regionId) &&
      !ALL_REGIONS.some((region) => region._id === regionId) &&
      ['dubbo', 'nsw-dubbo'].includes((regionId ?? '').toLowerCase()));
  if (areaMode) {
    let rows = [...AREA_COMBINED_ROWS].filter(matchesText);
    if (fiscalYear) rows = rows.filter((row) => row.fiscal_year === fiscalYear);
    if (measureType) rows = rows.filter((row) => row.measure_type === measureType);
    if (minAmount) rows = rows.filter((row) => row.amount_cents >= Number(minAmount));
    if (maxAmount) rows = rows.filter((row) => row.amount_cents <= Number(maxAmount));
    rows.sort((a, b) => b.amount_cents - a.amount_cents || a.id.localeCompare(b.id));
    const total = rows.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);
    return {
      status: 200,
      body: {
        data: pageRows,
        summary: {
          count: total,
          currency: 'AUD',
          total_cents: null,
          total_measure_type: null,
          total_by_measure_type: [],
          measure_types: [...new Set(rows.map((row) => row.measure_type))].sort(),
          mixed: true,
          breakdown_by_function: [],
          breakdown_by_region: [],
        },
        pagination: {
          page,
          page_size: pageSize,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
        },
        applied_filters: {
          fiscal_year: fiscalYear,
          measure_type: measureType,
          jurisdiction_level: jurisdictionLevel,
          function: functionCode,
          q: text || null,
          region: regionId,
          area: 'dubbo',
          min_amount: minAmount ? Number(minAmount) : null,
          max_amount: maxAmount ? Number(maxAmount) : null,
          sort,
        },
        area_profile: DUBBO_AREA_PROFILE,
      },
    };
  }

  if (regionId && !ALL_REGIONS.some((region) => region._id === regionId)) {
    return { status: 404, body: { ok: false, error: `Unknown region: ${regionId}` } };
  }

  let rows =
    jurisdictionLevel === 'federal'
      ? [...PBS_ROWS]
      : jurisdictionLevel === 'state'
        ? SPENDING_ROWS.filter(
            (row) => 'jurisdiction_level' in row && row.jurisdiction_level === 'state',
          )
        : [...SPENDING_ROWS];
  rows = rows.filter(matchesText);
  if (functionCode) rows = rows.filter((row) => row.function_code === functionCode);
  if (regionId) rows = rows.filter((row) => row.region_id === regionId);
  if (fiscalYear) rows = rows.filter((row) => row.fiscal_year === fiscalYear);
  if (measureType) rows = rows.filter((row) => row.measure_type === measureType);
  if (minAmount) rows = rows.filter((row) => row.amount_cents >= Number(minAmount));
  if (maxAmount) rows = rows.filter((row) => row.amount_cents <= Number(maxAmount));

  rows.sort((a, b) => {
    if (sort === 'amount_asc') return a.amount_cents - b.amount_cents || a.id.localeCompare(b.id);
    if (sort === 'fiscal_year_desc') {
      return b.fiscal_year.localeCompare(a.fiscal_year) || b.amount_cents - a.amount_cents;
    }
    if (sort === 'fiscal_year_asc') {
      return a.fiscal_year.localeCompare(b.fiscal_year) || b.amount_cents - a.amount_cents;
    }
    return b.amount_cents - a.amount_cents || a.id.localeCompare(b.id);
  });

  const total = rows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const summaryBase = breakdownBase(rows);

  const byFunction = [...groupBy(rows, (row) => row.function_code).entries()]
    .map(([code, groupRows]) => {
      const fn = FUNCTION_NAMES[code] ?? FUNCTION_NAMES['07'];
      return {
        function: {
          code,
          name: fn.name,
          level: fn.level,
          ...(fn.parent ? { parent_code: fn.parent } : {}),
        },
        ...breakdownBase(groupRows),
      };
    })
    .sort((a, b) => a.function.code.localeCompare(b.function.code));

  const byRegion = [...groupBy(rows, (row) => row.region_id).entries()]
    .map(([id, groupRows]) => {
      const region = ALL_REGIONS.find((item) => item._id === id) ?? AUS;
      return { region, ...breakdownBase(groupRows) };
    })
    .sort((a, b) => a.region.code.localeCompare(b.region.code));

  return {
    status: 200,
    body: {
      data: pageRows,
      summary: {
        count: total,
        currency: 'AUD',
        total_cents: summaryBase.total_cents,
        total_measure_type:
          summaryBase.measure_types.length === 1 ? summaryBase.measure_types[0] : null,
        total_by_measure_type: summaryBase.total_by_measure_type,
        measure_types: summaryBase.measure_types,
        mixed: summaryBase.mixed,
        breakdown_by_function: byFunction,
        breakdown_by_region: byRegion,
      },
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
      },
      applied_filters: {
        fiscal_year: fiscalYear,
        measure_type: measureType,
        function: functionCode,
        q: text || null,
        region: regionId,
        min_amount: minAmount ? Number(minAmount) : null,
        max_amount: maxAmount ? Number(maxAmount) : null,
        sort,
      },
    },
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * Deterministic API mocks. e2e must not depend on the seeded Mongo database;
 * every route the pages call is fulfilled from these fixtures, including the
 * filter- and pagination-aware spending explorer.
 */
export interface MockApiOptions {
  /** Simulate a database with the synthetic seed retired and no matching real rows. */
  empty?: boolean;
}

function emptySpendingResponse() {
  return {
    data: [],
    summary: {
      count: 0,
      currency: 'AUD',
      total_cents: null,
      total_measure_type: null,
      total_by_measure_type: [],
      measure_types: [],
      mixed: false,
      breakdown_by_function: [],
      breakdown_by_region: [],
    },
    pagination: { page: 1, page_size: 20, total: 0, total_pages: 0, has_next: false },
    applied_filters: {
      fiscal_year: null,
      measure_type: null,
      jurisdiction_level: null,
      function: null,
      q: null,
      region: null,
      min_amount: null,
      max_amount: null,
      sort: 'amount_desc',
    },
  };
}

function emptyRegionDetail(region: typeof AUS) {
  return {
    region,
    filters: { fiscal_year: null, measure_type: null, limit: 1000 },
    count: 0,
    measure_types: [],
    mixed: false,
    total_cents: null,
    total_measure_type: null,
    total_by_measure_type: [],
    by_function: [],
    measures: [],
  };
}

const SOC_RESPONSE = {
  source: {
    source_id: 'waternsw',
    name: 'WaterNSW — Annual Report',
    entity: 'WaterNSW',
    jurisdiction: 'NSW',
    jurisdiction_level: 'soc',
    discovery_page:
      'https://www.waternsw.com.au/about-us/our-business/corporate-governance/annual-reports',
    unit: 'AUD_thousands',
    unit_label: '$’000',
    unit_to_cents: 100_000,
    caveat:
      'Entity-level SOC statement lines for WaterNSW only. Never add to government program spending, to the PNFC sector benchmark, or to each other.',
    label: 'SOC entity statement — never add to government program spending',
    records: 5,
  },
  sources: [
    {
      source_id: 'waternsw',
      name: 'WaterNSW — Annual Report',
      entity: 'WaterNSW',
      jurisdiction: 'NSW',
      jurisdiction_level: 'soc',
      discovery_page:
        'https://www.waternsw.com.au/about-us/our-business/corporate-governance/annual-reports',
      unit: 'AUD_thousands',
      unit_label: '$’000',
      unit_to_cents: 100_000,
      caveat:
        'Entity-level SOC statement lines for WaterNSW only. Never add to government program spending, to the PNFC sector benchmark, or to each other.',
      label: 'SOC entity statement — never add to government program spending',
      records: 5,
    },
  ],
  fiscal_years: ['2024-25'],
  entities: ['WaterNSW'],
  series: [
    {
      id: 'soc-face-total-revenue',
      source_id: 'waternsw',
      source_url:
        'https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf',
      source_dataset: 'WaterNSW Annual Report 2024-25',
      fiscal_year: '2024-25',
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'WaterNSW',
      funding_source: 'WaterNSW',
      soc_line_item: 'total_revenue',
      soc_line_label: 'Total revenue',
      soc_unit: 'AUD_thousands',
      soc_section: 'revenue',
      soc_note: 'Face statement',
      soc_component_of: null,
      soc_breakdown: null,
      soc_printed_sign: 'positive',
      measure_type: 'actual',
      amount_cents: 49_500_400_000,
      potential_double_count: false,
      verified: false,
      data_quality_flag: 'provisional',
      extraction_confidence: 'high',
      aggregation_role: 'agency_detail',
      location_state: 'NSW',
    },
    {
      id: 'soc-note2-greater-sydney',
      source_id: 'waternsw',
      source_url:
        'https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf',
      source_dataset: 'WaterNSW Annual Report 2024-25',
      fiscal_year: '2024-25',
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'WaterNSW',
      funding_source: 'WaterNSW',
      soc_line_item: 'water_supply_regulated_greater_sydney',
      soc_line_label: 'Regulated - Greater Sydney',
      soc_unit: 'AUD_thousands',
      soc_section: 'revenue',
      soc_note: 'Note 2 Revenue from water supply and delivery',
      soc_component_of: 'revenue_from_water_supply_and_delivery',
      soc_breakdown: 'water_supply_segment',
      soc_printed_sign: 'positive',
      measure_type: 'actual',
      amount_cents: 22_454_000_000,
      potential_double_count: false,
      verified: false,
      data_quality_flag: 'provisional',
      extraction_confidence: 'high',
      aggregation_role: 'agency_detail',
      location_state: 'NSW',
    },
    {
      id: 'soc-note6-contractors',
      source_id: 'waternsw',
      source_url:
        'https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf',
      source_dataset: 'WaterNSW Annual Report 2024-25',
      fiscal_year: '2024-25',
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'WaterNSW',
      funding_source: 'WaterNSW',
      soc_line_item: 'other_operating_contractors',
      soc_line_label: 'Contractors',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Note 6 Other operating expenses',
      soc_component_of: 'other_operating_expenses',
      soc_breakdown: 'other_operating_expense_category',
      soc_printed_sign: 'positive',
      measure_type: 'actual',
      amount_cents: 2_692_700_000,
      potential_double_count: false,
      verified: false,
      data_quality_flag: 'provisional',
      extraction_confidence: 'high',
      aggregation_role: 'agency_detail',
      location_state: 'NSW',
    },
    {
      id: 'soc-note5-capitalisation',
      source_id: 'waternsw',
      source_url:
        'https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf',
      source_dataset: 'WaterNSW Annual Report 2024-25',
      fiscal_year: '2024-25',
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'WaterNSW',
      funding_source: 'WaterNSW',
      soc_line_item: 'employee_expenses_capitalisation',
      soc_line_label: 'Capitalisation of employee related expenses',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Note 5 Employee related expenses',
      soc_component_of: 'employee_expenses',
      soc_breakdown: 'employee_expense_component',
      soc_printed_sign: 'negative',
      measure_type: 'actual',
      amount_cents: 4_383_800_000,
      potential_double_count: false,
      verified: false,
      data_quality_flag: 'provisional',
      extraction_confidence: 'high',
      aggregation_role: 'agency_detail',
      location_state: 'NSW',
    },
    {
      id: 'soc-capex-cash',
      source_id: 'waternsw',
      source_url:
        'https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf',
      source_dataset: 'WaterNSW Annual Report 2024-25',
      fiscal_year: '2024-25',
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'WaterNSW',
      funding_source: 'WaterNSW',
      soc_line_item: 'capital_expenditure_cash',
      soc_line_label: 'Payments for property, plant and equipment and intangibles',
      soc_unit: 'AUD_thousands',
      soc_section: 'capital',
      soc_note: 'Statement of cash flows — investing activities',
      soc_component_of: null,
      soc_breakdown: 'capital_expenditure',
      soc_printed_sign: 'negative',
      measure_type: 'actual',
      amount_cents: 17_082_800_000,
      potential_double_count: false,
      verified: false,
      data_quality_flag: 'provisional',
      extraction_confidence: 'high',
      aggregation_role: 'agency_detail',
      location_state: 'NSW',
    },
  ],
  deferred_documents: [],
  counts: {
    series: 5,
    by_line: {
      total_revenue: 1,
      water_supply_regulated_greater_sydney: 1,
      other_operating_contractors: 1,
      employee_expenses_capitalisation: 1,
      capital_expenditure_cash: 1,
    },
    by_entity: { WaterNSW: 5 },
    by_section: { revenue: 2, expenses: 2, capital: 1 },
    by_note: {
      'Face statement': 1,
      'Note 2 Revenue from water supply and delivery': 1,
      'Note 5 Employee related expenses': 1,
      'Note 6 Other operating expenses': 1,
      'Statement of cash flows — investing activities': 1,
    },
    potential_double_count: 0,
    deferred_documents: 0,
  },
  note: 'Entity-level SOC statement lines for WaterNSW. No total is computed here. Note-level rows are components of their printed subtotals and are never additional spending.',
};

export async function mockApi(page: Page, options: MockApiOptions = {}) {
  const empty = options.empty === true;
  const coverage = empty
    ? {
        ...COVERAGE,
        synthetic: false,
        synthetic_measures: 0,
        real_measures: COVERAGE.counts.measures,
        counts: { ...COVERAGE.counts, synthetic_measures: 0 },
      }
    : COVERAGE;

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      const measureType = url.searchParams.get('measure_type');
      const fiscalYear = url.searchParams.get('fiscal_year');

      if (path === '/api/health') {
        await json(route, { ok: true, db: 'unavailable' });
        return;
      }

      if (path === '/api/meta/coverage') {
        await json(route, coverage);
        return;
      }

      if (path === '/api/data-sources') {
        const sources = [
          AUS_TENDER_SOURCE,
          PBS_SOURCE,
          NSW_BUDGET_SOURCE,
          NSW_CKAN_SOURCE,
          DUBBO_SOURCE,
          GRANTCONNECT_SOURCE,
          WATERNSW_SOURCE,
        ];
        await json(route, {
          sources: empty ? sources : [SYNTHETIC_SOURCE, ...sources],
        });
        return;
      }

      if (path === '/api/soc') {
        await json(route, SOC_RESPONSE);
        return;
      }

      if (path === '/api/functions') {
        await json(route, { functions: DIVISIONS });
        return;
      }

      if (path === '/api/regions') {
        const type = url.searchParams.get('type');
        const stateCode = url.searchParams.get('state');
        const limit = Number(url.searchParams.get('limit') ?? '50');
        let regions = [...ALL_REGIONS];
        if (type) regions = regions.filter((region) => region.level === type);
        if (stateCode) {
          regions = regions.filter((region) => region.parent_code === stateCode.toUpperCase());
        }
        if (q) {
          regions = regions.filter(
            (region) =>
              region.code.toLowerCase().includes(q) || region.name.toLowerCase().includes(q),
          );
        }
        regions.sort(
          (a, b) =>
            (a.level === 'national' ? 0 : a.level === 'state' ? 1 : 2) -
              (b.level === 'national' ? 0 : b.level === 'state' ? 1 : 2) ||
            a.code.localeCompare(b.code),
        );
        const sliced = regions.slice(0, limit);
        await json(route, { regions: sliced, count: sliced.length });
        return;
      }

      if (path === '/api/spending') {
        if (empty) {
          await json(route, emptySpendingResponse());
          return;
        }
        const response = spendingResponse(url);
        await json(route, response.body, response.status);
        return;
      }

      if (path.startsWith('/api/spending/')) {
        const id = decodeURIComponent(path.slice('/api/spending/'.length));
        const row = SPENDING_ROWS.find((candidate) => candidate.id === id);
        await json(route, row ?? { ok: false, error: `Unknown measure: ${id}` }, row ? 200 : 404);
        return;
      }

      if (path === '/api/search') {
        if (q === 'health') {
          await json(route, {
            q: 'health',
            regions: [],
            functions: [FUNCTION_BY_CODE['07'], FUNCTION_BY_CODE['074']],
            count: 2,
          });
          return;
        }
        if (q === 'nsw' || q === 'new') {
          await json(route, { q, regions: [NSW], functions: [], count: 1 });
          return;
        }
        if (q === 'aus') {
          await json(route, { q: 'AUS', regions: [AUS], functions: [], count: 1 });
          return;
        }
        await json(route, { q, regions: [], functions: [], count: 0 });
        return;
      }

      if (path === '/api/functions/07') {
        if (empty) {
          await json(
            route,
            functionResponse([], {
              count: 0,
              measure_types: [],
              mixed: false,
              total_cents: null,
              total_measure_type: null,
              total_by_measure_type: [],
              ranked_states: null,
              by_region: [],
            }),
          );
          return;
        }
        await json(route, measureType || fiscalYear ? SINGLE_FUNCTION : MIXED_FUNCTION);
        return;
      }

      if (path.startsWith('/api/functions/')) {
        await json(route, { ok: false, error: 'Unknown function code: 99' }, 404);
        return;
      }

      if (
        path === '/api/regions/dubbo' ||
        path === '/api/region/dubbo' ||
        path === '/api/areas/dubbo'
      ) {
        await json(route, areaDetail());
        return;
      }

      if (path === `/api/regions/${AUS._id}`) {
        await json(route, empty ? emptyRegionDetail(AUS) : MIXED_REGION);
        return;
      }

      if (path === `/api/regions/${NSW._id}`) {
        await json(route, empty ? emptyRegionDetail(NSW) : SINGLE_STATE);
        return;
      }

      if (path === '/api/states/NSW') {
        await json(route, empty ? { ...emptyRegionDetail(NSW), state: NSW } : SINGLE_STATE);
        return;
      }

      if (path.startsWith('/api/states/')) {
        const code = decodeURIComponent(path.slice('/api/states/'.length)).toUpperCase();
        await json(route, { ok: false, error: `Unknown state/territory code: ${code}` }, 404);
        return;
      }

      if (path.startsWith('/api/regions/')) {
        await json(route, { ok: false, error: 'Unknown region' }, 404);
        return;
      }

      await json(route, { ok: false, error: 'Not found' }, 404);
    },
  );
}

export const MOCK_IDS = { AUS: AUS._id, NSW: NSW._id, VIC: VIC._id, DUBBO: DUBBO._id };
