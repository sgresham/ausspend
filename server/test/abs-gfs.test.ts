import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import request from 'supertest';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import {
  ABS_GFS_FUNCTIONS,
  ABS_GFS_ID,
  ABS_GFS_RELEASE_URL,
  ABS_GFS_TABLE10_COLUMNS,
  ABS_GFS_TABLE9_COLUMNS,
  ABS_GFS_UNIT,
  ABS_GFS_UNIT_TO_CENTS,
  absGfsAmountToCents,
  absGfsNaturalKey,
  parseAbsGfsReleasePage,
  parseAbsGfsWorkbook,
  transformAbsGfsRaw,
  type AbsGfsSourceMeta,
} from '../src/connectors/abs-gfs.js';
import { FunctionModel, MeasureModel } from '../src/models/index.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_absgfs`;
const app = createApp({ pingDb: async () => 'connected' });

const T9_HEADERS = ABS_GFS_TABLE9_COLUMNS.map((column) => column.label);
const T10_HEADERS = ABS_GFS_TABLE10_COLUMNS.map((column) => column.label);
const FUNCTION_LABELS = [
  'General public services',
  'Defence',
  'Public order and safety',
  'Economic affairs',
  'Environmental protection',
  'Housing and community amenities',
  'Health',
  'Recreation, culture and religion',
  'Education',
  'Social protection',
  'Transport',
];

let fixtureDir = '';
let workbookPath = '';

function fixtureMeta(sha = 'fixture-sha'): AbsGfsSourceMeta {
  return {
    source_sha256: sha,
    filename: '55120DO094_202425.xlsx',
    source_url: 'https://example.test/55120DO094_202425.xlsx',
    catalogue_url: ABS_GFS_RELEASE_URL,
    source_date: '2026-04-21',
    release_url: ABS_GFS_RELEASE_URL,
  };
}

function amount(row: number, column: number): number {
  return 1_000 + row * 100 + column;
}

async function writeFixtureWorkbook(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ausspend-abs-gfs-'));
  const file = path.join(dir, '55120DO094_202425.xlsx');
  const workbook = new ExcelJS.Workbook();

  const contents = workbook.addWorksheet('Contents');
  contents.addRow(['ABS GFS fixture']);

  const table9 = workbook.addWorksheet('Table_9');
  table9.addRow(['Australian Bureau of Statistics']);
  table9.addRow(['55120DO094_202425 Government Finance Statistics, Australia, 2024-25']);
  table9.addRow(['Released at 11:30 am (Canberra time) Tue 21 April 2026']);
  table9.addRow([
    'Table 9 Expenses by purpose, general government sector, Commonwealth and state government',
  ]);
  table9.addRow(['', ...T9_HEADERS]);
  table9.addRow(['', ...T9_HEADERS.map(() => '2024-25')]);
  table9.addRow(['', ...T9_HEADERS.map(() => '$m')]);
  table9.addRow(['GFS Expenses']);
  FUNCTION_LABELS.forEach((label, index) => {
    const excelRow = 9 + index;
    table9.addRow(['', ...T9_HEADERS.map((_, columnIndex) => amount(excelRow, columnIndex + 2))]);
    table9.getCell(`A${excelRow}`).value = label;
  });
  table9.addRow(['Total expenses', ...T9_HEADERS.map(() => 999_999)]);
  table9.addRow(['© Commonwealth of Australia 2026']);

  const table10 = workbook.addWorksheet('Table_10');
  table10.addRow(['Australian Bureau of Statistics']);
  table10.addRow(['55120DO094_202425 Government Finance Statistics, Australia, 2024-25']);
  table10.addRow(['Released at 11:30 am (Canberra time) Tue 21 April 2026']);
  table10.addRow(['Table 10 Expenses by purpose, general government sector, local government']);
  table10.addRow(['', ...T10_HEADERS]);
  table10.addRow(['', ...T10_HEADERS.map(() => '2024-25')]);
  table10.addRow(['', ...T10_HEADERS.map(() => '$m')]);
  table10.addRow(['GFS Expenses']);
  FUNCTION_LABELS.filter((label) => label !== 'Defence').forEach((label, index) => {
    const excelRow = 9 + index;
    table10.addRow(['', ...T10_HEADERS.map((_, columnIndex) => amount(excelRow, columnIndex + 2))]);
    table10.getCell(`A${excelRow}`).value = label;
  });
  table10.addRow(['Total expenses', ...T10_HEADERS.map(() => 888_888)]);
  table10.addRow(['© Commonwealth of Australia 2026']);

  await workbook.xlsx.writeFile(file);
  fixtureDir = dir;
  return file;
}

beforeAll(async () => {
  workbookPath = await writeFixtureWorkbook();
  await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
});

describe('ABS GFS Key Tables parser', () => {
  it('parses Table 9/10 COFOG-A cells and confirms the $m unit', async () => {
    const parsed = await parseAbsGfsWorkbook(workbookPath, fixtureMeta());
    expect(parsed.raw).toHaveLength(169);
    expect(parsed.sheets).toContain('Table_9');
    expect(parsed.sheets).toContain('Table_10');
    expect(parsed.skipped.map((entry) => entry.label)).toEqual([
      'Total expenses',
      'Total expenses',
    ]);
    expect(parsed.raw.every((row) => row.unit === ABS_GFS_UNIT)).toBe(true);
    expect(parsed.raw.every((row) => row.fiscal_year === '2024-25')).toBe(true);
    expect(new Set(parsed.raw.map((row) => row.level))).toEqual(
      new Set(['federal', 'state', 'local']),
    );
    const federal = parsed.raw.filter((row) => row.level === 'federal');
    expect(federal).toHaveLength(11);
    expect(parsed.raw.filter((row) => row.level === 'state')).toHaveLength(88);
    expect(parsed.raw.filter((row) => row.level === 'local')).toHaveLength(70);
  });

  it('maps Transport to 045 and never rolls it into 04', async () => {
    const parsed = await parseAbsGfsWorkbook(workbookPath, fixtureMeta());
    const transport = parsed.raw.find((row) => row.function_code === '045');
    expect(transport).toBeDefined();
    expect(ABS_GFS_FUNCTIONS.Transport).toBe('045');
    expect(parsed.raw.some((row) => row.function_code === '04')).toBe(true);
  });
});

describe('ABS GFS transform', () => {
  it('emits verified benchmark rows with integer cents and no project-level data', async () => {
    const parsed = await parseAbsGfsWorkbook(workbookPath, fixtureMeta());
    const result = transformAbsGfsRaw(parsed.raw);
    expect(result.records).toHaveLength(169);
    expect(result.duplicates).toBe(0);
    for (const record of result.records) {
      expect(record.verified).toBe(true);
      expect(record.data_quality_flag).toBe('verified');
      expect(record.aggregation_role).toBe('benchmark');
      expect(record.measure_type).toBe('actual');
      expect(record.source_id).toBe(ABS_GFS_ID);
      expect(record.source_dataset).toBe('ABS Government Finance Statistics (GFS)');
      expect(record.fiscal_year).toBe('2024-25');
      expect(Number.isSafeInteger(record.amount_cents)).toBe(true);
      expect(record.project_name).toBeUndefined();
      expect(record.notes).toMatch(/benchmark/i);
      expect(record.notes).toMatch(/never (summed|add)/i);
      if (record.function_code === '045') {
        expect(record.notes).toMatch(/never rolled into 04/i);
      }
    }
    expect(result.records.every((record) => record.function_code !== undefined)).toBe(true);
  });

  it('converts $m to cents at the confirmed scale and keeps levels/locations honest', async () => {
    const parsed = await parseAbsGfsWorkbook(workbookPath, fixtureMeta());
    const result = transformAbsGfsRaw(parsed.raw);
    expect(absGfsAmountToCents(118_155)).toBe(11_815_500_000_000);
    expect(absGfsAmountToCents(0)).toBe(0);
    const federal = result.records.find(
      (record) => record.jurisdiction_level === 'federal' && record.function_code === '07',
    )!;
    expect(federal.jurisdiction).toBe('Australia');
    expect(federal.location).toBeUndefined();
    expect(federal.amount_cents).toBe(
      // Row 15 (Health) column 2 (Commonwealth) in the fixture.
      amount(15, 2) * ABS_GFS_UNIT_TO_CENTS,
    );
    const state = result.records.find(
      (record) =>
        record.jurisdiction_level === 'state' &&
        record.jurisdiction === 'NSW' &&
        record.function_code === '07',
    )!;
    expect(state.location).toEqual({ state: 'NSW' });
    expect(state.jurisdiction).toBe('NSW');
    const local = result.records.find(
      (record) =>
        record.jurisdiction_level === 'local' &&
        record.jurisdiction === 'VIC' &&
        record.function_code === '09',
    )!;
    expect(local.location).toEqual({ state: 'VIC' });
  });

  it('is deterministic and deduplicates identical natural keys', async () => {
    const parsed = await parseAbsGfsWorkbook(workbookPath, fixtureMeta());
    const first = transformAbsGfsRaw(parsed.raw);
    const second = transformAbsGfsRaw(parsed.raw);
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(new Set(first.records.map((record) => record.natural_key)).size).toBe(169);

    const duplicated = transformAbsGfsRaw([...parsed.raw, ...parsed.raw]);
    expect(duplicated.records).toHaveLength(169);
    expect(duplicated.duplicates).toBe(169);

    const key = absGfsNaturalKey('Table 9|federal|Australia|07', '2024-25');
    expect(key).toMatch(/^abs-gfs:[a-f0-9]{40}$/);
    expect(absGfsNaturalKey('Table 9|federal|Australia|07', '2024-25')).toBe(key);
    expect(absGfsNaturalKey('Table 9|federal|Australia|07', '2023-24')).not.toBe(key);
  });
});

describe('ABS GFS release page discovery', () => {
  it('finds the Key Tables XLSX link on the official release page', () => {
    const html = `<a href="/statistics/economy/government/government-finance-statistics-annual/2024-25/55120DO094_202425.xlsx" aria-label="Download - Key Tables xlsx 171.34 KB" download="">Download</a>`;
    const selection = parseAbsGfsReleasePage(html);
    expect(selection.source_url).toContain('55120DO094_202425.xlsx');
    expect(selection.fiscal_year).toBe('2024-25');
  });

  it('fails loudly when the release page has no Key Tables link', () => {
    expect(() => parseAbsGfsReleasePage('<html>no tables</html>')).toThrow(/Key Tables/);
  });
});

describe('ABS GFS benchmark API separation', () => {
  beforeAll(async () => {
    await FunctionModel.insertMany([
      { code: '01', name: 'General public services', level: 'division' },
      { code: '04', name: 'Economic affairs', level: 'division' },
      { code: '045', name: 'Transport', level: 'subdivision', parent_code: '04' },
      { code: '07', name: 'Health', level: 'division' },
    ]);
    const parsed = await parseAbsGfsWorkbook(workbookPath, fixtureMeta());
    const result = transformAbsGfsRaw(parsed.raw);
    await MeasureModel.insertMany(
      result.records.filter(
        (record) => record.function_code === '07' || record.function_code === '045',
      ),
    );
    await MeasureModel.create({
      amount_cents: 500_000,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: 'aus-tender',
      source_url: 'https://example.test/aus-tender.json',
      verified: false,
      natural_key: 'fixture-project-row',
      function_code: '07',
      aggregation_role: 'additive',
      jurisdiction_level: 'federal',
      jurisdiction: 'Commonwealth',
    });
  });

  it('excludes benchmark rows from generic spending and totals', async () => {
    const response = await request(app).get('/api/spending?function=07');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].source_id).toBe('aus-tender');
    expect(response.body.summary.total_cents).toBe(500_000);
    expect(response.body.summary.total_by_measure_type).toEqual([
      { measure_type: 'actual', count: 1, total_cents: 500_000 },
    ]);
  });

  it('serves the benchmark separately with no computed total', async () => {
    const response = await request(app).get('/api/benchmark?fiscal_year=2024-25');
    expect(response.status).toBe(200);
    expect(response.body.source.source_id).toBe(ABS_GFS_ID);
    expect(response.body.source.unit).toBe('$m');
    expect(response.body.source.unit_to_cents).toBe(ABS_GFS_UNIT_TO_CENTS);
    expect(response.body.series.length).toBeGreaterThan(0);
    expect(response.body.series.every((row: { verified: boolean }) => row.verified === true)).toBe(
      true,
    );
    expect(
      response.body.series.every((row: { aggregation_role?: string }) => !('total_cents' in row)),
    ).toBe(true);
    expect(response.body).not.toHaveProperty('total_cents');
    expect(response.body.counts.by_level).toMatchObject({ federal: expect.any(Number) });
    expect(response.body.source.caveat).toMatch(/never add/i);
  });
});
