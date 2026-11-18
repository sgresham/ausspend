import {
  LANE_COVE_GPFS_FISCAL_YEAR,
  LANE_COVE_GPFS_REPORTING_URL,
  parseLaneCoveGpfsExtraction,
  type LaneCoveGpfsParseContext,
} from './index.js';
import {
  LANE_COVE_PDF_BYTES,
  LANE_COVE_PDF_SHA256,
  LANE_COVE_PDF_URL,
  laneCoveExtraction,
} from './fixture-data.js';

// Lane Cove publishes no standalone GPFS PDF: the audited FY2024-25 General
// Purpose Financial Statements are Section 3 of the official Annual Report
// 2024-25 PDF linked from the council Community Strategic Plan page. Its Income
// Statement prints the Original unaudited budget column first, the FY2024-25
// Actual column second and the FY2023-24 column third, each row's label and
// amounts on the same printed line. The Income Statement prints the net share
// of joint-venture revenue non-nil, so it is emitted.

const CONTEXT: LaneCoveGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Lane Cove Council Annual Report 2024-25 (containing the audited GPFS)',
    url: LANE_COVE_PDF_URL,
    fiscal_year: LANE_COVE_GPFS_FISCAL_YEAR,
    listing_url: LANE_COVE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/lane-cove-gpfs/lane-cove-council-annual-report-2024-25.pdf',
    sha256: LANE_COVE_PDF_SHA256,
    bytes: LANE_COVE_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: LANE_COVE_GPFS_REPORTING_URL,
};

/** Golden fixture for the lane-cove-gpfs module: 17 rows. */
export const LANE_COVE_GPFS_ROW_COUNT = 17;
export const LANE_COVE_GPFS_GOLDEN_DIGEST =
  'c3a349391ef87f7a42539a344053b552f09af2596415d73831a03c37a778cb80';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'c3a349391ef87f7a42539a344053b552f09af2596415d73831a03c37a778cb80';

export function goldenRecords() {
  const parsed = parseLaneCoveGpfsExtraction(laneCoveExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
