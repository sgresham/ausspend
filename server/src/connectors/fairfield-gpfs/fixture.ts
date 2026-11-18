import {
  FAIRFIELD_GPFS_FISCAL_YEAR,
  FAIRFIELD_GPFS_REPORTING_URL,
  parseFairfieldGpfsExtraction,
  type FairfieldGpfsParseContext,
} from './index.js';
import { FAIRFIELD_PDF_SHA256, FAIRFIELD_PDF_URL, fairfieldExtraction } from './fixture-data.js';

// Fairfield publishes a standalone audited financial statements PDF on its
// official Corporate Reports page. Its Income Statement prints the Original
// unaudited budget column first, the FY2024-25 Actual column second and the
// restated FY2023-24 column third. The text stream groups labels before
// amounts, so the adapter reconstructs printed rows from text-item coordinates
// and reads the middle (Actual 2025) column. The printed borrowing-costs line
// and net gain on disposal are both non-nil and emitted.

const CONTEXT: FairfieldGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Fairfield City Council Audited Financial Statements 2024-25',
    url: FAIRFIELD_PDF_URL,
    fiscal_year: FAIRFIELD_GPFS_FISCAL_YEAR,
    listing_url: FAIRFIELD_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/fairfield-gpfs/fairfield-city-council-audited-financial-statements-2024-25.pdf',
    sha256: FAIRFIELD_PDF_SHA256,
    bytes: 17_656_220,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: FAIRFIELD_GPFS_REPORTING_URL,
};

/** Golden fixture for the fairfield-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const FAIRFIELD_GPFS_ROW_COUNT = 17;
export const FAIRFIELD_GPFS_GOLDEN_DIGEST =
  '0a6c5fc4f320b19e2229a2cf195938c8203e85479d3c9c6c18fb1a27844c43f8';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '0a6c5fc4f320b19e2229a2cf195938c8203e85479d3c9c6c18fb1a27844c43f8';

export function goldenRecords() {
  const parsed = parseFairfieldGpfsExtraction(fairfieldExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
