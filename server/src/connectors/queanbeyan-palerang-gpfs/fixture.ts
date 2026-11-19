import {
  QUEANBEYAN_PALERANG_GPFS_FISCAL_YEAR,
  QUEANBEYAN_PALERANG_GPFS_REPORTING_URL,
  parseQueanbeyanPalerangGpfsExtraction,
  type QueanbeyanPalerangGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 97). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Queanbeyan-Palerang Regional
// Council prints seven revenue lines and five expense lines (including a real
// net loss on the disposal of assets of 16,345). The net result and the printed
// before-capital result are both positive. Other comprehensive income has a
// single component (revaluation 123,457) equal to the printed other
// comprehensive income.
export const QUEANBEYAN_PALERANG_PDF_URL =
  'https://www.qprc.nsw.gov.au/files/assets/public/v/1/council/budgets-and-planning/financial_statements-2025-2026.pdf';
export const QUEANBEYAN_PALERANG_PDF_SHA256 =
  '81908dc2ad97c2f9c2a5cff3217096e587d45b3d9be153944914a9a26ae79b51';
export const QUEANBEYAN_PALERANG_PDF_BYTES = 3320800;

export const QUEANBEYAN_PALERANG_INCOME_TEXT =
  `Queanbeyan-Palerang Regional Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 128,515 Rates and annual charges B2-1 125,200 110,815 38,996 User charges and fees B2-2 52,972 40,550 2,042 Other revenues B2-3 1,834 2,003 37,881 Grants and contributions provided for operating purposes B2-4 19,052 21,748 82,936 Grants and contributions provided for capital purposes B2-4 59,340 48,732 10,492 Interest and investment income B2-5 13,978 13,992 1,970 Other income B2-6 5,660 5,179 302,832 Total income from continuing operations 278,036 243,019 Expenses from continuing operations 52,562 Employee benefits and on-costs B3-1 55,436 50,616 96,196 Materials and services B3-2 82,414 80,264 6,312 Borrowing costs B3-3 10,729 6,839 2,254 Other expenses B3-5 3,795 3,034 – Net loss from the disposal of assets B4-1 16,345 5,970 157,324 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 168,719 146,723 145,508 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 109,317 96,296 57,819 Depreciation, amortisation and impairment of non-financial assets B3-4 47,965 52,106 87,689 Operating result from continuing operations 61,352 44,190 87,689 Net operating result for the year attributable to Council 61,352 44,190 4,752 Net operating result for the year before grants and contributions provided for capital purposes 2,012 (4,542) The above Income Statement should be read in conjunction with the accompanying notes. Queanbeyan-Palerang Regional Council Income Statement for the year ended 30 June 2026 Page 4 of 73`;

export const QUEANBEYAN_PALERANG_COMPREHENSIVE_TEXT =
  `Queanbeyan-Palerang Regional Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 61,352 44,190 §Subnote§ Other comprehensive income: Amounts that will not be reclassified subsequently to the operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-8 123,457 (190,688) Total other comprehensive income for the year 123,457 (190,688) Total comprehensive income for the year attributable to Council 184,809 (146,498) The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Queanbeyan-Palerang Regional Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 73`;

export const QUEANBEYAN_PALERANG_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating results Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Community, Arts And Recreation 11,772 10,670 34,796 29,580 (23,024) (18,910) 5,532 5,251 185,111 181,125 Development and Environment 7,482 8,198 16,435 14,613 (8,953) (6,415) 3,133 4,206 – – Infrastructure Services 166,306 150,740 158,399 148,261 7,907 2,479 56,170 55,600 2,083,053 1,941,654 Corporate Services 91,252 73,129 3,811 2,361 87,441 70,768 12,635 5,423 451,079 427,028 Executive Services 1,224 282 3,243 4,014 (2,019) (3,732) 922 – 78,601 72,721 Total functions and activities 278,036 243,019 216,684 198,829 61,352 44,190 78,392 70,480 2,797,844 2,622,528 B Financial Performance B1 Functions or activities B1-1 Functions or activities - income, expenses and assets Page 13 of 73 Queanbeyan-Palerang Regional Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function queanbeyanPalerangExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: QUEANBEYAN_PALERANG_PDF_SHA256,
      bytes: QUEANBEYAN_PALERANG_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? QUEANBEYAN_PALERANG_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? QUEANBEYAN_PALERANG_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? QUEANBEYAN_PALERANG_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const QUEANBEYAN_PALERANG_CONTEXT: QueanbeyanPalerangGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Financial Statements 2025-26',
    url: QUEANBEYAN_PALERANG_PDF_URL,
    fiscal_year: QUEANBEYAN_PALERANG_GPFS_FISCAL_YEAR,
    listing_url: QUEANBEYAN_PALERANG_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'queanbeyan-palerang-gpfs/financial_statements-2025-2026.pdf',
    sha256: QUEANBEYAN_PALERANG_PDF_SHA256,
    bytes: QUEANBEYAN_PALERANG_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: QUEANBEYAN_PALERANG_GPFS_REPORTING_URL,
};

/** Golden fixture for the queanbeyan-palerang-gpfs module: 17 rows. */
export const QUEANBEYAN_PALERANG_GPFS_ROW_COUNT = 17;
export const QUEANBEYAN_PALERANG_GPFS_GOLDEN_DIGEST =
  'a5ff132c1081b9ebdb301c60b06764d7aa2f4337e1907806bb86a1591a48d2d4';
export const ROW_COUNT = QUEANBEYAN_PALERANG_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = QUEANBEYAN_PALERANG_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseQueanbeyanPalerangGpfsExtraction(
    queanbeyanPalerangExtraction(),
    QUEANBEYAN_PALERANG_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
