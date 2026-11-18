export const HUNTERS_HILL_GPFS_ID = 'hunters-hill-gpfs';
export const HUNTERS_HILL_GPFS_NAME = 'Hunters Hill Council — General Purpose Financial Statements';
export const HUNTERS_HILL_GPFS_PUBLISHER = 'Hunters Hill Council';
export const HUNTERS_HILL_GPFS_REPORTING_URL =
  'https://www.huntershill.nsw.gov.au/Council/Policies-and-Publications/Annual-Reports-and-Financial-Statements';
export const HUNTERS_HILL_GPFS_PDF_URL =
  'https://www.huntershill.nsw.gov.au/files/assets/public/v/1/council/reports-and-publications/annual-reports-and-financial-statements/financial-statements/annual-financial-statement-2024-2025.pdf';
export const HUNTERS_HILL_GPFS_FISCAL_YEAR = '2024-25';
export const HUNTERS_HILL_GPFS_SOURCE_DATASET = 'Hunters Hill Council GPFS 2024-25';
export const HUNTERS_HILL_GPFS_LICENSE =
  '© Hunters Hill Council. Published audited financial statements used for public-interest research; not an open-data licence grant.';
export const HUNTERS_HILL_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';
export const HUNTERS_HILL_GPFS_META = {
  id: HUNTERS_HILL_GPFS_ID,
  name: HUNTERS_HILL_GPFS_NAME,
  publisher: HUNTERS_HILL_GPFS_PUBLISHER,
  reportingUrl: HUNTERS_HILL_GPFS_REPORTING_URL,
  licence: HUNTERS_HILL_GPFS_LICENSE,
  fiscalYear: HUNTERS_HILL_GPFS_FISCAL_YEAR,
  dataQualityFlag: HUNTERS_HILL_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: HUNTERS_HILL_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: 'Hunters Hill Council',
} as const;
