import {
  BOURKE_GPFS_FISCAL_YEAR,
  BOURKE_GPFS_REPORTING_URL,
  parseBourkeGpfsExtraction,
  type BourkeGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 6, 7 and 15 of 88). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Bourke prints seven non-zero
// revenue lines (its net gain on disposal is nil) and five expense lines
// (including borrowing costs and a net loss on disposal). The net result and the
// printed before-capital result are both positive.
export const BOURKE_PDF_URL =
  'https://bourke.nsw.gov.au/wp-content/uploads/2026/10/Annual-Financial-Statements-2025-2026.pdf';
export const BOURKE_PDF_SHA256 =
  '9441ad45d329e66ed888da82673e027b4d662b858308b4bb5ddd14ce1b41bce5';
export const BOURKE_PDF_BYTES = 3_413_641;

export const BOURKE_INCOME_TEXT =
  "Bourke Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 5,411 Rates and annual charges B2-1 5,024 4,735 4,005 User charges and fees B2-2 7,180 5,826 1,126 Other revenues B2-3 2,220 1,307 13,811 Grants and contributions provided for operating purposes B2-4 30,590 13,361 40,424 Grants and contributions provided for capital purposes B2-4 4,172 8,555 1,371 Interest and investment income B2-5 1,599 1,921 361 Other income B2-6 358 517 – Net gain from the disposal of assets B4-1 – 363 66,509 Total income from continuing operations 51,143 36,585 Expenses from continuing operations 9,000 Employee benefits and on-costs B3-1 9,206 8,472 15,697 Materials and services B3-2 17,915 16,765 287 Borrowing costs B3-3 196 190 410 Other expenses B3-5 642 440 – Net loss from the disposal of assets B4-1 280 – 25,394 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 28,239 25,867 41,115 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 22,904 10,718 9,416 Depreciation, amortisation and impairment of non-financial assets B3-4 10,895 9,955 31,699 Operating result from continuing operations 12,009 763 31,699 Net operating result for the year attributable to Council 12,009 763 (8,726) Net operating result for the year before grants and contributions provided for capital purposes 7,837 (7,792) The above Income Statement should be read in conjunction with the accompanying notes. Bourke Shire Council Income Statement for the year ended 30 June 2026 Page 5 of 88";

export const BOURKE_COMPREHENSIVE_TEXT =
  "Bourke Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 12,009 763 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 22,603 9,524 Total items which will not be reclassified subsequent to operating result 22,603 9,524 Total other comprehensive income for the year 22,603 9,524 Total comprehensive income for the year attributable to Council 34,612 10,287 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Bourke Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6 of 88";

export const BOURKE_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Environmental sustainability 976 1,136 1,796 2,732 (820) (1,596) 23 228 22,133 21,588 Livable and vibrant community 780 1,049 5,791 5,162 (5,011) (4,113) 359 947 46,758 41,935 Economic prosperity 1,242 1,259 3,613 3,587 (2,371) (2,328) 223 505 8,885 8,596 Governance and organisational performance 14,848 11,238 2,987 2,588 11,861 8,650 10,915 8,483 55,614 42,431 Infrastructure 33,297 21,903 24,704 21,681 8,593 222 23,242 11,753 327,298 312,947 Joint arrangements – – 243 72 (243) (72) – – 363 606 Total functions and activities 51,143 36,585 39,134 35,822 12,009 763 34,762 21,916 461,051 428,103 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 88 Bourke Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function bourkeExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BOURKE_PDF_SHA256,
      bytes: BOURKE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BOURKE_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? BOURKE_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? BOURKE_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BOURKE_CONTEXT: BourkeGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements 2025-2026',
    url: BOURKE_PDF_URL,
    fiscal_year: BOURKE_GPFS_FISCAL_YEAR,
    listing_url: BOURKE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'bourke-gpfs/Annual-Financial-Statements-2025-2026.pdf',
    sha256: BOURKE_PDF_SHA256,
    bytes: BOURKE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BOURKE_GPFS_REPORTING_URL,
};

/** Golden fixture for the bourke-gpfs module: 17 rows. */
export const BOURKE_GPFS_ROW_COUNT = 17;
export const BOURKE_GPFS_GOLDEN_DIGEST =
  'e0e51f5c92d835ada64cd04d411d2a8da6ec1cc30926cbd841d28d4e14816f53';
export const ROW_COUNT = BOURKE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BOURKE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBourkeGpfsExtraction(bourkeExtraction(), BOURKE_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
