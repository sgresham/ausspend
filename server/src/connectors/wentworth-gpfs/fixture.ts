import {
  WENTWORTH_GPFS_FISCAL_YEAR,
  WENTWORTH_GPFS_REPORTING_URL,
  parseWentworthGpfsExtraction,
  type WentworthGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 6, 7 and 18 of 119). The Income Statement
// prints the Original unaudited budget column before each line label, with
// Actual 2025 and Actual 2024 after it. A parser that took the first number in
// the line would read the budget; the expected values are all Actual 2025.
// Wentworth Shire Council prints seven non-nil revenue components (other
// revenues and other income are separate; the 2025 net gain on disposal is nil)
// and six expense components, including a real net loss on disposal of 1,223
// and a net share of interests in joint ventures and associates of 246. The net
// result is positive; the before-capital result is negative. Other
// comprehensive income has two components (revaluation -55,052 and impairment
// reversal 485) summing to the printed -54,567.
export const WENTWORTH_PDF_URL =
  'https://www.wentworth.nsw.gov.au/wp-content/uploads/2026/01/Wentworth-Shire-Council-Financial-Statements-2024-25.pdf';
export const WENTWORTH_PDF_SHA256 =
  'fb90de93371d6629a0b6f63daf72495b8f7e1f2f3b3d103063c3de1eaf3aa8ca';
export const WENTWORTH_PDF_BYTES = 1707983;

export const WENTWORTH_INCOME_TEXT =
  `Wentworth Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 10,938 Rates and annual charges B2-1 11,076 10,410 8,145 User charges and fees B2-2 11,498 10,109 1,329 Other revenues B2-3 1,863 879 11,969 Grants and contributions provided for operating purposes B2-4 8,586 10,816 12,293 Grants and contributions provided for capital purposes B2-4 21,813 17,143 2,220 Interest and investment income B2-5 2,631 2,318 53 Other income B2-6 53 75 100 Net gain from the disposal of assets B4-1 – 56 47,047 Total income from continuing operations 57,520 51,806 Expenses from continuing operations 11,277 Employee benefits and on-costs B3-1 11,433 10,066 10,209 Materials and services B3-2 13,296 12,665 1,401 Borrowing costs B3-3 1,340 578 964 Other expenses B3-5 712 681 – Net loss from the disposal of assets B4-1 1,223 – – Net share of interests in joint ventures and associates using the equity method D2 246 62 23,851 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 28,250 24,052 23,196 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 29,270 27,754 9,308 Depreciation, amortisation and impairment of non-financial assets B3-4 12,004 10,083 13,888 Operating result from continuing operations 17,266 17,671 13,888 Net operating result for the year attributable to Council 17,266 17,671 1,595 Net operating result for the year before grants and contributions provided for capital purposes (4,547) 528 The above Income Statement should be read in conjunction with the accompanying notes. Wentworth Shire Council Income Statement for the year ended 30 June 2025 Page 5 of 95`;

export const WENTWORTH_COMPREHENSIVE_TEXT =
  `Wentworth Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 17,266 17,671 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 (55,052) 29,072 Impairment (loss) reversal relating to infrastructure, property, plant and equipment C1-6 485 1,055 Total items which will not be reclassified subsequent to operating result (54,567) 30,127 Total other comprehensive income for the year (54,567) 30,127 Total comprehensive income for the year attributable to Council (37,301) 47,798 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Wentworth Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 95`;

export const WENTWORTH_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities 1. Wentworth Shire is a vibrant, growing and thriving region 1,089 659 1,672 2,798 (583) (2,139) 970 541 5,464 8,441 2. Wentworth Shire is a great place to live 2,441 3,286 5,512 3,735 (3,071) (449) 1,644 2,918 34,157 20,570 3. Wentworth Shire is a community that works to enhance and protect its physical and natural environment 37,195 30,258 24,369 20,336 12,826 9,922 18,505 14,841 532,308 583,562 4. Wentworth Shire is supported by strong and ethical civil leadership with all activities conducted in an open, transparent and inclusive manner 16,795 17,603 8,701 7,266 8,094 10,337 9,280 9,659 72,354 62,483 Total functions and activities 57,520 51,806 40,254 34,135 17,266 17,671 30,399 27,959 644,283 675,056 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 17 of 95 Wentworth Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function wentworthExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: WENTWORTH_PDF_SHA256,
      bytes: WENTWORTH_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? WENTWORTH_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? WENTWORTH_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? WENTWORTH_FUNCTIONS_TEXT, 18),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const WENTWORTH_CONTEXT: WentworthGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Wentworth Shire Council Financial Statements 2024-25',
    url: WENTWORTH_PDF_URL,
    fiscal_year: WENTWORTH_GPFS_FISCAL_YEAR,
    listing_url: WENTWORTH_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'wentworth-gpfs/Wentworth-Shire-Council-Financial-Statements-2024-25.pdf',
    sha256: WENTWORTH_PDF_SHA256,
    bytes: WENTWORTH_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: WENTWORTH_GPFS_REPORTING_URL,
};

/** Golden fixture for the wentworth-gpfs module: 18 rows. */
export const WENTWORTH_GPFS_ROW_COUNT = 18;
export const WENTWORTH_GPFS_GOLDEN_DIGEST =
  '2951acf4fb570fbb9feb45da78f66885bff0f399de757310189d256e542638f5';
export const ROW_COUNT = WENTWORTH_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = WENTWORTH_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseWentworthGpfsExtraction(
    wentworthExtraction(),
    WENTWORTH_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
