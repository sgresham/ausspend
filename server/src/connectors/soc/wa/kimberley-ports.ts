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
 * WA SOC — Kimberley Ports Authority annual-report adapter.
 *
 * The tenth WA Government Trading Enterprise (GTE) pilot, following the
 * Water Corporation/Synergy/Western Power/Horizon Power/Fremantle
 * Ports/DevelopmentWA/Southern Ports/Busselton Water/Mid West Ports pattern:
 * one entity, one audited face statement, no jurisdiction total. Kimberley
 * Ports Authority is a WA GTE under the Government Trading Enterprises Act
 * 2023 (WA) and the Port Authorities Act 1999 (WA), not a Queensland GOC or an
 * NSW SOC.
 *
 * Source gate:
 * - The latest report is discovered from the official publications page. That
 *   page exposes no direct PDF hrefs, so discovery falls back to the official
 *   WordPress search endpoint for the `document` post type; no PDF URL is
 *   hard-coded.
 * - The `?document=annual-report-YYYY-YYYY` endpoint is followed through its
 *   redirect and the exact final PDF bytes are SHA-256 archived outside the
 *   repo.
 * - The Statement of Comprehensive Income prints an explicit "$'000" unit for
 *   the 2026 and 2025 columns; a table read as whole dollars or millions is
 *   rejected, never converted by magnitude.
 *
 * Current-report outcome:
 * - The 2025-26 face statement prints Revenue + Other Income, nine expense
 *   lines classified by nature, Profit before income tax, Income tax expense
 *   and Net Profit after tax. Those figures bridge exactly at zero tolerance.
 * - It does NOT print a total employee benefits expense. Note 1 says employee
 *   benefits are allocated across port operations expenses, general
 *   administration expenses and asset maintenance; asset maintenance has no
 *   note split, so no total employee expense can be proved. The adapter
 *   therefore defers the 2025-26 document with no rows rather than inventing
 *   the missing employee expense.
 *
 * Every emitted row would be an entity-level SOC statement line:
 * jurisdiction_level "soc", aggregation_role "agency_detail", provisional and
 * verified:false. Kimberley Ports Authority rows are never added to government
 * program spending, the PNFC benchmark, another WA GTE, a QLD/NSW SOC, a WA
 * total, or each other.
 */

export const KIMBERLEY_PORTS_ID = 'wa-kimberley-ports';
export const KIMBERLEY_PORTS_NAME = 'Kimberley Ports Authority — Annual Report';
export const KIMBERLEY_PORTS_PUBLISHER = 'Kimberley Ports Authority';
export const KIMBERLEY_PORTS_ENTITY = 'Kimberley Ports Authority';
export const KIMBERLEY_PORTS_JURISDICTION = 'WA';
export const KIMBERLEY_PORTS_LEGAL_CLASS =
  'WA Government Trading Enterprise (GTE) — Government Trading Enterprises Act 2023 (WA)';
/** Canonical official publications page. Annual-report documents are discovered from it. */
export const KIMBERLEY_PORTS_SOURCE_URL = 'https://kimberleyports.wa.gov.au/forms-and-publications';
export const KIMBERLEY_PORTS_LICENSE =
  '© Kimberley Ports Authority. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const KIMBERLEY_PORTS_UNIT = 'AUD_thousands';
export const KIMBERLEY_PORTS_UNIT_LABEL = "$'000";
export const KIMBERLEY_PORTS_UNIT_TO_CENTS = 100_000;
export const KIMBERLEY_PORTS_CAVEAT =
  "Entity-level SOC statement lines for Kimberley Ports Authority only (the Kimberley Ports Authority, a WA Government Trading Enterprise under the Government Trading Enterprises Act 2023 (WA)). Never add to government program spending, the PNFC sector benchmark, Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, Busselton Water, Mid West Ports, another WA GTE, a QLD/NSW SOC, a WA or national total, or to each other. The 2025-26 Statement of Comprehensive Income prints an explicit $'000 unit and reconciles its printed Profit before income tax and Net Profit after tax exactly, but it does not print a total employee benefits expense: Note 1 allocates employee benefits across port operations expenses, general administration expenses and asset maintenance, and asset maintenance has no note split. The adapter therefore defers the 2025-26 document with no rows rather than inventing the missing employee expense. Provisional and unverified for any future reconciled report.";

/** A discovered annual-report document. The PDF URL is never hard-coded. */
export interface KimberleyPortsAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html,application/json;q=0.9,*/*;q=0.8',
} as const;

const ANNUAL_REPORT_MARKER = /annual[\s_\-–]*report/i;
const NON_ANNUAL_REPORT =
  /handbook|trade[\s_\-–]*statistics|community[\s_\-–]*investment|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|corporate[\s_\-–]*plan/i;

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
 * Convert an annual-report document slug or filename into the API fiscal year.
 * Accepts the official `annual-report-2025-2026` document slug and
 * `annual-report-2025-26`/`Annual_Report_2026` filename forms. Port handbooks,
 * trade statistics, community-investment reports, statements of corporate
 * intent and corporate plans are rejected by name.
 */
export function kimberleyPortsFiscalYearFromDocumentSlug(value: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(value) || NON_ANNUAL_REPORT.test(value)) return null;
  const span = /annual[\s_\-–]*report[\s_\-–]*(\d{4})[\s_\-–]*(\d{2,4})(?!\d)/i.exec(value);
  if (span) {
    const fromSpan = fiscalYearFromSpan(span[1] as string, span[2] as string);
    if (fromSpan) return fromSpan;
  }
  // A single year in an annual-report filename means a report for the year
  // ending in that year (e.g. Annual_Report_2026.pdf).
  const year = /(?:^|[^0-9])(20\d{2})(?!\d)/.exec(value)?.[1];
  return year ? fiscalYearEnding(year) : null;
}

function candidateFromUrl(
  rawUrl: string,
  pageUrl: string,
): Pick<KimberleyPortsAnnualReportLink, 'url' | 'filename' | 'fiscal_year'> | null {
  const normalized = rawUrl.replace(/\\+\//g, '/').replace(/&amp;/g, '&');
  let url: URL;
  try {
    url = new URL(normalized, pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const documentParam = url.searchParams.get('document');
  const slugSource = documentParam ?? decodeURIComponent(url.pathname.split('/').pop() ?? '');
  const fiscalYear = kimberleyPortsFiscalYearFromDocumentSlug(slugSource);
  if (!fiscalYear) return null;
  const filename = documentParam
    ? `${documentParam.replace(/[^A-Za-z0-9._-]+/g, '-')}.pdf`
    : decodeURIComponent(url.pathname.split('/').pop() ?? 'kimberley-ports-annual-report.pdf');
  return {
    url: url.toString(),
    filename,
    fiscal_year: fiscalYear,
  };
}

/**
 * Parse annual-report document links from the publications page HTML or the
 * official WordPress search JSON. A link is accepted only when it names an
 * annual report and a year; handbooks, trade statistics, community-investment
 * reports, corporate plans and the SCI are rejected.
 */
export function parseKimberleyPortsAnnualReportLinks(
  text: string,
  pageUrl: string = KIMBERLEY_PORTS_SOURCE_URL,
): KimberleyPortsAnnualReportLink[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | undefined): void => {
    if (!raw) return;
    const normalized = raw.replace(/\\+\//g, '/').replace(/&amp;/g, '&').trim();
    if (!/^https?:\/\//i.test(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  };

  // HTML hrefs and JSON `url`/`link`/`permalink` fields.
  for (const match of text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) push(match[1]);
  for (const match of text.matchAll(/"(?:url|link|permalink)"\s*:\s*"([^"]+)"/gi)) push(match[1]);

  const links: KimberleyPortsAnnualReportLink[] = [];
  const seenLinks = new Set<string>();
  for (const raw of urls) {
    const candidate = candidateFromUrl(raw, pageUrl);
    if (!candidate) continue;
    const key = candidate.url;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    const [start, end] = candidate.fiscal_year.split('-');
    links.push({
      ...candidate,
      title: `Annual Report ${start}–${end}`,
      discovery_page: pageUrl,
    });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

function discoveryApiUrl(pageUrl: string): string {
  return new URL('/wp-json/wp/v2/search?search=annual%20report&per_page=20', pageUrl).toString();
}

/**
 * Fetch the official publications page and return its newest annual-report
 * document. The page exposes no direct PDF hrefs, so a documented fallback
 * queries the site's official WordPress search endpoint for `document` posts.
 * A site with no annual-report document is an error, never a guessed URL.
 */
export async function discoverKimberleyPortsAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = KIMBERLEY_PORTS_SOURCE_URL,
): Promise<KimberleyPortsAnnualReportLink> {
  const attempts: string[] = [];
  try {
    const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
    if (response.ok) {
      const html = await response.text();
      const links = parseKimberleyPortsAnnualReportLinks(html, pageUrl);
      const latest = links[0];
      if (latest) return latest;
      attempts.push(
        `official publications page ${pageUrl} contained no annual-report document link`,
      );
    } else {
      attempts.push(`official publications page ${pageUrl} returned HTTP ${response.status}`);
    }
  } catch (error) {
    attempts.push(
      `official publications page ${pageUrl} could not be fetched: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const apiUrl = discoveryApiUrl(pageUrl);
  try {
    const response = await fetchImpl(apiUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
    if (response.ok) {
      const body = await response.text();
      const links = parseKimberleyPortsAnnualReportLinks(body, apiUrl);
      const latest = links[0];
      if (latest) return { ...latest, discovery_page: pageUrl };
      attempts.push(
        `official WordPress search endpoint ${apiUrl} contained no annual-report document`,
      );
    } else {
      attempts.push(
        `official WordPress search endpoint ${apiUrl} returned HTTP ${response.status}`,
      );
    }
  } catch (error) {
    attempts.push(
      `official WordPress search endpoint ${apiUrl} could not be fetched: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  throw new Error(
    `Kimberley Ports Authority annual report could not be discovered; refusing to hard-code a PDF URL. ${attempts.join('; ')}`,
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

/** Money cells for the face statement sit in the left half (300 <= x < 420). */
function moneyItems(row: PageRow): PdfTextItem[] {
  return row.items.filter((item) => item.x >= 300 && item.x < 420 && isMoneyItem(item));
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

function unitSamples(rows: readonly PageRow[]): string[] {
  return rows
    .filter((row) => row.cells.some((cell) => cell.includes('$')))
    .map((row) => row.cells.join(' '));
}

export function detectKimberleyPortsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface KimberleyPortsStatement {
  page_number: number;
  unit: UnitDetection;
  revenue: number;
  other_income: number;
  total_revenue: number;
  port_operations_expenses: number;
  depreciation_amortisation: number;
  general_administration_expenses: number;
  asset_maintenance: number;
  port_utilities: number;
  finance_expenses: number;
  safety_security: number;
  environmental_expenses: number;
  other_expenses: number;
  employee_expenses: number | null;
  employee_gap: string | null;
  total_expenses: number;
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
      text.includes('depreciation and amortisation') &&
      text.includes('profit before income tax') &&
      text.includes('net profit after tax')
    ) {
      return page;
    }
  }
  return null;
}

export function parseKimberleyPortsStatement(facePage: PdfPage): KimberleyPortsStatement | null {
  const rawRows = groupPageRows(facePage.items);
  const rows = logicalRows(rawRows);
  const unit = detectMoneyUnit(unitSamples(rawRows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Revenue');
  if (anchor === null) {
    errors.push('statement 2026 money column could not be anchored from the printed revenue row');
    return null;
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);
  const readAny = (labels: readonly string[]): CellValue => {
    for (const label of labels) {
      const cell = read(label);
      if (cell.found) return cell;
    }
    return { value: null, found: false, nil: false };
  };

  const revenue = read('Revenue');
  const otherIncome = read('Other Income');
  const portOperations = read('Port operations expenses');
  const depreciation = read('Depreciation and amortisation');
  const generalAdministration = read('General administration expenses');
  const assetMaintenance = read('Asset maintenance');
  const portUtilities = read('Port utilities');
  const financeExpenses = read('Finance expenses');
  const safetySecurity = read('Safety & security');
  const environmentalExpenses = read('Environmental expenses');
  const otherExpenses = read('Other expenses');
  const employee = readAny([
    'Employee benefits expense',
    'Employee benefit expense',
    'Employee expenses',
  ]);
  const profitBeforeTax = read('Profit before income tax');
  const incomeTax = read('Income tax expense');
  const netResult = read('Net Profit after tax');

  const required: Array<[string, CellValue]> = [
    ['Revenue', revenue],
    ['Other Income', otherIncome],
    ['Port operations expenses', portOperations],
    ['Depreciation and amortisation', depreciation],
    ['General administration expenses', generalAdministration],
    ['Asset maintenance', assetMaintenance],
    ['Port utilities', portUtilities],
    ['Finance expenses', financeExpenses],
    ['Safety & security', safetySecurity],
    ['Environmental expenses', environmentalExpenses],
    ['Other expenses', otherExpenses],
    ['Profit before income tax', profitBeforeTax],
    ['Income tax expense', incomeTax],
    ['Net Profit after tax', netResult],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const revenueValue = revenue.value as number;
  const otherIncomeValue = otherIncome.value as number;
  const portOperationsValue = Math.abs(portOperations.value as number);
  const depreciationValue = Math.abs(depreciation.value as number);
  const generalAdministrationValue = Math.abs(generalAdministration.value as number);
  const assetMaintenanceValue = Math.abs(assetMaintenance.value as number);
  const portUtilitiesValue = Math.abs(portUtilities.value as number);
  const financeExpensesValue = Math.abs(financeExpenses.value as number);
  const safetySecurityValue = Math.abs(safetySecurity.value as number);
  const environmentalExpensesValue = Math.abs(environmentalExpenses.value as number);
  const otherExpensesValue = Math.abs(otherExpenses.value as number);
  const profitBeforeTaxValue = profitBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;

  const totalRevenue = revenueValue + otherIncomeValue;
  checks.push(`total revenue exact: ${revenueValue} + ${otherIncomeValue} = ${totalRevenue}`);

  const expenseComponents = [
    portOperationsValue,
    depreciationValue,
    generalAdministrationValue,
    assetMaintenanceValue,
    portUtilitiesValue,
    financeExpensesValue,
    safetySecurityValue,
    environmentalExpensesValue,
    otherExpensesValue,
  ];
  const expensesWithoutEmployee = expenseComponents.reduce((sum, value) => sum + value, 0);
  const employeeValue = employee.found ? Math.abs(employee.value as number) : null;
  const expensesWithEmployee =
    employeeValue === null ? expensesWithoutEmployee : expensesWithoutEmployee + employeeValue;

  let totalExpenses = expensesWithoutEmployee;
  let employeeAddedToTotal = false;
  if (employeeValue !== null) {
    const withoutBridge = totalRevenue - expensesWithoutEmployee;
    const withBridge = totalRevenue - expensesWithEmployee;
    if (withoutBridge !== profitBeforeTaxValue && withBridge === profitBeforeTaxValue) {
      totalExpenses = expensesWithEmployee;
      employeeAddedToTotal = true;
    }
  }

  checks.push(
    `total expenses exact: ${expenseComponents.join(' + ')} = ${expensesWithoutEmployee} (derived; no printed Total expenses subtotal)` +
      (employeeAddedToTotal
        ? ` + printed Employee benefits expense ${employeeValue} = ${totalExpenses}`
        : ''),
  );

  const profitBeforeTaxBridge = totalRevenue - totalExpenses;
  checks.push(
    `profit-before-tax bridge exact: ${totalRevenue} - ${totalExpenses} = ${profitBeforeTaxBridge} (printed ${profitBeforeTaxValue})`,
  );
  if (profitBeforeTaxBridge !== profitBeforeTaxValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${totalRevenue} - ${totalExpenses} = ${profitBeforeTaxBridge}, printed Profit before income tax ${profitBeforeTaxValue}`,
    );
  }

  const netBridge = profitBeforeTaxValue + taxValue;
  checks.push(
    `net-result bridge exact: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge} (printed ${netValue})`,
  );
  if (netBridge !== netValue) {
    errors.push(
      `net-result bridge mismatch: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge}, printed Net Profit after tax ${netValue}`,
    );
  }

  let employeeGap: string | null = null;
  if (employeeValue === null) {
    employeeGap =
      'the Statement of Comprehensive Income does not print a total employee benefits expense; ' +
      'Note 1 states employee benefits are allocated across port operations expenses, general administration expenses and asset maintenance, ' +
      'and asset maintenance has no note split, so a total employee expense cannot be proved without inventing the undisclosed component';
    checks.push(`employee expenses gap: ${employeeGap}`);
    warnings.push(employeeGap);
  }

  warnings.push(
    "the Statement of Comprehensive Income prints an explicit $'000 unit and two reporting-year columns; the adapter reads the 2026 column only. It has no printed Total revenue or Total expenses subtotal, so total revenue is the exact sum of Revenue + Other Income and total expenses is the exact sum of the printed expense lines; both are accepted only because the Profit before income tax and Net Profit after tax bridges agree at zero tolerance.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    revenue: revenueValue,
    other_income: otherIncomeValue,
    total_revenue: totalRevenue,
    port_operations_expenses: portOperationsValue,
    depreciation_amortisation: depreciationValue,
    general_administration_expenses: generalAdministrationValue,
    asset_maintenance: assetMaintenanceValue,
    port_utilities: portUtilitiesValue,
    finance_expenses: financeExpensesValue,
    safety_security: safetySecurityValue,
    environmental_expenses: environmentalExpensesValue,
    other_expenses: otherExpensesValue,
    employee_expenses: employeeValue,
    employee_gap: employeeGap,
    total_expenses: totalExpenses,
    profit_before_tax: profitBeforeTaxValue,
    income_tax: Math.abs(taxValue),
    net_result: netValue,
    checks,
    warnings,
    errors,
  };
}

export interface KimberleyPortsParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface KimberleyPortsDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation' | 'employee';
}

export interface KimberleyPortsLineSpec {
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

export interface KimberleyPortsParseResult {
  records: SpendingRecord[];
  deferral: KimberleyPortsDeferral | null;
  statement: KimberleyPortsStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function kimberleyPortsNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${KIMBERLEY_PORTS_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * KIMBERLEY_PORTS_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: KimberleyPortsParseContext,
  spec: KimberleyPortsLineSpec,
  statement: KimberleyPortsStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${KIMBERLEY_PORTS_UNIT_LABEL} (${KIMBERLEY_PORTS_UNIT}; x${KIMBERLEY_PORTS_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    '2026 column only (prior column never added); entity-level SOC statement line; single Kimberley Ports Authority entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, Busselton Water, Mid West Ports, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: KimberleyPortsLineSpec,
  context: KimberleyPortsParseContext,
  statement: KimberleyPortsStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: KIMBERLEY_PORTS_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: kimberleyPortsNaturalKey(
      KIMBERLEY_PORTS_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${KIMBERLEY_PORTS_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: KIMBERLEY_PORTS_JURISDICTION,
    delivery_entity: KIMBERLEY_PORTS_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Kimberley Ports Authority Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: KIMBERLEY_PORTS_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: KIMBERLEY_PORTS_UNIT,
    soc_section: spec.section,
    soc_note: 'Statement of Comprehensive Income',
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

export function parseKimberleyPortsExtraction(
  extraction: PdfExtraction,
  context: KimberleyPortsParseContext,
): KimberleyPortsParseResult {
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
  const statement = parseKimberleyPortsStatement(facePage);
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

  if (statement.employee_expenses === null) {
    return {
      records: [],
      deferral: {
        reason:
          statement.employee_gap ?? 'no printed total employee benefits expense could be proved',
        phase: 'employee',
      },
      statement,
      checks: statement.checks,
      warnings,
      pages_used: [facePage.page_number],
    };
  }

  const lineSpecs: KimberleyPortsLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: KIMBERLEY_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Exact sum of the printed Revenue + Other Income lines. No printed Total revenue subtotal exists on the face statement; the derived total is accepted only because it bridges to the printed Profit before income tax and Net Profit after tax.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: KIMBERLEY_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Exact sum of the printed Port operations expenses + Depreciation and amortisation + General administration expenses + Asset maintenance + Port utilities + Finance expenses + Safety & security + Environmental expenses + Other expenses lines. No printed Total expenses subtotal exists on the face statement; the derived total is accepted only because it bridges to the printed Profit before income tax and Net Profit after tax.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expense',
      amount_thousands: statement.employee_expenses,
      funding_source: KIMBERLEY_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee benefits expense line. A component of total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: KIMBERLEY_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation and amortisation line. A component of total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Net Profit after tax',
      amount_thousands: statement.net_result,
      funding_source: KIMBERLEY_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Net Profit after tax (net result after income tax). A result line, not an expense component; never add to revenue or expenses. 2026 column only.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the 2026 income and expense components reconcile exactly to the printed subtotals and every printed result bridge agrees at zero tolerance.',
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

export interface KimberleyPortsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest document. */
  document?: KimberleyPortsAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'kimberley-ports-annual-report.pdf';
}

/**
 * Operator escape hatch: when `WA_KIMBERLEY_PORTS_ANNUAL_REPORT_URL` is set,
 * it is used as the exact official document URL. The default path is live
 * discovery.
 */
function documentFromEnv(): KimberleyPortsAnnualReportLink | null {
  const url = process.env.WA_KIMBERLEY_PORTS_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'kimberley-ports-annual-report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = kimberleyPortsFiscalYearFromDocumentSlug(url) ?? '2025-26';
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: KIMBERLEY_PORTS_SOURCE_URL,
  };
}

async function recordDeferral(
  document: KimberleyPortsAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: KimberleyPortsDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: KIMBERLEY_PORTS_ID, document_url: document.url },
    {
      $set: {
        entity: KIMBERLEY_PORTS_ENTITY,
        jurisdiction: KIMBERLEY_PORTS_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Kimberley Ports Authority SOC adapter; no row from this document was ingested. A human must resolve the missing printed employee-expenses line before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Kimberley Ports Authority connector. */
export function createKimberleyPortsConnector(
  options: KimberleyPortsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: KIMBERLEY_PORTS_ID,
    name: KIMBERLEY_PORTS_NAME,
    publisher: KIMBERLEY_PORTS_PUBLISHER,
    source_url: KIMBERLEY_PORTS_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: KIMBERLEY_PORTS_LICENSE,
    notes:
      'WA SOC: Kimberley Ports Authority only, a WA Government Trading Enterprise (Government Trading Enterprises Act 2023 (WA)). The latest annual report is discovered from the official publications page (no hard-coded PDF URL); because that page exposes no direct PDF hrefs, discovery falls back to the official WordPress search endpoint for the document. The official ?document= endpoint is followed through its redirect and the exact PDF is SHA-256 archived outside the repo. The Statement of Comprehensive Income prints an explicit $\'000 unit and two reporting-year columns; the adapter reads the 2026 column only. It has no printed Total revenue or Total expenses subtotal, so total revenue is the exact sum of Revenue + Other Income and total expenses is the exact sum of the printed expense lines, accepted only when they bridge to the printed Profit before income tax and Net Profit after tax at zero tolerance. The 2025-26 document is deferred with no rows because it does not print a total employee benefits expense (Note 1 allocates employee benefits across port operations, general administration and asset maintenance, and asset maintenance has no note split). Every future row would be a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"); Kimberley Ports Authority is never added to government program spending, the PNFC benchmark, another WA GTE, a QLD/NSW SOC, a WA total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverKimberleyPortsAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(
          `Kimberley Ports Authority PDF fetch HTTP ${response.status} for ${document.url}`,
        );
      }
      const finalUrl = response.url || document.url;
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: KIMBERLEY_PORTS_ID,
        title: document.title,
        original_url: finalUrl,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(finalUrl),
        content_type: response.headers.get('content-type') ?? 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Kimberley Ports Authority annual-report PDF; archived after following the official ?document= redirect for auditable WA SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: KimberleyPortsParseContext = {
        document_url: finalUrl,
        document_title: document.title,
        fiscal_year: document.fiscal_year,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
        },
        source_date: now.toISOString().slice(0, 10),
      };
      const parsed = parseKimberleyPortsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.deferral) {
        await recordDeferral({ ...document, url: document.url }, archived, parsed.deferral);
        metadata.errors.push(
          `deferred ${document.fiscal_year}: ${parsed.deferral.phase}: ${parsed.deferral.reason}`,
        );
        return [];
      }
      if (parsed.records.length === 0) {
        metadata.errors.push(`${document.fiscal_year}: no validated SOC rows extracted`);
      }
      return parsed.records.map((record) => ({ kind: 'wa-kimberley-ports-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'wa-kimberley-ports-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Kimberley Ports Authority measure; skipped');
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
