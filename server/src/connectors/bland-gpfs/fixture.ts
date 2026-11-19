import {
  BLAND_GPFS_FISCAL_YEAR,
  BLAND_GPFS_REPORTING_URL,
  parseBlandGpfsExtraction,
  type BlandGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 6, 7 and 15 of 113). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2025
// and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Bland Shire
// Council prints seven revenue components (the 2025 net gain on disposal is nil)
// and five expense components, including a real net loss on disposal of assets
// of 866. The net result is positive (10,499) and the before-capital result is
// also positive (4,751). Other comprehensive income prints revaluation 21,980
// and joint ventures/associates 38, summing to the printed 22,018.
export const BLAND_PDF_URL =
  'https://www.blandshire.nsw.gov.au/files/sharedassets/public/v/1/finance/annual_financial_statements-2025.pdf';
export const BLAND_PDF_SHA256 =
  '8526ac30e7cffcc9545d6ebb491927d5919a9d4cac7e5506972d813eb55c3758';
export const BLAND_PDF_BYTES = 2771199;

export const BLAND_INCOME_TEXT =
  `Bland Shire Council | Income Statement | for the year ended 30 June 2025 Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 11,293 Rates and annual charges B2-1 11,322 10,825 1,021 User charges and fees B2-2 1,280 1,333 750 Other revenues B2-3 776 545 10,089 Grants and contributions provided for operating purposes B2-4 10,421 23,919 4,990 Grants and contributions provided for capital purposes B2-4 5,748 12,073 468 Interest and investment income B2-5 4,321 3,763 1,000 Other income B2-6 5,398 1,060 29,611 Total income from continuing operations 39,266 53,518 Expenses from continuing operations 9,816 Employee benefits and on-costs B3-1 9,266 8,651 11,395 Materials and services B3-2 8,537 10,510 250 Borrowing costs B3-3 286 243 800 Other expenses B3-5 870 532 – Net loss from the disposal of assets B4-1 866 2,185 22,261 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 19,825 22,121 7,350 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 19,441 31,397 8,900 Depreciation, amortisation and impairment of non-financial assets B3-4 8,942 8,250 (1,550) Operating result from continuing operations 10,499 23,147 (1,550) Net operating result for the year attributable to Council 10,499 23,147 – Net operating result for the year before grants and contributions provided for capital purposes 4,751 11,074 The above Income Statement should be read in conjunction with the accompanying notes. Bland Shire Council Income Statement for the year ended 30 June 2025 Page 5 of 91`;

export const BLAND_COMPREHENSIVE_TEXT =
  `Bland Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 10,499 23,147 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 21,980 30,691 Other comprehensive income – joint ventures and associates D2-2 38 233 Total items which will not be reclassified subsequent to operating result 22,018 30,924 Total other comprehensive income for the year 22,018 30,924 Total comprehensive income for the year attributable to Council 32,517 54,071 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Bland Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 91`;

export const BLAND_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Our People 1,495 1,058 3,602 7,365 (2,107) (6,307) 2,287 2,658 150 546 Our Places 19,983 35,187 23,262 20,697 (3,279) 14,490 8,332 27,620 8,914 456,156 Our Leadership 16,206 16,615 1,396 1,801 14,810 14,814 4,392 452 – 712 Our Prosperity 1,582 658 507 508 1,075 150 1,158 484 – 76,009 Other – – – – – – – 4,778 549,237 1,175 Total functions and activities 39,266 53,518 28,767 30,371 10,499 23,147 16,169 35,992 558,301 534,598 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 91 Bland Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function blandExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BLAND_PDF_SHA256,
      bytes: BLAND_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BLAND_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? BLAND_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? BLAND_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BLAND_CONTEXT: BlandGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Bland Shire Council Annual Financial Statements 2024-2025',
    url: BLAND_PDF_URL,
    fiscal_year: BLAND_GPFS_FISCAL_YEAR,
    listing_url: BLAND_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'bland-gpfs/annual_financial_statements-2025.pdf',
    sha256: BLAND_PDF_SHA256,
    bytes: BLAND_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BLAND_GPFS_REPORTING_URL,
};

/** Golden fixture for the bland-gpfs module: 17 rows. */
export const BLAND_GPFS_ROW_COUNT = 17;
export const BLAND_GPFS_GOLDEN_DIGEST = 'b987d25cbcf2ae33d46d12b86e63dc82a95c6c410e71bcb5e562ca60624c0231';
export const ROW_COUNT = BLAND_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BLAND_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBlandGpfsExtraction(
    blandExtraction(),
    BLAND_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
