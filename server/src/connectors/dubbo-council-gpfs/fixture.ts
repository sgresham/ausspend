import {
  DUBBO_GPFS_FISCAL_YEAR,
  DUBBO_GPFS_REPORTING_URL,
  parseDubboGpfsExtraction,
  type DubboGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

const INCOME_TEXT = [
  'Dubbo Regional Council | Income Statement | for the year ended 30 June 2025',
  "$ '000 Original unaudited budget Actual Actual 2025 2024",
  'Income from continuing operations',
  '78,511 Rates and annual charges B2-1 80,278 74,641',
  '46,195 User charges and fees B2-2 55,081 54,418',
  '2,998 Other revenues B2-3 5,223 3,505',
  '20,325 Grants and contributions provided for operating purposes B2-4 20,061 32,079',
  '19,555 Grants and contributions provided for capital purposes B2-4 59,726 33,122',
  '8,836 Interest and investment income B2-5 14,365 12,971',
  'Other income B2-6 193 160',
  '176,420 Total income from continuing operations 234,927 210,896',
  'Expenses from continuing operations',
  '53,659 Employee benefits and on-costs B3-1 49,204 49,340',
  '54,604 Materials and services B3-2 59,076 63,102',
  '2,134 Borrowing costs B3-3 871 3,037',
  '2,931 Other expenses B3-5 2,880 2,824',
  '(2,694) Net loss from the disposal of assets B4-1 5,035 4,489',
  '110,634 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 117,066 122,792',
  '65,786 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 117,861 88,104',
  '66,010 Depreciation, amortisation and impairment of non-financial assets B3-4 57,859 58,525',
  '(224) Operating result from continuing operations 60,002 29,579',
  '(224) Net operating result for the year attributable to Council 60,002 29,579',
  '(19,779) Net operating result for the year before grants and contributions provided for capital purposes 276 (3,543)',
].join(' ');

const FUNCTIONS_TEXT = [
  'Dubbo Regional Council | Notes to the Financial Statements 30 June 2025',
  'B Financial Performance B1 Functions or activities',
  'B1-1 Functions or activities – income, expenses and assets',
  "$ '000 Income Expenses Operating result Grants and contributions Carrying amount of assets",
  '2025 2024 2025 2024 2025 2024 2025 2024 2025 2024',
  'Functions or activities Governance – – 444 650 (444) (650) – – – –',
  'Administration 412 1,357 538 (7,294) (126) 8,651 10 – 233,117 197,697',
  'Total functions and activities 234,927 210,896 174,925 181,317 60,002 29,579 79,787 65,201 3,187,561 3,058,255',
].join(' ');

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(overrides: { income?: string; functions?: string } = {}): PdfExtraction {
  return {
    source: { sha256: 'a'.repeat(64), bytes: 1 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 5),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: DubboGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: '2024/2025 Dubbo Regional Council Financial Statements',
    url: 'https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/20242025%20-%20Annual%20Financial%20Statements%20-%20Final%20for%20website.PDF.aspx',
    fiscal_year: DUBBO_GPFS_FISCAL_YEAR,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2024-25.pdf',
    sha256: 'd9213cea468547a318548dfd72d7faa0d9fd2da81bcf6835138d10b58914a43f',
    bytes: 1_807_768,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: DUBBO_GPFS_REPORTING_URL,
};

/** Golden fixture for the dubbo-council-gpfs module migration: 18 rows, unchanged keys/amounts. */
export const DUBBO_GPFS_ROW_COUNT = 18;
export const DUBBO_GPFS_GOLDEN_DIGEST =
  '6bf5c4116e3cbb982635bab756c7425c3e1a85e94e678384992fe1da1952a2b8';
export const ROW_COUNT = 18;
export const GOLDEN_DIGEST = '6bf5c4116e3cbb982635bab756c7425c3e1a85e94e678384992fe1da1952a2b8';

export function goldenRecords() {
  const parsed = parseDubboGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
