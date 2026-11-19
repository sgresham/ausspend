import {
  BALLINA_GPFS_FISCAL_YEAR,
  BALLINA_GPFS_REPORTING_URL,
  parseBallinaGpfsExtraction,
  type BallinaGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 annual
// report (GPFS section: PDF pp. 216, 217 and 225 of 327). The Income Statement
// prints the Original unaudited budget column before each line label, with
// Actual 2025 and Actual 2024 after it. A parser that took the first number in
// the line would read the budget; the expected values are all Actual 2025.
// Ballina Shire Council prints eight revenue components, including "Other
// income" and a real net gain on disposal of assets of 9,849, plus four expense
// components (the 2025 net loss on disposal is nil; the 2024 comparative is
// 6,707). The net result is positive (31,500) and the before-capital result is
// also positive (9,245). Other comprehensive income prints revaluation 203,585
// and impairment reversal 654, summing to the printed 204,239.
export const BALLINA_PDF_URL =
  'https://www.ballina.nsw.gov.au/files/assets/public/v/2/council/documents/council-documents/ballina-shire-council-annual-report-202425-resized.pdf';
export const BALLINA_PDF_SHA256 =
  'eeeb8354b0bc2a80b918eb218a145861eafafbae3dfc6383cac3b2fcefa99007';
export const BALLINA_PDF_BYTES = 17070707;

export const BALLINA_INCOME_TEXT =
  `Ballina Shire Council | Income Statement | for the year ended 30 June 2025 Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 64,029 Rates and annual charges B2-1 65,020 62,598 35,505 User charges and fees B2-2 34,210 31,960 1,658 Other revenues B2-3 3,431 3,108 11,314 Grants and contributions provided for operating purposes B2-4 11,690 13,583 49,175 Grants and contributions provided for capital purposes B2-4 22,255 34,168 4,807 Interest and investment income B2-5 5,410 5,891 5,108 Other income B2-6 5,784 5,576 – Net gain from the disposal of assets B4-1 9,849 – 171,596 Total income from continuing operations 157,649 156,884 Expenses from continuing operations 35,853 Employee benefits and on-costs B3-1 38,505 34,610 46,222 Materials and services B3-2 49,690 44,159 3,639 Borrowing costs B3-3 4,067 4,447 3,547 Other expenses B3-5 3,277 4,822 3,110 Net loss from the disposal of assets B4-1 – 6,707 92,371 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 95,539 94,745 79,225 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 62,110 62,139 27,682 Depreciation, amortisation and impairment of non-financial assets B3-4 30,610 28,718 51,543 Operating result from continuing operations 31,500 33,421 51,543 Net operating result for the year attributable to Council 31,500 33,421 2,368 Net operating result for the year before grants and contributions provided for capital purposes 9,245 (747) The above Income Statement should be read in conjunction with the accompanying notes. Ballina Shire Council Income Statement for the year ended 30 June 2025 Page 4`;

export const BALLINA_COMPREHENSIVE_TEXT =
  `Ballina Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 31,500 33,421 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-8 203,585 66,444 Impairment reversal relating to infrastructure, property, plant and equipment C1-8 654 279 Total items which will not be reclassified subsequent to operating result 204,239 66,723 Total other comprehensive income for the year 204,239 66,723 Total comprehensive income for the year attributable to Council 235,739 100,144 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Ballina Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5`;

export const BALLINA_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Corporate and Community Division 64,333 57,110 34,223 30,970 30,110 26,140 5,367 9,360 303,126 291,132 Civil Services Division 36,034 40,684 37,903 42,629 (1,869) (1,945) 18,877 30,648 1,100,877 917,358 Planning and Environmental Health Division 13,137 18,412 20,439 17,925 (7,302) 487 5,160 6,303 322,235 310,271 Water Operations 15,944 15,363 15,538 14,886 406 477 489 503 120,492 118,008 Wastewater Operations 28,201 25,315 18,046 17,053 10,155 8,262 4,052 937 344,659 329,881 Total functions and activities 157,649 156,884 126,149 123,463 31,500 33,421 33,945 47,751 2,191,389 1,966,650 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 Ballina Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function ballinaExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BALLINA_PDF_SHA256,
      bytes: BALLINA_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BALLINA_INCOME_TEXT, 216),
      pdfPage(overrides.comprehensive ?? BALLINA_COMPREHENSIVE_TEXT, 217),
      pdfPage(overrides.functions ?? BALLINA_FUNCTIONS_TEXT, 225),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BALLINA_CONTEXT: BallinaGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Ballina Shire Council Annual Report 2024-25 — audited financial statements',
    url: BALLINA_PDF_URL,
    fiscal_year: BALLINA_GPFS_FISCAL_YEAR,
    listing_url: BALLINA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'ballina-gpfs/ballina-shire-council-annual-report-202425-resized.pdf',
    sha256: BALLINA_PDF_SHA256,
    bytes: BALLINA_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BALLINA_GPFS_REPORTING_URL,
};

/** Golden fixture for the ballina-gpfs module: 17 rows. */
export const BALLINA_GPFS_ROW_COUNT = 17;
export const BALLINA_GPFS_GOLDEN_DIGEST = '27fd02bec459899702ae11500050e957760f4be3c8f59e7717986f6f4ed8d075';
export const ROW_COUNT = BALLINA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BALLINA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBallinaGpfsExtraction(
    ballinaExtraction(),
    BALLINA_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
