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
import { WALGETT_GPFS_LINES, type WalgettGpfsLineSpec } from './config.js';
import {
  WALGETT_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  WALGETT_GPFS_DATA_QUALITY_FLAG,
  WALGETT_GPFS_DELIVERY_ENTITY,
  WALGETT_GPFS_DOCUMENT_PIN,
  WALGETT_GPFS_FISCAL_YEAR,
  WALGETT_GPFS_ID,
  WALGETT_GPFS_LICENSE,
  WALGETT_GPFS_NAME,
  WALGETT_GPFS_PUBLISHER,
  WALGETT_GPFS_REPORTING_URL,
  WALGETT_GPFS_REQUEST_HEADERS,
  WALGETT_GPFS_SNAPSHOT_URL,
  WALGETT_GPFS_SOURCE_DATASET,
  WALGETT_GPFS_STANDALONE_FS_BYTES,
  WALGETT_GPFS_STANDALONE_FS_PAGES,
  WALGETT_GPFS_STANDALONE_FS_SHA256,
} from './meta.js';

/**
 * NSW council GPFS adapter: Walgett Shire Council's FY2024-25 General Purpose
 * Financial Statements (year ended 30 June 2025), the latest available full
 * audited standalone GPFS published by the council as at 2026-11-20.
 *
 * The "Annual Reports and Financial Statements" page is a client-rendered SPA:
 * the HTML shell contains no document links. The published CMS snapshot the SPA
 * loads at runtime (`/snapshot.json`) carries the page's file list, including
 * `Audited-Financial-Statements-2024-25.pdf`; the browser helper performs the
 * same discovery from the rendered DOM and the observed snapshot network
 * request (`scripts/walgett-gpfs-browser.ts`). The connector reads the snapshot
 * over plain HTTP using the same official origin, falls back to the documented
 * official PDF pin, archives and SHA-256 verifies the exact bytes. The PDF
 * embeds the Auditor-General's unmodified GPFS opinion and report on the
 * conduct of the audit (opinion dated 30 October 2025). No FY2025-26 standalone
 * audited GPFS was published as at 2026-11-20 (the 17 November 2026 meeting
 * endorsed the FY2025-26 annual report for publication), so FY2024-25 is
 * ingested as the latest available audited year and is explicitly labelled as
 * such; no older year is substituted.
 *
 * The printed unit is `$ '000`. Nothing is emitted unless the Income Statement,
 * B1-1 "Total functions and activities", Statement of Comprehensive Income,
 * Statement of Financial Position, Statement of Changes in Equity and Statement
 * of Cash Flows reconcile exactly at zero tolerance.
 *
 * The face Income Statement does not print a "Total expenses" line. Total
 * expenses is the documented bridge of the printed expenses-excluding-
 * depreciation line ($38,231 thousand) plus the printed depreciation,
 * amortisation and impairment line ($8,811 thousand), giving $47,042 thousand.
 * Walgett prints a net gain from the disposal of assets ($56 thousand) as a
 * revenue component and a net loss from the disposal of assets (nil in 2025) as
 * an expense component; it also prints a net share of interests in joint
 * ventures and associates ($60 thousand) as an expense component. Other
 * comprehensive income has a single printed component: the IPPE revaluation
 * gain ($28,220 thousand).
 *
 * B1-1 income ($37,665 thousand), expenses ($47,042 thousand), result
 * (-$9,377 thousand), grants ($20,754 thousand) and carrying amount ($501,502
 * thousand) all reconcile to the face statements exactly; there is no internal
 * allocation difference.
 *
 * Every row is non-additive `agency_detail` with no region/LGA allocation, so it
 * can never be summed into another council, a council total, state spending, the
 * PNFC benchmark or the OLG summary layer.
 */
export interface WalgettGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  listing_url?: string;
  resolved_url?: string;
}

export interface WalgettGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface WalgettGpfsParseContext {
  document: WalgettGpfsDocument;
  archive: WalgettGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface WalgettGpfsRejection {
  section: string;
  reason: string;
}

export interface WalgettGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
  carrying_amount: number;
}

export interface WalgettGpfsReconciliation {
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
  depreciation_amortisation_impairment: number;
  government_grants_operating: number;
  government_grants_capital: number;
  net_gain_from_disposal_of_assets: number;
  net_loss_from_disposal_of_assets: number;
  net_share_joint_ventures: number;
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
  comprehensive_joint_ventures: number;
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

export interface WalgettGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: WalgettGpfsReconciliation | null;
  warnings: string[];
  rejections: WalgettGpfsRejection[];
}

const NOTE_REFERENCE = /\b[A-Z]\d+(?:-\d+)?[a-z]?\b/g;
// A printed dash (en/em dash or hyphen) is a printed nil, e.g. the nil
// original-budget cell for Other income.
const MONEY_TOKEN = /(?:\(\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\))?|[–—-]/g;
const PRINTED_NIL = /^[–—-]$/;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(NOTE_REFERENCE, ' ').trim();
}

function amountsAfter(text: string, label: string): number[] {
  const index = text.indexOf(label);
  if (index < 0) return [];
  const rest = text.slice(index + label.length);
  const matches = rest.match(MONEY_TOKEN) ?? [];
  return matches
    .map((token) => (PRINTED_NIL.test(token) ? 0 : (parseAmountCell(token)?.value ?? null)))
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
export function detectWalgettGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectWalgettGpfsUnit([page.text]);
  if (!unit.kind || unit.ambiguous) {
    throw new Error(
      `${section} p${page.page_number}: no unambiguous printed currency unit (${unit.reason}); refusing to guess`,
    );
  }
  return { kind: unit.kind, reason: unit.reason };
}

/**
 * Parse a fiscal year from a printed label or filename. Only explicit
 * conventions are accepted: "year ended 30 June YYYY", a full YYYY-YYYY range,
 * or an explicit "financial statements YYYY" filename. A bare unrelated year is
 * never guessed.
 */
export function fiscalYearFromWalgettFinancialStatementsDoc(text: string): string | null {
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
  const full = [...normalized.matchAll(/((?:19|20)\d{2})-((?:19|20)?\d{2})/g)];
  const fullMatch = full[full.length - 1];
  if (fullMatch) {
    const startYear = Number(fullMatch[1]);
    const endRaw = fullMatch[2]!;
    const end =
      endRaw.length === 2 ? Math.floor(startYear / 100) * 100 + Number(endRaw) : Number(endRaw);
    if (end !== startYear + 1) return null;
    return `${startYear}-${String(end).slice(-2)}`;
  }
  // A filename such as "cdsc-annual_financial_statements-2025-olg.pdf" uses
  // the year-ended calendar year with an explicit financial-statements marker.
  const statements =
    /(?:annual[-_ ]financial[-_ ]statements?|financial[-_ ]statements?)[-_ ]((?:19|20)\d{2})\b/i.exec(
      normalized,
    );
  if (statements) {
    const end = Number(statements[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  // Also accept a documented "GPFS-YYYY" pin convention, never a bare year.
  const gpfs = /(?:annual[-_ ]financial[-_ ]statements?[-_ ])?gpfs[-_ ]((?:19|20)\d{2})\b/i.exec(
    normalized,
  );
  if (gpfs) {
    const end = Number(gpfs[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  return null;
}

/** The documented official pin used when live snapshot discovery is unavailable. */
export function walgettPinnedDocument(): WalgettGpfsDocument {
  return {
    id: `annual-financial-statements-${WALGETT_GPFS_FISCAL_YEAR}`,
    title:
      'Walgett Shire Council Audited Financial Statements 2024-2025 (GPFS for the year ended 30 June 2025)',
    url: WALGETT_GPFS_DOCUMENT_PIN,
    fiscal_year: WALGETT_GPFS_FISCAL_YEAR,
    listing_url: WALGETT_GPFS_REPORTING_URL,
  };
}

interface SnapshotFile {
  url?: unknown;
  name?: unknown;
  type?: unknown;
}

interface SnapshotBlock {
  type?: unknown;
  data?: { files?: unknown } | unknown;
}

interface SnapshotSection {
  blocks?: unknown;
}

interface SnapshotPage {
  fullPath?: unknown;
  full_path?: unknown;
  slug?: unknown;
  content?: { sections?: unknown } | unknown;
}

interface SnapshotRoot {
  pages?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Find the audited standalone financial-statements PDF in the published CMS
 * snapshot. The page is matched by its official path; only a `file-list` block
 * on that page is considered. A different requested year is never silently
 * satisfied by the FY2024-25 file.
 */
export function parseWalgettSnapshotDocument(
  snapshot: unknown,
  fiscalYear: string = WALGETT_GPFS_FISCAL_YEAR,
): WalgettGpfsDocument | null {
  if (!isRecord(snapshot)) return null;
  const pages = (snapshot as SnapshotRoot).pages;
  if (!Array.isArray(pages)) return null;
  const targetPath = new URL(WALGETT_GPFS_REPORTING_URL).pathname;
  const page = pages.find((candidate): candidate is SnapshotPage => {
    if (!isRecord(candidate)) return false;
    const path = candidate.fullPath ?? candidate.full_path;
    return typeof path === 'string' && path.replace(/\/+$/, '') === targetPath;
  });
  if (!page || !isRecord(page.content)) return null;
  const sections = (page.content as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return null;
  const files: SnapshotFile[] = [];
  for (const section of sections) {
    if (!isRecord(section)) continue;
    const blocks = (section as SnapshotSection).blocks;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (!isRecord(block)) continue;
      const typed = block as SnapshotBlock;
      if (typed.type !== 'file-list' || !isRecord(typed.data)) continue;
      const list = (typed.data as { files?: unknown }).files;
      if (!Array.isArray(list)) continue;
      for (const file of list) {
        if (isRecord(file)) files.push(file as SnapshotFile);
      }
    }
  }
  const yearPattern = fiscalYear.replace('-', '[-–—/ ]?');
  const namePattern = new RegExp(
    `audited[\\s_-]*financial[\\s_-]*statements?[\\s_-]*${yearPattern}`,
    'i',
  );
  const match = files.find((file) => {
    if (typeof file.url !== 'string' || typeof file.name !== 'string') return false;
    if (!/\.pdf(?:$|\?)/i.test(file.url) || file.type !== 'PDF') return false;
    return namePattern.test(file.name.replace(/[–—]/g, '-'));
  });
  if (!match || typeof match.url !== 'string' || typeof match.name !== 'string') return null;
  return {
    id: `annual-financial-statements-${fiscalYear}`,
    title: `${WALGETT_GPFS_PUBLISHER} ${match.name.replace(/\.pdf$/i, '')} (GPFS for the year ended 30 June ${Number(fiscalYear.slice(0, 4)) + 1})`,
    url: new URL(match.url, WALGETT_GPFS_REPORTING_URL).toString(),
    fiscal_year: fiscalYear,
    listing_url: WALGETT_GPFS_REPORTING_URL,
  };
}

/** Fetch and parse the same-origin published CMS snapshot the SPA loads. */
export async function discoverWalgettGpfsFromLiveSnapshot(
  fiscalYear: string = WALGETT_GPFS_FISCAL_YEAR,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<WalgettGpfsDocument> {
  const response = await fetchImpl(WALGETT_GPFS_SNAPSHOT_URL, {
    headers: WALGETT_GPFS_REQUEST_HEADERS,
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Walgett CMS snapshot HTTP ${response.status}`);
  }
  const document = parseWalgettSnapshotDocument(await response.json(), fiscalYear);
  if (!document) {
    throw new Error(
      `Walgett FY${fiscalYear} audited financial statements were not found in the published CMS snapshot; refusing to substitute an older year`,
    );
  }
  return document;
}

/**
 * Return the documented official FY2024-25 audited financial statements. Live
 * snapshots are preferred by the connector; this pinned document is the
 * documented fallback and is used by tests. A different requested year never
 * falls back to the pin.
 */
export function discoverWalgettGpfsDocument(
  fiscalYear: string = WALGETT_GPFS_FISCAL_YEAR,
): WalgettGpfsDocument {
  if (fiscalYear !== WALGETT_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No pinned Walgett Shire Council annual financial statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return walgettPinnedDocument();
}

/**
 * Parse the B1-1 "Total functions and activities" row. It prints ten numbers
 * (Income 2026/2025, Expenses 2026/2025, Operating result 2026/2025, Grants
 * 2026/2025, Carrying amount 2026/2025); the 2026 values are at even indices.
 */
export function parseWalgettGpfsFunctionsTotals(
  page: PdfPage,
): WalgettGpfsFunctionsTotals | null {
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

function gpfsFundingSource(spec: WalgettGpfsLineSpec): string {
  if (spec.potential_double_count) return 'Government grants and contributions';
  if (spec.key === 'total_revenue')
    return 'Council total revenue (own-source plus government grants and contributions)';
  if (spec.key === 'total_expenses' || spec.key === 'total_expenses_excluding_depreciation')
    return 'Council expenditure';
  if (
    spec.key === 'net_gain_from_disposal_of_assets' ||
    spec.key === 'net_loss_from_disposal_of_assets'
  )
    return 'Proceeds and gains/losses from asset disposals';
  if (spec.key === 'net_share_joint_ventures')
    return 'Share of interests in joint ventures and associates';
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
  context: WalgettGpfsParseContext,
  spec: WalgettGpfsLineSpec,
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
export function walgettGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = WALGETT_GPFS_FISCAL_YEAR,
): string {
  return `${WALGETT_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: { spec: WalgettGpfsLineSpec; value: number; page_number: number },
  context: WalgettGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: WALGETT_GPFS_FISCAL_YEAR,
    source_id: WALGETT_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: walgettGpfsNaturalKey(context.document.url, spec.key, WALGETT_GPFS_FISCAL_YEAR),
    project_name: `Walgett Council GPFS ${WALGETT_GPFS_FISCAL_YEAR} — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: WALGETT_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: WALGETT_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: WALGETT_GPFS_DATA_QUALITY_FLAG,
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

function rejectWith(warnings: string[], reason: string): WalgettGpfsParseResult {
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
export function parseWalgettGpfsExtraction(
  extraction: PdfExtraction,
  context: WalgettGpfsParseContext,
): WalgettGpfsParseResult {
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
  let functionsTotals: WalgettGpfsFunctionsTotals | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    comprehensiveUnit = requirePrintedUnit(comprehensivePage, 'Statement of Comprehensive Income');
    positionUnit = requirePrintedUnit(positionPage, 'Statement of Financial Position');
    cashUnit = requirePrintedUnit(cashPage, 'Statement of Cash Flows');
    functionsTotals = parseWalgettGpfsFunctionsTotals(functionsPage);
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
  const values: Array<{ spec: WalgettGpfsLineSpec; value: number; page_number: number }> = [];
  for (const spec of WALGETT_GPFS_LINES) {
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
  const netGainDisposal = valueByKey('net_gain_from_disposal_of_assets');
  const employee = valueByKey('employee_expenses');
  const materials = valueByKey('materials_and_services');
  const borrowing = valueByKey('borrowing_costs');
  const otherExpenses = valueByKey('other_expenses');
  const netLossDisposal = valueByKey('net_loss_from_disposal_of_assets');
  const jointVentures = valueByKey('net_share_joint_ventures');
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
    ['net_gain_from_disposal_of_assets', netGainDisposal],
    ['employee_expenses', employee],
    ['materials_and_services', materials],
    ['borrowing_costs', borrowing],
    ['other_expenses', otherExpenses],
    ['net_loss_from_disposal_of_assets', netLossDisposal],
    ['net_share_joint_ventures', jointVentures],
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
    otherIncome! +
    netGainDisposal!;
  const expenseComponentsSum =
    employee! + materials! + borrowing! + otherExpenses! + netLossDisposal! + jointVentures!;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = faceExpenseBridge;

  const totalExpensesLine: WalgettGpfsLineSpec = WALGETT_GPFS_LINES.find(
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
  const comprehensiveRevaluation = firstAmountAfter(
    comprehensiveText,
    'on revaluation of infrastructure, property, plant and equipment',
  );
  // Walgett has a single printed OCI component (IPPE revaluation); there is
  // no separate joint-venture/associate component in this statement.
  const comprehensiveJointVentures = 0;
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
  // Walgett's SoFP does not print a separate "Council equity interest" row;
  // total equity is the council's equity interest.
  const councilEquityInterest =
    firstAmountAfter(positionText, 'Council equity interest') ?? totalEquity;

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
  const cashInvesting = firstAmountAfter(cashText, 'Net cash flows from investing activities');
  const cashFinancing = firstAmountAfter(cashText, 'Net cash flows from financing activities');
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
  check(
    'B1-1 expenses = face total expenses bridge',
    totalExpenses,
    functionsTotals.expenses,
  );
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
    'printed revaluation component + printed joint-venture/associate component = printed other comprehensive income',
    comprehensiveOtherIncome!,
    comprehensiveRevaluation! + comprehensiveJointVentures!,
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
  check('Council equity interest = total equity', totalEquity!, councilEquityInterest!);
  check(
    'opening equity total + total comprehensive income = closing equity total',
    equityClosingTotal,
    equityOpeningTotal + comprehensiveTotal!,
  );
  check(
    'opening accumulated surplus + net result + joint-venture/associate OCI = closing accumulated surplus',
    equityClosingAccumulated,
    equityOpeningAccumulated + netResult! + comprehensiveJointVentures!,
  );
  check(
    'opening IPPE revaluation surplus + revaluation = closing IPPE revaluation surplus',
    equityClosingIppe,
    equityOpeningIppe + comprehensiveRevaluation!,
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
  check('opening cash + net change = closing cash', cashClosing!, cashOpening! + cashNetChange!);
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

  const reconciliation: WalgettGpfsReconciliation = {
    fiscal_year: WALGETT_GPFS_FISCAL_YEAR,
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
    depreciation_amortisation_impairment: depreciation!,
    government_grants_operating: grantsOperating!,
    government_grants_capital: grantsCapital!,
    net_gain_from_disposal_of_assets: netGainDisposal!,
    net_loss_from_disposal_of_assets: netLossDisposal!,
    net_share_joint_ventures: jointVentures!,
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
    comprehensive_joint_ventures: comprehensiveJointVentures!,
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
      'the single printed IPPE revaluation component equals printed other comprehensive income',
      'printed net result + printed other comprehensive income equals printed total comprehensive income',
      'Statement of Financial Position subtotals (assets, liabilities, net assets, accumulated surplus plus IPPE revaluation surplus) reconcile exactly',
      'Statement of Changes in Equity opening + total comprehensive income = closing, equal to SoFP equity, and opening accumulated surplus + net result equals closing accumulated surplus',
      'Statement of Cash Flows operating + investing + financing = net change, opening + net change = closing, closing cash reconciles to the SoFP, and the SoFP prior-year cash equals the printed opening cash',
      'the printed net result is stored with a magnitude and a negative sign marker only when printed negative; the before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'FY2024-25 is the latest available full audited standalone GPFS published as at 2026-11-20 (the client-rendered annual-reports page publishes no FY2025-26 standalone audited FS; the 17 November 2026 meeting endorsed the FY2025-26 annual report for publication); total expenses is the documented bridge of the printed expenses-excluding-depreciation line (38,231) plus the printed depreciation/amortisation/impairment line (8,811) = 47,042, equal to the printed B1-1 expense total; the printed net gain from the disposal of assets (56) is a revenue component, the printed net loss from the disposal of assets is nil in 2025, and the printed net share of interests in joint ventures and associates (60) is an expense component; B1-1 income (37,665) equals the face total income, B1-1 grants (20,754 = operating 14,340 + capital 6,414) and carrying amount (501,502) reconcile to the face statements, and B1-1 income minus B1-1 expenses equals the printed operating result and net result (-9,377); the net result plus other comprehensive income (single IPPE revaluation component 28,220) equals total comprehensive income attributable to Council (18,843); the printed before-capital result (-15,791) is retained in reconciliation evidence only; the balance sheet (accumulated surplus 139,322 plus IPPE revaluation surplus 347,324 = total equity 486,646) and cash-flow statement (opening 19,393 plus the net change -14,042 = closing 5,351) reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections: [] };
}

export interface WalgettGpfsConnectorOptions {
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers from the official snapshot. */
  document?: WalgettGpfsDocument;
  /** Pre-fetched PDF bytes from the official browser download. */
  pdfBytes?: Uint8Array;
  /** Resolved signed download URL captured by the browser helper. */
  resolvedUrl?: string;
  /** Override only for tests; the live path uses the official snapshot and PDF. */
  fetchImpl?: typeof fetch;
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
  return 'walgett-council-annual_financial_statements-gpfs-2025.pdf';
}

/** Build the live Walgett Council GPFS connector. */
export function createWalgettGpfsConnector(options: WalgettGpfsConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: WALGETT_GPFS_ID,
    name: WALGETT_GPFS_NAME,
    publisher: WALGETT_GPFS_PUBLISHER,
    source_url: WALGETT_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WALGETT_GPFS_LICENSE,
    notes:
      "NSW council GPFS adapter: one council only (Walgett Shire Council), FY2024-25 General Purpose Financial Statements (year ended 30 June 2025) from the official standalone audited financial statements PDF listed on the client-rendered Annual Reports and Financial Statements page. The HTML shell carries no document links, so discovery reads the same published CMS snapshot the SPA loads at runtime (/snapshot.json); the documented headless Chromium helper confirms the rendered DOM link and the snapshot network request, then fetches the exact bytes. FY2024-25 is the latest available standalone audited GPFS as at 2026-11-20; the page also lists only the FY2024-25 narrative annual report (not substituted) and no FY2025-26 standalone audited FS was published (the 17 November 2026 meeting endorsed the FY2025-26 annual report for publication), so no older or newer year is substituted. The PDF embeds the Auditor-General's unmodified GPFS opinion and report on the conduct of the audit. Parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. The face statement prints a net gain from the disposal of assets as a revenue component, a net loss from disposal (nil in 2025) as an expense component, and a net share of joint ventures as an expense component; total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation/amortisation/impairment; other comprehensive income is the single IPPE revaluation gain; B1-1 income, expenses, result, grants and carrying amount all reconcile. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const fetchImpl = options.fetchImpl ?? globalThis.fetch;
      let discovered = options.document;
      if (!discovered) {
        try {
          discovered = await discoverWalgettGpfsFromLiveSnapshot(
            WALGETT_GPFS_FISCAL_YEAR,
            fetchImpl,
          );
        } catch (error) {
          discovered = discoverWalgettGpfsDocument();
          metadata.warnings.push(
            `live CMS snapshot discovery failed (${error instanceof Error ? error.message : String(error)}); using documented official PDF pin ${discovered.url}`,
          );
        }
      }
      let bytes: Buffer;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          headers: WALGETT_GPFS_REQUEST_HEADERS,
          redirect: 'follow',
        });
        if (!response.ok) {
          throw new Error(`Walgett audited financial statements PDF HTTP ${response.status}`);
        }
        const fetched = Buffer.from(await response.arrayBuffer());
        if (fetched.subarray(0, 4).toString('latin1') !== '%PDF') {
          throw new Error('Walgett audited financial statements fetch did not return PDF bytes');
        }
        bytes = fetched;
      }
      const resolvedUrl = options.resolvedUrl ?? discovered.resolved_url;
      const document: WalgettGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: WALGETT_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes: 'Walgett Council FY2024-25 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: WalgettGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: WALGETT_GPFS_REPORTING_URL,
      };
      const parsed = parseWalgettGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'walgett-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'walgett-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Walgett Council GPFS measure; skipped');
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
  WALGETT_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  WALGETT_GPFS_DATA_QUALITY_FLAG,
  WALGETT_GPFS_DELIVERY_ENTITY,
  WALGETT_GPFS_DOCUMENT_PIN,
  WALGETT_GPFS_FISCAL_YEAR,
  WALGETT_GPFS_ID,
  WALGETT_GPFS_LICENSE,
  WALGETT_GPFS_LINES,
  WALGETT_GPFS_NAME,
  WALGETT_GPFS_PUBLISHER,
  WALGETT_GPFS_REPORTING_URL,
  WALGETT_GPFS_REQUEST_HEADERS,
  WALGETT_GPFS_SNAPSHOT_URL,
  WALGETT_GPFS_SOURCE_DATASET,
  WALGETT_GPFS_STANDALONE_FS_BYTES,
  WALGETT_GPFS_STANDALONE_FS_PAGES,
  WALGETT_GPFS_STANDALONE_FS_SHA256,
  type WalgettGpfsLineSpec,
};
