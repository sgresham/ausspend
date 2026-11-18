/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Text fixtures reconstructed from the audited Penrith City Council FY2024-25
 * General Purpose Financial Statements PDF (Income Statement PDF p6; Statement
 * of Comprehensive Income p7; B1-1 Functions or activities p15; note B3-4
 * depreciation p30). The text is the PDF text layer in content-stream order,
 * exactly as the shared extractor sees it; each row's Original unaudited budget
 * amount precedes the line label and the FY2024-25 actual follows it.
 */
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

export const PENRITH_PDF_URL =
  'https://www.penrithcity.nsw.gov.au/images/documents/resources-documents/documents/2025_financial_statements_audited.pdf';
export const PENRITH_PDF_SHA256 =
  'eefb5f3f3f09d53cb6b674a2238016c91edf58f04fd53068f4d8629c55ac42f1';
export const PENRITH_PDF_BYTES = 4155530;
export const PENRITH_INCOME_TEXT =
  "Penrith City Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Restated Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 211,408 Rates and annual charges B2-1 212,763 198,395 54,324 User charges and fees B2-2 50,566 47,784 4,006 Other revenues B2-3 5,852 6,047 19,036 Grants and contributions provided for operating purposes B2-4 26,250 31,244 44,725 Grants and contributions provided for capital purposes B2-4 62,032 92,062 10,255 Interest and investment income B2-5 15,322 10,644 4,317 Other income B2-6 13,775 4,933 1,247 Net gain from the disposal of assets B4-1 3,966 20,834 349,318 Total income from continuing operations 390,526 411,943 Expenses from continuing operations 158,541 Employee benefits and on-costs B3-1 148,610 137,787 106,158 Materials and services B3-2 101,751 98,180 1,105 Borrowing costs B3-3 1,077 1,096 13,876 Other expenses B3-5 16,645 15,167 279,680 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 268,083 252,230 69,638 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 122,443 159,713 63,451 Depreciation, amortisation and impairment of non-financial assets B3-4 71,376 64,277 6,187 Operating result from continuing operations 51,067 95,436 Discontinued operations – Operating result from discontinued operations D2 – (361) 6,187 Net operating result for the year attributable to Council 51,067 95,075 (38,538) Net operating result for the year before grants and contributions provided for capital purposes (10,965) 3,013 The above Income Statement should be read in conjunction with the accompanying notes. Penrith City Council Income Statement for the year ended 30 June 2025 Page 4";
export const PENRITH_COMPREHENSIVE_TEXT =
  "Penrith City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ Restated $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 51,067 95,075 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-8 626,846 162,997 Total items which will not be reclassified subsequent to operating result 626,846 162,997 Total other comprehensive income for the year 626,846 162,997 Total comprehensive income for the year attributable to Council 677,913 258,072 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Penrith City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5";
export const PENRITH_FUNCTIONS_TEXT =
  "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 $ '000 Restated Functions or activities from continuing operations We protect & enhance an ecologically sustainable environment 51,896 47,347 51,656 47,777 240 (430) 2,898 2,566 2,033 2,115 We are welcoming, healthy, happy, creative and connected 57,872 51,912 86,565 82,192 (28,693) (30,280) 16,250 13,487 4,183 4,903 We plan and shape our growing city 42,103 48,196 18,734 17,929 23,369 30,267 32,471 39,275 127 437 We manage and improve our built environment 35,254 65,316 126,526 117,368 (91,272) (52,052) 23,582 55,753 4,165,656 3,5 74,987 We have open and collaborative leadership 203,401 199,172 55,978 51,241 147,423 147,931 13,081 12,225 889,924 796,297 Total functions or activities from continuing operations 390,526 411,943 339,459 316,507 51,067 95,436 88,282 123,306 5,061,923 4,378,739 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 Penrith City Council | Notes to the Financial Statements 30 June 2025 Restated Restated Restated Restated";
export const PENRITH_DEPRECIATION_TEXT =
  "§Note/Subtotal§ 2025 2024 $ '000 Notes Restated Depreciation and amortisation Plant and equipment C1-8 4,415 4,068 Office equipment C1-8 1,792 2,046 Furniture and fittings C1-8 86 130 Land improvements (depreciable) C1-8 704 667 Infrastructure: C1-8 – Buildings C1-8 15,272 13,526 – Roads 1 C1-8 29,221 26,420 – Stormwater drainage C1-8 10,692 9,429 – Other open space/recreational assets c1-8 8,160 6,939 – Other structure C1-8 488 488 Other assets: – Library books C1-8 459 471 – Other C1-8 24 24 Right of use assets C2-1 – 6 Intangible assets C1-10 63 63 Total depreciation and amortisation costs 71,376 64,277 Total depreciation, amortisation and impairment for non-financial assets 71,376 64,277 Material accounting policy information Depreciation and amortisation are calculated using the straight-line method to allocate their cost, net of their residual values, over their estimated useful lives. Depreciation and amortisation Council assets held at fair value that are not held primarily for their ability to generate net cash flow, and that are deemed to be specialised, are not tested for impairment since these assets are assessed on an annual basis to ensure that the carrying amount is not materially different from fair value and therefore an impairment loss would be captured during this assessment. Impairment of non-financial assets Intangible assets not yet available for use, are tested annually for impairment, or more frequently if events or changes in circumstances indicate that they might be impaired. Other non-financial assets that do not meet the criteria above are tested for impairment whenever events or changes in circumstances indicate that the carrying amount may not be recoverable. An impairment loss is recognised for the amount by which the asset’s carrying amount exceeds its recoverable amount. The recoverable amount is the higher of an asset’s fair value less costs to sell and value in use. Impairment losses for revalued assets are firstly offset against the amount in the revaluation surplus for the class of asset, with only the excess to be recognised in the Income Statement. (1) Prior year amount restated due to prior year error adjustment refer to note G4-1 B3-4 Depreciation, amortisation and impairment of non-financial assets Page 28 Penrith City Council | Notes to the Financial Statements 30 June 2025";
function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}
export function penrithExtraction(): PdfExtraction {
  return {
    source: { sha256: PENRITH_PDF_SHA256, bytes: PENRITH_PDF_BYTES },
    pages: [
      textPage(PENRITH_INCOME_TEXT, 6),
      textPage(PENRITH_COMPREHENSIVE_TEXT, 7),
      textPage(PENRITH_FUNCTIONS_TEXT, 15),
      textPage(PENRITH_DEPRECIATION_TEXT, 30),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}
