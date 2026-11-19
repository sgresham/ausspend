import {
  LISMORE_GPFS_FISCAL_YEAR,
  LISMORE_GPFS_REPORTING_URL,
  parseLismoreGpfsExtraction,
  type LismoreGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Lismore City Council Financial
// Statements for the year ended 30 June 2025 (104-page signed PDF; the GPFS
// primary statements are printed pages 4-14). Pages 5-9 are the primary
// statements; page 15 is B1-1 "Total functions and activities". These reproduce
// the printed $'000 values used by the zero-tolerance reconciliation.
export const LISMORE_FS_PDF_URL =
  'https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/annual_financial_statements-2025-signed-27-nov-25.pdf';
export const LISMORE_FS_PDF_SHA256 =
  'e4816b7149d268099bbb931fcf0a3b34b03ab0e4b28663aba18039cdf0da9797';
export const LISMORE_FS_PDF_BYTES = 3269117;

export const LISMORE_INCOME_TEXT = `Lismore City Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 66,821 Rates and annual charges B2-1 66,953 62,025 23,004 User charges and fees B2-2 30,687 28,186 7,269 Other revenues B2-3 3,959 4,849 22,709 Grants and contributions provided for operating purposes B2-4 24,115 31,158 116,283 Grants and contributions provided for capital purposes B2-4 137,591 103,580 5,104 Interest and investment income B2-5 9,708 7,752 – Net share of interests in joint ventures and associates using the equity method D2a 162 – 241,190 Total income from continuing operations 273,175 237,550 Expenses from continuing operations 40,690 Employee benefits and on-costs B3-1 49,208 44,929 53,390 Materials and services B3-2 56,842 53,754 1,606 Borrowing costs B3-3 2,813 2,427 3,476 Other expenses B3-5 4,188 3,704 3,439 Net loss from the disposal of assets B4-1 3,617 5,258 9 Net share of interests in joint ventures and associates using the equity method D2 – 83 102,610 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 116,668 110,155 138,580 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 156,507 127,395 36,444 Depreciation, amortisation and impairment of non-financial assets B3-4 37,388 31,943 102,136 Operating result from continuing operations 119,119 95,452 102,136 Net operating result for the year attributable to Council 119,119 95,452 (14,147) Net operating result for the year before grants and contributions provided for capital purposes (18,472) (8,128) The above Income Statement should be read in conjunction with the accompanying notes. Lismore City Council Income Statement for the year ended 30 June 2025 Page 4`;

export const LISMORE_COMPREHENSIVE_TEXT = `Lismore City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 119,119 95,452 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 49,833 124,949 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-7 (1,378) (20,682) Total items which will not be reclassified subsequent to operating result 48,455 104,267 Total other comprehensive income for the year 48,455 104,267 Total comprehensive income for the year attributable to Council 167,574 199,719 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Lismore City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5`;

export const LISMORE_POSITION_TEXT = `Lismore City Council | Statement of Financial Position | as at 30 June 2025 §Statement§ $ '000 Notes 2025 2024 ASSETS Current assets Cash and cash equivalents C1-1 137,107 113,596 Investments C1-2 72,796 69,000 Receivables C1-4 31,549 25,041 Inventories C1-5 4,031 3,322 Contract assets and contract cost assets C1-6 22,619 23,889 Other C1-8 601 738 Total current assets 268,703 235,586 Non-current assets Investments C1-2 – 1,000 Receivables C1-4 2,155 2,538 Inventories C1-5 174 174 Infrastructure, property, plant and equipment (IPPE) C1-7 2,172,305 2,026,435 Right of use assets C2-1 3,130 2,547 Investments accounted for using the equity method D2-2 1,478 1,316 Total non-current assets 2,179,242 2,034,010 Total assets 2,447,945 2,269,596 LIABILITIES Current liabilities Payables C3-1 28,845 32,303 Contract liabilities C3-2 103,490 87,753 Lease liabilities C2-1 1,131 814 Borrowings C3-3 4,422 4,932 Employee benefit provisions C3-4 7,562 7,484 Provisions C3-5 65 64 Total current liabilities 145,515 133,350 Non-current liabilities Lease liabilities C2-1 2,144 1,846 Borrowings C3-3 30,934 35,227 Employee benefit provisions C3-4 667 675 Provisions C3-5 13,318 10,705 Total non-current liabilities 47,063 48,453 Total liabilities 192,578 181,803 Net assets 2,255,367 2,087,793 EQUITY Accumulated surplus 817,741 698,622 IPPE revaluation surplus C4-1 1,437,626 1,389,171 Total equity 2,255,367 2,087,793 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Lismore City Council Statement of Financial Position as at 30 June 2025 Page 6`;

export const LISMORE_EQUITY_TEXT = `Lismore City Council | Statement of Changes in Equity | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance 698,622 1,389,171 2,087,793 603,170 1,284,904 1,888,074 §Subnote§ Net operating result for the year 119,119 – 119,119 95,452 – 95,452 Net Operating result for the period 119,119 – 119,119 95,452 – 95,452 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 – 49,833 49,833 – 124,949 124,949 – Impairment (loss) reversal relating to IPP&E C1-7 – (1,378) (1,378) – (20,682) (20,682) Other comprehensive income – 48,455 48,455 – 104,267 104,267 Total comprehensive income 119,119 48,455 167,574 95,452 104,267 199,719 Closing balance at 30 June 817,741 1,437,626 2,255,367 698,622 1,389,171 2,087,793 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Lismore City Council Statement of Changes in Equity for the year ended 30 June 2025 Page 7`;

export const LISMORE_CASH_TEXT = `Lismore City Council | Statement of Cash Flows | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Cash flows from operating activities Receipts: 66,667 Rates and annual charges 63,693 58,194 22,809 User charges and fees 33,979 29,740 5,009 Interest received 9,466 7,117 141,678 Grants and contributions 176,608 187,356 – Bonds, deposits and retentions received – 2,642 7,348 Other 16,524 19,651 Payments: (40,467) Payments to employees (48,436) (44,523) (54,799) Payments for materials and services (71,518) (73,850) (1,645) Borrowing costs (2,459) (2,470) – Bonds, deposits and retentions refunded (1,392) – (3,347) Other (1,408) (4,575) 143,253 Net cash provided by (or used in) operating activities G1-1 175,057 179,282 Cash flows from investing activities Receipts: 817 Proceeds from sale of IPPE 787 275 – Deferred debtors receipts 185 10 Payments: (3,378) Acquisition of term deposits (2,796) 20,928 (133,500) Payments for IPPE (144,099) (122,821) (136,061) Net cash provided by (or used in) investing activities (145,923) (101,608) Cash flows from financing activities Payments: (5,042) Repayment of borrowings (4,803) (5,608) – Principal component of lease payments (820) (742) (5,042) Net cash flow provided by (used in) financing activities (5,623) (6,350) 2,150 Net change in cash and cash equivalents 23,511 71,324 113,596 Cash and cash equivalents at beginning of year 113,596 42,272 115,746 Cash and cash equivalents at end of year C1-1 137,107 113,596 38,875 plus: Investments on hand at end of year 1 C1-2 72,796 70,000 154,621 Total cash, cash equivalents and investments 209,903 183,596 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Lismore City Council Statement of Cash Flows for the year ended 30 June 2025 Page 8`;

export const LISMORE_FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities An inclusive and healthy community 37,752 13,375 13,953 21,229 23,799 (7,854) 18,476 9,268 167,658 155,386 A prosperous and vibrant city 789 3,978 6,219 5,687 (5,430) (1,709) 16,664 2,587 6,119 5,600 Our natural environment 50,540 14,517 88,911 19,123 (38,371) (4,606) 84,698 151 117,483 108,980 Our built environment 5,025 151,439 23,365 86,063 (18,340) 65,376 38,875 106,508 2,021,444 1,874,588 Leadership and participation 17,363 54,242 21,608 9,997 (4,245) 44,245 2,993 16,224 134,861 125,042 Other – – – – – – – – 380 – Total functions and activities 111,469 237,551 154,056 142,099 (42,587) 95,452 161,706 134,738 2,447,945 2,269,596 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 Lismore City Council | Notes to the Financial Statements 30 June 2025`;

// Retained annual-report-only evidence: the FY2024-25 annual report is
// narrative/statutory-information only and does not embed the GPFS.
export const LISMORE_AR_CONTENTS_TEXT = `Contents Acknowledgment of country 2 Lismore is the geographic centre of the Northern Rivers region 5 Lismore’s strength is it’s diverse and resilient people 6 Lismore is building back better following natural disaster events 7 An advocacy agenda for our city 8 Our key areas of focus will leverage our potential 9 1. Disaster mitigation and recovery 10 2. Enhancing Infrastructure Investment 15 3. Homes for the community 18 4. Destination and Events 20 Contents Mayor’s Message 6 General Manager’s Message 7 About Lismore 9 Rebuilding Lismore 18 Delivery Program Achievements 20 Statutory Information 30 3 | LCC Annual Report 2024-2025`;

export const LISMORE_AR_CLAIM_TEXT = `Executive summary Lismore City Council is proud to present our Annual Report for the financial year to 30 June 2025. This report serves as a critical component of the Integrated Planning and Reporting (IP&R) framework, providing a comprehensive overview of Council’s performance over the past 12 months. It aligns Council’s activities with our five community priorities as set out in the Community Strategic Plan 2022–2032. These are: • An inclusive and healthy community • A prosperous and vibrant city • Our natural environment • Our built environment • Leadership and participation In addition to the above, the Annual Report must also contain Statutory Reporting Information and Financial Statements as required by the Local Government Act 1993 (NSW). This is the final Annual Report addressing the Imagine Lismore Community Strategic Plan 2022 – 2032 .`;

export const LISMORE_AR_BACK_COVER_TEXT = `lismorecitycouncil.nsw.gov.au yoursay.lismore.nsw.gov.au`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function lismoreExtraction(): PdfExtraction {
  return {
    source: {
      sha256: LISMORE_FS_PDF_SHA256,
      bytes: LISMORE_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(LISMORE_INCOME_TEXT, 5),
      pdfPage(LISMORE_COMPREHENSIVE_TEXT, 6),
      pdfPage(LISMORE_POSITION_TEXT, 7),
      pdfPage(LISMORE_EQUITY_TEXT, 8),
      pdfPage(LISMORE_CASH_TEXT, 9),
      pdfPage(LISMORE_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export function lismoreAnnualReportExtraction(): PdfExtraction {
  return {
    source: {
      sha256: 'annual-report-fixture',
      bytes: 1,
    },
    pages: [
      pdfPage(LISMORE_AR_CONTENTS_TEXT, 3),
      pdfPage(LISMORE_AR_CLAIM_TEXT, 5),
      pdfPage(LISMORE_AR_BACK_COVER_TEXT, 74),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const LISMORE_CONTEXT: LismoreGpfsParseContext = {
  document: {
    id: 'financial-reports-2024-25',
    title: 'Financial reports 2024/25',
    url: LISMORE_FS_PDF_URL,
    fiscal_year: LISMORE_GPFS_FISCAL_YEAR,
    listing_url: LISMORE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'lismore-gpfs/annual_financial_statements-2025-signed-27-nov-25.pdf',
    sha256: LISMORE_FS_PDF_SHA256,
    bytes: LISMORE_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: LISMORE_GPFS_REPORTING_URL,
};

/** 17 printed rows: 8 revenue + 8 expense + 1 result. */
export const LISMORE_GPFS_ROW_COUNT = 17;
export const LISMORE_GPFS_GOLDEN_DIGEST =
  'f0019dea9cb32501d0af21142d659309c1af817b514ff761f15c06c631e310b1';
export const ROW_COUNT = LISMORE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = LISMORE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseLismoreGpfsExtraction(lismoreExtraction(), LISMORE_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
