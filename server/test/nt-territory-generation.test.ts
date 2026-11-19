import { describe, expect, it } from 'vitest';
import {
  TERRITORY_GENERATION_ENTITY,
  TERRITORY_GENERATION_ID,
  TERRITORY_GENERATION_JURISDICTION,
  parseTerritoryGenerationAnnualReportLinks,
  parseTerritoryGenerationExtraction,
  territoryGenerationFiscalYearFromEndDate,
  territoryGenerationFiscalYearFromFilename,
  territoryGenerationNaturalKey,
  type TerritoryGenerationParseContext,
} from '../src/connectors/soc/nt/territory-generation.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';

const PDF_URL =
  'https://www.territorygeneration.com.au/wp-content/uploads/2026/10/Territory-Generation-Annual-Report-2025-26.pdf';

function item(str: string, x: number, y: number, page: number, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page: number): PdfTextItem {
  const width = Math.max(6, str.length * 4);
  return item(str, right - width, y, page, width);
}

function numberCell(value: number): string {
  return Math.abs(value).toLocaleString('en-AU');
}

function deduction(value: number): string {
  return `(${numberCell(value)})`;
}

interface StatementOptions {
  unit?: string;
  totalCostOfEnergy?: number;
  expensesSubtotal?: number;
  profitBeforeTax?: number;
  employeeCostOfEnergy?: number;
  employeeAdministrative?: number;
  cashflowDepreciation?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const page = 71;
  const unit = options.unit ?? "$'000";
  const items: PdfTextItem[] = [
    item('Statement of profit or loss and other comprehensive income', 85, 765, page),
    item('For the year ended 30 June 2026', 85, 686, page),
    item('Note', 380, 663, page),
    item('2026', 442, 663, page),
    item('2025', 513, 663, page),
    item(unit, 440, 647, page, 23),
    item(unit, 510, 647, page, 23),
  ];
  let y = 614;
  const add = (label: string, printed: string | null) => {
    items.push(item(label, 89, y, page));
    if (printed !== null) items.push(money(printed, 463.3, y, page));
    y -= 17;
  };
  add('Revenue', numberCell(337441));
  add('Cost of energy', deduction(280132));
  add('Gross profit', numberCell(57309));
  add('Other income', numberCell(4259));
  add('Administrative expenses', deduction(23241));
  add('Other expenses', deduction(3428));
  add('Impairment (reversals)/expenses', deduction(12779));
  add('Finance costs', deduction(13471));
  add('Profit before income tax', numberCell(options.profitBeforeTax ?? 34207));
  add('Income tax expense', numberCell(9945));
  add('Profit for the year', numberCell(24262));
  add('Other comprehensive income', '–');
  add('Total comprehensive income for the year', numberCell(24262));
  return { page_number: page, items, text: items.map((entry) => entry.str).join(' ') };
}

function notesPage(options: StatementOptions = {}): PdfPage {
  const page = 84;
  const unit = options.unit ?? "$'000";
  const items: PdfTextItem[] = [
    item('2026', 414, 773, page),
    item('2025', 486, 773, page),
    item(unit, 411, 757, page, 23),
    item(unit, 483, 757, page, 23),
    item('3.', 60, 741, page),
    item('REVENUE', 83, 741, page),
    item('4.', 60, 566, page),
    item('EXPENSES', 83, 566, page),
  ];
  let y = 715;
  const add = (label: string | null, printed: string | null) => {
    if (label) items.push(item(label, 83, y, page));
    if (printed !== null) items.push(money(printed, 434.5, y, page));
    y -= 13.4;
  };
  add('Electricity sales', numberCell(331858));
  add('Deferred grant income', numberCell(4146));
  add('Other revenue', numberCell(1437));
  add(null, numberCell(337441));
  add('Claim recoveries and other income', numberCell(2347));
  add('Interest income', numberCell(1912));
  y -= 20;
  add('Energy costs', numberCell(172453));
  add('Repairs and maintenance', numberCell(32799));
  add('Employee benefits expense', numberCell(options.employeeCostOfEnergy ?? 33901));
  add('Property costs', numberCell(5366));
  add('Other administrative costs', numberCell(5264));
  add('Inventory valuation', numberCell(509));
  add('Depreciation and amortisation', numberCell(29840));
  add('Total cost of energy', deduction(options.totalCostOfEnergy ?? 280132));
  y -= 20;
  add('Employee benefits expense', numberCell(options.employeeAdministrative ?? 11600));
  add('Insurance', numberCell(3564));
  add('IT and communications', numberCell(3038));
  add('Professional fees', numberCell(1724));
  add('Other administrative costs', numberCell(1955));
  add('Depreciation and amortisation', numberCell(1360));
  add('Total administrative expenses', deduction(23241));
  y -= 20;
  add('Operational projects', numberCell(3132));
  add('Foreign exchange loss/(gain)', numberCell(296));
  add('Total other expenses', deduction(3428));
  y -= 20;
  items.push(item('Impairment expense', 83, y, page));
  items.push(money('–', 434.5, y, page));
  items.push(money(numberCell(17365), 506.3, y, page));
  y -= 13.4;
  add('Impairment reversal', deduction(12779));
  add('Total net impairment of assets', deduction(12779));
  y -= 20;
  add('Interest and finance charges', numberCell(13471));
  add('Total finance costs', deduction(13471));
  return { page_number: page, items, text: items.map((entry) => entry.str).join(' ') };
}

function cashflowPage(options: StatementOptions = {}): PdfPage {
  const page = 95;
  const unit = options.unit ?? "$'000";
  const items: PdfTextItem[] = [
    item('2026', 442, 773, page),
    item('2025', 514, 773, page),
    item(unit, 440, 758, page, 23),
    item(unit, 511, 758, page, 23),
    item('RECONCILIATION OF PROFIT AFTER INCOME TAX TO', 114, 739, page),
    item('NET CASH FROM OPERATING ACTIVITIES', 114, 726, page),
    item('Profit/(loss) after income tax expense for the year', 114, 690, page),
    money(numberCell(24262), 462.8, 690, page),
    item('Depreciation and amortisation', 114, 639, page),
    money(numberCell(options.cashflowDepreciation ?? 31200), 462.8, 639, page),
  ];
  return { page_number: page, items, text: items.map((entry) => entry.str).join(' ') };
}

function extraction(options: StatementOptions = {}): PdfExtraction {
  const pages = [facePage(options), notesPage(options), cashflowPage(options)];
  return {
    source: { url: PDF_URL, sha256: 'test-sha', bytes: 1 },
    pages,
    text: pages.map((page) => page.text).join('\n\n'),
    tables: [],
    warnings: [],
  };
}

const CONTEXT: TerritoryGenerationParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–2026',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/tmp/ausspend-source-archive/nt-territory-generation/tg.pdf',
    sha256: 'f801b948156383c110245fb622a59a0dda4b5e0fe5b163fa599f2227abc17c9e',
    bytes: 8_695_953,
  },
  source_date: '2026-11-19',
};

describe('Territory Generation discovery', () => {
  it('selects the newest annual-report PDF from the official page and ignores SCI publications', () => {
    const html = [
      '<a href="/wp-content/uploads/2024/11/Territory-Generation-Annual-Report-2023-24-Web-res.pdf">2023-24</a>',
      '<a href="/wp-content/uploads/2025/10/Annual-Report-2024-25.pdf">2024-25</a>',
      '<a href="/wp-content/uploads/2026/10/Territory-Generation-Annual-Report-2025-26.pdf">2025-26</a>',
      '<a href="/wp-content/uploads/2025/05/Statement-of-Corporate-Intent-2025-26.pdf">SCI</a>',
    ].join('\n');
    const links = parseTerritoryGenerationAnnualReportLinks(
      html,
      'https://www.territorygeneration.com.au/news-publications/corporate-publications/',
    );
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links[0]?.url).toBe(PDF_URL);
    expect(links[0]?.filename).toBe('Territory-Generation-Annual-Report-2025-26.pdf');
  });

  it('converts filename ranges and year-ended dates to the API fiscal year', () => {
    expect(
      territoryGenerationFiscalYearFromFilename('Territory-Generation-Annual-Report-2025-26.pdf'),
    ).toBe('2025-26');
    expect(territoryGenerationFiscalYearFromFilename('Annual-Report-2024-25.pdf')).toBe('2024-25');
    expect(
      territoryGenerationFiscalYearFromFilename('Statement-of-Corporate-Intent-2025-26.pdf'),
    ).toBe('2025-26');
    expect(territoryGenerationFiscalYearFromFilename('other.pdf')).toBeNull();
    expect(territoryGenerationFiscalYearFromEndDate('2026-06-30')).toBe('2025-26');
  });
});

describe('Territory Generation statement', () => {
  it('extracts exactly five entity-level rows and reconciles every printed subtotal', () => {
    const result = parseTerritoryGenerationExtraction(extraction(), CONTEXT);
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
      total_revenue: 34_170_000_000,
      total_expenses: 30_749_300_000,
      employee_expenses: 4_550_100_000,
      depreciation_amortisation: 3_120_000_000,
      net_result: 2_426_200_000,
    });
    for (const record of result.records) {
      expect(record.source_id).toBe(TERRITORY_GENERATION_ID);
      expect(record.jurisdiction).toBe('NT');
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.measure_type).toBe('actual');
      expect(record.verified).toBe(false);
      expect(record.potential_double_count).toBe(false);
      expect(record.delivery_entity).toBe(TERRITORY_GENERATION_ENTITY);
    }
    expect(result.checks.some((check) => check.startsWith('gross-profit bridge'))).toBe(true);
    expect(result.checks.some((check) => check.startsWith('profit-before-income-tax bridge'))).toBe(
      true,
    );
    expect(result.checks.some((check) => check.startsWith('net-result bridge'))).toBe(true);
    expect(
      result.checks.some((check) => check.startsWith('Note 4 depreciation total = Note 20')),
    ).toBe(true);
  });

  it('rejects a missing printed unit instead of guessing dollars', () => {
    const result = parseTerritoryGenerationExtraction(extraction({ unit: '' }), CONTEXT);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
  });

  it('rejects an ambiguous printed unit', () => {
    const pages = [facePage(), notesPage(), cashflowPage()];
    pages[0]?.items.push(item('$M', 360, 647, 71, 18));
    const ambiguous: PdfExtraction = {
      source: { url: PDF_URL, sha256: 'test-sha', bytes: 1 },
      pages,
      text: pages.map((page) => page.text).join('\n\n'),
      tables: [],
      warnings: [],
    };
    const result = parseTerritoryGenerationExtraction(ambiguous, CONTEXT);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
  });

  it('defers with zero rows when a printed note subtotal does not reconcile', () => {
    const result = parseTerritoryGenerationExtraction(
      extraction({ totalCostOfEnergy: 280133 }),
      CONTEXT,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.statement?.errors.join(' ')).toContain('Note 4 total cost of energy');
  });

  it('defers when the face expense lines do not bridge to printed profit before tax', () => {
    const result = parseTerritoryGenerationExtraction(
      extraction({ profitBeforeTax: 34208 }),
      CONTEXT,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.statement?.errors.join(' ')).toContain('profit-before-income-tax bridge');
  });

  it('defers when the Note 4 depreciation total disagrees with the Note 20 reconciliation', () => {
    const result = parseTerritoryGenerationExtraction(
      extraction({ cashflowDepreciation: 31201 }),
      CONTEXT,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.statement?.errors.join(' ')).toContain('Note 20');
  });

  it('uses a deterministic natural key so a re-run is idempotent and line-specific', () => {
    const first = parseTerritoryGenerationExtraction(extraction(), CONTEXT);
    const second = parseTerritoryGenerationExtraction(extraction(), CONTEXT);
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(new Set(first.records.map((record) => record.natural_key)).size).toBe(5);
    const base = territoryGenerationNaturalKey(
      'Territory Generation',
      '2025-26',
      'total_revenue',
      PDF_URL,
    );
    expect(
      territoryGenerationNaturalKey('Territory Generation', '2025-26', 'total_revenue', PDF_URL),
    ).toBe(base);
    expect(
      territoryGenerationNaturalKey('Territory Generation', '2025-26', 'total_expenses', PDF_URL),
    ).not.toBe(base);
    expect(
      territoryGenerationNaturalKey('Territory Generation', '2024-25', 'total_revenue', PDF_URL),
    ).not.toBe(base);
  });

  it('never creates an NT or cross-entity aggregate row', () => {
    const result = parseTerritoryGenerationExtraction(extraction(), CONTEXT);
    expect(result.records).toHaveLength(5);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set([TERRITORY_GENERATION_ENTITY]),
    );
    for (const record of result.records) {
      expect(record.jurisdiction).toBe(TERRITORY_GENERATION_JURISDICTION);
      expect(record.soc_line_item).not.toMatch(/(?:nt|state|national)[_-]?total/i);
      expect(record.project_name).not.toMatch(/NT total|state total|national total/i);
      expect(record.notes).not.toMatch(/aggregate total/i);
    }
  });
});
