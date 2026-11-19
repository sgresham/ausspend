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
 * QLD SOC — Gladstone Ports Corporation Limited annual-report adapter.
 *
 * This reuses the Energy Queensland/CS Energy/Stanwell/Powerlink/Sunwater QLD
 * SOC pattern: one entity, one audited face statement, no QLD total. The
 * reporting entity is Gladstone Ports Corporation Limited, a Queensland
 * Government Owned Corporation (GOC), not a statutory body.
 *
 * Source gate:
 * - The document is discovered from Gladstone Ports' official reports page
 *   (<https://gpcl.com.au/who-we-are/corporate-governance/reports/>). No PDF
 *   URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The consolidated statement of profit or loss and other comprehensive income
 *   prints an explicit "$'000" unit. A table read as dollars or millions is
 *   rejected, not converted by magnitude.
 * - The printed Total revenue and other income line is cross-checked against
 *   Revenue from contracts with customers + Other income. There is no printed
 *   Total expenses subtotal, so total expenses is derived as the exact sum of
 *   the printed expense/deduction lines (Employee benefits expenses +
 *   Operational expenses + Depreciation/amortisation expenses + Finance costs +
 *   Impairment + Net profit/(loss) on disposal of non-current assets). It is
 *   accepted only when it bridges exactly to the printed Profit before income
 *   tax and Profit for the year after the printed Reversal of prior impairment
 *   and revaluation gains. Employee benefits is also reconciled exactly to
 *   Note 6(d)'s printed Total. A one-thousand-dollar mismatch defers the whole
 *   document.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Gladstone
 * Ports rows are never added to government program spending, the PNFC
 * benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland,
 * Sunwater Limited, another QLD GOC, a QLD total, or each other.
 */

export const GLADSTONE_PORTS_ID = 'qld-gladstone-ports';
export const GLADSTONE_PORTS_NAME = 'Gladstone Ports Corporation Limited — Annual Report';
export const GLADSTONE_PORTS_PUBLISHER = 'Gladstone Ports Corporation Limited';
export const GLADSTONE_PORTS_ENTITY = 'Gladstone Ports Corporation Limited';
export const GLADSTONE_PORTS_JURISDICTION = 'QLD';
export const GLADSTONE_PORTS_LEGAL_CLASS = 'Queensland Government Owned Corporation (GOC)';
/** Canonical official reports page. Annual-report PDFs are discovered from it. */
export const GLADSTONE_PORTS_SOURCE_URL =
  'https://gpcl.com.au/who-we-are/corporate-governance/reports/';
export const GLADSTONE_PORTS_LICENSE =
  '© Gladstone Ports Corporation Limited. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const GLADSTONE_PORTS_UNIT = 'AUD_thousands';
export const GLADSTONE_PORTS_UNIT_LABEL = "$'000";
export const GLADSTONE_PORTS_UNIT_TO_CENTS = 100_000;
export const GLADSTONE_PORTS_CAVEAT =
  'Entity-level SOC statement lines for Gladstone Ports Corporation Limited only (a Queensland Government Owned Corporation). Never add to government program spending, to the PNFC sector benchmark, to Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, another QLD GOC, a QLD or national total, or to each other: total revenue is the printed Total revenue and other income line; total expenses is the exact sum of the printed expense lines (Employee benefits expenses + Operational expenses + Depreciation/amortisation expenses + Finance costs + Impairment + Net profit/(loss) on disposal of non-current assets); employee benefits is the printed face line reconciled to Note 6(d) and included within total expenses; depreciation and amortisation is a face-statement component of total expenses; the net result is a profit. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface GladstonePortsAnnualReportLink {
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

/** Gladstone names reports ...Annual-Report-2025-26.pdf or GPC-Annual-Report-2024-25_...pdf. */
const ANNUAL_REPORT_MARKER = /annual[\s_\-–]*report/i;
/** A consecutive financial-year span, e.g. 2025-26 or 2024-2025; a 2-digit end is allowed. */
const YEAR_SPAN = /(?:^|[^0-9])(\d{4})\s*[-–]\s*(\d{2,4})(?!\d)/;

function fiscalYearFromParts(startRaw: string, endRaw: string): string | null {
  const start = Number(startRaw);
  if (!Number.isInteger(start) || start < 2000 || start > 2100) return null;
  const end = Number(endRaw);
  const expectedEnd = (start + 1) % 100;
  if (!Number.isInteger(end)) return null;
  const endMatches = endRaw.length === 2 ? end === expectedEnd : end === start + 1;
  if (!endMatches) return null;
  return `${start}-${String(expectedEnd).padStart(2, '0')}`;
}

/** Convert a filename fiscal-year span (e.g. ...Annual-Report-2025-26.pdf) into "2025-26". */
export function gladstonePortsFiscalYearFromFilename(filename: string): string | null {
  if (!ANNUAL_REPORT_MARKER.test(filename)) return null;
  const match = YEAR_SPAN.exec(filename);
  if (!match) return null;
  return fiscalYearFromParts(match[1] as string, match[2] as string);
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
 * Parse annual-report PDF links from the official reports page. A link is
 * accepted only when its filename contains "Annual Report" and a consecutive
 * financial-year span. Other reports are rejected by name.
 */
export function parseGladstonePortsAnnualReportPdfLinks(
  html: string,
  pageUrl: string = GLADSTONE_PORTS_SOURCE_URL,
): GladstonePortsAnnualReportLink[] {
  const links: GladstonePortsAnnualReportLink[] = [];
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
    const fiscalYear = gladstonePortsFiscalYearFromFilename(filename);
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
 * Fetch the official reports page and return its newest annual-report PDF. No
 * PDF URL is hard-coded; a page with no annual-report link is an error.
 */
export async function discoverGladstonePortsAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  reportsUrl: string = GLADSTONE_PORTS_SOURCE_URL,
): Promise<GladstonePortsAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(reportsUrl, {
      redirect: 'follow',
      headers: BROWSER_HEADERS,
    });
  } catch (error) {
    throw new Error(
      `Gladstone Ports reports page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Gladstone Ports reports page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parseGladstonePortsAnnualReportPdfLinks(html, reportsUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Gladstone Ports reports page contains no annual-report PDF link; refusing to hard-code a URL',
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
  // Preserve content order so right-aligned money cells stay attached to their
  // label, matching the Stanwell/CS Energy/Powerlink/Sunwater reader.
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

/**
 * Anchor the current-year money column from the first matching row that
 * actually carries a money cell. Gladstone prints note references between the
 * label and the money columns, so a bare number cell is not enough.
 */
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

export function detectGladstonePortsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface GladstonePortsStatement {
  page_number: number;
  note_page_number: number;
  unit: UnitDetection;
  note_unit: UnitDetection;
  revenue_from_contracts: number;
  other_income: number;
  total_revenue: number;
  employee_benefits: number;
  operational_expenses: number;
  depreciation_amortisation: number;
  finance_costs: number;
  impairment: number;
  reversal_prior_impairment: number;
  net_loss_on_disposal: number;
  fair_value_revaluation_ppe: number;
  revaluation_investment_properties: number;
  total_expenses: number;
  profit_before_tax: number;
  income_tax: number;
  net_result: number;
  note_total_employee_benefits: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findFaceStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('consolidated statement of profit or loss') &&
      text.includes('profit before income tax') &&
      text.includes('total revenue and other income')
    ) {
      return page;
    }
  }
  return null;
}

function findEmployeeBenefitsNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (text.includes('employee benefits expenses') && text.includes('wages and salaries')) {
      return page;
    }
  }
  return null;
}

export function parseGladstonePortsStatement(
  facePage: PdfPage,
  notePage: PdfPage,
): GladstonePortsStatement | null {
  const rows = groupPageRows(facePage.items);
  const titleRow = rows.find((row) =>
    /consolidated statement of profit or loss/i.test(row.cells.join(' ')),
  );
  if (!titleRow) return null;

  const noteRows = groupPageRows(notePage.items);
  const unit = detectMoneyUnit(unitSamples(rows));
  const noteUnit = detectMoneyUnit(unitSamples(noteRows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor =
    columnAnchor(rows, 'Revenue from contracts with customers') ??
    columnAnchor(rows, 'Total revenue and other income');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed revenue row',
    );
    return null;
  }
  const noteAnchor = columnAnchor(noteRows, 'Wages and salaries');
  if (noteAnchor === null) {
    errors.push(
      'Note 6(d) current-year money column could not be anchored from the printed Wages and salaries row',
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
      `printed Note 6(d) unit is not explicit thousands (detected ${noteUnit.kind ?? 'none'}: ${noteUnit.reason}); refusing to ingest a $'000 note as dollars or millions`,
    );
  }

  const read = (label: string): CellValue => rowValue(rows, label, anchor);
  const readNote = (label: string): CellValue => rowValue(noteRows, label, noteAnchor);

  const revenue = read('Revenue from contracts with customers');
  const otherIncome = read('Other income');
  const totalRevenue = read('Total revenue and other income');
  const employeeBenefits = read('Employee benefits expenses');
  const operationalExpenses = read('Operational expenses');
  const depreciation = read('Depreciation/amortisation expenses');
  const financeCosts = read('Finance costs');
  const impairment = read('Impairment');
  const reversal = read('Reversal of prior impairment');
  const netLossOnDisposal = read('Net profit / (Loss) on disposal of non-current assets');
  const fairValuePpe = read(
    'Fair value revaluation increase / (decrease) of property, plant and equipment',
  );
  const revaluationInvestment = read('Revaluation increase of investment properties');
  const pbt = read('Profit before income tax');
  const incomeTax = read('Income tax expense');
  const netResult = read('Profit for the year');
  const noteEmployee = readNote('Total');

  const required: Array<[string, CellValue]> = [
    ['Revenue from contracts with customers', revenue],
    ['Other income', otherIncome],
    ['Total revenue and other income', totalRevenue],
    ['Employee benefits expenses', employeeBenefits],
    ['Operational expenses', operationalExpenses],
    ['Depreciation/amortisation expenses', depreciation],
    ['Finance costs', financeCosts],
    ['Impairment', impairment],
    ['Reversal of prior impairment', reversal],
    ['Net profit/(loss) on disposal of non-current assets', netLossOnDisposal],
    [
      'Fair value revaluation increase/(decrease) of property, plant and equipment',
      fairValuePpe,
    ],
    ['Revaluation increase of investment properties', revaluationInvestment],
    ['Profit before income tax', pbt],
    ['Income tax expense', incomeTax],
    ['Profit for the year', netResult],
    ['Note 6(d) Total employee benefits', noteEmployee],
  ];
  const missing = required.filter(([, cell]) => !cell.found).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return null;
  }

  const rev = revenue.value as number;
  const other = otherIncome.value as number;
  const printedRevenue = totalRevenue.value as number;
  const employee = Math.abs(employeeBenefits.value as number);
  const operational = Math.abs(operationalExpenses.value as number);
  const depreciationValue = Math.abs(depreciation.value as number);
  const financeCostValue = Math.abs(financeCosts.value as number);
  const impairmentValue = Math.abs(impairment.value as number);
  const reversalValue = reversal.value as number;
  const disposalLossValue = Math.abs(netLossOnDisposal.value as number);
  const fairValueValue = fairValuePpe.value as number;
  const revaluationValue = revaluationInvestment.value as number;
  const pbtValue = pbt.value as number;
  const taxValue = incomeTax.value as number;
  const netValue = netResult.value as number;
  const noteEmployeeValue = noteEmployee.value as number;

  const incomeBridge = rev + other;
  checks.push(
    `total revenue and other income bridge exact: ${rev} + ${other} = ${incomeBridge} (printed ${printedRevenue})`,
  );
  if (incomeBridge !== printedRevenue) {
    errors.push(
      `total revenue and other income bridge mismatch: ${rev} + ${other} = ${incomeBridge}, printed Total revenue and other income ${printedRevenue}`,
    );
  }

  const expenseComponents = [
    employee,
    operational,
    depreciationValue,
    financeCostValue,
    impairmentValue,
    disposalLossValue,
  ];
  const totalExpenses = expenseComponents.reduce((sum, value) => sum + value, 0);
  checks.push(
    `total expenses exact: ${expenseComponents.join(' + ')} = ${totalExpenses} (derived; no printed Total expenses subtotal)`,
  );

  const pbtBridge =
    printedRevenue -
    totalExpenses +
    reversalValue +
    fairValueValue +
    revaluationValue;
  checks.push(
    `profit-before-tax bridge exact: ${printedRevenue} - ${totalExpenses} + ${reversalValue} + ${fairValueValue} + ${revaluationValue} = ${pbtBridge} (printed ${pbtValue})`,
  );
  if (pbtBridge !== pbtValue) {
    errors.push(
      `profit-before-tax bridge mismatch: ${printedRevenue} - ${totalExpenses} + ${reversalValue} + ${fairValueValue} + ${revaluationValue} = ${pbtBridge}, printed Profit before income tax ${pbtValue}`,
    );
  }

  const netBridge = pbtValue + taxValue;
  checks.push(`net-result bridge exact: ${pbtValue} + ${taxValue} = ${netBridge} (printed ${netValue})`);
  if (netBridge !== netValue) {
    errors.push(
      `net-result bridge mismatch: ${pbtValue} + ${taxValue} = ${netBridge}, printed Profit for the year ${netValue}`,
    );
  }

  if (noteEmployeeValue !== employee) {
    errors.push(
      `Note 6(d) employee-benefits mismatch: printed Note 6(d) Total ${noteEmployeeValue}, face Employee benefits expenses ${employee}`,
    );
  } else {
    checks.push(
      `Note 6(d) Total employee benefits equals face Employee benefits expenses: ${noteEmployeeValue}`,
    );
  }

  warnings.push(
    "the consolidated statement prints a Total revenue and other income line but no Total expenses subtotal; total expenses is the exact sum of Employee benefits expenses + Operational expenses + Depreciation/amortisation expenses + Finance costs + Impairment + Net profit/(loss) on disposal of non-current assets, and is accepted only because it bridges to the printed Profit before income tax (after the printed Reversal of prior impairment and revaluation gains) and Profit for the year with zero tolerance. Employee benefits is separately reconciled to Note 6(d)'s printed Total. Employee benefits and depreciation and amortisation are components of total expenses, not additional rows.",
  );

  return {
    page_number: facePage.page_number,
    note_page_number: notePage.page_number,
    unit,
    note_unit: noteUnit,
    revenue_from_contracts: rev,
    other_income: other,
    total_revenue: printedRevenue,
    employee_benefits: employee,
    operational_expenses: operational,
    depreciation_amortisation: depreciationValue,
    finance_costs: financeCostValue,
    impairment: impairmentValue,
    reversal_prior_impairment: reversalValue,
    net_loss_on_disposal: disposalLossValue,
    fair_value_revaluation_ppe: fairValueValue,
    revaluation_investment_properties: revaluationValue,
    total_expenses: totalExpenses,
    profit_before_tax: pbtValue,
    income_tax: taxValue,
    net_result: netValue,
    note_total_employee_benefits: noteEmployeeValue,
    checks,
    warnings,
    errors,
  };
}

export interface GladstonePortsParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface GladstonePortsDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation' | 'notes';
}

export interface GladstonePortsLineSpec {
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

export interface GladstonePortsParseResult {
  records: SpendingRecord[];
  deferral: GladstonePortsDeferral | null;
  statement: GladstonePortsStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function gladstonePortsNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${GLADSTONE_PORTS_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * GLADSTONE_PORTS_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: GladstonePortsParseContext,
  spec: GladstonePortsLineSpec,
  statement: GladstonePortsStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${GLADSTONE_PORTS_UNIT_LABEL} (${GLADSTONE_PORTS_UNIT}; x${GLADSTONE_PORTS_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `note_page: ${statement.note_page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; consolidated Gladstone Ports Corporation Limited parent; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, another QLD GOC, a QLD total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: GladstonePortsLineSpec,
  context: GladstonePortsParseContext,
  statement: GladstonePortsStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: GLADSTONE_PORTS_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: gladstonePortsNaturalKey(
      GLADSTONE_PORTS_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${GLADSTONE_PORTS_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: GLADSTONE_PORTS_JURISDICTION,
    delivery_entity: GLADSTONE_PORTS_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Gladstone Ports Corporation Limited Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: GLADSTONE_PORTS_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: GLADSTONE_PORTS_UNIT,
    soc_section: spec.section,
    soc_note: 'Face statement / Note 6(d)',
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

export function parseGladstonePortsExtraction(
  extraction: PdfExtraction,
  context: GladstonePortsParseContext,
): GladstonePortsParseResult {
  const warnings: string[] = [];
  const facePage = findFaceStatementPage(extraction.pages);
  if (!facePage) {
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
  const notePage = findEmployeeBenefitsNotePage(extraction.pages);
  if (!notePage) {
    return {
      records: [],
      deferral: {
        reason:
          'no parseable Note 6(d) employee-benefits page found; employee benefits cannot be reconciled',
        phase: 'notes',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [facePage.page_number],
    };
  }
  const statement = parseGladstonePortsStatement(facePage, notePage);
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
      pages_used: [facePage.page_number, notePage.page_number],
    };
  }
  warnings.push(...statement.warnings);
  if (statement.unit.kind !== 'thousands' || statement.note_unit.kind !== 'thousands') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit thousands: face ${statement.unit.reason}; Note 6(d) ${statement.note_unit.reason}`,
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

  const lineSpecs: GladstonePortsLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: GLADSTONE_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total revenue and other income line, which bridges exactly to the printed Revenue from contracts with customers + Other income lines. Entity-level consolidated revenue and other income; includes government-related revenue already, so it is never added to government program spending.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: GLADSTONE_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Exact sum of the printed Employee benefits expenses + Operational expenses + Depreciation/amortisation expenses + Finance costs + Impairment + Net profit/(loss) on disposal of non-current assets lines. No printed Total expenses subtotal exists on the face statement; the derived total is accepted only because Total revenue and other income less total expenses plus the printed Reversal of prior impairment and revaluation gains equals the printed Profit before income tax, and the Profit for the year bridge agrees.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expenses',
      amount_thousands: statement.employee_benefits,
      funding_source: GLADSTONE_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee benefits expenses line, reconciled exactly to Note 6(d) Total employee benefits. It is a separate face line within total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation/amortisation expenses',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: GLADSTONE_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation/amortisation expenses line (Note 6(c)). A component of total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit for the year',
      amount_thousands: statement.net_result,
      funding_source: GLADSTONE_PORTS_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit for the year (net result). A result line, not an expense component; never add to revenue or expenses.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; total expenses is derived from the printed lines and reconciles exactly to the printed Profit before income tax and Profit for the year bridges, and Employee benefits reconciles exactly to Note 6(d).',
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

export interface GladstonePortsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: GladstonePortsAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'gladstone-ports-annual-report.pdf';
}

/**
 * Operator escape hatch: when `GLADSTONE_PORTS_ANNUAL_REPORT_URL` is set, it is
 * used as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): GladstonePortsAnnualReportLink | null {
  const url = process.env.GLADSTONE_PORTS_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Gladstone-Ports-Corporation-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = gladstonePortsFiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `GLADSTONE_PORTS_ANNUAL_REPORT_URL filename "${filename}" has no annual-report year span; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: GLADSTONE_PORTS_SOURCE_URL,
  };
}

async function recordDeferral(
  document: GladstonePortsAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: GladstonePortsDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: GLADSTONE_PORTS_ID, document_url: document.url },
    {
      $set: {
        entity: GLADSTONE_PORTS_ENTITY,
        jurisdiction: GLADSTONE_PORTS_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Gladstone Ports SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Gladstone Ports connector. */
export function createGladstonePortsConnector(
  options: GladstonePortsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: GLADSTONE_PORTS_ID,
    name: GLADSTONE_PORTS_NAME,
    publisher: GLADSTONE_PORTS_PUBLISHER,
    source_url: GLADSTONE_PORTS_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: GLADSTONE_PORTS_LICENSE,
    notes:
      'QLD SOC: Gladstone Ports Corporation Limited only, a Queensland Government Owned Corporation (GOC). The latest annual report is discovered from the official reports page (no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo. The consolidated statement prints an explicit $\'000 unit; it prints Total revenue and other income but no Total expenses subtotal, so total expenses is the exact sum of Employee benefits expenses + Operational expenses + Depreciation/amortisation expenses + Finance costs + Impairment + Net profit/(loss) on disposal of non-current assets. It is accepted only when it bridges to the printed Profit before income tax (after the printed Reversal of prior impairment and revaluation gains) and Profit for the year with zero tolerance; Employee benefits also reconciles exactly to Note 6(d). Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Gladstone Ports is never added to government program spending, the PNFC benchmark, Energy Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, another QLD GOC, a QLD total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverGladstonePortsAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Gladstone Ports PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: GLADSTONE_PORTS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Gladstone Ports annual-report PDF; archived for auditable QLD SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: GladstonePortsParseContext = {
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
      const parsed = parseGladstonePortsExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'qld-gladstone-ports-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'qld-gladstone-ports-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Gladstone Ports measure; skipped');
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
