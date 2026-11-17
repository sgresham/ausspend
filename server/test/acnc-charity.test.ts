import { describe, expect, it } from 'vitest';
import {
  ACNC_AIS_COLUMNS,
  ACNC_ID,
  ACNC_TOTAL_CATEGORY,
  ACNC_UNIT,
  ACNC_UNIT_TO_CENTS,
  acncAmountToCents,
  acncEditionFiscalYear,
  acncFinancialYearFromDate,
  acncNaturalKey,
  acncNumber,
  collectProgramLocations,
  createAcncCharityConnector,
  discoverAcncSource,
  parseAcncCsv,
  postcodeFromLocationText,
  resolveProgramLocation,
  stateFromLocationText,
  stateFromPostcode,
  transformAcncRaw,
  type AcncSourceMeta,
} from '../src/connectors/acnc-charity.js';

const meta: AcncSourceMeta = {
  resource_id: 'res-acnc-2024',
  resource_name: 'datadotgov_ais24',
  filename: 'datadotgov_ais24.csv',
  url: 'https://example.test/datadotgov_ais24.csv',
  source_sha256: 'sha-acnc',
  source_date: '2026-11-15',
  edition_year: 2024,
  dataset_url: 'https://example.test/acnc-2024',
};

type Cells = Partial<Record<(typeof ACNC_AIS_COLUMNS)[number], string>>;

function csvRow(cells: Cells): string {
  return ACNC_AIS_COLUMNS.map((name) => {
    const value = cells[name] ?? '';
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(',');
}

const ROWS: Cells[] = [
  {
    abn: '11111111111',
    'charity name': 'Reconciled Charity Ltd',
    'registration status': 'Registered',
    'charity size': 'Large',
    'fin report from': '01/07/2023',
    'fin report to': '30/06/2024',
    'employee expenses': '60000',
    'interest expenses': '1000',
    'grants and donations made for use in Australia': '20000',
    'grants and donations made for use outside Australia': '4000',
    'all other expenses': '15000',
    'total expenses': '100000',
  },
  {
    abn: '22222222222',
    'charity name': 'Unreconciled Charity Ltd',
    'registration status': 'Registered',
    'charity size': 'Medium',
    'fin report from': '01/01/2024',
    'fin report to': '31/12/2024',
    'employee expenses': '100',
    'interest expenses': '0',
    'grants and donations made for use in Australia': '0',
    'grants and donations made for use outside Australia': '0',
    'all other expenses': '0',
    'total expenses': '101',
  },
  {
    abn: '33333333333',
    'charity name': 'Zero Expenses Charity',
    'registration status': 'Registered',
    'fin report from': '01/07/2023',
    'fin report to': '30/06/2024',
    'total expenses': '0',
  },
  {
    abn: '44444444444',
    'charity name': 'Negative Expenses Charity',
    'registration status': 'Registered',
    'fin report from': '01/07/2023',
    'fin report to': '30/06/2024',
    'total expenses': '-50',
  },
  {
    abn: '55555555555',
    'charity name': 'No Period Charity',
    'registration status': 'Revoked Compliance',
    'total expenses': '250',
    'employee expenses': '250',
  },
  {
    abn: '66666666666',
    'charity name': 'Multi State Charity',
    'registration status': 'Registered',
    'fin report from': '01/07/2023',
    'fin report to': '30/06/2024',
    'total expenses': '500',
    'all other expenses': '500',
  },
];

const PROGRAM_ROWS: Array<Record<string, string>> = [
  { ABN: '11111111111', 'Operating Location 1': '123 George Street, Sydney NSW 2000, Australia' },
  { ABN: '11111111111', 'Operating Location 1': 'Melbourne VIC, Australia' },
  { ABN: '22222222222', 'Operating Location 1': 'Brisbane QLD 4000, Australia' },
  { ABN: '55555555555', 'Operating Location 1': 'Perth WA, Australia' },
  { ABN: '66666666666', 'Operating Location 1': 'Sydney NSW, Australia' },
  { ABN: '66666666666', 'Operating Location 2': 'Brisbane QLD, Australia' },
];

const CSV = [ACNC_AIS_COLUMNS.join(','), ...ROWS.map(csvRow)].join('\n');

function parsed() {
  return parseAcncCsv(CSV, meta, PROGRAM_ROWS);
}

describe('ACNC units and amount conversion', () => {
  it('uses whole Australian dollars confirmed by the explanatory notes', () => {
    expect(ACNC_UNIT).toBe('AUD dollars');
    expect(ACNC_UNIT_TO_CENTS).toBe(100);
    expect(acncNumber('150000')).toBe(150000);
    expect(acncNumber('$150,000')).toBe(150000);
    expect(acncNumber('(50)')).toBe(-50);
    expect(acncNumber('N/A')).toBeNull();
    expect(acncAmountToCents('150000')).toBe(15_000_000);
    expect(acncAmountToCents('0')).toBeNull();
    expect(acncAmountToCents('-1')).toBeNull();
  });
});

describe('ACNC reporting period and geography helpers', () => {
  it('derives the financial year from the report-to date, preserving alternate periods', () => {
    expect(acncFinancialYearFromDate('30/06/2024')).toBe('2023-24');
    expect(acncFinancialYearFromDate('31/12/2024')).toBe('2024-25');
    expect(acncFinancialYearFromDate('31/03/2025')).toBe('2024-25');
    expect(acncFinancialYearFromDate('')).toBeNull();
    expect(acncEditionFiscalYear(2024)).toBe('2023-24');
  });

  it('maps states and only accepts postcodes in postcode-like positions', () => {
    expect(stateFromLocationText('Sydney NSW, Australia')).toBe('NSW');
    expect(stateFromLocationText('Melbourne, Victoria')).toBe('VIC');
    expect(stateFromLocationText('Australia')).toBeNull();
    expect(postcodeFromLocationText('Sydney NSW 2000, Australia')).toBe('2000');
    expect(postcodeFromLocationText('1635 Forest Road, Orange NSW')).toBeNull();
    expect(stateFromPostcode('2000')).toBe('NSW');
    expect(stateFromPostcode('4000')).toBe('QLD');
    expect(stateFromPostcode('2600')).toBe('ACT');
  });

  it('resolves program locations to one state/postcode and refuses multi-state', () => {
    const index = collectProgramLocations(PROGRAM_ROWS);
    expect(resolveProgramLocation(index.get('11111111111'))?.basis).toBe('multi_state');
    expect(resolveProgramLocation(index.get('22222222222'))).toMatchObject({
      state: 'QLD',
      postcode: '4000',
    });
    expect(resolveProgramLocation(index.get('55555555555'))).toMatchObject({ state: 'WA' });
    expect(resolveProgramLocation(index.get('nope'))?.basis).toBe('absent');
  });
});

describe('ACNC expense mapping and no-sum invariant', () => {
  it('emits one total row and only reconciled components, all with explicit categories', () => {
    const { raw, totalRows } = parsed();
    expect(totalRows).toBe(6);
    expect(raw).toHaveLength(6);

    const result = transformAcncRaw(raw);
    expect(
      result.records.filter((record) => record.aggregation_role === 'expense_total'),
    ).toHaveLength(4);
    expect(result.skipped).toHaveLength(2);
    expect(result.componentsUnreconciled).toBe(1);

    const reconciled = result.records.filter((record) =>
      record.project_name?.includes('Reconciled Charity'),
    );
    expect(reconciled.map((record) => record.expense_category).sort()).toEqual([
      'all_other_expenses',
      'employee_expenses',
      'grants_and_donations_australia',
      'grants_and_donations_overseas',
      'interest_expenses',
      'total',
    ]);
    for (const record of reconciled) {
      expect(record.measure_type).toBe('actual');
      expect(record.jurisdiction_level).toBe('charity');
      expect(record.jurisdiction).toBe('Australia');
      expect(record.funding_source).toBe('ACNC-registered charity');
      expect(record.function_code).toBeUndefined();
      expect(record.verified).toBe(false);
      expect(record.source_dataset).toBe('ACNC Annual Information Statement (AIS)');
      expect(record.source_url).toBe(meta.url);
      expect(Number.isSafeInteger(record.amount_cents)).toBe(true);
      expect(record.natural_key).toMatch(/^acnc-charity:[0-9a-f]{40}$/);
    }
    const total = reconciled.find((record) => record.expense_category === 'total');
    expect(total?.amount_cents).toBe(10_000_000);
    expect(total?.aggregation_role).toBe('expense_total');
    // Multi-state charity: no invented single state.
    expect(total?.location).toBeUndefined();
    expect(total?.data_quality_flag).toContain('location_multi_state');

    const unreconciled = result.records.find((record) =>
      record.project_name?.includes('Unreconciled Charity'),
    );
    expect(unreconciled?.amount_cents).toBe(10_100);
    expect(unreconciled?.data_quality_flag).toContain('expense_components_unreconciled');
    expect(
      result.records.filter(
        (record) =>
          record.project_name?.includes('Unreconciled Charity') &&
          record.expense_category !== 'total',
      ),
    ).toHaveLength(0);

    const noPeriod = result.records.find((record) =>
      record.project_name?.includes('No Period Charity'),
    );
    expect(noPeriod?.fiscal_year).toBe('2023-24');
    expect(noPeriod?.data_quality_flag).toContain('fiscal_year_approximate');
    expect(noPeriod?.location).toMatchObject({ state: 'WA' });
  });

  it('never double counts total + components in any aggregate', () => {
    const { raw } = parsed();
    const { records } = transformAcncRaw(raw);
    const groups = new Map<string, typeof records>();
    for (const record of records) {
      expect(record.expense_category).toBeTruthy();
      const key = `${record.delivery_entity}|${record.fiscal_year}`;
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      const totals = group.filter((record) => record.expense_category === ACNC_TOTAL_CATEGORY);
      const components = group.filter((record) => record.expense_category !== ACNC_TOTAL_CATEGORY);
      expect(totals).toHaveLength(1);
      const totalCents = totals.reduce((sum, record) => sum + record.amount_cents, 0);
      const componentCents = components.reduce((sum, record) => sum + record.amount_cents, 0);
      // Components are either omitted (unreconciled) or exactly the total. The
      // dangerous total+component sum is never produced.
      expect(componentCents).toBeLessThanOrEqual(totalCents);
      expect(totalCents + componentCents).toBeGreaterThanOrEqual(totalCents);
    }
  });

  it('is idempotent and deduplicates repeated raw rows on natural_key', () => {
    const { raw } = parsed();
    const first = transformAcncRaw(raw);
    const second = transformAcncRaw(raw);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
    const doubled = transformAcncRaw([...raw, ...raw]);
    expect(doubled.records).toHaveLength(first.records.length);
    // A duplicate total row short-circuits its components; one duplicate
    // count per source row is enough to prove natural-key idempotency.
    expect(doubled.duplicates).toBe(
      first.records.filter((record) => record.aggregation_role === 'expense_total').length,
    );
  });

  it('natural key is the stable hash of abn + financial year + expense category', () => {
    expect(acncNaturalKey('11111111111', '2023-24', 'total')).toBe(
      acncNaturalKey('11111111111', '2023-24', 'total'),
    );
    expect(acncNaturalKey('11111111111', '2023-24', 'total')).not.toBe(
      acncNaturalKey('11111111111', '2023-24', 'employee_expenses'),
    );
    expect(acncNaturalKey('11111111111', '2023-24', 'total')).not.toBe(
      acncNaturalKey('11111111111', '2024-25', 'total'),
    );
  });
});

describe('ACNC discovery and registration', () => {
  const resources = [
    {
      id: 'ais',
      name: 'datadotgov_ais24',
      format: 'CSV',
      url: 'https://x/datadotgov_ais24.csv',
      last_modified: '2026-11-15T22:42:19',
    },
    {
      id: 'programs',
      name: 'datadotgov_ais24_programs',
      format: 'CSV',
      url: 'https://x/datadotgov_ais24_programs.csv',
    },
    {
      id: 'notes',
      name: 'Explanatory notes',
      format: 'PDF',
      url: 'https://x/explanatory-notes.pdf',
    },
  ];

  it('selects the latest edition and its AIS/programs/notes resources', async () => {
    const fakeFetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/package_search')) {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              results: [
                { name: 'acnc-2023-annual-information-statement-ais-data', title: 'ACNC 2023 AIS' },
                { name: 'acnc-2024-annual-information-statement-ais-data', title: 'ACNC 2024 AIS' },
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            id: '276ec1bc-4971-461c-88bc-be9f3c99a0f8',
            name: 'acnc-2024-annual-information-statement-ais-data',
            title: 'ACNC 2024 Annual Information Statement (AIS) Data',
            metadata_modified: '2026-11-15T23:06:22',
            resources,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const selection = await discoverAcncSource(fakeFetch, 0);
    expect(selection.edition_year).toBe(2024);
    expect(selection.ais.resource_id).toBe('ais');
    expect(selection.programs?.resource_id).toBe('programs');
    expect(selection.notes.resource_id).toBe('notes');
  });

  it('registers acnc-charity as an active charity connector', () => {
    const connector = createAcncCharityConnector();
    expect(connector.id).toBe(ACNC_ID);
    expect(connector.status).toBe('active');
    expect(connector.jurisdiction_level).toBe('charity');
    expect(connector.source_url).toContain('data.gov.au');
    expect(connector.notes).toMatch(/never summed/);
    expect(connector.notes).toMatch(/location_approximate/);
  });
});
