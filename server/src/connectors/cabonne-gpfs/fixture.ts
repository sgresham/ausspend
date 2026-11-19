import {
  CABONNE_GPFS_FISCAL_YEAR,
  CABONNE_GPFS_REPORTING_URL,
  parseCabonneGpfsExtraction,
  type CabonneGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Cabonne Council Annual Financial
// Statements — GPFS for the year ended 30 June 2026 (77-page PDF; the GPFS
// primary statements are PDF pages 4-8 and B1-1 is PDF page 13). These
// reproduce the printed $'000 values used by the zero-tolerance reconciliation.
export const CABONNE_FS_PDF_URL =
  'https://www.cabonne.nsw.gov.au/files/98ceb2a5-f381-4fcb-b4e6-32cb52eab396/Annual_Financial_Statements-GPFS-2026.pdf';
export const CABONNE_FS_PDF_SHA256 =
  'acb8b3d53a4b795bfb6bd5dd4770e377fe24dfc0ca2801f44df9a348369d885f';
export const CABONNE_FS_PDF_BYTES = 8_577_237;

export const CABONNE_INCOME_TEXT =
  "Cabonne Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 18,052 Rates and annual charges B2-1 18,082 17,417 8,747 User charges and fees B2-2 10,321 9,105 388 Other revenues B2-3 871 3,801 12,674 Grants and contributions provided for operating purposes B2-4 15,902 13,228 9,498 Grants and contributions provided for capital purposes B2-4 20,626 18,002 1,545 Interest and investment income B2-5 3,405 2,597 189 Other income B2-6 772 194 – Net gain from the disposal of assets B4-1 39 314 51,093 Total income from continuing operations 70,018 64,658 Expenses from continuing operations 19,361 Employee benefits and on-costs B3-1 17,207 17,840 7,412 Materials and services B3-2 15,733 16,995 227 Borrowing costs B3-3 231 96 5,421 Other expenses B3-5 792 758 32,421 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 33,963 35,689 18,672 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 36,055 28,969 15,560 Depreciation, amortisation and impairment of non-financial assets B3-4 16,093 14,799 3,112 Operating result from continuing operations 19,962 14,170 3,112 Net operating result for the year attributable to Council 19,962 14,170 (6,386) Net operating result for the year before grants and contributions provided for capital purposes (664) (3,832) The above Income Statement should be read in conjunction with the accompanying notes. Cabonne Council Income Statement for the year ended 30 June 2026 Page 4 of 77";

export const CABONNE_COMPREHENSIVE_TEXT =
  "Cabonne Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 19,962 14,170 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-7 20,479 (77,100) Other comprehensive income – joint ventures and associates 597 904 Total items which will not be reclassified subsequent to operating result 21,076 (76,196) Total other comprehensive income for the year 21,076 (76,196) Total comprehensive income for the year attributable to Council 41,038 (62,026) The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Cabonne Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 77";

export const CABONNE_POSITION_TEXT =
  "Cabonne Council | Statement of Financial Position | as at 30 June 2026 §Statement§ $ '000 Notes 2026 2025 ASSETS Current assets Cash and cash equivalents C1-1 19,452 14,620 Investments C1-2 29,250 37,250 Receivables C1-4 4,632 7,088 Inventories C1-5 721 920 Contract assets and contract cost assets C1-6 6,305 4,421 Other 1,417 398 Total current assets 61,777 64,697 Non-current assets Investments C1-2 15,000 6,500 Receivables C1-4 349 349 Inventories C1-5 91 40 Infrastructure, property, plant and equipment (IPPE) C1-7 655,542 618,736 Intangible assets C1-8 118 128 Investments accounted for using the equity method D2-3 42,246 41,014 Other 282 282 Total non-current assets 713,628 667,049 Total assets 775,405 731,746 LIABILITIES Current liabilities Payables C3-1 5,113 4,037 Contract liabilities C3-2 9,611 8,464 Borrowings C3-3 260 2,239 Employee benefit provisions C3-4 3,258 3,413 Provisions C3-5 208 208 Total current liabilities 18,450 18,361 Non-current liabilities Payables C3-1 131 897 Borrowings C3-3 4,343 942 Employee benefit provisions C3-4 421 387 Provisions C3-5 2,361 2,498 Total non-current liabilities 7,256 4,724 Total liabilities 25,706 23,085 Net assets 749,699 708,661 EQUITY Accumulated surplus C4-1 446,835 426,276 IPPE revaluation surplus C4-1 302,864 282,385 Council equity interest 749,699 708,661 Total equity 749,699 708,661 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Cabonne Council Statement of Financial Position as at 30 June 2026 Page 6 of 77";

export const CABONNE_EQUITY_TEXT =
  "Cabonne Council | Statement of Changes in Equity | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 426,276 282,385 708,661 411,202 359,485 770,687 §Subnote§ Net operating result for the year 19,962 – 19,962 14,170 – 14,170 Other comprehensive income Gain on revaluation of infrastructure, property, plant and equipment C1-7 – 20,479 20,479 – (77,100) (77,100) Joint ventures and associates 597 – 597 904 – 904 Other comprehensive income 597 20,479 21,076 904 (77,100) (76,196) Total comprehensive income 20,559 20,479 41,038 15,074 (77,100) (62,026) Closing balance at 30 June 446,835 302,864 749,699 426,276 282,385 708,661 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Cabonne Council Statement of Changes in Equity for the year ended 30 June 2026 Page 7 of 77";

export const CABONNE_CASH_TEXT =
  "Cabonne Council | Statement of Cash Flows | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Cash flows from operating activities Receipts: 18,052 Rates and annual charges 18,365 17,627 8,747 User charges and fees 10,413 9,028 1,545 Interest received 3,496 2,245 22,172 Grants and contributions 38,471 21,846 – Bonds, deposits and retentions received – 590 577 Other 5,200 8,498 Payments: (19,361) Payments to employees (17,282) (17,637) (7,412) Payments for materials and services (14,887) (19,180) – Borrowing costs (369) 122 – Bonds, deposits and retentions refunded (1,278) – (5,421) Other (5,555) (5,584) 18,899 Net cash flows from operating activities G1-1 36,574 17,555 Cash flows from investing activities Receipts: – Sale of investments 30,500 21,250 – Sale of real estate assets 525 – – Proceeds from sale of IPPE 1,465 1,443 – Deferred debtors receipts 27 45 Payments: – Purchase of investments (30,500) (21,250) – Acquisition of term deposits (500) (2,000) (25,706) Payments for IPPE (34,623) (25,623) – Purchase of real estate assets (58) (279) – Purchase of intangible assets – (99) (25,706) Net cash flows used in investing activities (33,164) (26,513) Cash flows from financing activities Receipts: – Proceeds from borrowings 1,539 2,122 Payments: (227) Repayment of borrowings (117) (112) (227) Net cash flows from financing activities 1,422 2,010 (7,034) Net change in cash and cash equivalents 4,832 (6,948) 14,620 Cash and cash equivalents at beginning of year 14,620 21,568 7,586 Cash and cash equivalents at end of year C1-1 19,452 14,620 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Cabonne Council Statement of Cash Flows for the year ended 30 June 2026 Page 8 of 77";

export const CABONNE_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Connect Cabonne to each other and the World 27,761 27,141 22,701 21,951 5,060 5,190 21,422 21,649 501,617 489,741 Build Business and Generate employment 232 232 1,118 1,331 (886) (1,099) – 9 – 227 Provide and develop Community facilities 8,956 3,667 9,023 9,146 (67) (5,479) 7,852 1,947 126,947 96,884 Grow Cabonne Culture and Community 24,588 23,155 5,621 6,573 18,967 16,582 6,715 4,630 61,194 61,194 Manage our Natural Resources 8,481 10,463 11,593 11,487 (3,112) (1,024) 539 2,995 85,647 83,700 Total functions and activities 70,018 64,658 50,056 50,488 19,962 14,170 36,528 31,230 775,405 731,746 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 77 Cabonne Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function cabonneExtraction(): PdfExtraction {
  return {
    source: {
      sha256: CABONNE_FS_PDF_SHA256,
      bytes: CABONNE_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(CABONNE_INCOME_TEXT, 4),
      pdfPage(CABONNE_COMPREHENSIVE_TEXT, 5),
      pdfPage(CABONNE_POSITION_TEXT, 6),
      pdfPage(CABONNE_EQUITY_TEXT, 7),
      pdfPage(CABONNE_CASH_TEXT, 8),
      pdfPage(CABONNE_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const CABONNE_CONTEXT: CabonneGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-gpfs-2025-26',
    title: 'Cabonne Council Annual Financial Statements — GPFS for the year ended 30 June 2026',
    url: CABONNE_FS_PDF_URL,
    fiscal_year: CABONNE_GPFS_FISCAL_YEAR,
    listing_url: CABONNE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'cabonne-gpfs/Annual_Financial_Statements-GPFS-2026.pdf',
    sha256: CABONNE_FS_PDF_SHA256,
    bytes: CABONNE_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: CABONNE_GPFS_REPORTING_URL,
};

/** 17 printed rows: 9 revenue (8 components + total) + 7 expense + 1 result. */
export const CABONNE_GPFS_ROW_COUNT = 17;
export const CABONNE_GPFS_GOLDEN_DIGEST =
  '87c6cf58e31f0763adb65c2cc5e655337a308b22664f18a4811d1961cdaf1082';
export const ROW_COUNT = CABONNE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = CABONNE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseCabonneGpfsExtraction(cabonneExtraction(), CABONNE_CONTEXT).records;
}
