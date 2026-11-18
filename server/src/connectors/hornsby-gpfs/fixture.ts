import { createHash } from 'node:crypto';
import {
  HORNSBY_GPFS_FISCAL_YEAR,
  HORNSBY_GPFS_REPORTING_URL,
  parseHornsbyGpfsExtraction,
  type HornsbyGpfsParseContext,
} from './index.js';
import {
  HORNSBY_PDF_BYTES,
  HORNSBY_PDF_SHA256,
  HORNSBY_PDF_URL,
  hornsbyExtraction,
} from './fixture-data.js';

// Hornsby's official Financial Statements page lists "Annual Financial
// Statements 2025/26" first; its Income Statement prints the Original
// unaudited budget column first, the FY2025-26 Actual column second and the
// FY2024-25 column third. FY2025-26 has no discontinued operation, so the
// printed continuing operating result and the net result repeated in
// comprehensive income are the same. The B1-1 function expense split is a
// second cut of the same printed total expenses.

export const HORNSBY_GPFS_CONTEXT: HornsbyGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title:
      'Hornsby Shire Council Annual Financial Statements 2025-26 (General Purpose Financial Statements)',
    url: HORNSBY_PDF_URL,
    fiscal_year: HORNSBY_GPFS_FISCAL_YEAR,
    listing_url: HORNSBY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '~/ausspend-source-archive/hornsby-gpfs/hornsby-shire-council-annual-financial-statements-2025-26.pdf',
    sha256: HORNSBY_PDF_SHA256,
    bytes: HORNSBY_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: HORNSBY_GPFS_REPORTING_URL,
};

/** Golden fixture for the hornsby-gpfs module: 22 rows. */
export const HORNSBY_GPFS_ROW_COUNT = 22;
export const ROW_COUNT = HORNSBY_GPFS_ROW_COUNT;

export function goldenRecords() {
  const parsed = parseHornsbyGpfsExtraction(hornsbyExtraction(), HORNSBY_GPFS_CONTEXT);
  return parsed.records;
}

export function goldenDigest(records = goldenRecords()): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        records.map((record) => ({
          natural_key: record.natural_key,
          amount_cents: record.amount_cents,
        })),
      ),
    )
    .digest('hex');
}

export const GOLDEN_DIGEST = goldenDigest();
