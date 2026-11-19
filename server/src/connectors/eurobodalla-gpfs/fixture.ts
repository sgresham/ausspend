import {
  EUROBODALLA_GPFS_FISCAL_YEAR,
  EUROBODALLA_GPFS_REPORTING_URL,
  parseEurobodallaGpfsExtraction,
  type EurobodallaGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Eurobodalla Shire Council Annual
// Financial Statements for the year ended 30 June 2026 (105-page PDF; the GPFS
// primary statements are extraction pages 5-9 and B1-1 is page 14). These
// reproduce the printed $'000 values used by the zero-tolerance reconciliation.
export const EUROBODALLA_FS_PDF_URL =
  'https://www.esc.nsw.gov.au/__data/assets/pdf_file/0004/290047/Annual_Financial_Statements-2026-_Audited.pdf';
export const EUROBODALLA_FS_PDF_SHA256 =
  'b729322500f9ac43204c38925fbad62b2bf10b893fdc45956cc43ea95702b89e';
export const EUROBODALLA_FS_PDF_BYTES = 3380012;

export const EUROBODALLA_INCOME_TEXT =
  "Eurobodalla Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 83,973 Rates and annual charges B2-1 83,455 79,884 35,778 User charges and fees B2-2 31,845 35,751 4,610 Other revenue B2-3 4,434 3,948 16,243 Grants and contributions provided for operating purposes B2-4 20,773 14,936 38,609 Grants and contributions provided for capital purposes B2-4 44,004 41,350 6,328 Interest and investment income B2-5 7,699 7,035 3,053 Other income C2-2,B2-6 2,957 2,793 188,594 Total income from continuing operations 195,167 185,697 Expenses from continuing operations 52,169 Employee benefits and on-costs B3-1 51,836 54,586 44,713 Materials and services B3-2 46,326 47,755 2,375 Borrowing costs B3-3 2,535 2,748 2,062 Other expenses B3-5 2,042 2,079 408 Net loss from the disposal of assets B4-1 4,174 4,473 101,727 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 106,913 111,641 86,867 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 88,254 74,056 49,781 Depreciation, amortisation and impairment of non-financial assets B3-4 52,762 46,978 37,086 Operating result from continuing operations 35,492 27,078 37,086 Net operating result for the year attributable to Council 35,492 27,078 (1,524) Net operating result for the year before grants and contributions provided for capital purposes (8,512) (14,272) The above Income Statement should be read in conjunction with the accompanying notes. Eurobodalla Shire Council Income Statement for the year ended 30 June 2026 Page 5 of 79";

export const EUROBODALLA_COMPREHENSIVE_TEXT =
  "Eurobodalla Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 35,492 27,078 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 70,799 59,407 Amounts which will be reclassified subsequent to operating result when specific conditions are met Other movements 309 1,006 Total other comprehensive income for the year 71,108 60,413 Total comprehensive income for the year attributable to Council 106,600 87,491 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Eurobodalla Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6 of 79";

export const EUROBODALLA_POSITION_TEXT =
  "Eurobodalla Shire Council | Statement of Financial Position | as at 30 June 2026 §Statement§ 2026 2025 Notes $ '000 $ '000 ASSETS Current assets Cash and cash equivalents C1-1 18,978 24,526 Investments C1-2 122,754 147,030 Receivables C1-4 21,525 16,358 Inventories C1-5 1,557 1,595 Contract assets and contract cost assets C1-6 4,298 315 Non-Current assets classified as 'held for sale' 28 30 Other 1,489 1,030 Total current assets 170,629 190,884 Non-current assets Investments C1-2 32,000 8,000 Receivables C1-4 5 5 Infrastructure, property, plant and equipment (IPPE) C1-7 2,393,775 2,312,244 Right of use assets C2-1 88 375 Total non-current assets 2,425,868 2,320,624 Total assets 2,596,497 2,511,508 LIABILITIES Current liabilities Payables C3-1 12,836 16,040 Contract liabilities C3-2 11,851 21,301 Lease liabilities C2-1 286 188 Borrowings C3-3 7,702 8,197 Employee benefit provisions C3-4 11,961 12,445 Total current liabilities 44,636 58,171 Non-current liabilities Lease liabilities C2-1 39 339 Borrowings C3-3 79,223 86,925 Employee benefit provisions C3-4 904 898 Provisions C3-5 10,527 10,607 Total non-current liabilities 90,693 98,769 Total liabilities 135,329 156,940 Net assets 2,461,168 2,354,568 EQUITY Accumulated surplus 1,197,087 1,155,363 IPPE revaluation surplus C4-1 1,264,081 1,199,205 Council equity interest 2,461,168 2,354,568 Total equity 2,461,168 2,354,568 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Eurobodalla Shire Council Statement of Financial Position as at 30 June 2026 Page 7 of 79";

export const EUROBODALLA_EQUITY_TEXT =
  "Eurobodalla Shire Council | Statement of Changes in Equity | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Notes $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Opening balance at 1 July 1,155,363 1,199,205 2,354,568 1,121,236 1,145,841 2,267,077 §Subnote§ Net operating result for the year 35,492 – 35,492 27,078 – 27,078 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 – 70,799 70,799 – 59,407 59,407 Other reserves movements C4-1 6,232 (5,923) 309 7,049 (6,043) 1,006 Other comprehensive income 6,232 64,876 71,108 7,049 53,364 60,413 Total comprehensive income 41,724 64,876 106,600 34,127 53,364 87,491 Closing balance at 30 June 1,197,087 1,264,081 2,461,168 1,155,363 1,199,205 2,354,568 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Eurobodalla Shire Council Statement of Changes in Equity for the year ended 30 June 2026 Page 8 of 79";

export const EUROBODALLA_CASH_TEXT =
  "Eurobodalla Shire Council | Statement of Cash Flows | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Cash flows from operating activities Receipts: 83,973 Rates and annual charges 83,315 79,506 35,778 User charges and fees 34,484 44,036 6,328 Interest received 6,862 7,552 45,488 Grants and contributions 43,386 59,770 – Bonds, deposits and retentions received 460 489 7,663 Other 10,137 21,862 Payments: (52,169) Payments to employees (52,314) (54,369) (44,713) Payments for materials and services (56,481) (71,276) (2,375) Borrowing costs (2,318) (2,684) (2,062) Other (3,445) (1,146) 77,911 Net cash flows from operating activities G1-1 64,086 83,740 Cash flows from investing activities Receipts: – Redemption of term deposits 134,000 63,000 801 Proceeds from sale of IPPE 1,212 872 – Deferred debtors receipts – 6 Payments: – Acquisition of term deposits (133,724) (86,010) (64,007) Payments for IPPE (62,705) (95,343) – Purchase of real estate assets (157) – – Deferred debtors and advances made (54) – (63,206) Net cash flows from investing activities (61,428) (117,475) Cash flows from financing activities Receipts: – Proceeds from borrowings – 40,000 Payments: (7,302) Repayment of borrowings (8,197) (8,102) – Principal component of lease payments (9) (24) (7,302) Net cash flows from financing activities (8,206) 31,874 7,403 Net change in cash and cash equivalents (5,548) (1,861) 26,387 Cash and cash equivalents at beginning of year 24,526 26,387 33,790 Cash and cash equivalents at end of year C1-1 18,978 24,526 155,030 plus: Investments on hand at end of year C1-2 154,754 155,030 188,820 Total cash, cash equivalents and investments 173,732 179,556 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Eurobodalla Shire Council Statement of Cash Flows for the year ended 30 June 2026 Page 9 of 79";

export const EUROBODALLA_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Ageing and disability services 1,145 6,537 2,701 8,590 (1,556) (2,053) 980 1,246 – 6 Business, tourism and attractions 473 4,606 3,536 3,535 (3,063) 1,071 282 4,460 277 274 Children and youth services 2,584 2,128 3,459 3,043 (875) (915) 807 763 2,739 2,740 Commercial services 4,010 4,412 2,572 1,702 1,438 2,710 – 875 92,573 86,328 Community and cultural development 1,701 407 1,608 1,636 93 (1,229) 1,679 354 – – Community facilities and spaces 432 892 7,136 7,037 (6,704) (6,145) 83 512 34,492 34,987 Corporate and community leadership 36 11 4,645 5,094 (4,609) (5,083) – 2 – – Development assessment and building certification 1,622 1,832 3,687 5,183 (2,065) (3,351) – 169 – – Finance and revenue 50,230 45,020 6,375 5,013 43,855 40,007 9,391 5,207 – – Information and support services 310 290 10,115 9,715 (9,805) (9,425) 12 – 22,290 23,070 Infrastructure services 320 169 4,031 4,315 (3,711) (4,146) 147 57 20,892 21,358 Libraries 529 409 2,272 2,554 (1,743) (2,145) 453 340 3,900 3,854 Overheads – – (23,208) (23,982) 23,208 23,982 – – 26 36 People and safety 165 224 2,430 2,722 (2,265) (2,498) 22 68 – – Property 1,131 1,372 2,887 1,962 (1,756) (590) – – 249,355 254,325 Public and environmental health 403 447 1,130 1,039 (727) (592) – – 43 43 Public order and safety 2,033 801 5,959 6,576 (3,926) (5,775) 1,702 556 16,697 11,140 Recreation 11,282 8,808 16,446 15,975 (5,164) (7,167) 6,419 4,098 188,842 166,402 Sewer services 30,228 30,395 28,690 25,466 1,538 4,929 1,116 3,160 412,682 404,593 Stormwater 529 730 2,368 2,324 (1,839) (1,594) 19 224 154,734 151,293 Strategy and sustainability 3,436 1,671 3,892 4,043 (456) (2,372) 3,311 1,671 3,528 4,631 Transport 20,786 28,119 29,037 29,987 (8,251) (1,868) 18,864 25,380 921,866 891,683 Waste management 19,571 17,484 16,679 15,849 2,892 1,635 1,458 165 18,807 18,362 Water services 42,211 28,933 21,228 19,241 20,983 9,692 18,032 6,979 452,754 436,382 Total functions and activities 195,167 185,697 159,675 158,619 35,492 27,078 64,777 56,286 2,596,497 2,511,507 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 79 Eurobodalla Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function eurobodallaExtraction(): PdfExtraction {
  return {
    source: {
      sha256: EUROBODALLA_FS_PDF_SHA256,
      bytes: EUROBODALLA_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(EUROBODALLA_INCOME_TEXT, 5),
      pdfPage(EUROBODALLA_COMPREHENSIVE_TEXT, 6),
      pdfPage(EUROBODALLA_POSITION_TEXT, 7),
      pdfPage(EUROBODALLA_EQUITY_TEXT, 8),
      pdfPage(EUROBODALLA_CASH_TEXT, 9),
      pdfPage(EUROBODALLA_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const EUROBODALLA_CONTEXT: EurobodallaGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2025-26',
    title: 'Annual Financial Statements for the year ended 30 June 2026',
    url: EUROBODALLA_FS_PDF_URL,
    fiscal_year: EUROBODALLA_GPFS_FISCAL_YEAR,
    listing_url: EUROBODALLA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'eurobodalla-gpfs/Annual_Financial_Statements-2026-_Audited.pdf',
    sha256: EUROBODALLA_FS_PDF_SHA256,
    bytes: EUROBODALLA_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: EUROBODALLA_GPFS_REPORTING_URL,
};

/** 17 printed rows: 7 revenue + 8 expense (including the total bridge) + 1 result. */
export const EUROBODALLA_GPFS_ROW_COUNT = 17;
export const EUROBODALLA_GPFS_GOLDEN_DIGEST =
  '4fc6f8e1b0eeade252ffe7fa98d0dc15b5985cbe04afe6e268f07e88bcc0f186';
export const ROW_COUNT = EUROBODALLA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = EUROBODALLA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseEurobodallaGpfsExtraction(eurobodallaExtraction(), EUROBODALLA_CONTEXT).records;
}
