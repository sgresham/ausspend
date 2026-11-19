import {
  UPPER_HUNTER_GPFS_FISCAL_YEAR,
  UPPER_HUNTER_GPFS_REPORTING_URL,
  parseUpperHunterGpfsExtraction,
  type UpperHunterGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 100). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2025
// and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Upper Hunter
// Shire Council prints seven revenue components (there is no net gain on
// disposal line) and five expense components, including a real net loss on
// disposal of assets of 4,221. The net result is positive while the
// before-capital result is negative. Other comprehensive income has a single
// component (revaluation 185,104) equal to the printed other comprehensive
// income. This council labels its totals "Total income" and "Total expenses"
// (the latter excludes depreciation).
export const UPPER_HUNTER_PDF_URL =
  'https://www.upperhunter.nsw.gov.au/files/assets/public/v/1/council/documents-and-policies/key-planning-documents/2025/annual_financial_statements-2025-final-signed-version.pdf';
export const UPPER_HUNTER_PDF_SHA256 =
  'd719ecb060c5a028d32c9fbb32f8e6a064a42d295ae47bebd715fe77ee513d42';
export const UPPER_HUNTER_PDF_BYTES = 2884897;

export const UPPER_HUNTER_INCOME_TEXT =
  `Upper Hunter Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income 19,945 Rates and annual charges B2-1 22,084 20,945 14,176 User charges and fees B2-2 15,233 15,284 2,866 Other revenues 598 565 12,605 Grants and contributions provided for operating purposes B2-3 15,954 12,401 48,670 Grants and contributions provided for capital purposes B2-3 72,892 36,384 733 Interest and investment income 1,645 1,446 – Other income 578 567 98,995 Total income 128,984 87,592 Expenses 19,029 Employee benefits and on-costs B3-1 18,382 18,722 17,891 Materials and services B3-2 27,384 22,305 966 Borrowing costs 1,019 1,067 2,270 Other expenses 2,653 2,932 – Net loss from the disposal of assets 4,221 2,855 40,156 Total expenses 53,659 47,881 58,839 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 75,325 39,711 14,798 Depreciation, amortisation and impairment of non-financial assets B3-3 22,377 18,858 44,041 Operating result 52,948 20,853 44,041 Net operating result for the year attributable to Council 52,948 20,853 (4,630) Net operating result for the year before grants and contributions provided for capital purposes (19,944) (15,531) The above Income Statement should be read in conjunction with the accompanying notes. Upper Hunter Shire Council Income Statement for the year ended 30 June 2025 Page 4`;

export const UPPER_HUNTER_COMPREHENSIVE_TEXT =
  `Upper Hunter Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 52,948 20,853 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 185,104 59,699 Total items which will not be reclassified subsequent to operating result 185,104 59,699 Total other comprehensive income for the year 185,104 59,699 Total comprehensive income for the year attributable to Council 238,052 80,552 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Upper Hunter Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5`;

export const UPPER_HUNTER_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Governance – – 946 830 (946) (830) – – – – Administration 776 414 2,349 2,377 (1,573) (1,963) 204 97 52,212 64,902 Public order and safety 231 387 1,651 1,606 (1,420) (1,219) – 133 4,643 4,604 Health 228 298 342 375 (114) (77) – – – – Environment 7,399 5,528 8,862 8,014 (1,463) (2,486) 1,726 46 22,485 11,635 Community services and education 5,770 4,302 6,687 5,465 (917) (1,163) 3,024 1,953 11,359 10,308 Housing and community amenities 1,480 1,296 1,695 1,615 (215) (319) 956 862 44,348 34,106 Water Supplies 7,161 6,815 6,736 8,329 425 (1,514) 1,416 1,071 105,354 106,530 Sewerage Services 6,012 4,257 6,240 5,733 (228) (1,476) 1,670 215 61,368 61,515 Recreation and culture 1,454 2,184 6,516 5,706 (5,062) (3,522) 1,025 1,757 66,431 65,708 Mining, manufacturing and construction 168 170 1,502 786 (1,334) (616) – – 702 688 Transport and communication 76,656 39,899 27,421 20,496 49,235 19,403 72,806 35,654 1,196,464 980,167 Economic affairs 3,723 3,168 5,089 5,407 (1,366) (2,239) 1,045 776 30,755 30,166 General purpose revenue 17,926 18,874 – – 17,926 18,874 4,938 6,221 – – Other – – – – – – 36 – – – Total functions and activities 128,984 87,592 76,036 66,739 52,948 20,853 88,846 48,785 1,596,121 1,370,329 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 Upper Hunter Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function upperHunterExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: UPPER_HUNTER_PDF_SHA256,
      bytes: UPPER_HUNTER_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? UPPER_HUNTER_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? UPPER_HUNTER_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? UPPER_HUNTER_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const UPPER_HUNTER_CONTEXT: UpperHunterGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Upper Hunter Shire Council Annual Financial Statements 2024-25',
    url: UPPER_HUNTER_PDF_URL,
    fiscal_year: UPPER_HUNTER_GPFS_FISCAL_YEAR,
    listing_url: UPPER_HUNTER_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'upper-hunter-gpfs/annual_financial_statements-2025-final-signed-version.pdf',
    sha256: UPPER_HUNTER_PDF_SHA256,
    bytes: UPPER_HUNTER_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: UPPER_HUNTER_GPFS_REPORTING_URL,
};

/** Golden fixture for the upper-hunter-gpfs module: 17 rows. */
export const UPPER_HUNTER_GPFS_ROW_COUNT = 17;
export const UPPER_HUNTER_GPFS_GOLDEN_DIGEST =
  '8f9170d1046708791f1fcd235a5f29bd864fdbacaa6943c33c563fd64d873f8f';
export const ROW_COUNT = UPPER_HUNTER_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = UPPER_HUNTER_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseUpperHunterGpfsExtraction(
    upperHunterExtraction(),
    UPPER_HUNTER_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
