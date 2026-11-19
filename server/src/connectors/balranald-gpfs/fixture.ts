import {
  BALRANALD_GPFS_FISCAL_YEAR,
  BALRANALD_GPFS_REPORTING_URL,
  parseBalranaldGpfsExtraction,
  type BalranaldGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Balranald Shire Council Annual
// Financial Statements for the year ended 30 June 2026 (108-page PDF; the GPFS
// primary statements are PDF pages 6-10 and B1-1 is PDF page 15). These
// reproduce the printed $'000 values used by the zero-tolerance reconciliation.
export const BALRANALD_FS_PDF_URL =
  'https://balranald.nsw.gov.au/wp-content/uploads/2026/11/Balranald-Annual_Financial_Statements-2026-OLG.pdf';
export const BALRANALD_FS_PDF_SHA256 =
  'd7c10c675385d2376ddccae430b08087f25d491a34f6a3695a86e9d807b169fd';
export const BALRANALD_FS_PDF_BYTES = 2_920_220;

export const BALRANALD_INCOME_TEXT =
  "Balranald Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 6,119 Rates and annual charges B2-1 6,248 5,974 1,448 User charges and fees B2-2 2,554 2,670 880 Other revenues B2-3 674 489 9,252 Grants and contributions provided for operating purposes B2-4 16,394 11,269 1,895 Grants and contributions provided for capital purposes B2-4 5,490 7,024 1,208 Interest and investment income B2-5 1,391 1,563 475 Other income B2-6 143 139 21,277 Total income from continuing operations 32,894 29,128 Expenses from continuing operations 7,777 Employee benefits and on-costs B3-1 8,802 7,277 6,743 Materials and services B3-2 7,723 10,084 77 Borrowing costs B3-3 71 79 603 Other expenses B3-5 685 556 – Net loss from the disposal of assets B4-1 19 15 – Net share of interests in joint ventures and associates using the equity method D2 15 247 15,200 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 17,315 18,258 6,077 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 15,579 10,870 6,015 Depreciation, amortisation and impairment of non-financial assets B3-4 7,265 6,737 62 Operating result from continuing operations 8,314 4,133 62 Net operating result for the year attributable to Council 8,314 4,133 (1,833) Net operating result for the year before grants and contributions provided for capital purposes 2,824 (2,891) The above Income Statement should be read in conjunction with the accompanying notes. Balranald Shire Council Income Statement for the year ended 30 June 2026 Page 5 of 84";

export const BALRANALD_COMPREHENSIVE_TEXT =
  "Balranald Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 8,314 4,133 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 12,493 30,435 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-6 – 2,540 Total items which will not be reclassified subsequent to operating result 12,493 32,975 Total other comprehensive income for the year 12,493 32,975 Total comprehensive income for the year attributable to Council 20,807 37,108 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Balranald Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6 of 84";

export const BALRANALD_POSITION_TEXT =
  "Balranald Shire Council | Statement of Financial Position | as at 30 June 2026 §Statement§ 2026 2025 Notes $ '000 $ '000 ASSETS Current assets Cash and cash equivalents C1-1 3,049 11,819 Investments C1-2 34,500 20,500 Receivables C1-4 6,403 4,396 Inventories C1-5 274 320 Total current assets 44,226 37,035 Non-current assets Receivables C1-4 214 139 Infrastructure, property, plant and equipment (IPPE) C1-6 293,032 277,701 Investments accounted for using the equity method D2 544 559 Total non-current assets 293,790 278,399 Total assets 338,016 315,434 LIABILITIES Current liabilities Payables C3-1 3,625 3,286 Contract liabilities C3-2 2,843 2,808 Borrowings C3-3 293 240 Employee benefit provisions C3-4 1,079 962 Total current liabilities 7,840 7,296 Non-current liabilities Borrowings C3-3 2,165 958 Employee benefit provisions C3-4 173 149 Provisions C3-5 170 170 Total non-current liabilities 2,508 1,277 Total liabilities 10,348 8,573 Net assets 327,668 306,861 EQUITY Accumulated surplus 87,916 79,602 IPPE revaluation surplus C4-1 239,752 227,259 Council equity interest 327,668 306,861 Total equity 327,668 306,861 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Balranald Shire Council Statement of Financial Position as at 30 June 2026 Page 7 of 84";

export const BALRANALD_EQUITY_TEXT =
  "Balranald Shire Council | Statement of Changes in Equity | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Notes $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Opening balance at 1 July 79,602 227,259 306,861 75,469 194,284 269,753 §Subnote§ Net operating result for the year 8,314 – 8,314 4,133 – 4,133 Net operating result for the period 8,314 – 8,314 4,133 – 4,133 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 – 12,493 12,493 – 30,435 30,435 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-6 – – – – 2,540 2,540 Other comprehensive income – 12,493 12,493 – 32,975 32,975 Total comprehensive income 8,314 12,493 20,807 4,133 32,975 37,108 Closing balance at 30 June 87,916 239,752 327,668 79,602 227,259 306,861 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Balranald Shire Council Statement of Changes in Equity for the year ended 30 June 2026 Page 8 of 84";

export const BALRANALD_CASH_TEXT =
  "Balranald Shire Council | Statement of Cash Flows | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Cash flows from operating activities Receipts: 6,119 Rates and annual charges 6,183 5,851 1,448 User charges and fees 2,769 2,947 1,208 Interest received 1,161 1,877 11,147 Grants and contributions 19,766 16,065 – Bonds, deposits and retentions received 6 6 1,355 Other 2,534 2,090 Payments: (7,777) Payments to employees (9,168) (7,032) (6,743) Payments for materials and services (8,737) (10,961) (77) Borrowing costs (69) (80) – Bonds, deposits and retentions refunded (3) (283) (603) Other (325) (1,147) 6,077 Net cash flows from operating activities G1-1 14,117 9,333 Cash flows from investing activities Receipts: – Sale of investments 5,500 11,500 – Proceeds from sale of IPPE 145 132 Payments: – Purchase of investments (19,500) (2,500) (16,352) Payments for IPPE (10,292) (11,752) (16,352) Net cash flows from investing activities (24,147) (2,620) Cash flows from financing activities Receipts: 1,500 Proceeds from borrowings 1,500 – Payments: (240) Repayment of borrowings (240) (227) 1,260 Net cash flows from financing activities 1,260 (227) (9,015) Net change in cash and cash equivalents (8,770) 6,486 11,819 Cash and cash equivalents at beginning of year 11,819 5,333 2,804 Cash and cash equivalents at end of year C1-1 3,049 11,819 20,000 plus: Investments on hand at end of year C1-2 34,500 20,500 22,804 Total cash, cash equivalents and investments 37,549 32,319 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Balranald Shire Council Statement of Cash Flows for the year ended 30 June 2026 Page 9 of 84";

export const BALRANALD_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Our Community 5,071 7,912 6,320 5,526 (1,249) 2,386 3,674 4,098 13,043 11,876 Our Council 10 – 274 259 (264) (259) 10 1 – – Our Economy 11,510 8,292 3,388 2,666 8,122 5,626 6,163 9 36,603 29,810 Our Environment 1,345 993 2,262 1,785 (917) (792) 473 59 322 239 Our Infrastructure 14,628 10,885 10,983 13,438 3,645 (2,553) 11,255 8,654 268,677 255,342 Our Lifestyle 330 1,046 1,338 1,074 (1,008) (28) 309 5,472 18,827 17,608 FSWJO – – 15 247 (15) (247) – – 544 559 Total functions and activities 32,894 29,128 24,580 24,995 8,314 4,133 21,884 18,293 338,016 315,434 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 84 Balranald Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function balranaldExtraction(): PdfExtraction {
  return {
    source: {
      sha256: BALRANALD_FS_PDF_SHA256,
      bytes: BALRANALD_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(BALRANALD_INCOME_TEXT, 6),
      pdfPage(BALRANALD_COMPREHENSIVE_TEXT, 7),
      pdfPage(BALRANALD_POSITION_TEXT, 8),
      pdfPage(BALRANALD_EQUITY_TEXT, 9),
      pdfPage(BALRANALD_CASH_TEXT, 10),
      pdfPage(BALRANALD_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BALRANALD_CONTEXT: BalranaldGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2025-26',
    title: 'Balranald Shire Council Annual Financial Statements for the year ended 30 June 2026',
    url: BALRANALD_FS_PDF_URL,
    fiscal_year: BALRANALD_GPFS_FISCAL_YEAR,
    listing_url: BALRANALD_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'balranald-gpfs/Balranald-Annual_Financial_Statements-2026-OLG.pdf',
    sha256: BALRANALD_FS_PDF_SHA256,
    bytes: BALRANALD_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: BALRANALD_GPFS_REPORTING_URL,
};

/** 18 printed rows: 8 revenue (7 components + total) + 9 expense + 1 result. */
export const BALRANALD_GPFS_ROW_COUNT = 18;
export const BALRANALD_GPFS_GOLDEN_DIGEST =
  'e87c58b0726415795a3f52ddd780d086580b98760c5022600c085abaf09dba3a';
export const ROW_COUNT = BALRANALD_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BALRANALD_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseBalranaldGpfsExtraction(balranaldExtraction(), BALRANALD_CONTEXT).records;
}
