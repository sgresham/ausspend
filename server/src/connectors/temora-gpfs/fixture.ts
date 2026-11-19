import {
  TEMORA_GPFS_FISCAL_YEAR,
  TEMORA_GPFS_REPORTING_URL,
  parseTemoraGpfsExtraction,
  type TemoraGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 110). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2025
// and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Temora Shire
// Council prints seven revenue components (the 2025 net gain on disposal is nil)
// and five expense components, including a real net loss on disposal of assets
// of 52. The net result is positive while the before-capital result is negative.
// Other comprehensive income has three components (revaluation 39,459,
// impairment/revaluation reversal 1,960 and joint ventures/associates 44)
// summing to the printed 41,463.
export const TEMORA_PDF_URL =
  'https://www.temora.nsw.gov.au/files/assets/public/v/1/on-exhibition/2025/financial-statements/temora-shire-council-financial-statements-2024-25.pdf';
export const TEMORA_PDF_SHA256 =
  'd24693e9f83ed992a93be059587caac6d1e359b4018404464d515dacfa31fb56';
export const TEMORA_PDF_BYTES = 2464389;

export const TEMORA_INCOME_TEXT =
  `Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 7,290 Rates and annual charges B2-1 7,064 6,631 14,367 User charges and fees B2-2 14,162 16,473 468 Other revenues B2-3 759 489 8,896 Grants and contributions provided for operating purposes B2-4 6,813 11,357 10,343 Grants and contributions provided for capital purposes B2-4 10,403 6,497 987 Interest and investment income B2-5 1,163 1,120 342 Other income B2-6 344 363 87 Net gain from the disposal of assets B4-1 – 164 42,780 Total income from continuing operations 40,708 43,094 Expenses from continuing operations 11,326 Employee benefits and on-costs B3-1 10,444 11,239 13,075 Materials and services B3-2 13,922 16,036 59 Borrowing costs B3-3 56 69 787 Other expenses B3-5 752 747 – Net loss from the disposal of assets B4-1 52 – 25,247 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 25,226 28,091 17,533 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 15,482 15,003 7,931 Depreciation, amortisation and impairment of non-financial assets B3-4 8,628 7,868 9,602 Operating result from continuing operations 6,854 7,135 9,602 Net operating result for the year attributable to Council 6,854 7,135 (741) Net operating result for the year before grants and contributions provided for capital purposes (3,549) 638 The above Income Statement should be read in conjunction with the accompanying notes. Temora Shire Council Income Statement for the year ended 30 June 2025 Page 4`;

export const TEMORA_COMPREHENSIVE_TEXT =
  `$ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 6,854 7,135 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 39,459 16,485 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-7 1,960 4,109 Other comprehensive income – joint ventures and associates D2-1 44 – Total items which will not be reclassified subsequent to operating result 41,463 20,594 Total other comprehensive income for the year 41,463 20,594 Total comprehensive income for the year attributable to Council 48,317 27,729 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Temora Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5`;

export const TEMORA_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Building a Strong Local Economy 14,111 14,864 13,739 14,001 372 863 5,536 7,256 229,717 220,920 Enhancing our Quality of Life 12,414 14,712 13,995 16,691 (1,581) (1,979) 4,736 3,971 159,095 140,148 Enjoying our Beautiful Environment 4,107 2,676 2,592 2,201 1,515 475 2,805 1,485 39,924 20,544 Providing Local Leadership – – 189 176 (189) (176) – – – 16 Administration & General Purpose 10,076 10,842 3,339 2,890 6,737 7,952 4,139 5,142 4,315 5,599 Total functions and activities 40,708 43,094 33,854 35,959 6,854 7,135 17,216 17,854 433,051 387,227 Temora Shire Council Notes to the Financial Statements for the year ended 30 June 2025 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function temoraExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: TEMORA_PDF_SHA256,
      bytes: TEMORA_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? TEMORA_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? TEMORA_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? TEMORA_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const TEMORA_CONTEXT: TemoraGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Temora Shire Council Financial Statements 2024-25',
    url: TEMORA_PDF_URL,
    fiscal_year: TEMORA_GPFS_FISCAL_YEAR,
    listing_url: TEMORA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'temora-gpfs/temora-shire-council-financial-statements-2024-25.pdf',
    sha256: TEMORA_PDF_SHA256,
    bytes: TEMORA_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: TEMORA_GPFS_REPORTING_URL,
};

/** Golden fixture for the temora-gpfs module: 17 rows. */
export const TEMORA_GPFS_ROW_COUNT = 17;
export const TEMORA_GPFS_GOLDEN_DIGEST =
  '4c2e33e1de561eb01776c589dc64516d07c5a2d6df46bf613f93fe763a206d69';
export const ROW_COUNT = TEMORA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = TEMORA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseTemoraGpfsExtraction(
    temoraExtraction(),
    TEMORA_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
