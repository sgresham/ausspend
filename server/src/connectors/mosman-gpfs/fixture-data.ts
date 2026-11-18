/**
 * Text pages extracted verbatim from the audited Mosman Council FY2024-25
 * General Purpose Financial Statements PDF (Income Statement PDF p6 / printed
 * p4; Statement of Comprehensive Income PDF p7 / printed p5; B1-1 "Total
 * functions and activities" PDF p15 / printed p13; notes B2-4 PDF p20-21 /
 * printed p18-19, B3-1 PDF p24 / printed p22, B3-2 PDF p25 / printed p23,
 * B3-3 PDF p26 / printed p24 and B3-4 PDF p27 / printed p25).
 */
import type { PdfPage } from '../pdf-extract.js';

export const MOSMAN_PDF_URL =
  'https://mosman.nsw.gov.au/sites/default/files/2025-10/Annual_Financial_Statements%20%28Audited%29-FY2024-2025%20FINAL_LR.pdf';
export const MOSMAN_PDF_SHA256 = '8ff17c938962730603daee3515d3d6bd4ae8451230276b8404f5cbfb28c66faf';
export const MOSMAN_PDF_BYTES = 3_428_056;

const PAGES: PdfPage[] = [
  {
    page_number: 6,
    text: "Mosman Municipal Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 32,678 Rates and annual charges B2-1 32,821 31,018 11,215 User charges and fees B2-2 10,124 9,907 3,537 Other revenues B2-3 5,022 3,691 3,106 Grants and contributions provided for operating purposes B2-4 3,213 3,418 2,150 Grants and contributions provided for capital purposes B2-4 3,154 6,192 750 Interest and investment income 1,674 1,653 3,795 Other income B2-5 6,939 6,281 166 Net share of interests in joint ventures and associates using the equity method 213 190 57,397 Total income from continuing operations 63,160 62,350 Expenses from continuing operations 21,093 Employee benefits and on-costs B3-1 19,986 18,993 22,870 Materials and services B3-2 23,064 22,600 275 Borrowing costs 213 254 3,728 Other expenses B3-4 3,793 3,363 305 Net loss from the disposal of assets 371 896 48,271 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 47,427 46,106 9,126 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 15,733 16,244 6,844 Depreciation, amortisation and impairment of non-financial assets B3-3 6,939 6,504 2,282 Operating result from continuing operations 8,794 9,740 2,282 Net operating result for the year attributable to Council 8,794 9,740 132 Net operating result for the year before grants and contributions provided for capital purposes 5,640 3,548 The above Income Statement should be read in conjunction with the accompanying notes. Mosman Municipal Council Income Statement for the year ended 30 June 2025 Page 4 of 68",
    items: [],
  },
  {
    page_number: 7,
    text: "Mosman Municipal Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 8,794 9,740 §Subnote§ Other comprehensive income: Amounts that will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-5 41,444 973 Other comprehensive income (loss) for the year 41,444 973 Total comprehensive income (loss) for the year attributable to Council 50,238 10,713 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Mosman Municipal Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 68",
    items: [],
  },
  {
    page_number: 15,
    text: "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities A Safe, Caring and Inclusive Community 983 919 2,293 2,302 (1,310) (1,383) 675 632 2,019 1,954 A Culturally Rich and Vibrant Community 1,201 1,725 4,959 4,805 (3,758) (3,080) 595 1,165 29,441 27,583 An Attractive and Sustainable Environment 8,919 8,392 8,647 8,589 272 (197) 134 117 160,002 131,793 An Engaged, Business Friendly Community with Strong Civic Leadership 28,240 26,721 15,530 14,358 12,710 12,363 852 1,078 108,555 100,752 Well Designed, Liveable and Accessible Places 23,440 22,890 15,075 14,689 8,365 8,201 3,967 5,445 348,474 342,781 A Healthy and Active Village Lifestyle 378 1,703 7,863 7,867 (7,485) (6,164) 144 1,173 76,035 68,912 Total functions and activities 63,161 62,350 54,367 52,610 8,794 9,740 6,367 9,610 724,526 673,775 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 68 Mosman Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 20,
    text: "continued on next page ... §Note/Subtotal§ Operating Operating Capital Capital $ '000 2025 2024 2025 2024 General purpose grants and non-developer contributions (untied) Financial Assistance Grant Relating to current year Financial assistance – general component 144 8 – – Financial assistance – local roads component 45 4 – – Prepayment received in advance for subsequent year Financial assistance – general component 477 769 – – Financial assistance – local roads component 155 249 – – Amount recognised as income during current year 821 1,030 – – Special purpose grants and non-developer contributions (tied) Cash contributions Aged care 672 629 – – Environmental programs 14 – 47 76 Heritage and cultural 13 – – – Library 111 121 – – Library – special projects 30 17 183 – Recreation and culture 104 259 144 1,591 Storm/flood damage – – 73 41 Street lighting 114 112 – – Transport (roads to recovery) 195 149 – – Transport (other roads and bridges funding) 14 56 368 809 Transport for NSW contributions (regional roads, block grant) 121 123 – – Other specific grants 33 52 – – Total special purpose grants and non-developer contributions – cash 1,421 1,518 815 2,517 Non-cash contributions Recreation and culture – – 154 741 Total other contributions – non-cash – – 154 741 Total special purpose grants and non-developer contributions (tied) 1,421 1,518 969 3,258 Total grants and non-developer contributions 2,242 2,548 969 3,258 Comprising: – Commonwealth funding 1,456 1,585 150 – – State funding 769 843 665 2,490 – Other funding 17 120 154 768 2,242 2,548 969 3,258 B2-4 Grants and contributions Page 18 of 68 Mosman Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 21,
    text: "continued on next page ... §Note/Subtotal§ Developer contributions Operating Operating Capital Capital $ '000 Notes 2025 2024 2025 2024 Developer contributions: (s7.4 & s7.11 - EP&A Act, s64 of the LGA): F4 Cash contributions S 7.4 – contributions using planning agreements 971 870 – – S 7.12 – fixed development consent levies – – 2,185 2,934 Total contributions 971 870 2,185 2,934 Total grants and contributions 3,213 3,418 3,154 6,192 Timing of revenue recognition Grants and contributions recognised over time (1) 100 163 815 2,517 Grants and contributions recognised at a point in time (2) 3,113 3,255 2,339 3,675 Total grants and contributions 3,213 3,418 3,154 6,192 §Subnote§ Unspent grants and contributions Certain grants and contributions are obtained by Council on the condition they be spent in a specified manner or in a future period but which are not yet spent in accordance with those conditions are as follows: Operating Operating Capital Capital $ '000 2025 2024 2025 2024 Unspent grants and contributions Unspent funds at 1 July 1,372 461 219 1,664 Add: Funds recognised as revenue in the reporting year but not yet spent in accordance with the conditions 636 1,122 – – Add: Funds received and not recognised as revenue in the current year 55 68 – 219 Less: Funds recognised as revenue in previous years that have been spent during the reporting year (1,152) (145) – – Less: Funds received in prior year but revenue recognised and funds spent in current year (74) (134) (219) (1,664) Unspent funds at 30 June 837 1,372 – 219 Developer Contributions Unspent funds at 1 July 908 1,473 5,264 3,605 Add: contributions recognised as revenue in the reporting year but not yet spent in accordance with the conditions 1,014 906 2,437 2,311 Less: contributions recognised as revenue in previous years that have been spent during the reporting year (829) (1,471) (1,239) (652) Unspent contributions at 30 June 1,093 908 6,462 5,264 B2-4 Grants and contributions (continued) Page 19 of 68 Mosman Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 24,
    text: "§Note/Subtotal§ $ '000 2025 2024 Salaries and wages 15,373 14,865 Employee termination costs (where material – other than vested leave paid) 96 126 Employee leave entitlements (ELE) 2,136 1,834 Superannuation – defined contribution plans 1,835 1,664 Superannuation – defined benefit plans 142 175 Workers’ compensation insurance 346 280 Fringe benefit tax (FBT) 58 49 Total employee costs expensed 19,986 18,993 §TocItem§ §Subnote§ Employee benefit expenses are recorded when the service has been provided by the employee. Material accounting policy information All employees of the Council are entitled to benefits on retirement, disability or death. Council contributes to various defined benefit plans and defined contribution plans on behalf of its employees. Contributions to defined contribution plans are recognised as an expense as they become payable. Prepaid contributions are recognised as an asset to the extent that a cash refund or a reduction in the future payments is available. B3 Costs of providing services B3-1 Employee benefits and on-costs Page 22 of 68 Mosman Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 25,
    text: "§Note/Subtotal§ $ '000 Notes 2025 2024 Raw materials and consumables 74 82 – Art Gallery and Community Centre 326 444 – Bushcare 494 419 – Cleansing 1,380 1,356 – Companion Animal Control 29 27 – Communications and Events 305 314 – Community Services 229 247 – Development assessment and urban planning 318 320 – Infrastructure 1,315 1,647 – Internal audit 164 155 – Library 132 217 – Open Spaces and Recreational Facilities 3,261 2,940 – Plants & Fleets 94 104 – Property and works 2,190 1,880 – Swim Centre Management 211 202 – Temporary Staff and Agency Casuals 330 385 – Waste management 4,650 4,375 – Other contractor and consultancy costs 423 472 Audit Fees E2-1 73 75 Infringement notice contract costs (SEINS) 590 449 Councillor and Mayoral fees and associated expenses E1-2 253 232 Advertising 222 296 Bank charges 176 164 Election expenses 246 – Computer software charges 1,451 1,448 Electricity and heating 371 470 Insurance 913 855 Postage 54 61 Printing and stationery 39 56 Street lighting 297 355 Subscriptions and publications 153 179 Telephone and communications 265 287 Other expenses 276 240 Training costs (other than salaries and wages) 254 168 Travel expenses 489 460 Catering 119 123 Leases – property 66 61 Water 158 195 Legal expenses: – Legal expenses: planning and development 273 274 – Legal expenses: other 216 332 Expenses from leases of low value assets 185 234 Total materials and services 23,064 22,600 B3-2 Materials and services Page 23 of 68 Mosman Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 26,
    text: "§Note/Subtotal§ $ '000 Notes 2025 2024 Depreciation and amortisation Plant and equipment 181 171 Office equipment 247 193 Furniture and fittings 42 40 Land improvements (depreciable) 11 11 Infrastructure: C1-5 – Buildings – non-specialised 798 754 – Buildings – specialised 509 483 – Roads 2,904 2,609 – Footpaths 332 316 – Stormwater drainage 641 570 – Other open space/recreational assets 929 1,023 Right of use assets 115 115 Library books & collections 214 203 Intangible assets 16 16 Total depreciation, amortisation and impairment for non-financial assets 6,939 6,504 Material accounting policy information Depreciation and amortisation Depreciation and amortisation are calculated using the straight line method to allocate their cost, net of their residual values, over their estimated useful lives. Council assets held at fair value that are not held primarily for their ability to generate net cash flow, and that are deemed to be specialised, are not tested for impairment since these assets are assessed on an annual basis to ensure that the carrying amount is not materially different from fair value and therefore an impairment loss would be captured during this assessment. Impairment of non-financial assets Intangible assets not yet available for use, are tested annually for impairment, or more frequently if events or changes in circumstances indicate that they might be impaired. Other non-financial assets that do not meet the criteria above are tested for impairment whenever events or changes in circumstances indicate that the carrying amount may not be recoverable. An impairment loss is recognised for the amount by which the asset’s carrying amount exceeds its recoverable amount. The recoverable amount is the higher of an asset’s fair value less costs to sell and value in use. Impairment losses for revalued assets are firstly offset against the amount in the revaluation surplus for the class of asset, with only the excess to be recognised in the Income Statement. B3-3 Depreciation, amortisation and impairment of non-financial assets Page 24 of 68 Mosman Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 27,
    text: "§Note/Subtotal§ $ '000 Notes 2025 2024 Impairment of receivables C1-4 674 262 Contributions/levies to other levels of government – Department of planning levy 245 237 – NSW fire brigade levy 1,458 1,481 – Waste levy 1,164 1,140 Donations, contributions and assistance to other organisations (Section 356) 252 243 Total other expenses 3,793 3,363 B3-4 Other expenses Page 25 of 68 Mosman Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
];

function page(pageNumber: number): PdfPage {
  const found = PAGES.find((entry) => entry.page_number === pageNumber);
  if (!found) throw new Error(`fixture page ${pageNumber} not found`);
  return found;
}

export function mosmanIncomePage(): PdfPage {
  return page(6);
}

export function mosmanComprehensivePage(): PdfPage {
  return page(7);
}

export function mosmanFunctionsPage(): PdfPage {
  return page(15);
}

export function mosmanExtraction() {
  const pages = PAGES.map((entry) => ({ ...entry, items: [] }));
  return {
    source: {
      url: MOSMAN_PDF_URL,
      sha256: MOSMAN_PDF_SHA256,
      bytes: MOSMAN_PDF_BYTES,
    },
    pages,
    text: pages.map((entry) => entry.text).join('\n'),
    tables: [],
    warnings: [],
  };
}
