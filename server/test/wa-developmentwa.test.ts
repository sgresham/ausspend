import { describe, expect, it } from 'vitest';
import {
  DEVELOPMENTWA_ID,
  detectDevelopmentWaUnit,
  developmentWaFiscalYearFromFilename,
  developmentWaNaturalKey,
  discoverDevelopmentWaAnnualReport,
  parseDevelopmentWaAnnualReportPdfLinks,
  parseDevelopmentWaExtraction,
  parseDevelopmentWaStatement,
  type DevelopmentWaParseContext,
} from '../src/connectors/soc/wa/developmentwa.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.developmentwa.com.au/component/edocman/2257-2025-2026-annual-and-sustainability-report-developmentwa/download';

function item(str: string, x: number, y: number, page = 95, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 95): PdfTextItem {
  const width = Math.max(6, str.length * 3);
  return item(str, right - width, y, page, width);
}

const FACE_COLS = [350, 390];
const NOTE_COLS = [719, 767];

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
  labelX: number,
  noteX: number,
  cols: number[],
): PdfTextItem[] {
  const items: PdfTextItem[] = [item(row.label, labelX, y, pageNumber)];
  if (row.note) items.push(item(row.note, noteX, y, pageNumber));
  row.values.forEach((value, index) => {
    const right = cols[index] as number;
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
  employeeOverride?: number;
  pbtOverride?: number;
  netOverride?: number;
  noteDepreciationOverride?: number;
  noteTotalOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$’000';
  const pageNumber = 95;
  const items: PdfTextItem[] = [
    item('WESTERN AUSTRALIAN LAND AUTHORITY', 43, 506, pageNumber),
    item('Statement of profit or loss and other comprehensive income', 43, 480, pageNumber),
    item('For the year ended 30 June 2026', 43, 459, pageNumber),
    item('Notes', 285, 427, pageNumber),
    item('2026', 333, 427, pageNumber),
    item(unit, 330, 418, pageNumber),
    item('2025', 373, 427, pageNumber),
    item(unit, 370, 418, pageNumber),
  ];
  let y = 404;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y, 46, 288, FACE_COLS));
    y -= 13.9;
  };
  add({ label: 'Operating revenue', values: [options.revenueOverride ?? 1_103_122, 790_008], note: '2(a)' });
  add({ label: 'Operating expenses', values: [-770_535, -553_621], note: '2(b)' });
  add({ label: 'Gross profit', values: [332_587, 236_387] });
  add({ label: 'Other revenue', values: [19_258, 10_164], note: '2(a)' });
  add({ label: 'Estate holding expenses', values: [-55_492, -57_383] });
  add({
    label: 'Employee benefits expense',
    values: [-(options.employeeOverride ?? 42_999), -40_634],
  });
  add({ label: 'Consultant expenses', values: [-5_130, -7_180] });
  add({ label: 'Advertising, public relations and sponsorship', values: [-8_019, -7_647] });
  add({ label: 'Impairment reversal of trade receivables', values: [71, 1_084] });
  add({ label: 'Other expenses', values: [-56_244, -69_933], note: '2(b)' });
  add({ label: 'Results from operating activities', values: [184_032, 64_858] });
  add({ label: 'Finance income', values: [6_036, 5_521] });
  add({ label: 'Finance costs', values: [-1_099, -4_852] });
  add({ label: 'Net finance income', values: [4_937, 669] });
  add({
    label: 'Profit before income tax',
    values: [options.pbtOverride ?? 188_969, 65_527],
  });
  add({ label: 'Income tax expense', values: [-56_687, -19_644], note: '3(a)' });
  add({
    label: 'Profit for the year',
    values: [options.netOverride ?? 132_282, 45_883],
  });
  add({ label: 'Total comprehensive income for the year', values: [132_282, 45_883] });
  return {
    page_number: pageNumber,
    text: `WESTERN AUSTRALIAN LAND AUTHORITY Statement of profit or loss and other comprehensive income For the year ended 30 June 2026 Notes 2026 $’000 2025 $’000 Operating revenue Operating expenses Gross profit Other revenue Estate holding expenses Employee benefits expense Consultant expenses Advertising, public relations and sponsorship Impairment reversal of trade receivables Other expenses Results from operating activities Finance income Finance costs Net finance income Profit before income tax Income tax expense Profit for the year Total comprehensive income for the year`,
    items,
  };
}

function notePage(options: StatementOptions = {}): PdfPage {
  const unit = '$’000';
  const pageNumber = 103;
  const items: PdfTextItem[] = [
    item('b) Expenses from operating activities and other expenses', 418, 430, pageNumber),
    item('2026', 702, 410, pageNumber),
    item(unit, 699, 401, pageNumber),
    item('2025', 750, 410, pageNumber),
    item(unit, 748, 401, pageNumber),
    item('Other expenses from operating activities', 422, 303, pageNumber),
  ];
  let y = 289;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y, 422, 422, NOTE_COLS));
    y -= 14;
  };
  add({ label: 'Administration expenses', values: [-1_502, -3_277] });
  add({ label: 'Accommodation expenses', values: [-1_004, -828] });
  add({ label: 'Inventory impairment expense', values: [-34_690, -48_986] });
  add({ label: 'Loss on sale of non-current assets', values: [1, -47] });
  add({
    label: 'Depreciation and amortisation',
    values: [-(options.noteDepreciationOverride ?? 19_049), -16_795],
  });
  add({
    label: 'Total other expenses from operating activities',
    values: [-(options.noteTotalOverride ?? 56_244), -69_933],
  });
  return {
    page_number: pageNumber,
    text: `b) Expenses from operating activities and other expenses 2026 $’000 2025 $’000 Other expenses from operating activities Administration expenses Accommodation expenses Inventory impairment expense Loss on sale of non-current assets Depreciation and amortisation Total other expenses from operating activities`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 8_881_306 },
    pages: [facePage(options), notePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: DevelopmentWaParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/wa-developmentwa/DevelopmentWA-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 8_881_306,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseDevelopmentWaExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('DevelopmentWA annual-report discovery', () => {
  it('selects the newest DevelopmentWA annual report and rejects MRA/Landcorp/sustainability/plans', () => {
    const html = `
      <a href="/component/edocman/1174-2016-2017-mra-annual-report/download">MRA</a>
      <a href="/component/edocman/1176-2016-2017-landcorp-annual-report/download">Landcorp</a>
      <a href="/component/edocman/1848-2023-2024-annual-and-sustainability-report-developmentwa/download">2023-24</a>
      <a href="/component/edocman/1991-2024-2025-annual-and-sustainability-report-developmentwa/download">2024-25</a>
      <a href="/component/edocman/2257-2025-2026-annual-and-sustainability-report-developmentwa/download">2025-26</a>
      <a href="/component/edocman/2257-2025-2026-annual-and-sustainability-report-developmentwa/viewdocument/2257">view</a>
      <a href="/component/edocman/1508-2020-2021-sustainability-report-developmentwa/download">Sustainability</a>
      <a href="/component/edocman/2054-developmentwa-strategic-plan/download">Strategic plan</a>`;
    const links = parseDevelopmentWaAnnualReportPdfLinks(
      html,
      'https://www.developmentwa.com.au/publications',
    );
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: '2257-2025-2026-annual-and-sustainability-report-developmentwa.pdf',
      fiscal_year: '2025-26',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.some((link) => /^(1174|1176|1508|2054)-/.test(link.filename))).toBe(false);
  });

  it('maps DevelopmentWA slug year spans and rejects non-annual/WALA slugs', () => {
    expect(
      developmentWaFiscalYearFromFilename(
        '2257-2025-2026-annual-and-sustainability-report-developmentwa',
      ),
    ).toBe('2025-26');
    expect(
      developmentWaFiscalYearFromFilename(
        '1991-2024-2025-annual-and-sustainability-report-developmentwa',
      ),
    ).toBe('2024-25');
    expect(
      developmentWaFiscalYearFromFilename('1507-2020-2021-annual-report-developmentwa'),
    ).toBe('2020-21');
    expect(
      developmentWaFiscalYearFromFilename('1508-2020-2021-sustainability-report-developmentwa'),
    ).toBeNull();
    expect(
      developmentWaFiscalYearFromFilename('1174-2016-2017-mra-annual-report'),
    ).toBeNull();
    expect(developmentWaFiscalYearFromFilename('2054-developmentwa-strategic-plan')).toBeNull();
  });

  it('follows the publications page and returns its newest annual-report download', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.developmentwa.com.au/publications') {
        return new Response(
          `<a href="/component/edocman/1991-2024-2025-annual-and-sustainability-report-developmentwa/download">2024-25</a><a href="/component/edocman/2257-2025-2026-annual-and-sustainability-report-developmentwa/download">2025-26</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverDevelopmentWaAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual(['https://www.developmentwa.com.au/publications']);
  });
});

describe('DevelopmentWA $000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per unit', () => {
    const unit = detectDevelopmentWaUnit(["$'000 2026 $'000 2025"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing', () => {
    const result = parseDevelopmentWaExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parseDevelopmentWaStatement(facePage({ unit: '$M' }), notePage());
    expect(millions?.unit.kind).toBe('millions');

    const millionsDeferral = parseDevelopmentWaExtraction(extraction({ unit: '$M' }), context);
    expect(millionsDeferral.records).toHaveLength(0);
    expect(millionsDeferral.deferral?.phase).toBe('unit');

    const dollars = parseDevelopmentWaExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('DevelopmentWA exact reconciliation and rows', () => {
  it('derives total revenue/expenses and reconciles every printed bridge exactly', () => {
    const result = parseDevelopmentWaExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.note_unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(1_128_416);
    expect(result.statement?.total_expenses).toBe(939_518);
    expect(result.statement?.employee_expenses).toBe(42_999);
    expect(result.statement?.note_depreciation_amortisation).toBe(19_049);
    expect(result.statement?.profit_before_tax).toBe(188_969);
    expect(result.statement?.net_result).toBe(132_282);
    const checks = result.checks.join(' ');
    expect(checks).toContain('total revenue exact: 1103122 + 19258 + 6036 = 1128416');
    expect(checks).toContain(
      'total expenses exact: 770535 + 55492 + 42999 + 5130 + 8019 + 56244 + 1099 = 939518',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: 1128416 - 939518 + 71 = 188969 (printed 188969)',
    );
    expect(checks).toContain('net-result bridge exact: 188969 + -56687 = 132282 (printed 132282)');
    expect(checks).toContain(
      'Note 2(b) total other expenses equals face Other expenses: 56244',
    );
    expect(checks).toContain(
      'Note 2(b) depreciation 19049 is included within Other expenses 56244',
    );
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseDevelopmentWaExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 93_951_800_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'WA',
      delivery_entity: 'DevelopmentWA',
      funding_source: 'DevelopmentWA',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: DEVELOPMENTWA_ID,
      source_url: PDF_URL,
      source_dataset: 'DevelopmentWA Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Statement of profit or loss / Note 2(b)',
      extraction_confidence: 'high',
      location: { state: 'WA' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(112_841_600_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(4_299_900_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(1_904_900_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 13_228_200_000,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on a profit-before-tax mismatch', () => {
    const result = parseDevelopmentWaExtraction(extraction({ pbtOverride: 188_970 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers on a net-result mismatch', () => {
    const result = parseDevelopmentWaExtraction(extraction({ netOverride: 132_283 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers when Note 2(b) total does not equal the face Other expenses', () => {
    const result = parseDevelopmentWaExtraction(
      extraction({ noteTotalOverride: 56_245 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 2\(b\) total does not equal/i);
  });

  it('defers on a component change that breaks the derived-income bridge', () => {
    const result = parseDevelopmentWaExtraction(
      extraction({ revenueOverride: 1_103_123 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseDevelopmentWaExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('DevelopmentWA natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = developmentWaNaturalKey('DevelopmentWA', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^wa-developmentwa:[0-9a-f]{40}$/);
    expect(key).toBe(
      developmentWaNaturalKey('DevelopmentWA', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      developmentWaNaturalKey('DevelopmentWA', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      developmentWaNaturalKey('DevelopmentWA', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseDevelopmentWaExtraction(extraction(), context);
    const second = parseDevelopmentWaExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('DevelopmentWA no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive, WA-only and excluded from the generic spending query', () => {
    const result = parseDevelopmentWaExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['DevelopmentWA']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['WA']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(DEVELOPMENTWA_ID);
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
