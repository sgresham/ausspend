import {
  COWRA_GPFS_FISCAL_YEAR,
  COWRA_GPFS_REPORTING_URL,
  parseCowraGpfsExtraction,
  type CowraGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 107). The Income Statement
// prints the Original unaudited budget column before each line label, with
// Actual 2026 and Actual 2025 after it. A parser that took the first number in
// the line would read the budget; the expected values are all Actual 2026.
// Cowra Shire Council prints seven non-nil revenue components (the 2026 net
// gain on disposal is nil) and five expense components, including a real net
// loss on disposal of assets of 1,423. The net result is positive while the
// before-capital result is negative. Other comprehensive income has a single
// non-nil component (revaluation 26,818) equal to the printed other
// comprehensive income; the 2026 impairment reversal is nil.
export const COWRA_PDF_URL =
  'https://www.cowracouncil.com.au/files/assets/public/v/1/annual_financial_statements-2025-2026.pdf';
export const COWRA_PDF_SHA256 =
  'ceae83befba0e156c23a92ed6c14a11f01b7f4e3031374d9cce28ca607991a65';
export const COWRA_PDF_BYTES = 3421290;

export const COWRA_INCOME_TEXT =
  `§Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 17,754 Rates and annual charges B2-1 18,002 16,907 15,700 User charges and fees B2-2 19,275 16,766 2,253 Other revenues B2-3 1,224 2,233 8,474 Grants and contributions provided for operating purposes B2-4 13,333 9,207 5,184 Grants and contributions provided for capital purposes B2-4 3,322 4,574 1,675 Interest and investment income B2-5 1,960 2,046 213 Other income B2-6 229 218 242 Net gain from the disposal of assets B4-1 – 218 51,495 Total income from continuing operations 57,345 52,169 Expenses from continuing operations 19,311 Employee benefits and on-costs B3-1 19,228 18,447 16,092 Materials and services B3-2 20,127 16,865 820 Borrowing costs B3-3 1,402 854 1,643 Other expenses B3-5 1,613 1,497 – Net loss from the disposal of assets B4-1 1,423 – 37,866 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 43,793 37,663 13,629 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 13,552 14,506 9,474 Depreciation, amortisation and impairment of non-financial assets B3-4 10,921 10,424 4,155 Operating result from continuing operations 2,631 4,082 4,155 Net operating result for the year attributable to Council 2,631 4,082 (1,030) Net operating result for the year before grants and contributions provided for capital purposes (691) (492) The above Income Statement should be read in conjunction with the accompanying notes. Cowra Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 82`;

export const COWRA_COMPREHENSIVE_TEXT =
  `§Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 2,631 4,082 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 26,818 106,388 Impairment reversal relating to infrastructure, property, plant and equipment C1-7 – 248 Total items which will not be reclassified subsequent to operating result 26,818 106,636 Total other comprehensive income for the year 26,818 106,636 Total comprehensive income for the year attributable to Council 29,449 110,718 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Cowra Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 82`;

export const COWRA_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Civic Activities 53 51 1,102 1,370 (1,049) (1,319) – – – – Administration 190 196 7,045 6,622 (6,855) (6,426) 57 9 65,645 39,192 Public Order and Safety 381 1,748 1,285 1,185 (904) 563 289 1,606 10,828 10,721 Health – – – – – – – – 1,414 1,348 Environment 6,444 6,261 5,865 6,112 579 149 263 108 37,428 1,737 Community Services and Education 14 19 302 299 (288) (280) 14 18 695 701 Housing and community amenities 1,388 1,492 3,396 3,777 (2,008) (2,285) 377 165 3,401 3,330 Water Supplies 10,107 8,626 9,436 8,839 671 (213) 1,175 296 111,121 109,650 Sewerage services 4,696 4,495 5,048 4,242 (352) 253 1 9 48,027 60,021 Recreation and culture 2,245 1,225 6,815 4,939 (4,570) (3,714) 1,820 949 63,197 61,574 Mining, manufacture and construction – – 90 92 (90) (92) – – 432 427 Transport and communications 4,005 6,498 6,883 4,167 (2,878) 2,331 3,707 5,997 675,520 684,394 Economic affairs 8,603 7,281 7,447 6,443 1,156 838 – 270 5,440 5,626 General purpose income 19,219 14,277 – – 19,219 14,277 8,952 4,354 – – Other – – – – – – – – (17,386) – Total functions and activities 57,345 52,169 54,714 48,087 2,631 4,082 16,655 13,781 1,005,762 978,721 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 82 Cowra Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function cowraExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: COWRA_PDF_SHA256,
      bytes: COWRA_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? COWRA_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? COWRA_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? COWRA_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const COWRA_CONTEXT: CowraGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Cowra Shire Council Annual Financial Statements 2025-2026',
    url: COWRA_PDF_URL,
    fiscal_year: COWRA_GPFS_FISCAL_YEAR,
    listing_url: COWRA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'cowra-gpfs/annual_financial_statements-2025-2026.pdf',
    sha256: COWRA_PDF_SHA256,
    bytes: COWRA_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: COWRA_GPFS_REPORTING_URL,
};

/** Golden fixture for the cowra-gpfs module: 17 rows. */
export const COWRA_GPFS_ROW_COUNT = 17;
export const COWRA_GPFS_GOLDEN_DIGEST =
  '8892419c35bd5341685ed97483859beadde75196142e396ad62a88f063470dca';
export const ROW_COUNT = COWRA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = COWRA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseCowraGpfsExtraction(cowraExtraction(), COWRA_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
