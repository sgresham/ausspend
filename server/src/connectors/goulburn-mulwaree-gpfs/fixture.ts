import {
  GOULBURN_MULWAREE_GPFS_FISCAL_YEAR,
  GOULBURN_MULWAREE_GPFS_REPORTING_URL,
  parseGoulburnMulwareeGpfsExtraction,
  type GoulburnMulwareeGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 5, 6 and 14 of 109). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025 (the FY2024-25 reporting
// year). Goulburn Mulwaree Council prints seven revenue lines and five expense
// lines (including a real net loss on the disposal of assets of 3,332). The net
// result is positive; the printed before-capital result is negative. Other
// comprehensive income has a single component (revaluation -42,544) equal to
// the printed other comprehensive income.
export const GOULBURN_MULWAREE_PDF_URL =
  'https://www.goulburn.nsw.gov.au/files/sharedassets/public/v/1/finance-ipampr-docs/gmc-financial-statements-2024-2025.pdf';
export const GOULBURN_MULWAREE_PDF_SHA256 =
  '8c8e17c0ad6a0dd4066e734839edb47911ec006fd5d394e999390a1bdf1aac6f';
export const GOULBURN_MULWAREE_PDF_BYTES = 4127664;

export const GOULBURN_MULWAREE_INCOME_TEXT =
  `Goulburn Mulwaree Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 48,766 Rates and annual charges B2-1 49,576 42,871 19,820 User charges and fees B2-2 23,936 21,338 1,485 Other revenues 2,255 1,977 10,452 Grants and contributions provided for operating purposes B2-3 11,759 17,974 23,836 Grants and contributions provided for capital purposes B2-3 52,686 21,397 3,655 Interest and investment income B2-4 6,950 6,316 499 Other income 15 639 462 Net gain from the disposal of assets B4-1 – – 108,975 Total income from continuing operations 147,177 112,512 Expenses from continuing operations 34,440 Employee benefits and on-costs B3-1 32,738 31,749 28,045 Materials and services B3-2 30,237 29,717 1,489 Borrowing costs 1,826 1,896 1,009 Other expenses 943 1,142 – Net loss from the disposal of assets B4-1 3,332 227 64,983 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 69,076 64,731 43,992 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 78,101 47,781 33,574 Depreciation, amortisation and impairment of non-financial assets B3-3 31,232 30,571 10,418 Operating result from continuing operations 46,869 17,210 10,418 Net operating result for the year attributable to Council 46,869 17,210 (11,657) Net operating result for the year before grants and contributions provided for capital purposes (5,817) (4,187) The above Income Statement should be read in conjunction with the accompanying notes. Goulburn Mulwaree Council Income Statement for the year ended 30 June 2025 Page 4 of 108`;

export const GOULBURN_MULWAREE_COMPREHENSIVE_TEXT =
  `Goulburn Mulwaree Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 46,869 17,210 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 (42,544) 71,550 Total items which will not be reclassified subsequent to operating result (42,544) 71,550 Total other comprehensive income for the year (42,544) 71,550 Total comprehensive income for the year attributable to Council 4,325 88,760 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Goulburn Mulwaree Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 108`;

export const GOULBURN_MULWAREE_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Civic Leadership 39,949 37,994 12,147 10,613 27,802 27,381 7,928 10,425 253,591 201,569 Community 2,959 3,303 7,561 6,372 (4,602) (3,069) 2,044 2,581 180,112 173,675 Economy 6,792 5,642 14,145 14,532 (7,353) (8,890) 2,098 2,185 14,252 13,533 Environment 20,279 15,448 20,182 12,025 97 3,423 7,427 2,386 145,437 146,144 Infrastructure 77,198 50,125 46,273 51,760 30,925 (1,635) 44,948 21,794 1,192,956 1,223,722 Total functions and activities 147,177 112,512 100,308 95,302 46,869 17,210 64,445 39,371 1,786,348 1,758,643 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Goulburn Mulwaree Council | Notes to the Financial Statements 30 June 2025 Page 13 of 108`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function goulburnMulwareeExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: GOULBURN_MULWAREE_PDF_SHA256,
      bytes: GOULBURN_MULWAREE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? GOULBURN_MULWAREE_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? GOULBURN_MULWAREE_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? GOULBURN_MULWAREE_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const GOULBURN_MULWAREE_CONTEXT: GoulburnMulwareeGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024-25',
    url: GOULBURN_MULWAREE_PDF_URL,
    fiscal_year: GOULBURN_MULWAREE_GPFS_FISCAL_YEAR,
    listing_url: GOULBURN_MULWAREE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'goulburn-mulwaree-gpfs/gmc-financial-statements-2024-2025.pdf',
    sha256: GOULBURN_MULWAREE_PDF_SHA256,
    bytes: GOULBURN_MULWAREE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: GOULBURN_MULWAREE_GPFS_REPORTING_URL,
};

/** Golden fixture for the goulburn-mulwaree-gpfs module: 17 rows. */
export const GOULBURN_MULWAREE_GPFS_ROW_COUNT = 17;
export const GOULBURN_MULWAREE_GPFS_GOLDEN_DIGEST =
  'b684b4f4aa6637b43fc646d8b9ecdc82dbbe8dbf92ecb19cd8d10c85035f2b4c';
export const ROW_COUNT = GOULBURN_MULWAREE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = GOULBURN_MULWAREE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseGoulburnMulwareeGpfsExtraction(
    goulburnMulwareeExtraction(),
    GOULBURN_MULWAREE_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
