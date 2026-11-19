import {
  WALCHA_GPFS_ID,
  WALCHA_GPFS_NAME,
  WALCHA_GPFS_PUBLISHER,
  WALCHA_GPFS_FISCAL_YEAR,
  WALCHA_GPFS_DATA_QUALITY_FLAG,
} from './parse.js';

export * from './parse.js';

export const MODULE_META = {
  id: WALCHA_GPFS_ID,
  name: WALCHA_GPFS_NAME,
  publisher: WALCHA_GPFS_PUBLISHER,
  fiscalYear: WALCHA_GPFS_FISCAL_YEAR,
  dataQualityFlag: WALCHA_GPFS_DATA_QUALITY_FLAG,
} as const;
