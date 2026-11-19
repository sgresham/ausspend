import {
  PORT_STEPHENS_GPFS_FISCAL_YEAR,
  PORT_STEPHENS_GPFS_REPORTING_URL,
  parsePortStephensGpfsExtraction,
  type PortStephensGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Port Stephens Council Annual Report
// 2024 to 2025 Volume 2 — Financial Statement (96-page PDF; the GPFS primary
// statements are printed pages 4-8 of the Volume 2 numbering and extraction
// pages 5-9). Page 15 is B1-1 "Functions or activities - income, expenses and
// assets". These reproduce the printed $'000 values used by the zero-tolerance
// reconciliation.
export const PORT_STEPHENS_FS_PDF_URL =
  'https://www.portstephens.nsw.gov.au/__data/assets/pdf_file/0006/157362/AnnualReport_Volume2_FinancialStatement_2025.pdf';
export const PORT_STEPHENS_FS_PDF_SHA256 =
  'c086ddbb067328450652facdc77391c12f1d8442c6f73dbaf8bc50173d911ad9';
export const PORT_STEPHENS_FS_PDF_BYTES = 1975075;
export const PORT_STEPHENS_AR_PDF_URL =
  'https://www.portstephens.nsw.gov.au/__data/assets/pdf_file/0004/157360/AnnualReport_2024-25.pdf';
export const PORT_STEPHENS_AR_PDF_BYTES = 4093132;

export const PORT_STEPHENS_INCOME_TEXT =
  "§Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 82,377 Rates and annual charges B2-1 81,803 75,064 62,594 User charges and fees B2-2 58,983 57,143 5,196 Other revenues B2-3 6,088 5,384 13,407 Grants and contributions provided for operating purposes B2-4 13,059 17,992 29,279 Grants and contributions provided for capital purposes B2-4 37,414 40,780 2,649 Interest and investment income B2-5 4,496 4,780 3,807 Other income B2-6 2,989 5,347 250 Net gain from the disposal of assets B4-1 391 – 199,559 Total income from continuing operations 205,223 206,490 Expenses from continuing operations 64,598 Employee benefits and on-costs B3-1 66,113 61,489 65,511 Materials and services B3-2 68,530 62,802 3,421 Borrowing costs B3-3 2,616 2,942 8,209 Other expenses B3-5 9,534 7,343 – Net loss from the disposal of assets B4-1 – 3,879 141,739 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 146,793 138,455 57,820 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 58,430 68,035 21,792 Depreciation, amortisation and impairment of non-financial assets B3-4 22,076 21,107 36,028 Operating result from continuing operations 36,354 46,928 36,028 Net operating result for the year attributable to Council 36,354 46,928 6,748 Net operating result for the year before grants and contributions provided for capital purposes (1,060) 6,148 The above Income Statement should be read in conjunction with the accompanying notes. Port Stephens Council Income Statement for the year ended 30 June 2025 Page 4 Annual Report Volume 2 2024 to 2025 4 General purpose financial statements 1";

export const PORT_STEPHENS_COMPREHENSIVE_TEXT =
  "§Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 36,354 46,928 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-8 171,646 73,764 Gain (loss) on revaluation of intangible assets – 2,732 Total items which will not be reclassified subsequent to operating result 171,646 76,496 Amounts which will be reclassified subsequent to operating result when specific conditions are met Gain (loss) on hedging instruments C3-5 (1,482) (122) Total items which will be reclassified subsequent to operating result when specific conditions are met (1,482) (122) Total other comprehensive income for the year 170,164 76,374 Total comprehensive income for the year attributable to Council 206,518 123,302 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Port Stephens Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 5 Port Stephens Council";

export const PORT_STEPHENS_POSITION_TEXT =
  "§Statement§ $ '000 Notes 2025 2024 ASSETS Current assets Cash and cash equivalents C1-1 8,007 24,980 Investments C1-2 59,000 42,000 Receivables C1-4 14,070 11,665 Inventories C1-5 218 277 Contract assets and contract cost assets C1-6 5,532 7,929 Non-current assets classified as held for sale C1-7 7,186 – Other 2,221 1,448 Total current assets 96,234 88,299 Non-current assets Investments C1-2 16,639 19,160 Receivables C1-4 123 142 Inventories C1-5 10,311 10,097 Infrastructure, property, plant and equipment (IPPE) C1-8 1,731,980 1,493,020 Investment property C1-9 42,640 44,315 Intangible assets C1-10 7,133 6,566 Right of use assets C2-1 1,541 2,316 Derivative financial instruments C3-5 – 893 Other 131 5 Total non-current assets 1,810,498 1,576,514 Total assets 1,906,732 1,664,813 LIABILITIES Current liabilities Payables C3-1 25,034 18,890 Contract liabilities C3-2 8,675 8,110 Lease liabilities C2-1 926 958 Borrowings C3-3 2,083 2,163 Employee benefit provisions C3-4 16,048 16,106 Derivative financial instruments C3-5 53 – Total current liabilities 52,819 46,227 Non-current liabilities Payables C3-1 1,283 1,571 Lease liabilities C2-1 761 1,621 Borrowings C3-3 90,939 61,607 Employee benefit provisions C3-4 934 970 Derivative financial instruments C3-5 661 – Total non-current liabilities 94,578 65,769 Total liabilities 147,397 111,996 Net assets 1,759,335 1,552,817 EQUITY Accumulated surplus 847,836 808,758 IPPE revaluation surplus C4-1 912,107 743,185 Hedging reserve C4-1 (608) 874 Total equity 1,759,335 1,552,817 The above Statement of Financial Position should be read in conjunction with the accompanying notes. Port Stephens Council Statement of Financial Position as at 30 June 2025 Page 6 Annual Report Volume 2 2024 to 2025 6 General purpose financial statements 1";

export const PORT_STEPHENS_EQUITY_TEXT =
  "§Note/Subtotal§ 2025 2024 $ '000 Notes Accumulated surplus IPPE revaluation surplus Hedging reserve Total equity Accumulated surplus IPPE revaluation surplus Hedging reserve Total equity Opening balance at 1 July 808,758 743,185 874 1,552,817 759,907 668,612 996 1,429,515 §Subnote§ Net operating result for the year 36,354 – – 36,354 46,928 – – 46,928 Other comprehensive income Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-8 – 171,646 – 171,646 – 73,764 – 73,764 Gain (loss) on revaluation of intangible assets – – – – – 2,732 – 2,732 Gain (loss) on hedging instruments C3-5 – – (1,482) (1,482) – – (122) (122) Other comprehensive income – 171,646 (1,482) 170,164 – 76,496 (122) 76,374 Total comprehensive income 36,354 171,646 (1,482) 206,518 46,928 76,496 (122) 123,302 Transfers between equity items 2,724 (2,724) – – 1,923 (1,923) – – Closing balance at 30 June 847,836 912,107 (608) 1,759,335 808,758 743,185 874 1,552,817 The above Statement of Changes in Equity should be read in conjunction with the accompanying notes. Port Stephens Council Statement of Changes in Equity for the year ended 30 June 2025 Page 7 7 Port Stephens Council";

export const PORT_STEPHENS_CASH_TEXT =
  "§Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Cash flows from operating activities Receipts: 81,585 Rates and annual charges 81,169 74,740 62,594 User charges and fees 62,524 59,790 2,649 Interest received 3,547 4,079 42,686 Grants and contributions 44,774 48,459 – Bonds, deposits and retentions received 427 – 8,100 Other 13,342 15,234 Payments: (65,726) Payments to employees (66,886) (63,528) (68,908) Payments for materials and services (70,697) (69,852) (3,421) Borrowing costs (2,616) (2,942) – Bonds, deposits and retentions refunded – (225) (4,226) Other (7,089) (8,320) 55,333 Net cash flows from operating activities G1-1 58,495 57,435 Cash flows from investing activities Receipts: – Sale of investments 44,003 115,379 250 Proceeds from sale of IPPE 1,987 626 – Sale of intangible assets 40 – Payments: – Purchase of investments (59,964) (93,725) – Purchase of investment property (194) (13,655) (96,903) Payments for IPPE (88,620) (69,059) (1,000) Purchase of real estate assets (214) (148) (400) Purchase of intangible assets (804) (10) (98,053) Net cash flows from investing activities (103,766) (60,592) Cash flows from financing activities Receipts: 55,425 Proceeds from borrowings 31,750 14,500 Payments: (1,202) Repayment of borrowings (2,498) (2,223) (627) Principal component of lease payments (954) (938) 53,596 Net cash flows from financing activities 28,298 11,339 10,876 Net change in cash and cash equivalents (16,973) 8,182 7,321 Cash and cash equivalents at beginning of year 24,980 16,798 18,197 Cash and cash equivalents at end of year C1-1 8,007 24,980 The above Statement of Cash Flows should be read in conjunction with the accompanying notes. Port Stephens Council Statement of Cash Flows for the year ended 30 June 2025 Page 8 Annual Report Volume 2 2024 to 2025 8 General purpose financial statements 1";

export const PORT_STEPHENS_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Our Community 10,019 8,194 15,132 12,608 (5,113) (4,414) 775 855 287,825 249,870 Our Council 122,054 125,714 64,773 61,491 57,281 64,223 14,040 23,205 517,353 459,209 Our Environment 27,421 25,843 25,142 24,149 2,279 1,694 548 457 6,331 6,028 Our Place 45,729 46,739 63,822 61,314 (18,093) (14,575) 35,110 34,255 1,095,223 949,706 Total functions and activities 205,223 206,490 168,869 159,562 36,354 46,928 50,473 58,772 1,906,732 1,664,813 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 Port Stephens Council | Notes to the Financial Statements 30 June 2025 Annual Report Volume 2 2024 to 2025 14 General purpose financial statements 1";

export const PORT_STEPHENS_AR_COVER_TEXT =
  '2024 to 2025 Annual Report Port Stephens Council Volume one';

export const PORT_STEPHENS_AR_CONTENTS_TEXT =
  'Contents Our performance 3 21 | Our focus areas 22 | Our Community 24 | Our Place 28 | Our Environment 30 | Our Council Scorecard 1 7 | Scorecard 8 | Highlights Our leadership 2 13 | Our elected Council 15 | Our Executive Team 16 | Our organisation structure 17 | Our governance 18 | Our employees 19 | Our volunteers Statutory Statements 4 34 | Statements required by Local Government (General) Regulation 2021 and other NSW Government acts Appendix 5 63 | Election of representatives on Council, committees, regional committees and groups 68 | Capital works projects 74 | Internal Audit and Risk Management Attestation Statement for the 2024 to 2025 financial year for Port Stephens Council 77 | Glossary 4 | General Manager and Mayor’s message Annual Report Volume 1 2024 to 2025 3';

export const PORT_STEPHENS_AR_STATUTORY_TEXT =
  'Statutory information Our Council is committed to open and transparent reporting. The information in this section is legislated and supplements the information provided elsewhere in the report. Our general reporting requirements are set out in section 428 of the Local Government Act 1993 (the Act) and section 217 of the Local Government (General) Regulation 2021 (the Regulations). To access copies of the Act and Regulations, visit legislation.nsw.gov.au Community Strategic Plan 2022 to 2032 Implemented Section 428(2) the Act Our Port Stephens 2021 to 2024 Report is contained within Volume 3 of Annual Report 2023-2024. Delivery Program 2022 to 2026 Implemented Section 428(1) the Act Achievements in implementing the Delivery program is contained within this Report. Financial Reports Section 428(4)(a) the Act The Audited Financial Reports for 2024-2025 are contained in Volume 2 of this Report. Capital Expenditure Guidelines Section 12 Division of Local Government Department of Premier and Cabinet A summary of capital works in progress as of 30 June 2025. Name of project Progress Budget as at 30 June 2025 (ex GST) Previous Financial Years Expenditure (ex GST) Expenditure 2024 to 2025 (ex GST) Brandy Hill Drive - Pathway Construction In progress $3.88M $0.07M $3.52M Bucketts Way, Twelve Mile Creek - Safer Roads Program In progress $4.73M $0.28M $4.44M East Seaham Road In progress $5.32M $0.34M $0.67M Fairlands Road In progress $2.18M N/A $1.63M Annual Report Volume 1 2024 to 2025 35 Statutory Statements 4';

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function portStephensExtraction(): PdfExtraction {
  return {
    source: {
      sha256: PORT_STEPHENS_FS_PDF_SHA256,
      bytes: PORT_STEPHENS_FS_PDF_BYTES,
    },
    pages: [
      pdfPage(PORT_STEPHENS_INCOME_TEXT, 5),
      pdfPage(PORT_STEPHENS_COMPREHENSIVE_TEXT, 6),
      pdfPage(PORT_STEPHENS_POSITION_TEXT, 7),
      pdfPage(PORT_STEPHENS_EQUITY_TEXT, 8),
      pdfPage(PORT_STEPHENS_CASH_TEXT, 9),
      pdfPage(PORT_STEPHENS_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

// Retained annual-report-only evidence: Volume 1 is narrative/statutory
// information only and does not embed the audited GPFS (Volume 2 does).
export function portStephensAnnualReportExtraction(): PdfExtraction {
  return {
    source: {
      sha256: 'annual-report-fixture',
      bytes: 1,
    },
    pages: [
      pdfPage(PORT_STEPHENS_AR_COVER_TEXT, 1),
      pdfPage(PORT_STEPHENS_AR_CONTENTS_TEXT, 3),
      pdfPage(PORT_STEPHENS_AR_STATUTORY_TEXT, 35),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const PORT_STEPHENS_CONTEXT: PortStephensGpfsParseContext = {
  document: {
    id: 'financial-statement-volume-2-2024-25',
    title: 'Annual Report 2024 to 2025 – Volume 2 Financial Statement',
    url: PORT_STEPHENS_FS_PDF_URL,
    fiscal_year: PORT_STEPHENS_GPFS_FISCAL_YEAR,
    listing_url: PORT_STEPHENS_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'port-stephens-gpfs/AnnualReport_Volume2_FinancialStatement_2025.pdf',
    sha256: PORT_STEPHENS_FS_PDF_SHA256,
    bytes: PORT_STEPHENS_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: PORT_STEPHENS_GPFS_REPORTING_URL,
};

/** 17 printed rows: 8 revenue + 8 expense + 1 result. */
export const PORT_STEPHENS_GPFS_ROW_COUNT = 17;
export const PORT_STEPHENS_GPFS_GOLDEN_DIGEST =
  '8e087a522396342e68e3e1c75d86ea40bd47912971163198e76794d02d92a134';
export const ROW_COUNT = PORT_STEPHENS_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = PORT_STEPHENS_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parsePortStephensGpfsExtraction(portStephensExtraction(), PORT_STEPHENS_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
