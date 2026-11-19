import {
  WARRUMBUNGLE_GPFS_FISCAL_YEAR,
  WARRUMBUNGLE_GPFS_REPORTING_URL,
  parseWarrumbungleGpfsExtraction,
  type WarrumbungleGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 106). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2025
// and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Warrumbungle
// Shire Council prints seven revenue components (the 2025 net gain on disposal
// is nil) and five expense components, including a real net loss on disposal of
// assets of 5,211. The net result is negative (-2,855) and the before-capital
// result is more negative (-8,684). Other comprehensive income prints a 2025
// revaluation of 30,817 and a nil impairment/revaluation reversal (the 2024
// comparative (667) must never be read as the current year), summing to the
// printed 30,817.
export const WARRUMBUNGLE_PDF_URL =
  'https://www.warrumbungle.nsw.gov.au/files/assets/public/v/3/our-council/publications-amp-reports/annual-financial-statements-2024-2025.pdf';
export const WARRUMBUNGLE_PDF_SHA256 =
  '1b22e9c46df2037c0d234b0f99fe45d0bb650784756d24d777485c27e9bc25d4';
export const WARRUMBUNGLE_PDF_BYTES = 3318554;

export const WARRUMBUNGLE_INCOME_TEXT =
  `Warrumbungle Shire Council | Income Statement | for the year ended 30 June 2025 Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 16,705 Rates and annual charges B2-1 16,270 15,608 6,588 User charges and fees B2-2 8,839 10,955 1,482 Other revenues B2-3 1,624 2,205 15,915 Grants and contributions provided for operating purposes B2-4 17,197 33,667 9,732 Grants and contributions provided for capital purposes B2-4 5,829 3,317 1,510 Interest and investment income B2-5 2,731 2,316 – Other income 53 45 856 Net gain from the disposal of assets B4-1 – – 52,788 Total income from continuing operations 52,543 68,113 Expenses from continuing operations 17,398 Employee benefits and on-costs B3-1 17,647 17,503 15,375 Materials and services B3-2 16,354 22,970 141 Borrowing costs B3-3 125 162 1,953 Other expenses B3-5 1,756 1,817 – Net loss from the disposal of assets 5,211 2,006 34,867 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 41,093 44,458 17,921 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 11,450 23,655 11,536 Depreciation, amortisation and impairment of non-financial assets B3-4 14,305 13,760 6,385 Operating result from continuing operations (2,855) 9,895 6,385 Net operating result for the year attributable to Council (2,855) 9,895 (3,347) Net operating result for the year before grants and contributions provided for capital purposes (8,684) 6,578 The above Income Statement should be read in conjunction with the accompanying notes. Warrumbungle Shire Council Income Statement for the year ended 30 June 2025 Page 4 of 81`;

export const WARRUMBUNGLE_COMPREHENSIVE_TEXT =
  `Warrumbungle Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement (2,855) 9,895 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 30,817 38,743 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-7 – (667) Total items which will not be reclassified subsequent to operating result 30,817 38,076 Total other comprehensive income for the year 30,817 38,076 Total comprehensive income for the year attributable to Council 27,962 47,971 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Warrumbungle Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 81`;

export const WARRUMBUNGLE_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities General Revenue 18,328 21,139 – – 18,328 21,139 6,521 10,061 5,229 7,659 Executive 299 757 1,590 2,272 (1,291) (1,515) 284 743 – – Technical Services 15,734 29,547 28,693 33,600 (12,959) (4,053) 12,904 22,927 566,945 537,278 Development Services 521 844 5,006 4,538 (4,485) (3,694) 139 217 62,849 62,157 Corporate and Community Services 5,858 4,760 8,695 7,751 (2,837) (2,991) 2,718 2,988 44,646 47,434 Warrumbungle Water 6,276 5,501 5,382 4,992 894 509 614 48 58,601 56,751 Warrumbungle Sewer 2,589 2,371 2,624 2,259 (35) 112 (157) – 34,001 33,043 Warrumbungle Waste 2,938 3,194 3,408 2,806 (470) 388 3 – 417 754 Total functions and activities 52,543 68,113 55,398 58,218 (2,855) 9,895 23,026 36,984 772,688 745,076 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 81 Warrumbungle Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function warrumbungleExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: WARRUMBUNGLE_PDF_SHA256,
      bytes: WARRUMBUNGLE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? WARRUMBUNGLE_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? WARRUMBUNGLE_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? WARRUMBUNGLE_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const WARRUMBUNGLE_CONTEXT: WarrumbungleGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Warrumbungle Shire Council Annual Financial Statements 2024-2025',
    url: WARRUMBUNGLE_PDF_URL,
    fiscal_year: WARRUMBUNGLE_GPFS_FISCAL_YEAR,
    listing_url: WARRUMBUNGLE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'warrumbungle-gpfs/annual-financial-statements-2024-2025.pdf',
    sha256: WARRUMBUNGLE_PDF_SHA256,
    bytes: WARRUMBUNGLE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: WARRUMBUNGLE_GPFS_REPORTING_URL,
};

/** Golden fixture for the warrumbungle-gpfs module: 17 rows. */
export const WARRUMBUNGLE_GPFS_ROW_COUNT = 17;
export const WARRUMBUNGLE_GPFS_GOLDEN_DIGEST = 'e711545b0a206ed025899adaeef7a46c56502a17af16adbf15de7999d6c32916';
export const ROW_COUNT = WARRUMBUNGLE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = WARRUMBUNGLE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseWarrumbungleGpfsExtraction(
    warrumbungleExtraction(),
    WARRUMBUNGLE_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
