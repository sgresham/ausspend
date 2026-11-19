import {
  COOLAMON_GPFS_FISCAL_YEAR,
  COOLAMON_GPFS_REPORTING_URL,
  parseCoolamonGpfsExtraction,
  type CoolamonGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 15 of 109). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Restated
// Actual 2025 after it. A parser that took the first number in the line would
// read the budget; the expected values are all Actual 2026. Coolamon prints
// eight non-zero revenue lines (including other income and a net gain on
// disposal) and four expense lines (including borrowing costs; it prints no net
// loss on disposal). The net result and the printed before-capital result are
// both positive.
export const COOLAMON_PDF_URL =
  'https://coolamon.nsw.gov.au/s/Coolamon-Shire-Council-Combined-Financial-Statements-FY2026-inc-Audit-Reports.pdf';
export const COOLAMON_PDF_RESOLVED_URL =
  'https://static1.squarespace.com/static/6119a6edaf35db238026cbe1/t/6ac446da51a2154d0c86e9d8/1791248090045/Coolamon+Shire+Council+Combined+Financial+Statements+FY2026+inc+Audit+Reports.pdf';
export const COOLAMON_PDF_SHA256 =
  '2579c4bec349a2846c81229a6b95547b7ff3d98058ed898a2f4ce0b476c87833';
export const COOLAMON_PDF_BYTES = 3_172_590;

export const COOLAMON_INCOME_TEXT =
  "Coolamon Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Restated Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 4,832 Rates and annual charges B2-1 4,870 4,582 8,668 User charges and fees B2-2 8,529 8,261 577 Other revenues B2-3 484 565 8,188 Grants and contributions provided for operating purposes B2-4 10,940 6,543 6,170 Grants and contributions provided for capital purposes B2-4 2,392 2,056 1,231 Interest and investment income B2-5 1,288 1,519 531 Other income B2-6 503 514 371 Net gain from the disposal of assets B4-1 198 77 30,568 Total income from continuing operations 29,204 24,117 Expenses from continuing operations 11,477 Employee benefits and on-costs B3-1 11,037 9,738 6,297 Materials and services B3-2 7,615 7,096 30 Borrowing costs B3-3 29 40 474 Other expenses B3-5 485 452 18,278 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 19,166 17,326 12,290 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 10,038 6,791 5,214 Depreciation, amortisation and impairment of non-financial assets B3-4 5,689 4,914 7,076 Operating result from continuing operations 4,349 1,877 7,076 Net operating result for the year attributable to Council 4,349 1,877 (133) Net operating result for the year before grants and contributions provided for capital purposes 1,957 (179) The above Income Statement should be read in conjunction with the accompanying notes. Coolamon Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 88";

export const COOLAMON_COMPREHENSIVE_TEXT =
  "Coolamon Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ Restated $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 4,349 1,877 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 10,834 5,971 Other comprehensive income – joint ventures and associates D2-1 34 34 Total items which will not be reclassified subsequent to operating result 10,868 6,005 Total other comprehensive income for the year 10,868 6,005 Total comprehensive income for the year attributable to Council 15,217 7,882 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Coolamon Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 88";

export const COOLAMON_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Governance – – 851 887 (851) (887) – – – – Administration 550 378 – – 550 378 20 – 29,442 23,788 Public Order & Safety 22 175 611 604 (589) (429) 115 161 1,493 1,494 Health 37 29 379 422 (342) (393) – – 804 817 Environment 1,418 1,246 1,660 1,384 (242) (138) 252 239 12,348 9,538 Community Services & Education 3,354 3,207 3,439 3,510 (85) (303) 553 354 4,332 3,760 Housing & Community Amenities 444 551 987 947 (543) (396) 19 99 5,454 5,335 Sewerage Services 1,926 1,187 1,120 909 806 278 1,081 308 22,024 20,896 Recreation & Culture 418 748 2,229 2,265 (1,811) (1,517) 403 733 18,528 18,036 Mining, Manufacture & Construction 100 177 308 345 (208) (168) – – 408 158 Transport & Communication 3,595 2,977 6,784 5,480 (3,189) (2,503) 3,595 2,977 161,457 153,535 Economic Affairs 5,975 5,647 6,487 5,487 (512) 160 156 219 29,007 33,376 Shares of gains or losses in joint venture – – – – – – – – 256 222 General Purpose Revenues 11,365 7,795 – – 11,365 7,795 7,138 3,509 – – Total functions and activities 29,204 24,117 24,855 22,240 4,349 1,877 13,332 8,599 285,553 270,955 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 88 Coolamon Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function coolamonExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: COOLAMON_PDF_SHA256,
      bytes: COOLAMON_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? COOLAMON_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? COOLAMON_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? COOLAMON_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const COOLAMON_CONTEXT: CoolamonGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Coolamon Shire Council Combined Financial Statements FY2026 inc Audit Reports',
    url: COOLAMON_PDF_URL,
    fiscal_year: COOLAMON_GPFS_FISCAL_YEAR,
    listing_url: COOLAMON_GPFS_REPORTING_URL,
    resolved_url: COOLAMON_PDF_RESOLVED_URL,
  },
  archive: {
    local_path:
      'coolamon-gpfs/Coolamon-Shire-Council-Combined-Financial-Statements-FY2026-inc-Audit-Reports.pdf',
    sha256: COOLAMON_PDF_SHA256,
    bytes: COOLAMON_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: COOLAMON_GPFS_REPORTING_URL,
};

/** Golden fixture for the coolamon-gpfs module: 17 rows. */
export const COOLAMON_GPFS_ROW_COUNT = 17;
export const COOLAMON_GPFS_GOLDEN_DIGEST =
  '23822dfa39bbc6fcbfce75d2bae17f6b5b92cab66cd9384c7eea2c671195f3f9';
export const ROW_COUNT = COOLAMON_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = COOLAMON_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseCoolamonGpfsExtraction(coolamonExtraction(), COOLAMON_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
