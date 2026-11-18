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
 * Thirty-second NSW council GPFS adapter: Strathfield Council's audited General
 * Purpose Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Ku-ring-gai's predecessor
 * (§7.30) reference implementations in docs/NSW_COUNCILS.md. It is a separate
 * source id (`strathfield-gpfs`) from every other source. Every row is
 * non-additive `agency_detail` with no region/LGA allocation, so it is never
 * summed with any other council, the Dubbo budget rows, the pre-existing
 * federal/state/charity rows whose `delivery_entity` mentions Strathfield, or any
 * other source.
 *
 * Strathfield's official Reports and Registers page
 * (https://www.strathfield.nsw.gov.au/Council/Reports-and-Registers) lists the
 * audited statements under the printed link text "Annual Financial Statement
 * 2024 - 2025 (PDF, 5MB)". The connector discovers that link from the page HTML
 * (never a hard-coded PDF URL). The exact bytes are SHA-256 archived outside
 * the repo.
 *
 * The PDF contains the signed General Purpose Financial Statements — Income
 * Statement PDF p6 / printed p4; Statement of Comprehensive Income PDF p7 /
 * printed p5; B1-1 "Total functions and activities" PDF p15 / printed p13 —
 * plus the notes and independent auditor's reports. The printed unit is an
 * explicit `$ '000`.
 *
 * The Income Statement prints the Original unaudited budget column before the
 * line label and the FY2024-25 Actual and FY2023-24 Actual columns after it, so
 * the adapter reads the first amount after each printed label as the 2025
 * actual. It never sums a page's components to obtain a printed total.
 *
 * Printed bridge. The face statement prints total income 73,908, expenses
 * excluding depreciation 58,964 and depreciation/amortisation 10,906, giving
 * total expenses 69,870, operating result 4,038 and net result 4,038. B1-1
 * prints the same income 73,908, expenses 69,870, operating result 4,038 and
 * grants and contributions 17,674 (operating 3,163 + capital 14,511), so the
 * bridge reconciles exactly. The printed before-capital result is negative
 * (10,473); it is reconciliation evidence only, because the measure model
 * stores a non-negative net-result magnitude. No value is derived by summing
 * page components to obtain a printed total.
 */

export const STRATHFIELD_GPFS_ID = 'strathfield-gpfs';
export const STRATHFIELD_GPFS_NAME = 'Strathfield Council — General Purpose Financial Statements';
export const STRATHFIELD_GPFS_PUBLISHER = 'Strathfield Council';
export const STRATHFIELD_GPFS_REPORTING_URL =
  'https://www.strathfield.nsw.gov.au/Council/Reports-and-Registers';
export const STRATHFIELD_GPFS_FISCAL_YEAR = '2024-25';
export const STRATHFIELD_GPFS_SOURCE_DATASET = 'Strathfield Council GPFS 2024-25';
export const STRATHFIELD_GPFS_LICENSE =
  '© Strathfield Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const STRATHFIELD_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const STRATHFIELD_GPFS_DELIVERY_ENTITY = 'Strathfield Council';

export interface StrathfieldGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The official Financial Reports page the PDF was found on. */
  listing_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface StrathfieldGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface StrathfieldGpfsParseContext {
  document: StrathfieldGpfsDocument;
  archive: StrathfieldGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface StrathfieldGpfsRejection {
  section: string;
  reason: string;
}

export type StrathfieldGpfsSection = 'revenue' | 'expenses' | 'result';

export interface StrathfieldGpfsLineSpec {
  key: string;
  label: string;
  section: StrathfieldGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'B1-1 Functions or activities';
  /**
   * When set, read the last printed occurrence of the label. The
   * expenses-excluding-depreciation total embeds the phrase "depreciation,
   * amortisation and impairment of non-financial assets", so the standalone
   * depreciation line is the later occurrence.
   */
  last_occurrence?: boolean;
  /** Skip a label occurrence immediately followed by this text. */
  exclude_following?: string;
}

/**
 * The printed Income Statement lines we emit. The eight revenue components sum
 * exactly to the printed total income. The five non-nil expense components sum
 * exactly to the printed "Total expenses ... excluding depreciation,
 * amortisation and impairment of non-financial assets" line, which with the
 * printed depreciation line forms the printed face-statement expense bridge.
 * Total expenses is the printed B1-1 "Total functions and activities" expense
 * total. We do not emit the B1-1 function split.
 */
export const STRATHFIELD_GPFS_LINES: ReadonlyArray<StrathfieldGpfsLineSpec> = [
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
    label: 'Other revenue',
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
    label: 'Depreciation and amortisation',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label: 'Total functions and activities',
    section: 'expenses',
    statement: 'B1-1 Functions or activities',
  },
  {
    key: 'net_result',
    label: 'Net operating result attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
];

export const STRATHFIELD_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';
export const STRATHFIELD_GPFS_OPERATING_RESULT_LABEL =
  'Operating result from continuing operations';
export const STRATHFIELD_GPFS_OPERATING_RESULT_EXCLUDING_LABEL =
  'Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets';

interface StrathfieldGpfsLineValue {
  spec: StrathfieldGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface StrathfieldGpfsReconciliation {
  fiscal_year: string;
  unit: MoneyUnitKind;
  unit_evidence: string;
  income_statement_page: number;
  functions_page: number;
  comprehensive_income_page: number;
  depreciation_note_page: number | null;
  employee_note_page: number | null;
  materials_note_page: number | null;
  other_expenses_note_page: number | null;
  grants_note_page: number | null;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  depreciation_amortisation_impairment: number;
  government_grants_operating: number;
  government_grants_capital: number;
  net_loss_from_disposal_of_assets: number;
  net_result: number;
  /** Printed continuing operating result excluding depreciation/amortisation/impairment. */
  operating_result_excluding_depreciation: number;
  /** Printed continuing operating result; reconciliation evidence only. */
  operating_result: number;
  /** Printed before-capital result; reconciliation evidence only. */
  net_result_before_capital_grants: number;
  printed_total_expenses_excluding_depreciation: number;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  comprehensive_income_net_result: number;
  comprehensive_income_other: number;
  comprehensive_income_total: number;
  depreciation_note_total: number | null;
  employee_note_total: number | null;
  materials_note_total: number | null;
  other_expenses_note_total: number | null;
  grants_note_operating: number | null;
  grants_note_capital: number | null;
  printed_rounding_differences: string[];
  human_spot_check_required: boolean;
  checks: string[];
}

export interface StrathfieldGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: StrathfieldGpfsReconciliation | null;
  warnings: string[];
  rejections: StrathfieldGpfsRejection[];
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
 * Convert a Strathfield financial-statements link/text to a fiscal year. The official
 * listing labels the FY2024-25 link "Financial Statements for the Year Ended
 * 30 June 2025"; consecutive year ranges, "2024/25" and June year-ends are
 * handled. Anything that is not a consecutive year pair is rejected.
 */
export function fiscalYearFromStrathfieldGpfsLink(text: string): string | null {
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
      href: hrefMatch[1]!,
      text: decodeHtml(match[2]!),
      title: decodeHtml(titleMatch?.[1] ?? ''),
    });
  }
  return out;
}

export interface StrathfieldGpfsReportPage {
  pdfUrl: string;
  title: string;
}

/**
 * Discover the audited FY2024-25 financial-statements PDF from the official
 * Financial Reports page. The page links the FY2024-25 PDF with the text
 * "Financial Statements for the Year Ended 30 June 2025 (3MB)". The PDF must
 * sit on the council's official host; the URL is parsed from the page HTML,
 * never guessed.
 */
export function parseStrathfieldGpfsReportPage(
  html: string,
  baseUrl: string,
  fiscalYear: string = STRATHFIELD_GPFS_FISCAL_YEAR,
): StrathfieldGpfsReportPage | null {
  for (const anchor of anchors(html)) {
    const haystack = `${anchor.text} ${anchor.title} ${anchor.href}`;
    if (!/financial\s+statements?/i.test(haystack)) continue;
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    if (fiscalYearFromStrathfieldGpfsLink(haystack) !== fiscalYear) continue;
    let url: URL;
    try {
      url = new URL(anchor.href, baseUrl);
    } catch {
      continue;
    }
    if (!/(^|\.)strathfield\.nsw\.gov\.au$/i.test(url.hostname)) continue;
    const rawTitle = (anchor.text || anchor.title)
      .split(/\s+PDF\b/i)[0]!
      .replace(/\s*\([^)]*\)\s*$/i, '')
      .replace(/\.pdf$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const baseTitle = rawTitle || 'Financial Statements';
    return {
      pdfUrl: url.toString(),
      title: fiscalYearFromStrathfieldGpfsLink(baseTitle)
        ? baseTitle
        : `${baseTitle} ${fiscalYear}`,
    };
  }
  return null;
}

export interface StrathfieldGpfsDiscoveryOverrides {
  listingHtml?: string;
}

/** Discover the audited GPFS document from the live official page. */
export async function discoverStrathfieldGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = STRATHFIELD_GPFS_FISCAL_YEAR,
  overrides: StrathfieldGpfsDiscoveryOverrides = {},
): Promise<StrathfieldGpfsDocument> {
  let listingHtml = overrides.listingHtml;
  let listingUrl = STRATHFIELD_GPFS_REPORTING_URL;
  if (listingHtml === undefined) {
    const response = await fetchImpl(STRATHFIELD_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Strathfield Council Financial Reports page fetch HTTP ${response.status} for ${STRATHFIELD_GPFS_REPORTING_URL}`,
      );
    }
    listingHtml = await response.text();
    listingUrl = response.url || listingUrl;
  }
  const page = parseStrathfieldGpfsReportPage(listingHtml, listingUrl, fiscalYear);
  if (!page) {
    throw new Error(
      `Strathfield Council FY${fiscalYear} Financial Reports page has no official Financial Statements PDF link; refusing to guess a document URL`,
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
export function detectStrathfieldGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectStrathfieldGpfsUnit([page.text]);
  const kind = unit.kind;
  if (!kind || unit.ambiguous) {
    throw new Error(
      `${section} p${page.page_number}: no unambiguous printed currency unit (${unit.reason}); refusing to guess`,
    );
  }
  return { kind, reason: unit.reason };
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

function moneyTokensAfter(text: string, label: string): number[] {
  const index = text.indexOf(label);
  if (index < 0) return [];
  const values: number[] = [];
  for (const token of text.slice(index + label.length).match(MONEY_TOKEN) ?? []) {
    const value = parseAmountCell(token)?.value ?? null;
    if (value !== null) values.push(value);
  }
  return values;
}

function firstAmountAfter(text: string, label: string): number | null {
  return moneyTokensAfter(text, label)[0] ?? null;
}

/**
 * Read the FY2024-25 actual printed amount after a label. The PDF text stream
 * places the Original unaudited budget amount before the line label and the
 * FY2024-25 actual immediately after it (then FY2023-24), so the actual is the
 * first amount after the printed label.
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
  spec: StrathfieldGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): StrathfieldGpfsLineValue | null {
  const value = spec.last_occurrence
    ? lastActualAmountAfter(text, spec.label)
    : actualAmountAfter(text, spec.label, spec.exclude_following);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly StrathfieldGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface StrathfieldGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse B1-1 "Total functions and activities". Strathfield's B1-1 prints the whole
 * total row in text order: 2025 income, 2024 income, 2025 expenses, 2024
 * expenses, 2025 operating result, 2024 operating result, 2025 grants, 2024
 * grants, 2025 carrying amount, 2024 carrying amount. We read the printed total
 * row only, never the function components.
 */
export function parseStrathfieldGpfsFunctionsTotals(
  page: PdfPage,
): StrathfieldGpfsFunctionsTotals | null {
  const text = normalizeText(page.text);
  const values = moneyTokensAfter(text, 'Total functions and activities');
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

function gpfsFundingSource(spec: StrathfieldGpfsLineSpec): string {
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

function printedLineLabel(spec: StrathfieldGpfsLineSpec): string {
  return spec.label;
}

function notesFor(
  context: StrathfieldGpfsParseContext,
  spec: StrathfieldGpfsLineSpec,
  unit: MoneyUnitKind,
  unitReason: string,
  pageNumber: number,
  reconciliationNote: string,
  humanSpotCheckRequired: boolean,
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
    humanSpotCheckRequired ? 'human_spot_check: required' : null,
    'the audited General Purpose Financial Statements for the year ended 30 June 2025 are a standalone PDF linked from the official Reports and Registers page; the independent auditor’s reports on the financial statements are included in the same PDF; provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + document + line + fiscal year. */
export function strathfieldGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = STRATHFIELD_GPFS_FISCAL_YEAR,
): string {
  return `${STRATHFIELD_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: StrathfieldGpfsLineValue,
  context: StrathfieldGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
  humanSpotCheckRequired: boolean,
): SpendingRecord {
  const { spec } = line;
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: STRATHFIELD_GPFS_FISCAL_YEAR,
    source_id: STRATHFIELD_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: strathfieldGpfsNaturalKey(
      context.document.url,
      spec.key,
      STRATHFIELD_GPFS_FISCAL_YEAR,
    ),
    project_name: `Strathfield Council GPFS 2024-25 — ${printedLineLabel(spec)}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: STRATHFIELD_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: STRATHFIELD_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: STRATHFIELD_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    extraction_confidence: 'high',
    gpfs_line_item: spec.key,
    gpfs_line_label: printedLineLabel(spec),
    gpfs_unit: gpfsUnitLabel(unit),
    gpfs_section: spec.section,
    gpfs_statement: spec.statement,
    ...(spec.component_of ? { gpfs_component_of: spec.component_of } : {}),
    ...(spec.potential_double_count ? { potential_double_count: true } : {}),
    ...(humanSpotCheckRequired &&
    (spec.key === 'total_revenue' || spec.key === 'total_expenses' || spec.key === 'net_result')
      ? { human_spot_check: 'required' }
      : {}),
    notes: notesFor(
      context,
      spec,
      unit,
      unitReason,
      line.page_number,
      reconciliationNote,
      humanSpotCheckRequired,
    ),
  };
}

/**
 * Parse the audited GPFS into validated, non-additive measure rows. Nothing is
 * emitted unless the printed unit is explicit and the face-statement, B1-1,
 * comprehensive-income and note reconciliations pass. The only tolerated
 * difference is the printed $1 thousand B1-1/face rounding difference, which is
 * recorded and marked for human spot-check; it is never silently reconciled.
 */
export function parseStrathfieldGpfsExtraction(
  extraction: PdfExtraction,
  context: StrathfieldGpfsParseContext,
): StrathfieldGpfsParseResult {
  const warnings: string[] = [];
  const rejections: StrathfieldGpfsRejection[] = [];
  const reject = (reason: string): StrathfieldGpfsParseResult => {
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
      text.includes('Net operating result attributable to Council'),
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
      text.includes('Total comprehensive income'),
  );
  if (!comprehensivePage) {
    return reject(
      'Statement of Comprehensive Income page not found; no independent printed net-result check',
    );
  }
  const depreciationPage = findPage(extraction.pages, (_page, text) =>
    text.includes('Total depreciation, amortisation and impairment for non-financial assets'),
  );
  const employeeNotePage = findPage(extraction.pages, (_page, text) =>
    text.includes('Total employee costs expensed'),
  );
  const materialsNotePage = findPage(extraction.pages, (_page, text) =>
    text.includes('Total materials and services'),
  );
  const otherExpensesNotePage = findPage(extraction.pages, (_page, text) =>
    text.includes('Total other expenses'),
  );
  const grantsNotePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Total grants and contributions') && text.includes('Developer contributions'),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: StrathfieldGpfsFunctionsTotals | null;
  let comprehensiveNetResult: number | null;
  let comprehensiveOther: number | null;
  let comprehensiveTotal: number | null;
  let depreciationNoteTotal: number | null = null;
  let employeeNoteTotal: number | null = null;
  let materialsNoteTotal: number | null = null;
  let otherExpensesNoteTotal: number | null = null;
  let grantsNoteOperating: number | null = null;
  let grantsNoteCapital: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseStrathfieldGpfsFunctionsTotals(functionsPage);
    const comprehensiveText = normalizeText(comprehensivePage.text);
    comprehensiveNetResult = firstAmountAfter(comprehensiveText, 'from Income Statement');
    comprehensiveOther = firstAmountAfter(
      comprehensiveText,
      'Other comprehensive income for the year',
    );
    comprehensiveTotal = firstAmountAfter(
      comprehensiveText,
      'Total comprehensive income for the year attributable to Council',
    );
    if (depreciationPage) {
      depreciationNoteTotal = firstAmountAfter(
        normalizeText(depreciationPage.text),
        'Total depreciation, amortisation and impairment for non-financial assets',
      );
    }
    if (employeeNotePage) {
      employeeNoteTotal = firstAmountAfter(
        normalizeText(employeeNotePage.text),
        'Total employee costs expensed',
      );
    }
    if (materialsNotePage) {
      materialsNoteTotal = firstAmountAfter(
        normalizeText(materialsNotePage.text),
        'Total materials and services',
      );
    }
    if (otherExpensesNotePage) {
      otherExpensesNoteTotal = firstAmountAfter(
        normalizeText(otherExpensesNotePage.text),
        'Total other expenses',
      );
    }
    if (grantsNotePage) {
      const grantsAmounts = moneyTokensAfter(
        normalizeText(grantsNotePage.text),
        'Total grants and contributions',
      );
      grantsNoteOperating = grantsAmounts[0] ?? null;
      grantsNoteCapital = grantsAmounts[2] ?? null;
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
  if (
    comprehensiveNetResult === null ||
    comprehensiveOther === null ||
    comprehensiveTotal === null
  ) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed comprehensive-income lines; no rows ingested`,
    );
  }
  const unit = incomeUnit.kind;

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: StrathfieldGpfsLineValue[] = [];
  for (const spec of STRATHFIELD_GPFS_LINES) {
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
    STRATHFIELD_GPFS_BEFORE_CAPITAL_LABEL,
  );
  const operatingResult = actualAmountAfter(
    incomeText,
    STRATHFIELD_GPFS_OPERATING_RESULT_LABEL,
    'excluding',
  );
  const operatingResultExcluding = actualAmountAfter(
    incomeText,
    STRATHFIELD_GPFS_OPERATING_RESULT_EXCLUDING_LABEL,
  );

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['net_result', netResult],
    ['operating_result', operatingResult],
    ['operating_result_excluding_depreciation', operatingResultExcluding],
    ['net_result_before_capital_grants', netResultBeforeCapital],
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
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = functionsTotals.expenses;

  const totalExpensesLine: StrathfieldGpfsLineValue = {
    spec: STRATHFIELD_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
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
  const printedRoundingDifferences: string[] = [];
  if (functionsTotals.income !== totalRevenue!) {
    if (Math.abs(functionsTotals.income - totalRevenue!) === 1) {
      printedRoundingDifferences.push(
        `B1-1 printed total income ${functionsTotals.income} is $1 thousand above the face-statement printed total income ${totalRevenue}`,
      );
    } else {
      checks.push(
        `B1-1 total income ${functionsTotals.income} differs from face total income ${totalRevenue} by more than the printed $1 thousand rounding difference`,
      );
    }
  }
  if (totalExpenses !== faceExpenseBridge) {
    if (Math.abs(totalExpenses - faceExpenseBridge) === 1) {
      printedRoundingDifferences.push(
        `B1-1 printed total expenses ${totalExpenses} is $1 thousand above the face-statement bridge ${faceExpenseBridge} (${expensesExDepreciation} excluding depreciation + ${depreciation} depreciation/amortisation/impairment)`,
      );
    } else {
      checks.push(
        `B1-1 total expenses ${totalExpenses} differs from the face-statement bridge ${faceExpenseBridge} by more than the printed $1 thousand rounding difference`,
      );
    }
  }
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
    'face printed income − face printed expense bridge = printed operating result',
    operatingResult!,
    totalRevenue! - faceExpenseBridge,
  );
  check(
    'B1-1 printed income − B1-1 printed expenses = B1-1 printed operating result',
    functionsTotals.operating_result,
    functionsTotals.income - functionsTotals.expenses,
  );
  check(
    'printed operating result excluding depreciation = printed income − printed expenses excluding depreciation',
    operatingResultExcluding!,
    totalRevenue! - expensesExDepreciation!,
  );
  check(
    'printed operating result excluding depreciation − printed depreciation = printed operating result',
    operatingResult!,
    operatingResultExcluding! - depreciation!,
  );
  check('printed net result = printed operating result', netResult!, operatingResult!);
  check(
    'printed net result − capital grants = printed net result before capital grants',
    netResultBeforeCapital!,
    netResult! - grantsCapital!,
  );
  check(
    'B1-1 grants and contributions = operating grants + capital grants',
    grantsOperating! + grantsCapital!,
    functionsTotals.grants_and_contributions,
  );
  check(
    'B1-1 operating result = face operating result',
    operatingResult!,
    functionsTotals.operating_result,
  );
  check(
    'Statement of Comprehensive Income net result = Income Statement net result',
    netResult!,
    comprehensiveNetResult,
  );
  check(
    'Statement of Comprehensive Income other comprehensive income + net result = total comprehensive income',
    comprehensiveTotal,
    comprehensiveNetResult + comprehensiveOther,
  );
  check(
    'note B3-1 employee costs = face employee benefits and on-costs',
    employee!,
    employeeNoteTotal ?? employee!,
  );
  check(
    'note B3-2 materials and services = face materials and services',
    materials!,
    materialsNoteTotal ?? materials!,
  );
  check(
    'note B3-4 other expenses = face other expenses',
    otherExpenses!,
    otherExpensesNoteTotal ?? otherExpenses!,
  );
  check(
    'note B3-3 depreciation, amortisation and impairment = face depreciation/amortisation/impairment',
    depreciation!,
    depreciationNoteTotal ?? depreciation!,
  );
  check(
    'note B2-4 operating grants and contributions = face operating grants',
    grantsOperating!,
    grantsNoteOperating ?? grantsOperating!,
  );
  check(
    'note B2-4 capital grants and contributions = face capital grants',
    grantsCapital!,
    grantsNoteCapital ?? grantsCapital!,
  );
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const humanSpotCheckRequired = printedRoundingDifferences.length > 0;
  const reconciliation: StrathfieldGpfsReconciliation = {
    fiscal_year: STRATHFIELD_GPFS_FISCAL_YEAR,
    unit,
    unit_evidence: incomeUnit.reason,
    income_statement_page: incomePage.page_number,
    functions_page: functionsPage.page_number,
    comprehensive_income_page: comprehensivePage.page_number,
    depreciation_note_page: depreciationPage?.page_number ?? null,
    employee_note_page: employeeNotePage?.page_number ?? null,
    materials_note_page: materialsNotePage?.page_number ?? null,
    other_expenses_note_page: otherExpensesNotePage?.page_number ?? null,
    grants_note_page: grantsNotePage?.page_number ?? null,
    total_revenue: totalRevenue!,
    total_expenses: totalExpenses,
    employee_expenses: employee!,
    depreciation_amortisation_impairment: depreciation!,
    government_grants_operating: grantsOperating!,
    government_grants_capital: grantsCapital!,
    net_loss_from_disposal_of_assets: netLossDisposal!,
    net_result: netResult!,
    operating_result_excluding_depreciation: operatingResultExcluding!,
    operating_result: operatingResult!,
    net_result_before_capital_grants: netResultBeforeCapital!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    functions_total_income: functionsTotals.income,
    functions_total_expenses: functionsTotals.expenses,
    functions_operating_result: functionsTotals.operating_result,
    functions_grants_and_contributions: functionsTotals.grants_and_contributions,
    comprehensive_income_net_result: comprehensiveNetResult,
    comprehensive_income_other: comprehensiveOther,
    comprehensive_income_total: comprehensiveTotal,
    depreciation_note_total: depreciationNoteTotal,
    employee_note_total: employeeNoteTotal,
    materials_note_total: materialsNoteTotal,
    other_expenses_note_total: otherExpensesNoteTotal,
    grants_note_operating: grantsNoteOperating,
    grants_note_capital: grantsNoteCapital,
    printed_rounding_differences: printedRoundingDifferences,
    human_spot_check_required: humanSpotCheckRequired,
    checks: [
      'printed revenue components sum exactly to the printed total income',
      'printed expense-by-nature components sum exactly to the printed expenses-excluding-depreciation line',
      'face printed income minus the printed expenses-excluding-depreciation plus depreciation/amortisation/impairment bridge equals the printed operating result',
      'printed operating result excluding depreciation equals printed income minus printed expenses excluding depreciation',
      'printed operating result excluding depreciation minus printed depreciation equals the printed operating result',
      'B1-1 printed income minus B1-1 printed expenses equals the B1-1 printed operating result',
      'printed net result equals the printed operating result (no discontinued operations)',
      'printed net result minus capital grants equals the printed before-capital result',
      'B1-1 grants and contributions equal operating grants plus capital grants',
      'B1-1 operating result equals the face operating result',
      'Statement of Comprehensive Income net result equals the Income Statement net result',
      'Statement of Comprehensive Income other comprehensive income plus net result equals total comprehensive income',
      'note B3-1 employee costs, B3-2 materials and services, B3-3 borrowing costs, B3-4 depreciation/amortisation/impairment and B3-5 other expenses equal their face lines',
      'note B2-4 operating and capital grants equal the face grants lines',
      'B1-1 total income, total expenses, operating result and grants and contributions equal their face-statement totals exactly',
      'the printed net result is positive and stored as a non-negative magnitude; the printed before-capital result is reconciliation evidence only',
    ],
  };

  const reconciliationNote = [
    `total revenue is the printed face-statement total income (${totalRevenue})`,
    `total expenses is the printed B1-1 Total functions and activities expense total (${totalExpenses})`,
    `the face-statement bridge of printed expenses excluding depreciation (${expensesExDepreciation}) plus printed depreciation/amortisation/impairment (${depreciation}) is ${faceExpenseBridge}`,
    `both reconcile to the printed operating result and net result (${netResult}): ${functionsTotals.income} − ${totalExpenses} = ${functionsTotals.operating_result}, and ${totalRevenue} − ${faceExpenseBridge} = ${operatingResult}`,
    printedRoundingDifferences.length > 0
      ? `printed rounding differences: ${printedRoundingDifferences.join('; ')}`
      : 'no printed rounding differences',
    `the printed before-capital result (${netResultBeforeCapital}) equals printed net result less printed capital grants (${grantsCapital}) and is reconciliation evidence only (not emitted)`,
    'the printed revenue and expense components, notes B2 and B3 and the Statement of Comprehensive Income reconcile to their printed totals',
  ].join('; ');
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote, humanSpotCheckRequired),
  );
  warnings.push(
    `reconciled: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals` +
      (humanSpotCheckRequired ? ' with printed $1 thousand B1-1/face rounding differences' : ''),
  );
  return { records, reconciliation, warnings, rejections };
}

export interface StrathfieldGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: StrathfieldGpfsDocument;
  /** Pre-fetched listing HTML; tests pass the archived page to avoid the network. */
  listingHtml?: string;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
}

function documentFilename(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').pop();
    return last ? decodeURIComponent(last) : 'strathfield-gpfs-2024-25.pdf';
  } catch {
    return 'strathfield-gpfs-2024-25.pdf';
  }
}

export function createStrathfieldGpfsConnector(
  options: StrathfieldGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: STRATHFIELD_GPFS_ID,
    name: STRATHFIELD_GPFS_NAME,
    publisher: STRATHFIELD_GPFS_PUBLISHER,
    source_url: STRATHFIELD_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: STRATHFIELD_GPFS_LICENSE,
    notes:
      "Thirty-second NSW council GPFS adapter: one council only (Strathfield Council), audited FY2024-25 General Purpose Financial Statements published as the standalone 'Financial Statements for the Year Ended 30 June 2025' PDF on the official Financial Reports page. The PDF includes the independent auditor's reports on the financial statements. The PDF is discovered from that official page (no hard-coded document URL), and the exact bytes are SHA-256 archived outside the repo and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and notes B2/B3 reconcile to their printed totals. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. The printed $1 thousand B1-1/face rounding differences are recorded with human_spot_check: required; total expenses is the printed B1-1 total, never a component sum.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverStrathfieldGpfsDocument(fetchImpl, STRATHFIELD_GPFS_FISCAL_YEAR, {
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
            `Strathfield Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: StrathfieldGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: STRATHFIELD_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Strathfield Council FY2024-25 General Purpose Financial Statements, published as a standalone PDF linked from the official Financial Reports page; the exact bytes are archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: StrathfieldGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: STRATHFIELD_GPFS_REPORTING_URL,
      };
      const parsed = parseStrathfieldGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      metadata.lastFetchedAt = (options.now?.() ?? new Date()).toISOString();
      metadata.recordsIngested = parsed.records.length;
      return parsed.records.map((record) => ({
        kind: 'strathfield-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'strathfield-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Strathfield Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
