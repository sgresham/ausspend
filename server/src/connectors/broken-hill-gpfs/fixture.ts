import {
  BROKEN_HILL_GPFS_FISCAL_YEAR,
  BROKEN_HILL_GPFS_REPORTING_URL,
  parseBrokenHillGpfsExtraction,
  type BrokenHillGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 6, 7 and 15 of 95). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025 (the FY2024-25 reporting
// year). Broken Hill City Council prints seven revenue lines and five expense
// lines (including a real net loss on the disposal of assets of 438). The net
// result is positive; the printed before-capital result is negative. Other
// comprehensive income has a single component (revaluation 14,469) equal to the
// printed other comprehensive income.
export const BROKEN_HILL_PDF_URL =
  'https://www.brokenhill.nsw.gov.au/files/assets/public/v/5/documents/financial-statements/broken-hill-city-council-annual-financial-statements-2025.pdf';
export const BROKEN_HILL_PDF_SHA256 =
  'b4ef2b7951f7de837d2ddb38e8aed886ee84d630ac1eb95f5e667acf915f079e';
export const BROKEN_HILL_PDF_BYTES = 3400140;

export const BROKEN_HILL_INCOME_TEXT =
  `Broken Hill City Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 21,814 Rates and annual charges B2-1 21,823 21,002 4,555 User charges and fees B2-2 4,381 5,183 608 Other revenues B2-3 1,033 1,389 7,977 Grants and contributions provided for operating purposes B2-4 6,162 8,446 18,364 Grants and contributions provided for capital purposes B2-4 13,243 5,604 1,240 Interest and investment income B2-5 1,407 1,388 547 Other income B2-6 677 570 55,105 Total income from continuing operations 48,726 43,582 Expenses from continuing operations 16,488 Employee benefits and on-costs B3-1 16,475 15,847 11,593 Materials and services B3-2 12,578 12,072 693 Borrowing costs B3-3 758 812 1,154 Other expenses B3-5 1,444 1,249 – Net loss from the disposal of assets B4-1 438 136 29,928 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 31,693 30,116 25,177 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 17,033 13,466 6,809 Depreciation, amortisation and impairment of non-financial assets B3-4 7,382 6,855 18,368 Operating result from continuing operations 9,651 6,611 18,368 Net operating result for the year attributable to Council 9,651 6,611 – Net operating result for the year before grants and contributions provided for capital purposes (3,592) 1,007 The above Income Statement should be read in conjunction with the accompanying notes. Broken Hill City Council Income Statement for the year ended 30 June 2025 Page 5 of 71`;

export const BROKEN_HILL_COMPREHENSIVE_TEXT =
  `Broken Hill City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 9,651 6,611 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 14,469 14,089 Total items which will not be reclassified subsequent to operating result 14,469 14,089 Total other comprehensive income for the year 14,469 14,089 Total comprehensive income for the year attributable to Council 24,120 20,700 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Broken Hill City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 71`;

export const BROKEN_HILL_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Our Community 3,948 2,781 8,580 8,057 (4,632) (5,276) 2,941 1,954 326,042 307,957 Our Economy 12,168 7,361 9,295 9,241 2,873 (1,880) 10,511 4,768 16,299 15,395 Our Environment 7,240 6,772 5,667 5,233 1,573 1,539 1,524 876 9,568 9,038 Our Leadership 25,370 26,668 15,533 14,440 9,837 12,228 4,429 6,451 63,902 60,358 Total functions and activities 48,726 43,582 39,075 36,971 9,651 6,611 19,405 14,050 415,813 393,431 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 71 Broken Hill City Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function brokenHillExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BROKEN_HILL_PDF_SHA256,
      bytes: BROKEN_HILL_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BROKEN_HILL_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? BROKEN_HILL_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? BROKEN_HILL_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BROKEN_HILL_CONTEXT: BrokenHillGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statements 2024-25',
    url: BROKEN_HILL_PDF_URL,
    fiscal_year: BROKEN_HILL_GPFS_FISCAL_YEAR,
    listing_url: BROKEN_HILL_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'broken-hill-gpfs/broken-hill-city-council-annual-financial-statements-2025.pdf',
    sha256: BROKEN_HILL_PDF_SHA256,
    bytes: BROKEN_HILL_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BROKEN_HILL_GPFS_REPORTING_URL,
};

/** Golden fixture for the broken-hill-gpfs module: 17 rows. */
export const BROKEN_HILL_GPFS_ROW_COUNT = 17;
export const BROKEN_HILL_GPFS_GOLDEN_DIGEST =
  '6ac5359d9bdb322247d2528e22abdf442e88a5c79c2b2a087c215bcd2b2cee3e';
export const ROW_COUNT = BROKEN_HILL_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BROKEN_HILL_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBrokenHillGpfsExtraction(
    brokenHillExtraction(),
    BROKEN_HILL_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
