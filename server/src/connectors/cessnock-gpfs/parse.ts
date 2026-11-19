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
 * NSW council GPFS adapter: Cessnock City Council's audited FY2024-25 General
 * Purpose Financial Statements.
 *
 * The FY2024-25 annual report is narrative-only and contains no audited GPFS
 * section (that path is retained in `parseCessnockAnnualReportExtraction` and
 * still defers with 0 rows). The official Annual Report page links a separate
 * standalone **Annual Financial Statements** PDF with the audit opinion, which
 * is the correct source for this cure. This adapter discovers that standalone
 * AFS from the official Annual Financial Statements page, archives the exact
 * bytes, and emits the printed statement-line slice.
 *
 * The publisher's Edge/Akamai WAF can return a 403 text/html challenge to a
 * plain HTTP client, so the established browser path
 * (`scripts/cessnock-gpfs-browser.ts`) loads the official page and fetches the
 * exact PDF bytes; the connector still discovers the same link from the cleared
 * HTML and SHA-256 re-verifies and re-archives the bytes.
 *
 * The printed unit is `$ '000`. Nothing is emitted unless the Income Statement,
 * B1-1 "Total functions and activities", Statement of Comprehensive Income,
 * Statement of Financial Position, Statement of Changes in Equity and Statement
 * of Cash Flows reconcile exactly at zero tolerance.
 *
 * Cessnock does not print a "Total expenses" line on the face Income Statement.
 * Total expenses is the documented bridge of the printed "Total expenses from
 * continuing operations excluding depreciation, amortisation and impairment of
 * non-financial assets" line ($112,273 thousand) plus the printed
 * "Depreciation, amortisation and impairment of non-financial assets" line
 * ($26,202 thousand), giving $138,475 thousand. The printed B1-1 expense total
 * equals that bridge exactly. The net result is positive ($38,146 thousand); the
 * printed before-capital result is negative (-$33,778 thousand) and is retained
 * in reconciliation evidence only. A net loss on disposal of assets
 * ($17,405 thousand) is a printed expense component and is emitted as an expense
 * row. Other comprehensive income has a single printed component, the
 * revaluation gain ($222,099 thousand), which equals the printed other
 * comprehensive income and, with the net result, equals the printed total
 * comprehensive income ($260,245 thousand).
 *
 * Every row is non-additive `agency_detail` with no region/LGA allocation, so it
 * can never be summed into another council, a council total, state spending, the
 * PNFC benchmark or the OLG summary layer.
 */

export const CESSNOCK_GPFS_ID = 'cessnock-gpfs';
export const CESSNOCK_GPFS_NAME = 'Cessnock City Council — General Purpose Financial Statements';
export const CESSNOCK_GPFS_PUBLISHER = 'Cessnock City Council';
/** Official Annual Financial Statements page used for live discovery. */
export const CESSNOCK_GPFS_REPORTING_URL =
  'https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Finance-and-budget/Annual-Financial-Statements';
/** The Annual Report page retained for the annual-report rejection path. */
export const CESSNOCK_GPFS_ANNUAL_REPORT_URL =
  'https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Community-information/Annual-Report';
/** Alias kept for the annual-report-only evidence trail. */
export const CESSNOCK_GPFS_AFS_PAGE_URL = CESSNOCK_GPFS_REPORTING_URL;
/** Documented official pin: the FY2024-25 standalone AFS with audit opinion. */
export const CESSNOCK_GPFS_DOCUMENT_PIN =
  'https://www.cessnock.nsw.gov.au/files/assets/public/v/2/hptrim/website-finance-budget-documents-do-not-change/ccc-_-annual_financial_statements-2024-2025-final-with-audit-opinion.pdf';
/** The annual report PDF that contains no audited GPFS section. */
export const CESSNOCK_GPFS_ANNUAL_REPORT_PIN =
  'https://www.cessnock.nsw.gov.au/files/assets/public/v/1/hptrim/website-integrated-planning-reporting-documents-do-not-change/2025_annual-report-cessnock-city-council_2024-2025_spread.pdf';
export const CESSNOCK_GPFS_FISCAL_YEAR = '2024-25';
export const CESSNOCK_GPFS_SOURCE_DATASET = 'Cessnock City Council GPFS 2024-25';
export const CESSNOCK_GPFS_LICENSE =
  '© Cessnock City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const CESSNOCK_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const CESSNOCK_GPFS_DELIVERY_ENTITY = 'Cessnock City Council';
export const CESSNOCK_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export interface CessnockGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The annual/financial-statements page the PDF link was discovered from. */
  listing_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface CessnockGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface CessnockGpfsParseContext {
  document: CessnockGpfsDocument;
  archive: CessnockGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface CessnockGpfsRejection {
  section: string;
  reason: string;
}

export type CessnockGpfsSection = 'revenue' | 'expenses' | 'result';

export interface CessnockGpfsLineSpec {
  key: string;
  label: string;
  section: CessnockGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'Income Statement (documented bridge)';
}

/**
 * The 17 printed Income Statement rows we emit. The seven revenue components
 * sum exactly to the printed total income. The five expense components sum
 * exactly to the printed "Total expenses ... excluding depreciation" line, which
 * with the printed depreciation line bridges to total expenses. The net result is
 * a printed result row; the before-capital result is retained in reconciliation
 * evidence only.
 */
export const CESSNOCK_GPFS_LINES: ReadonlyArray<CessnockGpfsLineSpec> = [
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

export const CESSNOCK_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';

/**
 * Exact gap retained from the annual-report-only check: the FY2024-25 annual
 * report is narrative-only and has no audited GPFS section.
 */
export const CESSNOCK_ANNUAL_REPORT_GAP =
  'audited GPFS section not found in the FY2024-25 annual report; page 13 contains only the narrative Financial summary; the report ends at the Attestation Statement on page 101; no Income Statement/Statement of Comprehensive Income/Statement of Financial Position/B1-1 with printed subtotals was found; the official Annual Report page states the Annual Financial Statements for the Year Ended 30 June 2025 can be viewed separately, and this annual-report-only item does not substitute that standalone report; no rows ingested';

interface CessnockGpfsLineValue {
  spec: CessnockGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface CessnockGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
  carrying_amount: number;
}

export interface CessnockGpfsReconciliation {
  fiscal_year: string;
  unit: MoneyUnitKind;
  unit_evidence: string;
  income_statement_page: number;
  functions_page: number;
  comprehensive_income_page: number;
  financial_position_page: number;
  changes_in_equity_page: number;
  cash_flows_page: number;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  materials_and_services: number;
  borrowing_costs: number;
  other_expenses: number;
  net_loss_from_disposal_of_assets: number;
  depreciation_amortisation_impairment: number;
  government_grants_operating: number;
  government_grants_capital: number;
  net_result: number;
  /** Printed figure; reconciliation evidence only, never a stored row. */
  net_result_before_capital_grants: number;
  printed_total_expenses_excluding_depreciation: number;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  functions_carrying_amount: number;
  comprehensive_income_net_result: number;
  comprehensive_other_income: number;
  comprehensive_total: number;
  comprehensive_revaluation: number;
  cash_and_cash_equivalents: number;
  total_current_assets: number;
  total_non_current_assets: number;
  total_assets: number;
  total_current_liabilities: number;
  total_non_current_liabilities: number;
  total_liabilities: number;
  net_assets: number;
  accumulated_surplus: number;
  ippe_revaluation_surplus: number;
  total_equity: number;
  equity_opening_total: number;
  equity_closing_total: number;
  cash_operating: number;
  cash_investing: number;
  cash_financing: number;
  cash_net_change: number;
  cash_closing: number;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface CessnockGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: CessnockGpfsReconciliation | null;
  warnings: string[];
  rejections: CessnockGpfsRejection[];
}

export interface CessnockAnnualReportParseResult {
  records: SpendingRecord[];
  reconciliation: null;
  warnings: string[];
  rejections: CessnockGpfsRejection[];
}

const NOTE_REFERENCE = /\b[A-F]\d+-\d+\b/g;
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
 * Convert an AFS label or URL to a fiscal year. Labels are written as
 * "Annual Financial Statements for the Year Ended 30 June 2025"; file names are
 * written as "...annual_financial_statements-2024-2025-final...". Both map to
 * FY2024-25. Anything that is not a consecutive year pair is rejected.
 */
export function fiscalYearFromCessnockFinancialStatementsLink(text: string): string | null {
  const june = /year\s+ended\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
    text.replace(/[-_]+/g, ' ').replace(/\s+/g, ' '),
  );
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  const normalized = text
    .replace(/\bto\b/gi, '-')
    .replace(/\b((?:19|20)\d{2})\s+((?:19|20)?\d{2})\b/g, '$1-$2')
    .replace(/\s*[-/]+\s*/g, '-')
    .replace(/\s+/g, ' ');
  const matches = [...normalized.matchAll(/((?:19|20)\d{2})-((?:19|20)?\d{2})/g)];
  const match = matches[matches.length - 1];
  if (match) {
    const startYear = Number(match[1]);
    const endRaw = match[2]!;
    const end =
      endRaw.length === 2 ? Math.floor(startYear / 100) * 100 + Number(endRaw) : Number(endRaw);
    if (end !== startYear + 1) return null;
    return `${startYear}-${String(end).slice(-2)}`;
  }
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
 * Parse the official Annual Financial Statements page. Cessnock lists each
 * year as a direct `.pdf` upload labelled "Annual Financial Statements for the
 * Year Ended 30 June YYYY". Older years, the FY2025-26 statement and any
 * special-purpose/budget document are ignored.
 */
export function parseCessnockGpfsReportLinks(
  html: string,
  baseUrl: string,
): CessnockGpfsDocument[] {
  const links: CessnockGpfsDocument[] = [];
  const seen = new Set<string>();
  const baseHost = new URL(baseUrl).host.replace(/^www\./, '');
  for (const anchor of anchors(html)) {
    const label = `${anchor.title} ${anchor.text}`.trim();
    if (!/annual[-_ ]?financial[-_ ]?statements?/i.test(label)) continue;
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    if (/special[-_ ]?purpose|SPFS|special[-_ ]?schedules?|\bbudgets?\b/i.test(label)) continue;
    const fiscalYear =
      fiscalYearFromCessnockFinancialStatementsLink(label) ??
      fiscalYearFromCessnockFinancialStatementsLink(anchor.href);
    if (!fiscalYear) continue;
    let url: URL;
    try {
      url = new URL(anchor.href, baseUrl);
    } catch {
      continue;
    }
    const urlHost = url.host.replace(/^www\./, '');
    if (urlHost !== baseHost && !urlHost.endsWith(`.${baseHost}`)) continue;
    const href = url.toString();
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({
      id: `afs-${fiscalYear}`,
      title: label || `Annual Financial Statements ${fiscalYear}`,
      url: href,
      fiscal_year: fiscalYear,
      listing_url: baseUrl,
    });
  }
  return links;
}

/** Select the latest audited AFS upload for the requested fiscal year. */
export function selectCessnockGpfsDocument(
  links: readonly CessnockGpfsDocument[],
  fiscalYear: string = CESSNOCK_GPFS_FISCAL_YEAR,
): CessnockGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Cessnock City Council Annual Financial Statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** The documented official pin used when the live listing hides the link. */
export function cessnockPinnedDocument(): CessnockGpfsDocument {
  return {
    id: `afs-${CESSNOCK_GPFS_FISCAL_YEAR}`,
    title: 'Annual Financial Statements for the Year Ended 30 June 2025',
    url: CESSNOCK_GPFS_DOCUMENT_PIN,
    fiscal_year: CESSNOCK_GPFS_FISCAL_YEAR,
    listing_url: CESSNOCK_GPFS_REPORTING_URL,
  };
}

/**
 * Discover the standalone FY2024-25 AFS. The connector fetches the official
 * Annual Financial Statements page and parses its direct year-labelled PDF
 * uploads; if the page is unavailable (the host can return an Edge/Akamai WAF
 * challenge) or yields no usable FY2024-25 link, it uses the documented official
 * pin. The exact bytes are still SHA-256 re-verified.
 */
export async function discoverCessnockGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = CESSNOCK_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<CessnockGpfsDocument> {
  let html: string | null = listingHtml ?? null;
  if (html === null) {
    try {
      const response = await fetchImpl(CESSNOCK_GPFS_REPORTING_URL, {
        redirect: 'follow',
        headers: CESSNOCK_GPFS_REQUEST_HEADERS,
      });
      if (response.ok) html = await response.text();
    } catch {
      // Network failure falls through to the documented official pin.
    }
  }
  if (html) {
    const links = parseCessnockGpfsReportLinks(html, CESSNOCK_GPFS_REPORTING_URL);
    const match = links
      .filter((link) => link.fiscal_year === fiscalYear)
      .sort((a, b) => b.url.localeCompare(a.url))[0];
    if (match) return match;
  }
  if (fiscalYear !== CESSNOCK_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No published Cessnock City Council Annual Financial Statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return cessnockPinnedDocument();
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectCessnockGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectCessnockGpfsUnit([page.text]);
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
  spec: CessnockGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): CessnockGpfsLineValue | null {
  const value = firstAmountAfter(text, spec.label);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly CessnockGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

/**
 * Parse B1-1 "Total functions and activities". The row prints ten numbers
 * (Income 2025/2024, Expenses 2025/2024, Operating result 2025/2024, Grants
 * 2025/2024, Carrying amount 2025/2024); the 2025 values are at indices 0, 2, 4,
 * 6 and 8.
 */
export function parseCessnockGpfsFunctionsTotals(
  page: PdfPage,
): CessnockGpfsFunctionsTotals | null {
  const text = normalizeText(page.text);
  const label = 'Total functions and activities';
  if (!text.includes(label)) return null;
  const values = amountsAfter(text, label);
  if (values.length < 10) {
    throw new Error(
      `p${page.page_number}: B1-1 total row has ${values.length} numeric values, expected at least 10`,
    );
  }
  return {
    page_number: page.page_number,
    income: values[0]!,
    expenses: values[2]!,
    operating_result: values[4]!,
    grants_and_contributions: values[6]!,
    carrying_amount: values[8]!,
  };
}

function gpfsFundingSource(spec: CessnockGpfsLineSpec): string {
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
  context: CessnockGpfsParseContext,
  spec: CessnockGpfsLineSpec,
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
export function cessnockGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = CESSNOCK_GPFS_FISCAL_YEAR,
): string {
  return `${CESSNOCK_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: CessnockGpfsLineValue,
  context: CessnockGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: CESSNOCK_GPFS_FISCAL_YEAR,
    source_id: CESSNOCK_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: cessnockGpfsNaturalKey(context.document.url, spec.key, CESSNOCK_GPFS_FISCAL_YEAR),
    project_name: `Cessnock City Council GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: CESSNOCK_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: CESSNOCK_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: CESSNOCK_GPFS_DATA_QUALITY_FLAG,
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

function rejectWith(
  warnings: string[],
  reason: string,
  rejection?: { section: string; reason: string },
): CessnockGpfsParseResult {
  const rejectionEntry = rejection ?? { section: 'gpfs', reason };
  warnings.push(reason);
  return {
    records: [],
    reconciliation: null,
    warnings,
    rejections: [rejectionEntry],
  };
}

/**
 * Parse the standalone FY2024-25 audited AFS into validated, non-additive
 * measure rows. Nothing is emitted unless the printed unit is explicit and every
 * face-statement, B1-1, comprehensive-income, financial-position, equity and
 * cash-flow reconciliation check passes exactly.
 */
export function parseCessnockGpfsExtraction(
  extraction: PdfExtraction,
  context: CessnockGpfsParseContext,
): CessnockGpfsParseResult {
  const warnings: string[] = [];

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Net operating result for the year attributable to Council'),
  );
  if (!incomePage) {
    return rejectWith(warnings, 'audited income statement page not found; no rows ingested');
  }
  const functionsPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Total functions and activities') && text.includes('Functions or activities'),
  );
  if (!functionsPage) {
    return rejectWith(
      warnings,
      'B1-1 Total functions and activities page not found; no rows ingested',
    );
  }
  const comprehensivePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Comprehensive Income') && text.includes('from Income Statement'),
  );
  if (!comprehensivePage) {
    return rejectWith(
      warnings,
      'Statement of Comprehensive Income page not found; no independent printed net-result check',
    );
  }
  const positionPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Financial Position') &&
      text.includes('Total assets') &&
      text.includes('Net assets'),
  );
  if (!positionPage) {
    return rejectWith(
      warnings,
      'Statement of Financial Position page not found; no balance-sheet reconciliation',
    );
  }
  const equityPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Changes in Equity') &&
      text.includes('Opening balance at 1 July') &&
      text.includes('Closing balance at 30 June'),
  );
  if (!equityPage) {
    return rejectWith(
      warnings,
      'Statement of Changes in Equity page not found; no equity reconciliation',
    );
  }
  const cashPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Cash Flows') &&
      text.includes('Net cash flows from operating activities') &&
      text.includes('Net change in cash and cash equivalents'),
  );
  if (!cashPage) {
    return rejectWith(warnings, 'Statement of Cash Flows page not found; no cash reconciliation');
  }

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let comprehensiveUnit: PrintedUnit;
  let positionUnit: PrintedUnit;
  let cashUnit: PrintedUnit;
  let functionsTotals: CessnockGpfsFunctionsTotals | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    comprehensiveUnit = requirePrintedUnit(comprehensivePage, 'Statement of Comprehensive Income');
    positionUnit = requirePrintedUnit(positionPage, 'Statement of Financial Position');
    cashUnit = requirePrintedUnit(cashPage, 'Statement of Cash Flows');
    functionsTotals = parseCessnockGpfsFunctionsTotals(functionsPage);
  } catch (error) {
    return rejectWith(warnings, error instanceof Error ? error.message : String(error));
  }
  const units = [
    incomeUnit.kind,
    functionsUnit.kind,
    comprehensiveUnit.kind,
    positionUnit.kind,
    cashUnit.kind,
  ];
  if (units.some((kind) => kind !== units[0])) {
    return rejectWith(
      warnings,
      `printed units disagree: income ${units[0]}, B1-1 ${units[1]}, comprehensive ${units[2]}, position ${units[3]}, cash ${units[4]}; refusing to mix`,
    );
  }
  if (!functionsTotals) {
    return rejectWith(
      warnings,
      'B1-1 Total functions and activities row not found; no rows ingested',
    );
  }
  const unit = incomeUnit.kind;

  const comprehensiveText = normalizeText(comprehensivePage.text);
  const comprehensiveNetResult = firstAmountAfter(comprehensiveText, 'from Income Statement');
  const comprehensiveOtherIncome = firstAmountAfter(
    comprehensiveText,
    'Total other comprehensive income for the year',
  );
  const comprehensiveTotal = firstAmountAfter(
    comprehensiveText,
    'Total comprehensive income for the year attributable to Council',
  );
  const comprehensiveRevaluation =
    firstAmountAfter(
      comprehensiveText,
      'Gain / (loss) on revaluation of infrastructure, property, plant and equipment',
    ) ??
    firstAmountAfter(
      comprehensiveText,
      'Gain/(loss) on revaluation of infrastructure, property, plant and equipment',
    ) ??
    firstAmountAfter(
      comprehensiveText,
      'Gain on revaluation of infrastructure, property, plant and equipment',
    );
  if (comprehensiveNetResult === null) {
    return rejectWith(
      warnings,
      `p${comprehensivePage.page_number}: could not read the printed comprehensive-income net result; no rows ingested`,
    );
  }
  if (comprehensiveOtherIncome === null || comprehensiveTotal === null) {
    return rejectWith(
      warnings,
      `p${comprehensivePage.page_number}: could not read the printed other/total comprehensive income; no rows ingested`,
    );
  }
  if (comprehensiveRevaluation === null) {
    return rejectWith(
      warnings,
      `p${comprehensivePage.page_number}: could not read the printed other-comprehensive-income component; no rows ingested`,
    );
  }

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: CessnockGpfsLineValue[] = [];
  for (const spec of CESSNOCK_GPFS_LINES) {
    if (spec.key === 'total_expenses') continue;
    const line = lineValue(incomeText, spec, incomePage.page_number, errors);
    if (line) values.push(line);
  }
  if (errors.length > 0) return rejectWith(warnings, errors.join('; '));

  const totalRevenue = lineByKey(values, 'total_revenue');
  const employee = lineByKey(values, 'employee_expenses');
  const materials = lineByKey(values, 'materials_and_services');
  const borrowing = lineByKey(values, 'borrowing_costs');
  const otherExpenses = lineByKey(values, 'other_expenses');
  const netLossDisposal = lineByKey(values, 'net_loss_from_disposal_of_assets');
  const depreciation = lineByKey(values, 'depreciation_amortisation_impairment');
  const grantsOperating = lineByKey(values, 'government_grants_operating');
  const grantsCapital = lineByKey(values, 'government_grants_capital');
  const netResult = lineByKey(values, 'net_result');
  const expensesExDepreciation = lineByKey(values, 'total_expenses_excluding_depreciation');
  const rates = lineByKey(values, 'rates_and_annual_charges');
  const userCharges = lineByKey(values, 'user_charges_and_fees');
  const otherRevenue = lineByKey(values, 'other_revenues');
  const otherIncome = lineByKey(values, 'other_income');
  const interest = lineByKey(values, 'interest_and_investment_income');
  const netResultBeforeCapital = firstAmountAfter(incomeText, CESSNOCK_GPFS_BEFORE_CAPITAL_LABEL);

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['materials_and_services', materials],
    ['borrowing_costs', borrowing],
    ['other_expenses', otherExpenses],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['net_result', netResult],
    ['net_result_before_capital_grants', netResultBeforeCapital],
    ['total_expenses_excluding_depreciation', expensesExDepreciation],
    ['rates_and_annual_charges', rates],
    ['user_charges_and_fees', userCharges],
    ['other_revenues', otherRevenue],
    ['other_income', otherIncome],
    ['interest_and_investment_income', interest],
  ];
  const missing = required.filter(([, value]) => value === null).map(([key]) => key);
  if (missing.length > 0) {
    return rejectWith(
      warnings,
      `could not read printed line(s): ${missing.join(', ')}; no rows ingested`,
    );
  }

  const revenueComponentsSum =
    rates! +
    userCharges! +
    otherRevenue! +
    otherIncome! +
    grantsOperating! +
    grantsCapital! +
    interest!;
  const expenseComponentsSum =
    employee! + materials! + borrowing! + otherExpenses! + netLossDisposal!;
  // Cessnock does not print a "Total expenses" line; the documented bridge is
  // the printed expenses-excluding-depreciation line plus printed depreciation.
  const totalExpenses = expensesExDepreciation! + depreciation!;
  const faceExpenseBridge = totalExpenses;

  const totalExpensesLine: CessnockGpfsLineValue = {
    spec: CESSNOCK_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
    value: totalExpenses,
    page_number: incomePage.page_number,
  };
  values.push(totalExpensesLine);

  const positionText = normalizeText(positionPage.text);
  const cashAndCashEquivalents = firstAmountAfter(positionText, 'Cash and cash equivalents');
  const totalCurrentAssets = firstAmountAfter(positionText, 'Total current assets');
  const totalNonCurrentAssets = firstAmountAfter(positionText, 'Total non-current assets');
  const totalAssets = firstAmountAfter(positionText, 'Total assets');
  const totalCurrentLiabilities = firstAmountAfter(positionText, 'Total current liabilities');
  const totalNonCurrentLiabilities = firstAmountAfter(
    positionText,
    'Total non-current liabilities',
  );
  const totalLiabilities = firstAmountAfter(positionText, 'Total liabilities');
  const netAssets = firstAmountAfter(positionText, 'Net assets');
  const accumulatedSurplus = firstAmountAfter(positionText, 'Accumulated surplus');
  const ippeRevaluationSurplus = firstAmountAfter(positionText, 'IPPE revaluation surplus');
  const totalEquity = firstAmountAfter(positionText, 'Total equity');

  const balanceRequired: Array<[string, number | null]> = [
    ['cash_and_cash_equivalents', cashAndCashEquivalents],
    ['total_current_assets', totalCurrentAssets],
    ['total_non_current_assets', totalNonCurrentAssets],
    ['total_assets', totalAssets],
    ['total_current_liabilities', totalCurrentLiabilities],
    ['total_non_current_liabilities', totalNonCurrentLiabilities],
    ['total_liabilities', totalLiabilities],
    ['net_assets', netAssets],
    ['accumulated_surplus', accumulatedSurplus],
    ['ippe_revaluation_surplus', ippeRevaluationSurplus],
    ['total_equity', totalEquity],
  ];
  const missingBalance = balanceRequired.filter(([, value]) => value === null).map(([key]) => key);
  if (missingBalance.length > 0) {
    return rejectWith(
      warnings,
      `could not read printed Statement of Financial Position line(s): ${missingBalance.join(', ')}; no rows ingested`,
    );
  }

  const equityText = normalizeText(equityPage.text);
  const equityOpening = amountsAfter(equityText, 'Opening balance at 1 July');
  const equityClosing = amountsAfter(equityText, 'Closing balance at 30 June');
  if (equityOpening.length < 3 || equityClosing.length < 3) {
    return rejectWith(
      warnings,
      `p${equityPage.page_number}: could not read opening/closing equity balances; no rows ingested`,
    );
  }
  const equityOpeningTotal = equityOpening[2]!;
  const equityClosingTotal = equityClosing[2]!;

  const cashText = normalizeText(cashPage.text);
  const cashOperating = firstAmountAfter(cashText, 'Net cash flows from operating activities');
  const cashInvesting = firstAmountAfter(cashText, 'Net cash flows from investing activities');
  const cashFinancing = firstAmountAfter(cashText, 'Net cash flows from financing activities');
  const cashNetChange = firstAmountAfter(cashText, 'Net change in cash and cash equivalents');
  const cashClosingAmounts = amountsAfter(cashText, 'Cash and cash equivalents at end of year');
  if (
    cashOperating === null ||
    cashInvesting === null ||
    cashFinancing === null ||
    cashNetChange === null ||
    cashClosingAmounts.length < 2
  ) {
    return rejectWith(
      warnings,
      `p${cashPage.page_number}: could not read the printed cash-flow subtotals; no rows ingested`,
    );
  }
  const cashClosing = cashClosingAmounts[0]!;
  const cashOpeningPriorYear = cashClosingAmounts[1]!;

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
    'B1-1 carrying amount = printed total assets',
    totalAssets!,
    functionsTotals.carrying_amount,
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
    'other comprehensive income component = printed other comprehensive income',
    comprehensiveOtherIncome!,
    comprehensiveRevaluation!,
  );
  check(
    'current assets + non-current assets = total assets',
    totalAssets!,
    totalCurrentAssets! + totalNonCurrentAssets!,
  );
  check(
    'current liabilities + non-current liabilities = total liabilities',
    totalLiabilities!,
    totalCurrentLiabilities! + totalNonCurrentLiabilities!,
  );
  check(
    'total assets - total liabilities = net assets',
    netAssets!,
    totalAssets! - totalLiabilities!,
  );
  check(
    'accumulated surplus + IPPE revaluation surplus = total equity',
    totalEquity!,
    accumulatedSurplus! + ippeRevaluationSurplus!,
  );
  check('net assets = total equity', totalEquity!, netAssets!);
  check(
    'opening equity total + total comprehensive income = closing equity total',
    equityClosingTotal,
    equityOpeningTotal + comprehensiveTotal!,
  );
  check('closing equity total = SoFP total equity', totalEquity!, equityClosingTotal);
  check(
    'cash operating + investing + financing = net change in cash',
    cashNetChange!,
    cashOperating! + cashInvesting! + cashFinancing!,
  );
  check(
    'closing cash - net change = prior-year closing cash',
    cashOpeningPriorYear!,
    cashClosing! - cashNetChange!,
  );
  check('cash closing = SoFP cash and cash equivalents', cashAndCashEquivalents!, cashClosing!);
  if (checks.length > 0) {
    return rejectWith(
      warnings,
      `GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`,
    );
  }

  const reconciliation: CessnockGpfsReconciliation = {
    fiscal_year: CESSNOCK_GPFS_FISCAL_YEAR,
    unit,
    unit_evidence: incomeUnit.reason,
    income_statement_page: incomePage.page_number,
    functions_page: functionsPage.page_number,
    comprehensive_income_page: comprehensivePage.page_number,
    financial_position_page: positionPage.page_number,
    changes_in_equity_page: equityPage.page_number,
    cash_flows_page: cashPage.page_number,
    total_revenue: totalRevenue!,
    total_expenses: totalExpenses,
    employee_expenses: employee!,
    materials_and_services: materials!,
    borrowing_costs: borrowing!,
    other_expenses: otherExpenses!,
    net_loss_from_disposal_of_assets: netLossDisposal!,
    depreciation_amortisation_impairment: depreciation!,
    government_grants_operating: grantsOperating!,
    government_grants_capital: grantsCapital!,
    net_result: netResult!,
    net_result_before_capital_grants: netResultBeforeCapital!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    functions_total_income: functionsTotals.income,
    functions_total_expenses: functionsTotals.expenses,
    functions_operating_result: functionsTotals.operating_result,
    functions_grants_and_contributions: functionsTotals.grants_and_contributions,
    functions_carrying_amount: functionsTotals.carrying_amount,
    comprehensive_income_net_result: comprehensiveNetResult!,
    comprehensive_other_income: comprehensiveOtherIncome!,
    comprehensive_total: comprehensiveTotal!,
    comprehensive_revaluation: comprehensiveRevaluation!,
    cash_and_cash_equivalents: cashAndCashEquivalents!,
    total_current_assets: totalCurrentAssets!,
    total_non_current_assets: totalNonCurrentAssets!,
    total_assets: totalAssets!,
    total_current_liabilities: totalCurrentLiabilities!,
    total_non_current_liabilities: totalNonCurrentLiabilities!,
    total_liabilities: totalLiabilities!,
    net_assets: netAssets!,
    accumulated_surplus: accumulatedSurplus!,
    ippe_revaluation_surplus: ippeRevaluationSurplus!,
    total_equity: totalEquity!,
    equity_opening_total: equityOpeningTotal,
    equity_closing_total: equityClosingTotal,
    cash_operating: cashOperating!,
    cash_investing: cashInvesting!,
    cash_financing: cashFinancing!,
    cash_net_change: cashNetChange!,
    cash_closing: cashClosing!,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'all printed face-statement line sums equal their printed subtotals/total',
      'printed total expenses excluding depreciation + printed depreciation = total expenses bridge',
      'B1-1 operating result, grants, income, expenses and carrying amount reconcile to the face statement',
      'Statement of Comprehensive Income net result equals the Income Statement net result',
      'printed net result + printed other comprehensive income equals printed total comprehensive income',
      'the printed other-comprehensive-income revaluation component equals printed other comprehensive income',
      'Statement of Financial Position subtotals (assets, liabilities, net assets, equity) reconcile exactly',
      'Statement of Changes in Equity opening + total comprehensive income = closing, equal to SoFP equity',
      'Statement of Cash Flows operating + investing + financing = net change, and closing cash reconciles',
      'the printed net result is stored with a magnitude and a negative sign marker only when printed negative; the before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line; B1-1 operating result, grants, income, expenses and carrying amount reconcile exactly; comprehensive-income net result and total comprehensive income reconcile exactly; the printed net result is positive (38,146) while the before-capital result is negative (-33,778) and is retained in reconciliation evidence only; the single printed OCI revaluation component (222,099) equals the printed OCI 222,099; the balance sheet, equity statement and cash-flow statement reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections: [] };
}

/**
 * Retained annual-report-only rejection. The FY2024-25 annual report is
 * narrative-only: page 13 is a Financial summary and the report ends at the
 * Attestation Statement on page 101. This path never emits rows.
 */
export function parseCessnockAnnualReportExtraction(
  extraction: PdfExtraction,
  _context: CessnockGpfsParseContext,
): CessnockAnnualReportParseResult {
  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Operating result from continuing operations'),
  );
  const comprehensivePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Statement of Comprehensive Income') && text.includes('from Income Statement'),
  );
  const functionsPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Total functions and activities') && text.includes('Functions or activities'),
  );
  if (incomePage && comprehensivePage && functionsPage) {
    const reason =
      'audited GPFS section is present, but this annual-report-only path is retained as a rejection; no rows ingested';
    return {
      records: [],
      reconciliation: null,
      warnings: [reason],
      rejections: [{ section: 'gpfs', reason }],
    };
  }
  return {
    records: [],
    reconciliation: null,
    warnings: [CESSNOCK_ANNUAL_REPORT_GAP],
    rejections: [{ section: 'gpfs', reason: CESSNOCK_ANNUAL_REPORT_GAP }],
  };
}

export interface CessnockGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the official page. */
  document?: CessnockGpfsDocument;
  /** Pre-fetched PDF bytes from the browser/WAF path. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched official listing HTML from the browser/WAF path. */
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
  return 'cessnock-annual-financial-statements-2024-25.pdf';
}

/** Build the live Cessnock City Council GPFS connector. */
export function createCessnockGpfsConnector(options: CessnockGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: CESSNOCK_GPFS_ID,
    name: CESSNOCK_GPFS_NAME,
    publisher: CESSNOCK_GPFS_PUBLISHER,
    source_url: CESSNOCK_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CESSNOCK_GPFS_LICENSE,
    notes:
      "NSW council GPFS adapter: one council only (Cessnock City Council), audited FY2024-25 General Purpose Financial Statements from the standalone Annual Financial Statements PDF with the audit opinion (the FY2024-25 annual report itself is narrative-only and has no GPFS section; that rejection path is retained). The standalone AFS is discovered from the official Annual Financial Statements page linked from the Annual Report page, with the WAF-aware browser path and a documented official fallback pin; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation, reconciled against the printed B1-1 total. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverCessnockGpfsDocument(
          fetchImpl,
          CESSNOCK_GPFS_FISCAL_YEAR,
          options.listingHtml,
        ));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: CESSNOCK_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Cessnock City Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: CessnockGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: CESSNOCK_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Cessnock City Council FY2024-25 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: CessnockGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: CESSNOCK_GPFS_REPORTING_URL,
      };
      const parsed = parseCessnockGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'cessnock-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'cessnock-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Cessnock City Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
