import {
  MUSWELLBROOK_GPFS_FISCAL_YEAR,
  MUSWELLBROOK_GPFS_REPORTING_URL,
  parseMuswellbrookGpfsExtraction,
  type MuswellbrookGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Representative pages from the official Muswellbrook Shire Council Annual
// Report 2024-25 (196 pages, 35,369,135 bytes). Page 3 is the contents (which
// list General Purpose Financial Statements at page 79 and Special Purpose
// Financial Statements at page 172); page 74 is the narrative Financial
// Reporting summary in $millions; pages 79, 80 and 171 are representative GPFS
// pages that contain only the running header/footer (the statement content is
// vector-drawn with no text layer). The connector therefore defers with 0 rows
// and records the exact gap.
export const MUSWELLBROOK_PDF_URL =
  'https://www.muswellbrook.nsw.gov.au/wp-content/uploads/2025/12/2024-2025-Annual-Report-FINAL-Ready-for-Endorsement-1.pdf';
export const MUSWELLBROOK_PDF_SHA256 =
  '45ecbde31f0fb1152d0edb30a60506a7fa3f75abadccb71a5d6e858dbe0cd9b9';
export const MUSWELLBROOK_PDF_BYTES = 35369135;

export const MUSWELLBROOK_CONTENTS_TEXT = `Contents Message from GM 4 Message from Mayor 5 The Governing Body 6 Our Shire 7 Our Council 10 Our Leadership Team 11 Muswellbrook at a Glance 12 Organisational Structure 15 Employment Stats 16 Our Stakeholders 19 IP&R Framework 20 Our Strategic Achievements - Summary of Directorates 23 Strategic Achievements 30 OP Actions / Progress Reports 28 Statutory Reporting 51 Councillor Training and Personal Development 51 Councilor’s Attendance Records 52 Councillor Expenses 53 Exercise of Council Functions by External Bodies 53 Councillor and Staff Overseas Travel 53 Statement of the Total Number of Persons who performed Paid Work for Muswellbrook Shire Council on Wed 4th December 2024 54 Statement of Legal Proceedings 54 Government Information (Public Access) Act 2009 55 Internal audit and risk management attestation statement for the 2024/2025 financial year for Muswellbrook Shire Council 59 Disability Inclusion Action Plan (2022-2026) 62 2024/2025 Works carried out on Private Land 65 Stormwater Drainage 65 Capital Works 65 Swimming Pools 65 Companion Animals Act and Regulation 66 Financial Reporting 68 Muswellbrook Shire Council Modern Slavery Statement 68 Special Rate Variation 68 Planning Agreements 71 Rates & Charges Written Off 72 Contracts Over $150K 72 Grants 73 Senior Staff and Remuneration Package for Senior Staff 76 Annual Financial Statements 78 General Purpose FInancial Statements 79 Special Purpose FInancial Statements 172 Special Schedules 185 Acknowledgements Muswellbrook Shire Council would like to acknowledge and thank all community members, businesses, partner`;

export const MUSWELLBROOK_SUMMARY_TEXT = `Income $ (mil) Rates & Annual Charges 29 User Charges & Fees 16.2 Other Revenue 1.4 Grants & Contributions provided for Operating Purposes 7.2 Grants & Contributions provided for Capital Purposes 18.1 Interest & Investment Income 5.2 Other Income 6.5 Net Gain from the disposal of Assets 0.1 Total Income $90.1 Expenditure $ (mil) Materials & Services 19.5 Employee Benefits & Oncosts 23.9 Depreciation, Amortisation & Impairment of Non-financial assets 16.0 Other Expenses 3.8 Borrowing Costs 2.8 Total Expenditure $66.0 Income $90.1million Expenditure $66.0million Financial Reporting Muswellbrook Shire Council 74`;

export const MUSWELLBROOK_GPFS_79_TEXT = `Annual Report 2024-2025 79`;
export const MUSWELLBROOK_GPFS_80_TEXT = `Muswellbrook Shire Council 80`;
export const MUSWELLBROOK_GPFS_171_TEXT = `Annual Report 2024-2025 171`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function muswellbrookExtraction(): PdfExtraction {
  return {
    source: {
      sha256: MUSWELLBROOK_PDF_SHA256,
      bytes: MUSWELLBROOK_PDF_BYTES,
    },
    pages: [
      pdfPage(MUSWELLBROOK_CONTENTS_TEXT, 3),
      pdfPage(MUSWELLBROOK_SUMMARY_TEXT, 74),
      pdfPage(MUSWELLBROOK_GPFS_79_TEXT, 79),
      pdfPage(MUSWELLBROOK_GPFS_80_TEXT, 80),
      pdfPage(MUSWELLBROOK_GPFS_171_TEXT, 171),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const MUSWELLBROOK_CONTEXT: MuswellbrookGpfsParseContext = {
  document: {
    id: 'annual-report-2024-25',
    title: '2024-2025 Annual Report',
    url: MUSWELLBROOK_PDF_URL,
    fiscal_year: MUSWELLBROOK_GPFS_FISCAL_YEAR,
    listing_url: MUSWELLBROOK_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'muswellbrook-gpfs/2024-2025-Annual-Report-FINAL-Ready-for-Endorsement-1.pdf',
    sha256: MUSWELLBROOK_PDF_SHA256,
    bytes: MUSWELLBROOK_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: MUSWELLBROOK_GPFS_REPORTING_URL,
};

/** The embedded GPFS section has no text layer, so the fixture is 0 rows. */
export const MUSWELLBROOK_GPFS_ROW_COUNT = 0;
export const MUSWELLBROOK_GPFS_GOLDEN_DIGEST =
  '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';
export const ROW_COUNT = MUSWELLBROOK_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = MUSWELLBROOK_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseMuswellbrookGpfsExtraction(muswellbrookExtraction(), MUSWELLBROOK_CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
