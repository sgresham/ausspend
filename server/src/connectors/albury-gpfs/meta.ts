import {
  ALBURY_GPFS_ID,
  ALBURY_GPFS_NAME,
  ALBURY_GPFS_PUBLISHER,
  ALBURY_GPFS_FISCAL_YEAR,
  ALBURY_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: ALBURY_GPFS_ID,
  name: ALBURY_GPFS_NAME,
  publisher: ALBURY_GPFS_PUBLISHER,
  fiscalYear: ALBURY_GPFS_FISCAL_YEAR,
  dataQualityFlag: ALBURY_GPFS_DATA_QUALITY_FLAG,
} as const;
