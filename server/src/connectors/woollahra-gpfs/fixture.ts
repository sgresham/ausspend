import { createHash } from 'node:crypto';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';
import {
  WOOLLAHRA_GPFS_FISCAL_YEAR,
  WOOLLAHRA_GPFS_REPORTING_URL,
  parseWoollahraGpfsExtraction,
  type WoollahraParseContext,
} from './index.js';

// Text reconstructed from the audited Woollahra Municipal Council FY2024-25
// General Purpose Financial Statements (Annual Report Part 3). Kept as literal
// text so the parser is tested against the printed layout, not a hand-built
// object. The Income Statement prints the Original unaudited budget column
// after the previous line and before the line label, so each emitted value is
// the first amount after the label (the FY2024-25 actual); the second is
// FY2023-24. The B1-1 function table prints Income, Expenses, Operating result,
// Grants and contributions and Carrying amount for 2025 and 2024; only the
// printed expense column is emitted, together with the printed B1-1 total.
export const WOOLLAHRA_PDF_URL =
  'https://www.woollahra.nsw.gov.au/files/assets/public/v/2/council/documents/annual-report-fy24-25-part-3.pdf';
export const WOOLLAHRA_PDF_SHA256 =
  'f92a0e41248573b4a71b417229d74b6c652039716fb1d4f216a7c316779f738b';
export const WOOLLAHRA_PDF_BYTES = 5_812_977;

export const INCOME_TEXT = `Woollahra Municipal Council | Income Statement | for the year ended 30 June 2025 Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 70,681 Rates and annual charges B2-1 70,552 66,136 14,655 User charges and fees B2-2 16,689 15,565 16,941 Other revenues B2-3 15,347 16,230 5,014 Grants and contributions provided for operating purposes B2-4 4,615 5,676 2,897 Grants and contributions provided for capital purposes B2-4 8,612 16,212 3,223 Interest and investment income 6,103 5,626 17,920 Other income B2-5 17,655 17,608 1,200 Fair value increment/ (decrement) on investment properties C1-6 19 (6,683) 132,531 Total income from continuing operations 139,592 136,370 Expenses from continuing operations 53,223 Employee benefits and on-costs B3-1 52,968 47,706 48,496 Materials and services B3-2 51,840 50,408 3,014 Borrowing costs 1,745 1,806 5,041 Other expenses 4,717 4,807 1,685 Net loss from the disposal of assets 1,946 2,538 111,459 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 113,216 107,265 21,072 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 26,376 29,105 16,948 Depreciation, amortisation and impairment of non-financial assets B3-3 16,413 15,348 4,124 Operating result from continuing operations 9,963 13,757 4,124 Net operating result for the year attributable to Council 9,963 13,757 1,228 Net operating result for the year before grants and contributions provided for capital purposes 1,351 (2,455) The above Income Statement should be read in conjunction with the accompanying notes. Woollahra Municipal Council Income Statement for the year ended 30 June 2025 Page 4`;

export const COMPREHENSIVE_TEXT = `Woollahra Municipal Council | Statement of Comprehensive Income | for the year ended 30 June 2025 $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 9,963 13,757 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 61,560 20,875 Total items which will not be reclassified subsequent to operating result 61,560 20,875 Total other comprehensive income for the year 61,560 20,875 Total comprehensive income for the year attributable to Council 71,523 34,632 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Woollahra Municipal Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5`;

export const FUNCTIONS_TEXT = `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities A connected and harmonious community 6 6 449 432 (443) (426) 1 2 13,177 14,124 A supported community 2,092 1,915 3,762 3,562 (1,670) (1,647) 1,594 1,573 4,296 4,008 A creative and vibrant community 920 909 8,587 8,093 (7,667) (7,184) 553 587 12,203 13,127 Well planned neighbourhoods 4,663 3,996 9,178 9,943 (4,515) (5,947) 12 149 841 482 Liveable places 10,659 16,305 36,868 35,093 (26,209) (18,788) 1,718 7,233 817,245 773,942 Getting around 15,481 16,683 4,918 4,850 10,563 11,833 599 1,396 132,932 123,925 Protecting our environment 391 379 3,136 3,028 (2,745) (2,649) 20 18 79,549 75,475 Sustainable use of resources 19,990 19,107 14,397 13,343 5,593 5,764 1 – 3,780 3,775 Community focused economic development 13,630 7,082 8,136 10,750 5,494 (3,668) 1,742 1,198 180,501 180,154 Working together 3 17 1,741 1,722 (1,738) (1,705) 1 – 53 59 Well managed Council 71,757 69,971 38,457 31,797 33,300 38,174 6,986 9,732 96,112 86,467 General purpose – – – – – – – – 126,873 115,076 Total functions and activities 139,592 136,370 129,629 122,613 9,963 13,757 13,227 21,888 1,467,562 1,390,614 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 Woollahra Municipal Council | Notes to the Financial Statements 30 June 2025`;

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function woollahraExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      url: WOOLLAHRA_PDF_URL,
      sha256: WOOLLAHRA_PDF_SHA256,
      bytes: WOOLLAHRA_PDF_BYTES,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 6),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 7),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const WOOLLAHRA_CONTEXT: WoollahraParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Woollahra Municipal Council General Purpose Financial Statements 2024-2025',
    url: WOOLLAHRA_PDF_URL,
    fiscal_year: WOOLLAHRA_GPFS_FISCAL_YEAR,
    listing_url: WOOLLAHRA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/woollahra-gpfs/woollahra-annual-report-2024-25-part-3-general-purpose-financial-statements.pdf',
    sha256: WOOLLAHRA_PDF_SHA256,
    bytes: WOOLLAHRA_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: WOOLLAHRA_GPFS_REPORTING_URL,
};

/** Golden fixture for the woollahra-gpfs module: 29 rows, unchanged keys/amounts. */
export const WOOLLAHRA_GPFS_ROW_COUNT = 29;
export const ROW_COUNT = 29;
export const GOLDEN_DIGEST = '4046c9c5322371411ade01e8a3f3785f5d32a087fa5fab8f492851408f1fd54e';

export function goldenRecords() {
  const parsed = parseWoollahraGpfsExtraction(woollahraExtraction(), WOOLLAHRA_CONTEXT);
  return parsed.records;
}

export function goldenDigest(records = goldenRecords()): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        records.map((record) => ({
          natural_key: record.natural_key,
          amount_cents: record.amount_cents,
        })),
      ),
    )
    .digest('hex');
}
