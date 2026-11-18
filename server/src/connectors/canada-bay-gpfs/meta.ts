import {
  CANADA_BAY_GPFS_ID,
  CANADA_BAY_GPFS_PUBLISHER,
  CANADA_BAY_GPFS_FISCAL_YEAR,
  CANADA_BAY_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: CANADA_BAY_GPFS_ID,
  publisher: CANADA_BAY_GPFS_PUBLISHER,
  fiscalYear: CANADA_BAY_GPFS_FISCAL_YEAR,
  dataQualityFlag: CANADA_BAY_GPFS_DATA_QUALITY_FLAG,
} as const;
