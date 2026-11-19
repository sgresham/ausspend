import {
  BALLINA_GPFS_ID,
  BALLINA_GPFS_NAME,
  BALLINA_GPFS_PUBLISHER,
  BALLINA_GPFS_FISCAL_YEAR,
  BALLINA_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: BALLINA_GPFS_ID,
  name: BALLINA_GPFS_NAME,
  publisher: BALLINA_GPFS_PUBLISHER,
  fiscalYear: BALLINA_GPFS_FISCAL_YEAR,
  dataQualityFlag: BALLINA_GPFS_DATA_QUALITY_FLAG,
} as const;
