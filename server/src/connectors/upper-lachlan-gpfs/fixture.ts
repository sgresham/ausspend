import {
  UPPER_LACHLAN_GPFS_FISCAL_YEAR,
  UPPER_LACHLAN_GPFS_REPORTING_URL,
  parseUpperLachlanGpfsExtraction,
  type UpperLachlanGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 105). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2026
// and Actual 2025 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2026. Upper Lachlan
// Shire Council prints six revenue components (it does not print an "Other
// income" line, and the 2026 net gain on disposal is nil) and five expense
// components, including a real net loss on disposal of assets of 1,468. The net
// result is positive (6,372) while the before-capital result is negative
// (-1,190). Other comprehensive income prints a single 2026 revaluation
// component of 36,721.
export const UPPER_LACHLAN_PDF_URL =
  'https://upperlachlan.nsw.gov.au/wp-content/uploads/2026/10/ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf';
export const UPPER_LACHLAN_PDF_SHA256 =
  '3ca065982ea966c62c69243ae74039ce539fd1a055fdd94e2c8eec832ef66e41';
export const UPPER_LACHLAN_PDF_BYTES = 4215629;

export const UPPER_LACHLAN_INCOME_TEXT =
  `Upper Lachlan Shire Council | Income Statement | for the year ended 30 June 2026 Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 15,356 Rates and annual charges B2-1 15,372 14,594 6,946 User charges and fees B2-2 10,991 9,869 537 Other revenues B2-3 830 755 16,349 Grants and contributions provided for operating purposes B2-4 14,650 11,875 1,184 Grants and contributions provided for capital purposes B2-4 7,562 10,938 1,378 Interest and investment income B2-5 1,669 1,597 51 Net gain from the disposal of assets B4-1 – – 41,801 Total income from continuing operations 51,074 49,628 Expenses from continuing operations 14,563 Employee benefits and on-costs B3-1 12,709 13,967 16,522 Materials and services B3-2 17,647 21,339 223 Borrowing costs B3-3 504 407 854 Other expenses B3-5 874 1,092 818 Net loss from the disposal of assets B4-1 1,468 1,048 32,980 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 33,202 37,853 8,821 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 17,872 11,775 10,560 Depreciation, amortisation and impairment of non-financial assets B3-4 11,500 10,209 (1,739) Operating result from continuing operations 6,372 1,566 (1,739) Net operating result for the year attributable to Council 6,372 1,566 (2,923) Net operating result for the year before grants and contributions provided for capital purposes (1,190) (9,372) The above Income Statement should be read in conjunction with the accompanying notes. Upper Lachlan Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 78`;

export const UPPER_LACHLAN_COMPREHENSIVE_TEXT =
  `Upper Lachlan Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 6,372 1,566 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-6 36,721 1,199 Total items which will not be reclassified subsequent to operating result 36,721 1,199 Total other comprehensive income for the year 36,721 1,199 Total comprehensive income for the year attributable to Council 43,093 2,765 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Upper Lachlan Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 78`;

export const UPPER_LACHLAN_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Our leadership – – 1,190 1,613 (1,190) (1,613) – – 772 2,606 Our infrastructure 11,221 15,349 18,654 19,622 (7,433) (4,273) 9,137 12,045 476,344 436,095 Our society/community 2,296 2,830 5,948 6,154 (3,652) (3,324) 2,007 2,080 76,069 72,613 Our environment 9,970 8,593 8,790 8,555 1,180 38 375 691 88,910 89,044 Our economy 7,877 8,355 10,120 12,118 (2,243) (3,763) 1,473 3,466 21,137 19,209 Other – general purpose income 19,710 14,501 – – 19,710 14,501 9,220 4,531 1,906 2,245 Total functions and activities 51,074 49,628 44,702 48,062 6,372 1,566 22,212 22,813 665,138 621,812 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 78 Upper Lachlan Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function upperLachlanExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: UPPER_LACHLAN_PDF_SHA256,
      bytes: UPPER_LACHLAN_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? UPPER_LACHLAN_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? UPPER_LACHLAN_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? UPPER_LACHLAN_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const UPPER_LACHLAN_CONTEXT: UpperLachlanGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Upper Lachlan Shire Council Financial Statements 2025-2026',
    url: UPPER_LACHLAN_PDF_URL,
    fiscal_year: UPPER_LACHLAN_GPFS_FISCAL_YEAR,
    listing_url: UPPER_LACHLAN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'upper-lachlan-gpfs/ANNEXURE-A-Part-2-Annual_Financial_Statements-2026_Final-Audited.pdf',
    sha256: UPPER_LACHLAN_PDF_SHA256,
    bytes: UPPER_LACHLAN_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: UPPER_LACHLAN_GPFS_REPORTING_URL,
};

/** Golden fixture for the upper-lachlan-gpfs module: 16 rows. */
export const UPPER_LACHLAN_GPFS_ROW_COUNT = 16;
export const UPPER_LACHLAN_GPFS_GOLDEN_DIGEST = '9380e5313723e8d2705a2b66ef5241cb11166dd4e409157a53faab09ccf54e8e';
export const ROW_COUNT = UPPER_LACHLAN_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = UPPER_LACHLAN_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseUpperLachlanGpfsExtraction(
    upperLachlanExtraction(),
    UPPER_LACHLAN_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
