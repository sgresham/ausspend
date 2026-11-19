import {
  HILLTOPS_GPFS_FISCAL_YEAR,
  HILLTOPS_GPFS_REPORTING_URL,
  parseHilltopsGpfsExtraction,
  type HilltopsGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 5, 6 and 15 of 112). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025. Hilltops prints eight
// revenue lines (including other income and a net gain on disposal) and four
// expense lines (including borrowing costs; its net loss on disposal is nil).
// The net result is positive and the printed before-capital result is negative.
export const HILLTOPS_PDF_URL =
  'https://www.hilltops.nsw.gov.au/wp-content/uploads/2025/08/Hilltops-Council-Annual-Financial-Statements-2025.pdf';
export const HILLTOPS_PDF_SHA256 =
  '80d1ddc794f8600628615d2aa0a30275daa1997b2a91655d650ed13d2be11eeb';
export const HILLTOPS_PDF_BYTES = 5_068_393;

export const HILLTOPS_INCOME_TEXT =
  "Hilltops Council | Income Statement | for the year ended 30 June 2025 §Statement§  Original unaudited budget   Actual   Actual  2025   $ '000   Notes   2025   2024  Income from continuing operations  29,165   Rates and annual charges   B2-1   28,042   26,703 16,080   User charges and fees   B2-2   16,950   17,175 1,404   Other revenues   B2-3   1,514   1,445 15,942   Grants and contributions provided for operating purposes   B2-4   15,478   17,661 17,462   Grants and contributions provided for capital purposes   B2-4   20,985   21,526 2,209   Interest and investment income   B2-5   2,947   3,124 –   Other income   B2-6   724   705 –   Net gain from the disposal of assets   B4-1   83   –  82,262   Total income from continuing operations   86,723   88,339  Expenses from continuing operations  22,317   Employee benefits and on-costs   B3-1   23,947   21,702 22,917   Materials and services   B3-2   27,389   26,950 483   Borrowing costs   B3-3   1,084   937 1,350   Other expenses   B3-5   1,437   1,097 –   Net loss from the disposal of assets   B4-1   –   284  47,067  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   53,857   50,970 35,195  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   32,866   37,369  22,160 Depreciation, amortisation and impairment of non-financial assets   B3-4   24,161   22,434  13,035   Operating result from continuing operations   8,705   14,935  (4,427)  Net operating result for the year before grants and contributions provided for capital purposes   (12,280)   (6,591)  The above Income Statement should be read in conjunction with the accompanying notes.  Hilltops Council Income Statement  for the year ended 30 June 2025 Final | Page 4 of 83";

export const HILLTOPS_COMPREHENSIVE_TEXT =
  "Hilltops Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§  $ '000   Notes   2025   2024  Net operating result for the year – from Income Statement   8,705   14,935  §Subnote§  Other comprehensive income:  Amounts which will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment   C1-7   24,300   34,436  Total items which will not be reclassified subsequent to operating result   24,300   34,436  Total other comprehensive income for the year   24,300   34,436  Total comprehensive income for the year attributable to Council   33,005   49,371  The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  Hilltops Council Statement of Comprehensive Income  for the year ended 30 June 2025 Final | Page 5 of 83";

export const HILLTOPS_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses   Operating result   Grants and contributions   Carrying amount of assets $ '000   2025   2024   2025   2024   2025   2024   2025   2024   2025   2024  Functions or activities  Governance   142   543   2,270   1,893   (2,128)   (1,350)   77   –   2,531   2,214 Administration   914   3,071   4,226   3,390   (3,312)   (319)   145   482   121,516   116,773 Compliance   696   698   1,475   1,409   (779)   (711)   593   643   5,138   4,781 Planning and Development   976   832   2,387   2,372   (1,411)   (1,540)   13   744   24   24 Environment   7,905   7,537   9,762   10,861   (1,857)   (3,324)   2,485   2,734   49,856   48,589 Community Services   594   227   4,261   3,837   (3,667)   (3,610)   68   25   61,019   63,362 Water Supplies   12,958   11,031   10,952   9,231   2,006   1,800   508   604   82,187   79,764 Sewerage Supplies   6,206   5,712   4,554   4,216   1,652   1,496   248   211   74,047   71,563 Recreation and culture   699   4,503   8,743   7,125   (8,044)   (2,622)   988   4,484   128,796   126,540 Transport   30,632   27,877   26,116   26,230   4,516   1,647   23,538   19,092   395,095   380,513 Destination and Economy   1,403   1,368   3,272   2,840   (1,869)   (1,472)   494   636   29,906   30,420 General purpose Income   23,598   24,940   –   –   23,598   24,940   7,306   9,532   –   –  Total functions and activities   86,723   88,339   78,018   73,404   8,705   14,935   36,463   39,187   950,115   924,543  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Final | Page 14 of 83 Hilltops Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function hilltopsExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: HILLTOPS_PDF_SHA256,
      bytes: HILLTOPS_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? HILLTOPS_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? HILLTOPS_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? HILLTOPS_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const HILLTOPS_CONTEXT: HilltopsGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Hilltops Council Annual Financial Statements 2025',
    url: HILLTOPS_PDF_URL,
    fiscal_year: HILLTOPS_GPFS_FISCAL_YEAR,
    listing_url: HILLTOPS_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'hilltops-gpfs/Hilltops-Council-Annual-Financial-Statements-2025.pdf',
    sha256: HILLTOPS_PDF_SHA256,
    bytes: HILLTOPS_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: HILLTOPS_GPFS_REPORTING_URL,
};

/** Golden fixture for the hilltops-gpfs module: 17 rows. */
export const HILLTOPS_GPFS_ROW_COUNT = 17;
export const HILLTOPS_GPFS_GOLDEN_DIGEST =
  '1e3bb308b61db307c6b253d6dfde99c46218b79ca96e094b579fdba187869aa6';
export const ROW_COUNT = HILLTOPS_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = HILLTOPS_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseHilltopsGpfsExtraction(hilltopsExtraction(), HILLTOPS_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
