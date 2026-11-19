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
 * WA SOC — Fremantle Ports annual-report adapter.
 *
 * This is the next WA Government Trading Enterprise (GTE) pilot and reuses the
 * WA Water Corporation/Synergy/Western Power/Horizon Power SOC pattern: one
 * entity, one audited face statement, no jurisdiction total. Fremantle Ports is
 * the Fremantle Port Authority, a WA GTE under the Government Trading
 * Enterprises Act 2023 (WA) and the Port Authorities Act 1999 (WA), not a
 * Queensland GOC or an NSW SOC.
 *
 * Source gate:
 * - The latest report is discovered from Fremantle Ports' official publications
 *   page; no PDF URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The Statement of Comprehensive Income prints an explicit "$'000" unit for
 *   the 2026 and 2025 columns. A table read as dollars or millions is rejected,
 *   not converted by magnitude.
 * - The statement has no printed Total income or Total expenses subtotal. Total
 *   income is the exact sum of Revenue + Interest income; total expenses is the
 *   exact sum of the printed expense lines. Both are accepted only when Total
 *   income less total expenses equals the printed Profit before income tax and
 *   that result plus income tax equals Profit after income tax, with zero
 *   tolerance.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Fremantle
 * Ports rows are never added to government program spending, the PNFC
 * benchmark, Water Corporation, Synergy, Western Power, Horizon Power, another
 * WA GTE, a QLD/NSW SOC, a WA total, or each other.
 */

export const FREMANTLE_PORTS_ID = 'wa-fremantle-ports';
export const FREMANTLE_PORTS_NAME = 'Fremantle Ports — Annual Report';
export const FREMANTLE_PORTS_PUBLISHER = 'Fremantle Port Authority (Fremantle Ports)';
export const FREMANTLE_PORTS_ENTITY = 'Fremantle Ports';
export const FREMANTLE_PORTS_JURISDICTION = 'WA';
export const FREMANTLE_PORTS_LEGAL_CLASS =
  'WA Government Trading Enterprise (GTE) — Government Trading Enterprises Act 2023 (WA)';
/** Canonical official publications page. Annual-report PDFs are discovered from it. */
export const FREMANTLE_PORTS_SOURCE_URL = 'https://www.fremantleports.com.au/publications';
export const FREMANTLE_PORTS_LICENSE =
  '© Fremantle Ports. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const FREMANTLE_PORTS_UNIT = 'AUD_thousands';
export const FREMANTLE_PORTS_UNIT_LABEL = "$'000";
export const FREMANTLE_PORTS_UNIT_TO_CENTS = 100_000;
export const FREMANTLE_PORTS_CAVEAT =
  'Entity-level SOC statement lines for Fremantle Ports only (Fremantle Port Authority, a WA Government Trading Enterprise under the Government Trading Enterprises Act 2023 (WA)). Never add to government program spending, to the PNFC sector benchmark, to Water Corporation, Synergy, Western Power, Horizon Power, another WA GTE, to a QLD/NSW SOC, a WA or national total, or to each other: total revenue is the exact sum of Revenue + Interest income (no printed Total income subtotal); total expenses is the exact sum of the printed expense lines (no printed Total expenses subtotal); employee benefits and depreciation/amortisation are printed components of total expenses; the net result is the printed Profit after income tax. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface FremantlePortsAnnualReportLink {
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
  /spreads|trade[\s_\-–]*overview|sustainability|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|corporate[\s_\-–]*plan/i;

function fiscalYearEnding(yearRaw: string): string | null {
  const end = Number(yearRaw);
  if (!Number.isInteger(end) || end < 2001 || end > 2100) return null;
  const start = end - 1;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

/** Convert a Fremantle Ports annual-report filename (year ended) to the API fiscal year. */
export function fremantlePortsFiscalYearFromFilename(filename: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(filename) || NON_ANNUAL_REPORT.test(filename)) return null;
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
 * Parse annual-report PDF links from the official publications page. The page
 * lists each report twice (with and without a `?sfvrsn` query), so links are
 * de-duplicated by pathname (the first, queryless URL wins). Spreads versions,
 * trade overviews, sustainability reports and Statements of Corporate Intent are
 * rejected by name.
 */
export function parseFremantlePortsAnnualReportPdfLinks(
  html: string,
  pageUrl: string = FREMANTLE_PORTS_SOURCE_URL,
): FremantlePortsAnnualReportLink[] {
  const links: FremantlePortsAnnualReportLink[] = [];
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
    const fiscalYear = fremantlePortsFiscalYearFromFilename(filename);
    if (!fiscalYear) continue;
    const key = `${url.origin}${url.pathname}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [start, end] = fiscalYear.split('-');
    links.push({
      url: `${url.origin}${url.pathname}`,
      filename,
      fiscal_year: fiscalYear,
      title: `Annual Report ${start}–${end}`,
      discovery_page: pageUrl,
    });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/**
 * Fetch the official publications page and return its newest annual-report PDF.
 * No PDF URL is hard-coded; a page with no annual-report link is an error.
 */
export async function discoverFremantlePortsAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = FREMANTLE_PORTS_SOURCE_URL,
): Promise<FremantlePortsAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (error) {
    throw new Error(
      `Fremantle Ports publications page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Fremantle Ports publications page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parseFremantlePortsAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Fremantle Ports publications page contains no annual-report PDF link; refusing to hard-code a URL',
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

/** Label text is everything left of the note-reference column (x < 500). */
function labelOf(row: PageRow): string {
  return row.items
    .filter((item) => item.x < 500)
    .map((item) => item.str.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function isMoneyItem(item: PdfTextItem): boolean {
  const text = item.str.trim();
  return /^(?:-|–|—)$/.test(text) || parseAmountCell(text).value !== null;
}

/**
 * Money cells for the Statement of Comprehensive Income sit in the left half of
 * the spread (x >= 650), before the Statement of Financial Position block
 * (x >= 900).
 */
function moneyItems(row: PageRow): PdfTextItem[] {
  return row.items.filter((item) => item.x >= 650 && item.x < 900 && isMoneyItem(item));
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

export function detectFremantlePortsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface FremantlePortsStatement {
  page_number: number;
  unit: UnitDetection;
  revenue: number;
  interest_income: number;
  total_income: number;
  employee_benefits: number;
  service_maintenance: number;
  contracts_consultants: number;
  government_charges: number;
  utilities: number;
  insurance: number;
  other_expenses: number;
  depreciation_amortisation: number;
  finance_costs: number;
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
      text.includes('employee benefits') &&
      text.includes('depreciation and amortisation') &&
      text.includes('profit before income tax') &&
      text.includes('profit after income tax for the year')
    ) {
      return page;
    }
  }
  return null;
}

export function parseFremantlePortsStatement(
  facePage: PdfPage,
): FremantlePortsStatement | null {
  const rawRows = groupPageRows(facePage.items);
  const rows = logicalRows(rawRows);
  const unit = detectMoneyUnit(unitSamples(rawRows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Revenue');
  if (anchor === null) {
    errors.push(
      'statement 2026 money column could not be anchored from the printed revenue row',
    );
    return null;
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);

  const revenue = read('Revenue');
  const interestIncome = read('Interest income');
  const employee = read('Employee benefits');
  const serviceMaintenance = read('Service and maintenance');
  const contracts = read('Contracts and consultants');
  const governmentCharges = read('Government charges');
  const utilities = read('Utilities');
  const insurance = read('Insurance');
  const otherExpenses = read('Other expenses');
  const depreciation = read('Depreciation and amortisation');
  const financeCosts = read('Finance costs');
  const profitBeforeTax = read('Profit before income tax');
  const incomeTax = read('Income tax expense');
  const netResult = read('Profit after income tax for the year');

  const required: Array<[string, CellValue]> = [
    ['Revenue', revenue],
    ['Interest income', interestIncome],
    ['Employee benefits', employee],
    ['Service and maintenance', serviceMaintenance],
    ['Contracts and consultants', contracts],
    ['Government charges', governmentCharges],
    ['Utilities', utilities],
    ['Insurance', insurance],
    ['Other expenses', otherExpenses],
    ['Depreciation and amortisation', depreciation],
    ['Finance costs', financeCosts],
    ['Profit before income tax', profitBeforeTax],
    ['Income tax expense', incomeTax],
    ['Profit after income tax for the year', netResult],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const revenueValue = revenue.value as number;
  const interestValue = interestIncome.value as number;
  const employeeValue = Math.abs(employee.value as number);
  const serviceValue = Math.abs(serviceMaintenance.value as number);
  const contractsValue = Math.abs(contracts.value as number);
  const governmentValue = Math.abs(governmentCharges.value as number);
  const utilitiesValue = Math.abs(utilities.value as number);
  const insuranceValue = Math.abs(insurance.value as number);
  const otherExpensesValue = Math.abs(otherExpenses.value as number);
  const depreciationValue = Math.abs(depreciation.value as number);
  const financeValue = Math.abs(financeCosts.value as number);
  const profitBeforeTaxValue = profitBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;

  const totalIncome = revenueValue + interestValue;
  checks.push(`total income exact: ${revenueValue} + ${interestValue} = ${totalIncome}`);

  const expenseComponents = [
    employeeValue,
    serviceValue,
    contractsValue,
    governmentValue,
    utilitiesValue,
    insuranceValue,
    otherExpensesValue,
    depreciationValue,
    financeValue,
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
      `net-result bridge mismatch: ${profitBeforeTaxValue} + ${taxValue} = ${netBridge}, printed Profit after income tax for the year ${netValue}`,
    );
  }

  warnings.push(
    "the Statement of Comprehensive Income prints an explicit $'000 unit and two reporting-year columns; the adapter reads the 2026 column only. It has no printed Total income or Total expenses subtotal, so total income is the exact sum of Revenue + Interest income and total expenses is the exact sum of the printed expense lines; both are accepted only because the Profit before income tax and Profit after income tax bridges agree at zero tolerance.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    revenue: revenueValue,
    interest_income: interestValue,
    total_income: totalIncome,
    employee_benefits: employeeValue,
    service_maintenance: serviceValue,
    contracts_consultants: contractsValue,
    government_charges: governmentValue,
    utilities: utilitiesValue,
    insurance: insuranceValue,
    other_expenses: otherExpensesValue,
    depreciation_amortisation: depreciationValue,
    finance_costs: financeValue,
    total_expenses: totalExpenses,
    profit_before_tax: profitBeforeTaxValue,
    income_tax: Math.abs(taxValue),
    net_result: netValue,
    checks,
    warnings,
    errors,
  };
}

export interface FremantlePortsParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface FremantlePortsDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation';
}

export interface FremantlePortsLineSpec {
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

export interface FremantlePortsParseResult {
  records: SpendingRecord[];
  deferral: FremantlePortsDeferral | null;
  statement: FremantlePortsStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function fremantlePortsNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${FREMANTLE_PORTS_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * FREMANTLE_PORTS_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: FremantlePortsParseContext,
  spec: FremantlePortsLineSpec,
  statement: FremantlePortsStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${FREMANTLE_PORTS_UNIT_LABEL} (${FREMANTLE_PORTS_UNIT}; x${FREMANTLE_PORTS_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    '2026 column only (prior column never added); entity-level SOC statement line; single Fremantle Ports entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Water Corporation, Synergy, Western Power, Horizon Power, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: FremantlePortsLineSpec,
  context: FremantlePortsParseContext,
  statement: FremantlePortsStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: FREMANTLE_PORTS_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: fremantlePortsNaturalKey(
      FREMANTLE_PORTS_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${FREMANTLE_PORTS_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: FREMANTLE_PORTS_JURISDICTION,
    delivery_entity: FREMANTLE_PORTS_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Fremantle Ports Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: FREMANTLE_PORTS_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: FREMANTLE_PORTS_UNIT,
    soc_section: spec.section,
    soc_note: 'Statement of Comprehensive Income',
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

export function parseFremantlePortsExtraction(
  extraction: PdfExtraction,
  context: FremantlePortsParseContext,
): FremantlePortsParseResult {
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
  const statement = parseFremantlePortsStatement(facePage);
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

  const lineSpecs: FremantlePortsLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_income,
      funding_source: FREMANTLE_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Exact sum of the printed Revenue + Interest income lines. No printed Total income subtotal exists on the face statement; the derived total is accepted only because it bridges to the printed Profit before income tax and Profit after income tax.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: FREMANTLE_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Exact sum of the printed Employee benefits + Service and maintenance + Contracts and consultants + Government charges + Utilities + Insurance + Other expenses + Depreciation and amortisation + Finance costs lines. No printed Total expenses subtotal exists on the face statement; the derived total is accepted only because it bridges to the printed Profit before income tax and Profit after income tax.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits',
      amount_thousands: statement.employee_benefits,
      funding_source: FREMANTLE_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee benefits line. A component of total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: FREMANTLE_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation and amortisation line. A component of total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit after income tax for the year',
      amount_thousands: statement.net_result,
      funding_source: FREMANTLE_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit after income tax for the year (net result). A result line, not an expense component; never add to revenue or expenses. 2026 column only.',
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

export interface FremantlePortsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: FremantlePortsAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'fremantle-ports-annual-report.pdf';
}

/**
 * Operator escape hatch: when `WA_FREMANTLE_PORTS_ANNUAL_REPORT_URL` is set, it
 * is used as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): FremantlePortsAnnualReportLink | null {
  const url = process.env.WA_FREMANTLE_PORTS_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Fremantle-Ports-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = fremantlePortsFiscalYearFromFilename(filename) ?? '2025-26';
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: FREMANTLE_PORTS_SOURCE_URL,
  };
}

async function recordDeferral(
  document: FremantlePortsAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: FremantlePortsDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: FREMANTLE_PORTS_ID, document_url: document.url },
    {
      $set: {
        entity: FREMANTLE_PORTS_ENTITY,
        jurisdiction: FREMANTLE_PORTS_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Fremantle Ports SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Fremantle Ports connector. */
export function createFremantlePortsConnector(
  options: FremantlePortsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: FREMANTLE_PORTS_ID,
    name: FREMANTLE_PORTS_NAME,
    publisher: FREMANTLE_PORTS_PUBLISHER,
    source_url: FREMANTLE_PORTS_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: FREMANTLE_PORTS_LICENSE,
    notes:
      'WA SOC: Fremantle Ports only (Fremantle Port Authority), a WA Government Trading Enterprise (Government Trading Enterprises Act 2023 (WA)). The latest annual report is discovered from the official publications page (no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo. The Statement of Comprehensive Income prints an explicit $\'000 unit and two reporting-year columns; the adapter reads the 2026 column only. It has no printed Total income or Total expenses subtotal, so total income is the exact sum of Revenue + Interest income and total expenses is the exact sum of the printed expense lines, accepted only when they bridge to the printed Profit before income tax and Profit after income tax at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Fremantle Ports is never added to government program spending, the PNFC benchmark, Water Corporation, Synergy, Western Power, Horizon Power, another WA GTE, a QLD/NSW SOC, a WA total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverFremantlePortsAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Fremantle Ports PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: FREMANTLE_PORTS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Fremantle Ports annual-report PDF; archived for auditable WA SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: FremantlePortsParseContext = {
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
      const parsed = parseFremantlePortsExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'wa-fremantle-ports-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'wa-fremantle-ports-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Fremantle Ports measure; skipped');
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
