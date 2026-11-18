import {
  INNER_WEST_GPFS_FISCAL_YEAR,
  INNER_WEST_GPFS_REPORTING_URL,
  parseInnerWestGpfsExtraction,
  type InnerWestGpfsParseContext,
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
      sha256: '03403da8625147450d200cad6a8354f10877893fb2086763f4df9d8fa7622c1f',
      bytes: 10_107_386,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 236),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 237),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 245),
      textPage(DEPRECIATION_TEXT, 256),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.innerwest.nsw.gov.au/sites/default/files/2026-11/Annual%20Report%202024-25.pdf';

const CONTEXT: InnerWestGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Report 2024-25',
    url: PDF_URL,
    fiscal_year: INNER_WEST_GPFS_FISCAL_YEAR,
    listing_url: INNER_WEST_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/inner-west-gpfs/inner-west-council-annual-report-2024-25-gpfs.pdf',
    sha256: '03403da8625147450d200cad6a8354f10877893fb2086763f4df9d8fa7622c1f',
    bytes: 10_107_386,
    fetched_at: '2026-11-17T16:45:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: INNER_WEST_GPFS_REPORTING_URL,
};

/** Golden fixture for the inner-west-gpfs module migration: 18 rows, unchanged keys/amounts. */
export const INNER_WEST_GPFS_ROW_COUNT = 18;
export const INNER_WEST_GPFS_GOLDEN_DIGEST =
  'e01a79a0b00486d6bc32c3fcf522909d220a00e0a4502c5ee92384940799657e';
export const ROW_COUNT = 18;
export const GOLDEN_DIGEST = 'e01a79a0b00486d6bc32c3fcf522909d220a00e0a4502c5ee92384940799657e';

export function goldenRecords() {
  const parsed = parseInnerWestGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
