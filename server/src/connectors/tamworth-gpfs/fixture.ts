import {
  TAMWORTH_GPFS_FISCAL_YEAR,
  TAMWORTH_GPFS_REPORTING_URL,
  parseTamworthGpfsExtraction,
  type TamworthGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Tamworth Regional Council Annual
// Financial Statements for the year ended 30 June 2026 (120-page PDF; the GPFS
// primary statements are extraction pages 5-9 and B1-1 is page 14). These
// reproduce the printed $'000 values used by the zero-tolerance reconciliation.
export const TAMWORTH_FS_PDF_URL =
  'https://www.tamworth.nsw.gov.au/ArticleDocuments/226/Annual%20Financial%20Statements%20-%202026.pdf.aspx';
export const TAMWORTH_FS_PDF_SHA256 =
  '03bf66f0cc18f7b8197b06e66fc9e994bd343f739da6d02ba2a6ee8e58c01408';
export const TAMWORTH_FS_PDF_BYTES = 5608740;

export const TAMWORTH_INCOME_TEXT =
  "Tamworth Regional Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 102,695 Rates and annual charges B2-1 103,547 94,075 49,462 User charges and fees B2-2 63,287 55,645 3,285 Other revenues B2-3 4,076 3,874 23,371 Grants and contributions provided for operating purposes B2-4 28,602 21,961 41,901 Grants and contributions provided for capital purposes B2-4 35,752 82,254 9,156 Interest and investment income B2-5 10,753 11,379 5,164 Other income B2-6 6,450 3,741 235,034 Total income from continuing operations 252,467 272,929 Expenses from continuing operations 73,443 Employee benefits and on-costs B3-1 71,729 65,550 52,863 Materials and services B3-2 84,009 70,134 3,631 Borrowing costs B3-3 3,586 4,151 4,423 Other expenses B3-5 5,146 4,813 – Net loss from the disposal of assets B4-1 7,321 6,986 134,360 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 171,791 151,634 100,674 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 80,676 121,295 47,556 Depreciation, amortisation and impairment of non-financial assets B3-4 59,434 50,269 53,118 Operating result from continuing operations 21,242 71,026 53,118 Net operating result for the year 21,242 71,026 53,118 Net operating result attributable to Council 21,311 70,974 – Net operating result attributable to non-controlling interests (69) 52 11,217 Net operating result for the year before grants and contributions provided for capital purposes (14,510) (11,228) The above Income Statement should be read in conjunction with the accompanying notes. Tamworth Regional Council Income Statement for the year ended 30 June 2026 Page 4 of 90";

export const TAMWORTH_COMPREHENSIVE_TEXT =
  "Tamworth Regional Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 21,242 71,026 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-8 303,738 134,255 Total items which will not be reclassified subsequent to operating result 303,738 134,255 Total other comprehensive income for the year 303,738 134,255 Total comprehensive income for the year 324,980 205,281 Total comprehensive income attributable to Council 325,049 205,229 Total comprehensive income attributable to non-controlling interests (69) 52 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Tamworth Regional Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 90";

export const TAMWORTH_POSITION_TEXT =
  "Tamworth Regional Council | Statement of Financial Position | as at 30 June 2026 §Statement§ $ '000 Notes 2026 2025 ASSETS Current assets Cash and cash equivalents C1-1 28,527 22,103 Investments C1-2 217,633 181,993 Receivables C1-4 22,375 22,949 Inventories C1-5 25,536 23,939 Contract assets and contract cost assets C1-6 5,552 7,731 Non-current assets classified as held for sale C1-7 4,703 50 Other 595 729 Total current assets 304,921 259,494 Non-current assets Investments C1-2 21,006 15,088 Receivables C1-4 1,502 1,079 Infrastructure, property, plant and equipment (IPPE) C1-8 2,968,722 2,671,900 Investment property C1-9 26,980 25,260 Intangible assets C1-10 2,989 2,986 Right of use assets C2-1 3,275 3,187 Total non-current assets 3,024,474 2,719,500 Total assets 3,329,395 2,978,994 LIABILITIES Current liabilities Payables C3-1 21,715 19,596 Contract liabilities C3-2 26,224 9,053 Lease liabilities C2-1 1,416 1,517 Borrowings C3-3 10,012 10,857 Employee benefit provisions C3-4 13,669 13,056 Provisions C3-5 9 2 Total current liabilities 73,045 54,081 Non-current liabilities Lease liabilities C2-1 1,969 1,829 Borrowings C3-3 55,767 56,380 Employee benefit provisions C3-4 523 494 Provisions C3-5 26,442 19,541 Total non-current liabilities 84,701 78,244 Total liabilities 157,746 132,325 Net assets 3,171,649 2,846,669 EQUITY Accumulated surplus 1,519,266 1,497,955 IPPE revaluation surplus C4-1 1,651,735 1,347,997 Council equity interest 3,171,001 2,845,952 Non-controlling equity interests D2-1 648 717 Total equity 3,171,649 2,846,669 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Tamworth Regional Council Statement of Financial Position as at 30 June 2026 Page 6 of 90";

export const TAMWORTH_EQUITY_TEXT =
  "Tamworth Regional Council | Statement of Changes in Equity | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 $ '000 Notes Accumulated surplus IPPE revaluation surplus Non- controlling interest Total equity Accumulated surplus IPPE revaluation surplus Non- controlling interest Total equity Opening balance at 1 July 1,497,955 1,347,997 717 2,846,669 1,426,981 1,213,742 665 2,641,388 Restated opening balance 1,497,955 1,347,997 717 2,846,669 1,426,981 1,213,742 665 2,641,388 §Subnote§ Net operating result for the year 21,311 – (69) 21,242 70,974 – 52 71,026 Restated net operating result for the period 21,311 – (69) 21,242 70,974 – 52 71,026 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-8 – 303,738 – 303,738 – 134,255 – 134,255 Other comprehensive income – 303,738 – 303,738 – 134,255 – 134,255 Total comprehensive income 21,311 303,738 (69) 324,980 70,974 134,255 52 205,281 Closing balance at 30 June 1,519,266 1,651,735 648 3,171,649 1,497,955 1,347,997 717 2,846,669 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Tamworth Regional Council Statement of Changes in Equity for the year ended 30 June 2026 Page 7 of 90";

export const TAMWORTH_CASH_TEXT =
  "Tamworth Regional Council | Statement of Cash Flows | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Cash flows from operating activities Receipts: 102,695 Rates and annual charges 102,672 95,056 54,632 User charges and fees 67,638 58,237 9,156 Interest received 11,520 11,212 70,421 Grants and contributions 75,221 44,891 – Bonds, deposits and retentions received 1,719 1,917 18,814 Other 17,025 14,351 Payments: (73,652) Payments to employees (71,184) (65,322) (72,889) Payments for materials and services (88,152) (79,797) (2,850) Borrowing costs (2,897) (3,324) – Bonds, deposits and retentions refunded (1,756) (1,636) (4,865) Other (5,039) (6,271) 101,462 Net cash flows from operating activities G1-1 106,767 69,314 Cash flows from investing activities Receipts: – Sale of investments 123,000 170,000 5,767 Sale of real estate assets 3,364 6,078 – Proceeds from sale of IPPE 1,530 2,348 Payments: (997) Purchase of investments (164,558) (194,125) (147,407) Payments for IPPE (57,564) (50,632) – Purchase of real estate assets (2,620) (4,608) – Purchase of intangible assets (80) (80) – Deferred debtors and advances made (441) (440) (142,637) Net cash flows from investing activities (97,369) (71,459) Cash flows from financing activities Receipts: 51,045 Proceeds from borrowings 10,399 2,000 Payments: (9,870) Repayment of borrowings (11,857) (9,500) – Principal component of lease payments (1,516) (1,457) 41,175 Net cash flows from financing activities (2,974) (8,957) – Net change in cash and cash equivalents 6,424 (11,102) 22,103 Cash and cash equivalents at beginning of year 22,103 33,205 22,103 Cash and cash equivalents at end of year C1-1 28,527 22,103 180,335 plus: Investments on hand at end of year C1-2 238,639 197,081 202,438 Total cash, cash equivalents and investments 267,166 219,184 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Tamworth Regional Council Statement of Cash Flows for the year ended 30 June 2026 Page 8 of 90";

export const TAMWORTH_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Total assets held (current and non-current) $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Our Water Security 65,845 96,817 43,862 51,817 21,983 45,000 4,948 38,457 926,796 897,685 A Liveable Built Environment 23,031 13,190 15,807 18,482 7,224 (5,292) 19,840 10,422 187,857 159,294 Prosperity and Innovation 10,879 11,226 17,986 18,202 (7,107) (6,976) 237 832 176,766 164,566 Resilient and Diverse Communities 3,263 4,470 10,730 12,709 (7,467) (8,239) 1,784 3,605 66,251 64,914 Connecting our Region and its Citizens 30,523 45,358 66,042 59,577 (35,519) (14,219) 8,870 30,370 1,434,853 1,175,395 Working with and Protecting Our Environment 22,873 32,696 27,890 25,344 (5,017) 7,352 (1,034) 10,813 406,466 399,557 Celebrate our Cultures and Heritage 2,570 2,417 6,600 7,068 (4,030) (4,651) 576 397 16,632 15,568 A Strong and Vibrant Identity 942 6,158 9,572 2,226 (8,630) 3,932 – 54 959 49 Open and Collaborative Leadership 2,397 2,023 32,736 11,624 (30,339) (9,601) 277 69 112,815 101,966 General Purpose Income 90,144 63,720 – – 90,144 63,720 28,856 9,196 – – Total functions and activities 252,467 278,075 231,225 207,049 21,242 71,026 64,354 104,215 3,329,395 2,978,994 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 90 Tamworth Regional Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function tamworthExtraction(): PdfExtraction {
  return {
    source: {
      sha256: TAMWORTH_FS_PDF_SHA256,
      bytes: TAMWORTH_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(TAMWORTH_INCOME_TEXT, 5),
      pdfPage(TAMWORTH_COMPREHENSIVE_TEXT, 6),
      pdfPage(TAMWORTH_POSITION_TEXT, 7),
      pdfPage(TAMWORTH_EQUITY_TEXT, 8),
      pdfPage(TAMWORTH_CASH_TEXT, 9),
      pdfPage(TAMWORTH_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const TAMWORTH_CONTEXT: TamworthGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2025-26',
    title: 'Annual Financial Statements for the year ended 30 June 2026',
    url: TAMWORTH_FS_PDF_URL,
    fiscal_year: TAMWORTH_GPFS_FISCAL_YEAR,
    listing_url: TAMWORTH_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'tamworth-gpfs/Annual Financial Statements - 2026.pdf.aspx',
    sha256: TAMWORTH_FS_PDF_SHA256,
    bytes: TAMWORTH_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: TAMWORTH_GPFS_REPORTING_URL,
};

/** 17 printed rows: 7 revenue + 8 expense (including the total bridge) + 1 result. */
export const TAMWORTH_GPFS_ROW_COUNT = 17;
export const TAMWORTH_GPFS_GOLDEN_DIGEST =
  '96c0cdb9a6bffa5629c08be65629e9726e733219c6a1ce4741601c523586d68c';
export const ROW_COUNT = TAMWORTH_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = TAMWORTH_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseTamworthGpfsExtraction(tamworthExtraction(), TAMWORTH_CONTEXT).records;
}
