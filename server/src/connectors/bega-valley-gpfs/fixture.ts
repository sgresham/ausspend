import {
  BEGA_VALLEY_GPFS_FISCAL_YEAR,
  BEGA_VALLEY_GPFS_REPORTING_URL,
  parseBegaValleyGpfsExtraction,
  type BegaValleyGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 5, 6 and 14 of 100). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025 (the FY2024-25 reporting
// year). Bega Valley Shire Council prints six revenue lines (no separate Other
// income line) and five expense lines (including a real net loss on disposal of
// assets of 9,018). The net result is positive; the printed before-capital
// result is negative. Other comprehensive income has two components
// (revaluation 39,360; other movements -466) summing to the printed other
// comprehensive income of 38,894.
export const BEGA_VALLEY_PDF_URL =
  'https://www.begavalley.nsw.gov.au/files/assets/public/v/1/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/bega-valley-shire-council-annual_financial_statements-2025.pdf';
export const BEGA_VALLEY_PDF_SHA256 =
  'd64606d2e274e11f61d253095ca89624c7773a5544aefbbcdcc7394b168a180b';
export const BEGA_VALLEY_PDF_BYTES = 3293163;

export const BEGA_VALLEY_INCOME_TEXT =
  `Bega Valley Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 76,666 Rates and annual charges B2-1 77,620 68,015 22,321 User charges and fees B2-2 24,074 23,539 976 Other revenues B2-3 1,400 1,213 28,661 Grants and contributions provided for operating purposes B2-4 24,964 39,119 41,086 Grants and contributions provided for capital purposes B2-4 36,431 30,798 2,462 Interest and investment income B2-5 7,363 5,168 172,172 Total income from continuing operations 171,852 167,852 Expenses from continuing operations 45,626 Employee benefits and on-costs B3-1 44,067 41,064 47,948 Materials and services B3-2 49,235 52,361 1,118 Borrowing costs B3-3 1,229 1,547 1,774 Other expenses B3-5 1,522 1,911 – Net loss from the disposal of assets B4-1 9,018 6,882 96,466 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 105,071 103,765 75,706 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 66,781 64,087 31,416 Depreciation, amortisation and impairment of non-financial assets B3-4 40,316 31,151 44,290 Operating result from continuing operations 26,465 32,936 44,290 Net operating result for the year attributable to Council 26,465 32,936 3,204 Net operating result for the year before grants and contributions provided for capital purposes (9,966) 2,138 The above Income Statement should be read in conjunction with the accompanying notes. Bega Valley Shire Council Income Statement for the year ended 30 June 2025 Page 4 of 75`;

export const BEGA_VALLEY_COMPREHENSIVE_TEXT =
  `Bega Valley Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 26,465 32,936 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 39,360 282,022 Total items which will not be reclassified subsequent to operating result 39,360 282,022 Amounts which will be reclassified subsequent to operating result when specific conditions are met Other movements C2-5 (466) (342) Total items which will be reclassified subsequent to operating result when specific conditions are met (466) (342) Total other comprehensive income for the year 38,894 281,680 Total comprehensive income for the year attributable to Council 65,359 314,616 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Bega Valley Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 75`;

export const BEGA_VALLEY_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Governance 11 23 1,271 866 (1,260) (843) 4 16 – – Administration 5,053 5,015 9,013 (8,046) (3,960) 13,061 2,381 2,473 161,762 157,560 Public Order and Safety 2,155 4,594 5,083 7,132 (2,928) (2,538) 1,682 4,008 8,889 8,659 Health 507 475 423 469 84 6 – – – – Environment 16,772 18,542 17,246 17,202 (474) 1,340 1,312 1,260 – – Community Services and Education 8,237 10,404 9,039 11,367 (802) (963) 7,716 9,699 4,187 4,078 Housing and Community Amenities 1,559 1,214 4,433 3,558 (2,874) (2,344) 509 449 169,793 165,384 Water Supplies 20,679 21,807 16,740 16,217 3,939 5,590 4,185 5,917 283,248 235,356 Sewerage Supplies 24,969 24,603 16,927 17,556 8,042 7,047 110 2,018 260,880 187,772 Recreation and Culture 15,998 9,234 20,116 16,040 (4,118) (6,806) 14,397 10,843 260,550 253,785 Mining, Manufacturing and Construction 405 461 813 841 (408) (380) – 8 1,047 1,020 Transport and Communication 23,780 25,482 49,058 57,011 (25,278) (31,529) 22,698 23,102 859,811 837,485 Economic Affairs 18 458 607 1,667 (589) (1,209) 6,401 242 9,080 8,845 General Purpose Income 51,709 45,539 (5,382) (6,967) 57,091 52,506 – 8,941 – – Other – 1 – 3 – (2) – 941 1 98,638 Total functions and activities 171,852 167,852 145,387 134,916 26,465 32,936 61,395 69,917 2,019,248 1,958,582 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 75 Bega Valley Shire Council | Notes to the Financial Statements 30 June 2025`;

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
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statements 2024-25',
    url: BEGA_VALLEY_PDF_URL,
    fiscal_year: BEGA_VALLEY_GPFS_FISCAL_YEAR,
    listing_url: BEGA_VALLEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'bega-valley-gpfs/bega-valley-shire-council-annual_financial_statements-2025.pdf',
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
  '531a96696ff9bcf45b1abbd489d30cba33715993ff9155909d30414e0f2e451e';
export const ROW_COUNT = BEGA_VALLEY_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BEGA_VALLEY_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBegaValleyGpfsExtraction(begaValleyExtraction(), BEGA_VALLEY_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
