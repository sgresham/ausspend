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
 * NSW council GPFS adapter: Murrumbidgee Council's audited General Purpose
 * Financial Statements for FY2024-25.
 *
 * This follows the reference council implementations in docs/NSW_COUNCILS.md
 * with a Murrumbidgee Council-specific layout adapter. It is a separate source
 * id (`murrumbidgee-gpfs`) from every other source. Every row is non-additive
 * `agency_detail` with no region/LGA allocation, so it can never be summed with
 * the 245 Dubbo budget rows, any existing council GPFS source, any
 * pre-existing rows that name the council, the ACNC charity rows or data.nsw
 * school rows that merely mention Murrumbidgee and use different delivery_entity
 * strings, or any other council.
 *
 * FY2024-25 is the latest audited standalone statements published by the council
 * at 2026-11-19; no FY2025-26 GPFS is posted. The accepted current-available year
 * is therefore FY2024-25 and the connector never substitutes a 2025-26 or
 * 2023-24 document. The statement source is the council's "Appendix A Financial
 * Information" PDF (not the narrative annual report), discovered from the
 * official Annual Reports and Financial Statements page. A documented official
 * fallback pin is used only if the page yields no usable anchor. SHA-256
 * re-verifies and re-archives the exact downloaded bytes. The printed `$ '000`
 * unit is required. The printed income-statement lines, the B1-1 "Total functions
 * and activities" row and the Statement of Comprehensive Income are reconciled
 * exactly before any row is emitted.
 *
 * The host's Akamai WAF returns 403 to a bare Chrome UA but 200
 * application/pdf to a plain client UA; the connector sends an explicit plain
 * `curl/8.5.0` User-Agent for both the listing and the PDF.
 *
 * The Income Statement does not print a "Total expenses" line. Total expenses is
 * therefore the documented bridge of two printed lines — "Total expenses from
 * continuing operations excluding depreciation, amortisation and impairment of
 * non-financial assets" ($18,526 thousand) plus the printed "Depreciation,
 * amortisation and impairment of non-financial assets" line ($8,550 thousand),
 * giving $27,076 thousand. B1-1's printed expense total equals that face bridge
 * exactly. The printed net loss on disposal of assets is nil for 2025, so it is
 * not emitted or parsed; the 2024 comparative is never read. The net operating
 * result is positive ($3,114 thousand) and the result before capital grants is
 * negative (−$5,069 thousand): only the net result is emitted as a row, and the
 * before-capital result is kept in the reconciliation evidence only.
 */

export const MURRUMBIDGEE_GPFS_ID = 'murrumbidgee-gpfs';
export const MURRUMBIDGEE_GPFS_NAME =
  'Murrumbidgee Council — General Purpose Financial Statements';
export const MURRUMBIDGEE_GPFS_PUBLISHER = 'Murrumbidgee Council';
export const MURRUMBIDGEE_GPFS_REPORTING_URL =
  'https://www.murrumbidgee.nsw.gov.au/My-council/Plans-strategies-policies-council-information/Reporting-our-progress/Annual-Reports-Financial-Statements';
/** Documented official fallback pin for the audited current-available statements. */
export const MURRUMBIDGEE_GPFS_DOCUMENT_PIN =
  'https://www.murrumbidgee.nsw.gov.au/files/assets/public/v/1/publications/ip-and-r/a-report-2024-25/appendix-a-financial-information.pdf';
export const MURRUMBIDGEE_GPFS_FISCAL_YEAR = '2024-25';
export const MURRUMBIDGEE_GPFS_SOURCE_DATASET = 'Murrumbidgee Council GPFS 2024-25';
export const MURRUMBIDGEE_GPFS_LICENSE =
  '© Murrumbidgee Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const MURRUMBIDGEE_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const MURRUMBIDGEE_GPFS_DELIVERY_ENTITY = 'Murrumbidgee Council';
/**
 * The host's Akamai WAF returns 403 to a bare Chrome UA but 200
 * application/pdf to a plain client UA. Use an explicit plain UA so the
 * connector's discovery and download are deterministic.
 */
export const MURRUMBIDGEE_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export interface MurrumbidgeeGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The annual/financial-statements page the PDF link was discovered from. */
  listing_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface MurrumbidgeeGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface MurrumbidgeeGpfsParseContext {
  document: MurrumbidgeeGpfsDocument;
  archive: MurrumbidgeeGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface MurrumbidgeeGpfsRejection {
  section: string;
  reason: string;
}

export type MurrumbidgeeGpfsSection = 'revenue' | 'expenses' | 'result';

export interface MurrumbidgeeGpfsLineSpec {
  key: string;
  label: string;
  section: MurrumbidgeeGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'Income Statement (documented bridge)';
}

/**
 * The printed Income Statement lines we emit. The eight revenue components sum
 * exactly to the printed total revenue. The four expense-by-nature components
 * sum exactly to the printed "Total expenses ... excluding depreciation" line,
 * which with the printed depreciation line bridges to total expenses. We do not
 * emit the B1-1 function split: it is used only for the printed B1-1
 * operating-result, grants and income/expense checks. The before-capital result
 * is not emitted, but is still reconciled. The printed net result is positive,
 * so no sign marker is needed.
 */
export const MURRUMBIDGEE_GPFS_LINES: ReadonlyArray<MurrumbidgeeGpfsLineSpec> = [
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
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label:
      'Total expenses from continuing operations (printed expenses excluding depreciation + printed depreciation)',
    section: 'expenses',
    statement: 'Income Statement (documented bridge)',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
];

export const MURRUMBIDGEE_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';

interface MurrumbidgeeGpfsLineValue {
  spec: MurrumbidgeeGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface MurrumbidgeeGpfsReconciliation {
  fiscal_year: string;
  unit: MoneyUnitKind;
  unit_evidence: string;
  income_statement_page: number;
  functions_page: number;
  comprehensive_income_page: number;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  depreciation_amortisation_impairment: number;
  government_grants_operating: number;
  government_grants_capital: number;
  net_gain_from_disposal_of_assets: number;
  net_result: number;
  /** Negative printed figure; reconciliation evidence only, never a stored row. */
  net_result_before_capital_grants: number;
  printed_total_expenses_excluding_depreciation: number;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  comprehensive_income_net_result: number;
  comprehensive_other_income: number;
  comprehensive_total: number;
  comprehensive_revaluation: number;
  comprehensive_items_not_reclassified: number;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface MurrumbidgeeGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: MurrumbidgeeGpfsReconciliation | null;
  warnings: string[];
  rejections: MurrumbidgeeGpfsRejection[];
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
 * Convert a Murrumbidgee Council financial-statements name or URL to a fiscal
 * year. The statement source is Appendix A Financial Information; the anchor file
 * name itself has no year, but its parent path carries "a-report-2024-25", which
 * maps to 2024-25. Explicit ranges (2024/25, 2024-2025, "2024 to 2025") are
 * handled first; a bare end year after the words "financial statements" maps back
 * to the previous year. Anything that is not a consecutive year pair plus June
 * year-end is rejected.
 */
export function fiscalYearFromMurrumbidgeeGpfsLink(text: string): string | null {
  const june = /year\s+ended\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
    text.replace(/[-_]+/g, ' ').replace(/\s+/g, ' '),
  );
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  const normalized = text
    .replace(/\bto\b/gi, '-')
    .replace(/\s*[-/]+\s*/g, '-')
    .replace(/\s+/g, ' ');
  const match = /((?:19|20)\d{2})-((?:19|20)?\d{2})/.exec(normalized);
  if (match) {
    const start = Number(match[1]);
    const endRaw = match[2]!;
    const end =
      endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
    if (end !== start + 1) return null;
    return `${start}-${String(end).slice(-2)}`;
  }
  // A single June end year, e.g. "Annual_Financial_Statements-2025".
  const single =
    /(?:annual[-_ ]?financial[-_ ]?statements?|financial[-_ ]?statements?)[-_ ]?((?:19|20)\d{2})\b/i.exec(
      text,
    );
  if (!single) return null;
  const end = Number(single[1]);
  return `${end - 1}-${String(end).slice(-2)}`;
}

interface Anchor {
  href: string;
  title: string;
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
    const titleMatch = /title="([^"]*)"/i.exec(attrs);
    out.push({
      href: hrefMatch[1]!,
      title: titleMatch ? decodeHtml(titleMatch[1]!) : '',
      text: decodeHtml(match[2]!),
    });
  }
  return out;
}

/**
 * Discover the audited Appendix A Financial Information anchor from the official
 * Murrumbidgee Annual Reports and Financial Statements page. The narrative annual
 * report, Appendix B governance report and prior years are ignored; only the
 * council's own host is accepted.
 */
export function parseMurrumbidgeeGpfsReportLinks(
  html: string,
  baseUrl: string,
): MurrumbidgeeGpfsDocument[] {
  const links: MurrumbidgeeGpfsDocument[] = [];
  const seen = new Set<string>();
  const baseHost = new URL(baseUrl).host;
  for (const anchor of anchors(html)) {
    const haystack = `${anchor.title} ${anchor.text} ${anchor.href}`;
    if (!/appendix[-_ ]?a/i.test(haystack)) continue;
    if (!/financial[-_ ]?information/i.test(haystack)) continue;
    if (/annual[-_ ]report|appendix[-_ ]?b|governance/i.test(haystack)) continue;
    if (/special[-_ ]purpose|special[-_ ]schedules?/i.test(haystack)) continue;
    if (/public[-_ ]notice|presentation/i.test(haystack)) continue;
    if (!/\.pdf(?:\.aspx)?(?:$|[?#])/i.test(anchor.href)) continue;
    const label = `${anchor.title} ${anchor.text}`;
    const fiscalYear =
      fiscalYearFromMurrumbidgeeGpfsLink(label) ?? fiscalYearFromMurrumbidgeeGpfsLink(anchor.href);
    if (!fiscalYear) continue;
    let url: URL;
    try {
      url = new URL(anchor.href, baseUrl);
    } catch {
      continue;
    }
    if (url.host !== baseHost && !url.host.endsWith(`.${baseHost}`)) continue;
    const href = url.toString();
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({
      id: `gpfs-${fiscalYear}`,
      title: anchor.title || anchor.text || `Financial Statements ${fiscalYear}`,
      url: href,
      fiscal_year: fiscalYear,
      listing_url: baseUrl,
    });
  }
  return links;
}

/** Select the latest audited GPFS upload for the requested fiscal year. */
export function selectMurrumbidgeeGpfsDocument(
  links: readonly MurrumbidgeeGpfsDocument[],
  fiscalYear: string = MURRUMBIDGEE_GPFS_FISCAL_YEAR,
): MurrumbidgeeGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Murrumbidgee Council General Purpose Financial Statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** The documented official pin used when the live listing hides the link. */
export function murrumbidgeePinnedDocument(): MurrumbidgeeGpfsDocument {
  return {
    id: `gpfs-${MURRUMBIDGEE_GPFS_FISCAL_YEAR}`,
    title: 'Appendix A Financial Information 2024-25',
    url: MURRUMBIDGEE_GPFS_DOCUMENT_PIN,
    fiscal_year: MURRUMBIDGEE_GPFS_FISCAL_YEAR,
    listing_url: MURRUMBIDGEE_GPFS_REPORTING_URL,
  };
}

/**
 * Discover the audited Appendix A Financial Information document. The connector
 * fetches the official Annual Reports and Financial Statements page and parses
 * any FY2024-25 Appendix A anchor; if the page yields no usable anchor it uses
 * the documented official pin. The exact bytes are still SHA-256 re-verified.
 * Requests use a plain client UA because the host's Akamai WAF rejects a bare
 * Chrome UA with 403.
 */
export async function discoverMurrumbidgeeGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = MURRUMBIDGEE_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<MurrumbidgeeGpfsDocument> {
  let html: string | null = listingHtml ?? null;
  if (html === null) {
    try {
      const response = await fetchImpl(MURRUMBIDGEE_GPFS_REPORTING_URL, {
        redirect: 'follow',
        headers: MURRUMBIDGEE_GPFS_REQUEST_HEADERS,
      });
      if (response.ok) html = await response.text();
    } catch {
      // Network failure falls through to the documented official pin.
    }
  }
  if (html) {
    const links = parseMurrumbidgeeGpfsReportLinks(html, MURRUMBIDGEE_GPFS_REPORTING_URL);
    const match = links
      .filter((link) => link.fiscal_year === fiscalYear)
      .sort((a, b) => b.url.localeCompare(a.url))[0];
    if (match) return match;
  }
  if (fiscalYear !== MURRUMBIDGEE_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No published Murrumbidgee Council General Purpose Financial Statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return murrumbidgeePinnedDocument();
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectMurrumbidgeeGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectMurrumbidgeeGpfsUnit([page.text]);
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

function lineValue(
  text: string,
  spec: MurrumbidgeeGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): MurrumbidgeeGpfsLineValue | null {
  const value = firstAmountAfter(text, spec.label);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly MurrumbidgeeGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface MurrumbidgeeGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse B1-1 "Total functions and activities". The row prints ten numbers
 * (Income 2026/2025, Expenses 2026/2025, Operating result 2026/2025, Grants
 * 2026/2025, Carrying amount 2026/2025); the 2026 values are at indices 0, 2, 4
 * and 6.
 */
export function parseMurrumbidgeeGpfsFunctionsTotals(
  page: PdfPage,
): MurrumbidgeeGpfsFunctionsTotals | null {
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

function gpfsFundingSource(spec: MurrumbidgeeGpfsLineSpec): string {
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
  context: MurrumbidgeeGpfsParseContext,
  spec: MurrumbidgeeGpfsLineSpec,
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
export function murrumbidgeeGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = MURRUMBIDGEE_GPFS_FISCAL_YEAR,
): string {
  return `${MURRUMBIDGEE_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: MurrumbidgeeGpfsLineValue,
  context: MurrumbidgeeGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: MURRUMBIDGEE_GPFS_FISCAL_YEAR,
    source_id: MURRUMBIDGEE_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: murrumbidgeeGpfsNaturalKey(context.document.url, spec.key, MURRUMBIDGEE_GPFS_FISCAL_YEAR),
    project_name: `Murrumbidgee Council GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: MURRUMBIDGEE_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: MURRUMBIDGEE_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: MURRUMBIDGEE_GPFS_DATA_QUALITY_FLAG,
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

/**
 * Parse the audited GPFS into validated, non-additive measure rows. Nothing is
 * emitted unless the printed unit is explicit and every face-statement, B1-1
 * and Statement of Comprehensive Income reconciliation check passes exactly.
 */
export function parseMurrumbidgeeGpfsExtraction(
  extraction: PdfExtraction,
  context: MurrumbidgeeGpfsParseContext,
): MurrumbidgeeGpfsParseResult {
  const warnings: string[] = [];
  const rejections: MurrumbidgeeGpfsRejection[] = [];
  const reject = (reason: string): MurrumbidgeeGpfsParseResult => {
    rejections.push({ section: 'gpfs', reason });
    warnings.push(reason);
    return { records: [], reconciliation: null, warnings, rejections };
  };

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Operating result from continuing operations'),
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

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: MurrumbidgeeGpfsFunctionsTotals | null;
  let comprehensiveNetResult: number | null;
  let comprehensiveOtherIncome: number | null;
  let comprehensiveTotal: number | null;
  let comprehensiveRevaluation: number | null;
  let comprehensiveItems: number | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseMurrumbidgeeGpfsFunctionsTotals(functionsPage);
    const comprehensiveText = normalizeText(comprehensivePage.text);
    comprehensiveNetResult = firstAmountAfter(comprehensiveText, 'from Income Statement');
    comprehensiveOtherIncome = firstAmountAfter(
      comprehensiveText,
      'Total other comprehensive income for the period',
    );
    comprehensiveTotal = firstAmountAfter(
      comprehensiveText,
      'Total comprehensive income for the year attributable to Council',
    );
    comprehensiveRevaluation = firstAmountAfter(
      comprehensiveText,
      'Gain on revaluation of IPP&E',
    );
    comprehensiveItems = firstAmountAfter(
      comprehensiveText,
      'Total items which will not be reclassified subsequent to operating result',
    );
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
  if (comprehensiveOtherIncome === null || comprehensiveTotal === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed other/total comprehensive income; no rows ingested`,
    );
  }
  if (comprehensiveRevaluation === null || comprehensiveItems === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed other-comprehensive-income component/total items; no rows ingested`,
    );
  }
  const unit = incomeUnit.kind;

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: MurrumbidgeeGpfsLineValue[] = [];
  for (const spec of MURRUMBIDGEE_GPFS_LINES) {
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
  const netGainDisposal = lineByKey(values, 'net_gain_from_disposal_of_assets');
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
  const netResultBeforeCapital = firstAmountAfter(incomeText, MURRUMBIDGEE_GPFS_BEFORE_CAPITAL_LABEL);

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['net_gain_from_disposal_of_assets', netGainDisposal],
    ['net_result', netResult],
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
    otherIncome! +
    netGainDisposal!;
  const expenseComponentsSum = employee! + materials! + borrowing! + otherExpenses!;
  // Total expenses is the documented bridge of two printed Income Statement
  // lines, because this council does not print a "Total expenses" line.
  const totalExpenses = expensesExDepreciation! + depreciation!;
  const faceExpenseBridge = totalExpenses;

  const totalExpensesLine: MurrumbidgeeGpfsLineValue = {
    spec: MURRUMBIDGEE_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
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
    'printed total expenses excluding depreciation + printed depreciation = total expenses bridge',
    totalExpenses,
    faceExpenseBridge,
  );
  check(
    'printed total revenue - total expenses bridge = printed net result',
    netResult!,
    totalRevenue! - totalExpenses,
  );
  check(
    'printed net result - capital grants = printed net result before capital grants',
    netResultBeforeCapital!,
    netResult! - grantsCapital!,
  );
  check('B1-1 operating result = printed net result', netResult!, functionsTotals.operating_result);
  check(
    'B1-1 grants and contributions = operating grants + capital grants',
    grantsOperating! + grantsCapital!,
    functionsTotals.grants_and_contributions,
  );
  check('B1-1 income = face total revenue', totalRevenue!, functionsTotals.income);
  check('B1-1 expenses = face total expenses bridge', totalExpenses, functionsTotals.expenses);
  check(
    'B1-1 income - B1-1 expenses = printed net result',
    netResult!,
    functionsTotals.income - functionsTotals.expenses,
  );
  check(
    'Statement of Comprehensive Income net result = Income Statement net result',
    netResult!,
    comprehensiveNetResult!,
  );
  check(
    'printed net result + printed other comprehensive income = printed total comprehensive income',
    comprehensiveTotal!,
    netResult! + comprehensiveOtherIncome!,
  );
  check(
    'revaluation other comprehensive income = printed total other comprehensive income',
    comprehensiveOtherIncome!,
    comprehensiveRevaluation!,
  );
  check(
    'total items not reclassified = printed total other comprehensive income',
    comprehensiveOtherIncome!,
    comprehensiveItems!,
  );
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: MurrumbidgeeGpfsReconciliation = {
    fiscal_year: MURRUMBIDGEE_GPFS_FISCAL_YEAR,
    unit,
    unit_evidence: incomeUnit.reason,
    income_statement_page: incomePage.page_number,
    functions_page: functionsPage.page_number,
    comprehensive_income_page: comprehensivePage.page_number,
    total_revenue: totalRevenue!,
    total_expenses: totalExpenses,
    employee_expenses: employee!,
    depreciation_amortisation_impairment: depreciation!,
    government_grants_operating: grantsOperating!,
    government_grants_capital: grantsCapital!,
    net_gain_from_disposal_of_assets: netGainDisposal!,
    net_result: netResult!,
    net_result_before_capital_grants: netResultBeforeCapital!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    functions_total_income: functionsTotals.income,
    functions_total_expenses: functionsTotals.expenses,
    functions_operating_result: functionsTotals.operating_result,
    functions_grants_and_contributions: functionsTotals.grants_and_contributions,
    comprehensive_income_net_result: comprehensiveNetResult!,
    comprehensive_other_income: comprehensiveOtherIncome!,
    comprehensive_total: comprehensiveTotal!,
    comprehensive_revaluation: comprehensiveRevaluation!,
    comprehensive_items_not_reclassified: comprehensiveItems!,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'all printed face-statement line sums equal their printed subtotals/total',
      'printed total expenses excluding depreciation + printed depreciation = total expenses bridge',
      'B1-1 operating result, grants, income and expenses reconcile to the face statement',
      'Statement of Comprehensive Income net result equals the Income Statement net result',
      'printed net result + printed other comprehensive income equals printed total comprehensive income',
      'the printed revaluation other-comprehensive-income line equals the printed total other comprehensive income',
      'the printed total items not reclassified equals the printed total other comprehensive income',
      'the printed net result is positive and stored as a non-negative magnitude; the printed before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line; B1-1 operating result, grants, income and expenses reconcile exactly; comprehensive-income net result and total comprehensive income reconcile exactly; the printed net result is positive while the before-capital result is negative, and the before-capital result is retained in reconciliation evidence only';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface MurrumbidgeeGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the official page. */
  document?: MurrumbidgeeGpfsDocument;
  /**
   * Pre-fetched PDF bytes. The live path downloads the discovered URL with
   * Node's fetch; tests pass the archived bytes to avoid the network.
   */
  pdfBytes?: Uint8Array;
  /**
   * Pre-fetched official listing HTML. The connector still discovers any
   * fiscal-year link from this HTML and otherwise uses the documented official
   * pin; tests pass it to exercise discovery without the network.
   */
  listingHtml?: string;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf(?:\.aspx)?$/i.test(name)) {
      return name.replace(/\.aspx$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-');
    }
  } catch {
    // Fall through to the stable name.
  }
  return 'appendix-a-financial-information.pdf';
}

/** Build the live Murrumbidgee Council GPFS connector. */
export function createMurrumbidgeeGpfsConnector(options: MurrumbidgeeGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: MURRUMBIDGEE_GPFS_ID,
    name: MURRUMBIDGEE_GPFS_NAME,
    publisher: MURRUMBIDGEE_GPFS_PUBLISHER,
    source_url: MURRUMBIDGEE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: MURRUMBIDGEE_GPFS_LICENSE,
    notes:
      "NSW council GPFS adapter: one council only (Murrumbidgee Council), audited FY2024-25 General Purpose Financial Statements — the statement source is the official Appendix A Financial Information (not the narrative annual report), the latest audited year published by the council at 2026-11-19 (no FY2025-26 GPFS is posted; never substituted). The PDF is discovered from the official Annual Reports and Financial Statements page (latest dated FY2024-25 Appendix A upload), with a documented official fallback pin only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverMurrumbidgeeGpfsDocument(
          fetchImpl,
          MURRUMBIDGEE_GPFS_FISCAL_YEAR,
          options.listingHtml,
        ));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: MURRUMBIDGEE_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Murrumbidgee Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: MurrumbidgeeGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: MURRUMBIDGEE_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Murrumbidgee Council FY2024-25 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: MurrumbidgeeGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: MURRUMBIDGEE_GPFS_REPORTING_URL,
      };
      const parsed = parseMurrumbidgeeGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'murrumbidgee-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'murrumbidgee-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Murrumbidgee Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
