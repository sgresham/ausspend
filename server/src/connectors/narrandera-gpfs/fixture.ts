import {
  NARRANDERA_GPFS_FISCAL_YEAR,
  NARRANDERA_GPFS_REPORTING_URL,
  parseNarranderaGpfsExtraction,
  type NarranderaGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 6, 7 and 15 of 92). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2026
// and Actual 2025 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2026. Narrandera
// Shire Council prints seven revenue components (the 2026 net gain on disposal
// is nil) and five expense components, including a real net loss on disposal of
// assets of 818. The net result is positive (3,604) and the before-capital
// result is also positive (2,515). Other comprehensive income prints a single
// 2026 revaluation component of 17,143.
export const NARRANDERA_PDF_URL =
  'https://www.narrandera.nsw.gov.au/files/content/public/v/34/council/governance-and-transparency/integrated-planning-and-reporting/2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf';
export const NARRANDERA_PDF_SHA256 =
  '0996e1544d34fdc1b88d4609034486896ea9f084d9242ae0bb54632e2316d380';
export const NARRANDERA_PDF_BYTES = 2679914;

export const NARRANDERA_INCOME_TEXT =
  `Narrandera Shire Council | Income Statement | for the year ended 30 June 2026 Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 12,107 Rates and annual charges B2-1 12,127 10,576 3,053 User charges and fees B2-2 3,166 3,580 1,190 Other revenues B2-3 1,354 1,089 9,436 Grants and contributions provided for operating purposes B2-4 11,972 7,726 16,842 Grants and contributions provided for capital purposes B2-4 1,089 6,916 944 Interest and investment income B2-5 1,551 1,592 242 Other income B2-6 257 241 92 Net gain from the disposal of assets B4-1 – – 43,906 Total income from continuing operations 31,516 31,720 Expenses from continuing operations 10,035 Employee benefits and on-costs B3-1 10,572 9,502 7,162 Materials and services B3-2 9,259 10,590 178 Borrowing costs B3-3 151 155 461 Other expenses B3-5 445 437 – Net loss from the disposal of assets B4-1 818 2,127 17,836 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 21,245 22,811 26,070 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 10,271 8,909 6,803 Depreciation, amortisation and impairment of non-financial assets B3-4 6,667 6,640 19,267 Operating result from continuing operations 3,604 2,269 19,267 Net operating result for the year attributable to Council 3,604 2,269 2,425 Net operating result for the year before grants and contributions provided for capital purposes 2,515 (4,647) The above Income Statement should be read in conjunction with the accompanying notes. Narrandera Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 71`;

export const NARRANDERA_COMPREHENSIVE_TEXT =
  `Narrandera Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 3,604 2,269 Other comprehensive income: Amounts that will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-7 17,143 6,005 Other comprehensive income for the year 17,143 6,005 Total comprehensive income for the year attributable to Council 20,747 8,274 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Narrandera Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 71`;

export const NARRANDERA_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Our Community 2,441 5,263 7,142 8,023 (4,701) (2,760) 902 2,812 35,221 52,145 Our Environment 1,494 1,146 1,784 2,062 (290) (916) 147 79 3,327 3,234 Our Economy 668 1,231 2,667 3,080 (1,999) (1,849) 162 – 19,107 7,818 Our Infrastructure 7,599 13,082 11,525 11,475 (3,926) 1,607 2,565 5,741 256,357 229,605 Our Civic Leadership 19,314 10,998 4,794 4,811 14,520 6,187 9,285 6,010 24,607 25,567 Total functions and activities 31,516 31,720 27,912 29,451 3,604 2,269 13,061 14,642 338,619 318,369 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 71 Narrandera Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function narranderaExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: NARRANDERA_PDF_SHA256,
      bytes: NARRANDERA_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? NARRANDERA_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? NARRANDERA_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? NARRANDERA_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const NARRANDERA_CONTEXT: NarranderaGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Narrandera Shire Council Audited Financial Statements for 2025-26',
    url: NARRANDERA_PDF_URL,
    fiscal_year: NARRANDERA_GPFS_FISCAL_YEAR,
    listing_url: NARRANDERA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'narrandera-gpfs/2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf',
    sha256: NARRANDERA_PDF_SHA256,
    bytes: NARRANDERA_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: NARRANDERA_GPFS_REPORTING_URL,
};

/** Golden fixture for the narrandera-gpfs module: 17 rows. */
export const NARRANDERA_GPFS_ROW_COUNT = 17;
export const NARRANDERA_GPFS_GOLDEN_DIGEST = 'c0e6fb3c963686d55affa1ca142c8c525b2f9d262961ddd275c29bf96f92e49c';
export const ROW_COUNT = NARRANDERA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = NARRANDERA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseNarranderaGpfsExtraction(
    narranderaExtraction(),
    NARRANDERA_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
