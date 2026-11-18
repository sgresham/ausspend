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
import { DUBBO_LICENSE } from '../dubbo-council.js';
import type { Connector, RawRecord } from '../types.js';

/**
 * GPFS pilot: Dubbo Regional Council's audited General Purpose Financial
 * Statements for FY2024-25.
 *
 * This is a separate source id from `dubbo-council` (the adopted budget /
 * forward-forecast PDF with 245 rows). The two series are different years,
 * measure types and granularities, so they are never summed: every row here is
 * `aggregation_role: "agency_detail"` and carries no region/LGA allocation, so
 * the generic additive API and the Dubbo area panel cannot include it.
 *
 * The PDF URL is discovered from the council's reporting page (never a
 * hard-coded document URL), the exact bytes are SHA-256 archived outside the
 * repo, and the printed `$ '000` unit is required. The income statement's
 * printed lines and the note B1-1 "Total functions and activities" row are
 * reconciled exactly before any row is emitted.
 */

export const DUBBO_GPFS_ID = 'dubbo-council-gpfs';
export const DUBBO_GPFS_NAME = 'Dubbo Regional Council — General Purpose Financial Statements';
export const DUBBO_GPFS_PUBLISHER = 'Dubbo Regional Council';
export const DUBBO_GPFS_REPORTING_URL =
  'https://www.dubbo.nsw.gov.au/About-Council/Our-Responsibilities/reporting';
export const DUBBO_GPFS_FISCAL_YEAR = '2024-25';
export const DUBBO_GPFS_TARGET_YEAR_LABEL = '2024/2025';
export const DUBBO_GPFS_SOURCE_DATASET = 'Dubbo Regional Council GPFS 2024-25';
export const DUBBO_GPFS_LICENSE = DUBBO_LICENSE;
export const DUBBO_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';

/** OLG FY2024-25 totals used only as an external reconciliation anchor. */
export const DUBBO_GPFS_OLG_EXPENSES_CENTS = 17_492_500_000; // $174,925,000
export const DUBBO_GPFS_OLG_REVENUE_CENTS = 23_492_700_000; // $234,927,000

export interface DubboGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
}

export interface DubboGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface DubboGpfsParseContext {
  document: DubboGpfsDocument;
  archive: DubboGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface DubboGpfsRejection {
  section: string;
  reason: string;
}

export type DubboGpfsSection = 'revenue' | 'expenses' | 'result';

export interface DubboGpfsLineSpec {
  key: string;
  label: string;
  section: DubboGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'B1-1 Functions or activities';
}

/**
 * The printed income-statement lines we emit. Total expenses is *not* summed
 * from components: it is the exact printed B1-1 "Total functions and
 * activities" expense total, accepted only when the face-statement bridge
 * agrees with it.
 */
export const DUBBO_GPFS_LINES: ReadonlyArray<DubboGpfsLineSpec> = [
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

interface DubboGpfsLineValue {
  spec: DubboGpfsLineSpec;
  value: number;
  page_number: number;
}

export interface DubboGpfsReconciliation {
  fiscal_year: string;
  unit: MoneyUnitKind;
  unit_evidence: string;
  income_statement_page: number;
  functions_page: number;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  depreciation_amortisation_impairment: number;
  government_grants_operating: number;
  government_grants_capital: number;
  net_result: number;
  net_result_before_capital_grants: number;
  printed_total_expenses_excluding_depreciation: number;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  olg_expenses_cents: number;
  olg_revenue_cents: number;
  checks: string[];
}

export interface DubboGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: DubboGpfsReconciliation | null;
  warnings: string[];
  rejections: DubboGpfsRejection[];
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
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convert "2024/2025" or "2024-2025" to the API's "2024-25". */
export function fiscalYearFromGpfsLink(text: string): string | null {
  const match = /((?:19|20)\d{2})\s*[/-]\s*((?:19|20)?\d{2})/.exec(text);
  if (!match) return null;
  const start = Number(match[1]);
  const endRaw = match[2]!;
  const end = endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
  if (end !== start + 1) return null;
  return `${start}-${String(end).slice(-2)}`;
}

/**
 * Discover GPFS links from the council's reporting page. The fiscal year comes
 * from the link text; annual reports and non-financial-statement links are
 * ignored. No document URL is hard-coded.
 */
export function parseDubboGpfsReportLinks(
  html: string,
  baseUrl: string = DUBBO_GPFS_REPORTING_URL,
): DubboGpfsDocument[] {
  const links: DubboGpfsDocument[] = [];
  const seen = new Set<string>();
  const anchor = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const href = match[1]!;
    const text = decodeHtml(match[2]!);
    if (!/financial statements/i.test(text)) continue;
    if (/annual report/i.test(text)) continue;
    const fiscalYear = fiscalYearFromGpfsLink(text);
    if (!fiscalYear) continue;
    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({
      id: `gpfs-${fiscalYear}`,
      title: text,
      url,
      fiscal_year: fiscalYear,
    });
  }
  return links;
}

/** Select the audited GPFS for the requested fiscal year. */
export function selectDubboGpfsDocument(
  links: readonly DubboGpfsDocument[],
  fiscalYear: string = DUBBO_GPFS_FISCAL_YEAR,
): DubboGpfsDocument {
  const document = links.find((link) => link.fiscal_year === fiscalYear);
  if (!document) {
    throw new Error(
      `No published Dubbo Regional Council General Purpose Financial Statements link for FY${fiscalYear} was found on ${DUBBO_GPFS_REPORTING_URL}; refusing to guess a document URL`,
    );
  }
  return document;
}

/** Discover the audited GPFS document from the live reporting page. */
export async function discoverDubboGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = DUBBO_GPFS_FISCAL_YEAR,
): Promise<DubboGpfsDocument> {
  const response = await fetchImpl(DUBBO_GPFS_REPORTING_URL, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(
      `Dubbo reporting page fetch HTTP ${response.status} for ${DUBBO_GPFS_REPORTING_URL}`,
    );
  }
  const html = await response.text();
  const links = parseDubboGpfsReportLinks(html);
  return selectDubboGpfsDocument(links, fiscalYear);
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectDubboGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectDubboGpfsUnit([page.text]);
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
  spec: DubboGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): DubboGpfsLineValue | null {
  const value = firstAmountAfter(text, spec.label);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly DubboGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface DubboGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse B1-1 "Total functions and activities". The page prints ten numbers
 * (Income 2025/2024, Expenses 2025/2024, Operating result 2025/2024, Grants
 * 2025/2024, Carrying amount 2025/2024); the 2025 values are at indices
 * 0, 2, 4 and 6.
 */
export function parseDubboGpfsFunctionsTotals(page: PdfPage): DubboGpfsFunctionsTotals | null {
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

function gpfsFundingSource(spec: DubboGpfsLineSpec): string {
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
  context: DubboGpfsParseContext,
  spec: DubboGpfsLineSpec,
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
    context.reporting_url ? `reporting_url: ${context.reporting_url}` : null,
    `statement: ${spec.statement}`,
    `page: ${pageNumber}`,
    `printed_label: ${spec.label}`,
    `unit: ${unit} (explicit; ${unitReason})`,
    `reconciliation: ${reconciliationNote}`,
    'provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with dubbo-council summary rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + document + line + fiscal year. */
export function dubboGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = DUBBO_GPFS_FISCAL_YEAR,
): string {
  return `${DUBBO_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: DubboGpfsLineValue,
  context: DubboGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  return {
    amount_cents: moneyToCents(line.value, unit),
    measure_type: 'actual',
    fiscal_year: DUBBO_GPFS_FISCAL_YEAR,
    source_id: DUBBO_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: dubboGpfsNaturalKey(context.document.url, spec.key, DUBBO_GPFS_FISCAL_YEAR),
    project_name: `Dubbo Regional Council GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: 'Dubbo Regional Council',
    funding_source: gpfsFundingSource(spec),
    source_dataset: DUBBO_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: DUBBO_GPFS_DATA_QUALITY_FLAG,
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
 * emitted unless the printed unit is explicit and every face-statement and
 * B1-1/OLG reconciliation check passes exactly.
 */
export function parseDubboGpfsExtraction(
  extraction: PdfExtraction,
  context: DubboGpfsParseContext,
): DubboGpfsParseResult {
  const warnings: string[] = [];
  const rejections: DubboGpfsRejection[] = [];
  const reject = (reason: string): DubboGpfsParseResult => {
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

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: DubboGpfsFunctionsTotals | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseDubboGpfsFunctionsTotals(functionsPage);
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
  const unit = incomeUnit.kind;

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: DubboGpfsLineValue[] = [];
  for (const spec of DUBBO_GPFS_LINES) {
    if (spec.key === 'total_expenses') continue;
    const line = lineValue(incomeText, spec, incomePage.page_number, errors);
    if (line) values.push(line);
  }
  if (errors.length > 0) return reject(errors.join('; '));

  const totalExpensesLine: DubboGpfsLineValue = {
    spec: DUBBO_GPFS_LINES.find((line) => line.key === 'total_expenses')!,
    value: functionsTotals.expenses,
    page_number: functionsTotals.page_number,
  };
  values.push(totalExpensesLine);

  const totalRevenue = lineByKey(values, 'total_revenue');
  const employee = lineByKey(values, 'employee_expenses');
  const depreciation = lineByKey(values, 'depreciation_amortisation_impairment');
  const grantsOperating = lineByKey(values, 'government_grants_operating');
  const grantsCapital = lineByKey(values, 'government_grants_capital');
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
  const netLossDisposal = lineByKey(values, 'net_loss_from_disposal_of_assets');

  const required: Array<[string, number | null]> = [
    ['total_revenue', totalRevenue],
    ['employee_expenses', employee],
    ['depreciation_amortisation_impairment', depreciation],
    ['government_grants_operating', grantsOperating],
    ['government_grants_capital', grantsCapital],
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
    ['net_loss_from_disposal_of_assets', netLossDisposal],
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
  const faceExpenseBridge = expensesExDepreciation! + depreciation!;
  const totalExpenses = functionsTotals.expenses;
  const totalRevenueCents = moneyToCents(totalRevenue!, unit);
  const totalExpensesCents = moneyToCents(totalExpenses, unit);

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
  check('OLG FY2024-25 expenses anchor', DUBBO_GPFS_OLG_EXPENSES_CENTS, totalExpensesCents);
  check('OLG FY2024-25 revenue anchor', DUBBO_GPFS_OLG_REVENUE_CENTS, totalRevenueCents);
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: DubboGpfsReconciliation = {
    fiscal_year: DUBBO_GPFS_FISCAL_YEAR,
    unit,
    unit_evidence: incomeUnit.reason,
    income_statement_page: incomePage.page_number,
    functions_page: functionsPage.page_number,
    total_revenue: totalRevenue!,
    total_expenses: totalExpenses,
    employee_expenses: employee!,
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
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    olg_expenses_cents: DUBBO_GPFS_OLG_EXPENSES_CENTS,
    olg_revenue_cents: DUBBO_GPFS_OLG_REVENUE_CENTS,
    checks: [
      'all printed face-statement line sums equal their printed subtotals/total',
      'B1-1 Total functions and activities equals the face statement',
      'printed total expenses excluding depreciation + depreciation = B1-1 total expenses',
      'OLG FY2024-25 expenses and revenue anchors match exactly',
    ],
  };

  const reconciliationNote =
    'printed total expenses from B1-1, not a component sum; face-statement bridge and OLG anchors reconcile exactly';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to OLG ${DUBBO_GPFS_OLG_REVENUE_CENTS / 100} / ${DUBBO_GPFS_OLG_EXPENSES_CENTS / 100} dollars`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface DubboGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers this from the reporting page. */
  document?: DubboGpfsDocument;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through to the stable name.
  }
  return 'dubbo-regional-council-gpfs-2024-25.pdf';
}

/** Build the live GPFS pilot connector. */
export function createDubboGpfsConnector(options: DubboGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: DUBBO_GPFS_ID,
    name: DUBBO_GPFS_NAME,
    publisher: DUBBO_GPFS_PUBLISHER,
    source_url: DUBBO_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: DUBBO_GPFS_LICENSE,
    notes:
      "GPFS pilot: one council only (Dubbo Regional Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official reporting page (no hard-coded document URL), SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and OLG FY2024-25 totals reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id from the 245 dubbo-council budget/estimate rows; no region/LGA allocation is created.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ?? (await discoverDubboGpfsDocument(fetchImpl, DUBBO_GPFS_FISCAL_YEAR));
      const response = await fetchImpl(document.url, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`Dubbo GPFS fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived: ArchivedSourceRecord = await archiveSourceDocument({
        source_id: DUBBO_GPFS_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Audited Dubbo Regional Council FY2024-25 General Purpose Financial Statements; archived for the GPFS pilot reconciliation.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const context: DubboGpfsParseContext = {
        document,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        },
        sourceDate: archived.fetched_at.slice(0, 10),
        reporting_url: DUBBO_GPFS_REPORTING_URL,
      };
      const parsed = parseDubboGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({ kind: 'dubbo-gpfs-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'dubbo-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Dubbo GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
