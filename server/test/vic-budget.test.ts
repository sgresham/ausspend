import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  VIC_FISCAL_YEAR,
  VIC_ID,
  VIC_UNIT,
  VIC_UNIT_TO_CENTS,
  amountToCents,
  cofogMappingForLabel,
  createVicBudgetConnector,
  discoverVicSources,
  parseCofogWorkbook,
  parseDepartmentalWorkbook,
  readVicWorkbookStreaming,
  transformVicRaw,
  vicNaturalKey,
  type VicSourceMeta,
} from '../src/connectors/vic-budget.js';

let dir = '';

function meta(overrides: Partial<VicSourceMeta> = {}): VicSourceMeta {
  return {
    package_id: 'pkg-aggregate',
    package_name: 'state-budget-2026-27-aggregate-financial-statements',
    resource_id: 'res-cofog',
    resource_name:
      'Consolidated expenses by classification of the functions of government - General government sector',
    filename: '1.5_2026-27-budget-consolidated-gg-expenses-by-cofog.xlsx',
    url: 'https://example.test/1.5.xlsx',
    source_sha256: 'abc123',
    source_date: '2026-05-05',
    ...overrides,
  };
}

async function buildCofogWorkbook(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Expenses by COFOG');
  sheet.getCell('A1').value = 'Historical and estimated expenses by COFOG';
  sheet.getCell('D3').value = '($ million)';
  sheet.getCell('B4').value = '2025-26';
  sheet.getCell('C4').value = '2025-26';
  sheet.getCell('D4').value = '2026-27';
  sheet.getCell('B5').value = 'budget';
  sheet.getCell('C5').value = 'revised';
  sheet.getCell('D5').value = 'budget';
  sheet.getCell('A7').value = 'General public services';
  sheet.getCell('B7').value = 100;
  sheet.getCell('C7').value = 110;
  sheet.getCell('D7').value = 120;
  sheet.getCell('A8').value = 'Transport';
  sheet.getCell('B8').value = 50;
  sheet.getCell('C8').value = 55;
  sheet.getCell('D8').value = 60;
  sheet.getCell('A9').value = 'Not allocated by function';
  sheet.getCell('B9').value = -5;
  sheet.getCell('C9').value = -6;
  sheet.getCell('D9').value = -7;
  sheet.getCell('A10').value = 'Total expenses from transactions';
  sheet.getCell('B10').value = 145;
  sheet.getCell('C10').value = 159;
  sheet.getCell('D10').value = 173;
  await workbook.xlsx.writeFile(filePath);
}

async function buildCofogWithoutUnit(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Expenses by COFOG');
  sheet.getCell('B4').value = '2026-27';
  sheet.getCell('B5').value = 'budget';
  sheet.getCell('A7').value = 'Health';
  sheet.getCell('B7').value = 200;
  await workbook.xlsx.writeFile(filePath);
}

async function buildDepartmentalWorkbook(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('DTF');
  sheet.getCell('B2').value = 'Department of Treasury and Finance';
  sheet.getCell('B4').value = 'Comprehensive Operating statement';
  sheet.getCell('B5').value = '($ million)';
  sheet.getRow(6).values = [null, ' ', '2024-25', '2025-26', '2025-26', '2026-27'];
  sheet.getRow(7).values = [null, ' ', 'actual', 'budget', 'revised', 'budget'];
  sheet.getCell('B9').value = 'Income from transactions';
  sheet.getCell('B16').value = 'Expenses from transactions';
  sheet.getRow(17).values = [null, 'Employee benefits', 10, 20, 21, 22];
  sheet.getRow(18).values = [null, 'Grant expense', 5, 6, 6, 7];
  sheet.getRow(21).values = [null, 'Total expenses from transactions', 15, 26, 27, 29];
  sheet.getCell('B33').value = 'Balance sheet';
  await workbook.xlsx.writeFile(filePath);
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'ausspend-vic-test-'));
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('VIC units and COFOG mapping', () => {
  it('converts only the confirmed $m unit to integer cents', () => {
    expect(VIC_UNIT_TO_CENTS).toBe(100_000_000);
    expect(amountToCents(1, VIC_UNIT)).toBe(100_000_000);
    expect(amountToCents(1234.5678, VIC_UNIT)).toBe(123_456_780_000);
    expect(amountToCents(-1, VIC_UNIT)).toBeNull();
    expect(amountToCents(1, "$'000")).toBeNull();
    expect(amountToCents('n/a', VIC_UNIT)).toBeNull();
  });

  it('maps the nine shared COFOG divisions and Transport 045', () => {
    expect(cofogMappingForLabel('General public services')?.code).toBe('01');
    expect(cofogMappingForLabel('Public order and safety (m)(n)')?.code).toBe('03');
    expect(cofogMappingForLabel('Economic affairs (n)(o)')?.code).toBe('04');
    expect(cofogMappingForLabel('Environmental protection')?.code).toBe('05');
    expect(cofogMappingForLabel('Housing and community amenities')?.code).toBe('06');
    expect(cofogMappingForLabel('Health')?.code).toBe('07');
    expect(cofogMappingForLabel('Recreation, culture and religion')?.code).toBe('08');
    expect(cofogMappingForLabel('Education')?.code).toBe('09');
    expect(cofogMappingForLabel('Social protection')?.code).toBe('10');
    const transport = cofogMappingForLabel('Transport (n)(r)');
    expect(transport?.code).toBe('045');
    expect(transport?.note).toMatch(/must not be rolled into/i);
    expect(cofogMappingForLabel('Total expenses from transactions')).toBeNull();
    expect(cofogMappingForLabel('Not allocated by function')).toBeNull();
  });
});

describe('VIC COFOG workbook parsing', () => {
  it('streams the XLSX and ingests budget columns only', async () => {
    const filePath = path.join(dir, 'cofog.xlsx');
    await buildCofogWorkbook(filePath);
    const workbook = await readVicWorkbookStreaming(filePath);
    const skipped: Array<{ filename: string; sheet: string; row: number | null; reason: string }> =
      [];
    const raw = parseCofogWorkbook(workbook, meta(), skipped);
    expect(raw).toHaveLength(4);
    expect(raw.map((row) => row.function_code)).toEqual(['01', '01', '045', '045']);
    expect(raw.map((row) => row.fiscal_year)).toEqual(['2025-26', '2026-27', '2025-26', '2026-27']);
    expect(raw.every((row) => row.measure_type === 'budget')).toBe(true);
    expect(
      raw.find((row) => row.function_code === '01' && row.fiscal_year === '2026-27')?.raw_value,
    ).toBe(120);
    expect(skipped.some((row) => /Not allocated/.test(row.reason))).toBe(true);
    expect(skipped.some((row) => /total row excluded/.test(row.reason))).toBe(true);
  });

  it('refuses to parse a COFOG sheet without an explicit unit heading', async () => {
    const filePath = path.join(dir, 'cofog-no-unit.xlsx');
    await buildCofogWithoutUnit(filePath);
    const workbook = await readVicWorkbookStreaming(filePath);
    const skipped: Array<{ filename: string; sheet: string; row: number | null; reason: string }> =
      [];
    expect(parseCofogWorkbook(workbook, meta(), skipped)).toHaveLength(0);
    expect(skipped[0]?.reason).toMatch(/no COFOG header block/);
  });
});

describe('VIC departmental workbook parsing', () => {
  it('ingests only operating-statement expense components for budget columns', async () => {
    const filePath = path.join(dir, 'dtf.xlsx');
    await buildDepartmentalWorkbook(filePath);
    const workbook = await readVicWorkbookStreaming(filePath);
    const raw = parseDepartmentalWorkbook(
      workbook,
      meta({
        package_id: 'pkg-dept',
        resource_id: 'res-dtf',
        filename: 'department-of-treasury-and-finance-2026-27-bp5-online-data.xlsx',
        url: 'https://example.test/dtf.xlsx',
      }),
      'Department of Treasury and Finance',
    );
    expect(raw).toHaveLength(4);
    expect(raw.map((row) => row.label)).toEqual([
      'Employee benefits',
      'Employee benefits',
      'Grant expense',
      'Grant expense',
    ]);
    expect(raw.map((row) => row.fiscal_year)).toEqual(['2025-26', '2026-27', '2025-26', '2026-27']);
    expect(raw[1]?.raw_value).toBe(22);
    expect(raw.every((row) => row.measure_type === 'budget')).toBe(true);
  });
});

describe('VIC record mapping and idempotency', () => {
  it('builds additive COFOG records plus explicitly non-additive agency detail', async () => {
    const cofogPath = path.join(dir, 'cofog-map.xlsx');
    const deptPath = path.join(dir, 'dtf-map.xlsx');
    await buildCofogWorkbook(cofogPath);
    await buildDepartmentalWorkbook(deptPath);
    const cofogRaw = parseCofogWorkbook(await readVicWorkbookStreaming(cofogPath), meta());
    const deptRaw = parseDepartmentalWorkbook(
      await readVicWorkbookStreaming(deptPath),
      meta({
        package_id: 'pkg-dept',
        resource_id: 'res-dtf',
        filename: 'department-of-treasury-and-finance-2026-27-bp5-online-data.xlsx',
        url: 'https://example.test/dtf.xlsx',
      }),
      'Department of Treasury and Finance',
    );
    const raw = [...cofogRaw, ...deptRaw];
    const first = transformVicRaw(raw);
    const second = transformVicRaw(raw);
    expect(first.records).toHaveLength(8);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
    for (const record of first.records) {
      expect(record.source_id).toBe(VIC_ID);
      expect(record.measure_type).toBe('budget');
      expect(record.jurisdiction_level).toBe('state');
      expect(record.jurisdiction).toBe('VIC');
      expect(record.location?.state).toBe('VIC');
      expect(Number.isSafeInteger(record.amount_cents)).toBe(true);
      expect(record.amount_cents).toBeGreaterThan(0);
      expect(record.verified).toBe(false);
      expect(record.fiscal_year === '2025-26' || record.fiscal_year === VIC_FISCAL_YEAR).toBe(true);
      expect(record.natural_key).toMatch(/^vic-budget:[0-9a-f]{40}$/);
    }
    const cofogRecords = first.records.filter((record) => record.function_code);
    expect(cofogRecords.map((record) => record.function_code).sort()).toEqual([
      '01',
      '01',
      '045',
      '045',
    ]);
    expect(cofogRecords.every((record) => record.aggregation_role === 'additive')).toBe(true);
    for (const record of cofogRecords) {
      if (record.function_code === '045') {
        expect(record.data_quality_flag).toBe('statewide_only; transport_mapping_unconfirmed');
        expect(record.notes).toMatch(/MAPPING UNCONFIRMED/);
      } else {
        expect(record.data_quality_flag).toBe('statewide_only');
      }
    }
    const departmentRecords = first.records.filter(
      (record) => record.aggregation_role === 'agency_detail',
    );
    expect(departmentRecords).toHaveLength(4);
    expect(departmentRecords.every((record) => record.function_code === undefined)).toBe(true);
    expect(
      departmentRecords.every(
        (record) => record.delivery_entity === 'Department of Treasury and Finance',
      ),
    ).toBe(true);
    expect(departmentRecords.every((record) => record.notes?.includes('NON-ADDITIVE'))).toBe(true);
    expect(first.skipped).toHaveLength(0);
  });

  it('deduplicates repeated raw rows on natural_key', async () => {
    const filePath = path.join(dir, 'cofog-dedupe.xlsx');
    await buildCofogWorkbook(filePath);
    const raw = parseCofogWorkbook(await readVicWorkbookStreaming(filePath), meta());
    const result = transformVicRaw([...raw, ...raw]);
    expect(result.records).toHaveLength(raw.length);
    expect(result.duplicates).toBe(raw.length);
  });

  it('natural key hashes the package/resource/row identity', () => {
    expect(vicNaturalKey(['pkg', 'res', 'sheet', 7, '01', '2026-27'])).toBe(
      vicNaturalKey(['pkg', 'res', 'sheet', 7, '01', '2026-27']),
    );
    expect(vicNaturalKey(['pkg', 'res', 'sheet', 7, '01', '2026-27'])).not.toBe(
      vicNaturalKey(['pkg', 'res', 'sheet', 7, '045', '2026-27']),
    );
  });
});

describe('VIC discovery', () => {
  it('selects the COFOG and DTF XLSX resources from package_search', async () => {
    const packages: Record<string, unknown> = {
      aggregate: {
        id: 'pkg-agg',
        name: 'state-budget-2026-27-aggregate-financial-statements',
        title: 'State Budget 2026-27 - Aggregate financial statements',
        metadata_modified: '2026-05-05T22:38:09',
        resources: [
          {
            id: 'res-other',
            name: 'Consolidated balance sheet - General government sector',
            format: 'XLSX',
            url: 'https://example.test/1.2.xlsx',
          },
          {
            id: 'res-cofog',
            name: 'Consolidated expenses by classification of the functions of government - General government sector',
            format: 'XLSX',
            url: 'https://example.test/1.5_2026-27-budget-consolidated-gg-expenses-by-cofog.xlsx',
          },
        ],
      },
      departmental: {
        id: 'pkg-dept',
        name: 'state-budget-2026-27-departmental-statements',
        title: 'State Budget 2026-27 - Departmental statements',
        metadata_modified: '2026-05-06T03:51:04',
        resources: [
          {
            id: 'res-health',
            name: 'Department of Health - Financial statement',
            format: 'XLSX',
            url: 'https://example.test/department-of-health.xlsx',
          },
          {
            id: 'res-dtf',
            name: 'Department of Treasury and Finance - Financial statement',
            format: 'XLSX',
            url: 'https://example.test/department-of-treasury-and-finance-2026-27-bp5-online-data.xlsx',
          },
        ],
      },
    };
    const fakeFetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const q = url.searchParams.get('q') ?? '';
      const result = /aggregate/i.test(q) ? packages.aggregate : packages.departmental;
      return new Response(JSON.stringify({ success: true, result: { results: [result] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const selection = await discoverVicSources(fakeFetch);
    expect(selection.aggregate.resource_id).toBe('res-cofog');
    expect(selection.aggregate.filename).toBe(
      '1.5_2026-27-budget-consolidated-gg-expenses-by-cofog.xlsx',
    );
    expect(selection.aggregate.metadata_modified).toBe('2026-05-05');
    expect(selection.departmental.resource_id).toBe('res-dtf');
  });
});

describe('VIC connector registration', () => {
  it('registers vic-budget as an active state connector', () => {
    const connector = createVicBudgetConnector();
    expect(connector.id).toBe(VIC_ID);
    expect(connector.status).toBe('active');
    expect(connector.jurisdiction_level).toBe('state');
    expect(connector.source_url).toContain('discover.data.vic.gov.au');
    expect(connector.notes).toMatch(/Budgeted figures only/);
    expect(connector.notes).toMatch(/Transport is tagged 045/);
  });
});
