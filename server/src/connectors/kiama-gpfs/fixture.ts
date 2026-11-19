import {
  KIAMA_GPFS_FISCAL_YEAR,
  KIAMA_GPFS_REPORTING_URL,
  parseKiamaGpfsExtraction,
  type KiamaGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Kiama Municipal Council Annual Report
// 2024-25 (92 pages). Page 19 is the un-audited "Consolidated operating results"
// summary; page 91 is the "Authorisation and version control" page that ends the
// report. Neither page is an audited GPFS Income Statement/Statement of
// Comprehensive Income/Statement of Financial Position/Statement of Cash
// Flows/B1-1, so the connector defers with 0 rows and records the exact gap. The
// separate current-year Financial Statements PDF is not part of this fixture.
export const KIAMA_PDF_URL =
  'https://www.kiama.nsw.gov.au/files/sharedassets/public/v/2/council/council-plans-amp-reports/2024-25-annual-report-final.pdf';
export const KIAMA_PDF_SHA256 = 'dd65cda214df712a9cd3f02f8fcb3c3cb17dd73c58584438d7ab15b01ebbb8ea';
export const KIAMA_PDF_BYTES = 15525717;

export const KIAMA_CONTENTS_TEXT = `— KIAMA MUNICIPAL COUNCIL ANNUAL REPORT 2024-25 3 Contents Acknowledgement of country 2 Contents 3 Vision, mission, values 4 Message from the Mayor 5 Our Mayor and Councillors 6 Our municipality 8 Our organisation 10 Message from the CEO 11 Facilities and assets 12 A snapshot of Council activity 13 Councillor and executive highlights 2024-2025 financial year 15 Plans and strategies guiding Council's actions 16 About this report 17 Meet our Executive Leadership Team 2024-2025 18 Consolidated operating results 2024-2025 19 Pillar 1 20 Pillar 2 29 Pillar 3 35 Pillar 4 40 Pillar 5 43 Blue Haven Update 50 Audit, Risk and Improvement Committee Annual Report 54 Other required information 65 Authorisation and version control 91`;

export const KIAMA_SUMMARY_TEXT = `— KIAMA MUNICIPAL COUNCIL ANNUAL REPORT 2024-25 19 Consolidated operating results 2024-2025 Consolidated Operating Results ($) $’000 Actual 2024-2025 Budget 2024-2025 Variance 2024-2025 Income from continuing operations Rates and annual charges User charges and fees Other revenues Grants and contributions provided for operating purposes Grants and contributions provided for capital purposes Interest and investment income Other income 28,741 19,567 4,329 3,454 15,517 2,382 92 29,179 19,809 3,518 3,784 4,515 1,839 0 (438) (242) 811 (330) 11,002 543 92 Total income for continuing operations 74,082 62,644 11,438 Expenses from continuing operations Employee benefits and on-costs Materials and services Borrowing costs Other expenses Net loss from the disposal of assets 30,853 30,044 177 1,135 1,063 26,478 26,427 138 1,049 (2,946) 4,375 3,617 39 86 4,009 Total expenses from continuing operations 63,272 51,146 12,126 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 10,810 11,498 (688) Depreciation, amortisation and impairment of non-financial assets 11,557 9,600 1,957 Operating results from continuing operations (747) 1,898 (2,645) Discontinued operations Operating result from discontinued operations (6,643) (234) (6,409) Net operating result for the year attributable to Council (7,309) 1,664 (9,054) Net operating result for the year before grants and contributions provided for capital purposes (22,907) (2,529) (20,378)`;

export const KIAMA_AUTHORISATION_TEXT = `— KIAMA MUNICIPAL COUNCIL ANNUAL REPORT 2024-25 91 Authorisation and version control Owner/Responsible Officer Manager People and Performance Department People and Performance Date adopted/endorsed 18 November 2025 Resolution number (if applicable) N/A Next review date N/A TRIM reference 25/105448 Date reviewed Date adopted/endorsed Brief detail of amendments All information is correct at the time of writing and publication.`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function kiamaExtraction(): PdfExtraction {
  return {
    source: {
      sha256: KIAMA_PDF_SHA256,
      bytes: KIAMA_PDF_BYTES,
    },
    pages: [
      pdfPage(KIAMA_CONTENTS_TEXT, 3),
      pdfPage(KIAMA_SUMMARY_TEXT, 19),
      pdfPage(KIAMA_AUTHORISATION_TEXT, 91),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const KIAMA_CONTEXT: KiamaGpfsParseContext = {
  document: {
    id: 'annual-report-2024-25',
    title: 'Annual Report 2024-25',
    url: KIAMA_PDF_URL,
    fiscal_year: KIAMA_GPFS_FISCAL_YEAR,
    listing_url: KIAMA_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'kiama-gpfs/2024-25-annual-report-final.pdf',
    sha256: KIAMA_PDF_SHA256,
    bytes: KIAMA_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: KIAMA_GPFS_REPORTING_URL,
};

/** The annual report has no audited GPFS section, so the fixture is 0 rows. */
export const KIAMA_GPFS_ROW_COUNT = 0;
export const KIAMA_GPFS_GOLDEN_DIGEST =
  '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
export const ROW_COUNT = KIAMA_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = KIAMA_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseKiamaGpfsExtraction(kiamaExtraction(), KIAMA_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
