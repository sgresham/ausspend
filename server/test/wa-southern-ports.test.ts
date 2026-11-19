import { describe, expect, it } from 'vitest';
import {
  SOUTHERN_PORTS_ID,
  detectSouthernPortsUnit,
  discoverSouthernPortsAnnualReport,
  parseSouthernPortsAnnualReportPdfLinks,
  parseSouthernPortsExtraction,
  parseSouthernPortsStatement,
  southernPortsFiscalYearFromFilename,
  southernPortsNaturalKey,
  type SouthernPortsParseContext,
} from '../src/connectors/soc/wa/southern-ports.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.southernports.com.au/docs/default-source/report/annual-report-2026.pdf';

function item(str: string, x: number, y: number, page = 96, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 96): PdfTextItem {
  const width = Math.max(6, str.length * 3);
  return item(str, right - width, y, page, width);
}

const COLS = [662, 742];

interface RowSpec {
  label: string;
  values: Array<number | string | null>;
  note?: string;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function renderRow(row: RowSpec, pageNumber: number, y: number): PdfTextItem[] {
  const items: PdfTextItem[] = [item(row.label, 227, y, pageNumber)];
  if (row.note) items.push(item(row.note, 566, y, pageNumber));
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
  revenueOverride?: number;
  otherIncomeOverride?: number;
  employeeOverride?: number;
  pbtOverride?: number;
  netOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$’000';
  const pageNumber = 96;
  const items: PdfTextItem[] = [
    item('FINANCIAL REPORT', 43, 564, pageNumber),
    item('Statement of profit or loss and other comprehensive income', 227, 525, pageNumber),
    item('For the year ended 30 June 2026', 227, 511, pageNumber),
    item('Note', 556, 486, pageNumber),
    item('2026', 642, 486, pageNumber),
    item(`(${unit})`, 632, 477, pageNumber),
    item('2025', 722, 486, pageNumber),
    item(`(${unit})`, 711, 477, pageNumber),
  ];
  let y = 452;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y));
    y -= 10.8;
  };
  add({
    label: 'Revenue',
    values: [options.revenueOverride ?? 183_700, 169_577],
    note: '3',
  });
  add({
    label: 'Other income',
    values: [options.otherIncomeOverride ?? 10_098, 36_546],
    note: '4',
  });
  add({
    label: 'Employee benefits expense',
    values: [-(options.employeeOverride ?? 60_378), -67_299],
    note: '7',
  });
  add({ label: 'Contracts and services', values: [-53_348, -45_169] });
  add({ label: 'Utilities', values: [-8_652, -8_657] });
  add({ label: 'Depreciation', values: [-18_211, -15_056], note: '5' });
  add({ label: 'Impairment', values: [-732, -1_128], note: '13' });
  add({ label: 'Materials and supplies', values: [-8_218, -7_670] });
  add({ label: 'Government charges', values: [-7_275, -7_354] });
  add({ label: 'Finance costs', values: [-498, -573], note: '6' });
  add({ label: 'Insurance', values: [-3_417, -2_068] });
  add({ label: 'Other expenses', values: [-8_270, -3_359], note: '8' });
  add({
    label: 'Profit before income tax',
    values: [options.pbtOverride ?? 24_799, 47_790],
  });
  add({ label: 'Income tax expense', values: [-7_848, -14_645], note: '9' });
  add({
    label: 'PROFIT FOR THE YEAR',
    values: [options.netOverride ?? 16_951, 33_145],
  });
  return {
    page_number: pageNumber,
    text: `FINANCIAL REPORT Statement of profit or loss and other comprehensive income For the year ended 30 June 2026 Note 2026 ($’000) 2025 ($’000) Revenue Other income Employee benefits expense Contracts and services Utilities Depreciation Impairment Materials and supplies Government charges Finance costs Insurance Other expenses Profit before income tax Income tax expense PROFIT FOR THE YEAR`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 20_313_477 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: SouthernPortsParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/wa-southern-ports/Southern-Ports-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 20_313_477,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseSouthernPortsExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Southern Ports annual-report discovery', () => {
  it('selects the newest annual report, de-duplicates query variants and rejects strategic/modern-slavery PDFs', () => {
    const html = `
      <a href="/docs/default-source/report/sp-annual-report-2022.pdf?sfvrsn=1">2022</a>
      <a href="/docs/default-source/report/sp-annual-report-2023.pdf?sfvrsn=2">2023</a>
      <a href="/docs/default-source/report/sp-annual-report-2024.pdf?sfvrsn=3">2024</a>
      <a href="/docs/default-source/report/sp-annual-report-2025.pdf?sfvrsn=4">2025</a>
      <a href="${PDF_URL}">2026</a>
      <a href="${PDF_URL}?sfvrsn=1e1a9545_3&amp;Status=Master">2026 duplicate</a>
      <a href="/docs/default-source/corporate/our-strategic-direction-a3-poster.pdf?sfvrsn=5">Strategic direction</a>
      <a href="/docs/default-source/policies/spa-modern-slavery-2025fb00d755261847faaa5edbcc899967e3.pdf?sfvrsn=6">Modern slavery</a>`;
    const links = parseSouthernPortsAnnualReportPdfLinks(
      html,
      'https://www.southernports.com.au/governance/publications',
    );
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: 'annual-report-2026.pdf',
      fiscal_year: '2025-26',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual([
      '2025-26',
      '2024-25',
      '2023-24',
      '2022-23',
      '2021-22',
    ]);
    expect(links.filter((link) => link.fiscal_year === '2025-26')).toHaveLength(1);
    expect(links.some((link) => /strategic-direction|modern-slavery/i.test(link.filename))).toBe(
      false,
    );
  });

  it('maps year-ended filenames and rejects non-annual PDFs', () => {
    expect(southernPortsFiscalYearFromFilename('annual-report-2026.pdf')).toBe('2025-26');
    expect(southernPortsFiscalYearFromFilename('sp-annual-report-2025.pdf')).toBe('2024-25');
    expect(southernPortsFiscalYearFromFilename('sp-annual-report-2022.pdf')).toBe('2021-22');
    expect(
      southernPortsFiscalYearFromFilename('our-strategic-direction-a3-poster.pdf'),
    ).toBeNull();
    expect(
      southernPortsFiscalYearFromFilename('spa-modern-slavery-2025fb00d755261847faaa5edbcc899967e3.pdf'),
    ).toBeNull();
  });

  it('follows the publications page and returns its newest annual-report PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.southernports.com.au/governance/publications') {
        return new Response(
          `<a href="/docs/default-source/report/sp-annual-report-2025.pdf?sfvrsn=4">2025</a><a href="${PDF_URL}">2026</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverSouthernPortsAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual(['https://www.southernports.com.au/governance/publications']);
  });
});

describe('Southern Ports $000 unit guard', () => {
  it('detects the printed ($’000) unit at 100,000 cents per unit', () => {
    const unit = detectSouthernPortsUnit(["($'000) 2026 ($'000) 2025"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing', () => {
    const result = parseSouthernPortsExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parseSouthernPortsStatement(facePage({ unit: '$M' }));
    expect(millions?.unit.kind).toBe('millions');

    const millionsDeferral = parseSouthernPortsExtraction(extraction({ unit: '$M' }), context);
    expect(millionsDeferral.records).toHaveLength(0);
    expect(millionsDeferral.deferral?.phase).toBe('unit');

    const dollars = parseSouthernPortsExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('Southern Ports exact reconciliation and rows', () => {
  it('derives total income/expenses and reconciles every printed bridge exactly', () => {
    const result = parseSouthernPortsExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_income).toBe(193_798);
    expect(result.statement?.total_expenses).toBe(168_999);
    expect(result.statement?.employee_benefits).toBe(60_378);
    expect(result.statement?.depreciation).toBe(18_211);
    expect(result.statement?.profit_before_tax).toBe(24_799);
    expect(result.statement?.net_result).toBe(16_951);
    const checks = result.checks.join(' ');
    expect(checks).toContain('total income exact: 183700 + 10098 = 193798');
    expect(checks).toContain(
      'total expenses exact: 60378 + 53348 + 8652 + 18211 + 732 + 8218 + 7275 + 498 + 3417 + 8270 = 168999',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: 193798 - 168999 = 24799 (printed 24799)',
    );
    expect(checks).toContain('net-result bridge exact: 24799 + -7848 = 16951 (printed 16951)');
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseSouthernPortsExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 16_899_900_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'WA',
      delivery_entity: 'Southern Ports',
      funding_source: 'Southern Ports',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: SOUTHERN_PORTS_ID,
      source_url: PDF_URL,
      source_dataset: 'Southern Ports Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Statement of profit or loss and other comprehensive income',
      extraction_confidence: 'high',
      location: { state: 'WA' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(19_379_800_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(6_037_800_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(1_821_100_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 1_695_100_000,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on a profit-before-tax mismatch', () => {
    const result = parseSouthernPortsExtraction(extraction({ pbtOverride: 24_800 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers on a net-result mismatch', () => {
    const result = parseSouthernPortsExtraction(extraction({ netOverride: 16_952 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers on a component change that breaks the derived-income bridge', () => {
    const result = parseSouthernPortsExtraction(
      extraction({ revenueOverride: 183_701 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseSouthernPortsExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Southern Ports natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = southernPortsNaturalKey('Southern Ports', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^wa-southern-ports:[0-9a-f]{40}$/);
    expect(key).toBe(
      southernPortsNaturalKey('Southern Ports', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      southernPortsNaturalKey('Southern Ports', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      southernPortsNaturalKey('Southern Ports', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseSouthernPortsExtraction(extraction(), context);
    const second = parseSouthernPortsExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Southern Ports no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive, WA-only and excluded from the generic spending query', () => {
    const result = parseSouthernPortsExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Southern Ports']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['WA']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(SOUTHERN_PORTS_ID);
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
