import {
  LIVERPOOL_PLAINS_GPFS_FISCAL_YEAR,
  LIVERPOOL_PLAINS_GPFS_REPORTING_URL,
  parseLiverpoolPlainsGpfsExtraction,
  type LiverpoolPlainsGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 96). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Liverpool Plains Shire
// Council prints seven revenue lines and five expense lines (including a real
// net loss on disposal of assets of 5,337). The net result and the printed
// before-capital result are both negative. Other comprehensive income has a
// single component (revaluation 11,750) equal to the printed other
// comprehensive income.
export const LIVERPOOL_PLAINS_PDF_URL =
  'https://www.liverpoolplains.nsw.gov.au/files/assets/public/v/2/governance/corporate-and-statutory-reporting/financial-statements/annual-financial-statements-year-ended-30-june-2026.pdf';
export const LIVERPOOL_PLAINS_PDF_SHA256 =
  '118f0ac06fd6ce9d575c90e543c8bc6791eb687c7b1b535658b5c05ed8245bf5';
export const LIVERPOOL_PLAINS_PDF_BYTES = 3419279;

export const LIVERPOOL_PLAINS_INCOME_TEXT =
  `Liverpool Plains Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 16,281 Rates and annual charges B2-1 16,004 15,578 7,053 User charges and fees B2-2 7,286 6,180 6,546 Grants and contributions provided for operating purposes B2-4 8,183 4,622 20,628 Grants and contributions provided for capital purposes B2-4 7,312 10,524 574 Other revenues B2-3 442 807 1,170 Interest and investment income B2-5 1,779 2,081 – Other income B2-6 236 15 52,252 Total income from continuing operations 41,242 39,807 Expenses from continuing operations 11,058 Employee benefits and on-costs B3-1 12,025 11,260 13,387 Materials and services B3-2 14,447 12,885 629 Borrowing costs B3-3 1,013 895 625 Other expenses B3-5 672 630 – Net loss from the disposal of assets B4-1 5,337 1,633 25,699 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 33,494 27,303 26,553 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 7,748 12,504 14,424 Depreciation, amortisation and impairment of non-financial assets B3-4 17,778 15,625 12,129 Operating result from continuing operations (10,030) (3,121) 12,129 Net operating result for the year attributable to Council (10,030) (3,121) (8,499) Net operating result for the year before grants and contributions provided for capital purposes (17,342) (13,645) The above Income Statement should be read in conjunction with the accompanying notes. Liverpool Plains Shire Council Income Statement for the year ended 30 June 2026 Page 3 of 73`;

export const LIVERPOOL_PLAINS_COMPREHENSIVE_TEXT =
  `Liverpool Plains Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement (10,030) (3,121) §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-8 11,750 11,805 Total items which will not be reclassified subsequent to operating result 11,750 11,805 Total other comprehensive income for the year 11,750 11,805 Total comprehensive income for the year attributable to Council 1,720 8,684 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Liverpool Plains Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 4 of 73`;

export const LIVERPOOL_PLAINS_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Community 4,372 5,996 8,391 5,210 (4,019) 786 2,809 4,887 33,682 59,198 Governance 16,268 14,842 6,929 6,522 9,339 8,320 5,089 2,687 3,612 11,185 Environment 20,135 18,276 33,084 29,708 (12,949) (11,432) 7,597 7,572 617,478 579,686 Economic 467 693 2,868 1,488 (2,401) (795) – – 1,410 1,190 Other – – – – – – – – 433 498 Total functions and activities 41,242 39,807 51,272 42,928 (10,030) (3,121) 15,495 15,146 656,615 651,757 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 12 of 73 Liverpool Plains Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function liverpoolPlainsExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: LIVERPOOL_PLAINS_PDF_SHA256,
      bytes: LIVERPOOL_PLAINS_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? LIVERPOOL_PLAINS_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? LIVERPOOL_PLAINS_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? LIVERPOOL_PLAINS_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const LIVERPOOL_PLAINS_CONTEXT: LiverpoolPlainsGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements 2025-26',
    url: LIVERPOOL_PLAINS_PDF_URL,
    fiscal_year: LIVERPOOL_PLAINS_GPFS_FISCAL_YEAR,
    listing_url: LIVERPOOL_PLAINS_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'liverpool-plains-gpfs/annual-financial-statements-year-ended-30-june-2026.pdf',
    sha256: LIVERPOOL_PLAINS_PDF_SHA256,
    bytes: LIVERPOOL_PLAINS_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: LIVERPOOL_PLAINS_GPFS_REPORTING_URL,
};

/** Golden fixture for the liverpool-plains-gpfs module: 17 rows. */
export const LIVERPOOL_PLAINS_GPFS_ROW_COUNT = 17;
export const LIVERPOOL_PLAINS_GPFS_GOLDEN_DIGEST =
  'd92a5c76a138a3ffbffe15a8561d0f54e3383a2294b2cd518bf5c8c2d2c9f969';
export const ROW_COUNT = LIVERPOOL_PLAINS_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = LIVERPOOL_PLAINS_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseLiverpoolPlainsGpfsExtraction(
    liverpoolPlainsExtraction(),
    LIVERPOOL_PLAINS_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
