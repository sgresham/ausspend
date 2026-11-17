import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import {
  detectMoneyUnit,
  extractArchivedPdf,
  moneyToCents,
  parseAmountCell,
  type MoneyUnitKind,
  type PdfExtraction,
  type PdfPage,
  type PdfTextItem,
  type UnitDetection,
} from './pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * Eleventh NSW council GPFS adapter: Maitland City Council's audited General
 * Purpose Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Lake Macquarie (§7.10) reference
 * implementations in docs/NSW_COUNCILS.md with a Maitland-specific layout
 * adapter. It is a separate source id (`maitland-gpfs`) from every other
 * source. Every row is non-additive `agency_detail` with no region/LGA
 * allocation, so it can never be summed with the 245 Dubbo budget rows, any
 * existing council GPFS source, the 1 pre-existing row that exactly names the
 * council (1 uppercase "MAITLAND CITY COUNCIL" GrantConnect grant), the ACNC
 * charity / data.nsw school / AusTender rows that merely mention Maitland and
 * use different delivery_entity strings, or any other council.
 *
 * The PDF URL is discovered from the council's official "Financial reports and
 * plans" page (never a hard-coded document URL). The page is served over plain
 * HTTP (no Cloudflare/Akamai challenge was observed), so discovery and the PDF
 * download use direct fetch; the exact bytes are SHA-256 archived and
 * re-verified. The printed `$'000` unit is required.
 *
 * Maitland's Income Statement prints the Original unaudited budget column
 * before each line label, so the printed text order puts the budget value
 * before the label and the current/prior actuals after it. It also wraps two
 * subtotal labels over two visual rows and emits the depreciation label after
 * its amounts in the plain-text stream. The connector therefore reads the
 * Income Statement from the PDF's positioned text items (x/y), mapping the
 * printed label to the amount in the Actual 2025 column, rather than trusting
 * plain-text order.
 *
 * The Income Statement does not print a combined "Total expenses" line. The
 * published B1-1 "Net operating result for the year" row prints total expenses
 * ($169,995 thousand), which equals printed total income ($219,016 thousand)
 * less the printed net result ($49,021 thousand), and the Statement of
 * Comprehensive Income repeats the net result. Those top-level printed totals
 * reconcile exactly and are the defensible totals. The underlying component
 * lines carry a published +/-$1 thousand rounding difference (revenue
 * components sum to 219,017; printed expenses-excluding-depreciation 137,168
 * plus depreciation 32,828 = 169,996; printed operating + capital grants =
 * 75,738 versus B1-1 75,739; the printed before-capital result is (15,562)
 * versus net result less capital grants (15,561)). Because those components do
 * not reconcile exactly, only the printed top-level categories are emitted and
 * the rounding is retained as reconciliation evidence, never summed.
 */

export const MAITLAND_GPFS_ID = 'maitland-gpfs';
export const MAITLAND_GPFS_NAME = 'Maitland City Council — General Purpose Financial Statements';
export const MAITLAND_GPFS_PUBLISHER = 'Maitland City Council';
export const MAITLAND_GPFS_REPORTING_URL =
  'https://www.maitland.nsw.gov.au/council/about-council/financial-reports-and-plans';
export const MAITLAND_GPFS_FISCAL_YEAR = '2024-25';
export const MAITLAND_GPFS_TARGET_YEAR_LABEL = '2024/25';
export const MAITLAND_GPFS_SOURCE_DATASET = 'Maitland City Council GPFS 2024-25';
export const MAITLAND_GPFS_LICENSE =
  '© Maitland City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const MAITLAND_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const MAITLAND_GPFS_DELIVERY_ENTITY = 'Maitland City Council';

export interface MaitlandGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The annual/financial-statements page the PDF link was discovered from. */
  listing_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface MaitlandGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface MaitlandGpfsParseContext {
  document: MaitlandGpfsDocument;
  archive: MaitlandGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface MaitlandGpfsRejection {
  section: string;
  reason: string;
}

export type MaitlandGpfsSection = 'revenue' | 'expenses' | 'result';

export interface MaitlandGpfsLineSpec {
  key: string;
  label: string;
  section: MaitlandGpfsSection;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: string;
}

/**
 * The seven printed top-level lines we emit. Only these categories reconcile
 * exactly across the Income Statement, B1-1 and the Statement of Comprehensive
 * Income. The printed revenue/expense/grants components carry a published
 * +/-$1 thousand rounding difference and are deliberately not emitted (their
 * sums are retained in the reconciliation evidence). Total expenses is the
 * printed B1-1 total and equals printed total income less the printed net
 * result.
 */
export const MAITLAND_GPFS_LINES: ReadonlyArray<MaitlandGpfsLineSpec> = [
  {
    key: 'total_revenue',
    label: 'Total income from continuing operations',
    section: 'revenue',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label:
      'Total expenses from continuing operations (printed B1-1 total; equals printed total income less printed net result)',
    section: 'expenses',
    statement: 'Income Statement (published B1-1 total expenses)',
  },
  {
    key: 'employee_expenses',
    label: 'Employee benefits and on-costs',
    section: 'expenses',
    statement: 'Income Statement',
  },
  {
    key: 'depreciation_amortisation_impairment',
    label: 'Depreciation, amortisation and impairment of non-financial assets',
    section: 'expenses',
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_operating',
    label: 'Grants and contributions provided for operating purposes',
    section: 'revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_capital',
    label: 'Grants and contributions provided for capital purposes',
    section: 'revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
];

interface MaitlandGpfsLineValue {
  spec: MaitlandGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface MaitlandGpfsReconciliation {
  fiscal_year: string;
  unit: MoneyUnitKind;
  unit_evidence: string;
  income_statement_page: number;
  functions_page: number;
  comprehensive_income_page: number;
  depreciation_note_page: number | null;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  depreciation_amortisation_impairment: number;
  government_grants_operating: number;
  government_grants_capital: number;
  net_result: number;
  /** Printed subtotal; reconciliation evidence only, never emitted as a total. */
  printed_total_expenses_excluding_depreciation: number;
  /** Negative printed figure; reconciliation evidence only, never a stored row. */
  net_result_before_capital_grants: number;
  /** Sum of the printed revenue components (may differ from the total by 1). */
  revenue_components_sum: number;
  /** Sum of the printed expense-by-nature components excluding depreciation. */
  expense_components_sum: number;
  /** Sum of the printed operating and capital grant components. */
  grants_components_sum: number;
  /** Printed expenses-excluding-depreciation + printed depreciation. */
  face_expense_bridge: number;
  /** Depreciation total printed in note B3-3, when that page is present. */
  depreciation_note_total: number | null;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  comprehensive_income_net_result: number;
  /** Published +/-$1 thousand rounding retained as evidence. */
  rounding_notes: string[];
  checks: string[];
}

export interface MaitlandGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: MaitlandGpfsReconciliation | null;
  warnings: string[];
  rejections: MaitlandGpfsRejection[];
}

const NOTE_REFERENCE = /\b[A-E]\d+-\d+\b/g;
const MONEY_TOKEN = /(?:\(\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\))?/g;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(NOTE_REFERENCE, ' ').trim();
}

function decodeHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert a Maitland financial-statements link/text to a fiscal year. The
 * council labels the statements "General Purpose Financial Report 2024-25" and
 * the file name as "Financial Statements 2024-25 Final.pdf"; the page text may
 * also use "year ended 30 June 2025". Explicit consecutive ranges are handled
 * first; anything that is not a consecutive year pair is rejected.
 */
export function fiscalYearFromMaitlandGpfsLink(text: string): string | null {
  const spaced = text.replace(/%20/gi, ' ').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  const june = /year\s+ended\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(spaced);
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  // Keep hyphens/slashes for the explicit range form (e.g. 2024-25).
  const ranged = text.replace(/%20/gi, ' ').replace(/[_]+/g, ' ').replace(/\s+/g, ' ');
  const match = /((?:19|20)\d{2})\s*[-/]\s*((?:19|20)?\d{2})/.exec(ranged);
  if (!match) return null;
  const start = Number(match[1]);
  const endRaw = match[2]!;
  const end = endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
  if (end !== start + 1) return null;
  return `${start}-${String(end).slice(-2)}`;
}

interface Anchor {
  href: string;
  title: string;
  text: string;
  className: string;
}

function anchors(html: string): Anchor[] {
  const out: Anchor[] = [];
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const attrs = match[1]!;
    const hrefMatch = /href="([^"]+)"/i.exec(attrs);
    if (!hrefMatch) continue;
    const titleMatch = /title="([^"]*)"/i.exec(attrs);
    const classMatch = /class="([^"]*)"/i.exec(attrs);
    out.push({
      href: hrefMatch[1]!,
      title: titleMatch ? decodeHtml(titleMatch[1]!) : '',
      text: decodeHtml(match[2]!),
      className: classMatch ? classMatch[1]! : '',
    });
  }
  return out;
}

/**
 * Discover the audited GPFS PDF links from the official Maitland "Financial
 * reports and plans" page. The page lists the current "General Purpose
 * Financial Report 2024-25" anchor (and unrelated fees/asset-management PDFs);
 * the FY2024-25 report is selected from the anchor text and URL, never from a
 * hard-coded document URL.
 */
export function parseMaitlandGpfsReportLinks(
  html: string,
  baseUrl: string,
): MaitlandGpfsDocument[] {
  const links: MaitlandGpfsDocument[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors(html)) {
    const haystack = `${anchor.title} ${anchor.text}`;
    if (!/general purpose financial (?:report|statements?)|financial statements?/i.test(haystack))
      continue;
    if (/annual report/i.test(haystack)) continue;
    if (/fees and charges/i.test(haystack)) continue;
    if (/asset management/i.test(haystack)) continue;
    const looksLikePdf =
      /\.pdf(?:$|\?)/i.test(anchor.href) ||
      /\/sites\/default\/files\/documents\//i.test(anchor.href) ||
      /\bpdf\b/i.test(haystack);
    if (!looksLikePdf) continue;
    const fiscalYear =
      fiscalYearFromMaitlandGpfsLink(haystack) ?? fiscalYearFromMaitlandGpfsLink(anchor.href);
    if (!fiscalYear) continue;
    let url: string;
    try {
      url = new URL(anchor.href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({
      id: `gpfs-${fiscalYear}`,
      title: anchor.text || anchor.title,
      url,
      fiscal_year: fiscalYear,
      listing_url: baseUrl,
    });
  }
  return links;
}

/** Select the audited GPFS for the requested fiscal year. */
export function selectMaitlandGpfsDocument(
  links: readonly MaitlandGpfsDocument[],
  fiscalYear: string = MAITLAND_GPFS_FISCAL_YEAR,
): MaitlandGpfsDocument {
  const document = links.find((link) => link.fiscal_year === fiscalYear);
  if (!document) {
    throw new Error(
      `No published Maitland City Council General Purpose Financial Report link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** Discover the audited GPFS document from the live financial reports page. */
export async function discoverMaitlandGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = MAITLAND_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<MaitlandGpfsDocument> {
  let html: string;
  let listingUrl = MAITLAND_GPFS_REPORTING_URL;
  if (listingHtml) {
    html = listingHtml;
  } else {
    const response = await fetchImpl(MAITLAND_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Maitland City Council financial reports page fetch HTTP ${response.status} for ${MAITLAND_GPFS_REPORTING_URL}`,
      );
    }
    html = await response.text();
    listingUrl = response.url || listingUrl;
  }
  return selectMaitlandGpfsDocument(parseMaitlandGpfsReportLinks(html, listingUrl), fiscalYear);
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectMaitlandGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectMaitlandGpfsUnit([page.text]);
  const kind = unit.kind;
  if (!kind || unit.ambiguous) {
    throw new Error(
      `${section} p${page.page_number}: no unambiguous printed currency unit (${unit.reason}); refusing to guess`,
    );
  }
  return { kind, reason: unit.reason };
}

function amountsAfter(text: string, label: string): number[] {
  const index = text.indexOf(label);
  if (index < 0) return [];
  const rest = text.slice(index + label.length);
  const matches = rest.match(MONEY_TOKEN) ?? [];
  return matches
    .map((token) => parseAmountCell(token)?.value ?? null)
    .filter((value): value is number => value !== null);
}

function firstAmountAfter(text: string, label: string): number | null {
  return amountsAfter(text, label)[0] ?? null;
}

function findPage(
  pages: readonly PdfPage[],
  predicate: (page: PdfPage, text: string) => boolean,
): PdfPage | null {
  for (const page of pages) {
    if (predicate(page, normalizeText(page.text))) return page;
  }
  return null;
}

interface VisualRow {
  y: number;
  items: PdfTextItem[];
}

/**
 * Reconstruct visual rows from positioned text items. Amounts and their printed
 * labels can be a couple of units apart on the same baseline, so items within a
 * small tolerance are merged. This is the only reliable way to read Maitland's
 * Income Statement, whose plain-text stream interleaves the budget column and
 * places the depreciation label after its amounts.
 */
function visualRows(page: PdfPage, tolerance = 3): VisualRow[] {
  const rows: VisualRow[] = [];
  const sorted = [...page.items].sort((a, b) => b.y - a.y || a.x - b.x);
  for (const item of sorted) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

function rowLabel(row: VisualRow): string {
  return row.items
    .filter((item) => item.x >= 140 && item.x < 400)
    .map((item) => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RowAmounts {
  budget: number | null;
  actual2025: number | null;
  actual2024: number | null;
}

function rowAmounts(row: VisualRow): RowAmounts {
  const money = row.items
    .map((item) => ({ x: item.x, parsed: parseAmountCell(item.str) }))
    .filter(
      (entry) =>
        entry.parsed.value !== null &&
        Number.isFinite(entry.parsed.value) &&
        entry.x >= 60 &&
        entry.x <= 560,
    );
  const budget = money.find((entry) => entry.x < 140)?.parsed.value ?? null;
  const actual2025 = money.find((entry) => entry.x >= 425 && entry.x < 482)?.parsed.value ?? null;
  const actual2024 = money.find((entry) => entry.x >= 482 && entry.x <= 540)?.parsed.value ?? null;
  return { budget, actual2025, actual2024 };
}

function labelMatches(candidate: string, label: string): boolean {
  const a = candidate.toLowerCase().replace(/\s+/g, ' ').trim();
  const b = label.toLowerCase().replace(/\s+/g, ' ').trim();
  return a === b || a.startsWith(b) || a.includes(b);
}

/**
 * Read the Actual 2025 value for a printed Income Statement label. The label
 * may be wrapped over two visual rows (for example "Total expenses from
 * continuing operations excluding depreciation" + "and amortisation"), so the
 * nearest row carrying an Actual 2025 amount is used when the label row itself
 * has no amount.
 */
function readIncomeActual(
  rows: readonly VisualRow[],
  label: string,
): { value: number; row: VisualRow } | null {
  const labelRows = rows.filter((row) => labelMatches(rowLabel(row), label));
  if (labelRows.length === 0) return null;
  for (const row of labelRows) {
    const amounts = rowAmounts(row);
    if (amounts.actual2025 !== null) return { value: amounts.actual2025, row };
  }
  const anchor = labelRows[0]!;
  const candidates = rows
    .map((row) => ({ row, amounts: rowAmounts(row) }))
    .filter((candidate) => candidate.amounts.actual2025 !== null)
    .sort((a, b) => Math.abs(a.row.y - anchor.y) - Math.abs(b.row.y - anchor.y));
  const nearest = candidates[0];
  if (!nearest || Math.abs(nearest.row.y - anchor.y) > 16) return null;
  return { value: nearest.amounts.actual2025!, row: nearest.row };
}

export interface MaitlandGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse the B1-1 total row "Net operating result for the year". The row prints
 * ten numbers (Income 2025/2024, Expenses 2025/2024, Operating result
 * 2025/2024, Grants and contributions 2025/2024, Carrying amount 2025/2024);
 * the 2025 values are at indices 0, 2, 4 and 6.
 */
export function parseMaitlandGpfsFunctionsTotals(
  page: PdfPage,
): MaitlandGpfsFunctionsTotals | null {
  const text = normalizeText(page.text);
  const label = 'Net operating result for the year';
  if (!text.includes(label)) return null;
  const values = amountsAfter(text, label);
  if (values.length < 8) {
    throw new Error(
      `p${page.page_number}: B1-1 total row has ${values.length} numeric values, expected at least 8`,
    );
  }
  return {
    page_number: page.page_number,
    income: values[0]!,
    expenses: values[2]!,
    operating_result: values[4]!,
    grants_and_contributions: values[6]!,
  };
}

function gpfsFundingSource(spec: MaitlandGpfsLineSpec): string {
  if (spec.potential_double_count) return 'Government grants and contributions';
  if (spec.key === 'total_revenue')
    return 'Council total revenue (own-source plus government grants and contributions)';
  if (spec.section === 'revenue') return 'Council own-source revenue';
  if (spec.section === 'expenses') return 'Council expenditure';
  return 'Council result';
}

function gpfsUnitLabel(unit: MoneyUnitKind): string {
  switch (unit) {
    case 'dollars':
      return 'AUD_dollars';
    case 'thousands':
      return 'AUD_thousands';
    case 'millions':
      return 'AUD_millions';
    case 'billions':
      return 'AUD_billions';
  }
}

function notesFor(
  context: MaitlandGpfsParseContext,
  spec: MaitlandGpfsLineSpec,
  unit: MoneyUnitKind,
  unitReason: string,
  pageNumber: number,
  reconciliationNote: string,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document.title}`,
    `document_url: ${context.document.url}`,
    context.document.resolved_url
      ? `document_resolved_url: ${context.document.resolved_url}`
      : null,
    context.document.listing_url ? `listing_page: ${context.document.listing_url}` : null,
    context.reporting_url ? `reporting_url: ${context.reporting_url}` : null,
    `statement: ${spec.statement}`,
    `page: ${pageNumber}`,
    `printed_label: ${spec.label}`,
    `unit: ${unit} (explicit; ${unitReason})`,
    `reconciliation: ${reconciliationNote}`,
    'provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + document + line + fiscal year. */
export function maitlandGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = MAITLAND_GPFS_FISCAL_YEAR,
): string {
  return `${MAITLAND_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: MaitlandGpfsLineValue,
  context: MaitlandGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: MAITLAND_GPFS_FISCAL_YEAR,
    source_id: MAITLAND_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: maitlandGpfsNaturalKey(context.document.url, spec.key, MAITLAND_GPFS_FISCAL_YEAR),
    project_name: `Maitland City Council GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: MAITLAND_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: MAITLAND_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: MAITLAND_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    extraction_confidence: 'high',
    gpfs_line_item: spec.key,
    gpfs_line_label: spec.label,
    gpfs_unit: gpfsUnitLabel(unit),
    gpfs_section: spec.section,
    gpfs_statement: spec.statement,
    ...(printedSign === 'negative' ? { gpfs_printed_sign: printedSign } : {}),
    ...(spec.potential_double_count ? { potential_double_count: true } : {}),
    notes: notesFor(context, spec, unit, unitReason, line.page_number, reconciliationNote),
  };
}

/**
 * Parse the audited GPFS into validated, non-additive measure rows. Nothing is
 * emitted unless the printed unit is explicit and the printed top-level totals
 * reconcile exactly across the Income Statement, B1-1 and the Statement of
 * Comprehensive Income. The published +/-$1 thousand component rounding is
 * verified to be no worse than 1 and retained as evidence.
 */
export function parseMaitlandGpfsExtraction(
  extraction: PdfExtraction,
  context: MaitlandGpfsParseContext,
): MaitlandGpfsParseResult {
  const warnings: string[] = [];
  const rejections: MaitlandGpfsRejection[] = [];
  const reject = (reason: string): MaitlandGpfsParseResult => {
    rejections.push({ section: 'gpfs', reason });
    warnings.push(reason);
    return { records: [], reconciliation: null, warnings, rejections };
  };

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      text.includes('Original unaudited budget') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Net operating result for the year attributable to Council'),
  );
  if (!incomePage) {
    return reject('audited income statement page not found; no rows ingested');
  }
  const functionsPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Functions or activities - income, expenses and assets') &&
      text.includes('Net operating result for the year'),
  );
  if (!functionsPage) {
    return reject('B1-1 Functions or activities page not found; no rows ingested');
  }
  const comprehensivePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Comprehensive Income') && /from income statement/i.test(text),
  );
  if (!comprehensivePage) {
    return reject(
      'Statement of Comprehensive Income page not found; no independent printed net-result check',
    );
  }
  const depreciationPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Total depreciation and amortisation costs') &&
      text.includes('Depreciation and amortisation'),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: MaitlandGpfsFunctionsTotals | null;
  let comprehensiveNetResult: number | null;
  let depreciationNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseMaitlandGpfsFunctionsTotals(functionsPage);
    comprehensiveNetResult = firstAmountAfter(
      normalizeText(comprehensivePage.text),
      'from income statement',
    );
    if (depreciationPage) {
      depreciationNoteTotal = firstAmountAfter(
        normalizeText(depreciationPage.text),
        'Total depreciation and amortisation costs',
      );
    }
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error));
  }
  if (incomeUnit.kind !== functionsUnit.kind) {
    return reject(
      `printed units disagree: income statement ${incomeUnit.kind}, B1-1 ${functionsUnit.kind}; refusing to mix`,
    );
  }
  if (!functionsTotals) {
    return reject('B1-1 total row not found; no rows ingested');
  }
  if (comprehensiveNetResult === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed comprehensive-income net result; no rows ingested`,
    );
  }
  const unit = incomeUnit.kind;

  const rows = visualRows(incomePage);
  const read = (label: string): number | null => readIncomeActual(rows, label)?.value ?? null;

  const rates = read('Rates and annual charges');
  const userCharges = read('User charges and fees');
  const otherRevenues = read('Other revenues');
  const grantsOperating = read('Grants and contributions provided for operating purposes');
  const grantsCapital = read('Grants and contributions provided for capital purposes');
  const interest = read('Interest and investment income');
  const otherIncome = read('Other Income');
  const totalRevenue = read('Total income from continuing operations');
  const employee = read('Employee benefits and on-costs');
  const materials = read('Materials and Services');
  const borrowing = read('Borrowing costs');
  const otherExpenses = read('Other expenses');
  const netLossDisposal = read('Net loss from the disposal of assets');
  const expensesExDepreciation = read(
    'Total expenses from continuing operations excluding depreciation',
  );
  const depreciation = read('Depreciation, amortisation and impairment of non-financial assets');
  const netResult = read('Net operating result for the year attributable to Council');
  const netResultBeforeCapital = read('Net operating result for the year before grants and');

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['net_result', netResult],
    ['rates_and_annual_charges', rates],
    ['user_charges_and_fees', userCharges],
    ['other_revenues', otherRevenues],
    ['interest_and_investment_income', interest],
    ['other_income', otherIncome],
    ['materials_and_services', materials],
    ['borrowing_costs', borrowing],
    ['other_expenses', otherExpenses],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['printed_total_expenses_excluding_depreciation', expensesExDepreciation],
    ['net_result_before_capital_grants', netResultBeforeCapital],
  ];
  const missing = required.filter(([, value]) => value === null).map(([key]) => key);
  if (missing.length > 0) {
    return reject(`could not read printed line(s): ${missing.join(', ')}; no rows ingested`);
  }

  // Top-level printed totals: the Income Statement does not print a combined
  // total-expenses line, so total expenses is the printed B1-1 total, which is
  // independently equal to printed total income less the printed net result.
  const totalExpenses = functionsTotals.expenses;
  const incomeMinusResult = totalRevenue! - totalExpenses;

  const revenueComponentsSum =
    rates! +
    userCharges! +
    otherRevenues! +
    grantsOperating! +
    grantsCapital! +
    interest! +
    otherIncome!;
  const expenseComponentsSum =
    employee! + materials! + borrowing! + otherExpenses! + netLossDisposal!;
  const grantsComponentsSum = grantsOperating! + grantsCapital!;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;

  const checks: string[] = [];
  const fail = (message: string): void => {
    checks.push(message);
  };
  const requireEqual = (label: string, expected: number, actual: number): void => {
    if (expected !== actual) fail(`${label}: printed/derived ${actual} != expected ${expected}`);
  };
  const requireWithinOne = (label: string, expected: number, actual: number): void => {
    if (Math.abs(expected - actual) > 1) {
      fail(`${label}: printed/derived ${actual} differs from ${expected} by more than 1 thousand`);
    }
  };

  requireEqual('printed total income = B1-1 income', totalRevenue!, functionsTotals.income);
  requireEqual('printed total expenses = B1-1 expenses', totalExpenses, functionsTotals.expenses);
  requireEqual(
    'printed net result = B1-1 operating result',
    netResult!,
    functionsTotals.operating_result,
  );
  requireEqual(
    'printed total income - printed total expenses = printed net result',
    netResult!,
    incomeMinusResult,
  );
  requireEqual(
    'Statement of Comprehensive Income net result = Income Statement net result',
    netResult!,
    comprehensiveNetResult!,
  );
  requireEqual(
    'printed total expenses excluding depreciation = expense components sum',
    expensesExDepreciation!,
    expenseComponentsSum,
  );
  if (depreciationNoteTotal !== null) {
    requireEqual(
      'printed depreciation/amortisation line = note B3-3 total',
      depreciation!,
      depreciationNoteTotal,
    );
  }

  // The published actual/prior columns carry a +/-$1 thousand rounding
  // difference in the component lines. Verify it is no worse than 1 and retain
  // it as evidence; the top-level printed totals above are exact.
  requireWithinOne(
    'revenue components sum vs printed total income (published rounding)',
    totalRevenue!,
    revenueComponentsSum,
  );
  requireWithinOne(
    'printed expenses excluding depreciation + printed depreciation vs printed total expenses (published rounding)',
    totalExpenses,
    faceExpenseBridge,
  );
  requireWithinOne(
    'printed operating + capital grants vs B1-1 grants and contributions (published rounding)',
    functionsTotals.grants_and_contributions,
    grantsComponentsSum,
  );
  requireWithinOne(
    'printed net result less capital grants vs printed before-capital result (published rounding)',
    netResultBeforeCapital!,
    netResult! - grantsCapital!,
  );
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const roundingNotes = [
    `revenue components sum ${revenueComponentsSum} vs printed total income ${totalRevenue} (${revenueComponentsSum - totalRevenue! >= 0 ? '+' : ''}${revenueComponentsSum - totalRevenue!} thousand)`,
    `printed expenses excluding depreciation ${expensesExDepreciation} + printed depreciation ${depreciation} = ${faceExpenseBridge} vs printed total expenses ${totalExpenses} (${faceExpenseBridge - totalExpenses >= 0 ? '+' : ''}${faceExpenseBridge - totalExpenses} thousand)`,
    `printed operating + capital grants ${grantsComponentsSum} vs B1-1 grants and contributions ${functionsTotals.grants_and_contributions} (${grantsComponentsSum - functionsTotals.grants_and_contributions >= 0 ? '+' : ''}${grantsComponentsSum - functionsTotals.grants_and_contributions} thousand)`,
    `printed before-capital result ${netResultBeforeCapital} vs printed net result less capital grants ${netResult! - grantsCapital!} (${netResultBeforeCapital! - (netResult! - grantsCapital!) >= 0 ? '+' : ''}${netResultBeforeCapital! - (netResult! - grantsCapital!)} thousand)`,
  ];

  const reconciliation: MaitlandGpfsReconciliation = {
    fiscal_year: MAITLAND_GPFS_FISCAL_YEAR,
    unit,
    unit_evidence: incomeUnit.reason,
    income_statement_page: incomePage.page_number,
    functions_page: functionsPage.page_number,
    comprehensive_income_page: comprehensivePage.page_number,
    depreciation_note_page: depreciationPage?.page_number ?? null,
    total_revenue: totalRevenue!,
    total_expenses: totalExpenses,
    employee_expenses: employee!,
    depreciation_amortisation_impairment: depreciation!,
    government_grants_operating: grantsOperating!,
    government_grants_capital: grantsCapital!,
    net_result: netResult!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    net_result_before_capital_grants: netResultBeforeCapital!,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    grants_components_sum: grantsComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    depreciation_note_total: depreciationNoteTotal,
    functions_total_income: functionsTotals.income,
    functions_total_expenses: functionsTotals.expenses,
    functions_operating_result: functionsTotals.operating_result,
    functions_grants_and_contributions: functionsTotals.grants_and_contributions,
    comprehensive_income_net_result: comprehensiveNetResult!,
    rounding_notes: roundingNotes,
    checks: [
      'printed total income equals the B1-1 income total',
      'printed total expenses equals the B1-1 expenses total and printed total income less printed net result',
      'printed net result equals the B1-1 operating result and the Statement of Comprehensive Income net result',
      'printed expenses excluding depreciation equals the sum of the expense-by-nature components',
      'the Income Statement depreciation line equals the note B3-3 total when that note is present',
      'the published +/-$1 thousand component rounding is at most 1 and is retained as evidence; component rows are not emitted and never summed',
      'the printed net result is positive and stored as a non-negative magnitude; the printed before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the published B1-1 total (169,995), equal to printed total income (219,016) less the printed net result (49,021); the Income Statement does not print a combined total-expenses line; the printed expenses-excluding-depreciation (137,168) plus printed depreciation (32,828) equals 169,996, a published $1k rounding difference; the printed revenue/expense/grants components carry the same +/-$1k published rounding and are not emitted; the B1-1 totals and Statement of Comprehensive Income net result reconcile exactly';
  const values: MaitlandGpfsLineValue[] = [];
  for (const spec of MAITLAND_GPFS_LINES) {
    if (spec.key === 'total_expenses') {
      values.push({ spec, value: totalExpenses, page_number: incomePage.page_number });
      continue;
    }
    const value =
      spec.key === 'total_revenue'
        ? totalRevenue
        : spec.key === 'employee_expenses'
          ? employee
          : spec.key === 'depreciation_amortisation_impairment'
            ? depreciation
            : spec.key === 'government_grants_operating'
              ? grantsOperating
              : spec.key === 'government_grants_capital'
                ? grantsCapital
                : spec.key === 'net_result'
                  ? netResult
                  : null;
    if (value === null) {
      return reject(`could not map printed line ${spec.key}; no rows ingested`);
    }
    values.push({ spec, value, page_number: incomePage.page_number });
  }

  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: total income ${totalRevenue} and total expenses ${totalExpenses} ($'000); published component rounding retained as evidence`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface MaitlandGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: MaitlandGpfsDocument;
  /** Pre-fetched PDF bytes; the live path downloads the discovered URL. */
  pdfBytes?: Uint8Array;
  /**
   * Pre-fetched listing-page HTML. The connector still discovers the PDF link
   * from this HTML; no document URL is hard-coded.
   */
  listingHtml?: string;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through to the stable name.
  }
  return 'general-purpose-financial-report-2024-25.pdf';
}

/** Build the live Maitland City Council GPFS connector. */
export function createMaitlandGpfsConnector(options: MaitlandGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: MAITLAND_GPFS_ID,
    name: MAITLAND_GPFS_NAME,
    publisher: MAITLAND_GPFS_PUBLISHER,
    source_url: MAITLAND_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: MAITLAND_GPFS_LICENSE,
    notes:
      "Eleventh NSW council GPFS adapter: one council only (Maitland City Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official Financial reports and plans page (no hard-coded document URL) over plain HTTP, the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 totals and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Only the printed top-level categories that reconcile exactly are emitted; the published +/-$1 thousand component rounding is retained as reconciliation evidence and components are never summed.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverMaitlandGpfsDocument(
          fetchImpl,
          MAITLAND_GPFS_FISCAL_YEAR,
          options.listingHtml,
        ));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, { redirect: 'follow' });
        if (!response.ok) {
          throw new Error(
            `Maitland City Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: MaitlandGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: MAITLAND_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Maitland City Council FY2024-25 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: MaitlandGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: MAITLAND_GPFS_REPORTING_URL,
      };
      const parsed = parseMaitlandGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'maitland-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'maitland-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Maitland City Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
