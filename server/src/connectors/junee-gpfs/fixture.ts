import {
  JUNEE_GPFS_FISCAL_YEAR,
  JUNEE_GPFS_REPORTING_URL,
  parseJuneeGpfsExtraction,
  type JuneeGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived FY2025-26 PDF (PDF
// pp. 5, 6 and 14 of 82). The Income Statement prints the Original unaudited
// budget column before each line label, with Actual 2026 and Actual 2025 after
// it. A parser that took the first number in the line would read the budget;
// the expected values are all Actual 2026. Junee prints eight revenue lines
// (including other income and a net gain on disposal) and four non-zero
// expense lines; its printed net loss on disposal is nil. The net result and
// the printed before-capital result are both positive.
export const JUNEE_PDF_URL =
  'https://www.junee.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026-1.pdf';
export const JUNEE_PDF_SHA256 = 'c725ef8a02c29778426dc7be4263e72b070b86c9aeeb901d524eba1d652d5d36';
export const JUNEE_PDF_BYTES = 972_546;

export const JUNEE_INCOME_TEXT =
  "Junee Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§  Original unaudited budget   Actual   Actual  2026   $ '000   Notes   2026   2025  Income from continuing operations  8,512   Rates and annual charges   B2-1   8,500   7,977 5,591   User charges and fees   B2-2   7,043   5,373 520   Other revenues   B2-3   609   543 7,075   Grants and contributions provided for operating purposes   B2-4   9,754   4,685 1,997   Grants and contributions provided for capital purposes   B2-4   1,723   5,858 246   Interest and investment income   163   365 249   Other income   290   299 –   Net gain from the disposal of assets   270   –  24,190   Total income from continuing operations   28,352   25,100  Expenses from continuing operations  6,912   Employee benefits and on-costs   B3-1   6,546   5,865 8,123   Materials and services   B3-2   10,447   9,659 466   Borrowing costs   505   471 641   Other expenses   663   489 –   Net loss from the disposal of assets   –   739  16,142  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   18,161   17,223 8,048  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   10,191   7,877  4,140 Depreciation, amortisation and impairment of non-financial assets   B3-3   4,112   4,126  3,908   Operating result from continuing operations   6,079   3,751  3,908   Net operating result for the year attributable to Council   6,079   3,751  1,911  Net operating result for the year before grants and contributions provided for capital purposes   4,356   (2,107)  The above Income Statement should be read in conjunction with the accompanying notes.  Junee Shire Council Income Statement  for the year ended 30 June 2026 Page 4";

export const JUNEE_COMPREHENSIVE_TEXT =
  "Junee Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§  $ '000   Notes   2026   2025  Net operating result for the year – from Income Statement   6,079   3,751  §Subnote§  Other comprehensive income:  Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment   C1-5   10,708   9,478 Other comprehensive income – joint ventures and associates   40   4  Total items which will not be reclassified subsequent to operating result   10,748   9,482  Total other comprehensive income for the year   10,748   9,482  Total comprehensive income for the year attributable to Council   16,827   13,233  The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  Junee Shire Council Statement of Comprehensive Income  for the year ended 30 June 2026 Page 5";

export const JUNEE_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses   Operating result   Grants and contributions   Carrying amount of assets $ '000   2026   2025   2026   2025   2026   2025   2026   2025   2026   2025  Functions or activities  Administration   12,419   9,266   5,325   3,649   7,094   5,617   5,508   2,717   5,948   5,463 Community services and education   346   422   586   607   (240)   (185)   152   272   149   139 Economic affairs   1,219   678   1,151   1,241   68   (563)   43   64   7,185   6,600 Environment   1,588   1,453   1,740   1,402   (152)   51   146   76   9,998   15,724 Governance   –   3   170   235   (170)   (232)   –   –   2,863   2,626 Housing and community amenities   419   562   789   789   (370)   (227)   92   221   1,489   1,371 Mining, manufacturing and construction   –   –   2   1   (2)   (1)   –   –   25   23 Public order and safety   50   40   490   469   (440)   (429)   11   –   637   581 Recreation and culture   1,823   2,773   3,285   3,851   (1,462)   (1,078)   993   2,127   34,393   31,583 Sewerage services   1,711   1,541   1,464   1,504   247   37   78   –   30,426   25,164 Transport and communication   8,777   8,362   7,271   7,601   1,506   761   4,454   5,066   154,512   143,313  Total functions and activities   28,352   25,100   22,273   21,349   6,079   3,751   11,477   10,543   247,625   232,587  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 13 Junee Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function juneeExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: JUNEE_PDF_SHA256,
      bytes: JUNEE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? JUNEE_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? JUNEE_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? JUNEE_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const JUNEE_CONTEXT: JuneeGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements 2025-26',
    url: JUNEE_PDF_URL,
    fiscal_year: JUNEE_GPFS_FISCAL_YEAR,
    listing_url: JUNEE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'junee-gpfs/Junee-Annual-Financial-Statements-2026.pdf',
    sha256: JUNEE_PDF_SHA256,
    bytes: JUNEE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: JUNEE_GPFS_REPORTING_URL,
};

/** Golden fixture for the junee-gpfs module: 17 rows. */
export const JUNEE_GPFS_ROW_COUNT = 17;
export const JUNEE_GPFS_GOLDEN_DIGEST =
  'ebfb90eaba0ab57e34addbde3055fbccec8646155cf515cc621e13b31ea3b740';
export const ROW_COUNT = JUNEE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = JUNEE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseJuneeGpfsExtraction(juneeExtraction(), JUNEE_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
