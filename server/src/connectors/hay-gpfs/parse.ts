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
import { HAY_GPFS_LINES, type HayGpfsLineSpec } from './config.js';
import {
  HAY_GPFS_DATA_QUALITY_FLAG,
  HAY_GPFS_DELIVERY_ENTITY,
  HAY_GPFS_DOCUMENT_PIN,
  HAY_GPFS_FISCAL_YEAR,
  HAY_GPFS_ID,
  HAY_GPFS_LICENSE,
  HAY_GPFS_NAME,
  HAY_GPFS_PLANS_URL,
  HAY_GPFS_PUBLISHER,
  HAY_GPFS_REPORTING_URL,
  HAY_GPFS_REQUEST_HEADERS,
  HAY_GPFS_SOURCE_DATASET,
  HAY_GPFS_STANDALONE_FS_BYTES,
  HAY_GPFS_STANDALONE_FS_PAGES,
  HAY_GPFS_STANDALONE_FS_SHA256,
} from './meta.js';

/**
 * NSW council GPFS adapter: Hay Shire Council's FY2025-26 General Purpose
 * Financial Statements (year ended 30 June 2026).
 *
 * The official combined "Council Meetings and Reports" page publishes a
 * standalone "ANNUAL FINANCIAL STATEMENTS for the year ended 30 June 2026"
 * PDF. The dedicated Council Plans and Reports page does not list the FS, and a
 * stale "Annual Financial Statements 2025" link on the same feed returns HTTP
 * 404. The FY2025-26 PDF is the latest published GPFS and is the source ingested
 * here; the prior FY2024-25 FS remains in the same feed.
 *
 * Note on the audit report: the FY2025-26 GPFS PDF carries placeholder pages for
 * the two section 417 independent auditor reports ("Please uplift Council's
 * Audit Report PDF"), so the signed Auditor-General opinion is not embedded in
 * this PDF. The prior FY2024-25 HSC Annual Financial Statements PDF in the same
 * feed does embed the signed opinion. The GPFS primary statements themselves are
 * the current official statements and reconcile exactly.
 *
 * The printed unit is `$ '000`. Nothing is emitted unless the Income Statement,
 * B1-1 "Total functions and activities", Statement of Comprehensive Income,
 * Statement of Financial Position, Statement of Changes in Equity and Statement
 * of Cash Flows reconcile exactly at zero tolerance.
 *
 * Hay does not print a "Total expenses" line on the face Income Statement. Total
 * expenses is the documented bridge of the printed expenses-excluding-
 * depreciation line ($13,972 thousand) plus the printed depreciation,
 * amortisation and impairment line ($5,311 thousand), giving $19,283 thousand;
 * the B1-1 expense total equals that bridge exactly. The printed net loss from
 * the disposal of assets ($91 thousand) is an expense component and is emitted.
 */
export interface HayGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  listing_url?: string;
  resolved_url?: string;
}

export interface HayGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface HayGpfsParseContext {
  document: HayGpfsDocument;
  archive: HayGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface HayGpfsRejection {
  section: string;
  reason: string;
}

export interface HayGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
  carrying_amount: number;
}

export interface HayGpfsReconciliation {
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
  comprehensive_attributable_council: number;
  cash_and_cash_equivalents: number;
  prior_year_cash_and_cash_equivalents: number;
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

export interface HayGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: HayGpfsReconciliation | null;
  warnings: string[];
  rejections: HayGpfsRejection[];
}

const NOTE_REFERENCE = /\b[A-Z]\d+(?:-\d+)?[a-z]?\b/g;
const MONEY_TOKEN = /(?:\(\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\))?/g;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(NOTE_REFERENCE, ' ').trim();
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

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectHayGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectHayGpfsUnit([page.text]);
  if (!unit.kind || unit.ambiguous) {
    throw new Error(
      `${section} p${page.page_number}: no unambiguous printed currency unit (${unit.reason}); refusing to guess`,
    );
  }
  return { kind: unit.kind, reason: unit.reason };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Parse a fiscal year from a printed link label or filename. Only explicit
 * conventions are accepted: "year ended 30 June YYYY", or a YYYY-YYYY / YYYY-YY
 * range whose end year is the start year plus one. A bare year is never guessed.
 */
export function fiscalYearFromHayFinancialStatementsLink(text: string): string | null {
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
    const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!hrefMatch) continue;
    const titleMatch = /title\s*=\s*["']([^"']*)["']/i.exec(attrs);
    out.push({
      href: hrefMatch[1]!,
      title: titleMatch ? decodeHtml(titleMatch[1]!) : '',
      text: decodeHtml(match[2]!.replace(/<[^>]+>/g, ' ')),
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
 * Parse the standalone Annual Financial Statements links from the official
 * reporting feed. Older "Annual Financial Statements 2025" and the
 * "Annual Report 2023-2024 including financials" are ignored unless the label
 * carries an explicit "year ended" or YYYY-YY range.
 */
export function parseHayFinancialStatementsLinks(
  html: string,
  baseUrl: string,
): HayGpfsDocument[] {
  const links: HayGpfsDocument[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors(html)) {
    const label = `${anchor.title} ${anchor.text}`.replace(/\s+/g, ' ').trim();
    const looksLikeFs =
      /annual[\s_-]*(?:financial[\s_-]*statements?|financials?)/i.test(anchor.href) ||
      /annual\s+financial\s+statements?/i.test(label);
    if (!looksLikeFs) continue;
    if (!/\.pdf(?:\.aspx)?(?:$|[?#])/i.test(anchor.href)) continue;
    const fiscalYear =
      fiscalYearFromHayFinancialStatementsLink(label) ??
      fiscalYearFromHayFinancialStatementsLink(anchor.href);
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

/** Select the standalone FS upload for the requested fiscal year. */
export function selectHayGpfsDocument(
  links: readonly HayGpfsDocument[],
  fiscalYear: string = HAY_GPFS_FISCAL_YEAR,
): HayGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Hay Shire Council annual financial statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** The documented official pin used when the live listing hides the FS link. */
export function hayPinnedDocument(): HayGpfsDocument {
  return {
    id: `annual-financial-statements-${HAY_GPFS_FISCAL_YEAR}`,
    title: 'Hay Shire Council Annual Financial Statements for the year ended 30 June 2026',
    url: HAY_GPFS_DOCUMENT_PIN,
    fiscal_year: HAY_GPFS_FISCAL_YEAR,
    listing_url: HAY_GPFS_REPORTING_URL,
  };
}

/**
 * Discover the standalone FY2025-26 GPFS. The connector fetches the official
 * combined "Council Meetings and Reports" feed (and the Council Plans and
 * Reports page as a secondary source), then parses the Annual Financial
 * Statements link. If those pages are unavailable or yield no usable FY2025-26
 * link, it uses the documented official pin. The exact bytes are still SHA-256
 * re-verified by the connector.
 */
export async function discoverHayGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = HAY_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<HayGpfsDocument> {
  let html: string | null = listingHtml ?? null;
  if (html === null) {
    for (const pageUrl of [HAY_GPFS_REPORTING_URL, HAY_GPFS_PLANS_URL]) {
      try {
        const response = await fetchImpl(pageUrl, {
          redirect: 'follow',
          headers: HAY_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) continue;
        const candidate = await response.text();
        const candidateLinks = parseHayFinancialStatementsLinks(candidate, pageUrl);
        if (candidateLinks.length > 0) {
          html = candidate;
          break;
        }
      } catch {
        // Network failure on one page falls through to the next / the pin.
      }
    }
  }
  if (html) {
    for (const baseUrl of [HAY_GPFS_REPORTING_URL, HAY_GPFS_PLANS_URL]) {
      const links = parseHayFinancialStatementsLinks(html, baseUrl);
      const match = links
        .filter((link) => link.fiscal_year === fiscalYear)
        .sort((a, b) => b.url.localeCompare(a.url))[0];
      if (match) return match;
    }
  }
  if (fiscalYear !== HAY_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No published Hay Shire Council annual financial statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return hayPinnedDocument();
}

/**
 * Parse the B1-1 "Total functions and activities" row. It prints ten numbers
 * (Income 2026/2025, Expenses 2026/2025, Operating result 2026/2025, Grants
 * 2026/2025, Carrying amount 2026/2025); the 2026 values are at even indices.
 */
export function parseHayGpfsFunctionsTotals(page: PdfPage): HayGpfsFunctionsTotals | null {
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

function gpfsFundingSource(spec: HayGpfsLineSpec): string {
  if (spec.potential_double_count) return 'Government grants and contributions';
  if (spec.key === 'total_revenue')
    return 'Council total revenue (own-source plus government grants and contributions)';
  if (spec.key === 'total_expenses' || spec.key === 'total_expenses_excluding_depreciation')
    return 'Council expenditure';
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
  context: HayGpfsParseContext,
  spec: HayGpfsLineSpec,
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
export function hayGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = HAY_GPFS_FISCAL_YEAR,
): string {
  return `${HAY_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: { spec: HayGpfsLineSpec; value: number; page_number: number },
  context: HayGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: HAY_GPFS_FISCAL_YEAR,
    source_id: HAY_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: hayGpfsNaturalKey(context.document.url, spec.key, HAY_GPFS_FISCAL_YEAR),
    project_name: `Hay Shire Council GPFS 2025-26 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: HAY_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: HAY_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: HAY_GPFS_DATA_QUALITY_FLAG,
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

function rejectWith(warnings: string[], reason: string): HayGpfsParseResult {
  warnings.push(reason);
  return {
    records: [],
    reconciliation: null,
    warnings,
    rejections: [{ section: 'gpfs', reason }],
  };
}

/**
 * Parse the standalone FY2025-26 audited GPFS into validated, non-additive
 * measure rows. Nothing is emitted unless the printed unit is explicit and every
 * face-statement, B1-1, comprehensive-income, financial-position, equity and
 * cash-flow reconciliation check passes exactly.
 */
export function parseHayGpfsExtraction(
  extraction: PdfExtraction,
  context: HayGpfsParseContext,
): HayGpfsParseResult {
  const warnings: string[] = [];

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      text.includes('Net operating result for the year'),
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
      text.includes('Net change in cash and cash equivalents') &&
      text.includes('Net cash flows from operating activities'),
  );
  if (!cashPage) {
    return rejectWith(warnings, 'Statement of Cash Flows page not found; no cash reconciliation');
  }

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let comprehensiveUnit: PrintedUnit;
  let positionUnit: PrintedUnit;
  let cashUnit: PrintedUnit;
  let functionsTotals: HayGpfsFunctionsTotals | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    comprehensiveUnit = requirePrintedUnit(comprehensivePage, 'Statement of Comprehensive Income');
    positionUnit = requirePrintedUnit(positionPage, 'Statement of Financial Position');
    cashUnit = requirePrintedUnit(cashPage, 'Statement of Cash Flows');
    functionsTotals = parseHayGpfsFunctionsTotals(functionsPage);
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

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: Array<{ spec: HayGpfsLineSpec; value: number; page_number: number }> = [];
  for (const spec of HAY_GPFS_LINES) {
    if (spec.key === 'total_expenses') continue;
    const value = firstAmountAfter(incomeText, spec.label);
    if (value === null) {
      errors.push(`p${incomePage.page_number}: could not read printed value for "${spec.label}"`);
      continue;
    }
    values.push({ spec, value, page_number: incomePage.page_number });
  }
  if (errors.length > 0) return rejectWith(warnings, errors.join('; '));

  const valueByKey = (key: string): number | null =>
    values.find((entry) => entry.spec.key === key)?.value ?? null;

  const totalRevenue = valueByKey('total_revenue');
  const rates = valueByKey('rates_and_annual_charges');
  const userCharges = valueByKey('user_charges_and_fees');
  const otherRevenue = valueByKey('other_revenues');
  const grantsOperating = valueByKey('government_grants_operating');
  const grantsCapital = valueByKey('government_grants_capital');
  const interest = valueByKey('interest_and_investment_income');
  const otherIncome = valueByKey('other_income');
  const employee = valueByKey('employee_expenses');
  const materials = valueByKey('materials_and_services');
  const borrowing = valueByKey('borrowing_costs');
  const otherExpenses = valueByKey('other_expenses');
  const netLossDisposal = valueByKey('net_loss_from_disposal_of_assets');
  const netResult = valueByKey('net_result');
  const expensesExDepreciation = valueByKey('total_expenses_excluding_depreciation');
  const depreciation = valueByKey('depreciation_amortisation_impairment');
  const operatingResultExcludingDepreciation = firstAmountAfter(
    incomeText,
    'Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets',
  );
  const netResultBeforeCapital = firstAmountAfter(
    incomeText,
    'Net operating result for the year before grants and contributions provided for capital purposes',
  );

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['rates_and_annual_charges', rates],
    ['user_charges_and_fees', userCharges],
    ['other_revenues', otherRevenue],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['interest_and_investment_income', interest],
    ['other_income', otherIncome],
    ['employee_expenses', employee],
    ['materials_and_services', materials],
    ['borrowing_costs', borrowing],
    ['other_expenses', otherExpenses],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['net_result', netResult],
    ['total_expenses_excluding_depreciation', expensesExDepreciation],
    ['depreciation_amortisation_impairment', depreciation],
    ['operating_result_excluding_depreciation', operatingResultExcludingDepreciation],
    ['net_result_before_capital_grants', netResultBeforeCapital],
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

  const totalExpensesLine: HayGpfsLineSpec = HAY_GPFS_LINES.find(
    (line) => line.key === 'total_expenses',
  )!;
  values.push({
    spec: totalExpensesLine,
    value: totalExpenses,
    page_number: incomePage.page_number,
  });

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
      'Gain on revaluation of infrastructure, property, plant and equipment',
    ) ??
    firstAmountAfter(
      comprehensiveText,
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment',
    ) ??
    firstAmountAfter(
      comprehensiveText,
      'Gain / (loss) on revaluation of infrastructure, property, plant and equipment',
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
      `p${comprehensivePage.page_number}: could not read the printed revaluation component; no rows ingested`,
    );
  }

  const positionText = normalizeText(positionPage.text);
  const cashAmounts = amountsAfter(positionText, 'Cash and cash equivalents');
  const cashAndCashEquivalents = cashAmounts[0] ?? null;
  const priorYearCashAndCashEquivalents = cashAmounts[1] ?? null;
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
    ['prior_year_cash_and_cash_equivalents', priorYearCashAndCashEquivalents],
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
  if (equityOpening.length < 6 || equityClosing.length < 6) {
    return rejectWith(
      warnings,
      `p${equityPage.page_number}: could not read opening/closing equity balances; no rows ingested`,
    );
  }
  const equityOpeningAccumulated = equityOpening[0]!;
  const equityOpeningIppe = equityOpening[1]!;
  const equityOpeningTotal = equityOpening[2]!;
  const equityClosingAccumulated = equityClosing[0]!;
  const equityClosingIppe = equityClosing[1]!;
  const equityClosingTotal = equityClosing[2]!;

  const cashText = normalizeText(cashPage.text);
  const cashOperating = firstAmountAfter(cashText, 'Net cash flows from operating activities');
  const cashInvesting = firstAmountAfter(cashText, 'Net cash flows used in investing activities');
  const cashFinancing = firstAmountAfter(
    cashText,
    'Net cash flow provided used in financing activities',
  );
  const cashNetChange = firstAmountAfter(cashText, 'Net change in cash and cash equivalents');
  const cashOpening = firstAmountAfter(cashText, 'Cash and cash equivalents at beginning of year');
  const cashClosing = firstAmountAfter(cashText, 'Cash and cash equivalents at end of year');
  if (
    cashOperating === null ||
    cashInvesting === null ||
    cashFinancing === null ||
    cashNetChange === null ||
    cashOpening === null ||
    cashClosing === null
  ) {
    return rejectWith(
      warnings,
      `p${cashPage.page_number}: could not read the printed cash-flow subtotals; no rows ingested`,
    );
  }

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
    'printed revaluation component = printed other comprehensive income',
    comprehensiveOtherIncome!,
    comprehensiveRevaluation!,
  );
  check(
    'printed net result + printed other comprehensive income = printed total comprehensive income',
    comprehensiveTotal!,
    netResult! + comprehensiveOtherIncome!,
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
    'equity closing accumulated = SoFP accumulated surplus',
    accumulatedSurplus!,
    equityClosingAccumulated,
  );
  check(
    'equity closing IPPE = SoFP IPPE revaluation surplus',
    ippeRevaluationSurplus!,
    equityClosingIppe,
  );
  check(
    'cash operating + investing + financing = net change in cash',
    cashNetChange!,
    cashOperating! + cashInvesting! + cashFinancing!,
  );
  check(
    'opening cash + net change = closing cash',
    cashClosing!,
    cashOpening! + cashNetChange!,
  );
  check('closing cash = SoFP cash and cash equivalents', cashAndCashEquivalents!, cashClosing!);
  check(
    'SoFP prior-year cash = cash-flow opening cash',
    priorYearCashAndCashEquivalents!,
    cashOpening!,
  );
  if (checks.length > 0) {
    return rejectWith(
      warnings,
      `GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`,
    );
  }

  const reconciliation: HayGpfsReconciliation = {
    fiscal_year: HAY_GPFS_FISCAL_YEAR,
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
    comprehensive_attributable_council: comprehensiveTotal!,
    cash_and_cash_equivalents: cashAndCashEquivalents!,
    prior_year_cash_and_cash_equivalents: priorYearCashAndCashEquivalents!,
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
      'the printed revaluation component equals printed other comprehensive income',
      'printed net result + printed other comprehensive income equals printed total comprehensive income',
      'Statement of Financial Position subtotals (assets, liabilities, net assets, accumulated surplus plus IPPE revaluation surplus) reconcile exactly',
      'Statement of Changes in Equity opening + total comprehensive income = closing, equal to SoFP equity',
      'Statement of Cash Flows operating + investing + financing = net change, opening + net change = closing, closing cash reconciles to the SoFP, and the SoFP prior-year cash equals the printed opening cash',
      'the printed net result is stored with a magnitude and a negative sign marker only when printed negative; the before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the documented bridge of the printed expenses-excluding-depreciation line (13,972) plus the printed depreciation/amortisation/impairment line (5,311) = 19,283, equal to the printed B1-1 expense total; the printed net loss from the disposal of assets (91) is an expense component and is emitted; B1-1 income (24,591) includes grants and contributions (operating 9,803 + capital 6,568 = 16,371) and equals the face total income; B1-1 income minus B1-1 expenses equals the printed operating result and net result (5,308); the net result plus other comprehensive income (revaluation 13,779) equals total comprehensive income attributable to Council (19,087); the printed before-capital result (-1,260) is retained in reconciliation evidence only; the balance sheet (accumulated surplus 91,325 plus IPPE revaluation surplus 195,082 = total equity 286,407) and cash-flow statement (opening 21,521 less the net change 1,137 = closing 20,384) reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections: [] };
}

export interface HayGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the official page. */
  document?: HayGpfsDocument;
  /** Pre-fetched PDF bytes from the browser/WAF path. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched official listing HTML from the browser/WAF path. */
  listingHtml?: string;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf(?:\.aspx)?$/i.test(name)) {
      return name.replace(/[^A-Za-z0-9._-]+/g, '-');
    }
  } catch {
    // Fall through to the stable name.
  }
  return 'Annual_Financial_Statements-2026.pdf';
}

/** Build the live Hay Shire Council GPFS connector. */
export function createHayGpfsConnector(options: HayGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: HAY_GPFS_ID,
    name: HAY_GPFS_NAME,
    publisher: HAY_GPFS_PUBLISHER,
    source_url: HAY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: HAY_GPFS_LICENSE,
    notes:
      "NSW council GPFS adapter: one council only (Hay Shire Council), FY2025-26 General Purpose Financial Statements (year ended 30 June 2026) from the official standalone Annual Financial Statements PDF found in the official Council Meetings and Reports feed. The FY2025-26 GPFS PDF carries placeholder pages for the section 417 independent auditor reports (the signed opinion is published separately and is not embedded); the prior FY2024-25 FS in the same feed embeds the signed Auditor-General opinion. The FY2025-26 PDF is discovered live with a documented official fallback pin; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Hay prints the net loss from the disposal of assets as an expense component. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation/amortisation/impairment, equal to the printed B1-1 expense total. B1-1 income includes grants and contributions, so B1-1 income equals the face total income, B1-1 operating result equals the net result, and B1-1 grants equal operating plus capital grants. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverHayGpfsDocument(
          fetchImpl,
          HAY_GPFS_FISCAL_YEAR,
          options.listingHtml,
        ));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: HAY_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Hay Shire Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: HayGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: HAY_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Hay Shire Council FY2025-26 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: HayGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: HAY_GPFS_REPORTING_URL,
      };
      const parsed = parseHayGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'hay-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'hay-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Hay Shire Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}

export {
  HAY_GPFS_DATA_QUALITY_FLAG,
  HAY_GPFS_DELIVERY_ENTITY,
  HAY_GPFS_DOCUMENT_PIN,
  HAY_GPFS_FISCAL_YEAR,
  HAY_GPFS_ID,
  HAY_GPFS_LICENSE,
  HAY_GPFS_LINES,
  HAY_GPFS_NAME,
  HAY_GPFS_PLANS_URL,
  HAY_GPFS_PUBLISHER,
  HAY_GPFS_REPORTING_URL,
  HAY_GPFS_REQUEST_HEADERS,
  HAY_GPFS_SOURCE_DATASET,
  HAY_GPFS_STANDALONE_FS_BYTES,
  HAY_GPFS_STANDALONE_FS_PAGES,
  HAY_GPFS_STANDALONE_FS_SHA256,
  type HayGpfsLineSpec,
};
