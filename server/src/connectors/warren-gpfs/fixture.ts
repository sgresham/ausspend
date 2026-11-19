import {
  WARREN_GPFS_FISCAL_YEAR,
  WARREN_GPFS_REPORTING_URL,
  parseWarrenGpfsExtraction,
  type WarrenGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2025-26 PDF (printed/PDF pp. 5, 6 and
// 14 of 81). The Income Statement prints the Original unaudited budget column
// before the line label, with Actual 2026 and Actual 2025 after it. A parser
// that took the first number in the line would read the budget; the expected
// values are all Actual 2026. The net result and the printed before-capital
// result are both positive.
export const WARREN_PDF_URL =
  'https://www.warren.nsw.gov.au/__media_downloads/Financial%20Reports/GPFS-2026.pdf?downloadable=1';
export const WARREN_PDF_SHA256 =
  '9906ea67979c4c059cbd0a9ab8179c4644db9e11cd2065f16fff5cd61bd66577';
export const WARREN_PDF_BYTES = 2_283_613;

export const WARREN_INCOME_TEXT = `Warren Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§  Original unaudited budget   Actual   Actual  2026   2026   2025  $ '000   Notes   $ '000   $ '000  Income from continuing operations  7,458   Rates and annual charges   B2-1   7,456   7,146 4,790   User charges and fees   B2-2   4,092   5,544 360   Other revenues   B2-3   1,384   446 17,332   Grants and contributions provided for operating purposes   B2-4   19,187   15,609 6,792   Grants and contributions provided for capital purposes   B2-4   4,788   5,794 434   Interest and investment income   B2-5   467   627 165   Other income   B2-6   217   126  37,331   Total income from continuing operations   37,591   35,292  Expenses from continuing operations  7,531   Employee benefits and on-costs   B3-1   7,533   7,553 11,967   Materials and services   B3-2   10,151   12,424 91   Borrowing costs   B3-3   86   91 258   Other expenses   B3-5   383   361 –   Net loss from the disposal of assets   B4-1   6,224   1,564  19,847  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   24,377   21,993 17,484  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   13,214   13,299  4,237 Depreciation, amortisation and impairment of non-financial assets   B3-4   7,898   5,531  13,247   Operating result from continuing operations   5,316   7,768  13,247   Net operating result for the year attributable to Council   5,316   7,768  6,455  Net operating result for the year before grants and contributions provided for capital purposes   528   1,974  The above Income Statement should be read in conjunction with the accompanying notes.  Warren Shire Council Income Statement  for the year ended 30 June 2026 Page 5`;

export const WARREN_COMPREHENSIVE_TEXT = `Warren Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§  2026   2025  Notes   $ '000   $ '000  Net operating result for the year – from Income Statement   5,316   7,768  §Subnote§  Other comprehensive income:  Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment   C1-5   20,887   173,518  Total items which will not be reclassified subsequent to operating result   20,887   173,518  Total other comprehensive income for the year   20,887   173,518  Total comprehensive income for the year attributable to Council   26,203   181,286  The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  Warren Shire Council Statement of Comprehensive Income  for the year ended 30 June 2026 Page 6`;

export const WARREN_FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses   Operating result   Grants and contributions   Carrying amount of assets 2026   2025   2026   2025   2026   2025   2026   2025   2026   2025  $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000  Functions or activities  Social   328   277   1,076   1,132   (748)   (855)   141   135   5,051   4,966 Economic   260   237   806   898   (546)   (661)   334   173   4,610   4,410 Infrastructure   18,043   21,383   23,816   18,620   (5,773)   2,763   14,653   16,408   399,704   380,931 Environmental   5,469   4,063   2,760   2,805   2,709   1,258   2,903   1,835   48,111   43,839 Governance   1,438   365   3,817   4,069   (2,379)   (3,704)   88   –   28,317   28,708 General Purpose Revenues   12,053   8,967   –   –   12,053   8,967   5,856   2,852   –   –  Total functions and activities   37,591   35,292   32,275   27,524   5,316   7,768   23,975   21,403   485,793   462,854  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 14 Warren Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function warrenExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: WARREN_PDF_SHA256,
      bytes: WARREN_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? WARREN_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? WARREN_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? WARREN_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const WARREN_CONTEXT: WarrenGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'General Purpose Financial Statements 2025-2026',
    url: WARREN_PDF_URL,
    fiscal_year: WARREN_GPFS_FISCAL_YEAR,
    listing_url: WARREN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/warren-gpfs/GPFS-2026.pdf',
    sha256: WARREN_PDF_SHA256,
    bytes: WARREN_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: WARREN_GPFS_REPORTING_URL,
};

/** Golden fixture for the warren-gpfs module: 17 rows. */
export const WARREN_GPFS_ROW_COUNT = 17;
export const WARREN_GPFS_GOLDEN_DIGEST =
  '8254bc01a354132927f17dd11bbbb3280eeef12041f7969db5ec351c6ab8edf4';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '8254bc01a354132927f17dd11bbbb3280eeef12041f7969db5ec351c6ab8edf4';

export function goldenRecords() {
  const parsed = parseWarrenGpfsExtraction(warrenExtraction(), WARREN_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
