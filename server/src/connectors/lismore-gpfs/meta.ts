import {
  LISMORE_GPFS_ID,
  LISMORE_GPFS_NAME,
  LISMORE_GPFS_PUBLISHER,
  LISMORE_GPFS_FISCAL_YEAR,
  LISMORE_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: LISMORE_GPFS_ID,
  name: LISMORE_GPFS_NAME,
  publisher: LISMORE_GPFS_PUBLISHER,
  fiscalYear: LISMORE_GPFS_FISCAL_YEAR,
  dataQualityFlag: LISMORE_GPFS_DATA_QUALITY_FLAG,
} as const;
