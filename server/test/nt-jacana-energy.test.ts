import { describe, expect, it } from 'vitest';
import {
  JACANA_ENERGY_ENTITY,
  JACANA_ENERGY_ID,
  JACANA_ENERGY_JURISDICTION,
  jacanaEnergyFiscalYearFromEndDate,
  jacanaEnergyFiscalYearFromFilename,
  jacanaEnergyNaturalKey,
  parseJacanaEnergyAnnualReportLinks,
  parseJacanaEnergyExtraction,
  type JacanaEnergyParseContext,
} from '../src/connectors/soc/nt/jacana-energy.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';

const PDF_URL =
  'https://www.jacanaenergy.com.au/sites/default/files/2026-10/Jacana%20Energy%20Annual%20Report%202025-2026.pdf';

function item(str: string, x: number, y: number, page = 30, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 30): PdfTextItem {
  const width = Math.max(6, str.length * 4);
  return item(str, right - width, y, page, width);
}

function numberCell(value: number): string {
  return Math.abs(value).toLocaleString('en-AU');
}

function deduction(value: number): string {
  return `(${numberCell(value)})`;
}

function row(
  label: string,
  current: number | string | null,
  y: number,
  page: number,
  options: { labelX?: number; currentRight?: number; note?: string } = {},
): PdfTextItem[] {
  const items: PdfTextItem[] = [item(label, options.labelX ?? 46, y, page)];
  if (options.note) items.push(item(options.note, 362, y, page));
  if (current !== null) {
    items.push(
      money(
        typeof current === 'string' ? current : numberCell(current),
        options.currentRight ?? 449,
        y,
        page,
      ),
    );
  }
  return items;
}

interface StatementOptions {
  unit?: string;
  totalRevenue?: number;
  totalExpenses?: number;
  employee?: number;
  depreciation?: number;
  netResult?: number;
  profitBeforeTax?: number;
  incomeTax?: number;
  energyTotal?: number;
  employeeTotal?: number;
  otherTotal?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const page = 30;
  const unit = options.unit ?? "$'000";
  const items: PdfTextItem[] = [
    item('Statement of profit or loss and other comprehensive income', 40, 726, page, 341),
    item('For the year ended 30 June 2026', 40, 703, page, 156),
    item('2026', 424, 678, page, 25),
    item('2025', 495, 678, page, 25),
    item(unit, 420, 666, page, 29),
    item(unit, 491, 666, page, 29),
  ];
  let y = 646;
  const add = (label: string, current: number | string | null, note?: string) => {
    items.push(...row(label, current, y, page, { note, labelX: 46, currentRight: 449 }));
    y -= 20.5;
  };
  add('Electricity revenue', 461652, '4(a)');
  add('Community Service Obligation revenue', 131347, '4(b)');
  add('Interest income', 3640, '4(c)');
  add('Energy costs of sales', deduction(545152), '5(a)');
  add('Employee benefits expense', deduction(options.employee ?? 13606), '5(b)');
  add('External service agreements', deduction(652), '5(c)');
  add('Depreciation and amortisation expense', deduction(options.depreciation ?? 842), '5(d)');
  add('Other expenses', deduction(11727), '5(e)');
  add('Finance costs', deduction(70), '5(f)');
  add('Profit before tax', options.profitBeforeTax ?? 24590);
  add('Income tax expense', options.incomeTax ?? 7380, '6(a)');
  add('Profit for the year', options.netResult ?? 17210);
  add('Other comprehensive income, net of income tax', '-');
  add('Total comprehensive income for the year', options.netResult ?? 17210);
  return { page_number: page, items, text: items.map((entry) => entry.str).join(' ') };
}

function revenuePage(options: StatementOptions = {}): PdfPage {
  const page = 42;
  const unit = options.unit ?? "$'000";
  const items: PdfTextItem[] = [
    item('4', 40, 726, page),
    item('Revenue', 68, 726, page),
    item('2026', 424, 700, page, 25),
    item('2025', 495, 700, page, 25),
    item(unit, 420, 688, page, 29),
    item(unit, 491, 688, page, 29),
    item('(a)', 46, 667, page),
    item('Electricity revenue', 75, 667, page),
    item('Electricity and energy retail services', 75, 647, page, 150),
    money('456,840', 449, 647, page),
    money('443,615', 519, 647, page),
    item('Other revenue', 75, 626, page, 60),
    money('4,812', 449, 626, page),
    money('10,162', 520, 626, page),
    item('Total', 75, 606, page, 21),
    money('461,652', 449, 606, page),
    money('453,777', 520, 606, page),
    item('(b)', 46, 565, page),
    item('Community Service Obligation (CSO)', 75, 565, page, 158),
    money('131,347', 449, 565, page),
    money('124,661', 520, 565, page),
    item('(c)', 46, 524, page),
    item('Interest income', 75, 524, page, 67),
    money('3,640', 449, 524, page),
    money('3,323', 520, 524, page),
    item('Total revenue', 75, 503, page, 58),
    money(numberCell(options.totalRevenue ?? 596639), 449, 503, page),
    money('581,761', 520, 503, page),
  ];
  return { page_number: page, items, text: items.map((entry) => entry.str).join(' ') };
}

function expensesPage(options: StatementOptions = {}): PdfPage {
  const page = 43;
  const unit = options.unit ?? "$'000";
  const items: PdfTextItem[] = [
    item('5', 60, 726, page),
    item('Expenses', 88, 726, page),
    item('2026', 444, 700, page, 25),
    item('2025', 515, 700, page, 25),
    item(unit, 440, 688, page, 29),
    item(unit, 511, 688, page, 29),
  ];
  let y = 667;
  const add = (
    label: string | null,
    current: number | string | null,
    note?: string,
    labelX = 95,
  ) => {
    if (note) items.push(item(note, 66, y, page));
    if (label) items.push(item(label, labelX, y, page));
    if (current !== null) {
      items.push(money(typeof current === 'string' ? current : numberCell(current), 469, y, page));
      items.push(money('0', 540, y, page));
    }
    y -= 20.5;
  };
  add('(a)');
  add('Energy costs of sales', null, undefined, 95);
  add(
    'Generation, networks and system control, and energy purchased for re-sale',
    deduction(531675),
    undefined,
    95,
  );
  add('Renewable Energy Certificates', deduction(9529), undefined, 95);
  add('Alternative control charges', deduction(3627), undefined, 95);
  add('Prepaid meter transaction costs', deduction(321), undefined, 95);
  add('Total', deduction(options.energyTotal ?? 545152), undefined, 95);
  add('(b)');
  add('Employee benefits expense', null, undefined, 95);
  add('Salary and wages', deduction(11354), undefined, 95);
  add('Superannuation expense', deduction(1183), undefined, 95);
  add('Fringe Benefits Expense tax', deduction(47), undefined, 95);
  add('Payroll tax', deduction(678), undefined, 95);
  add('Contract labour', deduction(344), undefined, 95);
  add('Total', deduction(options.employeeTotal ?? 13606), undefined, 95);
  add('(c)');
  add('External service agreements', deduction(652), undefined, 95);
  add('(d)');
  add(
    'Depreciation and amortisation expenses',
    deduction(options.depreciation ?? 842),
    undefined,
    95,
  );
  add('(e)');
  add('Other expenses', null, undefined, 95);
  add('Grants and subsidies', deduction(200), undefined, 95);
  add('Provision for impaired receivables', deduction(3098), undefined, 95);
  add("Auditors' remuneration", deduction(205), undefined, 95);
  add('Rental expenses', deduction(27), undefined, 95);
  add('Managed services', deduction(1775), undefined, 95);
  add('Professional fees', deduction(917), undefined, 95);
  add('IT expenses', deduction(1129), undefined, 95);
  add('Other expenses', deduction(4376), undefined, 95);
  add('Total', deduction(options.otherTotal ?? 11727), undefined, 95);
  add('(f)');
  add('Finance costs', deduction(70), undefined, 95);
  add('Total expenses', deduction(options.totalExpenses ?? 572049), undefined, 95);
  return { page_number: page, items, text: items.map((entry) => entry.str).join(' ') };
}

function extraction(options: StatementOptions = {}): PdfExtraction {
  const pages = [facePage(options), revenuePage(options), expensesPage(options)];
  return {
    source: { url: PDF_URL, sha256: 'test-sha', bytes: 1 },
    pages,
    text: pages.map((page) => page.text).join('\n\n'),
    tables: [],
    warnings: [],
  };
}

const CONTEXT: JacanaEnergyParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–2026',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/tmp/ausspend-source-archive/nt-jacana-energy/jacana.pdf',
    sha256: 'c5ac0c972e9021f452789d9e240956f42d173d2dd42e4f55fc78c80db831fc55',
    bytes: 2_435_076,
  },
  source_date: '2026-11-19',
};

describe('Jacana Energy discovery', () => {
  it('selects the newest annual-report PDF from the official page, resolving a relative href', () => {
    const html = [
      '<a href="/sites/default/files/2024-10/Jacana%20Energy_Annual_Report_2023-2024s.pdf">2023-2024</a>',
      '<a href="/sites/default/files/2026-10/Jacana%20Energy%20Annual%20Report%202025-2026.pdf">2025-2026</a>',
      '<a href="/sites/default/files/2025-10/FINAL_Jacana%20Energy_Annual%20Report_2024-2025_v7.pdf">2024-2025</a>',
      '<a href="/sites/default/files/2026-10/other-publication.pdf">Other publication</a>',
    ].join('\n');
    const links = parseJacanaEnergyAnnualReportLinks(
      html,
      'https://www.jacanaenergy.com.au/about/who-we-are',
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links[0]?.url).toBe(PDF_URL);
    expect(links[0]?.filename).toBe('Jacana Energy Annual Report 2025-2026.pdf');
  });

  it('converts filename ranges and year-ended dates to the API fiscal year', () => {
    expect(jacanaEnergyFiscalYearFromFilename('Jacana Energy Annual Report 2025-2026.pdf')).toBe(
      '2025-26',
    );
    expect(jacanaEnergyFiscalYearFromFilename('Annual Report 2019-20.pdf')).toBe('2019-20');
    expect(jacanaEnergyFiscalYearFromFilename('other.pdf')).toBeNull();
    expect(jacanaEnergyFiscalYearFromEndDate('2026-06-30')).toBe('2025-26');
  });
});

describe('Jacana Energy statement', () => {
  it('extracts exactly five entity-level rows and reconciles every printed subtotal', () => {
    const result = parseJacanaEnergyExtraction(extraction(), CONTEXT);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.errors).toEqual([]);
    expect(result.records).toHaveLength(5);
    expect(result.records.map((record) => record.soc_line_item)).toEqual([
      'total_revenue',
      'total_expenses',
      'employee_expenses',
      'depreciation_amortisation',
      'net_result',
    ]);
    const amounts = Object.fromEntries(
      result.records.map((record) => [record.soc_line_item, record.amount_cents]),
    );
    expect(amounts).toEqual({
      total_revenue: 59_663_900_000,
      total_expenses: 57_204_900_000,
      employee_expenses: 1_360_600_000,
      depreciation_amortisation: 84_200_000,
      net_result: 1_721_000_000,
    });
    for (const record of result.records) {
      expect(record.source_id).toBe(JACANA_ENERGY_ID);
      expect(record.jurisdiction).toBe('NT');
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.measure_type).toBe('actual');
      expect(record.verified).toBe(false);
      expect(record.potential_double_count).toBe(false);
      expect(record.delivery_entity).toBe(JACANA_ENERGY_ENTITY);
    }
    expect(result.checks.some((check) => check.startsWith('Note 4 Total revenue'))).toBe(true);
    expect(result.checks.some((check) => check.startsWith('Note 5 Total expenses'))).toBe(true);
    expect(result.checks.some((check) => check.startsWith('profit-before-tax bridge'))).toBe(true);
    expect(result.checks.some((check) => check.startsWith('net-result bridge'))).toBe(true);
  });

  it('rejects a missing printed unit instead of guessing dollars', () => {
    const result = parseJacanaEnergyExtraction(extraction({ unit: '' }), CONTEXT);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
  });

  it('rejects an ambiguous printed unit', () => {
    const pages = [facePage(), revenuePage(), expensesPage()];
    // Add a conflicting "$M" unit to the face page, leaving "$'000" present too.
    pages[0]?.items.push(item('$M', 360, 666, 30, 18));
    const ambiguous: PdfExtraction = {
      source: { url: PDF_URL, sha256: 'test-sha', bytes: 1 },
      pages,
      text: pages.map((page) => page.text).join('\n\n'),
      tables: [],
      warnings: [],
    };
    const result = parseJacanaEnergyExtraction(ambiguous, CONTEXT);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
  });

  it('defers with zero rows when a printed subtotal does not reconcile at zero tolerance', () => {
    const result = parseJacanaEnergyExtraction(extraction({ totalExpenses: 572050 }), CONTEXT);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.statement?.errors.join(' ')).toContain('Note 5 Total expenses');
  });

  it('uses a deterministic natural key so a re-run is idempotent and line-specific', () => {
    const first = parseJacanaEnergyExtraction(extraction(), CONTEXT);
    const second = parseJacanaEnergyExtraction(extraction(), CONTEXT);
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(new Set(first.records.map((record) => record.natural_key)).size).toBe(5);
    const base = jacanaEnergyNaturalKey('Jacana Energy', '2025-26', 'total_revenue', PDF_URL);
    expect(jacanaEnergyNaturalKey('Jacana Energy', '2025-26', 'total_revenue', PDF_URL)).toBe(base);
    expect(jacanaEnergyNaturalKey('Jacana Energy', '2025-26', 'total_expenses', PDF_URL)).not.toBe(
      base,
    );
    expect(jacanaEnergyNaturalKey('Jacana Energy', '2024-25', 'total_revenue', PDF_URL)).not.toBe(
      base,
    );
  });

  it('never creates an NT or cross-entity aggregate row', () => {
    const result = parseJacanaEnergyExtraction(extraction(), CONTEXT);
    expect(result.records).toHaveLength(5);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set([JACANA_ENERGY_ENTITY]),
    );
    for (const record of result.records) {
      expect(record.jurisdiction).toBe(JACANA_ENERGY_JURISDICTION);
      expect(record.soc_line_item).not.toMatch(/(?:nt|state|national)[_-]?total/i);
      expect(record.project_name).not.toMatch(/NT total|state total|national total/i);
    }
  });
});
