import {
  YASS_VALLEY_GPFS_FISCAL_YEAR,
  YASS_VALLEY_GPFS_REPORTING_URL,
  parseYassValleyGpfsExtraction,
  type YassValleyGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2024-25 PDF
// (Financial Statements PDF pp. 5, 6 and 15 of 93). The Income Statement prints
// the Original unaudited budget column before each line label, with Actual 2025
// and Actual 2024 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2025. Yass Valley
// Council prints seven revenue components (the 2025 net gain on disposal is
// nil) and five expense components, including a real net loss on disposal of
// assets of 1,223. The net result and the before-capital result are both
// positive. Other comprehensive income has a single component (revaluation
// 61,817); this council does not print a separate "Total other comprehensive
// income" line, so the printed "Total items which will not be reclassified" is
// used as the OCI total. The B1-1 total row is labelled "Total".
export const YASS_VALLEY_PDF_URL =
  'https://www.yassvalley.nsw.gov.au/files/assets/public/v/2/ipr-council-docs/2024-25/yass-valley-council-audited-2025-financial-statements.pdf';
export const YASS_VALLEY_PDF_SHA256 =
  '235284e482325fabb6b96a57e18fa9ab3619e950f28bac92d25812b8ae7dfed9';
export const YASS_VALLEY_PDF_BYTES = 2310734;

export const YASS_VALLEY_INCOME_TEXT =
  `Yass Valley Council | Income Statement | for the year ended 30 June 2025 § S t a t e m e n t § Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 22,512 Rates and annual charges B2-1 23,156 22,098 6,214 User charges and fees B2-2 6,180 5,900 330 Other revenues B2-3 680 613 10,799 Grants and contributions provided for operating purposes B2-4 8,648 8,601 13,955 Grants and contributions provided for capital purposes B2-4 20,421 23,150 1,004 Interest and investment income B2-5 2,310 2,010 352 Other income B2-6 418 757 1,100 Net gain from the disposal of assets B4-1 – – 56,266 Total income from continuing operations 61,813 63,129 Expenses from continuing operations 14,711 Employee benefits and on-costs B3-1 13,295 13,891 20,013 Materials and services B3-2 13,023 15,913 1,560 Borrowing costs B3-3 717 720 972 Other expenses B3-5 1,137 2,448 – Net loss from the disposal of assets B4-1 1,223 1,607 37,256 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 29,395 34,579 19,010 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 32,418 28,550 9,816 Depreciation, amortisation and impairment of non-financial assets B3-4 10,059 9,869 9,194 Operating result from continuing operations 22,359 18,681 9,194 Net operating result for the year attributable to Council 22,359 18,681 (4,761) Net operating result for the year before grants and contributions provided for capital purposes 1,938 (4,469) The above Income Statement should be read in conjunction with the accompanying notes. Yass Valley Council Income Statement for the year ended 30 June 2025 Page 5 of 65`;

export const YASS_VALLEY_COMPREHENSIVE_TEXT =
  `Yass Valley Council | Statement of Comprehensive Income | for the year ended 30 June 2025 § N o t e / S u b t o t a l § $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 22,359 18,681 § S u b n o t e § Other comprehensive income: Amounts which will not be reclassified subsequent to operating result - Gain on revaluation of infrastructure, property, plant and equipment C1-5 61,817 29,069 Total items which will not be reclassified subsequent to operating result 61,817 29,069 Total comprehensive income for the year attributable to Council 84,176 47,750 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Yass Valley Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 65`;

export const YASS_VALLEY_FUNCTIONS_TEXT =
  `§ N o t e / S u b t o t a l § Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions/activities Our Civic Leadership 17,515 16,375 5,964 6,558 11,551 9,817 1,690 2,299 47,087 43,317 Our Community 470 627 1,751 2,128 (1,281) (1,501) 228 388 2,037 1,995 Our Economy 1,646 1,373 2,411 2,329 (765) (956) – 10 7,037 7,037 Our Environment 1,745 2,359 1,973 3,289 (228) (930) 1,568 2,093 79,043 67,981 Our Infrastructure 40,437 42,395 27,355 30,144 13,082 12,251 25,583 26,961 606,512 520,348 Total 61,813 63,129 39,454 44,448 22,359 18,681 29,069 31,751 741,716 640,678 § T o c I t e m § § T o c I t e m § § S u b n o t e § B1-2 Components of functions or activities § N o t e § Our Civic Leadership (Systems of Government or Management) § T o c I t e m § § T o c I t e m § § S u b n o t e § Details relating to Council’s functions or activities as reported in B1-1 are as follows: Our leaders operate ethically and implement good governance. We empower our residents with the tools to participate actively in the development of our communities. Yass Valley Council | Notes to the Financial Statements 30 June 2025 B1-1 Functions or activities – income, expenses and assets Page 15 of 65`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function yassValleyExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: YASS_VALLEY_PDF_SHA256,
      bytes: YASS_VALLEY_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? YASS_VALLEY_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? YASS_VALLEY_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? YASS_VALLEY_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const YASS_VALLEY_CONTEXT: YassValleyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Yass Valley Council Audited Financial Statements 2024-25',
    url: YASS_VALLEY_PDF_URL,
    fiscal_year: YASS_VALLEY_GPFS_FISCAL_YEAR,
    listing_url: YASS_VALLEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'yass-valley-gpfs/yass-valley-council-audited-2025-financial-statements.pdf',
    sha256: YASS_VALLEY_PDF_SHA256,
    bytes: YASS_VALLEY_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: YASS_VALLEY_GPFS_REPORTING_URL,
};

/** Golden fixture for the yass-valley-gpfs module: 17 rows. */
export const YASS_VALLEY_GPFS_ROW_COUNT = 17;
export const YASS_VALLEY_GPFS_GOLDEN_DIGEST =
  '1e2a2a5ea3102dc3c037aa4e1e2f9ee54541b32f0849cf4806bc70a78988b287';
export const ROW_COUNT = YASS_VALLEY_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = YASS_VALLEY_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseYassValleyGpfsExtraction(
    yassValleyExtraction(),
    YASS_VALLEY_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
