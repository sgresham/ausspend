import {
  MOSMAN_GPFS_FISCAL_YEAR,
  MOSMAN_GPFS_REPORTING_URL,
  parseMosmanGpfsExtraction,
  type MosmanGpfsParseContext,
} from './index.js';
import {
  MOSMAN_PDF_BYTES,
  MOSMAN_PDF_SHA256,
  MOSMAN_PDF_URL,
  mosmanExtraction,
} from './fixture-data.js';

// Mosman publishes a standalone audited General Purpose Financial Statements
// PDF linked from its official Financial Reports page under the printed link
// text "Financial Statements for the Year Ended 30 June 2025". Its Income
// Statement prints the Original unaudited budget column first, the FY2024-25
// Actual column second and the FY2023-24 column third, each row's label and
// amounts on the same printed line. B1-1 prints total income and total expenses
// $1 thousand above the face-statement components due to printed rounding.

const CONTEXT: MosmanGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements for the Year Ended 30 June 2025',
    url: MOSMAN_PDF_URL,
    fiscal_year: MOSMAN_GPFS_FISCAL_YEAR,
    listing_url: MOSMAN_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/mosman-gpfs/mosman-council-annual-financial-statements-2024-25.pdf',
    sha256: MOSMAN_PDF_SHA256,
    bytes: MOSMAN_PDF_BYTES,
    fetched_at: '2026-11-18T02:04:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: MOSMAN_GPFS_REPORTING_URL,
};

export const MOSMAN_GPFS_ROW_COUNT = 18;
export const MOSMAN_GPFS_GOLDEN_DIGEST =
  'cd584af95186d2456da557fe861ff564186783cbe686942086b94b64a81ada68';
export const ROW_COUNT = MOSMAN_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = MOSMAN_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseMosmanGpfsExtraction(mosmanExtraction(), CONTEXT);
  return parsed.records;
}
