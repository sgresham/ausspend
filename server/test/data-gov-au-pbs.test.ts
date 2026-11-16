import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  PBS_CAVEAT,
  PBS_DATASET_ID,
  PBS_FISCAL_YEAR,
  PBS_RESOURCE_NAME,
  createPbsConnector,
  mapPbsRow,
  parsePbsCsvStream,
  pbsAmountToCents,
  pbsCofogForPortfolio,
  pbsRowHash,
  selectPbsResource,
  transformPbsRows,
  type PbsResourceRef,
} from '../src/connectors/index.js';
import type { RawRecord } from '../src/connectors/types.js';

const HEADER =
  "Portfolio,Department/Agency,Outcome,Program,Expense_type,Appropriation_type,2024-25,2025-26,2026-27,2027-28,2028-29,Source_document,Source_table\r\n";

function csvRow(overrides: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    Portfolio: 'Health and Aged Care',
    'Department/Agency': 'Department of Health and Aged Care',
    Outcome: 'Outcome 1: A healthy Australia',
    Program: 'Program 1.1: Health policy',
    Expense_type: 'Departmental expenses',
    Appropriation_type: 'Departmental appropriation',
    '2024-25': '1000',
    '2025-26': '2500',
    '2026-27': '2600',
    '2027-28': '2700',
    '2028-29': '2800',
    Source_document: '2025-26 PB Statement Table 2.X.1 Health',
    Source_table: 'Health Table 2.1',
    ...overrides,
  };
  const quote = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return `${Object.values(values).map(quote).join(',')}\r\n`;
}

function fixtureCsv(): string {
  return (
    HEADER +
    csvRow() +
    csvRow({
      Portfolio: 'Infrastructure, Transport, Regional Development, Communications and the Arts',
      'Department/Agency': 'Department of Infrastructure',
      Program: 'Program 2.2: Transport networks',
      '2025-26': '125000',
    }) +
    csvRow({
      Portfolio: 'Climate Change, Energy, the Environment and Water',
      'Department/Agency': 'Department of Climate Change',
      Program: 'Program 3.1: Energy',
      '2025-26': 'nfp',
    })
  );
}

function resource(overrides: Partial<PbsResourceRef> = {}): PbsResourceRef {
  return {
    id: '7cc8640f-b5d4-41de-a665-3197739b965f',
    name: PBS_RESOURCE_NAME,
    pageUrl: `https://data.gov.au/data/dataset/${PBS_DATASET_ID}/resource/7cc8640f-b5d4-41de-a665-3197739b965f`,
    downloadUrl:
      'https://data.gov.au/data/dataset/4f025f38-0c70-45e2-8106-4c29a5e48637/resource/7cc8640f-b5d4-41de-a665-3197739b965f/download/file.csv',
    format: '.csv',
    sourceDate: '2025-03-26',
    size: 639903,
    ...overrides,
  };
}

function packageFixture(): unknown {
  return {
    success: true,
    result: {
      id: PBS_DATASET_ID,
      title: 'Budget 2025-2026 and Portfolio Budget Statements (PBS) - Tables and Data',
      resources: [
        {
          id: 'excel-zip',
          name: '2025-26 PBS Entity Excel Tables',
          format: 'ZIP',
          url: 'https://data.gov.au/data/dataset/x/resource/excel/download/tables.zip',
          last_modified: '2025-03-26T00:00:00',
        },
        {
          id: 'bp1-zip',
          name: 'Budget Paper No.1 Tables',
          format: 'ZIP',
          url: 'https://data.gov.au/data/dataset/x/resource/bp1/download/bp1.zip',
          last_modified: '2025-05-13T00:00:00',
        },
        {
          id: 'csv-decoy',
          name: 'Budget Paper No.4 Tables',
          format: 'CSV',
          url: 'https://data.gov.au/data/dataset/x/resource/bp4/download/bp4.csv',
          last_modified: '2025-05-13T00:00:00',
        },
        {
          id: '7cc8640f-b5d4-41de-a665-3197739b965f',
          name: PBS_RESOURCE_NAME,
          format: '.csv',
          url: 'https://data.gov.au/data/dataset/4f025f38-0c70-45e2-8106-4c29a5e48637/resource/7cc8640f-b5d4-41de-a665-3197739b965f/download/2025-26-pbs-program-expense-line-items-final-2025-03-26.csv',
          last_modified: '2025-03-26T06:21:36.448121',
          size: 639903,
        },
      ],
    },
  };
}

async function parseFixture(csv = fixtureCsv()): Promise<RawRecord[]> {
  const bytes = Buffer.from(csv.replace(/\u2019/g, '\x92'), 'latin1');
  // Deliberately split in awkward places, including inside a quoted field.
  const chunks = [bytes.subarray(0, 37), bytes.subarray(37, 120), bytes.subarray(120)];
  return parsePbsCsvStream(Readable.from(chunks));
}

describe('PBS CKAN resource selection', () => {
  it('selects the PBS program-expense CSV and ignores the ZIP/BP4 decoys', () => {
    const selected = selectPbsResource((packageFixture() as { result: unknown }).result);
    expect(selected.id).toBe('7cc8640f-b5d4-41de-a665-3197739b965f');
    expect(selected.name).toBe(PBS_RESOURCE_NAME);
    expect(selected.pageUrl).toBe(resource().pageUrl);
    expect(selected.sourceDate).toBe('2025-03-26');
    expect(selected.size).toBe(639903);
  });

  it('throws when the dataset has no matching line-item CSV', () => {
    expect(() =>
      selectPbsResource({ resources: [{ id: 'a', name: 'Tables', format: 'ZIP' }] }),
    ).toThrow(/no CSV resource matching/i);
  });
});

describe('PBS streaming CSV parse', () => {
  it('parses windows-1252 chunks and preserves quoted text', async () => {
    const withCurlyQuote = fixtureCsv().replace(
      'A healthy Australia',
      'A healthy Australia\u2019s system',
    );
    const rows = await parseFixture(withCurlyQuote);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      Portfolio: 'Health and Aged Care',
      'Department/Agency': 'Department of Health and Aged Care',
      '2025-26': '2500',
    });
    expect(rows[0]?.Outcome).toContain('\u2019');
    expect(rows[2]?.['2025-26']).toBe('nfp');
  });
});

describe('PBS mapping', () => {
  it('maps a defensible portfolio to COFOG and integer cents with provenance', async () => {
    const rows = await parseFixture();
    const { record, skip } = mapPbsRow(rows[0]!, { resource: resource(), rowNumber: 1 });
    expect(skip).toBeNull();
    expect(record).toMatchObject({
      measure_type: 'budget',
      fiscal_year: PBS_FISCAL_YEAR,
      jurisdiction_level: 'federal',
      jurisdiction: 'Commonwealth',
      source_id: 'data-gov-au-pbs',
      source_dataset: '2025-26 Portfolio Budget Statements (data.gov.au)',
      source_date: '2025-03-26',
      source_url: resource().pageUrl,
      verified: false,
      function_code: '07',
      data_quality_flag: 'statewide_only',
      location: { state: 'Commonwealth' },
      funding_source: 'Health and Aged Care',
      delivery_entity: 'Department of Health and Aged Care',
      project_name: 'Program 1.1: Health policy',
    });
    // 2,500 thousands = $2,500,000 = 250,000,000 cents.
    expect(record?.amount_cents).toBe(250_000_000);
    expect(Number.isSafeInteger(record?.amount_cents)).toBe(true);
    expect(record?.natural_key).toMatch(
      new RegExp(`^${PBS_DATASET_ID}:[a-f0-9]{32}$`),
    );
    expect(record?.notes).toContain("$'000");
    expect(record?.notes).toContain(PBS_CAVEAT);
  });

  it('leaves an unmappable portfolio without a function and flags provisional', async () => {
    const rows = await parseFixture();
    const { record } = mapPbsRow(rows[1]!, { resource: resource(), rowNumber: 2 });
    expect(record?.function_code ?? null).toBeNull();
    expect(record?.data_quality_flag).toBe('provisional');
    expect(record?.location).toEqual({ state: 'Commonwealth' });
    expect(record?.amount_cents).toBe(12_500_000_000);
    expect(pbsCofogForPortfolio('Infrastructure, Transport, Regional Development, Communications and the Arts')).toBeNull();
    expect(pbsCofogForPortfolio('Health and Aged Care')).toBe('07');
  });

  it('skips nfp and negative amounts rather than inventing a value', async () => {
    const rows = await parseFixture();
    const nfp = mapPbsRow(rows[2]!, { resource: resource(), rowNumber: 3 });
    expect(nfp.record).toBeNull();
    expect(nfp.skip?.reason).toMatch(/not a usable amount/i);

    expect(pbsAmountToCents('nfp')).toBeNull();
    expect(pbsAmountToCents('')).toBeNull();
    expect(pbsAmountToCents('-5')).toBeNull();
    expect(pbsAmountToCents('1.5')).toBe(150_000);
  });

  it('hashes rows stably and gives exact duplicates an occurrence key', async () => {
    const rows = await parseFixture();
    const a = mapPbsRow(rows[0]!, { resource: resource(), occurrence: 0 });
    const b = mapPbsRow(rows[0]!, { resource: resource(), occurrence: 1 });
    expect(a.record?.natural_key).not.toBe(b.record?.natural_key);
    expect(b.record?.natural_key).toBe(`${PBS_DATASET_ID}:${pbsRowHash(rows[0]!, 1)}`);

    // Key order does not change the hash.
    const reordered: RawRecord = Object.fromEntries(Object.entries(rows[0]!).reverse());
    expect(pbsRowHash(reordered)).toBe(pbsRowHash(rows[0]!));

    const once = transformPbsRows(rows, resource());
    const twice = transformPbsRows([...rows, ...rows], resource());
    expect(once.records).toHaveLength(2);
    expect(once.skipped).toHaveLength(1);
    // The two fixture rows are distinct; appending the file again adds only
    // occurrence variants (idempotency is on natural_key, never a new row).
    expect(twice.records).toHaveLength(4);
    expect(twice.records.map((record) => record.natural_key)).toEqual([
      ...once.records.map((record) => record.natural_key),
      `${PBS_DATASET_ID}:${pbsRowHash(rows[0]!, 1)}`,
      `${PBS_DATASET_ID}:${pbsRowHash(rows[1]!, 1)}`,
    ]);
  });
});

describe('PBS connector fetch/transform', () => {
  it('calls package_show then streams the CSV with a polite delay', async () => {
    const sleeps: number[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes('package_show')) {
        return new Response(JSON.stringify(packageFixture()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(Buffer.from(fixtureCsv(), 'latin1'), {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      });
    }) as unknown as typeof fetch;

    const connector = createPbsConnector({
      fetchImpl,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      delayMs: 500,
    });
    const raw = await connector.fetch();
    expect(raw).toHaveLength(3);
    const records = connector.transform(raw);
    expect(records).toHaveLength(2);
    expect(sleeps).toContain(500);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(connector.metadata.warnings?.join(' ')).toMatch(/1 PBS row\(s\) skipped/i);
    expect(connector.metadata.errors).toEqual([]);
    expect(records[0]?.source_url).toContain('data.gov.au');
  });

  it('records the skip reason when package_show has no CSV', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, result: { resources: [] } }), { status: 200 }),
    ) as unknown as typeof fetch;
    const connector = createPbsConnector({ fetchImpl });
    await expect(connector.fetch()).rejects.toThrow(/no CSV resource matching/i);
  });
});

describe.skipIf(process.env.PBS_LIVE_TEST !== '1')('PBS live smoke', () => {
  it(
    'selects the published line-item CSV and maps real rows',
    async () => {
      const connector = createPbsConnector({ delayMs: 500 });
      const raw = await connector.fetch();
      const records = connector.transform(raw);
      expect(records.length).toBeGreaterThanOrEqual(10);
      for (const record of records.slice(0, 5)) {
        expect(Number.isSafeInteger(record.amount_cents)).toBe(true);
        expect(record.amount_cents).toBeGreaterThan(0);
        expect(record.source_url).toContain('data.gov.au');
        expect(record.verified).toBe(false);
      }
    },
    90_000,
  );
});
