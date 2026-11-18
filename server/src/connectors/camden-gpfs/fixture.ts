import {
  CAMDEN_GPFS_FISCAL_YEAR,
  CAMDEN_GPFS_REPORTING_URL,
  parseCamdenGpfsExtraction,
  type CamdenGpfsParseContext,
} from './index.js';
import {
  CAMDEN_PDF_BYTES,
  CAMDEN_PDF_SHA256,
  CAMDEN_PDF_URL,
  camdenExtraction,
} from './fixture-data.js';

// Camden's official Annual Report and Financial Statement page links the
// "Annual Financial Statements 2024-2025" PDF directly. Its Income Statement prints the Original unaudited
// budget column first, the FY2024-25 Actual column second and the FY2023-24
// column third, each row's label and amounts on the same printed line.
// FY2024-25 has no discontinued operation, so the printed operating result and
// net result are the same. The B1-1 function expense split is a second cut of
// the same printed total expenses.

const CONTEXT: CamdenGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Camden Council Financial Statements 2024-25',
    url: CAMDEN_PDF_URL,
    fiscal_year: CAMDEN_GPFS_FISCAL_YEAR,
    listing_url: CAMDEN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/camden-gpfs/camden-council-financial-statements-2024-25.pdf',
    sha256: CAMDEN_PDF_SHA256,
    bytes: CAMDEN_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: CAMDEN_GPFS_REPORTING_URL,
};

/** Golden fixture for the camden-gpfs module: 23 rows. */
export const CAMDEN_GPFS_ROW_COUNT = 23;
export const CAMDEN_GPFS_GOLDEN_DIGEST =
  'e1b2456efde57be7b8e401198e4636ca6932694d1126442c86911ba81a6e297d';
export const ROW_COUNT = CAMDEN_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = CAMDEN_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseCamdenGpfsExtraction(camdenExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
