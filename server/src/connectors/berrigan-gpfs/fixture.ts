import {
  BERRIGAN_GPFS_FISCAL_YEAR,
  BERRIGAN_GPFS_REPORTING_URL,
  parseBerriganGpfsExtraction,
  type BerriganGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (Financial Statements PDF pp. 5, 6 and 14 of 98). The face Income Statement
// prints the Original unaudited budget column before each line label, with
// Actual 2026 and Actual 2025 after it. The face statement reconciles
// internally: revenue 34,055, expenses excluding depreciation 22,614,
// depreciation 10,128, total expenses 32,742, net result 1,313, before-capital
// -1,212, and OCI revaluation 13,902. The printed B1-1 "Total functions and
// activities" row reports expenses 32,741 and operating result 1,314 — a $1
// thousand difference — so the connector defers with 0 rows and records the
// exact gap rather than adjusting or fabricating figures.
export const BERRIGAN_PDF_URL =
  'https://www.berriganshire.nsw.gov.au/files/assets/public/v/1/01-council/gov.-amp-transparency/annual_financial_statements-2026-final.pdf';
export const BERRIGAN_PDF_SHA256 =
  '4e9e95ee9b78572e70c8b125b472c01b764f91bc2784a26b7eae66a91cb28a68';
export const BERRIGAN_PDF_BYTES = 1594806;

export const BERRIGAN_INCOME_TEXT =
  `Berrigan Shire Council | Income Statement | for the year ended 30 June 2026 Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 14,191 Rates and annual charges B2-1 14,011 13,193 2,311 User charges and fees B2-2 3,282 3,343 497 Other revenue B2-3 1,217 650 7,627 Grants and contributions provided for operating purposes B2-4 11,339 6,811 2,493 Grants and contributions provided for capital purposes B2-4 2,525 1,707 1,113 Interest and investment income B2-5 1,464 1,683 129 Other income B2-6 217 184 28,361 Total income from continuing operations 34,055 27,571 Expenses from continuing operations 12,691 Employee benefits and on-costs B3-1 11,185 10,984 3,330 Materials and services B3-2 10,195 9,647 41 Borrowing costs B3-3 46 90 713 Other expenses B3-5 883 1,395 – Net loss from the disposal of assets B4-1 305 1,834 16,775 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 22,614 23,950 11,586 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 11,441 3,621 9,072 Depreciation, amortisation and impairment of non-financial assets B3-4 10,128 8,997 2,514 Net operating result for the year attributable to Council 1,313 (5,376) 21 Net operating result for the year before grants and contributions provided for capital purposes (1,212) (7,083) The above Income Statement should be read in conjunction with the accompanying notes. Berrigan Shire Council Income Statement for the year ended 30 June 2026 Page 4 of 75`;

export const BERRIGAN_COMPREHENSIVE_TEXT =
  `Berrigan Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 1,313 (5,376) Other comprehensive income: Amounts that will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-6 13,902 18,371 Other comprehensive income for the year 13,902 18,371 Total comprehensive income for the year attributable to Council 15,215 12,995 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Berrigan Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5 of 75`;

export const BERRIGAN_FUNCTIONS_TEXT =
  `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 $ '000 Restated Restated Functions or activities Our Environment 249 202 37 241 212 (39) 123 254 – – Our Civic Leadership 10,517 8,515 5,852 10,175 4,665 (1,660) 6,785 4,425 – – Our Community 7,196 5,826 5,303 6,962 1,893 (1,136) 945 251 – – Our Economy 5,059 4,095 8,198 4,894 (3,139) (799) 55 406 – – Our Infrastructure 11,034 8,933 13,351 10,675 (2,317) (1,742) 5,956 3,182 520,649 508,786 Total functions and activities 34,055 27,571 32,741 32,947 1,314 (5,376) 13,864 8,518 520,649 508,786 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 75 Berrigan Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function berriganExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: BERRIGAN_PDF_SHA256,
      bytes: BERRIGAN_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? BERRIGAN_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? BERRIGAN_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? BERRIGAN_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BERRIGAN_CONTEXT: BerriganGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Berrigan Shire Council Annual Financial Statements 2026 Final',
    url: BERRIGAN_PDF_URL,
    fiscal_year: BERRIGAN_GPFS_FISCAL_YEAR,
    listing_url: BERRIGAN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      'berrigan-gpfs/annual_financial_statements-2026-final.pdf',
    sha256: BERRIGAN_PDF_SHA256,
    bytes: BERRIGAN_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: BERRIGAN_GPFS_REPORTING_URL,
};

/** The printed B1-1 / face bridge is not exact, so the connector defers: 0 rows. */
export const BERRIGAN_GPFS_ROW_COUNT = 0;
export const BERRIGAN_GPFS_GOLDEN_DIGEST =
  '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
export const ROW_COUNT = BERRIGAN_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BERRIGAN_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBerriganGpfsExtraction(
    berriganExtraction(),
    BERRIGAN_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
