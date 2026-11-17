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

const NOTE_LEFT_RIGHTS = [400, 457, 514, 571];
const NOTE_RIGHT_RIGHTS = [940, 997, 1054, 1111];

interface NoteFixtureRow {
  label?: string;
  values?: Array<number | null>;
}

function addNoteTable(
  items: PdfTextItem[],
  pageNumber: number,
  side: 'left' | 'right',
  yStart: number,
  noteNumber: string,
  title: string,
  rows: NoteFixtureRow[],
  total: number,
): void {
  const labelX = side === 'left' ? 62 : 620;
  const numberX = side === 'left' ? 60 : 617;
  const rights = side === 'left' ? NOTE_LEFT_RIGHTS : NOTE_RIGHT_RIGHTS;
  items.push(item(noteNumber, numberX, yStart, pageNumber, 6));
  items.push(item(title, labelX + 26, yStart, pageNumber));
  items.push(item('Consolidated', rights[0]! - 30, yStart - 12, pageNumber));
  items.push(item('Parent', rights[2]! - 12, yStart - 12, pageNumber));
  [2025, 2024, 2025, 2024].forEach((year, index) =>
    items.push(item(String(year), rights[index]! - 20, yStart - 24, pageNumber)),
  );
  rights.forEach((right) => items.push(item('$’000', right - 25, yStart - 36, pageNumber)));
  let y = yStart - 50;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, labelX, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      if (value === null) return;
      const text =
        value < 0 ? `(${Math.abs(value).toLocaleString('en-AU')})` : value.toLocaleString('en-AU');
      items.push(money(text, rights[index]!, y, pageNumber));
    });
    y -= 15;
  }
  [total, total, total, total].forEach((value, index) =>
    items.push(money(value.toLocaleString('en-AU'), rights[index]!, y, pageNumber)),
  );
}

function note2Page(): PdfPage {
  const pageNumber = 63;
  const items: PdfTextItem[] = [];
  addNoteTable(
    items,
    pageNumber,
    'left',
    340,
    '2',
    'Revenue from water supply and delivery',
    [
      { label: 'Regulated – Greater Sydney', values: [224_540, 222_978, 224_540, 222_978] },
      { label: 'Regulated – Rural', values: [96_158, 98_199, 96_158, 98_199] },
      { label: 'Regulated – Broken Hill Pipeline', values: [24_204, 23_452, null, null] },
      { label: 'Regulated - WAMC', values: [25_304, 22_594, 25_304, 22_594] },
      { label: 'Other', values: [9_514, 9_267, 9_514, 9_267] },
    ],
    379_720,
  );
  return {
    page_number: pageNumber,
    text: '2 Revenue from water supply and delivery Regulated – Greater Sydney Regulated – Rural Regulated – Broken Hill Pipeline Regulated - WAMC Other',
    items,
  };
}

function notes456Page(options: { landTaxOverride?: number } = {}): PdfPage {
  const pageNumber = 65;
  const items: PdfTextItem[] = [];
  addNoteTable(
    items,
    pageNumber,
    'left',
    780,
    '4',
    'Other revenue',
    [
      {
        label: 'Murray-Darling Basin Authority (MDBA) and other utilities',
        values: [12_820, 15_930, 12_820, 15_930],
      },
      { label: 'Operating leases', values: [1_401, 1_379, 1_401, 1_379] },
      { label: 'Interest', values: [639, 901, 623, 882] },
      { label: 'Ancillary services', values: [4_199, 2_892, 4_199, 2_892] },
      { label: 'Miscellaneous revenue', values: [4_624, 8_704, 4_624, 8_679] },
      { label: 'External engagements', values: [14_750, 8_942, 14_750, 8_942] },
      { label: 'Insurance recoveries', values: [11_515, 15_228, 11_515, 15_228] },
    ],
    49_948,
  );
  addNoteTable(
    items,
    pageNumber,
    'right',
    675,
    '5',
    'Employee related expenses',
    [
      { label: 'Employee related expenses (excluding post employee' },
      { values: [186_924, 166_077, 186_924, 166_077] },
      {
        label: 'Capitalisation of employee related expenses',
        values: [-43_838, -42_334, -43_838, -42_334],
      },
      {
        label: 'Superannuation – Defined benefit plans',
        values: [2_827, 3_170, 2_827, 3_170],
      },
      {
        label: 'Superannuation – Defined contribution plans',
        values: [17_741, 14_674, 17_741, 14_674],
      },
    ],
    163_654,
  );
  addNoteTable(
    items,
    pageNumber,
    'right',
    470,
    '6',
    'Other operating expenses',
    [
      { label: 'Contractors', values: [26_927, 32_826, 26_884, 32_656] },
      { label: 'Electricity and other energy', values: [3_535, 2_971, 3_535, 2_971] },
      { label: 'Data management', values: [21_943, 21_163, 21_943, 21_163] },
      { label: 'Materials, plant and equipment', values: [5_490, 5_819, 5_490, 5_816] },
      { label: 'Property', values: [6_753, 7_012, 6_752, 7_012] },
      { label: 'Transport and travel', values: [7_391, 6_412, 7_383, 6_409] },
      { label: 'Insurance premiums', values: [6_762, 6_470, 6_625, 6_335] },
      { label: 'Other expenses from ordinary activities', values: [7_457, 3_910, 7_424, 3_866] },
      {
        label: 'Construction/installation for third parties',
        values: [1_074, 4_353, 1_074, 4_353],
      },
      {
        label: 'Operation and maintenance contract Broken Hill Pipeline',
        values: [3_638, 3_257, null, null],
      },
      { label: 'Consultants', values: [484, 214, 484, 214] },
      { label: 'Water monitoring', values: [5_073, 7_000, 5_073, 7_000] },
      { label: 'Land management', values: [7_579, 10_303, 7_579, 10_303] },
      { label: 'Land Tax', values: [options.landTaxOverride ?? 9_242, 7_885, 9_242, 7_885] },
    ],
    113_348,
  );
  return {
    page_number: pageNumber,
    text: '4 Other revenue Murray-Darling Basin Authority (MDBA) and other utilities Operating leases Interest Ancillary services Miscellaneous revenue External engagements Insurance recoveries 5 Employee related expenses Capitalisation of employee related expenses Superannuation – Defined benefit plans Superannuation – Defined contribution plans 6 Other operating expenses Operation and maintenance contract Broken Hill Pipeline Land Tax',
    items,
  };
}

function notes78Page(): PdfPage {
  const pageNumber = 66;
  const items: PdfTextItem[] = [];
  addNoteTable(
    items,
    pageNumber,
    'left',
    590,
    '7',
    'Depreciation and amortisation',
    [
      { label: 'Depreciation', values: [100_461, 97_579, 94_778, 92_119] },
      { label: 'Amortisation', values: [4_818, 5_602, 4_771, 5_555] },
      { label: 'Depreciation – right of use assets', values: [2_251, 2_237, 2_251, 2_237] },
    ],
    107_530,
  );
  addNoteTable(
    items,
    pageNumber,
    'right',
    710,
    '8',
    'Finance costs',
    [
      { label: 'Interest expense on loans', values: [66_265, 42_251, 56_243, 33_872] },
      { label: 'Other borrowing costs', values: [388, 635, 388, 635] },
      { label: 'Government Guarantee Fee', values: [24_567, 26_534, 20_523, 22_344] },
      { label: 'Borrowing costs capitalised', values: [-3_660, -2_717, -3_660, -2_717] },
      { label: 'Interest expense on leases', values: [739, 785, 739, 785] },
    ],
    88_299,
  );
  return {
    page_number: pageNumber,
    text: '7 Depreciation and amortisation Depreciation – right of use assets Amortisation 8 Finance costs Borrowing costs capitalised Government Guarantee Fee',
    items,
  };
}

function cashFlowPage(): PdfPage {
  const pageNumber = 61;
  const rights = NOTE_LEFT_RIGHTS;
  const items: PdfTextItem[] = [
    item('Statements of cash flows', 62, 760, pageNumber),
    item('Consolidated', rights[0]! - 30, 730, pageNumber),
    item('Parent', rights[2]! - 12, 730, pageNumber),
    item('2025', rights[0]! - 20, 716, pageNumber),
    item('2024', rights[1]! - 20, 716, pageNumber),
    item('2025', rights[2]! - 20, 716, pageNumber),
    item('2024', rights[3]! - 20, 716, pageNumber),
  ];
  rights.forEach((right) => items.push(item('$’000', right - 25, 704, pageNumber)));
  items.push(item('Payments for property, plant and equipment and', 65, 478, pageNumber));
  items.push(item('intangibles', 65, 466, pageNumber));
  [-170_828, -208_045, -170_610, -207_853].forEach((value, index) =>
    items.push(
      money(`(${Math.abs(value).toLocaleString('en-AU')})`, rights[index]!, 466, pageNumber),
    ),
  );
  items.push(item('Proceeds from disposal of property, plant and', 65, 449, pageNumber));
  items.push(item('equipment', 65, 437, pageNumber));
  [3_267, 1_267, 3_267, 1_267].forEach((value, index) =>
    items.push(money(value.toLocaleString('en-AU'), rights[index]!, 437, pageNumber)),
  );
  items.push(item('Net cash used in investing activities', 65, 420, pageNumber));
  [-167_561, -206_778, -167_343, -206_586].forEach((value, index) =>
    items.push(
      money(`(${Math.abs(value).toLocaleString('en-AU')})`, rights[index]!, 420, pageNumber),
    ),
  );
  return {
    page_number: pageNumber,
    text: 'Statements of cash flows Payments for property, plant and equipment and intangibles Net cash used in investing activities',
    items,
  };
}

function extraction(
  options: {
    statement?: Parameters<typeof statementPage>[0];
    grants?: Parameters<typeof grantsPage>[0];
    notes456?: Parameters<typeof notes456Page>[0];
  } = {},
): PdfExtraction {
  return {
    source: { url: URL_2025, sha256: 'b'.repeat(64), bytes: 42_917_371 },
    pages: [
      statementPage(options.statement),
      grantsPage(options.grants),
      note2Page(),
      notes456Page(options.notes456),
      notes78Page(),
      cashFlowPage(),
    ],
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
    expect(result.records).toHaveLength(47);
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

describe('WaterNSW note-level deep detail', () => {
  it('parses every printed note table and reconciles each to its printed subtotal', () => {
    const result = parseWaterNswExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.note_tables).toHaveLength(6);
    expect(result.note_tables?.every((table) => table.errors.length === 0)).toBe(true);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'Note 2 Revenue from water supply and delivery components exact: 224540 + 96158 + 24204 + 25304 + 9514 = 379720',
    );
    expect(checks).toContain(
      'Note 4 Other revenue components exact: 12820 + 1401 + 639 + 4199 + 4624 + 14750 + 11515 = 49948',
    );
    expect(checks).toContain(
      'Note 5 Employee related expenses components exact: 186924 + -43838 + 2827 + 17741 = 163654',
    );
    expect(checks).toContain('Note 6 Other operating expenses components exact:');
    expect(checks).toContain('= 113348');
    expect(checks).toContain('Note 7 Depreciation and amortisation components exact:');
    expect(checks).toContain('= 107530');
    expect(checks).toContain(
      'Note 8 Finance costs components exact: 66265 + 388 + 24567 + -3660 + 739 = 88299',
    );
    expect(checks).toContain('cash-flow investing bridge exact: -170828 + 3267 = -167561');
  });

  it('adds 39 breakdown rows beyond the 8 face rows, with a stable unique key and cents', () => {
    const result = parseWaterNswExtraction(extraction(), context);
    expect(result.records).toHaveLength(47);
    const lineItems = result.records.map((record) => record.soc_line_item);
    expect(new Set(lineItems).size).toBe(47);
    const naturalKeys = result.records.map((record) => record.natural_key);
    expect(new Set(naturalKeys).size).toBe(47);
    expect(recordFor(result, 'water_supply_regulated_greater_sydney')).toMatchObject({
      amount_cents: 22_454_000_000,
      soc_section: 'revenue',
      soc_note: 'Note 2 Revenue from water supply and delivery',
      soc_component_of: 'revenue_from_water_supply_and_delivery',
      soc_breakdown: 'water_supply_segment',
      soc_printed_sign: 'positive',
      aggregation_role: 'agency_detail',
    });
    // A printed deduction keeps its sign in metadata while the stored cents stay non-negative.
    expect(recordFor(result, 'employee_expenses_capitalisation')).toMatchObject({
      amount_cents: 4_383_800_000,
      soc_printed_sign: 'negative',
      soc_component_of: 'employee_expenses',
    });
    expect(recordFor(result, 'finance_costs_borrowing_costs_capitalised')).toMatchObject({
      amount_cents: 366_000_000,
      soc_printed_sign: 'negative',
    });
    expect(recordFor(result, 'other_operating_land_tax')?.amount_cents).toBe(924_200_000);
    expect(recordFor(result, 'capital_expenditure_cash')).toMatchObject({
      amount_cents: 17_082_800_000,
      soc_section: 'capital',
      soc_printed_sign: 'negative',
      soc_note: 'Statement of cash flows — investing activities',
    });
  });

  it('keeps every note component non-additive and never duplicates a face row', () => {
    const result = parseWaterNswExtraction(extraction(), context);
    const noteRows = result.records.filter(
      (record) => record.soc_note !== undefined && record.soc_note !== 'Face statement',
    );
    expect(noteRows).toHaveLength(42); // 38 note lines + 3 Note 3 grants + 1 capex
    for (const record of noteRows) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
      if (record.soc_note?.startsWith('Note ')) {
        expect(record.soc_component_of).toBeTruthy();
      }
    }
    // The cash-flow capital row is a standalone investing outflow, not a note component.
    expect(recordFor(result, 'capital_expenditure_cash')?.soc_component_of).toBeUndefined();
    // Note components sum to their printed subtotal, but are not the same row as the total.
    const note5 = result.records
      .filter((record) => record.soc_component_of === 'employee_expenses')
      .reduce(
        (sum, record) =>
          sum +
          (record.soc_printed_sign === 'negative' ? -record.amount_cents : record.amount_cents),
        0,
      );
    expect(note5).toBe(recordFor(result, 'employee_expenses')?.amount_cents);
    expect(recordFor(result, 'employee_expenses')?.soc_component_of).toBeUndefined();
    // The capital row is not an expense and is never folded into Total expenses.
    expect(recordFor(result, 'capital_expenditure_cash')?.amount_cents).not.toBe(
      recordFor(result, 'total_expenses')?.amount_cents,
    );
  });

  it('defers when one note component breaks the printed subtotal by one unit', () => {
    const result = parseWaterNswExtraction(
      extraction({ notes456: { landTaxOverride: 9_243 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 6 Other operating expenses/);
  });

  it('defers when a note table has no explicit $’000 unit rather than guessing dollars', () => {
    const base = extraction();
    const pages = base.pages.map((page) =>
      page.page_number === 63
        ? { ...page, items: page.items.filter((entry) => !entry.str.includes('$’000')) }
        : page,
    );
    const result = parseWaterNswExtraction({ ...base, pages }, context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
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
