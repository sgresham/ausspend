import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
import type { Connector, FetchStrategy, RawRecord } from '../../types.js';
import {
  pdfFilenameFromUrl,
  resolveSocDocument,
  type SocSourceDocument,
} from './soc-document-fetch.js';
import type { HeadlessPdfFetcher } from './headless.js';

/**
 * NSW SOC Phase 6 — Forestry Corporation of NSW annual-report adapter.
 *
 * This reuses the established NSW SOC layer: one entity adapter, not a second
 * framework. Forestry Corporation of NSW is the fifth NSW SOC entity after
 * Sydney Water, WaterNSW, Hunter Water and Essential Energy.
 *
 * Source gate:
 * - The document is discovered from Forestry Corporation's own annual-report
 *   page (no PDF URL is hard-coded). Its site is behind a Cloudflare HTML
 *   challenge from the ingestion host, so the operator can supply the exact
 *   official PDF URL via FORESTRY_CORPORATION_ANNUAL_REPORT_URL; the default
 *   path is live page discovery.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The statement of profit or loss and other comprehensive income prints an
 *   explicit "$'000" unit and the Basis of Preparation states all values are
 *   rounded to the nearest thousand dollars. A table read as dollars is
 *   rejected, not converted by magnitude. One $'000 unit = 100,000 cents.
 * - Total expenses is an explicit printed subtotal. It is accepted only when
 *   every printed bridge reconciles with zero tolerance: the revenue
 *   components to Total revenue, the four printed expense lines to Total
 *   expenses, Note 5 Other income to its grant/service components, Note 8
 *   Other operating expenses to its components, Note 9 Employee benefits to its
 *   components, Note 10 Finance costs to its components, and the profit-before-
 *   tax and net-result bridges. Any one-thousand-dollar mismatch defers the
 *   whole document.
 */

export const FORESTRY_CORPORATION_ID = 'forestry-corporation';
export const FORESTRY_CORPORATION_NAME = 'Forestry Corporation of NSW — Annual Report';
export const FORESTRY_CORPORATION_PUBLISHER = 'Forestry Corporation of NSW';
export const FORESTRY_CORPORATION_ENTITY = 'Forestry Corporation of NSW';
export const FORESTRY_CORPORATION_JURISDICTION = 'NSW';
export const FORESTRY_CORPORATION_SOURCE_URL =
  'https://www.forestrycorporation.com.au/about/pubs/corporate/annual-report';
export const FORESTRY_CORPORATION_LICENSE =
  '© Forestry Corporation of New South Wales. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const FORESTRY_CORPORATION_UNIT = 'AUD_thousands';
export const FORESTRY_CORPORATION_UNIT_LABEL = "$'000";
export const FORESTRY_CORPORATION_UNIT_TO_CENTS = 100_000;
export const FORESTRY_CORPORATION_CAVEAT =
  'Entity-level SOC statement lines for Forestry Corporation of NSW only. Never add to government program spending, to the PNFC sector benchmark, or to each other: total revenue includes the separately shown government grant lines; total expenses is the printed subtotal and is the exact sum of the four printed expense lines; the net result is a profit. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the URL; parse the page. */
export interface ForestryCorporationAnnualReportLink {
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

const ANNUAL_REPORT_FILENAME =
  /annual[\s_\-–]*report[\s_\-–]*(?:(20\d{2})[\s_\-–]*(\d{2})|FY[\s_\-–]*(\d{2}))/i;
const NON_ANNUAL_REPORT =
  /fraud|gipa|half[\s_\-–]*year|sustainability|pricing|access[\s_\-–]*undertaking|safety|ensms|performance|financial[\s_\-–]*statements|climate|reconciliation/i;

function fiscalYearFromMatch(start: number, end: number): string | null {
  const endFull = end < 100 ? Math.floor(start / 100) * 100 + end : end;
  if (endFull !== start + 1) return null;
  return `${start}-${String(endFull % 100).padStart(2, '0')}`;
}

/**
 * Parse the annual-report PDF links on the official annual-report page. Both
 * the current `annual-report-YYYY-YY.pdf` and the legacy
 * `forestry-corporation[-of-nsw]-annual-report-YYYY-YY.pdf` / `..._FYxx.pdf`
 * paths are accepted; non-annual PDFs are rejected. No URL is hard-coded.
 */
export function parseForestryCorporationAnnualReportPdfLinks(
  html: string,
  pageUrl: string = FORESTRY_CORPORATION_SOURCE_URL,
): ForestryCorporationAnnualReportLink[] {
  const links: ForestryCorporationAnnualReportLink[] = [];
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
    if (!yearMatch) continue;
    let fiscalYear: string | null;
    if (yearMatch[1] && yearMatch[2]) {
      fiscalYear = fiscalYearFromMatch(Number(yearMatch[1]), Number(yearMatch[2]));
    } else if (yearMatch[3]) {
      const end = Number(yearMatch[3]);
      const start = end === 0 ? 99 : end - 1;
      fiscalYear = `${2000 + start}-${String(end).padStart(2, '0')}`;
    } else {
      fiscalYear = null;
    }
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

/** Fetch the official annual-report page and return its latest annual-report PDF. */
export async function discoverForestryCorporationAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = FORESTRY_CORPORATION_SOURCE_URL,
): Promise<ForestryCorporationAnnualReportLink> {
  const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(
      `Forestry Corporation annual-report page HTTP ${response.status} for ${pageUrl}`,
    );
  }
  const html = await response.text();
  const links = parseForestryCorporationAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Forestry Corporation annual-report page contains no annual-report PDF link; refusing to hard-code a URL',
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
  const row = rows.find((entry) => labelOf(entry).toLowerCase() === label.toLowerCase());
  return row ? rowAnchor(row) : null;
}

function columnAnchorByPattern(rows: readonly PageRow[], pattern: RegExp): number | null {
  const row = rows.find((entry) => pattern.test(textOf(entry)));
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
    const text = textOf(row);
    if (!patterns.some((pattern) => pattern.test(text))) continue;
    const value = valueNear(row, anchor);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Find a printed row whose value sits on a continuation line (the net-result
 * label is wrapped in the actual PDF). Scan the label row and the next three
 * rows for a current-year money cell.
 */
function valueForSpanningPattern(
  rows: readonly PageRow[],
  pattern: RegExp,
  anchor: number,
  maxRowsDown = 3,
): number | null {
  const index = rows.findIndex((row) => pattern.test(textOf(row)));
  if (index < 0) return null;
  for (let offset = 0; offset <= maxRowsDown; offset += 1) {
    const row = rows[index + offset];
    if (!row) break;
    const value = valueNear(row, anchor);
    if (value !== null) return value;
  }
  return null;
}

/** Detect the printed unit from the statement header/unit rows. */
export function detectForestryCorporationUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

function unitSamples(rows: readonly PageRow[]): string[] {
  return rows
    .filter((row) => row.cells.some((cell) => cell.includes('$')))
    .map((row) => row.cells.join(' '));
}

/** Convert a printed thousands value to integer thousands (a stable integer basis). */
function thousands(value: number): number {
  return Math.round(value);
}

function thousandsLabel(value: number): string {
  return String(value);
}

export interface ForestryCorporationStatement {
  page_number: number;
  unit: UnitDetection;
  revenue_contracts: number;
  other_income: number;
  investment_revenue: number;
  total_revenue: number;
  other_operating_expenses: number;
  employee_benefits: number;
  depreciation_amortisation: number;
  finance_costs: number;
  total_expenses: number;
  other_gains: number;
  impairment_rou: number;
  impairment_ppe: number;
  revaluation: number;
  receivables_impairment: number;
  easement_impairment: number;
  pbt: number;
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
      text.includes('statement of profit or loss and other comprehensive income') &&
      text.includes('total revenue') &&
      text.includes('total expenses')
    ) {
      return page;
    }
  }
  return null;
}

export function parseForestryCorporationStatement(
  page: PdfPage,
): ForestryCorporationStatement | null {
  const rows = groupPageRows(page.items);
  const titleRow = rows.find((row) =>
    /statement of profit or loss and other comprehensive income/i.test(textOf(row)),
  );
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
  const otherIncome = valueFor(rows, 'Other income', anchor);
  const investmentRevenue = valueFor(rows, 'Investment revenue', anchor);
  const totalRevenue = valueFor(rows, 'Total revenue', anchor);
  const otherOperating = valueFor(rows, 'Other operating expenses', anchor);
  const employee = valueFor(rows, 'Employee benefits expense', anchor);
  const depreciation = valueFor(rows, 'Depreciation and amortisation expense', anchor);
  const finance = valueFor(rows, 'Finance costs', anchor);
  const totalExpenses = valueFor(rows, 'Total expenses', anchor);
  const otherGains = valueFor(rows, 'Other gains/(losses)', anchor);
  const impairmentRou = valueFor(rows, 'Net impairment (loss) of right-of-use asset', anchor);
  const impairmentPpe = valueFor(
    rows,
    'Net impairment (loss) of property, plant and equipment',
    anchor,
  );
  const revaluation = valueFor(
    rows,
    'Fair value Gain/(loss) on revaluation of non-current assets',
    anchor,
  );
  const receivables = valueFor(rows, 'Reversal/Impairment (Loss) on receivables', anchor);
  const easementRow = findRow(rows, 'Impairment (loss) of easement');
  const easement = easementRow ? (valueNear(easementRow, anchor) ?? 0) : null;
  const pbt = valueForPattern(rows, [/^net profit\/\(loss\) before income tax/i], anchor);
  const tax = valueForPattern(rows, [/^income tax benefit\/\(expense\)/i], anchor);
  const netResult = valueForSpanningPattern(
    rows,
    /^net profit\/\(loss\) after income tax benefit\/\(expense\)/i,
    anchor,
  );

  const required: Array<[string, number | null]> = [
    ['Revenue from contracts with customers', revenueContracts],
    ['Other income', otherIncome],
    ['Investment revenue', investmentRevenue],
    ['Total revenue', totalRevenue],
    ['Other operating expenses', otherOperating],
    ['Employee benefits expense', employee],
    ['Depreciation and amortisation expense', depreciation],
    ['Finance costs', finance],
    ['Total expenses', totalExpenses],
    ['Other gains/(losses)', otherGains],
    ['Net impairment (loss) of right-of-use asset', impairmentRou],
    ['Net impairment (loss) of property, plant and equipment', impairmentPpe],
    ['Fair value Gain/(loss) on revaluation of non-current assets', revaluation],
    ['Reversal/Impairment (Loss) on receivables', receivables],
    ['Impairment (loss) of easement', easement],
    ['Net profit/(loss) before income tax', pbt],
    ['Income tax benefit/(expense)', tax],
    ['Net profit/(loss) after income tax', netResult],
  ];
  const missing = required.filter(([, value]) => value === null).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return {
      page_number: page.page_number,
      unit,
      revenue_contracts: 0,
      other_income: 0,
      investment_revenue: 0,
      total_revenue: 0,
      other_operating_expenses: 0,
      employee_benefits: 0,
      depreciation_amortisation: 0,
      finance_costs: 0,
      total_expenses: 0,
      other_gains: 0,
      impairment_rou: 0,
      impairment_ppe: 0,
      revaluation: 0,
      receivables_impairment: 0,
      easement_impairment: 0,
      pbt: 0,
      income_tax: 0,
      net_result: 0,
      checks,
      warnings,
      errors,
    };
  }

  const t = (value: number): number => thousands(value);
  const magnitude = (value: number): number => Math.abs(thousands(value));

  const totalExpenseThousands = magnitude(totalExpenses as number);

  // Zero-tolerance printed bridges, all in integer thousands of dollars.
  const revenueComponentThousands =
    t(revenueContracts as number) + t(otherIncome as number) + t(investmentRevenue as number);
  if (revenueComponentThousands !== t(totalRevenue as number)) {
    errors.push(
      `revenue components mismatch: ${thousandsLabel(t(revenueContracts as number))} + ${thousandsLabel(t(otherIncome as number))} + ${thousandsLabel(t(investmentRevenue as number))} = ${thousandsLabel(revenueComponentThousands)}, printed Total revenue ${thousandsLabel(t(totalRevenue as number))}`,
    );
  } else {
    checks.push(
      `revenue components exact: ${thousandsLabel(t(revenueContracts as number))} + ${thousandsLabel(t(otherIncome as number))} + ${thousandsLabel(t(investmentRevenue as number))} = ${thousandsLabel(revenueComponentThousands)}`,
    );
  }

  const expenseComponentThousands =
    magnitude(otherOperating as number) +
    magnitude(employee as number) +
    magnitude(depreciation as number) +
    magnitude(finance as number);
  if (expenseComponentThousands !== totalExpenseThousands) {
    errors.push(
      `expense components mismatch: ${thousandsLabel(magnitude(otherOperating as number))} + ${thousandsLabel(magnitude(employee as number))} + ${thousandsLabel(magnitude(depreciation as number))} + ${thousandsLabel(magnitude(finance as number))} = ${thousandsLabel(expenseComponentThousands)}, printed Total expenses ${thousandsLabel(totalExpenseThousands)}`,
    );
  } else {
    checks.push(
      `expense components exact: ${thousandsLabel(magnitude(otherOperating as number))} + ${thousandsLabel(magnitude(employee as number))} + ${thousandsLabel(magnitude(depreciation as number))} + ${thousandsLabel(magnitude(finance as number))} = ${thousandsLabel(expenseComponentThousands)} (printed Total expenses)`,
    );
  }

  const pbtThousands =
    t(totalRevenue as number) +
    -totalExpenseThousands +
    t(otherGains as number) +
    t(impairmentRou as number) +
    t(impairmentPpe as number) +
    t(revaluation as number) +
    t(receivables as number) +
    t(easement as number);
  if (pbtThousands !== t(pbt as number)) {
    errors.push(
      `profit-before-tax bridge mismatch: ${thousandsLabel(t(totalRevenue as number))} + (${thousandsLabel(totalExpenseThousands)}) + ${thousandsLabel(t(otherGains as number))} + ${thousandsLabel(t(impairmentRou as number))} + ${thousandsLabel(t(impairmentPpe as number))} + ${thousandsLabel(t(revaluation as number))} + ${thousandsLabel(t(receivables as number))} + ${thousandsLabel(t(easement as number))} = ${thousandsLabel(pbtThousands)}, printed Net profit/(loss) before income tax ${thousandsLabel(t(pbt as number))}`,
    );
  } else {
    checks.push(
      `profit-before-tax bridge exact: ${thousandsLabel(t(totalRevenue as number))} + (${thousandsLabel(totalExpenseThousands)}) + ${thousandsLabel(t(otherGains as number))} + ${thousandsLabel(t(impairmentRou as number))} + ${thousandsLabel(t(impairmentPpe as number))} + ${thousandsLabel(t(revaluation as number))} + ${thousandsLabel(t(receivables as number))} + ${thousandsLabel(t(easement as number))} = ${thousandsLabel(pbtThousands)}`,
    );
  }

  const netThousands = t(pbt as number) + t(tax as number);
  if (netThousands !== t(netResult as number)) {
    errors.push(
      `net-result bridge mismatch: ${thousandsLabel(t(pbt as number))} + ${thousandsLabel(t(tax as number))} = ${thousandsLabel(netThousands)}, printed Net profit/(loss) after income tax ${thousandsLabel(t(netResult as number))}`,
    );
  } else {
    checks.push(
      `net-result bridge exact: ${thousandsLabel(t(pbt as number))} + (${thousandsLabel(t(tax as number))}) = ${thousandsLabel(netThousands)}`,
    );
  }

  return {
    page_number: page.page_number,
    unit,
    revenue_contracts: revenueContracts as number,
    other_income: otherIncome as number,
    investment_revenue: investmentRevenue as number,
    total_revenue: totalRevenue as number,
    other_operating_expenses: otherOperating as number,
    employee_benefits: employee as number,
    depreciation_amortisation: depreciation as number,
    finance_costs: finance as number,
    total_expenses: totalExpenseThousands,
    other_gains: otherGains as number,
    impairment_rou: impairmentRou as number,
    impairment_ppe: impairmentPpe as number,
    revaluation: revaluation as number,
    receivables_impairment: receivables as number,
    easement_impairment: easement as number,
    pbt: pbt as number,
    income_tax: tax as number,
    net_result: netResult as number,
    checks,
    warnings,
    errors,
  };
}

export interface ForestryCorporationOtherIncomeNote {
  page_number: number;
  unit: UnitDetection;
  cso_grants: number | null;
  other_state_grants: number | null;
  section44_reimbursement: number | null;
  other_services_rendered: number | null;
  errors: string[];
}

export interface ForestryCorporationOperatingExpensesNote {
  page_number: number;
  unit: UnitDetection;
  contract_harvest_haulage: number | null;
  external_contractor_costs: number | null;
  other_operating_expenses: number | null;
  materials: number | null;
  occupancy_costs: number | null;
  forest_management_licence_costs: number | null;
  travel_accommodation: number | null;
  communication_computer_costs: number | null;
  insurance_state_taxes: number | null;
  consultants: number | null;
  errors: string[];
}

export interface ForestryCorporationEmployeeBenefitsNote {
  page_number: number;
  unit: UnitDetection;
  salaries_wages_oncosts: number | null;
  defined_contribution_superannuation: number | null;
  defined_benefit_contributions: number | null;
  errors: string[];
}

export interface ForestryCorporationFinanceCostsNote {
  page_number: number;
  unit: UnitDetection;
  amortisation_premium_on_borrowings: number | null;
  government_guarantee_fee: number | null;
  interest_expenses: number | null;
  lease_interest: number | null;
  errors: string[];
}

function readNoteValue(
  rows: readonly PageRow[],
  pattern: RegExp,
  anchor: number,
): { found: boolean; value: number | null } {
  const row = rows.find((entry) => pattern.test(textOf(entry)));
  if (!row) return { found: false, value: null };
  return { found: true, value: valueNear(row, anchor) ?? 0 };
}

export function parseForestryCorporationOtherIncomeNote(
  page: PdfPage,
): ForestryCorporationOtherIncomeNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchorByPattern(rows, /grants revenue\s*-\s*community service obligations/i);
  if (unit.kind !== 'thousands') {
    errors.push(
      `other-income note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`,
    );
  }
  if (anchor === null)
    errors.push('other-income note current-year money column could not be anchored');
  const read = (pattern: RegExp, label: string): number | null => {
    if (anchor === null) return null;
    const result = readNoteValue(rows, pattern, anchor);
    if (!result.found) {
      errors.push(`${label} row could not be located`);
      return null;
    }
    return result.value;
  };
  return {
    page_number: page.page_number,
    unit,
    cso_grants: read(/grants revenue\s*-\s*community service obligations/i, 'CSO grants'),
    other_state_grants: read(
      /grants revenue\s*-\s*other state government grants/i,
      'other state government grants',
    ),
    section44_reimbursement: read(/section 44 reimbursement/i, 'Section 44 reimbursement'),
    other_services_rendered: read(/other services rendered/i, 'other services rendered'),
    errors,
  };
}

export function parseForestryCorporationOperatingExpensesNote(
  page: PdfPage,
): ForestryCorporationOperatingExpensesNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Contract harvest and haulage');
  if (unit.kind !== 'thousands') {
    errors.push(
      `operating-expenses note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`,
    );
  }
  if (anchor === null) {
    errors.push('operating-expenses note current-year money column could not be anchored');
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
  return {
    page_number: page.page_number,
    unit,
    contract_harvest_haulage: read(
      /^Contract harvest and haulage\b/i,
      'contract harvest and haulage',
    ),
    external_contractor_costs: read(/^External contractor costs\b/i, 'external contractor costs'),
    other_operating_expenses: read(/^Other operating expenses\b/i, 'other operating expenses'),
    materials: read(/^Materials\b/i, 'materials'),
    occupancy_costs: read(/^Occupancy costs other than long-term leases\b/i, 'occupancy costs'),
    forest_management_licence_costs: read(
      /^Forest management and licence costs\b/i,
      'forest management and licence costs',
    ),
    travel_accommodation: read(/^Travel and accommodation\b/i, 'travel and accommodation'),
    communication_computer_costs: read(
      /^Communication and computer costs\b/i,
      'communication and computer costs',
    ),
    insurance_state_taxes: read(/^Insurance and state taxes\b/i, 'insurance and state taxes'),
    consultants: read(/^Consultants\b/i, 'consultants'),
    errors,
  };
}

export function parseForestryCorporationEmployeeBenefitsNote(
  page: PdfPage,
): ForestryCorporationEmployeeBenefitsNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Contract harvest and haulage');
  if (unit.kind !== 'thousands') {
    errors.push(
      `employee-benefits note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`,
    );
  }
  if (anchor === null) {
    errors.push('employee-benefits note current-year money column could not be anchored');
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
  return {
    page_number: page.page_number,
    unit,
    salaries_wages_oncosts: read(
      /^Salaries, wages, and on-costs/i,
      'salaries, wages, and on-costs',
    ),
    defined_contribution_superannuation: read(
      /^Defined contribution superannuation expense\b/i,
      'defined contribution superannuation',
    ),
    defined_benefit_contributions: read(
      /^Defined benefit contributions\b/i,
      'defined benefit contributions',
    ),
    errors,
  };
}

export function parseForestryCorporationFinanceCostsNote(
  page: PdfPage,
): ForestryCorporationFinanceCostsNote {
  const rows = groupPageRows(page.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Government guarantee fee');
  if (unit.kind !== 'thousands') {
    errors.push(
      `finance-costs note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`,
    );
  }
  if (anchor === null) {
    errors.push('finance-costs note current-year money column could not be anchored');
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
  return {
    page_number: page.page_number,
    unit,
    amortisation_premium_on_borrowings: read(
      /amortisation\s*-\s*premium on borrowings/i,
      'amortisation — premium on borrowings',
    ),
    government_guarantee_fee: read(/^Government guarantee fee\b/i, 'government guarantee fee'),
    interest_expenses: read(/^Interest expenses\b/i, 'interest expenses'),
    lease_interest: read(/^Lease interest\b/i, 'lease interest'),
    errors,
  };
}

export interface ForestryCorporationParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface ForestryCorporationDeferral {
  reason: string;
  phase: 'discovery' | 'unit' | 'statement' | 'notes' | 'reconciliation';
}

export interface ForestryCorporationParseResult {
  records: SpendingRecord[];
  deferral: ForestryCorporationDeferral | null;
  statement: ForestryCorporationStatement | null;
  other_income_note: ForestryCorporationOtherIncomeNote | null;
  operating_expenses_note: ForestryCorporationOperatingExpensesNote | null;
  employee_benefits_note: ForestryCorporationEmployeeBenefitsNote | null;
  finance_costs_note: ForestryCorporationFinanceCostsNote | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export interface ForestryCorporationLineSpec {
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

export function forestryCorporationNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${FORESTRY_CORPORATION_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousandsOfDollars: number): number {
  const cents = Math.abs(thousandsOfDollars) * FORESTRY_CORPORATION_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousandsOfDollars} thousands exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: ForestryCorporationParseContext,
  spec: ForestryCorporationLineSpec,
  statement: ForestryCorporationStatement,
  otherIncomeNote: ForestryCorporationOtherIncomeNote,
  operatingExpensesNote: ForestryCorporationOperatingExpensesNote,
  employeeBenefitsNote: ForestryCorporationEmployeeBenefitsNote,
  financeCostsNote: ForestryCorporationFinanceCostsNote,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${FORESTRY_CORPORATION_UNIT_LABEL} (${FORESTRY_CORPORATION_UNIT}; x${FORESTRY_CORPORATION_UNIT_TO_CENTS} cents per unit; whole-thousand-dollar printed precision)`,
    `statement_page: ${statement.page_number}`,
    `other_income_note_page: ${otherIncomeNote.page_number}`,
    `operating_expenses_note_page: ${operatingExpensesNote.page_number}`,
    `employee_benefits_note_page: ${employeeBenefitsNote.page_number}`,
    `finance_costs_note_page: ${financeCostsNote.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: ForestryCorporationLineSpec,
  context: ForestryCorporationParseContext,
  statement: ForestryCorporationStatement,
  otherIncomeNote: ForestryCorporationOtherIncomeNote,
  operatingExpensesNote: ForestryCorporationOperatingExpensesNote,
  employeeBenefitsNote: ForestryCorporationEmployeeBenefitsNote,
  financeCostsNote: ForestryCorporationFinanceCostsNote,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: FORESTRY_CORPORATION_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: forestryCorporationNaturalKey(
      FORESTRY_CORPORATION_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${FORESTRY_CORPORATION_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: FORESTRY_CORPORATION_JURISDICTION,
    delivery_entity: FORESTRY_CORPORATION_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Forestry Corporation of NSW Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: FORESTRY_CORPORATION_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: FORESTRY_CORPORATION_UNIT,
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(
      context,
      spec,
      statement,
      otherIncomeNote,
      operatingExpensesNote,
      employeeBenefitsNote,
      financeCostsNote,
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

function findOtherIncomePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (text.includes('other income') && text.includes('community service obligations')) {
      return page;
    }
  }
  return null;
}

function findOperatingExpensesPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('other operating expenses') &&
      text.includes('contract harvest and haulage') &&
      text.includes('employee benefits expense')
    ) {
      return page;
    }
  }
  return null;
}

function findFinanceCostsPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (text.includes('finance costs') && text.includes('government guarantee fee')) {
      return page;
    }
  }
  return null;
}

export function parseForestryCorporationExtraction(
  extraction: PdfExtraction,
  context: ForestryCorporationParseContext,
): ForestryCorporationParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
    return {
      records: [],
      deferral: {
        reason:
          'no parseable statement of profit or loss and other comprehensive income found in the PDF',
        phase: 'statement',
      },
      statement: null,
      other_income_note: null,
      operating_expenses_note: null,
      employee_benefits_note: null,
      finance_costs_note: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const statement = parseForestryCorporationStatement(statementPage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason: 'statement page found but required printed lines could not be parsed',
        phase: 'statement',
      },
      statement: null,
      other_income_note: null,
      operating_expenses_note: null,
      employee_benefits_note: null,
      finance_costs_note: null,
      checks: [],
      warnings,
      pages_used: [statementPage.page_number],
    };
  }
  warnings.push(...statement.warnings);
  if (statement.unit.kind !== 'thousands') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit thousands ($'000): ${statement.unit.reason}`,
        phase: 'unit',
      },
      statement,
      other_income_note: null,
      operating_expenses_note: null,
      employee_benefits_note: null,
      finance_costs_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
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
      other_income_note: null,
      operating_expenses_note: null,
      employee_benefits_note: null,
      finance_costs_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
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
      other_income_note: null,
      operating_expenses_note: null,
      employee_benefits_note: null,
      finance_costs_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }

  const otherIncomePage = findOtherIncomePage(extraction.pages);
  if (!otherIncomePage) {
    return {
      records: [],
      deferral: {
        reason:
          'the Note 5 Other income table needed to verify government grants could not be located',
        phase: 'notes',
      },
      statement,
      other_income_note: null,
      operating_expenses_note: null,
      employee_benefits_note: null,
      finance_costs_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }
  const otherIncomeNote = parseForestryCorporationOtherIncomeNote(otherIncomePage);
  const operatingExpensesPage = findOperatingExpensesPage(extraction.pages);
  if (!operatingExpensesPage) {
    return {
      records: [],
      deferral: {
        reason:
          'the Note 8 Other operating expenses and Note 9 Employee benefits tables could not be located',
        phase: 'notes',
      },
      statement,
      other_income_note: otherIncomeNote,
      operating_expenses_note: null,
      employee_benefits_note: null,
      finance_costs_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number, otherIncomeNote.page_number],
    };
  }
  const operatingExpensesNote =
    parseForestryCorporationOperatingExpensesNote(operatingExpensesPage);
  const employeeBenefitsNote = parseForestryCorporationEmployeeBenefitsNote(operatingExpensesPage);
  const financeCostsPage = findFinanceCostsPage(extraction.pages);
  if (!financeCostsPage) {
    return {
      records: [],
      deferral: {
        reason: 'the Note 10 Finance costs table could not be located',
        phase: 'notes',
      },
      statement,
      other_income_note: otherIncomeNote,
      operating_expenses_note: operatingExpensesNote,
      employee_benefits_note: employeeBenefitsNote,
      finance_costs_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [
        statementPage.page_number,
        otherIncomeNote.page_number,
        operatingExpensesNote.page_number,
      ],
    };
  }
  const financeCostsNote = parseForestryCorporationFinanceCostsNote(financeCostsPage);
  const pagesUsed = [
    statementPage.page_number,
    otherIncomeNote.page_number,
    operatingExpensesNote.page_number,
    financeCostsNote.page_number,
  ];

  for (const [name, note] of [
    ['other-income note', otherIncomeNote],
    ['operating-expenses note', operatingExpensesNote],
    ['employee-benefits note', employeeBenefitsNote],
    ['finance-costs note', financeCostsNote],
  ] as const) {
    if (note.unit.kind !== 'thousands') {
      return {
        records: [],
        deferral: {
          reason: `${name} on page ${note.page_number} is not explicit thousands: ${note.unit.reason}`,
          phase: 'unit',
        },
        statement,
        other_income_note: otherIncomeNote,
        operating_expenses_note: operatingExpensesNote,
        employee_benefits_note: employeeBenefitsNote,
        finance_costs_note: financeCostsNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      };
    }
    if (note.errors.length > 0) {
      return {
        records: [],
        deferral: {
          reason: `${name} parse failed: ${note.errors.join('; ')}`,
          phase: 'notes',
        },
        statement,
        other_income_note: otherIncomeNote,
        operating_expenses_note: operatingExpensesNote,
        employee_benefits_note: employeeBenefitsNote,
        finance_costs_note: financeCostsNote,
        checks: statement.checks,
        warnings,
        pages_used: pagesUsed,
      };
    }
  }

  const t = (value: number): number => thousands(value);
  const magnitude = (value: number): number => Math.abs(thousands(value));

  // Exact Note 5 check: grants + Section 44 + other services = statement Other income.
  const otherIncomeComponents =
    t(otherIncomeNote.cso_grants ?? 0) +
    t(otherIncomeNote.other_state_grants ?? 0) +
    t(otherIncomeNote.section44_reimbursement ?? 0) +
    t(otherIncomeNote.other_services_rendered ?? 0);
  if (otherIncomeComponents !== t(statement.other_income)) {
    return {
      records: [],
      deferral: {
        reason: `Note 5 Other income mismatch: CSO grants ${otherIncomeNote.cso_grants ?? 'missing'} + other state government grants ${otherIncomeNote.other_state_grants ?? 'missing'} + Section 44 ${otherIncomeNote.section44_reimbursement ?? 'missing'} + other services ${otherIncomeNote.other_services_rendered ?? 'missing'} = ${otherIncomeComponents}, statement Other income ${statement.other_income}`,
        phase: 'reconciliation',
      },
      statement,
      other_income_note: otherIncomeNote,
      operating_expenses_note: operatingExpensesNote,
      employee_benefits_note: employeeBenefitsNote,
      finance_costs_note: financeCostsNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  // Exact Note 8 check.
  const operatingComponents =
    t(operatingExpensesNote.contract_harvest_haulage ?? 0) +
    t(operatingExpensesNote.external_contractor_costs ?? 0) +
    t(operatingExpensesNote.other_operating_expenses ?? 0) +
    t(operatingExpensesNote.materials ?? 0) +
    t(operatingExpensesNote.occupancy_costs ?? 0) +
    t(operatingExpensesNote.forest_management_licence_costs ?? 0) +
    t(operatingExpensesNote.travel_accommodation ?? 0) +
    t(operatingExpensesNote.communication_computer_costs ?? 0) +
    t(operatingExpensesNote.insurance_state_taxes ?? 0) +
    t(operatingExpensesNote.consultants ?? 0);
  if (operatingComponents !== magnitude(statement.other_operating_expenses)) {
    return {
      records: [],
      deferral: {
        reason: `Note 8 Other operating expenses mismatch: components sum to ${operatingComponents}, statement line ${magnitude(statement.other_operating_expenses)}`,
        phase: 'reconciliation',
      },
      statement,
      other_income_note: otherIncomeNote,
      operating_expenses_note: operatingExpensesNote,
      employee_benefits_note: employeeBenefitsNote,
      finance_costs_note: financeCostsNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  // Exact Note 9 check.
  const employeeComponents =
    t(employeeBenefitsNote.salaries_wages_oncosts ?? 0) +
    t(employeeBenefitsNote.defined_contribution_superannuation ?? 0) +
    t(employeeBenefitsNote.defined_benefit_contributions ?? 0);
  if (employeeComponents !== magnitude(statement.employee_benefits)) {
    return {
      records: [],
      deferral: {
        reason: `Note 9 Employee benefits mismatch: components sum to ${employeeComponents}, statement line ${magnitude(statement.employee_benefits)}`,
        phase: 'reconciliation',
      },
      statement,
      other_income_note: otherIncomeNote,
      operating_expenses_note: operatingExpensesNote,
      employee_benefits_note: employeeBenefitsNote,
      finance_costs_note: financeCostsNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  // Exact Note 10 check.
  const financeComponents =
    t(financeCostsNote.amortisation_premium_on_borrowings ?? 0) +
    t(financeCostsNote.government_guarantee_fee ?? 0) +
    t(financeCostsNote.interest_expenses ?? 0) +
    t(financeCostsNote.lease_interest ?? 0);
  if (financeComponents !== magnitude(statement.finance_costs)) {
    return {
      records: [],
      deferral: {
        reason: `Note 10 Finance costs mismatch: components sum to ${financeComponents}, statement line ${magnitude(statement.finance_costs)}`,
        phase: 'reconciliation',
      },
      statement,
      other_income_note: otherIncomeNote,
      operating_expenses_note: operatingExpensesNote,
      employee_benefits_note: employeeBenefitsNote,
      finance_costs_note: financeCostsNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  const checks = [
    ...statement.checks,
    `Note 5 Other income exact: ${t(otherIncomeNote.cso_grants ?? 0)} + ${t(otherIncomeNote.other_state_grants ?? 0)} + ${t(otherIncomeNote.section44_reimbursement ?? 0)} + ${t(otherIncomeNote.other_services_rendered ?? 0)} = ${otherIncomeComponents}`,
    `Note 8 Other operating expenses exact: ${operatingComponents}`,
    `Note 9 Employee benefits exact: ${t(employeeBenefitsNote.salaries_wages_oncosts ?? 0)} + ${t(employeeBenefitsNote.defined_contribution_superannuation ?? 0)} + ${t(employeeBenefitsNote.defined_benefit_contributions ?? 0)} = ${employeeComponents}`,
    `Note 10 Finance costs exact: ${t(financeCostsNote.amortisation_premium_on_borrowings ?? 0)} + ${t(financeCostsNote.government_guarantee_fee ?? 0)} + ${t(financeCostsNote.interest_expenses ?? 0)} + ${t(financeCostsNote.lease_interest ?? 0)} = ${financeComponents}`,
  ];

  const lineSpecs: ForestryCorporationLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: t(statement.total_revenue),
      funding_source: FORESTRY_CORPORATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total revenue. Includes the separately shown government grant lines, which are never added again.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: magnitude(statement.total_expenses),
      funding_source: FORESTRY_CORPORATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Total expenses subtotal. Accepted only because the four printed expense lines (other operating expenses + employee benefits + depreciation and amortisation + finance costs) sum to it exactly and the profit-before-tax bridge reconciles with zero tolerance. A component of nothing; never add expense components again.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expense',
      amount_thousands: magnitude(statement.employee_benefits),
      funding_source: FORESTRY_CORPORATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Employee benefits expense. The printed Note 9 components (salaries/wages/on-costs + defined contribution superannuation + defined benefit contributions) sum to it exactly. A component of Total expenses; never add to Total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation expense',
      amount_thousands: magnitude(statement.depreciation_amortisation),
      funding_source: FORESTRY_CORPORATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement line Depreciation and amortisation expense. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'government_grants_community_service_obligations',
      label: 'Grants revenue — community service obligations',
      amount_thousands: t(otherIncomeNote.cso_grants ?? 0),
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'revenue',
      detail:
        'Separately disclosed in Note 5 Other income and already included in Total revenue. May overlap NSW government program spending; never add it to the total. The related CSO costs are included in Note 8 operating expenditure.',
    },
    {
      line_item: 'government_grants_other_state_government',
      label: 'Grants revenue — other state government grants',
      amount_thousands: t(otherIncomeNote.other_state_grants ?? 0),
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'revenue',
      detail:
        'Separately disclosed in Note 5 Other income and already included in Total revenue. May overlap NSW government program spending; never add it to the total.',
    },
    {
      line_item: 'net_result',
      label: 'Net profit after income tax',
      amount_thousands: t(statement.net_result),
      funding_source: FORESTRY_CORPORATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
      detail:
        'Printed Net profit/(loss) after income tax benefit/(expense) for the year. A result line, not an expense component; never add to revenue or expenses.',
    },
  ];

  const records = lineSpecs.map((spec) =>
    mapLine(
      spec,
      context,
      statement,
      otherIncomeNote,
      operatingExpensesNote,
      employeeBenefitsNote,
      financeCostsNote,
    ),
  );
  warnings.push(
    'SOC entity rows are provisional and unverified; Total expenses is an explicit printed subtotal and the printed expense components, notes and profit bridges reconcile exactly.',
  );
  return {
    records,
    deferral: null,
    statement,
    other_income_note: otherIncomeNote,
    operating_expenses_note: operatingExpensesNote,
    employee_benefits_note: employeeBenefitsNote,
    finance_costs_note: financeCostsNote,
    checks,
    warnings,
    pages_used: pagesUsed,
  };
}

export interface ForestryCorporationConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: ForestryCorporationAnnualReportLink;
  /** Test-only injection point for the last-resort headless browser fetch. */
  headlessFetch?: HeadlessPdfFetcher;
}

/**
 * Operator escape hatch: when FORESTRY_CORPORATION_ANNUAL_REPORT_URL is set, it
 * is used as the exact official PDF URL. The default path is live discovery
 * from the official annual-report page (which is behind a Cloudflare HTML
 * challenge on the ingestion host).
 */
function documentFromEnv(): ForestryCorporationAnnualReportLink | null {
  const url = process.env.FORESTRY_CORPORATION_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'forestry-corporation-annual-report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const yearMatch = ANNUAL_REPORT_FILENAME.exec(filename);
  let fiscalYear: string | null = null;
  if (yearMatch?.[1] && yearMatch[2]) {
    fiscalYear = fiscalYearFromMatch(Number(yearMatch[1]), Number(yearMatch[2]));
  } else if (yearMatch?.[3]) {
    const end = Number(yearMatch[3]);
    const start = end === 0 ? 99 : end - 1;
    fiscalYear = `${2000 + start}-${String(end).padStart(2, '0')}`;
  }
  if (!fiscalYear) {
    throw new Error(
      `FORESTRY_CORPORATION_ANNUAL_REPORT_URL filename "${filename}" has no report year; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: FORESTRY_CORPORATION_SOURCE_URL,
  };
}

async function recordDeferral(
  document: Pick<ForestryCorporationAnnualReportLink, 'url' | 'fiscal_year' | 'title'>,
  archive: ArchivedSourceRecord | null,
  deferral: ForestryCorporationDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: FORESTRY_CORPORATION_ID, document_url: document.url },
    {
      $set: {
        entity: FORESTRY_CORPORATION_ENTITY,
        jurisdiction: FORESTRY_CORPORATION_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Forestry Corporation SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Forestry Corporation connector. */
export function createForestryCorporationConnector(
  options: ForestryCorporationConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: null as FetchStrategy | null,
  };

  const connector: Connector = {
    id: FORESTRY_CORPORATION_ID,
    name: FORESTRY_CORPORATION_NAME,
    publisher: FORESTRY_CORPORATION_PUBLISHER,
    source_url: FORESTRY_CORPORATION_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: FORESTRY_CORPORATION_LICENSE,
    notes:
      'NSW SOC Phase 6: Forestry Corporation of NSW only. The latest annual report is discovered from the official annual-report page (no hard-coded PDF URL; an operator PDF-URL override exists for the Cloudflare-blocked HTML page), SHA-256 archived outside the repo, and parsed for the statement of profit or loss and other comprehensive income. The printed unit must be explicit $\'000; Total expenses is the explicit printed subtotal and is accepted only when the revenue, expense-component, Note 5/8/9/10 subtotal and profit-before-tax/net-result bridges reconcile exactly. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). SOC rows are never added to government program spending, the PNFC benchmark, or each other. Other SOCs are not implemented.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      metadata.fetchStrategy = null;
      const override = options.document ?? documentFromEnv() ?? undefined;
      // The official host blocks this ingestion host at the CDN for both the
      // HTML page and the PDF. An operator may supply an exact-byte mirror
      // (e.g. a Parliament/archive copy); the row's source_url stays the
      // official PDF URL and the mirror is recorded as retrieved_from.
      const mirrorUrl = process.env.FORESTRY_CORPORATION_ANNUAL_REPORT_MIRROR_URL;
      const localFile = process.env.FORESTRY_CORPORATION_ANNUAL_REPORT_FILE;
      const directDocument = override
        ? mirrorUrl
          ? { ...override, download_url: mirrorUrl }
          : override
        : undefined;
      let bytes: Buffer;
      let document: SocSourceDocument;
      let strategy: FetchStrategy = 'direct';
      let retrievedFrom: string;
      let archivedFrom: 'direct' | 'other' = 'direct';
      let filename: string;
      let archiveNote: string;
      if (localFile) {
        if (!override) {
          throw new Error(
            'FORESTRY_CORPORATION_ANNUAL_REPORT_FILE requires FORESTRY_CORPORATION_ANNUAL_REPORT_URL to name the official document',
          );
        }
        // Operator-supplied exact-byte copy of the official PDF (for example
        // the SHA-256-verified archive). The row's source_url stays official.
        document = override;
        bytes = await readFile(localFile);
        retrievedFrom = `file://${localFile}`;
        archivedFrom = 'other';
        filename = pdfFilenameFromUrl(
          `file://${localFile}`,
          'forestry-corporation-annual-report.pdf',
        );
        archiveNote =
          'Forestry Corporation of NSW annual-report PDF supplied as an operator-verified local exact-byte copy; archived for auditable extraction.';
      } else {
        const resolved = await resolveSocDocument({
          source_id: FORESTRY_CORPORATION_ID,
          source_label: 'Forestry Corporation of NSW',
          fetchImpl,
          discoverDirect: async () =>
            directDocument ?? (await discoverForestryCorporationAnnualReport(fetchImpl)),
          directDocument,
          discoveryPageUrl: FORESTRY_CORPORATION_SOURCE_URL,
          headlessFetch: options.headlessFetch,
        });
        bytes = resolved.bytes;
        document = resolved.document;
        strategy = resolved.strategy;
        retrievedFrom = resolved.retrieved_from;
        archivedFrom = resolved.archived_from;
        filename = resolved.filename;
        archiveNote = resolved.note;
      }
      metadata.fetchStrategy = strategy;
      const archived = await archiveSourceDocument({
        source_id: FORESTRY_CORPORATION_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: retrievedFrom,
        archived_from: archivedFrom,
        filename,
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes: archiveNote,
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: ForestryCorporationParseContext = {
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
      const parsed = parseForestryCorporationExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'forestry-corporation-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'forestry-corporation-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Forestry Corporation measure; skipped');
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
