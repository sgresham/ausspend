import {
  STRATHFIELD_GPFS_FISCAL_YEAR,
  STRATHFIELD_GPFS_REPORTING_URL,
  parseStrathfieldGpfsExtraction,
  type StrathfieldGpfsParseContext,
} from './index.js';
import {
  STRATHFIELD_PDF_BYTES,
  STRATHFIELD_PDF_SHA256,
  STRATHFIELD_PDF_URL,
  strathfieldExtraction,
} from './fixture-data.js';

// Strathfield publishes a standalone audited General Purpose Financial
// Statements PDF linked from its official Reports and Registers page under the
// printed link text "Annual Financial Statement 2024 - 2025". Its Income
// Statement prints the Original unaudited budget column first, the FY2024-25
// Actual column second and the FY2023-24 column third, each row's label and
// amounts on the same printed line.

const CONTEXT: StrathfieldGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statement 2024 - 2025',
    url: STRATHFIELD_PDF_URL,
    fiscal_year: STRATHFIELD_GPFS_FISCAL_YEAR,
    listing_url: STRATHFIELD_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/strathfield-gpfs/strathfield-municipal-council-financial-statements-2024-25.pdf',
    sha256: STRATHFIELD_PDF_SHA256,
    bytes: STRATHFIELD_PDF_BYTES,
    fetched_at: '2026-11-18T02:10:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: STRATHFIELD_GPFS_REPORTING_URL,
};

export const STRATHFIELD_GPFS_ROW_COUNT = 17;
export const STRATHFIELD_GPFS_GOLDEN_DIGEST =
  'c4f1f8977764ea1ac5b1d40825c519977b167afb7d15b4ace9599ae21ffb2cb4';
export const ROW_COUNT = STRATHFIELD_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = STRATHFIELD_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseStrathfieldGpfsExtraction(strathfieldExtraction(), CONTEXT);
  return parsed.records;
}
