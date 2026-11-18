import {
  CAMPBELLTOWN_GPFS_FISCAL_YEAR,
  CAMPBELLTOWN_GPFS_REPORTING_URL,
  parseCampbelltownGpfsExtraction,
  type CampbelltownGpfsParseContext,
} from './index.js';
import {
  CAMPBELLTOWN_PDF_BYTES,
  CAMPBELLTOWN_PDF_SHA256,
  CAMPBELLTOWN_PDF_URL,
  campbelltownExtraction,
} from './fixture-data.js';

// Campbelltown's official financial-information page links the "Financial
// Statements 2024-25" PDF directly. Its Income Statement prints the Original
// unaudited budget column first, the FY2024-25 Actual column second and the
// FY2023-24 column third, each row's label and amounts on the same printed
// line. FY2024-25 has no discontinued operation, so the printed continuing
// operating result and the net result repeated in comprehensive income are the
// same. The B1-1 objective expense split is a second cut of the same printed
// total expenses.

const CONTEXT: CampbelltownGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Campbelltown City Council Financial Statements 2024-25',
    url: CAMPBELLTOWN_PDF_URL,
    fiscal_year: CAMPBELLTOWN_GPFS_FISCAL_YEAR,
    listing_url: CAMPBELLTOWN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/campbelltown-gpfs/campbelltown-city-council-financial-statements-2024-25.pdf',
    sha256: CAMPBELLTOWN_PDF_SHA256,
    bytes: CAMPBELLTOWN_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: CAMPBELLTOWN_GPFS_REPORTING_URL,
};

/** Golden fixture for the campbelltown-gpfs module: 22 rows. */
export const CAMPBELLTOWN_GPFS_ROW_COUNT = 22;
export const CAMPBELLTOWN_GPFS_GOLDEN_DIGEST =
  'acdfa907969b582bb7a1d250ac9d9b908e35379deed0aa754e319ad56830c952';
export const ROW_COUNT = CAMPBELLTOWN_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = CAMPBELLTOWN_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseCampbelltownGpfsExtraction(campbelltownExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
