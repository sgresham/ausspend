import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  PBS_CAVEAT,
  PBS_DATASET_ID,
  PBS_LATEST_YEAR,
  PBS_YEARS,
  createPbsConnector,
  mapPbsRow,
  parsePbsCsvStream,
  pbsAmountToCents,
  pbsCofogForPortfolio,
  pbsRowHash,
  selectPbsResource,
  transformPbsRows,
  type PbsResourceRef,
  type PbsYearConfig,
} from '../src/connectors/index.js';
import type { RawRecord } from '../src/connectors/types.js';

const FISCAL_YEARS = ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25', '2025-26'];

const AMOUNT_COLUMNS: Record<string, string[]> = {
  '2020-21': ['2019-20', '2020-21', '2021-22', '2022-23', '2023-24'],
  '2021-22': ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25'],
  '2022-23': ['2021-22', '2022-23', '2023-24', '2024-25', '2025-26'],
  '2023-24': ['2022-23', '2023-24', '2024-25', '2025-26', '2026-27'],
  '2024-25': ['2023-24', '2024-25', '2025-26', '2026-27', '2027-28'],
  '2025-26': ['2024-25', '2025-26', '2026-27', '2027-28', '2028-29'],
};

type Style = 'spaced' | 'underscored';

/** Older PBS files spell these columns with spaces; 2025-26 uses underscores. */
function headerFor(config: PbsYearConfig, style: Style): string[] {
  return [
    'Portfolio',
    'Department/Agency',
    'Outcome',
    'Program',
    style === 'underscored' ? 'Expense_type' : 'Expense type',
    style === 'underscored' ? 'Appropriation_type' : 'Appropriation type',
    ...AMOUNT_COLUMNS[config.fiscalYear]!,
    style === 'underscored' ? 'Source_document' : 'Source document',
    style === 'underscored' ? 'Source_table' : 'Source table',
    'URL',
  ];
}

function quoteCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function dataValues(
  config: PbsYearConfig,
  style: Style,
  overrides: Record<string, string> = {},
): string[] {
  const values: Record<string, string> = {
    Portfolio: 'Health and Aged Care',
    'Department/Agency': 'Department of Health and Aged Care',
    Outcome: 'Outcome 1: A healthy Australia',
    Program: 'Program 1.1: Health policy',
    'Expense type': 'Departmental expenses',
    Expense_type: 'Departmental expenses',
    'Appropriation type': 'Departmental appropriation',
    Appropriation_type: 'Departmental appropriation',
    'Source document': `${config.fiscalYear} PB Statement Table 2.X.1 Health`,
    Source_document: `${config.fiscalYear} PB Statement Table 2.X.1 Health`,
    'Source table': 'Health Table 2.1',
    Source_table: 'Health Table 2.1',
    URL: '',
    ...overrides,
  };
  // Every amount column except the budget year is zero; the budget column is
  // 2,500 ($'000) so the expected cents are constant across years.
  for (const column of AMOUNT_COLUMNS[config.fiscalYear]!) {
    values[column] = column === config.amountColumn ? '2500' : '0';
  }
  Object.assign(values, overrides);
  return headerFor(config, style).map((name) => values[name] ?? '');
}

function fixtureCsv(
  config: PbsYearConfig,
  options: { style?: Style; leadingBlankRows?: number; overrides?: Record<string, string> } = {},
): string {
  const style = options.style ?? (config.fiscalYear === '2025-26' ? 'underscored' : 'spaced');
  const header = headerFor(config, style);
  const blank = ','.repeat(header.length - 1);
  const prefix = `${blank}\r\n`.repeat(options.leadingBlankRows ?? 0);
  return (
    prefix +
    `${header.map(quoteCsv).join(',')}\r\n` +
    `${dataValues(config, style, options.overrides).map(quoteCsv).join(',')}\r\n`
  );
}

function resource(config: PbsYearConfig, overrides: Partial<PbsResourceRef> = {}): PbsResourceRef {
  return {
    id: `res-${config.fiscalYear}`,
    name: config.resourceName,
    pageUrl: `https://data.gov.au/data/dataset/${config.datasetId}/resource/res-${config.fiscalYear}`,
    downloadUrl: `https://data.gov.au/data/dataset/${config.datasetId}/resource/res-${config.fiscalYear}/download/file.csv`,
    format: '.csv',
    sourceDate: '2025-03-26',
    size: 639903,
    ...overrides,
  };
}

function packageFixture(config: PbsYearConfig): unknown {
  return {
    success: true,
    result: {
      id: config.datasetId,
      title: config.datasetTitle,
      resources: [
        {
          id: `zip-${config.fiscalYear}`,
          name: `${config.fiscalYear} PBS Entity Excel Tables`,
          format: 'ZIP',
          url: 'https://data.gov.au/data/dataset/x/resource/excel/download/tables.zip',
          last_modified: '2025-03-26T00:00:00',
        },
        {
          id: `bp4-${config.fiscalYear}`,
          name: 'Budget Paper No.4 Tables',
          format: 'CSV',
          url: 'https://data.gov.au/data/dataset/x/resource/bp4/download/bp4.csv',
          last_modified: '2025-05-13T00:00:00',
        },
        {
          id: `res-${config.fiscalYear}`,
          name: config.resourceName,
          format: '.csv',
          url: resource(config).downloadUrl,
          last_modified:
            config.fiscalYear === '2025-26' ? '2025-03-26T06:21:36.448121' : '2025-03-26',
          size: 639903,
        },
      ],
    },
  };
}

async function parseFixture(csv: string): Promise<RawRecord[]> {
  const bytes = Buffer.from(csv.replace(/\u2019/g, '\x92'), 'latin1');
  // Deliberately split in awkward places, including inside a quoted field.
  const chunks = [bytes.subarray(0, 37), bytes.subarray(37, 120), bytes.subarray(120)];
  return parsePbsCsvStream(Readable.from(chunks));
}

describe('PBS published year set', () => {
  it('covers FY2020-21 through FY2025-26 with one canonical FY2022-23 package', () => {
    expect(PBS_YEARS.map((config) => config.fiscalYear)).toEqual(FISCAL_YEARS);
    const twentyThree = PBS_YEARS.filter((config) => config.fiscalYear === '2022-23');
    expect(twentyThree).toHaveLength(1);
    expect(twentyThree[0]?.datasetId).toBe('72594fbc-ef66-40f2-a8af-845372dc0f99');
    expect(twentyThree[0]?.resourceName).toMatch(/October/i);
    expect(PBS_LATEST_YEAR.fiscalYear).toBe('2025-26');
    expect(PBS_DATASET_ID).toBe(PBS_LATEST_YEAR.datasetId);
  });
});

describe('PBS CKAN resource selection', () => {
  it.each(PBS_YEARS)(
    'selects the $fiscalYear line-item CSV and ignores ZIP/BP4 decoys',
    (config) => {
      const selected = selectPbsResource(
        (packageFixture(config) as { result: unknown }).result,
        config,
      );
      expect(selected.id).toBe(`res-${config.fiscalYear}`);
      expect(selected.name).toBe(config.resourceName);
      expect(selected.pageUrl).toBe(resource(config).pageUrl);
      expect(selected.sourceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );

  it('accepts wrapped/changed resource names but always picks the year CSV', () => {
    const config = PBS_YEARS.find((entry) => entry.fiscalYear === '2024-25')!;
    const wrapped = packageFixture(config) as {
      result: { resources: Array<Record<string, unknown>> };
    };
    wrapped.result.resources[2]!.name = '2024-25 PBS Program Expense Line Items (final).csv';
    const selected = selectPbsResource(wrapped.result, config);
    expect(selected.id).toBe('res-2024-25');
  });

  it('throws when the dataset has no matching line-item CSV', () => {
    expect(() =>
      selectPbsResource({ resources: [{ id: 'a', name: 'Tables', format: 'ZIP' }] }),
    ).toThrow(/no CSV resource matching/i);
  });
});

describe('PBS streaming CSV parse', () => {
  it.each(PBS_YEARS)('parses $fiscalYear header spelling and amount column', async (config) => {
    const rows = await parseFixture(
      fixtureCsv(config, {
        style: config.fiscalYear === '2025-26' ? 'underscored' : 'spaced',
        leadingBlankRows: ['2022-23', '2023-24'].includes(config.fiscalYear) ? 4 : 0,
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.Portfolio).toBe('Health and Aged Care');
    expect(rows[0]?.[config.amountColumn]).toBe('2500');
    if (config.fiscalYear === '2025-26') {
      expect(rows[0]?.Expense_type).toBe('Departmental expenses');
    } else {
      expect(rows[0]?.['Expense type']).toBe('Departmental expenses');
    }
  });

  it('parses windows-1252 chunks and preserves quoted text', async () => {
    const withCurlyQuote = fixtureCsv(PBS_LATEST_YEAR).replace(
      'A healthy Australia',
      'A healthy Australia\u2019s system',
    );
    const rows = await parseFixture(withCurlyQuote);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.Outcome).toContain('\u2019');
  });
});

describe('PBS mapping across years', () => {
  it.each(PBS_YEARS)(
    'maps $fiscalYear with its own column, fiscal year and source identity',
    async (config) => {
      const rows = await parseFixture(fixtureCsv(config));
      const { record, skip } = mapPbsRow(rows[0]!, {
        config,
        resource: resource(config),
        rowNumber: 1,
      });
      expect(skip).toBeNull();
      expect(record).toMatchObject({
        measure_type: 'budget',
        fiscal_year: config.fiscalYear,
        source_id: 'data-gov-au-pbs',
        source_dataset: config.datasetTitle,
        source_date: '2025-03-26',
        source_url: resource(config).pageUrl,
        verified: false,
        function_code: '07',
        data_quality_flag: 'statewide_only',
        location: { state: 'Commonwealth' },
        funding_source: 'Health and Aged Care',
        delivery_entity: 'Department of Health and Aged Care',
        project_name: 'Program 1.1: Health policy',
      });
      // 2,500 thousands = $2,500,000 = 250,000,000 cents, in every year.
      expect(record?.amount_cents).toBe(250_000_000);
      expect(Number.isSafeInteger(record?.amount_cents)).toBe(true);
      expect(record?.natural_key).toMatch(new RegExp(`^${config.datasetId}:[a-f0-9]{32}$`));
      expect(record?.notes).toContain(`amount column ${config.amountColumn}`);
      expect(record?.notes).toContain(PBS_CAVEAT);
    },
  );

  it('leaves an unmappable portfolio without a function and flags provisional', async () => {
    const config = PBS_LATEST_YEAR;
    const rows = await parseFixture(
      fixtureCsv(config, {
        style: 'underscored',
        overrides: {
          Portfolio: 'Infrastructure, Transport, Regional Development, Communications and the Arts',
        },
      }),
    );
    const { record } = mapPbsRow(rows[0]!, { config, resource: resource(config), rowNumber: 1 });
    expect(record?.function_code ?? null).toBeNull();
    expect(record?.data_quality_flag).toBe('provisional');
    expect(record?.location).toEqual({ state: 'Commonwealth' });
    expect(
      pbsCofogForPortfolio(
        'Infrastructure, Transport, Regional Development, Communications and the Arts',
      ),
    ).toBeNull();
    expect(pbsCofogForPortfolio('Health and Aged Care')).toBe('07');
  });

  it('skips nfp and negative amounts rather than inventing a value', () => {
    expect(pbsAmountToCents('nfp')).toBeNull();
    expect(pbsAmountToCents('')).toBeNull();
    expect(pbsAmountToCents('-5')).toBeNull();
    expect(pbsAmountToCents('1.5')).toBe(150_000);
  });

  it('hashes rows stably and gives exact duplicates an occurrence key', async () => {
    const config = PBS_LATEST_YEAR;
    const rows = await parseFixture(fixtureCsv(config, { style: 'underscored' }));
    const a = mapPbsRow(rows[0]!, { config, resource: resource(config), occurrence: 0 });
    const b = mapPbsRow(rows[0]!, { config, resource: resource(config), occurrence: 1 });
    expect(a.record?.natural_key).not.toBe(b.record?.natural_key);
    expect(b.record?.natural_key).toBe(`${config.datasetId}:${pbsRowHash(rows[0]!, 1)}`);

    // Key order does not change the hash.
    const reordered: RawRecord = Object.fromEntries(Object.entries(rows[0]!).reverse());
    expect(pbsRowHash(reordered)).toBe(pbsRowHash(rows[0]!));

    const twice = transformPbsRows([...rows, ...rows], { config, resource: resource(config) });
    expect(twice.records).toHaveLength(2);
    expect(twice.duplicates).toBe(1);
  });
});

describe('PBS connector fetch/transform', () => {
  function multiYearFetch() {
    const sleeps: number[] = [];
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      calls.push(target);
      if (target.includes('package_show')) {
        const id = new URL(target).searchParams.get('id');
        const config = PBS_YEARS.find((entry) => entry.datasetId === id);
        if (!config) return new Response('not found', { status: 404 });
        return new Response(JSON.stringify(packageFixture(config)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      const config = PBS_YEARS.find((entry) => target === resource(entry).downloadUrl);
      if (!config) return new Response('not found', { status: 404 });
      return new Response(Buffer.from(fixtureCsv(config), 'latin1'), {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      });
    }) as unknown as typeof fetch;
    return { fetchImpl, sleeps, calls };
  }

  it('fetches every year, streams each CSV and maps distinct natural keys', async () => {
    const { fetchImpl, sleeps } = multiYearFetch();
    const connector = createPbsConnector({
      fetchImpl,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      delayMs: 500,
    });
    const raw = await connector.fetch();
    expect(raw).toHaveLength(PBS_YEARS.length);
    const records = connector.transform(raw);
    expect(records).toHaveLength(PBS_YEARS.length);
    expect(records.map((record) => record.fiscal_year)).toEqual(FISCAL_YEARS);
    expect(new Set(records.map((record) => record.natural_key)).size).toBe(PBS_YEARS.length);
    expect(sleeps).toContain(500);
    expect(fetchImpl).toHaveBeenCalledTimes(PBS_YEARS.length * 2);
    expect(connector.metadata.errors).toEqual([]);
    expect(records[0]?.source_url).toContain('data.gov.au');
  });

  it('records a missing package as a year gap but ingests the rest', async () => {
    const { fetchImpl } = multiYearFetch();
    const brokenYears = PBS_YEARS.slice(0, 1);
    const connector = createPbsConnector({
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).includes(brokenYears[0]!.datasetId)) {
          return new Response('boom', { status: 503 });
        }
        return fetchImpl(url, init);
      }) as unknown as typeof fetch,
      sleep: async () => {},
      delayMs: 0,
    });
    const raw = await connector.fetch();
    const records = connector.transform(raw);
    expect(records).toHaveLength(PBS_YEARS.length - 1);
    expect(connector.metadata.errors.join(' ')).toMatch(new RegExp(brokenYears[0]!.fiscalYear));
  });

  it('rejects when package_show has no CSV for any year', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true, result: { resources: [] } }), { status: 200 }),
    ) as unknown as typeof fetch;
    const connector = createPbsConnector({ fetchImpl, sleep: async () => {}, delayMs: 0 });
    await expect(connector.fetch()).rejects.toThrow(/no CSV resource matching/i);
  });
});

describe.skipIf(process.env.PBS_LIVE_TEST !== '1')('PBS live smoke', () => {
  it('selects every published line-item CSV and maps real rows', async () => {
    const connector = createPbsConnector({ delayMs: 500 });
    const raw = await connector.fetch();
    const records = connector.transform(raw);
    expect(records.length).toBeGreaterThanOrEqual(10);
    const years = new Set(records.map((record) => record.fiscal_year));
    for (const year of FISCAL_YEARS) expect(years.has(year)).toBe(true);
    for (const record of records.slice(0, 5)) {
      expect(Number.isSafeInteger(record.amount_cents)).toBe(true);
      expect(record.amount_cents).toBeGreaterThan(0);
      expect(record.source_url).toContain('data.gov.au');
      expect(record.verified).toBe(false);
    }
  }, 180_000);
});
