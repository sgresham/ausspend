import {
  FORBES_GPFS_FISCAL_YEAR,
  FORBES_GPFS_REPORTING_URL,
  parseForbesGpfsExtraction,
  type ForbesGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 5, 6 and 15 of 106). The Income Statement
// prints the Original unaudited budget column before each line label, with
// Actual 2025 and Actual 2024 after it. A parser that took the first number in
// the line would read the budget; the expected values are all Actual 2025.
// Forbes Shire Council prints eight revenue components (other revenues and
// other income are separate, and the 2025 net gain on disposal of assets is a
// real 1,854) and four expense components. The net result is positive; the
// printed before-capital result is negative. Other comprehensive income has a
// single component (revaluation 54,664) equal to the printed other
// comprehensive income.
export const FORBES_PDF_URL =
  'https://www.forbes.nsw.gov.au/ArticleDocuments/211/Annual_Financial_Statements-2025.pdf.aspx';
export const FORBES_PDF_SHA256 =
  '6f512014865b7ae2e23d12daf5e670b3137e445023272eab8c656cb0db34ca62';
export const FORBES_PDF_BYTES = 2560081;

export const FORBES_INCOME_TEXT =
  `Forbes Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 15,702 Rates and annual charges B2-1 15,712 14,889 13,743 User charges and fees B2-2 20,622 22,804 606 Other revenues B2-3 1,710 5,125 19,823 Grants and contributions provided for operating purposes B2-4 13,845 20,602 299 Grants and contributions provided for capital purposes B2-4 11,538 13,764 1,574 Interest and investment income B2-5 1,618 1,541 1,188 Other income B2-6 1,068 860 4,313 Net gain from the disposal of assets B4-1 1,854 2,599 57,248 Total income from continuing operations 67,967 82,184 Expenses from continuing operations 14,910 Employee benefits and on-costs B3-1 16,043 14,741 19,451 Materials and services B3-2 26,767 35,435 1,502 Borrowing costs B3-3 1,802 1,503 5,157 Other expenses B3-5 1,130 1,045 41,020 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 45,742 52,724 16,228 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 22,225 29,460 13,071 Depreciation, amortisation and impairment of non-financial assets B3-4 16,096 14,379 3,157 Operating result from continuing operations 6,129 15,081 3,157 Net operating result for the year attributable to Council 6,129 15,081 2,858 Net operating result for the year before grants and contributions provided for capital purposes (5,409) 1,317 The above Income Statement should be read in conjunction with the accompanying notes. Forbes Shire Council Income Statement for the year ended 30 June 2025 Page 3 of 81`;

export const FORBES_COMPREHENSIVE_TEXT =
  `Forbes Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 6,129 15,081 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 54,664 36,299 Total items which will not be reclassified subsequent to operating result 54,664 36,299 Total other comprehensive income for the year 54,664 36,299 Total comprehensive income for the year attributable to Council 60,793 51,380 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Forbes Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 4 of 81`;

export const FORBES_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Our Society and Places 1,464 1,176 5,130 4,979 (3,666) (3,803) 1,420 1,095 1,704 1,569 Our Economic Development 10,547 12,483 7,700 7,293 2,847 5,190 56 1,310 30,593 28,184 Our Environment 4,414 3,632 5,008 4,683 (594) (1,051) 438 313 4,336 3,995 Our Leadership and Governance 16,152 17,100 3,377 5,021 12,775 12,079 5,580 6,979 141,893 127,538 Our Infrastructure (General Fund) 24,994 38,781 30,500 36,124 (5,506) 2,657 16,100 24,382 414,795 382,146 Our Infrastructure – Water Supply 6,877 5,492 6,039 5,480 838 12 1,669 116 59,088 54,435 Our Infrastructure – Sewer Supply 3,519 3,520 4,084 3,523 (565) (3) 120 171 43,688 40,248 Total functions and activities 67,967 82,184 61,838 67,103 6,129 15,081 25,383 34,366 696,097 638,115 B B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 81 Forbes Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function forbesExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: FORBES_PDF_SHA256,
      bytes: FORBES_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? FORBES_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? FORBES_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? FORBES_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const FORBES_CONTEXT: ForbesGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Forbes Shire Council Financial Statements 2024-25',
    url: FORBES_PDF_URL,
    fiscal_year: FORBES_GPFS_FISCAL_YEAR,
    listing_url: FORBES_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'forbes-gpfs/Annual_Financial_Statements-2025.pdf',
    sha256: FORBES_PDF_SHA256,
    bytes: FORBES_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: FORBES_GPFS_REPORTING_URL,
};

/** Golden fixture for the forbes-gpfs module: 17 rows. */
export const FORBES_GPFS_ROW_COUNT = 17;
export const FORBES_GPFS_GOLDEN_DIGEST =
  '826eb99d18dcfcf09a700a136cdcf3b0dde40e0982149910fa7c864ce5db03b2';
export const ROW_COUNT = FORBES_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = FORBES_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseForbesGpfsExtraction(forbesExtraction(), FORBES_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
