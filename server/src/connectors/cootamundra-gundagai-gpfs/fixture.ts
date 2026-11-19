import {
  COOTAMUNDRA_GUNDAGAI_GPFS_FISCAL_YEAR,
  COOTAMUNDRA_GUNDAGAI_GPFS_REPORTING_URL,
  parseCgrcGpfsExtraction,
  type CgrcGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 5, 6 and 14 of 103). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025. CGRC prints seven revenue
// lines (including other income; its net gain on disposal is nil) and five
// expense lines (including borrowing costs and a net loss on disposal). The net
// result and the printed before-capital result are both negative.
export const COOTAMUNDRA_GUNDAGAI_PDF_URL =
  'https://www.cgrc.nsw.gov.au/wp-content/uploads/2026/01/Cootamundra-Gundagai-Regional-Council-Financial-Statements-2024-25-Audited.pdf';
export const COOTAMUNDRA_GUNDAGAI_PDF_SHA256 =
  'd53910f5cb422c4f8b85872156805d3b3a21a910fb2fcbf4e472bcad1af13599';
export const COOTAMUNDRA_GUNDAGAI_PDF_BYTES = 2_565_827;

export const COOTAMUNDRA_GUNDAGAI_INCOME_TEXT =
  "Cootamundra-Gundagai Regional Council | Income Statement | for the year ended 30 June 2025 §Statement§  Original unaudited budget   Actual   Actual  2025   $ '000   Notes   2025   2024  Income from continuing operations  19,820   Rates and annual charges   B2-1   19,807   19,389 10,227   User charges and fees   B2-2   14,182   15,883 680   Other revenues   B2-3   885   850 8,155   Grants and contributions provided for operating purposes   B2-4   9,263   14,419 9,382   Grants and contributions provided for capital purposes   B2-4   6,300   5,507 1,000   Interest and investment income   B2-5   1,683   1,608 –   Other income   B2-6   994   512  49,264   Total income from continuing operations   53,114   58,168  Expenses from continuing operations  17,852   Employee benefits and on-costs   B3-1   14,801   14,534 13,975   Materials and services   B3-2   23,282   27,560 110   Borrowing costs   B3-3   298   337 1,032   Other expenses   B3-5   1,435   1,385 –   Net loss from the disposal of assets   B4-1   2,242   6,074  32,969  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   42,058   49,890 16,295  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   11,056   8,278  12,500 Depreciation, amortisation and impairment of non-financial assets   B3-4   13,274   12,391  3,795   Operating result from continuing operations   (2,218)   (4,113)  3,795   Net operating result for the year attributable to Council   (2,218)   (4,113)  (5,587)  Net operating result for the year before grants and contributions provided for capital purposes   (8,518)   (9,620)  The above Income Statement should be read in conjunction with the accompanying notes.  Cootamundra-Gundagai Regional Council Income Statement  for the year ended 30 June 2025 Page 4 of 79";

export const COOTAMUNDRA_GUNDAGAI_COMPREHENSIVE_TEXT =
  "Cootamundra-Gundagai Regional Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§  $ '000   Notes   2025   2024  Net operating result for the year – from Income Statement   (2,218)   (4,113)  §Subnote§  Other comprehensive income:  Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment   C1-7   17,777   (46,374)  Total other comprehensive income for the year   17,777   (46,374)  Total comprehensive income for the year attributable to Council   15,559   (50,487)  The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  Cootamundra-Gundagai Regional Council Statement of Comprehensive Income  for the year ended 30 June 2025 Page 5 of 79";

export const COOTAMUNDRA_GUNDAGAI_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses   Operating result   Grants and contributions   Carrying amount of assets $ '000   2025   2024   2025   2024   2025   2024   2025   2024   2025   2024  Functions or activities  Vibrant & supportive community   4,246   4,653   8,294   9,342   (4,048)   (4,689)   3,415   4,384   6,854   6,723 Prosperous & resilient economy   2,653   2,908   8,846   9,965   (6,193)   (7,057)   310   399   13,707   13,446 Sustainable natural & built environments   26,006   28,502   31,516   35,500   (5,510)   (6,998)   6,675   8,568   603,121   591,633 Good governance   20,209   22,105   6,676   7,474   13,533   14,631   5,163   6,575   41,122   40,339 Other   –   –   –   –   –   –   –   –   20,561   20,169  Total functions and activities   53,114   58,168   55,332   62,281   (2,218)   (4,113)   15,563   19,926   685,365   672,310  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 13 of 79 Cootamundra-Gundagai Regional Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function cgrcExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: COOTAMUNDRA_GUNDAGAI_PDF_SHA256,
      bytes: COOTAMUNDRA_GUNDAGAI_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? COOTAMUNDRA_GUNDAGAI_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? COOTAMUNDRA_GUNDAGAI_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? COOTAMUNDRA_GUNDAGAI_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const COOTAMUNDRA_GUNDAGAI_CONTEXT: CgrcGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Cootamundra-Gundagai Regional Council Financial Statements 2024-25 (Audited)',
    url: COOTAMUNDRA_GUNDAGAI_PDF_URL,
    fiscal_year: COOTAMUNDRA_GUNDAGAI_GPFS_FISCAL_YEAR,
    listing_url: COOTAMUNDRA_GUNDAGAI_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'cootamundra-gundagai-gpfs/CGRC-Financial-Statements-2024-25-Audited.pdf',
    sha256: COOTAMUNDRA_GUNDAGAI_PDF_SHA256,
    bytes: COOTAMUNDRA_GUNDAGAI_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: COOTAMUNDRA_GUNDAGAI_GPFS_REPORTING_URL,
};

/** Golden fixture for the cootamundra-gundagai-gpfs module: 17 rows. */
export const COOTAMUNDRA_GUNDAGAI_GPFS_ROW_COUNT = 17;
export const COOTAMUNDRA_GUNDAGAI_GPFS_GOLDEN_DIGEST =
  '89dbab360a143934c3442160da627949111955a7a44c44192f53c7d385ba1b2a';
export const ROW_COUNT = COOTAMUNDRA_GUNDAGAI_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = COOTAMUNDRA_GUNDAGAI_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseCgrcGpfsExtraction(cgrcExtraction(), COOTAMUNDRA_GUNDAGAI_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
