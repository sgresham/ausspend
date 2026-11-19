import {
  WEDDIN_GPFS_FISCAL_YEAR,
  WEDDIN_GPFS_REPORTING_URL,
  parseWeddinGpfsExtraction,
  type WeddinGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 4, 5 and 13 of 98). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025. Weddin prints seven non-zero
// revenue lines (its net gain on disposal is nil) and five expense lines
// (including borrowing costs and a net loss on disposal). The net result and the
// printed before-capital result are both negative.
export const WEDDIN_PDF_URL =
  'https://www.weddin.nsw.gov.au/files/assets/public/v/1/council/plans-strategies-amp-reports/other-plans-amp-strategies/20251106-2024-2025-annual-financial-statements.pdf';
export const WEDDIN_PDF_SHA256 =
  '4c34af5f30efefc842b42c77f9f4b3b39567e98a40d598a8fc775aa66ddf309b';
export const WEDDIN_PDF_BYTES = 5_166_514;

export const WEDDIN_INCOME_TEXT =
  "Weddin Shire Council | Income Statement | for the year ended 30 June 2025 Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 4,955 Rates and annual charges B2-1 4,632 4,348 2,775 User charges and fees B2-2 8,514 5,349 257 Other revenues B2-3 1,301 181 12,156 Grants and contributions provided for operating purposes B2-4 7,684 14,499 31,389 Grants and contributions provided for capital purposes B2-4 6,831 2,464 219 Interest and investment income B2-5 573 309 149 Other income B2-6 174 1,039 336 Net gain from the disposal of assets B4-1 – 113 52,236 Total income from continuing operations 29,709 28,302 Expenses from continuing operations 6,996 Employee benefits and on-costs B3-1 7,794 7,001 42,705 Materials and services B3-2 16,151 13,889 227 Borrowing costs B3-3 157 172 1,388 Other expenses B3-5 399 389 – Net loss from the disposal of assets B4-1 1,010 – 51,316 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 25,511 21,451 920 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 4,198 6,851 3,612 Depreciation, amortisation and impairment of non-financial assets B3-4 6,234 5,779 (2,692) Operating result from continuing operations (2,036) 1,072 (2,692) Net operating result for the year attributable to Council (2,036) 1,072 (34,081) Net operating result for the year before grants and contributions provided for capital purposes (8,867) (1,392) The above Income Statement should be read in conjunction with the accompanying notes. Weddin Shire Council Income Statement for the year ended 30 June 2025 Page 4 of 78";

export const WEDDIN_COMPREHENSIVE_TEXT =
  "Weddin Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement (2,036) 1,072 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 32,252 13,659 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-7 4,058 1,014 Other comprehensive income – joint ventures and associates 904 1,589 Total items which will not be reclassified subsequent to operating result 37,214 16,262 Total other comprehensive income for the year 37,214 16,262 Total comprehensive income for the year attributable to Council 35,178 17,334 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Weddin Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 78";

export const WEDDIN_FUNCTIONS_TEXT =
  "Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Community and Culture 615 281 809 527 (194) (246) 590 265 12,349 15,268 Local Economy 231 276 542 605 (311) (329) – 148 – – Environmental 3,086 2,931 2,907 2,153 179 778 175 61 14,007 17,509 Infrastructure 20,795 19,869 22,750 19,096 (1,955) 773 11,893 12,670 250,045 208,707 Government and Representation 4,109 3,285 3,826 3,462 283 (177) 1,817 3,793 19,918 24,436 Share of Central Tablelands Water 51 892 – – 51 892 – – 41,010 40,055 Sewer Services 822 768 911 1,387 (89) (619) 40 26 22,158 21,708 Total functions and activities 29,709 28,302 31,745 27,230 (2,036) 1,072 14,515 16,963 359,487 327,683 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 78 Weddin Shire Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function weddinExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: WEDDIN_PDF_SHA256,
      bytes: WEDDIN_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? WEDDIN_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? WEDDIN_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? WEDDIN_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const WEDDIN_CONTEXT: WeddinGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statements 2024-2025',
    url: WEDDIN_PDF_URL,
    fiscal_year: WEDDIN_GPFS_FISCAL_YEAR,
    listing_url: WEDDIN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'weddin-gpfs/20251106-2024-2025-annual-financial-statements.pdf',
    sha256: WEDDIN_PDF_SHA256,
    bytes: WEDDIN_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: WEDDIN_GPFS_REPORTING_URL,
};

/** Golden fixture for the weddin-gpfs module: 17 rows. */
export const WEDDIN_GPFS_ROW_COUNT = 17;
export const WEDDIN_GPFS_GOLDEN_DIGEST =
  '3b1efc1349d5b3769bce79fa8a031bb3e0d5059ad19ae6432b63ea4e0ae782d2';
export const ROW_COUNT = WEDDIN_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = WEDDIN_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseWeddinGpfsExtraction(weddinExtraction(), WEDDIN_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
