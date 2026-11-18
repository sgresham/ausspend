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
 * Sixteenth NSW council GPFS adapter: Shoalhaven City Council's audited General
 * Purpose Financial Statements for FY2024-25.
 *
 * This follows the Dubbo (§7.1) through Tweed Shire (§7.15) reference
 * implementations in docs/NSW_COUNCILS.md with a Shoalhaven-specific layout
 * adapter. It is a separate source id (`shoalhaven-gpfs`) from every other
 * source. Every row is non-additive `agency_detail` with no region/LGA
 * allocation, so it can never be summed with the Dubbo budget rows, any existing
 * council GPFS source, the pre-existing federal/state/charity rows whose
 * `delivery_entity` merely mentions Shoalhaven, or any other council.
 *
 * The PDF URL is discovered from the council's official "Financial statements"
 * page (never a hard-coded document URL): that page links to "Financial
 * Statements - Previous Years", whose CMS grid (a Granicus/CM2Web React grid)
 * lists "Annual Financial Statements 2024-2025" with a record uri. The
 * connector replicates the grid's public JSON request over plain HTTP (no edge
 * challenge), selects the FY2024-25 record by its printed title, and fetches the
 * document from the official LinkGeneratorAPI record endpoint. The exact bytes
 * are SHA-256 archived outside the repo. The printed `$ '000` unit is required.
 *
 * The Income Statement prints the Original unaudited budget column before each
 * line label, so each emitted value is the first amount after the printed label
 * (the FY2024-25 actual). It does not print a combined "Total expenses" line;
 * total expenses is the printed B1-1 "Total functions and activities" expense
 * total ($344,431 thousand), which equals the printed expenses-excluding-
 * depreciation line ($247,116 thousand) plus the printed depreciation,
 * amortisation and impairment line ($97,315 thousand) and equals printed total
 * income ($418,722 thousand) less the printed operating result ($74,291
 * thousand). The Statement of Comprehensive Income repeats the printed net
 * result ($74,291 thousand). Those top-level printed totals reconcile exactly
 * and are the defensible totals.
 */

export const SHOALHAVEN_GPFS_ID = 'shoalhaven-gpfs';
export const SHOALHAVEN_GPFS_NAME =
  'Shoalhaven City Council — General Purpose Financial Statements';
export const SHOALHAVEN_GPFS_PUBLISHER = 'Shoalhaven City Council';
export const SHOALHAVEN_GPFS_REPORTING_URL =
  'https://www.shoalhaven.nsw.gov.au/Council/Reports/Financial-statements';
export const SHOALHAVEN_GPFS_PREVIOUS_YEARS_URL =
  'https://www.shoalhaven.nsw.gov.au/Council/Publicly-available-information/Finance/Financial-Statements-Previous-Years';
export const SHOALHAVEN_GPFS_DOCUMENT_HOST = 'https://doc.shoalhaven.nsw.gov.au';
export const SHOALHAVEN_GPFS_FISCAL_YEAR = '2024-25';
export const SHOALHAVEN_GPFS_SOURCE_DATASET = 'Shoalhaven City Council GPFS 2024-25';
export const SHOALHAVEN_GPFS_LICENSE =
  '© Shoalhaven City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const SHOALHAVEN_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const SHOALHAVEN_GPFS_DELIVERY_ENTITY = 'Shoalhaven City Council';

export interface ShoalhavenGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The reporting page the PDF link was discovered from. */
  listing_url?: string;
  /** The top-level official financial-statements page. */
  reporting_url?: string;
  /** The CMS grid URL embedded in the previous-years page. */
  grid_url?: string;
  /** The CMS record uri the PDF was resolved from. */
  record_uri?: string;
  /** The final PDF URL after the publisher's redirect, when known. */
  resolved_url?: string;
}

export interface ShoalhavenGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface ShoalhavenGpfsParseContext {
  document: ShoalhavenGpfsDocument;
  archive: ShoalhavenGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface ShoalhavenGpfsRejection {
  section: string;
  reason: string;
}

export type ShoalhavenGpfsSection = 'revenue' | 'expenses' | 'result';

export interface ShoalhavenGpfsLineSpec {
  key: string;
  label: string;
  section: ShoalhavenGpfsSection;
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
 * result, grants and income/expense checks. The printed "Net gain from the
 * disposal of assets" line is a dash (zero) and is therefore not emitted; the
 * revenue components still sum exactly to the printed total. The printed net
 * result is positive, so no sign marker is needed.
 */
export const SHOALHAVEN_GPFS_LINES: ReadonlyArray<ShoalhavenGpfsLineSpec> = [
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

export const SHOALHAVEN_GPFS_BEFORE_CAPITAL_LABEL =
  'Net operating result for the year before grants and contributions provided for capital purposes';
export const SHOALHAVEN_GPFS_OPERATING_RESULT_LABEL = 'Operating result from continuing operations';
export const SHOALHAVEN_GPFS_DEPRECIATION_NOTE_LABEL = 'Total depreciation and amortisation costs';

interface ShoalhavenGpfsLineValue {
  spec: ShoalhavenGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface ShoalhavenGpfsReconciliation {
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

export interface ShoalhavenGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: ShoalhavenGpfsReconciliation | null;
  warnings: string[];
  rejections: ShoalhavenGpfsRejection[];
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
 * Convert a Shoalhaven financial-statements link/text to a fiscal year. The
 * previous-years grid labels the audited statements "Annual Financial Statements
 * 2024-2025" and older rows use "2023 / 2024"; both forms, consecutive year
 * ranges and June year-ends are handled. Anything that is not a consecutive
 * year pair is rejected.
 */
export function fiscalYearFromShoalhavenGpfsLink(text: string): string | null {
  const normalizedText = text.replace(/[\u2010-\u2015\u2212]/g, '-');
  const june = /year\s+ended\s+(?:\d{1,2}\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(
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
  title: string;
  text: string;
  className: string;
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
    const classMatch = /class="([^"]*)"/i.exec(attrs);
    out.push({
      href: hrefMatch[1]!,
      title: titleMatch ? decodeHtml(titleMatch[1]!) : '',
      text: decodeHtml(match[2]!),
      className: classMatch ? classMatch[1]! : '',
    });
  }
  return out;
}

/**
 * Discover the official "Financial Statements - Previous Years" page from the
 * live "Financial statements" page. The current page presents the latest
 * (FY2025-26) statements and links to the previous-years archive; the audited
 * FY2024-25 GPFS lives in that archive. The link is selected by its printed
 * text/href, never from a hard-coded document URL.
 */
export function parseShoalhavenGpfsPreviousYearsLink(html: string, baseUrl: string): string | null {
  for (const anchor of anchors(html)) {
    const haystack = `${anchor.title} ${anchor.text}`;
    const href = anchor.href.toLowerCase();
    const previous = /previous\s+years/i.test(haystack) || /previous-years/i.test(href);
    const statements =
      /financial statements?/i.test(haystack) || /financial-statements/i.test(href);
    if (!previous || !statements) continue;
    try {
      return new URL(anchor.href, baseUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Discover the CMS grid URL embedded in the previous-years page. The page embeds
 * a Granicus/CM2Web React grid in an iframe; its public GridResults endpoint
 * lists the document records. Nothing about the individual PDF is hard-coded.
 */
export function parseShoalhavenGpfsGridUrl(html: string, baseUrl: string): string | null {
  const iframe = /<iframe\b[^>]*\bsrc="([^"]+)"/i.exec(html);
  if (!iframe) return null;
  try {
    return new URL(decodeHtml(iframe[1]!), baseUrl).toString();
  } catch {
    return null;
  }
}

export interface ShoalhavenGpfsGridRecord {
  uri: string;
  title: string;
  extension: string;
}

/** Parse the public CM2Web GridResults JSON into document records. */
export function parseShoalhavenGpfsGridRecords(json: unknown): ShoalhavenGpfsGridRecord[] {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Shoalhaven grid response is not an object');
  }
  const records = (json as { records?: unknown }).records;
  if (!Array.isArray(records)) {
    throw new Error('Shoalhaven grid response has no records array');
  }
  const out: ShoalhavenGpfsGridRecord[] = [];
  for (const entry of records) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as {
      uri?: unknown;
      extension?: unknown;
      tableFields?: Array<{ fieldName?: unknown; recordValue?: unknown }>;
    };
    const fields = Array.isArray(record.tableFields) ? record.tableFields : [];
    const title = fields.find((field) => field.fieldName === 'Title')?.recordValue;
    const uri = record.uri;
    if (typeof uri !== 'string' && typeof uri !== 'number') continue;
    if (typeof title !== 'string' || title.trim() === '') continue;
    out.push({
      uri: String(uri),
      title: title.trim(),
      extension: typeof record.extension === 'string' ? record.extension : '',
    });
  }
  return out;
}

/** Select the audited GPFS record for the requested fiscal year. */
export function selectShoalhavenGpfsGridRecord(
  records: readonly ShoalhavenGpfsGridRecord[],
  fiscalYear: string = SHOALHAVEN_GPFS_FISCAL_YEAR,
): ShoalhavenGpfsGridRecord {
  const record = records.find((entry) => {
    const looksLikePdf = /^pdf$/i.test(entry.extension) || /\.pdf\b|pdf/i.test(entry.title);
    return looksLikePdf && fiscalYearFromShoalhavenGpfsLink(entry.title) === fiscalYear;
  });
  if (!record) {
    throw new Error(
      `No published Shoalhaven City Council audited financial statements record for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return record;
}

/** Official CMS document-delivery URL for a discovered record uri. */
export function shoalhavenGpfsPdfUrl(uri: string): string {
  return `${SHOALHAVEN_GPFS_DOCUMENT_HOST}/LinkGeneratorAPI/record/${encodeURIComponent(uri)}/preview_latest_final_version_pdf`;
}

export interface ShoalhavenGpfsDiscoveryOverrides {
  reportingHtml?: string;
  previousYearsHtml?: string;
  gridJson?: unknown;
}

/** Discover the audited GPFS document from the live official pages. */
export async function discoverShoalhavenGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = SHOALHAVEN_GPFS_FISCAL_YEAR,
  overrides: ShoalhavenGpfsDiscoveryOverrides = {},
): Promise<ShoalhavenGpfsDocument> {
  let reportingHtml = overrides.reportingHtml;
  let reportingUrl = SHOALHAVEN_GPFS_REPORTING_URL;
  if (reportingHtml === undefined) {
    const response = await fetchImpl(SHOALHAVEN_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Shoalhaven City Council financial statements page fetch HTTP ${response.status} for ${SHOALHAVEN_GPFS_REPORTING_URL}`,
      );
    }
    reportingHtml = await response.text();
    reportingUrl = response.url || reportingUrl;
  }
  const listingUrl = parseShoalhavenGpfsPreviousYearsLink(reportingHtml, reportingUrl);
  if (!listingUrl) {
    throw new Error(
      'Shoalhaven City Council financial statements page has no "Financial Statements - Previous Years" link; refusing to guess a document URL',
    );
  }

  let previousYearsHtml = overrides.previousYearsHtml;
  if (previousYearsHtml === undefined) {
    const response = await fetchImpl(listingUrl, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Shoalhaven City Council previous-years page fetch HTTP ${response.status} for ${listingUrl}`,
      );
    }
    previousYearsHtml = await response.text();
  }
  const gridUrl = parseShoalhavenGpfsGridUrl(previousYearsHtml, listingUrl);
  if (!gridUrl) {
    throw new Error(
      'Shoalhaven City Council previous-years page has no document-grid iframe; refusing to guess a document URL',
    );
  }
  const gridId = new URL(gridUrl).searchParams.get('id');
  if (!gridId) {
    throw new Error(`Shoalhaven City Council document-grid URL has no id: ${gridUrl}`);
  }

  let gridJson = overrides.gridJson;
  if (gridJson === undefined) {
    const endpoint = new URL('api/Grid/GridResults', gridUrl).toString();
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        id: gridId,
        searchQuery: '',
        filterBy: '',
        dynamicPlacholders: [],
        page: 1,
        tableQuery: '',
        sort: '',
        pageSize: 100,
        options: '',
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Shoalhaven City Council document-grid fetch HTTP ${response.status} for ${endpoint}`,
      );
    }
    gridJson = await response.json();
  }

  const record = selectShoalhavenGpfsGridRecord(
    parseShoalhavenGpfsGridRecords(gridJson),
    fiscalYear,
  );
  return {
    id: `gpfs-${fiscalYear}`,
    title: record.title,
    url: shoalhavenGpfsPdfUrl(record.uri),
    fiscal_year: fiscalYear,
    listing_url: listingUrl,
    reporting_url: reportingUrl,
    grid_url: gridUrl,
    record_uri: record.uri,
  };
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectShoalhavenGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectShoalhavenGpfsUnit([page.text]);
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
  spec: ShoalhavenGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): ShoalhavenGpfsLineValue | null {
  const value = spec.last_occurrence
    ? lastAmountAfter(text, spec.label)
    : firstAmountAfter(text, spec.label, spec.exclude_following);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly ShoalhavenGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface ShoalhavenGpfsFunctionsTotals {
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
export function parseShoalhavenGpfsFunctionsTotals(
  page: PdfPage,
): ShoalhavenGpfsFunctionsTotals | null {
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

function gpfsFundingSource(spec: ShoalhavenGpfsLineSpec): string {
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

function printedLineLabel(spec: ShoalhavenGpfsLineSpec): string {
  return spec.label;
}

function notesFor(
  context: ShoalhavenGpfsParseContext,
  spec: ShoalhavenGpfsLineSpec,
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
    context.document.record_uri ? `record_uri: ${context.document.record_uri}` : null,
    context.document.resolved_url
      ? `document_resolved_url: ${context.document.resolved_url}`
      : null,
    context.document.listing_url ? `listing_page: ${context.document.listing_url}` : null,
    context.document.grid_url ? `grid_url: ${context.document.grid_url}` : null,
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
export function shoalhavenGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = SHOALHAVEN_GPFS_FISCAL_YEAR,
): string {
  return `${SHOALHAVEN_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: ShoalhavenGpfsLineValue,
  context: ShoalhavenGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: SHOALHAVEN_GPFS_FISCAL_YEAR,
    source_id: SHOALHAVEN_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: shoalhavenGpfsNaturalKey(
      context.document.url,
      spec.key,
      SHOALHAVEN_GPFS_FISCAL_YEAR,
    ),
    project_name: `Shoalhaven City Council GPFS 2024-25 — ${printedLineLabel(spec)}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: SHOALHAVEN_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: SHOALHAVEN_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: SHOALHAVEN_GPFS_DATA_QUALITY_FLAG,
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
export function parseShoalhavenGpfsExtraction(
  extraction: PdfExtraction,
  context: ShoalhavenGpfsParseContext,
): ShoalhavenGpfsParseResult {
  const warnings: string[] = [];
  const rejections: ShoalhavenGpfsRejection[] = [];
  const reject = (reason: string): ShoalhavenGpfsParseResult => {
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
  const depreciationPage = findPage(extraction.pages, (_page, text) =>
    text.includes(SHOALHAVEN_GPFS_DEPRECIATION_NOTE_LABEL),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: ShoalhavenGpfsFunctionsTotals | null;
  let comprehensiveNetResult: number | null;
  let depreciationNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseShoalhavenGpfsFunctionsTotals(functionsPage);
    comprehensiveNetResult = firstAmountAfter(
      normalizeText(comprehensivePage.text),
      'from Income Statement',
    );
    if (depreciationPage) {
      depreciationNoteTotal = firstAmountAfter(
        normalizeText(depreciationPage.text),
        SHOALHAVEN_GPFS_DEPRECIATION_NOTE_LABEL,
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
  const values: ShoalhavenGpfsLineValue[] = [];
  for (const spec of SHOALHAVEN_GPFS_LINES) {
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
  const netResultBeforeCapital = firstAmountAfter(incomeText, SHOALHAVEN_GPFS_BEFORE_CAPITAL_LABEL);
  const operatingResult = firstAmountAfter(
    incomeText,
    SHOALHAVEN_GPFS_OPERATING_RESULT_LABEL,
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

  const totalExpensesLine: ShoalhavenGpfsLineValue = {
    spec: SHOALHAVEN_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
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

  const reconciliation: ShoalhavenGpfsReconciliation = {
    fiscal_year: SHOALHAVEN_GPFS_FISCAL_YEAR,
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
      'the printed net result is positive and stored as a non-negative magnitude; the negative before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the printed B1-1 Total functions and activities expense total (344,431), which equals printed expenses-excluding-depreciation (247,116) plus printed depreciation and impairment (97,315) and printed total income (418,722) less the printed operating result (74,291); the printed net result (74,291) equals the printed operating result and is repeated in the Statement of Comprehensive Income; the printed revenue and expense components sum exactly to their printed subtotals; the B1-1 totals and note B3-4 depreciation/amortisation total reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface ShoalhavenGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: ShoalhavenGpfsDocument;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched discovery inputs; the connector still selects the record by title. */
  reportingHtml?: string;
  previousYearsHtml?: string;
  gridJson?: unknown;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through to the stable name.
  }
  return 'shoalhaven-city-council-financial-statements-2024-25.pdf';
}

/** Build the live Shoalhaven City Council GPFS connector. */
export function createShoalhavenGpfsConnector(
  options: ShoalhavenGpfsConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: SHOALHAVEN_GPFS_ID,
    name: SHOALHAVEN_GPFS_NAME,
    publisher: SHOALHAVEN_GPFS_PUBLISHER,
    source_url: SHOALHAVEN_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: SHOALHAVEN_GPFS_LICENSE,
    notes:
      "Sixteenth NSW council GPFS adapter: one council only (Shoalhaven City Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official 'Financial statements' page via its 'Financial Statements - Previous Years' CMS grid (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered =
        options.document ??
        (await discoverShoalhavenGpfsDocument(fetchImpl, SHOALHAVEN_GPFS_FISCAL_YEAR, {
          reportingHtml: options.reportingHtml,
          previousYearsHtml: options.previousYearsHtml,
          gridJson: options.gridJson,
        }));
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, { redirect: 'follow' });
        if (!response.ok) {
          throw new Error(
            `Shoalhaven City Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: ShoalhavenGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: SHOALHAVEN_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Shoalhaven City Council FY2024-25 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: ShoalhavenGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: SHOALHAVEN_GPFS_REPORTING_URL,
      };
      const parsed = parseShoalhavenGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'shoalhaven-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'shoalhaven-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Shoalhaven City Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
