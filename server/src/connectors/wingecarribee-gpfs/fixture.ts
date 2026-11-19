import {
  WINGECARRIBEE_GPFS_FISCAL_YEAR,
  WINGECARRIBEE_GPFS_REPORTING_URL,
  parseWingecarribeeGpfsExtraction,
  type WingecarribeeGpfsParseContext,
} from './parse.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact content-stream text extracted from the archived audited FY2025-26 PDF
// (PDF pp. 4, 5 and 14 of 104). The Income Statement prints the Original
// unaudited budget column before each line label, with Actual 2026 and Actual
// 2025 after it. A parser that took the first number in the line would read the
// budget; the expected values are all Actual 2026. Wingecarribee Shire Council
// prints seven revenue lines and five expense lines (including a real net loss
// on the disposal of assets of 1,891). The net result and the printed
// before-capital result are both positive. Other comprehensive income has a
// single component (revaluation 65,755) equal to the printed other
// comprehensive income.
export const WINGECARRIBEE_PDF_URL =
  'https://www.wsc.nsw.gov.au/files/assets/public/v/2/council/policies/wsc-audited-financial-statement-2025-2026.pdf';
export const WINGECARRIBEE_PDF_SHA256 =
  'ead33e18c1069ee693ae33dcd4e4f653ab68a05369cec6150301145b8f0b0fe0';
export const WINGECARRIBEE_PDF_BYTES = 2504988;

export const WINGECARRIBEE_INCOME_TEXT =
  `Wingecarribee Shire Council | Income Statement | for the year ended 30 June 2026 §Statement§ Original unaudited budget Actual Actual 2026 $ '000 Notes 2026 2025 Income from continuing operations 106,097 Rates and annual charges B2-1 107,402 101,994 25,098 User charges and fees B2-2 30,701 25,182 2,496 Other revenue B2-3 2,525 2,817 9,442 Grants and contributions provided for operating purposes B2-4 11,491 7,859 14,787 Grants and contributions provided for capital purposes B2-4 35,163 57,742 8,394 Interest and investment income B2-5 11,361 12,428 981 Other income B2-6 1,249 993 167,295 Total income from continuing operations 199,892 209,015 Expenses from continuing operations 50,963 Employee benefits and on-costs B3-1 51,923 52,543 55,636 Materials and services B3-2 55,801 56,527 2,934 Borrowing costs B3-3 2,834 863 3,311 Other expenses B3-5 4,540 6,686 1,000 Net loss from the disposal of assets B4-1 1,891 5,404 113,844 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 116,989 122,023 53,451 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 82,903 86,992 44,603 Depreciation, amortisation and impairment of non-financial assets B3-4 41,813 40,171 8,848 Operating result from continuing operations 41,090 46,821 8,848 Net operating result for the year attributable to Council 41,090 46,821 (5,939) Net operating result for the year before grants and contributions provided for capital purposes 5,927 (10,921) The above Income Statement should be read in conjunction with the accompanying notes. Wingecarribee Shire Council Income Statement for the year ended 30 June 2026 Page 4`;

export const WINGECARRIBEE_COMPREHENSIVE_TEXT =
  `Wingecarribee Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2026 §Note/Subtotal§ $ '000 Notes 2026 2025 Net operating result for the year – from Income Statement 41,090 46,821 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain / (loss) on revaluation of Infrastructure, property, plant and equipment C1-7 65,755 62,368 Other comprehensive income for the year 65,755 62,368 Total comprehensive income for the year attributable to Council 106,845 109,189 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Wingecarribee Shire Council Statement of Comprehensive Income for the year ended 30 June 2026 Page 5`;

export const WINGECARRIBEE_FUNCTIONS_TEXT =
  `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2026 2025 2026 2025 2026 2025 2026 2025 2026 2025 Functions or activities Leadership 69,270 75,639 43,483 57,048 25,787 18,591 – 9,333 161,418 289,878 People 1,887 4,024 8,045 8,223 (6,158) (4,199) 1,201 3,279 86,670 89,654 Places 104,614 106,283 79,064 70,504 25,550 35,779 44,208 50,475 2,261,169 1,993,182 Environment 18,857 19,202 24,532 23,268 (5,675) (4,066) 1,245 2,511 256,544 262,734 Economy 5,264 3,867 3,678 3,151 1,586 716 – 3 45,551 38,204 Other – – – – – – – – (3) – Total functions and activities 199,892 209,015 158,802 162,194 41,090 46,821 46,654 65,601 2,811,349 2,673,652 B1-2 Components of functions or activities §Note§ Leadership §TocItem§ §TocItem§ §Subnote§ Details relating to the Council’s functions or activities as reported in B1-1 are as follows: Includes costs relating to Council's role as a component of democratic government, including elections, members' fees and expenses, subscriptions to local authority associations, meetings of Council and legislative compliance; corporate support services. People Includes fire protection, emergency services, enforcement of regulations and animal control; aboriginal and other community services and administration; youth services; aged and disabled persons services and swimming pools. Places Includes urban local and urban regional sealed and unsealed roads, bridges, footpaths, parking areas, and aerodromes; public cemeteries; public conveniences; street lighting; town planning; public libraries; community centres and halls; sporting grounds and venues; parks; gardens and other sporting and recreational services; water supplies; sewerage services; drainage; stormwater management Environment Includes noxious plants and insect/vermin control; other environmental protection; solid waste management, including domestic waste; other waste management; other sanitation; and garbage and street cleaning. Economy Includes camping areas and caravan parks; tourism and events; economic development; and Southern Regional Livestock Exchange (SRLX). B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 Wingecarribee Shire Council | Notes to the Financial Statements 30 June 2026`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

export function wingecarribeeExtraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: WINGECARRIBEE_PDF_SHA256,
      bytes: WINGECARRIBEE_PDF_BYTES,
    },
    pages: [
      pdfPage(overrides.income ?? WINGECARRIBEE_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? WINGECARRIBEE_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? WINGECARRIBEE_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

export const WINGECARRIBEE_CONTEXT: WingecarribeeGpfsParseContext = {
  document: {
    id: 'gpfs-2025-26',
    title: 'Audited Financial Statement 2025-26',
    url: WINGECARRIBEE_PDF_URL,
    fiscal_year: WINGECARRIBEE_GPFS_FISCAL_YEAR,
    listing_url: WINGECARRIBEE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: 'wingecarribee-gpfs/wsc-audited-financial-statement-2025-2026.pdf',
    sha256: WINGECARRIBEE_PDF_SHA256,
    bytes: WINGECARRIBEE_PDF_BYTES,
    fetched_at: '2026-11-19T00:00:00.000Z',
  },
  sourceDate: '2026-11-19',
  reporting_url: WINGECARRIBEE_GPFS_REPORTING_URL,
};

/** Golden fixture for the wingecarribee-gpfs module: 17 rows. */
export const WINGECARRIBEE_GPFS_ROW_COUNT = 17;
export const WINGECARRIBEE_GPFS_GOLDEN_DIGEST =
  '5f0c0b287ec56218330545a88f8aa6bf4405801aa7166f7019e9b6ecea521963';
export const ROW_COUNT = WINGECARRIBEE_GPFS_ROW_COUNT;
export const GOLDEN_DIGEST = WINGECARRIBEE_GPFS_GOLDEN_DIGEST;

export function goldenRecords() {
  const parsed = parseWingecarribeeGpfsExtraction(
    wingecarribeeExtraction(),
    WINGECARRIBEE_CONTEXT,
  );
  return Array.isArray(parsed) ? parsed : parsed.records;
}
