import {
  EDWARD_RIVER_GPFS_FISCAL_YEAR,
  EDWARD_RIVER_GPFS_REPORTING_URL,
  parseEdwardRiverGpfsExtraction,
  type EdwardRiverGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25
// combined annual report + financial statements PDF (FS PDF pp. 5, 6 and 15 of
// 104). The Income Statement prints the Original unaudited budget column before
// each line label, with Actual 2025 and Actual 2024 after it. A parser that took
// the first number in the line would read the budget; the expected values are
// all Actual 2025. Edward River Council prints seven revenue components
// (including a real net gain on disposal of 171) and three expense components
// (there is no borrowing-cost line and no net loss on disposal in 2025). The net
// result is positive while the before-capital result is negative. Other
// comprehensive income has a single non-nil component (revaluation 14,777); the
// council does not print an OCI subtotal, so the OCI total is the sum of the
// printed components and is reconciled to the printed total comprehensive
// income.
export const EDWARD_RIVER_PDF_URL =
  'https://www.edwardriver.nsw.gov.au/files/assets/public/v/1/1.-documents/publications/reports/annual-report/ar-2024-25/edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf';
export const EDWARD_RIVER_PDF_SHA256 =
  '7d042fcf707b05ee9989df748e9257afe6eba6c7df2b39e3c2e3232ab3554bcf';
export const EDWARD_RIVER_PDF_BYTES = 2142775;

export const EDWARD_RIVER_INCOME_TEXT =
  `Edward River Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 16,234 Rates and annual charges B2-1 15,970 14,845 4,534 User charges and fees B2-2 5,218 5,560 594 Other revenues 726 800 10,560 Grants and contributions provided for operating purposes B2-3 11,225 25,188 4,120 Grants and contributions provided for capital purposes B2-3 3,196 5,411 1,653 Interest and investment income B2-5 1,996 1,753 480 Net gain from the disposal of assets B4-1 171 – 38,175 Total income from continuing operations 38,502 53,557 Expenses from continuing operations 12,303 Employee benefits and on-costs B3-1 12,853 11,597 10,011 Materials and services B3-2 13,115 11,558 624 Other expenses 688 539 – Net loss from the disposal of assets B4-1 – 227 22,938 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 26,656 23,921 15,237 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 11,846 29,636 11,116 Depreciation, amortisation and impairment of non-financial assets B3-3 10,953 13,406 4,121 Net operating result for the year attributable to Council 893 16,230 1 Net operating result for the year before grants and contributions provided for capital purposes (2,303) 10,819 The above Income Statement should be read in conjunction with the accompanying notes. Edward River Council Income Statement for the year ended 30 June 2025 Page 5 of 77`;

export const EDWARD_RIVER_COMPREHENSIVE_TEXT =
  `Edward River Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 893 16,230 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 14,777 (22,811) Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment C1-5 – 3,216 Total comprehensive income for the year attributable to Council 15,670 (3,365) The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Edward River Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 77`;

export const EDWARD_RIVER_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities 1, 2 A community working together to achieve its potential 14,068 14,709 8,849 6,836 5,219 7,873 3,860 6,636 118,366 114,959 A great place to live 692 716 1,681 1,628 (989) (912) 160 2,836 45,438 44,130 A prosperous and vibrant economy 8 167 530 671 (522) (504) 8 2,338 17,970 17,453 A region with quality and sustainable infrastructure 20,715 33,666 21,288 23,234 (573) 10,432 10,094 18,715 299,362 290,745 A valued and enhanced natural environment 3,019 4,299 5,261 4,958 (2,242) (659) 299 74 81,961 79,601 Total functions and activities 38,502 53,557 37,609 37,327 893 16,230 14,421 30,599 563,097 546,888 (1)  Income and expenditure allocated to each function/ activity using cost centres, with each cost centre being attached to one particular function/activity. (2)  Assets allocated to each activity on the basis of the activity's expenditure as a proportion of total expenditure. The assumption is that a function's expenditure is a reflection of that activity's utilisation of total assets. B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 15 of 77 Edward River Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function edwardRiverExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: EDWARD_RIVER_PDF_SHA256,
      bytes: EDWARD_RIVER_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? EDWARD_RIVER_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? EDWARD_RIVER_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? EDWARD_RIVER_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const EDWARD_RIVER_CONTEXT: EdwardRiverGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Report and Financial Statements 2024-25',
    url: EDWARD_RIVER_PDF_URL,
    fiscal_year: EDWARD_RIVER_GPFS_FISCAL_YEAR,
    listing_url: EDWARD_RIVER_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'edward-river-gpfs/edward-river-council-annual-report-financial-statements-2024-25-rgb-web.pdf',
    sha256: EDWARD_RIVER_PDF_SHA256,
    bytes: EDWARD_RIVER_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: EDWARD_RIVER_GPFS_REPORTING_URL,
};

/** Golden fixture for the edward-river-gpfs module: 15 rows. */
export const EDWARD_RIVER_GPFS_ROW_COUNT = 15;
export const EDWARD_RIVER_GPFS_GOLDEN_DIGEST =
  '502750ecfea3845750287728f43c595bdd3bc4476a70e9de800404e4870dfb08';
export const ROW_COUNT = EDWARD_RIVER_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = EDWARD_RIVER_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseEdwardRiverGpfsExtraction(
    edwardRiverExtraction(),
    EDWARD_RIVER_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
