import {
  WAGGA_WAGGA_GPFS_FISCAL_YEAR,
  WAGGA_WAGGA_GPFS_REPORTING_URL,
  parseWaggaWaggaGpfsExtraction,
  type WaggaWaggaGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Wagga Wagga City Council Annual
// Financial Statements for the year ended 30 June 2026 (117-page PDF; the GPFS
// primary statements are extraction pages 6-10 and B1-1 is page 15). These
// reproduce the printed $'000 values used by the zero-tolerance reconciliation.
export const WAGGA_WAGGA_FS_PDF_URL =
  'https://wagga.nsw.gov.au/imagesfiles/documents/the-council/planning-and-reporting/financial-statements/Annual-Financial-Statements-2025-26.pdf';
export const WAGGA_WAGGA_FS_PDF_SHA256 =
  'c6c8c61dc33bc1524368da75492338d2fbee2629f98ad80986463ebf3b8125eb';
export const WAGGA_WAGGA_FS_PDF_BYTES = 5880591;

export const WAGGA_WAGGA_INCOME_TEXT =
  "Wagga Wagga City Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 87,771 Rates and annual charges B2-1 86,929 82,801 36,431 User charges and fees B2-2 40,403 36,975 3,709 Other revenues B2-3 3,892 5,190 15,211 Grants and contributions provided for operating purposes B2-4 22,194 16,079 55,260 Grants and contributions provided for capital purposes B2-4 60,455 46,031 8,514 Interest and investment income B2-5 13,151 12,754 1,728 Other income B2-6 2,387 2,913 208,624 Total income from continuing operations 229,411 202,743 Expenses from continuing operations 62,134 Employee benefits and on-costs B3-1 58,498 55,969 45,965 Materials and services B3-2 50,808 50,609 2,678 Borrowing costs B3-3 2,876 3,220 2,148 Other expenses B3-5 2,521 1,998 – Net loss from the disposal of assets B4-1 5,104 10,081 112,925 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 119,807 121,877 95,699 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 109,604 80,866 50,925 Depreciation, amortisation and impairment of non-financial assets B3-4 54,595 52,042 44,774 Operating result from continuing operations 55,009 28,824 44,774 Net operating result for the year attributable to Council 55,009 28,824 (10,487) Net operating result for the year before grants and contributions provided for capital purposes (5,446) (17,207) The above Income Statement should be read in conjunction with the accompanying notes. Wagga Wagga City Council Income Statement for the year ended 30 June 2026 Page 5";

export const WAGGA_WAGGA_COMPREHENSIVE_TEXT =
  "Wagga Wagga City Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 55,009 28,824 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 118,720 214,297 Total amounts which will not be reclassified subsequent to operating result 118,720 214,297 Total other comprehensive income for the year 118,720 214,297 Total comprehensive income for the year attributable to Council 173,729 243,121 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Wagga Wagga City Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6";

export const WAGGA_WAGGA_POSITION_TEXT =
  "Wagga Wagga City Council | Statement of Financial Position | as at 30 June 2026 §Statement§ $ '000 Notes 2026 2025 ASSETS Current assets Cash and cash equivalents C1-1 126,700 93,747 Investments C1-2 75,459 84,000 Receivables C1-4 17,969 17,007 Inventories C1-5 2,531 2,077 Contract assets and contract cost assets C1-6 1,292 4,555 Other C1-9 2,300 2,489 Total current assets 226,251 203,875 Non-current assets Investments C1-2 135,913 131,342 Receivables C1-4 1,533 1,533 Infrastructure, property, plant and equipment (IPPE) C1-7 2,519,575 2,371,140 Investment property C1-8 5,750 5,440 Right of use assets C2-1 1,432 1,835 Total non-current assets 2,664,203 2,511,290 Total assets 2,890,454 2,715,165 LIABILITIES Current liabilities Payables C3-1 20,685 21,672 Contract liabilities C3-2 69,520 64,039 Lease liabilities C2-1 362 375 Borrowings C3-3 6,193 6,142 Employee benefit provisions C3-4 14,541 14,085 Provisions C3-5 1,758 1,513 Total current liabilities 113,059 107,826 Non-current liabilities Lease liabilities C2-1 278 640 Borrowings C3-3 36,738 40,091 Employee benefit provisions C3-4 865 667 Provisions C3-5 933 1,089 Total non-current liabilities 38,814 42,487 Total liabilities 151,873 150,313 Net assets 2,738,581 2,564,852 EQUITY Accumulated surplus C4-1 1,169,731 1,114,722 IPPE revaluation surplus C4-1 1,568,850 1,450,130 Council equity interest 2,738,581 2,564,852 Total equity 2,738,581 2,564,852 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Wagga Wagga City Council Statement of Financial Position as at 30 June 2026 Page 7";

export const WAGGA_WAGGA_EQUITY_TEXT =
  "Wagga Wagga City Council | Statement of Changes in Equity | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 1,114,722 1,450,130 2,564,852 1,085,898 1,235,833 2,321,731 §Subnote§ Net operating result for the year 55,009 – 55,009 28,824 – 28,824 Net operating result for the period 55,009 – 55,009 28,824 – 28,824 Other comprehensive income Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-7 – 118,720 118,720 – 214,297 214,297 Other comprehensive income – 118,720 118,720 – 214,297 214,297 Total comprehensive income 55,009 118,720 173,729 28,824 214,297 243,121 Closing balance at 30 June 1,169,731 1,568,850 2,738,581 1,114,722 1,450,130 2,564,852 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Wagga Wagga City Council Statement of Changes in Equity for the year ended 30 June 2026 Page 8";

export const WAGGA_WAGGA_CASH_TEXT =
  "Wagga Wagga City Council | Statement of Cash Flows | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Cash flows from operating activities Receipts: 87,559 Rates and annual charges 88,256 82,595 36,259 User charges and fees 44,060 39,213 8,943 Interest received 12,929 11,814 68,960 Grants and contributions 62,298 50,336 – Bonds, deposits and retentions received – 191 4,612 Other 9,751 15,397 Payments: (62,134) Payments to employees (57,779) (54,750) (45,919) Payments for materials and services (56,544) (53,434) (2,678) Borrowing costs (2,892) (3,240) – Bonds, deposits and retentions refunded (132) – (2,148) Other (7,071) (9,747) 93,454 Net cash provided from/(or used in) operating activities G1-1 92,876 78,375 Cash flows from investing activities Receipts: 38,864 Sale of investments 16,165 21,637 – Redemption of term deposits 70,000 49,000 1,427 Proceeds from sale of IPPE 1,346 1,528 Payments: (10,000) Purchase of investments (6,850) (12,649) – Acquisition of term deposits (75,000) (74,000) (113,248) Payments for IPPE (61,906) (54,022) (82,957) Net cash provided from/(or used in) investing activities (56,245) (68,506) Cash flows from financing activities Receipts: 8,937 Proceeds from borrowings 2,839 – Payments: (6,224) Repayment of borrowings (6,141) (6,453) (362) Principal component of lease payments (376) (364) 2,351 Net cash flow provided from/(or used in) financing activities (3,678) (6,817) 12,848 Net change in cash and cash equivalents 32,953 3,052 30,744 Cash and cash equivalents at beginning of year 93,747 90,695 43,592 Cash and cash equivalents at end of year C1-1 126,700 93,747 190,832 plus: Investments on hand at end of year C1-2 211,372 215,342 234,424 Total cash, cash equivalents and investments 338,072 309,089 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Wagga Wagga City Council Statement of Cash Flows for the year ended 30 June 2026 Page 9";

export const WAGGA_WAGGA_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Regional Leadership 93,911 81,225 32,403 30,051 61,508 51,174 23,992 14,692 409,541 398,003 Sustainable 7,725 7,454 6,121 4,734 1,604 2,720 5,740 4,970 11,504 11,752 Growing 116,967 100,250 103,646 106,822 13,321 (6,572) 46,096 32,403 2,206,295 2,053,506 Vibrant 10,808 13,814 32,232 32,312 (21,424) (18,498) 6,821 10,045 263,114 251,904 Total functions and activities 229,411 202,743 174,402 173,919 55,009 28,824 82,649 62,110 2,890,454 2,715,165 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 Wagga Wagga City Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function waggaWaggaExtraction(): PdfExtraction {
  return {
    source: {
      sha256: WAGGA_WAGGA_FS_PDF_SHA256,
      bytes: WAGGA_WAGGA_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(WAGGA_WAGGA_INCOME_TEXT, 6),
      pdfPage(WAGGA_WAGGA_COMPREHENSIVE_TEXT, 7),
      pdfPage(WAGGA_WAGGA_POSITION_TEXT, 8),
      pdfPage(WAGGA_WAGGA_EQUITY_TEXT, 9),
      pdfPage(WAGGA_WAGGA_CASH_TEXT, 10),
      pdfPage(WAGGA_WAGGA_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const WAGGA_WAGGA_CONTEXT: WaggaWaggaGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2025-26',
    title: 'Annual Financial Statements for the year ended 30 June 2026',
    url: WAGGA_WAGGA_FS_PDF_URL,
    fiscal_year: WAGGA_WAGGA_GPFS_FISCAL_YEAR,
    listing_url: WAGGA_WAGGA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'wagga-wagga-gpfs/Annual-Financial-Statements-2025-26.pdf',
    sha256: WAGGA_WAGGA_FS_PDF_SHA256,
    bytes: WAGGA_WAGGA_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: WAGGA_WAGGA_GPFS_REPORTING_URL,
};

/** 17 printed rows: 7 revenue + 8 expense (including the total bridge) + 1 result. */
export const WAGGA_WAGGA_GPFS_ROW_COUNT = 17;
export const WAGGA_WAGGA_GPFS_GOLDEN_DIGEST =
  'bbf930da5026126681e5307ab2fb5ee55a4e6bb3caf42da5968536bc2be32508';
export const ROW_COUNT = WAGGA_WAGGA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = WAGGA_WAGGA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseWaggaWaggaGpfsExtraction(waggaWaggaExtraction(), WAGGA_WAGGA_CONTEXT).records;
}
