import { describe, expect, it } from 'vitest';
import {
  SYNERGY_ID,
  detectSynergyUnit,
  discoverSynergyAnnualReport,
  parseSynergyAnnualReportPageLinks,
  parseSynergyAnnualReportPdfLinks,
  parseSynergyExtraction,
  parseSynergyStatement,
  synergyFiscalYearFromYear,
  synergyNaturalKey,
  type SynergyParseContext,
} from '../src/connectors/soc/wa/synergy.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.synergy.net.au/-/media/Documents/Reports/Synergy-Annual-Report-2026.pdf';

function item(str: string, x: number, y: number, page = 55, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 55): PdfTextItem {
  const width = Math.max(6, str.length * 4);
  return item(str, right - width, y, page, width);
}

const COLS = [351, 408, 466, 523];

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
  if (row.note) items.push(item(row.note, 262, y, pageNumber));
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
  netFinanceOverride?: number;
  pbtOverride?: number;
  netOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? "$'000";
  const pageNumber = 55;
  const items: PdfTextItem[] = [
    item('Statement of profit or loss', 44, 736, pageNumber),
    item('For the year ended 30 June 2026', 44, 718, pageNumber),
    item('Group', 344, 692, pageNumber),
    item('Corporation', 447, 692, pageNumber),
    item('2026', 335, 671, pageNumber),
    item('2025', 392, 671, pageNumber),
    item('2026', 449, 671, pageNumber),
    item('2025', 507, 671, pageNumber),
    item('Note', 262, 657, pageNumber),
    item(unit, 333, 657, pageNumber),
    item(unit, 390, 657, pageNumber),
    item(unit, 448, 657, pageNumber),
    item(unit, 505, 657, pageNumber),
  ];
  let y = 628;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y));
    y -= 15;
  };
  add({
    label: 'Sales revenue',
    values: [3_523_507, 3_500_550, 3_523_507, 3_500_550],
    note: '2.1',
  });
  add({ label: 'Other revenue', values: [384_650, 273_504, 386_576, 277_993], note: '2.1' });
  add({
    label: 'Total revenue',
    values: [options.totalRevenueOverride ?? 3_908_157, 3_774_054, 3_910_083, 3_778_543],
  });
  add({
    label: 'Fuel, networks and other direct costs',
    values: [-3_362_040, -3_284_047, -3_362_040, -3_284_047],
    note: '2.3',
  });
  add({
    label: 'Materials and services',
    values: [-111_891, -141_805, -111_891, -141_805],
    note: '2.3',
  });
  add({
    label: 'Employee expenses',
    values: [-220_605, -216_625, -220_029, -216_084],
    note: '2.3',
  });
  add({ label: 'Other expenses', values: [-257_100, -243_378, -261_719, -251_620], note: '2.3' });
  add({
    label: 'Depreciation and amortisation',
    values: [-165_236, -69_792, -164_794, -69_569],
    note: '4.1/4.2/4.3',
  });
  add({
    label: 'Other impairment expenses',
    values: [-84_802, -549_632, -84_802, -549_632],
    note: '2.3',
  });
  add({
    label: 'Total expenses',
    values: [options.totalExpensesOverride ?? -4_201_674, -4_505_279, -4_205_275, -4_512_757],
  });
  add({ label: 'Other operating income', values: [12_211, 25_667, 15_517, 32_179], note: '2.2' });
  add({ label: 'Finance income', values: [6_230, 12_069, 5_967, 11_717] });
  add({ label: 'Finance costs', values: [-107_763, -87_264, -107_763, -87_264] });
  add({
    label: 'Net finance costs',
    values: [options.netFinanceOverride ?? -101_533, -75_195, -101_796, -75_547],
    note: '2.4',
  });
  add({ label: 'Share of profit from joint ventures', values: ['-', 2_222, '-', '-'], note: '5.5' });
  add({ label: 'Share of profit from associates', values: [408, '-', '-', '-'], note: '5.5' });
  add({
    label: 'Loss before tax',
    values: [options.pbtOverride ?? -382_431, -778_531, -381_471, -777_582],
  });
  add({ label: 'Income tax expense', values: [-166, -396, '-', '-'], note: '2.5' });
  add({
    label: 'Loss for the year',
    values: [options.netOverride ?? -382_597, -778_927, -381_471, -777_582],
  });
  return {
    page_number: pageNumber,
    text: `Statement of profit or loss For the year ended 30 June 2026 Group Corporation Note 2026 2025 2026 2025 $'000 $'000 $'000 $'000 Sales revenue Other revenue Total revenue Fuel, networks and other direct costs Materials and services Employee expenses Other expenses Depreciation and amortisation Other impairment expenses Total expenses Other operating income Finance income Finance costs Net finance costs Share of profit from joint ventures Share of profit from associates Loss before tax Income tax expense Loss for the year`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 12_603_580 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: SynergyParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/wa-synergy/Synergy-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 12_603_580,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseSynergyExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Synergy annual-report discovery', () => {
  it('selects the newest landing page and PDF and rejects non-annual pages', () => {
    const indexHtml = `
      <a href="/About-us/News-and-announcements/Annual-reports/Synergy-2024-annual-report">2024</a>
      <a href="/About-us/News-and-announcements/Annual-reports/Synergy-2025-annual-report">2025</a>
      <a href="/About-us/News-and-announcements/Annual-reports/Synergy-2026-annual-report">2026</a>
      <a href="/About-us/News-and-announcements/Media-releases/Synergy-2026-media-release">Media</a>`;
    const pages = parseSynergyAnnualReportPageLinks(
      indexHtml,
      'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports',
    );
    expect(pages.map((page) => page.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(pages[0]).toMatchObject({
      url: 'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports/Synergy-2026-annual-report',
      discovery_page:
        'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports',
    });

    const pageHtml = `<a href="/-/media/Documents/Reports/Synergy-Annual-Report-2026.pdf">PDF</a>`;
    const pdfs = parseSynergyAnnualReportPdfLinks(
      pageHtml,
      'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports/Synergy-2026-annual-report',
    );
    expect(pdfs[0]).toMatchObject({
      url: PDF_URL,
      fiscal_year: '2025-26',
      filename: 'Synergy-Annual-Report-2026.pdf',
    });
  });

  it('maps year-ended report years', () => {
    expect(synergyFiscalYearFromYear('2026')).toBe('2025-26');
    expect(synergyFiscalYearFromYear('2021')).toBe('2020-21');
  });

  it('follows the index to the newest landing page and returns its PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports') {
        return new Response(
          '<a href="/About-us/News-and-announcements/Annual-reports/Synergy-2025-annual-report">2025</a><a href="/About-us/News-and-announcements/Annual-reports/Synergy-2026-annual-report">2026</a>',
          { status: 200 },
        );
      }
      if (
        url ===
        'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports/Synergy-2026-annual-report'
      ) {
        return new Response(`<a href="${PDF_URL}">PDF</a>`, { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverSynergyAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual([
      'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports',
      'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports/Synergy-2026-annual-report',
    ]);
  });
});

describe('Synergy $000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per unit', () => {
    const unit = detectSynergyUnit(["$'000 2026 $'000 2025"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing', () => {
    const result = parseSynergyExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parseSynergyStatement(facePage({ unit: '$M' }));
    expect(millions?.unit.kind).toBe('millions');

    const millionsDeferral = parseSynergyExtraction(extraction({ unit: '$M' }), context);
    expect(millionsDeferral.records).toHaveLength(0);
    expect(millionsDeferral.deferral?.phase).toBe('unit');

    const dollars = parseSynergyExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('Synergy exact reconciliation and rows', () => {
  it('reads the Group current-year column and reconciles every bridge exactly', () => {
    const result = parseSynergyExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(3_908_157);
    expect(result.statement?.total_expenses).toBe(4_201_674);
    expect(result.statement?.employee_expenses).toBe(220_605);
    expect(result.statement?.depreciation_amortisation).toBe(165_236);
    expect(result.statement?.net_finance_costs).toBe(-101_533);
    expect(result.statement?.loss_before_tax).toBe(-382_431);
    expect(result.statement?.net_result).toBe(-382_597);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'revenue components exact: 3523507 + 384650 = 3908157 (printed Total revenue 3908157)',
    );
    expect(checks).toContain(
      'expense components exact: 3362040 + 111891 + 220605 + 257100 + 165236 + 84802 = 4201674 (printed Total expenses 4201674)',
    );
    expect(checks).toContain(
      'net-finance bridge exact: 6230 - 107763 = -101533 (printed -101533)',
    );
    expect(checks).toContain(
      'loss-before-tax bridge exact: 3908157 - 4201674 + 12211 + -101533 + 0 + 408 = -382431 (printed -382431)',
    );
    expect(checks).toContain('net-result bridge exact: -382431 + -166 = -382597 (printed -382597)');
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseSynergyExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 420_167_400_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'WA',
      delivery_entity: 'Synergy',
      funding_source: 'Synergy',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: SYNERGY_ID,
      source_url: PDF_URL,
      source_dataset: 'Synergy Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Statement of profit or loss',
      extraction_confidence: 'high',
      location: { state: 'WA' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(390_815_700_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(22_060_500_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(16_523_600_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 38_259_700_000,
      soc_printed_sign: 'negative',
    });
  });

  it('defers on revenue/expense component mismatches', () => {
    const revenue = parseSynergyExtraction(
      extraction({ totalRevenueOverride: 3_908_158 }),
      context,
    );
    expect(revenue.records).toHaveLength(0);
    expect(revenue.deferral?.phase).toBe('reconciliation');
    expect(revenue.deferral?.reason).toMatch(/revenue component total mismatch/i);

    const expenses = parseSynergyExtraction(
      extraction({ totalExpensesOverride: -4_201_675 }),
      context,
    );
    expect(expenses.records).toHaveLength(0);
    expect(expenses.deferral?.phase).toBe('reconciliation');
    expect(expenses.deferral?.reason).toMatch(/expense component total mismatch/i);
  });

  it('defers on net-finance, loss-before-tax or net-result mismatches', () => {
    const netFinance = parseSynergyExtraction(
      extraction({ netFinanceOverride: -101_534 }),
      context,
    );
    expect(netFinance.records).toHaveLength(0);
    expect(netFinance.deferral?.reason).toMatch(/net-finance bridge mismatch/i);

    const pbt = parseSynergyExtraction(extraction({ pbtOverride: -382_430 }), context);
    expect(pbt.records).toHaveLength(0);
    expect(pbt.deferral?.reason).toMatch(/loss-before-tax bridge mismatch/i);

    const net = parseSynergyExtraction(extraction({ netOverride: -382_598 }), context);
    expect(net.records).toHaveLength(0);
    expect(net.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseSynergyExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Synergy natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = synergyNaturalKey('Synergy', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^wa-synergy:[0-9a-f]{40}$/);
    expect(key).toBe(synergyNaturalKey('Synergy', '2025-26', 'total_expenses', PDF_URL));
    expect(key).not.toBe(synergyNaturalKey('Synergy', '2025-26', 'total_revenue', PDF_URL));
    expect(key).not.toBe(synergyNaturalKey('Synergy', '2024-25', 'total_expenses', PDF_URL));
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseSynergyExtraction(extraction(), context);
    const second = parseSynergyExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Synergy no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive, WA-only and excluded from the generic spending query', () => {
    const result = parseSynergyExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Synergy']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['WA']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(SYNERGY_ID);
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
