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
 * Fourth NSW council GPFS adapter: City of Parramatta's audited General Purpose
 * Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1), City of Sydney (§7.2) and Blacktown (§7.3)
 * reference implementations in docs/NSW_COUNCILS.md with a Parramatta-specific
 * layout adapter. It is a separate source id (`parramatta-gpfs`) from every
 * other source. Every row is non-additive `agency_detail` with no region/LGA
 * allocation, so it can never be summed with the 245 Dubbo budget rows, any
 * existing council GPFS source, the 215 pre-existing AusTender / data.nsw /
 * GrantConnect / QGIP / ACNC rows whose delivery_entity mentions Parramatta, or
 * any other council.
 *
 * The PDF URL is discovered from the council's official financial-statements
 * page, which links a dedicated FY2024-25 page that in turn links the audited
 * statements (never a hard-coded document URL). The exact bytes are SHA-256
 * archived outside the repo and the printed `$ '000` unit is required. The
 * printed income-statement lines, B1-1 "Total functions and activities" and the
 * Statement of Comprehensive Income are reconciled exactly before any row is
 * emitted. Total expenses is the printed B1-1 total, never a component sum.
 *
 * Like Blacktown, the Parramatta income statement prints the Original (budget)
 * column *before* the line label and the two actual columns *after* it (Actual
 * 2025, Actual 2024). Every emitted value is therefore the first amount after
 * the printed label, which is the FY2024-25 actual. Unlike Blacktown, the
 * printed "Net loss from the disposal of assets" is a non-zero *expense*
 * component ($7,307 thousand) and is emitted as such.
 */

export const PARRAMATTA_GPFS_ID = 'parramatta-gpfs';
export const PARRAMATTA_GPFS_NAME = 'City of Parramatta — General Purpose Financial Statements';
export const PARRAMATTA_GPFS_PUBLISHER = 'City of Parramatta';
export const PARRAMATTA_GPFS_REPORTING_URL =
  'https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements';
export const PARRAMATTA_GPFS_FISCAL_YEAR = '2024-25';
export const PARRAMATTA_GPFS_TARGET_YEAR_LABEL = '2024/25';
export const PARRAMATTA_GPFS_SOURCE_DATASET = 'City of Parramatta GPFS 2024-25';
export const PARRAMATTA_GPFS_LICENSE =
  '© City of Parramatta. Published council documents used here for public-interest research; not an open-data licence grant.';
export const PARRAMATTA_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';

export interface ParramattaGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The dedicated financial-statements page the PDF was discovered from. */
  listing_url?: string;
}

export interface ParramattaGpfsYearPage {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
}

export interface ParramattaGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface ParramattaGpfsParseContext {
  document: ParramattaGpfsDocument;
  archive: ParramattaGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface ParramattaGpfsRejection {
  section: string;
  reason: string;
}

export type ParramattaGpfsSection = 'revenue' | 'expenses' | 'result';

export interface ParramattaGpfsLineSpec {
  key: string;
  label: string;
  section: ParramattaGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'B1-1 Functions or activities';
}

/**
 * The printed income-statement lines we emit. The printed expense-by-nature
 * components reconcile exactly to the printed "Total expenses ... excluding
 * depreciation" line, which together with the printed depreciation line bridges
 * to the printed B1-1 total expenses. We do not emit the B1-1 function split:
 * it is used only to source the printed total expenses and the printed total
 * income/operating-result checks, not emitted or summed.
 */
export const PARRAMATTA_GPFS_LINES: ReadonlyArray<ParramattaGpfsLineSpec> = [
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
  {
    key: 'net_result_before_capital_grants',
    label:
      'Net operating result for the year before grants and contributions provided for capital purposes',
    section: 'result',
    statement: 'Income Statement',
  },
];

interface ParramattaGpfsLineValue {
  spec: ParramattaGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface ParramattaGpfsReconciliation {
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
  net_loss_from_disposal_of_assets: number;
  net_result: number;
  net_result_before_capital_grants: number;
  printed_total_expenses_excluding_depreciation: number;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  comprehensive_income_net_result: number;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface ParramattaGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: ParramattaGpfsReconciliation | null;
  warnings: string[];
  rejections: ParramattaGpfsRejection[];
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

/** Convert "2024 to 2025", "2024/2025", "2024-25" or "2024/25" to "2024-25". */
export function fiscalYearFromParramattaGpfsLink(text: string): string | null {
  const normalized = text
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
 * Discover the dedicated FY financial-statements pages linked from the official
 * reporting index (e.g. ".../2024-2025-annual-financial-statements"). The index
 * itself does not link the PDFs directly, so this is the first discovery hop.
 */
export function parseParramattaGpfsYearPageLinks(
  html: string,
  baseUrl: string = PARRAMATTA_GPFS_REPORTING_URL,
): ParramattaGpfsYearPage[] {
  const pages: ParramattaGpfsYearPage[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors(html)) {
    const haystack = `${anchor.title} ${anchor.text}`;
    if (!/annual financial statements/i.test(haystack)) continue;
    if (/past|archive/i.test(haystack)) continue;
    if (/\.pdf(?:$|\?)/i.test(anchor.href)) continue;
    const fiscalYear =
      fiscalYearFromParramattaGpfsLink(haystack) ?? fiscalYearFromParramattaGpfsLink(anchor.href);
    if (!fiscalYear) continue;
    let url: string;
    try {
      url = new URL(anchor.href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    pages.push({
      id: `financial-statements-${fiscalYear}`,
      title: anchor.title || anchor.text,
      url,
      fiscal_year: fiscalYear,
    });
  }
  return pages;
}

/** Select the dedicated financial-statements page for the requested fiscal year. */
export function selectParramattaGpfsYearPage(
  pages: readonly ParramattaGpfsYearPage[],
  fiscalYear: string = PARRAMATTA_GPFS_FISCAL_YEAR,
): ParramattaGpfsYearPage {
  const page = pages.find((entry) => entry.fiscal_year === fiscalYear);
  if (!page) {
    throw new Error(
      `No published City of Parramatta financial-statements page for FY${fiscalYear} was found on ${PARRAMATTA_GPFS_REPORTING_URL}; refusing to guess a page URL`,
    );
  }
  return page;
}

/**
 * Discover the audited GPFS PDF links from a dedicated financial-statements
 * page. The fiscal year comes from the link text and title (and, as a fallback,
 * the URL); annual reports and non-financial-statement links are ignored. No
 * document URL is hard-coded.
 */
export function parseParramattaGpfsReportLinks(
  html: string,
  baseUrl: string,
): ParramattaGpfsDocument[] {
  const links: ParramattaGpfsDocument[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors(html)) {
    const haystack = `${anchor.title} ${anchor.text}`;
    if (!/financial statements/i.test(haystack)) continue;
    if (/annual report/i.test(haystack)) continue;
    if (!/\.pdf(?:$|\?)/i.test(anchor.href)) continue;
    const fiscalYear =
      fiscalYearFromParramattaGpfsLink(haystack) ?? fiscalYearFromParramattaGpfsLink(anchor.href);
    if (!fiscalYear) continue;
    let url: string;
    try {
      url = new URL(anchor.href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({
      id: `gpfs-${fiscalYear}`,
      title: anchor.title || anchor.text,
      url,
      fiscal_year: fiscalYear,
      listing_url: baseUrl,
    });
  }
  return links;
}

/** Select the audited GPFS for the requested fiscal year. */
export function selectParramattaGpfsDocument(
  links: readonly ParramattaGpfsDocument[],
  fiscalYear: string = PARRAMATTA_GPFS_FISCAL_YEAR,
): ParramattaGpfsDocument {
  const document = links.find((link) => link.fiscal_year === fiscalYear);
  if (!document) {
    throw new Error(
      `No published City of Parramatta General Purpose Financial Statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** Discover the audited GPFS document from the live reporting pages (two hops). */
export async function discoverParramattaGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = PARRAMATTA_GPFS_FISCAL_YEAR,
): Promise<ParramattaGpfsDocument> {
  const indexResponse = await fetchImpl(PARRAMATTA_GPFS_REPORTING_URL, { redirect: 'follow' });
  if (!indexResponse.ok) {
    throw new Error(
      `City of Parramatta reporting page fetch HTTP ${indexResponse.status} for ${PARRAMATTA_GPFS_REPORTING_URL}`,
    );
  }
  const indexHtml = await indexResponse.text();
  const yearPage = selectParramattaGpfsYearPage(
    parseParramattaGpfsYearPageLinks(indexHtml),
    fiscalYear,
  );
  const yearResponse = await fetchImpl(yearPage.url, { redirect: 'follow' });
  if (!yearResponse.ok) {
    throw new Error(
      `City of Parramatta financial-statements page fetch HTTP ${yearResponse.status} for ${yearPage.url}`,
    );
  }
  const yearHtml = await yearResponse.text();
  return selectParramattaGpfsDocument(
    parseParramattaGpfsReportLinks(yearHtml, yearPage.url),
    fiscalYear,
  );
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectParramattaGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectParramattaGpfsUnit([page.text]);
  const kind = unit.kind;
  if (!kind || unit.ambiguous) {
    throw new Error(
      `${section} p${page.page_number}: no unambiguous printed currency unit (${unit.reason}); refusing to guess`,
    );
  }
  return { kind, reason: unit.reason };
}

function firstAmountAfter(text: string, label: string): number | null {
  const index = text.indexOf(label);
  if (index < 0) return null;
  const rest = text.slice(index + label.length);
  const match = rest.match(MONEY_TOKEN);
  if (!match) return null;
  return parseAmountCell(match[0])?.value ?? null;
}

function allAmountsAfter(text: string, label: string): number[] {
  const index = text.indexOf(label);
  if (index < 0) return [];
  const rest = text.slice(index + label.length);
  const matches = rest.match(MONEY_TOKEN) ?? [];
  return matches
    .map((token) => parseAmountCell(token)?.value ?? null)
    .filter((value): value is number => value !== null);
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
  spec: ParramattaGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): ParramattaGpfsLineValue | null {
  const value = firstAmountAfter(text, spec.label);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly ParramattaGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface ParramattaGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse B1-1 "Total functions and activities". The row prints ten numbers
 * (Income 2025/2024, Expenses 2025/2024, Operating result 2025/2024, Grants
 * 2025/2024, Carrying amount 2025/2024); the 2025 values are at indices
 * 0, 2, 4 and 6.
 */
export function parseParramattaGpfsFunctionsTotals(
  page: PdfPage,
): ParramattaGpfsFunctionsTotals | null {
  const text = normalizeText(page.text);
  const label = 'Total functions and activities';
  if (!text.includes(label)) return null;
  const values = allAmountsAfter(text, label);
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

function gpfsFundingSource(spec: ParramattaGpfsLineSpec): string {
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
  context: ParramattaGpfsParseContext,
  spec: ParramattaGpfsLineSpec,
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
export function parramattaGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = PARRAMATTA_GPFS_FISCAL_YEAR,
): string {
  return `${PARRAMATTA_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: ParramattaGpfsLineValue,
  context: ParramattaGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  return {
    amount_cents: moneyToCents(line.value, unit),
    measure_type: 'actual',
    fiscal_year: PARRAMATTA_GPFS_FISCAL_YEAR,
    source_id: PARRAMATTA_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: parramattaGpfsNaturalKey(
      context.document.url,
      spec.key,
      PARRAMATTA_GPFS_FISCAL_YEAR,
    ),
    project_name: `City of Parramatta GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: 'City of Parramatta',
    funding_source: gpfsFundingSource(spec),
    source_dataset: PARRAMATTA_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: PARRAMATTA_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    extraction_confidence: 'high',
    gpfs_line_item: spec.key,
    gpfs_line_label: spec.label,
    gpfs_unit: gpfsUnitLabel(unit),
    gpfs_section: spec.section,
    gpfs_statement: spec.statement,
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
export function parseParramattaGpfsExtraction(
  extraction: PdfExtraction,
  context: ParramattaGpfsParseContext,
): ParramattaGpfsParseResult {
  const warnings: string[] = [];
  const rejections: ParramattaGpfsRejection[] = [];
  const reject = (reason: string): ParramattaGpfsParseResult => {
    rejections.push({ section: 'gpfs', reason });
    warnings.push(reason);
    return { records: [], reconciliation: null, warnings, rejections };
  };

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
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

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: ParramattaGpfsFunctionsTotals | null;
  let comprehensiveNetResult: number | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseParramattaGpfsFunctionsTotals(functionsPage);
    comprehensiveNetResult = firstAmountAfter(
      normalizeText(comprehensivePage.text),
      'from Income Statement',
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
  const unit = incomeUnit.kind;

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: ParramattaGpfsLineValue[] = [];
  for (const spec of PARRAMATTA_GPFS_LINES) {
    if (spec.key === 'total_expenses') continue;
    const line = lineValue(incomeText, spec, incomePage.page_number, errors);
    if (line) values.push(line);
  }
  if (errors.length > 0) return reject(errors.join('; '));

  const totalExpensesLine: ParramattaGpfsLineValue = {
    spec: PARRAMATTA_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
    value: functionsTotals.expenses,
    page_number: functionsTotals.page_number,
  };
  values.push(totalExpensesLine);

  const totalRevenue = lineByKey(values, 'total_revenue');
  const employee = lineByKey(values, 'employee_expenses');
  const depreciation = lineByKey(values, 'depreciation_amortisation_impairment');
  const grantsOperating = lineByKey(values, 'government_grants_operating');
  const grantsCapital = lineByKey(values, 'government_grants_capital');
  const netLossDisposal = lineByKey(values, 'net_loss_from_disposal_of_assets');
  const netResult = lineByKey(values, 'net_result');
  const netResultBeforeCapital = lineByKey(values, 'net_result_before_capital_grants');
  const expensesExDepreciation = lineByKey(values, 'total_expenses_excluding_depreciation');
  const rates = lineByKey(values, 'rates_and_annual_charges');
  const userCharges = lineByKey(values, 'user_charges_and_fees');
  const otherRevenues = lineByKey(values, 'other_revenues');
  const interest = lineByKey(values, 'interest_and_investment_income');
  const otherIncome = lineByKey(values, 'other_income');
  const materials = lineByKey(values, 'materials_and_services');
  const borrowing = lineByKey(values, 'borrowing_costs');
  const otherExpenses = lineByKey(values, 'other_expenses');

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
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
    otherIncome!;
  // Unlike Blacktown's nil disposal line, Parramatta's printed "Net loss from
  // the disposal of assets" is a non-zero expense component of the printed
  // total expenses excluding depreciation, so it participates in the bridge.
  const expenseComponentsSum =
    employee! + materials! + borrowing! + otherExpenses! + netLossDisposal!;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = functionsTotals.expenses;

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
    'printed total expenses excluding depreciation + printed depreciation = B1-1 total expenses',
    totalExpenses,
    faceExpenseBridge,
  );
  check('B1-1 total income = printed total revenue', totalRevenue!, functionsTotals.income);
  check('B1-1 operating result = printed net result', netResult!, functionsTotals.operating_result);
  check(
    'B1-1 grants and contributions = operating grants + capital grants',
    grantsOperating! + grantsCapital!,
    functionsTotals.grants_and_contributions,
  );
  check(
    'printed total revenue - printed total expenses = printed net result',
    netResult!,
    totalRevenue! - totalExpenses,
  );
  check(
    'printed net result - capital grants = printed net result before capital grants',
    netResultBeforeCapital!,
    netResult! - grantsCapital!,
  );
  check(
    'Statement of Comprehensive Income net result = Income Statement net result',
    netResult!,
    comprehensiveNetResult!,
  );
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: ParramattaGpfsReconciliation = {
    fiscal_year: PARRAMATTA_GPFS_FISCAL_YEAR,
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
    net_loss_from_disposal_of_assets: netLossDisposal!,
    net_result: netResult!,
    net_result_before_capital_grants: netResultBeforeCapital!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    functions_total_income: functionsTotals.income,
    functions_total_expenses: functionsTotals.expenses,
    functions_operating_result: functionsTotals.operating_result,
    functions_grants_and_contributions: functionsTotals.grants_and_contributions,
    comprehensive_income_net_result: comprehensiveNetResult!,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'all printed face-statement line sums equal their printed subtotals/total',
      'B1-1 Total functions and activities equals the face statement',
      'printed total expenses excluding depreciation + depreciation = B1-1 total expenses',
      'Statement of Comprehensive Income net result equals the Income Statement net result',
    ],
  };

  const reconciliationNote =
    'printed total expenses from B1-1, not a component sum; face-statement bridge, B1-1 totals and comprehensive-income net result reconcile exactly';
  // The printed "before grants and contributions provided for capital purposes"
  // result is negative ((13,546) thousand). The measure model stores
  // non-negative integer cents only, so that non-required bridge line is kept
  // in the reconciliation evidence but not emitted as a row; the required net
  // result (55,652 thousand) is emitted with its printed positive sign.
  const emittedValues = values.filter(
    (value) => value.spec.key !== 'net_result_before_capital_grants',
  );
  const records = emittedValues.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface ParramattaGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: ParramattaGpfsDocument;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through to the stable name.
  }
  return 'parramatta-financial-statements-2024-25.pdf';
}

/** Build the live City of Parramatta GPFS connector. */
export function createParramattaGpfsConnector(
  options: ParramattaGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: PARRAMATTA_GPFS_ID,
    name: PARRAMATTA_GPFS_NAME,
    publisher: PARRAMATTA_GPFS_PUBLISHER,
    source_url: PARRAMATTA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: PARRAMATTA_GPFS_LICENSE,
    notes:
      "Fourth NSW council GPFS adapter: one council only (City of Parramatta), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official financial-statements page's dedicated FY2024-25 page (no hard-coded document URL), SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, never a component sum.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        (await discoverParramattaGpfsDocument(fetchImpl, PARRAMATTA_GPFS_FISCAL_YEAR));
      const response = await fetchImpl(document.url, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`Parramatta GPFS fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: PARRAMATTA_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited City of Parramatta FY2024-25 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: ParramattaGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: PARRAMATTA_GPFS_REPORTING_URL,
      };
      const parsed = parseParramattaGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({ kind: 'parramatta-gpfs-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'parramatta-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Parramatta GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
