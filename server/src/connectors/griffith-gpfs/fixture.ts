import {
  GRIFFITH_GPFS_FISCAL_YEAR,
  GRIFFITH_GPFS_REPORTING_URL,
  parseGriffithGpfsExtraction,
  type GriffithGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 6, 7 and 15 of 108). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025 (the FY2024-25 reporting
// year). Griffith City Council prints eight revenue lines (including a net gain
// on disposal of 131) and four expense lines (no net disposal expense). The net
// result and the printed before-capital result are both positive. Other
// comprehensive income has two components (revaluation -22; intangible
// revaluation 928) summing to the printed other comprehensive income of 906.
export const GRIFFITH_PDF_URL =
  'https://www.griffith.nsw.gov.au/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2024-25.pdf';
export const GRIFFITH_PDF_SHA256 =
  '5ff3ce8ff4f52ab44ed34582e18146bdc52ba7ea188ef1ae36e7132fd77a88a4';
export const GRIFFITH_PDF_BYTES = 4054577;

export const GRIFFITH_INCOME_TEXT =
  `Griffith City Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 38,909 Rates and annual charges B2-1 40,658 37,898 20,366 User charges and fees B2-2 21,904 19,730 1,339 Other revenues B2-3 1,704 1,451 9,366 Grants and contributions provided for operating purposes B2-4 7,179 15,515 9,695 Grants and contributions provided for capital purposes B2-4 13,839 19,129 2,438 Interest and investment income B2-5 4,454 3,338 483 Other income B2-6 565 533 – Net gain from the disposal of assets B4-1 131 206 82,596 Total income from continuing operations 90,434 97,800 Expenses from continuing operations 31,461 Employee benefits and on-costs B3-1 29,395 27,513 21,518 Materials and services B3-2 21,948 24,078 972 Borrowing costs B3-3 972 1,047 1,423 Other expenses B3-5 1,301 7,774 55,374 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 53,616 60,412 27,222 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 36,818 37,388 17,879 Depreciation, amortisation and impairment of non-financial assets B3-4 19,188 17,663 9,343 Operating result from continuing operations 17,630 19,725 9,343 Net operating result for the year attributable to Council 17,630 19,725 (352) Net operating result for the year before grants and contributions provided for capital purposes 3,791 596 The above Income Statement should be read in conjunction with the accompanying notes. Griffith City Council Income Statement for the year ended 30 June 2025 Page 4 of 84`;

export const GRIFFITH_COMPREHENSIVE_TEXT =
  `Griffith City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 17,630 19,725 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 (22) 57,314 Gain (loss) on revaluation of intangible assets C1-7 928 (432) Amounts which will be reclassified subsequent to operating result when specific conditions are met Other movements – 53 Total items which will be reclassified subsequent to operating result when specific conditions are met – 53 Total other comprehensive income for the year 906 56,935 Total comprehensive income for the year attributable to Council 18,536 76,660 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Griffith City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 84`;

export const GRIFFITH_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Governance 584 3,582 2,586 8,790 (2,002) (5,208) – 3,430 36,793 40,066 Administration 419 570 9,022 9,186 (8,603) (8,616) 92 123 19,362 17,307 Public order and safety 900 869 1,903 1,832 (1,003) (963) 234 293 5,209 4,602 Health 387 209 494 409 (107) (200) 244 98 735 257 Environment 11,485 10,742 6,910 7,252 4,575 3,490 2,624 2,428 85,643 87,741 Community services and education 112 137 690 721 (578) (584) 28 51 11,129 10,704 Housing and community amenities 4,048 4,342 6,126 6,008 (2,078) (1,666) 2,412 2,678 21,305 19,683 Water supplies 15,182 13,610 8,383 8,275 6,799 5,335 1,346 1,693 227,799 218,251 Sewerage services 13,743 12,999 7,299 7,419 6,444 5,580 1,025 1,020 177,796 171,278 Recreation and culture 4,940 7,091 13,541 13,120 (8,601) (6,029) 1,819 3,771 110,960 101,053 Transport and communication 8,622 15,103 13,370 13,071 (4,748) 2,032 5,461 12,176 390,804 412,754 Economic affairs 1,653 936 2,480 1,992 (827) (1,056) 551 123 6,178 4,819 General purpose revenue 28,359 27,610 – – 28,359 27,610 5,182 6,760 41,203 29,698 Total functions and activities 90,434 97,800 72,804 78,075 17,630 19,725 21,018 34,644 1,134,916 1,118,213 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 84 Griffith City Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function griffithExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: GRIFFITH_PDF_SHA256,
      bytes: GRIFFITH_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? GRIFFITH_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? GRIFFITH_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? GRIFFITH_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const GRIFFITH_CONTEXT: GriffithGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024-25',
    url: GRIFFITH_PDF_URL,
    fiscal_year: GRIFFITH_GPFS_FISCAL_YEAR,
    listing_url: GRIFFITH_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'griffith-gpfs/griffith-city-council-financial-statements-2024-25.pdf',
    sha256: GRIFFITH_PDF_SHA256,
    bytes: GRIFFITH_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: GRIFFITH_GPFS_REPORTING_URL,
};

/** Golden fixture for the griffith-gpfs module: 17 rows. */
export const GRIFFITH_GPFS_ROW_COUNT = 17;
export const GRIFFITH_GPFS_GOLDEN_DIGEST =
  'efd4beb7c11da5b430183c92575a0e86e092bb7876f2aa1ca2c6ef90e55229c6';
export const ROW_COUNT = GRIFFITH_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = GRIFFITH_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseGriffithGpfsExtraction(griffithExtraction(), GRIFFITH_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
