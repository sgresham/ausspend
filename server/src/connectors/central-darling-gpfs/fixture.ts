import {
  CENTRAL_DARLING_GPFS_FISCAL_YEAR,
  CENTRAL_DARLING_GPFS_REPORTING_URL,
  parseCentralDarlingGpfsExtraction,
  type CentralDarlingGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Banked text from the official Central Darling Shire Council separate audited
// General Purpose Financial Statements for the year ended 30 June 2025
// (102-page PDF; the GPFS primary statements are PDF pages 6-10 and B1-1 is PDF
// page 15). These reproduce the printed $'000 values used by the zero-tolerance
// reconciliation. FY2024-25 is the latest available full audited GPFS as at
// 2026-11-20; the FY2025-26 document is a one-page presentation notice.
export const CENTRAL_DARLING_FS_PDF_URL =
  'https://www.centraldarling.nsw.gov.au/files/assets/public/v/1/finance-2025/financial-statements/cdsc-annual_financial_statements-2025-olg.pdf';
export const CENTRAL_DARLING_FS_PDF_SHA256 =
  'b583822dce9f5bac927d04dd60455f1de058f8542f990817839e3ed03c53b5c6';
export const CENTRAL_DARLING_FS_PDF_BYTES = 3_386_192;

export const CENTRAL_DARLING_INCOME_TEXT = "Central Darling Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 2,592 Rates and annual charges B2-1 2,547 2,498 8,477 User charges and fees B2-2 5,820 6,596 434 Other revenues B2-3 865 1,134 12,297 Grants and contributions provided for operating purposes B2-4 15,844 27,504 12,109 Grants and contributions provided for capital purposes B2-4 6,835 14,191 97 Interest and investment income B2-5 180 144 – Other income B2-6 44 31 36,006 Total income from continuing operations 32,135 52,098 Expenses from continuing operations 7,070 Employee benefits and on-costs B3-1 7,372 7,021 8,174 Materials and services B3-2 20,804 23,443 40 Borrowing costs B3-3 75 23 2,885 Other expenses B3-5 626 548 – Net loss from the disposal of assets B4-1 1,932 376 18,169 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 30,809 31,411 17,837 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 1,326 20,687 5,713 Depreciation, amortisation and impairment of non-financial assets B3-4 7,041 6,657 12,124 Operating result from continuing operations (5,715) 14,030 12,124 Net operating result for the year attributable to Council (5,715) 14,030 15 Net operating result for the year before grants and contributions provided for capital purposes (12,550) (161) The above Income Statement should be read in conjunction with the accompanying notes. Central Darling Shire Council Income Statement for the year ended 30 June 2025 Page 5 of 77";

export const CENTRAL_DARLING_COMPREHENSIVE_TEXT = "Central Darling Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement (5,715) 14,030 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 28,893 13,281 Total items which will not be reclassified subsequent to operating result 28,893 13,281 Total other comprehensive income for the year 28,893 13,281 Total comprehensive income for the year attributable to Council 23,178 27,311 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Central Darling Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 77";

export const CENTRAL_DARLING_POSITION_TEXT = "Central Darling Shire Council | Statement of Financial Position | as at 30 June 2025 §Statement§ $ '000 Notes 2025 2024 ASSETS Current assets Cash and cash equivalents C1-1 10,435 14,734 Receivables C1-3 6,923 13,201 Inventories C1-4 1,001 768 Total current assets 18,359 28,703 Non-current assets Receivables C1-3 114 165 Infrastructure, property, plant and equipment (IPPE) C1-5 284,214 250,389 Right of use assets C2-1 968 747 Investments accounted for using the equity method D2-1 559 806 Total non-current assets 285,855 252,107 Total assets 304,214 280,810 LIABILITIES Current liabilities Payables C3-1 2,678 3,979 Income received in advance C3-1 205 210 Contract liabilities C3-2 4,399 3,158 Lease liabilities C2-1 545 311 Employee benefit provisions C3-3 1,064 1,034 Total current liabilities 8,891 8,692 Non-current liabilities Lease liabilities C2-1 448 437 Employee benefit provisions C3-3 31 29 Provisions C3-4 517 503 Total non-current liabilities 996 969 Total liabilities 9,887 9,661 Net assets 294,327 271,149 EQUITY Accumulated surplus C4-1 181,150 186,865 IPPE revaluation surplus C4-1 113,177 84,284 Council equity interest 294,327 271,149 Total equity 294,327 271,149 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Central Darling Shire Council Statement of Financial Position as at 30 June 2025 Page 7 of 77";

export const CENTRAL_DARLING_EQUITY_TEXT = "Central Darling Shire Council | Statement of Changes in Equity | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 186,865 84,284 271,149 172,835 71,003 243,838 §Subnote§ Net operating result for the year (5,715) – (5,715) 14,030 – 14,030 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 – 28,893 28,893 – 13,281 13,281 Other comprehensive income – 28,893 28,893 – 13,281 13,281 Total comprehensive income (5,715) 28,893 23,178 14,030 13,281 27,311 Closing balance at 30 June 181,150 113,177 294,327 186,865 84,284 271,149 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Central Darling Shire Council Statement of Changes in Equity for the year ended 30 June 2025 Page 8 of 77";

export const CENTRAL_DARLING_CASH_TEXT = "Central Darling Shire Council | Statement of Cash Flows | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Cash flows from operating activities Receipts: 2,362 Rates and annual charges 2,453 2,430 6,782 User charges and fees 9,365 9,959 97 Interest received 192 144 24,406 Grants and contributions 24,202 47,111 – Bonds, deposits and retentions received 3 15 – Other - income statement movements 894 – – Other - balance sheet movements 3,111 – – Other - GST gross up 2,880 – Payments: (7,070) Payments to employees (8,287) (7,257) (8,011) Payments for materials and services (24,710) (28,816) (15) Borrowing costs (60) (43) – Bonds, deposits and retentions refunded – (5) – Other (300) (408) 18,551 Net cash flows from operating activities G1-1 9,743 23,130 Cash flows from investing activities Receipts: – Proceeds from sale of IPPE 161 4 Payments: (17,649) Payments for IPPE (13,668) (20,283) (17,649) Net cash flows from investing activities (13,507) (20,279) Cash flows from financing activities Payments: (450) Principal component of lease payments (535) (271) (450) Net cash flows from financing activities (535) (271) 452 Net change in cash and cash equivalents (4,299) 2,580 2,745 Cash and cash equivalents at beginning of year 14,734 12,154 3,197 Cash and cash equivalents at end of year C1-1 10,435 14,734 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Central Darling Shire Council Statement of Cash Flows for the year ended 30 June 2025 Page 9 of 77";

export const CENTRAL_DARLING_FUNCTIONS_TEXT = "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Governance 43 434 354 258 (311) 176 – 434 – – Administration 466 650 5,071 3,716 (4,605) (3,066) 50 – 8,436 17,529 Public order and safety 1,039 114 601 802 438 (688) 175 111 14,083 14,791 Health 2 – 19 86 (17) (86) – – 24 24 Environment 729 850 1,409 1,138 (680) (288) 332 238 1,406 1,382 Community services and education 108 42 96 157 12 (115) 189 33 2,603 2,280 Housing and community amenities 3,955 3,988 797 3,025 3,158 963 – 3,923 8,287 7,851 Water supplies 5,150 7,415 1,439 1,380 3,711 6,035 4,083 6,326 37,446 31,611 Sewerage services 347 369 281 399 66 (30) – – 7,371 7,122 Recreation and culture 240 769 1,676 1,336 (1,436) (567) 650 756 5,923 5,411 Transport and communications 13,054 27,850 24,809 24,458 (11,755) 3,392 8,258 22,160 216,990 191,215 Economic affairs 344 965 1,354 1,313 (1,010) (348) 3,240 27 1,645 1,594 General purpose income 6,714 8,652 – – 6,714 8,652 5,702 7,687 – – Total functions and activities 32,191 52,098 37,906 38,068 (5,715) 14,030 22,679 41,695 304,214 280,810 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 77 Central Darling Shire Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function centralDarlingExtraction(): PdfExtraction {
  return {
    source: {
      sha256: CENTRAL_DARLING_FS_PDF_SHA256,
      bytes: CENTRAL_DARLING_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(CENTRAL_DARLING_INCOME_TEXT, 6),
      pdfPage(CENTRAL_DARLING_COMPREHENSIVE_TEXT, 7),
      pdfPage(CENTRAL_DARLING_POSITION_TEXT, 8),
      pdfPage(CENTRAL_DARLING_EQUITY_TEXT, 9),
      pdfPage(CENTRAL_DARLING_CASH_TEXT, 10),
      pdfPage(CENTRAL_DARLING_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const CENTRAL_DARLING_CONTEXT: CentralDarlingGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2024-25',
    title:
      'Central Darling Shire Council General Purpose Financial Statements for the year ended 30 June 2025',
    url: CENTRAL_DARLING_FS_PDF_URL,
    fiscal_year: CENTRAL_DARLING_GPFS_FISCAL_YEAR,
    listing_url: CENTRAL_DARLING_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'central-darling-gpfs/central-darling-shire-council-annual_financial_statements-2025-olg.pdf',
    sha256: CENTRAL_DARLING_FS_PDF_SHA256,
    bytes: CENTRAL_DARLING_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: CENTRAL_DARLING_GPFS_REPORTING_URL,
};

/** 17 printed rows: 8 revenue (7 components + total) + 8 expense + 1 result. */
export const CENTRAL_DARLING_GPFS_ROW_COUNT = 17;
export const CENTRAL_DARLING_GPFS_GOLDEN_DIGEST =
  '5b38c55b5b133973e6097d342382b7acf787eae11ee70e05c2af5289e9efea08';
export const ROW_COUNT = CENTRAL_DARLING_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = CENTRAL_DARLING_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseCentralDarlingGpfsExtraction(centralDarlingExtraction(), CENTRAL_DARLING_CONTEXT)
    .records;
}
