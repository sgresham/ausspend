import {
  TWEED_SHIRE_GPFS_FISCAL_YEAR,
  TWEED_SHIRE_GPFS_REPORTING_URL,
  parseTweedShireGpfsExtraction,
  type TweedShireGpfsParseContext,
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
// FY2024-25 actual). The printed expense subtotal label is physically wrapped
// around the budget amount ("... non-financial 159,480 assets 186,872"), so the
// connector reads the value after the trailing word. The Income Statement does
// not print a combined total-expenses line; total expenses is the printed B1-1
// "Total functions and activities" total, which equals the printed expenses-
// excluding-depreciation line plus the printed depreciation/impairment line.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '8eabbdf40bf180e051598eaa90d542ca3ab8b7a27187ff0b8230b0433e7dee8f',
      bytes: 4_202_080,
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
  'https://www.tweed.nsw.gov.au/files/assets/public/v/1/documents/council/annual-and-financial-reports/tweed-shire-council-financial-statements-2024-2025.pdf';

const CONTEXT: TweedShireGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024–2025',
    url: PDF_URL,
    fiscal_year: TWEED_SHIRE_GPFS_FISCAL_YEAR,
    listing_url: TWEED_SHIRE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/tweed-shire-gpfs/tweed-shire-council-financial-statements-2024-2025.pdf',
    sha256: '8eabbdf40bf180e051598eaa90d542ca3ab8b7a27187ff0b8230b0433e7dee8f',
    bytes: 4_202_080,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: TWEED_SHIRE_GPFS_REPORTING_URL,
};

/** Golden fixture for the tweed-shire-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const TWEED_SHIRE_GPFS_ROW_COUNT = 17;
export const TWEED_SHIRE_GPFS_GOLDEN_DIGEST =
  'dd856e26b1f777df3fef795ed3ef0fe166e481f303a96c931786577ad42bfd33';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'dd856e26b1f777df3fef795ed3ef0fe166e481f303a96c931786577ad42bfd33';

export function goldenRecords() {
  const parsed = parseTweedShireGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
