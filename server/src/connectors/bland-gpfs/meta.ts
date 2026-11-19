import {
  BLAND_GPFS_ID,
  BLAND_GPFS_NAME,
  BLAND_GPFS_PUBLISHER,
  BLAND_GPFS_FISCAL_YEAR,
  BLAND_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: BLAND_GPFS_ID,
  name: BLAND_GPFS_NAME,
  publisher: BLAND_GPFS_PUBLISHER,
  fiscalYear: BLAND_GPFS_FISCAL_YEAR,
  dataQualityFlag: BLAND_GPFS_DATA_QUALITY_FLAG,
} as const;
