import {
  MAITLAND_GPFS_FISCAL_YEAR,
  MAITLAND_GPFS_REPORTING_URL,
  parseMaitlandGpfsExtraction,
  type MaitlandGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../pdf-extract.js';

// Exact positioned text items from the archived FY2024-25 Income Statement
// (printed/PDF page 4, extraction page 5). The Original unaudited budget column
// precedes each label and the Actual 2025 / Actual 2024 columns follow it, so a
// parser that trusted plain-text order would read the budget. Two subtotal
// labels wrap over two visual rows and the depreciation label is emitted after
// its amounts in the plain-text stream; the connector reads positioned items.
const INCOME_TEXT = `Maitland City Council Income Statement For the year ended 30 June 2025 Original unaudited budget Actual Actual 2025 2025 2024 $'000 Notes $'000 $'000 Income from continuing operations 113,721 Rates and annual charges B2-1 114,151 107,192 10,086 User charges and fees B2-2 13,051 11,986 2,689 Other revenues 2,262 5,316 12,536 Grants and contributions provided for operating purposes B2-3 11,156 18,022 42,191 Grants and contributions provided for capital purposes B2-3 64,582 77,506 8,844 Interest and investment income 12,386 11,587 1,243 Other Income 1,429 1,301 191,310 Total income from continuing operations 219,016 232,910 Expenses from continuing operations 62,320 Employee benefits and on-costs B3-1 64,466 61,626 49,080 Materials and Services B3-2 57,227 73,035 2,527 Borrowing costs 3,710 2,521 10,045 Other expenses 11,477 10,385 - Net loss from the disposal of assets 288 786 123,972 137,168 148,353 67,338 81,849 84,557 31,952 B3-3 32,828 31,097 35,386 Operating result from continuing operations 49,021 53,461 35,386 Net operating result for the year attributable to Council 49,021 53,461 Net operating result for the year before grants and (6,805) contributions provided for capital purposes (15,562) (24,046) The above Income statement should be read in conjunction with the accompanying notes. Total expenses from continuing operations excluding depreciation and amortisation Operating result from continuing operations excluding depreciation and amortisation Depreciation, amortisation and impairment of non-financial assets Page 4`;

const FUNCTIONS_TEXT = `Maitland City Council Notes to the financial statements 30 June 2025 B. Financial Performance B1. Functions or activities B1-1 Functions or activities - income, expenses and assets Income, expenses and assets have been directly attributed to the following functions or activities. Income Expenses Operating results Grants and Contributions Carrying Amount of Assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions / Activities $'000 $'000 $'000 $'000 $'000 $'000 $'000 $'000 $'000 $'000 Liveable Maitland 57,009 65,741 72,832 64,906 (15,823) 836 62,318 77,486 452,587 407,532 Sustainable Maitland 26,512 25,150 32,839 50,306 (6,327) (25,157) 581 818 12,780 15,360 Vibrant Maitland 8,425 7,999 18,923 23,861 (10,498) (15,863) 5,629 8,276 1,516,950 1,416,057 Achieving Together 127,070 134,021 45,402 40,375 81,668 93,645 7,210 8,949 425,400 452,518 Net operating result for the year 219,016 232,910 169,995 179,449 49,021 53,461 75,739 95,528 2,407,717 2,291,467 Grants and Contributions Page 12`;

const COMPREHENSIVE_TEXT = `Maitland City Council Statement of Comprehensive Income for the year ended 30 June 2025 2025 2024 Notes $'000 $'000 Net operating result for the year - from income statement 49,021 53,461 Other comprehensive income Amounts which will not be reclassified subsequently to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 64,936 113,267 Total other comprehensive income for the year 64,936 113,267 Total comprehensive income for the year attributable to Council 113,957 166,728 Page 5`;

const DEPRECIATION_TEXT = `Maitland City Council 2025 2024 Note $'000 $'000 Intangibles - Software 62 70 Plant and equipment C1-5 2,634 2,194 Office equipment C1-5 117 125 Furniture and fittings C1-5 116 115 Infrastructure C1-5 28,038 26,812 Other assets C1-5 179 183 Tip asset C1-5 1,087 1,087 Right of use assets 595 511 Total depreciation and amortisation costs 32,828 31,097 Notes to the financial statements 30 June 2025 B3-3 Depreciation and amortisation Page 20`;

interface IncomeRow {
  y: number;
  label?: string;
  note?: string;
  budget?: number | null;
  a25?: number | null;
  a24?: number | null;
  labelOnly?: boolean;
  amountOnly?: boolean;
}

const INCOME_ROWS: IncomeRow[] = [
  {
    y: 647,
    label: 'Rates and annual charges',
    note: 'B2-1',
    budget: 113721,
    a25: 114151,
    a24: 107192,
  },
  { y: 637, label: 'User charges and fees', note: 'B2-2', budget: 10086, a25: 13051, a24: 11986 },
  { y: 626, label: 'Other revenues', budget: 2689, a25: 2262, a24: 5316 },
  {
    y: 616,
    label: 'Grants and contributions provided for operating purposes',
    note: 'B2-3',
    budget: 12536,
    a25: 11156,
    a24: 18022,
  },
  {
    y: 605,
    label: 'Grants and contributions provided for capital purposes',
    note: 'B2-3',
    budget: 42191,
    a25: 64582,
    a24: 77506,
  },
  { y: 595, label: 'Interest and investment income', budget: 8844, a25: 12386, a24: 11587 },
  { y: 584, label: 'Other Income', budget: 1243, a25: 1429, a24: 1301 },
  {
    y: 563,
    label: 'Total income from continuing operations',
    budget: 191310,
    a25: 219016,
    a24: 232910,
  },
  {
    y: 531,
    label: 'Employee benefits and on-costs',
    note: 'B3-1',
    budget: 62320,
    a25: 64466,
    a24: 61626,
  },
  { y: 521, label: 'Materials and Services', note: 'B3-2', budget: 49080, a25: 57227, a24: 73035 },
  { y: 510, label: 'Borrowing costs', budget: 2527, a25: 3710, a24: 2521 },
  { y: 500, label: 'Other expenses', budget: 10045, a25: 11477, a24: 10385 },
  { y: 489, label: 'Net loss from the disposal of assets', budget: null, a25: 288, a24: 786 },
  // Printed subtotal: label and amounts sit on separate baselines.
  {
    y: 469,
    label: 'Total expenses from continuing operations excluding depreciation',
    labelOnly: true,
  },
  { y: 467, budget: 123972, a25: 137168, a24: 148353, amountOnly: true },
  { y: 458, label: 'and amortisation', labelOnly: true },
  // Printed operating result excluding depreciation (not emitted, layout only).
  { y: 438, label: 'Operating result from continuing operations excluding', labelOnly: true },
  { y: 436, budget: 67338, a25: 81849, a24: 84557, amountOnly: true },
  { y: 427, label: 'depreciation and amortisation', labelOnly: true },
  {
    y: 395,
    label: 'Depreciation, amortisation and impairment of non-financial assets',
    note: 'B3-3',
    budget: 31952,
    a25: 32828,
    a24: 31097,
  },
  {
    y: 363,
    label: 'Operating result from continuing operations',
    budget: 35386,
    a25: 49021,
    a24: 53461,
  },
  {
    y: 342,
    label: 'Net operating result for the year attributable to Council',
    budget: 35386,
    a25: 49021,
    a24: 53461,
  },
  // Printed before-capital result: label wraps and amounts sit one row below.
  { y: 309, label: 'Net operating result for the year before grants and', labelOnly: true },
  {
    y: 299,
    label: 'contributions provided for capital purposes',
    budget: -6805,
    a25: -15562,
    a24: -24046,
  },
];

function money(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US');
  return n < 0 ? `(${abs})` : abs;
}

function item(str: string, x: number, y: number, pageNumber: number): PdfTextItem {
  return { page_number: pageNumber, str, x, y, width: 0, height: 0 };
}

function incomePage(): PdfPage {
  const items: PdfTextItem[] = [];
  for (const row of INCOME_ROWS) {
    if (!row.labelOnly) {
      if (row.budget !== undefined && row.budget !== null)
        items.push(item(money(row.budget), 104, row.y, 5));
      if (row.a25 !== undefined && row.a25 !== null)
        items.push(item(money(row.a25), 444, row.y, 5));
      if (row.a24 !== undefined && row.a24 !== null)
        items.push(item(money(row.a24), 496, row.y, 5));
    }
    if (row.label) items.push(item(row.label, 151, row.y, 5));
    if (row.note) items.push(item(row.note, 406, row.y, 5));
    if (row.amountOnly) {
      if (row.budget !== undefined && row.budget !== null)
        items.push(item(money(row.budget), 104, row.y, 5));
      if (row.a25 !== undefined && row.a25 !== null)
        items.push(item(money(row.a25), 444, row.y, 5));
      if (row.a24 !== undefined && row.a24 !== null)
        items.push(item(money(row.a24), 496, row.y, 5));
    }
  }
  items.push(item("Original unaudited budget Actual 2025 $'000 Notes $'000 $'000", 55, 721, 5));
  return { page_number: 5, text: INCOME_TEXT, items };
}

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: PdfPage; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'bc67c592a9cb0bade12b62e88457b3f67dad434442ec3bc59b15ea7c8aafbda8',
      bytes: 1_196_382,
    },
    pages: [
      overrides.income ?? incomePage(),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 13),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 6),
      textPage(DEPRECIATION_TEXT, 20),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.maitland.nsw.gov.au/sites/default/files/documents/2025-11/Financial%20Statements%202024-25%20Final.pdf';

const CONTEXT: MaitlandGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'General Purpose Financial Report 2024-25',
    url: PDF_URL,
    fiscal_year: MAITLAND_GPFS_FISCAL_YEAR,
    listing_url: MAITLAND_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: '/tmp/ausspend-source-archive/maitland-gpfs/Financial-Statements-2024-25-Final.pdf',
    sha256: 'bc67c592a9cb0bade12b62e88457b3f67dad434442ec3bc59b15ea7c8aafbda8',
    bytes: 1_196_382,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: MAITLAND_GPFS_REPORTING_URL,
};

/** Golden fixture for the maitland-gpfs module migration: 7 rows, unchanged keys/amounts. */
export const MAITLAND_GPFS_ROW_COUNT = 7;
export const MAITLAND_GPFS_GOLDEN_DIGEST =
  '4a7744f8c518aa77a20c19db2925310491782c3b295e7e124db1506e7de76505';
export const ROW_COUNT = 7;
export const GOLDEN_DIGEST = '4a7744f8c518aa77a20c19db2925310491782c3b295e7e124db1506e7de76505';

export function goldenRecords() {
  const parsed = parseMaitlandGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
