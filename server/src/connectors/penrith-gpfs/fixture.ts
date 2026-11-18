import {
  PENRITH_GPFS_FISCAL_YEAR,
  PENRITH_GPFS_REPORTING_URL,
  parsePenrithGpfsExtraction,
  type PenrithGpfsParseContext,
} from './index.js';
import {
  PENRITH_PDF_BYTES,
  PENRITH_PDF_SHA256,
  PENRITH_PDF_URL,
  penrithExtraction,
} from './fixture-data.js';

// Penrith's official Organisational Performance page links the "2024-25
// Financial Statements" PDF directly. Its Income Statement prints the Original
// unaudited budget column first, the FY2024-25 Actual column second and the
// FY2023-24 column third. FY2024-25 has no discontinued operation, so the printed
// continuing operating result and the net result repeated in comprehensive
// income are the same. The B1-1 objective expense split is a second cut of the
// same printed total expenses.

const CONTEXT: PenrithGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Penrith City Council Financial Statements 2024-25',
    url: PENRITH_PDF_URL,
    fiscal_year: PENRITH_GPFS_FISCAL_YEAR,
    listing_url: PENRITH_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '~/ausspend-source-archive/penrith-gpfs/penrith-city-council-financial-statements-2024-25.pdf',
    sha256: PENRITH_PDF_SHA256,
    bytes: PENRITH_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: PENRITH_GPFS_REPORTING_URL,
};

/** Golden fixture for the penrith-gpfs module: 17 rows. */
export const PENRITH_GPFS_ROW_COUNT = 17;
export const PENRITH_GPFS_GOLDEN_DIGEST =
  '10f3e8b81b7896b345822b8e24bc7d94e91d945c984e2fb8ca763f7d5eec22f2';
export const ROW_COUNT = PENRITH_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = PENRITH_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parsePenrithGpfsExtraction(penrithExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
