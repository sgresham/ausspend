import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  AIHW_DATASET,
  AIHW_DETAILED_SOURCES,
  AIHW_EXPECTED_SHA256,
  AIHW_FISCAL_YEARS,
  AIHW_FUNCTION_CODE,
  AIHW_ID,
  AIHW_LEAF_AREAS,
  AIHW_RESOURCE_URL,
  AIHW_SOURCE_URL,
  AIHW_STATES,
  AIHW_TABLES,
  AIHW_UNIT,
  AIHW_UNIT_LABEL,
  AIHW_UNIT_TO_CENTS,
  aihwMillionsToCents,
  aihwNaturalKey,
  buildAihwRecords,
  createAihwHealthExpenditureConnector,
  parseAihwNumber,
  parseAihwSheet,
  parseAihwWorkbook,
  readAihwWorkbook,
} from '../src/connectors/aihw-health-expenditure.js';
import { isAdditiveMeasure, isNonAdditiveMeasure } from '../src/api/measure-summary.js';
import { AIHW_SOURCE_ID, measureQuery } from '../src/api/filters.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import { createApp } from '../src/app.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_aihw`;

const REAL_ARCHIVE = path.join(
  process.env.HOME ?? '',
  'ausspend-source-archive',
  'aihw-health-expenditure',
  'AIHW-HWE-110-HEA-2024-25-data-tables.xlsx',
);

const HEADERS = [
  'Area of expenditure',
  'DVA',
  'Health and other',
  'Premium rebates',
  'Total',
  'State and local',
  'Total',
  'Total',
  'HIF',
  'Individuals',
  'Other',
  'Total',
  'Total',
  'Total health expenditure',
];

function setCell(
  sheet: ExcelJS.Worksheet,
  row: number,
  column: number,
  value: string | number | null,
): void {
  sheet.getRow(row).getCell(column).value = value;
}

function writeHeaders(sheet: ExcelJS.Worksheet, title: string): void {
  setCell(sheet, 1, 1, title);
  setCell(sheet, 2, 2, 'Government');
  HEADERS.forEach((header, index) => setCell(sheet, 4, index + 1, header));
}

function addArea(
  sheet: ExcelJS.Worksheet,
  row: number,
  area: string,
  values: Array<number | string | null>,
): void {
  setCell(sheet, row, 1, area);
  const columns = [2, 3, 4, 6, 9, 10, 11];
  columns.forEach((column, index) => setCell(sheet, row, column, values[index] ?? '. .'));
}

function buildSyntheticWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const contents = workbook.addWorksheet('Contents');
  setCell(contents, 1, 1, 'Health expenditure Australia 2024–25 — synthetic fixture');

  for (const spec of AIHW_TABLES) {
    const sheet = workbook.addWorksheet(spec.sheet);
    writeHeaders(
      sheet,
      `Table ${spec.sheet}: Total health expenditure, current prices, ${spec.state_name}, by area of expenditure and source of funds, ${spec.fiscal_year.replace('-', '–')} ($ million)`,
    );
    let row = 5;
    let total = 0;
    for (const area of AIHW_LEAF_AREAS) {
      addArea(sheet, row, area, [1, 2, 3, 4, 5, 6, 7]);
      total += 28;
      row += 1;
    }
    // Published parent rows are present but must never be emitted.
    addArea(sheet, row, 'Hospital services', [9, 9, 9, 9, 9, 9, 9]);
    setCell(sheet, row + 1, 1, 'Total recurrent expenditure');
    setCell(sheet, 25, 1, 'Total health expenditure');
    setCell(sheet, 25, 14, total);
  }
  return workbook;
}

function byDetailed(records: SpendingRecord[], detailed: string): SpendingRecord {
  const record = records.find((entry) => entry.aihw_detailed_source_of_funding === detailed);
  if (!record) throw new Error(`missing record ${detailed}`);
  return record;
}

describe('AIHW current workbook mapping', () => {
  const workbook = buildSyntheticWorkbook();
  const parsed = parseAihwWorkbook(workbook);

  it('parses 24 current tables, 8 states and 3 years', () => {
    expect(parsed.tables).toHaveLength(24);
    expect(new Set(parsed.tables.map((table) => table.state)).size).toBe(8);
    expect(new Set(parsed.tables.map((table) => table.fiscal_year))).toEqual(
      new Set(AIHW_FISCAL_YEARS),
    );
    expect(parsed.records).toHaveLength(24 * AIHW_LEAF_AREAS.length * 7);
    expect(buildAihwRecords(workbook).records).toHaveLength(parsed.records.length);
  });

  it('populates COFOG 07 and non-additive actual detail on every accepted row', () => {
    for (const record of parsed.records) {
      expect(record.function_code).toBe(AIHW_FUNCTION_CODE);
      expect(record.measure_type).toBe('actual');
      expect(record.source_id).toBe(AIHW_ID);
      expect(record.source_url).toBe(AIHW_RESOURCE_URL);
      expect(record.source_dataset).toBe(AIHW_DATASET);
      expect(record.verified).toBe(true);
      expect(record.data_quality_flag).toBe('verified');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.aihw_unit).toBe(AIHW_UNIT);
      expect(record.aihw_price_basis).toBe('current_prices');
      expect(record.aihw_table).toMatch(/^Table B\d+$/);
      expect(record.location?.state).toBeTruthy();
      expect(isAdditiveMeasure(record)).toBe(false);
      expect(isNonAdditiveMeasure(record)).toBe(true);
    }
  });

  it('keeps federal, state and non-government funding separate', () => {
    const federal = byDetailed(parsed.records, "Department of Veterans' Affairs");
    const state = byDetailed(parsed.records, 'State and local government');
    const nonGovernment = byDetailed(parsed.records, 'Individuals');
    expect(federal.jurisdiction_level).toBe('federal');
    expect(federal.jurisdiction).toBe('Australia');
    expect(federal.aihw_funding_sector).toBe('government');
    expect(federal.potential_double_count).toBe(true);
    expect(state.jurisdiction_level).toBe('state');
    expect(state.jurisdiction).toBe('NSW');
    expect(state.aihw_funding_sector).toBe('government');
    expect(state.potential_double_count).toBe(true);
    expect(nonGovernment.jurisdiction_level).toBe('other');
    expect(nonGovernment.jurisdiction).toBe('NSW');
    expect(nonGovernment.aihw_funding_sector).toBe('non_government');
    expect(nonGovernment.potential_double_count).toBe(false);
  });

  it('does not emit parent/subtotal rows or total funding columns', () => {
    expect(
      parsed.records.some(
        (record) =>
          record.aihw_area_of_expenditure === 'Hospital services' ||
          record.aihw_area_of_expenditure === 'Primary health care' ||
          record.aihw_area_of_expenditure === 'Total health expenditure',
      ),
    ).toBe(false);
    expect(
      parsed.records.some((record) => record.aihw_detailed_source_of_funding?.includes('Total')),
    ).toBe(false);
  });

  it('converts current-price $m to integer cents and preserves printed signs', () => {
    expect(aihwMillionsToCents(1)).toBe(100_000_000);
    expect(aihwMillionsToCents(0.5)).toBe(50_000_000);
    expect(aihwMillionsToCents(1234)).toBe(123_400_000_000);
    const sheet = workbook.getWorksheet('Table B1')!;
    setCell(sheet, 6, 2, -84);
    const parsedSheet = parseAihwSheet(sheet, AIHW_TABLES[0]!);
    const negative = parsedSheet.records.find(
      (record) =>
        record.aihw_area_of_expenditure === 'Private hospitals' &&
        record.aihw_detailed_source_of_funding === "Department of Veterans' Affairs",
    );
    expect(negative?.amount_cents).toBe(84 * AIHW_UNIT_TO_CENTS);
    expect(negative?.aihw_printed_sign).toBe('negative');
  });

  it('skips . ., — and blank cells but keeps a published zero', () => {
    const sheet = workbook.getWorksheet('Table B1')!;
    setCell(sheet, 8, 2, '. .');
    setCell(sheet, 8, 3, '—');
    setCell(sheet, 8, 4, null);
    setCell(sheet, 8, 6, 10);
    setCell(sheet, 8, 9, 20);
    setCell(sheet, 8, 10, 0);
    setCell(sheet, 8, 11, 30);
    const parsedSheet = parseAihwSheet(sheet, AIHW_TABLES[0]!);
    const dental = parsedSheet.records.filter(
      (record) => record.aihw_area_of_expenditure === 'Dental services',
    );
    expect(dental).toHaveLength(4);
    expect(dental.some((record) => record.amount_cents === 0)).toBe(true);
    expect(parsedSheet.skipped.length).toBeGreaterThan(0);
  });

  it('uses stable natural keys and is idempotent', () => {
    const again = buildAihwRecords(buildSyntheticWorkbook());
    expect(again.records.map((record) => record.natural_key)).toEqual(
      parsed.records.map((record) => record.natural_key),
    );
    const key = aihwNaturalKey({
      fiscal_year: '2024-25',
      state: 'NSW',
      area: 'Public hospital services',
      detailed: 'Individuals',
      price_basis: 'current_prices',
    });
    expect(key).toBe(
      aihwNaturalKey({
        fiscal_year: '2024-25',
        state: 'NSW',
        area: 'Public hospital services',
        detailed: 'Individuals',
        price_basis: 'current_prices',
      }),
    );
    expect(key.startsWith(`${AIHW_ID}:`)).toBe(true);
  });

  it('parses numeric cells without inventing values for non-numeric markers', () => {
    const cell = { value: '12.5' } as ExcelJS.Cell;
    expect(parseAihwNumber(cell)).toBe(12.5);
    expect(parseAihwNumber({ value: '. .' } as ExcelJS.Cell)).toBeNull();
    expect(parseAihwNumber({ value: '—' } as ExcelJS.Cell)).toBeNull();
    expect(parseAihwNumber({ value: null } as ExcelJS.Cell)).toBeNull();
  });

  it('rejects a workbook missing a current year table', () => {
    const missing = buildSyntheticWorkbook();
    missing.removeWorksheet('Table B24');
    expect(() => parseAihwWorkbook(missing)).toThrow(/missing Table B24/);
  });
});

describe('AIHW connector and DB ingestion', { timeout: 30_000 }, () => {
  let tempDir: string;
  let workbookPath: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'ausspend-aihw-'));
    workbookPath = path.join(tempDir, 'aihw.xlsx');
    await buildSyntheticWorkbook().xlsx.writeFile(workbookPath);
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('fetches and transforms the current workbook without a network call', async () => {
    const connector = createAihwHealthExpenditureConnector({ workbookPath, archiveRoot: tempDir });
    const raw = await connector.fetch();
    const records = connector.transform(raw);
    expect(records).toHaveLength(24 * AIHW_LEAF_AREAS.length * 7);
    expect(connector.metadata.errors).toEqual([]);
    expect(connector.metadata.warnings.join(' ')).toMatch(/tables=24/);
  });

  it('runs twice without duplicating AIHW rows and preserves an unrelated source', async () => {
    const other: SpendingRecord = {
      amount_cents: 1_000,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: 'unrelated-source',
      source_url: 'https://example.gov.au/unrelated',
      verified: true,
      natural_key: 'unrelated-source:1',
      description: 'Unrelated fixture row',
    };
    await MeasureModel.create(other);

    const connector = createAihwHealthExpenditureConnector({ workbookPath, archiveRoot: tempDir });
    await runIngestion({ connectors: [connector] });
    await runIngestion({ connectors: [connector] });

    const expected = 24 * AIHW_LEAF_AREAS.length * 7;
    expect(await MeasureModel.countDocuments({ source_id: AIHW_ID })).toBe(expected);
    expect(await MeasureModel.countDocuments({ source_id: AIHW_ID, function_code: '07' })).toBe(
      expected,
    );
    expect(
      await MeasureModel.countDocuments({
        source_id: AIHW_ID,
        $or: [{ aggregation_role: { $ne: 'agency_detail' } }, { measure_type: { $ne: 'actual' } }],
      }),
    ).toBe(0);
    expect(await MeasureModel.countDocuments({ source_id: 'unrelated-source' })).toBe(1);
    const source = await DataSourceModel.findOne({ source_id: AIHW_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(expected);
    expect(source?.fetch_strategy).toBe('direct');
  });

  it('excludes AIHW from the default API view but exposes it by source_id', async () => {
    const app = createApp({ pingDb: async () => 'connected' });
    const generic = await request(app).get('/api/spending?limit=20');
    expect(generic.status).toBe(200);
    expect(generic.body.summary.non_additive_count).toBe(0);
    expect(generic.body.data.some((row: { source_id: string }) => row.source_id === AIHW_ID)).toBe(
      false,
    );

    const explicit = await request(app).get(`/api/spending?source_id=${AIHW_ID}&limit=20`);
    expect(explicit.status).toBe(200);
    expect(explicit.body.summary.total_cents).toBeNull();
    expect(
      explicit.body.data.every((row: { source_id: string }) => row.source_id === AIHW_ID),
    ).toBe(true);
  });
});

describe('AIHW generic-query separation', () => {
  it('is excluded from generic views unless the source is requested explicitly', () => {
    expect(measureQuery({ limit: 20 }).source_id).toEqual({ $ne: AIHW_SOURCE_ID });
    expect(measureQuery({ source_id: AIHW_SOURCE_ID, limit: 20 }).source_id).toBe(AIHW_SOURCE_ID);
  });
});

describe('AIHW real archived workbook', () => {
  it.skipIf(!existsSync(REAL_ARCHIVE))(
    'matches the documented SHA and current state/year totals',
    async () => {
      const { createHash } = await import('node:crypto');
      const { readFile } = await import('node:fs/promises');
      const bytes = await readFile(REAL_ARCHIVE);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(AIHW_EXPECTED_SHA256);
      const workbook = await readAihwWorkbook(REAL_ARCHIVE);
      const parsed = buildAihwRecords(workbook);
      expect(parsed.tables).toHaveLength(24);
      expect(parsed.records.length).toBeGreaterThanOrEqual(1_000);
      expect(new Set(parsed.records.map((record) => record.fiscal_year))).toEqual(
        new Set(AIHW_FISCAL_YEARS),
      );
      expect(parsed.records.every((record) => record.function_code === '07')).toBe(true);
      expect(
        parsed.records.filter((record) => record.aihw_funding_sector === 'government').length,
      ).toBeGreaterThan(0);
      expect(
        parsed.records.filter((record) => record.aihw_funding_sector === 'non_government').length,
      ).toBeGreaterThan(0);

      const totals = new Map(
        parsed.tables.map((table) => [`${table.state}:${table.fiscal_year}`, table]),
      );
      expect(totals.get('NSW:2024-25')?.published_total_millions).toBe(83_816);
      expect(totals.get('VIC:2023-24')?.published_total_millions).toBe(67_958);
      expect(totals.get('QLD:2024-25')?.published_total_millions).toBe(61_959);
      for (const table of parsed.tables) {
        expect(table.difference_millions).not.toBeNull();
        expect(table.difference_millions!).toBeLessThanOrEqual(20);
      }
    },
  );
});

describe('AIHW constants', () => {
  it('documents the current source and unit', () => {
    expect(AIHW_SOURCE_URL).toContain('health-expenditure-australia-2024-25');
    expect(AIHW_RESOURCE_URL).toContain('AIHW-HWE-110-HEA-2024-25-data-tables.xlsx');
    expect(AIHW_UNIT_LABEL).toBe('$ million (current prices)');
    expect(AIHW_STATES).toHaveLength(8);
    expect(Object.keys(AIHW_DETAILED_SOURCES)).toHaveLength(7);
  });
});
