import {
  PARKES_GPFS_FISCAL_YEAR,
  PARKES_GPFS_REPORTING_URL,
  parseParkesGpfsExtraction,
  type ParkesGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 94). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2026
// and Actual 2025 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2026. Parkes Shire
// Council prints eight revenue components (other revenues, other income and a
// real net gain on disposal of assets of 305) and four expense components. The
// net result is positive; the printed before-capital result is negative. Other
// comprehensive income has a single component (revaluation 18,129) equal to the
// printed other comprehensive income.
export const PARKES_PDF_URL =
  'https://www.parkes.nsw.gov.au/files/9957d5ac-c878-4061-9eeb-43a7d5e01650/Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf';
export const PARKES_PDF_SHA256 =
  'dbd8f6a4e1228e0f418b2d94fd4350b7ef72e17867a25306b7039c80302a535d';
export const PARKES_PDF_BYTES = 6311039;

export const PARKES_INCOME_TEXT =
  `Parkes Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 32,577 Rates and annual charges B2-1 32,425 30,886 11,267 User charges and fees B2-2 17,329 14,202 899 Other revenues 1,613 1,600 15,569 Grants and contributions provided for operating purposes B2-3 22,746 13,955 51,600 Grants and contributions provided for capital purposes B2-3 18,275 36,334 1,087 Interest and investment income 2,330 2,147 407 Other income 947 670 764 Net gain from the disposal of assets 305 1,489 114,170 Total income from continuing operations 95,970 101,283 Expenses from continuing operations 20,641 Employee benefits and on-costs B3-1 22,638 21,610 22,755 Materials and services B3-2 26,459 23,802 800 Borrowing costs 981 1,046 932 Other expenses 1,095 1,024 45,128 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 51,173 47,482 69,042 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 44,797 53,801 20,410 Depreciation, amortisation and impairment of non-financial assets B3-3 28,298 20,469 48,632 Operating result from continuing operations 16,499 33,332 48,632 Net operating result for the year attributable to Council 16,499 33,332 (2,968) Net operating result for the year before grants and contributions provided for capital purposes (1,776) (3,002) The above Income Statement should be read in conjunction with the accompanying notes. Parkes Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 69`;

export const PARKES_COMPREHENSIVE_TEXT =
  `Parkes Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 16,499 33,332 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 18,129 126,724 Total items which will not be reclassified subsequent to operating result 18,129 126,724 Total other comprehensive income for the year 18,129 126,724 Total comprehensive income for the year attributable to Council 34,628 160,056 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Parkes Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 69`;

export const PARKES_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Governance 63 – 1,437 1,538 (1,374) (1,538) – – – – Administration 3,018 3,869 14,291 13,489 (11,273) (9,620) 201 421 23,052 21,508 Public order and safety 2,290 1,428 1,417 1,326 873 102 2,223 1,365 10,446 8,356 Health 2 – 848 983 (846) (983) – – 526 548 Environment 5,438 5,111 6,665 5,166 (1,227) (55) 235 400 4,734 476 Community services and education 3,069 2,968 2,575 2,291 494 677 2,237 2,427 16,443 15,774 Housing and community amenities 1,598 902 892 778 706 124 1,267 586 46,632 44,942 Water supplies 19,731 26,829 14,797 12,026 4,934 14,803 3,856 12,946 275,675 239,933 Sewerage services 7,018 8,543 5,450 5,242 1,568 3,301 889 2,606 84,036 84,906 Recreation and culture 1,496 2,687 7,159 6,614 (5,663) (3,927) 1,477 2,545 97,310 96,277 Mining, manufacturing and construction 336 283 499 398 (163) (115) – – 114 136 Transport and communication 24,235 26,147 20,425 14,527 3,810 11,620 20,046 22,677 665,347 658,888 Economic affairs 2,510 2,229 3,016 3,573 (506) (1,344) 607 364 11,960 10,717 General purpose income 25,166 20,287 – – 25,166 20,287 7,983 3,952 9,498 18,747 Total functions and activities 95,970 101,283 79,471 67,951 16,499 33,332 41,021 50,289 1,245,773 1,201,208 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 69 Parkes Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function parkesExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: PARKES_PDF_SHA256,
      bytes: PARKES_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? PARKES_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? PARKES_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? PARKES_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const PARKES_CONTEXT: ParkesGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Parkes Shire Council Audited Annual Financial Statements YE 30 June 2026',
    url: PARKES_PDF_URL,
    fiscal_year: PARKES_GPFS_FISCAL_YEAR,
    listing_url: PARKES_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'parkes-gpfs/Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf',
    sha256: PARKES_PDF_SHA256,
    bytes: PARKES_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: PARKES_GPFS_REPORTING_URL,
};

/** Golden fixture for the parkes-gpfs module: 17 rows. */
export const PARKES_GPFS_ROW_COUNT = 17;
export const PARKES_GPFS_GOLDEN_DIGEST =
  'bf066077c6040f628062f5ebd525ba97bcf8ce392d952437f64d002f72b48720';
export const ROW_COUNT = PARKES_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = PARKES_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseParkesGpfsExtraction(parkesExtraction(), PARKES_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
