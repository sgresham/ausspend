import {
  COBAR_GPFS_FISCAL_YEAR,
  COBAR_GPFS_REPORTING_URL,
  parseCobarGpfsExtraction,
  type CobarGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 92). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Cobar Shire Council prints
// seven revenue lines and four expense lines (plus the separate depreciation
// line). The printed net gain on disposal of assets is 222; there is no net
// loss. The net result and the before-capital result are both positive. Other
// comprehensive income has two components — revaluation 21,384 and joint
// ventures/associates (247) — summing to the printed 21,137.
export const COBAR_PDF_URL =
  'https://www.cobar.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026.pdf';
export const COBAR_PDF_SHA256 =
  '7a87b8655b7eb5d15d380c6ce0c6d12bea557e9958b0ad555046aa9229c66eb3';
export const COBAR_PDF_BYTES = 3507784;

export const COBAR_INCOME_TEXT =
  `Cobar Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 9,260 Rates and annual charges B2-1 9,364 8,845 22,539 User charges and fees B2-2 26,590 25,659 824 Other revenues B2-3 1,972 1,312 11,240 Grants and contributions provided for operating purposes B2-4 16,952 12,702 13,523 Grants and contributions provided for capital purposes B2-4 18,890 12,056 651 Interest and investment income B2-5 1,346 1,626 196 Net gain from the disposal of assets B4-1 222 207 58,233 Total income from continuing operations 75,336 62,407 Expenses from continuing operations 15,545 Employee benefits and on-costs B3-1 18,452 17,602 21,931 Materials and services B3-2 23,896 26,169 – Borrowing costs B3-3 141 152 780 Other expenses B3-5 804 385 38,256 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 43,293 44,308 19,977 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 32,043 18,099 8,754 Depreciation, amortisation and impairment of non-financial assets B3-4 11,398 9,997 11,223 Operating result from continuing operations 20,645 8,102 11,223 Net operating result for the year attributable to Council 20,645 8,102 (1,946) Net operating result for the year before grants and contributions provided for capital purposes 1,755 (3,954) The above Income Statement should be read in conjunction with the accompanying notes. Cobar Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 67`;

export const COBAR_COMPREHENSIVE_TEXT =
  `Cobar Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 20,645 8,102 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 21,384 25,070 Other comprehensive income – joint ventures and associates (247) (89) Total items which will not be reclassified subsequent to operating result 21,137 24,981 Total other comprehensive income for the year 21,137 24,981 Total comprehensive income for the year attributable to Council 41,782 33,083 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Cobar Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 67`;

export const COBAR_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Aerodrome 419 187 517 437 (98) (250) – – – – Aged Care 7,561 7,004 7,299 6,859 262 145 326 – – – Asset Management 275 239 1,187 630 (912) (391) – – 102,154 78,177 Cemetery 46 33 185 268 (139) (235) – – – – Childrens Services 5,700 5,206 5,281 5,007 419 199 453 272 – – Civic Functions – – 291 325 (291) (325) – – – – Cobar Water Board 641 543 576 700 65 (157) – – – – Commercial Works 7,562 7,612 5,381 8,383 2,181 (771) – – – – Contracted Services 248 254 836 701 (588) (447) – – – – Customer Service 188 166 – – 188 166 – – – – Domestic Waste 1,119 1,158 1,517 1,135 (398) 23 – 12 6,906 6,906 Emergency Planning and Management 1,328 690 763 809 565 (119) – – 2,872 1,859 Finance 8,018 6,365 1,399 1,625 6,619 4,740 2,300 – 60,108 68,623 General Manager 15,948 13,673 837 433 15,111 13,240 15,948 13,591 – – Governance and Risk – 44 559 674 (559) (630) – – – – Other – – – – – – 78 – 19,489 1,842 Information Technology – – 830 916 (830) (916) – – – – Joint Arrangements – – – – – – – – 343 590 Library Services 91 95 533 533 (442) (438) 25 74 20 24 Organisational Development – – 849 848 (849) (848) – – – – Planning and Land Management 941 367 167 97 774 270 – 167 7,446 7,446 Project Management 282 – 282 48 – (48) – – – – Regulatory Services 43 115 785 623 (742) (508) 282 80 – – Sewer 1,562 1,625 1,622 1,686 (60) (61) 1 – 16,684 16,634 Swimming Pool – – – – – – – – – – Tourism and Events 1,706 1,537 835 821 871 716 1,569 1,285 – – Trade Waste 363 402 198 139 165 263 – – – – Transport 11,036 5,592 13,347 11,940 (2,311) (6,348) 10,593 5,593 397,080 388,567 Urban Services 1,099 2,891 2,394 2,515 (1,295) 376 1,071 2,864 – 7,055 Water 8,998 6,461 5,281 5,396 3,717 1,065 3,136 784 42,637 41,476 Youth and Community 162 148 940 757 (778) (609) 60 36 – – Total functions and activities 75,336 62,407 54,691 54,305 20,645 8,102 35,842 24,758 655,739 619,199 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 67 Cobar Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function cobarExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: COBAR_PDF_SHA256,
      bytes: COBAR_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? COBAR_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? COBAR_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? COBAR_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const COBAR_CONTEXT: CobarGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements GPFS 2025-26',
    url: COBAR_PDF_URL,
    fiscal_year: COBAR_GPFS_FISCAL_YEAR,
    listing_url: COBAR_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'cobar-gpfs/Annual_Financial_Statements-2026.pdf',
    sha256: COBAR_PDF_SHA256,
    bytes: COBAR_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: COBAR_GPFS_REPORTING_URL,
};

/** Golden fixture for the cobar-gpfs module: 16 rows. */
export const COBAR_GPFS_ROW_COUNT = 16;
export const COBAR_GPFS_GOLDEN_DIGEST =
  'b39c03e2b9986bacfd2eb233684439e4011ac607490d9b44ee2e7596eb1f5ceb';
export const ROW_COUNT = COBAR_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = COBAR_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseCobarGpfsExtraction(cobarExtraction(), COBAR_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
