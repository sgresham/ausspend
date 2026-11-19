import {
  ORANGE_GPFS_FISCAL_YEAR,
  ORANGE_GPFS_REPORTING_URL,
  parseOrangeGpfsExtraction,
  type OrangeGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived endorsed FY2025-26
// annual report (PDF pp. 89, 90 and 98 of 124). The annual report contains the
// signed audited GPFS section; no separate standalone FY2025-26 AFS is
// published yet. The Income Statement prints the Original unaudited budget
// column before each line label, with Actual 2026 and Actual 2025 after it. A
// parser that took the first number in the line would read the budget; the
// expected values are all Actual 2026. Orange City Council prints seven revenue
// lines and five expense lines (including a real net loss on disposal of assets
// of 6,424). The net result and the printed before-capital result are both
// positive. Other comprehensive income has a single component (revaluation
// 201,141) equal to the printed other comprehensive income.
export const ORANGE_PDF_URL =
  'https://www.orange.nsw.gov.au/wp-content/uploads/2026/11/Orange-City-Council-2025-2026-Annual-Report-Endorsed-CCL-17-November-2026.pdf';
export const ORANGE_PDF_SHA256 =
  'd8f815cc6ce577b13ac2f6c6f991a30fbcd9c541ed7ce8f3a0d469ea84af356d';
export const ORANGE_PDF_BYTES = 4329237;

export const ORANGE_INCOME_TEXT =
  `Orange City Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 70,895 Rates and annual charges B2-1 70,700 67,078 33,588 User charges and fees B2-2 36,435 34,085 12,040 Other revenues B2-3 8,673 7,741 14,155 Grants and contributions provided for operating purposes B2-4 13,967 8,197 21,631 Grants and contributions provided for capital purposes B2-4 28,026 46,279 11,216 Interest and investment income B2-5 12,027 13,164 2,013 Other income B2-6 1,999 2,061 1,218 Net gain from the disposal of assets B4-1 – – 166,756 Total income from continuing operations 171,827 178,605 Expenses from continuing operations 55,218 Employee benefits and on-costs B3-1 56,769 53,589 52,286 Materials and services B3-2 45,542 45,721 1,678 Borrowing costs B3-3 554 682 1,394 Other expenses B3-5 1,280 1,695 2,500 Net loss from the disposal of assets B4-1 6,424 25,636 113,076 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 110,569 127,323 53,680 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 61,258 51,282 28,550 Depreciation, amortisation and impairment of non-financial assets B3-4 29,169 32,094 25,130 Operating result from continuing operations 32,089 19,188 25,130 Net operating result for the year attributable to Council 32,089 19,188 4,092 Net operating result for the year before grants and contributions provided for capital purposes 4,063 (27,091) The above Income Statement should be read in conjunction with the accompanying notes. Orange City Council Income Statement for the year ended 30 June 2026 Page 4`;

export const ORANGE_COMPREHENSIVE_TEXT =
  `Orange City Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 32,089 19,188 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 201,141 (19,102) Total items which will not be reclassified subsequent to operating result 201,141 (19,102) Total other comprehensive income for the year 201,141 (19,102) Total comprehensive income for the year attributable to Council 233,230 86 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Orange City Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5`;

export const ORANGE_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities City Government 58,971 54,208 18,103 19,901 40,868 34,307 9,643 5,996 210,646 186,190 Airport 3,284 2,714 1,298 1,471 1,986 1,243 143 41 16,594 13,763 Economic Development 7,728 13,410 5,334 11,129 2,394 2,281 6,476 12,033 68,211 104,117 Community Services 16,566 17,541 26,983 28,931 (10,417) (11,390) 3,404 4,373 345,055 230,563 Community Facilities 10,785 14,830 14,240 17,666 (3,455) (2,836) 8,997 13,107 182,092 165,277 Infrastructure 12,638 16,531 27,198 34,990 (14,560) (18,459) 9,748 14,055 347,808 327,358 Waste Management 15,456 14,460 12,597 11,466 2,859 2,994 120 – 161,100 107,268 Water Supplies 27,647 26,514 19,062 21,119 8,585 5,395 2,347 2,914 411,606 393,262 Sewer Networks 18,752 18,397 14,923 12,744 3,829 5,653 1,115 1,956 297,483 278,538 Total functions and activities 171,827 178,605 139,738 159,417 32,089 19,188 41,993 54,476 2,040,594 1,806,336 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 Orange City Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function orangeExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: ORANGE_PDF_SHA256,
      bytes: ORANGE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? ORANGE_INCOME_TEXT, 89),
      pdfPage(overrides.comprehensive ?? ORANGE_COMPREHENSIVE_TEXT, 90),
      pdfPage(overrides.functions ?? ORANGE_FUNCTIONS_TEXT, 98),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const ORANGE_CONTEXT: OrangeGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Report 2025-2026',
    url: ORANGE_PDF_URL,
    fiscal_year: ORANGE_GPFS_FISCAL_YEAR,
    listing_url: ORANGE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'orange-gpfs/Orange-City-Council-2025-2026-Annual-Report-Endorsed-CCL-17-November-2026.pdf',
    sha256: ORANGE_PDF_SHA256,
    bytes: ORANGE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: ORANGE_GPFS_REPORTING_URL,
};

/** Golden fixture for the orange-gpfs module: 17 rows. */
export const ORANGE_GPFS_ROW_COUNT = 17;
export const ORANGE_GPFS_GOLDEN_DIGEST =
  'd5db9f7e0b6058074e0d21a0bba4cbc6abd11d42c2a49ef2219eb91f16c30451';
export const ROW_COUNT = ORANGE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = ORANGE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseOrangeGpfsExtraction(orangeExtraction(), ORANGE_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
