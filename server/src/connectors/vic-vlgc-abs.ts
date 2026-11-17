import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import type { SpendingRecord } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';
import { councilNameFromLabel, worksheetCellValue } from './vic-vlgc-vgc1.js';

/**
 * Victorian Local Government Grants Commission (VLGGC) ABS1/ABS2-3 2024-25
 * connector — the "VIC council pilot B" source.
 *
 * Two official workbooks cover all 79 Victorian councils:
 *   - ABS1 Capital Outlays and Sales: total outlays by nine questionnaire
 *     functions plus Other and the printed total, and total outlays by asset
 *     class (Land, Buildings, Construction, Office Equipment, Transport
 *     Equipment, Other, Total).
 *   - ABS2-3 Balance Sheets and Other Finances: the balance sheet, cash-flow
 *     statement, reconciliation, income-statement categories and the ABS3
 *     Sources & Applications of Finance & Interest table.
 *
 * This is a council-supplied grants questionnaire, NOT the audited General
 * Purpose Financial Statements. Every row is provisional/unverified and
 * non-additive; there is no cross-council total and no summing of functions,
 * asset classes, statement sections or councils.
 *
 * LICENCE: VLGGC is attribution + permission, NOT a CC licence. The workbook's
 * "Conditions of Use" says (verbatim): "Content from this spreadsheet should be
 * attributed as Victorian Local Government Grants Commission data collection."
 * The disclaimer says councils "provide permission for this online release" and
 * the Commission "does not guarantee the material to be free from error". We do
 * not claim an open licence and do not redistribute the workbooks; only derived
 * rows are emitted and the workbooks are archived outside the repo.
 *
 * UNITS: whole AUD (cells carry cents). Converted explicitly to integer cents at
 * x100; the unit is never inferred from magnitude.
 *
 * BENDIGO GATE: City of Greater Bendigo FY2024-25 total assets
 * $2,595,603,000, total liabilities $123,597,000 and total equity
 * $2,472,006,000 must match exactly. ABS1 total capital outlays must be
 * $56,221,353.20, which is $473,353.20 above the audited GPFS cash-flow
 * payments for capital assets ($55,748k). That difference is a documented
 * accrual/cash bridge and is never forced to zero.
 */

export const VLGGC_ABS_ID = 'vic-vlgc-abs';
export const VLGGC_ABS_NAME = 'Victorian Local Government Grants Commission ABS1/ABS2-3 2024-25';
export const VLGGC_ABS_PUBLISHER =
  'Victorian Local Government Grants Commission (Local Government Victoria)';
export const VLGGC_ABS_DATASET =
  'VLGGC Annual Questionnaire ABS1 Capital Outlays and ABS2-3 Balance Sheets and Other Finances 2024-25';
export const VLGGC_ABS_FISCAL_YEAR = '2024-25';
export const VLGGC_ABS_LANDING_URL =
  'https://www.localgovernment.vic.gov.au/funding-programs/victoria-grants-commission/consultation-and-operations';
export const VLGGC_ABS1_RESOURCE_URL =
  'https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0024/225960/2024-25-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx';
export const VLGGC_ABS23_RESOURCE_URL =
  'https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0025/225961/2024-25-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx';
export const VLGGC_ABS1_FILENAME =
  '2024-25-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx';
export const VLGGC_ABS23_FILENAME =
  '2024-25-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx';
export const VLGGC_ABS1_EXPECTED_SHA256 =
  '639fe70a6de9cbe27c44c5a59ec75c79a99827db706a92aa1353bfd574985f61';
export const VLGGC_ABS1_EXPECTED_BYTES = 477_675;
export const VLGGC_ABS23_EXPECTED_SHA256 =
  '6975d1d9abf0d43f8776dc28fd73882670a8907f988d3bb94ad6c4055c50891f';
export const VLGGC_ABS23_EXPECTED_BYTES = 147_062;
export const VLGGC_ABS_FALLBACK_SNAPSHOT_TIMESTAMP = '20260818214834';

export const VLGGC_ABS_ATTRIBUTION = 'Victorian Local Government Grants Commission data collection';
export const VLGGC_ABS_CONDITIONS_OF_USE =
  'Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission data collection.';
export const VLGGC_ABS_DISCLAIMER =
  'The data in these spreadsheets is provided for information purposes only. These spreadsheets are produced from data sourced annually from Local Government (councils) in Victoria. Councils provide permission for this online release. The data has been analysed, but the Victorian Local Government Grants Commission does not guarantee the material to be free from error.';
export const VLGGC_ABS_LICENSE = `VLGGC attribution/permission — NOT CC BY. Conditions of Use: "${VLGGC_ABS_CONDITIONS_OF_USE}" Councils provide permission for this online release; the Commission does not guarantee the material to be free from error. Derived rows only; the source workbooks are not redistributed.`;
export const VLGGC_ABS_CAVEAT =
  'Council-supplied VLGGC ABS1/ABS2-3 questionnaire return, not audited GPFS; provisional and unverified. Non-additive rows only; no cross-council total; never mixed with VGC1, vic-budget, ABS GFS, LGPRF, waste or NSW council data. Bendigo balance-sheet totals reconcile exactly to the GPFS; capital outlays carry a documented $473,353.20 accrual/cash bridge to the GPFS cash-flow payments.';
export const VLGGC_ABS_UNIT = 'AUD';
export const VLGGC_ABS_UNIT_TO_CENTS = 100;
export const VLGGC_ABS_DATA_QUALITY_FLAG = 'provisional/local_government';

export const BENDIGO_ABS_COUNCIL_NAME = 'Greater Bendigo City Council';
export const BENDIGO_ABS_GPFS = {
  total_assets_cents: 259_560_300_000,
  total_liabilities_cents: 12_359_700_000,
  total_equity_cents: 247_200_600_000,
  total_assets_dollars: 2_595_603_000,
  total_liabilities_dollars: 123_597_000,
  total_equity_dollars: 2_472_006_000,
  capital_outlays_cents: 5_622_135_320,
  capital_outlays_dollars: 56_221_353.2,
  gpfs_cash_flow_capital_payments_cents: 5_574_800_000,
  gpfs_cash_flow_capital_payments_thousand: 55_748,
  capital_bridge_cents: 47_335_320,
  capital_bridge_dollars: 473_353.2,
  capital_bridge_percent: 0.849,
} as const;

const ABS1_FUNCTIONS = [
  { column: 2, code: '02199', name: 'Governance' },
  { column: 3, code: '02299', name: 'Family & Community Services' },
  { column: 4, code: '02399', name: 'Aged & Disabled Services' },
  { column: 5, code: '02499', name: 'Recreation & Culture' },
  { column: 6, code: '02599', name: 'Waste Management' },
  { column: 7, code: '02699', name: 'Traffic & Street Management' },
  { column: 8, code: '02799', name: 'Environment' },
  { column: 9, code: '02899', name: 'Business & Economic Services' },
  { column: 10, code: '02999', name: 'Local Roads & Bridges' },
  { column: 11, code: '02989', name: 'Other' },
] as const;

const ABS1_TOTAL_COLUMN = 12;
const ABS1_ASSET_CLASSES = [
  { column: 2, code: '(1)', name: 'Land' },
  { column: 3, code: '(2)', name: 'Buildings' },
  { column: 4, code: '(3)', name: 'Construction (excl buildings)' },
  { column: 5, code: '(4)', name: 'Office Equipment' },
  { column: 6, code: '(5)', name: 'Transport Equipment' },
  { column: 7, code: '(6)', name: 'Other' },
  { column: 8, code: '(7)', name: 'Total Capital Outlays' },
] as const;

const SA_BLOCKS = [
  { start: 2, section: 'long_term_debt_beginning', label: 'Long Term Debt (beginning of year)' },
  { start: 8, section: 'new_loans_raised', label: 'New Loans Raised (excl. refinancing loans)' },
  { start: 14, section: 'debt_redeemed', label: 'Debt Redeemed' },
  { start: 20, section: 'long_term_debt_end', label: 'Long Term Debt (end of year)' },
  { start: 26, section: 'interest_paid', label: 'Interest Paid' },
  { start: 32, section: 'interest_received', label: 'Interest Received' },
  {
    start: 38,
    section: 'investments_at_30_june',
    label: 'Investment as at 30 June (principal only)',
  },
] as const;

const SA_SOURCES = [
  { offset: 0, code: '03000', name: 'Bank' },
  { offset: 1, code: '03050', name: 'NBFIs' },
  { offset: 2, code: '03100', name: 'Victorian Treasury' },
  { offset: 3, code: '03150', name: 'Other Councils' },
  { offset: 4, code: '03250', name: 'Other Sources' },
  { offset: 5, code: '03299', name: 'Total' },
] as const;

interface StatementSection {
  start: number;
  end: number;
  statement: 'balance' | 'cash_flow' | 'income';
  section: string;
}

const BALANCE_SHEET_SECTIONS: readonly StatementSection[] = [
  { start: 2, end: 33, statement: 'balance', section: 'assets' },
  { start: 34, end: 53, statement: 'balance', section: 'liabilities' },
  { start: 54, end: 57, statement: 'balance', section: 'equity' },
  { start: 58, end: 66, statement: 'cash_flow', section: 'operating_receipts' },
  { start: 67, end: 79, statement: 'cash_flow', section: 'operating_payments' },
  { start: 80, end: 89, statement: 'cash_flow', section: 'investing' },
  { start: 90, end: 100, statement: 'cash_flow', section: 'financing' },
  { start: 101, end: 105, statement: 'cash_flow', section: 'reconciliation' },
  { start: 106, end: 121, statement: 'income', section: 'revenue' },
  { start: 122, end: 144, statement: 'income', section: 'expenses' },
  { start: 145, end: 147, statement: 'income', section: 'other_comprehensive_income' },
  { start: 148, end: 148, statement: 'income', section: 'comprehensive_result' },
];

/**
 * The FY2015-16..FY2018-19 ABS2 workbook has 144 columns, one fewer than the
 * FY2019-20+ workbook: it has no lease-liability line, so everything from
 * Total Liabilities onward shifts one column left. The revenue and expense
 * sections also have fewer printed lines. The layout is explicit per
 * generation rather than assumed identical.
 */
const BALANCE_SHEET_SECTIONS_LEGACY: readonly StatementSection[] = [
  { start: 2, end: 33, statement: 'balance', section: 'assets' },
  { start: 34, end: 52, statement: 'balance', section: 'liabilities' },
  { start: 53, end: 56, statement: 'balance', section: 'equity' },
  { start: 57, end: 65, statement: 'cash_flow', section: 'operating_receipts' },
  { start: 66, end: 78, statement: 'cash_flow', section: 'operating_payments' },
  { start: 79, end: 88, statement: 'cash_flow', section: 'investing' },
  { start: 89, end: 99, statement: 'cash_flow', section: 'financing' },
  { start: 100, end: 104, statement: 'cash_flow', section: 'reconciliation' },
  { start: 105, end: 119, statement: 'income', section: 'revenue' },
  { start: 120, end: 140, statement: 'income', section: 'expenses' },
  { start: 141, end: 143, statement: 'income', section: 'other_comprehensive_income' },
  { start: 144, end: 144, statement: 'income', section: 'comprehensive_result' },
];

export interface Abs23Layout {
  sections: readonly StatementSection[];
  totalAssetsColumn: number;
  totalLiabilitiesColumn: number;
  totalEquityColumn: number;
}

export const ABS23_LAYOUT_CURRENT: Abs23Layout = {
  sections: BALANCE_SHEET_SECTIONS,
  totalAssetsColumn: 33,
  totalLiabilitiesColumn: 53,
  totalEquityColumn: 56,
};

export const ABS23_LAYOUT_LEGACY_2015_18: Abs23Layout = {
  sections: BALANCE_SHEET_SECTIONS_LEGACY,
  totalAssetsColumn: 33,
  totalLiabilitiesColumn: 52,
  totalEquityColumn: 55,
};

export interface VlgcAbsWorkbookRows {
  sheets: Array<{
    name: string;
    rows: Array<{ number: number; values: Array<string | number | null> }>;
  }>;
}

export interface VlgcAbsSelection {
  landing_url: string;
  resource_url: string;
  retrieval_url: string;
  snapshot_timestamp: string;
  source_date: string;
  expected_sha256: string;
}

export interface VlgcAbsSourceMeta {
  landing_url: string;
  resource_url: string;
  retrieval_url: string;
  source_url: string;
  source_sha256: string;
  source_date: string;
  workbook: 'ABS1' | 'ABS2-3';
  /** Fiscal year of the workbook; defaults to FY2024-25 when omitted. */
  fiscal_year?: string;
}

export interface VlgcAbsRaw extends Record<string, unknown> {
  workbook: 'ABS1' | 'ABS2-3';
  council_label: string;
  council_name: string;
  fiscal_year?: string;
  statement: 'capital' | 'balance' | 'cash_flow' | 'income';
  statement_section: string;
  asset_class: string | null;
  line_label: string;
  line_code: string;
  measure: string;
  sheet: string;
  row: number;
  column_index: number;
  raw_value: number;
  unit: typeof VLGGC_ABS_UNIT;
  source_url: string;
  retrieval_url: string;
  source_sha256: string;
  source_date: string;
}

export interface VlgcAbsSkip {
  workbook: 'ABS1' | 'ABS2-3';
  sheet: string;
  row: number | null;
  reason: string;
}

export interface VlgcAbsParseSummary {
  councilCount: number;
  totalsSuppressed: number;
  sheets: string[];
}

export interface VlgcAbsParseResult {
  raw: VlgcAbsRaw[];
  skipped: VlgcAbsSkip[];
  summary: VlgcAbsParseSummary;
}

export interface VlgcAbsTransformResult {
  records: SpendingRecord[];
  skipped: VlgcAbsSkip[];
  duplicates: number;
}

export interface VlgcAbsLoadedSource {
  raw: VlgcAbsRaw[];
  records: SpendingRecord[];
  archives: [ArchivedSourceRecord, ArchivedSourceRecord];
  skipped: VlgcAbsSkip[];
  warnings: string[];
  summary: VlgcAbsParseSummary;
  selections: [VlgcAbsSelection, VlgcAbsSelection];
}

export interface VlgcAbsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  /** Adopt already-downloaded workbooks instead of fetching. */
  abs1SourcePath?: string;
  abs23SourcePath?: string;
  /** In-memory workbook bytes (tests and offline re-runs). */
  abs1SourceBytes?: Uint8Array;
  abs23SourceBytes?: Uint8Array;
  /** Injected for unit tests; defaults to ExcelJS. */
  readWorkbook?: (filePath: string) => Promise<VlgcAbsWorkbookRows>;
  /** Skip Wayback discovery (for offline tests). */
  abs1Selection?: VlgcAbsSelection;
  abs23Selection?: VlgcAbsSelection;
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

function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function vlgcAbsAmountToCents(
  value: unknown,
): { cents: number; printed_sign: 'positive' | 'negative' } | null {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  const cents = Math.round(Math.abs(numeric) * VLGGC_ABS_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return { cents, printed_sign: numeric < 0 ? 'negative' : 'positive' };
}

export function vlgcAbsNaturalKey(parts: readonly (string | number | null | undefined)[]): string {
  return `vic-vlgc-abs:${sha256(parts.map((part) => String(part ?? '')).join('\u001f')).slice(0, 40)}`;
}

interface CkanAvailability {
  archived_snapshots?: {
    closest?: {
      available?: boolean;
      status?: string;
      timestamp?: string;
      url?: string;
    };
  };
}

async function discoverWorkbook(
  resourceUrl: string,
  fallbackSha256: string,
  fetchImpl: typeof fetch,
): Promise<VlgcAbsSelection> {
  const availability = `http://archive.org/wayback/available?url=${encodeURIComponent(resourceUrl)}`;
  try {
    const response = await fetchImpl(availability, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const body = (await response.json()) as CkanAvailability;
      const closest = body.archived_snapshots?.closest;
      if (closest?.available && closest.timestamp && closest.status === '200') {
        return {
          landing_url: VLGGC_ABS_LANDING_URL,
          resource_url: resourceUrl,
          retrieval_url: `https://web.archive.org/web/${closest.timestamp}id_/${resourceUrl}`,
          snapshot_timestamp: closest.timestamp,
          source_date: `${closest.timestamp.slice(0, 4)}-${closest.timestamp.slice(
            4,
            6,
          )}-${closest.timestamp.slice(6, 8)}`,
          expected_sha256: fallbackSha256,
        };
      }
    }
  } catch {
    // Fall through to the documented, byte-verified snapshot.
  }
  return {
    landing_url: VLGGC_ABS_LANDING_URL,
    resource_url: resourceUrl,
    retrieval_url: `https://web.archive.org/web/${VLGGC_ABS_FALLBACK_SNAPSHOT_TIMESTAMP}id_/${resourceUrl}`,
    snapshot_timestamp: VLGGC_ABS_FALLBACK_SNAPSHOT_TIMESTAMP,
    source_date: '2026-08-18',
    expected_sha256: fallbackSha256,
  };
}

export async function discoverVlgcAbs1Source(
  fetchImpl: typeof fetch = fetch,
): Promise<VlgcAbsSelection> {
  return discoverWorkbook(VLGGC_ABS1_RESOURCE_URL, VLGGC_ABS1_EXPECTED_SHA256, fetchImpl);
}

export async function discoverVlgcAbs23Source(
  fetchImpl: typeof fetch = fetch,
): Promise<VlgcAbsSelection> {
  return discoverWorkbook(VLGGC_ABS23_RESOURCE_URL, VLGGC_ABS23_EXPECTED_SHA256, fetchImpl);
}

function sheetByName(
  workbook: VlgcAbsWorkbookRows,
  name: string,
): VlgcAbsWorkbookRows['sheets'][number] {
  const sheet = workbook.sheets.find((entry) => entry.name === name);
  if (!sheet) throw new Error(`VLGGC ABS workbook is missing the "${name}" sheet`);
  return sheet;
}

function isCouncilLabel(label: string): boolean {
  return /^.+ \((S|C|RC|B)\)$/.test(label);
}

function isTotalsLabel(label: string): boolean {
  return /^totals?$/i.test(label.trim());
}

interface CouncilRow {
  row: number;
  label: string;
  name: string;
}

function collectCouncilRows(
  sheet: VlgcAbsWorkbookRows['sheets'][number],
  workbook: 'ABS1' | 'ABS2-3',
  skipped: VlgcAbsSkip[],
): { councils: CouncilRow[]; totalsSuppressed: number } {
  const councils: CouncilRow[] = [];
  let totalsSuppressed = 0;
  for (const row of sheet.rows) {
    // Printed headers occupy rows 1-9 in every ABS sheet; council data starts
    // at row 10. Header rows carry numeric line codes in columns B+, so they
    // must not be mistaken for a source Totals row.
    if (row.number < 10) continue;
    const label = text(row.values[0]);
    if (!label) {
      const hasNumber = row.values
        .slice(1)
        .some((value) => typeof value === 'number' && Number.isFinite(value));
      if (hasNumber) {
        totalsSuppressed += 1;
        skipped.push({
          workbook,
          sheet: sheet.name,
          row: row.number,
          reason: 'source Totals row (no council label) suppressed; no cross-council total',
        });
      }
      continue;
    }
    if (isTotalsLabel(label)) {
      totalsSuppressed += 1;
      skipped.push({
        workbook,
        sheet: sheet.name,
        row: row.number,
        reason: `${label}: source Totals row suppressed; no cross-council total`,
      });
      continue;
    }
    if (!isCouncilLabel(label)) continue;
    const name = councilNameFromLabel(label);
    if (!name) continue;
    councils.push({ row: row.number, label, name });
  }
  return { councils, totalsSuppressed };
}

function cellValue(
  sheet: VlgcAbsWorkbookRows['sheets'][number],
  rowNumber: number,
  column: number,
): unknown {
  const row = sheet.rows.find((entry) => entry.number === rowNumber);
  return row?.values[column - 1] ?? null;
}

function assertSeventyNine(councils: readonly CouncilRow[], sheet: string): void {
  if (councils.length !== 79) {
    throw new Error(
      `VLGGC ABS ${sheet} has ${councils.length} council rows, expected 79 (premise falsified)`,
    );
  }
  if (new Set(councils.map((entry) => entry.name)).size !== 79) {
    throw new Error('VLGGC ABS council names are not unique after label expansion');
  }
}

function pushRaw(
  raw: VlgcAbsRaw[],
  sheet: VlgcAbsWorkbookRows['sheets'][number],
  council: CouncilRow,
  meta: VlgcAbsSourceMeta,
  spec: {
    statement: VlgcAbsRaw['statement'];
    statement_section: string;
    asset_class: string | null;
    line_label: string;
    line_code: string;
    measure: string;
    column: number;
  },
): void {
  const value = numberValue(cellValue(sheet, council.row, spec.column));
  if (value === null || value === 0) return;
  raw.push({
    ...meta,
    council_label: council.label,
    council_name: council.name,
    statement: spec.statement,
    statement_section: spec.statement_section,
    asset_class: spec.asset_class,
    line_label: spec.line_label,
    line_code: spec.line_code,
    measure: spec.measure,
    sheet: sheet.name,
    row: council.row,
    column_index: spec.column,
    raw_value: value,
    unit: VLGGC_ABS_UNIT,
  });
}

export function parseVlgcAbs1Workbook(
  workbook: VlgcAbsWorkbookRows,
  meta: VlgcAbsSourceMeta,
): VlgcAbsParseResult {
  const skipped: VlgcAbsSkip[] = [];
  const raw: VlgcAbsRaw[] = [];
  const totalOutlays = sheetByName(workbook, 'Total Outlays');
  const assetTotals = sheetByName(workbook, 'O-Total');
  const outlayRows = collectCouncilRows(totalOutlays, 'ABS1', skipped);
  const assetRows = collectCouncilRows(assetTotals, 'ABS1', skipped);
  assertSeventyNine(outlayRows.councils, 'Total Outlays');
  assertSeventyNine(assetRows.councils, 'O-Total');
  if (
    outlayRows.councils.map((entry) => entry.label).join('|') !==
    assetRows.councils.map((entry) => entry.label).join('|')
  ) {
    throw new Error('VLGGC ABS1 Total Outlays and O-Total council lists differ');
  }

  if (text(cellValue(totalOutlays, 6, ABS1_TOTAL_COLUMN)) !== 'Total Outlays') {
    throw new Error('VLGGC ABS1 Total Outlays header is not the expected printed total');
  }
  if (text(cellValue(assetTotals, 7, 8)) !== 'Total Capital Outlays') {
    throw new Error('VLGGC ABS1 O-Total asset-class header is not the expected total');
  }

  for (const council of outlayRows.councils) {
    for (const fn of ABS1_FUNCTIONS) {
      pushRaw(raw, totalOutlays, council, meta, {
        statement: 'capital',
        statement_section: 'total_outlays_by_function',
        asset_class: null,
        line_label: fn.name,
        line_code: fn.code,
        measure: 'capital_outlays_by_function',
        column: fn.column,
      });
    }
    pushRaw(raw, totalOutlays, council, meta, {
      statement: 'capital',
      statement_section: 'total_outlays',
      asset_class: null,
      line_label: 'Total Outlays',
      line_code: '02999',
      measure: 'total_capital_outlays',
      column: ABS1_TOTAL_COLUMN,
    });
  }
  for (const council of assetRows.councils) {
    for (const assetClass of ABS1_ASSET_CLASSES) {
      pushRaw(raw, assetTotals, council, meta, {
        statement: 'capital',
        statement_section: 'asset_class_totals',
        asset_class: assetClass.name,
        line_label: assetClass.name,
        line_code: assetClass.code,
        measure: 'asset_class_total',
        column: assetClass.column,
      });
    }
  }

  return {
    raw,
    skipped,
    summary: {
      councilCount: outlayRows.councils.length,
      totalsSuppressed: outlayRows.totalsSuppressed + assetRows.totalsSuppressed,
      sheets: [totalOutlays.name, assetTotals.name],
    },
  };
}

function balanceHeader(
  sheet: VlgcAbsWorkbookRows['sheets'][number],
  column: number,
): { label: string; code: string } {
  const code = text(cellValue(sheet, 5, column)) ?? text(cellValue(sheet, 8, column)) ?? '';
  const label =
    text(cellValue(sheet, 7, column)) ?? text(cellValue(sheet, 6, column)) ?? `Column ${column}`;
  return { label, code };
}

export function parseVlgcAbs23Workbook(
  workbook: VlgcAbsWorkbookRows,
  meta: VlgcAbsSourceMeta,
  layout: Abs23Layout = ABS23_LAYOUT_CURRENT,
): VlgcAbsParseResult {
  const skipped: VlgcAbsSkip[] = [];
  const raw: VlgcAbsRaw[] = [];
  const balance = sheetByName(workbook, 'Balance Sheets');
  const sources = sheetByName(workbook, 'Sources & Applications');
  const balanceRows = collectCouncilRows(balance, 'ABS2-3', skipped);
  const sourceRows = collectCouncilRows(sources, 'ABS2-3', skipped);
  assertSeventyNine(balanceRows.councils, 'Balance Sheets');
  assertSeventyNine(sourceRows.councils, 'Sources & Applications');
  if (
    balanceRows.councils.map((entry) => entry.label).join('|') !==
    sourceRows.councils.map((entry) => entry.label).join('|')
  ) {
    throw new Error('VLGGC ABS2-3 Balance Sheets and Sources & Applications council lists differ');
  }

  if (text(cellValue(balance, 7, layout.totalAssetsColumn)) !== 'Total Assets') {
    throw new Error('VLGGC ABS2 Balance Sheets header is missing Total Assets');
  }
  if (text(cellValue(balance, 7, layout.totalLiabilitiesColumn)) !== 'Total Liabilities') {
    throw new Error('VLGGC ABS2 Balance Sheets header is missing Total Liabilities');
  }
  if (text(cellValue(balance, 7, layout.totalEquityColumn)) !== 'Total Equity') {
    throw new Error('VLGGC ABS2 Balance Sheets header is missing Total Equity');
  }

  for (const council of balanceRows.councils) {
    for (const section of layout.sections) {
      for (let column = section.start; column <= section.end; column += 1) {
        const header = balanceHeader(balance, column);
        pushRaw(raw, balance, council, meta, {
          statement: section.statement,
          statement_section: section.section,
          asset_class:
            section.statement === 'balance' && section.section === 'assets' ? header.label : null,
          line_label: header.label,
          line_code: header.code,
          measure:
            section.statement === 'balance'
              ? 'balance_sheet_line'
              : section.statement === 'cash_flow'
                ? 'cash_flow_line'
                : 'income_statement_line',
          column,
        });
      }
    }
  }

  for (const council of sourceRows.councils) {
    for (const block of SA_BLOCKS) {
      for (const source of SA_SOURCES) {
        const column = block.start + source.offset;
        pushRaw(raw, sources, council, meta, {
          statement: 'cash_flow',
          statement_section: block.section,
          asset_class: null,
          line_label: `${block.label} — ${source.name}`,
          line_code: source.code,
          measure: 'sources_and_applications_line',
          column,
        });
      }
    }
  }

  return {
    raw,
    skipped,
    summary: {
      councilCount: balanceRows.councils.length,
      totalsSuppressed: balanceRows.totalsSuppressed + sourceRows.totalsSuppressed,
      sheets: [balance.name, sources.name],
    },
  };
}

function reconciliationStatus(raw: VlgcAbsRaw): string {
  const fiscalYear = raw.fiscal_year ?? VLGGC_ABS_FISCAL_YEAR;
  if (fiscalYear !== VLGGC_ABS_FISCAL_YEAR) return 'questionnaire_unaudited';
  if (raw.council_name !== BENDIGO_ABS_COUNCIL_NAME) return 'questionnaire_unaudited';
  if (raw.measure === 'balance_sheet_line' && raw.line_code === '32300') {
    return 'reconciled_to_gpfs';
  }
  if (raw.measure === 'balance_sheet_line' && raw.line_code === '32800') {
    return 'reconciled_to_gpfs';
  }
  if (raw.measure === 'balance_sheet_line' && raw.line_code === '32600') {
    return 'reconciled_to_gpfs';
  }
  if (raw.measure === 'total_capital_outlays') return 'bridged_to_gpfs_cash_flow';
  return 'questionnaire_unaudited';
}

function mapRawRecord(raw: VlgcAbsRaw): SpendingRecord | null {
  const amount = vlgcAbsAmountToCents(raw.raw_value);
  if (amount === null) return null;
  const fiscalYear = raw.fiscal_year ?? VLGGC_ABS_FISCAL_YEAR;
  const reconciliation = reconciliationStatus(raw);
  const key = vlgcAbsNaturalKey([
    fiscalYear,
    raw.workbook,
    raw.council_name,
    raw.statement,
    raw.statement_section,
    raw.asset_class,
    raw.line_code,
    raw.column_index,
  ]);

  const note = [
    `Source: VLGGC ABS ${fiscalYear} questionnaire (${raw.workbook} ${raw.sheet}, row ${raw.row}, column ${raw.column_index})`,
    `Official landing page: ${VLGGC_ABS_LANDING_URL}`,
    `Official resource: ${raw.resource_url}`,
    `Retrieved from: ${raw.retrieval_url}`,
    `Workbook SHA-256: ${raw.source_sha256}`,
    `Unit: whole ${VLGGC_ABS_UNIT} (cells carry cents) converted at ${VLGGC_ABS_UNIT_TO_CENTS} cents per dollar; unit is explicit, never inferred from magnitude`,
    `Printed line: ${raw.line_label} (code ${raw.line_code})`,
    `Statement: ${raw.statement}; section: ${raw.statement_section}${raw.asset_class ? `; asset class: ${raw.asset_class}` : ''}`,
    `Attribution: ${VLGGC_ABS_ATTRIBUTION}. Conditions of Use: "${VLGGC_ABS_CONDITIONS_OF_USE}" This is attribution/permission, NOT a CC licence; the workbooks are not redistributed.`,
    'Council-supplied VLGGC questionnaire, unaudited; provisional/local_government; verified=false',
    reconciliation === 'reconciled_to_gpfs'
      ? `Reconciliation: City of Greater Bendigo ${raw.line_label} reconciles exactly to its audited ${fiscalYear} GPFS; reconciliation_status=reconciled_to_gpfs`
      : reconciliation === 'bridged_to_gpfs_cash_flow'
        ? `Reconciliation: City of Greater Bendigo ABS1 total capital outlays $56,221,353.20 exceed the audited GPFS cash-flow payments for capital assets ($55,748k) by $473,353.20 (0.85%); the accrual/cash bridge is documented and equality is never forced; reconciliation_status=bridged_to_gpfs_cash_flow`
        : 'Reconciliation: questionnaire_unaudited; no GPFS reconciliation for this row',
    'NON-ADDITIVE: functions, asset classes, balance-sheet lines, cash-flow lines, income-statement categories and Sources & Applications rows are separate printed cuts and are never summed together; no cross-council total; never mixed with vic-vlgc-vgc1, vic-budget, ABS GFS, LGPRF, waste or NSW council rows',
  ].join('; ');

  return {
    amount_cents: amount.cents,
    measure_type: 'actual',
    fiscal_year: fiscalYear,
    source_id: VLGGC_ABS_ID,
    source_url: VLGGC_ABS_LANDING_URL,
    verified: false,
    natural_key: key,
    jurisdiction_level: 'local',
    jurisdiction: 'VIC',
    delivery_entity: raw.council_name,
    funding_source: 'Victorian local government',
    source_dataset: `VLGGC Annual Questionnaire ABS1 Capital Outlays and ABS2-3 Balance Sheets and Other Finances ${fiscalYear}`,
    source_date: raw.source_date,
    data_quality_flag: VLGGC_ABS_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    project_name: `${raw.council_name} — ${raw.line_label}`,
    description: `VLGGC ${raw.workbook} ${fiscalYear} ${raw.statement} — ${raw.line_label}`,
    location: { state: 'VIC', lga_name: raw.council_name },
    statement: raw.statement,
    reconciliation_status: reconciliation,
    ...(raw.asset_class ? { asset_class: raw.asset_class } : {}),
    statement_section: raw.statement_section,
    statement_line: raw.line_label,
    vlgc_abs_measure: raw.measure,
    vlgc_abs_line_code: raw.line_code,
    vlgc_abs_council_label: raw.council_label,
    vlgc_abs_unit: VLGGC_ABS_UNIT,
    vlgc_abs_printed_sign: amount.printed_sign,
    notes: note,
  };
}

export function transformVlgcAbsRaw(raw: readonly RawRecord[]): VlgcAbsTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: VlgcAbsSkip[] = [];
  const keys = new Set<string>();
  let duplicates = 0;
  for (const entry of raw) {
    if (entry.workbook !== 'ABS1' && entry.workbook !== 'ABS2-3') {
      skipped.push({
        workbook: 'ABS1',
        sheet: String(entry.sheet ?? 'unknown'),
        row: typeof entry.row === 'number' ? entry.row : null,
        reason: `unknown raw workbook ${String(entry.workbook)}`,
      });
      continue;
    }
    const record = mapRawRecord(entry as VlgcAbsRaw);
    if (!record) {
      skipped.push({
        workbook: entry.workbook,
        sheet: String(entry.sheet ?? 'unknown'),
        row: typeof entry.row === 'number' ? entry.row : null,
        reason: `${String(entry.line_label ?? '')}: unusable whole-AUD amount`,
      });
      continue;
    }
    if (keys.has(record.natural_key!)) {
      duplicates += 1;
      continue;
    }
    keys.add(record.natural_key!);
    records.push(record);
  }
  return { records, skipped, duplicates };
}

export function assertVlgcAbsPremise(records: readonly SpendingRecord[]): void {
  const councils = new Set(records.map((record) => record.delivery_entity).filter(Boolean));
  if (councils.size !== 79) {
    throw new Error(`VLGGC ABS premise falsified: ${councils.size} council entities, expected 79`);
  }
  for (const name of councils) {
    if (/^totals?$/i.test(String(name))) {
      throw new Error(`VLGGC ABS premise falsified: source Totals entity "${name}" was emitted`);
    }
  }
  const findBendigo = (measure: string, lineCode?: string): SpendingRecord | undefined =>
    records.find(
      (record) =>
        record.delivery_entity === BENDIGO_ABS_COUNCIL_NAME &&
        record.vlgc_abs_measure === measure &&
        (lineCode === undefined || record.vlgc_abs_line_code === lineCode),
    );
  const checks: Array<[string, SpendingRecord | undefined, number]> = [
    [
      'total assets',
      findBendigo('balance_sheet_line', '32300'),
      BENDIGO_ABS_GPFS.total_assets_cents,
    ],
    [
      'total liabilities',
      findBendigo('balance_sheet_line', '32800'),
      BENDIGO_ABS_GPFS.total_liabilities_cents,
    ],
    [
      'total equity',
      findBendigo('balance_sheet_line', '32600'),
      BENDIGO_ABS_GPFS.total_equity_cents,
    ],
    [
      'total capital outlays',
      findBendigo('total_capital_outlays'),
      BENDIGO_ABS_GPFS.capital_outlays_cents,
    ],
  ];
  for (const [label, record, expected] of checks) {
    if (!record || record.amount_cents !== expected) {
      throw new Error(
        `VLGGC ABS premise falsified: Bendigo ${label} ${String(record?.amount_cents)} cents, expected ${expected}`,
      );
    }
  }
  const bridge =
    BENDIGO_ABS_GPFS.capital_outlays_cents - BENDIGO_ABS_GPFS.gpfs_cash_flow_capital_payments_cents;
  if (bridge !== BENDIGO_ABS_GPFS.capital_bridge_cents) {
    throw new Error(`VLGGC ABS capital bridge ${bridge} cents, expected 47335320`);
  }
}

export async function readVlgcAbsWorkbook(filePath: string): Promise<VlgcAbsWorkbookRows> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheets: VlgcAbsWorkbookRows['sheets'] = [];
  for (const worksheet of workbook.worksheets) {
    const rows: VlgcAbsWorkbookRows['sheets'][number]['rows'] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values: Array<string | number | null> = [];
      const last = Math.max(row.cellCount, 1);
      for (let column = 1; column <= last; column += 1) {
        values[column - 1] = worksheetCellValue(row.getCell(column).value);
      }
      rows.push({ number: rowNumber, values });
    });
    sheets.push({ name: worksheet.name, rows });
  }
  return { sheets };
}

export interface VlgcAbsArchiveManifest {
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
  reconciliation: {
    council: string;
    assets_cents: number;
    liabilities_cents: number;
    equity_cents: number;
    assets_status: string;
    liabilities_status: string;
    equity_status: string;
    capital_outlays_cents: number;
    gpfs_cash_flow_capital_payments_thousand: number;
    capital_bridge_cents: number;
    capital_bridge_dollars: number;
    capital_bridge_percent: number;
    capital_status: string;
    bridge_note: string;
  };
  notes: string;
}

async function archiveWorkbook(
  sourceId: string,
  title: string,
  selection: VlgcAbsSelection,
  filename: string,
  expectedSha256: string,
  expectedBytes: number,
  options: VlgcAbsConnectorOptions,
  data: Uint8Array | undefined,
  readWorkbook: (filePath: string) => Promise<VlgcAbsWorkbookRows>,
): Promise<{ archive: ArchivedSourceRecord; workbook: VlgcAbsWorkbookRows }> {
  const archive = await archiveSourceDocument({
    source_id: sourceId,
    title,
    original_url: selection.resource_url,
    retrieved_from: selection.retrieval_url,
    archived_from: 'wayback',
    filename,
    content_type: inferContentType(filename),
    fetchImpl: options.fetchImpl ?? fetch,
    ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
    ...(data ? { data } : {}),
    notes: `Official VLGGC landing page: ${selection.landing_url}. Wayback snapshot ${selection.snapshot_timestamp}. Attribution/permission, not CC BY; bytes archived outside the repo and never redistributed.`,
  });
  if (archive.sha256 !== expectedSha256) {
    throw new Error(
      `VLGGC ABS workbook SHA-256 ${archive.sha256} does not match the verified ${expectedSha256}`,
    );
  }
  if (archive.bytes !== expectedBytes) {
    throw new Error(`VLGGC ABS workbook is ${archive.bytes} bytes, expected ${expectedBytes}`);
  }
  return { archive, workbook: await readWorkbook(archive.local_path) };
}

export async function loadVlgcAbsSource(
  options: VlgcAbsConnectorOptions = {},
): Promise<VlgcAbsLoadedSource> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const readWorkbook = options.readWorkbook ?? readVlgcAbsWorkbook;
  const abs1Selection = options.abs1Selection ?? (await discoverVlgcAbs1Source(fetchImpl));
  const abs23Selection = options.abs23Selection ?? (await discoverVlgcAbs23Source(fetchImpl));
  const warnings: string[] = [];

  let abs1Data: Uint8Array | undefined = options.abs1SourceBytes;
  if (!abs1Data && options.abs1SourcePath) abs1Data = await readFile(options.abs1SourcePath);
  let abs23Data: Uint8Array | undefined = options.abs23SourceBytes;
  if (!abs23Data && options.abs23SourcePath) abs23Data = await readFile(options.abs23SourcePath);

  const [abs1, abs23] = await Promise.all([
    archiveWorkbook(
      VLGGC_ABS_ID,
      'VLGGC 2024-25 ABS1 Capital Outlays and Sales questionnaire',
      abs1Selection,
      VLGGC_ABS1_FILENAME,
      VLGGC_ABS1_EXPECTED_SHA256,
      VLGGC_ABS1_EXPECTED_BYTES,
      options,
      abs1Data,
      readWorkbook,
    ),
    archiveWorkbook(
      VLGGC_ABS_ID,
      'VLGGC 2024-25 ABS2-3 Balance Sheets and Other Finances questionnaire',
      abs23Selection,
      VLGGC_ABS23_FILENAME,
      VLGGC_ABS23_EXPECTED_SHA256,
      VLGGC_ABS23_EXPECTED_BYTES,
      options,
      abs23Data,
      readWorkbook,
    ),
  ]);

  const abs1Meta: VlgcAbsSourceMeta = {
    landing_url: abs1Selection.landing_url,
    resource_url: abs1Selection.resource_url,
    retrieval_url: abs1Selection.retrieval_url,
    source_url: abs1Selection.landing_url,
    source_sha256: abs1.archive.sha256,
    source_date: abs1Selection.source_date,
    workbook: 'ABS1',
  };
  const abs23Meta: VlgcAbsSourceMeta = {
    landing_url: abs23Selection.landing_url,
    resource_url: abs23Selection.resource_url,
    retrieval_url: abs23Selection.retrieval_url,
    source_url: abs23Selection.landing_url,
    source_sha256: abs23.archive.sha256,
    source_date: abs23Selection.source_date,
    workbook: 'ABS2-3',
  };

  const parsed1 = parseVlgcAbs1Workbook(abs1.workbook, abs1Meta);
  const parsed23 = parseVlgcAbs23Workbook(abs23.workbook, abs23Meta);
  const parsed: VlgcAbsParseResult = {
    raw: [...parsed1.raw, ...parsed23.raw],
    skipped: [...parsed1.skipped, ...parsed23.skipped],
    summary: {
      councilCount: Math.min(parsed1.summary.councilCount, parsed23.summary.councilCount),
      totalsSuppressed: parsed1.summary.totalsSuppressed + parsed23.summary.totalsSuppressed,
      sheets: [...parsed1.summary.sheets, ...parsed23.summary.sheets],
    },
  };
  const transformed = transformVlgcAbsRaw(parsed.raw);
  assertVlgcAbsPremise(transformed.records);

  if (transformed.duplicates > 0) {
    warnings.push(`${transformed.duplicates} duplicate natural key(s) de-duplicated`);
  }
  if (parsed.summary.totalsSuppressed === 0) {
    throw new Error(
      'VLGGC ABS Totals row was not found; refusing to publish without suppression proof',
    );
  }
  warnings.push(
    `councils=${parsed.summary.councilCount}; totals_rows_suppressed=${parsed.summary.totalsSuppressed}; ` +
      `records=${transformed.records.length}; Bendigo balance sheet reconciled exactly and capital bridge documented`,
  );

  return {
    raw: parsed.raw,
    records: transformed.records,
    archives: [abs1.archive, abs23.archive],
    skipped: [...parsed.skipped, ...transformed.skipped],
    warnings,
    summary: parsed.summary,
    selections: [abs1Selection, abs23Selection],
  };
}

export function vlgcAbsManifestFromLoaded(loaded: VlgcAbsLoadedSource): VlgcAbsArchiveManifest {
  return {
    dataset: VLGGC_ABS_DATASET,
    fiscal_year: VLGGC_ABS_FISCAL_YEAR,
    source_url: VLGGC_ABS_LANDING_URL,
    license: VLGGC_ABS_LICENSE,
    attribution: VLGGC_ABS_ATTRIBUTION,
    conditions_of_use: VLGGC_ABS_CONDITIONS_OF_USE,
    disclaimer: VLGGC_ABS_DISCLAIMER,
    caveat: VLGGC_ABS_CAVEAT,
    retrieved_at: new Date().toISOString(),
    unit: 'whole AUD (x100 cents); cells carry cents',
    councils: loaded.summary.councilCount,
    totals_suppressed: loaded.summary.totalsSuppressed,
    rows: loaded.records.length,
    files: [
      {
        workbook: 'ABS1',
        resource_url: VLGGC_ABS1_RESOURCE_URL,
        retrieved_from: loaded.selections[0].retrieval_url,
        snapshot_timestamp: loaded.selections[0].snapshot_timestamp,
        filename: VLGGC_ABS1_FILENAME,
        sha256: loaded.archives[0].sha256,
        bytes: loaded.archives[0].bytes,
      },
      {
        workbook: 'ABS2-3',
        resource_url: VLGGC_ABS23_RESOURCE_URL,
        retrieved_from: loaded.selections[1].retrieval_url,
        snapshot_timestamp: loaded.selections[1].snapshot_timestamp,
        filename: VLGGC_ABS23_FILENAME,
        sha256: loaded.archives[1].sha256,
        bytes: loaded.archives[1].bytes,
      },
    ],
    reconciliation: {
      council: BENDIGO_ABS_COUNCIL_NAME,
      assets_cents: BENDIGO_ABS_GPFS.total_assets_cents,
      liabilities_cents: BENDIGO_ABS_GPFS.total_liabilities_cents,
      equity_cents: BENDIGO_ABS_GPFS.total_equity_cents,
      assets_status: 'exact',
      liabilities_status: 'exact',
      equity_status: 'exact',
      capital_outlays_cents: BENDIGO_ABS_GPFS.capital_outlays_cents,
      gpfs_cash_flow_capital_payments_thousand:
        BENDIGO_ABS_GPFS.gpfs_cash_flow_capital_payments_thousand,
      capital_bridge_cents: BENDIGO_ABS_GPFS.capital_bridge_cents,
      capital_bridge_dollars: BENDIGO_ABS_GPFS.capital_bridge_dollars,
      capital_bridge_percent: BENDIGO_ABS_GPFS.capital_bridge_percent,
      capital_status: 'documented_accrual_cash_bridge_not_forced',
      bridge_note:
        'ABS1 total capital outlays $56,221,353.20 vs audited GPFS cash-flow payments for capital assets $55,748k; difference $473,353.20 (0.85%) is an accrual/cash classification bridge and is documented, not forced to equality.',
    },
    notes:
      'Derived rows only; neither workbook is redistributed. The source Totals rows are suppressed and no cross-council total is emitted. Every row is non-additive agency detail, provisional/local_government and verified=false. Zero cells are not emitted. Balance-sheet asset-class labels are preserved only for ABS2 asset lines; ABS1 asset classes are in the asset_class field.',
  };
}

export function createVlgcAbsConnector(options: VlgcAbsConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: VLGGC_ABS_ID,
    name: VLGGC_ABS_NAME,
    publisher: VLGGC_ABS_PUBLISHER,
    source_url: VLGGC_ABS_LANDING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: VLGGC_ABS_LICENSE,
    notes: `${VLGGC_ABS_CAVEAT} ${VLGGC_ABS_ATTRIBUTION}. Conditions of Use: "${VLGGC_ABS_CONDITIONS_OF_USE}" This is attribution/permission, NOT a CC licence; derived rows only and the workbooks are not redistributed. Whole AUD converted explicitly to cents at x${VLGGC_ABS_UNIT_TO_CENTS}. The source Totals rows are suppressed; no cross-council total.`,
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const loaded = await loadVlgcAbsSource(options);
      metadata.warnings = loaded.warnings;
      return loaded.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformVlgcAbsRaw(raw);
      assertVlgcAbsPremise(result.records);
      metadata.errors = [];
      const warnings = [...(metadata.warnings ?? [])];
      if (result.skipped.length > 0) {
        warnings.push(`${result.skipped.length} transformed row(s) skipped`);
      }
      metadata.warnings = warnings;
      return result.records;
    },
    metadata,
  };
}
