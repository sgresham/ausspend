import {
  LIVERPOOL_GPFS_FISCAL_YEAR,
  LIVERPOOL_GPFS_REPORTING_URL,
  parseLiverpoolGpfsExtraction,
  type LiverpoolGpfsParseContext,
} from './index.js';
import { LIVERPOOL_PDF_SHA256, LIVERPOOL_PDF_URL, liverpoolExtraction } from './fixture-data.js';

// Liverpool publishes a standalone audited financial statements PDF under the
// "Financial Year 2024/2025" table on its official Finance Reports page. Its
// Income Statement prints the Original unaudited budget column first, the
// FY2024-25 Actual column second and the FY2023-24 column third, each row's
// label and amounts on the same printed line. The printed borrowing-costs and
// net-gain-on-disposal lines are both non-nil and emitted.

const CONTEXT: LiverpoolGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Liverpool City Council Audited Financial Statements 2024-25',
    url: LIVERPOOL_PDF_URL,
    fiscal_year: LIVERPOOL_GPFS_FISCAL_YEAR,
    listing_url: LIVERPOOL_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/liverpool-gpfs/liverpool-city-council-audited-financial-statements-2024-25.pdf',
    sha256: LIVERPOOL_PDF_SHA256,
    bytes: 9_940_306,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: LIVERPOOL_GPFS_REPORTING_URL,
};

/** Golden fixture for the liverpool-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const LIVERPOOL_GPFS_ROW_COUNT = 17;
export const LIVERPOOL_GPFS_GOLDEN_DIGEST =
  '0b79970cf5d9c171736ed0fe24cb797abe0146c0f8cd6409aa873a8338113ce3';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '0b79970cf5d9c171736ed0fe24cb797abe0146c0f8cd6409aa873a8338113ce3';

export function goldenRecords() {
  const parsed = parseLiverpoolGpfsExtraction(liverpoolExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
