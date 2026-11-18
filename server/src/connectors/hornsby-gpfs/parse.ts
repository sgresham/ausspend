import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import {
  detectMoneyUnit,
  moneyToCents,
  parseAmountCell,
  type MoneyUnitKind,
  type PdfExtraction,
  type PdfPage,
  type PdfTextItem,
  type UnitDetection,
} from '../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import {
  gpfsFundingSource,
  gpfsUnitLabel,
  GPFS_AGGREGATION_ROLE,
  GPFS_NON_ADDITIVE_NOTE,
} from '../gpfs/engine.js';
import type { Connector, RawRecord } from '../types.js';
import {
  HORNSBY_GPFS_DATA_QUALITY_FLAG,
  HORNSBY_GPFS_DELIVERY_ENTITY,
  HORNSBY_GPFS_DEPRECIATION_NOTE_LABEL,
  HORNSBY_GPFS_FISCAL_YEAR,
  HORNSBY_GPFS_FUNCTIONS,
  HORNSBY_GPFS_ID,
  HORNSBY_GPFS_LINES,
  HORNSBY_GPFS_NAME,
  HORNSBY_GPFS_PAGE_MARKERS,
  HORNSBY_GPFS_PUBLISHER,
  HORNSBY_GPFS_REPORTING_URL,
  HORNSBY_GPFS_SOURCE_DATASET,
  HORNSBY_GPFS_TOTAL_ROW_LABEL,
  HORNSBY_GPFS_LICENSE,
  type HornsbyGpfsLineSpec,
} from './config.js';

/**
 * NSW council GPFS adapter: Hornsby Shire Council's audited General Purpose
 * Financial Statements for FY2025-26.
 *
 * This follows the §7.1–§7.39 reference implementations in
 * docs/NSW_COUNCILS.md. It is a separate source id (`hornsby-gpfs`) from every
 * other source. Every row is non-additive `agency_detail` with no region/LGA
 * allocation, so it is never summed with any other council, the Dubbo budget
 * rows, the pre-existing federal/state/charity rows whose `delivery_entity`
 * mentions Hornsby, or any state LGA-tagged row.
 *
 * The document is the council's own "Annual Financial Statements 2025/26" PDF,
 * linked from the official Financial Statements page. It prints the Income
 * Statement (PDF p6), Statement of Comprehensive Income (PDF p7), B1-1
 * "Functions or activities" note (PDF p15) and note B3-3 depreciation (PDF
 * p24), plus the independent auditor's report (PDF p59–p61, signed 24 September
 * 2026 by the Delegate of the Auditor-General for New South Wales). The printed
 * unit is an explicit `$'000` on every page used here.
 *
 * The income statement has no discontinued operation: total income $207,011
 * thousand, total expenses $165,975 thousand (the printed B1-1 total, equal to
 * the printed face bridge of expenses excluding depreciation $138,425 thousand
 * plus depreciation, amortisation and impairment $27,550 thousand), giving an
 * operating result of $41,036 thousand. The Statement of Comprehensive Income
 * repeats that net result and adds $10,874 thousand of other comprehensive
 * income for total comprehensive income of $51,910 thousand.
 */

export interface HornsbyGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  /** The official page the PDF was found on. */
  listing_url?: string;
  /** The final PDF URL after redirects, when known. */
  resolved_url?: string;
}

export interface HornsbyGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface HornsbyGpfsParseContext {
  document: HornsbyGpfsDocument;
  archive: HornsbyGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface HornsbyGpfsRejection {
  section: string;
  reason: string;
}

export interface HornsbyGpfsReconciliation {
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
  borrowing_costs: number;
  net_loss_from_disposal_of_assets: number;
  materials_and_services: number;
  other_expenses: number;
  operating_result_continuing: number;
  net_result: number;
  operating_result_excluding_depreciation: number;
  printed_total_expenses_excluding_depreciation: number;
  net_result_before_capital_grants: number;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  functions_expense_split_sum: number;
  comprehensive_income_net_result: number;
  comprehensive_income_other: number;
  comprehensive_income_total: number;
  depreciation_impairment_note_total: number | null;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  checks: string[];
}

export interface HornsbyGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: HornsbyGpfsReconciliation | null;
  warnings: string[];
  rejections: HornsbyGpfsRejection[];
}

// Note references include both dashed forms (B2-1, C1-5), which must not be
// mistaken for a printed amount.
const NOTE_REFERENCE = /\b[A-E]\d-\d\b/g;
const MONEY_TOKEN = /^\(?\d{1,3}(?:,\d{3})*(?:\.\d+)?\)?$/;
const DASH_TOKEN = /^[–—-]$/;
const SECTION_MARKER = /^§.*§$/;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(NOTE_REFERENCE, ' ').trim();
}

function normalizeLabel(text: string): string {
  return text
    .replace(NOTE_REFERENCE, ' ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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
 * Convert a Hornsby PDF filename or link text to a fiscal year. The published
 * links print "Annual Financial Statements 2025/26"; consecutive year ranges,
 * June year-ends and a bare June year-end filename are handled. Anything that
 * is not a consecutive year pair is rejected.
 */
export function fiscalYearFromHornsbyGpfsLink(text: string): string | null {
  const normalizedText = text.replace(/[\u2010-\u2015\u2212]/g, '-');
  let decodedText = normalizedText;
  try {
    decodedText = decodeURIComponent(normalizedText);
  } catch {
    // Keep the raw text when a stray percent sign is not valid percent-encoding.
  }
  const spaced = decodedText
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const june = /(?:30\s+)?(?:june|jun)\s+((?:19|20)\d{2})/i.exec(spaced);
  if (june) {
    const end = Number(june[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }

  const consecutive = /((?:19|20)\d{2})\s*[-/]\s*((?:19|20)?\d{2})/.exec(decodedText);
  if (consecutive) {
    const start = Number(consecutive[1]);
    const endRaw = consecutive[2]!;
    const end =
      endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
    if (end === start + 1) return `${start}-${String(end).slice(-2)}`;
  }

  const bare = /(?:^|\D)((?:19|20)\d{2})(?:\D|$)/.exec(spaced);
  if (bare) {
    const end = Number(bare[1]);
    if (end >= 2010 && end <= 2035) return `${end - 1}-${String(end).slice(-2)}`;
  }
  return null;
}

export interface HornsbyGpfsReportPage {
  pdfUrl: string;
  title: string;
}

/**
 * Hornsby's own site is the only host accepted for the financial statements
 * PDF. Any other host is rejected even if a link text matches.
 */
function isHornsbyDocumentHost(hostname: string): boolean {
  return /(^|\.)hornsby\.nsw\.gov\.au$/i.test(hostname);
}

/**
 * Discover the audited FY2025-26 financial-statements PDF from the council's
 * official Financial Statements page. The page carries a direct link to the
 * published PDF; the URL is parsed from that page, never guessed.
 */
export function parseHornsbyGpfsReportPage(
  html: string,
  baseUrl: string,
  fiscalYear: string = HORNSBY_GPFS_FISCAL_YEAR,
): HornsbyGpfsReportPage | null {
  const anchor = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const href = decodeHtml(match[1]!);
    const text = decodeHtml(match[2]!);
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (!isHornsbyDocumentHost(url.hostname)) continue;
    if (!/\.pdf$/i.test(url.pathname)) continue;
    const marker = /financial[-_ ]?statements/i.test(`${url.pathname} ${text}`);
    if (!marker) continue;
    const fromText = fiscalYearFromHornsbyGpfsLink(text);
    const fromPath = fiscalYearFromHornsbyGpfsLink(url.pathname);
    if (fromText !== fiscalYear && fromPath !== fiscalYear) continue;
    return {
      pdfUrl: url.toString(),
      title: `Hornsby Shire Council Annual Financial Statements ${fiscalYear} (General Purpose Financial Statements)`,
    };
  }
  return null;
}

export interface HornsbyGpfsDiscoveryOverrides {
  listingHtml?: string;
}

/** Discover the audited GPFS document from the official Financial Statements page HTML. */
export async function discoverHornsbyGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = HORNSBY_GPFS_FISCAL_YEAR,
  overrides: HornsbyGpfsDiscoveryOverrides = {},
): Promise<HornsbyGpfsDocument> {
  let listingHtml = overrides.listingHtml;
  let listingUrl = HORNSBY_GPFS_REPORTING_URL;
  if (listingHtml === undefined) {
    const response = await fetchImpl(HORNSBY_GPFS_REPORTING_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(
        `Hornsby Financial Statements page fetch HTTP ${response.status} for ${HORNSBY_GPFS_REPORTING_URL}`,
      );
    }
    listingHtml = await response.text();
    listingUrl = response.url || listingUrl;
  }
  const page = parseHornsbyGpfsReportPage(listingHtml, listingUrl, fiscalYear);
  if (!page) {
    throw new Error(
      `Hornsby FY${fiscalYear} Financial Statements page has no official audited statements PDF link for that year; refusing to guess a document URL`,
    );
  }
  return {
    id: `gpfs-${fiscalYear}`,
    title: page.title,
    url: page.pdfUrl,
    fiscal_year: fiscalYear,
    listing_url: listingUrl,
    resolved_url: page.pdfUrl,
  };
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectHornsbyGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectHornsbyGpfsUnit([page.text]);
  const kind = unit.kind;
  if (!kind || unit.ambiguous) {
    throw new Error(
      `${section} p${page.page_number}: no unambiguous printed currency unit (${unit.reason}); refusing to guess`,
    );
  }
  return { kind, reason: unit.reason };
}

interface PrintedRow {
  y: number;
  items: PdfTextItem[];
  labelText: string;
  /** FY2025-26 Actual column value (x in the requested column band), if printed. */
  actual: number | null;
  numbers: number[];
}

interface ColumnBand {
  min: number;
  max: number;
}

// Income Statement, Statement of Comprehensive Income and note B3-3 print the
// FY2025-26 actual column around x=432–466, the Original budget around
// x=69–101 and the FY2024-25 comparative around x=501–531.
const INCOME_STATEMENT_ACTUAL_BAND: ColumnBand = { min: 430, max: 475 };
// B1-1 prints each function's FY2025-26 expense column around x=340–369 and the
// FY2024-25 comparative around x=395–425.
const FUNCTIONS_EXPENSE_ACTUAL_BAND: ColumnBand = { min: 330, max: 385 };

function numberValue(token: string): number | null {
  const trimmed = token.trim();
  if (DASH_TOKEN.test(trimmed)) return 0;
  if (!MONEY_TOKEN.test(trimmed)) return null;
  const parsed = parseAmountCell(trimmed).value;
  if (parsed === null) return null;
  return parsed;
}

/**
 * Reconstruct printed rows from PDF text-item coordinates. A row's label and
 * its printed amounts share a y coordinate, so grouping by y and sorting by x
 * recovers the printed table. The FY2025-26 Actual column is isolated by an x
 * band (the original-budget column sits left of the note column, the
 * prior-year column right of it).
 */
export function buildHornsbyRows(
  page: PdfPage,
  band: ColumnBand = INCOME_STATEMENT_ACTUAL_BAND,
): PrintedRow[] {
  const items = page.items.filter((item) => item.str.trim().length > 0);
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: PdfTextItem[][] = [];
  for (const item of sorted) {
    const group = groups[groups.length - 1];
    if (group && Math.abs(group[0]!.y - item.y) <= 2.5) {
      group.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups.map((group) => {
    const groupItems = [...group].sort((a, b) => a.x - b.x);
    const numbers: number[] = [];
    const labelParts: string[] = [];
    let actual: number | null = null;
    for (const item of groupItems) {
      const value = numberValue(item.str);
      if (value !== null) {
        numbers.push(value);
        if (item.x >= band.min && item.x < band.max) actual = value;
      } else if (
        !SECTION_MARKER.test(item.str.trim()) &&
        !NOTE_REFERENCE.test(item.str.trim()) &&
        !DASH_TOKEN.test(item.str.trim())
      ) {
        labelParts.push(item.str);
      }
      // NOTE_REFERENCE is global; reset lastIndex after a test for safety.
      NOTE_REFERENCE.lastIndex = 0;
    }
    return {
      y: group[0]!.y,
      items: groupItems,
      labelText: labelParts.join(' ').replace(/\s+/g, ' ').trim(),
      actual,
      numbers,
    };
  });
}

interface FoundLine {
  row: PrintedRow;
  actual: number;
  numbers: number[];
}

/**
 * Find a printed line by its exact (possibly multi-line) label. The label is
 * compared against the current row and up to the two preceding rows, so a
 * wrapped label such as "Total expenses from continuing operations excluding /
 * depreciation, amortisation and impairment of non-financial / assets" matches
 * the row that prints its final line and amounts. Exact equality avoids
 * matching the prefix row "Operating result from continuing operations" against
 * the longer "...excluding depreciation" row.
 */
export function findHornsbyLine(
  rows: readonly PrintedRow[],
  label: string,
  lastOccurrence = false,
): FoundLine | null {
  const target = normalizeLabel(label);
  let match: FoundLine | null = null;
  for (let index = 0; index < rows.length; index += 1) {
    for (let span = 1; span <= 3; span += 1) {
      if (index - span + 1 < 0) break;
      const combined = rows
        .slice(index - span + 1, index + 1)
        .map((row) => row.labelText)
        .join(' ');
      if (normalizeLabel(combined) !== target) continue;
      const rowWithNumbers = rows[index]!.numbers.length
        ? rows[index]!
        : (rows[index + 1] ?? rows[index]!);
      if (rowWithNumbers.actual !== null) {
        match = {
          row: rowWithNumbers,
          actual: rowWithNumbers.actual,
          numbers: rowWithNumbers.numbers,
        };
        if (!lastOccurrence) return match;
        break;
      }
    }
  }
  return match;
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

function pageHasMarkers(page: PdfPage, markers: readonly string[]): boolean {
  const text = normalizeLabel(page.text);
  return markers.every((marker) => text.includes(marker));
}

interface HornsbyLineValue {
  spec: HornsbyGpfsLineSpec;
  value: number;
  page_number: number;
  statementLabel: string;
}

function readLine(
  rows: readonly PrintedRow[],
  spec: HornsbyGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): HornsbyLineValue | null {
  const found = findHornsbyLine(rows, spec.label, spec.last_occurrence ?? false);
  if (!found) {
    errors.push(`p${pageNumber}: could not read printed row for "${spec.label}"`);
    return null;
  }
  return { spec, value: found.actual, page_number: pageNumber, statementLabel: spec.label };
}

function lineByKey(values: readonly HornsbyLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

function formatThousands(value: number): string {
  return value.toLocaleString('en-AU');
}

function notesFor(
  context: HornsbyGpfsParseContext,
  spec: Pick<HornsbyGpfsLineSpec, 'label' | 'statement'>,
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
    'the audited General Purpose Financial Statements for the year ended 30 June 2026 are the official Hornsby Shire Council "Annual Financial Statements 2025/26" PDF linked from the council Financial Statements page; the independent auditor’s report is included in the same PDF (signed 24 September 2026 by the Delegate of the Auditor-General for New South Wales); provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + exact-document SHA-256 + line + fiscal year. */
export function hornsbyGpfsNaturalKey(
  documentIdentity: string,
  lineItem: string,
  fiscalYear: string = HORNSBY_GPFS_FISCAL_YEAR,
): string {
  return `${HORNSBY_GPFS_ID}:${createHash('sha256')
    .update(`${documentIdentity}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: HornsbyLineValue,
  context: HornsbyGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: HORNSBY_GPFS_FISCAL_YEAR,
    source_id: HORNSBY_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: hornsbyGpfsNaturalKey(context.archive.sha256, spec.key, HORNSBY_GPFS_FISCAL_YEAR),
    project_name: `Hornsby Shire Council GPFS 2025-26 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: HORNSBY_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec.section, Boolean(spec.potential_double_count), spec.key),
    source_dataset: HORNSBY_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: HORNSBY_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: GPFS_AGGREGATION_ROLE,
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

function mapFunctionExpense(
  row: { key: string; label: string },
  expenses: number,
  context: HornsbyGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  pageNumber: number,
  reconciliationNote: string,
): SpendingRecord {
  const key = `b1_1_function_expenses_${row.key}`;
  const label = `${row.label} — expenses`;
  return {
    amount_cents: moneyToCents(Math.abs(expenses), unit),
    measure_type: 'actual',
    fiscal_year: HORNSBY_GPFS_FISCAL_YEAR,
    source_id: HORNSBY_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: hornsbyGpfsNaturalKey(context.archive.sha256, key, HORNSBY_GPFS_FISCAL_YEAR),
    project_name: `Hornsby Shire Council GPFS 2025-26 — ${label}`,
    description: 'Expense line item — B1-1 Functions or activities',
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: HORNSBY_GPFS_DELIVERY_ENTITY,
    funding_source: 'Council expenditure',
    source_dataset: HORNSBY_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: HORNSBY_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: GPFS_AGGREGATION_ROLE,
    extraction_confidence: 'high',
    gpfs_line_item: key,
    gpfs_line_label: label,
    gpfs_unit: gpfsUnitLabel(unit),
    gpfs_section: 'expenses',
    gpfs_statement: 'B1-1 Functions or activities',
    gpfs_component_of: 'b1_1_total_expenses',
    notes: `${notesFor(
      context,
      { label, statement: 'B1-1 Functions or activities' },
      unit,
      unitReason,
      pageNumber,
      reconciliationNote,
    )}; this is a service/function cut of the same printed total expenses as the nature-of-expense rows; never added to the nature-of-expense cut; ${GPFS_NON_ADDITIVE_NOTE}`,
  };
}

/**
 * Parse the audited GPFS into validated, non-additive measure rows. Nothing is
 * emitted unless the printed unit is explicit and every face-statement, B1-1,
 * comprehensive-income and depreciation-note reconciliation check passes
 * exactly.
 */
export function parseHornsbyGpfsExtraction(
  extraction: PdfExtraction,
  context: HornsbyGpfsParseContext,
): HornsbyGpfsParseResult {
  const warnings: string[] = [];
  const rejections: HornsbyGpfsRejection[] = [];
  const reject = (reason: string): HornsbyGpfsParseResult => {
    rejections.push({ section: 'gpfs', reason });
    warnings.push(reason);
    return { records: [], reconciliation: null, warnings, rejections };
  };

  const incomePage = findPage(extraction.pages, (page) =>
    pageHasMarkers(page, HORNSBY_GPFS_PAGE_MARKERS.income_statement),
  );
  if (!incomePage) {
    return reject('audited income statement page not found; no rows ingested');
  }
  const functionsPage = findPage(extraction.pages, (page) =>
    pageHasMarkers(page, HORNSBY_GPFS_PAGE_MARKERS.functions),
  );
  if (!functionsPage) {
    return reject('B1-1 Functions or activities note not found; no rows ingested');
  }
  const comprehensivePage = findPage(extraction.pages, (page) =>
    pageHasMarkers(page, HORNSBY_GPFS_PAGE_MARKERS.comprehensive_income),
  );
  if (!comprehensivePage) {
    return reject(
      'Statement of Comprehensive Income page not found; no independent printed net-result check',
    );
  }
  const depreciationPage = findPage(extraction.pages, (page) =>
    pageHasMarkers(page, HORNSBY_GPFS_PAGE_MARKERS.depreciation_note),
  );

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let comprehensiveUnit: PrintedUnit;
  let functionsTotalRow: FoundLine | null;
  let comprehensiveNetResult: number | null;
  let comprehensiveOther: number | null;
  let comprehensiveTotal: number | null;
  let depreciationImpairmentNoteTotal: number | null = null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    comprehensiveUnit = requirePrintedUnit(comprehensivePage, 'Statement of Comprehensive Income');
    functionsTotalRow = findHornsbyLine(
      buildHornsbyRows(functionsPage, FUNCTIONS_EXPENSE_ACTUAL_BAND),
      HORNSBY_GPFS_TOTAL_ROW_LABEL,
    );
    const comprehensiveRows = buildHornsbyRows(comprehensivePage);
    comprehensiveNetResult =
      findHornsbyLine(
        comprehensiveRows,
        'Net operating result for the year – from Income Statement',
      )?.actual ?? null;
    comprehensiveOther =
      findHornsbyLine(comprehensiveRows, 'Total other comprehensive income for the year')?.actual ??
      null;
    comprehensiveTotal =
      findHornsbyLine(
        comprehensiveRows,
        'Total comprehensive income for the year attributable to Council',
      )?.actual ?? null;
    if (depreciationPage) {
      const depreciationRows = buildHornsbyRows(depreciationPage);
      depreciationImpairmentNoteTotal =
        findHornsbyLine(depreciationRows, HORNSBY_GPFS_DEPRECIATION_NOTE_LABEL)?.actual ?? null;
    }
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error));
  }
  if (incomeUnit.kind !== functionsUnit.kind || incomeUnit.kind !== comprehensiveUnit.kind) {
    return reject(
      `printed units disagree: income statement ${incomeUnit.kind}, B1-1 ${functionsUnit.kind}, comprehensive income ${comprehensiveUnit.kind}; refusing to mix`,
    );
  }
  if (!functionsTotalRow) {
    return reject(
      `p${functionsPage.page_number}: could not read the printed B1-1 total row; no rows ingested`,
    );
  }
  if (comprehensiveNetResult === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed comprehensive-income net result; no rows ingested`,
    );
  }
  if (comprehensiveOther === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed other comprehensive income; no rows ingested`,
    );
  }
  if (comprehensiveTotal === null) {
    return reject(
      `p${comprehensivePage.page_number}: could not read the printed total comprehensive income; no rows ingested`,
    );
  }
  const unit = incomeUnit.kind;

  const incomeRows = buildHornsbyRows(incomePage);
  const errors: string[] = [];
  const values: HornsbyLineValue[] = [];
  for (const spec of HORNSBY_GPFS_LINES) {
    if (spec.key === 'total_expenses' || spec.key === 'net_result') continue;
    const line = readLine(incomeRows, spec, incomePage.page_number, errors);
    if (line) values.push(line);
  }
  if (errors.length > 0) return reject(errors.join('; '));

  const netResultSpec = HORNSBY_GPFS_LINES.find((spec) => spec.key === 'net_result')!;
  values.push({
    spec: netResultSpec,
    value: comprehensiveNetResult,
    page_number: comprehensivePage.page_number,
    statementLabel: 'Net operating result for the year – from Income Statement',
  });

  const totalRevenue = lineByKey(values, 'total_revenue');
  const employee = lineByKey(values, 'employee_expenses');
  const depreciation = lineByKey(values, 'depreciation_amortisation_impairment');
  const grantsOperating = lineByKey(values, 'government_grants_operating');
  const grantsCapital = lineByKey(values, 'government_grants_capital');
  const borrowingCosts = lineByKey(values, 'borrowing_costs');
  const netLossDisposal = lineByKey(values, 'net_loss_from_disposal_of_assets');
  const netResult = lineByKey(values, 'net_result');
  const expensesExDepreciation = lineByKey(values, 'total_expenses_excluding_depreciation');
  const rates = lineByKey(values, 'rates_and_annual_charges');
  const userCharges = lineByKey(values, 'user_charges_and_fees');
  const otherRevenues = lineByKey(values, 'other_revenues');
  const interest = lineByKey(values, 'interest_and_investment_income');
  const otherIncome = lineByKey(values, 'other_income');
  const materials = lineByKey(values, 'materials_and_services');
  const otherExpenses = lineByKey(values, 'other_expenses');
  const operatingResultContinuing =
    findHornsbyLine(incomeRows, 'Operating result from continuing operations')?.actual ?? null;
  const operatingResultExcludingDepreciation =
    findHornsbyLine(
      incomeRows,
      'Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets',
    )?.actual ?? null;
  const netResultAttributable =
    findHornsbyLine(incomeRows, 'Net operating result for the year attributable to Council')
      ?.actual ?? null;
  const netResultBeforeCapitalGrants =
    findHornsbyLine(
      incomeRows,
      'Net operating result for the year before grants and contributions provided for capital purposes',
    )?.actual ?? null;

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
    ['borrowing_costs', borrowingCosts],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['net_result', netResult],
    ['operating_result_continuing', operatingResultContinuing],
    ['operating_result_excluding_depreciation', operatingResultExcludingDepreciation],
    ['total_expenses_excluding_depreciation', expensesExDepreciation],
    ['net_result_attributable', netResultAttributable],
    ['net_result_before_capital_grants', netResultBeforeCapitalGrants],
    ['rates_and_annual_charges', rates],
    ['user_charges_and_fees', userCharges],
    ['other_revenues', otherRevenues],
    ['interest_and_investment_income', interest],
    ['other_income', otherIncome],
    ['materials_and_services', materials],
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
    employee! + materials! + borrowingCosts! + otherExpenses! + netLossDisposal!;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalRowNumbers = functionsTotalRow.numbers;
  if (totalRowNumbers.length < 8) {
    return reject(
      `p${functionsPage.page_number}: B1-1 total row has ${totalRowNumbers.length} printed numeric columns, expected at least 8; no rows ingested`,
    );
  }
  const functionsTotalIncome = totalRowNumbers[0]!;
  const functionsTotalExpenses = totalRowNumbers[2]!;
  const functionsOperatingResult = totalRowNumbers[4]!;
  const functionsGrants = totalRowNumbers[6]!;
  const totalExpenses = functionsTotalExpenses;

  const functionsRows = buildHornsbyRows(functionsPage, FUNCTIONS_EXPENSE_ACTUAL_BAND);
  const functionValues: Array<{ key: string; label: string; expenses: number }> = [];
  for (const fn of HORNSBY_GPFS_FUNCTIONS) {
    const found = findHornsbyLine(functionsRows, fn.label);
    if (!found) {
      return reject(
        `p${functionsPage.page_number}: could not read printed B1-1 function row "${fn.label}"; no rows ingested`,
      );
    }
    functionValues.push({ key: fn.key, label: fn.label, expenses: found.numbers[2] ?? 0 });
  }
  const functionsExpenseSplitSum = functionValues.reduce((sum, row) => sum + row.expenses, 0);

  const totalExpensesLine: HornsbyLineValue = {
    spec: HORNSBY_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
    value: totalExpenses,
    page_number: functionsPage.page_number,
    statementLabel: HORNSBY_GPFS_TOTAL_ROW_LABEL,
  };
  values.push(totalExpensesLine);

  const checks: string[] = [];
  const check = (label: string, expected: number, actual: number): void => {
    if (expected !== actual) {
      checks.push(`${label}: printed/derived ${actual} != expected ${expected}`);
    }
  };
  check(
    'income statement revenue components = printed total income from continuing operations',
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
    'printed total income - printed total expenses excluding depreciation = printed operating result excluding depreciation',
    operatingResultExcludingDepreciation!,
    totalRevenue! - expensesExDepreciation!,
  );
  check(
    'printed total income - printed B1-1 total expenses = printed continuing operating result',
    operatingResultContinuing!,
    totalRevenue! - totalExpenses,
  );
  check(
    'printed continuing operating result = printed net operating result repeated in comprehensive income',
    netResult!,
    operatingResultContinuing!,
  );
  check(
    'printed net operating result attributable to Council = printed comprehensive-income net result',
    netResult!,
    netResultAttributable!,
  );
  check(
    'printed net operating result before capital grants = net result - printed capital grants',
    netResultBeforeCapitalGrants!,
    netResult! - grantsCapital!,
  );
  check(
    'B1-1 grants and contributions = operating grants + capital grants',
    grantsOperating! + grantsCapital!,
    functionsGrants,
  );
  check('B1-1 income = face total income', totalRevenue!, functionsTotalIncome);
  check('B1-1 expenses = face expense bridge', totalExpenses, faceExpenseBridge);
  check(
    'B1-1 operating result = face continuing operating result',
    operatingResultContinuing!,
    functionsOperatingResult,
  );
  check(
    'B1-1 income - B1-1 expenses = B1-1 operating result',
    functionsOperatingResult,
    functionsTotalIncome - functionsTotalExpenses,
  );
  check(
    'B1-1 printed function expense split = printed B1-1 total expenses',
    totalExpenses,
    functionsExpenseSplitSum,
  );
  check(
    'Statement of Comprehensive Income net result = income statement continuing operating result',
    netResult!,
    comprehensiveNetResult!,
  );
  check(
    'Statement of Comprehensive Income total = net result + other comprehensive income',
    comprehensiveTotal!,
    netResult! + comprehensiveOther!,
  );
  if (depreciationImpairmentNoteTotal !== null) {
    check(
      'note B3-3 total depreciation and amortisation = face depreciation/amortisation/impairment line',
      depreciation!,
      depreciationImpairmentNoteTotal,
    );
  } else {
    checks.push('note B3-3 total depreciation and amortisation was not read');
  }
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: HornsbyGpfsReconciliation = {
    fiscal_year: HORNSBY_GPFS_FISCAL_YEAR,
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
    borrowing_costs: borrowingCosts!,
    net_loss_from_disposal_of_assets: netLossDisposal!,
    materials_and_services: materials!,
    other_expenses: otherExpenses!,
    operating_result_continuing: operatingResultContinuing!,
    net_result: netResult!,
    operating_result_excluding_depreciation: operatingResultExcludingDepreciation!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation!,
    net_result_before_capital_grants: netResultBeforeCapitalGrants!,
    functions_total_income: functionsTotalIncome,
    functions_total_expenses: functionsTotalExpenses,
    functions_operating_result: functionsOperatingResult,
    functions_grants_and_contributions: functionsGrants,
    functions_expense_split_sum: functionsExpenseSplitSum,
    comprehensive_income_net_result: comprehensiveNetResult!,
    comprehensive_income_other: comprehensiveOther!,
    comprehensive_income_total: comprehensiveTotal!,
    depreciation_impairment_note_total: depreciationImpairmentNoteTotal,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    checks: [
      'printed revenue components sum exactly to the printed total income from continuing operations',
      'printed expense-by-nature components sum exactly to the printed expenses-excluding-depreciation line',
      'printed expenses excluding depreciation + printed depreciation/amortisation/impairment equals the printed B1-1 total expenses',
      'printed total income - printed expenses excluding depreciation equals the printed operating result excluding depreciation',
      'printed total income - printed B1-1 total expenses equals the printed continuing operating result',
      'printed continuing operating result equals the printed net operating result repeated in the Statement of Comprehensive Income (no discontinued operation)',
      'printed net operating result before capital grants equals net result minus printed capital grants',
      'B1-1 income, expenses, operating result and grants reconcile exactly to the face statement',
      'B1-1 income - B1-1 expenses equals the printed B1-1 operating result',
      'the printed B1-1 function expense split sums exactly to the printed B1-1 total expenses',
      'Statement of Comprehensive Income net result equals the Income Statement continuing operating result',
      'Statement of Comprehensive Income total equals net result plus other comprehensive income',
      'note B3-3 total depreciation and amortisation equals the face depreciation/amortisation/impairment line',
      'total expenses is the printed B1-1 Total functions and activities figure, never derived by summing components',
    ],
  };

  const reconciliationNote = `total revenue and total expenses are the printed totals: total income (${formatThousands(totalRevenue!)} thousand) and the printed B1-1 Total functions and activities expense total (${formatThousands(totalExpenses)} thousand), which equals the printed face-statement bridge of expenses-excluding-depreciation (${formatThousands(expensesExDepreciation!)} thousand) plus printed depreciation/amortisation/impairment (${formatThousands(depreciation!)} thousand), and equals printed total income less the printed continuing operating result (${formatThousands(operatingResultContinuing!)} thousand); the Statement of Comprehensive Income repeats that net result (${formatThousands(netResult!)} thousand) because there is no discontinued operation and adds other comprehensive income of ${formatThousands(comprehensiveOther!)} thousand for a total comprehensive income of ${formatThousands(comprehensiveTotal!)} thousand; note B3-3 prints total depreciation and amortisation (${depreciationImpairmentNoteTotal === null ? 'not read' : formatThousands(depreciationImpairmentNoteTotal)} thousand), equal to the face line; the printed B1-1 function expense split sums to the same printed total expenses (${formatThousands(functionsExpenseSplitSum)} thousand) as a separate service cut`;

  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  for (const row of functionValues) {
    if (row.expenses === 0) continue;
    records.push(
      mapFunctionExpense(
        row,
        row.expenses,
        context,
        unit,
        incomeUnit.reason,
        functionsPage.page_number,
        reconciliationNote,
      ),
    );
  }
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses}, net result ${netResult} ($'000) to the printed face-statement/B1-1 totals; ${functionValues.length} function expense rows sum to the same printed total`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface HornsbyGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the document page. */
  document?: HornsbyGpfsDocument;
  /** Pre-fetched PDF bytes; tests pass the archived bytes to avoid the network. */
  pdfBytes?: Uint8Array;
  /** Pre-fetched discovery input; the connector still selects the official link. */
  listingHtml?: string;
}

function documentFilename(): string {
  return 'hornsby-shire-council-annual-financial-statements-2025-26.pdf';
}

/** Build the live Hornsby Shire Council GPFS connector. */
export function createHornsbyGpfsConnector(options: HornsbyGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: HORNSBY_GPFS_ID,
    name: HORNSBY_GPFS_NAME,
    publisher: HORNSBY_GPFS_PUBLISHER,
    source_url: HORNSBY_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: HORNSBY_GPFS_LICENSE,
    notes:
      "NSW council GPFS adapter: one council only (Hornsby Shire Council), audited FY2025-26 General Purpose Financial Statements published as the official 'Annual Financial Statements 2025/26' PDF linked from the council Financial Statements page. The connector discovers the PDF from the page's own link (no hard-coded document URL when a listing is supplied), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-3 reconcile exactly. The income statement has no discontinued operation: total revenue $207,011k, total expenses $165,975k (printed B1-1 total = expenses excluding depreciation $138,425k + depreciation/amortisation/impairment $27,550k) and net result $41,036k. The printed B1-1 function expense split is emitted as a separate service cut of the same total, never added to the nature-of-expense cut. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      let discovered = options.document;
      if (!discovered) {
        if (!options.listingHtml) {
          throw new Error(
            'Hornsby Council GPFS requires the official Financial Statements page HTML (the council site returns HTTP 403 to plain HTTP clients); supply the browser-cleared listingHtml',
          );
        }
        discovered = await discoverHornsbyGpfsDocument(fetchImpl, HORNSBY_GPFS_FISCAL_YEAR, {
          listingHtml: options.listingHtml,
        });
      }
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(encodeURI(discovered.url), { redirect: 'follow' });
        if (!response.ok) {
          throw new Error(
            `Hornsby Council GPFS fetch HTTP ${response.status} for ${discovered.url}`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: HornsbyGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: HORNSBY_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Hornsby Shire Council Annual Financial Statements 2025/26 containing the audited FY2025-26 General Purpose Financial Statements and the independent auditor’s report; linked from the official council Financial Statements page and archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const { extractArchivedPdf } = await import('../pdf-extract.js');
      const extraction = await extractArchivedPdf(archived);
      const context: HornsbyGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: HORNSBY_GPFS_REPORTING_URL,
      };
      const parsed = parseHornsbyGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      metadata.lastFetchedAt = archived.fetched_at;
      metadata.recordsIngested = parsed.records.length;
      return parsed.records.map((record) => ({
        kind: 'hornsby-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'hornsby-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Hornsby Shire Council GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
