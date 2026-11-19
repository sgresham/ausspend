import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import {
  detectMoneyUnit,
  extractArchivedPdf,
  parseAmountCell,
  type ExtractionConfidence,
  type PdfExtraction,
  type PdfPage,
  type PdfTextItem,
  type UnitDetection,
} from '../../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../../source-archive.js';
import { DeferredSocDocumentModel } from '../../../models/index.js';
import type { Connector, RawRecord } from '../../types.js';

/**
 * WA SOC — Western Power annual-report adapter.
 *
 * This is the third WA Government Trading Enterprise (GTE) pilot and reuses the
 * WA Water Corporation/Synergy SOC pattern: one entity, one audited face
 * statement, no jurisdiction total. Western Power is Electricity Networks
 * Corporation trading as Western Power, a WA GTE under the Electricity
 * Corporations Act 2005 (WA), not a Queensland GOC or an NSW SOC.
 *
 * Source gate:
 * - The latest report is discovered from Western Power's official annual-report
 *   page. That page embeds the PDF URLs in JSON (`"url":"/4a8589/..."`), so
 *   discovery reads both href and embedded-`url` links; no PDF URL is
 *   hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The Statement of comprehensive income prints an explicit "$M" unit. A table
 *   read as dollars or thousands is rejected, not converted by magnitude.
 * - The statement prints Total income, Total expense, Net finance costs, Profit
 *   before income tax equivalent expense, Income tax equivalent expense and
 *   Profit for the reporting year. The adapter requires the printed income and
 *   expense components to sum exactly to those totals and every printed result
 *   bridge to agree at zero tolerance. A one-million-dollar mismatch defers the
 *   whole document.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Western
 * Power rows are never added to government program spending, the PNFC
 * benchmark, Water Corporation, Synergy, another WA GTE, a QLD/NSW SOC, a WA
 * total, or each other.
 */

export const WESTERN_POWER_ID = 'wa-western-power';
export const WESTERN_POWER_NAME = 'Western Power — Annual Report';
export const WESTERN_POWER_PUBLISHER = 'Western Power (Electricity Networks Corporation)';
export const WESTERN_POWER_ENTITY = 'Western Power';
export const WESTERN_POWER_JURISDICTION = 'WA';
export const WESTERN_POWER_LEGAL_CLASS =
  'WA Government Trading Enterprise (GTE) — Electricity Corporations Act 2005 (WA)';
/** Canonical official annual-report page. The PDF URLs are discovered from it. */
export const WESTERN_POWER_SOURCE_URL =
  'https://www.westernpower.com.au/about/reports-publications/annual-report/';
export const WESTERN_POWER_LICENSE =
  '© Western Power. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const WESTERN_POWER_UNIT = 'AUD_millions';
export const WESTERN_POWER_UNIT_LABEL = '$M';
export const WESTERN_POWER_UNIT_TO_CENTS = 100_000_000;
export const WESTERN_POWER_CAVEAT =
  'Entity-level SOC statement lines for Western Power only (Electricity Networks Corporation, a WA Government Trading Enterprise under the Electricity Corporations Act 2005 (WA)). Never add to government program spending, to the PNFC sector benchmark, to Water Corporation, to Synergy, to another WA GTE, to a QLD/NSW SOC, a WA or national total, or to each other: total revenue is the printed Total income line; total expenses is the printed Total expense line; employee related expenses and depreciation/amortisation are printed components of total expense; the net result is the printed Profit for the reporting year. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface WesternPowerAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

const ANNUAL_REPORT_MARKER = /annual[\s_\-–]*report/i;
const NON_ANNUAL_REPORT =
  /factsheet|fact[\s_\-–]*sheet|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|corporate[\s_\-–]*plan/i;

function fiscalYearEnding(yearRaw: string): string | null {
  const end = Number(yearRaw);
  if (!Number.isInteger(end) || end < 2001 || end > 2100) return null;
  const start = end - 1;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

/**
 * Convert a Western Power annual-report filename to the API fiscal year. The
 * reports are named by the year ended (e.g. 2026-annual-report.pdf), so a bare
 * 20xx year is the financial year ending that year.
 */
export function westernPowerFiscalYearFromFilename(filename: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(filename) || NON_ANNUAL_REPORT.test(filename)) return null;
  const year = /(?:^|[^0-9])(20\d{2})(?!\d)/.exec(filename)?.[1];
  return year ? fiscalYearEnding(year) : null;
}

/** Convert "year ended 30 June 2026" into the API fiscal year "2025-26". */
export function fiscalYearFromEndDate(endDate: string): string | null {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(endDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function unescapeHtmlEntities(html: string): string {
  return html
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Parse annual-report PDF links from the official page. The page embeds the PDF
 * URLs in JSON (`"url":"/4a8589/..."`) as well as ordinary anchors; unescape the
 * HTML entities first, then read both forms. A link is accepted only when its
 * filename contains "Annual Report" and a year; factsheets, corporate plans and
 * Statements of Corporate Intent are rejected by name.
 */
export function parseWesternPowerAnnualReportPdfLinks(
  html: string,
  pageUrl: string = WESTERN_POWER_SOURCE_URL,
): WesternPowerAnnualReportLink[] {
  const text = unescapeHtmlEntities(html);
  const candidates = new Set<string>();
  for (const match of text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    if (match[1]) candidates.add(match[1]);
  }
  for (const match of text.matchAll(/"url"\s*:\s*"([^"]+)"/gi)) {
    if (match[1]) candidates.add(match[1]);
  }
  const links: WesternPowerAnnualReportLink[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    if (!/\.pdf(?:$|[?#])/i.test(raw)) continue;
    let url: URL;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    const filename = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    const fiscalYear = westernPowerFiscalYearFromFilename(filename);
    if (!fiscalYear) continue;
    const key = `${url.origin}${url.pathname}${url.search}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [start, end] = fiscalYear.split('-');
    links.push({
      url: key,
      filename,
      fiscal_year: fiscalYear,
      title: `Annual Report ${start}–${end}`,
      discovery_page: pageUrl,
    });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/**
 * Fetch the official annual-report page and return its newest annual-report
 * PDF. No PDF URL is hard-coded; a page with no annual-report link is an error.
 */
export async function discoverWesternPowerAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = WESTERN_POWER_SOURCE_URL,
): Promise<WesternPowerAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (error) {
    throw new Error(
      `Western Power annual-report page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Western Power annual-report page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parseWesternPowerAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Western Power annual-report page contains no annual-report PDF link; refusing to hard-code a URL',
    );
  }
  return latest;
}

interface PageRow {
  y: number;
  items: PdfTextItem[];
  cells: string[];
}

function groupPageRows(items: readonly PdfTextItem[], tolerance = 4.5): PageRow[] {
  const groups: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.y - item.y) <= tolerance) last.items.push(item);
    else groups.push({ y: item.y, items: [item] });
  }
  return groups
    .map((group) => {
      const rowItems = [...group.items].sort((a, b) => a.x - b.x);
      const cells = rowItems.map((item) => item.str.replace(/\s+/g, ' ').trim()).filter(Boolean);
      return { y: group.y, items: rowItems, cells };
    })
    .filter((row) => row.cells.length > 0);
}

/** Label text is everything left of the note-reference column (x < 300). */
function labelOf(row: PageRow): string {
  return row.items
    .filter((item) => item.x < 300)
    .map((item) => item.str.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function isMoneyItem(item: PdfTextItem): boolean {
  const text = item.str.trim();
  return /^(?:-|–|—)$/.test(text) || parseAmountCell(text).value !== null;
}

/** Money cells sit right of the note-reference column (x >= 430). */
function moneyItems(row: PageRow): PdfTextItem[] {
  return row.items.filter((item) => item.x >= 430 && isMoneyItem(item));
}

interface LogicalRow {
  label: string;
  items: PdfTextItem[];
}

function logicalRows(rows: readonly PageRow[]): LogicalRow[] {
  const out: LogicalRow[] = [];
  for (const row of rows) {
    const label = labelOf(row);
    const money = moneyItems(row);
    if (label && money.length > 0) out.push({ label, items: money });
  }
  return out;
}

function columnAnchor(rows: readonly LogicalRow[], label: string): number | null {
  const row = rows.find((entry) => entry.label.toLowerCase() === label.toLowerCase());
  if (!row) return null;
  const edges: number[] = [];
  for (const item of row.items) {
    const parsed = parseAmountCell(item.str);
    if (parsed.value === null || Math.abs(parsed.value) < 1000) continue;
    edges.push(item.x + item.width);
  }
  edges.sort((a, b) => a - b);
  return edges[0] ?? null;
}

interface CellValue {
  value: number | null;
  found: boolean;
  nil: boolean;
}

function cellNear(row: LogicalRow, anchor: number, tolerance = 18): CellValue {
  let best: { value: number | null; distance: number; nil: boolean } | null = null;
  for (const item of row.items) {
    const text = item.str.trim();
    const nil = /^(?:-|–|—)$/.test(text);
    const parsed = parseAmountCell(text);
    if (parsed.value === null && !nil) continue;
    const distance = Math.abs(item.x + item.width - anchor);
    if (distance > tolerance) continue;
    const candidate = { value: parsed.value, distance, nil };
    if (!best || distance < best.distance) best = candidate;
  }
  if (!best) return { value: null, found: false, nil: false };
  return { value: best.nil ? 0 : best.value, found: true, nil: best.nil };
}

function rowValue(rows: readonly LogicalRow[], label: string, anchor: number): CellValue {
  const wanted = label.toLowerCase();
  const row =
    rows.find((entry) => entry.label.toLowerCase() === wanted) ??
    rows.find((entry) => entry.label.toLowerCase().startsWith(wanted));
  return row ? cellNear(row, anchor) : { value: null, found: false, nil: false };
}

function unitSamples(rows: readonly PageRow[]): string[] {
  return rows
    .filter((row) => row.cells.some((cell) => cell.includes('$')))
    .map((row) => row.cells.join(' '));
}

export function detectWesternPowerUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface WesternPowerStatement {
  page_number: number;
  unit: UnitDetection;
  revenue_rendering_services: number;
  other_income: number;
  total_income: number;
  materials_services: number;
  employee_expenses: number;
  depreciation_amortisation: number;
  other_expenses: number;
  total_expense: number;
  net_finance_costs: number;
  profit_before_tax: number;
  income_tax: number;
  net_result: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findFaceStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('statement of comprehensive income') &&
      text.includes('revenue from rendering of services') &&
      text.includes('total income') &&
      text.includes('total expense') &&
      text.includes('profit for the reporting year')
    ) {
      return page;
    }
  }
  return null;
}

export function parseWesternPowerStatement(
  facePage: PdfPage,
): WesternPowerStatement | null {
  const rawRows = groupPageRows(facePage.items);
  const rows = logicalRows(rawRows);
  const unit = detectMoneyUnit(unitSamples(rawRows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Revenue from rendering of services');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed revenue row',
    );
    return null;
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);

  const revenueRendering = read('Revenue from rendering of services');
  const otherIncome = read('Other income');
  const totalIncome = read('Total income');
  const materials = read('Materials and services');
  const employee = read('Employee related expenses');
  const depreciation = read('Depreciation and amortisation expenses');
  const otherExpenses = read('Other expenses');
  const totalExpense = read('Total expense');
  const netFinanceCosts = read('Net finance costs');
  const profitBeforeTax = read('Profit before income tax equivalent expense');
  const incomeTax = read('Income tax equivalent expense');
  const netResult = read('Profit for the reporting year, net of tax equivalent expense');

  const required: Array<[string, CellValue]> = [
    ['Revenue from rendering of services', revenueRendering],
    ['Other income', otherIncome],
    ['Total income', totalIncome],
    ['Materials and services', materials],
    ['Employee related expenses', employee],
    ['Depreciation and amortisation expenses', depreciation],
    ['Other expenses', otherExpenses],
    ['Total expense', totalExpense],
    ['Net finance costs', netFinanceCosts],
    ['Profit before income tax equivalent expense', profitBeforeTax],
    ['Income tax equivalent expense', incomeTax],
    ['Profit for the reporting year, net of tax equivalent expense', netResult],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const revenueValue = revenueRendering.value as number;
  const otherIncomeValue = otherIncome.value as number;
  const incomeValue = totalIncome.value as number;
  const materialsValue = Math.abs(materials.value as number);
  const employeeValue = Math.abs(employee.value as number);
  const depreciationValue = Math.abs(depreciation.value as number);
  const otherExpensesValue = Math.abs(otherExpenses.value as number);
  const expenseValue = Math.abs(totalExpense.value as number);
  const netFinanceValue = netFinanceCosts.value as number;
  const profitBeforeTaxValue = profitBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;

  const incomeComponents = [revenueValue, otherIncomeValue];
  const incomeSum = incomeComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `income components exact: ${incomeComponents.join(' + ')} = ${incomeSum} (printed Total income ${incomeValue})`,
  );
  if (incomeSum !== incomeValue) {
    errors.push(
      `income component total mismatch: ${incomeComponents.join(' + ')} = ${incomeSum}, printed Total income ${incomeValue}`,
    );
  }

  const expenseComponents = [
    materialsValue,
    employeeValue,
    depreciationValue,
    otherExpensesValue,
  ];
  const expenseSum = expenseComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `expense components exact: ${expenseComponents.join(' + ')} = ${expenseSum} (printed Total expense ${expenseValue})`,
  );
  if (expenseSum !== expenseValue) {
    errors.push(
      `expense component total mismatch: ${expenseComponents.join(' + ')} = ${expenseSum}, printed Total expense ${expenseValue}`,
    );
  }

  const profitBeforeTaxBridge = incomeValue - expenseValue + netFinanceValue;
  checks.push(
    `profit-before-tax bridge exact: ${incomeValue} - ${expenseValue} + ${netFinanceValue} = ${profitBeforeTaxBridge} (printed ${profitBeforeTaxValue})`,
  );
  if (profitBeforeTaxBridge !== profitBeforeTaxValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${incomeValue} - ${expenseValue} + ${netFinanceValue} = ${profitBeforeTaxBridge}, printed Profit before income tax equivalent expense ${profitBeforeTaxValue}`,
    );
  }

  const netBridge = profitBeforeTaxValue + taxValue;
  checks.push(
    `net-result bridge exact: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge} (printed ${netValue})`,
  );
  if (netBridge !== netValue) {
    errors.push(
      `net-result bridge mismatch: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge}, printed Profit for the reporting year ${netValue}`,
    );
  }

  warnings.push(
    "the Statement of comprehensive income prints an explicit $M unit and two reporting-year columns; the adapter reads the current 2025/26 column only. The printed income and expense components reconcile exactly to the printed subtotals and the profit-before-tax and net-result bridges agree at zero tolerance.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    revenue_rendering_services: revenueValue,
    other_income: otherIncomeValue,
    total_income: incomeValue,
    materials_services: materialsValue,
    employee_expenses: employeeValue,
    depreciation_amortisation: depreciationValue,
    other_expenses: otherExpensesValue,
    total_expense: expenseValue,
    net_finance_costs: netFinanceValue,
    profit_before_tax: profitBeforeTaxValue,
    income_tax: Math.abs(taxValue),
    net_result: netValue,
    checks,
    warnings,
    errors,
  };
}

export interface WesternPowerParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface WesternPowerDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation';
}

export interface WesternPowerLineSpec {
  line_item: string;
  label: string;
  amount_millions: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result';
  detail: string;
  printed_sign?: 'positive' | 'negative';
}

export interface WesternPowerParseResult {
  records: SpendingRecord[];
  deferral: WesternPowerDeferral | null;
  statement: WesternPowerStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function westernPowerNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${WESTERN_POWER_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(millions: number): number {
  const cents = Math.abs(millions) * WESTERN_POWER_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${millions} million exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: WesternPowerParseContext,
  spec: WesternPowerLineSpec,
  statement: WesternPowerStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${WESTERN_POWER_UNIT_LABEL} (${WESTERN_POWER_UNIT}; x${WESTERN_POWER_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current 2025/26 column only (prior column never added); entity-level SOC statement line; single Western Power entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Water Corporation, Synergy, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: WesternPowerLineSpec,
  context: WesternPowerParseContext,
  statement: WesternPowerStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_millions),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: WESTERN_POWER_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: westernPowerNaturalKey(
      WESTERN_POWER_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${WESTERN_POWER_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: WESTERN_POWER_JURISDICTION,
    delivery_entity: WESTERN_POWER_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Western Power Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: WESTERN_POWER_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: WESTERN_POWER_UNIT,
    soc_section: spec.section,
    soc_note: 'Statement of comprehensive income',
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
      revenue_millions: statement.total_income,
      total_expenses_millions: statement.total_expense,
      net_result_millions: statement.net_result,
      ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

export function parseWesternPowerExtraction(
  extraction: PdfExtraction,
  context: WesternPowerParseContext,
): WesternPowerParseResult {
  const warnings: string[] = [];
  const facePage = findFaceStatementPage(extraction.pages);
  if (!facePage) {
    return {
      records: [],
      deferral: {
        reason: 'no parseable statement of comprehensive income found in the PDF',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const statement = parseWesternPowerStatement(facePage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason:
          'statement of comprehensive income found but required printed lines could not be parsed',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [facePage.page_number],
    };
  }
  warnings.push(...statement.warnings);
  if (statement.unit.kind !== 'millions') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit millions (detected ${statement.unit.kind ?? 'none'}: ${statement.unit.reason}); refusing to ingest a $M statement as dollars or thousands`,
        phase: 'unit',
      },
      statement,
      checks: statement.checks,
      warnings,
      pages_used: [facePage.page_number],
    };
  }
  if (statement.errors.length > 0) {
    return {
      records: [],
      deferral: {
        reason: `statement reconciliation failed with zero tolerance: ${statement.errors.join('; ')}`,
        phase: 'reconciliation',
      },
      statement,
      checks: statement.checks,
      warnings,
      pages_used: [facePage.page_number],
    };
  }

  const endDate = /year ended 30 June (\d{4})/i.exec(extraction.text);
  const derivedFiscalYear = endDate ? fiscalYearFromEndDate(`${endDate[1]}-06-30`) : null;
  if (derivedFiscalYear && derivedFiscalYear !== context.fiscal_year) {
    return {
      records: [],
      deferral: {
        reason: `report period ${derivedFiscalYear} does not match discovered report year ${context.fiscal_year}`,
        phase: 'statement',
      },
      statement,
      checks: statement.checks,
      warnings,
      pages_used: [facePage.page_number],
    };
  }

  const lineSpecs: WesternPowerLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total income',
      amount_millions: statement.total_income,
      funding_source: WESTERN_POWER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total income line, which bridges exactly to Revenue from rendering of services + Other income. Entity-level income; never added to government program spending.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expense',
      amount_millions: statement.total_expense,
      funding_source: WESTERN_POWER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Total expense line, which bridges exactly to Materials and services + Employee related expenses + Depreciation and amortisation expenses + Other expenses.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee related expenses',
      amount_millions: statement.employee_expenses,
      funding_source: WESTERN_POWER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee related expenses line. A component of Total expense; recorded once as a component, never added on top of total expense.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation expenses',
      amount_millions: statement.depreciation_amortisation,
      funding_source: WESTERN_POWER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation and amortisation expenses line. A component of Total expense; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit for the reporting year',
      amount_millions: statement.net_result,
      funding_source: WESTERN_POWER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit for the reporting year, net of tax equivalent expense. A result line, not an expense component; never add to revenue or expenses. Current 2025/26 column only.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the current-year income and expense components reconcile exactly to the printed subtotals and every printed result bridge agrees at zero tolerance.',
  );
  return {
    records,
    deferral: null,
    statement,
    checks: statement.checks,
    warnings,
    pages_used: [facePage.page_number],
  };
}

export interface WesternPowerConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: WesternPowerAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'western-power-annual-report.pdf';
}

/**
 * Operator escape hatch: when `WA_WESTERN_POWER_ANNUAL_REPORT_URL` is set, it is
 * used as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): WesternPowerAnnualReportLink | null {
  const url = process.env.WA_WESTERN_POWER_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Western-Power-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = westernPowerFiscalYearFromFilename(filename) ?? '2025-26';
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: WESTERN_POWER_SOURCE_URL,
  };
}

async function recordDeferral(
  document: WesternPowerAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: WesternPowerDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: WESTERN_POWER_ID, document_url: document.url },
    {
      $set: {
        entity: WESTERN_POWER_ENTITY,
        jurisdiction: WESTERN_POWER_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Western Power SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Western Power connector. */
export function createWesternPowerConnector(
  options: WesternPowerConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: WESTERN_POWER_ID,
    name: WESTERN_POWER_NAME,
    publisher: WESTERN_POWER_PUBLISHER,
    source_url: WESTERN_POWER_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: WESTERN_POWER_LICENSE,
    notes:
      'WA SOC (third WA GTE pilot): Western Power only (Electricity Networks Corporation), a WA Government Trading Enterprise (Electricity Corporations Act 2005 (WA)). The latest annual report is discovered from the official annual-report page (the page embeds the PDF URLs in JSON; no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo. The Statement of comprehensive income prints an explicit $M unit and two reporting-year columns; the adapter reads the current 2025/26 column only. The printed income and expense components must sum exactly to the printed totals, and the profit-before-tax and net-result bridges must agree at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Western Power is never added to government program spending, the PNFC benchmark, Water Corporation, Synergy, another WA GTE, a QLD/NSW SOC, a WA total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverWesternPowerAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Western Power PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: WESTERN_POWER_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Western Power annual-report PDF; archived for auditable WA SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: WesternPowerParseContext = {
        document_url: document.url,
        document_title: document.title,
        fiscal_year: document.fiscal_year,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
        },
        source_date: now.toISOString().slice(0, 10),
      };
      const parsed = parseWesternPowerExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.deferral) {
        await recordDeferral(document, archived, parsed.deferral);
        metadata.errors.push(
          `deferred ${document.fiscal_year}: ${parsed.deferral.phase}: ${parsed.deferral.reason}`,
        );
        return [];
      }
      if (parsed.records.length === 0) {
        metadata.errors.push(`${document.fiscal_year}: no validated SOC rows extracted`);
      }
      return parsed.records.map((record) => ({ kind: 'wa-western-power-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'wa-western-power-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Western Power measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };

  return connector;
}
