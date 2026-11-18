import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import {
  detectMoneyUnit,
  extractArchivedPdf,
  moneyToCents,
  parseAmountCell,
  type MoneyUnitKind,
  type PdfExtraction,
  type PdfPage,
  type UnitDetection,
} from '../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import { DUBBO_LICENSE } from '../dubbo-council.js';
import type { Connector, RawRecord } from '../types.js';

/**
 * GPFS pilot: Dubbo Regional Council's audited General Purpose Financial
 * Statements for FY2024-25.
 *
 * This is a separate source id from `dubbo-council` (the adopted budget /
 * forward-forecast PDF with 245 rows). The two series are different years,
 * measure types and granularities, so they are never summed: every row here is
 * `aggregation_role: "agency_detail"` and carries no region/LGA allocation, so
 * the generic additive API and the Dubbo area panel cannot include it.
 *
 * The PDF URL is discovered from the council's reporting page (never a
 * hard-coded document URL), the exact bytes are SHA-256 archived outside the
 * repo, and the printed `$ '000` unit is required. The income statement's
 * printed lines and the note B1-1 "Total functions and activities" row are
 * reconciled exactly before any row is emitted.
 */

export const DUBBO_GPFS_ID = 'dubbo-council-gpfs';
export const DUBBO_GPFS_NAME = 'Dubbo Regional Council — General Purpose Financial Statements';
export const DUBBO_GPFS_PUBLISHER = 'Dubbo Regional Council';
export const DUBBO_GPFS_REPORTING_URL =
  'https://www.dubbo.nsw.gov.au/About-Council/Our-Responsibilities/reporting';
export const DUBBO_GPFS_FISCAL_YEAR = '2024-25';
export const DUBBO_GPFS_TARGET_YEAR_LABEL = '2024/2025';
export const DUBBO_GPFS_SOURCE_DATASET = 'Dubbo Regional Council GPFS 2024-25';
/**
 * Years this connector ingests from their own audited GPFS. The FY2015-16
 * predecessor statements and FY2016-17..FY2017-18 remain deliberately excluded:
 * they are separate builders and must not be ingested here.
 */
export const DUBBO_GPFS_SUPPORTED_FISCAL_YEARS = [
  '2025-26',
  '2024-25',
  '2023-24',
  '2022-23',
  '2021-22',
  '2020-21',
  '2019-20',
  '2018-19',
] as const;
export const DUBBO_GPFS_LICENSE = DUBBO_LICENSE;
export const DUBBO_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';

/** OLG FY2024-25 totals used only as an external reconciliation anchor. */
export const DUBBO_GPFS_OLG_EXPENSES_CENTS = 17_492_500_000; // $174,925,000
export const DUBBO_GPFS_OLG_REVENUE_CENTS = 23_492_700_000; // $234,927,000

export interface DubboGpfsDocument {
  id: string;
  title: string;
  url: string;
  fiscal_year: string;
}

export interface DubboGpfsArchiveMeta {
  local_path: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
}

export interface DubboGpfsParseContext {
  document: DubboGpfsDocument;
  archive: DubboGpfsArchiveMeta;
  sourceDate: string;
  reporting_url?: string;
}

export interface DubboGpfsRejection {
  section: string;
  reason: string;
}

export type DubboGpfsSection = 'revenue' | 'expenses' | 'result';

export interface DubboGpfsLineSpec {
  key: string;
  label: string;
  /**
   * Note reference printed immediately after the label in the extracted row
   * (e.g. "3a" or "6"). Used only to anchor the value lookup when the note
   * number itself is a bare integer that would otherwise be read as the
   * current-year amount. Never emitted as part of the printed label.
   */
  printed_note?: string;
  section: DubboGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  /**
   * The current-year column may be printed as a dash/nil. Read that as a
   * printed zero instead of falling through to the comparative column.
   */
  allow_printed_nil?: boolean;
  statement: 'Income Statement' | 'B1-1 Functions or activities';
}

/**
 * Per-year printed income-statement layouts. Total expenses is *not* summed
 * from components: it is a printed total (FY2024-25 from B1-1, FY2023-24 from
 * the face statement), accepted only when the component sums and the B1-1
 * anchor agree with it.
 */
export const DUBBO_GPFS_FY2024_25_LINES: ReadonlyArray<DubboGpfsLineSpec> = [
  {
    key: 'rates_and_annual_charges',
    label: 'Rates and annual charges',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'user_charges_and_fees',
    label: 'User charges and fees',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_revenues',
    label: 'Other revenues',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_operating',
    label: 'Grants and contributions provided for operating purposes',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_capital',
    label: 'Grants and contributions provided for capital purposes',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'interest_and_investment_income',
    label: 'Interest and investment income',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_income',
    label: 'Other income',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'total_revenue',
    label: 'Total income from continuing operations',
    section: 'revenue',
    statement: 'Income Statement',
  },
  {
    key: 'employee_expenses',
    label: 'Employee benefits and on-costs',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'materials_and_services',
    label: 'Materials and services',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'borrowing_costs',
    label: 'Borrowing costs',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'other_expenses',
    label: 'Other expenses',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'net_loss_from_disposal_of_assets',
    label: 'Net loss from the disposal of assets',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses_excluding_depreciation',
    label:
      'Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'depreciation_amortisation_impairment',
    label: 'Depreciation, amortisation and impairment of non-financial assets',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label: 'Total functions and activities',
    section: 'expenses',
    statement: 'B1-1 Functions or activities',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
  {
    key: 'net_result_before_capital_grants',
    label:
      'Net operating result for the year before grants and contributions provided for capital purposes',
    section: 'result',
    statement: 'Income Statement',
  },
];

/**
 * FY2023-24 face statement prints a single "Total expenses from continuing
 * operations" line and no "excluding depreciation" subtotal, so every expense
 * component (including depreciation and the disposal loss) sums directly to the
 * printed total.
 */
export const DUBBO_GPFS_FY2023_24_LINES: ReadonlyArray<DubboGpfsLineSpec> = [
  {
    key: 'rates_and_annual_charges',
    label: 'Rates and annual charges',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'user_charges_and_fees',
    label: 'User charges and fees',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_revenues',
    label: 'Other revenues',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_operating',
    label: 'Grants and contributions provided for operating purposes',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_capital',
    label: 'Grants and contributions provided for capital purposes',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'interest_and_investment_income',
    label: 'Interest and investment income',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_income',
    label: 'Other income',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'total_revenue',
    label: 'Total income from continuing operations',
    section: 'revenue',
    statement: 'Income Statement',
  },
  {
    key: 'employee_expenses',
    label: 'Employee benefits and on-costs',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'materials_and_services',
    label: 'Materials and services',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'borrowing_costs',
    label: 'Borrowing costs',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'other_expenses',
    label: 'Other expenses',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'net_loss_from_disposal_of_assets',
    label: 'Net loss from the disposal of assets',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'depreciation_amortisation_impairment',
    label: 'Depreciation, amortisation and impairment of non-financial assets',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label: 'Total expenses from continuing operations',
    section: 'expenses',
    statement: 'Income Statement',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
  {
    key: 'net_result_before_capital_grants',
    label:
      'Net operating result for the year before grants and contributions provided for capital purposes',
    section: 'result',
    statement: 'Income Statement',
  },
];

/**
 * FY2025-26 keeps the FY2024-25 face shape (printed "excluding depreciation"
 * subtotal plus B1-1 total) but adds a "Net gain from the disposal of assets"
 * revenue component (864) and prints the disposal-loss expense line at nil.
 * The nil-aware reader stores that printed dash as a printed zero, never the
 * comparative 5,035.
 */
export const DUBBO_GPFS_FY2025_26_LINES: ReadonlyArray<DubboGpfsLineSpec> = [
  {
    key: 'rates_and_annual_charges',
    label: 'Rates and annual charges',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'user_charges_and_fees',
    label: 'User charges and fees',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_revenues',
    label: 'Other revenues',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_operating',
    label: 'Grants and contributions provided for operating purposes',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_capital',
    label: 'Grants and contributions provided for capital purposes',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'interest_and_investment_income',
    label: 'Interest and investment income',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_income',
    label: 'Other income',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'net_gain_from_disposal_of_assets',
    label: 'Net gain from the disposal of assets',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'total_revenue',
    label: 'Total income from continuing operations',
    section: 'revenue',
    statement: 'Income Statement',
  },
  {
    key: 'employee_expenses',
    label: 'Employee benefits and on-costs',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'materials_and_services',
    label: 'Materials and services',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'borrowing_costs',
    label: 'Borrowing costs',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'other_expenses',
    label: 'Other expenses',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    statement: 'Income Statement',
  },
  {
    key: 'net_loss_from_disposal_of_assets',
    label: 'Net loss from the disposal of assets',
    section: 'expenses',
    component_of: 'total_expenses_excluding_depreciation',
    allow_printed_nil: true,
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses_excluding_depreciation',
    label:
      'Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'depreciation_amortisation_impairment',
    label: 'Depreciation, amortisation and impairment of non-financial assets',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label: 'Total functions and activities',
    section: 'expenses',
    statement: 'B1-1 Functions or activities',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
  {
    key: 'net_result_before_capital_grants',
    label:
      'Net operating result for the year before grants and contributions provided for capital purposes',
    section: 'result',
    statement: 'Income Statement',
  },
];

/**
 * FY2021-22 uses the inline single-total face shape of FY2023-24, plus a
 * "Net gain from the disposal of assets" revenue line that is printed as nil
 * for the current year (comparative 3,446). The nil-aware reader stores that
 * printed dash as a printed zero and never reads the comparative.
 */
export const DUBBO_GPFS_FY2021_22_LINES: ReadonlyArray<DubboGpfsLineSpec> = [
  ...DUBBO_GPFS_FY2023_24_LINES.filter((spec) => spec.component_of === 'total_revenue'),
  {
    key: 'net_gain_from_disposal_of_assets',
    label: 'Net gain from the disposal of assets',
    section: 'revenue',
    component_of: 'total_revenue',
    allow_printed_nil: true,
    statement: 'Income Statement',
  },
  ...DUBBO_GPFS_FY2023_24_LINES.filter((spec) => spec.key === 'total_revenue'),
  ...DUBBO_GPFS_FY2023_24_LINES.filter((spec) => spec.section === 'expenses'),
  ...DUBBO_GPFS_FY2023_24_LINES.filter((spec) => spec.section === 'result'),
];

/**
 * FY2020-21 keeps the inline single-total face shape but prints the revised
 * labels `Other revenue`, `Net gains from the disposal of assets`, `Materials
 * and services`, `Depreciation, amortisation and impairment for non-financial
 * assets` and `Net losses from the disposal of assets` (the loss is printed as a
 * dash for the current year). The disposal gain of 3,446 is a printed revenue
 * component. B1-1 income and operating result are both 188 ($'000) higher than
 * the face; that variance is recorded as unexplained and never forced.
 */
export const DUBBO_GPFS_FY2020_21_LINES: ReadonlyArray<DubboGpfsLineSpec> = [
  {
    key: 'rates_and_annual_charges',
    label: 'Rates and annual charges',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'user_charges_and_fees',
    label: 'User charges and fees',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_revenues',
    label: 'Other revenue',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_operating',
    label: 'Grants and contributions provided for operating purposes',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_capital',
    label: 'Grants and contributions provided for capital purposes',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'interest_and_investment_income',
    label: 'Interest and investment income',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_income',
    label: 'Other income',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'net_gain_from_disposal_of_assets',
    label: 'Net gains from the disposal of assets',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'total_revenue',
    label: 'Total income from continuing operations',
    section: 'revenue',
    statement: 'Income Statement',
  },
  {
    key: 'employee_expenses',
    label: 'Employee benefits and on-costs',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'materials_and_services',
    label: 'Materials and services',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'borrowing_costs',
    label: 'Borrowing costs',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'depreciation_amortisation_impairment',
    label: 'Depreciation, amortisation and impairment for non-financial assets',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'other_expenses',
    label: 'Other expenses',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'net_loss_from_disposal_of_assets',
    label: 'Net losses from the disposal of assets',
    section: 'expenses',
    component_of: 'total_expenses',
    allow_printed_nil: true,
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label: 'Total expenses from continuing operations',
    section: 'expenses',
    statement: 'Income Statement',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year attributable to Council',
    section: 'result',
    statement: 'Income Statement',
  },
  {
    key: 'net_result_before_capital_grants',
    label:
      'Net operating result for the year before grants and contributions provided for capital purposes',
    section: 'result',
    statement: 'Income Statement',
  },
];

/**
 * FY2019-20 prints inline face rows with numeric note references immediately
 * after each label (`3a`, `4`, `6`, `16`, …). Those bare integers would be read
 * as amounts without a year-specific anchor, so each affected line carries its
 * printed note reference. The face adds a `Net gains from the disposal of
 * assets` revenue line printed as a dash (nil) and a `Net losses from the
 * disposal of assets` expense line (2,493), plus a `Net share of interests in
 * joint ventures and associates using the equity method` revenue component
 * (149). The functions note (Note 2(a), "Total functions and activities") is
 * equal to the face on income, expenses and result, but its printed grants
 * column (35,142) is not the sum of the two face grant lines (21,858 operating
 * + 33,077 capital = 54,935); that printed total is retained as an independent
 * anchor and never forced to the face grant lines.
 */
export const DUBBO_GPFS_FY2019_20_LINES: ReadonlyArray<DubboGpfsLineSpec> = [
  {
    key: 'rates_and_annual_charges',
    label: 'Rates and annual charges',
    printed_note: '3a',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'user_charges_and_fees',
    label: 'User charges and fees',
    printed_note: '3b',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_revenues',
    label: 'Other revenues',
    printed_note: '3c',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_operating',
    label: 'Grants and contributions provided for operating purposes',
    printed_note: '3d,3e',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_capital',
    label: 'Grants and contributions provided for capital purposes',
    printed_note: '3d,3e',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'interest_and_investment_income',
    label: 'Interest and investment income',
    printed_note: '4',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'net_gain_from_disposal_of_assets',
    label: 'Net gains from the disposal of assets',
    printed_note: '6',
    section: 'revenue',
    component_of: 'total_revenue',
    allow_printed_nil: true,
    statement: 'Income Statement',
  },
  {
    key: 'net_share_of_interests_in_joint_ventures_and_associates',
    label: 'Net share of interests in joint ventures and associates using the equity method',
    printed_note: '16',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'total_revenue',
    label: 'Total income from continuing operations',
    section: 'revenue',
    statement: 'Income Statement',
  },
  {
    key: 'employee_expenses',
    label: 'Employee benefits and on-costs',
    printed_note: '5a',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'borrowing_costs',
    label: 'Borrowing costs',
    printed_note: '5b',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'materials_and_services',
    label: 'Materials and contracts',
    printed_note: '5c',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'depreciation_amortisation_impairment',
    label: 'Depreciation and amortisation',
    printed_note: '5d',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'other_expenses',
    label: 'Other expenses',
    printed_note: '5e',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'net_loss_from_disposal_of_assets',
    label: 'Net losses from the disposal of assets',
    printed_note: '6',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label: 'Total expenses from continuing operations',
    section: 'expenses',
    statement: 'Income Statement',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year',
    section: 'result',
    statement: 'Income Statement',
  },
  {
    key: 'net_result_before_capital_grants',
    label:
      'Net operating result for the year before grants and contributions provided for capital purposes',
    section: 'result',
    statement: 'Income Statement',
  },
];

/**
 * FY2018-19 prints inline face rows in three columns (Original unaudited budget,
 * Actual current year, Restated prior year) with a numeric note reference after
 * each label (`3a`, `3b`, `3e,3f`, `5`, `14`, `4a` …). The budget amount is
 * printed *before* the label and the two actual columns after it, so reading the
 * first amount after the label plus note reference selects the Actual current
 * year (2019), never the budget or the restated 2018 comparative. There is no
 * disposal-loss expense line this year; the disposal gain (703) is a revenue
 * component and the joint-venture share (49) is a revenue component.
 */
export const DUBBO_GPFS_FY2018_19_LINES: ReadonlyArray<DubboGpfsLineSpec> = [
  {
    key: 'rates_and_annual_charges',
    label: 'Rates and annual charges',
    printed_note: '3a',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'user_charges_and_fees',
    label: 'User charges and fees',
    printed_note: '3b',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'interest_and_investment_income',
    label: 'Interest and investment revenue',
    printed_note: '3c',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'other_revenues',
    label: 'Other revenues',
    printed_note: '3d',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_operating',
    label: 'Grants and contributions provided for operating purposes',
    printed_note: '3e,3f',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'government_grants_capital',
    label: 'Grants and contributions provided for capital purposes',
    printed_note: '3e,3f',
    section: 'revenue',
    component_of: 'total_revenue',
    potential_double_count: true,
    statement: 'Income Statement',
  },
  {
    key: 'net_gain_from_disposal_of_assets',
    label: 'Net gains from the disposal of assets',
    printed_note: '5',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'net_share_of_interests_in_joint_ventures_and_associates',
    label: 'Net share of interests in joint ventures and associates using the equity method',
    printed_note: '14',
    section: 'revenue',
    component_of: 'total_revenue',
    statement: 'Income Statement',
  },
  {
    key: 'total_revenue',
    label: 'Total income from continuing operations',
    section: 'revenue',
    statement: 'Income Statement',
  },
  {
    key: 'employee_expenses',
    label: 'Employee benefits and on-costs',
    printed_note: '4a',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'borrowing_costs',
    label: 'Borrowing costs',
    printed_note: '4b',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'materials_and_services',
    label: 'Materials and contracts',
    printed_note: '4c',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'depreciation_amortisation_impairment',
    label: 'Depreciation and amortisation',
    printed_note: '4d',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'other_expenses',
    label: 'Other expenses',
    printed_note: '4e',
    section: 'expenses',
    component_of: 'total_expenses',
    statement: 'Income Statement',
  },
  {
    key: 'total_expenses',
    label: 'Total expenses from continuing operations',
    section: 'expenses',
    statement: 'Income Statement',
  },
  {
    key: 'net_result',
    label: 'Net operating result for the year',
    section: 'result',
    statement: 'Income Statement',
  },
  {
    key: 'net_result_before_capital_grants',
    label:
      'Net operating result for the year before grants and contributions provided for capital purposes',
    section: 'result',
    statement: 'Income Statement',
  },
];

export interface DubboGpfsYearLayout {
  fiscalYear: string;
  sourceDataset: string;
  lines: ReadonlyArray<DubboGpfsLineSpec>;
  /** Where the printed total-expenses total comes from. */
  totalExpensesStatement: 'Income Statement' | 'B1-1 Functions or activities';
  /** Whether the face prints an "excluding depreciation" subtotal to bridge. */
  expenseBridge: 'excluding-depreciation' | 'single-total';
  /**
   * A known-but-unexplained B1-1 variance against the face statement, in printed
   * $'000. When present, B1-1 is required to differ from the face by exactly
   * these amounts; equality is never forced and no component is adjusted.
   */
  b1Variance?: {
    income: number;
    expenses: number;
    operatingResult: number;
    note: string;
  };
  /**
   * Printed functions-note grants total when it is an independent anchor and
   * does not equal the sum of the face operating and capital grant lines.
   */
  functionsGrantsAnchor?: number;
  /** Why the functions-note grants column is not the face grant-line sum. */
  functionsGrantsNote?: string;
  /** External OLG anchor, only where a matching published constant exists. */
  olg?: { expensesCents: number; revenueCents: number };
}

export const DUBBO_GPFS_YEAR_LAYOUTS: Readonly<Record<string, DubboGpfsYearLayout>> = {
  '2019-20': {
    fiscalYear: '2019-20',
    sourceDataset: 'Dubbo Regional Council GPFS 2019-20',
    lines: DUBBO_GPFS_FY2019_20_LINES,
    totalExpensesStatement: 'Income Statement',
    expenseBridge: 'single-total',
    functionsGrantsAnchor: 35_142,
    functionsGrantsNote:
      'the functions note prints grants included in income of 35,142, which differs from the face operating and capital grant lines (21,858 + 33,077 = 54,935); the printed functions-note total is retained as an independent anchor and the face grant lines are not adjusted',
  },
  '2018-19': {
    fiscalYear: '2018-19',
    sourceDataset: 'Dubbo Regional Council GPFS 2018-19',
    lines: DUBBO_GPFS_FY2018_19_LINES,
    totalExpensesStatement: 'Income Statement',
    expenseBridge: 'single-total',
    functionsGrantsAnchor: 44_452,
    functionsGrantsNote:
      'the functions note prints grants included in income of 44,452, which differs from the face operating and capital grant lines (18,610 + 47,179 = 65,789); the printed functions-note total is retained as an independent anchor and the face grant lines are not adjusted',
  },
  '2020-21': {
    fiscalYear: '2020-21',
    sourceDataset: 'Dubbo Regional Council GPFS 2020-21',
    lines: DUBBO_GPFS_FY2020_21_LINES,
    totalExpensesStatement: 'Income Statement',
    expenseBridge: 'single-total',
    b1Variance: {
      income: 188,
      expenses: 0,
      operatingResult: 188,
      note: 'B1-1 prints income 186,942 and operating result 37,312, both $188 thousand above the face statement (income 186,754; result 37,124); the $188 remains unexplained, so the face totals are retained and no component is adjusted',
    },
  },
  '2021-22': {
    fiscalYear: '2021-22',
    sourceDataset: 'Dubbo Regional Council GPFS 2021-22',
    lines: DUBBO_GPFS_FY2021_22_LINES,
    totalExpensesStatement: 'Income Statement',
    expenseBridge: 'single-total',
  },
  '2022-23': {
    fiscalYear: '2022-23',
    sourceDataset: 'Dubbo Regional Council GPFS 2022-23',
    // FY2022-23 has the same inline single-total face shape as FY2023-24.
    lines: DUBBO_GPFS_FY2023_24_LINES,
    totalExpensesStatement: 'Income Statement',
    expenseBridge: 'single-total',
  },
  '2025-26': {
    fiscalYear: '2025-26',
    sourceDataset: 'Dubbo Regional Council GPFS 2025-26',
    lines: DUBBO_GPFS_FY2025_26_LINES,
    totalExpensesStatement: 'B1-1 Functions or activities',
    expenseBridge: 'excluding-depreciation',
  },
  '2024-25': {
    fiscalYear: '2024-25',
    sourceDataset: 'Dubbo Regional Council GPFS 2024-25',
    lines: DUBBO_GPFS_FY2024_25_LINES,
    totalExpensesStatement: 'B1-1 Functions or activities',
    expenseBridge: 'excluding-depreciation',
    olg: {
      expensesCents: DUBBO_GPFS_OLG_EXPENSES_CENTS,
      revenueCents: DUBBO_GPFS_OLG_REVENUE_CENTS,
    },
  },
  '2023-24': {
    fiscalYear: '2023-24',
    sourceDataset: 'Dubbo Regional Council GPFS 2023-24',
    lines: DUBBO_GPFS_FY2023_24_LINES,
    totalExpensesStatement: 'Income Statement',
    expenseBridge: 'single-total',
  },
};

/** Backwards-compatible alias for the original FY2024-25 line spec. */
export const DUBBO_GPFS_LINES: ReadonlyArray<DubboGpfsLineSpec> = DUBBO_GPFS_FY2024_25_LINES;

export function getDubboGpfsYearLayout(
  fiscalYear: string = DUBBO_GPFS_FISCAL_YEAR,
): DubboGpfsYearLayout {
  const layout = DUBBO_GPFS_YEAR_LAYOUTS[fiscalYear];
  if (!layout) {
    throw new Error(
      `No Dubbo GPFS layout is defined for FY${fiscalYear}; refusing to guess a multi-year layout`,
    );
  }
  return layout;
}

interface DubboGpfsLineValue {
  spec: DubboGpfsLineSpec;
  value: number;
  page_number: number;
  /** True when the current-year column was printed as a dash/nil. */
  printed_nil?: boolean;
}

export interface DubboGpfsReconciliation {
  fiscal_year: string;
  unit: MoneyUnitKind;
  unit_evidence: string;
  income_statement_page: number;
  functions_page: number;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  depreciation_amortisation_impairment: number;
  government_grants_operating: number;
  government_grants_capital: number;
  net_result: number;
  net_result_before_capital_grants: number;
  printed_total_expenses_excluding_depreciation: number | null;
  functions_total_income: number;
  functions_total_expenses: number;
  functions_operating_result: number;
  functions_grants_and_contributions: number;
  /** B1-1 minus face, in printed $'000. Zero except where a variance is declared. */
  b1_income_variance: number;
  b1_expenses_variance: number;
  b1_operating_result_variance: number;
  b1_variance_note: string | null;
  revenue_components_sum: number;
  expense_components_sum: number;
  face_expense_bridge: number;
  olg_expenses_cents: number | null;
  olg_revenue_cents: number | null;
  checks: string[];
}

export interface DubboGpfsParseResult {
  records: SpendingRecord[];
  reconciliation: DubboGpfsReconciliation | null;
  warnings: string[];
  rejections: DubboGpfsRejection[];
}

const NOTE_REFERENCE = /\b[A-E]\d+-\d+\b/g;
const MONEY_TOKEN = /(?:\(\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\))?/g;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(NOTE_REFERENCE, ' ').trim();
}

function decodeHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convert "2024/2025" or "2024-2025" to the API's "2024-25". */
export function fiscalYearFromGpfsLink(text: string): string | null {
  const match = /((?:19|20)\d{2})\s*[/-]\s*((?:19|20)?\d{2})/.exec(text);
  if (!match) return null;
  const start = Number(match[1]);
  const endRaw = match[2]!;
  const end = endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
  if (end !== start + 1) return null;
  return `${start}-${String(end).slice(-2)}`;
}

/**
 * Discover GPFS links from the council's reporting page. The fiscal year comes
 * from the link text; annual reports and non-financial-statement links are
 * ignored. No document URL is hard-coded.
 */
export function parseDubboGpfsReportLinks(
  html: string,
  baseUrl: string = DUBBO_GPFS_REPORTING_URL,
): DubboGpfsDocument[] {
  const links: DubboGpfsDocument[] = [];
  const seen = new Set<string>();
  const anchor = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const href = match[1]!;
    const text = decodeHtml(match[2]!);
    if (!/financial statements/i.test(text)) continue;
    if (/annual report/i.test(text)) continue;
    const fiscalYear = fiscalYearFromGpfsLink(text);
    if (!fiscalYear) continue;
    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({
      id: `gpfs-${fiscalYear}`,
      title: text,
      url,
      fiscal_year: fiscalYear,
    });
  }
  return links;
}

/** Select the audited GPFS for the requested fiscal year. */
export function selectDubboGpfsDocument(
  links: readonly DubboGpfsDocument[],
  fiscalYear: string = DUBBO_GPFS_FISCAL_YEAR,
): DubboGpfsDocument {
  const document = links.find((link) => link.fiscal_year === fiscalYear);
  if (!document) {
    throw new Error(
      `No published Dubbo Regional Council General Purpose Financial Statements link for FY${fiscalYear} was found on ${DUBBO_GPFS_REPORTING_URL}; refusing to guess a document URL`,
    );
  }
  return document;
}

/** Discover the audited GPFS document from the live reporting page. */
export async function discoverDubboGpfsDocument(
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear: string = DUBBO_GPFS_FISCAL_YEAR,
): Promise<DubboGpfsDocument> {
  const response = await fetchImpl(DUBBO_GPFS_REPORTING_URL, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(
      `Dubbo reporting page fetch HTTP ${response.status} for ${DUBBO_GPFS_REPORTING_URL}`,
    );
  }
  const html = await response.text();
  const links = parseDubboGpfsReportLinks(html);
  return selectDubboGpfsDocument(links, fiscalYear);
}

/** Detect the printed unit; a missing/conflicting unit is never defaulted. */
export function detectDubboGpfsUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

interface PrintedUnit {
  kind: MoneyUnitKind;
  reason: string;
}

function requirePrintedUnit(page: PdfPage, section: string): PrintedUnit {
  const unit = detectDubboGpfsUnit([page.text]);
  const kind = unit.kind;
  if (!kind || unit.ambiguous) {
    throw new Error(
      `${section} p${page.page_number}: no unambiguous printed currency unit (${unit.reason}); refusing to guess`,
    );
  }
  return { kind, reason: unit.reason };
}

function firstAmountAfter(text: string, label: string): number | null {
  const index = text.indexOf(label);
  if (index < 0) return null;
  const rest = text.slice(index + label.length);
  const match = rest.match(MONEY_TOKEN);
  if (!match) return null;
  return parseAmountCell(match[0])?.value ?? null;
}

function firstAmountOrNilAfter(
  text: string,
  label: string,
): { value: number; printed_nil: boolean } | null {
  const index = text.indexOf(label);
  if (index < 0) return null;
  const rest = text.slice(index + label.length).trimStart();
  if (/^(?:[–—-]|nil)(?:\s|$)/i.test(rest)) {
    return { value: 0, printed_nil: true };
  }
  const match = rest.match(MONEY_TOKEN);
  if (!match) return null;
  const parsed = parseAmountCell(match[0]);
  if (parsed?.value === null || parsed?.value === undefined) return null;
  return { value: parsed.value, printed_nil: false };
}

function allAmountsAfter(text: string, label: string): number[] {
  const index = text.indexOf(label);
  if (index < 0) return [];
  const rest = text.slice(index + label.length);
  const matches = rest.match(MONEY_TOKEN) ?? [];
  return matches
    .map((token) => parseAmountCell(token)?.value ?? null)
    .filter((value): value is number => value !== null);
}

function findPage(
  pages: readonly PdfPage[],
  predicate: (page: PdfPage, text: string) => boolean,
): PdfPage | null {
  for (const page of pages) {
    if (predicate(page, normalizeText(page.text))) return page;
  }
  return null;
}

function lineValue(
  text: string,
  spec: DubboGpfsLineSpec,
  pageNumber: number,
  errors: string[],
): DubboGpfsLineValue | null {
  // Anchor on the label plus its printed note reference where the year defines
  // one, so a bare note number (e.g. "6") is never mistaken for the amount.
  const lookup = spec.printed_note ? `${spec.label} ${spec.printed_note}` : spec.label;
  if (spec.allow_printed_nil) {
    const parsed = firstAmountOrNilAfter(text, lookup);
    if (!parsed) {
      errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
      return null;
    }
    return {
      spec,
      value: parsed.value,
      page_number: pageNumber,
      ...(parsed.printed_nil ? { printed_nil: true } : {}),
    };
  }
  const value = firstAmountAfter(text, lookup);
  if (value === null) {
    errors.push(`p${pageNumber}: could not read printed value for "${spec.label}"`);
    return null;
  }
  return { spec, value, page_number: pageNumber };
}

function lineByKey(values: readonly DubboGpfsLineValue[], key: string): number | null {
  return values.find((entry) => entry.spec.key === key)?.value ?? null;
}

export interface DubboGpfsFunctionsTotals {
  page_number: number;
  income: number;
  expenses: number;
  operating_result: number;
  grants_and_contributions: number;
}

/**
 * Parse B1-1 "Total functions and activities". The page prints ten numbers
 * (Income 2025/2024, Expenses 2025/2024, Operating result 2025/2024, Grants
 * 2025/2024, Carrying amount 2025/2024); the 2025 values are at indices
 * 0, 2, 4 and 6.
 */
export function parseDubboGpfsFunctionsTotals(page: PdfPage): DubboGpfsFunctionsTotals | null {
  const text = normalizeText(page.text);
  const label = 'Total functions and activities';
  if (!text.includes(label)) return null;
  const values = allAmountsAfter(text, label);
  if (values.length < 8) {
    throw new Error(
      `p${page.page_number}: B1-1 total row has ${values.length} numeric values, expected at least 8`,
    );
  }
  return {
    page_number: page.page_number,
    income: values[0]!,
    expenses: values[2]!,
    operating_result: values[4]!,
    grants_and_contributions: values[6]!,
  };
}

function gpfsFundingSource(spec: DubboGpfsLineSpec): string {
  if (spec.potential_double_count) return 'Government grants and contributions';
  if (spec.key === 'total_revenue')
    return 'Council total revenue (own-source plus government grants and contributions)';
  if (spec.section === 'revenue') return 'Council own-source revenue';
  if (spec.section === 'expenses') return 'Council expenditure';
  return 'Council result';
}

function gpfsUnitLabel(unit: MoneyUnitKind): string {
  switch (unit) {
    case 'dollars':
      return 'AUD_dollars';
    case 'thousands':
      return 'AUD_thousands';
    case 'millions':
      return 'AUD_millions';
    case 'billions':
      return 'AUD_billions';
  }
}

function notesFor(
  context: DubboGpfsParseContext,
  spec: DubboGpfsLineSpec,
  unit: MoneyUnitKind,
  unitReason: string,
  pageNumber: number,
  reconciliationNote: string,
  printedNil = false,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document.title}`,
    `document_url: ${context.document.url}`,
    context.reporting_url ? `reporting_url: ${context.reporting_url}` : null,
    `statement: ${spec.statement}`,
    `page: ${pageNumber}`,
    `printed_label: ${spec.label}`,
    `unit: ${unit} (explicit; ${unitReason})`,
    printedNil ? 'printed_nil: true (current-year column printed as dash/nil)' : null,
    `reconciliation: ${reconciliationNote}`,
    'provisional/local_government; non-additive agency detail; no region/LGA allocation; never summed with dubbo-council summary rows; unverified',
  ]
    .filter((part): part is string => Boolean(part))
    .join('; ');
}

/** Stable upsert identity: source + document + line + fiscal year. */
export function dubboGpfsNaturalKey(
  documentUrl: string,
  lineItem: string,
  fiscalYear: string = DUBBO_GPFS_FISCAL_YEAR,
): string {
  return `${DUBBO_GPFS_ID}:${createHash('sha256')
    .update(`${documentUrl}\u001f${lineItem}\u001f${fiscalYear}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function mapLine(
  line: DubboGpfsLineValue,
  context: DubboGpfsParseContext,
  unit: MoneyUnitKind,
  unitReason: string,
  reconciliationNote: string,
): SpendingRecord {
  const { spec } = line;
  const fiscalYear = context.document.fiscal_year;
  const layout = getDubboGpfsYearLayout(fiscalYear);
  const printedSign = line.value < 0 ? 'negative' : 'positive';
  return {
    amount_cents: moneyToCents(Math.abs(line.value), unit),
    measure_type: 'actual',
    fiscal_year: fiscalYear,
    source_id: DUBBO_GPFS_ID,
    source_url: context.document.url,
    verified: false,
    natural_key: dubboGpfsNaturalKey(context.document.url, spec.key, fiscalYear),
    project_name: `Dubbo Regional Council GPFS ${fiscalYear} — ${spec.label}`,
    description: `${spec.section === 'revenue' ? 'Revenue' : spec.section === 'expenses' ? 'Expense' : 'Result'} line item — ${spec.statement}`,
    jurisdiction_level: 'local',
    jurisdiction: 'NSW',
    delivery_entity: 'Dubbo Regional Council',
    funding_source: gpfsFundingSource(spec),
    source_dataset: layout.sourceDataset,
    source_date: context.sourceDate,
    data_quality_flag: DUBBO_GPFS_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    extraction_confidence: 'high',
    gpfs_line_item: spec.key,
    gpfs_line_label: spec.label,
    gpfs_unit: gpfsUnitLabel(unit),
    gpfs_section: spec.section,
    gpfs_statement: spec.statement,
    ...(printedSign === 'negative' ? { gpfs_printed_sign: printedSign } : {}),
    ...(spec.component_of ? { gpfs_component_of: spec.component_of } : {}),
    ...(spec.potential_double_count ? { potential_double_count: true } : {}),
    notes: notesFor(
      context,
      spec,
      unit,
      unitReason,
      line.page_number,
      reconciliationNote,
      line.printed_nil ?? false,
    ),
  };
}

/**
 * Parse the audited GPFS into validated, non-additive measure rows. Nothing is
 * emitted unless the printed unit is explicit and every face-statement and
 * B1-1/OLG reconciliation check passes exactly.
 */
export function parseDubboGpfsExtraction(
  extraction: PdfExtraction,
  context: DubboGpfsParseContext,
): DubboGpfsParseResult {
  const warnings: string[] = [];
  const rejections: DubboGpfsRejection[] = [];
  const reject = (reason: string): DubboGpfsParseResult => {
    rejections.push({ section: 'gpfs', reason });
    warnings.push(reason);
    return { records: [], reconciliation: null, warnings, rejections };
  };

  const fiscalYear = context.document.fiscal_year;
  let layout: DubboGpfsYearLayout;
  try {
    layout = getDubboGpfsYearLayout(fiscalYear);
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error));
  }

  const incomePage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Income Statement') &&
      text.includes('Total income from continuing operations') &&
      (text.includes('Net operating result for the year attributable to Council') ||
        // FY2019-20 prints "Net operating result attributable to council".
        text.includes('Net operating result attributable to council')),
  );
  if (!incomePage) {
    return reject('audited income statement page not found; no rows ingested');
  }
  const functionsPage = findPage(
    extraction.pages,
    (_page, text) =>
      text.includes('Total functions and activities') && text.includes('Functions or activities'),
  );
  if (!functionsPage) {
    return reject('B1-1 Total functions and activities page not found; no rows ingested');
  }

  let incomeUnit: PrintedUnit;
  let functionsUnit: PrintedUnit;
  let functionsTotals: DubboGpfsFunctionsTotals | null;
  try {
    incomeUnit = requirePrintedUnit(incomePage, 'Income Statement');
    functionsUnit = requirePrintedUnit(functionsPage, 'B1-1');
    functionsTotals = parseDubboGpfsFunctionsTotals(functionsPage);
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error));
  }
  if (incomeUnit.kind !== functionsUnit.kind) {
    return reject(
      `printed units disagree: income statement ${incomeUnit.kind}, B1-1 ${functionsUnit.kind}; refusing to mix`,
    );
  }
  if (!functionsTotals) {
    return reject('B1-1 Total functions and activities row not found; no rows ingested');
  }
  const unit = incomeUnit.kind;

  const incomeText = normalizeText(incomePage.text);
  const errors: string[] = [];
  const values: DubboGpfsLineValue[] = [];
  for (const spec of layout.lines) {
    if (spec.key === 'total_expenses') continue;
    const line = lineValue(incomeText, spec, incomePage.page_number, errors);
    if (line) values.push(line);
  }
  if (errors.length > 0) return reject(errors.join('; '));

  const totalExpensesSpec = layout.lines.find((line) => line.key === 'total_expenses');
  if (!totalExpensesSpec) {
    return reject(`FY${fiscalYear} layout has no total expenses line; no rows ingested`);
  }
  let totalExpensesLine: DubboGpfsLineValue;
  if (layout.totalExpensesStatement === 'B1-1 Functions or activities') {
    totalExpensesLine = {
      spec: totalExpensesSpec,
      value: functionsTotals.expenses,
      page_number: functionsTotals.page_number,
    };
  } else {
    const parsedTotal = lineValue(incomeText, totalExpensesSpec, incomePage.page_number, errors);
    if (!parsedTotal) return reject(errors.join('; ') || 'could not read printed total expenses');
    totalExpensesLine = parsedTotal;
  }
  values.push(totalExpensesLine);

  const totalRevenue = lineByKey(values, 'total_revenue');
  const employee = lineByKey(values, 'employee_expenses');
  const depreciation = lineByKey(values, 'depreciation_amortisation_impairment');
  const grantsOperating = lineByKey(values, 'government_grants_operating');
  const grantsCapital = lineByKey(values, 'government_grants_capital');
  const netResult = lineByKey(values, 'net_result');
  const netResultBeforeCapital = lineByKey(values, 'net_result_before_capital_grants');
  const expensesExDepreciation = lineByKey(values, 'total_expenses_excluding_depreciation');

  const required: Array<[string, number | null]> = layout.lines
    .filter((spec) => spec.key !== 'total_expenses')
    .map((spec) => [spec.key, lineByKey(values, spec.key)]);
  const missing = required.filter(([, value]) => value === null).map(([key]) => key);
  if (missing.length > 0) {
    return reject(`could not read printed line(s): ${missing.join(', ')}; no rows ingested`);
  }

  const componentKeys = (parent: string): string[] =>
    layout.lines.filter((spec) => spec.component_of === parent).map((spec) => spec.key);
  const sumKeys = (keys: readonly string[]): number =>
    keys.reduce((sum, key) => sum + (lineByKey(values, key) ?? Number.NaN), 0);

  const revenueComponentsSum = sumKeys(componentKeys('total_revenue'));
  const expenseComponentsSum =
    layout.expenseBridge === 'excluding-depreciation'
      ? sumKeys(componentKeys('total_expenses_excluding_depreciation'))
      : sumKeys(componentKeys('total_expenses'));
  const totalExpenses = totalExpensesLine.value;
  const faceExpenseBridge =
    layout.expenseBridge === 'excluding-depreciation'
      ? (expensesExDepreciation ?? Number.NaN) + (depreciation ?? Number.NaN)
      : totalExpenses;
  const totalRevenueCents = moneyToCents(totalRevenue!, unit);
  const totalExpensesCents = moneyToCents(totalExpenses, unit);

  const checks: string[] = [];
  const check = (label: string, expected: number, actual: number): void => {
    if (expected !== actual) {
      checks.push(`${label}: printed/derived ${actual} != expected ${expected}`);
    }
  };
  check(
    'income statement revenue components = printed total revenue',
    totalRevenue!,
    revenueComponentsSum,
  );
  if (layout.expenseBridge === 'excluding-depreciation') {
    check(
      'expense components = printed total expenses excluding depreciation',
      expensesExDepreciation!,
      expenseComponentsSum,
    );
    check(
      'printed total expenses excluding depreciation + printed depreciation = printed total expenses',
      totalExpenses,
      faceExpenseBridge,
    );
  } else {
    check('expense components = printed total expenses', totalExpenses, expenseComponentsSum);
  }
  const b1IncomeVariance = functionsTotals.income - totalRevenue!;
  const b1ExpensesVariance = functionsTotals.expenses - totalExpenses;
  const b1OperatingResultVariance = functionsTotals.operating_result - netResult!;
  const expectedB1Income = totalRevenue! + (layout.b1Variance?.income ?? 0);
  const expectedB1Expenses = totalExpenses + (layout.b1Variance?.expenses ?? 0);
  const expectedB1Result = netResult! + (layout.b1Variance?.operatingResult ?? 0);
  check(
    'B1-1 total expenses = printed total expenses',
    expectedB1Expenses,
    functionsTotals.expenses,
  );
  check('B1-1 total income = printed total revenue', expectedB1Income, functionsTotals.income);
  check(
    'B1-1 operating result = printed net result',
    expectedB1Result,
    functionsTotals.operating_result,
  );
  if (layout.b1Variance) {
    check(
      'B1-1 income variance = declared unexplained variance',
      layout.b1Variance.income,
      b1IncomeVariance,
    );
    check(
      'B1-1 expenses variance = declared unexplained variance',
      layout.b1Variance.expenses,
      b1ExpensesVariance,
    );
    check(
      'B1-1 operating result variance = declared unexplained variance',
      layout.b1Variance.operatingResult,
      b1OperatingResultVariance,
    );
  }
  if (layout.functionsGrantsAnchor !== undefined) {
    check(
      'B1-1 grants and contributions = printed functions-note anchor',
      layout.functionsGrantsAnchor,
      functionsTotals.grants_and_contributions,
    );
  } else {
    check(
      'B1-1 grants and contributions = operating grants + capital grants',
      grantsOperating! + grantsCapital!,
      functionsTotals.grants_and_contributions,
    );
  }
  check(
    'printed total revenue - printed total expenses = printed net result',
    netResult!,
    totalRevenue! - totalExpenses,
  );
  check(
    'printed net result - capital grants = printed net result before capital grants',
    netResultBeforeCapital!,
    netResult! - grantsCapital!,
  );
  if (layout.olg) {
    check('OLG FY2024-25 expenses anchor', layout.olg.expensesCents, totalExpensesCents);
    check('OLG FY2024-25 revenue anchor', layout.olg.revenueCents, totalRevenueCents);
  }
  if (checks.length > 0) {
    return reject(`GPFS reconciliation failed: ${checks.join('; ')}; no rows ingested`);
  }

  const reconciliation: DubboGpfsReconciliation = {
    fiscal_year: fiscalYear,
    unit,
    unit_evidence: incomeUnit.reason,
    income_statement_page: incomePage.page_number,
    functions_page: functionsPage.page_number,
    total_revenue: totalRevenue!,
    total_expenses: totalExpenses,
    employee_expenses: employee!,
    depreciation_amortisation_impairment: depreciation!,
    government_grants_operating: grantsOperating!,
    government_grants_capital: grantsCapital!,
    net_result: netResult!,
    net_result_before_capital_grants: netResultBeforeCapital!,
    printed_total_expenses_excluding_depreciation: expensesExDepreciation,
    functions_total_income: functionsTotals.income,
    functions_total_expenses: functionsTotals.expenses,
    functions_operating_result: functionsTotals.operating_result,
    functions_grants_and_contributions: functionsTotals.grants_and_contributions,
    b1_income_variance: b1IncomeVariance,
    b1_expenses_variance: b1ExpensesVariance,
    b1_operating_result_variance: b1OperatingResultVariance,
    b1_variance_note: layout.b1Variance?.note ?? null,
    revenue_components_sum: revenueComponentsSum,
    expense_components_sum: expenseComponentsSum,
    face_expense_bridge: faceExpenseBridge,
    olg_expenses_cents: layout.olg?.expensesCents ?? null,
    olg_revenue_cents: layout.olg?.revenueCents ?? null,
    checks: [
      'income statement revenue components sum to the printed total revenue',
      layout.expenseBridge === 'excluding-depreciation'
        ? 'printed total expenses excluding depreciation + depreciation = B1-1 total expenses'
        : 'printed expense components sum to the printed total expenses',
      layout.b1Variance
        ? `B1-1 income and operating result are $${layout.b1Variance.income} thousand above the face statement; variance recorded as unexplained and face totals retained`
        : 'B1-1 Total functions and activities equals the face statement',
      layout.functionsGrantsAnchor !== undefined
        ? `B1-1 grants and contributions equal the printed functions-note anchor ${layout.functionsGrantsAnchor} (${layout.functionsGrantsNote})`
        : 'B1-1 grants and contributions equal the operating plus capital grant lines',
      layout.olg
        ? 'OLG FY2024-25 expenses and revenue anchors match exactly'
        : `no external OLG anchor is defined for FY${fiscalYear}`,
    ],
  };

  const reconciliationNote =
    layout.expenseBridge === 'excluding-depreciation'
      ? 'printed total expenses from B1-1, not a component sum; face-statement bridge reconciles exactly' +
        (layout.olg ? ' and OLG anchors match' : `; no OLG anchor for FY${fiscalYear}`)
      : layout.b1Variance
        ? `printed total expenses from the income statement; revenue and expense components reconcile exactly; B1-1 income and operating result are $${layout.b1Variance.income} thousand higher than the face (unexplained; face totals retained, no component adjusted); no OLG anchor for this year`
        : layout.functionsGrantsAnchor !== undefined
          ? `printed total expenses from the income statement; revenue and expense components reconcile exactly; B1-1 income, expenses and result equal the face; the B1-1 grants column is the independent printed anchor ${layout.functionsGrantsAnchor} and is not reconciled to the face grant lines; no OLG anchor for this year`
          : 'printed total expenses from the income statement; expense components, revenue components and B1-1 reconcile exactly (no OLG anchor for this year)';
  const records = values.map((line) =>
    mapLine(line, context, unit, incomeUnit.reason, reconciliationNote),
  );
  warnings.push(
    layout.olg
      ? `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000) to OLG ${layout.olg.revenueCents / 100} / ${layout.olg.expensesCents / 100} dollars`
      : layout.b1Variance
        ? `reconciled to the face statement: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000); B1-1 income/result are $${layout.b1Variance.income} thousand higher and remain unexplained; no external anchor for FY${fiscalYear}`
        : layout.functionsGrantsAnchor !== undefined
          ? `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000); B1-1 income, expenses and result agree with the face; B1-1 grants column ${layout.functionsGrantsAnchor} retained as an independent printed anchor; no external anchor for FY${fiscalYear}`
          : `reconciled exactly: revenue ${totalRevenue} and expenses ${totalExpenses} ($'000); B1-1 and face statement agree, no external anchor for FY${fiscalYear}`,
  );
  return { records, reconciliation, warnings, rejections };
}

export interface DubboGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Override only for tests; the live path discovers these from the reporting page. */
  document?: DubboGpfsDocument;
  /** Restrict the ingest to a subset of supported fiscal years (tests/backfills). */
  fiscalYears?: readonly string[];
}

function documentFilename(url: string, fiscalYear: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through to the stable name.
  }
  return `dubbo-regional-council-gpfs-${fiscalYear}.pdf`;
}

/** Build the live GPFS connector for its supported audited years. */
export function createDubboGpfsConnector(options: DubboGpfsConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return {
    id: DUBBO_GPFS_ID,
    name: DUBBO_GPFS_NAME,
    publisher: DUBBO_GPFS_PUBLISHER,
    source_url: DUBBO_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: DUBBO_GPFS_LICENSE,
    notes:
      "GPFS pilot: one council only (Dubbo Regional Council), audited FY2025-26, FY2024-25, FY2023-24, FY2022-23, FY2021-22, FY2020-21, FY2019-20 and FY2018-19 General Purpose Financial Statements. Each year's PDF is discovered from the official reporting page (no hard-coded document URL), SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, the printed total expenses and the functions-note Total functions and activities reconcile exactly (plus the OLG FY2024-25 anchors where that year matches). FY2020-21 reconciles to its face statement; its functions note prints income and operating result $188 thousand higher, and that variance is recorded as unexplained rather than forced to equality or spread across components. FY2019-20 reconciles to its face statement on income, expenses and result; the functions note prints grants included in income of $35,142 thousand, which differs from the face operating plus capital grant lines ($54,935 thousand), so that printed grant total is retained as an independent anchor and the grant lines are not adjusted. FY2018-19 reconciles to its face statement on income, expenses and result from the Actual current-year column of its three-column (budget, actual, restated prior) face; its functions note prints grants included in income of $44,452 thousand, which differs from the face operating plus capital grant lines ($65,789 thousand), so that printed grant total is retained as an independent anchor and the grant lines are not adjusted. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id from the 245 dubbo-council budget/estimate rows; no region/LGA allocation is created and no cross-year sum is taken.",
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const fiscalYears = options.document
        ? [options.document.fiscal_year]
        : (options.fiscalYears ?? DUBBO_GPFS_SUPPORTED_FISCAL_YEARS);
      const documents = options.document
        ? [options.document]
        : await Promise.all(
            fiscalYears.map((fiscalYear) => discoverDubboGpfsDocument(fetchImpl, fiscalYear)),
          );
      const raw: RawRecord[] = [];
      for (const document of documents) {
        const response = await fetchImpl(document.url, { redirect: 'follow' });
        if (!response.ok) {
          metadata.errors.push(
            `FY${document.fiscal_year}: Dubbo GPFS fetch HTTP ${response.status} for ${document.url}`,
          );
          continue;
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        const archived: ArchivedSourceRecord = await archiveSourceDocument({
          source_id: DUBBO_GPFS_ID,
          title: document.title,
          original_url: document.url,
          retrieved_from: document.url,
          archived_from: 'direct',
          filename: documentFilename(document.url, document.fiscal_year),
          content_type: 'application/pdf',
          data: bytes,
          root: options.archiveRoot,
          notes: `Audited Dubbo Regional Council FY${document.fiscal_year} General Purpose Financial Statements; archived for the GPFS reconciliation.`,
        });
        await verifySourceDocument(archived);
        const extraction = await extractArchivedPdf(archived);
        const context: DubboGpfsParseContext = {
          document,
          archive: {
            local_path: archived.local_path,
            sha256: archived.sha256,
            bytes: archived.bytes,
            fetched_at: archived.fetched_at,
          },
          sourceDate: archived.fetched_at.slice(0, 10),
          reporting_url: DUBBO_GPFS_REPORTING_URL,
        };
        const parsed = parseDubboGpfsExtraction(extraction, context);
        metadata.warnings.push(...parsed.warnings);
        if (parsed.records.length === 0) {
          metadata.errors.push(
            `FY${document.fiscal_year}: ` +
              (parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
                'no validated GPFS rows extracted'),
          );
          continue;
        }
        raw.push(...parsed.records.map((record) => ({ kind: 'dubbo-gpfs-measure', record })));
      }
      return raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'dubbo-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Dubbo GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };
}
