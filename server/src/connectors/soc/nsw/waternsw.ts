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
 * NSW SOC Phase 3 — WaterNSW (Water NSW) annual-report adapter.
 *
 * This reuses the Sydney Water SOC layer: it adds one entity adapter, not a
 * second framework.
 *
 * Source gate:
 * - The document is discovered from WaterNSW's own annual-report page; no PDF
 *   URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The printed unit must be explicit. The face statement prints "$’000" in
 *   every column header and the Basis of preparation states all values are
 *   rounded to the nearest thousand dollars. A table read as dollars is
 *   rejected, not converted by magnitude.
 * - Total expenses is an explicit printed total (472,831 $’000 for the
 *   consolidated entity in 2024-25). It is accepted only when the printed
 *   revenue components, expense components, operating profit, profit-before-tax
 *   bridge, tax and net result all reconcile to the same integer thousands with
 *   zero tolerance. The same zero-tolerance approach was approved for Sydney
 *   Water; no figure is invented.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. SOC rows
 * are never added to government program spending, to the PNFC benchmark, or to
 * each other.
 */

export const WATERNSW_ID = 'waternsw';
export const WATERNSW_NAME = 'WaterNSW — Annual Report';
export const WATERNSW_PUBLISHER = 'WaterNSW (Water NSW)';
/** Canonical delivery entity. "Water NSW" is the same entity, an alias. */
export const WATERNSW_ENTITY = 'WaterNSW';
export const WATERNSW_JURISDICTION = 'NSW';
export const WATERNSW_SOURCE_URL =
  'https://www.waternsw.com.au/about-us/our-business/corporate-governance/annual-reports';
export const WATERNSW_LICENSE =
  '© WaterNSW. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const WATERNSW_UNIT = 'AUD_thousands';
export const WATERNSW_UNIT_LABEL = '$’000';
export const WATERNSW_UNIT_TO_CENTS = 100_000;
export const WATERNSW_CAVEAT =
  'Entity-level SOC statement lines for WaterNSW only. Never add to government program spending, to the PNFC sector benchmark, or to each other: total revenue includes the separately shown government grants; total expenses includes employee, depreciation/amortisation, other operating and finance-cost lines. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the URL; parse the page. */
export interface WaterNswAnnualReportLink {
  /** Exact official WaterNSW PDF URL, stored as row provenance/source_url. */
  url: string;
  /**
   * Optional mirror used only when the official host bot-blocks the download.
   * It is not stored as source_url; the archive records it as retrieved_from.
   */
  download_url?: string;
  filename: string;
  fiscal_year: string;
  title: string;
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
 * Discover annual-report PDFs from the WaterNSW annual-report page HTML.
 * Half-yearly reports and the Statement of Corporate Intent are excluded.
 */
export function parseWaterNswAnnualReportLinks(
  html: string,
  baseUrl = WATERNSW_SOURCE_URL,
): WaterNswAnnualReportLink[] {
  const links: WaterNswAnnualReportLink[] = [];
  const seen = new Set<string>();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const raw = match[1];
    if (!raw || !/\.pdf(?:$|[?#])/i.test(raw)) continue;
    let url: URL;
    try {
      url = new URL(raw, baseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    const filename = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    if (/half[-_ ]?year(?:ly)?/i.test(filename)) continue;
    if (!/water[-_ ]?nsw/i.test(filename)) continue;
    // e.g. WaterNSW-Annual-Report-2024-2025.pdf or WaterNSW_Annual-Report-2023-24.pdf
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
    });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/** Fetch the annual-report page and return the latest discovered PDF. */
export async function discoverWaterNswAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl = WATERNSW_SOURCE_URL,
): Promise<WaterNswAnnualReportLink> {
  const response = await fetchImpl(pageUrl, {
    redirect: 'follow',
    headers: BROWSER_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`WaterNSW annual-report page HTTP ${response.status} for ${pageUrl}`);
  }
  const html = await response.text();
  const links = parseWaterNswAnnualReportLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'WaterNSW annual-report page contains no annual-report PDF link; refusing to hard-code a URL',
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

/**
 * The 2024-25 face statement prints four numeric columns side by side:
 * Consolidated 2025, Consolidated 2024, Parent 2025, Parent 2024. The
 * consolidated current-year column is the leftmost money column. Anchor it on
 * the printed "Total revenue" row so note-number cells ("2", "3", "5", …) and
 * the parent/comparative columns are never read as the current amount.
 */
function statementColumnAnchor(rows: readonly PageRow[]): number | null {
  const row = rows.find((entry) => labelOf(entry).toLowerCase() === 'total revenue');
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

/**
 * A printed label may wrap across two PDF lines. The first line carries the
 * label with no amount; the continuation line carries the amount. Match the
 * continuation directly below the first line, never a note number.
 */
function wrappedValue(
  rows: readonly PageRow[],
  firstLineStartsWith: string,
  continuationStartsWith: string,
  anchor: number,
): number | null {
  const index = rows.findIndex((row) =>
    labelOf(row).toLowerCase().startsWith(firstLineStartsWith.toLowerCase()),
  );
  if (index < 0) return null;
  const first = rows[index];
  if (!first) return null;
  const direct = valueNear(first, anchor);
  if (direct !== null) return direct;
  for (let i = index + 1; i < Math.min(rows.length, index + 3); i++) {
    const row = rows[i];
    if (!row) continue;
    if (labelOf(row).toLowerCase().startsWith(continuationStartsWith.toLowerCase())) {
      return valueNear(row, anchor);
    }
  }
  return null;
}

/** Detect the printed unit from the statement header/unit rows. */
export function detectWaterNswUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface WaterNswStatement {
  page_number: number;
  unit: UnitDetection;
  revenue_from_water: number;
  grants_and_subsidies: number;
  other_revenue: number;
  total_revenue: number;
  employee_expenses: number;
  depreciation_amortisation: number;
  other_operating_expenses: number;
  finance_costs: number;
  total_expenses: number;
  operating_profit: number;
  other_gains: number;
  revaluation_gains: number;
  profit_before_tax: number;
  income_tax_expense: number;
  profit_for_year: number;
  total_comprehensive_income: number | null;
  checks: string[];
  errors: string[];
}

function findStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('statements of comprehensive income') &&
      text.includes('profit before income tax expense')
    ) {
      return page;
    }
  }
  return null;
}

/** Keep only the left-hand statement panel; the balance sheet is beside it. */
function statementPanelItems(page: PdfPage): PdfTextItem[] {
  const rightTitle = page.items.find((item) => /statements of financial position/i.test(item.str));
  if (!rightTitle) return [...page.items];
  const maxX = rightTitle.x - 8;
  return page.items.filter((item) => item.x < maxX);
}

export function parseWaterNswStatement(page: PdfPage): WaterNswStatement | null {
  const rows = groupPageRows(statementPanelItems(page));
  const titleRow = rows.find((row) =>
    /statements of comprehensive income/i.test(row.cells.join(' ')),
  );
  if (!titleRow) return null;

  const unitRows = rows.filter((row) =>
    row.cells.some((cell) => cell.includes('$') || /['’]0{3}/.test(cell)),
  );
  const unit = detectMoneyUnit(unitRows.map((row) => row.cells.join(' ')));

  const anchor = statementColumnAnchor(rows);
  const errors: string[] = [];
  const checks: string[] = [];
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed Total revenue row',
    );
    return null;
  }
  if (unit.kind !== 'thousands') {
    errors.push(
      `printed unit is not explicit thousands (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $’000 statement as dollars`,
    );
  }

  const revenueFromWater = valueFor(rows, 'Revenue from water supply and delivery', anchor);
  const grantsAndSubsidies = valueFor(rows, 'Grants and subsidies', anchor);
  const otherRevenue = valueFor(rows, 'Other revenue', anchor);
  const totalRevenue = valueFor(rows, 'Total revenue', anchor);
  const employeeExpenses = valueFor(rows, 'Employee related expenses', anchor);
  const depreciation = valueFor(rows, 'Depreciation and amortisation', anchor);
  const otherOperating = valueFor(rows, 'Other operating expenses', anchor);
  const financeCosts = valueFor(rows, 'Finance costs', anchor);
  const totalExpenses = valueFor(rows, 'Total expenses', anchor);
  const operatingProfit = valueFor(rows, 'Operating profit', anchor);
  const otherGains = valueFor(rows, 'Other gains/(losses)', anchor);
  const revaluation = wrappedValue(
    rows,
    'Gains/(losses) on revaluation of property, plant and',
    'equipment',
    anchor,
  );
  const pbt = valueFor(rows, 'Profit before income tax expense', anchor);
  const tax = valueFor(rows, 'Income tax expense', anchor);
  // The real report wraps these long captions onto a second line; support both
  // the wrapped and single-line editions.
  const profit =
    wrappedValue(
      rows,
      'Profit after income tax expense for the year',
      'attributable to the owners of Water NSW',
      anchor,
    ) ??
    valueFor(
      rows,
      'Profit after income tax expense for the year attributable to the owners of Water NSW',
      anchor,
    );
  const comprehensive =
    wrappedValue(
      rows,
      'Total comprehensive income for the year',
      'attributable to the owners of Water NSW',
      anchor,
    ) ??
    valueFor(
      rows,
      'Total comprehensive income for the year attributable to the owners of Water NSW',
      anchor,
    );

  if (
    revenueFromWater === null ||
    grantsAndSubsidies === null ||
    otherRevenue === null ||
    totalRevenue === null ||
    employeeExpenses === null ||
    depreciation === null ||
    otherOperating === null ||
    financeCosts === null ||
    totalExpenses === null ||
    operatingProfit === null ||
    otherGains === null ||
    revaluation === null ||
    pbt === null ||
    tax === null ||
    profit === null
  ) {
    errors.push('statement is missing one or more required printed lines');
    return {
      page_number: page.page_number,
      unit,
      revenue_from_water: 0,
      grants_and_subsidies: 0,
      other_revenue: 0,
      total_revenue: 0,
      employee_expenses: 0,
      depreciation_amortisation: 0,
      other_operating_expenses: 0,
      finance_costs: 0,
      total_expenses: 0,
      operating_profit: 0,
      other_gains: 0,
      revaluation_gains: 0,
      profit_before_tax: 0,
      income_tax_expense: 0,
      profit_for_year: 0,
      total_comprehensive_income: null,
      checks,
      errors,
    };
  }

  // Zero-tolerance printed bridges, all in $’000.
  const revenueComponents = revenueFromWater + grantsAndSubsidies + otherRevenue;
  if (revenueComponents !== totalRevenue) {
    errors.push(
      `revenue components mismatch: ${revenueFromWater} + ${grantsAndSubsidies} + ${otherRevenue} = ${revenueComponents}, printed Total revenue ${totalRevenue}`,
    );
  } else {
    checks.push(
      `revenue components exact: ${revenueFromWater} + ${grantsAndSubsidies} + ${otherRevenue} = ${totalRevenue}`,
    );
  }

  const expenseComponents =
    Math.abs(employeeExpenses) +
    Math.abs(depreciation) +
    Math.abs(otherOperating) +
    Math.abs(financeCosts);
  if (expenseComponents !== Math.abs(totalExpenses)) {
    errors.push(
      `expense components mismatch: |${Math.abs(employeeExpenses)}| + |${Math.abs(depreciation)}| + |${Math.abs(otherOperating)}| + |${Math.abs(financeCosts)}| = ${expenseComponents}, printed Total expenses ${totalExpenses}`,
    );
  } else {
    checks.push(
      `expense components exact: |${Math.abs(employeeExpenses)}| + |${Math.abs(depreciation)}| + |${Math.abs(otherOperating)}| + |${Math.abs(financeCosts)}| = ${Math.abs(totalExpenses)}`,
    );
  }

  if (totalRevenue + totalExpenses !== operatingProfit) {
    errors.push(
      `operating-profit bridge mismatch: ${totalRevenue} + (${totalExpenses}) = ${totalRevenue + totalExpenses}, printed Operating profit ${operatingProfit}`,
    );
  } else {
    checks.push(
      `operating-profit bridge exact: ${totalRevenue} + (${totalExpenses}) = ${operatingProfit}`,
    );
  }

  if (operatingProfit + otherGains + revaluation !== pbt) {
    errors.push(
      `profit-before-tax bridge mismatch: ${operatingProfit} + ${otherGains} + (${revaluation}) = ${operatingProfit + otherGains + revaluation}, printed Profit before income tax expense ${pbt}`,
    );
  } else {
    checks.push(
      `profit-before-tax bridge exact: ${operatingProfit} + ${otherGains} + (${revaluation}) = ${pbt}`,
    );
  }

  if (pbt + tax !== profit) {
    errors.push(
      `net result mismatch: ${pbt} + (${tax}) = ${pbt + tax}, printed Profit after income tax expense ${profit}`,
    );
  } else {
    checks.push(`profit-after-tax bridge exact: ${pbt} + (${tax}) = ${profit}`);
  }

  checks.push(
    `total expenses is the explicit printed Total expenses line: ${Math.abs(totalExpenses)} $’000 (consolidated current-year column)`,
  );

  return {
    page_number: page.page_number,
    unit,
    revenue_from_water: revenueFromWater,
    grants_and_subsidies: grantsAndSubsidies,
    other_revenue: otherRevenue,
    total_revenue: totalRevenue,
    employee_expenses: Math.abs(employeeExpenses),
    depreciation_amortisation: Math.abs(depreciation),
    other_operating_expenses: Math.abs(otherOperating),
    finance_costs: Math.abs(financeCosts),
    total_expenses: Math.abs(totalExpenses),
    operating_profit: operatingProfit,
    other_gains: otherGains,
    revaluation_gains: revaluation,
    profit_before_tax: pbt,
    income_tax_expense: tax,
    profit_for_year: profit,
    total_comprehensive_income: comprehensive,
    checks,
    errors,
  };
}

export interface WaterNswGrantsNote {
  page_number: number;
  unit: UnitDetection;
  nsw_government_contributions_to_operations: number | null;
  nsw_government_subsidies: number | null;
  other_government_grants: number | null;
  errors: string[];
}

function findGrantsNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('3 grants and subsidies') &&
      text.includes('nsw government contributions to operations') &&
      text.includes('other government grants')
    ) {
      return page;
    }
  }
  return null;
}

export function parseWaterNswGrantsNote(page: PdfPage): WaterNswGrantsNote {
  const rows = groupPageRows(page.items);
  const anchorRow = rows.find(
    (row) => labelOf(row).toLowerCase() === 'nsw government contributions to operations',
  );
  const unitRows = rows.filter((row) => row.cells.some((cell) => /\$\s*['’]?0{3}/.test(cell)));
  const unit = detectMoneyUnit(unitRows.map((row) => row.cells.join(' ')));
  const errors: string[] = [];
  if (unit.kind !== 'thousands') {
    errors.push(`grants note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`);
  }
  let anchor: number | null = null;
  if (anchorRow) {
    // The contributions row has no note number; the leftmost money cell is the
    // consolidated current-year amount column.
    const numeric = anchorRow.items
      .map((item) => ({ value: parseAmountCell(item.str).value, right: item.x + item.width }))
      .filter(
        (entry): entry is { value: number; right: number } =>
          entry.value !== null && Math.abs(entry.value) >= 1000,
      )
      .sort((a, b) => a.right - b.right);
    anchor = numeric[0]?.right ?? null;
  }
  if (anchor === null) {
    errors.push('grants note current-year money column could not be anchored');
  }
  const contributions =
    anchor === null ? null : valueFor(rows, 'NSW Government contributions to operations', anchor);
  const subsidies = anchor === null ? null : valueFor(rows, 'NSW Government subsidies', anchor);
  const otherGrants = anchor === null ? null : valueFor(rows, 'Other Government grants', anchor);
  if (contributions === null || subsidies === null || otherGrants === null) {
    errors.push('one or more printed grants-note rows could not be parsed');
  }
  return {
    page_number: page.page_number,
    unit,
    nsw_government_contributions_to_operations: contributions,
    nsw_government_subsidies: subsidies,
    other_government_grants: otherGrants,
    errors,
  };
}

export interface WaterNswParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface WaterNswDeferral {
  reason: string;
  phase: 'discovery' | 'unit' | 'statement' | 'notes' | 'reconciliation';
}

export interface WaterNswParseResult {
  records: SpendingRecord[];
  deferral: WaterNswDeferral | null;
  statement: WaterNswStatement | null;
  grants_note: WaterNswGrantsNote | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export interface WaterNswLineSpec {
  line_item: string;
  label: string;
  amount_thousands: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result' | 'transfer';
  detail: string;
}

export function waterNswNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${WATERNSW_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(thousands: number): number {
  const cents = Math.round(thousands * WATERNSW_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: WaterNswParseContext,
  spec: WaterNswLineSpec,
  statement: WaterNswStatement,
  grantsNote: WaterNswGrantsNote,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${WATERNSW_UNIT_LABEL} (${WATERNSW_UNIT}; x${WATERNSW_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `grants_note_page: ${grantsNote.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'consolidated entity current-year column; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, or any other SOC line',
  ].join('; ');
}

function mapLine(
  spec: WaterNswLineSpec,
  context: WaterNswParseContext,
  statement: WaterNswStatement,
  grantsNote: WaterNswGrantsNote,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: WATERNSW_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: waterNswNaturalKey(
      WATERNSW_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${WATERNSW_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: WATERNSW_JURISDICTION,
    delivery_entity: WATERNSW_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `WaterNSW Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: WATERNSW_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: WATERNSW_UNIT,
    potential_double_count: spec.potential_double_count,
    notes: notesFor(context, spec, statement, grantsNote, {
      section: spec.section,
      revenue_thousands: statement.total_revenue,
      total_expenses_thousands: statement.total_expenses,
      net_result_thousands: statement.profit_for_year,
      ...(spec.line_item === 'total_expenses' ||
      spec.line_item === 'nsw_government_contributions_to_operations'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

/**
 * Parse the full extraction. Returns either mapped provisional rows or a
 * deferral with a machine-readable reason. No amount is invented: every value
 * is a printed statement/note line, and the printed Total expenses is accepted
 * only when all printed bridges and the grants-note subtotal reconcile exactly.
 */
export function parseWaterNswExtraction(
  extraction: PdfExtraction,
  context: WaterNswParseContext,
): WaterNswParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
    return {
      records: [],
      deferral: {
        reason: 'no parseable Statements of comprehensive income found in the PDF',
        phase: 'statement',
      },
      statement: null,
      grants_note: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const statement = parseWaterNswStatement(statementPage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason: 'statement page found but required printed lines could not be parsed',
        phase: 'statement',
      },
      statement: null,
      grants_note: null,
      checks: [],
      warnings,
      pages_used: [statementPage.page_number],
    };
  }
  if (statement.unit.kind !== 'thousands') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit thousands: ${statement.unit.reason}`,
        phase: 'unit',
      },
      statement,
      grants_note: null,
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
      grants_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }

  // The report period is the year ended 30 June 2025; verify it matches the
  // discovered report year rather than silently using a comparative column.
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
      grants_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }

  const grantsPage = findGrantsNotePage(extraction.pages);
  if (!grantsPage) {
    return {
      records: [],
      deferral: {
        reason:
          'the Note 3 grants and subsidies table needed to verify government grants could not be located',
        phase: 'notes',
      },
      statement,
      grants_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }
  const grantsNote = parseWaterNswGrantsNote(grantsPage);
  const pagesUsed = [statementPage.page_number, grantsNote.page_number];
  if (grantsNote.unit.kind !== 'thousands') {
    return {
      records: [],
      deferral: {
        reason: `grants note on page ${grantsNote.page_number} is not explicit thousands: ${grantsNote.unit.reason}`,
        phase: 'unit',
      },
      statement,
      grants_note: grantsNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  if (grantsNote.errors.length > 0) {
    return {
      records: [],
      deferral: {
        reason: `grants note parse failed: ${grantsNote.errors.join('; ')}`,
        phase: 'notes',
      },
      statement,
      grants_note: grantsNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  const contributions = grantsNote.nsw_government_contributions_to_operations;
  const subsidies = grantsNote.nsw_government_subsidies;
  const otherGrants = grantsNote.other_government_grants;
  if (contributions === null || subsidies === null || otherGrants === null) {
    return {
      records: [],
      deferral: {
        reason: 'Note 3 grants rows could not all be parsed',
        phase: 'notes',
      },
      statement,
      grants_note: grantsNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  const grantsSum = contributions + subsidies + otherGrants;
  if (grantsSum !== statement.grants_and_subsidies) {
    return {
      records: [],
      deferral: {
        reason: `Note 3 grants subtotal mismatch: ${contributions} + ${subsidies} + ${otherGrants} = ${grantsSum}, statement Grants and subsidies ${statement.grants_and_subsidies}`,
        phase: 'reconciliation',
      },
      statement,
      grants_note: grantsNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  const checks = [
    ...statement.checks,
    `Note 3 grants subtotal exact: ${contributions} + ${subsidies} + ${otherGrants} = ${statement.grants_and_subsidies}`,
  ];

  const lineSpecs: WaterNswLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.total_revenue,
      funding_source: WATERNSW_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed consolidated Total revenue. Includes the separately shown government Grants and subsidies line, which is never added again.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_thousands: statement.total_expenses,
      funding_source: WATERNSW_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Explicit printed consolidated Total expenses. Accepted only because employee, depreciation/amortisation, other operating and finance costs sum to it and the operating-profit and profit-before-tax bridges reconcile exactly.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee related expenses',
      amount_thousands: statement.employee_expenses,
      funding_source: WATERNSW_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed consolidated Employee related expenses. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_thousands: statement.depreciation_amortisation,
      funding_source: WATERNSW_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed consolidated Depreciation and amortisation. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit after income tax expense',
      amount_thousands: statement.profit_for_year,
      funding_source: WATERNSW_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed consolidated Profit after income tax expense attributable to the owners of Water NSW (net result). A result line, not an expense component; never add to revenue or expenses.',
    },
    {
      line_item: 'nsw_government_contributions_to_operations',
      label: 'NSW Government contributions to operations',
      amount_thousands: contributions,
      funding_source:
        'NSW Government — Department of Climate Change, Energy, the Environment and Water',
      potential_double_count: true,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Separately disclosed in Note 3 and already included in Total revenue. May overlap NSW government program spending; never add it to the total.',
    },
    {
      line_item: 'nsw_government_subsidies',
      label: 'NSW Government subsidies',
      amount_thousands: subsidies,
      funding_source: 'NSW Government',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'revenue',
      detail:
        'Separately disclosed in Note 3 and already included in Total revenue. May overlap NSW government program spending; never add it to the total.',
    },
    {
      line_item: 'other_government_grants',
      label: 'Other Government grants',
      amount_thousands: otherGrants,
      funding_source: 'Government grants (agency not itemised)',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'revenue',
      detail:
        'Separately disclosed in Note 3 and already included in Total revenue. The report does not itemise the agency; may overlap government program spending and is never added to the total.',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement, grantsNote));
  warnings.push(
    'SOC entity rows are provisional and unverified; Total expenses is the explicit printed consolidated total and reconciles exactly to its printed components and the profit-before-tax bridge.',
  );
  return {
    records,
    deferral: null,
    statement,
    grants_note: grantsNote,
    checks,
    warnings,
    pages_used: pagesUsed,
  };
}

export interface WaterNswConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: WaterNswAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'waternsw-annual-report.pdf';
}

/**
 * Operator escape hatch for bot-blocked hosts: the WaterNSW site presents a
 * Cloudflare challenge to non-browser clients. When
 * `WATERNSW_ANNUAL_REPORT_URL` is set, it is used as the exact official PDF URL
 * and `WATERNSW_ANNUAL_REPORT_MIRROR_URL` (if set) is used only to download the
 * same bytes. The default path is still live discovery from the annual-report
 * page.
 */
function documentFromEnv(): WaterNswAnnualReportLink | null {
  const url = process.env.WATERNSW_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'WaterNSW-Annual-Report.pdf';
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
      `WATERNSW_ANNUAL_REPORT_URL filename "${filename}" has no report year; cannot derive fiscal year`,
    );
  }
  const mirror = process.env.WATERNSW_ANNUAL_REPORT_MIRROR_URL;
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    ...(mirror ? { download_url: mirror } : {}),
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
  };
}

async function recordDeferral(
  document: WaterNswAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: WaterNswDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: WATERNSW_ID, document_url: document.url },
    {
      $set: {
        entity: WATERNSW_ENTITY,
        jurisdiction: WATERNSW_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the WaterNSW SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live WaterNSW connector. */
export function createWaterNswConnector(options: WaterNswConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: WATERNSW_ID,
    name: WATERNSW_NAME,
    publisher: WATERNSW_PUBLISHER,
    source_url: WATERNSW_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: WATERNSW_LICENSE,
    notes:
      'NSW SOC Phase 3: WaterNSW (Water NSW) only. The latest annual report is discovered from WaterNSW\'s annual-report page (no hard-coded PDF URL), SHA-256 archived outside the repo, and parsed for the consolidated Statements of comprehensive income. The printed unit must be explicit $’000; Total expenses is an explicit printed total accepted only when its printed components and the operating-profit, profit-before-tax and net-result bridges reconcile exactly. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). SOC rows are never added to government program spending, the PNFC benchmark, or each other. Other SOCs are not implemented.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? documentFromEnv() ?? (await discoverWaterNswAnnualReport(fetchImpl));
      const downloadUrl = document.download_url ?? document.url;
      const response = await fetchImpl(downloadUrl, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(
          `WaterNSW PDF fetch HTTP ${response.status} for ${downloadUrl}` +
            (document.download_url ? ` (mirror of ${document.url})` : ''),
        );
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: WATERNSW_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: downloadUrl,
        archived_from: downloadUrl === document.url ? 'direct' : 'other',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          downloadUrl === document.url
            ? 'WaterNSW annual-report PDF; archived for auditable NSW SOC entity-statement extraction.'
            : `WaterNSW annual-report PDF downloaded from the NSW Parliament mirror (${downloadUrl}) because the official host bot-blocks non-browser clients; the exact bytes are the same document as ${document.url}.`,
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: WaterNswParseContext = {
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
      const parsed = parseWaterNswExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'waternsw-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'waternsw-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a WaterNSW measure; skipped');
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
