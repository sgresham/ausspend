import {
  SNOWY_MONARO_GPFS_FISCAL_YEAR,
  SNOWY_MONARO_GPFS_REPORTING_URL,
  parseSnowyMonaroGpfsExtraction,
  type SnowyMonaroGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 95). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Snowy Monaro Regional Council
// prints seven revenue lines and five expense lines (including a real net loss
// on disposal of assets of 9,004). The net result is positive; the printed
// before-capital result is negative. Other comprehensive income has a single
// non-nil component (revaluation 78,499) equal to the printed other
// comprehensive income.
export const SNOWY_MONARO_PDF_URL =
  'https://yoursaysnowymonaro.com.au/109847/widgets/498829/documents/335580/download';
export const SNOWY_MONARO_PDF_SHA256 =
  '40ee605dfd8d4b988d8871470cda32ad6de7d0b2453617a440d7716e2c590ba2';
export const SNOWY_MONARO_PDF_BYTES = 2942138;

export const SNOWY_MONARO_INCOME_TEXT =
  `Snowy Monaro Regional Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 45,836 Rates and annual charges B2-1 47,420 43,053 17,493 User charges and fees B2-2 19,615 15,769 527 Other revenues B2-3 3,368 1,464 24,083 Grants and contributions provided for operating purposes B2-4 26,799 22,223 2,936 Grants and contributions provided for capital purposes B2-4 31,634 38,125 3,851 Interest and investment revenue B2-5 5,128 4,852 1,223 Other income B2-6 1,410 1,323 1,908 Net gain from the disposal of assets B4-1 – – 97,857 Total income from continuing operations 135,374 126,809 Expenses from continuing operations 39,430 Employee benefits and on-costs B3-1 36,796 34,886 30,328 Materials and services B3-2 32,142 46,430 – Borrowing costs B3-3 3,033 1,522 2,386 Other expenses B3-5 2,421 2,126 – Net loss from the disposal of assets B4-1 9,004 15,401 72,144 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 83,396 100,365 25,713 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 51,978 26,444 28,314 Depreciation, amortisation and impairment of non-financial assets B3-4 30,290 28,903 (2,601) Operating result from continuing operations 21,688 (2,459) (2,601) Net operating result for the year attributable to Council 21,688 (2,459) (5,537) Net operating result for the year before grants and contributions provided for capital purposes (9,946) (40,584) The above Income Statement should be read in conjunction with the accompanying notes. Snowy Monaro Regional Council Income Statement for the year ended 30 June 2026 Page 5 of 76`;

export const SNOWY_MONARO_COMPREHENSIVE_TEXT =
  `Snowy Monaro Regional Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 21,688 (2,459) §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of Infrastructure, Property, Plant & Equipment C1-7 78,499 95,805 Impairment (loss) reversal relating to infrastructure, property, plant and equipment C1-7 – 17,240 Total other comprehensive income for the year 78,499 113,045 Total comprehensive income for the year attributable to Council 100,187 110,586 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Snowy Monaro Regional Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6 of 76`;

export const SNOWY_MONARO_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Community 10,838 9,213 20,988 48,809 (10,150) (39,596) 8,135 7,294 190,018 180,251 Economy 28,902 36,632 39,638 50,730 (10,736) (14,098) 23,865 33,111 123,008 116,685 Environment 50,882 45,017 47,876 27,726 3,006 17,291 13,173 11,542 1,576,918 1,495,860 Leadership 44,752 35,947 5,184 2,003 39,568 33,944 13,260 8,401 73,936 70,243 Total functions and activities 135,374 126,809 113,686 129,268 21,688 (2,459) 58,433 60,348 1,963,880 1,863,039 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 of 76 Snowy Monaro Regional Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function snowyMonaroExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: SNOWY_MONARO_PDF_SHA256,
      bytes: SNOWY_MONARO_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? SNOWY_MONARO_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? SNOWY_MONARO_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? SNOWY_MONARO_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const SNOWY_MONARO_CONTEXT: SnowyMonaroGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements GPFS 2025-26',
    url: SNOWY_MONARO_PDF_URL,
    fiscal_year: SNOWY_MONARO_GPFS_FISCAL_YEAR,
    listing_url: SNOWY_MONARO_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'snowy-monaro-gpfs/annual_financial_statements-gpfs-2026.pdf',
    sha256: SNOWY_MONARO_PDF_SHA256,
    bytes: SNOWY_MONARO_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: SNOWY_MONARO_GPFS_REPORTING_URL,
};

/** Golden fixture for the snowy-monaro-gpfs module: 17 rows. */
export const SNOWY_MONARO_GPFS_ROW_COUNT = 17;
export const SNOWY_MONARO_GPFS_GOLDEN_DIGEST =
  'd1734d511a20c4bcef8ac7264b7740b15c1fb18e32e31e66172612f73b5c3d15';
export const ROW_COUNT = SNOWY_MONARO_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = SNOWY_MONARO_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseSnowyMonaroGpfsExtraction(snowyMonaroExtraction(), SNOWY_MONARO_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
