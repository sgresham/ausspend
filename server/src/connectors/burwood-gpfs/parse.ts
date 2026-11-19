import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import {
  detectMoneyUnit,
  extractArchivedPdf,
  moneyToCents,
  parseAmountCell,
  type MoneyUnitKind,
  type PdfExtraction,
  type PdfPage,
  type PdfTextItem,
  type UnitDetection,
} from '../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import type { Connector, RawRecord } from '../types.js';
import { BURWOOD_GPFS_LINES, type BurwoodGpfsLineSpec } from './config.js';
import {
  BURWOOD_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  BURWOOD_GPFS_DATA_QUALITY_FLAG,
  BURWOOD_GPFS_DELIVERY_ENTITY,
  BURWOOD_GPFS_DOCUMENT_PIN,
  BURWOOD_GPFS_FISCAL_YEAR,
  BURWOOD_GPFS_ID,
  BURWOOD_GPFS_LICENSE,
  BURWOOD_GPFS_NAME,
  BURWOOD_GPFS_PUBLISHER,
  BURWOOD_GPFS_REPORTING_URL,
  BURWOOD_GPFS_REQUEST_HEADERS,
  BURWOOD_GPFS_SOURCE_DATASET,
  BURWOOD_GPFS_STANDALONE_FS_BYTES,
  BURWOOD_GPFS_STANDALONE_FS_PAGES,
  BURWOOD_GPFS_STANDALONE_FS_SHA256,
} from './meta.js';

/**
 * NSW council GPFS adapter: Burwood Council's FY2025-26 General Purpose
 * Financial Statements (year ended 30 June 2026), the current audited GPFS
 * presented to the ordinary Council Meeting on 27 October 2026.
 *
 * The council's main site is behind Akamai bot protection, but the official
 * consultation host `participate.burwood.nsw.gov.au` publishes the current
 * audited Annual Financial Statements in its Document Library. The exact
 * official upload is pinned and fetched through the browser helper
 * (`scripts/burwood-gpfs-browser.ts`); the connector archives and SHA-256
 * verifies the exact bytes. The PDF embeds the independent Auditor-General
 * report (PDF page 68) with an unmodified opinion. The newest combined annual
 * report on the council site is still FY2024-25 and is summary-only, so no
 * narrative annual report is substituted.
 *
 * The printed unit is `$ '000`. Nothing is emitted unless the Income Statement,
 * B1-1 "Total functions and activities", Statement of Comprehensive Income,
 * Statement of Financial Position, Statement of Changes in Equity and Statement
 * of Cash Flows reconcile exactly at zero tolerance.
 *
 * The face Income Statement does not print a "Total expenses" line. Total
 * expenses is the documented bridge of the printed expenses-excluding-
 * depreciation line ($59,755 thousand) plus the printed depreciation,
 * amortisation and impairment line ($10,654 thousand), giving $70,409 thousand.
 * The B1-1 expense total equals that bridge exactly. Burwood prints a nil net
 * gain from the disposal of assets as a revenue component and a net loss from
 * the disposal of assets ($2,640 thousand) as an expense component. Other
 * comprehensive income has a single printed component: the IPPE revaluation
 * gain ($21,728 thousand).
 *
 * The Income Statement PDF lays its printed text out in overlapping text runs,
 * so the adapter reads the actual-2026/actual-2025 columns from their printed
 * x-positions rather than relying on the raw content-stream order. This keeps
 * every value tied to the printed label and rejects any ambiguous layout.
 *
 * Every row is non-additive `agency_detail` with no region/LGA allocation, so it
 * can never be summed into another council, a council total, state spending, the
 * PNFC benchmark or the OLG summary layer.
 */
export interface BurwoodGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  listing_url?: string;
  resolved_url?: string;
}

export interface BurwoodGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface BurwoodGpfsParseContext {
  document: BurwoodGpfsDocument;
  archive: BurwoodGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface BurwoodGpfsRejection {
  section: string;
  reason: string;
}

export interface BurwoodGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
  carrying_amount: number;
}

export interface BurwoodGpfsReconciliation {
  fiscal_year: string;
  unit: MoneyUnitKind;
  unit_evidence: string;
  income_statement_page: number;
  functions_page: number;
  comprehensive_income_page: number;
  financial_position_page: number;
  changes_in_equity_page: number;
  cash_flows_page: number;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  materials_and_services: number;
  borrowing_costs: number;
  other_expenses: number;
  depreciation_amortisation_impairment: number;
  government_grants_operating: number;
  government_grants_capital: number;
  net_gain_from_disposal_of_assets: number;
  net_loss_from_disposal_of_assets: number;
  net_result: number;
  net_result_before_capital_grants: number;
  operating_result_excluding_depreciation: number;
  printed_total_expenses_excluding_depreciation: number;
  functions_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  functions_carrying_amount: number;
  comprehensive_income_net_result: number;
  comprehensive_other_income: number;
  comprehensive_total: number;
  comprehensive_revaluation: number;
  comprehensive_attributable_council: number;
  cash_and_cash_equivalents: number;
  prior_year_cash_and_cash_equivalents: number;
  total_current_assets: number;
  total_non_current_assets: number;
  total_assets: number;
  total_current_liabilities: number;
  total_non_current_liabilities: number;
  total_liabilities: number;
  net_assets: number;
  accumulated_surplus: number;
  ippe_revaluation_surplus: number;
  total_equity: number;
  equity_opening_accumulated: number;
  equity_opening_ippe: number;
  equity_opening_total: number;
  equity_closing_accumulated: number;
  equity_closing_ippe: number;
  equity_closing_total: number;
  cash_operating: number;
  cash_investing: number;
  cash_financing: number;
  cash_net_change: number;
  cash_opening: number;
  cash_closing: number;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface BurwoodGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: BurwoodGpfsReconciliation | null;
  warnings: string[];
  rejections: BurwoodGpfsRejection[];
}

const NOTE_REFERENCE = /\b[A-Z]\d+(?:-\d+)?[a-z]?\b/g;
// A printed dash (en/em dash or hyphen) is a printed nil.
const MONEY_TOKEN = /(?:\(\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\))?|[–—-]/g;
const PRINTED_NIL = /^[–—-]$/;

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(NOTE_REFERENCE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function amountsAfter(text: string, label: string): number[] {
  const index = text.indexOf(label);
  if (index < 0) return [];
  const rest = text.slice(index + label.length);
  const matches = rest.match(MONEY_TOKEN) ?? [];
  return matches
    .map((token) => (PRINTED_NIL.test(token) ? 0 : (parseAmountCell(token)?.value ?? null)))
    .filter((value): value is number => value !== null);
}

function firstAmountAfter(text: string, label: string): number | null {
  return amountsAfter(text, label)[0] ?? null;
}

function findPage(
  pages: readonly PdfPage[],
  predicate: (page: PdfPage, text: string) => boolean,
): PdfPage | null {
  for (const page of pages) {
    if (predicate(page, canonicalPageText(page))) return page;
  }
  return null;
}

interface PositionedItem {
  str: string;
  x: number;
}

interface PositionedRow {
  y: number;
  items: PositionedItem[];
}

/**
 * Group the PDF text runs into visual rows (top to bottom) and deduplicate
 * overlapping runs at the same x-position. The Burwood PDF draws some text
 * twice and emits truncated duplicates; keeping the longest run at each
 * x-position reconstructs the printed line without changing any value.
 */
function groupPositionedRows(items: readonly PdfTextItem[], tolerance = 3): PositionedRow[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PositionedRow[] = [];
  for (const item of sorted) {
    if (!item.str.trim()) continue;
    const row = rows[rows.length - 1];
    if (row && Math.abs(row.y - item.y) <= tolerance) {
      row.items.push({ str: item.str, x: item.x });
    } else {
      rows.push({ y: item.y, items: [{ str: item.str, x: item.x }] });
    }
  }
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    const kept: PositionedItem[] = [];
    for (const item of row.items) {
      const duplicate = kept.find((entry) => Math.abs(entry.x - item.x) <= 2);
      if (duplicate) {
        if (item.str.length > duplicate.str.length) duplicate.str = item.str;
      } else {
        kept.push({ str: item.str, x: item.x });
      }
    }
    row.items = kept;
  }
  return rows;
}

/** Reconstruct printed line order from the spatial text runs. */
export function canonicalPageText(page: PdfPage): string {
  if (page.items.length === 0) return page.text;
  return groupPositionedRows(page.items)
    .map((row) => row.items.map((item) => item.str).join(' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface IncomeRow {
  label: string;
  current: number | null;
  prior: number | null;
}

function moneyToken(text: string): number | null {
  const trimmed = text.trim();
  if (PRINTED_NIL.test(trimmed)) return 0;
  return parseAmountCell(trimmed)?.value ?? null;
}

/**
 * Read the printed Income Statement columns positionally: actual-2026 values
 * sit around x=443 and actual-2025 around x=513, while the original budget
 * column is at x<=100. Labels continue across rows, so the value row is matched
 * by the accumulated printed label rather than by content-stream order.
 */
function incomeRows(page: PdfPage): IncomeRow[] {
  if (page.items.length === 0) {
    throw new Error(
      `p${page.page_number}: Income Statement has no positioned text items; refusing to guess row order`,
    );
  }
  return groupPositionedRows(page.items).map((row) => {
    const labelParts: string[] = [];
    let current: number | null = null;
    let prior: number | null = null;
    for (const item of row.items) {
      const text = item.str.trim();
      if (!text) continue;
      if (item.x >= 420 && item.x < 495) {
        const value = moneyToken(text);
        if (value !== null) {
          current = value;
          continue;
        }
      }
      if (item.x >= 500 && item.x < 580) {
        const value = moneyToken(text);
        if (value !== null) {
          prior = value;
          continue;
        }
      }
      // The original unaudited budget column is not ingested.
      if (item.x < 115) continue;
      if (item.x < 420) {
        const cleaned = normalizeText(text);
        if (cleaned) labelParts.push(cleaned);
      }
    }
    return {
      label: labelParts.join(' ').replace(/\s+/g, ' ').trim(),
      current,
      prior,
    };
  });
}

function readIncomeRow(
  rows: readonly IncomeRow[],
  label: string,
): { current: number; prior: number | null } | null {
  const target = normalizeText(label);
  let buffer = '';
  for (const row of rows) {
    if (row.label) buffer = `${buffer} ${row.label}`.replace(/\s+/g, ' ').trim();
    if (buffer.includes(target) && row.current !== null) {
      return { current: row.current, prior: row.prior };
    }
  }
  return null;
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectBurwoodGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectBurwoodGpfsUnit([canonicalPageText(page)]);
  if (!unit.kind || unit.ambiguous) {
    throw new Error(
      `${section} p${page.page_number}: no unambiguous printed currency unit (${unit.reason}); refusing to guess`,
    );
  }
  return { kind: unit.kind, reason: unit.reason };
}

/**
 * Parse a fiscal year from a printed label or filename. Only explicit
 * conventions are accepted: "year ended 30 June YYYY", a full YYYY-YYYY range,
 * or an explicit "financial statements 2026" filename. A bare unrelated year is
 * never guessed.
 */
export function fiscalYearFromBurwoodFinancialStatementsDoc(text: string): string | null {
  const june = /year\s+ended\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
    text.replace(/[-_]+/g, ' ').replace(/\s+/g, ' '),
  );
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  const normalized = text
    .replace(/[_]+/g, '-')
    .replace(/\bto\b/gi, '-')
    .replace(/\s*[-/]+\s*/g, '-')
    .replace(/\s+/g, ' ');
  const full = [...normalized.matchAll(/((?:19|20)\d{2})-((?:19|20)?\d{2})/g)];
  const fullMatch = full[full.length - 1];
  if (fullMatch) {
    const startYear = Number(fullMatch[1]);
    const endRaw = fullMatch[2]!;
    const end =
      endRaw.length === 2 ? Math.floor(startYear / 100) * 100 + Number(endRaw) : Number(endRaw);
    if (end !== startYear + 1) return null;
    return `${startYear}-${String(end).slice(-2)}`;
  }
  const statements = /(?:annual[-_ ]financial[-_ ]statements?|financial[-_ ]statements?)[-_ ]((?:19|20)\d{2})\b/i.exec(
    normalized,
  );
  if (statements) {
    const end = Number(statements[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  return null;
}

/** The documented official pin used when live discovery is unavailable. */
export function burwoodPinnedDocument(): BurwoodGpfsDocument {
  return {
    id: `annual-financial-statements-${BURWOOD_GPFS_FISCAL_YEAR}`,
    title: 'Burwood Council Annual Financial Statements for the year ended 30 June 2026',
    url: BURWOOD_GPFS_DOCUMENT_PIN,
    fiscal_year: BURWOOD_GPFS_FISCAL_YEAR,
    listing_url: BURWOOD_GPFS_REPORTING_URL,
  };
}

/**
 * Return the documented official FY2025-26 audited GPFS. The council's main
 * site is WAF-blocked to plain clients, so there is no plain-text discovery
 * index to parse; the exact official upload is recorded on the consultation
 * page and pinned here. A different requested year never falls back to the pin.
 */
export function discoverBurwoodGpfsDocument(
  fiscalYear: string = BURWOOD_GPFS_FISCAL_YEAR,
): BurwoodGpfsDocument {
  if (fiscalYear !== BURWOOD_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No pinned Burwood Council annual financial statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return burwoodPinnedDocument();
}

/**
 * Parse the B1-1 "Total functions and activities" row. It prints ten numbers
 * (Income 2026/2025, Expenses 2026/2025, Operating result 2026/2025, Grants
 * 2026/2025, Carrying amount 2026/2025); the 2026 values are at even indices.
 */
export function parseBurwoodGpfsFunctionsTotals(
  page: PdfPage,
): BurwoodGpfsFunctionsTotals | null {
  const text = normalizeText(canonicalPageText(page));
  const label = 'Total functions and activities';
  if (!text.includes(label)) return null;
  const values = amountsAfter(text, label);
  if (values.length < 10) {
    throw new Error(
      `p${page.page_number}: B1-1 total row has ${values.length} numeric values, expected at least 10`,
    );
  }
  return {
    page_number: page.page_number,
    income: values[0]!,
    expenses: values[2]!,
    operating_result: values[4]!,
    grants_and_contributions: values[6]!,
    carrying_amount: values[8]!,
  };
}

function gpfsFundingSource(spec: BurwoodGpfsLineSpec): string {
  if (spec.potential_double_count) return 'Government grants and contributions';
  if (spec.key === 'total_revenue')
    return 'Council total revenue (own-source plus government grants and contributions)';
  if (spec.key === 'total_expenses' || spec.key === 'total_expenses_excluding_depreciation')
    return 'Council expenditure';
  if (spec.key === 'net_gain_from_disposal_of_assets')
    return 'Proceeds and gains from asset disposals';
  if (spec.key === 'net_loss_from_disposal_of_assets')
    return 'Losses on asset disposals';
  if (spec.section === 'revenue') return 'Council own-source revenue';
  if (spec.section === 'expenses') return 'Council expenditure';
  return 'Council result';
}

function gpfsUnitLabel(unit: MoneyUnitKind): string {
  switch (unit) {
    case 'dollars':
      return 'AUD_dollars';
    case 'thousands':
      return 'AUD_thousands';
    case 'millions':
      return 'AUD_millions';
    case 'billions':
      return 'AUD_billions';
  }
}

function notesFor(
  context: BurwoodGpfsParseContext,
  spec: BurwoodGpfsLineSpec,
  unit: MoneyUnitKind,
  unitReason: string,
  pageNumber: number,
  reconciliationNote: string,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document.title}`,
    `document_url: ${context.document.url}`,
    context.document.resolved_url
      ? `document_resolved_url: ${context.document.resolved_url}`
      : null,
    context.document.listing_url ? `listing_page: ${context.document.listing_url}` : null,
    context.reporting_url ? `reporting_url: ${context.reporting_url}` : null,
    `statement: ${spec.statement}`,
    `page: ${pageNumber}`,
    `printed_label: ${spec.label}`,
    `unit: ${unit} (explicit; ${unitReason})`,
    `reconciliation: ${reconciliationNote}`,
    'provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + document + line + fiscal year. */
export function burwoodGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = BURWOOD_GPFS_FISCAL_YEAR,
): string {
  return `${BURWOOD_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: { spec: BurwoodGpfsLineSpec; value: number; page_number: number },
  context: BurwoodGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: BURWOOD_GPFS_FISCAL_YEAR,
    source_id: BURWOOD_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: burwoodGpfsNaturalKey(
      context.document.url,
      spec.key,
      BURWOOD_GPFS_FISCAL_YEAR,
    ),
    project_name: `Burwood Council GPFS 2025-26 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: BURWOOD_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: BURWOOD_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: BURWOOD_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    extraction_confidence: 'high',
    gpfs_line_item: spec.key,
    gpfs_line_label: spec.label,
    gpfs_unit: gpfsUnitLabel(unit),
    gpfs_section: spec.section,
    gpfs_statement: spec.statement,
    ...(printedSign === 'negative' ? { gpfs_printed_sign: printedSign } : {}),
    ...(spec.component_of ? { gpfs_component_of: spec.component_of } : {}),
    ...(spec.potential_double_count ? { potential_double_count: true } : {}),
    notes: notesFor(context, spec, unit, unitReason, line.page_number, reconciliationNote),
  };
}

function rejectWith(warnings: string[], reason: string): BurwoodGpfsParseResult {
  warnings.push(reason);
  return {
    records: [],
    reconciliation: null,
    warnings,
    rejections: [{ section: 'gpfs', reason }],
  };
}

/**
 * Parse the standalone FY2025-26 audited GPFS into validated, non-additive
 * measure rows. Nothing is emitted unless the printed unit is explicit and every
 * face-statement, B1-1, comprehensive-income, financial-position, equity and
 * cash-flow reconciliation check passes exactly.
 */
export function parseBurwoodGpfsExtraction(
  extraction: PdfExtraction,
  context: BurwoodGpfsParseContext,
): BurwoodGpfsParseResult {
  const warnings: string[] = [];

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Net operating result for the year'),
  );
  if (!incomePage) {
    return rejectWith(warnings, 'audited income statement page not found; no rows ingested');
  }
  const functionsPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Total functions and activities') && text.includes('Functions or activities'),
  );
  if (!functionsPage) {
    return rejectWith(
      warnings,
      'B1-1 Total functions and activities page not found; no rows ingested',
    );
  }
  const comprehensivePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Comprehensive Income') && text.includes('from Income Statement'),
  );
  if (!comprehensivePage) {
    return rejectWith(
      warnings,
      'Statement of Comprehensive Income page not found; no independent printed net-result check',
    );
  }
  const positionPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Financial Position') &&
      text.includes('Total assets') &&
      text.includes('Net assets'),
  );
  if (!positionPage) {
    return rejectWith(
      warnings,
      'Statement of Financial Position page not found; no balance-sheet reconciliation',
    );
  }
  const equityPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Changes in Equity') &&
      text.includes('Opening balance at 1 July') &&
      text.includes('Closing balance at 30 June'),
  );
  if (!equityPage) {
    return rejectWith(
      warnings,
      'Statement of Changes in Equity page not found; no equity reconciliation',
    );
  }
  const cashPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Cash Flows') &&
      text.includes('Net change in cash and cash equivalents') &&
      text.includes('Net cash flows from operating activities'),
  );
  if (!cashPage) {
    return rejectWith(warnings, 'Statement of Cash Flows page not found; no cash reconciliation');
  }

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let comprehensiveUnit: PrintedUnit;
  let positionUnit: PrintedUnit;
  let cashUnit: PrintedUnit;
  let functionsTotals: BurwoodGpfsFunctionsTotals | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    comprehensiveUnit = requirePrintedUnit(comprehensivePage, 'Statement of Comprehensive Income');
    positionUnit = requirePrintedUnit(positionPage, 'Statement of Financial Position');
    cashUnit = requirePrintedUnit(cashPage, 'Statement of Cash Flows');
    functionsTotals = parseBurwoodGpfsFunctionsTotals(functionsPage);
  } catch (error) {
    return rejectWith(warnings, error instanceof Error ? error.message : String(error));
  }
  const units = [
    incomeUnit.kind,
    functionsUnit.kind,
    comprehensiveUnit.kind,
    positionUnit.kind,
    cashUnit.kind,
  ];
  if (units.some((kind) => kind !== units[0])) {
    return rejectWith(
      warnings,
      `printed units disagree: income ${units[0]}, B1-1 ${units[1]}, comprehensive ${units[2]}, position ${units[3]}, cash ${units[4]}; refusing to mix`,
    );
  }
  if (!functionsTotals) {
    return rejectWith(
      warnings,
      'B1-1 Total functions and activities row not found; no rows ingested',
    );
  }
  const unit = incomeUnit.kind;

  const errors: string[] = [];
  const values: Array<{ spec: BurwoodGpfsLineSpec; value: number; page_number: number }> = [];
  let incomeStructure: IncomeRow[];
  try {
    incomeStructure = incomeRows(incomePage);
  } catch (error) {
    return rejectWith(warnings, error instanceof Error ? error.message : String(error));
  }
  for (const spec of BURWOOD_GPFS_LINES) {
    if (spec.key === 'total_expenses') continue;
    const row = readIncomeRow(incomeStructure, spec.label);
    if (!row) {
      errors.push(`p${incomePage.page_number}: could not read printed value for "${spec.label}"`);
      continue;
    }
    values.push({ spec, value: row.current, page_number: incomePage.page_number });
  }
  if (errors.length > 0) return rejectWith(warnings, errors.join('; '));

  const valueByKey = (key: string): number | null =>
    values.find((entry) => entry.spec.key === key)?.value ?? null;

  const totalRevenue = valueByKey('total_revenue');
  const rates = valueByKey('rates_and_annual_charges');
  const userCharges = valueByKey('user_charges_and_fees');
  const otherRevenue = valueByKey('other_revenues');
  const grantsOperating = valueByKey('government_grants_operating');
  const grantsCapital = valueByKey('government_grants_capital');
  const interest = valueByKey('interest_and_investment_income');
  const otherIncome = valueByKey('other_income');
  const netGainDisposal = valueByKey('net_gain_from_disposal_of_assets');
  const employee = valueByKey('employee_expenses');
  const materials = valueByKey('materials_and_services');
  const borrowing = valueByKey('borrowing_costs');
  const otherExpenses = valueByKey('other_expenses');
  const netLossDisposal = valueByKey('net_loss_from_disposal_of_assets');
  const netResult = valueByKey('net_result');
  const expensesExDepreciation = valueByKey('total_expenses_excluding_depreciation');
  const depreciation = valueByKey('depreciation_amortisation_impairment');
  const operatingResultExcludingDepreciation = readIncomeRow(
    incomeStructure,
    'Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets',
  )?.current ?? null;
  const netResultBeforeCapital = readIncomeRow(
    incomeStructure,
    'Net operating result for the year before grants and contributions provided for capital purposes',
  )?.current ?? null;

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['rates_and_annual_charges', rates],
    ['user_charges_and_fees', userCharges],
    ['other_revenues', otherRevenue],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['interest_and_investment_income', interest],
    ['other_income', otherIncome],
    ['net_gain_from_disposal_of_assets', netGainDisposal],
    ['employee_expenses', employee],
    ['materials_and_services', materials],
    ['borrowing_costs', borrowing],
    ['other_expenses', otherExpenses],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['net_result', netResult],
    ['total_expenses_excluding_depreciation', expensesExDepreciation],
    ['depreciation_amortisation_impairment', depreciation],
    ['operating_result_excluding_depreciation', operatingResultExcludingDepreciation],
    ['net_result_before_capital_grants', netResultBeforeCapital],
  ];
  const missing = required.filter(([, value]) => value === null).map(([key]) => key);
  if (missing.length > 0) {
    return rejectWith(
      warnings,
      `could not read printed line(s): ${missing.join(', ')}; no rows ingested`,
    );
  }

  const revenueComponentsSum =
    rates! +
    userCharges! +
    otherRevenue! +
    grantsOperating! +
    grantsCapital! +
    interest! +
    otherIncome! +
    netGainDisposal!;
  const expenseComponentsSum =
    employee! + materials! + borrowing! + otherExpenses! + netLossDisposal!;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = faceExpenseBridge;

  const totalExpensesLine: BurwoodGpfsLineSpec = BURWOOD_GPFS_LINES.find(
    (line) => line.key === 'total_expenses',
  )!;
  values.push({
    spec: totalExpensesLine,
    value: totalExpenses,
    page_number: incomePage.page_number,
  });

  const comprehensiveText = normalizeText(canonicalPageText(comprehensivePage));
  const comprehensiveNetResult = firstAmountAfter(comprehensiveText, 'from Income Statement');
  const comprehensiveOtherIncome = firstAmountAfter(
    comprehensiveText,
    'Total other comprehensive income/loss for the year',
  );
  const comprehensiveTotal = firstAmountAfter(
    comprehensiveText,
    'Total comprehensive income/loss for the year attributable to Council',
  );
  const comprehensiveRevaluation = firstAmountAfter(
    comprehensiveText,
    'Gain on revaluation of infrastructure, property, plant and equipment',
  );
  if (comprehensiveNetResult === null) {
    return rejectWith(
      warnings,
      `p${comprehensivePage.page_number}: could not read the printed comprehensive-income net result; no rows ingested`,
    );
  }
  if (comprehensiveOtherIncome === null || comprehensiveTotal === null) {
    return rejectWith(
      warnings,
      `p${comprehensivePage.page_number}: could not read the printed other/total comprehensive income; no rows ingested`,
    );
  }
  if (comprehensiveRevaluation === null) {
    return rejectWith(
      warnings,
      `p${comprehensivePage.page_number}: could not read the printed revaluation component; no rows ingested`,
    );
  }

  const positionText = normalizeText(canonicalPageText(positionPage));
  const cashAmounts = amountsAfter(positionText, 'Cash and cash equivalents');
  const cashAndCashEquivalents = cashAmounts[0] ?? null;
  const priorYearCashAndCashEquivalents = cashAmounts[1] ?? null;
  const totalCurrentAssets = firstAmountAfter(positionText, 'Total current assets');
  const totalNonCurrentAssets = firstAmountAfter(positionText, 'Total non-current assets');
  const totalAssets = firstAmountAfter(positionText, 'Total assets');
  const totalCurrentLiabilities = firstAmountAfter(positionText, 'Total current liabilities');
  const totalNonCurrentLiabilities = firstAmountAfter(
    positionText,
    'Total non-current liabilities',
  );
  const totalLiabilities = firstAmountAfter(positionText, 'Total liabilities');
  const netAssets = firstAmountAfter(positionText, 'Net assets');
  const accumulatedSurplus = firstAmountAfter(positionText, 'Accumulated surplus');
  const ippeRevaluationSurplus = firstAmountAfter(positionText, 'IPPE revaluation surplus');
  const totalEquity = firstAmountAfter(positionText, 'Total equity');

  const balanceRequired: Array<[string, number | null]> = [
    ['cash_and_cash_equivalents', cashAndCashEquivalents],
    ['prior_year_cash_and_cash_equivalents', priorYearCashAndCashEquivalents],
    ['total_current_assets', totalCurrentAssets],
    ['total_non_current_assets', totalNonCurrentAssets],
    ['total_assets', totalAssets],
    ['total_current_liabilities', totalCurrentLiabilities],
    ['total_non_current_liabilities', totalNonCurrentLiabilities],
    ['total_liabilities', totalLiabilities],
    ['net_assets', netAssets],
    ['accumulated_surplus', accumulatedSurplus],
    ['ippe_revaluation_surplus', ippeRevaluationSurplus],
    ['total_equity', totalEquity],
  ];
  const missingBalance = balanceRequired.filter(([, value]) => value === null).map(([key]) => key);
  if (missingBalance.length > 0) {
    return rejectWith(
      warnings,
      `could not read printed Statement of Financial Position line(s): ${missingBalance.join(', ')}; no rows ingested`,
    );
  }

  const equityText = normalizeText(canonicalPageText(equityPage));
  const equityOpening = amountsAfter(equityText, 'Opening balance at 1 July');
  const equityClosing = amountsAfter(equityText, 'Closing balance at 30 June');
  if (equityOpening.length < 6 || equityClosing.length < 6) {
    return rejectWith(
      warnings,
      `p${equityPage.page_number}: could not read opening/closing equity balances; no rows ingested`,
    );
  }
  const equityOpeningAccumulated = equityOpening[0]!;
  const equityOpeningIppe = equityOpening[1]!;
  const equityOpeningTotal = equityOpening[2]!;
  const equityClosingAccumulated = equityClosing[0]!;
  const equityClosingIppe = equityClosing[1]!;
  const equityClosingTotal = equityClosing[2]!;

  const cashText = normalizeText(canonicalPageText(cashPage));
  const cashOperating = firstAmountAfter(cashText, 'Net cash flows from operating activities');
  const cashInvesting = firstAmountAfter(cashText, 'Net cash flows from investing activities');
  const cashFinancing = firstAmountAfter(cashText, 'Net cash flows from financing activities');
  const cashNetChange = firstAmountAfter(cashText, 'Net change in cash and cash equivalents');
  const cashClosing = firstAmountAfter(
    cashText,
    'Cash and cash equivalents at end of year',
  );
  if (
    cashOperating === null ||
    cashInvesting === null ||
    cashFinancing === null ||
    cashNetChange === null ||
    cashClosing === null
  ) {
    return rejectWith(
      warnings,
      `p${cashPage.page_number}: could not read the printed cash-flow subtotals; no rows ingested`,
    );
  }
  // Burwood does not print an opening-cash line on the face statement; derive
  // it from the printed closing balance minus the printed net change and
  // require it to equal the prior-year cash on the Statement of Financial
  // Position.
  const cashOpening = cashClosing - cashNetChange;

  const checks: string[] = [];
  const check = (label: string, expected: number, actual: number): void => {
    if (expected !== actual) {
      checks.push(`${label}: printed/derived ${actual} != expected ${expected}`);
    }
  };
  check(
    'income statement revenue components = printed total revenue',
    totalRevenue!,
    revenueComponentsSum,
  );
  check(
    'expense components = printed total expenses excluding depreciation',
    expensesExDepreciation!,
    expenseComponentsSum,
  );
  check(
    'printed total expenses excluding depreciation + printed depreciation = total expenses bridge',
    totalExpenses,
    faceExpenseBridge,
  );
  check(
    'printed total income - printed expenses excluding depreciation = printed operating result excluding depreciation',
    operatingResultExcludingDepreciation!,
    totalRevenue! - expensesExDepreciation!,
  );
  check(
    'printed total income - total expenses bridge = printed net result',
    netResult!,
    totalRevenue! - totalExpenses,
  );
  check(
    'printed net result - capital grants = printed net result before capital grants',
    netResultBeforeCapital!,
    netResult! - grantsCapital!,
  );
  check('B1-1 expenses = face total expenses bridge', totalExpenses, functionsTotals.expenses);
  check(
    'B1-1 income (which includes grants) = face total revenue',
    totalRevenue!,
    functionsTotals.income,
  );
  check(
    'B1-1 income - B1-1 expenses = B1-1 operating result',
    functionsTotals.operating_result,
    functionsTotals.income - functionsTotals.expenses,
  );
  check('B1-1 operating result = printed net result', netResult!, functionsTotals.operating_result);
  check(
    'B1-1 grants and contributions = operating grants + capital grants',
    grantsOperating! + grantsCapital!,
    functionsTotals.grants_and_contributions,
  );
  check(
    'B1-1 carrying amount = printed total assets',
    totalAssets!,
    functionsTotals.carrying_amount,
  );
  check(
    'Statement of Comprehensive Income net result = Income Statement net result',
    netResult!,
    comprehensiveNetResult!,
  );
  check(
    'printed revaluation component = printed other comprehensive income',
    comprehensiveOtherIncome!,
    comprehensiveRevaluation!,
  );
  check(
    'printed net result + printed other comprehensive income = printed total comprehensive income',
    comprehensiveTotal!,
    netResult! + comprehensiveOtherIncome!,
  );
  check(
    'current assets + non-current assets = total assets',
    totalAssets!,
    totalCurrentAssets! + totalNonCurrentAssets!,
  );
  check(
    'current liabilities + non-current liabilities = total liabilities',
    totalLiabilities!,
    totalCurrentLiabilities! + totalNonCurrentLiabilities!,
  );
  check(
    'total assets - total liabilities = net assets',
    netAssets!,
    totalAssets! - totalLiabilities!,
  );
  check(
    'accumulated surplus + IPPE revaluation surplus = total equity',
    totalEquity!,
    accumulatedSurplus! + ippeRevaluationSurplus!,
  );
  check('net assets = total equity', totalEquity!, netAssets!);
  check(
    'opening equity total + total comprehensive income = closing equity total',
    equityClosingTotal,
    equityOpeningTotal + comprehensiveTotal!,
  );
  check(
    'opening accumulated surplus + net result = closing accumulated surplus',
    equityClosingAccumulated,
    equityOpeningAccumulated + netResult!,
  );
  check(
    'opening IPPE revaluation surplus + revaluation = closing IPPE revaluation surplus',
    equityClosingIppe,
    equityOpeningIppe + comprehensiveRevaluation!,
  );
  check('closing equity total = SoFP total equity', totalEquity!, equityClosingTotal);
  check(
    'equity opening accumulated + IPPE = opening total',
    equityOpeningTotal,
    equityOpeningAccumulated + equityOpeningIppe,
  );
  check(
    'equity closing accumulated + IPPE = closing total',
    equityClosingTotal,
    equityClosingAccumulated + equityClosingIppe,
  );
  check(
    'equity closing accumulated = SoFP accumulated surplus',
    accumulatedSurplus!,
    equityClosingAccumulated,
  );
  check(
    'equity closing IPPE = SoFP IPPE revaluation surplus',
    ippeRevaluationSurplus!,
    equityClosingIppe,
  );
  check(
    'cash operating + investing + financing = net change in cash',
    cashNetChange!,
    cashOperating! + cashInvesting! + cashFinancing!,
  );
  check(
    'closing cash - net change = prior-year cash on the SoFP (opening cash bridge)',
    priorYearCashAndCashEquivalents!,
    cashClosing! - cashNetChange!,
  );
  check('closing cash = SoFP cash and cash equivalents', cashAndCashEquivalents!, cashClosing!);
  if (checks.length > 0) {
    return rejectWith(
      warnings,
      `GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`,
    );
  }

  const reconciliation: BurwoodGpfsReconciliation = {
    fiscal_year: BURWOOD_GPFS_FISCAL_YEAR,
    unit,
    unit_evidence: incomeUnit.reason,
    income_statement_page: incomePage.page_number,
    functions_page: functionsPage.page_number,
    comprehensive_income_page: comprehensivePage.page_number,
    financial_position_page: positionPage.page_number,
    changes_in_equity_page: equityPage.page_number,
    cash_flows_page: cashPage.page_number,
    total_revenue: totalRevenue!,
    total_expenses: totalExpenses,
    employee_expenses: employee!,
    materials_and_services: materials!,
    borrowing_costs: borrowing!,
    other_expenses: otherExpenses!,
    depreciation_amortisation_impairment: depreciation!,
    government_grants_operating: grantsOperating!,
    government_grants_capital: grantsCapital!,
    net_gain_from_disposal_of_assets: netGainDisposal!,
    net_loss_from_disposal_of_assets: netLossDisposal!,
    net_result: netResult!,
    net_result_before_capital_grants: netResultBeforeCapital!,
    operating_result_excluding_depreciation: operatingResultExcludingDepreciation!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    functions_income: functionsTotals.income,
    functions_total_expenses: functionsTotals.expenses,
    functions_operating_result: functionsTotals.operating_result,
    functions_grants_and_contributions: functionsTotals.grants_and_contributions,
    functions_carrying_amount: functionsTotals.carrying_amount,
    comprehensive_income_net_result: comprehensiveNetResult!,
    comprehensive_other_income: comprehensiveOtherIncome!,
    comprehensive_total: comprehensiveTotal!,
    comprehensive_revaluation: comprehensiveRevaluation!,
    comprehensive_attributable_council: comprehensiveTotal!,
    cash_and_cash_equivalents: cashAndCashEquivalents!,
    prior_year_cash_and_cash_equivalents: priorYearCashAndCashEquivalents!,
    total_current_assets: totalCurrentAssets!,
    total_non_current_assets: totalNonCurrentAssets!,
    total_assets: totalAssets!,
    total_current_liabilities: totalCurrentLiabilities!,
    total_non_current_liabilities: totalNonCurrentLiabilities!,
    total_liabilities: totalLiabilities!,
    net_assets: netAssets!,
    accumulated_surplus: accumulatedSurplus!,
    ippe_revaluation_surplus: ippeRevaluationSurplus!,
    total_equity: totalEquity!,
    equity_opening_accumulated: equityOpeningAccumulated,
    equity_opening_ippe: equityOpeningIppe,
    equity_opening_total: equityOpeningTotal,
    equity_closing_accumulated: equityClosingAccumulated,
    equity_closing_ippe: equityClosingIppe,
    equity_closing_total: equityClosingTotal,
    cash_operating: cashOperating!,
    cash_investing: cashInvesting!,
    cash_financing: cashFinancing!,
    cash_net_change: cashNetChange!,
    cash_opening: cashOpening,
    cash_closing: cashClosing!,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'all printed face-statement line sums equal their printed subtotals/total',
      'printed expenses excluding depreciation + printed depreciation/amortisation/impairment = total expenses bridge',
      'printed total income - total expenses bridge = printed net result',
      'B1-1 expense total equals the face expense bridge',
      'B1-1 income (which includes grants and contributions) equals the face total income',
      'B1-1 income - B1-1 expenses = B1-1 operating result = printed net result',
      'B1-1 grants equal operating grants + capital grants, and carrying amount equals total assets',
      'Statement of Comprehensive Income net result equals the Income Statement net result',
      'the printed revaluation component equals printed other comprehensive income',
      'printed net result + printed other comprehensive income equals printed total comprehensive income',
      'Statement of Financial Position subtotals (assets, liabilities, net assets, accumulated surplus plus IPPE revaluation surplus) reconcile exactly',
      'Statement of Changes in Equity opening + total comprehensive income = closing, equal to SoFP equity, and opening accumulated surplus + net result equals closing accumulated surplus',
      'Statement of Cash Flows operating + investing + financing = net change, closing - net change equals the prior-year SoFP cash, and closing cash reconciles to the SoFP',
      'the printed net result is stored with a magnitude and a negative sign marker only when printed negative; the before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the documented bridge of the printed expenses-excluding-depreciation line (59,755) plus the printed depreciation/amortisation/impairment line (10,654) = 70,409, equal to the printed B1-1 expense total; the printed nil net gain from the disposal of assets is a zero revenue component and the printed net loss from the disposal of assets (2,640) is an expense component, and both are emitted; B1-1 income (89,251) includes grants and contributions (operating 4,277 + capital 15,821 = 20,098) and equals the face total income; B1-1 income minus B1-1 expenses equals the printed operating result and net result (18,842); the net result plus other comprehensive income (single revaluation component 21,728) equals total comprehensive income attributable to Council (40,570); the printed before-capital result (3,021) is retained in reconciliation evidence only; the balance sheet (accumulated surplus 302,006 plus IPPE revaluation surplus 366,392 = total equity 668,398) and cash-flow statement (closing 10,615 minus the net change 1,454 = prior-year cash 9,161) reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections: [] };
}

export interface BurwoodGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path uses the documented official pin. */
  document?: BurwoodGpfsDocument;
  /** Pre-fetched PDF bytes from the browser path. */
  pdfBytes?: Uint8Array;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf(?:\.aspx)?$/i.test(name)) {
      return name.replace(/[^A-Za-z0-9._-]+/g, '-');
    }
  } catch {
    // Fall through to the stable name.
  }
  return 'burwood-council-annual-financial-statements-2026.pdf';
}

/** Build the live Burwood Council GPFS connector. */
export function createBurwoodGpfsConnector(
  options: BurwoodGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: BURWOOD_GPFS_ID,
    name: BURWOOD_GPFS_NAME,
    publisher: BURWOOD_GPFS_PUBLISHER,
    source_url: BURWOOD_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BURWOOD_GPFS_LICENSE,
    notes:
      "NSW council GPFS adapter: one council only (Burwood Council), FY2025-26 General Purpose Financial Statements (year ended 30 June 2026) from the official audited Annual Financial Statements PDF published on the council's official consultation/exhibition host. The council's main site is Akamai/WAF-blocked to plain clients, so the exact official upload is fetched through headless Chromium and the connector archives and SHA-256 verifies those bytes. The PDF embeds the independent Auditor-General report (PDF page 68) with an unmodified opinion and was presented to the 27 October 2026 Council meeting. The newest combined annual report on the council site is still FY2024-25 and is summary-only, so no narrative annual report is substituted. Parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Burwood prints a nil net gain from the disposal of assets as a revenue component and a net loss from the disposal of assets as an expense component; total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation/amortisation/impairment, equal to the printed B1-1 expense total; other comprehensive income is the single IPPE revaluation gain. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered = options.document ?? discoverBurwoodGpfsDocument();
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: BURWOOD_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Burwood Council GPFS fetch HTTP ${response.status} for ${discovered.url}; run scripts/burwood-gpfs-browser.ts and pass the returned bytes`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: BurwoodGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: BURWOOD_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Burwood Council FY2025-26 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: BurwoodGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: BURWOOD_GPFS_REPORTING_URL,
      };
      const parsed = parseBurwoodGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'burwood-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'burwood-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Burwood Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}

export {
  BURWOOD_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  BURWOOD_GPFS_DATA_QUALITY_FLAG,
  BURWOOD_GPFS_DELIVERY_ENTITY,
  BURWOOD_GPFS_DOCUMENT_PIN,
  BURWOOD_GPFS_FISCAL_YEAR,
  BURWOOD_GPFS_ID,
  BURWOOD_GPFS_LICENSE,
  BURWOOD_GPFS_LINES,
  BURWOOD_GPFS_NAME,
  BURWOOD_GPFS_PUBLISHER,
  BURWOOD_GPFS_REPORTING_URL,
  BURWOOD_GPFS_REQUEST_HEADERS,
  BURWOOD_GPFS_SOURCE_DATASET,
  BURWOOD_GPFS_STANDALONE_FS_BYTES,
  BURWOOD_GPFS_STANDALONE_FS_PAGES,
  BURWOOD_GPFS_STANDALONE_FS_SHA256,
  type BurwoodGpfsLineSpec,
};
