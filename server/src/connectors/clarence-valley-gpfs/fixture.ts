import {
  CLARENCE_VALLEY_GPFS_FISCAL_YEAR,
  CLARENCE_VALLEY_GPFS_REPORTING_URL,
  parseClarenceValleyGpfsExtraction,
  type ClarenceValleyGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 15 of 105). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Clarence Valley Council
// prints seven revenue lines and five expense lines (including a real net loss
// on the disposal of assets of 2,825). The net result and the printed
// before-capital result are both positive. Other comprehensive income has two
// components (revaluation 6,786; impairment reversal 3,866) summing to the
// printed other comprehensive income of 10,652.
export const CLARENCE_VALLEY_PDF_URL =
  'https://www.clarence.nsw.gov.au/files/assets/public/v/1/home-page/on-exhibition/clarence-valley-council-financial-statements-2025-26.pdf';
export const CLARENCE_VALLEY_PDF_SHA256 =
  '080fe8a0808ce675aca13c8750bf3a18c07328fc674e4f7e11fff4b59708e72b';
export const CLARENCE_VALLEY_PDF_BYTES = 3602292;

export const CLARENCE_VALLEY_INCOME_TEXT =
  `Clarence Valley Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 83,522 Rates and annual charges B2-1 85,316 79,991 45,942 User charges and fees B2-2 55,355 42,146 1,473 Other revenues B2-3 3,206 1,873 23,717 Grants and contributions provided for operating purposes B2-4 40,542 23,862 69,763 Grants and contributions provided for capital purposes B2-4 71,249 98,890 5,751 Interest and investment income B2-5 8,122 9,404 735 Other income 863 707 230,903 Total income from continuing operations 264,653 256,873 Expenses from continuing operations 50,924 Employee benefits and on-costs B3-1 51,113 46,705 43,522 Materials and services B3-2 62,239 54,884 5,220 Borrowing costs B3-3 5,672 6,362 8,648 Other expenses B3-5 7,530 6,986 5 Net loss from the disposal of assets B4-1 2,825 6,627 108,319 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 129,379 121,564 122,584 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 135,274 135,309 60,755 Depreciation, amortisation and impairment of non-financial assets B3-4 63,904 65,672 61,829 Operating result from continuing operations 71,370 69,637 61,829 Net operating result for the year attributable to Council 71,370 69,637 (7,934) Net operating result for the year before grants and contributions provided for capital purposes 121 (29,253) The above Income Statement should be read in conjunction with the accompanying notes. Clarence Valley Council Income Statement for the year ended 30 June 2026 Page 4`;

export const CLARENCE_VALLEY_COMPREHENSIVE_TEXT =
  `Clarence Valley Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 71,370 69,637 §Subnote§ Other comprehensive income: Amounts that will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 6,786 65,736 Impairment reversal relating to infrastructure, property, plant and equipment C1-7 3,866 (825) Other comprehensive income for the year 10,652 64,911 Total comprehensive income for the year attributable to Council 82,022 134,548 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Clarence Valley Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5`;

export const CLARENCE_VALLEY_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Leadership 4,270 20,584 33,373 37,190 (29,103) (16,606) 746 17,156 373,824 400,002 Infrastructure 148,014 138,421 102,380 97,963 45,634 40,458 82,559 86,509 2,229,742 2,152,429 Community 14,586 14,123 31,213 26,507 (16,627) (12,384) 7,700 9,118 208,226 202,864 Environment 22,969 20,119 18,599 17,326 4,370 2,793 549 451 1,475 2,165 Economy 8,868 8,630 7,718 8,250 1,150 380 93 113 64,738 60,805 General purpose income 65,946 54,996 – – 65,946 54,996 20,144 9,405 – – Total functions and activities 264,653 256,873 193,283 187,236 71,370 69,637 111,791 122,752 2,878,005 2,818,265 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 Clarence Valley Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function clarenceValleyExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: CLARENCE_VALLEY_PDF_SHA256,
      bytes: CLARENCE_VALLEY_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? CLARENCE_VALLEY_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? CLARENCE_VALLEY_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? CLARENCE_VALLEY_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const CLARENCE_VALLEY_CONTEXT: ClarenceValleyGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Financial Statements 2025-26',
    url: CLARENCE_VALLEY_PDF_URL,
    fiscal_year: CLARENCE_VALLEY_GPFS_FISCAL_YEAR,
    listing_url: CLARENCE_VALLEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'clarence-valley-gpfs/clarence-valley-council-financial-statements-2025-26.pdf',
    sha256: CLARENCE_VALLEY_PDF_SHA256,
    bytes: CLARENCE_VALLEY_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: CLARENCE_VALLEY_GPFS_REPORTING_URL,
};

/** Golden fixture for the clarence-valley-gpfs module: 17 rows. */
export const CLARENCE_VALLEY_GPFS_ROW_COUNT = 17;
export const CLARENCE_VALLEY_GPFS_GOLDEN_DIGEST =
  '2527a8cdba6899a1be2361a90590c2d4a14298862e1cb83c76a3a63cf70e0959';
export const ROW_COUNT = CLARENCE_VALLEY_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = CLARENCE_VALLEY_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseClarenceValleyGpfsExtraction(
    clarenceValleyExtraction(),
    CLARENCE_VALLEY_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
