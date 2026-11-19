import {
  KIAMA_GPFS_ID,
  KIAMA_GPFS_NAME,
  KIAMA_GPFS_PUBLISHER,
  KIAMA_GPFS_FISCAL_YEAR,
  KIAMA_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: KIAMA_GPFS_ID,
  name: KIAMA_GPFS_NAME,
  publisher: KIAMA_GPFS_PUBLISHER,
  fiscalYear: KIAMA_GPFS_FISCAL_YEAR,
  dataQualityFlag: KIAMA_GPFS_DATA_QUALITY_FLAG,
} as const;
