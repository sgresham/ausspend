import { createHash } from 'node:crypto';
import type { SpendingRecord, MeasureType } from '@ausspend/shared';
import {
  UNIT_MULTIPLIER_TO_CENTS,
  extractArchivedPdf,
  moneyToCents,
  parseAmountCell,
  type MoneyUnitKind,
  type PdfExtraction,
  type PdfPage,
  type PdfTextItem,
  type UnitDetection,
  detectMoneyUnit,
} from './pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from './source-archive.js';
import { RegionModel } from '../models/index.js';
import type { Connector, RawRecord } from './types.js';

/**
 * S3 Dubbo Regional Council adapter.
 *
 * Only one council is covered. The adapter reads the council's own budget and
 * capital-expenditure PDF, archives the exact bytes with SHA-256, extracts the
 * positioned text with the shared PDF foundation, and then applies a
 * Dubbo-specific layout parser. It never guesses a unit: the summary is only
 * ingested when the published `($000's)` marker is present, and the capital
 * program is only ingested when its magnitude reconciles with the explicit
 * `$'000` summary. A row/column total mismatch rejects the whole section.
 *
 * Every row is provisional, carries extraction_confidence and verified:false.
 * A second council must be a separate adapter like this one; the shared runner
 * and archive/PDF foundation are unchanged.
 */

export const DUBBO_ID = 'dubbo-council';
export const DUBBO_NAME = 'Dubbo Regional Council — Annual Report / Operational Plan';
export const DUBBO_PUBLISHER = 'Dubbo Regional Council';
export const DUBBO_SOURCE_URL =
  'https://www.dubbo.nsw.gov.au/About-Council/Our-Responsibilities/Integrated-Planning-and-Reporting';
export const DUBBO_SOURCE_DATASET = 'Dubbo Regional Council Annual Report / Operational Plan';
export const DUBBO_REGION_CODE = 'NSW-DUBBO';
export const DUBBO_REGION_SLUG = 'dubbo';
export const DUBBO_REGION_NAME = 'Dubbo';
/** Deterministic region _id = sha256('ausspend:dubbo-region').slice(0, 24). */
export const DUBBO_REGION_ID = '40d7a238d4b2cef48ae5f267';
export const DUBBO_LICENSE =
  '© Dubbo Regional Council. Published council documents used here for public-interest research; not an open-data licence grant.';

/**
 * Ensure the single S3 local-government Region exists with the deterministic
 * _id every Dubbo row references. Idempotent; refuses to silently adopt a
 * different id for the same code.
 */
export async function ensureDubboRegion(): Promise<string> {
  const existing = await RegionModel.findOne({
    $or: [{ code: DUBBO_REGION_CODE }, { name: DUBBO_REGION_NAME, level: 'region' }],
  }).lean();
  if (existing) {
    const id = existing._id.toString();
    if (id !== DUBBO_REGION_ID) {
      throw new Error(
        `Dubbo region exists with _id ${id}, but Dubbo rows reference ${DUBBO_REGION_ID}; refusing to mix ids`,
      );
    }
    return id;
  }
  await RegionModel.updateOne(
    { _id: DUBBO_REGION_ID },
    {
      $setOnInsert: {
        code: DUBBO_REGION_CODE,
        name: DUBBO_REGION_NAME,
        level: 'region',
        parent_code: 'NSW',
      },
    },
    { upsert: true },
  );
  return DUBBO_REGION_ID;
}

export interface DubboDocumentSpec {
  id: string;
  title: string;
  url: string;
  /** First fiscal year column in the capital program (the "Budget" column). */
  capitalBudgetFiscalYear: string;
}

export const DUBBO_DOCUMENTS: ReadonlyArray<DubboDocumentSpec> = [
  {
    id: 'budget-2026-27',
    title: '2026/2027 Budget and Forward Forecasts including Capital Expenditure (Adopted)',
    url: 'https://www.dubbo.nsw.gov.au/ArticleDocuments/290/20262027%20Budget%20and%20Forecasts%20including%20Capital%20-%20Adopted.PDF.aspx',
    capitalBudgetFiscalYear: '2026-27',
  },
];

export interface DubboArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface DubboParseContext {
  document: DubboDocumentSpec;
  archive: DubboArchiveMeta;
  sourceDate: string;
}

export interface DubboRejection {
  document: string;
  section: string;
  row: number | null;
  reason: string;
}

interface PageRow {
  y: number;
  items: PdfTextItem[];
  labelX: number;
  cells: string[];
}

/** Convert "2026/2027" (or "2026-27") to the API's "2026-27". */
export function formatFiscalYear(raw: string): string | null {
  const text = raw.trim();
  const embedded = /((?:19|20)\d{2}\s*[/-]\s*(?:19|20)?\d{2})/.exec(text);
  if (embedded && embedded[1] !== text) return formatFiscalYear(embedded[1]!);
  const slash = /^((?:19|20)\d{2})\s*[/-]\s*((?:19|20)?\d{2})$/.exec(text);
  if (!slash) return null;
  const start = Number(slash[1]);
  const endRaw = slash[2]!;
  const end = endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
  if (end !== start + 1) return null;
  return `${start}-${String(end).slice(-2)}`;
}

function groupPageRows(page: PdfPage, tolerance = 3): PageRow[] {
  const sorted = [...page.items].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.y - item.y) <= tolerance) last.items.push(item);
    else groups.push({ y: item.y, items: [item] });
  }
  return groups
    .map((group) => {
      const items = [...group.items].sort((a, b) => a.x - b.x);
      const cells = items.map((item) => item.str.replace(/\s+/g, ' ').trim()).filter(Boolean);
      return { y: group.y, items, labelX: items[0]?.x ?? 0, cells };
    })
    .filter((row) => row.cells.length > 0);
}

/** Detect the unit from explicit header/unit text, never defaulting to dollars. */
export function detectDubboUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

/**
 * Resolve a unit when the table has no printed unit marker by reconciling the
 * raw total against a reference amount known to be dollars (the explicit
 * `$'000` consolidated summary). Exactly one candidate must fit the scale.
 */
export function resolveUnitByScale(rawTotal: number, referenceDollars: number): UnitDetection {
  const candidates: MoneyUnitKind[] = ['dollars', 'thousands', 'millions', 'billions'];
  const fits = candidates.filter((kind) => {
    const dollars =
      rawTotal *
      10 ** (kind === 'dollars' ? 0 : kind === 'thousands' ? 3 : kind === 'millions' ? 6 : 9);
    if (!Number.isFinite(dollars) || referenceDollars <= 0) return false;
    const ratio = dollars / referenceDollars;
    return ratio >= 0.05 && ratio <= 5;
  });
  if (fits.length === 1) {
    return {
      kind: fits[0]!,
      multiplier_to_cents: UNIT_MULTIPLIER_TO_CENTS[fits[0]!],
      ambiguous: false,
      raw_matches: [
        `raw total ${rawTotal} vs reference $${referenceDollars.toLocaleString('en-AU')}`,
      ],
      reason: `unit ${fits[0]} resolved by magnitude reconciliation against the explicit $'000 summary`,
    };
  }
  return {
    kind: null,
    multiplier_to_cents: null,
    ambiguous: true,
    raw_matches: [
      `raw total ${rawTotal} vs reference $${referenceDollars.toLocaleString('en-AU')}`,
    ],
    reason:
      fits.length === 0
        ? 'raw total does not reconcile with the explicit summary unit; refusing to guess'
        : `ambiguous unit: ${fits.join(', ')} all fit the magnitude check`,
  };
}

export interface DubboLineRow {
  row_index: number;
  label: string;
  section: 'income' | 'expenses';
  values: Array<number | null>;
}

export interface DubboSummaryTable {
  fund: string;
  page_number: number;
  fiscal_years: string[];
  measure_types: MeasureType[];
  unit: MoneyUnitKind;
  unit_evidence: string;
  income: DubboLineRow[];
  expenses: DubboLineRow[];
  total_income: number[];
  total_expenses: number[];
  totals_ok: boolean;
  exact_totals: boolean;
  errors: string[];
  rounding_notes: string[];
}

function isYearRow(cells: readonly string[]): boolean {
  return cells.length === 5 && cells.every((cell) => formatFiscalYear(cell) !== null);
}

function measureTypeForColumn(label: string): MeasureType {
  const text = label.toLowerCase();
  if (text.includes('budget')) return 'budget';
  if (text.includes('actual') || text.includes('audited')) return 'actual';
  return 'estimate';
}

function clusterAnchors(
  xs: readonly number[],
  expected: number,
  tolerance: number,
): number[] | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const clusters: Array<{ x: number; count: number }> = [];
  for (const x of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(x - last.x) <= tolerance) {
      last.x = (last.x * last.count + x) / (last.count + 1);
      last.count += 1;
    } else {
      clusters.push({ x, count: 1 });
    }
  }
  const anchors = clusters.map((cluster) => cluster.x).sort((a, b) => a - b);
  return anchors.length === expected ? anchors : null;
}

/** Assign a row's numeric items to fixed column anchors; missing cells stay null. */
function rowValuesByAnchor(row: PageRow, anchors: readonly number[]): number[] | null {
  const values: number[] = anchors.map(() => 0);
  const seen: boolean[] = anchors.map(() => false);
  for (const item of row.items.slice(1)) {
    const parsed = parseAmountCell(item.str);
    if (parsed.value === null) {
      if (parsed.error) return null;
      continue;
    }
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    anchors.forEach((anchor, index) => {
      const distance = Math.abs(item.x - anchor);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    values[best] = (values[best] ?? 0) + parsed.value;
    seen[best] = true;
  }
  return values;
}

/** Parse one "Income and Expenditure Summary" page (fund-level budget summary). */
export function parseDubboSummaryPage(page: PdfPage): DubboSummaryTable | null {
  const rows = groupPageRows(page);
  const titleIndex = rows.findIndex(
    (row) =>
      row.cells[0] === 'Income and Expenditure Summary' ||
      row.cells.join(' ').includes('Income and Expenditure Summary'),
  );
  if (titleIndex < 0) return null;

  const fundRow = rows.slice(titleIndex + 1).find((row) => row.cells.length === 1);
  const yearIndex = rows.findIndex((row, index) => index > titleIndex && isYearRow(row.cells));
  if (!fundRow || yearIndex < 0) return null;
  const fiscalYears = rows[yearIndex]!.cells.map((cell) => formatFiscalYear(cell)!);
  const measureRow = rows.slice(yearIndex + 1).find((row) => row.cells.length === 5);
  const unitRow = rows.slice(yearIndex + 1, yearIndex + 4).find((row) => {
    const text = row.cells.join(' ');
    return detectDubboUnit([text]).kind !== null;
  });
  if (!measureRow || !unitRow) return null;
  const measureTypes = measureRow.cells.map((cell) => measureTypeForColumn(cell));
  const unit = detectDubboUnit([unitRow.cells.join(' ')]);
  if (!unit.kind) return null;

  const startIndex = rows.indexOf(unitRow);
  const incomeLabelIndex = rows.findIndex(
    (row, index) => index > startIndex && row.cells[0] === 'Income',
  );
  const expensesLabelIndex = rows.findIndex(
    (row, index) => index > startIndex && row.cells[0] === 'Expenses',
  );
  if (incomeLabelIndex < 0 || expensesLabelIndex < 0) return null;
  const totalIncomeIndex = rows.findIndex(
    (row, index) =>
      index > incomeLabelIndex &&
      index < expensesLabelIndex &&
      /^Total income\b/i.test(row.cells[0] ?? ''),
  );
  const totalExpensesIndex = rows.findIndex(
    (row, index) => index > expensesLabelIndex && /^Total expenses\b/i.test(row.cells[0] ?? ''),
  );
  if (totalIncomeIndex < 0 || totalExpensesIndex < 0) return null;

  const numericXs: number[] = [];
  for (let index = incomeLabelIndex + 1; index <= totalExpensesIndex; index += 1) {
    const row = rows[index];
    if (!row) continue;
    for (const item of row.items.slice(1)) {
      if (parseAmountCell(item.str).value !== null) numericXs.push(item.x);
    }
  }
  const anchors = clusterAnchors(numericXs, fiscalYears.length, 20);
  if (!anchors) return null;

  const collect = (from: number, to: number, section: 'income' | 'expenses'): DubboLineRow[] => {
    const out: DubboLineRow[] = [];
    for (let index = from; index < to; index += 1) {
      const row = rows[index];
      if (!row || row.cells.length < 2) continue;
      const label = row.cells[0]!;
      if (/^(?:Net operating result|Net Operating Result)/i.test(label)) continue;
      const values = rowValuesByAnchor(row, anchors);
      if (!values) continue;
      out.push({ row_index: index, label, section, values });
    }
    return out;
  };

  const income = collect(incomeLabelIndex + 1, totalIncomeIndex, 'income');
  const expenses = collect(expensesLabelIndex + 1, totalExpensesIndex, 'expenses');
  const totalIncome = rowValuesByAnchor(rows[totalIncomeIndex]!, anchors) ?? [];
  const totalExpenses = rowValuesByAnchor(rows[totalExpensesIndex]!, anchors) ?? [];

  // Published $'000 tables round each line independently, so a 1-unit
  // difference is normal. Allow the maximum rounding error (one unit per line)
  // but never a scaling/column error.
  const errors: string[] = [];
  const rounding_notes: string[] = [];
  const exactChecks: boolean[] = [];
  for (let column = 0; column < fiscalYears.length; column += 1) {
    const incomeSum = income.reduce((sum, row) => sum + (row.values[column] ?? 0), 0);
    const expenseSum = expenses.reduce((sum, row) => sum + (row.values[column] ?? 0), 0);
    const incomeTolerance = income.length + 1;
    const expenseTolerance = expenses.length + 1;
    const incomeDiff = Math.abs(incomeSum - (totalIncome[column] ?? 0));
    const expenseDiff = Math.abs(expenseSum - (totalExpenses[column] ?? 0));
    if (incomeDiff > incomeTolerance) {
      errors.push(
        `${fundRow.cells[0]} ${fiscalYears[column]} income mismatch: rows sum ${incomeSum}, printed total ${totalIncome[column]}`,
      );
    } else if (incomeDiff > 0) {
      rounding_notes.push(
        `${fundRow.cells[0]} ${fiscalYears[column]} income rounding difference ${incomeDiff} unit(s) (within rounding tolerance ${incomeTolerance})`,
      );
    }
    exactChecks.push(incomeDiff === 0);
    if (expenseDiff > expenseTolerance) {
      errors.push(
        `${fundRow.cells[0]} ${fiscalYears[column]} expense mismatch: rows sum ${expenseSum}, printed total ${totalExpenses[column]}`,
      );
    } else if (expenseDiff > 0) {
      rounding_notes.push(
        `${fundRow.cells[0]} ${fiscalYears[column]} expense rounding difference ${expenseDiff} unit(s) (within rounding tolerance ${expenseTolerance})`,
      );
    }
    exactChecks.push(expenseDiff === 0);
  }

  return {
    fund: fundRow.cells[0]!,
    page_number: page.page_number,
    fiscal_years: fiscalYears,
    measure_types: measureTypes,
    unit: unit.kind,
    unit_evidence: unit.reason,
    income,
    expenses,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    totals_ok: errors.length === 0,
    exact_totals: exactChecks.every(Boolean),
    errors,
    rounding_notes,
  };
}

interface CapitalRow {
  page_number: number;
  row_index: number;
  label: string;
  labelX: number;
  values: Array<number | null>;
  numericX: number[];
}

interface CapitalCategory {
  group: string;
  category: string;
  page_number: number;
  row_index: number;
  values: number[];
  jobs: string[];
}

interface CapitalGroupTotal {
  group: string;
  page_number: number;
  row_index: number;
  values: number[];
}

export interface DubboCapitalProgram {
  unit: MoneyUnitKind | null;
  unit_evidence: string;
  unit_ambiguous: boolean;
  fiscal_years: string[];
  categories: CapitalCategory[];
  group_totals: CapitalGroupTotal[];
  grand_total: number[] | null;
  totals_ok: boolean;
  errors: string[];
}

const JOB_PATTERN = /^\d{8}\s*-\s*/;

function clusterNumericColumns(pages: PdfPage[]): number[] | null {
  const xs: number[] = [];
  for (const page of pages) {
    for (const row of groupPageRows(page)) {
      if (!/\bTotal$/i.test(row.cells[0] ?? '')) continue;
      for (const item of row.items.slice(1)) {
        if (parseAmountCell(item.str).value !== null) xs.push(item.x);
      }
    }
  }
  if (xs.length === 0) return null;
  xs.sort((a, b) => a - b);
  const clusters: Array<{ x: number; count: number }> = [];
  for (const x of xs) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(x - last.x) <= 30) {
      last.x = (last.x * last.count + x) / (last.count + 1);
      last.count += 1;
    } else {
      clusters.push({ x, count: 1 });
    }
  }
  const anchors = clusters.map((cluster) => cluster.x).sort((a, b) => a - b);
  return anchors.length === 4 ? anchors : null;
}

function assignColumns(
  row: PageRow,
  anchors: readonly number[],
): { values: Array<number | null>; numericX: number[] } {
  const values: Array<number | null> = [null, null, null, null];
  const numericX: number[] = [];
  for (const item of row.items.slice(1)) {
    const parsed = parseAmountCell(item.str);
    if (parsed.value === null) continue;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    anchors.forEach((anchor, index) => {
      const distance = Math.abs(item.x - anchor);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    values[best] = parsed.value;
    numericX.push(item.x);
  }
  return { values, numericX };
}

/** Parse the capital-expenditure program pages (layout-aware: indentation = hierarchy). */
export function parseDubboCapitalPages(
  pages: readonly PdfPage[],
  fromPage: number,
): DubboCapitalProgram {
  const capitalPages = pages.filter((page) => page.page_number >= fromPage);
  const anchors = clusterNumericColumns(capitalPages);
  const errors: string[] = [];
  if (!anchors) errors.push('capital program: could not resolve the four numeric columns');

  const categories: CapitalCategory[] = [];
  const groupTotals: CapitalGroupTotal[] = [];
  let grandTotal: number[] | null = null;
  let fiscalYears: string[] = [];
  let currentGroup = '';
  let currentCategory = '';
  let currentJobs: string[] = [];
  let categoryRows: CapitalRow[] = [];
  const allLabelXs = capitalPages
    .flatMap((page) => groupPageRows(page))
    .filter((row) => {
      if (row.cells.length !== 1 || !row.cells[0]) return false;
      if (formatFiscalYear(row.cells[0]) !== null) return false;
      return !/^(?:CAPITAL EXPENDITURE|DUBBO REGIONAL COUNCIL)$/i.test(row.cells[0]);
    })
    .map((row) => row.labelX);
  const levelX =
    allLabelXs.length > 0
      ? { group: Math.min(...allLabelXs), category: Math.min(...allLabelXs) + 8 }
      : { group: 0, category: 8 };

  const flushCategory = () => {
    if (!currentCategory) return;
    const total = categoryRows.find(
      (row) => /\bTotal$/i.test(row.label) && !JOB_PATTERN.test(row.label),
    );
    if (total) {
      categories.push({
        group: currentGroup,
        category: currentCategory,
        page_number: total.page_number,
        row_index: total.row_index,
        values: total.values.map((value) => value ?? 0),
        jobs: [...currentJobs],
      });
    }
    currentCategory = '';
    currentJobs = [];
    categoryRows = [];
  };

  for (const page of capitalPages) {
    const rows = groupPageRows(page);
    const headerIndex = rows.findIndex(
      (row) => row.cells.length >= 2 && row.cells.some((cell) => /budget|forecast/i.test(cell)),
    );
    if (headerIndex < 0) continue;
    if (fiscalYears.length === 0) {
      const forecastYears = rows[headerIndex]!.cells.map((cell) => formatFiscalYear(cell))
        .filter((year): year is string => year !== null)
        .filter((year, index, all) => all.indexOf(year) === index);
      const budgetCell = rows
        .slice(0, headerIndex)
        .reverse()
        .flatMap((row) => row.cells)
        .find((cell) => formatFiscalYear(cell) !== null);
      const budgetYear = budgetCell ? formatFiscalYear(budgetCell) : null;
      fiscalYears = budgetYear ? [budgetYear, ...forecastYears] : forecastYears;
    }

    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const row = rows[index]!;
      const label = row.cells[0] ?? '';
      if (!label) continue;
      if (/^(?:DUBBO REGIONAL COUNCIL|CAPITAL EXPENDITURE|\d{2}\/\d{2}\/\d{4})/i.test(label))
        continue;
      if (lastRowIsFooter(label)) continue;

      const atGroupLevel = row.labelX <= levelX.group + 3;
      const atCategoryLevel = row.labelX > levelX.group + 3 && row.labelX <= levelX.category + 3;
      const isTotal = /\bTotal$/i.test(label);

      if (atGroupLevel && !isTotal) {
        flushCategory();
        currentGroup = label;
        continue;
      }
      if (atGroupLevel && isTotal) {
        flushCategory();
        if (/^Capital Total$|^Expenditure Total$|^Total$/i.test(label)) {
          const assigned = assignColumns(row, anchors ?? []);
          grandTotal = assigned.values.map((value) => value ?? 0);
        } else {
          groupTotals.push({
            group: currentGroup,
            page_number: page.page_number,
            row_index: index,
            values: assignColumns(row, anchors ?? []).values.map((value) => value ?? 0),
          });
        }
        continue;
      }
      if (atCategoryLevel && !isTotal) {
        flushCategory();
        currentCategory = label;
        continue;
      }
      if (atCategoryLevel && isTotal) {
        const assigned = assignColumns(row, anchors ?? []);
        categoryRows.push({
          page_number: page.page_number,
          row_index: index,
          label,
          labelX: row.labelX,
          values: assigned.values,
          numericX: assigned.numericX,
        });
        flushCategory();
        continue;
      }
      if (JOB_PATTERN.test(label) && currentCategory) {
        currentJobs.push(label);
      }
    }
    // A category total at the very end of a page is flushed above; keep the
    // category open only when the next row is another project on the next page.
  }
  flushCategory();

  // Totals validation: category -> group -> grand total.
  const groupByCategory = new Map<string, number[]>();
  for (const category of categories) {
    const sum = groupByCategory.get(category.group) ?? [0, 0, 0, 0];
    category.values.forEach((value, column) => {
      sum[column] = (sum[column] ?? 0) + value;
    });
    groupByCategory.set(category.group, sum);
  }
  for (const groupTotal of groupTotals) {
    const sum = groupByCategory.get(groupTotal.group) ?? [0, 0, 0, 0];
    groupTotal.values.forEach((value, column) => {
      if ((sum[column] ?? 0) !== value) {
        errors.push(
          `${groupTotal.group} ${fiscalYears[column] ?? column}: categories sum ${sum[column] ?? 0}, printed total ${value}`,
        );
      }
    });
  }
  if (grandTotal) {
    const sum = [0, 0, 0, 0];
    for (const groupTotal of groupTotals) {
      groupTotal.values.forEach((value, column) => {
        sum[column] = (sum[column] ?? 0) + value;
      });
    }
    grandTotal.forEach((value, column) => {
      if (sum[column] !== value) {
        errors.push(
          `grand total ${fiscalYears[column] ?? column}: groups sum ${sum[column]}, printed total ${value}`,
        );
      }
    });
  } else {
    errors.push('capital program: no grand total row found; totals cannot be verified');
  }

  return {
    unit: null,
    unit_evidence: '',
    unit_ambiguous: true,
    fiscal_years: fiscalYears,
    categories,
    group_totals: groupTotals,
    grand_total: grandTotal,
    totals_ok: errors.length === 0,
    errors,
  };
}

function lastRowIsFooter(label: string): boolean {
  return /^\d{1,2}$/.test(label) || /^page \d+/i.test(label);
}

export interface DubboParseResult {
  records: SpendingRecord[];
  warnings: string[];
  rejections: DubboRejection[];
  summary_tables: number;
  capital_categories: number;
}

function dubboNaturalKey(
  documentUrl: string,
  section: string,
  tableIndex: number,
  rowIndex: number,
  fiscalYear: string,
): string {
  return `${DUBBO_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${section}\u001f${tableIndex}\u001f${rowIndex}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function cofogForCapital(label: string): string | undefined {
  const text = label.toLowerCase();
  if (/rural roads|urban roads|roads network|road$/.test(text)) return '045';
  if (/water supply/.test(text)) return '063';
  if (/sewerage|stormwater|water waste/.test(text)) return '052';
  if (/waste management|landfill/.test(text)) return '051';
  if (/open space|park|recreation|sport|playground/.test(text)) return '08';
  if (/library|theatre|gallery|museum|cultural|culture/.test(text)) return '08';
  return undefined;
}

function notesFor(
  context: DubboParseContext,
  parts: Record<string, string | number | null | undefined>,
): string {
  const detail = Object.entries(parts)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('; ');
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document.title}`,
    `document_url: ${context.document.url}`,
    detail,
    'provisional; unverified; never sum across measure types or jurisdiction levels',
  ]
    .filter(Boolean)
    .join('; ');
}

function mapSummaryTable(
  table: DubboSummaryTable,
  context: DubboParseContext,
  tableIndex: number,
  rejections: DubboRejection[],
): SpendingRecord[] {
  if (!table.totals_ok) {
    rejections.push({
      document: context.document.id,
      section: `summary:${table.fund}`,
      row: null,
      reason: `row/column totals do not reconcile; section rejected, no rows ingested: ${table.errors.join('; ')}`,
    });
    return [];
  }
  const records: SpendingRecord[] = [];
  const rows = [...table.income, ...table.expenses];
  for (const row of rows) {
    row.values.forEach((value, column) => {
      if (value === null || value === 0) return;
      if (value < 0) {
        rejections.push({
          document: context.document.id,
          section: `summary:${table.fund}`,
          row: row.row_index,
          reason: `${row.label} ${table.fiscal_years[column]}: negative amount ${value} skipped (model stores non-negative spending)`,
        });
        return;
      }
      const fiscalYear = table.fiscal_years[column]!;
      const measureType = table.measure_types[column]!;
      const sectionLabel = row.section === 'income' ? 'Income' : 'Expenses';
      records.push({
        region_id: DUBBO_REGION_ID,
        amount_cents: moneyToCents(value, table.unit),
        measure_type: measureType,
        fiscal_year: fiscalYear,
        source_id: DUBBO_ID,
        source_url: context.document.url,
        verified: false,
        natural_key: dubboNaturalKey(
          context.document.url,
          'summary',
          tableIndex,
          row.row_index,
          fiscalYear,
        ),
        project_name: `${table.fund}: ${row.label}`,
        description: `${sectionLabel} line item — ${table.fund}`,
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'Dubbo Regional Council',
        funding_source: `Council budget — ${table.fund}`,
        source_dataset: DUBBO_SOURCE_DATASET,
        source_date: context.sourceDate,
        data_quality_flag: 'provisional',
        extraction_confidence: table.exact_totals ? 'high' : 'medium',
        location: { state: 'NSW', lga_name: 'Dubbo' },
        notes: notesFor(context, {
          statement: 'Income and Expenditure Summary',
          fund: table.fund,
          page: table.page_number,
          row: row.row_index,
          section: sectionLabel,
          measure_column: `${measureType} (${table.fiscal_years[column]})`,
          unit: `unit ${table.unit} (explicit; ${table.unit_evidence})`,
          totals: table.exact_totals
            ? 'column totals reconcile exactly'
            : `column totals reconcile within published rounding (${table.rounding_notes.join('; ')})`,
        }),
      });
    });
  }
  return records;
}

function mapCapitalProgram(
  program: DubboCapitalProgram,
  context: DubboParseContext,
  rejections: DubboRejection[],
): SpendingRecord[] {
  if (!program.unit || program.unit_ambiguous) {
    rejections.push({
      document: context.document.id,
      section: 'capital',
      row: null,
      reason: `capital unit is ambiguous (${program.unit_evidence}); section rejected, no rows ingested`,
    });
    return [];
  }
  if (!program.totals_ok) {
    rejections.push({
      document: context.document.id,
      section: 'capital',
      row: null,
      reason: `capital row/column totals do not reconcile; section rejected, no rows ingested: ${program.errors.join('; ')}`,
    });
    return [];
  }
  const records: SpendingRecord[] = [];
  const fiscalYear = program.fiscal_years[Math.min(1, program.fiscal_years.length - 1)];
  // The first column is the Budget year (2026/2027); the rest are forecasts.
  const budgetYear = context.document.capitalBudgetFiscalYear;
  const column = 0;
  for (const category of program.categories) {
    const value = category.values[column] ?? 0;
    if (value <= 0) continue;
    if (!fiscalYear && !budgetYear) continue;
    const functionCode = cofogForCapital(`${category.group} ${category.category}`);
    records.push({
      region_id: DUBBO_REGION_ID,
      ...(functionCode ? { function_code: functionCode } : {}),
      amount_cents: moneyToCents(value, program.unit),
      measure_type: 'budget',
      fiscal_year: budgetYear,
      source_id: DUBBO_ID,
      source_url: context.document.url,
      verified: false,
      natural_key: dubboNaturalKey(
        context.document.url,
        'capital',
        category.page_number,
        category.row_index,
        budgetYear,
      ),
      project_name: `${category.group} — ${category.category}`,
      description:
        category.jobs.length > 0
          ? `Capital works category total; ${category.jobs.length} job(s): ${category.jobs.slice(0, 12).join(', ')}`
          : 'Capital works category total',
      jurisdiction_level: 'local',
      jurisdiction: 'NSW',
      delivery_entity: 'Dubbo Regional Council',
      funding_source:
        'Capital works program — council capital expenditure (source table does not itemise funding sources)',
      source_dataset: DUBBO_SOURCE_DATASET,
      source_date: context.sourceDate,
      data_quality_flag: 'provisional',
      extraction_confidence: 'medium',
      location: { state: 'NSW', lga_name: 'Dubbo' },
      notes: notesFor(context, {
        statement: 'Capital Expenditure',
        group: category.group,
        category: category.category,
        page: category.page_number,
        row: category.row_index,
        fiscal_column: `Budget ${budgetYear}`,
        unit: `unit ${program.unit} (inferred by magnitude reconciliation: ${program.unit_evidence})`,
        totals: 'category, group and grand totals reconcile',
        jobs: category.jobs.slice(0, 30).join(', ') || null,
      }),
    });
  }
  return records;
}

/** Parse a whole Dubbo PDF extraction into provisional, validated measure rows. */
export function parseDubboExtraction(
  extraction: PdfExtraction,
  context: DubboParseContext,
): DubboParseResult {
  const warnings: string[] = [];
  const rejections: DubboRejection[] = [];
  const summaryTables: DubboSummaryTable[] = [];
  for (const page of extraction.pages) {
    const table = parseDubboSummaryPage(page);
    if (table) summaryTables.push(table);
  }

  const records: SpendingRecord[] = [];
  summaryTables.forEach((table, index) => {
    if (!table.totals_ok) {
      warnings.push(`${table.fund}: ${table.errors.join('; ')}`);
    }
    warnings.push(...table.rounding_notes);
    records.push(...mapSummaryTable(table, context, index, rejections));
  });

  const capitalStart = extraction.pages.find((page) =>
    groupPageRows(page).some(
      (row) => row.cells.length === 1 && /^CAPITAL EXPENDITURE$/i.test(row.cells[0] ?? ''),
    ),
  )?.page_number;
  let capitalCategories = 0;
  if (capitalStart !== undefined) {
    const program = parseDubboCapitalPages(extraction.pages, capitalStart);
    const consolidated = summaryTables.find((table) => /consolidated/i.test(table.fund));
    const referenceColumn = consolidated
      ? consolidated.fiscal_years.indexOf(context.document.capitalBudgetFiscalYear)
      : -1;
    const referenceDollars =
      consolidated && referenceColumn >= 0
        ? moneyToCents(consolidated.total_income[referenceColumn] ?? 0, consolidated.unit) / 100
        : 0;
    const rawTotal = program.grand_total?.[0] ?? 0;
    if (rawTotal > 0 && referenceDollars > 0) {
      const unit = resolveUnitByScale(rawTotal, referenceDollars);
      program.unit = unit.kind;
      program.unit_evidence = unit.reason;
      program.unit_ambiguous = unit.ambiguous;
    } else {
      program.unit_ambiguous = true;
      program.unit_evidence =
        'no explicit unit in the capital table and no usable consolidated summary reference for magnitude reconciliation';
    }
    capitalCategories = program.categories.length;
    if (!program.totals_ok) warnings.push(...program.errors);
    records.push(...mapCapitalProgram(program, context, rejections));
  } else {
    warnings.push('capital expenditure section not found; no capital rows ingested');
  }

  if (summaryTables.length === 0)
    warnings.push('no Income and Expenditure Summary tables detected');
  for (const rejection of rejections) {
    warnings.push(`${rejection.section}: ${rejection.reason}`);
  }

  return {
    records,
    warnings,
    rejections,
    summary_tables: summaryTables.length,
    capital_categories: capitalCategories,
  };
}

export interface DubboConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  documents?: ReadonlyArray<DubboDocumentSpec>;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'dubbo-council-budget.pdf';
}

/** Build the live Dubbo connector. */
export function createDubboConnector(options: DubboConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const documents = options.documents ?? DUBBO_DOCUMENTS;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: DUBBO_ID,
    name: DUBBO_NAME,
    publisher: DUBBO_PUBLISHER,
    source_url: DUBBO_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: DUBBO_LICENSE,
    notes:
      "S3 pilot: one council only (Dubbo Regional Council). The adopted 2026/27 budget PDF is archived with SHA-256 and parsed with the shared PDF foundation plus a Dubbo layout adapter. Summary tables require the printed ($000's) unit and reconcile their column totals; the capital program is dollars only after magnitude reconciliation against the explicit summary, and is rejected if category/group/grand totals disagree. Every row is provisional and unverified; no other council or state is ingested.",
    async fetch(): Promise<RawRecord[]> {
      const parsedRecords: SpendingRecord[] = [];
      metadata.warnings = [];
      metadata.errors = [];
      for (const document of documents) {
        const response = await fetchImpl(document.url, { redirect: 'follow' });
        if (!response.ok) {
          throw new Error(`Dubbo source fetch HTTP ${response.status} for ${document.url}`);
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        const archived: ArchivedSourceRecord = await archiveSourceDocument({
          source_id: DUBBO_ID,
          title: document.title,
          original_url: document.url,
          retrieved_from: document.url,
          archived_from: 'direct',
          filename: documentFilename(document.url),
          content_type: 'application/pdf',
          data: bytes,
          root: options.archiveRoot,
          notes:
            'Adopted Dubbo Regional Council budget/capital PDF; archived for auditable S3 extraction.',
        });
        await verifySourceDocument(archived);
        const extraction = await extractArchivedPdf(archived);
        const context: DubboParseContext = {
          document,
          archive: {
            local_path: archived.local_path,
            sha256: archived.sha256,
            bytes: archived.bytes,
            fetched_at: archived.fetched_at,
          },
          sourceDate: archived.fetched_at.slice(0, 10),
        };
        const parsed = parseDubboExtraction(extraction, context);
        metadata.warnings.push(...parsed.warnings);
        if (parsed.records.length === 0) {
          metadata.errors.push(`${document.id}: no validated rows extracted`);
        }
        parsedRecords.push(...parsed.records);
      }
      return parsedRecords.map((record) => ({ kind: 'dubbo-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'dubbo-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Dubbo measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };

  return connector;
}

/** Exported for tests that want to exercise the pure summary mapper. */
export function mapDubboSummaryForTest(
  table: DubboSummaryTable,
  context: DubboParseContext,
  tableIndex = 0,
): { records: SpendingRecord[]; rejections: DubboRejection[] } {
  const rejections: DubboRejection[] = [];
  return { records: mapSummaryTable(table, context, tableIndex, rejections), rejections };
}
