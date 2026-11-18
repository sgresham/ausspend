import {
  CANTERBURY_BANKSTOWN_GPFS_FISCAL_YEAR,
  CANTERBURY_BANKSTOWN_GPFS_REPORTING_URL,
  parseCanterburyBankstownGpfsExtraction,
  type CanterburyBankstownGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 4, 5 and 14;
// PDF pages 4, 5 and 14). The income statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after it.
// A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. The printed "Net operating result for the
// year before grants and contributions provided for capital purposes" is
// negative and is kept in reconciliation evidence only (amount_cents >= 0).
const INCOME_TEXT = `Canterbury-Bankstown Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 309,708 Rates and annual charges B2-1 309,533 290,787 21,257 User charges and fees B2-2 25,041 22,072 19,382 Other revenues B2-3 20,626 22,255 20,760 Grants and contributions provided for operating purposes B2-4 22,588 23,931 31,774 Grants and contributions provided for capital purposes B2-4 68,838 48,735 20,875 Interest and investment income B2-5 29,926 18,121 6,975 Other income B2-6 7,436 6,792 430,731 Total income from continuing operations 483,988 432,693 Expenses from continuing operations 177,762 Employee benefits and on-costs B3-1 177,897 167,058 131,706 Materials and services B3-2 116,600 123,453 3,293 Borrowing costs B3-3 1,288 1,101 9,378 Other expenses B3-5 26,464 36,866 – Net loss from the disposal of assets B4-1 6,318 5,733 322,139 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 328,567 334,211 108,592 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 155,421 98,482 96,947 Depreciation, amortisation and impairment of non-financial assets B3-4 101,804 96,916 11,645 Operating result from continuing operations 53,617 1,566 11,645 Net operating result for the year attributable to Council 53,617 1,566 (20,129) Net operating result for the year before grants and contributions provided for capital purposes (15,221) (47,169) The above Income Statement should be read in conjunction with the accompanying notes. Canterbury-Bankstown Council Income Statement for the year ended 30 June 2025 Page 4 of 75`;

const COMPREHENSIVE_TEXT = `Canterbury-Bankstown Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 53,617 1,566 §Subnote§ Other comprehensive income Amounts that will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-6 204,515 184,819 Amounts that will be reclassified subsequent to operating result when specific conditions are met Gain/(loss) on revaluation of financial assets at fair value through other comprehensive income 393 318 Other movements - Voyager Point Footbridge (2,829) – Total other comprehensive income for the year 202,079 185,137 Total comprehensive income for the year attributable to Council 255,696 186,703 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Canterbury-Bankstown Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 75`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Safe and strong 13,068 10,210 21,421 20,358 (8,353) (10,148) 8,637 6,175 59,891 42,165 Clean and green 97,003 87,818 107,438 108,762 (10,435) (20,944) 17,281 10,501 12,337 18,055 Liveable and distinctive 49,007 47,969 34,941 45,179 14,066 2,790 9,178 8,949 – – Moving and integrated 17,538 14,364 86,804 90,208 (69,266) (75,844) 27,612 12,440 2,778,506 2,657,709 Healthy and active 9,749 17,880 84,053 77,700 (74,304) (59,820) 8,127 14,600 1,362,530 1,306,874 Prosperous and innovative 4,498 2,055 7,431 7,333 (2,933) (5,278) 7,328 7,146 12,408 10,307 Leading and engaged 293,125 252,397 88,283 81,587 204,842 170,810 13,263 12,855 788,031 672,632 Total functions and activities 483,988 432,693 430,371 431,127 53,617 1,566 91,426 72,666 5,013,703 4,707,742 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 75 Canterbury-Bankstown Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'e'.repeat(64), bytes: 3_526_499 },
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

const CONTEXT: CanterburyBankstownGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: "Financial Statements 2024-25 and Auditor's Reports PDF (3.36 MB)",
    url: 'https://haveyoursay.cbcity.nsw.gov.au/download_file/7155/2442',
    fiscal_year: CANTERBURY_BANKSTOWN_GPFS_FISCAL_YEAR,
    listing_url: CANTERBURY_BANKSTOWN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/canterbury-bankstown-gpfs/canterbury-bankstown-financial-statements-2024-25.pdf',
    sha256: 'd195790e10452808497fdc0eb95589e751ae6a64a50fc8d076ce467ac0ce8650',
    bytes: 3_526_499,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: CANTERBURY_BANKSTOWN_GPFS_REPORTING_URL,
};

/** Golden fixture for the canterbury-bankstown-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const CANTERBURY_BANKSTOWN_GPFS_ROW_COUNT = 17;
export const CANTERBURY_BANKSTOWN_GPFS_GOLDEN_DIGEST =
  'bfa781462513cafbcae698e231cac4d0565918ce2b6036b659bb00a1dd9fd5ed';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'bfa781462513cafbcae698e231cac4d0565918ce2b6036b659bb00a1dd9fd5ed';

export function goldenRecords() {
  const parsed = parseCanterburyBankstownGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
