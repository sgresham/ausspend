import {
  MURRAY_RIVER_GPFS_FISCAL_YEAR,
  MURRAY_RIVER_GPFS_REPORTING_URL,
  parseMurrayRiverGpfsExtraction,
  type MurrayRiverGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 annual
// report (GPFS section: PDF pp. 86, 87 and 95 of 198). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2026
// and Actual 2025 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2026. Murray River
// Council prints seven revenue components (the 2026 net gain on disposal is nil)
// and five expense components, including a real net loss on disposal of assets
// of 10,687. The net result is negative (-3,144) and the before-capital result is
// more negative (-22,367). Other comprehensive income prints revaluation 4,320
// and revaluation of intangible assets 802, summing to the printed 5,122.
export const MURRAY_RIVER_PDF_URL =
  'https://www.murrayriver.nsw.gov.au/files/assets/public/v/1/documents/ipampr-docs-and-budgets/2025-2026/mrc-25-26-annual-report-with-financial-statements.pdf';
export const MURRAY_RIVER_PDF_SHA256 =
  '347ee9345dbb979ab3d6eb2e471f257a5f25ab7dce0960c42b7700d54166ef01';
export const MURRAY_RIVER_PDF_BYTES = 5726687;

export const MURRAY_RIVER_INCOME_TEXT =
  `Murray River Council | Income Statement | for the year ended 30 June 2026 Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 26,532 Rates and annual charges B2-1 27,238 25,070 14,495 User charges and fees B2-2 13,577 14,112 604 Other revenue B2-3 1,210 1,451 19,610 Grants and contributions provided for operating purposes B2-4 21,518 18,571 9,876 Grants and contributions provided for capital purposes B2-4 19,223 16,601 2,907 Interest and investment income B2-5 2,963 3,204 695 Other income B2-6 674 712 74,719 Total income from continuing operations 86,403 79,721 Expenses from continuing operations 23,303 Employee benefits and on-costs B3-1 23,740 22,576 22,871 Materials and services B3-2 23,385 26,697 45 Borrowing costs B3-3 214 252 1,157 Other expenses B3-5 9,450 1,100 – Net loss from the disposal of assets B4-1 10,687 9,465 47,376 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 67,476 60,090 27,343 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 18,927 19,631 21,397 Depreciation, amortisation and impairment of non-financial assets B3-4 22,071 21,918 5,946 Operating result from continuing operations (3,144) (2,287) – Operating result from discontinued operations – – 5,946 Net operating result for the year attributable to Council (3,144) (2,287) (3,930) Net operating result for the year before grants and contributions provided for capital purposes (22,367) (18,888) The above Income Statement should be read in conjunction with the accompanying notes. Murray River Council Income Statement for the year ended 30 June 2026 Page 4 of 116`;

export const MURRAY_RIVER_COMPREHENSIVE_TEXT =
  `Murray River Council | Statement of Comprehensive Income | for the year ended 30 June 2026 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement (3,144) (2,287) Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain / (loss) on revaluation of infrastructure, property, plant and equipment C1-7 4,320 69,269 Other movements Revaluation Intangible Assets C1-8 802 130 Total items which will not be reclassified subsequent to operating result 5,122 69,399 Total other comprehensive income for the year 5,122 69,399 Total comprehensive income for the year attributable to Council 1,978 67,112 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Murray River Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 116`;

export const MURRAY_RIVER_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Other – – – – – – – – (1) – Environmental Sensitivity 4,590 3,954 13,467 3,259 (8,877) 695 404 127 28,254 21,230 Progressive Leadership 33,174 24,326 7,875 8,178 25,299 16,148 15,373 7,605 37,801 43,709 Liveable Communities 27,376 26,682 26,526 26,843 850 (161) 6,437 6,003 385,812 378,629 Inclusion, Culture and Wellbeing 1,808 1,277 2,833 2,445 (1,025) (1,168) 1,303 978 – – Prosperity and Resilience 2,508 5,235 4,723 6,752 (2,215) (1,517) 680 2,620 5,093 5,185 Connected Communities 16,829 17,970 33,298 27,118 (16,469) (9,148) 16,444 17,595 801,430 795,780 Tomorrow's Technologies 118 277 825 7,413 (707) (7,136) 100 244 1,003 550 Total functions and activities 86,403 79,721 89,547 82,008 (3,144) (2,287) 40,741 35,172 1,259,392 1,245,083 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Murray River Council | Notes to the Financial Statements 30 June 2026 Page 13 of 116`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function murrayRiverExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: MURRAY_RIVER_PDF_SHA256,
      bytes: MURRAY_RIVER_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? MURRAY_RIVER_INCOME_TEXT, 86),
      pdfPage(overrides.comprehensive ?? MURRAY_RIVER_COMPREHENSIVE_TEXT, 87),
      pdfPage(overrides.functions ?? MURRAY_RIVER_FUNCTIONS_TEXT, 95),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const MURRAY_RIVER_CONTEXT: MurrayRiverGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Murray River Council MRC-25-26 Annual Report with Financial Statements',
    url: MURRAY_RIVER_PDF_URL,
    fiscal_year: MURRAY_RIVER_GPFS_FISCAL_YEAR,
    listing_url: MURRAY_RIVER_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'murray-river-gpfs/mrc-25-26-annual-report-with-financial-statements.pdf',
    sha256: MURRAY_RIVER_PDF_SHA256,
    bytes: MURRAY_RIVER_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: MURRAY_RIVER_GPFS_REPORTING_URL,
};

/** Golden fixture for the murray-river-gpfs module: 17 rows. */
export const MURRAY_RIVER_GPFS_ROW_COUNT = 17;
export const MURRAY_RIVER_GPFS_GOLDEN_DIGEST = '3f64d4429b824bd42736b06ccb3bfa599ed79e945c89152b5d7b50122b3a2457';
export const ROW_COUNT = MURRAY_RIVER_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = MURRAY_RIVER_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseMurrayRiverGpfsExtraction(
    murrayRiverExtraction(),
    MURRAY_RIVER_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
