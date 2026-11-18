import {
  WOLLONGONG_GPFS_FISCAL_YEAR,
  WOLLONGONG_GPFS_REPORTING_URL,
  parseWollongongGpfsExtraction,
  type WollongongGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 4, 5 and 13;
// PDF pages 15, 16 and 24). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after it.
// A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. Both the net result and the printed
// before-capital result are negative.
const INCOME_TEXT = `Wollongong City Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 247,048 Rates and annual charges B2-1 247,516 231,847 39,990 User charges and fees B2-2 40,074 38,578 5,872 Other revenues B2-3 6,748 9,045 33,212 Grants and contributions provided for operating purposes B2-4 31,646 32,772 27,454 Grants and contributions provided for capital purposes B2-4 45,473 100,797 6,196 Interest and investment income B2-5 9,756 8,711 7,231 Other income B2-6 9,430 8,575 28,516 Net gain from the disposal of assets B4-1 – – 395,519 Total income from continuing operations 390,643 430,325 Expenses from continuing operations 142,404 Employee benefits and on-costs B3-1 153,272 140,458 99,866 Materials and services B3-2 110,545 122,542 557 Borrowing costs B3-3 1,144 747 24,257 Other expenses B3-5 31,548 29,446 – Net loss from the disposal of assets B4-1 6,276 10,120 267,084 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 302,785 303,313 128,435 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 87,858 127,012 87,113 Depreciation, amortisation and impairment of non-financial assets B3-4 98,096 86,023 41,322 Operating result from continuing operations (10,238) 40,989 41,322 Net operating result for the year attributable to Council (10,238) 40,989 13,868 Net operating result for the year before grants and contributions provided for capital purposes (55,711) (59,808) The above Income Statement should be read in conjunction with the accompanying notes. Wollongong City Council Income Statement for the year ended 30 June 2025 Page 4`;

const COMPREHENSIVE_TEXT = `Wollongong City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement (10,238) 40,989 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-8 98,777 320,912 Impairment (loss) relating to infrastructure, property, plant and equipment C1-8 – (598) Total items which will not be reclassified subsequent to operating result 98,777 320,314 Total other comprehensive income for the year 98,777 320,314 Total comprehensive income for the year attributable to Council 88,539 361,303 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Wollongong City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Goal 1 - We value and protect our environment 97,684 91,357 124,553 127,339 (26,869) (35,982) 28,624 25,337 1,127,728 1,002,545 Goal 2 - We have an innovative and sustainable economy 10,963 11,164 14,583 13,908 (3,620) (2,744) – 25 4,396 5,886 Goal 3 - Wollongong is a creative, vibrant city 759 1,066 12,743 12,124 (11,984) (11,058) 525 688 1,609 2,190 Goal 4 - We are a connected and engaged community 14,477 13,469 38,630 34,569 (24,153) (21,100) 6,631 6,519 860,369 859,612 Goal 5 - We have a healthy community in a liveable city 13,335 16,879 68,819 63,501 (55,484) (46,622) 2,166 7,370 723,962 786,886 Goal 6 - We have affordable and accessible transport 12,071 18,441 70,261 75,538 (58,190) (57,097) 10,687 16,455 1,423,037 1,404,313 Support Services 227,404 218,657 71,292 62,357 156,112 156,300 14,536 17,883 260,565 233,853 Contributed Assets 13,950 59,292 – – 13,950 59,292 13,950 59,292 – – Total functions and activities 390,643 430,325 400,881 389,336 (10,238) 40,989 77,119 133,569 4,401,666 4,295,285 (1) The functions/activities reported above are different to what has been reported in the past. The Goals listed above and described on the following page, align with Council’s Community Strategic Plan – Our Wollongong Our Future 2032. B Financial Performance B1 Functions or activities B1-1 Community Strategic Plan Goals – income, expenses and assets 1 Page 13 Wollongong City Council | Notes to the Financial Statements 30 June 2025`;

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
  'https://www.wollongong.nsw.gov.au/__data/assets/pdf_file/0011/300404/Annual-Financial-Statements-year-ended-30-June-2025.pdf';

const CONTEXT: WollongongGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Report for the Year Ended 30 June 2025 PDF, 7171.17 KB',
    url: PDF_URL,
    fiscal_year: WOLLONGONG_GPFS_FISCAL_YEAR,
    listing_url: WOLLONGONG_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/wollongong-gpfs/Annual-Financial-Statements-year-ended-30-June-2025.pdf',
    sha256: 'ae26b12b906a09ce17d1c353e4f36d8aec29b0de5e4b539cffe5a953aedc6ad3',
    bytes: 7_343_281,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: WOLLONGONG_GPFS_REPORTING_URL,
};

/** Golden fixture for the wollongong-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const WOLLONGONG_GPFS_ROW_COUNT = 17;
export const WOLLONGONG_GPFS_GOLDEN_DIGEST =
  'a04e0f52796e7bf67a3be96ef1cad70dcdfbd11322073f9d9240104e8533d29d';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'a04e0f52796e7bf67a3be96ef1cad70dcdfbd11322073f9d9240104e8533d29d';

export function goldenRecords() {
  const parsed = parseWollongongGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
