import {
  ARMIDALE_GPFS_FISCAL_YEAR,
  ARMIDALE_GPFS_REPORTING_URL,
  parseArmidaleGpfsExtraction,
  type ArmidaleGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 93). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Armidale Regional Council
// prints seven revenue lines and five expense lines (including a real net loss
// on the disposal of assets of 5,424). The net result is positive and so is the
// printed before-capital result.
export const ARMIDALE_PDF_URL =
  'https://www.armidale.nsw.gov.au/files/assets/public/v/1/council/documents/final_audited-financial-statements-2025-26.pdf';
export const ARMIDALE_PDF_SHA256 =
  'c43ab813cfaa8f64aee298887d0b1c0b2b3217e3ccf11809353d675068b112a6';
export const ARMIDALE_PDF_BYTES = 2568853;

export const ARMIDALE_INCOME_TEXT =
  `§Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 52,227 Rates and annual charges B2-1 52,217 47,542 25,112 User charges and fees B2-2 32,663 26,555 4,206 Other revenues B2-3 4,856 4,228 15,324 Grants and contributions provided for operating purposes B2-4 18,033 11,201 112,474 Grants and contributions provided for capital purposes B2-4 24,833 35,994 6,468 Interest and investment income B2-5 7,198 7,719 – Other income B2-6 1,109 2,059 215,811 Total income from continuing operations 140,909 135,298 Expenses from continuing operations 34,729 Employee benefits and on-costs B3-1 35,890 33,328 33,597 Materials and services B3-2 38,670 36,424 721 Borrowing costs B3-3 990 1,322 2,357 Other expenses B3-5 2,043 2,131 – Net loss from the disposal of assets B4-1 5,424 3,727 71,404 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 83,017 76,932 144,407 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 57,892 58,366 27,169 Depreciation, amortisation and impairment of non-financial assets B3-4 27,927 27,870 117,238 Operating result from continuing operations 29,965 30,496 117,238 Net operating result for the year attributable to Council 29,965 30,496 4,766 Net operating result for the year before grants and contributions provided for capital purposes 5,132 (5,498) The above Income Statement should be read in conjunction with the accompanying notes. Armidale Regional Council Income Statement for the year ended 30 June 2026 Page 5 of 70`;

export const ARMIDALE_COMPREHENSIVE_TEXT =
  `§Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 29,965 30,496 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-7 44,164 28,273 Total items which will not be reclassified subsequent to operating result 44,164 28,273 Total other comprehensive income for the year 44,164 28,273 Total comprehensive income for the year attributable to Council 74,129 58,769 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Armidale Regional Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6 of 70`;

export const ARMIDALE_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Growth, Prosperity, and Economic Development 7,401 7,564 13,704 1,010 (6,303) 6,554 2,632 1,960 – – People and Community 3,022 3,142 11,252 20,955 (8,230) (17,813) 4,490 1,696 107,533 172,092 Leadership for the Region 43,935 38,216 9,779 5,073 34,156 33,143 8,356 14,557 177,207 179,130 Environment and Infrastructure 86,551 86,376 76,209 77,764 10,342 8,612 27,388 28,982 1,213,856 1,114,430 Total functions and activities 140,909 135,298 110,944 104,802 29,965 30,496 42,866 47,195 1,498,596 1,465,652 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 70 Armidale Regional Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function armidaleExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: ARMIDALE_PDF_SHA256,
      bytes: ARMIDALE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? ARMIDALE_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? ARMIDALE_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? ARMIDALE_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const ARMIDALE_CONTEXT: ArmidaleGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Audited Financial Statements 2025-26',
    url: ARMIDALE_PDF_URL,
    fiscal_year: ARMIDALE_GPFS_FISCAL_YEAR,
    listing_url: ARMIDALE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'armidale-gpfs/final_audited-financial-statements-2025-26.pdf',
    sha256: ARMIDALE_PDF_SHA256,
    bytes: ARMIDALE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: ARMIDALE_GPFS_REPORTING_URL,
};

/** Golden fixture for the armidale-gpfs module: 17 rows. */
export const ARMIDALE_GPFS_ROW_COUNT = 17;
export const ARMIDALE_GPFS_GOLDEN_DIGEST =
  '560971a68ed59de898244a4abcee99e869f78bd05969964d3ac2fc9b023e84ce';
export const ROW_COUNT = ARMIDALE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = ARMIDALE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseArmidaleGpfsExtraction(armidaleExtraction(), ARMIDALE_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
