import { describe, expect, it } from 'vitest';
import {
  QLD_FISCAL_YEAR,
  QLD_ID,
  QLD_UNIT,
  QLD_UNIT_TO_CENTS,
  createQldBudgetConnector,
  discoverQldSources,
  parseBp3Rows,
  parseBp4Rows,
  qldAmountToCents,
  qldNaturalKey,
  qldNumber,
  transformQldRaw,
  type QldSourceMeta,
} from '../src/connectors/qld-budget.js';

const bp3Meta: QldSourceMeta = {
  resource_id: 'res-bp3',
  resource_name: 'Capital Statement - Budget Paper 3 (2026-27)',
  filename: 'capital-statement-bp3-2026-27-budget.csv',
  url: 'https://example.test/bp3.csv',
  source_sha256: 'sha-bp3',
  source_date: '2026-06-01',
};
const bp4Meta: QldSourceMeta = {
  resource_id: 'res-bp4',
  resource_name: 'Budget Measures—Budget Paper 4 (2026-27)',
  filename: 'bp4-open-data-budget-2026-27.csv',
  url: 'https://example.test/bp4.csv',
  source_sha256: 'sha-bp4',
  source_date: '2026-06-01',
};

const BP3_HEADER =
  'Portfolio,Agency,Asset Type,Header 1,Header 2,Header 3,Project Name,SA4 Name,Total Estimated Cost,Expenditure to 30-06-26,Budget 2026-27,Post 2026-27,Latitude,Longitude';

const BP3_CSV = [
  BP3_HEADER,
  '"Health, Mental Health and Ambulance Services",Queensland Health,"Property, Plant and Equipment",,,,New hospital,"Brisbane - North",N/A,N/A,"1,805",Ongoing,"-27.4","153.0"',
  '"Health, Mental Health and Ambulance Services",Queensland Health,"Property, Plant and Equipment",,,,Blank project,"Brisbane - North",N/A,N/A,,Ongoing,N/A,N/A',
  '"Health, Mental Health and Ambulance Services",Queensland Health,"Property, Plant and Equipment",,,,Zero project,"Brisbane - North",N/A,N/A,0,Ongoing,N/A,N/A',
].join('\n');

const BP4_HEADER =
  "ID,Report Title,Section,Department,Measure ,2025-26 ($'000),2026-27  ($'000),2027-28  ($'000),2028-29  ($'000),2029-30  ($'000)";

const BP4_CSV = [
  BP4_HEADER,
  '1,Table A.1,Expense measures since 2025-26 MYFER,Department of Education,Expense measure A,0,500,0,0,0',
  '2,Table A.2,Capital measures since 2025-26 MYFER,Department of Health,Capital measure B,0,146,275,0,0',
  '3,Table A.3,Revenue measures since 2025-26 MYFER,Queensland Treasury,Revenue measure C,0,100,0,0,0',
  '4,Table A.1,Expense measures since 2025-26 MYFER,Department of Education,Zero measure D,0,0,0,0,0',
  '5,Table A.2,Capital measures since 2025-26 MYFER,Department of Health,Negative measure E,0,-5,0,0,0',
].join('\n');

describe('QLD units', () => {
  it('uses the dictionary-confirmed $000 unit', () => {
    expect(QLD_UNIT).toBe("$'000");
    expect(QLD_UNIT_TO_CENTS).toBe(100_000);
    expect(qldNumber('1,805')).toBe(1805);
    expect(qldNumber('N/A')).toBeNull();
    expect(qldNumber('')).toBeNull();
    expect(qldAmountToCents('1,805')).toBe(180_500_000);
    expect(qldAmountToCents(0.5)).toBe(50_000);
    expect(qldAmountToCents(-5)).toBeNull();
  });
});

describe('QLD BP3 parsing', () => {
  it('keeps positive rows and records blanks/zeros as skips', () => {
    const skipped: Array<{ filename: string; row: number | null; reason: string }> = [];
    const raw = parseBp3Rows(BP3_CSV, bp3Meta, skipped);
    expect(raw).toHaveLength(1);
    expect(raw[0]).toMatchObject({
      kind: 'bp3',
      project_name: 'New hospital',
      portfolio: 'Health, Mental Health and Ambulance Services',
      agency: 'Queensland Health',
      asset_type: 'Property, Plant and Equipment',
      sa4_name: 'Brisbane - North',
      latitude_raw: '-27.4',
      longitude_raw: '153.0',
      budget_000: 1805,
      unit: QLD_UNIT,
    });
    expect(skipped).toHaveLength(2);
    expect(skipped.some((entry) => /blank\/non-numeric/.test(entry.reason))).toBe(true);
    expect(skipped.some((entry) => /zero\/negative/.test(entry.reason))).toBe(true);
  });
});

describe('QLD BP4 parsing', () => {
  it('ingests expense/capital measures and excludes revenue/zero/negative rows', () => {
    const skipped: Array<{ filename: string; row: number | null; reason: string }> = [];
    const raw = parseBp4Rows(BP4_CSV, bp4Meta, skipped);
    expect(raw).toHaveLength(2);
    expect(raw.map((row) => row.id)).toEqual(['1', '2']);
    expect(raw.map((row) => row.section)).toEqual([
      'Expense measures since 2025-26 MYFER',
      'Capital measures since 2025-26 MYFER',
    ]);
    expect(raw[1]?.budget_000).toBe(146);
    expect(skipped).toHaveLength(3);
    expect(skipped.some((entry) => /revenue measure excluded/.test(entry.reason))).toBe(true);
    expect(skipped.filter((entry) => /zero\/negative/.test(entry.reason))).toHaveLength(2);
  });
});

describe('QLD record mapping and idempotency', () => {
  it('builds state/QLD integer-cent records with stable natural keys', () => {
    const bp3Raw = parseBp3Rows(BP3_CSV, bp3Meta);
    const bp4Raw = parseBp4Rows(BP4_CSV, bp4Meta);
    const raw = [...bp3Raw, ...bp4Raw];
    const first = transformQldRaw(raw);
    const second = transformQldRaw(raw);
    expect(first.records).toHaveLength(3);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
    for (const record of first.records) {
      expect(record.source_id).toBe(QLD_ID);
      expect(record.measure_type).toBe('budget');
      expect(record.jurisdiction_level).toBe('state');
      expect(record.jurisdiction).toBe('QLD');
      expect(record.fiscal_year).toBe(QLD_FISCAL_YEAR);
      expect(record.location?.state).toBe('QLD');
      expect(record.function_code).toBeUndefined();
      expect(record.aggregation_role).toBe('additive');
      expect(record.verified).toBe(false);
      expect(Number.isSafeInteger(record.amount_cents)).toBe(true);
      expect(record.natural_key).toMatch(/^qld-budget:[0-9a-f]{40}$/);
    }
    const bp3Record = first.records.find((record) => record.project_name === 'New hospital');
    expect(bp3Record).toMatchObject({
      amount_cents: 180_500_000,
      delivery_entity: 'Queensland Health',
      funding_source: 'Health, Mental Health and Ambulance Services',
      data_quality_flag: 'provisional; approximate_location',
      location: { state: 'QLD', sa4_name: 'Brisbane - North' },
    });
    expect(bp3Record?.notes).toMatch(/may be multi-valued/);
    const bp4Record = first.records.find((record) => record.project_name === 'Expense measure A');
    expect(bp4Record).toMatchObject({
      amount_cents: 50_000_000,
      delivery_entity: 'Department of Education',
      funding_source: 'Department of Education',
      data_quality_flag: 'provisional',
    });
  });

  it('deduplicates repeated raw rows on natural_key', () => {
    const raw = [...parseBp3Rows(BP3_CSV, bp3Meta), ...parseBp4Rows(BP4_CSV, bp4Meta)];
    const result = transformQldRaw([...raw, ...raw]);
    expect(result.records).toHaveLength(3);
    expect(result.duplicates).toBe(3);
  });

  it('natural key hashes stable source identity', () => {
    expect(qldNaturalKey(['res', 1, 'dept', 'measure'])).toBe(
      qldNaturalKey(['res', 1, 'dept', 'measure']),
    );
    expect(qldNaturalKey(['res', 1, 'dept', 'measure'])).not.toBe(
      qldNaturalKey(['res', 2, 'dept', 'measure']),
    );
  });
});

describe('QLD discovery and registration', () => {
  it('discovers BP3/BP4 resources and dictionaries via package_show', async () => {
    const packages: Record<string, unknown> = {
      'fb0df743-a719-476e-a3ae-4d4e3a0d9124': {
        id: 'fb0df743-a719-476e-a3ae-4d4e3a0d9124',
        name: '2026-27-state-budget-budget-paper-3-capital-statement',
        title: '2026-27 State Budget—Budget Paper 3—Capital Statement',
        metadata_modified: '2026-06-01T00:00:00',
        resources: [
          {
            id: 'aa894f86-6f57-4e81-8f95-8c1541bcd819',
            name: 'Capital Statement - Budget Paper 3 (2026-27)',
            format: 'CSV',
            url: 'https://example.test/capital-statement-bp3-2026-27-budget.csv',
          },
          {
            id: 'bb5d4369-f12b-4f1a-80f0-60325565a710',
            name: 'Data Dictionary and Explanatory Notes—Capital Statement—Budget Paper 3 (2026-27)',
            format: 'CSV',
            url: 'https://example.test/bp3-dictionary.csv',
          },
        ],
      },
      'e37910f7-0ae5-4a20-9e59-dcaa30517080': {
        id: 'e37910f7-0ae5-4a20-9e59-dcaa30517080',
        name: '2026-27-state-budget-budget-paper-4-budget-measures',
        title: '2026-27 State Budget—Budget Paper 4—Budget Measures',
        metadata_modified: '2026-06-02T00:00:00',
        resources: [
          {
            id: '1eb033d0-a344-4c24-821a-96fc0a0d57fa',
            name: 'Budget Measures—Budget Paper 4 (2026-27)',
            format: 'CSV',
            url: 'https://example.test/bp4-open-data-budget-2026-27.csv',
          },
          {
            id: 'da5e8180-1ab7-407d-a01e-f38d35f2db99',
            name: 'Data Dictionary—Budget Measures—Budget Paper 4 (2026-27)',
            format: 'CSV',
            url: 'https://example.test/bp4-dictionary.csv',
          },
          {
            id: '28333519-6495-4055-9662-c23889518030',
            name: 'Explanatory Notes—Budget Measures—Budget Paper 4 (2026-27)',
            format: 'CSV',
            url: 'https://example.test/bp4-notes.csv',
          },
        ],
      },
    };
    const fakeFetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const id = url.searchParams.get('id') ?? '';
      return new Response(JSON.stringify({ success: true, result: packages[id] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const selection = await discoverQldSources(fakeFetch);
    expect(selection.bp3.resource_id).toBe('aa894f86-6f57-4e81-8f95-8c1541bcd819');
    expect(selection.bp3Dictionary.resource_id).toBe('bb5d4369-f12b-4f1a-80f0-60325565a710');
    expect(selection.bp4.resource_id).toBe('1eb033d0-a344-4c24-821a-96fc0a0d57fa');
    expect(selection.bp4Dictionary.resource_id).toBe('da5e8180-1ab7-407d-a01e-f38d35f2db99');
    expect(selection.bp4Notes.resource_id).toBe('28333519-6495-4055-9662-c23889518030');
  });

  it('registers qld-budget as an active state connector', () => {
    const connector = createQldBudgetConnector();
    expect(connector.id).toBe(QLD_ID);
    expect(connector.status).toBe('active');
    expect(connector.jurisdiction_level).toBe('state');
    expect(connector.source_url).toContain('data.qld.gov.au');
    expect(connector.notes).toMatch(/\$'000/);
    expect(connector.notes).toMatch(/revenue measures/);
  });
});
