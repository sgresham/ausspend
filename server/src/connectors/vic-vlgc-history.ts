import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { SpendingRecord } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';
import {
  VGC1_FUNCTIONS,
  VGC1_ATTRIBUTION,
  VGC1_CONDITIONS_OF_USE,
  VGC1_DISCLAIMER,
  VGC1_ID,
  VGC1_LANDING_URL,
  VGC1_LICENSE,
  VGC1_NATURES,
  councilNameFromLabel,
  readVgc1Workbook,
  transformVgc1Raw,
  vgc1AmountToCents,
  type Vgc1Raw,
  type Vgc1Skip,
  type Vgc1SourceMeta,
  type Vgc1WorkbookRows,
} from './vic-vlgc-vgc1.js';
import {
  ABS23_LAYOUT_CURRENT,
  ABS23_LAYOUT_LEGACY_2015_18,
  VLGGC_ABS_ATTRIBUTION,
  VLGGC_ABS_CONDITIONS_OF_USE,
  VLGGC_ABS_DISCLAIMER,
  VLGGC_ABS_ID,
  VLGGC_ABS_LANDING_URL,
  VLGGC_ABS_LICENSE,
  parseVlgcAbs1Workbook,
  parseVlgcAbs23Workbook,
  readVlgcAbsWorkbook,
  transformVlgcAbsRaw,
  type Abs23Layout,
  type VlgcAbsRaw,
  type VlgcAbsSkip,
  type VlgcAbsSourceMeta,
  type VlgcAbsWorkbookRows,
} from './vic-vlgc-abs.js';

/**
 * VLGGC VGC1/ABS1/ABS2-3 historical series, FY2019-20 to FY2023-24.
 *
 * This is NOT a new source family: every row keeps the same `source_id`
 * (`vic-vlgc-vgc1` or `vic-vlgc-abs`) and the same non-additive,
 * council-supplied questionnaire semantics as pilots A/B. The only difference is
 * the workbook generation: the 2019-20..2023-24 workbooks print the VGC1
 * function tabs as repeated sub-function blocks (the first block of each E-*
 * tab is the function total), while the 2024-25 workbook uses a single block.
 * The historical parser therefore reads the historical layout, not the
 * current one.
 *
 * Per-year provenance is explicit: a year-specific fiscal_year, workbook URL,
 * Wayback snapshot, SHA-256 and byte count. The natural key includes the fiscal
 * year, so the same council/line in two years never collides.
 *
 * LICENCE: VLGGC attribution + permission, NOT CC BY (verbatim Conditions of
 * Use). Derived rows only; no workbook is redistributed.
 */

export interface VicHistoryWorkbook {
  resource_url: string;
  snapshot_timestamp: string;
  sha256: string;
  bytes: number;
  filename: string;
}

export interface VicHistoryYear {
  fiscal_year: string;
  vgc1: VicHistoryWorkbook;
  abs1: VicHistoryWorkbook;
  abs23: VicHistoryWorkbook;
  /**
   * ABS2 balance-sheet layout generation. FY2015-16..FY2018-19 print 144
   * columns (no lease-liability line); FY2019-20+ print 148. Omitted means
   * `current`.
   */
  abs23_layout?: 'current' | 'legacy_2015_18';
  /**
   * Published audited Bendigo GPFS totals ($'000) where fetched, used as the
   * reconciliation gate for the historical layer.
   */
  bendigo_gpfs?: {
    expenses_thousand: number;
    revenue_thousand: number;
    source_url: string;
  };
}

const V = 'https://www.localgovernment.vic.gov.au/__data/assets/excel_doc';

export const VIC_HISTORY_YEARS: readonly VicHistoryYear[] = [
  {
    fiscal_year: '2015-16',
    abs23_layout: 'legacy_2015_18',
    vgc1: {
      resource_url: `${V}/0020/165440/2015-16-VGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx`,
      snapshot_timestamp: '20220309020324',
      sha256: 'e30382d5c0d056cc773f08fbb843454ab2a4e6e46ea55ea2703015d2fb75ea69',
      bytes: 825_660,
      filename: '2015-16-VGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx',
    },
    abs1: {
      resource_url: `${V}/0025/165436/2015-16-VGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx`,
      snapshot_timestamp: '20220309020400',
      sha256: 'debdb84b3e93116cbd7d008d0825ad76ed2234f0698f1886067a76a80aa5f812',
      bytes: 484_933,
      filename: '2015-16-VGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx',
    },
    abs23: {
      resource_url: `${V}/0026/165437/2015-16-VGC-Questionnaire-ABS2-3-Balance-Sheets-and-Other-Finances.xlsx`,
      snapshot_timestamp: '20220309020410',
      sha256: 'ac3bbe97cacdb7dcb0d4d107f94f93bf83ccb5f9bd2499ecc5cf213a0655c7fc',
      bytes: 141_538,
      filename: '2015-16-VGC-Questionnaire-ABS2-3-Balance-Sheets-and-Other-Finances.xlsx',
    },
  },
  {
    fiscal_year: '2016-17',
    abs23_layout: 'legacy_2015_18',
    vgc1: {
      resource_url: `${V}/0021/170580/2016-17-VGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx`,
      snapshot_timestamp: '20190312124827',
      sha256: '08d9f99e9d7243947b3e0ef576d538901839d893dc546dd2f09fd24fb6e91a27',
      bytes: 830_482,
      filename: '2016-17-VGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx',
    },
    abs1: {
      resource_url: `${V}/0024/170583/2016-17-VGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx`,
      snapshot_timestamp: '20190312124932',
      sha256: '7bc0e80c97e1ad4ba8bb66c547a2993f88a187976d0c4e5cf41f6a665602cb82',
      bytes: 478_883,
      filename: '2016-17-VGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx',
    },
    abs23: {
      resource_url: `${V}/0025/170584/2016-17-VGC-Questionnaire-ABS2-3-Balance-Sheets-and-Other.xlsx`,
      snapshot_timestamp: '20190312124950',
      sha256: '677bf810ec1da9e13fa8104fe1a35ca898210a61885c9b6bb49d04150d9dc896',
      bytes: 142_695,
      filename: '2016-17-VGC-Questionnaire-ABS2-3-Balance-Sheets-and-Other.xlsx',
    },
  },
  {
    fiscal_year: '2017-18',
    abs23_layout: 'legacy_2015_18',
    vgc1: {
      resource_url: `${V}/0025/417832/2017-18-VGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx`,
      snapshot_timestamp: '20200229134217',
      sha256: 'e977cbb573f9e212a17671a9fa085b89e3728c875b1675792179671ce0ff14af',
      bytes: 844_966,
      filename: '2017-18-VGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx',
    },
    abs1: {
      resource_url: `${V}/0028/417835/2017-18-VGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx`,
      snapshot_timestamp: '20200229134242',
      sha256: '84e35f02a38ccb2054ec309cfcf92fa50e2e731d7aad5a9d9d85427727bae8b8',
      bytes: 485_627,
      filename: '2017-18-VGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx',
    },
    abs23: {
      resource_url: `${V}/0024/417840/2017-18-VGC-Questionnaire-ABS2-Balance-Sheets-and-Other-Finances.xlsx`,
      snapshot_timestamp: '20200229134258',
      sha256: '62b97da8789bc8e872dbe1740b04bec9197c720c9ce16630b2aeeaf37c39c04d',
      bytes: 144_124,
      filename: '2017-18-VGC-Questionnaire-ABS2-Balance-Sheets-and-Other-Finances.xlsx',
    },
  },
  {
    fiscal_year: '2018-19',
    abs23_layout: 'legacy_2015_18',
    vgc1: {
      resource_url: `${V}/0033/464973/2018-19-VGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx`,
      snapshot_timestamp: '20210314151936',
      sha256: 'b209ecd1d56a6735200c13bce891ea386a192737884c7cd19208be18d27b737c',
      bytes: 847_695,
      filename: '2018-19-VGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx',
    },
    abs1: {
      resource_url: `${V}/0037/464968/2018-19-VGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx`,
      snapshot_timestamp: '20210314152012',
      sha256: 'c8e6ccfb8c26f03b5f6ca8b98ba1a27647b1a7fee46ffc9a74d846662143b66c',
      bytes: 482_725,
      filename: '2018-19-VGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx',
    },
    abs23: {
      resource_url: `${V}/0038/464969/2018-19-VGC-Questionnaire-ABS2-Balance-Sheets-and-Other-Finances.xlsx`,
      snapshot_timestamp: '20210314152032',
      sha256: '2f59ab636fb99f084ca429ef5a49f258406b72b1135ab344cdb7bcb69df4cdfa',
      bytes: 143_220,
      filename: '2018-19-VGC-Questionnaire-ABS2-Balance-Sheets-and-Other-Finances.xlsx',
    },
  },
  {
    fiscal_year: '2019-20',
    vgc1: {
      resource_url: `${V}/0030/168483/2019-20-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx`,
      snapshot_timestamp: '20220309015720',
      sha256: 'a9043c1af6dc1d1e7e16e6b40faace2a4d17ac957b1cf105e1cfb097b1219c5b',
      bytes: 853_697,
      filename: '2019-20-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx',
    },
    abs1: {
      resource_url: `${V}/0033/168486/2019-20-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx`,
      snapshot_timestamp: '20220309015753',
      sha256: '5556c35b0c2a0f8c6ed2cd04aaa8435cb6cf9628577d20f41e5f6e3fcd337871',
      bytes: 483_359,
      filename: '2019-20-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx',
    },
    abs23: {
      resource_url: `${V}/0034/168487/2019-20-VLGGC-Questionnaire-ABS2-Balance-Sheets-and-Other-Finances.xlsx`,
      snapshot_timestamp: '20220309015801',
      sha256: 'a45979fe288f71a3306481292b9c854dde304b64bc497e693f751ab8ef123f3f',
      bytes: 145_479,
      filename: '2019-20-VLGGC-Questionnaire-ABS2-Balance-Sheets-and-Other-Finances.xlsx',
    },
  },
  {
    fiscal_year: '2020-21',
    vgc1: {
      resource_url: `${V}/0030/186546/2020-21-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx`,
      snapshot_timestamp: '20221018093621',
      sha256: 'e075a4cefbdf4d3054de9d4fff73092204f59c830b737ebb5b7300ba3b6caaa7',
      bytes: 899_273,
      filename: '2020-21-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx',
    },
    abs1: {
      resource_url: `${V}/0026/186542/2020-21-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx`,
      snapshot_timestamp: '20221018093649',
      sha256: '36ab30b5290b39bfa01ac78de9bc4a53110ac7226b83bcea59e2805eca8cbef9',
      bytes: 471_036,
      filename: '2020-21-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx',
    },
    abs23: {
      resource_url: `${V}/0032/188609/2020-21-VLGGC-Questionnaire-ABS2-Balance-Sheets-and-Other-Finances-V2.xlsx`,
      snapshot_timestamp: '20221018093657',
      sha256: 'd64d4749be857db8ee84fd312a2c9bab830efd7e9ce9a2c937d60612829a0966',
      bytes: 144_323,
      filename: '2020-21-VLGGC-Questionnaire-ABS2-Balance-Sheets-and-Other-Finances-V2.xlsx',
    },
  },
  {
    fiscal_year: '2021-22',
    vgc1: {
      resource_url: `${V}/0039/197499/2021-22-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx`,
      snapshot_timestamp: '20231109221951',
      sha256: '11362f35b44a3cbdb9155a308513862b942f59cbfa28bd3d61551954388cfd2d',
      bytes: 848_271,
      filename: '2021-22-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx',
    },
    abs1: {
      resource_url: `${V}/0035/197495/2021-22-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx`,
      snapshot_timestamp: '20231109222002',
      sha256: '30ec390b68f16543fdb1a33b4aa17db48d69df9d43ebbf1f2f01937e943f3d18',
      bytes: 469_559,
      filename: '2021-22-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx',
    },
    abs23: {
      resource_url: `${V}/0036/197496/2021-22-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx`,
      snapshot_timestamp: '20231109222007',
      sha256: '25a287666ffc4bf05504399553460142d192922a1e7a5db75a2423b9c039e90b',
      bytes: 144_732,
      filename: '2021-22-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx',
    },
  },
  {
    fiscal_year: '2022-23',
    vgc1: {
      resource_url: `${V}/0027/207477/2022-23-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx`,
      snapshot_timestamp: '20241020185951',
      sha256: '2dc779a3c4fe8a593ed6d26c899497e46b9c521ff7308c92e56283c33d33789f',
      bytes: 839_975,
      filename: '2022-23-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx',
    },
    abs1: {
      resource_url: `${V}/0021/207480/2022-23-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx`,
      snapshot_timestamp: '20241020190003',
      sha256: 'c983ef2b7823acf5516e20eafe4e43be5eb3c6e1eec34aa29c60dbe11f186ca0',
      bytes: 470_335,
      filename: '2022-23-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx',
    },
    abs23: {
      resource_url: `${V}/0022/207481/2022-23-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx`,
      snapshot_timestamp: '20241020190007',
      sha256: 'c7986d5b038ca299fa37f97e14547c369f68d6de3e54c54f27b3e973b99f8386',
      bytes: 145_499,
      filename: '2022-23-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx',
    },
  },
  {
    fiscal_year: '2023-24',
    vgc1: {
      resource_url: `${V}/0024/217383/2023-24-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx`,
      snapshot_timestamp: '20251120123849',
      sha256: 'f36ed6680e62c6b07630220db53c0afc6717b61f473874888b76bdd54f106663',
      bytes: 842_585,
      filename: '2023-24-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx',
    },
    abs1: {
      resource_url: `${V}/0029/217379/2023-24-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx`,
      snapshot_timestamp: '20251120123903',
      sha256: 'db4ed8fefd6542963410679aa83101df1882e07a4f99a24e0fe4ce7e4fa59f3c',
      bytes: 470_645,
      filename: '2023-24-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx',
    },
    abs23: {
      resource_url: `${V}/0021/217380/2023-24-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx`,
      snapshot_timestamp: '20251120123907',
      sha256: 'a63354b961a84100774095b61df8e74be26355cfa22d2b980b2b9e3b7d0b9258',
      bytes: 145_962,
      filename: '2023-24-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx',
    },
    bendigo_gpfs: {
      expenses_thousand: 240_484,
      revenue_thousand: 245_112,
      source_url:
        'https://www.bendigo.vic.gov.au/sites/default/files/2024-10/City-Greater-Bendigo-Annual-Report-2023-2024.pdf',
    },
  },
] as const;

export const VIC_HISTORY_FISCAL_YEARS = VIC_HISTORY_YEARS.map((year) => year.fiscal_year);

/** Years explicitly deferred: the premise is not yet proven for this generation. */
export const VIC_HISTORY_DEFERRED_YEARS = [] as const;

export function findVicHistoryYear(fiscalYear: string): VicHistoryYear {
  const year = VIC_HISTORY_YEARS.find((entry) => entry.fiscal_year === fiscalYear);
  if (!year) {
    throw new Error(
      `no VLGGC historical descriptor for ${fiscalYear}; supported: ${VIC_HISTORY_FISCAL_YEARS.join(', ')}`,
    );
  }
  return year;
}

function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

function text(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').replace(/\s+/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

interface SheetRows {
  name: string;
  rows: Array<{ number: number; values: Array<string | number | null> }>;
}

function sheetByName(workbook: { sheets: SheetRows[] }, name: string): SheetRows {
  const sheet = workbook.sheets.find((entry) => entry.name === name);
  if (!sheet) throw new Error(`VLGGC historical workbook is missing the "${name}" sheet`);
  return sheet;
}

interface CouncilRow {
  row: number;
  label: string;
  name: string;
}

interface CollectedRows {
  councils: CouncilRow[];
  totalsSuppressed: number;
  totalsRow?: { row: number; values: Array<string | number | null> };
}

function collectCouncilRows(sheet: SheetRows, skipped: Vgc1Skip[]): CollectedRows {
  const councils: CouncilRow[] = [];
  let totalsSuppressed = 0;
  let totalsRow: CollectedRows['totalsRow'];
  for (const row of sheet.rows) {
    const label = text(row.values[0]);
    if (!label) {
      const hasNumber = row.values
        .slice(1)
        .some((value) => typeof value === 'number' && Number.isFinite(value));
      if (hasNumber && row.number >= 10) {
        totalsSuppressed += 1;
        if (!totalsRow) totalsRow = { row: row.number, values: row.values };
        skipped.push({
          sheet: sheet.name,
          row: row.number,
          reason: 'source Totals row (no council label) suppressed; no cross-council total',
        });
      }
      continue;
    }
    if (/^totals?$/i.test(label)) {
      totalsSuppressed += 1;
      if (!totalsRow) totalsRow = { row: row.number, values: row.values };
      skipped.push({
        sheet: sheet.name,
        row: row.number,
        reason: `${label}: source Totals row suppressed; no cross-council total`,
      });
      continue;
    }
    if (!/^.+ \((S|C|RC|B)\)$/.test(label)) continue;
    const name = councilNameFromLabel(label);
    if (!name) continue;
    councils.push({ row: row.number, label, name });
  }
  return { councils, totalsSuppressed, ...(totalsRow ? { totalsRow } : {}) };
}

function rowAt(
  sheet: SheetRows,
  rowNumber: number,
): { number: number; values: unknown[] } | undefined {
  return sheet.rows.find((entry) => entry.number === rowNumber);
}

function findHeaderRow(sheet: SheetRows, first: string, second: string): number {
  // The FY2015-16..FY2018-19 workbooks print "Family & Community Service"
  // (singular); FY2019-20+ print "Family & Community Services". Match the
  // stable stem rather than assuming identical wording.
  const row = sheet.rows.find(
    (entry) => text(entry.values[1]) === first && (text(entry.values[2]) ?? '').includes(second),
  );
  if (!row) throw new Error(`VLGGC historical ${sheet.name} header not found (${first}/${second})`);
  return row.number;
}

function findNatureHeaderRow(sheet: SheetRows): number {
  const row = sheet.rows.find(
    (entry) =>
      text(entry.values[1]) === VGC1_NATURES[0] && text(entry.values[2]) === VGC1_NATURES[1],
  );
  if (!row) throw new Error(`VLGGC historical ${sheet.name} expense-nature header not found`);
  return row.number;
}

export interface Vgc1HistoryParseResult {
  raw: Vgc1Raw[];
  skipped: Vgc1Skip[];
  summary: {
    councilCount: number;
    totalsSuppressed: number;
    sheets: string[];
    source_totals: { expense_cents: number; revenue_cents: number };
  };
}

export function parseVgc1HistoryWorkbook(
  workbook: Vgc1WorkbookRows,
  meta: Vgc1SourceMeta,
): Vgc1HistoryParseResult {
  const fiscalYear = meta.fiscal_year;
  if (!fiscalYear) throw new Error('VGC1 historical parse requires meta.fiscal_year');
  const sourceMeta: Vgc1SourceMeta = { ...meta, fiscal_year: fiscalYear };
  const skipped: Vgc1Skip[] = [];
  const raw: Vgc1Raw[] = [];

  const totalExp = sheetByName(workbook, 'Total Exp');
  const totalRev = sheetByName(workbook, 'Total Rev');
  findHeaderRow(totalExp, 'Governance', 'Family & Community');
  findHeaderRow(totalRev, 'Governance', 'Family & Community');
  const expRows = collectCouncilRows(totalExp, skipped);
  const revRows = collectCouncilRows(totalRev, skipped);
  if (expRows.councils.length !== 79 || revRows.councils.length !== 79) {
    throw new Error(
      `VGC1 ${fiscalYear} Total Exp/Rev have ${expRows.councils.length}/${revRows.councils.length} council rows, expected 79 (premise falsified)`,
    );
  }
  if (
    expRows.councils.map((entry) => entry.label).join('|') !==
    revRows.councils.map((entry) => entry.label).join('|')
  ) {
    throw new Error(`VGC1 ${fiscalYear} Total Exp and Total Rev council lists differ`);
  }
  if (new Set(expRows.councils.map((entry) => entry.name)).size !== 79) {
    throw new Error(`VGC1 ${fiscalYear} council names are not unique after label expansion`);
  }

  let totalsSuppressed = expRows.totalsSuppressed + revRows.totalsSuppressed;

  interface Vgc1LineSpec {
    kind: 'expense' | 'revenue';
    section: 'expense' | 'revenue';
    line_type: 'function_total' | 'functions_subtotal' | 'other' | 'total';
    function_name: string | null;
    function_code: string | null;
    nature: string | null;
    line_label: string;
    line_code: string;
  }

  const pushLine = (
    council: CouncilRow,
    sheet: SheetRows,
    rowNumber: number,
    column: number,
    line: Vgc1LineSpec,
  ): void => {
    const row = rowAt(sheet, rowNumber);
    if (!row) return;
    const value = numberValue(row.values[column - 1]);
    if (value === null) return;
    raw.push({
      ...sourceMeta,
      council_label: council.label,
      council_name: council.name,
      sheet: sheet.name,
      row: rowNumber,
      column_index: column,
      raw_value: value,
      unit: 'AUD',
      ...line,
    });
  };

  for (let index = 0; index < expRows.councils.length; index += 1) {
    const council = expRows.councils[index]!;
    const revCouncil = revRows.councils[index]!;
    for (let fnIndex = 0; fnIndex < VGC1_FUNCTIONS.length; fnIndex += 1) {
      const fn = VGC1_FUNCTIONS[fnIndex]!;
      pushLine(council, totalExp, council.row, 2 + fnIndex, {
        kind: 'expense',
        section: 'expense',
        line_type: 'function_total',
        function_name: fn.name,
        function_code: fn.code,
        nature: null,
        line_label: `${fn.name} — total expenditure`,
        line_code: fn.code,
      });
      pushLine(revCouncil, totalRev, revCouncil.row, 2 + fnIndex, {
        kind: 'revenue',
        section: 'revenue',
        line_type: 'function_total',
        function_name: fn.name,
        function_code: fn.code,
        nature: null,
        line_label: `${fn.name} — total revenue`,
        line_code: fn.code,
      });
    }

    const expenseBridges = [
      {
        column: 11,
        label: 'Total Expenditure (Functions only)',
        code: '01998',
        type: 'functions_subtotal',
      },
      {
        column: 12,
        label: 'Other (Main Roads & Other) — expenditure',
        code: '01930 & 01989',
        type: 'other',
      },
      {
        column: 13,
        label: 'Total Expenditure (Functions and Others)',
        code: '01999',
        type: 'total',
      },
    ] as const;
    for (const bridge of expenseBridges) {
      pushLine(council, totalExp, council.row, bridge.column, {
        kind: 'expense',
        section: 'expense',
        line_type: bridge.type,
        function_name: null,
        function_code: null,
        nature: null,
        line_label: bridge.label,
        line_code: bridge.code,
      });
    }
    const revenueBridges = [
      {
        column: 11,
        label: 'Total Revenue (Functions only)',
        code: '01998',
        type: 'functions_subtotal',
      },
      {
        column: 12,
        label: 'Other (Main Roads & Other) — revenue',
        code: '01930 & 01989',
        type: 'other',
      },
      { column: 13, label: 'Other Revenue (Rates & Charges, VGC)', code: '01979', type: 'other' },
      { column: 14, label: 'Total Revenue (Functions and Others)', code: '01999', type: 'total' },
    ] as const;
    for (const bridge of revenueBridges) {
      pushLine(revCouncil, totalRev, revCouncil.row, bridge.column, {
        kind: 'revenue',
        section: 'revenue',
        line_type: bridge.type,
        function_name: null,
        function_code: null,
        nature: null,
        line_label: bridge.label,
        line_code: bridge.code,
      });
    }
  }

  // The historical E-* tabs repeat a head block per function; the first block
  // is the printed "<function> Total" and is the same function × nature cut as
  // pilot A. Later sub-function blocks are deliberately not summed into it.
  for (const fn of VGC1_FUNCTIONS) {
    const sheet = sheetByName(workbook, fn.tab);
    const natureHeader = findNatureHeaderRow(sheet);
    const codeCell = rowAt(sheet, natureHeader - 2);
    if (text(codeCell?.values[1]) !== fn.code) {
      throw new Error(
        `VGC1 ${fiscalYear} ${fn.tab} first block code ${String(codeCell?.values[1])}, expected ${fn.code}`,
      );
    }
    const tabRows = collectCouncilRows(sheet, skipped);
    totalsSuppressed += tabRows.totalsSuppressed;
    if (tabRows.councils.length !== 79) {
      throw new Error(
        `VGC1 ${fiscalYear} ${fn.tab} has ${tabRows.councils.length} council rows, expected 79 (premise falsified)`,
      );
    }
    if (
      tabRows.councils.map((entry) => entry.label).join('|') !==
      expRows.councils.map((entry) => entry.label).join('|')
    ) {
      throw new Error(`VGC1 ${fiscalYear} ${fn.tab} council list differs from Total Exp`);
    }
    for (const council of tabRows.councils) {
      const row = rowAt(sheet, council.row);
      if (!row) continue;
      for (let natureIndex = 0; natureIndex < VGC1_NATURES.length; natureIndex += 1) {
        const value = numberValue(row.values[1 + natureIndex]);
        if (value === null) continue;
        const nature = VGC1_NATURES[natureIndex]!;
        raw.push({
          ...sourceMeta,
          kind: 'expense_nature',
          council_label: council.label,
          council_name: council.name,
          sheet: sheet.name,
          row: council.row,
          column_index: natureIndex + 1,
          raw_value: value,
          unit: 'AUD',
          section: 'expense',
          line_type: 'function_nature',
          function_name: fn.name,
          function_code: fn.code,
          nature,
          line_label: `${fn.name} — ${nature}`,
          line_code: `${fn.code}/${natureIndex + 1}`,
        });
      }
    }
  }

  if (!expRows.totalsRow || !revRows.totalsRow) {
    throw new Error(`VGC1 ${fiscalYear} source Totals row not found; refusing to publish`);
  }
  const expenseTotal = vgc1AmountToCents(expRows.totalsRow.values[12]);
  const revenueTotal = vgc1AmountToCents(revRows.totalsRow.values[13]);
  if (!expenseTotal || !revenueTotal) {
    throw new Error(`VGC1 ${fiscalYear} source Totals row is not a usable whole-AUD amount`);
  }

  return {
    raw,
    skipped,
    summary: {
      councilCount: expRows.councils.length,
      totalsSuppressed,
      sheets: ['Total Exp', 'Total Rev', ...VGC1_FUNCTIONS.map((fn) => fn.tab)],
      source_totals: { expense_cents: expenseTotal.cents, revenue_cents: revenueTotal.cents },
    },
  };
}

export function assertVgc1HistoryPremise(
  records: readonly SpendingRecord[],
  fiscalYear: string,
): void {
  const councils = new Set(records.map((record) => record.delivery_entity).filter(Boolean));
  if (councils.size !== 79) {
    throw new Error(
      `VGC1 ${fiscalYear} premise falsified: ${councils.size} council entities, expected 79`,
    );
  }
  for (const name of councils) {
    if (/^totals?$/i.test(String(name))) {
      throw new Error(`VGC1 ${fiscalYear} premise falsified: Totals entity "${name}" emitted`);
    }
  }
  if (records.some((record) => record.fiscal_year !== fiscalYear)) {
    throw new Error(`VGC1 ${fiscalYear} premise falsified: a row carries a different fiscal_year`);
  }
  if (records.some((record) => record.source_id !== VGC1_ID)) {
    throw new Error(`VGC1 ${fiscalYear} premise falsified: a row carries a different source_id`);
  }
  if (new Set(records.map((record) => record.natural_key)).size !== records.length) {
    throw new Error(`VGC1 ${fiscalYear} premise falsified: duplicate natural keys`);
  }
}

export interface LoadedVgc1HistoryYear {
  fiscal_year: string;
  records: SpendingRecord[];
  raw: Vgc1Raw[];
  archive: ArchivedSourceRecord;
  skipped: Vgc1Skip[];
  warnings: string[];
  summary: Vgc1HistoryParseResult['summary'];
  reconciliation: {
    council: string;
    expense_cents: number;
    revenue_cents: number;
    gpfs_expenses_thousand: number | null;
    gpfs_revenue_thousand: number | null;
    expense_delta_cents: number | null;
    revenue_delta_cents: number | null;
    status: string;
  } | null;
  source_totals_check: {
    expense_sum_cents: number;
    revenue_sum_cents: number;
    expense_total_cents: number;
    revenue_total_cents: number;
    expense_delta_cents: number;
    revenue_delta_cents: number;
  };
}

export interface VicHistoryLoadOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  sourcePath?: string;
  sourceBytes?: Uint8Array;
  readWorkbook?: (filePath: string) => Promise<Vgc1WorkbookRows>;
}

const TOTALS_TOLERANCE_CENTS = 100;

export async function loadVgc1HistoryYear(
  fiscalYear: string,
  options: VicHistoryLoadOptions = {},
): Promise<LoadedVgc1HistoryYear> {
  const year = findVicHistoryYear(fiscalYear);
  const fetchImpl = options.fetchImpl ?? fetch;
  const readWorkbook = options.readWorkbook ?? readVgc1Workbook;
  const retrievalUrl = `https://web.archive.org/web/${year.vgc1.snapshot_timestamp}id_/${year.vgc1.resource_url}`;
  let data: Uint8Array | undefined = options.sourceBytes;
  if (!data && options.sourcePath) data = await readFile(options.sourcePath);

  const archive = await archiveSourceDocument({
    source_id: VGC1_ID,
    title: `VLGGC ${fiscalYear} VGC1 Expenditure and Revenue questionnaire`,
    original_url: year.vgc1.resource_url,
    retrieved_from: retrievalUrl,
    archived_from: 'wayback',
    filename: year.vgc1.filename,
    content_type: inferContentType(year.vgc1.filename),
    fetchImpl,
    ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
    ...(data ? { data } : {}),
    notes: `Official VLGGC landing page: ${VGC1_LANDING_URL}. Wayback snapshot ${year.vgc1.snapshot_timestamp}. Attribution/permission, not CC BY; bytes archived outside the repo and never redistributed.`,
  });
  if (archive.sha256 !== year.vgc1.sha256) {
    throw new Error(
      `VGC1 ${fiscalYear} workbook SHA-256 ${archive.sha256} does not match the verified ${year.vgc1.sha256}`,
    );
  }
  if (archive.bytes !== year.vgc1.bytes) {
    throw new Error(
      `VGC1 ${fiscalYear} workbook is ${archive.bytes} bytes, expected ${year.vgc1.bytes}`,
    );
  }

  const workbook = await readWorkbook(archive.local_path);
  const meta: Vgc1SourceMeta = {
    landing_url: VGC1_LANDING_URL,
    resource_url: year.vgc1.resource_url,
    retrieval_url: retrievalUrl,
    source_url: VGC1_LANDING_URL,
    source_sha256: archive.sha256,
    source_date: `${year.vgc1.snapshot_timestamp.slice(0, 4)}-${year.vgc1.snapshot_timestamp.slice(4, 6)}-${year.vgc1.snapshot_timestamp.slice(6, 8)}`,
    fiscal_year: fiscalYear,
  };
  const parsed = parseVgc1HistoryWorkbook(workbook, meta);
  const transformed = transformVgc1Raw(parsed.raw);
  assertVgc1HistoryPremise(transformed.records, fiscalYear);

  const sumOf = (records: readonly SpendingRecord[], measure: string): number =>
    records
      .filter((record) => record.vlgc_measure === measure)
      .reduce((total, record) => total + record.amount_cents, 0);
  const expenseSumCents = sumOf(transformed.records, 'total_expenditure');
  const revenueSumCents = sumOf(transformed.records, 'total_revenue');
  const expenseDelta = expenseSumCents - parsed.summary.source_totals.expense_cents;
  const revenueDelta = revenueSumCents - parsed.summary.source_totals.revenue_cents;
  if (
    Math.abs(expenseDelta) > TOTALS_TOLERANCE_CENTS ||
    Math.abs(revenueDelta) > TOTALS_TOLERANCE_CENTS
  ) {
    throw new Error(
      `VGC1 ${fiscalYear} council totals do not reconcile to the source Totals row ` +
        `(expense delta ${expenseDelta}c, revenue delta ${revenueDelta}c)`,
    );
  }

  const warnings = [
    `councils=${parsed.summary.councilCount}; totals_rows_suppressed=${parsed.summary.totalsSuppressed}; ` +
      `records=${transformed.records.length}; council totals reconcile to the source Totals row`,
  ];
  if (transformed.duplicates > 0) {
    warnings.push(`${transformed.duplicates} duplicate natural key(s) de-duplicated`);
  }

  let reconciliation: LoadedVgc1HistoryYear['reconciliation'] = null;
  if (year.bendigo_gpfs) {
    const bendigoExpense = transformed.records.find(
      (record) =>
        record.delivery_entity === 'Greater Bendigo City Council' &&
        record.vlgc_measure === 'total_expenditure',
    );
    const bendigoRevenue = transformed.records.find(
      (record) =>
        record.delivery_entity === 'Greater Bendigo City Council' &&
        record.vlgc_measure === 'total_revenue',
    );
    if (!bendigoExpense || !bendigoRevenue) {
      throw new Error(`VGC1 ${fiscalYear} Bendigo totals not found for the GPFS reconciliation`);
    }
    const gpfsExpenseCents = year.bendigo_gpfs.expenses_thousand * 1000 * 100;
    const gpfsRevenueCents = year.bendigo_gpfs.revenue_thousand * 1000 * 100;
    const expenseDeltaCents = bendigoExpense.amount_cents - gpfsExpenseCents;
    const revenueDeltaCents = bendigoRevenue.amount_cents - gpfsRevenueCents;
    // A documented source-vs-GPFS variance, never forced to zero. Both are
    // under 0.01% for FY2023-24.
    if (Math.abs(expenseDeltaCents) > 500_000 || Math.abs(revenueDeltaCents) > 500_000) {
      throw new Error(
        `VGC1 ${fiscalYear} Bendigo totals drift from the audited GPFS beyond $5,000 ` +
          `(expense ${expenseDeltaCents}c, revenue ${revenueDeltaCents}c)`,
      );
    }
    bendigoExpense.reconciliation_status = 'reconciled_to_gpfs';
    bendigoRevenue.reconciliation_status = 'reconciled_to_gpfs';
    // The connector re-runs transform() on raw rows at ingestion time, so the
    // override must live on the raw Bendigo grand-total rows too.
    for (const entry of parsed.raw) {
      if (entry.council_name === 'Greater Bendigo City Council' && entry.line_type === 'total') {
        entry.reconciliation_status = 'reconciled_to_gpfs';
      }
    }
    reconciliation = {
      council: 'Greater Bendigo City Council',
      expense_cents: bendigoExpense.amount_cents,
      revenue_cents: bendigoRevenue.amount_cents,
      gpfs_expenses_thousand: year.bendigo_gpfs.expenses_thousand,
      gpfs_revenue_thousand: year.bendigo_gpfs.revenue_thousand,
      expense_delta_cents: expenseDeltaCents,
      revenue_delta_cents: revenueDeltaCents,
      status:
        `VGC1 whole-AUD Bendigo totals match the audited FY${fiscalYear} GPFS within ` +
        `${Math.abs(expenseDeltaCents)}c expense / ${Math.abs(revenueDeltaCents)}c revenue; documented, not forced`,
    };
    warnings.push(
      `Bendigo ${fiscalYear} expense/revenue deltas vs GPFS: ${expenseDeltaCents}c / ${revenueDeltaCents}c`,
    );
  }

  return {
    fiscal_year: fiscalYear,
    records: transformed.records,
    raw: parsed.raw,
    archive,
    skipped: [...parsed.skipped, ...transformed.skipped],
    warnings,
    summary: parsed.summary,
    reconciliation,
    source_totals_check: {
      expense_sum_cents: expenseSumCents,
      revenue_sum_cents: revenueSumCents,
      expense_total_cents: parsed.summary.source_totals.expense_cents,
      revenue_total_cents: parsed.summary.source_totals.revenue_cents,
      expense_delta_cents: expenseDelta,
      revenue_delta_cents: revenueDelta,
    },
  };
}

export interface LoadedVlgcAbsHistoryYear {
  fiscal_year: string;
  records: SpendingRecord[];
  raw: VlgcAbsRaw[];
  archives: [ArchivedSourceRecord, ArchivedSourceRecord];
  skipped: VlgcAbsSkip[];
  warnings: string[];
  summary: { councilCount: number; totalsSuppressed: number; sheets: string[] };
  source_totals_check: {
    capital_sum_cents: number;
    capital_total_cents: number;
    capital_delta_cents: number;
    assets_sum_cents: number;
    assets_total_cents: number;
    assets_delta_cents: number;
  };
}

export interface VlgcAbsHistoryLoadOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  abs1SourcePath?: string;
  abs23SourcePath?: string;
  abs1SourceBytes?: Uint8Array;
  abs23SourceBytes?: Uint8Array;
  readWorkbook?: (filePath: string) => Promise<VlgcAbsWorkbookRows>;
}

function totalsRowValue(sheet: SheetRows, column: number): number | null {
  const rows = sheet.rows.filter((row) => row.number >= 10);
  const totals = rows.find((row) => {
    const label = text(row.values[0]);
    const isTotalsLabel = !!label && /^totals?$/i.test(label);
    const isUnlabelledNumeric =
      !label &&
      row.values.slice(1).some((value) => typeof value === 'number' && Number.isFinite(value));
    return isTotalsLabel || isUnlabelledNumeric;
  });
  if (!totals) return null;
  return numberValue(totals.values[column - 1]);
}

export function assertVlgcAbsHistoryPremise(
  records: readonly SpendingRecord[],
  fiscalYear: string,
): void {
  const councils = new Set(records.map((record) => record.delivery_entity).filter(Boolean));
  if (councils.size !== 79) {
    throw new Error(
      `VLGGC ABS ${fiscalYear} premise falsified: ${councils.size} council entities, expected 79`,
    );
  }
  for (const name of councils) {
    if (/^totals?$/i.test(String(name))) {
      throw new Error(`VLGGC ABS ${fiscalYear} premise falsified: Totals entity "${name}" emitted`);
    }
  }
  if (records.some((record) => record.fiscal_year !== fiscalYear)) {
    throw new Error(
      `VLGGC ABS ${fiscalYear} premise falsified: a row carries a different fiscal_year`,
    );
  }
  if (records.some((record) => record.source_id !== VLGGC_ABS_ID)) {
    throw new Error(
      `VLGGC ABS ${fiscalYear} premise falsified: a row carries a different source_id`,
    );
  }
  if (new Set(records.map((record) => record.natural_key)).size !== records.length) {
    throw new Error(`VLGGC ABS ${fiscalYear} premise falsified: duplicate natural keys`);
  }
}

export async function loadVlgcAbsHistoryYear(
  fiscalYear: string,
  options: VlgcAbsHistoryLoadOptions = {},
): Promise<LoadedVlgcAbsHistoryYear> {
  const year = findVicHistoryYear(fiscalYear);
  const fetchImpl = options.fetchImpl ?? fetch;
  const readWorkbook = options.readWorkbook ?? readVlgcAbsWorkbook;

  let abs1Data: Uint8Array | undefined = options.abs1SourceBytes;
  if (!abs1Data && options.abs1SourcePath) abs1Data = await readFile(options.abs1SourcePath);
  let abs23Data: Uint8Array | undefined = options.abs23SourceBytes;
  if (!abs23Data && options.abs23SourcePath) abs23Data = await readFile(options.abs23SourcePath);

  const archiveOne = async (
    spec: VicHistoryWorkbook,
    title: string,
    data: Uint8Array | undefined,
  ): Promise<{ archive: ArchivedSourceRecord; workbook: VlgcAbsWorkbookRows }> => {
    const retrievalUrl = `https://web.archive.org/web/${spec.snapshot_timestamp}id_/${spec.resource_url}`;
    const archive = await archiveSourceDocument({
      source_id: VLGGC_ABS_ID,
      title,
      original_url: spec.resource_url,
      retrieved_from: retrievalUrl,
      archived_from: 'wayback',
      filename: spec.filename,
      content_type: inferContentType(spec.filename),
      fetchImpl,
      ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
      ...(data ? { data } : {}),
      notes: `Official VLGGC landing page: ${VLGGC_ABS_LANDING_URL}. Wayback snapshot ${spec.snapshot_timestamp}. Attribution/permission, not CC BY; bytes archived outside the repo and never redistributed.`,
    });
    if (archive.sha256 !== spec.sha256) {
      throw new Error(
        `VLGGC ABS ${fiscalYear} workbook SHA-256 ${archive.sha256} does not match the verified ${spec.sha256}`,
      );
    }
    if (archive.bytes !== spec.bytes) {
      throw new Error(
        `VLGGC ABS ${fiscalYear} workbook is ${archive.bytes} bytes, expected ${spec.bytes}`,
      );
    }
    return { archive, workbook: await readWorkbook(archive.local_path) };
  };

  const [abs1, abs23] = await Promise.all([
    archiveOne(
      year.abs1,
      `VLGGC ${fiscalYear} ABS1 Capital Outlays and Sales questionnaire`,
      abs1Data,
    ),
    archiveOne(
      year.abs23,
      `VLGGC ${fiscalYear} ABS2-3 Balance Sheets and Other Finances questionnaire`,
      abs23Data,
    ),
  ]);

  const abs1Meta: VlgcAbsSourceMeta = {
    landing_url: VLGGC_ABS_LANDING_URL,
    resource_url: year.abs1.resource_url,
    retrieval_url: `https://web.archive.org/web/${year.abs1.snapshot_timestamp}id_/${year.abs1.resource_url}`,
    source_url: VLGGC_ABS_LANDING_URL,
    source_sha256: abs1.archive.sha256,
    source_date: `${year.abs1.snapshot_timestamp.slice(0, 4)}-${year.abs1.snapshot_timestamp.slice(4, 6)}-${year.abs1.snapshot_timestamp.slice(6, 8)}`,
    workbook: 'ABS1',
    fiscal_year: fiscalYear,
  };
  const abs23Meta: VlgcAbsSourceMeta = {
    landing_url: VLGGC_ABS_LANDING_URL,
    resource_url: year.abs23.resource_url,
    retrieval_url: `https://web.archive.org/web/${year.abs23.snapshot_timestamp}id_/${year.abs23.resource_url}`,
    source_url: VLGGC_ABS_LANDING_URL,
    source_sha256: abs23.archive.sha256,
    source_date: `${year.abs23.snapshot_timestamp.slice(0, 4)}-${year.abs23.snapshot_timestamp.slice(4, 6)}-${year.abs23.snapshot_timestamp.slice(6, 8)}`,
    workbook: 'ABS2-3',
    fiscal_year: fiscalYear,
  };

  const parsed1 = parseVlgcAbs1Workbook(abs1.workbook, abs1Meta);
  const abs23Layout: Abs23Layout =
    year.abs23_layout === 'legacy_2015_18' ? ABS23_LAYOUT_LEGACY_2015_18 : ABS23_LAYOUT_CURRENT;
  const parsed23 = parseVlgcAbs23Workbook(abs23.workbook, abs23Meta, abs23Layout);
  const parsedRaw = [...parsed1.raw, ...parsed23.raw];
  const transformed = transformVlgcAbsRaw(parsedRaw);
  assertVlgcAbsHistoryPremise(transformed.records, fiscalYear);

  const totalOutlaysSheet = sheetByName(abs1.workbook, 'Total Outlays');
  const balanceSheet = sheetByName(abs23.workbook, 'Balance Sheets');
  const capitalTotal = totalsRowValue(totalOutlaysSheet, 12);
  const assetsTotal = totalsRowValue(balanceSheet, 33);
  if (capitalTotal === null || assetsTotal === null) {
    throw new Error(`VLGGC ABS ${fiscalYear} source Totals row not found; refusing to publish`);
  }
  const capitalTotalCents = Math.round(Math.abs(capitalTotal) * 100);
  const assetsTotalCents = Math.round(Math.abs(assetsTotal) * 100);
  const capitalSum = transformed.records
    .filter((record) => record.vlgc_abs_measure === 'total_capital_outlays')
    .reduce((total, record) => total + record.amount_cents, 0);
  const assetsSum = transformed.records
    .filter(
      (record) =>
        record.vlgc_abs_measure === 'balance_sheet_line' && record.vlgc_abs_line_code === '32300',
    )
    .reduce((total, record) => total + record.amount_cents, 0);
  const capitalDelta = capitalSum - capitalTotalCents;
  const assetsDelta = assetsSum - assetsTotalCents;
  if (
    Math.abs(capitalDelta) > TOTALS_TOLERANCE_CENTS ||
    Math.abs(assetsDelta) > TOTALS_TOLERANCE_CENTS
  ) {
    throw new Error(
      `VLGGC ABS ${fiscalYear} council totals do not reconcile to the source Totals row ` +
        `(capital delta ${capitalDelta}c, assets delta ${assetsDelta}c)`,
    );
  }

  const warnings = [
    `councils=${parsed1.summary.councilCount}; totals_rows_suppressed=` +
      `${parsed1.summary.totalsSuppressed + parsed23.summary.totalsSuppressed}; ` +
      `records=${transformed.records.length}; council totals reconcile to the source Totals rows`,
  ];
  if (transformed.duplicates > 0) {
    warnings.push(`${transformed.duplicates} duplicate natural key(s) de-duplicated`);
  }

  return {
    fiscal_year: fiscalYear,
    records: transformed.records,
    raw: parsedRaw,
    archives: [abs1.archive, abs23.archive],
    skipped: [...parsed1.skipped, ...parsed23.skipped, ...transformed.skipped],
    warnings,
    summary: {
      councilCount: Math.min(parsed1.summary.councilCount, parsed23.summary.councilCount),
      totalsSuppressed: parsed1.summary.totalsSuppressed + parsed23.summary.totalsSuppressed,
      sheets: [...parsed1.summary.sheets, ...parsed23.summary.sheets],
    },
    source_totals_check: {
      capital_sum_cents: capitalSum,
      capital_total_cents: capitalTotalCents,
      capital_delta_cents: capitalDelta,
      assets_sum_cents: assetsSum,
      assets_total_cents: assetsTotalCents,
      assets_delta_cents: assetsDelta,
    },
  };
}

export interface Vgc1HistoryManifest {
  dataset: string;
  fiscal_year: string;
  source_url: string;
  resource_url: string;
  retrieved_from: string;
  snapshot_timestamp: string;
  license: string;
  attribution: string;
  conditions_of_use: string;
  disclaimer: string;
  caveat: string;
  retrieved_at: string;
  unit: string;
  sha256: string;
  bytes: number;
  council_count: number;
  totals_suppressed: number;
  rows: number;
  source_totals_check: LoadedVgc1HistoryYear['source_totals_check'];
  reconciliation: LoadedVgc1HistoryYear['reconciliation'];
  notes: string;
}

export function vgc1HistoryManifest(
  year: VicHistoryYear,
  loaded: LoadedVgc1HistoryYear,
): Vgc1HistoryManifest {
  return {
    dataset: `VLGGC Annual Questionnaire VGC1 — Expenditure and Revenue ${year.fiscal_year}`,
    fiscal_year: year.fiscal_year,
    source_url: VGC1_LANDING_URL,
    resource_url: year.vgc1.resource_url,
    retrieved_from: `https://web.archive.org/web/${year.vgc1.snapshot_timestamp}id_/${year.vgc1.resource_url}`,
    snapshot_timestamp: year.vgc1.snapshot_timestamp,
    license: VGC1_LICENSE,
    attribution: VGC1_ATTRIBUTION,
    conditions_of_use: VGC1_CONDITIONS_OF_USE,
    disclaimer: VGC1_DISCLAIMER,
    caveat:
      'Council-supplied VLGGC questionnaire return, not audited GPFS; provisional and unverified. Non-additive rows only; no cross-council total; never mixed with vic-budget, ABS GFS, LGPRF, waste or NSW council data.',
    retrieved_at: new Date().toISOString(),
    unit: 'whole AUD (x100 cents); cells carry cents',
    sha256: loaded.archive.sha256,
    bytes: loaded.archive.bytes,
    council_count: loaded.summary.councilCount,
    totals_suppressed: loaded.summary.totalsSuppressed,
    rows: loaded.records.length,
    source_totals_check: loaded.source_totals_check,
    reconciliation: loaded.reconciliation,
    notes:
      'Derived rows only; the workbook is not redistributed. The source Totals row is suppressed and no cross-council total is emitted. Every row is non-additive agency detail, provisional/local_government and verified=false. Per-year fiscal_year and natural keys prevent cross-year collision. The five 2024-25 VGC1 rows stay under the same source_id with their own fiscal_year.',
  };
}

export interface VlgcAbsHistoryManifest {
  dataset: string;
  fiscal_year: string;
  source_url: string;
  license: string;
  attribution: string;
  conditions_of_use: string;
  disclaimer: string;
  caveat: string;
  retrieved_at: string;
  unit: string;
  councils: number;
  totals_suppressed: number;
  rows: number;
  files: Array<{
    workbook: 'ABS1' | 'ABS2-3';
    resource_url: string;
    retrieved_from: string;
    snapshot_timestamp: string;
    filename: string;
    sha256: string;
    bytes: number;
  }>;
  source_totals_check: LoadedVlgcAbsHistoryYear['source_totals_check'];
  notes: string;
}

export function vlgcAbsHistoryManifest(
  year: VicHistoryYear,
  loaded: LoadedVlgcAbsHistoryYear,
): VlgcAbsHistoryManifest {
  return {
    dataset: `VLGGC Annual Questionnaire ABS1 Capital Outlays and ABS2-3 Balance Sheets and Other Finances ${year.fiscal_year}`,
    fiscal_year: year.fiscal_year,
    source_url: VLGGC_ABS_LANDING_URL,
    license: VLGGC_ABS_LICENSE,
    attribution: VLGGC_ABS_ATTRIBUTION,
    conditions_of_use: VLGGC_ABS_CONDITIONS_OF_USE,
    disclaimer: VLGGC_ABS_DISCLAIMER,
    caveat:
      'Council-supplied VLGGC ABS1/ABS2-3 questionnaire return, not audited GPFS; provisional and unverified. Non-additive rows only; no cross-council total; never mixed with VGC1, vic-budget, ABS GFS, LGPRF, waste or NSW council data.',
    retrieved_at: new Date().toISOString(),
    unit: 'whole AUD (x100 cents); cells carry cents',
    councils: loaded.summary.councilCount,
    totals_suppressed: loaded.summary.totalsSuppressed,
    rows: loaded.records.length,
    files: [
      {
        workbook: 'ABS1',
        resource_url: year.abs1.resource_url,
        retrieved_from: `https://web.archive.org/web/${year.abs1.snapshot_timestamp}id_/${year.abs1.resource_url}`,
        snapshot_timestamp: year.abs1.snapshot_timestamp,
        filename: year.abs1.filename,
        sha256: loaded.archives[0].sha256,
        bytes: loaded.archives[0].bytes,
      },
      {
        workbook: 'ABS2-3',
        resource_url: year.abs23.resource_url,
        retrieved_from: `https://web.archive.org/web/${year.abs23.snapshot_timestamp}id_/${year.abs23.resource_url}`,
        snapshot_timestamp: year.abs23.snapshot_timestamp,
        filename: year.abs23.filename,
        sha256: loaded.archives[1].sha256,
        bytes: loaded.archives[1].bytes,
      },
    ],
    source_totals_check: loaded.source_totals_check,
    notes:
      'Derived rows only; neither workbook is redistributed. The source Totals rows are suppressed and no cross-council total is emitted. Every row is non-additive agency detail, provisional/local_government and verified=false. Per-year fiscal_year and natural keys prevent cross-year collision.',
  };
}

/**
 * Connector wrapper: fetch() loads every requested historical year and returns
 * the combined raw rows; transform() maps them with per-year fiscal_year. The
 * connector keeps the existing source_id so the source register/API stay stable.
 */
export function createVgc1HistoryConnector(
  years: readonly string[] = VIC_HISTORY_FISCAL_YEARS,
  options: VicHistoryLoadOptions = {},
): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  return {
    id: VGC1_ID,
    name: 'Victorian Local Government Grants Commission VGC1 (historical 2019-20..2023-24)',
    publisher: 'Victorian Local Government Grants Commission (Local Government Victoria)',
    source_url: VGC1_LANDING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license:
      'VLGGC attribution/permission — NOT CC BY. "Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission data collection." Derived rows only; workbooks not redistributed.',
    notes:
      'Historical VGC1 series FY2019-20..FY2023-24. Same non-additive, council-supplied questionnaire rows as pilot A, with per-year fiscal_year and source Totals suppression. No cross-council total and no mixing with any other source.',
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const raw: RawRecord[] = [];
      const warnings: string[] = [];
      for (const fiscalYear of years) {
        const loaded = await loadVgc1HistoryYear(fiscalYear, options);
        raw.push(...loaded.raw);
        warnings.push(`${fiscalYear}: ${loaded.warnings.join('; ')}`);
      }
      metadata.warnings = warnings;
      return raw;
    },
    transform(input: readonly RawRecord[]): SpendingRecord[] {
      const result = transformVgc1Raw(input);
      const byYear = new Map<string, SpendingRecord[]>();
      for (const record of result.records) {
        const list = byYear.get(record.fiscal_year) ?? [];
        list.push(record);
        byYear.set(record.fiscal_year, list);
      }
      for (const [fiscalYear, records] of byYear) {
        assertVgc1HistoryPremise(records, fiscalYear);
      }
      metadata.errors = [];
      return result.records;
    },
    metadata,
  };
}

export function createVlgcAbsHistoryConnector(
  years: readonly string[] = VIC_HISTORY_FISCAL_YEARS,
  options: VlgcAbsHistoryLoadOptions = {},
): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  return {
    id: VLGGC_ABS_ID,
    name: 'Victorian Local Government Grants Commission ABS1/ABS2-3 (historical 2019-20..2023-24)',
    publisher: 'Victorian Local Government Grants Commission (Local Government Victoria)',
    source_url: VLGGC_ABS_LANDING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license:
      'VLGGC attribution/permission — NOT CC BY. "Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission data collection." Derived rows only; workbooks not redistributed.',
    notes:
      'Historical ABS1/ABS2-3 series FY2019-20..FY2023-24. Same non-additive questionnaire rows as pilot B, with per-year fiscal_year and source Totals suppression. No cross-council total and no mixing with any other source.',
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const raw: RawRecord[] = [];
      const warnings: string[] = [];
      for (const fiscalYear of years) {
        const loaded = await loadVlgcAbsHistoryYear(fiscalYear, options);
        raw.push(...loaded.raw);
        warnings.push(`${fiscalYear}: ${loaded.warnings.join('; ')}`);
      }
      metadata.warnings = warnings;
      return raw;
    },
    transform(input: readonly RawRecord[]): SpendingRecord[] {
      const result = transformVlgcAbsRaw(input);
      const byYear = new Map<string, SpendingRecord[]>();
      for (const record of result.records) {
        const list = byYear.get(record.fiscal_year) ?? [];
        list.push(record);
        byYear.set(record.fiscal_year, list);
      }
      for (const [fiscalYear, records] of byYear) {
        assertVlgcAbsHistoryPremise(records, fiscalYear);
      }
      metadata.errors = [];
      return result.records;
    },
    metadata,
  };
}

export function vgc1HistoryNaturalKeyPrefix(): string {
  return `vic-vlgc-vgc1-historical:${sha256(VIC_HISTORY_FISCAL_YEARS.join(',')).slice(0, 12)}`;
}
