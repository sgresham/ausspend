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
 * NSW council GPFS adapter: Campbelltown City Council's audited General Purpose
 * Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Blue Mountains (§7.36) reference
 * implementations in docs/NSW_COUNCILS.md. It is a separate source id
 * (`campbelltown-gpfs`) from every other source. Every row is non-additive
 * `agency_detail` with no region/LGA allocation, so it is never summed with the
 * Dubbo budget rows, any existing council GPFS source, the pre-existing
 * federal/state/charity rows whose `delivery_entity` mentions Campbelltown, or
 * any other council.
 *
 * The document is the council's own published "Financial Statements 2024-25"
 * PDF, linked from the official financial-information page. The PDF prints the
 * Income Statement (PDF p8), the Statement of Comprehensive Income (PDF p9), the
 * B1-1 "Functions or activities" note (PDF p19) and note B3-3 depreciation
 * (PDF p28). The printed unit is an explicit `$'000` on every page used here.
 *
 * The income statement is a single continuing-operations statement with no
 * discontinued operation: total income $306,751 thousand, total expenses
 * $243,664 thousand (the printed B1-1 total, equal to the printed face bridge of
 * expenses excluding depreciation $204,374 thousand plus depreciation,
 * amortisation and impairment $39,290 thousand), giving an operating result of
 * $63,087 thousand. The Statement of Comprehensive Income repeats that net
 * result and adds $263 thousand of other comprehensive income for total
 * comprehensive income of $63,350 thousand. The B1-1 objective expense split
 * also sums exactly to the printed $243,664 thousand total; it is a second cut
 * (by Community Strategic Plan objective) of the same total, never added to the
 * nature-of-expense cut.
 */

export const CAMPBELLTOWN_GPFS_ID = 'campbelltown-gpfs';
export const CAMPBELLTOWN_GPFS_NAME =
  'Campbelltown City Council — General Purpose Financial Statements';
export const CAMPBELLTOWN_GPFS_PUBLISHER = 'Campbelltown City Council';
export const CAMPBELLTOWN_GPFS_REPORTING_URL =
  'https://www.campbelltown.nsw.gov.au/Council-and-Councillors/Financial-information';
export const CAMPBELLTOWN_GPFS_FISCAL_YEAR = '2024-25';
export const CAMPBELLTOWN_GPFS_SOURCE_DATASET = 'Campbelltown City Council GPFS 2024-25';
export const CAMPBELLTOWN_GPFS_LICENSE =
  '© Campbelltown City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const CAMPBELLTOWN_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const CAMPBELLTOWN_GPFS_DELIVERY_ENTITY = 'Campbelltown City Council';

export interface CampbelltownGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The official page the PDF was found on. */
  listing_url?: string;
  /** The final PDF URL after redirects, when known. */
  resolved_url?: string;
}

export interface CampbelltownGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface CampbelltownGpfsParseContext {
  document: CampbelltownGpfsDocument;
  archive: CampbelltownGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface CampbelltownGpfsRejection {
  section: string;
  reason: string;
}

export type CampbelltownGpfsSection = 'revenue' | 'expenses' | 'result';

export interface CampbelltownGpfsLineSpec {
  key: string;
  label: string;
  section: CampbelltownGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement:
    'Income Statement' | 'Statement of Comprehensive Income' | 'B1-1 Functions or activities';
  /** The FY2024-25 Actual column is the first numeric column after the note. */
  read_from?: 'income' | 'comprehensive';
  /**
   * When set, read the last printed occurrence of the label. The
   * operating-result-excluding-depreciation row wraps onto a continuation line
   * whose text is exactly the standalone depreciation line's label; the
   * standalone depreciation row is the later occurrence.
   */
  last_occurrence?: boolean;
}

/**
 * The printed lines we emit. The seven revenue components sum exactly to the
 * printed total income from continuing operations. The five non-nil
 * expense-by-nature components sum exactly to the printed "Total expenses from
 * continuing operations excluding depreciation, amortisation and impairment of
 * non-financial assets" line, which with the printed depreciation line forms the
 * printed face-statement expense bridge. Total expenses is the printed B1-1
 * "Total functions or activities" expense total, which equals that bridge
 * exactly. Net result is the printed net operating result repeated at the top of
 * the Statement of Comprehensive Income.
 */
export const CAMPBELLTOWN_GPFS_LINES: ReadonlyArray<CampbelltownGpfsLineSpec> = [
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
    label: 'Depreciation, amortisation and impairment of non-financial assets',
    last_occurrence: true,
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label: 'Total functions or activities — expenses (B1-1 printed total)',
    section: 'expenses',
    statement: 'B1-1 Functions or activities',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year from Income Statement',
    section: 'result',
    statement: 'Statement of Comprehensive Income',
    read_from: 'comprehensive',
  },
];

/**
 * The printed B1-1 objective expense labels. Campbelltown prints its five
 * Community Strategic Plan objectives. Each row's FY2024-25 expense column is
 * emitted as a second (service) cut of the same printed total expenses; the
 * split is never added to the nature-of-expense rows.
 */
export const CAMPBELLTOWN_GPFS_FUNCTION_LABELS: ReadonlyArray<string> = [
  'Community and belonging',
  'Places for people',
  'Enriched natural environment',
  'Economic prosperity',
  'Strong leadership',
];

export const CAMPBELLTOWN_GPFS_FUNCTIONS_TOTAL_LABEL = 'Total functions or activities';
export const CAMPBELLTOWN_GPFS_OPERATING_RESULT_CONTINUING_LABEL =
  'Operating result from continuing operations';
export const CAMPBELLTOWN_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL =
  'Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets';
export const CAMPBELLTOWN_GPFS_OCI_LABEL = 'Total other comprehensive income for the year';
export const CAMPBELLTOWN_GPFS_COMPREHENSIVE_TOTAL_LABEL =
  'Total comprehensive income for the year attributable to Council';
export const CAMPBELLTOWN_GPFS_DEPRECIATION_NOTE_LABEL =
  'Total depreciation and amortisation costs';

interface CampbelltownGpfsLineValue {
  spec: CampbelltownGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface CampbelltownGpfsFunctionRow {
  label: string;
  expenses: number;
}

export interface CampbelltownGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

export interface CampbelltownGpfsReconciliation {
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
  net_loss_from_disposal_of_assets: number;
  materials_and_services: number;
  other_expenses: number;
  operating_result_continuing: number;
  net_result: number;
  operating_result_excluding_depreciation: number;
  printed_total_expenses_excluding_depreciation: number;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  functions_expense_split_sum: number;
  comprehensive_income_net_result: number;
  comprehensive_income_other: number;
  comprehensive_income_total: number;
  depreciation_impairment_note_total: number | null;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface CampbelltownGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: CampbelltownGpfsReconciliation | null;
  warnings: string[];
  rejections: CampbelltownGpfsRejection[];
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
 * Convert a Campbelltown PDF filename or link text to a fiscal year. The
 * published filename prints "...2024-25"; consecutive year ranges and June
 * year-ends are handled. Anything that is not a consecutive year pair is
 * rejected.
 */
export function fiscalYearFromCampbelltownGpfsLink(text: string): string | null {
  const normalizedText = text.replace(/[\u2010-\u2015\u2212]/g, '-');
  let decodedText = normalizedText;
  try {
    decodedText = decodeURIComponent(normalizedText);
  } catch {
    // Keep the raw text when a stray percent sign is not valid percent-encoding.
  }
  const spaced = decodedText
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const june = /(?:30\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(spaced);
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }

  const consecutive = /((?:19|20)\d{2})\s*[-/]\s*((?:19|20)?\d{2})/.exec(decodedText);
  if (consecutive) {
    const start = Number(consecutive[1]);
    const endRaw = consecutive[2]!;
    const end =
      endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
    if (end === start + 1) return `${start}-${String(end).slice(-2)}`;
  }

  const bare = /(?:^|\D)((?:19|20)\d{2})(?:\D|$)/.exec(spaced);
  if (bare) {
    const end = Number(bare[1]);
    if (end >= 2010 && end <= 2035) return `${end - 1}-${String(end).slice(-2)}`;
  }
  return null;
}

export interface CampbelltownGpfsReportPage {
  pdfUrl: string;
  title: string;
}

/**
 * Campbelltown's own site is the only host accepted for the financial
 * statements PDF. Any other host is rejected even if a link text matches.
 */
function isCampbelltownDocumentHost(hostname: string): boolean {
  return /(^|\.)campbelltown\.nsw\.gov\.au$/i.test(hostname);
}

/**
 * Discover the audited FY2024-25 financial-statements PDF from the council's
 * official financial-information page. The page carries a direct link to the
 * published PDF; the URL is parsed from that page, never guessed.
 */
export function parseCampbelltownGpfsReportPage(
  html: string,
  baseUrl: string,
  fiscalYear: string = CAMPBELLTOWN_GPFS_FISCAL_YEAR,
): CampbelltownGpfsReportPage | null {
  const candidates: string[] = [];
  const href = /href="([^"]+\.pdf)"/gi;
  let match: RegExpExecArray | null;
  while ((match = href.exec(html)) !== null) candidates.push(match[1]!);

  for (const candidate of candidates) {
    const decoded = decodeHtml(candidate);
    let url: URL;
    try {
      url = new URL(decoded, baseUrl);
    } catch {
      continue;
    }
    if (!isCampbelltownDocumentHost(url.hostname)) continue;
    const marker = /financial[-_ ]?statements/i.test(url.pathname);
    if (!marker) continue;
    if (fiscalYearFromCampbelltownGpfsLink(url.pathname) !== fiscalYear) continue;
    return {
      pdfUrl: url.toString(),
      title: `Campbelltown City Council Financial Statements ${fiscalYear} (General Purpose Financial Statements)`,
    };
  }
  return null;
}

export interface CampbelltownGpfsDiscoveryOverrides {
  listingHtml?: string;
}

/** Discover the audited GPFS document from the official financial-information page HTML. */
export async function discoverCampbelltownGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = CAMPBELLTOWN_GPFS_FISCAL_YEAR,
  overrides: CampbelltownGpfsDiscoveryOverrides = {},
): Promise<CampbelltownGpfsDocument> {
  let listingHtml = overrides.listingHtml;
  let listingUrl = CAMPBELLTOWN_GPFS_REPORTING_URL;
  if (listingHtml === undefined) {
    const response = await fetchImpl(CAMPBELLTOWN_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Campbelltown financial information page fetch HTTP ${response.status} for ${CAMPBELLTOWN_GPFS_REPORTING_URL}`,
      );
    }
    listingHtml = await response.text();
    listingUrl = response.url || listingUrl;
  }
  const page = parseCampbelltownGpfsReportPage(listingHtml, listingUrl, fiscalYear);
  if (!page) {
    throw new Error(
      `Campbelltown FY${fiscalYear} financial information page has no official statements PDF link for that year; refusing to guess a document URL`,
    );
  }
  return {
    id: `gpfs-${fiscalYear}`,
    title: page.title,
    url: page.pdfUrl,
    fiscal_year: fiscalYear,
    listing_url: listingUrl,
    resolved_url: page.pdfUrl,
  };
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectCampbelltownGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectCampbelltownGpfsUnit([page.text]);
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
  /** FY2024-25 Actual column value (x in the requested column band), if printed. */
  actual: number | null;
  numbers: number[];
}

function isMoneyToken(text: string): boolean {
  const trimmed = text.trim();
  if (!MONEY_TOKEN.test(trimmed)) return false;
  return parseAmountCell(trimmed).value !== null;
}

interface ColumnBand {
  min: number;
  max: number;
}

const INCOME_STATEMENT_ACTUAL_BAND: ColumnBand = { min: 440, max: 485 };

/**
 * Reconstruct printed rows from PDF text-item coordinates. A row's label and
 * its printed amounts share a y coordinate, so grouping by y and sorting by x
 * recovers the printed table. The FY2024-25 Actual column is isolated by an x
 * band (the original-budget column sits left of the note column, the prior-year
 * column right of it).
 */
export function buildCampbelltownRows(
  page: PdfPage,
  band: ColumnBand = INCOME_STATEMENT_ACTUAL_BAND,
): PrintedRow[] {
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
          if (item.x >= band.min && item.x < band.max) actual = value;
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
 * wrapped label such as "Total expenses from continuing operations excluding /
 * depreciation, amortisation and impairment..." matches the row that prints its
 * final line and amounts.
 */
export function findCampbelltownLine(
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
  spec: CampbelltownGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): CampbelltownGpfsLineValue | null {
  const found = findCampbelltownLine(rows, spec.label, spec.last_occurrence ?? false);
  if (!found) {
    errors.push(`p${pageNumber}: could not read printed row for "${spec.label}"`);
    return null;
  }
  return { spec, value: found.actual, page_number: pageNumber };
}

function lineByKey(values: readonly CampbelltownGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

/**
 * The B1-1 table is printed rotated: each objective is a column at a fixed x
 * and the ten printed amounts for that objective are stacked down the page at
 * that same x, in header order (income 2025/2024, expenses 2025/2024, operating
 * result 2025/2024, grants 2025/2024, carrying amount 2025/2024). We group the
 * money tokens at a label's x, sort them by descending y and read index 2 (the
 * FY2024-25 expense column). We never derive the total from the rows.
 */
function rotatedNumbers(page: PdfPage, label: string): number[] | null {
  const labelItem = page.items.find(
    (item) =>
      normalizeLabel(item.str) === normalizeLabel(label) &&
      item.y > 60 &&
      item.y < 120 &&
      !isMoneyToken(item.str),
  );
  if (!labelItem) return null;
  return page.items
    .filter(
      (item) =>
        isMoneyToken(item.str) &&
        Math.abs(item.x - labelItem.x) <= 3 &&
        item.y > 180 &&
        item.y < 780,
    )
    .sort((a, b) => a.y - b.y)
    .map((item) => parseAmountCell(item.str).value)
    .filter((value): value is number => value !== null);
}

/**
 * Parse the B1-1 "Total functions or activities" total row. Its ten amounts sit
 * at the same x, stacked by column; FY2024-25 income, expenses, operating result
 * and grants are indices 0, 2, 4 and 6.
 */
export function parseCampbelltownGpfsFunctionsTotals(
  page: PdfPage,
): CampbelltownGpfsFunctionsTotals {
  const values = rotatedNumbers(page, CAMPBELLTOWN_GPFS_FUNCTIONS_TOTAL_LABEL);
  if (!values || values.length < 8) {
    throw new Error(
      `p${page.page_number}: B1-1 Total functions or activities row not found or has fewer than 8 numeric values`,
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
 * Parse the printed B1-1 objective expense split. Zero/nil rows are skipped; the
 * remaining printed rows are checked as a whole against the printed total
 * elsewhere.
 */
export function parseCampbelltownGpfsFunctionsSplit(
  page: PdfPage,
  labels: readonly string[] = CAMPBELLTOWN_GPFS_FUNCTION_LABELS,
): CampbelltownGpfsFunctionRow[] {
  const parsed: CampbelltownGpfsFunctionRow[] = [];
  for (const label of labels) {
    const values = rotatedNumbers(page, label);
    if (!values || values.length < 3) continue;
    const expenses = values[2]!;
    if (expenses === 0) continue;
    parsed.push({ label, expenses });
  }
  return parsed;
}

function gpfsFundingSource(spec: CampbelltownGpfsLineSpec): string {
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
  context: CampbelltownGpfsParseContext,
  spec: Pick<CampbelltownGpfsLineSpec, 'label' | 'statement'>,
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
    'the audited General Purpose Financial Statements for the year ended 30 June 2025 are the official Campbelltown City Council "Financial Statements 2024-25" PDF linked from the council financial-information page; the independent auditor’s report is included in the same PDF (signed 28 October 2025); provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + exact-document SHA-256 + line + fiscal year. */
export function campbelltownGpfsNaturalKey(
  documentIdentity: string,
  lineItem: string,
  fiscalYear: string = CAMPBELLTOWN_GPFS_FISCAL_YEAR,
): string {
  return `${CAMPBELLTOWN_GPFS_ID}:${createHash('sha256')
    .update(`${documentIdentity}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: CampbelltownGpfsLineValue,
  context: CampbelltownGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: CAMPBELLTOWN_GPFS_FISCAL_YEAR,
    source_id: CAMPBELLTOWN_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: campbelltownGpfsNaturalKey(
      context.archive.sha256,
      spec.key,
      CAMPBELLTOWN_GPFS_FISCAL_YEAR,
    ),
    project_name: `Campbelltown City Council GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: CAMPBELLTOWN_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: CAMPBELLTOWN_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: CAMPBELLTOWN_GPFS_DATA_QUALITY_FLAG,
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

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function mapFunctionExpense(
  row: CampbelltownGpfsFunctionRow,
  context: CampbelltownGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  pageNumber: number,
  reconciliationNote: string,
): SpendingRecord {
  const key = `b1_1_function_expenses_${slug(row.label)}`;
  const label = `${row.label} — expenses`;
  return {
    amount_cents: moneyToCents(Math.abs(row.expenses), unit),
    measure_type: 'actual',
    fiscal_year: CAMPBELLTOWN_GPFS_FISCAL_YEAR,
    source_id: CAMPBELLTOWN_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: campbelltownGpfsNaturalKey(
      context.archive.sha256,
      key,
      CAMPBELLTOWN_GPFS_FISCAL_YEAR,
    ),
    project_name: `Campbelltown City Council GPFS 2024-25 — ${label}`,
    description: 'Expense line item — B1-1 Functions or activities',
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: CAMPBELLTOWN_GPFS_DELIVERY_ENTITY,
    funding_source: 'Council expenditure',
    source_dataset: CAMPBELLTOWN_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: CAMPBELLTOWN_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    extraction_confidence: 'high',
    gpfs_line_item: key,
    gpfs_line_label: label,
    gpfs_unit: gpfsUnitLabel(unit),
    gpfs_section: 'expenses',
    gpfs_statement: 'B1-1 Functions or activities',
    gpfs_component_of: 'b1_1_total_expenses',
    notes: `${notesFor(
      context,
      { label, statement: 'B1-1 Functions or activities' },
      unit,
      unitReason,
      pageNumber,
      reconciliationNote,
    )}; this is a Community Strategic Plan objective cut of the same printed total expenses as the nature-of-expense rows; never added to the nature cut`,
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
export function parseCampbelltownGpfsExtraction(
  extraction: PdfExtraction,
  context: CampbelltownGpfsParseContext,
): CampbelltownGpfsParseResult {
  const warnings: string[] = [];
  const rejections: CampbelltownGpfsRejection[] = [];
  const reject = (reason: string): CampbelltownGpfsParseResult => {
    rejections.push({ section: 'gpfs', reason });
    warnings.push(reason);
    return { records: [], reconciliation: null, warnings, rejections };
  };

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('INCOME STATEMENT') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Operating result from continuing operations'),
  );
  if (!incomePage) {
    return reject('audited income statement page not found; no rows ingested');
  }
  const functionsPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('FUNCTIONS OR ACTIVITIES - INCOME, EXPENSES AND ASSETS') &&
      text.includes(CAMPBELLTOWN_GPFS_FUNCTIONS_TOTAL_LABEL),
  );
  if (!functionsPage) {
    return reject('B1-1 Total functions or activities note not found; no rows ingested');
  }
  const comprehensivePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('STATEMENT OF COMPREHENSIVE INCOME') &&
      text.includes('Net operating result for the year from Income Statement') &&
      text.includes(CAMPBELLTOWN_GPFS_COMPREHENSIVE_TOTAL_LABEL),
  );
  if (!comprehensivePage) {
    return reject(
      'Statement of Comprehensive Income page not found; no independent printed net-result check',
    );
  }
  const depreciationPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('DEPRECIATION, AMORTISATION AND IMPAIRMENT OF NON-FINANCIAL ASSETS') &&
      text.includes(CAMPBELLTOWN_GPFS_DEPRECIATION_NOTE_LABEL),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: CampbelltownGpfsFunctionsTotals;
  let functionsSplit: CampbelltownGpfsFunctionRow[];
  let comprehensiveNetResult: number | null;
  let comprehensiveOther: number | null;
  let comprehensiveTotal: number | null;
  let depreciationImpairmentNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseCampbelltownGpfsFunctionsTotals(functionsPage);
    functionsSplit = parseCampbelltownGpfsFunctionsSplit(functionsPage);
    const comprehensiveRows = buildCampbelltownRows(comprehensivePage);
    comprehensiveNetResult =
      findCampbelltownLine(
        comprehensiveRows,
        'Net operating result for the year from Income Statement',
      )?.actual ?? null;
    comprehensiveOther =
      findCampbelltownLine(comprehensiveRows, CAMPBELLTOWN_GPFS_OCI_LABEL)?.actual ?? null;
    comprehensiveTotal =
      findCampbelltownLine(comprehensiveRows, CAMPBELLTOWN_GPFS_COMPREHENSIVE_TOTAL_LABEL)
        ?.actual ?? null;
    if (depreciationPage) {
      const depreciationRows = buildCampbelltownRows(depreciationPage);
      depreciationImpairmentNoteTotal =
        findCampbelltownLine(depreciationRows, CAMPBELLTOWN_GPFS_DEPRECIATION_NOTE_LABEL)?.actual ??
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

  const incomeRows = buildCampbelltownRows(incomePage);
  const errors: string[] = [];
  const values: CampbelltownGpfsLineValue[] = [];
  for (const spec of CAMPBELLTOWN_GPFS_LINES) {
    if (spec.read_from === 'comprehensive') continue;
    if (spec.key === 'total_expenses') continue;
    const line = readLine(incomeRows, spec, incomePage.page_number, errors);
    if (line) values.push(line);
  }
  if (errors.length > 0) return reject(errors.join('; '));

  const netResultSpec = CAMPBELLTOWN_GPFS_LINES.find((spec) => spec.key === 'net_result')!;
  values.push({
    spec: netResultSpec,
    value: comprehensiveNetResult,
    page_number: comprehensivePage.page_number,
  });

  const totalRevenue = lineByKey(values, 'total_revenue');
  const employee = lineByKey(values, 'employee_expenses');
  const depreciation = lineByKey(values, 'depreciation_amortisation_impairment');
  const grantsOperating = lineByKey(values, 'government_grants_operating');
  const grantsCapital = lineByKey(values, 'government_grants_capital');
  const borrowingCosts = lineByKey(values, 'borrowing_costs');
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
  const operatingResultContinuing =
    findCampbelltownLine(incomeRows, CAMPBELLTOWN_GPFS_OPERATING_RESULT_CONTINUING_LABEL)?.actual ??
    null;
  const operatingResultExcludingDepreciation =
    findCampbelltownLine(
      incomeRows,
      CAMPBELLTOWN_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL,
    )?.actual ?? null;

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['borrowing_costs', borrowingCosts],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['net_result', netResult],
    ['operating_result_continuing', operatingResultContinuing],
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
    otherIncome!;
  const expenseComponentsSum =
    employee! + materials! + borrowingCosts! + otherExpenses! + netLossDisposal!;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = functionsTotals.expenses;
  const functionsExpenseSplitSum = functionsSplit.reduce((sum, row) => sum + row.expenses, 0);

  const totalExpensesLine: CampbelltownGpfsLineValue = {
    spec: CAMPBELLTOWN_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
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
    'income statement revenue components = printed total income from continuing operations',
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
    'printed total income - printed B1-1 total expenses = printed continuing operating result',
    operatingResultContinuing!,
    totalRevenue! - totalExpenses,
  );
  check(
    'printed continuing operating result = printed net operating result repeated in comprehensive income',
    netResult!,
    operatingResultContinuing!,
  );
  check(
    'B1-1 grants and contributions = operating grants + capital grants',
    grantsOperating! + grantsCapital!,
    functionsTotals.grants_and_contributions,
  );
  check('B1-1 income = face total income', totalRevenue!, functionsTotals.income);
  check('B1-1 expenses = face expense bridge', totalExpenses, faceExpenseBridge);
  check(
    'B1-1 operating result = face continuing operating result',
    operatingResultContinuing!,
    functionsTotals.operating_result,
  );
  check(
    'B1-1 income - B1-1 expenses = B1-1 operating result',
    functionsTotals.operating_result,
    functionsTotals.income - functionsTotals.expenses,
  );
  check(
    'B1-1 printed objective expense split = printed B1-1 total expenses',
    totalExpenses,
    functionsExpenseSplitSum,
  );
  check(
    'Statement of Comprehensive Income net result = Income Statement continuing operating result',
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
      'note B3-3 total depreciation and amortisation = face depreciation/amortisation/impairment line',
      depreciation!,
      depreciationImpairmentNoteTotal,
    );
  } else {
    checks.push('note B3-3 total depreciation and amortisation was not read');
  }
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: CampbelltownGpfsReconciliation = {
    fiscal_year: CAMPBELLTOWN_GPFS_FISCAL_YEAR,
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
    net_loss_from_disposal_of_assets: netLossDisposal!,
    materials_and_services: materials!,
    other_expenses: otherExpenses!,
    operating_result_continuing: operatingResultContinuing!,
    net_result: netResult!,
    operating_result_excluding_depreciation: operatingResultExcludingDepreciation!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    functions_total_income: functionsTotals.income,
    functions_total_expenses: functionsTotals.expenses,
    functions_operating_result: functionsTotals.operating_result,
    functions_grants_and_contributions: functionsTotals.grants_and_contributions,
    functions_expense_split_sum: functionsExpenseSplitSum,
    comprehensive_income_net_result: comprehensiveNetResult!,
    comprehensive_income_other: comprehensiveOther!,
    comprehensive_income_total: comprehensiveTotal!,
    depreciation_impairment_note_total: depreciationImpairmentNoteTotal,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'printed revenue components sum exactly to the printed total income from continuing operations',
      'printed expense-by-nature components sum exactly to the printed expenses-excluding-depreciation line',
      'printed expenses excluding depreciation + printed depreciation/amortisation/impairment equals the printed B1-1 total expenses',
      'printed total income - printed expenses excluding depreciation equals the printed operating result excluding depreciation',
      'printed total income - printed B1-1 total expenses equals the printed continuing operating result',
      'printed continuing operating result equals the printed net operating result repeated in the Statement of Comprehensive Income (no discontinued operation)',
      'B1-1 income, expenses, operating result and grants reconcile exactly to the face statement',
      'B1-1 income - B1-1 expenses equals the printed B1-1 operating result',
      'the printed B1-1 objective expense split sums exactly to the printed B1-1 total expenses',
      'Statement of Comprehensive Income net result equals the Income Statement continuing operating result',
      'Statement of Comprehensive Income total equals net result plus other comprehensive income',
      'note B3-3 total depreciation and amortisation equals the face depreciation/amortisation/impairment line',
      'total expenses is the printed B1-1 Total functions or activities figure, never derived by summing components',
    ],
  };

  const reconciliationNote = `total revenue and total expenses are the printed totals: total income (${formatThousands(totalRevenue!)} thousand) and the printed B1-1 Total functions or activities expense total (${formatThousands(totalExpenses)} thousand), which equals the printed face-statement bridge of expenses-excluding-depreciation (${formatThousands(expensesExDepreciation!)} thousand) plus printed depreciation/amortisation/impairment (${formatThousands(depreciation!)} thousand), and equals printed total income less the printed continuing operating result (${formatThousands(operatingResultContinuing!)} thousand); the Statement of Comprehensive Income repeats that net result (${formatThousands(netResult!)} thousand) because there is no discontinued operation and adds other comprehensive income of ${formatThousands(comprehensiveOther!)} thousand for a total comprehensive income of ${formatThousands(comprehensiveTotal!)} thousand; note B3-3 prints total depreciation and amortisation (${depreciationImpairmentNoteTotal === null ? 'not read' : formatThousands(depreciationImpairmentNoteTotal)} thousand), equal to the face line; the printed B1-1 objective expense split sums to the same printed total expenses (${formatThousands(functionsExpenseSplitSum)} thousand) as a separate service cut`;

  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  for (const row of functionsSplit) {
    records.push(
      mapFunctionExpense(
        row,
        context,
        unit,
        incomeUnit.reason,
        functionsPage.page_number,
        reconciliationNote,
      ),
    );
  }
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses}, net result ${netResult} ($'000) to the printed face-statement/B1-1 totals; ${functionsSplit.length} objective expense rows sum to the same printed total`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface CampbelltownGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the document page. */
  document?: CampbelltownGpfsDocument;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched discovery input; the connector still selects the official link. */
  listingHtml?: string;
}

function documentFilename(_url: string): string {
  // The publisher's CMS name can change; use the stable archive name so a
  // re-download never creates a second copy.
  return 'campbelltown-city-council-financial-statements-2024-25.pdf';
}

/** Build the live Campbelltown City Council GPFS connector. */
export function createCampbelltownGpfsConnector(
  options: CampbelltownGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: CAMPBELLTOWN_GPFS_ID,
    name: CAMPBELLTOWN_GPFS_NAME,
    publisher: CAMPBELLTOWN_GPFS_PUBLISHER,
    source_url: CAMPBELLTOWN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CAMPBELLTOWN_GPFS_LICENSE,
    notes:
      "NSW council GPFS adapter: one council only (Campbelltown City Council), audited FY2024-25 General Purpose Financial Statements published as the official 'Financial Statements 2024-25' PDF linked from the council financial-information page. The connector discovers the PDF from the page's own link (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions or activities, Statement of Comprehensive Income and note B3-3 reconcile exactly. The income statement has no discontinued operation: total revenue $306,751k, total expenses $243,664k (printed B1-1 total = expenses excluding depreciation $204,374k + depreciation/amortisation/impairment $39,290k) and net result $63,087k. The printed B1-1 objective expense split is emitted as a separate service cut of the same total, never added to the nature-of-expense cut. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverCampbelltownGpfsDocument(fetchImpl, CAMPBELLTOWN_GPFS_FISCAL_YEAR, {
          listingHtml: options.listingHtml,
        }));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(encodeURI(discovered.url), { redirect: 'follow' });
        if (!response.ok) {
          throw new Error(
            `Campbelltown Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: CampbelltownGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: CAMPBELLTOWN_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Campbelltown City Council Financial Statements 2024-25 containing the audited FY2024-25 General Purpose Financial Statements and the independent auditor’s report; linked from the official council financial-information page and archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: CampbelltownGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: CAMPBELLTOWN_GPFS_REPORTING_URL,
      };
      const parsed = parseCampbelltownGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'campbelltown-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'campbelltown-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push(
            'raw entry is not a Campbelltown City Council GPFS measure; skipped',
          );
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
