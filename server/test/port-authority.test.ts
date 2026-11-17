import { describe, expect, it } from 'vitest';
import {
  detectPortAuthorityUnit,
  parsePortAuthorityAnnualReportPdfLinks,
  parsePortAuthorityExpensesNote,
  parsePortAuthorityExtraction,
  parsePortAuthorityRevenueNote,
  parsePortAuthorityStatement,
  portAuthorityFiscalYearFromReportYear,
  portAuthorityNaturalKey,
  PORT_AUTHORITY_ID,
  type PortAuthorityParseContext,
} from '../src/connectors/soc/nsw/port-authority.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.portauthoritynsw.com.au/sites/default/files/2025-12/Port%20Authority%20of%20NSW%20Annual%20Report%202024-25.pdf';

function item(str: string, x: number, y: number, page = 1, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 1): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const STATEMENT_RIGHTS = [490, 555];

interface RowSpec {
  label?: string;
  values?: Array<number | null>;
}

function numberCell(value: number): string {
  const text = Math.abs(value).toLocaleString('en-AU');
  return value < 0 ? `(${text})` : text;
}

function statementPage(
  options: {
    unit?: string;
    pbtOverride?: number;
    totalExpensesOverride?: number;
    includeGrantsProse?: boolean;
  } = {},
): PdfPage {
  const unit = options.unit ?? '$000';
  const pageNumber = 47;
  const items: PdfTextItem[] = [
    item('Statement of comprehensive income', 45, 717, pageNumber),
    item('For the year ended 30 June 2025', 48, 701, pageNumber),
    item('Continuing operations', 48, 662, pageNumber),
    item('Note', 407, 662, pageNumber),
    item('2025', 471, 671, pageNumber),
    item(unit, 471, 662, pageNumber),
    item('2024', 536, 671, pageNumber),
    item(unit, 536, 662, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Revenue from port management', values: [176_929, 168_944] },
    { label: 'Investment revenue', values: [41_353, 37_474] },
    { label: 'Other revenue', values: [19_972, 21_201] },
    { label: 'Total revenue', values: [238_254, 227_619] },
    { label: 'Employee related expenses', values: [96_061, 86_979] },
    { label: 'Depreciation and amortisation expenses', values: [21_650, 20_559] },
    { label: 'Other expenses', values: [65_562, 65_003] },
    { label: 'Finance costs', values: [7_680, 6_398] },
    {
      label: 'Total expenses',
      values: [options.totalExpensesOverride ?? 190_953, 178_939],
    },
    { label: 'Net gain on sale of property, plant and equipment (PPE)', values: [82, 318] },
    { label: 'Other gains', values: [577, 1_860] },
    {
      label: 'Profit before income tax equivalent expense',
      values: [options.pbtOverride ?? 47_960, 50_858],
    },
    { label: 'Income tax equivalent expense', values: [-11_665, -12_751] },
    { label: 'Net profit after tax for the year', values: [36_295, 38_107] },
  ];
  let y = 633;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 48, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      const right = STATEMENT_RIGHTS[index];
      if (right === undefined) return;
      if (typeof value === 'number') items.push(money(numberCell(value), right, y, pageNumber));
    });
    y -= 10;
  }
  if (options.includeGrantsProse) {
    // Real prose says "$196.9 million"; only the "$000" header cell is a unit.
    items.push(
      item(
        'During the year, $196.9 million in revenue was recognised from customers.',
        48,
        400,
        pageNumber,
      ),
    );
  }
  return {
    page_number: pageNumber,
    text:
      'Statement of comprehensive income For the year ended 30 June 2025 Revenue from port management Investment revenue Other revenue Total revenue Employee related expenses Depreciation and amortisation expenses Other expenses Finance costs Total expenses Net gain on sale of property, plant and equipment (PPE) Other gains Profit before income tax equivalent expense Income tax equivalent expense Net profit after tax for the year' +
      (options.includeGrantsProse
        ? ' During the year, $196.9 million in revenue was recognised from customers.'
        : ''),
    items,
  };
}

function notePage(
  pageNumber: number,
  title: string,
  totalLabel: string,
  total: number,
  text: string,
  unit = '$000',
): PdfPage {
  const items: PdfTextItem[] = [
    item(title, 48, 697, pageNumber),
    item('2025', 471, 671, pageNumber),
    item(unit, 471, 662, pageNumber),
    item('2024', 536, 671, pageNumber),
    item(unit, 536, 662, pageNumber),
    item(totalLabel, 48, 600, pageNumber),
    money(numberCell(total), 490, 600, pageNumber),
    money(numberCell(total - 1_000), 555, 600, pageNumber),
  ];
  return { page_number: pageNumber, text, items };
}

function revenuePage(options: { totalOverride?: number; unit?: string } = {}): PdfPage {
  return notePage(
    53,
    'Note 3. Revenue',
    'Total revenue',
    options.totalOverride ?? 238_254,
    'Note 3. Revenue Continuing operations Revenue from port management Total revenue 238,254 227,619',
    options.unit,
  );
}

function expensesPage(options: { totalOverride?: number; unit?: string } = {}): PdfPage {
  return notePage(
    55,
    'Note 4. Expenses',
    'Total expenses',
    options.totalOverride ?? 190_953,
    'Note 4. Expenses Continuing operations Employee related expenses Total expenses 190,953 178,939',
    options.unit,
  );
}

function extraction(
  options: {
    statement?: Parameters<typeof statementPage>[0];
    revenue?: Parameters<typeof revenuePage>[0];
    expenses?: Parameters<typeof expensesPage>[0];
    includeRevenue?: boolean;
    includeExpenses?: boolean;
  } = {},
): PdfExtraction {
  const pages = [statementPage(options.statement)];
  if (options.includeRevenue !== false) pages.push(revenuePage(options.revenue));
  if (options.includeExpenses !== false) pages.push(expensesPage(options.expenses));
  return {
    source: { url: PDF_URL, sha256: 'p'.repeat(64), bytes: 14_911_040 },
    pages,
    text: 'Statement of comprehensive income for the year ended 30 June 2025',
    tables: [],
    warnings: [],
  };
}

const context: PortAuthorityParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2024–25',
  fiscal_year: '2024-25',
  archive: {
    local_path: '/archive/port-authority-nsw/Port-Authority-of-NSW-Annual-Report-2024-25.pdf',
    sha256: 'p'.repeat(64),
    bytes: 14_911_040,
  },
  source_date: '2026-11-17',
};

function recordFor(result: ReturnType<typeof parsePortAuthorityExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Port Authority of NSW annual-report discovery', () => {
  it('selects the latest annual-report PDF and ignores the statement of corporate intent', () => {
    const pageHtml = `
      <a href="/sites/default/files/2025-03/port-authority-annual-report-2021.pdf">2020-21</a>
      <a href="/sites/default/files/2025-03/port-authority-annual-report-2022.pdf">2021-22</a>
      <a href="/sites/default/files/2025-03/port-authority_ar23_final.pdf">2022-23</a>
      <a href="/sites/default/files/2025-03/3693_port-authority_ar24_final-v2-15-november-2024.pdf">2023-24</a>
      <a href="/sites/default/files/2025-12/Port%20Authority%20of%20NSW%20Annual%20Report%202024-25.pdf">2024-25</a>
      <a href="/sites/default/files/2025-12/Port%20Authority%20of%20NSW%20Statement%20of%20Corporate%20Intent%202025-26.pdf">SCI</a>`;
    const links = parsePortAuthorityAnnualReportPdfLinks(
      pageHtml,
      'https://www.portauthoritynsw.com.au/corporate/corporate-governance/port-authority-nsw-annual-reports/',
    );
    expect(links[0]).toMatchObject({ fiscal_year: '2024-25', url: PDF_URL });
    expect(links.map((link) => link.fiscal_year)).toEqual([
      '2024-25',
      '2023-24',
      '2022-23',
      '2021-22',
      '2020-21',
    ]);
    expect(links.some((link) => /Corporate%20Intent|Corporate Intent/i.test(link.url))).toBe(false);
  });

  it('maps a report year to the API fiscal year', () => {
    expect(portAuthorityFiscalYearFromReportYear(2025)).toBe('2024-25');
    expect(portAuthorityFiscalYearFromReportYear(2007)).toBe('2006-07');
  });
});

describe("Port Authority of NSW $'000 guard", () => {
  it('detects an explicit thousands unit and rejects dollars/millions', () => {
    const unit = detectPortAuthorityUnit(['$000']);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const dollars = parsePortAuthorityStatement(statementPage({ unit: '$' }));
    expect(dollars?.unit.kind).toBe('dollars');
    expect(dollars?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const millions = parsePortAuthorityExtraction(
      extraction({ statement: { unit: '$M' } }),
      context,
    );
    expect(millions.records).toHaveLength(0);
    expect(millions.deferral?.phase).toBe('unit');
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parsePortAuthorityExtraction(extraction({ statement: { unit: '' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('does not flip to millions because the statement narrative says "$196.9 million"', () => {
    const result = parsePortAuthorityExtraction(
      extraction({ statement: { includeGrantsProse: true } }),
      context,
    );
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
  });
});

describe('Port Authority of NSW exact reconciliation and rows', () => {
  it('reconciles printed totals, components and every bridge exactly', () => {
    const result = parsePortAuthorityExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(238_254);
    expect(result.statement?.total_expenses).toBe(190_953);
    expect(result.statement?.profit_before_tax).toBe(47_960);
    expect(result.statement?.net_result).toBe(36_295);
    expect(result.checks.join(' ')).toContain(
      'total-revenue bridge exact: 176929 + 41353 + 19972 = 238254',
    );
    expect(result.checks.join(' ')).toContain(
      'total-expenses bridge exact: 96061 + 21650 + 65562 + 7680 = 190953',
    );
    expect(result.checks.join(' ')).toContain(
      'profit-before-tax bridge exact: 238254 - 190953 + 82 + 577 = 47960',
    );
    expect(result.checks.join(' ')).toContain('net-result bridge exact: 47960 + (-11665) = 36295');
    expect(result.checks.join(' ')).toContain(
      'Note 3 Total revenue exact: 238254 = statement Total revenue 238254',
    );
    expect(result.checks.join(' ')).toContain(
      'Note 4 Total expenses exact: 190953 = statement Total expenses 190953',
    );
  });

  it('maps the five required lines with provenance, exact cents and no verified claim', () => {
    const result = parsePortAuthorityExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 19_095_300_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'Port Authority of NSW',
      funding_source: 'Port Authority of NSW',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: PORT_AUTHORITY_ID,
      source_url: PDF_URL,
      source_dataset: 'Port Authority of NSW Annual Report 2024-25',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      extraction_confidence: 'high',
      location: { state: 'NSW' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(23_825_400_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(9_606_100_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(2_165_000_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 3_629_500_000,
      soc_printed_sign: 'positive',
    });
    expect(recordFor(result, 'government_grants')).toBeUndefined();
    expect(result.records.every((record) => record.verified === false)).toBe(true);
    expect(recordFor(result, 'total_expenses')?.notes).toContain('human_spot_check: required');
    expect(recordFor(result, 'net_result')?.notes).toContain('human_spot_check: required');
    expect(recordFor(result, 'total_revenue')?.notes).toContain(
      'no government grants/contributions are separately disclosed',
    );
  });

  it('defers on a one-thousand profit-before-tax mismatch instead of ingesting', () => {
    const result = parsePortAuthorityExtraction(
      extraction({ statement: { pbtOverride: 47_961 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand total-expenses mismatch instead of ingesting', () => {
    const result = parsePortAuthorityExtraction(
      extraction({ statement: { totalExpensesOverride: 190_954 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when a note total does not reconcile to the face statement', () => {
    const revenue = parsePortAuthorityExtraction(
      extraction({ revenue: { totalOverride: 238_255 } }),
      context,
    );
    expect(revenue.records).toHaveLength(0);
    expect(revenue.deferral?.phase).toBe('reconciliation');
    expect(revenue.deferral?.reason).toMatch(/Note 3 Total revenue mismatch/);

    const expenses = parsePortAuthorityExtraction(
      extraction({ expenses: { totalOverride: 190_952 } }),
      context,
    );
    expect(expenses.records).toHaveLength(0);
    expect(expenses.deferral?.phase).toBe('reconciliation');
    expect(expenses.deferral?.reason).toMatch(/Note 4 Total expenses mismatch/);
  });

  it('defers when a note table is missing or has a non-thousands unit', () => {
    const missing = parsePortAuthorityExtraction(extraction({ includeRevenue: false }), context);
    expect(missing.records).toHaveLength(0);
    expect(missing.deferral?.phase).toBe('notes');

    const unit = parsePortAuthorityExtraction(extraction({ expenses: { unit: '$M' } }), context);
    expect(unit.records).toHaveLength(0);
    expect(unit.deferral?.phase).toBe('unit');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parsePortAuthorityExtraction(extraction(), {
      ...context,
      fiscal_year: '2023-24',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });

  it('parses the Note 3 and Note 4 printed totals directly', () => {
    const revenue = parsePortAuthorityRevenueNote(revenuePage());
    expect(revenue.unit.kind).toBe('thousands');
    expect(revenue.total_revenue).toBe(238_254);

    const expenses = parsePortAuthorityExpensesNote(expensesPage());
    expect(expenses.unit.kind).toBe('thousands');
    expect(expenses.total_expenses).toBe(190_953);
  });
});

describe('Port Authority of NSW natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = portAuthorityNaturalKey(
      'Port Authority of NSW',
      '2024-25',
      'total_expenses',
      PDF_URL,
    );
    expect(key).toMatch(/^port-authority-nsw:[0-9a-f]{40}$/);
    expect(key).toBe(
      portAuthorityNaturalKey('Port Authority of NSW', '2024-25', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      portAuthorityNaturalKey('Port Authority of NSW', '2024-25', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      portAuthorityNaturalKey('Port Authority of NSW', '2023-24', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parsePortAuthorityExtraction(extraction(), context);
    const second = parsePortAuthorityExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Port Authority of NSW no-sum / double-count separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parsePortAuthorityExtraction(extraction(), context);
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
  });

  it('flags no row as a potential double count because no grant is separately disclosed', () => {
    const result = parsePortAuthorityExtraction(extraction(), context);
    expect(result.records.every((record) => record.potential_double_count === false)).toBe(true);
    expect(result.records.map((record) => record.soc_line_item)).toEqual([
      'total_revenue',
      'total_expenses',
      'employee_expenses',
      'depreciation_amortisation',
      'net_result',
    ]);
  });
});
