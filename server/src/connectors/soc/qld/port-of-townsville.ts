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
 * QLD SOC — Port of Townsville Limited annual-report adapter.
 *
 * This reuses the Energy Queensland/CS Energy/Stanwell/Powerlink/Sunwater/
 * Gladstone QLD SOC pattern: one entity, one audited face statement, no QLD
 * total. The reporting entity is Port of Townsville Limited, a Queensland
 * Government Owned Corporation (GOC), not a statutory body.
 *
 * Source gate:
 * - The document is discovered from the official annual-reports page
 *   (<https://www.townsville-port.com.au/media-publications/publications/annual-reports/>).
 *   No PDF URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The statement of profit or loss and other comprehensive income prints an
 *   explicit "$" (whole dollars) unit for both columns. A table read as
 *   thousands, millions or with no unit is rejected, not converted by
 *   magnitude.
 * - The face statement prints Total Revenue, Total Expenses, Operating Result
 *   before income tax and Operating Result for the year. The adapter requires
 *   the printed revenue components to sum exactly to Total Revenue, the printed
 *   expense components to sum exactly to Total Expenses, Total Revenue less
 *   Total Expenses to equal the printed Operating Result before income tax,
 *   that result plus the printed income tax to equal the printed Operating
 *   Result for the year, and that result plus the printed revaluation surplus to
 *   equal Total Comprehensive Income. A one-dollar mismatch defers the whole
 *   document.
 *
 * IMPORTANT: the FY2025-26 report does **not** pass these zero-tolerance
 * checks. Its printed revenue components sum to 108,063,772 against a printed
 * Total Revenue of 108,063,771; its expense components sum to 85,474,654
 * against a printed Total Expenses of 85,474,655; and 22,589,116 − 6,792,073 =
 * 15,797,043 against a printed Operating Result for the year of 15,797,044.
 * The adapter therefore defers the document and emits no rows. That is the
 * premise-falsifier outcome recorded in
 * docs/source-discovery/qld-port-of-townsville.md; do not fabricate rows.
 *
 * Every row, when a report does reconcile, is an entity-level SOC statement
 * line: jurisdiction_level "soc", aggregation_role "agency_detail", provisional
 * and verified:false. Port of Townsville rows are never added to government
 * program spending, the PNFC benchmark, Energy Queensland, CS Energy,
 * Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports, another
 * QLD GOC, a QLD total, or each other.
 */

export const PORT_OF_TOWNSVILLE_ID = 'qld-port-of-townsville';
export const PORT_OF_TOWNSVILLE_NAME = 'Port of Townsville Limited — Annual Report';
export const PORT_OF_TOWNSVILLE_PUBLISHER = 'Port of Townsville Limited';
export const PORT_OF_TOWNSVILLE_ENTITY = 'Port of Townsville Limited';
export const PORT_OF_TOWNSVILLE_JURISDICTION = 'QLD';
export const PORT_OF_TOWNSVILLE_LEGAL_CLASS = 'Queensland Government Owned Corporation (GOC)';
/** Canonical official annual-reports page. Annual-report PDFs are discovered from it. */
export const PORT_OF_TOWNSVILLE_SOURCE_URL =
  'https://www.townsville-port.com.au/media-publications/publications/annual-reports/';
export const PORT_OF_TOWNSVILLE_LICENSE =
  '© Port of Townsville Limited. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const PORT_OF_TOWNSVILLE_UNIT = 'AUD';
export const PORT_OF_TOWNSVILLE_UNIT_LABEL = '$';
export const PORT_OF_TOWNSVILLE_UNIT_TO_CENTS = 100;
export const PORT_OF_TOWNSVILLE_CAVEAT =
  'Entity-level SOC statement lines for Port of Townsville Limited only (a Queensland Government Owned Corporation). Never add to government program spending, to the PNFC sector benchmark, to Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, another QLD GOC, a QLD or national total, or to each other. The FY2025-26 face statement is deferred because its printed components and net-result bridge are one dollar short; no rows from that report were ingested. Provisional and unverified when a future report reconciles.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface PortOfTownsvilleAnnualReportLink {
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
/** Two- or four-digit consecutive financial-year spans, e.g. 2025-26, 24-25 or 18-19. */
const YEAR_SPAN = /(?:^|[^0-9])(\d{2,4})\s*[-–]\s*(\d{2,4})(?!\d)/g;

function fiscalYearFromParts(startRaw: string, endRaw: string): string | null {
  let start = Number(startRaw);
  if (startRaw.length === 2) start += 2000;
  if (!Number.isInteger(start) || start < 2000 || start > 2100) return null;
  const end = Number(endRaw);
  const expectedEnd = (start + 1) % 100;
  if (!Number.isInteger(end)) return null;
  const endMatches = endRaw.length === 2 ? end === expectedEnd : end === start + 1;
  if (!endMatches) return null;
  return `${start}-${String(expectedEnd).padStart(2, '0')}`;
}

/**
 * Convert a filename fiscal-year span into "2025-26". Port of Townsville uses
 * several forms (…_annual_report_2025-26.pdf, …_annual_report_24-25.pdf,
 * …_annual_report_18-19_…pdf); the first span that is a consecutive year wins.
 */
export function portOfTownsvilleFiscalYearFromFilename(filename: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(filename)) return null;
  for (const match of filename.matchAll(YEAR_SPAN)) {
    const fiscalYear = fiscalYearFromParts(match[1] as string, match[2] as string);
    if (fiscalYear) return fiscalYear;
  }
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
 * uses protocol-relative S3 hrefs; `new URL(raw, pageUrl)` resolves them. A
 * link is accepted only when its filename contains "Annual Report" and a
 * consecutive financial-year span.
 */
export function parsePortOfTownsvilleAnnualReportPdfLinks(
  html: string,
  pageUrl: string = PORT_OF_TOWNSVILLE_SOURCE_URL,
): PortOfTownsvilleAnnualReportLink[] {
  const links: PortOfTownsvilleAnnualReportLink[] = [];
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
    const fiscalYear = portOfTownsvilleFiscalYearFromFilename(filename);
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
export async function discoverPortOfTownsvilleAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  reportsUrl: string = PORT_OF_TOWNSVILLE_SOURCE_URL,
): Promise<PortOfTownsvilleAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(reportsUrl, {
      redirect: 'follow',
      headers: BROWSER_HEADERS,
    });
  } catch (error) {
    throw new Error(
      `Port of Townsville annual-reports page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Port of Townsville annual-reports page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parsePortOfTownsvilleAnnualReportPdfLinks(html, reportsUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Port of Townsville annual-reports page contains no annual-report PDF link; refusing to hard-code a URL',
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

export function detectPortOfTownsvilleUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface PortOfTownsvilleStatement {
  page_number: number;
  unit: UnitDetection;
  revenue_from_contracts: number;
  interest_revenue: number;
  other_revenue: number;
  fair_value_gains: number;
  total_revenue: number;
  employee_expenses: number;
  supplies_services: number;
  depreciation_amortisation: number;
  finance_costs: number;
  other_expenses: number;
  total_expenses: number;
  operating_result_before_tax: number;
  income_tax: number;
  net_result: number;
  revaluation_surplus: number;
  total_comprehensive_income: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findFaceStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('statement of profit or loss') &&
      text.includes('operating result for the year') &&
      text.includes('total revenue') &&
      text.includes('total expenses')
    ) {
      return page;
    }
  }
  return null;
}

export function parsePortOfTownsvilleStatement(
  facePage: PdfPage,
): PortOfTownsvilleStatement | null {
  const rows = groupPageRows(facePage.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Revenue from Contracts with Customers');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed revenue row',
    );
    return null;
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);

  const revenueContracts = read('Revenue from Contracts with Customers');
  const interestRevenue = read('Interest Revenue');
  const otherRevenue = read('Other Revenue');
  const fairValueGains = read('Fair Value Gains on Investment Properties');
  const totalRevenue = read('Total Revenue');
  const employee = read('Employee Expenses');
  const supplies = read('Supplies and Services');
  const depreciation = read('Depreciation and Amortisation Expense');
  const financeCosts = read('Finance Costs');
  const otherExpenses = read('Other Expenses');
  const totalExpenses = read('Total Expenses');
  const operatingBeforeTax = read('OPERATING RESULT BEFORE INCOME TAX EXPENSE');
  const incomeTax = read('Income Tax Expense');
  const netResult = read('OPERATING RESULT FOR THE YEAR');
  const revaluation = read('Increase/(Decrease) in Revaluation Surplus');
  const totalComprehensive = read('TOTAL COMPREHENSIVE INCOME');

  const required: Array<[string, CellValue]> = [
    ['Revenue from Contracts with Customers', revenueContracts],
    ['Interest Revenue', interestRevenue],
    ['Other Revenue', otherRevenue],
    ['Fair Value Gains on Investment Properties', fairValueGains],
    ['Total Revenue', totalRevenue],
    ['Employee Expenses', employee],
    ['Supplies and Services', supplies],
    ['Depreciation and Amortisation Expense', depreciation],
    ['Finance Costs', financeCosts],
    ['Other Expenses', otherExpenses],
    ['Total Expenses', totalExpenses],
    ['OPERATING RESULT BEFORE INCOME TAX EXPENSE', operatingBeforeTax],
    ['Income Tax Expense', incomeTax],
    ['OPERATING RESULT FOR THE YEAR', netResult],
    ['Increase/(Decrease) in Revaluation Surplus', revaluation],
    ['TOTAL COMPREHENSIVE INCOME', totalComprehensive],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const revContracts = revenueContracts.value as number;
  const interest = interestRevenue.value as number;
  const otherRev = otherRevenue.value as number;
  const fairValue = fairValueGains.value as number;
  const printedRevenue = totalRevenue.value as number;
  const employeeValue = employee.value as number;
  const suppliesValue = supplies.value as number;
  const depreciationValue = depreciation.value as number;
  const financeValue = financeCosts.value as number;
  const otherExpenseValue = otherExpenses.value as number;
  const printedExpenses = totalExpenses.value as number;
  const operatingValue = operatingBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;
  const revaluationValue = revaluation.value as number;
  const comprehensiveValue = totalComprehensive.value as number;

  const revenueComponents = [revContracts, interest, otherRev, fairValue];
  const revenueSum = revenueComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `revenue components exact: ${revenueComponents.join(' + ')} = ${revenueSum} (printed Total Revenue ${printedRevenue})`,
  );
  if (revenueSum !== printedRevenue) {
    errors.push(
      `revenue component total mismatch: ${revenueComponents.join(' + ')} = ${revenueSum}, printed Total Revenue ${printedRevenue}`,
    );
  }

  const expenseComponents = [
    employeeValue,
    suppliesValue,
    depreciationValue,
    financeValue,
    otherExpenseValue,
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

  const operatingBridge = printedRevenue - printedExpenses;
  checks.push(
    `operating-result bridge exact: ${printedRevenue} - ${printedExpenses} = ${operatingBridge} (printed ${operatingValue})`,
  );
  if (operatingBridge !== operatingValue) {
    errors.push(
      `operating-result bridge mismatch: ${printedRevenue} - ${printedExpenses} = ${operatingBridge}, printed OPERATING RESULT BEFORE INCOME TAX EXPENSE ${operatingValue}`,
    );
  }

  const netBridge = operatingValue + taxValue;
  checks.push(`net-result bridge exact: ${operatingValue} + ${taxValue} = ${netBridge} (printed ${netValue})`);
  if (netBridge !== netValue) {
    errors.push(
      `net-result bridge mismatch: ${operatingValue} + ${taxValue} = ${netBridge}, printed OPERATING RESULT FOR THE YEAR ${netValue}`,
    );
  }

  const comprehensiveBridge = netValue + revaluationValue;
  checks.push(
    `total-comprehensive-income bridge exact: ${netValue} + ${revaluationValue} = ${comprehensiveBridge} (printed ${comprehensiveValue})`,
  );
  if (comprehensiveBridge !== comprehensiveValue) {
    errors.push(
      `total-comprehensive-income bridge mismatch: ${netValue} + ${revaluationValue} = ${comprehensiveBridge}, printed TOTAL COMPREHENSIVE INCOME ${comprehensiveValue}`,
    );
  }

  warnings.push(
    "the face statement prints Total Revenue and Total Expenses subtotals and an explicit '$' (whole-dollar) unit; the adapter still requires the printed revenue and expense components to sum exactly to those subtotals and the printed operating-result, net-result and total-comprehensive-income bridges to agree at zero tolerance. A one-dollar mismatch defers the document and emits no rows.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    revenue_from_contracts: revContracts,
    interest_revenue: interest,
    other_revenue: otherRev,
    fair_value_gains: fairValue,
    total_revenue: printedRevenue,
    employee_expenses: employeeValue,
    supplies_services: suppliesValue,
    depreciation_amortisation: depreciationValue,
    finance_costs: financeValue,
    other_expenses: otherExpenseValue,
    total_expenses: printedExpenses,
    operating_result_before_tax: operatingValue,
    income_tax: taxValue,
    net_result: netValue,
    revaluation_surplus: revaluationValue,
    total_comprehensive_income: comprehensiveValue,
    checks,
    warnings,
    errors,
  };
}

export interface PortOfTownsvilleParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface PortOfTownsvilleDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation';
}

export interface PortOfTownsvilleLineSpec {
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

export interface PortOfTownsvilleParseResult {
  records: SpendingRecord[];
  deferral: PortOfTownsvilleDeferral | null;
  statement: PortOfTownsvilleStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function portOfTownsvilleNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${PORT_OF_TOWNSVILLE_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(dollars: number): number {
  const cents = Math.abs(dollars) * PORT_OF_TOWNSVILLE_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${dollars} dollars exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: PortOfTownsvilleParseContext,
  spec: PortOfTownsvilleLineSpec,
  statement: PortOfTownsvilleStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${PORT_OF_TOWNSVILLE_UNIT_LABEL} (${PORT_OF_TOWNSVILLE_UNIT}; x${PORT_OF_TOWNSVILLE_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; single Port of Townsville Limited entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, another QLD GOC, a QLD total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: PortOfTownsvilleLineSpec,
  context: PortOfTownsvilleParseContext,
  statement: PortOfTownsvilleStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_dollars),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: PORT_OF_TOWNSVILLE_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: portOfTownsvilleNaturalKey(
      PORT_OF_TOWNSVILLE_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${PORT_OF_TOWNSVILLE_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: PORT_OF_TOWNSVILLE_JURISDICTION,
    delivery_entity: PORT_OF_TOWNSVILLE_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Port of Townsville Limited Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: PORT_OF_TOWNSVILLE_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: PORT_OF_TOWNSVILLE_UNIT,
    soc_section: spec.section,
    soc_note: 'Face statement',
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

export function parsePortOfTownsvilleExtraction(
  extraction: PdfExtraction,
  context: PortOfTownsvilleParseContext,
): PortOfTownsvilleParseResult {
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
  const statement = parsePortOfTownsvilleStatement(facePage);
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

  const lineSpecs: PortOfTownsvilleLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total Revenue',
      amount_dollars: statement.total_revenue,
      funding_source: PORT_OF_TOWNSVILLE_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total Revenue subtotal. The printed Revenue from Contracts with Customers + Interest Revenue + Other Revenue + Fair Value Gains on Investment Properties lines must sum to it exactly. Entity-level revenue; never added to government program spending.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total Expenses',
      amount_dollars: statement.total_expenses,
      funding_source: PORT_OF_TOWNSVILLE_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Total Expenses subtotal. The printed Employee Expenses + Supplies and Services + Depreciation and Amortisation Expense + Finance Costs + Other Expenses lines must sum to it exactly, and Total Revenue less Total Expenses must equal the printed Operating Result before income tax.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee Expenses',
      amount_dollars: statement.employee_expenses,
      funding_source: PORT_OF_TOWNSVILLE_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee Expenses line. A component of Total Expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and Amortisation Expense',
      amount_dollars: statement.depreciation_amortisation,
      funding_source: PORT_OF_TOWNSVILLE_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation and Amortisation Expense line. A component of Total Expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Operating Result for the Year',
      amount_dollars: statement.net_result,
      funding_source: PORT_OF_TOWNSVILLE_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed OPERATING RESULT FOR THE YEAR (net result after income tax equivalents). A result line, not an expense component; never add to revenue or expenses.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the printed revenue and expense components reconcile exactly to the printed subtotals and the printed result bridges agree at zero tolerance. The current FY2025-26 report does not pass this gate and is deferred.',
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

export interface PortOfTownsvilleConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: PortOfTownsvilleAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'port-of-townsville-annual-report.pdf';
}

/**
 * Operator escape hatch: when `PORT_OF_TOWNSVILLE_ANNUAL_REPORT_URL` is set, it
 * is used as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): PortOfTownsvilleAnnualReportLink | null {
  const url = process.env.PORT_OF_TOWNSVILLE_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Port-of-Townsville-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = portOfTownsvilleFiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `PORT_OF_TOWNSVILLE_ANNUAL_REPORT_URL filename "${filename}" has no annual-report year span; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: PORT_OF_TOWNSVILLE_SOURCE_URL,
  };
}

async function recordDeferral(
  document: PortOfTownsvilleAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: PortOfTownsvilleDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: PORT_OF_TOWNSVILLE_ID, document_url: document.url },
    {
      $set: {
        entity: PORT_OF_TOWNSVILLE_ENTITY,
        jurisdiction: PORT_OF_TOWNSVILLE_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Port of Townsville SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Port of Townsville connector. */
export function createPortOfTownsvilleConnector(
  options: PortOfTownsvilleConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: PORT_OF_TOWNSVILLE_ID,
    name: PORT_OF_TOWNSVILLE_NAME,
    publisher: PORT_OF_TOWNSVILLE_PUBLISHER,
    source_url: PORT_OF_TOWNSVILLE_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: PORT_OF_TOWNSVILLE_LICENSE,
    notes:
      'QLD SOC: Port of Townsville Limited only, a Queensland Government Owned Corporation (GOC). The latest annual report is discovered from the official annual-reports page (no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo. The statement of profit or loss prints an explicit "$" (whole-dollar) unit and printed Total Revenue and Total Expenses subtotals; the adapter requires the printed components to sum exactly to those subtotals and the printed operating-result, net-result and total-comprehensive-income bridges to agree at zero tolerance. The FY2025-26 report is deferred because its printed components and net-result bridge are one dollar short, so it emits no rows. Every row, when a future report reconciles, is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Port of Townsville is never added to government program spending, the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited, another QLD GOC, a QLD total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverPortOfTownsvilleAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Port of Townsville PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: PORT_OF_TOWNSVILLE_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Port of Townsville annual-report PDF; archived for auditable QLD SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: PortOfTownsvilleParseContext = {
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
      const parsed = parsePortOfTownsvilleExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'qld-port-of-townsville-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'qld-port-of-townsville-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Port of Townsville measure; skipped');
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
