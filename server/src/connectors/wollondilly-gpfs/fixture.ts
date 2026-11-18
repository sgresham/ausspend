import {
  WOLLONDILLY_GPFS_FISCAL_YEAR,
  WOLLONDILLY_GPFS_REPORTING_URL,
  parseWollondillyGpfsExtraction,
  type WollondillyGpfsParseContext,
} from './index.js';
import {
  WOLLONDILLY_PDF_BYTES,
  WOLLONDILLY_PDF_SHA256,
  WOLLONDILLY_PDF_URL,
  wollondillyExtraction,
} from './fixture-data.js';

// Wollondilly's official "Council's Financial Statements" page links the latest
// standalone audited General Purpose Financial Statements PDF. Its Income
// Statement prints the Original unaudited budget column first, the FY2024-25
// Actual column second and the FY2023-24 column third, with the label followed
// by the amounts on the same printed line. FY2024-25 has no discontinued
// operation, so the printed continuing operating result equals the statutory
// net operating result.

const CONTEXT: WollondillyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Wollondilly Shire Council Audited Financial Statements 2024-25',
    url: WOLLONDILLY_PDF_URL,
    fiscal_year: WOLLONDILLY_GPFS_FISCAL_YEAR,
    listing_url: WOLLONDILLY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/wollondilly-gpfs/wollondilly-shire-council-audited-financial-statements-2024-25.pdf',
    sha256: WOLLONDILLY_PDF_SHA256,
    bytes: WOLLONDILLY_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: WOLLONDILLY_GPFS_REPORTING_URL,
};

/** Golden fixture for the wollondilly-gpfs module: 18 rows. */
export const WOLLONDILLY_GPFS_ROW_COUNT = 18;
export const WOLLONDILLY_GPFS_GOLDEN_DIGEST =
  'addb83c23e92cc1765af35e4be839bc0f4576f3f7672d75a2bbd88561e86f96d';
export const ROW_COUNT = 18;
export const GOLDEN_DIGEST = 'addb83c23e92cc1765af35e4be839bc0f4576f3f7672d75a2bbd88561e86f96d';

export function goldenRecords() {
  const parsed = parseWollondillyGpfsExtraction(wollondillyExtraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
