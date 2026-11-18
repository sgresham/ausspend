import {
  NORTHERN_BEACHES_GPFS_FISCAL_YEAR,
  NORTHERN_BEACHES_GPFS_REPORTING_URL,
  parseNorthernBeachesGpfsExtraction,
  type NorthernBeachesGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 19, 20 and
// 29; PDF pages 20, 21 and 30). The income statement prints the Original
// unaudited budget column *before* the label, so a parser that took the first
// number in the line would read the budget; the expected values are all Actual
// 2025. The printed "Net gain from the disposal of assets" revenue line is a
// nil dash; the printed "Net loss from the disposal of assets" expense line is
// a non-zero $532 thousand.
const INCOME_TEXT = `Northern Beaches Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 259,113 Rates and annual charges B2-1 259,800 246,432 101,855 User charges and fees B2-2 104,477 99,931 20,684 Other revenues B2-3 25,015 21,620 22,502 Grants and contributions provided for operating purposes B2-4 24,526 26,529 32,343 Grants and contributions provided for capital purposes B2-4 44,330 29,218 8,411 Interest and investment income B2-5 11,739 11,083 6,785 Other income B2-6 7,664 6,915 392 Net gain from the disposal of assets B4-1 – – 452,085 Total income from continuing operations 477,551 441,728 Expenses from continuing operations 170,968 Employee benefits and on-costs B3-1 166,906 159,331 177,881 Materials and services B3-2 172,188 163,471 2,436 Borrowing costs B3-3 2,565 2,689 21,431 Other expenses B3-5 20,397 22,569 – Net loss from the disposal of assets B4-1 532 545 372,716 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 362,588 348,605 79,369 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 114,963 93,123 52,149 Depreciation, amortisation and impairment of non-financial assets B3-4 53,471 48,975 27,220 Operating result from continuing operations 61,492 44,148 27,220 Net operating result for the year 61,492 44,148 133 Net operating result attributable to non-controlling interests 204 191 (5,123) Net operating result for the year before grants and contributions provided for capital purposes 17,162 14,930 The above Income Statement should be read in conjunction with the accompanying notes. Northern Beaches Council Income Statement for the year ended 30 June 2025 Page 19`;

const COMPREHENSIVE_TEXT = `Northern Beaches Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 61,492 44,148 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-6 272,878 209,178 Total other comprehensive income for the year 272,878 209,178 Total comprehensive income for the year 334,370 253,326 Total comprehensive income attributable to Council 334,166 253,135 Total comprehensive income attributable to non-controlling interests 204 191 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Northern Beaches Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 20`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Environment and sustainability 24,542 8,783 42,303 42,641 (17,761) (33,858) 19,462 4,242 994,336 956,220 Waste and cleansing 62,132 58,774 72,281 67,947 (10,149) (9,173) 367 347 21,015 19,448 Total functions and activities 4 478,940 442,278 417,448 398,130 61,492 44,148 68,856 55,747 6,227,926 5,888,866 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Northern Beaches Council | Notes to the Financial Statements 30 June 2025 Page 29`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'e'.repeat(64), bytes: 2_106_256 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 20),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 21),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 30),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: NorthernBeachesGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024/25',
    url: 'https://www.northernbeaches.nsw.gov.au/media/69522?1794917647',
    fiscal_year: NORTHERN_BEACHES_GPFS_FISCAL_YEAR,
    listing_url: NORTHERN_BEACHES_GPFS_REPORTING_URL,
    resolved_url:
      'https://www.northernbeaches.nsw.gov.au/sites/default/files/media/files/2025-11/financial-statements-202425.pdf?1794917679',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/northern-beaches-gpfs/northern-beaches-financial-statements-2024-25.pdf',
    sha256: '58f68d6fa2a8487ed66f532c0f2c3432ac41fff227d1892b9518c76af952faf6',
    bytes: 2_106_256,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: NORTHERN_BEACHES_GPFS_REPORTING_URL,
};

/** Golden fixture for the northern-beaches-gpfs module migration: 18 rows, unchanged keys/amounts. */
export const NORTHERN_BEACHES_GPFS_ROW_COUNT = 18;
export const NORTHERN_BEACHES_GPFS_GOLDEN_DIGEST =
  '8f034be42ff30aaf063ccba41b65c2090a5d02151774288fd4e6caa3c187e5b0';
export const ROW_COUNT = 18;
export const GOLDEN_DIGEST = '8f034be42ff30aaf063ccba41b65c2090a5d02151774288fd4e6caa3c187e5b0';

export function goldenRecords() {
  const parsed = parseNorthernBeachesGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
