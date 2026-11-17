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
 * NSW SOC Phase 9 — Transport Asset Holding Entity of NSW (TAHE) adapter.
 *
 * This reuses the established NSW SOC layer: one entity adapter, not a second
 * framework. TAHE is the eighth NSW SOC entity after Sydney Water, WaterNSW,
 * Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom and
 * Port Authority of NSW.
 *
 * Source gate:
 * - The document is discovered from the official TAHE publications page, now
 *   served by Transport Asset Manager (TAM) of NSW, TAHE's statutory successor
 *   (tahe.com.au and tahensw.com.au redirect there). No PDF URL is hard-coded.
 *   The exact PDF bytes are SHA-256 archived outside the repo.
 * - The audited Statement of comprehensive income prints an explicit "$'000"
 *   unit. A table read as dollars or millions is rejected, not converted by
 *   magnitude. One $'000 unit = 100,000 cents.
 * - The statement prints an explicit Total revenue and Total expenses subtotal.
 *   Both printed totals are accepted only when every printed bridge reconciles
 *   with zero tolerance: the five printed revenue lines sum to Total revenue,
 *   the five non-nil printed expense lines plus the explicitly printed nil
 *   valuation decrement sum to Total expenses, and the net result equals Total
 *   revenue less Total expenses. A one-thousand-dollar mismatch defers the
 *   whole document.
 * - TAHE separately discloses "Grants and contributions" in the statement and
 *   Note 2.3, so that line is emitted as a separate grant row with
 *   potential_double_count=true. It is already inside Total revenue and is
 *   never added again.
 */

export const TAHE_ID = 'tahe';
export const TAHE_NAME = 'TAHE — Annual Report';
export const TAHE_PUBLISHER =
  'Transport Asset Holding Entity of NSW (published by Transport Asset Manager of NSW)';
export const TAHE_ENTITY = 'TAHE';
export const TAHE_LEGAL_NAME = 'Transport Asset Holding Entity of New South Wales';
export const TAHE_JURISDICTION = 'NSW';
export const TAHE_SOURCE_URL = 'https://www.tam.nsw.gov.au/publications';
export const TAHE_LICENSE =
  '© Transport Asset Holding Entity of NSW / Transport Asset Manager of NSW. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const TAHE_UNIT = 'AUD_thousands';
export const TAHE_UNIT_LABEL = "$'000";
export const TAHE_UNIT_TO_CENTS = 100_000;
export const TAHE_CAVEAT =
  'Entity-level SOC statement lines for TAHE (Transport Asset Holding Entity of New South Wales) only. Never add to government program spending, to the PNFC sector benchmark, or to each other: the statement prints an explicit Total revenue and Total expenses; total revenue already includes the separately shown Grants and contributions line, total expenses already includes employee-related expenses, other operating expenses, other expenses, depreciation/amortisation/de-recognition and finance costs; the net result is a surplus. The FY2023-24 result is materially affected by a $17.8bn valuation increment and a change in grants recognition, so it is not comparable to prior years. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the URL; parse the page. */
export interface TaheAnnualReportLink {
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
  /statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|soe[\s_\-–]*annual[\s_\-–]*statement|agency[\s_\-–]*information|pricing|modern[\s_\-–]*slavery|corporate[\s_\-–]*plan|supplier[\s_\-–]*code|fraud|gipa|half[\s_\-–]*year|sustainability|access[\s_\-–]*undertaking|safety|ensms|performance|budget|climate|reconciliation/i;

/** Map a report year (year ended 30 June) to the API fiscal year "2024-25". */
export function taheFiscalYearFromReportYear(reportYear: number): string {
  return `${reportYear - 1}-${String(reportYear % 100).padStart(2, '0')}`;
}

function fiscalYearFromFilename(filename: string): string | null {
  // Full range such as "2022 - 2023".
  const fullRange = /(\d{4})\s*[-–]\s*(\d{4})/.exec(filename);
  if (fullRange?.[1] && fullRange[2]) {
    const start = Number(fullRange[1]);
    const end = Number(fullRange[2]);
    if (end === start + 1) return `${start}-${String(end % 100).padStart(2, '0')}`;
  }
  // Short range such as "2024-25" or "2018-19".
  const shortRange = /(\d{4})\s*[-–]\s*(\d{2})(?!\d)/.exec(filename);
  if (shortRange?.[1] && shortRange[2]) {
    const start = Number(shortRange[1]);
    const expectedEnd = String((start + 1) % 100).padStart(2, '0');
    if (shortRange[2] !== expectedEnd) return null;
    return `${start}-${expectedEnd}`;
  }
  // Compact range as printed by TAHE, e.g. "202324 Annual Report".
  for (const match of filename.matchAll(/(?<!\d)(20\d{2})(\d{2})(?!\d)/g)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (end === (start + 1) % 100) return `${start}-${String(end).padStart(2, '0')}`;
  }
  // A four-digit report/publication year (AR2023-24 is published in 2024).
  const four = [...filename.matchAll(/\b(20\d{2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year >= 2010 && year <= 2035);
  if (four.length > 0) {
    const reportYear = four[four.length - 1] as number;
    return taheFiscalYearFromReportYear(reportYear);
  }
  // Legacy short form such as "ar24" / "ar_18".
  const short = /(?:^|[_\-\s])ar[_\-\s]?(\d{2})(?:[_\-\s.]|$)/i.exec(filename);
  if (short?.[1]) {
    const reportYear = 2000 + Number(short[1]);
    if (reportYear >= 2010 && reportYear <= 2035) {
      return taheFiscalYearFromReportYear(reportYear);
    }
  }
  return null;
}

/**
 * Parse the annual-report PDF links on the official publications page. The
 * current page serves "Transport Asset Holding Entity of NSW 202324 Annual
 * Report_0.pdf" and the older "Transport Asset Holding Entity - Annual Report
 * 2022 - 2023 - Compressed.pdf"; the statement of corporate intent, Agency
 * Information Guide, pricing schedules, corporate plan and supplier code are
 * rejected. No URL is hard-coded.
 */
export function parseTaheAnnualReportPdfLinks(
  html: string,
  pageUrl: string = TAHE_SOURCE_URL,
): TaheAnnualReportLink[] {
  const links: TaheAnnualReportLink[] = [];
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
    const looksAnnual = /annual[\s_-–]*report|(?:^|[_\-\s])ar[\s_-]?\d{2}/i.test(filename);
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

/** Fetch the official publications page and return its latest annual report. */
export async function discoverTaheAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = TAHE_SOURCE_URL,
): Promise<TaheAnnualReportLink> {
  const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(`TAHE publications page HTTP ${response.status} for ${pageUrl}`);
  }
  const html = await response.text();
  const links = parseTaheAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'TAHE publications page contains no annual-report PDF link; refusing to hard-code a URL',
    );
  }
  return latest;
}

/** Convert "year ended 30 June 2024" into the API fiscal year "2023-24". */
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

/**
 * A printed label may wrap across two PDF lines. The first line carries the
 * label with no amount; the continuation line carries the amount. Match the
 * continuation directly below the first line, never a note number.
 */
function wrappedValue(
  rows: readonly PageRow[],
  firstLineStartsWith: string,
  continuationStartsWith: string,
  anchor: number,
): number | null {
  const index = rows.findIndex((row) =>
    labelOf(row).toLowerCase().startsWith(firstLineStartsWith.toLowerCase()),
  );
  if (index < 0) return null;
  const first = rows[index];
  if (!first) return null;
  const direct = valueNear(first, anchor);
  if (direct !== null) return direct;
  for (let i = index + 1; i < Math.min(rows.length, index + 3); i++) {
    const row = rows[i];
    if (!row) continue;
    if (labelOf(row).toLowerCase().startsWith(continuationStartsWith.toLowerCase())) {
      return valueNear(row, anchor);
    }
  }
  return null;
}

/**
 * Find a printed row whose value sits on a continuation line and report whether
 * the current-year cell is an explicit nil marker ("-"). This keeps a printed
 * nil separate from a missing/unparseable amount.
 */
function wrappedValueOrNil(
  rows: readonly PageRow[],
  firstLineStartsWith: string,
  continuationStartsWith: string,
  anchor: number,
): { found: boolean; value: number | null; nil: boolean } {
  const index = rows.findIndex((row) =>
    labelOf(row).toLowerCase().startsWith(firstLineStartsWith.toLowerCase()),
  );
  if (index < 0) return { found: false, value: null, nil: false };
  for (let i = index; i < Math.min(rows.length, index + 3); i++) {
    const row = rows[i];
    if (!row) continue;
    if (i > index && !labelOf(row).toLowerCase().startsWith(continuationStartsWith.toLowerCase())) {
      continue;
    }
    const value = valueNear(row, anchor);
    if (value !== null) return { found: true, value, nil: false };
    const nil = row.items.some((item) => {
      if (!/^[-–—]$/.test(item.str.trim())) return false;
      return Math.abs(item.x + item.width - anchor) <= 16;
    });
    if (nil) return { found: true, value: null, nil: true };
  }
  return { found: true, value: null, nil: false };
}

const UNIT_TOKEN =
  /^(?:\$\s*['’‘]?0{3}|\$\s*(?:k|thousand|thousands|m|mn|million|millions|b|bn|billion|billions)|\$|['’‘]000|\$?\s*(?:k|thousand|thousands|m|mn|million|millions|b|bn|billion|billions))$/i;

/**
 * Only genuine unit-header cells are sampled. Prose such as "$1,334.6 million"
 * in the financial-performance narrative must not flip an otherwise explicit
 * "$'000" statement to millions.
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
export function detectTaheUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

function thousands(value: number): number {
  return Math.round(value);
}

function thousandsLabel(value: number): string {
  return String(value);
}

export interface TaheStatement {
  page_number: number;
  unit: UnitDetection;
  revenue_from_contracts: number;
  investment_revenue: number;
  grants_and_contributions: number;
  valuation_increment: number;
  other_income: number;
  total_revenue: number;
  employee_expenses: number;
  other_operating_expenses: number;
  valuation_decrement_nil: boolean;
  other_expenses: number;
  depreciation_amortisation: number;
  finance_costs: number;
  total_expenses: number;
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
      text.includes('total revenue') &&
      text.includes('total expenses') &&
      text.includes('total comprehensive income') &&
      text.includes('the accompanying notes form part of these financial statements')
    ) {
      return page;
    }
  }
  return null;
}

export function parseTaheStatement(page: PdfPage): TaheStatement | null {
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

  const revenueContracts = valueFor(rows, 'Revenue from contracts with customers', anchor);
  const investment = valueFor(rows, 'Investment revenue', anchor);
  const grants = valueFor(rows, 'Grants and contributions', anchor);
  const valuationIncrement = wrappedValue(
    rows,
    'Valuation increment of property, plant and equipment and',
    'intangible assets',
    anchor,
  );
  const otherIncome = valueFor(rows, 'Other income', anchor);
  const totalRevenue = valueFor(rows, 'Total revenue', anchor);
  const employee = valueFor(rows, 'Employee-related expenses', anchor);
  const otherOperating = valueFor(rows, 'Other operating expenses', anchor);
  const valuationDecrement = wrappedValueOrNil(
    rows,
    'Valuation decrement of property, plant and equipment and',
    'intangible assets',
    anchor,
  );
  const otherExpenses = valueFor(rows, 'Other expenses', anchor);
  const depreciation = valueFor(rows, 'Depreciation, amortisation and de-recognition', anchor);
  const financeCosts = valueFor(rows, 'Finance costs', anchor);
  const totalExpenses = valueFor(rows, 'Total expenses', anchor);
  const netResult = valueFor(rows, 'Net result', anchor);

  const required: Array<[string, number | null]> = [
    ['Revenue from contracts with customers', revenueContracts],
    ['Investment revenue', investment],
    ['Grants and contributions', grants],
    [
      'Valuation increment of property, plant and equipment and intangible assets',
      valuationIncrement,
    ],
    ['Other income', otherIncome],
    ['Total revenue', totalRevenue],
    ['Employee-related expenses', employee],
    ['Other operating expenses', otherOperating],
    ['Other expenses', otherExpenses],
    ['Depreciation, amortisation and de-recognition', depreciation],
    ['Finance costs', financeCosts],
    ['Total expenses', totalExpenses],
    ['Net result', netResult],
  ];
  const missing = required.filter(([, value]) => value === null).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return {
      page_number: page.page_number,
      unit,
      revenue_from_contracts: 0,
      investment_revenue: 0,
      grants_and_contributions: 0,
      valuation_increment: 0,
      other_income: 0,
      total_revenue: 0,
      employee_expenses: 0,
      other_operating_expenses: 0,
      valuation_decrement_nil: false,
      other_expenses: 0,
      depreciation_amortisation: 0,
      finance_costs: 0,
      total_expenses: 0,
      net_result: 0,
      checks,
      warnings,
      errors,
    };
  }

  if (!valuationDecrement.found) {
    errors.push(
      'printed Valuation decrement of property, plant and equipment and intangible assets line is missing; cannot prove the expense bridge',
    );
  } else if (!valuationDecrement.nil && valuationDecrement.value === null) {
    errors.push(
      'printed Valuation decrement line has neither a numeric current-year value nor an explicit nil marker',
    );
  }

  const t = (value: number): number => thousands(value);
  const magnitude = (value: number): number => Math.abs(thousands(value));

  const revenueContractsValue = t(revenueContracts as number);
  const investmentValue = t(investment as number);
  const grantsValue = t(grants as number);
  const valuationIncrementValue = t(valuationIncrement as number);
  const otherIncomeValue = t(otherIncome as number);
  const totalRevenueValue = t(totalRevenue as number);
  const employeeValue = magnitude(employee as number);
  const otherOperatingValue = magnitude(otherOperating as number);
  const valuationDecrementValue = magnitude(valuationDecrement.value ?? 0);
  const otherExpensesValue = magnitude(otherExpenses as number);
  const depreciationValue = magnitude(depreciation as number);
  const financeCostsValue = magnitude(financeCosts as number);
  const totalExpensesValue = magnitude(totalExpenses as number);
  const netResultValue = t(netResult as number);

  const revenueComponents =
    revenueContractsValue +
    investmentValue +
    grantsValue +
    valuationIncrementValue +
    otherIncomeValue;
  if (revenueComponents !== totalRevenueValue) {
    errors.push(
      `total-revenue bridge mismatch: ${thousandsLabel(revenueContractsValue)} + ${thousandsLabel(investmentValue)} + ${thousandsLabel(grantsValue)} + ${thousandsLabel(valuationIncrementValue)} + ${thousandsLabel(otherIncomeValue)} = ${thousandsLabel(revenueComponents)}, printed Total revenue ${thousandsLabel(totalRevenueValue)}`,
    );
  } else {
    checks.push(
      `total-revenue bridge exact: ${thousandsLabel(revenueContractsValue)} + ${thousandsLabel(investmentValue)} + ${thousandsLabel(grantsValue)} + ${thousandsLabel(valuationIncrementValue)} + ${thousandsLabel(otherIncomeValue)} = ${thousandsLabel(totalRevenueValue)}`,
    );
  }

  const expenseComponents =
    employeeValue +
    otherOperatingValue +
    valuationDecrementValue +
    otherExpensesValue +
    depreciationValue +
    financeCostsValue;
  if (expenseComponents !== totalExpensesValue) {
    errors.push(
      `total-expenses bridge mismatch: ${thousandsLabel(employeeValue)} + ${thousandsLabel(otherOperatingValue)} + ${thousandsLabel(valuationDecrementValue)} + ${thousandsLabel(otherExpensesValue)} + ${thousandsLabel(depreciationValue)} + ${thousandsLabel(financeCostsValue)} = ${thousandsLabel(expenseComponents)}, printed Total expenses ${thousandsLabel(totalExpensesValue)}`,
    );
  } else {
    checks.push(
      `total-expenses bridge exact: ${thousandsLabel(employeeValue)} + ${thousandsLabel(otherOperatingValue)} + ${thousandsLabel(valuationDecrementValue)} + ${thousandsLabel(otherExpensesValue)} + ${thousandsLabel(depreciationValue)} + ${thousandsLabel(financeCostsValue)} = ${thousandsLabel(totalExpensesValue)}`,
    );
  }

  const derivedNetResult = totalRevenueValue - totalExpensesValue;
  if (derivedNetResult !== netResultValue) {
    errors.push(
      `net-result bridge mismatch: ${thousandsLabel(totalRevenueValue)} - ${thousandsLabel(totalExpensesValue)} = ${thousandsLabel(derivedNetResult)}, printed Net result ${thousandsLabel(netResultValue)}`,
    );
  } else {
    checks.push(
      `net-result bridge exact: ${thousandsLabel(totalRevenueValue)} - ${thousandsLabel(totalExpensesValue)} = ${thousandsLabel(derivedNetResult)}`,
    );
  }

  if (valuationDecrement.nil) {
    checks.push(
      'printed Valuation decrement is an explicit nil ("-") and contributes 0 to the expense bridge',
    );
  }

  return {
    page_number: page.page_number,
    unit,
    revenue_from_contracts: revenueContractsValue,
    investment_revenue: investmentValue,
    grants_and_contributions: grantsValue,
    valuation_increment: valuationIncrementValue,
    other_income: otherIncomeValue,
    total_revenue: totalRevenueValue,
    employee_expenses: employeeValue,
    other_operating_expenses: otherOperatingValue,
    valuation_decrement_nil: valuationDecrement.nil,
    other_expenses: otherExpensesValue,
    depreciation_amortisation: depreciationValue,
    finance_costs: financeCostsValue,
    total_expenses: totalExpensesValue,
    net_result: netResultValue,
    checks,
    warnings,
    errors,
  };
}

export interface TaheParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface TaheDeferral {
  reason: string;
  phase: 'discovery' | 'unit' | 'statement' | 'reconciliation';
}

export interface TaheParseResult {
  records: SpendingRecord[];
  deferral: TaheDeferral | null;
  statement: TaheStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export interface TaheLineSpec {
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

export function taheNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${TAHE_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousandsOfDollars: number): number {
  const cents = Math.abs(thousandsOfDollars) * TAHE_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousandsOfDollars} thousands exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: TaheParseContext,
  spec: TaheLineSpec,
  statement: TaheStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `entity_legal_name: ${TAHE_LEGAL_NAME}`,
    `printed_unit: ${TAHE_UNIT_LABEL} (${TAHE_UNIT}; x${TAHE_UNIT_TO_CENTS} cents per unit; whole-thousand-dollar printed precision)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: TaheLineSpec,
  context: TaheParseContext,
  statement: TaheStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: TAHE_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: taheNaturalKey(
      TAHE_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${TAHE_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: TAHE_JURISDICTION,
    delivery_entity: TAHE_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `TAHE Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: TAHE_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: TAHE_UNIT,
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
      section: spec.section,
      revenue_thousands: statement.total_revenue,
      total_expenses_thousands: statement.total_expenses,
      net_result_thousands: statement.net_result,
      ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      ...(spec.line_item === 'government_grants'
        ? {
            potential_double_count_reason:
              'Grants and contributions are separately disclosed and already included in Total revenue; may overlap NSW government program spending',
          }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

function deferralResult(
  reason: string,
  phase: TaheDeferral['phase'],
  partial: Partial<TaheParseResult>,
): TaheParseResult {
  return {
    records: [],
    deferral: { reason, phase },
    statement: null,
    checks: [],
    warnings: [],
    pages_used: [],
    ...partial,
  };
}

export function parseTaheExtraction(
  extraction: PdfExtraction,
  context: TaheParseContext,
): TaheParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
    return deferralResult(
      'no parseable Statement of comprehensive income found in the PDF',
      'statement',
      { warnings },
    );
  }
  const statement = parseTaheStatement(statementPage);
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

  const pagesUsed = [statementPage.page_number];
  const checks = [...statement.checks];

  const lineSpecs: TaheLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: TAHE_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed statement Total revenue. Exactly equals the five printed revenue lines (Revenue from contracts with customers + Investment revenue + Grants and contributions + Valuation increment of property, plant and equipment and intangible assets + Other income). Includes the separately shown Grants and contributions line, which is never added again. The large FY2023-24 value reflects a $17.8bn valuation increment, not cash receipts.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: TAHE_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement Total expenses. Exactly equals the six printed expense lines (Employee-related expenses + Other operating expenses + Valuation decrement [printed nil] + Other expenses + Depreciation, amortisation and de-recognition + Finance costs). Never add the component rows to it.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee-related expenses',
      amount_thousands: statement.employee_expenses,
      funding_source: TAHE_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement line Employee-related expenses. The printed Note 3.1 employee-related expenses subtotal is the same value. A component of Total expenses; never add it to Total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation, amortisation and de-recognition',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: TAHE_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement line Depreciation, amortisation and de-recognition. A component of Total expenses; never add it to Total expenses. The FY2023-24 increase follows the change to current replacement cost valuation, so it is not comparable to FY2022-23.',
    },
    {
      line_item: 'government_grants',
      label: 'Grants and contributions',
      amount_thousands: statement.grants_and_contributions,
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'revenue',
      detail:
        'Printed statement line Grants and contributions, also disclosed in Note 2.3 as Capital 1,128,777 plus Operating 141,022. Already included in Total revenue and may overlap NSW government program spending; never add it to the total.',
    },
    {
      line_item: 'net_result',
      label: 'Net result',
      amount_thousands: statement.net_result,
      funding_source: TAHE_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
      detail:
        'Printed Net result. A result line, not an expense component; never add to revenue or expenses. The FY2023-24 surplus is driven by the valuation increment and grants-recognition change, not operating cash flow.',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the printed Total revenue and Total expenses reconcile exactly to their printed components and the net result reconciles to revenue less expenses.',
  );
  return {
    records,
    deferral: null,
    statement,
    checks,
    warnings,
    pages_used: pagesUsed,
  };
}

export interface TaheConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: TaheAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'tahe-annual-report.pdf';
}

/** Operator escape hatch: use an exact official PDF URL instead of live discovery. */
function documentFromEnv(): TaheAnnualReportLink | null {
  const url = process.env.TAHE_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'tahe-annual-report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = fiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `TAHE_ANNUAL_REPORT_URL filename "${filename}" has no report year; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: TAHE_SOURCE_URL,
  };
}

async function recordDeferral(
  document: TaheAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: TaheDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: TAHE_ID, document_url: document.url },
    {
      $set: {
        entity: TAHE_ENTITY,
        jurisdiction: TAHE_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the TAHE SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live TAHE connector. */
export function createTaheConnector(options: TaheConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: TAHE_ID,
    name: TAHE_NAME,
    publisher: TAHE_PUBLISHER,
    source_url: TAHE_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: TAHE_LICENSE,
    notes:
      'NSW SOC Phase 9: TAHE (Transport Asset Holding Entity of New South Wales) only. The latest annual report is discovered from the official TAHE publications page now served by Transport Asset Manager (TAM) of NSW (no hard-coded PDF URL; an operator PDF-URL override exists), SHA-256 archived outside the repo, and parsed for the audited Statement of comprehensive income. The printed unit must be explicit $\'000; the statement prints an explicit Total revenue and Total expenses, accepted only when the revenue-line, expense-line and net-result bridges reconcile exactly. Grants and contributions are separately disclosed, so one grant row is emitted with potential_double_count=true. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). SOC rows are never added to government program spending, the PNFC benchmark, or each other. Other SOCs are not implemented.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverTaheAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`TAHE PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: TAHE_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'TAHE annual-report PDF; archived for auditable NSW SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: TaheParseContext = {
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
      const parsed = parseTaheExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'tahe-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'tahe-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a TAHE measure; skipped');
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
