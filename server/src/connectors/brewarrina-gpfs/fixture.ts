import {
  BREWARRINA_GPFS_FISCAL_YEAR,
  BREWARRINA_GPFS_REPORTING_URL,
  parseBrewarrinaGpfsExtraction,
  type BrewarrinaGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived FY2025-26 PDF (PDF
// pp. 5, 6 and 14 of 65). The Income Statement prints the Original unaudited
// budget column before each line label, with Actual 2026 and Actual 2025 after
// it. A parser that took the first number in the line would read the budget;
// the expected values are all Actual 2026. The net result and the printed
// before-capital result are both positive.
export const BREWARRINA_PDF_URL =
  'https://brewarrina.nsw.gov.au/wp-content/uploads/2026/11/Brewarrina-Shire-Council-Financial-Statements-2025-26.pdf';
export const BREWARRINA_PDF_SHA256 =
  '62b854e464ef03e796fbfd6edf552bf7fb6f349ceec410e8d3a4481f851e5528';
export const BREWARRINA_PDF_BYTES = 2_817_948;

export const BREWARRINA_INCOME_TEXT =
  "Brewarrina Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§  Original unaudited budget   Actual   Actual  2026   2026   2025  $ '000   Notes   $ '000   $ '000  Income from continuing operations  2,987   Rates and annual charges   B2-1   3,093   2,834 9,346   User charges and fees   B2-2   10,880   7,659 456   Other revenues   B2-3   891   456 13,576   Grants and contributions provided for operating purposes   B2-4   15,818   10,636 6,000   Grants and contributions provided for capital purposes   B2-4   9,041   3,650 1,113   Interest and investment income   B2-5   923   1,131 180   Other income   B2-6   152   153  33,658   Total income from continuing operations   40,798   26,519  Expenses from continuing operations  5,127   Employee benefits and on-costs   B3-1   8,022   6,481 18,499   Materials and services   B3-2   15,242   13,164 408   Other expenses   B3-4   540   3,322 –   Net loss from the disposal of assets   B4-1   247   998  24,034  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   24,051   23,965 9,624  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   16,747   2,554  5,642 Depreciation, amortisation and impairment of non-financial assets   B3-3   5,702   5,689  3,982   Operating result from continuing operations   11,045   (3,135)  3,982   Net operating result for the year attributable to Council   11,045   (3,135)  (2,018)  Net operating result for the year before grants and contributions provided for capital purposes   2,004   (6,785)  The above Income Statement should be read in conjunction with the accompanying notes.  Brewarrina Shire Council Income Statement  for the year ended 30 June 2026 Page 4 of 65";

export const BREWARRINA_COMPREHENSIVE_TEXT =
  "Brewarrina Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§  2026   2025  Notes   $ '000   $ '000  Net operating result for the year – from Income Statement   11,045   (3,135)  §Subnote§  Other comprehensive income:  Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment   C1-6   11,270   (10,494)  Total items which will not be reclassified subsequent to operating result   11,270   (10,494)  Total other comprehensive income for the year   11,270   (10,494)  Total comprehensive income for the year attributable to Council   22,315   (13,629)  The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  Brewarrina Shire Council Statement of Comprehensive Income  for the year ended 30 June 2026 Page 5 of 65";

export const BREWARRINA_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses   Operating result   Grants and contributions   Carrying amount of assets 2026   2025   2026   2025   2026   2025   2026   2025   2026   2025  $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000  Functions or activities  Governance   33   5   1,253   817   (1,220)   (812)   –   –   –   – Administration   837   433   5,994   5,239   (5,157)   (4,806)   –   –   42,555   35,184 Public Order and Safety   (210)   63   545   536   (755)   (473)   (159)   38   –   – Health   47   74   171   112   (124)   (38)   –   –   –   – Environment   1,272   1,092   652   834   620   258   871   738   7,537   5,638 Community Services and Education   650   332   825   810   (175)   (478)   547   189   28,264   27,202 Housing and Community Amenities   672   328   564   533   108   (205)   501   202   2,627   2,120 Water Supplies   1,531   1,364   1,500   1,578   31   (214)   –   –   17,663   17,301 Sewerage Services   788   759   753   866   35   (107)   104   137   10,323   10,097 Recreation and Culture   3,399   1,032   1,298   1,239   2,101   (207)   3,383   1,026   6,693   4,494 Mining, Manufacturing and Construction   17   3   99   41   (82)   (38)   –   –   –   – Transport and Communication   19,905   12,831   14,173   15,227   5,732   (2,396)   9,965   7,414   181,889   176,367 Economic Affairs   201   1,579   1,926   1,822   (1,725)   (243)   –   5   25   – General Purpose Income   11,656   6,624   –   –   11,656   6,624   9,647   4,537   –   –  Total functions and activities   40,798   26,519   29,753   29,654   11,045   (3,135)   24,859   14,286   297,576   278,403  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 13 of 65 Brewarrina Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function brewarrinaExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BREWARRINA_PDF_SHA256,
      bytes: BREWARRINA_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BREWARRINA_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? BREWARRINA_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? BREWARRINA_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BREWARRINA_CONTEXT: BrewarrinaGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Brewarrina Shire Council Financial Statements 2025-26',
    url: BREWARRINA_PDF_URL,
    fiscal_year: BREWARRINA_GPFS_FISCAL_YEAR,
    listing_url: BREWARRINA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'brewarrina-gpfs/Brewarrina-Shire-Council-Financial-Statements-2025-26.pdf',
    sha256: BREWARRINA_PDF_SHA256,
    bytes: BREWARRINA_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BREWARRINA_GPFS_REPORTING_URL,
};

/** Golden fixture for the brewarrina-gpfs module: 16 rows. */
export const BREWARRINA_GPFS_ROW_COUNT = 16;
export const BREWARRINA_GPFS_GOLDEN_DIGEST =
  '8ed7d4178f2e58655565d96cf61c6404be2fae321ec3b45aca5c3c0881d621df';
export const ROW_COUNT = BREWARRINA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BREWARRINA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBrewarrinaGpfsExtraction(brewarrinaExtraction(), BREWARRINA_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
