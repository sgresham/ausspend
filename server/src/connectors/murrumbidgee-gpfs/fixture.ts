import {
  MURRUMBIDGEE_GPFS_FISCAL_YEAR,
  MURRUMBIDGEE_GPFS_REPORTING_URL,
  parseMurrumbidgeeGpfsExtraction,
  type MurrumbidgeeGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25
// Appendix A PDF (PDF pp. 4, 5 and 13 of 100). The Income Statement prints the
// Original unaudited budget column before each line label, with Actual 2025 and
// Actual 2024 after it. A parser that took the first number in the line would
// read the budget; the expected values are all Actual 2025. Murrumbidgee prints
// eight non-zero revenue lines (including a net gain on disposal and other
// income) and four non-zero expense lines; its printed net loss on disposal is
// nil for 2025 and is not emitted. The net result is positive and the printed
// before-capital result is negative.
export const MURRUMBIDGEE_PDF_URL =
  'https://www.murrumbidgee.nsw.gov.au/files/assets/public/v/1/publications/ip-and-r/a-report-2024-25/appendix-a-financial-information.pdf';
export const MURRUMBIDGEE_PDF_RESOLVED_URL =
  'https://www.murrumbidgee.nsw.gov.au/files/assets/public/v/2/publications/ip-and-r/a-report-2024-25/appendix-a-financial-information.pdf';
export const MURRUMBIDGEE_PDF_SHA256 =
  'a279e11fdd620d4ea7f08794ea93e8671adafc502ed2e18069fe6b09ff9b0fc1';
export const MURRUMBIDGEE_PDF_BYTES = 1_063_092;

export const MURRUMBIDGEE_INCOME_TEXT =
  "Murrumbidgee Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 6,925 Rates and annual charges B2-1 6,893 6,591 3,450 User charges and fees B2-2 3,184 3,338 741 Other revenues B2-3 455 285 12,336 Grants and contributions provided for operating purposes B2-4 9,519 10,444 11,792 Grants and contributions provided for capital purposes B2-4 8,183 10,802 1,136 Interest and investment income B2-5 1,408 1,595 – Net gain from the disposal of assets B4-1 360 – 212 Other income B2-6 188 203 36,592 Total income from continuing operations 30,190 33,258 Expenses from continuing operations 7,836 Employee benefits and on-costs B3-1 10,401 8,445 12,294 Materials and services B3-2 7,404 8,237 104 Borrowing costs 8 9 – Net loss from the disposal of assets B4-1 – 112 846 Other expenses B3-4 713 665 21,080 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 18,526 17,468 15,512 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 11,664 15,790 8,175 Depreciation, amortisation and impairment of non-financial assets B3-3 8,550 8,107 7,337 Operating result from continuing operations 3,114 7,683 7,337 Net operating result for the year attributable to Council 3,114 7,683 (6,643) Net operating result for the year before grants and contributions provided for capital purposes (5,069) (3,119) The above Income Statement should be read in conjunction with the accompanying notes. Murrumbidgee Council Income Statement for the year ended 30 June 2025 Page 4 of 71";

export const MURRUMBIDGEE_COMPREHENSIVE_TEXT =
  "Murrumbidgee Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 3,114 7,683 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of IPP&E C1-7 15,836 23,393 Gain on revaluation of intangible assets C1-8 – (172) Total items which will not be reclassified subsequent to operating result 15,836 23,221 Total other comprehensive income for the period 15,836 23,221 Total comprehensive income for the year attributable to Council 18,950 30,904 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Murrumbidgee Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 71";

export const MURRUMBIDGEE_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Governance and Administration 8,636 12,528 6,922 6,944 1,714 5,584 3,629 6,351 49,422 43,719 Public Order and Safety 436 168 881 804 (445) (636) 167 160 3,843 3,779 Health 28 9 50 19 (22) (10) – – 1,301 1,025 Environmental Protection 5,646 2,242 651 1,566 4,995 676 5,635 1,738 21,364 23,508 Community Services and Education 436 605 1,169 742 (733) (137) 319 358 4,120 3,892 Housing and Community Amenities 1,815 604 1,645 452 170 152 150 332 18,101 7,065 Recreation and Cultural 1,417 2,768 2,532 2,726 (1,115) 42 1,373 2,740 38,154 43,606 Mining, Manufacturing and Construction 47 39 39 16 8 23 – – 413 621 Transport and Communications 5,824 7,847 8,703 7,798 (2,879) 49 5,263 7,847 237,129 231,920 Economic Affairs 2,673 3,822 1,896 2,262 777 1,560 985 1,645 12,458 7,394 Water Supply 2,156 1,666 1,512 1,307 644 359 181 75 23,847 22,830 Sewerage Services 1,076 960 1,076 939 – 21 – – 25,886 27,749 Total functions and activities 30,190 33,258 27,076 25,575 3,114 7,683 17,702 21,246 436,038 417,108 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 71 Murrumbidgee Council | Notes to the Financial Statements 30 June 2025";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function murrumbidgeeExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: MURRUMBIDGEE_PDF_SHA256,
      bytes: MURRUMBIDGEE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? MURRUMBIDGEE_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? MURRUMBIDGEE_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? MURRUMBIDGEE_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const MURRUMBIDGEE_CONTEXT: MurrumbidgeeGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Appendix A Financial Information 2024-25',
    url: MURRUMBIDGEE_PDF_URL,
    fiscal_year: MURRUMBIDGEE_GPFS_FISCAL_YEAR,
    listing_url: MURRUMBIDGEE_GPFS_REPORTING_URL,
    resolved_url: MURRUMBIDGEE_PDF_RESOLVED_URL,
  },
  archive: {
    local_path: 'murrumbidgee-gpfs/appendix-a-financial-information.pdf',
    sha256: MURRUMBIDGEE_PDF_SHA256,
    bytes: MURRUMBIDGEE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: MURRUMBIDGEE_GPFS_REPORTING_URL,
};

/** Golden fixture for the murrumbidgee-gpfs module: 17 rows. */
export const MURRUMBIDGEE_GPFS_ROW_COUNT = 17;
export const MURRUMBIDGEE_GPFS_GOLDEN_DIGEST =
  'a82b53f1dd256c17adb9ebb958151a19c03bdba1bda63f96d8a21536fc21020b';
export const ROW_COUNT = MURRUMBIDGEE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = MURRUMBIDGEE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseMurrumbidgeeGpfsExtraction(murrumbidgeeExtraction(), MURRUMBIDGEE_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
