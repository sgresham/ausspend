import {
  FEDERATION_GPFS_FISCAL_YEAR,
  FEDERATION_GPFS_REPORTING_URL,
  parseFederationGpfsExtraction,
  type FederationGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Banked text from the official Federation Council Annual Financial Statements
// 2024-2025 (114-page PDF; the GPFS primary statements are PDF pages 5-9 and
// B1-1 is PDF page 14). These reproduce the printed $'000 values used by the
// zero-tolerance reconciliation. FY2024-25 is the latest audited GPFS published
// as at 2026-11-20; no FY2025-26 annual financial statements were linked.
export const FEDERATION_FS_PDF_URL =
  'https://www.federationcouncil.nsw.gov.au/files/assets/public/v/1/document-library/corporate-documents/other/financial-statements/federation-council-annual_financial_statements-2025.pdf';
export const FEDERATION_FS_PDF_SHA256 =
  '7dbdc2a08b4f03e217f1112db1684c1302363d6632ce2660c1f8717779426ca5';
export const FEDERATION_FS_PDF_BYTES = 4_790_806;

export const FEDERATION_INCOME_TEXT = "Federation Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 22,559 Rates and annual charges B2-1 22,913 20,176 10,301 User charges and fees B2-2 11,411 10,968 410 Other revenues B2-3 1,084 1,308 16,427 Grants and contributions provided for operating purposes B2-4 13,299 26,556 1,113 Grants and contributions provided for capital purposes B2-4 5,590 12,157 1,551 Interest and investment income B2-5 3,390 2,742 270 Net gain from the disposal of assets B4-1 – – 52,631 Total income from continuing operations 57,687 73,907 Expenses from continuing operations 19,195 Employee benefits and on-costs B3-1 17,354 16,429 19,285 Materials and services B3-2 17,561 18,897 524 Borrowing costs B3-3 525 494 620 Other expenses B3-5 575 682 – Net loss from the disposal of assets B4-1 926 263 39,624 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 36,941 36,765 13,007 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 20,746 37,142 15,421 Depreciation, amortisation and impairment of non-financial assets B3-4 18,288 15,088 (2,414) Operating result from continuing operations 2,458 22,054 (2,414) Net operating result for the year attributable to Council 2,458 22,054 (3,527) Net operating result for the year before grants and contributions provided for capital purposes (3,132) 9,897 The above Income Statement should be read in conjunction with the accompanying notes. Federation Council Income Statement for the year ended 30 June 2025 Page 5 of 79";

export const FEDERATION_COMPREHENSIVE_TEXT = "Federation Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 2,458 22,054 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 60,273 78,965 Total items which will not be reclassified subsequent to operating result 60,273 78,965 Total other comprehensive income for the year 60,273 78,965 Total comprehensive income for the year attributable to Council 62,731 101,019 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Federation Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 79";

export const FEDERATION_POSITION_TEXT = "Federation Council | Statement of Financial Position | as at 30 June 2025 §Statement§ $ '000 Notes 2025 2024 ASSETS Current assets Cash and cash equivalents C1-1 6,942 24,964 Investments C1-2 59,514 42,906 Receivables C1-4 15,591 10,416 Inventories C1-5 3,125 1,933 Other 340 980 Total current assets 85,512 81,199 Non-current assets Receivables C1-4 60 60 Infrastructure, property, plant and equipment (IPPE) C1-6 880,369 814,900 Intangible assets 247 372 Total non-current assets 880,676 815,332 Total assets 966,188 896,531 LIABILITIES Current liabilities Payables C2-1 5,640 5,361 Contract liabilities C2-2 680 4,110 Borrowings C2-3 984 730 Employee benefit provisions C2-4 2,972 3,128 Provisions C2-5 432 432 Total current liabilities 10,708 13,761 Non-current liabilities Borrowings C2-3 11,014 12,217 Employee benefit provisions C2-4 252 274 Provisions C2-5 11,913 709 Total non-current liabilities 23,179 13,200 Total liabilities 33,887 26,961 Net assets 932,301 869,570 EQUITY Accumulated surplus 550,813 548,355 IPPE revaluation surplus C3-1 381,488 321,215 Total equity 932,301 869,570 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Federation Council Statement of Financial Position as at 30 June 2025 Page 7 of 79";

export const FEDERATION_EQUITY_TEXT = "Federation Council | Statement of Changes in Equity | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 $ '000 Notes Accumulated surplus IPPE revaluation surplus Total equity Accumulated surplus IPPE revaluation surplus Total equity Opening balance at 1 July 548,355 321,215 869,570 526,302 242,250 768,552 §Subnote§ Net operating result for the year 2,458 – 2,458 22,053 – 22,053 Net operating result for the period 2,458 – 2,458 22,053 – 22,053 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 – 59,444 59,444 – 78,965 78,965 Impairment (loss) reversal relating to infrastructure, property, plant and equipment C1-6 – 829 829 – – – Other comprehensive income – 60,273 60,273 – 78,965 78,965 Total comprehensive income 2,458 60,273 62,731 22,053 78,965 101,018 Closing balance at 30 June 550,813 381,488 932,301 548,355 321,215 869,570 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Federation Council Statement of Changes in Equity for the year ended 30 June 2025 Page 8 of 79";

export const FEDERATION_CASH_TEXT = "Federation Council | Statement of Cash Flows | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Cash flows from operating activities Receipts: 22,559 Rates and annual charges 22,066 17,863 10,827 User charges and fees 10,788 9,447 1,551 Interest received 2,076 2,599 17,486 Grants and contributions 12,715 31,852 – Bonds, deposits and retentions received 236 – 412 Other 3,356 3,493 Payments: (19,151) Payments to employees (17,478) (16,205) (19,244) Payments for materials and services (18,919) (18,628) (524) Borrowing costs (529) (451) – Bonds, deposits and retentions refunded (24) (25) (615) Other (2,127) (1,444) 13,301 Net cash flows from operating activities G1-1 12,160 28,501 Cash flows from investing activities Receipts: – Redemption of term deposits 60,522 48,524 270 Sale of real estate assets 145 694 895 Proceeds from sale of IPPE 485 806 Payments: – Acquisition of term deposits (77,130) (56,443) (19,301) Payments for IPPE (13,215) (19,328) – Purchase of intangible assets (40) (160) – Deferred debtors and advances made – (3) (18,136) Net cash flows used in investing activities (29,233) (25,910) Cash flows from financing activities Receipts: – Proceeds from borrowings – 3,800 Payments: (934) Repayment of borrowings (949) (769) (934) Net cash flows from financing activities (949) 3,031 (5,769) Net change in cash and cash equivalents (18,022) 5,622 24,964 Cash and cash equivalents at beginning of year C1-1 24,964 19,342 19,195 Cash and cash equivalents at end of year C1-1 6,942 24,964 42,906 plus: Investments on hand at end of year C1-2 59,514 42,906 62,101 Total cash, cash equivalents and investments 66,456 67,870 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Federation Council Statement of Cash Flows for the year ended 30 June 2025 Page 9 of 79";

export const FEDERATION_FUNCTIONS_TEXT = "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Built Federation 30,886 43,344 37,113 34,071 (6,227) 9,273 10,944 24,377 869,850 804,648 Economic Federation 1,907 5,281 1,758 2,155 149 3,126 46 3,690 11,090 11,262 Natural Federation 1,255 1,209 5,338 5,227 (4,083) (4,018) 588 730 6 6 Social Federation 1,101 982 4,228 4,093 (3,127) (3,111) 699 634 – – Well-Governed Federation 22,538 23,091 6,792 6,293 15,746 16,798 6,612 9,282 85,242 80,615 Amalgamation – – – 14 – (14) – – – – Total functions and activities 57,687 73,907 55,229 51,853 2,458 22,054 18,889 38,713 966,188 896,531 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 79 Federation Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function federationExtraction(): PdfExtraction {
  return {
    source: {
      sha256: FEDERATION_FS_PDF_SHA256,
      bytes: FEDERATION_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(FEDERATION_INCOME_TEXT, 5),
      pdfPage(FEDERATION_COMPREHENSIVE_TEXT, 6),
      pdfPage(FEDERATION_POSITION_TEXT, 7),
      pdfPage(FEDERATION_EQUITY_TEXT, 8),
      pdfPage(FEDERATION_CASH_TEXT, 9),
      pdfPage(FEDERATION_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const FEDERATION_CONTEXT: FederationGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2024-25',
    title: 'Federation Council Annual Financial Statements 2024-2025 (GPFS for the year ended 30 June 2025)',
    url: FEDERATION_FS_PDF_URL,
    fiscal_year: FEDERATION_GPFS_FISCAL_YEAR,
    listing_url: FEDERATION_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'federation-gpfs/federation-council-annual_financial_statements-2025.pdf',
    sha256: FEDERATION_FS_PDF_SHA256,
    bytes: FEDERATION_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: FEDERATION_GPFS_REPORTING_URL,
};

/** 17 printed rows: 8 revenue (7 components + total) + 8 expense + 1 result. */
export const FEDERATION_GPFS_ROW_COUNT = 17;
export const FEDERATION_GPFS_GOLDEN_DIGEST =
  '9ef32d5c0a99373e7d3b2fb4ce7ff1d22de44ad837ab578fbe705ed980a231c4';
export const ROW_COUNT = FEDERATION_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = FEDERATION_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseFederationGpfsExtraction(federationExtraction(), FEDERATION_CONTEXT).records;
}
