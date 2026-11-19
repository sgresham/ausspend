import {
  INVERELL_GPFS_FISCAL_YEAR,
  INVERELL_GPFS_REPORTING_URL,
  parseInverellGpfsExtraction,
  type InverellGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 6, 7 and 15 of 111). The Income Statement
// prints the Original unaudited budget column before each line label, with
// Actual 2026 and Actual 2025 after it. A parser that took the first number in
// the line would read the budget; the expected values are all Actual 2026.
// Inverell Shire Council prints seven revenue components (other revenues and
// other income are separate lines) and five expense components, including a
// real net loss on disposal of assets of 590. The printed 2026 net gain on
// disposal is nil and is not emitted. The net result and the before-capital
// result are both positive. Other comprehensive income has a single component
// (revaluation 122,531) equal to the printed other comprehensive income.
export const INVERELL_PDF_URL =
  'https://inverell.nsw.gov.au/wp-content/uploads/2026/11/Annual-Financial-Statements-2025-2026.pdf';
export const INVERELL_PDF_SHA256 =
  'b8aad9c13719fa5765bedc65750a7166fb4cd920b175b8d19fa22c11ea13405e';
export const INVERELL_PDF_BYTES = 6365791;

export const INVERELL_INCOME_TEXT =
  `Inverell Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 27,565 Rates and annual charges B2-1 27,473 26,194 6,457 User charges and fees B2-2 7,340 9,003 618 Other revenues B2-3 1,266 1,081 16,060 Grants and contributions provided for operating purposes B2-4 20,824 13,587 369 Grants and contributions provided for capital purposes B2-4 1,639 7,661 1,883 Interest and investment income B2-5 4,103 4,664 173 Other income B2-6 333 289 141 Net gain from the disposal of assets B4-1 – – 53,266 Total income from continuing operations 62,978 62,479 Expenses from continuing operations 18,837 Employee benefits and on-costs B3-1 16,799 16,849 15,571 Materials and services B3-2 16,095 19,368 470 Borrowing costs B3-3 707 722 1,101 Other expenses B3-5 1,058 957 – Net loss from the disposal of assets B4-1 590 606 35,979 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 35,249 38,502 17,287 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 27,729 23,977 15,797 Depreciation, amortisation and impairment of non-financial assets B3-4 16,136 15,631 1,490 Net operating result for the year attributable to Council 11,593 8,346 1,490 Net result for the year 11,593 8,346 1,121 Net operating result for the year before grants and contributions provided for capital purposes 9,954 685 The above Income Statement should be read in conjunction with the accompanying notes. Inverell Shire Council Income Statement for the year ended 30 June 2026 Page 5 of 86`;

export const INVERELL_COMPREHENSIVE_TEXT =
  `Inverell Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 11,593 8,346 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 122,531 28,889 Impairment (loss) relating to IPP&E – – Total items which will not be reclassified subsequent to operating result 122,531 28,889 Total other comprehensive income for the year 122,531 28,889 Total comprehensive income for the year attributable to Council 134,124 37,235 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Inverell Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6 of 86`;

export const INVERELL_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Leadership 32,913 26,614 5,001 6,111 27,912 20,503 12,056 5,782 110,697 102,435 Community 1,530 3,131 1,303 5,587 227 (2,456) 796 2,487 54,358 54,717 Environment 5,775 5,352 6,202 6,292 (427) (940) 164 185 43,645 45,269 Economy 734 742 5,467 1,346 (4,733) (604) – – 19,564 18,934 Services / Infrastructure 22,026 26,640 33,412 34,797 (11,386) (8,157) 9,447 12,794 1,008,907 882,688 Total functions and activities 62,978 62,479 51,385 54,133 11,593 8,346 22,463 21,248 1,237,171 1,104,043 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 86 Inverell Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function inverellExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: INVERELL_PDF_SHA256,
      bytes: INVERELL_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? INVERELL_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? INVERELL_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? INVERELL_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const INVERELL_CONTEXT: InverellGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements 2025-2026',
    url: INVERELL_PDF_URL,
    fiscal_year: INVERELL_GPFS_FISCAL_YEAR,
    listing_url: INVERELL_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'inverell-gpfs/Annual-Financial-Statements-2025-2026.pdf',
    sha256: INVERELL_PDF_SHA256,
    bytes: INVERELL_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: INVERELL_GPFS_REPORTING_URL,
};

/** Golden fixture for the inverell-gpfs module: 17 rows. */
export const INVERELL_GPFS_ROW_COUNT = 17;
export const INVERELL_GPFS_GOLDEN_DIGEST =
  'e41a26da04991982d0574dece4b009293f7fcd3d91fbaa32f8d64728e685c48d';
export const ROW_COUNT = INVERELL_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = INVERELL_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseInverellGpfsExtraction(
    inverellExtraction(),
    INVERELL_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
