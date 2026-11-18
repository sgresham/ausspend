export const WOOLLAHRA_GPFS_ID = 'woollahra-gpfs';
export const WOOLLAHRA_GPFS_NAME =
  'Woollahra Municipal Council — General Purpose Financial Statements';
export const WOOLLAHRA_GPFS_PUBLISHER = 'Woollahra Municipal Council';
export const WOOLLAHRA_GPFS_REPORTING_URL =
  'https://www.woollahra.nsw.gov.au/Council/Vision-structure-and-financial-sustainability/Integrated-planning-and-reporting/Annual-Report';
export const WOOLLAHRA_GPFS_PDF_URL =
  'https://www.woollahra.nsw.gov.au/files/assets/public/v/2/council/documents/annual-report-fy24-25-part-3.pdf';
export const WOOLLAHRA_GPFS_FISCAL_YEAR = '2024-25';
export const WOOLLAHRA_GPFS_SOURCE_DATASET = 'Woollahra Municipal Council GPFS 2024-25';
export const WOOLLAHRA_GPFS_LICENSE =
  '© Woollahra Municipal Council. Published audited financial statements used for public-interest research; not an open-data licence grant.';
export const WOOLLAHRA_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const WOOLLAHRA_GPFS_META = {
  id: WOOLLAHRA_GPFS_ID,
  name: WOOLLAHRA_GPFS_NAME,
  publisher: WOOLLAHRA_GPFS_PUBLISHER,
  reportingUrl: WOOLLAHRA_GPFS_REPORTING_URL,
  licence: WOOLLAHRA_GPFS_LICENSE,
  fiscalYear: WOOLLAHRA_GPFS_FISCAL_YEAR,
  dataQualityFlag: WOOLLAHRA_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: WOOLLAHRA_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: 'Woollahra Municipal Council',
} as const;

export type WoollahraSection = 'revenue' | 'expenses' | 'result';

export interface WoollahraLineSpec {
  key: string;
  label: string;
  section: WoollahraSection;
  component_of?: string;
  potential_double_count?: boolean;
  statement: 'Income Statement' | 'B1-1 Functions or activities';
}

export const WOOLLAHRA_INCOME_LINES: readonly WoollahraLineSpec[] = [
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
    key: 'fair_value_increment_investment_properties',
    label: 'Fair value increment/ (decrement) on investment properties',
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
    key: 'net_loss_on_disposal',
    label: 'Net loss from the disposal of assets',
    section: 'expenses',
    component_of: 'total_expenses',
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
];

export const WOOLLAHRA_FUNCTIONS: readonly { key: string; label: string }[] = [
  { key: 'connected_harmonious_community', label: 'A connected and harmonious community' },
  { key: 'supported_community', label: 'A supported community' },
  { key: 'creative_vibrant_community', label: 'A creative and vibrant community' },
  { key: 'well_planned_neighbourhoods', label: 'Well planned neighbourhoods' },
  { key: 'liveable_places', label: 'Liveable places' },
  { key: 'getting_around', label: 'Getting around' },
  { key: 'protecting_our_environment', label: 'Protecting our environment' },
  { key: 'sustainable_use_of_resources', label: 'Sustainable use of resources' },
  {
    key: 'community_focused_economic_development',
    label: 'Community focused economic development',
  },
  { key: 'working_together', label: 'Working together' },
  { key: 'well_managed_council', label: 'Well managed Council' },
];

export const WOOLLAHRA_PAGE_MARKERS = {
  income_statement: 'Original unaudited budget',
  comprehensive_income: 'Statement of Comprehensive Income',
  functions: 'Total functions and activities',
} as const;
