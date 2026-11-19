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
 * QLD SOC — Powerlink Queensland annual-report adapter.
 *
 * This reuses the Energy Queensland/CS Energy/Stanwell QLD SOC pattern: one
 * entity, one audited face statement, no QLD total. The reporting entity is
 * Queensland Electricity Transmission Corporation Limited, trading as
 * Powerlink Queensland: a Queensland Government Owned Corporation (GOC), not a
 * statutory body.
 *
 * Source gate:
 * - The document is discovered from Powerlink's official reports page (the
 *   page lists annual-report pages; each annual-report page carries the PDF).
 *   No PDF URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The consolidated statement of profit or loss and other comprehensive
 *   income prints an explicit "$'000" unit. A table read as dollars or millions
 *   is rejected, not converted by magnitude.
 * - Total revenue is derived as the exact sum of the printed Revenue + Other
 *   gains/(losses) + Finance income lines. Total expenses is derived as the
 *   exact sum of the printed Expenses from continuing operations + Impairment
 *   losses + Finance costs lines. Both are accepted only when they bridge
 *   exactly to the printed Profit/(loss) before income tax equivalent and the
 *   printed Profit/(loss) for the year. Note 3 is separately reconciled:
 *   its five printed components must sum to the printed TOTAL EXPENSES FROM
 *   CONTINUING OPERATIONS and equal the face statement's Expenses from
 *   continuing operations. A one-thousand-dollar mismatch defers the whole
 *   document.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Powerlink
 * rows are never added to government program spending, the PNFC benchmark,
 * Energy Queensland, CS Energy, Stanwell, another QLD GOC, a QLD total, or each
 * other.
 */

export const POWERLINK_ID = 'qld-powerlink';
export const POWERLINK_NAME = 'Powerlink Queensland — Annual Report';
export const POWERLINK_PUBLISHER =
  'Queensland Electricity Transmission Corporation Limited (Powerlink Queensland)';
export const POWERLINK_ENTITY = 'Powerlink Queensland';
export const POWERLINK_JURISDICTION = 'QLD';
export const POWERLINK_LEGAL_CLASS = 'Queensland Government Owned Corporation (GOC)';
/** Canonical official reports page. Annual-report pages are discovered from it. */
export const POWERLINK_SOURCE_URL = 'https://www.powerlink.com.au/reports';
/** Base URL used to resolve relative annual-report page links found on the reports page. */
export const POWERLINK_ANNUAL_REPORT_BASE = 'https://www.powerlink.com.au/annual-report';
export const POWERLINK_LICENSE =
  '© Powerlink Queensland. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const POWERLINK_UNIT = 'AUD_thousands';
export const POWERLINK_UNIT_LABEL = "$'000";
export const POWERLINK_UNIT_TO_CENTS = 100_000;
export const POWERLINK_CAVEAT =
  'Entity-level SOC statement lines for Powerlink Queensland only (Queensland Electricity Transmission Corporation Limited, a Queensland Government Owned Corporation). Never add to government program spending, to the PNFC sector benchmark, to Energy Queensland, CS Energy, Stanwell, another QLD GOC, a QLD or national total, or to each other: total revenue is the exact sum of the printed Revenue + Other gains/(losses) + Finance income lines; total expenses is the exact sum of the printed Expenses from continuing operations + Impairment losses + Finance costs lines; employee benefits is a Note 3 memo included within total expenses; depreciation and amortisation is a Note 3 component of Expenses from continuing operations; the net result is a loss. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface PowerlinkAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
}

/** An annual-report landing page discovered on the official reports page. */
export interface PowerlinkReportPageLink {
  url: string;
  fiscal_year: string;
  discovery_page: string;
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

/** Powerlink names the combined report by the financial year span, e.g. ...-2025-26.pdf. */
const ANNUAL_REPORT_FILENAME = /annual[\s_\-–]*report[\s\S]*?(20\d{2})\s*[-–]\s*(\d{2})(?!\d)/i;
/** Annual-report landing pages use a compact span, e.g. /annual-report/annual-report-202526. */
const ANNUAL_REPORT_PAGE = /annual[\s_\-–]*report[\s_\-–]*(20\d{2})\s*[-–]?\s*(\d{2})(?!\d)/i;

function fiscalYearFromParts(start: number, end: number): string | null {
  if (!Number.isInteger(start) || start < 2000 || start > 2100) return null;
  if (!Number.isInteger(end) || end !== (start + 1) % 100) return null;
  return `${start}-${String(end).padStart(2, '0')}`;
}

/** Convert a filename fiscal-year span "2025-26" into the API fiscal year "2025-26". */
export function powerlinkFiscalYearFromFilename(filename: string): string | null {
  const match = ANNUAL_REPORT_FILENAME.exec(filename);
  if (!match) return null;
  return fiscalYearFromParts(Number(match[1]), Number(match[2]));
}

/** Convert an annual-report page slug/URL "annual-report-202526" into "2025-26". */
export function powerlinkFiscalYearFromPage(input: string): string | null {
  const match = ANNUAL_REPORT_PAGE.exec(input);
  if (!match) return null;
  return fiscalYearFromParts(Number(match[1]), Number(match[2]));
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
 * Parse annual-report landing-page links from Powerlink's official reports
 * page. The reports page lists e.g. /annual-report/annual-report-202526; it
 * does not expose the PDF directly, so discovery follows the newest page.
 */
export function parsePowerlinkAnnualReportPageLinks(
  html: string,
  pageUrl: string = POWERLINK_SOURCE_URL,
): PowerlinkReportPageLink[] {
  const links: PowerlinkReportPageLink[] = [];
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
    if (!/\/annual-report\//i.test(url.pathname)) continue;
    const fiscalYear = powerlinkFiscalYearFromPage(url.pathname);
    if (!fiscalYear) continue;
    const key = `${url.origin}${url.pathname}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ url: key, fiscal_year: fiscalYear, discovery_page: pageUrl });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/**
 * Parse annual-report PDF links from Powerlink's annual-report page. The
 * current PDF filename includes "Annual Report Sustainability Report and
 * Financial Statements", so a filename is accepted when it names an annual
 * report and carries a report-year span. Standalone sustainability reports,
 * planning reports, submissions and newsletters are rejected.
 */
export function parsePowerlinkAnnualReportPdfLinks(
  html: string,
  pageUrl: string,
): PowerlinkAnnualReportLink[] {
  const links: PowerlinkAnnualReportLink[] = [];
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
    const fiscalYear = powerlinkFiscalYearFromFilename(filename);
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
 * Fetch the official reports page, follow the newest annual-report landing
 * page, and return its newest annual-report PDF. If the reports page itself
 * links a PDF directly, that is used as a fallback. The chosen page is recorded
 * on the link.
 */
export async function discoverPowerlinkAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  reportsUrl: string = POWERLINK_SOURCE_URL,
): Promise<PowerlinkAnnualReportLink> {
  const attempts: string[] = [];
  let response: Response;
  try {
    response = await fetchImpl(reportsUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (error) {
    throw new Error(
      `Powerlink reports page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Powerlink reports page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const reportsHtml = await response.text();
  const direct = parsePowerlinkAnnualReportPdfLinks(reportsHtml, reportsUrl);
  const reportPages = parsePowerlinkAnnualReportPageLinks(reportsHtml, reportsUrl);
  if (reportPages.length === 0 && direct.length === 0) {
    throw new Error(
      `Powerlink reports page contains no annual-report page or PDF link; refusing to hard-code a URL`,
    );
  }

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
    const latest = parsePowerlinkAnnualReportPdfLinks(html, reportPage.url)[0];
    if (latest) return latest;
    attempts.push(`${reportPage.url}: no annual-report PDF link`);
  }
  const [firstDirect] = direct;
  if (firstDirect) return firstDirect;
  throw new Error(
    `Powerlink annual-report pages contain no annual-report PDF link. Tried: ${attempts.join('; ')}`,
  );
}

interface PageRow {
  y: number;
  items: PdfTextItem[];
  cells: string[];
}

function groupPageRows(items: readonly PdfTextItem[], tolerance = 4.5): PageRow[] {
  // Preserve content order so right-aligned money cells stay attached to their
  // label, matching the Stanwell/CS Energy face-statement reader.
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

function labelOf(row: PageRow): string {
  return (row.cells[0] ?? '').replace(/\s+/g, ' ').trim();
}

function matchingRows(rows: readonly PageRow[], label: string): PageRow[] {
  const wanted = label.toLowerCase();
  const exact = rows.filter((row) => labelOf(row).toLowerCase() === wanted);
  const prefixed = rows.filter(
    (row) => labelOf(row).toLowerCase().startsWith(wanted) && !exact.includes(row),
  );
  return [...exact, ...prefixed];
}

/**
 * Anchor the current-year money column from the first matching row that
 * actually carries a money cell. Powerlink prints a "REVENUE" section header
 * before the "Revenue" line, so the first label match is not always the money
 * row.
 */
function columnAnchor(rows: readonly PageRow[], label: string): number | null {
  for (const row of matchingRows(rows, label)) {
    const edges: number[] = [];
    for (const item of row.items) {
      const parsed = parseAmountCell(item.str);
      if (parsed.value === null || Math.abs(parsed.value) < 1000) continue;
      edges.push(item.x + item.width);
    }
    edges.sort((a, b) => a - b);
    const [first] = edges;
    if (first !== undefined) return first;
  }
  return null;
}

interface CellValue {
  value: number | null;
  found: boolean;
  nil: boolean;
}

/**
 * Read the current-year money cell nearest the column anchor. An explicit nil
 * marker ("-") is a printed zero, not a missing cell; a genuinely absent cell
 * is `found: false`.
 */
function cellNear(row: PageRow, anchor: number, tolerance = 18): CellValue {
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

function rowValue(rows: readonly PageRow[], label: string, anchor: number): CellValue {
  for (const row of matchingRows(rows, label)) {
    const cell = cellNear(row, anchor);
    if (cell.found) return cell;
  }
  return { value: null, found: false, nil: false };
}

/**
 * Read a Note 3 memo whose label wraps onto the next line. Powerlink prints
 * "Employee benefit expense through the consolidated statement of profit" and
 * "or loss" on a second row that carries the money cells.
 */
function memoValue(rows: readonly PageRow[], phrase: string, anchor: number): CellValue {
  const wanted = phrase.toLowerCase();
  const index = rows.findIndex((row) => labelOf(row).toLowerCase().includes(wanted));
  if (index === -1) return { value: null, found: false, nil: false };
  const last = Math.min(index + 1, rows.length - 1);
  for (let i = index; i <= last; i += 1) {
    const cell = cellNear(rows[i] as PageRow, anchor);
    if (cell.found) return cell;
  }
  return { value: null, found: false, nil: false };
}

function unitSamples(rows: readonly PageRow[]): string[] {
  return rows
    .filter((row) => row.cells.some((cell) => cell.includes('$')))
    .map((row) => row.cells.join(' '));
}

export function detectPowerlinkUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface PowerlinkStatement {
  page_number: number;
  note_page_number: number;
  unit: UnitDetection;
  note_unit: UnitDetection;
  revenue: number;
  other_gains_losses: number;
  expenses_from_continuing: number;
  impairment_losses: number;
  profit_from_continuing: number;
  finance_income: number;
  finance_costs: number;
  net_finance_costs: number;
  profit_before_tax: number;
  income_tax: number;
  net_result: number;
  note_network_operations: number;
  note_network_maintenance: number;
  note_corporate_business_support: number;
  note_customer_works: number;
  note_depreciation_amortisation: number;
  note_total_expenses_from_continuing: number;
  employee_benefits: number;
  /** Exact sum of all printed income lines (Revenue + Other gains + Finance income). */
  total_revenue: number;
  /** Exact sum of all printed expense lines (Expenses from continuing + Impairment + Finance costs). */
  total_expenses: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findFaceStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('consolidated statement of profit or loss') &&
      text.includes('profit/(loss) before income tax equivalent')
    ) {
      return page;
    }
  }
  return null;
}

function findNote3Page(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('note 3: expenses') &&
      text.includes('employee benefit expense through the consolidated statement') &&
      text.includes('total expenses from continuing operations')
    ) {
      return page;
    }
  }
  return null;
}

export function parsePowerlinkStatement(
  facePage: PdfPage,
  notePage: PdfPage,
): PowerlinkStatement | null {
  const rows = groupPageRows(facePage.items);
  const titleRow = rows.find((row) =>
    /consolidated statement of profit or loss/i.test(row.cells.join(' ')),
  );
  if (!titleRow) return null;

  const noteRows = groupPageRows(notePage.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const noteUnit = detectMoneyUnit(unitSamples(noteRows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Revenue');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed Revenue row',
    );
    return null;
  }
  const noteAnchor =
    columnAnchor(noteRows, 'TOTAL EXPENSES FROM CONTINUING OPERATIONS') ??
    columnAnchor(noteRows, 'Network operations');
  if (noteAnchor === null) {
    errors.push(
      'Note 3 current-year money column could not be anchored from the printed total-expenses row',
    );
    return null;
  }
  if (unit.kind !== 'thousands') {
    errors.push(
      `printed face-statement unit is not explicit thousands (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $'000 statement as dollars or millions`,
    );
  }
  if (noteUnit.kind !== 'thousands') {
    errors.push(
      `printed Note 3 unit is not explicit thousands (detected ${noteUnit.kind ?? 'none'}: ${noteUnit.reason}); refusing to ingest a $'000 note as dollars or millions`,
    );
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);
  const readNote = (label: string): CellValue => rowValue(noteRows, label, noteAnchor);

  const revenue = read('Revenue');
  const otherGains = read('Other gains/(losses)');
  const expenses = read('Expenses from continuing operations');
  const impairment = read('Impairment losses');
  const continuing = read('PROFIT FROM CONTINUING OPERATIONS');
  const financeIncome = read('Finance income');
  const financeCosts = read('Finance costs');
  const netFinanceCosts = read('NET FINANCE COSTS');
  const pbt = read('PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT');
  const tax = read('Income tax equivalent benefit/(expense)');
  const netResult = read('PROFIT/(LOSS) FOR THE YEAR');

  const networkOperations = readNote('Network operations');
  const networkMaintenance = readNote('Network maintenance');
  const corporateSupport = readNote('Corporate/business support');
  const customerWorks = readNote('Customer works and other activities');
  const depreciation = readNote('Depreciation and amortisation');
  const noteTotal = readNote('TOTAL EXPENSES FROM CONTINUING OPERATIONS');
  const employee = memoValue(
    noteRows,
    'employee benefit expense through the consolidated statement of profit',
    noteAnchor,
  );

  const required: Array<[string, CellValue]> = [
    ['Revenue', revenue],
    ['Other gains/(losses)', otherGains],
    ['Expenses from continuing operations', expenses],
    ['Impairment losses', impairment],
    ['PROFIT FROM CONTINUING OPERATIONS', continuing],
    ['Finance income', financeIncome],
    ['Finance costs', financeCosts],
    ['NET FINANCE COSTS', netFinanceCosts],
    ['PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT', pbt],
    ['Income tax equivalent benefit/(expense)', tax],
    ['PROFIT/(LOSS) FOR THE YEAR', netResult],
    ['Note 3 Network operations', networkOperations],
    ['Note 3 Network maintenance', networkMaintenance],
    ['Note 3 Corporate/business support', corporateSupport],
    ['Note 3 Customer works and other activities', customerWorks],
    ['Note 3 Depreciation and amortisation', depreciation],
    ['Note 3 TOTAL EXPENSES FROM CONTINUING OPERATIONS', noteTotal],
    ['Note 3 Employee benefit expense memo', employee],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const rev = revenue.value as number;
  const other = otherGains.value as number;
  const exp = expenses.value as number;
  const imp = impairment.value as number;
  const cont = continuing.value as number;
  const finInc = financeIncome.value as number;
  const finCost = financeCosts.value as number;
  const netFin = netFinanceCosts.value as number;
  const pbtValue = pbt.value as number;
  const taxValue = tax.value as number;
  const netValue = netResult.value as number;

  const networkOps = networkOperations.value as number;
  const maintenance = networkMaintenance.value as number;
  const corporate = corporateSupport.value as number;
  const customer = customerWorks.value as number;
  const depreciationValue = depreciation.value as number;
  const noteTotalValue = noteTotal.value as number;
  const employeeValue = employee.value as number;

  const noteComponents = [networkOps, maintenance, corporate, customer, depreciationValue];
  const noteSum = noteComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `Note 3 components exact: ${noteComponents.join(' + ')} = ${noteSum} (printed TOTAL EXPENSES FROM CONTINUING OPERATIONS ${noteTotalValue})`,
  );
  if (noteSum !== noteTotalValue) {
    errors.push(
      `Note 3 component total mismatch: ${noteComponents.join(' + ')} = ${noteSum}, printed TOTAL EXPENSES FROM CONTINUING OPERATIONS ${noteTotalValue}`,
    );
  }
  if (noteTotalValue !== Math.abs(exp)) {
    errors.push(
      `Note 3 total does not equal the face statement: printed TOTAL EXPENSES FROM CONTINUING OPERATIONS ${noteTotalValue}, face Expenses from continuing operations ${Math.abs(exp)}`,
    );
  } else {
    checks.push(`Note 3 total equals face Expenses from continuing operations: ${noteTotalValue}`);
  }

  if (employeeValue < 0 || employeeValue > noteTotalValue) {
    errors.push(
      `Note 3 employee-benefit memo ${employeeValue} is outside the printed total expenses ${noteTotalValue}`,
    );
  } else {
    checks.push(
      `Note 3 employee-benefit memo ${employeeValue} is included within total expenses ${noteTotalValue}; recorded once, never added`,
    );
  }

  // Face-statement bridges: the printed Profit from continuing operations is
  // Revenue + Other gains/(losses) - Expenses from continuing operations -
  // Impairment losses. Net finance costs is Finance income + Finance costs.
  const continuingBridge = rev + other - Math.abs(exp) - Math.abs(imp);
  if (continuingBridge !== cont) {
    errors.push(
      `profit-from-continuing-operations bridge mismatch: ${rev} + ${other} - ${Math.abs(exp)} - ${Math.abs(imp)} = ${continuingBridge}, printed PROFIT FROM CONTINUING OPERATIONS ${cont}`,
    );
  } else {
    checks.push(
      `profit-from-continuing-operations bridge exact: ${rev} + ${other} - ${Math.abs(exp)} - ${Math.abs(imp)} = ${continuingBridge}`,
    );
  }

  const netFinanceBridge = finInc + finCost;
  if (netFinanceBridge !== netFin) {
    errors.push(
      `net-finance-costs bridge mismatch: ${finInc} + ${finCost} = ${netFinanceBridge}, printed NET FINANCE COSTS ${netFin}`,
    );
  } else {
    checks.push(`net-finance-costs bridge exact: ${finInc} + ${finCost} = ${netFinanceBridge}`);
  }

  const pbtFromContinuing = cont + netFinanceBridge;
  if (pbtFromContinuing !== pbtValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${cont} + ${netFinanceBridge} = ${pbtFromContinuing}, printed PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT ${pbtValue}`,
    );
  } else {
    checks.push(
      `profit-before-tax bridge exact: ${cont} + ${netFinanceBridge} = ${pbtFromContinuing}`,
    );
  }

  const totalRevenue = rev + other + finInc;
  const totalExpenses = Math.abs(exp) + Math.abs(imp) + Math.abs(finCost);
  const pbtFromTotals = totalRevenue - totalExpenses;
  checks.push(
    `income lines exact: ${rev} + ${other} + ${finInc} = ${totalRevenue} (the derived total revenue)`,
  );
  checks.push(
    `expense lines exact: ${Math.abs(exp)} + ${Math.abs(imp)} + ${Math.abs(finCost)} = ${totalExpenses} (the derived total expenses)`,
  );
  if (pbtFromTotals !== pbtValue) {
    errors.push(
      `total revenue less total expenses bridge mismatch: ${totalRevenue} - ${totalExpenses} = ${pbtFromTotals}, printed PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT ${pbtValue}`,
    );
  } else {
    checks.push(
      `total revenue less total expenses bridge exact: ${totalRevenue} - ${totalExpenses} = ${pbtFromTotals}`,
    );
  }

  const netBridge = pbtValue + taxValue;
  if (netBridge !== netValue) {
    errors.push(
      `net-result bridge mismatch: ${pbtValue} + ${taxValue} = ${netBridge}, printed PROFIT/(LOSS) FOR THE YEAR ${netValue}`,
    );
  } else {
    checks.push(`net-result bridge exact: ${pbtValue} + ${taxValue} = ${netBridge}`);
  }

  warnings.push(
    "the consolidated statement has no printed Total revenue or Total expenses subtotal; total revenue is the exact sum of Revenue + Other gains/(losses) + Finance income; total expenses is the exact sum of Expenses from continuing operations + Impairment losses + Finance costs, and is accepted only because both totals bridge to the printed PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT and PROFIT/(LOSS) FOR THE YEAR with zero tolerance. Note 3's five components are separately reconciled to the printed TOTAL EXPENSES FROM CONTINUING OPERATIONS and to the face statement. Employee benefits is a Note 3 memo included within total expenses, not an additional row.",
  );

  return {
    page_number: facePage.page_number,
    note_page_number: notePage.page_number,
    unit,
    note_unit: noteUnit,
    revenue: rev,
    other_gains_losses: other,
    expenses_from_continuing: Math.abs(exp),
    impairment_losses: Math.abs(imp),
    profit_from_continuing: cont,
    finance_income: finInc,
    finance_costs: Math.abs(finCost),
    net_finance_costs: netFin,
    profit_before_tax: pbtValue,
    income_tax: taxValue,
    net_result: netValue,
    note_network_operations: networkOps,
    note_network_maintenance: maintenance,
    note_corporate_business_support: corporate,
    note_customer_works: customer,
    note_depreciation_amortisation: depreciationValue,
    note_total_expenses_from_continuing: noteTotalValue,
    employee_benefits: employeeValue,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    checks,
    warnings,
    errors,
  };
}

export interface PowerlinkParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface PowerlinkDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation' | 'notes';
}

export interface PowerlinkLineSpec {
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

export interface PowerlinkParseResult {
  records: SpendingRecord[];
  deferral: PowerlinkDeferral | null;
  statement: PowerlinkStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function powerlinkNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${POWERLINK_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * POWERLINK_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: PowerlinkParseContext,
  spec: PowerlinkLineSpec,
  statement: PowerlinkStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${POWERLINK_UNIT_LABEL} (${POWERLINK_UNIT}; x${POWERLINK_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `note_page: ${statement.note_page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; consolidated Powerlink Queensland parent; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Energy Queensland, CS Energy, Stanwell, another QLD GOC, a QLD total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: PowerlinkLineSpec,
  context: PowerlinkParseContext,
  statement: PowerlinkStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: POWERLINK_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: powerlinkNaturalKey(
      POWERLINK_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${POWERLINK_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: POWERLINK_JURISDICTION,
    delivery_entity: POWERLINK_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Powerlink Queensland Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: POWERLINK_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: POWERLINK_UNIT,
    soc_section: spec.section,
    soc_note: 'Face statement / Note 3',
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

export function parsePowerlinkExtraction(
  extraction: PdfExtraction,
  context: PowerlinkParseContext,
): PowerlinkParseResult {
  const warnings: string[] = [];
  const facePage = findFaceStatementPage(extraction.pages);
  if (!facePage) {
    return {
      records: [],
      deferral: {
        reason: 'no parseable consolidated statement of profit or loss found in the PDF',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const notePage = findNote3Page(extraction.pages);
  if (!notePage) {
    return {
      records: [],
      deferral: {
        reason:
          'no parseable Note 3 expenses page found; employee benefits and depreciation cannot be reconciled',
        phase: 'notes',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [facePage.page_number],
    };
  }
  const statement = parsePowerlinkStatement(facePage, notePage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason: 'consolidated statement page found but required printed lines could not be parsed',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [facePage.page_number, notePage.page_number],
    };
  }
  warnings.push(...statement.warnings);
  if (statement.unit.kind !== 'thousands' || statement.note_unit.kind !== 'thousands') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit thousands: face ${statement.unit.reason}; Note 3 ${statement.note_unit.reason}`,
        phase: 'unit',
      },
      statement,
      checks: statement.checks,
      warnings,
      pages_used: [facePage.page_number, notePage.page_number],
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
      pages_used: [facePage.page_number, notePage.page_number],
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
      pages_used: [facePage.page_number, notePage.page_number],
    };
  }

  const lineSpecs: PowerlinkLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: POWERLINK_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Derived from the printed Revenue + Other gains/(losses) + Finance income lines. No printed Total revenue subtotal exists on the face statement; the derived total is accepted only because it bridges exactly to the printed PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT and the printed PROFIT/(LOSS) FOR THE YEAR.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: POWERLINK_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Exact sum of the printed Expenses from continuing operations + Impairment losses + Finance costs. Expenses from continuing operations is separately reconciled to Note 3 (Network operations + Network maintenance + Corporate/business support + Customer works and other activities + Depreciation and amortisation). Accepted only because Total revenue less total expenses equals the printed PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefit expense',
      amount_thousands: statement.employee_benefits,
      funding_source: POWERLINK_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Note 3 memo: Employee benefit expense through the consolidated statement of profit or loss. It is included within Expenses from continuing operations and total expenses; recorded once as a memo line, never added to total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_thousands: statement.note_depreciation_amortisation,
      funding_source: POWERLINK_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Note 3 line Depreciation and amortisation, one of the five components reconciled to TOTAL EXPENSES FROM CONTINUING OPERATIONS. A component of total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit/(loss) for the year',
      amount_thousands: statement.net_result,
      funding_source: POWERLINK_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed PROFIT/(LOSS) FOR THE YEAR (net result), a printed negative retained as a non-negative magnitude with soc_printed_sign negative. A result line, not an expense component; never add to revenue or expenses.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; total revenue and total expenses are derived from the printed lines and reconcile exactly to the printed profit-before-tax and net-result bridges, and Note 3 reconciles exactly to the face statement expense line.',
  );
  return {
    records,
    deferral: null,
    statement,
    checks: statement.checks,
    warnings,
    pages_used: [facePage.page_number, notePage.page_number],
  };
}

export interface PowerlinkConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: PowerlinkAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'powerlink-annual-report.pdf';
}

/**
 * Operator escape hatch: when `POWERLINK_ANNUAL_REPORT_URL` is set, it is used
 * as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): PowerlinkAnnualReportLink | null {
  const url = process.env.POWERLINK_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Powerlink-Queensland-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = powerlinkFiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `POWERLINK_ANNUAL_REPORT_URL filename "${filename}" has no report-year span; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: POWERLINK_SOURCE_URL,
  };
}

async function recordDeferral(
  document: PowerlinkAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: PowerlinkDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: POWERLINK_ID, document_url: document.url },
    {
      $set: {
        entity: POWERLINK_ENTITY,
        jurisdiction: POWERLINK_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Powerlink SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Powerlink connector. */
export function createPowerlinkConnector(options: PowerlinkConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: POWERLINK_ID,
    name: POWERLINK_NAME,
    publisher: POWERLINK_PUBLISHER,
    source_url: POWERLINK_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: POWERLINK_LICENSE,
    notes:
      'QLD SOC: Powerlink Queensland only (Queensland Electricity Transmission Corporation Limited), a Queensland Government Owned Corporation (GOC). The latest annual report is discovered from Powerlink\'s official reports page (no hard-coded PDF URL): the reports page lists annual-report landing pages and the newest page carries the PDF. The exact PDF is SHA-256 archived outside the repo. The consolidated statement prints an explicit $\'000 unit; it has no printed Total revenue or Total expenses subtotal, so total revenue is the exact sum of Revenue + Other gains/(losses) + Finance income and total expenses is the exact sum of Expenses from continuing operations + Impairment losses + Finance costs. Both are accepted only when they bridge to the printed PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT and PROFIT/(LOSS) FOR THE YEAR with zero tolerance, and Note 3\'s five components separately reconcile to the face statement. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Powerlink is never added to government program spending, the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, another QLD GOC, a QLD total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverPowerlinkAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Powerlink PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: POWERLINK_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Powerlink annual-report PDF; archived for auditable QLD SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: PowerlinkParseContext = {
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
      const parsed = parsePowerlinkExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'qld-powerlink-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'qld-powerlink-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Powerlink measure; skipped');
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
