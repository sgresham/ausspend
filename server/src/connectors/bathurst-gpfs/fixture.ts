import {
  BATHURST_GPFS_FISCAL_YEAR,
  BATHURST_GPFS_ANNUAL_PLAN_URL,
  parseBathurstGpfsExtraction,
  type BathurstGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Bathurst Regional Council Annual
// Financial Statements for the year ended 30 June 2025 (96-page PDF; the GPFS
// primary statements are extraction pages 6-10 and B1-1 is page 15). These
// reproduce the printed $'000 values used by the zero-tolerance reconciliation.
export const BATHURST_FS_PDF_URL =
  'https://www.bathurst.nsw.gov.au/files/assets/public/v/1/council/annual-plan/annual-financial-statements-2024-2025.pdf';
export const BATHURST_FS_PDF_SHA256 =
  '630f7efe25fecffcf48da454ec908d035ee09f1f37c855db3e26006ca890b8fc';
export const BATHURST_FS_PDF_BYTES = 2735544;

export const BATHURST_INCOME_TEXT =
  "Bathurst Regional Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 57,356 Rates and annual charges B2-1 60,216 55,346 31,724 User charges and fees B2-2 33,354 32,885 2,969 Other revenues 2,903 2,743 13,546 Grants and contributions provided for operating purposes B2-3 14,898 18,843 23,151 Grants and contributions provided for capital purposes B2-3 13,773 33,196 4,077 Interest and investment income 3,884 4,374 2,774 Other income 3,109 2,910 14,708 Net gain from the disposal of assets B4-1 4,857 – 1,067 Fair value increment on investment properties C1-7 468 815 151,372 Total income from continuing operations 137,462 151,112 Expenses from continuing operations 37,825 Employee benefits and on-costs B3-1 37,477 38,170 44,147 Materials and services B3-2 50,224 57,570 1,404 Borrowing costs 1,576 1,610 2,623 Other expenses 2,572 2,582 – Net loss from the disposal of assets B4-1 – 103 85,999 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 91,849 100,035 65,373 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 45,613 51,077 36,177 Depreciation, amortisation and impairment of non-financial assets B3-3 30,030 27,129 29,196 Operating result from continuing operations 15,583 23,948 29,196 Net operating result for the year attributable to Council 15,583 23,948 6,045 Net operating result for the year before grants and contributions provided for capital purposes 1,810 (9,248) The above Income Statement should be read in conjunction with the accompanying notes. Bathurst Regional Council Income Statement for the year ended 30 June 2025 Page 4 of 68";

export const BATHURST_COMPREHENSIVE_TEXT =
  "Bathurst Regional Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 15,583 23,948 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 139,970 84,699 Total items which will not be reclassified subsequent to operating result 139,970 84,699 Total other comprehensive income for the year 139,970 84,699 Total comprehensive income for the year attributable to Council 155,553 108,647 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Bathurst Regional Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 68";

export const BATHURST_POSITION_TEXT =
  "Bathurst Regional Council | Statement of Financial Position | as at 30 June 2025 §Statement§ $ '000 Notes 2025 2024 ASSETS Current assets Cash and cash equivalents C1-1 15,158 14,983 Investments C1-2 46,550 41,000 Receivables C1-4 15,410 12,935 Inventories C1-5 7,501 5,379 Contract assets and contract cost assets 1,427 3,151 Other 415 1,635 Total current assets 86,461 79,083 Non-current assets Investments C1-2 19,150 17,800 Receivables C1-4 510 505 Inventories C1-5 11,546 11,403 Infrastructure, property, plant and equipment (IPPE) C1-6 1,991,431 1,845,521 Investment property C1-7 22,733 22,265 Right of use assets 200 192 Total non-current assets 2,045,570 1,897,686 Total assets 2,132,031 1,976,769 LIABILITIES Current liabilities Payables C3-1 14,335 13,317 Contract liabilities C3-2 7,391 2,860 Lease liabilities 54 68 Borrowings C3-3 10,610 13,925 Employee benefit provisions C3-4 11,758 11,623 Provisions C3-5 67 82 Total current liabilities 44,215 41,875 Non-current liabilities Payables C3-1 757 895 Lease liabilities 161 135 Borrowings C3-3 19,968 21,424 Employee benefit provisions C3-4 581 426 Provisions C3-5 2,031 3,249 Total non-current liabilities 23,498 26,129 Total liabilities 67,713 68,004 Net assets 2,064,318 1,908,765 EQUITY Accumulated surplus 741,348 725,765 IPPE revaluation surplus 1,322,970 1,183,000 Council equity interest 2,064,318 1,908,765 Total equity 2,064,318 1,908,765 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Bathurst Regional Council Statement of Financial Position as at 30 June 2025 Page 6 of 68";

export const BATHURST_EQUITY_TEXT =
  "Bathurst Regional Council | Statement of Changes in Equity | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 725,765 1,183,000 1,908,765 701,817 1,098,301 1,800,118 §Subnote§ Net operating result for the year 15,583 – 15,583 23,948 – 23,948 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 – 139,970 139,970 – 84,699 84,699 Other comprehensive income – 139,970 139,970 – 84,699 84,699 Total comprehensive income 15,583 139,970 155,553 23,948 84,699 108,647 Closing balance at 30 June 741,348 1,322,970 2,064,318 725,765 1,183,000 1,908,765 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Bathurst Regional Council Statement of Changes in Equity for the year ended 30 June 2025 Page 7 of 68";

export const BATHURST_CASH_TEXT =
  "Bathurst Regional Council | Statement of Cash Flows | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Cash flows from operating activities Receipts: 56,945 Rates and annual charges 59,759 54,983 31,594 User charges and fees 34,292 34,513 4,077 Interest received 3,900 4,618 36,973 Grants and contributions 32,433 30,940 – Bonds, deposits and retentions received 450 511 4,677 Other 11,427 22,142 Payments: (37,514) Payments to employees (36,719) (38,864) (59,815) Payments for materials and services (58,815) (69,677) (1,404) Borrowing costs (1,585) (1,619) (2,220) Other (2,685) (2,997) 33,313 Net cash flows from operating activities G1-1 42,457 34,550 Cash flows from investing activities Receipts: 155,645 Sale of investments 90,000 73,550 24,000 Sale of real estate assets 5,515 322 805 Proceeds from sale of IPPE 1,077 984 – Deferred debtors receipts 61 52 Payments: (152,520) Purchase of investments (97,900) (74,050) (5,000) Acquisition of term deposits 1,000 32,550 (44,292) Payments for IPPE (34,636) (55,003) (134) Purchase of real estate assets (2,551) (960) (21,496) Net cash flows from investing activities (37,434) (22,555) Cash flows from financing activities Receipts: 350 Proceeds from borrowings 350 700 Payments: (5,101) Repayment of borrowings (5,121) (5,290) (50) Principal component of lease payments (77) (69) (4,801) Net cash flows from financing activities (4,848) (4,659) 7,016 Net change in cash and cash equivalents 175 7,336 7,016 Cash and cash equivalents at end of year C1-1 15,158 14,983 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Bathurst Regional Council Statement of Cash Flows for the year ended 30 June 2025 Page 8 of 68";

export const BATHURST_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Governance – – 4,333 3,855 (4,333) (3,855) – – 38 56 Administration 1,484 1,333 17,770 16,296 (16,286) (14,963) 567 15 157,712 52,898 Public order and safety 663 567 3,573 3,109 (2,910) (2,542) 482 464 15,984 15,704 Environment 15,330 14,834 14,614 13,219 716 1,615 537 913 220,141 231,465 Community services and education 3,356 2,831 3,004 2,578 352 253 2,670 2,237 14,719 14,294 Housing and community amenities 328 272 2,934 3,318 (2,606) (3,046) 189 37 8,044 8,001 Water supplies 25,922 26,505 13,126 12,509 12,796 13,996 5,056 7,349 359,816 370,980 Sewerage services 19,515 20,403 12,364 10,340 7,151 10,063 921 1,843 171,009 215,869 Recreation and culture 11,185 14,115 25,364 25,715 (14,179) (11,600) 5,126 4,272 334,850 325,457 Mining, manufacturing and construction 1,216 1,032 1,573 1,659 (357) (627) – 25 290 287 Transport and communication 8,340 23,189 18,200 29,363 (9,860) (6,174) 5,116 24,431 816,225 715,274 Economic affairs 12,062 5,175 5,024 5,203 7,038 (28) 3,038 3,268 33,203 26,843 General Purpose Revenues 38,061 40,856 – – 38,061 40,856 4,969 7,185 – – Other – – – – – – – – – (359) Total functions and activities 137,462 151,112 121,879 127,164 15,583 23,948 28,671 52,039 2,132,031 1,976,769 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 68 Bathurst Regional Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function bathurstExtraction(): PdfExtraction {
  return {
    source: {
      sha256: BATHURST_FS_PDF_SHA256,
      bytes: BATHURST_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(BATHURST_INCOME_TEXT, 6),
      pdfPage(BATHURST_COMPREHENSIVE_TEXT, 7),
      pdfPage(BATHURST_POSITION_TEXT, 8),
      pdfPage(BATHURST_EQUITY_TEXT, 9),
      pdfPage(BATHURST_CASH_TEXT, 10),
      pdfPage(BATHURST_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BATHURST_CONTEXT: BathurstGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2024-25',
    title: 'Annual Financial Statements for the year ended 30 June 2025',
    url: BATHURST_FS_PDF_URL,
    fiscal_year: BATHURST_GPFS_FISCAL_YEAR,
    listing_url: BATHURST_GPFS_ANNUAL_PLAN_URL,
  },
  archive: {
    local_path: 'bathurst-gpfs/annual-financial-statements-2024-2025.pdf',
    sha256: BATHURST_FS_PDF_SHA256,
    bytes: BATHURST_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: BATHURST_GPFS_ANNUAL_PLAN_URL,
};

/** 18 printed rows: 9 revenue + 8 expense (including the total bridge) + 1 result. */
export const BATHURST_GPFS_ROW_COUNT = 18;
export const BATHURST_GPFS_GOLDEN_DIGEST =
  'cb89b8e57f9765edc45dd53789449db90d9d658546da97e77e54171124971275';
export const ROW_COUNT = BATHURST_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BATHURST_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseBathurstGpfsExtraction(bathurstExtraction(), BATHURST_CONTEXT).records;
}
