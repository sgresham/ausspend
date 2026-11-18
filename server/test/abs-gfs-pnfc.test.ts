import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import {
  ABS_GFS_PNFC_DATASET,
  ABS_GFS_PNFC_FISCAL_YEAR,
  ABS_GFS_PNFC_ID,
  ABS_GFS_PNFC_TABLES,
  ABS_GFS_PNFC_UNIT,
  ABS_GFS_PNFC_UNIT_TO_CENTS,
  absGfsPnfcAmountToCents,
  absGfsPnfcNaturalKey,
  parseAbsGfsPnfcReleasePage,
  parseAbsGfsPnfcWorkbook,
  transformAbsGfsPnfcRaw,
  type AbsGfsPnfcRaw,
  type AbsGfsPnfcSelection,
  type AbsGfsPnfcSourceMeta,
} from '../src/connectors/abs-gfs-pnfc.js';
import { MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_pnfc`;
const app = createApp({ pingDb: async () => 'connected' });

let fixtureDir = '';
const workbookPaths: Record<string, string> = {};
const selections: AbsGfsPnfcSelection[] = [];
const years = [
  '2015-16',
  '2016-17',
  '2017-18',
  '2018-19',
  '2019-20',
  '2020-21',
  '2021-22',
  '2022-23',
  '2023-24',
  '2024-25',
];

function fixtureMeta(selection: AbsGfsPnfcSelection): AbsGfsPnfcSourceMeta {
  return {
    source_sha256: `sha-${selection.file_id}`,
    filename: selection.filename,
    source_url: selection.source_url,
    release_url: 'https://example.test/release',
    source_date: '2026-04-21',
  };
}

async function writeFixtureWorkbook(
  selection: AbsGfsPnfcSelection,
  index: number,
): Promise<string> {
  const file = path.join(fixtureDir, selection.filename);
  const workbook = new ExcelJS.Workbook();
  const contents = workbook.addWorksheet('Contents');
  contents.addRow(['ABS GFS PNFC fixture']);

  const sheet = workbook.addWorksheet('Table_1');
  sheet.addRow(['Australian Bureau of Statistics']);
  sheet.addRow([`${selection.file_id} Government Finance Statistics, Australia, 2024-25`]);
  sheet.addRow(['Released at 11:30 am (Canberra time) Tue 21 April 2026']);
  sheet.addRow([
    `Table 1 ${selection.title_token} Public Non-financial Corporations Operating Statement`,
  ]);
  sheet.addRow(['', ...years]);
  sheet.addRow(['', ...years.map(() => ABS_GFS_PNFC_UNIT)]);
  sheet.addRow(['GFS Revenue']);
  sheet.addRow(['Current grants and subsidies', ...years.map(() => 1)]);
  sheet.addRow([
    'Total GFS revenue',
    ...years.map((_, column) => (column === years.length - 1 ? 1000 + index : 1)),
  ]);
  sheet.addRow(['']);
  sheet.addRow(['GFS Expenses']);
  sheet.addRow(['Depreciation', ...years.map(() => 1)]);
  sheet.addRow([
    'Total GFS expenses',
    ...years.map((_, column) => (column === years.length - 1 ? 2000 + index : 1)),
  ]);
  sheet.addRow(['© Commonwealth of Australia 2026']);

  await workbook.xlsx.writeFile(file);
  return file;
}

beforeAll(async () => {
  fixtureDir = await mkdtemp(path.join(tmpdir(), 'ausspend-abs-pnfc-'));
  ABS_GFS_PNFC_TABLES.forEach((spec) => {
    selections.push({
      ...spec,
      source_url: `https://example.test/${spec.filename}`,
    });
    workbookPaths[spec.filename] = '';
  });
  for (let index = 0; index < selections.length; index += 1) {
    const selection = selections[index]!;
    workbookPaths[selection.filename] = await writeFixtureWorkbook(selection, index);
  }
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
});

async function parseAll(): Promise<AbsGfsPnfcRaw[]> {
  const raw: AbsGfsPnfcRaw[] = [];
  for (const selection of selections) {
    const parsed = await parseAbsGfsPnfcWorkbook(
      workbookPaths[selection.filename]!,
      selection,
      fixtureMeta(selection),
    );
    raw.push(...parsed.raw);
  }
  return raw;
}

describe('ABS GFS PNFC release page discovery', () => {
  it('finds the nine genuine PNFC data cubes by aria-label', () => {
    const links = ABS_GFS_PNFC_TABLES.map(
      (spec) =>
        `<a href="/statistics/economy/government/government-finance-statistics-annual/2024-25/${spec.filename}" aria-label="Download - Table 999. Public non-financial corporations - ${spec.place} xlsx 60 KB" download="">Download</a>`,
    ).join('');
    const parsed = parseAbsGfsPnfcReleasePage(`<html>${links}</html>`);
    expect(parsed).toHaveLength(9);
    expect(parsed.map((entry) => entry.jurisdiction)).toEqual([
      'Australia',
      'NSW',
      'VIC',
      'QLD',
      'SA',
      'WA',
      'TAS',
      'NT',
      'ACT',
    ]);
    expect(parsed.every((entry) => entry.source_url.endsWith('.xlsx'))).toBe(true);
  });

  it('ignores non-PNFC tables and fails loudly when a PNFC cube is missing', () => {
    const html = `<a href="/x.xlsx" aria-label="Download - Table 140. Non-financial public sector - Commonwealth xlsx 1 KB">x</a>`;
    expect(() => parseAbsGfsPnfcReleasePage(html)).toThrow(/PNFC XLSX link/);
  });
});

describe('ABS GFS PNFC workbook parser', () => {
  it('reads only the two published totals and validates the $m unit', async () => {
    const raw = await parseAll();
    expect(raw).toHaveLength(18);
    expect(raw.every((row) => row.unit === ABS_GFS_PNFC_UNIT)).toBe(true);
    expect(raw.every((row) => row.fiscal_year === ABS_GFS_PNFC_FISCAL_YEAR)).toBe(true);
    expect(new Set(raw.map((row) => row.gfs_flow))).toEqual(new Set(['revenue', 'expense']));
    expect(raw.filter((row) => row.level === 'national')).toHaveLength(2);
    expect(raw.filter((row) => row.level === 'state')).toHaveLength(16);
    expect(raw.every((row) => row.table_title.includes('Public Non-financial Corporations'))).toBe(
      true,
    );
    expect(raw.some((row) => row.gfs_line_item === 'total_revenue')).toBe(true);
    expect(raw.some((row) => row.gfs_line_item === 'total_expenses')).toBe(true);
  });

  it('rejects a general-government workbook instead of co-opting it', async () => {
    const file = path.join(fixtureDir, 'general-government.xlsx');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Table_1');
    sheet.addRow(['Australian Bureau of Statistics']);
    sheet.addRow(['fixture']);
    sheet.addRow(['released']);
    sheet.addRow(['Table 1 General government operating statement']);
    sheet.addRow(['', ...years]);
    sheet.addRow(['', ...years.map(() => '$m')]);
    sheet.addRow(['GFS Revenue']);
    sheet.addRow(['Total GFS revenue', ...years.map(() => 1)]);
    sheet.addRow(['GFS Expenses']);
    sheet.addRow(['Total GFS expenses', ...years.map(() => 2)]);
    await workbook.xlsx.writeFile(file);
    await expect(
      parseAbsGfsPnfcWorkbook(file, ABS_GFS_PNFC_TABLES[0]!, fixtureMeta(selections[0]!)),
    ).rejects.toThrow(/not a PNFC operating statement/);
  });

  it('rejects a non-$m unit rather than inferring it', async () => {
    const spec = ABS_GFS_PNFC_TABLES[1]!;
    const file = path.join(fixtureDir, 'wrong-unit.xlsx');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Table_1');
    sheet.addRow(['Australian Bureau of Statistics']);
    sheet.addRow(['fixture']);
    sheet.addRow(['released']);
    sheet.addRow([
      `Table 1 ${spec.title_token} Public Non-financial Corporations Operating Statement`,
    ]);
    sheet.addRow(['', ...years]);
    sheet.addRow(['', ...years.map(() => '$')]);
    sheet.addRow(['GFS Revenue']);
    sheet.addRow(['Total GFS revenue', ...years.map(() => 1)]);
    sheet.addRow(['GFS Expenses']);
    sheet.addRow(['Total GFS expenses', ...years.map(() => 2)]);
    await workbook.xlsx.writeFile(file);
    await expect(
      parseAbsGfsPnfcWorkbook(file, spec, {
        ...fixtureMeta(selections[1]!),
        filename: 'wrong-unit.xlsx',
      }),
    ).rejects.toThrow(/unit must be "\$m"/);
  });
});

describe('ABS GFS PNFC transform', () => {
  it('emits verified pnfc benchmark rows, integer cents and honest locations', async () => {
    const raw = await parseAll();
    const result = transformAbsGfsPnfcRaw(raw);
    expect(result.records).toHaveLength(18);
    expect(result.duplicates).toBe(0);
    for (const record of result.records) {
      expect(record.verified).toBe(true);
      expect(record.data_quality_flag).toBe('verified');
      expect(record.aggregation_role).toBe('benchmark');
      expect(record.measure_type).toBe('actual');
      expect(record.jurisdiction_level).toBe('pnfc');
      expect(record.source_id).toBe(ABS_GFS_PNFC_ID);
      expect(record.source_dataset).toBe(ABS_GFS_PNFC_DATASET);
      expect(record.fiscal_year).toBe(ABS_GFS_PNFC_FISCAL_YEAR);
      expect(Number.isSafeInteger(record.amount_cents)).toBe(true);
      expect(record.function_code).toBeUndefined();
      expect(record.project_name).toBeUndefined();
      expect(record.notes).toMatch(/never add|never summed/i);
      expect(record.notes).toMatch(/no PNFC\/GFS dataflow/i);
    }
    const national = result.records.filter((record) => record.jurisdiction === 'Australia');
    expect(national).toHaveLength(2);
    expect(national.every((record) => record.location === undefined)).toBe(true);
    const nsw = result.records.filter((record) => record.jurisdiction === 'NSW');
    expect(nsw).toHaveLength(2);
    expect(nsw.every((record) => record.location?.state === 'NSW')).toBe(true);
    expect(result.records.filter((record) => record.gfs_flow === 'revenue')).toHaveLength(9);
    expect(result.records.filter((record) => record.gfs_flow === 'expense')).toHaveLength(9);
  });

  it('converts $m to cents at the confirmed scale', () => {
    expect(absGfsPnfcAmountToCents(122_229)).toBe(12_222_900_000_000);
    expect(absGfsPnfcAmountToCents(0)).toBe(0);
    expect(() => absGfsPnfcAmountToCents(-1)).toThrow(/negative/);
  });

  it('is deterministic, uses hash(series_key+period), and deduplicates', async () => {
    const raw = await parseAll();
    const first = transformAbsGfsPnfcRaw(raw);
    const second = transformAbsGfsPnfcRaw(raw);
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(new Set(first.records.map((record) => record.natural_key)).size).toBe(18);
    const key = absGfsPnfcNaturalKey(
      '55120DO033_202425|national|Australia|revenue|total_revenue',
      '2024-25',
    );
    expect(key).toMatch(/^abs-gfs-pnfc:[a-f0-9]{40}$/);
    expect(
      absGfsPnfcNaturalKey('55120DO033_202425|national|Australia|revenue|total_revenue', '2024-25'),
    ).toBe(key);
    expect(
      absGfsPnfcNaturalKey('55120DO033_202425|national|Australia|revenue|total_revenue', '2023-24'),
    ).not.toBe(key);
    const duplicated = transformAbsGfsPnfcRaw([...raw, ...raw]);
    expect(duplicated.records).toHaveLength(18);
    expect(duplicated.duplicates).toBe(18);
  });
});

describe('ABS GFS PNFC API separation and no-sum', () => {
  beforeAll(async () => {
    const raw = await parseAll();
    const result = transformAbsGfsPnfcRaw(raw);
    await MeasureModel.insertMany(result.records);
    await MeasureModel.create({
      amount_cents: 500_000,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: 'aus-tender',
      source_url: 'https://example.test/aus-tender.json',
      verified: false,
      natural_key: 'pnfc-fixture-project-row',
      function_code: '07',
      aggregation_role: 'additive',
      jurisdiction_level: 'federal',
      jurisdiction: 'Commonwealth',
    });
  });

  it('serves PNFC only at /api/benchmark/pnfc with no computed total', async () => {
    const response = await request(app).get('/api/benchmark/pnfc?fiscal_year=2024-25');
    expect(response.status).toBe(200);
    expect(response.body.source.source_id).toBe(ABS_GFS_PNFC_ID);
    expect(response.body.source.unit).toBe('$m');
    expect(response.body.source.unit_to_cents).toBe(ABS_GFS_PNFC_UNIT_TO_CENTS);
    expect(response.body.source.label).toMatch(/sector aggregate/i);
    expect(response.body.series).toHaveLength(18);
    expect(response.body.series.every((row: { verified: boolean }) => row.verified === true)).toBe(
      true,
    );
    expect(
      response.body.series.every(
        (row: { jurisdiction_level: string }) => row.jurisdiction_level === 'pnfc',
      ),
    ).toBe(true);
    expect(response.body.counts.by_flow).toEqual({ expense: 9, revenue: 9 });
    expect(response.body).not.toHaveProperty('total_cents');
    expect(
      response.body.series.every((row: Record<string, unknown>) => !('total_cents' in row)),
    ).toBe(true);
    expect(response.body.note).toMatch(/never add/i);
  });

  it('filters by flow without combining revenue and expense', async () => {
    const revenue = await request(app).get('/api/benchmark/pnfc?flow=revenue');
    expect(revenue.status).toBe(200);
    expect(revenue.body.series).toHaveLength(9);
    expect(
      revenue.body.series.every((row: { gfs_flow: string }) => row.gfs_flow === 'revenue'),
    ).toBe(true);
    const expense = await request(app).get('/api/benchmark/pnfc?flow=expense');
    expect(expense.body.series).toHaveLength(9);
    expect(expense.body.counts.by_flow).toEqual({ expense: 9 });
  });

  it('excludes PNFC benchmark rows from generic spending and totals', async () => {
    const response = await request(app).get('/api/spending?fiscal_year=2024-25');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].source_id).toBe('aus-tender');
    expect(response.body.summary.total_cents).toBe(500_000);
    const pnfcOnly = await request(app).get('/api/spending?jurisdiction_level=pnfc');
    expect(pnfcOnly.status).toBe(200);
    expect(pnfcOnly.body.data).toHaveLength(0);
    expect(pnfcOnly.body.summary.total_cents).toBeNull();
  });
});
