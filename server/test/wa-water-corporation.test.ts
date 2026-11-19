import { describe, expect, it } from 'vitest';
import {
  WATER_CORPORATION_ID,
  detectWaterCorporationUnit,
  discoverWaterCorporationAnnualReport,
  parseWaterCorporationAnnualReportPdfLinks,
  parseWaterCorporationExtraction,
  parseWaterCorporationStatement,
  waterCorporationFiscalYearFromFilename,
  waterCorporationNaturalKey,
  type WaterCorporationParseContext,
} from '../src/connectors/soc/wa/water-corporation.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://pw-cdn.watercorporation.com.au/-/media/watercorp/documents/about-us/our-performance/annual-reports/2026-annual-report/water-corporation-annual-report-2026.pdf?rev=6c0e7a1521064c3cac3168e2eef471bb&hash=9D643358CFF5FBE765827AAE955F48CE';

function item(str: string, x: number, y: number, page = 46, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 46): PdfTextItem {
  const width = Math.max(6, str.length * 4);
  return item(str, right - width, y, page, width);
}

const COLS = [370, 430, 490, 550];

interface RowSpec {
  label: string;
  values: Array<number | string | null>;
  note?: string;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function renderRow(row: RowSpec, pageNumber: number, y: number): PdfTextItem[] {
  const items: PdfTextItem[] = [item(row.label, 47, y, pageNumber)];
  if (row.note) items.push(item(row.note, 271, y, pageNumber));
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
  totalRevenueOverride?: number;
  totalExpensesOverride?: number;
  operatingOverride?: number;
  pbtOverride?: number;
  netOverride?: number;
  ociOverride?: number;
  comprehensiveOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$M';
  const pageNumber = 46;
  const items: PdfTextItem[] = [
    item('Statement of comprehensive income', 43, 787, pageNumber),
    item('for the year ended 30 June 2026', 43, 768, pageNumber),
    item('Group', 408, 731, pageNumber),
    item('Corporation', 506, 731, pageNumber),
    item('Note', 270, 703, pageNumber),
    item('2026', 351, 712, pageNumber),
    item(unit, 359, 703, pageNumber),
    item('2025', 411, 712, pageNumber),
    item(unit, 419, 703, pageNumber),
    item('2026', 471, 712, pageNumber),
    item(unit, 479, 703, pageNumber),
    item('2025', 531, 712, pageNumber),
    item(unit, 539, 703, pageNumber),
  ];
  let y = 660;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y));
    y -= 14;
  };
  add({ label: 'Revenue', values: [null, null, null, null] });
  add({ label: 'Annual service charges', values: [1_654, 1_586, 1_654, 1_586] });
  add({ label: 'Volume charges', values: [1_012, 1_001, 1_012, 1_001] });
  add({ label: 'Operating subsidies', values: [668, 597, 668, 597] });
  add({ label: 'Developers’ contributions', values: [419, 336, 419, 336] });
  add({ label: 'Other revenue', values: [211, 209, 212, 210], note: '5.2.1' });
  add({
    label: 'Total revenue',
    values: [options.totalRevenueOverride ?? 3_964, 3_729, 3_965, 3_730],
    note: '5.2.2',
  });
  add({ label: 'Expenses', values: [null, null, null, null] });
  add({
    label: 'Depreciation and amortisation',
    values: [-590, -591, -589, -590],
    note: '12,13,14,15',
  });
  add({
    label: 'Employee benefits expense',
    values: [-533, -512, -533, -512],
    note: '6.1(a)',
  });
  add({ label: 'Hired and contracted services', values: [-340, -296, -340, -296] });
  add({ label: 'Energy expenses', values: [-195, -154, -195, -154], note: '6.1(b)' });
  add({ label: 'Other expenses', values: [-486, -431, -486, -432], note: '6.1(c)' });
  add({
    label: 'Total expenses',
    values: [options.totalExpensesOverride ?? -2_144, -1_984, -2_143, -1_984],
  });
  add({
    label: 'Results from operating activities',
    values: [options.operatingOverride ?? 1_820, 1_745, 1_822, 1_746],
  });
  add({ label: 'Net finance costs', values: [-128, -133, -128, -133], note: '7' });
  add({
    label: 'Profit before income tax equivalent',
    values: [options.pbtOverride ?? 1_692, 1_612, 1_694, 1_613],
  });
  add({
    label: 'Income tax equivalent expense',
    values: [-534, -485, -534, -485],
    note: '8',
  });
  add({
    label: 'Profit for the year',
    values: [options.netOverride ?? 1_158, 1_127, 1_160, 1_128],
  });
  add({ label: 'Items that will not be reclassified to profit or loss', values: [null, null, null, null] });
  add({ label: 'Remeasurements of defined benefits', values: [1, -1, 1, -1] });
  add({
    label: 'Other comprehensive income/(loss), net of tax equivalent',
    values: [options.ociOverride ?? 1, -1, 1, -1],
  });
  add({
    label: 'Total comprehensive income for the year',
    values: [options.comprehensiveOverride ?? 1_159, 1_126, 1_161, 1_127],
  });
  return {
    page_number: pageNumber,
    text: `Statement of comprehensive income for the year ended 30 June 2026 Group Corporation Note 2026 $M 2025 $M 2026 $M 2025 $M Revenue Annual service charges Volume charges Operating subsidies Developers’ contributions Other revenue Total revenue Expenses Depreciation and amortisation Employee benefits expense Hired and contracted services Energy expenses Other expenses Total expenses Results from operating activities Net finance costs Profit before income tax equivalent Income tax equivalent expense Profit for the year Remeasurements of defined benefits Other comprehensive income/(loss), net of tax equivalent Total comprehensive income for the year`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 19_632_537 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: WaterCorporationParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/wa-water-corporation/Water-Corporation-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 19_632_537,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseWaterCorporationExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Water Corporation annual-report discovery', () => {
  it('selects the newest annual report and rejects quarterly reports and the SCI', () => {
    const html = `
      <a href="https://pw-cdn.watercorporation.com.au/x/water-corporation-annual-report-2024.pdf">2024</a>
      <a href="https://pw-cdn.watercorporation.com.au/x/water-corporation-annual-report-2025.pdf">2025</a>
      <a href="${PDF_URL}">2026</a>
      <a href="https://pw-cdn.watercorporation.com.au/x/quarterly-performance-report-dec-2020.pdf">Quarterly</a>
      <a href="https://pw-cdn.watercorporation.com.au/x/statement-of-corporate-intent-2023-24.pdf">SCI</a>`;
    const links = parseWaterCorporationAnnualReportPdfLinks(
      html,
      'https://www.watercorporation.com.au/about-us/our-performance/annual-report',
    );
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: 'water-corporation-annual-report-2026.pdf',
      fiscal_year: '2025-26',
      discovery_page:
        'https://www.watercorporation.com.au/about-us/our-performance/annual-report',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.some((link) => /quarterly|corporate-intent/i.test(link.filename))).toBe(false);
  });

  it('maps the year-ended annual-report filenames and rejects non-annual PDFs', () => {
    expect(
      waterCorporationFiscalYearFromFilename('water-corporation-annual-report-2026.pdf'),
    ).toBe('2025-26');
    expect(waterCorporationFiscalYearFromFilename('annual-report-2023.pdf')).toBe('2022-23');
    expect(
      waterCorporationFiscalYearFromFilename('water_corporation_annual_report_2021.pdf'),
    ).toBe('2020-21');
    expect(
      waterCorporationFiscalYearFromFilename('quarterly-performance-report-dec-2020.pdf'),
    ).toBeNull();
    expect(
      waterCorporationFiscalYearFromFilename('statement-of-corporate-intent-2023-24.pdf'),
    ).toBeNull();
  });

  it('follows the annual-report page and returns its newest PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.watercorporation.com.au/about-us/our-performance/annual-report') {
        return new Response(
          `<a href="https://pw-cdn.watercorporation.com.au/x/water-corporation-annual-report-2025.pdf">2025</a><a href="${PDF_URL}">2026</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverWaterCorporationAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual([
      'https://www.watercorporation.com.au/about-us/our-performance/annual-report',
    ]);
  });
});

describe('Water Corporation $M unit guard', () => {
  it('detects the printed $M unit at 100,000,000 cents per unit', () => {
    const unit = detectWaterCorporationUnit(['$M 2026 $M 2025']);
    expect(unit.kind).toBe('millions');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000_000);
  });

  it('defers when the printed unit is absent rather than guessing', () => {
    const result = parseWaterCorporationExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit millions/i);
  });

  it('rejects a statement read as dollars or thousands instead of $M', () => {
    const thousands = parseWaterCorporationStatement(facePage({ unit: "$'000" }));
    expect(thousands?.unit.kind).toBe('thousands');

    const thousandsDeferral = parseWaterCorporationExtraction(
      extraction({ unit: "$'000" }),
      context,
    );
    expect(thousandsDeferral.records).toHaveLength(0);
    expect(thousandsDeferral.deferral?.phase).toBe('unit');

    const dollars = parseWaterCorporationExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('Water Corporation exact reconciliation and rows', () => {
  it('reads the Group current-year column and reconciles every bridge exactly', () => {
    const result = parseWaterCorporationExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('millions');
    expect(result.statement?.total_revenue).toBe(3_964);
    expect(result.statement?.total_expenses).toBe(2_144);
    expect(result.statement?.employee_expenses).toBe(533);
    expect(result.statement?.depreciation_amortisation).toBe(590);
    expect(result.statement?.results_from_operating_activities).toBe(1_820);
    expect(result.statement?.profit_before_tax).toBe(1_692);
    expect(result.statement?.net_result).toBe(1_158);
    expect(result.statement?.other_comprehensive_income).toBe(1);
    expect(result.statement?.total_comprehensive_income).toBe(1_159);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'revenue components exact: 1654 + 1012 + 668 + 419 + 211 = 3964 (printed Total revenue 3964)',
    );
    expect(checks).toContain(
      'expense components exact: 590 + 533 + 340 + 195 + 486 = 2144 (printed Total expenses 2144)',
    );
    expect(checks).toContain(
      'operating-activities bridge exact: 3964 - 2144 = 1820 (printed 1820)',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: 1820 + -128 = 1692 (printed 1692)',
    );
    expect(checks).toContain('net-result bridge exact: 1692 + -534 = 1158 (printed 1158)');
    expect(checks).toContain(
      'total-comprehensive-income bridge exact: 1158 + 1 = 1159 (printed 1159)',
    );
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseWaterCorporationExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 214_400_000_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'WA',
      delivery_entity: 'Water Corporation',
      funding_source: 'Water Corporation',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: WATER_CORPORATION_ID,
      source_url: PDF_URL,
      source_dataset: 'Water Corporation Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_millions',
      soc_section: 'expenses',
      soc_note: 'Statement of comprehensive income',
      extraction_confidence: 'high',
      location: { state: 'WA' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(396_400_000_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(53_300_000_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(59_000_000_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 115_800_000_000,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on revenue/expense component mismatches', () => {
    const revenue = parseWaterCorporationExtraction(
      extraction({ totalRevenueOverride: 3_965 }),
      context,
    );
    expect(revenue.records).toHaveLength(0);
    expect(revenue.deferral?.phase).toBe('reconciliation');
    expect(revenue.deferral?.reason).toMatch(/revenue component total mismatch/i);

    const expenses = parseWaterCorporationExtraction(
      extraction({ totalExpensesOverride: -2_145 }),
      context,
    );
    expect(expenses.records).toHaveLength(0);
    expect(expenses.deferral?.phase).toBe('reconciliation');
    expect(expenses.deferral?.reason).toMatch(/expense component total mismatch/i);
  });

  it('defers on result-bridge mismatches', () => {
    const operating = parseWaterCorporationExtraction(
      extraction({ operatingOverride: 1_821 }),
      context,
    );
    expect(operating.records).toHaveLength(0);
    expect(operating.deferral?.reason).toMatch(/operating-activities bridge mismatch/i);

    const pbt = parseWaterCorporationExtraction(extraction({ pbtOverride: 1_693 }), context);
    expect(pbt.records).toHaveLength(0);
    expect(pbt.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);

    const net = parseWaterCorporationExtraction(extraction({ netOverride: 1_159 }), context);
    expect(net.records).toHaveLength(0);
    expect(net.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers on OCI or comprehensive-income mismatches', () => {
    const oci = parseWaterCorporationExtraction(extraction({ ociOverride: 2 }), context);
    expect(oci.records).toHaveLength(0);
    expect(oci.deferral?.reason).toMatch(/other-comprehensive-income mismatch/i);

    const comprehensive = parseWaterCorporationExtraction(
      extraction({ comprehensiveOverride: 1_160 }),
      context,
    );
    expect(comprehensive.records).toHaveLength(0);
    expect(comprehensive.deferral?.reason).toMatch(
      /total-comprehensive-income bridge mismatch/i,
    );
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseWaterCorporationExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Water Corporation natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = waterCorporationNaturalKey(
      'Water Corporation',
      '2025-26',
      'total_expenses',
      PDF_URL,
    );
    expect(key).toMatch(/^wa-water-corporation:[0-9a-f]{40}$/);
    expect(key).toBe(
      waterCorporationNaturalKey('Water Corporation', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      waterCorporationNaturalKey('Water Corporation', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      waterCorporationNaturalKey('Water Corporation', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseWaterCorporationExtraction(extraction(), context);
    const second = parseWaterCorporationExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Water Corporation no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive, WA-only and excluded from the generic spending query', () => {
    const result = parseWaterCorporationExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Water Corporation']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['WA']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(WATER_CORPORATION_ID);
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
