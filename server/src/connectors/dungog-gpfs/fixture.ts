import {
  DUNGOG_GPFS_FISCAL_YEAR,
  DUNGOG_GPFS_REPORTING_URL,
  parseDungogGpfsExtraction,
  type DungogGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 90). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2025
// and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Dungog Shire
// Council prints seven revenue components (the 2025 net gain on disposal is nil)
// and five expense components, including a real net loss on disposal of assets
// of 3,779. The net result is positive (6,802) while the before-capital result
// is negative (-15,750). Other comprehensive income prints a single 2025
// revaluation component of 17,409.
export const DUNGOG_PDF_URL =
  'https://www.dungog.nsw.gov.au/files/assets/public/v/1/councildocuments/annual_reports/2024-2025/annual-financial-statements-2025-final-version.pdf';
export const DUNGOG_PDF_SHA256 =
  '42f903551abb8c750e3b4d37fc69ae5b57e05ef27dcc4f9f1f8cf2fb6186ef94';
export const DUNGOG_PDF_BYTES = 2733768;

export const DUNGOG_INCOME_TEXT =
  `Dungog Shire Council | Income Statement | for the year ended 30 June 2025 Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 13,119 Rates and annual charges B2-1 13,333 12,579 1,314 User charges and fees B2-2 1,371 1,386 954 Other revenues B2-3 998 1,114 5,484 Grants and contributions provided for operating purposes B2-4 4,918 4,773 31,738 Grants and contributions provided for capital purposes B2-4 22,552 22,255 581 Interest and investment income B2-5 1,052 1,080 177 Other income B2-6 191 189 53,367 Total income from continuing operations 44,415 43,376 Expenses from continuing operations 9,278 Employee benefits and on-costs B3-1 8,628 7,161 6,758 Materials and services B3-2 12,662 9,476 103 Borrowing costs B3-3 1,458 1,293 1,291 Other expenses B3-5 1,204 1,391 – Net loss from the disposal of assets B4-1 3,779 3,864 17,430 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 27,731 23,185 35,937 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 16,684 20,191 6,249 Depreciation, amortisation and impairment of non-financial assets B3-4 9,882 7,253 29,688 Operating result from continuing operations 6,802 12,938 29,688 Net operating result for the year attributable to Council 6,802 12,938 (2,050) Net operating result for the year before grants and contributions provided for capital purposes (15,750) (9,317) The above Income Statement should be read in conjunction with the accompanying notes. Dungog Shire Council Income Statement for the year ended 30 June 2025 Page 4`;

export const DUNGOG_COMPREHENSIVE_TEXT =
  `Dungog Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 6,802 12,938 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 17,409 30,047 Total items which will not be reclassified subsequent to operating result 17,409 30,047 Total other comprehensive income for the year 17,409 30,047 Total comprehensive income for the year attributable to Council 24,211 42,985 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Dungog Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5`;

export const DUNGOG_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Corporate & client services 530 467 7,183 8,925 (6,653) (8,458) 15 19 39,109 46,766 Public order and safety 54 32 1,071 295 (1,017) (263) 31 4 4,648 2,973 Health 137 52 125 133 12 (81) 137 48 3 – Community services and education 140 15 271 236 (131) (221) 9 9 2,212 1,472 Housing and community amenities 4,720 3,908 8,499 7,342 (3,779) (3,434) 605 110 17,141 20,217 Recreation and culture 1,280 1,829 2,950 2,437 (1,670) (608) 1,358 1,844 31,969 18,306 Mining, manufacture and construction 61 86 346 511 (285) (425) – – 1,124 1,605 Transport and communication 21,084 22,804 16,310 9,803 4,774 13,001 21,063 22,802 532,282 507,145 Economic affairs 464 347 858 756 (394) (409) 30 1 4,487 3,963 General purpose income 15,945 13,836 – – 15,945 13,836 4,222 2,191 162 173 Total functions and activities 44,415 43,376 37,613 30,438 6,802 12,938 27,470 27,028 633,137 602,620 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 Dungog Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function dungogExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: DUNGOG_PDF_SHA256,
      bytes: DUNGOG_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? DUNGOG_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? DUNGOG_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? DUNGOG_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const DUNGOG_CONTEXT: DungogGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Dungog Shire Council Annual Financial Statements 2024-2025',
    url: DUNGOG_PDF_URL,
    fiscal_year: DUNGOG_GPFS_FISCAL_YEAR,
    listing_url: DUNGOG_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'dungog-gpfs/annual-financial-statements-2025-final-version.pdf',
    sha256: DUNGOG_PDF_SHA256,
    bytes: DUNGOG_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: DUNGOG_GPFS_REPORTING_URL,
};

/** Golden fixture for the dungog-gpfs module: 17 rows. */
export const DUNGOG_GPFS_ROW_COUNT = 17;
export const DUNGOG_GPFS_GOLDEN_DIGEST = '6d6e8ee95a8581f71ed922e840f6bf358889da5a76acba195337f254a22b62b0';
export const ROW_COUNT = DUNGOG_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = DUNGOG_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseDungogGpfsExtraction(
    dungogExtraction(),
    DUNGOG_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
