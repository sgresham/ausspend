import {
  OBERON_GPFS_FISCAL_YEAR,
  OBERON_GPFS_REPORTING_URL,
  parseOberonGpfsExtraction,
  type OberonGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Banked text from the official Oberon Council separate audited General Purpose
// Financial Statements for the year ended 30 June 2025 (80-page PDF; the GPFS
// primary statements are PDF pages 4-8 and B1-1 is PDF page 13). These reproduce
// the printed $'000 values used by the zero-tolerance reconciliation. FY2024-25
// is the latest available full audited GPFS as at 2026-11-20.
export const OBERON_FS_PDF_URL =
  'https://haveyoursay.oberon.nsw.gov.au/104015/widgets/476199/documents/318527';
export const OBERON_FS_PDF_SHA256 =
  'ef24ded09ec28724e7b622f97860685c606eeec42b6b31f38b59088ac866a630';
export const OBERON_FS_PDF_BYTES = 7_118_843;

export const OBERON_INCOME_TEXT = "Oberon Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 7,787 Rates and annual charges B2-1 7,429 7,057 4,779 User charges and fees B2-2 4,685 7,187 223 Other revenues B2-3 381 342 4,164 Grants and contributions provided for operating purposes B2-4 4,030 7,578 9,412 Grants and contributions provided for capital purposes B2-4 10,757 11,157 570 Interest and investment income B2-5 1,363 1,356 460 Other income B2-6 302 463 27,395 Total income from continuing operations 28,947 35,140 Expenses from continuing operations 8,097 Employee benefits and on-costs B3-1 8,385 7,977 6,935 Materials and services B3-2 6,956 9,340 87 Borrowing costs B3-3 167 144 836 Other expenses B3-5 708 715 – Net loss from the disposal of assets B4-1 2,390 3,182 15,955 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 18,606 21,358 11,440 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 10,341 13,782 4,650 Depreciation, amortisation and impairment of non-financial assets B3-4 7,216 6,398 6,790 Operating result from continuing operations 3,125 7,384 6,790 Net operating result for the year attributable to Council 3,125 7,384 (2,622) Net operating result for the year before grants and contributions provided for capital purposes (7,632) (3,773) The above Income Statement should be read in conjunction with the accompanying notes. Oberon Council Income Statement for the year ended 30 June 2025 Page 4 of 80";

export const OBERON_COMPREHENSIVE_TEXT = "Oberon Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 3,125 7,384 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 13,354 24,431 Total items which will not be reclassified subsequent to operating result 13,354 24,431 Total other comprehensive income for the year 13,354 24,431 Total comprehensive income for the year attributable to Council 16,479 31,815 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Oberon Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 80";

export const OBERON_POSITION_TEXT = "Oberon Council | Statement of Financial Position | as at 30 June 2025 §Statement§ $ '000 Notes 2025 2024 ASSETS Current assets Cash and cash equivalents C1-1 6,016 7,463 Investments C1-2 18,750 20,750 Receivables C1-4 2,804 2,617 Inventories C1-5 327 444 Contract assets and contract cost assets C1-6 – 359 Other C1-8 787 648 Total current assets 28,684 32,281 Non-current assets Investments C1-2 2,500 – Inventories C1-5 195 153 Infrastructure, property, plant and equipment (IPPE) C1-7 363,117 347,157 Total non-current assets 365,812 347,310 Total assets 394,496 379,591 LIABILITIES Current liabilities Payables C3-1 1,056 1,126 Contract liabilities C3-2 334 1,253 Borrowings C3-3 231 673 Employee benefit provisions C3-4 1,932 1,897 Total current liabilities 3,553 4,949 Non-current liabilities Payables C3-1 1,000 1,000 Borrowings C3-3 2,393 2,625 Employee benefit provisions C3-4 46 44 Provisions C3-5 297 245 Total non-current liabilities 3,736 3,914 Total liabilities 7,289 8,863 Net assets 387,207 370,728 EQUITY Accumulated surplus C4-1 175,846 172,721 IPPE revaluation surplus C4-1 211,361 198,007 Council equity interest 387,207 370,728 Total equity 387,207 370,728 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Oberon Council Statement of Financial Position as at 30 June 2025 Page 6 of 80";

export const OBERON_EQUITY_TEXT = "Oberon Council | Statement of Changes in Equity | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 172,721 198,007 370,728 165,337 173,576 338,913 Opening balance 172,721 198,007 370,728 165,337 173,576 338,913 §Subnote§ Net operating result for the year 3,125 – 3,125 7,384 – 7,384 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 – 13,354 13,354 – 24,431 24,431 Other comprehensive income – 13,354 13,354 – 24,431 24,431 Total comprehensive income 3,125 13,354 16,479 7,384 24,431 31,815 Closing balance at 30 June 175,846 211,361 387,207 172,721 198,007 370,728 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Oberon Council Statement of Changes in Equity for the year ended 30 June 2025 Page 7 of 80";

export const OBERON_CASH_TEXT = "Oberon Council | Statement of Cash Flows | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Cash flows from operating activities Receipts: 7,787 Rates and annual charges 7,704 6,981 4,779 User charges and fees 4,312 8,751 570 Interest received 1,320 1,040 13,576 Grants and contributions 7,346 16,591 – Bonds, deposits and retentions received – 163 683 Other 664 737 Payments: (8,097) Payments to employees (8,272) (7,905) (6,935) Payments for materials and services (6,963) (10,614) (87) Borrowing costs (167) (144) – Bonds, deposits and retentions refunded (122) – (872) Other (763) (285) 11,404 Net cash flows from operating activities G1-1 5,059 15,315 Cash flows from investing activities Receipts: 21,250 Sale of investments 23,250 21,250 – Sale of real estate assets 200 – – Proceeds from sale of IPPE 440 157 Payments: (20,000) Purchase of investments (23,250) (21,250) – Acquisition of term deposits (500) 500 (18,590) Payments for IPPE (5,971) (16,239) – Purchase of real estate assets (1) – (17,340) Net cash flows from investing activities (5,832) (15,582) Cash flows from financing activities Payments: (673) Repayment of borrowings (674) (694) (673) Net cash flows from financing activities (674) (694) (6,609) Net change in cash and cash equivalents (1,447) (961) 7,463 Cash and cash equivalents at beginning of year 7,463 8,424 854 Cash and cash equivalents at end of year C1-1 6,016 7,463 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Oberon Council Statement of Cash Flows for the year ended 30 June 2025 Page 8 of 80";

export const OBERON_FUNCTIONS_TEXT = "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities A Growing Economy 273 608 2,231 1,879 (1,958) (1,271) 51 366 44 43 Caring for the Environment 325 239 354 513 (29) (274) 13 185 9,053 8,877 Community Wellbeing 435 381 1,167 1,092 (732) (711) – 101 23,807 23,345 Infrastructure and Services 18,675 25,362 16,583 18,796 2,092 6,566 12,454 15,655 361,291 347,032 Leadership and Engagement 9,239 8,550 5,487 5,476 3,752 3,074 2,269 2,428 301 294 Total functions and activities 28,947 35,140 25,822 27,756 3,125 7,384 14,787 18,735 394,496 379,591 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 80 Oberon Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function oberonExtraction(): PdfExtraction {
  return {
    source: {
      sha256: OBERON_FS_PDF_SHA256,
      bytes: OBERON_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(OBERON_INCOME_TEXT, 4),
      pdfPage(OBERON_COMPREHENSIVE_TEXT, 5),
      pdfPage(OBERON_POSITION_TEXT, 6),
      pdfPage(OBERON_EQUITY_TEXT, 7),
      pdfPage(OBERON_CASH_TEXT, 8),
      pdfPage(OBERON_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const OBERON_CONTEXT: OberonGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2024-25',
    title:
      'Oberon Council General Purpose Financial Statements for the year ended 30 June 2025',
    url: OBERON_FS_PDF_URL,
    fiscal_year: OBERON_GPFS_FISCAL_YEAR,
    listing_url: OBERON_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'oberon-gpfs/oberon-council-annual_financial_statements-gpfs-2025.pdf',
    sha256: OBERON_FS_PDF_SHA256,
    bytes: OBERON_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: OBERON_GPFS_REPORTING_URL,
};

/** 17 printed rows: 8 revenue (7 components + total) + 8 expense + 1 result. */
export const OBERON_GPFS_ROW_COUNT = 17;
export const OBERON_GPFS_GOLDEN_DIGEST =
  '00173e2769e607c6a4d6f87f1ffd1abd9b19f00ff6e108139aa5f0418e811e02';
export const ROW_COUNT = OBERON_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = OBERON_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseOberonGpfsExtraction(oberonExtraction(), OBERON_CONTEXT).records;
}
