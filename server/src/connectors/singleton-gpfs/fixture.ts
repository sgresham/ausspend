import {
  SINGLETON_GPFS_FISCAL_YEAR,
  SINGLETON_GPFS_REPORTING_URL,
  parseSingletonGpfsExtraction,
  type SingletonGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 94). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Singleton Council prints
// seven revenue lines and five expense lines (including a real net loss on
// disposal of assets of 1,721). The net result and the printed before-capital
// result are both positive. Other comprehensive income has two components
// (revaluation 34,798; remediation-provision re-measurement 5,509) summing to
// the printed other comprehensive income of 40,307.
export const SINGLETON_PDF_URL =
  'https://docs.singleton.nsw.gov.au/default.aspx?DocID=cVK9GDcvrvY%3d';
export const SINGLETON_PDF_SHA256 =
  '717bfeec069e1564f2a712bbff73987f626624180b421905eaa71e8aa6dc0dbc';
export const SINGLETON_PDF_BYTES = 5647126;

export const SINGLETON_INCOME_TEXT =
  `Singleton Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 43,108 Rates and annual charges B2-1 41,739 39,287 24,623 User charges and fees B2-2 30,000 27,855 1,669 Other revenues 3,696 1,014 11,422 Grants and contributions provided for operating purposes B2-3 13,603 9,876 7,379 Grants and contributions provided for capital purposes B2-3 15,937 26,623 6,202 Interest and investment income 5,308 5,051 291 Other income 4,229 3,378 – Net gain from the disposal of assets – 266 94,694 Total income from continuing operations 114,512 113,350 Expenses from continuing operations 31,731 Employee benefits and on-costs B3-1 33,954 30,455 32,530 Materials and services B3-2 37,544 34,725 659 Borrowing costs 1,339 710 2,577 Other expenses 2,836 2,950 1,472 Net loss from the disposal of assets 1,721 – 68,969 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 77,394 68,840 25,725 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 37,118 44,510 18,232 Depreciation, amortisation and impairment of non-financial assets B3-3 20,508 18,660 7,493 Operating result from continuing operations 16,610 25,850 7,493 Net operating result for the year attributable to Council 16,610 25,850 114 Net operating result for the year before grants and contributions provided for capital purposes 673 (773) The above Income Statement should be read in conjunction with the accompanying notes. Singleton Council Income Statement for the year ended 30 June 2026 Page 4 of 69`;

export const SINGLETON_COMPREHENSIVE_TEXT =
  `Singleton Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 16,610 25,850 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-6 34,798 (16,632) Re-measurement of remediation provision C2-5 5,509 – Other comprehensive income for the year 40,307 (16,632) Total comprehensive income for the year attributable to Council 56,917 9,218 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Singleton Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 69`;

export const SINGLETON_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Our Leadership 34,997 34,162 9,881 9,054 25,116 25,108 4,526 4,248 62,910 39,782 Our Places 57,809 56,105 59,833 49,378 (2,024) 6,727 21,904 28,539 1,289,291 1,271,649 Our Community 3,021 2,880 6,828 6,075 (3,807) (3,195) 1,169 861 557 917 Our Environment 18,197 17,352 20,093 21,427 (1,896) (4,075) 1,523 1,596 10,789 13,425 Our Economy 488 2,851 1,267 1,566 (779) 1,285 418 1,255 4,689 4,839 Other – – – – – – – – 19,802 – Total functions and activities 114,512 113,350 97,902 87,500 16,610 25,850 29,540 36,499 1,388,038 1,330,612 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 69 Singleton Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function singletonExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: SINGLETON_PDF_SHA256,
      bytes: SINGLETON_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? SINGLETON_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? SINGLETON_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? SINGLETON_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const SINGLETON_CONTEXT: SingletonGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Financial Statements 2025-26',
    url: SINGLETON_PDF_URL,
    fiscal_year: SINGLETON_GPFS_FISCAL_YEAR,
    listing_url: SINGLETON_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'singleton-gpfs/singleton-financial-statements-2025-26.pdf',
    sha256: SINGLETON_PDF_SHA256,
    bytes: SINGLETON_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: SINGLETON_GPFS_REPORTING_URL,
};

/** Golden fixture for the singleton-gpfs module: 17 rows. */
export const SINGLETON_GPFS_ROW_COUNT = 17;
export const SINGLETON_GPFS_GOLDEN_DIGEST =
  '7b6fc695a6ab5caf587a426ea4670db97b4f6dc742c2a69c628c3e06dffb9782';
export const ROW_COUNT = SINGLETON_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = SINGLETON_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseSingletonGpfsExtraction(singletonExtraction(), SINGLETON_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
