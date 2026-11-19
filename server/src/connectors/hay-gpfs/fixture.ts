import {
  HAY_GPFS_FISCAL_YEAR,
  HAY_GPFS_REPORTING_URL,
  parseHayGpfsExtraction,
  type HayGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Hay Shire Council Annual Financial
// Statements for the year ended 30 June 2026 (80-page PDF; the GPFS primary
// statements are PDF pages 5-9 and B1-1 is PDF page 14). These reproduce the
// printed $'000 values used by the zero-tolerance reconciliation.
export const HAY_FS_PDF_URL =
  'https://www.hay.nsw.gov.au/Portals/0/Files/Annual_Financial_Statements-2026.pdf';
export const HAY_FS_PDF_SHA256 =
  '710fce7da5e69d93cc30fc943e122c8a20b28d840f9726cfb90aa926cc7a75ce';
export const HAY_FS_PDF_BYTES = 1345435;

export const HAY_INCOME_TEXT =
  "Hay Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 5,643 Rates and annual charges B2-1 5,703 5,419 1,248 User charges and fees B2-2 1,798 1,389 100 Other revenues B2-3 101 165 7,796 Grants and contributions provided for operating purposes B2-4 9,803 6,964 7,387 Grants and contributions provided for capital purposes B2-4 6,568 5,265 565 Interest and investment income B2-5 518 708 110 Other income B2-6 100 102 22,849 Total income from continuing operations 24,591 20,012 Expenses from continuing operations 6,421 Employee benefits and on-costs B3-1 7,090 5,767 5,712 Materials and services B3-2 6,433 6,812 39 Borrowing costs B3-3 62 72 295 Other expenses B3-5 296 287 – Net loss from the disposal of assets B4-1 91 1,310 12,467 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 13,972 14,248 10,382 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 10,619 5,764 4,736 Depreciation, amortisation and impairment of non-financial assets B3-4 5,311 5,133 5,646 Operating result from continuing operations 5,308 631 5,646 Net operating result for the year attributable to Council 5,308 631 1,741 Net operating result for the year before grants and contributions provided for capital purposes (1,260) (4,634) The above Income Statement should be read in conjunction with the accompanying notes. Hay Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 59";

export const HAY_COMPREHENSIVE_TEXT =
  "Hay Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 5,308 631 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-5 13,779 28,664 Total items which will not be reclassified subsequent to operating result 13,779 28,664 Total other comprehensive income for the year 13,779 28,664 Total comprehensive income for the year attributable to Council 19,087 29,295 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Hay Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 59";

export const HAY_POSITION_TEXT =
  "Hay Shire Council | Statement of Financial Position | as at 30 June 2026 §Statement§ $ '000 Notes 2026 2025 ASSETS Current assets Cash and cash equivalents C1-1 20,384 21,521 Receivables C1-3 3,238 2,975 Inventories C1-4 82 277 Prepayments C1-6 53 162 Total current assets 23,757 24,935 Non-current assets Infrastructure, property, plant and equipment (IPPE) C1-5 268,252 249,712 Total non-current assets 268,252 249,712 Total assets 292,009 274,647 LIABILITIES Current liabilities Payables C3-1 983 1,517 Contract liabilities C3-2 796 2,071 Borrowings C3-3 283 273 Employee benefit provisions C3-4 2,211 1,855 Total current liabilities 4,273 5,716 Non-current liabilities Borrowings C3-3 526 809 Employee benefit provisions C3-4 111 79 Provisions C3-5 692 723 Total non-current liabilities 1,329 1,611 Total liabilities 5,602 7,327 Net assets 286,407 267,320 EQUITY Accumulated surplus 91,325 86,017 IPPE revaluation surplus 195,082 181,303 Total equity 286,407 267,320 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Hay Shire Council Statement of Financial Position as at 30 June 2026 Page 6 of 59";

export const HAY_EQUITY_TEXT =
  "Hay Shire Council | Statement of Changes in Equity | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 86,017 181,303 267,320 85,386 152,639 238,025 §Subnote§ Net operating result for the year 5,308 – 5,308 631 – 631 Net operating result for the period 5,308 – 5,308 631 – 631 Other comprehensive income Gain on revaluation of infrastructure, property, plant and equipment C1-5 – 13,779 13,779 – 28,664 28,664 Other comprehensive income – 13,779 13,779 – 28,664 28,664 Total comprehensive income 5,308 13,779 19,087 631 28,664 29,295 Closing balance at 30 June 91,325 195,082 286,407 86,017 181,303 267,320 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Hay Shire Council Statement of Changes in Equity for the year ended 30 June 2026 Page 7 of 59";

export const HAY_CASH_TEXT =
  "Hay Shire Council | Statement of Cash Flows | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Cash flows from operating activities Receipts: 5,643 Rates and annual charges 5,592 5,398 1,248 User charges and fees 1,776 1,287 565 Interest received 488 718 15,183 Grants and contributions 14,931 13,134 – Bonds, deposits and retentions received 19 92 210 Other 1,881 1,596 Payments: (7,342) Payments to employees (6,693) (5,741) (4,426) Payments for materials and services (8,660) (8,689) (24) Borrowing costs (41) (50) (295) Other (194) (277) 10,762 Net cash flows from operating activities G1-1 9,099 7,468 Cash flows from investing activities Receipts: 101 Proceeds from sale of IPPE 191 166 Payments: (11,042) Payments for IPPE (10,154) (8,075) – Purchase of real estate assets – (1) (10,941) Net cash flows used in investing activities (9,963) (7,910) Cash flows from financing activities Payments: (273) Repayment of borrowings (273) (262) (273) Net cash flow provided used in financing activities (273) (262) (452) Net change in cash and cash equivalents (1,137) (704) 16,085 Cash and cash equivalents at beginning of year 21,521 22,225 15,633 Cash and cash equivalents at end of year C1-1 20,384 21,521 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Hay Shire Council Statement of Cash Flows for the year ended 30 June 2026 Page 8 of 59";

export const HAY_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Governance 1 – 1,168 1,027 (1,167) (1,027) – – – – Administration 122 193 2,531 2,177 (2,409) (1,984) – – 16,216 17,744 Public Order and Safety 142 429 714 678 (572) (249) 128 418 2,263 2,308 Health 7 5 6 5 1 – – – 3,361 3,272 Environment 1,058 1,231 1,474 1,351 (416) (120) 52 354 21,595 18,872 Community Services and Education 729 963 862 660 (133) 303 674 895 1,371 1,334 Housing and Community Amenities 370 718 1,936 1,868 (1,566) (1,150) 150 482 4,119 3,690 Water Supplies 1,871 1,699 1,694 1,822 177 (123) 58 167 25,363 24,554 Sewerage Services 1,320 1,254 1,376 1,611 (56) (357) 11 77 27,502 27,138 Recreation and Culture 5,291 3,267 1,875 3,003 3,416 264 5,214 3,149 40,213 32,612 Mining Manufacturing and Construction 19 10 96 91 (77) (81) – – 70 101 Transport and Communication 3,025 3,574 3,971 3,783 (946) (209) 3,015 3,564 148,300 141,417 Economic Affairs 924 273 1,580 1,305 (656) (1,032) 639 51 1,636 1,605 General Purpose 9,712 6,396 – – 9,712 6,396 6,430 3,072 – – Total functions and activities 24,591 20,012 19,283 19,381 5,308 631 16,371 12,229 292,009 274,647 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 59 Hay Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function hayExtraction(): PdfExtraction {
  return {
    source: {
      sha256: HAY_FS_PDF_SHA256,
      bytes: HAY_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(HAY_INCOME_TEXT, 5),
      pdfPage(HAY_COMPREHENSIVE_TEXT, 6),
      pdfPage(HAY_POSITION_TEXT, 7),
      pdfPage(HAY_EQUITY_TEXT, 8),
      pdfPage(HAY_CASH_TEXT, 9),
      pdfPage(HAY_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const HAY_CONTEXT: HayGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2025-26',
    title: 'Hay Shire Council Annual Financial Statements for the year ended 30 June 2026',
    url: HAY_FS_PDF_URL,
    fiscal_year: HAY_GPFS_FISCAL_YEAR,
    listing_url: HAY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'hay-gpfs/Annual_Financial_Statements-2026.pdf',
    sha256: HAY_FS_PDF_SHA256,
    bytes: HAY_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: HAY_GPFS_REPORTING_URL,
};

/** 17 printed rows: 8 revenue + 8 expense (including the bridge) + 1 result. */
export const HAY_GPFS_ROW_COUNT = 17;
export const HAY_GPFS_GOLDEN_DIGEST =
  '365bce50a5c54364a274d09f0dea7efdfe2c807726adf8691c79e474aa7f9c50';
export const ROW_COUNT = HAY_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = HAY_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseHayGpfsExtraction(hayExtraction(), HAY_CONTEXT).records;
}
