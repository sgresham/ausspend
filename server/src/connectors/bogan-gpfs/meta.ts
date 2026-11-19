import {
  BOGAN_GPFS_ID,
  BOGAN_GPFS_NAME,
  BOGAN_GPFS_PUBLISHER,
  BOGAN_GPFS_FISCAL_YEAR,
  BOGAN_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: BOGAN_GPFS_ID,
  name: BOGAN_GPFS_NAME,
  publisher: BOGAN_GPFS_PUBLISHER,
  fiscalYear: BOGAN_GPFS_FISCAL_YEAR,
  dataQualityFlag: BOGAN_GPFS_DATA_QUALITY_FLAG,
} as const;
