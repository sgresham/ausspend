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
 * Thirty-second NSW council GPFS adapter: Hawkesbury City Council's audited
 * General Purpose Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Lane Cove (§7.31) reference
 * implementations in docs/NSW_COUNCILS.md. It is a separate source id
 * (`hawkesbury-gpfs`) from every other source. Every row is non-additive
 * `agency_detail` with no region/LGA allocation, so it is never summed with the
 * Dubbo budget rows, any existing council GPFS source, the pre-existing
 * federal/state/charity rows whose `delivery_entity` mentions Hawkesbury, or any
 * other council.
 *
 * Hawkesbury's official "Financial Statement" page redirects to the latest
 * standalone audited GPFS PDF. The site returns HTTP 403 to non-browser clients
 * behind a Cloudflare challenge, so the documented headless Chromium path loads
 * the page and downloads the exact bytes; the connector discovers the PDF URL
 * from the page's own `self.location = '…pdf'` redirect (never a hard-coded
 * document URL) and re-verifies the exact bytes by SHA-256.
 *
 * The PDF is the standalone FY2024-25 General Purpose Financial Statements. It
 * prints the Income Statement (PDF p6), Statement of Comprehensive Income (p7),
 * the B1-1 "Functions or activities" note (p16) and note B3-4 depreciation
 * (p31). The printed unit is an explicit `$ '000`.
 *
 * FY2024-25 has a material discontinued operation (the sewer business). The
 * continuing operations print total income $230,424 thousand and total expenses
 * $130,704 thousand (the printed B1-1 figure, equal to the face bridge of
 * expenses excluding depreciation $101,359 thousand plus depreciation $29,345
 * thousand), giving a continuing operating result of $99,720 thousand. The
 * discontinued operation prints a $(153,870) thousand result, so the statutory
 * "Net operating result for the year attributable to Council" is $(54,150)
 * thousand. Both printed result lines are emitted so the statutory net result
 * bridges explicitly; total revenue and total expenses remain the printed
 * **continuing-operations** totals, not a mixed continuing-plus-discontinued
 * figure. The printed before-capital result ($(137,399) thousand) includes the
 * discontinued operation and a $102 thousand grant reclassification, so it is
 * not used as a simple net-result-minus-capital-grants check.
 */

export const HAWKESBURY_GPFS_ID = 'hawkesbury-gpfs';
export const HAWKESBURY_GPFS_NAME =
  'Hawkesbury City Council — General Purpose Financial Statements';
export const HAWKESBURY_GPFS_PUBLISHER = 'Hawkesbury City Council';
export const HAWKESBURY_GPFS_REPORTING_URL =
  'https://www.hawkesbury.nsw.gov.au/your-council/corporate-publications/financial-statement';
export const HAWKESBURY_GPFS_FISCAL_YEAR = '2024-25';
export const HAWKESBURY_GPFS_SOURCE_DATASET = 'Hawkesbury City Council GPFS 2024-25';
export const HAWKESBURY_GPFS_LICENSE =
  '© Hawkesbury City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const HAWKESBURY_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const HAWKESBURY_GPFS_DELIVERY_ENTITY = 'Hawkesbury City Council';

export interface HawkesburyGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The official Financial Statement page the PDF was found on. */
  listing_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface HawkesburyGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface HawkesburyGpfsParseContext {
  document: HawkesburyGpfsDocument;
  archive: HawkesburyGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface HawkesburyGpfsRejection {
  section: string;
  reason: string;
}

export type HawkesburyGpfsSection = 'revenue' | 'expenses' | 'result';

export interface HawkesburyGpfsLineSpec {
  key: string;
  label: string;
  section: HawkesburyGpfsSection;
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
 * The printed Income Statement lines we emit. The seven revenue components sum
 * exactly to the printed total income from continuing operations. The five
 * non-nil expense components sum exactly to the printed "Total expenses ...
 * excluding depreciation, amortisation and impairment of non-financial assets"
 * line, which with the printed depreciation line forms the printed
 * face-statement expense bridge. Total expenses is the printed B1-1 "Total
 * functions and activities" expense total, which equals that bridge exactly. The
 * two printed result lines (continuing operations and discontinued operations)
 * are both emitted so the statutory net result bridges explicitly.
 */
export const HAWKESBURY_GPFS_LINES: ReadonlyArray<HawkesburyGpfsLineSpec> = [
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
    key: 'operating_result_continuing',
    label: 'Operating result from continuing operations',
    section: 'result',
    component_of: 'net_result',
    statement: 'Income Statement',
  },
  {
    key: 'discontinued_operations_result',
    label: 'Operating result from discontinued operations',
    section: 'result',
    component_of: 'net_result',
    statement: 'Income Statement',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
];

export const HAWKESBURY_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL =
  'Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets';
export const HAWKESBURY_GPFS_COMPREHENSIVE_NET_RESULT_LABEL =
  'Net operating result for the year from Income Statement';
export const HAWKESBURY_GPFS_OCI_LABEL = 'Total other comprehensive income for the year';
export const HAWKESBURY_GPFS_COMPREHENSIVE_TOTAL_LABEL =
  'Total comprehensive income for the year attributable to Council';
export const HAWKESBURY_GPFS_DEPRECIATION_NOTE_LABEL =
  'Total depreciation, amortisation and impairment of non-financial assets';

interface HawkesburyGpfsLineValue {
  spec: HawkesburyGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface HawkesburyGpfsReconciliation {
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
  discontinued_operations_result: number;
  net_result: number;
  /** Printed continuing result before depreciation; reconciliation evidence only. */
  operating_result_excluding_depreciation: number;
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

export interface HawkesburyGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: HawkesburyGpfsReconciliation | null;
  warnings: string[];
  rejections: HawkesburyGpfsRejection[];
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
 * Convert a Hawkesbury PDF filename or link text to a fiscal year. The
 * standalone statements filename prints "...Ended-30-June-2025"; consecutive
 * year ranges and June year-ends are handled. Anything that is not a
 * consecutive year pair is rejected.
 */
export function fiscalYearFromHawkesburyGpfsLink(text: string): string | null {
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

export interface HawkesburyGpfsReportPage {
  pdfUrl: string;
  title: string;
}

/**
 * Hawkesbury's own site is the only host accepted for the financial-statements
 * PDF. Any other host is rejected even if the redirect text matches.
 */
function isHawkesburyDocumentHost(hostname: string): boolean {
  return /(^|\.)hawkesbury\.nsw\.gov\.au$/i.test(hostname);
}

/**
 * Discover the audited FY2024-25 financial-statements PDF from the official
 * "Financial Statement" page. The page carries a small
 * `setTimeout("self.location = '<pdf>'", 500)` redirect to the latest statement;
 * that URL is parsed from the page HTML, never guessed.
 */
export function parseHawkesburyGpfsReportPage(
  html: string,
  baseUrl: string,
  fiscalYear: string = HAWKESBURY_GPFS_FISCAL_YEAR,
): HawkesburyGpfsReportPage | null {
  const candidates: string[] = [];
  const redirect = /self\.location\s*=\s*['"]([^'"]+\.pdf)['"]/gi;
  let match: RegExpExecArray | null;
  while ((match = redirect.exec(html)) !== null) candidates.push(match[1]!);
  // Also accept a direct PDF href, in case the page markup changes.
  const href = /href="([^"]+\.pdf)"/gi;
  while ((match = href.exec(html)) !== null) candidates.push(match[1]!);

  for (const candidate of candidates) {
    const decoded = decodeHtml(candidate);
    let url: URL;
    try {
      url = new URL(decoded, baseUrl);
    } catch {
      continue;
    }
    if (!isHawkesburyDocumentHost(url.hostname)) continue;
    if (fiscalYearFromHawkesburyGpfsLink(url.pathname) !== fiscalYear) continue;
    return {
      pdfUrl: url.toString(),
      title: `Hawkesbury City Council Financial Statements ${fiscalYear} (General Purpose Financial Statements)`,
    };
  }
  return null;
}

export interface HawkesburyGpfsDiscoveryOverrides {
  listingHtml?: string;
}

/** Discover the audited GPFS document from the official page HTML. */
export async function discoverHawkesburyGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = HAWKESBURY_GPFS_FISCAL_YEAR,
  overrides: HawkesburyGpfsDiscoveryOverrides = {},
): Promise<HawkesburyGpfsDocument> {
  let listingHtml = overrides.listingHtml;
  let listingUrl = HAWKESBURY_GPFS_REPORTING_URL;
  if (listingHtml === undefined) {
    const response = await fetchImpl(HAWKESBURY_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Hawkesbury Financial Statement page fetch HTTP ${response.status} for ${HAWKESBURY_GPFS_REPORTING_URL}; the site returns HTTP 403 to non-browser clients — use the documented headless Chromium path (scripts/hawkesbury-gpfs-browser.ts)`,
      );
    }
    listingHtml = await response.text();
    listingUrl = response.url || listingUrl;
  }
  const page = parseHawkesburyGpfsReportPage(listingHtml, listingUrl, fiscalYear);
  if (!page) {
    throw new Error(
      `Hawkesbury FY${fiscalYear} Financial Statement page has no official statements PDF redirect for that year; refusing to guess a document URL`,
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
export function detectHawkesburyGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectHawkesburyGpfsUnit([page.text]);
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
 * Reconstruct printed rows from PDF text-item coordinates. Hawkesbury prints a
 * row's label and its three amounts on the same printed line, so grouping by y
 * and sorting by x recovers the printed table. The Actual 2025 column is
 * isolated by its x band (the note column sits left of it, the prior-year column
 * right of it).
 */
export function buildHawkesburyRows(page: PdfPage): PrintedRow[] {
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
export function findHawkesburyLine(
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
  spec: HawkesburyGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): HawkesburyGpfsLineValue | null {
  const found = findHawkesburyLine(rows, spec.label, spec.last_occurrence ?? false);
  if (!found) {
    errors.push(`p${pageNumber}: could not read printed row for "${spec.label}"`);
    return null;
  }
  return { spec, value: found.actual, page_number: pageNumber };
}

function lineByKey(values: readonly HawkesburyGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface HawkesburyGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse the B1-1 "Total functions and activities" total row. Hawkesbury prints
 * the total row as a normal table line: the label and the ten amounts (five
 * column pairs) share its y coordinate. We collect the money items in the
 * label's y band, sort them by x and read the FY2024-25 values at indices 0, 2,
 * 4 and 6 (income, expenses, operating result, grants). We never sum the
 * function rows.
 */
export function parseHawkesburyGpfsFunctionsTotals(page: PdfPage): HawkesburyGpfsFunctionsTotals {
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

function gpfsFundingSource(spec: HawkesburyGpfsLineSpec): string {
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
  context: HawkesburyGpfsParseContext,
  spec: HawkesburyGpfsLineSpec,
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
    'the audited General Purpose Financial Statements for the year ended 30 June 2025 are the official Hawkesbury City Council standalone Financial Statements PDF linked from the council Financial Statement page; the independent auditor’s reports on the financial statements are included in the same PDF; provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + exact-document SHA-256 + line + fiscal year. */
export function hawkesburyGpfsNaturalKey(
  documentIdentity: string,
  lineItem: string,
  fiscalYear: string = HAWKESBURY_GPFS_FISCAL_YEAR,
): string {
  return `${HAWKESBURY_GPFS_ID}:${createHash('sha256')
    .update(`${documentIdentity}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: HawkesburyGpfsLineValue,
  context: HawkesburyGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: HAWKESBURY_GPFS_FISCAL_YEAR,
    source_id: HAWKESBURY_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: hawkesburyGpfsNaturalKey(
      context.archive.sha256,
      spec.key,
      HAWKESBURY_GPFS_FISCAL_YEAR,
    ),
    project_name: `Hawkesbury City Council GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: HAWKESBURY_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: HAWKESBURY_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: HAWKESBURY_GPFS_DATA_QUALITY_FLAG,
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
export function parseHawkesburyGpfsExtraction(
  extraction: PdfExtraction,
  context: HawkesburyGpfsParseContext,
): HawkesburyGpfsParseResult {
  const warnings: string[] = [];
  const rejections: HawkesburyGpfsRejection[] = [];
  const reject = (reason: string): HawkesburyGpfsParseResult => {
    rejections.push({ section: 'gpfs', reason });
    warnings.push(reason);
    return { records: [], reconciliation: null, warnings, rejections };
  };

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Net operating result for the year attributable to Council') &&
      text.includes('Operating result from discontinued operations'),
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
    text.includes(HAWKESBURY_GPFS_DEPRECIATION_NOTE_LABEL),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: HawkesburyGpfsFunctionsTotals;
  let comprehensiveNetResult: number | null;
  let comprehensiveOther: number | null;
  let comprehensiveTotal: number | null;
  let depreciationImpairmentNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseHawkesburyGpfsFunctionsTotals(functionsPage);
    const comprehensiveRows = buildHawkesburyRows(comprehensivePage);
    comprehensiveNetResult =
      findHawkesburyLine(comprehensiveRows, HAWKESBURY_GPFS_COMPREHENSIVE_NET_RESULT_LABEL)
        ?.numbers[0] ?? null;
    comprehensiveOther =
      findHawkesburyLine(comprehensiveRows, HAWKESBURY_GPFS_OCI_LABEL)?.numbers[0] ?? null;
    comprehensiveTotal =
      findHawkesburyLine(comprehensiveRows, HAWKESBURY_GPFS_COMPREHENSIVE_TOTAL_LABEL)
        ?.numbers[0] ?? null;
    if (depreciationPage) {
      const depreciationRows = buildHawkesburyRows(depreciationPage);
      depreciationImpairmentNoteTotal =
        findHawkesburyLine(depreciationRows, HAWKESBURY_GPFS_DEPRECIATION_NOTE_LABEL)?.numbers[0] ??
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

  const incomeRows = buildHawkesburyRows(incomePage);
  const errors: string[] = [];
  const values: HawkesburyGpfsLineValue[] = [];
  for (const spec of HAWKESBURY_GPFS_LINES) {
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
  const netLossDisposal = lineByKey(values, 'net_loss_from_disposal_of_assets');
  const operatingResultContinuing = lineByKey(values, 'operating_result_continuing');
  const discontinuedOperationsResult = lineByKey(values, 'discontinued_operations_result');
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
    findHawkesburyLine(incomeRows, HAWKESBURY_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL)
      ?.actual ?? null;

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['borrowing_costs', borrowingCosts],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['operating_result_continuing', operatingResultContinuing],
    ['discontinued_operations_result', discontinuedOperationsResult],
    ['net_result', netResult],
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

  const totalExpensesLine: HawkesburyGpfsLineValue = {
    spec: HAWKESBURY_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
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
    'printed continuing operating result + printed discontinued-operations result = printed net result',
    netResult!,
    operatingResultContinuing! + discontinuedOperationsResult!,
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
    'Statement of Comprehensive Income net result = Income Statement statutory net result',
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
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: HawkesburyGpfsReconciliation = {
    fiscal_year: HAWKESBURY_GPFS_FISCAL_YEAR,
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
    discontinued_operations_result: discontinuedOperationsResult!,
    net_result: netResult!,
    operating_result_excluding_depreciation: operatingResultExcludingDepreciation!,
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
      'printed revenue components sum exactly to the printed total income from continuing operations',
      'printed expense-by-nature components sum exactly to the printed expenses-excluding-depreciation line',
      'printed expenses excluding depreciation + printed depreciation/amortisation/impairment equals the printed B1-1 total expenses',
      'printed total income - printed expenses excluding depreciation equals the printed continuing operating result excluding depreciation',
      'printed total income - printed B1-1 total expenses equals the printed continuing operating result',
      'printed continuing operating result + printed discontinued-operations result equals the printed statutory net result',
      'B1-1 income, expenses, operating result and grants reconcile exactly to the continuing face statement',
      'B1-1 income - B1-1 expenses equals the printed B1-1 operating result',
      'Statement of Comprehensive Income net result equals the Income Statement statutory net result',
      'Statement of Comprehensive Income total equals net result plus other comprehensive income',
      'note B3-4 total depreciation, amortisation and impairment equals the face depreciation/amortisation/impairment line',
      'total expenses is the printed B1-1 Total functions and activities figure for continuing operations, never derived by summing components',
    ],
  };

  const reconciliationNote = `total revenue and total expenses are the printed continuing-operations totals: total income (${formatThousands(totalRevenue!)} thousand) and the printed B1-1 Total functions and activities expense total (${formatThousands(totalExpenses)} thousand), which equals the printed face-statement bridge of expenses-excluding-depreciation (${formatThousands(expensesExDepreciation!)} thousand) plus printed depreciation/amortisation/impairment (${formatThousands(depreciation!)} thousand), and equals printed total income less the printed continuing operating result (${formatThousands(operatingResultContinuing!)} thousand); the printed discontinued-operations result (${formatThousands(discontinuedOperationsResult!)} thousand) is a separate printed line, so the statutory net operating result attributable to Council (${formatThousands(netResult!)} thousand) equals the continuing operating result plus the discontinued-operations result and is repeated in the Statement of Comprehensive Income; the printed before-capital result is not used as a simple net-result-minus-capital-grants bridge because it contains the discontinued operation and a $102 thousand grant reclassification; note B3-4 prints total depreciation, amortisation and impairment for non-financial assets (${depreciationImpairmentNoteTotal === null ? 'not read' : formatThousands(depreciationImpairmentNoteTotal)} thousand), equal to the face line`;

  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: continuing revenue ${totalRevenue} and expenses ${totalExpenses}, statutory net result ${netResult} ($'000) to the printed face-statement/B1-1 totals`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface HawkesburyGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: HawkesburyGpfsDocument;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched discovery input; the connector still selects the official link. */
  listingHtml?: string;
}

function documentFilename(_url: string): string {
  // The publisher's CMS name can change; use the stable archive name so a
  // re-download never creates a second copy.
  return 'hawkesbury-city-council-financial-statements-2024-25.pdf';
}

/** Build the live Hawkesbury City Council GPFS connector. */
export function createHawkesburyGpfsConnector(
  options: HawkesburyGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: HAWKESBURY_GPFS_ID,
    name: HAWKESBURY_GPFS_NAME,
    publisher: HAWKESBURY_GPFS_PUBLISHER,
    source_url: HAWKESBURY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: HAWKESBURY_GPFS_LICENSE,
    notes:
      "Thirty-second NSW council GPFS adapter: one council only (Hawkesbury City Council), audited FY2024-25 General Purpose Financial Statements published as the official standalone Financial Statements PDF linked from the council Financial Statement page. The site returns HTTP 403 to non-browser clients, so the documented headless Chromium path loads it; the connector discovers the PDF from the page's own self.location redirect (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-4 reconcile exactly. FY2024-25 has a material discontinued operation (sewer business): total revenue and total expenses are the printed continuing-operations totals, and the printed continuing and discontinued result lines are both emitted so the statutory net result bridges explicitly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverHawkesburyGpfsDocument(fetchImpl, HAWKESBURY_GPFS_FISCAL_YEAR, {
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
            `Hawkesbury Council GPFS fetch HTTP ${response.status} for ${discovered.url}; the site returns HTTP 403 to non-browser clients — use the documented headless Chromium path (scripts/hawkesbury-gpfs-browser.ts)`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: HawkesburyGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: HAWKESBURY_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Hawkesbury City Council Financial Statements for the year ended 30 June 2025 containing the audited FY2024-25 General Purpose Financial Statements; linked from the official Financial Statement page and archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: HawkesburyGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: HAWKESBURY_GPFS_REPORTING_URL,
      };
      const parsed = parseHawkesburyGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'hawkesbury-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'hawkesbury-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Hawkesbury City Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
