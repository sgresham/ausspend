import {
  LISMORE_GPFS_FISCAL_YEAR,
  LISMORE_GPFS_REPORTING_URL,
  parseLismoreGpfsExtraction,
  type LismoreGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Lismore City Council Annual Report
// 2024/25 (74 pages). Page 3 is the contents, whose last listed section is
// Statutory Information; page 5 says the annual report must contain financial
// statements; page 74 is the back cover. No page is an audited GPFS Income
// Statement/Statement of Comprehensive Income/Statement of Financial
// Position/Statement of Cash Flows/B1-1, so the connector defers with 0 rows and
// records the exact gap. The separate current-year Financial reports PDF is not
// part of this fixture.
export const LISMORE_PDF_URL =
  'https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/6.-corporate-information/lcc-annual-report-2024-25-a4.pdf';
export const LISMORE_PDF_SHA256 =
  'a6ff496fa5bfa9468088923e7ce880f86bf2132d55076934632da7927ee64a86';
export const LISMORE_PDF_BYTES = 10228662;

export const LISMORE_CONTENTS_TEXT = `Contents Acknowledgment of country 2 Lismore is the geographic centre of the Northern Rivers region 5 Lismore’s strength is it’s diverse and resilient people 6 Lismore is building back better following natural disaster events 7 An advocacy agenda for our city 8 Our key areas of focus will leverage our potential 9 1. Disaster mitigation and recovery 10 2. Enhancing Infrastructure Investment 15 3. Homes for the community 18 4. Destination and Events 20 Contents Mayor’s Message 6 General Manager’s Message 7 About Lismore 9 Rebuilding Lismore 18 Delivery Program Achievements 20 Statutory Information 30 3 | LCC Annual Report 2024-2025`;

export const LISMORE_CLAIM_TEXT = `Executive summary Lismore City Council is proud to present our Annual Report for the financial year to 30 June 2025. This report serves as a critical component of the Integrated Planning and Reporting (IP&R) framework, providing a comprehensive overview of Council’s performance over the past 12 months. It aligns Council’s activities with our five community priorities as set out in the Community Strategic Plan 2022–2032. These are: • An inclusive and healthy community • A prosperous and vibrant city • Our natural environment • Our built environment • Leadership and participation In addition to the above, the Annual Report must also contain Statutory Reporting Information and Financial Statements as required by the Local Government Act 1993 (NSW). This is the final Annual Report addressing the Imagine Lismore Community Strategic Plan 2022 – 2032 .`;

export const LISMORE_BACK_COVER_TEXT = `lismorecitycouncil.nsw.gov.au yoursay.lismore.nsw.gov.au`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function lismoreExtraction(): PdfExtraction {
  return {
    source: {
      sha256: LISMORE_PDF_SHA256,
      bytes: LISMORE_PDF_BYTES,
    },
    pages: [
      pdfPage(LISMORE_CONTENTS_TEXT, 3),
      pdfPage(LISMORE_CLAIM_TEXT, 5),
      pdfPage(LISMORE_BACK_COVER_TEXT, 74),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const LISMORE_CONTEXT: LismoreGpfsParseContext = {
  document: {
    id: 'annual-report-2024-25',
    title: 'Annual Report 2024/25',
    url: LISMORE_PDF_URL,
    fiscal_year: LISMORE_GPFS_FISCAL_YEAR,
    listing_url: LISMORE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'lismore-gpfs/lcc-annual-report-2024-25-a4.pdf',
    sha256: LISMORE_PDF_SHA256,
    bytes: LISMORE_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: LISMORE_GPFS_REPORTING_URL,
};

/** The annual report has no audited GPFS section, so the fixture is 0 rows. */
export const LISMORE_GPFS_ROW_COUNT = 0;
export const LISMORE_GPFS_GOLDEN_DIGEST =
  '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
export const ROW_COUNT = LISMORE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = LISMORE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseLismoreGpfsExtraction(lismoreExtraction(), LISMORE_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
