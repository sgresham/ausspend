import {
  CITY_OF_SYDNEY_GPFS_FISCAL_YEAR,
  CITY_OF_SYDNEY_GPFS_REPORTING_URL,
  parseCityOfSydneyGpfsExtraction,
  type CityOfSydneyGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (pp. 6, 7 and 16). The
// income statement prints the Budget 2025 column *before* the label, so a parser
// that took the first number in the line would read the budget; the expected
// values below are all Actual 2025.
const INCOME_TEXT = `Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 419,230 Rates and annual charges B2-1 420,955 397,592 149,206 User charges and fees B2-2 162,346 163,152 42,362 Other revenue B2-3 50,103 41,915 17,477 Grants and contributions provided for operating purposes B2-4 15,652 16,508 95,048 Grants and contributions provided for capital purposes B2-4 111,331 117,839 34,285 Interest and investment income B2-5 39,676 39,591 88,075 Other income B2-6 109,685 100,738 – Net gain from the disposal of assets B4-1 – 17,242 845,683 Total income from continuing operations 909,748 894,577 Expenses from continuing operations 289,337 Employee benefits and on-costs B3-1 306,623 276,897 244,959 Materials and services B3-2 286,173 299,048 – Borrowing costs B3-3 211 216 69,197 Other expenses B3-5 46,497 46,557 – Net loss from the disposal of assets B4-1 6,568 – 603,493 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 646,072 622,718 242,190 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 263,676 271,859 126,789 Depreciation, amortisation and impairment of non-financial assets B3-4 130,214 123,938 115,401 Operating result from continuing operations 133,462 147,921 115,401 Net operating result for the year attributable to Council 133,462 147,921 20,353 Net operating result for the year before grants and contributions provided for capital purposes 22,131 30,082 The above Income Statement should be read in conjunction with the accompanying notes. Council of the City of Sydney Income Statement for the year ended 30 June 2025 Page 6`;

const COMPREHENSIVE_TEXT = `$ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 133,462 147,921 Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-8 1,116,252 369,891 Movement in Trust Assets reserve - Crown land revaluation C1-8 201,866 160,390 Total items which will not be reclassified subsequent to operating result 1,318,118 530,281 Total comprehensive income for the year attributable to Council 1,451,580 678,202 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Council of the City of Sydney Statement of Comprehensive Income for the year ended 30 June 2025 Page 7`;

const FUNCTIONS_TEXT = `Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions 1 Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Responsible governance and stewardship 193,108 194,312 273,070 266,389 (79,962) (72,077) 2,024 2,184 6,147,027 5,614,380 A leading environmental performer 4,203 3,623 110,016 108,064 (105,813) (104,441) 3,059 2,369 404,582 394,830 Public places for all 123,170 123,682 170,745 161,978 (47,575) (38,296) 59,476 60,091 10,011,528 9,002,511 Design excellence and sustainable development 20,816 23,958 50,708 49,211 (29,892) (25,253) 15,568 12,168 180,720 204,989 A city for walking, cycling and public transport 95,875 100,961 15,497 15,423 80,378 85,538 23,809 35,946 82,893 82,512 An equitable and inclusive city 15,393 13,945 49,525 43,863 (34,132) (29,918) 13,195 11,979 2,079 2,214 Resilient and diverse communities 58,420 58,197 57,175 56,452 1,245 1,745 2,273 2,429 5,336 3,135 A thriving cultural and creative life 5,421 1,559 14,912 12,662 (9,491) (11,103) 2,415 697 70,769 71,303 A transformed and innovative economy 97 142 31,864 30,163 (31,767) (30,021) – – 2,336 2,035 Housing for all – – 2,774 2,451 (2,774) (2,451) – – – – General purpose income 2 393,245 374,197 – – 393,245 374,197 5,164 6,484 – – Total functions and activities 909,748 894,576 776,286 746,656 133,462 147,920 126,983 134,347 16,907,270 15,377,909 (1) Grants & Contributions are also included within Income totals shown above (2) Includes: Rates & Annual Charges (incl. Ex-Gratia), Untied General Purpose Grants & Unrestricted Interest & Investment Income Council of the City of Sydney Notes to the Financial Statements for the year ended 30 June 2025 B Financial Performance B1 Functions or activities B1-1 Income, expenses and assets - by function/activity Page 16`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'b'.repeat(64), bytes: 2_285_656 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 16),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: CityOfSydneyGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial statements 2024/25',
    url: 'https://www.cityofsydney.nsw.gov.au/-/media/corporate/files/publications/research-and-reports/annual-reports/city-of-sydney-financial-statements-2024-2025.pdf?download=true',
    fiscal_year: CITY_OF_SYDNEY_GPFS_FISCAL_YEAR,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/city-of-sydney-gpfs/city-of-sydney-financial-statements-2024-25.pdf',
    sha256: 'b52e7a1ecdde5bea6937f2d3040e04ed340a6db8cceb959d51c73e84504f623b',
    bytes: 2_285_656,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: CITY_OF_SYDNEY_GPFS_REPORTING_URL,
};

/** Golden fixture for the city-of-sydney-gpfs module migration: 18 rows, unchanged keys/amounts. */
export const CITY_OF_SYDNEY_GPFS_ROW_COUNT = 18;
export const CITY_OF_SYDNEY_GPFS_GOLDEN_DIGEST =
  '03b4951babc4f909675b66df3be356f184f5a5b5fd5159adc2d5ab49fac94a73';
export const ROW_COUNT = 18;
export const GOLDEN_DIGEST = '03b4951babc4f909675b66df3be356f184f5a5b5fd5159adc2d5ab49fac94a73';

export function goldenRecords() {
  const parsed = parseCityOfSydneyGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
