import { describe, expect, it } from 'vitest';
import {
  GLADSTONE_PORTS_ID,
  detectGladstonePortsUnit,
  discoverGladstonePortsAnnualReport,
  gladstonePortsFiscalYearFromFilename,
  gladstonePortsNaturalKey,
  parseGladstonePortsAnnualReportPdfLinks,
  parseGladstonePortsExtraction,
  parseGladstonePortsStatement,
  type GladstonePortsParseContext,
} from '../src/connectors/soc/qld/gladstone-ports.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://gpcl.com.au/wp-content/uploads/2026/09/Gladstone-Ports-Corporation-Annual-Report-2025-26.pdf';

function item(str: string, x: number, y: number, page = 56, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 56): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const CURRENT = 460;
const PRIOR = 516;

interface RowSpec {
  label: string;
  values: Array<number | string | null>;
  note?: string;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function renderRows(
  rows: readonly RowSpec[],
  pageNumber: number,
  startY: number,
  step = 14,
  labelX = 43,
  noteX = 387,
): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  let y = startY;
  for (const row of rows) {
    items.push(item(row.label, labelX, y, pageNumber));
    if (row.note) items.push(item(row.note, noteX, y, pageNumber));
    row.values.forEach((value, index) => {
      const right = index === 0 ? CURRENT : PRIOR;
      if (value === null) return;
      const text =
        typeof value === 'string'
          ? value
          : value < 0
            ? `(${numberCell(Math.abs(value))})`
            : numberCell(value);
      items.push(money(text, right, y, pageNumber));
    });
    y -= step;
  }
  return items;
}

interface StatementOptions {
  unit?: string;
  pbtOverride?: number;
  netOverride?: number;
  noteTotalOverride?: number;
  totalRevenueOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$’000';
  const pageNumber = 56;
  const header: PdfTextItem[] = [
    item('Consolidated Statement of Profit or Loss and Other Comprehensive Income', 43, 755, pageNumber),
    item('for the year ended 30 June 2026', 43, 736, pageNumber),
    item('Note', 383, 709, pageNumber),
    item('2026', 439, 709, pageNumber),
    item('2025', 496, 709, pageNumber),
    item(unit, 437, 696, pageNumber),
    item(unit, 494, 696, pageNumber),
  ];
  const rows: RowSpec[] = [
    {
      label: 'Revenue from contracts with customers',
      values: [605_164, 580_361],
      note: '6(a)',
    },
    { label: 'Other income', values: [69_004, 59_072], note: '6(b)' },
    {
      label: 'Total revenue and other income',
      values: [options.totalRevenueOverride ?? 674_168, 639_433],
    },
    { label: 'Employee benefits expenses', values: [-178_914, -182_846], note: '6(d)' },
    { label: 'Operational expenses', values: [-158_697, -155_631], note: '6(c)' },
    { label: 'Depreciation/amortisation expenses', values: [-107_741, -90_054], note: '6(c)' },
    { label: 'Finance costs', values: [-34_563, -31_012], note: '6(c)' },
    { label: 'Impairment', values: [-326, -3_746], note: '12(a),(d)' },
    { label: 'Reversal of prior impairment', values: [216, 620], note: '12(d)' },
    { label: 'Net profit / (Loss) on disposal of non-current assets', values: [-911, -652] },
    {
      label:
        'Fair value revaluation increase / (decrease) of property, plant and equipment',
      values: [2_791, 26_945],
      note: '12(c)',
    },
    {
      label: 'Revaluation increase of investment properties',
      values: [8_291, 8_993],
      note: '14',
    },
    {
      label: 'Profit before income tax',
      values: [options.pbtOverride ?? 204_314, 212_050],
    },
    { label: 'Income tax expense', values: [-61_289, -63_398], note: '7(a)' },
    { label: 'Profit for the year', values: [options.netOverride ?? 143_025, 148_652] },
  ];
  const items = [...header, ...renderRows(rows, pageNumber, 681)];
  return {
    page_number: pageNumber,
    text: `Consolidated Financial Statements 13 Consolidated Statement of Profit or Loss and Other Comprehensive Income for the year ended 30 June 2026 Note 2026 2025 $’000 $’000 Revenue from contracts with customers Other income Total revenue and other income Employee benefits expenses Operational expenses Depreciation/amortisation expenses Finance costs Impairment Reversal of prior impairment Net profit / (Loss) on disposal of non-current assets Fair value revaluation increase / (decrease) of property, plant and equipment Revaluation increase of investment properties Profit before income tax Income tax expense Profit for the year`,
    items,
  };
}

function tocPage(): PdfPage {
  return {
    page_number: 46,
    text: `Consolidated Financial Statements 3 Table of Contents Consolidated Statement of Profit or Loss and Other Comprehensive Income 13 for the year ended 30 June 2026 Profit before income tax 21 Taxation 24`,
    items: [
      item('Consolidated Statement of Profit or Loss and Other Comprehensive Income', 43, 700, 46),
      item('for the year ended 30 June 2026', 43, 680, 46),
      item('Profit before income tax', 43, 400, 46),
      item('21', 500, 400, 46),
    ],
  };
}

function notePage(options: StatementOptions = {}): PdfPage {
  const unit = '$’000';
  const pageNumber = 66;
  const header: PdfTextItem[] = [
    item('(d)', 43, 662, pageNumber),
    item('Employee benefits expenses', 63, 662, pageNumber),
    item('2026', 444, 639, pageNumber),
    item('2025', 504, 639, pageNumber),
    item(unit, 441, 627, pageNumber),
    item(unit, 502, 627, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Wages and salaries', values: [128_158, 136_452] },
    { label: 'Annual leave expense', values: [7_811, 10_385] },
    { label: 'Personal leave expense', values: [5_064, 3_502] },
    { label: 'Long service leave expense', values: [1_953, 256] },
    { label: 'Employer superannuation contributions', values: [16_783, 16_817] },
    { label: 'Employer defined benefits contribution', values: [1_886, 1_630] },
    { label: 'Other employee benefits', values: [2_839, 1_593] },
    { label: 'Workers compensation premium', values: [1_688, 1_446] },
    { label: 'Payroll tax expense', values: [8_307, 7_181] },
    { label: 'Other employee related expenses', values: [4_425, 3_584] },
    {
      label: 'Total',
      values: [options.noteTotalOverride ?? 178_914, 182_846],
    },
  ];
  const items = [...header, ...renderRows(rows, pageNumber, 614, 14, 85, 380)];
  return {
    page_number: pageNumber,
    text: `6. Profit before income tax (continued) (d) Employee benefits expenses 2026 2025 Employee benefits $’000 $’000 Wages and salaries Annual leave expense Personal leave expense Long service leave expense Employer superannuation contributions Employer defined benefits contribution Other employee benefits Workers compensation premium Payroll tax expense Other employee related expenses Total`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 29_631_105 },
    pages: [tocPage(), facePage(options), notePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: GladstonePortsParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/qld-gladstone-ports/Gladstone-Ports-Corporation-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 29_631_105,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseGladstonePortsExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Gladstone Ports annual-report discovery', () => {
  it('selects the newest annual report and rejects non-annual publications', () => {
    const html = `
      <a href="https://gpcl.com.au/wp-content/uploads/2025/09/GPC-Annual-Report-2024-25_compliant-version-with-omitted-pages-incorporated.pdf">2024-25</a>
      <a href="${PDF_URL}">2025-26</a>
      <a href="https://gpcl.com.au/wp-content/uploads/2026/09/GPC-Sustainability-Report-2025-26.pdf">Sustainability</a>`;
    const links = parseGladstonePortsAnnualReportPdfLinks(
      html,
      'https://gpcl.com.au/who-we-are/corporate-governance/reports/',
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: 'Gladstone-Ports-Corporation-Annual-Report-2025-26.pdf',
      discovery_page: 'https://gpcl.com.au/who-we-are/corporate-governance/reports/',
    });
    expect(links.some((link) => /Sustainability/i.test(link.filename))).toBe(false);
  });

  it('maps filename year spans and rejects a non-consecutive span', () => {
    expect(
      gladstonePortsFiscalYearFromFilename('Gladstone-Ports-Corporation-Annual-Report-2025-26.pdf'),
    ).toBe('2025-26');
    expect(
      gladstonePortsFiscalYearFromFilename(
        'GPC-Annual-Report-2024-25_compliant-version-with-omitted-pages-incorporated.pdf',
      ),
    ).toBe('2024-25');
    expect(
      gladstonePortsFiscalYearFromFilename('Gladstone-Ports-Corporation-Annual-Report-2025-27.pdf'),
    ).toBeNull();
    expect(
      gladstonePortsFiscalYearFromFilename('GPC-Sustainability-Report-2025-26.pdf'),
    ).toBeNull();
  });

  it('follows the reports page and returns its newest annual-report PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://gpcl.com.au/who-we-are/corporate-governance/reports/') {
        return new Response(
          `<a href="https://gpcl.com.au/wp-content/uploads/2025/09/GPC-Annual-Report-2024-25_compliant-version-with-omitted-pages-incorporated.pdf">2024-25</a><a href="${PDF_URL}">2025-26</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverGladstonePortsAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual([
      'https://gpcl.com.au/who-we-are/corporate-governance/reports/',
    ]);
  });
});

describe('Gladstone Ports $000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per unit', () => {
    const unit = detectGladstonePortsUnit(['$’000 2026 $’000 2025']);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseGladstonePortsExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parseGladstonePortsStatement(facePage({ unit: '$m' }), notePage());
    expect(millions?.unit.kind).toBe('millions');
    expect(millions?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const dollars = parseGladstonePortsExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('Gladstone Ports exact reconciliation and rows', () => {
  it('ignores the table-of-contents page and parses the real face statement', () => {
    const result = parseGladstonePortsExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.pages_used).toEqual([56, 66]);
  });

  it('derives total expenses and reconciles the printed revenue and profit bridges exactly', () => {
    const result = parseGladstonePortsExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.note_unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(674_168);
    expect(result.statement?.total_expenses).toBe(481_152);
    expect(result.statement?.profit_before_tax).toBe(204_314);
    expect(result.statement?.net_result).toBe(143_025);
    expect(result.statement?.employee_benefits).toBe(178_914);
    expect(result.statement?.note_total_employee_benefits).toBe(178_914);
    expect(result.statement?.depreciation_amortisation).toBe(107_741);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'total revenue and other income bridge exact: 605164 + 69004 = 674168 (printed 674168)',
    );
    expect(checks).toContain(
      'total expenses exact: 178914 + 158697 + 107741 + 34563 + 326 + 911 = 481152',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: 674168 - 481152 + 216 + 2791 + 8291 = 204314 (printed 204314)',
    );
    expect(checks).toContain('net-result bridge exact: 204314 + -61289 = 143025 (printed 143025)');
    expect(checks).toContain(
      'Note 6(d) Total employee benefits equals face Employee benefits expenses: 178914',
    );
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseGladstonePortsExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 48_115_200_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'QLD',
      delivery_entity: 'Gladstone Ports Corporation Limited',
      funding_source: 'Gladstone Ports Corporation Limited',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: GLADSTONE_PORTS_ID,
      source_url: PDF_URL,
      source_dataset: 'Gladstone Ports Corporation Limited Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Face statement / Note 6(d)',
      extraction_confidence: 'high',
      location: { state: 'QLD' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(67_416_800_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(17_891_400_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(10_774_100_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 14_302_500_000,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on a one-thousand profit-before-tax mismatch instead of ingesting', () => {
    const result = parseGladstonePortsExtraction(extraction({ pbtOverride: 204_315 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand total-revenue bridge mismatch instead of ingesting', () => {
    const result = parseGladstonePortsExtraction(
      extraction({ totalRevenueOverride: 674_169 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/total revenue and other income bridge mismatch/i);
  });

  it('defers when Note 6(d) employee benefits do not equal the face line', () => {
    const result = parseGladstonePortsExtraction(
      extraction({ noteTotalOverride: 178_915 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 6\(d\) employee-benefits mismatch/i);
  });

  it('defers when the net-result bridge does not reconcile', () => {
    const result = parseGladstonePortsExtraction(extraction({ netOverride: 143_026 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseGladstonePortsExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Gladstone Ports natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = gladstonePortsNaturalKey(
      'Gladstone Ports Corporation Limited',
      '2025-26',
      'total_expenses',
      PDF_URL,
    );
    expect(key).toMatch(/^qld-gladstone-ports:[0-9a-f]{40}$/);
    expect(key).toBe(
      gladstonePortsNaturalKey(
        'Gladstone Ports Corporation Limited',
        '2025-26',
        'total_expenses',
        PDF_URL,
      ),
    );
    expect(key).not.toBe(
      gladstonePortsNaturalKey(
        'Gladstone Ports Corporation Limited',
        '2025-26',
        'total_revenue',
        PDF_URL,
      ),
    );
    expect(key).not.toBe(
      gladstonePortsNaturalKey(
        'Gladstone Ports Corporation Limited',
        '2024-25',
        'total_expenses',
        PDF_URL,
      ),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseGladstonePortsExtraction(extraction(), context);
    const second = parseGladstonePortsExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Gladstone Ports no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseGladstonePortsExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Gladstone Ports Corporation Limited']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['QLD']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(GLADSTONE_PORTS_ID);
      expect(record.potential_double_count).toBe(false);
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
    expect(
      result.records.some((record) => /total.*qld|qld.*total/i.test(record.soc_line_item ?? '')),
    ).toBe(false);
  });
});
