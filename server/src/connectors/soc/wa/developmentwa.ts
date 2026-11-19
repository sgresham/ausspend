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
 * WA SOC — DevelopmentWA annual-report adapter.
 *
 * This is the next WA Government Trading Enterprise (GTE) pilot and reuses the
 * WA Water Corporation/Synergy/Western Power/Horizon Power/Fremantle Ports SOC
 * pattern: one entity, one audited face statement, no jurisdiction total.
 * DevelopmentWA is the Western Australian Land Authority (WALA), a WA GTE under
 * the Government Trading Enterprises Act 2023 (WA), not a Queensland GOC or an
 * NSW SOC. The Western Australian Land Authority is the reporting entity; the
 * separate Metropolitan Redevelopment Authority statements in the same report
 * are not added.
 *
 * Source gate:
 * - The latest report is discovered from DevelopmentWA's official publications
 *   page (edocman download links); no PDF URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The Statement of profit or loss and other comprehensive income prints an
 *   explicit "$'000" unit for the 2026 and 2025 columns. A table read as dollars
 *   or millions is rejected, not converted by magnitude.
 * - The face statement has no printed Total revenue or Total expenses subtotal.
 *   Total revenue is the exact sum of Operating revenue + Other revenue +
 *   Finance income; total expenses is the exact sum of Operating expenses +
 *   Estate holding expenses + Employee benefits expense + Consultant expenses +
 *   Advertising/PR/sponsorship + Other expenses + Finance costs. They are
 *   accepted only when total revenue less total expenses plus the printed
 *   Impairment reversal equals the printed Profit before income tax and that
 *   result less income tax equals Profit for the year, with zero tolerance.
 * - Depreciation and amortisation is not a separate face line; it is the
 *   printed Note 2(b) "Depreciation and amortisation" component within Other
 *   expenses, and the Note 2(b) total must equal the face Other expenses line.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false.
 * DevelopmentWA rows are never added to government program spending, the PNFC
 * benchmark, Water Corporation, Synergy, Western Power, Horizon Power,
 * Fremantle Ports, another WA GTE, a QLD/NSW SOC, a WA total, or each other.
 */

export const DEVELOPMENTWA_ID = 'wa-developmentwa';
export const DEVELOPMENTWA_NAME = 'DevelopmentWA — Annual Report';
export const DEVELOPMENTWA_PUBLISHER = 'DevelopmentWA (Western Australian Land Authority)';
export const DEVELOPMENTWA_ENTITY = 'DevelopmentWA';
export const DEVELOPMENTWA_JURISDICTION = 'WA';
export const DEVELOPMENTWA_LEGAL_CLASS =
  'WA Government Trading Enterprise (GTE) — Government Trading Enterprises Act 2023 (WA)';
/** Canonical official publications page. Annual-report downloads are discovered from it. */
export const DEVELOPMENTWA_SOURCE_URL = 'https://www.developmentwa.com.au/publications';
export const DEVELOPMENTWA_LICENSE =
  '© DevelopmentWA. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const DEVELOPMENTWA_UNIT = 'AUD_thousands';
export const DEVELOPMENTWA_UNIT_LABEL = "$'000";
export const DEVELOPMENTWA_UNIT_TO_CENTS = 100_000;
export const DEVELOPMENTWA_CAVEAT =
  'Entity-level SOC statement lines for DevelopmentWA only (the Western Australian Land Authority, a WA Government Trading Enterprise under the Government Trading Enterprises Act 2023 (WA)). Never add to government program spending, to the PNFC sector benchmark, to Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, another WA GTE, to a QLD/NSW SOC, a WA or national total, or to each other: total revenue is the exact sum of Operating revenue + Other revenue + Finance income (no printed Total revenue subtotal); total expenses is the exact sum of the printed expense and finance-cost lines (no printed Total expenses subtotal); employee benefits is a printed face line; depreciation and amortisation is the Note 2(b) component within Other expenses; the net result is the printed Profit for the year. The WALA statements are used; the separate MRA statements are not added. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface DevelopmentWaAnnualReportLink {
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

const ANNUAL_REPORT_MARKER = /annual/i;
const NON_ANNUAL_REPORT =
  /statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|strategic[\s_\-–]*plan|net[\s_\-–]*zero|reconciliation[\s_\-–]*action|disability|carbon[\s_\-–]*footprint|roadmap|guide/i;

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
 * Convert a DevelopmentWA edocman slug to the API fiscal year. Slugs carry a
 * four-digit span (e.g. 2025-2026); a bare year-ended 20xx is also accepted.
 */
export function developmentWaFiscalYearFromFilename(filename: string): string | null {
  // edocman slugs prefix the year span with a numeric document id, e.g.
  // 2257-2025-2026-…; strip that id so it does not consume the span match.
  const cleaned = filename.replace(/^\d{3,4}-(?=20\d{2}\s*[-–])/, '');
  if (!ANNUAL_REPORT_MARKER.test(cleaned) || NON_ANNUAL_REPORT.test(cleaned)) return null;
  if (!/developmentwa|land[\s_\-–]*authority|wala/i.test(cleaned)) return null;
  let sawSpan = false;
  for (const match of cleaned.matchAll(/(?:^|[^0-9])(\d{4})\s*[-–]\s*(\d{2,4})(?!\d)/g)) {
    sawSpan = true;
    const span = fiscalYearFromSpan(match[1] as string, match[2] as string);
    if (span) return span;
  }
  if (sawSpan) return null;
  const year = /(?:^|[^0-9])(20\d{2})(?!\d)/.exec(cleaned)?.[1];
  return year ? fiscalYearFromSpan(year, String(Number(year) + 1)) : null;
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

function edocmanSlug(url: URL): string | null {
  const match = /\/component\/edocman\/([^/]+)\/download\/?$/i.exec(url.pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Parse annual-report download links from the official publications page. The
 * page uses edocman download links such as
 * /component/edocman/2257-2025-2026-annual-and-sustainability-report-developmentwa/download.
 * A link is accepted only when its slug names a DevelopmentWA/WALA annual report
 * and a year; sustainability-only reports, MRA/Landcorp predecessors, corporate
 * plans and the SCI are rejected by name.
 */
export function parseDevelopmentWaAnnualReportPdfLinks(
  html: string,
  pageUrl: string = DEVELOPMENTWA_SOURCE_URL,
): DevelopmentWaAnnualReportLink[] {
  const links: DevelopmentWaAnnualReportLink[] = [];
  const seen = new Set<string>();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const raw = match[1];
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    const slug = edocmanSlug(url);
    if (!slug) continue;
    const fiscalYear = developmentWaFiscalYearFromFilename(slug);
    if (!fiscalYear) continue;
    const key = `${url.origin}${url.pathname}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [start, end] = fiscalYear.split('-');
    links.push({
      url: key,
      filename: `${slug}.pdf`,
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
export async function discoverDevelopmentWaAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = DEVELOPMENTWA_SOURCE_URL,
): Promise<DevelopmentWaAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (error) {
    throw new Error(
      `DevelopmentWA publications page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `DevelopmentWA publications page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parseDevelopmentWaAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'DevelopmentWA publications page contains no annual-report download link; refusing to hard-code a URL',
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

function labelText(row: PageRow, maxX: number): string {
  return row.items
    .filter((item) => item.x < maxX)
    .map((item) => item.str.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function isMoneyItem(item: PdfTextItem): boolean {
  const text = item.str.trim();
  return /^(?:-|–|—)$/.test(text) || parseAmountCell(text).value !== null;
}

function moneyCells(row: PageRow, minX: number, maxX: number): PdfTextItem[] {
  return row.items.filter((item) => item.x >= minX && item.x < maxX && isMoneyItem(item));
}

interface LogicalRow {
  label: string;
  items: PdfTextItem[];
}

function logicalRows(
  rows: readonly PageRow[],
  labelMaxX: number,
  moneyMinX: number,
  moneyMaxX: number,
): LogicalRow[] {
  const out: LogicalRow[] = [];
  for (const row of rows) {
    const label = labelText(row, labelMaxX);
    const money = moneyCells(row, moneyMinX, moneyMaxX);
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

export function detectDevelopmentWaUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface DevelopmentWaStatement {
  page_number: number;
  note_page_number: number;
  unit: UnitDetection;
  note_unit: UnitDetection;
  operating_revenue: number;
  operating_expenses: number;
  other_revenue: number;
  estate_holding_expenses: number;
  employee_expenses: number;
  consultant_expenses: number;
  advertising_expenses: number;
  impairment_reversal: number;
  other_expenses: number;
  finance_income: number;
  finance_costs: number;
  total_revenue: number;
  total_expenses: number;
  profit_before_tax: number;
  income_tax: number;
  net_result: number;
  note_depreciation_amortisation: number;
  note_total_other_expenses: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findFaceStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('statement of profit or loss and other comprehensive income') &&
      text.includes('operating revenue') &&
      text.includes('employee benefits expense') &&
      text.includes('profit before income tax') &&
      text.includes('profit for the year')
    ) {
      return page;
    }
  }
  return null;
}

function findOtherExpensesNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('other expenses from operating activities') &&
      text.includes('depreciation and amortisation') &&
      text.includes('total other expenses from operating activities')
    ) {
      return page;
    }
  }
  return null;
}

export function parseDevelopmentWaStatement(
  facePage: PdfPage,
  notePage: PdfPage,
): DevelopmentWaStatement | null {
  const faceRows = groupPageRows(facePage.items);
  const noteRows = groupPageRows(notePage.items);
  const rows = logicalRows(faceRows, 250, 310, 420);
  const noteLogical = logicalRows(noteRows, 650, 650, 850);
  const unit = detectMoneyUnit(unitSamples(faceRows));
  const noteUnit = detectMoneyUnit(unitSamples(noteRows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Operating revenue');
  if (anchor === null) {
    errors.push(
      'statement 2026 money column could not be anchored from the printed operating-revenue row',
    );
    return null;
  }
  const noteAnchor = columnAnchor(noteLogical, 'Depreciation and amortisation');
  if (noteAnchor === null) {
    errors.push(
      'Note 2(b) 2026 money column could not be anchored from the printed depreciation row',
    );
    return null;
  }
  if (unit.kind !== 'thousands') {
    errors.push(
      `printed face-statement unit is not explicit thousands (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $'000 statement as dollars or millions`,
    );
  }
  if (noteUnit.kind !== 'thousands') {
    errors.push(
      `printed Note 2(b) unit is not explicit thousands (detected ${noteUnit.kind ?? 'none'}: ${noteUnit.reason}); refusing to ingest a $'000 note as dollars or millions`,
    );
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);
  const readNote = (label: string): CellValue => rowValue(noteLogical, label, noteAnchor);

  const operatingRevenue = read('Operating revenue');
  const operatingExpenses = read('Operating expenses');
  const otherRevenue = read('Other revenue');
  const estateHolding = read('Estate holding expenses');
  const employee = read('Employee benefits expense');
  const consultant = read('Consultant expenses');
  const advertising = read('Advertising, public relations and sponsorship');
  const impairmentReversal = read('Impairment reversal of trade receivables');
  const otherExpenses = read('Other expenses');
  const financeIncome = read('Finance income');
  const financeCosts = read('Finance costs');
  const profitBeforeTax = read('Profit before income tax');
  const incomeTax = read('Income tax expense');
  const netResult = read('Profit for the year');
  const noteDepreciation = readNote('Depreciation and amortisation');
  const noteOtherTotal = readNote('Total other expenses from operating activities');

  const required: Array<[string, CellValue]> = [
    ['Operating revenue', operatingRevenue],
    ['Operating expenses', operatingExpenses],
    ['Other revenue', otherRevenue],
    ['Estate holding expenses', estateHolding],
    ['Employee benefits expense', employee],
    ['Consultant expenses', consultant],
    ['Advertising, public relations and sponsorship', advertising],
    ['Impairment reversal of trade receivables', impairmentReversal],
    ['Other expenses', otherExpenses],
    ['Finance income', financeIncome],
    ['Finance costs', financeCosts],
    ['Profit before income tax', profitBeforeTax],
    ['Income tax expense', incomeTax],
    ['Profit for the year', netResult],
    ['Note 2(b) Depreciation and amortisation', noteDepreciation],
    ['Note 2(b) Total other expenses from operating activities', noteOtherTotal],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const opRevenueValue = operatingRevenue.value as number;
  const opExpensesValue = Math.abs(operatingExpenses.value as number);
  const otherRevenueValue = otherRevenue.value as number;
  const estateValue = Math.abs(estateHolding.value as number);
  const employeeValue = Math.abs(employee.value as number);
  const consultantValue = Math.abs(consultant.value as number);
  const advertisingValue = Math.abs(advertising.value as number);
  const reversalValue = impairmentReversal.value as number;
  const otherExpensesValue = Math.abs(otherExpenses.value as number);
  const financeIncomeValue = financeIncome.value as number;
  const financeCostValue = Math.abs(financeCosts.value as number);
  const profitBeforeTaxValue = profitBeforeTax.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;
  const noteDepreciationValue = Math.abs(noteDepreciation.value as number);
  const noteOtherTotalValue = Math.abs(noteOtherTotal.value as number);

  const totalRevenue = opRevenueValue + otherRevenueValue + financeIncomeValue;
  checks.push(
    `total revenue exact: ${opRevenueValue} + ${otherRevenueValue} + ${financeIncomeValue} = ${totalRevenue}`,
  );

  const totalExpenses =
    opExpensesValue +
    estateValue +
    employeeValue +
    consultantValue +
    advertisingValue +
    otherExpensesValue +
    financeCostValue;
  checks.push(
    `total expenses exact: ${opExpensesValue} + ${estateValue} + ${employeeValue} + ${consultantValue} + ${advertisingValue} + ${otherExpensesValue} + ${financeCostValue} = ${totalExpenses}`,
  );

  const profitBeforeTaxBridge = totalRevenue - totalExpenses + reversalValue;
  checks.push(
    `profit-before-tax bridge exact: ${totalRevenue} - ${totalExpenses} + ${reversalValue} = ${profitBeforeTaxBridge} (printed ${profitBeforeTaxValue})`,
  );
  if (profitBeforeTaxBridge !== profitBeforeTaxValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${totalRevenue} - ${totalExpenses} + ${reversalValue} = ${profitBeforeTaxBridge}, printed Profit before income tax ${profitBeforeTaxValue}`,
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

  if (noteOtherTotalValue !== otherExpensesValue) {
    errors.push(
      `Note 2(b) total does not equal the face Other expenses: printed ${noteOtherTotalValue}, face ${otherExpensesValue}`,
    );
  } else {
    checks.push(
      `Note 2(b) total other expenses equals face Other expenses: ${noteOtherTotalValue}`,
    );
  }
  if (noteDepreciationValue > otherExpensesValue || noteDepreciationValue < 0) {
    errors.push(
      `Note 2(b) depreciation ${noteDepreciationValue} is outside the face Other expenses ${otherExpensesValue}`,
    );
  } else {
    checks.push(
      `Note 2(b) depreciation ${noteDepreciationValue} is included within Other expenses ${otherExpensesValue}`,
    );
  }

  warnings.push(
    "the face statement prints an explicit $'000 unit and two reporting-year columns; the adapter reads the 2026 column only. It has no printed Total revenue or Total expenses subtotal, so both are derived from the printed lines; they are accepted only because the Profit before income tax and Profit for the year bridges agree at zero tolerance. Depreciation and amortisation is not a separate face line: it is the printed Note 2(b) component within Other expenses, and the Note 2(b) total is reconciled to the face Other expenses line. The WALA statements are used; the separate MRA statements are not added.",
  );

  return {
    page_number: facePage.page_number,
    note_page_number: notePage.page_number,
    unit,
    note_unit: noteUnit,
    operating_revenue: opRevenueValue,
    operating_expenses: opExpensesValue,
    other_revenue: otherRevenueValue,
    estate_holding_expenses: estateValue,
    employee_expenses: employeeValue,
    consultant_expenses: consultantValue,
    advertising_expenses: advertisingValue,
    impairment_reversal: reversalValue,
    other_expenses: otherExpensesValue,
    finance_income: financeIncomeValue,
    finance_costs: financeCostValue,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    profit_before_tax: profitBeforeTaxValue,
    income_tax: Math.abs(taxValue),
    net_result: netValue,
    note_depreciation_amortisation: noteDepreciationValue,
    note_total_other_expenses: noteOtherTotalValue,
    checks,
    warnings,
    errors,
  };
}

export interface DevelopmentWaParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface DevelopmentWaDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation' | 'notes';
}

export interface DevelopmentWaLineSpec {
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

export interface DevelopmentWaParseResult {
  records: SpendingRecord[];
  deferral: DevelopmentWaDeferral | null;
  statement: DevelopmentWaStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function developmentWaNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${DEVELOPMENTWA_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * DEVELOPMENTWA_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: DevelopmentWaParseContext,
  spec: DevelopmentWaLineSpec,
  statement: DevelopmentWaStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${DEVELOPMENTWA_UNIT_LABEL} (${DEVELOPMENTWA_UNIT}; x${DEVELOPMENTWA_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `note_page: ${statement.note_page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    '2026 column only (prior column never added); entity-level SOC statement line; Western Australian Land Authority (WALA) statements only, MRA statements not added; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, another WA GTE, a QLD/NSW SOC, a WA total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: DevelopmentWaLineSpec,
  context: DevelopmentWaParseContext,
  statement: DevelopmentWaStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: DEVELOPMENTWA_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: developmentWaNaturalKey(
      DEVELOPMENTWA_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${DEVELOPMENTWA_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: DEVELOPMENTWA_JURISDICTION,
    delivery_entity: DEVELOPMENTWA_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `DevelopmentWA Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: DEVELOPMENTWA_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: DEVELOPMENTWA_UNIT,
    soc_section: spec.section,
    soc_note: 'Statement of profit or loss / Note 2(b)',
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

export function parseDevelopmentWaExtraction(
  extraction: PdfExtraction,
  context: DevelopmentWaParseContext,
): DevelopmentWaParseResult {
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
  const notePage = findOtherExpensesNotePage(extraction.pages);
  if (!notePage) {
    return {
      records: [],
      deferral: {
        reason:
          'no parseable Note 2(b) other-expenses page found; depreciation and amortisation cannot be reconciled',
        phase: 'notes',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [facePage.page_number],
    };
  }
  const statement = parseDevelopmentWaStatement(facePage, notePage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason:
          'statement of profit or loss found but required printed lines could not be parsed',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [facePage.page_number, notePage.page_number],
    };
  }
  warnings.push(...statement.warnings);
  if (statement.unit.kind !== 'thousands' || statement.note_unit.kind !== 'thousands') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit thousands: face ${statement.unit.reason}; Note 2(b) ${statement.note_unit.reason}`,
        phase: 'unit',
      },
      statement,
      checks: statement.checks,
      warnings,
      pages_used: [facePage.page_number, notePage.page_number],
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
      pages_used: [facePage.page_number, notePage.page_number],
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
      pages_used: [facePage.page_number, notePage.page_number],
    };
  }

  const lineSpecs: DevelopmentWaLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: DEVELOPMENTWA_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Exact sum of the printed Operating revenue + Other revenue + Finance income lines. No printed Total revenue subtotal exists on the face statement; the derived total is accepted only because it bridges to the printed Profit before income tax and Profit for the year.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: DEVELOPMENTWA_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Exact sum of the printed Operating expenses + Estate holding expenses + Employee benefits expense + Consultant expenses + Advertising/PR/sponsorship + Other expenses + Finance costs lines. No printed Total expenses subtotal exists on the face statement; the derived total is accepted only because it bridges to the printed Profit before income tax and Profit for the year (after the printed Impairment reversal gain).',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expense',
      amount_thousands: statement.employee_expenses,
      funding_source: DEVELOPMENTWA_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee benefits expense line. A component of total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_thousands: statement.note_depreciation_amortisation,
      funding_source: DEVELOPMENTWA_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Note 2(b) Depreciation and amortisation line, one of the components of the face statement Other expenses. It is included within total expenses; recorded once as a memo component, never added on top of total expenses. The Note 2(b) total is reconciled exactly to the face Other expenses line.',
    },
    {
      line_item: 'net_result',
      label: 'Profit for the year',
      amount_thousands: statement.net_result,
      funding_source: DEVELOPMENTWA_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit for the year (net result after income tax). A result line, not an expense component; never add to revenue or expenses. 2026 column only. The WALA statements are used; the separate MRA statements are not added.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the 2026 income and expense components reconcile exactly to the printed subtotals, the WALA net-result bridge agrees at zero tolerance, and Note 2(b) reconciles to the face Other expenses line.',
  );
  return {
    records,
    deferral: null,
    statement,
    checks: statement.checks,
    warnings,
    pages_used: [facePage.page_number, notePage.page_number],
  };
}

export interface DevelopmentWaConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: DevelopmentWaAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const parsed = new URL(url);
    const slug = edocmanSlug(parsed);
    if (slug) return `${slug.replace(/[^A-Za-z0-9._-]+/g, '-')}.pdf`;
    const name = decodeURIComponent(parsed.pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'developmentwa-annual-report.pdf';
}

/**
 * Operator escape hatch: when `WA_DEVELOPMENTWA_ANNUAL_REPORT_URL` is set, it is
 * used as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): DevelopmentWaAnnualReportLink | null {
  const url = process.env.WA_DEVELOPMENTWA_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'DevelopmentWA-Annual-Report.pdf';
  try {
    const parsed = new URL(url);
    const slug = edocmanSlug(parsed);
    filename = slug
      ? `${slug}.pdf`
      : decodeURIComponent(parsed.pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = developmentWaFiscalYearFromFilename(filename) ?? '2025-26';
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: DEVELOPMENTWA_SOURCE_URL,
  };
}

async function recordDeferral(
  document: DevelopmentWaAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: DevelopmentWaDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: DEVELOPMENTWA_ID, document_url: document.url },
    {
      $set: {
        entity: DEVELOPMENTWA_ENTITY,
        jurisdiction: DEVELOPMENTWA_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the DevelopmentWA SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live DevelopmentWA connector. */
export function createDevelopmentWaConnector(
  options: DevelopmentWaConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: DEVELOPMENTWA_ID,
    name: DEVELOPMENTWA_NAME,
    publisher: DEVELOPMENTWA_PUBLISHER,
    source_url: DEVELOPMENTWA_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: DEVELOPMENTWA_LICENSE,
    notes:
      'WA SOC: DevelopmentWA only (the Western Australian Land Authority), a WA Government Trading Enterprise (Government Trading Enterprises Act 2023 (WA)). The latest report is discovered from the official publications page (edocman download links; no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo. The Statement of profit or loss and other comprehensive income prints an explicit $\'000 unit and two reporting-year columns; the adapter reads the 2026 column only. It has no printed Total revenue or Total expenses subtotal, so both are derived from the printed lines, accepted only when they bridge to the printed Profit before income tax and Profit for the year at zero tolerance; depreciation and amortisation is the Note 2(b) component within Other expenses, and Note 2(b) reconciles to the face Other expenses. The WALA statements are used; the separate MRA statements are not added. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). DevelopmentWA is never added to government program spending, the PNFC benchmark, Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, another WA GTE, a QLD/NSW SOC, a WA total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverDevelopmentWaAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`DevelopmentWA PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: DEVELOPMENTWA_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'DevelopmentWA annual-report PDF; archived for auditable WA SOC entity-statement extraction (WALA statement of profit or loss PDF page 95, Note 2(b) PDF page 103).',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: DevelopmentWaParseContext = {
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
      const parsed = parseDevelopmentWaExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'wa-developmentwa-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'wa-developmentwa-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a DevelopmentWA measure; skipped');
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
