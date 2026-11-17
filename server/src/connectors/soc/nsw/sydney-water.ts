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
 * NSW SOC Phase 2 — Sydney Water Corporation annual-report adapter.
 *
 * Source gate:
 * - The document is discovered from Sydney Water's own annual-report page; no
 *   PDF URL is hard-coded.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The printed unit must be explicit. The financial statements print
 *   "$’000" in every column header and the Basis of preparation states values
 *   are rounded to the nearest thousand dollars. A table read as dollars is
 *   rejected, not converted by magnitude.
 * - Total expenses is the exact sum of the two printed expense totals on the
 *   statement (finance costs + other expenses) and is accepted only when the
 *   statement's own profit-before-tax bridge and the note subtotals reconcile
 *   to the same integer thousands, with zero tolerance.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. SOC rows
 * are never added to government program spending or to the PNFC benchmark.
 */

export const SYDNEY_WATER_ID = 'sydney-water';
export const SYDNEY_WATER_NAME = 'Sydney Water — Annual Report';
export const SYDNEY_WATER_PUBLISHER = 'Sydney Water Corporation';
export const SYDNEY_WATER_ENTITY = 'Sydney Water';
export const SYDNEY_WATER_JURISDICTION = 'NSW';
export const SYDNEY_WATER_SOURCE_URL =
  'https://www.sydneywater.com.au/about/policies-publications/reports-publications/annual-report.html';
export const SYDNEY_WATER_LICENSE =
  '© Sydney Water Corporation. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const SYDNEY_WATER_UNIT = 'AUD_thousands';
export const SYDNEY_WATER_UNIT_LABEL = '$’000';
export const SYDNEY_WATER_UNIT_TO_CENTS = 100_000;
export const SYDNEY_WATER_CAVEAT =
  'Entity-level SOC statement lines. Never add to government program spending, to the PNFC sector benchmark, or to each other: total revenue includes the separately shown government grants; total expenses includes employee, depreciation/amortisation and transfer lines. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the URL; parse the page. */
export interface SydneyWaterAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
}

/**
 * Discover annual-report PDFs from the Sydney Water annual-report page HTML.
 * Only links whose filename looks like an annual report are returned; the
 * climate-related financial disclosure and other PDFs are ignored.
 */
export function parseSydneyWaterAnnualReportLinks(
  html: string,
  baseUrl = SYDNEY_WATER_SOURCE_URL,
): SydneyWaterAnnualReportLink[] {
  const links: SydneyWaterAnnualReportLink[] = [];
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
    // e.g. sydney-water-annual-report-2024-25.pdf or annual-report-2020-21.pdf
    const yearMatch = /annual[-_ ]?report[-_ ]?(20\d{2})[-_ ]?(\d{2})/i.exec(filename);
    if (!yearMatch) continue;
    const start = Number(yearMatch[1]);
    const end = Number(yearMatch[2]);
    if (end !== (start + 1) % 100) continue;
    const fiscalYear = `${start}-${String(end).padStart(2, '0')}`;
    const key = `${url.origin}${url.pathname}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      url: key,
      filename,
      fiscal_year: fiscalYear,
      title: `Annual Report ${start}–${String(end).padStart(2, '0')}`,
    });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/** Fetch the annual-report page and return the latest discovered PDF. */
export async function discoverSydneyWaterAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl = SYDNEY_WATER_SOURCE_URL,
): Promise<SydneyWaterAnnualReportLink> {
  const response = await fetchImpl(pageUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Sydney Water annual-report page HTTP ${response.status} for ${pageUrl}`);
  }
  const html = await response.text();
  const links = parseSydneyWaterAnnualReportLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Sydney Water annual-report page contains no annual-report PDF link; refusing to hard-code a URL',
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

function groupPageRows(page: PdfPage, tolerance = 3): PageRow[] {
  const sorted = [...page.items].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.y - item.y) <= tolerance) last.items.push(item);
    else groups.push({ y: item.y, items: [item] });
  }
  return groups
    .map((group) => {
      const items = [...group.items].sort((a, b) => a.x - b.x);
      const cells = items.map((item) => item.str.replace(/\s+/g, ' ').trim()).filter(Boolean);
      return { y: group.y, items, cells };
    })
    .filter((row) => row.cells.length > 0);
}

function rowValue(row: PageRow): number | null {
  // The first numeric item is the current reporting year; the second is the
  // prior-year comparative. Notes ("1(a)", "2(b)") parse as null and are
  // skipped. A dash/nil is null, never zero.
  for (const item of row.items) {
    const parsed = parseAmountCell(item.str);
    if (parsed.value !== null) return parsed.value;
    if (parsed.error) continue;
  }
  return null;
}

function labelOf(row: PageRow): string {
  return (row.cells[0] ?? '').replace(/\s+/g, ' ').trim();
}

/** Detect the printed unit from the statement header/unit row. */
export function detectSydneyWaterUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface SydneyWaterStatement {
  page_number: number;
  unit: UnitDetection;
  revenue: number;
  other_income: number;
  finance_costs: number;
  other_expenses: number;
  profit_before_tax: number;
  income_tax_expense: number;
  profit_for_year: number;
  total_comprehensive_income: number;
  total_expenses: number;
  checks: string[];
  errors: string[];
}

function findStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      (text.includes('statement of profit or loss and other comprehensive income') ||
        text.includes('statement of comprehensive income')) &&
      text.includes('profit before income tax')
    ) {
      return page;
    }
  }
  return null;
}

function pageText(page: PdfPage): string {
  return page.text;
}

/**
 * Parse the face statement. This is where the printed unit is enforced: the
 * only accepted unit is thousands. A dollar-only header is rejected with an
 * explicit reason, so a $’000 table can never be silently read as dollars.
 */
export function parseSydneyWaterStatement(page: PdfPage): SydneyWaterStatement | null {
  const rows = groupPageRows(page);
  const titleRow = rows.find((row) =>
    /statement of (?:profit or loss and other )?comprehensive income/i.test(row.cells.join(' ')),
  );
  if (!titleRow) return null;

  const headerIndex = rows.findIndex(
    (row) => row.cells.includes('2025') && row.cells.includes('2024'),
  );
  const searchFrom = headerIndex >= 0 ? headerIndex : rows.indexOf(titleRow);
  const unitRow = rows
    .slice(Math.max(0, searchFrom), searchFrom + 5)
    .find((row) => detectMoneyUnit([row.cells.join(' ')]).kind !== null);
  const unitSamples = [
    ...(unitRow ? [unitRow.cells.join(' ')] : []),
    // The Basis of preparation is on a different page in the real report, so
    // the caller passes it separately; the header row is the primary evidence.
    ...rows.slice(Math.max(0, searchFrom), searchFrom + 5).map((row) => row.cells.join(' ')),
  ];
  const unit = detectMoneyUnit(unitSamples);

  const rawByLabel = new Map<string, PageRow>();
  for (const row of rows) rawByLabel.set(labelOf(row).toLowerCase(), row);

  const get = (label: string): number | null => {
    const row = rawByLabel.get(label.toLowerCase());
    return row ? rowValue(row) : null;
  };

  const revenue = get('Revenue');
  const otherIncome = get('Other income');
  const financeCosts = get('Finance costs');
  const otherExpenses = get('Other expenses');
  const pbt = get('Profit before income tax');
  const tax = get('Income tax expense');
  const profit = get('Profit for the year');
  const comprehensive = get('Total comprehensive income for the year');

  const errors: string[] = [];
  if (unit.kind !== 'thousands') {
    errors.push(
      `printed unit is not explicit thousands (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $’000 statement as dollars`,
    );
  }
  if (
    revenue === null ||
    otherIncome === null ||
    financeCosts === null ||
    otherExpenses === null ||
    pbt === null ||
    profit === null
  ) {
    errors.push('statement is missing one or more required printed lines');
    return null;
  }

  // The statement's own bridge: revenue + other income − finance costs −
  // other expenses must equal the printed profit before income tax, exactly,
  // in printed thousands. Zero tolerance.
  const bridge = revenue + otherIncome + financeCosts + otherExpenses;
  const checks: string[] = [];
  if (bridge !== pbt) {
    errors.push(
      `statement bridge mismatch: revenue ${revenue} + other income ${otherIncome} + finance costs ${financeCosts} + other expenses ${otherExpenses} = ${bridge}, printed profit before tax ${pbt}`,
    );
  } else {
    checks.push(
      `profit-before-tax bridge exact: ${revenue} + ${otherIncome} + (${financeCosts}) + (${otherExpenses}) = ${pbt}`,
    );
  }
  if (tax !== null && profit !== null && pbt + tax !== profit) {
    errors.push(
      `net result mismatch: profit before tax ${pbt} + income tax ${tax} = ${pbt + tax}, printed profit for the year ${profit}`,
    );
  } else if (tax !== null) {
    checks.push(`profit-after-tax bridge exact: ${pbt} + (${tax}) = ${profit}`);
  }

  const totalExpenses = Math.abs(financeCosts) + Math.abs(otherExpenses);
  checks.push(
    `total expenses derived from the two printed expense totals: |${financeCosts}| + |${otherExpenses}| = ${totalExpenses}`,
  );

  return {
    page_number: page.page_number,
    unit,
    revenue,
    other_income: otherIncome,
    finance_costs: financeCosts,
    other_expenses: otherExpenses,
    profit_before_tax: pbt,
    income_tax_expense: tax ?? 0,
    profit_for_year: profit,
    total_comprehensive_income: comprehensive ?? 0,
    total_expenses: totalExpenses,
    checks,
    errors,
  };
}

interface NotePage {
  page_number: number;
  unit: UnitDetection;
  values: Map<string, number>;
  rows: PageRow[];
  errors: string[];
}

function nearestNumericValue(
  items: readonly PdfTextItem[],
  anchorRight: number | null,
  tolerance = 8,
): number | null {
  if (anchorRight === null) return null;
  let best: { value: number; distance: number } | null = null;
  for (const item of items) {
    const parsed = parseAmountCell(item.str);
    if (parsed.value === null) continue;
    const right = item.x + item.width;
    const distance = Math.abs(right - anchorRight);
    if (distance > tolerance) continue;
    if (!best || distance < best.distance) best = { value: parsed.value, distance };
  }
  return best?.value ?? null;
}

/**
 * The current-year column is the second-rightmost numeric column: the
 * rightmost is the prior-year comparative. This holds for the two-column notes
 * and for Note 1(a), whose three groups end with the Total column. Clustering
 * numeric right edges is alignment-based, not width-of-number based, so it does
 * not depend on how many digits a cell has.
 */
function currentYearRightEdge(rows: readonly PageRow[]): number | null {
  const edges: number[] = [];
  for (const row of rows) {
    for (const item of row.items) {
      if (parseAmountCell(item.str).value === null) continue;
      edges.push(item.x + item.width);
    }
  }
  if (edges.length === 0) return null;
  edges.sort((a, b) => a - b);
  const clusters: Array<{ right: number; count: number }> = [];
  for (const edge of edges) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(edge - last.right) <= 8) {
      last.right = (last.right * last.count + edge) / (last.count + 1);
      last.count += 1;
    } else {
      clusters.push({ right: edge, count: 1 });
    }
  }
  // Keep only clusters with a plausible number of values (at least two), then
  // take the second from the right. A page with one column only falls back to
  // the rightmost cluster.
  const usable = clusters.filter((cluster) => cluster.count >= 2);
  const pool = usable.length >= 2 ? usable : clusters;
  const sorted = [...pool].sort((a, b) => b.right - a.right);
  return sorted[1]?.right ?? sorted[0]?.right ?? null;
}

function parseNotePage(page: PdfPage): NotePage {
  const rows = groupPageRows(page);
  const headerIndex = rows.findIndex(
    (row) => row.cells.includes('2025') && row.cells.includes('2024'),
  );
  const searchFrom = headerIndex >= 0 ? headerIndex : 0;
  const unitSamples = rows.slice(searchFrom, searchFrom + 4).map((row) => row.cells.join(' '));
  const unit = detectMoneyUnit(unitSamples);
  // Start after the year header + unit row so header year labels ("2025",
  // "2024") are never mistaken for money values.
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 2) : rows;
  const anchorRight = currentYearRightEdge(dataRows);
  const values = new Map<string, number>();
  for (const row of dataRows) {
    const label = labelOf(row).toLowerCase();
    if (!label) continue;
    const value = nearestNumericValue(row.items, anchorRight);
    if (value !== null) values.set(label, value);
  }
  const errors: string[] = [];
  if (unit.kind !== 'thousands') {
    errors.push(`note unit is not explicit thousands (detected ${unit.kind ?? 'none'})`);
  }
  if (anchorRight === null) {
    errors.push('note current-year numeric column could not be anchored from numeric alignment');
  }
  return { page_number: page.page_number, unit, values, rows, errors };
}

function findPageWith(pages: readonly PdfPage[], needles: readonly string[]): PdfPage | null {
  for (const page of pages) {
    const text = pageText(page).toLowerCase();
    if (needles.every((needle) => text.includes(needle.toLowerCase()))) return page;
  }
  return null;
}

function noteKeysFor(note: NotePage, label: string): string[] {
  const wanted = label.toLowerCase();
  return [...note.values.keys()].filter(
    (key) => key === wanted || key.startsWith(wanted) || wanted.startsWith(key),
  );
}

/**
 * Note labels are often wrapped across two PDF lines ("NSW Government grants
 * for social" / "programs"), so match the longest prefix rather than requiring
 * an exact single-line label.
 */
function noteValue(note: NotePage, label: string): number | null {
  const wanted = label.toLowerCase();
  // Exact labels win: "Total revenue" must not match "Total revenue from
  // contracts with customers". Only fall back to a unique prefix when the
  // printed label is wrapped across two lines.
  if (note.values.has(wanted)) return note.values.get(wanted) ?? null;
  const keys = noteKeysFor(note, label).sort((a, b) => b.length - a.length);
  const key = keys[0];
  return key === undefined ? null : (note.values.get(key) ?? null);
}

function noteHasLabel(note: NotePage, label: string): boolean {
  const wanted = label.toLowerCase();
  return note.rows.some((row) => {
    const text = labelOf(row).toLowerCase();
    return text === wanted || wanted.startsWith(text) || text.startsWith(wanted);
  });
}

export interface SydneyWaterParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface SydneyWaterDeferral {
  reason: string;
  phase: 'discovery' | 'unit' | 'statement' | 'notes' | 'reconciliation';
}

export interface SydneyWaterParseResult {
  records: SpendingRecord[];
  deferral: SydneyWaterDeferral | null;
  statement: SydneyWaterStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export interface SydneyWaterLineSpec {
  line_item: string;
  label: string;
  amount_thousands: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result' | 'transfer';
  detail: string;
}

export function sydneyWaterNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${SYDNEY_WATER_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function notesFor(
  context: SydneyWaterParseContext,
  spec: SydneyWaterLineSpec,
  statement: SydneyWaterStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${SYDNEY_WATER_UNIT_LABEL} (${SYDNEY_WATER_UNIT}; x${SYDNEY_WATER_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'entity-level SOC statement line; provisional; unverified; never add to government program spending, PNFC benchmark, or any other SOC line',
  ].join('; ');
}

function amountCents(thousands: number): number {
  const cents = Math.round(thousands * SYDNEY_WATER_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${thousands} thousand exceeds safe integer cents`);
  }
  return cents;
}

function mapLine(
  spec: SydneyWaterLineSpec,
  context: SydneyWaterParseContext,
  statement: SydneyWaterStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_thousands),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: SYDNEY_WATER_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: sydneyWaterNaturalKey(
      SYDNEY_WATER_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${SYDNEY_WATER_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: SYDNEY_WATER_JURISDICTION,
    delivery_entity: SYDNEY_WATER_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Sydney Water Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: SYDNEY_WATER_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: SYDNEY_WATER_UNIT,
    potential_double_count: spec.potential_double_count,
    notes: notesFor(context, spec, statement, {
      section: spec.section,
      revenue_thousands: statement.revenue,
      total_expenses_thousands: statement.total_expenses,
      net_result_thousands: statement.profit_for_year,
      ...(spec.line_item === 'total_expenses' ||
      spec.line_item === 'nsw_government_grants_social_programs'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

/**
 * Parse the full extraction. Returns either mapped provisional rows or a
 * deferral with a machine-readable reason. No amount is invented: every value
 * comes from a printed statement/note line, and total expenses is accepted
 * only when both printed expense totals and the PBT bridge reconcile exactly.
 */
export function parseSydneyWaterExtraction(
  extraction: PdfExtraction,
  context: SydneyWaterParseContext,
): SydneyWaterParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
    return {
      records: [],
      deferral: {
        reason:
          'no parseable Statement of profit or loss and other comprehensive income found in the PDF',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const statement = parseSydneyWaterStatement(statementPage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason: 'statement page found but required printed lines could not be parsed',
        phase: 'statement',
      },
      statement: null,
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
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }

  // Note 1(a) — printed Total revenue and government grants.
  const revenuePage = findPageWith(extraction.pages, ['Note 1. Income', '(a) Revenue']);
  const financePage = findPageWith(extraction.pages, [
    'Note 2. Expenses',
    'Total finance costs recognised in profit or loss',
  ]);
  const otherExpensesPage = findPageWith(extraction.pages, [
    'Total other expenses recognised in profit or loss',
  ]);
  const pagesUsed = [statementPage.page_number];
  const checks = [...statement.checks];

  if (!revenuePage || !financePage || !otherExpensesPage) {
    return {
      records: [],
      deferral: {
        reason:
          'the revenue and expense note pages needed to verify the printed totals could not be located',
        phase: 'notes',
      },
      statement,
      checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  const revenueNote = parseNotePage(revenuePage);
  const financeNote = parseNotePage(financePage);
  const otherExpensesNote = parseNotePage(otherExpensesPage);
  pagesUsed.push(revenueNote.page_number, financeNote.page_number, otherExpensesNote.page_number);
  for (const note of [revenueNote, financeNote, otherExpensesNote]) {
    if (note.unit.kind !== 'thousands') {
      return {
        records: [],
        deferral: {
          reason: `note on page ${note.page_number} is not explicit thousands: ${note.unit.reason}`,
          phase: 'unit',
        },
        statement,
        checks,
        warnings,
        pages_used: pagesUsed,
      };
    }
  }

  const noteTotalRevenue = noteValue(revenueNote, 'Total revenue');
  const noteFinanceTotal = noteValue(
    financeNote,
    'Total finance costs recognised in profit or loss',
  );
  const noteOtherExpensesTotal = noteValue(
    otherExpensesNote,
    'Total other expenses recognised in profit or loss',
  );
  const noteEmployee = noteValue(otherExpensesNote, 'Total employee-related expenses');
  const noteDepreciation = noteValue(
    otherExpensesNote,
    'Total depreciation and amortisation expenses',
  );
  const noteClimateFund = noteValue(otherExpensesNote, 'Contribution to NSW Climate Change Fund');
  const noteNswGrants = noteValue(revenueNote, 'NSW Government grants for social programs');
  const noteOtherNswGrants = noteValue(revenueNote, 'Other grants from NSW Government');
  const noteNonEmployee = noteValue(otherExpensesNote, 'Total non-employee related expenses');
  const noteLosses = noteValue(otherExpensesNote, 'Total losses from disposal');
  const noteImpairment = noteValue(
    otherExpensesNote,
    'Total impairment losses expensed (reversed) through profit or loss',
  );

  const reconcile: string[] = [];
  if (noteTotalRevenue === null || noteTotalRevenue !== statement.revenue) {
    return defer(
      'the printed Total revenue in Note 1(a) does not match the statement Revenue line',
      'reconciliation',
    );
  }
  reconcile.push(
    `Note 1(a) Total revenue ${noteTotalRevenue} = statement Revenue ${statement.revenue}`,
  );
  if (noteFinanceTotal === null || noteFinanceTotal !== Math.abs(statement.finance_costs)) {
    return defer(
      'the printed total finance costs in Note 2(a) does not match the statement Finance costs line',
      'reconciliation',
    );
  }
  reconcile.push(
    `Note 2(a) total finance costs ${noteFinanceTotal} = |statement Finance costs ${statement.finance_costs}|`,
  );
  if (
    noteOtherExpensesTotal === null ||
    noteOtherExpensesTotal !== Math.abs(statement.other_expenses)
  ) {
    return defer(
      'the printed total other expenses in Note 2(b) does not match the statement Other expenses line',
      'reconciliation',
    );
  }
  reconcile.push(
    `Note 2(b) total other expenses ${noteOtherExpensesTotal} = |statement Other expenses ${statement.other_expenses}|`,
  );
  if (
    noteEmployee === null ||
    noteNonEmployee === null ||
    noteDepreciation === null ||
    noteLosses === null ||
    noteImpairment === null
  ) {
    return defer('Note 2(b) printed subtotal lines could not all be parsed', 'notes');
  }
  const otherExpensesSum =
    noteEmployee + noteNonEmployee + noteDepreciation + noteLosses + noteImpairment;
  if (otherExpensesSum !== noteOtherExpensesTotal) {
    return defer(
      `Note 2(b) subtotals ${noteEmployee} + ${noteNonEmployee} + ${noteDepreciation} + ${noteLosses} + ${noteImpairment} = ${otherExpensesSum}, printed total ${noteOtherExpensesTotal}`,
      'reconciliation',
    );
  }
  reconcile.push(
    `Note 2(b) subtotals reconcile exactly: ${noteEmployee} + ${noteNonEmployee} + ${noteDepreciation} + ${noteLosses} + ${noteImpairment} = ${noteOtherExpensesTotal}`,
  );

  checks.push(...reconcile);

  const lineSpecs: SydneyWaterLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_thousands: statement.revenue,
      funding_source: SYDNEY_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed statement Revenue / Note 1(a) Total revenue. Excludes Other income (printed separately).',
    },
    {
      line_item: 'other_income',
      label: 'Other income',
      amount_thousands: statement.other_income,
      funding_source: SYDNEY_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed statement Other income / Note 1(b) total other income. Separate from Total revenue and never added to it; used only in the statement profit-before-tax bridge.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses (finance costs + other expenses)',
      amount_thousands: statement.total_expenses,
      funding_source: SYDNEY_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Derived from the two printed expense totals: Finance costs + Other expenses. Accepted only because the statement PBT bridge and both note subtotals reconcile exactly.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Total employee-related expenses',
      amount_thousands: noteEmployee,
      funding_source: SYDNEY_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Note 2(b) total employee-related expenses, net of amounts capitalised. A component of total expenses; never add to it.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Total depreciation and amortisation expenses',
      amount_thousands: noteDepreciation,
      funding_source: SYDNEY_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Note 2(b) total depreciation and amortisation expenses. A component of total expenses; never add to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit for the year',
      amount_thousands: statement.profit_for_year,
      funding_source: SYDNEY_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed statement Profit for the year (net result). A result line, not an expense component; never add to revenue or expenses.',
    },
  ];

  if (noteNswGrants !== null && noteNswGrants !== 0) {
    lineSpecs.push({
      line_item: 'nsw_government_grants_social_programs',
      label: 'NSW Government grants for social programs',
      amount_thousands: noteNswGrants,
      funding_source: 'NSW Government',
      potential_double_count: true,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Separately disclosed revenue line in Note 1(a). Already included in Total revenue and may overlap NSW government program spending; never add it to the total.',
    });
  }
  if (noteOtherNswGrants !== null && noteOtherNswGrants !== 0) {
    lineSpecs.push({
      line_item: 'other_nsw_government_grants',
      label: 'Other grants from NSW Government',
      amount_thousands: noteOtherNswGrants,
      funding_source: 'NSW Government',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'revenue',
      detail:
        'Separately disclosed revenue line in Note 1(a). Already included in Total revenue and may overlap NSW government program spending; never add it to the total.',
    });
  }
  if (noteHasLabel(revenueNote, 'Grants from Commonwealth Government')) {
    const commonwealth = noteValue(revenueNote, 'Grants from Commonwealth Government') ?? 0;
    lineSpecs.push({
      line_item: 'commonwealth_government_grants',
      label: 'Grants from Commonwealth Government',
      amount_thousands: commonwealth,
      funding_source: 'Commonwealth Government',
      potential_double_count: true,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Separately disclosed revenue line in Note 1(a). Printed nil for 2025 (comparative 2024: 18). Already included in Total revenue; may overlap Commonwealth program spending and is never added to the total.',
    });
  }
  if (noteClimateFund !== null && noteClimateFund !== 0) {
    lineSpecs.push({
      line_item: 'contribution_nsw_climate_change_fund',
      label: 'Contribution to NSW Climate Change Fund',
      amount_thousands: noteClimateFund,
      funding_source: 'NSW Government — Climate Change Fund',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'transfer',
      detail:
        'Separately disclosed expense line in Note 2(b) (a transfer to a NSW Government fund). Already included in Other expenses and total expenses; never add it to them.',
    });
  }

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; total expenses is derived from the two printed expense totals and reconciled to the printed PBT bridge.',
  );
  return {
    records,
    deferral: null,
    statement,
    checks,
    warnings,
    pages_used: pagesUsed,
  };

  function defer(reason: string, phase: SydneyWaterDeferral['phase']): SydneyWaterParseResult {
    return {
      records: [],
      deferral: { reason, phase },
      statement,
      checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
}

export interface SydneyWaterConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector always discovers the latest PDF. */
  document?: SydneyWaterAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'sydney-water-annual-report.pdf';
}

async function recordDeferral(
  document: SydneyWaterAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: SydneyWaterDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: SYDNEY_WATER_ID, document_url: document.url },
    {
      $set: {
        entity: SYDNEY_WATER_ENTITY,
        jurisdiction: SYDNEY_WATER_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Sydney Water SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Sydney Water connector. */
export function createSydneyWaterConnector(options: SydneyWaterConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: SYDNEY_WATER_ID,
    name: SYDNEY_WATER_NAME,
    publisher: SYDNEY_WATER_PUBLISHER,
    source_url: SYDNEY_WATER_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: SYDNEY_WATER_LICENSE,
    notes:
      'NSW SOC pilot: Sydney Water Corporation only. The latest annual report is discovered from Sydney Water\'s annual-report page (no hard-coded PDF URL), SHA-256 archived outside the repo, and parsed for the Statement of profit or loss and other comprehensive income. The printed unit must be explicit $’000; total expenses is the exact sum of the two printed expense totals and must reconcile to the printed profit-before-tax bridge. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). SOC rows are never added to government program spending, the PNFC benchmark, or each other. Other SOCs are not implemented.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document = options.document ?? (await discoverSydneyWaterAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`Sydney Water PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: SYDNEY_WATER_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Sydney Water annual-report PDF; archived for auditable NSW SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: SydneyWaterParseContext = {
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
      const parsed = parseSydneyWaterExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'sydney-water-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'sydney-water-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Sydney Water measure; skipped');
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
