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
 * NSW SOC Phase 10 — Sydney Trains adapter.
 *
 * This reuses the established NSW SOC layer: one entity adapter, not a second
 * framework. Sydney Trains is the ninth NSW SOC entity after Sydney Water,
 * WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW,
 * Landcom, Port Authority of NSW and TAHE.
 *
 * Source gate:
 * - The document is discovered from the official Transport for NSW
 *   "Sydney Trains annual reports" publications page. No PDF URL is hard-coded.
 *   The exact PDF bytes are SHA-256 archived outside the repo.
 * - Sydney Trains publishes its annual report in two volumes. The audited
 *   financial statements (and therefore the Statement of comprehensive income)
 *   are in Volume 2, so discovery selects the financial-statements volume of
 *   the latest report year. Older reports with a single PDF are used directly.
 * - The audited Statement of comprehensive income prints an explicit "$'000"
 *   unit. A table read as dollars or millions is rejected, not converted by
 *   magnitude. One $'000 unit = 100,000 cents.
 * - The statement prints an explicit Total revenue and Total expenses excluding
 *   losses subtotal. Both printed totals are accepted only when every printed
 *   bridge reconciles with zero tolerance: the four revenue lines sum to Total
 *   revenue, the six expense lines sum to Total expenses excluding losses, the
 *   printed deficit before grants equals Total revenue less Total expenses, the
 *   printed (deficit)/surplus from operations adds Grants and contributions,
 *   and the net result adds Gains/(losses) on disposal, Other gains/(losses) and
 *   Impairment reversals/(losses). A one-thousand-dollar mismatch defers the
 *   whole document.
 * - Sydney Trains separately discloses Grants and contributions in the
 *   statement and Note 2(c), so that line is emitted as a separate grant row
 *   with potential_double_count=true. It is presented below Total revenue and
 *   is never added to the total.
 * - The published Volume 2 PDF carries a "Draft for year end June 2025" footer
 *   on every page even though it also contains the signed Chief Executive
 *   statement (3 October 2025) and the signed independent auditor's report
 *   (7 October 2025) and was first published in November 2025. That footer is a
 *   document-control artefact; it is recorded as a provenance warning on every
 *   row and flagged for human spot-check rather than silently ignored.
 */

export const SYDNEY_TRAINS_ID = 'sydney-trains';
export const SYDNEY_TRAINS_NAME = 'Sydney Trains — Annual Report';
export const SYDNEY_TRAINS_PUBLISHER = 'Sydney Trains (Transport for NSW)';
export const SYDNEY_TRAINS_ENTITY = 'Sydney Trains';
export const SYDNEY_TRAINS_LEGAL_NAME = 'Sydney Trains';
export const SYDNEY_TRAINS_JURISDICTION = 'NSW';
export const SYDNEY_TRAINS_SOURCE_URL =
  'https://www.transport.nsw.gov.au/news-and-events/reports-and-publications/sydney-trains-annual-reports';
export const SYDNEY_TRAINS_LICENSE =
  '© Transport for NSW. Published Sydney Trains annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const SYDNEY_TRAINS_UNIT = 'AUD_thousands';
export const SYDNEY_TRAINS_UNIT_LABEL = "$'000";
export const SYDNEY_TRAINS_UNIT_TO_CENTS = 100_000;
export const SYDNEY_TRAINS_CAVEAT =
  "Entity-level SOC statement lines for Sydney Trains only. Never add to government program spending, to the PNFC sector benchmark, or to each other: Total revenue (1,759,052 thousand) excludes the separately presented Grants and contributions line (3,500,212 thousand); Total expenses excluding losses (5,376,430 thousand) excludes the below-the-line Gains/(losses) on disposal, Other gains/(losses) and Impairment reversals/(losses) that are included in the printed net-result bridge; the net result is a deficit of 128,277 thousand. The published Volume 2 PDF carries a 'Draft for year end June 2025' footer alongside the signed Chief Executive statement and signed independent auditor's report, so the rows are provisional and unverified and are flagged for human spot-check.";

/** A discovered annual-report PDF. Never hard-code the URL; parse the page. */
export interface SydneyTrainsAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
  /** 1 = narrative volume, 2 = audited financial statements, null = single-PDF report. */
  volume: 1 | 2 | null;
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

const NON_ANNUAL_REPORT =
  /statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|soe[\s_\-–]*annual[\s_\-–]*statement|agency[\s_\-–]*information|pricing|modern[\s_\-–]*slavery|corporate[\s_\-–]*plan|supplier[\s_\-–]*code|fraud|gipa|half[\s_\-–]*year|sustainability|access[\s_\-–]*undertaking|safety|ensms|performance|budget|climate|reconciliation|bushfire|electricity[\s_\-–]*network/i;

/** Map a report year (year ended 30 June) to the API fiscal year "2024-25". */
export function sydneyTrainsFiscalYearFromReportYear(reportYear: number): string {
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
  // Short range such as "2024–25", "2024-25" or "2018-19". The source page uses
  // both the hyphen and the en dash.
  const shortRange = /(\d{4})\s*[-–]\s*(\d{2})(?!\d)/.exec(filename);
  if (shortRange?.[1] && shortRange[2]) {
    const start = Number(shortRange[1]);
    const expectedEnd = String((start + 1) % 100).padStart(2, '0');
    if (shortRange[2] !== expectedEnd) return null;
    return `${start}-${expectedEnd}`;
  }
  return null;
}

/**
 * Identify which published volume a filename refers to. Sydney Trains splits
 * its annual report into Volume 1 (narrative) and Volume 2 (audited financial
 * statements). Older reports use "V2", "vol-2" or "Volume-2-Audited-Financial-
 * Statements"; some report years publish a single PDF.
 */
export function sydneyTrainsVolumeFromFilename(filename: string): 1 | 2 | null {
  if (
    /volume[\s._-]*(?:2|two)\b|vol[\s._-]*2\b|(?:^|[^a-z0-9])v2(?:[^a-z0-9]|$)|audited[\s._-]*financial|financial[\s._-]*statements/i.test(
      filename,
    )
  ) {
    return 2;
  }
  if (/volume[\s._-]*(?:1|one)\b|vol[\s._-]*1\b|(?:^|[^a-z0-9])v1(?:[^a-z0-9]|$)/i.test(filename)) {
    return 1;
  }
  return null;
}

/**
 * Parse the annual-report PDF links on the official publications page. The
 * current page serves FY2024–25 Volume 1/Volume 2 down to FY2013-14; the
 * corporate plan, bushfire-preparedness, electricity-network safety and other
 * non-annual documents are rejected. No URL is hard-coded.
 */
export function parseSydneyTrainsAnnualReportPdfLinks(
  html: string,
  pageUrl: string = SYDNEY_TRAINS_SOURCE_URL,
): SydneyTrainsAnnualReportLink[] {
  const links: SydneyTrainsAnnualReportLink[] = [];
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
    const looksAnnual = /annual[\s_\-–]*report|(?:^|[_\-\s])ar[\s_-]?\d{2}/i.test(filename);
    if (!looksAnnual) continue;
    const fiscalYear = fiscalYearFromFilename(filename);
    if (!fiscalYear) continue;
    const key = `${url.origin}${url.pathname}${url.search}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [start, end] = fiscalYear.split('-');
    const volume = sydneyTrainsVolumeFromFilename(filename);
    const volumeLabel = volume === 2 ? ' — audited financial statements' : '';
    links.push({
      url: key,
      filename,
      fiscal_year: fiscalYear,
      title: `Annual Report ${start}–${end}${volumeLabel}`,
      discovery_page: pageUrl,
      volume,
    });
  }
  return links.sort(
    (a, b) => b.fiscal_year.localeCompare(a.fiscal_year) || (b.volume ?? 0) - (a.volume ?? 0),
  );
}

/**
 * Pick the financial-statements volume of the latest annual report, because the
 * income statement is only in Volume 2. Falls back to a single-PDF report when
 * no Volume 2 is published for that year.
 */
export function selectSydneyTrainsAnnualReport(
  links: readonly SydneyTrainsAnnualReportLink[],
): SydneyTrainsAnnualReportLink | null {
  const first = links[0];
  if (!first) return null;
  const latestFy = first.fiscal_year;
  const sameYear = links.filter((link) => link.fiscal_year === latestFy);
  return (
    sameYear.find((link) => link.volume === 2) ??
    sameYear.find((link) => link.volume === null) ??
    sameYear[0] ??
    null
  );
}

/** Fetch the official publications page and return its latest annual report. */
export async function discoverSydneyTrainsAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = SYDNEY_TRAINS_SOURCE_URL,
): Promise<SydneyTrainsAnnualReportLink> {
  const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(`Sydney Trains annual-reports page HTTP ${response.status} for ${pageUrl}`);
  }
  const html = await response.text();
  const links = parseSydneyTrainsAnnualReportPdfLinks(html, pageUrl);
  const latest = selectSydneyTrainsAnnualReport(links);
  if (!latest) {
    throw new Error(
      'Sydney Trains annual-reports page contains no annual-report PDF link; refusing to hard-code a URL',
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
export function detectSydneyTrainsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

function thousands(value: number): number {
  return Math.round(value);
}

function thousandsLabel(value: number): string {
  return String(value);
}

export interface SydneyTrainsStatement {
  page_number: number;
  unit: UnitDetection;
  sale_of_goods_and_services: number;
  investment_revenue: number;
  major_rail_project_revenue: number;
  other_income: number;
  total_revenue: number;
  employee_expenses: number;
  personnel_services: number;
  other_operating_expenses: number;
  major_rail_project_expenses: number;
  depreciation_amortisation: number;
  finance_costs: number;
  total_expenses: number;
  deficit_before_grants: number;
  grants_and_contributions: number;
  operations_result: number;
  gains_losses_on_disposal: number;
  other_gains_losses: number;
  impairment_reversals_losses: number;
  net_result: number;
  draft_footer: boolean;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('statement of comprehensive income') &&
      text.includes('sale of goods and services from contracts with customers') &&
      text.includes('total revenue') &&
      text.includes('total expenses excluding losses') &&
      text.includes('grants and contributions') &&
      text.includes('net result') &&
      text.includes('the accompanying notes form part of these financial statements')
    ) {
      return page;
    }
  }
  return null;
}

export function parseSydneyTrainsStatement(page: PdfPage): SydneyTrainsStatement | null {
  const rows = groupPageRows(page.items);
  const titleRow = rows.find((row) => /statement of comprehensive income/i.test(textOf(row)));
  if (!titleRow) return null;

  const unit = detectMoneyUnit(unitSamples(rows));
  const draftFooter = /draft for year end/i.test(page.text);

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

  const sale = valueFor(rows, 'Sale of goods and services from contracts with customers', anchor);
  const investment = valueFor(rows, 'Investment revenue', anchor);
  const majorRailRevenue = valueFor(rows, 'Major rail project revenue', anchor);
  const otherIncome = valueFor(rows, 'Other income', anchor);
  const totalRevenue = valueFor(rows, 'Total revenue', anchor);
  const employee = valueFor(rows, 'Employee-related expenses', anchor);
  const personnel = valueFor(rows, 'Personnel services', anchor);
  const otherOperating = valueFor(rows, 'Other operating expenses', anchor);
  const majorRailExpenses = valueFor(rows, 'Major rail project expenses', anchor);
  const depreciation = valueFor(rows, 'Depreciation and amortisation', anchor);
  const finance = valueFor(rows, 'Finance costs', anchor);
  const totalExpenses = valueFor(rows, 'Total expenses excluding losses', anchor);
  const deficitBeforeGrants = valueFor(
    rows,
    'Deficit from operations before grants and other contributions',
    anchor,
  );
  const grants = valueFor(rows, 'Grants and contributions', anchor);
  const operationsResult = valueFor(rows, '(Deficit)/surplus from operations', anchor);
  const gainsDisposal = valueFor(rows, 'Gains/(losses) on disposal', anchor);
  const otherGains = valueFor(rows, 'Other gains/(losses)', anchor);
  const impairment = valueFor(rows, 'Impairment reversals/(losses) on financial assets', anchor);
  const netResult = valueFor(rows, 'Net result', anchor);

  const required: Array<[string, number | null]> = [
    ['Sale of goods and services from contracts with customers', sale],
    ['Investment revenue', investment],
    ['Major rail project revenue', majorRailRevenue],
    ['Other income', otherIncome],
    ['Total revenue', totalRevenue],
    ['Employee-related expenses', employee],
    ['Personnel services', personnel],
    ['Other operating expenses', otherOperating],
    ['Major rail project expenses', majorRailExpenses],
    ['Depreciation and amortisation', depreciation],
    ['Finance costs', finance],
    ['Total expenses excluding losses', totalExpenses],
    ['Deficit from operations before grants and other contributions', deficitBeforeGrants],
    ['Grants and contributions', grants],
    ['(Deficit)/surplus from operations', operationsResult],
    ['Gains/(losses) on disposal', gainsDisposal],
    ['Other gains/(losses)', otherGains],
    ['Impairment reversals/(losses) on financial assets', impairment],
    ['Net result', netResult],
  ];
  const missing = required.filter(([, value]) => value === null).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return {
      page_number: page.page_number,
      unit,
      sale_of_goods_and_services: 0,
      investment_revenue: 0,
      major_rail_project_revenue: 0,
      other_income: 0,
      total_revenue: 0,
      employee_expenses: 0,
      personnel_services: 0,
      other_operating_expenses: 0,
      major_rail_project_expenses: 0,
      depreciation_amortisation: 0,
      finance_costs: 0,
      total_expenses: 0,
      deficit_before_grants: 0,
      grants_and_contributions: 0,
      operations_result: 0,
      gains_losses_on_disposal: 0,
      other_gains_losses: 0,
      impairment_reversals_losses: 0,
      net_result: 0,
      draft_footer: draftFooter,
      checks,
      warnings,
      errors,
    };
  }

  const t = (value: number): number => thousands(value);

  const saleValue = t(sale as number);
  const investmentValue = t(investment as number);
  const majorRailRevenueValue = t(majorRailRevenue as number);
  const otherIncomeValue = t(otherIncome as number);
  const totalRevenueValue = t(totalRevenue as number);
  const employeeValue = t(employee as number);
  const personnelValue = t(personnel as number);
  const otherOperatingValue = t(otherOperating as number);
  const majorRailExpensesValue = t(majorRailExpenses as number);
  const depreciationValue = t(depreciation as number);
  const financeValue = t(finance as number);
  const totalExpensesValue = t(totalExpenses as number);
  const deficitBeforeGrantsValue = t(deficitBeforeGrants as number);
  const grantsValue = t(grants as number);
  const operationsResultValue = t(operationsResult as number);
  const gainsDisposalValue = t(gainsDisposal as number);
  const otherGainsValue = t(otherGains as number);
  const impairmentValue = t(impairment as number);
  const netResultValue = t(netResult as number);

  const revenueComponents = saleValue + investmentValue + majorRailRevenueValue + otherIncomeValue;
  if (revenueComponents !== totalRevenueValue) {
    errors.push(
      `total-revenue bridge mismatch: ${thousandsLabel(saleValue)} + ${thousandsLabel(investmentValue)} + ${thousandsLabel(majorRailRevenueValue)} + ${thousandsLabel(otherIncomeValue)} = ${thousandsLabel(revenueComponents)}, printed Total revenue ${thousandsLabel(totalRevenueValue)}`,
    );
  } else {
    checks.push(
      `total-revenue bridge exact: ${thousandsLabel(saleValue)} + ${thousandsLabel(investmentValue)} + ${thousandsLabel(majorRailRevenueValue)} + ${thousandsLabel(otherIncomeValue)} = ${thousandsLabel(totalRevenueValue)}`,
    );
  }

  const expenseComponents =
    employeeValue +
    personnelValue +
    otherOperatingValue +
    majorRailExpensesValue +
    depreciationValue +
    financeValue;
  if (expenseComponents !== totalExpensesValue) {
    errors.push(
      `total-expenses bridge mismatch: ${thousandsLabel(employeeValue)} + ${thousandsLabel(personnelValue)} + ${thousandsLabel(otherOperatingValue)} + ${thousandsLabel(majorRailExpensesValue)} + ${thousandsLabel(depreciationValue)} + ${thousandsLabel(financeValue)} = ${thousandsLabel(expenseComponents)}, printed Total expenses excluding losses ${thousandsLabel(totalExpensesValue)}`,
    );
  } else {
    checks.push(
      `total-expenses bridge exact: ${thousandsLabel(employeeValue)} + ${thousandsLabel(personnelValue)} + ${thousandsLabel(otherOperatingValue)} + ${thousandsLabel(majorRailExpensesValue)} + ${thousandsLabel(depreciationValue)} + ${thousandsLabel(financeValue)} = ${thousandsLabel(totalExpensesValue)}`,
    );
  }

  const derivedDeficit = totalRevenueValue - totalExpensesValue;
  if (derivedDeficit !== deficitBeforeGrantsValue) {
    errors.push(
      `deficit-before-grants bridge mismatch: ${thousandsLabel(totalRevenueValue)} - ${thousandsLabel(totalExpensesValue)} = ${thousandsLabel(derivedDeficit)}, printed deficit before grants ${thousandsLabel(deficitBeforeGrantsValue)}`,
    );
  } else {
    checks.push(
      `deficit-before-grants bridge exact: ${thousandsLabel(totalRevenueValue)} - ${thousandsLabel(totalExpensesValue)} = ${thousandsLabel(derivedDeficit)}`,
    );
  }

  const derivedOperations = deficitBeforeGrantsValue + grantsValue;
  if (derivedOperations !== operationsResultValue) {
    errors.push(
      `operations-result bridge mismatch: ${thousandsLabel(deficitBeforeGrantsValue)} + ${thousandsLabel(grantsValue)} = ${thousandsLabel(derivedOperations)}, printed operations result ${thousandsLabel(operationsResultValue)}`,
    );
  } else {
    checks.push(
      `operations-result bridge exact: ${thousandsLabel(deficitBeforeGrantsValue)} + ${thousandsLabel(grantsValue)} = ${thousandsLabel(derivedOperations)}`,
    );
  }

  const derivedNetResult =
    operationsResultValue + gainsDisposalValue + otherGainsValue + impairmentValue;
  if (derivedNetResult !== netResultValue) {
    errors.push(
      `net-result bridge mismatch: ${thousandsLabel(operationsResultValue)} + ${thousandsLabel(gainsDisposalValue)} + ${thousandsLabel(otherGainsValue)} + ${thousandsLabel(impairmentValue)} = ${thousandsLabel(derivedNetResult)}, printed Net result ${thousandsLabel(netResultValue)}`,
    );
  } else {
    checks.push(
      `net-result bridge exact: ${thousandsLabel(operationsResultValue)} + ${thousandsLabel(gainsDisposalValue)} + ${thousandsLabel(otherGainsValue)} + ${thousandsLabel(impairmentValue)} = ${thousandsLabel(netResultValue)}`,
    );
  }

  if (draftFooter) {
    warnings.push(
      'the published PDF carries a "Draft for year end June 2025" footer on every page; it also contains the signed Chief Executive statement (3 October 2025) and the signed independent auditor\'s report (7 October 2025), and was first published in November 2025 — recorded as a provenance caveat and flagged for human spot-check',
    );
  }

  return {
    page_number: page.page_number,
    unit,
    sale_of_goods_and_services: saleValue,
    investment_revenue: investmentValue,
    major_rail_project_revenue: majorRailRevenueValue,
    other_income: otherIncomeValue,
    total_revenue: totalRevenueValue,
    employee_expenses: employeeValue,
    personnel_services: personnelValue,
    other_operating_expenses: otherOperatingValue,
    major_rail_project_expenses: majorRailExpensesValue,
    depreciation_amortisation: depreciationValue,
    finance_costs: financeValue,
    total_expenses: totalExpensesValue,
    deficit_before_grants: deficitBeforeGrantsValue,
    grants_and_contributions: grantsValue,
    operations_result: operationsResultValue,
    gains_losses_on_disposal: gainsDisposalValue,
    other_gains_losses: otherGainsValue,
    impairment_reversals_losses: impairmentValue,
    net_result: netResultValue,
    draft_footer: draftFooter,
    checks,
    warnings,
    errors,
  };
}

export interface SydneyTrainsParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface SydneyTrainsDeferral {
  reason: string;
  phase: 'discovery' | 'unit' | 'statement' | 'reconciliation';
}

export interface SydneyTrainsParseResult {
  records: SpendingRecord[];
  deferral: SydneyTrainsDeferral | null;
  statement: SydneyTrainsStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export interface SydneyTrainsLineSpec {
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

export function sydneyTrainsNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${SYDNEY_TRAINS_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousandsOfDollars: number): number {
  const cents = Math.abs(thousandsOfDollars) * SYDNEY_TRAINS_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousandsOfDollars} thousands exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: SydneyTrainsParseContext,
  spec: SydneyTrainsLineSpec,
  statement: SydneyTrainsStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `entity_legal_name: ${SYDNEY_TRAINS_LEGAL_NAME}`,
    `printed_unit: ${SYDNEY_TRAINS_UNIT_LABEL} (${SYDNEY_TRAINS_UNIT}; x${SYDNEY_TRAINS_UNIT_TO_CENTS} cents per unit; whole-thousand-dollar printed precision)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: SydneyTrainsLineSpec,
  context: SydneyTrainsParseContext,
  statement: SydneyTrainsStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: SYDNEY_TRAINS_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: sydneyTrainsNaturalKey(
      SYDNEY_TRAINS_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${SYDNEY_TRAINS_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: SYDNEY_TRAINS_JURISDICTION,
    delivery_entity: SYDNEY_TRAINS_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Sydney Trains Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: SYDNEY_TRAINS_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: SYDNEY_TRAINS_UNIT,
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
      section: spec.section,
      line_label: spec.label,
      revenue_thousands: statement.total_revenue,
      total_expenses_thousands: statement.total_expenses,
      net_result_thousands: statement.net_result,
      ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      ...(spec.line_item === 'government_grants'
        ? {
            potential_double_count_reason:
              'Grants and contributions are separately disclosed, presented below Total revenue, and may overlap NSW government program spending; already included in the net-result bridge but never added to Total revenue',
          }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

function deferralResult(
  reason: string,
  phase: SydneyTrainsDeferral['phase'],
  partial: Partial<SydneyTrainsParseResult>,
): SydneyTrainsParseResult {
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

export function parseSydneyTrainsExtraction(
  extraction: PdfExtraction,
  context: SydneyTrainsParseContext,
): SydneyTrainsParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
    return deferralResult(
      'no parseable Statement of comprehensive income found in the PDF',
      'statement',
      { warnings },
    );
  }
  const statement = parseSydneyTrainsStatement(statementPage);
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

  const lineSpecs: SydneyTrainsLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: SYDNEY_TRAINS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed statement Total revenue. Exactly equals the four printed revenue lines (Sale of goods and services from contracts with customers + Investment revenue + Major rail project revenue + Other income). Grants and contributions are presented below the deficit line and are NOT part of Total revenue; they are never added to this row.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses excluding losses',
      amount_thousands: statement.total_expenses,
      funding_source: SYDNEY_TRAINS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement subtotal Total expenses excluding losses. Exactly equals the six printed expense lines (Employee-related expenses + Personnel services + Other operating expenses + Major rail project expenses + Depreciation and amortisation + Finance costs). The below-the-line Gains/(losses) on disposal, Other gains/(losses) and Impairment reversals/(losses) are excluded from this subtotal and are included only in the net-result bridge; never add the component rows to it.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee-related expenses',
      amount_thousands: statement.employee_expenses,
      funding_source: SYDNEY_TRAINS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement line Employee-related expenses (Note 3(a)). A component of Total expenses excluding losses; never add it to the total.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: SYDNEY_TRAINS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement line Depreciation and amortisation (Note 3(f)). A component of Total expenses excluding losses; never add it to the total.',
    },
    {
      line_item: 'government_grants',
      label: 'Grants and contributions',
      amount_thousands: statement.grants_and_contributions,
      funding_source: 'NSW Government — Transport for NSW',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'revenue',
      detail:
        'Printed statement line Grants and contributions, disclosed in Note 2(c) as Grants from TfNSW 3,496,749 plus Personnel services benefit 3,463. Presented below Total revenue and included in the net-result bridge; may overlap NSW government program spending and is never added to Total revenue.',
    },
    {
      line_item: 'net_result',
      label: 'Net result',
      amount_thousands: statement.net_result,
      funding_source: SYDNEY_TRAINS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
      detail:
        'Printed Net result, a deficit retained with a negative sign. A result line, not an expense component; never add to revenue or expenses. Exactly equals (Deficit)/surplus from operations plus Gains/(losses) on disposal, Other gains/(losses) and Impairment reversals/(losses).',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the printed Total revenue and Total expenses excluding losses reconcile exactly to their printed components, the deficit and operations bridges reconcile, and the printed net result reconciles to operations plus the below-the-line gains/losses.',
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

export interface SydneyTrainsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: SydneyTrainsAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'sydney-trains-annual-report.pdf';
}

/** Operator escape hatch: use an exact official PDF URL instead of live discovery. */
function documentFromEnv(): SydneyTrainsAnnualReportLink | null {
  const url = process.env.SYDNEY_TRAINS_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'sydney-trains-annual-report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = fiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `SYDNEY_TRAINS_ANNUAL_REPORT_URL filename "${filename}" has no report year; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  const volume = sydneyTrainsVolumeFromFilename(filename);
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}${volume === 2 ? ' — audited financial statements' : ''}`,
    discovery_page: SYDNEY_TRAINS_SOURCE_URL,
    volume,
  };
}

async function recordDeferral(
  document: SydneyTrainsAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: SydneyTrainsDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: SYDNEY_TRAINS_ID, document_url: document.url },
    {
      $set: {
        entity: SYDNEY_TRAINS_ENTITY,
        jurisdiction: SYDNEY_TRAINS_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Sydney Trains SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Sydney Trains connector. */
export function createSydneyTrainsConnector(options: SydneyTrainsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: SYDNEY_TRAINS_ID,
    name: SYDNEY_TRAINS_NAME,
    publisher: SYDNEY_TRAINS_PUBLISHER,
    source_url: SYDNEY_TRAINS_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: SYDNEY_TRAINS_LICENSE,
    notes:
      'NSW SOC Phase 10: Sydney Trains only. The latest annual report is discovered from the official Transport for NSW Sydney Trains annual-reports page (no hard-coded PDF URL; an operator PDF-URL override exists), SHA-256 archived outside the repo, and the audited Statement of comprehensive income is parsed from the financial-statements volume. The printed unit must be explicit $\'000; the statement prints an explicit Total revenue and Total expenses excluding losses, accepted only when the revenue-line, expense-line, deficit, operations-result and net-result bridges reconcile exactly. Grants and contributions are separately disclosed, so one grant row is emitted with potential_double_count=true. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). SOC rows are never added to government program spending, the PNFC benchmark, or each other. Other SOCs are not implemented.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverSydneyTrainsAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Sydney Trains PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: SYDNEY_TRAINS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Sydney Trains annual-report financial-statements PDF; archived for auditable NSW SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: SydneyTrainsParseContext = {
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
      const parsed = parseSydneyTrainsExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'sydney-trains-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'sydney-trains-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Sydney Trains measure; skipped');
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
