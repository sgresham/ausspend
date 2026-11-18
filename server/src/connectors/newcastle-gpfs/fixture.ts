import {
  NEWCASTLE_GPFS_FISCAL_YEAR,
  NEWCASTLE_GPFS_REPORTING_URL,
  parseNewcastleGpfsExtraction,
  type NewcastleGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 5, 6 and 16;
// PDF pages 6, 7 and 17). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after it.
// A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. Both the net result and the printed
// before-capital result are positive.
const INCOME_TEXT = `Newcastle City Council | Income Statement | for the year ended 30 June 2025 §Statement§  Original unaudited budget   Actual  Restated Actual  2025   2025   2024  $ '000   Notes   $ '000   $ '000  Income from continuing operations  232,264   Rates and annual charges   B2-1   232,754   219,124 124,293   User charges and fees   *   B2-2   108,535   111,375 11,501   Other revenue   B2-3   13,123   12,066 24,075   Grants and contributions provided for operating purposes   B2-4   21,222   20,713 43,782   Grants and contributions provided for capital purposes   B2-4   89,603   46,379 14,517   Interest and investment income   B2-5   21,817   16,278 13,306   Other income   *   B2-6   10,648   13,256  463,738   Total income from continuing operations   497,702   439,191  Expenses from continuing operations  146,514   Employee benefits and on-costs   B3-1   149,707   136,777 122,371   Materials and services   ^   B3-2   109,702   112,333 5,410   Borrowing costs   B3-3   6,012   5,455 58,728   Other expenses   B3-5   49,868   53,875 9,697   Net loss from the disposal of assets   ^   B4-1   12,132   12,404  342,720  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   327,421   320,844 121,018  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   170,281   118,347  73,173 Depreciation, amortisation and impairment of non-financial assets   ^   B3-4   71,942   68,390  47,845   Operating result from continuing operations   98,339   49,957  47,845   Net operating result for the year attributable to Council   98,339   49,957  4,063  Net operating result for the year before grants and contributions provided for capital purposes   8,736   3,578  The above Income Statement should be read in conjunction with the accompanying notes.  (*)   Comparatives have been reclassified. Refer Note A1-1  (^)   Comparatives have been changed to reflect prior period adjustments. Refer Note G4-1  Newcastle City Council Income Statement  for the year ended 30 June 2025 Page 5`;

const COMPREHENSIVE_TEXT = `Newcastle City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ §Subnote§ Restated 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 98,339 49,957 Other comprehensive income: Amounts that will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-7 1,002,099 83,477 Impairment reversal (loss) on infrastructure, property, plant and equipment B3-4,C1-7 885 49 Total items that will not be reclassified subsequent to operating result 1,002,984 83,526 Amounts that will be reclassified subsequent to operating result when specific conditions are met Gain/(loss) on hedging instruments C1-11 (1,482) (122) Other movements – (1) Total items that will be reclassified subsequent to operating result when specific conditions are met (1,482) (123) Other comprehensive income for the year 1,001,502 83,403 Total comprehensive income for the year attributable to Council 1,099,841 133,360 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Newcastle City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating results Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Restated Restated Restated $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Liveable 115,564 54,661 136,872 130,943 (21,308) (76,282) 81,364 23,320 2,540,837 1,433,394 Sustainable 95,117 100,865 102,087 103,155 (6,970) (2,290) 421 3,396 85,755 94,917 Creative 63,707 69,937 79,192 73,950 (15,485) (4,013) 19,810 28,441 525,550 483,721 Achieving Together 223,314 213,728 81,212 81,186 142,102 132,542 9,230 11,935 782,693 743,907 Total functions and activities 497,702 439,191 399,363 389,234 98,339 49,957 110,825 67,092 3,934,835 2,755,939 Page 16 Newcastle City Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'e'.repeat(64), bytes: 7_343_281 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 15),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 16),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 24),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://newcastle.nsw.gov.au/getmedia/4bba4207-e815-43df-a8db-c09f6f94fc7e/Newcastle-City-Council-Financial-Statements-2024-25.pdf';

const CONTEXT: NewcastleGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: '2024/2025 Financial Statements (PDF, 3.4 MB)',
    url: PDF_URL,
    fiscal_year: NEWCASTLE_GPFS_FISCAL_YEAR,
    listing_url: NEWCASTLE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/newcastle-gpfs/Newcastle-City-Council-Financial-Statements-2024-25.pdf',
    sha256: 'ed415f31b8b57358ce2f3be2dbbd8193edab74fc3be4b6df3cf3e3d4b80a24cc',
    bytes: 3_484_233,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: NEWCASTLE_GPFS_REPORTING_URL,
};

/** Golden fixture for the newcastle-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const NEWCASTLE_GPFS_ROW_COUNT = 17;
export const NEWCASTLE_GPFS_GOLDEN_DIGEST =
  'd66b53c3e23958ae2658aefa5e140fa4218dc1f27941fd63ed23719682ac26ed';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'd66b53c3e23958ae2658aefa5e140fa4218dc1f27941fd63ed23719682ac26ed';

export function goldenRecords() {
  const parsed = parseNewcastleGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
