import {
  NARRABRI_GPFS_FISCAL_YEAR,
  NARRABRI_GPFS_REPORTING_URL,
  parseNarrabriGpfsExtraction,
  type NarrabriGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 6, 7 and 16 of 106). The Income Statement
// prints the Original unaudited budget column before each line label, with
// Actual 2026 and Actual 2025 after it. A parser that took the first number in
// the line would read the budget; the expected values are all Actual 2026.
// Narrabri Shire Council prints seven revenue components (there is no net gain
// on disposal line) and five expense components, including a real net loss on
// disposal of assets of 8,277. The net result and the before-capital result are
// both negative. Other comprehensive income has a single non-nil component
// (revaluation 23,327); the intangible-asset revaluation line is nil.
export const NARRABRI_PDF_URL =
  'https://www.narrabri.nsw.gov.au/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2025-26-annual-financial-statements-iar-inc.pdf';
export const NARRABRI_PDF_SHA256 =
  'dc3f1d831eaba872d0254c6bddf35b3a91a27bdb4441d59c485c92b02dc8f458';
export const NARRABRI_PDF_BYTES = 2904515;

export const NARRABRI_INCOME_TEXT =
  `§Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 26,403 Rates and annual charges B2-1 26,190 24,917 10,427 User charges and fees B2-2 10,739 8,920 2,345 Other revenues B2-3 2,570 2,524 23,450 Grants and contributions provided for operating purposes B2-4 19,080 12,478 9,185 Grants and contributions provided for capital purposes B2-4 9,681 18,697 2,624 Interest and investment income B2-5 2,492 3,174 207 Other income B2-6 111 149 74,641 Total income from continuing operations 70,863 70,859 Expenses from continuing operations 22,663 Employee benefits and on-costs B3-1 22,424 22,346 27,846 Materials and services B3-2 23,524 23,629 169 Borrowing costs B3-3 138 155 1,093 Other expenses B3-5 983 1,128 – Net loss from the disposal of assets B4-1 8,277 17,227 51,771 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 55,346 64,485 22,870 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 15,517 6,374 17,370 Depreciation, amortisation and impairment of non-financial assets B3-4 17,657 16,741 5,500 Operating result from continuing operations (2,140) (10,367) 5,500 Net operating result for the year attributable to Council (2,140) (10,367) (3,685) Net operating result for the year before grants and contributions provided for capital purposes (11,821) (29,064) The above Income Statement should be read in conjunction with the accompanying notes. Narrabri Shire Council Income Statement for the year ended 30 June 2026 Page 5`;

export const NARRABRI_COMPREHENSIVE_TEXT =
  `§Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement (2,140) (10,367) §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 23,327 22,997 Gain (loss) on revaluation of intangible assets C1-8 – – Total items which will not be reclassified subsequent to operating result 23,327 22,997 Total other comprehensive income for the year 23,327 22,997 Total comprehensive income for the year attributable to Council 21,187 12,630 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Narrabri Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6`;

export const NARRABRI_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Water Services 6,090 5,094 6,348 5,883 (258) (789) 423 200 70,861 67,446 General Purpose Revenue General Purpose Revenue 30,567 23,775 (137) (134) 30,704 23,909 13,415 6,571 6,086 5,536 Other – – – – – – – – (13,907) (37) Total Services 70,863 70,859 73,003 81,226 (2,140) (10,367) 28,761 31,175 767,581 746,009 Narrabri Shire Council Notes to the Financial Statements for the year ended 30 June 2026 B1-1 Council Services - financial information (continued) Page 15`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function narrabriExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: NARRABRI_PDF_SHA256,
      bytes: NARRABRI_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? NARRABRI_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? NARRABRI_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? NARRABRI_FUNCTIONS_TEXT, 16),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const NARRABRI_CONTEXT: NarrabriGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Narrabri Shire Council Annual Financial Statements 2025-26',
    url: NARRABRI_PDF_URL,
    fiscal_year: NARRABRI_GPFS_FISCAL_YEAR,
    listing_url: NARRABRI_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'narrabri-gpfs/2025-26-annual-financial-statements-iar-inc.pdf',
    sha256: NARRABRI_PDF_SHA256,
    bytes: NARRABRI_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: NARRABRI_GPFS_REPORTING_URL,
};

/** Golden fixture for the narrabri-gpfs module: 17 rows. */
export const NARRABRI_GPFS_ROW_COUNT = 17;
export const NARRABRI_GPFS_GOLDEN_DIGEST =
  '2865d4d0f60aa10afc9d10d99300ddcba3895b2a5427808ff8a41e92d6410bf5';
export const ROW_COUNT = NARRABRI_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = NARRABRI_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseNarrabriGpfsExtraction(
    narrabriExtraction(),
    NARRABRI_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
