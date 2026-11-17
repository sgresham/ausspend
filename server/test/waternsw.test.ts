import { describe, expect, it } from 'vitest';
import {
  detectWaterNswUnit,
  parseWaterNswAnnualReportLinks,
  parseWaterNswExtraction,
  parseWaterNswStatement,
  waterNswNaturalKey,
  WATERNSW_ID,
  type WaterNswParseContext,
} from '../src/connectors/soc/nsw/waternsw.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const URL_2025 =
  'https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf';

function item(str: string, x: number, y: number, page = 1, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

/** Right-align a money cell at `right`, so column anchoring matches the PDF. */
function money(str: string, right: number, y: number, page = 1): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const COLUMN_RIGHTS = [378, 433, 487, 540];

interface RowSpec {
  label?: string;
  note?: string;
  values?: Array<number | null>;
}

function statementPage(
  options: { unit?: string; totalExpensesOverride?: number; pbtOverride?: number } = {},
): PdfPage {
  const unit = options.unit ?? '$’000';
  const pageNumber = 59;
  const items: PdfTextItem[] = [
    item('Statements of comprehensive income', 61, 760, pageNumber),
    item('Statements of financial position', 625, 760, pageNumber),
    item('For the year ended 30 June 2025', 61, 745, pageNumber),
    item('Consolidated', 376, 730, pageNumber),
    item('Parent', 511, 730, pageNumber),
    item('Consolidated', 949, 730, pageNumber),
    item('Parent', 1094, 730, pageNumber),
    item('2025', 356, 716, pageNumber),
    item('2024', 410, 716, pageNumber),
    item('2025', 465, 716, pageNumber),
    item('2024', 518, 716, pageNumber),
    item('2025', 928, 716, pageNumber),
    item('2024', 985, 716, pageNumber),
    item('2025', 1044, 716, pageNumber),
    item('2024', 1101, 716, pageNumber),
  ];
  for (const x of [354, 408, 463, 516]) items.push(item(unit, x, 704, pageNumber));
  for (const x of [926, 983, 1041, 1099]) items.push(item(unit, x, 704, pageNumber));

  const rows: RowSpec[] = [
    {
      label: 'Revenue from water supply and delivery',
      note: '2',
      values: [379_720, 376_490, 355_516, 353_038],
    },
    { label: 'Grants and subsidies', note: '3', values: [65_336, 67_109, 65_336, 67_109] },
    { label: 'Other revenue', note: '4', values: [49_948, 54_089, 51_300, 55_470] },
    { label: 'Total revenue', values: [495_004, 497_688, 472_152, 475_617] },
    {
      label: 'Employee related expenses',
      note: '5',
      values: [-163_654, -141_587, -163_654, -141_587],
    },
    {
      label: 'Depreciation and amortisation',
      note: '7',
      values: [-107_530, -105_418, -101_800, -99_911],
    },
    {
      label: 'Other operating expenses',
      note: '6',
      values: [-113_348, -119_595, -109_488, -115_984],
    },
    { label: 'Finance costs', note: '8', values: [-88_299, -67_497, -74_233, -54_928] },
    {
      label: 'Total expenses',
      values: [-(options.totalExpensesOverride ?? 472_831), -434_097, -449_175, -412_410],
    },
    { label: 'Operating profit', values: [22_173, 63_590, 22_977, 63_208] },
    { label: 'Other gains/(losses)', note: '9', values: [1_607, 384, 1_607, 384] },
    { label: 'Gains/(losses) on revaluation of property, plant and' },
    { label: 'equipment', note: '14', values: [-12, 188, 84, 187] },
    {
      label: 'Profit before income tax expense',
      values: [options.pbtOverride ?? 23_768, 64_163, 24_668, 63_778],
    },
    { label: 'Income tax expense', note: '10', values: [-7_117, -19_224, -7_388, -19_108] },
    { label: 'Profit after income tax expense for the year' },
    {
      label: 'attributable to the owners of Water NSW',
      values: [16_651, 44_939, 17_280, 44_670],
    },
    { label: 'Total comprehensive income for the year' },
    {
      label: 'attributable to the owners of Water NSW',
      values: [131_244, 99_976, 125_563, 88_009],
    },
  ];

  let y = 688;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 63, y, pageNumber));
    if (row.note) items.push(item(row.note, 306, y, pageNumber, 5));
    (row.values ?? []).forEach((value, index) => {
      const right = COLUMN_RIGHTS[index];
      if (right === undefined) return;
      if (typeof value === 'number')
        items.push(money(value.toLocaleString('en-AU'), right, y, pageNumber));
    });
    y -= 12;
  }
  // The balance-sheet panel sits beside the statement; its values must never
  // be read as income-statement amounts.
  items.push(item('Assets', 625, 688, pageNumber));
  items.push(money('4,102,290', 950, 676, pageNumber));
  return {
    page_number: pageNumber,
    text: 'Statements of comprehensive income For the year ended 30 June 2025 Revenue Grants and subsidies Total revenue Expenses Employee related expenses Depreciation and amortisation Other operating expenses Finance costs Total expenses Operating profit Profit before income tax expense Income tax expense',
    items,
  };
}

function grantsPage(options: { contributionsOverride?: number } = {}): PdfPage {
  const pageNumber = 64;
  const items: PdfTextItem[] = [
    item('3 Grants and subsidies', 645, 760, pageNumber),
    item('2025', 926, 740, pageNumber),
    item('2024', 983, 740, pageNumber),
    item('2025', 1041, 740, pageNumber),
    item('2024', 1098, 740, pageNumber),
  ];
  for (const x of [924, 981, 1038, 1096]) items.push(item('$’000', x, 728, pageNumber));
  const rows: RowSpec[] = [
    {
      label: 'NSW Government contributions to operations',
      values: [options.contributionsOverride ?? 41_669, 40_377, 41_669, 40_377],
    },
    { label: 'NSW Government subsidies', values: [14_004, 12_616, 14_004, 12_616] },
    { label: 'Other Government grants', values: [9_663, 14_116, 9_663, 14_116] },
    { values: [65_336, 67_109, 65_336, 67_109] },
  ];
  const rights = [949, 1006, 1063, 1120];
  let y = 696;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 619, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      const right = rights[index];
      if (right === undefined) return;
      if (typeof value === 'number')
        items.push(money(value.toLocaleString('en-AU'), right, y, pageNumber));
    });
    y -= 16;
  }
  return {
    page_number: pageNumber,
    text: '3 Grants and subsidies NSW Government contributions to operations NSW Government subsidies Other Government grants',
    items,
  };
}

function extraction(
  options: {
    statement?: Parameters<typeof statementPage>[0];
    grants?: Parameters<typeof grantsPage>[0];
  } = {},
): PdfExtraction {
  return {
    source: { url: URL_2025, sha256: 'b'.repeat(64), bytes: 42_917_371 },
    pages: [statementPage(options.statement), grantsPage(options.grants)],
    text: 'Statements of comprehensive income for the year ended 30 June 2025',
    tables: [],
    warnings: [],
  };
}

const context: WaterNswParseContext = {
  document_url: URL_2025,
  document_title: 'Annual Report 2024-25',
  fiscal_year: '2024-25',
  archive: {
    local_path: '/archive/waternsw/waternsw-ar-2024-25.pdf',
    sha256: 'b'.repeat(64),
    bytes: 42_917_371,
  },
  source_date: '2026-11-17',
};

function recordFor(result: ReturnType<typeof parseWaterNswExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('WaterNSW annual-report discovery', () => {
  it('selects the latest annual report and ignores half-yearly and older reports', () => {
    const html = `
      <a href="https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Half-Yearly-Report-2024-25.pdf">Half yearly 2024-25</a>
      <a href="https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2023-24.pdf">Annual Report 2023–24</a>
      <a href="https://www.waternsw.com.au/publications/WaterNSW_Annual-Report-2022-23.pdf">Annual Report 2022–23</a>
      <a href="${URL_2025}">Annual Report 2024–25</a>
      <a href="https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Statement-of-Corporate-Intent-2025-2026.pdf">SCI</a>`;
    const links = parseWaterNswAnnualReportLinks(html);
    expect(links).toHaveLength(3);
    expect(links[0]).toMatchObject({ fiscal_year: '2024-25', url: URL_2025 });
    expect(links.some((link) => /half/i.test(link.filename))).toBe(false);
    expect(links.some((link) => /corporate-intent/i.test(link.filename))).toBe(false);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24', '2022-23']);
  });
});

describe('WaterNSW $’000 guard', () => {
  it('detects an explicit $’000 unit and converts at 100,000 cents per unit', () => {
    const unit = detectWaterNswUnit(["$’000 2025 $'000 2024"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const noUnit = statementPage({ unit: '' });
    const result = parseWaterNswExtraction(
      { ...extraction(), pages: [noUnit, grantsPage()] },
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars instead of $’000', () => {
    const dollars = statementPage({ unit: '$' });
    const parsed = parseWaterNswStatement(dollars);
    expect(parsed?.unit.kind).toBe('dollars');
    expect(parsed?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const result = parseWaterNswExtraction(
      { ...extraction(), pages: [dollars, grantsPage()] },
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
  });
});

describe('WaterNSW exact reconciliation and rows', () => {
  it('accepts the explicit printed Total expenses and reconciles every printed bridge exactly', () => {
    const result = parseWaterNswExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_expenses).toBe(472_831);
    expect(result.statement?.total_revenue).toBe(495_004);
    expect(result.checks.join(' ')).toContain(
      'expense components exact: |163654| + |107530| + |113348| + |88299| = 472831',
    );
    expect(result.checks.join(' ')).toContain(
      'operating-profit bridge exact: 495004 + (-472831) = 22173',
    );
    expect(result.checks.join(' ')).toContain(
      'profit-before-tax bridge exact: 22173 + 1607 + (-12) = 23768',
    );
    expect(result.checks.join(' ')).toContain(
      'Note 3 grants subtotal exact: 41669 + 14004 + 9663 = 65336',
    );
  });

  it('maps the required lines, government grants and net result with provenance and exact cents', () => {
    const result = parseWaterNswExtraction(extraction(), context);
    expect(result.records).toHaveLength(8);
    const totalExpenses = recordFor(result, 'total_expenses');
    expect(totalExpenses).toMatchObject({
      amount_cents: 47_283_100_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'WaterNSW',
      funding_source: 'WaterNSW',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: WATERNSW_ID,
      source_url: URL_2025,
      source_dataset: 'WaterNSW Annual Report 2024-25',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      extraction_confidence: 'high',
      location: { state: 'NSW' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(49_500_400_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(16_365_400_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(10_753_000_000);
    expect(recordFor(result, 'net_result')?.amount_cents).toBe(1_665_100_000);
    expect(recordFor(result, 'nsw_government_contributions_to_operations')).toMatchObject({
      amount_cents: 4_166_900_000,
      funding_source:
        'NSW Government — Department of Climate Change, Energy, the Environment and Water',
      potential_double_count: true,
    });
    expect(recordFor(result, 'nsw_government_subsidies')).toMatchObject({
      amount_cents: 1_400_400_000,
      funding_source: 'NSW Government',
      potential_double_count: true,
    });
    expect(recordFor(result, 'other_government_grants')).toMatchObject({
      amount_cents: 966_300_000,
      potential_double_count: true,
    });
  });

  it('defers on a one-unit Total expenses / operating-profit mismatch instead of ingesting', () => {
    const result = parseWaterNswExtraction(
      extraction({ statement: { totalExpensesOverride: 472_832 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-unit profit-before-tax mismatch instead of ingesting', () => {
    const result = parseWaterNswExtraction(
      extraction({ statement: { pbtOverride: 23_769 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when Note 3 grants do not sum to the statement Grants and subsidies line', () => {
    const result = parseWaterNswExtraction(
      extraction({ grants: { contributionsOverride: 41_670 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 3 grants subtotal mismatch/);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseWaterNswExtraction(extraction(), { ...context, fiscal_year: '2023-24' });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('WaterNSW natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = waterNswNaturalKey('WaterNSW', '2024-25', 'total_expenses', URL_2025);
    expect(key).toMatch(/^waternsw:[0-9a-f]{40}$/);
    expect(key).toBe(waterNswNaturalKey('WaterNSW', '2024-25', 'total_expenses', URL_2025));
    expect(key).not.toBe(waterNswNaturalKey('WaterNSW', '2024-25', 'total_revenue', URL_2025));
    expect(key).not.toBe(waterNswNaturalKey('WaterNSW', '2023-24', 'total_expenses', URL_2025));
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseWaterNswExtraction(extraction(), context);
    const second = parseWaterNswExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('WaterNSW no-sum / double-count separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseWaterNswExtraction(extraction(), context);
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
  });

  it('flags government-named grant rows but not the own-source revenue/expense rows', () => {
    const result = parseWaterNswExtraction(extraction(), context);
    expect(recordFor(result, 'total_revenue')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'total_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'employee_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'net_result')?.potential_double_count).toBe(false);
    const flagged = result.records.filter((record) => record.potential_double_count);
    expect(flagged.map((record) => record.soc_line_item)).toEqual([
      'nsw_government_contributions_to_operations',
      'nsw_government_subsidies',
      'other_government_grants',
    ]);
  });
});
