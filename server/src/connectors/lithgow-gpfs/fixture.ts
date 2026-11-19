import {
  LITHGOW_GPFS_FISCAL_YEAR,
  LITHGOW_GPFS_REPORTING_URL,
  parseLithgowGpfsExtraction,
  type LithgowGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (PDF pp. 4, 5 and 13 of 104). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2025 and Actual
// 2024 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2025 (the FY2024-25 reporting
// year). Lithgow City Council prints seven revenue lines and five expense lines
// (including a real net loss on disposal of assets of 6,979). The net result is
// negative; the printed before-capital result is also negative. Other
// comprehensive income has two components (revaluation -27,928; remediation
// provision fair value adjustment -411) summing to the printed other
// comprehensive income of -28,339.
export const LITHGOW_PDF_URL =
  'https://www.lithgow.nsw.gov.au/files/assets/public/v/1/governance/ipr/reports/financial-statements-2024-2025.pdf';
export const LITHGOW_PDF_SHA256 =
  '4067a84e20dd7c35e1afe3843805373fa4acc110838c0b4e7f0f62e05d8684de';
export const LITHGOW_PDF_BYTES = 5369732;

export const LITHGOW_INCOME_TEXT =
  `Lithgow City Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 40,629 Rates and annual charges B2-1 40,370 39,076 9,458 User charges and fees B2-2 8,819 8,501 702 Other revenues B2-3 1,423 822 10,940 Grants and contributions provided for operating purposes B2-4 7,039 13,159 9,924 Grants and contributions provided for capital purposes B2-4 16,901 18,298 3,379 Interest and investment income B2-5 3,779 2,917 563 Other income B2-6 580 4,194 75,595 Total income from continuing operations 78,911 86,967 Expenses from continuing operations 22,995 Employee benefits and on-costs B3-1 24,351 21,738 22,892 Materials and services B3-2 28,274 22,952 361 Borrowing costs B3-3 490 857 1,259 Other expenses B3-5 8,392 1,320 (232) Net loss from the disposal of assets B4-1 6,979 3,425 47,275 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 68,486 50,292 28,320 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 10,425 36,675 17,647 Depreciation, amortisation and impairment of non-financial assets B3-4 18,512 16,623 10,673 Operating result from continuing operations (8,087) 20,052 10,673 Net operating result for the year attributable to Council (8,087) 20,052 749 Net operating result for the year before grants and contributions provided for capital purposes (24,988) 1,754 The above Income Statement should be read in conjunction with the accompanying notes. Lithgow City Council Income Statement for the year ended 30 June 2025 Page 4 of 80`;

export const LITHGOW_COMPREHENSIVE_TEXT =
  `Lithgow City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement (8,087) 20,052 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 (27,928) 46,009 Fair value adjustment of remediation provision (411) 5,964 Total other comprehensive income for the year (28,339) 51,973 Total and comprehensive income for the year attributable to Council (36,426) 72,025 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Lithgow City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 80`;

export const LITHGOW_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Caring for our community 658 1,044 3,397 3,340 (2,739) (2,296) 464 1,338 3,450 4,484 Strengthening our economy 1,179 2,663 3,651 2,307 (2,472) 356 1,102 2,576 9,231 9,147 Developing our built environment 35,948 44,208 65,645 51,459 (29,697) (7,251) 17,711 21,869 651,207 691,954 Enhancing our natural environment 9,095 8,258 7,363 7,236 1,732 1,022 503 1,117 99,489 101,944 Governance and leadership 32,031 30,794 6,942 2,573 25,089 28,221 4,160 4,557 40,935 43,789 Total functions and activities 78,911 86,967 86,998 66,915 (8,087) 20,052 23,940 31,457 804,312 851,318 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 80 Lithgow City Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function lithgowExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: LITHGOW_PDF_SHA256,
      bytes: LITHGOW_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? LITHGOW_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? LITHGOW_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? LITHGOW_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const LITHGOW_CONTEXT: LithgowGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024-25',
    url: LITHGOW_PDF_URL,
    fiscal_year: LITHGOW_GPFS_FISCAL_YEAR,
    listing_url: LITHGOW_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'lithgow-gpfs/financial-statements-2024-2025.pdf',
    sha256: LITHGOW_PDF_SHA256,
    bytes: LITHGOW_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: LITHGOW_GPFS_REPORTING_URL,
};

/** Golden fixture for the lithgow-gpfs module: 17 rows. */
export const LITHGOW_GPFS_ROW_COUNT = 17;
export const LITHGOW_GPFS_GOLDEN_DIGEST =
  'dbb48bad08fb902a85c3225c0564f4e5012a096623a994bfcef885df8a334123';
export const ROW_COUNT = LITHGOW_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = LITHGOW_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseLithgowGpfsExtraction(lithgowExtraction(), LITHGOW_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
