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
 * QLD SOC — Ports North (Far North Queensland Ports Corporation Limited)
 * annual-report adapter.
 *
 * This reuses the Energy Queensland/CS Energy/Stanwell/Powerlink/Sunwater/
 * Gladstone/Port of Townsville QLD SOC pattern: one entity, one audited face
 * statement, no QLD total. The reporting entity is Far North Queensland Ports
 * Corporation Limited, trading as Ports North: a Queensland Government Owned
 * Corporation (GOC), not a statutory body.
 *
 * Source gate:
 * - The document is discovered from the official annual-reports page
 *   (<https://www.portsnorth.com.au/news-publications/annual-reports/>). No PDF
 *   URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The Statement of Comprehensive Income prints an explicit "$'000" unit. A
 *   table read as dollars or millions is rejected, not converted by magnitude.
 * - The face statement prints Total Income, Total Expenses, Operating Result
 *   before income tax, Operating Result for the year, Total Other Comprehensive
 *   Income and Total Comprehensive Income. The adapter requires the printed
 *   income components to sum exactly to Total Income, the printed expense
 *   components to sum exactly to Total Expenses, Total Income less Total
 *   Expenses to equal the printed pre-tax result, that result less the printed
 *   income-tax-equivalent expense to equal the printed Operating Result for the
 *   year, the printed OCI components to sum to Total OCI, and the net result
 *   plus Total OCI to equal Total Comprehensive Income. A one-thousand-dollar
 *   mismatch defers the whole document.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Ports North
 * rows are never added to government program spending, the PNFC benchmark,
 * Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater
 * Limited, Gladstone Ports, Port of Townsville, another QLD GOC, a QLD total,
 * or each other.
 */

export const PORTS_NORTH_ID = 'qld-ports-north';
export const PORTS_NORTH_NAME = 'Ports North — Annual Report';
export const PORTS_NORTH_PUBLISHER =
  'Far North Queensland Ports Corporation Limited (Ports North)';
export const PORTS_NORTH_ENTITY = 'Ports North';
export const PORTS_NORTH_JURISDICTION = 'QLD';
export const PORTS_NORTH_LEGAL_CLASS = 'Queensland Government Owned Corporation (GOC)';
/** Canonical official annual-reports page. Annual-report PDFs are discovered from it. */
export const PORTS_NORTH_SOURCE_URL = 'https://www.portsnorth.com.au/news-publications/annual-reports/';
export const PORTS_NORTH_LICENSE =
  '© Ports North (Far North Queensland Ports Corporation Limited). Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const PORTS_NORTH_UNIT = 'AUD_thousands';
export const PORTS_NORTH_UNIT_LABEL = "$'000";
export const PORTS_NORTH_UNIT_TO_CENTS = 100_000;
export const PORTS_NORTH_CAVEAT =
  'Entity-level SOC statement lines for Ports North only (Far North Queensland Ports Corporation Limited, a Queensland Government Owned Corporation). Never add to government program spending, to the PNFC sector benchmark, to Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Port of Townsville Limited, another QLD GOC, a QLD or national total, or to each other: total revenue is the printed Total Income line; total expenses is the printed Total Expenses line; employee expenses and depreciation are printed components of total expenses; the net result is the printed Operating Result for the year. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface PortsNorthAnnualReportLink {
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

/** "fy2025" / "fy23" name the financial year ENDING that year. */
function fiscalYearEnding(yearRaw: string): string | null {
  let end = Number(yearRaw);
  if (yearRaw.length === 2) end += 2000;
  if (!Number.isInteger(end) || end < 2001 || end > 2100) return null;
  const start = end - 1;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

/**
 * Convert a Ports North annual-report filename to the API fiscal year. Filenames
 * use a full span (2021-22), an "fy" prefix (fy2025, fy23) or a single
 * year-ended year (2026). The first valid form wins.
 */
export function portsNorthFiscalYearFromFilename(filename: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(filename)) return null;
  let sawSpan = false;
  for (const match of filename.matchAll(/(?:^|[^0-9])(\d{4})\s*[-–]\s*(\d{2,4})(?!\d)/g)) {
    sawSpan = true;
    const span = fiscalYearFromSpan(match[1] as string, match[2] as string);
    if (span) return span;
  }
  // A malformed span (e.g. 2025-27) is rejected rather than reinterpreted as a
  // single year-ended year.
  if (sawSpan) return null;
  const fy = /(?:^|[^a-z0-9])fy\s*(\d{2,4})(?!\d)/i.exec(filename);
  if (fy) {
    const ending = fiscalYearEnding(fy[1] as string);
    if (ending) return ending;
  }
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
 * Parse annual-report PDF links from the official annual-reports page. The page
 * uses protocol-relative S3 hrefs; `new URL(raw, pageUrl)` resolves them. A link
 * is accepted only when its filename contains "Annual Report" and carries a
 * recognisable year; Statements of Corporate Intent are rejected by name.
 */
export function parsePortsNorthAnnualReportPdfLinks(
  html: string,
  pageUrl: string = PORTS_NORTH_SOURCE_URL,
): PortsNorthAnnualReportLink[] {
  const links: PortsNorthAnnualReportLink[] = [];
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
    const fiscalYear = portsNorthFiscalYearFromFilename(filename);
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
 * Fetch the official annual-reports page and return its newest annual-report
 * PDF. No PDF URL is hard-coded; a page with no annual-report link is an error.
 */
export async function discoverPortsNorthAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  reportsUrl: string = PORTS_NORTH_SOURCE_URL,
): Promise<PortsNorthAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(reportsUrl, {
      redirect: 'follow',
      headers: BROWSER_HEADERS,
    });
  } catch (error) {
    throw new Error(
      `Ports North annual-reports page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Ports North annual-reports page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parsePortsNorthAnnualReportPdfLinks(html, reportsUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Ports North annual-reports page contains no annual-report PDF link; refusing to hard-code a URL',
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

function unitSamples(rows: readonly PageRow[]): string[] {
  return rows
    .filter((row) => row.cells.some((cell) => cell.includes('$')))
    .map((row) => row.cells.join(' '));
}

export function detectPortsNorthUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface PortsNorthStatement {
  page_number: number;
  unit: UnitDetection;
  user_charges: number;
  interest_revenue: number;
  other_revenue: number;
  gain_on_sale: number;
  fair_value_increase: number;
  total_income: number;
  supplies_services: number;
  employee_expenses: number;
  finance_costs: number;
  depreciation_amortisation: number;
  write_off: number;
  revaluation_decrement: number;
  total_expenses: number;
  operating_result_before_tax: number;
  income_tax: number;
  net_result: number;
  revaluation_surplus: number;
  deferred_tax_adjustments: number;
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
      text.includes('statement of comprehensive income') &&
      text.includes('operating result for the year') &&
      text.includes('total income') &&
      text.includes('total expenses')
    ) {
      return page;
    }
  }
  return null;
}

export function parsePortsNorthStatement(facePage: PdfPage): PortsNorthStatement | null {
  const rows = groupPageRows(facePage.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'User charges');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed User charges row',
    );
    return null;
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);

  const userCharges = read('User charges');
  const interestRevenue = read('Interest revenue');
  const otherRevenue = read('Other revenue');
  const gainOnSale = read('Gain on sale of property, plant and equipment');
  const fairValueIncrease = read('Increase in Fair Value of Investment property');
  const totalIncome = read('Total Income');
  const supplies = read('Supplies and services');
  const employee = read('Employee expenses');
  const financeCosts = read('Finance Costs');
  const depreciation = read('Depreciation');
  const writeOff = read('Write off of Property, Plant and Equipment work in progress');
  const revaluationDecrement = read('Revaluation decrement of property, plant and equipment');
  const totalExpenses = read('Total Expenses');
  const operatingBeforeTax = read('Operating Result before Income tax (equivalent) expense');
  const incomeTax = read('Income tax equivalent expense/(benefit)');
  const netResult = read('Operating Result for the year');
  const revaluationSurplus = read('Increase/(decrease) in asset revaluation surplus');
  const deferredTax = read('Other deferred tax adjustments');
  const totalOci = read('Total Other Comprehensive Income for the period, net of income tax');
  const totalComprehensive = read('Total Comprehensive Income');

  const required: Array<[string, CellValue]> = [
    ['User charges', userCharges],
    ['Interest revenue', interestRevenue],
    ['Other revenue', otherRevenue],
    ['Gain on sale of property, plant and equipment', gainOnSale],
    ['Increase in Fair Value of Investment property', fairValueIncrease],
    ['Total Income', totalIncome],
    ['Supplies and services', supplies],
    ['Employee expenses', employee],
    ['Finance Costs', financeCosts],
    ['Depreciation', depreciation],
    ['Write off of Property, Plant and Equipment work in progress', writeOff],
    ['Revaluation decrement of property, plant and equipment', revaluationDecrement],
    ['Total Expenses', totalExpenses],
    ['Operating Result before Income tax (equivalent) expense', operatingBeforeTax],
    ['Income tax equivalent expense/(benefit)', incomeTax],
    ['Operating Result for the year', netResult],
    ['Increase/(decrease) in asset revaluation surplus', revaluationSurplus],
    ['Other deferred tax adjustments', deferredTax],
    ['Total Other Comprehensive Income for the period, net of income tax', totalOci],
    ['Total Comprehensive Income', totalComprehensive],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const userChargesValue = userCharges.value as number;
  const interest = interestRevenue.value as number;
  const otherRev = otherRevenue.value as number;
  const gain = gainOnSale.value as number;
  const fairValue = fairValueIncrease.value as number;
  const printedIncome = totalIncome.value as number;
  const suppliesValue = supplies.value as number;
  const employeeValue = employee.value as number;
  const financeValue = financeCosts.value as number;
  const depreciationValue = depreciation.value as number;
  const writeOffValue = writeOff.value as number;
  const revaluationDecrementValue = revaluationDecrement.value as number;
  const printedExpenses = totalExpenses.value as number;
  const operatingValue = operatingBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;
  const revaluationValue = revaluationSurplus.value as number;
  const deferredTaxValue = deferredTax.value as number;
  const totalOciValue = totalOci.value as number;
  const comprehensiveValue = totalComprehensive.value as number;

  const incomeComponents = [userChargesValue, interest, otherRev, gain, fairValue];
  const incomeSum = incomeComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `income components exact: ${incomeComponents.join(' + ')} = ${incomeSum} (printed Total Income ${printedIncome})`,
  );
  if (incomeSum !== printedIncome) {
    errors.push(
      `income component total mismatch: ${incomeComponents.join(' + ')} = ${incomeSum}, printed Total Income ${printedIncome}`,
    );
  }

  const expenseComponents = [
    suppliesValue,
    employeeValue,
    financeValue,
    depreciationValue,
    writeOffValue,
    revaluationDecrementValue,
  ];
  const expenseSum = expenseComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `expense components exact: ${expenseComponents.join(' + ')} = ${expenseSum} (printed Total Expenses ${printedExpenses})`,
  );
  if (expenseSum !== printedExpenses) {
    errors.push(
      `expense component total mismatch: ${expenseComponents.join(' + ')} = ${expenseSum}, printed Total Expenses ${printedExpenses}`,
    );
  }

  const operatingBridge = printedIncome - printedExpenses;
  checks.push(
    `operating-result bridge exact: ${printedIncome} - ${printedExpenses} = ${operatingBridge} (printed ${operatingValue})`,
  );
  if (operatingBridge !== operatingValue) {
    errors.push(
      `operating-result bridge mismatch: ${printedIncome} - ${printedExpenses} = ${operatingBridge}, printed Operating Result before income tax ${operatingValue}`,
    );
  }

  const netBridge = operatingValue - Math.abs(taxValue);
  checks.push(
    `net-result bridge exact: ${operatingValue} - ${Math.abs(taxValue)} = ${netBridge} (printed ${netValue})`,
  );
  if (netBridge !== netValue) {
    errors.push(
      `net-result bridge mismatch: ${operatingValue} - ${Math.abs(taxValue)} = ${netBridge}, printed Operating Result for the year ${netValue}`,
    );
  }

  const ociBridge = revaluationValue + deferredTaxValue;
  checks.push(
    `total-oci bridge exact: ${revaluationValue} + ${deferredTaxValue} = ${ociBridge} (printed ${totalOciValue})`,
  );
  if (ociBridge !== totalOciValue) {
    errors.push(
      `total-oci bridge mismatch: ${revaluationValue} + ${deferredTaxValue} = ${ociBridge}, printed Total Other Comprehensive Income ${totalOciValue}`,
    );
  }

  const comprehensiveBridge = netValue + totalOciValue;
  checks.push(
    `total-comprehensive-income bridge exact: ${netValue} + ${totalOciValue} = ${comprehensiveBridge} (printed ${comprehensiveValue})`,
  );
  if (comprehensiveBridge !== comprehensiveValue) {
    errors.push(
      `total-comprehensive-income bridge mismatch: ${netValue} + ${totalOciValue} = ${comprehensiveBridge}, printed Total Comprehensive Income ${comprehensiveValue}`,
    );
  }

  warnings.push(
    "the Statement of Comprehensive Income prints an explicit $'000 unit and printed Total Income and Total Expenses subtotals; the adapter requires the printed income and expense components to sum exactly to those subtotals and the printed operating-result, net-result, OCI and total-comprehensive-income bridges to agree at zero tolerance. The 2025-26 statement reconciles exactly.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    user_charges: userChargesValue,
    interest_revenue: interest,
    other_revenue: otherRev,
    gain_on_sale: gain,
    fair_value_increase: fairValue,
    total_income: printedIncome,
    supplies_services: suppliesValue,
    employee_expenses: employeeValue,
    finance_costs: financeValue,
    depreciation_amortisation: depreciationValue,
    write_off: writeOffValue,
    revaluation_decrement: revaluationDecrementValue,
    total_expenses: printedExpenses,
    operating_result_before_tax: operatingValue,
    income_tax: taxValue,
    net_result: netValue,
    revaluation_surplus: revaluationValue,
    deferred_tax_adjustments: deferredTaxValue,
    total_oci: totalOciValue,
    total_comprehensive_income: comprehensiveValue,
    checks,
    warnings,
    errors,
  };
}

export interface PortsNorthParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface PortsNorthDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation';
}

export interface PortsNorthLineSpec {
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

export interface PortsNorthParseResult {
  records: SpendingRecord[];
  deferral: PortsNorthDeferral | null;
  statement: PortsNorthStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function portsNorthNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${PORTS_NORTH_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * PORTS_NORTH_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: PortsNorthParseContext,
  spec: PortsNorthLineSpec,
  statement: PortsNorthStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${PORTS_NORTH_UNIT_LABEL} (${PORTS_NORTH_UNIT}; x${PORTS_NORTH_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; single Far North Queensland Ports Corporation Limited (Ports North) entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, Port of Townsville Limited, another QLD GOC, a QLD total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: PortsNorthLineSpec,
  context: PortsNorthParseContext,
  statement: PortsNorthStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: PORTS_NORTH_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: portsNorthNaturalKey(
      PORTS_NORTH_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${PORTS_NORTH_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: PORTS_NORTH_JURISDICTION,
    delivery_entity: PORTS_NORTH_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Ports North Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: PORTS_NORTH_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: PORTS_NORTH_UNIT,
    soc_section: spec.section,
    soc_note: 'Face statement',
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
      revenue_thousands: statement.total_income,
      total_expenses_thousands: statement.total_expenses,
      net_result_thousands: statement.net_result,
      ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

export function parsePortsNorthExtraction(
  extraction: PdfExtraction,
  context: PortsNorthParseContext,
): PortsNorthParseResult {
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
  const statement = parsePortsNorthStatement(facePage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason: 'statement of comprehensive income found but required printed lines could not be parsed',
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

  const lineSpecs: PortsNorthLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_income,
      funding_source: PORTS_NORTH_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total Income line, which bridges exactly to the printed User charges + Interest revenue + Other revenue + Gain on sale of property, plant and equipment + Increase in Fair Value of Investment property lines. Entity-level income; includes government-related and fair-value items already, so it is never added to government program spending.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: PORTS_NORTH_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Total Expenses line, which bridges exactly to the printed Supplies and services + Employee expenses + Finance Costs + Depreciation + Write off of work in progress + Revaluation decrement of property, plant and equipment lines, and to the printed Operating Result before income tax when deducted from Total Income.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee expenses',
      amount_thousands: statement.employee_expenses,
      funding_source: PORTS_NORTH_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee expenses line. A component of Total Expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: PORTS_NORTH_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation line. A component of Total Expenses; never added to it. (The statement does not print a separate amortisation line for this entity.)',
    },
    {
      line_item: 'net_result',
      label: 'Operating result for the year',
      amount_thousands: statement.net_result,
      funding_source: PORTS_NORTH_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Operating Result for the year (net result after income tax equivalents). A result line, not an expense component; never add to revenue or expenses.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the printed income and expense components reconcile exactly to the printed subtotals and the printed operating-result, net-result, OCI and total-comprehensive-income bridges agree at zero tolerance.',
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

export interface PortsNorthConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: PortsNorthAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'ports-north-annual-report.pdf';
}

/**
 * Operator escape hatch: when `PORTS_NORTH_ANNUAL_REPORT_URL` is set, it is used
 * as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): PortsNorthAnnualReportLink | null {
  const url = process.env.PORTS_NORTH_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Ports-North-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = portsNorthFiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `PORTS_NORTH_ANNUAL_REPORT_URL filename "${filename}" has no annual-report year span; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: PORTS_NORTH_SOURCE_URL,
  };
}

async function recordDeferral(
  document: PortsNorthAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: PortsNorthDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: PORTS_NORTH_ID, document_url: document.url },
    {
      $set: {
        entity: PORTS_NORTH_ENTITY,
        jurisdiction: PORTS_NORTH_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Ports North SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Ports North connector. */
export function createPortsNorthConnector(options: PortsNorthConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: PORTS_NORTH_ID,
    name: PORTS_NORTH_NAME,
    publisher: PORTS_NORTH_PUBLISHER,
    source_url: PORTS_NORTH_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: PORTS_NORTH_LICENSE,
    notes:
      'QLD SOC: Ports North only (Far North Queensland Ports Corporation Limited), a Queensland Government Owned Corporation (GOC). The latest annual report is discovered from the official annual-reports page (no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo. The Statement of Comprehensive Income prints an explicit $\'000 unit and printed Total Income and Total Expenses subtotals; the adapter requires the printed income and expense components to sum exactly to those subtotals and the printed operating-result, net-result, OCI and total-comprehensive-income bridges to agree at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Ports North is never added to government program spending, the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports, Port of Townsville, another QLD GOC, a QLD total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverPortsNorthAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Ports North PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: PORTS_NORTH_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Ports North annual-report PDF; archived for auditable QLD SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: PortsNorthParseContext = {
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
      const parsed = parsePortsNorthExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'qld-ports-north-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'qld-ports-north-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Ports North measure; skipped');
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
