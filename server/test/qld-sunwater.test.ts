import { describe, expect, it } from 'vitest';
import {
  SUNWATER_ID,
  detectSunwaterUnit,
  discoverSunwaterAnnualReport,
  parseSunwaterAnnualReportPdfLinks,
  parseSunwaterExtraction,
  parseSunwaterStatement,
  sunwaterFiscalYearFromFilename,
  sunwaterNaturalKey,
  type SunwaterParseContext,
} from '../src/connectors/soc/qld/sunwater.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Sunwater_2025-26_Annual_Report.pdf';

function item(str: string, x: number, y: number, page = 53, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 53): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const CURRENT = 415;
const PRIOR = 515;

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
): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  let y = startY;
  for (const row of rows) {
    items.push(item(row.label, 58, y, pageNumber));
    if (row.note) items.push(item(row.note, 300, y, pageNumber));
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
  const pageNumber = 53;
  const header: PdfTextItem[] = [
    item('Sunwater Limited Group', 58, 747, pageNumber),
    item('Financial Statements 2025–26', 58, 719, pageNumber),
    item('Consolidated Statement of Profit or Loss', 58, 684, pageNumber),
    item('and Other Comprehensive Income', 58, 663, pageNumber),
    item('for the year ended 30 June 2026', 58, 635, pageNumber),
    item('2026', 395, 598, pageNumber),
    item('2025', 494, 598, pageNumber),
    item('Notes', 292, 582, pageNumber),
    item(unit, 391, 582, pageNumber),
    item(unit, 490, 582, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Revenue from contracts with customers', values: [397_160, 452_546], note: '1' },
    { label: 'Other income', values: [20_674, 16_754], note: '2' },
    {
      label: 'Total revenue and other income',
      values: [options.totalRevenueOverride ?? 417_834, 469_300],
    },
    { label: 'Operating expenditure', values: [-152_458, -163_532], note: '3A' },
    { label: 'Employee benefits', values: [-94_136, -90_092], note: '3B' },
    {
      label: 'Depreciation and amortisation',
      values: [-48_176, -46_394],
      note: '10,11,12',
    },
    { label: 'Impairment of assets', values: [-172_098, -150_372], note: '10,11' },
    { label: 'Loss on disposal of assets', values: [-85, -56] },
    { label: 'Operating profit', values: [-49_119, 18_854] },
    { label: 'Finance costs', values: [-18_797, -17_230] },
    {
      label: 'Profit before income tax',
      values: [options.pbtOverride ?? -67_916, 1_624],
    },
    { label: 'Income tax credit', values: ['-', '-'], note: '4' },
    { label: 'Profit for the year', values: [options.netOverride ?? -67_916, 1_624] },
    { label: 'Other comprehensive income', values: ['-', '-'] },
    { label: 'Total comprehensive income for the year', values: [-67_916, 1_624] },
  ];
  const items = [...header, ...renderRows(rows, pageNumber, 565)];
  return {
    page_number: pageNumber,
    text: `Sunwater Limited Group Consolidated Statement of Profit or Loss and Other Comprehensive Income for the year ended 30 June 2026 2026 2025 Notes $’000 $’000 Revenue from contracts with customers Other income Total revenue and other income Expenses Operating expenditure Employee benefits Depreciation and amortisation Impairment of assets Loss on disposal of assets Operating profit Finance costs Profit before income tax Income tax credit Profit for the year Other comprehensive income Total comprehensive income for the year`,
    items,
  };
}

function notePage(options: StatementOptions = {}): PdfPage {
  const unit = '$’000';
  const pageNumber = 63;
  const header: PdfTextItem[] = [
    item('B.', 57, 756, pageNumber),
    item('Employee benefits', 75, 756, pageNumber),
    item('2026', 413, 738, pageNumber),
    item('2025', 489, 738, pageNumber),
    item(unit, 410, 723, pageNumber),
    item(unit, 486, 723, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Salaries and allowances', values: [63_919, 61_445] },
    { label: 'Annual leave, banked time and time off in lieu (TOIL)', values: [8_666, 8_128] },
    { label: 'Long service leave expenses', values: [2_256, 2_110] },
    { label: 'Employer superannuation contributions', values: [11_358, 10_538] },
    { label: 'Workers’ compensation premium', values: [239, 219] },
    { label: 'Payroll tax', values: [5_732, 5_241] },
    { label: 'Other employee-related expenses', values: [1_966, 2_411] },
    {
      label: 'Total employee benefits',
      values: [options.noteTotalOverride ?? 94_136, 90_092],
    },
  ];
  const items = [...header, ...renderRows(rows, pageNumber, 708)];
  return {
    page_number: pageNumber,
    text: `Note 3: Expenses B. Employee benefits 2026 2025 $’000 $’000 Salaries and allowances Annual leave, banked time and time off in lieu (TOIL) Long service leave expenses Employer superannuation contributions Workers’ compensation premium Payroll tax Other employee-related expenses Total employee benefits`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 3_667_807 },
    pages: [facePage(options), notePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: SunwaterParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/qld-sunwater/Sunwater-2025-26-Annual-Report.pdf',
    sha256: 'a'.repeat(64),
    bytes: 3_667_807,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseSunwaterExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Sunwater annual-report discovery', () => {
  it('selects the newest annual report and rejects scheme statistics, SCI and older reports', () => {
    const html = `
      <a href="https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Annual_Report_22-23.pdf">2022-23</a>
      <a href="https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Sunwater_Annual_Report_2023-2024.pdf">2023-24</a>
      <a href="https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Sunwater_Annual_Report_2024-2025.pdf">2024-25</a>
      <a href="${PDF_URL}">2025-26</a>
      <a href="https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Water_supply_scheme_statistics_2025-26.pdf">Scheme statistics</a>
      <a href="https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Sunwater_2025-26_Statement_of_Corporate_Intent.pdf">SCI</a>`;
    const links = parseSunwaterAnnualReportPdfLinks(
      html,
      'https://www.sunwater.com.au/about/publications',
    );
    expect(links.map((link) => link.fiscal_year)).toEqual([
      '2025-26',
      '2024-25',
      '2023-24',
      '2022-23',
    ]);
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: 'Sunwater_2025-26_Annual_Report.pdf',
      discovery_page: 'https://www.sunwater.com.au/about/publications',
    });
    expect(links.some((link) => /scheme_statistics|Corporate_Intent/i.test(link.filename))).toBe(
      false,
    );
  });

  it('maps four-digit and compact filename year spans and rejects a non-consecutive span', () => {
    expect(sunwaterFiscalYearFromFilename('Sunwater_2025-26_Annual_Report.pdf')).toBe('2025-26');
    expect(sunwaterFiscalYearFromFilename('Sunwater_Annual_Report_2024-2025.pdf')).toBe('2024-25');
    expect(sunwaterFiscalYearFromFilename('Sunwater_Annual_Report_2023-2024.pdf')).toBe('2023-24');
    expect(sunwaterFiscalYearFromFilename('Annual_Report_22-23.pdf')).toBe('2022-23');
    expect(sunwaterFiscalYearFromFilename('Sunwater_2025-27_Annual_Report.pdf')).toBeNull();
    expect(
      sunwaterFiscalYearFromFilename('Water_supply_scheme_statistics_2025-26.pdf'),
    ).toBeNull();
    expect(
      sunwaterFiscalYearFromFilename('Sunwater_2025-26_Statement_of_Corporate_Intent.pdf'),
    ).toBeNull();
  });

  it('follows the publications page and returns its newest annual-report PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.sunwater.com.au/about/publications') {
        return new Response(
          `<a href="https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Sunwater_Annual_Report_2024-2025.pdf">2024-25</a><a href="${PDF_URL}">2025-26</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverSunwaterAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual(['https://www.sunwater.com.au/about/publications']);
  });
});

describe('Sunwater $000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per unit', () => {
    const unit = detectSunwaterUnit(['$’000 2026 $’000 2025']);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseSunwaterExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parseSunwaterStatement(facePage({ unit: '$m' }), notePage());
    expect(millions?.unit.kind).toBe('millions');
    expect(millions?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const dollars = parseSunwaterExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('Sunwater exact reconciliation and rows', () => {
  it('derives total expenses and reconciles the printed revenue and profit bridges exactly', () => {
    const result = parseSunwaterExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.note_unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(417_834);
    expect(result.statement?.total_expenses).toBe(466_953);
    expect(result.statement?.profit_before_tax).toBe(-67_916);
    expect(result.statement?.net_result).toBe(-67_916);
    expect(result.statement?.employee_benefits).toBe(94_136);
    expect(result.statement?.note_total_employee_benefits).toBe(94_136);
    expect(result.statement?.depreciation_amortisation).toBe(48_176);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'total revenue and other income bridge exact: 397160 + 20674 = 417834 (printed 417834)',
    );
    expect(checks).toContain(
      'total expenses exact: 152458 + 94136 + 48176 + 172098 + 85 = 466953',
    );
    expect(checks).toContain(
      'operating-profit bridge exact: 417834 - 466953 = -49119 (printed -49119)',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: -49119 + -18797 = -67916 (printed -67916)',
    );
    expect(checks).toContain('net-result bridge exact: -67916 + 0 = -67916 (printed -67916)');
    expect(checks).toContain('Note 3B Total employee benefits equals face Employee benefits: 94136');
  });

  it('maps the five required lines with provenance, exact cents and a negative printed sign on the loss', () => {
    const result = parseSunwaterExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 46_695_300_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'QLD',
      delivery_entity: 'Sunwater Limited',
      funding_source: 'Sunwater Limited',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: SUNWATER_ID,
      source_url: PDF_URL,
      source_dataset: 'Sunwater Limited Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Face statement / Note 3B',
      extraction_confidence: 'high',
      location: { state: 'QLD' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(41_783_400_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(9_413_600_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(4_817_600_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 6_791_600_000,
      soc_printed_sign: 'negative',
    });
  });

  it('defers on a one-thousand profit-before-tax mismatch instead of ingesting', () => {
    const result = parseSunwaterExtraction(extraction({ pbtOverride: -67_915 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand total-revenue bridge mismatch instead of ingesting', () => {
    const result = parseSunwaterExtraction(extraction({ totalRevenueOverride: 417_835 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/total revenue and other income bridge mismatch/i);
  });

  it('defers when Note 3B employee benefits do not equal the face line', () => {
    const result = parseSunwaterExtraction(extraction({ noteTotalOverride: 94_137 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 3B employee-benefits mismatch/i);
  });

  it('defers when the net-result bridge does not reconcile', () => {
    const result = parseSunwaterExtraction(extraction({ netOverride: -67_917 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseSunwaterExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Sunwater natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = sunwaterNaturalKey('Sunwater Limited', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^qld-sunwater:[0-9a-f]{40}$/);
    expect(key).toBe(sunwaterNaturalKey('Sunwater Limited', '2025-26', 'total_expenses', PDF_URL));
    expect(key).not.toBe(
      sunwaterNaturalKey('Sunwater Limited', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      sunwaterNaturalKey('Sunwater Limited', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseSunwaterExtraction(extraction(), context);
    const second = parseSunwaterExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Sunwater no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseSunwaterExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Sunwater Limited']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['QLD']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(SUNWATER_ID);
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
