import {
  WAVERLEY_GPFS_FISCAL_YEAR,
  WAVERLEY_GPFS_REPORTING_URL,
  parseWaverleyGpfsExtraction,
  type WaverleyGpfsParseContext,
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
      sha256: 'b62cd275e63ae3ab8c7d72c9c84480f526e8829bcde9bbceed185d9a068216da',
      bytes: 5_312_088,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 9),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 10),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 18),
      textPage(DEPRECIATION_TEXT, 32),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.waverley.nsw.gov.au/__data/assets/pdf_file/0006/250359/Annual_Financial_Statements_2025.pdf';

const CONTEXT: WaverleyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Statement of Accounts 2024-2025',
    url: PDF_URL,
    fiscal_year: WAVERLEY_GPFS_FISCAL_YEAR,
    listing_url: WAVERLEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: '/tmp/ausspend-source-archive/waverley-gpfs/Annual_Financial_Statements_2025.pdf',
    sha256: 'b62cd275e63ae3ab8c7d72c9c84480f526e8829bcde9bbceed185d9a068216da',
    bytes: 5_312_088,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: WAVERLEY_GPFS_REPORTING_URL,
};

/** Golden fixture for the waverley-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const WAVERLEY_GPFS_ROW_COUNT = 17;
export const WAVERLEY_GPFS_GOLDEN_DIGEST =
  '54b87a81c8c455390b80d5032c4a24e9dd7e387a961637597e7002f807a1f2f5';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '54b87a81c8c455390b80d5032c4a24e9dd7e387a961637597e7002f807a1f2f5';

export function goldenRecords() {
  const parsed = parseWaverleyGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
