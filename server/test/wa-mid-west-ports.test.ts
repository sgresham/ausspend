import { describe, expect, it } from 'vitest';
import {
  MID_WEST_PORTS_ID,
  detectMidWestPortsUnit,
  discoverMidWestPortsAnnualReport,
  midWestPortsFiscalYearFromFilename,
  midWestPortsNaturalKey,
  parseMidWestPortsAnnualReportPdfLinks,
  parseMidWestPortsExtraction,
  parseMidWestPortsStatement,
  type MidWestPortsParseContext,
} from '../src/connectors/soc/wa/mid-west-ports.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.midwestports.com.au/Profiles/midwestports/Assets/ClientData/Documents/AnnualReport/2025-26/MWP16729_Annual_Report_2026_A4_LNDSCP_V25_LR_WEB_SPREADS.pdf';

function item(str: string, x: number, y: number, page = 42, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 42): PdfTextItem {
  const width = Math.max(6, str.length * 4);
  return item(str, right - width, y, page, width);
}

// The face statement sits in the left half of a landscape page: 2026 column
// values end at x≈347 and 2025 column values end at x≈403.
const COLS = [347, 403];
const LABEL_X = 54;
const NOTE_X = 286;

interface RowSpec {
  label: string;
  values: Array<number | null>;
  note?: string;
}

function numberCell(value: number): string {
  return Math.abs(value).toLocaleString('en-AU');
}

function renderRow(row: RowSpec, pageNumber: number, y: number): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  if (row.label) items.push(item(row.label, LABEL_X, y, pageNumber));
  if (row.note) items.push(item(row.note, NOTE_X, y, pageNumber));
  row.values.forEach((value, index) => {
    if (value === null) return;
    const right = COLS[index] as number;
    const text = value < 0 ? `(${numberCell(value)})` : numberCell(value);
    items.push(money(text, right, y, pageNumber));
  });
  return items;
}

interface StatementOptions {
  unit?: string;
  employeeOverride?: number;
  pbtOverride?: number;
  netOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$’000';
  const pageNumber = 42;
  const items: PdfTextItem[] = [
    item('5.2 Statement of Profit or Loss and Other Comprehensive Income', 50, 520.6, pageNumber),
    item('For the year ended 30 June 2026', 50, 509.6, pageNumber),
    item('Note', 273, 492.7, pageNumber),
    item('2026', 330, 492.7, pageNumber),
    item('2025', 386, 492.7, pageNumber),
  ];
  if (unit) {
    items.push(item(unit, 329, 480.4, pageNumber));
    items.push(item(unit, 385, 480.4, pageNumber));
  }
  let y = 455.7;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y));
    y -= 12.3;
  };
  add({ label: 'Revenue', values: [138_740, 117_077], note: '2' });
  add({ label: 'Other income', values: [4_309, 4_723], note: '3' });
  add({
    label: 'Employee benefit expense',
    values: [-(options.employeeOverride ?? 38_224), -33_268],
    note: '4',
  });
  add({ label: 'Supplies and services', values: [-15_845, -13_702], note: '5' });
  add({ label: 'Asset maintenance', values: [-16_178, -13_874] });
  add({ label: 'Government charges', values: [-1_970, -1_736] });
  add({ label: 'Utilities', values: [-824, -863] });
  add({
    label: 'Depreciation, amortisation and impairment',
    values: [-11_698, -9_906],
    note: '14',
  });
  add({ label: 'Insurance', values: [-1_396, -1_398] });
  add({ label: 'Finance costs', values: [-334, -368], note: '6' });
  add({ label: 'Other expenses', values: [-5_853, -5_291], note: '7' });
  add({ label: 'Profit before income tax', values: [options.pbtOverride ?? 50_727, 41_394] });
  add({ label: 'Income tax expense', values: [-15_698, -12_441], note: '9' });
  add({ label: 'Profit for the year', values: [options.netOverride ?? 35_029, 28_953] });
  return {
    page_number: pageNumber,
    text: `5.2 Statement of Profit or Loss and Other Comprehensive Income For the year ended 30 June 2026 Note 2026 2025 ${unit} ${unit} Income Revenue Other income Expenditure Employee benefit expense Supplies and services Asset maintenance Government charges Utilities Depreciation, amortisation and impairment Insurance Finance costs Other expenses Profit before income tax Income tax expense Profit for the year`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'b'.repeat(64), bytes: 10_824_762 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: MidWestPortsParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/wa-mid-west-ports/Mid-West-Ports-Annual-Report-2025-26.pdf',
    sha256: 'b'.repeat(64),
    bytes: 10_824_762,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseMidWestPortsExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Mid West Ports annual-report discovery', () => {
  it('selects the newest annual report and rejects handbooks, trade statistics and other publications', () => {
    const html = `
      <a href="/Profiles/midwestports/Assets/ClientData/Documents/AnnualReport/2025-26/MWP16729_Annual_Report_2026_A4_LNDSCP_V25_LR_WEB_SPREADS.pdf">2026</a>
      <a href="/Profiles/midwestports/Assets/ClientData/Documents/AnnualReport/mwpa-annual-report-2024-2025.pdf">2025</a>
      <a href="/Profiles/midwestports/Assets/ClientData/Documents/AnnualReport/mwpa-annual-report-2023-2024.pdf">2024</a>
      <a href="/Profiles/midwestports/Assets/ClientData/Documents/AnnualReport/2015-2016.pdf">Archived copy</a>
      <a href="/Profiles/midwestports/Assets/ClientData/Documents/Port-Handbook-2025.pdf">Port handbook</a>
      <a href="/Profiles/midwestports/Assets/ClientData/Documents/Trade-Statistics-2025.pdf">Trade statistics</a>
      <a href="/Profiles/midwestports/Assets/ClientData/Documents/Statement-of-Corporate-Intent-2026.pdf">SCI</a>`;
    const links = parseMidWestPortsAnnualReportPdfLinks(
      html,
      'https://www.midwestports.com.au/our-port/publications/annual-reports.aspx',
    );
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: 'MWP16729_Annual_Report_2026_A4_LNDSCP_V25_LR_WEB_SPREADS.pdf',
      fiscal_year: '2025-26',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(
      links.some((link) => /handbook|trade-statistics|corporate-intent/i.test(link.filename)),
    ).toBe(false);
  });

  it('maps year-ended single-year and two-year span filenames and rejects non-annual reports', () => {
    expect(
      midWestPortsFiscalYearFromFilename(
        'MWP16729_Annual_Report_2026_A4_LNDSCP_V25_LR_WEB_SPREADS.pdf',
      ),
    ).toBe('2025-26');
    expect(midWestPortsFiscalYearFromFilename('mwpa-annual-report-2024-2025.pdf')).toBe('2024-25');
    expect(midWestPortsFiscalYearFromFilename('mwpa-annual-report-2023-2024.pdf')).toBe('2023-24');
    expect(midWestPortsFiscalYearFromFilename('Port-Handbook-2025.pdf')).toBeNull();
    expect(midWestPortsFiscalYearFromFilename('Trade-Statistics-2025.pdf')).toBeNull();
  });

  it('follows the official annual-reports page and returns its newest PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.midwestports.com.au/our-port/publications/annual-reports.aspx') {
        return new Response(
          `<a href="/Profiles/midwestports/Assets/ClientData/Documents/AnnualReport/mwpa-annual-report-2024-2025.pdf">2025</a><a href="${PDF_URL}">2026</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverMidWestPortsAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual([
      'https://www.midwestports.com.au/our-port/publications/annual-reports.aspx',
    ]);
  });

  it('refuses to guess a PDF URL when the official page has no annual-report link', async () => {
    const fetchImpl = (async () =>
      new Response('<a href="/handbook.pdf">handbook</a>', { status: 200 })) as typeof fetch;
    await expect(discoverMidWestPortsAnnualReport(fetchImpl)).rejects.toThrow(
      /no annual-report PDF link/i,
    );
  });
});

describe('Mid West Ports $’000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per thousand', () => {
    const unit = detectMidWestPortsUnit(['$’000 2026 $’000 2025']);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing a magnitude', () => {
    const result = parseMidWestPortsExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as whole dollars or millions instead of $’000', () => {
    const dollars = parseMidWestPortsExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');

    const millions = parseMidWestPortsExtraction(extraction({ unit: '$M' }), context);
    expect(millions.records).toHaveLength(0);
    expect(millions.deferral?.phase).toBe('unit');
  });
});

describe('Mid West Ports exact reconciliation and rows', () => {
  it('reconciles the derived totals and every printed bridge exactly', () => {
    const result = parseMidWestPortsExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_income).toBe(143_049);
    expect(result.statement?.total_expenses).toBe(92_322);
    expect(result.statement?.employee_expenses).toBe(38_224);
    expect(result.statement?.depreciation_amortisation_impairment).toBe(11_698);
    expect(result.statement?.profit_before_tax).toBe(50_727);
    expect(result.statement?.net_result).toBe(35_029);
    const checks = result.checks.join(' ');
    expect(checks).toContain('total income exact: 138740 + 4309 = 143049');
    expect(checks).toContain(
      'total expenses exact: 38224 + 15845 + 16178 + 1970 + 824 + 11698 + 1396 + 334 + 5853 = 92322',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: 143049 - 92322 = 50727 (printed 50727)',
    );
    expect(checks).toContain('net-result bridge exact: 50727 + -15698 = 35029 (printed 35029)');
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseMidWestPortsExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 9_232_200_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'WA',
      delivery_entity: 'Mid West Ports',
      funding_source: 'Mid West Ports',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: MID_WEST_PORTS_ID,
      source_url: PDF_URL,
      source_dataset: 'Mid West Ports Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Statement of Profit or Loss and Other Comprehensive Income',
      extraction_confidence: 'high',
      location: { state: 'WA' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(14_304_900_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(3_822_400_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(1_169_800_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 3_502_900_000,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on an expense component that breaks the profit-before-tax bridge', () => {
    const result = parseMidWestPortsExtraction(extraction({ employeeOverride: 38_225 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers on a profit-before-tax mismatch', () => {
    const result = parseMidWestPortsExtraction(extraction({ pbtOverride: 50_728 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers on a net-result mismatch', () => {
    const result = parseMidWestPortsExtraction(extraction({ netOverride: 35_030 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseMidWestPortsExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });

  it('returns null when the required printed lines cannot be read', () => {
    const page = facePage();
    page.items = page.items.filter((entry) => entry.str !== 'Revenue');
    expect(parseMidWestPortsStatement(page)).toBeNull();
  });
});

describe('Mid West Ports natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = midWestPortsNaturalKey('Mid West Ports', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^wa-mid-west-ports:[0-9a-f]{40}$/);
    expect(key).toBe(
      midWestPortsNaturalKey('Mid West Ports', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      midWestPortsNaturalKey('Mid West Ports', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      midWestPortsNaturalKey('Mid West Ports', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseMidWestPortsExtraction(extraction(), context);
    const second = parseMidWestPortsExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Mid West Ports no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive, WA-only and excluded from the generic spending query', () => {
    const result = parseMidWestPortsExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Mid West Ports']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['WA']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(MID_WEST_PORTS_ID);
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
