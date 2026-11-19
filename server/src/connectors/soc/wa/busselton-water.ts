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
 * WA SOC — Busselton Water annual-report adapter.
 *
 * This is the next WA Government Trading Enterprise (GTE) pilot and reuses the
 * WA Water Corporation/Synergy/Western Power/Horizon Power/Fremantle
 * Ports/DevelopmentWA/Southern Ports SOC pattern: one entity, one audited face
 * statement, no jurisdiction total. Busselton Water is the Busselton Water
 * Corporation, a WA GTE under the Government Trading Enterprises Act 2023 (WA),
 * not a Queensland GOC or an NSW SOC.
 *
 * Source gate:
 * - The latest report is discovered from the official annual-reports page; no
 *   PDF URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The Statement of Comprehensive Income prints an explicit "$" (whole
 *   dollars) unit for the 2026 and 2025 columns. A table read as thousands or
 *   millions is rejected, not converted by magnitude.
 * - The statement prints a Total expenses subtotal and an unlabeled total-income
 *   row. Total revenue is derived as the exact sum of the six printed income
 *   lines and checked against the unlabeled printed total; total expenses is
 *   derived as the exact sum of the seven printed expense lines and checked
 *   against the printed Total expenses. Both are accepted only when Profit
 *   before income tax and Profit after income tax reconcile at zero tolerance.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Busselton
 * Water rows are never added to government program spending, the PNFC
 * benchmark, Water Corporation, Synergy, Western Power, Horizon Power,
 * Fremantle Ports, DevelopmentWA, Southern Ports, another WA GTE, a QLD/NSW
 * SOC, a WA total, or each other.
 */

export const BUSSELTON_WATER_ID = 'wa-busselton-water';
export const BUSSELTON_WATER_NAME = 'Busselton Water — Annual Report';
export const BUSSELTON_WATER_PUBLISHER = 'Busselton Water Corporation';
export const BUSSELTON_WATER_ENTITY = 'Busselton Water';
export const BUSSELTON_WATER_JURISDICTION = 'WA';
export const BUSSELTON_WATER_LEGAL_CLASS =
  'WA Government Trading Enterprise (GTE) — Government Trading Enterprises Act 2023 (WA)';
/** Canonical official annual-reports page. Annual-report PDFs are discovered from it. */
export const BUSSELTON_WATER_SOURCE_URL =
  'https://www.busseltonwater.wa.gov.au/publications/annual-reports/';
export const BUSSELTON_WATER_LICENSE =
  '© Busselton Water. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const BUSSELTON_WATER_UNIT = 'AUD';
export const BUSSELTON_WATER_UNIT_LABEL = '$';
export const BUSSELTON_WATER_UNIT_TO_CENTS = 100;
export const BUSSELTON_WATER_CAVEAT =
  'Entity-level SOC statement lines for Busselton Water only (Busselton Water Corporation, a WA Government Trading Enterprise under the Government Trading Enterprises Act 2023 (WA)). Never add to government program spending, to the PNFC sector benchmark, to Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, another WA GTE, to a QLD/NSW SOC, a WA or national total, or to each other: total revenue is the exact sum of the printed income lines, checked against the unlabeled printed total; total expenses is the exact sum of the printed expense lines, checked against the printed Total expenses subtotal; employee benefits and depreciation/amortisation are printed components of total expenses; the net result is the printed Profit after income tax. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface BusseltonWaterAnnualReportLink {
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
  /water[\s_\-–]*quality[\s_\-–]*report|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|corporate[\s_\-–]*plan/i;

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
  const end = Number(yearRaw);
  if (!Number.isInteger(end) || end < 2001 || end > 2100) return null;
  const start = end - 1;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

/** Convert a Busselton Water annual-report filename to the API fiscal year. */
export function busseltonWaterFiscalYearFromFilename(filename: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(filename) || NON_ANNUAL_REPORT.test(filename)) return null;
  let sawSpan = false;
  for (const match of filename.matchAll(/(?:^|[^0-9])(\d{4})\s*[-–]\s*(\d{2,4})(?!\d)/g)) {
    sawSpan = true;
    const span = fiscalYearFromSpan(match[1] as string, match[2] as string);
    if (span) return span;
  }
  if (sawSpan) return null;
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

/**
 * Parse annual-report PDF links from the official annual-reports page. A link is
 * accepted only when its filename contains "annual report" and a year; annual
 * water-quality reports, corporate plans and the SCI are rejected by name.
 */
export function parseBusseltonWaterAnnualReportPdfLinks(
  html: string,
  pageUrl: string = BUSSELTON_WATER_SOURCE_URL,
): BusseltonWaterAnnualReportLink[] {
  const links: BusseltonWaterAnnualReportLink[] = [];
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
    const fiscalYear = busseltonWaterFiscalYearFromFilename(filename);
    if (!fiscalYear) continue;
    const key = `${url.origin}${url.pathname}`;
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
 * Fetch the official annual-reports page and return its newest annual-report
 * PDF. No PDF URL is hard-coded; a page with no annual-report link is an error.
 */
export async function discoverBusseltonWaterAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = BUSSELTON_WATER_SOURCE_URL,
): Promise<BusseltonWaterAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (error) {
    throw new Error(
      `Busselton Water annual-reports page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Busselton Water annual-reports page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parseBusseltonWaterAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Busselton Water annual-reports page contains no annual-report PDF link; refusing to hard-code a URL',
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

/** Label text is everything left of the note-reference column (x < 400). */
function labelText(row: PageRow, maxX = 400): string {
  return row.items
    .filter((item) => item.x < maxX)
    .map((item) => item.str.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function isMoneyItem(item: PdfTextItem): boolean {
  const text = item.str.trim();
  return /^(?:-|–|—)$/.test(text) || parseAmountCell(text).value !== null;
}

/** Money cells sit right of the note-reference column (620 <= x < 820). */
function moneyCells(row: PageRow): PdfTextItem[] {
  return row.items.filter((item) => item.x >= 620 && item.x < 820 && isMoneyItem(item));
}

interface LogicalRow {
  label: string;
  items: PdfTextItem[];
}

function logicalRows(rows: readonly PageRow[]): LogicalRow[] {
  const out: LogicalRow[] = [];
  for (const row of rows) {
    const label = labelText(row);
    const money = moneyCells(row);
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
    if (parsed.value === null || Math.abs(parsed.value) < 100) continue;
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

/**
 * Read the unlabeled printed total-income row immediately above the printed
 * Profit before income tax line. Busselton Water prints the total as a bare
 * numbers row with no label.
 */
function printedTotalIncome(
  physicalRows: readonly PageRow[],
  anchor: number,
): CellValue {
  const index = physicalRows.findIndex((row) =>
    labelText(row).toLowerCase().startsWith('profit before income tax'),
  );
  if (index === -1) return { value: null, found: false, nil: false };
  for (let i = index - 1; i >= 0; i -= 1) {
    const row = physicalRows[i] as PageRow;
    if (labelText(row).length > 0) continue;
    const money = moneyCells(row);
    if (money.length === 0) continue;
    return cellNear({ label: '', items: money }, anchor);
  }
  return { value: null, found: false, nil: false };
}

function unitSamples(rows: readonly PageRow[]): string[] {
  return rows
    .filter((row) => row.cells.some((cell) => cell.includes('$')))
    .map((row) => row.cells.join(' '));
}

export function detectBusseltonWaterUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface BusseltonWaterStatement {
  page_number: number;
  unit: UnitDetection;
  water_sales_revenue: number;
  grants_contributions: number;
  developer_headworks: number;
  developer_mains: number;
  interest_income: number;
  other_revenue: number;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  cost_of_sales: number;
  depreciation_amortisation: number;
  finance_costs: number;
  administration_expenses: number;
  other_expenses: number;
  loss_on_disposal: number;
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
      text.includes('employee benefit expenses') &&
      text.includes('total expenses') &&
      text.includes('profit before income tax') &&
      text.includes('profit after income tax')
    ) {
      return page;
    }
  }
  return null;
}

export function parseBusseltonWaterStatement(
  facePage: PdfPage,
): BusseltonWaterStatement | null {
  const physicalRows = groupPageRows(facePage.items);
  const rows = logicalRows(physicalRows);
  const unit = detectMoneyUnit(unitSamples(physicalRows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Employee benefit expenses');
  if (anchor === null) {
    errors.push(
      'statement 2026 money column could not be anchored from the printed employee-expenses row',
    );
    return null;
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);

  const employee = read('Employee benefit expenses');
  const costOfSales = read('Cost of sales');
  const depreciation = read('Depreciation and amortisation expenses');
  const financeCosts = read('Finance costs');
  const administration = read('Administration expenses');
  const otherExpenses = read('Other expenses');
  const lossOnDisposal = read('Loss on disposal of non-current assets');
  const totalExpense = read('Total expenses');
  const waterSales = read('Water sales revenue');
  const grants = read('Grants and contributions');
  const devHeadworks = read('Developer contributions - headworks');
  const devMains = read('Developer contributions - mains');
  const interestIncome = read('Interest income');
  const otherRevenue = read('Other revenue');
  const profitBeforeTax = read('Profit before income tax');
  const incomeTax = read('Income tax equivalent expense');
  const netResult = read('Profit after income tax');
  const printedTotal = printedTotalIncome(physicalRows, anchor);

  const required: Array<[string, CellValue]> = [
    ['Employee benefit expenses', employee],
    ['Cost of sales', costOfSales],
    ['Depreciation and amortisation expenses', depreciation],
    ['Finance costs', financeCosts],
    ['Administration expenses', administration],
    ['Other expenses', otherExpenses],
    ['Loss on disposal of non-current assets', lossOnDisposal],
    ['Total expenses', totalExpense],
    ['Water sales revenue', waterSales],
    ['Grants and contributions', grants],
    ['Developer contributions - headworks', devHeadworks],
    ['Developer contributions - mains', devMains],
    ['Interest income', interestIncome],
    ['Other revenue', otherRevenue],
    ['Profit before income tax', profitBeforeTax],
    ['Income tax equivalent expense', incomeTax],
    ['Profit after income tax', netResult],
    ['Unlabeled printed total income row', printedTotal],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const employeeValue = employee.value as number;
  const costValue = costOfSales.value as number;
  const depreciationValue = depreciation.value as number;
  const financeValue = financeCosts.value as number;
  const adminValue = administration.value as number;
  const otherExpensesValue = otherExpenses.value as number;
  const lossValue = lossOnDisposal.value as number;
  const printedExpenses = totalExpense.value as number;
  const waterSalesValue = waterSales.value as number;
  const grantsValue = grants.value as number;
  const headworksValue = devHeadworks.value as number;
  const mainsValue = devMains.value as number;
  const interestValue = interestIncome.value as number;
  const otherRevenueValue = otherRevenue.value as number;
  const profitBeforeTaxValue = profitBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;
  const printedTotalValue = printedTotal.value as number;

  const expenseComponents = [
    employeeValue,
    costValue,
    depreciationValue,
    financeValue,
    adminValue,
    otherExpensesValue,
    lossValue,
  ];
  const totalExpenses = expenseComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `expense components exact: ${expenseComponents.join(' + ')} = ${totalExpenses} (printed Total expenses ${printedExpenses})`,
  );
  if (totalExpenses !== printedExpenses) {
    errors.push(
      `expense component total mismatch: ${expenseComponents.join(' + ')} = ${totalExpenses}, printed Total expenses ${printedExpenses}`,
    );
  }

  const incomeComponents = [
    waterSalesValue,
    grantsValue,
    headworksValue,
    mainsValue,
    interestValue,
    otherRevenueValue,
  ];
  const totalRevenue = incomeComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `total revenue exact: ${incomeComponents.join(' + ')} = ${totalRevenue} (printed unlabeled total ${printedTotalValue})`,
  );
  if (totalRevenue !== printedTotalValue) {
    errors.push(
      `income component total mismatch: ${incomeComponents.join(' + ')} = ${totalRevenue}, printed total-income row ${printedTotalValue}`,
    );
  }

  const profitBeforeTaxBridge = totalRevenue - printedExpenses;
  checks.push(
    `profit-before-tax bridge exact: ${totalRevenue} - ${printedExpenses} = ${profitBeforeTaxBridge} (printed ${profitBeforeTaxValue})`,
  );
  if (profitBeforeTaxBridge !== profitBeforeTaxValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${totalRevenue} - ${printedExpenses} = ${profitBeforeTaxBridge}, printed Profit before income tax ${profitBeforeTaxValue}`,
    );
  }

  const netBridge = profitBeforeTaxValue + taxValue;
  checks.push(
    `net-result bridge exact: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge} (printed ${netValue})`,
  );
  if (netBridge !== netValue) {
    errors.push(
      `net-result bridge mismatch: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge}, printed Profit after income tax ${netValue}`,
    );
  }

  warnings.push(
    "the Statement of Comprehensive Income prints an explicit $ (whole-dollar) unit and two reporting-year columns; the adapter reads the 2026 column only. Total expenses is the exact sum of the printed expense lines and is checked against the printed Total expenses subtotal. Total revenue is the exact sum of the printed income lines and is checked against the unlabeled printed total-income row; both are accepted only because the Profit before income tax and Profit after income tax bridges agree at zero tolerance.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    water_sales_revenue: waterSalesValue,
    grants_contributions: grantsValue,
    developer_headworks: headworksValue,
    developer_mains: mainsValue,
    interest_income: interestValue,
    other_revenue: otherRevenueValue,
    total_revenue: totalRevenue,
    total_expenses: printedExpenses,
    employee_expenses: employeeValue,
    cost_of_sales: costValue,
    depreciation_amortisation: depreciationValue,
    finance_costs: financeValue,
    administration_expenses: adminValue,
    other_expenses: otherExpensesValue,
    loss_on_disposal: lossValue,
    profit_before_tax: profitBeforeTaxValue,
    income_tax: Math.abs(taxValue),
    net_result: netValue,
    checks,
    warnings,
    errors,
  };
}

export interface BusseltonWaterParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface BusseltonWaterDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation';
}

export interface BusseltonWaterLineSpec {
  line_item: string;
  label: string;
  amount_dollars: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result';
  detail: string;
  printed_sign?: 'positive' | 'negative';
}

export interface BusseltonWaterParseResult {
  records: SpendingRecord[];
  deferral: BusseltonWaterDeferral | null;
  statement: BusseltonWaterStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function busseltonWaterNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${BUSSELTON_WATER_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(dollars: number): number {
  const cents = Math.abs(dollars) * BUSSELTON_WATER_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${dollars} dollars exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: BusseltonWaterParseContext,
  spec: BusseltonWaterLineSpec,
  statement: BusseltonWaterStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${BUSSELTON_WATER_UNIT_LABEL} (${BUSSELTON_WATER_UNIT}; x${BUSSELTON_WATER_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    '2026 column only (prior column never added); entity-level SOC statement line; single Busselton Water entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: BusseltonWaterLineSpec,
  context: BusseltonWaterParseContext,
  statement: BusseltonWaterStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_dollars),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: BUSSELTON_WATER_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: busseltonWaterNaturalKey(
      BUSSELTON_WATER_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${BUSSELTON_WATER_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: BUSSELTON_WATER_JURISDICTION,
    delivery_entity: BUSSELTON_WATER_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Busselton Water Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: BUSSELTON_WATER_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: BUSSELTON_WATER_UNIT,
    soc_section: spec.section,
    soc_note: 'Statement of Comprehensive Income',
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
      revenue_dollars: statement.total_revenue,
      total_expenses_dollars: statement.total_expenses,
      net_result_dollars: statement.net_result,
      ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

export function parseBusseltonWaterExtraction(
  extraction: PdfExtraction,
  context: BusseltonWaterParseContext,
): BusseltonWaterParseResult {
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
  const statement = parseBusseltonWaterStatement(facePage);
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
  if (statement.unit.kind !== 'dollars') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit whole dollars (detected ${statement.unit.kind ?? 'none'}: ${statement.unit.reason}); refusing to ingest a non-dollar statement`,
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

  const lineSpecs: BusseltonWaterLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_dollars: statement.total_revenue,
      funding_source: BUSSELTON_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Exact sum of the printed Water sales revenue + Grants and contributions + Developer contributions - headworks + Developer contributions - mains + Interest income + Other revenue lines, checked against the unlabeled printed total-income row. Includes government grants and developer contributions already, so it is never added to government program spending.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_dollars: statement.total_expenses,
      funding_source: BUSSELTON_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Total expenses subtotal, which equals the exact sum of Employee benefit expenses + Cost of sales + Depreciation and amortisation expenses + Finance costs + Administration expenses + Other expenses + Loss on disposal of non-current assets.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefit expenses',
      amount_dollars: statement.employee_expenses,
      funding_source: BUSSELTON_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee benefit expenses line. A component of total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation expenses',
      amount_dollars: statement.depreciation_amortisation,
      funding_source: BUSSELTON_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation and amortisation expenses line. A component of total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit after income tax',
      amount_dollars: statement.net_result,
      funding_source: BUSSELTON_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit after income tax (net result). A result line, not an expense component; never add to revenue or expenses. 2026 column only.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the 2026 income and expense components reconcile exactly to the printed totals and every printed result bridge agrees at zero tolerance.',
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

export interface BusseltonWaterConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: BusseltonWaterAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'busselton-water-annual-report.pdf';
}

/**
 * Operator escape hatch: when `WA_BUSSELTON_WATER_ANNUAL_REPORT_URL` is set, it
 * is used as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): BusseltonWaterAnnualReportLink | null {
  const url = process.env.WA_BUSSELTON_WATER_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Busselton-Water-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = busseltonWaterFiscalYearFromFilename(filename) ?? '2025-26';
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: BUSSELTON_WATER_SOURCE_URL,
  };
}

async function recordDeferral(
  document: BusseltonWaterAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: BusseltonWaterDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: BUSSELTON_WATER_ID, document_url: document.url },
    {
      $set: {
        entity: BUSSELTON_WATER_ENTITY,
        jurisdiction: BUSSELTON_WATER_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Busselton Water SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Busselton Water connector. */
export function createBusseltonWaterConnector(
  options: BusseltonWaterConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: BUSSELTON_WATER_ID,
    name: BUSSELTON_WATER_NAME,
    publisher: BUSSELTON_WATER_PUBLISHER,
    source_url: BUSSELTON_WATER_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: BUSSELTON_WATER_LICENSE,
    notes:
      'WA SOC: Busselton Water only (Busselton Water Corporation), a WA Government Trading Enterprise (Government Trading Enterprises Act 2023 (WA)). The latest annual report is discovered from the official annual-reports page (no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo. The Statement of Comprehensive Income prints an explicit $ (whole-dollar) unit and two reporting-year columns; the adapter reads the 2026 column only. Total revenue is the exact sum of the printed income lines checked against the unlabeled printed total, and total expenses is the exact sum of the printed expense lines checked against the printed Total expenses subtotal; both are accepted only when the Profit before income tax and Profit after income tax bridges agree at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Busselton Water is never added to government program spending, the PNFC benchmark, Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, another WA GTE, a QLD/NSW SOC, a WA total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverBusseltonWaterAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Busselton Water PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: BUSSELTON_WATER_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Busselton Water annual-report PDF; archived for auditable WA SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: BusseltonWaterParseContext = {
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
      const parsed = parseBusseltonWaterExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'wa-busselton-water-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'wa-busselton-water-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Busselton Water measure; skipped');
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
