import {
  PARRAMATTA_GPFS_FISCAL_YEAR,
  PARRAMATTA_GPFS_REPORTING_URL,
  parseParramattaGpfsExtraction,
  type ParramattaGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 4, 5 and
// 14; PDF pages 4, 5 and 14). The income statement prints the Original
// unaudited budget column *before* the label, so a parser that took the first
// number in the line would read the budget; the expected values are all Actual
// 2025.
const INCOME_TEXT = `City of Parramatta Council | Income Statement | for the year ended 30 June 2025 §Statement§  Original unaudited budget   Actual  Restated Actual  2025   $ '000   Notes   2025   2024   1  Income from continuing operations  229,252   Rates and annual charges   B2-1   231,565   221,620 49,973   User charges and fees   B2-2   46,819   41,788 18,880   Other revenues   B2-3   18,382   12,358 23,721   Grants and contributions provided for operating purposes   B2-4   17,849   16,057 75,732   Grants and contributions provided for capital purposes   B2-4   69,198   57,452 23,690   Interest and investment income   B2-5   28,486   30,898 600   Other income   B2-6   26,905   91,653  421,848   Total income from continuing operations   439,204   471,826  Expenses from continuing operations  145,934   Employee benefits and on-costs   B3-1   164,786   159,530 72,736   Materials and services   B3-2   135,446   129,925 98   Borrowing costs   B3-3   47   135 55,225   Other expenses   B3-5   5,907   6,488 (211)   Net loss from the disposal of assets   B4-1   7,307   25,659  273,782  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   313,493   321,737 148,066  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   125,711   150,089  66,500 Depreciation, amortisation and impairment of non-financial assets   B3-4   70,059   61,531  81,566   Net operating result for the year attributable to Council   55,652   88,558  5,834  Net operating result for the year before grants and contributions provided for capital purposes   (13,546)   31,106  (1)   The Council has restated some comparative amounts to correct certain errors from prior years which were identified this year. Details of the restatements are set out in Note F4-1. The above Income Statement should be read in conjunction with the accompanying notes.  City of Parramatta Council Income Statement  for the year ended 30 June 2025 Page 4 of 85`;

const COMPREHENSIVE_TEXT = `City of Parramatta Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§  Restated  $ '000   Notes   2025   2024   1  Net operating result for the year – from Income Statement   55,652   88,558  §Subnote§  Other comprehensive income:  Amounts that will not be reclassified subsequently to the operating result Gain on revaluation of Infrastructure, Property, Plant, and Equipment (IPPE)   C1-5   89,928   88,298 Re-measurement of remediation liability for asbestos contamination   C3-5   (15,102)   2,551  Total items which will not be reclassified subsequently to the operating result   74,826   90,849  Total other comprehensive income for the year   74,826   90,849  Total comprehensive income for the year attributable to Council   130,478   179,407  (1)   The Council has restated some comparative amounts to correct certain errors from prior years which were identified this year. Details of the restatements are set out in Note F4-1. The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  City of Parramatta Council Statement of Comprehensive Income  for the year ended 30 June 2025 Page 5 of 85`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses Net Operating result from continuing operations   Grants and contributions   Carrying amount of assets 2025   2024   2025   2024   2025   2024   2025   2024   2025   2024  $ '000   Restated   Restated   Restated  Functions or activities  Corporate and Property Services   223,884   302,297   91,340   97,998   132,544   204,299   8,175   9,550   2,311,123   2,199,885 People Culture and Workplace   130   136   7,606   8,969   (7,476)   (8,833)   –   –   –   – City Engagement and Experience   1,057   498   23,916   21,261   (22,859)   (20,763)   284   260   –   – Office of Lord Mayor and CEO   1   25   6,217   3,478   (6,216)   (3,453)   –   25   –   – City Assets and Operations   135,079   91,859   171,924   167,311   (36,845)   (75,452)   51,721   22,116   2,250,476   2,187,286 Community and Culture   25,407   23,291   54,435   53,806   (29,028)   (30,515)   3,089   2,614   5,438   10,788 City Planning and Design   53,646   53,720   28,114   30,445   25,532   23,275   23,778   38,944   –   –  Total functions and activities   439,204   471,826   383,552   383,268   55,652   88,558   87,047   73,509   4,567,037   4,397,959  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 14 of 85 City of Parramatta Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'd'.repeat(64), bytes: 4_098_410 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: ParramattaGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'City of Parramatta Annual Financial Statements 2024-2025.pdf',
    url: 'https://www.cityofparramatta.nsw.gov.au/files/assets/public/v/3/council/financial-statements/city-of-parramatta-annual-financial-statements-2024-2025.pdf',
    fiscal_year: PARRAMATTA_GPFS_FISCAL_YEAR,
    listing_url:
      'https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements/2024-2025-annual-financial-statements',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/parramatta-gpfs/city-of-parramatta-annual-financial-statements-2024-2025.pdf',
    sha256: '9dad166100cdf224a2c34d210b12673450b8b134fe2a7e257dec350e65c1be59',
    bytes: 4_098_410,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: PARRAMATTA_GPFS_REPORTING_URL,
};

/** Golden fixture for the parramatta-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const PARRAMATTA_GPFS_ROW_COUNT = 17;
export const PARRAMATTA_GPFS_GOLDEN_DIGEST =
  '6a9a2f430d2ba1acb728b9ad45e4a378ddbcbc6ec3e5a92b45aec28faaccbb91';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '6a9a2f430d2ba1acb728b9ad45e4a378ddbcbc6ec3e5a92b45aec28faaccbb91';

export function goldenRecords() {
  const parsed = parseParramattaGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
