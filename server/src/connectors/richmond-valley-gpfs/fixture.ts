import {
  RICHMOND_VALLEY_GPFS_FISCAL_YEAR,
  RICHMOND_VALLEY_GPFS_REPORTING_URL,
  parseRichmondValleyGpfsExtraction,
  type RichmondValleyGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 6, 7 and 15 of 120). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Richmond Valley Council
// prints seven revenue lines and five expense lines (including a real net loss
// on the disposal of assets of 6,393). The net result is positive; the printed
// before-capital result is negative. Other comprehensive income has two
// components (revaluation 14,492; impairment reversal 5,703) summing to the
// printed other comprehensive income of 20,195.
export const RICHMOND_VALLEY_PDF_URL =
  'https://richmondvalley.nsw.gov.au/wp-content/uploads/2026/10/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf';
export const RICHMOND_VALLEY_PDF_SHA256 =
  'aad1a9a65df3fbb58291444b9cb38347b4eb85d025f7dd9e41ecb57005703b2f';
export const RICHMOND_VALLEY_PDF_BYTES = 2803124;

export const RICHMOND_VALLEY_INCOME_TEXT =
  `Richmond Valley Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 35,889 Rates and annual charges B2-1 35,348 33,672 17,542 User charges and fees B2-2 21,218 17,219 91 Other revenues B2-3 98 80 17,232 Grants and contributions provided for operating purposes B2-4 22,039 15,286 45,662 Grants and contributions provided for capital purposes B2-4 36,171 31,879 1,764 Interest and investment income B2-5 3,099 2,980 3,165 Other income B2-6 3,165 2,923 121,345 Total income from continuing operations 121,138 104,039 Expenses from continuing operations 28,668 Employee benefits and on-costs B3-1 27,939 28,522 26,803 Materials and services B3-2 31,406 26,053 698 Borrowing costs B3-3 640 800 3,398 Other expenses B3-5 2,549 2,650 2,215 Net loss from the disposal of assets B4-1 6,393 3,851 61,782 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 68,927 61,876 59,563 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 52,211 42,163 24,673 Depreciation, amortisation and impairment of non-financial assets B3-4 26,519 26,052 34,890 Operating result from continuing operations 25,692 16,111 34,890 Net operating result for the year attributable to Council 25,692 16,111 (10,807) Net operating result for the year before grants and contributions provided for capital purposes (10,479) (15,768) The above Income Statement should be read in conjunction with the accompanying notes. Richmond Valley Council Income Statement for the year ended 30 June 2026 Page 5 of 91`;

export const RICHMOND_VALLEY_COMPREHENSIVE_TEXT =
  `Richmond Valley Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 25,692 16,111 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 14,492 31,598 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-7 5,703 (3,086) Total items which will not be reclassified subsequent to operating result 20,195 28,512 Total other comprehensive income for the year 20,195 28,512 Total comprehensive income for the year attributable to Council 45,887 44,623 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Richmond Valley Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6 of 91`;

export const RICHMOND_VALLEY_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Strengthening our role in the region 9,809 3,330 6,893 3,602 2,916 (272) 10,496 4,796 40,558 41,533 Creating great places to live 68,944 64,303 71,453 65,755 (2,509) (1,452) 36,404 36,039 1,143,263 1,101,384 Protecting our unique environment 10,356 9,888 12,037 11,793 (1,681) (1,905) 198 241 16,759 18,035 Delivering for our community 32,029 26,518 5,063 6,778 26,966 19,740 11,112 6,089 117,710 105,908 Total functions and activities 121,138 104,039 95,446 87,928 25,692 16,111 58,210 47,165 1,318,290 1,266,860 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 91 Richmond Valley Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function richmondValleyExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: RICHMOND_VALLEY_PDF_SHA256,
      bytes: RICHMOND_VALLEY_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? RICHMOND_VALLEY_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? RICHMOND_VALLEY_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? RICHMOND_VALLEY_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const RICHMOND_VALLEY_CONTEXT: RichmondValleyGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: '2025/2026 Financial Statements',
    url: RICHMOND_VALLEY_PDF_URL,
    fiscal_year: RICHMOND_VALLEY_GPFS_FISCAL_YEAR,
    listing_url: RICHMOND_VALLEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'richmond-valley-gpfs/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf',
    sha256: RICHMOND_VALLEY_PDF_SHA256,
    bytes: RICHMOND_VALLEY_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: RICHMOND_VALLEY_GPFS_REPORTING_URL,
};

/** Golden fixture for the richmond-valley-gpfs module: 17 rows. */
export const RICHMOND_VALLEY_GPFS_ROW_COUNT = 17;
export const RICHMOND_VALLEY_GPFS_GOLDEN_DIGEST =
  '164819ca30687489de14c89022f2dc376b291b2182a196a01872b64f884a5574';
export const ROW_COUNT = RICHMOND_VALLEY_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = RICHMOND_VALLEY_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseRichmondValleyGpfsExtraction(
    richmondValleyExtraction(),
    RICHMOND_VALLEY_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
