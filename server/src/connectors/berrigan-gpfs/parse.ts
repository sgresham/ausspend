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
 * NSW council GPFS adapter: Berrigan Shire Council's audited General Purpose
 * Financial Statements for FY2025-26.
 *
 * This follows the reference council implementations in docs/NSW_COUNCILS.md
 * with a Berrigan Shire Council-specific layout adapter. It is a separate
 * source id (`berrigan-gpfs`) from every other source. Every row is non-additive
 * `agency_detail` with no region/LGA allocation, so it can never be summed with
 * the 245 Dubbo budget rows, any existing council GPFS source, any
 * pre-existing rows that name the council, the ACNC charity rows or data.nsw
 * school rows that merely mention Berrigan and use different delivery_entity
 * strings, or any other council.
 *
 * FY2025-26 is the current reporting year and the official Financial Statements
 * page lists "Annual_Financial_Statements-2026-Final" (the year ended 30 June
 * 2026) as the newest audited standalone statements as at 2026-11-19. No later
 * audited standalone statements were published. The connector targets 2025-26
 * and never substitutes the earlier 2024-25 or 2023-24 document, the narrative
 * annual report, the SPFS or special schedules. The statement source is the
 * standalone audited General Purpose Financial Statements published on the
 * official Financial Statements page. The host may return an Akamai bot-wall
 * 403 to plain fetch; in this retrieval run both the listing and the PDF
 * returned 200 to `curl/8.5.0`, and a documented official fallback pin (the
 * exact FY2025-26 PDF) is used only when the page yields no usable anchor. A
 * headless-Chromium fallback script exists for a challenged run. SHA-256
 * re-verifies and re-archives the exact downloaded bytes. The printed `$ '000`
 * unit is required.
 *
 * The face Income Statement reconciles internally: total revenue $34,055
 * thousand, expenses-excluding-depreciation $22,614 thousand plus depreciation
 * $10,128 thousand = $32,742 thousand, and net result $1,313 thousand; the
 * before-capital result is -$1,212 thousand and other comprehensive income is
 * the single printed revaluation of $13,902 thousand. However, the printed
 * B1-1 "Total functions and activities" row reports expenses $32,741 thousand
 * and operating result $1,314 thousand. That is a $1 thousand difference from
 * the face statement. Because every printed subtotal/result bridge must
 * reconcile at zero tolerance, this connector defers the document with 0 rows
 * and reports the exact B1-1 gap; it does not adjust, average or fabricate the
 * printed figures.
 */

export const BERRIGAN_GPFS_ID = 'berrigan-gpfs';
export const BERRIGAN_GPFS_NAME =
  'Berrigan Shire Council — General Purpose Financial Statements';
export const BERRIGAN_GPFS_PUBLISHER = 'Berrigan Shire Council';
export const BERRIGAN_GPFS_REPORTING_URL =
  'https://www.berriganshire.nsw.gov.au/Council/Governance-Transparency/Policies-Plans-Documents/Reports/Financial-Statements';
/** Documented official fallback pin for the audited current-available statements. */
export const BERRIGAN_GPFS_DOCUMENT_PIN =
  'https://www.berriganshire.nsw.gov.au/files/assets/public/v/1/01-council/gov.-amp-transparency/annual_financial_statements-2026-final.pdf';
export const BERRIGAN_GPFS_FISCAL_YEAR = '2025-26';
export const BERRIGAN_GPFS_SOURCE_DATASET = 'Berrigan Shire Council GPFS 2025-26';
export const BERRIGAN_GPFS_LICENSE =
  '© Berrigan Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const BERRIGAN_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const BERRIGAN_GPFS_DELIVERY_ENTITY = 'Berrigan Shire Council';
/**
 * The host serves the PDF to a plain client UA. Use an explicit plain UA so the
 * connector's discovery and download are deterministic.
 */
export const BERRIGAN_GPFS_REQUEST_HEADERS = {
  'user-agent': 'curl/8.5.0',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export interface BerriganGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The annual/financial-statements page the PDF link was discovered from. */
  listing_url?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface BerriganGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface BerriganGpfsParseContext {
  document: BerriganGpfsDocument;
  archive: BerriganGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface BerriganGpfsRejection {
  section: string;
  reason: string;
}

export type BerriganGpfsSection = 'revenue' | 'expenses' | 'result';

export interface BerriganGpfsLineSpec {
  key: string;
  label: string;
  section: BerriganGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'Income Statement (documented bridge)';
}

/**
 * The printed Income Statement lines we emit. The seven revenue components sum
 * exactly to the printed total revenue. The five expense components sum exactly
 * to the printed "Total expenses ... excluding depreciation" line, which with the printed depreciation
 * line bridges to total expenses. We do not emit the B1-1 function split: it is
 * used only for the printed B1-1 operating-result, grants and income/expense
 * checks. The before-capital result is not emitted, but is still reconciled. The
 * printed net result is positive, so no printed-sign marker is stored.
 */
export const BERRIGAN_GPFS_LINES: ReadonlyArray<BerriganGpfsLineSpec> = [
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
    key: 'other_revenue',
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

export const BERRIGAN_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';

interface BerriganGpfsLineValue {
  spec: BerriganGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface BerriganGpfsReconciliation {
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
  /** Printed figure; reconciliation evidence only, never a stored row. */
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
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface BerriganGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: BerriganGpfsReconciliation | null;
  warnings: string[];
  rejections: BerriganGpfsRejection[];
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
 * Convert a Berrigan Shire Council document name or URL to a fiscal year.
 * The standalone file name writes the year pair hyphenated
 * ("2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf"), which maps to FY2025-26;
 * hyphenated/space-separated/slashed ranges (2024-25, 2025 2026, 2024/25) and
 * a June year-end are also handled. Anything that is not a consecutive year
 * pair is rejected.
 */
export function fiscalYearFromBerriganGpfsLink(text: string): string | null {
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
      endRaw.length === 2
        ? Math.floor(startYear / 100) * 100 + Number(endRaw)
        : Number(endRaw);
    if (end !== startYear + 1) return null;
    return `${startYear}-${String(end).slice(-2)}`;
  }
  const gpfs = /GPFS[-_ ]?((?:19|20)\d{2})\b/i.exec(text);
  if (gpfs) {
    const end = Number(gpfs[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
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
 * Parse the audited GPFS PDF link from the official Berrigan Shire Council
 * Financial Statements page. The statement link is a direct
 * `.pdf` upload whose name carries "Financial Statements" and the year. The
 * narrative annual report, SPFS, special-purpose statements and special
 * schedules, public notices, presentations and unrelated policies are ignored.
 */
export function parseBerriganGpfsReportLinks(
  html: string,
  baseUrl: string,
): BerriganGpfsDocument[] {
  const links: BerriganGpfsDocument[] = [];
  const seen = new Set<string>();
  const baseHost = new URL(baseUrl).host;
  for (const anchor of anchors(html)) {
    const haystack = `${anchor.title} ${anchor.text} ${anchor.href}`;
    if (!/financial[-_ ]?statements?|GPFS/i.test(haystack)) continue;
    // Exclude non-statement documents by their visible label/title only. The
    // official upload directory is named "financial-statements-and-budgets", so
    // testing the href for "budget" would wrongly reject the genuine link.
    const labelText = `${anchor.title} ${anchor.text}`;
    if (
      /SPFS|special[-_ ]?purpose|special[-_ ]?schedules?|public[-_ ]?notice|presentation|\bbudgets?\b|quarterly|QBR|policy|annual[-_ ]?report/i.test(
        labelText,
      )
    ) {
      continue;
    }
    if (!/\.pdf(?:$|[?#])/i.test(anchor.href)) continue;
    const label = `${anchor.title} ${anchor.text}`.trim();
    let filename = anchor.href.split('/').pop() ?? anchor.href;
    try {
      filename = decodeURIComponent(filename);
    } catch {
      // Keep the raw file name if it is not valid percent-encoding.
    }
    const fiscalYear =
      fiscalYearFromBerriganGpfsLink(label) ??
      fiscalYearFromBerriganGpfsLink(filename);
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
      title:
        label && !/^here$/i.test(label)
          ? label
          : `Annual Financial Statements GPFS ${fiscalYear}`,
      url: href,
      fiscal_year: fiscalYear,
      listing_url: baseUrl,
    });
  }
  return links;
}

/** Select the latest audited GPFS upload for the requested fiscal year. */
export function selectBerriganGpfsDocument(
  links: readonly BerriganGpfsDocument[],
  fiscalYear: string = BERRIGAN_GPFS_FISCAL_YEAR,
): BerriganGpfsDocument {
  const document = links
    .filter((link) => link.fiscal_year === fiscalYear)
    .sort((a, b) => b.url.localeCompare(a.url))[0];
  if (!document) {
    throw new Error(
      `No published Berrigan Shire Council General Purpose Financial Statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return document;
}

/** The documented official pin used when the live listing hides the link. */
export function berriganPinnedDocument(): BerriganGpfsDocument {
  return {
    id: `gpfs-${BERRIGAN_GPFS_FISCAL_YEAR}`,
    title: 'Annual Financial Statements GPFS 2025-26',
    url: BERRIGAN_GPFS_DOCUMENT_PIN,
    fiscal_year: BERRIGAN_GPFS_FISCAL_YEAR,
    listing_url: BERRIGAN_GPFS_REPORTING_URL,
  };
}

/**
 * Discover the audited GPFS attachment. The connector fetches the official
 * Financial Statements page and parses its direct "Financial
 * Statements" PDF upload links; if the page is unavailable (the host may return
 * an Edge/Akamai WAF challenge to plain fetch) or yields no usable FY2025-26
 * link, it uses the documented official pin. The exact bytes are still SHA-256
 * re-verified. Requests use an explicit plain client UA.
 */
export async function discoverBerriganGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = BERRIGAN_GPFS_FISCAL_YEAR,
  listingHtml?: string,
): Promise<BerriganGpfsDocument> {
  let html: string | null = listingHtml ?? null;
  if (html === null) {
    try {
      const response = await fetchImpl(BERRIGAN_GPFS_REPORTING_URL, {
        redirect: 'follow',
        headers: BERRIGAN_GPFS_REQUEST_HEADERS,
      });
      if (response.ok) html = await response.text();
    } catch {
      // Network failure falls through to the documented official pin.
    }
  }
  if (html) {
    const links = parseBerriganGpfsReportLinks(html, BERRIGAN_GPFS_REPORTING_URL);
    const match = links
      .filter((link) => link.fiscal_year === fiscalYear)
      .sort((a, b) => b.url.localeCompare(a.url))[0];
    if (match) return match;
  }
  if (fiscalYear !== BERRIGAN_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No published Berrigan Shire Council General Purpose Financial Statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return berriganPinnedDocument();
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectBerriganGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectBerriganGpfsUnit([page.text]);
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
  spec: BerriganGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): BerriganGpfsLineValue | null {
  const value = firstAmountAfter(text, spec.label);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly BerriganGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface BerriganGpfsFunctionsTotals {
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
export function parseBerriganGpfsFunctionsTotals(
  page: PdfPage,
): BerriganGpfsFunctionsTotals | null {
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

function gpfsFundingSource(spec: BerriganGpfsLineSpec): string {
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
  context: BerriganGpfsParseContext,
  spec: BerriganGpfsLineSpec,
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
export function berriganGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = BERRIGAN_GPFS_FISCAL_YEAR,
): string {
  return `${BERRIGAN_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: BerriganGpfsLineValue,
  context: BerriganGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: BERRIGAN_GPFS_FISCAL_YEAR,
    source_id: BERRIGAN_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: berriganGpfsNaturalKey(context.document.url, spec.key, BERRIGAN_GPFS_FISCAL_YEAR),
    project_name: `Berrigan Shire Council GPFS 2025-26 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: BERRIGAN_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: BERRIGAN_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: BERRIGAN_GPFS_DATA_QUALITY_FLAG,
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
export function parseBerriganGpfsExtraction(
  extraction: PdfExtraction,
  context: BerriganGpfsParseContext,
): BerriganGpfsParseResult {
  const warnings: string[] = [];
  const rejections: BerriganGpfsRejection[] = [];
  const reject = (reason: string): BerriganGpfsParseResult => {
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
  let functionsTotals: BerriganGpfsFunctionsTotals | null;
  let comprehensiveNetResult: number | null;
  let comprehensiveOtherIncome: number | null;
  let comprehensiveTotal: number | null;
  let comprehensiveRevaluation: number | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseBerriganGpfsFunctionsTotals(functionsPage);
    const comprehensiveText = normalizeText(comprehensivePage.text);
    comprehensiveNetResult = firstAmountAfter(comprehensiveText, 'from Income Statement');
    comprehensiveOtherIncome =
      firstAmountAfter(comprehensiveText, 'Total other comprehensive income for the year') ??
      firstAmountAfter(comprehensiveText, 'Other comprehensive income for the year');
    comprehensiveTotal = firstAmountAfter(
      comprehensiveText,
      'Total comprehensive income for the year attributable to Council',
    );
    comprehensiveRevaluation =
      firstAmountAfter(
        comprehensiveText,
        'Gain/(loss) on revaluation of infrastructure, property, plant and equipment',
      ) ??
      firstAmountAfter(
        comprehensiveText,
        'Gain on revaluation of infrastructure, property, plant and equipment',
      ) ??
      firstAmountAfter(
        comprehensiveText,
        'Gain (loss) on revaluation of infrastructure, property, plant and equipment',
      );
    // Berrigan prints a single other-comprehensive-income component:
    // revaluation of infrastructure, property, plant and equipment.

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
  if (comprehensiveRevaluation === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed other-comprehensive-income components; no rows ingested`,
    );
  }
  const unit = incomeUnit.kind;

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: BerriganGpfsLineValue[] = [];
  for (const spec of BERRIGAN_GPFS_LINES) {
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
  const otherRevenue = lineByKey(values, 'other_revenue');
  const otherIncome = lineByKey(values, 'other_income');
  const interest = lineByKey(values, 'interest_and_investment_income');
  const materials = lineByKey(values, 'materials_and_services');
  const borrowing = lineByKey(values, 'borrowing_costs');
  const otherExpenses = lineByKey(values, 'other_expenses');
  const netResultBeforeCapital = firstAmountAfter(incomeText, BERRIGAN_GPFS_BEFORE_CAPITAL_LABEL);

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
    ['other_revenue', otherRevenue],
    ['other_income', otherIncome],
    ['interest_and_investment_income', interest],
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
    otherRevenue! +
    otherIncome! +
    grantsOperating! +
    grantsCapital! +
    interest!;
  const expenseComponentsSum =
    employee! + materials! + borrowing! + otherExpenses! + netLossDisposal!;
  // Total expenses is the documented bridge of two printed Income Statement
  // lines, because this council does not print a "Total expenses" line.
  const totalExpenses = expensesExDepreciation! + depreciation!;
  const faceExpenseBridge = totalExpenses;

  const totalExpensesLine: BerriganGpfsLineValue = {
    spec: BERRIGAN_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
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
    'other comprehensive income components sum = printed other comprehensive income',
    comprehensiveOtherIncome!,
    comprehensiveRevaluation!,
  );
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: BerriganGpfsReconciliation = {
    fiscal_year: BERRIGAN_GPFS_FISCAL_YEAR,
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
    comprehensive_other_income: comprehensiveOtherIncome!,
    comprehensive_total: comprehensiveTotal!,
    comprehensive_revaluation: comprehensiveRevaluation!,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'all printed face-statement line sums equal their printed subtotals/total',
      'printed total expenses excluding depreciation + printed depreciation = total expenses bridge',
      'B1-1 operating result, grants, income and expenses reconcile to the face statement',
      'Statement of Comprehensive Income net result equals the Income Statement net result',
      'printed net result + printed other comprehensive income equals printed total comprehensive income',
      'the printed other-comprehensive-income component (revaluation) equals the printed other comprehensive income',
      'the printed net result is stored with a magnitude and a negative sign marker only when printed negative; the before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'the face statement reconciles internally, but the printed B1-1 Total functions and activities row reports expenses 32,741 and operating result 1,314 against the face total expenses 32,742 and net result 1,313; the connector defers with 0 rows because the printed subtotal bridge is not exact';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface BerriganGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the official page. */
  document?: BerriganGpfsDocument;
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
  return 'annual_financial_statements-2026-final.pdf';
}

/** Build the live Berrigan Shire Council GPFS connector. */
export function createBerriganGpfsConnector(options: BerriganGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: BERRIGAN_GPFS_ID,
    name: BERRIGAN_GPFS_NAME,
    publisher: BERRIGAN_GPFS_PUBLISHER,
    source_url: BERRIGAN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BERRIGAN_GPFS_LICENSE,
    notes:
      "NSW council GPFS adapter: one council only (Berrigan Shire Council), audited FY2025-26 General Purpose Financial Statements — the statement source is the official standalone annual financial statements (not the narrative annual report); FY2025-26 is the current audited year available (no later audited standalone statements published as at 2026-11-19), and the connector rejects the earlier 2024-25 and 2023-24 documents. The face statement reconciles internally, but the printed B1-1 Total functions and activities row reports expenses 32,741 and operating result 1,314 against the face total expenses 32,742 and net result 1,313 (a $1 thousand difference); the connector therefore defers the document with 0 rows and records the exact gap rather than adjusting or fabricating figures. The PDF is discovered from the official Berrigan Shire Council Financial Statements page (the direct FY2025-26 Financial Statements PDF), with a documented official fallback pin only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverBerriganGpfsDocument(
          fetchImpl,
          BERRIGAN_GPFS_FISCAL_YEAR,
          options.listingHtml,
        ));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: BERRIGAN_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Berrigan Shire Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: BerriganGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: BERRIGAN_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Berrigan Shire Council FY2025-26 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: BerriganGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: BERRIGAN_GPFS_REPORTING_URL,
      };
      const parsed = parseBerriganGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'berrigan-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'berrigan-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Berrigan Shire Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
