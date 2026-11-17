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
  type UnitDetection,
} from './pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * Twenty-sixth NSW council GPFS adapter: Cumberland City Council's audited
 * General Purpose Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Canada Bay (§7.25) reference
 * implementations in docs/NSW_COUNCILS.md with a Cumberland layout adapter. It
 * is a separate source id (`cumberland-gpfs`) from every other source. Every row
 * is non-additive `agency_detail` with no region/LGA allocation, so it can never
 * be summed with the Dubbo budget rows, any existing council GPFS source, the
 * pre-existing federal/state/charity rows whose `delivery_entity` merely
 * mentions Cumberland, or any other council.
 *
 * Cumberland publishes a dedicated "Annual Financial Statements 2024-2025" PDF
 * on its official Key council reports page. The document contains the signed
 * General Purpose Financial Statements (Income Statement PDF p5 / printed p4;
 * Statement of Comprehensive Income PDF p6 / printed p5; B1-1 "Total functions
 * and activities" PDF p14-15 / printed p13-14; note B3-3 depreciation PDF p28 /
 * printed p27) and the independent auditor's reports on the financial statements.
 * The PDF URL is discovered from the official page (never hard-coded) and the
 * exact bytes are SHA-256 archived outside the repo. The printed `$ '000` unit
 * is required.
 *
 * The Income Statement prints the Original unaudited budget amount before each
 * line label in the PDF text stream and the FY2024-25 actual immediately after
 * it (followed by FY2023-24), so each emitted value is the first amount after the
 * printed label. The printed face-statement bridge is: expenses excluding
 * depreciation/amortisation/impairment ($193,611 thousand) plus depreciation,
 * amortisation and impairment ($48,954 thousand) = $242,565 thousand, which
 * equals printed total income ($277,139 thousand) less the printed operating
 * result ($34,574 thousand). The B1-1 "Total functions and activities" total row
 * prints income ($277,139), expenses ($242,564), operating result ($34,575) and
 * grants and contributions ($42,410 = operating $16,225 + capital $26,185); the
 * $1 thousand expense/result difference from the face statement is the printed
 * rounding of the function rows and is retained as reconciliation evidence.
 * The Statement of Comprehensive Income repeats the printed net result
 * ($34,574 thousand).
 *
 * Note B3-3 prints total depreciation and amortisation costs of $48,954 thousand
 * and total depreciation, amortisation and impairment for non-financial assets
 * of $48,954 thousand, so the face depreciation/amortisation/impairment line
 * equals the note total exactly.
 *
 * The printed before-capital result is a surplus of $8,389 thousand; it is kept
 * in the reconciliation evidence only and is not emitted as a row, the same
 * convention as Bayside (§7.21), Ryde (§7.23) and Canada Bay (§7.25).
 */

export const CUMBERLAND_GPFS_ID = 'cumberland-gpfs';
export const CUMBERLAND_GPFS_NAME =
  'Cumberland City Council — General Purpose Financial Statements';
export const CUMBERLAND_GPFS_PUBLISHER = 'Cumberland City Council';
export const CUMBERLAND_GPFS_REPORTING_URL =
  'https://www.cumberland.nsw.gov.au/key-council-reports';
export const CUMBERLAND_GPFS_FISCAL_YEAR = '2024-25';
export const CUMBERLAND_GPFS_SOURCE_DATASET = 'Cumberland City Council GPFS 2024-25';
export const CUMBERLAND_GPFS_LICENSE =
  '© Cumberland City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const CUMBERLAND_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const CUMBERLAND_GPFS_DELIVERY_ENTITY = 'Cumberland City Council';

export interface CumberlandGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The official Key council reports page the PDF was found on. */
  listing_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface CumberlandGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface CumberlandGpfsParseContext {
  document: CumberlandGpfsDocument;
  archive: CumberlandGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface CumberlandGpfsRejection {
  section: string;
  reason: string;
}

export type CumberlandGpfsSection = 'revenue' | 'expenses' | 'result';

export interface CumberlandGpfsLineSpec {
  key: string;
  label: string;
  section: CumberlandGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'B1-1 Functions or activities';
  /**
   * Index of the FY2024-25 actual among the printed amounts after the label.
   * Defaults to 0: the PDF text stream places the Original unaudited budget
   * amount before the line label and the FY2024-25 actual immediately after it,
   * followed by FY2023-24. (This differs from a naive visual row read.)
   */
  actual_index?: number;
  /** When set, a label occurrence followed by this text is not the printed line. */
  exclude_following?: string;
  /**
   * When set, read the last printed occurrence of the label rather than the
   * first. The expense subtotal embeds the phrase "depreciation, amortisation
   * and impairment of non-financial assets", so the actual depreciation line is
   * read from the standalone last occurrence on the Income Statement.
   */
  last_occurrence?: boolean;
}

/**
 * The printed Income Statement lines we emit. The seven revenue components sum
 * exactly to the printed total income. The five expense components sum exactly
 * to the printed "Total expenses ... excluding depreciation, amortisation and
 * impairment of non-financial assets" line, which with the printed depreciation
 * line forms the printed face-statement expense bridge. Total expenses is the
 * printed B1-1 "Total functions and activities" expense total, which equals that
 * face-statement bridge exactly. We do not emit the B1-1 function split.
 */
export const CUMBERLAND_GPFS_LINES: ReadonlyArray<CumberlandGpfsLineSpec> = [
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
    label: 'Total expenses from continuing operations (printed bridge)',
    section: 'expenses',
    statement: 'Income Statement',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
];

export const CUMBERLAND_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';
export const CUMBERLAND_GPFS_OPERATING_RESULT_LABEL = 'Operating result from continuing operations';
export const CUMBERLAND_GPFS_DEPRECIATION_NOTE_LABEL = 'Total depreciation and amortisation costs';
export const CUMBERLAND_GPFS_DEPRECIATION_IMPAIRMENT_NOTE_LABEL =
  'Total depreciation, amortisation and impairment for non-financial assets';

interface CumberlandGpfsLineValue {
  spec: CumberlandGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface CumberlandGpfsReconciliation {
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
  net_loss_from_disposal_of_assets: number;
  net_result: number;
  /** Printed continuing operating result; reconciliation evidence only. */
  operating_result: number;
  /** Printed before-capital result; reconciliation evidence only. */
  net_result_before_capital_grants: number;
  printed_total_expenses_excluding_depreciation: number;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  comprehensive_income_net_result: number;
  comprehensive_income_total: number;
  depreciation_note_total: number | null;
  depreciation_impairment_note_total: number | null;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface CumberlandGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: CumberlandGpfsReconciliation | null;
  warnings: string[];
  rejections: CumberlandGpfsRejection[];
}

// Note references include both dashed forms (B2-1, C1-6), which must not be
// mistaken for a printed amount.
const NOTE_REFERENCE = /\b[A-E]\d+(?:-\d+)?\b/g;
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
 * Convert a Cumberland annual-financial-statements link/text to a fiscal year.
 * On the official Key council reports page the FY2024-25 link is labelled
 * "Annual Financial Statements 2024-2025"; consecutive year ranges, "2024/25"
 * and June year-ends are handled. Anything that is not a consecutive year pair
 * is rejected.
 */
export function fiscalYearFromCumberlandGpfsLink(text: string): string | null {
  const normalizedText = text.replace(/[\u2010-\u2015\u2212]/g, '-');
  let decodedText = normalizedText;
  try {
    decodedText = decodeURIComponent(normalizedText);
  } catch {
    // Keep the raw text when a stray percent sign is not valid percent-encoding.
  }
  const june = /year\s+(?:ending|ended)\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
    decodedText.replace(/[-_]+/g, ' ').replace(/\s+/g, ' '),
  );
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  const normalized = normalizedText
    .replace(/\bto\b/gi, '-')
    .replace(/\s*[-/]+\s*/g, '-')
    .replace(/\s+/g, ' ');
  const match = /((?:19|20)\d{2})-((?:19|20)?\d{2})/.exec(normalized);
  if (!match) return null;
  const start = Number(match[1]);
  const endRaw = match[2]!;
  const end = endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
  if (end !== start + 1) return null;
  return `${start}-${String(end).slice(-2)}`;
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

export interface CumberlandGpfsReportPage {
  pdfUrl: string;
  title: string;
}

/**
 * Cumberland's own official site is the only host accepted for the financial
 * statements PDF. Any other host is rejected even if the anchor text matches.
 */
function isCumberlandDocumentHost(hostname: string): boolean {
  return /(^|\.)cumberland\.nsw\.gov\.au$/i.test(hostname);
}

/**
 * Discover the audited FY2024-25 financial statements from the official Key
 * council reports page. Cumberland publishes a dedicated "Annual Financial
 * Statements 2024-2025" PDF containing the signed General Purpose Financial
 * Statements and the independent auditor's reports; it also publishes an Annual
 * Report PDF, which is deliberately not selected. The link is parsed from the
 * page HTML, never guessed.
 */
export function parseCumberlandGpfsReportPage(
  html: string,
  baseUrl: string,
  fiscalYear: string = CUMBERLAND_GPFS_FISCAL_YEAR,
): CumberlandGpfsReportPage | null {
  for (const anchor of anchors(html)) {
    const haystack = `${anchor.text} ${anchor.title} ${anchor.href}`;
    if (!/financial\s+statements/i.test(`${anchor.text} ${anchor.title}`)) continue;
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    if (fiscalYearFromCumberlandGpfsLink(haystack) !== fiscalYear) continue;
    let url: URL;
    try {
      url = new URL(anchor.href, baseUrl);
    } catch {
      continue;
    }
    if (!isCumberlandDocumentHost(url.hostname)) continue;
    const rawTitle = (anchor.text || anchor.title)
      .split(/\s+PDF\b/i)[0]!
      .replace(/\s*\([^)]*\)\s*$/i, '')
      .replace(/\.pdf$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const baseTitle = rawTitle || 'Annual Financial Statements';
    return {
      pdfUrl: url.toString(),
      title: fiscalYearFromCumberlandGpfsLink(baseTitle) ? baseTitle : `${baseTitle} ${fiscalYear}`,
    };
  }
  return null;
}

export interface CumberlandGpfsDiscoveryOverrides {
  listingHtml?: string;
}

/** Discover the audited GPFS document from the live official page. */
export async function discoverCumberlandGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = CUMBERLAND_GPFS_FISCAL_YEAR,
  overrides: CumberlandGpfsDiscoveryOverrides = {},
): Promise<CumberlandGpfsDocument> {
  let listingHtml = overrides.listingHtml;
  let listingUrl = CUMBERLAND_GPFS_REPORTING_URL;
  if (listingHtml === undefined) {
    const response = await fetchImpl(CUMBERLAND_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Cumberland Key council reports listing fetch HTTP ${response.status} for ${CUMBERLAND_GPFS_REPORTING_URL}`,
      );
    }
    listingHtml = await response.text();
    listingUrl = response.url || listingUrl;
  }
  const page = parseCumberlandGpfsReportPage(listingHtml, listingUrl, fiscalYear);
  if (!page) {
    throw new Error(
      `Cumberland FY${fiscalYear} Key council reports listing has no official Annual Financial Statements PDF link; refusing to guess a document URL`,
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
export function detectCumberlandGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectCumberlandGpfsUnit([page.text]);
  const kind = unit.kind;
  if (!kind || unit.ambiguous) {
    throw new Error(
      `${section} p${page.page_number}: no unambiguous printed currency unit (${unit.reason}); refusing to guess`,
    );
  }
  return { kind, reason: unit.reason };
}

function firstMoneyToken(text: string): number | null {
  return nthMoneyToken(text, 0);
}

/** Read the first printed amount after a label (used where no budget column exists). */
function firstAmountAfter(text: string, label: string): number | null {
  const index = text.indexOf(label);
  if (index < 0) return null;
  return firstMoneyToken(text.slice(index + label.length));
}

function nthMoneyToken(text: string, index: number): number | null {
  const matches = text.match(MONEY_TOKEN) ?? [];
  const values: number[] = [];
  for (const token of matches) {
    const value = parseAmountCell(token)?.value ?? null;
    if (value !== null) values.push(value);
  }
  return values[index] ?? null;
}

/** Read all printed amounts after a label, in text order. */
function moneyTokensAfter(text: string, label: string): number[] {
  const index = text.indexOf(label);
  if (index < 0) return [];
  const matches = text.slice(index + label.length).match(MONEY_TOKEN) ?? [];
  const values: number[] = [];
  for (const token of matches) {
    const value = parseAmountCell(token)?.value ?? null;
    if (value !== null) values.push(value);
  }
  return values;
}

/**
 * Read the FY2024-25 actual printed amount after a label. The PDF text stream
 * places the Original unaudited budget amount before the line label and the
 * FY2024-25 actual immediately after it (then FY2023-24), so the actual is the
 * first amount after the printed label. When `excludeFollowing` is set, a label
 * occurrence immediately followed by that text is skipped: the Income Statement
 * prints "Operating result from continuing operations excluding ..." before the
 * plain "Operating result from continuing operations".
 */
function actualAmountAfter(
  text: string,
  label: string,
  excludeFollowing?: string,
  actualIndex = 0,
): number | null {
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(label, from);
    if (index < 0) return null;
    const rest = text.slice(index + label.length).trimStart();
    if (!excludeFollowing || !rest.startsWith(excludeFollowing)) {
      return nthMoneyToken(text.slice(index + label.length), actualIndex);
    }
    from = index + label.length;
  }
  return null;
}

/**
 * Read the last printed occurrence's FY2024-25 actual amount. The expense
 * subtotal embeds the phrase "depreciation, amortisation and impairment of
 * non-financial assets"; the actual depreciation line is the last occurrence on
 * the Income Statement.
 */
function lastActualAmountAfter(text: string, label: string, actualIndex = 0): number | null {
  const index = text.lastIndexOf(label);
  if (index < 0) return null;
  return nthMoneyToken(text.slice(index + label.length), actualIndex);
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

function lineValue(
  text: string,
  spec: CumberlandGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): CumberlandGpfsLineValue | null {
  const value = spec.last_occurrence
    ? lastActualAmountAfter(text, spec.label, spec.actual_index ?? 0)
    : actualAmountAfter(text, spec.label, spec.exclude_following, spec.actual_index ?? 0);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly CumberlandGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface CumberlandGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse B1-1 "Total functions and activities". Cumberland's B1-1 prints the
 * total row in text order: income 2025, income 2024, expenses 2025, expenses
 * 2024, operating result 2025, operating result 2024, grants 2025, grants 2024,
 * carrying amount 2025, carrying amount 2024. We read the 2025 values from the
 * printed total row (indices 0, 2, 4 and 6) and never sum the function rows.
 */
export function parseCumberlandGpfsFunctionsTotals(
  page: PdfPage,
): CumberlandGpfsFunctionsTotals | null {
  const values = moneyTokensAfter(normalizeText(page.text), 'Total functions and activities');
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

function gpfsFundingSource(spec: CumberlandGpfsLineSpec): string {
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

function printedLineLabel(spec: CumberlandGpfsLineSpec): string {
  return spec.label;
}

function notesFor(
  context: CumberlandGpfsParseContext,
  spec: CumberlandGpfsLineSpec,
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
    `printed_label: ${printedLineLabel(spec)}`,
    `unit: ${unit} (explicit; ${unitReason})`,
    `reconciliation: ${reconciliationNote}`,
    spec.key === 'total_expenses' || spec.key === 'net_result'
      ? 'human_spot_check: required — the printed B1-1 Total functions and activities expense total ($242,564 thousand) and operating result ($34,575 thousand) differ from the face-statement totals ($242,565 thousand and $34,574 thousand) by $1 thousand; a human must reconcile this published function-row rounding before the total expenses and net result are treated as final'
      : null,
    'the audited General Purpose Financial Statements for the year ended 30 June 2025 are published in the official Cumberland City Council Annual Financial Statements 2024-2025 PDF linked from the Key council reports page; the independent auditor’s reports on the financial statements are included in the same PDF; provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + document + line + fiscal year. */
export function cumberlandGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = CUMBERLAND_GPFS_FISCAL_YEAR,
): string {
  return `${CUMBERLAND_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: CumberlandGpfsLineValue,
  context: CumberlandGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: CUMBERLAND_GPFS_FISCAL_YEAR,
    source_id: CUMBERLAND_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: cumberlandGpfsNaturalKey(
      context.document.url,
      spec.key,
      CUMBERLAND_GPFS_FISCAL_YEAR,
    ),
    project_name: `Cumberland City Council GPFS 2024-25 — ${printedLineLabel(spec)}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: CUMBERLAND_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: CUMBERLAND_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: CUMBERLAND_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    extraction_confidence: 'high',
    gpfs_line_item: spec.key,
    gpfs_line_label: printedLineLabel(spec),
    gpfs_unit: gpfsUnitLabel(unit),
    gpfs_section: spec.section,
    gpfs_statement: spec.statement,
    ...(printedSign === 'negative' ? { gpfs_printed_sign: printedSign } : {}),
    ...(spec.component_of ? { gpfs_component_of: spec.component_of } : {}),
    ...(spec.potential_double_count ? { potential_double_count: true } : {}),
    notes: notesFor(context, spec, unit, unitReason, line.page_number, reconciliationNote),
  };
}

/**
 * Parse the audited GPFS into validated, non-additive measure rows. Nothing is
 * emitted unless the printed unit is explicit and every face-statement, B1-1
 * and Statement of Comprehensive Income reconciliation check passes exactly.
 */
export function parseCumberlandGpfsExtraction(
  extraction: PdfExtraction,
  context: CumberlandGpfsParseContext,
): CumberlandGpfsParseResult {
  const warnings: string[] = [];
  const rejections: CumberlandGpfsRejection[] = [];
  const reject = (reason: string): CumberlandGpfsParseResult => {
    rejections.push({ section: 'gpfs', reason });
    warnings.push(reason);
    return { records: [], reconciliation: null, warnings, rejections };
  };

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      !/Income Statement\s*[-–]/.test(text) &&
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
      text.includes('Total other comprehensive income'),
  );
  if (!comprehensivePage) {
    return reject(
      'Statement of Comprehensive Income page not found; no independent printed net-result check',
    );
  }
  const depreciationPage = findPage(extraction.pages, (_page, text) =>
    text.includes(CUMBERLAND_GPFS_DEPRECIATION_NOTE_LABEL),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: CumberlandGpfsFunctionsTotals | null;
  let comprehensiveNetResult: number | null;
  let comprehensiveTotal: number | null;
  let depreciationNoteTotal: number | null = null;
  let depreciationImpairmentNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseCumberlandGpfsFunctionsTotals(functionsPage);
    const comprehensiveText = normalizeText(comprehensivePage.text);
    comprehensiveNetResult = firstAmountAfter(comprehensiveText, 'from Income Statement');
    comprehensiveTotal = firstAmountAfter(
      comprehensiveText,
      'Total comprehensive income for the year attributable to Council',
    );
    if (depreciationPage) {
      const depreciationText = normalizeText(depreciationPage.text);
      depreciationNoteTotal = firstAmountAfter(
        depreciationText,
        CUMBERLAND_GPFS_DEPRECIATION_NOTE_LABEL,
      );
      depreciationImpairmentNoteTotal = firstAmountAfter(
        depreciationText,
        CUMBERLAND_GPFS_DEPRECIATION_IMPAIRMENT_NOTE_LABEL,
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
    return reject('B1-1 Total functions and activities row not found; no rows ingested');
  }
  if (comprehensiveNetResult === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed comprehensive-income net result; no rows ingested`,
    );
  }
  if (comprehensiveTotal === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed total comprehensive income; no rows ingested`,
    );
  }
  const unit = incomeUnit.kind;

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: CumberlandGpfsLineValue[] = [];
  for (const spec of CUMBERLAND_GPFS_LINES) {
    if (spec.key === 'total_expenses') continue;
    const line = lineValue(incomeText, spec, incomePage.page_number, errors);
    if (line) values.push(line);
  }
  if (errors.length > 0) return reject(errors.join('; '));

  const totalRevenue = lineByKey(values, 'total_revenue');
  const employee = lineByKey(values, 'employee_expenses');
  const depreciation = lineByKey(values, 'depreciation_amortisation_impairment');
  const grantsOperating = lineByKey(values, 'government_grants_operating');
  const grantsCapital = lineByKey(values, 'government_grants_capital');
  const netLossDisposal = lineByKey(values, 'net_loss_from_disposal_of_assets');
  const netResult = lineByKey(values, 'net_result');
  const expensesExDepreciation = lineByKey(values, 'total_expenses_excluding_depreciation');
  const rates = lineByKey(values, 'rates_and_annual_charges');
  const userCharges = lineByKey(values, 'user_charges_and_fees');
  const otherRevenues = lineByKey(values, 'other_revenues');
  const interest = lineByKey(values, 'interest_and_investment_income');
  const otherIncome = lineByKey(values, 'other_income');
  const materials = lineByKey(values, 'materials_and_services');
  const borrowing = lineByKey(values, 'borrowing_costs');
  const otherExpenses = lineByKey(values, 'other_expenses');
  const netResultBeforeCapital = actualAmountAfter(
    incomeText,
    CUMBERLAND_GPFS_BEFORE_CAPITAL_LABEL,
  );
  const operatingResult = actualAmountAfter(
    incomeText,
    CUMBERLAND_GPFS_OPERATING_RESULT_LABEL,
    'excluding',
  );

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['net_result', netResult],
    ['net_result_before_capital_grants', netResultBeforeCapital],
    ['operating_result', operatingResult],
    ['total_expenses_excluding_depreciation', expensesExDepreciation],
    ['rates_and_annual_charges', rates],
    ['user_charges_and_fees', userCharges],
    ['other_revenues', otherRevenues],
    ['interest_and_investment_income', interest],
    ['other_income', otherIncome],
    ['materials_and_services', materials],
    ['borrowing_costs', borrowing],
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
    employee! + materials! + borrowing! + otherExpenses! + netLossDisposal!;
  // Total expenses is the printed face-statement bridge (expenses excluding
  // depreciation plus depreciation/amortisation/impairment). It equals printed
  // total income less the printed operating result. The B1-1 "Total functions
  // and activities" expense total prints $1 thousand lower (242,564 vs 242,565)
  // because the function rows are rounded; that published rounding is retained
  // as evidence and never replaces the face-statement bridge.
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = faceExpenseBridge;

  const totalExpensesLine: CumberlandGpfsLineValue = {
    spec: CUMBERLAND_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
    value: totalExpenses,
    page_number: incomePage.page_number,
  };
  values.push(totalExpensesLine);

  const checks: string[] = [];
  const check = (label: string, expected: number, actual: number): void => {
    if (expected !== actual) {
      checks.push(`${label}: printed/derived ${actual} != expected ${expected}`);
    }
  };
  // B1-1 function rows are printed rounded to the nearest $1 thousand, so its
  // expense and operating-result totals may differ from the face statement by
  // exactly one unit. Anything larger rejects the extraction.
  const checkWithinOneThousand = (label: string, expected: number, actual: number): void => {
    if (Math.abs(expected - actual) > 1) {
      checks.push(`${label}: printed/derived ${actual} != expected ${expected} (tolerance 1)`);
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
    'printed total expenses excluding depreciation + printed depreciation = printed face total expenses',
    totalExpenses,
    faceExpenseBridge,
  );
  check(
    'printed total income - printed total expenses = printed operating result',
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
  checkWithinOneThousand(
    'B1-1 expenses = face total expenses (published $1k rounding)',
    totalExpenses,
    functionsTotals.expenses,
  );
  checkWithinOneThousand(
    'B1-1 operating result = face operating result (published $1k rounding)',
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
    netResult! + (comprehensiveTotal! - comprehensiveNetResult!),
  );
  if (depreciationNoteTotal !== null) {
    check(
      'note B3-3 total depreciation and amortisation costs = face depreciation/amortisation/impairment line',
      depreciation!,
      depreciationNoteTotal,
    );
  }
  if (depreciationImpairmentNoteTotal !== null) {
    check(
      'note B3-3 total depreciation, amortisation and impairment = face depreciation/amortisation/impairment line',
      depreciation!,
      depreciationImpairmentNoteTotal,
    );
  }
  if (depreciationNoteTotal === null) {
    checks.push('note B3-3 total depreciation and amortisation costs was not read');
  }
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: CumberlandGpfsReconciliation = {
    fiscal_year: CUMBERLAND_GPFS_FISCAL_YEAR,
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
    net_loss_from_disposal_of_assets: netLossDisposal!,
    net_result: netResult!,
    operating_result: operatingResult!,
    net_result_before_capital_grants: netResultBeforeCapital!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    functions_total_income: functionsTotals.income,
    functions_total_expenses: functionsTotals.expenses,
    functions_operating_result: functionsTotals.operating_result,
    functions_grants_and_contributions: functionsTotals.grants_and_contributions,
    comprehensive_income_net_result: comprehensiveNetResult!,
    comprehensive_income_total: comprehensiveTotal!,
    depreciation_note_total: depreciationNoteTotal,
    depreciation_impairment_note_total: depreciationImpairmentNoteTotal,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'printed revenue components sum exactly to the printed total income',
      'printed expense-by-nature components sum exactly to the printed expenses-excluding-depreciation line',
      'printed expenses excluding depreciation + printed depreciation/amortisation/impairment equals the printed face-statement total expenses',
      'printed total income - printed total expenses equals the printed operating result',
      'printed net result equals the printed operating result (no discontinued operations)',
      'printed net result - capital grants equals the printed before-capital result',
      'B1-1 income and grants reconcile exactly to the face statement; B1-1 expenses and operating result differ by exactly the published $1k function-row rounding',
      'B1-1 income - B1-1 expenses equals the printed B1-1 operating result',
      'Statement of Comprehensive Income net result equals the Income Statement net result',
      'Statement of Comprehensive Income total equals net result plus other comprehensive income',
      'note B3-3 total depreciation and amortisation costs equals the face depreciation/amortisation/impairment line',
      'note B3-3 total depreciation, amortisation and impairment equals the face depreciation/amortisation/impairment line',
      'the printed net result is positive and stored as a non-negative magnitude; the printed before-capital result is reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the printed face-statement bridge of expenses-excluding-depreciation (193,611) plus printed depreciation/amortisation/impairment (48,954) = 242,565, which equals printed total income (277,139) less the printed operating result (34,574); the printed B1-1 Total functions and activities totals are income 277,139, expenses 242,564 and operating result 34,575, a published $1k function-row rounding difference from the face statement retained as evidence; the printed net result (34,574) equals the printed operating result and is repeated in the Statement of Comprehensive Income; the printed before-capital result (8,389) equals printed net result less printed capital grants (26,185) and is reconciliation evidence only (not emitted); note B3-3 prints total depreciation and amortisation costs (48,954) and total depreciation, amortisation and impairment for non-financial assets (48,954), both equal to the face line; the printed revenue and expense components sum exactly to their printed subtotals and B1-1 grants reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed face-statement totals; published B1-1 $1k rounding retained as evidence`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface CumberlandGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: CumberlandGpfsDocument;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched discovery input; the connector still selects the official link. */
  listingHtml?: string;
}

function documentFilename(_url: string): string {
  // The publisher's CMS name can change; use the stable archive name so a
  // re-download never creates a second copy.
  return 'cumberland-city-council-annual-financial-statements-2024-25.pdf';
}

/** Build the live Cumberland City Council GPFS connector. */
export function createCumberlandGpfsConnector(
  options: CumberlandGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: CUMBERLAND_GPFS_ID,
    name: CUMBERLAND_GPFS_NAME,
    publisher: CUMBERLAND_GPFS_PUBLISHER,
    source_url: CUMBERLAND_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CUMBERLAND_GPFS_LICENSE,
    notes:
      "Twenty-sixth NSW council GPFS adapter: one council only (Cumberland City Council), audited FY2024-25 General Purpose Financial Statements published in the official 'Annual Financial Statements 2024-2025' PDF linked from the council's Key council reports page. The PDF includes the signed statements and the independent auditor's reports on the financial statements. The PDF is discovered from that official page (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-3 reconcile within the published $1k rounding. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed face-statement expenses-excluding-depreciation plus printed depreciation/amortisation/impairment bridge.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverCumberlandGpfsDocument(fetchImpl, CUMBERLAND_GPFS_FISCAL_YEAR, {
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
            `Cumberland City Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: CumberlandGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: CUMBERLAND_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Cumberland City Council Annual Financial Statements 2024-2025 containing the audited FY2024-25 General Purpose Financial Statements; linked from the official Key council reports page and archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: CumberlandGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: CUMBERLAND_GPFS_REPORTING_URL,
      };
      const parsed = parseCumberlandGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'cumberland-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'cumberland-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Cumberland City Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
