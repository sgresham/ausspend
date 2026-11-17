import { describe, expect, it } from 'vitest';
import {
  QGIP_COLUMNS,
  QGIP_DATASET_ID,
  QGIP_EARLIER_YEARS,
  QGIP_FISCAL_YEAR,
  QGIP_ID,
  QGIP_PARTIAL_YEARS,
  QGIP_UNIT,
  QGIP_UNIT_TO_CENTS,
  createQgipConnector,
  discoverQgipSource,
  isApproximateLocation,
  isSentinelPostcode,
  parseQgipCsv,
  qgipAmountToCents,
  qgipFiscalYearLabel,
  qgipMeasureType,
  qgipNaturalKey,
  qgipNumber,
  qgipResourceYear,
  qgipRowHash,
  selectAnnualResources,
  selectLatestAnnualResource,
  transformQgipRaw,
  type QgipSourceMeta,
} from '../src/connectors/qld-qgip.js';

const meta: QgipSourceMeta = {
  resource_id: 'res-qgip-2024-25',
  resource_name: '2024-25 consolidated QGIP expenditure',
  filename: '2024-25-expenditure-consolidated.csv',
  url: 'https://example.test/2024-25-expenditure-consolidated.csv',
  source_sha256: 'sha-qgip',
  source_date: '2025-12-18',
  fiscal_year: '2024-25',
};

type Cells = Partial<Record<(typeof QGIP_COLUMNS)[number], string>>;

function csvRow(cells: Cells): string {
  return QGIP_COLUMNS.map((name) => {
    const value = cells[name] ?? '';
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(',');
}

const ROWS: Cells[] = [
  {
    'Australian Business Number (ABN)': '14640793728',
    'Legal entity name': 'PALM ISLAND COMMUNITY COMPANY LTD',
    'Service delivery postcode': '4810',
    'Service delivery suburb/locality': 'Townsville',
    'Service delivery LGA': 'Townsville (C)',
    'Funding agency': 'DCSODSFB',
    'Program title': 'Palm Island Digital Service Centre',
    'Sub-program title': 'Digital Services',
    Statewide: 'No',
    Purpose: 'To support the establishment of the Palm Island Digital Service Centre',
    Category1: 'Employment and jobs',
    'Recipient type': 'Local government',
    'Assistance type1': 'Grant',
    'Funding source': 'Queensland Government',
    'Funding use': 'Operational',
    'Financial year expenditure': '150000',
    'Funding agreement duration': 'Multi-year',
  },
  {
    'Legal entity name': 'WUGU NYAMBIL LTD',
    'Service delivery postcode': '4871',
    'Service delivery suburb/locality': 'Yarrabah',
    'Service delivery LGA': 'Yarrabah (S)',
    'Funding agency': 'DoE',
    'Program title': 'Yarrabah Digital Service Centre',
    Statewide: 'No',
    'Assistance type1': 'Frontline service procurement',
    'Funding source': 'Queensland Government',
    'Financial year expenditure': '52500',
  },
  {
    'Legal entity name': 'CONCESSION RECIPIENT',
    'Funding agency': 'DoE',
    'Program title': 'Electricity concession',
    'Assistance type1': 'Concession',
    'Funding source': 'Queensland Government',
    'Financial year expenditure': '1000',
  },
  {
    'Legal entity name': 'ZERO GRANT RECIPIENT',
    'Funding agency': 'DoE',
    'Program title': 'Zero dollar grant',
    'Assistance type1': 'Grant',
    'Funding source': 'Queensland Government',
    'Financial year expenditure': '0',
  },
  {
    'Legal entity name': 'STATEWIDE GRANT RECIPIENT',
    'Funding agency': 'QH',
    'Program title': 'Statewide health grant',
    Statewide: 'Yes',
    'Assistance type1': 'Grant',
    'Funding source': 'Combined',
    'Financial year expenditure': '90000',
  },
  {
    'Legal entity name': 'MULTI LGA GRANT RECIPIENT',
    'Service delivery postcode': '1111',
    'Funding agency': 'DTMR',
    'Program title': 'Multi-LGA transport grant',
    Statewide: 'No',
    'Assistance type1': 'Grant',
    'Funding source': 'Queensland Government',
    'Financial year expenditure': '42000',
  },
];

const CSV = [QGIP_COLUMNS.join(','), ...ROWS.map(csvRow)].join('\n');

describe('QGIP units and amount conversion', () => {
  it('uses whole Australian dollars as confirmed by the data dictionary', () => {
    expect(QGIP_UNIT).toBe('AUD dollars');
    expect(QGIP_UNIT_TO_CENTS).toBe(100);
    expect(qgipNumber('150000')).toBe(150000);
    expect(qgipNumber('$150,000.50')).toBe(150000.5);
    expect(qgipNumber('N/A')).toBeNull();
    expect(qgipAmountToCents('150000')).toBe(15_000_000);
    expect(qgipAmountToCents(0.5)).toBe(50);
    expect(qgipAmountToCents('0')).toBeNull();
    expect(qgipAmountToCents('-5')).toBeNull();
  });
});

describe('QGIP grant vs contract classification', () => {
  it('maps only Grant and Frontline service procurement, rejects the rest', () => {
    expect(qgipMeasureType('Grant')).toBe('grant_award');
    expect(qgipMeasureType('Frontline service procurement')).toBe('contract');
    expect(qgipMeasureType('Concession')).toBeNull();
    expect(qgipMeasureType('Loan')).toBeNull();
    expect(qgipMeasureType('Direct government investment')).toBeNull();
  });
});

describe('QGIP row parsing and mapping', () => {
  it('parses all rows and keeps grant/contract rows only', () => {
    const { raw, totalRows } = parseQgipCsv(CSV, meta);
    expect(totalRows).toBe(6);
    expect(raw).toHaveLength(6);

    const result = transformQgipRaw(raw);
    expect(result.records).toHaveLength(4);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.some((entry) => /Concession: out of scope/.test(entry.reason))).toBe(
      true,
    );
    expect(result.skipped.some((entry) => /zero\/negative/.test(entry.reason))).toBe(true);

    // Source row count reconciles: 6 rows = 4 ingested + 2 rejected.
    expect(totalRows).toBe(result.records.length + result.skipped.length);
    expect(result.records.filter((record) => record.measure_type === 'grant_award')).toHaveLength(
      3,
    );
    expect(result.records.filter((record) => record.measure_type === 'contract')).toHaveLength(1);
  });

  it('builds state/QLD integer-cent records with provenance and no COFOG', () => {
    const { raw } = parseQgipCsv(CSV, meta);
    const { records } = transformQgipRaw(raw);
    for (const record of records) {
      expect(record.source_id).toBe(QGIP_ID);
      expect(['grant_award', 'contract']).toContain(record.measure_type);
      expect(record.jurisdiction_level).toBe('state');
      expect(record.jurisdiction).toBe('QLD');
      expect(record.fiscal_year).toBe(QGIP_FISCAL_YEAR);
      expect(record.location?.state).toBe('QLD');
      expect(record.function_code).toBeUndefined();
      expect(record.verified).toBe(false);
      expect(record.source_url).toBe(meta.url);
      expect(record.aggregation_role).toBe('additive');
      expect(Number.isSafeInteger(record.amount_cents)).toBe(true);
      expect(record.natural_key).toMatch(/^qld-qgip:[0-9a-f]{40}$/);
      expect(record.notes).toMatch(/whole Australian dollars/);
      expect(record.notes).toMatch(/Source copy SHA-256: sha-qgip/);
    }

    const grant = records.find(
      (record) => record.project_name === 'Palm Island Digital Service Centre',
    );
    expect(grant).toMatchObject({
      amount_cents: 15_000_000,
      measure_type: 'grant_award',
      delivery_entity: 'PALM ISLAND COMMUNITY COMPANY LTD',
      funding_source: 'DCSODSFB',
      data_quality_flag: 'provisional',
      location: { state: 'QLD', lga_name: 'Townsville (C)' },
    });

    const contract = records.find(
      (record) => record.project_name === 'Yarrabah Digital Service Centre',
    );
    expect(contract?.measure_type).toBe('contract');
    expect(contract?.amount_cents).toBe(5_250_000);
  });

  it('flags statewide and sentinel-postcode rows as approximate, never inventing coordinates', () => {
    const { raw } = parseQgipCsv(CSV, meta);
    const { records } = transformQgipRaw(raw);

    const statewide = records.find((record) => record.project_name === 'Statewide health grant');
    expect(statewide?.data_quality_flag).toBe('provisional; statewide_only');
    expect(statewide?.location).toEqual({ state: 'QLD' });

    const sentinel = records.find((record) => record.project_name === 'Multi-LGA transport grant');
    expect(sentinel?.data_quality_flag).toBe('provisional; location_approximate');
    expect(sentinel?.notes).toMatch(/postcode 1111 sentinel/);
    expect(sentinel?.location).toEqual({ state: 'QLD' });
  });

  it('is idempotent and deduplicates repeated raw rows on natural_key', () => {
    const { raw } = parseQgipCsv(CSV, meta);
    const first = transformQgipRaw(raw);
    const second = transformQgipRaw(raw);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
    const doubled = transformQgipRaw([...raw, ...raw]);
    expect(doubled.records).toHaveLength(first.records.length);
    // Only accepted rows reach the natural-key dedupe; rejected rows are skipped again.
    expect(doubled.duplicates).toBe(first.records.length);
  });

  it('natural key and row hash are stable and row-number aware', () => {
    const { raw } = parseQgipCsv(CSV, meta);
    expect(qgipNaturalKey(['res', 'hash', '2024-25'])).toBe(
      qgipNaturalKey(['res', 'hash', '2024-25']),
    );
    expect(raw[0]?.row_hash).toBe(raw[0]?.row_hash);
    expect(raw[0]?.row_hash).not.toBe(raw[1]?.row_hash);
    const cells = { 'Legal entity name': 'X' } as Record<string, string>;
    expect(qgipRowHash(cells, 1)).not.toBe(qgipRowHash(cells, 2));
  });
});

describe('QGIP earlier-year separation', () => {
  function metaFor(fiscal_year: string): QgipSourceMeta {
    return {
      ...meta,
      resource_id: `res-qgip-${fiscal_year}`,
      resource_name: `${fiscal_year} consolidated QGIP expenditure`,
      filename: `${fiscal_year}-expenditure-consolidated.csv`,
      url: `https://example.test/${fiscal_year}.csv`,
      fiscal_year,
    };
  }

  it('labels resource start years and only requests the published years', () => {
    expect(qgipFiscalYearLabel(2018)).toBe('2018-19');
    expect(qgipFiscalYearLabel(2023)).toBe('2023-24');
    const pkg = {
      id: QGIP_DATASET_ID,
      name: 'queensland-government-investment-portal-expenditure-data-consolidated-view',
      title: 'QGIP consolidated',
      resources: [
        ...['2018-19', '2019-20', '2020-21', '2021-22', '2022-23', '2023-24', '2024-25'].map(
          (year) => ({
            id: `r-${year}`,
            name: `${year} consolidated QGIP expenditure`,
            format: 'CSV',
            url: `https://x/${year}.csv`,
          }),
        ),
        {
          id: 'r-2020-21-updated',
          name: '2020-21 consolidated QGIP expenditure (updated DTMR data 15122022)',
          format: 'CSV',
          url: 'https://x/2020-21-updated.csv',
        },
        {
          id: 'r4',
          name: 'QGIP expenditure data dictionary',
          format: 'PDF',
          url: 'https://x/dict.pdf',
        },
      ],
    };
    const selected = selectAnnualResources(pkg, QGIP_EARLIER_YEARS);
    expect(selected.selected).toHaveLength(6);
    expect(selected.selected.map((resource) => qgipFiscalYearLabel(resource.year))).toEqual([
      ...QGIP_EARLIER_YEARS,
    ]);
    // Exactly one 2020-21 resource: the corrected "updated" file, never both.
    const twenty = selected.selected.filter((resource) => resource.year === 2020);
    expect(twenty.map((resource) => resource.resource_id)).toEqual(['r-2020-21-updated']);
    expect(() => selectAnnualResources(pkg, ['2017-18'])).toThrow(/missing.*2017-18/);
    expect(selectAnnualResources(pkg).selected).toHaveLength(1);
  });

  it('keeps each year separate: no cross-year natural-key collision', () => {
    const first = transformQgipRaw(parseQgipCsv(CSV, metaFor('2018-19')).raw);
    const second = transformQgipRaw(parseQgipCsv(CSV, metaFor('2019-20')).raw);
    expect(first.records.every((record) => record.fiscal_year === '2018-19')).toBe(true);
    expect(second.records.every((record) => record.fiscal_year === '2019-20')).toBe(true);
    const keys = new Set([
      ...first.records.map((record) => record.natural_key),
      ...second.records.map((record) => record.natural_key),
    ]);
    expect(keys.size).toBe(first.records.length + second.records.length);

    const combined = transformQgipRaw([
      ...parseQgipCsv(CSV, metaFor('2018-19')).raw,
      ...parseQgipCsv(CSV, metaFor('2019-20')).raw,
    ]);
    expect(combined.duplicates).toBe(0);
    expect(combined.records).toHaveLength(first.records.length + second.records.length);
    expect(new Set(combined.records.map((record) => record.fiscal_year))).toEqual(
      new Set(['2018-19', '2019-20']),
    );
  });

  it('is idempotent within a year and never adds total-to-date to the annual payment', () => {
    const rows = parseQgipCsv(CSV, metaFor('2023-24')).raw;
    const once = transformQgipRaw(rows);
    const twice = transformQgipRaw(rows);
    expect(twice.records.map((record) => record.natural_key)).toEqual(
      once.records.map((record) => record.natural_key),
    );
    const grant = once.records.find((record) => record.measure_type === 'grant_award');
    // The CSV fixture's only total-to-date is absent; the amount is the annual
    // 150000 field, never a cumulative figure.
    expect(grant?.amount_cents).toBe(15_000_000);
    // Grant and contract rows stay separate measure types; no combined row.
    expect(new Set(once.records.map((record) => record.measure_type))).toEqual(
      new Set(['grant_award', 'contract']),
    );
    expect(once.records.every((record) => record.aggregation_role === 'additive')).toBe(true);
  });

  it('flags 2019-20 as a partial year but leaves 2024-25 unmarked', () => {
    expect(QGIP_PARTIAL_YEARS['2019-20']).toMatch(/22,530 of 27,308/);
    const partial = transformQgipRaw(parseQgipCsv(CSV, metaFor('2019-20')).raw);
    expect(
      partial.records.every((record) => /partial_year_source_gap/.test(record.data_quality_flag)),
    ).toBe(true);
    expect(partial.records[0]?.notes).toMatch(/Coverage: FY2019-20 is partial/);

    const complete = transformQgipRaw(parseQgipCsv(CSV, metaFor('2024-25')).raw);
    expect(
      complete.records.some((record) => /partial_year_source_gap/.test(record.data_quality_flag)),
    ).toBe(false);
  });
});

describe('QGIP location helpers', () => {
  it('treats published sentinel postcodes as no fixed location', () => {
    expect(isSentinelPostcode('1111')).toBe(true);
    expect(isSentinelPostcode('1001')).toBe(true);
    expect(isSentinelPostcode('1234')).toBe(true);
    expect(isSentinelPostcode('4000')).toBe(false);
    const { raw } = parseQgipCsv(CSV, meta);
    const sentinel = raw.find((row) => row.service_postcode === '1111');
    expect(sentinel && isApproximateLocation(sentinel)).toBe(true);
    const statewide = raw.find((row) => row.statewide === 'Yes');
    expect(statewide && isApproximateLocation(statewide)).toBe(false);
  });
});

describe('QGIP discovery and resource selection', () => {
  it('parses a 2024-25 financial-year resource name', () => {
    expect(qgipResourceYear('2024-25 consolidated QGIP expenditure')).toBe(2024);
    expect(qgipResourceYear('2023-24 consolidated QGIP expenditure')).toBe(2023);
    expect(qgipResourceYear('Current program funding')).toBeNull();
  });

  it('selects the latest annual expenditure CSV and ignores program funding', () => {
    const pkg = {
      id: QGIP_DATASET_ID,
      name: 'queensland-government-investment-portal-expenditure-data-consolidated-view',
      title: 'QGIP consolidated',
      resources: [
        {
          id: 'r1',
          name: '2023-24 consolidated QGIP expenditure',
          format: 'CSV',
          url: 'https://x/2023-24.csv',
        },
        {
          id: 'r2',
          name: '2024-25 consolidated QGIP expenditure',
          format: 'CSV',
          url: 'https://x/2024-25.csv',
        },
        { id: 'r3', name: 'Current program funding', format: 'CSV', url: 'https://x/funding.csv' },
        {
          id: 'r4',
          name: 'QGIP expenditure data dictionary',
          format: 'PDF',
          url: 'https://x/dict.pdf',
        },
      ],
    };
    const selected = selectLatestAnnualResource(pkg);
    expect(selected.annual.resource_id).toBe('r2');
    expect(selected.annualResources.map((resource) => resource.resource_id)).toEqual(['r2', 'r1']);
  });

  it('discovers via package_search then package_show', async () => {
    const resources = [
      {
        id: 'r2',
        name: '2024-25 consolidated QGIP expenditure',
        format: 'CSV',
        url: 'https://x/2024-25.csv',
      },
      {
        id: 'r1',
        name: '2023-24 consolidated QGIP expenditure',
        format: 'CSV',
        url: 'https://x/2023-24.csv',
      },
      {
        id: 'r4',
        name: 'QGIP expenditure data dictionary',
        format: 'PDF',
        url: 'https://x/dict.pdf',
      },
    ];
    const fakeFetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/package_search')) {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              results: [
                {
                  name: 'queensland-government-investment-portal-expenditure-data-consolidated-view',
                },
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
            id: QGIP_DATASET_ID,
            name: 'queensland-government-investment-portal-expenditure-data-consolidated-view',
            title: 'QGIP consolidated',
            metadata_modified: '2025-12-18T04:58:03',
            resources,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const selection = await discoverQgipSource(fakeFetch, 0);
    expect(selection.annual.resource_id).toBe('r2');
    expect(selection.dictionary.resource_id).toBe('r4');
  });

  it('registers qld-qgip as an active state connector', () => {
    const connector = createQgipConnector();
    expect(connector.id).toBe(QGIP_ID);
    expect(connector.status).toBe('active');
    expect(connector.jurisdiction_level).toBe('state');
    expect(connector.source_url).toContain('data.qld.gov.au');
    expect(connector.notes).toMatch(/Frontline service procurement/);
    expect(connector.notes).toMatch(/never summed/);
  });
});
