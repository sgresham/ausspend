import {
  GILGANDRA_GPFS_FISCAL_YEAR,
  GILGANDRA_GPFS_REPORTING_URL,
  parseGilgandraGpfsExtraction,
  type GilgandraGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 6, 7 and 15 of 98). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Gilgandra prints seven
// non-zero revenue lines (it prints no other-income line and a net gain on
// disposal) and four expense lines (including borrowing costs; it prints no net
// loss on disposal). The net result and the printed before-capital result are
// both positive.
export const GILGANDRA_PDF_URL =
  'https://www.gilgandra.nsw.gov.au/files/assets/public/v/1/economic-development/inland-rail/submissions/annual_financial_statements-2026.pdf';
export const GILGANDRA_PDF_SHA256 =
  'e7929405861b2e9d6e5da1422016eb96c44b437c8dba0a5999f4dbe748236ab0';
export const GILGANDRA_PDF_BYTES = 1_365_525;

export const GILGANDRA_INCOME_TEXT =
  "Gilgandra Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 7,755 Rates and annual charges B2-1 7,931 7,548 21,184 User charges and fees B2-2 23,542 21,658 693 Other revenues B2-3 1,072 994 13,546 Grants and contributions provided for operating purposes B2-4 13,408 7,063 17,726 Grants and contributions provided for capital purposes B2-4 4,067 4,488 1,575 Interest and investment income B2-5 1,854 1,732 – Net gain from the disposal of assets B4-1 187 353 62,479 Total income from continuing operations 52,061 43,836 Expenses from continuing operations 23,181 Employee benefits and on-costs B3-1 23,744 20,963 12,239 Materials and services B3-2 12,688 12,207 298 Borrowing costs B3-3 182 194 653 Other expenses B3-5 680 676 36,371 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 37,294 34,040 26,108 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 14,767 9,796 6,345 Depreciation, amortisation and impairment of non-financial assets B3-4 10,275 7,876 19,763 Operating result from continuing operations 4,492 1,920 19,763 Net operating result for the year attributable to Council 4,492 1,920 2,037 Net operating result for the year before grants and contributions provided for capital purposes 425 (2,568) The above Income Statement should be read in conjunction with the accompanying notes. Gilgandra Shire Council Income Statement for the year ended 30 June 2026 Page 5 of 64";

export const GILGANDRA_COMPREHENSIVE_TEXT =
  "Gilgandra Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 4,492 1,920 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 5,955 75,376 Total items which will not be reclassified subsequent to operating result 5,955 75,376 Total other comprehensive income for the year 5,955 75,376 Total comprehensive income for the year attributable to Council 10,447 77,296 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Gilgandra Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6 of 64";

export const GILGANDRA_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Governance – – 203 267 (203) (267) – – – – Administration 516 760 14,416 12,871 (13,900) (12,111) 135 473 26,017 29,583 Public order and safety 325 936 972 862 (647) 74 313 924 4,232 4,233 Health 57 61 547 509 (490) (448) – – 2,688 2,351 Environment 816 896 799 805 17 91 5 105 8,023 5,458 Community services and education 21,790 18,857 15,085 13,819 6,705 5,038 3,005 1,020 52,491 42,877 Housing and community amenities 569 627 654 454 (85) 173 240 272 4,596 4,333 Water supplies 1,546 1,445 1,271 1,284 275 161 2 – 23,410 21,845 Sewerage services 1,950 1,906 991 970 959 936 7,845 270 33,159 22,829 Recreation and culture 1,173 406 1,800 2,050 (627) (1,644) 1,005 291 18,386 17,202 Mining, manufacturing and construction 129 35 150 5 (21) 30 – – – – Transport and communication 6,913 4,854 9,348 7,073 (2,435) (2,219) 4,176 2,120 367,341 369,384 Economic affairs 1,976 2,796 1,333 935 643 1,861 1,283 2,322 11,173 10,817 General purpose revenues 14,301 10,257 – – 14,301 10,257 7,711 3,754 – – Other – – – – – – (8,245) – (248) – Total functions and activities 52,061 43,836 47,569 41,904 4,492 1,932 17,475 11,551 551,268 530,912 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 64 Gilgandra Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function gilgandraExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: GILGANDRA_PDF_SHA256,
      bytes: GILGANDRA_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? GILGANDRA_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? GILGANDRA_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? GILGANDRA_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const GILGANDRA_CONTEXT: GilgandraGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements 2026',
    url: GILGANDRA_PDF_URL,
    fiscal_year: GILGANDRA_GPFS_FISCAL_YEAR,
    listing_url: GILGANDRA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'gilgandra-gpfs/annual_financial_statements-2026.pdf',
    sha256: GILGANDRA_PDF_SHA256,
    bytes: GILGANDRA_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: GILGANDRA_GPFS_REPORTING_URL,
};

/** Golden fixture for the gilgandra-gpfs module: 16 rows. */
export const GILGANDRA_GPFS_ROW_COUNT = 16;
export const GILGANDRA_GPFS_GOLDEN_DIGEST =
  '8419b60cf38e778dfe50769c37650e48fe7b87596719197af78d5fb0cc90c3ba';
export const ROW_COUNT = GILGANDRA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = GILGANDRA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseGilgandraGpfsExtraction(gilgandraExtraction(), GILGANDRA_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
