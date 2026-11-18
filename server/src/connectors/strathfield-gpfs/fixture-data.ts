/**
 * Text pages extracted verbatim from the audited Strathfield Municipal Council
 * FY2024-25 General Purpose Financial Statements PDF (Income Statement PDF p6 /
 * printed p4; Statement of Comprehensive Income PDF p7 / printed p5; B1-1 "Total
 * functions and activities" PDF p15 / printed p13; notes B2-4 PDF p20-21 /
 * printed p18-19, B3-1 PDF p24 / printed p22, B3-2 and B3-3 PDF p25 / printed
 * p23, B3-4 PDF p26 / printed p24 and B3-5 PDF p27 / printed p25).
 */
import type { PdfPage } from '../pdf-extract.js';

export const STRATHFIELD_PDF_URL =
  'https://www.strathfield.nsw.gov.au/files/assets/public/v/1/council/reports-and-registers/strathfield-municipal-council-financial-statements-2024-25-final.pdf';
export const STRATHFIELD_PDF_SHA256 =
  '90295cd968382d7b8249b7a1a01829526a39f00262ad3f5bc7d56cf58a5a67ee';
export const STRATHFIELD_PDF_BYTES = 5_070_919;

const PAGES: PdfPage[] = [
  {
    page_number: 6,
    text: "Strathfield Municipal Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 40,989 Rates and annual charges B2-1 41,903 36,920 5,057 User charges and fees B2-2 6,565 5,290 2,696 Other revenue B2-3 3,497 2,673 2,467 Grants and contributions provided for operating purposes B2-4 3,163 2,850 9,483 Grants and contributions provided for capital purposes B2-4 14,511 22,943 2,524 Interest and investment income B2-5 3,017 2,304 1,201 Other income B2-6 1,252 1,019 64,417 Total income from continuing operations 73,908 73,999 Expenses from continuing operations 26,236 Employee benefits and on-costs B3-1 30,090 25,805 22,635 Materials and services B3-2 24,085 19,777 518 Borrowing costs B3-3 504 – 1,479 Other expenses B3-5 1,346 1,354 (450) Net loss from the disposal of assets B4-1 2,939 1,674 50,418 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 58,964 48,610 13,999 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 14,944 25,389 10,506 Depreciation and amortisation B3-4 10,906 9,971 3,493 Operating result from continuing operations 4,038 15,418 3,493 Net operating result attributable to Council 4,038 15,418 (5,990) Net operating result for the year before grants and contributions provided for capital purposes (10,473) (7,525) The above Income Statement should be read in conjunction with the accompanying notes. Strathfield Municipal Council Income Statement for the year ended 30 June 2025 Page 4 of 60",
    items: [],
  },
  {
    page_number: 7,
    text: "Strathfield Municipal Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 4,038 15,418 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain / (loss) on revaluation of infrastructure, property, plant and equipment C1-6 26,195 14,893 Total items which will not be reclassified subsequent to operating result 26,195 14,893 Other comprehensive income for the year 26,195 14,893 Total comprehensive income for the year attributable to Council 30,233 30,311 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Strathfield Municipal Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 60",
    items: [],
  },
  {
    page_number: 15,
    text: "§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities 1. Connectivity 470 733 845 1,077 (375) (344) 2,189 5,200 211,124 201,507 2. Community Wellbeing 293 331 4,757 4,305 (4,464) (3,974) 1,351 2,220 63,156 54,146 3. Celebrating Culture and Place 219 374 1,679 1,739 (1,460) (1,365) 767 346 – – 4. Liveable Neighbourhoods 25,385 28,728 31,317 26,542 (5,932) 2,186 13,367 18,027 178,581 194,349 5. Responsible Leadership 47,541 43,833 31,272 24,918 16,269 18,915 – – 168,413 124,144 Total functions and activities 73,908 73,999 69,870 58,581 4,038 15,418 17,674 25,793 621,274 574,146 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 60 Strathfield Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 20,
    text: "§Note/Subtotal§ Operating Operating Capital Capital $ '000 Timing 2025 2024 2025 2024 General purpose grants and non-developer contributions (untied) General purpose (untied) Current year allocation Financial assistance – general component 208 17 – – Financial assistance – local roads component 60 5 – – Payment in advance - future year allocation Financial assistance – general component 687 1,106 – – Financial assistance – local roads component 206 331 – – Amount recognised as income during current year 1,161 1,459 – – Special purpose grants and non-developer contributions (tied) Cash contributions Community centres 100 – 50 508 Employment and training programs 28 – – – Environmental programs (77) 141 – – Heritage and cultural 573 13 – – Library – per capita 196 252 – – Road Safety 47 57 – – Noxious weeds 108 – – – Parks and open space 468 – 1,949 888 Festivals and events 194 334 – – Street lighting 142 140 – – Traffic route subsidy 10 – – – Transport (roads to recovery) – – – 196 Other transport (bridges, footpaths, cycleways) – – 1,984 4,305 Community services 49 – – – Transport (Block Grants) – – 194 190 Other Council's Long Service Leave contributions 164 454 – – Other grants – – 61 55 Total special purpose grants and non-developer contributions – cash 2,002 1,391 4,238 6,142 Total special purpose grants and non-developer contributions (tied) 2,002 1,391 4,238 6,142 Total grants and non-developer contributions 3,163 2,850 4,238 6,142 Comprising: – Commonwealth funding 2,467 1,459 22 386 – State funding 521 936 4,186 5,756 – Other funding 175 455 30 – 3,163 2,850 4,238 6,142 B2-4 Grants and contributions Page 18 of 60 Strathfield Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 21,
    text: "§Note/Subtotal§ Developer contributions Operating Operating Capital Capital $ '000 Notes 2025 2024 2025 2024 Developer contributions: (s7.4 & s7.11 - EP&A Act, s64 of the LGA): F4 Cash contributions S 7.4 – contributions using planning agreements – – – 681 S 7.11 – contributions towards amenities/services – – 8,502 9,160 S 7.12 – fixed development consent levies – – 1,771 1,360 Total developer contributions – cash – – 10,273 11,201 Non-cash contributions S 7.4 – contributions using planning agreements – – – 5,600 Total developer contributions non-cash – – – 5,600 Total developer contributions – – 10,273 16,801 Total contributions – – 10,273 16,801 Total grants and contributions 3,163 2,850 14,511 22,943 Timing of revenue recognition Grants and contributions recognised over time 100 – 3,889 6,362 Grants and contributions recognised at a point in time 3,063 2,850 10,622 16,581 Total grants and contributions 3,163 2,850 14,511 22,943 B2-4 Grants and contributions (continued) Page 19 of 60 Strathfield Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 24,
    text: "§Note/Subtotal§ $ '000 2025 2024 Salaries and wages 20,437 17,769 Employee termination costs (where material – other than vested leave paid) 148 613 Travel expenses 4 – Employee leave entitlements (ELE) 4,634 3,754 Superannuation 2,623 2,232 Workers’ compensation insurance 2,242 1,167 Fringe benefit tax (FBT) 149 163 Training costs (other than salaries and wages) 411 280 Recruitment costs 132 107 Other 120 147 Total employee costs 30,900 26,232 §TocItem§ §Subnote§ Less: Capitalised employee costs (810) (427) Total employee costs expensed 30,090 25,805 Employee benefit expenses are recorded when the service has been provided by the employee. Material accounting policy information Retirement benefit obligations All employees of the Council are entitled to benefits on retirement, disability or death. Council contributes to various defined benefit plans and defined contribution plans on behalf of its employees. Superannuation plans Contributions to defined contribution plans are recognised as an expense as they become payable. Prepaid contributions are recognised as an asset to the extent that a cash refund or a reduction in the future payments is available. Council participates in a defined benefit plan under the Local Government Superannuation Scheme, however, sufficient information to account for the plan as a defined benefit is not available and therefore Council accounts for its obligations to defined benefit plans on the same basis as its obligations to defined contribution plans, i.e. as an expense when it becomes payable – refer to Note D3-1 for more information. Capitalised employee costs Employee costs that are directly attributable to the construction or acquisition of items of Infrastructure, Property Plant and Equipment (IPPE) are capitalised to the cost of the respective items of IPPE in accordance with AASB 16. B3 Costs of providing services B3-1 Employee benefits and on-costs Page 22 of 60 Strathfield Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 25,
    text: "§Note/Subtotal§ $ '000 Notes 2025 2024 Raw materials and consumables 3,104 2,959 Contractor costs 7,697 6,872 Street and gutter cleaning 1,284 776 Audit Fees E2-1 413 315 Infringement notice contract costs (SEINS) 565 174 Councillor and Mayoral fees and associated expenses E1-2 288 255 Advertising 100 88 Bank charges 89 81 Cleaning 461 368 Election expenses 290 – Electricity, heating and water 562 304 Insurance 1,101 1,043 Office expenses (including computer expenses) 398 145 Postage 173 81 Printing and stationery 72 75 Street lighting 550 453 Subscriptions, memberships and publications 578 393 Telephone and communications 526 405 Valuation fees 53 51 Other expenses 38 141 Security 47 101 Waste disposal – tipping fees 5,111 3,862 Legal expenses: – Legal expenses: planning and development 494 669 – Legal expenses: debt recovery 20 68 – Legal expenses: other 48 87 Expenses from short-term leases 3 3 Other 20 8 Total materials and services 24,085 19,777 Total materials and services 24,085 19,777 Material accounting policy information Expenses are recorded on an accruals basis as the Council receives the goods or services. B3-3 Borrowing costs §Subnote§ $ '000 2025 2024 Interest on loans 504 – Total interest bearing liability costs 504 – Total interest bearing liability costs expensed 504 – Borrowing costs directly attributable to the acquisition, construction or production of a qualifying asset are capitalised as part of the cost of that asset during the period of time required to complete and prepare the asset for its intended use. All other borrowing costs are recognised as an expense in the period in which they are incurred. Material accounting policy information During the financial year ended 30 June 2025, Council obtained new borrowings of $5.85 million on 3 January 2025 and $2.00 million on 18 June 2025. Borrowing costs associated with these loans were accounted for in accordance with the above policy. In the prior year, Council borrowed $7.00 million on 28 June 2024. No borrowing costs were capitalised or recognised as an expense in the 2023–24 financial year in respect of this borrowing. B3-2 Materials and services Page 23 of 60 Strathfield Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 26,
    text: "§Note/Subtotal§ $ '000 Notes 2025 2024 Depreciation and amortisation C1-8,C1-7 Plant and equipment 1,162 1,168 Office equipment 479 534 Other assets: – Library books 105 118 Infrastructure: – Buildings and other structures 1,677 1,227 – Roads 2,837 2,619 – Bridges 93 91 – Footpaths 666 534 – Other road assets 496 – – Stormwater drainage 887 931 – Car parks 79 73 – Other open space/recreational assets 1,973 2,153 Intangible assets 452 523 Total gross depreciation and amortisation costs 10,906 9,971 Total depreciation, amortisation and impairment for non-financial assets 10,906 9,971 Material accounting policy information Depreciation and amortisation are calculated using the straight line method to allocate their cost, net of their residual values, over their estimated useful lives. Useful lives are included in Note C1-6 for IPPE assets. Depreciation and amortisation Council assets held at fair value that are not held primarily for their ability to generate net cash flow, and that are deemed to be specialised, are no longer required to be tested for impairment under AASB 136. This is because these assets are assessed on an annual basis to ensure that the carrying amount is not materially different from fair value and therefore an impairment loss would be captured during this assessment. Impairment of non-financial assets Other assets that do not meet the criteria above are tested for impairment whenever events or changes in circumstances indicate that the carrying amount may not be recoverable. An impairment loss is recognised for the amount by which the asset’s carrying amount exceeds its recoverable amount. The recoverable amount is the higher of an asset’s fair value less costs to sell and value in use. For the purposes of assessing impairment, assets are grouped at the lowest levels for which there are separately identifiable cash inflows that are largely independent of the cash inflows from other assets or groups of assets (cash-generating units). Non-financial assets that suffered an impairment are reviewed for possible reversal of the impairment at each reporting date. Impairment losses for revalued assets are firstly offset against the amount in the revaluation surplus for the class of asset, with only the excess to be recognised in the Income Statement. B3-4 Depreciation, amortisation and impairment of non-financial assets Page 24 of 60 Strathfield Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
  {
    page_number: 27,
    text: "§Note/Subtotal§ $ '000 2025 2024 Impairment of receivables Other (6) (55) Total impairment of receivables (6) (55) Other Contributions/levies to other levels of government – Department of planning levy 107 103 – Emergency services levy (includes FRNSW, SES, and RFS levies) 165 221 – NSW fire brigade levy 994 1,015 Donations, contributions and assistance to other organisations (Section 356) 86 70 Total other 1,352 1,409 Total other expenses 1,346 1,354 Other expenses are recorded on an accruals basis when Council has an obligation for the expenses. Material accounting policy information Impairment expenses are recognised when identified. B3-5 Other expenses Page 25 of 60 Strathfield Municipal Council | Notes to the Financial Statements 30 June 2025",
    items: [],
  },
];

function page(pageNumber: number): PdfPage {
  const found = PAGES.find((entry) => entry.page_number === pageNumber);
  if (!found) throw new Error(`fixture page ${pageNumber} not found`);
  return found;
}

export function strathfieldIncomePage(): PdfPage {
  return page(6);
}

export function strathfieldComprehensivePage(): PdfPage {
  return page(7);
}

export function strathfieldFunctionsPage(): PdfPage {
  return page(15);
}

export function strathfieldExtraction() {
  const pages = PAGES.map((entry) => ({ ...entry, items: [] }));
  return {
    source: {
      url: STRATHFIELD_PDF_URL,
      sha256: STRATHFIELD_PDF_SHA256,
      bytes: STRATHFIELD_PDF_BYTES,
    },
    pages,
    text: pages.map((entry) => entry.text).join('\n'),
    tables: [],
    warnings: [],
  };
}
