import { describe, expect, it } from 'vitest';
import {
  FREMANTLE_PORTS_ID,
  detectFremantlePortsUnit,
  discoverFremantlePortsAnnualReport,
  fremantlePortsFiscalYearFromFilename,
  fremantlePortsNaturalKey,
  parseFremantlePortsAnnualReportPdfLinks,
  parseFremantlePortsExtraction,
  parseFremantlePortsStatement,
  type FremantlePortsParseContext,
} from '../src/connectors/soc/wa/fremantle-ports.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.fremantleports.com.au/docs/default-source/annual-reports/244491-frepor-annual-report-2026-web---interactive.pdf';

function item(str: string, x: number, y: number, page = 40, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 40): PdfTextItem {
  const width = Math.max(6, str.length * 4);
  return item(str, right - width, y, page, width);
}

const COLS = [715, 794];

interface RowSpec {
  label: string;
  values: Array<number | string | null>;
  note?: string;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function renderRow(row: RowSpec, pageNumber: number, y: number): PdfTextItem[] {
  const items: PdfTextItem[] = [item(row.label, 300, y, pageNumber)];
  if (row.note) items.push(item(row.note, 592, y, pageNumber));
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
  interestOverride?: number;
  employeeOverride?: number;
  pbtOverride?: number;
  netOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$’000';
  const pageNumber = 40;
  const items: PdfTextItem[] = [
    item('Statement of Comprehensive Income', 289, 753, pageNumber),
    item('for the Year Ended 30 June 2026', 289, 727, pageNumber),
    item('Note', 592, 686, pageNumber),
    item('2026', 691, 686, pageNumber),
    item(unit, 689, 674, pageNumber),
    item('2025', 771, 686, pageNumber),
    item(unit, 769, 674, pageNumber),
  ];
  let y = 642;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y));
    y -= 16.3;
  };
  add({ label: 'Revenue', values: [options.revenueOverride ?? 315_544, 262_445], note: 'A.1' });
  add({ label: 'Interest income', values: [options.interestOverride ?? 6_801, 5_649] });
  add({
    label: 'Employee benefits',
    values: [-(options.employeeOverride ?? 70_538), -68_166],
    note: 'A.2',
  });
  add({ label: 'Service and maintenance', values: [-48_227, -37_117] });
  add({ label: 'Contracts and consultants', values: [-35_316, -31_705] });
  add({ label: 'Government charges', values: [-10_782, -10_670] });
  add({ label: 'Utilities', values: [-7_914, -7_358] });
  add({ label: 'Insurance', values: [-5_893, -4_111] });
  add({ label: 'Other expenses', values: [-21_431, -19_067] });
  add({
    label: 'Depreciation and amortisation',
    values: [-26_868, -20_718],
    note: 'A.2',
  });
  add({ label: 'Finance costs', values: [-7_992, -5_813], note: 'A.2' });
  add({
    label: 'Profit before income tax',
    values: [options.pbtOverride ?? 87_384, 63_369],
  });
  add({ label: 'Income tax expense', values: [-26_363, -19_129], note: 'A.4' });
  add({
    label: 'Profit after income tax for the year',
    values: [options.netOverride ?? 61_021, 44_240],
  });
  return {
    page_number: pageNumber,
    text: `Statement of Comprehensive Income for the Year Ended 30 June 2026 Note 2026 $’000 2025 $’000 Income Revenue Interest income Expenditure Employee benefits Service and maintenance Contracts and consultants Government charges Utilities Insurance Other expenses Depreciation and amortisation Finance costs Profit before income tax Income tax expense Profit after income tax for the year`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 19_999_051 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: FremantlePortsParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/wa-fremantle-ports/Fremantle-Ports-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 19_999_051,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseFremantlePortsExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Fremantle Ports annual-report discovery', () => {
  it('selects the newest interactive annual report, de-duplicates query variants and rejects spreads/non-annual PDFs', () => {
    const html = `
      <a href="https://www.fremantleports.com.au/docs/default-source/annual-reports/2023-annual-report.pdf?sfvrsn=993ef35b_2">2023</a>
      <a href="https://www.fremantleports.com.au/docs/default-source/annual-reports/235678-frepor---final-annual-report-2025---interactive-web.pdf">2025</a>
      <a href="${PDF_URL}">2026</a>
      <a href="${PDF_URL}?sfvrsn=5c26f42_3">2026 duplicate</a>
      <a href="https://www.fremantleports.com.au/docs/default-source/annual-reports/244491-frepor-annual-report-2026-web-spreads.pdf?sfvrsn=697720b1_1">Spreads</a>
      <a href="https://www.fremantleports.com.au/docs/default-source/annual-reports/trade-overview-2026.pdf">Trade overview</a>
      <a href="https://www.fremantleports.com.au/docs/default-source/annual-reports/statement-of-corporate-intent-2025-26.pdf">SCI</a>`;
    const links = parseFremantlePortsAnnualReportPdfLinks(
      html,
      'https://www.fremantleports.com.au/publications',
    );
    expect(links[0]).toMatchObject({
      url: PDF_URL,
      filename: '244491-frepor-annual-report-2026-web---interactive.pdf',
      fiscal_year: '2025-26',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2022-23']);
    expect(links.filter((link) => link.fiscal_year === '2025-26')).toHaveLength(1);
    expect(links.some((link) => /spreads|trade-overview|corporate-intent/i.test(link.filename))).toBe(
      false,
    );
  });

  it('maps year-ended filenames and rejects non-annual reports', () => {
    expect(
      fremantlePortsFiscalYearFromFilename(
        '244491-frepor-annual-report-2026-web---interactive.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fremantlePortsFiscalYearFromFilename(
        '235678-frepor---final-annual-report-2025---interactive-web.pdf',
      ),
    ).toBe('2024-25');
    expect(fremantlePortsFiscalYearFromFilename('2023-annual-report.pdf')).toBe('2022-23');
    expect(
      fremantlePortsFiscalYearFromFilename('244491-frepor-annual-report-2026-web-spreads.pdf'),
    ).toBeNull();
    expect(fremantlePortsFiscalYearFromFilename('trade-overview-2026.pdf')).toBeNull();
    expect(
      fremantlePortsFiscalYearFromFilename('statement-of-corporate-intent-2025-26.pdf'),
    ).toBeNull();
  });

  it('follows the publications page and returns its newest annual-report PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.fremantleports.com.au/publications') {
        return new Response(
          `<a href="https://www.fremantleports.com.au/docs/default-source/annual-reports/235678-frepor---final-annual-report-2025---interactive-web.pdf">2025</a><a href="${PDF_URL}">2026</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverFremantlePortsAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual(['https://www.fremantleports.com.au/publications']);
  });
});

describe('Fremantle Ports $000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per unit', () => {
    const unit = detectFremantlePortsUnit(["$'000 2026 $'000 2025"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing', () => {
    const result = parseFremantlePortsExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parseFremantlePortsStatement(facePage({ unit: '$M' }));
    expect(millions?.unit.kind).toBe('millions');

    const millionsDeferral = parseFremantlePortsExtraction(extraction({ unit: '$M' }), context);
    expect(millionsDeferral.records).toHaveLength(0);
    expect(millionsDeferral.deferral?.phase).toBe('unit');

    const dollars = parseFremantlePortsExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('Fremantle Ports exact reconciliation and rows', () => {
  it('derives total income/expenses and reconciles every printed bridge exactly', () => {
    const result = parseFremantlePortsExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_income).toBe(322_345);
    expect(result.statement?.total_expenses).toBe(234_961);
    expect(result.statement?.employee_benefits).toBe(70_538);
    expect(result.statement?.depreciation_amortisation).toBe(26_868);
    expect(result.statement?.profit_before_tax).toBe(87_384);
    expect(result.statement?.net_result).toBe(61_021);
    const checks = result.checks.join(' ');
    expect(checks).toContain('total income exact: 315544 + 6801 = 322345');
    expect(checks).toContain(
      'total expenses exact: 70538 + 48227 + 35316 + 10782 + 7914 + 5893 + 21431 + 26868 + 7992 = 234961',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: 322345 - 234961 = 87384 (printed 87384)',
    );
    expect(checks).toContain('net-result bridge exact: 87384 + -26363 = 61021 (printed 61021)');
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseFremantlePortsExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 23_496_100_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'WA',
      delivery_entity: 'Fremantle Ports',
      funding_source: 'Fremantle Ports',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: FREMANTLE_PORTS_ID,
      source_url: PDF_URL,
      source_dataset: 'Fremantle Ports Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Statement of Comprehensive Income',
      extraction_confidence: 'high',
      location: { state: 'WA' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(32_234_500_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(7_053_800_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(2_686_800_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 6_102_100_000,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on a profit-before-tax mismatch', () => {
    const result = parseFremantlePortsExtraction(extraction({ pbtOverride: 87_385 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers on a net-result mismatch', () => {
    const result = parseFremantlePortsExtraction(extraction({ netOverride: 61_022 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers on a component change that breaks the derived-expense bridge', () => {
    const result = parseFremantlePortsExtraction(
      extraction({ employeeOverride: 70_539 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseFremantlePortsExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Fremantle Ports natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = fremantlePortsNaturalKey('Fremantle Ports', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^wa-fremantle-ports:[0-9a-f]{40}$/);
    expect(key).toBe(
      fremantlePortsNaturalKey('Fremantle Ports', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      fremantlePortsNaturalKey('Fremantle Ports', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      fremantlePortsNaturalKey('Fremantle Ports', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseFremantlePortsExtraction(extraction(), context);
    const second = parseFremantlePortsExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Fremantle Ports no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive, WA-only and excluded from the generic spending query', () => {
    const result = parseFremantlePortsExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Fremantle Ports']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['WA']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(FREMANTLE_PORTS_ID);
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
