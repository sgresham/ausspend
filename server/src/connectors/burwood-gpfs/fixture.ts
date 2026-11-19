import {
  BURWOOD_GPFS_FISCAL_YEAR,
  BURWOOD_GPFS_REPORTING_URL,
  parseBurwoodGpfsExtraction,
  type BurwoodGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../pdf-extract.js';

// Representative pages from the official Burwood Council Annual Financial
// Statements for the year ended 30 June 2026 (70-page PDF; the GPFS primary
// statements are PDF pages 5-9 and B1-1 is PDF page 14). The fixture rebuilds
// the printed $'000 values and their x-positions so the adapter exercises the
// same positional multi-line-label row reader used on the live PDF.
export const BURWOOD_FS_PDF_URL =
  'https://participate.burwood.nsw.gov.au/download_file/2459/1036';
export const BURWOOD_FS_PDF_SHA256 =
  '9b6e3f8725e47823038329b269d955ef263d7cc6680aacea9b944320919f2e13';
export const BURWOOD_FS_PDF_BYTES = 4_450_607;

interface RowSpec {
  label?: string;
  labelX?: number;
  budget?: string;
  current?: string;
  prior?: string;
  note?: string;
  extra?: Array<{ str: string; x: number }>;
}

function buildPage(pageNumber: number, title: string, rows: RowSpec[]): PdfPage {
  const items: PdfTextItem[] = [];
  let y = 760;
  const push = (str: string, x: number): void => {
    items.push({ page_number: pageNumber, str, x, y, width: 0, height: 0 });
  };
  push(title, 50);
  y -= 16;
  push("$ '000", 81);
  y -= 6;
  for (const row of rows) {
    if (row.label) push(row.label, row.labelX ?? 120);
    if (row.budget) push(row.budget, 78);
    if (row.note) push(row.note, 375);
    if (row.current) push(row.current, 443);
    if (row.prior) push(row.prior, 513);
    for (const extra of row.extra ?? []) push(extra.str, extra.x);
    y -= 12;
  }
  return {
    page_number: pageNumber,
    text: items.map((item) => item.str).join(' '),
    items,
  };
}

const INCOME_ROWS: RowSpec[] = [
  { label: 'Income from continuing operations' },
  { label: 'Rates and annual charges', budget: '43,824', current: '43,883', prior: '40,942', note: 'B2-1' },
  { label: 'User charges and fees', budget: '9,762', current: '12,019', prior: '11,128', note: 'B2-2' },
  { label: 'Other revenues', budget: '7,361', current: '6,474', prior: '7,170', note: 'B2-3' },
  {
    label: 'Grants and contributions provided for operating purposes',
    budget: '3,336',
    current: '4,277',
    prior: '3,143',
    note: 'B2-4',
  },
  {
    label: 'Grants and contributions provided for capital purposes',
    budget: '28,965',
    current: '15,821',
    prior: '10,310',
    note: 'B2-4',
  },
  {
    label: 'Interest and investment income',
    budget: '2,350',
    current: '2,931',
    prior: '3,156',
    note: 'B2-5',
  },
  { label: 'Other income', budget: '2,940', current: '3,846', prior: '3,006', note: 'B2-6' },
  {
    label: 'Net gain from the disposal of assets',
    budget: '430',
    current: '–',
    prior: '–',
    note: 'B4-1',
  },
  {
    label: 'Total income from continuing operations',
    budget: '98,968',
    current: '89,251',
    prior: '78,855',
  },
  { label: 'Expenses from continuing operations' },
  {
    label: 'Employee benefits and on-costs',
    budget: '27,553',
    current: '26,800',
    prior: '24,021',
    note: 'B3-1',
  },
  {
    label: 'Materials and services',
    budget: '30,412',
    current: '28,667',
    prior: '28,686',
    note: 'B3-2',
  },
  { label: 'Borrowing costs', budget: '283', current: '409', prior: '290', note: 'B3-3' },
  { label: 'Other expenses', budget: '1,394', current: '1,239', prior: '1,164', note: 'B3-5' },
  {
    label: 'Net loss from the disposal of assets',
    budget: '–',
    current: '2,640',
    prior: '1,008',
    note: 'B4-1',
  },
  {
    label: 'Total expenses from continuing operations excluding',
    budget: '59,642',
  },
  {
    label: 'depreciation, amortisation and impairment of non-financial assets',
    current: '59,755',
    prior: '55,169',
  },
  {
    label: 'Operating result from continuing operations excluding',
    budget: '39,326',
  },
  {
    label: 'depreciation, amortisation and impairment of non-financial assets',
    current: '29,496',
    prior: '23,686',
  },
  {
    label: 'Depreciation and amortisation of intangible assets and',
    budget: '10,324',
  },
  {
    label: 'IPP&E',
    note: 'B3-4',
    current: '10,654',
    prior: '10,067',
  },
  {
    label: 'Operating result from continuing operations',
    budget: '29,002',
    current: '18,842',
    prior: '13,619',
  },
  {
    label: 'Net operating result for the year attributable to Council',
    budget: '29,002',
    current: '18,842',
    prior: '13,619',
  },
  {
    label: 'Net operating result for the year before grants and contributions',
    budget: '37',
  },
  {
    label: 'provided for capital purposes',
    current: '3,021',
    prior: '3,309',
  },
];

const COMPREHENSIVE_ROWS: RowSpec[] = [
  { label: 'Net operating result for the year – from Income Statement', current: '18,842', prior: '13,619', labelX: 50 },
  { label: 'Other comprehensive income:', labelX: 50 },
  { label: 'Amounts which will not be reclassified subsequent to operating result', labelX: 50 },
  {
    label: 'Gain on revaluation of infrastructure, property, plant and equipment',
    note: 'C1-6',
    current: '21,728',
    prior: '33,084',
    labelX: 50,
  },
  {
    label: 'Total items which will not be reclassified subsequent to operating result',
    current: '21,728',
    prior: '33,084',
    labelX: 50,
  },
  {
    label: 'Total other comprehensive income/loss for the year',
    current: '21,728',
    prior: '33,084',
    labelX: 50,
  },
  {
    label: 'Total comprehensive income/loss for the year attributable to Council',
    current: '40,570',
    prior: '46,703',
    labelX: 50,
  },
];

const POSITION_ROWS: RowSpec[] = [
  { label: 'ASSETS', labelX: 50 },
  { label: 'Current assets', labelX: 50 },
  { label: 'Cash and cash equivalents', note: 'C1-1', current: '10,615', prior: '9,161', labelX: 50 },
  { label: 'Investments', note: 'C1-2', current: '31,008', prior: '36,350', labelX: 50 },
  { label: 'Receivables', note: 'C1-4', current: '6,008', prior: '8,061', labelX: 50 },
  { label: 'Contract assets', note: 'C1-5', current: '1,762', prior: '485', labelX: 50 },
  { label: 'Other', note: 'C1-9', current: '1,084', prior: '1,943', labelX: 50 },
  { label: 'Total current assets', current: '50,477', prior: '56,000', labelX: 50 },
  { label: 'Non-current assets', labelX: 50 },
  { label: 'Investments', note: 'C1-2', current: '15,353', prior: '11,800', labelX: 50 },
  { label: 'Receivables', note: 'C1-4', current: '1,336', prior: '–', labelX: 50 },
  {
    label: 'Infrastructure, property, plant and equipment (IPPE)',
    note: 'C1-6',
    current: '580,685',
    prior: '554,882',
    labelX: 50,
  },
  { label: 'Investment property', note: 'C1-7', current: '49,425', prior: '31,970', labelX: 50 },
  { label: 'Intangible assets', note: 'C1-8', current: '53', prior: '115', labelX: 50 },
  { label: 'Right of use assets', note: 'C2-1', current: '–', prior: '248', labelX: 50 },
  { label: 'Total non-current assets', current: '646,852', prior: '599,015', labelX: 50 },
  { label: 'Total assets', current: '697,329', prior: '655,015', labelX: 50 },
  { label: 'LIABILITIES', labelX: 50 },
  { label: 'Current liabilities', labelX: 50 },
  { label: 'Payables', note: 'C3-1', current: '12,399', prior: '11,092', labelX: 50 },
  { label: 'Contract liabilities', note: 'C3-2', current: '3,053', prior: '6,746', labelX: 50 },
  { label: 'Lease liabilities', note: 'C2-1', current: '–', prior: '267', labelX: 50 },
  { label: 'Borrowings', note: 'C3-3', current: '1,359', prior: '416', labelX: 50 },
  { label: 'Employee benefit provisions', note: 'C3-4', current: '5,360', prior: '5,104', labelX: 50 },
  { label: 'Total current liabilities', current: '22,171', prior: '23,625', labelX: 50 },
  { label: 'Non-current liabilities', labelX: 50 },
  { label: 'Borrowings', note: 'C3-3', current: '6,638', prior: '3,444', labelX: 50 },
  { label: 'Employee benefit provisions', note: 'C3-4', current: '122', prior: '118', labelX: 50 },
  { label: 'Total non-current liabilities', current: '6,760', prior: '3,562', labelX: 50 },
  { label: 'Total liabilities', current: '28,931', prior: '27,187', labelX: 50 },
  { label: 'Net assets', current: '668,398', prior: '627,828', labelX: 50 },
  { label: 'EQUITY', labelX: 50 },
  { label: 'Accumulated surplus', note: 'C4-1', current: '302,006', prior: '283,164', labelX: 50 },
  {
    label: 'IPPE revaluation surplus',
    note: 'C4-1',
    current: '366,392',
    prior: '344,664',
    labelX: 50,
  },
  { label: 'Total equity', current: '668,398', prior: '627,828', labelX: 50 },
];

const EQUITY_ROWS: RowSpec[] = [
  {
    label: 'Opening balance at 1 July',
    labelX: 50,
    extra: [
      { str: '283,164', x: 459 },
      { str: '344,664', x: 514 },
      { str: '627,828', x: 569 },
      { str: '269,545', x: 649 },
      { str: '311,580', x: 704 },
      { str: '581,125', x: 759 },
    ],
  },
  {
    label: 'Net operating result for the year',
    labelX: 50,
    extra: [
      { str: '18,842', x: 459 },
      { str: '–', x: 514 },
      { str: '18,842', x: 569 },
      { str: '13,619', x: 649 },
      { str: '–', x: 704 },
      { str: '13,619', x: 759 },
    ],
  },
  {
    label: 'Other comprehensive income',
    labelX: 50,
    extra: [
      { str: '–', x: 459 },
      { str: '21,728', x: 514 },
      { str: '21,728', x: 569 },
      { str: '–', x: 649 },
      { str: '33,084', x: 704 },
      { str: '33,084', x: 759 },
    ],
  },
  {
    label: 'Total comprehensive income',
    labelX: 50,
    extra: [
      { str: '18,842', x: 459 },
      { str: '21,728', x: 514 },
      { str: '40,570', x: 569 },
      { str: '13,619', x: 649 },
      { str: '33,084', x: 704 },
      { str: '46,703', x: 759 },
    ],
  },
  {
    label: 'Closing balance at 30 June',
    labelX: 50,
    extra: [
      { str: '302,006', x: 459 },
      { str: '366,392', x: 514 },
      { str: '668,398', x: 569 },
      { str: '283,164', x: 649 },
      { str: '344,664', x: 704 },
      { str: '627,828', x: 759 },
    ],
  },
];

const CASH_ROWS: RowSpec[] = [
  { label: 'Cash flows from operating activities' },
  { label: 'Receipts:' },
  { label: 'Rates and annual charges', budget: '43,824', current: '44,074', prior: '41,032' },
  { label: 'User charges and fees', budget: '9,762', current: '12,176', prior: '11,608' },
  { label: 'Interest received', budget: '2,350', current: '2,651', prior: '3,078' },
  { label: 'Grants and contributions', budget: '32,301', current: '15,616', prior: '16,522' },
  { label: 'Bonds, deposits and retentions received', budget: '–', current: '530', prior: '428' },
  { label: 'Other', budget: '11,689', current: '13,771', prior: '8,122' },
  { label: 'Payments:' },
  { label: 'Payments to employees', budget: '(27,553)', current: '(26,110)', prior: '(24,343)' },
  {
    label: 'Payments for materials and services',
    budget: '(30,317)',
    current: '(28,362)',
    prior: '(29,816)',
  },
  { label: 'Borrowing costs', budget: '(283)', current: '(399)', prior: '(292)' },
  { label: 'Other', budget: '(1,395)', current: '(4,348)', prior: '(2,281)' },
  {
    label: 'Net cash flows from operating activities',
    note: 'F1-1',
    current: '29,599',
    prior: '24,058',
  },
  { label: 'Cash flows from investing activities' },
  { label: 'Receipts:' },
  { label: 'Sale of investments', budget: '–', current: '10,044', prior: '2,500' },
  { label: 'Proceeds from sale of IPPE', budget: '–', current: '117', prior: '430' },
  { label: 'Payments:' },
  { label: 'Purchase of investments', budget: '(5,000)', current: '–', prior: '–' },
  { label: 'Acquisition of term deposits', budget: '–', current: '(8,000)', prior: '(2,000)' },
  { label: 'Purchase of investment property', budget: '–', current: '(17,000)', prior: '(7,850)' },
  { label: 'Payments for IPPE', budget: '(33,198)', current: '(17,176)', prior: '(12,408)' },
  {
    label: 'Net cash flows from investing activities',
    current: '(32,015)',
    prior: '(19,328)',
  },
  { label: 'Cash flows from financing activities' },
  { label: 'Receipts:' },
  { label: 'Proceeds from borrowings', budget: '–', current: '5,000', prior: '–' },
  { label: 'Payments:' },
  { label: 'Repayment of borrowings', budget: '(688)', current: '(863)', prior: '(525)' },
  { label: 'Principal component of lease payments', budget: '(268)', current: '(267)', prior: '(261)' },
  { label: 'Net cash flows from financing activities', current: '3,870', prior: '(786)' },
  { label: 'Net change in cash and cash equivalents', current: '1,454', prior: '3,944' },
  {
    label: 'Cash and cash equivalents at end of year',
    note: 'C1-1',
    current: '10,615',
    prior: '9,161',
  },
];

const FUNCTIONS_ROWS: RowSpec[] = [
  { label: 'Functions or activities', labelX: 50 },
  {
    label: 'Total functions and activities',
    labelX: 50,
    extra: [
      { str: '89,251', x: 120 },
      { str: '78,855', x: 180 },
      { str: '70,409', x: 240 },
      { str: '65,236', x: 300 },
      { str: '18,842', x: 360 },
      { str: '13,619', x: 420 },
      { str: '20,098', x: 480 },
      { str: '13,453', x: 540 },
      { str: '697,329', x: 600 },
      { str: '655,015', x: 660 },
    ],
  },
];

export function burwoodExtraction(): PdfExtraction {
  return {
    source: {
      sha256: BURWOOD_FS_PDF_SHA256,
      bytes: BURWOOD_FS_PDF_BYTES,
    },
    pages: [
      buildPage(
        5,
        'Burwood Council Income Statement for the year ended 30 June 2026',
        INCOME_ROWS,
      ),
      buildPage(
        6,
        'Burwood Council Statement of Comprehensive Income for the year ended 30 June 2026',
        COMPREHENSIVE_ROWS,
      ),
      buildPage(
        7,
        'Burwood Council Statement of Financial Position as at 30 June 2026',
        POSITION_ROWS,
      ),
      buildPage(
        8,
        'Burwood Council Statement of Changes in Equity for the year ended 30 June 2026',
        EQUITY_ROWS,
      ),
      buildPage(
        9,
        'Burwood Council Statement of Cash Flows for the year ended 30 June 2026',
        CASH_ROWS,
      ),
      buildPage(
        14,
        'Burwood Council Notes to the Financial Statements 30 June 2026 B1-1 Functions or activities',
        FUNCTIONS_ROWS,
      ),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const BURWOOD_CONTEXT: BurwoodGpfsParseContext = {
  document: {
    id: 'annual-financial-statements-2025-26',
    title: 'Burwood Council Annual Financial Statements for the year ended 30 June 2026',
    url: BURWOOD_FS_PDF_URL,
    fiscal_year: BURWOOD_GPFS_FISCAL_YEAR,
    listing_url: BURWOOD_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'burwood-gpfs/burwood-council-annual-financial-statements-2026.pdf',
    sha256: BURWOOD_FS_PDF_SHA256,
    bytes: BURWOOD_FS_PDF_BYTES,
    fetched_at: '2026-11-20T00:00:00.000Z',
  },
  sourceDate: '2026-11-20',
  reporting_url: BURWOOD_GPFS_REPORTING_URL,
};

export const BURWOOD_INCOME_TEXT =
  'Burwood Council Income Statement for the year ended 30 June 2026 $ \'000 Income from continuing operations Rates and annual charges B2-1 43,883 40,942 User charges and fees B2-2 12,019 11,128 Other revenues B2-3 6,474 7,170 Grants and contributions provided for operating purposes B2-4 4,277 3,143 Grants and contributions provided for capital purposes B2-4 15,821 10,310 Interest and investment income B2-5 2,931 3,156 Other income B2-6 3,846 3,006 Net gain from the disposal of assets B4-1 – – Total income from continuing operations 89,251 78,855 Expenses from continuing operations Employee benefits and on-costs B3-1 26,800 24,021 Materials and services B3-2 28,667 28,686 Borrowing costs B3-3 409 290 Other expenses B3-5 1,239 1,164 Net loss from the disposal of assets B4-1 2,640 1,008 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 59,755 55,169 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 29,496 23,686 Depreciation and amortisation of intangible assets and IPP&E B3-4 10,654 10,067 Operating result from continuing operations 18,842 13,619 Net operating result for the year attributable to Council 18,842 13,619 Net operating result for the year before grants and contributions provided for capital purposes 3,021 3,309';

export const BURWOOD_FUNCTIONS_TEXT =
  'Burwood Council Notes to the Financial Statements 30 June 2026 B1-1 Functions or activities Functions or activities Total functions and activities 89,251 78,855 70,409 65,236 18,842 13,619 20,098 13,453 697,329 655,015 Page 13 of 70';

/** 18 printed rows: 9 revenue (8 components + total) + 8 expense + 1 result. */
export const BURWOOD_GPFS_ROW_COUNT = 18;
export const BURWOOD_GPFS_GOLDEN_DIGEST =
  'cf13420430c482c9d1ea7b622523c46d3f48a88013cf070dd22ed36564982510';
export const ROW_COUNT = BURWOOD_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = BURWOOD_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  return parseBurwoodGpfsExtraction(burwoodExtraction(), BURWOOD_CONTEXT).records;
}
