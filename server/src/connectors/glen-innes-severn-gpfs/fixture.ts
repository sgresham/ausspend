import {
  GLEN_INNES_SEVERN_GPFS_FISCAL_YEAR,
  GLEN_INNES_SEVERN_GPFS_REPORTING_URL,
  parseGlenInnesSevernGpfsExtraction,
  type GlenInnesSevernGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 6, 7 and 16 of 102). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2025
// and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Glen Innes
// Severn Council prints seven revenue components (there is no net gain on
// disposal line) and five expense components, including a real net loss on
// disposal of assets of 589. The net result is positive while the before-capital
// result is negative. Other comprehensive income has a single component
// (revaluation 27,574) equal to the printed other comprehensive income.
export const GLEN_INNES_SEVERN_PDF_URL =
  'https://www.gisc.nsw.gov.au/files/assets/public/v/1/council/documents/public-documents-and-polices/audited-financial-statements-2024-25.pdf';
export const GLEN_INNES_SEVERN_PDF_SHA256 =
  '8ace0c0181c1f68d32f985b4fc976f7a3588b0149d69eb1dca50c21fd8dd8e05';
export const GLEN_INNES_SEVERN_PDF_BYTES = 3903779;

export const GLEN_INNES_SEVERN_INCOME_TEXT =
  `Glen Innes Severn Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 13,933 Rates and annual charges B2-1 13,868 12,973 8,987 User charges and fees B2-2 3,766 3,954 568 Other revenues B2-3 899 1,410 11,840 Grants and contributions provided for operating purposes B2-4 9,245 10,194 12,000 Grants and contributions provided for capital purposes B2-4 14,895 20,683 1,213 Interest and investment income B2-5 1,227 1,244 352 Other income B2-6 309 104 48,893 Total income from continuing operations 44,209 50,562 Expenses from continuing operations 14,266 Employee benefits and on-costs B3-1 13,149 12,858 15,605 Materials and services B3-2 9,584 9,622 457 Borrowing costs B3-3 521 469 838 Other expenses B3-5 1,248 799 – Net loss from the disposal of assets B4-1 589 808 31,166 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 25,091 24,556 17,727 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 19,118 26,006 9,622 Depreciation, amortisation and impairment of non-financial assets B3-4 9,104 9,684 8,105 Operating result from continuing operations 10,014 16,322 8,105 Net operating result for the year attributable to Council 10,014 16,322 (3,895) Net operating result for the year before grants and contributions provided for capital purposes (4,881) (4,361) The above Income Statement should be read in conjunction with the accompanying notes. Glen Innes Severn Council Income Statement for the year ended 30 June 2025 Page 5 of 79`;

export const GLEN_INNES_SEVERN_COMPREHENSIVE_TEXT =
  `Glen Innes Severn Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 10,014 16,322 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 27,574 17,753 Total items which will not be reclassified subsequent to operating result 27,574 17,753 Total other comprehensive income for the year 27,574 17,753 Total comprehensive income for the year attributable to Council 37,588 34,075 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Glen Innes Severn Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 79`;

export const GLEN_INNES_SEVERN_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 1 2025 2024 1 2025 2024 1 2025 2024 1 2025 2 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Administration 355 504 6,156 6,273 (5,801) (5,769) 290 160 10,113 24,640 Community services and education 3,291 3,254 3,418 3,771 (127) (517) 3,195 2,985 2,610 468 Economic affairs 723 1,026 2,178 2,335 (1,455) (1,309) 123 118 7,722 5,161 Environment 20 17 524 133 (504) (116) 20 17 24,774 – General Purpose 11,118 10,780 31 41 11,087 10,739 2,720 3,620 – – Governance – 4 1,481 431 (1,481) (427) – – – – Health 33 18 128 126 (95) (108) – – – – Housing and community amenities 3,361 3,311 3,223 3,367 138 (56) 27 75 676 37,939 Mining, manufacturing and construction 3,085 5,086 1,431 4,187 1,654 899 – – 2,877 10,301 Public order and safety 1,011 984 885 905 126 79 737 966 1,542 – Recreation and culture 631 3,802 3,675 2,302 (3,044) 1,500 710 3,748 89,602 314,151 Sewerage services 2,158 2,088 1,386 1,535 772 553 39 22 23,947 26,948 Transport and communication 15,037 16,372 7,188 6,263 7,849 10,109 16,055 21,134 298,246 7,020 Water supplies 3,386 3,316 2,491 2,571 895 745 224 682 31,230 32,550 Other – – – – – – – (2,650) 402 (2,709) Total functions and activities 44,209 50,562 34,195 34,240 10,014 16,322 24,140 30,877 493,741 456,469 (1) Last year numbers were adjusted to align with the Income Statement. (2) This year asset values were classified by functions in a more accurate way compared to the previous year following update of mapping allocations in the council's asset system. B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 15 of 79 Glen Innes Severn Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function glenInnesSevernExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: GLEN_INNES_SEVERN_PDF_SHA256,
      bytes: GLEN_INNES_SEVERN_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? GLEN_INNES_SEVERN_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? GLEN_INNES_SEVERN_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? GLEN_INNES_SEVERN_FUNCTIONS_TEXT, 16),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const GLEN_INNES_SEVERN_CONTEXT: GlenInnesSevernGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Glen Innes Severn Council Audited Financial Statements 2024-25',
    url: GLEN_INNES_SEVERN_PDF_URL,
    fiscal_year: GLEN_INNES_SEVERN_GPFS_FISCAL_YEAR,
    listing_url: GLEN_INNES_SEVERN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'glen-innes-severn-gpfs/audited-financial-statements-2024-25.pdf',
    sha256: GLEN_INNES_SEVERN_PDF_SHA256,
    bytes: GLEN_INNES_SEVERN_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: GLEN_INNES_SEVERN_GPFS_REPORTING_URL,
};

/** Golden fixture for the glen-innes-severn-gpfs module: 17 rows. */
export const GLEN_INNES_SEVERN_GPFS_ROW_COUNT = 17;
export const GLEN_INNES_SEVERN_GPFS_GOLDEN_DIGEST =
  'b525b90470e7e808dc010268b9ec64f53ed94a7018124fef546e1513c99468b6';
export const ROW_COUNT = GLEN_INNES_SEVERN_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = GLEN_INNES_SEVERN_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseGlenInnesSevernGpfsExtraction(
    glenInnesSevernExtraction(),
    GLEN_INNES_SEVERN_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
