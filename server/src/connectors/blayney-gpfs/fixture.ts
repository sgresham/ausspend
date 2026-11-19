import {
  BLAYNEY_GPFS_FISCAL_YEAR,
  BLAYNEY_GPFS_REPORTING_URL,
  parseBlayneyGpfsExtraction,
  type BlayneyGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 114). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Blayney Shire Council prints
// seven revenue lines and five expense lines (including a real net loss on
// disposal of assets of 950). The net result and the printed before-capital
// result are both positive. Other comprehensive income has two components
// (revaluation 12,806; joint ventures/associates 904) summing to the printed
// other comprehensive income of 13,710.
export const BLAYNEY_PDF_URL =
  'https://www.blayney.nsw.gov.au/ArticleDocuments/271/Annual_Financial_Statements-2026%20Blayney%20Shire%20Council%20(1).pdf.aspx';
export const BLAYNEY_PDF_SHA256 =
  'a0dff037962dff7951dd22623cbdad2221276a35efac0bbfcd0433eb48241e68';
export const BLAYNEY_PDF_BYTES = 3321814;

export const BLAYNEY_INCOME_TEXT =
  `Blayney Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 15,581 Rates and annual charges B2-1 15,534 14,136 1,689 User charges and fees B2-2 2,035 1,729 242 Other revenues B2-3 388 316 5,356 Grants and contributions provided for operating purposes B2-4 6,696 4,926 540 Grants and contributions provided for capital purposes B2-4 3,049 5,872 1,064 Interest and investment income B2-5 1,513 1,663 209 Other income B2-6 214 1,084 68 Net gain from the disposal of assets B4-1 – – 24,749 Total income from continuing operations 29,429 29,726 Expenses from continuing operations 8,689 Employee benefits and on-costs B3-1 7,975 7,312 7,038 Materials and services B3-2 6,312 5,979 157 Borrowing costs B3-3 118 163 1,211 Other expenses B3-5 1,106 1,015 – Net loss from the disposal of assets B4-1 950 157 17,095 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 16,461 14,626 7,654 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 12,968 15,100 7,991 Depreciation, amortisation and impairment of non-financial assets B3-4 7,671 9,126 (337) Operating result from continuing operations 5,297 5,974 (337) Net operating result for the year attributable to Council 5,297 5,974 (877) Net operating result for the year before grants and contributions provided for capital purposes 2,248 102 The above Income Statement should be read in conjunction with the accompanying notes. Blayney Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 93`;

export const BLAYNEY_COMPREHENSIVE_TEXT =
  `Blayney Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 5,297 5,974 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 12,806 (3,001) Other comprehensive income – joint ventures and associates 904 1,589 Total items which will not be reclassified subsequent to operating result 13,710 (1,412) Total other comprehensive income for the year 13,710 (1,412) Total comprehensive income for the year attributable to Council 19,007 4,562 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Blayney Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 93`;

export const BLAYNEY_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities 1. Leadership 17,250 15,226 3,830 3,702 13,420 11,524 3,771 1,807 58,438 55,615 2. Community 266 725 4,230 4,154 (3,964) (3,429) 207 661 23,718 22,918 3. Infrastructure 8,900 11,295 12,196 12,225 (3,296) (930) 5,641 8,297 411,325 397,049 4. Economy 147 54 415 388 (268) (334) – – 932 941 5. Natural & Built Environment 2,866 2,426 3,461 3,283 (595) (857) 126 33 3,279 2,482 Total functions and activities 29,429 29,726 24,132 23,752 5,297 5,974 9,745 10,798 497,692 479,005 (*) Council adopted its 2025-2035 Community Strategic Plan on 27 May 2025 which was effective from 1 July 2025. Council's strategic directions were essentially rearranged and therefore the 2024/25 comparative data has been remapped to allow for comparability. B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets * Page 13 of 93 Blayney Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function blayneyExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BLAYNEY_PDF_SHA256,
      bytes: BLAYNEY_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BLAYNEY_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? BLAYNEY_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? BLAYNEY_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BLAYNEY_CONTEXT: BlayneyGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements 2025-26',
    url: BLAYNEY_PDF_URL,
    fiscal_year: BLAYNEY_GPFS_FISCAL_YEAR,
    listing_url: BLAYNEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'blayney-gpfs/Annual_Financial_Statements-2026-Blayney-Shire-Council-1-.pdf',
    sha256: BLAYNEY_PDF_SHA256,
    bytes: BLAYNEY_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BLAYNEY_GPFS_REPORTING_URL,
};

/** Golden fixture for the blayney-gpfs module: 17 rows. */
export const BLAYNEY_GPFS_ROW_COUNT = 17;
export const BLAYNEY_GPFS_GOLDEN_DIGEST =
  'ee9cd9f8794e17de2a52402eb420ed6432089e40e84cffd4cf1e1b13227f0292';
export const ROW_COUNT = BLAYNEY_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BLAYNEY_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBlayneyGpfsExtraction(blayneyExtraction(), BLAYNEY_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
