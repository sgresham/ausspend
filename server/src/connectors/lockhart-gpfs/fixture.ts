import {
  LOCKHART_GPFS_FISCAL_YEAR,
  LOCKHART_GPFS_REPORTING_URL,
  parseLockhartGpfsExtraction,
  type LockhartGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 15 of 95). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Lockhart prints eight
// non-zero revenue lines (including other income and a net gain on disposal) and
// four expense lines (including borrowing costs; its net loss on disposal line
// is nil for 2026). The net result is positive and the printed before-capital
// result is negative.
export const LOCKHART_PDF_URL =
  'https://lockhart.nsw.gov.au/wp-content/uploads/2026/11/Annual_Financial_Statements-2026-3-in-1.pdf';
export const LOCKHART_PDF_SHA256 =
  'e57168fa5be1ef8e4f6facd22f4244887d4e9bdbbb013ef6d3d746c0c63f3212';
export const LOCKHART_PDF_BYTES = 3_258_064;

export const LOCKHART_INCOME_TEXT =
  "Lockhart Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 4,351 Rates and annual charges B2-1 4,311 4,109 886 User charges and fees B2-2 1,226 722 353 Other revenues B2-3 811 457 8,111 Grants and contributions provided for operating purposes B2-4 10,823 7,387 – Grants and contributions provided for capital purposes B2-4 2,698 2,100 273 Interest and investment income B2-5 246 363 – Other income B2-6 179 138 – Net gain from the disposal of assets B4-1 6 – 13,974 Total income from continuing operations 20,300 15,276 Expenses from continuing operations 4,412 Employee benefits and on-costs B3-1 4,551 4,836 3,925 Materials and services B3-2 6,295 5,657 123 Borrowing costs B3-3 125 121 713 Other expenses B3-5 1,125 1,026 – Net loss from the disposal of assets B4-1 – 150 9,173 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 12,096 11,790 4,801 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 8,204 3,486 5,415 Depreciation, amortisation and impairment of non-financial assets B3-4 7,079 6,815 (614) Operating result from continuing operations 1,125 (3,329) (614) Net operating result for the year attributable to Council 1,125 (3,329) (1,579) Net operating result for the year before grants and contributions provided for capital purposes (1,573) (5,429) The above Income Statement should be read in conjunction with the accompanying notes. Lockhart Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 74";

export const LOCKHART_COMPREHENSIVE_TEXT =
  "Lockhart Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 1,125 (3,329) §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-6 30,885 43,733 Other comprehensive income for the year 30,885 43,733 Total comprehensive income for the year attributable to Council 32,010 40,404 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Lockhart Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 74";

export const LOCKHART_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Governance – – 256 278 (256) (278) – – – – Administration 512 223 3,408 3,087 (2,896) (2,864) 240 50 23,131 17,210 Public Order & Safety – – 417 333 (417) (333) – – 3,278 2,864 Environment 1,221 1,314 1,702 1,636 (481) (322) 280 428 713 478 Community Services & Education 1,053 315 846 629 207 (314) 331 377 – – Housing & Community Amenities 103 94 178 182 (75) (88) – 5 9,453 6,566 Sewerage Services 763 812 786 782 (23) 30 10 83 14,335 14,260 Recreation & Culture 905 1,986 2,706 2,745 (1,801) (759) 437 1,657 26,897 20,150 Mining, manufacturing and construction 2 4 7 20 (5) (16) – – – – Transport and communication 5,390 5,881 8,565 8,535 (3,175) (2,654) 5,304 3,781 423,903 410,807 Economic Affairs 279 279 304 378 (25) (99) 52 – 4,081 3,222 General purpose income 10,053 4,368 – – 10,053 4,368 6,867 3,106 – – Other 19 – – – 19 – – – 930 – Total functions and activities 20,300 15,276 19,175 18,605 1,125 (3,329) 13,521 9,487 506,721 475,557 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 74 Lockhart Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function lockhartExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: LOCKHART_PDF_SHA256,
      bytes: LOCKHART_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? LOCKHART_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? LOCKHART_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? LOCKHART_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const LOCKHART_CONTEXT: LockhartGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements 2026 (3-in-1)',
    url: LOCKHART_PDF_URL,
    fiscal_year: LOCKHART_GPFS_FISCAL_YEAR,
    listing_url: LOCKHART_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'lockhart-gpfs/Annual_Financial_Statements-2026-3-in-1.pdf',
    sha256: LOCKHART_PDF_SHA256,
    bytes: LOCKHART_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: LOCKHART_GPFS_REPORTING_URL,
};

/** Golden fixture for the lockhart-gpfs module: 17 rows. */
export const LOCKHART_GPFS_ROW_COUNT = 17;
export const LOCKHART_GPFS_GOLDEN_DIGEST =
  '5940cc9ea09b5613981423901740994441dbae560dadb78fac84511221d1d6b6';
export const ROW_COUNT = LOCKHART_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = LOCKHART_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseLockhartGpfsExtraction(lockhartExtraction(), LOCKHART_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
