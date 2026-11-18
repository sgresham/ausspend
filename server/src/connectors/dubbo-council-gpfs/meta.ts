import {
  DUBBO_GPFS_ID,
  DUBBO_GPFS_NAME,
  DUBBO_GPFS_PUBLISHER,
  DUBBO_GPFS_FISCAL_YEAR,
  DUBBO_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: DUBBO_GPFS_ID,
  name: DUBBO_GPFS_NAME,
  publisher: DUBBO_GPFS_PUBLISHER,
  fiscalYear: DUBBO_GPFS_FISCAL_YEAR,
  dataQualityFlag: DUBBO_GPFS_DATA_QUALITY_FLAG,
} as const;
