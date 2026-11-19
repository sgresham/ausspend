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
 * NSW council GPFS adapter: Wagga Wagga City Council's audited FY2025-26
 * General Purpose Financial Statements.
 *
 * The official Financial Statements page publishes a standalone "Annual
 * Financial Statements for the year ended 30 June 2026" PDF containing the
 * audited General Purpose Financial Statements and the independent auditor's
 * reports. That standalone audited FS is the source ingested here; no
 * narrative annual report is substituted and no older report is used.
 *
 * The printed unit is `$ '000`. Nothing is emitted unless the Income Statement,
 * B1-1 "Total functions and activities", Statement of Comprehensive Income,
 * Statement of Financial Position, Statement of Changes in Equity and Statement
 * of Cash Flows reconcile exactly at zero tolerance.
 *
 * The face Income Statement does not print a "Total expenses" line. Total
 * expenses is the documented bridge of the printed expenses-excluding-
 * depreciation line ($119,807 thousand) plus the printed depreciation,
 * amortisation and impairment line ($54,595 thousand), giving $174,402
 * thousand. The B1-1 expense total equals that bridge exactly.
 *
 * Wagga Wagga's Income Statement prints "Net loss from the disposal of assets"
 * as an expense component ($5,104 thousand), not as revenue; it is emitted as an
 * expense line and is part of the expenses-excluding-depreciation subtotal. B1-1
 * "Income" includes grants and contributions ($229,411 thousand), so B1-1 income
 * equals the face total income; B1-1 income minus B1-1 expenses equals the
 * printed net result ($55,009 thousand); B1-1 grants equal operating plus capital
 * grants ($22,194 + $60,455 = $82,649 thousand).
 *
 * Every row is non-additive `agency_detail` with no region/LGA allocation, so it
 * can never be summed into another council, a council total, state spending, the
 * PNFC benchmark or the OLG summary layer.
 */
export const WAGGA_WAGGA_GPFS_ID = 'wagga-wagga-gpfs';
export const WAGGA_WAGGA_GPFS_NAME =
  'Wagga Wagga City Council — General Purpose Financial Statements';
export const WAGGA_WAGGA_GPFS_PUBLISHER = 'Wagga Wagga City Council';
/** Official Financial Statements page used for live discovery. */
export const WAGGA_WAGGA_GPFS_REPORTING_URL =
  'https://wagga.nsw.gov.au/the-council/planning-and-reporting/community-reporting/financial-statements';
/** Documented official pin: the FY2025-26 standalone audited Annual Financial Statements PDF. */
export const WAGGA_WAGGA_GPFS_DOCUMENT_PIN =
  'https://wagga.nsw.gov.au/imagesfiles/documents/the-council/planning-and-reporting/financial-statements/Annual-Financial-Statements-2025-26.pdf';
export const WAGGA_WAGGA_GPFS_STANDALONE_FS_BYTES = 5880591;
export const WAGGA_WAGGA_GPFS_STANDALONE_FS_SHA256 =
  'c6c8c61dc33bc1524368da75492338d2fbee2629f98ad80986463ebf3b8125eb';
export const WAGGA_WAGGA_GPFS_STANDALONE_FS_PAGES = 117;
export const WAGGA_WAGGA_GPFS_FISCAL_YEAR = '2025-26';
export const WAGGA_WAGGA_GPFS_SOURCE_DATASET = 'Wagga Wagga City Council GPFS 2025-26';
export const WAGGA_WAGGA_GPFS_LICENSE =
  '© Wagga Wagga City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const WAGGA_WAGGA_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const WAGGA_WAGGA_GPFS_DELIVERY_ENTITY = 'Wagga Wagga City Council';
export const WAGGA_WAGGA_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export interface WaggaWaggaGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  listing_url?: string;
  resolved_url?: string;
}

export interface WaggaWaggaGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface WaggaWaggaGpfsParseContext {
  document: WaggaWaggaGpfsDocument;
  archive: WaggaWaggaGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface WaggaWaggaGpfsRejection {
  section: string;
  reason: string;
}

export type WaggaWaggaGpfsSection = 'revenue' | 'expenses' | 'result';

export interface WaggaWaggaGpfsLineSpec {
  key: string;
  label: string;
  section: WaggaWaggaGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'Income Statement (documented bridge)';
}

/**
 * The 17 printed Income Statement rows we emit. The seven revenue components
 * sum exactly to the printed total income. The five expense components (which
 * include the printed net loss on asset disposal) sum exactly to the printed
 * "Total expenses ... excluding depreciation" line, which with the printed
 * depreciation line bridges to total expenses. The net result is a printed
 * result row; the operating result and before-capital result are retained in
 * reconciliation evidence only.
 */
export const WAGGA_WAGGA_GPFS_LINES: ReadonlyArray<WaggaWaggaGpfsLineSpec> = [
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

export const WAGGA_WAGGA_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL =
  'Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets';
export const WAGGA_WAGGA_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';

interface WaggaWaggaGpfsLineValue {
  spec: WaggaWaggaGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface WaggaWaggaGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
  carrying_amount: number;
}

export interface WaggaWaggaGpfsReconciliation {
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
  other_income: number;
  net_result: number;
  /** Printed figure; reconciliation evidence only, never a stored row. */
  net_result_before_capital_grants: number;
  operating_result_excluding_depreciation: number;
  printed_total_expenses_excluding_depreciation: number;
  functions_income: number;
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
  council_equity_interest: number;
  total_equity: number;
  equity_opening_accumulated: number;
  equity_opening_ippe: number;
  equity_opening_total: number;
  equity_closing_accumulated: number;
  equity_closing_ippe: number;
  equity_closing_total: number;
  cash_operating: number;
  cash_investing: number;
  cash_financing: number;
  cash_net_change: number;
  cash_opening: number;
  cash_closing: number;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface WaggaWaggaGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: WaggaWaggaGpfsReconciliation | null;
  warnings: string[];
  rejections: WaggaWaggaGpfsRejection[];
}

// Note references include hyphenated forms (B2-1, G1-1) and letter-suffixed
// forms (D2a, D2); strip them before reading the numbers that follow a label.
const NOTE_REFERENCE = /\b[A-Z]\d+(?:-\d+)?[a-z]?\b/g;
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

/** Convert a financial-statements label/URL to a fiscal year. */
export function fiscalYearFromWaggaWaggaFinancialStatementsLink(text: string): string | null {
  const june = /year\s+ended\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
    text.replace(/[-_]+/g, ' ').replace(/\s+/g, ' '),
  );
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  const normalized = text
    .replace(/[_]+/g, '-')
    .replace(/\bto\b/gi, '-')
    .replace(/\s*[-/]+\s*/g, '-')
    .replace(/\s+/g, ' ');
  const matches = [...normalized.matchAll(/((?:19|20)\d{2})-((?:19|20)?\d{2})/g)];
  const match = matches[matches.length - 1];
  if (!match) return null;
  const startYear = Number(match[1]);
  const endRaw = match[2]!;
  const end =
    endRaw.length === 2 ? Math.floor(startYear / 100) * 100 + Number(endRaw) : Number(endRaw);
  if (end !== startYear + 1) return null;
  return `${startYear}-${String(end).slice(-2)}`;
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

function absoluteLink(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    const baseHost = new URL(baseUrl).host.replace(/^www\./, '');
    const urlHost = url.host.replace(/^www\./, '');
    if (urlHost !== baseHost && !urlHost.endsWith(`.${baseHost}`)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Parse the standalone audited Annual Financial Statements links from the
 * official Financial Statements page. The page publishes one PDF per year
 * ("2025-2026 Audited Financial Statements", "2024/2025 Audited Financial
 * Statements", ...). Older years are retained so discovery can reject a stale
 * or missing target year rather than substituting one.
 */
export function parseWaggaWaggaFinancialStatementsLinks(
  html: string,
  baseUrl: string,
): WaggaWaggaGpfsDocument[] {
  const links: WaggaWaggaGpfsDocument[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors(html)) {
    const label = `${anchor.title} ${anchor.text}`.trim();
    const isFinancialStatements =
      /audited\s+financial\s+statements/i.test(label) ||
      /annual[\s_-]*financial[\s_-]*statements/i.test(anchor.href);
    if (!isFinancialStatements) continue;
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    const fiscalYear =
      fiscalYearFromWaggaWaggaFinancialStatementsLink(label) ??
      fiscalYearFromWaggaWaggaFinancialStatementsLink(anchor.href);
    if (!fiscalYear) continue;
    const href = absoluteLink(anchor.href, baseUrl);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    links.push({
      id: `annual-financial-statements-${fiscalYear}`,
      title: label || `Annual Financial Statements ${fiscalYear}`,
      url: href,
      fiscal_year: fiscalYear,
      listing_url: baseUrl,
    });
  }
  return links;
}

/** Select the standalone audited FS upload for the requested fiscal year. */
export function selectWaggaWaggaGpfsDocument(
  links: readonly WaggaWaggaGpfsDocument[],
  fiscalYear: string = WAGGA_WAGGA_GPFS_FISCAL_YEAR,
): WaggaWaggaGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Wagga Wagga City Council audited financial statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** The documented official pin used when the live listing hides the FS link. */
export function waggaWaggaPinnedDocument(): WaggaWaggaGpfsDocument {
  return {
    id: `annual-financial-statements-${WAGGA_WAGGA_GPFS_FISCAL_YEAR}`,
    title: 'Annual Financial Statements for the year ended 30 June 2026',
    url: WAGGA_WAGGA_GPFS_DOCUMENT_PIN,
    fiscal_year: WAGGA_WAGGA_GPFS_FISCAL_YEAR,
    listing_url: WAGGA_WAGGA_GPFS_REPORTING_URL,
  };
}

/**
 * Discover the standalone FY2025-26 audited FS. The connector fetches the
 * official Financial Statements page and parses its audited-FS link; if the page
 * is unavailable (the host returns a Cloudflare challenge to a plain HTTP
 * client) or yields no usable FY2025-26 link, it uses the documented official
 * pin. The exact bytes are still SHA-256 re-verified.
 */
export async function discoverWaggaWaggaGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = WAGGA_WAGGA_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<WaggaWaggaGpfsDocument> {
  let html: string | null = listingHtml ?? null;
  if (html === null) {
    try {
      const response = await fetchImpl(WAGGA_WAGGA_GPFS_REPORTING_URL, {
        redirect: 'follow',
        headers: WAGGA_WAGGA_GPFS_REQUEST_HEADERS,
      });
      if (response.ok) html = await response.text();
    } catch {
      // Network failure falls through to the documented official pin.
    }
  }
  if (html) {
    const links = parseWaggaWaggaFinancialStatementsLinks(html, WAGGA_WAGGA_GPFS_REPORTING_URL);
    const match = links
      .filter((link) => link.fiscal_year === fiscalYear)
      .sort((a, b) => b.url.localeCompare(a.url))[0];
    if (match) return match;
  }
  if (fiscalYear !== WAGGA_WAGGA_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No published Wagga Wagga City Council audited financial statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return waggaWaggaPinnedDocument();
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectWaggaWaggaGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectWaggaWaggaGpfsUnit([page.text]);
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
  spec: WaggaWaggaGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): WaggaWaggaGpfsLineValue | null {
  const value = firstAmountAfter(text, spec.label);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly WaggaWaggaGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

/**
 * Parse B1-1 "Total functions and activities". The row prints ten numbers
 * (Income 2026/2025, Expenses 2026/2025, Operating result 2026/2025, Grants
 * 2026/2025, Carrying amount 2026/2025); the 2026 values are at indices 0, 2, 4,
 * 6 and 8. Wagga Wagga's B1-1 "Income" column includes grants and
 * contributions, so B1-1 income equals the face total income; the grants column
 * is printed separately and equals operating plus capital grants.
 */
export function parseWaggaWaggaGpfsFunctionsTotals(
  page: PdfPage,
): WaggaWaggaGpfsFunctionsTotals | null {
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

function gpfsFundingSource(spec: WaggaWaggaGpfsLineSpec): string {
  if (spec.potential_double_count) return 'Government grants and contributions';
  if (spec.key === 'total_revenue')
    return 'Council total revenue (own-source plus government grants and contributions)';
  if (spec.key === 'net_loss_from_disposal_of_assets')
    return 'Proceeds and losses from asset disposals';
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
  context: WaggaWaggaGpfsParseContext,
  spec: WaggaWaggaGpfsLineSpec,
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
export function waggaWaggaGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = WAGGA_WAGGA_GPFS_FISCAL_YEAR,
): string {
  return `${WAGGA_WAGGA_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: WaggaWaggaGpfsLineValue,
  context: WaggaWaggaGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: WAGGA_WAGGA_GPFS_FISCAL_YEAR,
    source_id: WAGGA_WAGGA_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: waggaWaggaGpfsNaturalKey(
      context.document.url,
      spec.key,
      WAGGA_WAGGA_GPFS_FISCAL_YEAR,
    ),
    project_name: `Wagga Wagga City Council GPFS 2025-26 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: WAGGA_WAGGA_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: WAGGA_WAGGA_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: WAGGA_WAGGA_GPFS_DATA_QUALITY_FLAG,
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

function rejectWith(warnings: string[], reason: string): WaggaWaggaGpfsParseResult {
  warnings.push(reason);
  return {
    records: [],
    reconciliation: null,
    warnings,
    rejections: [{ section: 'gpfs', reason }],
  };
}

/**
 * Parse the standalone FY2025-26 audited FS into validated, non-additive
 * measure rows. Nothing is emitted unless the printed unit is explicit and every
 * face-statement, B1-1, comprehensive-income, financial-position, equity and
 * cash-flow reconciliation check passes exactly.
 */
export function parseWaggaWaggaGpfsExtraction(
  extraction: PdfExtraction,
  context: WaggaWaggaGpfsParseContext,
): WaggaWaggaGpfsParseResult {
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
      text.includes('Opening balance') &&
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
      text.includes('Net change in cash and cash equivalents') &&
      text.includes('Net cash provided from/(or used in) operating activities'),
  );
  if (!cashPage) {
    return rejectWith(warnings, 'Statement of Cash Flows page not found; no cash reconciliation');
  }

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let comprehensiveUnit: PrintedUnit;
  let positionUnit: PrintedUnit;
  let cashUnit: PrintedUnit;
  let functionsTotals: WaggaWaggaGpfsFunctionsTotals | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    comprehensiveUnit = requirePrintedUnit(comprehensivePage, 'Statement of Comprehensive Income');
    positionUnit = requirePrintedUnit(positionPage, 'Statement of Financial Position');
    cashUnit = requirePrintedUnit(cashPage, 'Statement of Cash Flows');
    functionsTotals = parseWaggaWaggaGpfsFunctionsTotals(functionsPage);
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
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment',
    ) ??
    firstAmountAfter(
      comprehensiveText,
      'Gain / (loss) on revaluation of infrastructure, property, plant and equipment',
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
      `p${comprehensivePage.page_number}: could not read the printed revaluation component of other comprehensive income; no rows ingested`,
    );
  }

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: WaggaWaggaGpfsLineValue[] = [];
  for (const spec of WAGGA_WAGGA_GPFS_LINES) {
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
  const otherIncome = lineByKey(values, 'other_income');
  const netResult = lineByKey(values, 'net_result');
  const expensesExDepreciation = lineByKey(values, 'total_expenses_excluding_depreciation');
  const rates = lineByKey(values, 'rates_and_annual_charges');
  const userCharges = lineByKey(values, 'user_charges_and_fees');
  const otherRevenue = lineByKey(values, 'other_revenues');
  const interest = lineByKey(values, 'interest_and_investment_income');
  const operatingResultExcludingDepreciation = firstAmountAfter(
    incomeText,
    WAGGA_WAGGA_GPFS_OPERATING_RESULT_EXCLUDING_DEPRECIATION_LABEL,
  );
  const netResultBeforeCapital = firstAmountAfter(
    incomeText,
    WAGGA_WAGGA_GPFS_BEFORE_CAPITAL_LABEL,
  );

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
    ['other_income', otherIncome],
    ['net_result', netResult],
    ['operating_result_excluding_depreciation', operatingResultExcludingDepreciation],
    ['net_result_before_capital_grants', netResultBeforeCapital],
    ['total_expenses_excluding_depreciation', expensesExDepreciation],
    ['rates_and_annual_charges', rates],
    ['user_charges_and_fees', userCharges],
    ['other_revenues', otherRevenue],
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
    grantsOperating! +
    grantsCapital! +
    interest! +
    otherIncome!;
  const expenseComponentsSum =
    employee! + materials! + borrowing! + otherExpenses! + netLossDisposal!;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = faceExpenseBridge;

  const totalExpensesLine: WaggaWaggaGpfsLineValue = {
    spec: WAGGA_WAGGA_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
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
  const councilEquityInterest = firstAmountAfter(positionText, 'Council equity interest');
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
    ['council_equity_interest', councilEquityInterest],
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
  if (equityOpening.length < 6 || equityClosing.length < 6) {
    return rejectWith(
      warnings,
      `p${equityPage.page_number}: could not read opening/closing equity balances; no rows ingested`,
    );
  }
  // Wagga Wagga prints three 2026 columns (accumulated surplus, IPPE
  // revaluation surplus, total equity) before the 2025 set, so the 2026 total
  // equity is the third amount.
  const equityOpeningAccumulated = equityOpening[0]!;
  const equityOpeningIppe = equityOpening[1]!;
  const equityOpeningTotal = equityOpening[2]!;
  const equityClosingAccumulated = equityClosing[0]!;
  const equityClosingIppe = equityClosing[1]!;
  const equityClosingTotal = equityClosing[2]!;

  const cashText = normalizeText(cashPage.text);
  const cashOperating = firstAmountAfter(
    cashText,
    'Net cash provided from/(or used in) operating activities',
  );
  const cashInvesting = firstAmountAfter(
    cashText,
    'Net cash provided from/(or used in) investing activities',
  );
  const cashFinancing = firstAmountAfter(
    cashText,
    'Net cash flow provided from/(or used in) financing activities',
  );
  const cashNetChange = firstAmountAfter(cashText, 'Net change in cash and cash equivalents');
  const cashOpeningAmounts = amountsAfter(
    cashText,
    'Cash and cash equivalents at beginning of year',
  );
  const cashClosingAmounts = amountsAfter(cashText, 'Cash and cash equivalents at end of year');
  if (
    cashOperating === null ||
    cashInvesting === null ||
    cashFinancing === null ||
    cashNetChange === null ||
    cashOpeningAmounts.length < 1 ||
    cashClosingAmounts.length < 1
  ) {
    return rejectWith(
      warnings,
      `p${cashPage.page_number}: could not read the printed cash-flow subtotals; no rows ingested`,
    );
  }
  const cashOpening = cashOpeningAmounts[0]!;
  const cashClosing = cashClosingAmounts[0]!;

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
    'expense components (including printed net loss on disposal) = printed total expenses excluding depreciation',
    expensesExDepreciation!,
    expenseComponentsSum,
  );
  check(
    'printed total expenses excluding depreciation + printed depreciation = total expenses bridge',
    totalExpenses,
    faceExpenseBridge,
  );
  check(
    'printed total income - printed expenses excluding depreciation = printed operating result excluding depreciation',
    operatingResultExcludingDepreciation!,
    totalRevenue! - expensesExDepreciation!,
  );
  check(
    'printed total income - total expenses bridge = printed net result',
    netResult!,
    totalRevenue! - totalExpenses,
  );
  check(
    'printed net result - capital grants = printed net result before capital grants',
    netResultBeforeCapital!,
    netResult! - grantsCapital!,
  );
  check('B1-1 expenses = face total expenses bridge', totalExpenses, functionsTotals.expenses);
  check(
    'B1-1 income (which includes grants) = face total revenue',
    totalRevenue!,
    functionsTotals.income,
  );
  check(
    'B1-1 income - B1-1 expenses = B1-1 operating result',
    functionsTotals.operating_result,
    functionsTotals.income - functionsTotals.expenses,
  );
  check('B1-1 operating result = printed net result', netResult!, functionsTotals.operating_result);
  check(
    'B1-1 grants and contributions = operating grants + capital grants',
    grantsOperating! + grantsCapital!,
    functionsTotals.grants_and_contributions,
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
    'printed revaluation component = printed other comprehensive income',
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
  check('Council equity interest = total equity', totalEquity!, councilEquityInterest!);
  check('net assets = total equity', totalEquity!, netAssets!);
  check(
    'opening equity total + total comprehensive income = closing equity total',
    equityClosingTotal,
    equityOpeningTotal + comprehensiveTotal!,
  );
  check('closing equity total = SoFP total equity', totalEquity!, equityClosingTotal);
  check(
    'equity opening accumulated + IPPE = opening total',
    equityOpeningTotal,
    equityOpeningAccumulated + equityOpeningIppe,
  );
  check(
    'equity closing accumulated + IPPE = closing total',
    equityClosingTotal,
    equityClosingAccumulated + equityClosingIppe,
  );
  check(
    'cash operating + investing + financing = net change in cash',
    cashNetChange!,
    cashOperating! + cashInvesting! + cashFinancing!,
  );
  check('opening cash + net change = closing cash', cashClosing!, cashOpening! + cashNetChange!);
  check('cash closing = SoFP cash and cash equivalents', cashAndCashEquivalents!, cashClosing!);
  if (checks.length > 0) {
    return rejectWith(
      warnings,
      `GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`,
    );
  }

  const reconciliation: WaggaWaggaGpfsReconciliation = {
    fiscal_year: WAGGA_WAGGA_GPFS_FISCAL_YEAR,
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
    other_income: otherIncome!,
    net_result: netResult!,
    net_result_before_capital_grants: netResultBeforeCapital!,
    operating_result_excluding_depreciation: operatingResultExcludingDepreciation!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    functions_income: functionsTotals.income,
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
    council_equity_interest: councilEquityInterest!,
    total_equity: totalEquity!,
    equity_opening_accumulated: equityOpeningAccumulated,
    equity_opening_ippe: equityOpeningIppe,
    equity_opening_total: equityOpeningTotal,
    equity_closing_accumulated: equityClosingAccumulated,
    equity_closing_ippe: equityClosingIppe,
    equity_closing_total: equityClosingTotal,
    cash_operating: cashOperating!,
    cash_investing: cashInvesting!,
    cash_financing: cashFinancing!,
    cash_net_change: cashNetChange!,
    cash_opening: cashOpening!,
    cash_closing: cashClosing!,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'all printed face-statement line sums equal their printed subtotals/total',
      'printed expenses excluding depreciation + printed depreciation/amortisation/impairment = total expenses bridge',
      'printed total income - total expenses bridge = printed net result',
      'B1-1 expense total equals the face expense bridge',
      'B1-1 income (which includes grants and contributions) equals the face total income',
      'B1-1 income - B1-1 expenses = B1-1 operating result = printed net result',
      'B1-1 grants equal operating grants + capital grants, and carrying amount equals total assets',
      'Statement of Comprehensive Income net result equals the Income Statement net result',
      'printed net result + printed other comprehensive income equals printed total comprehensive income',
      'the printed revaluation component equals printed other comprehensive income',
      'Statement of Financial Position subtotals (assets, liabilities, net assets, accumulated surplus plus IPPE revaluation surplus) reconcile exactly, and Council equity interest equals total equity',
      'Statement of Changes in Equity opening + total comprehensive income = closing, equal to SoFP equity',
      'Statement of Cash Flows operating + investing + financing = net change, and closing cash reconciles',
      'the printed net result is stored with a magnitude and a negative sign marker only when printed negative; the before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the documented bridge of the printed expenses-excluding-depreciation line (119,807) plus the printed depreciation/amortisation/impairment line (54,595) = 174,402, equal to the printed B1-1 expense total; the printed net loss from the disposal of assets (5,104) is an expense component of the printed expenses-excluding-depreciation subtotal; B1-1 income (229,411) includes grants and contributions (operating 22,194 + capital 60,455 = 82,649) and equals the face total income; B1-1 income minus B1-1 expenses equals the printed operating result and net result (55,009); the net result plus the printed revaluation component (118,720) equals total comprehensive income (173,729); the printed before-capital result (-5,446) is retained in reconciliation evidence only; the balance sheet and equity statement (accumulated surplus 1,169,731 plus IPPE revaluation surplus 1,568,850 = total equity 2,738,581) and cash-flow statement reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections: [] };
}

export interface WaggaWaggaGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the official page. */
  document?: WaggaWaggaGpfsDocument;
  /** Pre-fetched PDF bytes from the browser/WAF path. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched official listing HTML from the browser/WAF path. */
  listingHtml?: string;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) {
      return name.replace(/[^A-Za-z0-9._-]+/g, '-');
    }
  } catch {
    // Fall through to the stable name.
  }
  return 'Annual-Financial-Statements-2025-26.pdf';
}

/** Build the live Wagga Wagga City Council GPFS connector. */
export function createWaggaWaggaGpfsConnector(
  options: WaggaWaggaGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: WAGGA_WAGGA_GPFS_ID,
    name: WAGGA_WAGGA_GPFS_NAME,
    publisher: WAGGA_WAGGA_GPFS_PUBLISHER,
    source_url: WAGGA_WAGGA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WAGGA_WAGGA_GPFS_LICENSE,
    notes:
      "NSW council GPFS adapter: one council only (Wagga Wagga City Council), audited FY2025-26 General Purpose Financial Statements from the official standalone Annual Financial Statements PDF with the independent auditor's reports. The standalone audited FS is discovered from the official Financial Statements page, with the Cloudflare-clearing headless Chromium browser path and a documented official fallback pin; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Wagga Wagga prints net loss from the disposal of assets as an expense component of the expenses-excluding-depreciation subtotal, so it is emitted as an expense line. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation/amortisation/impairment, equal to the printed B1-1 expense total. B1-1 income includes grants and contributions, so B1-1 income equals the face total income, B1-1 operating result equals the net result, and B1-1 grants equal operating plus capital grants. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverWaggaWaggaGpfsDocument(
          fetchImpl,
          WAGGA_WAGGA_GPFS_FISCAL_YEAR,
          options.listingHtml,
        ));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: WAGGA_WAGGA_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Wagga Wagga City Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: WaggaWaggaGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: WAGGA_WAGGA_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Wagga Wagga City Council FY2025-26 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: WaggaWaggaGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: WAGGA_WAGGA_GPFS_REPORTING_URL,
      };
      const parsed = parseWaggaWaggaGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'wagga-wagga-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'wagga-wagga-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Wagga Wagga City Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
