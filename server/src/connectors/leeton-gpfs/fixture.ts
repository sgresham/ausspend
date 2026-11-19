import {
  LEETON_GPFS_FISCAL_YEAR,
  LEETON_GPFS_REPORTING_URL,
  parseLeetonGpfsExtraction,
  type LeetonGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 7, 8 and 17 of 113). The Income Statement
// prints the Original unaudited budget column before each line label, with
// Actual 2026 and Actual 2025 after it. A parser that took the first number in
// the line would read the budget; the expected values are all Actual 2026.
// Leeton Shire Council prints seven non-nil revenue components (the 2026 net
// gain on disposal is nil) and five expense components, including a real net
// loss on disposal of assets of 84. The net result and the before-capital
// result are both positive. Other comprehensive income has two components
// (revaluation 5,960 and other reserve movements 58) whose sum 6,018 is printed
// as "Total items which will not be reclassified subsequent to operating
// result" (there is no separate "Total other comprehensive income" line).
export const LEETON_PDF_URL =
  'https://www.leeton.nsw.gov.au/files/assets/public/v/1/attachments/1.-your-council/1.2-about-council/1.2.f-plans-reports-regional-plans/financial-statements-and-annual-reports/final-signed-annual-financial-statements-fy-2025-26.pdf';
export const LEETON_PDF_SHA256 =
  '66d292a4e60a31fbf6ec6b8c32e39d891797ffd0d280c9f9afe898c48c47f571';
export const LEETON_PDF_BYTES = 2722199;

export const LEETON_INCOME_TEXT =
  `Leeton Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 2026 2025 $ '000 Notes $ '000 $ '000 Income from continuing operations 16,951 Rates and annual charges B2-1 16,822 15,945 9,577 User charges and fees B2-2 12,369 10,608 929 Other revenues B2-3 1,680 1,530 9,064 Grants and contributions provided for operating purposes B2-4 10,925 7,784 4,446 Grants and contributions provided for capital purposes B2-4 2,110 5,984 2,068 Interest and investment income B2-5 2,504 2,699 345 Other income B2-6 560 475 140 Net gain from the disposal of assets B4-1 – – 43,520 Total income from continuing operations 46,970 45,025 Expenses from continuing operations 15,977 Employee benefits and on-costs B3-1 15,957 15,192 15,404 Materials and services B3-2 13,326 14,632 481 Borrowing costs B3-3 480 444 585 Other expenses B3-5 2,033 365 – Net loss from the disposal of assets B4-1 84 – 32,447 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 31,880 30,633 11,073 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 15,090 14,392 10,260 Depreciation, amortisation and impairment of non-financial assets B3-4 9,887 10,275 813 Operating result from continuing operations 5,203 4,117 813 Net operating result for the year attributable to Council 5,203 4,117 (3,633) Net operating result for the year before grants and contributions provided for capital purposes 3,093 (1,867) The above Income Statement should be read in conjunction with the accompanying notes. Leeton Shire Council Income Statement for the year ended 30 June 2026 Page 5`;

export const LEETON_COMPREHENSIVE_TEXT =
  `Leeton Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ 2026 2025 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 5,203 4,117 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of IPP&E C1-6 5,960 31,582 Other movements in reserves – Intangible Assets Revaluation C1-7 58 128 Total items which will not be reclassified subsequent to operating result 6,018 31,710 Total comprehensive income for the year attributable to Council 11,221 35,827 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Leeton Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 6`;

export const LEETON_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Community Services and Community Development 3,826 3,016 4,456 3,867 (630) (851) 546 210 11,758 11,184 Museum, Arts and Cultural Services 801 3,235 1,275 607 (474) 2,628 596 3,115 23,872 21,908 Parks, Streetscapes and Sporting Facilities 1,161 1,418 3,869 4,344 (2,708) (2,926) 164 518 33,945 33,363 Economic Development 140 800 2,456 1,036 (2,316) (236) 77 694 5,277 6,111 Planning, Building and Public Health 1,194 1,063 1,183 1,635 11 (572) 617 679 142 128 Roads and Drainage 6,059 4,050 6,946 7,788 (887) (3,738) 3,987 2,924 197,365 202,976 Water and Sewer Services 12,046 11,712 9,500 9,175 2,546 2,537 194 614 146,151 134,462 Environmental Sustainability and Emergency Services 4,122 4,620 6,645 4,758 (2,523) (138) 80 130 12,496 11,112 Governance and Administration 17,621 15,111 5,437 7,698 12,184 7,413 6,774 4,884 49,760 46,054 Total functions and activities 46,970 45,025 41,767 40,908 5,203 4,117 13,035 13,768 480,766 467,298 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Leeton Shire Council | Notes to the Financial Statements 30 June 2026 Page 15`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function leetonExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: LEETON_PDF_SHA256,
      bytes: LEETON_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? LEETON_INCOME_TEXT, 7),
      pdfPage(overrides.comprehensive ?? LEETON_COMPREHENSIVE_TEXT, 8),
      pdfPage(overrides.functions ?? LEETON_FUNCTIONS_TEXT, 17),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const LEETON_CONTEXT: LeetonGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Leeton Shire Council Final Signed Annual Financial Statements FY2025-26',
    url: LEETON_PDF_URL,
    fiscal_year: LEETON_GPFS_FISCAL_YEAR,
    listing_url: LEETON_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'leeton-gpfs/final-signed-annual-financial-statements-fy-2025-26.pdf',
    sha256: LEETON_PDF_SHA256,
    bytes: LEETON_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: LEETON_GPFS_REPORTING_URL,
};

/** Golden fixture for the leeton-gpfs module: 17 rows. */
export const LEETON_GPFS_ROW_COUNT = 17;
export const LEETON_GPFS_GOLDEN_DIGEST =
  '91d39e50e24d9492a4745d072080e290109046e30fb5737ba4728bcb4431612d';
export const ROW_COUNT = LEETON_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = LEETON_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseLeetonGpfsExtraction(leetonExtraction(), LEETON_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
