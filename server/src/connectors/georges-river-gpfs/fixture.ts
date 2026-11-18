import {
  GEORGES_RIVER_GPFS_FISCAL_YEAR,
  GEORGES_RIVER_GPFS_REPORTING_URL,
  parseGeorgesRiverGpfsExtraction,
  type GeorgesRiverGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  CONDUCT_REPORT_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './fixture-data.js';

// Georges River publishes a standalone Audited Financial Statement and Auditors
// Report PDF. The Income Statement prints the Original unaudited budget amount
// before each line label in the PDF text stream, so each emitted value is the
// first amount after the label (the FY2024-25 actual). The expense subtotal
// contains the phrase "depreciation, amortisation and impairment of non-financial
// assets", so the actual depreciation line is read from the last occurrence. The
// printed borrowing-costs line is nil and not emitted. Total expenses is the
// printed B1-1 total, which equals the printed face bridge exactly; the
// auditor's conduct-report narrative prints a different rounded figure and is
// flagged for a human spot check.

function textPage(text: string, pageNumber: number, items: PdfPage['items'] = []): PdfPage {
  return { page_number: pageNumber, text, items };
}

function extraction(
  overrides: {
    income?: string;
    functions?: string;
    comprehensive?: string;
    depreciation?: string;
    conductReport?: string;
  } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '97a46898f9fe5a0e2e8ea6e15817562217cfa6568bbdf7825f8d72a4da856a9f',
      bytes: 2_589_670,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 5),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 6),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
      textPage(overrides.depreciation ?? DEPRECIATION_TEXT, 26),
      textPage(overrides.conductReport ?? CONDUCT_REPORT_TEXT, 77),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.georgesriver.nsw.gov.au/StGeorge/media/Documents/Council/Publications/Audited-Financial-Statements-and-Auditors-Report-2024-2025.PDF';

const CONTEXT: GeorgesRiverGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Audited Financial Statement and Auditors Report for 1 July 2024 - 30 June 2025',
    url: PDF_URL,
    fiscal_year: GEORGES_RIVER_GPFS_FISCAL_YEAR,
    listing_url: GEORGES_RIVER_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/georges-river-gpfs/georges-river-council-audited-financial-statements-2024-25.pdf',
    sha256: '97a46898f9fe5a0e2e8ea6e15817562217cfa6568bbdf7825f8d72a4da856a9f',
    bytes: 2_589_670,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: GEORGES_RIVER_GPFS_REPORTING_URL,
};

/** Golden fixture for the georges-river-gpfs module migration: 16 rows, unchanged keys/amounts. */
export const GEORGES_RIVER_GPFS_ROW_COUNT = 16;
export const GEORGES_RIVER_GPFS_GOLDEN_DIGEST =
  '3d0d5cd394a3559e951a3d67484fe59e4f16c08777a5c7730b4eae890d21f7e4';
export const ROW_COUNT = 16;
export const GOLDEN_DIGEST = '3d0d5cd394a3559e951a3d67484fe59e4f16c08777a5c7730b4eae890d21f7e4';

export function goldenRecords() {
  const parsed = parseGeorgesRiverGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
