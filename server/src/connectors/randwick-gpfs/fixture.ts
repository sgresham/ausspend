import {
  RANDWICK_GPFS_FISCAL_YEAR,
  RANDWICK_GPFS_REPORTING_URL,
  parseRandwickGpfsExtraction,
  type RandwickGpfsParseContext,
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
      sha256: '40845270cd20290dad620e3f398e4ee91d9566aa9e1ed701254b560618a7d455',
      bytes: 5_567_387,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 6),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 7),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 15),
      textPage(DEPRECIATION_TEXT, 25),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.randwick.nsw.gov.au/__data/assets/pdf_file/0005/425372/Financial-Statements-2024-25.PDF';

const CONTEXT: RandwickGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024-25',
    url: PDF_URL,
    fiscal_year: RANDWICK_GPFS_FISCAL_YEAR,
    listing_url: RANDWICK_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/randwick-gpfs/randwick-city-council-financial-statements-2024-25.pdf',
    sha256: '40845270cd20290dad620e3f398e4ee91d9566aa9e1ed701254b560618a7d455',
    bytes: 5_567_387,
    fetched_at: '2026-11-18T04:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: RANDWICK_GPFS_REPORTING_URL,
};

/** Golden fixture for the randwick-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const RANDWICK_GPFS_ROW_COUNT = 17;
export const RANDWICK_GPFS_GOLDEN_DIGEST =
  '577c3f57c22030b2669326c079e5c31143bccf76f6998d8822dccef7b976087a';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '577c3f57c22030b2669326c079e5c31143bccf76f6998d8822dccef7b976087a';

export function goldenRecords() {
  const parsed = parseRandwickGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
