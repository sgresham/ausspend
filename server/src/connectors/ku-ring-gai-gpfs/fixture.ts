import {
  KU_RING_GAI_GPFS_FISCAL_YEAR,
  KU_RING_GAI_GPFS_REPORTING_URL,
  parseKuRingGaiGpfsExtraction,
  type KuRingGaiGpfsParseContext,
} from './index.js';
import {
  KU_RING_GAI_PDF_BYTES,
  KU_RING_GAI_PDF_SHA256,
  KU_RING_GAI_PDF_URL,
  kuRingGaiExtraction,
} from './fixture-data.js';

// Ku-ring-gai publishes a standalone Annual Financial Statements PDF linked
// from its official Finance page under the printed link text "Financial
// statements 2024-2025". Its Income Statement prints the Original unaudited
// budget column first, the FY2024-25 Actual column second and the FY2023-24
// column third, each row's label and amounts on the same printed line. The
// audited GPFS prints the borrowed-costs and net-gain-on-disposal lines
// non-nil, so both are emitted.

const CONTEXT: KuRingGaiGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Ku-ring-gai Council Annual Financial Statements 2024-25',
    url: KU_RING_GAI_PDF_URL,
    fiscal_year: KU_RING_GAI_GPFS_FISCAL_YEAR,
    listing_url: KU_RING_GAI_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/ku-ring-gai-gpfs/ku-ring-gai-council-annual-financial-statements-2024-25.pdf',
    sha256: KU_RING_GAI_PDF_SHA256,
    bytes: KU_RING_GAI_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: KU_RING_GAI_GPFS_REPORTING_URL,
};

/** Golden fixture for the ku-ring-gai-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const KU_RING_GAI_GPFS_ROW_COUNT = 17;
export const KU_RING_GAI_GPFS_GOLDEN_DIGEST =
  'a927b8bcd6eda754ed213bd6764185ee2b6f89e0cfc0994d279e717a84535db5';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'a927b8bcd6eda754ed213bd6764185ee2b6f89e0cfc0994d279e717a84535db5';

export function goldenRecords() {
  const parsed = parseKuRingGaiGpfsExtraction(kuRingGaiExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
