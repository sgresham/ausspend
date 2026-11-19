import {
  BYRON_GPFS_ID,
  BYRON_GPFS_NAME,
  BYRON_GPFS_PUBLISHER,
  BYRON_GPFS_FISCAL_YEAR,
  BYRON_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: BYRON_GPFS_ID,
  name: BYRON_GPFS_NAME,
  publisher: BYRON_GPFS_PUBLISHER,
  fiscalYear: BYRON_GPFS_FISCAL_YEAR,
  dataQualityFlag: BYRON_GPFS_DATA_QUALITY_FLAG,
} as const;
