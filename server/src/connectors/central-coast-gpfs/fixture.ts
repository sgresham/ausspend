import {
  CENTRAL_COAST_GPFS_FISCAL_YEAR,
  CENTRAL_COAST_GPFS_REPORTING_URL,
  parseCentralCoastGpfsExtraction,
  type CentralCoastGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
  PDF_BYTES,
  PDF_LISTING_URL,
  PDF_SHA256,
  PDF_URL,
} from './fixture-data.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so the FY2024-25 actual is the first amount after the label (the
// then FY2023-24); the budget amount trails the previous line. The standalone
// depreciation line prints a bare footnote marker before its note reference, so
// its actual is the second amount after the label. Total expenses is the printed
// face-statement bridge: printed expenses excluding depreciation plus printed
// depreciation. The printed B1-1 expense total ($734,180 thousand) is $2
// thousand above that bridge and its operating result is $2 thousand below the
// face statement; the discrepancy is recorded as reconciliation evidence and the
// face statement is authoritative.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: PDF_SHA256, bytes: PDF_BYTES },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 4),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 5),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 13),
      textPage(DEPRECIATION_TEXT, 24),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: CentralCoastGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Central Coast Council Audited Financial Statements 2024-25',
    url: PDF_URL,
    fiscal_year: CENTRAL_COAST_GPFS_FISCAL_YEAR,
    listing_url: PDF_LISTING_URL,
  },
  archive: {
    local_path:
      '~/ausspend-source-archive/central-coast-gpfs/central-coast-council-audited-financial-statements-2024-25.pdf',
    sha256: PDF_SHA256,
    bytes: PDF_BYTES,
    fetched_at: '2026-11-18T03:30:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: CENTRAL_COAST_GPFS_REPORTING_URL,
};

/** Golden fixture for the central-coast-gpfs module: 17 rows. */
export const CENTRAL_COAST_GPFS_ROW_COUNT = 17;
export const CENTRAL_COAST_GPFS_GOLDEN_DIGEST =
  '6fb6a4ecdc2c2f0b403074c429aa4311d99c72d428d2ff65f79bc0c3196f9d9e';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = CENTRAL_COAST_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseCentralCoastGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}

export { CONTEXT as CENTRAL_COAST_GPFS_FIXTURE_CONTEXT };
