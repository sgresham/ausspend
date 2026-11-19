import {
  LEETON_GPFS_ID,
  LEETON_GPFS_NAME,
  LEETON_GPFS_PUBLISHER,
  LEETON_GPFS_FISCAL_YEAR,
  LEETON_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: LEETON_GPFS_ID,
  name: LEETON_GPFS_NAME,
  publisher: LEETON_GPFS_PUBLISHER,
  fiscalYear: LEETON_GPFS_FISCAL_YEAR,
  dataQualityFlag: LEETON_GPFS_DATA_QUALITY_FLAG,
} as const;
