import { describe, expect, it } from 'vitest';
import {
  BUSSELTON_WATER_ID,
  busseltonWaterFiscalYearFromFilename,
  busseltonWaterNaturalKey,
  detectBusseltonWaterUnit,
  discoverBusseltonWaterAnnualReport,
  parseBusseltonWaterAnnualReportPdfLinks,
  parseBusseltonWaterExtraction,
  parseBusseltonWaterStatement,
  type BusseltonWaterParseContext,
} from '../src/connectors/soc/wa/busselton-water.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.busseltonwater.wa.gov.au/wp-content/uploads/2026/10/FINAL-BW-2026-Annual-Report-digital.pdf';

function item(str: string, x: number, y: number, page = 50, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 50): PdfTextItem {
  const width = Math.max(6, str.length * 4);
  return item(str, right - width, y, page, width);
}

const COLS = [674, 745];

interface RowSpec {
  label: string;
  values: Array<number | string | null>;
  note?: string;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function renderRow(row: RowSpec, pageNumber: number, y: number): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  if (row.label) items.push(item(row.label, 243, y, pageNumber));
  if (row.note) items.push(item(row.note, 570, y, pageNumber));
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
  totalExpensesOverride?: number;
  employeeOverride?: number;
  pbtOverride?: number;
  netOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$';
  const pageNumber = 50;
  const items: PdfTextItem[] = [
    item('FINANCIAL REPORT', 43, 566, pageNumber),
    item('Statement of Comprehensive Income', 238, 528, pageNumber),
    item('for the year ended 30 June 2026', 238, 516, pageNumber),
    item('Notes', 567, 501, pageNumber),
    item('2026', 654, 501, pageNumber),
    item('2025', 723, 501, pageNumber),
    item(unit, 669, 488, pageNumber),
    item(unit, 737, 488, pageNumber),
  ];
  let y = 446;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y));
    y -= 11.3;
  };
  add({
    label: 'Employee benefit expenses',
    values: [options.employeeOverride ?? 2_435_979, 2_125_470],
    note: '2.1.1',
  });
  add({ label: 'Cost of sales', values: [5_894_463, 5_239_895], note: '2.2' });
  add({
    label: 'Depreciation and amortisation expenses',
    values: [3_990_995, 2_536_649],
    note: '4',
  });
  add({ label: 'Finance costs', values: [45_606, 5_897], note: '6.2' });
  add({ label: 'Administration expenses', values: [2_180_862, 1_314_414], note: '2.3.1' });
  add({ label: 'Other expenses', values: [2_102_281, 1_430_073], note: '2.3.2' });
  add({
    label: 'Loss on disposal of non-current assets',
    values: [105_532, 364_217],
    note: '2.3.3',
  });
  add({
    label: 'Total expenses',
    values: [options.totalExpensesOverride ?? 16_755_718, 13_016_615],
  });
  add({ label: 'Water sales revenue', values: [13_471_006, 13_598_343], note: '3.1' });
  add({ label: 'Grants and contributions', values: [7_740_176, 5_030_653], note: '3.2' });
  add({
    label: 'Developer contributions - headworks',
    values: [1_151_665, 1_822_718],
    note: '3.3',
  });
  add({
    label: 'Developer contributions - mains',
    values: [1_100_781, 1_225_774],
    note: '3.3',
  });
  add({ label: 'Interest income', values: [441_380, 888_179], note: '3.4' });
  add({ label: 'Other revenue', values: [258_778, 252_032], note: '3.5' });
  // Unlabeled printed total-income row.
  items.push(...renderRow({ label: '', values: [24_163_786, 22_817_699] }, pageNumber, y));
  y -= 11.3;
  add({
    label: 'Profit before income tax',
    values: [options.pbtOverride ?? 7_408_068, 9_801_084],
  });
  add({
    label: 'Income tax equivalent expense',
    values: [-1_852_017, -2_450_271],
    note: '8.6.1',
  });
  add({
    label: 'Profit after income tax',
    values: [options.netOverride ?? 5_556_051, 7_350_813],
  });
  return {
    page_number: pageNumber,
    text: `FINANCIAL REPORT Statement of Comprehensive Income for the year ended 30 June 2026 Notes 2026 2025 $ $ Employee benefit expenses Cost of sales Depreciation and amortisation expenses Finance costs Administration expenses Other expenses Loss on disposal of non-current assets Total expenses Water sales revenue Grants and contributions Developer contributions - headworks Developer contributions - mains Interest income Other revenue Profit before income tax Income tax equivalent expense Profit after income tax`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 13_222_107 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: BusseltonWaterParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/wa-busselton-water/Busselton-Water-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 13_222_107,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseBusseltonWaterExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Busselton Water annual-report discovery', () => {
  it('selects the newest annual report and rejects annual water-quality reports and other publications', () => {
    const html = `
      <a href="https://www.busseltonwater.wa.gov.au/wp-content/uploads/2017/07/Busselton-Water-Annual-Report-2013-14-1.pdf">2013-14</a>
      <a href="https://www.busseltonwater.wa.gov.au/wp-content/uploads/2019/09/BW-2019-Annual-Report-web.pdf">2019</a>
      <a href="https://www.busseltonwater.wa.gov.au/wp-content/uploads/2021/12/FINAL-2025-BW-ANNUAL-REPORT.pdf">2025</a>
      <a href="${PDF_URL}">2026</a>
      <a href="https://www.busseltonwater.wa.gov.au/wp-content/uploads/2017/07/Annual-Water-Quality-Report-2009-2010.pdf">Water quality</a>
      <a href="https://www.busseltonwater.wa.gov.au/wp-content/uploads/2017/06/Watersource-Customer-Newsletter-February-2017.pdf">Newsletter</a>`;
    const links = parseBusseltonWaterAnnualReportPdfLinks(
      html,
      'https://www.busseltonwater.wa.gov.au/publications/annual-reports/',
    );
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: 'FINAL-BW-2026-Annual-Report-digital.pdf',
      fiscal_year: '2025-26',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual([
      '2025-26',
      '2024-25',
      '2018-19',
      '2013-14',
    ]);
    expect(links.some((link) => /water-quality|newsletter/i.test(link.filename))).toBe(false);
  });

  it('maps year-ended and 2013-14 span filenames and rejects non-annual reports', () => {
    expect(busseltonWaterFiscalYearFromFilename('FINAL-BW-2026-Annual-Report-digital.pdf')).toBe(
      '2025-26',
    );
    expect(busseltonWaterFiscalYearFromFilename('FINAL-2025-BW-ANNUAL-REPORT.pdf')).toBe('2024-25');
    expect(
      busseltonWaterFiscalYearFromFilename('Annual-Report-2019-20-High-Resolution-interactive.pdf'),
    ).toBe('2019-20');
    expect(
      busseltonWaterFiscalYearFromFilename('Busselton-Water-Annual-Report-2014-2015.pdf'),
    ).toBe('2014-15');
    expect(
      busseltonWaterFiscalYearFromFilename('Annual-Water-Quality-Report-2009-2010.pdf'),
    ).toBeNull();
    expect(
      busseltonWaterFiscalYearFromFilename('Watersource-Customer-Newsletter-February-2017.pdf'),
    ).toBeNull();
  });

  it('follows the official annual-reports page and returns its newest PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.busseltonwater.wa.gov.au/publications/annual-reports/') {
        return new Response(
          `<a href="https://www.busseltonwater.wa.gov.au/wp-content/uploads/2021/12/FINAL-2025-BW-ANNUAL-REPORT.pdf">2025</a><a href="${PDF_URL}">2026</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverBusseltonWaterAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual(['https://www.busseltonwater.wa.gov.au/publications/annual-reports/']);
  });
});

describe('Busselton Water $ unit guard', () => {
  it('detects the printed $ unit at 100 cents per dollar', () => {
    const unit = detectBusseltonWaterUnit(['$ 2026 $ 2025']);
    expect(unit.kind).toBe('dollars');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseBusseltonWaterExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit whole dollars/i);
  });

  it('rejects a statement read as thousands or millions instead of whole dollars', () => {
    const thousands = parseBusseltonWaterStatement(facePage({ unit: "$'000" }));
    expect(thousands?.unit.kind).toBe('thousands');

    const thousandsDeferral = parseBusseltonWaterExtraction(
      extraction({ unit: "$'000" }),
      context,
    );
    expect(thousandsDeferral.records).toHaveLength(0);
    expect(thousandsDeferral.deferral?.phase).toBe('unit');

    const millions = parseBusseltonWaterExtraction(extraction({ unit: '$M' }), context);
    expect(millions.records).toHaveLength(0);
    expect(millions.deferral?.phase).toBe('unit');
  });
});

describe('Busselton Water exact reconciliation and rows', () => {
  it('reconciles the printed totals and bridges exactly', () => {
    const result = parseBusseltonWaterExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('dollars');
    expect(result.statement?.total_revenue).toBe(24_163_786);
    expect(result.statement?.total_expenses).toBe(16_755_718);
    expect(result.statement?.employee_expenses).toBe(2_435_979);
    expect(result.statement?.depreciation_amortisation).toBe(3_990_995);
    expect(result.statement?.profit_before_tax).toBe(7_408_068);
    expect(result.statement?.net_result).toBe(5_556_051);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'expense components exact: 2435979 + 5894463 + 3990995 + 45606 + 2180862 + 2102281 + 105532 = 16755718 (printed Total expenses 16755718)',
    );
    expect(checks).toContain(
      'total revenue exact: 13471006 + 7740176 + 1151665 + 1100781 + 441380 + 258778 = 24163786 (printed unlabeled total 24163786)',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: 24163786 - 16755718 = 7408068 (printed 7408068)',
    );
    expect(checks).toContain(
      'net-result bridge exact: 7408068 + -1852017 = 5556051 (printed 5556051)',
    );
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseBusseltonWaterExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 1_675_571_800,
      jurisdiction_level: 'soc',
      jurisdiction: 'WA',
      delivery_entity: 'Busselton Water',
      funding_source: 'Busselton Water',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: BUSSELTON_WATER_ID,
      source_url: PDF_URL,
      source_dataset: 'Busselton Water Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD',
      soc_section: 'expenses',
      soc_note: 'Statement of Comprehensive Income',
      extraction_confidence: 'high',
      location: { state: 'WA' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(2_416_378_600);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(243_597_900);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(399_099_500);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 555_605_100,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on a printed-expense total mismatch', () => {
    const result = parseBusseltonWaterExtraction(
      extraction({ totalExpensesOverride: 16_755_719 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/expense component total mismatch/i);
  });

  it('defers on a profit-before-tax mismatch', () => {
    const result = parseBusseltonWaterExtraction(extraction({ pbtOverride: 7_408_069 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers on a net-result mismatch', () => {
    const result = parseBusseltonWaterExtraction(extraction({ netOverride: 5_556_052 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers on a component change that breaks the derived-income bridge', () => {
    const result = parseBusseltonWaterExtraction(
      extraction({ employeeOverride: 2_435_980 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.reason).toMatch(/expense component total mismatch/i);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseBusseltonWaterExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Busselton Water natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = busseltonWaterNaturalKey('Busselton Water', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^wa-busselton-water:[0-9a-f]{40}$/);
    expect(key).toBe(
      busseltonWaterNaturalKey('Busselton Water', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      busseltonWaterNaturalKey('Busselton Water', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      busseltonWaterNaturalKey('Busselton Water', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseBusseltonWaterExtraction(extraction(), context);
    const second = parseBusseltonWaterExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Busselton Water no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive, WA-only and excluded from the generic spending query', () => {
    const result = parseBusseltonWaterExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Busselton Water']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['WA']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(BUSSELTON_WATER_ID);
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
