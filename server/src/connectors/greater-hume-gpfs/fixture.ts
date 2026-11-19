import {
  GREATER_HUME_GPFS_FISCAL_YEAR,
  GREATER_HUME_GPFS_REPORTING_URL,
  parseGreaterHumeGpfsExtraction,
  type GreaterHumeGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Banked text from the official Greater Hume Shire Council audited Annual
// Financial Statements 2025-2026 (122-page PDF; the GPFS primary statements are
// PDF pages 8-12 and B1-1 is PDF page 18). These reproduce the printed $'000
// values used by the zero-tolerance reconciliation. FY2025-26 is the current
// audited GPFS presented to Council on 18 November 2026.
export const GREATER_HUME_FS_PDF_URL =
  'https://www.greaterhume.nsw.gov.au/files/sharedassets/public/v/1/have-your-say/2026/greater-hume-council-financial-statements-2025-2026-final.pdf';
export const GREATER_HUME_FS_PDF_SHA256 =
  'f181da5b9a70f33ec4c2a2ee5fbac7b0eae5ebd4162e91624226c675fefe9db5';
export const GREATER_HUME_FS_PDF_BYTES = 26_114_412;

export const GREATER_HUME_INCOME_TEXT = "Greater Hume Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 15,729 Rates and annual charges B2-1 15,482 14,536 8,578 User charges and fees B2-2 9,875 8,946 2,335 Other revenues B2-3 2,108 2,585 15,468 Grants and contributions provided for operating purposes B2-4 19,622 15,614 2,527 Grants and contributions provided for capital purposes B2-4 1,494 14,423 1,062 Interest and investment income B2-5 1,622 1,225 – Other income B2-6 239 263 – Net gain from the disposal of assets B4-1 1,258 – 45,699 Total income from continuing operations 51,700 57,592 Expenses from continuing operations 15,334 Employee benefits and on-costs B3-1 15,967 15,049 15,349 Materials and services B3-2 15,860 15,733 76 Borrowing costs B3-3 175 217 492 Other expenses B3-5 1,907 1,588 – Net loss from the disposal of assets B4-1 – 405 31,251 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 33,909 32,992 14,448 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 17,791 24,600 14,535 Depreciation, amortisation and impairment of non-financial assets B3-4 18,106 15,395 (87) Net operating result for the year attributable to Council (315) 9,205 (2,614) Net operating result for the year before grants and contributions provided for capital purposes (1,809) (5,218) The above Income Statement should be read in conjunction with the accompanying notes. Greater Hume Shire Council Income Statement for the year ended 30 June 2026 Page 6 of 85";

export const GREATER_HUME_COMPREHENSIVE_TEXT = "Greater Hume Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement (315) 9,205 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-6 31,285 41,752 Total items which will not be reclassified subsequent to operating result 31,285 41,752 Total other comprehensive income for the year 31,285 41,752 Total comprehensive income for the year attributable to Council 30,970 50,957 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Greater Hume Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 7 of 85";

export const GREATER_HUME_POSITION_TEXT = "Greater Hume Shire Council | Statement of Financial Position | as at 30 June 2026 §Statement§ $ '000 Notes 2026 2025 ASSETS Current assets Cash and cash equivalents C1-1 16,725 14,648 Investments C1-2 27,501 16,050 Receivables C1-4 5,671 7,472 Inventories C1-5 1,042 2,414 Total current assets 50,939 40,584 Non-current assets Receivables C1-4 – 10 Infrastructure, property, plant and equipment (IPPE) C1-6 930,179 906,787 Total non-current assets 930,179 906,797 Total assets 981,118 947,381 LIABILITIES Current liabilities Payables C3-1 5,685 3,621 Contract liabilities C3-2 696 303 Borrowings C3-3 416 410 Employee benefit provisions C3-4 3,748 3,621 Asset Remediation Provision C3-5 102 1,425 Total current liabilities 10,647 9,380 Non-current liabilities Borrowings C3-3 1,513 1,923 Employee benefit provisions C3-4 340 223 Asset Remediation Provision C3-5 4,158 2,365 Total non-current liabilities 6,011 4,511 Total liabilities 16,658 13,891 Net assets 964,460 933,490 EQUITY Accumulated surplus 289,952 290,267 IPPE revaluation surplus 674,508 643,223 Council equity interest 964,460 933,490 Total equity 964,460 933,490 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Greater Hume Shire Council Statement of Financial Position as at 30 June 2026 Page 8 of 85";

export const GREATER_HUME_EQUITY_TEXT = "Greater Hume Shire Council | Statement of Changes in Equity | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 290,267 643,223 933,490 281,062 601,471 882,533 Opening balance 290,267 643,223 933,490 281,062 601,471 882,533 §Subnote§ Net operating result for the year (315) – (315) 9,205 – 9,205 Net operating result for the year (315) – (315) 9,205 – 9,205 Other comprehensive income – Gain on revaluation of infrastructure, property, plant and equipment C1-6 – 31,285 31,285 – 41,752 41,752 Other comprehensive income – 31,285 31,285 – 41,752 41,752 Total comprehensive income (315) 31,285 30,970 9,205 41,752 50,957 Closing balance at 30 June 289,952 674,508 964,460 290,267 643,223 933,490 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Greater Hume Shire Council Statement of Changes in Equity for the year ended 30 June 2026 Page 9 of 85";

export const GREATER_HUME_CASH_TEXT = "Greater Hume Shire Council | Statement of Cash Flows | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Cash flows from operating activities Receipts: 15,729 Rates and annual charges 15,923 14,336 8,578 User charges and fees 9,906 9,840 1,062 Interest received 839 2,032 17,995 Grants and contributions 22,592 34,385 – Bonds, deposits and retentions received 88 – 2,335 Other 5,556 3,364 Payments: (15,334) Payments to employees (15,761) (14,974) (15,349) Payments for materials and services (17,117) (19,705) (76) Borrowing costs (143) (6) – Bonds, deposits and retentions refunded – (458) (492) Other (1,136) (3,983) 14,448 Net cash flows from / (used in) operating activities G1-1 20,747 24,831 Cash flows from investing activities Receipts: – Sale of investments 14,900 12,598 1,448 Sale of real estate assets 2,718 1,035 412 Proceeds from sale of IPPE 135 147 10 Deferred debtors receipts – 9 Payments: (50) Purchase of investments (26,351) (9,940) (16,096) Payments for IPPE (9,533) (24,107) – Purchase of real estate assets – (297) – Deferred debtors and advances made (135) – (14,276) Net cash flows from/ (used in) investing activities (18,266) (20,555) Cash flows from financing activities Payments: (406) Repayment of borrowings (404) (651) – Principal component of lease payments – (16) (406) Net cash flow from/(used in) financing activities (404) (667) (234) Net change in cash and cash equivalents 2,077 3,609 14,648 Cash and cash equivalents at beginning of year 14,648 11,039 14,414 Cash and cash equivalents at end of year C1-1 16,725 14,648 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Greater Hume Shire Council Statement of Cash Flows for the year ended 30 June 2026 Page 10 of 85";

export const GREATER_HUME_FUNCTIONS_TEXT = "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Governance 16 19 1,712 1,976 (1,696) (1,957) 10 15 – 30 Administration 1,384 1,580 5,278 2,510 (3,894) (930) 2 26 62,539 58,398 Public order and safety 426 437 1,779 1,619 (1,353) (1,182) 416 397 5,939 5,632 Health 195 220 107 133 88 87 – – – – Environment 2,242 6,127 5,066 3,294 (2,824) 2,833 254 3,936 4,115 4,370 Community services and education 6,034 5,031 5,639 5,022 395 9 4,321 3,288 10,512 9,950 Housing and community amenities 1,025 1,353 1,412 1,300 (387) 53 583 329 32,132 5,090 Water supplies 3,214 3,029 2,944 2,702 270 327 80 85 28,228 26,411 Sewerage services 2,970 2,772 2,484 2,149 486 623 717 659 43,450 44,291 Recreation and culture 631 2,691 4,480 5,170 (3,849) (2,479) 561 2,279 65,762 64,982 Mining, manufacturing and construction 1,148 144 769 593 379 (449) – – 1,857 934 Transport and communication 7,958 16,180 19,064 20,622 (11,106) (4,442) 4,135 13,374 718,192 718,642 Economic affairs 2,047 1,647 1,281 1,297 766 350 – 641 8,392 8,651 General purpose income 22,410 16,362 – – 22,410 16,362 10,037 5,008 – – Total functions and activities 51,700 57,592 52,015 48,387 (315) 9,205 21,116 30,037 981,118 947,381 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 16 of 85 Greater Hume Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function greaterHumeExtraction(): PdfExtraction {
  return {
    source: {
      sha256: GREATER_HUME_FS_PDF_SHA256,
      bytes: GREATER_HUME_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(GREATER_HUME_INCOME_TEXT, 8),
      pdfPage(GREATER_HUME_COMPREHENSIVE_TEXT, 9),
      pdfPage(GREATER_HUME_POSITION_TEXT, 10),
      pdfPage(GREATER_HUME_EQUITY_TEXT, 11),
      pdfPage(GREATER_HUME_CASH_TEXT, 12),
      pdfPage(GREATER_HUME_FUNCTIONS_TEXT, 18),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const GREATER_HUME_CONTEXT: GreaterHumeGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2025-26',
    title:
      'Greater Hume Shire Council Annual Financial Statements 2025-2026 (GPFS for the year ended 30 June 2026)',
    url: GREATER_HUME_FS_PDF_URL,
    fiscal_year: GREATER_HUME_GPFS_FISCAL_YEAR,
    listing_url: GREATER_HUME_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'greater-hume-gpfs/greater-hume-council-financial-statements-2025-2026-final.pdf',
    sha256: GREATER_HUME_FS_PDF_SHA256,
    bytes: GREATER_HUME_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: GREATER_HUME_GPFS_REPORTING_URL,
};

/** 18 printed rows: 9 revenue (8 components + total) + 8 expense + 1 result. */
export const GREATER_HUME_GPFS_ROW_COUNT = 18;
export const GREATER_HUME_GPFS_GOLDEN_DIGEST =
  '4b224f7abd66c3da1e83df1e220cc948715050cbef1eef833fafc1914b8c4130';
export const ROW_COUNT = GREATER_HUME_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = GREATER_HUME_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseGreaterHumeGpfsExtraction(greaterHumeExtraction(), GREATER_HUME_CONTEXT).records;
}
