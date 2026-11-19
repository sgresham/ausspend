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
 * WA SOC — Mid West Ports annual-report adapter.
 *
 * This is the next WA Government Trading Enterprise (GTE) pilot and reuses the
 * WA Water Corporation/Synergy/Western Power/Horizon Power/Fremantle
 * Ports/DevelopmentWA/Southern Ports/Busselton Water SOC pattern: one entity,
 * one audited face statement, no jurisdiction total. Mid West Ports Authority
 * is a WA GTE under the Government Trading Enterprises Act 2023 (WA) and the
 * Port Authorities Act 1999 (WA), not a Queensland GOC or an NSW SOC.
 *
 * Source gate:
 * - The latest report is discovered from the official annual-reports page; no
 *   PDF URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The Statement of Profit or Loss and Other Comprehensive Income prints an
 *   explicit "$'000" unit for the 2026 and 2025 columns. A table read as dollars
 *   or millions is rejected, not converted by magnitude.
 * - The face statement has no printed Total income or Total expenses subtotal.
 *   Total income is the exact sum of Revenue + Other income; total expenses is
 *   the exact sum of the printed expense lines. Both are accepted only when
 *   total income less total expenses equals the printed Profit before income tax
 *   and that result plus income tax equals Profit for the year, with zero
 *   tolerance.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Mid West
 * Ports rows are never added to government program spending, the PNFC
 * benchmark, Water Corporation, Synergy, Western Power, Horizon Power,
 * Fremantle Ports, DevelopmentWA, Southern Ports, Busselton Water, another WA
 * GTE, a QLD/NSW SOC, a WA total, or each other.
 */

export const MID_WEST_PORTS_ID = 'wa-mid-west-ports';
export const MID_WEST_PORTS_NAME = 'Mid West Ports — Annual Report';
export const MID_WEST_PORTS_PUBLISHER = 'Mid West Ports Authority';
export const MID_WEST_PORTS_ENTITY = 'Mid West Ports';
export const MID_WEST_PORTS_JURISDICTION = 'WA';
export const MID_WEST_PORTS_LEGAL_CLASS =
  'WA Government Trading Enterprise (GTE) — Government Trading Enterprises Act 2023 (WA)';
/** Canonical official annual-reports page. Annual-report PDFs are discovered from it. */
export const MID_WEST_PORTS_SOURCE_URL =
  'https://www.midwestports.com.au/our-port/publications/annual-reports.aspx';
export const MID_WEST_PORTS_LICENSE =
  '© Mid West Ports Authority. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const MID_WEST_PORTS_UNIT = 'AUD_thousands';
export const MID_WEST_PORTS_UNIT_LABEL = "$'000";
export const MID_WEST_PORTS_UNIT_TO_CENTS = 100_000;
export const MID_WEST_PORTS_CAVEAT =
  'Entity-level SOC statement lines for Mid West Ports only (Mid West Ports Authority, a WA Government Trading Enterprise under the Government Trading Enterprises Act 2023 (WA)). Never add to government program spending, to the PNFC sector benchmark, to Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, Busselton Water, another WA GTE, to a QLD/NSW SOC, a WA or national total, or to each other: total revenue is the exact sum of Revenue + Other income (no printed Total income subtotal); total expenses is the exact sum of the printed expense lines (no printed Total expenses subtotal); employee benefits and depreciation/amortisation/impairment are printed components of total expenses; the net result is the printed Profit for the year. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface MidWestPortsAnnualReportLink {
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
  /handbook|trade[\s_\-–]*statistics|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|corporate[\s_\-–]*plan/i;

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

/** Convert a Mid West Ports annual-report filename to the API fiscal year. */
export function midWestPortsFiscalYearFromFilename(filename: string): string | null {
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
 * Parse annual-report PDF links from the official annual-reports page. A link
 * is accepted only when its filename contains "annual report" and a year; port
 * handbooks, trade statistics, corporate plans and the SCI are rejected.
 */
export function parseMidWestPortsAnnualReportPdfLinks(
  html: string,
  pageUrl: string = MID_WEST_PORTS_SOURCE_URL,
): MidWestPortsAnnualReportLink[] {
  const links: MidWestPortsAnnualReportLink[] = [];
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
    const fiscalYear = midWestPortsFiscalYearFromFilename(filename);
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
export async function discoverMidWestPortsAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = MID_WEST_PORTS_SOURCE_URL,
): Promise<MidWestPortsAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (error) {
    throw new Error(
      `Mid West Ports annual-reports page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Mid West Ports annual-reports page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parseMidWestPortsAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Mid West Ports annual-reports page contains no annual-report PDF link; refusing to hard-code a URL',
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

export function detectMidWestPortsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface MidWestPortsStatement {
  page_number: number;
  unit: UnitDetection;
  revenue: number;
  other_income: number;
  total_income: number;
  employee_expenses: number;
  supplies_services: number;
  asset_maintenance: number;
  government_charges: number;
  utilities: number;
  depreciation_amortisation_impairment: number;
  insurance: number;
  finance_costs: number;
  other_expenses: number;
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
      text.includes('statement of profit or loss and other comprehensive income') &&
      text.includes('employee benefit expense') &&
      text.includes('profit before income tax') &&
      text.includes('profit for the year')
    ) {
      return page;
    }
  }
  return null;
}

export function parseMidWestPortsStatement(facePage: PdfPage): MidWestPortsStatement | null {
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

  const revenue = read('Revenue');
  const otherIncome = read('Other income');
  const employee = read('Employee benefit expense');
  const supplies = read('Supplies and services');
  const maintenance = read('Asset maintenance');
  const governmentCharges = read('Government charges');
  const utilities = read('Utilities');
  const depreciation = read('Depreciation, amortisation and impairment');
  const insurance = read('Insurance');
  const financeCosts = read('Finance costs');
  const otherExpenses = read('Other expenses');
  const profitBeforeTax = read('Profit before income tax');
  const incomeTax = read('Income tax expense');
  const netResult = read('Profit for the year');

  const required: Array<[string, CellValue]> = [
    ['Revenue', revenue],
    ['Other income', otherIncome],
    ['Employee benefit expense', employee],
    ['Supplies and services', supplies],
    ['Asset maintenance', maintenance],
    ['Government charges', governmentCharges],
    ['Utilities', utilities],
    ['Depreciation, amortisation and impairment', depreciation],
    ['Insurance', insurance],
    ['Finance costs', financeCosts],
    ['Other expenses', otherExpenses],
    ['Profit before income tax', profitBeforeTax],
    ['Income tax expense', incomeTax],
    ['Profit for the year', netResult],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const revenueValue = revenue.value as number;
  const otherIncomeValue = otherIncome.value as number;
  const employeeValue = Math.abs(employee.value as number);
  const suppliesValue = Math.abs(supplies.value as number);
  const maintenanceValue = Math.abs(maintenance.value as number);
  const governmentValue = Math.abs(governmentCharges.value as number);
  const utilitiesValue = Math.abs(utilities.value as number);
  const depreciationValue = Math.abs(depreciation.value as number);
  const insuranceValue = Math.abs(insurance.value as number);
  const financeValue = Math.abs(financeCosts.value as number);
  const otherExpensesValue = Math.abs(otherExpenses.value as number);
  const profitBeforeTaxValue = profitBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;

  const totalIncome = revenueValue + otherIncomeValue;
  checks.push(`total income exact: ${revenueValue} + ${otherIncomeValue} = ${totalIncome}`);

  const expenseComponents = [
    employeeValue,
    suppliesValue,
    maintenanceValue,
    governmentValue,
    utilitiesValue,
    depreciationValue,
    insuranceValue,
    financeValue,
    otherExpensesValue,
  ];
  const totalExpenses = expenseComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `total expenses exact: ${expenseComponents.join(' + ')} = ${totalExpenses} (derived; no printed Total expenses subtotal)`,
  );

  const profitBeforeTaxBridge = totalIncome - totalExpenses;
  checks.push(
    `profit-before-tax bridge exact: ${totalIncome} - ${totalExpenses} = ${profitBeforeTaxBridge} (printed ${profitBeforeTaxValue})`,
  );
  if (profitBeforeTaxBridge !== profitBeforeTaxValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${totalIncome} - ${totalExpenses} = ${profitBeforeTaxBridge}, printed Profit before income tax ${profitBeforeTaxValue}`,
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

  warnings.push(
    "the Statement of Profit or Loss and Other Comprehensive Income prints an explicit $'000 unit and two reporting-year columns; the adapter reads the 2026 column only. It has no printed Total income or Total expenses subtotal, so total income is the exact sum of Revenue + Other income and total expenses is the exact sum of the printed expense lines; both are accepted only because the Profit before income tax and Profit for the year bridges agree at zero tolerance.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    revenue: revenueValue,
    other_income: otherIncomeValue,
    total_income: totalIncome,
    employee_expenses: employeeValue,
    supplies_services: suppliesValue,
    asset_maintenance: maintenanceValue,
    government_charges: governmentValue,
    utilities: utilitiesValue,
    depreciation_amortisation_impairment: depreciationValue,
    insurance: insuranceValue,
    finance_costs: financeValue,
    other_expenses: otherExpensesValue,
    total_expenses: totalExpenses,
    profit_before_tax: profitBeforeTaxValue,
    income_tax: Math.abs(taxValue),
    net_result: netValue,
    checks,
    warnings,
    errors,
  };
}

export interface MidWestPortsParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface MidWestPortsDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation';
}

export interface MidWestPortsLineSpec {
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

export interface MidWestPortsParseResult {
  records: SpendingRecord[];
  deferral: MidWestPortsDeferral | null;
  statement: MidWestPortsStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function midWestPortsNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${MID_WEST_PORTS_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * MID_WEST_PORTS_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: MidWestPortsParseContext,
  spec: MidWestPortsLineSpec,
  statement: MidWestPortsStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${MID_WEST_PORTS_UNIT_LABEL} (${MID_WEST_PORTS_UNIT}; x${MID_WEST_PORTS_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    '2026 column only (prior column never added); entity-level SOC statement line; single Mid West Ports entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, Busselton Water, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: MidWestPortsLineSpec,
  context: MidWestPortsParseContext,
  statement: MidWestPortsStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: MID_WEST_PORTS_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: midWestPortsNaturalKey(
      MID_WEST_PORTS_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${MID_WEST_PORTS_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: MID_WEST_PORTS_JURISDICTION,
    delivery_entity: MID_WEST_PORTS_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Mid West Ports Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: MID_WEST_PORTS_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: MID_WEST_PORTS_UNIT,
    soc_section: spec.section,
    soc_note: 'Statement of Profit or Loss and Other Comprehensive Income',
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

export function parseMidWestPortsExtraction(
  extraction: PdfExtraction,
  context: MidWestPortsParseContext,
): MidWestPortsParseResult {
  const warnings: string[] = [];
  const facePage = findFaceStatementPage(extraction.pages);
  if (!facePage) {
    return {
      records: [],
      deferral: {
        reason:
          'no parseable statement of profit or loss and other comprehensive income found in the PDF',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const statement = parseMidWestPortsStatement(facePage);
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

  const lineSpecs: MidWestPortsLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_income,
      funding_source: MID_WEST_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Exact sum of the printed Revenue + Other income lines. No printed Total income subtotal exists on the face statement; the derived total is accepted only because it bridges to the printed Profit before income tax and Profit for the year.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: MID_WEST_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Exact sum of the printed Employee benefit expense + Supplies and services + Asset maintenance + Government charges + Utilities + Depreciation, amortisation and impairment + Insurance + Finance costs + Other expenses lines. No printed Total expenses subtotal exists on the face statement; the derived total is accepted only because it bridges to the printed Profit before income tax and Profit for the year.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefit expense',
      amount_thousands: statement.employee_expenses,
      funding_source: MID_WEST_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee benefit expense line. A component of total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation, amortisation and impairment',
      amount_thousands: statement.depreciation_amortisation_impairment,
      funding_source: MID_WEST_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation, amortisation and impairment line. A component of total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit for the year',
      amount_thousands: statement.net_result,
      funding_source: MID_WEST_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit for the year (net result after income tax). A result line, not an expense component; never add to revenue or expenses. 2026 column only.',
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

export interface MidWestPortsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: MidWestPortsAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'mid-west-ports-annual-report.pdf';
}

/**
 * Operator escape hatch: when `WA_MID_WEST_PORTS_ANNUAL_REPORT_URL` is set, it
 * is used as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): MidWestPortsAnnualReportLink | null {
  const url = process.env.WA_MID_WEST_PORTS_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Mid-West-Ports-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = midWestPortsFiscalYearFromFilename(filename) ?? '2025-26';
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: MID_WEST_PORTS_SOURCE_URL,
  };
}

async function recordDeferral(
  document: MidWestPortsAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: MidWestPortsDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: MID_WEST_PORTS_ID, document_url: document.url },
    {
      $set: {
        entity: MID_WEST_PORTS_ENTITY,
        jurisdiction: MID_WEST_PORTS_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Mid West Ports SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Mid West Ports connector. */
export function createMidWestPortsConnector(options: MidWestPortsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: MID_WEST_PORTS_ID,
    name: MID_WEST_PORTS_NAME,
    publisher: MID_WEST_PORTS_PUBLISHER,
    source_url: MID_WEST_PORTS_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: MID_WEST_PORTS_LICENSE,
    notes:
      'WA SOC: Mid West Ports only (Mid West Ports Authority), a WA Government Trading Enterprise (Government Trading Enterprises Act 2023 (WA)). The latest annual report is discovered from the official annual-reports page (no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo. The Statement of Profit or Loss and Other Comprehensive Income prints an explicit $\'000 unit and two reporting-year columns; the adapter reads the 2026 column only. It has no printed Total income or Total expenses subtotal, so total income is the exact sum of Revenue + Other income and total expenses is the exact sum of the printed expense lines, accepted only when they bridge to the printed Profit before income tax and Profit for the year at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Mid West Ports is never added to government program spending, the PNFC benchmark, Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, Busselton Water, another WA GTE, a QLD/NSW SOC, a WA total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverMidWestPortsAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Mid West Ports PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: MID_WEST_PORTS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Mid West Ports annual-report PDF; archived for auditable WA SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: MidWestPortsParseContext = {
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
      const parsed = parseMidWestPortsExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'wa-mid-west-ports-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'wa-mid-west-ports-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Mid West Ports measure; skipped');
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
