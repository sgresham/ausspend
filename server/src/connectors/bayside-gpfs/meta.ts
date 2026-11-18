import {
  BAYSIDE_GPFS_ID,
  BAYSIDE_GPFS_NAME,
  BAYSIDE_GPFS_PUBLISHER,
  BAYSIDE_GPFS_FISCAL_YEAR,
  BAYSIDE_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: BAYSIDE_GPFS_ID,
  name: BAYSIDE_GPFS_NAME,
  publisher: BAYSIDE_GPFS_PUBLISHER,
  fiscalYear: BAYSIDE_GPFS_FISCAL_YEAR,
  dataQualityFlag: BAYSIDE_GPFS_DATA_QUALITY_FLAG,
} as const;
