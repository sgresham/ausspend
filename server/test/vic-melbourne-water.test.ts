import { describe, expect, it } from 'vitest';
import {
  MELBOURNE_WATER_ENTITY,
  MELBOURNE_WATER_ID,
  MELBOURNE_WATER_JURISDICTION,
  melbourneWaterFiscalYearFromEndDate,
  melbourneWaterFiscalYearFromFilename,
  melbourneWaterNaturalKey,
  parseMelbourneWaterAnnualReportLinks,
  parseMelbourneWaterExtraction,
  type MelbourneWaterParseContext,
} from '../src/connectors/soc/vic/melbourne-water.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';

const PDF_URL = 'https://www.melbournewater.com.au/media/eyJtZWRpYSI6IjMxNTg2In0%3D/downloads';

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
  taxExpense?: number;
  netResult?: number;
  employeeTotal?: number;
  depreciationTotal?: number;
  totalExpenses?: number;
  netComprehensive?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const page = 111;
  const unit = options.unit ?? '($ thousands)';
  const items: PdfTextItem[] = [
    item('Statement of Profit or Loss and Other Comprehensive Income', 48, 776, page),
    item('For the year ended 30 June 2026', 48, 722, page),
    item(unit, 492, 679, page, 41),
    item('2026', 480, 664, page, 18),
    item('2025', 534, 664, page, 17),
  ];
  let y = 636;
  const add = (label: string, printed: string | null) => {
    items.push(item(label, 52, y, page));
    if (printed !== null) items.push(money(printed, 498, y, page));
    y -= 14;
  };
  const taxExpense = options.taxExpense ?? 83_393;
  const netResult = options.netResult ?? 95_476;
  add('Revenue from contracts with customers', numberCell(2_205_314));
  add('Other revenue', numberCell(17_816));
  add('Total revenue', numberCell(2_223_130));
  add('Depreciation and amortisation', deduction(538_676));
  add('Operational expenses', deduction(343_146));
  add('Employee benefits', deduction(189_952));
  add('Repairs and maintenance', deduction(119_023));
  add('Administrative expenses', deduction(74_214));
  add('Finance expenses', deduction(605_577));
  add('Government rates and taxes', deduction(86_526));
  add('Asset transfers to Councils', deduction(61_188));
  add('Other expenses', deduction(12_340));
  add('Net loss on revaluation of non-financial assets', deduction(13_619));
  add('Total expenses', deduction(options.totalExpenses ?? 2_044_261));
  add('Net profit from operations before tax', numberCell(178_869));
  add('Tax expense', deduction(taxExpense));
  add('Net profit for the period after tax', numberCell(netResult));
  add('Other comprehensive income/(loss) for the period after tax', numberCell(1_969_192));
  add(
    'Total comprehensive income for the period after tax',
    numberCell(options.netComprehensive ?? 2_064_668),
  );
  return { page_number: page, items, text: items.map((entry) => entry.str).join(' ') };
}

function employeePage(options: StatementOptions = {}): PdfPage {
  const page = 122;
  const unit = options.unit ?? '($ thousands)';
  const items: PdfTextItem[] = [
    item('3.2 Employee benefits expenses and employee benefits provision', 44, 692, page),
    item(unit, 487, 693, page, 41),
    item('2026', 469, 678, page, 18),
    item('2025', 526, 678, page, 17),
  ];
  let y = 664;
  const add = (label: string, printed: number) => {
    items.push(item(label, 44, y, page));
    items.push(money(numberCell(printed), 487, y, page));
    y -= 14;
  };
  add('Salary and wages expenses', 145_830);
  add('Annual, long service and shift leave expenses', 18_285);
  add('Defined contribution plans (superannuation accumulation fund) expense', 18_058);
  add('Other employee expenses', 7_779);
  add('Total employee benefits expenses', options.employeeTotal ?? 189_952);
  return { page_number: page, items, text: items.map((entry) => entry.str).join(' ') };
}

function depreciationPage(options: StatementOptions = {}): PdfPage {
  const page = 138;
  const unit = options.unit ?? '($ thousands)';
  const items: PdfTextItem[] = [
    item('4.1.3 Depreciation, amortisation and impairment', 44, 759, page),
    item(unit, 490, 761, page, 41),
    item('2026', 474, 745, page, 18),
    item('2025', 526, 745, page, 17),
  ];
  let y = 731;
  const add = (label: string, printed: number) => {
    items.push(item(label, 44, y, page));
    items.push(money(numberCell(printed), 492, y, page));
    y -= 14;
  };
  add('Buildings', 1_399);
  add('Leasehold improvements', 55);
  add('Plant and equipment', 7_166);
  add('Fleet vehicles', 2_487);
  add('Infrastructure assets', 420_924);
  add('VDP service concession asset', 90_050);
  add('Right of use assets', 8_071);
  add('Total depreciation', 530_152);
  add('Intangible assets', 8_524);
  add('Total amortisation', 8_524);
  add('Total depreciation and amortisation', options.depreciationTotal ?? 538_676);
  return { page_number: page, items, text: items.map((entry) => entry.str).join(' ') };
}

function extraction(options: StatementOptions = {}): PdfExtraction {
  const pages = [facePage(options), employeePage(options), depreciationPage(options)];
  return {
    source: { url: PDF_URL, sha256: 'test-sha', bytes: 1 },
    pages,
    text: pages.map((page) => page.text).join('\n\n'),
    tables: [],
    warnings: [],
  };
}

const CONTEXT: MelbourneWaterParseContext = {
  document_url: PDF_URL,
  document_title: 'Melbourne Water Annual Report 2025-26 (Accessible version)',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/tmp/ausspend-source-archive/vic-melbourne-water/mw.pdf',
    sha256: 'f'.repeat(64),
    bytes: 26_868_975,
  },
  source_date: '2026-11-19',
};

describe('Melbourne Water discovery', () => {
  it('selects the newest accessible annual-report media link from the official page', () => {
    const html = [
      '<a href=" /media/eyJtZWRpYSI6IjI5ODY2In0%253D/downloads "><span class="file-name">Melbourne Water Annual Report 2024-25</span></a>',
      '<a href=" /media/eyJtZWRpYSI6IjMxNTgxIn0%253D/downloads "><span class="file-name">Melbourne Water Annual Report 2025-26</span></a>',
      '<a href=" /media/eyJtZWRpYSI6IjMxNTg2In0%253D/downloads "><span class="file-name">Melbourne Water Annual Report 2025-26 (Accessible version)</span></a>',
      '<a href="/media/eyJtZWRpYSI6IjMxNTkxIn0%253D/downloads"><span class="file-name">Corporate Plan 2025-26</span></a>',
    ].join('\n');
    const links = parseMelbourneWaterAnnualReportLinks(
      html,
      'https://www.melbournewater.com.au/about/publications/annual-report',
    );
    expect(links.map((link) => link.fiscal_year).slice(0, 3)).toEqual([
      '2025-26',
      '2025-26',
      '2024-25',
    ]);
    expect(links[0]?.url).toBe(PDF_URL);
    expect(links[0]?.accessible).toBe(true);
    expect(links[0]?.title).toBe('Melbourne Water Annual Report 2025-26 (Accessible version)');
  });

  it('converts year ranges and year-ended dates to the API fiscal year', () => {
    expect(melbourneWaterFiscalYearFromFilename('Annual Report 2025-26.pdf')).toBe('2025-26');
    expect(
      melbourneWaterFiscalYearFromFilename('Melbourne-Water-Annual-Report-2022-2023.pdf'),
    ).toBe('2022-23');
    expect(melbourneWaterFiscalYearFromFilename('other.pdf')).toBeNull();
    expect(melbourneWaterFiscalYearFromEndDate('2026-06-30')).toBe('2025-26');
  });
});

describe('Melbourne Water statement', () => {
  it('extracts exactly five entity-level rows and reconciles every printed subtotal', () => {
    const result = parseMelbourneWaterExtraction(extraction(), CONTEXT);
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
      total_revenue: 222_313_000_000,
      total_expenses: 204_426_100_000,
      employee_expenses: 18_995_200_000,
      depreciation_amortisation: 53_867_600_000,
      net_result: 9_547_600_000,
    });
    for (const record of result.records) {
      expect(record.source_id).toBe(MELBOURNE_WATER_ID);
      expect(record.jurisdiction).toBe('VIC');
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.measure_type).toBe('actual');
      expect(record.verified).toBe(false);
      expect(record.potential_double_count).toBe(false);
      expect(record.delivery_entity).toBe(MELBOURNE_WATER_ENTITY);
      expect(record.notes).toMatch(/statutory water corporation under the Water Act 1989/);
      expect(record.notes).toMatch(/not a GBE/);
    }
    expect(
      result.checks.some((check) => check.startsWith('revenue components = printed Total revenue')),
    ).toBe(true);
    expect(
      result.checks.some((check) =>
        check.startsWith('sum of printed expense lines = printed Total expenses'),
      ),
    ).toBe(true);
    expect(
      result.checks.some((check) =>
        check.startsWith('Net profit for the period after tax = Net profit before tax'),
      ),
    ).toBe(true);
    expect(
      result.checks.some((check) =>
        check.startsWith('Note 4.1.3 Total depreciation and amortisation = face'),
      ),
    ).toBe(true);
  });

  it('rejects a missing printed unit instead of guessing dollars', () => {
    const result = parseMelbourneWaterExtraction(extraction({ unit: '' }), CONTEXT);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
  });

  it('rejects an ambiguous printed unit', () => {
    const pages = [facePage(), employeePage(), depreciationPage()];
    pages[0]?.items.push(item('$M', 460, 679, 111, 18));
    const ambiguous: PdfExtraction = {
      source: { url: PDF_URL, sha256: 'test-sha', bytes: 1 },
      pages,
      text: pages.map((page) => page.text).join('\n\n'),
      tables: [],
      warnings: [],
    };
    const result = parseMelbourneWaterExtraction(ambiguous, CONTEXT);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
  });

  it('defers with zero rows when the employee note does not reconcile to the face line', () => {
    const result = parseMelbourneWaterExtraction(extraction({ employeeTotal: 189_953 }), CONTEXT);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.statement?.errors.join(' ')).toContain('Note 3.2');
  });

  it('defers when the depreciation note does not reconcile to the face line', () => {
    const result = parseMelbourneWaterExtraction(
      extraction({ depreciationTotal: 538_677 }),
      CONTEXT,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.statement?.errors.join(' ')).toContain('Note 4.1.3');
  });

  it('defers when the printed expense lines do not sum to Total expenses', () => {
    const result = parseMelbourneWaterExtraction(extraction({ totalExpenses: 2_044_262 }), CONTEXT);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.statement?.errors.join(' ')).toContain('printed Total expenses');
  });

  it('defers when the net-result bridge does not agree', () => {
    const result = parseMelbourneWaterExtraction(extraction({ netResult: 95_477 }), CONTEXT);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.statement?.errors.join(' ')).toContain('Net profit for the period after tax');
  });

  it('uses a deterministic natural key so a re-run is idempotent and line-specific', () => {
    const first = parseMelbourneWaterExtraction(extraction(), CONTEXT);
    const second = parseMelbourneWaterExtraction(extraction(), CONTEXT);
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(new Set(first.records.map((record) => record.natural_key)).size).toBe(5);
    const base = melbourneWaterNaturalKey('Melbourne Water', '2025-26', 'total_revenue', PDF_URL);
    expect(melbourneWaterNaturalKey('Melbourne Water', '2025-26', 'total_revenue', PDF_URL)).toBe(
      base,
    );
    expect(
      melbourneWaterNaturalKey('Melbourne Water', '2025-26', 'total_expenses', PDF_URL),
    ).not.toBe(base);
    expect(
      melbourneWaterNaturalKey('Melbourne Water', '2024-25', 'total_revenue', PDF_URL),
    ).not.toBe(base);
  });

  it('never creates a VIC, water-sector or cross-entity aggregate row', () => {
    const result = parseMelbourneWaterExtraction(extraction(), CONTEXT);
    expect(result.records).toHaveLength(5);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set([MELBOURNE_WATER_ENTITY]),
    );
    for (const record of result.records) {
      expect(record.jurisdiction).toBe(MELBOURNE_WATER_JURISDICTION);
      expect(record.soc_line_item).not.toMatch(/(?:vic|state|national|water)[_-]?total/i);
      expect(record.project_name).not.toMatch(/VIC total|state total|national total/i);
      expect(record.notes).not.toMatch(/aggregate total/i);
    }
  });
});
