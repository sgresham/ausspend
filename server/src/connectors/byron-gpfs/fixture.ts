import {
  BYRON_GPFS_FISCAL_YEAR,
  BYRON_GPFS_REPORTING_URL,
  parseByronGpfsExtraction,
  type ByronGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 6, 7 and 15 of 112). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Byron Shire Council prints
// seven revenue lines and five expense lines (including a real net loss on the
// disposal of assets of 5,805). The net result is positive; the printed
// before-capital result is negative. Other comprehensive income has three
// components (revaluation -58,766; impairment reversal 191; joint ventures 103)
// summing to the printed total -58,472.
export const BYRON_PDF_URL =
  'https://www.byron.nsw.gov.au/files/assets/public/v/2/hptrim/financial-management-budgeting-operational-budget-documentation-20262027/final-published-2025-26-financial-statements-byron-shire-council.pdf';
export const BYRON_PDF_SHA256 =
  'a28fe05f984ef47a2e1ae158b1500c862a0a5870bb435f8eed737006b3d42aec';
export const BYRON_PDF_BYTES = 3221859;

export const BYRON_INCOME_TEXT =
  `Byron Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 69,797 Rates and annual charges B2-1 70,384 66,677 32,904 User charges and fees B2-2 37,841 35,137 2,028 Other revenues B2-3 2,687 3,001 7,971 Grants and contributions provided for operating purposes B2-4 17,895 9,938 41,265 Grants and contributions provided for capital purposes B2-4 53,137 42,428 3,590 Interest and investment income B2-5 4,654 6,098 1,786 Other income B2-6 1,970 1,869 159,341 Total income from continuing operations 188,568 165,148 Expenses from continuing operations 37,798 Employee benefits and on-costs B3-1 38,264 38,419 51,641 Materials and services B3-2 64,620 71,362 3,000 Borrowing costs B3-3 2,536 2,888 4,248 Other expenses B3-5 3,002 2,883 – Net loss from the disposal of assets B4-1 5,805 4,035 96,687 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 114,227 119,587 62,654 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 74,341 45,561 21,878 Depreciation, amortisation and impairment of non-financial assets B3-4 26,499 25,812 40,776 Operating result from continuing operations 47,842 19,749 40,776 Net operating result for the year attributable to Council 47,842 19,749 (493) Net operating result for the year before grants and contributions provided for capital purposes (5,295) (22,679) The above Income Statement should be read in conjunction with the accompanying notes. Byron Shire Council Income Statement for the year ended 30 June 2026 Page 5 of 85`;

export const BYRON_COMPREHENSIVE_TEXT =
  `Byron Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 47,842 19,749 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 (58,766) 50,321 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-7 191 (1,824) Other comprehensive income – joint ventures and associates 103 142 Total items which will not be reclassified subsequent to operating result (58,472) 48,639 Total other comprehensive income for the year (58,472) 48,639 Total comprehensive income for the year attributable to Council (10,630) 68,388 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Byron Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6 of 85`;

export const BYRON_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities We have, infrastructure, transport and services which meet our expectations 104,444 86,796 91,542 104,111 12,902 (17,315) 63,020 47,461 994,032 1,042,974 We cultivate and celebrate our diverse cultures, lifestyle and sense of community 8,082 7,270 12,185 7,979 (4,103) (709) 3,592 2,105 364,765 319,943 We protect and enhance our natural environment 18,716 17,255 27,018 23,582 (8,302) (6,327) 566 667 29,895 33,877 We manage growth and change responsibly 16,908 17,696 6,791 6,947 10,117 10,749 130 246 92,447 99,014 We have community led decision making which is open and inclusive 40,418 36,131 3,190 2,780 37,228 33,351 3,724 1,887 170,446 163,814 Total functions and activities 188,568 165,148 140,726 145,399 47,842 19,749 71,032 52,366 1,651,585 1,659,622 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 85 Byron Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function byronExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BYRON_PDF_SHA256,
      bytes: BYRON_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BYRON_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? BYRON_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? BYRON_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BYRON_CONTEXT: ByronGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Financial Statements 2025-26',
    url: BYRON_PDF_URL,
    fiscal_year: BYRON_GPFS_FISCAL_YEAR,
    listing_url: BYRON_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'byron-gpfs/final-published-2025-26-financial-statements-byron-shire-council.pdf',
    sha256: BYRON_PDF_SHA256,
    bytes: BYRON_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BYRON_GPFS_REPORTING_URL,
};

/** Golden fixture for the byron-gpfs module: 17 rows. */
export const BYRON_GPFS_ROW_COUNT = 17;
export const BYRON_GPFS_GOLDEN_DIGEST =
  '285580fc89639b8f029d8e0876570a507789406f836344876c075206ade24630';
export const ROW_COUNT = BYRON_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BYRON_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseByronGpfsExtraction(byronExtraction(), BYRON_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
