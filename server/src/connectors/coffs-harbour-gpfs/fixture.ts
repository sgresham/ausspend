import {
  COFFS_HARBOUR_GPFS_FISCAL_YEAR,
  COFFS_HARBOUR_GPFS_REPORTING_URL,
  parseCoffsHarbourGpfsExtraction,
  type CoffsHarbourGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 Annual Financial Statements
// (Income Statement PDF/printed page 5, extraction page 7). The Original
// unaudited budget column precedes each line label, so each value read is the
// first amount after the label (the FY2024-25 actual). The Income Statement does
// not print a combined total-expenses line; total expenses is the printed B1-1
// "Total functions and activities" total, which equals the printed
// expenses-excluding-depreciation line plus the printed depreciation line.
const INCOME_TEXT = `Coffs Harbour City Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 119,579 Rates and annual charges B2-1 119,875 113,662 49,236 User charges and fees B2-2 53,927 54,185 16,027 Other revenues B2-3 15,038 12,006 17,372 Grants and contributions provided for operating purposes B2-4 19,058 21,928 27,034 Grants and contributions provided for capital purposes B2-4 64,207 54,268 11,790 Interest and investment income B2-5 20,711 17,402 2,302 Other income B2-6 2,682 2,898 243,340 Total income from continuing operations 295,498 276,349 Expenses from continuing operations 68,264 Employee benefits and on-costs B3-1 60,823 57,073 66,671 Materials and services B3-2 75,906 73,546 5,283 Borrowing costs B3-3 5,702 6,824 12,838 Other expenses B3-5 4,236 3,225 – Net loss from the disposal of assets B4-1 8,860 5,615 153,056 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 155,527 146,283 90,284 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 139,971 130,066 50,970 Depreciation, amortisation and impairment of non-financial assets B3-4 57,751 56,560 39,314 Operating result from continuing operations 82,220 73,506 Discontinued operations – Operating result from discontinued operations D3 (387) (258) 39,314 Net operating result for the year attributable to Council 81,833 73,248 12,280 Net operating result for the year before grants and contributions provided for capital purposes 17,626 18,980 The above Income Statement should be read in conjunction with the accompanying notes. Coffs Harbour City Council Income Statement for the year ended 30 June 2025 Page 5 of 101`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Legal and Governance Services 1,168 406 2,192 1,059 (1,024) (653) 160 148 2,123 2,241 Office of the General Manager 15 6 1,016 453 (1,001) (447) 15 5 42 366 Domestic Waste Management 29,656 28,358 19,395 19,433 10,261 8,925 1,138 1,156 12,384 12,163 Non Domestic Waste Management 9,416 9,299 7,220 8,085 2,196 1,214 4 8 10,681 10,410 Coffs Harbour Airport - Enterprise Park Redevelopment – – 8 2 (8) (2) – – – 75 Business Systems 713 496 5,243 4,848 (4,530) (4,352) – 19 1,964 1,509 CitySmart Solutions – – – – – – – – – 782 Organisational Development 167 129 3,833 3,712 (3,666) (3,583) – – 4 6 Engagement 106 71 3,756 3,375 (3,650) (3,304) – – 21 8 Coffs Harbour Laboratory 1,135 1,051 1,211 1,077 (76) (26) – 1 2,152 1,962 Coastal Works 7,884 6,854 6,883 4,160 1,001 2,694 2 3 119 432 Water Supplies 31,212 37,383 18,838 18,078 12,374 19,305 4,932 10,426 485,098 471,051 Sewer Services 48,639 43,604 27,221 24,775 21,418 18,829 7,889 6,232 661,813 638,222 Financial Services and Logistics 66,383 71,080 29,375 31,300 37,008 39,780 11,974 19,044 431,630 404,276 Cultural Services 1,301 1,316 6,703 6,495 (5,402) (5,179) 318 401 7,621 7,762 Community Services 77 360 1,525 1,425 (1,448) (1,065) 44 226 782 340 Sustainable Places 5,535 4,298 8,525 7,626 (2,990) (3,328) 1,071 774 942 837 City Prosperity 3,099 3,544 9,109 7,577 (6,010) (4,033) 340 1,655 45 2,567 City Infrastructure 473 825 2,731 3,082 (2,258) (2,257) 461 759 85,896 82,633 Infrastructure Construction and Maintenance 66,785 47,368 45,553 44,670 21,232 2,698 54,066 35,208 1,414,977 1,353,616 Business Improvement – – – (7) – 7 – – – – Holiday Parks and Reserves 17,499 15,859 12,857 11,546 4,642 4,313 851 131 100,928 98,235 Airport Lease 4,235 4,042 84 72 4,151 3,970 – – 83,435 80,366 Total functions and activities 295,498 276,349 213,278 202,843 82,220 73,506 83,265 76,196 3,302,657 3,169,859 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 15 of 101 Coffs Harbour City Council | Notes to the Financial Statements 30 June 2025`;

const COMPREHENSIVE_TEXT = `Coffs Harbour City Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year – from Income Statement 81,833 73,248 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-7 65,171 (125,305) Amounts which will be reclassified subsequent to operating result when specific conditions are met Other movements 43 (76) Other comprehensive income for the year 65,214 (125,381) Total comprehensive income for the year attributable to Council 147,047 (52,133) The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. Coffs Harbour City Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 6 of 101`;

const DEPRECIATION_TEXT = `§Note/Subtotal§ $ '000 Notes 2025 2024 (i) Interest bearing liability costs Interest on leases 44 116 Interest on loans 5,280 6,306 Total interest bearing liability costs 5,324 6,422 Total interest bearing liability costs expensed 5,324 6,422 (ii) Other borrowing costs Amortisation of discounts and premiums – Remediation liabilities C3-5 378 402 Total other borrowing costs 378 402 Total borrowing costs expensed 5,702 6,824 B3-4 Depreciation, amortisation and impairment of non-financial assets §Subnote§ Depreciation and amortisation Plant and equipment 3,570 3,334 Office equipment 671 454 Furniture and fittings 264 251 Land improvements (depreciable) 85 84 Infrastructure: C1-7 – Buildings – non-specialised 3,187 2,926 – Buildings – specialised 3,936 3,553 – Roads 12,504 14,489 – Bridges 2,570 1,468 – Footpaths 1,602 1,781 – Stormwater drainage 3,286 2,634 – Water supply network 6,692 6,287 – Sewerage network 12,625 11,909 – Swimming pools 172 175 – Other open space/recreational assets 5,331 5,361 – Other infrastructure 50 69 Right of use assets C2-1 345 1,027 Reinstatement, rehabilitation and restoration assets: – Tip assets C3-5,C1-7 219 141 Intangible assets C1-8 642 617 Total gross depreciation and amortisation costs 57,751 56,560 Total depreciation and amortisation costs 57,751 56,560 Total depreciation, amortisation and impairment of non-financial assets 57,751 56,560 Material accounting policy information Depreciation and amortisation Depreciation and amortisation are calculated using the straight line method to allocate their cost, net of their residual values, over their estimated useful lives. Useful lives are included in Note C1-8 for IPPE assets and Note C1-10 for intangible assets. Council assets held at fair value that are not held primarily for their ability to generate net cash flow, and that are deemed to be specialised, are not tested for impairment since these assets are assessed on an annual basis to ensure that the carrying amount is not materially different from fair value and therefore an impairment loss would be captured during this assessment. Impairment of non-financial assets Intangible assets not yet available for use, are tested annually for impairment, or more frequently if events or changes in circumstances indicate that they might be impaired. continued on next page ... B3-3 Borrowing costs Page 26 of 101 Coffs Harbour City Council | Notes to the Financial Statements 30 June 2025`;

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '026fd09fed7099b1276beb2775c62193d00e60ed13c7f71c72a202c7f25ebf5e',
      bytes: 4_006_409,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 7),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 8),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 17),
      textPage(DEPRECIATION_TEXT, 28),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.coffsharbour.nsw.gov.au/files/sharedassets/public/v/1/resident-services/your-council/corporate-planning-and-reporting/202425/annual-report-24-25/2024-25-annual-report-section-3.pdf';

const CONTEXT: CoffsHarbourGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: '2024-25-Annual-Report-Section-3.pdf',
    url: PDF_URL,
    fiscal_year: COFFS_HARBOUR_GPFS_FISCAL_YEAR,
    listing_url: COFFS_HARBOUR_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/tmp/ausspend-source-archive/coffs-harbour-gpfs/2024-25-annual-report-section-3.pdf',
    sha256: '026fd09fed7099b1276beb2775c62193d00e60ed13c7f71c72a202c7f25ebf5e',
    bytes: 4_006_409,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: COFFS_HARBOUR_GPFS_REPORTING_URL,
};

/** Golden fixture for the coffs-harbour-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const COFFS_HARBOUR_GPFS_ROW_COUNT = 17;
export const COFFS_HARBOUR_GPFS_GOLDEN_DIGEST =
  'd8894a1a61e9f21ae8a38551957124009fc55c54e5b972c7c3a080f54f82c04a';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'd8894a1a61e9f21ae8a38551957124009fc55c54e5b972c7c3a080f54f82c04a';

export function goldenRecords() {
  const parsed = parseCoffsHarbourGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
