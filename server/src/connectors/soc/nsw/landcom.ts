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
 * NSW SOC Phase 7 — Landcom annual-report adapter.
 *
 * This reuses the established NSW SOC layer: one entity adapter, not a second
 * framework. Landcom is the sixth NSW SOC entity after Sydney Water, WaterNSW,
 * Hunter Water, Essential Energy and Forestry Corporation of NSW.
 *
 * Source gate:
 * - The document is discovered from Landcom's own corporate-publications page
 *   (no PDF URL is hard-coded). The exact PDF bytes are SHA-256 archived outside
 *   the repo.
 * - The Statement of Comprehensive Income prints an explicit "$'000" unit. A
 *   table read as dollars or millions is rejected, not converted by magnitude.
 *   One $'000 unit = 100,000 cents.
 * - The statement prints neither a "Total revenue" nor a "Total expenses"
 *   subtotal. Following the Essential Energy precedent, total revenue is the
 *   exact sum of the printed revenue lines (revenue from contracts with
 *   customers + other income + finance income) and total expenses is the exact
 *   sum of the printed expense lines (cost of sales + employee related expenses
 *   + other expenses + depreciation and amortisation + net fair value loss on
 *   investment properties + finance costs). They are accepted only when every
 *   printed bridge reconciles with zero tolerance: gross profit, the derived
 *   revenue/expense sums, profit before income tax, net result, and the
 *   Note 2.2/2.3/2.4/2.5/2.6 component subtotals. A one-thousand-dollar
 *   mismatch defers the whole document.
 */

export const LANDCOM_ID = 'landcom';
export const LANDCOM_NAME = 'Landcom — Annual Report';
export const LANDCOM_PUBLISHER = 'Landcom';
export const LANDCOM_ENTITY = 'Landcom';
export const LANDCOM_JURISDICTION = 'NSW';
export const LANDCOM_SOURCE_URL = 'https://www.landcom.com.au/about-us/corporate-publications';
export const LANDCOM_LICENSE =
  '© Landcom. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const LANDCOM_UNIT = 'AUD_thousands';
export const LANDCOM_UNIT_LABEL = "$'000";
export const LANDCOM_UNIT_TO_CENTS = 100_000;
export const LANDCOM_CAVEAT =
  'Entity-level SOC statement lines for Landcom only. Never add to government program spending, to the PNFC sector benchmark, or to each other: the statement prints no Total revenue or Total expenses subtotal, so both are the exact signed sums of the printed statement lines; total revenue includes the separately shown grant income; the net result is a profit. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the URL; parse the page. */
export interface LandcomAnnualReportLink {
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

const ANNUAL_REPORT_FILENAME = /^(20\d{2})\b.*annual[\s_\-–]*report/i;
const NON_ANNUAL_REPORT =
  /fraud|gipa|half[\s_\-–]*year|sustainability|pricing|access[\s_\-–]*undertaking|safety|ensms|performance|financial[\s_\-–]*statements|climate|reconciliation|corporate[\s_\-–]*intent|budget/i;

/** Map a report year (year ended 30 June) to the API fiscal year "2024-25". */
export function landcomFiscalYearFromReportYear(reportYear: number): string {
  return `${reportYear - 1}-${String(reportYear % 100).padStart(2, '0')}`;
}

/**
 * Parse the annual-report PDF links on the official corporate-publications
 * page. Both `YYYY-Landcom-Annual-Report.pdf` and the legacy
 * `YYYY-Annual-Report.pdf` / `YYYY-UGNSW-AnnualReport.pdf` paths are accepted;
 * non-annual PDFs (sustainability, corporate intent, etc.) are rejected. No URL
 * is hard-coded.
 */
export function parseLandcomAnnualReportPdfLinks(
  html: string,
  pageUrl: string = LANDCOM_SOURCE_URL,
): LandcomAnnualReportLink[] {
  const links: LandcomAnnualReportLink[] = [];
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
    if (NON_ANNUAL_REPORT.test(filename)) continue;
    const yearMatch = ANNUAL_REPORT_FILENAME.exec(filename);
    if (!yearMatch?.[1]) continue;
    const reportYear = Number(yearMatch[1]);
    const fiscalYear = landcomFiscalYearFromReportYear(reportYear);
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

/** Fetch the official corporate-publications page and return its latest report. */
export async function discoverLandcomAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = LANDCOM_SOURCE_URL,
): Promise<LandcomAnnualReportLink> {
  const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(`Landcom corporate-publications page HTTP ${response.status} for ${pageUrl}`);
  }
  const html = await response.text();
  const links = parseLandcomAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Landcom corporate-publications page contains no annual-report PDF link; refusing to hard-code a URL',
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

/** Anchor the current-year money column on the leftmost numeric cell of a printed row. */
function columnAnchor(rows: readonly PageRow[], label: string): number | null {
  const wanted = label.toLowerCase();
  const row =
    rows.find((entry) => labelOf(entry).toLowerCase() === wanted) ??
    rows.find((entry) => labelOf(entry).toLowerCase().startsWith(wanted)) ??
    null;
  return row ? rowAnchor(row) : null;
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

function valueNear(row: PageRow, anchor: number, tolerance = 14): number | null {
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

/** Detect the printed unit from the statement header/unit rows. */
export function detectLandcomUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

const UNIT_TOKEN =
  /^(?:\$\s*['’‘]?0{3}|\$\s*(?:k|thousand|thousands|m|mn|million|millions|b|bn|billion|billions)|\$|['’‘]000|\$?\s*(?:k|thousand|thousands|m|mn|million|millions|b|bn|billion|billions))$/i;

/**
 * Only genuine unit-header cells are sampled. Prose such as "$2.3 million" in a
 * note's narrative must not flip an otherwise explicit "$'000" table to
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

/** Convert a printed thousands value to integer thousands (a stable integer basis). */
function thousands(value: number): number {
  return Math.round(value);
}

function thousandsLabel(value: number): string {
  return String(value);
}

export interface LandcomStatement {
  page_number: number;
  unit: UnitDetection;
  revenue_contracts: number;
  cost_of_sales: number;
  gross_profit: number;
  other_income: number;
  finance_income: number;
  employee_expenses: number;
  other_expenses: number;
  depreciation_amortisation: number;
  net_fair_value_loss: number;
  finance_costs: number;
  /** Derived exact sum of the printed revenue lines (positive). */
  total_revenue: number;
  /** Derived exact sum of the printed expense lines (positive expense). */
  total_expenses: number;
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
      text.includes('revenue from contracts with customers') &&
      text.includes('profit before income tax')
    ) {
      return page;
    }
  }
  return null;
}

export function parseLandcomStatement(page: PdfPage): LandcomStatement | null {
  const rows = groupPageRows(page.items);
  const titleRow = rows.find((row) => /statement of comprehensive income/i.test(textOf(row)));
  if (!titleRow) return null;

  const unit = detectMoneyUnit(unitSamples(rows));

  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Gross profit');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed Gross profit row',
    );
    return null;
  }
  if (unit.kind !== 'thousands') {
    errors.push(
      `printed unit is not explicit thousands ($'000) (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $'000 statement as dollars or millions`,
    );
  }

  const revenueContracts = valueFor(rows, 'Revenue from contracts with customers', anchor);
  const costOfSales = valueFor(rows, 'Cost of sales', anchor);
  const grossProfit = valueFor(rows, 'Gross profit', anchor);
  const otherIncome = valueFor(rows, 'Other income', anchor);
  const financeIncome = valueFor(rows, 'Finance income', anchor);
  const employee = valueFor(rows, 'Employee related expenses', anchor);
  const otherExpenses = valueFor(rows, 'Other expenses', anchor);
  const depreciation = valueFor(rows, 'Depreciation and amortisation expense', anchor);
  const netFairValueLoss = valueFor(rows, 'Net fair value loss on investment properties', anchor);
  const financeCosts = valueFor(rows, 'Finance costs', anchor);
  const pbt = valueForPattern(rows, [/^profit before income tax$/i], anchor);
  const tax = valueForPattern(rows, [/^income tax equivalent expense$/i], anchor);
  const netResult = valueForPattern(rows, [/^net profit for the year$/i], anchor);

  const required: Array<[string, number | null]> = [
    ['Revenue from contracts with customers', revenueContracts],
    ['Cost of sales', costOfSales],
    ['Gross profit', grossProfit],
    ['Other income', otherIncome],
    ['Finance income', financeIncome],
    ['Employee related expenses', employee],
    ['Other expenses', otherExpenses],
    ['Depreciation and amortisation expense', depreciation],
    ['Net fair value loss on investment properties', netFairValueLoss],
    ['Finance costs', financeCosts],
    ['Profit before income tax', pbt],
    ['Income tax equivalent expense', tax],
    ['Net profit for the year', netResult],
  ];
  const missing = required.filter(([, value]) => value === null).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return {
      page_number: page.page_number,
      unit,
      revenue_contracts: 0,
      cost_of_sales: 0,
      gross_profit: 0,
      other_income: 0,
      finance_income: 0,
      employee_expenses: 0,
      other_expenses: 0,
      depreciation_amortisation: 0,
      net_fair_value_loss: 0,
      finance_costs: 0,
      total_revenue: 0,
      total_expenses: 0,
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

  const revenue = t(revenueContracts as number);
  const cos = t(costOfSales as number);
  const otherInc = t(otherIncome as number);
  const financeInc = t(financeIncome as number);
  const employeeExp = t(employee as number);
  const otherExp = t(otherExpenses as number);
  const dep = t(depreciation as number);
  const fvLoss = t(netFairValueLoss as number);
  const financeExp = t(financeCosts as number);

  const totalRevenue = revenue + otherInc + financeInc;
  const expenseComponents = cos + employeeExp + otherExp + dep + fvLoss + financeExp;
  const totalExpenses = -expenseComponents;

  // Zero-tolerance printed bridges, all in integer thousands of dollars.
  if (revenue + cos !== t(grossProfit as number)) {
    errors.push(
      `gross-profit bridge mismatch: ${thousandsLabel(revenue)} + (${thousandsLabel(cos)}) = ${thousandsLabel(revenue + cos)}, printed Gross profit ${thousandsLabel(t(grossProfit as number))}`,
    );
  } else {
    checks.push(
      `gross-profit bridge exact: ${thousandsLabel(revenue)} + (${thousandsLabel(cos)}) = ${thousandsLabel(revenue + cos)}`,
    );
  }

  checks.push(
    `revenue lines exact: ${thousandsLabel(revenue)} + ${thousandsLabel(otherInc)} + ${thousandsLabel(financeInc)} = ${thousandsLabel(totalRevenue)} (the derived total revenue; the statement prints no Total revenue subtotal)`,
  );
  checks.push(
    `expense lines exact: (${thousandsLabel(cos)}) + (${thousandsLabel(employeeExp)}) + (${thousandsLabel(otherExp)}) + (${thousandsLabel(dep)}) + (${thousandsLabel(fvLoss)}) + (${thousandsLabel(financeExp)}) = (${thousandsLabel(totalExpenses)}) (the derived total expenses; the statement prints no Total expenses subtotal)`,
  );

  if (totalRevenue + expenseComponents !== t(pbt as number)) {
    errors.push(
      `profit-before-tax bridge mismatch: ${thousandsLabel(totalRevenue)} + (${thousandsLabel(totalExpenses)}) = ${thousandsLabel(totalRevenue + expenseComponents)}, printed Profit before income tax ${thousandsLabel(t(pbt as number))}`,
    );
  } else {
    checks.push(
      `profit-before-tax bridge exact: ${thousandsLabel(totalRevenue)} + (${thousandsLabel(totalExpenses)}) = ${thousandsLabel(totalRevenue + expenseComponents)}`,
    );
  }

  if (t(pbt as number) + t(tax as number) !== t(netResult as number)) {
    errors.push(
      `net-result bridge mismatch: ${thousandsLabel(t(pbt as number))} + (${thousandsLabel(t(tax as number))}) = ${thousandsLabel(t(pbt as number) + t(tax as number))}, printed Net profit for the year ${thousandsLabel(t(netResult as number))}`,
    );
  } else {
    checks.push(
      `net-result bridge exact: ${thousandsLabel(t(pbt as number))} + (${thousandsLabel(t(tax as number))}) = ${thousandsLabel(t(pbt as number) + t(tax as number))}`,
    );
  }

  // Printed expense lines must all be deductions (or zero) for the signed sum.
  for (const [label, value] of [
    ['Cost of sales', cos],
    ['Employee related expenses', employeeExp],
    ['Other expenses', otherExp],
    ['Depreciation and amortisation expense', dep],
    ['Net fair value loss on investment properties', fvLoss],
    ['Finance costs', financeExp],
  ] as const) {
    if (value > 0) {
      errors.push(
        `printed expense line ${label} is not a deduction (value ${thousandsLabel(value)})`,
      );
    }
  }

  warnings.push(
    'the Statement of Comprehensive Income has no printed Total revenue or Total expenses subtotal; total revenue is the exact signed sum of the printed revenue lines and total expenses is the exact signed sum of the printed expense lines, accepted only because the profit-before-tax bridge reconciles with zero tolerance',
  );

  return {
    page_number: page.page_number,
    unit,
    revenue_contracts: revenue,
    cost_of_sales: cos,
    gross_profit: t(grossProfit as number),
    other_income: otherInc,
    finance_income: financeInc,
    employee_expenses: magnitude(employeeExp),
    other_expenses: magnitude(otherExp),
    depreciation_amortisation: magnitude(dep),
    net_fair_value_loss: magnitude(fvLoss),
    finance_costs: magnitude(financeExp),
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    profit_before_tax: t(pbt as number),
    income_tax: magnitude(tax as number),
    net_result: t(netResult as number),
    checks,
    warnings,
    errors,
  };
}

export interface LandcomOtherIncomeNote {
  page_number: number;
  unit: UnitDetection;
  grant_income: number | null;
  other_income: number | null;
  errors: string[];
}

export interface LandcomFinanceNote {
  page_number: number;
  unit: UnitDetection;
  interest_from_bank: number | null;
  net_interest_discounting: number | null;
  interest_delayed_settlements: number | null;
  interest_deferred_settlement: number | null;
  finance_income: number | null;
  finance_costs: number | null;
  errors: string[];
}

export interface LandcomEmployeeNote {
  page_number: number;
  unit: UnitDetection;
  salaries_and_wages: number | null;
  termination_payments: number | null;
  defined_benefit_super: number | null;
  defined_contribution_super: number | null;
  long_service_leave: number | null;
  annual_leave: number | null;
  payroll_tax_fbt: number | null;
  other_employee_expenses: number | null;
  gross_employee_expenses: number | null;
  amounts_capitalised: number | null;
  net_employee_expenses: number | null;
  errors: string[];
}

export interface LandcomOtherExpensesNote {
  page_number: number;
  unit: UnitDetection;
  advertising_marketing: number | null;
  auditor_remuneration: number | null;
  operating_lease: number | null;
  general_administrative: number | null;
  council_rates: number | null;
  land_tax: number | null;
  inventory_nrv_adjustment: number | null;
  project_establishment: number | null;
  inventory_write_back: number | null;
  property_accommodation: number | null;
  consultancy_fees: number | null;
  loss_on_disposal: number | null;
  gross_other_expenses: number | null;
  capital_costs_transferred: number | null;
  net_other_expenses: number | null;
  errors: string[];
}

export interface LandcomDepreciationNote {
  page_number: number;
  unit: UnitDetection;
  right_of_use_assets: number | null;
  leasehold_improvements: number | null;
  plant_and_equipment: number | null;
  intangible_assets: number | null;
  motor_vehicles: number | null;
  total_depreciation_amortisation: number | null;
  errors: string[];
}

function readNoteValue(
  rows: readonly PageRow[],
  pattern: RegExp,
  anchor: number,
): { found: boolean; value: number | null } {
  const row = rows.find((entry) => pattern.test(labelOf(entry)));
  if (!row) return { found: false, value: null };
  return { found: true, value: valueNear(row, anchor) ?? 0 };
}

export function parseLandcomOtherIncomeNote(page: PdfPage): LandcomOtherIncomeNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Grant income');
  if (unit.kind !== 'thousands') {
    errors.push(
      `other-income note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`,
    );
  }
  if (anchor === null)
    errors.push('other-income note current-year money column could not be anchored');
  const grants = anchor === null ? null : valueFor(rows, 'Grant income', anchor);
  const other = anchor === null ? null : valueForPattern(rows, [/^other income$/i], anchor);
  if (grants === null) errors.push('Grant income row could not be parsed');
  if (other === null) errors.push('Other income row could not be parsed');
  return {
    page_number: page.page_number,
    unit,
    grant_income: grants,
    other_income: other,
    errors,
  };
}

export function parseLandcomFinanceNote(page: PdfPage): LandcomFinanceNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Interest from bank');
  if (unit.kind !== 'thousands') {
    errors.push(`finance note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`);
  }
  if (anchor === null) errors.push('finance note current-year money column could not be anchored');
  const read = (pattern: RegExp, label: string): number | null => {
    if (anchor === null) return null;
    const result = readNoteValue(rows, pattern, anchor);
    if (!result.found) {
      errors.push(`${label} row could not be located`);
      return null;
    }
    return result.value;
  };
  const interestFromBank = read(/^Interest from bank$/i, 'Interest from bank');
  const netDiscounting = read(
    /^Net interest income from discounting adjustments$/i,
    'Net interest income from discounting adjustments',
  );
  const delayed = read(/^Interest from delayed settlements$/i, 'Interest from delayed settlements');
  const deferred = read(
    /^Interest on deferred settlement proceeds$/i,
    'Interest on deferred settlement proceeds',
  );
  const costs = read(
    /^Interest expense from lease liabilities$/i,
    'Interest expense from lease liabilities',
  );
  const income =
    interestFromBank === null || netDiscounting === null || delayed === null || deferred === null
      ? null
      : thousands(interestFromBank) +
        thousands(netDiscounting) +
        thousands(delayed) +
        thousands(deferred);
  return {
    page_number: page.page_number,
    unit,
    interest_from_bank: interestFromBank,
    net_interest_discounting: netDiscounting,
    interest_delayed_settlements: delayed,
    interest_deferred_settlement: deferred,
    finance_income: income === null ? null : income,
    finance_costs: costs,
    errors,
  };
}

export function parseLandcomEmployeeNote(page: PdfPage): LandcomEmployeeNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Salaries and wages');
  if (unit.kind !== 'thousands') {
    errors.push(`employee note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`);
  }
  if (anchor === null) errors.push('employee note current-year money column could not be anchored');
  const read = (pattern: RegExp, label: string): number | null => {
    if (anchor === null) return null;
    const result = readNoteValue(rows, pattern, anchor);
    if (!result.found) {
      errors.push(`${label} row could not be located`);
      return null;
    }
    return result.value;
  };
  const salaries = read(/^Salaries and wages$/i, 'Salaries and wages');
  const termination = read(/^Termination payments$/i, 'Termination payments');
  const dbSuper = read(
    /^Superannuation\s*[–-]\s*Defined benefit plans$/i,
    'Superannuation — defined benefit plans',
  );
  const dcSuper = read(
    /^Superannuation\s*[–-]\s*Defined contribution plans$/i,
    'Superannuation — defined contribution plans',
  );
  const lsl = read(/^Long service leave$/i, 'Long service leave');
  const annual = read(/^Annual leave$/i, 'Annual leave');
  const payroll = read(
    /^Payroll tax and fringe benefits tax$/i,
    'Payroll tax and fringe benefits tax',
  );
  const other = read(/^Other employee related expenses$/i, 'Other employee related expenses');
  const capitalised = read(/^Less amounts capitalised$/i, 'Less amounts capitalised');
  const components = [salaries, termination, dbSuper, dcSuper, lsl, annual, payroll, other];
  const gross = components.some((value) => value === null)
    ? null
    : components.reduce<number>((sum, value) => sum + thousands(value as number), 0);
  const net = gross === null || capitalised === null ? null : gross + thousands(capitalised);
  return {
    page_number: page.page_number,
    unit,
    salaries_and_wages: salaries,
    termination_payments: termination,
    defined_benefit_super: dbSuper,
    defined_contribution_super: dcSuper,
    long_service_leave: lsl,
    annual_leave: annual,
    payroll_tax_fbt: payroll,
    other_employee_expenses: other,
    gross_employee_expenses: gross,
    amounts_capitalised: capitalised,
    net_employee_expenses: net,
    errors,
  };
}

export function parseLandcomOtherExpensesNote(page: PdfPage): LandcomOtherExpensesNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Advertising, marketing and selling expenses');
  if (unit.kind !== 'thousands') {
    errors.push(
      `other-expenses note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`,
    );
  }
  if (anchor === null) {
    errors.push('other-expenses note current-year money column could not be anchored');
  }
  const read = (pattern: RegExp, label: string): number | null => {
    if (anchor === null) return null;
    const result = readNoteValue(rows, pattern, anchor);
    if (!result.found) {
      errors.push(`${label} row could not be located`);
      return null;
    }
    return result.value;
  };
  const advertising = read(/^Advertising, marketing and selling expenses$/i, 'advertising');
  const auditor = read(/^Auditor.s remuneration.*audit of financial statements$/i, 'auditor');
  const lease = read(/^Operating lease rental expense$/i, 'operating lease rental');
  const admin = read(/^General administrative costs$/i, 'general administrative costs');
  const rates = read(/^Council rates$/i, 'council rates');
  const landTax = read(/^Land tax$/i, 'land tax');
  const nrv = read(
    /^Adjustment of inventory to net realisable value$/i,
    'inventory NRV adjustment',
  );
  const project = read(/^Project establishment costs$/i, 'project establishment costs');
  const writeBack = read(/^Write back inventory previously written off$/i, 'inventory write back');
  const property = read(/^Property and accommodation$/i, 'property and accommodation');
  const consultancy = read(/^Consultancy fees$/i, 'consultancy fees');
  const disposal = read(/^Loss on disposal of property, plant and equipment$/i, 'loss on disposal');
  const transfer = read(/^Transfer of capital costs to inventories$/i, 'capital costs transferred');
  const components = [
    advertising,
    auditor,
    lease,
    admin,
    rates,
    landTax,
    nrv,
    project,
    writeBack,
    property,
    consultancy,
    disposal,
  ];
  const gross = components.some((value) => value === null)
    ? null
    : components.reduce<number>((sum, value) => sum + thousands(value as number), 0);
  const net = gross === null || transfer === null ? null : gross + thousands(transfer);
  return {
    page_number: page.page_number,
    unit,
    advertising_marketing: advertising,
    auditor_remuneration: auditor,
    operating_lease: lease,
    general_administrative: admin,
    council_rates: rates,
    land_tax: landTax,
    inventory_nrv_adjustment: nrv,
    project_establishment: project,
    inventory_write_back: writeBack,
    property_accommodation: property,
    consultancy_fees: consultancy,
    loss_on_disposal: disposal,
    gross_other_expenses: gross,
    capital_costs_transferred: transfer,
    net_other_expenses: net,
    errors,
  };
}

export function parseLandcomDepreciationNote(page: PdfPage): LandcomDepreciationNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Right of use assets');
  if (unit.kind !== 'thousands') {
    errors.push(
      `depreciation note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`,
    );
  }
  if (anchor === null) {
    errors.push('depreciation note current-year money column could not be anchored');
  }
  const read = (pattern: RegExp, label: string): number | null => {
    if (anchor === null) return null;
    const result = readNoteValue(rows, pattern, anchor);
    if (!result.found) {
      errors.push(`${label} row could not be located`);
      return null;
    }
    return result.value;
  };
  const rou = read(/^Right of use assets$/i, 'right of use assets');
  const leasehold = read(/^Leasehold improvements$/i, 'leasehold improvements');
  const plant = read(/^Plant and equipment$/i, 'plant and equipment');
  const intangibles = read(/^Intangible assets$/i, 'intangible assets');
  const motor = read(/^Motor vehicles$/i, 'motor vehicles');
  const components = [rou, leasehold, plant, intangibles, motor];
  const total = components.some((value) => value === null)
    ? null
    : components.reduce<number>((sum, value) => sum + thousands(value as number), 0);
  return {
    page_number: page.page_number,
    unit,
    right_of_use_assets: rou,
    leasehold_improvements: leasehold,
    plant_and_equipment: plant,
    intangible_assets: intangibles,
    motor_vehicles: motor,
    total_depreciation_amortisation: total,
    errors,
  };
}

export interface LandcomParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface LandcomDeferral {
  reason: string;
  phase: 'discovery' | 'unit' | 'statement' | 'notes' | 'reconciliation';
}

export interface LandcomParseResult {
  records: SpendingRecord[];
  deferral: LandcomDeferral | null;
  statement: LandcomStatement | null;
  other_income_note: LandcomOtherIncomeNote | null;
  finance_note: LandcomFinanceNote | null;
  employee_note: LandcomEmployeeNote | null;
  other_expenses_note: LandcomOtherExpensesNote | null;
  depreciation_note: LandcomDepreciationNote | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export interface LandcomLineSpec {
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

export function landcomNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${LANDCOM_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousandsOfDollars: number): number {
  const cents = Math.abs(thousandsOfDollars) * LANDCOM_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousandsOfDollars} thousands exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: LandcomParseContext,
  spec: LandcomLineSpec,
  statement: LandcomStatement,
  otherIncomeNote: LandcomOtherIncomeNote,
  financeNote: LandcomFinanceNote,
  employeeNote: LandcomEmployeeNote,
  otherExpensesNote: LandcomOtherExpensesNote,
  depreciationNote: LandcomDepreciationNote,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${LANDCOM_UNIT_LABEL} (${LANDCOM_UNIT}; x${LANDCOM_UNIT_TO_CENTS} cents per unit; whole-thousand-dollar printed precision)`,
    `statement_page: ${statement.page_number}`,
    `other_income_note_page: ${otherIncomeNote.page_number}`,
    `finance_note_page: ${financeNote.page_number}`,
    `employee_note_page: ${employeeNote.page_number}`,
    `other_expenses_note_page: ${otherExpensesNote.page_number}`,
    `depreciation_note_page: ${depreciationNote.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: LandcomLineSpec,
  context: LandcomParseContext,
  statement: LandcomStatement,
  otherIncomeNote: LandcomOtherIncomeNote,
  financeNote: LandcomFinanceNote,
  employeeNote: LandcomEmployeeNote,
  otherExpensesNote: LandcomOtherExpensesNote,
  depreciationNote: LandcomDepreciationNote,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: LANDCOM_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: landcomNaturalKey(
      LANDCOM_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${LANDCOM_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: LANDCOM_JURISDICTION,
    delivery_entity: LANDCOM_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Landcom Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: LANDCOM_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: LANDCOM_UNIT,
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(
      context,
      spec,
      statement,
      otherIncomeNote,
      financeNote,
      employeeNote,
      otherExpensesNote,
      depreciationNote,
      {
        section: spec.section,
        revenue_thousands: statement.total_revenue,
        total_expenses_thousands: statement.total_expenses,
        net_result_thousands: statement.net_result,
        ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
          ? { human_spot_check: 'required — one of the two flagged SOC line items' }
          : {}),
        checks: statement.checks.join(' | '),
      },
    ),
  };
}

function findOtherIncomeNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (text.includes('2.2 other income') && text.includes('grant income')) return page;
  }
  return null;
}

function findFinanceNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (text.includes('2.3 finance income and costs') && text.includes('interest from bank')) {
      return page;
    }
  }
  return null;
}

function findEmployeeNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('2.4 employee related expenses') &&
      text.includes('salaries and wages') &&
      text.includes('less amounts capitalised')
    ) {
      return page;
    }
  }
  return null;
}

function findOtherExpensesNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('2.5 other expenses') &&
      text.includes('advertising, marketing and selling expenses')
    ) {
      return page;
    }
  }
  return null;
}

function findDepreciationNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('2.6 depreciation and amortisation expense') &&
      text.includes('right of use assets')
    ) {
      return page;
    }
  }
  return null;
}

function deferralResult(
  reason: string,
  phase: LandcomDeferral['phase'],
  partial: Partial<LandcomParseResult>,
): LandcomParseResult {
  return {
    records: [],
    deferral: { reason, phase },
    statement: null,
    other_income_note: null,
    finance_note: null,
    employee_note: null,
    other_expenses_note: null,
    depreciation_note: null,
    checks: [],
    warnings: [],
    pages_used: [],
    ...partial,
  };
}

export function parseLandcomExtraction(
  extraction: PdfExtraction,
  context: LandcomParseContext,
): LandcomParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
    return deferralResult(
      'no parseable Statement of Comprehensive Income found in the PDF',
      'statement',
      { warnings },
    );
  }
  const statement = parseLandcomStatement(statementPage);
  if (!statement) {
    return deferralResult(
      'Statement of Comprehensive Income page found but required printed lines could not be parsed',
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

  const otherIncomePage = findOtherIncomeNotePage(extraction.pages);
  if (!otherIncomePage) {
    return deferralResult(
      'the Note 2.2 Other income table needed to verify grant income could not be located',
      'notes',
      { statement, checks: statement.checks, warnings, pages_used: [statementPage.page_number] },
    );
  }
  const otherIncomeNote = parseLandcomOtherIncomeNote(otherIncomePage);

  const financePage = findFinanceNotePage(extraction.pages);
  if (!financePage) {
    return deferralResult(
      'the Note 2.3 Finance income and costs table could not be located',
      'notes',
      {
        statement,
        other_income_note: otherIncomeNote,
        checks: statement.checks,
        warnings,
        pages_used: [statementPage.page_number, otherIncomeNote.page_number],
      },
    );
  }
  const financeNote = parseLandcomFinanceNote(financePage);

  const employeePage = findEmployeeNotePage(extraction.pages);
  if (!employeePage) {
    return deferralResult(
      'the Note 2.4 Employee related expenses table could not be located',
      'notes',
      {
        statement,
        other_income_note: otherIncomeNote,
        finance_note: financeNote,
        checks: statement.checks,
        warnings,
        pages_used: [
          statementPage.page_number,
          otherIncomeNote.page_number,
          financeNote.page_number,
        ],
      },
    );
  }
  const employeeNote = parseLandcomEmployeeNote(employeePage);

  const otherExpensesPage = findOtherExpensesNotePage(extraction.pages);
  if (!otherExpensesPage) {
    return deferralResult('the Note 2.5 Other expenses table could not be located', 'notes', {
      statement,
      other_income_note: otherIncomeNote,
      finance_note: financeNote,
      employee_note: employeeNote,
      checks: statement.checks,
      warnings,
      pages_used: [
        statementPage.page_number,
        otherIncomeNote.page_number,
        financeNote.page_number,
        employeeNote.page_number,
      ],
    });
  }
  const otherExpensesNote = parseLandcomOtherExpensesNote(otherExpensesPage);

  const depreciationPage = findDepreciationNotePage(extraction.pages);
  if (!depreciationPage) {
    return deferralResult(
      'the Note 2.6 Depreciation and amortisation expense table could not be located',
      'notes',
      {
        statement,
        other_income_note: otherIncomeNote,
        finance_note: financeNote,
        employee_note: employeeNote,
        other_expenses_note: otherExpensesNote,
        checks: statement.checks,
        warnings,
        pages_used: [
          statementPage.page_number,
          otherIncomeNote.page_number,
          financeNote.page_number,
          employeeNote.page_number,
          otherExpensesNote.page_number,
        ],
      },
    );
  }
  const depreciationNote = parseLandcomDepreciationNote(depreciationPage);

  const pagesUsed = [
    statementPage.page_number,
    otherIncomeNote.page_number,
    financeNote.page_number,
    employeeNote.page_number,
    otherExpensesNote.page_number,
    depreciationNote.page_number,
  ];

  for (const [name, note] of [
    ['other-income note', otherIncomeNote],
    ['finance note', financeNote],
    ['employee note', employeeNote],
    ['other-expenses note', otherExpensesNote],
    ['depreciation note', depreciationNote],
  ] as const) {
    if (note.unit.kind !== 'thousands') {
      return deferralResult(
        `${name} on page ${note.page_number} is not explicit thousands: ${note.unit.reason}`,
        'unit',
        {
          statement,
          other_income_note: otherIncomeNote,
          finance_note: financeNote,
          employee_note: employeeNote,
          other_expenses_note: otherExpensesNote,
          depreciation_note: depreciationNote,
          checks: statement.checks,
          warnings,
          pages_used: pagesUsed,
        },
      );
    }
    if (note.errors.length > 0) {
      return deferralResult(`${name} parse failed: ${note.errors.join('; ')}`, 'notes', {
        statement,
        other_income_note: otherIncomeNote,
        finance_note: financeNote,
        employee_note: employeeNote,
        other_expenses_note: otherExpensesNote,
        depreciation_note: depreciationNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      });
    }
  }

  const t = (value: number): number => thousands(value);
  const magnitude = (value: number): number => Math.abs(thousands(value));

  // Exact Note 2.2 check: grant income + other income = statement Other income.
  const otherIncomeComponents =
    t(otherIncomeNote.grant_income ?? 0) + t(otherIncomeNote.other_income ?? 0);
  if (
    otherIncomeNote.grant_income === null ||
    otherIncomeNote.other_income === null ||
    otherIncomeComponents !== t(statement.other_income)
  ) {
    return deferralResult(
      `Note 2.2 Other income mismatch: grant income ${otherIncomeNote.grant_income ?? 'missing'} + other income ${otherIncomeNote.other_income ?? 'missing'} = ${otherIncomeComponents}, statement Other income ${statement.other_income}`,
      'reconciliation',
      {
        statement,
        other_income_note: otherIncomeNote,
        finance_note: financeNote,
        employee_note: employeeNote,
        other_expenses_note: otherExpensesNote,
        depreciation_note: depreciationNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      },
    );
  }

  // Exact Note 2.3 checks: the four printed finance-income lines and finance costs.
  const financeIncomeComponents =
    t(financeNote.interest_from_bank ?? 0) +
    t(financeNote.net_interest_discounting ?? 0) +
    t(financeNote.interest_delayed_settlements ?? 0) +
    t(financeNote.interest_deferred_settlement ?? 0);
  if (
    financeNote.finance_income === null ||
    financeNote.finance_costs === null ||
    financeIncomeComponents !== t(statement.finance_income) ||
    magnitude(financeNote.finance_costs) !== statement.finance_costs
  ) {
    return deferralResult(
      `Note 2.3 finance mismatch: interest from bank ${financeNote.interest_from_bank ?? 'missing'} + net interest from discounting ${financeNote.net_interest_discounting ?? 'missing'} + delayed settlements ${financeNote.interest_delayed_settlements ?? 'missing'} + deferred settlements ${financeNote.interest_deferred_settlement ?? 'missing'} = ${financeIncomeComponents}, statement Finance income ${statement.finance_income}; lease interest ${financeNote.finance_costs ?? 'missing'}, statement Finance costs ${statement.finance_costs}`,
      'reconciliation',
      {
        statement,
        other_income_note: otherIncomeNote,
        finance_note: financeNote,
        employee_note: employeeNote,
        other_expenses_note: otherExpensesNote,
        depreciation_note: depreciationNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      },
    );
  }

  // Exact Note 2.4 check: gross components less capitalised = statement employee line.
  if (
    employeeNote.gross_employee_expenses === null ||
    employeeNote.net_employee_expenses === null ||
    magnitude(employeeNote.net_employee_expenses) !== statement.employee_expenses
  ) {
    return deferralResult(
      `Note 2.4 Employee related expenses mismatch: gross ${employeeNote.gross_employee_expenses ?? 'missing'} less capitalised ${employeeNote.amounts_capitalised ?? 'missing'} = ${employeeNote.net_employee_expenses ?? 'missing'}, statement Employee related expenses ${statement.employee_expenses}`,
      'reconciliation',
      {
        statement,
        other_income_note: otherIncomeNote,
        finance_note: financeNote,
        employee_note: employeeNote,
        other_expenses_note: otherExpensesNote,
        depreciation_note: depreciationNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      },
    );
  }

  // Exact Note 2.5 check: gross components less transfer to inventories = statement line.
  if (
    otherExpensesNote.gross_other_expenses === null ||
    otherExpensesNote.net_other_expenses === null ||
    magnitude(otherExpensesNote.net_other_expenses) !== statement.other_expenses
  ) {
    return deferralResult(
      `Note 2.5 Other expenses mismatch: gross ${otherExpensesNote.gross_other_expenses ?? 'missing'} less transfer to inventories ${otherExpensesNote.capital_costs_transferred ?? 'missing'} = ${otherExpensesNote.net_other_expenses ?? 'missing'}, statement Other expenses ${statement.other_expenses}`,
      'reconciliation',
      {
        statement,
        other_income_note: otherIncomeNote,
        finance_note: financeNote,
        employee_note: employeeNote,
        other_expenses_note: otherExpensesNote,
        depreciation_note: depreciationNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      },
    );
  }

  // Exact Note 2.6 check: components sum to the statement depreciation line.
  if (
    depreciationNote.total_depreciation_amortisation === null ||
    magnitude(depreciationNote.total_depreciation_amortisation) !==
      statement.depreciation_amortisation
  ) {
    return deferralResult(
      `Note 2.6 Depreciation and amortisation mismatch: components ${depreciationNote.total_depreciation_amortisation ?? 'missing'}, statement line ${statement.depreciation_amortisation}`,
      'reconciliation',
      {
        statement,
        other_income_note: otherIncomeNote,
        finance_note: financeNote,
        employee_note: employeeNote,
        other_expenses_note: otherExpensesNote,
        depreciation_note: depreciationNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      },
    );
  }

  const checks = [
    ...statement.checks,
    `Note 2.2 Other income exact: ${t(otherIncomeNote.grant_income)} + ${t(otherIncomeNote.other_income)} = ${otherIncomeComponents}`,
    `Note 2.3 Finance income exact: ${t(financeNote.interest_from_bank ?? 0)} + ${t(financeNote.net_interest_discounting ?? 0)} + ${t(financeNote.interest_delayed_settlements ?? 0)} + ${t(financeNote.interest_deferred_settlement ?? 0)} = ${financeIncomeComponents}`,
    `Note 2.4 Employee related expenses exact: gross ${employeeNote.gross_employee_expenses} less capitalised ${t(employeeNote.amounts_capitalised ?? 0)} = ${employeeNote.net_employee_expenses}`,
    `Note 2.5 Other expenses exact: gross ${otherExpensesNote.gross_other_expenses} less transfer to inventories ${t(otherExpensesNote.capital_costs_transferred ?? 0)} = ${otherExpensesNote.net_other_expenses}`,
    `Note 2.6 Depreciation and amortisation exact: ${t(depreciationNote.right_of_use_assets ?? 0)} + ${t(depreciationNote.leasehold_improvements ?? 0)} + ${t(depreciationNote.plant_and_equipment ?? 0)} + ${t(depreciationNote.intangible_assets ?? 0)} + ${t(depreciationNote.motor_vehicles ?? 0)} = ${depreciationNote.total_depreciation_amortisation}`,
  ];

  const lineSpecs: LandcomLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue (exact sum of printed revenue lines)',
      amount_thousands: t(statement.total_revenue),
      funding_source: LANDCOM_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'The statement prints no Total revenue subtotal. Total revenue is the exact signed sum of the printed revenue lines: revenue from contracts with customers + other income + finance income. Accepted only because it equals the printed Profit before income tax bridge with zero tolerance. Includes the separately shown Grant income line, which is never added again.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses (exact sum of printed expense lines)',
      amount_thousands: magnitude(statement.total_expenses),
      funding_source: LANDCOM_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'The statement prints no Total expenses subtotal. Total expenses is the exact signed sum of the printed expense lines: cost of sales + employee related expenses + other expenses + depreciation and amortisation expense + net fair value loss on investment properties + finance costs. Accepted only because it equals the printed Profit before income tax bridge with zero tolerance. A component of nothing; never add expense components again.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee related expenses',
      amount_thousands: statement.employee_expenses,
      funding_source: LANDCOM_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement line Employee related expenses. The printed Note 2.4 components sum to gross employee expenses of 43,968, less amounts capitalised of 14,231, giving the 29,737 statement line exactly. A component of Total expenses; never add to Total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation expense',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: LANDCOM_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement line Depreciation and amortisation expense. The printed Note 2.6 components (right of use assets + leasehold improvements + plant and equipment + intangible assets + motor vehicles) sum to it exactly. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'government_grants',
      label: 'Grant income',
      amount_thousands: t(otherIncomeNote.grant_income ?? 0),
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'revenue',
      detail:
        'Separately disclosed in Note 2.2 Other income and already included in total revenue. May overlap NSW government program spending; never add it to the total. The note states the grant relates to the development of residential dwellings in regional NSW.',
    },
    {
      line_item: 'net_result',
      label: 'Net profit for the year',
      amount_thousands: t(statement.net_result),
      funding_source: LANDCOM_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
      detail:
        'Printed Net profit for the year. A result line, not an expense component; never add to revenue or expenses.',
    },
  ];

  const records = lineSpecs.map((spec) =>
    mapLine(
      spec,
      context,
      statement,
      otherIncomeNote,
      financeNote,
      employeeNote,
      otherExpensesNote,
      depreciationNote,
    ),
  );
  warnings.push(
    'SOC entity rows are provisional and unverified; total revenue and total expenses are the exact signed sums of the printed statement lines because the statement prints no such subtotals, and every printed note and profit bridge reconciles exactly.',
  );
  return {
    records,
    deferral: null,
    statement,
    other_income_note: otherIncomeNote,
    finance_note: financeNote,
    employee_note: employeeNote,
    other_expenses_note: otherExpensesNote,
    depreciation_note: depreciationNote,
    checks,
    warnings,
    pages_used: pagesUsed,
  };
}

export interface LandcomConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: LandcomAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'landcom-annual-report.pdf';
}

/** Operator escape hatch: use an exact official PDF URL instead of live discovery. */
function documentFromEnv(): LandcomAnnualReportLink | null {
  const url = process.env.LANDCOM_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'landcom-annual-report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const yearMatch = ANNUAL_REPORT_FILENAME.exec(filename);
  if (!yearMatch?.[1]) {
    throw new Error(
      `LANDCOM_ANNUAL_REPORT_URL filename "${filename}" has no report year; cannot derive fiscal year`,
    );
  }
  const fiscalYear = landcomFiscalYearFromReportYear(Number(yearMatch[1]));
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: LANDCOM_SOURCE_URL,
  };
}

async function recordDeferral(
  document: LandcomAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: LandcomDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: LANDCOM_ID, document_url: document.url },
    {
      $set: {
        entity: LANDCOM_ENTITY,
        jurisdiction: LANDCOM_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Landcom SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Landcom connector. */
export function createLandcomConnector(options: LandcomConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: LANDCOM_ID,
    name: LANDCOM_NAME,
    publisher: LANDCOM_PUBLISHER,
    source_url: LANDCOM_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: LANDCOM_LICENSE,
    notes:
      'NSW SOC Phase 7: Landcom only. The latest annual report is discovered from Landcom\'s official corporate-publications page (no hard-coded PDF URL; an operator PDF-URL override exists), SHA-256 archived outside the repo, and parsed for the Statement of Comprehensive Income. The printed unit must be explicit $\'000; the statement prints no Total revenue or Total expenses subtotal, so both are the exact signed sums of the printed statement lines and are accepted only when the gross-profit, profit-before-tax, net-result and Note 2.2/2.3/2.4/2.5/2.6 bridges reconcile exactly. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). SOC rows are never added to government program spending, the PNFC benchmark, or each other. Other SOCs are not implemented.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverLandcomAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Landcom PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: LANDCOM_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Landcom annual-report PDF; archived for auditable NSW SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: LandcomParseContext = {
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
      const parsed = parseLandcomExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'landcom-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'landcom-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Landcom measure; skipped');
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
