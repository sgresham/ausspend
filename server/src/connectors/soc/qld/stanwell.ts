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
 * QLD SOC — Stanwell Corporation Limited annual-report adapter.
 *
 * This reuses the Energy Queensland/CS Energy QLD SOC pattern: one entity, one
 * audited face statement, no QLD total. Stanwell Corporation Limited is a
 * Queensland Government Owned Corporation (GOC) under the Government Owned
 * Corporations Act 1993 (Qld), not a statutory body.
 *
 * Source gate:
 * - The document is discovered from Stanwell's official publication pages (no
 *   PDF URL is hard-coded).
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The consolidated statement of profit or loss and other comprehensive
 *   income prints an explicit "$’000" unit. A table read as dollars or
 *   millions is rejected, not converted by magnitude.
 * - The statement has no printed "Total revenue" or "Total expenses"
 *   subtotal. Total revenue is the exact sum of the printed Revenue and other
 *   income + Finance income lines. Total expenses is the exact sum of the
 *   printed expense lines, net of the printed Expected credit loss
 *   (expense)/reversal and the nil Impairment reversal. Both totals are
 *   accepted only when they bridge exactly to the printed Profit/(loss) before
 *   income tax equivalent and the printed Profit/(loss) after income tax
 *   equivalent for the year. A one-thousand-dollar mismatch defers the whole
 *   document.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Stanwell
 * rows are never added to government program spending, the PNFC benchmark,
 * another QLD GOC, a QLD total, or each other.
 */

export const STANWELL_ID = 'qld-stanwell';
export const STANWELL_NAME = 'Stanwell Corporation — Annual Report';
export const STANWELL_PUBLISHER = 'Stanwell Corporation Limited';
export const STANWELL_ENTITY = 'Stanwell Corporation';
export const STANWELL_JURISDICTION = 'QLD';
export const STANWELL_LEGAL_CLASS = 'QLD Government Owned Corporation (GOC)';
/**
 * Canonical official publication page named by the QLD SOC source brief. It
 * currently returns HTTP 404; discovery falls back to the live official pages
 * that carry the same annual-report link. See docs/source-discovery/qld-stanwell.md.
 */
export const STANWELL_SOURCE_URL = 'https://www.stanwell.com/about-us/publications';
export const STANWELL_FALLBACK_URLS = [
  'https://www.stanwell.com/about-us',
  'https://www.stanwell.com/information-publication-scheme',
] as const;
export const STANWELL_LICENSE =
  '© Stanwell Corporation Limited. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const STANWELL_UNIT = 'AUD_thousands';
export const STANWELL_UNIT_LABEL = '$’000';
export const STANWELL_UNIT_TO_CENTS = 100_000;
export const STANWELL_CAVEAT =
  'Entity-level SOC statement lines for Stanwell Corporation only (Queensland Government Owned Corporation). Never add to government program spending, to the PNFC sector benchmark, to Energy Queensland, CS Energy, another QLD GOC, a QLD or national total, or to each other: total revenue is the exact sum of the printed Revenue and other income + Finance income lines; total expenses is the exact sum of the printed expense lines, net of the printed Expected credit loss (expense)/reversal and the nil Impairment reversal; total expenses includes electricity, fuel, raw materials, employee, depreciation/amortisation, other expenses, finance costs, supply-contract renegotiation and derivative fair-value lines; the net result is a loss. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface StanwellAnnualReportLink {
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

/** Stanwell names reports by the financial year span, e.g. Annual-Report-2025-26.pdf. */
const ANNUAL_REPORT_FILENAME = /annual[\s_\-–]*report[\s_\-–]*(20\d{2})\s*[-–]\s*(\d{2})(?!\d)/i;
const NON_ANNUAL_REPORT =
  /sustainability|climate|reconciliation|action[\s_\-–]*plan|performance[\s_\-–]*report|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|newsletter|submission/i;

/** Convert a filename fiscal-year span "2025-26" into the API fiscal year "2025-26". */
export function stanwellFiscalYearFromFilename(filename: string): string | null {
  const match = ANNUAL_REPORT_FILENAME.exec(filename);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || start < 2000 || start > 2100) return null;
  if (!Number.isInteger(end) || end !== (start + 1) % 100) return null;
  return `${start}-${String(end).padStart(2, '0')}`;
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
 * Parse annual-report PDF links from an official Stanwell publications page.
 * Stanwell serves PDFs from a Contentful asset host; plain `.pdf` links are
 * accepted. Sustainability, climate, submissions and newsletters are rejected.
 */
export function parseStanwellAnnualReportPdfLinks(
  html: string,
  pageUrl: string = STANWELL_SOURCE_URL,
): StanwellAnnualReportLink[] {
  const links: StanwellAnnualReportLink[] = [];
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
    const fiscalYear = stanwellFiscalYearFromFilename(filename);
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
 * Fetch the official publication pages in order and return the latest
 * annual-report PDF. The canonical `/about-us/publications` page is checked
 * first; if it is unavailable the live official pages that carry the same
 * annual-report link are used. The chosen page is recorded on the link.
 */
export async function discoverStanwellAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrls: readonly string[] = [STANWELL_SOURCE_URL, ...STANWELL_FALLBACK_URLS],
): Promise<StanwellAnnualReportLink> {
  const attempts: string[] = [];
  for (const pageUrl of pageUrls) {
    let response: Response;
    try {
      response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
    } catch (error) {
      attempts.push(`${pageUrl}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (!response.ok) {
      attempts.push(`${pageUrl}: HTTP ${response.status}`);
      continue;
    }
    const html = await response.text();
    const latest = parseStanwellAnnualReportPdfLinks(html, pageUrl)[0];
    if (latest) return latest;
    attempts.push(`${pageUrl}: no annual-report PDF link`);
  }
  throw new Error(
    `Stanwell official publication pages contain no annual-report PDF link; refusing to hard-code a URL. Tried: ${attempts.join('; ')}`,
  );
}

interface PageRow {
  y: number;
  items: PdfTextItem[];
  cells: string[];
}

function groupPageRows(items: readonly PdfTextItem[], tolerance = 4.5): PageRow[] {
  // Stanwell's statement is a single print copy in content order. Preserve
  // content order so right-aligned money cells stay attached to their label.
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

function columnAnchor(rows: readonly PageRow[], label: string): number | null {
  const row = rows.find((entry) => labelOf(entry).toLowerCase() === label.toLowerCase());
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

function findRow(rows: readonly PageRow[], label: string): PageRow | null {
  const wanted = label.toLowerCase();
  return (
    rows.find((row) => labelOf(row).toLowerCase() === wanted) ??
    rows.find((row) => labelOf(row).toLowerCase().startsWith(wanted)) ??
    null
  );
}

function rowValue(rows: readonly PageRow[], label: string, anchor: number): CellValue {
  const row = findRow(rows, label);
  return row ? cellNear(row, anchor) : { value: null, found: false, nil: false };
}

function unitSamples(rows: readonly PageRow[]): string[] {
  return rows
    .filter((row) => row.cells.some((cell) => cell.includes('$')))
    .map((row) => row.cells.join(' '));
}

export function detectStanwellUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface StanwellStatement {
  page_number: number;
  unit: UnitDetection;
  revenue_and_other_income: number;
  finance_income: number;
  total_revenue: number;
  electricity_and_energy_services: number;
  fuel_costs: number;
  raw_materials_and_consumables: number;
  employee_benefits_expense: number;
  depreciation_and_amortisation: number;
  other_expenses: number;
  finance_costs: number;
  expected_credit_loss: number;
  loss_on_supply_contract_renegotiation: number;
  impairment_reversal: number;
  derivative_fair_value_change: number;
  /** Exact sum of the printed expense lines, net of reversals. */
  total_expenses: number;
  profit_before_tax: number;
  income_tax_expense: number;
  net_result: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('consolidated statement of profit or loss') &&
      text.includes('profit/(loss) after income tax equivalent')
    ) {
      return page;
    }
  }
  return null;
}

function emptyStatement(
  page: PdfPage,
  unit: UnitDetection,
  errors: string[],
  checks: string[],
  warnings: string[],
): StanwellStatement {
  return {
    page_number: page.page_number,
    unit,
    revenue_and_other_income: 0,
    finance_income: 0,
    total_revenue: 0,
    electricity_and_energy_services: 0,
    fuel_costs: 0,
    raw_materials_and_consumables: 0,
    employee_benefits_expense: 0,
    depreciation_and_amortisation: 0,
    other_expenses: 0,
    finance_costs: 0,
    expected_credit_loss: 0,
    loss_on_supply_contract_renegotiation: 0,
    impairment_reversal: 0,
    derivative_fair_value_change: 0,
    total_expenses: 0,
    profit_before_tax: 0,
    income_tax_expense: 0,
    net_result: 0,
    checks,
    warnings,
    errors,
  };
}

export function parseStanwellStatement(page: PdfPage): StanwellStatement | null {
  const rows = groupPageRows(page.items);
  const titleRow = rows.find((row) =>
    /consolidated statement of profit or loss/i.test(row.cells.join(' ')),
  );
  if (!titleRow) return null;

  const unit = detectMoneyUnit(unitSamples(rows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Revenue and other income');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed Revenue and other income row',
    );
    return null;
  }
  if (unit.kind !== 'thousands') {
    errors.push(
      `printed unit is not explicit thousands (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $’000 statement as dollars or millions`,
    );
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);

  const revenue = read('Revenue and other income');
  const financeIncome = read('Finance income');
  const electricity = read('Electricity and energy services expense');
  const fuel = read('Fuel costs');
  const rawMaterials = read('Raw materials and consumables used');
  const employee = read('Employee benefits expense');
  const depreciation = read('Depreciation and amortisation expense');
  const otherExpenses = read('Other expenses');
  const financeCosts = read('Finance costs');
  const expectedCreditLoss = read('Expected credit loss (expense)/reversal on receivables');
  const supplyContract = read('Loss arising from the renegotiation of supply contract');
  const impairmentReversal = read('Impairment reversal');
  const derivative = read('Non hedge accounted change in fair value of derivative instruments');
  const pbt = read('Profit/(loss) before income tax equivalent (expense)/benefit');
  const tax = read('Income tax equivalent (expense)/benefit');
  const netResult = read(
    'Profit/(loss) after income tax equivalent (expense)/benefit for the year',
  );

  const required: Array<[string, CellValue]> = [
    ['Revenue and other income', revenue],
    ['Finance income', financeIncome],
    ['Electricity and energy services expense', electricity],
    ['Fuel costs', fuel],
    ['Raw materials and consumables used', rawMaterials],
    ['Employee benefits expense', employee],
    ['Depreciation and amortisation expense', depreciation],
    ['Other expenses', otherExpenses],
    ['Finance costs', financeCosts],
    ['Expected credit loss (expense)/reversal on receivables', expectedCreditLoss],
    ['Loss arising from the renegotiation of supply contract', supplyContract],
    ['Impairment reversal', impairmentReversal],
    ['Non hedge accounted change in fair value of derivative instruments', derivative],
    ['Profit/(loss) before income tax equivalent (expense)/benefit', pbt],
    ['Income tax equivalent (expense)/benefit', tax],
    ['Profit/(loss) after income tax equivalent (expense)/benefit for the year', netResult],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return emptyStatement(page, unit, errors, checks, warnings);
  }

  const expenseComponents: number[] = [
    electricity,
    fuel,
    rawMaterials,
    employee,
    depreciation,
    otherExpenses,
    financeCosts,
    expectedCreditLoss,
    supplyContract,
    impairmentReversal,
    derivative,
  ].map((cell) => cell.value as number);
  const signedExpenseTotal = expenseComponents.reduce((sum, value) => sum + value, 0);
  const totalExpenses = -signedExpenseTotal;
  const totalRevenue = (revenue.value as number) + (financeIncome.value as number);

  checks.push(
    `income components exact: ${revenue.value} + ${financeIncome.value} = ${totalRevenue} (the derived total revenue)`,
  );
  checks.push(
    `expense components exact: ${expenseComponents.join(' + ')} = ${signedExpenseTotal} (negative net expense); total expenses ${totalExpenses}`,
  );

  const pbtBridge = totalRevenue - totalExpenses;
  if (pbtBridge !== pbt.value) {
    errors.push(
      `profit-before-tax bridge mismatch: ${totalRevenue} - ${totalExpenses} = ${pbtBridge}, printed Profit/(loss) before income tax equivalent ${pbt.value}`,
    );
  } else {
    checks.push(
      `profit-before-tax bridge exact: ${totalRevenue} - ${totalExpenses} = ${pbtBridge}`,
    );
  }

  const netBridge = (pbt.value as number) + (tax.value as number);
  if (netBridge !== netResult.value) {
    errors.push(
      `net-result bridge mismatch: ${pbt.value} + ${tax.value} = ${netBridge}, printed Profit/(loss) after income tax equivalent for the year ${netResult.value}`,
    );
  } else {
    checks.push(`net-result bridge exact: ${pbt.value} + ${tax.value} = ${netBridge}`);
  }

  warnings.push(
    'the consolidated statement has no printed Total revenue or Total expenses subtotal; total revenue is the exact sum of Revenue and other income + Finance income; total expenses is the exact sum of the printed expense lines net of the printed Expected credit loss (expense)/reversal and the nil Impairment reversal, and is accepted only because both totals bridge to the printed Profit/(loss) before income tax equivalent and Profit/(loss) after income tax equivalent for the year with zero tolerance',
  );
  if (impairmentReversal.nil) {
    checks.push(
      'Impairment reversal printed as a nil marker ("-"), read as 0 in the current-year expense bridge',
    );
  }

  return {
    page_number: page.page_number,
    unit,
    revenue_and_other_income: revenue.value as number,
    finance_income: financeIncome.value as number,
    total_revenue: totalRevenue,
    electricity_and_energy_services: Math.abs(electricity.value as number),
    fuel_costs: Math.abs(fuel.value as number),
    raw_materials_and_consumables: Math.abs(rawMaterials.value as number),
    employee_benefits_expense: Math.abs(employee.value as number),
    depreciation_and_amortisation: Math.abs(depreciation.value as number),
    other_expenses: Math.abs(otherExpenses.value as number),
    finance_costs: Math.abs(financeCosts.value as number),
    expected_credit_loss: Math.abs(expectedCreditLoss.value as number),
    loss_on_supply_contract_renegotiation: Math.abs(supplyContract.value as number),
    impairment_reversal: Math.abs(impairmentReversal.value as number),
    derivative_fair_value_change: Math.abs(derivative.value as number),
    total_expenses: totalExpenses,
    profit_before_tax: pbt.value as number,
    income_tax_expense: tax.value as number,
    net_result: netResult.value as number,
    checks,
    warnings,
    errors,
  };
}

export interface StanwellParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface StanwellDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation' | 'notes';
}

export interface StanwellLineSpec {
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

export interface StanwellParseResult {
  records: SpendingRecord[];
  deferral: StanwellDeferral | null;
  statement: StanwellStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function stanwellNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${STANWELL_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * STANWELL_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: StanwellParseContext,
  spec: StanwellLineSpec,
  statement: StanwellStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${STANWELL_UNIT_LABEL} (${STANWELL_UNIT}; x${STANWELL_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; consolidated Stanwell Corporation parent; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Energy Queensland, CS Energy, another QLD GOC, a QLD total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: StanwellLineSpec,
  context: StanwellParseContext,
  statement: StanwellStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: STANWELL_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: stanwellNaturalKey(
      STANWELL_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${STANWELL_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: STANWELL_JURISDICTION,
    delivery_entity: STANWELL_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Stanwell Corporation Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: STANWELL_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: STANWELL_UNIT,
    soc_section: spec.section,
    soc_note: 'Face statement',
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

export function parseStanwellExtraction(
  extraction: PdfExtraction,
  context: StanwellParseContext,
): StanwellParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
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
  const statement = parseStanwellStatement(statementPage);
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
      pages_used: [statementPage.page_number],
    };
  }
  warnings.push(...statement.warnings);
  if (statement.unit.kind !== 'thousands') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit thousands: ${statement.unit.reason}`,
        phase: 'unit',
      },
      statement,
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
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }

  const lineSpecs: StanwellLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: STANWELL_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Derived from the printed Revenue and other income + Finance income lines. No printed Total revenue subtotal exists; the derived total is accepted only because it bridges exactly to the printed Profit/(loss) before income tax equivalent.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: STANWELL_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Exact sum of the printed expense lines net of the printed Expected credit loss (expense)/reversal and the nil Impairment reversal (electricity and energy services, fuel, raw materials, employee benefits, depreciation and amortisation, other expenses, finance costs, supply-contract renegotiation and derivative fair-value change). Accepted only because Total revenue less total expenses equals the printed Profit/(loss) before income tax equivalent.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expense',
      amount_thousands: statement.employee_benefits_expense,
      funding_source: STANWELL_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail: 'Printed Employee benefits expense. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation expense',
      amount_thousands: statement.depreciation_and_amortisation,
      funding_source: STANWELL_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Depreciation and amortisation expense. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit/(loss) after income tax equivalent (expense)/benefit for the year',
      amount_thousands: statement.net_result,
      funding_source: STANWELL_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit/(loss) after income tax equivalent (expense)/benefit for the year (net result), a printed negative retained as a non-negative magnitude with soc_printed_sign negative. A result line, not an expense component; never add to revenue or expenses.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; total revenue and total expenses are derived from the printed lines and reconcile exactly to the printed profit-before-tax and net-result bridges.',
  );
  return {
    records,
    deferral: null,
    statement,
    checks: statement.checks,
    warnings,
    pages_used: [statementPage.page_number],
  };
}

export interface StanwellConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: StanwellAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'stanwell-annual-report.pdf';
}

/**
 * Operator escape hatch: when `STANWELL_ANNUAL_REPORT_URL` is set, it is used
 * as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): StanwellAnnualReportLink | null {
  const url = process.env.STANWELL_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Stanwell-Corporation-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = stanwellFiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `STANWELL_ANNUAL_REPORT_URL filename "${filename}" has no report-year span; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: STANWELL_SOURCE_URL,
  };
}

async function recordDeferral(
  document: StanwellAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: StanwellDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: STANWELL_ID, document_url: document.url },
    {
      $set: {
        entity: STANWELL_ENTITY,
        jurisdiction: STANWELL_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Stanwell SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Stanwell connector. */
export function createStanwellConnector(options: StanwellConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: STANWELL_ID,
    name: STANWELL_NAME,
    publisher: STANWELL_PUBLISHER,
    source_url: STANWELL_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: STANWELL_LICENSE,
    notes:
      'QLD SOC: Stanwell Corporation Limited only, a Queensland Government Owned Corporation (GOC). The latest annual report is discovered from Stanwell\'s official publication pages (no hard-coded PDF URL); the canonical /about-us/publications page currently returns HTTP 404, so discovery falls back to the official /about-us and /information-publication-scheme pages that carry the same link. The exact PDF is SHA-256 archived outside the repo. The consolidated statement prints an explicit $’000 unit; it has no printed Total revenue or Total expenses subtotal, so total revenue is the exact sum of Revenue and other income + Finance income and total expenses is the exact sum of the printed expense lines net of the printed Expected credit loss (expense)/reversal and the nil Impairment reversal. Both are accepted only when they bridge to the printed Profit/(loss) before income tax equivalent and Profit/(loss) after income tax equivalent for the year with zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Stanwell is never added to government program spending, the PNFC benchmark, Energy Queensland, CS Energy, another QLD GOC, a QLD total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverStanwellAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Stanwell PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: STANWELL_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Stanwell annual-report PDF; archived for auditable QLD SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: StanwellParseContext = {
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
      const parsed = parseStanwellExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'qld-stanwell-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'qld-stanwell-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Stanwell measure; skipped');
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
