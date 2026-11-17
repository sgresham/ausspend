import path from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  VIC_HISTORY_DEFERRED_YEARS,
  VIC_HISTORY_FISCAL_YEARS,
  VIC_HISTORY_YEARS,
  assertVgc1HistoryPremise,
  assertVlgcAbsHistoryPremise,
  findVicHistoryYear,
  parseVgc1HistoryWorkbook,
} from '../src/connectors/vic-vlgc-history.js';
import {
  VGC1_ATTRIBUTION,
  VGC1_CONDITIONS_OF_USE,
  VGC1_ID,
  VGC1_LICENSE,
  VGC1_NATURES,
  readVgc1Workbook,
  transformVgc1Raw,
  type Vgc1Raw,
  type Vgc1SourceMeta,
} from '../src/connectors/vic-vlgc-vgc1.js';
import {
  VLGGC_ABS_ATTRIBUTION,
  VLGGC_ABS_CONDITIONS_OF_USE,
  VLGGC_ABS_ID,
  VLGGC_ABS_LICENSE,
  transformVlgcAbsRaw,
  type VlgcAbsRaw,
} from '../src/connectors/vic-vlgc-abs.js';

const LABELS = Array.from(
  { length: 79 },
  (_, index) => `Council${String(index + 1).padStart(2, '0')} (S)`,
);
const FUNCTION_NAMES = [
  'Governance',
  'Family & Community Services',
  'Aged & Disabled Services',
  'Recreation & Culture',
  'Waste Management',
  'Traffic & Street Management',
  'Environment',
  'Business & Economic Services',
  'Local Roads & Bridges',
];
const FUNCTION_CODES = [
  '01199',
  '01299',
  '01399',
  '01499',
  '01599',
  '01699',
  '01799',
  '01899',
  '01996',
];
const FUNCTION_TABS = ['E-G', 'E-FCS', 'E-ADS', 'E-RC', 'E-WM', 'E-TSM', 'E-E', 'E-BES', 'E-LRB'];

function setCell(
  sheet: ExcelJS.Worksheet,
  row: number,
  column: number,
  value: string | number,
): void {
  sheet.getRow(row).getCell(column).value = value;
}

async function buildHistoricalWorkbook(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const totalExp = workbook.addWorksheet('Total Exp');
  const totalRev = workbook.addWorksheet('Total Rev');
  for (let index = 0; index < FUNCTION_NAMES.length; index += 1) {
    setCell(totalExp, 5, 2 + index, FUNCTION_CODES[index]!);
    setCell(totalRev, 5, 2 + index, FUNCTION_CODES[index]!);
    setCell(totalExp, 6, 2 + index, FUNCTION_NAMES[index]!);
    setCell(totalRev, 6, 2 + index, FUNCTION_NAMES[index]!);
  }
  for (let index = 0; index < LABELS.length; index += 1) {
    const row = 10 + index;
    setCell(totalExp, row, 1, LABELS[index]!);
    setCell(totalRev, row, 1, LABELS[index]!);
    for (let fn = 0; fn < FUNCTION_NAMES.length; fn += 1) {
      setCell(totalExp, row, 2 + fn, 5);
      setCell(totalRev, row, 2 + fn, 5);
    }
    setCell(totalExp, row, 11, 45);
    setCell(totalExp, row, 12, 0);
    setCell(totalExp, row, 13, 45);
    setCell(totalRev, row, 11, 45);
    setCell(totalRev, row, 12, 0);
    setCell(totalRev, row, 13, 0);
    setCell(totalRev, row, 14, 45);
  }
  // Source Totals row: must never become a record.
  for (let column = 2; column <= 13; column += 1) setCell(totalExp, 90, column, 999999);
  for (let column = 2; column <= 14; column += 1) setCell(totalRev, 90, column, 999998);

  for (let fn = 0; fn < FUNCTION_TABS.length; fn += 1) {
    const sheet = workbook.addWorksheet(FUNCTION_TABS[fn]!);
    setCell(sheet, 5, 2, FUNCTION_CODES[fn]!);
    setCell(sheet, 6, 2, `${FUNCTION_NAMES[fn]} Total`);
    for (let nature = 0; nature < VGC1_NATURES.length; nature += 1) {
      setCell(sheet, 7, 2 + nature, VGC1_NATURES[nature]!);
    }
    setCell(sheet, 7, 7, 'Total Exp Recurrent');
    for (let index = 0; index < LABELS.length; index += 1) {
      const row = 10 + index;
      setCell(sheet, row, 1, LABELS[index]!);
      for (let nature = 0; nature < VGC1_NATURES.length; nature += 1) {
        setCell(sheet, row, 2 + nature, 1);
      }
      setCell(sheet, row, 7, 5);
    }
    for (let column = 2; column <= 7; column += 1) setCell(sheet, 90, column, 999997);
  }
  await workbook.xlsx.writeFile(filePath);
}

function meta(fiscalYear: string): Vgc1SourceMeta {
  return {
    landing_url: 'https://example.test/vlgc',
    resource_url: 'https://example.test/vgc1.xlsx',
    retrieval_url: 'https://example.test/wayback/vgc1.xlsx',
    source_url: 'https://example.test/vlgc',
    source_sha256: 'abc123',
    source_date: '2026-08-18',
    fiscal_year: fiscalYear,
  };
}

function vgc1Raw(fiscalYear: string, council = 'Council01 Shire Council'): Vgc1Raw {
  return {
    kind: 'expense',
    council_label: 'Council01 (S)',
    council_name: council,
    fiscal_year: fiscalYear,
    section: 'expense',
    line_type: 'total',
    function_name: null,
    function_code: null,
    nature: null,
    line_label: 'Total Expenditure (Functions and Others)',
    line_code: '01999',
    sheet: 'Total Exp',
    row: 10,
    column_index: 13,
    raw_value: 100,
    unit: 'AUD',
    source_url: 'https://example.test/vlgc',
    retrieval_url: 'https://example.test/wayback/vgc1.xlsx',
    source_sha256: 'abc123',
    source_date: '2026-08-18',
  };
}

function absRaw(fiscalYear: string, council = 'Council01 Shire Council'): VlgcAbsRaw {
  return {
    workbook: 'ABS1',
    council_label: 'Council01 (S)',
    council_name: council,
    fiscal_year: fiscalYear,
    statement: 'capital',
    statement_section: 'total_outlays',
    asset_class: null,
    line_label: 'Total Outlays',
    line_code: '02999',
    measure: 'total_capital_outlays',
    sheet: 'Total Outlays',
    row: 10,
    column_index: 12,
    raw_value: 100,
    unit: 'AUD',
    source_url: 'https://example.test/vlgc',
    retrieval_url: 'https://example.test/wayback/abs.xlsx',
    source_sha256: 'def456',
    source_date: '2026-08-18',
  };
}

describe('VLGGC historical source register and licence metadata', () => {
  it('covers exactly the five verified years and states the deferred years', () => {
    expect(VIC_HISTORY_FISCAL_YEARS).toEqual([
      '2019-20',
      '2020-21',
      '2021-22',
      '2022-23',
      '2023-24',
    ]);
    expect(VIC_HISTORY_DEFERRED_YEARS).toEqual(['2015-16', '2016-17', '2017-18', '2018-19']);
    for (const year of VIC_HISTORY_YEARS) {
      expect(year.vgc1.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(year.abs1.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(year.abs23.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(year.vgc1.bytes).toBeGreaterThan(1000);
    }
    expect(findVicHistoryYear('2023-24').bendigo_gpfs?.expenses_thousand).toBe(240_484);
  });

  it('records VLGGC attribution/permission, never CC BY', () => {
    expect(VGC1_LICENSE).toContain('NOT CC BY');
    expect(VGC1_LICENSE).toContain(VGC1_ATTRIBUTION);
    expect(VGC1_CONDITIONS_OF_USE).toBe(
      'Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission data collection.',
    );
    expect(VLGGC_ABS_LICENSE).toContain('NOT CC BY');
    expect(VLGGC_ABS_LICENSE).toContain(VLGGC_ABS_ATTRIBUTION);
    expect(VLGGC_ABS_CONDITIONS_OF_USE).toContain(
      'Victorian Local Government Grants Commission data collection',
    );
  });
});

describe('VGC1 historical parsing and Totals suppression', () => {
  it('parses 79 councils, suppresses every Totals row and maps the function×nature head block', async () => {
    const filePath = path.join('/tmp', `ausspend-vgc1-history-${Date.now()}.xlsx`);
    await buildHistoricalWorkbook(filePath);
    const workbook = await readVgc1Workbook(filePath);
    const parsed = parseVgc1HistoryWorkbook(workbook, meta('2019-20'));
    const transformed = transformVgc1Raw(parsed.raw);
    assertVgc1HistoryPremise(transformed.records, '2019-20');

    expect(parsed.summary.councilCount).toBe(79);
    expect(parsed.summary.totalsSuppressed).toBe(11);
    expect(parsed.summary.source_totals.expense_cents).toBe(99_999_900);
    expect(parsed.summary.source_totals.revenue_cents).toBe(99_999_800);

    const councils = new Set(transformed.records.map((record) => record.delivery_entity));
    expect(councils.size).toBe(79);
    expect([...councils].filter((name) => /^totals?$/i.test(String(name)))).toEqual([]);
    const totalsCents = new Set([99_999_900, 99_999_800, 99_999_700]);
    expect(transformed.records.some((record) => totalsCents.has(record.amount_cents))).toBe(false);

    const natures = transformed.records.filter(
      (record) => record.vlgc_measure === 'expense_function_nature',
    );
    expect(natures).toHaveLength(79 * 9 * 5);
    expect(transformed.records).toHaveLength(79 * 70);
    expect(transformed.records.every((record) => record.fiscal_year === '2019-20')).toBe(true);
    expect(transformed.records.every((record) => record.source_id === VGC1_ID)).toBe(true);
    expect(transformed.records.every((record) => record.aggregation_role === 'agency_detail')).toBe(
      true,
    );
    expect(transformed.records.every((record) => record.verified === false)).toBe(true);
    expect(
      transformed.records.every(
        (record) => record.data_quality_flag === 'provisional/local_government',
      ),
    ).toBe(true);
    expect(transformed.records.every((record) => record.function_code === undefined)).toBe(true);
  });

  it('is idempotent and gives different natural keys across fiscal years', () => {
    const first = transformVgc1Raw([vgc1Raw('2019-20')]);
    const second = transformVgc1Raw([vgc1Raw('2019-20')]);
    const nextYear = transformVgc1Raw([vgc1Raw('2020-21')]);
    expect(first.records[0]!.natural_key).toBe(second.records[0]!.natural_key);
    expect(first.records[0]!.natural_key).not.toBe(nextYear.records[0]!.natural_key);
    expect(first.duplicates).toBe(0);

    // A row carrying the wrong fiscal_year must never pass the year-scoped gate.
    expect(() => assertVgc1HistoryPremise(nextYear.records, '2019-20')).toThrow(
      /premise falsified/i,
    );

    // A documented reconciliation override survives the transform (used by the
    // FY2023-24 Bendigo GPFS gate).
    const override = transformVgc1Raw([
      { ...vgc1Raw('2023-24'), reconciliation_status: 'reconciled_to_gpfs' },
    ]);
    expect(override.records[0]!.reconciliation_status).toBe('reconciled_to_gpfs');
  });
});

describe('VLGGC ABS historical fiscal-year scoping', () => {
  it('keys by fiscal year and keeps rows non-additive', () => {
    const a = transformVlgcAbsRaw([absRaw('2019-20')]);
    const b = transformVlgcAbsRaw([absRaw('2020-21')]);
    expect(a.records).toHaveLength(1);
    expect(a.records[0]!.fiscal_year).toBe('2019-20');
    expect(a.records[0]!.source_id).toBe(VLGGC_ABS_ID);
    expect(a.records[0]!.aggregation_role).toBe('agency_detail');
    expect(a.records[0]!.natural_key).not.toBe(b.records[0]!.natural_key);
  });

  it('rejects a missing council or a Totals entity', () => {
    const records = transformVlgcAbsRaw([absRaw('2019-20')]).records;
    expect(() => assertVlgcAbsHistoryPremise(records, '2019-20')).toThrow(/premise falsified/i);
    const totals = transformVlgcAbsRaw([absRaw('2019-20', 'Totals')]).records;
    expect(() => assertVlgcAbsHistoryPremise(totals, '2019-20')).toThrow(/premise falsified/i);
  });
});
