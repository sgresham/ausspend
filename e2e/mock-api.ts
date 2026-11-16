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

const ALL_REGIONS = [AUS, NSW, VIC, QLD];

const COVERAGE = {
  phase: 'Phase 1 + F2/F3 (AusTender + PBS live)',
  synthetic: true,
  live_ingestion: true,
  generated_at: '2026-11-16T00:00:00.000Z',
  counts: { data_sources: 3, regions: ALL_REGIONS.length, functions: 53, measures: 822 },
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
      name: 'GrantConnect — Australian Government grants',
      publisher: 'Australian Government Department of Finance',
      source_url: 'https://www.grants.gov.au/',
      status: 'stub',
      jurisdiction_level: 'federal',
      last_fetched_at: null,
      records_ingested: 0,
      errors: [],
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
  connector_status_counts: { active: 3, degraded: 0, stub: 8 },
  supported_measure_types: ['actual', 'budget', 'estimate', 'contract', 'grant_award'],
  state_ingestion: {
    live: ['nsw-budget'],
    degraded: [],
    stubs: ['vic-budget', 'qld-budget', 'wa-budget'],
    note: 'NSW Budget 2025-26 Open Data is live; Victoria, Queensland and Western Australia remain stubs.',
  },
  federal_ingestion: {
    live: ['aus-tender', 'data-gov-au-pbs'],
    degraded: [],
    pending: ['grantconnect'],
    stubs: ['federal-budget-portal', 'abs-government-finance', 'aihw-health-expenditure', 'aofm'],
    aus_tender_last_ingested_at: '2026-11-16T00:05:00.000Z',
    pbs_last_ingested_at: '2026-11-16T00:06:00.000Z',
    pbs_caveat:
      'PBS CSV line items are entity program tables; their sum does not equal the Budget Paper 1 total general government expense, so it is not the federal total.',
    note: 'AusTender OCDS contracts and data.gov.au PBS budget line items are live. GrantConnect remains pending; every other source is a stub. PBS line items do not sum to the Budget Paper 1 total general government expense.',
  },
  limitations: [
    'Mixed data: live AusTender contract rows and PBS budget line items sit alongside the synthetic development seed. The seed values remain deterministic placeholders, not published Australian government spending.',
    'No records are human-verified: seeded measures, ingested AusTender contracts and ingested PBS budget rows all carry verified: false.',
    'AusTender OCDS contractPublished ingestion and data.gov.au PBS program-expense ingestion are live. GrantConnect is not implemented (pending stub); the other registered federal connectors are stubs and make no network call.',
    'PBS CSV line items are entity program tables; their sum does not equal the Budget Paper 1 total general government expense, so it is not the federal total.',
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
  const sort = url.searchParams.get('sort') ?? 'amount_desc';
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('page_size') ?? '20');

  if (functionCode && !FUNCTION_NAMES[functionCode]) {
    return { status: 404, body: { ok: false, error: `Unknown function code: ${functionCode}` } };
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
export async function mockApi(page: Page) {
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
        await json(route, COVERAGE);
        return;
      }

      if (path === '/api/data-sources') {
        await json(route, {
          sources: [SYNTHETIC_SOURCE, AUS_TENDER_SOURCE, PBS_SOURCE, NSW_BUDGET_SOURCE],
        });
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
        await json(route, measureType || fiscalYear ? SINGLE_FUNCTION : MIXED_FUNCTION);
        return;
      }

      if (path.startsWith('/api/functions/')) {
        await json(route, { ok: false, error: 'Unknown function code: 99' }, 404);
        return;
      }

      if (path === `/api/regions/${AUS._id}`) {
        await json(route, MIXED_REGION);
        return;
      }

      if (path === `/api/regions/${NSW._id}`) {
        await json(route, SINGLE_STATE);
        return;
      }

      if (path === '/api/states/NSW') {
        await json(route, SINGLE_STATE);
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

export const MOCK_IDS = { AUS: AUS._id, NSW: NSW._id, VIC: VIC._id };
