import { describe, expect, it } from 'vitest';
import {
  KIMBERLEY_PORTS_ID,
  detectKimberleyPortsUnit,
  discoverKimberleyPortsAnnualReport,
  kimberleyPortsFiscalYearFromDocumentSlug,
  kimberleyPortsNaturalKey,
  parseKimberleyPortsAnnualReportLinks,
  parseKimberleyPortsExtraction,
  parseKimberleyPortsStatement,
  type KimberleyPortsParseContext,
} from '../src/connectors/soc/wa/kimberley-ports.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const DOCUMENT_URL = 'https://kimberleyports.wa.gov.au/?document=annual-report-2025-2026';
const FINAL_PDF_URL =
  'https://kimberleyports.wa.gov.au/wp-content/uploads/2026/09/0421_KPA-2026-Annual-Report_FINAL-ART2_WEB.pdf';

function item(str: string, x: number, y: number, page = 59, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 59): PdfTextItem {
  const width = Math.max(6, str.length * 4);
  return item(str, right - width, y, page, width);
}

// The face statement sits in the left panel of a landscape page: 2026 column
// values end at x≈351 and 2025 column values end at x≈405.
const COLS = [351, 405];
const LABEL_X = 60;
const NOTE_X = 291;

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
  includeEmployee?: boolean;
  employeeValue?: number;
  pbtOverride?: number;
  netOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? "$'000";
  const pageNumber = 59;
  const items: PdfTextItem[] = [
    item('STATEMENT OF COMPREHENSIVE INCOME', 56, 504, pageNumber),
    item('For the year ended 30 June 2026', 56, 490, pageNumber),
    item('Notes', 275, 424, pageNumber),
    item('2026', 333, 424, pageNumber),
    item('2025', 387, 424, pageNumber),
  ];
  if (unit) {
    items.push(item(unit, 332, 409, pageNumber));
    items.push(item(unit, 386, 409, pageNumber));
  }
  const employee = options.includeEmployee ?? false;
  const baseExpenses = 33_049;
  const employeeValue = options.employeeValue ?? 1_000;
  const totalExpenses = baseExpenses + (employee ? employeeValue : 0);
  const pbt = options.pbtOverride ?? 35_310 - totalExpenses;
  const net = options.netOverride ?? pbt - 1_065;
  let y = 374;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y));
    y -= 17.7;
  };
  add({ label: 'REVENUE', values: [null, null] });
  add({ label: 'Revenue', values: [32_824, 37_389], note: '4' });
  add({ label: 'Other Income', values: [2_486, 5_251], note: '4' });
  add({ label: 'EXPENDITURE', values: [null, null] });
  add({ label: 'Port operations expenses', values: [-12_170, -13_449], note: '5' });
  add({ label: 'Depreciation and amortisation', values: [-5_752, -6_322], note: '6' });
  add({ label: 'General administration expenses', values: [-7_927, -8_298], note: '7' });
  add({ label: 'Asset maintenance', values: [-3_503, -2_840] });
  add({ label: 'Port utilities', values: [-1_284, -1_419] });
  add({ label: 'Finance expenses', values: [-222, -255], note: '8' });
  add({ label: 'Safety & security', values: [-635, -584] });
  add({ label: 'Environmental expenses', values: [-246, -751] });
  add({ label: 'Other expenses', values: [-1_310, -1_937], note: '9' });
  if (employee) add({ label: 'Employee benefits expense', values: [-employeeValue, -900] });
  add({ label: 'Profit before income tax', values: [pbt, 6_785] });
  add({ label: 'Income tax expense', values: [-1_065, -1_155], note: '10(i)' });
  add({ label: 'Net Profit after tax', values: [net, 5_630] });
  return {
    page_number: pageNumber,
    text: `STATEMENT OF COMPREHENSIVE INCOME For the year ended 30 June 2026 Notes 2026 2025 ${unit} ${unit} REVENUE Revenue Other Income EXPENDITURE Port operations expenses Depreciation and amortisation General administration expenses Asset maintenance Port utilities Finance expenses Safety & security Environmental expenses Other expenses ${employee ? 'Employee benefits expense ' : ''}Profit before income tax Income tax expense Net Profit after tax`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: FINAL_PDF_URL, sha256: 'b'.repeat(64), bytes: 15_791_779 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: KimberleyPortsParseContext = {
  document_url: FINAL_PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/wa-kimberley-ports/0421_KPA-2026-Annual-Report_FINAL-ART2_WEB.pdf',
    sha256: 'b'.repeat(64),
    bytes: 15_791_779,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseKimberleyPortsExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Kimberley Ports Authority annual-report discovery', () => {
  it('selects the newest annual-report document and rejects handbooks, trade statistics and community reports', () => {
    const html = `
      <a href="https://kimberleyports.wa.gov.au/?document=annual-report-2025-2026">2026</a>
      <a href="https://kimberleyports.wa.gov.au/?document=annual-report-2024-2025">2025</a>
      <a href="https://kimberleyports.wa.gov.au/?document=annual-report-2023-2024">2024</a>
      <a href="https://kimberleyports.wa.gov.au/?document=port-handbook-2025">Handbook</a>
      <a href="https://kimberleyports.wa.gov.au/?document=trade-statistics-2025">Trade statistics</a>
      <a href="https://kimberleyports.wa.gov.au/?document=community-investment-report-2025">Community investment</a>`;
    const links = parseKimberleyPortsAnnualReportLinks(
      html,
      'https://kimberleyports.wa.gov.au/forms-and-publications',
    );
    expect(links[0]).toMatchObject({
      url: DOCUMENT_URL,
      fiscal_year: '2025-26',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(
      links.some((link) => /handbook|trade-statistics|community-investment/i.test(link.url)),
    ).toBe(false);
  });

  it('parses the official WordPress search JSON fallback for document posts', () => {
    const json = JSON.stringify({
      data: [
        {
          title: 'Annual Report 2025-2026',
          url: 'https:\\/\\/kimberleyports.wa.gov.au\\/?document=annual-report-2025-2026',
          type: 'post',
          subtype: 'document',
        },
        {
          title: 'Annual Report 2024-2025',
          url: 'https:\\/\\/kimberleyports.wa.gov.au\\/?document=annual-report-2024-2025',
          type: 'post',
          subtype: 'document',
        },
        {
          title: 'Community Investment Report',
          url: 'https:\\/\\/kimberleyports.wa.gov.au\\/?document=community-investment-report-2025',
          type: 'post',
          subtype: 'document',
        },
      ],
    });
    const links = parseKimberleyPortsAnnualReportLinks(
      json,
      'https://kimberleyports.wa.gov.au/wp-json/wp/v2/search?search=annual%20report&per_page=20',
    );
    expect(links[0]).toMatchObject({ url: DOCUMENT_URL, fiscal_year: '2025-26' });
    expect(links).toHaveLength(2);
  });

  it('maps official document slugs and rejects non-annual publications', () => {
    expect(kimberleyPortsFiscalYearFromDocumentSlug('annual-report-2025-2026')).toBe('2025-26');
    expect(kimberleyPortsFiscalYearFromDocumentSlug('annual-report-2024-25')).toBe('2024-25');
    expect(kimberleyPortsFiscalYearFromDocumentSlug('Annual_Report_2026.pdf')).toBe('2025-26');
    expect(kimberleyPortsFiscalYearFromDocumentSlug('port-handbook-2025')).toBeNull();
    expect(kimberleyPortsFiscalYearFromDocumentSlug('trade-statistics-2025')).toBeNull();
    expect(kimberleyPortsFiscalYearFromDocumentSlug('community-investment-report-2025')).toBeNull();
  });

  it('uses the official page first and the documented WordPress-search fallback second', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://kimberleyports.wa.gov.au/forms-and-publications') {
        return new Response('<a href="/forms-and-publications/documents">Documents</a>', {
          status: 200,
        });
      }
      if (url.includes('/wp-json/wp/v2/search')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                title: 'Annual Report 2025-2026',
                url: 'https:\\/\\/kimberleyports.wa.gov.au\\/?document=annual-report-2025-2026',
                type: 'post',
                subtype: 'document',
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverKimberleyPortsAnnualReport(fetchImpl);
    expect(latest.url).toBe(DOCUMENT_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(latest.discovery_page).toBe('https://kimberleyports.wa.gov.au/forms-and-publications');
    expect(fetched).toHaveLength(2);
    expect(fetched[1]).toContain('/wp-json/wp/v2/search');
  });

  it('refuses to guess a PDF URL when neither the page nor the search endpoint has an annual report', async () => {
    const fetchImpl = (async () =>
      new Response('<a href="/handbook.pdf">handbook</a>', { status: 200 })) as typeof fetch;
    await expect(discoverKimberleyPortsAnnualReport(fetchImpl)).rejects.toThrow(
      /refusing to hard-code a PDF URL/i,
    );
  });
});

describe("Kimberley Ports Authority $'000 unit guard", () => {
  it("detects the printed $'000 unit at 100,000 cents per thousand", () => {
    const unit = detectKimberleyPortsUnit(["$'000 2026 $'000 2025"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing a magnitude', () => {
    const result = parseKimberleyPortsExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as whole dollars or millions instead of thousands', () => {
    const dollars = parseKimberleyPortsExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');

    const millions = parseKimberleyPortsExtraction(extraction({ unit: '$M' }), context);
    expect(millions.records).toHaveLength(0);
    expect(millions.deferral?.phase).toBe('unit');
  });
});

describe('Kimberley Ports Authority exact reconciliation and the employee-expense gap', () => {
  it('reconciles the live-shaped face statement exactly but defers because no total employee expense is printed', () => {
    const result = parseKimberleyPortsExtraction(extraction(), context);
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(35_310);
    expect(result.statement?.total_expenses).toBe(33_049);
    expect(result.statement?.employee_expenses).toBeNull();
    expect(result.statement?.depreciation_amortisation).toBe(5_752);
    expect(result.statement?.profit_before_tax).toBe(2_261);
    expect(result.statement?.net_result).toBe(1_196);
    expect(result.statement?.errors).toEqual([]);
    expect(result.statement?.employee_gap).toMatch(
      /does not print a total employee benefits expense/i,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('employee');
    expect(result.deferral?.reason).toMatch(/asset maintenance has no note split/i);
    const checks = result.checks.join(' ');
    expect(checks).toContain('total revenue exact: 32824 + 2486 = 35310');
    expect(checks).toContain(
      'total expenses exact: 12170 + 5752 + 7927 + 3503 + 1284 + 222 + 635 + 246 + 1310 = 33049',
    );
    expect(checks).toContain('profit-before-tax bridge exact: 35310 - 33049 = 2261 (printed 2261)');
    expect(checks).toContain('net-result bridge exact: 2261 + -1065 = 1196 (printed 1196)');
  });

  it('defers on a profit-before-tax mismatch', () => {
    const result = parseKimberleyPortsExtraction(extraction({ pbtOverride: 2_262 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers on a net-result mismatch', () => {
    const result = parseKimberleyPortsExtraction(extraction({ netOverride: 1_197 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseKimberleyPortsExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });

  it('returns null when the required printed lines cannot be read', () => {
    const page = facePage();
    page.items = page.items.filter((entry) => entry.str !== 'Revenue');
    expect(parseKimberleyPortsStatement(page)).toBeNull();
  });
});

describe('Kimberley Ports Authority row path', () => {
  it('maps five entity-level rows when a future face statement prints a total employee benefit expense', () => {
    const result = parseKimberleyPortsExtraction(
      extraction({ includeEmployee: true, employeeValue: 1_000 }),
      context,
    );
    expect(result.deferral).toBeNull();
    expect(result.statement?.employee_expenses).toBe(1_000);
    expect(result.statement?.total_expenses).toBe(34_049);
    expect(result.statement?.profit_before_tax).toBe(1_261);
    expect(result.statement?.net_result).toBe(196);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 3_404_900_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'WA',
      delivery_entity: 'Kimberley Ports Authority',
      funding_source: 'Kimberley Ports Authority',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: KIMBERLEY_PORTS_ID,
      source_url: FINAL_PDF_URL,
      source_dataset: 'Kimberley Ports Authority Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Statement of Comprehensive Income',
      extraction_confidence: 'high',
      location: { state: 'WA' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(3_531_000_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(100_000_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(575_200_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 19_600_000,
      soc_printed_sign: 'positive',
    });
  });
});

describe('Kimberley Ports Authority natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = kimberleyPortsNaturalKey(
      'Kimberley Ports Authority',
      '2025-26',
      'total_expenses',
      FINAL_PDF_URL,
    );
    expect(key).toMatch(/^wa-kimberley-ports:[0-9a-f]{40}$/);
    expect(key).toBe(
      kimberleyPortsNaturalKey(
        'Kimberley Ports Authority',
        '2025-26',
        'total_expenses',
        FINAL_PDF_URL,
      ),
    );
    expect(key).not.toBe(
      kimberleyPortsNaturalKey(
        'Kimberley Ports Authority',
        '2025-26',
        'total_revenue',
        FINAL_PDF_URL,
      ),
    );
    expect(key).not.toBe(
      kimberleyPortsNaturalKey(
        'Kimberley Ports Authority',
        '2024-25',
        'total_expenses',
        FINAL_PDF_URL,
      ),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseKimberleyPortsExtraction(
      extraction({ includeEmployee: true, employeeValue: 1_000 }),
      context,
    );
    const second = parseKimberleyPortsExtraction(
      extraction({ includeEmployee: true, employeeValue: 1_000 }),
      context,
    );
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Kimberley Ports Authority no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive, WA-only and excluded from the generic spending query', () => {
    const result = parseKimberleyPortsExtraction(
      extraction({ includeEmployee: true, employeeValue: 1_000 }),
      context,
    );
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Kimberley Ports Authority']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['WA']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(KIMBERLEY_PORTS_ID);
      expect(record.potential_double_count).toBe(false);
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
    expect(
      result.records.some((record) => /total.*wa|wa.*total/i.test(record.soc_line_item ?? '')),
    ).toBe(false);
  });

  it('does not emit a WA/state/national aggregate or a combined entity row', () => {
    const result = parseKimberleyPortsExtraction(
      extraction({ includeEmployee: true, employeeValue: 1_000 }),
      context,
    );
    expect(result.records).toHaveLength(5);
    for (const record of result.records) {
      expect(record.source_id).toBe(KIMBERLEY_PORTS_ID);
      expect(record.delivery_entity).not.toMatch(/total|government of|state of/i);
      expect(record.soc_section).not.toMatch(/total|aggregate/i);
    }
  });
});
