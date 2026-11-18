import {
  BLUE_MOUNTAINS_GPFS_FISCAL_YEAR,
  BLUE_MOUNTAINS_GPFS_REPORTING_URL,
  parseBlueMountainsGpfsExtraction,
  type BlueMountainsGpfsParseContext,
} from './index.js';
import {
  BLUE_MOUNTAINS_PDF_BYTES,
  BLUE_MOUNTAINS_PDF_SHA256,
  BLUE_MOUNTAINS_PDF_URL,
  blueMountainsExtraction,
} from './fixture-data.js';

// Blue Mountains' official document page links the "Annual Financial Statements
// 2024-2025" PDF directly. Its Income Statement prints the Original unaudited
// budget column first, the FY2024-25 Actual column second and the FY2023-24
// column third, each row's label and amounts on the same printed line.
// FY2024-25 has no discontinued operation, so the printed operating result and
// net result are the same. The B1-1 function expense split is a second cut of
// the same printed total expenses.

const CONTEXT: BlueMountainsGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Blue Mountains City Council Financial Statements 2024-25',
    url: BLUE_MOUNTAINS_PDF_URL,
    fiscal_year: BLUE_MOUNTAINS_GPFS_FISCAL_YEAR,
    listing_url: BLUE_MOUNTAINS_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/blue-mountains-gpfs/blue-mountains-city-council-financial-statements-2024-25.pdf',
    sha256: BLUE_MOUNTAINS_PDF_SHA256,
    bytes: BLUE_MOUNTAINS_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: BLUE_MOUNTAINS_GPFS_REPORTING_URL,
};

/** Golden fixture for the blue-mountains-gpfs module: 23 rows. */
export const BLUE_MOUNTAINS_GPFS_ROW_COUNT = 23;
export const BLUE_MOUNTAINS_GPFS_GOLDEN_DIGEST =
  '128e65da9588a0f9cb25d265159e026e3959aa7e66a097176a0324bd9a2cef76';
export const ROW_COUNT = BLUE_MOUNTAINS_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BLUE_MOUNTAINS_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseBlueMountainsGpfsExtraction(blueMountainsExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
