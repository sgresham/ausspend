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
 * NSW SOC Phase 8 — Port Authority of NSW annual-report adapter.
 *
 * This reuses the established NSW SOC layer: one entity adapter, not a second
 * framework. Port Authority of NSW is the seventh NSW SOC entity after Sydney
 * Water, WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW
 * and Landcom.
 *
 * Source gate:
 * - The document is discovered from Port Authority of NSW's own annual-reports
 *   page (no PDF URL is hard-coded). The exact PDF bytes are SHA-256 archived
 *   outside the repo.
 * - The Statement of comprehensive income prints an explicit "$000" unit. A
 *   table read as dollars or millions is rejected, not converted by magnitude.
 *   One $'000 unit = 100,000 cents.
 * - Unlike Landcom/Essential Energy, this statement prints BOTH a Total revenue
 *   and a Total expenses subtotal. Both printed totals are accepted only when
 *   every printed bridge reconciles with zero tolerance: revenue lines sum to
 *   Total revenue, expense lines sum to Total expenses, the profit-before-tax
 *   bridge adds net gain on sale of PPE and other gains, and the net-result
 *   bridge deducts income tax equivalent expense. The Note 3 and Note 4 printed
 *   totals must also equal the face statement. A one-thousand-dollar mismatch
 *   defers the whole document.
 * - Port Authority of NSW does not separately disclose government
 *   grants/contributions in this statement or its notes, so no grants row is
 *   emitted. A grant line is never estimated or zero-filled.
 */

export const PORT_AUTHORITY_ID = 'port-authority-nsw';
export const PORT_AUTHORITY_NAME = 'Port Authority of NSW — Annual Report';
export const PORT_AUTHORITY_PUBLISHER = 'Port Authority of NSW';
export const PORT_AUTHORITY_ENTITY = 'Port Authority of NSW';
export const PORT_AUTHORITY_JURISDICTION = 'NSW';
export const PORT_AUTHORITY_SOURCE_URL =
  'https://www.portauthoritynsw.com.au/corporate/corporate-governance/port-authority-nsw-annual-reports/';
export const PORT_AUTHORITY_LICENSE =
  '© Port Authority of NSW. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const PORT_AUTHORITY_UNIT = 'AUD_thousands';
export const PORT_AUTHORITY_UNIT_LABEL = "$'000";
export const PORT_AUTHORITY_UNIT_TO_CENTS = 100_000;
export const PORT_AUTHORITY_CAVEAT =
  'Entity-level SOC statement lines for Port Authority of NSW only. Never add to government program spending, to the PNFC sector benchmark, or to each other: the statement prints an explicit Total revenue and Total expenses; total revenue already includes all revenue lines, total expenses already includes employee, depreciation/amortisation, other expenses and finance costs; the net result is a profit. No government grants/contributions are separately disclosed in this statement or its notes, so no grants row is emitted. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the URL; parse the page. */
export interface PortAuthorityAnnualReportLink {
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

const NON_ANNUAL_REPORT =
  /fraud|gipa|half[\s_\-–]*year|sustainability|pricing|access[\s_\-–]*undertaking|safety|ensms|performance|financial[\s_\-–]*statements|climate|reconciliation|corporate[\s_\-–]*intent|budget|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent/i;

/** Map a report year (year ended 30 June) to the API fiscal year "2024-25". */
export function portAuthorityFiscalYearFromReportYear(reportYear: number): string {
  return `${reportYear - 1}-${String(reportYear % 100).padStart(2, '0')}`;
}

function fiscalYearFromFilename(filename: string): string | null {
  // Explicit range such as "2024-25" or "2018-19" wins.
  const range = /(\d{4})\s*[-–]\s*(\d{2})(?!\d)/.exec(filename);
  if (range?.[1] && range[2]) {
    const start = Number(range[1]);
    const expectedEnd = String((start + 1) % 100).padStart(2, '0');
    if (range[2] !== expectedEnd) return null;
    return `${start}-${expectedEnd}`;
  }
  // A four-digit report/publication year (AR2023-24 is published in 2024).
  const four = [...filename.matchAll(/\b(20\d{2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year >= 2010 && year <= 2035);
  if (four.length > 0) {
    const reportYear = four[four.length - 1] as number;
    return portAuthorityFiscalYearFromReportYear(reportYear);
  }
  // Legacy short form such as "ar24" / "ar_18".
  const short = /(?:^|[_\-\s])ar[_\-\s]?(\d{2})(?:[_\-\s.]|$)/i.exec(filename);
  if (short?.[1]) {
    const reportYear = 2000 + Number(short[1]);
    if (reportYear >= 2010 && reportYear <= 2035) {
      return portAuthorityFiscalYearFromReportYear(reportYear);
    }
  }
  return null;
}

/**
 * Parse the annual-report PDF links on the official annual-reports page. Both
 * `Port Authority of NSW Annual Report 2024-25.pdf` and the legacy
 * `port-authority-annual-report-2021.pdf` / `pa_073_ar_20_wcag_v1.pdf` paths are
 * accepted; non-annual PDFs (statement of corporate intent, etc.) are rejected.
 * No URL is hard-coded.
 */
export function parsePortAuthorityAnnualReportPdfLinks(
  html: string,
  pageUrl: string = PORT_AUTHORITY_SOURCE_URL,
): PortAuthorityAnnualReportLink[] {
  const links: PortAuthorityAnnualReportLink[] = [];
  const seen = new Set<string>();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const raw = match[1];
    if (!raw || !/\.pdf(?:$|[?#])/i.test(raw)) continue;
    let url: URL;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    const filename = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    if (!filename || NON_ANNUAL_REPORT.test(filename)) continue;
    const looksAnnual = /annual|(?:^|[_\-\s])ar[_\-\s]?\d{2}/i.test(filename);
    if (!looksAnnual) continue;
    const fiscalYear = fiscalYearFromFilename(filename);
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

/** Fetch the official annual-reports page and return its latest report. */
export async function discoverPortAuthorityAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = PORT_AUTHORITY_SOURCE_URL,
): Promise<PortAuthorityAnnualReportLink> {
  const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(`Port Authority annual-reports page HTTP ${response.status} for ${pageUrl}`);
  }
  const html = await response.text();
  const links = parsePortAuthorityAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Port Authority annual-reports page contains no annual-report PDF link; refusing to hard-code a URL',
    );
  }
  return latest;
}

/** Convert "year ended 30 June 2025" into the API fiscal year "2024-25". */
export function fiscalYearFromEndDate(endDate: string): string | null {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(endDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

interface PageRow {
  y: number;
  items: PdfTextItem[];
  cells: string[];
}

function groupPageRows(items: readonly PdfTextItem[], tolerance = 3): PageRow[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const item of sorted) {
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

function labelOf(row: PageRow): string {
  return (row.cells[0] ?? '').replace(/\s+/g, ' ').trim();
}

function textOf(row: PageRow): string {
  return row.cells.join(' ').replace(/\s+/g, ' ').trim();
}

function rowAnchor(row: PageRow): number | null {
  const edges: number[] = [];
  for (const item of row.items) {
    const parsed = parseAmountCell(item.str);
    if (parsed.value === null) continue;
    // Anchors must be large enough not to be a note reference or a tiny residual.
    if (Math.abs(parsed.value) < 100) continue;
    edges.push(item.x + item.width);
  }
  edges.sort((a, b) => a - b);
  return edges[0] ?? null;
}

/** Anchor the current-year money column on the leftmost numeric cell of a printed row. */
function columnAnchor(rows: readonly PageRow[], label: string): number | null {
  const wanted = label.toLowerCase();
  const row =
    rows.find((entry) => labelOf(entry).toLowerCase() === wanted) ??
    rows.find((entry) => labelOf(entry).toLowerCase().startsWith(wanted)) ??
    null;
  return row ? rowAnchor(row) : null;
}

function valueNear(row: PageRow, anchor: number, tolerance = 16): number | null {
  let best: { value: number; distance: number } | null = null;
  for (const item of row.items) {
    const parsed = parseAmountCell(item.str);
    if (parsed.value === null) continue;
    const distance = Math.abs(item.x + item.width - anchor);
    if (distance > tolerance) continue;
    if (!best || distance < best.distance) best = { value: parsed.value, distance };
  }
  return best?.value ?? null;
}

function findRow(rows: readonly PageRow[], label: string): PageRow | null {
  const wanted = label.toLowerCase();
  return (
    rows.find((row) => labelOf(row).toLowerCase() === wanted) ??
    rows.find((row) => labelOf(row).toLowerCase().startsWith(wanted)) ??
    null
  );
}

function valueFor(rows: readonly PageRow[], label: string, anchor: number): number | null {
  const row = findRow(rows, label);
  return row ? valueNear(row, anchor) : null;
}

function valueForPattern(
  rows: readonly PageRow[],
  patterns: readonly RegExp[],
  anchor: number,
): number | null {
  for (const row of rows) {
    const label = labelOf(row);
    if (!patterns.some((pattern) => pattern.test(label))) continue;
    const value = valueNear(row, anchor);
    if (value !== null) return value;
  }
  return null;
}

const UNIT_TOKEN =
  /^(?:\$\s*['’‘]?0{3}|\$\s*(?:k|thousand|thousands|m|mn|million|millions|b|bn|billion|billions)|\$|['’‘]000|\$?\s*(?:k|thousand|thousands|m|mn|million|millions|b|bn|billion|billions))$/i;

/**
 * Only genuine unit-header cells are sampled. Prose such as "$196.9 million" in
 * a note's narrative must not flip an otherwise explicit "$000" table to
 * millions (which would make the unit look conflicting).
 */
function unitSamples(rows: readonly PageRow[]): string[] {
  const samples: string[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      if (UNIT_TOKEN.test(cell.trim())) samples.push(cell.trim());
    }
  }
  return samples;
}

/** Detect the printed unit from the statement header/unit rows. */
export function detectPortAuthorityUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

function thousands(value: number): number {
  return Math.round(value);
}

function thousandsLabel(value: number): string {
  return String(value);
}

export interface PortAuthorityStatement {
  page_number: number;
  unit: UnitDetection;
  revenue_port_management: number;
  investment_revenue: number;
  other_revenue: number;
  total_revenue: number;
  employee_expenses: number;
  depreciation_amortisation: number;
  other_expenses: number;
  finance_costs: number;
  total_expenses: number;
  net_gain_sale_ppe: number;
  other_gains: number;
  profit_before_tax: number;
  income_tax: number;
  net_result: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('statement of comprehensive income') &&
      text.includes('revenue from port management') &&
      text.includes('total expenses')
    ) {
      return page;
    }
  }
  return null;
}

export function parsePortAuthorityStatement(page: PdfPage): PortAuthorityStatement | null {
  const rows = groupPageRows(page.items);
  const titleRow = rows.find((row) => /statement of comprehensive income/i.test(textOf(row)));
  if (!titleRow) return null;

  const unit = detectMoneyUnit(unitSamples(rows));

  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Total revenue');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed Total revenue row',
    );
    return null;
  }
  if (unit.kind !== 'thousands') {
    errors.push(
      `printed unit is not explicit thousands ($'000) (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $'000 statement as dollars or millions`,
    );
  }

  const revenuePort = valueFor(rows, 'Revenue from port management', anchor);
  const investment = valueFor(rows, 'Investment revenue', anchor);
  const otherRevenue = valueFor(rows, 'Other revenue', anchor);
  const totalRevenue = valueFor(rows, 'Total revenue', anchor);
  const employee = valueFor(rows, 'Employee related expenses', anchor);
  const depreciation = valueFor(rows, 'Depreciation and amortisation expenses', anchor);
  const otherExpenses = valueFor(rows, 'Other expenses', anchor);
  const financeCosts = valueFor(rows, 'Finance costs', anchor);
  const totalExpenses = valueFor(rows, 'Total expenses', anchor);
  const netGainPpe = valueForPattern(
    rows,
    [/^net gain on sale of property, plant and equipment/i],
    anchor,
  );
  const otherGains = valueForPattern(rows, [/^other gains$/i], anchor);
  const pbt = valueForPattern(rows, [/^profit before income tax equivalent expense$/i], anchor);
  const tax = valueForPattern(rows, [/^income tax equivalent expense$/i], anchor);
  const netResult = valueForPattern(rows, [/^net profit after tax for the year$/i], anchor);

  const required: Array<[string, number | null]> = [
    ['Revenue from port management', revenuePort],
    ['Investment revenue', investment],
    ['Other revenue', otherRevenue],
    ['Total revenue', totalRevenue],
    ['Employee related expenses', employee],
    ['Depreciation and amortisation expenses', depreciation],
    ['Other expenses', otherExpenses],
    ['Finance costs', financeCosts],
    ['Total expenses', totalExpenses],
    ['Net gain on sale of property, plant and equipment (PPE)', netGainPpe],
    ['Other gains', otherGains],
    ['Profit before income tax equivalent expense', pbt],
    ['Income tax equivalent expense', tax],
    ['Net profit after tax for the year', netResult],
  ];
  const missing = required.filter(([, value]) => value === null).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return {
      page_number: page.page_number,
      unit,
      revenue_port_management: 0,
      investment_revenue: 0,
      other_revenue: 0,
      total_revenue: 0,
      employee_expenses: 0,
      depreciation_amortisation: 0,
      other_expenses: 0,
      finance_costs: 0,
      total_expenses: 0,
      net_gain_sale_ppe: 0,
      other_gains: 0,
      profit_before_tax: 0,
      income_tax: 0,
      net_result: 0,
      checks,
      warnings,
      errors,
    };
  }

  const t = (value: number): number => thousands(value);
  const magnitude = (value: number): number => Math.abs(thousands(value));

  const revenuePortValue = t(revenuePort as number);
  const investmentValue = t(investment as number);
  const otherRevenueValue = t(otherRevenue as number);
  const totalRevenueValue = t(totalRevenue as number);
  const employeeValue = magnitude(employee as number);
  const depreciationValue = magnitude(depreciation as number);
  const otherExpensesValue = magnitude(otherExpenses as number);
  const financeCostsValue = magnitude(financeCosts as number);
  const totalExpensesValue = magnitude(totalExpenses as number);
  const netGainValue = t(netGainPpe as number);
  const otherGainsValue = t(otherGains as number);
  const pbtValue = t(pbt as number);
  const taxValue = t(tax as number);
  const netResultValue = t(netResult as number);

  const revenueComponents = revenuePortValue + investmentValue + otherRevenueValue;
  if (revenueComponents !== totalRevenueValue) {
    errors.push(
      `total-revenue bridge mismatch: ${thousandsLabel(revenuePortValue)} + ${thousandsLabel(investmentValue)} + ${thousandsLabel(otherRevenueValue)} = ${thousandsLabel(revenueComponents)}, printed Total revenue ${thousandsLabel(totalRevenueValue)}`,
    );
  } else {
    checks.push(
      `total-revenue bridge exact: ${thousandsLabel(revenuePortValue)} + ${thousandsLabel(investmentValue)} + ${thousandsLabel(otherRevenueValue)} = ${thousandsLabel(totalRevenueValue)}`,
    );
  }

  const expenseComponents =
    employeeValue + depreciationValue + otherExpensesValue + financeCostsValue;
  if (expenseComponents !== totalExpensesValue) {
    errors.push(
      `total-expenses bridge mismatch: ${thousandsLabel(employeeValue)} + ${thousandsLabel(depreciationValue)} + ${thousandsLabel(otherExpensesValue)} + ${thousandsLabel(financeCostsValue)} = ${thousandsLabel(expenseComponents)}, printed Total expenses ${thousandsLabel(totalExpensesValue)}`,
    );
  } else {
    checks.push(
      `total-expenses bridge exact: ${thousandsLabel(employeeValue)} + ${thousandsLabel(depreciationValue)} + ${thousandsLabel(otherExpensesValue)} + ${thousandsLabel(financeCostsValue)} = ${thousandsLabel(totalExpensesValue)}`,
    );
  }

  const derivedPbt = totalRevenueValue - totalExpensesValue + netGainValue + otherGainsValue;
  if (derivedPbt !== pbtValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${thousandsLabel(totalRevenueValue)} - ${thousandsLabel(totalExpensesValue)} + ${thousandsLabel(netGainValue)} + ${thousandsLabel(otherGainsValue)} = ${thousandsLabel(derivedPbt)}, printed Profit before income tax equivalent expense ${thousandsLabel(pbtValue)}`,
    );
  } else {
    checks.push(
      `profit-before-tax bridge exact: ${thousandsLabel(totalRevenueValue)} - ${thousandsLabel(totalExpensesValue)} + ${thousandsLabel(netGainValue)} + ${thousandsLabel(otherGainsValue)} = ${thousandsLabel(derivedPbt)}`,
    );
  }

  if (pbtValue + taxValue !== netResultValue) {
    errors.push(
      `net-result bridge mismatch: ${thousandsLabel(pbtValue)} + (${thousandsLabel(taxValue)}) = ${thousandsLabel(pbtValue + taxValue)}, printed Net profit after tax for the year ${thousandsLabel(netResultValue)}`,
    );
  } else {
    checks.push(
      `net-result bridge exact: ${thousandsLabel(pbtValue)} + (${thousandsLabel(taxValue)}) = ${thousandsLabel(pbtValue + taxValue)}`,
    );
  }

  if (taxValue > 0) {
    errors.push(
      `printed income tax equivalent expense is not a deduction (value ${thousandsLabel(taxValue)})`,
    );
  }

  return {
    page_number: page.page_number,
    unit,
    revenue_port_management: revenuePortValue,
    investment_revenue: investmentValue,
    other_revenue: otherRevenueValue,
    total_revenue: totalRevenueValue,
    employee_expenses: employeeValue,
    depreciation_amortisation: depreciationValue,
    other_expenses: otherExpensesValue,
    finance_costs: financeCostsValue,
    total_expenses: totalExpensesValue,
    net_gain_sale_ppe: netGainValue,
    other_gains: otherGainsValue,
    profit_before_tax: pbtValue,
    income_tax: magnitude(taxValue),
    net_result: netResultValue,
    checks,
    warnings,
    errors,
  };
}

export interface PortAuthorityRevenueNote {
  page_number: number;
  unit: UnitDetection;
  total_revenue: number | null;
  errors: string[];
}

export interface PortAuthorityExpensesNote {
  page_number: number;
  unit: UnitDetection;
  total_expenses: number | null;
  errors: string[];
}

export function parsePortAuthorityRevenueNote(page: PdfPage): PortAuthorityRevenueNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Total revenue');
  if (unit.kind !== 'thousands') {
    errors.push(`revenue-note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`);
  }
  if (anchor === null) errors.push('revenue-note current-year money column could not be anchored');
  const total = anchor === null ? null : valueFor(rows, 'Total revenue', anchor);
  if (total === null) errors.push('revenue-note Total revenue row could not be parsed');
  return {
    page_number: page.page_number,
    unit,
    total_revenue: total === null ? null : thousands(total),
    errors,
  };
}

export function parsePortAuthorityExpensesNote(page: PdfPage): PortAuthorityExpensesNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Total expenses');
  if (unit.kind !== 'thousands') {
    errors.push(`expenses-note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`);
  }
  if (anchor === null) errors.push('expenses-note current-year money column could not be anchored');
  const total = anchor === null ? null : valueFor(rows, 'Total expenses', anchor);
  if (total === null) errors.push('expenses-note Total expenses row could not be parsed');
  return {
    page_number: page.page_number,
    unit,
    total_expenses: total === null ? null : thousands(total),
    errors,
  };
}

export interface PortAuthorityParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface PortAuthorityDeferral {
  reason: string;
  phase: 'discovery' | 'unit' | 'statement' | 'notes' | 'reconciliation';
}

export interface PortAuthorityParseResult {
  records: SpendingRecord[];
  deferral: PortAuthorityDeferral | null;
  statement: PortAuthorityStatement | null;
  revenue_note: PortAuthorityRevenueNote | null;
  expenses_note: PortAuthorityExpensesNote | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export interface PortAuthorityLineSpec {
  line_item: string;
  label: string;
  amount_thousands: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result';
  printed_sign?: 'positive' | 'negative';
  detail: string;
}

export function portAuthorityNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${PORT_AUTHORITY_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousandsOfDollars: number): number {
  const cents = Math.abs(thousandsOfDollars) * PORT_AUTHORITY_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousandsOfDollars} thousands exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: PortAuthorityParseContext,
  spec: PortAuthorityLineSpec,
  statement: PortAuthorityStatement,
  revenueNote: PortAuthorityRevenueNote,
  expensesNote: PortAuthorityExpensesNote,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${PORT_AUTHORITY_UNIT_LABEL} (${PORT_AUTHORITY_UNIT}; x${PORT_AUTHORITY_UNIT_TO_CENTS} cents per unit; whole-thousand-dollar printed precision)`,
    `statement_page: ${statement.page_number}`,
    `revenue_note_page: ${revenueNote.page_number}`,
    `expenses_note_page: ${expensesNote.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, or any other SOC line',
    'no government grants/contributions are separately disclosed in the statement or notes, so no grant row is emitted',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: PortAuthorityLineSpec,
  context: PortAuthorityParseContext,
  statement: PortAuthorityStatement,
  revenueNote: PortAuthorityRevenueNote,
  expensesNote: PortAuthorityExpensesNote,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: PORT_AUTHORITY_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: portAuthorityNaturalKey(
      PORT_AUTHORITY_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${PORT_AUTHORITY_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: PORT_AUTHORITY_JURISDICTION,
    delivery_entity: PORT_AUTHORITY_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Port Authority of NSW Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: PORT_AUTHORITY_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: PORT_AUTHORITY_UNIT,
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, revenueNote, expensesNote, {
      section: spec.section,
      revenue_thousands: statement.total_revenue,
      total_expenses_thousands: statement.total_expenses,
      net_result_thousands: statement.net_result,
      ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

function findRevenueNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('note 3. revenue') &&
      text.includes('revenue from port management') &&
      text.includes('total revenue')
    ) {
      return page;
    }
  }
  return null;
}

function findExpensesNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('note 4. expenses') &&
      text.includes('employee related expenses') &&
      text.includes('total expenses')
    ) {
      return page;
    }
  }
  return null;
}

function deferralResult(
  reason: string,
  phase: PortAuthorityDeferral['phase'],
  partial: Partial<PortAuthorityParseResult>,
): PortAuthorityParseResult {
  return {
    records: [],
    deferral: { reason, phase },
    statement: null,
    revenue_note: null,
    expenses_note: null,
    checks: [],
    warnings: [],
    pages_used: [],
    ...partial,
  };
}

export function parsePortAuthorityExtraction(
  extraction: PdfExtraction,
  context: PortAuthorityParseContext,
): PortAuthorityParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
    return deferralResult(
      'no parseable Statement of comprehensive income found in the PDF',
      'statement',
      { warnings },
    );
  }
  const statement = parsePortAuthorityStatement(statementPage);
  if (!statement) {
    return deferralResult(
      'Statement of comprehensive income page found but required printed lines could not be parsed',
      'statement',
      { warnings, pages_used: [statementPage.page_number] },
    );
  }
  warnings.push(...statement.warnings);
  if (statement.unit.kind !== 'thousands') {
    return deferralResult(
      `statement printed unit is not explicit thousands ($'000): ${statement.unit.reason}`,
      'unit',
      { statement, checks: statement.checks, warnings, pages_used: [statementPage.page_number] },
    );
  }
  if (statement.errors.length > 0) {
    return deferralResult(
      `statement reconciliation failed with zero tolerance: ${statement.errors.join('; ')}`,
      'reconciliation',
      { statement, checks: statement.checks, warnings, pages_used: [statementPage.page_number] },
    );
  }

  const endDate = /year ended 30 June (\d{4})/i.exec(extraction.text);
  const derivedFiscalYear = endDate ? fiscalYearFromEndDate(`${endDate[1]}-06-30`) : null;
  if (derivedFiscalYear && derivedFiscalYear !== context.fiscal_year) {
    return deferralResult(
      `report period ${derivedFiscalYear} does not match discovered report year ${context.fiscal_year}`,
      'statement',
      { statement, checks: statement.checks, warnings, pages_used: [statementPage.page_number] },
    );
  }

  const revenuePage = findRevenueNotePage(extraction.pages);
  if (!revenuePage) {
    return deferralResult(
      'the Note 3 Revenue table needed to verify Total revenue could not be located',
      'notes',
      { statement, checks: statement.checks, warnings, pages_used: [statementPage.page_number] },
    );
  }
  const revenueNote = parsePortAuthorityRevenueNote(revenuePage);

  const expensesPage = findExpensesNotePage(extraction.pages);
  if (!expensesPage) {
    return deferralResult(
      'the Note 4 Expenses table needed to verify Total expenses could not be located',
      'notes',
      {
        statement,
        revenue_note: revenueNote,
        checks: statement.checks,
        warnings,
        pages_used: [statementPage.page_number, revenueNote.page_number],
      },
    );
  }
  const expensesNote = parsePortAuthorityExpensesNote(expensesPage);

  const pagesUsed = [statementPage.page_number, revenueNote.page_number, expensesNote.page_number];

  for (const [name, note] of [
    ['revenue note', revenueNote],
    ['expenses note', expensesNote],
  ] as const) {
    if (note.unit.kind !== 'thousands') {
      return deferralResult(
        `${name} on page ${note.page_number} is not explicit thousands: ${note.unit.reason}`,
        'unit',
        {
          statement,
          revenue_note: revenueNote,
          expenses_note: expensesNote,
          checks: statement.checks,
          warnings,
          pages_used: pagesUsed,
        },
      );
    }
    if (note.errors.length > 0) {
      return deferralResult(`${name} parse failed: ${note.errors.join('; ')}`, 'notes', {
        statement,
        revenue_note: revenueNote,
        expenses_note: expensesNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      });
    }
  }

  if (
    revenueNote.total_revenue === null ||
    thousands(revenueNote.total_revenue) !== statement.total_revenue
  ) {
    return deferralResult(
      `Note 3 Total revenue mismatch: note ${revenueNote.total_revenue ?? 'missing'}, statement ${statement.total_revenue}`,
      'reconciliation',
      {
        statement,
        revenue_note: revenueNote,
        expenses_note: expensesNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      },
    );
  }

  if (
    expensesNote.total_expenses === null ||
    thousands(expensesNote.total_expenses) !== statement.total_expenses
  ) {
    return deferralResult(
      `Note 4 Total expenses mismatch: note ${expensesNote.total_expenses ?? 'missing'}, statement ${statement.total_expenses}`,
      'reconciliation',
      {
        statement,
        revenue_note: revenueNote,
        expenses_note: expensesNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      },
    );
  }

  const checks = [
    ...statement.checks,
    `Note 3 Total revenue exact: ${thousands(revenueNote.total_revenue)} = statement Total revenue ${statement.total_revenue}`,
    `Note 4 Total expenses exact: ${thousands(expensesNote.total_expenses)} = statement Total expenses ${statement.total_expenses}`,
  ];

  const lineSpecs: PortAuthorityLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: PORT_AUTHORITY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed statement Total revenue. Exactly equals the three printed revenue lines (Revenue from port management + Investment revenue + Other revenue) and the Note 3 Total revenue. No government grants/contributions are separately disclosed.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: PORT_AUTHORITY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement Total expenses. Exactly equals the four printed expense lines (Employee related expenses + Depreciation and amortisation expenses + Other expenses + Finance costs) and the Note 4 Total expenses. Never add the component rows to it.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee related expenses',
      amount_thousands: statement.employee_expenses,
      funding_source: PORT_AUTHORITY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement line Employee related expenses. A component of Total expenses; never add it to Total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation expenses',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: PORT_AUTHORITY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement line Depreciation and amortisation expenses. A component of Total expenses; never add it to Total expenses.',
    },
    {
      line_item: 'net_result',
      label: 'Net profit after tax for the year',
      amount_thousands: statement.net_result,
      funding_source: PORT_AUTHORITY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
      detail:
        'Printed Net profit after tax for the year. A result line, not an expense component; never add to revenue or expenses.',
    },
  ];

  const records = lineSpecs.map((spec) =>
    mapLine(spec, context, statement, revenueNote, expensesNote),
  );
  warnings.push(
    'SOC entity rows are provisional and unverified; both printed totals reconcile exactly to their printed components, the profit-before-tax bridge and the printed Note 3/Note 4 totals.',
  );
  return {
    records,
    deferral: null,
    statement,
    revenue_note: revenueNote,
    expenses_note: expensesNote,
    checks,
    warnings,
    pages_used: pagesUsed,
  };
}

export interface PortAuthorityConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: PortAuthorityAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'port-authority-nsw-annual-report.pdf';
}

/** Operator escape hatch: use an exact official PDF URL instead of live discovery. */
function documentFromEnv(): PortAuthorityAnnualReportLink | null {
  const url = process.env.PORT_AUTHORITY_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'port-authority-nsw-annual-report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = fiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `PORT_AUTHORITY_ANNUAL_REPORT_URL filename "${filename}" has no report year; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: PORT_AUTHORITY_SOURCE_URL,
  };
}

async function recordDeferral(
  document: PortAuthorityAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: PortAuthorityDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: PORT_AUTHORITY_ID, document_url: document.url },
    {
      $set: {
        entity: PORT_AUTHORITY_ENTITY,
        jurisdiction: PORT_AUTHORITY_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Port Authority of NSW SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Port Authority of NSW connector. */
export function createPortAuthorityConnector(
  options: PortAuthorityConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: PORT_AUTHORITY_ID,
    name: PORT_AUTHORITY_NAME,
    publisher: PORT_AUTHORITY_PUBLISHER,
    source_url: PORT_AUTHORITY_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: PORT_AUTHORITY_LICENSE,
    notes:
      'NSW SOC Phase 8: Port Authority of NSW only. The latest annual report is discovered from the official annual-reports page (no hard-coded PDF URL; an operator PDF-URL override exists), SHA-256 archived outside the repo, and parsed for the Statement of comprehensive income. The printed unit must be explicit $\'000; the statement prints an explicit Total revenue and Total expenses, accepted only when the revenue-line, expense-line, profit-before-tax, net-result and Note 3/Note 4 bridges reconcile exactly. No government grants/contributions are separately disclosed, so no grants row is emitted. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). SOC rows are never added to government program spending, the PNFC benchmark, or each other. Other SOCs are not implemented.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverPortAuthorityAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Port Authority PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: PORT_AUTHORITY_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Port Authority of NSW annual-report PDF; archived for auditable NSW SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: PortAuthorityParseContext = {
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
      const parsed = parsePortAuthorityExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'port-authority-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'port-authority-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Port Authority measure; skipped');
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
