import {
  MID_WESTERN_REGIONAL_GPFS_FISCAL_YEAR,
  MID_WESTERN_REGIONAL_GPFS_REPORTING_URL,
  parseMidWesternRegionalGpfsExtraction,
  type MidWesternRegionalGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 90). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Mid-Western Regional Council
// prints seven revenue lines and five expense lines (including a real net loss
// on disposal of assets of 2,889). The net result and the printed before-capital
// result are both positive. Other comprehensive income has three components
// (revaluation 54,434; impairment reversal -321; remediation provision
// movements 108) summing to the printed other comprehensive income of 54,221.
export const MID_WESTERN_REGIONAL_PDF_URL =
  'https://www.midwestern.nsw.gov.au/files/assets/public/v/2/council/plans-and-strategies/financial-statements/mwrc-financial-statements-2025-26.pdf';
export const MID_WESTERN_REGIONAL_PDF_SHA256 =
  '47999cc3fa37d7c59fdc592e58bce035bb570da3c6ebfa4f2bf64477d204bbc1';
export const MID_WESTERN_REGIONAL_PDF_BYTES = 2508368;

export const MID_WESTERN_REGIONAL_INCOME_TEXT =
  `Mid-Western Regional Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 52,396 Rates and annual charges B2-1 52,334 50,057 27,974 User charges and fees B2-2 27,130 22,089 1,881 Other revenues 1,549 2,235 23,586 Grants and contributions provided for operating purposes B2-3 22,698 17,481 25,140 Grants and contributions provided for capital purposes B2-3 14,863 21,000 5,423 Interest and investment income 6,317 6,381 1,685 Other income 2,318 2,671 138,085 Total income from continuing operations 127,209 121,914 Expenses from continuing operations 40,629 Employee benefits and on-costs B3-1 39,805 37,555 41,843 Materials and services B3-2 33,627 33,580 785 Borrowing costs 953 935 1,845 Other expenses 1,703 1,711 2,592 Net loss from the disposal of assets 2,889 2,842 87,694 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 78,977 76,623 50,391 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 48,232 45,291 27,880 Depreciation, amortisation and impairment of non-financial assets B3-3 29,342 26,414 22,511 Operating result from continuing operations 18,890 18,877 22,511 Net operating result for the year attributable to Council 18,890 18,877 (2,629) Net operating result for the year before grants and contributions provided for capital purposes 4,027 (2,123) The above Income Statement should be read in conjunction with the accompanying notes. Mid-Western Regional Council Income Statement for the year ended 30 June 2026 Page 4 of 65`;

export const MID_WESTERN_REGIONAL_COMPREHENSIVE_TEXT =
  `Mid-Western Regional Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 18,890 18,877 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 54,434 (4,873) Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-5 (321) 110 Total items which will not be reclassified subsequent to operating result 54,113 (4,763) Amounts which will be reclassified subsequent to operating result when specific conditions are met Asset Remediation provision movements 108 369 Total items which will be reclassified subsequent to operating result when specific conditions are met 108 369 Total other comprehensive income for the year 54,221 (4,394) Total comprehensive income for the year attributable to Council 73,111 14,483 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Mid-Western Regional Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 65`;

export const MID_WESTERN_REGIONAL_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Looking after our community 6,347 10,483 23,855 22,438 (17,508) (11,955) 3,163 8,934 188,702 179,690 Protecting our natural environment 33,283 31,296 27,243 26,814 6,040 4,482 4,440 4,539 272,179 266,859 Building a strong local economy 6,379 4,009 6,232 4,151 147 (142) 1,123 (313) 78,776 62,588 Connecting the region 19,211 18,728 30,121 29,721 (10,910) (10,993) 15,111 15,243 867,126 837,276 Good government 61,989 57,398 20,868 19,913 41,121 37,485 13,724 10,078 235,269 216,592 Total functions and activities 127,209 121,914 108,319 103,037 18,890 18,877 37,561 38,481 1,642,052 1,563,005 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 65 Mid-Western Regional Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function midWesternRegionalExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: MID_WESTERN_REGIONAL_PDF_SHA256,
      bytes: MID_WESTERN_REGIONAL_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? MID_WESTERN_REGIONAL_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? MID_WESTERN_REGIONAL_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? MID_WESTERN_REGIONAL_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const MID_WESTERN_REGIONAL_CONTEXT: MidWesternRegionalGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Financial Statements 2025-26',
    url: MID_WESTERN_REGIONAL_PDF_URL,
    fiscal_year: MID_WESTERN_REGIONAL_GPFS_FISCAL_YEAR,
    listing_url: MID_WESTERN_REGIONAL_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'mid-western-regional-gpfs/mwrc-financial-statements-2025-26.pdf',
    sha256: MID_WESTERN_REGIONAL_PDF_SHA256,
    bytes: MID_WESTERN_REGIONAL_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: MID_WESTERN_REGIONAL_GPFS_REPORTING_URL,
};

/** Golden fixture for the mid-western-regional-gpfs module: 17 rows. */
export const MID_WESTERN_REGIONAL_GPFS_ROW_COUNT = 17;
export const MID_WESTERN_REGIONAL_GPFS_GOLDEN_DIGEST =
  '6dbdd5dbd169c66cb31eb6590b11d821df41ae8c587b1496844b53c9e6ccf879';
export const ROW_COUNT = MID_WESTERN_REGIONAL_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = MID_WESTERN_REGIONAL_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseMidWesternRegionalGpfsExtraction(
    midWesternRegionalExtraction(),
    MID_WESTERN_REGIONAL_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
