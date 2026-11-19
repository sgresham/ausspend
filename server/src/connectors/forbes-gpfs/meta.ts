import {
  FORBES_GPFS_ID,
  FORBES_GPFS_NAME,
  FORBES_GPFS_PUBLISHER,
  FORBES_GPFS_FISCAL_YEAR,
  FORBES_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: FORBES_GPFS_ID,
  name: FORBES_GPFS_NAME,
  publisher: FORBES_GPFS_PUBLISHER,
  fiscalYear: FORBES_GPFS_FISCAL_YEAR,
  dataQualityFlag: FORBES_GPFS_DATA_QUALITY_FLAG,
} as const;
