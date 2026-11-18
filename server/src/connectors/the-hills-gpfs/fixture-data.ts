/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Text fixtures reconstructed from the audited The Hills Shire Council
 * FY2024-25 General Purpose Financial Statements PDF (Income Statement PDF p7;
 * Statement of Comprehensive Income p8; B1-1 Functions or activities p16; note
 * B3-4 depreciation p27). The text is the PDF text layer in content-stream
 * order, exactly as the shared extractor sees it; each row's Original unaudited
 * budget amount precedes the line label and the FY2024-25 actual follows it.
 */
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

export const THE_HILLS_PDF_URL =
  'https://www.thehills.nsw.gov.au/files/assets/public/v/1/cms-docs/council/key-docs/annual-report-amp-archive/2024-2025/the-hills-shire-council-financial-statements-2024-2025.pdf';
export const THE_HILLS_PDF_SHA256 =
  '5972fc23ae97e3884283880bb3c1fda5ea8eb13ce0585e1e26e5609db2a2ff65';
export const THE_HILLS_PDF_BYTES = 5589503;
export const THE_HILLS_INCOME_TEXT =
  "The Hills Shire Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 142,994 Rates and annual charges B2-1 144,008 128,728 29,911 User charges and fees B2-2 35,509 31,193 6,933 Other revenues B2-3 9,660 9,312 19,810 Grants and contributions provided for operating purposes B2-4 18,992 23,113 102,404 Grants and contributions provided for capital purposes B2-4 167,184 154,622 12,978 Interest and investment income B2-5 30,305 25,956 8,427 Other income B2-6 8,691 8,152 1,262 Net gain from the disposal of assets B4-1 3,102 2,407 324,719 Total income from continuing operations 417,451 383,483 Expenses from continuing operations 83,698 Employee benefits and on-costs B3-1 81,713 73,247 88,447 Materials and services B3-2 89,550 79,966 – Borrowing costs B3-3 64 37 6,710 Other expenses B3-5 19,498 41,618 178,855 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 190,825 194,868 145,864 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 226,626 188,615 29,613 Depreciation, amortisation and impairment of non-financial assets B3-4 30,232 26,904 116,251 Operating result from continuing operations 196,394 161,711 116,251 Net operating result for the year attributable to Council 196,394 161,711 13,847 Net operating result for the year before grants and contributions provided for capital purposes 29,210 7,089 The above Income Statement should be read in conjunction with the accompanying notes. The Hills Shire Council Income Statement for the year ended 30 June 2025 Page 5";
export const THE_HILLS_COMPREHENSIVE_TEXT =
  "The Hills Shire Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 196,394 161,711 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain on revaluation of infrastructure, property, plant and equipment C1-6 128,510 12,991 Total items which will not be reclassified subsequent to operating result 128,510 12,991 Total other comprehensive income for the year 128,510 12,991 Total comprehensive income for the year attributable to Council 324,904 174,702 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. The Hills Shire Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6";
export const THE_HILLS_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Building a Vibrant Community & Prosperous Economy 30,223 28,523 58,374 54,465 (28,151) (25,942) 8,379 9,593 357,247 326,180 Shaping Growth 16,593 16,401 16,357 16,542 236 (141) 11,838 11,624 464,174 430,862 Delivering & Maintaining Infrastructure 175,977 162,736 56,228 50,089 119,749 112,647 159,758 148,428 5,126,890 4,926,134 Valuing Our Surroundings 59,556 49,532 65,453 57,878 (5,897) (8,346) 581 522 – – Proactive Leadership (Governance) 12,340 13,192 24,645 42,798 (12,305) (29,606) 90 – 833,447 780,468 General Purpose Revenue 122,762 113,099 – – 122,762 113,099 5,530 7,568 – – Total functions and activities 417,451 383,483 221,057 221,772 196,394 161,711 186,176 177,735 6,781,758 6,463,644 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 14 The Hills Shire Council | Notes to the Financial Statements 30 June 2025";
export const THE_HILLS_DEPRECIATION_TEXT =
  "§Note/Subtotal§ $ '000 Notes 2025 2024 Depreciation and amortisation Plant and equipment 3,114 2,820 Office equipment 578 37 Infrastructure: C1-6 – Buildings 5,727 5,848 – Roads 15,774 13,518 – Stormwater drainage 2,061 1,950 – Other open space/recreational assets 2,542 2,270 Right of use assets C2-1 436 461 Total gross depreciation and amortisation costs 30,232 26,904 Total depreciation and amortisation costs 30,232 26,904 Total depreciation, amortisation and impairment for non-financial assets 30,232 26,904 Material accounting policy information Depreciation and amortisation Depreciation and amortisation are calculated using the straight line method to allocate their cost, net of their residual values, over their estimated useful lives. Useful lives are included in Note C1-6 for IPPE assets. B3-4 Depreciation, amortisation and impairment of non-financial assets Page 25 The Hills Shire Council | Notes to the Financial Statements 30 June 2025";
function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}
export function theHillsExtraction(): PdfExtraction {
  return {
    source: { sha256: THE_HILLS_PDF_SHA256, bytes: THE_HILLS_PDF_BYTES },
    pages: [
      textPage(THE_HILLS_INCOME_TEXT, 7),
      textPage(THE_HILLS_COMPREHENSIVE_TEXT, 8),
      textPage(THE_HILLS_FUNCTIONS_TEXT, 16),
      textPage(THE_HILLS_DEPRECIATION_TEXT, 27),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}
