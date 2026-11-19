import {
  COONAMBLE_GPFS_FISCAL_YEAR,
  COONAMBLE_GPFS_REPORTING_URL,
  parseCoonambleGpfsExtraction,
  type CoonambleGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 6, 7 and 15 of 118). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025. Coonamble prints eight
// non-zero revenue lines (including other income and a net gain on disposal) and
// four expense lines (including borrowing costs; it prints no net loss on
// disposal). The net result is positive and the printed before-capital result is
// negative.
export const COONAMBLE_PDF_URL =
  'https://www.coonambleshire.nsw.gov.au/Annual_Financial_Statements-2025%20final%20audited.pdf';
export const COONAMBLE_PDF_SHA256 =
  'b58ac76bad53bf610f1ea4f9aeff36e8ecd1eacf3416d41662dd568edf1c1b94';
export const COONAMBLE_PDF_BYTES = 3_992_002;

export const COONAMBLE_INCOME_TEXT =
  "Coonamble Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 8,288 Rates and annual charges B2-1 7,960 7,518 10,277 User charges and fees B2-2 10,335 7,319 1,602 Other revenues B2-3 1,825 1,097 13,593 Grants and contributions provided for operating purposes B2-4 10,385 13,459 18,401 Grants and contributions provided for capital purposes B2-4 4,308 8,904 1,221 Interest and investment income B2-5 1,334 1,795 116 Other income B2-6 117 82 – Net gain from the disposal of assets B4-1 82 835 53,498 Total income from continuing operations 36,346 41,009 Expenses from continuing operations 13,021 Employee benefits and on-costs B3-1 11,784 9,528 14,293 Materials and services B3-2 13,220 11,669 46 Borrowing costs B3-3 32 25 1,054 Other expenses B3-5 1,051 1,029 28,414 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 26,087 22,251 25,084 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 10,259 18,758 6,688 Depreciation, amortisation and impairment of non-financial assets B3-4 8,057 7,669 18,396 Operating result from continuing operations 2,202 11,089 18,396 Net operating result for the year attributable to Council 2,202 11,089 5 Net operating result for the year before grants and contributions provided for capital purposes (2,106) 2,185 The above Income Statement should be read in conjunction with the accompanying notes. Coonamble Shire Council Income Statement for the year ended 30 June 2025 Coonamble Shire Council | Page 5 of 91";

export const COONAMBLE_COMPREHENSIVE_TEXT =
  "Coonamble Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 2,202 11,089 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 10,355 63,957 Total items which will not be reclassified subsequent to operating result 10,355 63,957 Total other comprehensive income for the year 10,355 63,957 Total comprehensive income for the year attributable to Council 12,557 75,046 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Coonamble Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Coonamble Shire Council | Page 6 of 91";

export const COONAMBLE_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Administration 12,832 15,555 6,150 5,197 6,682 10,358 2,915 7,833 44,971 51,057 Public order and safety 541 598 1,097 1,087 (556) (489) 15 50 5,944 5,765 Health 4 17 475 448 (471) (431) 1 4 – – Environment 1,190 673 2,226 2,080 (1,036) (1,407) 90 16 19,290 18,633 Community service and education 875 673 554 782 321 (109) 898 673 922 443 Housing and community amenities 344 257 598 698 (254) (441) 111 40 10,097 10,259 Water supplies 2,266 2,057 2,283 1,658 (17) 399 124 105 25,164 24,478 Sewerage supplies 1,594 1,421 1,181 1,231 413 190 94 7 25,359 19,687 Recreation and culture 1,284 841 2,802 2,362 (1,518) (1,521) 1,863 769 23,780 17,480 Mining, manufacturing and construction 2,127 2,672 3,469 4,529 (1,342) (1,857) – – 2,439 9,153 Transport and Communication 12,682 15,609 11,989 8,641 693 6,968 8,431 12,678 319,900 309,056 Economic Affairs 607 636 1,320 1,207 (713) (571) 150 188 4,399 4,582 Other – – – – – – 1 – – 436 Total functions and activities 36,346 41,009 34,144 29,920 2,202 11,089 14,693 22,363 482,265 471,029 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Coonamble Shire Council | Page 14 of 91 Coonamble Shire Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function coonambleExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: COONAMBLE_PDF_SHA256,
      bytes: COONAMBLE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? COONAMBLE_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? COONAMBLE_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? COONAMBLE_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const COONAMBLE_CONTEXT: CoonambleGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statements 2025 (final audited)',
    url: COONAMBLE_PDF_URL,
    fiscal_year: COONAMBLE_GPFS_FISCAL_YEAR,
    listing_url: COONAMBLE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'coonamble-gpfs/Annual_Financial_Statements-2025-final-audited.pdf',
    sha256: COONAMBLE_PDF_SHA256,
    bytes: COONAMBLE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: COONAMBLE_GPFS_REPORTING_URL,
};

/** Golden fixture for the coonamble-gpfs module: 17 rows. */
export const COONAMBLE_GPFS_ROW_COUNT = 17;
export const COONAMBLE_GPFS_GOLDEN_DIGEST =
  'b384c10e0286f8438b9236c1d47691c192c48e021f028c3ea8f275c9178c6795';
export const ROW_COUNT = COONAMBLE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = COONAMBLE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseCoonambleGpfsExtraction(coonambleExtraction(), COONAMBLE_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
