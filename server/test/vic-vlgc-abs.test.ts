import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BENDIGO_ABS_COUNCIL_NAME,
  BENDIGO_ABS_GPFS,
  VLGGC_ABS_ATTRIBUTION,
  VLGGC_ABS_CONDITIONS_OF_USE,
  VLGGC_ABS_ID,
  VLGGC_ABS_LICENSE,
  VLGGC_ABS_UNIT,
  VLGGC_ABS_UNIT_TO_CENTS,
  assertVlgcAbsPremise,
  createVlgcAbsConnector,
  parseVlgcAbs1Workbook,
  parseVlgcAbs23Workbook,
  readVlgcAbsWorkbook,
  transformVlgcAbsRaw,
  vlgcAbsAmountToCents,
  vlgcAbsNaturalKey,
  type VlgcAbsSourceMeta,
} from '../src/connectors/vic-vlgc-abs.js';

const COUNCIL_LABELS = [
  'Alpine (S)',
  'Ararat (RC)',
  'Ballarat (C)',
  'Banyule (C)',
  'Bass Coast (S)',
  'Baw Baw (S)',
  'Bayside (C)',
  'Benalla (RC)',
  'Boroondara (C)',
  'Brimbank (C)',
  'Buloke (S)',
  'Campaspe (S)',
  'Cardinia (S)',
  'Casey (C)',
  'Central Goldfields (S)',
  'Colac Otway (S)',
  'Corangamite (S)',
  'Darebin (C)',
  'East Gippsland (S)',
  'Frankston (C)',
  'Gannawarra (S)',
  'Glen Eira (C)',
  'Glenelg (S)',
  'Golden Plains (S)',
  'Greater Bendigo (C)',
  'Greater Dandenong (C)',
  'Greater Geelong (C)',
  'Greater Shepparton (C)',
  'Hepburn (S)',
  'Hindmarsh (S)',
  'Hobsons Bay (C)',
  'Horsham (RC)',
  'Hume (C)',
  'Indigo (S)',
  'Kingston (C)',
  'Knox (C)',
  'Latrobe (C)',
  'Loddon (S)',
  'Macedon Ranges (S)',
  'Manningham (C)',
  'Mansfield (S)',
  'Maribyrnong (C)',
  'Maroondah (C)',
  'Melbourne (C)',
  'Melton (C)',
  'Merri-bek (C)',
  'Mildura (RC)',
  'Mitchell (S)',
  'Moira (S)',
  'Monash (C)',
  'Moonee Valley (C)',
  'Moorabool (S)',
  'Mornington Peninsula (S)',
  'Mount Alexander (S)',
  'Moyne (S)',
  'Murrindindi (S)',
  'Nillumbik (S)',
  'Northern Grampians (S)',
  'Port Phillip (C)',
  'Pyrenees (S)',
  'Queenscliffe (B)',
  'South Gippsland (S)',
  'Southern Grampians (S)',
  'Stonnington (C)',
  'Strathbogie (S)',
  'Surf Coast (S)',
  'Swan Hill (RC)',
  'Towong (S)',
  'Wangaratta (RC)',
  'Warrnambool (C)',
  'Wellington (S)',
  'West Wimmera (S)',
  'Whitehorse (C)',
  'Whittlesea (C)',
  'Wodonga (C)',
  'Wyndham (C)',
  'Yarra (C)',
  'Yarra Ranges (S)',
  'Yarriambiack (S)',
];

const ABS1_FUNCTION_NAMES = [
  'Governance',
  'Family & Community Services',
  'Aged & Disabled Services',
  'Recreation & Culture',
  'Waste Management',
  'Traffic & Street Management',
  'Environment',
  'Business & Economic Services',
  'Local Roads & Bridges',
  'Other',
];
const ABS1_FUNCTION_CODES = [
  '02199',
  '02299',
  '02399',
  '02499',
  '02599',
  '02699',
  '02799',
  '02899',
  '02999',
  '02989',
];
const ASSET_CLASSES = [
  'Land',
  'Buildings',
  'Construction (excl buildings)',
  'Office Equipment',
  'Transport Equipment',
  'Other',
  'Total Capital Outlays',
];

let dir = '';

function meta(workbook: 'ABS1' | 'ABS2-3'): VlgcAbsSourceMeta {
  const abs1 = workbook === 'ABS1';
  return {
    landing_url: 'https://example.test/vlgc',
    resource_url: abs1 ? 'https://example.test/abs1.xlsx' : 'https://example.test/abs23.xlsx',
    retrieval_url: abs1
      ? 'https://example.test/wayback/abs1.xlsx'
      : 'https://example.test/wayback/abs23.xlsx',
    source_url: 'https://example.test/vlgc',
    source_sha256: abs1 ? 'abs1sha' : 'abs23sha',
    source_date: '2026-08-18',
    workbook,
  };
}

function setCell(
  sheet: ExcelJS.Worksheet,
  row: number,
  column: number,
  value: string | number,
): void {
  sheet.getRow(row).getCell(column).value = value;
}

async function buildAbs1(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const totalOutlays = workbook.addWorksheet('Total Outlays');
  const oTotal = workbook.addWorksheet('O-Total');

  for (let index = 0; index < ABS1_FUNCTION_NAMES.length; index += 1) {
    setCell(totalOutlays, 6, 2 + index, ABS1_FUNCTION_NAMES[index]!);
    setCell(totalOutlays, 5, 2 + index, ABS1_FUNCTION_CODES[index]!);
  }
  setCell(totalOutlays, 6, 12, 'Total Outlays');
  for (let index = 0; index < ASSET_CLASSES.length; index += 1) {
    setCell(oTotal, 7, 2 + index, ASSET_CLASSES[index]!);
    setCell(oTotal, 8, 2 + index, `(${index + 1})`);
  }

  for (let index = 0; index < COUNCIL_LABELS.length; index += 1) {
    const label = COUNCIL_LABELS[index]!;
    const row = 10 + index;
    const bendigo = label === 'Greater Bendigo (C)';
    setCell(totalOutlays, row, 1, label);
    setCell(oTotal, row, 1, label);
    for (let column = 2; column <= 11; column += 1) setCell(totalOutlays, row, column, 1);
    setCell(totalOutlays, row, 12, bendigo ? BENDIGO_ABS_GPFS.capital_outlays_dollars : 10);
    for (let column = 2; column <= 7; column += 1) setCell(oTotal, row, column, 1);
    setCell(oTotal, row, 8, bendigo ? BENDIGO_ABS_GPFS.capital_outlays_dollars : 10);
  }

  // Source-provided cross-council Totals rows: must never become records.
  for (let column = 2; column <= 12; column += 1) setCell(totalOutlays, 90, column, 999999);
  for (let column = 2; column <= 8; column += 1) setCell(oTotal, 90, column, 999998);
  setCell(totalOutlays, 90, 1, 'Totals');
  setCell(oTotal, 90, 1, 'Totals');
  await workbook.xlsx.writeFile(filePath);
}

async function buildAbs23(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const balance = workbook.addWorksheet('Balance Sheets');
  const sources = workbook.addWorksheet('Sources & Applications');

  const balanceColumns: Array<[number, string, string]> = [
    [2, '31101', 'Currency'],
    [33, '32300', 'Total Assets'],
    [53, '32800', 'Total Liabilities'],
    [56, '32600', 'Total Equity'],
    [58, '33000', 'Rates'],
    [106, '35110', 'Rates and Charges'],
    [148, '35899', 'Comprehensive Result'],
  ];
  for (const [column, code, label] of balanceColumns) {
    setCell(balance, 5, column, code);
    setCell(balance, 7, column, label);
  }
  for (let block = 0; block < 7; block += 1) {
    const codes = ['03000', '03050', '03100', '03150', '03250', '03299'];
    const names = [
      'Bank',
      'NBFIs',
      'Victorian Treasury',
      'Other Councils',
      'Other Sources',
      'Total',
    ];
    for (let offset = 0; offset < 6; offset += 1) {
      setCell(sources, 6, 2 + block * 6 + offset, codes[offset]!);
      setCell(sources, 7, 2 + block * 6 + offset, names[offset]!);
    }
  }

  for (let index = 0; index < COUNCIL_LABELS.length; index += 1) {
    const label = COUNCIL_LABELS[index]!;
    const row = 10 + index;
    const bendigo = label === 'Greater Bendigo (C)';
    setCell(balance, row, 1, label);
    setCell(sources, row, 1, label);
    setCell(balance, row, 2, 1);
    setCell(balance, row, 33, bendigo ? BENDIGO_ABS_GPFS.total_assets_dollars : 1_000_000);
    setCell(balance, row, 53, bendigo ? BENDIGO_ABS_GPFS.total_liabilities_dollars : 100_000);
    setCell(balance, row, 56, bendigo ? BENDIGO_ABS_GPFS.total_equity_dollars : 900_000);
    setCell(balance, row, 58, 5000);
    setCell(balance, row, 106, 7000);
    setCell(balance, row, 148, 1000);
    for (let block = 0; block < 7; block += 1) {
      const start = 2 + block * 6;
      setCell(sources, row, start, 1);
      setCell(sources, row, start + 5, 1);
    }
  }

  for (let column = 2; column <= 148; column += 1) setCell(balance, 90, column, 999999);
  for (let column = 2; column <= 43; column += 1) setCell(sources, 90, column, 999998);
  setCell(balance, 90, 1, 'Totals');
  setCell(sources, 90, 1, 'Totals');
  await workbook.xlsx.writeFile(filePath);
}

async function parseBoth(): Promise<ReturnType<typeof transformVlgcAbsRaw>> {
  const abs1Path = path.join(dir, 'abs1.xlsx');
  const abs23Path = path.join(dir, 'abs23.xlsx');
  const abs1 = await readVlgcAbsWorkbook(abs1Path);
  const abs23 = await readVlgcAbsWorkbook(abs23Path);
  const parsed1 = parseVlgcAbs1Workbook(abs1, meta('ABS1'));
  const parsed23 = parseVlgcAbs23Workbook(abs23, meta('ABS2-3'));
  return transformVlgcAbsRaw([...parsed1.raw, ...parsed23.raw]);
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'ausspend-vlgc-abs-test-'));
  await buildAbs1(path.join(dir, 'abs1.xlsx'));
  await buildAbs23(path.join(dir, 'abs23.xlsx'));
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('VLGGC ABS units, licence and connector metadata', () => {
  it('converts whole AUD to integer cents and keeps the printed sign', () => {
    expect(VLGGC_ABS_UNIT_TO_CENTS).toBe(100);
    expect(vlgcAbsAmountToCents(BENDIGO_ABS_GPFS.capital_outlays_dollars)).toEqual({
      cents: BENDIGO_ABS_GPFS.capital_outlays_cents,
      printed_sign: 'positive',
    });
    expect(vlgcAbsAmountToCents(-2668000)).toEqual({
      cents: 266_800_000,
      printed_sign: 'negative',
    });
    expect(vlgcAbsAmountToCents('n/a')).toBeNull();
    expect(VLGGC_ABS_UNIT).toBe('AUD');
  });

  it('records VLGGC attribution/permission verbatim, never as CC BY', () => {
    expect(VLGGC_ABS_LICENSE).toContain('NOT CC BY');
    expect(VLGGC_ABS_LICENSE).toContain(VLGGC_ABS_ATTRIBUTION);
    expect(VLGGC_ABS_CONDITIONS_OF_USE).toBe(
      'Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission data collection.',
    );
    const connector = createVlgcAbsConnector();
    expect(connector.id).toBe(VLGGC_ABS_ID);
    expect(connector.jurisdiction_level).toBe('local');
    expect(connector.license).toBe(VLGGC_ABS_LICENSE);
    expect(connector.notes).toContain('NOT a CC licence');
    expect(connector.notes).toContain(VLGGC_ABS_CONDITIONS_OF_USE);
  });
});

describe('VLGGC ABS parsing and suppression', () => {
  it('parses 79 councils, suppresses every Totals row and emits the four statements', async () => {
    const transformed = await parseBoth();
    assertVlgcAbsPremise(transformed.records);
    expect(transformed.records.length).toBeGreaterThan(1000);
    const councils = new Set(transformed.records.map((record) => record.delivery_entity));
    expect(councils.size).toBe(79);
    expect([...councils].filter((name) => /^totals?$/i.test(String(name)))).toEqual([]);
    expect(transformed.records.every((record) => record.source_id === VLGGC_ABS_ID)).toBe(true);
    expect(transformed.records.every((record) => record.verified === false)).toBe(true);
    expect(transformed.records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
    expect(transformed.records.every((record) => record.jurisdiction === 'VIC')).toBe(true);
    expect(
      transformed.records.every(
        (record) => record.data_quality_flag === 'provisional/local_government',
      ),
    ).toBe(true);
    expect(transformed.records.every((record) => record.aggregation_role === 'agency_detail')).toBe(
      true,
    );
    expect(new Set(transformed.records.map((record) => record.statement))).toEqual(
      new Set(['capital', 'balance', 'cash_flow', 'income']),
    );
  });

  it('suppresses one Totals row from each of the four parsed sheets', async () => {
    const abs1 = await readVlgcAbsWorkbook(path.join(dir, 'abs1.xlsx'));
    const abs23 = await readVlgcAbsWorkbook(path.join(dir, 'abs23.xlsx'));
    const parsed1 = parseVlgcAbs1Workbook(abs1, meta('ABS1'));
    const parsed23 = parseVlgcAbs23Workbook(abs23, meta('ABS2-3'));
    expect(parsed1.summary.totalsSuppressed).toBe(2);
    expect(parsed23.summary.totalsSuppressed).toBe(2);
    expect(parsed1.skipped.every((skip) => skip.row === 90)).toBe(true);
    expect(parsed23.skipped.every((skip) => skip.row === 90)).toBe(true);
  });

  it('keeps ABS1 functions and asset classes as separate non-additive cuts', async () => {
    const transformed = await parseBoth();
    const functions = transformed.records.filter(
      (record) => record.vlgc_abs_measure === 'capital_outlays_by_function',
    );
    const assetClasses = transformed.records.filter(
      (record) => record.vlgc_abs_measure === 'asset_class_total',
    );
    expect(functions.length).toBeGreaterThan(0);
    expect(assetClasses.length).toBeGreaterThan(0);
    expect(assetClasses.every((record) => record.asset_class !== undefined)).toBe(true);
    expect(new Set(assetClasses.map((record) => record.asset_class)).size).toBe(7);
    // No record is the sum of another cut; functions never carry an asset class.
    expect(functions.every((record) => record.asset_class === undefined)).toBe(true);
  });
});

describe('VLGGC ABS Bendigo reconciliation and capital bridge', () => {
  it('reconciles Bendigo assets/liabilities/equity exactly and documents the capital bridge', async () => {
    const transformed = await parseBoth();
    const bendigo = transformed.records.filter(
      (record) => record.delivery_entity === BENDIGO_ABS_COUNCIL_NAME,
    );
    const assets = bendigo.find((record) => record.vlgc_abs_line_code === '32300');
    const liabilities = bendigo.find((record) => record.vlgc_abs_line_code === '32800');
    const equity = bendigo.find((record) => record.vlgc_abs_line_code === '32600');
    const capital = bendigo.find((record) => record.vlgc_abs_measure === 'total_capital_outlays');
    expect(assets?.amount_cents).toBe(259_560_300_000);
    expect(liabilities?.amount_cents).toBe(12_359_700_000);
    expect(equity?.amount_cents).toBe(247_200_600_000);
    expect(assets?.reconciliation_status).toBe('reconciled_to_gpfs');
    expect(liabilities?.reconciliation_status).toBe('reconciled_to_gpfs');
    expect(equity?.reconciliation_status).toBe('reconciled_to_gpfs');
    expect(capital?.amount_cents).toBe(5_622_135_320);
    expect(capital?.reconciliation_status).toBe('bridged_to_gpfs_cash_flow');
    const bridge = capital!.amount_cents - BENDIGO_ABS_GPFS.gpfs_cash_flow_capital_payments_cents;
    expect(bridge).toBe(47_335_320);
    expect(capital!.notes).toContain('473,353.20');
    expect(capital!.notes).toContain('never forced');
    // The two figures are not equal and the row is not marked exactly reconciled.
    expect(capital!.amount_cents).not.toBe(BENDIGO_ABS_GPFS.gpfs_cash_flow_capital_payments_cents);
  });
});

describe('VLGGC ABS idempotency, natural keys and premise gate', () => {
  it('is idempotent and uses stable natural keys', async () => {
    const abs1 = await readVlgcAbsWorkbook(path.join(dir, 'abs1.xlsx'));
    const abs23 = await readVlgcAbsWorkbook(path.join(dir, 'abs23.xlsx'));
    const raw = [
      ...parseVlgcAbs1Workbook(abs1, meta('ABS1')).raw,
      ...parseVlgcAbs23Workbook(abs23, meta('ABS2-3')).raw,
    ];
    const first = transformVlgcAbsRaw(raw);
    const second = transformVlgcAbsRaw(raw);
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.duplicates).toBe(0);
    expect(new Set(first.records.map((record) => record.natural_key)).size).toBe(
      first.records.length,
    );
    expect(vlgcAbsNaturalKey(['2024-25', 'ABS1', 'Alpine Shire Council', 'capital', 'total'])).toBe(
      vlgcAbsNaturalKey(['2024-25', 'ABS1', 'Alpine Shire Council', 'capital', 'total']),
    );
    expect(
      vlgcAbsNaturalKey(['2024-25', 'ABS1', 'Alpine Shire Council', 'capital', 'total']),
    ).not.toBe(
      vlgcAbsNaturalKey(['2024-25', 'ABS2-3', 'Alpine Shire Council', 'balance', 'assets']),
    );
  });

  it('fails the premise gate when a council is missing or Bendigo does not reconcile', async () => {
    const transformed = await parseBoth();
    const missing = transformed.records.filter(
      (record) => record.delivery_entity !== 'Alpine Shire Council',
    );
    expect(() => assertVlgcAbsPremise(missing)).toThrow(/premise falsified/i);

    const wrong = transformed.records.map((record) =>
      record.delivery_entity === BENDIGO_ABS_COUNCIL_NAME && record.vlgc_abs_line_code === '32300'
        ? { ...record, amount_cents: record.amount_cents + 1 }
        : record,
    );
    expect(() => assertVlgcAbsPremise(wrong)).toThrow(/premise falsified/i);
  });

  it('never emits a COFOG function code and never mixes sources', async () => {
    const transformed = await parseBoth();
    expect(transformed.records.every((record) => record.function_code === undefined)).toBe(true);
    expect(
      transformed.records.every(
        (record) =>
          record.source_id === VLGGC_ABS_ID &&
          !String(record.notes ?? '').includes('vic-vlgc-vgc1 row'),
      ),
    ).toBe(true);
    expect(
      transformed.records.every((record) => record.statement_section !== 'cross_council_total'),
    ).toBe(true);
  });
});
