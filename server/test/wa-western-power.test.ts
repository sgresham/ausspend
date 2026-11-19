import { describe, expect, it } from 'vitest';
import {
  WESTERN_POWER_ID,
  detectWesternPowerUnit,
  discoverWesternPowerAnnualReport,
  parseWesternPowerAnnualReportPdfLinks,
  parseWesternPowerExtraction,
  parseWesternPowerStatement,
  westernPowerFiscalYearFromFilename,
  westernPowerNaturalKey,
  type WesternPowerParseContext,
} from '../src/connectors/soc/wa/western-power.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.westernpower.com.au/4a8589/siteassets/documents/reports/annual-report/2026-annual-report.pdf';

function item(str: string, x: number, y: number, page = 76, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 76): PdfTextItem {
  const width = Math.max(6, str.length * 4);
  return item(str, right - width, y, page, width);
}

const COLS = [471, 543];

interface RowSpec {
  label: string;
  values: Array<number | string | null>;
  note?: string;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function renderRow(row: RowSpec, pageNumber: number, y: number): PdfTextItem[] {
  const items: PdfTextItem[] = [item(row.label, 77, y, pageNumber)];
  if (row.note) items.push(item(row.note, 364, y, pageNumber));
  row.values.forEach((value, index) => {
    const right = COLS[index] as number;
    if (value === null) return;
    const text =
      typeof value === 'string'
        ? value
        : value < 0
          ? `(${numberCell(Math.abs(value))})`
          : numberCell(value);
    items.push(money(text, right, y, pageNumber));
  });
  return items;
}

interface StatementOptions {
  unit?: string;
  totalIncomeOverride?: number;
  totalExpenseOverride?: number;
  pbtOverride?: number;
  netOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$M';
  const pageNumber = 76;
  const items: PdfTextItem[] = [
    item('Statement of comprehensive income for the year ended 30 June 2026', 43, 792, pageNumber),
    item('2025/26', 437, 748, pageNumber),
    item('2024/25', 508, 766, pageNumber),
    item('restated*', 503, 749, pageNumber),
    item('Notes', 364, 732, pageNumber),
    item(unit, 458, 732, pageNumber),
    item(unit, 529, 732, pageNumber),
    item('Profit or Loss', 54, 715, pageNumber),
    item('Income', 65, 698, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Revenue from rendering of services', values: [2_548, 2_212], note: '4' },
    { label: 'Other income', values: [12, 10], note: '4' },
    {
      label: 'Total income',
      values: [options.totalIncomeOverride ?? 2_560, 2_222],
    },
    { label: 'Expenses', values: [null, null] },
    { label: 'Materials and services', values: [-361, -348] },
    { label: 'Employee related expenses', values: [-290, -276], note: '5' },
    { label: 'Depreciation and amortisation expenses', values: [-592, -510], note: '5' },
    { label: 'Other expenses', values: [-296, -282], note: '5' },
    {
      label: 'Total expense',
      values: [options.totalExpenseOverride ?? -1_539, -1_416],
    },
    { label: 'Net finance costs', values: [-338, -326], note: '6' },
    {
      label: 'Profit before income tax equivalent expense',
      values: [options.pbtOverride ?? 683, 480],
    },
    { label: 'Income tax equivalent expense', values: [-196, -150], note: '7' },
    {
      label: 'Profit for the reporting year, net of tax equivalent expense',
      values: [options.netOverride ?? 487, 330],
    },
  ];
  let y = 681;
  for (const row of rows) {
    items.push(...renderRow(row, pageNumber, y));
    y -= 17;
  }
  return {
    page_number: pageNumber,
    text: `Statement of comprehensive income for the year ended 30 June 2026 2025/26 2024/25 restated* Notes $M $M Profit or Loss Income Revenue from rendering of services Other income Total income Expenses Materials and services Employee related expenses Depreciation and amortisation expenses Other expenses Total expense Net finance costs Profit before income tax equivalent expense Income tax equivalent expense Profit for the reporting year, net of tax equivalent expense`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 65_292_260 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: WesternPowerParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/wa-western-power/Western-Power-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 65_292_260,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseWesternPowerExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Western Power annual-report discovery', () => {
  it('reads PDF URLs embedded in the page JSON and selects the newest annual report', () => {
    const html = `
      <a href="/4a6d9b/siteassets/documents/reports/annual-report/annual-report-2025.pdf">2025</a>
      <a href="/4a8798/siteassets/documents/reports/annual-report/annual-report-2024.pdf">2024</a>
      <script>{"items":[{"title":"Annual Report 2026","size":"65 MB","url":"/4a8589/siteassets/documents/reports/annual-report/2026-annual-report.pdf"},{"title":"Annual Review Factsheet","url":"/4a7169/siteassets/documents/reports/annual-report/fy26-review-factsheet.pdf"}]}</script>`;
    const links = parseWesternPowerAnnualReportPdfLinks(
      html,
      'https://www.westernpower.com.au/about/reports-publications/annual-report/',
    );
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: '2026-annual-report.pdf',
      fiscal_year: '2025-26',
      discovery_page:
        'https://www.westernpower.com.au/about/reports-publications/annual-report/',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.some((link) => /factsheet/i.test(link.filename))).toBe(false);
  });

  it('parses HTML-escaped embedded JSON URLs', () => {
    const html =
      '<div data-config="{&quot;title&quot;:&quot;Annual Report 2026&quot;,&quot;url&quot;:&quot;/4a8589/siteassets/documents/reports/annual-report/2026-annual-report.pdf&quot;}"></div>';
    const links = parseWesternPowerAnnualReportPdfLinks(
      html,
      'https://www.westernpower.com.au/about/reports-publications/annual-report/',
    );
    expect(links[0]?.url).toBe(PDF_URL);
    expect(links[0]?.fiscal_year).toBe('2025-26');
  });

  it('maps year-ended filenames and rejects factsheets', () => {
    expect(westernPowerFiscalYearFromFilename('2026-annual-report.pdf')).toBe('2025-26');
    expect(westernPowerFiscalYearFromFilename('annual-report-2023-20230929.pdf')).toBe(
      '2022-23',
    );
    expect(westernPowerFiscalYearFromFilename('annual-report-2021.pdf')).toBe('2020-21');
    expect(westernPowerFiscalYearFromFilename('fy26-review-factsheet.pdf')).toBeNull();
    expect(westernPowerFiscalYearFromFilename('statement-of-corporate-intent-2025-26.pdf')).toBeNull();
  });

  it('follows the annual-report page and returns its newest PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.westernpower.com.au/about/reports-publications/annual-report/') {
        return new Response(
          `<a href="/4a6d9b/siteassets/documents/reports/annual-report/annual-report-2025.pdf">2025</a><a href="${PDF_URL}">2026</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverWesternPowerAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual([
      'https://www.westernpower.com.au/about/reports-publications/annual-report/',
    ]);
  });
});

describe('Western Power $M unit guard', () => {
  it('detects the printed $M unit at 100,000,000 cents per unit', () => {
    const unit = detectWesternPowerUnit(['$M 2025/26 $M 2024/25']);
    expect(unit.kind).toBe('millions');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000_000);
  });

  it('defers when the printed unit is absent rather than guessing', () => {
    const result = parseWesternPowerExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit millions/i);
  });

  it('rejects a statement read as dollars or thousands instead of $M', () => {
    const thousands = parseWesternPowerStatement(facePage({ unit: "$'000" }));
    expect(thousands?.unit.kind).toBe('thousands');

    const thousandsDeferral = parseWesternPowerExtraction(
      extraction({ unit: "$'000" }),
      context,
    );
    expect(thousandsDeferral.records).toHaveLength(0);
    expect(thousandsDeferral.deferral?.phase).toBe('unit');

    const dollars = parseWesternPowerExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('Western Power exact reconciliation and rows', () => {
  it('reads the current-year column and reconciles every bridge exactly', () => {
    const result = parseWesternPowerExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('millions');
    expect(result.statement?.total_income).toBe(2_560);
    expect(result.statement?.total_expense).toBe(1_539);
    expect(result.statement?.employee_expenses).toBe(290);
    expect(result.statement?.depreciation_amortisation).toBe(592);
    expect(result.statement?.net_finance_costs).toBe(-338);
    expect(result.statement?.profit_before_tax).toBe(683);
    expect(result.statement?.net_result).toBe(487);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'income components exact: 2548 + 12 = 2560 (printed Total income 2560)',
    );
    expect(checks).toContain(
      'expense components exact: 361 + 290 + 592 + 296 = 1539 (printed Total expense 1539)',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: 2560 - 1539 + -338 = 683 (printed 683)',
    );
    expect(checks).toContain('net-result bridge exact: 683 + -196 = 487 (printed 487)');
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseWesternPowerExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 153_900_000_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'WA',
      delivery_entity: 'Western Power',
      funding_source: 'Western Power',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: WESTERN_POWER_ID,
      source_url: PDF_URL,
      source_dataset: 'Western Power Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_millions',
      soc_section: 'expenses',
      soc_note: 'Statement of comprehensive income',
      extraction_confidence: 'high',
      location: { state: 'WA' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(256_000_000_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(29_000_000_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(59_200_000_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 48_700_000_000,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on income/expense component mismatches', () => {
    const income = parseWesternPowerExtraction(
      extraction({ totalIncomeOverride: 2_561 }),
      context,
    );
    expect(income.records).toHaveLength(0);
    expect(income.deferral?.phase).toBe('reconciliation');
    expect(income.deferral?.reason).toMatch(/income component total mismatch/i);

    const expenses = parseWesternPowerExtraction(
      extraction({ totalExpenseOverride: -1_540 }),
      context,
    );
    expect(expenses.records).toHaveLength(0);
    expect(expenses.deferral?.phase).toBe('reconciliation');
    expect(expenses.deferral?.reason).toMatch(/expense component total mismatch/i);
  });

  it('defers on profit-before-tax or net-result mismatches', () => {
    const pbt = parseWesternPowerExtraction(extraction({ pbtOverride: 684 }), context);
    expect(pbt.records).toHaveLength(0);
    expect(pbt.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);

    const net = parseWesternPowerExtraction(extraction({ netOverride: 488 }), context);
    expect(net.records).toHaveLength(0);
    expect(net.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseWesternPowerExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Western Power natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = westernPowerNaturalKey('Western Power', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^wa-western-power:[0-9a-f]{40}$/);
    expect(key).toBe(
      westernPowerNaturalKey('Western Power', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      westernPowerNaturalKey('Western Power', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      westernPowerNaturalKey('Western Power', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseWesternPowerExtraction(extraction(), context);
    const second = parseWesternPowerExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Western Power no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive, WA-only and excluded from the generic spending query', () => {
    const result = parseWesternPowerExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Western Power']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['WA']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(WESTERN_POWER_ID);
      expect(record.potential_double_count).toBe(false);
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
    expect(
      result.records.some((record) => /total.*wa|wa.*total/i.test(record.soc_line_item ?? '')),
    ).toBe(false);
  });
});
