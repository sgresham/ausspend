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
 * WA SOC — Synergy annual-report adapter.
 *
 * This is the second WA Government Trading Enterprise (GTE) pilot and reuses
 * the WA Water Corporation SOC pattern: one entity, one audited face statement,
 * no jurisdiction total. It lives in the WA namespace and legal class: Synergy
 * is a WA Government Trading Enterprise (a corporation under the Electricity
 * Corporations Act 2005 (WA)), not a Queensland GOC or an NSW SOC.
 *
 * Source gate:
 * - The official annual-reports page lists annual-report landing pages; the
 *   newest landing page carries the PDF. No PDF URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The Statement of profit or loss prints an explicit "$'000" unit for the
 *   Group 2026/2025 and Corporation 2026/2025 columns. A table read as dollars
 *   or millions is rejected, not converted by magnitude.
 * - The adapter reads the Group 2026 current-year column only. The Corporation
 *   column and subsidiaries are never added.
 * - The statement prints Total revenue, Total expenses, Net finance costs, Loss
 *   before tax and Loss for the year. The adapter requires the printed revenue
 *   and expense components to sum exactly to those subtotals and every printed
 *   result bridge to agree at zero tolerance (a one-thousand-dollar mismatch
 *   defers the whole document).
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Synergy
 * rows are never added to government program spending, the PNFC benchmark,
 * Water Corporation, another WA GTE, a QLD/NSW SOC, a WA total, or each other.
 */

export const SYNERGY_ID = 'wa-synergy';
export const SYNERGY_NAME = 'Synergy — Annual Report';
export const SYNERGY_PUBLISHER = 'Synergy';
export const SYNERGY_ENTITY = 'Synergy';
export const SYNERGY_JURISDICTION = 'WA';
export const SYNERGY_LEGAL_CLASS =
  'WA Government Trading Enterprise (GTE) — Electricity Corporations Act 2005 (WA)';
/** Canonical official annual-reports page. Annual-report PDFs are discovered from it. */
export const SYNERGY_SOURCE_URL =
  'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports';
export const SYNERGY_LICENSE =
  '© Synergy. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const SYNERGY_UNIT = 'AUD_thousands';
export const SYNERGY_UNIT_LABEL = "$'000";
export const SYNERGY_UNIT_TO_CENTS = 100_000;
export const SYNERGY_CAVEAT =
  'Entity-level SOC statement lines for Synergy only (a WA Government Trading Enterprise). Never add to government program spending, to the PNFC sector benchmark, to Water Corporation, to another WA GTE, to a QLD/NSW SOC, a WA or national total, or to each other: total revenue is the printed Total revenue line; total expenses is the printed Total expenses line; employee expenses and depreciation/amortisation are printed components of total expenses; the net result is the printed Loss for the year. The Group 2026 column is used; the Corporation column and subsidiaries are never added. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the pages. */
export interface SynergyAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
}

/** An annual-report landing page discovered on the official index. */
export interface SynergyReportPageLink {
  url: string;
  fiscal_year: string;
  discovery_page: string;
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

/** Synergy names landing pages Synergy-2026-annual-report and PDFs Synergy-Annual-Report-2026.pdf. */
const REPORT_PAGE = /synergy[\s_\-–]*(\d{4})[\s_\-–]*annual[\s_\-–]*report/i;
const ANNUAL_REPORT_PDF = /annual[\s_\-–]*report/i;
const YEAR = /(?:^|[^0-9])(20\d{2})(?!\d)/;

function fiscalYearEnding(yearRaw: string): string | null {
  const end = Number(yearRaw);
  if (!Number.isInteger(end) || end < 2001 || end > 2100) return null;
  const start = end - 1;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

/** Convert an annual-report filename or page slug's year to the API fiscal year. */
export function synergyFiscalYearFromYear(yearRaw: string): string | null {
  return fiscalYearEnding(yearRaw);
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
 * Parse annual-report landing-page links from the official index. The index
 * lists /Annual-reports/Synergy-2026-annual-report; the newest landing page
 * carries the PDF.
 */
export function parseSynergyAnnualReportPageLinks(
  html: string,
  pageUrl: string = SYNERGY_SOURCE_URL,
): SynergyReportPageLink[] {
  const links: SynergyReportPageLink[] = [];
  const seen = new Set<string>();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const raw = match[1];
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    if (/\.pdf(?:$|[?#])/i.test(url.pathname)) continue;
    const year = REPORT_PAGE.exec(url.pathname)?.[1];
    if (!year) continue;
    const fiscalYear = fiscalYearEnding(year);
    if (!fiscalYear) continue;
    const key = `${url.origin}${url.pathname}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ url: key, fiscal_year: fiscalYear, discovery_page: pageUrl });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/** Parse annual-report PDF links from a landing page. */
export function parseSynergyAnnualReportPdfLinks(
  html: string,
  pageUrl: string,
): SynergyAnnualReportLink[] {
  const links: SynergyAnnualReportLink[] = [];
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
    if (!ANNUAL_REPORT_PDF.test(filename)) continue;
    const year = YEAR.exec(filename)?.[1];
    if (!year) continue;
    const fiscalYear = fiscalYearEnding(year);
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
 * Fetch the official index, follow the newest annual-report landing page, and
 * return its newest annual-report PDF. If the index itself links a PDF directly,
 * that is used as a fallback. The chosen page is recorded on the link.
 */
export async function discoverSynergyAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  indexUrl: string = SYNERGY_SOURCE_URL,
): Promise<SynergyAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(indexUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (error) {
    throw new Error(
      `Synergy annual-reports page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Synergy annual-reports page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const indexHtml = await response.text();
  const direct = parseSynergyAnnualReportPdfLinks(indexHtml, indexUrl);
  const reportPages = parseSynergyAnnualReportPageLinks(indexHtml, indexUrl);
  if (reportPages.length === 0 && direct.length === 0) {
    throw new Error(
      'Synergy annual-reports page contains no annual-report page or PDF link; refusing to hard-code a URL',
    );
  }
  const attempts: string[] = [];
  for (const reportPage of reportPages) {
    let pageResponse: Response;
    try {
      pageResponse = await fetchImpl(reportPage.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
    } catch (error) {
      attempts.push(`${reportPage.url}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (!pageResponse.ok) {
      attempts.push(`${reportPage.url}: HTTP ${pageResponse.status}`);
      continue;
    }
    const html = await pageResponse.text();
    const latest = parseSynergyAnnualReportPdfLinks(html, reportPage.url)[0];
    if (latest) return latest;
    attempts.push(`${reportPage.url}: no annual-report PDF link`);
  }
  const [firstDirect] = direct;
  if (firstDirect) return firstDirect;
  throw new Error(
    `Synergy annual-report pages contain no annual-report PDF link. Tried: ${attempts.join('; ')}`,
  );
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

/** Label text is everything left of the note-reference column (x < 250). */
function labelOf(row: PageRow): string {
  return row.items
    .filter((item) => item.x < 250)
    .map((item) => item.str.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function isMoneyItem(item: PdfTextItem): boolean {
  const text = item.str.trim();
  return /^(?:-|–|—)$/.test(text) || parseAmountCell(text).value !== null;
}

/** Money cells sit right of the note-reference column (x >= 300). */
function moneyItems(row: PageRow): PdfTextItem[] {
  return row.items.filter((item) => item.x >= 300 && isMoneyItem(item));
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

export function detectSynergyUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface SynergyStatement {
  page_number: number;
  unit: UnitDetection;
  sales_revenue: number;
  other_revenue: number;
  total_revenue: number;
  fuel_networks: number;
  materials_services: number;
  employee_expenses: number;
  other_expenses: number;
  depreciation_amortisation: number;
  impairment_expenses: number;
  total_expenses: number;
  other_operating_income: number;
  finance_income: number;
  finance_costs: number;
  net_finance_costs: number;
  share_joint_ventures: number;
  share_associates: number;
  loss_before_tax: number;
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
      text.includes('statement of profit or loss') &&
      text.includes('total revenue') &&
      text.includes('total expenses') &&
      text.includes('loss before tax') &&
      text.includes('loss for the year')
    ) {
      return page;
    }
  }
  return null;
}

export function parseSynergyStatement(facePage: PdfPage): SynergyStatement | null {
  const rawRows = groupPageRows(facePage.items);
  const rows = logicalRows(rawRows);
  const unit = detectMoneyUnit(unitSamples(rawRows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Sales revenue');
  if (anchor === null) {
    errors.push(
      'statement Group current-year money column could not be anchored from the printed revenue row',
    );
    return null;
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);

  const salesRevenue = read('Sales revenue');
  const otherRevenue = read('Other revenue');
  const totalRevenue = read('Total revenue');
  const fuelNetworks = read('Fuel, networks and other direct costs');
  const materialsServices = read('Materials and services');
  const employeeExpenses = read('Employee expenses');
  const otherExpenses = read('Other expenses');
  const depreciation = read('Depreciation and amortisation');
  const impairment = read('Other impairment expenses');
  const totalExpenses = read('Total expenses');
  const otherOperatingIncome = read('Other operating income');
  const financeIncome = read('Finance income');
  const financeCosts = read('Finance costs');
  const netFinanceCosts = read('Net finance costs');
  const shareJointVentures = read('Share of profit from joint ventures');
  const shareAssociates = read('Share of profit from associates');
  const lossBeforeTax = read('Loss before tax');
  const incomeTax = read('Income tax expense');
  const netResult = read('Loss for the year');

  const required: Array<[string, CellValue]> = [
    ['Sales revenue', salesRevenue],
    ['Other revenue', otherRevenue],
    ['Total revenue', totalRevenue],
    ['Fuel, networks and other direct costs', fuelNetworks],
    ['Materials and services', materialsServices],
    ['Employee expenses', employeeExpenses],
    ['Other expenses', otherExpenses],
    ['Depreciation and amortisation', depreciation],
    ['Other impairment expenses', impairment],
    ['Total expenses', totalExpenses],
    ['Other operating income', otherOperatingIncome],
    ['Finance income', financeIncome],
    ['Finance costs', financeCosts],
    ['Net finance costs', netFinanceCosts],
    ['Share of profit from joint ventures', shareJointVentures],
    ['Share of profit from associates', shareAssociates],
    ['Loss before tax', lossBeforeTax],
    ['Income tax expense', incomeTax],
    ['Loss for the year', netResult],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const salesValue = salesRevenue.value as number;
  const otherRevenueValue = otherRevenue.value as number;
  const revenueValue = totalRevenue.value as number;
  const fuelValue = Math.abs(fuelNetworks.value as number);
  const materialsValue = Math.abs(materialsServices.value as number);
  const employeeValue = Math.abs(employeeExpenses.value as number);
  const otherExpensesValue = Math.abs(otherExpenses.value as number);
  const depreciationValue = Math.abs(depreciation.value as number);
  const impairmentValue = Math.abs(impairment.value as number);
  const expensesValue = Math.abs(totalExpenses.value as number);
  const otherOperatingValue = otherOperatingIncome.value as number;
  const financeIncomeValue = financeIncome.value as number;
  const financeCostValue = Math.abs(financeCosts.value as number);
  const netFinanceValue = netFinanceCosts.value as number;
  const shareJvValue = shareJointVentures.value as number;
  const shareAssocValue = shareAssociates.value as number;
  const lossBeforeTaxValue = lossBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;

  const revenueComponents = [salesValue, otherRevenueValue];
  const revenueSum = revenueComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `revenue components exact: ${revenueComponents.join(' + ')} = ${revenueSum} (printed Total revenue ${revenueValue})`,
  );
  if (revenueSum !== revenueValue) {
    errors.push(
      `revenue component total mismatch: ${revenueComponents.join(' + ')} = ${revenueSum}, printed Total revenue ${revenueValue}`,
    );
  }

  const expenseComponents = [
    fuelValue,
    materialsValue,
    employeeValue,
    otherExpensesValue,
    depreciationValue,
    impairmentValue,
  ];
  const expenseSum = expenseComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `expense components exact: ${expenseComponents.join(' + ')} = ${expenseSum} (printed Total expenses ${expensesValue})`,
  );
  if (expenseSum !== expensesValue) {
    errors.push(
      `expense component total mismatch: ${expenseComponents.join(' + ')} = ${expenseSum}, printed Total expenses ${expensesValue}`,
    );
  }

  const netFinanceBridge = financeIncomeValue - financeCostValue;
  checks.push(
    `net-finance bridge exact: ${financeIncomeValue} - ${financeCostValue} = ${netFinanceBridge} (printed ${netFinanceValue})`,
  );
  if (netFinanceBridge !== netFinanceValue) {
    errors.push(
      `net-finance bridge mismatch: ${financeIncomeValue} - ${financeCostValue} = ${netFinanceBridge}, printed Net finance costs ${netFinanceValue}`,
    );
  }

  const preTaxBridge =
    revenueValue -
    expensesValue +
    otherOperatingValue +
    netFinanceValue +
    shareJvValue +
    shareAssocValue;
  checks.push(
    `loss-before-tax bridge exact: ${revenueValue} - ${expensesValue} + ${otherOperatingValue} + ${netFinanceValue} + ${shareJvValue} + ${shareAssocValue} = ${preTaxBridge} (printed ${lossBeforeTaxValue})`,
  );
  if (preTaxBridge !== lossBeforeTaxValue) {
    errors.push(
      `loss-before-tax bridge mismatch: ${revenueValue} - ${expensesValue} + ${otherOperatingValue} + ${netFinanceValue} + ${shareJvValue} + ${shareAssocValue} = ${preTaxBridge}, printed Loss before tax ${lossBeforeTaxValue}`,
    );
  }

  const netBridge = lossBeforeTaxValue + taxValue;
  checks.push(
    `net-result bridge exact: ${lossBeforeTaxValue} + ${taxValue} = ${netBridge} (printed ${netValue})`,
  );
  if (netBridge !== netValue) {
    errors.push(
      `net-result bridge mismatch: ${lossBeforeTaxValue} + ${taxValue} = ${netBridge}, printed Loss for the year ${netValue}`,
    );
  }

  warnings.push(
    "the Statement of profit or loss prints an explicit $'000 unit and both Group and Corporation columns; the adapter reads the Group 2026 current-year column only and never adds the Corporation column or subsidiaries. The printed revenue and expense components reconcile exactly to the printed subtotals and the net-finance, loss-before-tax and loss-for-the-year bridges agree at zero tolerance.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    sales_revenue: salesValue,
    other_revenue: otherRevenueValue,
    total_revenue: revenueValue,
    fuel_networks: fuelValue,
    materials_services: materialsValue,
    employee_expenses: employeeValue,
    other_expenses: otherExpensesValue,
    depreciation_amortisation: depreciationValue,
    impairment_expenses: impairmentValue,
    total_expenses: expensesValue,
    other_operating_income: otherOperatingValue,
    finance_income: financeIncomeValue,
    finance_costs: financeCostValue,
    net_finance_costs: netFinanceValue,
    share_joint_ventures: shareJvValue,
    share_associates: shareAssocValue,
    loss_before_tax: lossBeforeTaxValue,
    income_tax: taxValue,
    net_result: netValue,
    checks,
    warnings,
    errors,
  };
}

export interface SynergyParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface SynergyDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation';
}

export interface SynergyLineSpec {
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

export interface SynergyParseResult {
  records: SpendingRecord[];
  deferral: SynergyDeferral | null;
  statement: SynergyStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function synergyNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${SYNERGY_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * SYNERGY_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: SynergyParseContext,
  spec: SynergyLineSpec,
  statement: SynergyStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${SYNERGY_UNIT_LABEL} (${SYNERGY_UNIT}; x${SYNERGY_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'Group current-year column only (Corporation column and subsidiaries never added); entity-level SOC statement line; single Synergy entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Water Corporation, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: SynergyLineSpec,
  context: SynergyParseContext,
  statement: SynergyStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: SYNERGY_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: synergyNaturalKey(
      SYNERGY_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${SYNERGY_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: SYNERGY_JURISDICTION,
    delivery_entity: SYNERGY_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Synergy Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: SYNERGY_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: SYNERGY_UNIT,
    soc_section: spec.section,
    soc_note: 'Statement of profit or loss',
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
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

export function parseSynergyExtraction(
  extraction: PdfExtraction,
  context: SynergyParseContext,
): SynergyParseResult {
  const warnings: string[] = [];
  const facePage = findFaceStatementPage(extraction.pages);
  if (!facePage) {
    return {
      records: [],
      deferral: {
        reason: 'no parseable statement of profit or loss found in the PDF',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const statement = parseSynergyStatement(facePage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason: 'statement of profit or loss found but required printed lines could not be parsed',
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

  const lineSpecs: SynergyLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: SYNERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total revenue line, which bridges exactly to Sales revenue + Other revenue. Entity-level Group revenue; includes payments in lieu of subsidies already, so it is never added to government program spending.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: SYNERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Total expenses line, which bridges exactly to Fuel, networks and other direct costs + Materials and services + Employee expenses + Other expenses + Depreciation and amortisation + Other impairment expenses.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee expenses',
      amount_thousands: statement.employee_expenses,
      funding_source: SYNERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee expenses line. A component of Total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: SYNERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation and amortisation line. A component of Total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Loss for the year',
      amount_thousands: statement.net_result,
      funding_source: SYNERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Loss for the year (net result after income tax), a printed negative retained as a non-negative magnitude with soc_printed_sign negative. A result line, not an expense component; never add to revenue or expenses. Group current-year column only.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the Group current-year revenue and expense components reconcile exactly to the printed subtotals and every printed result bridge agrees at zero tolerance.',
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

export interface SynergyConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: SynergyAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'synergy-annual-report.pdf';
}

/**
 * Operator escape hatch: when `WA_SYNERGY_ANNUAL_REPORT_URL` is set, it is used
 * as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): SynergyAnnualReportLink | null {
  const url = process.env.WA_SYNERGY_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Synergy-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const year = YEAR.exec(filename)?.[1];
  const fiscalYear = year ? fiscalYearEnding(year) : null;
  if (!fiscalYear) {
    throw new Error(
      `WA_SYNERGY_ANNUAL_REPORT_URL filename "${filename}" has no annual-report year; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: SYNERGY_SOURCE_URL,
  };
}

async function recordDeferral(
  document: SynergyAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: SynergyDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: SYNERGY_ID, document_url: document.url },
    {
      $set: {
        entity: SYNERGY_ENTITY,
        jurisdiction: SYNERGY_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Synergy SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Synergy connector. */
export function createSynergyConnector(options: SynergyConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: SYNERGY_ID,
    name: SYNERGY_NAME,
    publisher: SYNERGY_PUBLISHER,
    source_url: SYNERGY_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: SYNERGY_LICENSE,
    notes:
      'WA SOC (second WA GTE pilot): Synergy only, a WA Government Trading Enterprise (Electricity Corporations Act 2005 (WA)). The latest annual report is discovered from the official annual-reports page (index -> newest landing page -> PDF; no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo. The Statement of profit or loss prints an explicit $\'000 unit and both Group and Corporation columns; the adapter reads the Group 2026 current-year column only and never adds the Corporation column or subsidiaries. The printed revenue and expense components must sum exactly to the printed subtotals, and the net-finance, loss-before-tax and loss-for-the-year bridges must agree at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Synergy is never added to government program spending, the PNFC benchmark, Water Corporation, another WA GTE, a QLD/NSW SOC, a WA total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverSynergyAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Synergy PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: SYNERGY_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes: 'Synergy annual-report PDF; archived for auditable WA SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: SynergyParseContext = {
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
      const parsed = parseSynergyExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'wa-synergy-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'wa-synergy-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Synergy measure; skipped');
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
