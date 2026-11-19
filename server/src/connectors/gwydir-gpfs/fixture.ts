import {
  GWYDIR_GPFS_FISCAL_YEAR,
  GWYDIR_GPFS_REPORTING_URL,
  parseGwydirGpfsExtraction,
  type GwydirGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 94). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2025
// and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Gwydir Shire
// Council prints seven revenue components (the 2025 net gain on disposal is nil)
// and five expense components, including a real net loss on disposal of assets
// of 2,755. The net result is positive (7,875) while the before-capital result
// is negative (-11,295). Other comprehensive income prints three components:
// revaluation 114,402, impairment reversal 3,143 and impairment loss (4,638),
// summing to the printed 112,907.
export const GWYDIR_PDF_URL =
  'https://www.gwydir.nsw.gov.au/files/sharedassets/public/v/1/council/governance/financial-statements-and-budgets/annual-financial-statements-2025.pdf';
export const GWYDIR_PDF_SHA256 =
  '740b9e4cbcd804462fbd008b249bbdc520c5699dbe61f8f8fe3df8dd50841a07';
export const GWYDIR_PDF_BYTES = 1862025;

export const GWYDIR_INCOME_TEXT =
  `Gwydir Shire Council | Income Statement | for the year ended 30 June 2025 Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 12,543 Rates and annual charges B2-1 12,766 12,110 3,229 User charges and fees B2-2 8,449 7,318 5,619 Other revenues B2-3 7,520 5,463 14,155 Grants and contributions provided for operating purposes B2-4 10,168 19,519 22,761 Grants and contributions provided for capital purposes B2-4 19,170 13,637 521 Interest and investment income B2-5 1,207 1,025 – Other income B2-6 347 356 700 Net gain from the disposal of assets B4-1 – – 59,528 Total income from continuing operations 59,627 59,428 Expenses from continuing operations 17,126 Employee benefits and on-costs B3-1 16,611 15,650 22,536 Materials and services B3-2 19,805 18,437 612 Borrowing costs B3-3 1,221 904 3,665 Other expenses B3-5 694 722 – Net loss from the disposal of assets B4-1 2,755 2,955 43,939 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 41,086 38,668 15,589 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 18,541 20,760 10,374 Depreciation, amortisation and impairment of non-financial assets B3-4 10,666 10,496 5,215 Operating result from continuing operations 7,875 10,264 5,215 Net operating result for the year attributable to Council 7,875 10,264 (3,355) Net operating result for the year before grants and contributions provided for capital purposes (11,295) (3,373) The above Income Statement should be read in conjunction with the accompanying notes. Gwydir Shire Council Income Statement for the year ended 30 June 2025 Page 4 of 70`;

export const GWYDIR_COMPREHENSIVE_TEXT =
  `Gwydir Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 7,875 10,264 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 114,402 25,928 Impairment Reversal 3,143 4,914 Impairment loss relating to infrastructure, property, plant and equipment C1-7 (4,638) (1,643) Total items which will not be reclassified subsequent to operating result 112,907 29,199 Total other comprehensive income for the year 112,907 29,199 Total comprehensive income for the year attributable to Council 120,782 39,463 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Gwydir Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 70`;

export const GWYDIR_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Social 6,834 5,421 6,873 5,301 (39) 120 2,271 17,036 20,060 23,952 Other – – – – – – 778 69 778 2,002 Economic 24,689 21,955 26,162 24,596 (1,473) (2,641) 17,629 7,974 512,071 344,699 Environment 3,478 3,335 4,548 3,501 (1,070) (166) 287 1,310 19,327 26,147 Civic Leadership 2,644 907 2,642 1,132 2 (225) 1,113 34 7,155 4,809 Governance 21,982 27,810 11,527 14,634 10,455 13,176 7,260 6,733 137,892 170,825 Total functions and activities 59,627 59,428 51,752 49,164 7,875 10,264 29,338 33,156 697,283 572,434 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 70 Gwydir Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function gwydirExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: GWYDIR_PDF_SHA256,
      bytes: GWYDIR_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? GWYDIR_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? GWYDIR_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? GWYDIR_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const GWYDIR_CONTEXT: GwydirGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Gwydir Shire Council Annual Financial Statements 2025',
    url: GWYDIR_PDF_URL,
    fiscal_year: GWYDIR_GPFS_FISCAL_YEAR,
    listing_url: GWYDIR_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'gwydir-gpfs/annual-financial-statements-2025.pdf',
    sha256: GWYDIR_PDF_SHA256,
    bytes: GWYDIR_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: GWYDIR_GPFS_REPORTING_URL,
};

/** Golden fixture for the gwydir-gpfs module: 17 rows. */
export const GWYDIR_GPFS_ROW_COUNT = 17;
export const GWYDIR_GPFS_GOLDEN_DIGEST = '3d1219f205a0954f4a79cd3bba2e9082a53c9766a86ff0e525e5ed46ce576774';
export const ROW_COUNT = GWYDIR_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = GWYDIR_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseGwydirGpfsExtraction(
    gwydirExtraction(),
    GWYDIR_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
