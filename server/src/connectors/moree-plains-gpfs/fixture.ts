import {
  MOREE_GPFS_FISCAL_YEAR,
  MOREE_GPFS_REPORTING_URL,
  parseMoreeGpfsExtraction,
  type MoreeGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 5, 6 and 14 of 114). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025. Moree Plains prints six
// revenue lines (no other-income or net-gain line) and five expense lines
// (including borrowing costs and a net loss on disposal). The net result is
// positive and the printed before-capital result is negative.
export const MOREE_PDF_URL =
  'https://www.mpsc.nsw.gov.au/publications-documents/financial-statements/2911-2024-25-annual-financial-statement/file';
export const MOREE_PDF_SHA256 = 'dee19c9e693ccd0e95d76ae52f27133393479e7a8099f8071bc08bcc9425edef';
export const MOREE_PDF_BYTES = 1_999_180;

export const MOREE_INCOME_TEXT =
  "Moree Plains Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§  Original unaudited budget   Actual   Actual  2025   $ '000   Notes   2025   2024  Income from continuing operations  34,240   Rates and annual charges   B2-1   34,036   32,487 28,879   User charges and fees   B2-2   20,301   24,140 2,729   Other revenues   B2-3   2,368   2,100 69,665   Grants and contributions provided for operating purposes   B2-4   18,179   36,831 46,926   Grants and contributions provided for capital purposes   B2-4   15,248   7,392 1,651   Interest and investment income   B2-5   2,006   1,874  184,090   Total income from continuing operations   92,138   104,824  Expenses from continuing operations  24,126   Employee benefits and on-costs   B3-1   24,862   21,713 89,599   Materials and services   B3-2   37,280   48,220 2,958   Borrowing costs   B3-3   2,549   3,112 1,330   Other expenses   B3-5   1,210   1,160 –   Net loss from the disposal of assets   B4-1   968   511  118,013  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   66,869   74,716 66,077  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   25,269   30,108  16,918 Depreciation, amortisation and impairment of non-financial assets   B3-4   19,793   17,472  49,159   Operating result from continuing operations   5,476   12,636  49,159   Net operating result for the year attributable to Council   5,476   12,636  2,233  Net operating result for the year before grants and contributions provided for capital purposes   (9,772)   5,244  The above Income Statement should be read in conjunction with the accompanying notes.  Moree Plains Shire Council Income Statement  for the year ended 30 June 2025 Page 4 of 87";

export const MOREE_COMPREHENSIVE_TEXT =
  "Moree Plains Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§  $ '000   Notes   2025   2024  Net operating result for the year – from Income Statement   5,476   12,636  §Subnote§  Other comprehensive income:  Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment   C1-7   24,770   240,618 Impairment relating to infrastructure, property, plant and equipment   C1-7   (2,680)   1,680  Total items which will not be reclassified subsequent to operating result   22,090   242,298  Total other comprehensive income for the year   22,090   242,298  Total comprehensive income for the year attributable to Council   27,566   254,934  The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  Moree Plains Shire Council Statement of Comprehensive Income  for the year ended 30 June 2025 Page 5 of 87";

export const MOREE_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses   Operating result   Grants and contributions   Carrying amount of assets $ '000   2025   2024   2025   2024   2025   2024   2025   2024   2025   2024  Functions or activities  General Purpose Revenue   35,860   36,754   –   –   35,860   36,754   7,183   9,487   (5,039)   28 Administration   1,483   2,154   6,583   6,564   (5,100)   (4,410)   127   1,008   80,929   89,059 Governance   141   195   2,896   2,632   (2,755)   (2,437)   130   195   –   – Public Order and Safety   830   1,056   2,645   2,734   (1,815)   (1,678)   502   580   4,688   4,593 Health   29   392   804   724   (775)   (332)   –   372   –   – Environment   5,530   5,413   6,946   5,948   (1,416)   (535)   174   43   –   – Community Services and Education   3,583   2,149   4,749   3,425   (1,166)   (1,276)   3,091   1,782   5,191   4,721 Housing and Community Amenities   1,098   1,576   2,142   2,504   (1,044)   (928)   523   977   39,648   39,532 Water Supplies   5,944   5,867   7,679   6,659   (1,735)   (792)   229   453   68,234   69,336 Sewerage Services   4,469   4,494   3,457   4,275   1,012   219   24   10   67,105   67,886 Recreation and Culture   4,615   4,233   7,535   6,499   (2,920)   (2,266)   4,566   4,185   70,143   58,644 Mining, Manufacturing and Construction   –   –   (961)   (277)   961   277   –   –   235   103 Transport and Communication   28,276   40,257   40,542   48,861   (12,266)   (8,604)   16,763   25,078   510,719   485,302 Economic Affairs   280   284   1,645   1,640   (1,365)   (1,356)   115   53   2,120   2,077  Total functions and activities   92,138   104,824   86,662   92,188   5,476   12,636   33,427   44,223   843,973   821,281  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 13 of 87 Moree Plains Shire Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function moreeExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: MOREE_PDF_SHA256,
      bytes: MOREE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? MOREE_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? MOREE_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? MOREE_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const MOREE_CONTEXT: MoreeGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Moree Plains Shire Council 2024-25 Annual Financial Statement',
    url: MOREE_PDF_URL,
    fiscal_year: MOREE_GPFS_FISCAL_YEAR,
    listing_url: MOREE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'moree-plains-gpfs/Moree-Plains-2024-25-Annual-Financial-Statement.pdf',
    sha256: MOREE_PDF_SHA256,
    bytes: MOREE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: MOREE_GPFS_REPORTING_URL,
};

/** Golden fixture for the moree-plains-gpfs module: 16 rows. */
export const MOREE_GPFS_ROW_COUNT = 16;
export const MOREE_GPFS_GOLDEN_DIGEST =
  'a9f59462c7dd3890c928cc7b8296b0b9ac5b28416021dec0b24d9ce6f11c643f';
export const ROW_COUNT = MOREE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = MOREE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseMoreeGpfsExtraction(moreeExtraction(), MOREE_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
