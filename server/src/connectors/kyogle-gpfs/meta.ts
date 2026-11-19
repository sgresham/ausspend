import {
  KYOGLE_GPFS_ID,
  KYOGLE_GPFS_NAME,
  KYOGLE_GPFS_PUBLISHER,
  KYOGLE_GPFS_FISCAL_YEAR,
  KYOGLE_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: KYOGLE_GPFS_ID,
  name: KYOGLE_GPFS_NAME,
  publisher: KYOGLE_GPFS_PUBLISHER,
  fiscalYear: KYOGLE_GPFS_FISCAL_YEAR,
  dataQualityFlag: KYOGLE_GPFS_DATA_QUALITY_FLAG,
} as const;
