import {
  BEGA_VALLEY_GPFS_FISCAL_YEAR,
  BEGA_VALLEY_GPFS_REPORTING_URL,
  parseBegaValleyGpfsExtraction,
  type BegaValleyGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 101). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Bega Valley Shire Council
// prints six revenue lines (no separate Other income line) and five expense
// lines (including a real net loss on disposal of assets of 8,213). The net
// result and the printed before-capital result are both positive. Other
// comprehensive income has two components (revaluation 69,153; other reserve
// movements 123) summing to the printed other comprehensive income of 69,276.
export const BEGA_VALLEY_PDF_URL =
  'https://www.begavalley.nsw.gov.au/files/assets/public/v/2/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/annual_financial_statements-2026.pdf';
export const BEGA_VALLEY_PDF_SHA256 =
  '647575d7038f30c303cfe59e67d7011ca117db24c9f35d10dec68416230e26b2';
export const BEGA_VALLEY_PDF_BYTES = 3371024;

export const BEGA_VALLEY_INCOME_TEXT =
  `Bega Valley Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 80,849 Rates and annual charges B2-1 81,466 77,620 24,174 User charges and fees B2-2 25,191 24,074 884 Other revenues B2-3 1,295 1,400 22,913 Grants and contributions provided for operating purposes B2-4 33,458 24,964 45,028 Grants and contributions provided for capital purposes B2-4 20,497 36,431 4,688 Interest and investment income B2-5 7,130 7,363 178,536 Total income from continuing operations 169,037 171,852 Expenses from continuing operations 50,886 Employee benefits and on-costs B3-1 47,460 44,067 42,254 Materials and services B3-2 44,373 49,881 1,106 Borrowing costs B3-3 621 583 1,757 Other expenses B3-5 1,826 1,522 – Net loss from the disposal of assets B4-1 8,213 9,018 96,003 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 102,493 105,071 82,533 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 66,544 66,781 43,425 Depreciation, amortisation and impairment of non-financial assets B3-4 43,409 40,316 39,108 Operating result from continuing operations 23,135 26,465 39,108 Net operating result for the year attributable to Council 23,135 26,465 (5,920) Net operating result for the year before grants and contributions provided for capital purposes 2,638 (9,966) The above Income Statement should be read in conjunction with the accompanying notes. Bega Valley Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 76`;

export const BEGA_VALLEY_COMPREHENSIVE_TEXT =
  `Bega Valley Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 23,135 26,465 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 69,153 39,360 Other reserve movements - remeasurement of remediation/restoration provision C2-5 123 (466) Total items which will not be reclassified subsequent to operating result 69,276 38,894 Total other comprehensive income for the year 69,276 38,894 Total comprehensive income for the year attributable to Council 92,411 65,359 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Bega Valley Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 76`;

export const BEGA_VALLEY_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Governance 13 11 981 1,271 (968) (1,260) 5 4 – – Administration 7,777 5,053 27,092 9,013 (19,315) (3,960) 5,696 2,381 200,762 161,762 Public Order and Safety 5,689 2,155 4,092 5,083 1,597 (2,928) 5,246 1,682 8,659 8,889 Health 517 507 393 423 124 84 – – – – Environment 17,400 16,772 13,463 17,246 3,937 (474) 969 1,312 25,340 – Community Services and Education 4,450 8,237 4,926 9,039 (476) (802) 3,989 7,716 55,000 4,187 Housing and Community Amenities 1,577 1,559 5,438 4,433 (3,861) (2,874) 614 509 150,572 169,793 Water Supplies 18,692 20,679 18,471 16,740 221 3,939 1,133 4,185 288,788 283,248 Sewerage Supplies 27,590 24,969 20,088 16,927 7,502 8,042 1,603 110 265,874 260,880 Recreation and Culture 5,064 15,998 20,513 20,116 (15,449) (4,118) 3,216 14,397 224,731 260,550 Mining, Manufacturing and Construction 480 405 836 813 (356) (408) – – 1,030 1,047 Transport and Communication 19,453 23,780 36,144 49,058 (16,691) (25,278) 18,373 22,698 864,474 859,811 Economic Affairs 245 18 892 607 (647) (589) 226 6,401 9,080 9,080 General Purpose Income 60,090 51,709 (7,427) (5,382) 67,517 57,091 13,197 – – – Other – – – – – – (312) – (755) 1 Total functions and activities 169,037 171,852 145,902 145,387 23,135 26,465 53,955 61,395 2,093,555 2,019,248 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 76 Bega Valley Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function begaValleyExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BEGA_VALLEY_PDF_SHA256,
      bytes: BEGA_VALLEY_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BEGA_VALLEY_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? BEGA_VALLEY_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? BEGA_VALLEY_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BEGA_VALLEY_CONTEXT: BegaValleyGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements 2025-26',
    url: BEGA_VALLEY_PDF_URL,
    fiscal_year: BEGA_VALLEY_GPFS_FISCAL_YEAR,
    listing_url: BEGA_VALLEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'bega-valley-gpfs/annual_financial_statements-2026.pdf',
    sha256: BEGA_VALLEY_PDF_SHA256,
    bytes: BEGA_VALLEY_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BEGA_VALLEY_GPFS_REPORTING_URL,
};

/** Golden fixture for the bega-valley-gpfs module: 16 rows. */
export const BEGA_VALLEY_GPFS_ROW_COUNT = 16;
export const BEGA_VALLEY_GPFS_GOLDEN_DIGEST =
  'eda67fbfd0504ae092126223bca5c0f1c9d677dd57c82f0eaf3112a9dcb58a2b';
export const ROW_COUNT = BEGA_VALLEY_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BEGA_VALLEY_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBegaValleyGpfsExtraction(begaValleyExtraction(), BEGA_VALLEY_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
