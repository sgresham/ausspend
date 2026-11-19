import {
  KEMPSEY_GPFS_FISCAL_YEAR,
  KEMPSEY_GPFS_REPORTING_URL,
  parseKempseyGpfsExtraction,
  type KempseyGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (annual report Part C; PDF pp. 5, 6 and 14 of 108). The Income Statement
// prints the Original unaudited budget column before each line label, with
// Actual 2026 and Actual 2025 after it. A parser that took the first number in
// the line would read the budget; the expected values are all Actual 2026.
// Kempsey Shire Council prints six revenue lines (no separate Other income
// line) and five expense lines (including a real net loss on disposal of assets
// of 4,881). The net result and the printed before-capital result are both
// positive. Other comprehensive income has a single component (revaluation
// 55,279) equal to the printed other comprehensive income.
export const KEMPSEY_PDF_URL =
  'https://www.kempsey.nsw.gov.au/files/sharedassets/public/v/1/docs/departments/corporate-performance/planning-amp-reporting/2026-27/10-2-3-2025-26-annual-report-part-c-audited-financial-statements.pdf';
export const KEMPSEY_PDF_SHA256 =
  '41de47285941f3b7bb9c44f07710fa5de7c6ee18cc780a95b6932a55c202cca1';
export const KEMPSEY_PDF_BYTES = 3663303;

export const KEMPSEY_INCOME_TEXT =
  `Kempsey Shire Council §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 59,348 Rates and annual charges B2-1 59,174 55,616 22,983 User charges and fees B2-2 22,184 20,441 2,194 Other revenues B2-3 3,013 3,115 15,903 Grants and contributions provided for operating purposes B2-4 30,848 12,696 71,660 Grants and contributions provided for capital purposes B2-4 53,755 37,265 7,704 Interest and investment income B2-5 8,805 6,259 179,792 Total income from continuing operations 177,779 135,392 Expenses from continuing operations 35,713 Employee benefits and on-costs B3-1 34,710 33,427 28,773 Materials and services B3-2 36,590 35,398 2,930 Borrowing costs B3-3 2,924 2,388 5,506 Other expenses B3-5 3,427 3,096 – Net loss from the disposal of assets B4-1 4,881 4,790 72,922 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 82,532 79,099 106,870 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 95,247 56,293 26,385 Depreciation, amortisation and impairment of non-financial assets B3-4 28,560 27,112 80,485 Operating result from continuing operations 66,687 29,181 80,485 Net operating result for the year attributable to Council 66,687 29,181 8,824 Net operating result for the year before grants and contributions provided for capital purposes 12,932 (8,084) The above Income Statement should be read in conjunction with the accompanying notes. Kempsey Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 83`;

export const KEMPSEY_COMPREHENSIVE_TEXT =
  `Kempsey Shire Council §Note/Subtotal§ Actual Actual 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 66,687 29,181 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 55,279 51,535 Total items which will not be reclassified subsequently to the operating result 55,279 51,535 Total other comprehensive income for the year 55,279 51,535 Total comprehensive income for the year attributable to Council 121,966 80,716 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Kempsey Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 83`;

export const KEMPSEY_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Leadership 107,074 64,697 29,468 27,324 77,606 37,373 238 107 20,568 19,873 Environment 55,533 58,572 48,003 48,841 7,530 9,731 44,707 26,773 563,182 529,455 Economy 13,130 9,784 26,276 21,993 (13,146) (12,209) 38,818 21,510 1,058,350 964,341 Community 2,042 2,339 7,345 8,053 (5,303) (5,714) 840 1,570 302,987 272,417 Total functions and activities 177,779 135,392 111,092 106,211 66,687 29,181 84,603 49,961 1,945,087 1,786,086 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 83 Kempsey Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function kempseyExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: KEMPSEY_PDF_SHA256,
      bytes: KEMPSEY_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? KEMPSEY_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? KEMPSEY_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? KEMPSEY_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const KEMPSEY_CONTEXT: KempseyGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Part C Audited Financial Statements 2025-26',
    url: KEMPSEY_PDF_URL,
    fiscal_year: KEMPSEY_GPFS_FISCAL_YEAR,
    listing_url: KEMPSEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'kempsey-gpfs/10-2-3-2025-26-annual-report-part-c-audited-financial-statements.pdf',
    sha256: KEMPSEY_PDF_SHA256,
    bytes: KEMPSEY_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: KEMPSEY_GPFS_REPORTING_URL,
};

/** Golden fixture for the kempsey-gpfs module: 16 rows. */
export const KEMPSEY_GPFS_ROW_COUNT = 16;
export const KEMPSEY_GPFS_GOLDEN_DIGEST =
  'd4fbd7bb608dc80775faed0260491e59e55eb2b919879c14106352c7571bebaa';
export const ROW_COUNT = KEMPSEY_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = KEMPSEY_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseKempseyGpfsExtraction(kempseyExtraction(), KEMPSEY_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
