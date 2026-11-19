import {
  WARREN_GPFS_ID,
  WARREN_GPFS_PUBLISHER,
  WARREN_GPFS_FISCAL_YEAR,
  WARREN_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: WARREN_GPFS_ID,
  publisher: WARREN_GPFS_PUBLISHER,
  fiscalYear: WARREN_GPFS_FISCAL_YEAR,
  dataQualityFlag: WARREN_GPFS_DATA_QUALITY_FLAG,
} as const;
