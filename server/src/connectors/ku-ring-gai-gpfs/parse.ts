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
 * Thirtieth NSW council GPFS adapter: Ku-ring-gai Council's audited General
 * Purpose Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Ku-ring-gai's predecessor Liverpool
 * (§7.29) reference implementations in docs/NSW_COUNCILS.md. It is a separate
 * source id (`ku-ring-gai-gpfs`) from every other source. Every row is
 * non-additive `agency_detail` with no region/LGA allocation, so it is never
 * summed with the Dubbo budget rows, any existing council GPFS source, the
 * pre-existing federal/state/charity rows whose `delivery_entity` mentions
 * Ku-ring-gai, or any other council.
 *
 * Ku-ring-gai's official Finance page lists each year's audited statements under
 * the printed link text "Financial statements 2024-2025(PDF, 2MB)". The connector
 * discovers that link from the page HTML (never a hard-coded PDF URL). The site
 * returns HTTP 403 to non-browser clients, so the documented headless Chromium
 * path (scripts/ku-ring-gai-gpfs-browser.ts) loads the official page, saves the
 * cleared HTML and downloads the exact PDF bytes; the connector then discovers
 * the link from that HTML and re-verifies the bytes. The exact bytes are SHA-256
 * archived outside the repo.
 *
 * The 98-page PDF (printed "Page x of 76") contains the signed General Purpose
 * Financial Statements — Income Statement PDF p7 / printed p5; Statement of
 * Comprehensive Income PDF p8 / printed p6; B1-1 "Total functions and
 * activities" PDF p16 / printed p14; note B3-4 depreciation PDF p27 / printed
 * p25 — and the independent auditor's reports, including the Report on the
 * Conduct of the Audit (PDF p71-72 / printed p69-70). The printed unit is an
 * explicit `$ '000`.
 *
 * The text stream prints each row's label and amounts on the same line (the
 * Original unaudited budget column sits left of the label, the FY2024-25 Actual
 * and FY2023-24 Actual columns to its right), so the adapter groups text items
 * by y and reads the Actual 2025 column by x coordinate. It never sums a page's
 * components to obtain a printed total.
 *
 * The printed face-statement bridge is: expenses excluding
 * depreciation/amortisation/impairment ($133,541 thousand) plus depreciation,
 * amortisation and impairment ($27,062 thousand) = $160,603 thousand, which
 * equals printed total income ($182,600 thousand) less the printed operating
 * result ($21,997 thousand). The B1-1 "Total functions and activities" total
 * row prints the same income ($182,600), expenses ($160,603), operating result
 * ($21,997) and grants and contributions ($26,502 = operating $8,459 + capital
 * $18,043).
 *
 * Internal printed narrative discrepancy. The independent auditor's Report on
 * the Conduct of the Audit prints a one-decimal-million table in which the 2025
 * operating result is `21.9`, while its own narrative says the result was
 * `$0.31 million higher` than the 2023–24 `21.7` (implying `22.0`), the graph on
 * the same page prints `21.99`, and the GPFS prints `21,997` thousand.
 * Similarly the operating-grants line is printed `8.4` while the GPFS prints
 * `8,459` thousand (which rounds to `8.5`). These are internal printed
 * truncation/rounding discrepancies in the narrative, not differences in the
 * audited face statement, B1-1, comprehensive-income or note B3-4 totals, which
 * reconcile exactly. The connector retains them and adds
 * `human_spot_check: required` to the affected total-expenses/result notes
 * rather than silently reconciling them.
 */

export const KU_RING_GAI_GPFS_ID = 'ku-ring-gai-gpfs';
export const KU_RING_GAI_GPFS_NAME = 'Ku-ring-gai Council — General Purpose Financial Statements';
export const KU_RING_GAI_GPFS_PUBLISHER = 'Ku-ring-gai Council';
export const KU_RING_GAI_GPFS_REPORTING_URL =
  'https://www.krg.nsw.gov.au/Council/Strategic-plans-finance-reports-and-publications/Finance';
export const KU_RING_GAI_GPFS_FISCAL_YEAR = '2024-25';
export const KU_RING_GAI_GPFS_SOURCE_DATASET = 'Ku-ring-gai Council GPFS 2024-25';
export const KU_RING_GAI_GPFS_LICENSE =
  '© Ku-ring-gai Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const KU_RING_GAI_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const KU_RING_GAI_GPFS_DELIVERY_ENTITY = 'Ku-ring-gai Council';

export interface KuRingGaiGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The official Finance Reports page the PDF was found on. */
  listing_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface KuRingGaiGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface KuRingGaiGpfsParseContext {
  document: KuRingGaiGpfsDocument;
  archive: KuRingGaiGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface KuRingGaiGpfsRejection {
  section: string;
  reason: string;
}

export type KuRingGaiGpfsSection = 'revenue' | 'expenses' | 'result';

export interface KuRingGaiGpfsLineSpec {
  key: string;
  label: string;
  section: KuRingGaiGpfsSection;
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
export const KU_RING_GAI_GPFS_LINES: ReadonlyArray<KuRingGaiGpfsLineSpec> = [
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

export const KU_RING_GAI_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL =
  'Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets';
export const KU_RING_GAI_GPFS_OPERATING_RESULT_LABEL =
  'Operating result from continuing operations';
export const KU_RING_GAI_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';
export const KU_RING_GAI_GPFS_COMPREHENSIVE_NET_RESULT_LABEL =
  'Net operating result for the year from Income Statement';
export const KU_RING_GAI_GPFS_OCI_LABEL = 'Total other comprehensive income for the year';
export const KU_RING_GAI_GPFS_COMPREHENSIVE_TOTAL_LABEL =
  'Total comprehensive income for the year attributable to Council';
export const KU_RING_GAI_GPFS_DEPRECIATION_NOTE_LABEL =
  'Total depreciation, amortisation and impairment costs expensed';

/** A printed rounding tolerance of half a $0.1 million step. */
const NARRATIVE_ROUNDING_TOLERANCE_THOUSANDS = 50;

interface KuRingGaiGpfsLineValue {
  spec: KuRingGaiGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface KuRingGaiGpfsConductReport {
  page_number: number;
  operating_result_millions: number | null;
  /** The table's prior-year (2024) operating result, for the printed "0.31 higher" check. */
  prior_year_operating_result_millions: number | null;
  /** The printed narrative "$0.31 million higher than the 2023–24 result". */
  operating_result_change_millions: number | null;
  /** The 2025 value printed in the auditor's own prior-two-year graph. */
  graph_operating_result_millions: number | null;
  operating_grants_millions: number | null;
  capital_grants_millions: number | null;
  rates_and_annual_charges_millions: number | null;
  depreciation_millions: number | null;
  materials_and_services_millions: number | null;
  net_result_before_capital_millions: number | null;
  /** Only present when the narrative prints an explicit total-expenses figure. */
  total_expenses_millions: number | null;
  /** Printed variance percentages in table row order, when readable. */
  variance_percentages: number[];
  /** Internal printed table/graph/text inconsistencies, retained for a human. */
  internal_printed_discrepancies: string[];
}

export interface KuRingGaiGpfsReconciliation {
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
  conduct_report: KuRingGaiGpfsConductReport | null;
  /** Narrative total-expenses difference in thousands, if a total was printed. */
  conduct_report_total_expenses_discrepancy_thousands: number | null;
  /** Any narrative figure that differs by more than the rounding tolerance. */
  conduct_report_narrative_discrepancies: string[];
  /** Internal printed table/graph/text inconsistencies, retained for a human. */
  conduct_report_internal_discrepancies: string[];
  /** True when a printed label/numeric inconsistency was found in the narrative. */
  human_spot_check_required: boolean;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface KuRingGaiGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: KuRingGaiGpfsReconciliation | null;
  warnings: string[];
  rejections: KuRingGaiGpfsRejection[];
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
 * Convert a Ku-ring-gai financial-statements link text or filename to a fiscal
 * year. The Finance page prints "Financial statements 2024-2025"; the document
 * filename uses "...-30-06-2025.pdf". Consecutive year ranges, "2024/25" and
 * June year-ends are handled. Anything that is not a consecutive year pair is
 * rejected.
 */
export function fiscalYearFromKuRingGaiGpfsLink(text: string): string | null {
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

export interface KuRingGaiGpfsReportPage {
  pdfUrl: string;
  title: string;
}

/**
 * Ku-ring-gai's own official site is the only host accepted for the financial
 * statements PDF. Any other host is rejected even if the anchor text matches.
 */
function isKuRingGaiDocumentHost(hostname: string): boolean {
  return /(^|\.)krg\.nsw\.gov\.au$/i.test(hostname);
}

/**
 * Discover the audited FY2024-25 financial statements from the official Finance
 * page. The page lists each year under the printed link text "Financial
 * statements 2024-2025(PDF, 2MB)" (the future "Financial statements 2025-2026"
 * entry is ignored). The link is parsed from the page HTML, never guessed.
 */
export function parseKuRingGaiGpfsReportPage(
  html: string,
  baseUrl: string,
  fiscalYear: string = KU_RING_GAI_GPFS_FISCAL_YEAR,
): KuRingGaiGpfsReportPage | null {
  const startYear = Number(fiscalYear.slice(0, 4));
  const endYear = startYear + 1;
  if (!Number.isFinite(startYear)) return null;
  for (const anchor of anchors(html)) {
    const match = /financial\s+statements?\s+((?:19|20)\d{2})\s*[-/]\s*((?:19|20)?\d{2})/i.exec(
      anchor.text,
    );
    if (!match) continue;
    const linkStart = Number(match[1]);
    const endRaw = match[2]!;
    const linkEnd =
      endRaw.length === 2 ? Math.floor(linkStart / 100) * 100 + Number(endRaw) : Number(endRaw);
    if (linkStart !== startYear || linkEnd !== endYear) continue;
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    let url: URL;
    try {
      url = new URL(anchor.href, baseUrl);
    } catch {
      continue;
    }
    if (!isKuRingGaiDocumentHost(url.hostname)) continue;
    return {
      pdfUrl: url.toString(),
      title: `Ku-ring-gai Council Annual Financial Statements ${fiscalYear}`,
    };
  }
  return null;
}

export interface KuRingGaiGpfsDiscoveryOverrides {
  listingHtml?: string;
}

/** Discover the audited GPFS document from the official page HTML. */
export async function discoverKuRingGaiGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = KU_RING_GAI_GPFS_FISCAL_YEAR,
  overrides: KuRingGaiGpfsDiscoveryOverrides = {},
): Promise<KuRingGaiGpfsDocument> {
  let listingHtml = overrides.listingHtml;
  let listingUrl = KU_RING_GAI_GPFS_REPORTING_URL;
  if (listingHtml === undefined) {
    const response = await fetchImpl(KU_RING_GAI_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Ku-ring-gai Finance page fetch HTTP ${response.status} for ${KU_RING_GAI_GPFS_REPORTING_URL}; the site returns HTTP 403 to non-browser clients — use the documented headless Chromium path (scripts/ku-ring-gai-gpfs-browser.ts)`,
      );
    }
    listingHtml = await response.text();
    listingUrl = response.url || listingUrl;
  }
  const page = parseKuRingGaiGpfsReportPage(listingHtml, listingUrl, fiscalYear);
  if (!page) {
    throw new Error(
      `Ku-ring-gai FY${fiscalYear} Finance page has no official "Financial statements" PDF link for that year; refusing to guess a document URL`,
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
export function detectKuRingGaiGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectKuRingGaiGpfsUnit([page.text]);
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
 * Reconstruct printed rows from PDF text-item coordinates. Ku-ring-gai prints a
 * row's label and its three amounts on the same printed line, so grouping by y
 * and sorting by x recovers the printed table. The Actual 2025 column is
 * isolated by its x band (the note column sits left of it, the prior-year column
 * right of it).
 */
export function buildKuRingGaiRows(page: PdfPage): PrintedRow[] {
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
export function findKuRingGaiLine(
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
  spec: KuRingGaiGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): KuRingGaiGpfsLineValue | null {
  const found = findKuRingGaiLine(rows, spec.label, spec.last_occurrence ?? false);
  if (!found) {
    errors.push(`p${pageNumber}: could not read printed row for "${spec.label}"`);
    return null;
  }
  return { spec, value: found.actual, page_number: pageNumber };
}

function lineByKey(values: readonly KuRingGaiGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface KuRingGaiGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse the B1-1 "Total functions and activities" total row. Ku-ring-gai prints
 * the total row as a normal table line: the label sits at x=50 and the ten
 * amounts (five column pairs) share its y coordinate. We collect the money
 * items in the label's y band, sort them by x and read the FY2024-25 values at
 * indices 0, 2, 4 and 6 (income, expenses, operating result, grants). We never
 * sum the function rows.
 */
export function parseKuRingGaiGpfsFunctionsTotals(page: PdfPage): KuRingGaiGpfsFunctionsTotals {
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
 * figures. Ku-ring-gai prints a one-decimal-million table plus narrative prose
 * and a prior-two-year graph. It does not print a combined grants total or a
 * narrative total-expenses figure. Each captured value is retained as evidence
 * so an internal printed discrepancy can be surfaced for a human rather than
 * silently reconciled.
 */
export function parseKuRingGaiGpfsConductReport(
  pages: readonly PdfPage[],
): KuRingGaiGpfsConductReport | null {
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
  const number = (pattern: RegExp, group = 1): number | null => {
    const match = pattern.exec(text);
    if (!match) return null;
    const value = Number(match[group]!.replace(/,/g, ''));
    return Number.isFinite(value) ? value : null;
  };
  const operatingTable =
    /Operating result from continuing operations\s+(-?[\d.,]+)\s+(-?[\d.,]+)/i.exec(text);
  const operating = operatingTable
    ? Number(operatingTable[1]!.replace(/,/g, ''))
    : number(/Operating result from continuing operations\s+(-?[\d.,]+)\s+(-?[\d.,]+)/i);
  const priorOperating = operatingTable ? Number(operatingTable[2]!.replace(/,/g, '')) : null;
  const rates = number(/Rates and annual charges revenue\s+([\d.,]+)\s+[\d.,]+/i);
  const operatingGrants = number(
    /Grants and contributions provided for operating purposes revenue\s+([\d.,]+)\s+[\d.,]+/i,
  );
  const capitalGrants = number(
    /Grants and contributions provided for capital purposes revenue\s+([\d.,]+)\s+[\d.,]+/i,
  );
  const depreciation = number(
    /Depreciation, amortisation and impairment of non-financial assets expense\s*\(\s*\$?\s*([\d.,]+)\s*million\s*\)/i,
  );
  const materials = number(/Materials and services expense\s*\(\s*\$?\s*([\d.,]+)\s*million\s*\)/i);
  const operatingChange = number(/was\s*\$?\s*([\d.,]+)\s*million higher than the 2023/i);
  const beforeCapital = number(
    /net operating result for the year before grants and contributions provided for capital purposes was\s*\$?\s*([\d.,]+)\s*million/i,
  );
  const totalExpenses = number(
    /total expenses from continuing operations including depreciation[^()]*\(\s*\$?\s*([\d.,]+)\s*million\s*\)/i,
  );
  // The graph prints the prior two years before its y-axis labels: "24.84
  // 21.69 21.99 19 20 ... 2023 2024 2025"; the third value is FY2024-25.
  const graphOperating = number(
    /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+19\s+20\s+21\s+22\s+23\s+24\s+25\s+26\s+2023\s+2024\s+2025/i,
    3,
  );
  // The variance column sits right of the two $m columns; collecting the
  // percentages in printed row order lets us retain the auditor's own numbers.
  const variance_percentages = page.items
    .filter((item) => item.x >= 470 && item.x <= 560 && /^\d+(?:\.\d+)?$/.test(item.str.trim()))
    .sort((a, b) => b.y - a.y)
    .map((item) => Number(item.str.trim()))
    .filter((value) => Number.isFinite(value));
  const internal_printed_discrepancies: string[] = [];
  if (
    operating !== null &&
    graphOperating !== null &&
    Math.abs(operating - graphOperating) > 0.001
  ) {
    internal_printed_discrepancies.push(
      `the Report on the Conduct of the Audit prints the 2025 operating result as $${operating.toFixed(1)} million in its table but $${graphOperating.toFixed(2)} million in its own prior-two-year graph on the same page (GPFS prints 21,997 thousand)`,
    );
  }
  if (operating !== null && priorOperating !== null && operatingChange !== null) {
    const implied = Number((priorOperating + operatingChange).toFixed(3));
    if (Math.abs(operating - implied) > 0.05) {
      internal_printed_discrepancies.push(
        `the table prints 2025 operating result $${operating.toFixed(1)} million but its own text says the result was $${operatingChange.toFixed(2)} million higher than the 2023–24 $${priorOperating.toFixed(1)} million (implying $${implied.toFixed(1)} million)`,
      );
    }
  }
  return {
    page_number: page.page_number,
    operating_result_millions: operating,
    prior_year_operating_result_millions: priorOperating,
    operating_result_change_millions: operatingChange,
    graph_operating_result_millions: graphOperating,
    operating_grants_millions: operatingGrants,
    capital_grants_millions: capitalGrants,
    rates_and_annual_charges_millions: rates,
    depreciation_millions: depreciation,
    materials_and_services_millions: materials,
    net_result_before_capital_millions: beforeCapital,
    total_expenses_millions: totalExpenses,
    variance_percentages,
    internal_printed_discrepancies,
  };
}

function gpfsFundingSource(spec: KuRingGaiGpfsLineSpec): string {
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
  context: KuRingGaiGpfsParseContext,
  spec: KuRingGaiGpfsLineSpec,
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
    'the audited General Purpose Financial Statements for the year ended 30 June 2025 are published in the official Ku-ring-gai Council Annual Financial Statements PDF linked from the council Finance page; the independent auditor’s reports on the financial statements are included in the same PDF; provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + document + line + fiscal year. */
export function kuRingGaiGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = KU_RING_GAI_GPFS_FISCAL_YEAR,
): string {
  return `${KU_RING_GAI_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: KuRingGaiGpfsLineValue,
  context: KuRingGaiGpfsParseContext,
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
    fiscal_year: KU_RING_GAI_GPFS_FISCAL_YEAR,
    source_id: KU_RING_GAI_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: kuRingGaiGpfsNaturalKey(
      context.document.url,
      spec.key,
      KU_RING_GAI_GPFS_FISCAL_YEAR,
    ),
    project_name: `Ku-ring-gai Council GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: KU_RING_GAI_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: KU_RING_GAI_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: KU_RING_GAI_GPFS_DATA_QUALITY_FLAG,
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
export function parseKuRingGaiGpfsExtraction(
  extraction: PdfExtraction,
  context: KuRingGaiGpfsParseContext,
): KuRingGaiGpfsParseResult {
  const warnings: string[] = [];
  const rejections: KuRingGaiGpfsRejection[] = [];
  const reject = (reason: string): KuRingGaiGpfsParseResult => {
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
    text.includes(KU_RING_GAI_GPFS_DEPRECIATION_NOTE_LABEL),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: KuRingGaiGpfsFunctionsTotals;
  let comprehensiveNetResult: number | null;
  let comprehensiveOther: number | null;
  let comprehensiveTotal: number | null;
  let depreciationImpairmentNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseKuRingGaiGpfsFunctionsTotals(functionsPage);
    const comprehensiveRows = buildKuRingGaiRows(comprehensivePage);
    comprehensiveNetResult =
      findKuRingGaiLine(comprehensiveRows, KU_RING_GAI_GPFS_COMPREHENSIVE_NET_RESULT_LABEL)
        ?.numbers[0] ?? null;
    comprehensiveOther =
      findKuRingGaiLine(comprehensiveRows, KU_RING_GAI_GPFS_OCI_LABEL)?.numbers[0] ?? null;
    comprehensiveTotal =
      findKuRingGaiLine(comprehensiveRows, KU_RING_GAI_GPFS_COMPREHENSIVE_TOTAL_LABEL)
        ?.numbers[0] ?? null;
    if (depreciationPage) {
      const depreciationRows = buildKuRingGaiRows(depreciationPage);
      depreciationImpairmentNoteTotal =
        findKuRingGaiLine(depreciationRows, KU_RING_GAI_GPFS_DEPRECIATION_NOTE_LABEL)?.numbers[0] ??
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

  const incomeRows = buildKuRingGaiRows(incomePage);
  const errors: string[] = [];
  const values: KuRingGaiGpfsLineValue[] = [];
  for (const spec of KU_RING_GAI_GPFS_LINES) {
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
    findKuRingGaiLine(incomeRows, KU_RING_GAI_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL)
      ?.actual ?? null;
  const operatingResult =
    findKuRingGaiLine(incomeRows, KU_RING_GAI_GPFS_OPERATING_RESULT_LABEL)?.actual ?? null;
  const netResultBeforeCapital =
    findKuRingGaiLine(incomeRows, KU_RING_GAI_GPFS_BEFORE_CAPITAL_LABEL)?.actual ?? null;

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

  const totalExpensesLine: KuRingGaiGpfsLineValue = {
    spec: KU_RING_GAI_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
    value: totalExpenses,
    page_number: functionsPage.page_number,
  };
  values.push(totalExpensesLine);

  const conductReport = parseKuRingGaiGpfsConductReport(extraction.pages);
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
    if (conductReport.operating_grants_millions !== null) {
      add(
        narrativeDiscrepancy(
          'operating grants narrative',
          conductReport.operating_grants_millions,
          grantsOperating!,
        ),
      );
    }
    if (conductReport.capital_grants_millions !== null) {
      add(
        narrativeDiscrepancy(
          'capital grants narrative',
          conductReport.capital_grants_millions,
          grantsCapital!,
        ),
      );
    }
    if (conductReport.rates_and_annual_charges_millions !== null) {
      add(
        narrativeDiscrepancy(
          'rates and annual charges narrative',
          conductReport.rates_and_annual_charges_millions,
          rates!,
        ),
      );
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
    if (conductReport.materials_and_services_millions !== null) {
      add(
        narrativeDiscrepancy(
          'materials and services narrative',
          conductReport.materials_and_services_millions,
          materials!,
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

  const internalDiscrepancies = conductReport?.internal_printed_discrepancies ?? [];
  const humanSpotCheckRequired =
    narrativeDiscrepancies.length > 0 || internalDiscrepancies.length > 0;

  const reconciliation: KuRingGaiGpfsReconciliation = {
    fiscal_year: KU_RING_GAI_GPFS_FISCAL_YEAR,
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
    conduct_report_internal_discrepancies: internalDiscrepancies,
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
          ? `the independent auditor's Report on the Conduct of the Audit (p${conductReport.page_number}) prints one-decimal-million narrative figures and prints no numeric total-expenses figure; the audited face/B1-1/comprehensive totals reconcile exactly, but the narrative and its own text/graph contain internal printed discrepancies retained for a human spot check: ${[...narrativeDiscrepancies, ...internalDiscrepancies].join('; ')}`
          : `the independent auditor's Report on the Conduct of the Audit (p${conductReport.page_number}) rounded narrative figures agree with the GPFS within the printed one-decimal-million rounding tolerance; the report prints no narrative total-expenses figure and no internal printed discrepancy was found`
        : 'the independent auditor’s Report on the Conduct of the Audit narrative was not found; no narrative difference is recorded',
    ],
  };

  const reconciliationNote =
    `total expenses is the printed B1-1 Total functions and activities expense total (${formatThousands(totalExpenses)} thousand), which equals the printed face-statement bridge of expenses-excluding-depreciation (${formatThousands(expensesExDepreciation!)} thousand) plus printed depreciation/amortisation/impairment (${formatThousands(depreciation!)} thousand), and equals printed total income (${formatThousands(totalRevenue!)} thousand) less the printed operating result (${formatThousands(operatingResult!)} thousand); the B1-1 income, expenses, operating result and grants reconcile exactly to the face statement (no face-vs-B1-1 discrepancy); the printed borrowing-costs line (${formatThousands(borrowingCosts!)} thousand) and the printed net gain from the disposal of assets (${formatThousands(netGainDisposal!)} thousand) are non-nil and are included in the printed components; the printed net result (${formatThousands(netResult!)} thousand) equals the printed operating result and is repeated in the Statement of Comprehensive Income; the printed before-capital result (${formatThousands(netResultBeforeCapital!)} thousand) equals printed net result less printed capital grants (${formatThousands(grantsCapital!)} thousand) and is reconciliation evidence only (not emitted); note B3-4 prints total depreciation, amortisation and impairment for non-financial assets (${depreciationImpairmentNoteTotal === null ? 'not read' : formatThousands(depreciationImpairmentNoteTotal)} thousand), equal to the face line` +
    (conductReport
      ? humanSpotCheckRequired
        ? `; the independent auditor's Report on the Conduct of the Audit prints a one-decimal-million table (operating result $${conductReport.operating_result_millions?.toFixed(1) ?? 'not read'} million; rates and annual charges $${conductReport.rates_and_annual_charges_millions?.toFixed(1) ?? 'not read'} million; operating grants $${conductReport.operating_grants_millions?.toFixed(1) ?? 'not read'} million; capital grants $${conductReport.capital_grants_millions?.toFixed(1) ?? 'not read'} million; depreciation $${conductReport.depreciation_millions?.toFixed(1) ?? 'not read'} million; materials and services $${conductReport.materials_and_services_millions?.toFixed(1) ?? 'not read'} million; before-capital result $${conductReport.net_result_before_capital_millions?.toFixed(2) ?? 'not read'} million) and prints no narrative total-expenses figure; the narrative's own text and graph contradict its table for the 2025 operating result, so the internal printed discrepancies are retained for a human spot check: ${[...narrativeDiscrepancies, ...internalDiscrepancies].join('; ')}`
        : `; the independent auditor's Report on the Conduct of the Audit prints a one-decimal-million table (operating result $${conductReport.operating_result_millions?.toFixed(1) ?? 'not read'} million; depreciation $${conductReport.depreciation_millions?.toFixed(1) ?? 'not read'} million; materials and services $${conductReport.materials_and_services_millions?.toFixed(1) ?? 'not read'} million; before-capital result $${conductReport.net_result_before_capital_millions?.toFixed(2) ?? 'not read'} million), all consistent with the GPFS within printed rounding and with no internal printed discrepancy`
      : '; the independent auditor’s Report on the Conduct of the Audit narrative was not found');

  const spotCheckNote = humanSpotCheckRequired
    ? `human_spot_check: required — the audited face statement, B1-1 and Statement of Comprehensive Income totals reconcile exactly (total expenses ${formatThousands(totalExpenses)} thousand; net result ${formatThousands(netResult!)} thousand), but the independent auditor's Report on the Conduct of the Audit contains internal printed discrepancies: ${[...narrativeDiscrepancies, ...internalDiscrepancies].join('; ')}; a human must confirm how the narrative presentation should be read before the affected total is treated as final`
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
        ? `; auditor narrative internal printed inconsistencies retained for human spot-check (${[...narrativeDiscrepancies, ...internalDiscrepancies].join('; ')})`
        : conductReport
          ? '; auditor narrative figures agree within printed rounding and print no total-expenses figure'
          : ''),
  );
  return { records, reconciliation, warnings, rejections };
}

export interface KuRingGaiGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: KuRingGaiGpfsDocument;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched discovery input; the connector still selects the official link. */
  listingHtml?: string;
}

function documentFilename(_url: string): string {
  // The publisher's CMS name can change; use the stable archive name so a
  // re-download never creates a second copy.
  return 'ku-ring-gai-council-annual-financial-statements-2024-25.pdf';
}

/** Build the live Ku-ring-gai Council GPFS connector. */
export function createKuRingGaiGpfsConnector(
  options: KuRingGaiGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: KU_RING_GAI_GPFS_ID,
    name: KU_RING_GAI_GPFS_NAME,
    publisher: KU_RING_GAI_GPFS_PUBLISHER,
    source_url: KU_RING_GAI_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: KU_RING_GAI_GPFS_LICENSE,
    notes:
      "Thirtieth NSW council GPFS adapter: one council only (Ku-ring-gai Council), audited FY2024-25 General Purpose Financial Statements published in the official Annual Financial Statements PDF linked from the council Finance page. The site returns HTTP 403 to non-browser clients, so the documented headless Chromium path loads it; the connector discovers the PDF from the cleared HTML (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-4 reconcile exactly. The auditor's Report on the Conduct of the Audit narrative is checked for printed differences; the narrative's own table/text/graph 2025 operating-result discrepancy (21.9 vs 21.99 vs 21,997) is retained and flagged for a human spot check, never silently reconciled. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverKuRingGaiGpfsDocument(fetchImpl, KU_RING_GAI_GPFS_FISCAL_YEAR, {
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
            `Ku-ring-gai Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: KuRingGaiGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: KU_RING_GAI_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Ku-ring-gai Council Annual Financial Statements for the year ended 30 June 2025 containing the audited FY2024-25 General Purpose Financial Statements; linked from the official Finance page and archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: KuRingGaiGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: KU_RING_GAI_GPFS_REPORTING_URL,
      };
      const parsed = parseKuRingGaiGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'ku-ring-gai-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'ku-ring-gai-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Ku-ring-gai Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
