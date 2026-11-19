import {
  GWYDIR_GPFS_ID,
  GWYDIR_GPFS_NAME,
  GWYDIR_GPFS_PUBLISHER,
  GWYDIR_GPFS_FISCAL_YEAR,
  GWYDIR_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: GWYDIR_GPFS_ID,
  name: GWYDIR_GPFS_NAME,
  publisher: GWYDIR_GPFS_PUBLISHER,
  fiscalYear: GWYDIR_GPFS_FISCAL_YEAR,
  dataQualityFlag: GWYDIR_GPFS_DATA_QUALITY_FLAG,
} as const;
