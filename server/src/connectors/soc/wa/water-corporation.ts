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
 * WA SOC — Water Corporation annual-report adapter.
 *
 * This is the first WA Government Trading Enterprise (GTE) pilot. It reuses the
 * existing QLD/NSW SOC rules (one entity, one audited face statement, no
 * jurisdiction total) but lives in the WA namespace and legal class: Water
 * Corporation is a WA Government Trading Enterprise under the Government
 * Trading Enterprises Act 2023 (WA), not a Queensland GOC or an NSW SOC.
 *
 * Source gate:
 * - The latest report is discovered from Water Corporation's official annual
 *   report page; no PDF URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The Statement of Comprehensive Income prints an explicit "$M" unit for the
 *   Group 2026/2025 and Corporation 2026/2025 columns. A table read as dollars
 *   or thousands is rejected, not converted by magnitude. One $M unit =
 *   100,000,000 cents.
 * - The adapter reads the Group 2026 current-year column only. The Corporation
 *   column and the consolidated subsidiary are never added.
 * - The statement prints Total revenue, Total expenses, Results from operating
 *   activities, Profit before income tax equivalent, Profit for the year, Other
 *   comprehensive income and Total comprehensive income. The adapter requires
 *   the printed revenue and expense components to sum exactly to those
 *   subtotals and every printed result/OCI/comprehensive bridge to agree at zero
 *   tolerance. A one-million-dollar mismatch defers the whole document.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Water
 * Corporation rows are never added to government program spending, the PNFC
 * benchmark, another WA GTE, a QLD/NSW SOC, a WA total, or each other.
 */

export const WATER_CORPORATION_ID = 'wa-water-corporation';
export const WATER_CORPORATION_NAME = 'Water Corporation — Annual Report';
export const WATER_CORPORATION_PUBLISHER = 'Water Corporation';
export const WATER_CORPORATION_ENTITY = 'Water Corporation';
export const WATER_CORPORATION_JURISDICTION = 'WA';
export const WATER_CORPORATION_LEGAL_CLASS =
  'WA Government Trading Enterprise (GTE) — Government Trading Enterprises Act 2023 (WA)';
/** Canonical official annual report page. Annual-report PDFs are discovered from it. */
export const WATER_CORPORATION_SOURCE_URL =
  'https://www.watercorporation.com.au/about-us/our-performance/annual-report';
export const WATER_CORPORATION_LICENSE =
  '© Water Corporation. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const WATER_CORPORATION_UNIT = 'AUD_millions';
export const WATER_CORPORATION_UNIT_LABEL = '$M';
export const WATER_CORPORATION_UNIT_TO_CENTS = 100_000_000;
export const WATER_CORPORATION_CAVEAT =
  'Entity-level SOC statement lines for Water Corporation only (a WA Government Trading Enterprise under the Government Trading Enterprises Act 2023 (WA)). Never add to government program spending, to the PNFC sector benchmark, to another WA GTE, to a QLD or NSW SOC, a WA or national total, or to each other: total revenue is the printed Total revenue line; total expenses is the printed Total expenses line; employee expenses and depreciation/amortisation are printed components of total expenses; the net result is the printed Profit for the year. The Group 2026 column is used; the Corporation column and the consolidated subsidiary are never added. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface WaterCorporationAnnualReportLink {
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
  /quarterly|interim|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|corporate[\s_\-–]*plan/i;

function fiscalYearEnding(yearRaw: string): string | null {
  let end = Number(yearRaw);
  if (yearRaw.length === 2) end += 2000;
  if (!Number.isInteger(end) || end < 2001 || end > 2100) return null;
  const start = end - 1;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

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

/**
 * Convert a Water Corporation annual-report filename to the API fiscal year.
 * The annual reports are named by the year ended (e.g. ...-annual-report-2026),
 * so a bare 20xx year is the financial year ending that year.
 */
export function waterCorporationFiscalYearFromFilename(filename: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(filename) || NON_ANNUAL_REPORT.test(filename)) return null;
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
 * Parse annual-report PDF links from the official page. A link is accepted only
 * when its filename contains "Annual Report" and a year; quarterly reports,
 * Statements of Corporate Intent and corporate plans are rejected by name.
 */
export function parseWaterCorporationAnnualReportPdfLinks(
  html: string,
  pageUrl: string = WATER_CORPORATION_SOURCE_URL,
): WaterCorporationAnnualReportLink[] {
  const links: WaterCorporationAnnualReportLink[] = [];
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
    const fiscalYear = waterCorporationFiscalYearFromFilename(filename);
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
 * Fetch the official annual report page and return its newest annual-report
 * PDF. No PDF URL is hard-coded; a page with no annual-report link is an error.
 */
export async function discoverWaterCorporationAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  reportsUrl: string = WATER_CORPORATION_SOURCE_URL,
): Promise<WaterCorporationAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(reportsUrl, {
      redirect: 'follow',
      headers: BROWSER_HEADERS,
    });
  } catch (error) {
    throw new Error(
      `Water Corporation annual-report page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Water Corporation annual-report page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parseWaterCorporationAnnualReportPdfLinks(html, reportsUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Water Corporation annual-report page contains no annual-report PDF link; refusing to hard-code a URL',
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

/** Label text is everything left of the note-reference column (x < 265). */
function labelOf(row: PageRow): string {
  return row.items
    .filter((item) => item.x < 265)
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

export function detectWaterCorporationUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface WaterCorporationStatement {
  page_number: number;
  unit: UnitDetection;
  annual_service_charges: number;
  volume_charges: number;
  operating_subsidies: number;
  developers_contributions: number;
  other_revenue: number;
  total_revenue: number;
  depreciation_amortisation: number;
  employee_expenses: number;
  hired_contracted_services: number;
  energy_expenses: number;
  other_expenses: number;
  total_expenses: number;
  results_from_operating_activities: number;
  net_finance_costs: number;
  profit_before_tax: number;
  income_tax: number;
  net_result: number;
  remeasurements_defined_benefits: number;
  other_comprehensive_income: number;
  total_comprehensive_income: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findFaceStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('statement of comprehensive income') &&
      text.includes('total revenue') &&
      text.includes('results from operating activities') &&
      text.includes('profit for the year')
    ) {
      return page;
    }
  }
  return null;
}

export function parseWaterCorporationStatement(
  facePage: PdfPage,
): WaterCorporationStatement | null {
  const rawRows = groupPageRows(facePage.items);
  const rows = logicalRows(rawRows);
  const unit = detectMoneyUnit(unitSamples(rawRows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Annual service charges');
  if (anchor === null) {
    errors.push(
      'statement Group current-year money column could not be anchored from the printed revenue row',
    );
    return null;
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);

  const annualServiceCharges = read('Annual service charges');
  const volumeCharges = read('Volume charges');
  const operatingSubsidies = read('Operating subsidies');
  const developersContributions = read('Developers’ contributions');
  const otherRevenue = read('Other revenue');
  const totalRevenue = read('Total revenue');
  const depreciation = read('Depreciation and amortisation');
  const employee = read('Employee benefits expense');
  const hiredContracted = read('Hired and contracted services');
  const energy = read('Energy expenses');
  const otherExpenses = read('Other expenses');
  const totalExpenses = read('Total expenses');
  const operatingActivities = read('Results from operating activities');
  const netFinanceCosts = read('Net finance costs');
  const profitBeforeTax = read('Profit before income tax equivalent');
  const incomeTax = read('Income tax equivalent expense');
  const netResult = read('Profit for the year');
  const remeasurements = read('Remeasurements of defined benefits');
  const otherComprehensive = read('Other comprehensive income/(loss), net of tax equivalent');
  const totalComprehensive = read('Total comprehensive income for the year');

  const required: Array<[string, CellValue]> = [
    ['Annual service charges', annualServiceCharges],
    ['Volume charges', volumeCharges],
    ['Operating subsidies', operatingSubsidies],
    ['Developers’ contributions', developersContributions],
    ['Other revenue', otherRevenue],
    ['Total revenue', totalRevenue],
    ['Depreciation and amortisation', depreciation],
    ['Employee benefits expense', employee],
    ['Hired and contracted services', hiredContracted],
    ['Energy expenses', energy],
    ['Other expenses', otherExpenses],
    ['Total expenses', totalExpenses],
    ['Results from operating activities', operatingActivities],
    ['Net finance costs', netFinanceCosts],
    ['Profit before income tax equivalent', profitBeforeTax],
    ['Income tax equivalent expense', incomeTax],
    ['Profit for the year', netResult],
    ['Remeasurements of defined benefits', remeasurements],
    ['Other comprehensive income/(loss), net of tax equivalent', otherComprehensive],
    ['Total comprehensive income for the year', totalComprehensive],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const serviceValue = annualServiceCharges.value as number;
  const volumeValue = volumeCharges.value as number;
  const subsidyValue = operatingSubsidies.value as number;
  const developerValue = developersContributions.value as number;
  const otherRevenueValue = otherRevenue.value as number;
  const revenueValue = totalRevenue.value as number;
  const depreciationValue = Math.abs(depreciation.value as number);
  const employeeValue = Math.abs(employee.value as number);
  const hiredValue = Math.abs(hiredContracted.value as number);
  const energyValue = Math.abs(energy.value as number);
  const otherExpensesValue = Math.abs(otherExpenses.value as number);
  const expensesValue = Math.abs(totalExpenses.value as number);
  const operatingValue = operatingActivities.value as number;
  const netFinanceValue = netFinanceCosts.value as number;
  const profitBeforeTaxValue = profitBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;
  const remeasurementsValue = remeasurements.value as number;
  const otherComprehensiveValue = otherComprehensive.value as number;
  const comprehensiveValue = totalComprehensive.value as number;

  const revenueComponents = [
    serviceValue,
    volumeValue,
    subsidyValue,
    developerValue,
    otherRevenueValue,
  ];
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
    depreciationValue,
    employeeValue,
    hiredValue,
    energyValue,
    otherExpensesValue,
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

  const operatingBridge = revenueValue - expensesValue;
  checks.push(
    `operating-activities bridge exact: ${revenueValue} - ${expensesValue} = ${operatingBridge} (printed ${operatingValue})`,
  );
  if (operatingBridge !== operatingValue) {
    errors.push(
      `operating-activities bridge mismatch: ${revenueValue} - ${expensesValue} = ${operatingBridge}, printed Results from operating activities ${operatingValue}`,
    );
  }

  const pbtBridge = operatingValue + netFinanceValue;
  checks.push(
    `profit-before-tax bridge exact: ${operatingValue} + ${netFinanceValue} = ${pbtBridge} (printed ${profitBeforeTaxValue})`,
  );
  if (pbtBridge !== profitBeforeTaxValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${operatingValue} + ${netFinanceValue} = ${pbtBridge}, printed Profit before income tax equivalent ${profitBeforeTaxValue}`,
    );
  }

  const netBridge = profitBeforeTaxValue + taxValue;
  checks.push(
    `net-result bridge exact: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge} (printed ${netValue})`,
  );
  if (netBridge !== netValue) {
    errors.push(
      `net-result bridge mismatch: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge}, printed Profit for the year ${netValue}`,
    );
  }

  checks.push(
    `other-comprehensive-income exact: ${remeasurementsValue} = ${otherComprehensiveValue} (printed Other comprehensive income/(loss))`,
  );
  if (remeasurementsValue !== otherComprehensiveValue) {
    errors.push(
      `other-comprehensive-income mismatch: printed Remeasurements of defined benefits ${remeasurementsValue}, printed Other comprehensive income/(loss) ${otherComprehensiveValue}`,
    );
  }

  const comprehensiveBridge = netValue + otherComprehensiveValue;
  checks.push(
    `total-comprehensive-income bridge exact: ${netValue} + ${otherComprehensiveValue} = ${comprehensiveBridge} (printed ${comprehensiveValue})`,
  );
  if (comprehensiveBridge !== comprehensiveValue) {
    errors.push(
      `total-comprehensive-income bridge mismatch: ${netValue} + ${otherComprehensiveValue} = ${comprehensiveBridge}, printed Total comprehensive income for the year ${comprehensiveValue}`,
    );
  }

  warnings.push(
    "the Statement of Comprehensive Income prints an explicit $M unit and both Group and Corporation columns; the adapter reads the Group 2026 current-year column only and never adds the Corporation column or the consolidated subsidiary. The printed revenue and expense components reconcile exactly to the printed subtotals and the operating-activities, profit-before-tax, net-result, other-comprehensive-income and total-comprehensive-income bridges agree at zero tolerance.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    annual_service_charges: serviceValue,
    volume_charges: volumeValue,
    operating_subsidies: subsidyValue,
    developers_contributions: developerValue,
    other_revenue: otherRevenueValue,
    total_revenue: revenueValue,
    depreciation_amortisation: depreciationValue,
    employee_expenses: employeeValue,
    hired_contracted_services: hiredValue,
    energy_expenses: energyValue,
    other_expenses: otherExpensesValue,
    total_expenses: expensesValue,
    results_from_operating_activities: operatingValue,
    net_finance_costs: netFinanceValue,
    profit_before_tax: profitBeforeTaxValue,
    income_tax: Math.abs(taxValue),
    net_result: netValue,
    remeasurements_defined_benefits: remeasurementsValue,
    other_comprehensive_income: otherComprehensiveValue,
    total_comprehensive_income: comprehensiveValue,
    checks,
    warnings,
    errors,
  };
}

export interface WaterCorporationParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface WaterCorporationDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation';
}

export interface WaterCorporationLineSpec {
  line_item: string;
  label: string;
  amount_millions: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result';
  detail: string;
  printed_sign?: 'positive' | 'negative';
}

export interface WaterCorporationParseResult {
  records: SpendingRecord[];
  deferral: WaterCorporationDeferral | null;
  statement: WaterCorporationStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function waterCorporationNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${WATER_CORPORATION_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(millions: number): number {
  const cents = Math.abs(millions) * WATER_CORPORATION_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${millions} million exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: WaterCorporationParseContext,
  spec: WaterCorporationLineSpec,
  statement: WaterCorporationStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${WATER_CORPORATION_UNIT_LABEL} (${WATER_CORPORATION_UNIT}; x${WATER_CORPORATION_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'Group current-year column only (Corporation column and consolidated subsidiary never added); entity-level SOC statement line; single Water Corporation entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: WaterCorporationLineSpec,
  context: WaterCorporationParseContext,
  statement: WaterCorporationStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_millions),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: WATER_CORPORATION_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: waterCorporationNaturalKey(
      WATER_CORPORATION_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${WATER_CORPORATION_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: WATER_CORPORATION_JURISDICTION,
    delivery_entity: WATER_CORPORATION_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Water Corporation Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: WATER_CORPORATION_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: WATER_CORPORATION_UNIT,
    soc_section: spec.section,
    soc_note: 'Statement of comprehensive income',
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
      revenue_millions: statement.total_revenue,
      total_expenses_millions: statement.total_expenses,
      net_result_millions: statement.net_result,
      ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

export function parseWaterCorporationExtraction(
  extraction: PdfExtraction,
  context: WaterCorporationParseContext,
): WaterCorporationParseResult {
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
  const statement = parseWaterCorporationStatement(facePage);
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
  if (statement.unit.kind !== 'millions') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit millions (detected ${statement.unit.kind ?? 'none'}: ${statement.unit.reason}); refusing to ingest a $M statement as dollars or thousands`,
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

  const lineSpecs: WaterCorporationLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_millions: statement.total_revenue,
      funding_source: WATER_CORPORATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total revenue line, which bridges exactly to Annual service charges + Volume charges + Operating subsidies + Developers’ contributions + Other revenue. Entity-level Group revenue; includes State operating subsidies already, so it is never added to government program spending.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_millions: statement.total_expenses,
      funding_source: WATER_CORPORATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Total expenses line, which bridges exactly to Depreciation and amortisation + Employee benefits expense + Hired and contracted services + Energy expenses + Other expenses, and to the printed Results from operating activities when deducted from Total revenue.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expense',
      amount_millions: statement.employee_expenses,
      funding_source: WATER_CORPORATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee benefits expense line. A component of Total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_millions: statement.depreciation_amortisation,
      funding_source: WATER_CORPORATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation and amortisation line. A component of Total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit for the year',
      amount_millions: statement.net_result,
      funding_source: WATER_CORPORATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit for the year (net result after income tax equivalent). A result line, not an expense component; never add to revenue or expenses. Group current-year column only.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the Group current-year revenue and expense components reconcile exactly to the printed subtotals and every printed result, OCI and comprehensive-income bridge agrees at zero tolerance.',
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

export interface WaterCorporationConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: WaterCorporationAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'water-corporation-annual-report.pdf';
}

/**
 * Operator escape hatch: when `WA_WATER_CORPORATION_ANNUAL_REPORT_URL` is set,
 * it is used as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): WaterCorporationAnnualReportLink | null {
  const url = process.env.WA_WATER_CORPORATION_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Water-Corporation-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = waterCorporationFiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `WA_WATER_CORPORATION_ANNUAL_REPORT_URL filename "${filename}" has no annual-report year; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: WATER_CORPORATION_SOURCE_URL,
  };
}

async function recordDeferral(
  document: WaterCorporationAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: WaterCorporationDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: WATER_CORPORATION_ID, document_url: document.url },
    {
      $set: {
        entity: WATER_CORPORATION_ENTITY,
        jurisdiction: WATER_CORPORATION_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Water Corporation SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Water Corporation connector. */
export function createWaterCorporationConnector(
  options: WaterCorporationConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: WATER_CORPORATION_ID,
    name: WATER_CORPORATION_NAME,
    publisher: WATER_CORPORATION_PUBLISHER,
    source_url: WATER_CORPORATION_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: WATER_CORPORATION_LICENSE,
    notes:
      'WA SOC (first WA GTE pilot): Water Corporation only, a WA Government Trading Enterprise under the Government Trading Enterprises Act 2023 (WA). The latest annual report is discovered from the official annual report page (no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo. The Statement of Comprehensive Income prints an explicit $M unit and both Group and Corporation columns; the adapter reads the Group 2026 current-year column only and never adds the Corporation column or subsidiary. The printed revenue and expense components must sum exactly to the printed subtotals, and the operating-activities, profit-before-tax, net-result, OCI and total-comprehensive-income bridges must agree at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Water Corporation is never added to government program spending, the PNFC benchmark, another WA GTE, a QLD/NSW SOC, a WA total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverWaterCorporationAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Water Corporation PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: WATER_CORPORATION_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Water Corporation annual-report PDF; archived for auditable WA SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: WaterCorporationParseContext = {
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
      const parsed = parseWaterCorporationExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'wa-water-corporation-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'wa-water-corporation-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Water Corporation measure; skipped');
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
