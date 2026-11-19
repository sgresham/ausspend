import {
  CARRATHOOL_GPFS_FISCAL_YEAR,
  CARRATHOOL_GPFS_REPORTING_URL,
  parseCarrathoolGpfsExtraction,
  type CarrathoolGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Carrathool Shire Council Annual
// Financial Statements for the year ended 30 June 2026 (114-page PDF; the GPFS
// primary statements are PDF pages 6-10 and B1-1 is PDF page 16). These
// reproduce the printed $'000 values used by the zero-tolerance reconciliation.
export const CARRATHOOL_FS_PDF_URL =
  'https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf';
export const CARRATHOOL_FS_PDF_SHA256 =
  'cf6c36b1c5fdeb5b95f21a4c2bac45a7b7715b38fa71cd8d5aa602ce11757ec4';
export const CARRATHOOL_FS_PDF_BYTES = 5_397_495;

export const CARRATHOOL_INCOME_TEXT =
  "Carrathool Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 6,720 Rates and annual charges B2-1 6,826 6,454 4,811 User charges and fees B2-2 3,310 3,074 505 Other revenues B2-3 524 524 14,612 Grants and contributions provided for operating purposes B2-4 21,467 11,398 471 Grants and contributions provided for capital purposes B2-4 1,953 1,519 1,250 Interest and investment income B2-5 1,949 2,085 28,369 Total income from continuing operations 36,029 25,054 Expenses from continuing operations 9,877 Employee benefits and on-costs B3-1 9,413 9,421 6,522 Materials and services B3-2 4,564 5,985 63 Borrowing costs B3-3 62 131 404 Other expenses B3-5 456 431 4 Net loss from the disposal of assets B4-1 877 248 16,870 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 15,372 16,216 11,499 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 20,657 8,838 6,409 Depreciation, amortisation and impairment of non-financial assets B3-4 6,549 6,317 5,090 Operating result from continuing operations 14,108 2,521 5,090 Net operating result for the year attributable to Council 14,108 2,521 4,626 Net operating result for the year before grants and contributions provided for capital purposes 12,155 1,002 The above Income Statement should be read in conjunction with the accompanying notes. Carrathool Shire Council Income Statement for the year ended 30 June 2026 Page 5 of 88";

export const CARRATHOOL_COMPREHENSIVE_TEXT =
  "Carrathool Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 14,108 2,521 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 22,823 11,039 Total items which will not be reclassified subsequent to operating result 22,823 11,039 Amounts which will be reclassified subsequent to operating result when specific conditions are met Other movements 3 24 Total items which will be reclassified subsequent to operating result when specific conditions are met 3 24 Total other comprehensive income for the year 22,826 11,063 Total comprehensive income for the year attributable to Council 36,934 13,584 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Carrathool Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6 of 88";

export const CARRATHOOL_POSITION_TEXT =
  "Carrathool Shire Council | Statement of Financial Position | as at 30 June 2026 §Statement§ $ '000 Notes 2026 2025 ASSETS Current assets Cash and cash equivalents C1-1 37,960 34,717 Investments C1-2 14,905 8,064 Receivables C1-4 829 897 Inventories C1-5 2,359 2,594 Total current assets 56,053 46,272 Non-current assets Receivables C1-4 490 556 Infrastructure, property, plant and equipment (IPPE) C1-6 334,549 306,780 Intangible assets C1-7 1,773 1,773 Total non-current assets 336,812 309,109 Total assets 392,865 355,381 LIABILITIES Current liabilities Payables C2-1 947 1,228 Contract liabilities C2-2 362 9 Borrowings C2-3 306 331 Employee benefit provisions C2-4 2,745 2,750 Total current liabilities 4,360 4,318 Non-current liabilities Borrowings C2-3 1,297 1,604 Employee benefit provisions C2-4 206 194 Provisions C2-5 2,832 2,029 Total non-current liabilities 4,335 3,827 Total liabilities 8,695 8,145 Net assets 384,170 347,236 EQUITY Accumulated surplus 185,729 171,618 IPPE revaluation surplus 198,441 175,618 Council equity interest 384,170 347,236 Total equity 384,170 347,236 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Carrathool Shire Council Statement of Financial Position as at 30 June 2026 Page 7 of 88";

export const CARRATHOOL_EQUITY_TEXT =
  "Carrathool Shire Council | Statement of Changes in Equity | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 171,618 175,618 347,236 169,078 164,574 333,652 §Subnote§ Net operating result for the year 14,108 – 14,108 2,521 – 2,521 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 – 22,823 22,823 – 11,039 11,039 Rounding 3 – 3 24 – 24 Other comprehensive income 3 22,823 22,826 24 11,039 11,063 Total comprehensive income 14,111 22,823 36,934 2,545 11,039 13,584 Transfers between equity items – – – (5) 5 – Closing balance at 30 June 185,729 198,441 384,170 171,618 175,618 347,236 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Carrathool Shire Council Statement of Changes in Equity for the year ended 30 June 2026 Page 8 of 88";

export const CARRATHOOL_CASH_TEXT =
  "Carrathool Shire Council | Statement of Cash Flows | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Cash flows from operating activities Receipts: 6,720 Rates and annual charges 7,012 6,408 4,811 User charges and fees 3,472 3,245 1,979 Interest received 1,949 2,131 15,083 Grants and contributions 22,931 12,572 – Bonds, deposits and retentions received – 2 505 Other 1,813 2,077 Payments: (9,877) Payments to employees (9,387) (9,600) (6,522) Payments for materials and services (5,075) (8,130) (63) Borrowing costs (63) (132) – Bonds, deposits and retentions refunded (12) – (404) Other (761) (1,492) 12,232 Net cash flows from operating activities G1-1 21,879 7,081 Cash flows from / (used in) investing activities Receipts: – Proceeds from sale of IPPE 1,244 1,322 Payments: – Acquisition of term deposits (6,841) 8,494 (10,826) Payments for IPPE (12,707) (10,418) – Purchase of intangible assets – (1,773) (10,826) Net cash flows from / (used in) investing activities (18,304) (2,375) Cash flows from / (used in) financing activities Payments: (331) Repayment of borrowings (332) (320) (331) Net cash flows from / (used in) financing activities (332) (320) 1,075 Net change in cash and cash equivalents 3,243 4,386 31,486 Cash and cash equivalents at beginning of year 34,717 30,331 32,561 Cash and cash equivalents at end of year C1-1 37,960 34,717 17,319 plus: Investments on hand at end of year C1-2 14,905 8,064 49,880 Total cash, cash equivalents and investments 52,865 42,781 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Carrathool Shire Council Statement of Cash Flows for the year ended 30 June 2026 Page 9 of 88";

export const CARRATHOOL_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Governance 10 10 610 612 (600) (602) – – – – Administration 1,223 858 4,035 3,464 (2,812) (2,606) 7,240 546 62,775 50,110 Public Order and Safety 164 178 599 552 (435) (374) 156 174 2,181 1,516 Health 220 256 424 477 (204) (221) – – 705 1,140 Environment 103 87 338 314 (235) (227) 97 243 7,387 8,024 Community Services and Education 644 701 747 854 (103) (153) 643 701 – 504 Housing and Community Amenities 901 871 1,546 1,268 (645) (397) 44 43 1,792 5,307 Water Supplies 3,449 3,019 3,700 2,894 (251) 125 61 137 42,875 42,650 Sewerage Services 840 785 509 478 331 307 4 4 8,330 7,983 Recreation and Culture 465 759 1,988 2,034 (1,523) (1,275) 1,720 710 15,645 14,691 Transport & Communication 9,106 4,899 6,286 8,489 2,820 (3,590) 13,419 4,764 233,586 205,000 Economic Affairs 824 801 1,139 1,097 (315) (296) 36 17 17,589 18,456 General Purpose Income 18,080 11,830 – – 18,080 11,830 – 5,798 – – Other – – – – – – – (220) – – Total functions and activities 36,029 25,054 21,921 22,533 14,108 2,521 23,420 12,917 392,865 355,381 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 15 of 88 Carrathool Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function carrathoolExtraction(): PdfExtraction {
  return {
    source: {
      sha256: CARRATHOOL_FS_PDF_SHA256,
      bytes: CARRATHOOL_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(CARRATHOOL_INCOME_TEXT, 6),
      pdfPage(CARRATHOOL_COMPREHENSIVE_TEXT, 7),
      pdfPage(CARRATHOOL_POSITION_TEXT, 8),
      pdfPage(CARRATHOOL_EQUITY_TEXT, 9),
      pdfPage(CARRATHOOL_CASH_TEXT, 10),
      pdfPage(CARRATHOOL_FUNCTIONS_TEXT, 16),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const CARRATHOOL_CONTEXT: CarrathoolGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2025-26',
    title: 'Carrathool Shire Council Annual Financial Statements for the year ended 30 June 2026',
    url: CARRATHOOL_FS_PDF_URL,
    fiscal_year: CARRATHOOL_GPFS_FISCAL_YEAR,
    listing_url: CARRATHOOL_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'carrathool-gpfs/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf',
    sha256: CARRATHOOL_FS_PDF_SHA256,
    bytes: CARRATHOOL_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: CARRATHOOL_GPFS_REPORTING_URL,
};

/** 16 printed rows: 7 revenue + 8 expense (including the bridge) + 1 result. */
export const CARRATHOOL_GPFS_ROW_COUNT = 16;
export const CARRATHOOL_GPFS_GOLDEN_DIGEST =
  'dec478bffc0c224a79d778652e5f13956e3686154afd54581cbeb6d8a37cfc76';
export const ROW_COUNT = CARRATHOOL_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = CARRATHOOL_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseCarrathoolGpfsExtraction(carrathoolExtraction(), CARRATHOOL_CONTEXT).records;
}
