import {
  WALGETT_GPFS_FISCAL_YEAR,
  WALGETT_GPFS_REPORTING_URL,
  parseWalgettGpfsExtraction,
  type WalgettGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Banked text from the official Walgett Shire Council standalone audited
// financial statements for the year ended 30 June 2025 (109-page PDF; the GPFS
// primary statements are PDF pages 6-10 and B1-1 is PDF page 15). These
// reproduce the printed $'000 values used by the zero-tolerance reconciliation.
// FY2024-25 is the latest available standalone audited GPFS as at 2026-11-20.
export const WALGETT_FS_PDF_URL =
  'https://www.walgett.nsw.gov.au/assets/files/e14f90d207d06a69-1776849622581_6c2e2885.pdf';
export const WALGETT_FS_PDF_SHA256 =
  '26f02f8523fe3742aa84f0998e43241b398d13f3fd158920380c77907baa9de4';
export const WALGETT_FS_PDF_BYTES = 3_001_912;

export const WALGETT_INCOME_TEXT = "Walgett Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 11,042 Rates and annual charges B2-1 11,129 10,594 9,209 User charges and fees B2-2 2,472 6,195 979 Other revenues B2-3 955 1,400 12,397 Grants and contributions provided for operating purposes B2-4 14,340 24,189 3,901 Grants and contributions provided for capital purposes B2-4 6,414 4,167 1,120 Interest and investment income B2-5 2,070 1,627 184 Other income B2-6 229 213 – Net gain from the disposal of assets B4-1 56 – 38,832 Total income from continuing operations 37,665 48,385 Expenses from continuing operations 9,177 Employee benefits and on-costs B3-1 11,607 10,990 17,343 Materials and services B3-2 24,475 22,655 285 Borrowing costs B3-3 127 174 1,320 Other expenses B3-5 1,962 1,555 152 Net loss from the disposal of assets B4-1 – 133 – Net share of interests in joint ventures and associates using the equity method D2 60 50 28,277 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 38,231 35,557 10,555 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets (566) 12,828 7,435 Depreciation, amortisation and impairment of non-financial assets B3-4 8,811 8,258 3,120 Operating result from continuing operations (9,377) 4,570 3,120 Net operating result for the year attributable to Council (9,377) 4,570 (1,210) Net operating result for the year before grants and contributions provided for capital purposes (15,791) 403 The above Income Statement should be read in conjunction with the accompanying notes. Walgett Shire Council Income Statement for the year ended 30 June 2025 Page 5 of 86";

export const WALGETT_COMPREHENSIVE_TEXT = "Walgett Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement (9,377) 4,570 §Subnote§ Other comprehensive income: Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 28,220 20,115 Total items which will not be reclassified subsequent to operating result 28,220 20,115 Total other comprehensive income for the year 28,220 20,115 Total comprehensive income for the year attributable to Council 18,843 24,685 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Walgett Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 86";

export const WALGETT_POSITION_TEXT = "Walgett Shire Council | Statement of Financial Position | as at 30 June 2025 §Statement§ 2025 2024 Notes $ '000 $ '000 ASSETS Current assets Cash and cash equivalents C1-1 5,351 19,393 Investments C1-2 10,500 17,000 Receivables C1-4 19,974 14,678 Inventories C1-5 959 1,079 Other C1-7 53 35 Total current assets 36,837 52,185 Non-current assets Investments C1-2 11,000 6,000 Receivables C1-4 – 20 Infrastructure, property, plant and equipment (IPPE) C1-6 452,944 424,463 Right of use assets C2-1 102 149 Investments accounted for using the equity method D2-1 619 679 Total non-current assets 464,665 431,311 Total assets 501,502 483,496 LIABILITIES Current liabilities Payables C3-1 4,660 3,501 Contract liabilities C3-2 3,894 5,595 Lease liabilities C2-1 49 47 Borrowings C3-3 101 97 Employee benefit provisions C3-4 1,778 1,999 Total current liabilities 10,482 11,239 Non-current liabilities Lease liabilities C2-1 59 107 Borrowings C3-3 406 507 Employee benefit provisions C3-4 99 102 Provisions C3-5 3,810 3,738 Total non-current liabilities 4,374 4,454 Total liabilities 14,856 15,693 Net assets 486,646 467,803 EQUITY Accumulated surplus 139,322 148,699 IPPE revaluation surplus C4-1 347,324 319,104 Council equity interest 486,646 467,803 Total equity 486,646 467,803 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Walgett Shire Council Statement of Financial Position as at 30 June 2025 Page 7 of 86";

export const WALGETT_EQUITY_TEXT = "Walgett Shire Council | Statement of Changes in Equity | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Notes $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Opening balance at 1 July 148,699 319,104 467,803 144,129 298,989 443,118 §Subnote§ Net operating result for the year (9,377) – (9,377) 4,570 – 4,570 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 – 28,220 28,220 – 20,115 20,115 Other comprehensive income – 28,220 28,220 – 20,115 20,115 Total comprehensive income (9,377) 28,220 18,843 4,570 20,115 24,685 Closing balance at 30 June 139,322 347,324 486,646 148,699 319,104 467,803 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Walgett Shire Council Statement of Changes in Equity for the year ended 30 June 2025 Page 8 of 86";

export const WALGETT_CASH_TEXT = "Walgett Shire Council | Statement of Cash Flows | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Cash flows from operating activities Receipts: 11,012 Rates and annual charges 10,750 10,390 9,008 User charges and fees 1,970 9,464 1,127 Interest received 1,844 1,607 17,175 Grants and contributions 15,722 25,729 – Bonds, deposits and retentions received – 368 1,295 Other 359 3,892 Payments: (9,117) Payments to employees (11,779) (11,724) (17,345) Payments for materials and services (24,109) (25,402) (280) Borrowing costs (22) (35) – Bonds, deposits and retentions refunded (30) – (1,318) Other (2,179) (1,611) 11,557 Net cash flows from operating activities G1-1 (7,474) 12,678 Cash flows from investing activities Receipts: 3,000 Redemption of term deposits 17,000 12,000 448 Proceeds from sale of IPPE 283 231 – Deferred debtors receipts 20 20 Payments: (900) Acquisition of term deposits (15,500) (11,000) (10,229) Payments for IPPE (8,228) (11,165) (7,681) Net cash flows from investing activities (6,425) (9,914) Cash flows from financing activities Payments: (264) Repayment of borrowings (97) (310) – Principal component of lease payments (46) (52) (264) Net cash flows from financing activities (143) (362) 3,612 Net change in cash and cash equivalents (14,042) 2,402 7,435 Cash and cash equivalents at beginning of year 19,393 16,991 11,047 Cash and cash equivalents at end of year C1-1 5,351 19,393 10,650 plus: Investments on hand at end of year C1-2 21,500 23,000 21,697 Total cash, cash equivalents and investments 26,851 42,393 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Walgett Shire Council Statement of Cash Flows for the year ended 30 June 2025 Page 9 of 86";

export const WALGETT_FUNCTIONS_TEXT = "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Community 740 1,094 5,533 5,507 (4,793) (4,413) 236 469 – – Economic Development 456 751 2,387 4,422 (1,931) (3,671) – 3 – – Governance and Civic Leadership 12,825 13,411 8,546 7,198 4,279 6,213 4,791 6,014 69,885 25,628 Infrastructure 16,343 25,644 25,192 20,512 (8,849) 5,132 15,727 21,650 354,010 404,716 Sustainable Living 7,301 7,485 5,384 6,176 1,917 1,309 – 220 77,607 53,152 Total functions and activities 37,665 48,385 47,042 43,815 (9,377) 4,570 20,754 28,356 501,502 483,496 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 86 Walgett Shire Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function walgettExtraction(): PdfExtraction {
  return {
    source: {
      sha256: WALGETT_FS_PDF_SHA256,
      bytes: WALGETT_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(WALGETT_INCOME_TEXT, 6),
      pdfPage(WALGETT_COMPREHENSIVE_TEXT, 7),
      pdfPage(WALGETT_POSITION_TEXT, 8),
      pdfPage(WALGETT_EQUITY_TEXT, 9),
      pdfPage(WALGETT_CASH_TEXT, 10),
      pdfPage(WALGETT_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const WALGETT_CONTEXT: WalgettGpfsParseContext = {
  document: {
    id: 'audited-financial-statements-2024-25',
    title:
      'Walgett Shire Council General Purpose Financial Statements for the year ended 30 June 2025',
    url: WALGETT_FS_PDF_URL,
    fiscal_year: WALGETT_GPFS_FISCAL_YEAR,
    listing_url: WALGETT_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'walgett-gpfs/Audited-Financial-Statements-2024-25.pdf',
    sha256: WALGETT_FS_PDF_SHA256,
    bytes: WALGETT_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: WALGETT_GPFS_REPORTING_URL,
};

/** 19 printed rows: 9 revenue (8 components + total) + 9 expense + 1 result. */
export const WALGETT_GPFS_ROW_COUNT = 19;
export const WALGETT_GPFS_GOLDEN_DIGEST = '15c05ec27d3f9315db99463c419a3b2f331190224f4bab2da7244679d52a4ffb';
export const ROW_COUNT = WALGETT_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = WALGETT_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseWalgettGpfsExtraction(walgettExtraction(), WALGETT_CONTEXT).records;
}
