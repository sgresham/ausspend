import {
  CESSNOCK_GPFS_FISCAL_YEAR,
  CESSNOCK_GPFS_REPORTING_URL,
  parseCessnockGpfsExtraction,
  type CessnockGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Cessnock City Council Annual Financial
// Statements for the year ended 30 June 2025 (88-page PDF, printed page 5 of 75
// onward). Pages 8-12 are the primary statements; page 17 is B1-1 "Total
// functions and activities". These reproduce the printed $'000 values used by
// the zero-tolerance reconciliation.
export const CESSNOCK_AFS_PDF_URL =
  'https://www.cessnock.nsw.gov.au/files/assets/public/v/2/hptrim/website-finance-budget-documents-do-not-change/ccc-_-annual_financial_statements-2024-2025-final-with-audit-opinion.pdf';
export const CESSNOCK_AFS_PDF_SHA256 =
  'c6b4061782e9321f0b028459592bd66ecc970bfb7e5f50016c7f66332efe40b4';
export const CESSNOCK_AFS_PDF_BYTES = 7998715;

export const CESSNOCK_INCOME_TEXT = `Cessnock City Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 70,359 Rates and annual charges B2-1 71,193 65,986 9,962 User charges and fees * B2-2 9,926 9,531 2,522 Other revenues B2-3 3,339 2,836 13,193 Grants and contributions provided for operating purposes B2-4 15,706 19,301 64,736 Grants and contributions provided for capital purposes B2-4 71,924 104,578 2,784 Interest and investment income 3,891 3,853 – Other income 642 842 163,556 Total income from continuing operations 176,621 206,927 Expenses from continuing operations 46,800 Employee benefits and on-costs B3-1 49,318 42,362 32,526 Materials and services * B3-2 37,269 36,596 376 Borrowing costs B3-3 922 263 6,899 Other expenses B3-5 7,359 5,555 5,000 Net loss from the disposal of assets B4-1 17,405 10,220 91,601 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 112,273 94,996 71,955 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 64,348 111,931 20,815 Depreciation, amortisation and impairment of non-financial assets B3-4 26,202 22,987 51,140 Operating result from continuing operations 38,146 88,944 51,140 Net operating result for the year attributable to Council * 38,146 88,944 (13,969) Net operating result for the year before grants and contributions provided for capital purposes (33,778) (15,634) The above Income Statement should be read in conjunction with the accompanying notes. (*) The 2023-24 comparative figures have been updated to reflect changes in categorisation of expenditure. Cessnock City Council Income Statement for the year ended 30 June 2025 Page 5 of 75`;

export const CESSNOCK_COMPREHENSIVE_TEXT = `Cessnock City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 38,146 88,944 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain / (loss) on revaluation of infrastructure, property, plant and equipment C1-6 222,099 (85,434) Total items which will not be reclassified subsequent to operating result 222,099 (85,434) Total other comprehensive income for the year 222,099 (85,434) Total comprehensive income for the year attributable to Council 260,245 3,510 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Cessnock City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 75`;

export const CESSNOCK_POSITION_TEXT = `Cessnock City Council | Statement of Financial Position | as at 30 June 2025 §Statement§ $ '000 Notes 2025 2024 ASSETS Current assets Cash and cash equivalents C1-1 34,226 18,994 Investments C1-2 62,474 64,139 Receivables C1-4 14,617 15,429 Inventories 481 518 Non-current assets classified as 'held for sale' 3,093 1,313 Other 867 1,049 Total current assets 115,758 101,442 Non-current assets Infrastructure, property, plant and equipment (IPPE) C1-6 1,567,624 1,295,120 Total non-current assets 1,567,624 1,295,120 Total assets 1,683,382 1,396,562 LIABILITIES Current liabilities Payables C2-1 19,236 14,214 Contract liabilities C2-2 32,744 20,424 Borrowings C2-3 6,720 969 Employee benefit provisions C2-4 10,109 9,607 Provisions C2-5 42 42 Total current liabilities 68,851 45,256 Non-current liabilities Payables C2-1 3,208 3,924 Borrowings C2-3 13,026 6,146 Employee benefit provisions C2-4 803 770 Provisions C2-5 25,301 28,518 Total non-current liabilities 42,338 39,358 Total liabilities 111,189 84,614 Net assets 1,572,193 1,311,948 EQUITY Accumulated surplus 759,881 724,860 IPPE revaluation surplus C3-1 812,312 587,088 Total equity 1,572,193 1,311,948 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Cessnock City Council Statement of Financial Position as at 30 June 2025 Page 7 of 75`;

export const CESSNOCK_EQUITY_TEXT = `Cessnock City Council | Statement of Changes in Equity | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 724,860 587,088 1,311,948 635,916 672,522 1,308,438 §Subnote§ Net operating result for the year 38,146 – 38,146 88,944 – 88,944 Other comprehensive income Gain on revaluation of infrastructure, property, plant and equipment C1-6 – 222,099 222,099 – (85,434) (85,434) Total comprehensive income 38,146 222,099 260,245 88,944 (85,434) 3,510 Transfers between equity items (3,125) 3,125 – – – – Closing balance at 30 June 759,881 812,312 1,572,193 724,860 587,088 1,311,948 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Cessnock City Council Statement of Changes in Equity for the year ended 30 June 2025 Page 8 of 75`;

export const CESSNOCK_CASH_TEXT = `Cessnock City Council | Statement of Cash Flows | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Cash flows from operating activities Receipts: 70,359 Rates and annual charges 70,951 65,158 9,963 User charges and fees 10,924 11,105 2,784 Interest received 4,872 3,052 77,929 Grants and contributions 74,139 71,254 – Bonds, deposits and retentions received 561 838 – GST Credit 8,806 9,351 2,522 Other 3,930 13,149 Payments: (46,800) Payments to employees (48,849) (42,274) (32,526) Payments for materials and services (41,729) (43,912) (373) Borrowing costs (922) (263) – Bonds, deposits and retentions refunded (696) – – Waste Levy (5,549) (4,536) (6,899) Other (6,059) (2,613) 76,959 Net cash flows from operating activities F1-1 70,379 80,309 Cash flows from investing activities Receipts: 95,000 Sale of investments 182,000 40,000 – Proceeds from sale of IPPE 1,008 2,161 Payments: – Purchase of investments (91,346) (40,036) (85,000) Acquisition of term deposits (89,000) (12,000) (79,217) Payments for IPPE (70,440) (71,488) (69,217) Net cash flows from investing activities (67,778) (81,363) Cash flows from financing activities Receipts: 13,600 Proceeds from borrowings 13,600 – Payments: (1,053) Repayment of borrowings (969) (1,186) – Principal component of lease payments – (2) 12,547 Net cash flows from financing activities 12,631 (1,188) 20,289 Net change in cash and cash equivalents 15,232 (2,242) 39,283 Cash and cash equivalents at end of year C1-1 34,226 18,994 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Cessnock City Council Statement of Cash Flows for the year ended 30 June 2025 Page 9 of 75`;

export const CESSNOCK_FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities A connected, safe, and creative community 11,568 10,901 29,555 21,993 (17,987) (11,092) 7,413 6,714 286,515 277,882 A sustainable and prosperous economy 405 1,296 1,683 1,385 (1,278) (89) 31 815 57 2 A sustainable and healthy environment 30,680 27,190 22,265 17,450 8,415 9,740 7,402 6,247 234,969 160,326 Accessible infrastructure, services and facilities 30,972 30,917 37,805 22,470 (6,833) 8,447 28,545 27,662 1,044,421 850,991 Civic leadership and effective governance 102,996 136,623 47,167 54,685 55,829 81,938 72,116 82,441 117,420 107,361 Total functions and activities 176,621 206,927 138,475 117,983 38,146 88,944 87,630 123,880 1,683,382 1,396,562 (1) The 2023-24 comparative figures have been updated to reflect changes in categorisation of expenditure. B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets 1 Page 14 of 75 Cessnock City Council | Notes to the Financial Statements 30 June 2025`;

// Retained annual-report-only evidence: the FY2024-25 annual report is
// narrative-only and ends at the Attestation Statement.
export const CESSNOCK_SUMMARY_TEXT = `ANNUAL REPORT 2024–2025 | 25 24 | CESSNOCK CITY COUNCIL Community Involvement Our engagement activities are guided by the best practice International Association for Public Participation (IAP2) model. Financial summary What were our sources of income? Rates and annual charges Other revenues Contributions - Non cash dedications User charges and fees Grants and contributions Interest and investment income $61.3m received in grants and contributions $26.4m non-cash dedications $4m other revenues $71.2m raised in rates and charges 15% 35% 40% 6% 2% 2%`;

export const CESSNOCK_ATTESTATION_TEXT = `ANNUAL REPORT 2024–2025 | 201 200 | CESSNOCK CITY COUNCIL ATTESTATION STATEMENT`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function cessnockExtraction(): PdfExtraction {
  return {
    source: {
      sha256: CESSNOCK_AFS_PDF_SHA256,
      bytes: CESSNOCK_AFS_PDF_BYTES,
    },
    pages: [
      pdfPage(CESSNOCK_INCOME_TEXT, 8),
      pdfPage(CESSNOCK_COMPREHENSIVE_TEXT, 9),
      pdfPage(CESSNOCK_POSITION_TEXT, 10),
      pdfPage(CESSNOCK_EQUITY_TEXT, 11),
      pdfPage(CESSNOCK_CASH_TEXT, 12),
      pdfPage(CESSNOCK_FUNCTIONS_TEXT, 17),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export function cessnockAnnualReportExtraction(): PdfExtraction {
  return {
    source: {
      sha256: 'annual-report-fixture',
      bytes: 1,
    },
    pages: [pdfPage(CESSNOCK_SUMMARY_TEXT, 13), pdfPage(CESSNOCK_ATTESTATION_TEXT, 101)],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const CESSNOCK_CONTEXT: CessnockGpfsParseContext = {
  document: {
    id: 'afs-2024-25',
    title: 'Annual Financial Statements for the Year Ended 30 June 2025',
    url: CESSNOCK_AFS_PDF_URL,
    fiscal_year: CESSNOCK_GPFS_FISCAL_YEAR,
    listing_url: CESSNOCK_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'cessnock-gpfs/ccc-_-annual_financial_statements-2024-2025-final-with-audit-opinion.pdf',
    sha256: CESSNOCK_AFS_PDF_SHA256,
    bytes: CESSNOCK_AFS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: CESSNOCK_GPFS_REPORTING_URL,
};

/** 17 printed Income Statement rows (7 revenue + total, 5 expenses + 3 totals/result). */
export const CESSNOCK_GPFS_ROW_COUNT = 17;
export const CESSNOCK_GPFS_GOLDEN_DIGEST =
  'a1c29c71cef9ee3c892786c562fe30ba8927f73e29ab16cfa5568731523369a3';
export const ROW_COUNT = CESSNOCK_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = CESSNOCK_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseCessnockGpfsExtraction(cessnockExtraction(), CESSNOCK_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
