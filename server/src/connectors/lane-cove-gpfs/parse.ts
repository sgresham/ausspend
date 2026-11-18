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
} from '../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import type { Connector, RawRecord } from '../types.js';

/**
 * Thirty-first NSW council GPFS adapter: Lane Cove Council's audited General
 * Purpose Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Ku-ring-gai (§7.30) reference
 * implementations in docs/NSW_COUNCILS.md. It is a separate source id
 * (`lane-cove-gpfs`) from every other source. Every row is non-additive
 * `agency_detail` with no region/LGA allocation, so it is never summed with the
 * Dubbo budget rows, any existing council GPFS source, the pre-existing
 * federal/state/charity rows whose `delivery_entity` mentions Lane Cove, or any
 * other council.
 *
 * Lane Cove publishes no standalone GPFS PDF. The audited FY2024-25 General
 * Purpose Financial Statements are Section 3 of the official Annual Report
 * 2024-25 PDF, linked from the official "Community Strategic Plan" page under
 * the printed link text "Annual Report". The council's TRIM document link
 * resolves through a JavaScript redirect to the exact PDF. The connector
 * discovers the document-link URL from the page HTML (never a hard-coded PDF
 * URL), resolves the PDF URL from the TRIM redirect, and re-verifies the exact
 * bytes by SHA-256. The exact bytes are archived outside the repo.
 *
 * The GPFS prints the Income Statement (PDF p89), Statement of Comprehensive
 * Income (p90), the B1-1 "Functions or activities" note (p99) and note B3-3
 * depreciation (p110). The Income Statement prints the Original unaudited
 * budget column left of the label, the FY2024-25 Actual column to its right and
 * the FY2023-24 Actual column furthest right, so the adapter groups text items
 * by y and reads the Actual 2025 column by x coordinate. It never sums a page's
 * components to obtain an emitted total.
 *
 * The printed face-statement bridge is: expenses excluding
 * depreciation/amortisation/impairment ($58,055 thousand) plus depreciation,
 * amortisation and impairment ($10,924 thousand) = $68,979 thousand, which
 * equals printed total income ($97,804 thousand) less the printed operating
 * result ($28,825 thousand). The B1-1 "Total functions and activities" column
 * prints the same income ($97,804), expenses ($68,979), operating result
 * ($28,825) and grants and contributions ($26,637 = operating $4,716 + capital
 * $21,921). Total expenses is the printed B1-1 figure, not a derived one.
 */

export const LANE_COVE_GPFS_ID = 'lane-cove-gpfs';
export const LANE_COVE_GPFS_NAME = 'Lane Cove Council — General Purpose Financial Statements';
export const LANE_COVE_GPFS_PUBLISHER = 'Lane Cove Council';
export const LANE_COVE_GPFS_REPORTING_URL =
  'https://www.lanecove.nsw.gov.au/Council/Plans-and-Publications/Community-Strategic-Plan';
export const LANE_COVE_GPFS_FISCAL_YEAR = '2024-25';
export const LANE_COVE_GPFS_SOURCE_DATASET = 'Lane Cove Council GPFS 2024-25';
export const LANE_COVE_GPFS_LICENSE =
  '© Lane Cove Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const LANE_COVE_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const LANE_COVE_GPFS_DELIVERY_ENTITY = 'Lane Cove Council';

export interface LaneCoveGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The official listing page the annual report was found on. */
  listing_url?: string;
  /** The council TRIM document link that resolves to the PDF. */
  document_link_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface LaneCoveGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface LaneCoveGpfsParseContext {
  document: LaneCoveGpfsDocument;
  archive: LaneCoveGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface LaneCoveGpfsRejection {
  section: string;
  reason: string;
}

export type LaneCoveGpfsSection = 'revenue' | 'expenses' | 'result';

export interface LaneCoveGpfsLineSpec {
  key: string;
  label: string;
  section: LaneCoveGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'B1-1 Functions or activities';
  /**
   * When set, read the last printed occurrence of the label. The
   * expenses-excluding-depreciation total wraps as "... excluding /
   * depreciation, amortisation and impairment of non-financial / assets", whose
   * last two lines are themselves the depreciation line's label; the standalone
   * depreciation line is the later occurrence.
   */
  last_occurrence?: boolean;
}

/**
 * The printed Income Statement lines we emit. The eight revenue components sum
 * exactly to the printed total income. The four non-nil expense components sum
 * exactly to the printed "Total expenses ... excluding depreciation,
 * amortisation and impairment of non-financial assets" line, which with the
 * printed depreciation line forms the printed face-statement expense bridge.
 * Total expenses is the printed B1-1 "Total functions and activities" expense
 * total, which equals that face-statement bridge exactly. We do not emit the
 * B1-1 function split, and the nil 2025 net-share-of-JV expense line is not
 * emitted.
 */
export const LANE_COVE_GPFS_LINES: ReadonlyArray<LaneCoveGpfsLineSpec> = [
  {
    key: 'rates_and_annual_charges',
    label: 'Rates and annual charges',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'user_charges_and_fees',
    label: 'User charges and fees',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_revenues',
    label: 'Other revenues',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_operating',
    label: 'Grants and contributions provided for operating purposes',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_capital',
    label: 'Grants and contributions provided for capital purposes',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'interest_and_investment_income',
    label: 'Interest and investment income',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_income',
    label: 'Other income',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'net_share_jv_revenue',
    label: 'Net share of interests in joint ventures and associates using the equity method',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'total_revenue',
    label: 'Total income from continuing operations',
    section: 'revenue',
    statement: 'Income Statement',
  },
  {
    key: 'employee_expenses',
    label: 'Employee benefits and on-costs',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'materials_and_services',
    label: 'Materials and services',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'other_expenses',
    label: 'Other expenses',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'net_loss_from_disposal_of_assets',
    label: 'Net loss from the disposal of assets',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses_excluding_depreciation',
    label:
      'Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'depreciation_amortisation_impairment',
    label: 'Depreciation, amortisation and impairment of non financial assets',
    last_occurrence: true,
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label: 'Total functions and activities — expenses (B1-1 printed total)',
    section: 'expenses',
    statement: 'B1-1 Functions or activities',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
];

export const LANE_COVE_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL =
  'Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets';
export const LANE_COVE_GPFS_OPERATING_RESULT_LABEL = 'Operating result from continuing operations';
export const LANE_COVE_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';
export const LANE_COVE_GPFS_COMPREHENSIVE_NET_RESULT_LABEL =
  'Net operating result for the year from Income Statement';
export const LANE_COVE_GPFS_OCI_LABEL = 'Total other comprehensive income for the year';
export const LANE_COVE_GPFS_COMPREHENSIVE_TOTAL_LABEL =
  'Total comprehensive income for the year attributable to Council';
export const LANE_COVE_GPFS_DEPRECIATION_NOTE_LABEL =
  'Total depreciation, amortisation and impairment of non-financial assets';

interface LaneCoveGpfsLineValue {
  spec: LaneCoveGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface LaneCoveGpfsReconciliation {
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
  net_share_jv_revenue: number;
  net_loss_from_disposal_of_assets: number;
  materials_and_services: number;
  other_expenses: number;
  net_result: number;
  /** Printed continuing operating result; reconciliation evidence only. */
  operating_result: number;
  /** Printed operating result before depreciation; reconciliation evidence only. */
  operating_result_excluding_depreciation: number;
  /** Printed before-capital result; reconciliation evidence only. */
  net_result_before_capital_grants: number;
  printed_total_expenses_excluding_depreciation: number;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  comprehensive_income_net_result: number;
  comprehensive_income_other: number;
  comprehensive_income_total: number;
  depreciation_impairment_note_total: number | null;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface LaneCoveGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: LaneCoveGpfsReconciliation | null;
  warnings: string[];
  rejections: LaneCoveGpfsRejection[];
}

// Note references include both dashed forms (B2-1, C1-5), which must not be
// mistaken for a printed amount.
const NOTE_REFERENCE = /\b[A-E]\d+(?:-\d+)?\b/g;
const MONEY_TOKEN = /^\(?\d{1,3}(?:[.,]\d{3})*(?:\.\d+)?\)?$/;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(NOTE_REFERENCE, ' ').trim();
}

function normalizeLabel(text: string): string {
  return text
    .replace(NOTE_REFERENCE, ' ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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
 * Convert a Lane Cove annual-report link text or filename to a fiscal year.
 * The page prints "Annual Report 2024/25"; the document link carries no year.
 * Consecutive year ranges, "2024/25" and June year-ends are handled. Anything
 * that is not a consecutive year pair is rejected.
 */
export function fiscalYearFromLaneCoveGpfsLink(text: string): string | null {
  const normalizedText = text.replace(/[\u2010-\u2015\u2212]/g, '-');
  let decodedText = normalizedText;
  try {
    decodedText = decodeURIComponent(normalizedText);
  } catch {
    // Keep the raw text when a stray percent sign is not valid percent-encoding.
  }
  const whitespaceCollapsed = decodedText.replace(/\s+/g, ' ').trim();
  const collapsed = decodedText.replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ');
  const compact = decodedText.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();

  const june = /year\s+(?:ending|ended)\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
    whitespaceCollapsed,
  );
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }

  // "Annual Report 2024/25", "2024-2025 Annual Report", "2024/2025".
  const consecutive = /((?:19|20)\d{2})\s*[-/]\s*((?:19|20)?\d{2})/.exec(compact);
  if (consecutive) {
    const start = Number(consecutive[1]);
    const endRaw = consecutive[2]!;
    const end =
      endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
    if (end === start + 1) return `${start}-${String(end).slice(-2)}`;
  }

  // A bare statement end year in a filename (e.g. "...-2025.pdf").
  const bare = /(?:^|\D)((?:19|20)\d{2})(?:\D|$)/.exec(collapsed);
  if (bare) {
    const end = Number(bare[1]);
    if (end >= 2010 && end <= 2035) return `${end - 1}-${String(end).slice(-2)}`;
  }
  return null;
}

interface Anchor {
  href: string;
  text: string;
  title: string;
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
    out.push({
      href: decodeHtml(hrefMatch[1]!),
      text: decodeHtml(match[2]!),
      title: decodeHtml(titleMatch?.[1] ?? ''),
    });
  }
  return out;
}

export interface LaneCoveGpfsReportPage {
  documentUrl: string;
  title: string;
}

/**
 * Lane Cove's own site (including the ecouncil TRIM subdomain) is the only host
 * accepted for the annual-report document link. Any other host is rejected even
 * if the anchor text matches.
 */
function isLaneCoveDocumentHost(hostname: string): boolean {
  return /(^|\.)lanecove\.nsw\.gov\.au$/i.test(hostname);
}

/**
 * Discover the audited FY2024-25 annual report from the official Community
 * Strategic Plan page. The page lists the report under the printed link text
 * "Annual Report", which resolves to a council TRIM DocumentLink. The link is
 * parsed from the page HTML, never guessed.
 */
export function parseLaneCoveGpfsReportPage(
  html: string,
  baseUrl: string,
  fiscalYear: string = LANE_COVE_GPFS_FISCAL_YEAR,
): LaneCoveGpfsReportPage | null {
  const startYear = Number(fiscalYear.slice(0, 4));
  const endYear = startYear + 1;
  if (!Number.isFinite(startYear)) return null;
  // The link text itself is just "Annual Report"; the surrounding page text
  // names the year ("Annual Report 2024/25"). Require the requested year to be
  // present so a prior-year report is never selected.
  const yearPattern = new RegExp(
    `${startYear}\\s*[/-]\\s*(?:${String(endYear).slice(-2)}|${endYear})`,
  );
  const pageText = decodeHtml(html);
  if (!yearPattern.test(pageText)) return null;
  for (const anchor of anchors(html)) {
    if (!/annual\s+report/i.test(`${anchor.text} ${anchor.title}`)) continue;
    if (!/DocumentLink\.asp\?RecId=/i.test(anchor.href)) continue;
    let url: URL;
    try {
      url = new URL(anchor.href, baseUrl);
    } catch {
      continue;
    }
    if (!isLaneCoveDocumentHost(url.hostname)) continue;
    return {
      documentUrl: url.toString(),
      title: `Lane Cove Council Annual Report ${fiscalYear} (containing the audited General Purpose Financial Statements)`,
    };
  }
  return null;
}

/**
 * Resolve the exact PDF URL from the council TRIM DocumentLink response, which
 * is a tiny HTML page with a JavaScript `location.replace('…PDF')`. Returns
 * null when no such redirect is present.
 */
export function resolveLaneCoveGpfsPdfUrl(documentLinkHtml: string): string | null {
  const match = /location\.replace\(\s*(['"])([^'"]+)\1\s*\)/i.exec(documentLinkHtml);
  if (!match) return null;
  // Preserve the exact source URL, including any internal spaces in the
  // publisher's filename; only decode the common HTML ampersand entity.
  return match[2]!.replace(/&amp;/gi, '&').trim();
}

export interface LaneCoveGpfsDiscoveryOverrides {
  listingHtml?: string;
  documentLinkHtml?: string;
}

/** Discover the audited GPFS document from the official page HTML. */
export async function discoverLaneCoveGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = LANE_COVE_GPFS_FISCAL_YEAR,
  overrides: LaneCoveGpfsDiscoveryOverrides = {},
): Promise<LaneCoveGpfsDocument> {
  let listingHtml = overrides.listingHtml;
  let listingUrl = LANE_COVE_GPFS_REPORTING_URL;
  if (listingHtml === undefined) {
    const response = await fetchImpl(LANE_COVE_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Lane Cove Community Strategic Plan page fetch HTTP ${response.status} for ${LANE_COVE_GPFS_REPORTING_URL}`,
      );
    }
    listingHtml = await response.text();
    listingUrl = response.url || listingUrl;
  }
  const page = parseLaneCoveGpfsReportPage(listingHtml, listingUrl, fiscalYear);
  if (!page) {
    throw new Error(
      `Lane Cove FY${fiscalYear} page has no official "Annual Report" document link for that year; refusing to guess a document URL`,
    );
  }
  let documentLinkHtml = overrides.documentLinkHtml;
  if (documentLinkHtml === undefined) {
    const response = await fetchImpl(page.documentUrl, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Lane Cove TRIM document link fetch HTTP ${response.status} for ${page.documentUrl}`,
      );
    }
    documentLinkHtml = await response.text();
  }
  const pdfUrl = resolveLaneCoveGpfsPdfUrl(documentLinkHtml);
  if (!pdfUrl) {
    throw new Error(
      'Lane Cove TRIM document link did not resolve to a PDF URL; refusing to guess a document URL',
    );
  }
  return {
    id: `gpfs-${fiscalYear}`,
    title: page.title,
    url: pdfUrl,
    fiscal_year: fiscalYear,
    listing_url: listingUrl,
    document_link_url: page.documentUrl,
    resolved_url: pdfUrl,
  };
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectLaneCoveGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectLaneCoveGpfsUnit([page.text]);
  const kind = unit.kind;
  if (!kind || unit.ambiguous) {
    throw new Error(
      `${section} p${page.page_number}: no unambiguous printed currency unit (${unit.reason}); refusing to guess`,
    );
  }
  return { kind, reason: unit.reason };
}

interface PrintedRow {
  y: number;
  items: PdfTextItem[];
  labelText: string;
  /** FY2024-25 Actual column value (x in the middle column band), if printed. */
  actual: number | null;
  numbers: number[];
}

function isMoneyToken(text: string): boolean {
  const trimmed = text.trim();
  if (!MONEY_TOKEN.test(trimmed)) return false;
  return parseAmountCell(trimmed).value !== null;
}

/**
 * Reconstruct printed rows from PDF text-item coordinates. Lane Cove prints a
 * row's label and its three amounts on the same printed line, so grouping by y
 * and sorting by x recovers the printed table. The Actual 2025 column is
 * isolated by its x band (the note column sits left of it, the prior-year column
 * right of it).
 */
export function buildLaneCoveRows(page: PdfPage): PrintedRow[] {
  const items = page.items.filter((item) => item.str.trim().length > 0);
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: PdfTextItem[][] = [];
  for (const item of sorted) {
    const group = groups[groups.length - 1];
    if (group && Math.abs(group[0]!.y - item.y) <= 3) {
      group.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups.map((group) => {
    const groupItems = [...group].sort((a, b) => a.x - b.x);
    const numbers: number[] = [];
    const labelParts: string[] = [];
    let actual: number | null = null;
    for (const item of groupItems) {
      if (isMoneyToken(item.str)) {
        const value = parseAmountCell(item.str).value;
        if (value !== null) {
          numbers.push(value);
          if (item.x >= 380 && item.x < 485) actual = value;
        }
      } else if (!/^[–—-]$/.test(item.str.trim())) {
        labelParts.push(item.str);
      }
    }
    return {
      y: group[0]!.y,
      items: groupItems,
      labelText: labelParts.join(' ').replace(NOTE_REFERENCE, ' ').replace(/\s+/g, ' ').trim(),
      actual,
      numbers,
    };
  });
}

interface FoundLine {
  row: PrintedRow;
  actual: number;
  numbers: number[];
}

/**
 * Find a printed line by its exact (possibly multi-line) label. The label is
 * compared against the current row and up to the two preceding rows, so a
 * wrapped label such as "Total expenses ... excluding / depreciation ... /
 * assets" matches the row that prints its final line and amounts.
 */
export function findLaneCoveLine(
  rows: readonly PrintedRow[],
  label: string,
  lastOccurrence = false,
): FoundLine | null {
  const target = normalizeLabel(label);
  let match: FoundLine | null = null;
  for (let index = 0; index < rows.length; index += 1) {
    for (let span = 1; span <= 3; span += 1) {
      if (index - span + 1 < 0) break;
      const combined = rows
        .slice(index - span + 1, index + 1)
        .map((row) => row.labelText)
        .join(' ');
      if (normalizeLabel(combined) !== target) continue;
      const rowWithNumbers = rows[index]!.numbers.length
        ? rows[index]!
        : (rows[index + 1] ?? rows[index]!);
      if (rowWithNumbers.actual !== null) {
        match = {
          row: rowWithNumbers,
          actual: rowWithNumbers.actual,
          numbers: rowWithNumbers.numbers,
        };
        if (!lastOccurrence) return match;
        break;
      }
    }
  }
  return match;
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

function readLine(
  rows: readonly PrintedRow[],
  spec: LaneCoveGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): LaneCoveGpfsLineValue | null {
  const found = findLaneCoveLine(rows, spec.label, spec.last_occurrence ?? false);
  if (!found) {
    errors.push(`p${pageNumber}: could not read printed row for "${spec.label}"`);
    return null;
  }
  return { spec, value: found.actual, page_number: pageNumber };
}

function lineByKey(values: readonly LaneCoveGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface LaneCoveGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse the B1-1 "Functions or activities" note. Lane Cove transposes the
 * usual table: functions are columns and the categories (Income, Expenses,
 * Operating result, Grants and contributions) are rows, with a
 * "Total functions and activities" total column. For each category row we read
 * the money item in that total column nearest the row label (the 2025 sub-row
 * sits immediately below the label; the 2024 sub-row further above). We never
 * sum the function columns.
 */
export function parseLaneCoveGpfsFunctionsTotals(page: PdfPage): LaneCoveGpfsFunctionsTotals {
  const header = page.items.find((item) => item.str.trim() === 'Total functions and activities');
  if (!header) {
    throw new Error(`p${page.page_number}: B1-1 Total functions and activities column not found`);
  }
  const totalX = header.x;
  const readTotal = (labelText: string): number => {
    const labels = page.items
      .filter((item) => item.str.trim() === labelText && item.x < 200)
      .sort((a, b) => b.y - a.y);
    const label = labels[0];
    if (!label) {
      throw new Error(`p${page.page_number}: B1-1 "${labelText}" row label not found`);
    }
    let best: { value: number; distance: number } | null = null;
    for (const item of page.items) {
      if (Math.abs(item.x - totalX) > 3) continue;
      if (!isMoneyToken(item.str)) continue;
      const value = parseAmountCell(item.str).value;
      if (value === null) continue;
      const distance = Math.abs(item.y - label.y);
      if (best === null || distance < best.distance) best = { value, distance };
    }
    if (best === null || best.distance > 30) {
      throw new Error(
        `p${page.page_number}: B1-1 "${labelText}" total column value not found near the row label`,
      );
    }
    return best.value;
  };
  return {
    page_number: page.page_number,
    income: readTotal('Income'),
    expenses: readTotal('Expenses'),
    operating_result: readTotal('Operating result'),
    grants_and_contributions: readTotal('Grants and contributions'),
  };
}

function gpfsFundingSource(spec: LaneCoveGpfsLineSpec): string {
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
  context: LaneCoveGpfsParseContext,
  spec: LaneCoveGpfsLineSpec,
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
    context.document.document_link_url
      ? `document_link: ${context.document.document_link_url}`
      : null,
    context.document.listing_url ? `listing_page: ${context.document.listing_url}` : null,
    context.reporting_url ? `reporting_url: ${context.reporting_url}` : null,
    `statement: ${spec.statement}`,
    `page: ${pageNumber}`,
    `printed_label: ${spec.label}`,
    `unit: ${unit} (explicit; ${unitReason})`,
    `reconciliation: ${reconciliationNote}`,
    'the audited General Purpose Financial Statements for the year ended 30 June 2025 are Section 3 of the official Lane Cove Council Annual Report 2024-25 PDF linked from the council Community Strategic Plan page; the independent auditor’s reports on the financial statements are included in the same PDF; provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/**
 * Stable upsert identity: source + exact-document SHA-256 + line + fiscal year.
 *
 * The council TRIM document-link URL carries a volatile internal document id
 * (`.../documents_TE/<id>/...`) that can change between requests while the PDF
 * bytes stay identical, so the URL is not a stable identity. The archived
 * SHA-256 of the exact bytes is.
 */
export function laneCoveGpfsNaturalKey(
  documentIdentity: string,
  lineItem: string,
  fiscalYear: string = LANE_COVE_GPFS_FISCAL_YEAR,
): string {
  return `${LANE_COVE_GPFS_ID}:${createHash('sha256')
    .update(`${documentIdentity}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: LaneCoveGpfsLineValue,
  context: LaneCoveGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: LANE_COVE_GPFS_FISCAL_YEAR,
    source_id: LANE_COVE_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: laneCoveGpfsNaturalKey(
      context.archive.sha256,
      spec.key,
      LANE_COVE_GPFS_FISCAL_YEAR,
    ),
    project_name: `Lane Cove Council GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: LANE_COVE_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: LANE_COVE_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: LANE_COVE_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    extraction_confidence: 'high',
    gpfs_line_item: spec.key,
    gpfs_line_label: spec.label,
    gpfs_unit: gpfsUnitLabel(unit),
    gpfs_section: spec.section,
    gpfs_statement: spec.statement,
    ...(printedSign === 'negative' ? { gpfs_printed_sign: printedSign } : {}),
    ...(spec.component_of ? { gpfs_component_of: spec.component_of } : {}),
    ...(spec.potential_double_count ? { potential_double_count: true } : {}),
    notes: notesFor(context, spec, unit, unitReason, line.page_number, reconciliationNote),
  };
}

function formatThousands(value: number): string {
  return value.toLocaleString('en-AU');
}

/**
 * Parse the audited GPFS into validated, non-additive measure rows. Nothing is
 * emitted unless the printed unit is explicit and every face-statement, B1-1,
 * comprehensive-income and depreciation-note reconciliation check passes
 * exactly.
 */
export function parseLaneCoveGpfsExtraction(
  extraction: PdfExtraction,
  context: LaneCoveGpfsParseContext,
): LaneCoveGpfsParseResult {
  const warnings: string[] = [];
  const rejections: LaneCoveGpfsRejection[] = [];
  const reject = (reason: string): LaneCoveGpfsParseResult => {
    rejections.push({ section: 'gpfs', reason });
    warnings.push(reason);
    return { records: [], reconciliation: null, warnings, rejections };
  };

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Net operating result for the year attributable to Council'),
  );
  if (!incomePage) {
    return reject('audited income statement page not found; no rows ingested');
  }
  const functionsPage = findPage(extraction.pages, (_page, text) =>
    text.includes('Total functions and activities'),
  );
  if (!functionsPage) {
    return reject('B1-1 Total functions and activities note not found; no rows ingested');
  }
  const comprehensivePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Comprehensive Income') &&
      text.includes('from Income Statement') &&
      text.includes('Total comprehensive income for the year attributable to Council'),
  );
  if (!comprehensivePage) {
    return reject(
      'Statement of Comprehensive Income page not found; no independent printed net-result check',
    );
  }
  const depreciationPage = findPage(extraction.pages, (_page, text) =>
    text.includes(LANE_COVE_GPFS_DEPRECIATION_NOTE_LABEL),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: LaneCoveGpfsFunctionsTotals;
  let comprehensiveNetResult: number | null;
  let comprehensiveOther: number | null;
  let comprehensiveTotal: number | null;
  let depreciationImpairmentNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseLaneCoveGpfsFunctionsTotals(functionsPage);
    const comprehensiveRows = buildLaneCoveRows(comprehensivePage);
    comprehensiveNetResult =
      findLaneCoveLine(comprehensiveRows, LANE_COVE_GPFS_COMPREHENSIVE_NET_RESULT_LABEL)
        ?.numbers[0] ?? null;
    comprehensiveOther =
      findLaneCoveLine(comprehensiveRows, LANE_COVE_GPFS_OCI_LABEL)?.numbers[0] ?? null;
    comprehensiveTotal =
      findLaneCoveLine(comprehensiveRows, LANE_COVE_GPFS_COMPREHENSIVE_TOTAL_LABEL)?.numbers[0] ??
      null;
    if (depreciationPage) {
      const depreciationRows = buildLaneCoveRows(depreciationPage);
      depreciationImpairmentNoteTotal =
        findLaneCoveLine(depreciationRows, LANE_COVE_GPFS_DEPRECIATION_NOTE_LABEL)?.numbers[0] ??
        null;
    }
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error));
  }
  if (incomeUnit.kind !== functionsUnit.kind) {
    return reject(
      `printed units disagree: income statement ${incomeUnit.kind}, B1-1 ${functionsUnit.kind}; refusing to mix`,
    );
  }
  if (comprehensiveNetResult === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed comprehensive-income net result; no rows ingested`,
    );
  }
  if (comprehensiveOther === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed other comprehensive income; no rows ingested`,
    );
  }
  if (comprehensiveTotal === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed total comprehensive income; no rows ingested`,
    );
  }
  const unit = incomeUnit.kind;

  const incomeRows = buildLaneCoveRows(incomePage);
  const errors: string[] = [];
  const values: LaneCoveGpfsLineValue[] = [];
  for (const spec of LANE_COVE_GPFS_LINES) {
    if (spec.key === 'total_expenses') continue;
    const line = readLine(incomeRows, spec, incomePage.page_number, errors);
    if (line) values.push(line);
  }
  if (errors.length > 0) return reject(errors.join('; '));

  const totalRevenue = lineByKey(values, 'total_revenue');
  const employee = lineByKey(values, 'employee_expenses');
  const depreciation = lineByKey(values, 'depreciation_amortisation_impairment');
  const grantsOperating = lineByKey(values, 'government_grants_operating');
  const grantsCapital = lineByKey(values, 'government_grants_capital');
  const netShareJv = lineByKey(values, 'net_share_jv_revenue');
  const netLossDisposal = lineByKey(values, 'net_loss_from_disposal_of_assets');
  const netResult = lineByKey(values, 'net_result');
  const expensesExDepreciation = lineByKey(values, 'total_expenses_excluding_depreciation');
  const rates = lineByKey(values, 'rates_and_annual_charges');
  const userCharges = lineByKey(values, 'user_charges_and_fees');
  const otherRevenues = lineByKey(values, 'other_revenues');
  const interest = lineByKey(values, 'interest_and_investment_income');
  const otherIncome = lineByKey(values, 'other_income');
  const materials = lineByKey(values, 'materials_and_services');
  const otherExpenses = lineByKey(values, 'other_expenses');
  const operatingResultExcludingDepreciation =
    findLaneCoveLine(incomeRows, LANE_COVE_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL)
      ?.actual ?? null;
  const operatingResult =
    findLaneCoveLine(incomeRows, LANE_COVE_GPFS_OPERATING_RESULT_LABEL)?.actual ?? null;
  const netResultBeforeCapital =
    findLaneCoveLine(incomeRows, LANE_COVE_GPFS_BEFORE_CAPITAL_LABEL)?.actual ?? null;

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['net_share_jv_revenue', netShareJv],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['net_result', netResult],
    ['net_result_before_capital_grants', netResultBeforeCapital],
    ['operating_result', operatingResult],
    ['operating_result_excluding_depreciation', operatingResultExcludingDepreciation],
    ['total_expenses_excluding_depreciation', expensesExDepreciation],
    ['rates_and_annual_charges', rates],
    ['user_charges_and_fees', userCharges],
    ['other_revenues', otherRevenues],
    ['interest_and_investment_income', interest],
    ['other_income', otherIncome],
    ['materials_and_services', materials],
    ['other_expenses', otherExpenses],
  ];
  const missing = required.filter(([, value]) => value === null).map(([key]) => key);
  if (missing.length > 0) {
    return reject(`could not read printed line(s): ${missing.join(', ')}; no rows ingested`);
  }

  const revenueComponentsSum =
    rates! +
    userCharges! +
    otherRevenues! +
    grantsOperating! +
    grantsCapital! +
    interest! +
    otherIncome! +
    netShareJv!;
  const expenseComponentsSum = employee! + materials! + otherExpenses! + netLossDisposal!;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = functionsTotals.expenses;

  const totalExpensesLine: LaneCoveGpfsLineValue = {
    spec: LANE_COVE_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
    value: totalExpenses,
    page_number: functionsPage.page_number,
  };
  values.push(totalExpensesLine);

  const checks: string[] = [];
  const check = (label: string, expected: number, actual: number): void => {
    if (expected !== actual) {
      checks.push(`${label}: printed/derived ${actual} != expected ${expected}`);
    }
  };
  check(
    'income statement revenue components = printed total income',
    totalRevenue!,
    revenueComponentsSum,
  );
  check(
    'expense components = printed total expenses excluding depreciation',
    expensesExDepreciation!,
    expenseComponentsSum,
  );
  check(
    'printed total expenses excluding depreciation + printed depreciation = printed B1-1 total expenses',
    totalExpenses,
    faceExpenseBridge,
  );
  check(
    'printed total income - printed total expenses excluding depreciation = printed operating result excluding depreciation',
    operatingResultExcludingDepreciation!,
    totalRevenue! - expensesExDepreciation!,
  );
  check(
    'printed total income - printed B1-1 total expenses = printed operating result',
    operatingResult!,
    totalRevenue! - totalExpenses,
  );
  check('printed net result = printed operating result', netResult!, operatingResult!);
  check(
    'printed net result - capital grants = printed net result before capital grants',
    netResultBeforeCapital!,
    netResult! - grantsCapital!,
  );
  check(
    'B1-1 grants and contributions = operating grants + capital grants',
    grantsOperating! + grantsCapital!,
    functionsTotals.grants_and_contributions,
  );
  check('B1-1 income = face total income', totalRevenue!, functionsTotals.income);
  check('B1-1 expenses = face expense bridge', totalExpenses, faceExpenseBridge);
  check(
    'B1-1 operating result = face operating result',
    operatingResult!,
    functionsTotals.operating_result,
  );
  check(
    'B1-1 income - B1-1 expenses = B1-1 operating result',
    functionsTotals.operating_result,
    functionsTotals.income - functionsTotals.expenses,
  );
  check(
    'Statement of Comprehensive Income net result = Income Statement net result',
    netResult!,
    comprehensiveNetResult!,
  );
  check(
    'Statement of Comprehensive Income total = net result + other comprehensive income',
    comprehensiveTotal!,
    netResult! + comprehensiveOther!,
  );
  if (depreciationImpairmentNoteTotal !== null) {
    check(
      'note B3-3 total depreciation, amortisation and impairment = face depreciation/amortisation/impairment line',
      depreciation!,
      depreciationImpairmentNoteTotal,
    );
  } else {
    checks.push('note B3-3 total depreciation, amortisation and impairment was not read');
  }
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: LaneCoveGpfsReconciliation = {
    fiscal_year: LANE_COVE_GPFS_FISCAL_YEAR,
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
    net_share_jv_revenue: netShareJv!,
    net_loss_from_disposal_of_assets: netLossDisposal!,
    materials_and_services: materials!,
    other_expenses: otherExpenses!,
    net_result: netResult!,
    operating_result: operatingResult!,
    operating_result_excluding_depreciation: operatingResultExcludingDepreciation!,
    net_result_before_capital_grants: netResultBeforeCapital!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    functions_total_income: functionsTotals.income,
    functions_total_expenses: functionsTotals.expenses,
    functions_operating_result: functionsTotals.operating_result,
    functions_grants_and_contributions: functionsTotals.grants_and_contributions,
    comprehensive_income_net_result: comprehensiveNetResult!,
    comprehensive_income_other: comprehensiveOther!,
    comprehensive_income_total: comprehensiveTotal!,
    depreciation_impairment_note_total: depreciationImpairmentNoteTotal,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'printed revenue components sum exactly to the printed total income',
      'printed expense-by-nature components sum exactly to the printed expenses-excluding-depreciation line',
      'printed expenses excluding depreciation + printed depreciation/amortisation/impairment equals the printed B1-1 total expenses',
      'printed total income - printed expenses excluding depreciation equals the printed operating result excluding depreciation',
      'printed total income - printed B1-1 total expenses equals the printed operating result',
      'printed net result equals the printed operating result (no discontinued operations)',
      'printed net result - capital grants equals the printed before-capital result',
      'B1-1 income, expenses, operating result and grants reconcile exactly to the face statement',
      'B1-1 income - B1-1 expenses equals the printed B1-1 operating result',
      'Statement of Comprehensive Income net result equals the Income Statement net result',
      'Statement of Comprehensive Income total equals net result plus other comprehensive income',
      'note B3-3 total depreciation, amortisation and impairment equals the face depreciation/amortisation/impairment line',
      'the printed net result is positive and stored as a non-negative magnitude; the printed before-capital result and operating result excluding depreciation are reconciliation evidence only',
      'total expenses is the printed B1-1 Total functions and activities figure, never derived by summing components',
    ],
  };

  const reconciliationNote = `total expenses is the printed B1-1 Total functions and activities expense total (${formatThousands(totalExpenses)} thousand), which equals the printed face-statement bridge of expenses-excluding-depreciation (${formatThousands(expensesExDepreciation!)} thousand) plus printed depreciation/amortisation/impairment (${formatThousands(depreciation!)} thousand), and equals printed total income (${formatThousands(totalRevenue!)} thousand) less the printed operating result (${formatThousands(operatingResult!)} thousand); the B1-1 income, expenses, operating result and grants reconcile exactly to the face statement; the printed net share of joint-venture revenue (${formatThousands(netShareJv!)} thousand) is non-nil and included in the printed components; the printed net result (${formatThousands(netResult!)} thousand) equals the printed operating result and is repeated in the Statement of Comprehensive Income; the printed before-capital result (${formatThousands(netResultBeforeCapital!)} thousand) equals printed net result less printed capital grants (${formatThousands(grantsCapital!)} thousand) and is reconciliation evidence only (not emitted); note B3-3 prints total depreciation, amortisation and impairment for non-financial assets (${depreciationImpairmentNoteTotal === null ? 'not read' : formatThousands(depreciationImpairmentNoteTotal)} thousand), equal to the face line`;

  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed face-statement/B1-1 totals`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface LaneCoveGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: LaneCoveGpfsDocument;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched discovery inputs; the connector still selects the official link. */
  listingHtml?: string;
  documentLinkHtml?: string;
}

function documentFilename(_url: string): string {
  // The publisher's CMS name can change; use the stable archive name so a
  // re-download never creates a second copy.
  return 'lane-cove-council-annual-report-2024-25.pdf';
}

/** Build the live Lane Cove Council GPFS connector. */
export function createLaneCoveGpfsConnector(options: LaneCoveGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: LANE_COVE_GPFS_ID,
    name: LANE_COVE_GPFS_NAME,
    publisher: LANE_COVE_GPFS_PUBLISHER,
    source_url: LANE_COVE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LANE_COVE_GPFS_LICENSE,
    notes:
      "Thirty-first NSW council GPFS adapter: one council only (Lane Cove Council), audited FY2024-25 General Purpose Financial Statements published as Section 3 of the official Annual Report 2024-25 PDF linked from the council Community Strategic Plan page. The council's TRIM document link resolves through a JavaScript redirect; the connector discovers the document link from the page HTML (no hard-coded document URL), resolves the exact PDF URL, SHA-256 archives the exact bytes outside the repo, and parses only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities column, Statement of Comprehensive Income and note B3-3 reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverLaneCoveGpfsDocument(fetchImpl, LANE_COVE_GPFS_FISCAL_YEAR, {
          listingHtml: options.listingHtml,
          documentLinkHtml: options.documentLinkHtml,
        }));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(encodeURI(discovered.url), { redirect: 'follow' });
        if (!response.ok) {
          throw new Error(
            `Lane Cove Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: LaneCoveGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: LANE_COVE_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Lane Cove Council Annual Report for the year ended 30 June 2025 containing the audited FY2024-25 General Purpose Financial Statements; linked from the official Community Strategic Plan page and archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: LaneCoveGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: LANE_COVE_GPFS_REPORTING_URL,
      };
      const parsed = parseLaneCoveGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'lane-cove-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'lane-cove-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Lane Cove Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
