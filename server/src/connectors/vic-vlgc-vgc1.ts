import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import type { SpendingRecord } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * Victorian Local Government Grants Commission (VLGGC) VGC1 2024-25
 * Expenditure and Revenue connector — the "VIC council pilot A" source.
 *
 * The VGC1 workbook covers all 79 Victorian councils: recurrent expenditure by
 * nine functions and five expense natures, and recurrent revenue by the same
 * nine functions plus the printed "Other (Main Roads & Other)" and "Other
 * Revenue (Rates & Charges, VGC)" bridges and totals. It is a council-supplied
 * questionnaire, NOT the audited General Purpose Financial Statements; every
 * row is therefore provisional/unverified and non-additive.
 *
 * LICENCE: VLGGC is attribution + permission, NOT a CC licence. The workbook's
 * "Conditions of Use" says (verbatim): "Content from this spreadsheet should be
 * attributed as Victorian Local Government Grants Commission data collection."
 * The disclaimer says councils "provide permission for this online release" and
 * the Commission "does not guarantee the material to be free from error". We do
 * not claim an open licence and do not redistribute the workbook; only derived
 * rows are emitted and the workbook is archived outside the repo.
 *
 * UNITS: whole AUD (cells carry cents). Converted explicitly to integer cents at
 * x100; the unit is never inferred from magnitude.
 *
 * NO CROSS-COUNCIL TOTAL: the workbook's source Totals row (row 90, no council
 * label) is suppressed entirely and never becomes a row. No platform total is
 * computed across councils, functions or natures.
 *
 * BENDIGO GATE: City of Greater Bendigo FY2024-25 total expenditure is
 * $252,760,999.96 and total revenue $277,002,000.17, matching its audited GPFS
 * ($252,761k / $277,002k) to the printed $'000 rounding (4c and 17c). The
 * connector refuses to publish rows unless those exact values are parsed.
 */

export const VGC1_ID = 'vic-vlgc-vgc1';
export const VGC1_NAME = 'Victorian Local Government Grants Commission VGC1 2024-25';
export const VGC1_PUBLISHER =
  'Victorian Local Government Grants Commission (Local Government Victoria)';
export const VGC1_DATASET = 'VLGGC Annual Questionnaire VGC1 — Expenditure and Revenue 2024-25';
export const VGC1_FISCAL_YEAR = '2024-25';
export const VGC1_LANDING_URL =
  'https://www.localgovernment.vic.gov.au/funding-programs/victoria-grants-commission/consultation-and-operations';
export const VGC1_RESOURCE_URL =
  'https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0030/225957/2024-25-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx';
export const VGC1_FALLBACK_SNAPSHOT_URL = `https://web.archive.org/web/20260818214833id_/${VGC1_RESOURCE_URL}`;
export const VGC1_EXPECTED_SHA256 =
  '9d72ff7005a48acec0361b36d47e54057363ee5503ddffedebc6158fc54b5572';
export const VGC1_EXPECTED_BYTES = 847_818;

/**
 * Verbatim VLGGC Conditions of Use. This is attribution + permission, not
 * CC BY, and must never be rendered as an open licence.
 */
export const VGC1_ATTRIBUTION = 'Victorian Local Government Grants Commission data collection';
export const VGC1_CONDITIONS_OF_USE =
  'Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission data collection.';
export const VGC1_DISCLAIMER =
  'The data in these spreadsheets is provided for information purposes only. These spreadsheets are produced from data sourced annually from Local Government (councils) in Victoria. Councils provide permission for this online release. The data has been analysed, but the Victorian Local Government Grants Commission does not guarantee the material to be free from error.';
export const VGC1_LICENSE = `VLGGC attribution/permission — NOT CC BY. Conditions of Use: "${VGC1_CONDITIONS_OF_USE}" Councils provide permission for this online release; the Commission does not guarantee the material to be free from error. Derived rows only; the source workbook is not redistributed.`;
export const VGC1_CAVEAT =
  'Council-supplied VLGGC questionnaire return, not audited GPFS; provisional and unverified. Totals reconcile to Bendigo GPFS only at the printed $1,000 rounding. No cross-council total; non-additive rows only; never mixed with vic-budget, ABS GFS, LGPRF, waste or NSW council data.';
export const VGC1_UNIT = 'AUD';
export const VGC1_UNIT_TO_CENTS = 100;
export const VGC1_DATA_QUALITY_FLAG = 'provisional/local_government';

export const BENDIGO_COUNCIL_NAME = 'Greater Bendigo City Council';
export const BENDIGO_GPFS = {
  expenses_cents: 25_276_099_996,
  revenue_cents: 27_700_200_017,
  expenses_dollars: 252_760_999.96,
  revenue_dollars: 277_002_000.17,
  gpfs_expenses_thousand: 252_761,
  gpfs_revenue_thousand: 277_002,
} as const;

export interface Vgc1Function {
  tab: string;
  code: string;
  name: string;
  /** 0-based index into the Total Exp / Total Rev function columns. */
  index: number;
}

export const VGC1_FUNCTIONS: readonly Vgc1Function[] = [
  { tab: 'E-G', code: '01199', name: 'Governance', index: 0 },
  { tab: 'E-FCS', code: '01299', name: 'Family & Community Services', index: 1 },
  { tab: 'E-ADS', code: '01399', name: 'Aged & Disabled Services', index: 2 },
  { tab: 'E-RC', code: '01499', name: 'Recreation & Culture', index: 3 },
  { tab: 'E-WM', code: '01599', name: 'Waste Management', index: 4 },
  { tab: 'E-TSM', code: '01699', name: 'Traffic & Street Management', index: 5 },
  { tab: 'E-E', code: '01799', name: 'Environment', index: 6 },
  { tab: 'E-BES', code: '01899', name: 'Business & Economic Services', index: 7 },
  { tab: 'E-LRB', code: '01996', name: 'Local Roads & Bridges', index: 8 },
];

export const VGC1_NATURES = [
  'Employee Benefits',
  'Materials & Services',
  'Depreciation & Amortisation',
  'Finance Costs',
  'Other Recurrent',
] as const;

export type Vgc1Nature = (typeof VGC1_NATURES)[number];

export type Vgc1Section = 'expense' | 'revenue';
export type Vgc1LineType =
  'function_total' | 'function_nature' | 'functions_subtotal' | 'other' | 'total';

export interface Vgc1Selection {
  landing_url: string;
  resource_url: string;
  retrieval_url: string;
  snapshot_timestamp: string;
  source_date: string;
  expected_sha256: string;
}

export interface Vgc1SourceMeta {
  landing_url: string;
  resource_url: string;
  retrieval_url: string;
  source_url: string;
  source_sha256: string;
  source_date: string;
  /** Fiscal year of the workbook; defaults to FY2024-25 when omitted. */
  fiscal_year?: string;
}

export interface Vgc1Raw extends Record<string, unknown> {
  kind: 'expense' | 'revenue' | 'expense_nature';
  council_label: string;
  council_name: string;
  fiscal_year?: string;
  /**
   * Optional per-row reconciliation override (for example a historical year's
   * Bendigo totals that were checked against the audited GPFS). Absent means
   * the normal pilot-A rule applies.
   */
  reconciliation_status?: string;
  section: Vgc1Section;
  line_type: Vgc1LineType;
  function_name: string | null;
  function_code: string | null;
  nature: string | null;
  line_label: string;
  line_code: string;
  sheet: string;
  row: number;
  column_index: number;
  raw_value: number;
  unit: typeof VGC1_UNIT;
  source_url: string;
  retrieval_url: string;
  source_sha256: string;
  source_date: string;
}

export interface Vgc1Skip {
  sheet: string;
  row: number | null;
  reason: string;
}

export interface Vgc1ParseSummary {
  councilCount: number;
  totalsSuppressed: number;
  sheets: string[];
}

export interface Vgc1ParseResult {
  raw: Vgc1Raw[];
  skipped: Vgc1Skip[];
  summary: Vgc1ParseSummary;
}

export interface Vgc1TransformResult {
  records: SpendingRecord[];
  skipped: Vgc1Skip[];
  duplicates: number;
}

export interface Vgc1WorkbookRows {
  sheets: Array<{
    name: string;
    rows: Array<{ number: number; values: Array<string | number | null> }>;
  }>;
}

export interface Vgc1LoadedSource {
  raw: Vgc1Raw[];
  records: SpendingRecord[];
  archive: ArchivedSourceRecord;
  skipped: Vgc1Skip[];
  warnings: string[];
  summary: Vgc1ParseSummary;
  selection: Vgc1Selection;
}

export interface Vgc1ConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  /** Adopt an already-downloaded workbook instead of fetching it. */
  sourcePath?: string;
  /** In-memory workbook bytes (tests and offline re-runs). */
  sourceBytes?: Uint8Array;
  /** Injected for unit tests; defaults to ExcelJS. */
  readWorkbook?: (filePath: string) => Promise<Vgc1WorkbookRows>;
  /** Skip Wayback discovery (for offline tests). */
  selection?: Vgc1Selection;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

/** Collapse a workbook cell value (including formula/rich-text objects) to text/number. */
export function worksheetCellValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (!isObject(value)) return null;
  if ('result' in value) {
    const result = value.result;
    if (typeof result === 'number' || typeof result === 'string') return result;
    if (result instanceof Date) return result.toISOString().slice(0, 10);
  }
  if (typeof value.text === 'string') return value.text;
  if (Array.isArray(value.richText)) {
    return value.richText
      .map((part) => (isObject(part) && typeof part.text === 'string' ? part.text : ''))
      .join('');
  }
  return null;
}

/**
 * Convert a whole-AUD amount to integer cents. Negative printed values are
 * stored as a non-negative magnitude plus `vlgc_printed_sign: "negative"`,
 * matching the shared money model (money is never negative on the record).
 */
export function vgc1AmountToCents(
  value: unknown,
): { cents: number; printed_sign: 'positive' | 'negative' } | null {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  const cents = Math.round(Math.abs(numeric) * VGC1_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return { cents, printed_sign: numeric < 0 ? 'negative' : 'positive' };
}

/**
 * Expand the VGC1 council label into the official council name. The workbook
 * prints short labels such as "Alpine (S)" or "Greater Bendigo (C)"; the
 * directory names are "Alpine Shire Council", "Greater Bendigo City Council",
 * etc. The mapping is deterministic and the source label is retained verbatim
 * in `vlgc_council_label`.
 */
export function councilNameFromLabel(label: string): string | null {
  const match = /^(.+?) \((S|C|RC|B)\)$/.exec(label.trim());
  if (!match) return null;
  const base = match[1]!.trim();
  const kind = match[2]!;
  if (kind === 'B') return 'Borough of Queenscliffe';
  if (kind === 'S') return `${base} Shire Council`;
  if (kind === 'C') return `${base} City Council`;
  return `${base} Rural City Council`;
}

export function vgc1NaturalKey(parts: readonly (string | number | null | undefined)[]): string {
  return `vic-vlgc-vgc1:${sha256(parts.map((part) => String(part ?? '')).join('\u001f')).slice(0, 40)}`;
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

/**
 * Discover the official 2024-25 VGC1 workbook. The landing page and its asset
 * URL return a Cloudflare challenge (HTTP 403) to automated clients, so the
 * documented Wayback snapshot is resolved through the availability API. The
 * original official URLs are retained as provenance.
 */
export async function discoverVgc1Source(fetchImpl: typeof fetch = fetch): Promise<Vgc1Selection> {
  const availability = `http://archive.org/wayback/available?url=${encodeURIComponent(
    VGC1_RESOURCE_URL,
  )}`;
  try {
    const response = await fetchImpl(availability, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const body = (await response.json()) as CkanAvailability;
      const closest = body.archived_snapshots?.closest;
      if (closest?.available && closest.timestamp && closest.status === '200') {
        return {
          landing_url: VGC1_LANDING_URL,
          resource_url: VGC1_RESOURCE_URL,
          retrieval_url: `https://web.archive.org/web/${closest.timestamp}id_/${VGC1_RESOURCE_URL}`,
          snapshot_timestamp: closest.timestamp,
          source_date: `${closest.timestamp.slice(0, 4)}-${closest.timestamp.slice(
            4,
            6,
          )}-${closest.timestamp.slice(6, 8)}`,
          expected_sha256: VGC1_EXPECTED_SHA256,
        };
      }
    }
  } catch {
    // Fall through to the documented, byte-verified snapshot.
  }
  return {
    landing_url: VGC1_LANDING_URL,
    resource_url: VGC1_RESOURCE_URL,
    retrieval_url: VGC1_FALLBACK_SNAPSHOT_URL,
    snapshot_timestamp: '20260818214833',
    source_date: '2026-08-18',
    expected_sha256: VGC1_EXPECTED_SHA256,
  };
}

function sheetByName(workbook: Vgc1WorkbookRows, name: string): Vgc1WorkbookRows['sheets'][number] {
  const sheet = workbook.sheets.find((entry) => entry.name === name);
  if (!sheet) throw new Error(`VGC1 workbook is missing the "${name}" sheet`);
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
  sheet: Vgc1WorkbookRows['sheets'][number],
  skipped: Vgc1Skip[],
): { councils: CouncilRow[]; totalsSuppressed: number } {
  const councils: CouncilRow[] = [];
  let totalsSuppressed = 0;
  for (const row of sheet.rows) {
    const label = text(row.values[0]);
    if (!label) {
      // Only a real Excel number row with no council label is the source Totals
      // row. Header rows carry zero-padded function codes as *strings* (for
      // example "01199"), which must not be mistaken for numeric totals.
      const hasNumber = row.values
        .slice(1)
        .some((value) => typeof value === 'number' && Number.isFinite(value));
      if (hasNumber) {
        totalsSuppressed += 1;
        skipped.push({
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

function parseFunctionSheet(
  workbook: Vgc1WorkbookRows,
  meta: Vgc1SourceMeta,
  fn: Vgc1Function,
  councils: readonly CouncilRow[],
  skipped: Vgc1Skip[],
): { raw: Vgc1Raw[]; totalsSuppressed: number } {
  const sheet = sheetByName(workbook, fn.tab);
  const { councils: sheetCouncils, totalsSuppressed } = collectCouncilRows(sheet, skipped);
  if (sheetCouncils.length !== councils.length) {
    throw new Error(
      `VGC1 ${fn.tab} has ${sheetCouncils.length} council rows, expected ${councils.length}`,
    );
  }
  const header = sheet.rows.find((row) => text(row.values[1]) === VGC1_NATURES[0]);
  if (!header) throw new Error(`VGC1 ${fn.tab} has no expense-nature header row`);
  const natureNames = VGC1_NATURES.map((_, index) => text(header.values[1 + index]));
  for (let index = 0; index < VGC1_NATURES.length; index += 1) {
    if (natureNames[index] !== VGC1_NATURES[index]) {
      throw new Error(
        `VGC1 ${fn.tab} nature header ${index + 1} is ${String(natureNames[index])}, expected ${VGC1_NATURES[index]}`,
      );
    }
  }

  const raw: Vgc1Raw[] = [];
  for (const council of sheetCouncils) {
    const row = sheet.rows.find((entry) => entry.number === council.row);
    if (!row) continue;
    for (let index = 0; index < VGC1_NATURES.length; index += 1) {
      const value = numberValue(row.values[1 + index]);
      if (value === null) continue;
      const nature = VGC1_NATURES[index]!;
      raw.push({
        kind: 'expense_nature',
        council_label: council.label,
        council_name: council.name,
        section: 'expense',
        line_type: 'function_nature',
        function_name: fn.name,
        function_code: fn.code,
        nature,
        line_label: `${fn.name} — ${nature}`,
        line_code: `${fn.code}/${index + 1}`,
        sheet: sheet.name,
        row: row.number,
        column_index: index + 1,
        raw_value: value,
        unit: VGC1_UNIT,
        ...meta,
      });
    }
  }
  return { raw, totalsSuppressed };
}

export function parseVgc1Workbook(
  workbook: Vgc1WorkbookRows,
  meta: Vgc1SourceMeta,
): Vgc1ParseResult {
  const sourceMeta: Vgc1SourceMeta = { fiscal_year: VGC1_FISCAL_YEAR, ...meta };
  const skipped: Vgc1Skip[] = [];
  const raw: Vgc1Raw[] = [];
  const totalExp = sheetByName(workbook, 'Total Exp');
  const totalRev = sheetByName(workbook, 'Total Rev');

  const expRows = collectCouncilRows(totalExp, skipped);
  const revRows = collectCouncilRows(totalRev, skipped);
  if (expRows.councils.length !== 79) {
    throw new Error(
      `VGC1 Total Exp has ${expRows.councils.length} council rows, expected 79 (premise falsified)`,
    );
  }
  if (revRows.councils.length !== 79) {
    throw new Error(
      `VGC1 Total Rev has ${revRows.councils.length} council rows, expected 79 (premise falsified)`,
    );
  }
  const expLabels = expRows.councils.map((entry) => entry.label);
  const revLabels = revRows.councils.map((entry) => entry.label);
  if (expLabels.join('|') !== revLabels.join('|')) {
    throw new Error('VGC1 Total Exp and Total Rev council lists differ');
  }
  if (new Set(expRows.councils.map((entry) => entry.name)).size !== 79) {
    throw new Error('VGC1 council names are not unique after label expansion');
  }

  let totalsSuppressed = expRows.totalsSuppressed + revRows.totalsSuppressed;

  for (let index = 0; index < expRows.councils.length; index += 1) {
    const council = expRows.councils[index]!;
    const expRow = totalExp.rows.find((entry) => entry.number === council.row);
    const revRow = totalRev.rows.find((entry) => entry.number === revRows.councils[index]!.row);
    if (!expRow || !revRow) continue;

    for (const fn of VGC1_FUNCTIONS) {
      const expValue = numberValue(expRow.values[1 + fn.index]);
      if (expValue !== null) {
        raw.push({
          kind: 'expense',
          council_label: council.label,
          council_name: council.name,
          section: 'expense',
          line_type: 'function_total',
          function_name: fn.name,
          function_code: fn.code,
          nature: null,
          line_label: `${fn.name} — total expenditure`,
          line_code: fn.code,
          sheet: totalExp.name,
          row: expRow.number,
          column_index: 1 + fn.index,
          raw_value: expValue,
          unit: VGC1_UNIT,
          ...sourceMeta,
        });
      }
      const revValue = numberValue(revRow.values[1 + fn.index]);
      if (revValue !== null) {
        raw.push({
          kind: 'revenue',
          council_label: council.label,
          council_name: council.name,
          section: 'revenue',
          line_type: 'function_total',
          function_name: fn.name,
          function_code: fn.code,
          nature: null,
          line_label: `${fn.name} — total revenue`,
          line_code: fn.code,
          sheet: totalRev.name,
          row: revRow.number,
          column_index: 1 + fn.index,
          raw_value: revValue,
          unit: VGC1_UNIT,
          ...sourceMeta,
        });
      }
    }

    // Printed expense bridges and total (columns K, L, M).
    const expenseBridges: Array<{
      column: number;
      label: string;
      code: string;
      type: Vgc1LineType;
    }> = [
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
    ];
    for (const bridge of expenseBridges) {
      const value = numberValue(expRow.values[bridge.column - 1]);
      if (value === null) continue;
      raw.push({
        kind: 'expense',
        council_label: council.label,
        council_name: council.name,
        section: 'expense',
        line_type: bridge.type,
        function_name: null,
        function_code: null,
        nature: null,
        line_label: bridge.label,
        line_code: bridge.code,
        sheet: totalExp.name,
        row: expRow.number,
        column_index: bridge.column,
        raw_value: value,
        unit: VGC1_UNIT,
        ...sourceMeta,
      });
    }

    // Printed revenue bridges and total (columns K, L, M, N).
    const revenueBridges: Array<{
      column: number;
      label: string;
      code: string;
      type: Vgc1LineType;
    }> = [
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
    ];
    for (const bridge of revenueBridges) {
      const value = numberValue(revRow.values[bridge.column - 1]);
      if (value === null) continue;
      raw.push({
        kind: 'revenue',
        council_label: council.label,
        council_name: council.name,
        section: 'revenue',
        line_type: bridge.type,
        function_name: null,
        function_code: null,
        nature: null,
        line_label: bridge.label,
        line_code: bridge.code,
        sheet: totalRev.name,
        row: revRow.number,
        column_index: bridge.column,
        raw_value: value,
        unit: VGC1_UNIT,
        ...sourceMeta,
      });
    }
  }

  for (const fn of VGC1_FUNCTIONS) {
    const parsed = parseFunctionSheet(workbook, sourceMeta, fn, expRows.councils, skipped);
    raw.push(...parsed.raw);
    totalsSuppressed += parsed.totalsSuppressed;
  }

  return {
    raw,
    skipped,
    summary: {
      councilCount: expRows.councils.length,
      totalsSuppressed,
      sheets: [totalExp.name, totalRev.name, ...VGC1_FUNCTIONS.map((fn) => fn.tab)],
    },
  };
}

function mapRawRecord(raw: Vgc1Raw): SpendingRecord | null {
  const amount = vgc1AmountToCents(raw.raw_value);
  if (amount === null) return null;
  const fiscalYear = raw.fiscal_year ?? VGC1_FISCAL_YEAR;
  const isBendigo = raw.council_name === BENDIGO_COUNCIL_NAME;
  const isBendigoTotal = isBendigo && raw.line_type === 'total' && fiscalYear === VGC1_FISCAL_YEAR;
  const reconciliationStatus =
    raw.reconciliation_status ??
    (isBendigoTotal ? 'reconciled_to_gpfs' : 'questionnaire_unaudited');
  const key = vgc1NaturalKey([
    fiscalYear,
    raw.council_name,
    raw.section,
    raw.line_type,
    raw.function_code,
    raw.nature,
    raw.line_code,
    raw.sheet,
    raw.column_index,
  ]);

  const measure =
    raw.line_type === 'function_nature'
      ? 'expense_function_nature'
      : raw.line_type === 'function_total'
        ? `${raw.section}_function_total`
        : raw.line_type === 'functions_subtotal'
          ? `${raw.section}_functions_subtotal`
          : raw.line_type === 'other'
            ? `${raw.section}_other`
            : `total_${raw.section === 'expense' ? 'expenditure' : 'revenue'}`;

  const note = [
    `Source: VLGGC VGC1 ${fiscalYear} Expenditure and Revenue questionnaire (${raw.sheet}, row ${raw.row}, column ${raw.column_index})`,
    `Official landing page: ${VGC1_LANDING_URL}`,
    `Official resource: ${raw.resource_url}`,
    `Retrieved from: ${raw.retrieval_url}`,
    `Workbook SHA-256: ${raw.source_sha256}`,
    `Unit: whole ${VGC1_UNIT} (cells carry cents) converted at ${VGC1_UNIT_TO_CENTS} cents per dollar; unit is explicit, never inferred from magnitude`,
    `Printed line: ${raw.line_label} (code ${raw.line_code})`,
    raw.nature ? `Expense nature: ${raw.nature}` : '',
    raw.function_name
      ? `VLGGC function: ${raw.function_name} (${raw.function_code}); this is a VLGGC questionnaire function, not a COFOG function, so no COFOG function_code is set`
      : '',
    `Attribution: ${VGC1_ATTRIBUTION}. Conditions of Use: "${VGC1_CONDITIONS_OF_USE}" This is attribution/permission, NOT a CC licence; the workbook is not redistributed.`,
    'Council-supplied VLGGC questionnaire, unaudited; provisional/local_government; verified=false',
    reconciliationStatus === 'reconciled_to_gpfs'
      ? `Reconciliation: City of Greater Bendigo total ${raw.section} reconciles to its audited ${fiscalYear} GPFS at the printed $1,000 rounding (VGC whole AUD vs GPFS $'000); reconciliation_status=reconciled_to_gpfs`
      : 'Reconciliation: questionnaire_unaudited; no GPFS reconciliation for this row',
    'NON-ADDITIVE: function totals, the five expense natures, printed bridges and totals are separate printed cuts and are never summed together; no cross-council total; never mixed with vic-budget, ABS GFS, LGPRF, waste or NSW council rows',
  ]
    .filter(Boolean)
    .join('; ');

  return {
    amount_cents: amount.cents,
    measure_type: 'actual',
    fiscal_year: fiscalYear,
    source_id: VGC1_ID,
    source_url: VGC1_LANDING_URL,
    verified: false,
    natural_key: key,
    jurisdiction_level: 'local',
    jurisdiction: 'VIC',
    delivery_entity: raw.council_name,
    funding_source: 'Victorian local government',
    source_dataset: `VLGGC Annual Questionnaire VGC1 — Expenditure and Revenue ${fiscalYear}`,
    source_date: raw.source_date,
    data_quality_flag: VGC1_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    project_name: `${raw.council_name} — ${raw.line_label}`,
    description: `VLGGC VGC1 ${fiscalYear} ${raw.section} — ${raw.line_label}`,
    location: { state: 'VIC', lga_name: raw.council_name },
    statement: 'income',
    reconciliation_status: reconciliationStatus,
    vlgc_section: raw.section,
    vlgc_measure: measure,
    ...(raw.function_name ? { vlgc_function: raw.function_name } : {}),
    ...(raw.function_code ? { vlgc_function_code: raw.function_code } : {}),
    ...(raw.nature ? { vlgc_nature: raw.nature } : {}),
    vlgc_line_code: raw.line_code,
    vlgc_council_label: raw.council_label,
    vlgc_unit: VGC1_UNIT,
    vlgc_printed_sign: amount.printed_sign,
    notes: note,
  };
}

/** Pure transform: raw cells -> SpendingRecord[], de-duplicated on natural_key. */
export function transformVgc1Raw(raw: readonly RawRecord[]): Vgc1TransformResult {
  const records: SpendingRecord[] = [];
  const skipped: Vgc1Skip[] = [];
  const keys = new Set<string>();
  let duplicates = 0;
  for (const entry of raw) {
    if (entry.kind !== 'expense' && entry.kind !== 'revenue' && entry.kind !== 'expense_nature') {
      skipped.push({
        sheet: String(entry.sheet ?? 'unknown'),
        row: typeof entry.row === 'number' ? entry.row : null,
        reason: `unknown raw kind ${String(entry.kind)}`,
      });
      continue;
    }
    const record = mapRawRecord(entry as Vgc1Raw);
    if (!record) {
      skipped.push({
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

/**
 * Premise falsifier gate. Requires exactly 79 distinct council entities, no
 * cross-council Totals entity, and the exact Bendigo VGC1 totals. A failure
 * means the pilot premise is false and no rows should be published.
 */
export function assertVgc1Premise(records: readonly SpendingRecord[]): void {
  const councils = new Set(records.map((record) => record.delivery_entity).filter(Boolean));
  if (councils.size !== 79) {
    throw new Error(`VGC1 premise falsified: ${councils.size} council entities, expected 79`);
  }
  for (const name of councils) {
    if (/^totals?$/i.test(String(name))) {
      throw new Error(`VGC1 premise falsified: source Totals entity "${name}" was emitted`);
    }
  }
  const find = (measure: string): SpendingRecord | undefined =>
    records.find(
      (record) =>
        record.delivery_entity === BENDIGO_COUNCIL_NAME && record.vlgc_measure === measure,
    );
  const expenses = find('total_expenditure');
  const revenue = find('total_revenue');
  if (!expenses || expenses.amount_cents !== BENDIGO_GPFS.expenses_cents) {
    throw new Error(
      `VGC1 premise falsified: Bendigo total expenditure ${String(
        expenses?.amount_cents,
      )} cents, expected ${BENDIGO_GPFS.expenses_cents}`,
    );
  }
  if (!revenue || revenue.amount_cents !== BENDIGO_GPFS.revenue_cents) {
    throw new Error(
      `VGC1 premise falsified: Bendigo total revenue ${String(
        revenue?.amount_cents,
      )} cents, expected ${BENDIGO_GPFS.revenue_cents}`,
    );
  }
}

/** Read the workbook with ExcelJS (847 KB, 41 sheets; a full load is safe). */
export async function readVgc1Workbook(filePath: string): Promise<Vgc1WorkbookRows> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheets: Vgc1WorkbookRows['sheets'] = [];
  for (const worksheet of workbook.worksheets) {
    const rows: Vgc1WorkbookRows['sheets'][number]['rows'] = [];
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

export interface Vgc1ArchiveManifest {
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
  reconciliation: {
    council: string;
    vgc_expenses_cents: number;
    vgc_revenue_cents: number;
    gpfs_expenses_thousand: number;
    gpfs_revenue_thousand: number;
    expenses_rounding_cents: number;
    revenue_rounding_cents: number;
    status: string;
  };
  notes: string;
}

/**
 * Discover, archive, SHA-256 verify, read and parse the 2024-25 VGC1 workbook.
 * Archive bytes stay outside the repo; the repo only gets the metadata manifest.
 */
export async function loadVgc1Source(
  options: Vgc1ConnectorOptions = {},
): Promise<Vgc1LoadedSource> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const readWorkbook = options.readWorkbook ?? readVgc1Workbook;
  const selection = options.selection ?? (await discoverVgc1Source(fetchImpl));
  const warnings: string[] = [];

  let data: Uint8Array | undefined = options.sourceBytes;
  if (!data && options.sourcePath) data = await readFile(options.sourcePath);

  const archive = await archiveSourceDocument({
    source_id: VGC1_ID,
    title: 'VLGGC 2024-25 VGC1 Expenditure and Revenue questionnaire',
    original_url: selection.resource_url,
    retrieved_from: selection.retrieval_url,
    archived_from: 'wayback',
    filename: '2024-25-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx',
    content_type: inferContentType('2024-25-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx'),
    fetchImpl,
    ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
    ...(data ? { data } : {}),
    notes: `Official VLGGC landing page: ${selection.landing_url}. Wayback snapshot ${selection.snapshot_timestamp}. Attribution/permission, not CC BY; bytes archived outside the repo and never redistributed.`,
  });

  if (archive.sha256 !== selection.expected_sha256) {
    throw new Error(
      `VGC1 workbook SHA-256 ${archive.sha256} does not match the verified ${selection.expected_sha256}`,
    );
  }
  if (archive.bytes !== VGC1_EXPECTED_BYTES) {
    throw new Error(`VGC1 workbook is ${archive.bytes} bytes, expected ${VGC1_EXPECTED_BYTES}`);
  }

  const workbook = await readWorkbook(archive.local_path);
  const meta: Vgc1SourceMeta = {
    landing_url: selection.landing_url,
    resource_url: selection.resource_url,
    retrieval_url: selection.retrieval_url,
    source_url: selection.landing_url,
    source_sha256: archive.sha256,
    source_date: selection.source_date,
  };
  const parsed = parseVgc1Workbook(workbook, meta);
  const transformed = transformVgc1Raw(parsed.raw);
  assertVgc1Premise(transformed.records);

  if (transformed.duplicates > 0) {
    warnings.push(`${transformed.duplicates} duplicate natural key(s) de-duplicated`);
  }
  const suppressed = parsed.summary.totalsSuppressed;
  if (suppressed === 0) {
    throw new Error('VGC1 Totals row was not found; refusing to publish without suppression proof');
  }
  warnings.push(
    `councils=${parsed.summary.councilCount}; totals_rows_suppressed=${suppressed}; ` +
      `records=${transformed.records.length}; Bendigo expenditure/revenue reconciled to GPFS`,
  );

  return {
    raw: parsed.raw,
    records: transformed.records,
    archive,
    skipped: [...parsed.skipped, ...transformed.skipped],
    warnings,
    summary: parsed.summary,
    selection,
  };
}

/** Build the committed metadata-only manifest (no bytes). */
export function vgc1ManifestFromLoaded(loaded: Vgc1LoadedSource): Vgc1ArchiveManifest {
  const gpfsExpensesCents = BENDIGO_GPFS.gpfs_expenses_thousand * 1000 * 100;
  const gpfsRevenueCents = BENDIGO_GPFS.gpfs_revenue_thousand * 1000 * 100;
  return {
    dataset: VGC1_DATASET,
    fiscal_year: VGC1_FISCAL_YEAR,
    source_url: VGC1_LANDING_URL,
    resource_url: VGC1_RESOURCE_URL,
    retrieved_from: loaded.selection.retrieval_url,
    snapshot_timestamp: loaded.selection.snapshot_timestamp,
    license: VGC1_LICENSE,
    attribution: VGC1_ATTRIBUTION,
    conditions_of_use: VGC1_CONDITIONS_OF_USE,
    disclaimer: VGC1_DISCLAIMER,
    caveat: VGC1_CAVEAT,
    retrieved_at: new Date().toISOString(),
    unit: 'whole AUD (x100 cents); cells carry cents',
    sha256: loaded.archive.sha256,
    bytes: loaded.archive.bytes,
    council_count: loaded.summary.councilCount,
    totals_suppressed: loaded.summary.totalsSuppressed,
    rows: loaded.records.length,
    reconciliation: {
      council: BENDIGO_COUNCIL_NAME,
      vgc_expenses_cents: BENDIGO_GPFS.expenses_cents,
      vgc_revenue_cents: BENDIGO_GPFS.revenue_cents,
      gpfs_expenses_thousand: BENDIGO_GPFS.gpfs_expenses_thousand,
      gpfs_revenue_thousand: BENDIGO_GPFS.gpfs_revenue_thousand,
      expenses_rounding_cents: BENDIGO_GPFS.expenses_cents - gpfsExpensesCents,
      revenue_rounding_cents: BENDIGO_GPFS.revenue_cents - gpfsRevenueCents,
      status:
        'VGC1 whole-AUD totals reconcile to the audited GPFS $1,000 rounding (expenses -4 cents, revenue +17 cents); non-total categories remain questionnaire/unaudited',
    },
    notes:
      'Derived rows only; the workbook is not redistributed. The source Totals row is suppressed and no cross-council total is emitted. Every row is non-additive agency detail, provisional/local_government and verified=false. VGC1 function/nature dimensions are not COFOG.',
  };
}

/** Build the connector; `fetch` discovers, archives, hashes, reads and parses the workbook. */
export function createVgc1Connector(options: Vgc1ConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: VGC1_ID,
    name: VGC1_NAME,
    publisher: VGC1_PUBLISHER,
    source_url: VGC1_LANDING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: VGC1_LICENSE,
    notes: `${VGC1_CAVEAT} ${VGC1_ATTRIBUTION}. Conditions of Use: "${VGC1_CONDITIONS_OF_USE}" This is attribution/permission, NOT a CC licence; derived rows only and the workbook is not redistributed. Whole AUD converted explicitly to cents at x${VGC1_UNIT_TO_CENTS}. The source Totals row is suppressed; no cross-council total.`,
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const loaded = await loadVgc1Source(options);
      metadata.warnings = loaded.warnings;
      return loaded.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformVgc1Raw(raw);
      assertVgc1Premise(result.records);
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
