import {
  HORNSBY_GPFS_DATA_QUALITY_FLAG,
  HORNSBY_GPFS_FISCAL_YEAR,
  HORNSBY_GPFS_ID,
  HORNSBY_GPFS_NAME,
  HORNSBY_GPFS_PUBLISHER,
} from './config.js';

export * from './config.js';

export const MODULE_META = {
  id: HORNSBY_GPFS_ID,
  name: HORNSBY_GPFS_NAME,
  publisher: HORNSBY_GPFS_PUBLISHER,
  fiscalYear: HORNSBY_GPFS_FISCAL_YEAR,
  dataQualityFlag: HORNSBY_GPFS_DATA_QUALITY_FLAG,
} as const;
