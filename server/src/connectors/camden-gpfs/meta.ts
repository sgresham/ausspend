import {
  CAMDEN_GPFS_ID,
  CAMDEN_GPFS_NAME,
  CAMDEN_GPFS_PUBLISHER,
  CAMDEN_GPFS_FISCAL_YEAR,
  CAMDEN_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: CAMDEN_GPFS_ID,
  name: CAMDEN_GPFS_NAME,
  publisher: CAMDEN_GPFS_PUBLISHER,
  fiscalYear: CAMDEN_GPFS_FISCAL_YEAR,
  dataQualityFlag: CAMDEN_GPFS_DATA_QUALITY_FLAG,
} as const;
