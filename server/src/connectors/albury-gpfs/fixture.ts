import {
  ALBURY_GPFS_FISCAL_YEAR,
  ALBURY_GPFS_REPORTING_URL,
  parseAlburyGpfsExtraction,
  type AlburyGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official AlburyCity Annual Report 2024-2025
// (132 pages). Page 94 is the "Our Accountability" page whose "Audited Financial
// Statements for the Year Ended 30 June 2025" paragraph says the full audited
// financial statements can be viewed on the council website. Page 32 is the
// narrative Financial Snapshot summary (Operating Income 197,575; Operating
// Expenditure 179,413; component breakdown). Neither page is an audited GPFS
// Income Statement/Statement of Comprehensive Income/B1-1, so the connector
// defers with 0 rows and records the exact gap.
export const ALBURY_PDF_URL =
  'https://eservice.alburycity.nsw.gov.au/ACCPublicDocs/RecordURI?URI=5168648';
export const ALBURY_PDF_SHA256 =
  '40bd0a9efb04e6f78ae1e288140d282ef8fb918ffd6beb22ce603e04f5c7156f';
export const ALBURY_PDF_BYTES = 18452240;

export const ALBURY_ACCOUNTABILITY_TEXT =
  `AlburyCity Annual Report 2024-2025 Our Accountability We are proud to share our achievements that have occurred over the last year, but we also want to share information on our activities that make us accountable for our actions. As a council we are required to maintain accountability and transparency by regular reporting and monitoring. The Integrated Planning and Reporting Framework outlines activities that must be included in the Annual Report. We have provided a separate Regulatory Report (Appendix 1) to the Annual Report that includes information prescribed by the Local Government (General) Regulation 2005. This information demonstrates how we have been performing as a service provider and a community leader. You can view the Regulatory Report on our website. In the Regulatory Report you will find our 2024-2025 update on: Audit, Risk and Improvement Committee, Community Financial Assistance, Competitive Neutrality Principles, Contracts Awarded over $150,000, Councillor Activities, Development Contributions and Levies, Government Information (Public Access) Act 2009, Legal Proceedings, Modern Slavery Act 2018, Off Leash Areas, Other Regulatory Requirements, Public Interest Disclosures, Responsible Pet Ownership, Special Rate Variations, Swimming Pools Amendment Act 2012. Audited Financial Statements for the Year Ended 30 June 2025 AlburyCity’s audited financial statements and the auditor’s report for the year to 30 June 2025 can be viewed on our website.`;

export const ALBURY_SNAPSHOT_TEXT =
  `AlburyCity Annual Report 2024-2025 Careful management of our finances is important to ensure the prosperity of our community and the services we provide. Below is a snapshot of our yearly expenditure and earnings to fund those services. AlburyCity's full audited financial statements can be viewed on our website. Financial Snapshot 2024-2025 Operating Income $'000 2024-2025 Operating Expenditure $'000 Total 197,575 Total 179,413 Rates and annual charges 85,060 User charges and fees 56,862 Other revenues 4,790 Grant and contributions - Operating 8,172 Grant and contributions - Capital 30,939 Interest and investment income 10,868 Other income 884 Employee benefits and on-costs 65,853 Materials and services 63,832 Borrowing costs 3,674 Depreciation costs 39,891 Other expenses 2,576 Loss on disposal of assets 3,587`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function alburyExtraction(): PdfExtraction {
  return {
    source: {
      sha256: ALBURY_PDF_SHA256,
      bytes: ALBURY_PDF_BYTES,
    },
    pages: [
      pdfPage(ALBURY_ACCOUNTABILITY_TEXT, 94),
      pdfPage(ALBURY_SNAPSHOT_TEXT, 32),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const ALBURY_CONTEXT: AlburyGpfsParseContext = {
  document: {
    id: 'annual-report-2024-25',
    title: 'Annual Report - 2024-2025',
    url: ALBURY_PDF_URL,
    fiscal_year: ALBURY_GPFS_FISCAL_YEAR,
    listing_url: ALBURY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'albury-gpfs/albury-annual-report-2024-25.pdf',
    sha256: ALBURY_PDF_SHA256,
    bytes: ALBURY_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: ALBURY_GPFS_REPORTING_URL,
};

/** The annual report has no audited GPFS section, so the fixture is 0 rows. */
export const ALBURY_GPFS_ROW_COUNT = 0;
export const ALBURY_GPFS_GOLDEN_DIGEST =
  '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
export const ROW_COUNT = ALBURY_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = ALBURY_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseAlburyGpfsExtraction(alburyExtraction(), ALBURY_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
