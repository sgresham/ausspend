import {
  JUNEE_GPFS_ID,
  JUNEE_GPFS_NAME,
  JUNEE_GPFS_PUBLISHER,
  JUNEE_GPFS_FISCAL_YEAR,
  JUNEE_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: JUNEE_GPFS_ID,
  name: JUNEE_GPFS_NAME,
  publisher: JUNEE_GPFS_PUBLISHER,
  fiscalYear: JUNEE_GPFS_FISCAL_YEAR,
  dataQualityFlag: JUNEE_GPFS_DATA_QUALITY_FLAG,
} as const;
