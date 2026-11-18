import {
  PORT_MACQUARIE_HASTINGS_GPFS_FISCAL_YEAR,
  PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
  parsePortMacquarieHastingsGpfsExtraction,
  type PortMacquarieHastingsGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 General Purpose Financial
// Statements (Income Statement PDF page 7, printed page 4). The Original
// unaudited budget column precedes each line label, so each value read is the
// first amount after the label (the FY2024-25 actual). The Income Statement does
// not print a combined total-expenses line; total expenses is the printed B1-1
// "Total functions and activities" total, which equals the printed
// expenses-excluding-depreciation line plus the printed depreciation/impairment
// line.
const INCOME_TEXT = `Port Macquarie-Hastings Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 121,907 Rates and annual charges B2-1 122,578 118,803 48,186 User charges and fees B2-2 47,803 47,259 7,038 Other revenues B2-3 8,149 8,680 18,205 Grants and contributions provided for operating purposes B2-4 15,089 17,183 66,961 Grants and contributions provided for capital purposes B2-4 92,780 132,080 11,114 Interest and investment income B2-5 15,263 14,041 – Other income B2-6 5,567 2,343 273,411 Total income from continuing operations 307,229 340,389 Expenses from continuing operations 71,850 Employee benefits and on-costs B3-1 74,948 64,601 71,179 Materials and services B3-2 76,589 63,274 3,029 Borrowing costs B3-3 614 236 9,149 Other expenses B3-5 8,733 10,377 3,050 Net loss from the disposal of assets B4-1 6,787 11,436 158,257 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 167,671 149,924 115,154 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 139,558 190,465 59,851 Depreciation and impairment of non-financial assets B3-4 62,164 61,302 55,303 Operating result from continuing operations 77,394 129,163 55,303 Net operating result for the year attributable to Council 77,394 129,163 (11,658) Net operating result for the year before grants and contributions provided for capital purposes (15,386) (2,917) The above Income Statement should be read in conjunction with the accompanying notes. Port Macquarie-Hastings Council Income Statement for the year ended 30 June 2025 Page 4 of 73`;

const COMPREHENSIVE_TEXT = `Port Macquarie-Hastings Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 77,394 129,163 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 150,157 123,663 Impairment reversal relating to IPPE due to natural disaster C1-6 34,371 19,911 Impairment of Infrastructure Plant & Equipment (2,497) – Total other comprehensive income for the year 182,031 143,574 Total comprehensive income for the year attributable to Council 259,425 272,737 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Port Macquarie-Hastings Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 73`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Leadership & Governance 70,610 74,484 30,177 27,663 40,433 46,821 5,311 – 55,270 88,985 Your Community Life 15,491 8,154 26,144 30,957 (10,653) (22,803) 9 12,573 383,967 366,423 Your Business and Industry 8,056 7,730 9,937 9,841 (1,881) (2,111) 12,273 244 53,447 55,070 Your Natural and Built Environment 213,072 250,021 163,577 142,765 49,495 107,256 90,276 136,446 3,273,969 2,956,372 Total functions and activities 307,229 340,389 229,835 211,226 77,394 129,163 107,869 149,263 3,766,653 3,466,850 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 73 Port Macquarie-Hastings Council | Notes to the Financial Statements 30 June 2025`;

const DEPRECIATION_TEXT = `§Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 (i) Interest bearing liability costs Interest on loans 529 990 Total interest bearing liability costs 529 990 Total interest bearing liability costs expensed 529 990 (ii) Other borrowing costs Remediation (tip) liabilities C3-5 85 (754) Total other borrowing costs 85 (754) Total borrowing costs expensed 614 236 B3-4 Depreciation, amortisation and impairment of non-financial assets §Subnote§ Depreciation and amortisation Plant and equipment, furniture and fittings 3,527 3,647 Land improvements (depreciable) 271 268 Infrastructure: C1-6 – Buildings and other structures 6,248 7,742 – Other structures 289 – – Roads, bridges and footpaths 17,031 16,436 – Other road assets 2,369 2,553 – Stormwater drainage 3,806 3,732 – Water supply network 12,447 11,798 – Sewerage network 10,589 9,936 – Other open space/recreational assets 5,201 4,805 Other assets 329 305 Reinstatement, rehabilitation and restoration assets: – Cairncross tip remediation asset C1-6 57 80 Total depreciation and amortisation costs 62,164 61,302 Total depreciation and impairment for non-financial assets 62,164 61,302 Material accounting policy information Depreciation and amortisation Depreciation and amortisation are calculated using the straight line method to allocate their cost, net of their residual values, over their estimated useful lives. Page 23 of 73`;

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'e73a1cd805f9431001da032e88c2408fb8ad19eed083d2adc46e7850cb16618c',
      bytes: 8_407_089,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 7),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 8),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 16),
      textPage(DEPRECIATION_TEXT, 26),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.pmhc.nsw.gov.au/files/assets/public/v/1/document-files/your-council/election/annualreports/2024-2025/part-2-financial-statements.pdf';

const CONTEXT: PortMacquarieHastingsGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Part 2 Financial Statements',
    url: PDF_URL,
    fiscal_year: PORT_MACQUARIE_HASTINGS_GPFS_FISCAL_YEAR,
    listing_url: PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/port-macquarie-hastings-gpfs/part-2-financial-statements.pdf',
    sha256: 'e73a1cd805f9431001da032e88c2408fb8ad19eed083d2adc46e7850cb16618c',
    bytes: 8_407_089,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: PORT_MACQUARIE_HASTINGS_GPFS_REPORTING_URL,
};

/** Golden fixture for the port-macquarie-hastings-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const PORT_MACQUARIE_HASTINGS_GPFS_ROW_COUNT = 17;
export const PORT_MACQUARIE_HASTINGS_GPFS_GOLDEN_DIGEST =
  '9257f242cfd23a1c68464bb9f236fd63372eb7f8bd8e1255c0bca6e1d242c008';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '9257f242cfd23a1c68464bb9f236fd63372eb7f8bd8e1255c0bca6e1d242c008';

export function goldenRecords() {
  const parsed = parsePortMacquarieHastingsGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
