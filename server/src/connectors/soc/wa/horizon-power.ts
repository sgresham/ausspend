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
 * WA SOC — Horizon Power annual-report adapter.
 *
 * This is the fourth WA Government Trading Enterprise (GTE) pilot and reuses
 * the WA Water Corporation/Synergy/Western Power SOC pattern: one entity, one
 * audited face statement, no jurisdiction total. Horizon Power is Regional
 * Power Corporation trading as Horizon Power, a WA GTE under the Government
 * Trading Enterprises Act 2023 (WA), not a Queensland GOC or an NSW SOC.
 *
 * Source gate:
 * - Horizon Power's publications pages are behind a Cloudflare HTML challenge
 *   from the ingestion host (HTTP 403). The connector first tries the official
 *   publications page; when it is blocked or contains no annual-report PDF, it
 *   uses the documented official PDF copy on Horizon Power's own CDN
 *   (…/globalassets/media/documents/annual-reports/20252026/…). The exact PDF is
 *   never hard-coded as the only path for an accessible site.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The Statement of comprehensive income prints an explicit "$'000" unit for
 *   the 30 June 2026 and 2025 columns. A table read as dollars or millions is
 *   rejected, not converted by magnitude.
 * - The statement has no printed Total expenses subtotal. Total expenses is the
 *   exact sum of the printed expense lines and is accepted only when Total
 *   income less that sum equals the printed Profit before income tax equivalent
 *   expense and that result plus the printed income tax equals Profit for the
 *   year, with zero tolerance.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Horizon
 * Power rows are never added to government program spending, the PNFC
 * benchmark, Water Corporation, Synergy, Western Power, another WA GTE, a
 * QLD/NSW SOC, a WA total, or each other.
 */

export const HORIZON_POWER_ID = 'wa-horizon-power';
export const HORIZON_POWER_NAME = 'Horizon Power — Annual Report';
export const HORIZON_POWER_PUBLISHER = 'Regional Power Corporation (Horizon Power)';
export const HORIZON_POWER_ENTITY = 'Horizon Power';
export const HORIZON_POWER_JURISDICTION = 'WA';
export const HORIZON_POWER_LEGAL_CLASS =
  'WA Government Trading Enterprise (GTE) — Government Trading Enterprises Act 2023 (WA)';
/** Canonical official publications page. It is Cloudflare-blocked (HTTP 403). */
export const HORIZON_POWER_SOURCE_URL =
  'https://www.horizonpower.com.au/about-horizon-power/publications/';
/**
 * Documented official fallback: the FY2025-26 annual-report PDF on Horizon
 * Power's own globalassets CDN. The HTML publications page is
 * Cloudflare-blocked (HTTP 403), but this official PDF path returns HTTP 200.
 * Update this pin when a newer report is published.
 */
export const HORIZON_POWER_OFFICIAL_FALLBACK_URL =
  'https://www.horizonpower.com.au/globalassets/media/documents/annual-reports/20252026/horizon-power-annual-report-2026.pdf';
export const HORIZON_POWER_LICENSE =
  '© Horizon Power (Regional Power Corporation). Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const HORIZON_POWER_UNIT = 'AUD_thousands';
export const HORIZON_POWER_UNIT_LABEL = "$'000";
export const HORIZON_POWER_UNIT_TO_CENTS = 100_000;
export const HORIZON_POWER_CAVEAT =
  'Entity-level SOC statement lines for Horizon Power only (Regional Power Corporation, a WA Government Trading Enterprise under the Government Trading Enterprises Act 2023 (WA)). Never add to government program spending, to the PNFC sector benchmark, to Water Corporation, Synergy, Western Power, another WA GTE, to a QLD/NSW SOC, a WA or national total, or to each other: total revenue is the printed Total income line; total expenses is the exact sum of the printed expense lines (no printed Total expenses subtotal); employee benefits and depreciation/amortisation are printed components of total expenses; the net result is the printed Profit for the year. Provisional and unverified.';

/** A discovered annual-report PDF. */
export interface HorizonPowerAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
  access: 'official' | 'official-pdf-fallback';
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

const ANNUAL_REPORT_MARKER = /annual[\s_\-–]*report/i;
const NON_ANNUAL_REPORT =
  /factsheet|fact[\s_\-–]*sheet|statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|corporate[\s_\-–]*plan|energy[\s_\-–]*charter|social[\s_\-–]*impact/i;

function fiscalYearEnding(yearRaw: string): string | null {
  const end = Number(yearRaw);
  if (!Number.isInteger(end) || end < 2001 || end > 2100) return null;
  const start = end - 1;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

/** Convert a Horizon Power annual-report filename (year ended) to the API fiscal year. */
export function horizonPowerFiscalYearFromFilename(filename: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(filename) || NON_ANNUAL_REPORT.test(filename)) return null;
  let sawSpan = false;
  for (const match of filename.matchAll(/(?:^|[^0-9])(\d{4})\s*[-–]\s*(\d{2,4})(?!\d)/g)) {
    sawSpan = true;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isInteger(start) || start < 2000 || start > 2100) continue;
    const expectedEnd = (start + 1) % 100;
    const endMatches = (match[2] as string).length === 2 ? end === expectedEnd : end === start + 1;
    if (endMatches) return `${start}-${String(expectedEnd).padStart(2, '0')}`;
  }
  // A malformed span is rejected rather than reinterpreted as a single year.
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
 * Parse annual-report PDF links from the official publications page (if it is
 * reachable). A link is accepted only when its filename contains "Annual Report"
 * and a year; factsheets, corporate plans and Statements of Corporate Intent are
 * rejected by name.
 */
export function parseHorizonPowerAnnualReportPdfLinks(
  html: string,
  pageUrl: string = HORIZON_POWER_SOURCE_URL,
): HorizonPowerAnnualReportLink[] {
  const links: HorizonPowerAnnualReportLink[] = [];
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
    const fiscalYear = horizonPowerFiscalYearFromFilename(filename);
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
      access: 'official',
    });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/** The documented official PDF fallback (Horizon Power CDN, FY2025-26). */
export function horizonPowerOfficialFallback(): HorizonPowerAnnualReportLink {
  return {
    url: HORIZON_POWER_OFFICIAL_FALLBACK_URL,
    filename: 'horizon-power-annual-report-2026.pdf',
    fiscal_year: '2025-26',
    title: 'Annual Report 2025–26',
    discovery_page: HORIZON_POWER_SOURCE_URL,
    access: 'official-pdf-fallback',
  };
}

/**
 * Try the official publications page; if it is blocked (HTTP 403) or carries no
 * annual-report PDF, return the documented official PDF copy.
 */
export async function discoverHorizonPowerAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = HORIZON_POWER_SOURCE_URL,
): Promise<HorizonPowerAnnualReportLink> {
  try {
    const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
    if (response.ok) {
      const html = await response.text();
      const links = parseHorizonPowerAnnualReportPdfLinks(html, pageUrl);
      if (links[0]) return links[0];
    }
  } catch {
    // Fall through to the documented official PDF copy.
  }
  return horizonPowerOfficialFallback();
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

/** Label text is everything left of the note-reference column (x < 300). */
function labelOf(row: PageRow): string {
  return row.items
    .filter((item) => item.x < 300)
    .map((item) => item.str.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function isMoneyItem(item: PdfTextItem): boolean {
  const text = item.str.trim();
  return /^(?:-|–|—)$/.test(text) || parseAmountCell(text).value !== null;
}

/** Money cells sit right of the note-reference column (x >= 420). */
function moneyItems(row: PageRow): PdfTextItem[] {
  return row.items.filter((item) => item.x >= 420 && isMoneyItem(item));
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

export function detectHorizonPowerUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface HorizonPowerStatement {
  page_number: number;
  unit: UnitDetection;
  revenue: number;
  other_income: number;
  total_income: number;
  electricity_fuel: number;
  employee_expenses: number;
  materials_services: number;
  depreciation_amortisation: number;
  other_expenses: number;
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
      text.includes('total income') &&
      text.includes('employee benefits expense') &&
      text.includes('profit before income tax equivalent expense') &&
      text.includes('profit for the year')
    ) {
      return page;
    }
  }
  return null;
}

export function parseHorizonPowerStatement(
  facePage: PdfPage,
): HorizonPowerStatement | null {
  const rawRows = groupPageRows(facePage.items);
  const rows = logicalRows(rawRows);
  const unit = detectMoneyUnit(unitSamples(rawRows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Revenue');
  if (anchor === null) {
    errors.push(
      'statement 30 June 2026 money column could not be anchored from the printed revenue row',
    );
    return null;
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);

  const revenue = read('Revenue');
  const otherIncome = read('Other income');
  const totalIncome = read('Total income');
  const electricityFuel = read('Electricity and fuel purchases');
  const employee = read('Employee benefits expense');
  const materials = read('Materials and services');
  const depreciation = read('Depreciation and amortisation expense');
  const otherExpenses = read('Other expenses');
  const financeCosts = read('Finance costs');
  const profitBeforeTax = read('Profit before income tax equivalent expense');
  const incomeTax = read('Income tax equivalent expense');
  const netResult = read('Profit for the year');

  const required: Array<[string, CellValue]> = [
    ['Revenue', revenue],
    ['Other income', otherIncome],
    ['Total income', totalIncome],
    ['Electricity and fuel purchases', electricityFuel],
    ['Employee benefits expense', employee],
    ['Materials and services', materials],
    ['Depreciation and amortisation expense', depreciation],
    ['Other expenses', otherExpenses],
    ['Finance costs', financeCosts],
    ['Profit before income tax equivalent expense', profitBeforeTax],
    ['Income tax equivalent expense', incomeTax],
    ['Profit for the year', netResult],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const revenueValue = revenue.value as number;
  const otherIncomeValue = otherIncome.value as number;
  const incomeValue = totalIncome.value as number;
  const electricityValue = Math.abs(electricityFuel.value as number);
  const employeeValue = Math.abs(employee.value as number);
  const materialsValue = Math.abs(materials.value as number);
  const depreciationValue = Math.abs(depreciation.value as number);
  const otherExpensesValue = Math.abs(otherExpenses.value as number);
  const financeValue = Math.abs(financeCosts.value as number);
  const profitBeforeTaxValue = profitBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;

  const incomeComponents = [revenueValue, otherIncomeValue];
  const incomeSum = incomeComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `income components exact: ${incomeComponents.join(' + ')} = ${incomeSum} (printed Total income ${incomeValue})`,
  );
  if (incomeSum !== incomeValue) {
    errors.push(
      `income component total mismatch: ${incomeComponents.join(' + ')} = ${incomeSum}, printed Total income ${incomeValue}`,
    );
  }

  const expenseComponents = [
    electricityValue,
    employeeValue,
    materialsValue,
    depreciationValue,
    otherExpensesValue,
    financeValue,
  ];
  const totalExpenses = expenseComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `total expenses exact: ${expenseComponents.join(' + ')} = ${totalExpenses} (derived; no printed Total expenses subtotal)`,
  );

  const profitBeforeTaxBridge = incomeValue - totalExpenses;
  checks.push(
    `profit-before-tax bridge exact: ${incomeValue} - ${totalExpenses} = ${profitBeforeTaxBridge} (printed ${profitBeforeTaxValue})`,
  );
  if (profitBeforeTaxBridge !== profitBeforeTaxValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${incomeValue} - ${totalExpenses} = ${profitBeforeTaxBridge}, printed Profit before income tax equivalent expense ${profitBeforeTaxValue}`,
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
    "the Statement of comprehensive income prints an explicit $'000 unit and two reporting-date columns; the adapter reads the 30 June 2026 column only. It has no printed Total expenses subtotal, so total expenses is the exact sum of the printed expense lines and is accepted only because Total income less total expenses equals the printed Profit before income tax equivalent expense and that result plus income tax equals Profit for the year at zero tolerance.",
  );

  return {
    page_number: facePage.page_number,
    unit,
    revenue: revenueValue,
    other_income: otherIncomeValue,
    total_income: incomeValue,
    electricity_fuel: electricityValue,
    employee_expenses: employeeValue,
    materials_services: materialsValue,
    depreciation_amortisation: depreciationValue,
    other_expenses: otherExpensesValue,
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

export interface HorizonPowerParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
  access?: 'official' | 'official-pdf-fallback';
}

export interface HorizonPowerDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation';
}

export interface HorizonPowerLineSpec {
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

export interface HorizonPowerParseResult {
  records: SpendingRecord[];
  deferral: HorizonPowerDeferral | null;
  statement: HorizonPowerStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function horizonPowerNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${HORIZON_POWER_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * HORIZON_POWER_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: HorizonPowerParseContext,
  spec: HorizonPowerLineSpec,
  statement: HorizonPowerStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `access: ${context.access ?? 'official'}`,
    `printed_unit: ${HORIZON_POWER_UNIT_LABEL} (${HORIZON_POWER_UNIT}; x${HORIZON_POWER_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    '30 June 2026 column only (prior column never added); entity-level SOC statement line; single Horizon Power entity; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Water Corporation, Synergy, Western Power, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: HorizonPowerLineSpec,
  context: HorizonPowerParseContext,
  statement: HorizonPowerStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: HORIZON_POWER_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: horizonPowerNaturalKey(
      HORIZON_POWER_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${HORIZON_POWER_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: HORIZON_POWER_JURISDICTION,
    delivery_entity: HORIZON_POWER_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Horizon Power Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: HORIZON_POWER_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: HORIZON_POWER_UNIT,
    soc_section: spec.section,
    soc_note: 'Statement of comprehensive income',
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

export function parseHorizonPowerExtraction(
  extraction: PdfExtraction,
  context: HorizonPowerParseContext,
): HorizonPowerParseResult {
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
  const statement = parseHorizonPowerStatement(facePage);
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

  const lineSpecs: HorizonPowerLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total income',
      amount_thousands: statement.total_income,
      funding_source: HORIZON_POWER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total income line, which bridges exactly to Revenue + Other income. Entity-level income; includes Tariff Equalisation Contribution and other income already, so it is never added to government program spending.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: HORIZON_POWER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Exact sum of the printed Electricity and fuel purchases + Employee benefits expense + Materials and services + Depreciation and amortisation expense + Other expenses + Finance costs lines. No printed Total expenses subtotal exists on the face statement; the derived total is accepted only because Total income less total expenses equals the printed Profit before income tax equivalent expense and the net-result bridge agrees.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expense',
      amount_thousands: statement.employee_expenses,
      funding_source: HORIZON_POWER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee benefits expense line. A component of total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation expense',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: HORIZON_POWER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation and amortisation expense line. A component of total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit for the year',
      amount_thousands: statement.net_result,
      funding_source: HORIZON_POWER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit for the year (net result after income tax equivalent). A result line, not an expense component; never add to revenue or expenses. 30 June 2026 column only.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the 30 June 2026 income and expense components reconcile exactly to the printed subtotal and every printed result bridge agrees at zero tolerance.',
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

export interface HorizonPowerConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector tries official discovery then the official PDF fallback. */
  document?: HorizonPowerAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'horizon-power-annual-report.pdf';
}

/**
 * Operator escape hatch: when `WA_HORIZON_POWER_ANNUAL_REPORT_URL` is set, it is
 * used as the exact official PDF URL. The default path is official-page
 * discovery with the documented official PDF fallback.
 */
function documentFromEnv(): HorizonPowerAnnualReportLink | null {
  const url = process.env.WA_HORIZON_POWER_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Horizon-Power-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = horizonPowerFiscalYearFromFilename(filename) ?? '2025-26';
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: HORIZON_POWER_SOURCE_URL,
    access: 'official',
  };
}

async function recordDeferral(
  document: HorizonPowerAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: HorizonPowerDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: HORIZON_POWER_ID, document_url: document.url },
    {
      $set: {
        entity: HORIZON_POWER_ENTITY,
        jurisdiction: HORIZON_POWER_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Horizon Power SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Horizon Power connector. */
export function createHorizonPowerConnector(
  options: HorizonPowerConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: HORIZON_POWER_ID,
    name: HORIZON_POWER_NAME,
    publisher: HORIZON_POWER_PUBLISHER,
    source_url: HORIZON_POWER_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: HORIZON_POWER_LICENSE,
    notes:
      'WA SOC (fourth WA GTE pilot): Horizon Power only (Regional Power Corporation), a WA Government Trading Enterprise (Government Trading Enterprises Act 2023 (WA)). Horizon Power\'s publications pages are Cloudflare-blocked (HTTP 403); the connector tries the official page first and falls back to the official FY2025-26 annual-report PDF on Horizon Power\'s own CDN. The exact PDF is SHA-256 archived outside the repo. The Statement of comprehensive income prints an explicit $\'000 unit and two reporting-date columns; the adapter reads the 30 June 2026 column only. It has no printed Total expenses subtotal, so total expenses is the exact sum of the printed expense lines, accepted only when it bridges to the printed Profit before income tax equivalent expense and Profit for the year at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Horizon Power is never added to government program spending, the PNFC benchmark, Water Corporation, Synergy, Western Power, another WA GTE, a QLD/NSW SOC, a WA total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverHorizonPowerAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Horizon Power PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: HORIZON_POWER_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes: `Horizon Power annual-report PDF (${document.access}); archived for auditable WA SOC entity-statement extraction.`,
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: HorizonPowerParseContext = {
        document_url: document.url,
        document_title: document.title,
        fiscal_year: document.fiscal_year,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
        },
        source_date: now.toISOString().slice(0, 10),
        access: document.access,
      };
      const parsed = parseHorizonPowerExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'wa-horizon-power-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'wa-horizon-power-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Horizon Power measure; skipped');
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
