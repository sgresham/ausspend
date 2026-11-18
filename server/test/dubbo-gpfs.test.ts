import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  DUBBO_GPFS_FISCAL_YEAR,
  DUBBO_GPFS_ID,
  DUBBO_GPFS_LICENSE,
  DUBBO_GPFS_NAME,
  DUBBO_GPFS_OLG_EXPENSES_CENTS,
  DUBBO_GPFS_OLG_REVENUE_CENTS,
  DUBBO_GPFS_PUBLISHER,
  DUBBO_GPFS_REPORTING_URL,
  DUBBO_GPFS_SUPPORTED_FISCAL_YEARS,
  detectDubboGpfsUnit,
  dubboGpfsNaturalKey,
  fiscalYearFromGpfsLink,
  parseDubboGpfsExtraction,
  parseDubboGpfsReportLinks,
  selectDubboGpfsDocument,
  type DubboGpfsParseContext,
} from '../src/connectors/dubbo-council-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

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

const FY2023_24_INCOME_TEXT = [
  'Dubbo Regional Council | Income Statement | for the year ended 30 June 2024',
  "§Statement§ Original unaudited budget Actual Actual 2024 $ '000 Notes 2024 2023",
  'Income from continuing operations',
  '73,156 Rates and annual charges 74,641 72,492',
  '42,599 User charges and fees 54,418 44,916',
  '2,545 Other revenues 3,505 3,405',
  '21,075 Grants and contributions provided for operating purposes 32,079 28,542',
  '32,306 Grants and contributions provided for capital purposes 33,122 56,552',
  '7,815 Interest and investment income 12,971 7,662',
  '– Other income 160 71',
  '179,496 Total income from continuing operations 210,896 213,640',
  'Expenses from continuing operations',
  '52,216 Employee benefits and on-costs 49,340 47,319',
  '46,540 Materials and services 63,102 51,966',
  '2,455 Borrowing costs 3,037 2,995',
  '50,133 Depreciation, amortisation and impairment of non-financial assets 58,525 54,323',
  '2,716 Other expenses 2,824 3,045',
  '(6,916) Net loss from the disposal of assets 4,489 3,276',
  '147,144 Total expenses from continuing operations 181,317 162,924',
  '32,352 Operating result from continuing operations 29,579 50,716',
  'Discontinued operations',
  '– Operating result from discontinued operations – –',
  '32,352 Net operating result for the year attributable to Council 29,579 50,716',
  '46 Net operating result for the year before grants and contributions provided for capital purposes (3,543) (5,836)',
  'Dubbo Regional Council Income Statement for the year ended 30 June 2024 Page 4 of 83',
].join(' ');

const FY2023_24_FUNCTIONS_TEXT = [
  'B Financial Performance B1 Functions or activities',
  'Functions or activities – income, expenses and assets',
  "$ '000 Income Expenses Operating result Grants and contributions Carrying amount of assets",
  '2024 2023 2024 2023 2024 2023 2024 2023 2024 2023',
  'Functions or activities Governance – 11 650 635 (650) (624) – – – –',
  'Administration 1,357 1,910 (7,294) 9,313 8,651 (7,403) – – 197,697 206,566',
  'Total functions and activities 210,896 213,640 181,317 162,924 29,579 50,716 65,201 85,094 3,058,255 2,916,140',
  'Page 14 of 83 Dubbo Regional Council | Notes to the Financial Statements 30 June 2024',
].join(' ');

function extraction202324(overrides: { income?: string; functions?: string } = {}): PdfExtraction {
  return {
    source: { sha256: 'c'.repeat(64), bytes: 1 },
    pages: [
      pdfPage(overrides.income ?? FY2023_24_INCOME_TEXT, 5),
      pdfPage(overrides.functions ?? FY2023_24_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT_2023_24: DubboGpfsParseContext = {
  document: {
    id: 'gpfs-2023-24',
    title: '2023/2024 Dubbo Regional Council Financial Statements',
    url: 'https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/2023-2024%20Dubbo%20Regional%20Council%20Financial%20Statements.pdf.aspx',
    fiscal_year: '2023-24',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2023-24.pdf',
    sha256: '3c2ee369960e0a78fece6716638bfa4628487445105948de65c3cc8deb0d66fe',
    bytes: 2_677_519,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: DUBBO_GPFS_REPORTING_URL,
};

function parsedFixture202324() {
  return parseDubboGpfsExtraction(extraction202324(), CONTEXT_2023_24);
}

const FY2025_26_INCOME_TEXT = [
  'Dubbo Regional Council | Income Statement | for the year ended 30 June 2026',
  "§Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025",
  'Income from continuing operations',
  '83,691 Rates and annual charges 84,034 80,278',
  '55,551 User charges and fees 63,474 55,081',
  '3,448 Other revenues 4,312 5,223',
  '21,677 Grants and contributions provided for operating purposes 30,491 20,061',
  '20,437 Grants and contributions provided for capital purposes 28,315 59,726',
  '9,367 Interest and investment income 14,696 14,365',
  '– Other income 172 193',
  '– Net gain from the disposal of assets 864 –',
  '194,171 Total income from continuing operations 226,358 234,927',
  'Expenses from continuing operations',
  '57,238 Employee benefits and on-costs 57,396 49,204',
  '55,112 Materials and services 56,028 59,076',
  '1,918 Borrowing costs 2,458 871',
  '2,878 Other expenses 2,872 2,880',
  '1,765 Net loss from the disposal of assets – 5,035',
  '118,911 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 118,754 117,066',
  '75,260 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 107,604 117,861',
  '59,871 Depreciation, amortisation and impairment of non-financial assets 61,576 57,859',
  '15,389 Operating result from continuing operations 46,028 60,002',
  '15,389 Net operating result for the year attributable to Council 46,028 60,002',
  '(5,047) Net operating result for the year before grants and contributions provided for capital purposes 17,713 276',
  'Dubbo Regional Council Income Statement for the year ended 30 June 2026 Page 4 of 80',
].join(' ');

const FY2025_26_FUNCTIONS_TEXT = [
  'B Financial Performance B1 Functions or activities',
  'Functions or activities – income, expenses and assets',
  "$ '000 Income Expenses Operating result Grants and contributions Carrying amount of assets",
  '2026 2025 2026 2025 2026 2025 2026 2025 2026 2025',
  'Functions or activities 1 Community, Culture and Places 8,943 11,882 35,534 34,661 (26,591) (22,779) 4,763 7,211 252,478 247,654',
  'Total functions and activities 226,358 234,927 180,330 174,925 46,028 60,002 58,806 79,787 3,331,132 3,187,561',
  'Page 13 of 80 Dubbo Regional Council | Notes to the Financial Statements 30 June 2026',
].join(' ');

function extraction202526(overrides: { income?: string; functions?: string } = {}): PdfExtraction {
  return {
    source: { sha256: 'd'.repeat(64), bytes: 1 },
    pages: [
      pdfPage(overrides.income ?? FY2025_26_INCOME_TEXT, 5),
      pdfPage(overrides.functions ?? FY2025_26_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT_2025_26: DubboGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: '2025/2026 Dubbo Regional Council Financial Statements',
    url: 'https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/2025-2026%20Annual%20Financial%20Statements%20-%20Dubbo%20Regional%20Council.pdf.aspx',
    fiscal_year: '2025-26',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2025-26.pdf',
    sha256: 'b6f52c9377952c6d72d011cda4c1cc0fda16c3aff32d501a05a263e3fd7d4fb5',
    bytes: 2_940_971,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: DUBBO_GPFS_REPORTING_URL,
};

function parsedFixture202526() {
  return parseDubboGpfsExtraction(extraction202526(), CONTEXT_2025_26);
}

const FY2022_23_INCOME_TEXT = [
  'Dubbo Regional Council | Income Statement | for the year ended 30 June 2023',
  "§Statement§ Original unaudited budget Actual Actual 2023 $ '000 Notes 2023 2022",
  'Income from continuing operations',
  '71,250 Rates and annual charges 72,492 69,356',
  '40,749 User charges and fees 44,916 39,771',
  '2,826 Other revenues 3,405 5,062',
  '21,002 Grants and contributions provided for operating purposes 28,542 26,053',
  '25,089 Grants and contributions provided for capital purposes 56,552 49,260',
  '1,621 Interest and investment income 7,662 3,006',
  '– Other income 71 158',
  '162,537 Total income from continuing operations 213,640 192,666',
  'Expenses from continuing operations',
  '49,777 Employee benefits and on-costs 47,319 44,485',
  '46,213 Materials and services 51,966 46,710',
  '2,795 Borrowing costs 2,995 2,981',
  '45,103 Depreciation, amortisation and impairment of non-financial assets 54,323 48,457',
  '2,627 Other expenses 3,045 2,438',
  '(5,580) Net loss from the disposal of assets 3,276 7,149',
  '140,935 Total expenses from continuing operations 162,924 152,220',
  '21,602 Operating result from continuing operations 50,716 40,446',
  '21,602 Net operating result for the year attributable to Council 50,716 40,446',
  '(3,487) Net operating result for the year before grants and contributions provided for capital purposes (5,836) (8,814)',
  'Dubbo Regional Council Income Statement for the year ended 30 June 2023 Page 4 of 90',
].join(' ');

const FY2022_23_FUNCTIONS_TEXT = [
  'B Financial Performance B1 Functions or activities',
  'Functions or activities – income, expenses and assets',
  'Income Expenses Operating result Grants and contributions Carrying amount of assets',
  '2023 2022 2023 2022 2023 2022 2023 2022 2023 2022',
  "$ '000 Restated Functions or activities",
  'Total functions and activities 213,640 192,666 162,924 152,220 50,716 40,446 85,094 75,313 2,916,140 2,942,568',
  'Page 14 of 90 Dubbo Regional Council | Notes to the Financial Statements 30 June 2023',
].join(' ');

function extraction202223(overrides: { income?: string; functions?: string } = {}): PdfExtraction {
  return {
    source: { sha256: 'e'.repeat(64), bytes: 1 },
    pages: [
      pdfPage(overrides.income ?? FY2022_23_INCOME_TEXT, 5),
      pdfPage(overrides.functions ?? FY2022_23_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT_2022_23: DubboGpfsParseContext = {
  document: {
    id: 'gpfs-2022-23',
    title: '2022/2023 Dubbo Regional Council Financial Statements',
    url: 'https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Annual%20Financial%20Statements-%20%202022-2023%20(1).pdf.aspx',
    fiscal_year: '2022-23',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2022-23.pdf',
    sha256: 'b663ddc3a8a5fca8f1887de978a1df7d1cecd24550815fdc7c1c64209074212a',
    bytes: 3_665_534,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: DUBBO_GPFS_REPORTING_URL,
};

function parsedFixture202223() {
  return parseDubboGpfsExtraction(extraction202223(), CONTEXT_2022_23);
}

const FY2021_22_INCOME_TEXT = [
  'Dubbo Regional Council | Income Statement | for the year ended 30 June 2022',
  "§Statement§ Original unaudited budget Actual Actual 2022 $ '000 Notes 2022 2021",
  'Income from continuing operations',
  '68,303 Rates and annual charges 69,356 66,845',
  '43,878 User charges and fees 39,771 39,776',
  '2,544 Other revenues 5,062 2,628',
  '21,279 Grants and contributions provided for operating purposes 26,053 22,054',
  '18,387 Grants and contributions provided for capital purposes 49,260 48,265',
  '2,485 Interest and investment income 3,006 3,703',
  '– Other income 158 37',
  '2,600 Net gain from the disposal of assets – 3,446',
  '159,476 Total income from continuing operations 192,666 186,754',
  'Expenses from continuing operations',
  '45,506 Employee benefits and on-costs 44,485 44,932',
  '53,267 Materials and services 46,710 53,696',
  '3,130 Borrowing costs 2,981 3,095',
  '44,135 Depreciation, amortisation and impairment of non-financial assets 48,457 45,551',
  '2,646 Other expenses 2,438 2,356',
  '– Net loss from the disposal of assets 7,149 –',
  '148,684 Total expenses from continuing operations 152,220 149,630',
  '10,792 Operating result from continuing operations 40,446 37,124',
  '10,792 Net operating result for the year attributable to Council 40,446 37,124',
  '(7,595) Net operating result for the year before grants and contributions provided for capital purposes (8,814) (11,141)',
  'Dubbo Regional Council Income Statement for the year ended 30 June 2022 Page 4 of 89',
].join(' ');

const FY2021_22_FUNCTIONS_TEXT = [
  'B Financial Performance B1 Functions or activities',
  'Functions or activities – income, expenses and assets',
  'Income Expenses Operating result Grants and contributions Carrying amount of assets',
  "$ '000 2022 2021 2022 2021 2022 2021 2022 2021 2022 2021",
  'Functions or activities Governance 31 25 1,216 604 (1,185) (579) – – – –',
  'Total functions and activities 192,666 186,942 152,220 149,630 40,446 37,312 75,313 70,319 2,957,308 2,715,495',
  'Page 14 of 89 Dubbo Regional Council | Notes to the Financial Statements 30 June 2022',
].join(' ');

function extraction202122(overrides: { income?: string; functions?: string } = {}): PdfExtraction {
  return {
    source: { sha256: 'f'.repeat(64), bytes: 1 },
    pages: [
      pdfPage(overrides.income ?? FY2021_22_INCOME_TEXT, 5),
      pdfPage(overrides.functions ?? FY2021_22_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT_2021_22: DubboGpfsParseContext = {
  document: {
    id: 'gpfs-2021-22',
    title: '2021/2022 Dubbo Regional Council Financial Statements',
    url: 'https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Annual%20Financial%20Statements%202021-2022%20(1).pdf.aspx',
    fiscal_year: '2021-22',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2021-22.pdf',
    sha256: 'd28778f441953f17b01e78b2797c8bac9e34b1e42b94ba1777d7a922516a6153',
    bytes: 3_891_387,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: DUBBO_GPFS_REPORTING_URL,
};

function parsedFixture202122() {
  return parseDubboGpfsExtraction(extraction202122(), CONTEXT_2021_22);
}

const FY2020_21_INCOME_TEXT = [
  'Dubbo Regional Council | Income Statement | For the year ended 30 June 2021',
  "§Statement§ Original unaudited budget Actual Actual 2021 $ '000 Notes 2021 2020",
  'Income from continuing operations',
  '67,144 Rates and annual charges B2-1 66,845 64,587',
  '48,256 User charges and fees B2-2 39,776 42,455',
  '2,140 Other revenue B2-3 2,628 1,986',
  '21,370 Grants and contributions provided for operating purposes B2-4 22,054 21,858',
  '14,945 Grants and contributions provided for capital purposes B2-4 48,265 33,077',
  '3,174 Interest and investment income B2-5 3,703 5,716',
  '– Other income B2-6 37 149',
  '500 Net gains from the disposal of assets B4-1 3,446 –',
  '157,529 Total income from continuing operations 186,754 169,828',
  'Expenses from continuing operations',
  '44,867 Employee benefits and on-costs B3-1 44,932 45,200',
  '51,791 Materials and services B3-2 53,696 49,018',
  '3,465 Borrowing costs B3-3 3,095 3,691',
  '35,396 Depreciation, amortisation and impairment for non-financial assets B3-4 45,551 42,261',
  '2,543 Other expenses B3-5 2,356 2,421',
  '– Net losses from the disposal of assets B4-1 – 2,493',
  '138,062 Total expenses from continuing operations 149,630 145,084',
  '19,467 Operating result from continuing operations 37,124 24,744',
  '19,467 Net operating result for the year attributable to Council 37,124 24,744',
  '4,522 Net operating result for the year before grants and contributions provided for capital purposes (11,141) (8,333)',
  'The above Income Statement should be read in conjunction with the accompanying notes.',
  'Dubbo Regional Council Income Statement for the year ended 30 June 2021 Page 4 of 80',
].join(' ');

const FY2020_21_FUNCTIONS_TEXT = [
  'B Financial Performance B1 Functions or activities',
  'B1-1 Functions or activities – income, expenses and assets',
  "$ '000 2021 2020 2021 2020 2021 2020 2021 2020 2021 2020",
  'Functions or activities Governance 25 5 604 477 (579) (472) – – – –',
  'Total functions and activities 186,942 169,828 149,630 145,084 37,312 24,744 70,319 54,935 2,715,495 2,632,382',
  'Page 14 of 80 Dubbo Regional Council | Notes to the Financial Statements 30 June 2021',
].join(' ');

function extraction202021(overrides: { income?: string; functions?: string } = {}): PdfExtraction {
  return {
    source: { sha256: '1'.repeat(64), bytes: 1 },
    pages: [
      pdfPage(overrides.income ?? FY2020_21_INCOME_TEXT, 4),
      pdfPage(overrides.functions ?? FY2020_21_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT_2020_21: DubboGpfsParseContext = {
  document: {
    id: 'gpfs-2020-21',
    title: '2020/2021 Dubbo Regional Council Financial Statements',
    url: 'https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Annual%20Financial%20Statements%20-2020-2021%20(3).pdf.aspx',
    fiscal_year: '2020-21',
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2020-21.pdf',
    sha256: '69a7b9cb99774a63b845bdb85950265a870246ce0c1f82a3929c2642244aab9b',
    bytes: 2_637_455,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: DUBBO_GPFS_REPORTING_URL,
};

function parsedFixture202021() {
  return parseDubboGpfsExtraction(extraction202021(), CONTEXT_2020_21);
}

function parsedFixture() {
  return parseDubboGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Dubbo GPFS source discovery', () => {
  it('discovers the FY2024-25 statements from the reporting page, never a hard-coded PDF URL', () => {
    const html = `
      <a href="/ArticleDocuments/11102/2025-2026%20Annual%20Financial%20Statements%20-%20Dubbo%20Regional%20Council.pdf.aspx">2025/2026 Dubbo Regional Council Financial Statements<span>(PDF 2.8MB)</span></a>
      <a href="/ArticleDocuments/11102/20242025%20-%20Annual%20Financial%20Statements%20-%20Final%20for%20website.PDF.aspx">2024/2025 Dubbo Regional Council Financial Statements<span>(PDF 1.7MB)</span></a>
      <a href="/ArticleDocuments/11102/20242025%20Annual%20Report%20-%20final.pdf.aspx">2024/2025 Dubbo Regional Council Annual Report</a>
    `;
    const links = parseDubboGpfsReportLinks(html);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.some((link) => /annual report/i.test(link.title))).toBe(false);
    const selected = selectDubboGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(CONTEXT.document.url);
    expect(fiscalYearFromGpfsLink('2024/2025 Dubbo Regional Council Financial Statements')).toBe(
      '2024-25',
    );
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseDubboGpfsReportLinks(
      '<a href="/x.pdf">2023/2024 Dubbo Regional Council Financial Statements</a>',
    );
    expect(() => selectDubboGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('Dubbo GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectDubboGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectDubboGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.replace("$ '000", '');
    const parsed = parseDubboGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Dubbo GPFS exact reconciliation', () => {
  it('reads the minimum lines and reconciles exactly to the OLG FY2024-25 totals', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(18);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(234_927);
    expect(reconciliation.total_expenses).toBe(174_925);
    expect(reconciliation.employee_expenses).toBe(49_204);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(57_859);
    expect(reconciliation.government_grants_operating).toBe(20_061);
    expect(reconciliation.government_grants_capital).toBe(59_726);
    expect(reconciliation.net_result).toBe(60_002);
    expect(reconciliation.net_result_before_capital_grants).toBe(276);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(117_066);
    expect(reconciliation.face_expense_bridge).toBe(174_925);
    expect(reconciliation.functions_total_income).toBe(234_927);
    expect(reconciliation.functions_total_expenses).toBe(174_925);
    expect(reconciliation.functions_operating_result).toBe(60_002);
    expect(reconciliation.functions_grants_and_contributions).toBe(79_787);
    expect(reconciliation.revenue_components_sum).toBe(234_927);
    expect(reconciliation.expense_components_sum).toBe(117_066);
    expect(reconciliation.olg_expenses_cents).toBe(DUBBO_GPFS_OLG_EXPENSES_CENTS);
    expect(reconciliation.olg_revenue_cents).toBe(DUBBO_GPFS_OLG_REVENUE_CENTS);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(23_492_700_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(17_492_500_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(4_920_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      5_785_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(2_006_100_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(5_972_600_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(6_000_200_000);
    expect(recordByLine(records, 'net_result_before_capital_grants').amount_cents).toBe(27_600_000);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: DUBBO_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'Dubbo Regional Council',
        source_dataset: 'Dubbo Regional Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^dubbo-council-gpfs:/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
  });

  it('does not sum GPFS components with their printed totals', () => {
    const { records } = parsedFixture();
    const totalRevenue = recordByLine(records, 'total_revenue');
    const revenueComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_revenue',
    );
    expect(revenueComponents).toHaveLength(7);
    expect(revenueComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalRevenue.amount_cents,
    );

    const totalExpenses = recordByLine(records, 'total_expenses');
    const expenseComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses',
    );
    expect(expenseComponents).toHaveLength(2);
    expect(expenseComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalExpenses.amount_cents,
    );
    // Every output row is agency detail, so neither the API nor the area panel
    // can add it to the 245 dubbo-council budget/estimate rows.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace(
      '174,925 181,317 60,002 29,579',
      '174,926 181,317 60,002 29,579',
    );
    const parsed = parseDubboGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('is deterministic: repeated parses produce the same natural keys and amounts', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
  });

  it('derives stable, line-specific natural keys', () => {
    const url = CONTEXT.document.url;
    const revenue = dubboGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = dubboGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^dubbo-council-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(dubboGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(dubboGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_dubbogpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: DUBBO_GPFS_ID,
    name: DUBBO_GPFS_NAME,
    publisher: DUBBO_GPFS_PUBLISHER,
    source_url: DUBBO_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: DUBBO_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'dubbo-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Dubbo GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    await MeasureModel.insertMany([
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2026-27',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-1',
        project_name: 'Existing budget row 1',
      },
      {
        amount_cents: 654_321,
        measure_type: 'estimate',
        fiscal_year: '2025-26',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-2',
        project_name: 'Existing budget row 2',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing dubbo-council rows and never double counts on re-run', async () => {
    const { records } = parsedFixture();
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council' })).toBe(2);
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    const existing = await MeasureModel.find({ source_id: 'dubbo-council' })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.natural_key)).toEqual([
      'existing-dubbo-1',
      'existing-dubbo-2',
    ]);
    expect(existing.map((row) => row.amount_cents)).toEqual([123_456, 654_321]);
    expect(existing.map((row) => row.project_name)).toEqual([
      'Existing budget row 1',
      'Existing budget row 2',
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council' })).toBe(2);
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(18);
    expect(await MeasureModel.countDocuments({})).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: DUBBO_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: DUBBO_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: DUBBO_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(18);
  });
});

describe('Dubbo GPFS supported-year guard', () => {
  it('supports FY2025-26..FY2020-21 and not older historical years', () => {
    expect([...DUBBO_GPFS_SUPPORTED_FISCAL_YEARS]).toEqual([
      '2025-26',
      '2024-25',
      '2023-24',
      '2022-23',
      '2021-22',
      '2020-21',
    ]);
    expect(DUBBO_GPFS_SUPPORTED_FISCAL_YEARS).not.toContain('2019-20');
    expect(DUBBO_GPFS_SUPPORTED_FISCAL_YEARS).not.toContain('2016-17');
  });
});

describe('Dubbo GPFS FY2023-24 multi-year variant', () => {
  it('reconciles the FY2023-24 printed totals to the D2 packet anchors', () => {
    const parsed = parsedFixture202324();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2023-24');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.income_statement_page).toBe(5);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.total_revenue).toBe(210_896);
    expect(reconciliation.total_expenses).toBe(181_317);
    expect(reconciliation.net_result).toBe(29_579);
    expect(reconciliation.employee_expenses).toBe(49_340);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(58_525);
    expect(reconciliation.government_grants_operating).toBe(32_079);
    expect(reconciliation.government_grants_capital).toBe(33_122);
    expect(reconciliation.net_result_before_capital_grants).toBe(-3_543);
    expect(reconciliation.revenue_components_sum).toBe(210_896);
    expect(reconciliation.expense_components_sum).toBe(181_317);
    expect(reconciliation.functions_total_income).toBe(210_896);
    expect(reconciliation.functions_total_expenses).toBe(181_317);
    expect(reconciliation.functions_operating_result).toBe(29_579);
    expect(reconciliation.functions_grants_and_contributions).toBe(65_201);
    // FY2023-24 has no printed "excluding depreciation" subtotal and no OLG anchor.
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBeNull();
    expect(reconciliation.olg_expenses_cents).toBeNull();
    expect(reconciliation.olg_revenue_cents).toBeNull();
    expect(reconciliation.checks).toContain('no external OLG anchor is defined for FY2023-24');
  });

  it('maps FY2023-24 provenance with year-scoped source dataset and natural keys', () => {
    const { records } = parsedFixture202324();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: DUBBO_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'Dubbo Regional Council',
        source_dataset: 'Dubbo Regional Council GPFS 2023-24',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT_2023_24.document.url,
      });
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^dubbo-council-gpfs:/);
    }
    const totalRevenue = recordByLine(records, 'total_revenue');
    expect(totalRevenue.amount_cents).toBe(21_089_600_000);
    expect(totalRevenue.natural_key).toBe(
      dubboGpfsNaturalKey(CONTEXT_2023_24.document.url, 'total_revenue', '2023-24'),
    );
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      448_900_000,
    );
    const beforeCapital = recordByLine(records, 'net_result_before_capital_grants');
    expect(beforeCapital.amount_cents).toBe(354_300_000);
    expect(beforeCapital.gpfs_printed_sign).toBe('negative');
    expect(
      records
        .filter((record) => record.gpfs_component_of === 'total_expenses')
        .reduce((sum, record) => sum + record.amount_cents, 0),
    ).toBe(recordByLine(records, 'total_expenses').amount_cents);
  });

  it('never mixes or sums FY2023-24 and FY2024-25 rows', () => {
    const fy2425 = parsedFixture().records;
    const fy2324 = parsedFixture202324().records;
    const combined = [...fy2425, ...fy2324];
    expect(combined).toHaveLength(35);
    expect(fy2425).toHaveLength(18);
    expect(fy2324).toHaveLength(17);
    expect(new Set(combined.map((record) => record.natural_key)).size).toBe(35);
    expect(combined.filter((record) => record.fiscal_year === '2024-25')).toHaveLength(18);
    expect(combined.filter((record) => record.fiscal_year === '2023-24')).toHaveLength(17);
    const revenueTotals = combined
      .filter((record) => record.gpfs_line_item === 'total_revenue')
      .map((record) => record.amount_cents)
      .sort((a, b) => a - b);
    expect(revenueTotals).toEqual([21_089_600_000, 23_492_700_000]);
    // No row is the cross-year sum (FY2023-24 + FY2024-25 revenue).
    expect(combined.some((record) => record.amount_cents === 44_582_300_000)).toBe(false);
  });

  it('leaves the FY2024-25 golden output unchanged', () => {
    const records = parsedFixture().records;
    expect(records).toHaveLength(18);
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
    expect(
      records.every((record) => record.source_dataset === 'Dubbo Regional Council GPFS 2024-25'),
    ).toBe(true);
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(23_492_700_000);
    expect(recordByLine(records, 'net_result').natural_key).toBe(
      dubboGpfsNaturalKey(CONTEXT.document.url, 'net_result', '2024-25'),
    );
  });

  it('rejects the whole FY2023-24 extraction when the B1-1 total disagrees', () => {
    const broken = FY2023_24_FUNCTIONS_TEXT.replace(
      '181,317 162,924 29,579',
      '181,318 162,924 29,579',
    );
    const parsed = parseDubboGpfsExtraction(
      extraction202324({ functions: broken }),
      CONTEXT_2023_24,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });
});

describe('Dubbo GPFS multi-year ingestion adds only FY2023-24 rows', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    await MeasureModel.insertMany([
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2026-27',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-1',
        project_name: 'Existing budget row 1',
      },
      {
        amount_cents: 654_321,
        measure_type: 'estimate',
        fiscal_year: '2025-26',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-2',
        project_name: 'Existing budget row 2',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('adds 17 FY2023-24 rows, preserves 18 FY2024-25 rows and every other source', async () => {
    const records = [...parsedFixture().records, ...parsedFixture202324().records];
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(35);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2024-25' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2023-24' }),
    ).toBe(17);
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council' })).toBe(2);
    expect(await MeasureModel.countDocuments({})).toBe(37);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(35);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2024-25' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2023-24' }),
    ).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(37);

    expect(
      await MeasureModel.countDocuments({
        source_id: DUBBO_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: DUBBO_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: DUBBO_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(35);
  });
});

describe('Dubbo GPFS FY2025-26 multi-year variant', () => {
  it('reconciles the FY2025-26 printed totals to the packet anchors', () => {
    const parsed = parsedFixture202526();
    expect(parsed.records).toHaveLength(19);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.income_statement_page).toBe(5);
    expect(reconciliation.functions_page).toBe(14);
    expect(reconciliation.total_revenue).toBe(226_358);
    expect(reconciliation.total_expenses).toBe(180_330);
    expect(reconciliation.net_result).toBe(46_028);
    expect(reconciliation.employee_expenses).toBe(57_396);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(61_576);
    expect(reconciliation.government_grants_operating).toBe(30_491);
    expect(reconciliation.government_grants_capital).toBe(28_315);
    expect(reconciliation.net_result_before_capital_grants).toBe(17_713);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(118_754);
    expect(reconciliation.revenue_components_sum).toBe(226_358);
    expect(reconciliation.expense_components_sum).toBe(118_754);
    expect(reconciliation.face_expense_bridge).toBe(180_330);
    expect(reconciliation.functions_total_income).toBe(226_358);
    expect(reconciliation.functions_total_expenses).toBe(180_330);
    expect(reconciliation.functions_operating_result).toBe(46_028);
    expect(reconciliation.functions_grants_and_contributions).toBe(58_806);
    expect(reconciliation.olg_expenses_cents).toBeNull();
    expect(reconciliation.olg_revenue_cents).toBeNull();
    expect(reconciliation.checks).toContain('no external OLG anchor is defined for FY2025-26');
  });

  it('includes the printed 864 disposal gain and stores the printed nil loss as zero', () => {
    const { records } = parsedFixture202526();
    const gain = recordByLine(records, 'net_gain_from_disposal_of_assets');
    expect(gain.amount_cents).toBe(86_400_000);
    expect(gain.gpfs_line_label).toBe('Net gain from the disposal of assets');

    const nilLoss = recordByLine(records, 'net_loss_from_disposal_of_assets');
    expect(nilLoss.amount_cents).toBe(0);
    expect(nilLoss.notes).toContain('printed_nil: true');
    expect(nilLoss.gpfs_printed_sign).toBeUndefined();

    // The comparative 5,035 must never be read as the current-year value.
    expect(parsedFixture202526().reconciliation!.expense_components_sum).toBe(118_754);
  });

  it('maps FY2025-26 provenance with year-scoped source dataset and natural keys', () => {
    const { records } = parsedFixture202526();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: DUBBO_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'Dubbo Regional Council',
        source_dataset: 'Dubbo Regional Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT_2025_26.document.url,
      });
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^dubbo-council-gpfs:/);
    }
    expect(recordByLine(records, 'total_revenue').natural_key).toBe(
      dubboGpfsNaturalKey(CONTEXT_2025_26.document.url, 'total_revenue', '2025-26'),
    );
  });

  it('never mixes or sums FY2025-26 with FY2024-25 or FY2023-24 rows', () => {
    const fy2526 = parsedFixture202526().records;
    const fy2425 = parsedFixture().records;
    const fy2324 = parsedFixture202324().records;
    const combined = [...fy2526, ...fy2425, ...fy2324];
    expect(combined).toHaveLength(54);
    expect(fy2526).toHaveLength(19);
    expect(fy2425).toHaveLength(18);
    expect(fy2324).toHaveLength(17);
    expect(new Set(combined.map((record) => record.natural_key)).size).toBe(54);
    expect(combined.filter((record) => record.fiscal_year === '2025-26')).toHaveLength(19);
    expect(combined.filter((record) => record.fiscal_year === '2024-25')).toHaveLength(18);
    expect(combined.filter((record) => record.fiscal_year === '2023-24')).toHaveLength(17);
    const revenueTotals = combined
      .filter((record) => record.gpfs_line_item === 'total_revenue')
      .map((record) => record.amount_cents)
      .sort((a, b) => a - b);
    expect(revenueTotals).toEqual([21_089_600_000, 22_635_800_000, 23_492_700_000]);
    // No row is a two-year or three-year sum (e.g. FY2023-24 + FY2024-25 + FY2025-26 revenue).
    expect(combined.some((record) => record.amount_cents === 67_218_100_000)).toBe(false);
  });

  it('leaves the FY2023-24 and FY2024-25 golden outputs unchanged', () => {
    const fy2425 = parsedFixture().records;
    const fy2324 = parsedFixture202324().records;
    expect(fy2425).toHaveLength(18);
    expect(fy2425.every((record) => record.fiscal_year === '2024-25')).toBe(true);
    expect(
      fy2425.every((record) => record.source_dataset === 'Dubbo Regional Council GPFS 2024-25'),
    ).toBe(true);
    expect(recordByLine(fy2425, 'total_revenue').amount_cents).toBe(23_492_700_000);
    expect(fy2324).toHaveLength(17);
    expect(fy2324.every((record) => record.fiscal_year === '2023-24')).toBe(true);
    expect(recordByLine(fy2324, 'total_revenue').amount_cents).toBe(21_089_600_000);
  });

  it('rejects the whole FY2025-26 extraction when the B1-1 total disagrees', () => {
    const broken = FY2025_26_FUNCTIONS_TEXT.replace(
      '180,330 174,925 46,028',
      '180,331 174,925 46,028',
    );
    const parsed = parseDubboGpfsExtraction(
      extraction202526({ functions: broken }),
      CONTEXT_2025_26,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects if the printed nil disposal loss is misread as the comparative 5,035', () => {
    const withoutNil = FY2025_26_INCOME_TEXT.replace(
      'Net loss from the disposal of assets – 5,035',
      'Net loss from the disposal of assets 5,035',
    );
    const parsed = parseDubboGpfsExtraction(
      extraction202526({ income: withoutNil }),
      CONTEXT_2025_26,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });
});

describe('Dubbo GPFS three-year ingestion adds only FY2025-26 rows', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    await MeasureModel.insertMany([
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2026-27',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-1',
        project_name: 'Existing budget row 1',
      },
      {
        amount_cents: 654_321,
        measure_type: 'estimate',
        fiscal_year: '2025-26',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-2',
        project_name: 'Existing budget row 2',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('adds 19 FY2025-26 rows, preserves 18 FY2024-25 and 17 FY2023-24 rows', async () => {
    const records = [
      ...parsedFixture202526().records,
      ...parsedFixture().records,
      ...parsedFixture202324().records,
    ];
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(54);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2025-26' }),
    ).toBe(19);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2024-25' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2023-24' }),
    ).toBe(17);
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council' })).toBe(2);
    expect(await MeasureModel.countDocuments({})).toBe(56);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(54);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2025-26' }),
    ).toBe(19);
    expect(await MeasureModel.countDocuments({})).toBe(56);

    const source = await DataSourceModel.findOne({ source_id: DUBBO_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(54);
  });
});

describe('Dubbo GPFS FY2022-23 historical variant', () => {
  it('reconciles the FY2022-23 printed totals to the packet anchors', () => {
    const parsed = parsedFixture202223();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2022-23');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.income_statement_page).toBe(5);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.total_revenue).toBe(213_640);
    expect(reconciliation.total_expenses).toBe(162_924);
    expect(reconciliation.net_result).toBe(50_716);
    expect(reconciliation.employee_expenses).toBe(47_319);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(54_323);
    expect(reconciliation.government_grants_operating).toBe(28_542);
    expect(reconciliation.government_grants_capital).toBe(56_552);
    expect(reconciliation.functions_grants_and_contributions).toBe(85_094);
    expect(reconciliation.net_result_before_capital_grants).toBe(-5_836);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(213_640);
    expect(reconciliation.expense_components_sum).toBe(162_924);
    expect(reconciliation.face_expense_bridge).toBe(162_924);
    expect(reconciliation.functions_total_income).toBe(213_640);
    expect(reconciliation.functions_total_expenses).toBe(162_924);
    expect(reconciliation.functions_operating_result).toBe(50_716);
    expect(reconciliation.olg_expenses_cents).toBeNull();
    expect(reconciliation.checks).toContain('no external OLG anchor is defined for FY2022-23');
  });

  it('keeps the 3,276 disposal loss as an expense and signs the negative before-capital result', () => {
    const { records } = parsedFixture202223();
    const disposal = recordByLine(records, 'net_loss_from_disposal_of_assets');
    expect(disposal.amount_cents).toBe(327_600_000);
    expect(disposal.notes).not.toContain('printed_nil');
    const beforeCapital = recordByLine(records, 'net_result_before_capital_grants');
    expect(beforeCapital.amount_cents).toBe(583_600_000);
    expect(beforeCapital.gpfs_printed_sign).toBe('negative');
    expect(parsedFixture202223().reconciliation!.expense_components_sum).toBe(162_924);
  });

  it('maps FY2022-23 provenance with year-scoped source dataset and natural keys', () => {
    const { records } = parsedFixture202223();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: DUBBO_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2022-23',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'Dubbo Regional Council',
        source_dataset: 'Dubbo Regional Council GPFS 2022-23',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT_2022_23.document.url,
      });
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^dubbo-council-gpfs:/);
    }
    expect(recordByLine(records, 'total_revenue').natural_key).toBe(
      dubboGpfsNaturalKey(CONTEXT_2022_23.document.url, 'total_revenue', '2022-23'),
    );
  });

  it('never mixes or sums FY2022-23 with the three newer years', () => {
    const fy2223 = parsedFixture202223().records;
    const fy2526 = parsedFixture202526().records;
    const fy2425 = parsedFixture().records;
    const fy2324 = parsedFixture202324().records;
    const combined = [...fy2223, ...fy2324, ...fy2425, ...fy2526];
    expect(combined).toHaveLength(71);
    expect(fy2223).toHaveLength(17);
    expect(new Set(combined.map((record) => record.natural_key)).size).toBe(71);
    expect(combined.filter((record) => record.fiscal_year === '2022-23')).toHaveLength(17);
    expect(combined.filter((record) => record.fiscal_year === '2023-24')).toHaveLength(17);
    expect(combined.filter((record) => record.fiscal_year === '2024-25')).toHaveLength(18);
    expect(combined.filter((record) => record.fiscal_year === '2025-26')).toHaveLength(19);
    const revenueTotals = combined
      .filter((record) => record.gpfs_line_item === 'total_revenue')
      .map((record) => record.amount_cents)
      .sort((a, b) => a - b);
    expect(revenueTotals).toEqual([21_089_600_000, 21_364_000_000, 22_635_800_000, 23_492_700_000]);
    // No row is a two-, three- or four-year sum (e.g. all four years' revenue).
    expect(combined.some((record) => record.amount_cents === 88_582_100_000)).toBe(false);
  });

  it('leaves the FY2023-24, FY2024-25 and FY2025-26 outputs unchanged', () => {
    expect(parsedFixture202324().records).toHaveLength(17);
    expect(parsedFixture().records).toHaveLength(18);
    expect(parsedFixture202526().records).toHaveLength(19);
    expect(parsedFixture202324().records.every((r) => r.fiscal_year === '2023-24')).toBe(true);
    expect(parsedFixture().records.every((r) => r.fiscal_year === '2024-25')).toBe(true);
    expect(parsedFixture202526().records.every((r) => r.fiscal_year === '2025-26')).toBe(true);
  });

  it('rejects the whole FY2022-23 extraction when the B1-1 total disagrees', () => {
    const broken = FY2022_23_FUNCTIONS_TEXT.replace(
      '162,924 152,220 50,716',
      '162,925 152,220 50,716',
    );
    const parsed = parseDubboGpfsExtraction(
      extraction202223({ functions: broken }),
      CONTEXT_2022_23,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });
});

describe('Dubbo GPFS four-year ingestion adds only FY2022-23 rows', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    await MeasureModel.insertMany([
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2026-27',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-1',
        project_name: 'Existing budget row 1',
      },
      {
        amount_cents: 654_321,
        measure_type: 'estimate',
        fiscal_year: '2025-26',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-2',
        project_name: 'Existing budget row 2',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('adds 17 FY2022-23 rows and preserves the 54 newer rows', async () => {
    const records = [
      ...parsedFixture202223().records,
      ...parsedFixture202324().records,
      ...parsedFixture().records,
      ...parsedFixture202526().records,
    ];
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(71);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2022-23' }),
    ).toBe(17);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2023-24' }),
    ).toBe(17);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2024-25' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2025-26' }),
    ).toBe(19);
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council' })).toBe(2);
    expect(await MeasureModel.countDocuments({})).toBe(73);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(71);
    expect(await MeasureModel.countDocuments({})).toBe(73);

    const source = await DataSourceModel.findOne({ source_id: DUBBO_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(71);
  });
});

describe('Dubbo GPFS FY2021-22 historical variant', () => {
  it('reconciles the FY2021-22 printed totals to the packet anchors', () => {
    const parsed = parsedFixture202122();
    expect(parsed.records).toHaveLength(18);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2021-22');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.income_statement_page).toBe(5);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.total_revenue).toBe(192_666);
    expect(reconciliation.total_expenses).toBe(152_220);
    expect(reconciliation.net_result).toBe(40_446);
    expect(reconciliation.employee_expenses).toBe(44_485);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(48_457);
    expect(reconciliation.government_grants_operating).toBe(26_053);
    expect(reconciliation.government_grants_capital).toBe(49_260);
    expect(reconciliation.functions_grants_and_contributions).toBe(75_313);
    expect(reconciliation.net_result_before_capital_grants).toBe(-8_814);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(192_666);
    expect(reconciliation.expense_components_sum).toBe(152_220);
    expect(reconciliation.face_expense_bridge).toBe(152_220);
    expect(reconciliation.functions_total_income).toBe(192_666);
    expect(reconciliation.functions_total_expenses).toBe(152_220);
    expect(reconciliation.functions_operating_result).toBe(40_446);
    expect(reconciliation.olg_expenses_cents).toBeNull();
    expect(reconciliation.checks).toContain('no external OLG anchor is defined for FY2021-22');
  });

  it('stores the printed nil disposal gain as zero and the negative before-capital result with a sign', () => {
    const { records } = parsedFixture202122();
    const gain = recordByLine(records, 'net_gain_from_disposal_of_assets');
    expect(gain.amount_cents).toBe(0);
    expect(gain.notes).toContain('printed_nil: true');

    const disposal = recordByLine(records, 'net_loss_from_disposal_of_assets');
    expect(disposal.amount_cents).toBe(714_900_000);
    expect(disposal.notes).not.toContain('printed_nil');

    const beforeCapital = recordByLine(records, 'net_result_before_capital_grants');
    expect(beforeCapital.amount_cents).toBe(881_400_000);
    expect(beforeCapital.gpfs_printed_sign).toBe('negative');
    expect(parsedFixture202122().reconciliation!.revenue_components_sum).toBe(192_666);
  });

  it('maps FY2021-22 provenance with year-scoped source dataset and natural keys', () => {
    const { records } = parsedFixture202122();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: DUBBO_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2021-22',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'Dubbo Regional Council',
        source_dataset: 'Dubbo Regional Council GPFS 2021-22',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT_2021_22.document.url,
      });
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^dubbo-council-gpfs:/);
    }
    expect(recordByLine(records, 'total_revenue').natural_key).toBe(
      dubboGpfsNaturalKey(CONTEXT_2021_22.document.url, 'total_revenue', '2021-22'),
    );
  });

  it('never mixes or sums FY2021-22 with the four newer years', () => {
    const fy2122 = parsedFixture202122().records;
    const combined = [
      ...fy2122,
      ...parsedFixture202223().records,
      ...parsedFixture202324().records,
      ...parsedFixture().records,
      ...parsedFixture202526().records,
    ];
    expect(combined).toHaveLength(89);
    expect(fy2122).toHaveLength(18);
    expect(new Set(combined.map((record) => record.natural_key)).size).toBe(89);
    expect(combined.filter((record) => record.fiscal_year === '2021-22')).toHaveLength(18);
    expect(combined.filter((record) => record.fiscal_year === '2022-23')).toHaveLength(17);
    expect(combined.filter((record) => record.fiscal_year === '2023-24')).toHaveLength(17);
    expect(combined.filter((record) => record.fiscal_year === '2024-25')).toHaveLength(18);
    expect(combined.filter((record) => record.fiscal_year === '2025-26')).toHaveLength(19);
    const revenueTotals = combined
      .filter((record) => record.gpfs_line_item === 'total_revenue')
      .map((record) => record.amount_cents)
      .sort((a, b) => a - b);
    expect(revenueTotals).toEqual([
      19_266_600_000, 21_089_600_000, 21_364_000_000, 22_635_800_000, 23_492_700_000,
    ]);
    // No row is a multi-year sum (e.g. all five years' revenue).
    expect(combined.some((record) => record.amount_cents === 107_848_700_000)).toBe(false);
  });

  it('leaves the FY2022-23..FY2025-26 outputs unchanged', () => {
    expect(parsedFixture202223().records).toHaveLength(17);
    expect(parsedFixture202324().records).toHaveLength(17);
    expect(parsedFixture().records).toHaveLength(18);
    expect(parsedFixture202526().records).toHaveLength(19);
  });

  it('rejects the whole FY2021-22 extraction when the B1-1 total disagrees', () => {
    const broken = FY2021_22_FUNCTIONS_TEXT.replace(
      '152,220 149,630 40,446',
      '152,221 149,630 40,446',
    );
    const parsed = parseDubboGpfsExtraction(
      extraction202122({ functions: broken }),
      CONTEXT_2021_22,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects if the printed nil disposal gain is misread as the comparative 3,446', () => {
    const withoutNil = FY2021_22_INCOME_TEXT.replace(
      'Net gain from the disposal of assets – 3,446',
      'Net gain from the disposal of assets 3,446',
    );
    const parsed = parseDubboGpfsExtraction(
      extraction202122({ income: withoutNil }),
      CONTEXT_2021_22,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });
});

describe('Dubbo GPFS five-year ingestion adds only FY2021-22 rows', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    await MeasureModel.insertMany([
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2026-27',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-1',
        project_name: 'Existing budget row 1',
      },
      {
        amount_cents: 654_321,
        measure_type: 'estimate',
        fiscal_year: '2025-26',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-2',
        project_name: 'Existing budget row 2',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('adds 18 FY2021-22 rows and preserves the 71 newer rows', async () => {
    const records = [
      ...parsedFixture202122().records,
      ...parsedFixture202223().records,
      ...parsedFixture202324().records,
      ...parsedFixture().records,
      ...parsedFixture202526().records,
    ];
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(89);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2021-22' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2022-23' }),
    ).toBe(17);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2023-24' }),
    ).toBe(17);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2024-25' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2025-26' }),
    ).toBe(19);
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council' })).toBe(2);
    expect(await MeasureModel.countDocuments({})).toBe(91);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(89);
    expect(await MeasureModel.countDocuments({})).toBe(91);

    const source = await DataSourceModel.findOne({ source_id: DUBBO_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(89);
  });
});

describe('Dubbo GPFS FY2020-21 historical variant', () => {
  it('reconciles the FY2020-21 face statement exactly to the packet anchors', () => {
    const parsed = parsedFixture202021();
    expect(parsed.records).toHaveLength(18);
    expect(parsed.reconciliation).not.toBeNull();
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2020-21');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.income_statement_page).toBe(4);
    expect(reconciliation.functions_page).toBe(14);
    expect(reconciliation.total_revenue).toBe(186_754);
    expect(reconciliation.total_expenses).toBe(149_630);
    expect(reconciliation.net_result).toBe(37_124);
    expect(reconciliation.employee_expenses).toBe(44_932);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(45_551);
    expect(reconciliation.government_grants_operating).toBe(22_054);
    expect(reconciliation.government_grants_capital).toBe(48_265);
    expect(reconciliation.functions_grants_and_contributions).toBe(70_319);
    expect(reconciliation.net_result_before_capital_grants).toBe(-11_141);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBeNull();
    expect(reconciliation.revenue_components_sum).toBe(186_754);
    expect(reconciliation.expense_components_sum).toBe(149_630);
    expect(reconciliation.face_expense_bridge).toBe(149_630);
    expect(reconciliation.functions_total_expenses).toBe(149_630);
    expect(reconciliation.olg_expenses_cents).toBeNull();
    expect(reconciliation.olg_revenue_cents).toBeNull();
    expect(reconciliation.checks).toContain('no external OLG anchor is defined for FY2020-21');
  });

  it('records the B1-1 +188 income/result variance as unexplained and never forces equality', () => {
    const reconciliation = parsedFixture202021().reconciliation!;
    // B1-1 prints income 186,942 and result 37,312; the face prints 186,754 and 37,124.
    expect(reconciliation.functions_total_income).toBe(186_942);
    expect(reconciliation.functions_operating_result).toBe(37_312);
    expect(reconciliation.functions_total_income - reconciliation.total_revenue).toBe(188);
    expect(reconciliation.functions_operating_result - reconciliation.net_result).toBe(188);
    expect(reconciliation.b1_income_variance).toBe(188);
    expect(reconciliation.b1_expenses_variance).toBe(0);
    expect(reconciliation.b1_operating_result_variance).toBe(188);
    expect(reconciliation.b1_variance_note).toMatch(/188/);
    expect(reconciliation.b1_variance_note).toMatch(/unexplained/);
    expect(reconciliation.checks).toContain(
      'B1-1 income and operating result are $188 thousand above the face statement; variance recorded as unexplained and face totals retained',
    );

    // The face components/totals are kept exactly: nothing is spread across a component.
    const { records } = parsedFixture202021();
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(18_675_400_000);
    const revenueComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_revenue',
    );
    expect(revenueComponents).toHaveLength(8);
    expect(revenueComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      18_675_400_000,
    );
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(14_963_000_000);
  });

  it('stores the 3,446 disposal gain, the printed-nil disposal loss and the negative before-capital result', () => {
    const { records } = parsedFixture202021();
    const gain = recordByLine(records, 'net_gain_from_disposal_of_assets');
    expect(gain.amount_cents).toBe(344_600_000);
    expect(gain.notes).not.toContain('printed_nil');

    const losses = recordByLine(records, 'net_loss_from_disposal_of_assets');
    expect(losses.amount_cents).toBe(0);
    expect(losses.notes).toContain('printed_nil: true');

    const beforeCapital = recordByLine(records, 'net_result_before_capital_grants');
    expect(beforeCapital.amount_cents).toBe(1_114_100_000);
    expect(beforeCapital.gpfs_printed_sign).toBe('negative');
  });

  it('maps FY2020-21 provenance with year-scoped source dataset and natural keys', () => {
    const { records } = parsedFixture202021();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: DUBBO_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2020-21',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: 'Dubbo Regional Council',
        source_dataset: 'Dubbo Regional Council GPFS 2020-21',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT_2020_21.document.url,
      });
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^dubbo-council-gpfs:/);
    }
    expect(recordByLine(records, 'total_revenue').natural_key).toBe(
      dubboGpfsNaturalKey(CONTEXT_2020_21.document.url, 'total_revenue', '2020-21'),
    );
  });

  it('never mixes or sums FY2020-21 with the five newer years', () => {
    const fy2021 = parsedFixture202021().records;
    const combined = [
      ...fy2021,
      ...parsedFixture202122().records,
      ...parsedFixture202223().records,
      ...parsedFixture202324().records,
      ...parsedFixture().records,
      ...parsedFixture202526().records,
    ];
    expect(combined).toHaveLength(107);
    expect(fy2021).toHaveLength(18);
    expect(new Set(combined.map((record) => record.natural_key)).size).toBe(107);
    expect(combined.filter((record) => record.fiscal_year === '2020-21')).toHaveLength(18);
    expect(combined.filter((record) => record.fiscal_year === '2021-22')).toHaveLength(18);
    expect(combined.filter((record) => record.fiscal_year === '2022-23')).toHaveLength(17);
    expect(combined.filter((record) => record.fiscal_year === '2023-24')).toHaveLength(17);
    expect(combined.filter((record) => record.fiscal_year === '2024-25')).toHaveLength(18);
    expect(combined.filter((record) => record.fiscal_year === '2025-26')).toHaveLength(19);
    const revenueTotals = combined
      .filter((record) => record.gpfs_line_item === 'total_revenue')
      .map((record) => record.amount_cents)
      .sort((a, b) => a - b);
    expect(revenueTotals).toEqual([
      18_675_400_000, 19_266_600_000, 21_089_600_000, 21_364_000_000, 22_635_800_000,
      23_492_700_000,
    ]);
    // No row is the six-year sum ($1,265,241 thousand = 126,524,100,000 cents).
    expect(combined.some((record) => record.amount_cents === 126_524_100_000)).toBe(false);
  });

  it('leaves the five newer Dubbo years unchanged', () => {
    expect(parsedFixture202122().records).toHaveLength(18);
    expect(parsedFixture202223().records).toHaveLength(17);
    expect(parsedFixture202324().records).toHaveLength(17);
    expect(parsedFixture().records).toHaveLength(18);
    expect(parsedFixture202526().records).toHaveLength(19);
    expect(parsedFixture202122().records.every((r) => r.fiscal_year === '2021-22')).toBe(true);
    expect(parsedFixture202223().records.every((r) => r.fiscal_year === '2022-23')).toBe(true);
    expect(parsedFixture202324().records.every((r) => r.fiscal_year === '2023-24')).toBe(true);
    expect(parsedFixture().records.every((r) => r.fiscal_year === '2024-25')).toBe(true);
    expect(parsedFixture202526().records.every((r) => r.fiscal_year === '2025-26')).toBe(true);
  });

  it('rejects the whole FY2020-21 extraction when the B1-1 +188 variance is not reproduced', () => {
    // Income one dollar higher again: variance would be +189, not the declared +188.
    const broken = FY2020_21_FUNCTIONS_TEXT.replace(
      '186,942 169,828 149,630 145,084 37,312',
      '186,943 169,828 149,630 145,084 37,312',
    );
    const parsed = parseDubboGpfsExtraction(
      extraction202021({ functions: broken }),
      CONTEXT_2020_21,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole FY2020-21 extraction when the face total disagrees', () => {
    const broken = FY2020_21_INCOME_TEXT.replace('149,630 145,084', '149,631 145,084');
    const parsed = parseDubboGpfsExtraction(extraction202021({ income: broken }), CONTEXT_2020_21);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });
});

describe('Dubbo GPFS six-year ingestion adds only FY2020-21 rows', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    await MeasureModel.insertMany([
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2026-27',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-1',
        project_name: 'Existing budget row 1',
      },
      {
        amount_cents: 654_321,
        measure_type: 'estimate',
        fiscal_year: '2025-26',
        source_id: 'dubbo-council',
        source_url: 'https://www.dubbo.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-dubbo-2',
        project_name: 'Existing budget row 2',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('adds 18 FY2020-21 rows and preserves the 89 earlier rows and every other source', async () => {
    const records = [
      ...parsedFixture202021().records,
      ...parsedFixture202122().records,
      ...parsedFixture202223().records,
      ...parsedFixture202324().records,
      ...parsedFixture().records,
      ...parsedFixture202526().records,
    ];
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(107);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2020-21' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2021-22' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2022-23' }),
    ).toBe(17);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2023-24' }),
    ).toBe(17);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2024-25' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID, fiscal_year: '2025-26' }),
    ).toBe(19);
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council' })).toBe(2);
    expect(await MeasureModel.countDocuments({})).toBe(109);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: DUBBO_GPFS_ID })).toBe(107);
    expect(await MeasureModel.countDocuments({ source_id: 'dubbo-council' })).toBe(2);
    expect(await MeasureModel.countDocuments({})).toBe(109);

    expect(
      await MeasureModel.countDocuments({
        source_id: DUBBO_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: DUBBO_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: DUBBO_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(107);
  });
});
