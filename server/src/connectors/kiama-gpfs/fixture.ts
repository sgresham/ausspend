import {
  KIAMA_GPFS_FISCAL_YEAR,
  KIAMA_GPFS_REPORTING_URL,
  parseKiamaGpfsExtraction,
  type KiamaGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Kiama Municipal Council Financial
// Statements for the year ended 30 June 2025 (93-page PDF, printed pages 4-13 of
// 67 for the GPFS). Pages 4-8 are the primary statements; page 13 is B1-1
// "Total functions and activities". These reproduce the printed $'000 values used
// by the zero-tolerance reconciliation, including the continuing and
// discontinued result lines.
export const KIAMA_FS_PDF_URL =
  'https://www.kiama.nsw.gov.au/files/sharedassets/public/v/1/council/council-plans-amp-reports/financial-plans-and-annual-reports/kiama-municipal-council-financial-statements-2024-25.pdf';
export const KIAMA_FS_PDF_SHA256 =
  '2230fb55dcd165f96f718fa0feaba5aeee72feccb4ed7405b8b818239eb980de';
export const KIAMA_FS_PDF_BYTES = 10095862;

export const KIAMA_INCOME_TEXT = `Kiama Municipal Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 29,179 Rates and annual charges B2-1 28,741 27,686 19,809 User charges and fees B2-2 19,567 18,951 3,518 Other revenues B2-3 4,329 4,340 3,784 Grants and contributions provided for operating purposes B2-4 3,454 3,831 4,515 Grants and contributions provided for capital purposes B2-4 15,517 13,809 1,839 Interest and investment income B2-5 2,382 2,357 – Other income B2-6 92 286 62,644 Total income from continuing operations 74,082 71,260 Expenses from continuing operations 26,478 Employee benefits and on-costs B3-1 30,853 27,150 26,427 Materials and services B3-2 30,044 31,210 138 Borrowing costs 177 174 1,049 Other expenses B3-4 1,135 905 (2,946) Net loss from the disposal of assets B4-1 1,063 3,334 51,146 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 63,272 62,773 11,498 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 10,810 8,487 9,600 Depreciation, amortisation and impairment of non-financial assets B3-3 11,557 11,185 1,898 Operating result from continuing operations (747) (2,698) Discontinued operations (234) Operating result from discontinued operations D1-1 (6,643) (10,116) 1,664 Net operating result for the year attributable to Council (7,390) (12,814) (2,529) Net operating result for the year before grants and contributions provided for capital purposes (22,907) (26,623) The above Income Statement should be read in conjunction with the accompanying notes. Kiama Municipal Council Income Statement for the year ended 30 June 2025 Page 4 of 67`;

export const KIAMA_COMPREHENSIVE_TEXT = `Kiama Municipal Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement (7,390) (12,814) §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain / (loss) on revaluation of infrastructure, property, plant and equipment C1-7 24,011 27,636 Total items which will not be reclassified subsequent to operating result 24,011 27,636 Total other comprehensive income for the year 24,011 27,636 Total comprehensive income for the year attributable to Council 16,621 14,822 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Kiama Municipal Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 67`;

export const KIAMA_POSITION_TEXT = `Kiama Municipal Council | Statement of Financial Position | as at 30 June 2025 §Statement§ $ '000 Notes 2025 2024 ASSETS Current assets Cash and cash equivalents C1-1 17,928 19,051 Investments C1-2 19,000 21,000 Receivables C1-4 3,274 3,304 Inventories 347 329 Contract assets and contract cost assets C1-5 513 1,488 Current assets classified as held for sale C1-6 945 909 Net assets transferred to discontinued operations – 6,301 Prepayments 545 771 Total current assets 42,552 53,153 Non-current assets Investments C1-2 1,465 9,373 Receivables C1-4 2,950 205 Infrastructure, property, plant and equipment (IPPE) C1-7 583,583 553,121 Investment property C1-8 85,960 80,200 Right of use assets 279 395 Total non-current assets 674,237 643,294 Total assets 716,789 696,447 LIABILITIES Current liabilities Payables C2-1 69,807 71,949 Contract liabilities C2-2 4,694 4,365 Lease liabilities 77 114 Borrowings C2-3 2,519 675 Employee benefit provisions C2-4 6,006 5,563 Provisions C2-5 633 – Total current liabilities 83,736 82,666 Non-current liabilities Lease liabilities 226 290 Borrowings C2-3 8,154 5,414 Employee benefit provisions C2-4 528 553 Total non-current liabilities 8,908 6,257 Total liabilities 92,644 88,923 Net assets 624,145 607,524 EQUITY Accumulated surplus 153,518 160,908 IPPE revaluation surplus 470,627 446,616 Council equity interest 624,145 607,524 Total equity 624,145 607,524 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Kiama Municipal Council Statement of Financial Position as at 30 June 2025 Page 6 of 67`;

export const KIAMA_EQUITY_TEXT = `Kiama Municipal Council | Statement of Changes in Equity | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 160,908 446,616 607,524 173,722 418,980 592,702 Restated opening balance 160,908 446,616 607,524 173,722 418,980 592,702 §Subnote§ Net operating result for the year (7,390) – (7,390) (12,814) – (12,814) Restated net operating result for the period (7,390) – (7,390) (12,814) – (12,814) Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 – 24,011 24,011 – 27,636 27,636 Other comprehensive income – 24,011 24,011 – 27,636 27,636 Total comprehensive income (7,390) 24,011 16,621 (12,814) 27,636 14,822 Closing balance at 30 June 153,518 470,627 624,145 160,908 446,616 607,524 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Kiama Municipal Council Statement of Changes in Equity for the year ended 30 June 2025 Page 7 of 67`;

export const KIAMA_CASH_TEXT = `Kiama Municipal Council | Statement of Cash Flows | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Cash flows from operating activities Receipts: 29,179 Rates and annual charges 28,616 27,597 19,809 User charges and fees 20,554 23,585 1,839 Interest received 2,469 2,579 8,299 Grants and contributions 15,332 15,208 – Bonds, deposits and retentions received – 240 3,518 Other 5,716 2,594 Payments: (26,443) Payments to employees (32,380) (26,244) (26,462) Payments for materials and services (35,411) (35,283) (138) Borrowing costs (277) (319) – Bonds, deposits and retentions refunded (223) – (1,049) Other 2,847 – – Discontinued operations (931) (918) 8,552 Net cash flows from operating activities G1-1 6,312 9,039 Cash flows from investing activities Receipts: – Redemption of term deposits 10,000 – 6,496 Proceeds from sale of IPPE 1,465 7,419 – Discontinued operations 10,261 – Payments: – Acquisition of term deposits – (26,250) – Purchase of investment property (500) – – Other investing activity payments (2,132) – (16,360) Payments for IPPE (13,286) (15,966) (9,864) Net cash flows from investing activities 5,808 (34,797) Cash flows from financing activities Receipts: 3,500 Proceeds from retirement villages and residential aged care bonds 2,001 2,567 Payments: (675) Repayment of borrowings (676) (801) – Principal component of lease payments (138) (15) – Discontinued operations (14,430) – 2,825 Net cash flows from financing activities (13,243) 1,751 1,513 Net change in cash and cash equivalents (1,123) (24,007) – Cash and cash equivalents at beginning of year 19,051 43,058 1,513 Cash and cash equivalents at end of year C1-1 17,928 19,051 – plus: Investments on hand at end of year C1-2 20,465 30,373 1,513 Total cash, cash equivalents and investments 38,393 49,424 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Kiama Municipal Council Statement of Cash Flows for the year ended 30 June 2025 Page 8 of 67`;

export const KIAMA_FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Office of Chief Executive Officer * 126 1,345 4,781 7,792 (4,655) (6,447) – 50 – – Corporate and Commercial 42,071 29,208 28,264 32,651 13,807 (3,443) 1,904 2,137 57,344 55,716 Strategy and Communities 26,308 34,021 30,419 25,996 (4,111) 8,025 16,413 12,628 100,350 97,502 Infrastructure and Operations 5,577 6,686 11,365 8,169 (5,788) (1,483) 654 2,825 559,095 543,229 Total functions and activities 74,082 71,260 74,829 74,608 (747) (3,348) 18,971 17,640 716,789 696,447 (*) Operating loss due to Office of Chief Executive Officer responsible for Performance Improvement Order Implementation team and legal expenses. B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 67 Kiama Municipal Council | Notes to the Financial Statements 30 June 2025`;

// Retained annual-report-only evidence: the FY2024-25 annual report is
// narrative-only and ends at the Authorisation page.
export const KIAMA_CONTENTS_TEXT = `— KIAMA MUNICIPAL COUNCIL ANNUAL REPORT 2024-25 3 Contents Acknowledgement of country 2 Contents 3 Vision, mission, values 4 Message from the Mayor 5 Our Mayor and Councillors 6 Our municipality 8 Our organisation 10 Message from the CEO 11 Facilities and assets 12 A snapshot of Council activity 13 Councillor and executive highlights 2024-2025 financial year 15 Plans and strategies guiding Council's actions 16 About this report 17 Meet our Executive Leadership Team 2024-2025 18 Consolidated operating results 2024-2025 19 Pillar 1 20 Pillar 2 29 Pillar 3 35 Pillar 4 40 Pillar 5 43 Blue Haven Update 50 Audit, Risk and Improvement Committee Annual Report 54 Other required information 65 Authorisation and version control 91`;

export const KIAMA_SUMMARY_TEXT = `— KIAMA MUNICIPAL COUNCIL ANNUAL REPORT 2024-25 19 Consolidated operating results 2024-2025 Consolidated Operating Results ($) $’000 Actual 2024-2025 Budget 2024-2025 Variance 2024-2025 Income from continuing operations Rates and annual charges User charges and fees Other revenues Grants and contributions provided for operating purposes Grants and contributions provided for capital purposes Interest and investment income Other income 28,741 19,567 4,329 3,454 15,517 2,382 92 29,179 19,809 3,518 3,784 4,515 1,839 0 (438) (242) 811 (330) 11,002 543 92 Total income for continuing operations 74,082 62,644 11,438 Expenses from continuing operations Employee benefits and on-costs Materials and services Borrowing costs Other expenses Net loss from the disposal of assets 30,853 30,044 177 1,135 1,063 26,478 26,427 138 1,049 (2,946) 4,375 3,617 39 86 4,009 Total expenses from continuing operations 63,272 51,146 12,126 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 10,810 11,498 (688) Depreciation, amortisation and impairment of non-financial assets 11,557 9,600 1,957 Operating results from continuing operations (747) 1,898 (2,645) Discontinued operations Operating result from discontinued operations (6,643) (234) (6,409) Net operating result for the year attributable to Council (7,309) 1,664 (9,054) Net operating result for the year before grants and contributions provided for capital purposes (22,907) (2,529) (20,378)`;

export const KIAMA_AUTHORISATION_TEXT = `— KIAMA MUNICIPAL COUNCIL ANNUAL REPORT 2024-25 91 Authorisation and version control Owner/Responsible Officer Manager People and Performance Department People and Performance Date adopted/endorsed 18 November 2025 Resolution number (if applicable) N/A Next review date N/A TRIM reference 25/105448 Date reviewed Date adopted/endorsed Brief detail of amendments All information is correct at the time of writing and publication.`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function kiamaExtraction(): PdfExtraction {
  return {
    source: {
      sha256: KIAMA_FS_PDF_SHA256,
      bytes: KIAMA_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(KIAMA_INCOME_TEXT, 4),
      pdfPage(KIAMA_COMPREHENSIVE_TEXT, 5),
      pdfPage(KIAMA_POSITION_TEXT, 6),
      pdfPage(KIAMA_EQUITY_TEXT, 7),
      pdfPage(KIAMA_CASH_TEXT, 8),
      pdfPage(KIAMA_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export function kiamaAnnualReportExtraction(): PdfExtraction {
  return {
    source: {
      sha256: 'annual-report-fixture',
      bytes: 1,
    },
    pages: [
      pdfPage(KIAMA_CONTENTS_TEXT, 3),
      pdfPage(KIAMA_SUMMARY_TEXT, 19),
      pdfPage(KIAMA_AUTHORISATION_TEXT, 91),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const KIAMA_CONTEXT: KiamaGpfsParseContext = {
  document: {
    id: 'financial-statements-2024-25',
    title: 'Financial Statements for the Year Ended 30 June 2025',
    url: KIAMA_FS_PDF_URL,
    fiscal_year: KIAMA_GPFS_FISCAL_YEAR,
    listing_url: KIAMA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'kiama-gpfs/kiama-municipal-council-financial-statements-2024-25.pdf',
    sha256: KIAMA_FS_PDF_SHA256,
    bytes: KIAMA_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: KIAMA_GPFS_REPORTING_URL,
};

/** 19 printed rows: 8 revenue + 8 expense + 3 result. */
export const KIAMA_GPFS_ROW_COUNT = 19;
export const KIAMA_GPFS_GOLDEN_DIGEST =
  '5b5445ea4c8b09bbc36d589cd2c2125b59fa28be2f18ea0cef1969e7d10ba530';
export const ROW_COUNT = KIAMA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = KIAMA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseKiamaGpfsExtraction(kiamaExtraction(), KIAMA_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
