import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BENDIGO_COUNCIL_NAME,
  BENDIGO_GPFS,
  VGC1_ATTRIBUTION,
  VGC1_CONDITIONS_OF_USE,
  VGC1_ID,
  VGC1_LICENSE,
  VGC1_NATURES,
  VGC1_UNIT,
  VGC1_UNIT_TO_CENTS,
  assertVgc1Premise,
  councilNameFromLabel,
  createVgc1Connector,
  parseVgc1Workbook,
  readVgc1Workbook,
  transformVgc1Raw,
  vgc1AmountToCents,
  vgc1NaturalKey,
  type Vgc1SourceMeta,
} from '../src/connectors/vic-vlgc-vgc1.js';

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

const FUNCTION_TABS = ['E-G', 'E-FCS', 'E-ADS', 'E-RC', 'E-WM', 'E-TSM', 'E-E', 'E-BES', 'E-LRB'];
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

let dir = '';

function meta(overrides: Partial<Vgc1SourceMeta> = {}): Vgc1SourceMeta {
  return {
    landing_url: 'https://example.test/vlgc',
    resource_url: 'https://example.test/vgc1.xlsx',
    retrieval_url: 'https://example.test/wayback/vgc1.xlsx',
    source_url: 'https://example.test/vlgc',
    source_sha256: 'abc123',
    source_date: '2026-08-18',
    ...overrides,
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

async function buildWorkbook(filePath: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  const totalExp = workbook.addWorksheet('Total Exp');
  const totalRev = workbook.addWorksheet('Total Rev');
  setCell(totalExp, 5, 2, '01199');
  setCell(totalRev, 5, 2, '01199');
  for (let index = 0; index < FUNCTION_NAMES.length; index += 1) {
    setCell(totalExp, 5, 2 + index, FUNCTION_CODES[index]!);
    setCell(totalRev, 5, 2 + index, FUNCTION_CODES[index]!);
    setCell(totalExp, 6, 2 + index, FUNCTION_NAMES[index]!);
    setCell(totalRev, 6, 2 + index, FUNCTION_NAMES[index]!);
  }
  setCell(totalExp, 6, 11, 'Total Expenditure (Functions only)');
  setCell(totalExp, 6, 12, 'Other (Main Roads & Other)');
  setCell(totalExp, 6, 13, 'Total Expenditure (Functions and Others)');
  setCell(totalRev, 6, 11, 'Total Revenue (Functions only)');
  setCell(totalRev, 6, 12, 'Other (Main Roads & Other)');
  setCell(totalRev, 6, 13, 'Other Revenue (Rates & Charges, VGC)');
  setCell(totalRev, 6, 14, 'Total Revenue (Functions and Others)');

  for (let index = 0; index < COUNCIL_LABELS.length; index += 1) {
    const label = COUNCIL_LABELS[index]!;
    const row = 10 + index;
    setCell(totalExp, row, 1, label);
    setCell(totalRev, row, 1, label);
    for (let fn = 0; fn < FUNCTION_NAMES.length; fn += 1) {
      setCell(totalExp, row, 2 + fn, 5);
      setCell(totalRev, row, 2 + fn, 5);
    }
    setCell(totalExp, row, 11, 45);
    setCell(totalExp, row, 12, 0);
    setCell(
      totalExp,
      row,
      13,
      label === 'Greater Bendigo (C)' ? BENDIGO_GPFS.expenses_dollars : 45,
    );
    setCell(totalRev, row, 11, 45);
    setCell(totalRev, row, 12, label === 'Moira (S)' ? -18767 : 0);
    setCell(totalRev, row, 13, 0);
    setCell(totalRev, row, 14, label === 'Greater Bendigo (C)' ? BENDIGO_GPFS.revenue_dollars : 45);
  }

  // Source-provided cross-council Totals row: must never become a record.
  for (let column = 2; column <= 13; column += 1) setCell(totalExp, 90, column, 999999);
  for (let column = 2; column <= 14; column += 1) setCell(totalRev, 90, column, 999998);
  setCell(totalExp, 91, 1, 'Source: Victorian Local Government Grants Commission');
  setCell(totalRev, 91, 1, 'Source: Victorian Local Government Grants Commission');

  for (const tab of FUNCTION_TABS) {
    const sheet = workbook.addWorksheet(tab);
    setCell(sheet, 5, 2, '01199');
    setCell(sheet, 6, 2, `${tab} Total`);
    for (let nature = 0; nature < VGC1_NATURES.length; nature += 1) {
      setCell(sheet, 7, 2 + nature, VGC1_NATURES[nature]!);
    }
    setCell(sheet, 7, 7, 'Total Exp Recurrent');
    for (let index = 0; index < COUNCIL_LABELS.length; index += 1) {
      const row = 10 + index;
      setCell(sheet, row, 1, COUNCIL_LABELS[index]!);
      for (let nature = 0; nature < VGC1_NATURES.length; nature += 1) {
        setCell(sheet, row, 2 + nature, 1);
      }
      setCell(sheet, row, 7, 5);
    }
    for (let column = 2; column <= 7; column += 1) setCell(sheet, 90, column, 999997);
  }

  await workbook.xlsx.writeFile(filePath);
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'ausspend-vgc1-test-'));
});

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('VGC1 units, council names and licence', () => {
  it('converts whole AUD to integer cents and keeps the printed sign', () => {
    expect(VGC1_UNIT_TO_CENTS).toBe(100);
    expect(vgc1AmountToCents(BENDIGO_GPFS.expenses_dollars)).toEqual({
      cents: BENDIGO_GPFS.expenses_cents,
      printed_sign: 'positive',
    });
    expect(vgc1AmountToCents(BENDIGO_GPFS.revenue_dollars)).toEqual({
      cents: BENDIGO_GPFS.revenue_cents,
      printed_sign: 'positive',
    });
    expect(vgc1AmountToCents(-18767)).toEqual({ cents: 1_876_700, printed_sign: 'negative' });
    expect(vgc1AmountToCents(0)).toEqual({ cents: 0, printed_sign: 'positive' });
    expect(vgc1AmountToCents('n/a')).toBeNull();
  });

  it('expands the 79 VGC labels to 79 unique official council names', () => {
    expect(councilNameFromLabel('Alpine (S)')).toBe('Alpine Shire Council');
    expect(councilNameFromLabel('Greater Bendigo (C)')).toBe(BENDIGO_COUNCIL_NAME);
    expect(councilNameFromLabel('Ararat (RC)')).toBe('Ararat Rural City Council');
    expect(councilNameFromLabel('Queenscliffe (B)')).toBe('Borough of Queenscliffe');
    const names = COUNCIL_LABELS.map((label) => councilNameFromLabel(label));
    expect(names.filter(Boolean)).toHaveLength(79);
    expect(new Set(names).size).toBe(79);
  });

  it('records VLGGC attribution/permission verbatim, never as CC BY', () => {
    expect(VGC1_LICENSE).toContain('NOT CC BY');
    expect(VGC1_LICENSE).toContain(VGC1_ATTRIBUTION);
    expect(VGC1_LICENSE).toContain('Victorian Local Government Grants Commission data collection');
    expect(VGC1_CONDITIONS_OF_USE).toBe(
      'Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission data collection.',
    );
    const connector = createVgc1Connector();
    expect(connector.id).toBe(VGC1_ID);
    expect(connector.jurisdiction_level).toBe('local');
    expect(connector.license).toBe(VGC1_LICENSE);
    expect(connector.notes).toContain('NOT a CC licence');
    expect(connector.notes).toContain(VGC1_CONDITIONS_OF_USE);
  });
});

describe('VGC1 workbook parsing', () => {
  it('parses 79 councils, suppresses every Totals row and emits the full nature grid', async () => {
    const filePath = path.join(dir, 'vgc1.xlsx');
    await buildWorkbook(filePath);
    const workbook = await readVgc1Workbook(filePath);
    const parsed = parseVgc1Workbook(workbook, meta());
    const transformed = transformVgc1Raw(parsed.raw);
    assertVgc1Premise(transformed.records);

    expect(parsed.summary.councilCount).toBe(79);
    expect(parsed.summary.totalsSuppressed).toBe(11); // 2 total sheets + 9 function tabs
    expect(parsed.skipped).toHaveLength(11);
    expect(parsed.skipped.every((skip) => skip.row === 90)).toBe(true);

    const councils = new Set(transformed.records.map((record) => record.delivery_entity));
    expect(councils.size).toBe(79);
    expect([...councils].filter((name) => /^totals?$/i.test(String(name)))).toEqual([]);
    // The source Totals values (999999/999998/999997 whole AUD) never appear.
    const totalsCents = new Set([99_999_900, 99_999_800, 99_999_700]);
    expect(transformed.records.some((record) => totalsCents.has(record.amount_cents))).toBe(false);

    const natures = transformed.records.filter(
      (record) => record.vlgc_measure === 'expense_function_nature',
    );
    expect(natures).toHaveLength(79 * 9 * 5);
    const perCouncil = new Map<string, number>();
    for (const row of natures) {
      perCouncil.set(row.delivery_entity!, (perCouncil.get(row.delivery_entity!) ?? 0) + 1);
    }
    expect([...perCouncil.values()].every((count) => count === 45)).toBe(true);
    expect(new Set(natures.map((row) => row.vlgc_nature)).size).toBe(5);
    expect(transformed.records.every((record) => record.aggregation_role === 'agency_detail')).toBe(
      true,
    );
    expect(
      transformed.records.every(
        (record) => record.data_quality_flag === 'provisional/local_government',
      ),
    ).toBe(true);
    expect(transformed.records.every((record) => record.statement === 'income')).toBe(true);
    expect(transformed.records.every((record) => record.verified === false)).toBe(true);
    expect(transformed.records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
    expect(transformed.records.every((record) => record.jurisdiction === 'VIC')).toBe(true);
  });

  it('reconciles City of Greater Bendigo to its audited GPFS at the printed $1,000 rounding', async () => {
    const filePath = path.join(dir, 'bendigo.xlsx');
    await buildWorkbook(filePath);
    const workbook = await readVgc1Workbook(filePath);
    const transformed = transformVgc1Raw(parseVgc1Workbook(workbook, meta()).raw);
    const bendigo = transformed.records.filter(
      (record) => record.delivery_entity === BENDIGO_COUNCIL_NAME,
    );
    const expenses = bendigo.find((record) => record.vlgc_measure === 'total_expenditure');
    const revenue = bendigo.find((record) => record.vlgc_measure === 'total_revenue');
    expect(expenses?.amount_cents).toBe(25_276_099_996);
    expect(revenue?.amount_cents).toBe(27_700_200_017);
    expect(expenses?.reconciliation_status).toBe('reconciled_to_gpfs');
    expect(revenue?.reconciliation_status).toBe('reconciled_to_gpfs');
    expect(
      bendigo
        .filter(
          (record) =>
            record.vlgc_measure !== 'total_expenditure' && record.vlgc_measure !== 'total_revenue',
        )
        .every((record) => record.reconciliation_status === 'questionnaire_unaudited'),
    ).toBe(true);
    // GPFS $'000 rounding: expenses -4 cents, revenue +17 cents.
    const gpfsExpensesCents = BENDIGO_GPFS.gpfs_expenses_thousand * 1000 * 100;
    const gpfsRevenueCents = BENDIGO_GPFS.gpfs_revenue_thousand * 1000 * 100;
    expect(expenses!.amount_cents - gpfsExpensesCents).toBe(-4);
    expect(revenue!.amount_cents - gpfsRevenueCents).toBe(17);
  });

  it('keeps negative printed amounts as magnitude plus a printed sign', async () => {
    const filePath = path.join(dir, 'negative.xlsx');
    await buildWorkbook(filePath);
    const workbook = await readVgc1Workbook(filePath);
    const transformed = transformVgc1Raw(parseVgc1Workbook(workbook, meta()).raw);
    const moira = transformed.records.find(
      (record) =>
        record.delivery_entity === 'Moira Shire Council' &&
        record.vlgc_measure === 'revenue_other' &&
        record.vlgc_line_code === '01930 & 01989',
    );
    expect(moira?.amount_cents).toBe(1_876_700);
    expect(moira?.vlgc_printed_sign).toBe('negative');
  });
});

describe('VGC1 idempotency, natural keys and premise gate', () => {
  it('is idempotent and uses stable natural keys', async () => {
    const filePath = path.join(dir, 'idempotent.xlsx');
    await buildWorkbook(filePath);
    const workbook = await readVgc1Workbook(filePath);
    const raw = parseVgc1Workbook(workbook, meta()).raw;
    const first = transformVgc1Raw(raw);
    const second = transformVgc1Raw(raw);
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.duplicates).toBe(0);
    expect(new Set(first.records.map((record) => record.natural_key)).size).toBe(
      first.records.length,
    );
    expect(vgc1NaturalKey(['2024-25', 'Alpine Shire Council', 'expense', 'total'])).toBe(
      vgc1NaturalKey(['2024-25', 'Alpine Shire Council', 'expense', 'total']),
    );
    expect(vgc1NaturalKey(['2024-25', 'Alpine Shire Council', 'expense', 'total'])).not.toBe(
      vgc1NaturalKey(['2024-25', 'Alpine Shire Council', 'revenue', 'total']),
    );
  });

  it('fails the premise gate when a council is missing or Bendigo does not reconcile', async () => {
    const filePath = path.join(dir, 'premise.xlsx');
    await buildWorkbook(filePath);
    const workbook = await readVgc1Workbook(filePath);
    const records = transformVgc1Raw(parseVgc1Workbook(workbook, meta()).raw).records;
    const missing = records.filter((record) => record.delivery_entity !== 'Alpine Shire Council');
    expect(() => assertVgc1Premise(missing)).toThrow(/premise falsified/i);

    const wrong = records.map((record) =>
      record.delivery_entity === BENDIGO_COUNCIL_NAME && record.vlgc_measure === 'total_expenditure'
        ? { ...record, amount_cents: record.amount_cents + 1 }
        : record,
    );
    expect(() => assertVgc1Premise(wrong)).toThrow(/premise falsified/i);
  });

  it('never emits a COFOG function code for VLGGC functions', async () => {
    const filePath = path.join(dir, 'cofog.xlsx');
    await buildWorkbook(filePath);
    const workbook = await readVgc1Workbook(filePath);
    const records = transformVgc1Raw(parseVgc1Workbook(workbook, meta()).raw).records;
    expect(records.every((record) => record.function_code === undefined)).toBe(true);
    expect(records.some((record) => record.vlgc_function)).toBe(true);
    expect(VGC1_UNIT).toBe('AUD');
  });
});
