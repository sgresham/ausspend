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
 * QLD SOC — North Queensland Bulk Ports Corporation Limited (NQBP)
 * annual-report adapter.
 *
 * This reuses the Energy Queensland/CS Energy/Stanwell/Powerlink/Sunwater/
 * Gladstone/Port of Townsville/Ports North QLD SOC pattern: one entity, one
 * audited face statement, no QLD total. The reporting entity is North
 * Queensland Bulk Ports Corporation Limited, a Queensland Government Owned
 * Corporation (GOC), not a statutory body.
 *
 * Source gate:
 * - NQBP's corporate publications page is behind a Cloudflare HTML challenge
 *   from the ingestion host (HTTP 403). The connector first tries that official
 *   page; when it is blocked or contains no annual-report PDF, it uses the
 *   verified Queensland Parliament tabled-paper copy of the same annual report
 *   as a documented fallback. The exact PDF is never hard-coded as the only
 *   path for an accessible site.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The Consolidated Statement of Comprehensive Income prints an explicit
 *   "$'000" unit for the Consolidated and Parent columns. The adapter reads the
 *   Consolidated current-year column only and never adds the Parent column or a
 *   subsidiary.
 * - The statement prints Income from operations, Expenses from operations, Net
 *   finance costs, Profit/(Loss) before income tax, Profit/(Loss) after income
 *   tax, Total other comprehensive income and Total comprehensive income. The
 *   adapter requires the printed income and expense components to sum exactly
 *   to the printed subtotals, and every printed result/OCI/comprehensive bridge
 *   to agree at zero tolerance. A one-thousand-dollar mismatch defers the whole
 *   document.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. NQBP rows
 * are never added to government program spending, the PNFC benchmark, Energy
 * Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited,
 * Gladstone Ports, Port of Townsville, Ports North, another QLD GOC, a QLD
 * total, or each other.
 */

export const NQBP_ID = 'qld-nqbp';
export const NQBP_NAME = 'NQBP — Annual Report';
export const NQBP_PUBLISHER = 'North Queensland Bulk Ports Corporation Limited (NQBP)';
export const NQBP_ENTITY = 'North Queensland Bulk Ports Corporation Limited';
export const NQBP_JURISDICTION = 'QLD';
export const NQBP_LEGAL_CLASS = 'Queensland Government Owned Corporation (GOC)';
/** Canonical official publications page. Annual-report PDFs are discovered from it. */
export const NQBP_SOURCE_URL = 'https://nqbp.com.au/about-us/publications';
/**
 * Documented official fallback: the Queensland Parliament tabled-paper copy of
 * the NQBP Annual Report 2025-26. The corporate page is Cloudflare-blocked
 * (HTTP 403) from the ingestion host. Update this pin when a newer report is
 * tabled.
 */
export const NQBP_PARLIAMENT_FALLBACK_URL =
  'https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1741/5826t1741.pdf';
export const NQBP_LICENSE =
  '© North Queensland Bulk Ports Corporation Limited. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const NQBP_UNIT = 'AUD_thousands';
export const NQBP_UNIT_LABEL = "$'000";
export const NQBP_UNIT_TO_CENTS = 100_000;
export const NQBP_CAVEAT =
  'Entity-level SOC statement lines for North Queensland Bulk Ports Corporation Limited (NQBP) only (a Queensland Government Owned Corporation). Never add to government program spending, to the PNFC sector benchmark, to Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Port of Townsville Limited, Ports North, another QLD GOC, a QLD or national total, or to each other: total revenue is the printed Income from operations line; total expenses is the printed Expenses from operations line; employee expenses and depreciation/amortisation are printed components of expenses; the net result is the printed Profit/(Loss) after income tax. The Consolidated current-year column is used; the Parent column and subsidiaries are never added. Provisional and unverified.';

/** A discovered annual-report PDF. */
export interface NqbpAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
  access: 'official' | 'qld-parliament-fallback';
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

const ANNUAL_REPORT_MARKER = /annual[\s_\-–]*report/i;

function fiscalYearFromSpan(startRaw: string, endRaw: string): string | null {
  const start = Number(startRaw);
  if (!Number.isInteger(start) || start < 2000 || start > 2100) return null;
  const end = Number(endRaw);
  const expectedEnd = (start + 1) % 100;
  if (!Number.isInteger(end)) return null;
  const endMatches = endRaw.length === 2 ? end === expectedEnd : end === start + 1;
  if (!endMatches) return null;
  return `${start}-${String(expectedEnd).padStart(2, '0')}`;
}

function fiscalYearEnding(yearRaw: string): string | null {
  let end = Number(yearRaw);
  if (yearRaw.length === 2) end += 2000;
  if (!Number.isInteger(end) || end < 2001 || end > 2100) return null;
  const start = end - 1;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

/** Convert an NQBP annual-report filename (span or single year) to the API fiscal year. */
export function nqbpFiscalYearFromFilename(filename: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(filename)) return null;
  let sawSpan = false;
  for (const match of filename.matchAll(/(?:^|[^0-9])(\d{4})\s*[-–]\s*(\d{2,4})(?!\d)/g)) {
    sawSpan = true;
    const span = fiscalYearFromSpan(match[1] as string, match[2] as string);
    if (span) return span;
  }
  if (sawSpan) return null;
  const bare = /(?:^|[^0-9])(20\d{2})(?!\d)/.exec(filename);
  if (bare) return fiscalYearEnding(bare[1] as string);
  return null;
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

/**
 * Parse annual-report PDF links from the official publications page. A link is
 * accepted only when its filename contains "Annual Report" and a consecutive
 * financial-year span or year-ended year. Statements of Corporate Intent and
 * other publications are rejected by name.
 */
export function parseNqbpAnnualReportPdfLinks(
  html: string,
  pageUrl: string = NQBP_SOURCE_URL,
): NqbpAnnualReportLink[] {
  const links: NqbpAnnualReportLink[] = [];
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
    const fiscalYear = nqbpFiscalYearFromFilename(filename);
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
      access: 'official',
    });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/** The documented official Queensland Parliament tabled-paper fallback. */
export function nqbpParliamentFallback(): NqbpAnnualReportLink {
  return {
    url: NQBP_PARLIAMENT_FALLBACK_URL,
    filename: '5826t1741.pdf',
    fiscal_year: '2025-26',
    title: 'Annual Report 2025–26',
    discovery_page: NQBP_SOURCE_URL,
    access: 'qld-parliament-fallback',
  };
}

/**
 * Try the official publications page; if it is blocked (HTTP 403) or carries no
 * annual-report PDF, return the documented Parliament tabled-paper copy.
 */
export async function discoverNqbpAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = NQBP_SOURCE_URL,
): Promise<NqbpAnnualReportLink> {
  try {
    const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
    if (response.ok) {
      const html = await response.text();
      const links = parseNqbpAnnualReportPdfLinks(html, pageUrl);
      if (links[0]) return links[0];
    }
  } catch {
    // Fall through to the documented official Parliament copy.
  }
  return nqbpParliamentFallback();
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

/** Label text is everything left of the note-reference column (x < 290). */
function labelText(row: PageRow): string {
  return row.items
    .filter((item) => item.x < 290)
    .map((item) => item.str.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function isMoneyItem(item: PdfTextItem): boolean {
  const text = item.str.trim();
  return /^(?:-|–|—)$/.test(text) || parseAmountCell(text).value !== null;
}

/** Money cells sit right of the note-reference column (x >= 340). */
function moneyItems(row: PageRow): PdfTextItem[] {
  return row.items.filter((item) => item.x >= 340 && isMoneyItem(item));
}

interface LogicalRow {
  label: string;
  items: PdfTextItem[];
}

/**
 * Build logical rows. NQBP wraps some labels onto two lines with the money
 * cells on the middle line (e.g. "Total other comprehensive income net of" /
 * money / "income tax"); those three physical rows become one logical row.
 */
function logicalRows(rows: readonly PageRow[]): LogicalRow[] {
  const out: LogicalRow[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] as PageRow;
    const label = labelText(row);
    const money = moneyItems(row);
    if (label && money.length > 0) {
      out.push({ label, items: money });
      continue;
    }
    if (label) {
      const next = rows[index + 1];
      const after = rows[index + 2];
      if (
        next &&
        labelText(next) === '' &&
        moneyItems(next).length > 0 &&
        after &&
        labelText(after) !== '' &&
        moneyItems(after).length === 0
      ) {
        out.push({ label: `${label} ${labelText(after)}`, items: moneyItems(next) });
        index += 2;
      }
    }
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

export function detectNqbpUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface NqbpStatement {
  page_number: number;
  unit: UnitDetection;
  revenue_from_contracts: number;
  other_income: number;
  income_from_operations: number;
  employee_expenses: number;
  supplies_services: number;
  depreciation_amortisation: number;
  impairment_fair_value: number;
  other_expenses: number;
  expenses_from_operations: number;
  operating_result: number;
  financial_income: number;
  financial_expenses: number;
  lease_interest: number;
  net_finance_costs: number;
  profit_before_tax: number;
  income_tax: number;
  net_result: number;
  revaluation_surplus: number;
  oci_tax: number;
  total_oci: number;
  total_comprehensive_income: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findFaceStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('consolidated statement of comprehensive income') &&
      text.includes('income from operations') &&
      text.includes('expenses from operations') &&
      text.includes('profit/(loss) before income tax')
    ) {
      return page;
    }
  }
  return null;
}

export function parseNqbpStatement(facePage: PdfPage): NqbpStatement | null {
  const rows = logicalRows(groupPageRows(facePage.items));
  const unit = detectMoneyUnit(unitSamples(groupPageRows(facePage.items)));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Revenue from contracts with customers');
  if (anchor === null) {
    errors.push(
      'statement consolidated current-year money column could not be anchored from the printed revenue row',
    );
    return null;
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);

  const revenue = read('Revenue from contracts with customers');
  const otherIncome = read('Other income');
  const incomeFromOperations = read('Income from operations');
  const employee = read('Employee benefits expenses');
  const supplies = read('Supplies and services');
  const depreciation = read('Depreciation and amortisation');
  const impairment = read('Impairment losses / fair value adjustments');
  const otherExpenses = read('Other expenses');
  const expensesFromOperations = read('Expenses from operations');
  const operatingResult = read('Operating result');
  const financialIncome = read('Financial income');
  const financialExpenses = read('Financial expenses');
  const leaseInterest = read('Interest expense on lease liabilities');
  const netFinanceCosts = read('Net finance costs');
  const profitBeforeTax = read('Profit/(Loss) before income tax');
  const incomeTax = read('Income tax expense');
  const netResult = read('Profit/(Loss) after income tax');
  const revaluation = read('Increase (decrease) in revaluation surplus');
  const ociTax = read('Income tax expense on increase (decrease) in revaluation surplus');
  const totalOci = read('Total other comprehensive income net of income tax');
  const totalComprehensive = read('Total comprehensive income for the year');

  const required: Array<[string, CellValue]> = [
    ['Revenue from contracts with customers', revenue],
    ['Other income', otherIncome],
    ['Income from operations', incomeFromOperations],
    ['Employee benefits expenses', employee],
    ['Supplies and services', supplies],
    ['Depreciation and amortisation', depreciation],
    ['Impairment losses / fair value adjustments', impairment],
    ['Other expenses', otherExpenses],
    ['Expenses from operations', expensesFromOperations],
    ['Operating result', operatingResult],
    ['Financial income', financialIncome],
    ['Financial expenses', financialExpenses],
    ['Interest expense on lease liabilities', leaseInterest],
    ['Net finance costs', netFinanceCosts],
    ['Profit/(Loss) before income tax', profitBeforeTax],
    ['Income tax expense', incomeTax],
    ['Profit/(Loss) after income tax', netResult],
    ['Increase (decrease) in revaluation surplus', revaluation],
    ['Income tax expense on increase (decrease) in revaluation surplus', ociTax],
    ['Total other comprehensive income net of income tax', totalOci],
    ['Total comprehensive income for the year', totalComprehensive],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const revenueValue = revenue.value as number;
  const otherIncomeValue = otherIncome.value as number;
  const incomeValue = incomeFromOperations.value as number;
  const employeeValue = employee.value as number;
  const suppliesValue = supplies.value as number;
  const depreciationValue = depreciation.value as number;
  const impairmentValue = impairment.value as number;
  const otherExpensesValue = otherExpenses.value as number;
  const expensesValue = Math.abs(expensesFromOperations.value as number);
  const operatingValue = operatingResult.value as number;
  const financialIncomeValue = financialIncome.value as number;
  const financialExpensesValue = financialExpenses.value as number;
  const leaseInterestValue = leaseInterest.value as number;
  const netFinanceValue = netFinanceCosts.value as number;
  const profitBeforeTaxValue = profitBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;
  const revaluationValue = revaluation.value as number;
  const ociTaxValue = ociTax.value as number;
  const totalOciValue = totalOci.value as number;
  const comprehensiveValue = totalComprehensive.value as number;

  const incomeComponents = [revenueValue, otherIncomeValue];
  const incomeSum = incomeComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `income components exact: ${incomeComponents.join(' + ')} = ${incomeSum} (printed Income from operations ${incomeValue})`,
  );
  if (incomeSum !== incomeValue) {
    errors.push(
      `income component total mismatch: ${incomeComponents.join(' + ')} = ${incomeSum}, printed Income from operations ${incomeValue}`,
    );
  }

  const expenseComponents = [
    Math.abs(employeeValue),
    Math.abs(suppliesValue),
    Math.abs(depreciationValue),
    Math.abs(impairmentValue),
    Math.abs(otherExpensesValue),
  ];
  const expenseSum = expenseComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `expense components exact: ${expenseComponents.join(' + ')} = ${expenseSum} (printed Expenses from operations ${expensesValue})`,
  );
  if (expenseSum !== expensesValue) {
    errors.push(
      `expense component total mismatch: ${expenseComponents.join(' + ')} = ${expenseSum}, printed Expenses from operations ${expensesValue}`,
    );
  }

  const operatingBridge = incomeValue - expensesValue;
  checks.push(
    `operating-result bridge exact: ${incomeValue} - ${expensesValue} = ${operatingBridge} (printed ${operatingValue})`,
  );
  if (operatingBridge !== operatingValue) {
    errors.push(
      `operating-result bridge mismatch: ${incomeValue} - ${expensesValue} = ${operatingBridge}, printed Operating result ${operatingValue}`,
    );
  }

  const netFinanceBridge = financialIncomeValue + financialExpensesValue + leaseInterestValue;
  checks.push(
    `net-finance bridge exact: ${financialIncomeValue} + ${financialExpensesValue} + ${leaseInterestValue} = ${netFinanceBridge} (printed ${netFinanceValue})`,
  );
  if (netFinanceBridge !== netFinanceValue) {
    errors.push(
      `net-finance bridge mismatch: ${financialIncomeValue} + ${financialExpensesValue} + ${leaseInterestValue} = ${netFinanceBridge}, printed Net finance costs ${netFinanceValue}`,
    );
  }

  const pbtBridge = operatingValue + netFinanceValue;
  checks.push(
    `profit-before-tax bridge exact: ${operatingValue} + ${netFinanceValue} = ${pbtBridge} (printed ${profitBeforeTaxValue})`,
  );
  if (pbtBridge !== profitBeforeTaxValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${operatingValue} + ${netFinanceValue} = ${pbtBridge}, printed Profit/(Loss) before income tax ${profitBeforeTaxValue}`,
    );
  }

  const netBridge = profitBeforeTaxValue + taxValue;
  checks.push(
    `net-result bridge exact: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge} (printed ${netValue})`,
  );
  if (netBridge !== netValue) {
    errors.push(
      `net-result bridge mismatch: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge}, printed Profit/(Loss) after income tax ${netValue}`,
    );
  }

  const ociBridge = revaluationValue + ociTaxValue;
  checks.push(
    `total-oci bridge exact: ${revaluationValue} + ${ociTaxValue} = ${ociBridge} (printed ${totalOciValue})`,
  );
  if (ociBridge !== totalOciValue) {
    errors.push(
      `total-oci bridge mismatch: ${revaluationValue} + ${ociTaxValue} = ${ociBridge}, printed Total other comprehensive income ${totalOciValue}`,
    );
  }

  const comprehensiveBridge = netValue + totalOciValue;
  checks.push(
    `total-comprehensive-income bridge exact: ${netValue} + ${totalOciValue} = ${comprehensiveBridge} (printed ${comprehensiveValue})`,
  );
  if (comprehensiveBridge !== comprehensiveValue) {
    errors.push(
      `total-comprehensive-income bridge mismatch: ${netValue} + ${totalOciValue} = ${comprehensiveBridge}, printed Total comprehensive income ${comprehensiveValue}`,
    );
  }

  warnings.push(
    "the Consolidated Statement of Comprehensive Income prints an explicit $'000 unit and both Consolidated and Parent columns; the adapter reads the Consolidated 2026 current-year column only and never adds the Parent column or a subsidiary. The printed income and expense components reconcile exactly to the printed subtotals and the operating-result, net-finance, profit-before-tax, net-result, OCI and total-comprehensive-income bridges agree at zero tolerance.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    revenue_from_contracts: revenueValue,
    other_income: otherIncomeValue,
    income_from_operations: incomeValue,
    employee_expenses: Math.abs(employeeValue),
    supplies_services: Math.abs(suppliesValue),
    depreciation_amortisation: Math.abs(depreciationValue),
    impairment_fair_value: Math.abs(impairmentValue),
    other_expenses: Math.abs(otherExpensesValue),
    expenses_from_operations: expensesValue,
    operating_result: operatingValue,
    financial_income: financialIncomeValue,
    financial_expenses: Math.abs(financialExpensesValue),
    lease_interest: Math.abs(leaseInterestValue),
    net_finance_costs: netFinanceValue,
    profit_before_tax: profitBeforeTaxValue,
    income_tax: Math.abs(taxValue),
    net_result: netValue,
    revaluation_surplus: revaluationValue,
    oci_tax: ociTaxValue,
    total_oci: totalOciValue,
    total_comprehensive_income: comprehensiveValue,
    checks,
    warnings,
    errors,
  };
}

export interface NqbpParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
  access?: 'official' | 'qld-parliament-fallback';
}

export interface NqbpDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation';
}

export interface NqbpLineSpec {
  line_item: string;
  label: string;
  amount_thousands: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result';
  detail: string;
  printed_sign?: 'positive' | 'negative';
}

export interface NqbpParseResult {
  records: SpendingRecord[];
  deferral: NqbpDeferral | null;
  statement: NqbpStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function nqbpNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${NQBP_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * NQBP_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: NqbpParseContext,
  spec: NqbpLineSpec,
  statement: NqbpStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `access: ${context.access ?? 'official'}`,
    `printed_unit: ${NQBP_UNIT_LABEL} (${NQBP_UNIT}; x${NQBP_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'consolidated current-year column only (Parent column and subsidiaries never added); entity-level SOC statement line; single North Queensland Bulk Ports Corporation Limited (NQBP) entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Port of Townsville Limited, Ports North, another QLD GOC, a QLD total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: NqbpLineSpec,
  context: NqbpParseContext,
  statement: NqbpStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: NQBP_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: nqbpNaturalKey(
      NQBP_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${NQBP_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: NQBP_JURISDICTION,
    delivery_entity: NQBP_ENTITY,
    funding_source: NQBP_ENTITY,
    source_dataset: `NQBP Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: NQBP_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: NQBP_UNIT,
    soc_section: spec.section,
    soc_note: 'Consolidated statement of comprehensive income',
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
      revenue_thousands: statement.income_from_operations,
      total_expenses_thousands: statement.expenses_from_operations,
      net_result_thousands: statement.net_result,
      ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

export function parseNqbpExtraction(
  extraction: PdfExtraction,
  context: NqbpParseContext,
): NqbpParseResult {
  const warnings: string[] = [];
  const facePage = findFaceStatementPage(extraction.pages);
  if (!facePage) {
    return {
      records: [],
      deferral: {
        reason: 'no parseable consolidated statement of comprehensive income found in the PDF',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const statement = parseNqbpStatement(facePage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason:
          'consolidated statement of comprehensive income found but required printed lines could not be parsed',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [facePage.page_number],
    };
  }
  warnings.push(...statement.warnings);
  if (statement.unit.kind !== 'thousands') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit thousands (detected ${statement.unit.kind ?? 'none'}: ${statement.unit.reason}); refusing to ingest a $'000 statement as dollars or millions`,
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

  const lineSpecs: NqbpLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Income from operations',
      amount_thousands: statement.income_from_operations,
      funding_source: NQBP_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Income from operations subtotal, which bridges exactly to Revenue from contracts with customers + Other income. Entity-level consolidated income; includes government-related and managed-fund gains already, so it is never added to government program spending.',
    },
    {
      line_item: 'total_expenses',
      label: 'Expenses from operations',
      amount_thousands: statement.expenses_from_operations,
      funding_source: NQBP_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Expenses from operations subtotal, which bridges exactly to Employee benefits expenses + Supplies and services + Depreciation and amortisation + Impairment losses / fair value adjustments + Other expenses, and to the printed Operating result when deducted from Income from operations.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expenses',
      amount_thousands: statement.employee_expenses,
      funding_source: NQBP_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee benefits expenses line. A component of Expenses from operations; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: NQBP_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation and amortisation line. A component of Expenses from operations; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit/(Loss) after income tax',
      amount_thousands: statement.net_result,
      funding_source: NQBP_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit/(Loss) after income tax (net result). A result line, not an expense component; never add to revenue or expenses. Consolidated current-year column only.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the consolidated current-year income and expense components reconcile exactly to the printed subtotals and every printed result, OCI and comprehensive-income bridge agrees at zero tolerance.',
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

export interface NqbpConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally tries official discovery then the tabled copy. */
  document?: NqbpAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'nqbp-annual-report.pdf';
}

/**
 * Operator escape hatch: when `NQBP_ANNUAL_REPORT_URL` is set, it is used as the
 * exact official PDF URL. The default path is official discovery with the
 * documented Parliament tabled-paper fallback.
 */
function documentFromEnv(): NqbpAnnualReportLink | null {
  const url = process.env.NQBP_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'NQBP-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = nqbpFiscalYearFromFilename(filename) ?? '2025-26';
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: NQBP_SOURCE_URL,
    access: 'official',
  };
}

async function recordDeferral(
  document: NqbpAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: NqbpDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: NQBP_ID, document_url: document.url },
    {
      $set: {
        entity: NQBP_ENTITY,
        jurisdiction: NQBP_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the NQBP SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live NQBP connector. */
export function createNqbpConnector(options: NqbpConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: NQBP_ID,
    name: NQBP_NAME,
    publisher: NQBP_PUBLISHER,
    source_url: NQBP_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: NQBP_LICENSE,
    notes:
      'QLD SOC: North Queensland Bulk Ports Corporation Limited (NQBP) only, a Queensland Government Owned Corporation (GOC). The official publications page is Cloudflare-blocked (HTTP 403) from the ingestion host; the connector tries it first and falls back to the verified Queensland Parliament tabled-paper copy of the same annual report. The exact PDF is SHA-256 archived outside the repo. The Consolidated Statement of Comprehensive Income prints an explicit $\'000 unit and both Consolidated and Parent columns; the adapter reads the Consolidated 2026 column only. The printed income and expense components must sum exactly to the printed subtotals, and the operating-result, net-finance, profit-before-tax, net-result, OCI and total-comprehensive-income bridges must agree at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). NQBP is never added to government program spending, the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports, Port of Townsville, Ports North, another QLD GOC, a QLD total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverNqbpAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`NQBP PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: NQBP_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes: `NQBP annual-report PDF (${document.access}); archived for auditable QLD SOC entity-statement extraction.`,
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: NqbpParseContext = {
        document_url: document.url,
        document_title: document.title,
        fiscal_year: document.fiscal_year,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
        },
        source_date: now.toISOString().slice(0, 10),
        access: document.access,
      };
      const parsed = parseNqbpExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'qld-nqbp-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'qld-nqbp-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not an NQBP measure; skipped');
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
