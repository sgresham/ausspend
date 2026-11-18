import {
  LAKE_MACQUARIE_GPFS_FISCAL_YEAR,
  LAKE_MACQUARIE_GPFS_REPORTING_URL,
  parseLakeMacquarieGpfsExtraction,
  type LakeMacquarieGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed/PDF pp. 4, 5 and
// 14 of 82). The Income Statement prints the Original unaudited budget column
// before the line label, with Actual 2025 and Actual 2024 after it. A parser that
// took the first number in the line would read the budget; the expected values
// are all Actual 2025. The net result is positive while the printed
// before-capital result is negative.
const INCOME_TEXT = `§Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 218,357 Rates and annual charges B2-1 224,082 207,942 27,257 User charges and fees B2-2 28,644 27,248 11,253 Other revenues B2-3 22,375 17,850 30,726 Grants and contributions provided for operating purposes B2-4 24,924 32,586 55,425 Grants and contributions provided for capital purposes B2-4 132,007 151,974 14,900 Interest and investment income B2-5 23,923 16,478 6,300 Other income B2-6 7,658 11,291 364,218 Total income from continuing operations 463,613 465,369 Expenses from continuing operations 117,087 Employee benefits and on-costs B3-1 119,020 110,219 88,429 Materials and services B3-2 93,667 85,819 8,768 Borrowing costs B3-3 9,916 15,753 18,443 Other expenses B3-5 18,753 18,185 – Net loss from the disposal of assets B4-1 14,040 2,514 232,727 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 255,396 232,490 131,491 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 208,217 232,879 75,525 Depreciation, amortisation and impairment of non-financial assets B3-4 83,068 76,783 55,966 Operating result from continuing operations 125,149 156,096 55,966 Net operating result for the year attributable to Council 125,149 156,096 541 Net operating result for the year before grants and contributions provided for capital purposes (6,858) 4,122 The above Income Statement should be read in conjunction with the accompanying notes. Lake Macquarie City Council Income Statement for the year ended 30 June 2025 Page 4 of 82`;

const COMPREHENSIVE_TEXT = `§Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 125,149 156,096 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-6 (132,349) 142,240 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-6 – (176) Total items which will not be reclassified subsequent to operating result (132,349) 142,064 Total other comprehensive income for the year (132,349) 142,064 Total comprehensive income for the year attributable to Council (7,200) 298,160 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Lake Macquarie City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 82`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Unique Landscape 6,050 5,628 43,222 42,056 (37,172) (36,428) 973 902 21,324 23,035 Lifestyle and Wellbeing 109,821 107,534 118,835 110,919 (9,014) (3,385) 34,400 34,975 750,249 720,139 Mobility and Accessibility 96,357 121,301 80,473 74,465 15,884 46,836 96,353 121,262 3,354,561 3,391,743 Diverse Economy 24,067 27,594 26,947 27,298 (2,880) 296 565 346 287,573 313,661 Connected Communities 5,467 4,206 19,132 18,370 (13,665) (14,164) 5,137 3,709 26,660 24,234 Creativity 1,781 1,360 12,454 11,779 (10,673) (10,419) 1,200 867 50,041 37,825 Shared Decision-Making 168 139 5,967 3,779 (5,799) (3,640) 2 2 – – Organisational Support 219,902 197,607 31,434 20,607 188,468 177,000 18,301 22,497 173,833 142,146 Total functions and activities 463,613 465,369 338,464 309,273 125,149 156,096 156,931 184,560 4,664,242 4,652,783 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 82`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'b5e031999a9e37d69e8df2afcd9a1756adb95229218412dc5919ee16fb93b72b',
      bytes: 2_290_159,
    },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.lakemac.com.au/files/assets/public/v/1/council/annual-reports/annual-financial-statements-for-the-year-ended-30-june-2025.pdf';

const CONTEXT: LakeMacquarieGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual financial statements for the year ended 30 June 2025 (PDF, 2MB)',
    url: PDF_URL,
    fiscal_year: LAKE_MACQUARIE_GPFS_FISCAL_YEAR,
    listing_url: LAKE_MACQUARIE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/lake-macquarie-gpfs/annual-financial-statements-for-the-year-ended-30-june-2025.pdf',
    sha256: 'b5e031999a9e37d69e8df2afcd9a1756adb95229218412dc5919ee16fb93b72b',
    bytes: 2_290_159,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: LAKE_MACQUARIE_GPFS_REPORTING_URL,
};

/** Golden fixture for the lake-macquarie-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const LAKE_MACQUARIE_GPFS_ROW_COUNT = 17;
export const LAKE_MACQUARIE_GPFS_GOLDEN_DIGEST =
  'b7d992e8f1124ffd4924dbb8bcdfa99f99f5f675b02c04f9ec6680f8f6041aa7';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'b7d992e8f1124ffd4924dbb8bcdfa99f99f5f675b02c04f9ec6680f8f6041aa7';

export function goldenRecords() {
  const parsed = parseLakeMacquarieGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
