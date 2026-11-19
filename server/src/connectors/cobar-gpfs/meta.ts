import {
  COBAR_GPFS_ID,
  COBAR_GPFS_NAME,
  COBAR_GPFS_PUBLISHER,
  COBAR_GPFS_FISCAL_YEAR,
  COBAR_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: COBAR_GPFS_ID,
  name: COBAR_GPFS_NAME,
  publisher: COBAR_GPFS_PUBLISHER,
  fiscalYear: COBAR_GPFS_FISCAL_YEAR,
  dataQualityFlag: COBAR_GPFS_DATA_QUALITY_FLAG,
} as const;
