import {
  NARROMINE_GPFS_FISCAL_YEAR,
  NARROMINE_GPFS_REPORTING_URL,
  parseNarromineGpfsExtraction,
  type NarromineGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 6, 7 and 16 of 92). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2026
// and Actual 2025 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2026. Narromine
// Shire Council prints eight revenue lines (including other revenue, other
// income and a real net gain on disposal of assets of 374) and four expense
// lines plus the separate depreciation line. The printed 2026 net loss on
// disposal is nil. The net result and the before-capital result are both
// positive. Other comprehensive income has a single component (revaluation
// 28,642) equal to the printed other comprehensive income.
export const NARROMINE_PDF_URL =
  'https://www.narromine.nsw.gov.au/2025%202026%20NSC%20Annual%20Report%20-%20Annexure%201%20-%20Financial%20Statements.pdf?downloadable=1';
export const NARROMINE_PDF_SHA256 =
  'aed5a746789b3e5daf13cf35ed03e3db458408549fba1741c184d275010cf2fb';
export const NARROMINE_PDF_BYTES = 7899829;

export const NARROMINE_INCOME_TEXT =
  `Narromine Shire Council | Income Statement | for the year ended 30 June 2026 Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 14,283 Rates and annual charges B2-1 11,689 11,071 1,870 User charges and fees B2-2 5,495 5,269 683 Other revenue 367 577 10,678 Grants and contributions provided for operating purposes B2-3 11,429 9,905 5,760 Grants and contributions provided for capital purposes B2-3 9,002 7,552 1,286 Interest and investment income B2-4 1,411 1,278 83 Other income 131 344 365 Net gain from the disposal of assets 374 – 35,008 Total income from continuing operations 39,898 35,996 Expenses from continuing operations 8,717 Employee benefits and on-costs B3-1 9,395 9,077 8,636 Materials and services B3-2 9,545 12,987 119 Borrowing costs 212 147 1,247 Other expenses 1,913 965 – Net loss from the disposal of assets – 654 18,719 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 21,065 23,830 16,289 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 18,833 12,166 8,475 Depreciation, amortisation and impairment of non-financial assets B3-3 9,168 10,401 7,814 Operating result from continuing operations 9,665 1,765 7,814 Net operating result for the year attributable to Council 9,665 1,765 2,053 Net operating result for the year before grants and contributions provided for capital purposes 663 (5,787) The above Income Statement should be read in conjunction with the accompanying notes. Narromine Shire Council Income Statement for the year ended 30 June 2026 Financial Statements | Page 4 of 69`;

export const NARROMINE_COMPREHENSIVE_TEXT =
  `Narromine Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 9,665 1,765 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain / (loss) on revaluation of infrastructure, property, plant and equipment C1-7 28,642 10,150 Total items which will not be reclassified subsequent to operating result 28,642 10,150 Other comprehensive income for the year 28,642 10,150 Total comprehensive income for the year attributable to Council 38,307 11,915 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Narromine Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Financial Statements | Page 5 of 69`;

export const NARROMINE_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Governance 51 130 1,892 2,503 (1,841) (2,373) – – 3,074 2,846 Administration 13,713 11,314 3,697 4,825 10,016 6,489 5,779 4,089 38,083 35,259 Public Order & Safety 227 129 1,294 828 (1,067) (699) 176 123 28,489 26,377 Environment & Health 223 538 651 973 (428) (435) 101 52 1,422 1,317 Community & Cultural Services 406 1,255 2,637 3,177 (2,231) (1,922) 99 366 6,654 6,161 Planning & Development 544 – 407 339 137 (339) 307 – 104 96 Waste Management 2,809 2,286 1,634 2,154 1,175 132 103 68 2,005 1,856 Infrastructure 13,269 13,192 9,130 11,031 4,139 2,161 12,837 11,528 309,763 286,794 Recreational Facilities 228 381 2,417 4,010 (2,189) (3,629) 183 293 21,568 19,969 Economic Development 1,302 564 2,636 619 (1,334) (55) 344 350 5,245 4,856 Water Supplies 4,637 4,027 2,346 2,380 2,291 1,647 493 588 33,419 30,941 Sewerage Services 2,489 2,180 1,492 1,392 997 788 9 – 41,096 38,049 Total functions and activities 39,898 35,996 30,233 34,231 9,665 1,765 20,431 17,457 490,922 454,521 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Financial Statements | Page 14 of 69 Narromine Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function narromineExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: NARROMINE_PDF_SHA256,
      bytes: NARROMINE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? NARROMINE_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? NARROMINE_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? NARROMINE_FUNCTIONS_TEXT, 16),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const NARROMINE_CONTEXT: NarromineGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: '2025 2026 NSC Annual Report - Annexure 1 - Financial Statements',
    url: NARROMINE_PDF_URL,
    fiscal_year: NARROMINE_GPFS_FISCAL_YEAR,
    listing_url: NARROMINE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'narromine-gpfs/2025 2026 NSC Annual Report - Annexure 1 - Financial Statements.pdf',
    sha256: NARROMINE_PDF_SHA256,
    bytes: NARROMINE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: NARROMINE_GPFS_REPORTING_URL,
};

/** Golden fixture for the narromine-gpfs module: 17 rows. */
export const NARROMINE_GPFS_ROW_COUNT = 17;
export const NARROMINE_GPFS_GOLDEN_DIGEST =
  'fc7ffe82f499040337230294f078970c558e8dfda507b9c1a38b506568c7f16c';
export const ROW_COUNT = NARROMINE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = NARROMINE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseNarromineGpfsExtraction(
    narromineExtraction(),
    NARROMINE_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
