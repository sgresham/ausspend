import {
  BOGAN_GPFS_FISCAL_YEAR,
  BOGAN_GPFS_REPORTING_URL,
  parseBoganGpfsExtraction,
  type BoganGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived FY2025-26 PDF (PDF
// pp. 6, 7 and 15 of 104). The Income Statement prints the Original unaudited
// budget column before each line label, with Actual 2026 and Actual 2025 after
// it. A parser that took the first number in the line would read the budget;
// the expected values are all Actual 2026. Bogan prints eight revenue lines
// (including a net gain on disposal) and four expense lines (including
// borrowing costs). The net result is positive and the printed before-capital
// result is negative.
export const BOGAN_PDF_URL =
  'https://bogan.nsw.gov.au/ArticleDocuments/517/14.10.2026%20Annual_Financial_Statements-2026.pdf.aspx';
export const BOGAN_PDF_SHA256 = '02132e1e7c7b6d4da20b5b8e2e14d26918fab026b1f64d0f59513fd846f0a779';
export const BOGAN_PDF_BYTES = 1_847_355;

export const BOGAN_INCOME_TEXT =
  "Bogan Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§  Original unaudited budget   Actual   Actual  2026   2026   2025  $ '000   Notes   $ '000   $ '000  Income from continuing operations  5,853   Rates and annual charges   B2-1   5,935   5,686 4,995   User charges and fees   B2-2   8,235   7,458 209   Other revenues   B2-3   261   365 13,868   Grants and contributions provided for operating purposes   B2-4   13,436   10,462 1,607   Grants and contributions provided for capital purposes   B2-4   6,701   6,984 1,017   Interest and investment income   B2-5   1,363   1,531 1,626   Other income   B2-6   298   293 732   Net gain from the disposal of assets   B4-1   158   288  29,907   Total income from continuing operations   36,387   33,067  Expenses from continuing operations  11,350   Employee benefits and on-costs   B3-1   10,020   9,436 10,892   Materials and services   B3-2   13,597   14,473 56   Borrowing costs   B3-3   54   59 2,264   Other expenses   B3-5   265   302  24,562  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   23,936   24,270 5,345  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   12,451   8,797  4,814 Depreciation, amortisation and impairment of non-financial assets   B3-4   6,659   5,832  531   Operating result from continuing operations   5,792   2,965  531   Net operating result for the year attributable to Council   5,792   2,965  (1,076)  Net operating result for the year before grants and contributions provided for capital purposes   (909)   (4,019)  The above Income Statement should be read in conjunction with the accompanying notes.  Bogan Shire Council Income Statement  for the year ended 30 June 2026 Page 5";

export const BOGAN_COMPREHENSIVE_TEXT =
  "Bogan Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§  Actual   Actual  2026   2025  Notes   $ '000   $ '000  Net operating result for the year – from Income Statement   5,792   2,965  §Subnote§  Other comprehensive income:  Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment   C1-6   15,304   11,483  Total items which will not be reclassified subsequent to operating result   15,304   11,483  Total other comprehensive income for the year   15,304   11,483  Total comprehensive income for the year attributable to Council   21,096   14,448  The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  Bogan Shire Council Statement of Comprehensive Income  for the year ended 30 June 2026 Page 6";

export const BOGAN_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§  Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses   Operating result   Grants and contributions   Carrying amount of assets 2026   2025   2026   2025   2026   2025   2026   2025   2026   2025  $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000   $ '000  Functions or activities  Civic Leadership – Leadership, Advocacy & Governance   –   –   742   906   (742)   (906)   228   –   –   – Civic Leadership – Managing Our Business   10,738   7,654   2,083   2,016   8,655   5,638   6,022   2,883   35,251   34,457 Economic – Local Industries & Business   124   70   95   86   29   (16)   124   69   592   605 Economic – Public Transport & Air Services   13   2   115   120   (102)   (118)   10   –   516   511 Economic – Tourism   21   19   177   156   (156)   (137)   –   –   –   – Environmental – Built Environment   281   468   2,247   2,290   (1,966)   (1,822)   68   339   5,066   3,827 Environmental – Health, Safety & Regulation   387   319   815   781   (428)   (462)   147   294   36   35 Environmental – Natural Environment   201   83   448   321   (247)   (238)   102   78   –   – Environmental – Waste & Recycling   1,109   1,159   1,082   1,053   27   106   –   –   723   688 Infrastructure – Sewer   754   670   854   874   (100)   (204)   71   –   17,025   16,744 Infrastructure – Transport Networks   12,512   12,783   12,106   11,886   406   897   7,946   8,224   224,362   213,671 Infrastructure – Water   5,149   4,378   2,814   3,103   2,335   1,275   2,260   1,898   61,415   57,748 Social – Community Centres   426   1,539   1,831   1,552   (1,405)   (13)   322   1,439   29,397   28,247 Social – Education   –   –   2   2   (2)   (2)   –   –   –   – Social – Emergency Services   95   187   332   354   (237)   (167)   95   187   1,441   1,404 Social – Inclusive Communities   2,622   2,411   2,441   2,176   181   235   2,148   1,917   3,481   3,257 Social – Public Health   1,938   1,279   2,169   2,063   (231)   (784)   580   77   3,277   3,103 Social – Social & Cultural   17   46   242   363   (225)   (317)   14   41   188   183  Total functions and activities   36,387   33,067   30,595   30,102   5,792   2,965   20,137   17,446   382,770   364,480  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 14 Bogan Shire Council | Notes to the Financial Statements 30 June 2026";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function boganExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BOGAN_PDF_SHA256,
      bytes: BOGAN_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BOGAN_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? BOGAN_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? BOGAN_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BOGAN_CONTEXT: BoganGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Annual Financial Statements 2025-26',
    url: BOGAN_PDF_URL,
    fiscal_year: BOGAN_GPFS_FISCAL_YEAR,
    listing_url: BOGAN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'bogan-gpfs/Bogan-Annual-Financial-Statements-2026.pdf',
    sha256: BOGAN_PDF_SHA256,
    bytes: BOGAN_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BOGAN_GPFS_REPORTING_URL,
};

/** Golden fixture for the bogan-gpfs module: 17 rows. */
export const BOGAN_GPFS_ROW_COUNT = 17;
export const BOGAN_GPFS_GOLDEN_DIGEST =
  '9ae33d9918c46d43f94f01e2ec7f18193c6fec94d8e976b69fa3a88d00a44a95';
export const ROW_COUNT = BOGAN_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BOGAN_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBoganGpfsExtraction(boganExtraction(), BOGAN_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
