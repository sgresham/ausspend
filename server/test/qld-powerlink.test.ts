import { describe, expect, it } from 'vitest';
import {
  POWERLINK_ID,
  detectPowerlinkUnit,
  discoverPowerlinkAnnualReport,
  parsePowerlinkAnnualReportPageLinks,
  parsePowerlinkAnnualReportPdfLinks,
  parsePowerlinkExtraction,
  parsePowerlinkStatement,
  powerlinkFiscalYearFromFilename,
  powerlinkFiscalYearFromPage,
  powerlinkNaturalKey,
  type PowerlinkParseContext,
} from '../src/connectors/soc/qld/powerlink.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.powerlink.com.au/sites/default/files/2026-10/Powerlink%20Queensland%20-%20Annual%20Report%20Sustainability%20Report%20and%20Financial%20Statements%202025-26.pdf';

function item(str: string, x: number, y: number, page = 74, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 74): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const CURRENT = 470;
const PRIOR = 540;

interface RowSpec {
  label: string;
  values: Array<number | string | null>;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function renderRows(
  rows: readonly RowSpec[],
  pageNumber: number,
  startY: number,
  step = 12,
): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  let y = startY;
  for (const row of rows) {
    items.push(item(row.label, 58, y, pageNumber));
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
  pbtOverride?: number;
  netOverride?: number;
  noteTotalOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? "$'000";
  const pageNumber = 74;
  const header: PdfTextItem[] = [
    item('Powerlink Queensland', 58, 756, pageNumber),
    item('CONSOLIDATED STATEMENT OF PROFIT OR LOSS AND OTHER', 58, 740, pageNumber),
    item('COMPREHENSIVE INCOME', 58, 728, pageNumber),
    item('FOR THE YEAR ENDED 30 JUNE 2026', 58, 718, pageNumber),
    item('2026', 445, 702, pageNumber),
    item('2025', 516, 702, pageNumber),
    item('Notes', 375, 695, pageNumber),
    item(unit, 441, 690, pageNumber),
    item(unit, 512, 690, pageNumber),
    item('REVENUE', 58, 670, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Revenue', values: [1_202_830, 1_275_198] },
    { label: 'Other gains/(losses)', values: [-997, -5_752] },
    { label: 'Expenses from continuing operations', values: [-966_901, -883_045] },
    { label: 'Impairment losses', values: [-133_191, '-'] },
    { label: 'PROFIT FROM CONTINUING OPERATIONS', values: [101_741, 386_401] },
    { label: 'Finance income', values: [25_999, 39_830] },
    { label: 'Finance costs', values: [-311_741, -279_012] },
    { label: 'NET FINANCE COSTS', values: [-285_742, -239_182] },
    {
      label: 'PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT',
      values: [options.pbtOverride ?? -184_001, 147_219],
    },
    { label: 'Income tax equivalent benefit/(expense)', values: [55_123, -44_233] },
    {
      label: 'PROFIT/(LOSS) FOR THE YEAR',
      values: [options.netOverride ?? -128_878, 102_986],
    },
  ];
  const items = [...header, ...renderRows(rows, pageNumber, 657)];
  return {
    page_number: pageNumber,
    text: `Powerlink Queensland CONSOLIDATED STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME FOR THE YEAR ENDED 30 JUNE 2026 2026 2025 Notes $'000 $'000 REVENUE Revenue Other gains/(losses) Expenses from continuing operations Impairment losses PROFIT FROM CONTINUING OPERATIONS Finance income Finance costs NET FINANCE COSTS PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT Income tax equivalent benefit/(expense) PROFIT/(LOSS) FOR THE YEAR`,
    items,
  };
}

function notePage(options: StatementOptions = {}): PdfPage {
  const unit = "$'000";
  const pageNumber = 85;
  const header: PdfTextItem[] = [
    item('NOTES TO THE CONSOLIDATED FINANCIAL STATEMENTS', 58, 756, pageNumber),
    item('FOR THE YEAR ENDED 30 JUNE 2026', 58, 738, pageNumber),
    item('NOTE 3: EXPENSES', 58, 717, pageNumber),
    item('Expenses from Continuing Operations', 58, 698, pageNumber),
    item('2026', 445, 680, pageNumber),
    item('2025', 516, 680, pageNumber),
    item(unit, 441, 668, pageNumber),
    item(unit, 512, 668, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Network operations', values: [52_640, 48_668] },
    { label: 'Network maintenance', values: [212_218, 186_139] },
    { label: 'Corporate/business support', values: [185_427, 134_561] },
    { label: 'Customer works and other activities', values: [61_234, 85_244] },
    { label: 'Depreciation and amortisation', values: [455_382, 428_433] },
    {
      label: 'TOTAL EXPENSES FROM CONTINUING OPERATIONS',
      values: [options.noteTotalOverride ?? 966_901, 883_045],
    },
  ];
  const items = [...header, ...renderRows(rows, pageNumber, 646)];
  // The employee-benefit memo label wraps: the money cells sit on the "or loss"
  // row, matching the real PDF.
  const memoY = 646 - rows.length * 12 - 24;
  items.push(
    item(
      'Employee benefit expense through the consolidated statement of profit',
      58,
      memoY,
      pageNumber,
    ),
  );
  items.push(item('or loss', 58, memoY - 11, pageNumber));
  items.push(money('264,426', CURRENT, memoY - 11, pageNumber));
  items.push(money('229,037', PRIOR, memoY - 11, pageNumber));
  return {
    page_number: pageNumber,
    text: `NOTES TO THE CONSOLIDATED FINANCIAL STATEMENTS FOR THE YEAR ENDED 30 JUNE 2026 NOTE 3: EXPENSES Expenses from Continuing Operations 2026 2025 $'000 $'000 Network operations Network maintenance Corporate/business support Customer works and other activities Depreciation and amortisation TOTAL EXPENSES FROM CONTINUING OPERATIONS Employee benefits included in total expenses from continuing operations Employee benefit expense through the consolidated statement of profit or loss`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 5_355_423 },
    pages: [facePage(options), notePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: PowerlinkParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/qld-powerlink/Powerlink-Queensland-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 5_355_423,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parsePowerlinkExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Powerlink annual-report discovery', () => {
  it('selects the latest annual-report landing page and rejects non-annual pages', () => {
    const html = `
      <a href="/annual-report/annual-report-202425">Annual Report 2024-25</a>
      <a href="/annual-report/annual-report-202526">Annual Report 2025-26</a>
      <a href="/general/sustainability-report-202526">Sustainability report</a>
      <a href="/planning-report/transmission-annual-planning-report-2026">Planning report</a>`;
    const links = parsePowerlinkAnnualReportPageLinks(html, 'https://www.powerlink.com.au/reports');
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links[0]).toMatchObject({
      url: 'https://www.powerlink.com.au/annual-report/annual-report-202526',
      discovery_page: 'https://www.powerlink.com.au/reports',
    });
  });

  it('selects the latest annual-report PDF and ignores planning, sustainability and newsletter links', () => {
    const html = `
      <a href="https://www.powerlink.com.au/sites/default/files/2025-10/Powerlink-Queensland-Annual-Report-2024-25.pdf">2024-25</a>
      <a href="${PDF_URL}">2025-26</a>
      <a href="https://www.powerlink.com.au/sites/default/files/2026-09/Transmission-Annual-Planning-Report-2026.pdf">Planning</a>
      <a href="https://www.powerlink.com.au/sites/default/files/2026-09/Powerlink-Sustainability-Report-2025-26.pdf">Sustainability only</a>
      <a href="https://www.powerlink.com.au/sites/default/files/2026-09/Community-Newsletter-August-2026.pdf">Newsletter</a>`;
    const links = parsePowerlinkAnnualReportPdfLinks(
      html,
      'https://www.powerlink.com.au/annual-report/annual-report-202526',
    );
    expect(links[0]).toMatchObject({
      fiscal_year: '2025-26',
      discovery_page: 'https://www.powerlink.com.au/annual-report/annual-report-202526',
      url: PDF_URL,
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(
      links.some((link) => /planning|newsletter|sustainability-only/i.test(link.filename)),
    ).toBe(false);
  });

  it('maps compact page slugs and filename spans to the API fiscal year', () => {
    expect(powerlinkFiscalYearFromPage('/annual-report/annual-report-202526')).toBe('2025-26');
    expect(powerlinkFiscalYearFromPage('/annual-report/annual-report-2025-26')).toBe('2025-26');
    expect(powerlinkFiscalYearFromFilename('Powerlink-Queensland-Annual-Report-2025-26.pdf')).toBe(
      '2025-26',
    );
    expect(
      powerlinkFiscalYearFromFilename(
        'Powerlink Queensland - Annual Report Sustainability Report and Financial Statements 2025-26.pdf',
      ),
    ).toBe('2025-26');
    expect(
      powerlinkFiscalYearFromFilename('Powerlink-Sustainability-Report-2025-26.pdf'),
    ).toBeNull();
    expect(
      powerlinkFiscalYearFromFilename('Transmission-Annual-Planning-Report-2026.pdf'),
    ).toBeNull();
    expect(powerlinkFiscalYearFromFilename('Powerlink-Annual-Report-2025-27.pdf')).toBeNull();
  });

  it('follows the reports page to the newest report page and returns its PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === 'https://www.powerlink.com.au/reports') {
        return new Response(
          '<a href="/annual-report/annual-report-202425">2024-25</a><a href="/annual-report/annual-report-202526">2025-26</a>',
          { status: 200 },
        );
      }
      if (url === 'https://www.powerlink.com.au/annual-report/annual-report-202526') {
        return new Response(`<a href="${PDF_URL}">PDF</a>`, { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverPowerlinkAnnualReport(fetchImpl);
    expect(latest.url).toBe(PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual([
      'https://www.powerlink.com.au/reports',
      'https://www.powerlink.com.au/annual-report/annual-report-202526',
    ]);
  });
});

describe('Powerlink $000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per unit', () => {
    const unit = detectPowerlinkUnit(["$'000 2026 $'000 2025"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parsePowerlinkExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parsePowerlinkStatement(facePage({ unit: '$m' }), notePage());
    expect(millions?.unit.kind).toBe('millions');
    expect(millions?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const dollars = parsePowerlinkExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('Powerlink exact reconciliation and rows', () => {
  it('derives total revenue and total expenses and reconciles the face and Note 3 bridges exactly', () => {
    const result = parsePowerlinkExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.note_unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(1_227_832);
    expect(result.statement?.total_expenses).toBe(1_411_833);
    expect(result.statement?.profit_before_tax).toBe(-184_001);
    expect(result.statement?.net_result).toBe(-128_878);
    expect(result.statement?.employee_benefits).toBe(264_426);
    expect(result.statement?.note_depreciation_amortisation).toBe(455_382);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'Note 3 components exact: 52640 + 212218 + 185427 + 61234 + 455382 = 966901',
    );
    expect(checks).toContain(
      'Note 3 total equals face Expenses from continuing operations: 966901',
    );
    expect(checks).toContain(
      'profit-from-continuing-operations bridge exact: 1202830 + -997 - 966901 - 133191 = 101741',
    );
    expect(checks).toContain('net-finance-costs bridge exact: 25999 + -311741 = -285742');
    expect(checks).toContain('profit-before-tax bridge exact: 101741 + -285742 = -184001');
    expect(checks).toContain(
      'total revenue less total expenses bridge exact: 1227832 - 1411833 = -184001',
    );
    expect(checks).toContain('net-result bridge exact: -184001 + 55123 = -128878');
  });

  it('maps the five required lines with provenance, exact cents and a negative printed sign on the loss', () => {
    const result = parsePowerlinkExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 141_183_300_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'QLD',
      delivery_entity: 'Powerlink Queensland',
      funding_source: 'Powerlink Queensland',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: POWERLINK_ID,
      source_url: PDF_URL,
      source_dataset: 'Powerlink Queensland Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Face statement / Note 3',
      extraction_confidence: 'high',
      location: { state: 'QLD' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(122_783_200_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(26_442_600_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(45_538_200_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 12_887_800_000,
      soc_printed_sign: 'negative',
    });
  });

  it('defers on a one-thousand profit-before-tax mismatch instead of ingesting', () => {
    const result = parsePowerlinkExtraction(extraction({ pbtOverride: -184_000 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand Note 3 total mismatch instead of ingesting', () => {
    const result = parsePowerlinkExtraction(extraction({ noteTotalOverride: 966_902 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 3 component total mismatch/i);
  });

  it('defers when the net-result bridge does not reconcile', () => {
    const result = parsePowerlinkExtraction(extraction({ netOverride: -128_879 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parsePowerlinkExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Powerlink natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = powerlinkNaturalKey('Powerlink Queensland', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^qld-powerlink:[0-9a-f]{40}$/);
    expect(key).toBe(
      powerlinkNaturalKey('Powerlink Queensland', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      powerlinkNaturalKey('Powerlink Queensland', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      powerlinkNaturalKey('Powerlink Queensland', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parsePowerlinkExtraction(extraction(), context);
    const second = parsePowerlinkExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Powerlink no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parsePowerlinkExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Powerlink Queensland']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['QLD']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(POWERLINK_ID);
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
