export const HORNSBY_GPFS_ID = 'hornsby-gpfs';
export const HORNSBY_GPFS_NAME = 'Hornsby Shire Council — General Purpose Financial Statements';
export const HORNSBY_GPFS_PUBLISHER = 'Hornsby Shire Council';
export const HORNSBY_GPFS_REPORTING_URL =
  'https://www.hornsby.nsw.gov.au/Council/Forms-and-publications/Publications/Financial-Statements';
export const HORNSBY_GPFS_FISCAL_YEAR = '2025-26';
export const HORNSBY_GPFS_SOURCE_DATASET = 'Hornsby Shire Council GPFS 2025-26';
export const HORNSBY_GPFS_LICENSE =
  '© Hornsby Shire Council. Published audited financial statements used for public-interest research; not an open-data licence grant.';
export const HORNSBY_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const HORNSBY_GPFS_DELIVERY_ENTITY = 'Hornsby Shire Council';

export const HORNSBY_GPFS_META = {
  id: HORNSBY_GPFS_ID,
  name: HORNSBY_GPFS_NAME,
  publisher: HORNSBY_GPFS_PUBLISHER,
  reportingUrl: HORNSBY_GPFS_REPORTING_URL,
  licence: HORNSBY_GPFS_LICENSE,
  fiscalYear: HORNSBY_GPFS_FISCAL_YEAR,
  dataQualityFlag: HORNSBY_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: HORNSBY_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: HORNSBY_GPFS_DELIVERY_ENTITY,
} as const;

export type HornsbyGpfsSection = 'revenue' | 'expenses' | 'result';

export interface HornsbyGpfsLineSpec {
  key: string;
  label: string;
  section: HornsbyGpfsSection;
  /** Printed subtotal this component belongs to. Omitted on the subtotal itself. */
  component_of?: string;
  /** Government grant/contribution row that may overlap government program data. */
  potential_double_count?: boolean;
  /**
   * When set, read the last printed occurrence of the label. The
   * expenses-excluding-depreciation total wraps onto a continuation line whose
   * last two lines are exactly the standalone depreciation line's label; the
   * standalone depreciation row is the later occurrence.
   */
  last_occurrence?: boolean;
  statement: 'Income Statement' | 'B1-1 Functions or activities';
}

/**
 * The printed lines we emit. The seven revenue components sum exactly to the
 * printed total income from continuing operations. The five expense-by-nature
 * components sum exactly to the printed "Total expenses from continuing
 * operations excluding depreciation, amortisation and impairment of
 * non-financial assets" line, which with the printed depreciation line forms
 * the printed face-statement expense bridge. Total expenses is the printed B1-1
 * "Total functions and activities" expense total, which equals that bridge
 * exactly. Net result is the printed net operating result repeated at the top of
 * the Statement of Comprehensive Income.
 */
export const HORNSBY_GPFS_LINES: readonly HornsbyGpfsLineSpec[] = [
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
    last_occurrence: true,
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
    label: 'Net operating result for the year – from Income Statement',
    section: 'result',
    statement: 'Income Statement',
  },
];

/** Printed B1-1 expense/service categories that carry a non-nil expense amount. */
export const HORNSBY_GPFS_FUNCTIONS: readonly { key: string; label: string }[] = [
  { key: 'general_managers_division', label: 'General Managers Division' },
  { key: 'corporate_support', label: 'Corporate Support' },
  { key: 'infrastructure_and_major_projects', label: 'Infrastructure & Major Projects' },
  { key: 'community_and_environment', label: 'Community & Environment' },
  { key: 'planning', label: 'Planning' },
];

export const HORNSBY_GPFS_TOTAL_ROW_LABEL = 'Total functions and activities';

export const HORNSBY_GPFS_DEPRECIATION_NOTE_LABEL = 'Total depreciation and amortisation costs';

export const HORNSBY_GPFS_PAGE_MARKERS = {
  income_statement: ['original unaudited budget', 'total income from continuing operations'],
  comprehensive_income: [
    'statement of comprehensive income',
    'net operating result for the year from income statement',
  ],
  functions: [
    'functions or activities income expenses and assets',
    'total functions and activities',
  ],
  depreciation_note: ['total depreciation and amortisation costs'],
} as const;
