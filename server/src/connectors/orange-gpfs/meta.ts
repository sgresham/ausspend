import {
  ORANGE_GPFS_ID,
  ORANGE_GPFS_NAME,
  ORANGE_GPFS_PUBLISHER,
  ORANGE_GPFS_FISCAL_YEAR,
  ORANGE_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: ORANGE_GPFS_ID,
  name: ORANGE_GPFS_NAME,
  publisher: ORANGE_GPFS_PUBLISHER,
  fiscalYear: ORANGE_GPFS_FISCAL_YEAR,
  dataQualityFlag: ORANGE_GPFS_DATA_QUALITY_FLAG,
} as const;
