import { describe, expect, it } from 'vitest';
import {
  detectLandcomUnit,
  landcomFiscalYearFromReportYear,
  landcomNaturalKey,
  parseLandcomAnnualReportPdfLinks,
  parseLandcomDepreciationNote,
  parseLandcomEmployeeNote,
  parseLandcomExtraction,
  parseLandcomFinanceNote,
  parseLandcomOtherExpensesNote,
  parseLandcomOtherIncomeNote,
  parseLandcomStatement,
  LANDCOM_ID,
  type LandcomParseContext,
} from '../src/connectors/soc/nsw/landcom.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.landcom.com.au/assets/Uploads/Corporate-Publications/Annual-Reports/2025-Landcom-Annual-Report.pdf';

function item(str: string, x: number, y: number, page = 1, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 1): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const STATEMENT_RIGHTS = [448, 507];
const NOTE_RIGHTS = [448, 507];

interface RowSpec {
  label?: string;
  values?: Array<number | null>;
}

function numberCell(value: number): string {
  const text = Math.abs(value).toLocaleString('en-AU');
  return value < 0 ? `(${text})` : text;
}

function statementPage(
  options: { unit?: string; pbtOverride?: number; costOfSalesOverride?: number } = {},
): PdfPage {
  const unit = options.unit ?? "$'000";
  const pageNumber = 86;
  const items: PdfTextItem[] = [
    item('Statement of Comprehensive Income', 81, 733, pageNumber),
    item('for the year ended 30 June 2025', 81, 720, pageNumber),
    item('Notes', 367, 689, pageNumber),
    item('30 June', 419, 705, pageNumber),
    item('30 June', 480, 705, pageNumber),
    item('2025', 432, 695, pageNumber),
    item('2024', 491, 695, pageNumber),
    item(unit, 430, 675, pageNumber),
    item(unit, 489, 675, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Revenue from contracts with customers', values: [263_423, 282_618] },
    {
      label: 'Cost of sales',
      values: [-(options.costOfSalesOverride ?? 143_085), -157_916],
    },
    { label: 'Gross profit', values: [120_338, 124_702] },
    { label: 'Other income', values: [2_663, 261] },
    { label: 'Finance income', values: [11_101, 13_352] },
    { label: 'Employee related expenses', values: [-29_737, -28_984] },
    { label: 'Other expenses', values: [-29_361, -23_970] },
    { label: 'Depreciation and amortisation expense', values: [-3_040, -2_974] },
    { label: 'Net fair value loss on investment properties', values: [-8_120, null] },
    { label: 'Finance costs', values: [-652, -420] },
    { label: 'Profit before income tax', values: [options.pbtOverride ?? 63_192, 81_967] },
    { label: 'Income tax equivalent expense', values: [-18_959, -24_657] },
    { label: 'Net profit for the year', values: [44_233, 57_310] },
  ];
  let y = 650;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 83, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      const right = STATEMENT_RIGHTS[index];
      if (right === undefined) return;
      if (typeof value === 'number') items.push(money(numberCell(value), right, y, pageNumber));
    });
    y -= 10;
  }
  return {
    page_number: pageNumber,
    text: 'Statement of Comprehensive Income for the year ended 30 June 2025 Revenue from contracts with customers Cost of sales Gross profit Other income Finance income Employee related expenses Other expenses Depreciation and amortisation expense Net fair value loss on investment properties Finance costs Profit before income tax Income tax equivalent expense Net profit for the year',
    items,
  };
}

function noteHeader(pageNumber: number, title: string, unit = "$'000"): PdfTextItem[] {
  return [
    item(title, 81, 697, pageNumber),
    item('30 June', 419, 661, pageNumber),
    item('30 June', 480, 661, pageNumber),
    item('2025', 432, 651, pageNumber),
    item('2024', 491, 651, pageNumber),
    item(unit, 430, 641, pageNumber),
    item(unit, 489, 641, pageNumber),
  ];
}

function notePage(
  pageNumber: number,
  title: string,
  rows: RowSpec[],
  text: string,
  options: { unit?: string } = {},
): PdfPage {
  const items = noteHeader(pageNumber, title, options.unit ?? "$'000");
  let y = 615;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 83, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      const right = NOTE_RIGHTS[index];
      if (right === undefined) return;
      if (typeof value === 'number') items.push(money(numberCell(value), right, y, pageNumber));
    });
    y -= 10;
  }
  return { page_number: pageNumber, text: `${title} ${text}`, items };
}

function otherIncomePage(options: { grantOverride?: number; unit?: string } = {}): PdfPage {
  return notePage(
    95,
    '2.2 Other income',
    [
      { label: 'Grant income', values: [options.grantOverride ?? 2_285, 0] },
      { label: 'Other income', values: [378, 261] },
    ],
    'Grant income Other income',
    options.unit ? { unit: options.unit } : {},
  );
}

function financePage(options: { unit?: string } = {}): PdfPage {
  return notePage(
    96,
    '2.3 Finance income and costs',
    [
      { label: 'Interest from bank', values: [4_978, 8_808] },
      { label: 'Net interest income from discounting adjustments', values: [4_649, 4_168] },
      { label: 'Interest from delayed settlements', values: [794, null] },
      { label: 'Interest on deferred settlement proceeds', values: [680, 376] },
      { label: 'Interest expense from lease liabilities', values: [-652, -420] },
    ],
    'Interest from bank Net interest income from discounting adjustments Interest from delayed settlements Interest on deferred settlement proceeds Interest expense from lease liabilities',
    options.unit ? { unit: options.unit } : {},
  );
}

function employeePage(options: { unit?: string } = {}): PdfPage {
  return notePage(
    96,
    '2.4 Employee related expenses',
    [
      { label: 'Salaries and wages', values: [31_609, 29_676] },
      { label: 'Termination payments', values: [621, 2_095] },
      { label: 'Superannuation – Defined benefit plans', values: [172, 220] },
      { label: 'Superannuation – Defined contribution plans', values: [3_762, 3_367] },
      { label: 'Long service leave', values: [727, 635] },
      { label: 'Annual leave', values: [2_661, 2_537] },
      { label: 'Payroll tax and fringe benefits tax', values: [2_240, 2_093] },
      { label: 'Other employee related expenses', values: [2_176, 2_736] },
      { label: 'Less amounts capitalised', values: [-14_231, -14_375] },
    ],
    'Salaries and wages Termination payments Superannuation Defined benefit plans Defined contribution plans Long service leave Annual leave Payroll tax and fringe benefits tax Other employee related expenses Less amounts capitalised',
    options.unit ? { unit: options.unit } : {},
  );
}

function otherExpensesPage(options: { unit?: string } = {}): PdfPage {
  return notePage(
    97,
    '2.5 Other expenses',
    [
      { label: 'Advertising, marketing and selling expenses', values: [3_344, 2_108] },
      {
        label: 'Auditor’s remuneration – audit of financial statements',
        values: [268, 280],
      },
      { label: 'Operating lease rental expense', values: [824, 845] },
      { label: 'General administrative costs', values: [14_014, 11_531] },
      { label: 'Council rates', values: [1_258, 834] },
      { label: 'Land tax', values: [11_303, 9_221] },
      { label: 'Adjustment of inventory to net realisable value', values: [525, 4_271] },
      { label: 'Project establishment costs', values: [7_034, 2_942] },
      { label: 'Write back inventory previously written off', values: [-185, -143] },
      { label: 'Property and accommodation', values: [100, 172] },
      { label: 'Consultancy fees', values: [363, 421] },
      { label: 'Loss on disposal of property, plant and equipment', values: [60, 29] },
      { label: 'Transfer of capital costs to inventories', values: [-9_547, -8_541] },
    ],
    'Advertising, marketing and selling expenses Auditor remuneration audit of financial statements Operating lease rental expense General administrative costs Council rates Land tax Adjustment of inventory to net realisable value Project establishment costs Write back inventory previously written off Property and accommodation Consultancy fees Loss on disposal of property, plant and equipment Transfer of capital costs to inventories',
    options.unit ? { unit: options.unit } : {},
  );
}

function depreciationPage(options: { unit?: string } = {}): PdfPage {
  return notePage(
    98,
    '2.6 Depreciation and amortisation expense',
    [
      { label: 'Right of use assets', values: [1_727, 1_866] },
      { label: 'Leasehold improvements', values: [194, 45] },
      { label: 'Plant and equipment', values: [421, 387] },
      { label: 'Intangible assets', values: [681, 662] },
      { label: 'Motor vehicles', values: [17, 14] },
    ],
    'Right of use assets Leasehold improvements Plant and equipment Intangible assets Motor vehicles',
    options.unit ? { unit: options.unit } : {},
  );
}

function extraction(
  options: {
    statement?: Parameters<typeof statementPage>[0];
    otherIncome?: Parameters<typeof otherIncomePage>[0];
    finance?: Parameters<typeof financePage>[0];
    employee?: Parameters<typeof employeePage>[0];
    otherExpenses?: Parameters<typeof otherExpensesPage>[0];
    depreciation?: Parameters<typeof depreciationPage>[0];
    includeOtherIncome?: boolean;
    includeFinance?: boolean;
    includeEmployee?: boolean;
    includeOtherExpenses?: boolean;
    includeDepreciation?: boolean;
  } = {},
): PdfExtraction {
  const pages = [statementPage(options.statement)];
  if (options.includeOtherIncome !== false) pages.push(otherIncomePage(options.otherIncome));
  if (options.includeFinance !== false) pages.push(financePage(options.finance));
  if (options.includeEmployee !== false) pages.push(employeePage(options.employee));
  if (options.includeOtherExpenses !== false) pages.push(otherExpensesPage(options.otherExpenses));
  if (options.includeDepreciation !== false) pages.push(depreciationPage(options.depreciation));
  return {
    source: { url: PDF_URL, sha256: 'l'.repeat(64), bytes: 11_626_511 },
    pages,
    text: 'Statement of Comprehensive Income for the year ended 30 June 2025',
    tables: [],
    warnings: [],
  };
}

const context: LandcomParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2024–25',
  fiscal_year: '2024-25',
  archive: {
    local_path: '/archive/landcom/2025-Landcom-Annual-Report.pdf',
    sha256: 'l'.repeat(64),
    bytes: 11_626_511,
  },
  source_date: '2026-11-17',
};

function recordFor(result: ReturnType<typeof parseLandcomExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Landcom annual-report discovery', () => {
  it('selects the latest annual-report PDF and ignores sustainability/corporate-intent PDFs', () => {
    const pageHtml = `
      <a href="/assets/Uploads/Corporate-Publications/Annual-Reports/2024-Annual-Report.pdf">2023-24</a>
      <a href="/assets/Uploads/Corporate-Publications/Annual-Reports/2025-Landcom-Annual-Report.pdf">2024-25</a>
      <a href="/assets/Uploads/Corporate-Publications/Annual-Sustainability-Reports/2025-Sustainability-Report.pdf">Sustainability</a>
      <a href="/assets/Uploads/Corporate-Publications/Statement-of-Corporate-Intent/Statement-of-Corporate-Intent-FY25-26.pdf">SCI</a>
      <a href="/assets/Uploads/Corporate-Publications/Annual-Reports/2013-UGNSW-AnnualReport.pdf">2012-13</a>`;
    const links = parseLandcomAnnualReportPdfLinks(
      pageHtml,
      'https://www.landcom.com.au/about-us/corporate-publications',
    );
    expect(links[0]).toMatchObject({ fiscal_year: '2024-25', url: PDF_URL });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24', '2012-13']);
    expect(links.some((link) => /sustainability|corporate-intent/i.test(link.filename))).toBe(
      false,
    );
  });

  it('maps a report year to the API fiscal year', () => {
    expect(landcomFiscalYearFromReportYear(2025)).toBe('2024-25');
    expect(landcomFiscalYearFromReportYear(2007)).toBe('2006-07');
  });
});

describe('Landcom $’000 guard', () => {
  it('detects an explicit thousands unit and rejects dollars/millions', () => {
    const unit = detectLandcomUnit(["$'000 2025 $'000 2024"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const dollars = parseLandcomStatement(statementPage({ unit: '$' }));
    expect(dollars?.unit.kind).toBe('dollars');
    expect(dollars?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const millions = parseLandcomExtraction(extraction({ statement: { unit: '$M' } }), context);
    expect(millions.records).toHaveLength(0);
    expect(millions.deferral?.phase).toBe('unit');
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseLandcomExtraction(extraction({ statement: { unit: '' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('does not flip to millions because a note narrative says "$2.3 million"', () => {
    // The real Note 2.2 prose says "$2.3 million"; only the $'000 header cell is a unit.
    const page = otherIncomePage();
    page.items.push(
      item(
        'During the year the Corporation recognised grant income of $2.3 million (2024: $nil)',
        83,
        500,
        page.page_number,
      ),
    );
    page.text += ' During the year the Corporation recognised grant income of $2.3 million.';
    const note = parseLandcomOtherIncomeNote(page);
    expect(note.unit.kind).toBe('thousands');
    expect(note.grant_income).toBe(2_285);
  });
});

describe('Landcom exact reconciliation and rows', () => {
  it('derives total revenue and total expenses and reconciles every bridge exactly', () => {
    const result = parseLandcomExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(277_187);
    expect(result.statement?.total_expenses).toBe(213_995);
    expect(result.statement?.profit_before_tax).toBe(63_192);
    expect(result.statement?.net_result).toBe(44_233);
    expect(result.checks.join(' ')).toContain(
      'profit-before-tax bridge exact: 277187 + (213995) = 63192',
    );
    expect(result.checks.join(' ')).toContain(
      'expense lines exact: (-143085) + (-29737) + (-29361) + (-3040) + (-8120) + (-652) = (213995)',
    );
    expect(result.checks.join(' ')).toContain('Note 2.2 Other income exact: 2285 + 378 = 2663');
    expect(result.checks.join(' ')).toContain(
      'Note 2.4 Employee related expenses exact: gross 43968 less capitalised -14231 = 29737',
    );
    expect(result.checks.join(' ')).toContain(
      'Note 2.5 Other expenses exact: gross 38908 less transfer to inventories -9547 = 29361',
    );
    expect(result.checks.join(' ')).toContain(
      'Note 2.6 Depreciation and amortisation exact: 1727 + 194 + 421 + 681 + 17 = 3040',
    );
  });

  it('maps the six required lines with provenance, exact cents and no verified claim', () => {
    const result = parseLandcomExtraction(extraction(), context);
    expect(result.records).toHaveLength(6);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 21_399_500_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'Landcom',
      funding_source: 'Landcom',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: LANDCOM_ID,
      source_url: PDF_URL,
      source_dataset: 'Landcom Annual Report 2024-25',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      extraction_confidence: 'high',
      location: { state: 'NSW' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(27_718_700_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(2_973_700_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(304_000_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 4_423_300_000,
      soc_printed_sign: 'positive',
    });
    expect(recordFor(result, 'government_grants')).toMatchObject({
      amount_cents: 228_500_000,
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
    });
    expect(result.records.every((record) => record.verified === false)).toBe(true);
    expect(recordFor(result, 'total_expenses')?.notes).toContain('human_spot_check: required');
    expect(recordFor(result, 'net_result')?.notes).toContain('human_spot_check: required');
  });

  it('defers on a one-thousand profit-before-tax mismatch instead of ingesting', () => {
    const result = parseLandcomExtraction(
      extraction({ statement: { pbtOverride: 63_193 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand cost-of-sales mismatch instead of ingesting', () => {
    const result = parseLandcomExtraction(
      extraction({ statement: { costOfSalesOverride: 143_086 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when Note 2.2 grants do not reconcile to Other income', () => {
    const result = parseLandcomExtraction(
      extraction({ otherIncome: { grantOverride: 2_286 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 2.2 Other income mismatch/);
  });

  it('defers when the Note 2.2 table is missing', () => {
    const result = parseLandcomExtraction(extraction({ includeOtherIncome: false }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('notes');
  });

  it('defers when a note table has a non-thousands unit', () => {
    const result = parseLandcomExtraction(extraction({ depreciation: { unit: '$M' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseLandcomExtraction(extraction(), { ...context, fiscal_year: '2023-24' });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });

  it('parses the Note 2.2/2.3/2.4/2.5/2.6 tables directly', () => {
    const otherIncome = parseLandcomOtherIncomeNote(otherIncomePage());
    expect(otherIncome.unit.kind).toBe('thousands');
    expect(otherIncome.grant_income).toBe(2_285);
    expect(otherIncome.other_income).toBe(378);

    const finance = parseLandcomFinanceNote(financePage());
    expect(finance.finance_income).toBe(11_101);
    expect(finance.finance_costs).toBe(-652);

    const employee = parseLandcomEmployeeNote(employeePage());
    expect(employee.gross_employee_expenses).toBe(43_968);
    expect(employee.net_employee_expenses).toBe(29_737);

    const otherExpenses = parseLandcomOtherExpensesNote(otherExpensesPage());
    expect(otherExpenses.gross_other_expenses).toBe(38_908);
    expect(otherExpenses.net_other_expenses).toBe(29_361);

    const depreciation = parseLandcomDepreciationNote(depreciationPage());
    expect(depreciation.total_depreciation_amortisation).toBe(3_040);
  });
});

describe('Landcom natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = landcomNaturalKey('Landcom', '2024-25', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^landcom:[0-9a-f]{40}$/);
    expect(key).toBe(landcomNaturalKey('Landcom', '2024-25', 'total_expenses', PDF_URL));
    expect(key).not.toBe(landcomNaturalKey('Landcom', '2024-25', 'total_revenue', PDF_URL));
    expect(key).not.toBe(landcomNaturalKey('Landcom', '2023-24', 'total_expenses', PDF_URL));
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseLandcomExtraction(extraction(), context);
    const second = parseLandcomExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Landcom no-sum / double-count separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseLandcomExtraction(extraction(), context);
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
  });

  it('flags the grant-income row but not the own-source revenue/expense/result rows', () => {
    const result = parseLandcomExtraction(extraction(), context);
    expect(recordFor(result, 'total_revenue')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'total_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'employee_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'depreciation_amortisation')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'net_result')?.potential_double_count).toBe(false);
    const flagged = result.records.filter((record) => record.potential_double_count);
    expect(flagged.map((record) => record.soc_line_item)).toEqual(['government_grants']);
  });
});
