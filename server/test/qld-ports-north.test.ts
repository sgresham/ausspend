import { describe, expect, it } from 'vitest';
import {
  PORTS_NORTH_ID,
  detectPortsNorthUnit,
  discoverPortsNorthAnnualReport,
  parsePortsNorthAnnualReportPdfLinks,
  parsePortsNorthExtraction,
  parsePortsNorthStatement,
  portsNorthFiscalYearFromFilename,
  portsNorthNaturalKey,
  type PortsNorthParseContext,
} from '../src/connectors/soc/qld/ports-north.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle1/port_north_annual_report_2026_final.pdf';

function item(str: string, x: number, y: number, page = 30, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 30): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const CURRENT = 504;
const PRIOR = 556;

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
    items.push(item(row.label, 51, y, pageNumber));
    if (row.note) items.push(item(row.note, 439, y, pageNumber));
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
  totalIncomeOverride?: number;
  totalExpensesOverride?: number;
  operatingOverride?: number;
  netOverride?: number;
  ociOverride?: number;
  comprehensiveOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$’000';
  const pageNumber = 30;
  const header: PdfTextItem[] = [
    item('Statement of Comprehensive Income', 51, 779, pageNumber),
    item('for year ended 30 June 2026', 51, 761, pageNumber),
    item('2026', 486, 709, pageNumber),
    item('2025', 537, 709, pageNumber),
    item('Note', 439, 699, pageNumber),
    item(unit, 484, 699, pageNumber),
    item(unit, 535, 699, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'User charges', values: [76_925, 71_480], note: 'A1.1' },
    { label: 'Interest revenue', values: [2_068, 3_345] },
    { label: 'Other revenue', values: ['-', 33] },
    { label: 'Gain on sale of property, plant and equipment', values: [21, '-'] },
    {
      label: 'Increase in Fair Value of Investment property',
      values: [17_653, 12_565],
      note: 'B5',
    },
    {
      label: 'Total Income',
      values: [options.totalIncomeOverride ?? 96_667, 87_423],
    },
    { label: 'Supplies and services', values: [42_629, 40_496], note: 'A2.1' },
    { label: 'Employee expenses', values: [19_442, 19_105], note: 'A2.2' },
    { label: 'Finance Costs', values: [52, 53], note: 'B9' },
    { label: 'Depreciation', values: [7_507, 7_254], note: 'B4.1 / B9' },
    {
      label: 'Write off of Property, Plant and Equipment work in progress',
      values: [37, '-'],
      note: 'B4.1',
    },
    {
      label: 'Revaluation decrement of property, plant and equipment',
      values: [13_774, 12_861],
      note: 'B4.1',
    },
    {
      label: 'Total Expenses',
      values: [options.totalExpensesOverride ?? 83_441, 79_769],
    },
    {
      label: 'Operating Result before Income tax (equivalent) expense',
      values: [options.operatingOverride ?? 13_226, 7_654],
    },
    { label: 'Income tax equivalent expense/(benefit)', values: [4_084, 2_352], note: 'A3' },
    {
      label: 'Operating Result for the year',
      values: [options.netOverride ?? 9_142, 5_302],
    },
    {
      label: 'Increase/(decrease) in asset revaluation surplus',
      values: [-11_638, -10_380],
      note: 'B11.2',
    },
    {
      label: 'Other deferred tax adjustments',
      values: [3_549, 3_114],
      note: 'B11.2',
    },
    {
      label: 'Total Other Comprehensive Income for the period, net of income tax',
      values: [options.ociOverride ?? -8_089, -7_266],
    },
    {
      label: 'Total Comprehensive Income',
      values: [options.comprehensiveOverride ?? 1_053, -1_964],
    },
  ];
  const items = [...header, ...renderRows(rows, pageNumber, 678)];
  return {
    page_number: pageNumber,
    text: `Statement of Comprehensive Income for year ended 30 June 2026 2026 2025 Note $’000 $’000 INCOME Revenue User charges Interest revenue Other revenue Gain on sale of property, plant and equipment Increase in Fair Value of Investment property Total Income EXPENSES Expenses Supplies and services Employee expenses Finance Costs Depreciation Write off of Property, Plant and Equipment work in progress Revaluation decrement of property, plant and equipment Total Expenses Operating Result before Income tax (equivalent) expense Income tax equivalent expense/(benefit) Operating Result for the year Other Comprehensive Income Increase/(decrease) in asset revaluation surplus Other deferred tax adjustments Total Other Comprehensive Income for the period, net of income tax Total Comprehensive Income`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 2_456_133 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: PortsNorthParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/qld-ports-north/Ports-North-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 2_456_133,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parsePortsNorthExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Ports North annual-report discovery', () => {
  it('selects the newest annual report and rejects Statements of Corporate Intent', () => {
    const html = `
      <a href="//os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle1/ports_north_annual_report_2020-2021_digital.pdf">2020-21</a>
      <a href="//os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle1/ports_north_annual_report_2021-22_final.pdf">2021-22</a>
      <a href="//os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle1/ports_north_annual_report_fy2025_compliant_version.pdf">2024-25</a>
      <a href="//os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle1/port_north_annual_report_2026_final.pdf">2025-26</a>
      <a href="//os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle4/ports_north_statement_of_corporate_intent_fy2026_redacted_final.pdf">SCI</a>`;
    const links = parsePortsNorthAnnualReportPdfLinks(
      html,
      'https://www.portsnorth.com.au/news-publications/annual-reports/',
    );
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: 'port_north_annual_report_2026_final.pdf',
      fiscal_year: '2025-26',
      discovery_page: 'https://www.portsnorth.com.au/news-publications/annual-reports/',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual([
      '2025-26',
      '2024-25',
      '2021-22',
      '2020-21',
    ]);
    expect(links.some((link) => /corporate_intent/i.test(link.filename))).toBe(false);
  });

  it('maps spans, fy-prefixed years, bare year-ended years and rejects malformed spans', () => {
    expect(portsNorthFiscalYearFromFilename('port_north_annual_report_2026_final.pdf')).toBe(
      '2025-26',
    );
    expect(
      portsNorthFiscalYearFromFilename('ports_north_annual_report_fy2025_compliant_version.pdf'),
    ).toBe('2024-25');
    expect(portsNorthFiscalYearFromFilename('ports_north_annual_report_fy23_final.pdf')).toBe(
      '2022-23',
    );
    expect(portsNorthFiscalYearFromFilename('ports_north_annual_report_2021-22_final.pdf')).toBe(
      '2021-22',
    );
    expect(
      portsNorthFiscalYearFromFilename('ports_north_annual_report_2020-2021_digital.pdf'),
    ).toBe('2020-21');
    expect(portsNorthFiscalYearFromFilename('ports_north_annual_report_2025-27.pdf')).toBeNull();
    expect(
      portsNorthFiscalYearFromFilename('ports_north_statement_of_corporate_intent_fy2026.pdf'),
    ).toBeNull();
  });

  it('follows the annual-reports page and returns its newest annual-report PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.portsnorth.com.au/news-publications/annual-reports/') {
        return new Response(
          `<a href="//os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle1/ports_north_annual_report_fy2025_compliant_version.pdf">2024-25</a><a href="${PDF_URL}">2025-26</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverPortsNorthAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual([
      'https://www.portsnorth.com.au/news-publications/annual-reports/',
    ]);
  });
});

describe('Ports North $000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per unit', () => {
    const unit = detectPortsNorthUnit(['$’000 2026 $’000 2025']);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parsePortsNorthExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parsePortsNorthStatement(facePage({ unit: '$m' }));
    expect(millions?.unit.kind).toBe('millions');

    const millionsDeferral = parsePortsNorthExtraction(extraction({ unit: '$m' }), context);
    expect(millionsDeferral.records).toHaveLength(0);
    expect(millionsDeferral.deferral?.phase).toBe('unit');

    const dollars = parsePortsNorthExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('Ports North exact reconciliation and rows', () => {
  it('reconciles every printed bridge exactly', () => {
    const result = parsePortsNorthExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_income).toBe(96_667);
    expect(result.statement?.total_expenses).toBe(83_441);
    expect(result.statement?.employee_expenses).toBe(19_442);
    expect(result.statement?.depreciation_amortisation).toBe(7_507);
    expect(result.statement?.operating_result_before_tax).toBe(13_226);
    expect(result.statement?.net_result).toBe(9_142);
    expect(result.statement?.total_oci).toBe(-8_089);
    expect(result.statement?.total_comprehensive_income).toBe(1_053);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'income components exact: 76925 + 2068 + 0 + 21 + 17653 = 96667 (printed Total Income 96667)',
    );
    expect(checks).toContain(
      'expense components exact: 42629 + 19442 + 52 + 7507 + 37 + 13774 = 83441 (printed Total Expenses 83441)',
    );
    expect(checks).toContain(
      'operating-result bridge exact: 96667 - 83441 = 13226 (printed 13226)',
    );
    expect(checks).toContain('net-result bridge exact: 13226 - 4084 = 9142 (printed 9142)');
    expect(checks).toContain('total-oci bridge exact: -11638 + 3549 = -8089 (printed -8089)');
    expect(checks).toContain(
      'total-comprehensive-income bridge exact: 9142 + -8089 = 1053 (printed 1053)',
    );
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parsePortsNorthExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 8_344_100_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'QLD',
      delivery_entity: 'Ports North',
      funding_source: 'Ports North',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: PORTS_NORTH_ID,
      source_url: PDF_URL,
      source_dataset: 'Ports North Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Face statement',
      extraction_confidence: 'high',
      location: { state: 'QLD' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(9_666_700_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(1_944_200_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(750_700_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 914_200_000,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on a one-thousand income component mismatch instead of ingesting', () => {
    const result = parsePortsNorthExtraction(
      extraction({ totalIncomeOverride: 96_668 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/income component total mismatch/i);
  });

  it('defers on a one-thousand expense component mismatch instead of ingesting', () => {
    const result = parsePortsNorthExtraction(
      extraction({ totalExpensesOverride: 83_442 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/expense component total mismatch/i);
  });

  it('defers on a one-thousand net-result mismatch instead of ingesting', () => {
    const result = parsePortsNorthExtraction(extraction({ netOverride: 9_143 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers when the OCI or comprehensive bridge does not reconcile', () => {
    const oci = parsePortsNorthExtraction(extraction({ ociOverride: -8_088 }), context);
    expect(oci.records).toHaveLength(0);
    expect(oci.deferral?.phase).toBe('reconciliation');
    expect(oci.deferral?.reason).toMatch(/total-oci bridge mismatch/i);

    const comprehensive = parsePortsNorthExtraction(
      extraction({ comprehensiveOverride: 1_054 }),
      context,
    );
    expect(comprehensive.records).toHaveLength(0);
    expect(comprehensive.deferral?.phase).toBe('reconciliation');
    expect(comprehensive.deferral?.reason).toMatch(
      /total-comprehensive-income bridge mismatch/i,
    );
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parsePortsNorthExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Ports North natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = portsNorthNaturalKey('Ports North', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^qld-ports-north:[0-9a-f]{40}$/);
    expect(key).toBe(portsNorthNaturalKey('Ports North', '2025-26', 'total_expenses', PDF_URL));
    expect(key).not.toBe(
      portsNorthNaturalKey('Ports North', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      portsNorthNaturalKey('Ports North', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parsePortsNorthExtraction(extraction(), context);
    const second = parsePortsNorthExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Ports North no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parsePortsNorthExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Ports North']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['QLD']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(PORTS_NORTH_ID);
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
