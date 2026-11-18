import {
  NORTH_SYDNEY_GPFS_FISCAL_YEAR,
  NORTH_SYDNEY_GPFS_REPORTING_URL,
  parseNorthSydneyGpfsExtraction,
  type NorthSydneyGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_ITEMS,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './fixture-data.js';

// The Income Statement prints the Original unaudited budget amount before each
// line label in the PDF text stream, so each emitted value is the first amount
// after the label (the FY2024-25 actual). The expense subtotal contains the
// phrase "depreciation, amortisation and impairment of non-financial assets", so
// the actual depreciation line is read from the last occurrence. Total expenses
// is the printed B1-1 total, which equals the face-statement bridge exactly.
// B1-1's horizontal table is read from the printed total-column coordinates.

function textPage(text: string, pageNumber: number, items: PdfPage['items'] = []): PdfPage {
  return { page_number: pageNumber, text, items };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '37c7de1f8114ff91b0a9643b5f607bdc21af5394ec7d54c14c55e90740d8d72f',
      bytes: 12_205_070,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 9),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 10),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 18, FUNCTIONS_ITEMS as PdfPage['items']),
      textPage(DEPRECIATION_TEXT, 30),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.northsydney.nsw.gov.au/downloads/file/4517/financial-statements-2024-2025';

const CONTEXT: NorthSydneyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024-2025',
    url: PDF_URL,
    fiscal_year: NORTH_SYDNEY_GPFS_FISCAL_YEAR,
    listing_url: NORTH_SYDNEY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/north-sydney-gpfs/north-sydney-council-financial-statements-2024-25.pdf',
    sha256: '37c7de1f8114ff91b0a9643b5f607bdc21af5394ec7d54c14c55e90740d8d72f',
    bytes: 12_205_070,
    fetched_at: '2026-11-18T05:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: NORTH_SYDNEY_GPFS_REPORTING_URL,
};

/** Golden fixture for the north-sydney-gpfs module migration: 18 rows, unchanged keys/amounts. */
export const NORTH_SYDNEY_GPFS_ROW_COUNT = 18;
export const NORTH_SYDNEY_GPFS_GOLDEN_DIGEST =
  '7ecd64d3211bb6e1ac632ce23cba566ae2f4ce79da6fea3b6d927522c01cc303';
export const ROW_COUNT = 18;
export const GOLDEN_DIGEST = '7ecd64d3211bb6e1ac632ce23cba566ae2f4ce79da6fea3b6d927522c01cc303';

export function goldenRecords() {
  const parsed = parseNorthSydneyGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
