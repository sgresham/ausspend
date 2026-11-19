import {
  CESSNOCK_GPFS_FISCAL_YEAR,
  CESSNOCK_GPFS_REPORTING_URL,
  parseCessnockGpfsExtraction,
  type CessnockGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Cessnock City Council Annual Report
// 2024-2025 (103 spread pages / printed pages 2-203). Page 13 (printed pp. 24-25)
// contains only the narrative "Financial summary" of income shares. Page 101
// (printed pp. 200-201) is the "ATTESTATION STATEMENT" that ends the report.
// Neither page is an audited GPFS Income Statement/Statement of Comprehensive
// Income/Statement of Financial Position/B1-1, so the connector defers with 0
// rows and records the exact gap.
export const CESSNOCK_PDF_URL =
  'https://www.cessnock.nsw.gov.au/files/assets/public/v/1/hptrim/website-integrated-planning-reporting-documents-do-not-change/2025_annual-report-cessnock-city-council_2024-2025_spread.pdf';
export const CESSNOCK_PDF_SHA256 =
  'd111d81c727c7e65f76866487e6a470bf717d301ffbe36d84fd88bba0411a494';
export const CESSNOCK_PDF_BYTES = 16506336;

export const CESSNOCK_SUMMARY_TEXT = `ANNUAL REPORT 2024–2025 | 25 24 | CESSNOCK CITY COUNCIL Community Involvement Our engagement activities are guided by the best practice International Association for Public Participation (IAP2) model. Consultation with members of our community and stakeholders through surveys, online discussions, community events, workshops and local conversations ensured that our community had the opportunity to participate in the development of our plan. Financial summary What were our sources of income? Rates and annual charges Other revenues Contributions - Non cash dedications User charges and fees Grants and contributions Interest and investment income $61.3m received in grants and contributions $26.4m non-cash dedications $4m other revenues $71.2m raised in rates and charges 15% 35% 40% 6% 2% 2%`;

export const CESSNOCK_ATTESTATION_TEXT = `ANNUAL REPORT 2024–2025 | 201 200 | CESSNOCK CITY COUNCIL ATTESTATION STATEMENT`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function cessnockExtraction(): PdfExtraction {
  return {
    source: {
      sha256: CESSNOCK_PDF_SHA256,
      bytes: CESSNOCK_PDF_BYTES,
    },
    pages: [pdfPage(CESSNOCK_SUMMARY_TEXT, 13), pdfPage(CESSNOCK_ATTESTATION_TEXT, 101)],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const CESSNOCK_CONTEXT: CessnockGpfsParseContext = {
  document: {
    id: 'annual-report-2024-25',
    title: 'Annual Report 2024-2025',
    url: CESSNOCK_PDF_URL,
    fiscal_year: CESSNOCK_GPFS_FISCAL_YEAR,
    listing_url: CESSNOCK_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'cessnock-gpfs/2025_annual-report-cessnock-city-council_2024-2025_spread.pdf',
    sha256: CESSNOCK_PDF_SHA256,
    bytes: CESSNOCK_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: CESSNOCK_GPFS_REPORTING_URL,
};

/** The annual report has no audited GPFS section, so the fixture is 0 rows. */
export const CESSNOCK_GPFS_ROW_COUNT = 0;
export const CESSNOCK_GPFS_GOLDEN_DIGEST =
  '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
export const ROW_COUNT = CESSNOCK_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = CESSNOCK_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseCessnockGpfsExtraction(cessnockExtraction(), CESSNOCK_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
