import {
  URALLA_GPFS_FISCAL_YEAR,
  URALLA_GPFS_REPORTING_URL,
  parseUrallaGpfsExtraction,
  type UrallaGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived signed FY2025-26 PDF
// (PDF pp. 5, 6 and 14 of 97). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Uralla prints six non-zero
// revenue lines (its net gain on disposal is nil) and five expense lines
// (including borrowing costs and a net loss on disposal). The net result and the
// printed before-capital result are both negative.
export const URALLA_PDF_URL =
  'https://www.uralla.nsw.gov.au/files/assets/public/v/1/council/financial-statements/uralla_financial_statements-2026-signed-by-council.pdf';
export const URALLA_PDF_SHA256 = '59cea26584613a39c6766c0ab62e9368ba34c0ea28299588492a9102b42927f8';
export const URALLA_PDF_BYTES = 1_293_828;

export const URALLA_INCOME_TEXT =
  "§Statement§  Original unaudited budget   Actual   Actual  2026   $ '000   Notes   2026   2025  Income from continuing operations  8,949   Rates and annual charges   B2-1   8,953   8,433 6,732   User charges and fees   B2-2   6,216   5,739 583   Other revenues   B2-3   1,119   1,060 11,767   Grants and contributions provided for operating purposes   B2-4   13,108   9,163 1,719   Grants and contributions provided for capital purposes   B2-4   2,739   1,877 687   Interest and investment income   B2-5   1,246   1,495 314   Net gain from the disposal of assets   B4-1   –   –  30,751   Total income from continuing operations   33,381   27,767  Expenses from continuing operations  15,568   Employee benefits and on-costs   B3-1   15,779   13,653 8,264   Materials and services   B3-2   10,948   9,006 86   Borrowing costs   B3-3   244   298 579   Other expenses   B3-5   362   789 –   Net loss from the disposal of assets   B4-1   1,296   1,931  24,497  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   28,629   25,677 6,254  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   4,752   2,090  6,454 Depreciation, amortisation and impairment of non-financial assets   B3-4   7,069   7,430  (200)   Operating result from continuing operations   (2,317)   (5,340)  (200)   Net operating result for the year attributable to Council   (2,317)   (5,340)  (1,919)  Net operating result for the year before grants and contributions provided for capital purposes   (5,056)   (7,217)  The above Income Statement should be read in conjunction with the accompanying notes.  Uralla Shire Council Income Statement  for the year ended 30 June 2026 Page 4 of 76";

export const URALLA_COMPREHENSIVE_TEXT =
  "§Note/Subtotal§  $ '000   Notes   2026   2025  Net operating result for the year – from Income Statement   (2,317)   (5,340)  §Subnote§  Other comprehensive income:  Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment   C1-7   18,821   44,965  Total items which will not be reclassified subsequent to operating result   18,821   44,965  Total other comprehensive income for the year   18,821   44,965  Total comprehensive income for the year attributable to Council   16,504   39,625  The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  Uralla Shire Council Statement of Comprehensive Income  for the year ended 30 June 2026 Page 5 of 76";

export const URALLA_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses   Operating result   Grants and contributions   Carrying amount of assets $ '000   2026   2025   2026   2025   2026   2025   2026   2025   2026   2025  Functions or activities  Our Society   10,708   9,122   11,347   11,102   (639)   (1,980)   6,016   5,064   36,084   27,717 Our Economy   6,666   4,885   12,542   10,786   (5,876)   (5,901)   5,949   3,939   290,056   283,882 Our Environment   6,953   6,354   8,581   8,882   (1,628)   (2,528)   563   425   57,338   55,410 Our Leadership   9,054   7,406   3,228   2,337   5,826   5,069   3,319   1,612   11,669   12,535  Total functions and activities   33,381   27,767   35,698   33,107   (2,317)   (5,340)   15,847   11,040   395,147   379,544  Uralla Shire Council Notes to the Financial Statements  for the year ended 30 June 2026  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 13 of 76";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function urallaExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: URALLA_PDF_SHA256,
      bytes: URALLA_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? URALLA_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? URALLA_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? URALLA_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const URALLA_CONTEXT: UrallaGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Financial Statements for the year ended 30 June 2026',
    url: URALLA_PDF_URL,
    fiscal_year: URALLA_GPFS_FISCAL_YEAR,
    listing_url: URALLA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'uralla-gpfs/Uralla-Financial-Statements-2026-signed.pdf',
    sha256: URALLA_PDF_SHA256,
    bytes: URALLA_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: URALLA_GPFS_REPORTING_URL,
};

/** Golden fixture for the uralla-gpfs module: 16 rows. */
export const URALLA_GPFS_ROW_COUNT = 16;
export const URALLA_GPFS_GOLDEN_DIGEST =
  '3e85c885bc67b9a3c5ee9037d250f500a5f7917edaa75fcd1b8f672755aa6ac0';
export const ROW_COUNT = URALLA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = URALLA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseUrallaGpfsExtraction(urallaExtraction(), URALLA_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
