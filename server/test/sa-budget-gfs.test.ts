import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  SA_COFOG_NAMES,
  SA_GFS_DATASET,
  SA_GFS_FISCAL_YEARS,
  SA_GFS_ID,
  SA_GFS_MIN_ROWS,
  SA_GFS_SHA256,
  SA_GFS_TABLES,
  SA_GFS_UNIT,
  SA_GFS_UNIT_TO_CENTS,
  SA_GPC_TO_COFOG,
  assertSaGfsPremise,
  buildSaGfsRecords,
  createSaGfsConnector,
  detectSaGfsUnit,
  parseSaGfsWorkbook,
  readSaGfsWorkbook,
  saGfsNaturalKey,
  saThousandsToCents,
} from '../src/connectors/sa-budget-gfs.js';
import { isAdditiveMeasure, isNonAdditiveMeasure } from '../src/api/measure-summary.js';
import { runIngestion } from '../src/connectors/runner.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import { createApp } from '../src/app.js';

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_sa`;

const REAL_ARCHIVE = path.join(
  process.env.HOME ?? '',
  'ausspend-source-archive',
  'sa-budget-gfs',
  'cusersdellak01desktopgpc-by-etf-2015-16-to-2012-13.xlsx',
);

const FUNCTIONS = [
  ['0190', 'Other general public services'],
  ['0311', 'Police services'],
  ['0411', 'Primary education'],
  ['0511', 'Admitted patients in acute care institutions'],
  ['0610', 'Social security'],
  ['0711', 'Housing'],
  ['0811', 'National parks and wildlife'],
  ['1010', 'Agriculture'],
  ['1212', 'Road maintenance'],
  ['1410', 'Public debt transactions'],
] as const;

function setCell(
  sheet: ExcelJS.Worksheet,
  row: number,
  column: number,
  value: string | number | null,
): void {
  sheet.getRow(row).getCell(column).value = value;
}

function buildSyntheticWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const contents = workbook.addWorksheet('Contents');
  setCell(contents, 1, 1, 'South Australian GPC by ETF — synthetic fixture');

  for (const [yearIndex, spec] of SA_GFS_TABLES.entries()) {
    const sheet = workbook.addWorksheet(spec.sheet);
    setCell(sheet, 1, 1, `South Australian GPC by ETF - ${spec.fiscal_year}`);
    setCell(sheet, 3, 1, 'ETF');
    setCell(sheet, 3, 2, 'ETF');
    setCell(sheet, 3, 3, '1211');
    setCell(sheet, 3, 4, '1213');
    setCell(sheet, 3, 5, '1219');
    setCell(sheet, 3, 6, 'Total GPC');
    setCell(sheet, 4, 1, 'GPC');
    setCell(sheet, 4, 2, 'Description');
    setCell(sheet, 4, 3, 'Funded super');
    setCell(sheet, 4, 4, 'Wages, sal & supp');
    setCell(sheet, 4, 5, 'Other employee expenses');
    setCell(sheet, 4, 6, 'Total GPC');

    let row = 5;
    let grandTotal = 0;
    const columnTotals = [0, 0, 0];
    for (const [code, description] of FUNCTIONS) {
      const base = 1_000_000 + yearIndex * 10_000 + row * 1_000;
      const values =
        code === '0311' ? [-5_000_000, -4_000_000, -3_000_000] : [base, base + 1, base + 2];
      const total = values.reduce((sum, value) => sum + value, 0);
      setCell(sheet, row, 1, code);
      setCell(sheet, row, 2, description);
      values.forEach((value, index) => {
        setCell(sheet, row, 3 + index, value);
        columnTotals[index]! += value;
      });
      setCell(sheet, row, 6, total);
      grandTotal += total;
      row += 1;
    }

    // Non-COFOG memorandum row, read for reconciliation but never emitted.
    setCell(sheet, row, 1, '3450');
    setCell(sheet, row, 2, 'Nominal superannuation interest expense');
    setCell(sheet, row, 3, 1_000);
    setCell(sheet, row, 4, 2_000);
    setCell(sheet, row, 5, 3_000);
    setCell(sheet, row, 6, 6_000);
    columnTotals[0]! += 1_000;
    columnTotals[1]! += 2_000;
    columnTotals[2]! += 3_000;
    grandTotal += 6_000;
    row += 1;

    setCell(sheet, row, 1, 'TOTAL');
    setCell(sheet, row, 3, columnTotals[0]!);
    setCell(sheet, row, 4, columnTotals[1]!);
    setCell(sheet, row, 5, columnTotals[2]!);
    setCell(sheet, row, 6, grandTotal);
  }
  return workbook;
}

describe('SA GFS mapping', () => {
  const workbook = buildSyntheticWorkbook();
  const parsed = parseSaGfsWorkbook(workbook);

  it('parses four years with GPC -> COFOG mapping and at least 50 rows', () => {
    expect(parsed.tables).toHaveLength(4);
    expect(parsed.records.length).toBeGreaterThanOrEqual(SA_GFS_MIN_ROWS);
    expect(parsed.unit).toBe('AUD_thousands');
    expect(parsed.records.every((record) => SA_COFOG_NAMES[record.function_code ?? ''])).toBe(true);
    expect(parsed.records.every((record) => record.measure_type === 'actual')).toBe(true);
    expect(parsed.records.every((record) => record.function_code !== '34')).toBe(true);
    expect(() => assertSaGfsPremise(parsed)).not.toThrow();
  });

  it('maps representative GPC divisions to the correct COFOG divisions', () => {
    expect(SA_GPC_TO_COFOG['04']).toBe('09');
    expect(SA_GPC_TO_COFOG['05']).toBe('07');
    expect(SA_GPC_TO_COFOG['06']).toBe('10');
    expect(SA_GPC_TO_COFOG['07']).toBe('06');
    expect(SA_GPC_TO_COFOG['09']).toBe('04');
    expect(SA_GPC_TO_COFOG['14']).toBe('01');
    const education = parsed.records.find((record) => record.sa_gpc_code === '0411');
    const health = parsed.records.find((record) => record.sa_gpc_code === '0511');
    expect(education?.function_code).toBe('09');
    expect(health?.function_code).toBe('07');
  });

  it('stores statewide provenance, unit and source metadata', () => {
    for (const record of parsed.records) {
      expect(record.source_id).toBe(SA_GFS_ID);
      expect(record.source_url).toBeTruthy();
      expect(record.source_dataset).toBe(SA_GFS_DATASET);
      expect(record.jurisdiction_level).toBe('state');
      expect(record.jurisdiction).toBe('SA');
      expect(record.location?.state).toBe('SA');
      expect(record.location?.lga_name).toBeUndefined();
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.sa_unit).toBe(SA_GFS_UNIT);
      expect(record.sa_year_basis).toMatch(/actual/);
      expect(record.verified).toBe(true);
      expect(isAdditiveMeasure(record)).toBe(false);
      expect(isNonAdditiveMeasure(record)).toBe(true);
    }
  });

  it('preserves negative expenses as magnitudes with an explicit sign', () => {
    const negative = parsed.records.find(
      (record) => record.natural_key?.includes('') && record.sa_printed_sign === 'negative',
    );
    expect(negative).toBeTruthy();
    expect(negative?.amount_cents).toBe(5_000_000 * SA_GFS_UNIT_TO_CENTS);
    expect(negative?.amount_cents).toBeGreaterThanOrEqual(0);
  });

  it('never emits the printed TOTAL row or the GPC 3450 memorandum row', () => {
    expect(parsed.records.some((record) => record.sa_gpc_code === '3450')).toBe(false);
    expect(parsed.records.some((record) => record.sa_gpc_description === 'TOTAL')).toBe(false);
    expect(parsed.skipped.some((skip) => /3450/.test(skip.reason))).toBe(true);
    for (const table of parsed.tables) {
      expect(table.difference).toBeLessThanOrEqual(1);
      expect(table.excluded_memorandum_total).toBe(6_000);
    }
  });

  it('converts $000 to cents and detects the unit', () => {
    expect(saThousandsToCents(1)).toBe(100_000);
    expect(saThousandsToCents(0.5)).toBe(50_000);
    expect(saThousandsToCents(17_062_490)).toBe(1_706_249_000_000);
    expect(detectSaGfsUnit(17_062_490)).toBe('AUD_thousands');
    expect(detectSaGfsUnit(17_062_490_000)).toBe('AUD');
    expect(() => detectSaGfsUnit(17_062)).toThrow(/does not look like/);
  });

  it('uses stable natural keys and rejects a missing year', () => {
    const again = buildSaGfsRecords(buildSyntheticWorkbook());
    expect(again.records.map((record) => record.natural_key)).toEqual(
      parsed.records.map((record) => record.natural_key),
    );
    expect(
      saGfsNaturalKey({ fiscal_year: '2015-16', gpc_code: '0411', economic_type_code: '1213' }),
    ).toBe(
      saGfsNaturalKey({ fiscal_year: '2015-16', gpc_code: '0411', economic_type_code: '1213' }),
    );
    const missing = buildSyntheticWorkbook();
    missing.removeWorksheet('2013-14');
    expect(() => parseSaGfsWorkbook(missing)).toThrow(/missing sheet 2013-14/);
  });
});

describe('SA GFS connector and DB ingestion', () => {
  let tempDir: string;
  let workbookPath: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'ausspend-sa-'));
    workbookPath = path.join(tempDir, 'sa-gfs.xlsx');
    await buildSyntheticWorkbook().xlsx.writeFile(workbookPath);
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('fetches and transforms the workbook without a network call', async () => {
    const connector = createSaGfsConnector({ workbookPath, archiveRoot: tempDir });
    const raw = await connector.fetch();
    const records = connector.transform(raw);
    expect(records.length).toBeGreaterThanOrEqual(SA_GFS_MIN_ROWS);
    expect(records.every((record) => record.function_code)).toBe(true);
    expect(connector.metadata.errors).toEqual([]);
    expect(connector.metadata.warnings.join(' ')).toMatch(/unit=AUD_thousands/);
  });

  it('runs twice without duplicating SA rows and preserves an unrelated source', async () => {
    const other: SpendingRecord = {
      amount_cents: 1_000,
      measure_type: 'actual',
      fiscal_year: '2015-16',
      source_id: 'unrelated-source',
      source_url: 'https://example.gov.au/unrelated',
      verified: true,
      natural_key: 'unrelated-source:sa',
      description: 'Unrelated fixture row',
    };
    await MeasureModel.create(other);

    const connector = createSaGfsConnector({ workbookPath, archiveRoot: tempDir });
    await runIngestion({ connectors: [connector] });
    const afterFirst = await MeasureModel.countDocuments({ source_id: SA_GFS_ID });
    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: SA_GFS_ID })).toBe(afterFirst);
    expect(afterFirst).toBeGreaterThanOrEqual(SA_GFS_MIN_ROWS);
    expect(
      await MeasureModel.countDocuments({
        source_id: SA_GFS_ID,
        $or: [{ aggregation_role: { $ne: 'agency_detail' } }, { measure_type: { $ne: 'actual' } }],
      }),
    ).toBe(0);
    expect(await MeasureModel.countDocuments({ source_id: 'unrelated-source' })).toBe(1);
    const source = await DataSourceModel.findOne({ source_id: SA_GFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(afterFirst);
    expect(source?.fetch_strategy).toBe('direct');
  });

  it('exposes rows by source and never creates a total', async () => {
    const app = createApp({ pingDb: async () => 'connected' });
    const explicit = await request(app).get(`/api/spending?source_id=${SA_GFS_ID}&limit=20`);
    expect(explicit.status).toBe(200);
    expect(explicit.body.summary.total_cents).toBeNull();
    expect(
      explicit.body.data.every((row: { source_id: string }) => row.source_id === SA_GFS_ID),
    ).toBe(true);
  });
});

describe('SA GFS real archive', () => {
  it.skipIf(!existsSync(REAL_ARCHIVE))(
    'matches the documented SHA and reconciles every year to its printed TOTAL',
    async () => {
      const { createHash } = await import('node:crypto');
      const { readFile } = await import('node:fs/promises');
      const bytes = await readFile(REAL_ARCHIVE);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(SA_GFS_SHA256);
      const workbook = await readSaGfsWorkbook(REAL_ARCHIVE);
      const parsed = buildSaGfsRecords(workbook);
      expect(parsed.tables.map((table) => table.fiscal_year)).toEqual([...SA_GFS_FISCAL_YEARS]);
      expect(parsed.records.length).toBeGreaterThanOrEqual(SA_GFS_MIN_ROWS);
      expect(parsed.records.every((record) => SA_COFOG_NAMES[record.function_code ?? ''])).toBe(
        true,
      );
      expect(parsed.unit).toBe('AUD_thousands');
      const total2015 = parsed.tables.find((table) => table.fiscal_year === '2015-16');
      expect(total2015?.published_total).toBeCloseTo(17_062_490, 0);
      for (const table of parsed.tables) {
        expect(table.difference).toBeLessThanOrEqual(1);
      }
    },
  );
});
