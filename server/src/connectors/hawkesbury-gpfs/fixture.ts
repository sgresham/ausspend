import {
  HAWKESBURY_GPFS_FISCAL_YEAR,
  HAWKESBURY_GPFS_REPORTING_URL,
  parseHawkesburyGpfsExtraction,
  type HawkesburyGpfsParseContext,
} from './index.js';
import {
  HAWKESBURY_PDF_BYTES,
  HAWKESBURY_PDF_SHA256,
  HAWKESBURY_PDF_URL,
  hawkesburyExtraction,
} from './fixture-data.js';

// Hawkesbury's official Financial Statement page redirects to the latest
// standalone audited General Purpose Financial Statements PDF. Its Income
// Statement prints the Original unaudited budget column first, the FY2024-25
// Actual column second and the FY2023-24 column third, each row's label and
// amounts on the same printed line. FY2024-25 has a material discontinued
// operation (the sewer business), so the continuing and discontinued result
// lines are both emitted alongside the statutory net result.

const CONTEXT: HawkesburyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Hawkesbury City Council Financial Statements 2024-25',
    url: HAWKESBURY_PDF_URL,
    fiscal_year: HAWKESBURY_GPFS_FISCAL_YEAR,
    listing_url: HAWKESBURY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/hawkesbury-gpfs/hawkesbury-city-council-financial-statements-2024-25.pdf',
    sha256: HAWKESBURY_PDF_SHA256,
    bytes: HAWKESBURY_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: HAWKESBURY_GPFS_REPORTING_URL,
};

/** Golden fixture for the hawkesbury-gpfs module: 19 rows. */
export const HAWKESBURY_GPFS_ROW_COUNT = 19;
export const HAWKESBURY_GPFS_GOLDEN_DIGEST =
  'fef3f2d2cd8906b92053ff8c2eee168617552ec79b5cce85760216fbea3ff520';
export const ROW_COUNT = 19;
export const GOLDEN_DIGEST = 'fef3f2d2cd8906b92053ff8c2eee168617552ec79b5cce85760216fbea3ff520';

export function goldenRecords() {
  const parsed = parseHawkesburyGpfsExtraction(hawkesburyExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
