import {
  SHELLHARBOUR_GPFS_FISCAL_YEAR,
  SHELLHARBOUR_GPFS_REPORTING_URL,
  parseShellharbourGpfsExtraction,
  type ShellharbourGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './fixture-data.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so each value read is the first amount after the label (the
// FY2024-25 actual). The expense subtotal and the "operating result excluding
// depreciation" line both contain the phrase "depreciation, amortisation and
// impairment of non-financial assets", so the actual depreciation line is read
// from the last occurrence. The Income Statement does not print a combined
// total-expenses line; total expenses is the printed B1-1 "Total functions and
// activities" total, which equals the printed expenses-excluding-depreciation
// line plus the printed depreciation/impairment line.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'f199f5e22b095f1f6b7acae84fc7bbb9414c206a01936a92202e46448a8f2894',
      bytes: 58_205_018,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 54),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 55),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 63),
      textPage(DEPRECIATION_TEXT, 76),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://cdn.shellharbour.nsw.gov.au/sites/default/files/Reports/full-report_2_4.pdf';

const CONTEXT: ShellharbourGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Report - 2024 - 2025',
    url: PDF_URL,
    fiscal_year: SHELLHARBOUR_GPFS_FISCAL_YEAR,
    listing_url: SHELLHARBOUR_GPFS_REPORTING_URL,
    report_page_url:
      'https://www.shellharbour.nsw.gov.au/council/forms-and-publications/annual-reports/annual-report-2024-2025',
    audited_statements_url: 'https://online.fliphtml5.com/usyo/txhe/#p=96',
  },
  archive: {
    local_path: '/tmp/ausspend-source-archive/shellharbour-gpfs/full-report_2_4.pdf',
    sha256: 'f199f5e22b095f1f6b7acae84fc7bbb9414c206a01936a92202e46448a8f2894',
    bytes: 58_205_018,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: SHELLHARBOUR_GPFS_REPORTING_URL,
};

/** Golden fixture for the shellharbour-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const SHELLHARBOUR_GPFS_ROW_COUNT = 17;
export const SHELLHARBOUR_GPFS_GOLDEN_DIGEST =
  'cf175a48c65d53fae313c35d75191bae4fc8abf272b81374eb353f89eb111bef';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'cf175a48c65d53fae313c35d75191bae4fc8abf272b81374eb353f89eb111bef';

export function goldenRecords() {
  const parsed = parseShellharbourGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
