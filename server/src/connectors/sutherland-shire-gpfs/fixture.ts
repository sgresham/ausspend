import {
  SUTHERLAND_SHIRE_GPFS_FISCAL_YEAR,
  SUTHERLAND_SHIRE_GPFS_REPORTING_URL,
  parseSutherlandShireGpfsExtraction,
  type SutherlandShireGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 PDF (printed pp. 4, 5 and 13;
// PDF pages 5, 6 and 14). The income statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after it.
// A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. The printed "Net operating result for the
// year before grants and contributions provided for capital purposes" is
// negative and is kept in reconciliation evidence only (amount_cents >= 0).
const INCOME_TEXT = `Sutherland Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 2025 2024 $ '000 Notes $ '000 $ '000 Income from continuing operations 198,517 Rates and annual charges B2-1 199,754 190,447 47,397 User charges and fees B2-2 51,722 45,114 12,637 Other revenues B2-3 12,706 12,825 19,482 Grants and contributions provided for operating purposes B2-4 19,436 21,324 13,080 Grants and contributions provided for capital purposes B2-4 16,267 26,621 13,641 Interest and investment income B2-5 17,936 16,549 5,212 Other income B2-6 7,721 5,379 309,966 Total income from continuing operations 325,542 318,259 Expenses from continuing operations 133,598 Employee benefits and on-costs B3-1 130,034 120,253 107,360 Materials and services B3-2 110,645 112,224 646 Borrowing costs B3-3 629 722 9,267 Other expenses B3-5 13,313 11,191 5,298 Net loss from the disposal of assets B4-1 3,651 7,721 256,169 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 258,272 252,111 53,797 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 67,270 66,148 57,027 Depreciation, amortisation and impairment of non-financial assets B3-4 53,206 53,903 (3,230) Operating result from continuing operations 14,064 12,245 (3,230) Net operating result for the year attributable to Council 14,064 12,245 (16,312) Net operating result for the year before grants and contributions provided for capital purposes (2,203) (14,376) The above Income Statement should be read in conjunction with the accompanying notes. Sutherland Shire Council Income Statement for the year ended 30 June 2025 Page 4 of 88`;

const COMPREHENSIVE_TEXT = `Sutherland Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ 2025 2024 Notes $ '000 $ '000 Net operating result for the year – from Income Statement 14,064 12,245 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 56,957 127,534 Total items which will not be reclassified subsequent to operating result 56,957 127,534 Total other comprehensive income for the year 56,957 127,534 Total comprehensive income for the year attributable to Council 71,021 139,779 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Sutherland Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 88`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 $ '000 Functions or activities Arts & Culture 1,328 1,415 8,625 5,794 (7,297) (4,379) – – 53,576 59,614 Business & Economic Development 402 428 2,114 1,776 (1,712) (1,348) 175 170 250 84 Childrens Services 19,592 16,690 21,556 22,084 (1,964) (5,394) 1,650 1,182 9,633 10,722 Community Services 91 165 968 788 (877) (623) 56 140 – – Community Venues 1,427 1,369 2,032 631 (605) 738 – 20 42,260 45,917 Development Assessment 2,809 2,934 8,655 8,941 (5,846) (6,007) – – 44 14 Emergency Management 651 – 7,820 6,989 (7,169) (6,989) 651 – 7,975 8,889 Environmental Health & Sustainability 961 235 6,890 5,947 (5,929) (5,712) 298 186 29 14 Integrated Transport 7,007 5,746 27,765 17,197 (20,758) (11,451) 3,848 4,478 1,114,570 1,114,421 Leisure & Aquatic Services 12,220 11,510 19,182 14,614 (6,962) (3,104) 34 – 138,411 136,976 Libraries 872 851 9,820 7,242 (8,948) (6,391) 727 724 19,311 20,868 Natural Areas Management 264 253 2,516 2,436 (2,252) (2,183) 259 253 234,447 335,927 Parks & Open Spaces 329 277 13,905 8,563 (13,576) (8,286) – – 528,812 382,154 Public Domain Management 1,860 1,341 3,289 916 (1,429) 425 – – 109 46 Public Health & Safety 627 627 5,875 4,862 (5,248) (4,235) 59 57 23,405 24,941 Regulatory Compliance 8,239 8,206 7,218 7,326 1,021 880 – – 574 387 Sporting Facilities 6,000 6,853 10,308 4,124 (4,308) 2,729 742 1,772 117,775 59,166 Stormwater & Waterways 2,390 2,409 13,691 5,086 (11,301) (2,677) – – 514,952 518,001 Strategic Land Use Planning 12,977 16,053 1,677 1,288 11,300 14,765 12,235 15,217 79,694 73,022 Waste Management 46,936 45,552 55,708 53,371 (8,772) (7,819) 413 11,329 49,833 51,678 Asset Strategy & Delivery 8,222 11,429 7,592 10,561 630 868 3,959 117 104,809 94,169 Building Infrastructure 135 148 20,841 12,134 (20,706) (11,986) 122 – 175,894 184,159 Customer & Engagement – 2 5,879 4,616 (5,879) (4,614) – 12,300 – – Finance, Property & Performance 189,457 182,810 15,198 71,129 174,259 111,681 10,327 – 327,508 345,511 Governance 272 632 15,313 12,335 (15,041) (11,703) – – 21,320 23,607 Fleet & Logistics 71 86 327 1,380 (256) (1,294) – – 1,368 1,137 Human Resources 170 2 3,579 2,704 (3,409) (2,702) 148 – 300 18 Information Management & Technology 233 236 13,135 11,180 (12,902) (10,944) – – 2,212 2,540 Total functions and activities 325,542 318,259 311,478 306,014 14,064 12,245 35,703 47,945 3,569,071 3,493,982 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 88 Sutherland Shire Council | Notes to the Financial Statements 30 June 2025`;

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: 'e'.repeat(64), bytes: 5_464_555 },
    pages: [
      pdfPage(overrides.income ?? INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const CONTEXT: SutherlandShireGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements 2024-2025 - PDF - 5336 KB',
    url: 'https://www.sutherlandshire.nsw.gov.au/__data/assets/pdf_file/0019/109144/2024-2025-Sutherland-Shire-Council-Financial-Statements.pdf',
    fiscal_year: SUTHERLAND_SHIRE_GPFS_FISCAL_YEAR,
    listing_url: SUTHERLAND_SHIRE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/sutherland-shire-gpfs/2024-2025-Sutherland-Shire-Council-Financial-Statements.pdf',
    sha256: 'a97e7719e485a0fb6f49468c0eb7672a5b120c0aa6077ccfdb0349d56dd2b743',
    bytes: 5_464_555,
    fetched_at: '2026-11-17T00:00:00.000Z',
  },
  sourceDate: '2026-11-17',
  reporting_url: SUTHERLAND_SHIRE_GPFS_REPORTING_URL,
};

/** Golden fixture for the sutherland-shire-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const SUTHERLAND_SHIRE_GPFS_ROW_COUNT = 17;
export const SUTHERLAND_SHIRE_GPFS_GOLDEN_DIGEST =
  '382e9e87413f92e46b110a0423b5501a2e5f1163cd8c078506a0b0dd63a26a86';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = '382e9e87413f92e46b110a0423b5501a2e5f1163cd8c078506a0b0dd63a26a86';

export function goldenRecords() {
  const parsed = parseSutherlandShireGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
