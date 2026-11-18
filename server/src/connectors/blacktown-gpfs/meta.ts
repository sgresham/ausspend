/**
 * Blacktown City Council GPFS adapter metadata.
 *
 * This module is the single place a registry/manifest reads source identity,
 * publisher, reporting URL, licence and fiscal year. No data or secrets.
 */
export const BLACKTOWN_GPFS_ID = 'blacktown-gpfs';
export const BLACKTOWN_GPFS_NAME = 'Blacktown City Council — General Purpose Financial Statements';
export const BLACKTOWN_GPFS_PUBLISHER = 'Blacktown City Council';
export const BLACKTOWN_GPFS_REPORTING_URL =
  'https://www.blacktown.nsw.gov.au/About-Council/Plans-policies-and-reports/Annual-audit-and-financial-reports';
export const BLACKTOWN_GPFS_FISCAL_YEAR = '2024-25';
export const BLACKTOWN_GPFS_TARGET_YEAR_LABEL = '2024/25';
export const BLACKTOWN_GPFS_SOURCE_DATASET = 'Blacktown City Council GPFS 2024-25';
export const BLACKTOWN_GPFS_LICENSE =
  '© Blacktown City Council. Published council documents used here for public-interest research; not an open-data licence grant.';
export const BLACKTOWN_GPFS_DATA_QUALITY_FLAG = 'provisional/local_government';

export const BLACKTOWN_GPFS_META = {
  id: BLACKTOWN_GPFS_ID,
  name: BLACKTOWN_GPFS_NAME,
  publisher: BLACKTOWN_GPFS_PUBLISHER,
  reportingUrl: BLACKTOWN_GPFS_REPORTING_URL,
  licence: BLACKTOWN_GPFS_LICENSE,
  fiscalYear: BLACKTOWN_GPFS_FISCAL_YEAR,
  dataQualityFlag: BLACKTOWN_GPFS_DATA_QUALITY_FLAG,
  sourceDataset: BLACKTOWN_GPFS_SOURCE_DATASET,
  jurisdiction: 'NSW',
  deliveryEntity: 'Blacktown City Council',
} as const;
