import type { SpendingRecord } from '@ausspend/shared';
import {
  detectMoneyUnit,
  moneyToCents,
  type MoneyUnitKind,
  type PdfExtraction,
  type PdfPage,
} from '../pdf-extract.js';
import { gpfsFundingSource, gpfsNaturalKey, gpfsUnitLabel } from '../gpfs/engine.js';
import {
  HUNTERS_HILL_FUNCTIONS,
  HUNTERS_HILL_INCOME_LINES,
  type HuntersHillLineSpec,
} from './config.js';
import {
  HUNTERS_HILL_GPFS_DATA_QUALITY_FLAG,
  HUNTERS_HILL_GPFS_FISCAL_YEAR,
  HUNTERS_HILL_GPFS_ID,
  HUNTERS_HILL_GPFS_SOURCE_DATASET,
} from './meta.js';

export interface HuntersHillDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
}

export interface HuntersHillParseContext {
  document: HuntersHillDocument;
  archive: { local_path: string; sha256: string; bytes: number; fetched_at: string };
  sourceDate: string;
  reporting_url?: string;
}

export interface HuntersHillReconciliation {
  total_revenue: number;
  total_expenses: number;
  net_result: number;
  function_expenses_sum: number;
  function_income: number;
}

export interface HuntersHillParseResult {
  records: SpendingRecord[];
  reconciliation: HuntersHillReconciliation | null;
  warnings: string[];
  rejections: { section: string; reason: string }[];
}

function normalize(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPage(pages: readonly PdfPage[], marker: string): PdfPage | undefined {
  return pages.find((page) => normalize(page.text).includes(marker));
}

function numberValue(token: string): number | null {
  const text = token.trim();
  const negative = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/[(),$]/g, '').replace(/\s/g, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Last two numeric tokens after a printed label are Actual 2025 / Actual 2024. */
function valuesAfterLabel(page: PdfPage, label: string, nextLabels: readonly string[]): number[] {
  const text = normalize(page.text);
  const start = text.indexOf(label);
  if (start < 0) throw new Error(`Hunters Hill GPFS printed label not found: ${label}`);
  const after = text.slice(start + label.length);
  const nextPositions = nextLabels
    .map((next) => after.indexOf(next))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b);
  const segment = nextPositions.length > 0 ? after.slice(0, nextPositions[0]) : after.slice(0, 220);
  // Printed note references (B2-1, B3-2) sit before the two actual columns.
  const refs = [...segment.matchAll(/B\d-\d/g)];
  const tail = refs.length > 0 ? segment.slice(refs[refs.length - 1]!.index + 4) : segment;
  let numbers = [...tail.matchAll(/\(?\d[\d,]*\)?/g)]
    .map((match) => numberValue(match[0]))
    .filter((value): value is number => value !== null);
  if (refs.length === 0) {
    // Drop leading note references (1, 2, 3) printed before the actual columns.
    while (numbers.length > 2 && Math.abs(numbers[0]!) < 100) numbers = numbers.slice(1);
  }
  if (numbers.length < 2) {
    throw new Error(`Hunters Hill GPFS line has fewer than two printed values: ${label}`);
  }
  return numbers.slice(0, 2);
}

function numberBlockAfterLabel(page: PdfPage, label: string, expected: number): number[] {
  const text = normalize(page.text);
  const start = text.indexOf(label);
  if (start < 0) throw new Error(`Hunters Hill GPFS printed label not found: ${label}`);
  const after = text.slice(start + label.length, start + label.length + 320);
  const numbers = [...after.matchAll(/\(?\d[\d,]*\)?/g)]
    .map((match) => numberValue(match[0]))
    .filter((value): value is number => value !== null);
  if (numbers.length < expected) {
    throw new Error(
      `Hunters Hill GPFS row has ${numbers.length} numbers, expected ${expected}: ${label}`,
    );
  }
  return numbers.slice(0, expected);
}

function mapRecord(
  spec: HuntersHillLineSpec,
  value: number,
  unit: MoneyUnitKind,
  context: HuntersHillParseContext,
  pageNumber: number,
  statementLabel: string,
): SpendingRecord {
  return {
    amount_cents: moneyToCents(Math.abs(value), unit),
    measure_type: 'actual',
    fiscal_year: HUNTERS_HILL_GPFS_FISCAL_YEAR,
    source_id: HUNTERS_HILL_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: gpfsNaturalKey(
      HUNTERS_HILL_GPFS_ID,
      context.document.url,
      spec.key,
      HUNTERS_HILL_GPFS_FISCAL_YEAR,
    ),
    project_name: `Hunters Hill Council GPFS 2024-25 — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: 'Hunters Hill Council',
    funding_source: gpfsFundingSource(spec.section, Boolean(spec.potential_double_count), spec.key),
    source_dataset: HUNTERS_HILL_GPFS_SOURCE_DATASET,
    source_date: context.sourceDate,
    data_quality_flag: HUNTERS_HILL_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    extraction_confidence: 'high',
    gpfs_line_item: spec.key,
    gpfs_line_label: spec.label,
    gpfs_unit: gpfsUnitLabel(unit),
    gpfs_section: spec.section,
    gpfs_statement: spec.statement,
    ...(spec.component_of ? { gpfs_component_of: spec.component_of } : {}),
    ...(spec.potential_double_count ? { potential_double_count: true } : {}),
    ...(value < 0 ? { gpfs_printed_sign: 'negative' as const } : {}),
    notes: `source_detail: ${context.archive.local_path}; sha256: ${context.archive.sha256}; document: ${context.document.title}; document_url: ${context.document.url}; page: ${pageNumber}; printed_label: ${statementLabel}; unit: ${unit} (explicit); provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified`,
  };
}

export function parseHuntersHillGpfsExtraction(
  extraction: PdfExtraction,
  context: HuntersHillParseContext,
): HuntersHillParseResult {
  const warnings: string[] = [];
  const rejections: { section: string; reason: string }[] = [];
  const reject = (reason: string): HuntersHillParseResult => {
    rejections.push({ section: 'gpfs', reason });
    warnings.push(reason);
    return { records: [], reconciliation: null, warnings, rejections };
  };

  const incomePage = findPage(extraction.pages, 'Original unaudited budget');
  if (!incomePage) return reject('audited income statement page not found; no rows ingested');
  const functionsPage = findPage(extraction.pages, 'Total functions and activities');
  if (!functionsPage)
    return reject('B1-1 Total functions and activities page not found; no rows ingested');
  const comprehensivePage = extraction.pages.find(
    (page) =>
      normalize(page.text).includes('Statement of Comprehensive Income') &&
      normalize(page.text).includes('Net operating result for the year'),
  );
  if (!comprehensivePage)
    return reject('Statement of Comprehensive Income page not found; no rows ingested');

  const unitDetection = detectMoneyUnit([incomePage.text, functionsPage.text]);
  if (!unitDetection.kind) return reject(`printed unit is ambiguous: ${unitDetection.reason}`);
  const unit = unitDetection.kind;

  const incomeSpecs = HUNTERS_HILL_INCOME_LINES.filter(
    (spec) => spec.statement === 'Income Statement',
  );
  const values = new Map<string, number>();
  const labels = incomeSpecs.map((spec) => spec.label);
  for (const spec of incomeSpecs) {
    const next = labels.slice(labels.indexOf(spec.label) + 1);
    if (spec.key === 'net_result') next.push('Prior year adjusted');
    const pair = valuesAfterLabel(incomePage, spec.label, next);
    values.set(spec.key, pair[0]!);
  }

  const totalRevenue = values.get('total_revenue')!;
  const totalExpensesExDep = values.get('total_expenses_excluding_depreciation')!;
  const depreciation = values.get('depreciation_amortisation_impairment')!;
  const netResult = values.get('net_result')!;
  const revenueComponents = incomeSpecs
    .filter((spec) => spec.section === 'revenue' && spec.key !== 'total_revenue')
    .reduce((sum, spec) => sum + values.get(spec.key)!, 0);
  const expenseComponents = incomeSpecs
    .filter(
      (spec) =>
        spec.section === 'expenses' &&
        !spec.key.startsWith('total_') &&
        spec.key !== 'depreciation_amortisation_impairment',
    )
    .reduce((sum, spec) => sum + values.get(spec.key)!, 0);

  // B1-1 total row: Income, Expenses, Operating result, Grants, Carrying amount.
  const totalRow = numberBlockAfterLabel(functionsPage, 'Total functions and activities', 10);
  const functionsTotalIncome = totalRow[0]!;
  const functionsTotalExpenses = totalRow[2]!;
  const functionsResult = totalRow[4]!;
  const comprehensive = numberBlockAfterLabel(
    comprehensivePage,
    'Net operating result for the year – from Income Statement',
    2,
  );
  const comprehensiveNetResult = comprehensive[0]!;

  const checks: string[] = [];
  if (Math.abs(revenueComponents - totalRevenue) > 0.01) {
    checks.push(`revenue components ${revenueComponents} != total revenue ${totalRevenue}`);
  }
  if (Math.abs(expenseComponents - totalExpensesExDep) > 0.01) {
    checks.push(
      `expense components ${expenseComponents} != expenses excluding depreciation ${totalExpensesExDep}`,
    );
  }
  if (Math.abs(totalExpensesExDep + depreciation - functionsTotalExpenses) > 0.2) {
    checks.push(
      `expenses excluding depreciation + depreciation != B1-1 total expenses ${functionsTotalExpenses}`,
    );
  }
  if (Math.abs(functionsTotalIncome - totalRevenue) > 0.01) {
    checks.push(`B1-1 total income ${functionsTotalIncome} != income statement ${totalRevenue}`);
  }
  if (Math.abs(functionsResult - netResult) > 0.01) {
    checks.push(`B1-1 operating result ${functionsResult} != net result ${netResult}`);
  }
  if (Math.abs(comprehensiveNetResult - netResult) > 0.01) {
    checks.push(
      `comprehensive-income net result ${comprehensiveNetResult} != net result ${netResult}`,
    );
  }
  if (checks.length > 0)
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);

  const records: SpendingRecord[] = [];
  for (const spec of incomeSpecs) {
    records.push(
      mapRecord(spec, values.get(spec.key)!, unit, context, incomePage.page_number, spec.label),
    );
  }

  // Printed B1-1 expense/service categories (5 functions) + the printed total.
  for (const fn of HUNTERS_HILL_FUNCTIONS) {
    const numbers = numberBlockAfterLabel(functionsPage, fn.label, 10);
    const expenses = numbers[2]!;
    records.push({
      amount_cents: moneyToCents(Math.abs(expenses), unit),
      measure_type: 'actual',
      fiscal_year: HUNTERS_HILL_GPFS_FISCAL_YEAR,
      source_id: HUNTERS_HILL_GPFS_ID,
      source_url: context.document.url,
      verified: false,
      natural_key: gpfsNaturalKey(
        HUNTERS_HILL_GPFS_ID,
        context.document.url,
        `function_${fn.key}`,
        HUNTERS_HILL_GPFS_FISCAL_YEAR,
      ),
      project_name: `Hunters Hill Council GPFS 2024-25 — ${fn.label}`,
      description: 'Expense/service function — B1-1 Functions or activities',
      jurisdiction_level: 'local',
      jurisdiction: 'NSW',
      delivery_entity: 'Hunters Hill Council',
      funding_source: 'Council expenditure',
      source_dataset: HUNTERS_HILL_GPFS_SOURCE_DATASET,
      source_date: context.sourceDate,
      data_quality_flag: HUNTERS_HILL_GPFS_DATA_QUALITY_FLAG,
      aggregation_role: 'agency_detail',
      extraction_confidence: 'high',
      gpfs_line_item: `function_${fn.key}`,
      gpfs_line_label: fn.label,
      gpfs_unit: gpfsUnitLabel(unit),
      gpfs_section: 'expenses',
      gpfs_statement: 'B1-1 Functions or activities',
      notes: `source_detail: ${context.archive.local_path}; sha256: ${context.archive.sha256}; document: ${context.document.title}; page: ${functionsPage.page_number}; printed function expense; provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with any other council or state rows; unverified`,
    });
  }
  const totalExpensesSpec: HuntersHillLineSpec = {
    key: 'total_expenses',
    label: 'Total functions and activities',
    section: 'expenses',
    statement: 'B1-1 Functions or activities',
  };
  records.push(
    mapRecord(
      totalExpensesSpec,
      functionsTotalExpenses,
      unit,
      context,
      functionsPage.page_number,
      'Total functions and activities',
    ),
  );

  const functionExpensesSum = records
    .filter((record) => record.gpfs_line_item?.startsWith('function_'))
    .reduce((sum, record) => sum + record.amount_cents, 0);
  if (Math.abs(functionExpensesSum - moneyToCents(functionsTotalExpenses, unit)) > 100_000) {
    return reject('B1-1 function expenses do not sum to the printed total; no rows ingested');
  }

  return {
    records,
    reconciliation: {
      total_revenue: totalRevenue,
      total_expenses: functionsTotalExpenses,
      net_result: netResult,
      function_expenses_sum: functionExpensesSum,
      function_income: functionsTotalIncome,
    },
    warnings: [
      `reconciled: revenue ${totalRevenue}, B1-1 expenses ${functionsTotalExpenses}, net result ${netResult} ($'000)`,
    ],
    rejections,
  };
}
