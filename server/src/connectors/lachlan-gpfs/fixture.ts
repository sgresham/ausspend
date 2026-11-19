import {
  LACHLAN_GPFS_FISCAL_YEAR,
  LACHLAN_GPFS_REPORTING_URL,
  parseLachlanGpfsExtraction,
  type LachlanGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 4, 5 and 13 of 106). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2025
// and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Lachlan Shire
// Council prints seven revenue components (the 2025 net gain on disposal is nil)
// and five expense components, including a real net loss on disposal of assets
// of 105. The net result is negative (-3,418) and the before-capital result is
// more negative (-10,260). Other comprehensive income prints a single 2025
// revaluation component of 16,508.
export const LACHLAN_PDF_URL =
  'https://www.lachlan.nsw.gov.au/files/assets/public/v/1/council/policies/new-folder/new-folder/final-financial-report-2025.pdf';
export const LACHLAN_PDF_SHA256 =
  'fd37d9c67e1b2e93e9537e29b81245954511d25a4f7d9e21ac2a41122dee9b16';
export const LACHLAN_PDF_BYTES = 2779801;

export const LACHLAN_INCOME_TEXT =
  `Lachlan Shire Council | Income Statement | for the year ended 30 June 2025 Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 14,475 Rates and annual charges B2-1 14,083 13,300 5,871 User charges and fees B2-2 4,559 4,841 1,858 Other revenues B2-3 1,090 1,144 19,214 Grants and contributions provided for operating purposes B2-4 19,884 28,740 3,595 Grants and contributions provided for capital purposes B2-4 6,842 11,595 2,395 Interest and investment income B2-5 3,742 3,163 – Other income B2-6 722 515 47,408 Total income from continuing operations 50,922 63,298 Expenses from continuing operations 12,388 Employee benefits and on-costs B3-1 12,709 12,015 16,883 Materials and services B3-2 27,341 22,325 471 Borrowing costs B3-3 311 364 1,309 Other expenses B3-5 1,145 826 – Net loss from the disposal of assets B4-1 105 1,768 31,051 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 41,611 37,298 16,357 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 9,311 26,000 12,670 Depreciation, amortisation and impairment of non-financial assets B3-4 12,729 12,004 3,687 Operating result from continuing operations (3,418) 13,996 3,687 Net operating result for the year attributable to Council (3,418) 13,996 92 Net operating result for the year before grants and contributions provided for capital purposes (10,260) 2,401 The above Income Statement should be read in conjunction with the accompanying notes. Lachlan Shire Council Income Statement for the year ended 30 June 2025 Page 4 of 83`;

export const LACHLAN_COMPREHENSIVE_TEXT =
  `Lachlan Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement (3,418) 13,996 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 16,508 29,560 Total items which will not be reclassified subsequent to operating result 16,508 29,560 Total other comprehensive income for the year 16,508 29,560 Total comprehensive income for the year attributable to Council 13,090 43,556 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Lachlan Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 83`;

export const LACHLAN_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Community Services 3,520 4,091 1,868 1,870 1,652 2,221 3,094 3,654 23,979 22,778 Tourism & Economic Development 1,397 2,915 3,464 2,082 (2,067) 833 531 2,122 17,024 19,143 Transport 11,267 19,363 22,787 18,183 (11,520) 1,180 11,091 19,090 500,629 483,811 Governance & Financial Control 21,816 23,253 8,723 7,945 13,093 15,308 8,543 11,297 44,686 47,529 People & Environment 3,000 3,604 4,710 4,454 (1,710) (850) 465 526 6,528 6,514 Recreation 624 1,317 4,914 4,694 (4,290) (3,377) 571 1,317 47,512 60,819 Service Infrastructure 9,298 8,755 7,874 10,074 1,424 (1,319) 2,431 2,328 134,730 123,775 Other – – – – – – – 1 – (1) Total functions and activities 50,922 63,298 54,340 49,302 (3,418) 13,996 26,726 40,335 775,088 764,368 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 83 Lachlan Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function lachlanExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: LACHLAN_PDF_SHA256,
      bytes: LACHLAN_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? LACHLAN_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? LACHLAN_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? LACHLAN_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const LACHLAN_CONTEXT: LachlanGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Lachlan Shire Council 2024-2025 Annual Financial Statements',
    url: LACHLAN_PDF_URL,
    fiscal_year: LACHLAN_GPFS_FISCAL_YEAR,
    listing_url: LACHLAN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'lachlan-gpfs/final-financial-report-2025.pdf',
    sha256: LACHLAN_PDF_SHA256,
    bytes: LACHLAN_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: LACHLAN_GPFS_REPORTING_URL,
};

/** Golden fixture for the lachlan-gpfs module: 17 rows. */
export const LACHLAN_GPFS_ROW_COUNT = 17;
export const LACHLAN_GPFS_GOLDEN_DIGEST = '50bc0db2f7fc214af01c915aec70b4f8b1b9530f67dc9b3940732df39aac1b08';
export const ROW_COUNT = LACHLAN_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = LACHLAN_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseLachlanGpfsExtraction(
    lachlanExtraction(),
    LACHLAN_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
