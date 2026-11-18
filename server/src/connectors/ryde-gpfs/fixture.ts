import {
  RYDE_GPFS_FISCAL_YEAR,
  RYDE_GPFS_REPORTING_URL,
  parseRydeGpfsExtraction,
  type RydeGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './fixture-data.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so each emitted value is the second amount after the label (the
// FY2024-25 actual); the first is budget and the third is FY2023-24. The expense
// subtotal contains the phrase "depreciation, amortisation and impairment of
// non-financial assets", so the actual depreciation line is read from the last
// occurrence. Total expenses is the printed face-statement bridge: printed
// expenses excluding depreciation plus printed depreciation. The printed B1-1
// expense total ($178,792 thousand) is $15 thousand below that bridge and its
// operating result is $15 thousand above the face statement; the discrepancy is
// recorded as reconciliation evidence and the face statement is authoritative.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '4a70b2a68b47142b79679a4ea4763849d7c07fc76b90a19c7bbc48e635a4bdb5',
      bytes: 12_685_077,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 6),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 7),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 15),
      textPage(DEPRECIATION_TEXT, 27),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.ryde.nsw.gov.au/files/assets/public/v/2/publications/corporate-services/financial-reports/financial-report-2025.pdf';

const CONTEXT: RydeGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements - Year ended 30 June 2025',
    url: PDF_URL,
    fiscal_year: RYDE_GPFS_FISCAL_YEAR,
    listing_url: RYDE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/ryde-gpfs/council-of-the-city-of-ryde-financial-statements-2024-25.pdf',
    sha256: '4a70b2a68b47142b79679a4ea4763849d7c07fc76b90a19c7bbc48e635a4bdb5',
    bytes: 12_685_077,
    fetched_at: '2026-11-18T04:40:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: RYDE_GPFS_REPORTING_URL,
};

/** Golden fixture for the ryde-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const RYDE_GPFS_ROW_COUNT = 17;
export const RYDE_GPFS_GOLDEN_DIGEST =
  '954bac8086226925e59199d337371778799054d2a122ff90ba5bf904ccde9ba1';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '954bac8086226925e59199d337371778799054d2a122ff90ba5bf904ccde9ba1';

export function goldenRecords() {
  const parsed = parseRydeGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
