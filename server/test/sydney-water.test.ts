import { describe, expect, it } from 'vitest';
import {
  detectSydneyWaterUnit,
  fiscalYearFromEndDate,
  parseSydneyWaterAnnualReportLinks,
  parseSydneyWaterExtraction,
  parseSydneyWaterStatement,
  sydneyWaterNaturalKey,
  SYDNEY_WATER_ID,
  type SydneyWaterParseContext,
} from '../src/connectors/soc/nsw/sydney-water.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const URL_2025 =
  'https://www.sydneywater.com.au/content/dam/sydneywater/documents/sydney-water-annual-report-2024-25.pdf';

function item(str: string, x: number, y: number, page = 1): PdfTextItem {
  return { page_number: page, str, x, y, width: 0, height: 10 };
}

interface FixtureRow {
  label?: string;
  /** [regulated current, regulated prior, non-reg current, non-reg prior, total current, total prior] */
  values?: Array<number | null>;
  totalOnly?: boolean;
}

function noteRow(y: number, row: FixtureRow, page: number): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  if (row.label) items.push(item(row.label, 50, y, page));
  const values = row.values ?? [];
  if (row.totalOnly) {
    const current = values[0];
    const prior = values[1];
    if (typeof current === 'number')
      items.push(item(current.toLocaleString('en-AU'), 420, y, page));
    else items.push(item('-', 420, y, page));
    if (typeof prior === 'number') items.push(item(prior.toLocaleString('en-AU'), 500, y, page));
    return items;
  }
  const xs = [250, 300, 350, 400, 420, 500];
  values.forEach((value, index) => {
    const x = xs[index];
    if (x === undefined) return;
    if (typeof value === 'number') items.push(item(value.toLocaleString('en-AU'), x, y, page));
    else items.push(item('-', x, y, page));
  });
  return items;
}

function page(
  pageNumber: number,
  text: string,
  rows: Array<{ y: number; row: FixtureRow }>,
  options: { header?: 'simple' | 'three-group'; unit?: string } = {},
): PdfPage {
  const header = options.header ?? 'simple';
  const unit = options.unit ?? '$’000';
  const items: PdfTextItem[] = [];
  items.push(
    item('Statement of profit or loss and other comprehensive income', 50, 760, pageNumber),
  );
  if (header === 'simple') {
    items.push(item('Note', 150, 720, pageNumber));
    items.push(item('2025', 420, 720, pageNumber));
    items.push(item('2024', 500, 720, pageNumber));
    items.push(item(unit, 420, 708, pageNumber));
    items.push(item(unit, 500, 708, pageNumber));
  } else {
    items.push(item('Regulated', 250, 732, pageNumber));
    items.push(item('Non- Regulated', 350, 732, pageNumber));
    items.push(item('Total', 420, 732, pageNumber));
    for (const [label, x] of [
      ['2025', 250],
      ['2024', 300],
      ['2025', 350],
      ['2024', 400],
      ['2025', 420],
      ['2024', 500],
    ] as const) {
      items.push(item(label, x, 720, pageNumber));
    }
    for (const x of [250, 300, 350, 400, 420, 500]) {
      items.push(item(unit, x, 708, pageNumber));
    }
  }
  for (const { y, row } of rows) {
    if (header === 'simple') {
      if (row.label) items.push(item(row.label, 50, y, pageNumber));
      const values = row.values ?? [];
      if (typeof values[0] === 'number')
        items.push(item(values[0].toLocaleString('en-AU'), 420, y, pageNumber));
      else items.push(item('-', 420, y, pageNumber));
      if (typeof values[1] === 'number')
        items.push(item(values[1].toLocaleString('en-AU'), 500, y, pageNumber));
      else items.push(item('-', 500, y, pageNumber));
    } else {
      items.push(...noteRow(y, row, pageNumber));
    }
  }
  return { page_number: pageNumber, text, items };
}

function statementPage(
  options: { unit?: string; financeOverride?: number; pbtOverride?: number } = {},
): PdfPage {
  const revenue = 3_479_667;
  const otherIncome = 5_271;
  const finance = options.financeOverride ?? -867_538;
  const otherExpenses = -2_082_002;
  const pbt = options.pbtOverride ?? revenue + otherIncome + finance + otherExpenses;
  const rows: Array<{ y: number; row: FixtureRow }> = [
    { y: 680, row: { label: 'Revenue', values: [revenue, 3_214_568] } },
    { y: 668, row: { label: 'Other income', values: [otherIncome, 3_306] } },
    { y: 656, row: { label: 'Finance costs', values: [finance, -752_704] } },
    { y: 644, row: { label: 'Other expenses', values: [otherExpenses, -1_987_929] } },
    { y: 632, row: { label: 'Profit before income tax', values: [pbt, 477_241] } },
    { y: 620, row: { label: 'Income tax expense', values: [-160_889, -141_946] } },
    { y: 608, row: { label: 'Profit for the year', values: [374_509, 335_295] } },
    {
      y: 596,
      row: { label: 'Total comprehensive income for the year', values: [1_042_922, 746_181] },
    },
  ];
  return page(
    151,
    'Statement of profit or loss and other comprehensive income for the year ended 30 June 2025 Revenue Other income Finance costs Other expenses Profit before income tax Income tax expense Profit for the year',
    rows,
    { unit: options.unit },
  );
}

function revenuePage(): PdfPage {
  return page(
    158,
    'Note 1. Income (a) Revenue Total revenue',
    [
      {
        y: 660,
        row: {
          label: 'Total revenue',
          values: [3_139_911, 2_968_448, 339_756, 246_120, 3_479_667, 3_214_568],
        },
      },
      {
        y: 648,
        row: {
          label: 'NSW Government grants for social programs',
          values: [143_773, 144_026, null, null, 143_773, 144_026],
        },
      },
      {
        y: 636,
        row: {
          label: 'Other grants from NSW Government',
          values: [null, null, 373, null, 373, null],
        },
      },
      {
        y: 624,
        row: {
          label: 'Grants from Commonwealth Government',
          values: [null, null, null, 18, null, 18],
        },
      },
      {
        y: 612,
        row: { label: 'Interest revenue', values: [null, null, 4_748, 5_620, 4_748, 5_620] },
      },
    ],
    { header: 'three-group' },
  );
}

function financePage(options: { totalOverride?: number } = {}): PdfPage {
  return page(
    160,
    'Note 2. Expenses (a) Finance costs Total finance costs recognised in profit or loss',
    [
      { y: 660, row: { label: 'Total interest expense', values: [807_426, 611_119] } },
      {
        y: 648,
        row: {
          label: 'Government guarantee fee expense – NSW Treasury',
          values: [193_653, 193_061],
        },
      },
      { y: 636, row: { label: 'Indexation of CPI bonds', values: [32_773, 68_598] } },
      { y: 624, row: { label: 'Other finance (income) costs', values: [-518, 1_489] } },
      {
        y: 612,
        row: { label: 'Less amount capitalised as borrowing costs', values: [-165_796, -121_563] },
      },
      {
        y: 600,
        row: {
          label: 'Total finance costs recognised in profit or loss',
          values: [options.totalOverride ?? 867_538, 752_704],
        },
      },
    ],
  );
}

function otherExpensesPage(
  options: { totalOverride?: number; employeeOverride?: number } = {},
): PdfPage {
  return page(
    161,
    'Note 2. Expenses (b) Other expenses Total other expenses recognised in profit or loss',
    [
      {
        y: 660,
        row: {
          label: 'Total employee-related expenses before amounts capitalised',
          values: [728_224, 654_397],
        },
      },
      { y: 648, row: { label: 'Less amounts capitalised', values: [-279_918, -216_679] } },
      {
        y: 636,
        row: {
          label: 'Total employee-related expenses',
          values: [options.employeeOverride ?? 448_306, 437_718],
        },
      },
      {
        y: 624,
        row: { label: 'Total non-employee related expenses', values: [1_074_744, 999_970] },
      },
      {
        y: 612,
        row: { label: 'Total depreciation and amortisation expenses', values: [521_009, 500_897] },
      },
      { y: 600, row: { label: 'Total losses from disposal', values: [26_028, 12_556] } },
      { y: 588, row: { label: 'Contribution to NSW Climate Change Fund', values: [3_550, null] } },
      {
        y: 576,
        row: {
          label: 'Total impairment losses expensed (reversed) through profit or loss',
          values: [11_915, 36_788],
        },
      },
      {
        y: 564,
        row: {
          label: 'Total other expenses recognised in profit or loss',
          values: [options.totalOverride ?? 2_082_002, 1_987_929],
        },
      },
    ],
  );
}

function extraction(options: Parameters<typeof statementPage>[0] = {}): PdfExtraction {
  return {
    source: { url: URL_2025, sha256: 'a'.repeat(64), bytes: 1000 },
    pages: [statementPage(options), revenuePage(), financePage(), otherExpensesPage()],
    text: 'Statement of profit or loss and other comprehensive income for the year ended 30 June 2025',
    tables: [],
    warnings: [],
  };
}

const context: SydneyWaterParseContext = {
  document_url: URL_2025,
  document_title: 'Annual Report 2024-25',
  fiscal_year: '2024-25',
  archive: { local_path: '/archive/sydney-water-2024-25.pdf', sha256: 'a'.repeat(64), bytes: 1000 },
  source_date: '2026-11-17',
};

function recordFor(result: ReturnType<typeof parseSydneyWaterExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Sydney Water annual-report discovery', () => {
  it('discovers the latest annual-report PDF from the page and ignores other PDFs', () => {
    const html = `
      <a href="/content/dam/sydneywater/documents/ar25-climate-related-financial-disclosure.pdf">Climate</a>
      <a href="/content/dam/sydneywater/documents/sydney-water-annual-report-2023-24.pdf">2023–24</a>
      <a href="/content/dam/sydneywater/documents/sydney-water-annual-report-2024-25.pdf">Annual Report 2024–25</a>
      <a href="/content/dam/sydneywater/documents/annual-report-2020-21.pdf">2020–21</a>`;
    const links = parseSydneyWaterAnnualReportLinks(html);
    expect(links).toHaveLength(3);
    expect(links[0]).toMatchObject({
      fiscal_year: '2024-25',
      url: URL_2025,
    });
    expect(links.some((link) => link.filename.includes('climate'))).toBe(false);
  });

  it('derives the API fiscal year from the report end date', () => {
    expect(fiscalYearFromEndDate('2025-06-30')).toBe('2024-25');
    expect(fiscalYearFromEndDate('2024-06-30')).toBe('2023-24');
  });
});

describe('Sydney Water $’000 guard', () => {
  it('detects an explicit $’000 unit as thousands and converts to 100,000 cents per unit', () => {
    const unit = detectSydneyWaterUnit(["$’000 2024 $'000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('rejects a statement read as dollars instead of $’000', () => {
    const dollars = statementPage({ unit: '$' });
    const parsed = parseSydneyWaterStatement(dollars);
    expect(parsed?.unit.kind).toBe('dollars');
    expect(parsed?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const result = parseSydneyWaterExtraction(
      { ...extraction(), pages: [dollars, revenuePage(), financePage(), otherExpensesPage()] },
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
  });
});

describe('Sydney Water exact reconciliation and rows', () => {
  it('derives total expenses from the two printed totals and reconciles the PBT bridge exactly', () => {
    const result = parseSydneyWaterExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_expenses).toBe(2_949_540);
    expect(result.checks.join(' ')).toContain(
      'profit-before-tax bridge exact: 3479667 + 5271 + (-867538) + (-2082002) = 535398',
    );
    expect(result.checks.join(' ')).toContain('Note 2(a) total finance costs 867538');
    expect(result.checks.join(' ')).toContain('Note 2(b) subtotals reconcile exactly');
  });

  it('maps the required line items, grants and net result with exact cents and provenance', () => {
    const result = parseSydneyWaterExtraction(extraction(), context);
    const totalExpenses = recordFor(result, 'total_expenses');
    expect(totalExpenses).toMatchObject({
      amount_cents: 294_954_000_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'Sydney Water',
      funding_source: 'Sydney Water',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: SYDNEY_WATER_ID,
      source_url: URL_2025,
      source_dataset: 'Sydney Water Annual Report 2024-25',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      extraction_confidence: 'high',
      location: { state: 'NSW' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(347_966_700_000);
    expect(recordFor(result, 'other_income')?.amount_cents).toBe(527_100_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(44_830_600_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(52_100_900_000);
    expect(recordFor(result, 'net_result')?.amount_cents).toBe(37_450_900_000);
    expect(recordFor(result, 'nsw_government_grants_social_programs')).toMatchObject({
      amount_cents: 14_377_300_000,
      funding_source: 'NSW Government',
      potential_double_count: true,
    });
    expect(recordFor(result, 'other_nsw_government_grants')).toMatchObject({
      amount_cents: 37_300_000,
      funding_source: 'NSW Government',
      potential_double_count: true,
    });
    expect(recordFor(result, 'commonwealth_government_grants')).toMatchObject({
      amount_cents: 0,
      funding_source: 'Commonwealth Government',
      potential_double_count: true,
    });
    expect(recordFor(result, 'contribution_nsw_climate_change_fund')).toMatchObject({
      amount_cents: 355_000_000,
      funding_source: 'NSW Government — Climate Change Fund',
      potential_double_count: true,
    });
    expect(result.records).toHaveLength(10);
  });

  it('defers on a one-unit PBT bridge mismatch instead of ingesting', () => {
    const result = parseSydneyWaterExtraction(extraction({ pbtOverride: 535_399 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-unit note total mismatch instead of ingesting', () => {
    const pages = [
      statementPage(),
      revenuePage(),
      financePage(),
      otherExpensesPage({ totalOverride: 2_082_003 }),
    ];
    const result = parseSydneyWaterExtraction({ ...extraction(), pages }, context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/total other expenses in Note 2\(b\)/);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseSydneyWaterExtraction(extraction(), {
      ...context,
      fiscal_year: '2023-24',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Sydney Water natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = sydneyWaterNaturalKey('Sydney Water', '2024-25', 'total_expenses', URL_2025);
    expect(key).toMatch(/^sydney-water:[0-9a-f]{40}$/);
    expect(key).toBe(sydneyWaterNaturalKey('Sydney Water', '2024-25', 'total_expenses', URL_2025));
    expect(key).not.toBe(
      sydneyWaterNaturalKey('Sydney Water', '2024-25', 'total_revenue', URL_2025),
    );
    expect(key).not.toBe(
      sydneyWaterNaturalKey('Sydney Water', '2023-24', 'total_expenses', URL_2025),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseSydneyWaterExtraction(extraction(), context);
    const second = parseSydneyWaterExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Sydney Water no-sum / double-count separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseSydneyWaterExtraction(extraction(), context);
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
  });

  it('flags government-named funding rows but not the own-source revenue/expense rows', () => {
    const result = parseSydneyWaterExtraction(extraction(), context);
    expect(recordFor(result, 'total_revenue')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'total_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'employee_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'net_result')?.potential_double_count).toBe(false);
    const flagged = result.records.filter((record) => record.potential_double_count);
    expect(flagged.map((record) => record.soc_line_item)).toEqual(
      expect.arrayContaining([
        'nsw_government_grants_social_programs',
        'other_nsw_government_grants',
        'commonwealth_government_grants',
        'contribution_nsw_climate_change_fund',
      ]),
    );
  });
});
