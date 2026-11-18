import {
  WILLOUGHBY_GPFS_FISCAL_YEAR,
  WILLOUGHBY_GPFS_REPORTING_URL,
  parseWilloughbyGpfsExtraction,
  type WilloughbyGpfsParseContext,
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
      sha256: '496c569c64c69ef2bb79b233f638011cc561a98882fd732348c1b864fbf2d1d9',
      bytes: 3_217_101,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 12),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 13),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 21),
      textPage(DEPRECIATION_TEXT, 34),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.willoughby.nsw.gov.au/files/assets/public/v/2/documents/publications-reports-master-plans-strategies-action-plans/ecm_7295400_v2_willougby-city-council-final-24-25-financial-statement.pdf';

const CONTEXT: WilloughbyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statements 2024-2025',
    url: PDF_URL,
    fiscal_year: WILLOUGHBY_GPFS_FISCAL_YEAR,
    listing_url: WILLOUGHBY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/willoughby-gpfs/willoughby-city-council-financial-statements-2024-25.pdf',
    sha256: '496c569c64c69ef2bb79b233f638011cc561a98882fd732348c1b864fbf2d1d9',
    bytes: 3_217_101,
    fetched_at: '2026-11-17T16:31:15.619Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: WILLOUGHBY_GPFS_REPORTING_URL,
};

/** Golden fixture for the willoughby-gpfs module migration: 18 rows, unchanged keys/amounts. */
export const WILLOUGHBY_GPFS_ROW_COUNT = 18;
export const WILLOUGHBY_GPFS_GOLDEN_DIGEST =
  '03acc163a418b93d375a3b0ff8b6534af9c2a05051637f9f63c50debebf54b8a';
export const ROW_COUNT = 18;
export const GOLDEN_DIGEST = '03acc163a418b93d375a3b0ff8b6534af9c2a05051637f9f63c50debebf54b8a';

export function goldenRecords() {
  const parsed = parseWilloughbyGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
