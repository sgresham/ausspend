import type { Page, Route } from '@playwright/test';

const SYNTHETIC_SOURCE = {
  source_id: 'synthetic-seed',
  name: 'Synthetic development seed (not real spending)',
  publisher: 'ausspend development team',
  source_url: '/data-sources#synthetic-seed',
  retrieved_at: '2026-11-16T00:00:00.000Z',
  license: 'Synthetic data — no reuse rights implied',
  verified: false,
  notes:
    'Deterministic placeholder values generated for development. Not sourced from, and not a substitute for, any published Australian government figure.',
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

function measureRow(
  id: string,
  regionId: string,
  measureType: 'actual' | 'budget' | 'estimate',
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
    measures: MIXED_ROWS.filter((row) => row.region_id === NSW._id),
  },
  {
    region: VIC,
    measure_types: ['actual', 'budget', 'estimate'],
    mixed: true,
    total_cents: null,
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
      measures: [SINGLE_ROWS[0]],
    },
    {
      region: VIC,
      measure_types: ['actual'],
      mixed: false,
      total_cents: 120_000_000_000,
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
  by_function: [
    {
      function: { code: '07', name: 'Health', level: 'division' },
      measure_types: ['actual', 'budget', 'estimate'],
      mixed: true,
      total_cents: null,
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
  by_function: [
    {
      function: { code: '07', name: 'Health', level: 'division' },
      measure_types: ['actual'],
      mixed: false,
      total_cents: 200_000_000_000,
      measures: SINGLE_STATE_ROWS,
    },
  ],
  measures: SINGLE_STATE_ROWS,
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * Deterministic API mocks. e2e must not depend on the seeded Mongo database;
 * every route the six pages call is fulfilled from these fixtures.
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

      if (path === '/api/data-sources') {
        await json(route, { sources: [SYNTHETIC_SOURCE] });
        return;
      }

      if (path === '/api/functions') {
        await json(route, { functions: DIVISIONS });
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
        if (q === 'nsw') {
          await json(route, { q: 'NSW', regions: [NSW], functions: [], count: 1 });
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

export const MOCK_IDS = { AUS: AUS._id, NSW: NSW._id };
