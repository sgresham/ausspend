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
 * QLD SOC — CS Energy Limited annual-report adapter.
 *
 * This reuses the Energy Queensland QLD SOC pattern: one entity, one audited
 * face statement, no QLD total. CS Energy Limited is a Queensland Government
 * Owned Corporation (GOC) under the Government Owned Corporations Act 1993
 * (Qld).
 *
 * Source gate:
 * - The document is discovered from CS Energy's official annual-reports page
 *   (no PDF URL is hard-coded).
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The consolidated statement of profit or loss and other comprehensive
 *   income prints an explicit "$'000" unit and the Basis of Preparation says
 *   amounts are rounded to the nearest thousand dollars. A table read as
 *   dollars or millions is rejected, not converted by magnitude.
 * - The statement has no printed "Total revenue" or "Total expenses"
 *   subtotal. Total revenue is the exact sum of the printed income lines
 *   (Revenue + Interest income + Other income); total expenses is the exact sum
 *   of the printed expense lines plus the printed Loss on disposed assets.
 *   Both are accepted only when they bridge exactly to the printed Loss before
 *   income tax expense and the printed Loss after income tax expense for the
 *   year. A one-thousand-dollar mismatch defers the whole document.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. CS Energy
 * rows are never added to government program spending, the PNFC benchmark,
 * another QLD GOC, a QLD total, or each other.
 */

export const CS_ENERGY_ID = 'qld-cs-energy';
export const CS_ENERGY_NAME = 'CS Energy — Annual Report';
export const CS_ENERGY_PUBLISHER = 'CS Energy Limited';
export const CS_ENERGY_ENTITY = 'CS Energy';
export const CS_ENERGY_JURISDICTION = 'QLD';
export const CS_ENERGY_LEGAL_CLASS = 'QLD Government Owned Corporation (GOC)';
export const CS_ENERGY_SOURCE_URL =
  'https://www.csenergy.com.au/who-we-are/reports-and-publications/annual-reports';
export const CS_ENERGY_LICENSE =
  '© CS Energy Limited. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const CS_ENERGY_UNIT = 'AUD_thousands';
export const CS_ENERGY_UNIT_LABEL = "$'000";
export const CS_ENERGY_UNIT_TO_CENTS = 100_000;
export const CS_ENERGY_CAVEAT =
  "Entity-level SOC statement lines for CS Energy only (Queensland Government Owned Corporation). Never add to government program spending, to the PNFC sector benchmark, to Energy Queensland, another QLD GOC, a QLD or national total, or to each other: total revenue is the exact sum of the printed Revenue, Interest income and Other income lines; total expenses is the exact sum of the printed expense lines plus Loss on disposed assets; total expenses includes employee, fuel, electricity, services, finance, depreciation/amortisation, impairment, fair-value and provision lines; the net result is a loss. Provisional and unverified.";

/** A discovered annual-report PDF. Never hard-code the URL; parse the page. */
export interface CsEnergyAnnualReportLink {
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

const ANNUAL_REPORT_FILENAME = /annual[\s_\-–]*report[\s_\-–]*(20\d{2})/i;
const NON_ANNUAL_REPORT =
  /sustainability|climate|corporate[\s_\-–]*intent|reconciliation|action[\s_\-–]*plan|performance[\s_\-–]*report|quarterly/i;

/** Report year N covers the financial year ended 30 June N: "2026" -> "2025-26". */
export function csEnergyFiscalYearFromReportYear(reportYear: number): string | null {
  if (!Number.isInteger(reportYear) || reportYear < 2000 || reportYear > 2100) return null;
  const start = reportYear - 1;
  return `${start}-${String(reportYear % 100).padStart(2, '0')}`;
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
 * Parse annual-report PDF links from the official annual-reports page. CS
 * Energy serves PDFs as `.pdf.aspx`; both plain `.pdf` and `.pdf.aspx` are
 * accepted. Sustainability, climate and corporate-intent PDFs are rejected.
 */
export function parseCsEnergyAnnualReportPdfLinks(
  html: string,
  pageUrl: string = CS_ENERGY_SOURCE_URL,
): CsEnergyAnnualReportLink[] {
  const links: CsEnergyAnnualReportLink[] = [];
  const seen = new Set<string>();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const raw = match[1];
    if (!raw || !/\.pdf(?:\.aspx)?(?:$|[?#])/i.test(raw)) continue;
    let url: URL;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    const filename = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    if (NON_ANNUAL_REPORT.test(filename)) continue;
    const yearMatch = ANNUAL_REPORT_FILENAME.exec(filename);
    if (!yearMatch) continue;
    const fiscalYear = csEnergyFiscalYearFromReportYear(Number(yearMatch[1]));
    if (!fiscalYear) continue;
    const key = `${url.origin}${url.pathname}${url.search}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [start, end] = fiscalYear.split('-');
    links.push({
      url: key,
      filename: filename.replace(/\.aspx$/i, ''),
      fiscal_year: fiscalYear,
      title: `Annual Report ${start}–${end}`,
      discovery_page: pageUrl,
    });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/** Fetch the official annual-reports page and return its latest annual-report PDF. */
export async function discoverCsEnergyAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = CS_ENERGY_SOURCE_URL,
): Promise<CsEnergyAnnualReportLink> {
  const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(`CS Energy annual-reports page HTTP ${response.status} for ${pageUrl}`);
  }
  const html = await response.text();
  const links = parseCsEnergyAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'CS Energy annual-reports page contains no annual-report PDF link; refusing to hard-code a URL',
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
  // CS Energy's PDF has two complete copies of the statement in content order
  // (a print/overlay artefact). Sorting by y would interleave the two copies
  // and attach the wrong value to a label. Preserve content order instead: the
  // first complete copy is authoritative and the duplicate is ignored.
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

function valueNear(row: PageRow, anchor: number, tolerance = 18): number | null {
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

function valueFor(
  rows: readonly PageRow[],
  label: string,
  anchor: number,
): number | null {
  const row = findRow(rows, label);
  return row ? valueNear(row, anchor) : null;
}

function valueForPattern(
  rows: readonly PageRow[],
  patterns: readonly RegExp[],
  anchor: number,
): number | null {
  for (const row of rows) {
    const label = labelOf(row);
    if (!patterns.some((pattern) => pattern.test(label))) continue;
    const value = valueNear(row, anchor);
    if (value !== null) return value;
  }
  return null;
}

function unitSamples(rows: readonly PageRow[]): string[] {
  return rows
    .filter((row) => row.cells.some((cell) => cell.includes('$')))
    .map((row) => row.cells.join(' '));
}

export function detectCsEnergyUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface CsEnergyStatement {
  page_number: number;
  unit: UnitDetection;
  revenue: number;
  interest_income: number;
  other_income: number;
  total_revenue: number;
  loss_on_disposed_assets: number;
  fuel: number;
  electricity_and_energy_services: number;
  services_and_consultants: number;
  finance_costs: number;
  employee_benefit_expense: number;
  raw_materials_and_consumables: number;
  capacity_payments_and_operating_leases: number;
  other_expenses: number;
  fair_value_through_profit_loss: number;
  depreciation_and_amortisation: number;
  impairment_losses: number;
  provision_remeasurements: number;
  /** Exact sum of the printed expense lines, including Loss on disposed assets. */
  total_expenses: number;
  loss_before_tax: number;
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
      text.includes('loss before income tax expense')
    ) {
      return page;
    }
  }
  return null;
}

export function parseCsEnergyStatement(page: PdfPage): CsEnergyStatement | null {
  const rows = groupPageRows(page.items);
  const titleRow = rows.find((row) =>
    /consolidated statement of profit or loss/i.test(row.cells.join(' ')),
  );
  if (!titleRow) return null;

  const unit = detectMoneyUnit(unitSamples(rows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Revenue');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed Revenue row',
    );
    return null;
  }
  if (unit.kind !== 'thousands') {
    errors.push(
      `printed unit is not explicit thousands (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $'000 statement as dollars or millions`,
    );
  }

  const revenue = valueFor(rows, 'Revenue', anchor);
  const interest = valueFor(rows, 'Interest income', anchor);
  const otherIncome = valueFor(rows, 'Other income', anchor);
  const lossDisposed = valueFor(rows, 'Loss on disposed assets', anchor);
  const fuel = valueFor(rows, 'Fuel', anchor);
  const electricity = valueFor(rows, 'Electricity and energy services expense', anchor);
  const services = valueFor(rows, 'Services and consultants', anchor);
  const finance = valueFor(rows, 'Finance costs', anchor);
  const employee = valueFor(rows, 'Employee benefit expense', anchor);
  const rawMaterials = valueFor(rows, 'Raw materials and consumables', anchor);
  const capacity = valueFor(rows, 'Capacity payments and operating leases', anchor);
  const other = valueFor(rows, 'Other expenses', anchor);
  const fairValue = valueFor(rows, 'Fair value through profit/(loss)', anchor);
  const depreciation = valueFor(rows, 'Depreciation and amortisation', anchor);
  const impairment = valueFor(rows, 'Impairment (losses)', anchor);
  const provision = valueFor(rows, 'Provision remeasurements', anchor);
  const pbt = valueForPattern(rows, [/^loss before income tax expense$/i], anchor);
  const tax = valueForPattern(rows, [/^income tax expense$/i], anchor);
  const netResult = valueForPattern(
    rows,
    [/^loss after income tax expense for the year$/i],
    anchor,
  );

  const required: Array<[string, number | null]> = [
    ['Revenue', revenue],
    ['Interest income', interest],
    ['Other income', otherIncome],
    ['Loss on disposed assets', lossDisposed],
    ['Fuel', fuel],
    ['Electricity and energy services expense', electricity],
    ['Services and consultants', services],
    ['Finance costs', finance],
    ['Employee benefit expense', employee],
    ['Raw materials and consumables', rawMaterials],
    ['Capacity payments and operating leases', capacity],
    ['Other expenses', other],
    ['Fair value through profit/(loss)', fairValue],
    ['Depreciation and amortisation', depreciation],
    ['Impairment (losses)', impairment],
    ['Provision remeasurements', provision],
    ['Loss before income tax expense', pbt],
    ['Income tax expense', tax],
    ['Loss after income tax expense for the year', netResult],
  ];
  const missing = required.filter(([, value]) => value === null).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return {
      page_number: page.page_number,
      unit,
      revenue: 0,
      interest_income: 0,
      other_income: 0,
      total_revenue: 0,
      loss_on_disposed_assets: 0,
      fuel: 0,
      electricity_and_energy_services: 0,
      services_and_consultants: 0,
      finance_costs: 0,
      employee_benefit_expense: 0,
      raw_materials_and_consumables: 0,
      capacity_payments_and_operating_leases: 0,
      other_expenses: 0,
      fair_value_through_profit_loss: 0,
      depreciation_and_amortisation: 0,
      impairment_losses: 0,
      provision_remeasurements: 0,
      total_expenses: 0,
      loss_before_tax: 0,
      income_tax_expense: 0,
      net_result: 0,
      checks,
      warnings,
      errors,
    };
  }

  const totalRevenue = (revenue as number) + (interest as number) + (otherIncome as number);
  const totalExpenses =
    Math.abs(lossDisposed as number) +
    Math.abs(fuel as number) +
    Math.abs(electricity as number) +
    Math.abs(services as number) +
    Math.abs(finance as number) +
    Math.abs(employee as number) +
    Math.abs(rawMaterials as number) +
    Math.abs(capacity as number) +
    Math.abs(other as number) +
    Math.abs(fairValue as number) +
    Math.abs(depreciation as number) +
    Math.abs(impairment as number) +
    Math.abs(provision as number);

  checks.push(
    `income components exact: ${revenue} + ${interest} + ${otherIncome} = ${totalRevenue} (the derived total revenue)`,
  );
  checks.push(
    `expense components exact: ${Math.abs(lossDisposed as number)} + ${Math.abs(fuel as number)} + ${Math.abs(electricity as number)} + ${Math.abs(services as number)} + ${Math.abs(finance as number)} + ${Math.abs(employee as number)} + ${Math.abs(rawMaterials as number)} + ${Math.abs(capacity as number)} + ${Math.abs(other as number)} + ${Math.abs(fairValue as number)} + ${Math.abs(depreciation as number)} + ${Math.abs(impairment as number)} + ${Math.abs(provision as number)} = ${totalExpenses} (the derived total expenses)`,
  );

  const pbtBridge = totalRevenue - totalExpenses;
  if (pbtBridge !== pbt) {
    errors.push(
      `profit-before-tax bridge mismatch: ${totalRevenue} - ${totalExpenses} = ${pbtBridge}, printed Loss before income tax expense ${pbt}`,
    );
  } else {
    checks.push(
      `profit-before-tax bridge exact: ${totalRevenue} - ${totalExpenses} = ${pbtBridge}`,
    );
  }

  const netBridge = (pbt as number) + (tax as number);
  if (netBridge !== netResult) {
    errors.push(
      `net-result bridge mismatch: ${pbt} + ${tax} = ${netBridge}, printed Loss after income tax expense for the year ${netResult}`,
    );
  } else {
    checks.push(`net-result bridge exact: ${pbt} + ${tax} = ${netBridge}`);
  }

  warnings.push(
    "the consolidated statement has no printed Total revenue or Total expenses subtotal; total revenue is the exact sum of the printed income lines (Revenue + Interest income + Other income); total expenses is the exact sum of the printed expense lines plus Loss on disposed assets, and is accepted only because both totals bridge to the printed Loss before income tax expense and the printed Loss after income tax expense for the year with zero tolerance",
  );

  return {
    page_number: page.page_number,
    unit,
    revenue: revenue as number,
    interest_income: interest as number,
    other_income: otherIncome as number,
    total_revenue: totalRevenue,
    loss_on_disposed_assets: Math.abs(lossDisposed as number),
    fuel: Math.abs(fuel as number),
    electricity_and_energy_services: Math.abs(electricity as number),
    services_and_consultants: Math.abs(services as number),
    finance_costs: Math.abs(finance as number),
    employee_benefit_expense: Math.abs(employee as number),
    raw_materials_and_consumables: Math.abs(rawMaterials as number),
    capacity_payments_and_operating_leases: Math.abs(capacity as number),
    other_expenses: Math.abs(other as number),
    fair_value_through_profit_loss: Math.abs(fairValue as number),
    depreciation_and_amortisation: Math.abs(depreciation as number),
    impairment_losses: Math.abs(impairment as number),
    provision_remeasurements: Math.abs(provision as number),
    total_expenses: totalExpenses,
    loss_before_tax: pbt as number,
    income_tax_expense: tax as number,
    net_result: netResult as number,
    checks,
    warnings,
    errors,
  };
}

export interface CsEnergyParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface CsEnergyDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation' | 'notes';
}

export interface CsEnergyLineSpec {
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

export interface CsEnergyParseResult {
  records: SpendingRecord[];
  deferral: CsEnergyDeferral | null;
  statement: CsEnergyStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function csEnergyNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${CS_ENERGY_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.abs(thousands) * CS_ENERGY_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: CsEnergyParseContext,
  spec: CsEnergyLineSpec,
  statement: CsEnergyStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${CS_ENERGY_UNIT_LABEL} (${CS_ENERGY_UNIT}; x${CS_ENERGY_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; consolidated CS Energy parent; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, Energy Queensland, another QLD GOC, a QLD total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: CsEnergyLineSpec,
  context: CsEnergyParseContext,
  statement: CsEnergyStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: CS_ENERGY_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: csEnergyNaturalKey(
      CS_ENERGY_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${CS_ENERGY_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: CS_ENERGY_JURISDICTION,
    delivery_entity: CS_ENERGY_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `CS Energy Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: CS_ENERGY_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: CS_ENERGY_UNIT,
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

export function parseCsEnergyExtraction(
  extraction: PdfExtraction,
  context: CsEnergyParseContext,
): CsEnergyParseResult {
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
  const statement = parseCsEnergyStatement(statementPage);
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

  const lineSpecs: CsEnergyLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: CS_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Derived from the printed Revenue + Interest income + Other income lines. No printed Total revenue subtotal exists; the derived total is accepted only because it bridges exactly to the printed Loss before income tax expense.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: CS_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Exact sum of the printed expense lines plus Loss on disposed assets (fuel, electricity and energy services, services and consultants, finance costs, employee benefit expense, raw materials and consumables, capacity payments and operating leases, other expenses, fair value through profit/(loss), depreciation and amortisation, impairment losses and provision remeasurements). Accepted only because Total revenue less total expenses equals the printed Loss before income tax expense.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefit expense',
      amount_thousands: statement.employee_benefit_expense,
      funding_source: CS_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Employee benefit expense. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_thousands: statement.depreciation_and_amortisation,
      funding_source: CS_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Depreciation and amortisation. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'net_result',
      label: 'Loss after income tax expense for the year',
      amount_thousands: statement.net_result,
      funding_source: CS_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Loss after income tax expense for the year (net result), a printed negative retained as a non-negative magnitude with soc_printed_sign negative. A result line, not an expense component; never add to revenue or expenses.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; total revenue and total expenses are derived from the printed lines and reconcile exactly to the printed loss-before-tax and net-result bridges.',
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

export interface CsEnergyConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: CsEnergyAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf(?:\.aspx)?$/i.test(name)) return name.replace(/\.aspx$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'cs-energy-annual-report.pdf';
}

/**
 * Operator escape hatch: when `CS_ENERGY_ANNUAL_REPORT_URL` is set, it is used
 * as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): CsEnergyAnnualReportLink | null {
  const url = process.env.CS_ENERGY_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'CS-Energy-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const yearMatch = /annual[\s_\-–]*report[\s_\-–]*(20\d{2})/i.exec(filename);
  const fiscalYear = yearMatch
    ? csEnergyFiscalYearFromReportYear(Number(yearMatch[1]))
    : null;
  if (!fiscalYear) {
    throw new Error(
      `CS_ENERGY_ANNUAL_REPORT_URL filename "${filename}" has no report year; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename: filename.replace(/\.aspx$/i, ''),
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: CS_ENERGY_SOURCE_URL,
  };
}

async function recordDeferral(
  document: CsEnergyAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: CsEnergyDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: CS_ENERGY_ID, document_url: document.url },
    {
      $set: {
        entity: CS_ENERGY_ENTITY,
        jurisdiction: CS_ENERGY_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the CS Energy SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live CS Energy connector. */
export function createCsEnergyConnector(options: CsEnergyConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: CS_ENERGY_ID,
    name: CS_ENERGY_NAME,
    publisher: CS_ENERGY_PUBLISHER,
    source_url: CS_ENERGY_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: CS_ENERGY_LICENSE,
    notes:
      "QLD SOC: CS Energy Limited only, a Queensland Government Owned Corporation (GOC). The latest annual report is discovered from CS Energy's official annual-reports page (no hard-coded PDF URL). The exact PDF is SHA-256 archived outside the repo. The consolidated statement prints an explicit $'000 unit; it has no printed Total revenue or Total expenses subtotal, so total revenue is the exact sum of Revenue + Interest income + Other income and total expenses is the exact sum of the printed expense lines plus Loss on disposed assets. Both are accepted only when they bridge to the printed Loss before income tax expense and Loss after income tax expense for the year with zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level \"soc\", aggregation_role \"agency_detail\"). CS Energy is never added to government program spending, the PNFC benchmark, Energy Queensland, another QLD GOC, a QLD total, or another SOC line.",
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverCsEnergyAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`CS Energy PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: CS_ENERGY_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'CS Energy annual-report PDF; archived for auditable QLD SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: CsEnergyParseContext = {
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
      const parsed = parseCsEnergyExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'qld-cs-energy-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'qld-cs-energy-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a CS Energy measure; skipped');
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
