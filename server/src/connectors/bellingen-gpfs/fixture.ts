import {
  BELLINGEN_GPFS_FISCAL_YEAR,
  BELLINGEN_GPFS_REPORTING_URL,
  parseBellingenGpfsExtraction,
  type BellingenGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 98). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2026
// and Actual 2025 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2026. Bellingen
// Shire Council prints seven revenue components (other revenues and other
// income are separate; there is no net gain on disposal line) and five expense
// components, including a real net loss on disposal of assets of 680. The net
// result and the before-capital result are both positive. Other comprehensive
// income has a single component (revaluation 91,270) equal to the printed other
// comprehensive income.
export const BELLINGEN_PDF_URL =
  'https://www.bellingen.nsw.gov.au/files/sharedassets/public/v/1/files/annual-reports/ar-2025-26/annual-financial-statements-2026.pdf';
export const BELLINGEN_PDF_SHA256 =
  '265acc2086d001b6d5c0931ee216b59061865e143d96579462b34d7e66bcc702';
export const BELLINGEN_PDF_BYTES = 1289884;

export const BELLINGEN_INCOME_TEXT =
  `Bellingen Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 21,314 Rates and annual charges B2-1 21,279 20,123 12,587 User charges and fees B2-2 20,158 12,732 790 Other revenues B2-3 881 761 9,591 Grants and contributions provided for operating purposes B2-4 10,223 9,218 30,481 Grants and contributions provided for capital purposes B2-4 26,911 30,260 1,467 Interest and investment income B2-5 2,072 2,783 152 Other income B2-6 135 407 76,382 Total income from continuing operations 81,659 76,284 Expenses from continuing operations 14,396 Employee benefits and on-costs B3-1 15,423 13,419 17,935 Materials and services B3-2 24,521 17,779 1,270 Borrowing costs B3-3 1,136 1,222 1,719 Other expenses B3-5 1,633 1,541 – Net loss from the disposal of assets B4-1 680 1,687 35,320 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 43,393 35,648 41,062 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 38,266 40,636 9,073 Depreciation, amortisation and impairment of non-financial assets B3-4 10,456 8,941 31,989 Operating result from continuing operations 27,810 31,695 31,989 Net operating result for the year attributable to Council 27,810 31,695 1,508 Net operating result for the year before grants and contributions provided for capital purposes 899 1,435 The above Income Statement should be read in conjunction with the accompanying notes. Bellingen Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 68`;

export const BELLINGEN_COMPREHENSIVE_TEXT =
  `Bellingen Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 27,810 31,695 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 91,270 18,031 Total items which will not be reclassified subsequent to operating result 91,270 18,031 Total other comprehensive income for the year 91,270 18,031 Total comprehensive income for the year attributable to Council 119,080 49,726 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Bellingen Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 68`;

export const BELLINGEN_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Governance 32 46 1,138 820 (1,106) (774) – – – – Administration 952 384 3,102 2,905 (2,150) (2,521) 556 128 62,485 52,186 Public order and safety 604 415 1,679 1,317 (1,075) (902) 403 267 15,282 12,763 Health 55 48 141 134 (86) (86) – – 42 35 Environment 6,008 6,692 6,774 5,186 (766) 1,506 376 923 526 439 Community services and education 1,077 670 1,943 1,405 (866) (735) 971 528 10,469 8,743 Housing and community amenities 414 408 2,090 2,180 (1,676) (1,772) 370 306 35,409 29,573 Water supplies 4,563 4,219 3,721 3,808 842 411 157 132 77,223 75,201 Sewerage services 8,609 10,820 5,459 4,001 3,150 6,819 3,668 5,769 90,620 86,694 Recreation and culture 7,156 3,962 3,381 3,180 3,775 782 7,083 3,868 71,531 59,741 Mining, manufacturing and construction 154 175 274 238 (120) (63) – – 639 533 Transport and communication 31,337 31,690 20,814 17,929 10,523 13,761 16,014 23,764 498,777 416,565 Economic Affairs 661 899 2,950 1,163 (2,289) (264) 245 184 8,919 7,449 General Purpose 20,037 15,856 383 323 19,654 15,533 7,291 3,609 – – Total functions and activities 81,659 76,284 53,849 44,589 27,810 31,695 37,134 39,478 871,922 749,922 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 68 Bellingen Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function bellingenExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BELLINGEN_PDF_SHA256,
      bytes: BELLINGEN_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BELLINGEN_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? BELLINGEN_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? BELLINGEN_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BELLINGEN_CONTEXT: BellingenGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Bellingen Shire Council Financial Statements 2025-26',
    url: BELLINGEN_PDF_URL,
    fiscal_year: BELLINGEN_GPFS_FISCAL_YEAR,
    listing_url: BELLINGEN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'bellingen-gpfs/annual-financial-statements-2026.pdf',
    sha256: BELLINGEN_PDF_SHA256,
    bytes: BELLINGEN_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BELLINGEN_GPFS_REPORTING_URL,
};

/** Golden fixture for the bellingen-gpfs module: 17 rows. */
export const BELLINGEN_GPFS_ROW_COUNT = 17;
export const BELLINGEN_GPFS_GOLDEN_DIGEST =
  'cf47acff01c2a1a150c5792eaae517c974723b69031aa34a52f5a1c99e5b7fc6';
export const ROW_COUNT = BELLINGEN_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BELLINGEN_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBellingenGpfsExtraction(
    bellingenExtraction(),
    BELLINGEN_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
