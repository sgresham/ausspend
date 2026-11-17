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
 * NSW SOC Phase 4 — Hunter Water Corporation annual-report adapter.
 *
 * This reuses the established NSW SOC layer: one entity adapter, not a second
 * framework.
 *
 * Source gate:
 * - The document is discovered from Hunter Water's own reports/publications
 *   page (no PDF URL is hard-coded).
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The printed unit must be explicit. The Income Statement prints "$'000" in
 *   both column headers and the Basis of preparation states all amounts are
 *   rounded to the nearest thousand dollars. A table read as dollars is
 *   rejected, not converted by magnitude.
 * - Total expenses is the explicit printed Total expenses line (418,326 $'000
 *   for the Corporation in 2024-25). It is accepted only when the printed
 *   expense components reconcile exactly (the printed asset-revaluation
 *   increment of 7 is a signed reduction of expenses), the printed revenue
 *   components equal Total revenue, and Total revenue + Total expenses equals
 *   the printed Profit before income tax with zero tolerance.
 * - The audited statement prints NPAT 19,406 while PBT 28,723 less the printed
 *   income tax expense 9,316 is 19,407. That one-dollar printed arithmetic
 *   rounding is recorded as a warning and the printed NPAT is retained as the
 *   net-result line; it is not used in any reconciliation and is flagged for a
 *   human spot-check.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. SOC rows
 * are never added to government program spending, to the PNFC benchmark, or to
 * each other.
 */

export const HUNTER_WATER_ID = 'hunter-water';
export const HUNTER_WATER_NAME = 'Hunter Water — Annual Report';
export const HUNTER_WATER_PUBLISHER = 'Hunter Water Corporation';
export const HUNTER_WATER_ENTITY = 'Hunter Water';
export const HUNTER_WATER_JURISDICTION = 'NSW';
export const HUNTER_WATER_SOURCE_URL =
  'https://www.hunterwater.com.au/about/publications/reports-and-publications';
export const HUNTER_WATER_LICENSE =
  '© Hunter Water Corporation. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const HUNTER_WATER_UNIT = 'AUD_thousands';
export const HUNTER_WATER_UNIT_LABEL = "$'000";
export const HUNTER_WATER_UNIT_TO_CENTS = 100_000;
export const HUNTER_WATER_CAVEAT =
  'Entity-level SOC statement lines for Hunter Water only. Never add to government program spending, to the PNFC sector benchmark, or to each other: total revenue includes the separately shown government grants and rebates; total expenses includes operational, depreciation/amortisation, finance, superannuation, revaluation and other lines. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the URL; parse the page. */
export interface HunterWaterAnnualReportLink {
  /** Exact official Hunter Water PDF URL, stored as row provenance/source_url. */
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  /** Official publications page the PDF was discovered from. */
  discovery_page: string;
}

export interface HunterWaterAnnualReportPageLink {
  url: string;
  report_year: number;
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

function fiscalYearFromMatch(start: number, end: number): string | null {
  const endFull = end < 100 ? Math.floor(start / 100) * 100 + end : end;
  if (endFull !== start + 1) return null;
  return `${start}-${String(endFull % 100).padStart(2, '0')}`;
}

/**
 * Discover the Hunter Water "annual report <year>" sub-pages from the official
 * reports-and-publications page. The page for calendar year N covers the
 * financial year ended 30 June N.
 */
export function parseHunterWaterAnnualReportPageLinks(
  html: string,
  baseUrl = HUNTER_WATER_SOURCE_URL,
): HunterWaterAnnualReportPageLink[] {
  const links: HunterWaterAnnualReportPageLink[] = [];
  const seen = new Set<string>();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const raw = match[1];
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    const yearMatch = /\/annual-report-(20\d{2})\/?$/i.exec(url.pathname);
    if (!yearMatch) continue;
    const key = `${url.origin}${url.pathname.replace(/\/$/, '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ url: key, report_year: Number(yearMatch[1]) });
  }
  return links.sort((a, b) => b.report_year - a.report_year);
}

/**
 * Discover the annual-report PDFs on a Hunter Water annual-report sub-page.
 * The CRFD/other PDFs are excluded; only the annual-report PDF is accepted.
 */
export function parseHunterWaterAnnualReportPdfLinks(
  html: string,
  pageUrl: string,
): HunterWaterAnnualReportLink[] {
  const links: HunterWaterAnnualReportLink[] = [];
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
    if (/crfd|half[-_ ]?year|statement[-_ ]?of[-_ ]?corporate[-_ ]?intent/i.test(filename)) {
      continue;
    }
    const yearMatch = /annual[-_ ]?report[-_ ]?(20\d{2})[-_ ]?(\d{2,4})/i.exec(filename);
    if (!yearMatch) continue;
    const fiscalYear = fiscalYearFromMatch(Number(yearMatch[1]), Number(yearMatch[2]));
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

/** Fetch the reports page, then its latest annual-report page, and return the PDF. */
export async function discoverHunterWaterAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl = HUNTER_WATER_SOURCE_URL,
): Promise<HunterWaterAnnualReportLink> {
  const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(`Hunter Water publications page HTTP ${response.status} for ${pageUrl}`);
  }
  const html = await response.text();
  const pageLinks = parseHunterWaterAnnualReportPageLinks(html, pageUrl);
  const latestPage = pageLinks[0];
  if (!latestPage) {
    throw new Error(
      'Hunter Water publications page contains no annual-report page link; refusing to hard-code a URL',
    );
  }
  const pageResponse = await fetchImpl(latestPage.url, {
    redirect: 'follow',
    headers: BROWSER_HEADERS,
  });
  if (!pageResponse.ok) {
    throw new Error(
      `Hunter Water annual-report page HTTP ${pageResponse.status} for ${latestPage.url}`,
    );
  }
  const pageHtml = await pageResponse.text();
  const links = parseHunterWaterAnnualReportPdfLinks(pageHtml, latestPage.url);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Hunter Water annual-report page contains no annual-report PDF link; refusing to hard-code a URL',
    );
  }
  return latest;
}

/** Convert "year ended 30 June 2025" into the API fiscal year "2024-25". */
export function fiscalYearFromEndDate(endDate: string): string | null {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(endDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

interface PageRow {
  y: number;
  items: PdfTextItem[];
  cells: string[];
}

function groupPageRows(items: readonly PdfTextItem[], tolerance = 3): PageRow[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const item of sorted) {
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

/** Anchor the current-year money column on the leftmost numeric cell of a printed row. */
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

function valueNear(row: PageRow, anchor: number, tolerance = 12): number | null {
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

function valueFor(rows: readonly PageRow[], label: string, anchor: number): number | null {
  const row = findRow(rows, label);
  return row ? valueNear(row, anchor) : null;
}

/** Detect the printed unit from the statement header/unit rows. */
export function detectHunterWaterUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface HunterWaterStatement {
  page_number: number;
  unit: UnitDetection;
  services_revenue: number;
  other_income: number;
  total_revenue: number;
  operational_expenses: number;
  depreciation_amortisation: number;
  finance_costs: number;
  superannuation_expense: number;
  asset_revaluation_increment: number;
  other_expenses: number;
  total_expenses: number;
  profit_before_tax: number;
  income_tax_expense: number;
  profit_after_tax: number;
  profit_for_year: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('income statement for the year ended') &&
      text.includes('profit before income tax')
    ) {
      return page;
    }
  }
  return null;
}

export function parseHunterWaterStatement(page: PdfPage): HunterWaterStatement | null {
  const rows = groupPageRows(page.items);
  const titleRow = rows.find((row) =>
    /income statement for the year ended/i.test(row.cells.join(' ')),
  );
  if (!titleRow) return null;

  const unitRows = rows.filter((row) =>
    row.cells.some((cell) => cell.includes('$') || /['’]0{3}/.test(cell)),
  );
  const unit = detectMoneyUnit(unitRows.map((row) => row.cells.join(' ')));

  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Total revenue');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed Total revenue row',
    );
    return null;
  }
  if (unit.kind !== 'thousands') {
    errors.push(
      `printed unit is not explicit thousands (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $'000 statement as dollars`,
    );
  }

  const services = valueFor(rows, 'Services', anchor);
  const otherIncome = valueFor(rows, 'Other income', anchor);
  const totalRevenue = valueFor(rows, 'Total revenue', anchor);
  const operational = valueFor(rows, 'Operational expenses', anchor);
  const depreciation = valueFor(rows, 'Depreciation and amortisation', anchor);
  const financeCosts = valueFor(rows, 'Finance costs', anchor);
  const superannuation = valueFor(rows, 'Superannuation expense', anchor);
  const revaluation = valueFor(rows, 'Asset revaluation increment/(decrement)', anchor);
  const otherExpenses = valueFor(rows, 'Other', anchor);
  const totalExpenses = valueFor(rows, 'Total expenses', anchor);
  const pbt = valueFor(rows, 'Profit before income tax', anchor);
  const tax = valueFor(rows, 'Income tax expense', anchor);
  const profitAfterTax = valueFor(rows, 'Profit after income tax', anchor);
  const profitForYear = valueFor(rows, 'Profit for the year', anchor);

  if (
    services === null ||
    otherIncome === null ||
    totalRevenue === null ||
    operational === null ||
    depreciation === null ||
    financeCosts === null ||
    superannuation === null ||
    revaluation === null ||
    otherExpenses === null ||
    totalExpenses === null ||
    pbt === null ||
    tax === null ||
    profitAfterTax === null ||
    profitForYear === null
  ) {
    errors.push('statement is missing one or more required printed lines');
    return {
      page_number: page.page_number,
      unit,
      services_revenue: 0,
      other_income: 0,
      total_revenue: 0,
      operational_expenses: 0,
      depreciation_amortisation: 0,
      finance_costs: 0,
      superannuation_expense: 0,
      asset_revaluation_increment: 0,
      other_expenses: 0,
      total_expenses: 0,
      profit_before_tax: 0,
      income_tax_expense: 0,
      profit_after_tax: 0,
      profit_for_year: 0,
      checks,
      warnings,
      errors,
    };
  }

  // Zero-tolerance printed bridges, all in $'000. The revaluation line is
  // printed as a positive increment that reduces total expenses, so it is
  // included with its printed sign rather than as an absolute amount.
  const revenueComponents = services + otherIncome;
  if (revenueComponents !== totalRevenue) {
    errors.push(
      `revenue components mismatch: ${services} + ${otherIncome} = ${revenueComponents}, printed Total revenue ${totalRevenue}`,
    );
  } else {
    checks.push(`revenue components exact: ${services} + ${otherIncome} = ${totalRevenue}`);
  }

  const expenseComponents =
    operational + depreciation + financeCosts + superannuation + revaluation + otherExpenses;
  if (expenseComponents !== totalExpenses) {
    errors.push(
      `expense components mismatch: ${operational} + ${depreciation} + ${financeCosts} + ${superannuation} + ${revaluation} + ${otherExpenses} = ${expenseComponents}, printed Total expenses ${totalExpenses}`,
    );
  } else {
    checks.push(
      `expense components exact: ${operational} + ${depreciation} + ${financeCosts} + ${superannuation} + ${revaluation} + ${otherExpenses} = ${totalExpenses}`,
    );
  }

  if (totalRevenue + totalExpenses !== pbt) {
    errors.push(
      `profit-before-tax bridge mismatch: ${totalRevenue} + (${totalExpenses}) = ${totalRevenue + totalExpenses}, printed Profit before income tax ${pbt}`,
    );
  } else {
    checks.push(`profit-before-tax bridge exact: ${totalRevenue} + (${totalExpenses}) = ${pbt}`);
  }

  if (profitAfterTax !== profitForYear) {
    errors.push(
      `profit lines mismatch: Profit after income tax ${profitAfterTax}, Profit for the year ${profitForYear}`,
    );
  } else {
    checks.push(`profit lines agree: ${profitAfterTax} = ${profitForYear}`);
  }

  const taxArithmetic = pbt + tax;
  if (taxArithmetic !== profitForYear) {
    warnings.push(
      `printed audited statement arithmetic: Profit before income tax ${pbt} + income tax expense ${tax} = ${taxArithmetic}, but the printed Profit for the year is ${profitForYear} (difference ${profitForYear - taxArithmetic}). The printed NPAT line is retained as-is as the net result and is NOT used in any reconciliation; human spot-check required.`,
    );
  } else {
    checks.push(`net-result bridge exact: ${pbt} + (${tax}) = ${profitForYear}`);
  }

  checks.push(
    `total expenses is the explicit printed Total expenses line: ${Math.abs(totalExpenses)} $'000 (current-year column)`,
  );

  return {
    page_number: page.page_number,
    unit,
    services_revenue: services,
    other_income: otherIncome,
    total_revenue: totalRevenue,
    operational_expenses: operational,
    depreciation_amortisation: depreciation,
    finance_costs: financeCosts,
    superannuation_expense: superannuation,
    asset_revaluation_increment: revaluation,
    other_expenses: otherExpenses,
    total_expenses: totalExpenses,
    profit_before_tax: pbt,
    income_tax_expense: tax,
    profit_after_tax: profitAfterTax,
    profit_for_year: profitForYear,
    checks,
    warnings,
    errors,
  };
}

export interface HunterWaterRevenueNote {
  page_number: number;
  unit: UnitDetection;
  government_grants_and_rebates: number | null;
  errors: string[];
}

export interface HunterWaterOperationalNote {
  page_number: number;
  unit: UnitDetection;
  employee_related: number | null;
  maintenance: number | null;
  operations: number | null;
  regulatory: number | null;
  corporate: number | null;
  other: number | null;
  errors: string[];
}

function findRevenueNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (text.includes('note 2. revenue') && text.includes('government grants and rebates')) {
      return page;
    }
  }
  return null;
}

function findOperationalNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (text.includes('note 3. operational expenses') && text.includes('employee related')) {
      return page;
    }
  }
  return null;
}

export function parseHunterWaterRevenueNote(page: PdfPage): HunterWaterRevenueNote {
  const rows = groupPageRows(page.items);
  const anchor = columnAnchor(rows, 'Tariff - service charges');
  const unit = detectMoneyUnit(
    rows
      .filter((row) => row.cells.some((cell) => /\$\s*['’]?0{3}/.test(cell)))
      .map((row) => row.cells.join(' ')),
  );
  const errors: string[] = [];
  if (unit.kind !== 'thousands') {
    errors.push(`revenue note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`);
  }
  if (anchor === null) errors.push('revenue note current-year money column could not be anchored');
  const grants = anchor === null ? null : valueFor(rows, 'Government grants and rebates', anchor);
  if (grants === null) errors.push('government grants and rebates row could not be parsed');
  return {
    page_number: page.page_number,
    unit,
    government_grants_and_rebates: grants,
    errors,
  };
}

export function parseHunterWaterOperationalNote(page: PdfPage): HunterWaterOperationalNote {
  const rows = groupPageRows(page.items);
  const anchor = columnAnchor(rows, 'Employee related');
  const unit = detectMoneyUnit(
    rows
      .filter((row) => row.cells.some((cell) => /\$\s*['’]?0{3}/.test(cell)))
      .map((row) => row.cells.join(' ')),
  );
  const errors: string[] = [];
  if (unit.kind !== 'thousands') {
    errors.push(
      `operational-expenses note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`,
    );
  }
  if (anchor === null)
    errors.push('operational-expenses note current-year money column could not be anchored');
  const read = (label: string): number | null =>
    anchor === null ? null : valueFor(rows, label, anchor);
  const employeeRelated = read('Employee related');
  const maintenance = read('Maintenance');
  const operations = read('Operations');
  const regulatory = read('Regulatory');
  const corporate = read('Corporate');
  const other = read('Other');
  if (
    employeeRelated === null ||
    maintenance === null ||
    operations === null ||
    regulatory === null ||
    corporate === null ||
    other === null
  ) {
    errors.push('one or more printed operational-expenses note rows could not be parsed');
  }
  return {
    page_number: page.page_number,
    unit,
    employee_related: employeeRelated,
    maintenance,
    operations,
    regulatory,
    corporate,
    other,
    errors,
  };
}

export interface HunterWaterParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface HunterWaterDeferral {
  reason: string;
  phase: 'discovery' | 'unit' | 'statement' | 'notes' | 'reconciliation';
}

export interface HunterWaterParseResult {
  records: SpendingRecord[];
  deferral: HunterWaterDeferral | null;
  statement: HunterWaterStatement | null;
  revenue_note: HunterWaterRevenueNote | null;
  operational_note: HunterWaterOperationalNote | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export interface HunterWaterLineSpec {
  line_item: string;
  label: string;
  amount_thousands: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result';
  detail: string;
}

export function hunterWaterNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${HUNTER_WATER_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.round(thousands * HUNTER_WATER_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: HunterWaterParseContext,
  spec: HunterWaterLineSpec,
  statement: HunterWaterStatement,
  revenueNote: HunterWaterRevenueNote,
  operationalNote: HunterWaterOperationalNote,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${HUNTER_WATER_UNIT_LABEL} (${HUNTER_WATER_UNIT}; x${HUNTER_WATER_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `revenue_note_page: ${revenueNote.page_number}`,
    `operational_note_page: ${operationalNote.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: HunterWaterLineSpec,
  context: HunterWaterParseContext,
  statement: HunterWaterStatement,
  revenueNote: HunterWaterRevenueNote,
  operationalNote: HunterWaterOperationalNote,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: HUNTER_WATER_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: hunterWaterNaturalKey(
      HUNTER_WATER_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${HUNTER_WATER_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: HUNTER_WATER_JURISDICTION,
    delivery_entity: HUNTER_WATER_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Hunter Water Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: HUNTER_WATER_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: HUNTER_WATER_UNIT,
    potential_double_count: spec.potential_double_count,
    notes: notesFor(context, spec, statement, revenueNote, operationalNote, {
      section: spec.section,
      revenue_thousands: statement.total_revenue,
      total_expenses_thousands: statement.total_expenses,
      net_result_thousands: statement.profit_for_year,
      ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

export function parseHunterWaterExtraction(
  extraction: PdfExtraction,
  context: HunterWaterParseContext,
): HunterWaterParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
    return {
      records: [],
      deferral: {
        reason: 'no parseable Income Statement found in the PDF',
        phase: 'statement',
      },
      statement: null,
      revenue_note: null,
      operational_note: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const statement = parseHunterWaterStatement(statementPage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason: 'Income Statement page found but required printed lines could not be parsed',
        phase: 'statement',
      },
      statement: null,
      revenue_note: null,
      operational_note: null,
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
      revenue_note: null,
      operational_note: null,
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
      revenue_note: null,
      operational_note: null,
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
      revenue_note: null,
      operational_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }

  const revenuePage = findRevenueNotePage(extraction.pages);
  if (!revenuePage) {
    return {
      records: [],
      deferral: {
        reason: 'the Note 2 revenue table needed to verify government grants could not be located',
        phase: 'notes',
      },
      statement,
      revenue_note: null,
      operational_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }
  const revenueNote = parseHunterWaterRevenueNote(revenuePage);
  const operationalPage = findOperationalNotePage(extraction.pages);
  if (!operationalPage) {
    return {
      records: [],
      deferral: {
        reason:
          'the Note 3 operational-expenses table needed to verify employee expenses could not be located',
        phase: 'notes',
      },
      statement,
      revenue_note: revenueNote,
      operational_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number, revenueNote.page_number],
    };
  }
  const operationalNote = parseHunterWaterOperationalNote(operationalPage);
  const pagesUsed = [
    statementPage.page_number,
    revenueNote.page_number,
    operationalNote.page_number,
  ];
  if (revenueNote.unit.kind !== 'thousands') {
    return {
      records: [],
      deferral: {
        reason: `revenue note on page ${revenueNote.page_number} is not explicit thousands: ${revenueNote.unit.reason}`,
        phase: 'unit',
      },
      statement,
      revenue_note: revenueNote,
      operational_note: operationalNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  if (operationalNote.unit.kind !== 'thousands') {
    return {
      records: [],
      deferral: {
        reason: `operational-expenses note on page ${operationalNote.page_number} is not explicit thousands: ${operationalNote.unit.reason}`,
        phase: 'unit',
      },
      statement,
      revenue_note: revenueNote,
      operational_note: operationalNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  if (revenueNote.errors.length > 0) {
    return {
      records: [],
      deferral: {
        reason: `revenue note parse failed: ${revenueNote.errors.join('; ')}`,
        phase: 'notes',
      },
      statement,
      revenue_note: revenueNote,
      operational_note: operationalNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  if (operationalNote.errors.length > 0) {
    return {
      records: [],
      deferral: {
        reason: `operational-expenses note parse failed: ${operationalNote.errors.join('; ')}`,
        phase: 'notes',
      },
      statement,
      revenue_note: revenueNote,
      operational_note: operationalNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  const employee = operationalNote.employee_related;
  const componentSum =
    (operationalNote.employee_related ?? 0) +
    (operationalNote.maintenance ?? 0) +
    (operationalNote.operations ?? 0) +
    (operationalNote.regulatory ?? 0) +
    (operationalNote.corporate ?? 0) +
    (operationalNote.other ?? 0);
  if (employee === null || componentSum !== Math.abs(statement.operational_expenses)) {
    return {
      records: [],
      deferral: {
        reason: `Note 3 operational-expenses mismatch: ${componentSum}, statement Operational expenses ${Math.abs(statement.operational_expenses)}`,
        phase: 'reconciliation',
      },
      statement,
      revenue_note: revenueNote,
      operational_note: operationalNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  const grants = revenueNote.government_grants_and_rebates;
  if (grants === null) {
    return {
      records: [],
      deferral: {
        reason: 'Note 2 government grants and rebates row could not be parsed',
        phase: 'notes',
      },
      statement,
      revenue_note: revenueNote,
      operational_note: operationalNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  const checks = [
    ...statement.checks,
    `Note 3 operational-expenses subtotal exact: ${operationalNote.employee_related} + ${operationalNote.maintenance} + ${operationalNote.operations} + ${operationalNote.regulatory} + ${operationalNote.corporate} + ${operationalNote.other} = ${Math.abs(statement.operational_expenses)}`,
  ];

  const lineSpecs: HunterWaterLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: HUNTER_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total revenue. Includes the separately shown Government grants and rebates line, which is never added again.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: Math.abs(statement.total_expenses),
      funding_source: HUNTER_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Explicit printed Total expenses (negative in the statement, stored as a positive expense). Accepted only because the printed operational, depreciation/amortisation, finance, superannuation, signed revaluation and other lines sum to it exactly and Total revenue + Total expenses equals the printed Profit before income tax.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee related expenses',
      amount_thousands: employee,
      funding_source: HUNTER_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Note 3 Operational expenses — Employee related, a component of Operational expenses and therefore of Total expenses; never add to Total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_thousands: Math.abs(statement.depreciation_amortisation),
      funding_source: HUNTER_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Income Statement Depreciation and amortisation. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'government_grants_and_rebates',
      label: 'Government grants and rebates',
      amount_thousands: grants,
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'revenue',
      detail:
        'Separately disclosed in Note 2 Revenue and already included in Total revenue. May overlap NSW government program spending; never add it to the total.',
    },
    {
      line_item: 'net_result',
      label: 'Profit after income tax',
      amount_thousands: statement.profit_for_year,
      funding_source: HUNTER_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit after income tax / Profit for the year (net result). A result line, not an expense component; never add to revenue or expenses. The audited statement has a one-dollar printed tax arithmetic rounding (PBT 28,723 − tax 9,316 = 19,407, printed NPAT 19,406); the printed NPAT is retained as-is and flagged for human spot-check.',
    },
  ];

  const records = lineSpecs.map((spec) =>
    mapLine(spec, context, statement, revenueNote, operationalNote),
  );
  warnings.push(
    'SOC entity rows are provisional and unverified; Total expenses is the explicit printed total and reconciles exactly to its printed components and the profit-before-tax bridge.',
  );
  return {
    records,
    deferral: null,
    statement,
    revenue_note: revenueNote,
    operational_note: operationalNote,
    checks,
    warnings,
    pages_used: pagesUsed,
  };
}

export interface HunterWaterConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: HunterWaterAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'hunter-water-annual-report.pdf';
}

/**
 * Operator escape hatch: when `HUNTER_WATER_ANNUAL_REPORT_URL` is set, it is
 * used as the exact official PDF URL. The default path is live discovery from
 * the official reports page.
 */
function documentFromEnv(): HunterWaterAnnualReportLink | null {
  const url = process.env.HUNTER_WATER_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Hunter-Water-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const yearMatch = /(20\d{2})[-_ ]?(\d{2,4})/.exec(filename);
  const fiscalYear = yearMatch
    ? fiscalYearFromMatch(Number(yearMatch[1]), Number(yearMatch[2]))
    : null;
  if (!fiscalYear) {
    throw new Error(
      `HUNTER_WATER_ANNUAL_REPORT_URL filename "${filename}" has no report year; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: HUNTER_WATER_SOURCE_URL,
  };
}

async function recordDeferral(
  document: HunterWaterAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: HunterWaterDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: HUNTER_WATER_ID, document_url: document.url },
    {
      $set: {
        entity: HUNTER_WATER_ENTITY,
        jurisdiction: HUNTER_WATER_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Hunter Water SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Hunter Water connector. */
export function createHunterWaterConnector(options: HunterWaterConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: HUNTER_WATER_ID,
    name: HUNTER_WATER_NAME,
    publisher: HUNTER_WATER_PUBLISHER,
    source_url: HUNTER_WATER_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: HUNTER_WATER_LICENSE,
    notes:
      'NSW SOC Phase 4: Hunter Water Corporation only. The latest annual report is discovered from Hunter Water\'s official reports/publications page (no hard-coded PDF URL), SHA-256 archived outside the repo, and parsed for the audited Income Statement. The printed unit must be explicit $\'000; Total expenses is an explicit printed total accepted only when its printed components, the Note 3 operational-expenses subtotal and the revenue/expense profit-before-tax bridge reconcile exactly. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). SOC rows are never added to government program spending, the PNFC benchmark, or each other. Other SOCs are not implemented.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverHunterWaterAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Hunter Water PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: HUNTER_WATER_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Hunter Water annual-report PDF; archived for auditable NSW SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: HunterWaterParseContext = {
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
      const parsed = parseHunterWaterExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'hunter-water-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'hunter-water-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Hunter Water measure; skipped');
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
