import { describe, expect, it } from 'vitest';
import {
  NQBP_ID,
  NQBP_PARLIAMENT_FALLBACK_URL,
  detectNqbpUnit,
  discoverNqbpAnnualReport,
  nqbpFiscalYearFromFilename,
  nqbpNaturalKey,
  nqbpParliamentFallback,
  parseNqbpAnnualReportPdfLinks,
  parseNqbpExtraction,
  parseNqbpStatement,
  type NqbpParseContext,
} from '../src/connectors/soc/qld/nqbp.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const OFFICIAL_PDF =
  'https://nqbp.com.au/sites/default/files/NQBP-Annual-Report-2025-26.pdf';
const TABLED_PDF = NQBP_PARLIAMENT_FALLBACK_URL;

function item(str: string, x: number, y: number, page = 53, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 53): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const COLS = [392, 445, 497, 550];

interface RowSpec {
  label: string;
  values: Array<number | string | null>;
  note?: string;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function renderRow(
  row: RowSpec,
  pageNumber: number,
  y: number,
  labelX = 96,
  noteX = 320,
): PdfTextItem[] {
  const items: PdfTextItem[] = [item(row.label, labelX, y, pageNumber)];
  if (row.note) items.push(item(row.note, noteX, y, pageNumber));
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
  totalExpensesOverride?: number;
  operatingOverride?: number;
  pbtOverride?: number;
  netOverride?: number;
  ociTaxOverride?: number;
  comprehensiveOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? "$'000";
  const pageNumber = 53;
  const header: PdfTextItem[] = [
    item('Consolidated Statement of Comprehensive Income', 96, 719, pageNumber),
    item('FOR THE YEAR ENDED 30 JUNE 2026', 96, 704, pageNumber),
    item('Consolidated', 363, 684, pageNumber),
    item('Parent', 483, 684, pageNumber),
    item('2026', 371, 671, pageNumber),
    item('2025', 424, 671, pageNumber),
    item('2026', 476, 671, pageNumber),
    item('2025', 529, 671, pageNumber),
    item('Note', 319, 658, pageNumber),
    item(unit, 369, 658, pageNumber),
    item(unit, 422, 658, pageNumber),
    item(unit, 474, 658, pageNumber),
    item(unit, 526, 658, pageNumber),
  ];
  const items: PdfTextItem[] = [...header];
  let y = 640;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y));
    y -= 13;
  };
  add({ label: 'Income from operations', values: [null, null, null, null] });
  add({
    label: 'Revenue from contracts with customers',
    values: [109_092, 106_000, 109_092, 106_000],
    note: '2',
  });
  add({ label: 'Other income', values: [44_017, 44_208, 44_017, 43_111], note: '2' });
  add({
    label: 'Income from operations',
    values: [options.totalIncomeOverride ?? 153_109, 150_208, 153_109, 149_111],
  });
  add({ label: 'Expenses from operations', values: [null, null, null, null] });
  add({
    label: 'Employee benefits expenses',
    values: [-32_271, -32_147, -32_271, -32_147],
    note: '3',
  });
  add({ label: 'Supplies and services', values: [-43_469, -45_786, -43_324, -45_642], note: '4' });
  add({
    label: 'Depreciation and amortisation',
    values: [-14_312, -13_819, -14_312, -13_819],
    note: '11a),c),12',
  });
  add({
    label: 'Impairment losses / fair value adjustments',
    values: [-275, -3_666, -275, -3_666],
    note: '5',
  });
  add({ label: 'Other expenses', values: [-5_845, -3_196, -6_932, -3_180], note: '7' });
  add({
    label: 'Expenses from operations',
    values: [options.totalExpensesOverride ?? -96_172, -98_614, -97_114, -98_454],
  });
  add({
    label: 'Operating result',
    values: [options.operatingOverride ?? 56_937, 51_594, 55_995, 50_657],
  });
  add({ label: 'Financial income', values: [4_103, 4_776, 3_449, 4_140] });
  add({ label: 'Financial expenses', values: [-8_340, -7_750, -8_307, -7_722], note: '6' });
  add({
    label: 'Interest expense on lease liabilities',
    values: [-218, -231, -218, -231],
    note: '11b)',
  });
  add({ label: 'Net finance costs', values: [-4_455, -3_205, -5_076, -3_813] });
  add({
    label: 'Profit/(Loss) before income tax',
    values: [options.pbtOverride ?? 52_482, 48_389, 50_919, 46_844],
  });
  add({ label: 'Income tax expense', values: [-14_806, -13_644, -14_806, -13_644], note: '8' });
  add({
    label: 'Profit/(Loss) after income tax',
    values: [options.netOverride ?? 37_676, 34_745, 36_113, 33_200],
  });
  add({
    label: 'Increase (decrease) in revaluation surplus',
    values: [46_640, -13_750, 46_640, -13_750],
    note: '10,11c)',
  });
  // Wrapped OCI tax label: label line, money-only line, label line.
  items.push(...renderRow(
    { label: 'Income tax expense on increase (decrease) in', values: [null, null, null, null] },
    pageNumber,
    y,
  ));
  y -= 13;
  items.push(
    ...renderRow(
      {
        label: '',
        values: [options.ociTaxOverride ?? -13_334, 4_325, -13_334, 4_325],
      },
      pageNumber,
      y,
      -1,
    ).filter((entry) => entry.str !== ''),
  );
  y -= 13;
  items.push(...renderRow({ label: 'revaluation surplus', values: [null, null, null, null] }, pageNumber, y));
  y -= 13;
  // Wrapped total OCI label.
  items.push(...renderRow(
    { label: 'Total other comprehensive income net of', values: [null, null, null, null] },
    pageNumber,
    y,
  ));
  y -= 13;
  items.push(
    ...renderRow(
      { label: '', values: [33_306, -9_425, 33_306, -9_425] },
      pageNumber,
      y,
      -1,
    ).filter((entry) => entry.str !== ''),
  );
  y -= 13;
  items.push(...renderRow({ label: 'income tax', values: [null, null, null, null] }, pageNumber, y));
  y -= 13;
  add({
    label: 'Total comprehensive income for the year',
    values: [options.comprehensiveOverride ?? 70_982, 25_320, 69_419, 23_775],
  });
  return {
    page_number: pageNumber,
    text: `Consolidated Statement of Comprehensive Income FOR THE YEAR ENDED 30 JUNE 2026 Consolidated Parent Income from operations Revenue from contracts with customers Other income Income from operations Expenses from operations Employee benefits expenses Supplies and services Depreciation and amortisation Impairment losses / fair value adjustments Other expenses Expenses from operations Operating result Financial income Financial expenses Interest expense on lease liabilities Net finance costs Profit/(Loss) before income tax Income tax expense Profit/(Loss) after income tax Increase (decrease) in revaluation surplus Income tax expense on increase (decrease) in revaluation surplus Total other comprehensive income net of income tax Total comprehensive income for the year`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: TABLED_PDF, sha256: 'a'.repeat(64), bytes: 5_530_354 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: NqbpParseContext = {
  document_url: TABLED_PDF,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/qld-nqbp/NQBP-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 5_530_354,
  },
  source_date: '2026-11-19',
  access: 'qld-parliament-fallback',
};

function recordFor(result: ReturnType<typeof parseNqbpExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('NQBP annual-report discovery', () => {
  it('selects the newest official annual report and rejects the SCI', () => {
    const html = `
      <a href="https://nqbp.com.au/sites/default/files/NQBP-Annual-Report-2024-25.pdf">2024-25</a>
      <a href="${OFFICIAL_PDF}">2025-26</a>
      <a href="https://nqbp.com.au/sites/default/files/NQBP-Statement-of-Corporate-Intent-2025-26.pdf">SCI</a>`;
    const links = parseNqbpAnnualReportPdfLinks(html, 'https://nqbp.com.au/about-us/publications');
    expect(links[0]).toMatchObject({
      url: OFFICIAL_PDF,
      filename: 'NQBP-Annual-Report-2025-26.pdf',
      fiscal_year: '2025-26',
      access: 'official',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.some((link) => /corporate-intent/i.test(link.filename))).toBe(false);
  });

  it('maps filename spans and year-ended years and rejects malformed spans', () => {
    expect(nqbpFiscalYearFromFilename('NQBP-Annual-Report-2025-26.pdf')).toBe('2025-26');
    expect(nqbpFiscalYearFromFilename('NQBP-Annual-Report-2024-2025.pdf')).toBe('2024-25');
    expect(nqbpFiscalYearFromFilename('NQBP-Annual-Report-2026.pdf')).toBe('2025-26');
    expect(nqbpFiscalYearFromFilename('NQBP-Annual-Report-2025-27.pdf')).toBeNull();
    expect(nqbpFiscalYearFromFilename('NQBP-Statement-of-Corporate-Intent-2025-26.pdf')).toBeNull();
  });

  it('falls back to the documented Parliament tabled copy when the official page is 403', async () => {
    const fetchImpl = (async () => new Response('blocked', { status: 403 })) as typeof fetch;
    const latest = await discoverNqbpAnnualReport(fetchImpl);
    expect(latest).toEqual(nqbpParliamentFallback());
    expect(latest.url).toBe(NQBP_PARLIAMENT_FALLBACK_URL);
    expect(latest.access).toBe('qld-parliament-fallback');
    expect(latest.fiscal_year).toBe('2025-26');
  });

  it('uses the official page when it is accessible', async () => {
    const fetchImpl = (async () =>
      new Response(`<a href="${OFFICIAL_PDF}">2025-26</a>`, { status: 200 })) as typeof fetch;
    const latest = await discoverNqbpAnnualReport(fetchImpl);
    expect(latest.url).toBe(OFFICIAL_PDF);
    expect(latest.access).toBe('official');
  });
});

describe('NQBP $000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per unit', () => {
    const unit = detectNqbpUnit(["$'000 2026 $'000 2025"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseNqbpExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parseNqbpStatement(facePage({ unit: '$m' }));
    expect(millions?.unit.kind).toBe('millions');

    const millionsDeferral = parseNqbpExtraction(extraction({ unit: '$m' }), context);
    expect(millionsDeferral.records).toHaveLength(0);
    expect(millionsDeferral.deferral?.phase).toBe('unit');

    const dollars = parseNqbpExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('NQBP exact reconciliation and rows', () => {
  it('reads the consolidated current-year column and reconciles every bridge exactly', () => {
    const result = parseNqbpExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.income_from_operations).toBe(153_109);
    expect(result.statement?.expenses_from_operations).toBe(96_172);
    expect(result.statement?.employee_expenses).toBe(32_271);
    expect(result.statement?.depreciation_amortisation).toBe(14_312);
    expect(result.statement?.net_finance_costs).toBe(-4_455);
    expect(result.statement?.profit_before_tax).toBe(52_482);
    expect(result.statement?.net_result).toBe(37_676);
    expect(result.statement?.total_oci).toBe(33_306);
    expect(result.statement?.total_comprehensive_income).toBe(70_982);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'income components exact: 109092 + 44017 = 153109 (printed Income from operations 153109)',
    );
    expect(checks).toContain(
      'expense components exact: 32271 + 43469 + 14312 + 275 + 5845 = 96172 (printed Expenses from operations 96172)',
    );
    expect(checks).toContain(
      'operating-result bridge exact: 153109 - 96172 = 56937 (printed 56937)',
    );
    expect(checks).toContain(
      'net-finance bridge exact: 4103 + -8340 + -218 = -4455 (printed -4455)',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: 56937 + -4455 = 52482 (printed 52482)',
    );
    expect(checks).toContain('net-result bridge exact: 52482 + -14806 = 37676 (printed 37676)');
    expect(checks).toContain('total-oci bridge exact: 46640 + -13334 = 33306 (printed 33306)');
    expect(checks).toContain(
      'total-comprehensive-income bridge exact: 37676 + 33306 = 70982 (printed 70982)',
    );
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseNqbpExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 9_617_200_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'QLD',
      delivery_entity: 'North Queensland Bulk Ports Corporation Limited',
      funding_source: 'North Queensland Bulk Ports Corporation Limited',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: NQBP_ID,
      source_url: TABLED_PDF,
      source_dataset: 'NQBP Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Consolidated statement of comprehensive income',
      extraction_confidence: 'high',
      location: { state: 'QLD' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(15_310_900_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(3_227_100_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(1_431_200_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 3_767_600_000,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on income/expense component mismatches', () => {
    const income = parseNqbpExtraction(extraction({ totalIncomeOverride: 153_110 }), context);
    expect(income.records).toHaveLength(0);
    expect(income.deferral?.phase).toBe('reconciliation');
    expect(income.deferral?.reason).toMatch(/income component total mismatch/i);

    const expense = parseNqbpExtraction(extraction({ totalExpensesOverride: -96_173 }), context);
    expect(expense.records).toHaveLength(0);
    expect(expense.deferral?.phase).toBe('reconciliation');
    expect(expense.deferral?.reason).toMatch(/expense component total mismatch/i);
  });

  it('defers on result-bridge mismatches', () => {
    const operating = parseNqbpExtraction(extraction({ operatingOverride: 56_938 }), context);
    expect(operating.records).toHaveLength(0);
    expect(operating.deferral?.reason).toMatch(/operating-result bridge mismatch/i);

    const pbt = parseNqbpExtraction(extraction({ pbtOverride: 52_483 }), context);
    expect(pbt.records).toHaveLength(0);
    expect(pbt.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);

    const net = parseNqbpExtraction(extraction({ netOverride: 37_677 }), context);
    expect(net.records).toHaveLength(0);
    expect(net.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers on OCI or comprehensive-income mismatches', () => {
    const oci = parseNqbpExtraction(extraction({ ociTaxOverride: -13_335 }), context);
    expect(oci.records).toHaveLength(0);
    expect(oci.deferral?.reason).toMatch(/total-oci bridge mismatch/i);

    const comprehensive = parseNqbpExtraction(
      extraction({ comprehensiveOverride: 70_983 }),
      context,
    );
    expect(comprehensive.records).toHaveLength(0);
    expect(comprehensive.deferral?.reason).toMatch(
      /total-comprehensive-income bridge mismatch/i,
    );
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseNqbpExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('NQBP natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = nqbpNaturalKey(
      'North Queensland Bulk Ports Corporation Limited',
      '2025-26',
      'total_expenses',
      TABLED_PDF,
    );
    expect(key).toMatch(/^qld-nqbp:[0-9a-f]{40}$/);
    expect(key).toBe(
      nqbpNaturalKey(
        'North Queensland Bulk Ports Corporation Limited',
        '2025-26',
        'total_expenses',
        TABLED_PDF,
      ),
    );
    expect(key).not.toBe(
      nqbpNaturalKey(
        'North Queensland Bulk Ports Corporation Limited',
        '2025-26',
        'total_revenue',
        TABLED_PDF,
      ),
    );
    expect(key).not.toBe(
      nqbpNaturalKey(
        'North Queensland Bulk Ports Corporation Limited',
        '2024-25',
        'total_expenses',
        TABLED_PDF,
      ),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseNqbpExtraction(extraction(), context);
    const second = parseNqbpExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('NQBP no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseNqbpExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['North Queensland Bulk Ports Corporation Limited']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['QLD']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(NQBP_ID);
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
