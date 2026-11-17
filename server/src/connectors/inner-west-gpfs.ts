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
 * Twentieth NSW council GPFS adapter: Inner West Council's audited General
 * Purpose Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Willoughby (§7.19) reference
 * implementations in docs/NSW_COUNCILS.md with an Inner West-specific layout
 * adapter. It is a separate source id (`inner-west-gpfs`) from every other
 * source. Every row is non-additive `agency_detail` with no region/LGA
 * allocation, so it can never be summed with the Dubbo budget rows, any existing
 * council GPFS source, the pre-existing federal/state/charity rows whose
 * `delivery_entity` merely mentions Inner West, or any other council.
 *
 * The council publishes its audited financial report inside the official
 * "Annual Report 2024-25" PDF linked from its Annual Report page. The page text
 * explicitly states the report includes "Council's financial report which has
 * been audited by the NSW Audit Office", and the PDF contains the General
 * Purpose Financial Statements (PDF p234 onward) together with the independent
 * auditor's report on the general purpose financial statements (PDF p293). The
 * PDF URL is discovered from that official page (never hard-coded). Unlike the
 * Cloudflare/Akamai-protected council sites, innerwest.nsw.gov.au serves plain
 * HTTP, so discovery and the PDF download use Node's fetch; the connector still
 * parses the FY2024-25 "Annual Report 2024-25" link from the page HTML and
 * re-verifies the exact bytes. The exact bytes are SHA-256 archived outside the
 * repo. The printed `$ '000` unit is required.
 *
 * The Income Statement prints the Original unaudited budget column before each
 * line label, so each emitted value is the first amount after the printed label
 * (the FY2024-25 actual). It does not print a combined "Total expenses" line;
 * total expenses is the printed B1-1 "Total functions and activities" expense
 * total ($325,583 thousand), which equals the printed expenses-excluding-
 * depreciation line ($286,616 thousand) plus the printed depreciation,
 * amortisation and impairment line ($38,967 thousand) and equals printed total
 * income ($368,386 thousand) less the printed operating result ($42,803
 * thousand). The Statement of Comprehensive Income repeats the printed net
 * result ($42,803 thousand). Those top-level printed totals reconcile exactly
 * and are the defensible totals.
 *
 * The printed before-capital result is a deficit of $(4,581) thousand. Because
 * the measure model stores non-negative integer cents, that printed negative
 * result is kept in the reconciliation evidence only and is not emitted as a
 * row (the same convention as Blacktown, Parramatta and several later councils).
 */

export const INNER_WEST_GPFS_ID = 'inner-west-gpfs';
export const INNER_WEST_GPFS_NAME = 'Inner West Council — General Purpose Financial Statements';
export const INNER_WEST_GPFS_PUBLISHER = 'Inner West Council';
export const INNER_WEST_GPFS_REPORTING_URL = 'https://www.innerwest.nsw.gov.au/annual-report';
export const INNER_WEST_GPFS_FISCAL_YEAR = '2024-25';
export const INNER_WEST_GPFS_SOURCE_DATASET = 'Inner West Council GPFS 2024-25';
export const INNER_WEST_GPFS_LICENSE =
  '© Inner West Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const INNER_WEST_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const INNER_WEST_GPFS_DELIVERY_ENTITY = 'Inner West Council';

export interface InnerWestGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The official financial-statements/annual-report page the PDF was found on. */
  listing_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface InnerWestGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface InnerWestGpfsParseContext {
  document: InnerWestGpfsDocument;
  archive: InnerWestGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface InnerWestGpfsRejection {
  section: string;
  reason: string;
}

export type InnerWestGpfsSection = 'revenue' | 'expenses' | 'result';

export interface InnerWestGpfsLineSpec {
  key: string;
  label: string;
  section: InnerWestGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'B1-1 Functions or activities';
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
 * The printed Income Statement lines we emit. The eight revenue components
 * (including the printed non-nil "Fair value increment on investment
 * properties") sum exactly to the printed total revenue. The five expense
 * components sum exactly to the printed "Total expenses ... excluding
 * depreciation, amortisation and impairment of non-financial assets" line,
 * which with the printed depreciation line bridges to the printed B1-1 expense
 * total. The printed "Fair value decrement on investment properties" line is
 * nil ("–") for FY2024-25, so it is not emitted; omitting a zero line keeps the
 * component sum exact. We do not emit the B1-1 function split: it is used only
 * for the printed B1-1 operating-result, grants and income/expense checks.
 */
export const INNER_WEST_GPFS_LINES: ReadonlyArray<InnerWestGpfsLineSpec> = [
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
    key: 'fair_value_increment_investment_properties',
    label: 'Fair value increment on investment properties',
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
    label: 'Total functions and activities',
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

export const INNER_WEST_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';
export const INNER_WEST_GPFS_OPERATING_RESULT_LABEL = 'Operating result from continuing operations';
export const INNER_WEST_GPFS_DEPRECIATION_NOTE_LABEL = 'Total depreciation and amortisation costs';

interface InnerWestGpfsLineValue {
  spec: InnerWestGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface InnerWestGpfsReconciliation {
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
  /** Printed before-capital result (negative); reconciliation evidence only. */
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

export interface InnerWestGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: InnerWestGpfsReconciliation | null;
  warnings: string[];
  rejections: InnerWestGpfsRejection[];
}

// Note references include both dashed forms (B2-1, C1-5), which must not be
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
 * Convert an Inner West annual-report link/text to a fiscal year. The index
 * labels the audited year "Annual Report 2024-25"; consecutive year ranges,
 * "2025/26" and June year-ends are handled. Anything that is not a consecutive
 * year pair is rejected.
 */
export function fiscalYearFromInnerWestGpfsLink(text: string): string | null {
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

export interface InnerWestGpfsReportPage {
  pdfUrl: string;
  title: string;
}

/**
 * Discover the audited FY2024-25 "Annual Report 2024-25" PDF from the official
 * Annual Report page. The PDF must sit on the council's official host; the URL
 * is parsed from the page HTML, never guessed. The Annual Report embeds the
 * audited General Purpose Financial Statements.
 */
export function parseInnerWestGpfsReportPage(
  html: string,
  baseUrl: string,
  fiscalYear: string = INNER_WEST_GPFS_FISCAL_YEAR,
): InnerWestGpfsReportPage | null {
  for (const anchor of anchors(html)) {
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    if (!/annual\s+report/i.test(anchor.text)) continue;
    if (fiscalYearFromInnerWestGpfsLink(`${anchor.text} ${anchor.href}`) !== fiscalYear) continue;
    let url: URL;
    try {
      url = new URL(anchor.href, baseUrl);
    } catch {
      continue;
    }
    if (!/(^|\.)innerwest\.nsw\.gov\.au$/i.test(url.hostname)) continue;
    const title = anchor.text
      .replace(/\s*\(PDF[^)]*\)\s*$/i, '')
      .replace(/\s+PDF\s*\|\s*[\d.]+\s*MB\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      pdfUrl: url.toString(),
      title: title || `Annual Report ${fiscalYear}`,
    };
  }
  return null;
}

export interface InnerWestGpfsDiscoveryOverrides {
  listingHtml?: string;
}

/** Discover the audited GPFS document from the live official page. */
export async function discoverInnerWestGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = INNER_WEST_GPFS_FISCAL_YEAR,
  overrides: InnerWestGpfsDiscoveryOverrides = {},
): Promise<InnerWestGpfsDocument> {
  let listingHtml = overrides.listingHtml;
  let listingUrl = INNER_WEST_GPFS_REPORTING_URL;
  if (listingHtml === undefined) {
    const response = await fetchImpl(INNER_WEST_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Inner West Council annual-report page fetch HTTP ${response.status} for ${INNER_WEST_GPFS_REPORTING_URL}`,
      );
    }
    listingHtml = await response.text();
    listingUrl = response.url || listingUrl;
  }
  const page = parseInnerWestGpfsReportPage(listingHtml, listingUrl, fiscalYear);
  if (!page) {
    throw new Error(
      `Inner West Council FY${fiscalYear} annual-report page has no official Annual Report PDF link; refusing to guess a document URL`,
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
export function detectInnerWestGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectInnerWestGpfsUnit([page.text]);
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
 * Read the last printed amount after a label. The expense subtotal embeds the
 * phrase "depreciation, amortisation and impairment of non-financial assets";
 * the actual depreciation line is the last occurrence on the Income Statement.
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
  spec: InnerWestGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): InnerWestGpfsLineValue | null {
  const value = spec.last_occurrence
    ? lastAmountAfter(text, spec.label)
    : firstAmountAfter(text, spec.label, spec.exclude_following);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly InnerWestGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface InnerWestGpfsFunctionsTotals {
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
export function parseInnerWestGpfsFunctionsTotals(
  page: PdfPage,
): InnerWestGpfsFunctionsTotals | null {
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

function gpfsFundingSource(spec: InnerWestGpfsLineSpec): string {
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

function printedLineLabel(spec: InnerWestGpfsLineSpec): string {
  return spec.label;
}

function notesFor(
  context: InnerWestGpfsParseContext,
  spec: InnerWestGpfsLineSpec,
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
    'the audited General Purpose Financial Statements are published inside the official Annual Report 2024-25; the independent auditor’s report on the general purpose financial statements is included in the same PDF; provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + document + line + fiscal year. */
export function innerWestGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = INNER_WEST_GPFS_FISCAL_YEAR,
): string {
  return `${INNER_WEST_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: InnerWestGpfsLineValue,
  context: InnerWestGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: INNER_WEST_GPFS_FISCAL_YEAR,
    source_id: INNER_WEST_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: innerWestGpfsNaturalKey(
      context.document.url,
      spec.key,
      INNER_WEST_GPFS_FISCAL_YEAR,
    ),
    project_name: `Inner West Council GPFS 2024-25 — ${printedLineLabel(spec)}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: INNER_WEST_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: INNER_WEST_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: INNER_WEST_GPFS_DATA_QUALITY_FLAG,
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
export function parseInnerWestGpfsExtraction(
  extraction: PdfExtraction,
  context: InnerWestGpfsParseContext,
): InnerWestGpfsParseResult {
  const warnings: string[] = [];
  const rejections: InnerWestGpfsRejection[] = [];
  const reject = (reason: string): InnerWestGpfsParseResult => {
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
    text.includes(INNER_WEST_GPFS_DEPRECIATION_NOTE_LABEL),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: InnerWestGpfsFunctionsTotals | null;
  let comprehensiveNetResult: number | null;
  let depreciationNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseInnerWestGpfsFunctionsTotals(functionsPage);
    comprehensiveNetResult = firstAmountAfter(
      normalizeText(comprehensivePage.text),
      'from Income Statement',
    );
    if (depreciationPage) {
      depreciationNoteTotal = firstAmountAfter(
        normalizeText(depreciationPage.text),
        INNER_WEST_GPFS_DEPRECIATION_NOTE_LABEL,
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
  const values: InnerWestGpfsLineValue[] = [];
  for (const spec of INNER_WEST_GPFS_LINES) {
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
  const fairValueIncrement = lineByKey(values, 'fair_value_increment_investment_properties');
  const materials = lineByKey(values, 'materials_and_services');
  const borrowing = lineByKey(values, 'borrowing_costs');
  const otherExpenses = lineByKey(values, 'other_expenses');
  const netResultBeforeCapital = firstAmountAfter(incomeText, INNER_WEST_GPFS_BEFORE_CAPITAL_LABEL);
  const operatingResult = firstAmountAfter(
    incomeText,
    INNER_WEST_GPFS_OPERATING_RESULT_LABEL,
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
    ['fair_value_increment_investment_properties', fairValueIncrement],
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
    otherIncome! +
    fairValueIncrement!;
  const expenseComponentsSum =
    employee! + materials! + borrowing! + otherExpenses! + netLossDisposal!;
  // Total expenses is the printed B1-1 "Total functions and activities" expense
  // total; it also equals the printed expenses-excluding-depreciation line plus
  // the printed depreciation line.
  const totalExpenses = functionsTotals.expenses;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;

  const totalExpensesLine: InnerWestGpfsLineValue = {
    spec: INNER_WEST_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
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
      'printed depreciation/impairment line = note B3-3 total',
      depreciation!,
      depreciationNoteTotal,
    );
  }
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: InnerWestGpfsReconciliation = {
    fiscal_year: INNER_WEST_GPFS_FISCAL_YEAR,
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
      'the Income Statement depreciation/impairment line equals the note B3-3 total',
      'the printed net result is positive and stored as a non-negative magnitude; the negative before-capital result is reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the printed B1-1 Total functions and activities expense total (325,583), which equals printed expenses-excluding-depreciation (286,616) plus printed depreciation and impairment (38,967) and printed total income (368,386) less the printed operating result (42,803); the printed net result (42,803) equals the printed operating result and is repeated in the Statement of Comprehensive Income; the printed before-capital result (-4,581) equals printed net result less printed capital grants (47,384) and is reconciliation evidence only (not emitted, because the model stores non-negative cents); the printed revenue and expense components sum exactly to their printed subtotals (the printed fair-value decrement on investment properties is nil and is not emitted); the B1-1 totals and note B3-3 depreciation/amortisation total reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface InnerWestGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: InnerWestGpfsDocument;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched discovery input; the connector still selects the official link. */
  listingHtml?: string;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name) && /inner|annual|financial|report/i.test(name)) {
      // The publisher's CMS name can change; use the stable archive name so a
      // re-download never creates a second copy.
      return 'inner-west-council-annual-report-2024-25-gpfs.pdf';
    }
  } catch {
    // Fall through to the stable name.
  }
  return 'inner-west-council-annual-report-2024-25-gpfs.pdf';
}

/** Build the live Inner West Council GPFS connector. */
export function createInnerWestGpfsConnector(
  options: InnerWestGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: INNER_WEST_GPFS_ID,
    name: INNER_WEST_GPFS_NAME,
    publisher: INNER_WEST_GPFS_PUBLISHER,
    source_url: INNER_WEST_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: INNER_WEST_GPFS_LICENSE,
    notes:
      "Twentieth NSW council GPFS adapter: one council only (Inner West Council), audited FY2024-25 General Purpose Financial Statements published inside the official 'Annual Report 2024-25'. The council's Annual Report page states the report includes Council's financial report audited by the NSW Audit Office, and the PDF includes the independent auditor's report on the general purpose financial statements. The PDF is discovered from that official page (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverInnerWestGpfsDocument(fetchImpl, INNER_WEST_GPFS_FISCAL_YEAR, {
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
            `Inner West Council annual-report fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: InnerWestGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: INNER_WEST_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Inner West Council FY2024-25 General Purpose Financial Statements, published inside the official Annual Report 2024-25; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: InnerWestGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: INNER_WEST_GPFS_REPORTING_URL,
      };
      const parsed = parseInnerWestGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'inner-west-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'inner-west-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not an Inner West Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
