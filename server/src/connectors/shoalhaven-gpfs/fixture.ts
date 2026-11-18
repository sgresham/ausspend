import {
  SHOALHAVEN_GPFS_FISCAL_YEAR,
  SHOALHAVEN_GPFS_REPORTING_URL,
  parseShoalhavenGpfsExtraction,
  type ShoalhavenGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './fixture-data.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so each value read is the first amount after the label (the
// FY2024-25 actual). The expense subtotal and the "operating result excluding
// depreciation" line both contain the phrase "depreciation, amortisation and
// impairment of non-financial assets", so the actual depreciation line is read
// from the last occurrence. The Income Statement does not print a combined
// total-expenses line; total expenses is the printed B1-1 "Total functions and
// activities" total, which equals the printed expenses-excluding-depreciation
// line plus the printed depreciation/impairment line.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '74076e6f5b966575deb498e3805c9f5ff66aaa71ace5b001972f7d33313add20',
      bytes: 5_881_682,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 5),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 6),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
      textPage(DEPRECIATION_TEXT, 25),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://doc.shoalhaven.nsw.gov.au/LinkGeneratorAPI/record/10102076/preview_latest_final_version_pdf';

const CONTEXT: ShoalhavenGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Financial Statements 2024-2025',
    url: PDF_URL,
    fiscal_year: SHOALHAVEN_GPFS_FISCAL_YEAR,
    listing_url:
      'https://www.shoalhaven.nsw.gov.au/Council/Publicly-available-information/Finance/Financial-Statements-Previous-Years',
    reporting_url: SHOALHAVEN_GPFS_REPORTING_URL,
    record_uri: '10102076',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/shoalhaven-gpfs/shoalhaven-city-council-financial-statements-2024-25.pdf',
    sha256: '74076e6f5b966575deb498e3805c9f5ff66aaa71ace5b001972f7d33313add20',
    bytes: 5_881_682,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: SHOALHAVEN_GPFS_REPORTING_URL,
};

/** Golden fixture for the shoalhaven-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const SHOALHAVEN_GPFS_ROW_COUNT = 17;
export const SHOALHAVEN_GPFS_GOLDEN_DIGEST =
  '129ec7277eb63a72c8e852313b037518e2f10276434c6f906da3b7a40e6aa706';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '129ec7277eb63a72c8e852313b037518e2f10276434c6f906da3b7a40e6aa706';

export function goldenRecords() {
  const parsed = parseShoalhavenGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
