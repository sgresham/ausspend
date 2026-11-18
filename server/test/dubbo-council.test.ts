import { describe, expect, it } from 'vitest';
import { moneyToCents, type PdfPage, type PdfTextItem } from '../src/connectors/pdf-extract.js';
import {
  DUBBO_DOCUMENTS,
  detectDubboUnit,
  formatFiscalYear,
  parseDubboCapitalPages,
  parseDubboExtraction,
  parseDubboSummaryPage,
  resolveUnitByScale,
  type DubboParseContext,
} from '../src/connectors/dubbo-council.js';

function item(str: string, x: number, y: number, page = 1): PdfTextItem {
  return { page_number: page, str, x, y, width: 0, height: 10 };
}

const FIVE_COLUMNS = [282, 335, 388, 441, 494];

function summaryPage(rows: Array<{ label: string; values?: number[] }>, page = 2): PdfPage {
  const items: PdfTextItem[] = [];
  let y = 760;
  items.push(item('Income and Expenditure Summary', 50, y, page));
  y -= 14;
  items.push(item('Consolidated', 50, y, page));
  y -= 14;
  ['2025/2026', '2026/2027', '2027/2028', '2028/2029', '2029/2030'].forEach((year, index) =>
    items.push(item(year, FIVE_COLUMNS[index]!, y, page)),
  );
  y -= 12;
  ['Annual Revised', 'Budget', 'Forecast', 'Forecast', 'Forecast'].forEach((label, index) =>
    items.push(item(label, FIVE_COLUMNS[index]!, y, page)),
  );
  y -= 12;
  items.push(item("($000's)", 50, y, page));
  for (const row of rows) {
    y -= 12;
    items.push(item(row.label, 50, y, page));
    row.values?.forEach((value, index) =>
      items.push(item(value.toLocaleString('en-AU'), FIVE_COLUMNS[index]!, y, page)),
    );
  }
  return { page_number: page, text: '', items };
}

function capitalPage(
  options: {
    grandTotalOverride?: number;
    categories?: Array<{ category: string; value: number; jobs: string[] }>;
    group?: string;
  } = {},
  page = 10,
): PdfPage {
  const group = options.group ?? 'Community Culture and Places';
  const categories = options.categories ?? [
    { category: 'Aquatic Leisure Centres', value: 40_000_000, jobs: ['00005800 - Test job'] },
    { category: 'Cemeteries', value: 60_000_000, jobs: ['00005400 - Extend Ashes Section'] },
  ];
  const items: PdfTextItem[] = [];
  let y = 780;
  items.push(item('DUBBO REGIONAL COUNCIL', 50, y, page));
  y -= 14;
  items.push(item('CAPITAL EXPENDITURE', 50, y, page));
  y -= 14;
  items.push(item('2026/2027', 364, y, page));
  y -= 12;
  ['Budget', '2027/2028 Forecast', '2028/2029 Forecast', '2029/2030 Forecast'].forEach(
    (label, index) => items.push(item(label, [369, 406, 459, 511][index]!, y, page)),
  );
  y -= 14;
  items.push(item(group, 49, y, page));
  for (const category of categories) {
    y -= 12;
    items.push(item(category.category, 57, y, page));
    for (const job of category.jobs) {
      y -= 12;
      items.push(item(job, 65, y, page));
      items.push(item('●', 365, y, page));
    }
    y -= 12;
    items.push(item(`${category.category} Total`, 57, y, page));
    items.push(item(category.value.toLocaleString('en-AU'), 365, y, page));
    items.push(item((category.value / 2).toLocaleString('en-AU'), 419, y, page));
    items.push(item((category.value / 2).toLocaleString('en-AU'), 471, y, page));
    items.push(item((category.value / 2).toLocaleString('en-AU'), 524, y, page));
  }
  const groupValue = categories.reduce((sum, category) => sum + category.value, 0);
  y -= 12;
  items.push(item(`${group} Total`, 49, y, page));
  items.push(item(groupValue.toLocaleString('en-AU'), 365, y, page));
  items.push(item((groupValue / 2).toLocaleString('en-AU'), 419, y, page));
  items.push(item((groupValue / 2).toLocaleString('en-AU'), 471, y, page));
  items.push(item((groupValue / 2).toLocaleString('en-AU'), 524, y, page));
  y -= 14;
  items.push(item('Capital Total', 49, y, page));
  const grand = options.grandTotalOverride ?? groupValue;
  items.push(item(grand.toLocaleString('en-AU'), 365, y, page));
  items.push(item((grand / 2).toLocaleString('en-AU'), 419, y, page));
  items.push(item((grand / 2).toLocaleString('en-AU'), 471, y, page));
  items.push(item((grand / 2).toLocaleString('en-AU'), 524, y, page));
  return { page_number: page, text: '', items };
}

const CONTEXT: DubboParseContext = {
  document: DUBBO_DOCUMENTS[0]!,
  archive: {
    local_path: '/tmp/ausspend-source-archive/dubbo-council/budget.pdf',
    sha256: 'a'.repeat(64),
    bytes: 1234,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
};

function summaryRows() {
  return [
    { label: 'Income' },
    { label: 'Rates and annual charges', values: [300_000, 310_000, 320_000, 330_000, 340_000] },
    { label: 'User charges and fees', values: [200_000, 210_000, 220_000, 230_000, 240_000] },
    {
      label: 'Total income from continuing operations',
      values: [500_000, 520_000, 540_000, 560_000, 580_000],
    },
    { label: 'Expenses' },
    {
      label: 'Employee benefits and on-costs',
      values: [100_000, 101_000, 102_000, 103_000, 104_000],
    },
    { label: 'Materials and services', values: [50_000, 51_000, 52_000, 53_000, 54_000] },
    {
      label: 'Total expenses from continuing operations',
      values: [150_000, 152_000, 154_000, 156_000, 158_000],
    },
  ];
}

describe('Dubbo unit detection', () => {
  it("reads ($000's) as thousands, not dollars", () => {
    const unit = detectDubboUnit(["($000's)"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);

    const asThousands = moneyToCents(83_735, 'thousands');
    const asDollars = moneyToCents(83_735, 'dollars');
    expect(asThousands).toBe(8_373_500_000);
    // If a $'000 table were read as dollars the amount would be 1000x too small.
    expect(asThousands).not.toBe(asDollars);
    expect(asDollars).toBe(8_373_500);
    expect(asThousands).toBe(asDollars * 1000);
  });

  it('never defaults a missing unit to dollars', () => {
    const unit = detectDubboUnit(['Capital Expenditure', '2026/2027']);
    expect(unit.kind).toBeNull();
    expect(unit.ambiguous).toBe(true);
  });

  it('reconciles the capital magnitude against the explicit summary', () => {
    const unit = resolveUnitByScale(119_744_813, 214_047_000);
    expect(unit.ambiguous).toBe(false);
    expect(unit.kind).toBe('dollars');
  });
});

describe('Dubbo budget summary', () => {
  it('parses the printed $000 unit and validates column totals', () => {
    const table = parseDubboSummaryPage(summaryPage(summaryRows()));
    expect(table).not.toBeNull();
    expect(table!.unit).toBe('thousands');
    expect(table!.fund).toBe('Consolidated');
    expect(table!.totals_ok).toBe(true);
    expect(table!.fiscal_years).toEqual(['2025-26', '2026-27', '2027-28', '2028-29', '2029-30']);
  });

  it('rejects a section whose column totals do not reconcile', () => {
    const rows = summaryRows();
    rows[3]!.values = [999_999, 520_000, 540_000, 560_000, 580_000];
    const table = parseDubboSummaryPage(summaryPage(rows));
    expect(table).not.toBeNull();
    expect(table!.totals_ok).toBe(false);
    expect(table!.errors.join(' ')).toMatch(/income mismatch/);
  });

  it('maps rows to integer cents, fiscal years, measure types and provenance', () => {
    const page = summaryPage(summaryRows());
    const extraction = {
      source: { sha256: 'a'.repeat(64), bytes: 1 },
      pages: [page],
      text: '',
      tables: [],
      warnings: [],
    };
    const parsed = parseDubboExtraction(extraction, CONTEXT);
    expect(parsed.records.length).toBeGreaterThanOrEqual(10);
    const rate = parsed.records.find(
      (record) => record.project_name === 'Consolidated: Rates and annual charges',
    );
    expect(rate).toBeDefined();
    expect(rate).toMatchObject({
      source_id: 'dubbo-council',
      measure_type: 'estimate',
      fiscal_year: '2025-26',
      jurisdiction_level: 'local',
      jurisdiction: 'NSW',
      verified: false,
      data_quality_flag: 'provisional',
    });
    expect(rate!.amount_cents).toBe(30_000_000_000);
    expect(Number.isSafeInteger(rate!.amount_cents)).toBe(true);
    expect(rate!.region_id).toBe('40d7a238d4b2cef48ae5f267');
    expect(rate!.location).toEqual({ state: 'NSW', lga_name: 'Dubbo' });
    expect(rate!.natural_key).toMatch(/^dubbo-council:/);
    expect(rate!.notes).toContain('unit thousands');
    for (const record of parsed.records) {
      expect(record.source_url).toBe(DUBBO_DOCUMENTS[0]!.url);
      expect(record.verified).toBe(false);
      expect(record.extraction_confidence).toMatch(/^(low|medium|high)$/);
    }
  });
});

describe('Dubbo capital works', () => {
  it('validates category, group and grand totals', () => {
    const program = parseDubboCapitalPages([capitalPage()], 10);
    expect(program.categories).toHaveLength(2);
    expect(program.group_totals).toHaveLength(1);
    expect(program.grand_total).toEqual([100_000_000, 50_000_000, 50_000_000, 50_000_000]);
    expect(program.totals_ok).toBe(true);
  });

  it('rejects the capital section when the grand total does not reconcile', () => {
    const program = parseDubboCapitalPages([capitalPage({ grandTotalOverride: 123 })], 10);
    expect(program.totals_ok).toBe(false);
    expect(program.errors.join(' ')).toMatch(/grand total/);
  });

  it('ingests capital category totals in dollars with job numbers', () => {
    const extraction = {
      source: { sha256: 'a'.repeat(64), bytes: 1 },
      pages: [summaryPage(summaryRows()), capitalPage()],
      text: '',
      tables: [],
      warnings: [],
    };
    const parsed = parseDubboExtraction(extraction, CONTEXT);
    const capital = parsed.records.filter((record) =>
      record.description?.startsWith('Capital works'),
    );
    expect(capital).toHaveLength(2);
    expect(capital[0]).toMatchObject({
      measure_type: 'budget',
      fiscal_year: '2026-27',
      extraction_confidence: 'medium',
      jurisdiction_level: 'local',
    });
    expect(capital[0]!.amount_cents).toBe(4_000_000_000);
    expect(capital[0]!.description).toContain('00005800 - Test job');
    expect(capital[0]!.funding_source).toContain('Capital works program');
  });

  it('formats fiscal years from the document and column headers', () => {
    expect(formatFiscalYear('2026/2027')).toBe('2026-27');
    expect(formatFiscalYear('2027/2028 Forecast')).toBe('2027-28');
    expect(formatFiscalYear('2026-27')).toBe('2026-27');
  });
});
