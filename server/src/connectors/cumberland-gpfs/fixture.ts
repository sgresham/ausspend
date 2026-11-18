import {
  CUMBERLAND_GPFS_FISCAL_YEAR,
  CUMBERLAND_GPFS_REPORTING_URL,
  parseCumberlandGpfsExtraction,
  type CumberlandGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './fixture-data.js';

// Cumberland publishes a dedicated Annual Financial Statements PDF. The Income
// Statement prints the Original unaudited budget amount before each line label in
// the PDF text stream, so each emitted value is the first amount after the label
// (the FY2024-25 actual). The expense subtotal contains the phrase
// "depreciation, amortisation and impairment of non-financial assets", so the
// actual depreciation line is read from the last occurrence. Total expenses is
// the printed face-statement bridge; the B1-1 printed total is $1k lower because
// its function rows are rounded, and that difference is retained as evidence.

function textPage(text: string, pageNumber: number, items: PdfPage['items'] = []): PdfPage {
  return { page_number: pageNumber, text, items };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '4c1d003cd8a27e72e71c9ebd75bd80f1c67931ef551b4baa3d7c0010d4dc267e',
      bytes: 7_165_368,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 5),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 6),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 15),
      textPage(DEPRECIATION_TEXT, 28),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.cumberland.nsw.gov.au/sites/default/files/inline-files/cumberland-council-annual-financial-statements-2024-2025.pdf';

const CONTEXT: CumberlandGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statements 2024-2025',
    url: PDF_URL,
    fiscal_year: CUMBERLAND_GPFS_FISCAL_YEAR,
    listing_url: CUMBERLAND_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/cumberland-gpfs/cumberland-city-council-annual-financial-statements-2024-25.pdf',
    sha256: '4c1d003cd8a27e72e71c9ebd75bd80f1c67931ef551b4baa3d7c0010d4dc267e',
    bytes: 7_165_368,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: CUMBERLAND_GPFS_REPORTING_URL,
};

/** Golden fixture for the cumberland-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const CUMBERLAND_GPFS_ROW_COUNT = 17;
export const CUMBERLAND_GPFS_GOLDEN_DIGEST =
  'a006b97c2cd0637a7a00276c71e544811f09b7a1119fb706b235fb7a91ba1e44';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'a006b97c2cd0637a7a00276c71e544811f09b7a1119fb706b235fb7a91ba1e44';

export function goldenRecords() {
  const parsed = parseCumberlandGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
