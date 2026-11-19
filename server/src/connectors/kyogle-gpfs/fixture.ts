import {
  KYOGLE_GPFS_FISCAL_YEAR,
  KYOGLE_GPFS_REPORTING_URL,
  parseKyogleGpfsExtraction,
  type KyogleGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived FY2025-26 PDF (PDF
// pp. 5, 6 and 14 of 107). The Income Statement prints the Original unaudited
// budget column before each line label, with Actual 2026 and Actual 2025 after
// it. A parser that took the first number in the line would read the budget;
// the expected values are all Actual 2026. Kyogle prints six non-zero revenue
// lines (its net gain on disposal is nil) and five expense lines (including
// borrowing costs and a net loss on disposal). The net result and the printed
// before-capital result are both positive.
export const KYOGLE_PDF_URL =
  'https://www.kyogle.nsw.gov.au/sites/default/files/2026-11/2025-2026%20Annual%20Financial%20Statements.pdf';
export const KYOGLE_PDF_SHA256 = 'a18538da7a8b093c25b43a8432b2022559eb11c8c54c2809c4e3c04079b614db';
export const KYOGLE_PDF_BYTES = 3_552_048;

export const KYOGLE_INCOME_TEXT =
  "Kyogle Council | Income Statement | for the year ended 30 June 2026 §Statement§  Original unaudited budget   Actual   Actual  2026   $ '000   Notes   2026   2025  Income from continuing operations  13,991   Rates and annual charges   B2-1   14,019   13,413 12,370   User charges and fees   B2-2   13,891   11,131 3,004   Other revenues   B2-3   84   39 6,484   Grants and contributions provided for operating purposes   B2-4   13,212   5,953 98,322   Grants and contributions provided for capital purposes   B2-4   63,823   60,503 1,752   Interest and investment income   B2-5   2,021   1,767 648   Net gain from the disposal of assets   B4-1   –   –  136,571   Total income from continuing operations   107,050   92,806  Expenses from continuing operations  12,361   Employee benefits and on-costs   B3-1   11,945   11,877 10,689   Materials and services   B3-2   16,445   16,092 349   Borrowing costs   B3-3   204   233 3,060   Other expenses   B3-5   350   355 –   Net loss from the disposal of assets   B4-1   66   1,247  26,459  Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   29,010   29,804 110,112  Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets   78,040   63,002  10,851 Depreciation, amortisation and impairment of non-financial assets   B3-4   11,342   11,322  99,261   Operating result from continuing operations   66,698   51,680  99,261   Net operating result for the year attributable to Council   66,698   51,680  939  Net operating result for the year before grants and contributions provided for capital purposes   2,875   (8,823)  The above Income Statement should be read in conjunction with the accompanying notes.  Kyogle Council Income Statement  for the year ended 30 June 2026 Page 4 of 77";

export const KYOGLE_COMPREHENSIVE_TEXT =
  "Kyogle Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§  $ '000   Notes   2026   2025  Net operating result for the year – from Income Statement   66,698   51,680  §Subnote§  Other comprehensive income:  Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment   C1-6   38,663   32,033 Impairment (loss) reversal / (revaluation decrement) relating to infrastructure, property, plant and equipment   C1-6   (4,040)   (4,739)  Total items which will not be reclassified subsequent to operating result   34,623   27,294  Total other comprehensive income for the year   34,623   27,294  Total comprehensive income for the year attributable to Council   101,321   78,974  The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes.  Kyogle Council Statement of Comprehensive Income  for the year ended 30 June 2026 Page 5 of 77";

export const KYOGLE_FUNCTIONS_TEXT =
  "Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2.  Income   Expenses   Operating result   Grants and contributions   Carrying amount of assets $ '000   2026   2025   2026   2025   2026   2025   2026   2025   2026   2025  Functions or activities  Governance   –   –   601   574   (601)   (574)   –   –   –   – Administration   46   45   2,045   1,857   (1,999)   (1,812)   46   –   37,786   24,003 Personnel   133   219   1,246   1,387   (1,113)   (1,168)   41   40   –   – Finance   16,711   13,033   937   913   15,774   12,120   5,908   2,812   –   – Crown reserves   (167)   74   309   225   (476)   (151)   (167)   74   –   – Town planning   264   178   477   405   (213)   (227)   –   (13)   –   – Environmental health   327   364   1,247   850   (920)   (486)   150   197   91   55 Building control   52   52   75   113   (23)   (61)   –   –   –   – Animal control   29   32   317   261   (288)   (229)   –   –   56   57 Other waste management   1,247   1,292   1,492   1,197   (245)   95   –   (4)   1,588   1,542 Strategic, community & cultural services   58   66   919   1,012   (861)   (946)   52   61   –   1,761 Pre schools   –   –   70   68   (70)   (68)   –   –   –   – Public libraries   95   94   605   606   (510)   (512)   95   94   –   1 Regional roads   21,823   24,456   1,997   2,756   19,826   21,700   21,823   24,456   101,127   66,541 Urban roads   2,380   2,079   1,427   1,423   953   656   2,380   2,080   28,181   17,948 Rural roads   30,333   19,329   7,219   10,270   23,114   9,059   30,333   19,329   342,288   299,618 Bridges   8,648   13,961   1,811   1,762   6,837   12,199   8,648   13,953   241,947   221,927 Emergency services   155   19   920   874   (765)   (855)   155   19   4,754   4,765 Swimming pools   183   181   938   992   (755)   (811)   –   –   4,382   4,237 Parks & gardens   2,478   2,563   1,198   1,262   1,280   1,301   2,472   2,562   11,381   9,024 Community buildings   1,731   457   380   434   1,351   23   1,600   346   15,772   12,362 Public cemeteries   157   416   218   312   (61)   104   (1)   257   466   654 Stormwater drainage   651   225   153   225   498   –   421   5   33,940   32,946 Engineering administration   46   39   (1,835)   (1,878)   1,881   1,917   –   –   –   – Water supplies   4,200   2,089   1,593   1,845   2,607   244   1,934   90   29,885   27,082 Sewerage services   3,483   2,164   1,273   1,424   2,210   740   1,119   98   42,028   39,316 Domestic waste management   1,411   1,396   1,492   1,495   (81)   (99)   –   –   (37)   43 State highways   10,527   7,947   10,449   8,099   78   (152)   –   –   (371)   (448) Quarries   –   –   291   588   (291)   (588)   –   –   1,116   1,808 Plant fund   49   36   488   (225)   (439)   261   26   –   13,649   14,123  Total functions and activities   107,050   92,806   40,352   41,126   66,698   51,680   77,035   66,456   910,029   779,365 B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets Page 13 of 77 Kyogle Council | Notes to the Financial Statements 30 June 2026  B   Financial Performance  B1   Functions or activities  B1-1   Functions or activities – income, expenses and assets";

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function kyogleExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: KYOGLE_PDF_SHA256,
      bytes: KYOGLE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? KYOGLE_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? KYOGLE_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? KYOGLE_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const KYOGLE_CONTEXT: KyogleGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: '2025-2026 Annual Financial Statements',
    url: KYOGLE_PDF_URL,
    fiscal_year: KYOGLE_GPFS_FISCAL_YEAR,
    listing_url: KYOGLE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'kyogle-gpfs/Kyogle-2025-2026-Annual-Financial-Statements.pdf',
    sha256: KYOGLE_PDF_SHA256,
    bytes: KYOGLE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: KYOGLE_GPFS_REPORTING_URL,
};

/** Golden fixture for the kyogle-gpfs module: 16 rows. */
export const KYOGLE_GPFS_ROW_COUNT = 16;
export const KYOGLE_GPFS_GOLDEN_DIGEST =
  '373750df93a92af414c9c6a75737abb1f5e5178ad5e047f74df0e9c53c1ad039';
export const ROW_COUNT = KYOGLE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = KYOGLE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseKyogleGpfsExtraction(kyogleExtraction(), KYOGLE_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
