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
} from '../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import type { Connector, RawRecord } from '../types.js';

/**
 * Seventeenth NSW council GPFS adapter: Shellharbour City Council's audited
 * General Purpose Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Shoalhaven (§7.16) reference
 * implementations in docs/NSW_COUNCILS.md with a Shellharbour-specific layout
 * adapter. It is a separate source id (`shellharbour-gpfs`) from every other
 * source. Every row is non-additive `agency_detail` with no region/LGA
 * allocation, so it can never be summed with the Dubbo budget rows, any existing
 * council GPFS source, the pre-existing federal/state/charity rows whose
 * `delivery_entity` merely mentions Shellharbour, or any other council.
 *
 * The PDF URL is discovered from the council's official "Annual reports" page
 * (never a hard-coded document URL): that page links the "Annual Report 2024 -
 * 2025" page, which links the council-hosted annual-report PDF and an "Audited
 * Financial Statements for year ending 30 June 2025" section. The audited
 * financial statements are the section of that official annual-report PDF
 * (Income Statement printed p5 of 84 / PDF p54). The exact bytes are SHA-256
 * archived outside the repo. The printed `$ '000` unit is required.
 *
 * The Income Statement prints the Original unaudited budget column before each
 * line label, so each emitted value is the first amount after the printed label
 * (the FY2024-25 actual). It does not print a combined "Total expenses" line;
 * total expenses is the printed B1-1 "Total functions and activities" expense
 * total ($236,395 thousand), which equals the printed expenses-excluding-
 * depreciation line ($206,611 thousand) plus the printed depreciation,
 * amortisation and impairment line ($29,784 thousand) and equals printed total
 * income ($310,293 thousand) less the printed operating result ($73,898
 * thousand). The Statement of Comprehensive Income repeats the printed net
 * result ($73,898 thousand). Those top-level printed totals reconcile exactly
 * and are the defensible totals.
 */

export const SHELLHARBOUR_GPFS_ID = 'shellharbour-gpfs';
export const SHELLHARBOUR_GPFS_NAME =
  'Shellharbour City Council — General Purpose Financial Statements';
export const SHELLHARBOUR_GPFS_PUBLISHER = 'Shellharbour City Council';
export const SHELLHARBOUR_GPFS_REPORTING_URL =
  'https://www.shellharbour.nsw.gov.au/council/news-and-publications/annual-reports';
export const SHELLHARBOUR_GPFS_FISCAL_YEAR = '2024-25';
export const SHELLHARBOUR_GPFS_SOURCE_DATASET = 'Shellharbour City Council GPFS 2024-25';
export const SHELLHARBOUR_GPFS_LICENSE =
  '© Shellharbour City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const SHELLHARBOUR_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const SHELLHARBOUR_GPFS_DELIVERY_ENTITY = 'Shellharbour City Council';

export interface ShellharbourGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The official "Annual reports" index the annual-report page was found on. */
  listing_url?: string;
  /** The official "Annual Report 2024 - 2025" page the PDF link was found on. */
  report_page_url?: string;
  /** The page's "Audited Financial Statements" section link, for provenance. */
  audited_statements_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface ShellharbourGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface ShellharbourGpfsParseContext {
  document: ShellharbourGpfsDocument;
  archive: ShellharbourGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface ShellharbourGpfsRejection {
  section: string;
  reason: string;
}

export type ShellharbourGpfsSection = 'revenue' | 'expenses' | 'result';

export interface ShellharbourGpfsLineSpec {
  key: string;
  label: string;
  section: ShellharbourGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'Income Statement (printed B1-1 total)';
  /** When set, a label occurrence followed by this text is not the printed line. */
  exclude_following?: string;
  /**
   * When set, read the last printed occurrence of the label rather than the
   * first. The expense subtotal and the "operating result excluding
   * depreciation" lines both embed the phrase "depreciation, amortisation and
   * impairment of non-financial assets", so the actual depreciation line is the
   * last occurrence on the Income Statement.
   */
  last_occurrence?: boolean;
}

/**
 * The printed Income Statement lines we emit. The seven revenue components sum
 * exactly to the printed total revenue. The five expense-by-nature components
 * sum exactly to the printed "Total expenses ... excluding depreciation,
 * amortisation and impairment of non-financial assets" line, which with the
 * printed depreciation line bridges to the printed B1-1 expense total. We do not
 * emit the B1-1 function split: it is used only for the printed B1-1 operating-
 * result, grants and income/expense checks. The printed net loss from the
 * disposal of assets is a real printed expense line and is emitted. The printed
 * net result is positive, so no sign marker is needed.
 */
export const SHELLHARBOUR_GPFS_LINES: ReadonlyArray<ShellharbourGpfsLineSpec> = [
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
    label: 'Interest and investment revenue',
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
    label:
      'Total expenses from continuing operations (printed B1-1 total; equals printed expenses excluding depreciation plus printed depreciation)',
    section: 'expenses',
    statement: 'Income Statement (printed B1-1 total)',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
];

export const SHELLHARBOUR_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';
export const SHELLHARBOUR_GPFS_OPERATING_RESULT_LABEL =
  'Operating result from continuing operations';
export const SHELLHARBOUR_GPFS_DEPRECIATION_NOTE_LABEL =
  'Total depreciation and amortisation costs';
export const SHELLHARBOUR_GPFS_AUDITED_STATEMENTS_TEXT =
  'Audited Financial Statements for year ending 30 June 2025';

interface ShellharbourGpfsLineValue {
  spec: ShellharbourGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface ShellharbourGpfsReconciliation {
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
  /** Printed before-capital result; reconciliation evidence only, never a stored row. */
  net_result_before_capital_grants: number;
  printed_total_expenses_excluding_depreciation: number;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  comprehensive_income_net_result: number;
  depreciation_note_total: number | null;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface ShellharbourGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: ShellharbourGpfsReconciliation | null;
  warnings: string[];
  rejections: ShellharbourGpfsRejection[];
}

// Note references include both dashed forms (B2-1, C1-7), which must not be
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
 * Convert a Shellharbour annual-report link/text to a fiscal year. The index
 * labels the audited year "2024 to 2025"; the annual-report page uses
 * "2024 - 2025" and the financial-statements section is "year ending 30 June
 * 2025". Consecutive year ranges and June year-ends are handled; anything that
 * is not a consecutive year pair is rejected.
 */
export function fiscalYearFromShellharbourGpfsLink(text: string): string | null {
  const normalizedText = text.replace(/[\u2010-\u2015\u2212]/g, '-');
  const june = /year\s+ending\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
    normalizedText.replace(/[-_]+/g, ' ').replace(/\s+/g, ' '),
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
}

function anchors(html: string): Anchor[] {
  const out: Anchor[] = [];
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const attrs = match[1]!;
    const hrefMatch = /href="([^"]+)"/i.exec(attrs);
    if (!hrefMatch) continue;
    out.push({ href: hrefMatch[1]!, text: decodeHtml(match[2]!) });
  }
  return out;
}

/**
 * Discover the official "Annual Report 2024 - 2025" page from the live "Annual
 * reports" index. The link is selected by its printed text/href and year, never
 * from a hard-coded document URL.
 */
export function parseShellharbourGpfsAnnualReportLink(
  html: string,
  baseUrl: string,
  fiscalYear: string = SHELLHARBOUR_GPFS_FISCAL_YEAR,
): string | null {
  for (const anchor of anchors(html)) {
    const href = anchor.href;
    if (!/annual-report/i.test(href)) continue;
    if (fiscalYearFromShellharbourGpfsLink(`${href} ${anchor.text}`) !== fiscalYear) continue;
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
}

export interface ShellharbourGpfsReportPage {
  pdfUrl: string;
  title: string;
  auditedStatementsUrl: string | null;
}

/**
 * Discover the council-hosted annual-report PDF and the audited-statements
 * section link from the official annual-report page. The PDF must sit on the
 * council's official host; the URL is parsed from the page HTML, never guessed.
 */
export function parseShellharbourGpfsReportPage(
  html: string,
  baseUrl: string,
  fiscalYear: string = SHELLHARBOUR_GPFS_FISCAL_YEAR,
): ShellharbourGpfsReportPage | null {
  let auditedStatementsUrl: string | null = null;
  for (const anchor of anchors(html)) {
    if (/audited\s+financial\s+statements/i.test(anchor.text)) {
      try {
        auditedStatementsUrl = new URL(anchor.href, baseUrl).toString();
      } catch {
        // Keep the PDF selection below independent of this provenance link.
      }
      break;
    }
  }
  for (const anchor of anchors(html)) {
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    if (!/annual\s+report/i.test(anchor.text)) continue;
    if (fiscalYearFromShellharbourGpfsLink(`${anchor.href} ${anchor.text}`) !== fiscalYear)
      continue;
    let url: URL;
    try {
      url = new URL(anchor.href, baseUrl);
    } catch {
      continue;
    }
    if (!/(^|\.)shellharbour\.nsw\.gov\.au$/i.test(url.hostname)) continue;
    return {
      pdfUrl: url.toString(),
      title: anchor.text.trim() || `Annual Report ${fiscalYear}`,
      auditedStatementsUrl,
    };
  }
  return null;
}

export interface ShellharbourGpfsDiscoveryOverrides {
  indexHtml?: string;
  reportPageHtml?: string;
}

/** Discover the audited GPFS document from the live official pages. */
export async function discoverShellharbourGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = SHELLHARBOUR_GPFS_FISCAL_YEAR,
  overrides: ShellharbourGpfsDiscoveryOverrides = {},
): Promise<ShellharbourGpfsDocument> {
  let indexHtml = overrides.indexHtml;
  let listingUrl = SHELLHARBOUR_GPFS_REPORTING_URL;
  if (indexHtml === undefined) {
    const response = await fetchImpl(SHELLHARBOUR_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Shellharbour City Council annual reports page fetch HTTP ${response.status} for ${SHELLHARBOUR_GPFS_REPORTING_URL}`,
      );
    }
    indexHtml = await response.text();
    listingUrl = response.url || listingUrl;
  }
  const reportPageUrl = parseShellharbourGpfsAnnualReportLink(indexHtml, listingUrl, fiscalYear);
  if (!reportPageUrl) {
    throw new Error(
      `Shellharbour City Council annual reports page has no FY${fiscalYear} annual-report link; refusing to guess a document URL`,
    );
  }

  let reportPageHtml = overrides.reportPageHtml;
  if (reportPageHtml === undefined) {
    const response = await fetchImpl(reportPageUrl, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Shellharbour City Council annual-report page fetch HTTP ${response.status} for ${reportPageUrl}`,
      );
    }
    reportPageHtml = await response.text();
  }
  const page = parseShellharbourGpfsReportPage(reportPageHtml, reportPageUrl, fiscalYear);
  if (!page) {
    throw new Error(
      `Shellharbour City Council FY${fiscalYear} annual-report page has no official annual-report PDF link; refusing to guess a document URL`,
    );
  }
  return {
    id: `gpfs-${fiscalYear}`,
    title: page.title,
    url: page.pdfUrl,
    fiscal_year: fiscalYear,
    listing_url: listingUrl,
    report_page_url: reportPageUrl,
    ...(page.auditedStatementsUrl ? { audited_statements_url: page.auditedStatementsUrl } : {}),
  };
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectShellharbourGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectShellharbourGpfsUnit([page.text]);
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

function firstMoneyToken(text: string): number | null {
  const matches = text.match(MONEY_TOKEN) ?? [];
  for (const token of matches) {
    const value = parseAmountCell(token)?.value ?? null;
    if (value !== null) return value;
  }
  return null;
}

/**
 * Read the first printed amount after a label. When `excludeFollowing` is set, a
 * label occurrence immediately followed by that text is skipped: the Income
 * Statement prints "Operating result from continuing operations excluding ..."
 * before the plain "Operating result from continuing operations".
 */
function firstAmountAfter(text: string, label: string, excludeFollowing?: string): number | null {
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(label, from);
    if (index < 0) return null;
    const rest = text.slice(index + label.length).trimStart();
    if (!excludeFollowing || !rest.startsWith(excludeFollowing)) {
      return firstMoneyToken(text.slice(index + label.length));
    }
    from = index + label.length;
  }
  return null;
}

/**
 * Read the last printed amount after a label. The expense subtotal and the
 * "operating result excluding depreciation" line both embed the phrase
 * "depreciation, amortisation and impairment of non-financial assets"; the
 * actual depreciation line is the last occurrence on the Income Statement.
 */
function lastAmountAfter(text: string, label: string): number | null {
  const index = text.lastIndexOf(label);
  if (index < 0) return null;
  return firstMoneyToken(text.slice(index + label.length));
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
  spec: ShellharbourGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): ShellharbourGpfsLineValue | null {
  const value = spec.last_occurrence
    ? lastAmountAfter(text, spec.label)
    : firstAmountAfter(text, spec.label, spec.exclude_following);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly ShellharbourGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface ShellharbourGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse B1-1 "Total functions and activities". The row prints ten numbers
 * (Income 2025/2024, Expenses 2025/2024, Operating result 2025/2024, Grants
 * 2025/2024, Carrying amount 2025/2024); the 2025 values are at indices 0, 2, 4
 * and 6.
 */
export function parseShellharbourGpfsFunctionsTotals(
  page: PdfPage,
): ShellharbourGpfsFunctionsTotals | null {
  const text = normalizeText(page.text);
  const label = 'Total functions and activities';
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

function gpfsFundingSource(spec: ShellharbourGpfsLineSpec): string {
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

function printedLineLabel(spec: ShellharbourGpfsLineSpec): string {
  return spec.label;
}

function notesFor(
  context: ShellharbourGpfsParseContext,
  spec: ShellharbourGpfsLineSpec,
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
    context.document.report_page_url ? `report_page: ${context.document.report_page_url}` : null,
    context.document.audited_statements_url
      ? `audited_statements_section: ${context.document.audited_statements_url}`
      : null,
    context.reporting_url ? `reporting_url: ${context.reporting_url}` : null,
    `statement: ${spec.statement}`,
    `page: ${pageNumber}`,
    `printed_label: ${printedLineLabel(spec)}`,
    `unit: ${unit} (explicit; ${unitReason})`,
    `reconciliation: ${reconciliationNote}`,
    'provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + document + line + fiscal year. */
export function shellharbourGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = SHELLHARBOUR_GPFS_FISCAL_YEAR,
): string {
  return `${SHELLHARBOUR_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: ShellharbourGpfsLineValue,
  context: ShellharbourGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: SHELLHARBOUR_GPFS_FISCAL_YEAR,
    source_id: SHELLHARBOUR_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: shellharbourGpfsNaturalKey(
      context.document.url,
      spec.key,
      SHELLHARBOUR_GPFS_FISCAL_YEAR,
    ),
    project_name: `Shellharbour City Council GPFS 2024-25 — ${printedLineLabel(spec)}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: SHELLHARBOUR_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: SHELLHARBOUR_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: SHELLHARBOUR_GPFS_DATA_QUALITY_FLAG,
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
export function parseShellharbourGpfsExtraction(
  extraction: PdfExtraction,
  context: ShellharbourGpfsParseContext,
): ShellharbourGpfsParseResult {
  const warnings: string[] = [];
  const rejections: ShellharbourGpfsRejection[] = [];
  const reject = (reason: string): ShellharbourGpfsParseResult => {
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
      text.includes('Statement of Comprehensive Income') && text.includes('from Income Statement'),
  );
  if (!comprehensivePage) {
    return reject(
      'Statement of Comprehensive Income page not found; no independent printed net-result check',
    );
  }
  const depreciationPage = findPage(extraction.pages, (_page, text) =>
    text.includes(SHELLHARBOUR_GPFS_DEPRECIATION_NOTE_LABEL),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: ShellharbourGpfsFunctionsTotals | null;
  let comprehensiveNetResult: number | null;
  let depreciationNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseShellharbourGpfsFunctionsTotals(functionsPage);
    comprehensiveNetResult = firstAmountAfter(
      normalizeText(comprehensivePage.text),
      'from Income Statement',
    );
    if (depreciationPage) {
      depreciationNoteTotal = firstAmountAfter(
        normalizeText(depreciationPage.text),
        SHELLHARBOUR_GPFS_DEPRECIATION_NOTE_LABEL,
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
  const unit = incomeUnit.kind;

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: ShellharbourGpfsLineValue[] = [];
  for (const spec of SHELLHARBOUR_GPFS_LINES) {
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
  const netResultBeforeCapital = firstAmountAfter(
    incomeText,
    SHELLHARBOUR_GPFS_BEFORE_CAPITAL_LABEL,
  );
  const operatingResult = firstAmountAfter(
    incomeText,
    SHELLHARBOUR_GPFS_OPERATING_RESULT_LABEL,
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
  // Total expenses is the printed B1-1 "Total functions and activities" expense
  // total; it also equals the printed expenses-excluding-depreciation line plus
  // the printed depreciation line.
  const totalExpenses = functionsTotals.expenses;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;

  const totalExpensesLine: ShellharbourGpfsLineValue = {
    spec: SHELLHARBOUR_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
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
    'income statement revenue components = printed total revenue',
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
    'printed total revenue - printed total expenses = printed operating result',
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
    'B1-1 operating result = printed operating result',
    operatingResult!,
    functionsTotals.operating_result,
  );
  check(
    'B1-1 grants and contributions = operating grants + capital grants',
    grantsOperating! + grantsCapital!,
    functionsTotals.grants_and_contributions,
  );
  check('B1-1 income = face total revenue', totalRevenue!, functionsTotals.income);
  check('B1-1 expenses = printed total expenses bridge', totalExpenses, functionsTotals.expenses);
  check(
    'B1-1 income - B1-1 expenses = printed operating result',
    operatingResult!,
    functionsTotals.income - functionsTotals.expenses,
  );
  check(
    'Statement of Comprehensive Income net result = Income Statement net result',
    netResult!,
    comprehensiveNetResult!,
  );
  if (depreciationNoteTotal !== null) {
    check(
      'printed depreciation/impairment line = note B3-4 total',
      depreciation!,
      depreciationNoteTotal,
    );
  }
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: ShellharbourGpfsReconciliation = {
    fiscal_year: SHELLHARBOUR_GPFS_FISCAL_YEAR,
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
    depreciation_note_total: depreciationNoteTotal,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'printed revenue components sum exactly to the printed total income',
      'printed expense-by-nature components sum exactly to the printed expenses-excluding-depreciation line',
      'printed expenses excluding depreciation + printed depreciation equals the printed B1-1 total expenses',
      'printed total income - printed total expenses equals the printed operating result',
      'printed net result equals the printed operating result (no discontinued operations)',
      'printed net result - capital grants equals the printed before-capital result',
      'B1-1 operating result, grants, income and expenses reconcile to the face statement',
      'Statement of Comprehensive Income net result equals the Income Statement net result',
      'the Income Statement depreciation/impairment line equals the note B3-4 total when that note is present',
      'the printed net result is positive and stored as a non-negative magnitude; the before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the printed B1-1 Total functions and activities expense total (236,395), which equals printed expenses-excluding-depreciation (206,611) plus printed depreciation and impairment (29,784) and printed total income (310,293) less the printed operating result (73,898); the printed net result (73,898) equals the printed operating result and is repeated in the Statement of Comprehensive Income; the printed revenue and expense components sum exactly to their printed subtotals; the B1-1 totals and note B3-4 depreciation/amortisation total reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface ShellharbourGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: ShellharbourGpfsDocument;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched discovery inputs; the connector still selects the official links. */
  indexHtml?: string;
  reportPageHtml?: string;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name) && /shellharbour|annual|financial|report/i.test(name)) {
      return name.replace(/[^A-Za-z0-9._-]+/g, '-');
    }
  } catch {
    // Fall through to the stable name.
  }
  return 'shellharbour-city-council-annual-report-2024-25.pdf';
}

/** Build the live Shellharbour City Council GPFS connector. */
export function createShellharbourGpfsConnector(
  options: ShellharbourGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: SHELLHARBOUR_GPFS_ID,
    name: SHELLHARBOUR_GPFS_NAME,
    publisher: SHELLHARBOUR_GPFS_PUBLISHER,
    source_url: SHELLHARBOUR_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: SHELLHARBOUR_GPFS_LICENSE,
    notes:
      "Seventeenth NSW council GPFS adapter: one council only (Shellharbour City Council), audited FY2024-25 General Purpose Financial Statements published inside the official Annual Report 2024 - 2025. The PDF is discovered from the official 'Annual reports' page via the FY2024-25 annual-report page (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverShellharbourGpfsDocument(fetchImpl, SHELLHARBOUR_GPFS_FISCAL_YEAR, {
          indexHtml: options.indexHtml,
          reportPageHtml: options.reportPageHtml,
        }));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, { redirect: 'follow' });
        if (!response.ok) {
          throw new Error(
            `Shellharbour City Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: ShellharbourGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: SHELLHARBOUR_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Shellharbour City Council FY2024-25 General Purpose Financial Statements (the audited financial-statements section of the official Annual Report 2024 - 2025); archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: ShellharbourGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: SHELLHARBOUR_GPFS_REPORTING_URL,
      };
      const parsed = parseShellharbourGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'shellharbour-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'shellharbour-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push(
            'raw entry is not a Shellharbour City Council GPFS measure; skipped',
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
