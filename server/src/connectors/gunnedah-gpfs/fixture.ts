import {
  GUNNEDAH_GPFS_FISCAL_YEAR,
  GUNNEDAH_GPFS_REPORTING_URL,
  parseGunnedahGpfsExtraction,
  type GunnedahGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 6, 7 and 15 of 121). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2026
// and Actual 2025 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2026. Gunnedah
// Shire Council prints seven revenue components (other revenues and other
// income are separate; there is no net gain on disposal line) and five expense
// components, including a real net loss on disposal of assets of 2,712. The net
// result and the before-capital result are both positive. Other comprehensive
// income has a single component (revaluation 27,474) equal to the printed other
// comprehensive income.
export const GUNNEDAH_PDF_URL =
  'https://www.gunnedah.nsw.gov.au/files/assets/public/v/2/images/gunnedahshirecouncil/council/the-future-of-gunnedah/financial-reports/gunnedah-shire-council-financial-statements-2025-26.pdf';
export const GUNNEDAH_PDF_SHA256 =
  'f99d6eeaf582d25d87657ae1baf0800eb31b1d4ffe324be3150599dd330b05ad';
export const GUNNEDAH_PDF_BYTES = 5734060;

export const GUNNEDAH_INCOME_TEXT =
  `Gunnedah Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 25,933 Rates and annual charges B2-1 25,683 22,551 11,780 User charges and fees B2-2 14,983 12,957 872 Other revenues B2-3 1,028 1,517 16,626 Grants and contributions provided for operating purposes B2-4 20,189 14,472 6,865 Grants and contributions provided for capital purposes B2-4 13,591 13,558 3,968 Interest and investment income B2-5 4,350 4,817 189 Other income B2-6 134 109 66,233 Total income from continuing operations 79,958 69,981 Expenses from continuing operations 22,978 Employee benefits and on-costs B3-1 22,476 21,172 17,353 Materials and services B3-2 18,025 18,992 770 Borrowing costs B3-3 983 838 582 Other expenses B3-5 706 775 – Net loss from the disposal of assets B4-1 2,712 4,143 41,683 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 44,902 45,920 24,550 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 35,056 24,061 16,150 Depreciation, amortisation and impairment of non-financial assets B3-4 16,310 16,791 8,400 Operating result from continuing operations 18,746 7,270 8,400 Net operating result for the year attributable to Council 18,746 7,270 1,535 Net operating result for the year before grants and contributions provided for capital purposes 5,155 (6,288) The above Income Statement should be read in conjunction with the accompanying notes. Gunnedah Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 93`;

export const GUNNEDAH_COMPREHENSIVE_TEXT =
  `Gunnedah Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 18,746 7,270 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 27,474 18,461 Total items which will not be reclassified subsequent to operating result 27,474 18,461 Total other comprehensive income for the year 27,474 18,461 Total comprehensive income for the year attributable to Council 46,220 25,731 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Gunnedah Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 93`;

export const GUNNEDAH_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Building Our Shire's Economy 10,256 9,499 3,176 3,422 7,080 6,077 7,545 7,595 52,721 59,462 Engaging and Supporting the Community 51,594 44,723 32,093 33,856 19,501 10,867 15,005 12,109 700,594 630,451 Protecting and Enjoying Our Beautiful Surrounds 9,012 6,658 11,036 10,273 (2,024) (3,615) 3,725 1,145 22,567 54,061 Retaining Our Quality of Life 9,096 9,101 14,907 15,160 (5,811) (6,059) 7,505 7,181 101,510 94,080 Total functions and activities 79,958 69,981 61,212 62,711 18,746 7,270 33,780 28,030 877,392 838,054 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 93 Gunnedah Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function gunnedahExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: GUNNEDAH_PDF_SHA256,
      bytes: GUNNEDAH_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? GUNNEDAH_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? GUNNEDAH_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? GUNNEDAH_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const GUNNEDAH_CONTEXT: GunnedahGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Gunnedah Shire Council Financial Statements 2025-26',
    url: GUNNEDAH_PDF_URL,
    fiscal_year: GUNNEDAH_GPFS_FISCAL_YEAR,
    listing_url: GUNNEDAH_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'gunnedah-gpfs/gunnedah-shire-council-financial-statements-2025-26.pdf',
    sha256: GUNNEDAH_PDF_SHA256,
    bytes: GUNNEDAH_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: GUNNEDAH_GPFS_REPORTING_URL,
};

/** Golden fixture for the gunnedah-gpfs module: 17 rows. */
export const GUNNEDAH_GPFS_ROW_COUNT = 17;
export const GUNNEDAH_GPFS_GOLDEN_DIGEST =
  'ffc29dea04f3de9dc2a14f2339b45611f2886709255a19d40a0cd634a0432b9c';
export const ROW_COUNT = GUNNEDAH_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = GUNNEDAH_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseGunnedahGpfsExtraction(
    gunnedahExtraction(),
    GUNNEDAH_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
