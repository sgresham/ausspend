import {
  THE_HILLS_GPFS_FISCAL_YEAR,
  THE_HILLS_GPFS_REPORTING_URL,
  parseTheHillsGpfsExtraction,
  type TheHillsGpfsParseContext,
} from './index.js';
import {
  THE_HILLS_PDF_BYTES,
  THE_HILLS_PDF_SHA256,
  THE_HILLS_PDF_URL,
  theHillsExtraction,
} from './fixture-data.js';

// The Hills' official Annual Report Archive page links "The Hills Shire Council
// Financial Statements 2024-2025" directly. Its Income Statement prints the Original
// unaudited budget column first, the FY2024-25 Actual column second and the
// FY2023-24 column third. FY2024-25 has no discontinued operation, so the printed
// continuing operating result and the net result repeated in comprehensive
// income are the same. The B1-1 function split is a second cut of the
// same printed total expenses.

const CONTEXT: TheHillsGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'The Hills Shire Council Financial Statements 2024-25',
    url: THE_HILLS_PDF_URL,
    fiscal_year: THE_HILLS_GPFS_FISCAL_YEAR,
    listing_url: THE_HILLS_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '~/ausspend-source-archive/the-hills-gpfs/the-hills-shire-council-financial-statements-2024-25.pdf',
    sha256: THE_HILLS_PDF_SHA256,
    bytes: THE_HILLS_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: THE_HILLS_GPFS_REPORTING_URL,
};

/** Golden fixture for the the-hills-gpfs module: 17 rows. */
export const THE_HILLS_GPFS_ROW_COUNT = 17;
export const THE_HILLS_GPFS_GOLDEN_DIGEST =
  '10fb86cd5a488bcd7134e09d015030ec10f17ad10bf3c7e05cc97fbd8de7d3fd';
export const ROW_COUNT = THE_HILLS_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = THE_HILLS_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseTheHillsGpfsExtraction(theHillsExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
