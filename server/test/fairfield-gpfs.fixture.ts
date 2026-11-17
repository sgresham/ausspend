import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';

/**
 * Text-item fixtures reconstructed from the audited Fairfield City Council
 * FY2024-25 General Purpose Financial Statements PDF (Income Statement PDF p6 /
 * printed p4; Statement of Comprehensive Income PDF p7 / printed p5; B1-1
 * "Total functions and activities" PDF p19 / printed p17; note B3-3 PDF p32 /
 * printed p30; Report on the Conduct of the Audit PDF p77 / printed p75).
 *
 * The real PDF groups all row labels before all amounts in its text stream, so
 * the adapter parses printed rows by text-item coordinates. These fixtures keep
 * that layout (label x=122, budget x=81, actual 2025 x=438, actual 2024 x=507)
 * so the parser is tested against the printed table shape, not a hand-built
 * object.
 */

export const FAIRFIELD_PDF_URL =
  'https://www.fairfieldcity.nsw.gov.au/files/assets/public/v/1/documents/your-council/ipr/annual-report/2024-2025-annual-report-audited-financial-statements.pdf';
export const FAIRFIELD_PDF_SHA256 =
  '0a864880b393e03b7888d2e9d0bffb62e852682d0d291553a54e0f4e67fe75c5';
export const FAIRFIELD_PDF_BYTES = 17_656_220;

function item(x: number, y: number, str: string): PdfTextItem {
  return { page_number: 0, str, x, y, width: Math.max(str.length * 4, 1), height: 8 };
}

function page(pageNumber: number, items: PdfTextItem[]): PdfPage {
  return {
    page_number: pageNumber,
    text: items.map((entry) => entry.str).join(' '),
    items: items.map((entry) => ({ ...entry, page_number: pageNumber })),
  };
}

interface RowDef {
  labels: string[];
  budget?: string;
  actual?: string;
  prior?: string;
  note?: string;
}

interface IncomeOverrides {
  actual?: Record<string, string>;
}

function buildRows(rows: readonly RowDef[], overrides: IncomeOverrides = {}): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  let y = 700;
  for (const row of rows) {
    for (let index = 0; index < row.labels.length; index += 1) {
      items.push(item(122, y, row.labels[index]!));
      if (index === row.labels.length - 1) {
        if (row.note) items.push(item(372, y, row.note));
        if (row.budget !== undefined) items.push(item(81, y, row.budget));
        if (row.actual !== undefined) {
          const override =
            overrides.actual?.[row.labels[0]!] ??
            overrides.actual?.[row.labels[row.labels.length - 1]!];
          items.push(item(438, y, override ?? row.actual));
        }
        if (row.prior !== undefined) items.push(item(507, y, row.prior));
      }
      y -= 11;
    }
  }
  return items;
}

const INCOME_ROWS: RowDef[] = [
  {
    labels: ['Rates and annual charges'],
    budget: '132,712',
    actual: '133,578',
    prior: '128,688',
    note: 'B2-1',
  },
  {
    labels: ['User charges and fees'],
    budget: '24,559',
    actual: '20,047',
    prior: '19,768',
    note: 'B2-2',
  },
  { labels: ['Other revenues'], budget: '17,586', actual: '14,064', prior: '12,486' },
  {
    labels: ['Grants and contributions provided for operating purposes'],
    budget: '22,447',
    actual: '24,944',
    prior: '26,373',
    note: 'B2-3',
  },
  {
    labels: ['Grants and contributions provided for capital purposes'],
    budget: '40,680',
    actual: '58,649',
    prior: '37,351',
    note: 'B2-3',
  },
  { labels: ['Interest and investment income'], budget: '5,808', actual: '8,911', prior: '8,792' },
  { labels: ['Other income'], budget: '8,904', actual: '9,157', prior: '11,031' },
  {
    labels: ['Net gain from the disposal of assets'],
    budget: '425',
    actual: '609',
    prior: '1,327',
  },
  {
    labels: ['Total income from continuing operations'],
    budget: '253,121',
    actual: '269,959',
    prior: '245,816',
  },
  {
    labels: ['Employee benefits and on-costs'],
    budget: '93,637',
    actual: '93,091',
    prior: '85,374',
    note: 'B3-1',
  },
  {
    labels: ['Materials and services'],
    budget: '51,463',
    actual: '49,161',
    prior: '51.265',
    note: 'B3-2',
  },
  { labels: ['Borrowing costs'], budget: '228', actual: '166', prior: '183' },
  { labels: ['Other expenses'], budget: '25,906', actual: '27,073', prior: '24,483', note: 'B3-4' },
  {
    labels: [
      'Total expenses from continuing operations excluding',
      'depreciation, amortisation and impairment of non-financial',
      'assets',
    ],
    budget: '171,234',
    actual: '169,491',
    prior: '161,305',
  },
  {
    labels: [
      'Operating result from continuing operations excluding',
      'depreciation, amortisation and impairment of non>financial',
      'assets',
    ],
    budget: '81,887',
    actual: '100,468',
    prior: '84,511',
  },
  {
    labels: ['Depreciation, amortisation and impairment of non financial', 'assets'],
    budget: '41,104',
    actual: '38,287',
    prior: '36,555',
    note: 'B3-3',
  },
  {
    labels: ['Operating result from continuing operations'],
    budget: '40,783',
    actual: '62,181',
    prior: '47,956',
  },
  {
    labels: ['Net operating result for the year attributable to Council'],
    budget: '40,783',
    actual: '62,181',
    prior: '47,956',
  },
  {
    labels: [
      'Net operating result for the year before grants and contributions',
      'provided for capital purposes',
    ],
    budget: '103',
    actual: '3,532',
    prior: '10,605',
  },
];

export function fairfieldIncomePage(overrides: IncomeOverrides = {}): PdfPage {
  const items: PdfTextItem[] = [
    item(355, 798, 'Income Statement'),
    item(66, 715, 'Original'),
    item(439, 694, 'Actual'),
    item(509, 694, 'Actual'),
    item(121, 684, '$'),
    item(128, 684, "'000"),
    item(446, 682, '2025'),
    item(514, 682, '2024'),
    ...buildRows(INCOME_ROWS, overrides),
    item(495, 33, 'Page 4 of 72'),
  ];
  return page(6, items);
}

const COMPREHENSIVE_ROWS: RowDef[] = [
  {
    labels: ['Net operating result for the year', '-from Income Statement'],
    actual: '62,181',
    prior: '47,956',
  },
  {
    labels: ['Gain (loss)', 'on revaluation of infrastructure, property, plant and equipment'],
    actual: '(81,048)',
    prior: '174.841',
    note: 'C1-5',
  },
  { labels: ['Other comprehensive income for the year'], actual: '(81,048)', prior: '174,841' },
  {
    labels: ['Total comprehensive income for the year attributable to Council'],
    actual: '(18,867)',
    prior: '222,797',
  },
];

export function fairfieldComprehensivePage(overrides: IncomeOverrides = {}): PdfPage {
  const items: PdfTextItem[] = [
    item(292, 797, 'Statement of Comprehensive Income'),
    item(56, 712, '$’000'),
    item(448, 715, '2025'),
    item(517, 715, '2024'),
    ...buildRows(COMPREHENSIVE_ROWS, overrides),
    item(494, 32, 'Page 5 of 72'),
  ];
  return page(7, items);
}

interface FunctionsOverrides {
  income?: string;
  expenses?: string;
  operating_result?: string;
  grants?: string;
}

/**
 * B1-1 is a rotated table: the total row label and its ten amounts share an x
 * coordinate and the amounts run down the page. The real PDF prints
 * Income2025, Income2024, Expenses2025, Expenses2024, Operating2025,
 * Operating2024, Grants2025, Grants2024, Carrying2025, Carrying2024.
 */
export function fairfieldFunctionsPage(overrides: FunctionsOverrides = {}): PdfPage {
  const values = [
    overrides.income ?? '269,959',
    '245.816',
    overrides.expenses ?? '207,778',
    '197,860',
    overrides.operating_result ?? '62,181',
    '47,956',
    overrides.grants ?? '83,593',
    '63.724',
    '2,940,991',
    '2,962,021',
  ];
  const items: PdfTextItem[] = [
    item(328, 59, 'Total functions and activities'),
    item(82, 58, "$'000"),
    item(98, 245, 'Income'),
    item(98, 358, 'Expenses'),
    item(98, 463, 'Operating result'),
    item(98, 563, 'Grants and co'),
    item(98, 678, 'Carrying amount of assets'),
    item(300, 58, 'Functions or activities'),
  ];
  let y = 224;
  for (const value of values) {
    items.push(item(331, y, value));
    y += 54;
  }
  return page(19, items);
}

interface DepreciationOverrides {
  total?: string;
}

export function fairfieldDepreciationPage(overrides: DepreciationOverrides = {}): PdfPage {
  const items: PdfTextItem[] = [
    item(93, 776, 'Depreciation, amortisation and impairment of non-financial assets'),
    item(52, 753, '$•000'),
    item(440, 751, '2025'),
    item(513, 751, '2024'),
    item(53, 547, 'Total depreciation and amortisation costs'),
    item(430, 545, '38,287'),
    item(503, 544, '36,555'),
    item(53, 524, 'Total depreciation, amortisation and impairment for'),
    item(54, 511, 'non-financial assets'),
    item(424, 510, overrides.total ?? '38,287'),
    item(497, 510, '36,555'),
    item(490, 32, 'Page 30 of 72'),
  ];
  return page(32, items);
}

export function fairfieldConductReportPage(overrides: { totalExpenses?: string } = {}): PdfPage {
  const items: PdfTextItem[] = [
    item(57, 790, 'INCOME STATEMENT'),
    item(57, 775, 'Financial performance'),
    item(57, 760, 'Operating result from continuing operations'),
    item(300, 760, '62.2'),
    item(360, 760, '48.0'),
    item(
      57,
      730,
      "Council's grants and contributions revenue ($83.6 million) increased by $19.9 million.",
    ),
    item(
      57,
      715,
      'Council revenue excluding grants and contributions ($186.4 million) increased by $4.3 million.',
    ),
    item(
      57,
      700,
      'Depreciation, amortisation and impairment of non-financial assets expense ($38.3 million) increased by $1.7 million.',
    ),
    ...(overrides.totalExpenses
      ? [
          item(
            57,
            685,
            `Council's total expenses from continuing operations including depreciation, amortisation and impairment of non-financial assets (${overrides.totalExpenses} million).`,
          ),
        ]
      : []),
    item(495, 32, 'Page 75 of 81'),
  ];
  return page(77, items);
}

export interface FairfieldExtractionOverrides {
  income?: PdfPage;
  comprehensive?: PdfPage;
  functions?: PdfPage;
  depreciation?: PdfPage;
  conductReport?: PdfPage;
}

export function fairfieldExtraction(overrides: FairfieldExtractionOverrides = {}): PdfExtraction {
  return {
    source: { sha256: FAIRFIELD_PDF_SHA256, bytes: FAIRFIELD_PDF_BYTES },
    pages: [
      overrides.income ?? fairfieldIncomePage(),
      overrides.comprehensive ?? fairfieldComprehensivePage(),
      overrides.functions ?? fairfieldFunctionsPage(),
      overrides.depreciation ?? fairfieldDepreciationPage(),
      overrides.conductReport ?? fairfieldConductReportPage(),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}
