import { describe, expect, it } from 'vitest';
import {
  PORT_OF_TOWNSVILLE_ID,
  detectPortOfTownsvilleUnit,
  discoverPortOfTownsvilleAnnualReport,
  parsePortOfTownsvilleAnnualReportPdfLinks,
  parsePortOfTownsvilleExtraction,
  parsePortOfTownsvilleStatement,
  portOfTownsvilleFiscalYearFromFilename,
  portOfTownsvilleNaturalKey,
  type PortOfTownsvilleParseContext,
} from '../src/connectors/soc/qld/port-of-townsville.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://s3-ap-southeast-2.amazonaws.com/os-data-2/townsville-port-2/bundle13/5826t1739_annual_report_2025-26.pdf';

function item(str: string, x: number, y: number, page = 48, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 48): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const CURRENT = 501;
const PRIOR = 552;

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
  labelX = 40,
  noteX = 422,
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
  totalRevenueOverride?: number;
  totalExpensesOverride?: number;
  operatingOverride?: number;
  netOverride?: number;
  comprehensiveOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$';
  const pageNumber = 48;
  const header: PdfTextItem[] = [
    item('Statement of Profit or Loss and Other Comprehensive Income', 41, 794, pageNumber),
    item('for the year ended 30 June 2026', 42, 778, pageNumber),
    item('Notes', 419, 743, pageNumber),
    item('2026', 471, 743, pageNumber),
    item('2025', 522, 743, pageNumber),
    item(unit, 476, 733, pageNumber),
    item(unit, 527, 733, pageNumber),
  ];
  const rows: RowSpec[] = [
    {
      label: 'Revenue from Contracts with Customers',
      values: [99_855_300, 96_022_818],
      note: '2(A)',
    },
    { label: 'Interest Revenue', values: [838_874, 1_041_059] },
    { label: 'Other Revenue', values: [2_151_403, 3_247_683], note: '2(A)' },
    {
      label: 'Fair Value Gains on Investment Properties',
      values: [5_218_195, 1_899_828],
      note: '3(I)',
    },
    {
      label: 'Total Revenue',
      values: [options.totalRevenueOverride ?? 108_063_771, 102_211_389],
    },
    { label: 'Employee Expenses', values: [31_851_679, 30_024_830], note: '2(B)' },
    { label: 'Supplies and Services', values: [30_623_273, 32_558_232], note: '2(B)' },
    {
      label: 'Depreciation and Amortisation Expense',
      values: [15_172_521, 15_492_961],
      note: '2(B)',
    },
    { label: 'Finance Costs', values: [4_147_923, 4_370_257], note: '2(B)' },
    { label: 'Other Expenses', values: [3_679_258, 2_616_294], note: '2(B)' },
    {
      label: 'Total Expenses',
      values: [options.totalExpensesOverride ?? 85_474_655, 85_062_575],
    },
    {
      label: 'OPERATING RESULT BEFORE INCOME TAX EXPENSE',
      values: [options.operatingOverride ?? 22_589_116, 17_148_814],
    },
    { label: 'Income Tax Expense', values: [-6_792_073, -4_550_704], note: '2(C)' },
    {
      label: 'OPERATING RESULT FOR THE YEAR',
      values: [options.netOverride ?? 15_797_044, 12_598_110],
    },
    {
      label: 'Increase/(Decrease) in Revaluation Surplus',
      values: [24_657_584, -135_142_912],
      note: '3(F)',
    },
    {
      label: 'TOTAL COMPREHENSIVE INCOME',
      values: [options.comprehensiveOverride ?? 40_454_628, -122_544_802],
    },
  ];
  const items = [...header, ...renderRows(rows, pageNumber, 710)];
  return {
    page_number: pageNumber,
    text: `Statement of Profit or Loss and Other Comprehensive Income for the year ended 30 June 2026 Notes 2026 2025 $ $ REVENUES Revenue from Contracts with Customers Interest Revenue Other Revenue Fair Value Gains on Investment Properties Total Revenue EXPENSES Employee Expenses Supplies and Services Depreciation and Amortisation Expense Finance Costs Other Expenses Total Expenses OPERATING RESULT BEFORE INCOME TAX EXPENSE Income Tax Expense OPERATING RESULT FOR THE YEAR OTHER COMPREHENSIVE INCOME Increase/(Decrease) in Revaluation Surplus TOTAL COMPREHENSIVE INCOME`,
    items,
  };
}

/** The real FY2025-26 numbers do not reconcile; this fixture does, to prove the row path. */
const RECONCILED: StatementOptions = {
  totalRevenueOverride: 108_063_772,
  totalExpensesOverride: 85_474_654,
  operatingOverride: 22_589_118,
  netOverride: 15_797_045,
  comprehensiveOverride: 40_454_629,
};

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 3_372_376 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: PortOfTownsvilleParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/qld-port-of-townsville/Port-of-Townsville-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 3_372_376,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parsePortOfTownsvilleExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Port of Townsville annual-report discovery', () => {
  it('selects the newest annual report and rejects the SCI and non-annual PDFs', () => {
    const html = `
      <a href="//os-data-2.s3-ap-southeast-2.amazonaws.com/townsville-port-2/bundle13/5825t1353_tabled_annual_report_24-25.pdf">2024-25</a>
      <a href="${PDF_URL}">2025-26</a>
      <a href="https://s3-ap-southeast-2.amazonaws.com/os-data-2/townsville-port-2/bundle13/5826t1740_sci_2025-26.pdf">SCI</a>
      <a href="https://s3-ap-southeast-2.amazonaws.com/os-data-2/townsville-port-2/bundle13/Port-of-Townsville-Sustainability-2025-26.pdf">Sustainability</a>`;
    const links = parsePortOfTownsvilleAnnualReportPdfLinks(
      html,
      'https://www.townsville-port.com.au/media-publications/publications/annual-reports/',
    );
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: '5826t1739_annual_report_2025-26.pdf',
      fiscal_year: '2025-26',
      discovery_page:
        'https://www.townsville-port.com.au/media-publications/publications/annual-reports/',
    });
    expect(links.map((link) => link.fiscal_year)).toContain('2024-25');
    expect(links.some((link) => /_sci_|Sustainability/i.test(link.filename))).toBe(false);
  });

  it('resolves protocol-relative S3 links and maps 2- and 4-digit year spans', () => {
    const html =
      '<a href="//os-data-2.s3-ap-southeast-2.amazonaws.com/townsville-port-2/bundle13/5826t1739_annual_report_2025-26.pdf">PDF</a>';
    const links = parsePortOfTownsvilleAnnualReportPdfLinks(
      html,
      'https://www.townsville-port.com.au/media-publications/publications/annual-reports/',
    );
    expect(links[0]?.url).toBe(
      'https://os-data-2.s3-ap-southeast-2.amazonaws.com/townsville-port-2/bundle13/5826t1739_annual_report_2025-26.pdf',
    );
    expect(portOfTownsvilleFiscalYearFromFilename('5826t1739_annual_report_2025-26.pdf')).toBe(
      '2025-26',
    );
    expect(portOfTownsvilleFiscalYearFromFilename('5825t1353_tabled_annual_report_24-25.pdf')).toBe(
      '2024-25',
    );
    expect(
      portOfTownsvilleFiscalYearFromFilename('5724t2056-889f_annual_report_2023-24.pdf'),
    ).toBe('2023-24');
    expect(
      portOfTownsvilleFiscalYearFromFilename('port_annual_report_18-19_digital-spreads_1.pdf'),
    ).toBe('2018-19');
    expect(portOfTownsvilleFiscalYearFromFilename('5826t1739_annual_report_2025-27.pdf')).toBeNull();
    expect(
      portOfTownsvilleFiscalYearFromFilename('5826t1740_sci_2025-26.pdf'),
    ).toBeNull();
  });

  it('follows the annual-reports page and returns its newest annual-report PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.townsville-port.com.au/media-publications/publications/annual-reports/') {
        return new Response(
          `<a href="//os-data-2.s3-ap-southeast-2.amazonaws.com/townsville-port-2/bundle13/5825t1353_tabled_annual_report_24-25.pdf">2024-25</a><a href="${PDF_URL}">2025-26</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverPortOfTownsvilleAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual([
      'https://www.townsville-port.com.au/media-publications/publications/annual-reports/',
    ]);
  });
});

describe('Port of Townsville printed-unit guard', () => {
  it('detects the printed whole-dollar unit at 100 cents per dollar', () => {
    const unit = detectPortOfTownsvilleUnit(['$ 2026 $ 2025']);
    expect(unit.kind).toBe('dollars');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parsePortOfTownsvilleExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit whole dollars/i);
  });

  it('rejects a statement read as thousands or millions instead of whole dollars', () => {
    const thousands = parsePortOfTownsvilleExtraction(extraction({ unit: "$'000" }), context);
    expect(thousands.records).toHaveLength(0);
    expect(thousands.deferral?.phase).toBe('unit');

    const millions = parsePortOfTownsvilleExtraction(extraction({ unit: '$m' }), context);
    expect(millions.records).toHaveLength(0);
    expect(millions.deferral?.phase).toBe('unit');
    expect(parsePortOfTownsvilleStatement(facePage({ unit: '$m' }))?.unit.kind).toBe('millions');
  });
});

describe('Port of Townsville premise falsifier — real FY2025-26 report', () => {
  it('defers the real printed statement with zero rows and names every $1 gap', () => {
    const result = parsePortOfTownsvilleExtraction(extraction(), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/revenue component total mismatch/i);
    expect(result.deferral?.reason).toMatch(/expense component total mismatch/i);
    expect(result.deferral?.reason).toMatch(/net-result bridge mismatch/i);
    expect(result.statement?.unit.kind).toBe('dollars');
    expect(result.statement?.total_revenue).toBe(108_063_771);
    expect(result.statement?.total_expenses).toBe(85_474_655);
    expect(result.statement?.net_result).toBe(15_797_044);
    expect(result.checks.join(' ')).toContain(
      'revenue components exact: 99855300 + 838874 + 2151403 + 5218195 = 108063772 (printed Total Revenue 108063771)',
    );
    expect(result.checks.join(' ')).toContain(
      'net-result bridge exact: 22589116 + -6792073 = 15797043 (printed 15797044)',
    );
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parsePortOfTownsvilleExtraction(extraction(RECONCILED), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Port of Townsville row path on a reconciled statement', () => {
  it('reconciles every printed bridge and maps the five required lines in cents', () => {
    const result = parsePortOfTownsvilleExtraction(extraction(RECONCILED), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('dollars');
    expect(result.statement?.total_revenue).toBe(108_063_772);
    expect(result.statement?.total_expenses).toBe(85_474_654);
    expect(result.statement?.employee_expenses).toBe(31_851_679);
    expect(result.statement?.depreciation_amortisation).toBe(15_172_521);
    expect(result.statement?.net_result).toBe(15_797_045);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 8_547_465_400,
      jurisdiction_level: 'soc',
      jurisdiction: 'QLD',
      delivery_entity: 'Port of Townsville Limited',
      funding_source: 'Port of Townsville Limited',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: PORT_OF_TOWNSVILLE_ID,
      source_url: PDF_URL,
      source_dataset: 'Port of Townsville Limited Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD',
      soc_section: 'expenses',
      soc_note: 'Face statement',
      extraction_confidence: 'high',
      location: { state: 'QLD' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(10_806_377_200);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(3_185_167_900);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(1_517_252_100);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 1_579_704_500,
      soc_printed_sign: 'positive',
    });
  });
});

describe('Port of Townsville natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = portOfTownsvilleNaturalKey(
      'Port of Townsville Limited',
      '2025-26',
      'total_expenses',
      PDF_URL,
    );
    expect(key).toMatch(/^qld-port-of-townsville:[0-9a-f]{40}$/);
    expect(key).toBe(
      portOfTownsvilleNaturalKey(
        'Port of Townsville Limited',
        '2025-26',
        'total_expenses',
        PDF_URL,
      ),
    );
    expect(key).not.toBe(
      portOfTownsvilleNaturalKey('Port of Townsville Limited', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      portOfTownsvilleNaturalKey('Port of Townsville Limited', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing a reconciled statement yields the same natural keys', () => {
    const first = parsePortOfTownsvilleExtraction(extraction(RECONCILED), context);
    const second = parsePortOfTownsvilleExtraction(extraction(RECONCILED), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Port of Townsville no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parsePortOfTownsvilleExtraction(extraction(RECONCILED), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Port of Townsville Limited']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['QLD']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(PORT_OF_TOWNSVILLE_ID);
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
