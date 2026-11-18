import {
  CANADA_BAY_GPFS_FISCAL_YEAR,
  CANADA_BAY_GPFS_REPORTING_URL,
  parseCanadaBayGpfsExtraction,
  type CanadaBayGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './fixture-data.js';

// Canada Bay publishes its audited financial reports inside its Annual Report.
// The Income Statement prints the Original unaudited budget amount before each
// line label in the PDF text stream, so each emitted value is the first amount
// after the label (the FY2024-25 actual). The expense subtotal contains the
// phrase "depreciation, amortisation and impairment of non-financial assets", so
// the actual depreciation line is read from the last occurrence. Total expenses
// is the printed B1-1 total, which equals the face-statement bridge exactly.

function textPage(text: string, pageNumber: number, items: PdfPage['items'] = []): PdfPage {
  return { page_number: pageNumber, text, items };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'c83a0b579bf0f3bb493f154f2ef1cc089fe5490b844d5ad62d6ff0a400ab9776',
      bytes: 35_521_573,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 133),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 134),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 142),
      textPage(DEPRECIATION_TEXT, 155),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://canadabay.t1cloud.com/T1Default/CiAnywhere/Web/CANADABAY/API/CMIS/PUB/content/?id=folder-8769276&streamId=streampdf-8769276';

const CONTEXT: CanadaBayGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Annual Report 2024-2025',
    url: PDF_URL,
    fiscal_year: CANADA_BAY_GPFS_FISCAL_YEAR,
    listing_url: CANADA_BAY_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/canada-bay-gpfs/canada-bay-council-annual-report-2024-25.pdf',
    sha256: 'c83a0b579bf0f3bb493f154f2ef1cc089fe5490b844d5ad62d6ff0a400ab9776',
    bytes: 35_521_573,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: CANADA_BAY_GPFS_REPORTING_URL,
};

/** Golden fixture for the canada-bay-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const CANADA_BAY_GPFS_ROW_COUNT = 17;
export const CANADA_BAY_GPFS_GOLDEN_DIGEST =
  '44df1747d894845e89bd9dd380129fc6b630e11ce7a66610f326925d28316491';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '44df1747d894845e89bd9dd380129fc6b630e11ce7a66610f326925d28316491';

export function goldenRecords() {
  const parsed = parseCanadaBayGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
