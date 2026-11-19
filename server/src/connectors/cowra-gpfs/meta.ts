import {
  COWRA_GPFS_ID,
  COWRA_GPFS_NAME,
  COWRA_GPFS_PUBLISHER,
  COWRA_GPFS_FISCAL_YEAR,
  COWRA_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: COWRA_GPFS_ID,
  name: COWRA_GPFS_NAME,
  publisher: COWRA_GPFS_PUBLISHER,
  fiscalYear: COWRA_GPFS_FISCAL_YEAR,
  dataQualityFlag: COWRA_GPFS_DATA_QUALITY_FLAG,
} as const;
