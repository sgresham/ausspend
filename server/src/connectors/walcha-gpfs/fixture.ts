import {
  WALCHA_GPFS_FISCAL_YEAR,
  WALCHA_GPFS_REPORTING_URL,
  parseWalchaGpfsExtraction,
  type WalchaGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 6, 7 and 15 of 77). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025. Walcha prints seven non-zero
// revenue lines (its net gain on disposal is nil) and five expense lines
// (including borrowing costs and a net loss on disposal). It then prints a
// below-the-line business-combination gain that bridges the operating result to
// the net result. The net result and the printed before-capital result are both
// positive.
export const WALCHA_PDF_URL =
  'https://walcha.nsw.gov.au/wp-content/uploads/2025/12/Walcha-Council-General-Purpose-Financial-Statements-20242025.pdf';
export const WALCHA_PDF_SHA256 =
  'cc328f754a73a986cb4161cfcd462343b0b5893e85956cc03edb23f04b513e6c';
export const WALCHA_PDF_BYTES = 1_883_547;

export const WALCHA_INCOME_TEXT =
  "Walcha Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 7,431 Rates and annual charges B2-1 7,380 7,027 3,451 User charges and fees B2-2 5,990 3,322 361 Other revenues B2-3 654 597 7,387 Grants and contributions provided for operating purposes B2-4 6,598 9,365 14,657 Grants and contributions provided for capital purposes B2-4 12,185 11,637 561 Interest and investment income B2-5 872 799 86 Other income B2-6 843 272 33,934 Total income from continuing operations 34,522 33,019 Expenses from continuing operations 7,106 Employee benefits and on-costs B3-1 9,214 6,868 6,639 Materials and services B3-2 8,537 5,607 78 Borrowing costs B3-3 177 212 454 Other expenses B3-5 425 336 – Net loss from the disposal of assets B4-1 722 1,740 14,277 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 19,075 14,763 19,657 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 15,447 18,256 4,946 Depreciation, amortisation and impairment of non-financial assets B3-4 5,112 4,589 14,711 Operating result from continuing operations 10,335 13,667 Business combinations – Gain from business combinations D3 7,520 – 14,711 Net operating result for the year attributable to Council 17,855 13,667 55 Net operating result for the year before grants and contributions provided for capital purposes 5,670 2,030 The above Income Statement should be read in conjunction with the accompanying notes. Walcha Council Income Statement for the year ended 30 June 2025 Page 5";

export const WALCHA_COMPREHENSIVE_TEXT =
  "Walcha Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 17,855 13,667 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 37,537 26,631 Total items which will not be reclassified subsequent to operating result 37,537 26,631 Total other comprehensive income for the year 37,537 26,631 Total comprehensive income for the year attributable to Council 55,392 40,298 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Walcha Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6";

export const WALCHA_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Administration 354 242 1,591 1,375 (1,237) (1,133) – – 30,574 29,215 Public Order & Safety 113 135 650 670 (537) (535) 109 129 1,158 1,208 Health 5 – 6 5 (1) (5) – – – – Environment 1,268 1,656 1,772 1,300 (504) 356 – 400 12,637 11,079 Community Services & Education 1,580 1,747 2,017 1,613 (437) 134 1,411 1,464 2,219 2,216 Housing & Community Amenities 234 110 532 527 (298) (417) – – 1,694 1,703 Recreation & Culture 2,108 1,516 2,735 1,469 (627) 47 2,004 1,415 13,242 13,669 Mining, Manufacturing & Construction 850 341 250 176 600 165 – – 32 277 Transport & Communication 14,249 12,539 8,966 10,357 5,283 2,182 10,668 10,526 515,489 463,094 Economic Affairs 991 21 2,060 301 (1,069) (280) 329 40 1,529 1,542 General Purpose Revenues 8,398 8,905 – – 8,398 8,905 2,423 3,224 – – Water Supplies 1,974 5,138 1,197 1,014 777 4,124 620 3,764 31,738 33,020 Sewerage Services 722 669 647 546 75 123 – 40 10,926 10,796 Aged care facility 9,196 – 1,764 – 7,432 – 1,219 – 7,514 – Total functions and activities 42,042 33,019 24,187 19,353 17,855 13,666 18,783 21,002 628,752 567,819 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 Walcha Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function walchaExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: WALCHA_PDF_SHA256,
      bytes: WALCHA_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? WALCHA_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? WALCHA_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? WALCHA_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const WALCHA_CONTEXT: WalchaGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'General Purpose Financial Statements 2024-2025',
    url: WALCHA_PDF_URL,
    fiscal_year: WALCHA_GPFS_FISCAL_YEAR,
    listing_url: WALCHA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'walcha-gpfs/Walcha-Council-General-Purpose-Financial-Statements-20242025.pdf',
    sha256: WALCHA_PDF_SHA256,
    bytes: WALCHA_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: WALCHA_GPFS_REPORTING_URL,
};

/** Golden fixture for the walcha-gpfs module: 17 rows. */
export const WALCHA_GPFS_ROW_COUNT = 17;
export const WALCHA_GPFS_GOLDEN_DIGEST =
  'aa879cb7d40410288c428385e549905ed124e5f6abad0e64b16f3f4491f0d5bd';
export const ROW_COUNT = WALCHA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = WALCHA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseWalchaGpfsExtraction(walchaExtraction(), WALCHA_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
