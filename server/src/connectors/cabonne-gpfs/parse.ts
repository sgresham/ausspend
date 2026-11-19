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
import { CABONNE_GPFS_LINES, type CabonneGpfsLineSpec } from './config.js';
import {
  CABONNE_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  CABONNE_GPFS_DATA_QUALITY_FLAG,
  CABONNE_GPFS_DELIVERY_ENTITY,
  CABONNE_GPFS_DOCUMENT_PIN,
  CABONNE_GPFS_FISCAL_YEAR,
  CABONNE_GPFS_ID,
  CABONNE_GPFS_LICENSE,
  CABONNE_GPFS_NAME,
  CABONNE_GPFS_PUBLISHER,
  CABONNE_GPFS_REPORTING_URL,
  CABONNE_GPFS_REQUEST_HEADERS,
  CABONNE_GPFS_SOURCE_DATASET,
  CABONNE_GPFS_STANDALONE_FS_BYTES,
  CABONNE_GPFS_STANDALONE_FS_PAGES,
  CABONNE_GPFS_STANDALONE_FS_SHA256,
} from './meta.js';

/**
 * NSW council GPFS adapter: Cabonne Council's FY2025-26 General Purpose
 * Financial Statements (year ended 30 June 2026).
 *
 * The entire official site is behind Akamai bot protection: plain HTTP clients
 * get HTTP 403 ("Access Denied") for the home page, sitemaps and every `/files`
 * path, while a real headless Chromium session gets HTTP 200. The current
 * standalone audited GPFS is therefore pinned to the exact official upload on
 * the Reports page (`Annual_Financial_Statements-GPFS-2026.pdf`) and fetched
 * through the browser/WAF path (`scripts/cabonne-gpfs-browser.ts`); the
 * connector archives and SHA-256 verifies the exact bytes. The FY2025-26 PDF
 * embeds the independent Auditor-General report (PDF pages 64-66) with an
 * unmodified opinion, and was authorised for issue on 22 September 2026. The
 * newest combined annual report on the same page is still FY2024-25, so no
 * narrative annual report is substituted.
 *
 * The printed unit is `$ '000`. Nothing is emitted unless the Income Statement,
 * B1-1 "Total functions and activities", Statement of Comprehensive Income,
 * Statement of Financial Position, Statement of Changes in Equity and Statement
 * of Cash Flows reconcile exactly at zero tolerance.
 *
 * The face Income Statement does not print a "Total expenses" line. Total
 * expenses is the documented bridge of the printed expenses-excluding-
 * depreciation line ($33,963 thousand) plus the printed depreciation,
 * amortisation and impairment line ($16,093 thousand), giving $50,056 thousand.
 * The B1-1 expense total equals that bridge exactly. Cabonne prints the net gain
 * from the disposal of assets ($39 thousand) as a revenue component. Other
 * comprehensive income has two printed components: the IPPE revaluation gain
 * ($20,479 thousand) plus the joint-venture/associate share ($597 thousand).
 *
 * Every row is non-additive `agency_detail` with no region/LGA allocation, so it
 * can never be summed into another council, a council total, state spending, the
 * PNFC benchmark or the OLG summary layer.
 */
export interface CabonneGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
  listing_url?: string;
  resolved_url?: string;
}

export interface CabonneGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface CabonneGpfsParseContext {
  document: CabonneGpfsDocument;
  archive: CabonneGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface CabonneGpfsRejection {
  section: string;
  reason: string;
}

export interface CabonneGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
  carrying_amount: number;
}

export interface CabonneGpfsReconciliation {
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

export interface CabonneGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: CabonneGpfsReconciliation | null;
  warnings: string[];
  rejections: CabonneGpfsRejection[];
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
export function detectCabonneGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectCabonneGpfsUnit([page.text]);
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
 * or Cabonne's "GPFS-2026" convention (the calendar year of the 30 June year
 * end). A bare unrelated year is never guessed.
 */
export function fiscalYearFromCabonneFinancialStatementsDoc(text: string): string | null {
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
  // Cabonne's GPFS filename uses the year-ended calendar year with an explicit
  // "GPFS" marker, e.g. "Annual_Financial_Statements-GPFS-2026.pdf". A bare
  // year without that marker is not accepted.
  const gpfs = /(?:annual[-_ ]financial[-_ ]statements?[-_ ])?gpfs[-_ ]((?:19|20)\d{2})\b/i.exec(
    normalized,
  );
  if (gpfs) {
    const end = Number(gpfs[1]);
    return `${end - 1}-${String(end).slice(-2)}`;
  }
  return null;
}

/** The documented official pin used when live discovery is unavailable. */
export function cabonnePinnedDocument(): CabonneGpfsDocument {
  return {
    id: `annual-financial-statements-gpfs-${CABONNE_GPFS_FISCAL_YEAR}`,
    title: 'Cabonne Council Annual Financial Statements — GPFS for the year ended 30 June 2026',
    url: CABONNE_GPFS_DOCUMENT_PIN,
    fiscal_year: CABONNE_GPFS_FISCAL_YEAR,
    listing_url: CABONNE_GPFS_REPORTING_URL,
  };
}

/**
 * Return the documented official FY2025-26 standalone audited GPFS. The
 * council's site is WAF-blocked to plain clients, so there is no plain-text
 * discovery index to parse; the exact official upload is recorded on the
 * Reports page and pinned here. A different requested year never falls back to
 * the pin.
 */
export function discoverCabonneGpfsDocument(
  fiscalYear: string = CABONNE_GPFS_FISCAL_YEAR,
): CabonneGpfsDocument {
  if (fiscalYear !== CABONNE_GPFS_FISCAL_YEAR) {
    throw new Error(
      `No pinned Cabonne Council annual financial statements link for FY${fiscalYear} was found; refusing to guess a document URL`,
    );
  }
  return cabonnePinnedDocument();
}

/**
 * Parse the B1-1 "Total functions and activities" row. It prints ten numbers
 * (Income 2026/2025, Expenses 2026/2025, Operating result 2026/2025, Grants
 * 2026/2025, Carrying amount 2026/2025); the 2026 values are at even indices.
 */
export function parseCabonneGpfsFunctionsTotals(
  page: PdfPage,
): CabonneGpfsFunctionsTotals | null {
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

function gpfsFundingSource(spec: CabonneGpfsLineSpec): string {
  if (spec.potential_double_count) return 'Government grants and contributions';
  if (spec.key === 'total_revenue')
    return 'Council total revenue (own-source plus government grants and contributions)';
  if (spec.key === 'total_expenses' || spec.key === 'total_expenses_excluding_depreciation')
    return 'Council expenditure';
  if (spec.key === 'net_gain_from_disposal_of_assets')
    return 'Proceeds and gains from asset disposals';
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
  context: CabonneGpfsParseContext,
  spec: CabonneGpfsLineSpec,
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
export function cabonneGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = CABONNE_GPFS_FISCAL_YEAR,
): string {
  return `${CABONNE_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: { spec: CabonneGpfsLineSpec; value: number; page_number: number },
  context: CabonneGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const printedSign: 'positive' | 'negative' = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: CABONNE_GPFS_FISCAL_YEAR,
    source_id: CABONNE_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: cabonneGpfsNaturalKey(context.document.url, spec.key, CABONNE_GPFS_FISCAL_YEAR),
    project_name: `Cabonne Council GPFS 2025-26 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: CABONNE_GPFS_DELIVERY_ENTITY,
    funding_source: gpfsFundingSource(spec),
    source_dataset: CABONNE_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: CABONNE_GPFS_DATA_QUALITY_FLAG,
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

function rejectWith(warnings: string[], reason: string): CabonneGpfsParseResult {
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
export function parseCabonneGpfsExtraction(
  extraction: PdfExtraction,
  context: CabonneGpfsParseContext,
): CabonneGpfsParseResult {
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
  let functionsTotals: CabonneGpfsFunctionsTotals | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    comprehensiveUnit = requirePrintedUnit(comprehensivePage, 'Statement of Comprehensive Income');
    positionUnit = requirePrintedUnit(positionPage, 'Statement of Financial Position');
    cashUnit = requirePrintedUnit(cashPage, 'Statement of Cash Flows');
    functionsTotals = parseCabonneGpfsFunctionsTotals(functionsPage);
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
  const values: Array<{ spec: CabonneGpfsLineSpec; value: number; page_number: number }> = [];
  for (const spec of CABONNE_GPFS_LINES) {
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
  const expenseComponentsSum = employee! + materials! + borrowing! + otherExpenses!;
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = faceExpenseBridge;

  const totalExpensesLine: CabonneGpfsLineSpec = CABONNE_GPFS_LINES.find(
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
    'Gain on revaluation of infrastructure, property, plant and equipment',
  );
  const comprehensiveJointVentures = firstAmountAfter(
    comprehensiveText,
    'joint ventures and associates',
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
  if (comprehensiveJointVentures === null) {
    return rejectWith(
      warnings,
      `p${comprehensivePage.page_number}: could not read the printed joint-venture/associate OCI component; no rows ingested`,
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
  const councilEquityInterest = firstAmountAfter(positionText, 'Council equity interest');
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

  const reconciliation: CabonneGpfsReconciliation = {
    fiscal_year: CABONNE_GPFS_FISCAL_YEAR,
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
      'the printed revaluation component plus the printed joint-venture/associate component equals printed other comprehensive income',
      'printed net result + printed other comprehensive income equals printed total comprehensive income',
      'Statement of Financial Position subtotals (assets, liabilities, net assets, accumulated surplus plus IPPE revaluation surplus) reconcile exactly',
      'Statement of Changes in Equity opening + total comprehensive income = closing, equal to SoFP equity, and opening accumulated surplus + net result + joint-venture/associate OCI equals closing accumulated surplus',
      'Statement of Cash Flows operating + investing + financing = net change, opening + net change = closing, closing cash reconciles to the SoFP, and the SoFP prior-year cash equals the printed opening cash',
      'the printed net result is stored with a magnitude and a negative sign marker only when printed negative; the before-capital result is retained in reconciliation evidence only',
    ],
  };

  const reconciliationNote =
    'total expenses is the documented bridge of the printed expenses-excluding-depreciation line (33,963) plus the printed depreciation/amortisation/impairment line (16,093) = 50,056, equal to the printed B1-1 expense total; the printed net gain from the disposal of assets (39) is a revenue component and is emitted; B1-1 income (70,018) includes grants and contributions (operating 15,902 + capital 20,626 = 36,528) and equals the face total income; B1-1 income minus B1-1 expenses equals the printed operating result and net result (19,962); the net result plus other comprehensive income (revaluation 20,479 plus joint ventures/associates 597 = 21,076) equals total comprehensive income attributable to Council (41,038); the printed before-capital result (-664) is retained in reconciliation evidence only; the balance sheet (accumulated surplus 446,835 plus IPPE revaluation surplus 302,864 = total equity 749,699) and cash-flow statement (opening 14,620 plus the net change 4,832 = closing 19,452) reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to the printed totals`,
  );
  return { records, reconciliation, warnings, rejections: [] };
}

export interface CabonneGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path uses the documented official pin. */
  document?: CabonneGpfsDocument;
  /** Pre-fetched PDF bytes from the browser/WAF path. */
  pdfBytes?: Uint8Array;
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
  return 'Annual_Financial_Statements-GPFS-2026.pdf';
}

/** Build the live Cabonne Council GPFS connector. */
export function createCabonneGpfsConnector(options: CabonneGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: CABONNE_GPFS_ID,
    name: CABONNE_GPFS_NAME,
    publisher: CABONNE_GPFS_PUBLISHER,
    source_url: CABONNE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: CABONNE_GPFS_LICENSE,
    notes:
      "NSW council GPFS adapter: one council only (Cabonne Council), FY2025-26 General Purpose Financial Statements (year ended 30 June 2026) from the official standalone Annual Financial Statements — GPFS PDF published on the council's Reports page. The entire official site is behind Akamai bot protection (plain clients get HTTP 403 'Access Denied' for the home page, sitemaps and every /files path), so the exact official pin is fetched through headless Chromium and the connector archives and SHA-256 verifies those bytes. The PDF embeds the independent Auditor-General report (PDF pages 64-66) with an unmodified opinion and was authorised for issue on 22 September 2026. The newest combined annual report on the same page is still FY2024-25, so no narrative annual report is substituted. Parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Cabonne prints the net gain from the disposal of assets as a revenue component; total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation/amortisation/impairment, equal to the printed B1-1 expense total; other comprehensive income is the IPPE revaluation gain plus the joint-venture/associate share. B1-1 income includes grants and contributions, so B1-1 income equals the face total income, B1-1 operating result equals the net result, and B1-1 grants equal operating plus capital grants. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const discovered = options.document ?? discoverCabonneGpfsDocument();
      let bytes: Buffer;
      let resolvedUrl = discovered.resolved_url;
      if (options.pdfBytes) {
        bytes = Buffer.from(options.pdfBytes);
      } else {
        const response = await fetchImpl(discovered.url, {
          redirect: 'follow',
          headers: CABONNE_GPFS_REQUEST_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `Cabonne Council GPFS fetch HTTP ${response.status} for ${discovered.url}; the official site is Akamai/WAF-blocked to plain clients — run scripts/cabonne-gpfs-browser.ts and pass the returned bytes`,
          );
        }
        bytes = Buffer.from(await response.arrayBuffer());
        resolvedUrl = response.url || resolvedUrl;
      }
      const document: CabonneGpfsDocument = {
        ...discovered,
        ...(resolvedUrl ? { resolved_url: resolvedUrl } : {}),
      };
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: CABONNE_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes: 'Cabonne Council FY2025-26 General Purpose Financial Statements; archived for the GPFS reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: CabonneGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: CABONNE_GPFS_REPORTING_URL,
      };
      const parsed = parseCabonneGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({
        kind: 'cabonne-gpfs-measure',
        record,
      }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'cabonne-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Cabonne Council GPFS measure; skipped');
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
  CABONNE_GPFS_CURRENT_ANNUAL_REPORT_PIN,
  CABONNE_GPFS_DATA_QUALITY_FLAG,
  CABONNE_GPFS_DELIVERY_ENTITY,
  CABONNE_GPFS_DOCUMENT_PIN,
  CABONNE_GPFS_FISCAL_YEAR,
  CABONNE_GPFS_ID,
  CABONNE_GPFS_LICENSE,
  CABONNE_GPFS_LINES,
  CABONNE_GPFS_NAME,
  CABONNE_GPFS_PUBLISHER,
  CABONNE_GPFS_REPORTING_URL,
  CABONNE_GPFS_REQUEST_HEADERS,
  CABONNE_GPFS_SOURCE_DATASET,
  CABONNE_GPFS_STANDALONE_FS_BYTES,
  CABONNE_GPFS_STANDALONE_FS_PAGES,
  CABONNE_GPFS_STANDALONE_FS_SHA256,
  type CabonneGpfsLineSpec,
};
