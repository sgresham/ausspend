import {
  MID_COAST_GPFS_FISCAL_YEAR,
  MID_COAST_GPFS_REPORTING_URL,
  parseMidCoastGpfsExtraction,
  type MidCoastGpfsParseContext,
} from './index.js';
import type { PdfExtraction, PdfPage } from '../pdf-extract.js';

// Exact text extracted from the archived FY2024-25 General Purpose Financial
// Statements (Income Statement PDF page 6, printed page 4). The Original
// unaudited budget column precedes each line label, so each value read is the
// first amount after the label (the FY2024-25 actual). The Income Statement does
// not print a combined total-expenses line; total expenses is the printed B1-1
// "Total functions and activities" total, which equals the printed
// expenses-excluding-depreciation line plus the printed depreciation line.
const INCOME_TEXT = `MidCoast Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 181,335 Rates and annual charges B2-1 184,721 175,073 59,042 User charges and fees B2-2 54,668 59,688 3,912 Other revenues B2-3 5,130 5,473 34,337 Grants and contributions provided for operating purposes B2-4 32,764 48,904 48,197 Grants and contributions provided for capital purposes B2-4 70,923 85,790 11,688 Interest and investment income B2-5 18,518 15,202 2,730 Other income B2-6 7,428 11,375 341,241 Total income from continuing operations 374,152 401,505 Expenses from continuing operations 96,141 Employee benefits and on-costs B3-1 96,581 93,390 95,260 Materials and services B3-2 100,060 91,847 8,413 Borrowing costs B3-3 9,625 9,879 12,709 Other expenses B3-5 13,415 19,254 – Net loss from the disposal of assets B4-1 20,723 20,737 212,523 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 240,404 235,107 128,718 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 133,748 166,398 90,556 Depreciation, amortisation and impairment of non-financial assets B3-4 94,690 94,015 38,162 Operating result from continuing operations 39,058 72,383 38,162 Net operating result for the year attributable to Council 39,058 72,383 (10,035) Net operating result for the year before grants and contributions provided for capital purposes (31,865) (13,407) The above Income Statement should be read in conjunction with the accompanying notes. MidCoast Council Income Statement for the year ended 30 June 2025 Page 4 of 92`;

const COMPREHENSIVE_TEXT = `MidCoast Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year - from Income Statement 39,058 72,383 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 102,270 197,382 Total items which will not be reclassified subsequent to operating result 102,270 197,382 Total other comprehensive income for the year 102,270 197,382 Total comprehensive income for the year attributable to Council 141,328 269,765 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. MidCoast Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 92`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Our Wellbeing 22,666 24,323 36,707 36,053 (14,041) (11,730) 5,477 7,115 286,923 280,646 Our Natural Environment 9,002 9,660 15,207 14,936 (6,205) (5,276) 2,506 3,256 27,527 26,925 Our Places & Infrastructure 206,361 221,447 228,342 224,272 (21,981) (2,825) 76,396 99,241 4,499,155 4,400,721 Our Economic Prosperity 4,477 4,804 7,764 7,626 (3,287) (2,822) 1,527 1,984 65,796 64,356 Our Leadership 131,646 141,271 47,074 46,235 84,572 95,036 17,781 23,098 213,574 208,902 Total functions and activities 374,152 401,505 335,094 329,122 39,058 72,383 103,687 134,694 5,092,975 4,981,550 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 92 MidCoast Council | Notes to the Financial Statements 30 June 2025`;

const DEPRECIATION_TEXT = `§Note/Subtotal§ $ '000 Notes 2025 2024 Depreciation and amortisation Plant and equipment 5,187 5,408 Office equipment 14 16 Furniture and fittings 282 211 Computer equipment 1,008 1,281 Land improvements (depreciable) 384 369 Infrastructure: C1-7 – Buildings 11,867 12,168 – Other structures 1,278 888 – Roads 32,641 30,242 – Bridges 2,377 2,234 – Footpaths 664 594 – Stormwater drainage 5,605 5,252 – Water supply network 16,649 15,485 – Sewerage network 11,529 10,849 – Swimming pools 290 270 – Other open space/recreational assets 2,697 2,485 Right of use assets C2-1 706 706 Other assets: – Library books 378 354 – Cemetery assets 27 27 Reinstatement, rehabilitation and restoration assets: – Tip assets C3-5,C1-7 1,107 1,154 Total depreciation and amortisation costs 94,690 89,993 Impairment / revaluation decrement of IPPE and other non-financial assets Non-current assets held for sale C1-6 – 4,022 Total IPPE and other non-financial assets impairment / revaluation decrement costs charged to Income Statement – 4,022 Total depreciation, amortisation and impairment for non-financial assets 94,690 94,015 Material accounting policy information Depreciation and amortisation Depreciation and amortisation are calculated using the straight line method to allocate their cost, net of their residual values, over their estimated useful lives. Council assets held at fair value that are not held primarily for their ability to generate net cash flow, and that are deemed to be specialised, are not assessed for impairment since these assets are assessed on an annual basis to ensure that the carrying amount is not materially different from fair value and therefore, an impairment loss would be captured during this assessment. Impairment of non-financial assets Other non-financial assets that do not meet the criteria above are tested for impairment whenever events or changes in circumstances indicate that the carrying amount may not be recoverable. An impairment loss is recognised for the amount by which the asset’s carrying amount exceeds its recoverable amount. The recoverable amount is the higher of an asset’s fair value less costs to sell and value in use For the purposes of assessing impairment, assets are grouped at the lowest levels for which there are separately identifiable cash inflows that are largely independent of the cash inflows from other assets or groups of assets (cash-generating units). Impairment losses for revalued assets are firstly offset against the amount in the revaluation surplus for the class of asset, with only the excess to be recognised in the Income Statement. B3-4 Depreciation, amortisation and impairment of non-financial assets Page 24 of 92 MidCoast Council | Notes to the Financial Statements 30 June 2025`;

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'f8f7ede3d8c09467e5f1aea72e697a9278d4d78fd527778c63ccb0d9e3a5e3fe',
      bytes: 2_972_797,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 6),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 7),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 15),
      textPage(DEPRECIATION_TEXT, 26),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.midcoast.nsw.gov.au/files/assets/public/v/1/document-resources/council/plans-amp-publications/operational-plans-amp-fees-amp-charges/financial-statements/financial-statements-2024-2025.pdf';

const CONTEXT: MidCoastGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statement 2024-2025 (PDF, 3MB)',
    url: PDF_URL,
    fiscal_year: MID_COAST_GPFS_FISCAL_YEAR,
    listing_url: MID_COAST_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: '/tmp/ausspend-source-archive/mid-coast-gpfs/financial-statements-2024-2025.pdf',
    sha256: 'f8f7ede3d8c09467e5f1aea72e697a9278d4d78fd527778c63ccb0d9e3a5e3fe',
    bytes: 2_972_797,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: MID_COAST_GPFS_REPORTING_URL,
};

/** Golden fixture for the mid-coast-gpfs module migration: 17 rows, unchanged keys/amounts. */
export const MID_COAST_GPFS_ROW_COUNT = 17;
export const MID_COAST_GPFS_GOLDEN_DIGEST =
  'bb991bc3610b903c26faf5fc1bf9740b87dea549aff589398ea995e214c69cfa';
export const ROW_COUNT = 17;
export const GOLDEN_DIGEST = 'bb991bc3610b903c26faf5fc1bf9740b87dea549aff589398ea995e214c69cfa';

export function goldenRecords() {
  const parsed = parseMidCoastGpfsExtraction(extraction(), CONTEXT);
  return Array.isArray(parsed) ? parsed : parsed.records;
}
