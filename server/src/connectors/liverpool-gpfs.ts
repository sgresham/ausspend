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
 * Twenty-ninth NSW council GPFS adapter: Liverpool City Council's audited
 * General Purpose Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Fairfield (§7.28) reference
 * implementations in docs/NSW_COUNCILS.md. It is a separate source id
 * (`liverpool-gpfs`) from every other source. Every row is non-additive
 * `agency_detail` with no region/LGA allocation, so it is never summed with the
 * Dubbo budget rows, any existing council GPFS source, the pre-existing
 * federal/state/charity rows whose `delivery_entity` mentions Liverpool, or any
 * other council.
 *
 * Liverpool's official Finance Reports page labels its statements by financial
 * year inside an HTML table header ("Financial Year 2024/2025") and lists the
 * audited PDF under the printed link text "Audited Financial Statement". The
 * connector discovers that link from the page HTML (never a hard-coded PDF URL).
 * The site is fronted by a Cloudflare managed challenge that returns HTTP 403 to
 * non-browser clients, so the documented headless Chromium path
 * (scripts/liverpool-gpfs-browser.ts) clears the challenge, saves the cleared
 * HTML and the exact PDF bytes, and the connector then discovers the link from
 * that HTML and re-verifies the bytes. The exact bytes are SHA-256 archived
 * outside the repo.
 *
 * The 124-page PDF (printed "Page x of 121") contains the signed General Purpose
 * Financial Statements — Income Statement PDF p18 / printed p16; Statement of
 * Comprehensive Income PDF p19 / printed p17; B1-1 "Total functions and
 * activities" PDF p29 / printed p27; note B3-4 depreciation PDF p44 / printed
 * p42 — and the independent auditor's reports, including the Report on the
 * Conduct of the Audit (PDF p107-108 / printed p105-106). The printed unit is an
 * explicit `$ '000`.
 *
 * Unlike Fairfield, the Liverpool text stream prints each row's label and
 * amounts on the same line, so the adapter groups text items by y and reads the
 * Actual 2025 column by x coordinate. It never sums a page's components to
 * obtain a printed total.
 *
 * The printed face-statement bridge is: expenses excluding
 * depreciation/amortisation/impairment ($224,352 thousand) plus depreciation,
 * amortisation and impairment ($55,138 thousand) = $279,490 thousand, which
 * equals printed total income ($380,226 thousand) less the printed operating
 * result ($100,736 thousand). The B1-1 "Total functions and activities" total
 * row prints the same income ($380,226), expenses ($279,490), operating result
 * ($100,736) and grants and contributions ($132,469 = operating $21,295 +
 * capital $111,174).
 *
 * Internal printed narrative check. The independent auditor's Report on the
 * Conduct of the Audit rounds the operating result to $100.7 million, grants and
 * contributions revenue to $132.5 million, Council revenue to $380.2 million,
 * depreciation to $55.1 million and the operating-expenses-excluding-
 * depreciation subtotal to $224.4 million; each agrees with the GPFS within the
 * printed one-decimal-million rounding tolerance, and the report prints no
 * numeric total-expenses figure. However, the report labels the $224.4 million
 * operating-expenses-excluding-depreciation subtotal "Other expenses", while
 * the Income Statement's own "Other expenses" line is $5,479 thousand. That is
 * a printed narrative label inconsistency (not a numeric total difference), and
 * the connector records it and adds `human_spot_check: required` to the affected
 * total-expenses/result notes rather than silently reconciling it. The printed
 * face statement, B1-1 and comprehensive-income totals themselves reconcile
 * exactly.
 */

export const LIVERPOOL_GPFS_ID = 'liverpool-gpfs';
export const LIVERPOOL_GPFS_NAME = 'Liverpool City Council — General Purpose Financial Statements';
export const LIVERPOOL_GPFS_PUBLISHER = 'Liverpool City Council';
export const LIVERPOOL_GPFS_REPORTING_URL =
  'https://www.liverpool.nsw.gov.au/council/corporate-information/finance-reports';
export const LIVERPOOL_GPFS_FISCAL_YEAR = '2024-25';
export const LIVERPOOL_GPFS_SOURCE_DATASET = 'Liverpool City Council GPFS 2024-25';
export const LIVERPOOL_GPFS_LICENSE =
  '© Liverpool City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const LIVERPOOL_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const LIVERPOOL_GPFS_DELIVERY_ENTITY = 'Liverpool City Council';

export interface LiverpoolGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The official Finance Reports page the PDF was found on. */
  listing_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface LiverpoolGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface LiverpoolGpfsParseContext {
  document: LiverpoolGpfsDocument;
  archive: LiverpoolGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface LiverpoolGpfsRejection {
  section: string;
  reason: string;
}

export type LiverpoolGpfsSection = 'revenue' | 'expenses' | 'result';

export interface LiverpoolGpfsLineSpec {
  key: string;
  label: string;
  section: LiverpoolGpfsSection;
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
 * B1-1 function split, and the nil 2025 "Net loss from the disposal of assets"
 * line is not emitted.
 */
export const LIVERPOOL_GPFS_LINES: ReadonlyArray<LiverpoolGpfsLineSpec> = [
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
    key: 'net_gain_from_disposal_of_assets',
    label: 'Net gain from the disposal of assets',
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
    key: 'borrowing_costs',
    label: 'Borrowing costs',
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
    key: 'total_expenses_excluding_depreciation',
    label:
      'Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'depreciation_amortisation_impairment',
    label: 'Depreciation, amortisation and impairment of non-financial assets',
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

export const LIVERPOOL_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL =
  'Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets';
export const LIVERPOOL_GPFS_OPERATING_RESULT_LABEL = 'Operating result from continuing operations';
export const LIVERPOOL_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';
export const LIVERPOOL_GPFS_COMPREHENSIVE_NET_RESULT_LABEL =
  'Net operating result for the year from Income Statement';
export const LIVERPOOL_GPFS_OCI_LABEL = 'Total other comprehensive income for the year';
export const LIVERPOOL_GPFS_COMPREHENSIVE_TOTAL_LABEL =
  'Total comprehensive income for the year attributable to Council';
export const LIVERPOOL_GPFS_DEPRECIATION_NOTE_LABEL =
  'Total depreciation, amortisation and impairment for non-financial assets';

/** A printed rounding tolerance of half a $0.1 million step. */
const NARRATIVE_ROUNDING_TOLERANCE_THOUSANDS = 50;

interface LiverpoolGpfsLineValue {
  spec: LiverpoolGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface LiverpoolGpfsConductReport {
  page_number: number;
  operating_result_millions: number | null;
  grants_and_contributions_millions: number | null;
  revenue_millions: number | null;
  depreciation_millions: number | null;
  /** The narrative's "Other expenses" millions; numerically the ex-depreciation subtotal. */
  expenses_excluding_depreciation_millions: number | null;
  net_result_before_capital_millions: number | null;
  /** Only present when the narrative prints an explicit total-expenses figure. */
  total_expenses_millions: number | null;
  /** Printed variance percentages in table row order, when readable. */
  variance_percentages: number[];
  /** Printed label/numeric inconsistencies, retained for a human. */
  label_discrepancies: string[];
}

export interface LiverpoolGpfsReconciliation {
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
  borrowing_costs: number;
  net_gain_from_disposal_of_assets: number;
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
  /** Auditor's Report on the Conduct of the Audit narrative figures. */
  conduct_report: LiverpoolGpfsConductReport | null;
  /** Narrative total-expenses difference in thousands, if a total was printed. */
  conduct_report_total_expenses_discrepancy_thousands: number | null;
  /** Any narrative figure that differs by more than the rounding tolerance. */
  conduct_report_narrative_discrepancies: string[];
  /** True when a printed label/numeric inconsistency was found in the narrative. */
  human_spot_check_required: boolean;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface LiverpoolGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: LiverpoolGpfsReconciliation | null;
  warnings: string[];
  rejections: LiverpoolGpfsRejection[];
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
 * Convert a Liverpool financial-statements link/table-year text to a fiscal
 * year. The Finance Reports page heads the current table "Financial Year
 * 2024/2025"; the document filename uses "2025". Consecutive year ranges,
 * "2024/25" and June year-ends are handled. Anything that is not a consecutive
 * year pair is rejected.
 */
export function fiscalYearFromLiverpoolGpfsLink(text: string): string | null {
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

  const julyJune =
    /(?:^|\D)1\s+(?:july|jul)\s+((?:19|20)\d{2})\s*(?:-|–|—|to)\s*(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
      whitespaceCollapsed,
    );
  if (julyJune) {
    const start = Number(julyJune[1]);
    const end = Number(julyJune[2]);
    if (end !== start + 1) return null;
    return `${start}-${String(end).slice(-2)}`;
  }

  const june = /year\s+(?:ending|ended)\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
    collapsed,
  );
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }

  // "Financial Year 2024/2025", "2024-2025 Financial Statements", "2024/25".
  const consecutive = /((?:19|20)\d{2})\s*[-/]\s*((?:19|20)?\d{2})/.exec(compact);
  if (consecutive) {
    const start = Number(consecutive[1]);
    const endRaw = consecutive[2]!;
    const end =
      endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
    if (end === start + 1) return `${start}-${String(end).slice(-2)}`;
  }

  // A bare statement end year in a filename (e.g. "Annual-Financial-Statements-2025").
  const bare = /(?:^|\D)((?:19|20)\d{2})(?:\D|$)/.exec(collapsed);
  if (bare) {
    const end = Number(bare[1]);
    // Reject a bare year unless it is a plausible statement end year (2010-2035).
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

export interface LiverpoolGpfsReportPage {
  pdfUrl: string;
  title: string;
}

/**
 * Liverpool's own official site is the only host accepted for the financial
 * statements PDF. Any other host is rejected even if the anchor text matches.
 */
function isLiverpoolDocumentHost(hostname: string): boolean {
  return /(^|\.)liverpool\.nsw\.gov\.au$/i.test(hostname);
}

function normalizeYearLabel(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Discover the audited FY2024-25 financial statements from the official Finance
 * Reports page. Liverpool labels each financial year in a table header
 * ("Financial Year 2024/2025") and prints the link text "Audited Financial
 * Statement". The link is parsed from the page HTML, never guessed. Anchors
 * outside the matching financial-year table (for example the prior years under
 * "Previous Audited Financial statements") are ignored.
 */
export function parseLiverpoolGpfsReportPage(
  html: string,
  baseUrl: string,
  fiscalYear: string = LIVERPOOL_GPFS_FISCAL_YEAR,
): LiverpoolGpfsReportPage | null {
  const startYear = Number(fiscalYear.slice(0, 4));
  const endYear = startYear + 1;
  if (!Number.isFinite(startYear)) return null;
  const wanted = [
    `Financial Year ${startYear}/${endYear}`,
    `Financial Year ${startYear}-${endYear}`,
  ];
  const tables = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tables.exec(html)) !== null) {
    const body = tableMatch[1]!;
    const th = /<th\b[^>]*>([\s\S]*?)<\/th>/i.exec(body);
    if (!th) continue;
    const heading = normalizeYearLabel(decodeHtml(th[1]!));
    if (!wanted.some((label) => heading === label)) continue;
    for (const anchor of anchors(body)) {
      if (!/audited\s+financial\s+statements?/i.test(anchor.text)) continue;
      if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
      let url: URL;
      try {
        url = new URL(anchor.href, baseUrl);
      } catch {
        continue;
      }
      if (!isLiverpoolDocumentHost(url.hostname)) continue;
      return {
        pdfUrl: url.toString(),
        title: 'Liverpool City Council Audited Financial Statements 2024-25',
      };
    }
  }
  return null;
}

export interface LiverpoolGpfsDiscoveryOverrides {
  listingHtml?: string;
}

/** Discover the audited GPFS document from the official page HTML. */
export async function discoverLiverpoolGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = LIVERPOOL_GPFS_FISCAL_YEAR,
  overrides: LiverpoolGpfsDiscoveryOverrides = {},
): Promise<LiverpoolGpfsDocument> {
  let listingHtml = overrides.listingHtml;
  let listingUrl = LIVERPOOL_GPFS_REPORTING_URL;
  if (listingHtml === undefined) {
    const response = await fetchImpl(LIVERPOOL_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Liverpool Finance Reports listing fetch HTTP ${response.status} for ${LIVERPOOL_GPFS_REPORTING_URL}; the site enforces a Cloudflare managed challenge — use the documented headless Chromium path (scripts/liverpool-gpfs-browser.ts)`,
      );
    }
    listingHtml = await response.text();
    listingUrl = response.url || listingUrl;
  }
  const page = parseLiverpoolGpfsReportPage(listingHtml, listingUrl, fiscalYear);
  if (!page) {
    throw new Error(
      `Liverpool FY${fiscalYear} Finance Reports listing has no official Audited Financial Statement PDF link under the matching financial-year table; refusing to guess a document URL`,
    );
  }
  return {
    id: `gpfs-${fiscalYear}`,
    title: page.title,
    url: page.pdfUrl,
    fiscal_year: fiscalYear,
    listing_url: listingUrl,
  };
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectLiverpoolGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectLiverpoolGpfsUnit([page.text]);
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
 * Reconstruct printed rows from PDF text-item coordinates. Liverpool prints a
 * row's label and its three amounts on the same printed line, so grouping by y
 * and sorting by x recovers the printed table. The Actual 2025 column is
 * isolated by its x band (the note column sits left of it, the prior-year column
 * right of it).
 */
export function buildLiverpoolRows(page: PdfPage): PrintedRow[] {
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
export function findLiverpoolLine(
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
  spec: LiverpoolGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): LiverpoolGpfsLineValue | null {
  const found = findLiverpoolLine(rows, spec.label, spec.last_occurrence ?? false);
  if (!found) {
    errors.push(`p${pageNumber}: could not read printed row for "${spec.label}"`);
    return null;
  }
  return { spec, value: found.actual, page_number: pageNumber };
}

function lineByKey(values: readonly LiverpoolGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface LiverpoolGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse the B1-1 "Total functions and activities" total row. Liverpool prints
 * the total row as a normal table line: the label sits at x=50 and the ten
 * amounts (five column pairs) share its y coordinate. We collect the money
 * items in the label's y band, sort them by x and read the FY2024-25 values at
 * indices 0, 2, 4 and 6 (income, expenses, operating result, grants). We never
 * sum the function rows.
 */
export function parseLiverpoolGpfsFunctionsTotals(page: PdfPage): LiverpoolGpfsFunctionsTotals {
  const label = page.items.find((item) => item.str.trim() === 'Total functions and activities');
  if (!label) {
    throw new Error(`p${page.page_number}: B1-1 Total functions and activities label not found`);
  }
  const values = page.items
    .filter((item) => Math.abs(item.y - label.y) <= 3 && isMoneyToken(item.str))
    .sort((a, b) => a.x - b.x)
    .map((item) => parseAmountCell(item.str).value)
    .filter((value): value is number => value !== null);
  if (values.length < 8) {
    throw new Error(
      `p${page.page_number}: B1-1 Total functions and activities row has ${values.length} numeric values, expected at least 8`,
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

/**
 * Capture the independent auditor's Report on the Conduct of the Audit narrative
 * figures. Liverpool prints rounded millions for the operating result, grants,
 * Council revenue, depreciation and the operating-expenses-excluding-
 * depreciation subtotal; it does not print a narrative total-expenses figure.
 * Each captured value is retained as evidence so a printed narrative difference
 * can be surfaced for a human rather than silently ignored.
 */
export function parseLiverpoolGpfsConductReport(
  pages: readonly PdfPage[],
): LiverpoolGpfsConductReport | null {
  const page = pages.find((candidate) => {
    const text = normalizeText(candidate.text);
    return (
      text.includes('INCOME STATEMENT') &&
      text.includes('Financial performance') &&
      text.includes('Operating result from continuing operations')
    );
  });
  if (!page) return null;
  const text = normalizeText(page.text);
  const number = (pattern: RegExp): number | null => {
    const match = pattern.exec(text);
    if (!match) return null;
    const value = Number(match[1]!.replace(/,/g, ''));
    return Number.isFinite(value) ? value : null;
  };
  const operating = number(/Operating result from continuing operations\s+([\d.,]+)\s+[\d.,]+/i);
  const grants = number(/Grants and contributions revenue\s+([\d.,]+)\s+[\d.,]+/i);
  const revenue = number(/Council revenue\s*\(\s*\$?\s*([\d.,]+)\s*million\s*\)/i);
  const depreciation = number(
    /Depreciation, amortisation and impairment of non-financial assets expense\s*\(\s*\$?\s*([\d.,]+)\s*million\s*\)/i,
  );
  const otherExpenses = number(/Other expenses\s*\(\s*\$?\s*([\d.,]+)\s*million\s*\)/i);
  const beforeCapital = number(
    /net operating result for the year before grants and contributions provided for capital purposes was\s*\(\s*\$?\s*([\d.,]+)\s*million\s*\)/i,
  );
  const totalExpenses = number(
    /total expenses from continuing operations including depreciation[^()]*\(\s*\$?\s*([\d.,]+)\s*million\s*\)/i,
  );
  // The variance column sits to the right of the two $m columns; collecting the
  // percentages in printed row order lets us retain the auditor's own numbers.
  const variance_percentages = page.items
    .filter((item) => item.x >= 470 && item.x <= 520 && /^\d+(?:\.\d+)?$/.test(item.str.trim()))
    .sort((a, b) => b.y - a.y)
    .map((item) => Number(item.str.trim()))
    .filter((value) => Number.isFinite(value));
  const label_discrepancies: string[] = [];
  if (otherExpenses !== null) {
    label_discrepancies.push(
      `the Report on the Conduct of the Audit labels the $${otherExpenses.toFixed(1)} million operating-expenses-excluding-depreciation subtotal "Other expenses", while the Income Statement's Other expenses line is $5,479 thousand; the $${otherExpenses.toFixed(1)} million figure equals the printed expenses-excluding-depreciation subtotal (not total expenses)`,
    );
  }
  return {
    page_number: page.page_number,
    operating_result_millions: operating,
    grants_and_contributions_millions: grants,
    revenue_millions: revenue,
    depreciation_millions: depreciation,
    expenses_excluding_depreciation_millions: otherExpenses,
    net_result_before_capital_millions: beforeCapital === null ? null : -Math.abs(beforeCapital),
    total_expenses_millions: totalExpenses,
    variance_percentages,
    label_discrepancies,
  };
}

function gpfsFundingSource(spec: LiverpoolGpfsLineSpec): string {
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
  context: LiverpoolGpfsParseContext,
  spec: LiverpoolGpfsLineSpec,
  unit: MoneyUnitKind,
  unitReason: string,
  pageNumber: number,
  reconciliationNote: string,
  spotCheckNote: string | null,
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
    spotCheckNote,
    'the audited General Purpose Financial Statements for the year ended 30 June 2025 are published in the official Liverpool City Council audited financial statements PDF linked from the Finance Reports page; the independent auditor’s reports on the financial statements are included in the same PDF; provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + document + line + fiscal year. */
export function liverpoolGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = LIVERPOOL_GPFS_FISCAL_YEAR,
): string {
  return `${LIVERPOOL_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: LiverpoolGpfsLineValue,
  context: LiverpoolGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
  spotCheckNote: string | null,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: LIVERPOOL_GPFS_FISCAL_YEAR,
    source_id: LIVERPOOL_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: liverpoolGpfsNaturalKey(
      context.document.url,
      spec.key,
      LIVERPOOL_GPFS_FISCAL_YEAR,
    ),
    project_name: `Liverpool City Council GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: LIVERPOOL_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: LIVERPOOL_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: LIVERPOOL_GPFS_DATA_QUALITY_FLAG,
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
    notes: notesFor(
      context,
      spec,
      unit,
      unitReason,
      line.page_number,
      reconciliationNote,
      spotCheckNote,
    ),
  };
}

function formatThousands(value: number): string {
  return value.toLocaleString('en-AU');
}

function narrativeDiscrepancy(
  label: string,
  narrativeMillions: number,
  printedThousands: number,
): string | null {
  const narrativeThousands = Math.round(narrativeMillions * 1000);
  const difference = narrativeThousands - printedThousands;
  if (Math.abs(difference) <= NARRATIVE_ROUNDING_TOLERANCE_THOUSANDS) return null;
  const sign = difference > 0 ? '+' : '';
  return `${label}: narrative $${narrativeMillions.toFixed(1)} million vs printed $${formatThousands(printedThousands)} thousand (${sign}${formatThousands(difference)} thousand)`;
}

/**
 * Parse the audited GPFS into validated, non-additive measure rows. Nothing is
 * emitted unless the printed unit is explicit and every face-statement, B1-1,
 * comprehensive-income and depreciation-note reconciliation check passes
 * exactly. A printed narrative discrepancy is retained as evidence and flagged
 * for a human, never silently reconciled.
 */
export function parseLiverpoolGpfsExtraction(
  extraction: PdfExtraction,
  context: LiverpoolGpfsParseContext,
): LiverpoolGpfsParseResult {
  const warnings: string[] = [];
  const rejections: LiverpoolGpfsRejection[] = [];
  const reject = (reason: string): LiverpoolGpfsParseResult => {
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
  const functionsPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Total functions and activities') && text.includes('Functions or activities'),
  );
  if (!functionsPage) {
    return reject('B1-1 Total functions and activities page not found; no rows ingested');
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
    text.includes(LIVERPOOL_GPFS_DEPRECIATION_NOTE_LABEL),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: LiverpoolGpfsFunctionsTotals;
  let comprehensiveNetResult: number | null;
  let comprehensiveOther: number | null;
  let comprehensiveTotal: number | null;
  let depreciationImpairmentNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseLiverpoolGpfsFunctionsTotals(functionsPage);
    const comprehensiveRows = buildLiverpoolRows(comprehensivePage);
    comprehensiveNetResult =
      findLiverpoolLine(comprehensiveRows, LIVERPOOL_GPFS_COMPREHENSIVE_NET_RESULT_LABEL)
        ?.numbers[0] ?? null;
    comprehensiveOther =
      findLiverpoolLine(comprehensiveRows, LIVERPOOL_GPFS_OCI_LABEL)?.numbers[0] ?? null;
    comprehensiveTotal =
      findLiverpoolLine(comprehensiveRows, LIVERPOOL_GPFS_COMPREHENSIVE_TOTAL_LABEL)?.numbers[0] ??
      null;
    if (depreciationPage) {
      const depreciationRows = buildLiverpoolRows(depreciationPage);
      depreciationImpairmentNoteTotal =
        findLiverpoolLine(depreciationRows, LIVERPOOL_GPFS_DEPRECIATION_NOTE_LABEL)?.numbers[0] ??
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

  const incomeRows = buildLiverpoolRows(incomePage);
  const errors: string[] = [];
  const values: LiverpoolGpfsLineValue[] = [];
  for (const spec of LIVERPOOL_GPFS_LINES) {
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
  const borrowingCosts = lineByKey(values, 'borrowing_costs');
  const netGainDisposal = lineByKey(values, 'net_gain_from_disposal_of_assets');
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
    findLiverpoolLine(incomeRows, LIVERPOOL_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL)
      ?.actual ?? null;
  const operatingResult =
    findLiverpoolLine(incomeRows, LIVERPOOL_GPFS_OPERATING_RESULT_LABEL)?.actual ?? null;
  const netResultBeforeCapital =
    findLiverpoolLine(incomeRows, LIVERPOOL_GPFS_BEFORE_CAPITAL_LABEL)?.actual ?? null;

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['borrowing_costs', borrowingCosts],
    ['net_gain_from_disposal_of_assets', netGainDisposal],
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
    netGainDisposal!;
  const expenseComponentsSum = employee! + materials! + borrowingCosts! + otherExpenses!;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = functionsTotals.expenses;

  const totalExpensesLine: LiverpoolGpfsLineValue = {
    spec: LIVERPOOL_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
    value: totalExpenses,
    page_number: functionsPage.page_number,
  };
  values.push(totalExpensesLine);

  const conductReport = parseLiverpoolGpfsConductReport(extraction.pages);
  const narrativeDiscrepancies: string[] = [];
  if (conductReport) {
    const add = (discrepancy: string | null): void => {
      if (discrepancy) narrativeDiscrepancies.push(discrepancy);
    };
    if (conductReport.operating_result_millions !== null) {
      add(
        narrativeDiscrepancy(
          'operating result narrative',
          conductReport.operating_result_millions,
          netResult!,
        ),
      );
    }
    if (conductReport.grants_and_contributions_millions !== null) {
      add(
        narrativeDiscrepancy(
          'grants and contributions narrative',
          conductReport.grants_and_contributions_millions,
          grantsOperating! + grantsCapital!,
        ),
      );
    }
    if (conductReport.revenue_millions !== null) {
      add(narrativeDiscrepancy('revenue narrative', conductReport.revenue_millions, totalRevenue!));
    }
    if (conductReport.depreciation_millions !== null) {
      add(
        narrativeDiscrepancy(
          'depreciation narrative',
          conductReport.depreciation_millions,
          depreciation!,
        ),
      );
    }
    if (conductReport.expenses_excluding_depreciation_millions !== null) {
      add(
        narrativeDiscrepancy(
          'operating expenses excluding depreciation narrative',
          conductReport.expenses_excluding_depreciation_millions,
          expensesExDepreciation!,
        ),
      );
    }
    if (conductReport.net_result_before_capital_millions !== null) {
      add(
        narrativeDiscrepancy(
          'before-capital result narrative',
          conductReport.net_result_before_capital_millions,
          netResultBeforeCapital!,
        ),
      );
    }
    if (conductReport.total_expenses_millions !== null) {
      add(
        narrativeDiscrepancy(
          'total expenses narrative',
          conductReport.total_expenses_millions,
          totalExpenses,
        ),
      );
    }
  }
  let conductReportTotalExpensesDiscrepancy: number | null = null;
  if (conductReport && conductReport.total_expenses_millions !== null) {
    const narrativeThousands = Math.round(conductReport.total_expenses_millions * 1000);
    if (narrativeThousands !== totalExpenses) {
      conductReportTotalExpensesDiscrepancy = narrativeThousands - totalExpenses;
    }
  }

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
      'note B3-4 total depreciation, amortisation and impairment = face depreciation/amortisation/impairment line',
      depreciation!,
      depreciationImpairmentNoteTotal,
    );
  } else {
    checks.push('note B3-4 total depreciation, amortisation and impairment was not read');
  }
  // A printed narrative difference beyond rounding is retained as evidence and
  // flagged for a human spot check, never used to reject the exact printed
  // face/B1-1/comprehensive reconciliation.
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const labelDiscrepancies = conductReport?.label_discrepancies ?? [];
  const humanSpotCheckRequired = narrativeDiscrepancies.length > 0 || labelDiscrepancies.length > 0;

  const reconciliation: LiverpoolGpfsReconciliation = {
    fiscal_year: LIVERPOOL_GPFS_FISCAL_YEAR,
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
    borrowing_costs: borrowingCosts!,
    net_gain_from_disposal_of_assets: netGainDisposal!,
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
    conduct_report: conductReport,
    conduct_report_total_expenses_discrepancy_thousands: conductReportTotalExpensesDiscrepancy,
    conduct_report_narrative_discrepancies: narrativeDiscrepancies,
    human_spot_check_required: humanSpotCheckRequired,
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
      'note B3-4 total depreciation, amortisation and impairment equals the face depreciation/amortisation/impairment line',
      'the printed net result is positive and stored as a non-negative magnitude; the printed before-capital result and operating result excluding depreciation are reconciliation evidence only',
      conductReport
        ? humanSpotCheckRequired
          ? `the independent auditor's Report on the Conduct of the Audit (p${conductReport.page_number}) prints narrative figures that agree numerically with the GPFS within the one-decimal-million rounding tolerance and prints no numeric total-expenses figure, but contains internal printed label/percentage inconsistencies retained for a human spot check: ${[...narrativeDiscrepancies, ...labelDiscrepancies].join('; ')}`
          : `the independent auditor's Report on the Conduct of the Audit (p${conductReport.page_number}) rounded narrative figures agree with the GPFS within the printed one-decimal-million rounding tolerance; the report prints no narrative total-expenses figure and no internal printed discrepancy was found`
        : 'the independent auditor’s Report on the Conduct of the Audit narrative was not found; no narrative difference is recorded',
    ],
  };

  const reconciliationNote =
    `total expenses is the printed B1-1 Total functions and activities expense total (${formatThousands(totalExpenses)} thousand), which equals the printed face-statement bridge of expenses-excluding-depreciation (${formatThousands(expensesExDepreciation!)} thousand) plus printed depreciation/amortisation/impairment (${formatThousands(depreciation!)} thousand), and equals printed total income (${formatThousands(totalRevenue!)} thousand) less the printed operating result (${formatThousands(operatingResult!)} thousand); the B1-1 income, expenses, operating result and grants reconcile exactly to the face statement (no face-vs-B1-1 discrepancy); the printed borrowing-costs line (${formatThousands(borrowingCosts!)} thousand) and the printed net gain from the disposal of assets (${formatThousands(netGainDisposal!)} thousand) are non-nil and are included in the printed components; the printed net result (${formatThousands(netResult!)} thousand) equals the printed operating result and is repeated in the Statement of Comprehensive Income; the printed before-capital result (${formatThousands(netResultBeforeCapital!)} thousand) equals printed net result less printed capital grants (${formatThousands(grantsCapital!)} thousand) and is reconciliation evidence only (not emitted); note B3-4 prints total depreciation, amortisation and impairment for non-financial assets (${depreciationImpairmentNoteTotal === null ? 'not read' : formatThousands(depreciationImpairmentNoteTotal)} thousand), equal to the face line` +
    (conductReport
      ? humanSpotCheckRequired
        ? `; the independent auditor's Report on the Conduct of the Audit prints rounded operating result $${conductReport.operating_result_millions?.toFixed(1) ?? 'not read'} million, grants and contributions $${conductReport.grants_and_contributions_millions?.toFixed(1) ?? 'not read'} million, Council revenue $${conductReport.revenue_millions?.toFixed(1) ?? 'not read'} million, depreciation $${conductReport.depreciation_millions?.toFixed(1) ?? 'not read'} million and an operating-expenses-excluding-depreciation subtotal of $${conductReport.expenses_excluding_depreciation_millions?.toFixed(1) ?? 'not read'} million, all consistent with the GPFS within printed rounding; however the report contains internal printed inconsistencies retained for a human spot check: ${[...narrativeDiscrepancies, ...labelDiscrepancies].join('; ')}`
        : `; the independent auditor's Report on the Conduct of the Audit prints rounded operating result $${conductReport.operating_result_millions?.toFixed(1) ?? 'not read'} million, grants and contributions $${conductReport.grants_and_contributions_millions?.toFixed(1) ?? 'not read'} million, Council revenue $${conductReport.revenue_millions?.toFixed(1) ?? 'not read'} million, depreciation $${conductReport.depreciation_millions?.toFixed(1) ?? 'not read'} million and an operating-expenses-excluding-depreciation subtotal of $${conductReport.expenses_excluding_depreciation_millions?.toFixed(1) ?? 'not read'} million, all consistent with the GPFS within printed rounding and with no internal printed discrepancy`
      : '; the independent auditor’s Report on the Conduct of the Audit narrative was not found');

  const spotCheckNote = humanSpotCheckRequired
    ? `human_spot_check: required — the audited face statement, B1-1 and Statement of Comprehensive Income totals reconcile exactly (total expenses ${formatThousands(totalExpenses)} thousand; net result ${formatThousands(netResult!)} thousand), but the independent auditor's Report on the Conduct of the Audit contains internal printed inconsistencies: ${[...narrativeDiscrepancies, ...labelDiscrepancies].join('; ')}; a human must confirm how the narrative presentation should be read before the affected total is treated as final`
    : null;

  const records = values.map((line) =>
    mapLine(
      line,
      context,
      unit,
      incomeUnit.reason,
      reconciliationNote,
      line.spec.key === 'total_expenses' ||
        line.spec.key === 'total_expenses_excluding_depreciation' ||
        line.spec.key === 'net_result'
        ? spotCheckNote
        : null,
    ),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed face-statement/B1-1 totals` +
      (humanSpotCheckRequired
        ? `; auditor narrative internal printed inconsistencies retained for human spot-check (${[...narrativeDiscrepancies, ...labelDiscrepancies].join('; ')})`
        : conductReport
          ? '; auditor narrative figures agree within printed rounding and print no total-expenses figure'
          : ''),
  );
  return { records, reconciliation, warnings, rejections };
}

export interface LiverpoolGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: LiverpoolGpfsDocument;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched discovery input; the connector still selects the official link. */
  listingHtml?: string;
}

function documentFilename(_url: string): string {
  // The publisher's CMS name can change; use the stable archive name so a
  // re-download never creates a second copy.
  return 'liverpool-city-council-audited-financial-statements-2024-25.pdf';
}

/** Build the live Liverpool City Council GPFS connector. */
export function createLiverpoolGpfsConnector(
  options: LiverpoolGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: LIVERPOOL_GPFS_ID,
    name: LIVERPOOL_GPFS_NAME,
    publisher: LIVERPOOL_GPFS_PUBLISHER,
    source_url: LIVERPOOL_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: LIVERPOOL_GPFS_LICENSE,
    notes:
      "Twenty-ninth NSW council GPFS adapter: one council only (Liverpool City Council), audited FY2024-25 General Purpose Financial Statements published in the official audited financial statements PDF linked from the council's Finance Reports page. The site enforces a Cloudflare managed challenge, so the documented headless Chromium path clears it; the connector discovers the PDF from the cleared HTML (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-4 reconcile exactly. The auditor's Report on the Conduct of the Audit narrative is checked for printed differences; its internal label/percentage inconsistencies are retained and flagged for a human spot check, never silently reconciled. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverLiverpoolGpfsDocument(fetchImpl, LIVERPOOL_GPFS_FISCAL_YEAR, {
          listingHtml: options.listingHtml,
        }));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, { redirect: 'follow' });
        if (!response.ok) {
          throw new Error(
            `Liverpool City Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: LiverpoolGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: LIVERPOOL_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Liverpool City Council audited financial statements for the year ended 30 June 2025 containing the audited FY2024-25 General Purpose Financial Statements; linked from the official Finance Reports page and archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: LiverpoolGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: LIVERPOOL_GPFS_REPORTING_URL,
      };
      const parsed = parseLiverpoolGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'liverpool-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'liverpool-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Liverpool City Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
