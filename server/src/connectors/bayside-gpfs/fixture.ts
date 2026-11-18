import {
  BAYSIDE_GPFS_FISCAL_YEAR,
  BAYSIDE_GPFS_REPORTING_URL,
  parseBaysideGpfsExtraction,
  type BaysideGpfsParseContext,
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
// FY2024-25 actual). The expense subtotal contains the phrase "depreciation,
// amortisation and impairment of non-financial assets", so the actual
// depreciation line is read from the last occurrence. The Income Statement does
// not print a combined total-expenses line; total expenses is the printed B1-1
// "Total functions and activities" total, which equals the printed
// expenses-excluding-depreciation line plus the printed depreciation line.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'c91290369d85aa34c95a47a806d1187809ef7816f0a76a1872b70a79560a8bf0',
      bytes: 2_174_485,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 4),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 5),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
      textPage(DEPRECIATION_TEXT, 24),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.bayside.nsw.gov.au/sites/default/files/2025-12/General%20Purpose%20Financial%20Statements%20%26%20Special%20Schedules%20for%20the%20year%20ended%2030%20June%202025_Final%20Version.pdf';

const CONTEXT: BaysideGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'General Purpose Financial Statements 2024-25',
    url: PDF_URL,
    fiscal_year: BAYSIDE_GPFS_FISCAL_YEAR,
    listing_url: BAYSIDE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: '/tmp/ausspend-source-archive/bayside-gpfs/bayside-council-gpfs-2024-25.pdf',
    sha256: 'c91290369d85aa34c95a47a806d1187809ef7816f0a76a1872b70a79560a8bf0',
    bytes: 2_174_485,
    fetched_at: '2026-11-18T04:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: BAYSIDE_GPFS_REPORTING_URL,
};

/** Golden fixture for the bayside-gpfs module migration: 18 rows, unchanged keys/amounts. */
export const BAYSIDE_GPFS_ROW_COUNT = 18;
export const BAYSIDE_GPFS_GOLDEN_DIGEST =
  '94a172b8ce2dc44cfe9ec824fd388931d1d9a917cd23a49063416a6787ab2dac';
export const ROW_COUNT = 18;
export const GOLDEN_DIGEST = '94a172b8ce2dc44cfe9ec824fd388931d1d9a917cd23a49063416a6787ab2dac';

export function goldenRecords() {
  const parsed = parseBaysideGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
