import {
  NAMBUCCA_VALLEY_GPFS_FISCAL_YEAR,
  NAMBUCCA_VALLEY_GPFS_REPORTING_URL,
  parseNambuccaValleyGpfsExtraction,
  type NambuccaValleyGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 102). The Income Statement
// prints the Original unaudited budget column before each line label, with
// Actual 2025 and Actual 2024 after it. A parser that took the first number in
// the line would read the budget; the expected values are all Actual 2025.
// Nambucca Valley Council prints seven revenue components (there is no net gain
// on disposal line) and five expense components, including a real net loss on
// disposal of assets of 2,829. The net result is positive while the
// before-capital result is negative. Other comprehensive income has two printed
// components (revaluation 26,449 and impairment/revaluation decrement -214)
// summing to the printed 26,235.
export const NAMBUCCA_VALLEY_PDF_URL =
  'https://www.nambucca.nsw.gov.au/files/assets/public/v/1/council/news-and-community-feedback/documents-on-exhibition/annual-financial-statements/audited-annual-financial-statements-2024-2025.pdf';
export const NAMBUCCA_VALLEY_PDF_SHA256 =
  '06fdca66b04bd756d157345a480ee398ffef42b663b54d1c78bc8424114cedee';
export const NAMBUCCA_VALLEY_PDF_BYTES = 1734745;

export const NAMBUCCA_VALLEY_INCOME_TEXT =
  `Nambucca Valley Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 26,158 Rates and annual charges B2-1 26,248 24,505 11,179 User charges and fees B2-2 9,909 9,849 941 Other revenues B2-3 1,213 941 9,551 Grants and contributions provided for operating purposes B2-4 10,446 11,491 4,097 Grants and contributions provided for capital purposes B2-4 21,574 19,467 3,195 Interest and investment income B2-5 5,180 3,757 272 Other income B2-6 393 299 55,393 Total income from continuing operations 74,963 70,309 Expenses from continuing operations 15,720 Employee benefits and on-costs B3-1 15,747 13,931 18,088 Materials and services B3-2 23,194 17,119 2,148 Borrowing costs B3-3 2,137 2,138 1,952 Other expenses B3-5 2,234 2,352 – Net loss from the disposal of assets B4-1 2,829 1,474 37,908 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 46,141 37,014 17,485 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 28,822 33,295 12,453 Depreciation, amortisation and impairment of non-financial assets B3-4 13,694 12,614 5,032 Operating result from continuing operations 15,128 20,681 5,032 Net operating result for the year attributable to Council 15,128 20,681 935 Net operating result for the year before grants and contributions provided for capital purposes (6,446) 1,214 The above Income Statement should be read in conjunction with the accompanying notes. Nambucca Valley Council Income Statement for the year ended 30 June 2025 Page 4 of 78`;

export const NAMBUCCA_VALLEY_COMPREHENSIVE_TEXT =
  `Nambucca Valley Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 15,128 20,681 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 26,449 28,727 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-7 (214) 143 Total items which will not be reclassified subsequent to operating result 26,235 28,870 Total other comprehensive income for the year 26,235 28,870 Total comprehensive income for the year attributable to Council 41,363 49,551 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Nambucca Valley Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 78`;

export const NAMBUCCA_VALLEY_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Administration 19,280 19,912 6,541 3,717 12,739 16,195 3,360 5,303 88,584 60,701 Public Order and Safety 3,283 976 1,537 1,483 1,746 (507) 3,283 977 10,249 7,078 Health 223 244 230 230 (7) 14 – – 21 25 Environment 878 746 1,351 1,960 (473) (1,214) 518 193 539 419 Community Services and Education 596 136 402 235 194 (99) 588 113 2,117 1,798 Housing and Community amenities 10,829 9,844 8,014 7,930 2,815 1,914 – 887 24,590 21,009 Water Supplies 8,061 8,937 7,408 6,925 653 2,012 424 1,926 141,453 124,920 Sewerage Services 9,987 9,557 6,674 6,271 3,313 3,286 2,267 2,718 118,944 113,723 Recreation and Culture 1,117 1,327 4,813 4,173 (3,696) (2,846) 2,027 1,065 76,713 71,603 Mining, Manufacturing and Construction 206 196 709 703 (503) (507) – – – – Transport and Communication 19,952 18,332 21,577 15,476 (1,625) 2,856 19,203 17,712 337,180 320,539 Economic Affairs 551 102 579 525 (28) (423) 350 64 694 874 Total functions and activities 74,963 70,309 59,835 49,628 15,128 20,681 32,020 30,958 801,084 722,689 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 78 Nambucca Valley Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function nambuccaValleyExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: NAMBUCCA_VALLEY_PDF_SHA256,
      bytes: NAMBUCCA_VALLEY_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? NAMBUCCA_VALLEY_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? NAMBUCCA_VALLEY_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? NAMBUCCA_VALLEY_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const NAMBUCCA_VALLEY_CONTEXT: NambuccaValleyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Nambucca Valley Council Audited Annual Financial Statements 2024-25',
    url: NAMBUCCA_VALLEY_PDF_URL,
    fiscal_year: NAMBUCCA_VALLEY_GPFS_FISCAL_YEAR,
    listing_url: NAMBUCCA_VALLEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'nambucca-valley-gpfs/audited-annual-financial-statements-2024-2025.pdf',
    sha256: NAMBUCCA_VALLEY_PDF_SHA256,
    bytes: NAMBUCCA_VALLEY_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: NAMBUCCA_VALLEY_GPFS_REPORTING_URL,
};

/** Golden fixture for the nambucca-valley-gpfs module: 17 rows. */
export const NAMBUCCA_VALLEY_GPFS_ROW_COUNT = 17;
export const NAMBUCCA_VALLEY_GPFS_GOLDEN_DIGEST =
  '25064427cb0d03a8294577f243b8afff4772df414981a91ae9b31a4242490bd0';
export const ROW_COUNT = NAMBUCCA_VALLEY_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = NAMBUCCA_VALLEY_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseNambuccaValleyGpfsExtraction(
    nambuccaValleyExtraction(),
    NAMBUCCA_VALLEY_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
