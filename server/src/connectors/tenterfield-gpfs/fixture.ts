import {
  TENTERFIELD_GPFS_FISCAL_YEAR,
  TENTERFIELD_GPFS_REPORTING_URL,
  parseTenterfieldGpfsExtraction,
  type TenterfieldGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 104). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Tenterfield Shire Council
// prints seven revenue lines and five expense lines (including a real net loss
// on disposal of assets of 3,183). The net result is positive; the printed
// before-capital result is negative. Other comprehensive income has a single
// component (revaluation 26,535) equal to the printed other comprehensive
// income.
export const TENTERFIELD_PDF_URL =
  'https://www.tenterfield.nsw.gov.au/content/uploads/2026/11/Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf';
export const TENTERFIELD_PDF_SHA256 =
  'c8f36ee616a3ef2b0cecec81bde2175c7a1a332522b4dd0a6ebe59d670736df8';
export const TENTERFIELD_PDF_BYTES = 1632568;

export const TENTERFIELD_INCOME_TEXT =
  `Tenterfield Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 14,905 Rates and annual charges B2-1 15,184 15,270 2,651 User charges and fees B2-2 3,390 3,421 794 Other revenues B2-3 507 359 35,896 Grants and contributions provided for operating purposes B2-4 17,827 12,075 14,083 Grants and contributions provided for capital purposes B2-4 8,484 20,987 885 Interest and investment income B2-5 2,837 3,080 – Other income B2-6 234 206 69,214 Total income from continuing operations 48,463 55,398 Expenses from continuing operations 9,618 Employee benefits and on-costs B3-1 8,522 7,862 37,563 Materials and services B3-2 17,967 13,882 832 Borrowing costs B3-3 902 990 2,767 Other expenses B3-5 677 599 312 Net loss from the disposal of assets B4-1 3,183 3,183 51,092 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 31,251 26,516 18,122 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 17,212 28,882 9,891 Depreciation, amortisation and impairment of non-financial assets B3-4 9,470 9,197 8,231 Operating result from continuing operations 7,742 19,685 8,231 Net operating result for the year attributable to Council 7,742 19,685 (5,852) Net operating result for the year before grants and contributions provided for capital purposes (742) (1,302) The above Income Statement should be read in conjunction with the accompanying notes. Tenterfield Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 81`;

export const TENTERFIELD_COMPREHENSIVE_TEXT =
  `Tenterfield Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 7,742 19,685 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 26,535 15,958 Total items which will not be reclassified subsequent to operating result 26,535 15,958 Total other comprehensive income for the year 26,535 15,958 Total comprehensive income for the year attributable to Council 34,277 35,643 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Tenterfield Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 81`;

export const TENTERFIELD_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Civic Office 9 9 341 363 (332) (354) 9 9 286 523 Organisation and Leadership – – 1,207 1,191 (1,207) (1,191) – – – – Community Development – (15) – 27 – (42) – (15) 859 916 Economic Growth and Tourism 75 198 214 182 (139) 16 75 180 3,316 4,388 Theatre and Museum Complex 23 31 156 127 (133) (96) 3 7 428 408 Finance and Technology 15,895 12,828 731 649 15,164 12,179 6,439 3,132 51,599 40,625 Corporate and Governance 4 10 649 661 (645) (651) – – 324 370 Workforce Development 182 94 2,188 1,373 (2,006) (1,279) 55 49 – – Library Services 98 96 446 422 (348) (326) 91 91 151 170 Emergency Services 160 226 739 697 (579) (471) 151 221 1,654 1,297 Asset Management and Resourcing 4 – 772 779 (768) (779) – – 4,355 4,262 Commercial Works 248 439 221 165 27 274 – – – – Environmental Management 194 106 302 372 (108) (266) 191 105 49 46 Planning and Regulation 776 820 518 469 258 351 309 455 1,400 1,316 Plant, Fleet and Equipment 166 73 (513) 67 679 6 – – 5,916 5,711 Buildings and Amenities 217 250 1,172 1,111 (955) (861) – 89 20,288 18,944 Livestock Saleyards 252 172 212 194 40 (22) – – 2,379 2,277 Parks, Gardens and Open Space 150 149 1,242 1,175 (1,092) (1,026) (27) – 14,518 14,008 Swimming Complex 31 25 300 275 (269) (250) – – 1,375 1,323 Stormwater and Drainage 107 100 128 136 (21) (36) 3 3 5,252 5,187 Transport Network 18,985 25,240 21,067 16,593 (2,082) 8,647 18,483 24,925 518,139 490,539 Sewerage Services 3,439 3,612 2,125 2,478 1,314 1,134 290 248 35,633 34,067 Waste Management 4,066 4,072 2,882 2,329 1,184 1,743 28 85 20,932 19,050 Water Supply 3,382 6,863 3,622 3,878 (240) 2,985 211 3,478 60,066 58,822 Total functions and activities 48,463 55,398 40,721 35,713 7,742 19,685 26,311 33,062 748,919 704,249 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 81 Tenterfield Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function tenterfieldExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: TENTERFIELD_PDF_SHA256,
      bytes: TENTERFIELD_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? TENTERFIELD_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? TENTERFIELD_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? TENTERFIELD_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const TENTERFIELD_CONTEXT: TenterfieldGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Financial Statements 2025-26',
    url: TENTERFIELD_PDF_URL,
    fiscal_year: TENTERFIELD_GPFS_FISCAL_YEAR,
    listing_url: TENTERFIELD_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'tenterfield-gpfs/Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf',
    sha256: TENTERFIELD_PDF_SHA256,
    bytes: TENTERFIELD_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: TENTERFIELD_GPFS_REPORTING_URL,
};

/** Golden fixture for the tenterfield-gpfs module: 17 rows. */
export const TENTERFIELD_GPFS_ROW_COUNT = 17;
export const TENTERFIELD_GPFS_GOLDEN_DIGEST =
  'd11c12180531461393aeb274a2d8dd0d8f79026b61f48595b867d5772105b200';
export const ROW_COUNT = TENTERFIELD_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = TENTERFIELD_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseTenterfieldGpfsExtraction(
    tenterfieldExtraction(),
    TENTERFIELD_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
